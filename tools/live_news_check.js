// Checks that the NEWEST published articles are really visible to visitors on the PUBLIC website (not local code).
// Run by .github/workflows/live-news-check.yml after every publish (Actions can reach www.wartabiyetv.com).
// Usage: node tools/live_news_check.js [site url] [expected news.json] [screenshot dir]
//   site url          default https://www.wartabiyetv.com/
//   expected news.json the news.json of the commit that was just published (default data/news.json of this checkout)
// It only READS the site. Exit code 1 when visitors would still see older news than the repository holds.
const fs = require('fs');
const { chromium, devices } = require('playwright');
const SITE = (process.argv[2] || 'https://www.wartabiyetv.com/').replace(/\/?$/, '/');
const EXPECTED = process.argv[3] || 'data/news.json';
const SHOTS = process.argv[4] || 'live-news-shots';
const bad = [];
const bust = () => 'cb=' + Date.now();
const section = n => (n.section === 'sports' || n.section === 'world' || n.section === 'somalia') ? n.section
  : n.category === 'Ciyaaraha' ? 'sports' : n.category === 'Adduunka' ? 'world' : 'somalia';
const newest = l => l.slice().sort((a, c) => String(c.publishedAt).localeCompare(String(a.publishedAt)));
const pub = j => (Array.isArray(j) ? j : j.news || []).filter(n => n && n.title && n.published !== false);
const HDRS = ['cache-control', 'age', 'last-modified', 'etag', 'x-cache', 'x-cache-hits', 'x-served-by', 'via', 'server', 'cf-cache-status'];

(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });
  const exp = JSON.parse(fs.readFileSync(EXPECTED, 'utf8'));
  const want = newest(pub(exp));
  console.log(`LIVE NEWS CHECK ${SITE} at ${new Date().toISOString()}`);
  console.log(`expected (repository): updatedAt ${exp.updatedAt} | ${want.length} published | newest ${want[0] && want[0].publishedAt} ${want[0] && want[0].id}`);

  const b = await chromium.launch();
  const ctx0 = await b.newContext(); const rq = ctx0.request;

  // 1. what the server and its caches hand out: the plain address (what a browser or crawler without our
  //    cache-buster gets) and the cache-busted one (what the site's own script asks for)
  console.log('\nHTTP (headers that decide caching)');
  for (const path of ['', 'data/news.json', 'assets/app.js', 'war/' + (want[0] && want[0].id) + '.html', 'soomaaliya/', 'bariga-afrika/', 'caalamka/', 'rss.xml']) {
    const r = await rq.get(SITE + path, { failOnStatusCode: false });
    const h = r.headers(); const keep = HDRS.filter(k => h[k]).map(k => `${k}=${h[k]}`).join(' ');
    console.log(`  /${path}  HTTP ${r.status()}  ${keep}`);
    if (r.status() !== 200) bad.push(`/${path} answered HTTP ${r.status()}`);
  }
  const live = {};
  for (const [k, url] of [['plain', SITE + 'data/news.json'], ['busted', SITE + 'data/news.json?' + bust()]]) {
    const j = await (await rq.get(url)).json(); const l = newest(pub(j));
    live[k] = { j, l };
    const missing = want.slice(0, 10).filter(w => !l.some(x => x.id === w.id));
    console.log(`  news.json ${k}: updatedAt ${j.updatedAt} | ${l.length} published | newest ${l[0] && l[0].publishedAt} ${l[0] && l[0].id} | missing of the 10 newest: ${missing.length}`);
    if (missing.length) bad.push(`news.json (${k}) is older than the repository: ${missing.length} of the 10 newest articles missing (live updatedAt ${j.updatedAt}, repository ${exp.updatedAt})`);
  }

  // 2. what a visitor sees: the newest article of each section is on the homepage and on its section page,
  //    and its own article page opens (desktop and mobile, a fresh browser with no cache)
  const tops = {
    home: want.slice(0, 3),
    soomaaliya: want.filter(n => section(n) === 'somalia' && n.country === 'so').slice(0, 1),
    'bariga-afrika': want.filter(n => section(n) === 'somalia' && n.country && n.country !== 'so').slice(0, 1),
    caalamka: want.filter(n => section(n) === 'world').slice(0, 1),
  };
  console.log('\nPAGES (a new visitor, no cache)');
  for (const [name, opt] of [['desktop', { viewport: { width: 1366, height: 900 } }], ['mobile', { ...devices['iPhone 13'] }]]) {
    const ctx = await b.newContext(opt); const p = await ctx.newPage(); const errs = [];
    p.on('pageerror', e => errs.push(e.message));
    for (const [route, list] of Object.entries(tops)) {
      if (!list.length) continue;
      await p.goto(SITE + (route === 'home' ? '' : '#' + route), { waitUntil: 'networkidle' }); await p.waitForTimeout(2500);
      for (const it of list) {
        const seen = await p.evaluate(id => !!document.querySelector(`#main a[href="#war-${id}"], #main a[href$="war/${id}.html"]`), it.id);
        console.log(`  ${name} ${route}: ${seen ? 'shows' : 'MISSING'} ${it.publishedAt} ${it.id}`);
        if (!seen) bad.push(`${name} ${route}: the newest article ${it.id} is not shown`);
      }
      await p.screenshot({ path: `${SHOTS}/${name}-${route}.png` }).catch(() => {});
    }
    for (const it of want.slice(0, 5)) {
      const r = await p.goto(SITE + 'war/' + it.id + '.html', { waitUntil: 'domcontentloaded' });
      const ok = r.status() === 200 && await p.evaluate(t => document.body.innerText.includes(t) || document.title.includes(t.slice(0, 40)), it.title);
      console.log(`  ${name} article ${r.status()} ${ok ? 'opens' : 'BROKEN'} ${SITE}war/${it.id}.html`);
      if (!ok) bad.push(`${name}: ${SITE}war/${it.id}.html does not open (HTTP ${r.status()})`);
    }
    if (errs.length) bad.push(`${name}: JavaScript errors: ${errs.join(' / ')}`);
    await ctx.close();
  }
  await b.close();

  console.log('\nNEWEST ARTICLES ON THE LIVE SITE');
  for (const it of live.busted.l.slice(0, 10)) console.log(`  ${it.publishedAt}  ${SITE}war/${it.id}.html  ${it.title}`);
  console.log(bad.length ? '\nPROBLEMS:\n - ' + bad.join('\n - ') : '\nOK: visitors see the newest articles');
  process.exit(bad.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
