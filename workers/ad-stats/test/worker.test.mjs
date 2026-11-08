// node --test workers/ad-stats/test/worker.test.mjs — no network, no Cloudflare account: D1 and fetch are replaced by fakes
import test from 'node:test';
import assert from 'node:assert/strict';
import { handle } from '../src/index.js';

function fakeDB() {
  const rows = new Map();
  return { rows, prepare(sql) { return { bind(...a) { return {
    async run() { const [d, ad, pos] = a, k = d + '|' + ad + '|' + pos, r = rows.get(k) || { day: d, ad, pos, views: 0, clicks: 0 };
      if (/SET views/.test(sql)) r.views++; else r.clicks++; rows.set(k, r); },
    async all() { const [from, to] = a; return { results: [...rows.values()].filter(r => r.day >= from && r.day <= to) }; } }; } }; } };
}
globalThis.fetch = async () => new Response(JSON.stringify({ ads: [{ id: '2026-11-hotel-x' }] }), { status: 200 });
const SITE = 'https://www.wartabiyetv.com';
const env = () => ({ DB: fakeDB(), STATS_TOKEN: 'long-secret', ALLOWED_ORIGINS: SITE + ',https://wartabiyetv.com', ADS_URL: SITE + '/data/ads.json' });
const hit = (body, h = {}) => new Request('https://c.example/v1/hit', { method: 'POST', body: JSON.stringify(body), headers: { Origin: SITE, 'User-Agent': 'Mozilla/5.0 (iPhone)', ...h } });
const NOW = Date.parse('2026-11-08T12:00:00Z');

test('views and clicks of a live advert are added up per day and placement, nothing else is stored', async () => {
  const e = env();
  for (let i = 0; i < 3; i++) assert.equal((await handle(hit({ id: '2026-11-hotel-x', ev: 'view', pos: 'sidebar' }), e, NOW)).status, 204);
  await handle(hit({ id: '2026-11-hotel-x', ev: 'click', pos: 'sidebar' }), e, NOW);
  await handle(hit({ id: '2026-11-hotel-x', ev: 'view', pos: 'home' }), e, NOW);
  assert.deepEqual([...e.DB.rows.values()], [{ day: '2026-11-08', ad: '2026-11-hotel-x', pos: 'sidebar', views: 3, clicks: 1 }, { day: '2026-11-08', ad: '2026-11-hotel-x', pos: 'home', views: 1, clicks: 0 }]);
});

test('other sites, bots, Do Not Track, unknown adverts and bad input are ignored', async () => {
  const e = env();
  await handle(hit({ id: '2026-11-hotel-x', ev: 'view', pos: 'home' }, { Origin: 'https://evil.example' }), e, NOW);
  await handle(hit({ id: '2026-11-hotel-x', ev: 'view', pos: 'home' }, { 'User-Agent': 'Googlebot/2.1' }), e, NOW);
  await handle(hit({ id: '2026-11-hotel-x', ev: 'view', pos: 'home' }, { DNT: '1' }), e, NOW);
  await handle(hit({ id: '2026-11-hotel-x', ev: 'view', pos: 'home' }, { 'Sec-GPC': '1' }), e, NOW);
  await handle(hit({ id: 'not-live', ev: 'view', pos: 'home' }), e, NOW);
  await handle(hit({ id: '2026-11-hotel-x', ev: 'like', pos: 'home' }), e, NOW);
  await handle(hit({ id: '2026-11-hotel-x', ev: 'view', pos: 'popup' }), e, NOW);
  await handle(hit({ id: '../x', ev: 'view', pos: 'home' }), e, NOW);
  assert.equal(e.DB.rows.size, 0);
});

test('the report needs the token and returns the requested days', async () => {
  const e = env();
  await handle(hit({ id: '2026-11-hotel-x', ev: 'view', pos: 'home' }), e, NOW);
  const no = await handle(new Request('https://c.example/v1/stats', { headers: { Origin: SITE } }), e, NOW);
  assert.equal(no.status, 401);
  const bad = await handle(new Request('https://c.example/v1/stats', { headers: { Origin: SITE, Authorization: 'Bearer wrong-secre' } }), e, NOW);
  assert.equal(bad.status, 401);
  const ok = await handle(new Request('https://c.example/v1/stats?from=2026-11-01&to=2026-11-30', { headers: { Origin: SITE, Authorization: 'Bearer long-secret' } }), e, NOW);
  assert.equal(ok.status, 200); assert.equal(ok.headers.get('Access-Control-Allow-Origin'), SITE);
  const d = await ok.json(); assert.equal(d.rows.length, 1); assert.equal(d.rows[0].views, 1);
});
