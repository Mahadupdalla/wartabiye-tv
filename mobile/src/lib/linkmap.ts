// Which app screen a Wartabiye TV web address belongs to. Plain functions without React Native, so the tests can run
// them directly (node --experimental-strip-types test/links.test.mjs). Used by lib/links.ts and app/+native-intent.tsx.
export const HOSTS = /^(www\.)?wartabiyetv\.com$/i;

/** Website pages shown inside the app (page/[slug]): the same page as on the website, without its header and footer */
export const PAGES = ['nagu-saabsan', 'xiriir', 'asturnaanta', 'anshaxa', 'saxitaannada', 'siyaasadda-xayeysiiska', 'xayeysiimaha'] as const;
export type PageSlug = (typeof PAGES)[number];

const SECTION_PATHS: Record<string, string> = {
  'soomaaliya': '/section/somalia',
  'bariga-afrika': '/section/somalia',
  'caalamka': '/section/world',
  'ciyaaraha': '/section/sports',
  'ciyaaraha-toos': '/section/sports',
  'wararka-tooska': '/live',
  'toos': '/videos',
  'muuqaal': '/videos',
};

/** The app screen for a website path ("/war/abc.html", "/caalamka/", "/xiriir/"), or null when the app has none */
export function appPathFor(path: string): string | null {
  const clean = (path || '/').split(/[?#]/)[0].replace(/\/{2,}/g, '/');
  if (clean === '/' || clean === '' || clean === '/index.html') return '/';
  if (/^\/admin(\/|$)/i.test(clean)) return null; // never: the owner's dashboard is not part of the public app
  const war = clean.match(/^\/war\/([A-Za-z0-9_.-]+?)(\.html)?\/?$/);
  if (war) return '/war/' + war[1];
  const seg = clean.replace(/^\/|\/?(index\.html)?$/g, '');
  if (SECTION_PATHS[seg]) return SECTION_PATHS[seg];
  if ((PAGES as readonly string[]).includes(seg)) return '/page/' + seg;
  // already an app path (wartabiye://war/<id>, a notification's /live, ...)
  if (/^\/(war\/[A-Za-z0-9_.-]+|section\/(somalia|world|sports)|page\/(nagu-saabsan|xiriir|asturnaanta|anshaxa|saxitaannada|siyaasadda-xayeysiiska|xayeysiimaha)|live|videos|saved|search|notifications|settings|breaking|ads|more)$/.test(clean)) return clean;
  return null;
}

/** For a full URL: the app screen when it is a Wartabiye TV address, otherwise null */
export function appPathForUrl(url: string): string | null {
  const m = String(url || '').match(/^https?:\/\/([^/?#]+)(\/[^#]*)?(#.*)?$/i);
  if (!m || !HOSTS.test(m[1])) return null;
  const path = m[2] || '/';
  // the website's own single-page links: https://www.wartabiyetv.com/#xiriir
  const hash = (m[3] || '').slice(1);
  if ((path === '/' || path === '/index.html') && hash && (PAGES as readonly string[]).includes(hash)) return '/page/' + hash;
  if ((path === '/' || path === '/index.html') && hash && SECTION_PATHS[hash]) return SECTION_PATHS[hash];
  return appPathFor(path);
}

export function isInternal(url: string): boolean {
  return appPathForUrl(url) !== null;
}


/** A link from outside the app (https App Link / Universal Link, wartabiye://..., a notification path) → app screen */
export function systemPath(path: string): string {
  try {
    const p = String(path || '');
    if (/^https?:\/\//i.test(p)) return appPathForUrl(p) || '/';
    // wartabiye://war/<id> arrives as "wartabiye://war/<id>" or "/war/<id>"
    const rest = p.replace(/^wartabiye:\/\/?/i, '/');
    return appPathFor(rest.startsWith('/') ? rest : '/' + rest) || '/';
  } catch {
    return '/';
  }
}
