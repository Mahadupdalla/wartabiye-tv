// Live check, run by admin-deploy.yml after a deploy: opens the real public website in a real browser with a one-time
// self-test token, reads an article, and checks that the website's counter reached the Worker. The visits are stored
// apart (day 0000-00-00) and deleted by the workflow straight after. Also checks that /admin/ on the website leads to
// the secure sign-in page. Usage: URL=https://…workers.dev SITE=https://www.wartabiyetv.com TOKEN=<32 hex> node live-check.mjs
import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'node:fs';

const { URL: W, SITE, TOKEN } = process.env;
const OUT = 'live-check'; mkdirSync(OUT, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const UA = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36';
const fail = m => { console.log('::error::' + m); process.exitCode = 1; };

const browser = await chromium.launch();
const ctx = await browser.newContext({ userAgent: UA, viewport: { width: 412, height: 860 }, locale: 'so-SO' });
const page = await ctx.newPage();
const beacons = [];
page.on('request', r => { if (r.url().startsWith(W + '/c')) beacons.push({ body: r.postData() }); });
page.on('response', r => { if (r.url().startsWith(W + '/c')) console.log('counter answered', r.status()); });

await page.goto(`${SITE}/?wtvselftest=${TOKEN}`, { waitUntil: 'load' });
await sleep(4000);
if (await page.locator('#wtvConsent, .wtv-consent').count()) fail('a consent pop-up is shown on the website');
else console.log('no consent pop-up on the website');
const art = await page.evaluate(() => {
  for (const a of document.querySelectorAll('a[href]')) {
    const m = a.getAttribute('href').match(/(?:#war-|war\/)([a-z0-9-]+?)(?:\.html)?$/);
    if (m) return m[1];
  }
  return '';
});
console.log('article used for the check:', art || '(none found)');
if (art) { await page.goto(`${SITE}/?wtvselftest=${TOKEN}#war-${art}`, { waitUntil: 'load' }); await sleep(5000); }
await page.screenshot({ path: `${OUT}/site.png` });
console.log('counter messages sent by the website:', JSON.stringify(beacons.map(b => JSON.parse(b.body || '{}')).map(({ t, ...rest }) => rest)));
if (!beacons.length) fail('the live website did not send anything to the counter');
writeFileSync(`${OUT}/article.txt`, art);

// /admin/ on the website must lead to the secure sign-in page of the Worker
const a = await ctx.newPage();
await a.goto(`${SITE}/admin/`, { waitUntil: 'load' });
await a.waitForURL(u => u.href.startsWith(W), { timeout: 20000 }).catch(() => {});
await sleep(1500);
const text = await a.textContent('body');
console.log('/admin/ ended at', a.url());
if (!a.url().startsWith(W)) fail('/admin/ on the website did not lead to the secure dashboard');
if (!/Sign in with GitHub|Secure sign-in is not set up yet/.test(text)) fail('the secure sign-in page did not show');
await a.screenshot({ path: `${OUT}/admin.png` });
await browser.close();
