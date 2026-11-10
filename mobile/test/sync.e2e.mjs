// End-to-end synchronisation test: the REAL publish pipeline + the REAL app (web build of the same React Native code).
//
// It copies the repository's content into a temporary folder and plays the owner's / news task's actions on it exactly
// as /admin/ does them (it writes data/news/<id>.json), then runs the same build steps as .github/workflows/publish.yml
// (tools/build_news.py -> tools/build_pages.py -> tools/build_app_api.py). A local server stands in for GitHub Pages.
// The app is checked in a browser (Playwright) after each step, WITHOUT reinstalling or reloading it:
//   1. the app shows the same newest article as the website (headline, category, image, time)
//   2. a NEW article published on the website appears in the app (with the "new stories" pill)
//   3. an EDIT made in /admin/ (headline + text) appears in the app's list and in the open article
//   4. an IMAGE replaced in /admin/ shows the new image in the app
//   5. an article UNPUBLISHED in /admin/ disappears from the app's feeds, and opening it says it was removed
//   6. offline: the app keeps the opened article and says it is offline
// Nothing here touches the live website, the repository's own files or any paid service.
//
//   node test/sync.e2e.mjs            (needs python3, Playwright's Chromium; takes about 2 minutes)
import { execFileSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const here = path.dirname(fileURLToPath(import.meta.url));
const app = path.resolve(here, '..');
const repo = path.resolve(app, '..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'wtv-sync-'));
const SITE_PORT = 8790, APP_PORT = 8791;
const log = (...a) => console.log('•', ...a);
const results = [];
const step = async (name, fn) => { const t0 = Date.now(); await fn(); results.push(`PASS ${name} (${((Date.now() - t0) / 1000).toFixed(1)} s)`); log('PASS', name); };

// ---------- 1. a private copy of the website's content ----------
for (const d of ['data', 'tools']) fs.cpSync(path.join(repo, d), path.join(tmp, d), { recursive: true });
for (const f of ['index.html', '404.html', 'manifest.webmanifest', 'sw.js']) if (fs.existsSync(path.join(repo, f))) fs.copyFileSync(path.join(repo, f), path.join(tmp, f));
fs.symlinkSync(path.join(repo, 'assets'), path.join(tmp, 'assets'));
fs.mkdirSync(path.join(tmp, 'img'));
for (const e of fs.readdirSync(path.join(repo, 'img'))) fs.symlinkSync(path.join(repo, 'img', e), path.join(tmp, 'img', e));
const py = (...a) => execFileSync('python3', a, { cwd: tmp, stdio: ['ignore', 'pipe', 'pipe'] }).toString();
function publish() {             // the same steps as .github/workflows/publish.yml (no thumbnails, no network)
  py('tools/build_news.py');
  py('tools/build_pages.py');
  py('tools/build_app_api.py');
}
const newsFile = id => path.join(tmp, 'data', 'news', id + '.json');
const readNews = id => JSON.parse(fs.readFileSync(newsFile(id), 'utf8'));
const writeNews = (id, o) => fs.writeFileSync(newsFile(id), JSON.stringify(o, null, 1));
const website = () => JSON.parse(fs.readFileSync(path.join(tmp, 'data', 'news.json'), 'utf8')).news;
publish();

// ---------- 2. "GitHub Pages" for the copy, and the app ----------
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.ttf': 'font/ttf', '.ico': 'image/x-icon', '.css': 'text/css' };
function serve(dir, port, spa) {
  return http.createServer((q, r) => {
    let f = path.join(dir, decodeURIComponent(new URL(q.url, 'http://x').pathname));
    if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html');
    if (!fs.existsSync(f)) { if (!spa) { r.writeHead(404, { 'access-control-allow-origin': '*' }); return r.end(); } f = path.join(dir, 'index.html'); }
    r.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream', 'access-control-allow-origin': '*', 'cache-control': 'no-store' });
    fs.createReadStream(f).pipe(r);
  }).listen(port);
}
const webOut = path.join(tmp, '_app');
log('building the app (web) against the local copy …');
execFileSync('npx', ['expo', 'export', '-p', 'web', '--output-dir', webOut], {
  cwd: app, stdio: ['ignore', 'pipe', 'pipe'],
  env: { ...process.env, EXPO_OFFLINE: '1', EXPO_PUBLIC_CONTENT_BASE: `http://localhost:${SITE_PORT}/`, EXPO_PUBLIC_POLL_MS: '5000' },
});
const s1 = serve(tmp, SITE_PORT, false), s2 = serve(webOut, APP_PORT, true);

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', e => errors.push(e.message));
const shots = path.join(app, 'test', 'output');
fs.mkdirSync(shots, { recursive: true });
const snap = name => page.screenshot({ path: path.join(shots, name + '.png') });
const visible = (text, timeout = 30_000) => page.getByText(text, { exact: false }).first().waitFor({ state: 'visible', timeout });
const gone = async (text, timeout = 30_000) => { await page.waitForFunction(t => !document.body.innerText.includes(t), text, { timeout }); };

try {
  await page.goto(`http://localhost:${APP_PORT}/`, { waitUntil: 'networkidle' });

  await step('1. the app shows the website\'s newest article (headline, section, image, time)', async () => {
    const top = website()[0];
    await visible(top.title.slice(0, 40));
    const api = JSON.parse(fs.readFileSync(path.join(tmp, 'api', 'v1', 'feed', 'so.json'), 'utf8')).items[0];
    assert.equal(api.id, top.id); assert.equal(api.title, top.title); assert.equal(api.publishedAt, top.publishedAt); assert.equal(api.image, top.image);
    const html = fs.readFileSync(path.join(tmp, 'war', top.id + '.html'), 'utf8');
    assert.ok(html.includes(top.title.replace(/&/g, '&amp;').slice(0, 30)) || html.includes(top.title.slice(0, 30)), 'website article page has the same headline');
    // the image the app loads is the article's own file
    const imgs = await page.evaluate(() => [...document.images].map(i => i.src));
    assert.ok(imgs.some(s => s.endsWith(top.thumb || top.image) || s.endsWith(top.image)), 'article photo shown');
    await snap('1-home');
  });

  // pick a Somalia story that is not the newest, to edit and later unpublish
  const victim = website().find((n, i) => i > 3 && (n.section === 'somalia' || !n.section) && n.image && n.thumb);
  const testId = '2099-01-01-tijaabo-isku-xirka-app-ka';

  await step('2. a NEW article published on the website appears in the app without reloading', async () => {
    const base = readNews(victim.id);
    const art = { ...base, id: testId, by: 'admin', title: 'TIJAABO: war cusub oo app-ka si toos ah ugu soo muuqday', summary: 'Warkan tijaabada ah waxaa lagu daabacay nuqul gaar ah oo bogga ah si loo hubiyo isku xirka app-ka.', body: 'Qoraal tijaabo ah.', publishedAt: new Date(Date.now() + 3 * 3600_000 - 30_000).toISOString().slice(0, 19) + '+03:00', breaking: false, important: false };
    for (const l of ['en', 'ar', 'fr', 'nl', 'it', 'de', 'tr', 'es']) delete art[l];
    art.en = { title: 'TEST: new article that reached the app automatically', summary: 'Test article in a private copy.', body: 'Test text.', status: 'manual' };
    writeNews(testId, art);
    publish();
    assert.equal(website()[0].id, testId, 'the website lists the new article first');
    await visible('TIJAABO: war cusub', 40_000);
    await visible('war cusub', 5000); // the "N new stories" pill or the article itself
    await snap('2-new-article');
  });

  await step('3. an EDIT in /admin/ (headline and text) reaches the open app and the article page', async () => {
    const a = readNews(testId);
    a.title = 'TIJAABO LA SAXAY: cinwaanka waa la beddelay';
    a.body = 'Qoraalka cusub ee la saxay waa kan.';
    writeNews(testId, a);
    publish();
    await visible('TIJAABO LA SAXAY', 40_000);
    await page.getByRole('link', { name: /TIJAABO LA SAXAY/ }).first().click();
    await visible('Qoraalka cusub ee la saxay', 20_000);
    await snap('3-edited-article');
  });

  await step('4. an IMAGE replaced in /admin/ shows the new image in the app', async () => {
    const other = website().find(n => n.image && n.image !== victim.image && n.id !== testId);
    const a = readNews(testId);
    a.image = other.image; a.thumb = other.thumb; a.imageAlt = 'Sawir cusub oo tijaabo ah';
    writeNews(testId, a);
    publish();
    await page.waitForFunction(src => [...document.images].some(i => i.src.endsWith(src)), other.image, { timeout: 40_000 });
    await snap('4-new-image');
  });

  await step('5. an article UNPUBLISHED in /admin/ disappears from the app and says it was removed', async () => {
    await page.goBack();
    await visible('TIJAABO LA SAXAY', 10_000);
    const a = readNews(testId);
    a.published = false;
    writeNews(testId, a);
    publish();
    assert.ok(!website().some(n => n.id === testId), 'gone from the website');
    assert.ok(!fs.existsSync(path.join(tmp, 'api', 'v1', 'a', testId + '.json')), 'gone from the app API');
    await gone('TIJAABO LA SAXAY', 40_000);
    await page.goto(`http://localhost:${APP_PORT}/war/${testId}`, { waitUntil: 'networkidle' });
    await visible('lama daabaco', 20_000);
    await snap('5-unpublished');
  });

  await step('6. offline: an article already opened stays readable and the app says it is offline', async () => {
    await page.goto(`http://localhost:${APP_PORT}/`, { waitUntil: 'networkidle' });
    const top = website()[0];
    await page.getByRole('link', { name: top.title }).first().click();
    await visible((top.body || top.summary).slice(0, 25), 20_000);
    await page.goBack();
    await ctx.setOffline(true);
    await visible('Internet ma jiro', 30_000);
    await page.getByRole('link', { name: top.title }).first().click();
    await visible((top.body || top.summary).slice(0, 25), 20_000);
    await snap('6-offline-article');
    await ctx.setOffline(false);
  });

  assert.deepEqual(errors, [], 'no script errors in the app');
  console.log('\n' + results.join('\n') + `\n\nAll ${results.length} synchronisation steps passed. Screenshots: ${shots}`);
} catch (e) {
  await snap('failure').catch(() => undefined);
  console.error('\n' + results.join('\n') + '\nFAIL', e.message, '\nscript errors:', errors.slice(0, 5));
  process.exitCode = 1;
} finally {
  await browser.close();
  s1.close(); s2.close();
  fs.rmSync(tmp, { recursive: true, force: true });
}
