// Copies the interface text the app shares with the website from ../assets/i18n.js and ../assets/media-i18n.js (the website's own nine-language
// strings) into src/i18n/site.json, so menus and labels read exactly the same on wartabiyetv.com and in the app.
// Run after the website's i18n.js changes:  npm run sync-i18n
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const src = path.join(here, '..', '..', 'assets', 'i18n.js');
const media = path.join(here, '..', '..', 'assets', 'media-i18n.js'); // adds the LIVE / video strings to WT_I18N
const out = path.join(here, '..', 'src', 'i18n', 'site.json');

const KEYS = [
  'search', 'searchPh', 'live', 'langAria', 'latest', 'loadMore', 'searchResults', 'home', 'latestShort', 'breakingLabel', 'breaking',
  'readMore', 'illus', 'illusNote', 'photo', 'noImg', 'now', 'timeUnverified', 'timeUnverifiedLong', 'notFound', 'loadingStory', 'copy', 'copied',
  'related', 'noTr', 'autoTr', 'readSo', 'trNoneTitle', 'trNoneText', 'about', 'somalia', 'world', 'sports', 'advertise', 'saved', 'theme',
  'themeLight', 'themeDark', 'somaliaBlock', 'worldBlock', 'sportsBlock', 'textSize', 'smaller', 'larger', 'savedBtn', 'share', 'shareMore',
  'readTime', 'basedNote', 'srcNote', 'readOriginal', 'sponsored', 'sponsoredBy', 'adLabel', 'videosNav', 'videosTitle', 'videosSub',
  'latestVideos', 'playVideo', 'videoCredit', 'noVideos', 'videoRule', 'sportsTitle', 'sportsSub', 'latestSports', 'noSports', 'liveNewsNav',
  'lnTitle', 'lnSub', 'lnChecked', 'lnNew', 'lnEmpty', 'lnRule', 'lnUpdated', 'lnLiveOn', 'lnTick', 'luTitle', 'luNote', 'luEmpty', 'wireAll',
  'wireSomalia', 'wireEastAfrica', 'wireAfrica', 'wireWorld', 'somaliaNav', 'soTitle', 'soSub', 'latestSo', 'noSo', 'eastAfrica', 'eaTitle',
  'eaSub', 'eaBlock', 'worldTitle', 'worldSub', 'noWorld', 'latestWorld', 'savedEmpty', 'adHero', 'adHeroSub', 'adWhy', 'adWhy1', 'adWhy1t',
  'videoNewsNav', 'videoNewsTitle', 'videoNewsSub', 'adWhy2', 'adWhy2t', 'adWhy3', 'adWhy3t', 'adWhy4', 'adWhy4t', 'adOrder', 'adContact', 'adPolicy', 'privacy', 'editorial', 'aboutUs', 'contact',
  'noMatch', 'tagline', 'city', 'trHidden', 'somaliOnly', 'lnNone', 'lnDelayed', 'luCorrob', 'luStory', 'luAll',
];

const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(src, 'utf8'), sandbox);
vm.runInContext(fs.readFileSync(media, 'utf8'), sandbox);
const I = sandbox.window.WT_I18N;
const res = {};
for (const lang of Object.keys(I)) {
  res[lang] = {};
  for (const k of KEYS) {
    const v = I[lang][k];
    if (typeof v === 'string' && v !== '') res[lang][k] = v;
  }
}
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(res, null, 1) + '\n');
const missing = KEYS.filter(k => !(k in res.so));
console.log(`site.json: ${Object.keys(res).length} languages, ${KEYS.length} keys` + (missing.length ? `, not on the website (app text used): ${missing.join(', ')}` : ''));
