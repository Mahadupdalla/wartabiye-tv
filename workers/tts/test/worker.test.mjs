// Tests for the article audio Worker, no network: a fake KV store, a fake website and a fake speech provider.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import worker, { plan } from '../src/index.js';
import { articleParts, speechPieces, groupPieces, normalize, ssml } from '../src/text.js';
import { voiceFor } from '../src/voices.js';

const TONE = new Uint8Array(readFileSync(new URL('./tone.mp3', import.meta.url)));
const KEY = 'test-azure-key-0123456789abcdef';

class KV {
  constructor() { this.m = new Map(); this.writes = 0; }
  async get(k, type) {
    if (!this.m.has(k)) return null;
    const v = this.m.get(k);
    if (type === 'json') return JSON.parse(v);
    if (type === 'arrayBuffer') return v.buffer.slice(v.byteOffset, v.byteOffset + v.byteLength);
    return v;
  }
  async put(k, v) { this.writes++; this.m.set(k, typeof v === 'string' ? v : new Uint8Array(v)); }
  async delete(k) { this.m.delete(k); }
}

const BODY_SO = [
  'Madaxweynaha Jamhuuriyadda Federaalka Soomaaliya, Xasan Sheekh Maxamuud, ayaa maanta Villa Soomaaliya ku qaabilay wafdi ka socday QM-da.',
  '## Shirka Muqdisho',
  'Kulanka ayaa looga hadlay amniga gobollada Shabeellaha Hoose iyo Jubbada Dhexe. Faahfaahin: https://example.com/war',
  'Dowladda ayaa sheegtay in 75 dagaalyahan lagu dilay, isla markaana 3,700 qoys ay ku barakaceen.',
].join('\n');

function story(over = {}) {
  return {
    id: '2026-11-24-madaxweyne-wafdi', title: 'Madaxweyne Xasan oo qaabilay wafdi', summary: 'Madaxweynaha ayaa kulan la qaatay wafdi.', body: BODY_SO,
    section: 'somalia', category: 'Siyaasadda', published: true, source: 'Some Outlet', sourceUrl: 'https://outlet.example/x', imageCredit: 'Photo credit text',
    en: { title: 'President Hassan meets a delegation', summary: 'The president held talks with a delegation.', body: 'The president met the delegation.\n## Talks\nSecurity was discussed.' },
    ar: { title: 'الرئيس حسن يستقبل وفدا', summary: 'عقد الرئيس محادثات مع وفد.', body: 'التقى الرئيس بالوفد.' },
    ...over,
  };
}

let ipN = 0;
function setup({ stories = { '2026-11-24-madaxweyne-wafdi': story() }, provider, env: extra = {} } = {}) {
  const calls = { site: 0, tts: [], ttsHeaders: [] };
  const ip = `10.0.${(ipN = (ipN + 1) % 250)}.${Math.floor(Math.random() * 250)}`;
  const env = { TTS: new KV(), AZURE_SPEECH_KEY: KEY, AZURE_SPEECH_REGION: 'westeurope', SITE_URL: 'https://www.wartabiyetv.com/', ALLOWED_ORIGINS: 'https://www.wartabiyetv.com', ...extra };
  const fetchImpl = async (url, init = {}) => {
    url = String(url);
    if (url.startsWith('https://www.wartabiyetv.com/data/story/')) {
      calls.site++;
      const id = decodeURIComponent(url.split('/').pop().replace(/\.json$/, ''));
      const s = stories[id];
      return s ? new Response(JSON.stringify(s), { status: 200 }) : new Response('nf', { status: 404 });
    }
    if (url.includes('tts.speech.microsoft.com') || url.includes('api.elevenlabs.io')) {
      calls.tts.push(String(init.body)); calls.ttsHeaders.push(init.headers);
      if (provider) return provider(init, calls.tts.length);
      await new Promise(r => setTimeout(r, 5));
      return new Response(TONE, { status: 200, headers: { 'Content-Type': 'audio/mpeg' } });
    }
    throw new Error('unexpected fetch ' + url);
  };
  const go = (path, headers = {}) => worker.fetch(new Request('https://wartabiye-tts.example.workers.dev' + path, { headers: { Origin: 'https://www.wartabiyetv.com', 'CF-Connecting-IP': ip, ...headers } }), env, { waitUntil() {} }, fetchImpl);
  return { env, calls, go };
}

test('Somali article: Somali voice, Somali text only, cached for the next listener', async () => {
  const { go, calls, env } = setup();
  const r = await go('/v1/listen?id=2026-11-24-madaxweyne-wafdi&lang=so');
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('Access-Control-Allow-Origin'), 'https://www.wartabiyetv.com');
  const j = await r.json();
  assert.equal(j.ok, true); assert.equal(j.cached, false); assert.equal(j.lang, 'so');
  assert.equal(j.voice.locale, 'so-SO');
  assert.match(j.url, /^https:\/\/wartabiye-tts\.example\.workers\.dev\/v1\/a\/[a-f0-9]{32}\.mp3$/);
  assert.equal(calls.tts.length, 1);
  const s = calls.tts[0];
  assert.match(s, /xml:lang="so-SO"/); assert.match(s, /so-SO-UbaxNeural/);
  assert.match(s, /Xasan Sheekh Maxamuud/); assert.match(s, /Qaramada Midoobay/); assert.match(s, /3700 qoys/);
  assert.doesNotMatch(s.replace(/<[^>]+>/g, ' '), /https?:|example\.com|Some Outlet|outlet\.example|Photo credit|President|الرئيس|##/);
  // second listener: no new generation, same file
  const j2 = await (await go('/v1/listen?id=2026-11-24-madaxweyne-wafdi&lang=so')).json();
  assert.equal(j2.cached, true); assert.equal(j2.url, j.url); assert.equal(calls.tts.length, 1);
  // the key never leaves the Worker
  assert.ok(!JSON.stringify(j).includes(KEY) && !JSON.stringify(j2).includes(KEY));
  const a = await go(new URL(j.url).pathname);
  assert.equal(a.status, 200); assert.equal(a.headers.get('Content-Type'), 'audio/mpeg');
  assert.match(a.headers.get('Cache-Control'), /immutable/);
  assert.deepEqual(new Uint8Array(await a.arrayBuffer()), TONE);
  assert.ok(env.TTS.m.has('u:' + new Date().toISOString().slice(0, 10)));
});

test('each language is read from its own translation and its own voice; no fallback to another language', async () => {
  const { go, calls } = setup();
  const en = await (await go('/v1/listen?id=2026-11-24-madaxweyne-wafdi&lang=en')).json();
  assert.equal(en.ok, true); assert.equal(en.voice.locale, 'en-GB');
  assert.match(calls.tts[0], /President Hassan meets a delegation/); assert.match(calls.tts[0], /Security was discussed/);
  assert.doesNotMatch(calls.tts[0], /Madaxweyne|Xasan/);
  const ar = await (await go('/v1/listen?id=2026-11-24-madaxweyne-wafdi&lang=ar')).json();
  assert.equal(ar.voice.locale, 'ar-SA'); assert.match(calls.tts[1], /الرئيس حسن/);
  assert.notEqual(en.url, ar.url);
  // French: no translation → no audio (never Somali or English instead)
  const fr = await go('/v1/listen?id=2026-11-24-madaxweyne-wafdi&lang=fr');
  assert.equal(fr.status, 404); assert.equal((await fr.json()).code, 'no_text'); assert.equal(calls.tts.length, 2);
});

test('an edited article gets new audio and the old file is removed', async () => {
  const stories = { '2026-11-24-madaxweyne-wafdi': story() };
  const { go, calls, env } = setup({ stories });
  const a = await (await go('/v1/listen?id=2026-11-24-madaxweyne-wafdi&lang=so')).json();
  const oldHash = a.url.match(/([a-f0-9]{32})\.mp3/)[1];
  stories['2026-11-24-madaxweyne-wafdi'] = story({ title: 'Madaxweyne Xasan oo qaabilay wafdi (sixid)' });
  const b = await (await go('/v1/listen?id=2026-11-24-madaxweyne-wafdi&lang=so')).json();
  assert.equal(b.cached, false); assert.notEqual(a.url, b.url); assert.equal(calls.tts.length, 2);
  assert.ok(!env.TTS.m.has('a:' + oldHash) && !env.TTS.m.has('m:' + oldHash));
  assert.equal((await go(new URL(a.url).pathname)).status, 404);
});

test('listeners pressing Play at the same moment share one generation', async () => {
  const { go, calls } = setup();
  const rs = await Promise.all([1, 2, 3, 4].map(() => go('/v1/listen?id=2026-11-24-madaxweyne-wafdi&lang=so')));
  const js = await Promise.all(rs.map(r => r.json()));
  assert.ok(js.every(j => j.ok && j.url === js[0].url));
  assert.equal(calls.tts.length, 1);
});

test('a long article is split into parts at sentence boundaries, all of it is read, and the parts are joined in order', async () => {
  const para = 'Golaha Shacabka ee Baarlamaanka Federaalka ayaa ansixiyay miisaaniyadda sanadka 2027, taas oo lagu qiyaasay 1.5 bilyan oo doollar. ';
  const body = Array.from({ length: 12 }, (_, i) => `Qaybta ${i + 1}: ` + para.repeat(5).trim()).join('\n');
  const { go, calls } = setup({ stories: { 'long-article-1': story({ id: 'long-article-1', body }) } });
  const j = await (await go('/v1/listen?id=long-article-1&lang=so')).json();
  assert.equal(j.ok, true);
  assert.ok(calls.tts.length >= 3, 'several provider requests');
  assert.ok(calls.tts.every(s => s.length < 4000));
  for (let i = 1; i <= 12; i++) assert.ok(calls.tts.some(s => s.includes(`Qaybta ${i}:`)), `part ${i} read`);
  assert.equal(j.bytes, TONE.length * calls.tts.length);
  // nothing lost: every word of the normalised article is in the requests, in order
  const p = articleParts(story({ body }), 'so');
  const want = speechPieces(p, 'so').map(x => x.text).join(' ').split(/\s+/);
  const got = calls.tts.map(s => s.replace(/<[^>]+>/g, ' ').replace(/&apos;/g, "'").replace(/&amp;/g, '&')).join(' ').split(/\s+/).filter(Boolean);
  assert.deepEqual(got, want);
});

test('seeking: byte ranges', async () => {
  const { go } = setup();
  const j = await (await go('/v1/listen?id=2026-11-24-madaxweyne-wafdi&lang=so')).json();
  const path = new URL(j.url).pathname;
  const r = await go(path, { Range: 'bytes=100-199' });
  assert.equal(r.status, 206); assert.equal(r.headers.get('Content-Range'), `bytes 100-199/${TONE.length}`);
  assert.deepEqual(new Uint8Array(await r.arrayBuffer()), TONE.subarray(100, 200));
  const t = await go(path, { Range: 'bytes=-10' });
  assert.equal(t.status, 206); assert.equal((await t.arrayBuffer()).byteLength, 10);
  const o = await go(path, { Range: 'bytes=0-' });
  assert.equal(o.status, 206); assert.equal((await o.arrayBuffer()).byteLength, TONE.length);
  assert.equal((await go(path, { Range: `bytes=${TONE.length + 5}-` })).status, 416);
});

test('provider problems: retry on 429/5xx, clear codes, nothing stored on failure', async () => {
  let n = 0;
  const flaky = setup({ provider: () => (++n === 1 ? new Response('busy', { status: 429, headers: { 'Retry-After': '0' } }) : new Response(TONE)) });
  assert.equal((await (await flaky.go('/v1/listen?id=2026-11-24-madaxweyne-wafdi&lang=so')).json()).ok, true);
  const down = setup({ provider: () => new Response('err', { status: 500 }) });
  const r = await down.go('/v1/listen?id=2026-11-24-madaxweyne-wafdi&lang=so');
  assert.equal(r.status, 502); assert.equal((await r.json()).code, 'provider');
  assert.equal([...down.env.TTS.m.keys()].filter(k => k.startsWith('a:')).length, 0);
  const badKey = setup({ provider: () => new Response('no', { status: 401 }) });
  assert.equal((await (await badKey.go('/v1/listen?id=2026-11-24-madaxweyne-wafdi&lang=so')).json()).code, 'not_configured');
  const noVoice = setup({ provider: () => new Response('voice', { status: 400 }) });
  assert.equal((await (await noVoice.go('/v1/listen?id=2026-11-24-madaxweyne-wafdi&lang=so')).json()).code, 'no_voice');
});

test('validation, limits and switches', async () => {
  const { go } = setup();
  assert.equal((await go('/v1/listen?id=../../etc&lang=so')).status, 400);
  assert.equal((await (await go('/v1/listen?id=2026-11-24-madaxweyne-wafdi&lang=xx')).json()).code, 'no_voice');
  assert.equal((await (await go('/v1/listen?id=no-such-article&lang=so')).json()).code, 'not_found');
  const draft = setup({ stories: { 'draft-story': story({ id: 'draft-story', published: false }) } });
  assert.equal((await (await draft.go('/v1/listen?id=draft-story&lang=so')).json()).code, 'not_found');
  const nokey = setup({ env: { AZURE_SPEECH_KEY: '' } });
  const nk = await nokey.go('/v1/listen?id=2026-11-24-madaxweyne-wafdi&lang=so');
  assert.equal(nk.status, 503); assert.equal((await nk.json()).code, 'not_configured'); assert.equal(nokey.calls.tts.length, 0);
  const off = setup({ env: { TTS_MODE: 'off' } });
  assert.equal((await (await off.go('/v1/listen?id=2026-11-24-madaxweyne-wafdi&lang=so')).json()).code, 'disabled');
  const soOff = setup({ env: { VOICE_SO: 'off' } });
  assert.equal((await (await soOff.go('/v1/listen?id=2026-11-24-madaxweyne-wafdi&lang=so')).json()).code, 'no_voice');
  const budget = setup({ env: { DAILY_CHAR_LIMIT: '50' } });
  const b = await budget.go('/v1/listen?id=2026-11-24-madaxweyne-wafdi&lang=so');
  assert.equal(b.status, 429); assert.equal((await b.json()).code, 'limit'); assert.equal(budget.calls.tts.length, 0);
  const tooLong = setup({ env: { MAX_CHARS: '40' } });
  assert.equal((await (await tooLong.go('/v1/listen?id=2026-11-24-madaxweyne-wafdi&lang=so')).json()).code, 'too_long');
  // other websites get no CORS permission
  const evil = await go('/v1/listen?id=2026-11-24-madaxweyne-wafdi&lang=so', { Origin: 'https://evil.example' });
  assert.equal(evil.headers.get('Access-Control-Allow-Origin'), null);
  const h = await (await go('/health')).json();
  assert.equal(h.ok, true); assert.equal(h.configured, true); assert.equal(h.languages.length, 9);
  assert.ok(!JSON.stringify(h).includes(KEY));
});

test('one visitor cannot start unlimited new generations', async () => {
  const stories = {};
  for (let i = 0; i < 6; i++) stories['story-' + i] = story({ id: 'story-' + i, title: 'Warbixin ' + i });
  const { go } = setup({ stories, env: { IP_LIMIT: '3' } });
  const codes = [];
  for (let i = 0; i < 6; i++) codes.push((await (await go(`/v1/listen?id=story-${i}&lang=so`, { 'CF-Connecting-IP': '9.9.9.9' })).json()).code || 'ok');
  assert.deepEqual(codes, ['ok', 'ok', 'ok', 'busy', 'busy', 'busy']);
});

test('ElevenLabs for Somali (optional): plain text with paragraph breaks, language "so"', async () => {
  const { go, calls } = setup({ env: { TTS_PROVIDER_SO: 'elevenlabs', ELEVENLABS_API_KEY: 'el-key-123', ELEVENLABS_VOICE_SO: 'AbCdEfGhIj1234567890' } });
  const j = await (await go('/v1/listen?id=2026-11-24-madaxweyne-wafdi&lang=so')).json();
  assert.equal(j.ok, true, JSON.stringify(j));
  const body = JSON.parse(calls.tts[0]);
  assert.equal(body.language_code, 'so'); assert.equal(body.model_id, 'eleven_v3');
  assert.match(body.text, /Qaramada Midoobay/); assert.match(body.text, /\n\n/);
  assert.equal(calls.ttsHeaders[0]['xi-api-key'], 'el-key-123');
});

test('text: only the article, as the page shows it', () => {
  const p = articleParts(story(), 'so');
  assert.deepEqual(p.map(x => x.kind), ['title', 'lede', 'p', 'h', 'p', 'p']);
  assert.equal(articleParts(story({ body: '' }), 'so').length, 2);           // title + summary as the body (no lede twice)
  assert.equal(articleParts(story(), 'de'), null);                             // not translated: nothing
  assert.equal(articleParts({ title: '', body: 'x' }, 'so'), null);
});

test('text: Somali normalisation keeps Somali spelling and never reads links or symbols', () => {
  const N = s => normalize(s, 'so');
  assert.equal(N("Ka'a iyo Bal’ad"), "Ka'a iyo Bal'ad");
  assert.equal(N('Qiimuhu wuxuu kordhay 5%.'), 'Qiimuhu wuxuu kordhay boqolkiiba 5.');
  assert.equal(N('Mashruuca $3.7 bilyan ah'), 'Mashruuca 3.7 bilyan oo doollar ah');
  assert.equal(N('Waxaa la bixiyay $500.'), 'Waxaa la bixiyay 500 doollar.');
  assert.equal(N('Shirka 28/10/2026 ayaa furmay'), 'Shirka 28 Oktoobar 2026 ayaa furmay');
  assert.equal(N('Sanadihii 2024-2025'), 'Sanadihii 2024 ilaa 2025');
  assert.equal(N('Kooxda ayaa 2-1 ku garaacday'), 'Kooxda ayaa 2 iyo 1 ku garaacday');
  assert.equal(N('Ciidamada AUSSOM iyo FBI'), 'Ciidamada AUSSOM iyo F B I');
  assert.equal(N('Ka eeg https://www.wartabiyetv.com/war/x.html ama www.x.com'), 'Ka eeg ama');
  assert.equal(N('<p>Xog <b>muhiim</b> ah</p> &amp; war'), 'Xog muhiim ah iyo war');
  assert.equal(N('**Muqdisho** — magaalada caasimadda'), 'Muqdisho, magaalada caasimadda');
  assert.equal(N('🔴 DEGDEG'), 'DEGDEG'.charAt(0) + 'egdeg');
  assert.equal(N('Wafdiga QM-da iyo QM'), 'Wafdiga Qaramada Midoobay iyo Qaramada Midoobay');
  assert.equal(N('Shirka COP31'), 'Shirka COP 31');
  // English rules are never used on Somali: no "percent", "dollars", "and"
  assert.doesNotMatch(N('5% & $10'), /percent|dollar[^a-z]|\band\b/);
  assert.equal(normalize('Growth of 5% & more https://x.y', 'en'), 'Growth of 5% and more');
});

test('SSML: escaped text, the article locale, pauses between paragraphs', () => {
  const v = voiceFor('so', {});
  const g = groupPieces(speechPieces([{ kind: 'title', text: 'A <b> & "c"' }, { kind: 'p', text: "Ka'a" }], 'so'));
  const s = ssml(g[0], v, { first: true, last: true });
  assert.match(s, /^<speak [^>]*xml:lang="so-SO"/);
  assert.match(s, /<break time="900ms"\/>/);
  assert.ok(!/<b>/.test(s.replace(/<break[^>]*>|<\/?(speak|voice|prosody|p)[^>]*>|<mstts:[^>]*>/g, '')));
  assert.match(s, /Ka&apos;a/);
});

test('voices: one per language, configurable, Somali-trained voice for Somali', () => {
  assert.equal(voiceFor('so', {}).voice, 'so-SO-UbaxNeural');
  assert.equal(voiceFor('so', { VOICE_SO: 'so-SO-MuuseNeural' }).voice, 'so-SO-MuuseNeural');
  assert.equal(voiceFor('so', { VOICE_SO: 'bad voice<' }).voice, 'so-SO-UbaxNeural');
  assert.equal(voiceFor('so', { RATE_SO: '-3%' }).rate, '-3%');
  for (const l of ['so', 'en', 'ar', 'fr', 'de', 'it', 'es', 'nl', 'tr']) assert.ok(voiceFor(l, {}).voice.startsWith(voiceFor(l, {}).locale));
});

test('the hash depends on text, voice and settings only', async () => {
  const a = await plan(story(), 'so', {}), b = await plan(story(), 'so', {});
  assert.equal(a.hash, b.hash);
  assert.notEqual(a.hash, (await plan(story(), 'so', { VOICE_SO: 'so-SO-MuuseNeural' })).hash);
  assert.notEqual(a.hash, (await plan(story(), 'so', { RATE_SO: '-2%' })).hash);
  assert.equal(a.hash, (await plan(story({ imageCredit: 'changed' }), 'so', {})).hash);  // not read → same audio
});
