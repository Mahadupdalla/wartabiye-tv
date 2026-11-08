// Checks the PUBLIC website (not local code): every visitor-facing section of the menu, on desktop and mobile, in all
// nine languages. Run by .github/workflows/live-site-check.yml (Actions can reach www.wartabiyetv.com).
// Usage: node tools/live_site_check.js [site url]   -> prints a report; exit code 1 if a section is missing or broken.
// It only READS the site. It reports what each section really shows: real content, an honest "offline" or empty state.
const { chromium, devices } = require('playwright');
const SITE = (process.argv[2] || 'https://www.wartabiyetv.com/').replace(/\/?$/, '/');
const SECTIONS = [
  { key: 'LIVE News', route: 'wararka-tooska' },
  { key: 'LIVE TV', route: 'toos' },
  { key: 'LIVE Matches', route: 'ciyaaraha-toos' },
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
    if (route === 'wararka-tooska') { o.updates = V.querySelectorAll('.lntl .lnitem').length; o.status = txt('.lnstatus').replace(/\s+/g, ' '); o.broadcast = txt('.lnbroadcast').replace(/\s+/g, ' '); }
    if (route === 'toos') { o.player = !!V.querySelector('.livestage.on iframe, .livestage.on video, .livestage.on .vframe'); o.offline = txt('.offline').replace(/\s+/g, ' ').slice(0, 160); }
    if (route === 'ciyaaraha-toos') { o.matchRows = V.querySelectorAll('.mrow').length; o.liveMatches = V.querySelectorAll('.mrow.is-live').length; o.note = (V.innerText || '').replace(/\s+/g, ' ').slice(0, 400); }
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
