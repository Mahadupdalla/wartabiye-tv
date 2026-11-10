// The installable web app ON THE LIVE WEBSITE (no local build):  node test/pwa-live.mjs [https://www.wartabiyetv.com/]
// Waits until GitHub Pages serves /app/, then checks in a phone-sized browser that
//  1. https://www.wartabiyetv.com/app/ opens and shows the website's newest headline (same data/news.json / api/v1)
//  2. a shared article link /app/war/<id> (forwarded by 404.html) opens that article, with its photo
//  3. the Somalia, World and Sports sections and LIVE News open with their own stories
//  4. the manifest, icons and service worker are published, so the browser offers "Add to Home screen"
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium, devices } = require('playwright');
const here = path.dirname(fileURLToPath(import.meta.url));
const BASE = (process.argv[2] || 'https://www.wartabiyetv.com/').replace(/\/?$/, '/');
const shots = path.join(here, 'output');
fs.mkdirSync(shots, { recursive: true });
const get = async u => { const r = await fetch(u + (u.includes('?') ? '&' : '?') + 't=' + Date.now()); return r; };

// GitHub Pages can take a few minutes after a merge
for (let i = 0; ; i++) {
  const r = await get(BASE + 'app/manifest.webmanifest');
  if (r.ok) break;
  if (i > 40) throw new Error('the web app is not published at ' + BASE + 'app/');
  await new Promise(res => setTimeout(res, 15000));
}
const news = (await (await get(BASE + 'data/news.json')).json()).news.filter(n => n.published !== false).sort((a, b) => (a.publishedAt < b.publishedAt ? 1 : -1));
const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices['Pixel 7'] });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', e => errors.push(e.message));
const results = [];
const step = async (name, fn) => { await fn(); results.push('PASS ' + name); console.log('• PASS', name); };
const seen = async (text, timeout = 30000) => page.getByText(text, { exact: false }).first().waitFor({ timeout });
try {
  await step('the web app on the live website shows the website\'s newest stories', async () => {
    await page.goto(BASE + 'app/', { waitUntil: 'domcontentloaded' });
    await Promise.any(news.slice(0, 5).map(n => seen(n.title.slice(0, 30))));
    await page.screenshot({ path: path.join(shots, 'pwa-live-home.png') });
  });
  await step('a shared article link /app/war/<id> opens the article with its photo', async () => {
    const a = news.find(n => n.image) || news[0];
    await page.goto(BASE + 'app/war/' + a.id, { waitUntil: 'domcontentloaded' });
    await seen(a.title.slice(0, 30));
    assert.match(page.url(), new RegExp('/app/war/' + a.id.replace(/[-]/g, '\\-')));
    await page.waitForFunction(src => [...document.images].some(i => i.src.includes(src.split('/').pop().replace(/\.\w+$/, '')) && i.complete), a.image, { timeout: 30000 });
    await page.screenshot({ path: path.join(shots, 'pwa-live-article.png') });
  });
  await step('Somalia, World and Sports sections and LIVE News open with their stories', async () => {
    const secOf = n => (['somalia', 'world', 'sports'].includes(n.section) ? n.section : n.category === 'Ciyaaraha' ? 'sports' : n.category === 'Adduunka' ? 'world' : 'somalia');
    for (const s of ['somalia', 'world', 'sports']) {
      await page.goto(BASE + 'app/section/' + s, { waitUntil: 'domcontentloaded' });
      await seen(news.find(n => secOf(n) === s && !n.sponsored).title.slice(0, 30));
    }
    await page.goto(BASE + 'app/live', { waitUntil: 'domcontentloaded' });
    const day = news.filter(n => Date.now() - Date.parse(n.publishedAt) < 24 * 3600e3 && !n.sponsored);
    if (day.length) await seen(day[0].title.slice(0, 30));
  });
  await step('installable: the page links its manifest, and the /app/ service worker is published', async () => {
    // (the app does not register its service worker in automated browsers, so the files are checked here)
    const m = await (await get(BASE + 'app/manifest.webmanifest')).json();
    assert.ok(m.name && m.start_url && m.icons?.length >= 2, 'manifest with name, start page and icons');
    const html = await (await get(BASE + 'app/')).text();
    assert.ok(/rel="manifest"/.test(html), 'manifest linked from /app/');
    const sw = await get(BASE + 'app/sw.js');
    assert.ok(sw.ok && /javascript/.test(sw.headers.get('content-type') || ''), 'service worker file');
    for (const ic of m.icons) assert.ok((await get(new URL(ic.src, BASE + 'app/').href)).ok, 'icon ' + ic.src);
  });
  assert.deepEqual(errors, [], 'no script errors');
  console.log('\n' + results.join('\n') + `\n\nThe web app at ${BASE}app/ works with the live website's news.`);
} catch (e) {
  await page.screenshot({ path: path.join(shots, 'pwa-live-failure.png') }).catch(() => undefined);
  console.error('\n' + results.join('\n') + '\nFAIL', e.message, errors.slice(0, 5));
  process.exitCode = 1;
} finally {
  await browser.close();
}
