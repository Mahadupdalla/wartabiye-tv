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

// open football data (OpenLigaDB), test copy: a finished match, one in play, one whose result is overdue, one later
const OLT = (id, name) => ({ teamId: id, teamName: name + ' FC', shortName: name, teamIconUrl: null });
const OLM = (id, kick, fin, t1, t2, goals, results) => ({ matchID: id, matchDateTimeUTC: new Date(Date.now() + kick).toISOString().replace(/\.\d+Z$/, 'Z'), leagueShortcut: 'bl1', leagueName: '1. Fußball-Bundesliga 2026/2027', leagueSeason: 2026,
  group: { groupName: '9. Spieltag', groupOrderID: 9 }, team1: t1, team2: t2, matchIsFinished: fin, matchResults: results || [], goals: goals || [], location: { locationStadium: 'Teststadion', locationCity: 'Teststadt' }, numberOfViewers: 50000 });
const R = (h1, a1, h2, a2) => [{ resultTypeID: 1, resultOrderID: 1, pointsTeam1: h1, pointsTeam2: a1 }, { resultTypeID: 2, resultOrderID: 2, pointsTeam1: h2, pointsTeam2: a2 }];
const OL_ROUND = [
  OLM(9001, -26 * 3600e3, true, OLT(40, 'Bayern'), OLT(7, 'Dortmund'), [{ goalID: 1, scoreTeam1: 1, scoreTeam2: 0, matchMinute: 12, goalGetterName: 'H. Kane', scoringTeamId: 40, isPenalty: true, isOwnGoal: false }, { goalID: 2, scoreTeam1: 2, scoreTeam2: 0, matchMinute: 70, goalGetterName: 'J. Musiala', scoringTeamId: 40 }, { goalID: 3, scoreTeam1: 2, scoreTeam2: 1, matchMinute: 88, goalGetterName: 'S. Guirassy', scoringTeamId: 7 }], R(1, 0, 2, 1)),
  OLM(9002, -40 * 60e3, false, OLT(16, 'Stuttgart'), OLT(9, 'Schalke'), [{ goalID: 4, scoreTeam1: 0, scoreTeam2: 1, matchMinute: 31, goalGetterName: 'K. Karaman', scoringTeamId: 9 }], []),
  OLM(9003, -4 * 3600e3, false, OLT(1635, 'Leipzig'), OLT(81, 'Mainz'), [], []),
  OLM(9004, 3 * 3600e3, false, OLT(6, 'Leverkusen'), OLT(65, 'Köln'), [], []),
];
const OL_TABLE = [{ teamInfoId: 40, teamName: 'FC Bayern München', shortName: 'Bayern', points: 25, matches: 9, won: 8, draw: 1, lost: 0, goalDiff: 22 }, { teamInfoId: 7, teamName: 'Borussia Dortmund', shortName: 'Dortmund', points: 21, matches: 9, won: 6, draw: 3, lost: 0, goalDiff: 9 }];
const OPEN_CFG = { apiBase: '', refreshSeconds: 60, competitions: [{ id: 'PL', name: 'Premier League' }, { id: 'BL1', name: 'Bundesliga' }],
  openData: { enabled: true, leagues: [{ id: 'bl1', season: 2026, name: 'Bundesliga', same: 'BL1' }] }, viewingInfo: [], streams: [] };
function olRoute(r) {
  const u = new URL(r.request().url()), p = u.pathname, j = x => r.fulfill({ json: x, headers: { 'Access-Control-Allow-Origin': '*' } });
  if (p === '/getcurrentgroup/bl1') return j({ groupName: '9. Spieltag', groupOrderID: 9 });
  if (p === '/getmatchdata/bl1/2026/9') return j(OL_ROUND);
  if (/^\/getmatchdata\/bl1\/2026\/\d+$/.test(p)) return j([]);
  if (p === '/getbltable/bl1/2026') return j(OL_TABLE);
  let m = /^\/getmatchdata\/(\d+)$/.exec(p); if (m) return j(OL_ROUND.find(x => String(x.matchID) === m[1]) || null);
  m = /^\/getmatchesbyteamid\/(\d+)\//.exec(p); if (m) return j(OL_ROUND.filter(x => String(x.team1.teamId) === m[1] || String(x.team2.teamId) === m[1]));
  return r.fulfill({ status: 404, body: '' });
}
// football-data.org feed written by GitHub Actions (data/sports-feed), test copy
const FEEDM = (id, st, comp, h, a, sh, sa) => ({ id, utcDate: iso(-50 * 60e3), status: st, minute: st === 'LIVE' ? 50 : null, competition: { id: comp, name: comp === 'PL' ? 'Premier League' : 'Bundesliga' }, home: { id: id * 10, name: h }, away: { id: id * 10 + 1, name: a }, score: { home: sh, away: sa, halfTime: {} } });
const feed = age => ({ index: { provider: 'football-data.org', updatedAt: iso(-age), competitions: [{ id: 'PL', name: 'Premier League' }, { id: 'BL1', name: 'Bundesliga' }] },
  window: { provider: 'football-data.org', updatedAt: iso(-age), matches: [FEEDM(71, 'LIVE', 'PL', 'Arsenal', 'Chelsea', 1, 0), FEEDM(72, 'LIVE', 'BL1', 'Bayern', 'Dortmund', 9, 9)] },
  'standings-PL': { provider: 'football-data.org', updatedAt: iso(-age), competition: { name: 'Premier League' }, table: [{ position: 1, team: { id: 710, name: 'Arsenal' }, played: 11, won: 8, draw: 2, lost: 1, goalDifference: 15, points: 26 }] } });

const LD = age => ({
  'video-feed.json': { updatedAt: iso(-age), videos: [
    { id: 'yt-' + YT, videoId: YT, title: 'Wararka BBC Somali', summary: '', kind: 'somalia', language: 'so', youtube: 'https://www.youtube.com/watch?v=' + YT, publishedAt: iso(-2 * 3600e3), source: 'BBC News Somali', sourceUrl: 'https://www.youtube.com/channel/UC_QuRsbRQpaC4iS8WlxW0NA', license: 'YouTube embed', auto: true },
    { id: 'yt-abcdefghijk', videoId: 'abcdefghijk', title: 'World news report', kind: 'world', language: 'en', youtube: 'https://www.youtube.com/watch?v=abcdefghijk', publishedAt: iso(-5 * 3600e3), source: 'DW News', license: 'YouTube embed', auto: true },
    { id: 'yt-notallowed', videoId: 'x', title: 'Notallowed', youtube: 'not a link', publishedAt: iso(-3600e3), source: 'X', auto: true }],
    liveChannels: [{ name: 'Al Jazeera English', channelId: 'UCNye-wNBqNL5ZzHSJj3l8Bg', language: 'en', watchUrl: 'https://www.youtube.com/channel/UCNye-wNBqNL5ZzHSJj3l8Bg/live' }] },
  'live-wire.json': { updatedAt: iso(-age), items: [
    { id: 'a1', title: 'Shir ka dhacay Muqdisho', url: 'https://www.bbc.com/somali/articles/x1', source: 'BBC Somali', region: 'somalia', language: 'so', publishedAt: iso(-10 * 60e3) },
    { id: 'a2', title: 'Kenya election update', url: 'https://www.aljazeera.com/news/x2', source: 'Al Jazeera', region: 'eastafrica', language: 'en', publishedAt: iso(-40 * 60e3), updatedAt: iso(-5 * 60e3), previousTitle: 'Kenya election' },
    { id: 'a3', title: 'World leaders meet', url: 'https://www.dw.com/en/x3', source: 'DW News', region: 'world', language: 'en', publishedAt: iso(-90 * 60e3) },
    { id: 'a4', title: 'Bad link', url: 'javascript:alert(1)', source: 'X', region: 'world', publishedAt: iso(-60e3) }] },
  'feeds-status.json': { checkedAt: iso(-age), sources: { 'wire:bbc-somali': { name: 'BBC Somali', kind: 'wire', checkedAt: iso(-age), ok: true, lastOkAt: iso(-age), items: 12, newest: iso(-10 * 60e3) } } } });
async function mock(ctx, data) {
  // open data: only the test copy when given, otherwise unreachable (the page must then say the data is unavailable)
  await ctx.route(/^https:\/\/api\.openligadb\.de\//, r => data.ol ? olRoute(r) : r.abort());
  await ctx.route(/\/data\/sports-feed\/([a-zA-Z0-9-]+)\.json/, r => { const k = r.request().url().match(/sports-feed\/([a-zA-Z0-9-]+)\.json/)[1]; return data.feed && data.feed[k] ? r.fulfill({ json: data.feed[k] }) : r.fulfill({ status: 404, body: '' }) });
  await ctx.route(/\/data\/(videos|live|live-status|sports)\.json/, r => { const k = r.request().url().match(/data\/([a-z-]+)\.json/)[1]; return k in data ? r.fulfill({ json: data[k] }) : r.continue() });
  // Video News / LIVE News feeds written by GitHub Actions (branch live-data, fallback data/live-feeds): test copy only
  const ld = r => { const k = r.request().url().match(/([a-z-]+\.json)/)[1]; return data.ld && data.ld[k] ? r.fulfill({ json: data.ld[k], headers: { 'Access-Control-Allow-Origin': '*' } }) : r.fulfill({ status: 404, body: '' }) };
  await ctx.route(/^https:\/\/raw\.githubusercontent\.com\/[^/]+\/[^/]+\/live-data\//, ld);
  await ctx.route(/\/data\/live-feeds\/[a-z-]+\.json/, ld);
  await ctx.route(/^https:\/\/sports\.test\//, r => { const p = new URL(r.request().url()).pathname; return r.fulfill({ json: API[p] || {}, headers: { 'Access-Control-Allow-Origin': '*' } }) });
  // no real player loads in the test (no network to video providers needed)
  await ctx.route(/youtube(-nocookie)?\.com|ytimg\.com|vimeo\.com|example\.com\/clip/, r => r.fulfill({ body: '', contentType: 'text/html' }));
}
// the live website against the open data itself: every finished Bundesliga result of the current round must appear
// on the page with the same score (only when this computer can reach api.openligadb.de, as GitHub Actions can)
async function realSports(ctx, p) {
  const cfg = await (await ctx.request.get(base + 'data/sports.json?ts=' + Date.now())).json().catch(() => ({}));
  const lg = ((cfg.openData || {}).leagues || []).find(l => l && l.id === 'bl1' && l.enabled !== false);
  if (!lg || (cfg.openData || {}).enabled === false || /^https:/.test(cfg.apiBase || '')) { console.log('real sports: open data not in use, skipped'); return }
  let round;
  try { const g = await (await ctx.request.get('https://api.openligadb.de/getcurrentgroup/bl1', { timeout: 15000 })).json(); round = await (await ctx.request.get(`https://api.openligadb.de/getmatchdata/bl1/${lg.season}/${g.groupOrderID}`, { timeout: 15000 })).json(); }
  catch (e) { console.log('real sports: api.openligadb.de not reachable from here, skipped'); return }
  const done = round.filter(m => m.matchIsFinished && m.matchResults && m.matchResults.length);
  for (const m of round.filter(m => !m.matchIsFinished && Date.parse(m.matchDateTimeUTC) > Date.now() + 3600e3)) done.push(m); // and upcoming ones
  await go(p, 'ciyaaraha-toos?tab=results&c=bl1'); await p.waitForTimeout(2500); const res = (await st(p)).text;
  await go(p, 'ciyaaraha-toos?tab=fixtures&c=bl1'); await p.waitForTimeout(2500); const fix = (await st(p)).text;
  let checked = 0;
  for (const m of done) {
    const fin = m.matchIsFinished && (m.matchResults.find(r => r.resultTypeID === 2) || m.matchResults[m.matchResults.length - 1]);
    const want = [m.team1.shortName || m.team1.teamName, fin ? fin.pointsTeam1 + ' – ' + fin.pointsTeam2 : null, m.team2.shortName || m.team2.teamName];
    const txt = fin ? res : fix;
    if (!want.filter(Boolean).every(x => txt.includes(x))) fail(`real sports: ${want.join(' ')} (OpenLigaDB) not shown on the live page`); else checked++;
  }
  console.log(`real sports: ${checked}/${done.length} Bundesliga matches of round ${round[0] && round[0].group && round[0].group.groupOrderID} match OpenLigaDB exactly`);
  if (!/OpenLigaDB/.test(res)) fail('real sports: data credit missing');
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
    await go(p, 'ciyaaraha-toos'); await p.waitForTimeout(2500); s = await st(p); console.log(name, 'real sports page:', s.text.slice(0, 160).replace(/\s+/g, ' '));
    if (s.overflow) fail(`${name}: real sports page scrolls sideways`);
    if (name === 'desktop') await realSports(ctx, p);
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

    // 2b. official publisher videos (YouTube channel feeds), the news wire and the official live channels
    ctx = await b.newContext({ viewport: { width: w, height: h } }); await mock(ctx, { videos: { videos: [] }, ld: LD(0) }); p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
    await go(p, 'muuqaal'); s = await st(p);
    const auto = await p.$$eval('#pageView a.vcard', a => [...new Set(a.map(x => x.getAttribute('href') + ' ' + x.innerText.replace(/\s+/g, ' ')))]);
    console.log(name, 'publisher videos:', JSON.stringify(auto));
    if (new Set(auto.map(x => x.split(' ')[0])).size !== 2 || !auto.some(x => /BBC News Somali/.test(x)) || auto.some(x => /Notallowed/.test(x))) fail(`${name}: publisher videos`);
    await go(p, 'muuqaal?v=yt-' + YT); s = await st(p);
    if (!s.iframes.some(f => f.startsWith('https://www.youtube-nocookie.com/embed/' + YT)) || !/YouTube/.test(s.text) || !/BBC News Somali/.test(s.text)) fail(`${name}: publisher video watch page ${JSON.stringify(s.iframes)}`);
    if (s.overflow) fail(`${name}: publisher video page scrolls sideways`);
    await go(p, 'wararka-tooska'); await p.waitForTimeout(800); s = await st(p);
    const wire = await p.$$eval('#pageView .wirebox .lntl li', l => l.map(x => ({ t: x.innerText.replace(/\s+/g, ' '), href: (x.querySelector('a[href^="https://"]') || {}).href || '' })));
    console.log(name, 'wire items:', wire.length, JSON.stringify(wire[0]));
    if (wire.length !== 3 || wire.some(x => !x.href)) fail(`${name}: wire items with links`);
    if (!wire.length || !/Muqdisho/.test(wire[0].t) || !/BBC Somali/.test(wire[0].t)) fail(`${name}: newest wire item first, with its source`);
    if (!(await p.$('#pageView .wiretick a'))) fail(`${name}: wire ticker`);
    if (/\bLIVE\b|\bTOOS\b/.test(await p.$eval('#pageView .lchans .lcgrid', x => x.innerText).catch(() => ''))) fail(`${name}: own LIVE label on a third-party channel`);
    if (s.iframes.some(f => /live_stream/.test(f))) fail(`${name}: a live channel player loads before the visitor presses play`);
    await p.click('#pageView .lcplay'); await p.waitForTimeout(300);
    if (!(await st(p)).iframes.some(f => /embed\/live_stream\?channel=UCNye-wNBqNL5ZzHSJj3l8Bg/.test(f))) fail(`${name}: official live channel player`);
    await p.click('#pageView .wirechips button:nth-child(2)'); await p.waitForTimeout(200);
    if ((await p.$$('#pageView .wirebox .lntl li')).length !== 1) fail(`${name}: Somalia filter`);
    if (s.overflow) fail(`${name}: LIVE News scrolls sideways`);
    await p.screenshot({ path: `${out}/media-${name}-wire.png`, fullPage: name === 'desktop' });
    await go(p, 'ilaha-xaaladda'); if (!/BBC Somali/.test((await st(p)).text)) fail(`${name}: source health page`);
    await ctx.close();
    // an old wire file (2 hours): a clear warning
    ctx = await b.newContext({ viewport: { width: w, height: h } }); await mock(ctx, { ld: LD(2 * 3600e3) }); p = await ctx.newPage();
    await go(p, 'wararka-tooska'); await p.waitForTimeout(800); if (!(await p.$('#pageView .wirebox .lnwarn'))) fail(`${name}: stale wire warning`); await ctx.close();

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
    const heads = await p.$$eval('#pageView .soverview h3.sgh', h => h.map(x => x.textContent));
    console.log(name, 'sports overview sections:', JSON.stringify(heads));
    if (heads.length < 2 || !(await p.$('#pageView .soverview .mrow.is-live'))) fail(`${name}: sports overview (live and today) missing`);
    await go(p, 'ciyaaraha-toos?tab=live'); s = await st(p);
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

    // 4b. open football data (OpenLigaDB) and the football-data.org feed, without any key in the site
    ctx = await b.newContext({ viewport: { width: w, height: h }, locale: 'en-GB' }); await mock(ctx, { sports: OPEN_CFG, ol: true, feed: feed(5 * 60e3) }); p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
    await p.goto(base + '?lang=en#ciyaaraha-toos', { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(1500);
    { const ov = (await st(p)).text; console.log(name, 'open data overview:', ov.slice(0, 300).replace(/\s+/g, ' '));
      if (!/Coming up/i.test(ov) || !/Leverkusen/.test(ov) || !/Latest results/i.test(ov) || !/2 – 1/.test(ov)) fail(`${name}: open-data overview (coming up and latest results)`) }
    await p.goto(base + '?lang=en#ciyaaraha-toos?tab=live', { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(1500);
    let orow = await p.$$eval('#pageView .mrow', r => r.map(x => ({ live: x.classList.contains('is-live'), t: x.innerText.replace(/\s+/g, ' ') })));
    console.log(name, 'open data live tab:', JSON.stringify(orow));
    if (!orow.some(r => r.live && /Stuttgart/.test(r.t) && /0 – 1/.test(r.t))) fail(`${name}: open data match in play not shown as live`);
    if (orow.some(r => /Leipzig|Leverkusen|Bayern.*Dortmund/.test(r.t))) fail(`${name}: a finished, overdue or later match is in the live tab`);
    if (!orow.some(r => r.live && /Arsenal/.test(r.t))) fail(`${name}: fresh feed match in play not shown as live`);
    if (orow.some(r => /9 – 9/.test(r.t))) fail(`${name}: feed match of a league the open data covers is listed twice`);
    s = await st(p); if (!/OpenLigaDB/.test(s.text) || !/football-data\.org/.test(s.text)) fail(`${name}: data credits missing`);
    if (s.overflow) fail(`${name}: open-data sports page scrolls sideways`);
    await p.screenshot({ path: `${out}/media-${name}-sports-open.png`, fullPage: name === 'desktop' });
    await p.goto(base + '?lang=en#ciyaaraha-toos?tab=today', { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(1200);
    orow = await p.$$eval('#pageView .mrow', r => r.map(x => ({ live: x.classList.contains('is-live'), aw: x.classList.contains('is-await'), t: x.innerText.replace(/\s+/g, ' ') })));
    const aw = orow.find(r => /Leipzig/.test(r.t));
    if (aw && (aw.live || !aw.aw || !/not yet confirmed/i.test(aw.t))) fail(`${name}: overdue match must say "result not yet confirmed", not live: ${JSON.stringify(aw)}`);
    await p.goto(base + '?lang=en#ciyaaraha-toos?tab=results&c=bl1', { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(1200); s = await st(p);
    if (!/Bayern[\s\S]*2 – 1[\s\S]*Dortmund/.test(s.text)) fail(`${name}: open data result`);
    await p.goto(base + '?lang=en#ciyaaraha-toos?tab=fixtures&c=bl1', { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(1200); s = await st(p);
    if (!/Leverkusen/.test(s.text) || /Bayern/.test(s.text)) fail(`${name}: open data fixtures`);
    await p.goto(base + '?lang=en#ciyaaraha-toos?tab=table&c=bl1', { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(1200); s = await st(p);
    if (!/Bayern/.test(s.text) || !/25/.test(s.text)) fail(`${name}: open data table`);
    await p.goto(base + '?lang=en#ciyaaraha-toos?tab=table&c=PL', { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(1200); s = await st(p);
    if (!/Arsenal/.test(s.text) || !/26/.test(s.text)) fail(`${name}: feed table`);
    await p.goto(base + '?lang=en#ciyaaraha-toos?m=ol9001', { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(1200); s = await st(p);
    if (!/H\. Kane/.test(s.text) || !/Penalty/.test(s.text) || !/Matchday 9/.test(s.text) || !/Teststadion/.test(s.text) || !/goals only/i.test(s.text)) fail(`${name}: open data match page (goals, round, venue)`);
    if (/50,?000|50\.000/.test(s.text)) fail(`${name}: attendance or viewer numbers shown`);
    await p.goto(base + '?lang=en#ciyaaraha-toos?t=ol40', { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(1200); s = await st(p);
    if (!/Bayern/.test(s.text) || !/Dortmund/.test(s.text)) fail(`${name}: open data team page`);
    await ctx.close();
    // an old feed (40 minutes) must not show a match as live
    ctx = await b.newContext({ viewport: { width: w, height: h } }); await mock(ctx, { sports: Object.assign({}, OPEN_CFG, { openData: { enabled: false } }), feed: feed(40 * 60e3) }); p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
    await p.goto(base + '?lang=en#ciyaaraha-toos?tab=today', { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(1200);
    orow = await p.$$eval('#pageView .mrow', r => r.map(x => ({ live: x.classList.contains('is-live'), t: x.innerText.replace(/\s+/g, ' ') })));
    console.log(name, 'stale feed, today tab:', JSON.stringify(orow));
    if (!orow.length || orow.some(r => r.live)) fail(`${name}: stale feed shows a match as live`);
    await ctx.close();
    // open data unreachable and no feed: a clear message, no numbers
    ctx = await b.newContext({ viewport: { width: w, height: h } }); await mock(ctx, { sports: OPEN_CFG }); p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
    await go(p, 'ciyaaraha-toos'); if (await p.$('#pageView .mrow')) fail(`${name}: rows shown while the open data is unreachable`);
    if (!/lama heli karo|unavailable/i.test((await st(p)).text)) fail(`${name}: no "unavailable" message`);
    // everything switched off in /admin/: "not connected" with the official viewing information
    await ctx.close(); ctx = await b.newContext({ viewport: { width: w, height: h } }); await mock(ctx, { sports: Object.assign({}, OPEN_CFG, { openData: { enabled: false } }) }); p = await ctx.newPage();
    await go(p, 'ciyaaraha-toos'); if (!(await p.$('#pageView .notconn'))) fail(`${name}: "not connected" message missing when no source is set`);
    await ctx.close();

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
