// Local test server for the audio Worker (no Cloudflare account needed): node scripts/dev-server.mjs
//   PORT=8787  SITE_URL=http://localhost:8000/  (the website to read articles from)
//   With AZURE_SPEECH_KEY and AZURE_SPEECH_REGION in the environment it uses the real voices; with FAKE_TTS=1 every
//   part is a test tone (for the browser tests), so the player can be tested without any key.
import http from 'node:http';
import { readFileSync } from 'node:fs';
import worker from '../src/index.js';

const PORT = parseInt(process.env.PORT || '8787', 10);
const kv = new Map();
const TTS = {
  async get(k, type) { if (!kv.has(k)) return null; const v = kv.get(k); if (type === 'json') return JSON.parse(v); if (type === 'arrayBuffer') return v.buffer.slice(v.byteOffset, v.byteOffset + v.byteLength); return v; },
  async put(k, v) { kv.set(k, typeof v === 'string' ? v : new Uint8Array(v)); },
  async delete(k) { kv.delete(k); },
};
const env = { ...process.env, TTS, SITE_URL: process.env.SITE_URL || 'http://localhost:8000/', ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS || 'http://localhost:8000,http://127.0.0.1:8000', IP_LIMIT: process.env.IP_LIMIT || '1000' };
const TONE = new Uint8Array(readFileSync(new URL('../test/tone.mp3', import.meta.url)));
export const stats = { generated: 0, requests: [] };
const fake = process.env.FAKE_TTS === '1';
if (fake) { env.AZURE_SPEECH_KEY = 'fake-key'; env.AZURE_SPEECH_REGION = 'fake'; }
const delay = parseInt(process.env.FAKE_DELAY_MS || '600', 10);
const fetchImpl = async (url, init) => {
  if (fake && /tts\.speech\.microsoft\.com/.test(String(url))) {
    stats.generated++; stats.requests.push(String(init.body));
    await new Promise(r => setTimeout(r, delay));
    if (process.env.FAKE_FAIL === '1') return new Response('down', { status: 500 });
    const n = 8, out = new Uint8Array(TONE.length * n);            // 8 seconds of tone per part
    for (let i = 0; i < n; i++) out.set(TONE, i * TONE.length);
    return new Response(out, { status: 200 });
  }
  const { cf, ...rest } = init || {};
  return fetch(url, rest);
};

http.createServer(async (req, res) => {
  try {
    if (req.url === '/__stats') { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(stats)); return; }
    const r = await worker.fetch(new Request(`http://localhost:${PORT}${req.url}`, { method: req.method, headers: req.headers }), env, { waitUntil() {} }, fetchImpl);
    const h = {}; r.headers.forEach((v, k) => { h[k] = v; });
    res.writeHead(r.status, h);
    res.end(r.body ? Buffer.from(await r.arrayBuffer()) : undefined);
  } catch (e) { res.writeHead(500); res.end(String(e)); }
}).listen(PORT, () => console.log(`wartabiye-tts dev server on http://localhost:${PORT} (${fake ? 'test tones' : 'real provider'}), site ${env.SITE_URL}`));
