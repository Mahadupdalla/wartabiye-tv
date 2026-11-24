// Somali voice test: makes the test sentences and whole Somali articles with every candidate voice and setting, then checks
// how understandable each one is by writing down what a Somali speech recogniser hears (round trip) and comparing it with
// the text (WER = word error rate, CER = character error rate; lower is better). The MP3 files are for listening: numbers
// can only say how intelligible a voice is, a Somali listener decides how natural it sounds.
//
//   AZURE_SPEECH_KEY=… AZURE_SPEECH_REGION=… node scripts/voice-test.mjs [out dir]
//   optional: ELEVENLABS_API_KEY=… ELEVENLABS_VOICE_SO=<voice id>  (adds ElevenLabs Eleven v3 to the comparison)
// Run from the repository with .github/workflows/tts-voice-test.yml (Actions → "Codka Soomaaliga: tijaabo" → Run).
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { articleParts, speechPieces, groupPieces, normalize, xmlEscape } from '../src/text.js';
import { azureSpeak, elevenSpeak, stripId3 } from '../src/providers.js';

const out = process.argv[2] || 'voice-test';
const env = process.env;
if (!env.AZURE_SPEECH_KEY || !env.AZURE_SPEECH_REGION) { console.error('AZURE_SPEECH_KEY and AZURE_SPEECH_REGION are needed'); process.exit(2); }
const data = JSON.parse(readFileSync(new URL('../test/somali-voice-test.json', import.meta.url), 'utf8'));
const root = new URL('../../../', import.meta.url);
const region = env.AZURE_SPEECH_REGION.trim().toLowerCase();

const CANDIDATES = [
  { id: 'ubax', provider: 'azure', voice: 'so-SO-UbaxNeural', rate: '0%' },
  { id: 'ubax-slower', provider: 'azure', voice: 'so-SO-UbaxNeural', rate: '-6%' },
  { id: 'muuse', provider: 'azure', voice: 'so-SO-MuuseNeural', rate: '0%' },
  { id: 'muuse-slower', provider: 'azure', voice: 'so-SO-MuuseNeural', rate: '-6%' },
];
if (env.ELEVENLABS_API_KEY && env.ELEVENLABS_VOICE_SO) CANDIDATES.push({ id: 'elevenlabs-v3', provider: 'elevenlabs', voice: env.ELEVENLABS_VOICE_SO.trim(), rate: '0%' });

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function speakMp3(c, groups) {
  const v = { lang: 'so', locale: 'so-SO', voice: c.voice, rate: c.rate, provider: c.provider };
  const parts = [];
  for (let i = 0; i < groups.length; i++) {
    const pos = { first: i === 0, last: i === groups.length - 1 };
    parts.push(stripId3(c.provider === 'azure' ? await azureSpeak(env, v, groups[i], pos) : await elevenSpeak(env, v, groups[i], pos)));
  }
  const n = parts.reduce((a, b) => a + b.length, 0), buf = new Uint8Array(n);
  let o = 0; for (const p of parts) { buf.set(p, o); o += p.length; }
  return buf;
}

// 16 kHz WAV of the same speech for the recogniser (Azure voices); ElevenLabs MP3 is converted with ffmpeg when present
async function speakWav(c, text) {
  const s = `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="so-SO"><voice name="${xmlEscape(c.voice)}"><prosody rate="${c.rate}">${xmlEscape(text)}</prosody></voice></speak>`;
  const r = await fetch(`https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`, { method: 'POST', headers: { 'Ocp-Apim-Subscription-Key': env.AZURE_SPEECH_KEY.trim(), 'Content-Type': 'application/ssml+xml', 'X-Microsoft-OutputFormat': 'riff-16khz-16bit-mono-pcm', 'User-Agent': 'wartabiye-tts-test' }, body: s });
  if (!r.ok) throw new Error('tts ' + r.status);
  return new Uint8Array(await r.arrayBuffer());
}

async function recognise(wav) {
  const r = await fetch(`https://${region}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1?language=so-SO&format=detailed&profanity=raw`, { method: 'POST', headers: { 'Ocp-Apim-Subscription-Key': env.AZURE_SPEECH_KEY.trim(), 'Content-Type': 'audio/wav; codecs=audio/pcm; samplerate=16000', Accept: 'application/json' }, body: wav });
  if (!r.ok) return { error: 'stt HTTP ' + r.status };
  const j = await r.json();
  if (j.RecognitionStatus !== 'Success') return { error: 'stt ' + j.RecognitionStatus };
  return { text: (j.NBest && j.NBest[0] && j.NBest[0].Lexical) || j.DisplayText || '' };
}

const words = s => s.toLowerCase().replace(/[’']/g, "'").replace(/[^\p{L}\p{N}' ]+/gu, ' ').split(/\s+/).filter(Boolean);
function edit(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}
const wer = (ref, hyp) => edit(words(ref), words(hyp)) / Math.max(1, words(ref).length);
const cer = (ref, hyp) => { const a = [...words(ref).join(' ')], b = [...words(hyp).join(' ')]; return edit(a, b) / Math.max(1, a.length); };
const pct = x => (x * 100).toFixed(1) + '%';

mkdirSync(out, { recursive: true });
const rows = [], summary = {};
for (const c of CANDIDATES) {
  const dir = join(out, c.id); mkdirSync(dir, { recursive: true });
  summary[c.id] = { w: [], c: [], errors: 0 };
  for (const [i, s] of data.sentences.entries()) {
    const spoken = normalize(s.text, 'so');
    try {
      const mp3 = await speakMp3(c, groupPieces(speechPieces([{ kind: 'p', text: s.text }], 'so')));
      writeFileSync(join(dir, `${String(i + 1).padStart(2, '0')}-${s.kind.replace(/[^\p{L}\p{N}]+/gu, '-')}.mp3`), mp3);
      let hyp = null;
      if (c.provider === 'azure') {
        const rec = await recognise(await speakWav(c, spoken));
        hyp = rec.text ?? null;
        if (rec.error) rows.push({ c: c.id, kind: s.kind, note: rec.error });
      }
      if (hyp != null) {
        const w = wer(spoken, hyp), ch = cer(spoken, hyp);
        summary[c.id].w.push(w); summary[c.id].c.push(ch);
        rows.push({ c: c.id, kind: s.kind, wer: w, cer: ch, ref: spoken, hyp });
      }
    } catch (e) { summary[c.id].errors++; rows.push({ c: c.id, kind: s.kind, note: String(e.message || e) }); }
    await sleep(300);
  }
  for (const id of data.articles) {
    try {
      const story = JSON.parse(readFileSync(new URL(`data/story/${id}.json`, root), 'utf8'));
      const pieces = speechPieces(articleParts(story, 'so'), 'so', { sports: story.section === 'sports' });
      const mp3 = await speakMp3(c, groupPieces(pieces));
      writeFileSync(join(dir, `article-${id}.mp3`), mp3);
      rows.push({ c: c.id, kind: 'Maqaal dhan: ' + id, note: `${pieces.reduce((n, p) => n + p.text.length, 0)} xaraf, ${(mp3.length * 8 / (c.provider === 'azure' ? 48000 : 64000) / 60).toFixed(1)} daqiiqo` });
    } catch (e) { summary[c.id].errors++; rows.push({ c: c.id, kind: 'Maqaal: ' + id, note: String(e.message || e) }); }
  }
}

const avg = a => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN);
const ranked = Object.entries(summary).filter(([, s]) => s.w.length).sort((a, b) => avg(a[1].w) - avg(b[1].w));
let md = `# Tijaabada codka Soomaaliga (Somali voice test)\n\n${new Date().toISOString()} · region ${region}\n\n`;
md += `Round trip: each voice reads the sentence, Azure Speech-to-Text (so-SO) writes down what it hears, and that is compared with the text. Lower WER/CER = easier to understand. Listen to the MP3 files to judge how natural each voice sounds.\n\n`;
md += `| Voice / setting | Average WER | Average CER | Sentences | Errors |\n|---|---|---|---|---|\n`;
for (const [id, s] of Object.entries(summary)) md += `| ${id} | ${s.w.length ? pct(avg(s.w)) : 'n/a'} | ${s.c.length ? pct(avg(s.c)) : 'n/a'} | ${s.w.length} | ${s.errors} |\n`;
if (ranked.length) md += `\n**Most intelligible by the numbers: ${ranked[0][0]}.** Set it with the Worker variables VOICE_SO / RATE_SO if it is not already the default (so-SO-UbaxNeural at -6%).\n`;
md += `\n## Per sentence\n\n| Voice | Kind | WER | CER | Heard |\n|---|---|---|---|---|\n`;
for (const r of rows) md += `| ${r.c} | ${r.kind} | ${r.wer != null ? pct(r.wer) : ''} | ${r.cer != null ? pct(r.cer) : ''} | ${(r.hyp || r.note || '').replace(/\|/g, '/')} |\n`;
writeFileSync(join(out, 'REPORT.md'), md);
writeFileSync(join(out, 'report.json'), JSON.stringify({ summary: Object.fromEntries(Object.entries(summary).map(([k, s]) => [k, { wer: avg(s.w), cer: avg(s.c), n: s.w.length, errors: s.errors }])), rows }, null, 1));
console.log(md);
