/* Wartabiye TV service worker: ONLY shows push notifications and opens the story when one is tapped.
   It does not cache or change any page (no fetch handler), so the site always loads fresh from GitHub Pages.
   Registered only after a visitor turns notifications on (assets/notify.js). */
self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (e) { e.waitUntil(self.clients.claim()); });

var SITE = new URL('./', self.registration.scope).href;
function sameSite(u) { try { var x = new URL(u, SITE); return x.origin === new URL(SITE).origin ? x.href : SITE; } catch (e) { return SITE; } }

self.addEventListener('push', function (e) {
  var d = {};
  try { d = e.data ? e.data.json() : {}; } catch (err) { d = {}; }
  if (!d.title) return; // never show an empty or made-up notification
  var opts = {
    body: d.body || '', icon: d.icon || 'img/icon-192.png', badge: 'img/icon-192.png', tag: d.tag || d.id || 'wartabiye',
    data: { url: sameSite(d.url || SITE) }, lang: d.lang || 'so', dir: d.lang === 'ar' ? 'rtl' : 'auto', requireInteraction: !!d.urgent, renotify: false
  };
  if (d.image) opts.image = d.image;
  e.waitUntil(self.registration.showNotification(d.title, opts));
});

self.addEventListener('notificationclick', function (e) {
  e.notification.close();
  var url = (e.notification.data && e.notification.data.url) || SITE;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (list) {
    for (var i = 0; i < list.length; i++) { if (list[i].url === url && 'focus' in list[i]) return list[i].focus(); }
    return self.clients.openWindow(url);
  }));
});
