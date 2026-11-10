import { Platform } from 'react-native';
import { APP_VERSION, STATS_ENDPOINT } from './config';

// Anonymous page views for the owner's existing statistics (/admin/ -> Analytics), the same message the website's
// assets/stats.js sends: the page path, the language and the category. No name, no device id, nothing stored here.
// The native app identifies itself with its own User-Agent ("WartabiyeTV-App/<version> (android|ios; ...)") so its visits
// show under source "Wartabiye TV app"; the web app marks its first view with "app-pwa". Off in Settings = nothing is sent.
let first = true;
let last = '';
export function trackView(enabled: boolean, path: string, lang: string, category?: string) {
  if (!enabled || path === last) return;
  if (Platform.OS === 'web' && typeof navigator !== 'undefined' && (navigator as any).webdriver) return; // automated tests
  last = path;
  const body: Record<string, unknown> = { p: path.toLowerCase().slice(0, 150), l: lang };
  if (category) body.c = category;
  if (first) { body.e = 1; if (Platform.OS === 'web') body.u = 'app-pwa'; }
  first = false;
  const headers: Record<string, string> = { 'Content-Type': 'text/plain' };
  if (Platform.OS !== 'web') headers['User-Agent'] = `WartabiyeTV-App/${APP_VERSION} (${Platform.OS === 'ios' ? 'ios; iPhone' : 'android; Mobile'})`;
  fetch(STATS_ENDPOINT, { method: 'POST', body: JSON.stringify(body), headers, credentials: 'omit' } as RequestInit).catch(() => undefined);
}
