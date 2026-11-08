/* Wartabiye TV sports-data proxy (Cloudflare Worker).
 *
 * Why it exists: GitHub Pages cannot keep a secret, and a sports-data API token in the public site would be stolen.
 * This Worker keeps the token in a Cloudflare secret (PROVIDER_TOKEN), calls the licensed provider, caches the answer
 * for a short time (so the provider's rate limit is respected however many people watch), and returns one simple,
 * provider-neutral JSON format that assets/media.js shows. It only relays what the provider returns: it never adds,
 * guesses or fills in a score, minute, event or statistic.
 *
 * Endpoints (GET only):
 *   /v1/live                         matches in play now
 *   /v1/matches?date=YYYY-MM-DD      all matches of that day (configured competitions)
 *   /v1/fixtures?competition=ID      next 14 days
 *   /v1/results?competition=ID       last 14 days
 *   /v1/standings?competition=ID     league table
 *   /v1/match?id=ID                  one match with events and statistics (when the plan includes them)
 *   /v1/team?id=ID                   team details, squad and recent/next matches
 *   /v1/health                       {"ok":true,"provider":...} (no provider call)
 */
const TTL = { live: 30, matches: 60, match: 30, fixtures: 600, results: 600, standings: 1800, team: 86400 };
const LIVE = new Set(['LIVE', 'IN_PLAY', 'PAUSED', '1H', '2H', 'HT', 'ET', 'BT', 'P', 'INT']);

// ---------- normalised format ----------
// match: {id, utcDate, status, minute, competition:{id,name,area,emblem}, round, home:{id,name,crest}, away:{...},
//         score:{home,away,halfTime:{home,away}}, venue, referee, events:[{minute,extra,type,team,player,detail}],
//         statistics:[{type,home,away}]}
// status: SCHEDULED | LIVE | HT | FT | AET | PEN | POSTPONED | SUSPENDED | CANCELLED | ABD

// ----- football-data.org v4 (header X-Auth-Token) -----
const FD = {
  base: 'https://api.football-data.org/v4',
  headers: env => ({ 'X-Auth-Token': env.PROVIDER_TOKEN }),
  name: 'football-data.org',
  status(m) {
    const s = m.status;
    if (s === 'IN_PLAY') return 'LIVE';
    if (s === 'PAUSED') return 'HT';
    if (s === 'FINISHED') return m.score && m.score.duration === 'PENALTY_SHOOTOUT' ? 'PEN' : m.score && m.score.duration === 'EXTRA_TIME' ? 'AET' : 'FT';
    if (s === 'SCHEDULED' || s === 'TIMED') return 'SCHEDULED';
    return s; // POSTPONED, SUSPENDED, CANCELLED, AWARDED
  },
  tm: t => t ? { id: t.id, name: t.shortName || t.name, crest: t.crest || null } : null,
  norm(m) {
    const ft = (m.score && m.score.fullTime) || {}, ht = (m.score && m.score.halfTime) || {};
    const out = {
      id: m.id, utcDate: m.utcDate, status: FD.status(m), minute: m.minute != null ? m.minute : null,
      competition: m.competition ? { id: m.competition.code || m.competition.id, name: m.competition.name, area: m.area && m.area.name, emblem: m.competition.emblem || null } : null,
      round: m.matchday ? 'Matchday ' + m.matchday : (m.stage || null),
      home: FD.tm(m.homeTeam), away: FD.tm(m.awayTeam),
      score: { home: ft.home, away: ft.away, halfTime: { home: ht.home, away: ht.away } },
      venue: m.venue || null, referee: (m.referees && m.referees[0] && m.referees[0].name) || null,
    };
    const side = id => (m.homeTeam && id === m.homeTeam.id ? 'home' : 'away');
    const ev = [];
    (m.goals || []).forEach(g => ev.push({ minute: g.minute, extra: g.injuryTime || null, type: 'goal', team: side(g.team && g.team.id), player: g.scorer && g.scorer.name, detail: g.type === 'PENALTY' ? 'Penalty' : g.type === 'OWN' ? 'Own goal' : (g.assist && g.assist.name ? 'Assist: ' + g.assist.name : null) }));
    (m.bookings || []).forEach(b => ev.push({ minute: b.minute, type: b.card === 'YELLOW' ? 'yellow' : 'red', team: side(b.team && b.team.id), player: b.player && b.player.name, detail: null }));
    (m.substitutions || []).forEach(s => ev.push({ minute: s.minute, type: 'sub', team: side(s.team && s.team.id), player: (s.playerIn && s.playerIn.name) || null, detail: s.playerOut && s.playerOut.name ? 'Out: ' + s.playerOut.name : null }));
    out.events = ev.sort((a, b) => (a.minute || 0) - (b.minute || 0) || (a.extra || 0) - (b.extra || 0));
    const hs = m.homeTeam && m.homeTeam.statistics, as = m.awayTeam && m.awayTeam.statistics;
    out.statistics = hs && as ? Object.keys(hs).map(k => ({ type: k.replace(/_/g, ' ').replace(/^./, c => c.toUpperCase()), home: hs[k], away: as[k] })) : [];
    out._eventsIncluded = 'goals' in m || 'bookings' in m;
    out._statsIncluded = !!(hs && as);
    return out;
  },
  async call(env, path) { return fetchJson(FD.base + path, FD.headers(env)); },
  async live(env) { return (await FD.call(env, '/matches?status=IN_PLAY,PAUSED')).matches.map(FD.norm); },
  async day(env, date) { return (await FD.call(env, `/matches?dateFrom=${date}&dateTo=${date}`)).matches.map(FD.norm); },
  async range(env, comp, from, to, status) { return (await FD.call(env, `/competitions/${enc(comp)}/matches?dateFrom=${from}&dateTo=${to}${status ? '&status=' + status : ''}`)).matches.map(FD.norm); },
  async fixtures(env, comp) { return FD.range(env, comp, day(0), day(14), 'SCHEDULED,TIMED'); },
  async results(env, comp) { return (await FD.range(env, comp, day(-14), day(0), 'FINISHED')).reverse(); },
  async standings(env, comp) {
    const d = await FD.call(env, `/competitions/${enc(comp)}/standings`);
    const t = (d.standings || []).find(s => s.type === 'TOTAL') || (d.standings || [])[0] || { table: [] };
    return { competition: { id: d.competition && d.competition.code, name: d.competition && d.competition.name }, season: d.season && d.season.startDate ? d.season.startDate.slice(0, 4) : null,
      table: t.table.map(r => ({ position: r.position, team: FD.tm(r.team), played: r.playedGames, won: r.won, draw: r.draw, lost: r.lost, goalDifference: r.goalDifference, points: r.points, form: r.form || null })) };
  },
  async match(env, id) { const d = await FD.call(env, `/matches/${enc(id)}`); return FD.norm(d.match || d); },
  async team(env, id) {
    const t = await FD.call(env, `/teams/${enc(id)}`);
    let matches = [];
    try { matches = (await FD.call(env, `/teams/${enc(id)}/matches?dateFrom=${day(-21)}&dateTo=${day(21)}`)).matches.map(FD.norm); } catch (e) { /* optional */ }
    return { team: { id: t.id, name: t.name, crest: t.crest, country: t.area && t.area.name, founded: t.founded, venue: t.venue, coach: t.coach && t.coach.name, website: t.website,
      squad: (t.squad || []).map(p => ({ name: p.name, position: p.position })) }, matches };
  },
};

// ----- API-Football v3 (api-sports.io, header x-apisports-key) -----
const AF = {
  base: 'https://v3.football.api-sports.io',
  headers: env => ({ 'x-apisports-key': env.PROVIDER_TOKEN }),
  name: 'API-Football',
  status(s) {
    if (['1H', '2H', 'ET', 'BT', 'P', 'LIVE', 'INT'].includes(s)) return 'LIVE';
    return { HT: 'HT', FT: 'FT', AET: 'AET', PEN: 'PEN', NS: 'SCHEDULED', TBD: 'SCHEDULED', PST: 'POSTPONED', SUSP: 'SUSPENDED', CANC: 'CANCELLED', ABD: 'ABD', AWD: 'FT', WO: 'FT' }[s] || s;
  },
  tm: t => t ? { id: t.id, name: t.name, crest: t.logo || null } : null,
  norm(f) {
    const fx = f.fixture || {}, st = fx.status || {}, homeId = f.teams && f.teams.home && f.teams.home.id;
    const ev = (f.events || []).map(e => ({
      minute: e.time && e.time.elapsed, extra: e.time && e.time.extra || null, team: e.team && e.team.id === homeId ? 'home' : 'away', player: e.player && e.player.name,
      type: e.type === 'Goal' ? 'goal' : e.type === 'Card' ? (/red/i.test(e.detail) ? 'red' : 'yellow') : e.type === 'subst' ? 'sub' : e.type === 'Var' ? 'var' : 'other',
      detail: e.type === 'subst' ? (e.assist && e.assist.name ? 'Out: ' + e.assist.name : null) : e.type === 'Goal' && e.assist && e.assist.name ? e.detail + ' · Assist: ' + e.assist.name : e.detail || null,
    }));
    let statistics = [];
    if (Array.isArray(f.statistics) && f.statistics.length === 2) {
      const [h, a] = f.statistics[0].team.id === homeId ? f.statistics : [f.statistics[1], f.statistics[0]];
      statistics = h.statistics.map((s, i) => ({ type: s.type, home: s.value, away: a.statistics[i] ? a.statistics[i].value : null }));
    }
    return {
      id: fx.id, utcDate: fx.date, status: AF.status(st.short), minute: st.elapsed != null ? st.elapsed : null,
      competition: f.league ? { id: f.league.id, name: f.league.name, area: f.league.country, emblem: f.league.logo || null } : null, round: f.league && f.league.round || null,
      home: AF.tm(f.teams && f.teams.home), away: AF.tm(f.teams && f.teams.away),
      score: { home: f.goals && f.goals.home, away: f.goals && f.goals.away, halfTime: { home: f.score && f.score.halftime && f.score.halftime.home, away: f.score && f.score.halftime && f.score.halftime.away } },
      venue: fx.venue && fx.venue.name ? fx.venue.name + (fx.venue.city ? ', ' + fx.venue.city : '') : null, referee: fx.referee || null,
      events: ev, statistics, _eventsIncluded: 'events' in f, _statsIncluded: statistics.length > 0,
    };
  },
  async call(env, path) { const d = await fetchJson(AF.base + path, AF.headers(env)); if (d.errors && Object.keys(d.errors).length) throw new Error('provider: ' + JSON.stringify(d.errors)); return d.response || []; },
  async live(env) { return (await AF.call(env, '/fixtures?live=all')).map(AF.norm); },
  async day(env, date) { return (await AF.call(env, `/fixtures?date=${date}`)).map(AF.norm); },
  async fixtures(env, comp) { return (await AF.call(env, `/fixtures?league=${enc(comp)}&season=${env.SEASON}&from=${day(0)}&to=${day(14)}`)).map(AF.norm); },
  async results(env, comp) { return (await AF.call(env, `/fixtures?league=${enc(comp)}&season=${env.SEASON}&from=${day(-14)}&to=${day(0)}&status=FT-AET-PEN`)).map(AF.norm).reverse(); },
  async standings(env, comp) {
    const r = (await AF.call(env, `/standings?league=${enc(comp)}&season=${env.SEASON}`))[0];
    const lg = r && r.league; const t = lg && lg.standings && lg.standings[0] || [];
    return { competition: lg ? { id: lg.id, name: lg.name } : null, season: lg && lg.season, table: t.map(x => ({ position: x.rank, team: AF.tm(x.team), played: x.all.played, won: x.all.win, draw: x.all.draw, lost: x.all.lose, goalDifference: x.goalsDiff, points: x.points, form: x.form || null })) };
  },
  async match(env, id) { const r = (await AF.call(env, `/fixtures?id=${enc(id)}`))[0]; return r ? AF.norm(r) : null; },
  async team(env, id) {
    const r = (await AF.call(env, `/teams?id=${enc(id)}`))[0]; if (!r) return { team: null, matches: [] };
    let matches = [];
    try { matches = (await AF.call(env, `/fixtures?team=${enc(id)}&season=${env.SEASON}&from=${day(-21)}&to=${day(21)}`)).map(AF.norm); } catch (e) { /* optional */ }
    return { team: { id: r.team.id, name: r.team.name, crest: r.team.logo, country: r.team.country, founded: r.team.founded, venue: r.venue && r.venue.name, coach: null, website: null, squad: [] }, matches };
  },
};

const PROVIDERS = { 'football-data': FD, 'api-football': AF };

// ---------- helpers ----------
function enc(s) { return encodeURIComponent(String(s)); }
function day(offset) { const d = new Date(Date.now() + offset * 864e5); return d.toISOString().slice(0, 10); }
async function fetchJson(url, headers) {
  const r = await fetch(url, { headers: Object.assign({ Accept: 'application/json' }, headers) });
  if (!r.ok) { const e = new Error('provider HTTP ' + r.status); e.status = r.status; throw e; }
  return r.json();
}
function strip(m) { if (!m) return m; const o = Object.assign({}, m); delete o._eventsIncluded; delete o._statsIncluded; return o; }
function sortMatches(list) {
  const rank = m => (LIVE.has(m.status) ? 0 : m.status === 'SCHEDULED' ? 1 : 2);
  return list.sort((a, b) => rank(a) - rank(b) || String(a.utcDate).localeCompare(String(b.utcDate)));
}
function onlyComps(list, comps) { return comps.length ? list.filter(m => m.competition && comps.includes(String(m.competition.id))) : list; }
function cors(req, env) {
  const origin = req.headers.get('Origin') || '';
  const allowed = String(env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
  const h = { 'Access-Control-Allow-Methods': 'GET, OPTIONS', 'Access-Control-Allow-Headers': 'Accept', Vary: 'Origin' };
  if (allowed.includes(origin) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) h['Access-Control-Allow-Origin'] = origin;
  return h;
}
function json(body, status, extra) { return new Response(JSON.stringify(body), { status, headers: Object.assign({ 'Content-Type': 'application/json; charset=utf-8' }, extra) }); }

// ---------- request handling ----------
export async function handle(req, env, ctx, cacheImpl) {
  const url = new URL(req.url);
  const ch = cors(req, env);
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: ch });
  if (req.method !== 'GET') return json({ error: 'method not allowed' }, 405, ch);
  const P = PROVIDERS[env.PROVIDER || 'football-data'];
  if (!P) return json({ error: 'unknown PROVIDER' }, 500, ch);
  const route = url.pathname.replace(/\/+$/, '');
  if (route === '/v1/health') return json({ ok: true, provider: P.name, configured: !!env.PROVIDER_TOKEN }, 200, ch);
  if (!env.PROVIDER_TOKEN) return json({ error: 'not configured' }, 503, ch);
  const q = url.searchParams, comp = q.get('competition'), id = q.get('id');
  const comps = String(env.COMPETITIONS || '').split(',').map(s => s.trim()).filter(Boolean);
  const okId = s => /^[A-Za-z0-9_-]{1,20}$/.test(String(s || ''));
  let kind, work;
  switch (route) {
    case '/v1/live': kind = 'live'; work = async () => ({ matches: sortMatches(onlyComps(await P.live(env), comps)).map(strip) }); break;
    case '/v1/matches': {
      const date = q.get('date') || day(0); if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return json({ error: 'bad date' }, 400, ch);
      kind = 'matches'; work = async () => ({ date, matches: sortMatches(onlyComps(await P.day(env, date), comps)).map(strip) }); break; }
    case '/v1/fixtures': if (!okId(comp)) return json({ error: 'competition required' }, 400, ch); kind = 'fixtures'; work = async () => ({ matches: (await P.fixtures(env, comp)).map(strip) }); break;
    case '/v1/results': if (!okId(comp)) return json({ error: 'competition required' }, 400, ch); kind = 'results'; work = async () => ({ matches: (await P.results(env, comp)).map(strip) }); break;
    case '/v1/standings': if (!okId(comp)) return json({ error: 'competition required' }, 400, ch); kind = 'standings'; work = async () => P.standings(env, comp); break;
    case '/v1/match': if (!okId(id)) return json({ error: 'id required' }, 400, ch); kind = 'match'; work = async () => {
      const m = await P.match(env, id); return { match: strip(m), eventsAvailable: m ? m._eventsIncluded : undefined, statisticsAvailable: m ? m._statsIncluded : undefined }; }; break;
    case '/v1/team': if (!okId(id)) return json({ error: 'id required' }, 400, ch); kind = 'team'; work = async () => { const t = await P.team(env, id); t.matches = (t.matches || []).map(strip); return t; }; break;
    default: return json({ error: 'not found' }, 404, ch);
  }
  // shared cache: one provider call per endpoint per TTL, whatever the number of visitors
  const cache = cacheImpl || (typeof caches !== 'undefined' ? caches.default : null);
  const key = new Request(url.origin + route + '?' + [...q.entries()].sort().map(([k, v]) => enc(k) + '=' + enc(v)).join('&'));
  if (cache) { const hit = await cache.match(key); if (hit) { const r = new Response(hit.body, hit); Object.entries(ch).forEach(([k, v]) => r.headers.set(k, v)); return r; } }
  try {
    const body = Object.assign({ provider: P.name, updatedAt: new Date().toISOString() }, await work());
    const res = json(body, 200, { 'Cache-Control': `public, max-age=${TTL[kind]}` });
    if (cache) { const p = cache.put(key, res.clone()); if (ctx && ctx.waitUntil) ctx.waitUntil(p); else await p; }
    Object.entries(ch).forEach(([k, v]) => res.headers.set(k, v));
    return res;
  } catch (e) {
    // the provider's own error, without the token; the site then says the data is unavailable (nothing invented)
    return json({ error: 'provider unavailable', detail: String(e.message || e).slice(0, 200) }, e.status === 429 ? 429 : 502, ch);
  }
}

export default { fetch: (req, env, ctx) => handle(req, env, ctx) };
export const _test = { FD, AF };
