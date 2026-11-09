/* Wartabiye TV visitor statistics (privacy-friendly, no cookies).
   Sends one small anonymous message per page opened to our own counter (Cloudflare Worker): the page address,
   the site language, and where the visit came from (e.g. "google.com"). Nothing else: no name, no IP stored,
   no advertising or cross-site tracking. Nothing is stored on the visitor's device and no question is asked. Owner previews
   (?preview=), automated browsers and visitors who opt out (?notrack=1) are not counted. */
(function () {
  'use strict';
  var me = document.currentScript;
  var END = me && me.getAttribute('data-endpoint');
  if (!END || !/^(https:\/\/|http:\/\/(localhost|127\.0\.0\.1):)/.test(END)) return;   // http only for a local test
  END = END.replace(/\/+$/, '') + '/c';
  var P = new URLSearchParams(location.search);
  function get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function set(k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) {} }
  if (P.get('notrack') === '1') set('wtv-notrack', '1');
  if (P.get('notrack') === '0') set('wtv-notrack', null);
  // ?wtvselftest=<one-time token>: the deploy check (admin-deploy.yml) in an automated browser; counted apart and deleted
  var ST = /^[a-f0-9]{32}$/.test(P.get('wtvselftest') || '') ? P.get('wtvselftest') : '';
  if (P.has('preview') || get('wtv-notrack') === '1' || (navigator.webdriver && !ST)) return;

  var PAGES = /^(ciyaaraha|caalamka|bariga-afrika|wararka-tooska|muuqaal|toos|ciyaaraha-toos|raadi|kaydsan|xiriir|xayeysiimaha|ilaha-xaaladda|nagu-saabsan|anshaxa|saxitaannada|asturnaanta|siyaasadda-xayeysiiska)$/;
  function pathNow() {
    var h = '';
    try { h = decodeURIComponent((location.hash || '').slice(1)); } catch (e) { h = (location.hash || '').slice(1); }
    if (!h && window.WARTABIYE_STORY) h = 'war-' + window.WARTABIYE_STORY;
    if (!h && window.WARTABIYE_ROUTE) h = window.WARTABIYE_ROUTE;
    var base = h.split('?')[0].toLowerCase();
    if (base.indexOf('war-') === 0) return { p: '/war/' + base.slice(4).replace(/[^a-z0-9-]/g, '').slice(0, 140), story: base.slice(4) };
    if (base.indexOf('qayb-') === 0) return { p: '/qayb/' + base.slice(5).replace(/[^a-z0-9-]/g, '').slice(0, 60) };
    if (PAGES.test(base)) return { p: '/' + base };
    return { p: '/' };
  }

  var first = true, last = '', utm = P.get('utm_source') || '';
  function send(path, cat) {
    var body = { p: path, l: (document.documentElement.lang || '').slice(0, 2) };
    if (ST) body.t = ST;
    if (cat) body.c = cat;
    if (first) { body.e = 1; body.r = document.referrer || ''; if (utm) body.u = utm.slice(0, 40); }
    first = false;
    var data = JSON.stringify(body);
    try {
      if (navigator.sendBeacon && navigator.sendBeacon(END, new Blob([data], { type: 'text/plain' }))) return;
    } catch (e) {}
    try { fetch(END, { method: 'POST', body: data, mode: 'no-cors', keepalive: true, credentials: 'omit', headers: { 'content-type': 'text/plain' } }); } catch (e) {}
  }

  var pendingStory = null, storyTimer = 0, lastView = null;
  addEventListener('wt:view', function (e) {
    var d = e.detail || {};
    lastView = { id: String(d.id || '').toLowerCase(), category: d.category || '', preview: !!d.preview };
    if (d.preview) { pendingStory = null; clearTimeout(storyTimer); return; }
    if (pendingStory && d.id && String(d.id).toLowerCase() === pendingStory.story) { clearTimeout(storyTimer); var ps = pendingStory; pendingStory = null; send(ps.p, d.category || ''); }
  });
  function track() {
    var x = pathNow();
    if (x.p === last) return;
    last = x.p;
    clearTimeout(storyTimer); pendingStory = null;
    if (x.story && lastView && lastView.id === x.story) {
      // the article was already shown (the page's own hashchange handler ran first)
      if (!lastView.preview) send(x.p, lastView.category);
    } else if (x.story) {
      // wait (max 4 s) for the article to be shown, to record its category; send without it otherwise
      pendingStory = x;
      storyTimer = setTimeout(function () { if (pendingStory === x) { pendingStory = null; send(x.p, ''); } }, 4000);
    } else send(x.p, '');
  }
  addEventListener('hashchange', track);
  if (document.readyState === 'loading') addEventListener('DOMContentLoaded', track); else track();

  // no notice and nothing stored on the device; remove what an earlier version stored after "Allow"
  set('wtv-stats-consent', null); set('wtv-stats-first', null);
})();
