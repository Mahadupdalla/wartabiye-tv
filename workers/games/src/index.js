/* Wartabiye TV Games: private online rooms for friends.
   A room is a 6-letter code. The first player (the host) runs the game on their device; friends who open the same code
   send their moves to the host and receive the game state back. The server only relays and keeps the latest state so a
   friend whose connection drops can come back.
   Safety: there is no chat and no free text except a short player name (letters and numbers only); quick reactions are
   a fixed list of emoji. No accounts, no public lobby, no strangers: you can only join with a code a friend gives you.
   Rooms are removed 6 hours after the last activity. */
import { DurableObject } from 'cloudflare:workers';

const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const MAX_PLAYERS = 4, MAX_MSG = 24000, ROOM_TTL = 6 * 3600 * 1000;
const EMOTES = ['👍', '😂', '😮', '🔥', '👏', '😢', '🎲', '🏆'];
const GAMES = ['ludo'];

export function cleanName(s) {
  s = String(s || '').normalize('NFC').replace(/[^\p{L}\p{N} ]/gu, '').replace(/\s+/g, ' ').trim().slice(0, 14);
  return s || 'Player';
}
export function cleanCode(s) { s = String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, ''); return s.length === 6 && [...s].every((c) => CODE_CHARS.includes(c)) ? s : null; }
export function newCode() { const b = new Uint8Array(6); crypto.getRandomValues(b); return [...b].map((x) => CODE_CHARS[x % CODE_CHARS.length]).join(''); }

function origins(env) { return String(env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean); }
function cors(req, env) {
  const o = req.headers.get('Origin') || '';
  return origins(env).includes(o) ? { 'Access-Control-Allow-Origin': o, 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', 'Vary': 'Origin' } : {};
}
function json(body, status, h) { return new Response(JSON.stringify(body), { status: status || 200, headers: Object.assign({ 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }, h || {}) }); }

export default {
  async fetch(req, env) {
    const url = new URL(req.url), h = cors(req, env);
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: h });
    if (url.pathname === '/health') return json({ ok: true, service: 'wartabiye-games' }, 200, h);
    const okOrigin = origins(env).includes(req.headers.get('Origin') || '');
    if (url.pathname === '/new' && req.method === 'POST') {
      if (!okOrigin) return json({ error: 'origin' }, 403);
      return json({ code: newCode() }, 200, h);
    }
    const m = /^\/room\/([A-Za-z0-9]{6})$/.exec(url.pathname);
    if (m) {
      if (req.headers.get('Upgrade') !== 'websocket') return json({ error: 'websocket only' }, 426, h);
      if (!okOrigin) return json({ error: 'origin' }, 403);
      const code = cleanCode(m[1]), game = url.searchParams.get('g') || 'ludo';
      if (!code || !GAMES.includes(game)) return json({ error: 'bad room' }, 400);
      return env.ROOMS.get(env.ROOMS.idFromName(game + ':' + code)).fetch(req);
    }
    return json({ error: 'not found' }, 404, h);
  }
};

export class Room extends DurableObject {
  constructor(ctx, env) { super(ctx, env); this.ctx = ctx; }
  peers() { return this.ctx.getWebSockets().map((ws) => ({ ws, a: ws.deserializeAttachment() || {} })).filter((p) => p.a.pid); }
  send(ws, o) { try { ws.send(JSON.stringify(o)); } catch (e) {} }
  async meta() { return (await this.ctx.storage.get('meta')) || null; }
  async touch() { await this.ctx.storage.setAlarm(Date.now() + ROOM_TTL); }
  async roster() {
    const meta = await this.meta(); if (!meta) return;
    // in joining order (the order decides the colours)
    const on = {}; this.peers().forEach((p) => { on[p.a.pid] = 1; });
    const list = (meta.players || []).map((q) => ({ pid: q.pid, name: q.name, host: q.pid === meta.host, away: !on[q.pid] }));
    this.peers().forEach((p) => this.send(p.ws, { t: 'peers', peers: list, started: !!meta.started, host: meta.host }));
  }
  async fetch(req) {
    const url = new URL(req.url), pid = String(url.searchParams.get('pid') || '').replace(/[^a-z0-9]/gi, '').slice(0, 24);
    const name = cleanName(url.searchParams.get('name')), wantHost = url.searchParams.get('host') === '1';
    const pair = new WebSocketPair(), [client, server] = Object.values(pair);
    this.ctx.acceptWebSocket(server);
    const fail = (e) => { this.send(server, { t: 'err', e }); server.close(4000, e); return new Response(null, { status: 101, webSocket: client }); };
    if (pid.length < 8) return fail('pid');
    let meta = await this.meta();
    if (!meta) {
      if (!wantHost) return fail('noroom');
      meta = { host: pid, created: Date.now(), started: false, players: [{ pid, name }] };
    } else {
      const known = meta.players.find((q) => q.pid === pid);
      if (!known) {
        if (meta.started) return fail('started');
        if (meta.players.length >= MAX_PLAYERS) return fail('full');
        meta.players.push({ pid, name });
      } else known.name = name;
    }
    // a second tab of the same player replaces the first
    this.peers().forEach((p) => { if (p.a.pid === pid && p.ws !== server) { this.send(p.ws, { t: 'err', e: 'replaced' }); try { p.ws.close(4001, 'replaced'); } catch (e) {} } });
    server.serializeAttachment({ pid, name, n: 0, t0: Date.now() });
    await this.ctx.storage.put('meta', meta); await this.touch();
    this.send(server, { t: 'hello', pid, host: meta.host, you: pid === meta.host });
    const st = await this.ctx.storage.get('state'); if (st) this.send(server, { t: 'state', s: st });
    await this.roster();
    if (pid !== meta.host) this.peers().forEach((p) => { if (p.a.pid === meta.host) this.send(p.ws, { t: 'joined', pid, name }); });
    return new Response(null, { status: 101, webSocket: client });
  }
  async webSocketMessage(ws, raw) {
    const a = ws.deserializeAttachment() || {}; if (!a.pid) return;
    if (typeof raw !== 'string' || raw.length > MAX_MSG) return;
    // at most 40 messages in 4 seconds per player
    const now = Date.now(); if (now - a.t0 > 4000) { a.t0 = now; a.n = 0; } if (++a.n > 40) return; ws.serializeAttachment(a);
    let m; try { m = JSON.parse(raw); } catch (e) { return; }
    const meta = await this.meta(); if (!meta) return;
    const isHost = a.pid === meta.host;
    if (m.t === 'state' && isHost) {
      await this.ctx.storage.put('state', m.s); await this.touch();
      this.peers().forEach((p) => { if (p.ws !== ws) this.send(p.ws, { t: 'state', s: m.s }); });
    } else if (m.t === 'start' && isHost) {
      meta.started = true; meta.players = meta.players.filter((q) => this.peers().some((p) => p.a.pid === q.pid)); await this.ctx.storage.put('meta', meta); await this.roster();
    } else if (m.t === 'kick' && isHost && typeof m.pid === 'string' && m.pid !== meta.host) {
      meta.players = meta.players.filter((q) => q.pid !== m.pid); await this.ctx.storage.put('meta', meta);
      this.peers().forEach((p) => { if (p.a.pid === m.pid) { this.send(p.ws, { t: 'err', e: 'kicked' }); try { p.ws.close(4002, 'kicked'); } catch (e) {} } });
      await this.roster();
    } else if (m.t === 'act' && !isHost) {
      this.peers().forEach((p) => { if (p.a.pid === meta.host) this.send(p.ws, { t: 'act', from: a.pid, a: m.a }); });
    } else if (m.t === 'emote' && EMOTES.includes(m.e)) {
      this.peers().forEach((p) => this.send(p.ws, { t: 'emote', from: a.pid, e: m.e }));
    } else if (m.t === 'ping') this.send(ws, { t: 'pong' });
  }
  async webSocketClose(ws) { const a = ws.deserializeAttachment() || {}; try { ws.close(1000, 'bye'); } catch (e) {} if (a.pid) { const meta = await this.meta(); if (meta && !meta.started) { if (!this.peers().some((p) => p.ws !== ws && p.a.pid === a.pid)) { meta.players = meta.players.filter((q) => q.pid !== a.pid || q.pid === meta.host); await this.ctx.storage.put('meta', meta); } } await this.roster(); } }
  async webSocketError(ws) { return this.webSocketClose(ws); }
  async alarm() { await this.ctx.storage.deleteAll(); }
}
