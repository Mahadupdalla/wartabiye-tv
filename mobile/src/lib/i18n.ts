import SITE_STRINGS from '../i18n/site.json';
import { APP_STRINGS } from '../i18n/app';
import type { Lang } from './types';
import { LANG_INFO } from './types';

const SITE = SITE_STRINGS as Record<string, Record<string, string>>;

/** Interface text: the website's own wording first, then the app's; Somali when a language has no text for a key */
export function t(lang: Lang, key: string, vars?: Record<string, string | number>): string {
  const v = SITE[lang]?.[key] || APP_STRINGS[lang]?.[key] || SITE.so[key] || APP_STRINGS.so[key] || APP_STRINGS.en[key] || key;
  return vars ? v.replace(/\{(\w+)\}/g, (_, k) => (vars[k] != null ? String(vars[k]) : '')) : v;
}

// Category names, as on the website (assets/app.js CATN)
const CATN: Partial<Record<Lang, Record<string, string>>> = {
  en: { Siyaasadda: 'Politics', Amniga: 'Security', Bulshada: 'Society', Dhaqaalaha: 'Economy', Adduunka: 'World', Ciyaaraha: 'Sport' },
  ar: { Siyaasadda: 'السياسة', Amniga: 'الأمن', Bulshada: 'المجتمع', Dhaqaalaha: 'الاقتصاد', Adduunka: 'العالم', Ciyaaraha: 'الرياضة' },
  fr: { Siyaasadda: 'Politique', Amniga: 'Sécurité', Bulshada: 'Société', Dhaqaalaha: 'Économie', Adduunka: 'Monde', Ciyaaraha: 'Sport' },
  nl: { Siyaasadda: 'Politiek', Amniga: 'Veiligheid', Bulshada: 'Samenleving', Dhaqaalaha: 'Economie', Adduunka: 'Wereld', Ciyaaraha: 'Sport' },
  it: { Siyaasadda: 'Politica', Amniga: 'Sicurezza', Bulshada: 'Società', Dhaqaalaha: 'Economia', Adduunka: 'Mondo', Ciyaaraha: 'Sport' },
  de: { Siyaasadda: 'Politik', Amniga: 'Sicherheit', Bulshada: 'Gesellschaft', Dhaqaalaha: 'Wirtschaft', Adduunka: 'Welt', Ciyaaraha: 'Sport' },
  tr: { Siyaasadda: 'Siyaset', Amniga: 'Güvenlik', Bulshada: 'Toplum', Dhaqaalaha: 'Ekonomi', Adduunka: 'Dünya', Ciyaaraha: 'Spor' },
  es: { Siyaasadda: 'Política', Amniga: 'Seguridad', Bulshada: 'Sociedad', Dhaqaalaha: 'Economía', Adduunka: 'Mundo', Ciyaaraha: 'Deportes' },
};
export function catName(lang: Lang, c: string): string {
  return (lang !== 'so' && CATN[lang]?.[c]) || c;
}

// ---------- times: the publisher's own time, shown in Mogadishu / Nairobi time (UTC+3), as on the website ----------
const SO_MONTHS = ['Janaayo', 'Febraayo', 'Maarso', 'Abriil', 'Maajo', 'Juun', 'Luulyo', 'Ogost', 'Sebtembar', 'Oktoobar', 'Nofembar', 'Desembar'];
function eatParts(d: Date) {
  const x = new Date(d.getTime() + 3 * 3600_000);
  return { y: x.getUTCFullYear(), m: x.getUTCMonth(), d: x.getUTCDate(), hh: String(x.getUTCHours()).padStart(2, '0'), mm: String(x.getUTCMinutes()).padStart(2, '0') };
}
export function clock(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const p = eatParts(d);
  return p.hh + ':' + p.mm;
}
export function fullDate(lang: Lang, iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const p = eatParts(d);
  if (lang === 'so') return `${p.d} ${SO_MONTHS[p.m]} ${p.y} · ${p.hh}:${p.mm}`;
  try {
    return new Intl.DateTimeFormat(LANG_INFO[lang].locale, { timeZone: 'Africa/Nairobi', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).format(d);
  } catch (e) {
    return `${p.d}.${p.m + 1}.${p.y} ${p.hh}:${p.mm}`;
  }
}
export function ago(lang: Lang, iso: string, now = Date.now()): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const m = Math.round((now - d.getTime()) / 60000);
  if (m < 2) return t(lang, 'now');
  const h = Math.round(m / 60), dd = Math.round(h / 24);
  if (lang === 'so') {
    if (m < 60) return m + ' daqiiqo kahor';
    if (h < 24) return h + ' saac kahor';
    if (dd < 7) return dd + ' maalin kahor';
    const p = eatParts(d);
    return `${p.d} ${SO_MONTHS[p.m]} ${p.y}`;
  }
  try {
    const rf = new Intl.RelativeTimeFormat(LANG_INFO[lang].locale, { numeric: 'always' });
    if (m < 60) return rf.format(-m, 'minute');
    if (h < 24) return rf.format(-h, 'hour');
    if (dd < 7) return rf.format(-dd, 'day');
  } catch (e) { /* older engines: date below */ }
  return fullDate(lang, iso).replace(/[,·]?\s*\d{1,2}:\d{2}.*$/, '');
}
