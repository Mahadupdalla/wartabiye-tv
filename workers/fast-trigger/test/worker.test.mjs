import test from 'node:test';
import assert from 'node:assert/strict';
import { hoursOf, isOpen, tick } from '../src/index.js';

const at = (h, m = 0) => new Date(Date.UTC(2026, 10, 8, (h + 21) % 24, m)); // Nairobi time -> UTC

test('operating hours', () => {
  assert.equal(hoursOf({ hours: '24/7' }), null);
  assert.deepEqual(hoursOf({ hours: '07:00-23:00' }), [7, 23]);
  assert.ok(isOpen(at(3), { hours: '24/7' }));
  assert.ok(isOpen(at(7), { hours: '07:00-23:00' }) && isOpen(at(22, 55), { hours: '07:00-23:00' }));
  assert.ok(!isOpen(at(23), { hours: '07:00-23:00' }) && !isOpen(at(6, 59), { hours: '07:00-23:00' }));
});

test('starts the monitor only with a token and inside hours', async () => {
  const calls = [];
  const env = { REPO: 'o/r', WORKFLOW: 'w.yml', SCHEDULE_URL: 'https://x.test/s.json', GH_DISPATCH_TOKEN: 't' };
  globalThis.fetch = async () => new Response(JSON.stringify({ hours: '07:00-23:00' }));
  const f = async (url, o) => { calls.push([url, o]); return new Response(null, { status: 204 }); };
  assert.deepEqual(await tick(env, at(12), f), { started: true, status: 204 });
  assert.equal(calls[0][0], 'https://api.github.com/repos/o/r/actions/workflows/w.yml/dispatches');
  assert.equal(JSON.parse(calls[0][1].body).ref, 'main');
  assert.equal((await tick(env, at(2), f)).started, false);
  assert.equal((await tick({ ...env, GH_DISPATCH_TOKEN: '' }, at(12), f)).started, false);
  assert.equal(calls.length, 1);
});
