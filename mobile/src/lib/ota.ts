import { useEffect, useRef } from 'react';
import { AppState, Platform } from 'react-native';
import * as Updates from 'expo-updates';

// Over-the-air updates (only in builds where expo-updates is switched on: the iPhone app installed from Xcode, see
// app.config.js). The native side already checks once when the app starts. This adds:
//  - a check whenever the app comes back to the screen (at most every 15 minutes); a newer compatible update is
//    downloaded in the background and never interrupts reading;
//  - a downloaded update is switched on at the next start, or when the app comes back after at least 10 minutes away
//    (the reader is not in the middle of something then). Saved articles and settings are kept: they are on the phone.
// Only JavaScript and images travel this way. Native code, the icon, permissions and signing need a new Xcode build.
const CHECK_EVERY_MS = 15 * 60_000;
const APPLY_AFTER_AWAY_MS = 10 * 60_000;

export function useOtaUpdates() {
  const lastCheck = useRef(0);
  const ready = useRef(false);
  const leftAt = useRef(0);
  useEffect(() => {
    if (Platform.OS === 'web' || !Updates.isEnabled) return;
    const check = async () => {
      if (Date.now() - lastCheck.current < CHECK_EVERY_MS) return;
      lastCheck.current = Date.now();
      try {
        const r = await Updates.checkForUpdateAsync();
        if (r.isAvailable) {
          const f = await Updates.fetchUpdateAsync();
          if (f.isNew) ready.current = true;
        }
        console.log(`[WTV] ota running=${Updates.updateId || 'embedded'} available=${r.isAvailable} ready=${ready.current}`);
      } catch (e) {
        console.log('[WTV] ota check failed: ' + String((e as Error)?.message || e));
      }
    };
    const sub = AppState.addEventListener('change', s => {
      if (s === 'active') {
        const away = leftAt.current ? Date.now() - leftAt.current : 0;
        if (ready.current && away >= APPLY_AFTER_AWAY_MS) { Updates.reloadAsync().catch(() => undefined); return; }
        check();
      } else if (s === 'background') leftAt.current = Date.now();
    });
    // the native launch check runs first; this one follows a little later for the "ready" flag
    const tm = setTimeout(() => { lastCheck.current = 0; check(); }, 20_000);
    return () => { sub.remove(); clearTimeout(tm); };
  }, []);
}
