export type Lang = 'so' | 'en' | 'ar' | 'fr' | 'nl' | 'it' | 'tr' | 'de' | 'es';
export const LANGS: Lang[] = ['so', 'en', 'ar', 'fr', 'nl', 'it', 'tr', 'de', 'es'];
export const LANG_INFO: Record<Lang, { name: string; rtl?: boolean; locale: string; flag: string }> = {
  so: { name: 'Soomaali', locale: 'so-SO', flag: '🇸🇴' },
  en: { name: 'English', locale: 'en-GB', flag: '🇬🇧' },
  ar: { name: 'العربية', rtl: true, locale: 'ar', flag: '🇸🇦' },
  fr: { name: 'Français', locale: 'fr-FR', flag: '🇫🇷' },
  nl: { name: 'Nederlands', locale: 'nl-NL', flag: '🇳🇱' },
  it: { name: 'Italiano', locale: 'it-IT', flag: '🇮🇹' },
  tr: { name: 'Türkçe', locale: 'tr-TR', flag: '🇹🇷' },
  de: { name: 'Deutsch', locale: 'de-DE', flag: '🇩🇪' },
  es: { name: 'Español', locale: 'es-ES', flag: '🇪🇸' },
};

export type Section = 'somalia' | 'world' | 'sports';

/** One article on a list (api/v1/feed/<lang>.json) */
export interface Card {
  id: string;
  rev: string;
  title: string;
  summary: string;
  publishedAt: string;
  section: Section;
  category: string;
  image: string;
  thumb: string;
  imageAlt: string;
  country?: string;
  region?: string;
  sport?: string;
  competition?: string;
  sponsor?: string;
  breaking?: boolean;
  important?: boolean;
  sponsored?: boolean;
  timeVerified?: boolean;
  autoTranslated?: boolean;
  /** 'illustrative': the website labels the photo "Sawir muujin ah" */
  imageKind?: string;
}

export interface Translation { title: string; summary: string; body: string; imageAlt: string; status: 'original' | 'manual' | 'auto' }

/** The full article (api/v1/a/<id>.json) */
export interface Article {
  id: string;
  rev: string;
  url: string;
  publishedAt: string;
  timeVerified: boolean;
  section: Section;
  category: string;
  country: string;
  region: string;
  sport: string;
  competition: string;
  breaking: boolean;
  important: boolean;
  sponsored: boolean;
  sponsor: string;
  by: 'admin' | 'newsroom';
  image: string;
  thumb: string;
  imageCredit: string;
  imageLicense: string;
  imageSourceUrl: string;
  imageKind: string;
  imageNote: string;
  source: string;
  sourceUrl: string;
  basedOnOthers: boolean;
  tr: Partial<Record<Lang, Translation>>;
}

export interface Ad {
  id: string;
  title?: string;
  text?: string;
  image?: string;
  link?: string;
  advertiser?: string;
  label?: string;
  positions: string[];
  [lang: string]: unknown;
}

export interface Meta {
  schema: number;
  version: string;
  contentUpdatedAt?: string;
  lastRunAt?: string;
  lastSuccessAt?: string;
  counts: Partial<Record<Lang, number>>;
  newest?: string | null;
  liveUpdates: { url: string; fallback: string };
  videoFeed: { url: string; fallback: string; own: string };
  breaking: { mode: string; label: string; items: (string | { text?: string; link?: string; [k: string]: unknown })[] };
  ads: Ad[];
  push?: { enabled: boolean; workerUrl: string; categories: string[] };
  /** the editor's homepage picks in /admin/ (article ids), as on the website */
  featured?: string[];
  trending?: string[];
  social?: { facebook?: string; youtube?: string; tiktok?: string };
  /** the footer contact email set in /admin/ -> Website settings -> Footer (absent when none is set) */
  contact?: { email?: string };
  /** "fallback" when the app had to read data/news.json because api/v1 was not reachable */
  origin?: 'api' | 'fallback';
}

export interface LiveUpdate {
  id: string;
  publishedAt: string;
  region?: string;
  story?: string;
  breaking?: boolean;
  corroborated?: number;
  so: { title: string; text: string };
  [lang: string]: unknown;
}

export interface Video {
  id: string;
  videoId?: string;
  title: string;
  summary?: string;
  kind?: string;
  youtube?: string;
  publishedAt?: string;
  source?: string;
  thumbnail?: string;
}
