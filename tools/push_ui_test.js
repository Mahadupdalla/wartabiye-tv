// Browser check of the push settings in the bell, with a mocked push service (no real keys, nothing is sent).
// Usage (from the repository root, site served locally): node tools/push_ui_test.js http://localhost:8765/ <screenshot dir>
const { chromium } = require('playwright');
const fs = require('fs');
const BASE = process.argv[2] || 'http://localhost:8765/', SHOTS = process.argv[3] || '.';
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 800 } });
  await ctx.grantPermissions(['notifications'], { origin: new URL(BASE).origin });
  const calls = [], errs = [];
  await ctx.addInitScript(() => {
    const fake = { endpoint: 'https://fcm.googleapis.com/fcm/send/test', toJSON() { return { endpoint: this.endpoint, keys: { p256dh: 'BAAA', auth: 'AAA' } }; }, unsubscribe: () => Promise.resolve(true) };
    let have = null, perm = 'default';
    Object.defineProperty(Notification, 'permission', { get: () => perm });
    Notification.requestPermission = () => { window.__asked = (window.__asked||0)+1; perm = 'granted'; return Promise.resolve(perm); };
    PushManager.prototype.getSubscription = function () { return Promise.resolve(have); };
    PushManager.prototype.subscribe = function (o) { window.__opts = o; have = fake; return Promise.resolve(fake); };
  });
  await ctx.route('**/data/notifications.json*', async r => {
    const j = JSON.parse(fs.readFileSync('data/notifications.json', 'utf8'));
    j.push = { ...j.push, enabled: true, workerUrl: 'https://push.example.workers.dev/', publicKey: 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U' };
    r.fulfill({ contentType: 'application/json', body: JSON.stringify(j) });
  });
  await ctx.route('https://push.example.workers.dev/**', async r => {
    const body = JSON.parse(r.request().postData() || '{}'); calls.push({ path: new URL(r.request().url()).pathname, body });
    const c = (body.categories || []).concat('breaking');
    r.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ ok: true, categories: c, freq: body.freq }) });
  });
  const p = await ctx.newPage(); p.on('pageerror', e => errs.push(String(e)));
  await p.goto(BASE); await p.waitForTimeout(1500);
  await p.click('#bellBtn'); await p.waitForTimeout(300);
  const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };
  ok(await p.locator('.ntpush .ntbtn').isVisible(), 'enable button shown');
  ok(!(await p.evaluate(() => window.__asked)), 'no permission request before the click');
  await p.screenshot({ path: SHOTS + '/push-off.png' });
  const bb = await p.evaluate(() => { const e = document.querySelector('.ntpanel'); const r = e.getBoundingClientRect(); return r.bottom <= innerHeight; }); ok(bb, 'bell panel fits the phone screen');
  await p.locator('.ntpush .ntbtn').scrollIntoViewIfNeeded(); await p.click('.ntpush .ntbtn'); await p.waitForTimeout(1500);
  const s1 = calls.find(c => c.path === '/v1/subscribe');
  ok(s1 && s1.body.lang === 'so' && s1.body.freq === 'digest' && s1.body.categories.length === 5, 'subscribe sends categories, language, frequency ' + JSON.stringify(s1 && s1.body));
  ok(await p.locator('.ntpush .ntall input').isVisible(), 'All News checkbox shown');
  ok(await p.locator('.ntpush .ntall input').isChecked(), 'All News on by default');
  ok(await p.locator('.ntfreq input').count() === 3, 'three frequency choices');
  await p.locator('.ntfreq').scrollIntoViewIfNeeded(); await p.screenshot({ path: SHOTS + '/push-on.png' });
  calls.length = 0;
  await p.locator('.ntfreq input[value=all]').check(); await p.waitForTimeout(800);
  ok(calls.some(c => c.path === '/v1/subscribe' && c.body.freq === 'all'), 'frequency change saved');
  calls.length = 0;
  await p.locator('.ntcats label:not(.ntall) input').first().uncheck(); await p.waitForTimeout(800);
  ok(calls.some(c => c.path === '/v1/subscribe' && c.body.categories.length === 4), 'category change saved');
  ok(!(await p.locator('.ntpush .ntall input').isChecked()), 'All News unticked after removing a category');
  calls.length = 0;
  await p.evaluate(() => { document.documentElement.lang = 'en'; }); await p.waitForTimeout(2500);
  ok(calls.some(c => c.path === '/v1/subscribe' && c.body.lang === 'en'), 'language change resubscribes in English');
  calls.length = 0;
  await p.click('.ntpush .ntlink'); await p.waitForTimeout(800);
  ok(calls.some(c => c.path === '/v1/unsubscribe'), 'disable unsubscribes');
  ok(errs.length === 0, 'no JavaScript errors ' + errs.join(' | '));
  await b.close();
})();
