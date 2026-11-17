/*! © 2026 Wartabiye TV. All Rights Reserved. This code, design, text and branding are the property of Wartabiye TV; copying, reuse or redistribution without written permission is prohibited. */
/* Wartabiye TV · content protection (light deterrent, not DRM).
   Makes casual copying of the site's articles, photos and branding harder, without touching the design or anything a
   visitor legitimately does. Selection itself is turned off in assets/site.css ("content protection").

   Protected: article text, headlines, cards, photos, logo, footer (everything that is not a form field).
   Never touched: input / textarea / select / contenteditable (typing, selecting, copy and paste all work), the
   search box, forms, the language switcher, links (right-click "open in new tab" still works on text links),
   keyboard navigation, scrolling, zoom, screen readers, browser translation, printing, the "Copy link" buttons
   (they use the clipboard API, not the copy event), embedded YouTube players (other origin), /admin/ and /app/.

   Opt out for one element: add the attribute data-allow-copy (it and everything inside can be selected and copied).
   Anyone who really wants a copy can still get one (view source, developer tools, screenshots, reader mode,
   disabling JavaScript): this only stops the easy, accidental ways. */
(function () {
  'use strict';
  var d = document;
  var FIELD = 'input, textarea, select, option, [contenteditable]:not([contenteditable="false"]), [data-allow-copy]';

  function elOf(t) { return t && t.nodeType === 1 ? t : t && t.parentElement || null; }
  function isField(t) { var e = elOf(t); return !!(e && e.closest && e.closest(FIELD)); }
  function isMedia(t) { var e = elOf(t); return !!(e && e.closest && e.closest('img, picture, video, canvas')); }

  // copy / cut (Ctrl+C, Cmd+C, Ctrl+X, the Edit menu, the touch "Copy" bubble): blocked only for page content.
  // A selection inside a form field, or the focused field itself, is always allowed.
  function guardCopy(e) {
    if (isField(e.target) || isField(d.activeElement)) return;
    var s = window.getSelection && window.getSelection();
    if (s && s.rangeCount && isField(s.getRangeAt(0).commonAncestorContainer)) return;
    e.preventDefault();
  }
  d.addEventListener('copy', guardCopy, true);
  d.addEventListener('cut', guardCopy, true);

  // right-click (and the long-press menu on Android): blocked on photos and page content; kept on form fields and on
  // text links, so "open in new tab", "copy link address" and spell-check suggestions still work.
  d.addEventListener('contextmenu', function (e) {
    if (isField(e.target)) return;
    var e2 = elOf(e.target);
    if (!isMedia(e.target) && e2 && e2.closest && e2.closest('a[href]')) return;
    e.preventDefault();
  }, true);

  // dragging a photo to the desktop or to another tab (links and text fields can still be dragged).
  d.addEventListener('dragstart', function (e) {
    if (isField(e.target)) return;
    var e2 = elOf(e.target);
    if (e2 && e2.tagName === 'IMG') e.preventDefault();
  }, true);
})();
