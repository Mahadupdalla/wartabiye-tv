// Privacy-friendly visitor statistics, collected by this Worker and stored in D1.
// * No cookies and nothing stored in the visitor's browser unless the visitor allows "remember this device"
//   (only then can "returning visitors" be measured).
// * No IP address is stored. A visitor is SHA-256(daily random salt + IP + browser) — it changes every day and the
//   salt is deleted after two days, so nobody (including us) can follow a person over time or identify them.
// * Country comes from Cloudflare's approximate network location (country only, never city or exact position).
import { now, randomToken, sha256hex, clientIp, country, json } from './util.js';

const TZ = env => parseInt(env.TZ_OFFSET_MINUTES ?? '180', 10) * 60;    // Africa/Mogadishu (UTC+3, no summer time)
export const dayOf = (ts, env) => new Date((ts + TZ(env)) * 1000).toISOString().slice(0, 10);
export const hourOf = (ts, env) => new Date((ts + TZ(env)) * 1000).getUTCHours();
const addDays = (d, n) => new Date(Date.parse(d + 'T00:00:00Z') + n * 864e5).toISOString().slice(0, 10);

const BOT = /bot|crawl|spider|slurp|bingpreview|facebookexternalhit|embedly|quora link|whatsapp|telegrambot|skypeuripreview|headless|phantom|puppeteer|playwright|selenium|lighthouse|pagespeed|gtmetrix|pingdom|uptime|monitor|curl|wget|python|java\/|go-http|okhttp|axios|node-fetch|preview/i;
const PATH = /^\/(?:war\/[a-z0-9][a-z0-9-]{0,140}|qayb\/[a-z0-9][a-z0-9-]{0,60}|muuqaal\/[a-zA-Z0-9_-]{1,40}|[a-z][a-z0-9-]{0,40})?$/;
const SEARCH = /(^|\.)(google|bing|yahoo|duckduckgo|yandex|baidu|ecosia|naver|seznam|qwant|brave)\./;
const SOCIAL = /(^|\.)(facebook|fb|instagram|t|x|twitter|tiktok|youtube|youtu|whatsapp|wa|telegram|t\.me|linkedin|lnkd|reddit|snapchat|pinterest|threads|messenger)\.(com|me|co|net|be|in|org)$|^(t\.me|wa\.me|m\.facebook\.com|l\.facebook\.com|lm\.facebook\.com|out\.reddit\.com)$/;

export function device(ua = '') {
  if (/iPad|Tablet|PlayBook|Silk|Kindle|(Android(?!.*Mobile))/i.test(ua)) return 'tablet';
  if (/Mobi|iPhone|iPod|Android|Windows Phone|Opera Mini|IEMobile/i.test(ua)) return 'mobile';
  return 'desktop';
}
export function sourceOf(ref, utm, siteHosts) {
  if (utm) return { kind: /face|fb|insta|tiktok|whats|telegram|twitter|x\.com|youtube|social/i.test(utm) ? 'social' : /mail|newsletter/i.test(utm) ? 'email' : 'campaign', host: utm.toLowerCase().replace(/[^a-z0-9._-]/g, '').slice(0, 40) };
  if (!ref) return { kind: 'direct', host: '' };
  let host;
  try { host = new URL(ref).hostname.toLowerCase().replace(/^www\./, ''); } catch { return { kind: 'direct', host: '' }; }
  if (siteHosts.some(h => host === h.replace(/^www\./, ''))) return null;   // inside the site: not a new visit
  if (/^android-app:\/\/com\.google/.test(ref) || SEARCH.test(host)) return { kind: 'search', host };
  if (SOCIAL.test(host) || /^android-app:\/\/(com\.facebook|org\.telegram|com\.whatsapp)/.test(ref)) return { kind: 'social', host };
  return { kind: 'website', host: host.slice(0, 60) };
}

const saltCache = new Map();
async function saltFor(env, day) {
  if (saltCache.has(day)) return saltCache.get(day);
  await env.DB.prepare('INSERT OR IGNORE INTO salts (day, salt) VALUES (?, ?)').bind(day, randomToken(24)).run();
  const r = await env.DB.prepare('SELECT salt FROM salts WHERE day = ?').bind(day).first();
  saltCache.clear(); saltCache.set(day, r.salt);
  return r.salt;
}

export function corsHeaders(req, env) {
  const o = req.headers.get('origin') || '';
  const allowed = String(env.SITE_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
  return allowed.includes(o) ? { 'access-control-allow-origin': o, 'access-control-allow-methods': 'POST', 'access-control-max-age': '86400', vary: 'Origin' } : null;
}

export const SELFTEST_DAY = '0000-00-00';
async function selftestOk(env, token) {
  if (!/^[a-f0-9]{32}$/.test(token)) return false;
  const row = await env.DB.prepare("SELECT v FROM config WHERE k = 'selftest'").first();
  if (!row) return false;
  try { const c = JSON.parse(row.v); return c.exp > now() && c.h === await sha256hex(token); } catch { return false; }
}

// POST /c  — one page view from the public website (sent by assets/stats.js with navigator.sendBeacon)
export async function collect(req, env) {
  const cors = corsHeaders(req, env);
  const done = (s = 204) => new Response(null, { status: s, headers: cors || {} });
  if (!cors) return done(403);
  if (req.method === 'OPTIONS') return done(204);
  const ua = req.headers.get('user-agent') || '';
  let b;
  try { const t = await req.text(); if (t.length > 2048) return done(413); b = JSON.parse(t); } catch { return done(400); }
  // Deploy self-test (admin-deploy.yml): a one-time token, valid 20 minutes, stored only as its SHA-256. Its visits go
  // to the separate day SELFTEST_DAY, which no report reads and the workflow deletes straight after checking it.
  const selftest = b && typeof b.t === 'string' ? await selftestOk(env, b.t) : false;
  if (b && typeof b.t === 'string' && !selftest) return done(403);
  if (!selftest && (!ua || BOT.test(ua))) return done();
  const path = typeof b.p === 'string' ? b.p.toLowerCase().slice(0, 160) : '';
  if (!PATH.test(path)) return done(400);
  const t = now(), day = selftest ? SELFTEST_DAY : dayOf(t, env);
  const vid = (await sha256hex((await saltFor(env, day)) + '|' + clientIp(req) + '|' + ua + '|' + (req.headers.get('accept-language') || '').slice(0, 20))).slice(0, 32);
  const lang = /^[a-z]{2}$/.test(b.l) ? b.l : null;
  const ret = b.n === 1 ? 1 : b.n === 0 ? 0 : null;
  const cat = typeof b.c === 'string' ? b.c.replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 60) : '';
  const siteHosts = String(env.SITE_ORIGINS || '').split(',').map(s => { try { return new URL(s.trim()).hostname; } catch { return ''; } }).filter(Boolean);
  const src = b.e ? sourceOf(typeof b.r === 'string' ? b.r.slice(0, 300) : '', typeof b.u === 'string' ? b.u : '', siteHosts) : null;
  const stmts = [
    env.DB.prepare(`INSERT INTO visitors (day, vid, first_ts, last_ts, hits, sessions, device, country, lang, ret) VALUES (?1, ?2, ?3, ?3, 1, 1, ?4, ?5, ?6, ?7)
      ON CONFLICT(day, vid) DO UPDATE SET hits = hits + 1, sessions = sessions + (CASE WHEN ?3 - last_ts > 1800 THEN 1 ELSE 0 END),
      last_ts = ?3, ret = COALESCE(MAX(ret, excluded.ret), ret, excluded.ret)`)
      .bind(day, vid, t, device(ua), country(req) || null, lang, ret),
    env.DB.prepare(`INSERT INTO pages (day, path, cat, views) VALUES (?, ?, ?, 1)
      ON CONFLICT(day, path) DO UPDATE SET views = views + 1, cat = CASE WHEN excluded.cat <> '' THEN excluded.cat ELSE cat END`).bind(day, path, cat),
    env.DB.prepare('INSERT INTO hours (day, hour, views) VALUES (?, ?, 1) ON CONFLICT(day, hour) DO UPDATE SET views = views + 1').bind(day, hourOf(t, env)),
  ];
  if (src) stmts.push(env.DB.prepare('INSERT INTO sources (day, kind, host, visits) VALUES (?, ?, ?, 1) ON CONFLICT(day, kind, host) DO UPDATE SET visits = visits + 1').bind(day, src.kind, src.host));
  await env.DB.batch(stmts);
  return done();
}

// ---- finished days are summarised once into day_stats; raw visitor rows are removed after 8 days ----------------
export async function rollup(env, t = now()) {
  const today = dayOf(t, env);
  const { results } = await env.DB.prepare(`SELECT DISTINCT day FROM visitors WHERE day < ?1 AND day > '0000-00-00' AND day NOT IN (SELECT day FROM day_stats WHERE dim = 'total')`).bind(today).all();
  for (const { day } of results) {
    await env.DB.batch([
      env.DB.prepare(`INSERT OR REPLACE INTO day_stats (day, dim, key, visitors, views, sessions, ret, consented)
        SELECT day, 'total', '', COUNT(*), SUM(hits), SUM(sessions), SUM(ret = 1), SUM(ret IS NOT NULL) FROM visitors WHERE day = ?1 GROUP BY day`).bind(day),
      ...['device', 'country', 'lang'].map(dim => env.DB.prepare(`INSERT OR REPLACE INTO day_stats (day, dim, key, visitors, views, sessions, ret, consented)
        SELECT day, '${dim}', COALESCE(${dim}, ''), COUNT(*), SUM(hits), SUM(sessions), SUM(ret = 1), SUM(ret IS NOT NULL) FROM visitors WHERE day = ?1 GROUP BY day, COALESCE(${dim}, '')`).bind(day)),
    ]);
  }
  await env.DB.batch([
    env.DB.prepare('DELETE FROM visitors WHERE day < ?').bind(addDays(today, -8)),
    env.DB.prepare('DELETE FROM salts WHERE day < ?').bind(addDays(today, -1)),
    env.DB.prepare('DELETE FROM ratelimit WHERE reset < ?').bind(t - 3600),
    env.DB.prepare('DELETE FROM sessions WHERE expires < ?').bind(t),
    env.DB.prepare('DELETE FROM audit WHERE ts < ?').bind(t - 400 * 86400),
  ]);
  return results.length;
}

// ---- dashboard queries (owner only) ---------------------------------------------------------------------------------
export function rangeOf(q, env, t = now()) {
  const today = dayOf(t, env);
  const r = q.get('range') || '30d';
  const presets = {
    today: [today, today], yesterday: [addDays(today, -1), addDays(today, -1)],
    '7d': [addDays(today, -6), today], '30d': [addDays(today, -29), today], '90d': [addDays(today, -89), today],
    week: [addDays(today, -((new Date(today).getUTCDay() + 6) % 7)), today],            // Monday to today
    month: [today.slice(0, 8) + '01', today], '12m': [addDays(today, -364), today],
  };
  let [from, to] = presets[r] || [q.get('from'), q.get('to')];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from || '') || !/^\d{4}-\d{2}-\d{2}$/.test(to || '')) [from, to] = presets['30d'];
  if (from > to) [from, to] = [to, from];
  if (to > today) to = today;
  if (Date.parse(to) - Date.parse(from) > 400 * 864e5) from = addDays(to, -400);
  const len = Math.round((Date.parse(to) - Date.parse(from)) / 864e5) + 1;
  return { from, to, today, len, prevFrom: addDays(from, -len), prevTo: addDays(from, -1), range: presets[r] ? r : 'custom' };
}

// totals per day for finished days come from day_stats, recent days straight from visitors
async function dailyTotals(env, from, to) {
  const { results: done } = await env.DB.prepare(`SELECT day, visitors, views, sessions, ret, consented FROM day_stats WHERE dim = 'total' AND day BETWEEN ?1 AND ?2`).bind(from, to).all();
  const have = new Set(done.map(r => r.day));
  const { results: live } = await env.DB.prepare(`SELECT day, COUNT(*) visitors, SUM(hits) views, SUM(sessions) sessions, SUM(ret = 1) ret, SUM(ret IS NOT NULL) consented
    FROM visitors WHERE day BETWEEN ?1 AND ?2 GROUP BY day`).bind(from, to).all();
  return [...done, ...live.filter(r => !have.has(r.day))];
}
async function dims(env, dim, from, to, today) {
  // finished days from day_stats + days not yet summarised from visitors
  const { results } = await env.DB.prepare(`SELECT key, SUM(visitors) visitors, SUM(views) views FROM (
      SELECT key, visitors, views FROM day_stats WHERE dim = ?1 AND day BETWEEN ?2 AND ?3
      UNION ALL SELECT COALESCE(${dim}, '') key, 1 visitors, hits views FROM visitors
        WHERE day BETWEEN ?2 AND ?3 AND day NOT IN (SELECT day FROM day_stats WHERE dim = 'total' AND day BETWEEN ?2 AND ?3)
    ) GROUP BY key ORDER BY visitors DESC LIMIT 30`).bind(dim, from, to).all();
  return results;
}
const sum = (rows, k) => rows.reduce((a, r) => a + (r[k] || 0), 0);
const totals = rows => ({ visitors: sum(rows, 'visitors'), views: sum(rows, 'views'), sessions: sum(rows, 'sessions'), returning: sum(rows, 'ret'), consented: sum(rows, 'consented') });

const cache = new Map();
async function cached(key, ttl, fn) {
  const c = cache.get(key);
  if (c && c.until > Date.now()) return c.v;
  const v = await fn();
  cache.set(key, { v, until: Date.now() + ttl * 1000 });
  if (cache.size > 50) cache.delete(cache.keys().next().value);
  return v;
}

export async function summary(req, env) {
  const R = rangeOf(new URL(req.url).searchParams, env);
  const data = await cached('s:' + JSON.stringify(R), R.to === R.today ? 45 : 600, async () => {
    await rollup(env);
    const T = R.today;
    const [cur, prev, quick, all, first, pages, srcs, devices, countries, langs, hours] = await Promise.all([
      dailyTotals(env, R.from, R.to), dailyTotals(env, R.prevFrom, R.prevTo),
      dailyTotals(env, addDays(T, -59), T),
      env.DB.prepare(`SELECT SUM(visitors) visitors, SUM(views) views, SUM(sessions) sessions FROM day_stats WHERE dim = 'total'`).first(),
      env.DB.prepare(`SELECT MIN(day) d FROM (SELECT MIN(day) day FROM day_stats UNION ALL SELECT MIN(day) FROM visitors WHERE day > '0000-00-00' UNION ALL SELECT MIN(day) FROM pages WHERE day > '0000-00-00')`).first(),
      env.DB.prepare(`SELECT path, MAX(cat) cat, SUM(views) views FROM pages WHERE day BETWEEN ?1 AND ?2 GROUP BY path ORDER BY views DESC LIMIT 200`).bind(R.from, R.to).all(),
      env.DB.prepare(`SELECT kind, host, SUM(visits) visits FROM sources WHERE day BETWEEN ?1 AND ?2 GROUP BY kind, host ORDER BY visits DESC LIMIT 60`).bind(R.from, R.to).all(),
      dims(env, 'device', R.from, R.to, T), dims(env, 'country', R.from, R.to, T), dims(env, 'lang', R.from, R.to, T),
      env.DB.prepare(`SELECT day, hour, views FROM hours WHERE day BETWEEN ?1 AND ?2`).bind(R.len <= 2 ? R.from : R.to, R.to).all(),
    ]);
    const byDay = Object.fromEntries(quick.map(r => [r.day, r]));
    const v = d => byDay[d]?.visitors || 0;
    const live = await env.DB.prepare(`SELECT day, COUNT(*) visitors, SUM(hits) views, SUM(sessions) sessions FROM visitors WHERE day >= ?1 AND day NOT IN (SELECT day FROM day_stats WHERE dim='total') GROUP BY day`).bind(addDays(T, -8)).all();
    const allTime = { visitors: (all?.visitors || 0) + sum(live.results, 'visitors'), views: (all?.views || 0) + sum(live.results, 'views'), sessions: (all?.sessions || 0) + sum(live.results, 'sessions') };
    const weekStart = rangeOf(new URLSearchParams('range=week'), env).from, monthStart = T.slice(0, 8) + '01';
    const rangeSum = (a, b) => quick.filter(r => r.day >= a && r.day <= b).reduce((s, r) => s + r.visitors, 0);
    const pg = pages.results;
    const cats = {};
    for (const p of pg) if (p.path.startsWith('/war/') && p.cat) cats[p.cat] = (cats[p.cat] || 0) + p.views;
    for (const p of pg) if (p.path.startsWith('/qayb/')) { const k = p.path.slice(6); cats[k] = (cats[k] || 0) + p.views; }
    const series = [];
    for (let d = R.from; d <= R.to; d = addDays(d, 1)) { const r = cur.find(x => x.day === d); series.push({ day: d, visitors: r?.visitors || 0, views: r?.views || 0, sessions: r?.sessions || 0 }); }
    return {
      range: R, since: first?.d || null, tz: 'Africa/Mogadishu (UTC+3)',
      quick: { today: v(T), yesterday: v(addDays(T, -1)), week: rangeSum(weekStart, T), month: rangeSum(monthStart, T), last30: rangeSum(addDays(T, -29), T), allTime },
      totals: totals(cur), previous: totals(prev), series,
      hours: hours.results,
      articles: pg.filter(p => p.path.startsWith('/war/')).slice(0, 25).map(p => ({ id: p.path.slice(5), cat: p.cat, views: p.views })),
      sections: pg.filter(p => !p.path.startsWith('/war/')).slice(0, 25),
      categories: Object.entries(cats).map(([name, views]) => ({ name, views })).sort((a, b) => b.views - a.views).slice(0, 15),
      sources: srcs.results, devices: devices, countries: countries, languages: langs,
    };
  });
  return json(data);
}

export async function realtime(req, env) {
  const data = await cached('rt', 15, async () => {
    const t = now(), day = dayOf(t, env);
    const r5 = await env.DB.prepare('SELECT COUNT(*) n, device FROM visitors WHERE day IN (?1, ?2) AND last_ts >= ?3 GROUP BY device').bind(day, dayOf(t - 1800, env), t - 300).all();
    const r30 = await env.DB.prepare('SELECT COUNT(*) n FROM visitors WHERE day IN (?1, ?2) AND last_ts >= ?3').bind(day, dayOf(t - 1800, env), t - 1800).first();
    const hrs = await env.DB.prepare('SELECT hour, views FROM hours WHERE day = ? ORDER BY hour').bind(day).all();
    return { at: t, active5: sum(r5.results, 'n'), byDevice: r5.results, active30: r30?.n || 0, todayHours: hrs.results };
  });
  return json(data);
}
