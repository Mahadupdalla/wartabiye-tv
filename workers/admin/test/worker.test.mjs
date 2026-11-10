// Tests for the secure admin Worker. No network: GitHub is a fake server, D1 is real SQLite with the real migrations.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { D1 } from './d1.mjs';
import worker from '../src/index.js';
import { totpAt, verifyTotp, seal, unseal, base32, unbase32, sha256hex } from '../src/util.js';
import { device, sourceOf, dayOf } from '../src/analytics.js';
import { allowed } from '../src/github.js';

const ORIGIN = 'https://admin.test';
const PUB = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');
const OWNER = { id: 216855903, login: 'Mahadupdalla', name: 'Mahad', avatar_url: 'https://avatars.githubusercontent.com/u/1' };
const STRANGER = { id: 999, login: 'someone-else' };

function makeEnv(extra = {}) {
  return {
    DB: new D1(), SESSION_SECRET: 'x'.repeat(48), REPO: 'Mahadupdalla/wartabiye-tv', EXTRA_REPOS: '', SITE_URL: 'https://www.wartabiyetv.com/',
    SITE_ORIGINS: 'https://www.wartabiyetv.com,https://wartabiyetv.com', OWNER_GITHUB_IDS: '', GITHUB_WEB: 'https://gh.test', GITHUB_API: 'https://api.gh.test',
    GITHUB_CLIENT_ID: 'Iv1.test', GITHUB_CLIENT_SECRET: 'secret-test',
    ASSETS: { fetch: async req => { const p = new URL(req.url).pathname; const f = join(PUB, p.endsWith('/') ? p + 'index.html' : p); return existsSync(f) ? new Response(readFileSync(f), { headers: { 'content-type': f.endsWith('.html') ? 'text/html' : 'text/plain' } }) : new Response('nf', { status: 404 }); } },
    ...extra,
  };
}

// ---- fake GitHub ----------------------------------------------------------------------------------------------------
const gh = { tokens: new Map(), calls: [], revoked: [] };
globalThis.fetch = async (input, init = {}) => {
  const url = new URL(typeof input === 'string' ? input : input.url);
  const auth = (init.headers && (init.headers.Authorization || init.headers.authorization)) || '';
  gh.calls.push({ url: url.toString(), method: init.method || 'GET', auth });
  const J = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'content-type': 'application/json' } });
  if (url.host === 'gh.test' && url.pathname === '/login/oauth/access_token') {
    const b = JSON.parse(init.body);
    if (b.code === 'owner-code') { gh.tokens.set('ghu_owner', OWNER); return J({ access_token: 'ghu_owner', expires_in: 28800, refresh_token: 'ghr_owner' }); }
    if (b.code === 'stranger-code') { gh.tokens.set('ghu_stranger', STRANGER); return J({ access_token: 'ghu_stranger', expires_in: 28800 }); }
    return J({ error: 'bad_verification_code' });
  }
  if (url.host === 'api.gh.test') {
    const tok = auth.replace(/^Bearer /, '');
    const user = gh.tokens.get(tok);
    if (url.pathname.startsWith('/applications/')) { gh.revoked.push(JSON.parse(init.body).access_token); return new Response(null, { status: 204 }); }
    if (!user) return J({ message: 'Bad credentials' }, 401);
    if (url.pathname === '/user') return J(user);
    if (url.pathname === '/repos/Mahadupdalla/wartabiye-tv') return J({ full_name: 'Mahadupdalla/wartabiye-tv', owner: { id: OWNER.id }, permissions: { admin: user.id === OWNER.id, push: user.id === OWNER.id, pull: true } });
    if (url.pathname === '/graphql') return J({ data: { ok: true, by: user.login } });
    if (url.pathname.startsWith('/repos/Mahadupdalla/wartabiye-tv/contents/')) return J({ path: url.pathname, by: user.login });
    return J({ message: 'Not Found' }, 404);
  }
  throw new Error('unexpected network call ' + url);
};

// ---- a tiny browser: keeps cookies and sends same-origin headers -----------------------------------------------------
function browser(env) {
  const jar = new Map();
  async function go(path, init = {}) {
    const headers = new Headers(init.headers || {});
    headers.set('user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/140.0 Safari/537.36');
    headers.set('cf-connecting-ip', '41.78.1.2');
    if (!headers.has('sec-fetch-site')) headers.set('sec-fetch-site', 'same-origin');
    if (init.method === 'POST' && !headers.has('origin')) headers.set('origin', ORIGIN);
    if (jar.size) headers.set('cookie', [...jar].map(([k, v]) => `${k}=${v}`).join('; '));
    const req = new Request(ORIGIN + path, { ...init, headers, redirect: 'manual' });
    const res = await worker.fetch(req, env, { waitUntil() {} });
    for (const c of res.headers.getSetCookie?.() || []) {
      const [kv] = c.split(';'); const i = kv.indexOf('='); const k = kv.slice(0, i), v = decodeURIComponent(kv.slice(i + 1));
      if (/Max-Age=0/.test(c)) jar.delete(k); else jar.set(k, v);
    }
    return res;
  }
  return { go, jar };
}
async function signIn(env, b, code = 'owner-code') {
  const s = await b.go('/auth/github');
  assert.equal(s.status, 302);
  const state = new URL(s.headers.get('location')).searchParams.get('state');
  return b.go(`/auth/callback?code=${code}&state=${state}`);
}
const form = o => ({ method: 'POST', body: new URLSearchParams(o), headers: { 'content-type': 'application/x-www-form-urlencoded' } });

// ---- crypto ---------------------------------------------------------------------------------------------------------
test('authenticator codes follow RFC 6238 (test vector) and cannot be reused', async () => {
  const secret = base32(new TextEncoder().encode('12345678901234567890'));
  assert.equal(await totpAt(secret, Math.floor(59 / 30)), '287082');
  assert.equal(await totpAt(secret, Math.floor(1111111109 / 30)), '081804');
  const step = await verifyTotp(secret, '081804', 0, 1111111109 * 1000);
  assert.ok(step > 0);
  assert.equal(await verifyTotp(secret, '081804', step, 1111111109 * 1000), 0, 'same code twice is refused');
  assert.deepEqual([...unbase32(base32(new Uint8Array([1, 2, 3, 250])))], [1, 2, 3, 250]);
});
test('secrets are encrypted at rest and tamper-proof', async () => {
  const box = await seal('k'.repeat(40), 'ghu_secret');
  assert.ok(!box.includes('ghu_secret'));
  assert.equal(await unseal('k'.repeat(40), box), 'ghu_secret');
  assert.equal(await unseal('z'.repeat(40), box), null);
});

// ---- access control ---------------------------------------------------------------------------------------------------
test('without a session every admin page and API is closed', async () => {
  const env = makeEnv(), b = browser(env);
  for (const p of ['/', '/index.html', '/assets/app.js', '/cms/', '/cms/config.yml', '/#analytics']) {
    const r = await b.go(p); assert.equal(r.status, 302, p); assert.match(r.headers.get('location'), /^\/login/);
  }
  for (const p of ['/api/me', '/api/analytics/summary', '/api/analytics/realtime', '/api/security', '/api/automation', '/api/github/api/v3/user', '/api/github/api/graphql']) {
    const r = await b.go(p); assert.equal(r.status, 401, p);
    assert.doesNotMatch(await r.text(), /visitors|ghu_|login/);
  }
  const login = await b.go('/login'); assert.equal(login.status, 200);
  const html = await login.text(); assert.match(html, /Sign in with GitHub/);
  assert.match(login.headers.get('content-security-policy'), /frame-ancestors 'none'/);
  assert.doesNotMatch(html, /secret-test|Iv1\.test/, 'no client id or secret in the page');
});

test('a GitHub account that is not an admin of the repository is refused and its token revoked', async () => {
  const env = makeEnv(), b = browser(env);
  const r = await signIn(env, b, 'stranger-code');
  assert.equal(r.status, 302); assert.equal(r.headers.get('location'), '/login?e=denied');
  assert.ok(gh.revoked.includes('ghu_stranger'));
  assert.equal((await b.go('/api/me')).status, 401);
  const a = await env.DB.prepare("SELECT * FROM audit WHERE event = 'login_denied'").first();
  assert.equal(a.login, 'someone-else'); assert.equal(a.ok, 0); assert.equal(a.ip, '41.78.x.x');
});

test('OWNER_GITHUB_IDS can lock sign-in to specific accounts', async () => {
  const env = makeEnv({ OWNER_GITHUB_IDS: '12345' }), b = browser(env);
  const r = await signIn(env, b); assert.equal(r.headers.get('location'), '/login?e=denied');
});

test('a forged or replayed sign-in state is refused', async () => {
  const env = makeEnv(), b = browser(env);
  await b.go('/auth/github');
  const r = await b.go('/auth/callback?code=owner-code&state=forged');
  assert.equal(r.headers.get('location'), '/login?e=state');
});

test('owner: GitHub, then authenticator set-up, then dashboard; GitHub token never reaches the browser', async () => {
  const env = makeEnv(), b = browser(env);
  const cb = await signIn(env, b);
  assert.equal(cb.status, 200); assert.match(await cb.text(), /url=\/mfa/);
  assert.equal((await b.go('/api/me')).status, 401, 'GitHub alone is not enough');
  const mfa = await b.go('/mfa'); const page = await mfa.text();
  assert.match(page, /<svg/); const secret = page.match(/class="mono">([A-Z2-7 ]+)</)[1].replace(/ /g, '');
  // wrong code
  let r = await b.go('/mfa', form({ code: '000000' })); assert.match(await r.text(), /not right/);
  // right code
  r = await b.go('/mfa', form({ code: await totpAt(secret, Math.floor(Date.now() / 30000)) }));
  const rec = await r.text(); assert.match(rec, /recovery codes/i);
  const codes = [...rec.matchAll(/<li>([a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{2})<\/li>/g)].map(m => m[1]); assert.equal(codes.length, 8);
  const me = await (await b.go('/api/me')).json(); assert.equal(me.login, 'Mahadupdalla');
  const cookie = [...b.jar.entries()].find(([k]) => k === '__Host-wtv_s')[1];
  const row = await env.DB.prepare('SELECT * FROM sessions').first();
  assert.notEqual(row.id, cookie, 'only a hash of the cookie is stored'); assert.ok(!row.tok.includes('ghu_owner'), 'token encrypted in D1');
  // the dashboard page itself
  const home = await b.go('/'); assert.equal(home.status, 200); assert.match(await home.text(), /Analytics/);
  // CMS calls go through the proxy with the server-side token; the browser's "token" is ignored
  const u = await b.go('/api/github/api/v3/user', { headers: { authorization: 'token server-session' } });
  assert.equal((await u.json()).login, 'Mahadupdalla');
  assert.equal(gh.calls.at(-1).auth, 'Bearer ghu_owner');
  const g = await b.go('/api/github/api/graphql', { method: 'POST', body: '{"query":"mutation { createCommitOnBranch }"}', headers: { 'content-type': 'application/json' } });
  assert.equal((await g.json()).data.by, 'Mahadupdalla');
  assert.ok(await env.DB.prepare("SELECT 1 FROM audit WHERE event = 'content_change'").first(), 'saves are audited');
  // dangerous or foreign GitHub calls are blocked
  for (const [m, p] of [['DELETE', '/repos/Mahadupdalla/wartabiye-tv'], ['GET', '/repos/other/repo/contents/x'], ['PUT', '/repos/Mahadupdalla/wartabiye-tv/actions/secrets/X'], ['POST', '/user/repos']]) {
    const x = await b.go('/api/github/api/v3' + p, { method: m, body: m === 'GET' ? undefined : '{}' }); assert.equal(x.status, 403, m + ' ' + p);
  }
  // a request from another site cannot use the session
  assert.equal((await b.go('/api/github/api/v3/user', { headers: { 'sec-fetch-site': 'cross-site' } })).status, 403);
  // CMS config points the tool at this Worker
  const cfg = await (await b.go('/cms/config.yml')).text();
  if (existsSync(join(PUB, 'cms', 'config.yml'))) assert.match(cfg, /api_root: https:\/\/admin\.test\/api\/github\/api\/v3/);
  // logout ends the session and revokes the GitHub token
  const out = await b.go('/auth/logout', { method: 'POST' });
  assert.equal(out.status, 303); assert.ok(gh.revoked.includes('ghu_owner'));
  assert.equal((await b.go('/api/me')).status, 401);
  // second sign-in asks for a code (no set-up) and accepts a recovery code once
  await signIn(env, b);
  const p2 = await (await b.go('/mfa')).text(); assert.match(p2, /Enter your security code/);
  r = await b.go('/mfa', form({ code: codes[0] })); assert.equal(r.status, 303);
  await b.go('/auth/logout', { method: 'POST' });
  await signIn(env, b);
  r = await b.go('/mfa', form({ code: codes[0] })); assert.match(await r.text(), /not right/, 'recovery code works once');
});

test('5 wrong codes lock the second step for 15 minutes', async () => {
  const env = makeEnv(), b = browser(env);
  await signIn(env, b);
  const secret = (await (await b.go('/mfa')).text()).match(/class="mono">([A-Z2-7 ]+)</)[1].replace(/ /g, '');
  for (let i = 0; i < 5; i++) await b.go('/mfa', form({ code: '11111' + i }));
  const r = await b.go('/mfa', form({ code: await totpAt(secret, Math.floor(Date.now() / 30000)) }));
  assert.match(await r.text(), /wait 15 minutes/);
  assert.equal((await b.go('/api/me')).status, 401);
});

test('a form POST from another site is refused', async () => {
  const env = makeEnv(), b = browser(env);
  await signIn(env, b);
  const r = await b.go('/mfa', { ...form({ code: '123456' }), headers: { 'content-type': 'application/x-www-form-urlencoded', origin: 'https://evil.test', 'sec-fetch-site': 'cross-site' } });
  assert.equal(r.status, 403);
});

test('idle sessions expire', async () => {
  const env = makeEnv({ SESSION_IDLE_MINUTES: '30' }), b = browser(env);
  await signIn(env, b);
  const secret = (await (await b.go('/mfa')).text()).match(/class="mono">([A-Z2-7 ]+)</)[1].replace(/ /g, '');
  await b.go('/mfa', form({ code: await totpAt(secret, Math.floor(Date.now() / 30000)) }));
  assert.equal((await b.go('/api/me')).status, 200);
  env.DB.db.exec('UPDATE sessions SET seen = seen - 3600');
  const r = await b.go('/api/me'); assert.equal(r.status, 401); assert.equal((await r.json()).reason, 'expired');
});

// ---- analytics --------------------------------------------------------------------------------------------------------
const UA_MOBILE = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/140.0 Mobile Safari/537.36';
const UA_DESK = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140.0 Safari/537.36';
function beacon(env, body, { ua = UA_MOBILE, ip = '1.2.3.4', origin = 'https://www.wartabiyetv.com', country = 'SO' } = {}) {
  const req = new Request(ORIGIN + '/c', { method: 'POST', body: JSON.stringify(body), headers: { origin, 'user-agent': ua, 'cf-connecting-ip': ip, 'content-type': 'text/plain' } });
  Object.defineProperty(req, 'cf', { value: { country } });
  return worker.fetch(req, env, {});
}
test('page views are counted from the website only, robots and junk are ignored', async () => {
  const env = makeEnv();
  assert.equal((await beacon(env, { p: '/' }, { origin: 'https://evil.test' })).status, 403);
  assert.equal((await beacon(env, { p: '/' }, { ua: 'Googlebot/2.1 (+http://www.google.com/bot.html)' })).status, 204);
  assert.equal((await beacon(env, { p: '/' }, { ua: 'Mozilla/5.0 HeadlessChrome/140' })).status, 204);
  assert.equal((await beacon(env, { p: '/<script>' })).status, 400);
  assert.equal((await env.DB.prepare('SELECT COUNT(*) n FROM visitors').first()).n, 0);
});
test('visitors, page views, visits, sources, devices, countries and articles add up', async () => {
  const env = makeEnv();
  await beacon(env, { p: '/', e: 1, r: 'https://www.google.com/', l: 'so' });
  await beacon(env, { p: '/war/2026-11-09-test', c: 'Siyaasad', l: 'so' });
  await beacon(env, { p: '/war/2026-11-09-test', c: 'Siyaasad', l: 'so' });
  await beacon(env, { p: '/ciyaaraha', e: 1, r: 'https://l.facebook.com/', l: 'en', n: 1 }, { ua: UA_DESK, ip: '5.6.7.8', country: 'NL' });
  await beacon(env, { p: '/war/2026-11-09-other', c: 'Ciyaaraha', e: 1, r: '', l: 'en' }, { ua: UA_DESK, ip: '9.9.9.9', country: 'KE' });
  await beacon(env, { p: '/', e: 0, r: 'https://www.wartabiyetv.com/' });   // internal navigation: not a new source
  const rows = (await env.DB.prepare('SELECT * FROM visitors').all()).results;
  assert.equal(rows.length, 3);
  assert.ok(rows.every(r => /^[0-9a-f]{32}$/.test(r.vid) && !JSON.stringify(r).includes('1.2.3.4')), 'no IP stored');
  const b = browser(env);
  // sign in to read the numbers
  await signIn(env, b);
  const secret = (await (await b.go('/mfa')).text()).match(/class="mono">([A-Z2-7 ]+)</)[1].replace(/ /g, '');
  await b.go('/mfa', form({ code: await totpAt(secret, Math.floor(Date.now() / 30000)) }));
  const S = await (await b.go('/api/analytics/summary?range=today')).json();
  assert.equal(S.totals.visitors, 3); assert.equal(S.totals.views, 6); assert.equal(S.totals.sessions, 3);
  assert.equal(S.totals.returning, 1); assert.equal(S.totals.consented, 1);
  assert.equal(S.quick.today, 3); assert.equal(S.since, dayOf(Math.floor(Date.now() / 1000), env));
  assert.deepEqual(S.articles.map(a => [a.id, a.views]), [['2026-11-09-test', 2], ['2026-11-09-other', 1]]);
  assert.deepEqual(S.categories, [{ name: 'Siyaasad', views: 2 }, { name: 'Ciyaaraha', views: 1 }]);
  const src = Object.fromEntries(S.sources.map(x => [x.kind, x.visits])); assert.deepEqual(src, { search: 1, social: 1, direct: 1 });
  assert.deepEqual(Object.fromEntries(S.devices.map(d => [d.key, d.visitors])), { mobile: 1, desktop: 2 });
  assert.equal(S.countries.length, 3);
  assert.equal(S.hours.reduce((a, x) => a + x.views, 0), 6);
  const R = await (await b.go('/api/analytics/realtime')).json(); assert.equal(R.active5, 3);
});
test('deploy self-test visits are kept apart and need a valid, unexpired token', async () => {
  const env = makeEnv();
  const tok = 'a'.repeat(32), h = await sha256hex(tok), t = Math.floor(Date.now() / 1000);
  assert.equal((await beacon(env, { p: '/', t: tok })).status, 403, 'no token stored yet');
  env.DB.db.exec(`INSERT INTO config VALUES ('selftest', '{"h":"${h}","exp":${t + 600}}', ${t})`);
  assert.equal((await beacon(env, { p: '/', t: 'b'.repeat(32) })).status, 403, 'wrong token');
  assert.equal((await beacon(env, { p: '/war/x', c: 'Siyaasad', t: tok }, { ua: 'Mozilla/5.0 HeadlessChrome/140' })).status, 204);
  const rows = (await env.DB.prepare('SELECT day FROM pages').all()).results;
  assert.deepEqual(rows.map(r => r.day), ['0000-00-00']);
  const b = browser(env); await signIn(env, b);
  const secret = (await (await b.go('/mfa')).text()).match(/class="mono">([A-Z2-7 ]+)</)[1].replace(/ /g, '');
  await b.go('/mfa', form({ code: await totpAt(secret, Math.floor(Date.now() / 30000)) }));
  const S = await (await b.go('/api/analytics/summary?range=30d')).json();
  assert.equal(S.totals.views, 0); assert.equal(S.articles.length, 0); assert.notEqual(S.since, '0000-00-00');
  env.DB.db.exec(`UPDATE config SET v = '{"h":"${h}","exp":${t - 1}}' WHERE k = 'selftest'`);
  assert.equal((await beacon(env, { p: '/', t: tok })).status, 403, 'expired token');
});
test('finished days are summarised and old raw rows removed', async () => {
  const env = makeEnv();
  const old = Math.floor(Date.now() / 1000) - 3 * 86400, day = dayOf(old, env);
  env.DB.db.exec(`INSERT INTO visitors VALUES ('${day}','a',${old},${old},3,2,'mobile','SO','so',NULL),('${day}','b',${old},${old},1,1,'desktop','KE','en',1)`);
  const { rollup } = await import('../src/analytics.js');
  assert.equal(await rollup(env), 1);
  const t = await env.DB.prepare("SELECT * FROM day_stats WHERE dim='total'").first();
  assert.deepEqual([t.visitors, t.views, t.sessions, t.ret, t.consented], [2, 4, 3, 1, 1]);
  assert.equal(await rollup(env), 0, 'only once');
});
test('helpers: device and source classification, GitHub allow-list', () => {
  assert.equal(device('Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)'), 'tablet');
  assert.equal(device(UA_MOBILE), 'mobile'); assert.equal(device(UA_DESK), 'desktop');
  const site = ['www.wartabiyetv.com'];
  assert.equal(sourceOf('https://www.wartabiyetv.com/war/x', '', site), null);
  assert.equal(sourceOf('https://t.co/abc', '', site).kind, 'social');
  assert.equal(sourceOf('https://duckduckgo.com/', '', site).kind, 'search');
  assert.equal(sourceOf('https://hiiraan.com/news', '', site).kind, 'website');
  assert.equal(sourceOf('', 'facebook', site).kind, 'social');
  const env = { REPO: 'Mahadupdalla/wartabiye-tv', EXTRA_REPOS: 'Mahadupdalla/wartabiye-codsiyada' };
  assert.ok(allowed(env, 'PUT', '/repos/Mahadupdalla/wartabiye-tv/contents/data/news/x.json'));
  assert.ok(allowed(env, 'GET', '/repos/Mahadupdalla/wartabiye-codsiyada/contents/requests'));
  assert.ok(!allowed(env, 'DELETE', '/repos/Mahadupdalla/wartabiye-tv'));
  assert.ok(!allowed(env, 'POST', '/repos/Mahadupdalla/wartabiye-tv/hooks'));
  assert.ok(allowed(env, 'POST', '/repos/Mahadupdalla/wartabiye-tv/actions/workflows/publish.yml/dispatches'));
  assert.ok(allowed(env, 'PUT', '/repos/Mahadupdalla/wartabiye-tv/actions/workflows/123/disable'));
  assert.ok(!allowed(env, 'DELETE', '/repos/Mahadupdalla/wartabiye-tv/actions/runs/5'));
  assert.ok(!allowed(env, 'PUT', '/repos/Mahadupdalla/wartabiye-tv/actions/permissions'));
  assert.ok(!allowed(env, 'POST', '/repos/Mahadupdalla/wartabiye-tv/actions/workflows/../../secrets/dispatches'));
});
test('mobile app page views: counted only with the app User-Agent and no web Origin, source "app"', async () => {
  const env = makeEnv();
  const app = (body, ua, origin) => { const req = new Request(ORIGIN + '/c', { method: 'POST', body: JSON.stringify(body), headers: { 'user-agent': ua, 'cf-connecting-ip': '7.7.7.7', ...(origin ? { origin } : {}) } }); Object.defineProperty(req, 'cf', { value: { country: 'SO' } }); return worker.fetch(req, env, {}); };
  assert.equal((await app({ p: '/' }, 'okhttp/4.12.0')).status, 403, 'other native clients are refused');
  assert.equal((await app({ p: '/' }, 'WartabiyeTV-App/1.0.0 (android; Mobile)', 'https://evil.test')).status, 403, 'a web page cannot pose as the app');
  assert.equal((await app({ p: '/', e: 1, l: 'so' }, 'WartabiyeTV-App/1.0.0 (android; Mobile)')).status, 204);
  assert.equal((await app({ p: '/war/2026-11-10-x', c: 'Ciyaaraha', l: 'so' }, 'WartabiyeTV-App/1.0.0 (android; Mobile)')).status, 204);
  assert.equal((await beacon(env, { p: '/', e: 1, u: 'app-pwa' }, { ip: '8.8.8.8' })).status, 204);
  const src = (await env.DB.prepare('SELECT kind, host, visits FROM sources ORDER BY host').all()).results;
  assert.deepEqual(src.map(r => [r.kind, r.host, r.visits]), [['app', 'android', 1], ['app', 'pwa', 1]]);
  const v = (await env.DB.prepare("SELECT device, hits FROM visitors WHERE device = 'mobile' ORDER BY hits DESC").all()).results;
  assert.equal(v[0].hits, 2);
});
