// Tests for the push Worker, no network: a fake KV store and a fake browser push service.
// Each message is DECRYPTED here with the browser's own keys (RFC 8291) and the VAPID signature is VERIFIED (RFC 8292),
// so a pass means a real browser could read the notification.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker, { b64u, unb64u, compose, pickLang, verifyGithub } from '../src/index.js';

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
  return { env: { SUBS: new KV(), VAPID_PUBLIC_KEY: pub, VAPID_PRIVATE_JWK: JSON.stringify(jwk), PUSH_ADMIN_TOKEN: 'x'.repeat(40), ALLOWED_ORIGINS: 'https://www.wartabiyetv.com', SITE_URL: 'https://www.wartabiyetv.com/', VAPID_SUBJECT: 'mailto:t@example.com', GITHUB_REPO: 'Mahadupdalla/wartabiye-tv' }, verifyKey: kp.publicKey };
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

const story = (id, category, extra = {}) => ({ id, category, urgent: false, title: 'T ' + id, body: 'B ' + id, t: { en: { title: 'E ' + id, body: 'EB' } }, url: `war/${id}.html`, ...extra });
const STR = { so: { more: '+{n} war kale', moreTitle: '{n} war cusub oo kale' }, en: { more: '+{n} more stories', moreTitle: '{n} more new stories' } };

test('subscribe, send, decrypt, verify VAPID, dedupe, unsubscribe', async () => {
  const { env, verifyKey } = await makeEnv();
  const b1 = await browser(1), b2 = await browser(2), b3 = await browser(3);
  let r = await worker.fetch(req('/v1/subscribe', 'POST', { subscription: b1.sub, categories: ['sports'], lang: 'en', freq: 'all' }), env);
  assert.equal(r.status, 200);
  const j1 = await r.json();
  assert.deepEqual(j1.categories, ['breaking', 'sports']);
  assert.equal(j1.freq, 'all');
  assert.equal(r.headers.get('Access-Control-Allow-Origin'), 'https://www.wartabiyetv.com');
  await worker.fetch(req('/v1/subscribe', 'POST', { subscription: b2.sub, categories: [], lang: 'so' }), env);
  await worker.fetch(req('/v1/subscribe', 'POST', { subscription: b3.sub, all: true, lang: 'so', freq: 'all' }), env);

  const delivered = [];
  globalThis.fetch = async (url, init) => {
    const n = url.split('/').pop();
    delivered.push({ url, init });
    return new Response(null, { status: n === '3' ? 410 : 201 });
  };
  const body = { items: [story('n-2026-11-08-test', 'sports', { image: 'img/news/w480/x.webp' })], strings: STR };
  // without a token: refused
  r = await worker.fetch(req('/v1/send', 'POST', body), env);
  assert.equal(r.status, 401);
  r = await worker.fetch(req('/v1/send', 'POST', body, ADMIN), env);
  const out = await r.json();
  assert.equal(out.matched, 2); // b2 only wants breaking news
  assert.equal(out.sent, 1);
  assert.equal(out.removed, 1); // 410 Gone: removed from the list
  assert.equal(out.next, null);
  assert.equal(delivered.length, 2);
  const d = delivered.find(x => x.url.endsWith('/1'));
  assert.equal(d.init.headers['Content-Encoding'], 'aes128gcm');
  const payload = await decrypt(b1, new Uint8Array(d.init.body));
  assert.equal(payload.title, 'E n-2026-11-08-test'); // the subscriber's language
  assert.equal(payload.lang, 'en');
  assert.equal(payload.url, 'https://www.wartabiyetv.com/war/n-2026-11-08-test.html');
  assert.equal(payload.image, 'https://www.wartabiyetv.com/img/news/w480/x.webp');
  // VAPID JWT signed by our key, audience = the push service
  const m = d.init.headers.Authorization.match(/^vapid t=([^.]+)\.([^.]+)\.([^,]+), k=(.+)$/);
  assert.ok(m);
  assert.equal(m[4], env.VAPID_PUBLIC_KEY);
  const ok = await subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, verifyKey, unb64u(m[3]), enc.encode(m[1] + '.' + m[2]));
  assert.ok(ok, 'VAPID signature verifies');
  assert.equal(JSON.parse(new TextDecoder().decode(unb64u(m[2]))).aud, 'https://push.example.net');

  // the same story is never sent twice
  delivered.length = 0;
  r = await worker.fetch(req('/v1/send', 'POST', body, ADMIN), env);
  assert.equal((await r.json()).duplicate, true);
  assert.equal(delivered.length, 0);

  // urgent breaking news reaches everyone, whatever they chose
  r = await worker.fetch(req('/v1/send', 'POST', { items: [story('m-breaking-1', 'breaking', { urgent: true })] }, ADMIN), env);
  assert.equal((await r.json()).sent, 2);
  assert.equal(delivered.at(-1).init.headers.Urgency, 'high');

  // a link outside the site is refused
  r = await worker.fetch(req('/v1/send', 'POST', { items: [story('evil', 'world', { url: 'https://evil.example/x' })] }, ADMIN), env);
  assert.equal(r.status, 400);

  // stats need authorisation; they hold counts only
  assert.equal((await worker.fetch(req('/v1/stats'), env)).status, 401);
  const st = await (await worker.fetch(req('/v1/stats', 'GET', null, ADMIN), env)).json();
  assert.equal(st.subscribers.total, 2);
  assert.equal(st.subscribers.sports, 1);
  assert.equal(st.frequencies.all, 1);
  assert.equal(st.recent.length, 2);
  assert.ok(!JSON.stringify(st).includes('push.example.net'), 'no endpoint in the statistics');

  // unsubscribe
  await worker.fetch(req('/v1/unsubscribe', 'POST', { endpoint: b1.sub.endpoint }), env);
  const st2 = await (await worker.fetch(req('/v1/stats', 'GET', null, ADMIN), env)).json();
  assert.equal(st2.subscribers.total, 1);
});

test('what each visitor receives: All News, one alert per update, important only', () => {
  const site = 'https://www.wartabiyetv.com/';
  const five = ['a', 'b', 'c', 'd', 'e'].map(x => story('n-' + x, 'world', { top: x === 'c' }));
  const all = compose(five, { c: ['breaking', 'world'], l: 'en', f: 'all' }, STR, site);
  assert.equal(all.length, 3, 'two stories and one summary');
  assert.equal(all[0].title, 'E n-a');
  assert.equal(all[2].title, '3 more new stories');
  assert.ok(all[2].body.includes('E n-c'));
  assert.equal(all[2].url, site);
  const three = compose(five.slice(0, 3), { c: ['world'], l: 'so', f: 'all' }, STR, site);
  assert.deepEqual(three.map(x => x.title), ['T n-a', 'T n-b', 'T n-c']);
  const dg = compose(five, { c: ['world'], l: 'so', f: 'digest' }, STR, site);
  assert.equal(dg.length, 1);
  assert.equal(dg[0].title, 'T n-a');
  assert.equal(dg[0].body, '+4 war kale');
  assert.equal(compose(five.slice(1, 2), { c: ['world'], l: 'so', f: 'digest' }, STR, site)[0].url, 'war/n-b.html');
  const top = compose(five, { c: ['world'], l: 'so', f: 'top' }, STR, site);
  assert.deepEqual(top.map(x => x.id), ['n-c']);
  assert.equal(compose(five, { c: ['sports'], l: 'so', f: 'all' }, STR, site).length, 0, 'other categories: nothing');
  const urgent = compose([story('n-x', 'breaking', { urgent: true }), ...five], { c: ['breaking'], l: 'so', f: 'top' }, STR, site);
  assert.deepEqual(urgent.map(x => x.id), ['n-x'], 'breaking news reaches everyone');
  // language: the visitor's, then English, then the Somali original
  assert.equal(pickLang({ title: 'S', t: { en: { title: 'E' } } }, 'nl').title, 'E');
  assert.equal(pickLang({ title: 'S', t: { nl: { title: 'N' }, en: { title: 'E' } } }, 'nl').title, 'N');
  assert.equal(pickLang({ title: 'S', t: { en: { title: 'E' } } }, 'so').title, 'S');
});

test('GitHub Actions of this repository (branch main) may send without any password', async () => {
  const { env } = await makeEnv();
  delete env.PUSH_ADMIN_TOKEN;
  const kp = await subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify']);
  const pub = await subtle.exportKey('jwk', kp.publicKey);
  globalThis.fetch = async url => url.includes('token.actions.githubusercontent.com') ? Response.json({ keys: [{ ...pub, kid: 'k1', alg: 'RS256', use: 'sig' }] }) : new Response(null, { status: 201 });
  const now = Math.floor(Date.now() / 1000);
  const jwt = async (claims, kid = 'k1') => {
    const h = b64u(enc.encode(JSON.stringify({ alg: 'RS256', typ: 'JWT', kid })));
    const c = b64u(enc.encode(JSON.stringify({ iss: 'https://token.actions.githubusercontent.com', aud: 'wartabiye-push', repository: 'Mahadupdalla/wartabiye-tv', ref: 'refs/heads/main', exp: now + 300, iat: now, nbf: now, ...claims })));
    return h + '.' + c + '.' + b64u(await subtle.sign('RSASSA-PKCS1-v1_5', kp.privateKey, enc.encode(h + '.' + c)));
  };
  assert.equal(await verifyGithub(await jwt({}), env), true);
  assert.equal(await verifyGithub(await jwt({ repository: 'someone/else' }), env), false, 'another repository');
  assert.equal(await verifyGithub(await jwt({ ref: 'refs/heads/feature' }), env), false, 'another branch');
  assert.equal(await verifyGithub(await jwt({ ref: 'refs/pull/5/merge' }), env), false, 'a pull request');
  assert.equal(await verifyGithub(await jwt({ aud: 'other' }), env), false, 'another audience');
  assert.equal(await verifyGithub(await jwt({ exp: now - 120 }), env), false, 'expired');
  const good = await jwt({});
  assert.equal(await verifyGithub(good.slice(0, -4) + 'AAAA', env), false, 'forged signature');
  let r = await worker.fetch(req('/v1/stats', 'GET', null, { Authorization: 'Bearer ' + good }), env);
  assert.equal(r.status, 200);
  r = await worker.fetch(req('/v1/stats', 'GET', null, { Authorization: 'Bearer ' + 'x'.repeat(40) }), env);
  assert.equal(r.status, 401, 'no admin password configured: only GitHub can send');
});

test('paging: never more than 45 outgoing requests per call', async () => {
  const { env } = await makeEnv();
  for (let i = 0; i < 40; i++) { const b = await browser('p' + i); await worker.fetch(req('/v1/subscribe', 'POST', { subscription: b.sub, all: true, freq: 'all' }), env); }
  let calls = 0; globalThis.fetch = async () => { calls++; return new Response(null, { status: 201 }); };
  const items = ['a', 'b', 'c', 'd'].map(x => story('n-p' + x, 'world')).concat([story('n-pu', 'breaking', { urgent: true })]);
  let next = null, sent = 0, pages = 0, messages = 0, ids;
  do {
    const before = calls;
    const r = await worker.fetch(req('/v1/send', 'POST', { items: ids ? items.filter(i => ids.includes(i.id)) : items, strings: STR, cursor: next, limit: 40 }, ADMIN), env);
    const j = await r.json(); sent += j.sent; messages += j.messages; next = j.next; pages++; ids = j.ids;
    assert.ok(calls - before <= 45, `page ${pages}: ${calls - before} requests`);
  } while (next);
  assert.equal(sent, 40);
  assert.equal(messages, 40 * 4, 'breaking + 2 stories + 1 summary each');
  assert.ok(pages >= 4);
});

test('bad input and not configured', async () => {
  const { env } = await makeEnv();
  let r = await worker.fetch(req('/v1/subscribe', 'POST', { subscription: { endpoint: 'http://insecure', keys: {} } }), env);
  assert.equal(r.status, 400);
  r = await worker.fetch(req('/v1/health'), { });
  assert.equal((await r.json()).configured, false);
  r = await worker.fetch(req('/v1/key'), { });
  assert.equal(r.status, 503);
  r = await worker.fetch(req('/v1/send', 'POST', { items: [story('x', 'nope')] }, ADMIN), env);
  assert.equal(r.status, 400);
});
