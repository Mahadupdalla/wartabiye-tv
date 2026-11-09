// Checks the PUBLIC website (not local code): every visitor-facing section of the menu, on desktop and mobile, in all
// nine languages. Run by .github/workflows/live-site-check.yml (Actions can reach www.wartabiyetv.com).
// Usage: node tools/live_site_check.js [site url]   -> prints a report; exit code 1 if a section is missing or broken.
// It only READS the site. It reports what each section really shows: real content, an honest "offline" or empty state.
const { chromium, devices } = require('playwright');
const SITE = (process.argv[2] || 'https://www.wartabiyetv.com/').replace(/\/?$/, '/');
const SECTIONS = [
  { key: 'LIVE News', route: 'wararka-tooska' },
  { key: 'LIVE TV', route: 'toos' },
  { key: 'Sports news', route: 'ciyaaraha' },
  { key: 'Video News', route: 'muuqaal' },
];
const LANGS = ['so', 'en', 'ar', 'fr', 'nl', 'it', 'de', 'tr', 'es'];
const bad = [];
const bust = () => 'cb=' + Date.now();

async function menu(page, mobile) {
  if (mobile) { await page.click('#menuBtn'); await page.waitForTimeout(400); }
  return page.evaluate(() => {
    const L = document.getElementById('links').getBoundingClientRect();
    return [...document.querySelectorAll('#links > a')].map(a => {
      const r = a.getBoundingClientRect(); const st = getComputedStyle(a);
      const shown = st.display !== 'none' && st.visibility !== 'hidden' && r.width > 0 && r.right <= L.right + 1 && r.left >= L.left - 1 && r.bottom <= L.bottom + 1;
      return { href: a.getAttribute('href'), text: a.textContent.trim(), shown };
    });
  });
}

async function sectionState(page, route) {
  return page.evaluate(route => {
    const V = document.getElementById('pageView'); const h1 = V.querySelector('h1');
    const txt = s => (V.querySelector(s) || {}).innerText || '';
    const o = { title: h1 ? h1.innerText.trim() : '', liveBadge: !!(h1 && h1.querySelector('.onair')) };
    if (route === 'wararka-tooska') { o.updates = V.querySelectorAll('.lntl .lnitem').length; o.liveUpdates = V.querySelectorAll('.lntl .lnitem.lu').length; o.externalLinks = V.querySelectorAll('.lntl a[href^="http"]').length; o.status = txt('.lnstatus').replace(/\s+/g, ' '); o.broadcast = txt('.lnbroadcast').replace(/\s+/g, ' '); }
    if (route === 'toos') { o.player = !!V.querySelector('.livestage.on iframe, .livestage.on video, .livestage.on .vframe'); o.offline = txt('.offline').replace(/\s+/g, ' ').slice(0, 160); }
    if (route === 'ciyaaraha') { o.cards = V.querySelectorAll('.card').length; o.resultWidgets = document.querySelectorAll('.scorestrip:not([hidden]), .mrow, .rescard').length; o.sourceLabels = [...V.querySelectorAll('.card .meta')].filter(m => /Ilaha|Source|Fuente|Quelle|Kaynak|Bron|Fonte/.test(m.innerText)).length; }
    if (route === 'muuqaal') { o.videos = V.querySelectorAll('.vcard, .vgrid > *').length; o.empty = txt('.empty').replace(/\s+/g, ' ').slice(0, 160); }
    return o;
  }, route);
}

(async () => {
  const b = await chromium.launch();
  console.log('PUBLIC SITE CHECK: ' + SITE + '  at ' + new Date().toISOString());
  // 1. menu on desktop and mobile
  for (const [name, opt, mobile] of [['desktop 1366', { viewport: { width: 1366, height: 900 } }, false], ['desktop 1920', { viewport: { width: 1920, height: 1000 } }, false], ['mobile (iPhone 13)', { ...devices['iPhone 13'] }, true]]) {
    const ctx = await b.newContext(opt); const p = await ctx.newPage(); const errs = [];
    p.on('pageerror', e => errs.push(e.message));
    await p.goto(SITE + '?' + bust() + '#hoyga', { waitUntil: 'networkidle' }); await p.waitForTimeout(1500);
    const m = await menu(p, mobile);
    console.log(`\nMENU ${name}: ` + m.map(x => (x.shown ? '' : '[not visible] ') + x.text).join(' | '));
    for (const s of SECTIONS) {
      const it = m.find(x => x.href === '#' + s.route);
      const btn = s.route === 'toos' && await p.evaluate(() => { const e = document.getElementById('liveBtn'); return !!(e && e.offsetParent); });
      if (!(it && it.shown) && !btn) bad.push(`${name}: "${s.key}" is not visible in the menu`);
    }
    if (errs.length) bad.push(`${name}: JavaScript errors: ${errs.join(' / ')}`);
    await ctx.close();
  }
  // 2. each section: its own address and its hash route, desktop + mobile
  console.log('\nSECTIONS');
  for (const s of SECTIONS) {
    for (const [name, opt] of [['desktop', { viewport: { width: 1366, height: 900 } }], ['mobile', { ...devices['iPhone 13'] }]]) {
      const ctx = await b.newContext(opt); const p = await ctx.newPage();
      const url = SITE + s.route + '/?' + bust();
      const r = await p.goto(url, { waitUntil: 'networkidle' }).catch(e => ({ status: () => 'ERR ' + e.message }));
      await p.waitForTimeout(2500);
      const st = await sectionState(p, s.route).catch(e => ({ error: e.message }));
      console.log(`  ${s.key} ${name}: ${SITE}${s.route}/  HTTP ${r.status()}  ` + JSON.stringify(st));
      if (r.status() !== 200) bad.push(`${s.key}: ${SITE}${s.route}/ answered HTTP ${r.status()}`);
      if (!st.title) bad.push(`${s.key} ${name}: the page did not render (no heading)`);
      if (s.route === 'ciyaaraha' && (st.resultWidgets || st.sourceLabels || !st.cards)) bad.push(`Sports ${name}: results widgets ${st.resultWidgets}, source labels ${st.sourceLabels}, cards ${st.cards}`);
      if (s.route === 'wararka-tooska' && st.externalLinks) bad.push(`LIVE News ${name}: ${st.externalLinks} timeline item(s) link to other websites`);
      await ctx.close();
    }
  }
  // 2b. public match results are off: no menu entry, and the old address sends visitors to the Sports news page
  { const ctx = await b.newContext({ viewport: { width: 1366, height: 900 } }); const p = await ctx.newPage();
    await p.goto(SITE + 'ciyaaraha-toos/?' + bust(), { waitUntil: 'networkidle' }); await p.waitForTimeout(2500);
    const r = await p.evaluate(() => ({ url: location.href, menu: [...document.querySelectorAll('#links a')].some(a => a.getAttribute('href') === '#ciyaaraha-toos'), rows: document.querySelectorAll('.mrow, .scorestrip:not([hidden])').length }));
    await p.goto(SITE + '?' + bust() + '#ciyaaraha-toos', { waitUntil: 'networkidle' }); await p.waitForTimeout(2500);
    const h = await p.evaluate(() => ({ hash: location.hash, rows: document.querySelectorAll('.mrow, .scorestrip:not([hidden])').length }));
    console.log('\nRESULTS SECTION REMOVED: ' + JSON.stringify(r) + ' ' + JSON.stringify(h));
    if (!/\/ciyaaraha\/(\?|#|$)/.test(r.url) || r.menu || r.rows || h.hash !== '#ciyaaraha' || h.rows) bad.push('the public Results section can still be reached: ' + JSON.stringify([r, h]));
    await ctx.close(); }
  // 2c. Soomaaliya (owner's request, 9 Nov 2026): the newest Somalia article in the live news.json is shown on the
  // Soomaaliya page and on the homepage, and its own page opens, desktop and mobile
  { require('fs').mkdirSync('public-shots', { recursive: true });
    const ctx0 = await b.newContext(); const p0 = await ctx0.newPage();
    const nj = await (await p0.request.get(SITE + 'data/news.json?' + bust())).json();
    const so = (nj.news || []).filter(n => (n.section || 'somalia') === 'somalia' && n.country === 'so')
      .sort((a, c) => String(c.publishedAt).localeCompare(String(a.publishedAt)));
    const top = so[0]; await ctx0.close();
    console.log('\nSOOMAALIYA: ' + so.length + ' Somalia articles in news.json; newest: ' + (top ? `${top.publishedAt} ${top.id} "${top.title}"` : 'none'));
    if (!top) bad.push('Soomaaliya: no Somalia article in the live news.json');
    for (const [name, opt, mobile] of top ? [['desktop', { viewport: { width: 1366, height: 900 } }, false], ['mobile', { ...devices['iPhone 13'] }, true]] : []) {
      const ctx = await b.newContext(opt); const p = await ctx.newPage();
      const shows = () => p.evaluate(t => document.getElementById('pageView').innerText.includes(t) || document.body.innerText.includes(t), top.title);
      await p.goto(SITE + '?' + bust() + '#hoyga', { waitUntil: 'networkidle' }); await p.waitForTimeout(2500);
      const home = await shows();
      const nav = (await menu(p, mobile)).find(x => x.href === '#soomaaliya');
      await p.goto(SITE + '?' + bust() + '#soomaaliya', { waitUntil: 'networkidle' }); await p.waitForTimeout(2500);
      const hub = await shows();
      const first = await p.evaluate(() => ((document.querySelector('#pageView .card h3, #pageView .card .t, #pageView .card') || {}).innerText || '').replace(/\s+/g, ' ').trim().slice(0, 120));
      const r = await p.goto(SITE + 'war/' + top.id + '.html?' + bust(), { waitUntil: 'networkidle' }); await p.waitForTimeout(1500);
      const art = await p.evaluate(t => document.body.innerText.includes(t), top.title);
      console.log(`  ${name}: menu "${nav ? nav.text : '(missing)'}" visible=${!!(nav && nav.shown)} | on Soomaaliya page=${hub} | on homepage=${home} | article page HTTP ${r.status()} shows headline=${art} | first card on Soomaaliya: "${first}"`);
      console.log(`  ${name}: ${SITE}war/${top.id}.html`);
      if (!(nav && nav.shown)) bad.push(`Soomaaliya ${name}: not visible in the menu`);
      if (!hub) bad.push(`Soomaaliya ${name}: the newest Somalia article is not on the Soomaaliya page`);
      if (!home) bad.push(`Soomaaliya ${name}: the newest Somalia article is not on the homepage`);
      if (r.status() !== 200 || !art) bad.push(`Soomaaliya ${name}: the article page does not open`);
      await p.goto(SITE + '?' + bust() + '#soomaaliya', { waitUntil: 'networkidle' }); await p.waitForTimeout(2000);
      await p.screenshot({ path: `public-shots/soomaaliya-${name}.png` }).catch(() => {});
      await ctx.close();
    }
  }
  // 3. nine languages: the menu labels of the four sections
  console.log('\nLANGUAGES (menu labels)');
  const ctx = await b.newContext({ viewport: { width: 1366, height: 900 } }); const p = await ctx.newPage();
  for (const l of LANGS) {
    await p.goto(SITE + '?lang=' + l + '&' + bust() + '#hoyga', { waitUntil: 'networkidle' }); await p.waitForTimeout(1200);
    const m = await menu(p, false);
    const labels = SECTIONS.map(s => (m.find(x => x.href === '#' + s.route) || {}).text || '(missing)');
    console.log(`  ${l}: ` + SECTIONS.map((s, i) => s.key + ' = ' + labels[i]).join(' | '));
    if (labels.includes('(missing)')) bad.push(`${l}: a section is missing from the menu`);
  }
  await b.close();
  console.log('\n' + (bad.length ? 'PROBLEMS:\n  ' + bad.join('\n  ') : 'PUBLIC SITE OK: all four sections are in the menu and open, desktop and mobile, 9 languages'));
  process.exit(bad.length ? 1 : 0);
})();
