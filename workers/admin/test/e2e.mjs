// End-to-end check on this computer: the real Worker (wrangler dev, local D1), the real public website pages with
// assets/stats.js, and a real browser. GitHub sign-in is a local stand-in (it cannot be automated), but every GitHub
// API READ goes to the real api.github.com, so the publishing tool really loads the live repository.
// Writes are refused by the stand-in, so this test never changes the website.
//   node test/e2e.mjs <screenshots-dir>     (needs: npm install, playwright, network)
import http from 'node:http';
import { spawn } from 'node:child_process';
import { readFileSync, existsSync, mkdirSync, statSync } from 'node:fs';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { totpAt } from '../src/util.js';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const HERE = dirname(fileURLToPath(import.meta.url));
const ADMIN = join(HERE, '..'), ROOT = join(ADMIN, '..', '..');
const OUT = process.argv[2] || join(ADMIN, '.e2e');
mkdirSync(OUT, { recursive: true });
const W = 'http://localhost:8787', GH = 'http://localhost:8790', SITE = 'http://localhost:8791';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const fails = [];
const GRAPHQL_BLOCKED = await fetch('https://api.github.com/graphql', { method: 'POST', body: '{"query":"{viewer{login}}"}' }).then(r => r.status === 403 || r.status === 401).catch(() => true);
if (GRAPHQL_BLOCKED) console.log('note: GitHub GraphQL is not reachable from this computer; the full article list is checked after deployment');
const check = (ok, what) => { console.log((ok ? 'PASS ' : 'FAIL ') + what); if (!ok) fails.push(what); };

// ---- GitHub stand-in: OAuth pages are fake, API reads are forwarded to the real GitHub (read-only) --------------------
const ghLog = [];
http.createServer(async (req, res) => {
  const u = new URL(req.url, GH);
  const body = await new Promise(r => { const c = []; req.on('data', d => c.push(d)); req.on('end', () => r(Buffer.concat(c))); });
  if (u.pathname === '/login/oauth/authorize') {
    res.writeHead(302, { location: `${u.searchParams.get('redirect_uri')}?code=e2e-code&state=${u.searchParams.get('state')}` }); return res.end();
  }
  if (u.pathname === '/login/oauth/access_token') { res.writeHead(200, { 'content-type': 'application/json' }); return res.end(JSON.stringify({ access_token: 'ghu_e2e_local', expires_in: 28800, refresh_token: 'ghr_e2e' })); }
  if (u.pathname.startsWith('/applications/')) { res.writeHead(204); return res.end(); }
  ghLog.push(req.method + ' ' + u.pathname + ' auth=' + (req.headers.authorization || '').slice(0, 14));
  const isQuery = u.pathname === '/graphql' && !/\bmutation\b/.test(body.toString());
  if (req.method !== 'GET' && !isQuery) { res.writeHead(403, { 'content-type': 'application/json' }); return res.end('{"message":"e2e stand-in is read-only"}'); }
  if (req.headers.authorization !== 'Bearer ghu_e2e_local') { res.writeHead(401); return res.end('{"message":"no server token"}'); }
  const r = await fetch('https://api.github.com' + u.pathname + u.search, { method: req.method, body: req.method === 'GET' ? undefined : body, headers: { accept: req.headers.accept || 'application/vnd.github+json', 'content-type': req.headers['content-type'] || 'application/json', 'user-agent': 'wartabiye-e2e' } });
  const buf = Buffer.from(await r.arrayBuffer());
  res.writeHead(r.status, { 'content-type': r.headers.get('content-type') || 'application/json' }); res.end(buf);
}).listen(8790);

// ---- the public website, with the counter pointed at the local Worker ------------------------------------------------
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };
http.createServer((req, res) => {
  const u = new URL(req.url, SITE);
  let f = join(ROOT, decodeURIComponent(u.pathname));
  if (existsSync(f) && statSync(f).isDirectory()) f = join(f, 'index.html');
  if (!f.startsWith(ROOT) || !existsSync(f)) { res.writeHead(404); return res.end('nf'); }
  let buf = readFileSync(f);
  if (f.endsWith('.html')) buf = Buffer.from(buf.toString().replace('data-endpoint=""', `data-endpoint="${W}"`));
  res.writeHead(200, { 'content-type': TYPES[extname(f)] || 'application/octet-stream', 'access-control-allow-origin': '*' }); res.end(buf);
}).listen(8791);

// ---- the Worker ---------------------------------------------------------------------------------------------------------
const vars = { GITHUB_WEB: GH, GITHUB_API: GH, GITHUB_CLIENT_ID: 'Iv1.e2e', GITHUB_CLIENT_SECRET: 'e2e-secret', SESSION_SECRET: 'e2e-'.repeat(12), SITE_URL: SITE + '/', SITE_ORIGINS: SITE };
const wr = (args, opts = {}) => spawn(join(ADMIN, 'node_modules', '.bin', 'wrangler'), args, { cwd: ADMIN, env: { ...process.env, WRANGLER_SEND_METRICS: 'false' }, ...opts });
await new Promise((ok, no) => wr(['d1', 'migrations', 'apply', 'wartabiye-admin', '--local'], { stdio: 'inherit' }).on('exit', c => c ? no(new Error('migrations ' + c)) : ok()));
const dev = wr(['dev', '--port', '8787', '--ip', '127.0.0.1', ...Object.entries(vars).flatMap(([k, v]) => ['--var', `${k}:${v}`])]);
let devLog = ''; dev.stdout.on('data', d => devLog += d); dev.stderr.on('data', d => devLog += d);
for (let i = 0; i < 60; i++) { try { if ((await fetch(W + '/health')).ok) break; } catch {} await sleep(1000); }

const browser = await chromium.launch();
try {
  check((await (await fetch(W + '/health')).json()).signIn === true, 'Worker is up, sign-in configured');
  // 1. nothing is open without signing in
  for (const p of ['/', '/api/me', '/api/analytics/summary', '/cms/', '/api/github/api/v3/user']) {
    const r = await fetch(W + p, { redirect: 'manual' });
    check(r.status === 302 || r.status === 401, `unauthenticated ${p} -> ${r.status}`);
  }
  // 2. real visitors on the real website pages
  const visitors = [
    { ua: 'Mozilla/5.0 (Linux; Android 14; SM-A546B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36', vp: { width: 390, height: 844 }, lang: 'so-SO', ref: 'https://www.google.com/' },
    { ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36', vp: { width: 1366, height: 860 }, lang: 'en-GB', ref: 'https://l.facebook.com/' },
    { ua: 'Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1', vp: { width: 820, height: 1180 }, lang: 'ar', ref: '' },
  ];
  const news = JSON.parse(readFileSync(join(ROOT, 'data', 'news.json'), 'utf8')).news;
  const art = news[0].id, art2 = news[1].id;
  let views = 0;
  for (const [i, v] of visitors.entries()) {
    const ctx = await browser.newContext({ userAgent: v.ua, viewport: v.vp, locale: v.lang, extraHTTPHeaders: v.ref ? { referer: v.ref } : {} });
    await ctx.addInitScript(() => Object.defineProperty(navigator, 'webdriver', { get: () => false }));
    const pg = await ctx.newPage();
    await pg.goto(SITE + '/', { waitUntil: 'load' }); views++; await sleep(1200);
    await pg.goto(SITE + '/#war-' + art, { waitUntil: 'load' }); views++; await sleep(2500);    // same document: hash route
    if (i === 0) { await pg.evaluate(id => { location.hash = 'war-' + id; }, art2); views++; await sleep(2500); await pg.evaluate(() => { location.hash = 'ciyaaraha'; }); views++; await sleep(1200); }
    if (i === 1) {
      check(await pg.locator('#wtvConsent').count() === 0, 'no consent pop-up on the website');
      check(await pg.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith('wtv-stats')).length) === 0, 'counter stores nothing in the browser');
      await pg.goto(SITE + '/war/' + art + '.html', { waitUntil: 'load' }); views++; await sleep(2500);
    }
    await ctx.close();
  }
  // an owner preview and an automated browser are NOT counted
  { const ctx = await browser.newContext(); const pg = await ctx.newPage(); await pg.goto(SITE + '/?preview=' + art); await sleep(1500); await ctx.close(); }
  await sleep(1500);

  // 3. owner sign-in: GitHub (stand-in) -> authenticator set-up -> dashboard
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 950 }, deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto(W + '/');
  check(p.url().startsWith(W + '/login'), 'dashboard redirects to the login page');
  await p.screenshot({ path: join(OUT, '01-login-light.png') });
  await p.click('#themeBtn'); await sleep(300); await p.screenshot({ path: join(OUT, '02-login-dark.png') }); await p.click('#themeBtn');
  await p.click('#signin');
  await p.waitForURL(W + '/mfa');
  const secret = (await p.locator('.mono').textContent()).replace(/\s/g, '');
  await p.screenshot({ path: join(OUT, '03-mfa-setup.png'), fullPage: true });
  await p.fill('#code', '000000'); await p.click('button[type=submit]'); await p.waitForLoadState();
  check(await p.locator('.alert').isVisible(), 'wrong code shows a clear error');
  await p.screenshot({ path: join(OUT, '04-mfa-wrong-code.png'), fullPage: true });
  await p.fill('#code', await totpAt(secret, Math.floor(Date.now() / 30000)));
  await p.waitForLoadState(); await sleep(800);
  if (await p.locator('button[type=submit]').count()) { await p.click('button[type=submit]').catch(() => {}); await p.waitForLoadState(); }
  check(/recovery codes/i.test(await p.textContent('h1')), 'recovery codes shown once');
  await p.screenshot({ path: join(OUT, '05-recovery-codes.png'), fullPage: true });
  await p.click('a.btn.primary');
  await p.waitForSelector('.kpi .val');
  await sleep(1500);
  check(!(await p.content()).includes('ghu_e2e_local'), 'GitHub token is not in the page');
  const ls = await p.evaluate(() => JSON.stringify(localStorage)); check(!ls.includes('ghu_'), 'GitHub token is not in localStorage');
  const cookies = await ctx.cookies(); const sc = cookies.find(c => c.name === '__Host-wtv_s');
  check(sc && sc.httpOnly && sc.sameSite === 'Strict', 'session cookie is HttpOnly + SameSite=Strict');
  await p.screenshot({ path: join(OUT, '06-dashboard.png'), fullPage: true });

  // 4. analytics shows exactly what the browsers did
  const S = await p.evaluate(() => fetch('/api/analytics/summary?range=today').then(r => r.json()));
  console.log('measured today:', JSON.stringify(S.totals), 'devices', JSON.stringify(S.devices), 'sources', JSON.stringify(S.sources));
  check(S.totals.visitors === 3, `3 visitors counted (got ${S.totals.visitors})`);
  check(S.totals.views === views, `${views} page views counted (got ${S.totals.views})`);
  check(S.devices.length === 3, 'mobile, desktop and tablet each recorded');
  check(S.articles[0]?.id === art && S.articles[0].views === 4, 'most read article = the one opened 4 times');
  check(S.categories.length >= 1, 'article category recorded: ' + JSON.stringify(S.categories));
  check(S.totals.consented === 0, 'no returning-visitor data (nothing stored on devices)');
  check(S.sources.some(x => x.kind === 'search') && S.sources.some(x => x.kind === 'social') && S.sources.some(x => x.kind === 'direct'), 'sources: search, social, direct');
  await p.goto(W + '/#analytics'); await p.waitForSelector('#v-analytics .chart svg'); await sleep(2500);
  await p.screenshot({ path: join(OUT, '07-analytics-30d.png'), fullPage: true });
  const kv = await p.locator('#v-analytics .kpi .val').first().textContent();
  check(kv.trim() === '3', 'Visitors card shows 3 (' + kv + ')');
  await p.click('#v-analytics .seg button:text-is("Today")'); await sleep(1800);
  await p.screenshot({ path: join(OUT, '08-analytics-today.png'), fullPage: true });
  const box = await p.locator('#v-analytics .chart svg').first().boundingBox();
  await p.mouse.move(box.x + box.width * 0.6, box.y + box.height * 0.5); await sleep(300);
  check(await p.locator('#tip').isVisible(), 'chart tooltip appears on hover');
  await p.click('#v-analytics .seg button:text-is("7 days")'); await sleep(1500);
  check((await p.locator('#v-analytics .seg button[aria-pressed=true]').first().textContent()) === '7 days', 'date filter switches to 7 days');
  await p.click('#v-analytics button:text-is("Show as table")'); await sleep(400);
  check(await p.locator('#v-analytics table.t').count() > 0, 'chart can be shown as a table');
  await p.click('#v-analytics button:text-is("Show chart")');
  // 5. automation, security, publishing tool
  await p.goto(W + '/#automation'); await p.waitForSelector('#v-automation table', { timeout: 20000 }).catch(() => {}); await sleep(1000);
  await p.screenshot({ path: join(OUT, '09-automation.png'), fullPage: true });
  check(await p.locator('#v-automation table.t tbody tr').count() > 3, 'Automation Status lists real GitHub Actions runs');
  await p.goto(W + '/#security'); await sleep(1500);
  await p.screenshot({ path: join(OUT, '10-security.png'), fullPage: true });
  check(await p.locator('#v-security .chip:text-is("Signed in")').count() > 0, 'security log records the sign-in');
  await p.goto(W + '/#articles');
  const fr = p.frameLocator('#cmsFrame');
  const loaded = await fr.locator('text=Wararka').first().waitFor({ timeout: 60000 }).then(() => true, () => false);
  await sleep(4000);
  await p.screenshot({ path: join(OUT, '11-articles-cms.png') });
  if (GRAPHQL_BLOCKED) {
    // this test computer cannot reach GitHub's GraphQL API at all; check the tool got that far through the proxy
    check(ghLog.some(l => l.startsWith('GET /user auth=Bearer ghu_e2e')) && ghLog.some(l => l.startsWith('POST /graphql auth=Bearer ghu_e2e')), 'publishing tool signs in automatically and its REST + GraphQL calls reach GitHub through the proxy with the server token');
    check(await fr.locator('#wtvRetry').isVisible().catch(() => false), 'when GitHub cannot be reached, a clear "Try again" message replaces the token form');
  } else check(loaded, 'publishing tool opens signed in and lists the real articles through the secure proxy');
  check(!ghLog.some(l => !l.includes('auth=Bearer ghu_e2e')), 'every GitHub call carried the server-side token');
  // 6. mobile
  const m = await browser.newContext({ ...require('playwright').devices['iPhone 13'] });
  await m.addCookies(cookies);
  const mp = await m.newPage(); await mp.goto(W + '/#analytics'); await mp.waitForSelector('#v-analytics .kpi .val'); await sleep(2000);
  await mp.screenshot({ path: join(OUT, '12-mobile-analytics.png'), fullPage: true });
  await mp.click('#menuBtn'); await sleep(400); await mp.screenshot({ path: join(OUT, '13-mobile-menu.png') });
  const ml = await browser.newContext({ ...require('playwright').devices['iPhone 13'] }); const mlp = await ml.newPage();
  await mlp.goto(W + '/login'); await sleep(600); await mlp.screenshot({ path: join(OUT, '14-mobile-login.png') });
  // 7. logout
  await p.goto(W + '/#dashboard'); await sleep(500);
  await p.click('.nav-logout'); await p.waitForURL(/login\?bye=1/);
  await p.screenshot({ path: join(OUT, '15-signed-out.png') });
  check((await p.evaluate(() => fetch('/api/me').then(r => r.status))) === 401, 'after logout the API is closed again');
  const realErrs = errs.filter(e => !/favicon|Failed to load resource|unpkg\.com|GraphQL|graphql|status of 403/.test(e));
  check(realErrs.length === 0, 'no script or security-policy errors ' + realErrs.slice(0, 5).join(' | '));
} catch (e) { console.error(e); fails.push(String(e)); }
finally {
  await browser.close(); dev.kill('SIGINT');
  if (fails.length) { console.log('\nWorker log (tail):\n' + devLog.slice(-3000)); }
  console.log(fails.length ? `\n${fails.length} FAILED` : '\nALL PASSED'); process.exit(fails.length ? 1 : 0);
}
