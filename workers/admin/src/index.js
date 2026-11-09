// Wartabiye TV secure admin (Cloudflare Worker, free plan).
// Every request comes here first: only the sign-in pages, the brand files and the public visit counter are open;
// the dashboard, the publishing tool and every API need a valid owner session.
import { json, redirect, securityHeaders, now } from './util.js';
import {
  authStart, authCallback, mfaPage, mfaSubmit, logout, setupPage, setupCallback, getSession, githubApp, audit,
  sameOrigin, limits, clearSessionCookie,
} from './auth.js';
import { loginPage, csp, page } from './pages.js';
import { collect, summary, realtime, rollup } from './analytics.js';
import { proxy, automation } from './github.js';

const PUBLIC_FILES = /^\/(assets\/(login\.css|theme\.js)|brand\/[\w.-]+|favicon\.ico|robots\.txt)$/;

async function asset(req, env, path, headers = {}) {
  const u = new URL(req.url); u.pathname = path; u.search = '';
  const r = await env.ASSETS.fetch(new Request(u, { headers: req.headers }));
  const h = new Headers(r.headers);
  for (const [k, v] of Object.entries(headers)) h.set(k, v);
  securityHeaders(h, { csp: headers['content-security-policy'] });
  return new Response(r.body, { status: r.status, headers: h });
}

export default {
  async fetch(req, env, ctx) {
    const url = new URL(req.url);
    const p = url.pathname;
    try {
      if (p === '/c') return await collect(req, env);
      if (!env.SESSION_SECRET) return new Response('Admin is not configured yet (SESSION_SECRET missing).', { status: 503 });
      if (p === '/health') {
        const db = await env.DB.prepare('SELECT 1 ok').first().then(() => true, () => false);
        return json({ ok: db, db, signIn: db ? !!(await githubApp(env)) : false, time: now() });
      }
      if (PUBLIC_FILES.test(p)) return await asset(req, env, p, { 'cache-control': 'public, max-age=3600' });
      if (p === '/robots.txt') return new Response('User-agent: *\nDisallow: /\n');
      if (p === '/login') {
        const s = await getSession(env, req, { touch: false });
        if (s && !s.expired) return redirect('/');
        return loginPage(url, !!(await githubApp(env)));
      }
      if (p === '/auth/github' && req.method === 'GET') return await authStart(req, env);
      if (p === '/auth/callback' && req.method === 'GET') return await authCallback(req, env);
      if (p === '/mfa') return req.method === 'POST' ? await mfaSubmit(req, env) : await mfaPage(req, env);
      if (p === '/auth/logout' && req.method === 'POST') return await logout(req, env);
      if (p === '/setup' && req.method === 'GET') return await setupPage(req, env);
      if (p === '/setup/callback' && req.method === 'GET') return await setupCallback(req, env);
      if (p === '/setup/no-webhook') return new Response(null, { status: 204 });

      // ---- everything below needs the owner's full session --------------------------------------------------
      const s = await getSession(env, req);
      if (!s || s.expired) {
        if (p.startsWith('/api/')) return json({ error: 'signed_out', reason: s?.expired ? 'expired' : 'none' }, 401, s?.expired ? { 'set-cookie': clearSessionCookie } : {});
        return redirect(s?.expired ? '/login?e=expired' : '/login', 302, s?.expired ? [clearSessionCookie] : []);
      }
      if (p.startsWith('/api/github/') || p === '/api/github') return await proxy(req, env, s);
      if (p.startsWith('/api/')) {
        if (req.method !== 'GET' && !sameOrigin(req)) return json({ error: 'forbidden' }, 403);
        const { idle } = limits(env);
        if (p === '/api/me') return json({ login: s.login, name: s.name, avatar: s.avatar, signedInAt: s.created, expiresAt: Math.min(s.expires, s.seen + idle), maxAt: s.expires, idleMinutes: idle / 60, site: env.SITE_URL, repo: env.REPO });
        if (p === '/api/analytics/summary') return await summary(req, env);
        if (p === '/api/analytics/realtime') return await realtime(req, env);
        if (p === '/api/automation') return await automation(req, env, s);
        if (p === '/api/ping' && req.method === 'POST') return json({ ok: true, expiresAt: Math.min(s.expires, now() + idle) });
        if (p === '/api/security') {
          const [log, sessions] = await Promise.all([
            env.DB.prepare('SELECT ts, event, login, ok, ip, country, ua, detail FROM audit ORDER BY ts DESC LIMIT 150').all(),
            env.DB.prepare("SELECT id, created, seen, expires, ua, country FROM sessions WHERE stage = 'ok' AND expires > ? ORDER BY seen DESC").bind(now()).all(),
          ]);
          return json({ log: log.results, sessions: sessions.results.map(x => ({ ...x, id: undefined, current: x.id === s._key })) });
        }
        if (p === '/api/security/signout-others' && req.method === 'POST') {
          const r = await env.DB.prepare('DELETE FROM sessions WHERE id <> ?').bind(s._key).run();
          await audit(env, req, 'signout_others', { login: s.login, detail: `${r.meta?.changes ?? 0} other session(s) ended` });
          return json({ ok: true });
        }
        return json({ error: 'not_found' }, 404);
      }
      // dashboard files
      const site = new URL(env.SITE_URL || 'https://www.wartabiyetv.com/').origin;
      if (/^\/cms\/(codsiyada\/)?config\.yml$/.test(p)) {
        const r = await env.ASSETS.fetch(new Request(new URL(p, url.origin)));
        if (!r.ok) return new Response('missing', { status: 404 });
        const body = (await r.text()).replaceAll('__ORIGIN__', url.origin);
        return new Response(body, { headers: securityHeaders(new Headers({ 'content-type': 'text/yaml; charset=utf-8', 'cache-control': 'no-store' })) });
      }
      if (p.startsWith('/cms/')) {
        // the publishing tool (Sveltia CMS); it may only talk to this Worker
        return await asset(req, env, p, { 'content-security-policy': csp({ img: site + ' https:', connect: 'data: blob:', font: 'https://cdn.jsdelivr.net', style: 'https://cdn.jsdelivr.net', frame: "'self'", script: "'self' 'unsafe-eval' blob:" }) + "; worker-src 'self' blob:" });
      }
      return await asset(req, env, p, { 'content-security-policy': csp({ img: site, connect: site }), 'cache-control': 'no-store' });
    } catch (e) {
      console.error(e);
      if (p.startsWith('/api/') || p === '/c') return json({ error: 'server_error' }, 500);
      return page({ title: 'Error', body: '<h1>Something went wrong</h1><p class="lead">Please try again in a moment.</p><p><a class="btn primary" href="/">Try again</a></p>' }, 500);
    }
  },
  async scheduled(event, env, ctx) {
    ctx.waitUntil(rollup(env));
  },
};
