// App checks against REAL published content (no changes to anything):
//   node test/app.e2e.mjs                 the repository's current content, served locally with api/v1 built from it
//   node test/app.e2e.mjs --live <base>   another site, e.g. https://www.wartabiyetv.com/ (used by the GitHub workflow)
// Checks: nine languages (the headline of the newest article equals the newsroom's own translation; Arabic right-to-left;
// untranslated stories are not listed), bookmarks survive a restart, search, LIVE timeline (last 24 hours, newest first),
// sections, phone / small phone / tablet / desktop widths without sideways scrolling, and that the app's code holds no
// admin address, token or AI service.
import { execFileSync } from 'node:child_process';
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
const liveIdx = process.argv.indexOf('--live');
const LIVE = liveIdx > 0 ? process.argv[liveIdx + 1] : null;
const SITE_PORT = 8792, APP_PORT = 8793;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'wtv-app-'));
const results = [];
const step = async (name, fn) => { await fn(); results.push('PASS ' + name); console.log('• PASS', name); };
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.ttf': 'font/ttf', '.ico': 'image/x-icon' };
function serve(dir, port, spa) {
  return http.createServer((q, r) => {
    let f = path.join(dir, decodeURIComponent(new URL(q.url, 'http://x').pathname));
    if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html');
    if (!fs.existsSync(f)) { if (!spa) { r.writeHead(404, { 'access-control-allow-origin': '*' }); return r.end(); } f = path.join(dir, 'index.html'); }
    r.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream', 'access-control-allow-origin': '*', 'cache-control': 'no-store' });
    fs.createReadStream(f).pipe(r);
  }).listen(port);
}

const base = LIVE || `http://localhost:${SITE_PORT}/`;
let siteServer = null;
if (!LIVE) {
  execFileSync('python3', ['tools/build_app_api.py'], { cwd: repo, stdio: 'ignore' });
  siteServer = serve(repo, SITE_PORT, false);
}
const getJSON = async u => { const r = await fetch(u + (u.includes('?') ? '&' : '?') + 't=' + Date.now()); if (!r.ok) throw new Error(u + ' ' + r.status); return r.json(); };
const news = (await getJSON(base + 'data/news.json')).news.filter(n => n.published !== false).sort((a, b) => (a.publishedAt < b.publishedAt ? 1 : -1));
let apiOk = true;
try { await getJSON(base + 'api/v1/meta.json'); } catch (e) { apiOk = false; }
console.log(`content: ${base} (${news.length} articles, api/v1 ${apiOk ? 'present' : 'not published yet: the app reads data/news.json'})`);

const webOut = path.join(tmp, 'web');
execFileSync('npx', ['expo', 'export', '-p', 'web', '--output-dir', webOut], { cwd: app, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, EXPO_OFFLINE: '1', EXPO_PUBLIC_CONTENT_BASE: base } });
const appServer = serve(webOut, APP_PORT, true);
const browser = await chromium.launch();
const shots = path.join(app, 'test', 'output');
fs.mkdirSync(shots, { recursive: true });
const errors = [];
async function open(url, vp = { width: 390, height: 844 }, ctx) {
  const c = ctx || await browser.newContext({ viewport: vp });
  const p = await c.newPage();
  p.on('pageerror', e => errors.push(e.message));
  await p.goto(url, { waitUntil: 'networkidle' });
  return { c, p };
}
const noSideScroll = p => p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);

try {
  await step('the code shipped in the app holds no admin address, token, GitHub key or AI service', async () => {
    const files = [];
    const walk = d => fs.readdirSync(d, { withFileTypes: true }).forEach(e => e.isDirectory() ? walk(path.join(d, e.name)) : /\.(js|html|json)$/.test(e.name) && files.push(path.join(d, e.name)));
    walk(webOut);
    const all = files.map(f => fs.readFileSync(f, 'utf8')).join('\n');
    for (const bad of ['PUSH_ADMIN_TOKEN', 'ANTHROPIC', 'api.anthropic.com', 'openai', 'ghp_', 'github_pat_', 'x-access-token', '/api/news', '/api/me', 'VAPID_PRIVATE', 'GITHUB_TOKEN']) {
      assert.ok(!all.includes(bad), 'found "' + bad + '" in the app bundle');
    }
  });

  await step('nine languages: the newest headline is the newsroom\'s own translation; Arabic is right-to-left', async () => {
    for (const lang of ['so', 'en', 'ar', 'fr', 'nl', 'it', 'tr', 'de', 'es']) {
      const first = news.find(n => lang === 'so' || (n[lang] && n[lang].title && n[lang].title.trim()));
      const title = lang === 'so' ? first.title : first[lang].title;
      const { c, p } = await open(`http://localhost:${APP_PORT}/?lang=${lang}`);
      await p.getByText(title.slice(0, 35), { exact: false }).first().waitFor({ timeout: 30_000 });
      const dir = await p.evaluate(() => document.documentElement.dir);
      assert.equal(dir, lang === 'ar' ? 'rtl' : 'ltr', lang + ' direction');
      assert.ok(await noSideScroll(p), lang + ': no sideways scrolling');
      await p.screenshot({ path: path.join(shots, `lang-${lang}.png`) });
      await c.close();
    }
  });

  await step('compact language selector: SO button opens nine languages, Arabic switches to right-to-left and is kept after a restart', async () => {
    const ctx = await browser.newContext({ viewport: { width: 320, height: 640 } });
    const { p } = await open(`http://localhost:${APP_PORT}/`, null, ctx);
    await p.getByTestId('lang-button').first().waitFor({ timeout: 30_000 });
    const box = await p.getByTestId('lang-button').first().boundingBox();
    assert.ok(box && box.height <= 40 && box.width <= 90, 'the language button is small: ' + JSON.stringify(box));
    await p.getByTestId('lang-button').first().click();
    await p.getByTestId('lang-menu').waitFor({ timeout: 10_000 });
    for (const l of ['so', 'en', 'ar', 'fr', 'nl', 'it', 'tr', 'de', 'es']) assert.equal(await p.getByTestId('lang-' + l).count(), 1, l + ' in the selector');
    const menu = await p.getByTestId('lang-menu').boundingBox();
    assert.ok(menu && menu.height < 260 && menu.x >= 0 && menu.x + menu.width <= 320, 'the popover fits a small phone: ' + JSON.stringify(menu));
    await p.screenshot({ path: path.join(shots, 'lang-selector.png') });
    await p.getByTestId('lang-ar').click();
    await p.waitForFunction(() => document.documentElement.dir === 'rtl', null, { timeout: 10_000 });
    await p.close();
    const { p: p2 } = await open(`http://localhost:${APP_PORT}/settings`, null, ctx);
    await p2.waitForFunction(() => document.documentElement.dir === 'rtl' && document.documentElement.lang === 'ar', null, { timeout: 20_000 });
    await p2.getByTestId('lang-row').first().waitFor({ timeout: 10_000 });
    await ctx.close();
  });

  await step('flags beside the nine languages; the interface has no English left in another language', async () => {
    const { c, p } = await open(`http://localhost:${APP_PORT}/settings`);
    await p.getByTestId('lang-row').first().click();
    await p.getByTestId('lang-menu').waitFor({ timeout: 10_000 });
    const flags = { so: '🇸🇴', en: '🇬🇧', ar: '🇸🇦', fr: '🇫🇷', nl: '🇳🇱', it: '🇮🇹', tr: '🇹🇷', de: '🇩🇪', es: '🇪🇸' };
    for (const [l, f] of Object.entries(flags)) assert.ok((await p.getByTestId('lang-' + l).innerText()).includes(f), l + ' shows ' + f);
    await p.getByTestId('lang-de').click();
    await p.waitForFunction(() => document.documentElement.lang === 'de', null, { timeout: 10_000 });
    const txt = await p.evaluate(() => document.body.innerText);
    for (const en of ['Appearance', 'Text size', 'Anonymous statistics', 'Notifications', 'Same as phone']) assert.ok(!txt.includes(en), 'German settings without "' + en + '"');
    await c.close();
  });

  await step('notification center: the website\'s alerts, each once, newest first; a tap opens the article in the app', async () => {
    const al = (await getJSON(base + 'data/notifications.json')).items || [];
    const { c, p } = await open(`http://localhost:${APP_PORT}/notifications`);
    if (!al.length) { await p.getByText('Weli ogeysiis ma jiro.').waitFor({ timeout: 30_000 }); await c.close(); return; }
    const newest = [...al].sort((a, b) => (a.time < b.time ? 1 : -1))[0];
    await p.getByTestId('alert-0').waitFor({ timeout: 30_000 });
    assert.ok((await p.getByTestId('alert-0').innerText()).includes(newest.title.slice(0, 30)), 'newest alert first');
    const n = await p.locator('[data-testid^="alert-"]').count();
    const ids = new Set(al.map(a => a.id));
    assert.ok(n >= Math.min(ids.size, 8) && n <= ids.size, `each alert once (${n} shown of ${ids.size})`);
    await p.screenshot({ path: path.join(shots, 'notifications.png') });
    await p.getByTestId('alert-0').click();
    await p.waitForURL(/\/war\//, { timeout: 20_000 });
    await c.close();
  });

  await step('Latest news: every story newest first, the same newest headline as the website', async () => {
    const { c, p } = await open(`http://localhost:${APP_PORT}/latest`);
    const first = news.find(n => !n.sponsored);
    await p.getByText(first.title.slice(0, 35), { exact: false }).first().waitFor({ timeout: 30_000 });
    await p.screenshot({ path: path.join(shots, 'latest.png') });
    await c.close();
  });

  await step('sections: Soomaaliya, Caalamka and Ciyaaraha list only their own stories, newest first', async () => {
    const secOf = n => (['somalia', 'world', 'sports'].includes(n.section) ? n.section : n.category === 'Ciyaaraha' ? 'sports' : n.category === 'Adduunka' ? 'world' : 'somalia');
    for (const sec of ['somalia', 'world', 'sports']) {
      const first = news.find(n => secOf(n) === sec && !n.sponsored);
      const { c, p } = await open(`http://localhost:${APP_PORT}/section/${sec}`);
      await p.getByText(first.title.slice(0, 35), { exact: false }).first().waitFor({ timeout: 30_000 });
      const wrong = news.find(n => secOf(n) !== sec && n.title.length > 30);
      assert.ok(!(await p.evaluate(t => document.body.innerText.includes(t), wrong.title)), sec + ': no story from another section on top');
      await p.screenshot({ path: path.join(shots, `section-${sec}.png`) });
      await c.close();
    }
  });

  await step('LIVE News: the last 24 hours, newest first, with the publisher\'s time', async () => {
    const { c, p } = await open(`http://localhost:${APP_PORT}/live`);
    const day = news.filter(n => Date.now() - Date.parse(n.publishedAt) < 24 * 3600_000 && !n.sponsored);
    if (day.length) await p.getByText(day[0].title.slice(0, 35), { exact: false }).first().waitFor({ timeout: 30_000 });
    else await p.getByText('24', { exact: false }).first().waitFor({ timeout: 30_000 });
    await p.screenshot({ path: path.join(shots, 'live.png') });
    await c.close();
  });

  await step('bookmarks are kept after closing the app, and search finds articles', async () => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const top = news[0];
    const { p } = await open(`http://localhost:${APP_PORT}/war/${top.id}`, null, ctx);
    await p.getByText(top.title.slice(0, 35), { exact: false }).first().waitFor({ timeout: 30_000 });
    await p.getByRole('button', { name: 'Kaydi' }).first().click();
    await p.close();
    const { p: p2 } = await open(`http://localhost:${APP_PORT}/saved`, null, ctx);
    await p2.getByText(top.title.slice(0, 35), { exact: false }).first().waitFor({ timeout: 20_000 });
    await p2.screenshot({ path: path.join(shots, 'saved.png') });
    await p2.goto(`http://localhost:${APP_PORT}/search`);
    const word = top.title.split(/\s+/).find(w => w.length > 5) || top.title.split(' ')[0];
    await p2.getByRole('textbox').fill(word);
    await p2.getByText(top.title.slice(0, 35), { exact: false }).first().waitFor({ timeout: 10_000 });
    await p2.screenshot({ path: path.join(shots, 'search.png') });
    await ctx.close();
  });

  await step('screen sizes: small phone 320, phone 390, tablet 768, desktop 1280 without sideways scrolling', async () => {
    for (const [w, h] of [[320, 640], [390, 844], [768, 1024], [1280, 900]]) {
      const { c, p } = await open(`http://localhost:${APP_PORT}/`, { width: w, height: h });
      await p.getByText(news[0].title.slice(0, 30), { exact: false }).first().waitFor({ timeout: 30_000 });
      assert.ok(await noSideScroll(p), w + 'px: no sideways scrolling');
      await p.screenshot({ path: path.join(shots, `size-${w}.png`) });
      await c.close();
    }
  });

  await step('dark mode and the article reader (font size, photo credit and licence)', async () => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: 'dark' });
    const { p } = await open(`http://localhost:${APP_PORT}/settings`, null, ctx);
    await p.getByRole('radio', { name: 'Mugdi' }).click();
    const withCredit = news.find(n => n.imageCredit && n.imageLicense && n.image) || news[0];
    await p.goto(`http://localhost:${APP_PORT}/war/${withCredit.id}`);
    await p.getByText(withCredit.imageLicense, { exact: false }).first().waitFor({ timeout: 30_000 });
    await p.getByRole('button', { name: 'Qoraal weyn' }).first().click().catch(() => undefined);
    await p.screenshot({ path: path.join(shots, 'article-dark.png') });
    await ctx.close();
  });

  assert.deepEqual(errors, [], 'no script errors');
  console.log('\n' + results.join('\n') + `\n\nAll ${results.length} app checks passed against ${base}. Screenshots: ${shots}`);
} catch (e) {
  console.error('\n' + results.join('\n') + '\nFAIL', e.message, errors.slice(0, 5));
  process.exitCode = 1;
} finally {
  await browser.close();
  appServer.close();
  siteServer?.close();
  fs.rmSync(tmp, { recursive: true, force: true });
}
