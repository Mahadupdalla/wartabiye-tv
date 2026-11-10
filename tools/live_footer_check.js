// Read-only check of the REAL public website: the footer email (mailto: link from /admin/ -> Website settings -> Footer),
// the footer social icons, and that the header still has its own email and its three social icons.
//   node tools/live_footer_check.js https://www.wartabiyetv.com/ [out-dir]
const { chromium, devices } = require('playwright');
const fs = require('fs');
const BASE = (process.argv[2] || 'https://www.wartabiyetv.com/').replace(/\/?$/, '/');
const OUT = process.argv[3] || 'footer-shots'; fs.mkdirSync(OUT, { recursive: true });
(async () => {
  const b = await chromium.launch(); let bad = 0;
  const site = await (await fetch(BASE + 'data/site.json?cb=' + Date.now())).json();
  console.log('site.json contact:', JSON.stringify(site.contact), 'footer:', JSON.stringify(site.footer));
  const html = await (await fetch(BASE + '?cb=' + Date.now())).text();
  console.log('index.html has footer email slot:', html.includes('id="fmail"'), '| asset version:', (html.match(/app\.js\?v=([\w]+)/) || [])[1]);
  const news = (await (await fetch(BASE + 'data/news.json?cb=' + Date.now())).json()).news || [];
  const art = news[0] && BASE + 'war/' + news[0].id + '.html';
  for (const [name, opts] of [['desktop', { viewport: { width: 1280, height: 900 } }], ['mobile', devices['iPhone 13']]]) {
    for (const url of [BASE, art].filter(Boolean)) {
      const ctx = await b.newContext(opts); const p = await ctx.newPage();
      await p.goto(url + (url.includes('?') ? '&' : '?') + 'notrack=1', { waitUntil: 'networkidle', timeout: 60000 }); await p.waitForTimeout(1500);
      const r = await p.evaluate(() => {
        const vis = e => !!e && !e.hidden && getComputedStyle(e).display !== 'none' && e.getBoundingClientRect().width > 0;
        const m = document.getElementById('fmail');
        return {
          footerEmail: vis(m) ? { text: m.textContent.trim(), href: m.getAttribute('href') } : null,
          footerIcons: [...document.querySelectorAll('footer .fsoc a')].filter(vis).map(a => a.dataset.soc + ' ' + a.href),
          footerIconSizes: [...new Set([...document.querySelectorAll('footer .fsoc a')].filter(vis).map(a => Math.round(a.getBoundingClientRect().width) + 'x' + Math.round(a.getBoundingClientRect().height)))],
          headerIcons: [...document.querySelectorAll('header.logoband .soc a[data-soc]')].map(a => a.dataset.soc + ' ' + a.href),
          headerEmail: (document.querySelector('header.logoband .hmail') || {}).href || null,
          overflow: document.documentElement.scrollWidth - innerWidth,
        };
      });
      const label = name + ' ' + url.replace(BASE, '/');
      console.log(label, JSON.stringify(r, null, 1));
      if (!r.footerEmail || !/^mailto:[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(r.footerEmail.href) || r.footerEmail.href !== 'mailto:' + r.footerEmail.text) { bad++; console.log('  FAIL footer email'); }
      if (r.footerIconSizes.length > 1) { bad++; console.log('  FAIL footer icons differ in size'); }
      if (r.headerIcons.map(x => x.split(' ')[0]).join(',') !== 'fb,yt,tt' || !r.headerEmail) { bad++; console.log('  FAIL header changed'); }
      const f = await p.$('footer'); await f.scrollIntoViewIfNeeded(); await p.waitForTimeout(300);
      const tag = name + (url === BASE ? '-home' : '-article');
      await f.screenshot({ path: `${OUT}/${tag}-footer.png` }); await p.evaluate(() => scrollTo(0, 0)); await p.waitForTimeout(300);
      await (await p.$('header.logoband')).screenshot({ path: `${OUT}/${tag}-header.png` });
      await ctx.close();
    }
  }
  await b.close(); console.log(bad ? bad + ' problem(s)' : 'footer + header OK'); process.exit(bad ? 1 : 0);
})();
