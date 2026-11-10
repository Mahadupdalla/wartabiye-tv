// Tests for the push Worker, no network: a fake KV store and a fake browser push service.
// Each message is DECRYPTED here with the browser's own keys (RFC 8291) and the VAPID signature is VERIFIED (RFC 8292),
// so a pass means a real browser could read the notification.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker, { b64u, unb64u } from '../src/index.js';

const { subtle } = globalThis.crypto;
const enc = new TextEncoder();

class KV {
  constructor() { this.m = new Map(); }
  async get(k) { return this.m.has(k) ? this.m.get(k).v : null; }
  async put(k, v, o = {}) { this.m.set(k, { v, meta: o.metadata }); }
  async delete(k) { this.m.delete(k); }
  async list({ prefix = '', cursor, limit = 1000 }) {
    const keys = [...this.m.keys()].filter(k => k.startsWith(prefix)).sort();
    const start = cursor ? parseInt(cursor, 10) : 0;
    const page = keys.slice(start, start + limit);
    const done = start + limit >= keys.length;
    return { keys: page.map(name => ({ name, metadata: this.m.get(name).meta })), list_complete: done, cursor: done ? undefined : String(start + limit) };
  }
}

async function makeEnv() {
  const kp = await subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const jwk = await subtle.exportKey('jwk', kp.privateKey);
  const pub = b64u(await subtle.exportKey('raw', kp.publicKey));
  return { env: { SUBS: new KV(), VAPID_PUBLIC_KEY: pub, VAPID_PRIVATE_JWK: JSON.stringify(jwk), PUSH_ADMIN_TOKEN: 'x'.repeat(40), ALLOWED_ORIGINS: 'https://www.wartabiyetv.com', SITE_URL: 'https://www.wartabiyetv.com/', VAPID_SUBJECT: 'mailto:t@example.com' }, verifyKey: kp.publicKey };
}

async function browser(n) {
  const kp = await subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const auth = crypto.getRandomValues(new Uint8Array(16));
  const p256dh = b64u(await subtle.exportKey('raw', kp.publicKey));
  return { kp, sub: { endpoint: `https://push.example.net/send/${n}`, keys: { p256dh, auth: b64u(auth) } } };
}

async function hmac(key, data) { const k = await subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']); return new Uint8Array(await subtle.sign('HMAC', k, data)); }
const cat = (...a) => { const o = new Uint8Array(a.reduce((n, x) => n + x.length, 0)); let i = 0; for (const x of a) { o.set(x, i); i += x.length; } return o; };

// RFC 8291 decryption, as the browser does it
async function decrypt(b, body) {
  const salt = body.slice(0, 16), idlen = body[20], asPub = body.slice(21, 21 + idlen), ct = body.slice(21 + idlen);
  const uaPub = unb64u(b.sub.keys.p256dh), auth = unb64u(b.sub.keys.auth);
  const asKey = await subtle.importKey('raw', asPub, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const ecdh = new Uint8Array(await subtle.deriveBits({ name: 'ECDH', public: asKey }, b.kp.privateKey, 256));
  const ikm = await hmac(await hmac(auth, ecdh), cat(enc.encode('WebPush: info\0'), uaPub, asPub, new Uint8Array([1])));
  const prk = await hmac(salt, ikm);
  const cek = (await hmac(prk, cat(enc.encode('Content-Encoding: aes128gcm\0'), new Uint8Array([1])))).slice(0, 16);
  const nonce = (await hmac(prk, cat(enc.encode('Content-Encoding: nonce\0'), new Uint8Array([1])))).slice(0, 12);
  const k = await subtle.importKey('raw', cek, 'AES-GCM', false, ['decrypt']);
  const pt = new Uint8Array(await subtle.decrypt({ name: 'AES-GCM', iv: nonce }, k, ct));
  assert.equal(pt[pt.length - 1], 2, 'last-record delimiter');
  return JSON.parse(new TextDecoder().decode(pt.slice(0, -1)));
}

function req(path, method = 'GET', body, headers = {}) {
  return new Request('https://push.wartabiyetv.workers.dev' + path, { method, body: body ? JSON.stringify(body) : undefined, headers: { 'Content-Type': 'application/json', Origin: 'https://www.wartabiyetv.com', ...headers } });
}
const ADMIN = { Authorization: 'Bearer ' + 'x'.repeat(40) };

test('subscribe, send, decrypt, verify VAPID, dedupe, unsubscribe', async () => {
  const { env, verifyKey } = await makeEnv();
  const b1 = await browser(1), b2 = await browser(2), b3 = await browser(3);
  let r = await worker.fetch(req('/v1/subscribe', 'POST', { subscription: b1.sub, categories: ['sports'], lang: 'en' }), env);
  assert.equal(r.status, 200);
  assert.deepEqual((await r.json()).categories, ['breaking', 'sports']);
  assert.equal(r.headers.get('Access-Control-Allow-Origin'), 'https://www.wartabiyetv.com');
  await worker.fetch(req('/v1/subscribe', 'POST', { subscription: b2.sub, categories: [], lang: 'so' }), env);
  await worker.fetch(req('/v1/subscribe', 'POST', { subscription: b3.sub, categories: ['sports'], lang: 'so' }), env);

  const delivered = [];
  globalThis.fetch = async (url, init) => {
    const n = url.split('/').pop();
    delivered.push({ url, init });
    return new Response(null, { status: n === '3' ? 410 : 201 });
  };
  const msg = { id: 'n-2026-11-08-test', category: 'sports', urgent: false, title: 'Ciyaar', body: 'Natiijo', t: { en: { title: 'Match', body: 'Result' } }, url: 'war/2026-11-08-test.html', image: 'img/news/w480/x.webp' };
  // without the token: refused
  r = await worker.fetch(req('/v1/send', 'POST', msg), env);
  assert.equal(r.status, 401);
  r = await worker.fetch(req('/v1/send', 'POST', msg, ADMIN), env);
  const out = await r.json();
  assert.equal(out.matched, 2); // b2 only wants breaking
  assert.equal(out.sent, 1);
  assert.equal(out.removed, 1); // 410 Gone: dropped from the list
  assert.equal(out.next, null);
  assert.equal(delivered.length, 2);
  const d = delivered.find(x => x.url.endsWith('/1'));
  assert.equal(d.init.headers['Content-Encoding'], 'aes128gcm');
  const payload = await decrypt(b1, new Uint8Array(d.init.body));
  assert.equal(payload.title, 'Match'); // the subscriber's language
  assert.equal(payload.url, 'https://www.wartabiyetv.com/war/2026-11-08-test.html');
  // VAPID JWT signed by our key, audience = the push service
  const m = d.init.headers.Authorization.match(/^vapid t=([^.]+)\.([^.]+)\.([^,]+), k=(.+)$/);
  assert.ok(m);
  assert.equal(m[4], env.VAPID_PUBLIC_KEY);
  const ok = await subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, verifyKey, unb64u(m[3]), enc.encode(m[1] + '.' + m[2]));
  assert.ok(ok, 'VAPID signature verifies');
  assert.equal(JSON.parse(new TextDecoder().decode(unb64u(m[2]))).aud, 'https://push.example.net');

  // the same story is never sent twice
  delivered.length = 0;
  r = await worker.fetch(req('/v1/send', 'POST', msg, ADMIN), env);
  assert.equal((await r.json()).duplicate, true);
  assert.equal(delivered.length, 0);

  // urgent breaking news reaches everyone
  r = await worker.fetch(req('/v1/send', 'POST', { ...msg, id: 'm-breaking-1', category: 'breaking', urgent: true }, ADMIN), env);
  assert.equal((await r.json()).sent, 2);
  assert.equal(delivered.at(-1).init.headers.Urgency, 'high');

  // a link outside the site is refused
  r = await worker.fetch(req('/v1/send', 'POST', { ...msg, id: 'evil', url: 'https://evil.example/x' }, ADMIN), env);
  assert.equal(r.status, 400);

  // stats need the token
  assert.equal((await worker.fetch(req('/v1/stats'), env)).status, 401);
  const st = await (await worker.fetch(req('/v1/stats', 'GET', null, ADMIN), env)).json();
  assert.equal(st.subscribers.total, 2);
  assert.equal(st.subscribers.sports, 1);
  assert.ok(st.recent.length >= 2);

  // unsubscribe
  await worker.fetch(req('/v1/unsubscribe', 'POST', { endpoint: b1.sub.endpoint }), env);
  const st2 = await (await worker.fetch(req('/v1/stats', 'GET', null, ADMIN), env)).json();
  assert.equal(st2.subscribers.total, 1);
});

test('paging: many subscribers are sent in pages of at most 45', async () => {
  const { env } = await makeEnv();
  for (let i = 0; i < 95; i++) { const b = await browser('p' + i); await worker.fetch(req('/v1/subscribe', 'POST', { subscription: b.sub, categories: ['world'] }), env); }
  let calls = 0; globalThis.fetch = async () => { calls++; return new Response(null, { status: 201 }); };
  let next = null, sent = 0, pages = 0;
  do {
    const r = await worker.fetch(req('/v1/send', 'POST', { id: 'n-world-1', category: 'world', title: 'T', url: 'war/x.html', cursor: next, limit: 40 }, ADMIN), env);
    const j = await r.json(); sent += j.sent; next = j.next; pages++;
    assert.ok(calls <= 40 * pages);
  } while (next);
  assert.equal(sent, 95);
  assert.equal(pages, 3);
});

test('bad input and not configured', async () => {
  const { env } = await makeEnv();
  let r = await worker.fetch(req('/v1/subscribe', 'POST', { subscription: { endpoint: 'http://insecure', keys: {} } }), env);
  assert.equal(r.status, 400);
  r = await worker.fetch(req('/v1/health'), { });
  assert.equal((await r.json()).configured, false);
  r = await worker.fetch(req('/v1/key'), { });
  assert.equal(r.status, 503);
  r = await worker.fetch(req('/v1/send', 'POST', { id: 'x', category: 'nope', title: 't', url: 'war/x.html' }, ADMIN), env);
  assert.equal(r.status, 400);
});

test('mobile app: register Expo tokens, send through Expo after the browsers, dedupe, drop dead tokens', async () => {
  const { env } = await makeEnv();
  const b1 = await browser('w1');
  await worker.fetch(req('/v1/subscribe', 'POST', { subscription: b1.sub, categories: ['world'], lang: 'so' }), env);
  const T = n => `ExponentPushToken[${'a'.repeat(20)}${n}]`;
  const app = (path, body) => new Request('https://push.wartabiyetv.workers.dev' + path, { method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } }); // native app: no Origin
  let r = await worker.fetch(app('/v1/app/register', { token: 'not-a-token' }), env);
  assert.equal(r.status, 400);
  r = await worker.fetch(app('/v1/app/register', { token: T(1), categories: ['breaking', 'world'], lang: 'en', platform: 'android' }), env);
  assert.deepEqual((await r.json()).categories, ['breaking', 'world']);
  await worker.fetch(app('/v1/app/register', { token: T(2), categories: ['sports'], lang: 'ar', platform: 'ios' }), env);
  await worker.fetch(app('/v1/app/register', { token: T(3), categories: ['world', 'breaking'], lang: 'so', platform: 'ios' }), env);
  // empty list = notifications off: the token is removed
  await worker.fetch(app('/v1/app/register', { token: T(4), categories: ['world'] }), env);
  r = await worker.fetch(app('/v1/app/register', { token: T(4), categories: [] }), env);
  assert.deepEqual((await r.json()).categories, []);

  const expo = [], web = [];
  globalThis.fetch = async (url, init) => {
    if (String(url).startsWith('https://exp.host/')) {
      const msgs = JSON.parse(init.body); expo.push(...msgs);
      return new Response(JSON.stringify({ data: msgs.map(m => m.to === T(3) ? { status: 'error', details: { error: 'DeviceNotRegistered' } } : { status: 'ok', id: 'x' }) }), { status: 200 });
    }
    web.push(url); return new Response(null, { status: 201 });
  };
  const msg = { id: 'n-world-app', category: 'world', title: 'Adduunka', body: 'Qoraal', t: { en: { title: 'World', body: 'Text' } }, url: 'war/2026-11-10-x.html' };
  let next = null, tot = { sent: 0, removed: 0, matched: 0 }, calls = 0;
  do {
    const j = await (await worker.fetch(req('/v1/send', 'POST', { ...msg, cursor: next }, ADMIN), env)).json();
    tot.sent += j.sent; tot.removed += j.removed; tot.matched += j.matched; next = j.next; calls++;
  } while (next && calls < 5);
  assert.equal(calls, 2, 'one call for the browsers, one for the app');
  assert.equal(web.length, 1);
  assert.equal(expo.length, 2, 'only the tokens that chose World');
  const m1 = expo.find(m => m.to === T(1));
  assert.equal(m1.title, 'World'); // the app user's language
  assert.equal(m1.data.path, '/war/2026-11-10-x', 'tapping opens the article inside the app');
  assert.equal(m1.data.url, 'https://www.wartabiyetv.com/war/2026-11-10-x.html');
  assert.equal(m1.channelId, 'news');
  assert.equal(tot.sent, 2); assert.equal(tot.removed, 1);
  // never twice
  const again = await (await worker.fetch(req('/v1/send', 'POST', msg, ADMIN), env)).json();
  assert.equal(again.duplicate, true);
  // urgent breaking: only tokens that kept Breaking News on, high priority
  expo.length = 0;
  next = null; calls = 0;
  do { const j = await (await worker.fetch(req('/v1/send', 'POST', { ...msg, id: 'b-1', category: 'breaking', urgent: true, cursor: next }, ADMIN), env)).json(); next = j.next; calls++; } while (next && calls < 5);
  assert.deepEqual(expo.map(m => m.to), [T(1)]);
  assert.equal(expo[0].priority, 'high'); assert.equal(expo[0].channelId, 'breaking');
  const st = await (await worker.fetch(req('/v1/stats', 'GET', null, ADMIN), env)).json();
  assert.equal(st.app.total, 2); assert.equal(st.app.ios, 1); assert.equal(st.app.android, 1);
  // unregister
  await worker.fetch(app('/v1/app/unregister', { token: T(1) }), env);
  const st2 = await (await worker.fetch(req('/v1/stats', 'GET', null, ADMIN), env)).json();
  assert.equal(st2.app.total, 1);
});

test('mobile app only (no browser keys yet): register and send still work', async () => {
  const env = { SUBS: new KV(), PUSH_ADMIN_TOKEN: 'x'.repeat(40), SITE_URL: 'https://www.wartabiyetv.com/' };
  const tok = `ExponentPushToken[${'b'.repeat(22)}]`;
  let r = await worker.fetch(new Request('https://p/v1/app/register', { method: 'POST', body: JSON.stringify({ token: tok, categories: ['sports'] }) }), env);
  assert.equal(r.status, 200);
  assert.equal((await worker.fetch(req('/v1/key'), env)).status, 503, 'browser push stays off without VAPID');
  let n = 0; globalThis.fetch = async (u, i) => { n++; return new Response(JSON.stringify({ data: JSON.parse(i.body).map(() => ({ status: 'ok' })) })); };
  let next = null, sent = 0;
  do { const j = await (await worker.fetch(req('/v1/send', 'POST', { id: 's-1', category: 'sports', title: 'T', url: 'war/s.html', cursor: next }, ADMIN), env)).json(); sent += j.sent; next = j.next; } while (next);
  assert.equal(sent, 1); assert.equal(n, 1);
});
