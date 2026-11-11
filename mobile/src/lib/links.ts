// Every link in the app goes through here, so Wartabiye TV content always stays inside the app:
//  * a wartabiyetv.com address (article, section, LIVE, videos, About, Contact, Privacy, ...) opens the matching app
//    screen, never Chrome or Safari
//  * mailto: / tel: open the phone's mail or phone app
//  * other websites (a news source, a photo credit, an advertiser) open in the app's own browser screen, with a Back
//    button to return to the story
// The admin (/admin/ and the admin Worker) is never opened from the public app.
import { Linking, Platform } from 'react-native';
import { router, type Href } from 'expo-router';

import { appPathForUrl } from './linkmap';
export { PAGES, appPathFor, appPathForUrl, isInternal, type PageSlug } from './linkmap';

/** Open any link the way described at the top of this file */
export function openLink(url: string, opts: { replace?: boolean } = {}): void {
  const u = String(url || '').trim();
  if (!u) return;
  const inApp = appPathForUrl(u);
  if (inApp) {
    console.log('[WTV] link in app ' + inApp);
    if (opts.replace) router.replace(inApp as Href);
    else router.push(inApp as Href);
    return;
  }
  if (/^(mailto|tel|sms):/i.test(u)) { Linking.openURL(u).catch(() => undefined); return; }
  if (/^https?:\/\//i.test(u)) {
    if (/^https?:\/\/[^/]*wartabiye-admin\./i.test(u)) return; // the admin is not reachable from the public app
    if (Platform.OS === 'web') { if (typeof window !== 'undefined') window.open(u, '_blank', 'noopener'); return; }
    router.push({ pathname: '/browser', params: { url: u } });
  }
}
