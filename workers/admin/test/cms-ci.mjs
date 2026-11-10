// Publishing tool check against the REAL repository, run in GitHub Actions (admin-cms-check.yml).
// The real Worker runs locally (wrangler dev) and the real publishing tool runs in a real browser. GitHub sign-in is a
// stand-in, because a person's sign-in cannot be automated; every GitHub API call (REST and GraphQL) is forwarded to
// the real api.github.com with the workflow's own short-lived token (GH_TOKEN), so the tool loads the live content.
//   GH_TOKEN=… node test/cms-ci.mjs <out-dir>         read-only unless WRITE_TEST=1
import http from 'node:http';
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { totpAt } from '../src/util.js';
const require = createRequire(import.meta.url);
const { chromium, devices } = require('playwright');

const HERE = dirname(fileURLToPath(import.meta.url)), ADMIN = join(HERE, '..');
const OUT = process.argv[2] || join(ADMIN, '.cms-ci'); mkdirSync(OUT, { recursive: true });
const W = 'http://localhost:8787', GH = 'http://localhost:8790';
const TOKEN = process.env.GH_TOKEN, REPO = process.env.REPO || 'Mahadupdalla/wartabiye-tv';
if (!TOKEN) { console.error('GH_TOKEN missing'); process.exit(2); }
const sleep = ms => new Promise(r => setTimeout(r, ms));
const fails = [], check = (ok, what) => { console.log((ok ? 'PASS ' : 'FAIL ') + what); if (!ok) fails.push(what); };

// ---- GitHub stand-in --------------------------------------------------------------------------------------------------
const calls = [];
http.createServer(async (req, res) => {
  const u = new URL(req.url, GH);
  const body = await new Promise(r => { const c = []; req.on('data', d => c.push(d)); req.on('end', () => r(Buffer.concat(c))); });
  const send = (s, obj) => { res.writeHead(s, { 'content-type': 'application/json' }); res.end(JSON.stringify(obj)); };
  if (u.pathname === '/login/oauth/authorize') { res.writeHead(302, { location: `${u.searchParams.get('redirect_uri')}?code=ci&state=${u.searchParams.get('state')}` }); return res.end(); }
  if (u.pathname === '/login/oauth/access_token') return send(200, { access_token: 'ghu_ci_local', expires_in: 28800, refresh_token: 'ghr_ci' });
  if (u.pathname.startsWith('/applications/')) { res.writeHead(204); return res.end(); }
  if (req.headers.authorization !== 'Bearer ghu_ci_local') return send(401, { message: 'no server token' });
  // the workflow token is an app token: /user does not exist for it, so answer as the repository owner
  if (u.pathname === '/user') return send(200, { login: 'Mahadupdalla', id: 216855903, name: 'Mahad', avatar_url: 'https://avatars.githubusercontent.com/u/216855903?v=4' });
  const isWrite = req.method !== 'GET' && !(u.pathname === '/graphql' && !/\bmutation\b/.test(body.toString()));
  if (isWrite && process.env.WRITE_TEST !== '1') { calls.push(`${req.method} ${u.pathname} -> 403 (read-only test)`); return send(403, { message: 'read-only test' }); }
  const r = await fetch('https://api.github.com' + u.pathname + u.search, {
    method: req.method, body: ['GET', 'HEAD'].includes(req.method) ? undefined : body,
    headers: { authorization: 'Bearer ' + TOKEN, accept: req.headers.accept || 'application/vnd.github+json', 'content-type': req.headers['content-type'] || 'application/json', 'user-agent': 'wartabiye-cms-ci' },
  });
  let buf = Buffer.from(await r.arrayBuffer());
  if (u.pathname.toLowerCase() === `/repos/${REPO.toLowerCase()}` && r.ok) {
    const j = JSON.parse(buf); j.permissions = { admin: true, maintain: true, push: true, triage: true, pull: true }; buf = Buffer.from(JSON.stringify(j));
  }
  let note = '';
  if (u.pathname === '/graphql') { try { const j = JSON.parse(buf); if (j.errors) note = ' errors=' + JSON.stringify(j.errors).slice(0, 300); } catch {} }
  calls.push(`${req.method} ${u.pathname} -> ${r.status}${r.status >= 400 ? ' ' + buf.toString().slice(0, 200) : ''}${note}`);
  res.writeHead(r.status, { 'content-type': r.headers.get('content-type') || 'application/json' }); res.end(buf);
}).listen(8790);

// ---- the Worker -------------------------------------------------------------------------------------------------------
const vars = { GITHUB_WEB: GH, GITHUB_API: GH, GITHUB_CLIENT_ID: 'Iv1.ci', GITHUB_CLIENT_SECRET: 'ci-secret', SESSION_SECRET: 'ci-'.repeat(16) };
const wr = (args, opts = {}) => spawn(join(ADMIN, 'node_modules', '.bin', 'wrangler'), args, { cwd: ADMIN, env: { ...process.env, WRANGLER_SEND_METRICS: 'false', CLOUDFLARE_API_TOKEN: '', CLOUDFLARE_ACCOUNT_ID: '' }, ...opts });
await new Promise((ok, no) => wr(['d1', 'migrations', 'apply', 'wartabiye-admin', '--local'], { stdio: 'inherit' }).on('exit', c => c ? no(new Error('migrations ' + c)) : ok()));
const dev = wr(['dev', '--port', '8787', '--ip', '127.0.0.1', ...Object.entries(vars).flatMap(([k, v]) => ['--var', `${k}:${v}`])]);
let devLog = ''; dev.stdout.on('data', d => devLog += d); dev.stderr.on('data', d => devLog += d);
for (let i = 0; i < 90; i++) { try { if ((await fetch(W + '/health')).ok) break; } catch {} await sleep(1000); }

const browser = await chromium.launch();
const errs = [];
async function signIn(ctx) {
  const p = await ctx.newPage();
  p.on('dialog', d => d.accept());
  p.on('pageerror', e => errs.push('pageerror ' + e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto(W + '/'); await p.click('#signin'); await p.waitForURL(W + '/mfa');
  const secret = (await p.locator('.mono').textContent()).replace(/\s/g, '');
  await p.fill('#code', await totpAt(secret, Math.floor(Date.now() / 30000)));
  await p.waitForLoadState(); await sleep(800);
  if (await p.locator('button[type=submit]').count()) { await p.click('button[type=submit]').catch(() => {}); await p.waitForLoadState(); }
  await p.click('a.btn.primary'); await p.waitForSelector('.kpi .val', { timeout: 30000 }).catch(() => {});
  return p;
}
const SITE = 'https://www.wartabiyetv.com/';
const ghApi = (method, path, body) => fetch('https://api.github.com' + path, { method, body: body && JSON.stringify(body), headers: { authorization: 'Bearer ' + TOKEN, accept: 'application/vnd.github+json', 'user-agent': 'wartabiye-cms-ci' } });
// a push made with the workflow token does not start other workflows, so the test starts the website rebuild itself
// (a save made by the owner in the real dashboard starts it on its own)
async function rebuild(after) {
  for (let i = 0; i < 30; i++) {
    const c = await (await ghApi('GET', `/repos/${REPO}/commits/main`)).json();
    if (c.sha && c.sha !== after) break;
    await sleep(2000);
  }
  const r = await ghApi('POST', `/repos/${REPO}/actions/workflows/publish.yml/dispatches`, { ref: 'main' });
  console.log('website rebuild started:', r.status);
}
const mainSha = async () => (await (await ghApi('GET', `/repos/${REPO}/commits/main`)).json()).sha;
async function liveTitle(id) {
  const j = await (await fetch(SITE + 'data/news.json?cb=' + Date.now(), { cache: 'no-store' })).json().catch(() => ({}));
  const a = (j.news || []).find(x => x.id === id);
  const page = await (await fetch(SITE + 'war/' + id + '.html?cb=' + Date.now())).text().catch(() => '');
  return { feed: a && a.title, page };
}
async function waitTracker(p, label) {
  const t0 = Date.now();
  for (let i = 0; i < 180; i++) {                                   // up to 30 min
    const done = await p.locator('#pubTrack a.btn.primary').isVisible().catch(() => false);
    const err = await p.locator('#pubTrack .pt-err').textContent().catch(() => '');
    if (done || err) { console.log(`${label}: tracker ${done ? 'says visible on the website' : 'error: ' + err} after ${Math.round((Date.now() - t0) / 1000)} s`); return done; }
    if (i % 6 === 0) console.log(`${label}: ` + ((await p.locator('#pubTrack .pt-note').textContent().catch(() => '')) || '…'));
    await sleep(10000);
  }
  return false;
}
async function editTitle(p, id, to) {
  await p.goto(W + '/#articles?edit=' + encodeURIComponent(id)); await p.waitForSelector('.editor', { timeout: 90000 }); await sleep(500);
  const t = p.locator('.ed-main input').first();
  const was = await t.inputValue(); await t.fill(to);
  const before = await mainSha();
  await p.click('.ed-bar button:text-is("Update")');
  await p.waitForSelector('#pubTrack:not([hidden])', { timeout: 60000 }).catch(() => {});
  const err = await p.locator('.ed-errs').innerText().catch(() => '');
  if (err.trim()) console.log('editor says: ' + err.trim());
  return { was, before };
}
try {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 950 } });
  const p = await signIn(ctx);
  const news = JSON.parse(readFileSync(join(ADMIN, '..', '..', 'data', 'news.json'), 'utf8')).news;

  // 1. the dashboard's own Articles screen reads the real website files
  let t0 = Date.now();
  await p.goto(W + '/#articles');
  await p.waitForSelector('.arow', { timeout: 120000 }).catch(() => {});
  const rows = await p.locator('.arow').count(), heroTxt = await p.locator('#v-native .hero p').first().textContent().catch(() => '');
  console.log(`Articles screen after ${Math.round((Date.now() - t0) / 1000)} s: ${rows} rows shown; "${heroTxt}"`);
  check(rows >= 20 && /\d{3,} articles/.test(heroTxt), 'Articles screen lists the real articles');
  const listTxt = await p.locator('#v-native').innerText();
  check(news.slice(0, 5).some(n => listTxt.includes(n.title)), 'newest real headlines are in the Articles list');
  await p.screenshot({ path: join(OUT, 'native-articles-desktop.png') });
  await p.fill('.toolbar input[type=search]', news[3].title.split(' ').slice(0, 3).join(' ')); await sleep(500);
  check(await p.locator('.arow').count() >= 1, 'search finds a real article');
  for (const v of ['media', 'homepage', 'sports', 'world']) {
    await p.goto(W + '/#' + v); await sleep(1500); await p.waitForSelector('#v-native .card', { timeout: 60000 }).catch(() => {});
    await sleep(1500); await p.screenshot({ path: join(OUT, `native-${v}.png`) });
    check(!(await p.locator('#v-native .banner.bad').count()), `${v} screen opens without an error`);
  }

  // 2. the Full editor (publishing tool) still lists the real articles
  await p.goto(W + '/#editor');
  const fr = p.frameLocator('#cmsFrame');
  t0 = Date.now();
  const titles = news.map(n => n.title).filter(t => t && t.length > 12);   // any real headline: the editor's own sort order decides which are on screen
  let found = '';
  for (let i = 0; i < 120 && !found; i++) {
    const t = await fr.locator('body').innerText().catch(() => '');
    found = titles.find(x => t.includes(x)) || '';
    if (!found) await sleep(1000);
  }
  console.log(`Full editor list shown after ${Math.round((Date.now() - t0) / 1000)} s: ${found ? 'yes' : 'no'}`);
  await sleep(1500); await p.screenshot({ path: join(OUT, 'cms-articles-desktop.png') });
  if (!found) console.log('editor shows: ' + (await fr.locator('body').innerText().catch(e => 'unreadable: ' + e.message)).replace(/\s+/g, ' ').slice(0, 2500) + '\n  hidden: ' + await p.locator('#v-cms').isHidden().catch(() => '?'));
  check(!!found, 'Full editor lists the real articles');
  check(!(await fr.locator('#wtvRetry').isVisible().catch(() => false)), 'no "Could not connect to GitHub" screen');

  // 1b. the control centre screens with the real data
  const txt = async () => (await p.locator('#v-native').innerText().catch(() => '')).replace(/\s+/g, ' ');
  await p.goto(W + '/#dashboard'); await p.waitForSelector('#v-native .kpi .val', { timeout: 60000 }).catch(() => {}); await sleep(9000);
  let T = await txt();
  check(/Website Online/.test(T), 'Overview: wartabiyetv.com shows as online');
  check(/Published articles \d{3,}/.test(T), 'Overview: real published-article count');
  check(/Last successful deployment \d+ (min|h|days?) ago|just now/.test(T), 'Overview: last deployment from GitHub Actions');
  check(/Regular news Every 3 hours/.test(T) && /08:00 and 18:00/.test(T), 'Overview: publishing schedule (3-hourly news, sports 08:00/18:00)');
  await p.screenshot({ path: join(OUT, 'c-overview.png'), fullPage: true });
  for (const r of ['Yesterday', '7 days', '30 days']) { await p.click(`.rangebar button:text-is("${r}")`); await sleep(1500); }
  check(/Visitors \d/.test(await txt()), 'Overview: visitor numbers for the chosen period');
  await p.goto(W + '/#automation'); await p.waitForSelector('#v-native table', { timeout: 60000 }).catch(() => {}); await sleep(3000); T = await txt();
  const jobs = await p.locator('#v-native .card').first().locator('tbody tr').count().catch(() => 0);
  check(/Regular news \(Claude task\)/.test(T) && (await p.locator('#v-native tbody tr').count()) >= 10, 'Automation: every job listed with its state');
  check(/Discovered \d/.test(T) && /Rejected \d/.test(T), 'Automation: discovered, published and rejected counts');
  await p.screenshot({ path: join(OUT, 'c-automation.png'), fullPage: true });
  for (const [v, re, what] of [['sections', /Published \d+/, 'Sections: numbers per section'], ['live', /Automatic writer (On|Off)/, 'LIVE News: status and timeline'], ['ads', /Google AdSense/, 'Advertising: AdSense state and adverts'],
    ['health', /Sitemap \d[\d,]* pages/, 'SEO & health: sitemap read from the live site'], ['settings', /Navigation menu/, 'Website settings: real settings loaded']]) {
    await p.goto(W + '/#' + v); await sleep(3000);
    for (let i = 0; i < 20 && !re.test(T = await txt()); i++) await sleep(1500);
    check(re.test(T) && !/Could not load this data/.test(T), what);
    await p.screenshot({ path: join(OUT, 'c-' + v + '.png'), fullPage: true });
  }
  await p.fill('#gsearch', news[2].title.split(' ').slice(0, 2).join(' ')); await sleep(800);
  check(await p.locator('#gresults .gr').count() >= 1, 'admin-wide search finds a real article');
  await p.screenshot({ path: join(OUT, 'c-search.png') }); await p.fill('#gsearch', '');

  // 3. mobile
  const m = await browser.newContext({ ...devices['iPhone 13'] });
  await m.addCookies(await ctx.cookies());
  const mp = await m.newPage(); await mp.goto(W + '/#articles'); await mp.waitForSelector('.arow', { timeout: 120000 }).catch(() => {}); await sleep(1000);
  await mp.screenshot({ path: join(OUT, 'native-articles-mobile.png') });
  check(await mp.locator('.arow').count() >= 20, 'Articles screen works on a phone');
  check(await mp.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'no sideways scrolling on a phone');
  await mp.locator('.arow .btn.primary').first().click(); await mp.waitForSelector('.editor').catch(() => {}); await sleep(600);
  await mp.screenshot({ path: join(OUT, 'native-editor-mobile.png') });
  for (const v of ['dashboard', 'automation', 'live', 'health', 'settings']) {
    await mp.goto(W + '/#' + v); await sleep(6000); await mp.screenshot({ path: join(OUT, 'm-' + v + '.png'), fullPage: true });
    check(await mp.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${v}: no sideways scrolling on a phone`);
  }

  // 4. the real, reversible edit-and-publish test on wartabiyetv.com
  if (process.env.WRITE_TEST === '1') {
    const art = news.find((n, i) => i >= 8 && n.image && n.imageAlt && !n.breaking) || news[8];
    const id = art.id, original = art.title, changed = original + ' (tijaabo)';
    console.log(`\nWRITE TEST on "${id}"\n  original headline: ${original}`);
    const e1 = await editTitle(p, id, changed);
    check(e1.was === original, 'editor shows the real headline');
    await rebuild(e1.before);
    const live1 = await waitTracker(p, 'edit');
    const L1 = await liveTitle(id);
    check(live1, 'dashboard reports the change as visible on wartabiyetv.com');
    check(L1.feed === changed && L1.page.includes(changed), 'wartabiyetv.com really shows the changed headline (news feed and article page)');
    await p.goto(SITE + 'war/' + id + '.html?cb=' + Date.now()).catch(() => {}); await sleep(2500); await p.screenshot({ path: join(OUT, 'write-1-live-changed.png') });
    const mp2 = await m.newPage(); await mp2.goto(SITE + 'war/' + id + '.html?cb=' + Date.now()).catch(() => {}); await sleep(2500); await mp2.screenshot({ path: join(OUT, 'write-1-live-changed-mobile.png') });
    // reopen the dashboard: it shows the saved change
    await p.goto(W + '/'); await sleep(500);
    await p.goto(W + '/#articles?edit=' + encodeURIComponent(id)); await p.waitForSelector('.editor', { timeout: 90000 }); await sleep(500);
    check(await p.locator('.ed-main input').first().inputValue() === changed, 'reopened dashboard shows the saved headline');
    // revert
    await p.locator('#pubTrack .iconbtn').click().catch(() => {});
    const e2 = await editTitle(p, id, original);
    await rebuild(e2.before);
    const live2 = await waitTracker(p, 'revert');
    const L2 = await liveTitle(id);
    check(live2 && L2.feed === original && L2.page.includes(original) && !L2.page.includes(changed), 'headline restored on wartabiyetv.com');
    await p.goto(SITE + 'war/' + id + '.html?cb=' + Date.now()).catch(() => {}); await sleep(2500); await p.screenshot({ path: join(OUT, 'write-2-live-restored.png') });
    // nothing else in the article changed: compare the file with the version before the test
    const file = async ref => JSON.parse(Buffer.from((await (await ghApi('GET', `/repos/${REPO}/contents/data/news/${id}.json?ref=${ref}`)).json()).content, 'base64').toString());
    const [a0, a2] = [await file(e1.before), await file('main')];
    const norm = o => JSON.stringify(Object.keys(o).sort().map(k => [k, o[k]]));
    if (norm(a0) !== norm(a2)) console.log('before: ' + JSON.stringify(a0) + '\nafter:  ' + JSON.stringify(a2));
    check(norm(a0) === norm(a2), 'article file identical to before the test');

    // replace the article's photo with a new upload, see it live, then restore the earlier version from the history
    const live = async () => { const j = await (await fetch(SITE + 'data/news.json?cb=' + Date.now(), { cache: 'no-store' })).json().catch(() => ({})); return (j.news || []).find(x => x.id === id) || {}; };
    const origImage = (await live()).image;
    const png = Buffer.from(await p.evaluate(() => { const c = document.createElement('canvas'); c.width = 1280; c.height = 720; const g = c.getContext('2d');
      const gr = g.createLinearGradient(0, 0, 1280, 720); gr.addColorStop(0, '#04213f'); gr.addColorStop(1, '#037BDC'); g.fillStyle = gr; g.fillRect(0, 0, 1280, 720);
      g.fillStyle = '#fff'; g.font = 'bold 72px sans-serif'; g.fillText('Wartabiye TV', 80, 330); g.font = '40px sans-serif'; g.fillText('Tijaabo sawir ' + new Date().toISOString().slice(0, 16), 80, 410);
      return c.toDataURL('image/png').split(',')[1]; }), 'base64');
    await p.goto(W + '/'); await p.goto(W + '/#articles?edit=' + encodeURIComponent(id)); await p.waitForSelector('.editor', { timeout: 90000 }); await sleep(500);
    const [fc] = await Promise.all([p.waitForEvent('filechooser'), p.click('.ed-photo button:has-text("Replace")')]);
    await fc.setFiles({ name: 'tijaabo.png', mimeType: 'image/png', buffer: png });
    await p.waitForSelector('.modal .crop-cv'); await p.locator('.modal label.chk input').check(); await p.click('.modal button:text-is("Use this photo")'); await sleep(1500);
    const imgBefore = await mainSha();
    await p.click('.ed-bar button:text-is("Update")');
    await p.waitForSelector('#pubTrack:not([hidden])', { timeout: 60000 }).catch(() => {});
    const e3 = (await p.locator('.ed-errs').innerText().catch(() => '')).trim(); if (e3) console.log('editor says: ' + e3);
    await rebuild(imgBefore);
    const live3 = await waitTracker(p, 'photo');
    const L3 = await live();
    check(live3 && L3.image && L3.image !== origImage && /^img\/news\//.test(L3.image), 'replaced photo is live on wartabiyetv.com (' + L3.image + ')');
    const ph = await (await fetch(SITE + L3.image + '?cb=' + Date.now())).arrayBuffer().catch(() => new ArrayBuffer(0));
    check(ph.byteLength > 5000, 'the new photo file itself loads from wartabiyetv.com');
    await p.goto(SITE + 'war/' + id + '.html?cb=' + Date.now()).catch(() => {}); await sleep(2500); await p.screenshot({ path: join(OUT, 'write-3-live-photo.png') });
    // restore the earlier version (recovery) from the article history
    await p.goto(W + '/'); await p.goto(W + '/#articles?edit=' + encodeURIComponent(id)); await p.waitForSelector('ol.hist li', { timeout: 90000 }); await sleep(500);
    await p.screenshot({ path: join(OUT, 'write-4-history.png'), fullPage: true });
    await p.locator('#pubTrack .iconbtn').click().catch(() => {});
    const rsBefore = await mainSha();
    await p.locator('ol.hist li').nth(1).locator('button:text-is("Restore this version")').click();
    await p.waitForSelector('#pubTrack:not([hidden])', { timeout: 60000 }).catch(() => {});
    await rebuild(rsBefore);
    const live4 = await waitTracker(p, 'restore');
    const L4 = await live();
    check(live4 && L4.image === origImage && L4.title === original, 'earlier version restored on wartabiyetv.com (original photo and headline)');
    check(norm(a0) === norm(await file('main')), 'article file identical to before the photo test');
    // the test photo is now unused: delete it from the Media Library
    const testName = L3.image.split('/').pop();
    await p.goto(W + '/'); await p.goto(W + '/#media'); await p.waitForSelector('.mcard', { timeout: 90000 }); await sleep(500);
    await p.fill('.toolbar input[type=search]', testName.slice(0, -5)); await sleep(600);
    await p.locator('.mcard', { hasText: testName }).locator('button:text-is("Delete")').click(); await sleep(8000);
    const gone = (await ghApi('GET', `/repos/${REPO}/contents/${L3.image}?ref=main`)).status === 404;
    check(gone, 'unused test photo deleted from the website files');

    // homepage: pin a story, see it in the live homepage settings, unpin it
    const S0 = await (await fetch(SITE + 'data/site.json?cb=' + Date.now())).json();
    const f0 = JSON.stringify(S0.featured || []);
    // the newest story: without pins it already leads the homepage, so readers barely notice the test
    const pinId = news.find(n => !(S0.featured || []).some(f => (typeof f === 'string' ? f : f.article) === n.id) && n.image).id;
    async function pinToggle(label) {
      await p.goto(W + '/'); await p.goto(W + '/#articles'); await p.waitForSelector('.arow', { timeout: 90000 });
      await p.fill('.toolbar input[type=search]', pinId); await sleep(600);
      const b = await mainSha();
      await p.locator('.arow').first().locator('button:has-text("' + label + '")').click();
      await p.waitForSelector('#pubTrack:not([hidden])', { timeout: 60000 }).catch(() => {});
      await rebuild(b);
      return waitTracker(p, label);
    }
    await p.locator('#pubTrack .iconbtn').click().catch(() => {});
    const pin1 = await pinToggle('Pin to homepage');
    const S1 = await (await fetch(SITE + 'data/site.json?cb=' + Date.now())).json();
    check(pin1 && (S1.featured || []).some(f => (typeof f === 'string' ? f : f.article) === pinId), 'pinned story is in the live homepage settings');
    await p.goto(SITE + '?cb=' + Date.now()).catch(() => {}); await sleep(3000); await p.screenshot({ path: join(OUT, 'write-5-live-home-pinned.png') });
    await p.locator('#pubTrack .iconbtn').click().catch(() => {});
    const pin2 = await pinToggle('Unpin');
    const S2 = await (await fetch(SITE + 'data/site.json?cb=' + Date.now())).json();
    check(pin2 && JSON.stringify(S2.featured || []) === f0, 'homepage pins back exactly as before');
  }
} catch (e) { console.error(e); fails.push(String(e)); }
finally {
  writeFileSync(join(OUT, 'github-calls.txt'), calls.join('\n'));
  console.log('\nGitHub calls (' + calls.length + '), failures and samples:');
  for (const c of calls.filter(c => / -> [45]\d\d|errors=/.test(c)).slice(0, 40)) console.log('  ' + c);
  const counts = {}; for (const c of calls) { const k = c.replace(/\/contents\/.*? /, '/contents/… ').replace(/ -> (\d+).*/, ' -> $1'); counts[k] = (counts[k] || 0) + 1; }
  console.log(Object.entries(counts).map(([k, v]) => `  ${v} × ${k}`).join('\n'));
  console.log('\nbrowser errors:\n  ' + errs.slice(0, 30).join('\n  '));
  if (fails.length) console.log('\nWorker log (tail):\n' + devLog.slice(-4000));
  await browser.close(); dev.kill('SIGINT');
  console.log(fails.length ? `\n${fails.length} FAILED` : '\nALL PASSED'); process.exit(fails.length ? 1 : 0);
}
