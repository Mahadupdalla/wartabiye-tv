// Browser test of the language switcher (Somali, English, Arabic, French) on desktop and mobile.
// Usage: node tools/lang_test.js <site url> [screenshot dir]. Exit code 1 on any problem.
const { chromium } = require('playwright');
const fs = require('fs');
(async () => {
  const base = process.argv[2], outDir = process.argv[3] || '.';
  const news = JSON.parse(fs.readFileSync('data/news.json', 'utf8')).news;
  const b = await chromium.launch(); const problems = [];
  const fail = m => { problems.push(m); console.log('PROBLEM:', m) };
  const LANGS = { so: 'ltr', en: 'ltr', ar: 'rtl', fr: 'ltr' };
  for (const [w, h, name] of [[1280, 900, 'desktop'], [390, 844, 'mobile']]) {
    const ctx = await b.newContext({ viewport: { width: w, height: h } });
    const p = await ctx.newPage(); const errs = [];
    p.on('pageerror', e => errs.push(e.message));
    await p.goto(base, { waitUntil: 'networkidle' }); await p.waitForTimeout(800);
    // first visit: Somali
    const first = await p.evaluate(() => ({ lang: document.documentElement.lang, dir: document.documentElement.dir, btn: document.getElementById('langName').textContent }));
    console.log(name, 'first visit', JSON.stringify(first));
    if (first.lang !== 'so' || first.dir !== 'ltr') fail(name + ': first visit is not Somali');
    const soCards = await p.evaluate(() => new Set([...document.querySelectorAll('#homeView a[href^="#war-"]')].map(a => a.getAttribute('href'))).size);
    for (const lang of Object.keys(LANGS)) {
      // the switcher must be visible inside the top-right corner
      const box = await p.locator('#langBtn').boundingBox();
      if (!box || box.x + box.width > w + 1 || box.y > 60) fail(`${name}: switcher not visible at top right (${JSON.stringify(box)})`);
      await p.click('#langBtn'); await p.waitForTimeout(150);
      const mbox = await p.locator('#langMenu').boundingBox();
      if (!mbox || mbox.x < 0 || mbox.x + mbox.width > w + 1) fail(`${name}: language menu outside the screen (${JSON.stringify(mbox)})`);
      await p.click(`#langMenu [data-lang="${lang}"]`); await p.waitForTimeout(300);
      const r = await p.evaluate(() => {
        const cards = new Set([...document.querySelectorAll('#homeView a[href^="#war-"]')].map(a => a.getAttribute('href'))).size;
        return { lang: document.documentElement.lang, dir: document.documentElement.dir, nav: [...document.querySelectorAll('#links a')].map(a => a.textContent).join(' | '),
          lead: (document.querySelector('.tile.big h2') || {}).textContent, cards, overflow: document.documentElement.scrollWidth > innerWidth,
          latest: document.getElementById('listTitle').textContent, footer: document.querySelector('.fbot').innerText.replace(/\s+/g, ' ') };
      });
      console.log(name, lang, JSON.stringify(r));
      if (r.lang !== lang || r.dir !== LANGS[lang]) fail(`${name} ${lang}: html lang/dir is ${r.lang}/${r.dir}`);
      if (r.cards !== soCards) fail(`${name} ${lang}: ${r.cards} articles shown, Somali shows ${soCards}`);
      if (r.overflow) fail(`${name} ${lang}: page scrolls sideways`);
      const leadItem = news.find(n => n.title === r.lead || (n[lang] && n[lang].title === r.lead));
      if (!leadItem) fail(`${name} ${lang}: lead headline not found in news.json`);
      else if (lang !== 'so' && leadItem[lang] && leadItem[lang].title !== r.lead) fail(`${name} ${lang}: lead headline is not translated`);
      await p.screenshot({ path: `${outDir}/lang-${name}-${lang}.png` });
      // remembered after a reload
      await p.reload({ waitUntil: 'networkidle' }); await p.waitForTimeout(500);
      const kept = await p.evaluate(() => document.documentElement.lang);
      if (kept !== lang) fail(`${name} ${lang}: language not remembered after reload (${kept})`);
    }
    // every article opens in every language with the right headline
    if (name === 'desktop') for (const lang of Object.keys(LANGS)) {
      await p.evaluate(l => { localStorage.setItem('wartabiye-lang', l) }, lang); await p.reload({ waitUntil: 'networkidle' }); await p.waitForTimeout(400);
      let bad = 0;
      for (const it of news) {
        await p.evaluate(id => location.hash = 'war-' + encodeURIComponent(id), it.id); await p.waitForTimeout(120);
        const s = await p.evaluate(() => { const a = document.getElementById('story'); return { h1: (a.querySelector('h1') || {}).textContent, note: (a.querySelector('.trnote') || {}).textContent || '', dir: (a.querySelector('h1') || {}).dir } });
        const want = lang !== 'so' && it[lang] ? it[lang].title : it.title;
        if (s.h1 !== want) { bad++; fail(`${lang} article ${it.id}: headline "${s.h1}"`) }
        if (lang !== 'so' && !it[lang] && !s.note) fail(`${lang} article ${it.id}: Somali fallback without a label`);
        if (lang !== 'so' && !it[lang] && s.dir !== 'ltr') fail(`${lang} article ${it.id}: Somali fallback not left-to-right`);
      }
      console.log('articles in', lang, bad ? bad + ' wrong' : 'all ' + news.length + ' OK');
      if (lang === 'ar') { await p.evaluate(id => location.hash = 'war-' + encodeURIComponent(id), news[0].id); await p.waitForTimeout(300); await p.screenshot({ path: `${outDir}/lang-story-ar.png`, fullPage: true }) }
    }
    // search works in the chosen language
    if (name === 'desktop') {
      const it = news.find(n => n.en); if (it) {
        await p.evaluate(() => { localStorage.setItem('wartabiye-lang', 'en'); location.hash = 'hoyga' }); await p.reload({ waitUntil: 'networkidle' }); await p.waitForTimeout(400);
        await p.click('#searchBtn'); await p.fill('#q', it.en.title.split(' ').slice(0, 3).join(' ')); await p.waitForTimeout(300);
        const found = await p.evaluate(t => [...document.querySelectorAll('#list h3')].some(h => h.textContent === t), it.en.title);
        console.log('search in English finds', JSON.stringify(it.en.title), found); if (!found) fail('search in English');
      }
    }
    if (errs.length) fail(name + ' page errors: ' + errs.join('; '));
    await ctx.close();
  }
  await b.close();
  console.log(problems.length ? 'PROBLEMS: ' + problems.length : 'LANGUAGES OK');
  process.exit(problems.length ? 1 : 0);
})();
