// Quick local look at the content screens (articles, editor, media, homepage) on this computer. GitHub GraphQL is
// not reachable here, so the stand-in answers the content query from the local checkout; writes are kept in memory.
//   node test/content-local.mjs <out-dir>
import http from 'node:http';
import { spawn } from 'node:child_process';
import { readFileSync, readdirSync, statSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { totpAt } from '../src/util.js';
const require = createRequire(import.meta.url);
const { chromium, devices } = require('playwright');
const HERE = dirname(fileURLToPath(import.meta.url)), ADMIN = join(HERE, '..'), ROOT = join(ADMIN, '..', '..');
const OUT = process.argv[2] || join(ADMIN, '.content-local'); mkdirSync(OUT, { recursive: true });
const W = 'http://localhost:8787', GH = 'http://localhost:8790';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const sha = b => createHash('sha1').update(Buffer.concat([Buffer.from('blob ' + b.length + '\0'), b])).digest('hex');
const writes = [];
function tree(dir, text) {
  const p = join(ROOT, dir); if (!existsSync(p)) return null;
  return { entries: readdirSync(p).map(name => { const f = join(p, name), st = statSync(f), isF = st.isFile(); const b = isF ? readFileSync(f) : null;
    return { name, oid: isF ? sha(b) : 'tree', type: isF ? 'blob' : 'tree', object: isF ? (text ? { text: b.toString() } : { byteSize: b.length }) : {} }; }) };
}
http.createServer(async (req, res) => {
  const u = new URL(req.url, GH);
  const body = await new Promise(r => { const c = []; req.on('data', d => c.push(d)); req.on('end', () => r(Buffer.concat(c))); });
  const send = (s, o) => { res.writeHead(s, { 'content-type': 'application/json' }); res.end(JSON.stringify(o)); };
  if (u.pathname === '/login/oauth/authorize') { res.writeHead(302, { location: `${u.searchParams.get('redirect_uri')}?code=x&state=${u.searchParams.get('state')}` }); return res.end(); }
  if (u.pathname === '/login/oauth/access_token') return send(200, { access_token: 'ghu_local', expires_in: 28800, refresh_token: 'r' });
  if (u.pathname.startsWith('/applications/')) { res.writeHead(204); return res.end(); }
  if (u.pathname === '/user') return send(200, { login: 'Mahadupdalla', id: 216855903, name: 'Mahad' });
  if (/^\/repos\/[^/]+\/[^/]+$/.test(u.pathname)) return send(200, { full_name: 'Mahadupdalla/wartabiye-tv', permissions: { admin: true, push: true } });
  if (u.pathname === '/graphql') {
    const q = JSON.parse(body.toString()).query;
    const bl = [...q.matchAll(/(b\d+):object\(oid:"([^"]+)"\)/g)];
    if (bl.length) {
      const byOid = {}; for (const d of ['data/news', 'data/trash/news']) for (const e of (tree(d, true) || { entries: [] }).entries) byOid[e.oid] = e.object.text;
      return send(200, { data: { repository: Object.fromEntries(bl.map(([, k, oid]) => [k, byOid[oid] != null ? { text: byOid[oid] } : null])) } });
    }
    const al = [...q.matchAll(/(f\d+):object\(expression:"([^"]+)"\)/g)];
    if (al.length) {   // files(): main = this checkout, live-data = data/live-feeds
      const repository = {};
      for (const [, k, ex] of al) {
        const [ref, path] = ex.split(/:(.*)/s);
        const local = ref === 'live-data' ? join('data', 'live-feeds', path) : path;
        const f = join(ROOT, local);
        if (!existsSync(f)) { repository[k] = null; continue; }
        if (statSync(f).isDirectory()) { repository[k] = tree(local, true); continue; }
        const b = readFileSync(f); repository[k] = { oid: sha(b), text: b.toString() };
      }
      return send(200, { data: { repository } });
    }
    const s = readFileSync(join(ROOT, 'data', 'site.json'));
    return send(200, { data: { repository: { ref: { target: { oid: 'localhead' } }, news: tree('data/news', true), trash: tree('data/trash/news', true), site: { oid: sha(s), text: s.toString() }, imgs: tree('img/news', false) } } });
  }
  if (req.method !== 'GET') {
    writes.push(req.method + ' ' + u.pathname + ' ' + body.toString().slice(0, 300));
    if (u.pathname.endsWith('/git/blobs')) return send(201, { sha: 'b' + writes.length });
    if (u.pathname.endsWith('/git/trees')) return send(201, { sha: 't' + writes.length });
    if (u.pathname.endsWith('/git/commits')) return send(201, { sha: 'c' + writes.length });
    if (/\/git\/refs\/heads\/main$/.test(u.pathname)) return send(200, { object: { sha: 'c' } });
    return send(403, { message: 'local' });
  }
  if (/\/git\/ref\/heads\/main$/.test(u.pathname)) return send(200, { object: { sha: 'localhead' } });
  if (/\/git\/commits\//.test(u.pathname)) return send(200, { tree: { sha: 'localtree' } });
  const m = u.pathname.match(/\/contents\/(.+)$/);
  if (m) { const f = join(ROOT, decodeURIComponent(m[1])); return existsSync(f) ? send(200, { sha: sha(readFileSync(f)) }) : send(404, { message: 'Not Found' }); }
  if (/\/actions\/workflows$/.test(u.pathname)) return send(200, { workflows: readdirSync(join(ROOT, '.github', 'workflows')).map((f, i) => ({ id: i + 1, name: f.replace('.yml', ''), path: '.github/workflows/' + f, state: f === 'live-status.yml' ? 'disabled_manually' : 'active', html_url: 'https://github.com/x' })) });
  if (/\/actions\/runs$/.test(u.pathname)) return send(200, { workflow_runs: [{ id: 9, name: 'Daabac bogga (publish)', path: '.github/workflows/publish.yml', status: 'completed', conclusion: 'success', created_at: new Date(Date.now() - 6e5).toISOString(), updated_at: new Date(Date.now() - 4e5).toISOString(), html_url: 'https://github.com/x', display_title: 'test', run_attempt: 1 },
    { id: 8, name: 'feeds', path: '.github/workflows/world-feeds.yml', status: 'completed', conclusion: 'failure', created_at: new Date(Date.now() - 9e5).toISOString(), updated_at: new Date(Date.now() - 8e5).toISOString(), html_url: 'https://github.com/x', display_title: 't', run_attempt: 2 }] });
  if (/\/commits$/.test(u.pathname)) return send(200, [{ html_url: 'https://github.com/x', commit: { message: 'Maamul: wax ka beddel', author: { name: 'Mahad', date: new Date().toISOString() } } }]);
  if (/actions\/workflows\/publish.yml\/runs/.test(u.pathname)) return send(200, { workflow_runs: [{ created_at: new Date().toISOString(), status: 'in_progress', run_started_at: new Date().toISOString() }] });
  return send(200, {});
}).listen(8790);
const vars = { GITHUB_WEB: GH, GITHUB_API: GH, GITHUB_CLIENT_ID: 'Iv1.l', GITHUB_CLIENT_SECRET: 's', SESSION_SECRET: 'local-'.repeat(8) };
const wr = (args, o = {}) => spawn(join(ADMIN, 'node_modules', '.bin', 'wrangler'), args, { cwd: ADMIN, env: { ...process.env, WRANGLER_SEND_METRICS: 'false' }, ...o });
const PERSIST = join(OUT, 'state-' + Date.now());
await new Promise((ok, no) => wr(['d1', 'migrations', 'apply', 'wartabiye-admin', '--local', '--persist-to', PERSIST]).on('exit', c => c ? no(new Error('mig')) : ok()));
const dev = wr(['dev', '--port', '8787', '--ip', '127.0.0.1', '--persist-to', PERSIST, ...Object.entries(vars).flatMap(([k, v]) => ['--var', `${k}:${v}`])]);
let log = ''; dev.stdout.on('data', d => log += d); dev.stderr.on('data', d => log += d);
for (let i = 0; i < 60; i++) { try { if ((await fetch(W + '/health')).ok) break; } catch {} await sleep(1000); }
const browser = await chromium.launch();
const errs = [];
try {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 950 } });
  const p = await ctx.newPage();
  p.on('pageerror', e => errs.push('pageerror ' + e.message)); p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|wartabiyetv/.test(m.text())) errs.push(m.text()); });
  p.on('dialog', d => d.accept());
  await p.goto(W + '/'); await p.click('#signin'); await p.waitForURL(W + '/mfa');
  const secret = (await p.locator('.mono').textContent()).replace(/\s/g, '');
  await p.fill('#code', await totpAt(secret, Math.floor(Date.now() / 30000))); await p.waitForLoadState(); await sleep(800);
  if (await p.locator('button[type=submit]').count()) { await p.click('button[type=submit]').catch(() => {}); await p.waitForLoadState(); }
  await p.click('a.btn.primary'); await sleep(1500);
  await p.goto(W + '/#articles'); await p.waitForSelector('.arow', { timeout: 20000 }); await sleep(800);
  console.log('rows', await p.locator('.arow').count());
  await p.screenshot({ path: join(OUT, 'a1-articles.png') });
  await p.fill('.toolbar input[type=search]', 'kenya'); await sleep(400); console.log('kenya rows', await p.locator('.arow').count());
  await p.locator('.arow .btn.primary').first().click(); await p.waitForSelector('.editor'); await sleep(500);
  await p.screenshot({ path: join(OUT, 'a2-editor.png'), fullPage: true });
  const t = p.locator('.ed-main input').first(); await t.fill((await t.inputValue()) + ' (test)');
  await p.click('.ed-bar button:text-is("Preview")'); await sleep(400);
  await p.click('.ed-bar button:text-is("Update")'); await sleep(2500);
  await p.screenshot({ path: join(OUT, 'a3-saved.png') });
  console.log('tracker:', await p.locator('#pubTrack').innerText().catch(() => '-'));
  console.log('writes:', writes.map(w => w.slice(0, 140)).join('\n  '));
  await p.goto(W + '/#media'); await p.waitForSelector('.mcard', { timeout: 20000 }); await sleep(500); await p.screenshot({ path: join(OUT, 'a4-media.png') });
  await p.goto(W + '/#homepage'); await p.waitForSelector('.pins', { timeout: 20000 }); await sleep(500); await p.screenshot({ path: join(OUT, 'a5-home.png'), fullPage: true });
  await p.goto(W + '/#articles?new'); await p.waitForSelector('.editor'); await p.click('.ed-bar button:text-is("Publish")'); await sleep(400);
  console.log('validation:', await p.locator('.ed-errs').innerText());
  const m = await browser.newContext({ ...devices['iPhone 13'] }); await m.addCookies(await ctx.cookies());
  const mp = await m.newPage(); await mp.goto(W + '/#articles'); await mp.waitForSelector('.arow'); await sleep(600); await mp.screenshot({ path: join(OUT, 'a6-mobile-list.png') });
  await mp.locator('.arow .btn.primary').first().click(); await mp.waitForSelector('.editor'); await sleep(400); await mp.screenshot({ path: join(OUT, 'a7-mobile-editor.png') });
  // control centre screens
  for (const v of ['dashboard', 'automation', 'sections', 'live', 'ads', 'health', 'settings']) {
    await p.goto(W + '/#' + v); await sleep(3500);
    await p.screenshot({ path: join(OUT, 'c-' + v + '.png'), fullPage: true });
    console.log(v, 'banners:', (await p.locator('#v-native .banner.bad').allInnerTexts()).join(' | ').slice(0, 300) || 'none');
  }
  await p.fill('#gsearch', 'nairobi'); await sleep(600); console.log('search:', (await p.locator('#gresults').innerText()).slice(0, 200).replace(/\n/g, ' / '));
  await p.screenshot({ path: join(OUT, 'c-search.png') });
  await p.goto(W + '/#live'); await sleep(2500); await p.click('text=Add update'); await sleep(300);
  await p.locator('.modal input.in').first().fill('Tijaabo'); await p.locator('.modal textarea').first().fill('Qoraal tijaabo ah.'); await p.click('.modal button:text-is("Publish update")'); await sleep(1500);
  console.log('live write:', writes.slice(-4).map(w => w.slice(0, 160)).join('\n  '));
  for (const v of ['dashboard', 'automation', 'live', 'settings']) { await mp.goto(W + '/#' + v); await sleep(3000); await mp.screenshot({ path: join(OUT, 'm-' + v + '.png'), fullPage: true }); console.log('mobile', v, 'overflow:', await mp.evaluate(() => document.documentElement.scrollWidth - innerWidth)); }
} catch (e) { console.error(e); }
finally { console.log('errors:', errs.join('\n')); await browser.close(); dev.kill('SIGINT'); process.exit(0); }
