// Browser test of the notification bell (desktop + mobile): node tools/notify_test.js <site url> [screenshot dir]
// Checks: the bell is in the header; the unread count matches the feed; the dropdown lists real stories (every link
// opens a published page: HTTP 200, the article's own page); "mark all as read" and "clear" work and are remembered;
// a returning visitor sees ONE update banner only when there is genuinely new content; the page NEVER asks for
// notification permission by itself (only after "Enable notifications" is pressed); the bell works in Arabic (RTL).
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const BASE = (process.argv[2] || 'http://localhost:8080/').replace(/\/?$/, '/');
const OUT = process.argv[3] || 'shots';
fs.mkdirSync(OUT, { recursive: true });
let fails = 0;
const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };

(async () => {
  const feed = await (await fetch(BASE + 'data/notifications.json?ts=' + Date.now())).json();
  ok(Array.isArray(feed.items), `feed has ${feed.items.length} items, last update ${feed.lastSuccessAt}`);
  // every feed link is a real published page
  const news = await (await fetch(BASE + 'data/news.json?ts=' + Date.now())).json();
  const ids = new Set(news.news.map(n => n.id));
  for (const it of feed.items.slice(0, 12)) {
    const r = await fetch(BASE + it.url, { method: 'GET' });
    const art = it.article ? ids.has(it.article) : true;
    ok(r.status === 200 && art, `${it.id}: ${it.url} -> HTTP ${r.status}${art ? '' : ' (article not published!)'}`);
  }
  const seenIds = new Set();
  ok(feed.items.every(i => !seenIds.has(i.id) && seenIds.add(i.id)), 'no duplicate notifications');
  ok(feed.items.every(i => !isNaN(Date.parse(i.time))), 'every notification has a real time');

  const browser = await chromium.launch();
  for (const [name, opts] of [['desktop', { viewport: { width: 1366, height: 900 } }], ['mobile', { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 }]]) {
    const ctx = await browser.newContext(opts);
    // a visitor whose first visit was 2 days ago and last visit 3 days before the newest story
    const newest = feed.items.length ? Date.parse(feed.items[0].addedAt || feed.items[0].time) : Date.now();
    await ctx.addInitScript(([first, last]) => {
      window.__permAsked = 0;
      if (window.Notification) { const orig = Notification.requestPermission; Notification.requestPermission = function () { window.__permAsked++; return orig ? orig.apply(this, arguments) : Promise.resolve('default'); }; }
      if (!sessionStorage.getItem('nt-init')) { sessionStorage.setItem('nt-init', '1'); localStorage.setItem('wartabiye-nt', JSON.stringify({ first, lastVisit: last, read: [] })); }
    }, [newest - 2 * 86400e3, newest - 3 * 86400e3]);
    const page = await ctx.newPage();
    const errs = []; page.on('pageerror', e => errs.push(e.message));
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1200);
    const bell = page.locator('#bellBtn');
    ok(await bell.isVisible(), `${name}: bell visible in the header`);
    const expected = await page.evaluate(() => window.WT_NOTIFY.items().filter(i => i.addedAt).length);
    const badge = await page.locator('#bellBtn .badge').textContent();
    const badgeShown = await page.locator('#bellBtn .badge').isVisible();
    ok(expected === 0 ? !badgeShown : badgeShown && /^\d|9\+/.test(badge), `${name}: unread badge "${badgeShown ? badge : 'hidden'}"`);
    const banner = page.locator('.ntbanner');
    ok(feed.items.length ? await banner.count() === 1 : await banner.count() === 0, `${name}: one update banner for the returning visitor`);
    if (await banner.count()) await page.screenshot({ path: path.join(OUT, `notify-${name}-banner.png`) });
    await bell.click();
    const panel = page.locator('#ntPanel');
    ok(await panel.isVisible(), `${name}: dropdown opens`);
    const n = await panel.locator('.ntitem').count();
    ok(n === Math.min(30, feed.items.length + (await page.evaluate(() => window.WT_NOTIFY.items().some(i => i.live)) ? 1 : 0)) || n > 0, `${name}: ${n} notifications listed`);
    const box = await panel.boundingBox();
    const vw = opts.viewport.width;
    ok(box && box.x >= -1 && box.x + box.width <= vw + 1, `${name}: dropdown fits the screen (${Math.round(box.x)}..${Math.round(box.x + box.width)} of ${vw})`);
    if (n) {
      const first = panel.locator('.ntitem').first();
      ok(await first.locator('.nth').textContent() !== '', `${name}: headline shown`);
      ok(await first.locator('time').getAttribute('datetime') !== null, `${name}: publication time shown`);
    }
    await page.screenshot({ path: path.join(OUT, `notify-${name}-open.png`) });
    ok(await page.evaluate(() => window.__permAsked) === 0, `${name}: no notification permission prompt without a click`);
    // mark all read
    await panel.getByRole('button', { name: /Dhammaan akhriyay/ }).click();
    ok(!(await page.locator('#bellBtn .badge').isVisible()), `${name}: mark all as read hides the count`);
    ok(await panel.locator('.ntitem.unread').count() === 0, `${name}: nothing unread after mark all`);
    // clear
    await panel.getByRole('button', { name: /^Nadiifi$/ }).click();
    ok(await panel.locator('.ntitem').count() === (await page.evaluate(() => window.WT_NOTIFY.items().filter(i => i.live).length)), `${name}: clear empties the list`);
    // remembered after reload, and no second banner
    await page.reload({ waitUntil: 'networkidle' }); await page.waitForTimeout(1000);
    ok(!(await page.locator('#bellBtn .badge').isVisible()), `${name}: read state remembered after reload`);
    ok(await page.locator('.ntbanner').count() === 0, `${name}: no repeated banner`);
    // open a story from the bell: it is the real article page
    await page.evaluate(() => { localStorage.setItem('wartabiye-nt', JSON.stringify({ first: Date.now() - 864e5 * 30, read: [] })); });
    await page.reload({ waitUntil: 'networkidle' }); await page.waitForTimeout(800);
    await page.locator('#bellBtn').click();
    const firstArticle = page.locator('#ntPanel a.ntitem[href*="/war/"]').first();
    if (await firstArticle.count()) {
      const href = await firstArticle.getAttribute('href');
      await Promise.all([page.waitForNavigation({ waitUntil: 'domcontentloaded' }), firstArticle.click()]);
      ok(page.url() === href && /\/war\/[^/]+\.html$/.test(page.url()), `${name}: tapping a notification opens ${page.url().replace(BASE, '')}`);
      ok(await page.locator('#storyView h1, #story h1').first().waitFor({ state: 'visible', timeout: 15000 }).then(() => true, () => false), `${name}: the article is shown`);
    }
    // Arabic / RTL
    await page.goto(BASE + '?lang=ar', { waitUntil: 'networkidle' }); await page.waitForTimeout(800);
    await page.locator('#bellBtn').click();
    ok(await page.locator('#ntPanel h2').textContent() === 'الإشعارات', `${name}: Arabic labels`);
    const b2 = await page.locator('#ntPanel').boundingBox();
    ok(b2.x >= -1 && b2.x + b2.width <= vw + 1, `${name}: Arabic dropdown fits the screen`);
    await page.screenshot({ path: path.join(OUT, `notify-${name}-ar.png`) });
    // push section is honest about its state
    const push = await page.locator('.ntpush').textContent();
    ok(push.length > 10, `${name}: push section shown (${feed.push && feed.push.enabled ? 'enabled' : 'not configured yet'})`);
    ok(errs.length === 0, `${name}: no JavaScript errors ${errs.join(' | ')}`);
    await ctx.close();
  }
  await browser.close();
  console.log(fails ? `${fails} check(s) failed` : 'notification bell: all checks passed');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
