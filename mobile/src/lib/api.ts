// Reading the public Wartabiye TV content. The ONLY source is the website's own published files:
//   api/v1/meta.json, api/v1/feed/<lang>.json, api/v1/a/<id>.json   (tools/build_app_api.py, built on every publish)
// and, if api/v1 cannot be reached (for example right before the first publish that creates it), data/news.json itself,
// converted here with the same rules. Nothing is invented, rewritten or stored on any other server.
import { API, CONTENT_BASE } from './config';
import type { Article, Card, Lang, LiveUpdate, Meta, Section, Translation, Video } from './types';
import { LANGS } from './types';

const TIMEOUT = 20_000;

async function getJSON<T>(url: string): Promise<T> {
  const ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = setTimeout(() => ctl?.abort(), TIMEOUT);
  try {
    const r = await fetch(url, { cache: 'no-store', signal: ctl?.signal, headers: { Accept: 'application/json' } } as RequestInit);
    if (!r.ok) {
      const e = new Error('HTTP ' + r.status) as Error & { status?: number };
      e.status = r.status;
      throw e;
    }
    return (await r.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}
// GitHub Pages caches files for up to 10 minutes; a changing query string always reaches the newest publish
const bust = (span = 30_000) => 't=' + Math.floor(Date.now() / span);

// ---------- fallback: the same conversion as tools/build_app_api.py, from data/news.json ----------
type Raw = Record<string, any>;
const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
const img = (u: unknown) => { const s = str(u).replace(/^\//, ''); return s.startsWith('img/') || s.startsWith('https://') ? s : ''; };
export function sectionOf(it: Raw): Section {
  if (it.section === 'sports' || it.section === 'world' || it.section === 'somalia') return it.section;
  if (it.category === 'Ciyaaraha') return 'sports';
  if (it.category === 'Adduunka') return 'world';
  return 'somalia';
}
function trOf(it: Raw, lang: Lang): Translation | null {
  if (lang === 'so') return { title: str(it.title), summary: str(it.summary), body: str(it.body), imageAlt: str(it.imageAlt), status: 'original' };
  const x = it[lang];
  if (!x || typeof x !== 'object' || !str(x.title)) return null;
  return { title: str(x.title), summary: str(x.summary), body: str(x.body), imageAlt: str(x.imageAlt), status: x.status === 'manual' ? 'manual' : 'auto' };
}
function hash(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return (h >>> 0).toString(16).padStart(8, '0');
}
export function articleFromRaw(it: Raw): Article {
  const show = !!(it.source && it.source !== 'Wartabiye TV' && it.attributionRequired === true);
  const a: Article = {
    id: it.id, url: 'https://www.wartabiyetv.com/war/' + it.id + '.html', publishedAt: it.publishedAt, timeVerified: it.timeVerified !== false,
    section: sectionOf(it), category: str(it.category), country: str(it.country), region: str(it.region), sport: str(it.sport), competition: str(it.competition),
    breaking: !!it.breaking, important: !!it.important, sponsored: !!it.sponsored, sponsor: str(it.sponsor), by: it.by === 'admin' ? 'admin' : 'newsroom',
    image: img(it.image), thumb: img(it.thumb),
    imageCredit: str(it.imageCredit) || (it.by === 'admin' && img(it.image) ? 'Wartabiye TV' : ''), imageLicense: str(it.imageLicense),
    imageSourceUrl: str(it.imageSourceUrl).startsWith('https://') ? str(it.imageSourceUrl) : '', imageKind: str(it.imageKind), imageNote: str(it.imageNote),
    source: show ? str(it.source) : '', sourceUrl: show && str(it.sourceUrl).startsWith('http') ? str(it.sourceUrl) : '',
    basedOnOthers: !!(it.by !== 'admin' && it.source && it.source !== 'Wartabiye TV' && !show), tr: {}, rev: '',
  };
  for (const l of LANGS) { const t = trOf(it, l); if (t) a.tr[l] = t; }
  a.rev = 'f' + hash(JSON.stringify(a));
  return a;
}
export function cardOf(a: Article, lang: Lang): Card | null {
  const t = a.tr[lang];
  if (!t) return null;
  let summary = t.summary || t.body;
  if (summary.length > 320) summary = summary.slice(0, 320).replace(/\s+\S*$/, '') + '…';
  const c: Card = { id: a.id, rev: a.rev, title: t.title, summary, publishedAt: a.publishedAt, section: a.section, category: a.category,
    image: a.image, thumb: a.thumb || a.image, imageAlt: t.imageAlt || a.tr.so?.imageAlt || '' };
  if (a.country) c.country = a.country;
  if (a.region) c.region = a.region;
  if (a.sport) c.sport = a.sport;
  if (a.breaking) c.breaking = true;
  if (a.important) c.important = true;
  if (a.sponsored) { c.sponsored = true; if (a.sponsor) c.sponsor = a.sponsor; }
  if (!a.timeVerified) c.timeVerified = false;
  if (t.status === 'auto') c.autoTranslated = true;
  if (a.imageKind === 'illustrative') c.imageKind = 'illustrative';
  return c;
}

let fallbackCache: { at: number; arts: Article[]; raw: Raw } | null = null;
async function fallbackArticles(): Promise<{ arts: Article[]; raw: Raw }> {
  if (fallbackCache && Date.now() - fallbackCache.at < 30_000) return fallbackCache;
  const raw = await getJSON<Raw>(CONTENT_BASE + 'data/news.json?' + bust());
  const arts = ((raw.news || []) as Raw[])
    .filter(n => n && n.id && str(n.title) && n.published !== false)
    .sort((x, y) => (x.publishedAt < y.publishedAt ? 1 : -1))
    .map(articleFromRaw);
  fallbackCache = { at: Date.now(), arts, raw };
  return fallbackCache;
}

// ---------- public API ----------
export async function fetchMeta(): Promise<Meta> {
  try {
    const m = await getJSON<Meta>(API + 'meta.json?' + bust());
    return { ...m, origin: 'api' };
  } catch (e) {
    const { arts, raw } = await fallbackArticles();
    const counts: Meta['counts'] = {};
    for (const l of LANGS) counts[l] = arts.filter(a => a.tr[l]).length;
    return {
      schema: 1, version: 'f' + hash(arts.map(a => a.id + a.rev).join('|')), contentUpdatedAt: raw.updatedAt, lastRunAt: raw.lastRunAt,
      lastSuccessAt: raw.lastSuccessAt, counts, newest: arts[0]?.publishedAt ?? null,
      liveUpdates: { url: 'https://raw.githubusercontent.com/Mahadupdalla/wartabiye-tv/live-data/live-updates.json', fallback: 'data/live-feeds/live-updates.json' },
      videoFeed: { url: 'https://raw.githubusercontent.com/Mahadupdalla/wartabiye-tv/live-data/video-feed.json', fallback: 'data/live-feeds/video-feed.json', own: 'data/videos.json' },
      breaking: { mode: 'auto', label: 'DEGDEG', items: [] }, ads: [], origin: 'fallback',
    };
  }
}

export async function fetchFeed(lang: Lang, meta: Meta): Promise<Card[]> {
  if (meta.origin !== 'fallback') {
    try {
      const f = await getJSON<{ items: Card[] }>(API + 'feed/' + lang + '.json?v=' + meta.version);
      return f.items;
    } catch (e) { /* fall through to data/news.json */ }
  }
  const { arts } = await fallbackArticles();
  return arts.map(a => cardOf(a, lang)).filter(Boolean) as Card[];
}

/** null = the article is not published (deleted or unpublished in /admin/) */
export async function fetchArticle(id: string, rev?: string, meta?: Meta | null): Promise<Article | null> {
  if (!meta || meta.origin !== 'fallback') {
    try {
      return await getJSON<Article>(API + 'a/' + encodeURIComponent(id) + '.json?r=' + (rev || bust()));
    } catch (e: any) {
      if (e?.status === 404 && meta?.origin === 'api') return null;
    }
  }
  const { arts } = await fallbackArticles();
  return arts.find(a => a.id === id) ?? null;
}

export async function fetchLiveUpdates(meta: Meta | null): Promise<{ updatedAt?: string; items: LiveUpdate[] }> {
  const m = meta?.liveUpdates ?? { url: 'https://raw.githubusercontent.com/Mahadupdalla/wartabiye-tv/live-data/live-updates.json', fallback: 'data/live-feeds/live-updates.json' };
  try { return await getJSON(m.url + '?' + bust(60_000)); } catch (e) { /* the hourly copy on the website */ }
  try { return await getJSON(CONTENT_BASE + m.fallback + '?' + bust(600_000)); } catch (e) { return { items: [] }; }
}

export async function fetchVideos(meta: Meta | null): Promise<Video[]> {
  const m = meta?.videoFeed ?? { url: 'https://raw.githubusercontent.com/Mahadupdalla/wartabiye-tv/live-data/video-feed.json', fallback: 'data/live-feeds/video-feed.json', own: 'data/videos.json' };
  const own = await getJSON<{ videos?: any[] }>(CONTENT_BASE + m.own + '?' + bust(60_000)).catch(() => ({ videos: [] as any[] }));
  const feed = await getJSON<{ videos?: any[] }>(m.url + '?' + bust(300_000)).catch(() => getJSON<{ videos?: any[] }>(CONTENT_BASE + m.fallback + '?' + bust(600_000)).catch(() => ({ videos: [] as any[] })));
  const ok = (v: any) => v && v.published !== false && (!v.publishAt || Date.parse(v.publishAt) <= Date.now());
  const ytId = (v: any): string | undefined => {
    if (typeof v.videoId === 'string' && /^[A-Za-z0-9_-]{11}$/.test(v.videoId)) return v.videoId;
    const m2 = String(v.youtube || v.url || '').match(/(?:v=|youtu\.be\/|embed\/|shorts\/)([A-Za-z0-9_-]{11})/);
    return m2 ? m2[1] : undefined;
  };
  const list: Video[] = [...(own.videos || []), ...(feed.videos || [])].filter(ok).map((v: any) => ({
    id: String(v.id || ytId(v) || ''), videoId: ytId(v), title: String(v.title || ''), summary: v.summary, kind: v.kind, youtube: v.youtube,
    publishedAt: v.publishedAt, source: v.source, thumbnail: v.thumbnail,
  })).filter(v => v.id && v.title && v.videoId);
  const seen = new Set<string>();
  return list.filter(v => (seen.has(v.videoId!) ? false : (seen.add(v.videoId!), true)));
}

export interface AlertItem { id: string; kind: string; title: string; summary?: string; t?: Record<string, { title: string; summary?: string }>; url: string; time: string; manual?: boolean; urgent?: boolean; article?: string }
export async function fetchAlerts(): Promise<AlertItem[]> {
  const j = await getJSON<{ items?: AlertItem[] }>(CONTENT_BASE + 'data/notifications.json?' + bust(60_000));
  return Array.isArray(j.items) ? j.items : [];
}

/** [id, rev] of every published article; null when it cannot be known (offline) */
export async function fetchIds(meta: Meta): Promise<Map<string, string> | null> {
  try {
    if (meta.origin !== 'fallback') {
      const j = await getJSON<{ items: [string, string][] }>(API + 'ids.json?v=' + meta.version);
      return new Map(j.items);
    }
    const { arts } = await fallbackArticles();
    return new Map(arts.map(a => [a.id, a.rev] as [string, string]));
  } catch (e) { return null; }
}
