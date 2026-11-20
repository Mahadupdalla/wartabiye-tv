// Image search for /admin/ -> Image sources (owner session only). The browser cannot call the image providers itself
// (the dashboard only talks to this Worker), so this asks them on the server and returns one list of candidates with
// the licence, author and source page each provider states. Nothing is invented: an unknown field stays empty.
//   GET /api/images/search?q=<words>&provider=commons|openverse|unsplash|pexels|pixabay
//   GET /api/images/fetch?url=<image URL>     the photo's bytes, only from the providers' own image hosts
// Unsplash, Pexels and Pixabay work only when their free API keys are set as Worker secrets
// (UNSPLASH_ACCESS_KEY, PEXELS_API_KEY, PIXABAY_API_KEY). Provider replies are data, never instructions.
import { json } from './util.js';

const UA = 'WartabiyeTV-Admin/1.0 (https://www.wartabiyetv.com/)';
export const IMAGE_HOSTS = /^(upload\.wikimedia\.org|live\.staticflickr\.com|farm\d+\.staticflickr\.com|images\.unsplash\.com|images\.pexels\.com|cdn\.pixabay\.com|pixabay\.com)$/;
const MAX = 15e6;

const clean = v => String(v || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 300) || null;

function commonsLicence(wt) {
  if (/\{\{\s*(non-free|fair use|cc-by-nc|cc-by-nd|copyvio|delete|speedy)/i.test(wt)) return null;
  const L = [[/cc-zero|\{\{\s*CC0/i, 'CC0'], [/cc-by-sa-4\.0/i, 'CC BY-SA 4.0'], [/cc-by-sa-3\.0/i, 'CC BY-SA 3.0'], [/cc-by-sa-2\.5/i, 'CC BY-SA 2.5'],
    [/cc-by-sa-2\.0/i, 'CC BY-SA 2.0'], [/cc-by-4\.0/i, 'CC BY 4.0'], [/cc-by-3\.0/i, 'CC BY 3.0'], [/cc-by-2\.5/i, 'CC BY 2.5'], [/cc-by-2\.0/i, 'CC BY 2.0'],
    [/\{\{\s*PD-USGov/i, 'Public domain'], [/\{\{\s*PD-(self|author|old|US|Highsmith|LOC|ineligible)/i, 'Public domain'], [/\{\{\s*AMISOM/i, 'CC0'], [/\{\{\s*VOA/i, 'Public domain']];
  const m = L.find(x => x[0].test(wt));
  return m ? m[1] : null;
}
function wtField(wt, name) {
  const m = new RegExp('\\|\\s*' + name + '\\s*=\\s*([\\s\\S]*?)\\n\\s*(?:\\||\\}\\})', 'i').exec(wt || '');
  let v = m ? m[1] : '';
  v = v.replace(/\{\{\s*(en|so)\s*\|\s*(1=)?/g, '').replace(/\{\{\s*Creator:([^}|]+)\}\}/g, '$1').replace(/\[\[(?:[^|\]]*\|)?([^\]]*)\]\]/g, '$1')
    .replace(/\[https?:\/\/\S+\s+([^\]]*)\]/g, '$1').replace(/\{\{[^}]*\}\}|\}\}|\{\{|<[^>]+>|''+/g, '');
  return v.replace(/\s+/g, ' ').trim();
}
// Commons serves any size of a file through Special:FilePath (a redirect to upload.wikimedia.org)
export function commonsUrls(title, width = 1280) {
  const n = encodeURIComponent(title.split(':').slice(1).join(':').replace(/ /g, '_'));
  return { direct: `https://commons.wikimedia.org/wiki/Special:FilePath/${n}?width=${width}`,
    thumb: `https://commons.wikimedia.org/wiki/Special:FilePath/${n}?width=400`,
    page: 'https://commons.wikimedia.org/wiki/File:' + n };
}

async function getJSON(url, headers = {}) {
  const r = await fetch(url, { headers: { 'user-agent': UA, ...headers } });
  if (!r.ok) throw new Error('provider answered ' + r.status);
  return r.json();
}

export async function searchCommons(q) {
  const d = await getJSON('https://commons.wikimedia.org/w/api.php?' + new URLSearchParams({ action: 'query', format: 'json', list: 'search', srsearch: q + ' filetype:bitmap', srnamespace: '6', srlimit: '10' }));
  const titles = ((d.query && d.query.search) || []).map(x => x.title).filter(t => /\.(jpe?g|png)$/i.test(t)).slice(0, 8);
  const out = await Promise.all(titles.map(async t => {
    const r = await fetch('https://commons.wikimedia.org/w/index.php?' + new URLSearchParams({ title: t, action: 'raw' }), { headers: { 'user-agent': UA } }).catch(() => null);
    const wt = r && r.ok ? await r.text() : '';
    const u = commonsUrls(t);
    const author = clean(wtField(wt, 'Author') || wtField(wt, 'Photographer'));
    return { provider: 'commons', sourceType: 'commons', source: 'Wikimedia Commons', ref: t, title: t.slice(5).replace(/\.[^.]+$/, ''),
      description: clean(wtField(wt, 'Description')), date: clean(wtField(wt, 'Date')), author: author && !/^(unknown|anonymous)/i.test(author) ? author : null,
      license: commonsLicence(wt), pageUrl: u.page, directUrl: u.direct, thumb: u.thumb };
  }));
  return out;
}
export async function searchOpenverse(q) {
  const d = await getJSON('https://api.openverse.org/v1/images/?' + new URLSearchParams({ q, page_size: '20', license_type: 'commercial,modification', mature: 'false' }));
  return (d.results || []).filter(x => x.url && x.foreign_landing_url).map(x => {
    const l = String(x.license || '').toLowerCase();
    return { provider: 'openverse', sourceType: 'openverse', source: x.source === 'flickr' ? 'Flickr' : x.source === 'wikimedia' ? 'Wikimedia Commons' : (x.source || 'Openverse'),
      ref: 'openverse:' + x.id, title: clean(x.title), description: (x.tags || []).map(t => t.name).slice(0, 12).join(', '), date: null,
      author: clean(x.creator), license: l === 'cc0' ? 'CC0' : l === 'pdm' ? 'Public domain' : 'CC ' + l.toUpperCase() + (x.license_version ? ' ' + x.license_version : ''),
      licenseUrl: x.license_url || null, pageUrl: x.foreign_landing_url, directUrl: x.url, thumb: x.thumbnail || x.url, width: x.width || null, height: x.height || null };
  });
}
async function searchUnsplash(q, env) {
  if (!env.UNSPLASH_ACCESS_KEY) return { needsKey: 'UNSPLASH_ACCESS_KEY' };
  const d = await getJSON('https://api.unsplash.com/search/photos?' + new URLSearchParams({ query: q, per_page: '15' }), { authorization: 'Client-ID ' + env.UNSPLASH_ACCESS_KEY });
  return (d.results || []).map(x => ({ provider: 'unsplash', sourceType: 'stock', source: 'Unsplash', ref: 'unsplash:' + x.id, title: clean(x.alt_description), description: clean(x.description),
    author: x.user && x.user.name, license: 'Unsplash License', licenseUrl: 'https://unsplash.com/license', pageUrl: x.links && x.links.html,
    directUrl: x.urls && x.urls.regular, thumb: x.urls && x.urls.small, width: x.width, height: x.height, date: x.created_at }));
}
async function searchPexels(q, env) {
  if (!env.PEXELS_API_KEY) return { needsKey: 'PEXELS_API_KEY' };
  const d = await getJSON('https://api.pexels.com/v1/search?' + new URLSearchParams({ query: q, per_page: '15' }), { authorization: env.PEXELS_API_KEY });
  return (d.photos || []).map(x => ({ provider: 'pexels', sourceType: 'stock', source: 'Pexels', ref: 'pexels:' + x.id, title: clean(x.alt), author: x.photographer,
    license: 'Pexels License', licenseUrl: 'https://www.pexels.com/license/', pageUrl: x.url, directUrl: x.src && x.src.large2x, thumb: x.src && x.src.medium, width: x.width, height: x.height }));
}
async function searchPixabay(q, env) {
  if (!env.PIXABAY_API_KEY) return { needsKey: 'PIXABAY_API_KEY' };
  const d = await getJSON('https://pixabay.com/api/?' + new URLSearchParams({ key: env.PIXABAY_API_KEY, q: q.slice(0, 100), per_page: '15', image_type: 'photo', safesearch: 'true' }));
  return (d.hits || []).map(x => ({ provider: 'pixabay', sourceType: 'stock', source: 'Pixabay', ref: 'pixabay:' + x.id, title: clean(x.tags), author: x.user,
    license: 'Pixabay Content License', licenseUrl: 'https://pixabay.com/service/license-summary/', pageUrl: x.pageURL, directUrl: x.largeImageURL, thumb: x.webformatURL, width: x.imageWidth, height: x.imageHeight }));
}
const PROVIDERS = { commons: searchCommons, openverse: searchOpenverse, unsplash: searchUnsplash, pexels: searchPexels, pixabay: searchPixabay };

export async function imageSearch(req, env) {
  const u = new URL(req.url);
  const q = String(u.searchParams.get('q') || '').trim().slice(0, 120);
  const p = u.searchParams.get('provider') || 'commons';
  if (!q) return json({ error: 'q is required' }, 400);
  if (!PROVIDERS[p]) return json({ error: 'unknown provider' }, 400);
  try {
    const r = await PROVIDERS[p](q, env);
    if (r && r.needsKey) return json({ provider: p, results: [], needsKey: r.needsKey });
    // only https links from the provider itself; a candidate without a page to check its licence is dropped
    const results = r.filter(x => /^https:\/\//.test(x.pageUrl || '') && /^https:\/\//.test(x.directUrl || ''));
    return json({ provider: p, results });
  } catch (e) {
    return json({ provider: p, results: [], error: String(e.message || e) }, 502);
  }
}

export async function imageFetch(req) {
  const raw = new URL(req.url).searchParams.get('url') || '';
  let t;
  try { t = new URL(raw); } catch (e) { return json({ error: 'bad url' }, 400); }
  const filePath = t.hostname === 'commons.wikimedia.org' && t.pathname.startsWith('/wiki/Special:FilePath/');
  if (t.protocol !== 'https:' || !(IMAGE_HOSTS.test(t.hostname) || filePath)) return json({ error: 'only images from the photo providers can be downloaded here' }, 403);
  const r = await fetch(t.toString(), { headers: { 'user-agent': UA }, redirect: 'follow' });
  if (r.url && !IMAGE_HOSTS.test(new URL(r.url).hostname) && !filePath) return json({ error: 'redirected away from the photo provider' }, 403);
  const ct = r.headers.get('content-type') || '';
  if (!r.ok || !/^image\/(jpeg|png|webp)/.test(ct)) return json({ error: 'not a photo (' + r.status + ' ' + ct + ')' }, 502);
  const len = +(r.headers.get('content-length') || 0);
  if (len > MAX) return json({ error: 'photo is too large' }, 413);
  const buf = await r.arrayBuffer();
  if (buf.byteLength > MAX) return json({ error: 'photo is too large' }, 413);
  return new Response(buf, { headers: { 'content-type': ct, 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' } });
}
