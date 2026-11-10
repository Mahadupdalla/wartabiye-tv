import { Platform } from 'react-native';
import Constants from 'expo-constants';

// Where the app reads its content: the PUBLIC Wartabiye TV website (GitHub Pages). The app never talks to /admin/,
// never holds a GitHub token, API key or publishing permission, and only reads public JSON files.
const DEFAULT_SITE = 'https://www.wartabiyetv.com/';

function siteBase(): string {
  // the installable web app is served from the website itself (/app/): read the files from the same site
  if (Platform.OS === 'web' && typeof location !== 'undefined' && (/(^|\.)wartabiyetv\.com$/.test(location.hostname) || location.pathname.startsWith('/app/') || location.pathname === '/app')) {
    return location.origin + '/';
  }
  // for tests and previews only (EXPO_PUBLIC_CONTENT_BASE=http://localhost:8080/ or a GitHub raw URL); never a secret
  const env = process.env.EXPO_PUBLIC_CONTENT_BASE;
  if (env && /^https?:\/\//.test(env)) return env.endsWith('/') ? env : env + '/';
  return DEFAULT_SITE;
}

export const SITE = DEFAULT_SITE;            // canonical public links (sharing, "open on the website")
export const CONTENT_BASE = siteBase();      // where JSON and images are read from
export const API = CONTENT_BASE + 'api/v1/';
// anonymous page-view counter of the existing admin (same endpoint as the website's assets/stats.js)
export const STATS_ENDPOINT = 'https://wartabiye-admin.wartabiye.workers.dev/c';
export const APP_VERSION = Constants.expoConfig?.version ?? '1.0.0';
export const EAS_PROJECT_ID: string | undefined =
  (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId || undefined;

// refresh rhythm: a tiny meta.json check; the feed itself is downloaded only when its version changed
const testPoll = Number(process.env.EXPO_PUBLIC_POLL_MS || 0); // automated sync tests only (never below 5 s)
export const META_POLL_MS = testPoll >= 5000 ? testPoll : 60_000;
export const LIVE_POLL_MS = testPoll >= 5000 ? testPoll : 30_000;
export const BREAKING_MS = 12 * 3600_000;   // same as the website: "breaking" is shown for 12 hours
export const LIVE_WINDOW_MS = 24 * 3600_000;

export function abs(u: string | undefined | null): string | null {
  if (!u) return null;
  if (/^https:\/\//.test(u)) return u;
  if (/^img\//.test(u)) return CONTENT_BASE + u;
  return null;
}
export function articleUrl(id: string): string {
  return SITE + 'war/' + encodeURIComponent(id) + '.html';
}
