// What is read aloud, and how it is prepared for the narrator.
//
// 1. articleParts(): exactly the text the article page shows (same rules as assets/app.js renderStory): the title, the
//    introduction (when the article also has a body), and every paragraph and "## " subheading of the body, in the
//    language on screen. Nothing else: no menus, buttons, byline, photo captions, footer, ads or admin fields.
// 2. normalize(): turns written text into readable speech WITHOUT changing the news: HTML, Markdown, links, e-mail
//    addresses, emoji and stray symbols are removed; symbols that carry meaning (%, $, €, &, number ranges, numeric dates)
//    are written out in the article's own language. Somali has its own rules (Somali words, Somali month names, the
//    Somali apostrophe kept as a letter, acronyms spelled out letter by letter) and never goes through English rules.
//    Nothing is translated, summarised or reworded.
// 3. chunks(): splits the speech into provider-sized parts at paragraph, then sentence, then clause boundaries, never
//    inside a word, and with every character kept (tests check that nothing is lost), plus the pause after each part.

const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—', hellip: '…', laquo: '«', raquo: '»', rsquo: '’', lsquo: '‘', ldquo: '“', rdquo: '”' };

export function decodeEntities(s) {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
    if (e[0] === '#') {
      const n = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : ' ';
    }
    return ENT[e.toLowerCase()] ?? m;
  });
}

/** The real translation in `lang` (same test as assets/app.js trOf), or null. */
export function translation(story, lang) {
  if (lang === 'so') return null;
  const x = story && story[lang];
  return x && typeof x === 'object' && typeof x.title === 'string' && x.title.trim() ? x : null;
}

/**
 * The article as the page shows it, in `lang`: [{kind: 'title'|'lede'|'h'|'p', text}], or null when the article has
 * no text in that language (the page then shows "not translated", and nothing may be read in another language).
 */
export function articleParts(story, lang) {
  if (!story || typeof story !== 'object') return null;
  const tx = translation(story, lang);
  if (lang !== 'so' && !tx) return null;
  const src = tx || story;
  const F = f => (typeof src[f] === 'string' ? src[f] : '');
  const title = F('title').trim();
  if (!title) return null;
  const body = F('body').trim(), sum = F('summary').trim();
  const out = [{ kind: 'title', text: title }];
  if (body && sum) out.push({ kind: 'lede', text: sum });
  const main = body || sum;
  if (main) {
    for (let p of main.split(/\n+/)) {
      p = p.trim();
      if (!p) continue;
      if (/^##\s+/.test(p)) out.push({ kind: 'h', text: p.replace(/^##\s+/, '') });
      else out.push({ kind: 'p', text: p });
    }
  }
  return out;
}

// ---------- normalisation ----------

const AND = { so: 'iyo', en: 'and', ar: 'و', fr: 'et', de: 'und', it: 'e', es: 'y', nl: 'en', tr: 've' };

const SO_MONTHS = ['Janaayo', 'Febraayo', 'Maarso', 'Abriil', 'Maajo', 'Juun', 'Luulyo', 'Ogost', 'Sebtembar', 'Oktoobar', 'Nofembar', 'Desembar'];

// Acronyms a Somali listener hears as one word (as Somali radio says them). Every other all-capital acronym is spelled
// out letter by letter, so "FBI" is never read as an invented word.
const SO_WORD_ACRONYMS = new Set(['FIFA', 'UEFA', 'NATO', 'AUSSOM', 'AMISOM', 'ATMIS', 'IGAD', 'AFCON', 'UNICEF', 'UNESCO', 'UNSOS', 'UNMISS', 'UNIFIL', 'AFRICOM', 'OCHA', 'PAHO', 'NASA', 'OPEC', 'APEC', 'NISA', 'UNHCR', 'COMESA', 'ASEAN', 'BRICS', 'COP', 'CECAFA', 'SONNA', 'UNTMIS', 'UNSOM']);
const ROMAN = { I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6, VII: 7, VIII: 8, IX: 9, X: 10, XI: 11, XII: 12, XIII: 13, XIV: 14, XV: 15, XVI: 16 };

// Well-known Somali abbreviations, said in full by Somali newsreaders. The suffix written after the abbreviation
// ("QM-da") is already part of the full form.
const SO_EXPAND = { QM: 'Qaramada Midoobay', 'G/G': 'Gobolka', 'D/hoose': 'Degmada hoose' };

const SPORTS_SCORE = /\b(kulan|ciyaar|guul|garaacay|goolal|gool|natiijo|barbar|bareejo|ka badiyay|ku badiyay|adkaaday|kooxda|horyaal)/i;

/** One paragraph as readable speech in `lang` (see the file header). */
export function normalize(text, lang, ctx = {}) {
  let s = String(text || '');
  s = decodeEntities(s);
  s = s.replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ').replace(/<br\s*\/?>/gi, '. ').replace(/<[^>]+>/g, ' ');
  // Markdown: [text](link) keeps the text, emphasis marks and leftover heading/list marks go
  s = s.replace(/!\[[^\]]*\]\([^)]*\)/g, ' ').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1');
  s = s.replace(/(\*\*|__|`+)/g, '').replace(/(^|\s)[*_](\S[^*_]*\S|\S)[*_](?=\s|[.,;:!?]|$)/g, '$1$2');
  s = s.replace(/^\s*(#{1,6}|[-*+>]|\d+[.)])\s+/, '');
  // never read links, e-mail addresses, @handles' "@", hashtags' "#", emoji
  s = s.replace(/\b(?:https?:\/\/|www\.)\S+/gi, ' ').replace(/\b[\w.+-]+@[\w-]+\.[\w.-]+\b/g, ' ');
  s = s.replace(/(^|\s)[@#](?=\w)/g, '$1');
  s = s.replace(/[\p{Extended_Pictographic}\u{1F1E6}-\u{1F1FF}️‍]/gu, '');
  // separators that are pauses, not words
  s = s.replace(/\s*[•·|▪►▶◆■]\s*/g, ', ').replace(/\s+[–—]\s+/g, ', ').replace(/\s*—\s*/g, ', ');
  s = s.replace(/[“”„«»]/g, '"').replace(/[‘‚]/g, "'");
  // a paragraph written in capitals is read as normal words, not letter by letter
  const letters = s.replace(/[^\p{L}]/gu, '');
  if (letters.length >= 12 && letters.replace(/[^\p{Lu}]/gu, '').length / letters.length > 0.8) {
    s = s.toLocaleLowerCase(lang);
    s = s.charAt(0).toLocaleUpperCase(lang) + s.slice(1);
  }
  s = lang === 'so' ? somali(s, ctx) : other(s, lang);
  s = s.replace(/\s*&\s*/g, ` ${AND[lang] || 'and'} `);
  s = s.replace(/[*_#~^=<>{}\[\]\\]/g, ' ');
  s = s.replace(/\(\s*\)/g, ' ').replace(/\s+([,.;:!?؟،])/g, '$1').replace(/([,;:])(?=[^\s\d])/g, '$1 ');
  s = s.replace(/(,\s*){2,}/g, ', ').replace(/^[\s,;:]+/, '').replace(/\s{2,}/g, ' ').trim();
  return s;
}

function somali(s, ctx) {
  // the Somali apostrophe is a letter (hamza: "ka'a", "Bal'ad"): one form, never removed
  s = s.replace(/’/g, "'");
  for (const [k, v] of Object.entries(SO_EXPAND)) {
    const rx = new RegExp('(^|[^\\w/])' + k.replace(/[/]/g, '\\/') + '(?:-(?:da|dii|du|ta|tii|tu|ka|kii))?(?![\\w/])', 'g');
    s = s.replace(rx, (m, pre) => pre + v);
  }
  // numeric dates 28/10/2026 or 28.10.2026 → "28 Oktoobar 2026"
  s = s.replace(/\b(\d{1,2})[/.](\d{1,2})[/.](\d{4})\b/g, (m, d, mo, y) => {
    const n = +mo;
    return n >= 1 && n <= 12 && +d >= 1 && +d <= 31 ? `${+d} ${SO_MONTHS[n - 1]} ${y}` : m;
  });
  s = s.replace(/(\d),(?=\d{3}\b)/g, '$1');            // 3,700 → 3700 (the comma is not a pause)
  s = s.replace(/(\d),(?=\d{3}\b)/g, '$1');            // 1,250,000 (second group)
  s = s.replace(/(\d+(?:\.\d+)?)\s?%/g, 'boqolkiiba $1');
  const MAG = '(?:\\s?(milyan|malaayiin|bilyan|tirilyan|kun|million|billion|trillion|bn|m)\\b)?';
  const mag = m => ({ million: 'milyan', m: 'milyan', billion: 'bilyan', bn: 'bilyan', trillion: 'tirilyan' }[(m || '').toLowerCase()] || m);
  const money = word => (m, n, g) => (g ? `${n} ${mag(g)} oo ${word}` : `${n} ${word}`);
  s = s.replace(new RegExp('(?:US)?\\$\\s?(\\d[\\d.]*\\d|\\d)' + MAG, 'g'), money('doollar'));
  s = s.replace(new RegExp('€\\s?(\\d[\\d.]*\\d|\\d)' + MAG, 'g'), money('yuuro'));
  s = s.replace(new RegExp('£\\s?(\\d[\\d.]*\\d|\\d)' + MAG, 'g'), money('ginni'));
  s = s.replace(new RegExp('\\bK?Sh\\.?\\s?(\\d[\\d.]*\\d|\\d)' + MAG, 'g'), money('shilin'));
  s = s.replace(/\$/g, ' doollar ').replace(/€/g, ' yuuro ').replace(/£/g, ' ginni ');
  // "2-1" in a match report is a score ("2 iyo 1"); elsewhere "2024-2025" or "3-5 sano" is a range ("ilaa")
  const word = ctx.sports || SPORTS_SCORE.test(s) ? ' iyo ' : ' ilaa ';
  s = s.replace(/\b(\d+)\s?[-–]\s?(\d+)\b(?!-)/g, (m, a, b) => a + word + b);
  s = s.replace(/(\S)\/(\S)/g, '$1 $2');
  s = s.replace(/\+(?=\s|$)/g, ' ');
  // a ruler's number: "Leo XIV" → "Leo 14-aad" (Somali ordinal)
  s = s.replace(/\b([A-Z][a-z]+) (I{1,3}|IV|VI{0,3}|IX|XI{0,3}|XIV|XVI?|V)\b/g, (m, n, r) => `${n} ${ROMAN[r]}-aad`);
  // acronyms: a few are words, the others are spelled ("FBI" → "F B I"); a heading word in capitals is read as a word
  s = s.replace(/\b([A-Z]{2,8})(\d*)\b/g, (m, a, d) => {
    if (SO_WORD_ACRONYMS.has(a)) return a + (d ? ' ' + d : '');
    if (a.length >= 6 && /[AEIOU]/.test(a)) return a[0] + a.slice(1).toLowerCase() + (d ? ' ' + d : '');
    return a.split('').join(' ') + (d ? ' ' + d : '');
  });
  return s;
}

function other(s, lang) {
  s = s.replace(/(\S)\/(\S)/g, (m, a, b) => (/\d/.test(a) && /\d/.test(b) ? m : a + ' ' + b));
  if (lang !== 'ar') s = s.replace(/’/g, "'");
  return s;
}

// ---------- splitting into provider-sized parts ----------

export const PAUSE = { title: 900, lede: 750, h: 600, p: 650, beforeH: 350 };

function splitLong(text, max) {
  if (text.length <= max) return [text];
  const out = [];
  const sentences = text.match(/[^.!?؟…]+(?:[.!?؟…]+["')\]]*|$)\s*/g) || [text];
  let cur = '';
  const push = () => { if (cur.trim()) out.push(cur.trim()); cur = ''; };
  for (const sen of sentences) {
    if ((cur + sen).length <= max) { cur += sen; continue; }
    push();
    if (sen.length <= max) { cur = sen; continue; }
    // one very long sentence: break at commas, then between words
    for (const cl of sen.match(/[^,،;]+(?:[,،;]\s*|$)/g) || [sen]) {
      if ((cur + cl).length <= max) { cur += cl; continue; }
      push();
      if (cl.length <= max) { cur = cl; continue; }
      for (const w of cl.split(/(?<=\s)/)) {
        if ((cur + w).length > max) push();
        cur += w;
      }
    }
  }
  push();
  return out;
}

/**
 * The speech in order: [{text, pause}] (pause = silence after it, in ms), each text at most `max` characters,
 * then grouped into provider requests of at most `max` characters: [[{text, pause}, …], …].
 */
export function speechPieces(parts, lang, ctx = {}, max = 2400) {
  const pieces = [];
  parts.forEach((p, i) => {
    let t = normalize(p.text, lang, ctx);
    if (!t) return;
    // a title or subheading is a sentence of its own (a falling end, then a pause)
    if ((p.kind === 'title' || p.kind === 'h') && !/[.!?؟…:]$/.test(t)) t += lang === 'ar' ? '.' : '.';
    const next = parts[i + 1];
    const pause = next && next.kind === 'h' ? Math.max(PAUSE[p.kind] || 650, PAUSE.beforeH + 400) : (PAUSE[p.kind] || 650);
    const bits = splitLong(t, max);
    bits.forEach((b, j) => pieces.push({ text: b, pause: j === bits.length - 1 ? pause : 250 }));
  });
  return pieces;
}

export function groupPieces(pieces, max = 2400) {
  const groups = [];
  let cur = [], n = 0;
  for (const p of pieces) {
    if (cur.length && n + p.text.length > max) { groups.push(cur); cur = []; n = 0; }
    cur.push(p); n += p.text.length;
  }
  if (cur.length) groups.push(cur);
  return groups;
}

export function xmlEscape(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

/** Azure SSML for one request: the article's voice and locale, fixed pauses between paragraphs, exact silence at the joins. */
export function ssml(group, v, { first, last }) {
  const body = group.map((p, i) => {
    const pause = i === group.length - 1 ? '' : `<break time="${p.pause}ms"/>`;
    return `<p>${xmlEscape(p.text)}</p>${pause}`;
  }).join('');
  const tail = last ? 400 : group[group.length - 1].pause;
  return `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="https://www.w3.org/2001/mstts" xml:lang="${v.locale}">` +
    `<voice name="${xmlEscape(v.voice)}"><mstts:silence type="Leading-exact" value="${first ? 150 : 0}ms"/>` +
    `<mstts:silence type="Tailing-exact" value="${tail}ms"/><prosody rate="${v.rate}">${body}</prosody></voice></speak>`;
}

/** Plain text for providers without SSML (ElevenLabs): paragraphs separated by blank lines, which they read as pauses. */
export function plainText(group) {
  return group.map(p => p.text).join('\n\n');
}
