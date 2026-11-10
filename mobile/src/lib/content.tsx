import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { fetchArticle, fetchFeed, fetchIds, fetchMeta } from './api';
import { META_POLL_MS } from './config';
import { keys, load, remove, save } from './storage';
import { useSettings } from './settings';
import type { Article, Card, Lang, Meta } from './types';

// One connected platform: the app shows exactly what wartabiyetv.com has published. Every minute (and whenever the app
// comes back to the screen) it reads the small api/v1/meta.json; only when the website published, edited or removed
// something does it download the new feed. Edits change an article's "rev", so open and saved copies are refreshed;
// unpublished articles disappear from the feed and their offline copies are deleted.

export interface SavedItem { card: Card; savedAt: string; lang: Lang; removed?: boolean }

interface Content {
  meta: Meta | null;
  items: Card[];
  status: 'loading' | 'ready' | 'error';
  refreshing: boolean;
  offline: boolean;
  lastOk: number;            // time of the last successful check (ms)
  newIds: string[];          // stories that arrived since the list was last looked at
  published: Map<string, string> | null;
  refresh(): Promise<void>;
  markSeen(): void;
  getArticle(id: string, opts?: { rev?: string }): Promise<{ article: Article | null; fromCache: boolean }>;
  saved: SavedItem[];
  isSaved(id: string): boolean;
  toggleSaved(card: Card): Promise<void>;
}

const Ctx = createContext<Content | null>(null);
const MAX_CACHED = 120;

export function ContentProvider({ children }: { children: React.ReactNode }) {
  const { lang, ready } = useSettings();
  const [meta, setMeta] = useState<Meta | null>(null);
  const [items, setItems] = useState<Card[]>([]);
  const [status, setStatus] = useState<Content['status']>('loading');
  const [refreshing, setRefreshing] = useState(false);
  const [offline, setOffline] = useState(false);
  const [lastOk, setLastOk] = useState(0);
  const [newIds, setNewIds] = useState<string[]>([]);
  const [published, setPublished] = useState<Map<string, string> | null>(null);
  const [saved, setSaved] = useState<SavedItem[]>([]);
  const metaRef = useRef<Meta | null>(null);
  const feedVersion = useRef<string>('');
  const langRef = useRef<Lang>(lang);
  const busy = useRef(false);
  const memo = useRef(new Map<string, Article>());
  const seen = useRef<Set<string> | null>(null);

  // offline start: last meta, feed and saved list from the phone
  useEffect(() => {
    (async () => {
      setSaved(await load<SavedItem[]>('saved', []));
      const m = await load<Meta | null>('meta', null);
      if (m) { metaRef.current = m; setMeta(m); }
    })();
  }, []);

  const pruneOffline = useCallback(async (ids: Map<string, string>) => {
    // offline copies of articles that are no longer published are deleted; edited ones are reloaded when opened
    for (const k of await keys('art:')) {
      const id = k.slice(4);
      if (!ids.has(id)) { await remove(k); memo.current.delete(id); }
    }
    setSaved(prev => {
      const next = prev.map(s => ({ ...s, removed: !ids.has(s.card.id) }));
      save('saved', next);
      return next;
    });
  }, []);

  const check = useCallback(async (force = false) => {
    if (busy.current) return;
    busy.current = true;
    const l = langRef.current;
    try {
      const m = await fetchMeta();
      const langChanged = feedVersion.current !== '' && !feedVersion.current.endsWith(':' + l);
      if (force || langChanged || !feedVersion.current || feedVersion.current !== m.version + ':' + l) {
        const list = await fetchFeed(l, m);
        if (langRef.current !== l) return; // the language changed while loading
        if (seen.current && !langChanged) {
          const add = list.filter(c => !seen.current!.has(c.id)).map(c => c.id);
          if (add.length) setNewIds(prev => [...new Set([...add, ...prev])]);
        } else {
          seen.current = new Set(list.map(c => c.id));
        }
        setItems(list);
        feedVersion.current = m.version + ':' + l;
        save('feed:' + l, list);
        const prevVersion = metaRef.current?.version;
        metaRef.current = m; setMeta(m); save('meta', m);
        if (prevVersion !== m.version || !published) {
          const ids = await fetchIds(m);
          if (ids) { setPublished(ids); pruneOffline(ids); }
        }
      } else if (metaRef.current?.version !== m.version || metaRef.current?.lastRunAt !== m.lastRunAt) {
        metaRef.current = m; setMeta(m); save('meta', m);
      }
      setStatus('ready');
      setOffline(false);
      setLastOk(Date.now());
    } catch (e) {
      // no connection: keep showing the last news the phone has
      if (!feedVersion.current) {
        const cached = await load<Card[] | null>('feed:' + l, null);
        if (cached && cached.length) { setItems(cached); setStatus('ready'); }
        else setStatus('error');
      }
      // the website could not be reached: the person is told the list may not be the newest and can retry
      setOffline(true);
    } finally {
      busy.current = false;
    }
  }, [pruneOffline, published]);

  // first load and every language change: show the stored feed at once, then check the website
  useEffect(() => {
    if (!ready) return;
    langRef.current = lang;
    seen.current = null;
    setNewIds([]);
    (async () => {
      const cached = await load<Card[] | null>('feed:' + lang, null);
      if (cached && cached.length && langRef.current === lang) { setItems(cached); setStatus('ready'); }
      else { setItems([]); setStatus('loading'); }
      await check(true);
    })();
  }, [ready, lang]); // eslint-disable-line react-hooks/exhaustive-deps

  // every minute while the app is on screen, and as soon as it comes back; nothing runs in the background
  useEffect(() => {
    if (!ready) return;
    let timer: ReturnType<typeof setInterval> | null = setInterval(() => check(false), META_POLL_MS);
    const sub = AppState.addEventListener('change', s => {
      if (s === 'active') {
        check(false);
        if (!timer) timer = setInterval(() => check(false), META_POLL_MS);
      } else if (timer) { clearInterval(timer); timer = null; }
    });
    const net = NetInfo.addEventListener(st => {
      if (st.isConnected && st.isInternetReachable !== false) { setOffline(false); check(false); }
      else if (st.isConnected === false) setOffline(true);
    });
    return () => { if (timer) clearInterval(timer); sub.remove(); net(); };
  }, [ready, check]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try { await check(true); } finally { setRefreshing(false); }
  }, [check]);

  const markSeen = useCallback(() => {
    setNewIds([]);
    seen.current = new Set(items.map(c => c.id));
  }, [items]);

  const getArticle = useCallback(async (id: string, opts?: { rev?: string }) => {
    const want = opts?.rev || published?.get(id);
    const m = memo.current.get(id) || (await load<Article | null>('art:' + id, null));
    if (m && want && m.rev === want) { memo.current.set(id, m); return { article: m, fromCache: true }; }
    try {
      const a = await fetchArticle(id, want, metaRef.current);
      if (!a) { // unpublished or deleted on the website
        memo.current.delete(id); await remove('art:' + id);
        return { article: null, fromCache: false };
      }
      memo.current.set(id, a);
      save('art:' + id, a);
      // keep the offline store small: the newest MAX_CACHED opened articles plus every saved one
      const all = await keys('art:');
      if (all.length > MAX_CACHED) {
        const keep = new Set(saved.map(s => 'art:' + s.card.id));
        for (const k of all.slice(0, all.length - MAX_CACHED)) if (!keep.has(k) && k !== 'art:' + id) await remove(k);
      }
      return { article: a, fromCache: false };
    } catch (e) {
      if (m) return { article: m, fromCache: true }; // offline: the copy on the phone
      throw e;
    }
  }, [published, saved]);

  const isSaved = useCallback((id: string) => saved.some(s => s.card.id === id), [saved]);
  const toggleSaved = useCallback(async (card: Card) => {
    const exists = saved.some(s => s.card.id === card.id);
    const next = exists ? saved.filter(s => s.card.id !== card.id) : [{ card, savedAt: new Date().toISOString(), lang: langRef.current }, ...saved];
    setSaved(next);
    await save('saved', next);
    if (!exists) getArticle(card.id, { rev: card.rev }).catch(() => undefined); // keep a copy for offline reading
  }, [saved, getArticle]);

  const value = useMemo<Content>(() => ({
    meta, items, status, refreshing, offline, lastOk, newIds, published, refresh, markSeen, getArticle, saved, isSaved, toggleSaved,
  }), [meta, items, status, refreshing, offline, lastOk, newIds, published, refresh, markSeen, getArticle, saved, isSaved, toggleSaved]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useContent(): Content {
  const c = useContext(Ctx);
  if (!c) throw new Error('useContent outside ContentProvider');
  return c;
}
