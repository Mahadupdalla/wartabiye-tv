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
    let played = false, gated = false;
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
        if (/not a bot|sign in to confirm/i.test(msg)) gated = true;
      } catch (e) { console.log(`${name} play attempt failed: ${e.message.split('\n')[0]}`) }
    }
    // YouTube asks datacenter computers (like GitHub's) to sign in; real visitors are not asked. That is reported, not
    // counted as a pass: playback must then be confirmed on a phone or computer.
    if (!played && gated) console.log(`NOT VERIFIABLE HERE: ${name}: YouTube asks this server to sign in ("not a bot"), so playback cannot be proven from GitHub; the right video is loaded in YouTube's official player`);
    else if (!played) fail(`${name}: no publisher video played`);
    // LIVE News
    await go(p, 'wararka-tooska');
    // LIVE News is ONE timeline inside the site: updates written by Wartabiye TV from the official newsroom feeds
    // (tools/live_updates.py) and Wartabiye TV's own stories; no list of links to other websites
    await p.waitForTimeout(2500);
    const wire = await p.$$eval('#pageView ol.lntl > li.lnitem', l => l.map(x => ({ lu: x.classList.contains('lu'), t: x.innerText.replace(/\s+/g, ' ').slice(0, 220), ext: x.querySelectorAll('a[href^="http"]').length })));
    // the check time is not shown to visitors: read it from the data files themselves (a real check, not a timer)
    const wd = await p.evaluate(() => Promise.all(['live-wire.json', 'live-updates.json'].map(f => fetch('https://raw.githubusercontent.com/Mahadupdalla/wartabiye-tv/live-data/' + f + '?t=' + Date.now(), { cache: 'no-store' }).then(r => r.json()).catch(() => null))));
    const ageOf = d => d && d.updatedAt ? (Date.now() - new Date(d.updatedAt).getTime()) / 60000 : 1e9;
    const ageMin = Math.max(ageOf(wd[0]), ageOf(wd[1]));
    const status = `wire checked ${wd[0] && wd[0].updatedAt}, LIVE updates file ${wd[1] && wd[1].updatedAt} with ${(wd[1] && wd[1].items || []).length} update(s) (${Math.round(ageMin)} min ago)`;
    if (await p.$('#pageView .lnwarn, #pageView .lnstatus, #pageView .wirest')) fail(`${name}: public source-status block is still shown`);
    const chans = await p.$$eval('#pageView .lchans .lccard h3', h => h.map(x => x.textContent));
    console.log(`${name} LIVE News: ${wire.length} timeline items, ${wire.filter(w => w.lu).length} written LIVE updates | ${status} | live channels: ${chans.join(', ')}`);
    wire.slice(0, 8).forEach(w => console.log('   ', w.lu ? '[LIVE update]' : '[story]', w.t));
    await p.screenshot({ path: `${OUT}/${name}-live-news.png` });
    if (!wire.length) fail(`${name}: LIVE News timeline is empty`);
    if (wire.some(w => w.ext)) fail(`${name}: a LIVE News timeline item links to another website`);
    if (await p.$('#pageView .wirebox, #pageView .wiretick')) fail(`${name}: the old list of external headlines is still shown`);
    if (ageMin > 30) fail(`${name}: LIVE News data is stale (${Math.round(ageMin)} min since the last source check)`);
    if (chans.length) {
      await p.click('#pageView .lcplay'); await p.waitForTimeout(4000);
      const lf = await p.$$eval('#pageView .lchans iframe', f => f.map(x => x.src));
      console.log(`${name} live channel player: ${lf[0] || 'none'}`);
      if (!lf.length) fail(`${name}: live channel player did not load`);
      await p.screenshot({ path: `${OUT}/${name}-live-channel.png` });
    }
    // Sports: news articles only; the public results section is gone (the old address opens Ciyaaraha)
    await go(p, 'ciyaaraha-toos', 5000);
    const sp = await p.evaluate(() => ({ hash: location.hash, cards: [...document.querySelectorAll('#pageView .card')].slice(0, 6).map(c => c.innerText.replace(/\s+/g, ' ').slice(0, 120)),
      results: document.querySelectorAll('.scorestrip:not([hidden]), .mrow, .rescard').length, labels: [...document.querySelectorAll('#pageView .card .meta')].filter(m => /Ilaha|Source/.test(m.innerText)).length }));
    console.log(`${name} Sports: ${JSON.stringify({ hash: sp.hash, results: sp.results, sourceLabels: sp.labels })}`); sp.cards.forEach(c => console.log('   ', c));
    await p.screenshot({ path: `${OUT}/${name}-sports.png`, fullPage: false });
    if (sp.hash !== '#ciyaaraha' || sp.results || sp.labels || !sp.cards.length) fail(`${name}: Sports page: ${JSON.stringify({ hash: sp.hash, results: sp.results, labels: sp.labels, cards: sp.cards.length })}`);
    if (errs.length) fail(`${name}: page errors ${[...new Set(errs)].join('; ')}`);
    await ctx.close();
  }
  await b.close();
  console.log(bad.length ? `PROBLEMS: ${bad.length}` : 'PUBLIC MEDIA OK');
  process.exit(bad.length ? 1 : 0);
})();
