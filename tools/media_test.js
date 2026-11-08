// Browser test of Video News (#muuqaal), LIVE TV (#toos) and LIVE Sports (#ciyaaraha-toos), desktop and mobile.
// Usage: node tools/media_test.js <site url> [screenshot dir]. Exit code 1 on any problem.
// The site's own data is used first (nothing must claim to be live); then test data is served to the browser with
// Playwright (page.route) to check every state: videos, a verified live stream, a stale or expired one, the sports
// centre with a test sports-data service, and broadcasting rights. The test data never leaves the test browser.
const { chromium } = require('playwright');
const base = process.argv[2], out = process.argv[3] || '.';
const problems = []; const fail = m => { problems.push(m); console.log('PROBLEM:', m) };
const iso = ms => new Date(Date.now() + ms).toISOString();
const YT = 'dQw4w9WgXcQ';
const VIDEOS = { videos: [
  { id: '2026-11-08-test-video-somalia', title: 'Muuqaal tijaabo: shirka golaha wasiirada', summary: 'Warbixin muuqaal ah oo tijaabo ah.', body: 'Baaragaraafka koowaad.\n\nBaaragaraafka labaad.', kind: 'somalia', language: 'so', featured: true, youtube: 'https://www.youtube.com/watch?v=' + YT, duration: '2:35', publishedAt: iso(-3600e3), source: 'Wartabiye TV', license: 'Wartabiye TV', en: { title: 'Test video: cabinet meeting', summary: 'A test video report.' } },
  { id: '2026-11-07-test-video-sport', title: 'Ciyaaraha: kulan tijaabo ah', summary: 'Muuqaal ciyaareed.', kind: 'sports', language: 'so', file: 'https://example.com/clip.mp4', publishedAt: iso(-86400e3), source: 'Wartabiye TV', tags: ['kubadda'] },
  { id: '2026-11-06-test-video-world', title: 'Adduunka: wareysi tijaabo ah', kind: 'interview', language: 'en', embed: 'https://vimeo.com/123456', publishedAt: iso(-2 * 86400e3), source: 'Partner TV', credit: 'Partner TV', license: 'Oggolaansho qoran' },
  { id: '2026-11-05-bad-link', title: 'Link aan la oggolayn', kind: 'world', embed: 'https://pirate.example/stream', publishedAt: iso(-3 * 86400e3) },
  { id: '2026-12-01-scheduled', title: 'Muuqaal jadwalaysan', kind: 'world', youtube: 'https://youtu.be/' + YT, publishedAt: iso(-1000), publishAt: iso(30 * 86400e3) },
] };
const SCHEDULE = [{ title: 'Wararka Fiidkii', start: iso(5 * 3600e3), end: iso(6 * 3600e3), language: 'so', description: 'Wararka maalinta' }];
const LIVE_CFG = { channelName: 'Wartabiye TV', streamUrl: 'https://www.youtube.com/channel/UC1234567890123456789012', statusMode: 'auto', chat: true, schedule: SCHEDULE };
const MATCH = { id: 501, utcDate: iso(-3600e3), status: 'LIVE', minute: 63, competition: { id: 'PL', name: 'Premier League', area: 'England', emblem: null }, home: { id: 57, name: 'Arsenal', crest: null }, away: { id: 61, name: 'Chelsea', crest: null },
  score: { home: 1, away: 0, halfTime: { home: 1, away: 0 } }, venue: 'Emirates Stadium', referee: 'M. Oliver',
  events: [{ minute: 22, type: 'goal', team: 'home', player: 'B. Saka', detail: null }, { minute: 40, type: 'yellow', team: 'away', player: 'M. Caicedo' }], statistics: [{ type: 'Ball possession', home: 55, away: 45 }] };
const FT = Object.assign({}, MATCH, { id: 502, status: 'FT', minute: null, home: { id: 64, name: 'Liverpool' }, away: { id: 65, name: 'Man City' }, score: { home: 2, away: 2 } });
const SPORTS = { apiBase: 'https://sports.test', providerName: 'test provider', refreshSeconds: 60, competitions: [{ id: 'PL', name: 'Premier League' }],
  viewingInfo: [{ competition: 'Premier League', text: 'Official broadcasters', url: 'https://www.premierleague.com/broadcast-schedules' }],
  streams: [
    { title: 'Pirate stream (must never show)', matchId: '501', url: 'https://www.youtube.com/watch?v=' + YT, start: iso(-7200e3), end: iso(7200e3), rightsHolder: 'Nobody', authorization: '', rightsConfirmed: false },
    { title: 'Authorised: Arsenal v Chelsea', matchId: '501', url: 'https://www.youtube.com/watch?v=' + YT, start: iso(-7200e3), end: iso(7200e3), rightsHolder: 'Test Rights Holder', authorization: 'Contract 1', rightsConfirmed: true },
  ] };
const API = { '/v1/live': { provider: 'test provider', updatedAt: iso(0), matches: [MATCH] }, '/v1/matches': { provider: 'test provider', updatedAt: iso(0), matches: [MATCH, FT] },
  '/v1/match': { provider: 'test provider', updatedAt: iso(0), match: MATCH, eventsAvailable: true, statisticsAvailable: true },
  '/v1/standings': { provider: 'test provider', updatedAt: iso(0), competition: { name: 'Premier League' }, table: [{ position: 1, team: { id: 57, name: 'Arsenal' }, played: 11, won: 8, draw: 2, lost: 1, goalDifference: 15, points: 26 }] },
  '/v1/team': { provider: 'test provider', team: { id: 57, name: 'Arsenal', country: 'England', founded: 1886, venue: 'Emirates Stadium' }, matches: [MATCH] } };

async function mock(ctx, data) {
  await ctx.route(/\/data\/(videos|live|live-status|sports)\.json/, r => { const k = r.request().url().match(/data\/([a-z-]+)\.json/)[1]; return k in data ? r.fulfill({ json: data[k] }) : r.continue() });
  await ctx.route(/^https:\/\/sports\.test\//, r => { const p = new URL(r.request().url()).pathname; return r.fulfill({ json: API[p] || {}, headers: { 'Access-Control-Allow-Origin': '*' } }) });
  // no real player loads in the test (no network to video providers needed)
  await ctx.route(/youtube(-nocookie)?\.com|ytimg\.com|vimeo\.com|example\.com\/clip/, r => r.fulfill({ body: '', contentType: 'text/html' }));
}
async function go(p, hash) { await p.goto(base + (hash ? '#' + hash : ''), { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(1200) }
const st = p => p.evaluate(() => ({ onair: document.querySelectorAll('#pageView .onair').length, btn: document.getElementById('liveBtn').className, btnText: document.getElementById('liveBtn').textContent.trim(),
  iframes: [...document.querySelectorAll('#pageView iframe')].map(f => f.src), offline: !!document.querySelector('#pageView .offline'), overflow: document.documentElement.scrollWidth > innerWidth, text: document.getElementById('pageView').innerText }));

(async () => {
  const b = await chromium.launch();
  for (const [w, h, name] of [[1280, 900, 'desktop'], [390, 844, 'mobile']]) {
    const errs = [];
    // 1. the real site data: nothing may claim to be live unless data/live-status.json is fresh and live
    let ctx = await b.newContext({ viewport: { width: w, height: h } }); let p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
    const real = await (await ctx.request.get(base + 'data/live-status.json?ts=' + Date.now())).json().catch(() => ({}));
    await go(p, 'toos'); let s = await st(p);
    const fresh = real.live === true && real.checkedAt && Date.now() - new Date(real.checkedAt) < 3600e3;
    console.log(name, 'real LIVE TV page:', s.offline ? 'offline' : 'live', '| status file live =', real.live, '| button', s.btnText);
    if (!fresh && (s.onair || /\bon\b/.test(s.btn))) fail(`${name}: LIVE shown without a verified broadcast`);
    if (s.overflow) fail(`${name}: LIVE TV page scrolls sideways`);
    await p.screenshot({ path: `${out}/media-${name}-live-real.png` });
    await go(p, 'ciyaaraha-toos'); s = await st(p); console.log(name, 'real sports page:', s.text.slice(0, 90).replace(/\s+/g, ' '));
    if (/\d+\s*[–-]\s*\d+/.test(s.text) && !/https:\/\//.test((await (await ctx.request.get(base + 'data/sports.json')).text()))) fail(`${name}: a score is shown without a sports-data service`);
    await go(p, 'muuqaal'); s = await st(p); if (s.overflow) fail(`${name}: Video News scrolls sideways`);
    await ctx.close();

    // 2. Video News with test videos
    ctx = await b.newContext({ viewport: { width: w, height: h } }); await mock(ctx, { videos: VIDEOS, 'live-status': { live: false, checkedAt: iso(0) }, live: LIVE_CFG });
    p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
    await go(p, 'muuqaal'); s = await st(p);
    const cards = await p.$$eval('#pageView a.vcard', a => [...new Set(a.map(x => x.getAttribute('href')))]);
    console.log(name, 'videos listed:', cards.length);
    if (cards.length !== 3) fail(`${name}: expected 3 playable videos (bad link and scheduled video hidden), got ${cards.length}`);
    if (cards.some(c => /bad-link|scheduled/.test(c))) fail(`${name}: an unauthorised or scheduled video is listed`);
    await p.screenshot({ path: `${out}/media-${name}-videos.png`, fullPage: name === 'desktop' });
    await go(p, 'muuqaal?q=wareysi'); if ((await p.$$('#pageView .vgrid a.vcard')).length !== 1) fail(`${name}: video search`);
    await go(p, 'muuqaal?k=sports'); if ((await p.$$('#pageView .vgrid a.vcard')).length !== 1) fail(`${name}: video category`);
    await go(p, 'muuqaal?v=2026-11-08-test-video-somalia'); s = await st(p);
    const ld = await p.evaluate(() => { const x = document.getElementById('wt-media-ld'); return x ? JSON.parse(x.textContent) : null });
    const fs = await p.$eval('#pageView .vwatch iframe', f => f.allowFullscreen && /fullscreen/.test(f.allow)).catch(() => false);
    console.log(name, 'watch page:', s.iframes[0], '| VideoObject', ld && ld['@type'], '| fullscreen', fs);
    if (!s.iframes[0] || !s.iframes[0].startsWith('https://www.youtube-nocookie.com/embed/' + YT)) fail(`${name}: watch page has no YouTube player`);
    if (!ld || ld['@type'] !== 'VideoObject' || !ld.uploadDate) fail(`${name}: VideoObject structured data missing`);
    if (!fs) fail(`${name}: full-screen not allowed`);
    if (!/Muuqaallo la xiriira|Muuqaalladii ugu dambeeyay/.test(s.text)) fail(`${name}: related / recent videos missing`);
    if (s.overflow) fail(`${name}: watch page scrolls sideways`);
    await p.screenshot({ path: `${out}/media-${name}-watch.png`, fullPage: name === 'desktop' });
    await go(p, 'muuqaal?v=2026-11-07-test-video-sport'); if (!(await p.$('#pageView .vwatch video[controls]'))) fail(`${name}: own .mp4 video has no player`);
    await go(p, 'hoyga'); await p.waitForTimeout(500);
    if (!(await p.$('#blocks .vhome a.vcard'))) fail(`${name}: featured video not on the homepage`);
    await ctx.close();

    // 3. LIVE TV states
    const cases = [
      ['verified live (fresh YouTube check)', { live: LIVE_CFG, 'live-status': { live: true, videoId: YT, title: 'Wararka Toos', startedAt: iso(-600e3), checkedAt: iso(-300e3), source: 'YouTube Data API' } }, true],
      ['stale check (2 hours old)', { live: LIVE_CFG, 'live-status': { live: true, videoId: YT, checkedAt: iso(-7200e3) } }, false],
      ['manual on air, end time passed', { live: Object.assign({}, LIVE_CFG, { statusMode: 'manual', onAir: true, streamUrl: 'https://www.youtube.com/watch?v=' + YT, onAirUntil: iso(-60e3) }), 'live-status': {} }, false],
      ['manual on air, until later today', { live: Object.assign({}, LIVE_CFG, { statusMode: 'manual', onAir: true, streamUrl: 'https://www.youtube.com/watch?v=' + YT, onAirUntil: iso(3600e3) }), 'live-status': {} }, true],
      ['manual on air without a stream link', { live: Object.assign({}, LIVE_CFG, { statusMode: 'manual', onAir: true, streamUrl: '', onAirUntil: iso(3600e3) }), 'live-status': {} }, false],
    ];
    for (const [label, data, want] of cases) {
      ctx = await b.newContext({ viewport: { width: w, height: h } }); await mock(ctx, data); p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
      await go(p, 'toos'); s = await st(p);
      const live = s.onair > 0 && !s.offline && / on\b|^on\b/.test(s.btn);
      console.log(name, 'LIVE TV', label, '->', live ? 'LIVE' : 'offline', s.iframes.length ? '(' + s.iframes.length + ' frame(s))' : '');
      if (live !== want) fail(`${name}: LIVE TV "${label}" shows ${live ? 'LIVE' : 'offline'}`);
      if (want && !s.iframes.some(f => f.includes(YT))) fail(`${name}: live player missing (${label})`);
      if (!want && s.iframes.length) fail(`${name}: a player is shown while offline (${label})`);
      if (/viewers|daawadayaal\s*\d|\d+\s*(watching|viewers)/i.test(s.text)) fail(`${name}: viewer count shown`);
      if (!/Wararka Fiidkii/.test(s.text)) fail(`${name}: schedule missing (${label})`);
      if (want && label.startsWith('verified') && !s.iframes.some(f => f.includes('live_chat'))) fail(`${name}: chat not shown though enabled`);
      if (label.startsWith('verified') || label.startsWith('stale')) await p.screenshot({ path: `${out}/media-${name}-live-${want ? 'on' : 'off'}.png` });
      if (want) { await go(p, 'hoyga'); await p.waitForTimeout(400); if (!(await p.$('#blocks .livebar'))) fail(`${name}: homepage LIVE banner missing during a verified broadcast`) }
      await ctx.close();
    }

    // 4. LIVE Sports with a test sports-data service
    ctx = await b.newContext({ viewport: { width: w, height: h } }); await mock(ctx, { sports: SPORTS }); p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
    await go(p, 'ciyaaraha-toos'); s = await st(p);
    const rows = await p.$$eval('#pageView .mrow', r => r.map(x => ({ live: x.classList.contains('is-live'), t: x.innerText.replace(/\s+/g, ' ') })));
    console.log(name, 'sports live tab:', JSON.stringify(rows));
    if (!rows.length || !rows[0].live || !/1 – 0/.test(rows[0].t)) fail(`${name}: live match row`);
    if (/Pirate stream/.test(s.text)) fail(`${name}: stream without confirmed rights is shown`);
    if (!/Authorised: Arsenal v Chelsea/.test(s.text)) fail(`${name}: authorised stream not shown`);
    if (!/test provider/.test(s.text)) fail(`${name}: data provider credit missing`);
    if (s.overflow) fail(`${name}: sports page scrolls sideways`);
    await p.screenshot({ path: `${out}/media-${name}-sports.png`, fullPage: name === 'desktop' });
    await go(p, 'ciyaaraha-toos?tab=today'); if ((await p.$$('#pageView .mrow')).length !== 2) fail(`${name}: today tab`);
    await go(p, 'ciyaaraha-toos?tab=table&c=PL'); if (!/Arsenal/.test((await st(p)).text) || !(await p.$('#pageView .stable td.pts'))) fail(`${name}: standings`);
    await go(p, 'ciyaaraha-toos?m=501'); s = await st(p);
    if (!/B\. Saka/.test(s.text) || !/Ball possession/.test(s.text) || !/Emirates Stadium/.test(s.text)) fail(`${name}: match events / statistics / venue`);
    if (!s.iframes.some(f => f.includes(YT))) fail(`${name}: authorised match stream missing on match page`);
    await p.screenshot({ path: `${out}/media-${name}-match.png`, fullPage: name === 'desktop' });
    await go(p, 'ciyaaraha-toos?t=57'); if (!/1886/.test((await st(p)).text)) fail(`${name}: team page`);
    await ctx.close();
    // sports-data service down: an error message, never old or made-up numbers
    ctx = await b.newContext({ viewport: { width: w, height: h } }); await mock(ctx, { sports: SPORTS }); await ctx.route(/^https:\/\/sports\.test\//, r => r.fulfill({ status: 502, json: { error: 'x' } }));
    p = await ctx.newPage(); await go(p, 'ciyaaraha-toos'); if (await p.$('#pageView .mrow')) fail(`${name}: rows shown while the data service is down`); await ctx.close();

    // 5. every language: menu entries and page titles translated, Arabic right-to-left
    if (name === 'desktop') {
      ctx = await b.newContext({ viewport: { width: w, height: h } }); await mock(ctx, { videos: VIDEOS }); p = await ctx.newPage();
      for (const l of ['so', 'en', 'ar', 'fr', 'nl', 'it', 'de', 'tr', 'es']) {
        await p.goto(base + '?lang=' + l + '#toos', { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(700);
        const r = await p.evaluate(() => ({ dir: document.documentElement.dir, h1: document.querySelector('#pageView h1').textContent, nav: [...document.querySelectorAll('#links a')].map(a => a.getAttribute('href') + '=' + a.textContent).filter(x => /#(muuqaal|toos|ciyaaraha-toos)=/.test(x)), raw: document.getElementById('pageView').innerText.match(/\b[ms][A-Z][a-zA-Z]+\b/g) }));
        console.log(l, JSON.stringify(r));
        if (r.nav.length !== 3) fail(`${l}: menu entries missing`);
        if (r.raw) fail(`${l}: untranslated text key ${r.raw}`);
        if ((l === 'ar') !== (r.dir === 'rtl')) fail(`${l}: direction ${r.dir}`);
      }
      await ctx.close();
    }
    if (errs.length) fail(name + ' page errors: ' + [...new Set(errs)].join('; '));
  }
  await b.close();
  if (problems.length) { console.log('PROBLEMS:', problems.length); process.exit(1) }
  console.log('MEDIA OK');
})();
