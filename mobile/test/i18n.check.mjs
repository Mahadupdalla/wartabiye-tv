// Interface text check: every text key the app's code uses exists in all nine languages (in the website's own wording,
// src/i18n/site.json, or the app's, src/i18n/app.ts), so no screen falls back to English or Somali in another
// language; and every language of app.ts has the same keys.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const app = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LANGS = ['so', 'en', 'ar', 'fr', 'nl', 'it', 'tr', 'de', 'es'];
const site = JSON.parse(fs.readFileSync(path.join(app, 'src/i18n/site.json'), 'utf8'));
const src = fs.readFileSync(path.join(app, 'src/i18n/app.ts'), 'utf8');
const APP = new Function('return ' + src.slice(src.indexOf('{', src.indexOf('APP_STRINGS'))).replace(/;\s*$/, ''))();

const files = [];
const walk = d => { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); if (fs.statSync(p).isDirectory()) walk(p); else if (/\.tsx?$/.test(f)) files.push(p); } };
walk(path.join(app, 'src'));
const used = new Set();
for (const f of files) {
  const s = fs.readFileSync(f, 'utf8');
  for (const m of s.matchAll(/\bt\((?:lang,\s*)?'([A-Za-z0-9_]+)'/g)) used.add(m[1]);
  for (const m of s.matchAll(/'(sport[A-Z][A-Za-z0-9]+|adWhy\dt?)'/g)) used.add(m[1]);
}
for (const k of ['light', 'dark', 'system']) used.add(k);

const missing = [];
for (const k of used) for (const l of LANGS) if (!(site[l]?.[k] || APP[l]?.[k])) missing.push(`${l}:${k}`);
assert.deepEqual(missing, [], 'interface text missing (would fall back to another language): ' + missing.join(', '));
const soKeys = Object.keys(APP.so).sort();
for (const l of LANGS) {
  const extra = Object.keys(APP[l]).filter(k => !APP.so[k]);
  const lack = soKeys.filter(k => !APP[l][k] && !site[l]?.[k]);
  assert.deepEqual([extra, lack], [[], []], l + ': app.ts keys differ from Somali');
}
// no hard-coded English labels for screen readers
const hard = [];
for (const f of files) for (const m of fs.readFileSync(f, 'utf8').matchAll(/accessibilityLabel="([^"]+)"/g)) if (m[1] !== 'Wartabiye TV') hard.push(path.relative(app, f) + ': ' + m[1]);
assert.deepEqual(hard, [], 'fixed-language accessibility labels');
console.log(`PASS interface text: ${used.size} keys used by the app, all present in ${LANGS.length} languages`);
