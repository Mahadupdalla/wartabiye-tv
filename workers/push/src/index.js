/* Wartabiye TV push notifications (Cloudflare Worker + Workers KV, free plan is enough for a news site).
 *
 * Why it exists: GitHub Pages cannot keep a secret. Browser push (Web Push, RFC 8030/8291/8292) needs a private VAPID
 * key to sign every message and a place to keep the visitors' subscriptions. Both live here, never in the public repo:
 *   VAPID_PRIVATE_JWK  (secret)  the private signing key (made by the "Push: deploy" workflow or make-keys.mjs)
 *   VAPID_PUBLIC_KEY   (secret or var) the public half; it is safe to publish (the browser needs it to subscribe)
 *   GITHUB_REPO        (var)     "Mahadupdalla/wartabiye-tv": only GitHub Actions of THIS repository, on branch main,
 *                                may send. They prove it with a short-lived GitHub OIDC token (no password to keep).
 *   PUSH_ADMIN_TOKEN   (secret, optional) a long random password, accepted as well (for sending by hand)
 *   VAPID_SUBJECT      (var)     mailto: or https: contact for the push services
 *   SUBS               (KV)      one record per subscribed browser; nothing else about the visitor is stored
 *
 * Endpoints
 *   GET  /v1/health                       {"ok":true,"configured":bool}
 *   GET  /v1/key                          {"publicKey": "..."}
 *   POST /v1/subscribe    (browser)       {subscription:{endpoint,keys:{p256dh,auth}}, categories:[...], lang, freq}
 *                                         freq: "all" every story | "digest" one alert per update | "top" important only
 *   POST /v1/unsubscribe  (browser)       {endpoint}
 *   POST /v1/send         (GitHub/admin)  {items:[{id,category,urgent,top,title,body,t,url,image}], strings, cursor,
 *                                         limit, dryRun, totals}: one page of subscribers per call; the caller repeats
 *                                         with "next" until it is null. Each visitor gets what their choices allow.
 *                                         An id that was already delivered is never sent again (KV "sent:<id>").
 *   GET  /v1/stats        (GitHub/admin)  subscriber counts (per category, frequency and language) and the last runs
 *
 * Nothing here invents content: it only delivers what the publish workflow or the owner sends, and every link must be
 * on the Wartabiye TV site (SITE_URL).
 */
const CATEGORIES = ['breaking', 'somalia', 'eastAfrica', 'world', 'sports', 'live'];
const FREQS = ['all', 'digest', 'top'];
const LANGS = /^(so|en|ar|fr|nl|it|de|tr|es)$/;
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

const jwtCache = new Map();
async function vapidCached(endpoint, env) {
  const aud = new URL(endpoint).origin, now = Math.floor(Date.now() / 1000), c = jwtCache.get(aud);
  if (c && c.until > now + 600 && c.pub === env.VAPID_PUBLIC_KEY) return c.h;
  const h = await vapidHeader(endpoint, env, now);
  jwtCache.set(aud, { h, until: now + 12 * 3600, pub: env.VAPID_PUBLIC_KEY });
  return h;
}

export async function sendOne(sub, message, env, urgent, serverKeys) {
  const body = await encryptPayload(sub, JSON.stringify(message), { serverKeys });
  const r = await fetch(sub.endpoint, {
    method: 'POST',
    headers: {
      Authorization: await vapidCached(sub.endpoint, env),
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
function tokenOk(t, env) {
  if (!env.PUSH_ADMIN_TOKEN || env.PUSH_ADMIN_TOKEN.length < 24 || t.length !== env.PUSH_ADMIN_TOKEN.length) return false;
  let d = 0;
  for (let i = 0; i < t.length; i++) d |= t.charCodeAt(i) ^ env.PUSH_ADMIN_TOKEN.charCodeAt(i);
  return d === 0;
}

// ---------- GitHub Actions OIDC: only workflows of the site's own repository, on branch main, may send ----------
const GH_ISS = 'https://token.actions.githubusercontent.com';
let jwks = null;
async function githubKeys(force) {
  if (!force && jwks && jwks.until > Date.now()) return jwks.keys;
  const r = await fetch(GH_ISS + '/.well-known/jwks', { headers: { 'User-Agent': 'wartabiye-push' } });
  if (!r.ok) throw new Error('GitHub keys HTTP ' + r.status);
  jwks = { keys: (await r.json()).keys || [], until: Date.now() + 3600e3 };
  return jwks.keys;
}
const dec = s => JSON.parse(new TextDecoder().decode(unb64u(s)));
export async function verifyGithub(token, env, nowSec = Math.floor(Date.now() / 1000)) {
  const repo = String(env.GITHUB_REPO || '').toLowerCase();
  if (!repo) return false;
  const p = String(token).split('.');
  if (p.length !== 3) return false;
  let h, c;
  try { h = dec(p[0]); c = dec(p[1]); } catch (e) { return false; }
  if (h.alg !== 'RS256' || !h.kid) return false;
  let jwk = (await githubKeys()).find(k => k.kid === h.kid);
  if (!jwk) jwk = (await githubKeys(true)).find(k => k.kid === h.kid);
  if (!jwk) return false;
  const key = await crypto.subtle.importKey('jwk', { kty: 'RSA', n: jwk.n, e: jwk.e, alg: 'RS256', ext: true }, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, unb64u(p[2]), enc.encode(p[0] + '.' + p[1]));
  if (!ok) return false;
  const aud = Array.isArray(c.aud) ? c.aud : [c.aud];
  return c.iss === GH_ISS && aud.includes(env.OIDC_AUDIENCE || 'wartabiye-push') && String(c.repository || '').toLowerCase() === repo
    && c.ref === 'refs/heads/main' && typeof c.exp === 'number' && c.exp > nowSec - 30 && (!c.nbf || c.nbf <= nowSec + 60);
}
async function authorised(req, env) {
  const t = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  if (!t) return false;
  if (tokenOk(t, env)) return true;
  try { return await verifyGithub(t, env); } catch (e) { return false; }
}
function validEndpoint(u) {
  try { const x = new URL(u); return x.protocol === 'https:' && u.length < 1024; } catch (e) { return false; }
}
export function siteLink(u, env) {
  const site = env.SITE_URL || 'https://www.wartabiyetv.com/';
  try { const x = new URL(u, site); return x.origin === new URL(site).origin ? x.href : null; } catch (e) { return null; }
}
async function readBody(req, max = 8192) {
  const t = await req.text();
  if (t.length > max) throw new Error('body too large');
  return JSON.parse(t || '{}');
}
const configured = env => !!(env.SUBS && env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_JWK);
const meta = k => ({ c: String((k.metadata && k.metadata.c) || 'breaking').split(','), l: (k.metadata && k.metadata.l) || 'so', f: FREQS.includes(k.metadata && k.metadata.f) ? k.metadata.f : 'top' });

// ---------- endpoints ----------
async function subscribe(req, env) {
  const b = await readBody(req);
  const s = b.subscription || {};
  if (!validEndpoint(s.endpoint) || !s.keys || typeof s.keys.p256dh !== 'string' || typeof s.keys.auth !== 'string') return { status: 400, body: { ok: false, error: 'bad subscription' } };
  if (unb64u(s.keys.p256dh).length !== 65 || unb64u(s.keys.auth).length !== 16) return { status: 400, body: { ok: false, error: 'bad keys' } };
  let cats = Array.isArray(b.categories) ? b.categories.filter(c => CATEGORIES.includes(c)) : [];
  if (b.all === true) cats = CATEGORIES.slice();
  if (!cats.includes('breaking')) cats.unshift('breaking'); // breaking news always reaches every subscriber
  const lang = LANGS.test(b.lang) ? b.lang : 'so';
  const freq = FREQS.includes(b.freq) ? b.freq : 'top';
  const id = await sha256hex(s.endpoint);
  const rec = { endpoint: s.endpoint, keys: { p256dh: s.keys.p256dh, auth: s.keys.auth }, categories: [...new Set(cats)], lang, freq, at: new Date().toISOString() };
  await env.SUBS.put('sub:' + id, JSON.stringify(rec), { metadata: { c: rec.categories.join(','), l: lang, f: freq } });
  return { status: 200, body: { ok: true, categories: rec.categories, lang, freq } };
}

async function unsubscribe(req, env) {
  const b = await readBody(req);
  if (!validEndpoint(b.endpoint)) return { status: 400, body: { ok: false, error: 'bad endpoint' } };
  await env.SUBS.delete('sub:' + await sha256hex(b.endpoint));
  return { status: 200, body: { ok: true } };
}

// the visitor's language, then English for a non-Somali reader, then the Somali original
export function pickLang(m, lang) {
  const t = m.t || {};
  const x = (t[lang] && t[lang].title) ? t[lang] : (lang !== 'so' && t.en && t.en.title) ? t.en : null;
  return { title: (x && x.title) || m.title, body: (x && x.body) || m.body || '', lang: x ? (t[lang] === x ? lang : 'en') : 'so' };
}
const fill = (s, o) => String(s || '').replace(/\{(\w+)\}/g, (_, k) => (o[k] != null ? o[k] : ''));

/* What one visitor receives from one update. Pure function (tested):
   urgent items: always, one by one; then the stories of the visitor's categories according to their frequency. */
export function compose(items, m, strings, site) {
  const U = items.filter(i => i.urgent);
  const R = items.filter(i => !i.urgent && m.c.includes(i.category));
  const one = (i, extra) => { const x = pickLang(i, m.l); return { title: x.title, body: x.body, url: i.url, image: i.image || null, tag: i.id, id: i.id, urgent: !!i.urgent, lang: x.lang, ...(extra || {}) }; };
  const S = (strings && (strings[m.l] || strings.en || strings.so)) || {};
  const more = (list, lead) => {
    const first = pickLang(list[0], m.l);
    const n = list.length - (lead ? 1 : 0);
    if (lead) return { title: first.title, body: fill(S.more || '+{n}', { n }), url: site, image: list[0].image || null, tag: 'u-' + list[0].id, id: list[0].id, urgent: false, lang: m.l, digest: list.map(i => i.id) };
    return { title: fill(S.moreTitle || '{n}', { n }), body: list.slice(0, 3).map(i => pickLang(i, m.l).title).join(' · ').slice(0, 200), url: site, image: null, tag: 'm-' + list[0].id, id: list[0].id, urgent: false, lang: m.l, digest: list.map(i => i.id) };
  };
  const out = U.slice(0, 3).map(i => one(i));
  if (!R.length) return out;
  if (m.f === 'top') R.filter(i => i.top).slice(0, 1).forEach(i => out.push(one(i)));
  else if (m.f === 'digest') out.push(R.length === 1 ? one(R[0]) : more(R, true));
  else if (R.length <= 3) R.forEach(i => out.push(one(i)));
  else { R.slice(0, 2).forEach(i => out.push(one(i))); out.push(more(R.slice(2), false)); }
  return out;
}

function cleanItem(i, env) {
  if (!i || !/^[A-Za-z0-9_.:-]{1,120}$/.test(i.id || '')) throw new Error('item id required');
  if (!CATEGORIES.includes(i.category)) throw new Error('unknown category ' + i.category);
  if (typeof i.title !== 'string' || !i.title.trim()) throw new Error('title required');
  const url = siteLink(i.url, env);
  if (!url) throw new Error('url must be a page of the Wartabiye TV site');
  const t = {};
  for (const [l, x] of Object.entries(i.t || {})) if (LANGS.test(l) && x && typeof x.title === 'string' && x.title.trim()) t[l] = { title: x.title.slice(0, 120), body: String(x.body || '').slice(0, 200) };
  return { id: i.id, category: i.category, urgent: !!i.urgent, top: !!(i.top || i.urgent), title: i.title.slice(0, 120), body: String(i.body || '').slice(0, 200), t, url, image: i.image ? siteLink(i.image, env) : null };
}

async function send(req, env) {
  const b = await readBody(req, 65536);
  let items;
  try { items = (Array.isArray(b.items) ? b.items : [b]).slice(0, 20).map(i => cleanItem(i, env)); } catch (e) { return { status: 400, body: { ok: false, error: e.message } }; }
  if (!items.length) return { status: 400, body: { ok: false, error: 'no items' } };
  // an id that was already delivered is never sent again (checked on every page: a repeated run stops at once)
  const dup = [];
  for (const i of items) if (await env.SUBS.get('sent:' + i.id)) dup.push(i.id);
  if (dup.length && !b.cursor) items = items.filter(i => !dup.includes(i.id));
  if (!items.length) return { status: 200, body: { ok: true, duplicate: true, ids: dup, next: null, matched: 0, sent: 0, failed: 0, removed: 0 } };
  const perSub = Math.min(3, items.filter(i => i.urgent).length) + 3;
  const limit = Math.max(1, Math.min(Math.floor(45 / perSub), parseInt(b.limit, 10) || 40));
  const page = await env.SUBS.list({ prefix: 'sub:', cursor: b.cursor || undefined, limit });
  const st = { matched: 0, sent: 0, failed: 0, removed: 0, messages: 0 };
  const site = siteLink('./', env);
  const icon = siteLink('img/icon-192.png', env);
  const serverKeys = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const errors = {};
  for (const k of page.keys) {
    const m = meta(k);
    const msgs = compose(items, m, b.strings, site);
    if (!msgs.length) continue;
    st.matched++;
    if (b.dryRun) { st.messages += msgs.length; continue; }
    const raw = await env.SUBS.get(k.name);
    if (!raw) continue;
    const sub = JSON.parse(raw);
    let gone = false, okAny = false;
    for (const msg of msgs) {
      try {
        const code = await sendOne(sub, { ...msg, icon, badge: icon }, env, msg.urgent, serverKeys);
        st.messages++;
        if (code >= 200 && code < 300) okAny = true;
        else if (code === 404 || code === 410) { gone = true; break; } // the visitor unsubscribed or the browser dropped it
        else errors[code] = (errors[code] || 0) + 1;
      } catch (e) { errors.exception = (errors.exception || 0) + 1; }
    }
    if (gone) { st.removed++; await env.SUBS.delete(k.name); } else if (okAny) st.sent++; else st.failed++;
  }
  const next = page.list_complete ? null : page.cursor;
  if (!next && !b.dryRun) {
    // the last page: remember the ids (never again) and keep one log line for the whole update
    for (const i of items) await env.SUBS.put('sent:' + i.id, JSON.stringify({ at: new Date().toISOString() }), { expirationTtl: 90 * 86400 });
    const tot = b.totals || {};
    const sum = k => (parseInt(tot[k], 10) || 0) + st[k];
    await env.SUBS.put(`log:${Date.now()}`, JSON.stringify({ at: new Date().toISOString(), ids: items.map(i => i.id), titles: items.map(i => i.title), urgent: items.some(i => i.urgent),
      matched: sum('matched'), sent: sum('sent'), failed: sum('failed'), removed: sum('removed'), messages: sum('messages') }), { expirationTtl: 60 * 86400 });
  }
  return { status: 200, body: { ok: true, ids: items.map(i => i.id), duplicates: dup, dryRun: !!b.dryRun, ...st, errors, next } };
}

async function stats(env) {
  const counts = { total: 0 }; CATEGORIES.forEach(c => { counts[c] = 0; });
  const langs = {}, freqs = { all: 0, digest: 0, top: 0 };
  let cursor;
  do {
    const p = await env.SUBS.list({ prefix: 'sub:', cursor, limit: 1000 });
    for (const k of p.keys) {
      const m = meta(k);
      counts.total++;
      m.c.forEach(c => { if (c in counts) counts[c]++; });
      langs[m.l] = (langs[m.l] || 0) + 1; freqs[m.f]++;
    }
    cursor = p.list_complete ? null : p.cursor;
  } while (cursor);
  const logs = await env.SUBS.list({ prefix: 'log:', limit: 1000 });
  const names = logs.keys.map(k => k.name).sort().reverse().slice(0, 30);
  const recent = [];
  for (const n of names) { const v = await env.SUBS.get(n); if (v) recent.push(JSON.parse(v)); }
  return { ok: true, subscribers: counts, frequencies: freqs, languages: langs, recent };
}

export default {
  async fetch(req, env) {
    const h = cors(req, env);
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: h });
    const path = new URL(req.url).pathname.replace(/\/+$/, '');
    try {
      if (path === '/v1/health') return json({ ok: true, configured: configured(env), sender: env.GITHUB_REPO ? 'github-actions' : (env.PUSH_ADMIN_TOKEN ? 'token' : 'none') }, 200, h);
      if (path === '/v1/key' && req.method === 'GET') return configured(env) ? json({ publicKey: env.VAPID_PUBLIC_KEY }, 200, { ...h, 'Cache-Control': 'public, max-age=3600' }) : json({ ok: false, error: 'not configured' }, 503, h);
      if (!configured(env)) return json({ ok: false, error: 'not configured' }, 503, h);
      if (path === '/v1/subscribe' && req.method === 'POST') { const r = await subscribe(req, env); return json(r.body, r.status, h); }
      if (path === '/v1/unsubscribe' && req.method === 'POST') { const r = await unsubscribe(req, env); return json(r.body, r.status, h); }
      if (path === '/v1/send' && req.method === 'POST') {
        if (!await authorised(req, env)) return json({ ok: false, error: 'unauthorised' }, 401, h);
        const r = await send(req, env); return json(r.body, r.status, h);
      }
      if (path === '/v1/stats' && req.method === 'GET') {
        if (!await authorised(req, env)) return json({ ok: false, error: 'unauthorised' }, 401, h);
        return json(await stats(env), 200, h);
      }
      return json({ ok: false, error: 'not found' }, 404, h);
    } catch (e) {
      return json({ ok: false, error: String(e && e.message || e).slice(0, 200) }, 400, h);
    }
  },
};
