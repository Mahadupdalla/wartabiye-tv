// Browser test of the article audio player "Dhageyso Warbixinta" (assets/listen.js + workers/tts), desktop and mobile.
// Usage: node tools/listen_test.js <site url> <audio service url> [screenshot dir]
// The site must be built with listen.js's data-endpoint pointing at the audio service. For a test without any provider key,
// run the service with FAKE_TTS=1 (workers/tts/scripts/dev-server.mjs): every part is a test tone.
// Checks: a player on every article, under the headline and byline; nothing asked for before Play; Play, Pause, Resume, Stop,
// seek, speed, volume and the keyboard; the language on screen is the language narrated (so, en, ar, and the others); a
// second listener gets the stored audio; errors leave the article readable; no key in the page. Exit code 1 on any problem.
const { chromium } = require('playwright');
const fs = require('fs');
(async () => {
  const base = process.argv[2].replace(/\/?$/, '/'), svc = process.argv[3].replace(/\/$/, ''), outDir = process.argv[4] || '';
  const news = JSON.parse(fs.readFileSync('data/news.json', 'utf8')).news.filter(n => n.published !== false);
  const problems = [];
  const fail = m => { problems.push(m); console.log('PROBLEM:', m) };
  const ok = m => console.log('ok  ', m);
  const stats = async () => (await (await fetch(svc + '/__stats')).json()).generated;
  const full = news.filter(n => ['en', 'ar', 'fr', 'de', 'it', 'es', 'nl', 'tr'].every(l => n[l] && n[l].title)).sort((a, b) => (b.body || '').length - (a.body || '').length);
  const long = full[0], plain = full[Math.floor(full.length / 2)];
  const b = await chromium.launch();
  const shot = async (p, name) => { if (outDir) { fs.mkdirSync(outDir, { recursive: true }); await p.screenshot({ path: `${outDir}/${name}.png` }); } };

  async function open(ctx, path, lang) {
    const p = await ctx.newPage(); const errs = [], asked = [];
    p.on('pageerror', e => errs.push(e.message));
    p.on('request', r => { if (r.url().startsWith(svc)) asked.push(r.url()); });
    if (lang) await p.addInitScript(l => { try { localStorage.setItem('wartabiye-lang', l) } catch (e) {} }, lang);
    await p.goto(base + path, { waitUntil: 'networkidle' });
    await p.waitForSelector('#story .listen', { timeout: 15000 }).catch(() => {});
    return { p, errs, asked };
  }
  const st = p => p.evaluate(() => { const r = document.querySelector('#story .listen'); return r && { state: r.dataset.state, lang: r.lang, dir: r.dir, label: r.querySelector('.ls-label').textContent, sub: r.querySelector('.ls-sub').textContent, play: r.querySelector('.ls-play').getAttribute('aria-label'), msg: r.querySelector('.ls-msg').textContent }; });
  const hook = async () => {};   // the player's Audio object is reached through WTListen.current()
  const A = (p, f) => p.evaluate(f);

  for (const [w, h, dev] of [[1280, 900, 'desktop'], [390, 844, 'mobile']]) {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, hasTouch: dev === 'mobile', isMobile: dev === 'mobile' });
    // ---- Somali article ----
    const { p, errs, asked } = await open(ctx, `war/${long.id}.html`);
    await hook(p);
    let s = await st(p);
    if (!s) { fail(`${dev}: no player on ${long.id}`); continue; }
    if (s.lang !== 'so' || s.label !== 'Dhageyso Warbixinta' || !/af-Soomaali/.test(s.sub)) fail(`${dev}: Somali labels wrong ${JSON.stringify(s)}`); else ok(`${dev}: Somali player "${s.label}" · ${s.sub}`);
    const order = await p.evaluate(() => [...document.querySelector('#story').children].map(e => e.className || e.tagName).slice(0, 9).join(' > '));
    if (!/H1 > lede > byline > listen > share/.test(order)) fail(`${dev}: player not under the headline and byline: ${order}`); else ok(`${dev}: placement ${order}`);
    if (asked.length) fail(`${dev}: the audio service was asked before Play: ${asked}`); else ok(`${dev}: nothing asked for before Play`);
    const box = await p.locator('#story .listen').boundingBox();
    if (!box || box.x < 0 || box.x + box.width > w + 1) fail(`${dev}: player outside the screen ${JSON.stringify(box)}`);
    const hscroll = await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
    if (hscroll) fail(`${dev}: page scrolls sideways`);
    await p.locator('#story .listen').scrollIntoViewIfNeeded();
    await shot(p, `${dev}-so-idle`);
    const g0 = await stats();
    await p.click('#story .ls-play');
    await p.waitForTimeout(150);
    s = await st(p);
    if (s.state !== 'loading' && s.state !== 'playing') fail(`${dev}: no loading state after Play (${s.state})`); else ok(`${dev}: Play → ${s.state} "${s.label}"`);
    if (s.state === 'loading') await shot(p, `${dev}-so-loading`);
    await p.waitForFunction(() => document.querySelector('#story .listen').dataset.state === 'playing', null, { timeout: 30000 }).catch(() => fail(`${dev}: never started playing`));
    if (!asked.some(u => /\/v1\/listen\?id=.*&lang=so$/.test(u))) fail(`${dev}: Somali article not asked in Somali: ${asked}`);
    await p.waitForTimeout(1500);
    const t1 = await A(p, () => WTListen.current() && WTListen.current().currentTime);
    if (!(t1 > 0.5)) fail(`${dev}: time does not move (${t1})`); else ok(`${dev}: playing, ${t1.toFixed(1)} s`);
    const tot = await p.textContent('#story .ls-tot');
    if (!/\d+:\d\d/.test(tot)) fail(`${dev}: no total duration shown`); else ok(`${dev}: time shown "${await p.textContent('#story .ls-time')}"`);
    await shot(p, `${dev}-so-playing`);
    // pause / resume
    await p.click('#story .ls-play'); await p.waitForTimeout(200);
    s = await st(p); const paused = await A(p, () => WTListen.current().paused);
    if (s.state !== 'paused' || !paused || s.play !== 'Sii wad') fail(`${dev}: pause ${JSON.stringify(s)} paused=${paused}`); else ok(`${dev}: Pause → "${s.play}" button`);
    const tp = await A(p, () => WTListen.current().currentTime); await p.waitForTimeout(600);
    if (Math.abs((await A(p, () => WTListen.current().currentTime)) - tp) > 0.05) fail(`${dev}: time moves while paused`);
    await p.click('#story .ls-play'); await p.waitForTimeout(400);
    s = await st(p); if (s.state !== 'playing') fail(`${dev}: resume ${s.state}`); else ok(`${dev}: Resume`);
    // speed
    for (const r of ['0.75', '1.25', '1.5', '2', '1']) {
      await p.selectOption('#story .ls-speed', r);
      const pr = await A(p, () => WTListen.current().playbackRate);
      if (pr !== parseFloat(r)) fail(`${dev}: speed ${r} → ${pr}`);
    }
    ok(`${dev}: speeds 0.75 1.25 1.5 2 1`);
    // seek (keyboard on the slider, then a set value)
    const dur = await A(p, () => WTListen.current().duration);
    await p.focus('#story .ls-seek'); await p.keyboard.press('End'); await p.waitForTimeout(300);
    const te = await A(p, () => WTListen.current().currentTime);
    if (!(te > dur - 3)) fail(`${dev}: keyboard seek to the end failed (${te} of ${dur})`);
    await p.evaluate(d => { const r = document.querySelector('#story .ls-seek'); r.value = String(d / 2); r.dispatchEvent(new Event('input', { bubbles: true })); r.dispatchEvent(new Event('change', { bubbles: true })); }, dur);
    await p.waitForTimeout(300);
    const ts = await A(p, () => WTListen.current().currentTime);
    if (Math.abs(ts - dur / 2) > 2) fail(`${dev}: seek to the middle → ${ts} of ${dur}`); else ok(`${dev}: seek ${ts.toFixed(1)} / ${dur.toFixed(1)} s, valuetext "${await p.getAttribute('#story .ls-seek', 'aria-valuetext')}"`);
    // volume (desktop only: phones use their own buttons)
    if (dev === 'desktop') {
      await p.click('#story .ls-mute'); if (!(await A(p, () => WTListen.current().muted))) fail('mute does not mute');
      await p.click('#story .ls-mute'); if (await A(p, () => WTListen.current().muted)) fail('unmute does not unmute');
      await p.evaluate(() => { const r = document.querySelector('#story .ls-volr'); r.value = '0.4'; r.dispatchEvent(new Event('input', { bubbles: true })); });
      if (Math.abs((await A(p, () => WTListen.current().volume)) - 0.4) > 0.01) fail('volume slider'); else ok('desktop: mute, unmute, volume 0.4');
    } else if (await p.isVisible('#story .ls-vol')) fail('mobile: volume slider shown on a touch screen');
    await shot(p, `${dev}-so-controls`);
    // stop
    await p.click('#story .ls-stop'); await p.waitForTimeout(200);
    s = await st(p); const ct = await A(p, () => WTListen.current().currentTime), pz = await A(p, () => WTListen.current().paused);
    if (s.state !== 'idle' || ct !== 0 || !pz) fail(`${dev}: stop ${JSON.stringify(s)} t=${ct}`); else ok(`${dev}: Stop → back to the start`);
    // keyboard: Tab to Play, Enter
    await p.focus('#story .ls-play'); await p.keyboard.press('Enter');
    await p.waitForFunction(() => document.querySelector('#story .listen').dataset.state === 'playing', null, { timeout: 15000 }).then(() => ok(`${dev}: keyboard Enter plays`), () => fail(`${dev}: keyboard Enter does not play`));
    // a second press of Play on the same page asks nothing new; the service made the audio once
    const g1 = await stats();
    if (dev === 'desktop' && g1 - g0 < 1) fail('desktop: no generation counted');
    await p.click('#story .ls-play');
    // a second visitor: stored audio, no new generation
    const { p: p2, asked: asked2 } = await open(ctx, `war/${long.id}.html`);
    await hook(p2); await p2.click('#story .ls-play');
    await p2.waitForFunction(() => document.querySelector('#story .listen').dataset.state === 'playing', null, { timeout: 15000 }).catch(() => fail(`${dev}: second visitor never plays`));
    const g2 = await stats();
    if (g2 !== g1) fail(`${dev}: second listener made new audio (${g1} → ${g2})`); else ok(`${dev}: second listener uses the stored audio (no new generation)`);
    const ans = await p2.evaluate(async u => (await fetch(u)).json(), asked2.find(u => u.includes('/v1/listen')));
    if (!ans.cached) fail(`${dev}: answer not marked cached`);
    await p2.close();
    if (errs.length) fail(`${dev}: page errors ${errs}`);
    await p.close();

    // ---- every language: the page's language is the narrated language ----
    const LBL = { en: 'Listen to Article', ar: 'استمع إلى المقال', fr: 'Écouter l’article', de: 'Artikel anhören', it: 'Ascolta l’articolo', es: 'Escuchar el artículo', nl: 'Luister naar het artikel', tr: 'Haberi dinle' };
    for (const lang of Object.keys(LBL)) {
      if (dev === 'mobile' && !['en', 'ar'].includes(lang)) continue;
      const o = await open(ctx, `war/${plain.id}.html?lang=${lang}`, lang);
      await hook(o.p);
      const x = await st(o.p);
      if (!x) { fail(`${dev} ${lang}: no player`); await o.p.close(); continue; }
      if (x.lang !== lang || x.label !== LBL[lang] || x.dir !== (lang === 'ar' ? 'rtl' : 'ltr')) fail(`${dev} ${lang}: ${JSON.stringify(x)}`);
      const h1 = await o.p.textContent('#story h1');
      if (h1.trim() !== plain[lang].title.trim()) fail(`${dev} ${lang}: page not in ${lang}`);
      await o.p.click('#story .ls-play');
      await o.p.waitForFunction(() => document.querySelector('#story .listen').dataset.state === 'playing', null, { timeout: 20000 }).catch(() => fail(`${dev} ${lang}: never plays`));
      const u = o.asked.find(v => v.includes('/v1/listen'));
      if (!u || !u.endsWith('&lang=' + lang)) fail(`${dev} ${lang}: asked ${u}`); else ok(`${dev} ${lang}: "${x.label}" · ${x.sub} → narrated in ${lang}`);
      if (lang === 'ar' || (lang === 'en' && dev === 'mobile')) { await o.p.locator('#story .listen').scrollIntoViewIfNeeded(); await o.p.waitForTimeout(1200); await shot(o.p, `${dev}-${lang}-playing`); }
      await o.p.close();
    }
    // dark theme
    const d = await open(ctx, `war/${plain.id}.html`, 'so');
    await d.p.evaluate(() => { document.documentElement.dataset.theme = 'dark' });
    await d.p.locator('#story .listen').scrollIntoViewIfNeeded(); await shot(d.p, `${dev}-so-dark`); await d.p.close();
    await ctx.close();
  }

  // ---- every article automatically has the player (a sample of 25 across sections and languages) ----
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
  const sample = news.filter((n, i) => i % Math.max(1, Math.floor(news.length / 25)) === 0).slice(0, 25);
  let have = 0;
  for (const n of sample) {
    const o = await open(ctx, `war/${n.id}.html`);
    if (await o.p.$('#story .listen')) have++; else fail(`no player on ${n.id}`);
    if (o.asked.length) fail(`asked before Play on ${n.id}`);
    await o.p.close();
  }
  ok(`${have} of ${sample.length} sampled articles have the player, none asked for audio before Play`);
  // the page's own HTML and scripts hold no provider key or provider address
  const html = await (await fetch(base + `war/${long.id}.html`)).text() + await (await fetch(base + 'assets/listen.js')).text();
  if (/AZURE|Ocp-Apim|subscription-key|tts\.speech\.microsoft|elevenlabs|xi-api-key/i.test(html)) fail('provider key or address in the page'); else ok('no provider key or provider address in the page or the script');
  await ctx.close(); await b.close();
  console.log(problems.length ? `\n${problems.length} PROBLEM(S)` : '\nALL OK');
  process.exit(problems.length ? 1 : 0);
})();
