// Owner-only sign-in: GitHub (who you are, with GitHub's own 2-step verification) + a 6-digit code from an
// authenticator app checked HERE on the server (second factor), then a short server-side session.
// Nothing secret ever reaches the browser: the GitHub token stays encrypted in D1 and the browser only holds an
// HttpOnly, Secure, SameSite=Strict cookie with a random session id.
import qrcode from 'qrcode-generator';
import {
  now, randomToken, sha256hex, seal, unseal, hmac, safeEqual, base32, randomBytes, verifyTotp,
  clientIp, shortIp, country, shortUa, parseCookies, cookie, redirect, json, esc,
} from './util.js';
import { page } from './pages.js';

export const SESSION_COOKIE = '__Host-wtv_s';
const STATE_COOKIE = '__Host-wtv_oauth';
const SETUP_COOKIE = '__Host-wtv_setup';

const ghWeb = env => (env.GITHUB_WEB || 'https://github.com').replace(/\/$/, '');
export const ghApi = env => (env.GITHUB_API || 'https://api.github.com').replace(/\/$/, '');
const num = (v, d) => { const n = parseInt(v, 10); return Number.isFinite(n) && n > 0 ? n : d; };
export const limits = env => ({
  idle: num(env.SESSION_IDLE_MINUTES, 30) * 60,        // signed out after 30 minutes without activity
  max: num(env.SESSION_MAX_HOURS, 8) * 3600,           // and always after 8 hours
});

export function ghHeaders(token) {
  const h = { Accept: 'application/vnd.github+json', 'User-Agent': 'wartabiye-admin', 'X-GitHub-Api-Version': '2022-11-28' };
  if (token) h.Authorization = 'Bearer ' + token;
  return h;
}

// ---- audit log and rate limits ------------------------------------------------------------------------------
export async function audit(env, req, event, { login = null, ok = true, detail = null } = {}) {
  try {
    await env.DB.prepare('INSERT INTO audit (ts, event, login, ok, ip, country, ua, detail) VALUES (?,?,?,?,?,?,?,?)')
      .bind(now(), event, login, ok ? 1 : 0, req ? shortIp(clientIp(req)) : null, req ? country(req) : null,
        req ? shortUa(req.headers.get('user-agent') || '') : null, detail ? String(detail).slice(0, 300) : null).run();
  } catch (e) { console.error('audit failed', e); }
}
// fixed window counter; returns false when the limit is reached
export async function hit(env, key, limit, windowSec) {
  const t = now();
  const row = await env.DB.prepare(
    `INSERT INTO ratelimit (k, n, reset) VALUES (?1, 1, ?2 + ?3)
     ON CONFLICT(k) DO UPDATE SET n = CASE WHEN reset <= ?2 THEN 1 ELSE n + 1 END,
                                  reset = CASE WHEN reset <= ?2 THEN ?2 + ?3 ELSE reset END
     RETURNING n, reset`).bind(key, t, windowSec).first();
  return { ok: row.n <= limit, retry: row.reset - t, n: row.n };
}
async function peek(env, key) {
  const r = await env.DB.prepare('SELECT n, reset FROM ratelimit WHERE k = ?').bind(key).first();
  return r && r.reset > now() ? r.n : 0;
}
const ipKey = async req => (await sha256hex('ip:' + clientIp(req))).slice(0, 24);

// ---- GitHub App (created once with the setup page, or given as Worker secrets) ------------------------------
export async function githubApp(env) {
  if (env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET) return { client_id: env.GITHUB_CLIENT_ID, client_secret: env.GITHUB_CLIENT_SECRET, slug: env.GITHUB_APP_SLUG || '' };
  const row = await env.DB.prepare("SELECT v FROM config WHERE k = 'github_app'").first();
  if (!row) return null;
  const s = await unseal(env.SESSION_SECRET, row.v);
  return s ? JSON.parse(s) : null;
}

// ---- sessions ------------------------------------------------------------------------------------------------
export async function newSession(env, req, user, stage, tok) {
  const id = randomToken(32);
  const t = now();
  const { max } = limits(env);
  await env.DB.prepare(`INSERT INTO sessions (id, uid, login, name, avatar, stage, created, seen, expires, tok, tok_exp, rtok, ua, country)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(
    await sha256hex(id), user.id, user.login, user.name || null, user.avatar_url || null, stage, t, t,
    stage === 'ok' ? t + max : t + 600,
    await seal(env.SESSION_SECRET, tok.access_token), tok.expires_in ? t + tok.expires_in : null,
    tok.refresh_token ? await seal(env.SESSION_SECRET, tok.refresh_token) : null,
    shortUa(req.headers.get('user-agent') || ''), country(req)).run();
  return id;
}
export async function getSession(env, req, { stage = 'ok', touch = true } = {}) {
  const raw = parseCookies(req)[SESSION_COOKIE];
  if (!raw || raw.length < 20 || raw.length > 100) return null;
  const id = await sha256hex(raw);
  const s = await env.DB.prepare('SELECT * FROM sessions WHERE id = ?').bind(id).first();
  if (!s) return null;
  const t = now();
  const { idle } = limits(env);
  if (s.expires <= t || (s.stage === 'ok' && t - s.seen > idle)) {
    await env.DB.prepare('DELETE FROM sessions WHERE id = ?').bind(id).run();
    await audit(env, req, 'session_expired', { login: s.login, detail: s.expires <= t ? 'maximum session length reached' : 'inactive for too long' });
    return { expired: true };
  }
  if (s.stage !== stage) return null;
  if (touch && t - s.seen >= 60) {
    await env.DB.prepare('UPDATE sessions SET seen = ? WHERE id = ?').bind(t, id).run();
    s.seen = t;
  }
  s._key = id;
  return s;
}
export async function sessionToken(env, s) {
  // the GitHub user token expires after 8 hours; renew it with the refresh token while the session is valid
  if (s.tok_exp && s.tok_exp - now() < 120 && s.rtok) {
    const app = await githubApp(env);
    const r = await fetch(ghWeb(env) + '/login/oauth/access_token', {
      method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'User-Agent': 'wartabiye-admin' },
      body: JSON.stringify({ client_id: app.client_id, client_secret: app.client_secret, grant_type: 'refresh_token', refresh_token: await unseal(env.SESSION_SECRET, s.rtok) }),
    });
    const j = await r.json().catch(() => ({}));
    if (j.access_token) {
      const t = now();
      s.tok = await seal(env.SESSION_SECRET, j.access_token);
      s.tok_exp = j.expires_in ? t + j.expires_in : null;
      s.rtok = j.refresh_token ? await seal(env.SESSION_SECRET, j.refresh_token) : s.rtok;
      await env.DB.prepare('UPDATE sessions SET tok = ?, tok_exp = ?, rtok = ? WHERE id = ?').bind(s.tok, s.tok_exp, s.rtok, s._key).run();
      return j.access_token;
    }
  }
  return unseal(env.SESSION_SECRET, s.tok);
}
async function revokeGithubToken(env, token) {
  try {
    const app = await githubApp(env);
    if (!app || !token) return;
    await fetch(ghApi(env) + `/applications/${app.client_id}/token`, {
      method: 'DELETE', headers: { ...ghHeaders(), Authorization: 'Basic ' + btoa(app.client_id + ':' + app.client_secret), 'Content-Type': 'application/json' },
      body: JSON.stringify({ access_token: token }),
    });
  } catch (e) { console.error('token revoke failed', e); }
}
const clearSession = cookie(SESSION_COOKIE, '', { maxAge: 0 });

// ---- owner check: the GitHub account must be an ADMIN of the website repository (today only the owner) ---------
export async function isOwner(env, token, user) {
  const ids = String(env.OWNER_GITHUB_IDS || '').split(',').map(s => s.trim()).filter(Boolean);
  if (ids.length && !ids.includes(String(user.id))) return { ok: false, why: 'not in OWNER_GITHUB_IDS' };
  const r = await fetch(`${ghApi(env)}/repos/${env.REPO}`, { headers: ghHeaders(token) });
  if (r.status === 404 || r.status === 403) return { ok: false, why: 'no access to the repository (is the app installed on it?)', install: true };
  if (!r.ok) return { ok: false, why: 'GitHub answered ' + r.status };
  const repo = await r.json();
  if (!repo.permissions?.admin) return { ok: false, why: 'not an admin of ' + env.REPO };
  return { ok: true };
}

// ---- same-origin check for every form POST (on top of the SameSite=Strict cookie) ---------------------------------
export function sameOrigin(req) {
  const o = req.headers.get('origin');
  const site = req.headers.get('sec-fetch-site');
  if (site && site !== 'same-origin') return false;
  return !o || o === new URL(req.url).origin;
}

// ---- routes ---------------------------------------------------------------------------------------------------------
export async function authStart(req, env) {
  const app = await githubApp(env);
  if (!app) return redirect('/setup');
  const rl = await hit(env, 'start:' + await ipKey(req), 20, 900);
  if (!rl.ok) { await audit(env, req, 'login_rate_limited', { ok: false }); return redirect('/login?e=rate'); }
  const state = randomToken(24);
  const origin = new URL(req.url).origin;
  const u = new URL(ghWeb(env) + '/login/oauth/authorize');
  u.searchParams.set('client_id', app.client_id);
  u.searchParams.set('redirect_uri', origin + '/auth/callback');
  u.searchParams.set('state', state);
  u.searchParams.set('allow_signup', 'false');
  await audit(env, req, 'login_started');
  return redirect(u.toString(), 302, [cookie(STATE_COOKIE, state + '.' + await hmac(env.SESSION_SECRET, state), { maxAge: 600, sameSite: 'Lax' })]);
}

export async function authCallback(req, env) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code'), state = url.searchParams.get('state');
  const [st, sig] = String(parseCookies(req)[STATE_COOKIE] || '').split('.');
  const clear = cookie(STATE_COOKIE, '', { maxAge: 0, sameSite: 'Lax' });
  if (!code || !state || !st || !safeEqual(st, state) || !safeEqual(sig || '', await hmac(env.SESSION_SECRET, st))) {
    await audit(env, req, 'login_failed', { ok: false, detail: 'invalid or expired sign-in state' });
    return redirect('/login?e=state', 302, [clear]);
  }
  const app = await githubApp(env);
  const tr = await fetch(ghWeb(env) + '/login/oauth/access_token', {
    method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'User-Agent': 'wartabiye-admin' },
    body: JSON.stringify({ client_id: app.client_id, client_secret: app.client_secret, code, redirect_uri: url.origin + '/auth/callback' }),
  });
  const tok = await tr.json().catch(() => ({}));
  if (!tok.access_token) {
    await audit(env, req, 'login_failed', { ok: false, detail: 'GitHub refused the sign-in code: ' + (tok.error || tr.status) });
    return redirect('/login?e=github', 302, [clear]);
  }
  const ur = await fetch(ghApi(env) + '/user', { headers: ghHeaders(tok.access_token) });
  const user = ur.ok ? await ur.json() : null;
  if (!user?.id) { await audit(env, req, 'login_failed', { ok: false, detail: 'GitHub profile not readable' }); return redirect('/login?e=github', 302, [clear]); }
  const own = await isOwner(env, tok.access_token, user);
  if (!own.ok) {
    await audit(env, req, 'login_denied', { login: user.login, ok: false, detail: own.why });
    await revokeGithubToken(env, tok.access_token);
    return redirect('/login?e=' + (own.install ? 'install' : 'denied'), 302, [clear]);
  }
  const id = await newSession(env, req, user, 'mfa', tok);
  await audit(env, req, 'github_ok', { login: user.login, detail: 'second step required' });
  // a small same-site page instead of a redirect, so the browser sends the Strict cookie on the next request
  return page({ title: 'Signing in…', refresh: '/mfa', body: '<div class="spin" aria-hidden="true"></div><p class="lead">GitHub confirmed your account. Opening the security code step…</p><p><a class="btn" href="/mfa">Continue</a></p>' },
    200, [clear, cookie(SESSION_COOKIE, id, { maxAge: 600 })]);
}

function qrSvg(text) {
  const q = qrcode(0, 'M'); q.addData(text); q.make();
  return q.createSvgTag({ cellSize: 5, margin: 2, scalable: true, alt: 'QR code for your authenticator app' });
}
const codeForm = (err, extra = '') => `
  ${err ? `<div class="alert" role="alert">${esc(err)}</div>` : ''}
  <form method="post" action="/mfa" class="form" autocomplete="off">
    <label for="code">6-digit code</label>
    <input id="code" name="code" inputmode="numeric" autocomplete="one-time-code" maxlength="14" required autofocus placeholder="123 456">
    ${extra}
    <button class="btn primary" type="submit"><span>Verify and open dashboard</span></button>
  </form>`;

export async function mfaPage(req, env, err = '') {
  const s = await getSession(env, req, { stage: 'mfa', touch: false });
  if (!s || s.expired) return redirect('/login?e=expired');
  const m = await env.DB.prepare('SELECT uid FROM mfa WHERE uid = ?').bind(s.uid).first();
  if (m) {
    return page({ title: 'Security code', step: 2, body: `<h1>Enter your security code</h1>
      <p class="lead">Signed in to GitHub as <b>@${esc(s.login)}</b>. Open your authenticator app and type the 6-digit code for <b>Wartabiye TV Admin</b>.</p>
      ${codeForm(err)}<p class="hint">Lost your phone? Type one of your one-time recovery codes instead (format <code>xxxx-xxxx-xx</code>).</p>
      <p class="hint"><a href="/login">Cancel</a></p>` });
  }
  // first sign-in: set up the authenticator app
  let secret = await unseal(env.SESSION_SECRET, s.pend);
  if (!secret) {
    secret = base32(randomBytes(20));
    await env.DB.prepare('UPDATE sessions SET pend = ? WHERE id = ?').bind(await seal(env.SESSION_SECRET, secret), s._key).run();
  }
  const label = encodeURIComponent('Wartabiye TV Admin:' + s.login);
  const uri = `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent('Wartabiye TV Admin')}&algorithm=SHA1&digits=6&period=30`;
  return page({ title: 'Set up 2-step verification', step: 2, wide: true, body: `<h1>Protect the dashboard with a second step</h1>
    <p class="lead">Signed in to GitHub as <b>@${esc(s.login)}</b>. This is a one-time setup: from now on, signing in also needs a 6-digit code from your phone.</p>
    <ol class="steps">
      <li>Install an authenticator app on your phone, for example <b>Google Authenticator</b>, <b>Microsoft Authenticator</b> or <b>2FAS</b> (all free).</li>
      <li>In the app, tap <b>+</b> and scan this code:<div class="qr">${qrSvg(uri)}</div>
        <details><summary>Can't scan? Enter the key by hand</summary><p class="mono">${secret.match(/.{1,4}/g).join(' ')}</p><p class="hint">Type: time-based · 6 digits · 30 seconds</p></details></li>
      <li>Type the 6-digit code that the app now shows:</li>
    </ol>${codeForm(err)}` });
}

export async function mfaSubmit(req, env) {
  if (!sameOrigin(req)) return new Response('Forbidden', { status: 403 });
  const s = await getSession(env, req, { stage: 'mfa', touch: false });
  if (!s || s.expired) return redirect('/login?e=expired', 303);
  const form = await req.formData();
  const raw = String(form.get('code') || '').trim();
  const ik = 'mfa-ip:' + await ipKey(req), uk = 'mfa-user:' + s.uid;
  if ((await peek(env, uk)) >= 5 || (await peek(env, ik)) >= 10) {
    await audit(env, req, 'mfa_locked', { login: s.login, ok: false, detail: 'too many wrong codes: wait 15 minutes' });
    return mfaPage(req, env, 'Too many wrong codes. For your security, wait 15 minutes and sign in again.');
  }
  const m = await env.DB.prepare('SELECT * FROM mfa WHERE uid = ?').bind(s.uid).first();
  let ok = false, recovery = null, usedRecovery = false;
  if (m) {
    const secret = await unseal(env.SESSION_SECRET, m.secret);
    const step = await verifyTotp(secret, raw, m.last_step);
    if (step) {
      const r = await env.DB.prepare('UPDATE mfa SET last_step = ? WHERE uid = ? AND last_step < ?').bind(step, s.uid, step).run();
      ok = (r.meta?.changes ?? 1) > 0;
    } else if (/^[a-z0-9]{4}-?[a-z0-9]{4}-?[a-z0-9]{2}$/i.test(raw)) {
      const h = await sha256hex('rc:' + raw.toLowerCase().replace(/-/g, ''));
      const list = JSON.parse(m.recovery || '[]');
      if (list.includes(h)) {
        await env.DB.prepare('UPDATE mfa SET recovery = ? WHERE uid = ?').bind(JSON.stringify(list.filter(x => x !== h)), s.uid).run();
        ok = true; usedRecovery = list.length - 1;
      }
    }
  } else {
    const secret = await unseal(env.SESSION_SECRET, s.pend);
    const step = secret ? await verifyTotp(secret, raw, 0) : 0;
    if (step) {
      recovery = Array.from({ length: 8 }, () => { const c = base32(randomBytes(7)).toLowerCase().slice(0, 10); return c.slice(0, 4) + '-' + c.slice(4, 8) + '-' + c.slice(8); });
      const hashes = await Promise.all(recovery.map(c => sha256hex('rc:' + c.replace(/-/g, ''))));
      await env.DB.prepare('INSERT INTO mfa (uid, secret, last_step, recovery, created) VALUES (?,?,?,?,?)')
        .bind(s.uid, await seal(env.SESSION_SECRET, secret), step, JSON.stringify(hashes), now()).run();
      await audit(env, req, 'mfa_enrolled', { login: s.login, detail: 'authenticator app added, 8 recovery codes issued' });
      ok = true;
    }
  }
  if (!ok) {
    await hit(env, uk, 1e9, 900); await hit(env, ik, 1e9, 900);
    await audit(env, req, 'mfa_failed', { login: s.login, ok: false });
    return mfaPage(req, env, 'That code is not right or has already been used. Wait for the next code and try again.');
  }
  // success: replace the half-signed-in session by a new full one (new id: no session fixation)
  const tok = { access_token: await unseal(env.SESSION_SECRET, s.tok), expires_in: s.tok_exp ? s.tok_exp - now() : 0, refresh_token: await unseal(env.SESSION_SECRET, s.rtok) };
  await env.DB.prepare('DELETE FROM sessions WHERE id = ?').bind(s._key).run();
  await env.DB.prepare('DELETE FROM ratelimit WHERE k = ?').bind(uk).run();
  const id = await newSession(env, req, { id: s.uid, login: s.login, name: s.name, avatar_url: s.avatar }, 'ok', tok);
  await audit(env, req, 'login_ok', { login: s.login, detail: usedRecovery !== false ? `recovery code used (${usedRecovery} left)` : 'GitHub + authenticator code' });
  const set = cookie(SESSION_COOKIE, id, { maxAge: limits(env).max });
  if (recovery) {
    return page({ title: 'Save your recovery codes', step: 3, body: `<h1>Save your recovery codes</h1>
      <p class="lead">If you ever lose your phone, each of these codes opens the dashboard <b>once</b>. Write them down or save them somewhere safe and private. They are shown only now.</p>
      <ul class="codes">${recovery.map(c => `<li>${c}</li>`).join('')}</ul>
      <p><a class="btn primary" href="/">I saved them, open the dashboard</a></p>` }, 200, [set]);
  }
  return redirect('/', 303, [set]);
}

export async function logout(req, env) {
  if (!sameOrigin(req)) return new Response('Forbidden', { status: 403 });
  const raw = parseCookies(req)[SESSION_COOKIE];
  if (raw) {
    const id = await sha256hex(raw);
    const s = await env.DB.prepare('SELECT login, tok FROM sessions WHERE id = ?').bind(id).first();
    await env.DB.prepare('DELETE FROM sessions WHERE id = ?').bind(id).run();
    if (s) {
      await revokeGithubToken(env, await unseal(env.SESSION_SECRET, s.tok));
      await audit(env, req, 'logout', { login: s.login });
    }
  }
  const wantsJson = (req.headers.get('accept') || '').includes('application/json');
  return wantsJson ? json({ ok: true }, 200, { 'set-cookie': clearSession }) : redirect('/login?bye=1', 303, [clearSession]);
}
export const clearSessionCookie = clearSession;

// ---- one-time setup: create the private GitHub App with one click (GitHub "app manifest" flow) ---------------------
export async function setupPage(req, env) {
  if (await githubApp(env)) return redirect('/login');
  const origin = new URL(req.url).origin;
  const [owner] = env.REPO.split('/');
  const state = randomToken(18);
  const manifest = {
    name: 'Wartabiye Admin ' + randomToken(3).replace(/[^A-Za-z0-9]/g, 'x'),
    url: origin, description: 'Owner-only sign-in for the Wartabiye TV admin dashboard.',
    redirect_url: origin + '/setup/callback', callback_urls: [origin + '/auth/callback'],
    setup_url: origin + '/login?installed=1', setup_on_update: false,
    public: false, request_oauth_on_install: false,
    hook_attributes: { url: origin + '/setup/no-webhook', active: false },
    default_permissions: { contents: 'write', metadata: 'read', actions: 'read' },
    default_events: [],
  };
  const action = `${ghWeb(env)}/settings/apps/new?state=${state}`;
  return page({ title: 'Set up secure sign-in', wide: true, body: `<h1>Connect the dashboard to GitHub</h1>
    <p class="lead">One click creates a <b>private GitHub App</b> that belongs to <b>@${esc(owner)}</b>. It lets you sign in with GitHub and lets the dashboard save articles to <code>${esc(env.REPO)}</code>. No password or token is copied anywhere.</p>
    <ol class="steps"><li>Make sure you are signed in to GitHub as <b>@${esc(owner)}</b>.</li>
      <li>Press the button. On GitHub, press <b>Create GitHub App</b>.</li>
      <li>GitHub then asks where to install it: choose <b>Only select repositories</b> → <code>${esc(env.REPO)}</code> (and <code>wartabiye-codsiyada</code> if you use it) → <b>Install</b>.</li></ol>
    <form method="post" action="${esc(action)}" class="form"><input type="hidden" name="manifest" value="${esc(JSON.stringify(manifest))}">
      <button class="btn primary" type="submit"><span>Create the GitHub App</span></button></form>
    <p class="hint">Only an app created by the account that owns ${esc(env.REPO)} is accepted.</p>` },
  200, [cookie(SETUP_COOKIE, state + '.' + await hmac(env.SESSION_SECRET, 'setup:' + state), { maxAge: 1800, sameSite: 'Lax' })],
  { form: ghWeb(env) });
}

export async function setupCallback(req, env) {
  if (await githubApp(env)) return redirect('/login');
  const url = new URL(req.url);
  const code = url.searchParams.get('code'), state = url.searchParams.get('state');
  const [st, sig] = String(parseCookies(req)[SETUP_COOKIE] || '').split('.');
  if (!code || !st || !safeEqual(st, state || '') || !safeEqual(sig || '', await hmac(env.SESSION_SECRET, 'setup:' + st)))
    return page({ title: 'Setup expired', body: '<h1>Setup link expired</h1><p class="lead">Please start again.</p><p><a class="btn primary" href="/setup">Start again</a></p>' }, 400);
  const r = await fetch(`${ghApi(env)}/app-manifests/${encodeURIComponent(code)}/conversions`, { method: 'POST', headers: ghHeaders() });
  const app = await r.json().catch(() => ({}));
  if (!r.ok || !app.client_id) {
    await audit(env, req, 'setup_failed', { ok: false, detail: 'GitHub app conversion ' + r.status });
    return page({ title: 'Setup failed', body: '<h1>GitHub did not finish the setup</h1><p class="lead">Please start again.</p><p><a class="btn primary" href="/setup">Start again</a></p>' }, 502);
  }
  // only accept an app owned by the same GitHub account as the website repository
  const repo = await (await fetch(`${ghApi(env)}/repos/${env.REPO}`, { headers: ghHeaders() })).json().catch(() => ({}));
  if (!repo.owner?.id || repo.owner.id !== app.owner?.id) {
    await audit(env, req, 'setup_refused', { login: app.owner?.login, ok: false, detail: 'app owner is not the repository owner' });
    return page({ title: 'Wrong account', body: `<h1>Wrong GitHub account</h1><p class="lead">The app was created by <b>@${esc(app.owner?.login)}</b>, but only the owner of ${esc(env.REPO)} can set up this dashboard. Delete that app on GitHub (Settings → Developer settings → GitHub Apps), sign in as the owner and start again.</p>` }, 403);
  }
  const cfg = { client_id: app.client_id, client_secret: app.client_secret, slug: app.slug, id: app.id, html_url: app.html_url };
  await env.DB.prepare("INSERT OR REPLACE INTO config (k, v, updated) VALUES ('github_app', ?, ?)").bind(await seal(env.SESSION_SECRET, JSON.stringify(cfg)), now()).run();
  await audit(env, req, 'setup_github_app', { login: app.owner.login, detail: 'app ' + app.slug + ' created' });
  return redirect(`${ghWeb(env)}/apps/${app.slug}/installations/new`, 302, [cookie(SETUP_COOKIE, '', { maxAge: 0, sameSite: 'Lax' })]);
}
