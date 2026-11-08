// node --test workers/sports-api/test/worker.test.mjs   — checks the proxy with recorded-shape sample answers (no network, no token)
import test from 'node:test';
import assert from 'node:assert/strict';
import { handle } from '../src/index.js';

const FD_MATCH = { id: 501, utcDate: '2026-11-08T15:00:00Z', status: 'IN_PLAY', minute: 63, matchday: 11, stage: 'REGULAR_SEASON',
  area: { name: 'England' }, competition: { id: 2021, code: 'PL', name: 'Premier League', emblem: 'https://crests.football-data.org/PL.png' },
  homeTeam: { id: 57, name: 'Arsenal FC', shortName: 'Arsenal', crest: 'https://crests.football-data.org/57.png' },
  awayTeam: { id: 61, name: 'Chelsea FC', shortName: 'Chelsea', crest: 'https://crests.football-data.org/61.png' },
  score: { winner: null, duration: 'REGULAR', fullTime: { home: 1, away: 0 }, halfTime: { home: 1, away: 0 } },
  goals: [{ minute: 22, injuryTime: null, type: 'REGULAR', team: { id: 57 }, scorer: { name: 'B. Saka' }, assist: { name: 'M. Ødegaard' } }],
  bookings: [{ minute: 40, team: { id: 61 }, player: { name: 'M. Caicedo' }, card: 'YELLOW' }],
  substitutions: [], referees: [{ name: 'M. Oliver' }], venue: 'Emirates Stadium' };
const AF_FIX = { fixture: { id: 9001, date: '2026-11-08T15:00:00+00:00', referee: 'A. Taylor', venue: { name: 'Anfield', city: 'Liverpool' }, status: { short: 'HT', elapsed: 45 } },
  league: { id: 39, name: 'Premier League', country: 'England', logo: 'https://media.api-sports.io/football/leagues/39.png', round: 'Regular Season - 11' },
  teams: { home: { id: 40, name: 'Liverpool', logo: 'l.png' }, away: { id: 42, name: 'Arsenal', logo: 'a.png' } },
  goals: { home: 0, away: 0 }, score: { halftime: { home: 0, away: 0 } },
  events: [{ time: { elapsed: 30, extra: null }, team: { id: 42 }, player: { name: 'D. Rice' }, assist: {}, type: 'Card', detail: 'Yellow Card' }],
  statistics: [{ team: { id: 42 }, statistics: [{ type: 'Ball Possession', value: '48%' }] }, { team: { id: 40 }, statistics: [{ type: 'Ball Possession', value: '52%' }] }] };

function fakeFetch(map) {
  const calls = [];
  globalThis.fetch = async (url, opt) => { calls.push({ url, headers: opt.headers });
    const k = Object.keys(map).find(p => url.includes(p)); if (!k) return new Response('{}', { status: 404 });
    return new Response(JSON.stringify(map[k]), { status: 200 }); };
  return calls;
}
const memCache = () => { const m = new Map(); return { match: async r => m.get(r.url)?.clone(), put: async (r, res) => { m.set(r.url, res) } }; };
const req = (p, origin = 'https://www.wartabiyetv.com') => new Request('https://proxy.example' + p, { headers: { Origin: origin } });
const ENV_FD = { PROVIDER: 'football-data', PROVIDER_TOKEN: 'secret-token', ALLOWED_ORIGINS: 'https://www.wartabiyetv.com' };

test('live matches from football-data.org are normalised, token stays server-side, CORS only for the site', async () => {
  const calls = fakeFetch({ '/matches?status=IN_PLAY': { matches: [FD_MATCH] } });
  const r = await handle(req('/v1/live'), ENV_FD, null, memCache());
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('Access-Control-Allow-Origin'), 'https://www.wartabiyetv.com');
  const d = await r.json(); const m = d.matches[0];
  assert.equal(d.provider, 'football-data.org');
  assert.deepEqual([m.status, m.minute, m.home.name, m.away.name, m.score.home, m.score.away], ['LIVE', 63, 'Arsenal', 'Chelsea', 1, 0]);
  assert.equal(m.events.length, 2); assert.equal(m.events[0].type, 'goal'); assert.equal(m.events[1].type, 'yellow'); assert.equal(m.events[1].team, 'away');
  assert.ok(!JSON.stringify(d).includes('secret-token'));
  assert.equal(calls[0].headers['X-Auth-Token'], 'secret-token');
  const other = await handle(req('/v1/live', 'https://evil.example'), ENV_FD, null, memCache());
  assert.equal(other.headers.get('Access-Control-Allow-Origin'), null);
});

test('second request is served from the cache (provider called once)', async () => {
  const calls = fakeFetch({ '/matches?status=IN_PLAY': { matches: [FD_MATCH] } }); const c = memCache();
  await handle(req('/v1/live'), ENV_FD, null, c); await handle(req('/v1/live'), ENV_FD, null, c);
  assert.equal(calls.length, 1);
});

test('API-Football fixture with events and statistics', async () => {
  fakeFetch({ '/fixtures?id=9001': { response: [AF_FIX] } });
  const r = await handle(req('/v1/match?id=9001'), { PROVIDER: 'api-football', PROVIDER_TOKEN: 't', SEASON: '2026' }, null, memCache());
  const d = await r.json(); const m = d.match;
  assert.deepEqual([m.status, m.minute, m.home.name, m.venue, m.referee], ['HT', 45, 'Liverpool', 'Anfield, Liverpool', 'A. Taylor']);
  assert.deepEqual(m.statistics[0], { type: 'Ball Possession', home: '52%', away: '48%' });
  assert.equal(m.events[0].type, 'yellow'); assert.equal(m.events[0].team, 'away');
  assert.equal(d.eventsAvailable, true); assert.equal(d.statisticsAvailable, true);
});

test('standings and bad input', async () => {
  fakeFetch({ '/competitions/PL/standings': { competition: { code: 'PL', name: 'Premier League' }, season: { startDate: '2026-08-15' },
    standings: [{ type: 'TOTAL', table: [{ position: 1, team: { id: 57, name: 'Arsenal FC', shortName: 'Arsenal', crest: 'c' }, playedGames: 11, won: 8, draw: 2, lost: 1, goalDifference: 15, points: 26 }] }] } });
  const d = await (await handle(req('/v1/standings?competition=PL'), ENV_FD, null, memCache())).json();
  assert.equal(d.table[0].points, 26); assert.equal(d.season, '2026');
  assert.equal((await handle(req('/v1/standings?competition=../x'), ENV_FD, null, memCache())).status, 400);
  assert.equal((await handle(req('/v1/nothing'), ENV_FD, null, memCache())).status, 404);
});

test('without a token nothing is invented: 503', async () => {
  const r = await handle(req('/v1/live'), { PROVIDER: 'football-data' }, null, memCache());
  assert.equal(r.status, 503);
});

test('provider error is passed on as unavailable', async () => {
  globalThis.fetch = async () => new Response('{}', { status: 429 });
  const r = await handle(req('/v1/live'), ENV_FD, null, memCache());
  assert.equal(r.status, 429); assert.equal((await r.json()).error, 'provider unavailable');
});
