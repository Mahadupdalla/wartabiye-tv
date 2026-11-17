/*! © 2026 Wartabiye TV. All Rights Reserved. This code, design, text and branding are the property of Wartabiye TV; copying, reuse or redistribution without written permission is prohibited. */
/* Wartabiye TV · photo protection (light deterrent, not DRM).
   Readers can select, copy and paste text normally. Only the site's photos are protected: no right-click / long-press
   "Save image" menu on a photo and no dragging a photo out of the page (see also "photo protection" in assets/site.css).
   Not touched: text, links, forms, search, keyboard shortcuts, scrolling, zoom, screen readers, printing, YouTube
   players, /admin/ and /app/. Anyone determined can still save a photo (screenshots, developer tools). */
(function () {
  'use strict';
  function photo(t) {
    var e = t && t.nodeType === 1 ? t : t && t.parentElement;
    return !!(e && e.closest && e.closest('img, picture, video, canvas'));
  }
  document.addEventListener('contextmenu', function (e) { if (photo(e.target)) e.preventDefault(); }, true);
  document.addEventListener('dragstart', function (e) { if (photo(e.target)) e.preventDefault(); }, true);
})();
