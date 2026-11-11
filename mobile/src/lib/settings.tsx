import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Platform, useColorScheme } from 'react-native';
import { load, save } from './storage';
import { DARK, LIGHT, type Colors } from './theme';
import { t as translate } from './i18n';
import type { Lang } from './types';
import { LANG_INFO, LANGS } from './types';

export type ThemePref = 'light' | 'dark' | 'system';
export interface NotifPrefs { enabled: boolean; breaking: boolean; eastAfrica: boolean; world: boolean; sports: boolean }

interface Settings {
  ready: boolean;
  lang: Lang;
  rtl: boolean;
  themePref: ThemePref;
  colors: Colors;
  fontSize: number;          // article body size in px, 15 to 24 (website: 18)
  notif: NotifPrefs;
  analytics: boolean;
  setLang(l: Lang): void;
  setThemePref(p: ThemePref): void;
  setFontSize(n: number): void;
  setNotif(n: NotifPrefs): void;
  setAnalytics(on: boolean): void;
  t(key: string, vars?: Record<string, string | number>): string;
}

const Ctx = createContext<Settings | null>(null);
// Default: Somali, light mode (owner's request), Breaking + Somalia alerts once notifications are switched on
const DEFAULT_NOTIF: NotifPrefs = { enabled: false, breaking: true, eastAfrica: true, world: false, sports: false };

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const scheme = useColorScheme();
  const [ready, setReady] = useState(false);
  const [lang, setLangS] = useState<Lang>('so');
  const [themePref, setThemeS] = useState<ThemePref>('light');
  const [fontSize, setFontS] = useState(18);
  const [notif, setNotifS] = useState<NotifPrefs>(DEFAULT_NOTIF);
  const [analytics, setAnalyticsS] = useState(true);

  useEffect(() => {
    (async () => {
      const s = await load<Partial<{ lang: Lang; theme: ThemePref; fontSize: number; notif: NotifPrefs; analytics: boolean }>>('settings', {});
      // the installable web app also follows ?lang= and the website's own saved language
      let webLang: string | null = null;
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        try { webLang = new URLSearchParams(window.location.search).get('lang') || window.localStorage.getItem('wartabiye-lang'); } catch (e) { webLang = null; }
      }
      // the language is also kept under its own key, written the moment the reader picks it (see chooseLang)
      const own = await load<string | null>('lang', null);
      const l = (LANGS as string[]).includes(webLang || '') ? (webLang as Lang)
        : own && (LANGS as string[]).includes(own) ? (own as Lang)
        : s.lang && LANGS.includes(s.lang) ? s.lang : 'so';
      setLangS(l);
      if (s.theme) setThemeS(s.theme);
      if (typeof s.fontSize === 'number') setFontS(Math.max(15, Math.min(24, s.fontSize)));
      if (s.notif) setNotifS({ ...DEFAULT_NOTIF, ...s.notif });
      if (typeof s.analytics === 'boolean') setAnalyticsS(s.analytics);
      setReady(true);
    })();
  }, []);

  useEffect(() => {
    if (!ready) return;
    save('settings', { lang, theme: themePref, fontSize, notif, analytics });
  }, [ready, lang, themePref, fontSize, notif, analytics]);

  // save the chosen language at once, not after the next render, so closing the app straight away keeps it
  const chooseLang = useCallback((l: Lang) => {
    if (!LANGS.includes(l)) return;
    setLangS(l);
    save('lang', l);
  }, []);

  const rtl = !!LANG_INFO[lang].rtl;
  useEffect(() => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      document.documentElement.lang = lang;
      document.documentElement.dir = rtl ? 'rtl' : 'ltr';
    }
  }, [lang, rtl]);

  const dark = themePref === 'dark' || (themePref === 'system' && scheme === 'dark');
  const colors = dark ? DARK : LIGHT;
  const t = useCallback((key: string, vars?: Record<string, string | number>) => translate(lang, key, vars), [lang]);

  const value = useMemo<Settings>(() => ({
    ready, lang, rtl, themePref, colors, fontSize, notif, analytics,
    setLang: chooseLang, setThemePref: setThemeS, setFontSize: (n: number) => setFontS(Math.max(15, Math.min(24, n))), setNotif: setNotifS,
    setAnalytics: setAnalyticsS, t,
  }), [ready, lang, rtl, themePref, colors, fontSize, notif, analytics, t, chooseLang]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSettings(): Settings {
  const c = useContext(Ctx);
  if (!c) throw new Error('useSettings outside SettingsProvider');
  return c;
}
