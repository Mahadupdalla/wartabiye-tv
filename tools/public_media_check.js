// Checks the REAL content of the public website (not local code), desktop and iPhone:
//  - Video News lists publisher videos, and one of them actually PLAYS in YouTube's player (video time moves)
//  - LIVE News shows recent newsroom headlines with links to the full article and a recent check time
//  - LIVE Matches shows real fixtures / results from the data sources (or an honest message, never invented rows)
// Run by .github/workflows/live-site-check.yml. Usage: node tools/public_media_check.js [site url] [screenshot dir]
const { chromium, devices } = require('playwright');
const fs = require('fs');
const SITE = (process.argv[2] || 'https://www.wartabiyetv.com/').replace(/\/?$/, '/');
const OUT = process.argv[3] || 'public-shots';
fs.mkdirSync(OUT, { recursive: true });
const bad = [];
const fail = m => { console.log('PROBLEM:', m); bad.push(m) };
const go = async (p, hash, wait = 5000) => { await p.goto(SITE + '?cb=' + Date.now() + '#' + hash, { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(wait) };

(async () => {
  const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  for (const [name, opt] of [['desktop', { viewport: { width: 1366, height: 900 } }], ['iphone', devices['iPhone 13']]]) {
    const ctx = await b.newContext(opt); const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    // Video News
    await go(p, 'muuqaal');
    const vids = await p.$$eval('#pageView a.vcard', a => [...new Map(a.map(x => [x.getAttribute('href'), x.innerText.replace(/\s+/g, ' ').slice(0, 110)])).entries()]);
    const email = await p.$eval('.hmail', e => e.textContent.trim()).catch(() => '');
    console.log(`${name} header email: ${email || 'MISSING'}`);
    if (email !== 'wartabiyetv@gmail.com') fail(`${name}: email missing in the header`);
    console.log(`${name} Video News: ${vids.length} videos`); vids.slice(0, 6).forEach(v => console.log('   ', v[0], '|', v[1]));
    await p.screenshot({ path: `${OUT}/${name}-video-news.png` });
    if (!vids.length) fail(`${name}: Video News lists no videos`);
    let played = false;
    for (const [href] of vids.slice(0, 3)) {
      await p.goto(SITE + href.replace(/^\//, ''), { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(5000);
      const title = await p.$eval('#pageView h1', e => e.textContent).catch(() => '');
      const src = await p.$eval('#pageView .vwatch iframe', f => f.src).catch(() => '');
      const frame = p.frames().find(f => /youtube(-nocookie)?\.com\/embed\//.test(f.url()));
      console.log(`${name} watch: "${title}" player: ${src}`);
      if (!frame) continue;
      try {
        await frame.click('.ytp-large-play-button, .ytp-play-button, button[aria-label^="Play"]', { timeout: 15000 });
        await p.waitForTimeout(9000);
        const st = await frame.$eval('video', v => ({ time: Math.round(v.currentTime * 10) / 10, paused: v.paused, width: v.videoWidth, height: v.videoHeight }));
        const msg = await frame.$eval('.ytp-error, .ytp-error-content-wrap-reason', e => e.innerText).catch(() => '');
        console.log(`${name} PLAYBACK: ${JSON.stringify(st)} ${msg ? 'player message: ' + msg : ''}`);
        await p.screenshot({ path: `${OUT}/${name}-playing.png` });
        if (st.time > 0 && st.width > 0) { played = true; break }
      } catch (e) { console.log(`${name} play attempt failed: ${e.message.split('\n')[0]}`) }
    }
    if (!played) fail(`${name}: no publisher video played`);
    // LIVE News
    await go(p, 'wararka-tooska');
    const wire = await p.$$eval('#pageView .wirebox .lntl li', l => l.map(x => ({ t: x.innerText.replace(/\s+/g, ' ').slice(0, 140), href: (x.querySelector('a[href^="https://"]') || {}).href || '' })));
    const status = await p.$eval('#pageView .wirest', e => e.innerText.replace(/\s+/g, ' ')).catch(() => '');
    const chans = await p.$$eval('#pageView .lchans .lccard h3', h => h.map(x => x.textContent));
    console.log(`${name} LIVE News: ${wire.length} headlines | ${status} | live channels: ${chans.join(', ')}`);
    wire.slice(0, 8).forEach(w => console.log('   ', w.t, '->', w.href));
    await p.screenshot({ path: `${OUT}/${name}-live-news.png` });
    if (wire.length < 5 || wire.slice(0, 5).some(w => !w.href)) fail(`${name}: LIVE News has fewer than 5 linked headlines`);
    if (/lnwarn/.test(await p.$eval('#pageView .wirest', e => e.innerHTML).catch(() => ''))) fail(`${name}: LIVE News data is stale`);
    if (chans.length) {
      await p.click('#pageView .lcplay'); await p.waitForTimeout(4000);
      const lf = await p.$$eval('#pageView .lchans iframe', f => f.map(x => x.src));
      console.log(`${name} live channel player: ${lf[0] || 'none'}`);
      if (!lf.length) fail(`${name}: live channel player did not load`);
      await p.screenshot({ path: `${OUT}/${name}-live-channel.png` });
    }
    // LIVE Matches
    await go(p, 'ciyaaraha-toos', 7000);
    const heads = await p.$$eval('#pageView h3.sgh', h => h.map(x => x.textContent));
    const rows = await p.$$eval('#pageView .mrow', r => r.map(x => (x.classList.contains('is-live') ? '[LIVE] ' : '') + x.innerText.replace(/\s+/g, ' ')));
    console.log(`${name} LIVE Matches: sections ${JSON.stringify(heads)}, ${rows.length} matches`); rows.slice(0, 12).forEach(r => console.log('   ', r));
    await p.screenshot({ path: `${OUT}/${name}-live-matches.png`, fullPage: true });
    if (!heads.length) fail(`${name}: LIVE Matches overview missing`);
    if (!rows.length && !/unavailable|lama heli karo/i.test(await p.$eval('#pageView', e => e.innerText))) fail(`${name}: LIVE Matches shows neither matches nor a message`);
    if (errs.length) fail(`${name}: page errors ${[...new Set(errs)].join('; ')}`);
    await ctx.close();
  }
  await b.close();
  console.log(bad.length ? `PROBLEMS: ${bad.length}` : 'PUBLIC MEDIA OK');
  process.exit(bad.length ? 1 : 0);
})();
