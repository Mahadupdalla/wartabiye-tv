/* Wartabiye TV: Google AdSense Auto ads helper (website only). Loaded only when a real publisher ID is saved in
   /admin/ (data/adsense.json -> tools/build_adsense.py writes window.WARTABIYE_ADS). Google chooses the ads and where
   they go; this file never creates, moves, hides or clicks an ad. It only:
   1. loads Google's official Auto ads code when a visitor moves inside the site to a kind of page where ads are on
      (the site changes pages without reloading, so the code in <head> only covers the first page opened);
   2. puts a small "Xayeysiis" / "Advertisement" label (in the site language) above each ad shown inside the page, so
      ads are clearly separated from the news;
   3. adds a "Privacy and cookie settings" link to the footer when Google's consent message (AdSense -> Privacy &
      messaging) is active for the visitor, so a choice can be changed at any time. */
(function () {
  'use strict';
  var CFG = window.WARTABIYE_ADS;
  if (!CFG || !/^ca-pub-\d{16}$/.test(CFG.client || '')) return;
  var SRC = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=' + CFG.client;
  var INFO = /^(xayeysiimaha|xiriir|nagu-saabsan|anshaxa|saxitaannada|asturnaanta|siyaasadda-xayeysiiska|raadi|kaydsan|ilaha-xaaladda)$/;
  var SECTIONS = /^(soomaaliya|caalamka|ciyaaraha|bariga-afrika|wararka-tooska|muuqaal|toos|ciyaaraha-toos|qayb-.+)$/;
  var TXT = {
    so: ['Xayeysiis', 'Asturnaanta iyo cookies-ka'], en: ['Advertisement', 'Privacy and cookie settings'],
    ar: ['إعلان', 'إعدادات الخصوصية وملفات تعريف الارتباط'], fr: ['Publicité', 'Paramètres de confidentialité et de cookies'],
    nl: ['Advertentie', 'Privacy- en cookie-instellingen'], it: ['Pubblicità', 'Impostazioni privacy e cookie'],
    de: ['Anzeige', 'Datenschutz- und Cookie-Einstellungen'], tr: ['Reklam', 'Gizlilik ve çerez ayarları'],
    es: ['Publicidad', 'Configuración de privacidad y cookies']
  };
  function t(i) { var l = (document.documentElement.lang || 'so').slice(0, 2); return (TXT[l] || TXT.so)[i]; }

  function kind() {
    var h = '';
    try { h = decodeURIComponent((location.hash || '').slice(1)); } catch (e) { h = (location.hash || '').slice(1); }
    if (!h && window.WARTABIYE_STORY) return 'articles';
    if (!h && window.WARTABIYE_ROUTE) h = String(window.WARTABIYE_ROUTE);
    var base = h.split('?')[0];
    if (base.indexOf('war-') === 0) return 'articles';
    if (INFO.test(base)) return 'info';
    if (SECTIONS.test(base)) return 'sections';
    return 'home';
  }
  function loaded() { return !!document.querySelector('script[src^="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js"]'); }
  function ensure() {
    if (loaded() || !CFG.pages || CFG.pages[kind()] !== true || /[?&]preview=/.test(location.search)) return;
    var s = document.createElement('script');
    s.async = true; s.src = SRC; s.crossOrigin = 'anonymous';
    document.head.appendChild(s);
  }

  // label above in-page ads only (not the anchor bar at the screen edge, side rails or full-screen ads, which Google labels itself)
  function overlay(ins) {
    if (ins.hasAttribute('data-anchor-status') || ins.hasAttribute('data-side-rail-status') || ins.hasAttribute('data-vignette-loaded')) return true;
    for (var e = ins; e && e !== document.body; e = e.parentElement) { if (getComputedStyle(e).position === 'fixed') return true; }
    return false;
  }
  function label() {
    document.querySelectorAll('ins.adsbygoogle').forEach(function (ins) {
      var prev = ins.previousElementSibling, has = prev && prev.classList.contains('adsense-label');
      var show = ins.getAttribute('data-ad-status') === 'filled' && !overlay(ins);
      if (show && !has) { var d = document.createElement('div'); d.className = 'adsense-label'; d.textContent = t(0); ins.parentNode.insertBefore(d, ins); }
      else if (has) { if (!show) prev.remove(); else if (prev.textContent !== t(0)) prev.textContent = t(0); }
    });
  }
  var queued = 0;
  function soon() { if (!queued) queued = setTimeout(function () { queued = 0; label(); }, 250); }

  // Google's consent message: the link appears only when Google's consent tool is really running for this visitor
  function consentLink() {
    var cols = document.querySelectorAll('footer .fcols .flinks'), box = cols[1] || cols[0];   // the Policies column
    if (!box) return;
    var a = document.getElementById('adChoices');
    if (!(window.googlefc && typeof window.googlefc.showRevocationMessage === 'function')) { if (a) a.hidden = true; return; }
    if (!a) {
      a = document.createElement('a'); a.id = 'adChoices'; a.href = '#asturnaanta';
      a.addEventListener('click', function (e) { e.preventDefault(); window.googlefc.callbackQueue = window.googlefc.callbackQueue || []; window.googlefc.callbackQueue.push(window.googlefc.showRevocationMessage); });
      box.appendChild(a);
    }
    a.hidden = false; a.textContent = t(1);
  }

  function start() {
    ensure(); label(); consentLink();
    new MutationObserver(soon).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-ad-status'] });
    new MutationObserver(function () { label(); consentLink(); }).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
    window.addEventListener('hashchange', ensure);
    [2000, 6000, 15000].forEach(function (ms) { setTimeout(consentLink, ms); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
