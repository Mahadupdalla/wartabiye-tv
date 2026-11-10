// Wartabiye TV admin dashboard. Everything shown here comes from this Worker's owner-only API: real visits counted
// on the public website (never estimated or invented), GitHub Actions runs, and the security log.
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var NF = new Intl.NumberFormat('en-US');
  var n = function (x) { return NF.format(Math.round(x || 0)); };
  var SITE = 'https://www.wartabiyetv.com/';
  var ME = null, current = null, timers = [];
  var REGION = (function () { try { return new Intl.DisplayNames(['en'], { type: 'region' }); } catch (e) { return null; } })();
  var LANGN = (function () { try { return new Intl.DisplayNames(['en'], { type: 'language' }); } catch (e) { return null; } })();

  // ---- tiny DOM helper: strings always go in as text, never as HTML ----
  function h(tag, attrs) {
    var e = document.createElement(tag);
    if (attrs) for (var k in attrs) {
      var v = attrs[k];
      if (v == null || v === false) continue;
      if (k === 'class') e.className = v; else if (k === 'text') e.textContent = v; else if (k === 'html') e.innerHTML = v;
      else if (k.slice(0, 2) === 'on') e.addEventListener(k.slice(2), v); else e.setAttribute(k, v === true ? '' : v);
    }
    for (var i = 2; i < arguments.length; i++) { var c = arguments[i]; if (c == null || c === false) continue; if (Array.isArray(c)) c.forEach(function (x) { if (x != null) e.append(x); }); else e.append(c); }
    return e;
  }
  var ICONS = {
    users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/>',
    eye: '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z"/><circle cx="12" cy="12" r="3"/>',
    layers: '<path d="m12 2 10 5-10 5L2 7z"/><path d="m2 17 10 5 10-5M2 12l10 5 10-5"/>',
    repeat: '<path d="m17 1 4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14M7 23l-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>',
    pulse: '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>',
    cal: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
    info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>',
    warn: '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>',
    chart: '<path d="M3 3v18h18"/><path d="m7 14 4-4 3 3 5-6"/>',
    refresh: '<path d="M23 4v6h-6M1 20v-6h6"/><path d="M3.5 9a9 9 0 0 1 14.9-3.4L23 10M1 14l4.6 4.4A9 9 0 0 0 20.5 15"/>',
    check: '<path d="M20 6 9 17l-5-5"/>', x: '<path d="M18 6 6 18M6 6l12 12"/>', clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
    file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/>', plus: '<path d="M12 5v14M5 12h14"/>',
    ext: '<path d="M14 3h7v7M21 3l-9 9"/><path d="M19 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h5"/>',
    globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z"/>',
  };
  var ic = function (k) { return '<svg viewBox="0 0 24 24" aria-hidden="true">' + (ICONS[k] || '') + '</svg>'; };
  function icon(k) { var s = document.createElement('span'); s.style.display = 'contents'; s.innerHTML = ic(k); return s.firstChild; }

  // ---- API ----
  function api(path, opt) {
    opt = opt || {};
    return fetch(path, { method: opt.method || 'GET', credentials: 'same-origin', headers: { Accept: 'application/json' } }).then(function (r) {
      if (r.status === 401) { location.href = '/login?e=expired'; throw new Error('signed out'); }
      if (!r.ok) throw new Error('The server answered ' + r.status);
      return r.json();
    });
  }
  function clearTimers() { timers.forEach(clearInterval); timers = []; }
  function every(ms, fn) { timers.push(setInterval(function () { if (!document.hidden) fn(); }, ms)); }

  // ---- tooltip ----
  var tip = $('tip');
  function showTip(ev, nodes) { tip.innerHTML = ''; nodes.forEach(function (x) { tip.append(x); }); tip.hidden = false; moveTip(ev); }
  function moveTip(ev) { var x = ev.clientX + 14, y = ev.clientY + 14, w = tip.offsetWidth, hh = tip.offsetHeight; if (x + w > innerWidth - 8) x = ev.clientX - w - 14; if (y + hh > innerHeight - 8) y = ev.clientY - hh - 14; tip.style.left = x + 'px'; tip.style.top = y + 'px'; }
  function hideTip() { tip.hidden = true; }

  // ---- charts (hand-made SVG; one measure per chart, one axis) ----
  var SVGNS = 'http://www.w3.org/2000/svg';
  function s(tag, attrs) { var e = document.createElementNS(SVGNS, tag); for (var k in attrs) e.setAttribute(k, attrs[k]); return e; }
  // axis top = 4 equal whole-number steps (1, 2, 3, 5 × 10ⁿ)
  function niceMax(v) { var raw = Math.max(1, v) / 4, p = Math.pow(10, Math.floor(Math.log10(raw))); var m = [1, 2, 3, 5, 10].find(function (x) { return x * p >= raw; }); return Math.max(1, m * p) * 4; }
  function dayLabel(d, long) { var dt = new Date(d + 'T12:00:00Z'); return dt.toLocaleDateString('en-GB', long ? { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' } : { day: 'numeric', month: 'short', timeZone: 'UTC' }); }

  function lineChart(el, pts, prev, label, opts) {
    opts = opts || {};
    el.innerHTML = '';
    var W = Math.max(300, Math.round(el.clientWidth || 760)), H = opts.height || 260, L = 44, R = 12, T = 12, B = 28;
    var max = niceMax(Math.max.apply(null, pts.map(function (p) { return p.v; }).concat(prev ? prev.map(function (p) { return p.v; }) : []).concat([1])));
    var nPts = pts.length;
    var x = function (i) { return L + (nPts <= 1 ? (W - L - R) / 2 : i * (W - L - R) / (nPts - 1)); };
    var y = function (v) { return T + (H - T - B) * (1 - v / max); };
    var svg = s('svg', { viewBox: '0 0 ' + W + ' ' + H, role: 'img', 'aria-label': label + ' per day' });
    for (var g = 0; g <= 4; g++) {
      var gv = max * g / 4, gy = y(gv);
      svg.append(s('line', { x1: L, x2: W - R, y1: gy, y2: gy, class: 'gridl' }));
      var t = s('text', { x: L - 8, y: gy + 4, 'text-anchor': 'end', class: 'axis' }); t.textContent = n(gv); svg.append(t);
    }
    var step = Math.max(1, Math.ceil(nPts / 8));
    pts.forEach(function (p, i) { if ((i % step === 0 && (i === 0 || nPts - 1 - i >= step * 0.6)) || i === nPts - 1) { var t = s('text', { x: x(i), y: H - 8, 'text-anchor': i === 0 ? 'start' : i === nPts - 1 ? 'end' : 'middle', class: 'axis' }); t.textContent = p.label; svg.append(t); } });
    if (prev && prev.length === nPts) svg.append(s('path', { d: prev.map(function (p, i) { return (i ? 'L' : 'M') + x(i) + ' ' + y(p.v); }).join(''), class: 'ref' }));
    if (nPts > 1) svg.append(s('path', { d: 'M' + x(0) + ' ' + y(0) + pts.map(function (p, i) { return 'L' + x(i) + ' ' + y(p.v); }).join('') + 'L' + x(nPts - 1) + ' ' + y(0) + 'Z', class: 'area' }));
    svg.append(s('path', { d: pts.map(function (p, i) { return (i ? 'L' : 'M') + x(i) + ' ' + y(p.v); }).join(''), class: 'line' }));
    if (nPts <= 2) pts.forEach(function (p, i) { svg.append(s('circle', { cx: x(i), cy: y(p.v), r: 4.5, class: 'dot' })); });
    var hair = s('line', { y1: T, y2: H - B, class: 'hair', visibility: 'hidden' }), dot = s('circle', { r: 4.5, class: 'dot', visibility: 'hidden' });
    svg.append(hair, dot);
    var hit = s('rect', { x: L, y: 0, width: W - L - R, height: H, fill: 'transparent', tabindex: '0', 'aria-label': 'Move along the chart to read values' });
    svg.append(hit);
    var at = function (ev) {
      var r = svg.getBoundingClientRect(), px = (ev.clientX - r.left) * W / r.width;
      var i = Math.max(0, Math.min(nPts - 1, Math.round((px - L) / ((W - L - R) / Math.max(1, nPts - 1)))));
      hair.setAttribute('x1', x(i)); hair.setAttribute('x2', x(i)); hair.setAttribute('visibility', 'visible');
      dot.setAttribute('cx', x(i)); dot.setAttribute('cy', y(pts[i].v)); dot.setAttribute('visibility', 'visible');
      var rows = [h('div', { class: 'k', text: pts[i].long || pts[i].label }), h('div', { class: 'row' }, h('i'), h('b', { text: n(pts[i].v) }), h('span', { class: 'k', text: label }))];
      if (prev && prev[i]) rows.push(h('div', { class: 'row' }, h('i', { class: 'ref' }), h('span', { text: n(prev[i].v) }), h('span', { class: 'k', text: 'previous period' })));
      showTip(ev, rows);
    };
    hit.addEventListener('pointermove', at); hit.addEventListener('pointerdown', at);
    hit.addEventListener('pointerleave', function () { hair.setAttribute('visibility', 'hidden'); dot.setAttribute('visibility', 'hidden'); hideTip(); });
    el.append(svg);
  }
  function barChart(el, bars, label, opts) {
    opts = opts || {};
    el.innerHTML = '';
    var W = Math.max(260, Math.round(el.clientWidth || 760)), H = opts.height || 200, L = 40, R = 8, T = 10, B = 24;
    var max = niceMax(Math.max.apply(null, bars.map(function (b) { return b.v; }).concat([1])));
    var bw = (W - L - R) / bars.length, gap = Math.min(6, bw * 0.25);
    var svg = s('svg', { viewBox: '0 0 ' + W + ' ' + H, role: 'img', 'aria-label': label });
    for (var g = 0; g <= 4; g++) { var gy = T + (H - T - B) * (1 - g / 4); svg.append(s('line', { x1: L, x2: W - R, y1: gy, y2: gy, class: 'gridl' })); var t = s('text', { x: L - 8, y: gy + 4, 'text-anchor': 'end', class: 'axis' }); t.textContent = n(max * g / 4); svg.append(t); }
    bars.forEach(function (b, i) {
      var bh = (H - T - B) * b.v / max, bx = L + i * bw + gap / 2, by = H - B - bh, w = Math.max(1, bw - gap);
      var r = Math.min(4, w / 2, bh);
      var d = bh <= 0 ? '' : 'M' + bx + ' ' + (H - B) + 'V' + (by + r) + 'Q' + bx + ' ' + by + ' ' + (bx + r) + ' ' + by + 'H' + (bx + w - r) + 'Q' + (bx + w) + ' ' + by + ' ' + (bx + w) + ' ' + (by + r) + 'V' + (H - B) + 'Z';
      if (d) svg.append(s('path', { d: d, class: 'bar' }));
      var hit = s('rect', { x: L + i * bw, y: T, width: bw, height: H - T - B, fill: 'transparent', tabindex: '0', 'aria-label': b.label + ': ' + b.v });
      hit.addEventListener('pointermove', function (ev) { showTip(ev, [h('div', { class: 'k', text: b.long || b.label }), h('div', { class: 'row' }, h('b', { text: n(b.v) }), h('span', { class: 'k', text: label }))]); });
      hit.addEventListener('pointerleave', hideTip);
      svg.append(hit);
      if (bars.length <= 24 && (i % (opts.every || 1) === 0)) { var t = s('text', { x: bx + w / 2, y: H - 7, 'text-anchor': 'middle', class: 'axis' }); t.textContent = b.label; svg.append(t); }
    });
    el.append(svg);
  }
  function ranked(list, opts) {
    opts = opts || {};
    if (!list.length) return emptyBox(opts.empty || 'No visits recorded for this period yet.');
    var max = Math.max.apply(null, list.map(function (x) { return x.v; }).concat([1])), total = opts.total || list.reduce(function (a, x) { return a + x.v; }, 0);
    return h('ol', { class: 'rank' }, list.map(function (x, i) {
      var t = h('span', { class: 't', title: x.title || x.label });
      if (x.href) t.append(h('a', { href: x.href, target: '_blank', rel: 'noopener', text: x.label })); else t.append(document.createTextNode(x.label));
      if (x.meta) t.append(h('small', { text: x.meta }));
      return h('li', null, h('span', { class: 'n', text: String(i + 1) }), t,
        h('span', { class: 'v' }, n(x.v), opts.pct !== false && total ? h('small', { text: Math.round(x.v * 100 / total) + '%' }) : null),
        h('span', { class: 'b' }, h('span', { style: 'width:' + (x.v * 100 / max).toFixed(1) + '%' })));
    }));
  }
  function emptyBox(msg) { return h('div', { class: 'empty' }, icon('chart'), h('div', { text: msg })); }
  function card(title, sub, body, cls, right) { return h('div', { class: 'card ' + (cls || '') }, h('div', { class: 'card-h' }, h('div', null, h('h3', { text: title }), sub ? h('p', { class: 'sub', text: sub }) : null), right || null), body); }
  function kpi(label, iconName, value, extra, cls) {
    return h('div', { class: 'card kpi ' + (cls || '') }, h('div', { class: 'lab', html: ic(iconName) + '<span></span>' }), h('div', { class: 'val', text: value }), extra || null);
  }
  function setLab(el, t) { el.querySelector('.lab span').textContent = t; return el; }
  function delta(cur, prev, text) {
    if (!prev) return h('div', { class: 'note', text: text || 'no earlier data to compare' });
    var p = Math.round((cur - prev) * 100 / prev), cls = p > 0 ? 'up' : p < 0 ? 'down' : 'flat';
    return h('span', { class: 'delta ' + cls, text: (p > 0 ? '▲ ' : p < 0 ? '▼ ' : '') + Math.abs(p) + '% vs previous period' });
  }
  function flag(cc) { return cc && cc.length === 2 ? String.fromCodePoint.apply(null, cc.toUpperCase().split('').map(function (c) { return 127397 + c.charCodeAt(0); })) : '🌐'; }
  function countryName(cc) { if (!cc) return 'Unknown'; try { return REGION ? REGION.of(cc) : cc; } catch (e) { return cc; } }
  function langName(l) { if (!l) return 'Not set'; try { return LANGN ? LANGN.of(l) : l; } catch (e) { return l; } }
  var SOURCE = { direct: 'Direct (typed, bookmarks, apps)', search: 'Search engines', social: 'Social media', website: 'Other websites', email: 'Email', campaign: 'Campaign links', app: 'Wartabiye TV app' };
  var SECTION = { '/': 'Homepage', '/ciyaaraha': 'Sports', '/caalamka': 'World', '/bariga-afrika': 'Somalia & East Africa', '/wararka-tooska': 'LIVE News', '/toos': 'LIVE TV', '/muuqaal': 'Video', '/ciyaaraha-toos': 'Live scores', '/xayeysiimaha': 'Advertise', '/xiriir': 'Contact', '/nagu-saabsan': 'About', '/raadi': 'Search', '/kaydsan': 'Saved', '/asturnaanta': 'Privacy policy' };

  // article titles come from the public website's own article files
  var titles = {};
  function articleTitles(ids) {
    return Promise.all(ids.map(function (id) {
      if (titles[id]) return titles[id];
      return titles[id] = fetch(SITE + 'data/news/' + encodeURIComponent(id) + '.json', { cache: 'force-cache' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (j) { return j ? { title: j.title, category: j.category, section: j.section } : { title: id.replace(/^\d{4}-\d{2}-\d{2}-/, '').replace(/-/g, ' '), gone: true }; }).catch(function () { return { title: id }; });
    }));
  }

  // ---------------------------------------------------------------- views
  var VIEWS = {
    dashboard: { title: 'Overview', native: 'overview' },
    analytics: { title: 'Analytics', render: renderAnalytics },
    automation: { title: 'News automation', native: 'automation' },
    sections: { title: 'Sections & categories', native: 'sections' },
    health: { title: 'SEO & website health', native: 'health' },
    security: { title: 'Security & sessions', render: renderSecurity },
    articles: { title: 'Articles', native: 'articles' },
    world: { title: 'World News', native: 'world' },
    sports: { title: 'Sports News', native: 'sports' },
    somalia: { title: 'Somalia News', native: 'somalia' },
    editor: { title: 'Full editor', cms: '#/collections/news', links: [['All articles', '#/collections/news'], ['New article', '#/collections/news/new'], ['World news sources', '#/collections/world'], ['Sports writer & sources', '#/collections/world/entries/sportsWriter'], ['Live scores settings', '#/collections/media/entries/sports']], note: 'Every field of every file. Saving here also publishes to the website.' },
    live: { title: 'LIVE News', native: 'live' },
    livesrc: { title: 'LIVE News sources', cms: '#/collections/media/entries/sources', links: [['LIVE News sources', '#/collections/media/entries/sources'], ['Fast sources (5 minutes)', '#/collections/world/entries/fast']] },
    media: { title: 'Media Library', native: 'media' },
    homepage: { title: 'Homepage', native: 'homepage' },
    ads: { title: 'Advertising', native: 'ads' },
    notifications: { title: 'Notifications', cms: '#/collections/alerts', links: [['Alerts', '#/collections/alerts'], ['Notification settings & delivery log', '#/collections/notify']] },
    settings: { title: 'Website settings', native: 'settings' },
  };

  function go() {
    var v = (location.hash || '#dashboard').slice(1).split('?')[0];
    if (!VIEWS[v]) v = 'dashboard';
    current = v; clearTimers(); hideTip();
    document.querySelectorAll('#nav a').forEach(function (a) { var on = a.dataset.view === v; a.classList.toggle('on', on); if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
    $('viewTitle').textContent = VIEWS[v].title; document.title = VIEWS[v].title + ' · Wartabiye TV Admin';
    document.querySelectorAll('.view').forEach(function (x) { x.hidden = true; });
    closeMenu();
    if (VIEWS[v].cms) return openCms(VIEWS[v], pendingCms);
    if (VIEWS[v].native) { var ne = $('v-native'); ne.hidden = false; return (window.WTV_VIEWS[VIEWS[v].native])(ne, (location.hash.split('?')[1] || '')); }
    var el = $('v-' + v); el.hidden = false; VIEWS[v].render(el);
  }

  // ---- publishing tool (Sveltia CMS) inside the dashboard ----
  var cmsLoaded = false, pendingCms = null;
  function openCms(V, first) {
    pendingCms = null;
    var sec = $('v-cms'); sec.hidden = false;
    var bar = $('cmsBar'); bar.innerHTML = '';
    var fr = $('cmsFrame');
    (V.links || []).forEach(function (l, i) { bar.append(h('button', { class: 'btn small' + (i === 0 ? ' primary' : ''), type: 'button', text: l[0], onclick: function () { nav(l[1]); } })); });
    (V.extra || []).forEach(function (l) { bar.append(h('a', { class: 'btn small', href: l[1], target: '_blank', rel: 'noopener', html: ic('ext') + '<span></span>' })); bar.lastChild.lastChild.textContent = l[0]; });
    if (V.note) bar.append(h('span', { text: V.note }));
    function nav(hash) {
      if (!cmsLoaded) { fr.src = '/cms/' + hash; cmsLoaded = true; return; }
      try { fr.contentWindow.location.hash = hash; } catch (e) { fr.src = '/cms/' + hash; }
    }
    nav(first || V.cms);
  }
  // open the full editor at one entry, e.g. '#/collections/news/entries/<id>'
  function openFullEditor(hash) { pendingCms = hash; if (current === 'editor') return openCms(VIEWS.editor, hash); location.hash = '#editor'; }

  // ---- Dashboard (overview) ----
  function renderDashboard(el) {
    el.innerHTML = '';
    var hour = new Date().getHours();
    var hello = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
    el.append(h('div', { class: 'hero' }, h('div', null, h('h2', { text: hello + (ME && (ME.name || ME.login) ? ', ' + (ME.name || ME.login).split(' ')[0] : '') }), h('p', { text: 'Here is how Wartabiye TV is doing right now.' })),
      h('div', { class: 'actions' },
        h('a', { class: 'btn primary', href: '#articles?new', html: ic('plus') + '<span>New article</span>' }),
        h('a', { class: 'btn', href: '#analytics', html: ic('chart') + '<span>Full analytics</span>' }),
        h('a', { class: 'btn', href: SITE, target: '_blank', rel: 'noopener', html: ic('ext') + '<span>Open website</span>' }))));
    var note = h('div'); el.append(note);
    var k = h('div', { class: 'grid kpis' }); el.append(k);
    var row = h('div', { class: 'grid cols-2', style: 'margin-top:16px' }); el.append(row);
    var chartBody = h('div', { class: 'chart' }, h('div', { class: 'skel', style: 'height:220px' }));
    var topBody = h('div', null, h('div', { class: 'skel', style: 'height:220px' }));
    row.append(card('Visitors, last 30 days', 'Unique visitors per day', chartBody), card('Most read today', 'Article page views today', topBody));
    var row2 = h('div', { class: 'grid cols-2', style: 'margin-top:16px' }); el.append(row2);
    var autoBody = h('div', null, h('div', { class: 'skel', style: 'height:120px' }));
    var secBody = h('div', null, h('div', { class: 'skel', style: 'height:120px' }));
    row2.append(card('Automation', 'Latest result of each automatic job', autoBody, '', h('a', { class: 'toggle', href: '#automation', text: 'Details →' })),
      card('Security', 'Recent sign-ins to this dashboard', secBody, '', h('a', { class: 'toggle', href: '#security', text: 'Details →' })));
    function load() {
      Promise.all([api('/api/analytics/summary?range=30d'), api('/api/analytics/realtime'), api('/api/analytics/summary?range=today')]).then(function (r) {
        var S = r[0], RT = r[1], TD = r[2];
        note.innerHTML = '';
        if (S.since) {
          var bn = h('div', { class: 'banner', html: ic('info') + '<div><b></b><span></span></div>' });
          bn.querySelector('b').textContent = 'Real visitor data, collected since ' + dayLabel(S.since, true);
          bn.querySelector('span').textContent = 'Counted by our own privacy-friendly counter on the public website. Nothing before that date is shown, and nothing is estimated.';
          note.append(bn);
        } else note.append(noData());
        k.innerHTML = '';
        var q = S.quick;
        k.append(setLab(kpi('', 'pulse', n(RT.active5), h('div', { class: 'note', text: 'on the site in the last 5 minutes' }), 'live'), 'Active now'),
          setLab(kpi('', 'users', n(q.today), h('div', { class: 'note', text: 'since 00:00 Mogadishu time' })), 'Visitors today'),
          setLab(kpi('', 'users', n(q.yesterday), h('div', { class: 'note', text: 'whole day' })), 'Visitors yesterday'),
          setLab(kpi('', 'cal', n(q.week), h('div', { class: 'note', text: 'Monday to today' })), 'This week'),
          setLab(kpi('', 'cal', n(q.month), h('div', { class: 'note', text: 'since the 1st' })), 'This month'),
          setLab(kpi('', 'eye', n(q.allTime.views), h('div', { class: 'note', text: n(q.allTime.visitors) + ' visitors in total' })), 'Total page views'));
        lineChart(chartBody, S.series.map(function (d) { return { v: d.visitors, label: dayLabel(d.day), long: dayLabel(d.day, true) }; }), null, 'visitors', { height: 220 });
        var arts = TD.articles.slice(0, 6);
        articleTitles(arts.map(function (a) { return a.id; })).then(function (t) {
          topBody.innerHTML = '';
          topBody.append(ranked(arts.map(function (a, i) { return { label: t[i].title, meta: t[i].category || a.cat || '', v: a.views, href: SITE + 'war/' + a.id + '.html' }; }), { empty: 'No article has been read yet today.', pct: false }));
        });
      }).catch(function (e) { note.innerHTML = ''; note.append(errBox(e)); });
      api('/api/automation').then(function (A) { autoBody.innerHTML = ''; autoBody.append(autoList(A.workflows.slice(0, 6))); }).catch(function (e) { autoBody.innerHTML = ''; autoBody.append(errBox(e)); });
      api('/api/security').then(function (S) { secBody.innerHTML = ''; secBody.append(auditTable(S.log.filter(function (x) { return /login|denied|mfa_locked/.test(x.event); }).slice(0, 5))); }).catch(function (e) { secBody.innerHTML = ''; secBody.append(errBox(e)); });
    }
    load(); every(60000, load);
  }
  function noData() { return h('div', { class: 'banner warn', html: ic('info') + '<div><b>No visits recorded yet</b><span>Visitor counting starts the moment the website sends its first page view (after the one-time setup). This dashboard never shows estimated or sample numbers, so the cards stay at 0 until real visitors arrive.</span></div>' }); }
  function errBox(e) { var b = h('div', { class: 'banner bad', html: ic('warn') + '<div><b>Could not load this data</b><span></span></div>' }); b.querySelector('span').textContent = (e && e.message || String(e)) + '. It will try again automatically.'; return b; }

  // ---- Analytics ----
  var A = { range: '30d', metric: 'visitors', from: '', to: '', table: false };
  try { var saved = JSON.parse(localStorage.getItem('wtv-admin-an') || '{}'); if (saved.range) A.range = saved.range; if (saved.metric) A.metric = saved.metric; } catch (e) {}
  function renderAnalytics(el) {
    el.innerHTML = '';
    var RANGES = [['today', 'Today'], ['yesterday', 'Yesterday'], ['7d', '7 days'], ['week', 'This week'], ['month', 'This month'], ['30d', '30 days'], ['90d', '90 days'], ['12m', '12 months']];
    var seg = h('div', { class: 'seg', role: 'group', 'aria-label': 'Date range' });
    RANGES.forEach(function (r) { seg.append(h('button', { type: 'button', 'aria-pressed': String(A.range === r[0]), text: r[1], onclick: function () { A.range = r[0]; persist(); renderAnalytics(el); } })); });
    var today = new Date().toISOString().slice(0, 10);
    var from = h('input', { type: 'date', 'aria-label': 'From', max: today, value: A.from }), to = h('input', { type: 'date', 'aria-label': 'To', max: today, value: A.to });
    var custom = h('span', { class: 'custom' }, from, h('span', { text: '→' }), to, h('button', { class: 'btn small', type: 'button', text: 'Apply', onclick: function () { if (from.value && to.value) { A.range = 'custom'; A.from = from.value; A.to = to.value; renderAnalytics(el); } } }));
    var upd = h('span', { class: 'updated', html: ic('refresh') + '<span>Loading…</span>' });
    el.append(h('div', { class: 'filters' }, seg, custom, upd));
    var note = h('div'); el.append(note);
    var kp = h('div', { class: 'grid kpis' }); el.append(kp);
    var mseg = h('div', { class: 'seg', role: 'group', 'aria-label': 'Measure' });
    [['visitors', 'Visitors'], ['views', 'Page views'], ['sessions', 'Visits']].forEach(function (m) { mseg.append(h('button', { type: 'button', 'aria-pressed': String(A.metric === m[0]), text: m[1], onclick: function () { A.metric = m[0]; persist(); mseg.querySelectorAll('button').forEach(function (b) { b.setAttribute('aria-pressed', String(b.textContent === m[1])); }); draw(); } })); });
    var tableBtn = h('button', { class: 'toggle', type: 'button', text: A.table ? 'Show chart' : 'Show as table' });
    var chartEl = h('div', { class: 'chart' }, h('div', { class: 'skel', style: 'height:260px' }));
    var legend = h('div', { class: 'legend' });
    var growth = card('Traffic over time', 'Daily totals for the selected period, compared with the period just before', h('div', null, legend, chartEl), 'span-2', h('div', { style: 'display:flex;gap:10px;align-items:center;flex-wrap:wrap' }, mseg, tableBtn));
    var hoursEl = h('div', { class: 'chart' });
    var big = h('div', { class: 'grid cols-3', style: 'margin-top:16px' }); el.append(big);
    big.append(growth); var live = h('div'); big.append(card('Real-time', 'Updates every 30 seconds', live, 'live'));
    var g2 = h('div', { class: 'grid cols-2', style: 'margin-top:16px' }); el.append(g2);
    var arts = h('div'), cats = h('div'), srcs = h('div'), ctry = h('div'), devs = h('div'), langs = h('div'), secs = h('div');
    g2.append(card('Most visited articles', 'Article page views in this period', arts), card('Most visited categories', 'Article views grouped by category', cats));
    var g3 = h('div', { class: 'grid cols-3', style: 'margin-top:16px' }); el.append(g3);
    g3.append(card('Traffic sources', 'Where visits came from', srcs), card('Visitor countries', 'Approximate, from the network (country only)', ctry), card('Devices', 'Visitors by type of device', devs));
    var g4 = h('div', { class: 'grid cols-3', style: 'margin-top:16px' }); el.append(g4);
    g4.append(card('Page views by hour', 'Mogadishu time (UTC+3)', hoursEl, 'span-2'), card('Site language chosen', 'Visitors by the language they read in', langs));
    var g5 = h('div', { class: 'grid cols-2', style: 'margin-top:16px' }); el.append(g5);
    g5.append(card('Most visited sections', 'Homepage and section pages', secs), card('What the numbers mean', '', definitions()));
    var DATA = null;
    tableBtn.addEventListener('click', function () { A.table = !A.table; tableBtn.textContent = A.table ? 'Show chart' : 'Show as table'; draw(); });
    function persist() { try { localStorage.setItem('wtv-admin-an', JSON.stringify({ range: A.range, metric: A.metric })); } catch (e) {} }
    function draw() {
      if (!DATA) return;
      var lab = { visitors: 'visitors', views: 'page views', sessions: 'visits' }[A.metric];
      var cur = DATA.series.map(function (d) { return { v: d[A.metric], label: dayLabel(d.day), long: dayLabel(d.day, true) }; });
      legend.innerHTML = '';
      if (A.table) {
        chartEl.innerHTML = '';
        var tb = h('tbody'); DATA.series.slice().reverse().forEach(function (d) { tb.append(h('tr', null, h('td', { text: dayLabel(d.day, true) }), h('td', { class: 'num', text: n(d.visitors) }), h('td', { class: 'num', text: n(d.views) }), h('td', { class: 'num', text: n(d.sessions) }))); });
        chartEl.append(h('div', { class: 'tablewrap' }, h('table', { class: 't' }, h('thead', null, h('tr', null, h('th', { text: 'Day' }), h('th', { text: 'Visitors' }), h('th', { text: 'Page views' }), h('th', { text: 'Visits' }))), tb)));
        return;
      }
      if (DATA.series.length === 1) {
        // a single day: show its hours instead of a one-point line
        var hrs = Array.from({ length: 24 }, function (_, i) { var r = DATA.hours.find(function (x) { return x.day === DATA.series[0].day && x.hour === i; }); return { v: r ? r.views : 0, label: String(i).padStart(2, '0'), long: String(i).padStart(2, '0') + ':00–' + String(i).padStart(2, '0') + ':59' }; });
        legend.append(h('span', { text: 'Page views per hour on ' + dayLabel(DATA.series[0].day, true) }));
        return barChart(chartEl, hrs, 'page views', { height: 260, every: 3 });
      }
      legend.append(h('span', null, h('i'), document.createTextNode('This period')), h('span', null, h('i', { class: 'ref' }), document.createTextNode('Previous period')));
      lineChart(chartEl, cur, DATA.prevSeries ? DATA.prevSeries.map(function (d) { return { v: d[A.metric] }; }) : null, lab);
    }
    function q() { return A.range === 'custom' ? 'range=custom&from=' + A.from + '&to=' + A.to : 'range=' + A.range; }
    function load(first) {
      if (!first) el.classList.add('loading');
      var main = api('/api/analytics/summary?' + q());
      var prev = main.then(function (S) { return S.range.len > 1 ? api('/api/analytics/summary?range=custom&from=' + S.range.prevFrom + '&to=' + S.range.prevTo).catch(function () { return null; }) : null; });
      Promise.all([main, prev]).then(function (r) {
        var S = r[0], P = r[1]; DATA = S; DATA.prevSeries = P ? P.series : null;
        el.classList.remove('loading');
        upd.querySelector('span').textContent = 'Updated ' + new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) + ' · refreshes every minute';
        note.innerHTML = '';
        var rng = S.range.from === S.range.to ? dayLabel(S.range.from, true) : dayLabel(S.range.from, true) + ' – ' + dayLabel(S.range.to, true);
        if (!S.since) note.append(noData());
        else {
          var b = h('div', { class: 'banner', html: ic('info') + '<div><b></b><span></span></div>' });
          b.querySelector('b').textContent = 'Showing ' + rng;
          b.querySelector('span').textContent = 'Data collection started on ' + dayLabel(S.since, true) + '. Days before that have no data (shown as 0), not estimates.' + (S.range.from < S.since ? ' Part of this period is before that date.' : '');
          note.append(b);
        }
        var T = S.totals, Pv = S.previous;
        kp.innerHTML = '';
        kp.append(setLab(kpi('', 'users', n(T.visitors), delta(T.visitors, Pv.visitors)), 'Visitors'),
          setLab(kpi('', 'eye', n(T.views), delta(T.views, Pv.views)), 'Page views'),
          setLab(kpi('', 'layers', n(T.sessions), delta(T.sessions, Pv.sessions)), 'Visits (sessions)'),
          setLab(kpi('', 'file', T.visitors ? (T.views / T.visitors).toFixed(1) : '0', h('div', { class: 'note', text: 'pages per visitor per day' })), 'Pages per visitor'),
          setLab(kpi('', 'repeat', T.consented ? Math.round(T.returning * 100 / T.consented) + '%' : '—', h('div', { class: 'note', text: T.consented ? n(T.returning) + ' of ' + n(T.consented) + ' visitors (earlier version)' : 'not measured: nothing is stored on visitors\' devices' })), 'Returning visitors'),
          setLab(kpi('', 'globe', n(S.quick.allTime.visitors), h('div', { class: 'note', text: n(S.quick.allTime.views) + ' page views since ' + (S.since ? dayLabel(S.since) : 'start') })), 'Total visitors (all time)'));
        draw();
        var hrs = Array.from({ length: 24 }, function (_, i) { var v = S.hours.filter(function (x) { return x.hour === i && x.day === S.range.to; }).reduce(function (a, x) { return a + x.views; }, 0); return { v: v, label: String(i).padStart(2, '0'), long: dayLabel(S.range.to, true) + ', ' + String(i).padStart(2, '0') + ':00–' + String(i).padStart(2, '0') + ':59' }; });
        barChart(hoursEl, hrs, 'page views on ' + dayLabel(S.range.to), { height: 180, every: 3 });
        hoursEl.parentNode.parentNode.querySelector('.sub').textContent = dayLabel(S.range.to, true) + ' · Mogadishu time (UTC+3)';
        var top = S.articles.slice(0, 12);
        arts.innerHTML = ''; arts.append(h('div', { class: 'skel', style: 'height:160px' }));
        articleTitles(top.map(function (a) { return a.id; })).then(function (t) {
          arts.innerHTML = '';
          arts.append(ranked(top.map(function (a, i) { return { label: t[i].title, meta: (t[i].category || a.cat || '') + (t[i].gone ? ' · removed' : ''), v: a.views, href: SITE + 'war/' + a.id + '.html' }; }), { pct: false, empty: 'No article page views in this period yet.' }));
        });
        cats.innerHTML = ''; cats.append(ranked(S.categories.map(function (c) { return { label: c.name, v: c.views }; }), { empty: 'No article views in this period yet.' }));
        var byKind = {}; S.sources.forEach(function (x) { byKind[x.kind] = (byKind[x.kind] || 0) + x.visits; });
        srcs.innerHTML = '';
        srcs.append(ranked(Object.keys(byKind).map(function (k) { return { label: SOURCE[k] || k, v: byKind[k] }; }).sort(function (a, b) { return b.v - a.v; }), { empty: 'No visits recorded in this period yet.' }));
        var hosts = S.sources.filter(function (x) { return x.host; }).slice(0, 8);
        if (hosts.length) srcs.append(h('p', { class: 'sub', style: 'margin:14px 0 8px', text: 'Top referring sites' }), ranked(hosts.map(function (x) { return { label: x.host, meta: SOURCE[x.kind] ? x.kind : '', v: x.visits }; }), { pct: false }));
        ctry.innerHTML = ''; ctry.append(ranked(S.countries.slice(0, 12).map(function (c) { return { label: flag(c.key) + '  ' + countryName(c.key), v: c.visitors }; })));
        devs.innerHTML = ''; var DN = { mobile: 'Mobile phones', desktop: 'Desktop & laptop', tablet: 'Tablets' };
        devs.append(ranked(S.devices.map(function (d) { return { label: DN[d.key] || 'Other', v: d.visitors }; })));
        langs.innerHTML = ''; langs.append(ranked(S.languages.map(function (l) { return { label: langName(l.key), v: l.visitors }; })));
        secs.innerHTML = ''; secs.append(ranked(S.sections.slice(0, 10).map(function (p) { return { label: SECTION[p.path] || (p.path.indexOf('/qayb/') === 0 ? 'Category: ' + p.path.slice(6) : p.path), v: p.views }; }), { pct: false, empty: 'No page views in this period yet.' }));
      }).catch(function (e) { el.classList.remove('loading'); note.innerHTML = ''; note.append(errBox(e)); upd.querySelector('span').textContent = 'Not updated'; });
    }
    function loadLive() {
      api('/api/analytics/realtime').then(function (R) {
        live.innerHTML = '';
        var DN = { mobile: 'mobile', desktop: 'desktop', tablet: 'tablet' };
        live.append(h('div', { class: 'kpi live', style: 'margin-bottom:12px' }, h('div', { class: 'lab', html: ic('pulse') + '<span>Active now (last 5 minutes)</span>' }), h('div', { class: 'val', text: n(R.active5) }),
          h('div', { class: 'note', text: R.byDevice.length ? R.byDevice.map(function (d) { return n(d.n) + ' ' + (DN[d.device] || 'other'); }).join(' · ') : 'Nobody on the site in the last 5 minutes' })),
          h('p', { class: 'sub', text: n(R.active30) + ' visitors in the last 30 minutes' }));
        var hrs = Array.from({ length: 24 }, function (_, i) { var r = R.todayHours.find(function (x) { return x.hour === i; }); return { v: r ? r.views : 0, label: String(i).padStart(2, '0'), long: 'Today ' + String(i).padStart(2, '0') + ':00–' + String(i).padStart(2, '0') + ':59' }; });
        var c = h('div', { class: 'chart' }); live.append(h('p', { class: 'sub', style: 'margin-bottom:4px', text: 'Page views today, per hour' }), c);
        barChart(c, hrs, 'page views', { height: 150, every: 6 });
      }).catch(function (e) { live.innerHTML = ''; live.append(errBox(e)); });
    }
    load(true); loadLive();
    every(60000, function () { load(false); }); every(30000, loadLive);
  }
  function definitions() {
    var d = [['Visitors', 'Different devices (browsers) that opened the site on a day. Someone who reads on Monday and Tuesday counts once each day; a "this week" total adds the days up. We do not use cookies to follow people across days.'],
      ['Users', 'Google Analytics calls a person followed across days with a cookie a "user". We deliberately do not do that, so "users" is not measured here; "Visitors" is the closest figure.'],
      ['Visits (sessions)', 'A period of reading. A new visit starts when a visitor comes back after more than 30 minutes without opening a page.'],
      ['Page views', 'Every page or article opened, including several pages in the same visit.'],
      ['Returning visitors', 'Visitors who came back on another day. Not measured, because the website stores nothing on visitors\' devices and shows no consent notice; every visitor is still counted.'],
      ['Not counted', 'Search-engine robots, link previews, automatic site checks and your own article previews (?preview=) are left out.']];
    return h('dl', { class: 'defs' }, d.map(function (x) { return h('div', null, h('dt', { text: x[0] }), h('dd', { text: x[1] })); }));
  }

  // ---- Automation status ----
  var ago = function (iso) { var s = (Date.now() - Date.parse(iso)) / 1000; return s < 90 ? 'just now' : s < 5400 ? Math.round(s / 60) + ' min ago' : s < 129600 ? Math.round(s / 3600) + ' h ago' : Math.round(s / 86400) + ' days ago'; };
  function runChip(r) {
    if (r.status !== 'completed') return h('span', { class: 'chip info', html: ic('clock') + '<span>Running</span>' });
    if (r.conclusion === 'success') return h('span', { class: 'chip ok', html: ic('check') + '<span>Success</span>' });
    if (r.conclusion === 'skipped' || r.conclusion === 'cancelled') { var c = h('span', { class: 'chip warn', html: ic('info') + '<span></span>' }); c.lastChild.textContent = r.conclusion === 'skipped' ? 'Skipped' : 'Cancelled'; return c; }
    return h('span', { class: 'chip bad', html: ic('x') + '<span>Failed</span>' });
  }
  function autoList(ws) {
    if (!ws.length) return emptyBox('No automatic runs found.');
    var tb = h('tbody');
    ws.forEach(function (w) { tb.append(h('tr', null, h('td', null, h('a', { href: w.url, target: '_blank', rel: 'noopener', text: w.name })), h('td', null, runChip(w)), h('td', { class: 'num', text: ago(w.updated) }))); });
    return h('table', { class: 't' }, h('thead', null, h('tr', null, h('th', { text: 'Job' }), h('th', { text: 'Last result' }), h('th', { text: 'When' }))), tb);
  }
  function renderAutomation(el) {
    el.innerHTML = '';
    var top = h('div'), wf = h('div', null, h('div', { class: 'skel', style: 'height:200px' })), runs = h('div');
    el.append(top, h('div', { class: 'grid cols-2' }, card('Automatic jobs', 'Latest run of each GitHub Actions workflow (read-only)', wf), card('Recent runs', 'Newest first', runs)));
    function load() {
      api('/api/automation').then(function (A) {
        top.innerHTML = '';
        var bad = A.workflows.filter(function (w) { return w.status === 'completed' && w.conclusion === 'failure'; });
        var b = h('div', { class: 'banner ' + (bad.length ? 'bad' : ''), html: ic(bad.length ? 'warn' : 'check') + '<div><b></b><span></span></div>' });
        b.querySelector('b').textContent = bad.length ? bad.length + ' job(s) failed on their last run' : 'All automatic jobs finished normally on their last run';
        var st = A.status || {};
        var bits = [];
        if (st.lastPublishOk || st.lastSuccessfulPublish) bits.push('Last successful publication: ' + new Date(st.lastPublishOk || st.lastSuccessfulPublish).toLocaleString('en-GB'));
        if (st.summary) bits.push(String(st.summary));
        b.querySelector('span').textContent = bits.join(' · ') || 'The watchdog checks publishing every few minutes and opens a GitHub issue if something stops.';
        top.append(b);
        wf.innerHTML = ''; wf.append(autoList(A.workflows));
        runs.innerHTML = ''; var tb = h('tbody');
        A.runs.forEach(function (r) { tb.append(h('tr', null, h('td', null, h('a', { href: r.url, target: '_blank', rel: 'noopener', text: r.name }), h('div', { class: 'sub', style: 'margin:0', text: r.title || '' })), h('td', null, runChip(r)), h('td', { class: 'num', text: ago(r.created) }))); });
        runs.append(h('div', { class: 'tablewrap', style: 'max-height:520px' }, h('table', { class: 't' }, h('thead', null, h('tr', null, h('th', { text: 'Run' }), h('th', { text: 'Result' }), h('th', { text: 'Started' }))), tb)));
      }).catch(function (e) { top.innerHTML = ''; top.append(errBox(e)); });
    }
    load(); every(60000, load);
  }

  // ---- Security ----
  var EV = { login_ok: 'Signed in', login_started: 'Sign-in started', github_ok: 'GitHub account confirmed', login_denied: 'Sign-in refused (not the owner)', login_failed: 'Sign-in failed', login_rate_limited: 'Too many attempts (blocked)', mfa_failed: 'Wrong security code', mfa_locked: 'Locked for 15 minutes', mfa_enrolled: 'Authenticator app added', logout: 'Signed out', session_expired: 'Session ended (time limit)', signout_others: 'Signed out other devices', content_change: 'Content saved', github_blocked: 'Blocked action', setup_github_app: 'GitHub App created', setup_refused: 'Setup refused', setup_failed: 'Setup failed' };
  function auditTable(log) {
    if (!log.length) return emptyBox('No events yet.');
    var tb = h('tbody');
    log.forEach(function (x) { tb.append(h('tr', null, h('td', { text: new Date(x.ts * 1000).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) }), h('td', null, h('span', { class: 'chip ' + (x.ok ? 'ok' : 'bad'), text: EV[x.event] || x.event }), x.detail ? h('div', { class: 'sub', style: 'margin:3px 0 0', text: x.detail }) : null), h('td', { text: (x.login ? '@' + x.login + ' · ' : '') + (x.country ? flag(x.country) + ' ' : '') + (x.ip || '') + (x.ua ? ' · ' + x.ua : '') }))); });
    return h('div', { class: 'tablewrap', style: 'max-height:560px' }, h('table', { class: 't' }, h('thead', null, h('tr', null, h('th', { text: 'When' }), h('th', { text: 'Event' }), h('th', { text: 'Account · place · device' }))), tb));
  }
  function renderSecurity(el) {
    el.innerHTML = '';
    var sess = h('div'), log = h('div', null, h('div', { class: 'skel', style: 'height:200px' }));
    el.append(h('div', { class: 'banner', html: ic('info') + '<div><b>How this dashboard is protected</b><span>Only an admin of the website repository can sign in, with GitHub plus a 6-digit code from your authenticator app. Sessions end after 30 minutes without activity and always after 8 hours. GitHub keys never reach the browser. Every sign-in, refusal and save is recorded below.</span></div>' }),
      h('div', { class: 'grid cols-3' }, card('Active sessions', 'Devices signed in now', sess), card('Security log', 'Sign-ins, refusals, saves (newest first)', log, 'span-2')));
    function load() {
      api('/api/security').then(function (S) {
        sess.innerHTML = '';
        S.sessions.forEach(function (x) { sess.append(h('div', { class: 'banner', style: 'margin-bottom:8px' }, h('div', null, h('b', { text: (x.current ? 'This device · ' : '') + (x.ua || 'Device') }), h('span', { text: (x.country ? flag(x.country) + ' ' : '') + 'signed in ' + ago(new Date(x.created * 1000).toISOString()) + ', ends by ' + new Date(x.expires * 1000).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) })))); });
        if (S.sessions.length > 1) sess.append(h('button', { class: 'btn', type: 'button', text: 'Sign out all other devices', onclick: function () { fetch('/api/security/signout-others', { method: 'POST', credentials: 'same-origin' }).then(load); } }));
        log.innerHTML = ''; log.append(auditTable(S.log));
      }).catch(function (e) { log.innerHTML = ''; log.append(errBox(e)); });
    }
    load();
  }

  // ---- session: visible time left, warning before the automatic sign-out, activity keeps it alive ----
  var expiresAt = 0, lastPing = Date.now(), lastActivity = Date.now();
  function signOut() {
    fetch('/auth/logout', { method: 'POST', credentials: 'same-origin', headers: { Accept: 'application/json' } }).finally(function () { location.href = '/login?bye=1'; });
  }
  function ping() { lastPing = Date.now(); return fetch('/api/ping', { method: 'POST', credentials: 'same-origin' }).then(function (r) { if (r.status === 401) location.href = '/login?e=expired'; return r.json(); }).then(function (j) { if (j && j.expiresAt) expiresAt = j.expiresAt * 1000; }).catch(function () {}); }
  function activity() { lastActivity = Date.now(); if (Date.now() - lastPing > 120000 && $('idleModal').hidden) ping(); }
  ['pointerdown', 'keydown', 'scroll'].forEach(function (e) { addEventListener(e, activity, { passive: true }); });
  addEventListener('message', function (e) { if (e.origin === location.origin && e.data && e.data.wtv === 'activity') activity(); });
  setInterval(function () {
    if (!expiresAt) return;
    var left = Math.round((expiresAt - Date.now()) / 1000);
    var cap = ME ? ME.maxAt * 1000 : Infinity;
    $('sessionLeft').textContent = left > 60 ? 'Session: ' + Math.ceil(left / 60) + ' min' : 'Ending…';
    $('sessionPill').classList.toggle('warn', left < 300);
    if (left <= 0) { location.href = '/login?e=expired'; return; }
    if (left <= 120 && $('idleModal').hidden) { $('idleModal').hidden = false; $('stayBtn').focus(); }
    if (!$('idleModal').hidden) $('idleLeft').textContent = Math.floor(left / 60) + ':' + String(left % 60).padStart(2, '0');
    if (Date.now() > cap) location.href = '/login?e=expired';
  }, 1000);
  $('stayBtn').addEventListener('click', function () { $('idleModal').hidden = true; ping(); });
  $('leaveBtn').addEventListener('click', signOut);
  $('logoutForm').addEventListener('submit', function (e) { e.preventDefault(); var b = e.target.querySelector('button'); b.disabled = true; b.lastChild.textContent = 'Signing out…'; signOut(); });

  // ---- mobile menu ----
  function closeMenu() { $('side').classList.remove('open'); $('scrim').hidden = true; $('menuBtn').setAttribute('aria-expanded', 'false'); }
  $('menuBtn').addEventListener('click', function () { $('side').classList.add('open'); $('scrim').hidden = false; $('menuBtn').setAttribute('aria-expanded', 'true'); });
  $('sideClose').addEventListener('click', closeMenu); $('scrim').addEventListener('click', closeMenu);
  addEventListener('keydown', function (e) { if (e.key === 'Escape') closeMenu(); });

  var rz = 0, lastW = innerWidth; addEventListener('resize', function () { clearTimeout(rz); rz = setTimeout(function () { if (innerWidth !== lastW && (current === 'analytics' || current === 'dashboard')) { lastW = innerWidth; go(); } }, 300); });

  // ---- shared with content.js (articles, media library, homepage) ----
  window.WTV = { h: h, ic: ic, icon: icon, card: card, api: api, errBox: errBox, every: every, clearTimers: clearTimers, showTip: showTip, hideTip: hideTip,
    kpi: kpi, setLab: setLab, ranked: ranked, lineChart: lineChart, barChart: barChart, articleTitles: articleTitles, dayLabel: dayLabel, autoList: autoList, auditTable: auditTable, runChip: runChip, emptyBox: emptyBox, current: function () { return current; },
    site: function () { return SITE; }, me: function () { return ME; }, openFullEditor: openFullEditor, ago: ago, n: n };

  // ---- start ----
  api('/api/me').then(function (me) {
    ME = me; SITE = me.site || SITE;
    expiresAt = me.expiresAt * 1000;
    $('meName').textContent = me.name || me.login; $('meLogin').textContent = '@' + me.login;
    if (me.avatar) $('meAvatar').src = me.avatar; else $('meAvatar').hidden = true;
    $('siteLink').href = SITE;
    addEventListener('hashchange', go); go();
  }).catch(function () {});
})();
