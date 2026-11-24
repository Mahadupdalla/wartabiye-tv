// The narrator of each website language (Azure AI Speech neural voices). One fixed voice per language, so listeners always
// hear the same Wartabiye TV narrator. Somali uses Microsoft's Somali-trained voices (so-SO), not a multilingual voice that
// "also speaks" Somali. A voice can be changed without a code change with the Worker variable VOICE_<LANG>
// (e.g. VOICE_SO = "so-SO-MuuseNeural"), or switched off for a language with VOICE_<LANG> = "off".
export const LANGS = ['so', 'en', 'ar', 'fr', 'de', 'it', 'es', 'nl', 'tr'];

export const VOICES = {
  so: { locale: 'so-SO', voice: 'so-SO-UbaxNeural', alt: ['so-SO-MuuseNeural'], name: 'Af-Soomaali' },
  en: { locale: 'en-GB', voice: 'en-GB-SoniaNeural', alt: ['en-GB-RyanNeural', 'en-US-AndrewNeural'], name: 'English' },
  ar: { locale: 'ar-SA', voice: 'ar-SA-ZariyahNeural', alt: ['ar-SA-HamedNeural'], name: 'العربية' },
  fr: { locale: 'fr-FR', voice: 'fr-FR-DeniseNeural', alt: ['fr-FR-HenriNeural'], name: 'Français' },
  de: { locale: 'de-DE', voice: 'de-DE-KatjaNeural', alt: ['de-DE-ConradNeural'], name: 'Deutsch' },
  it: { locale: 'it-IT', voice: 'it-IT-ElsaNeural', alt: ['it-IT-DiegoNeural'], name: 'Italiano' },
  es: { locale: 'es-ES', voice: 'es-ES-ElviraNeural', alt: ['es-ES-AlvaroNeural'], name: 'Español' },
  nl: { locale: 'nl-NL', voice: 'nl-NL-FennaNeural', alt: ['nl-NL-MaartenNeural'], name: 'Nederlands' },
  tr: { locale: 'tr-TR', voice: 'tr-TR-EmelNeural', alt: ['tr-TR-AhmetNeural'], name: 'Türkçe' },
};

// Speaking rate per language (SSML prosody rate). Somali news is read a little slower than the voice's default, so long
// names and double vowels stay clear; override with RATE_<LANG> (e.g. RATE_SO = "-4%").
export const RATES = { so: '-6%' };

const VOICE_RX = /^[a-z]{2,3}-[A-Z]{2}-[A-Za-z0-9]+Neural$/;
const RATE_RX = /^[+-]?\d{1,2}%$/;

/** The voice settings for `lang`, after the Worker's variables; null when the language has no voice (switched off). */
export function voiceFor(lang, env = {}) {
  const base = VOICES[lang];
  if (!base) return null;
  const k = lang.toUpperCase();
  const v = String(env['VOICE_' + k] || '').trim();
  if (v === 'off') return null;
  const provider = lang === 'so' && String(env.TTS_PROVIDER_SO || '').trim() === 'elevenlabs' ? 'elevenlabs' : 'azure';
  const r = String(env['RATE_' + k] || '').trim();
  const rate = RATE_RX.test(r) ? r : (RATES[lang] || '0%');
  if (provider === 'elevenlabs') {
    const id = String(env.ELEVENLABS_VOICE_SO || '').trim();
    if (!/^[A-Za-z0-9]{10,40}$/.test(id)) return null;
    return { lang, provider, locale: base.locale, voice: id, rate: '0%', name: base.name };
  }
  return { lang, provider, locale: base.locale, voice: VOICE_RX.test(v) ? v : base.voice, rate, name: base.name };
}
