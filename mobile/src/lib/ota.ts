import { useEffect, useRef } from 'react';
import { AppState, Platform } from 'react-native';
import * as Updates from 'expo-updates';
import { load, save } from './storage';

// Over-the-air updates (only in builds where expo-updates is switched on: the iPhone app installed from Xcode, see
// app.config.js). The native side already checks once when the app starts. This adds:
//  - a check whenever the app comes back to the screen (at most every 15 minutes); a newer compatible update is
//    downloaded in the background and never interrupts reading;
//  - a downloaded update is switched on at the next start, or when the app comes back after at least 10 minutes away
//    (the reader is not in the middle of something then). Saved articles and settings are kept: they are on the phone.
//  - monitoring: the time and result of the last check and the last error are kept on the phone and shown in
//    Settings → App updates, with expo-updates' own error log; each check also writes one "[WTV] ota" log line.
// Only JavaScript and images travel this way. Native code, the icon, permissions and signing need a new Xcode build.
const CHECK_EVERY_MS = 15 * 60_000;
const RETRY_MS = [45_000, 3 * 60_000, 10 * 60_000];
const APPLY_AFTER_AWAY_MS = 10 * 60_000;

export interface OtaStatus {
  lastCheck?: string;          // ISO time of the last finished check
  result?: 'none' | 'downloaded' | 'error';
  downloaded?: string;         // id of an update waiting for the next start
  lastError?: string;
  lastErrorAt?: string;
}

let status: OtaStatus = {};
const listeners = new Set<(s: OtaStatus) => void>();
function set(next: OtaStatus) {
  status = { ...status, ...next };
  save('ota', status);
  listeners.forEach(f => f(status));
}
export function otaStatus(): OtaStatus { return status; }
export function onOtaStatus(f: (s: OtaStatus) => void): () => void { listeners.add(f); return () => { listeners.delete(f); }; }

/** One check: ask Expo's update service, download a newer compatible update, record what happened */
export async function checkOta(): Promise<OtaStatus> {
  try {
    const r = await Updates.checkForUpdateAsync();
    let downloaded: string | undefined;
    if (r.isAvailable) {
      const f = await Updates.fetchUpdateAsync();
      if (f.isNew) downloaded = (f.manifest as { id?: string } | undefined)?.id || 'new';
    }
    set({ lastCheck: new Date().toISOString(), result: downloaded ? 'downloaded' : status.downloaded ? 'downloaded' : 'none', ...(downloaded ? { downloaded } : {}) });
    console.log(`[WTV] ota running=${Updates.updateId || 'embedded'} available=${r.isAvailable} downloaded=${status.downloaded || '-'}`);
  } catch (e) {
    const msg = String((e as Error)?.message || e).slice(0, 300);
    set({ lastCheck: new Date().toISOString(), result: 'error', lastError: msg, lastErrorAt: new Date().toISOString() });
    console.log('[WTV] ota check failed: ' + msg);
  }
  return status;
}

export function useOtaUpdates() {
  const lastCheck = useRef(0);
  const leftAt = useRef(0);
  useEffect(() => {
    if (Platform.OS === 'web' || !Updates.isEnabled) return;
    load<OtaStatus>('ota', {}).then(s => {
      // a downloaded update that is now running is no longer "waiting"
      const running = Updates.updateId || '';
      status = { ...(s || {}), ...status };
      if (status.downloaded && (status.downloaded === running || status.downloaded === 'new')) delete status.downloaded;
      if (Updates.isEmergencyLaunch) {
        set({ result: 'error', lastError: 'Emergency launch: ' + (Updates.emergencyLaunchReason || 'the newest update could not start'), lastErrorAt: new Date().toISOString() });
      } else listeners.forEach(f => f(status));
    });
    // a download cut off by a weak connection is tried again soon (after 45 s, 3 and 10 minutes) instead of waiting
    // for the next 15-minute check; files that already arrived are kept, so each try only fetches what is missing
    let retry: ReturnType<typeof setTimeout> | undefined;
    let tries = 0;
    const run = () => {
      lastCheck.current = Date.now();
      checkOta().then(st => {
        if (st.result !== 'error') { tries = 0; return; }
        if (tries >= RETRY_MS.length) return;
        clearTimeout(retry);
        retry = setTimeout(() => { if (AppState.currentState === 'active') run(); }, RETRY_MS[tries++]);
      });
    };
    const check = () => {
      if (Date.now() - lastCheck.current < CHECK_EVERY_MS) return;
      run();
    };
    const sub = AppState.addEventListener('change', s => {
      if (s === 'active') {
        const away = leftAt.current ? Date.now() - leftAt.current : 0;
        if (status.downloaded && away >= APPLY_AFTER_AWAY_MS) { Updates.reloadAsync().catch(() => undefined); return; }
        check();
      } else if (s === 'background') leftAt.current = Date.now();
    });
    // the native launch check runs first; this one follows a little later and records the result
    const tm = setTimeout(check, 15_000);
    return () => { sub.remove(); clearTimeout(tm); clearTimeout(retry); };
  }, []);
}
