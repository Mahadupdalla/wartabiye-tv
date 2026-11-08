// Wartabiye TV sports feed: football-data.org → data/sports-feed/*.json (run by .github/workflows/sports-feed.yml).
//
// Why: GitHub Pages cannot keep a secret. This script runs inside GitHub Actions, where the football-data.org token is
// the repository secret FOOTBALL_DATA_TOKEN, and writes only the finished scores, fixtures, results and tables as
// public JSON. The website (assets/sports-src.js) reads those files. No token is ever written to a file.
//
// It reuses the tested football-data.org adapter of workers/sports-api, so it only relays what the provider returns:
// nothing is added, guessed or filled in. Every file carries "updatedAt"; the site never shows a match as live from a
// file older than 25 minutes.
//
//   node tools/sports_feed.mjs            update data/sports-feed when something changed (or a heartbeat is due)
//   node tools/sports_feed.mjs test       offline self-test
import fs from 'node:fs';
import path from 'node:path';
import { _test } from '../workers/sports-api/src/index.js';

const { FD } = _test;
const OUT = 'data/sports-feed';
const PAUSE = +process.env.SPORTS_FEED_PAUSE_MS || 6500; // free plan: 10 requests a minute
const COMP_EVERY = 60 * 60e3; // fixtures, results and tables: once an hour
const LIVE = new Set(['LIVE', 'HT']);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const day = (o, now) => new Date(now + o * 864e5).toISOString().slice(0, 10);
const strip = m => { const o = { ...m }; delete o._eventsIncluded; delete o._statsIncluded; return o; };
const read = f => { try { return JSON.parse(fs.readFileSync(path.join(OUT, f), 'utf8')); } catch { return null; } };
const body = d => JSON.stringify({ ...d, updatedAt: undefined });

export function competitionsFrom(cfg) {
  const same = new Set();
  const od = cfg.openData || {};
  if (od.enabled !== false) (od.leagues || []).forEach(l => l && l.enabled !== false && String(l.same || '').split(',').map(s => s.trim()).filter(Boolean).forEach(s => same.add(s)));
  return (cfg.competitions || []).filter(c => c && /^[A-Z0-9]{2,5}$/.test(String(c.id)) && !same.has(String(c.id))).map(c => ({ id: String(c.id), name: c.name || String(c.id) }));
}

// decide what to write: files whose content changed, plus a heartbeat so the site can tell the feed is alive
export function plan(prev, next, now) {
  const writes = [];
  const age = d => (d && Date.parse(d.updatedAt) ? now - Date.parse(d.updatedAt) : Infinity);
  for (const [name, d] of Object.entries(next)) {
    if (name === 'index') continue;
    const p = prev[name];
    if (!p || body(p) !== body(d)) writes.push(name);
  }
  const anyLive = (next.window && next.window.matches || []).some(m => LIVE.has(m.status));
  const beat = age(prev.index) > (anyLive ? 9 * 60e3 : 55 * 60e3);
  if (writes.length || beat || !prev.index || body(prev.index) !== body(next.index)) { if (beat && !writes.includes('window') && next.window) writes.push('window'); writes.push('index'); }
  return writes;
}

async function run() {
  const token = process.env.FOOTBALL_DATA_TOKEN || '';
  if (!token) { console.log('sports feed: FOOTBALL_DATA_TOKEN is not set, nothing to do (the site uses its other sources).'); return; }
  const env = { PROVIDER_TOKEN: token };
  const cfg = JSON.parse(fs.readFileSync('data/sports.json', 'utf8'));
  const comps = competitionsFrom(cfg);
  const now = Date.now(), iso = new Date(now).toISOString();
  const base = { provider: 'football-data.org', updatedAt: iso };
  fs.mkdirSync(OUT, { recursive: true });
  const prev = { index: read('index.json'), window: read('window.json') };
  const next = {};
  const ids = new Set(comps.map(c => c.id));
  let calls = 0;
  const call = async fn => { if (calls++) await sleep(PAUSE); return fn(); };
  // today ± 1 day (East Africa time is UTC+3): scores and live status
  const w = await call(() => FD.call(env, `/matches?dateFrom=${day(-1, now)}&dateTo=${day(1, now)}`));
  next.window = { ...base, matches: (w.matches || []).map(FD.norm).map(strip).filter(m => m.competition && ids.has(String(m.competition.id))) };
  // per competition, once an hour
  for (const c of comps) {
    for (const kind of ['fixtures', 'results', 'standings']) {
      const name = `${kind}-${c.id}`;
      prev[name] = read(name + '.json');
      const age = prev[name] && Date.parse(prev[name].updatedAt) ? now - Date.parse(prev[name].updatedAt) : Infinity;
      if (age < COMP_EVERY) continue;
      try {
        const r = await call(() => FD[kind](env, c.id));
        next[name] = kind === 'standings' ? { ...base, ...r } : { ...base, matches: r.map(strip) };
      } catch (e) { console.log(`sports feed: ${name} unavailable (${e.status || e.message}), keeping the previous file`); }
    }
  }
  next.index = { ...base, competitions: comps, plan: 'football-data.org (free plan: scores may be delayed)' };
  const writes = plan(prev, next, now);
  for (const name of writes) fs.writeFileSync(path.join(OUT, name + '.json'), JSON.stringify(next[name], null, 1) + '\n');
  console.log(`sports feed: ${calls} provider calls, wrote ${writes.length ? writes.join(', ') : 'nothing (no change)'}`);
}

function selfTest() {
  const assert = (c, m) => { if (!c) { console.error('FAIL', m); process.exit(1); } };
  const cfg = { competitions: [{ id: 'PL' }, { id: 'BL1' }, { id: 'CL' }, { id: 'bad id' }], openData: { leagues: [{ id: 'bl1', same: 'BL1' }, { id: 'ucl', same: 'CL' }] } };
  assert(JSON.stringify(competitionsFrom(cfg).map(c => c.id)) === '["PL"]', 'open-data leagues are not fetched twice');
  assert(competitionsFrom({ ...cfg, openData: { enabled: false, leagues: cfg.openData.leagues } }).length === 3, 'all comps when open data is off');
  const now = Date.parse('2026-11-08T12:00:00Z');
  const m = s => ({ id: 1, status: s });
  const idx = t => ({ updatedAt: new Date(t).toISOString(), competitions: [] });
  const same = { index: idx(now - 5 * 60e3), window: { updatedAt: 'a', matches: [m('FT')] } };
  assert(plan(same, { index: idx(now), window: { updatedAt: 'b', matches: [m('FT')] } }, now).length === 0, 'no change, no write');
  assert(plan(same, { index: idx(now), window: { updatedAt: 'b', matches: [m('LIVE')] } }, now).join() === 'window,index', 'change is written');
  const old = { index: idx(now - 10 * 60e3), window: { updatedAt: 'a', matches: [m('LIVE')] } };
  assert(plan(old, { index: idx(now), window: { updatedAt: 'b', matches: [m('LIVE')] } }, now).join() === 'window,index', 'heartbeat during a live match');
  const quiet = { index: idx(now - 30 * 60e3), window: { updatedAt: 'a', matches: [m('FT')] } };
  assert(plan(quiet, { index: idx(now), window: { updatedAt: 'b', matches: [m('FT')] } }, now).length === 0, 'no heartbeat needed when nothing is live');
  assert(plan({}, { index: idx(now), window: { updatedAt: 'b', matches: [] } }, now).join() === 'window,index', 'first run writes');
  console.log('SPORTS FEED OK');
}

if (process.argv[2] === 'test') selfTest(); else run().catch(e => { console.error('sports feed failed:', e.status || '', e.message); process.exit(1); });
