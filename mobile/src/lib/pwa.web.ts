// Installable web app (PWA) at https://www.wartabiyetv.com/app/: its own service worker (scope /app/ only, so the
// website's sw.js and pages are not touched) keeps the app shell and the last news for offline reading.
export function registerPwa() {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator) || (navigator as any).webdriver) return;
  if (!/^https:$/.test(location.protocol) && location.hostname !== 'localhost') return;
  const base = (document.querySelector('link[rel="manifest"]')?.getAttribute('href') || '/app/manifest.webmanifest').replace(/manifest\.webmanifest$/, '');
  navigator.serviceWorker.register(base + 'sw.js', { scope: base }).catch(() => undefined);
}
