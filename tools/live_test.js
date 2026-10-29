// Browser test of the live public site: every image slot shows a photo or a placeholder,
// every article page opens, categories work, desktop and mobile. Exit code 1 on any problem.
const { chromium } = require('playwright');
const fs = require('fs');
(async () => {
  const base = process.argv[2], outDir = process.argv[3] || '.';
  const news = JSON.parse(fs.readFileSync('data/news.json', 'utf8')).news;
  const b = await chromium.launch(); const problems = [];
  async function open(w, h, hash) {
    const p = await b.newPage({ viewport: { width: w, height: h } }); const errs = [];
    p.on('pageerror', e => errs.push(e.message));
    p.on('response', r => { if (r.status() >= 400) errs.push(r.status() + ' ' + r.url()) });
    await p.goto(base + hash, { waitUntil: 'networkidle' }); await p.waitForTimeout(1000); return { p, errs };
  }
  async function slots(p) {
    await p.evaluate(async () => { for (const im of document.querySelectorAll('.ph>img')) { im.loading = 'eager'; im.scrollIntoView(); await new Promise(r => setTimeout(r, 40)) } window.scrollTo(0, 0) });
    await p.waitForTimeout(800);
    return p.evaluate(() => {
      const r = { slots: 0, images: 0, placeholders: 0, blank: 0 };
      document.querySelectorAll('.ph').forEach(el => {
        r.slots++; const im = el.querySelector('img'); const phc = el.querySelector('.phc');
        const phv = phc && !phc.hidden && getComputedStyle(phc).display !== 'none';
        if (im && im.complete && im.naturalWidth > 0) r.images++;
        else if (phv || el.classList.contains('none')) r.placeholders++;
        else if (!im && /url\(/.test(getComputedStyle(el).backgroundImage)) r.images++;
        else r.blank++;
      });
      const em = document.getElementById('empty'); r.message = em.hidden ? '' : em.textContent;
      r.cards = new Set([...document.querySelectorAll('#homeView a[href^="#war-"]')].map(a => a.getAttribute('href'))).size;
      r.overflow = document.documentElement.scrollWidth > innerWidth; return r;
    });
  }
  for (const [w, h, name] of [[1280, 900, 'desktop'], [390, 844, 'mobile']]) {
    const { p, errs } = await open(w, h, '');
    const r = await slots(p); console.log(name, JSON.stringify(r), errs);
    if (r.blank || r.message || r.cards < Math.min(news.length, 10) || r.overflow || errs.length) problems.push(name + ' homepage');
    // the removed interviews section must not come back
    const iv = await p.evaluate(() => !!document.getElementById('wareysiyo') || /wareysiyo gaar/i.test(document.body.innerText));
    console.log(name, 'interviews section present:', iv); if (iv) problems.push(name + ' interviews section is back');
    await p.screenshot({ path: `${outDir}/live-${name}.png`, fullPage: true }); await p.close();
  }
  const { p } = await open(1280, 900, '');
  for (const it of news) {
    await p.evaluate(id => location.hash = 'war-' + encodeURIComponent(id), it.id); await p.waitForTimeout(250);
    const r = await p.evaluate(async () => {
      const s = document.getElementById('story'); const im = s.querySelector('figure .ph img');
      if (im) { im.loading = 'eager'; await new Promise(res => { if (im.complete) res(); else { im.onload = im.onerror = res } }) }
      const phc = s.querySelector('figure .phc');
      return { title: !!s.querySelector('h1'), image: im && im.naturalWidth > 0 ? 'image' : (phc && !phc.hidden ? 'placeholder' : 'BLANK') };
    });
    console.log('article', it.id, r.title ? 'opens' : 'DOES NOT OPEN', r.image);
    if (!r.title || r.image === 'BLANK') problems.push('article ' + it.id);
  }
  for (const c of ['siyaasadda', 'amniga', 'bulshada', 'dhaqaalaha', 'adduunka', 'ciyaaraha']) {
    await p.evaluate(c => location.hash = 'qayb-' + c, c); await p.waitForTimeout(300);
    const t = await p.evaluate(() => document.getElementById('listTitle').textContent);
    console.log('category', c, '->', t);
    if (t.toLowerCase() !== c) problems.push('category ' + c);
  }
  await b.close();
  console.log(problems.length ? 'PROBLEMS: ' + problems.join(', ') : 'LIVE SITE OK');
  process.exit(problems.length ? 1 : 0);
})();
