/* Wartabiye TV advert counter (Cloudflare Worker + D1).
   POST /v1/hit    {id, ev: "view"|"click", pos}  from the site (navigator.sendBeacon, text/plain, no cookies)
   GET  /v1/stats?from=YYYY-MM-DD&to=YYYY-MM-DD    needs "Authorization: Bearer <STATS_TOKEN>" (the /admin/xayeysiis/ page)
   GET  /v1/health
   Privacy: nothing about the visitor is read or stored (no IP, no cookie, no user agent, no id). Only a daily total per
   advert and placement is kept. Requests from other sites, from bots and for adverts that are not live are ignored. */
const POS = new Set(['home', 'sidebar', 'card', 'article', 'mobile', 'spotlight', 'video']);
const BOT = /bot|crawl|spider|slurp|headless|preview|lighthouse|facebookexternalhit|curl|wget|python|httpclient/i;
let liveCache = { at: 0, ids: null };

function allowed(env, origin) {
  return String(env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean).includes(origin || '');
}
function cors(env, req, extra = {}) {
  const o = req.headers.get('Origin');
  const h = { 'Cache-Control': 'no-store', ...extra };
  if (allowed(env, o)) { h['Access-Control-Allow-Origin'] = o; h['Vary'] = 'Origin'; h['Access-Control-Allow-Headers'] = 'Authorization, Content-Type'; h['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS'; }
  return h;
}
const json = (env, req, body, status = 200) => new Response(JSON.stringify(body), { status, headers: cors(env, req, { 'Content-Type': 'application/json; charset=utf-8' }) });
const day = d => d.toISOString().slice(0, 10);

async function liveIds(env, now) {
  if (liveCache.ids && now - liveCache.at < 300000) return liveCache.ids;
  try {
    const r = await fetch(env.ADS_URL, { cf: { cacheTtl: 300 } });
    if (r.ok) { const d = await r.json(); liveCache = { at: now, ids: new Set((d.ads || []).map(a => a && a.id).filter(Boolean)) }; }
  } catch (e) { /* keep the previous list */ }
  return liveCache.ids || new Set();
}

function sameToken(a, b) { // constant-time comparison
  if (!a || !b || a.length !== b.length) return false;
  let x = 0; for (let i = 0; i < a.length; i++) x |= a.charCodeAt(i) ^ b.charCodeAt(i); return x === 0;
}

export async function handle(req, env, now = Date.now()) {
  const url = new URL(req.url);
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(env, req) });
  if (url.pathname === '/v1/health') return json(env, req, { ok: true, configured: !!(env.DB && env.STATS_TOKEN) });

  if (url.pathname === '/v1/hit' && req.method === 'POST') {
    const ignore = new Response(null, { status: 204, headers: cors(env, req) });
    if (!allowed(env, req.headers.get('Origin')) || BOT.test(req.headers.get('User-Agent') || '')) return ignore;
    if (req.headers.get('DNT') === '1' || req.headers.get('Sec-GPC') === '1') return ignore;
    let b; try { const t = await req.text(); if (t.length > 300) return ignore; b = JSON.parse(t); } catch (e) { return ignore; }
    const id = String(b && b.id || ''), ev = b && b.ev, pos = b && b.pos;
    if (!/^[a-z0-9][a-z0-9-]{0,99}$/.test(id) || (ev !== 'view' && ev !== 'click') || !POS.has(pos)) return ignore;
    if (!(await liveIds(env, now)).has(id)) return ignore;
    const col = ev === 'view' ? 'views' : 'clicks';
    await env.DB.prepare(`INSERT INTO ad_stats (day, ad, pos, ${col}) VALUES (?1, ?2, ?3, 1)
      ON CONFLICT(day, ad, pos) DO UPDATE SET ${col} = ${col} + 1`).bind(day(new Date(now)), id, pos).run();
    return ignore;
  }

  if (url.pathname === '/v1/stats' && req.method === 'GET') {
    const auth = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
    if (!sameToken(auth, env.STATS_TOKEN || '')) return json(env, req, { error: 'unauthorised' }, 401);
    const re = /^\d{4}-\d{2}-\d{2}$/;
    const to = re.test(url.searchParams.get('to') || '') ? url.searchParams.get('to') : day(new Date(now));
    const from = re.test(url.searchParams.get('from') || '') ? url.searchParams.get('from') : day(new Date(now - 29 * 864e5));
    const r = await env.DB.prepare('SELECT day, ad, pos, views, clicks FROM ad_stats WHERE day BETWEEN ?1 AND ?2 ORDER BY day, ad, pos').bind(from, to).all();
    return json(env, req, { from, to, rows: r.results || [] });
  }
  return json(env, req, { error: 'not found' }, 404);
}

export default { fetch: (req, env) => handle(req, env) };
