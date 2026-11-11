/* Wartabiye TV web app service worker. Scope /app/ ONLY: the website's own pages and its sw.js are not touched.
   - the app's files (/app/...) are kept so the app opens without a connection;
   - the news (api/v1, data/*.json) is always fetched fresh first and the last copy is used only when offline;
   - article photos are kept after they were seen (at most 300), for offline reading;
   - push: the same browser notifications as the website's bell; a tap opens the article inside the app. */
const SHELL = 'wtv-app-shell-4bbb72c68e';
const DATA = 'wtv-app-data';
const IMG = 'wtv-app-img';
self.addEventListener('install', e => {
  e.waitUntil(caches.open(SHELL).then(c => c.addAll(['./', './manifest.webmanifest'])).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('wtv-app-shell-') && k !== SHELL).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
async function trim(name, max) { const c = await caches.open(name); const ks = await c.keys(); for (let i = 0; i < ks.length - max; i++) await c.delete(ks[i]); }
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  if (u.pathname.startsWith('/api/v1/') || /^\/data\/[\w./-]+\.json$/.test(u.pathname)) {
    const key = u.origin + u.pathname;   // one copy per file, whatever the cache-busting query
    e.respondWith(fetch(e.request).then(r => { if (r.ok) { const cl = r.clone(); caches.open(DATA).then(c => c.put(key, cl)); } return r; })
      .catch(() => caches.match(key).then(m => m || Response.error())));
    return;
  }
  if (u.pathname.startsWith('/img/')) {
    e.respondWith(caches.match(e.request).then(m => m || fetch(e.request).then(r => { if (r.ok) { const cl = r.clone(); caches.open(IMG).then(c => c.put(e.request, cl)).then(() => trim(IMG, 300)); } return r; })));
    return;
  }
  if (u.pathname.startsWith('/app/')) {
    const nav = e.request.mode === 'navigate';
    e.respondWith(fetch(e.request).then(r => { if (r.ok && !nav) { const cl = r.clone(); caches.open(SHELL).then(c => c.put(e.request, cl)); } return r; })
      .catch(() => caches.match(nav ? './' : e.request).then(m => m || caches.match('./')).then(m => m || Response.error())));
  }
});
self.addEventListener('push', e => {
  let d = {}; try { d = e.data ? e.data.json() : {}; } catch (err) { d = {}; }
  if (!d.title) return;
  e.waitUntil(self.registration.showNotification(d.title, { body: d.body || '', icon: 'pwa-192.png', badge: 'pwa-192.png', tag: d.tag || d.id || 'wartabiye', data: { url: d.url || '' }, lang: d.lang || 'so', dir: d.lang === 'ar' ? 'rtl' : 'auto' }));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const m = String((e.notification.data && e.notification.data.url) || '').match(/\/war\/([A-Za-z0-9_.-]+?)(\.html)?$/);
  const target = new URL(m ? 'war/' + m[1] : './', self.registration.scope).href;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(cs => {
    for (const c of cs) if (c.url.startsWith(self.registration.scope) && 'navigate' in c) return c.navigate(target).then(w => w && w.focus());
    return self.clients.openWindow(target);
  }));
});
