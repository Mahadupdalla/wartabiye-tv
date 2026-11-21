import test from 'node:test';
import assert from 'node:assert/strict';
import { config, isClosed, nextAt, exempt, handle, openLabel } from '../src/index.js';

// Nairobi wall-clock time -> UTC ms (EAT = UTC+3)
const eat = (d, h, m = 0, s = 0) => Date.UTC(2026, 10, d, h - 3, m, s);
const c = config({});
const page = (path, init) => new Request('https://www.wartabiyetv.com' + path, init);
const site = async () => new Response('<h1>site</h1>', { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'max-age=600' } });

test('closed exactly from 00:00 to 06:59:59 Nairobi time, every day', () => {
  for (let d = 1; d <= 30; d++) {
    for (let h = 0; h < 24; h++) {
      for (const m of [0, 30, 59]) assert.equal(isClosed(eat(d, h, m), c), h < 7, `${d} ${h}:${m}`);
    }
    assert.equal(isClosed(eat(d, 23, 59, 59), c), false);
    assert.equal(isClosed(eat(d, 6, 59, 59), c), true);
    assert.equal(isClosed(eat(d, 7, 0, 0), c), false);
  }
});

test('next opening is always the coming 07:00 EAT', () => {
  assert.equal(nextAt(eat(10, 0, 0), c.open, c), eat(10, 7));
  assert.equal(nextAt(eat(10, 6, 59, 59), c.open, c), eat(10, 7));
  assert.equal(nextAt(eat(10, 7, 0), c.open, c), eat(11, 7));
  assert.equal(nextAt(eat(10, 23, 30), c.open, c), eat(11, 7));
  assert.equal(nextAt(eat(30, 23), c.open, c), Date.UTC(2026, 11, 1, 4)); // month end
  assert.equal(nextAt(eat(10, 20), c.close, c), eat(11, 0));
  assert.equal(openLabel(eat(10, 7), c), 'Talaado, 10 Nofembar 2026 · 7:00 subaxnimo (EAT)');
});

test('other schedules and the off switch', () => {
  const late = config({ OPEN: '07:00', CLOSE: '23:00' });
  assert.ok(isClosed(eat(10, 23, 30), late) && isClosed(eat(10, 3), late) && !isClosed(eat(10, 12), late));
  assert.ok(!isClosed(eat(10, 3), config({ CLOSURE: 'off' })));
});

test('at night a public page is a 503 with Retry-After and the branded page; the origin is never asked', async () => {
  let asked = 0;
  const r = await handle(page('/war/some-story/'), {}, eat(10, 2, 30), async () => { asked++; return site(); });
  assert.equal(r.status, 503);
  assert.equal(asked, 0);
  assert.equal(r.headers.get('retry-after'), String(4.5 * 3600));
  assert.equal(r.headers.get('cache-control'), 'no-store');
  const html = await r.text();
  assert.ok(html.includes('Wartabiye TV hadda waa xiran yahay. Waxaan dib u furmaynaa 7:00 subaxnimo. Mahadsanid.'));
  assert.ok(html.includes(`data-open="${eat(10, 7)}"`));
  assert.ok(html.includes('<b id="h">04</b>') && html.includes('<b id="m">30</b>'));
  assert.ok(html.includes('/img/logo.png') && html.includes('#037BDC') && html.includes('#F2060A'));
  assert.ok(!/noindex/.test(html));
  const head = await handle(page('/', { method: 'HEAD' }), {}, eat(10, 0, 0), site);
  assert.equal(head.status, 503);
  const post = await handle(page('/', { method: 'POST', body: 'x' }), {}, eat(10, 5), site);
  assert.equal(post.status, 503);
});

test('query strings, odd paths and the apex domain cannot get past the closed page', async () => {
  for (const p of ['/?nocache=1', '/index.html', '/war/x/index.html?amp', '/assets/app.js', '/data/../index.html', '/ADMIN/', '/admin.html', '/img/news/a.jpg']) {
    const r = await handle(page(p), {}, eat(10, 3), site);
    assert.equal(r.status, 503, p);
  }
  const apex = await handle(new Request('https://wartabiyetv.com/'), {}, eat(10, 3), site);
  assert.equal(apex.status, 503);
});

test('machine files keep working at night (search engines, collectors, admin entrance)', async () => {
  for (const p of ['/robots.txt', '/sitemap.xml', '/rss.xml', '/data/news.json', '/data/schedule.json', '/data/world/fast-status.json',
    '/admin/', '/admin', '/img/logo.png', '/sw.js', '/google66aa3d4bcb5c3ead.html']) {
    assert.ok(exempt(p), p);
    const r = await handle(page(p), {}, eat(10, 3), site);
    assert.equal(r.status, 200, p);
  }
  assert.ok(!exempt('/data/news.html') && !exempt('/war/') && !exempt('/'));
});

test('daytime pages pass through unchanged, and HTML is never cached past midnight', async () => {
  const day = await handle(page('/'), {}, eat(10, 12), site);
  assert.equal(day.status, 200);
  assert.equal(await day.text(), '<h1>site</h1>');
  assert.equal(day.headers.get('cache-control'), 'public, max-age=600');
  const late = await handle(page('/'), {}, eat(10, 23, 58), site);
  assert.equal(late.headers.get('cache-control'), 'public, max-age=120');
  const json = await handle(page('/data/news.json'), {}, eat(10, 23, 58), async () => new Response('{}', { headers: { 'content-type': 'application/json' } }));
  assert.equal(json.headers.get('cache-control'), null);
});

test('owner preview: only the right key gives a signed cookie, which then opens the site at night', async () => {
  const env = { OWNER_PREVIEW_KEY: 'k'.repeat(32) };
  const now = eat(10, 2);
  const wrong = await handle(page('/?furo=nope'), env, now, site);
  assert.equal(wrong.status, 503);
  const ok = await handle(page('/war/x/?furo=' + 'k'.repeat(32)), env, now, site);
  assert.equal(ok.status, 303);
  assert.equal(ok.headers.get('location'), '/war/x/');
  const cookie = ok.headers.get('set-cookie');
  assert.match(cookie, /HttpOnly; Secure; SameSite=Lax/);
  const val = cookie.split(';')[0];
  const r = await handle(page('/', { headers: { cookie: val } }), env, now + 60000, site);
  assert.equal(r.status, 200);
  const forged = val.replace(/.$/, (x) => (x === '0' ? '1' : '0'));
  assert.equal((await handle(page('/', { headers: { cookie: forged } }), env, now, site)).status, 503);
  const old = (await handle(page('/?furo=' + 'k'.repeat(32)), env, eat(9, 16), site)).headers.get('set-cookie').split(';')[0];
  assert.equal((await handle(page('/', { headers: { cookie: old } }), env, eat(10, 3), site)).status, 503); // 8 hours are over
  // without the secret configured, no key works
  assert.equal((await handle(page('/?furo=' + 'k'.repeat(32)), {}, now, site)).status, 503);
});
