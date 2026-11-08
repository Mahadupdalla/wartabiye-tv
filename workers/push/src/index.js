/* Wartabiye TV push notifications (Cloudflare Worker + Workers KV, free plan is enough for a news site).
 *
 * Why it exists: GitHub Pages cannot keep a secret. Browser push (Web Push, RFC 8030/8291/8292) needs a private VAPID
 * key to sign every message and a place to keep the visitors' subscriptions. Both live here, never in the public repo:
 *   VAPID_PRIVATE_JWK  (secret)  the private signing key, made by `node workers/push/make-keys.mjs`
 *   PUSH_ADMIN_TOKEN   (secret)  a long random password; only GitHub Actions (repository secret of the same name) and
 *                                the owner know it. It is needed to send and to read the delivery statistics.
 *   VAPID_PUBLIC_KEY   (var)     the public half; it is safe to publish (the browser needs it to subscribe)
 *   VAPID_SUBJECT      (var)     mailto: or https: contact for the push services
 *   SUBS               (KV)      one record per subscribed browser; nothing else about the visitor is stored
 *
 * Endpoints
 *   GET  /v1/health                       {"ok":true,"configured":bool}
 *   GET  /v1/key                          {"publicKey": "..."}
 *   POST /v1/subscribe    (browser)       {subscription:{endpoint,keys:{p256dh,auth}}, categories:[...], lang}
 *   POST /v1/unsubscribe  (browser)       {endpoint}
 *   POST /v1/send         (Bearer token)  {id, title, body, url, category, urgent, image?, cursor?, limit?, dryRun?}
 *                                         sends to one page of subscribers (default 40, the free plan allows 50
 *                                         outgoing requests per call); the caller repeats with "next" until it is null.
 *                                         The same id is never sent twice (KV "sent:<id>").
 *   GET  /v1/stats        (Bearer token)  subscriber counts per category and the last 50 deliveries
 *
 * Nothing here invents content: it only delivers what the publish workflow or the owner sends, and every link must be
 * on the Wartabiye TV site (SITE_URL).
 */
const CATEGORIES = ['breaking', 'eastAfrica', 'world', 'sports', 'live'];
const enc = new TextEncoder();

// ---------- base64url ----------
export function b64u(buf) {
  const b = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
export function unb64u(str) {
  const s = String(str).replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(s + '='.repeat((4 - (s.length % 4)) % 4));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
function concat(...parts) {
  const len = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(len);
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}
async function hmac(key, data) {
  const k = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', k, data));
}
async function sha256hex(s) {
  const h = new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(s)));
  return [...h].map(x => x.toString(16).padStart(2, '0')).join('');
}

// ---------- RFC 8291: message encryption (aes128gcm) ----------
export async function encryptPayload(sub, plaintext, opts = {}) {
  const uaPublic = unb64u(sub.keys.p256dh);
  const authSecret = unb64u(sub.keys.auth);
  if (uaPublic.length !== 65 || authSecret.length !== 16) throw new Error('bad subscription keys');
  const as = opts.serverKeys || await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const asPublic = new Uint8Array(await crypto.subtle.exportKey('raw', as.publicKey));
  const uaKey = await crypto.subtle.importKey('raw', uaPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const ecdh = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey }, as.privateKey, 256));
  const prkKey = await hmac(authSecret, ecdh);
  const ikm = await hmac(prkKey, concat(enc.encode('WebPush: info\0'), uaPublic, asPublic, new Uint8Array([1])));
  const salt = opts.salt || crypto.getRandomValues(new Uint8Array(16));
  const prk = await hmac(salt, ikm);
  const cek = (await hmac(prk, concat(enc.encode('Content-Encoding: aes128gcm\0'), new Uint8Array([1])))).slice(0, 16);
  const nonce = (await hmac(prk, concat(enc.encode('Content-Encoding: nonce\0'), new Uint8Array([1])))).slice(0, 12);
  const key = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  const data = concat(enc.encode(plaintext), new Uint8Array([2])); // 0x02 = last (only) record
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, key, data));
  const rs = new Uint8Array([0, 0, 16, 0]); // record size 4096
  return concat(salt, rs, new Uint8Array([asPublic.length]), asPublic, ct);
}

// ---------- RFC 8292: VAPID ----------
export async function vapidHeader(endpoint, env, nowSec = Math.floor(Date.now() / 1000)) {
  const aud = new URL(endpoint).origin;
  const header = b64u(enc.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const claims = b64u(enc.encode(JSON.stringify({ aud, exp: nowSec + 12 * 3600, sub: env.VAPID_SUBJECT || 'mailto:admin@wartabiyetv.com' })));
  const jwk = typeof env.VAPID_PRIVATE_JWK === 'string' ? JSON.parse(env.VAPID_PRIVATE_JWK) : env.VAPID_PRIVATE_JWK;
  const key = await crypto.subtle.importKey('jwk', { kty: 'EC', crv: 'P-256', x: jwk.x, y: jwk.y, d: jwk.d }, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const sig = new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, enc.encode(header + '.' + claims)));
  return `vapid t=${header}.${claims}.${b64u(sig)}, k=${env.VAPID_PUBLIC_KEY}`;
}

export async function sendOne(sub, message, env, urgent) {
  const body = await encryptPayload(sub, JSON.stringify(message));
  const r = await fetch(sub.endpoint, {
    method: 'POST',
    headers: {
      Authorization: await vapidHeader(sub.endpoint, env),
      'Content-Encoding': 'aes128gcm',
      'Content-Type': 'application/octet-stream',
      TTL: String(urgent ? 6 * 3600 : 24 * 3600),
      Urgency: urgent ? 'high' : 'normal',
      Topic: String(message.tag || 'wartabiye').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 32) || 'wartabiye',
    },
    body,
  });
  return r.status;
}

// ---------- helpers ----------
function cors(req, env) {
  const allowed = String(env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
  const o = req.headers.get('Origin');
  const h = { 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization', 'Access-Control-Max-Age': '86400', Vary: 'Origin' };
  if (o && allowed.includes(o)) h['Access-Control-Allow-Origin'] = o;
  return h;
}
function json(obj, status, extra) {
  return new Response(JSON.stringify(obj), { status: status || 200, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...(extra || {}) } });
}
function authorised(req, env) {
  const t = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  if (!env.PUSH_ADMIN_TOKEN || env.PUSH_ADMIN_TOKEN.length < 24 || t.length !== env.PUSH_ADMIN_TOKEN.length) return false;
  let d = 0;
  for (let i = 0; i < t.length; i++) d |= t.charCodeAt(i) ^ env.PUSH_ADMIN_TOKEN.charCodeAt(i);
  return d === 0;
}
function validEndpoint(u) {
  try { const x = new URL(u); return x.protocol === 'https:' && u.length < 1024; } catch (e) { return false; }
}
export function siteLink(u, env) {
  const site = env.SITE_URL || 'https://www.wartabiyetv.com/';
  try { const x = new URL(u, site); return x.origin === new URL(site).origin ? x.href : null; } catch (e) { return null; }
}
async function readBody(req) {
  const t = await req.text();
  if (t.length > 8192) throw new Error('body too large');
  return JSON.parse(t || '{}');
}
const configured = env => !!(env.SUBS && env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_JWK);

// ---------- endpoints ----------
async function subscribe(req, env) {
  const b = await readBody(req);
  const s = b.subscription || {};
  if (!validEndpoint(s.endpoint) || !s.keys || typeof s.keys.p256dh !== 'string' || typeof s.keys.auth !== 'string') return { status: 400, body: { ok: false, error: 'bad subscription' } };
  if (unb64u(s.keys.p256dh).length !== 65 || unb64u(s.keys.auth).length !== 16) return { status: 400, body: { ok: false, error: 'bad keys' } };
  let cats = Array.isArray(b.categories) ? b.categories.filter(c => CATEGORIES.includes(c)) : [];
  if (!cats.includes('breaking')) cats.unshift('breaking'); // breaking news is the point of subscribing; categories add to it
  const lang = /^(so|en|ar|fr|nl|it|de|tr|es)$/.test(b.lang) ? b.lang : 'so';
  const id = await sha256hex(s.endpoint);
  const rec = { endpoint: s.endpoint, keys: { p256dh: s.keys.p256dh, auth: s.keys.auth }, categories: [...new Set(cats)], lang, at: new Date().toISOString() };
  await env.SUBS.put('sub:' + id, JSON.stringify(rec), { metadata: { c: rec.categories.join(','), l: lang } });
  return { status: 200, body: { ok: true, categories: rec.categories } };
}

async function unsubscribe(req, env) {
  const b = await readBody(req);
  if (!validEndpoint(b.endpoint)) return { status: 400, body: { ok: false, error: 'bad endpoint' } };
  await env.SUBS.delete('sub:' + await sha256hex(b.endpoint));
  return { status: 200, body: { ok: true } };
}

function pickLang(m, lang) {
  const t = m.t && m.t[lang] && m.t[lang].title ? m.t[lang] : null;
  return { title: (t && t.title) || m.title, body: (t && t.body) || m.body || '' };
}

async function send(req, env) {
  const m = await readBody(req);
  if (!m.id || !/^[A-Za-z0-9_.:-]{1,120}$/.test(m.id)) return { status: 400, body: { ok: false, error: 'id required' } };
  if (!CATEGORIES.includes(m.category)) return { status: 400, body: { ok: false, error: 'unknown category' } };
  if (typeof m.title !== 'string' || !m.title.trim()) return { status: 400, body: { ok: false, error: 'title required' } };
  const url = siteLink(m.url, env);
  if (!url) return { status: 400, body: { ok: false, error: 'url must be a page of the Wartabiye TV site' } };
  const limit = Math.max(1, Math.min(45, parseInt(m.limit, 10) || 40));
  if (!m.cursor) {
    const prev = await env.SUBS.get('sent:' + m.id);
    if (prev) return { status: 200, body: { ok: true, duplicate: true, id: m.id, previous: JSON.parse(prev) } };
    if (!m.dryRun) await env.SUBS.put('sent:' + m.id, JSON.stringify({ at: new Date().toISOString(), state: 'sending' }), { expirationTtl: 90 * 86400 });
  }
  const page = await env.SUBS.list({ prefix: 'sub:', cursor: m.cursor || undefined, limit });
  const stats = { matched: 0, sent: 0, failed: 0, removed: 0 };
  const image = m.image ? siteLink(m.image, env) : null;
  const icon = siteLink('img/logo.png', env);
  for (const k of page.keys) {
    const cats = String((k.metadata && k.metadata.c) || 'breaking').split(',');
    if (!cats.includes(m.category) && !(m.urgent && m.category === 'breaking')) continue;
    stats.matched++;
    if (m.dryRun) continue;
    const raw = await env.SUBS.get(k.name);
    if (!raw) continue;
    const sub = JSON.parse(raw);
    const txt = pickLang(m, sub.lang);
    const msg = { title: txt.title.slice(0, 120), body: txt.body.slice(0, 200), url, icon, badge: icon, image, tag: m.id, urgent: !!m.urgent, lang: sub.lang, id: m.id };
    try {
      const st = await sendOne(sub, msg, env, !!m.urgent);
      if (st >= 200 && st < 300) stats.sent++;
      else if (st === 404 || st === 410) { stats.removed++; await env.SUBS.delete(k.name); } // the visitor unsubscribed or the browser dropped it
      else stats.failed++;
    } catch (e) { stats.failed++; }
  }
  const next = page.list_complete ? null : page.cursor;
  // one log line per page; the stats endpoint adds the pages up
  if (!m.dryRun) await env.SUBS.put(`log:${Date.now()}:${m.id}`.slice(0, 480), JSON.stringify({ id: m.id, category: m.category, urgent: !!m.urgent, title: m.title.slice(0, 120), url, at: new Date().toISOString(), ...stats, done: !next }), { expirationTtl: 60 * 86400 });
  if (!next && !m.dryRun) await env.SUBS.put('sent:' + m.id, JSON.stringify({ at: new Date().toISOString(), state: 'sent' }), { expirationTtl: 90 * 86400 });
  return { status: 200, body: { ok: true, id: m.id, dryRun: !!m.dryRun, ...stats, next } };
}

async function stats(env) {
  const counts = { total: 0 }; CATEGORIES.forEach(c => { counts[c] = 0; });
  const langs = {};
  let cursor;
  do {
    const p = await env.SUBS.list({ prefix: 'sub:', cursor, limit: 1000 });
    for (const k of p.keys) {
      counts.total++;
      String((k.metadata && k.metadata.c) || 'breaking').split(',').forEach(c => { if (c in counts) counts[c]++; });
      const l = (k.metadata && k.metadata.l) || 'so'; langs[l] = (langs[l] || 0) + 1;
    }
    cursor = p.list_complete ? null : p.cursor;
  } while (cursor);
  const logs = await env.SUBS.list({ prefix: 'log:', limit: 1000 });
  const names = logs.keys.map(k => k.name).sort().reverse().slice(0, 50);
  const recent = [];
  for (const n of names) { const v = await env.SUBS.get(n); if (v) recent.push(JSON.parse(v)); }
  return { ok: true, subscribers: counts, languages: langs, recent };
}

export default {
  async fetch(req, env) {
    const h = cors(req, env);
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: h });
    const path = new URL(req.url).pathname.replace(/\/+$/, '');
    try {
      if (path === '/v1/health') return json({ ok: true, configured: configured(env) }, 200, h);
      if (path === '/v1/key' && req.method === 'GET') return configured(env) ? json({ publicKey: env.VAPID_PUBLIC_KEY }, 200, { ...h, 'Cache-Control': 'public, max-age=3600' }) : json({ ok: false, error: 'not configured' }, 503, h);
      if (!configured(env)) return json({ ok: false, error: 'not configured' }, 503, h);
      if (path === '/v1/subscribe' && req.method === 'POST') { const r = await subscribe(req, env); return json(r.body, r.status, h); }
      if (path === '/v1/unsubscribe' && req.method === 'POST') { const r = await unsubscribe(req, env); return json(r.body, r.status, h); }
      if (path === '/v1/send' && req.method === 'POST') {
        if (!authorised(req, env)) return json({ ok: false, error: 'unauthorised' }, 401, h);
        const r = await send(req, env); return json(r.body, r.status, h);
      }
      if (path === '/v1/stats' && req.method === 'GET') {
        if (!authorised(req, env)) return json({ ok: false, error: 'unauthorised' }, 401, h);
        return json(await stats(env), 200, h);
      }
      return json({ ok: false, error: 'not found' }, 404, h);
    } catch (e) {
      return json({ ok: false, error: String(e && e.message || e).slice(0, 200) }, 400, h);
    }
  },
};
