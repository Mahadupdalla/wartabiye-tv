// Publishing tool check against the REAL repository, run in GitHub Actions (admin-cms-check.yml).
// The real Worker runs locally (wrangler dev) and the real publishing tool runs in a real browser. GitHub sign-in is a
// stand-in, because a person's sign-in cannot be automated; every GitHub API call (REST and GraphQL) is forwarded to
// the real api.github.com with the workflow's own short-lived token (GH_TOKEN), so the tool loads the live content.
//   GH_TOKEN=… node test/cms-ci.mjs <out-dir>         read-only unless WRITE_TEST=1
import http from 'node:http';
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
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
  p.on('pageerror', e => errs.push('pageerror ' + e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto(W + '/'); await p.click('#signin'); await p.waitForURL(W + '/mfa');
  const secret = (await p.locator('.mono').textContent()).replace(/\s/g, '');
  await p.fill('#code', await totpAt(secret, Math.floor(Date.now() / 30000)));
  await p.waitForLoadState(); await sleep(800);
  if (await p.locator('button[type=submit]').count()) { await p.click('button[type=submit]').catch(() => {}); await p.waitForLoadState(); }
  await p.click('a.btn.primary'); await p.waitForSelector('.kpi .val', { timeout: 30000 }).catch(() => {});
  return p;
}
try {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 950 } });
  const p = await signIn(ctx);
  await p.goto(W + '/#articles');
  const fr = p.frameLocator('#cmsFrame');
  const t0 = Date.now();
  let listed = 0;
  for (let i = 0; i < 90; i++) {
    listed = await fr.locator('[role="row"], [role="gridcell"], .entry, a[href*="/collections/news/entries/"]').count().catch(() => 0);
    if (listed > 5) break;
    if (await fr.locator('#wtvRetry').isVisible().catch(() => false)) break;
    await sleep(2000);
  }
  console.log(`articles visible after ${Math.round((Date.now() - t0) / 1000)} s: ${listed}`);
  await p.screenshot({ path: join(OUT, 'cms-articles-desktop.png') });
  check(listed > 5, 'publishing tool lists the real articles');
  check(!(await fr.locator('#wtvRetry').isVisible().catch(() => false)), 'no "Could not connect to GitHub" screen');
  const txt = await fr.locator('body').innerText().catch(() => '');
  writeFileSync(join(OUT, 'cms-text.txt'), txt);
  // mobile
  const m = await browser.newContext({ ...devices['iPhone 13'] });
  await m.addCookies(await ctx.cookies());
  const mp = await m.newPage(); await mp.goto(W + '/#articles'); await sleep(15000);
  await mp.screenshot({ path: join(OUT, 'cms-articles-mobile.png') });
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
