import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import * as Application from 'expo-application';
import { fetchAlerts, type AlertItem } from './api';
import { load, save } from './storage';
import { useContent } from './content';
import { useSettings, type NotifPrefs } from './settings';
import type { Card } from './types';

// The in-app notification center: the same alerts as the website's bell (data/notifications.json, written by the
// publish workflow), with "new" marks kept on this phone. It is read whenever the website publishes (meta.version
// changes) and when the app comes back to the screen. It works the same with or without push notifications.

/** The iPhone app installed from Xcode with a free Apple account carries a different bundle id
 *  (com.wartabiyetv.app.personal, see IPHONE-FREE-INSTALL.md). Apple gives such apps no push notifications. */
export const STORE_BUNDLE_ID = 'com.wartabiyetv.app';
export function isFreeAppleBuild(): boolean {
  if (Platform.OS !== 'ios') return false;
  const id = Application.applicationId || '';
  return !!id && id !== STORE_BUNDLE_ID;
}

export type AlertKind = 'breaking' | 'eastAfrica' | 'world' | 'sports';
export function kindOf(a: Pick<AlertItem, 'kind'>): AlertKind {
  return a.kind === 'breaking' ? 'breaking' : a.kind === 'sports' ? 'sports' : a.kind === 'world' ? 'world' : 'eastAfrica';
}

/** One entry per story: the same id, or the same link, is shown once (newest first) */
export function dedupeAlerts(list: AlertItem[]): AlertItem[] {
  const ids = new Set<string>();
  const urls = new Set<string>();
  const out: AlertItem[] = [];
  for (const a of [...list].sort((x, y) => (x.time < y.time ? 1 : x.time > y.time ? -1 : 0))) {
    if (!a || !a.id || !a.title) continue;
    const u = String(a.url || '').replace(/^https?:\/\/[^/]+/, '').replace(/\.html$/, '').replace(/\/+$/, '');
    if (ids.has(a.id) || (u && urls.has(u))) continue;
    ids.add(a.id);
    if (u) urls.add(u);
    out.push(a);
  }
  return out;
}

/** The article id behind an alert link (/war/<id> or /war/<id>.html), if it is one */
export function articleIdOf(url: string): string | null {
  const m = String(url || '').replace(/^https?:\/\/[^/]+/, '').match(/^\/?war\/([A-Za-z0-9_.-]+?)(?:\.html)?\/?$/);
  return m ? m[1] : null;
}

interface Alerts {
  alerts: AlertItem[] | null;       // null while the first load runs
  failed: boolean;
  unread: number;
  isRead(id: string): boolean;
  markRead(id: string): void;
  markAllRead(): void;
  refresh(): Promise<void>;
  /** a breaking story that arrived while the app was open, for the in-app banner (null when none) */
  fresh: Card | null;
  dismissFresh(): void;
}

const Ctx = createContext<Alerts | null>(null);
const MAX_READ = 400;

export function wanted(p: NotifPrefs, k: AlertKind): boolean {
  return !!p[k];
}

export function AlertsProvider({ children }: { children: React.ReactNode }) {
  const { ready, notif } = useSettings();
  const { meta, items, newIds } = useContent();
  const [alerts, setAlerts] = useState<AlertItem[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [read, setRead] = useState<string[] | null>(null);
  const [fresh, setFresh] = useState<Card | null>(null);
  const shownFresh = useRef(new Set<string>());

  useEffect(() => { load<string[]>('alertsRead', []).then(r => setRead(Array.isArray(r) ? r : [])); }, []);

  const refresh = useCallback(async () => {
    try {
      const list = dedupeAlerts(await fetchAlerts());
      setAlerts(list);
      setFailed(false);
      save('alerts', list);
    } catch (e) {
      // offline: the last list the phone has
      const cached = await load<AlertItem[] | null>('alerts', null);
      setAlerts(prev => prev || cached || []);
      setFailed(true);
    }
  }, []);

  // first load (the stored list at once), then every time the website publishes something new
  useEffect(() => { load<AlertItem[] | null>('alerts', null).then(c => { if (c) setAlerts(prev => prev || c); }); }, []);
  useEffect(() => { if (ready) refresh(); }, [ready, meta?.version, refresh]);
  useEffect(() => {
    const sub = AppState.addEventListener('change', s => { if (s === 'active') refresh(); });
    return () => sub.remove();
  }, [refresh]);

  // the first time alerts are read on this phone, the old ones count as read: only what arrives later is "new"
  useEffect(() => {
    if (read && alerts && read.length === 0 && alerts.length) {
      load<boolean>('alertsBaseline', false).then(done => {
        if (done) return;
        const ids = alerts.map(a => a.id);
        setRead(ids); save('alertsRead', ids); save('alertsBaseline', true);
      });
    }
  }, [read, alerts]);

  const persist = useCallback((next: string[]) => {
    const cut = next.slice(-MAX_READ);
    setRead(cut);
    save('alertsRead', cut);
    save('alertsBaseline', true);
  }, []);
  const readSet = useMemo(() => new Set(read || []), [read]);
  const isRead = useCallback((id: string) => readSet.has(id), [readSet]);
  const markRead = useCallback((id: string) => { if (!readSet.has(id)) persist([...(read || []), id]); }, [read, readSet, persist]);
  const markAllRead = useCallback(() => {
    if (!alerts) return;
    persist([...new Set([...(read || []), ...alerts.map(a => a.id)])]);
  }, [alerts, read, persist]);
  const unread = useMemo(() => (alerts && read ? alerts.filter(a => !readSet.has(a.id) && wanted(notif, kindOf(a))).length : 0), [alerts, read, readSet, notif]);

  // in-app breaking banner: a story marked "breaking" that the website published while the app was open
  useEffect(() => {
    if (!notif.inApp || !notif.breaking || !newIds.length) return;
    const c = items.find(x => newIds.includes(x.id) && x.breaking && !x.sponsored && !shownFresh.current.has(x.id));
    if (c) { shownFresh.current.add(c.id); setFresh(c); }
  }, [newIds, items, notif.inApp, notif.breaking]);
  const dismissFresh = useCallback(() => setFresh(null), []);

  const value = useMemo<Alerts>(() => ({ alerts, failed, unread, isRead, markRead, markAllRead, refresh, fresh, dismissFresh }),
    [alerts, failed, unread, isRead, markRead, markAllRead, refresh, fresh, dismissFresh]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAlerts(): Alerts {
  const c = useContext(Ctx);
  if (!c) throw new Error('useAlerts outside AlertsProvider');
  return c;
}
