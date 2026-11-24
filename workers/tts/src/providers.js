// Speech providers. Keys come only from the Worker's secrets (env), never from the browser, and are never logged or
// returned. Every call has a timeout and a few retries for rate limits and temporary provider errors.
import { ssml, plainText } from './text.js';

export class TtsError extends Error {
  constructor(code, message, status = 0) { super(message); this.code = code; this.status = status; }
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

/** fetch with a timeout and retries (429 / 5xx / network), honouring Retry-After (at most 8 s). */
async function call(fetchImpl, url, init, { tries = 3, timeoutMs = 45000, label = 'provider' } = {}) {
  let last;
  for (let i = 0; i < tries; i++) {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), timeoutMs);
    try {
      const r = await fetchImpl(url, { ...init, signal: ac.signal });
      if (r.ok) {
        const buf = new Uint8Array(await r.arrayBuffer());
        if (!buf.length) throw new TtsError('provider', `${label}: empty audio`);
        return buf;
      }
      const detail = (await r.text().catch(() => '')).slice(0, 200).replace(/\s+/g, ' ');
      if (r.status === 401 || r.status === 403) throw new TtsError('not_configured', `${label}: key refused (${r.status})`, r.status);
      if (r.status === 400 || r.status === 404 || r.status === 422) throw new TtsError('no_voice', `${label}: request refused (${r.status}) ${detail}`, r.status);
      last = new TtsError(r.status === 429 ? 'busy' : 'provider', `${label}: HTTP ${r.status} ${detail}`, r.status);
      const ra = parseFloat(r.headers.get('retry-after') || '');
      if (i < tries - 1) await sleep(Math.min(8000, Number.isFinite(ra) ? ra * 1000 : 800 * 2 ** i));
    } catch (e) {
      if (e instanceof TtsError && e.code !== 'provider' && e.code !== 'busy') throw e;
      last = e instanceof TtsError ? e : new TtsError('provider', `${label}: ${e.name === 'AbortError' ? 'timeout' : 'network error'}`);
      if (i < tries - 1) await sleep(800 * 2 ** i);
    } finally {
      clearTimeout(t);
    }
  }
  throw last;
}

// Azure AI Speech, REST text-to-speech. 24 kHz mono MP3 at a constant 48 kbit/s: clear speech, about 360 KB a minute
// (light on mobile data), and parts join without gaps because every frame has the same size.
export const AZURE_FORMAT = { header: 'audio-24khz-48kbitrate-mono-mp3', kbps: 48 };

export function azureConfigured(env) {
  return !!(String(env.AZURE_SPEECH_KEY || '').trim() && (String(env.AZURE_SPEECH_REGION || '').trim() || String(env.AZURE_SPEECH_ENDPOINT || '').trim()));
}

function azureUrl(env) {
  const ep = String(env.AZURE_SPEECH_ENDPOINT || '').trim();
  if (/^https:\/\/[a-z0-9.-]+\/?$/i.test(ep)) return ep.replace(/\/$/, '') + '/cognitiveservices/v1';
  const region = String(env.AZURE_SPEECH_REGION || '').trim().toLowerCase();
  if (!/^[a-z0-9]{3,30}$/.test(region)) throw new TtsError('not_configured', 'AZURE_SPEECH_REGION is not a region name');
  return `https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`;
}

export async function azureSpeak(env, v, group, pos, fetchImpl = fetch) {
  if (!azureConfigured(env)) throw new TtsError('not_configured', 'Azure Speech key or region missing');
  return call(fetchImpl, azureUrl(env), {
    method: 'POST',
    headers: {
      'Ocp-Apim-Subscription-Key': String(env.AZURE_SPEECH_KEY).trim(),
      'Content-Type': 'application/ssml+xml',
      'X-Microsoft-OutputFormat': AZURE_FORMAT.header,
      'User-Agent': 'wartabiye-tts',
    },
    body: ssml(group, v, pos),
  }, { label: 'azure' });
}

// ElevenLabs (optional, Somali only, when TTS_PROVIDER_SO = "elevenlabs"): Eleven v3 lists Somali. 44.1 kHz MP3 at a
// constant 64 kbit/s.
export const ELEVEN_FORMAT = { query: 'mp3_44100_64', kbps: 64 };

export function elevenConfigured(env) {
  return !!String(env.ELEVENLABS_API_KEY || '').trim();
}

export async function elevenSpeak(env, v, group, pos, fetchImpl = fetch) {
  if (!elevenConfigured(env)) throw new TtsError('not_configured', 'ElevenLabs key missing');
  const model = /^[a-z0-9_]{3,40}$/.test(String(env.ELEVENLABS_MODEL || '')) ? env.ELEVENLABS_MODEL : 'eleven_v3';
  return call(fetchImpl, `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(v.voice)}?output_format=${ELEVEN_FORMAT.query}`, {
    method: 'POST',
    headers: { 'xi-api-key': String(env.ELEVENLABS_API_KEY).trim(), 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
    body: JSON.stringify({ text: plainText(group), model_id: model, language_code: 'so' }),
  }, { label: 'elevenlabs' });
}

export function providerOf(v) {
  return v.provider === 'elevenlabs'
    ? { speak: elevenSpeak, configured: elevenConfigured, kbps: ELEVEN_FORMAT.kbps, format: ELEVEN_FORMAT.query, max: 2400 }
    : { speak: azureSpeak, configured: azureConfigured, kbps: AZURE_FORMAT.kbps, format: AZURE_FORMAT.header, max: 2400 };
}

/** Removes an ID3v2 tag at the start of an MP3 part, so joined parts are one clean stream. */
export function stripId3(buf) {
  if (buf.length > 10 && buf[0] === 0x49 && buf[1] === 0x44 && buf[2] === 0x33) {
    const size = ((buf[6] & 0x7f) << 21) | ((buf[7] & 0x7f) << 14) | ((buf[8] & 0x7f) << 7) | (buf[9] & 0x7f);
    return buf.subarray(10 + size + (buf[5] & 0x10 ? 10 : 0));
  }
  return buf;
}
