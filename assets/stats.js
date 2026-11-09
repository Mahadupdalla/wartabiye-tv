/* Wartabiye TV visitor statistics (privacy-friendly, no cookies).
   Sends one small anonymous message per page opened to our own counter (Cloudflare Worker): the page address,
   the site language, and where the visit came from (e.g. "google.com"). Nothing else: no name, no IP stored,
   no advertising or cross-site tracking. Only if the visitor presses "Allow" does this browser remember the day of its
   first visit (localStorage "wtv-stats-first"), so that "returning visitors" can be counted. Owner previews
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

  // consent only for remembering this device (returning visitors); counting itself stores nothing on the device
  var today = new Date().toISOString().slice(0, 10);
  var gpc = navigator.globalPrivacyControl === true || navigator.doNotTrack === '1';
  function consent() { var c = get('wtv-stats-consent'); return c === 'yes' ? true : c === 'no' || gpc ? false : null; }
  function retFlag() {
    if (consent() !== true) return undefined;
    var f = get('wtv-stats-first');
    if (!f) { set('wtv-stats-first', today); return 0; }
    return f < today ? 1 : 0;
  }

  var first = true, last = '', utm = P.get('utm_source') || '';
  function send(path, cat) {
    var body = { p: path, l: (document.documentElement.lang || '').slice(0, 2) };
    if (ST) body.t = ST;
    if (cat) body.c = cat;
    if (first) { body.e = 1; body.r = document.referrer || ''; if (utm) body.u = utm.slice(0, 40); }
    var r = retFlag(); if (r !== undefined) body.n = r;
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

  // ---- small privacy notice (once): Allow / No thanks ------------------------------------------------------------
  var T = {
    so: ['Wartabiye TV waxay booqashooyinka u tirisaa si qarsoodi ah, cookies la’aan. Ma noo oggolaanaysaa inaan xasuusanno qalabkan si aan u ogaanno akhristayaasha soo noqda?', 'Oggolow', 'Maya, mahadsanid', 'Asturnaanta'],
    en: ['Wartabiye TV counts visits anonymously, without cookies. May we remember this device to count returning readers?', 'Allow', 'No thanks', 'Privacy'],
    ar: ['يحصي موقع وارتابيي TV الزيارات بشكل مجهول ودون ملفات تعريف الارتباط. هل تسمح لنا بتذكّر هذا الجهاز لإحصاء القرّاء العائدين؟', 'السماح', 'لا، شكرًا', 'الخصوصية'],
    fr: ['Wartabiye TV compte les visites de façon anonyme, sans cookies. Pouvons-nous mémoriser cet appareil pour compter les lecteurs qui reviennent ?', 'Autoriser', 'Non merci', 'Confidentialité'],
    nl: ['Wartabiye TV telt bezoeken anoniem, zonder cookies. Mogen we dit apparaat onthouden om terugkerende lezers te tellen?', 'Toestaan', 'Nee, bedankt', 'Privacy'],
    it: ['Wartabiye TV conta le visite in modo anonimo, senza cookie. Possiamo ricordare questo dispositivo per contare i lettori che ritornano?', 'Consenti', 'No, grazie', 'Privacy'],
    de: ['Wartabiye TV zählt Besuche anonym und ohne Cookies. Dürfen wir uns dieses Gerät merken, um wiederkehrende Leser zu zählen?', 'Erlauben', 'Nein, danke', 'Datenschutz'],
    tr: ['Wartabiye TV ziyaretleri çerez kullanmadan, anonim olarak sayar. Geri dönen okuyucuları sayabilmek için bu cihazı hatırlamamıza izin verir misiniz?', 'İzin ver', 'Hayır, teşekkürler', 'Gizlilik'],
    es: ['Wartabiye TV cuenta las visitas de forma anónima, sin cookies. ¿Podemos recordar este dispositivo para contar a los lectores que vuelven?', 'Permitir', 'No, gracias', 'Privacidad'],
  };
  function notice() {
    if (consent() !== null || document.getElementById('wtvConsent')) return;
    var L = (document.documentElement.lang || 'so').slice(0, 2), t = T[L] || T.so;
    var box = document.createElement('div'); box.id = 'wtvConsent'; box.className = 'wtv-consent'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-label', t[3]);
    box.dir = L === 'ar' ? 'rtl' : 'ltr';
    var p = document.createElement('p'); p.textContent = t[0] + ' ';
    var a = document.createElement('a'); a.href = 'asturnaanta/'; a.textContent = t[3]; p.append(a);
    var row = document.createElement('div'); row.className = 'wtv-consent-row';
    function btn(txt, val, cls) { var b = document.createElement('button'); b.type = 'button'; b.className = cls; b.textContent = txt; b.addEventListener('click', function () { set('wtv-stats-consent', val); if (val === 'no') set('wtv-stats-first', null); box.remove(); }); return b; }
    row.append(btn(t[2], 'no', 'wtv-c-no'), btn(t[1], 'yes', 'wtv-c-yes'));
    box.append(p, row); document.body.append(box);
  }
  setTimeout(notice, 2500);
  window.WTV_STATS = { reset: function () { set('wtv-stats-consent', null); set('wtv-stats-first', null); notice(); } };
})();
