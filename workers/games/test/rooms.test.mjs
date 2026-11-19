// End-to-end test of the room server: starts `wrangler dev` locally and plays a short session with three sockets.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';

const PORT = 8790 + Math.floor(Math.random() * 100), BASE = 'http://127.0.0.1:' + PORT, ORIGIN = 'https://www.wartabiyetv.com';
let dev;
before(async () => {
  dev = spawn('npx', ['wrangler', 'dev', '--port', String(PORT), '--ip', '127.0.0.1'], { stdio: 'ignore', env: process.env, detached: true });
  for (let i = 0; i < 90; i++) { try { const r = await fetch(BASE + '/health'); if (r.ok) return; } catch (e) {} await new Promise((r) => setTimeout(r, 1000)); }
  throw new Error('wrangler dev did not start');
});
after(() => { try { process.kill(-dev.pid, 'SIGTERM'); } catch (e) {} });

function sock(code, q) {
  const ws = new WebSocket(BASE.replace('http', 'ws') + '/room/' + code + '?g=ludo&' + new URLSearchParams(q), { headers: { Origin: ORIGIN } });
  const inbox = []; let waiters = [];
  ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); inbox.push(m); waiters = waiters.filter((w) => !w(m)); });
  ws.next = (t, ms = 5000) => new Promise((ok, bad) => {
    const i = inbox.findIndex((m) => m.t === t); if (i >= 0) return ok(inbox.splice(i, 1)[0]);
    const timer = setTimeout(() => bad(new Error('no ' + t)), ms);
    waiters.push((m) => { if (m.t !== t) return false; inbox.splice(inbox.indexOf(m), 1); clearTimeout(timer); ok(m); return true; });
  });
  ws.j = (o) => ws.send(JSON.stringify(o));
  return ws;
}

test('health and origin checks', async () => {
  assert.equal((await (await fetch(BASE + '/health')).json()).ok, true);
  assert.equal((await fetch(BASE + '/new', { method: 'POST', headers: { Origin: 'https://evil.example' } })).status, 403);
  const r = await fetch(BASE + '/new', { method: 'POST', headers: { Origin: ORIGIN } });
  assert.match((await r.json()).code, /^[A-Z2-9]{6}$/);
});

test('a host and two friends play in a private room', async () => {
  const { code } = await (await fetch(BASE + '/new', { method: 'POST', headers: { Origin: ORIGIN } })).json();
  const nobody = sock(code, { pid: 'zzzzzzzzzz', name: 'X' });
  assert.equal((await nobody.next('err')).e, 'noroom');
  const host = sock(code, { pid: 'hosthost01', name: 'Mahad <b>', host: '1' });
  const hello = await host.next('hello'); assert.equal(hello.you, true);
  const a = sock(code, { pid: 'friendaaa1', name: 'Amina' }); await a.next('hello');
  const b = sock(code, { pid: 'friendbbb1', name: 'Bashiir' }); await b.next('hello');
  let peers; for (let i = 0; i < 6; i++) { peers = await host.next('peers'); if (peers.peers.length === 3) break; }
  assert.deepEqual(peers.peers.map((p) => p.name), ['Mahad b', 'Amina', 'Bashiir']);
  // the host's state reaches the friends, a friend's move reaches only the host
  host.j({ t: 'state', s: { cur: 0, die: 4 } });
  assert.deepEqual((await a.next('state')).s, { cur: 0, die: 4 });
  assert.deepEqual((await b.next('state')).s, { cur: 0, die: 4 });
  a.j({ t: 'act', a: { roll: 1 } });
  const act = await host.next('act'); assert.equal(act.from, 'friendaaa1'); assert.deepEqual(act.a, { roll: 1 });
  // only the fixed reactions are relayed; free text is not
  a.j({ t: 'emote', e: '👍' }); assert.equal((await b.next('emote')).e, '👍');
  a.j({ t: 'emote', e: 'hello there' }); await assert.rejects(b.next('emote', 800));
  // a friend cannot send state
  b.j({ t: 'state', s: { cheat: 1 } }); await assert.rejects(a.next('state', 800));
  // after the start nobody new can join, but a known friend can come back and gets the last state
  host.j({ t: 'start' }); await host.next('peers');
  const late = sock(code, { pid: 'latecomer1', name: 'Late' }); assert.equal((await late.next('err')).e, 'started');
  b.close(); await new Promise((r) => setTimeout(r, 300));
  const b2 = sock(code, { pid: 'friendbbb1', name: 'Bashiir' }); await b2.next('hello');
  assert.deepEqual((await b2.next('state')).s, { cur: 0, die: 4 });
  [host, a, b2, late, nobody].forEach((w) => { try { w.close(); } catch (e) {} });
});
