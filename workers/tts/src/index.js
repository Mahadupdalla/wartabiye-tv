// Wartabiye TV article audio ("Dhageyso Warbixinta"): a Cloudflare Worker that reads a published article aloud in the
// language the visitor is reading, with the provider key kept here as a Worker secret (never in the website's code).
//
//   GET /v1/listen?id=<article id>&lang=<so|en|ar|fr|de|it|es|nl|tr>
//       → {ok, url, duration, bytes, lang, voice, cached}   (or {ok:false, code} with a reason the page can explain)
//       The Worker reads the article itself from the live website (data/story/<id>.json): the browser never sends the text,
//       so only real, published Wartabiye TV articles can be narrated. Audio is made only when someone presses Play.
//   GET /v1/a/<hash>.mp3   the narration (byte ranges for seeking; cached for a year, the address changes with the text)
//   GET /health            {ok, configured, languages}
//
// Cache: the audio's address is a hash of the exact speech text, voice and settings. Same article + same language + same
// text = the stored audio, for every listener. An edited article gives a new hash, so new audio is made at the next Play
// and the old file is deleted. Requests for the same new audio at the same time share one generation.
import { LANGS, voiceFor } from './voices.js';
import { articleParts, speechPieces, groupPieces, ssml, plainText } from './text.js';
import { providerOf, TtsError, stripId3 } from './providers.js';

export const ENGINE = 'wt-tts-1';
const ID_RX = /^[a-z0-9][a-z0-9-]{2,150}$/;
const HASH_RX = /^[a-f0-9]{32}$/;
const DEFAULTS = { MAX_CHARS: 50000, DAILY_CHAR_LIMIT: 150000, IP_LIMIT: 12, KEEP_DAYS: 180, CONCURRENCY: 3 };

const inflight = new Map();          // hash → Promise (one generation per audio file in this Worker instance)
const ipWindow = new Map();          // ip → {n, reset}  (new generations per visitor, per 10 minutes)

function num(env, k) { const n = parseInt(env[k], 10); return Number.isFinite(n) && n > 0 ? n : DEFAULTS[k]; }

function origins(env) {
  return String(env.ALLOWED_ORIGINS || 'https://www.wartabiyetv.com,https://wartabiyetv.com').split(',').map(s => s.trim()).filter(Boolean);
}

function cors(req, env) {
  const o = req.headers.get('Origin');
  const h = { Vary: 'Origin' };
  if (o && origins(env).includes(o)) Object.assign(h, { 'Access-Control-Allow-Origin': o, 'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS', 'Access-Control-Max-Age': '86400' });
  return h;
}

function json(req, env, obj, status = 200, extra = {}) {
  return new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...cors(req, env), ...extra } });
}

async function sha(text) {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(d)].map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 32);
}

function siteUrl(env) {
  const u = String(env.SITE_URL || 'https://www.wartabiyetv.com/');
  return u.endsWith('/') ? u : u + '/';
}

/** The published article from the live website, or null. */
async function loadStory(env, id, fetchImpl) {
  const r = await fetchImpl(`${siteUrl(env)}data/story/${encodeURIComponent(id)}.json`, { cf: { cacheTtl: 60, cacheEverything: true } });
  if (r.status === 404) return null;
  if (!r.ok) throw new TtsError('provider', `website HTTP ${r.status}`);
  const s = await r.json().catch(() => null);
  if (!s || typeof s !== 'object' || (s.id && s.id !== id) || s.published === false) return null;
  return s;
}

/** Everything that decides the sound: if any of it changes, the hash (and so the audio file) changes. */
export async function plan(story, lang, env) {
  const v = voiceFor(lang, env);
  if (!v) return { error: 'no_voice' };
  const parts = articleParts(story, lang);
  if (!parts) return { error: 'no_text' };
  const prov = providerOf(v);
  const pieces = speechPieces(parts, lang, { sports: story.section === 'sports' || story.category === 'Ciyaaraha' }, prov.max);
  const chars = pieces.reduce((n, p) => n + p.text.length, 0);
  if (!chars) return { error: 'no_text' };
  if (chars > num(env, 'MAX_CHARS')) return { error: 'too_long', chars };
  const groups = groupPieces(pieces, prov.max);
  const reqs = groups.map((g, i) => (v.provider === 'azure' ? ssml(g, v, { first: i === 0, last: i === groups.length - 1 }) : plainText(g)));
  const hash = await sha(JSON.stringify([ENGINE, v.provider, v.voice, v.rate, prov.format, reqs]));
  return { v, prov, groups, reqs, chars, hash };
}

// ---------- storage: KV (default) or R2 for the audio, KV for the small records ----------

async function getMeta(env, hash) {
  const m = await env.TTS.get('m:' + hash, 'json');
  return m && m.bytes ? m : null;
}

async function getAudio(env, hash) {
  if (env.AUDIO_R2) { const o = await env.AUDIO_R2.get('a/' + hash + '.mp3'); return o ? new Uint8Array(await o.arrayBuffer()) : null; }
  const b = await env.TTS.get('a:' + hash, 'arrayBuffer');
  return b ? new Uint8Array(b) : null;
}

async function putAudio(env, hash, bytes, meta, id, lang) {
  const ttl = num(env, 'KEEP_DAYS') * 86400;
  if (env.AUDIO_R2) await env.AUDIO_R2.put('a/' + hash + '.mp3', bytes, { httpMetadata: { contentType: 'audio/mpeg' } });
  else await env.TTS.put('a:' + hash, bytes, { expirationTtl: ttl });
  await env.TTS.put('m:' + hash, JSON.stringify(meta), { expirationTtl: ttl });
  // the article's previous audio in this language (the text was edited): no longer used, removed
  const pk = `p:${id}:${lang}`;
  const old = await env.TTS.get(pk);
  if (old && old !== hash && HASH_RX.test(old)) {
    await env.TTS.delete('m:' + old);
    if (env.AUDIO_R2) await env.AUDIO_R2.delete('a/' + old + '.mp3'); else await env.TTS.delete('a:' + old);
  }
  if (old !== hash) await env.TTS.put(pk, hash, { expirationTtl: ttl });
}

function today() { return new Date().toISOString().slice(0, 10); }

async function budgetLeft(env, chars) {
  const used = parseInt(await env.TTS.get('u:' + today()) || '0', 10) || 0;
  return used + chars <= num(env, 'DAILY_CHAR_LIMIT');
}

async function spend(env, chars) {
  const k = 'u:' + today();
  const used = parseInt(await env.TTS.get(k) || '0', 10) || 0;
  await env.TTS.put(k, String(used + chars), { expirationTtl: 3 * 86400 });
}

async function ipAllowed(env, ip) {
  if (env.LIMITER && typeof env.LIMITER.limit === 'function') {
    try { const { success } = await env.LIMITER.limit({ key: ip }); if (!success) return false; } catch (e) { /* the limiter is optional */ }
  }
  const now = Date.now(), w = ipWindow.get(ip);
  if (!w || w.reset < now) { ipWindow.set(ip, { n: 1, reset: now + 600000 }); if (ipWindow.size > 5000) ipWindow.clear(); return true; }
  w.n++;
  return w.n <= num(env, 'IP_LIMIT');
}

/** Makes the audio: every part (a few at a time), joined in order into one MP3. */
async function generate(env, p, fetchImpl) {
  const out = new Array(p.groups.length);
  let next = 0;
  const worker = async () => {
    while (next < p.groups.length) {
      const i = next++;
      out[i] = stripId3(await p.prov.speak(env, p.v, p.groups[i], { first: i === 0, last: i === p.groups.length - 1 }, fetchImpl));
    }
  };
  await Promise.all(Array.from({ length: Math.min(num(env, 'CONCURRENCY'), p.groups.length) }, worker));
  const total = out.reduce((n, b) => n + b.length, 0);
  const bytes = new Uint8Array(total);
  let o = 0;
  for (const b of out) { bytes.set(b, o); o += b.length; }
  return bytes;
}

function audioUrl(req, hash) {
  return new URL(`/v1/a/${hash}.mp3`, req.url).href;
}

function answer(req, env, p, meta, cached) {
  return json(req, env, { ok: true, url: audioUrl(req, p.hash), duration: meta.duration, bytes: meta.bytes, lang: meta.lang, voice: { name: p.v.name, locale: p.v.locale }, cached });
}

async function listen(req, env, ctx, fetchImpl) {
  const u = new URL(req.url);
  const id = u.searchParams.get('id') || '', lang = u.searchParams.get('lang') || '';
  if (!ID_RX.test(id)) return json(req, env, { ok: false, code: 'bad_request' }, 400);
  if (!LANGS.includes(lang)) return json(req, env, { ok: false, code: 'no_voice' }, 400);
  if (String(env.TTS_MODE || '').trim() === 'off') return json(req, env, { ok: false, code: 'disabled' }, 503);
  let story;
  try { story = await loadStory(env, id, fetchImpl); } catch (e) { return json(req, env, { ok: false, code: 'unavailable' }, 502); }
  if (!story) return json(req, env, { ok: false, code: 'not_found' }, 404);
  const p = await plan(story, lang, env);
  if (p.error) return json(req, env, { ok: false, code: p.error }, p.error === 'too_long' ? 413 : 404);
  const have = await getMeta(env, p.hash);
  if (have) return answer(req, env, p, have, true);
  if (!p.prov.configured(env)) return json(req, env, { ok: false, code: 'not_configured' }, 503);
  let job = inflight.get(p.hash);
  if (!job) {
    const ip = req.headers.get('CF-Connecting-IP') || 'local';
    if (!(await ipAllowed(env, ip))) return json(req, env, { ok: false, code: 'busy' }, 429, { 'Retry-After': '120' });
    if (!(await budgetLeft(env, p.chars))) return json(req, env, { ok: false, code: 'limit' }, 429, { 'Retry-After': '3600' });
    job = (async () => {
      const bytes = await generate(env, p, fetchImpl);
      const meta = { bytes: bytes.length, duration: Math.round((bytes.length * 8) / (p.prov.kbps * 1000) * 10) / 10, lang, id, voice: p.v.voice, provider: p.v.provider, chars: p.chars, parts: p.groups.length, created: new Date().toISOString(), engine: ENGINE };
      await putAudio(env, p.hash, bytes, meta, id, lang);
      await spend(env, p.chars);
      return meta;
    })();
    inflight.set(p.hash, job);
    job.finally(() => inflight.delete(p.hash)).catch(() => {});
  }
  try {
    return answer(req, env, p, await job, false);
  } catch (e) {
    const code = e instanceof TtsError ? e.code : 'provider';
    console.log(JSON.stringify({ tts_error: code, id, lang, message: String(e && e.message || e).slice(0, 300) }));
    return json(req, env, { ok: false, code }, code === 'busy' ? 429 : code === 'no_voice' ? 404 : 502);
  }
}

async function audio(req, env, ctx, hash) {
  const bytes = await getAudio(env, hash);
  const base = { 'Content-Type': 'audio/mpeg', 'Accept-Ranges': 'bytes', 'Access-Control-Allow-Origin': '*', 'X-Content-Type-Options': 'nosniff', 'Cross-Origin-Resource-Policy': 'cross-origin' };
  if (!bytes) return new Response('not found', { status: 404, headers: { 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*' } });
  const cache = { 'Cache-Control': 'public, max-age=31536000, immutable', ETag: `"${hash}"` };
  const n = bytes.length;
  const range = req.headers.get('Range');
  const m = range && /^bytes=(\d*)-(\d*)$/.exec(range.trim());
  if (m && (m[1] || m[2])) {
    let start, end;
    if (m[1]) { start = parseInt(m[1], 10); end = m[2] ? Math.min(parseInt(m[2], 10), n - 1) : n - 1; }
    else { const k = Math.min(parseInt(m[2], 10), n); start = n - k; end = n - 1; }
    if (!(start <= end) || start >= n) return new Response(null, { status: 416, headers: { ...base, 'Content-Range': `bytes */${n}` } });
    const body = req.method === 'HEAD' ? null : bytes.subarray(start, end + 1);
    return new Response(body, { status: 206, headers: { ...base, ...cache, 'Content-Range': `bytes ${start}-${end}/${n}`, 'Content-Length': String(end - start + 1) } });
  }
  return new Response(req.method === 'HEAD' ? null : bytes, { status: 200, headers: { ...base, ...cache, 'Content-Length': String(n) } });
}

export default {
  async fetch(req, env, ctx, fetchImpl = fetch) {
    const u = new URL(req.url);
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(req, env) });
    if (req.method !== 'GET' && req.method !== 'HEAD') return json(req, env, { ok: false, code: 'bad_request' }, 405);
    try {
      if (u.pathname === '/health') {
        const langs = LANGS.filter(l => voiceFor(l, env)).map(l => { const v = voiceFor(l, env); return { lang: l, provider: v.provider, configured: providerOf(v).configured(env) }; });
        return json(req, env, { ok: true, engine: ENGINE, mode: String(env.TTS_MODE || 'on'), configured: langs.length > 0 && langs.every(x => x.configured), languages: langs, storage: env.AUDIO_R2 ? 'r2' : 'kv' });
      }
      if (u.pathname === '/v1/listen') return await listen(req, env, ctx, fetchImpl);
      const a = /^\/v1\/a\/([a-f0-9]{32})\.mp3$/.exec(u.pathname);
      if (a) return await audio(req, env, ctx, a[1]);
      return json(req, env, { ok: false, code: 'not_found' }, 404);
    } catch (e) {
      console.log(JSON.stringify({ tts_error: 'internal', message: String(e && e.message || e).slice(0, 300) }));
      return json(req, env, { ok: false, code: 'unavailable' }, 500);
    }
  },
};
