// Wartabiye TV admin: articles, photos and homepage, edited directly in the REAL website repository.
// Every read and write goes through this Worker's /api/github proxy, which checks the owner's session and adds the
// owner's short-lived GitHub token on the server; the browser never holds a GitHub token. A save is one Git commit on
// main (article + new photo together); that push starts the website's own "Daabac bogga" publishing workflow, and the
// tracker below only reports success once the change can be read back from www.wartabiyetv.com itself.
(function () {
  'use strict';
  var VIEWS = window.WTV_VIEWS = {};
  var GH = '/api/github/api/v3', GQL = '/api/github/api/graphql';
  var LANGS = [['en', 'English'], ['ar', 'Arabic'], ['fr', 'French'], ['nl', 'Dutch'], ['it', 'Italian'], ['de', 'German'], ['tr', 'Turkish'], ['es', 'Spanish']];
  var SECTIONS = [['somalia', 'Somalia & East Africa'], ['world', 'World'], ['sports', 'Sports']];
  var W = function () { return window.WTV; };
  var h = function () { return W().h.apply(null, arguments); };
  var repo = function () { var m = W().me(); return (m && m.repo) || 'Mahadupdalla/wartabiye-tv'; };
  var site = function () { return W().site().replace(/\/?$/, '/'); };

  // ------------------------------------------------------------------ GitHub (through the secure proxy)
  function gh(method, path, body) {
    return fetch(GH + path, { method: method, credentials: 'same-origin', headers: { Accept: 'application/vnd.github+json', 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined })
      .then(function (r) {
        if (r.status === 401) { location.href = '/login?e=expired'; throw new Error('signed out'); }
        return r.text().then(function (t) { var j = null; try { j = t ? JSON.parse(t) : null; } catch (e) {} if (!r.ok) { var er = new Error((j && j.message) || ('GitHub answered ' + r.status)); er.status = r.status; throw er; } return j; });
      });
  }
  function gql(query, variables, tries) {
    tries = tries == null ? 2 : tries;
    return gql1(query, variables).catch(function (e) {
      if (tries > 0 && /50[234]|timeout|Failed to fetch/i.test(e.message)) return new Promise(function (r) { setTimeout(r, 1500); }).then(function () { return gql(query, variables, tries - 1); });
      throw e;
    });
  }
  function gql1(query, variables) {
    return fetch(GQL, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: query, variables: variables || {} }) })
      .then(function (r) { if (r.status === 401) { location.href = '/login?e=expired'; throw new Error('signed out'); } if (!r.ok) throw new Error('GitHub answered ' + r.status); return r.json(); })
      .then(function (j) { if (j.errors && !j.data) throw new Error(j.errors[0].message); return j.data; });
  }
  var utf8 = function (s) { return new TextEncoder().encode(s); };
  function b64(bytes) { var s = '', c = 0x8000; for (var i = 0; i < bytes.length; i += c) s += String.fromCharCode.apply(null, bytes.subarray(i, i + c)); return btoa(s); }
  // the id Git gives a file's content (to spot an identical photo that is already in the library)
  function gitBlobSha(bytes) {
    var head = utf8('blob ' + bytes.length + '\0'), all = new Uint8Array(head.length + bytes.length); all.set(head); all.set(bytes, head.length);
    return crypto.subtle.digest('SHA-1', all).then(function (d) { return Array.from(new Uint8Array(d)).map(function (x) { return x.toString(16).padStart(2, '0'); }).join(''); });
  }

  // one commit on main with several files: [{path, text | bytes | delete: true, expect: <blob sha when loaded> }]
  function commitFiles(changes, message, branch) {
    var R = '/repos/' + repo(), B = branch || 'main';
    return Promise.all(changes.map(function (c) {
      if (c.delete) return null;
      var body = c.bytes ? { content: b64(c.bytes), encoding: 'base64' } : { content: c.text, encoding: 'utf-8' };
      return gh('POST', R + '/git/blobs', body).then(function (b) { return b.sha; });
    })).then(function (blobs) {
      var attempt = 0;
      function once() {
        return gh('GET', R + '/git/ref/heads/' + B).then(function (ref) {
          var head = ref.object.sha;
          // stop if somebody (or the automation) changed one of these files after it was opened here
          return Promise.all(changes.map(function (c) {
            if (c.expect === undefined) return null;
            return gh('GET', R + '/contents/' + c.path.split('/').map(encodeURIComponent).join('/') + '?ref=' + head).then(function (f) { return f.sha; }, function (e) { if (e.status === 404) return null; throw e; })
              .then(function (now) { if ((now || null) !== (c.expect || null)) { var er = new Error(c.path + ' was changed on the website after you opened it. Reload, check the newest version and save again.'); er.conflict = true; throw er; } });
          })).then(function () { return gh('GET', R + '/git/commits/' + head); }).then(function (cm) {
            var tree = changes.map(function (c, i) { return { path: c.path, mode: '100644', type: 'blob', sha: c.delete ? null : blobs[i] }; });
            return gh('POST', R + '/git/trees', { base_tree: cm.tree.sha, tree: tree });
          }).then(function (t) { return gh('POST', R + '/git/commits', { message: message, tree: t.sha, parents: [head] }); })
            .then(function (nc) { return gh('PATCH', R + '/git/refs/heads/' + B, { sha: nc.sha, force: false }).then(function () { return nc; }); });
        }).catch(function (e) {
          // the automation pushed in between: build the commit again on the new head
          if (!e.conflict && (e.status === 422 || e.status === 409) && attempt++ < 4) return new Promise(function (r) { setTimeout(r, 1500 * attempt); }).then(once);
          throw e;
        });
      }
      return once();
    });
  }

  // ------------------------------------------------------------------ the website's content, read from the repository
  var STORE = null, loading = null, TEXTCACHE = {};
  var Q = 'query($o:String!,$n:String!){repository(owner:$o,name:$n){ref(qualifiedName:"refs/heads/main"){target{oid}}' +
    'news:object(expression:"main:data/news"){... on Tree{entries{name oid}}}' +
    'trash:object(expression:"main:data/trash/news"){... on Tree{entries{name oid}}}' +
    'site:object(expression:"main:data/site.json"){... on Blob{oid text}}' +
    'imgs:object(expression:"main:img/news"){... on Tree{entries{name oid type object{... on Blob{byteSize}}}}}}}';
  function load(force) {
    if (STORE && !force) return Promise.resolve(STORE);
    if (loading && !force) return loading;
    var p = repo().split('/');
    // the file list first (small), then the article texts in batches: one huge query can time out on GitHub's side
    var texts = TEXTCACHE;   // a blob's text never changes: kept by its id between loads
    function fillTexts(R) {
      var es = ((R.news && R.news.entries) || []).concat((R.trash && R.trash.entries) || []).filter(function (e) { return /\.json$/.test(e.name) && !texts[e.oid]; });
      var batches = []; for (var i = 0; i < es.length; i += 70) batches.push(es.slice(i, i + 70));
      var run = function (b) { return gql('query($o:String!,$n:String!){repository(owner:$o,name:$n){' + b.map(function (e, j) { return 'b' + j + ':object(oid:"' + e.oid + '"){... on Blob{text}}'; }).join('') + '}}', { o: p[0], n: p[1] })
        .then(function (d) { b.forEach(function (e, j) { var o = d.repository['b' + j]; if (o) texts[e.oid] = o.text; }); }); };
      var q = batches.slice(), workers = [];
      for (var w = 0; w < 4; w++) workers.push((function next() { var b = q.shift(); return b ? run(b).then(next) : Promise.resolve(); })());
      return Promise.all(workers).then(function () {
        [R.news, R.trash].forEach(function (t) { ((t && t.entries) || []).forEach(function (e) { e.object = { text: texts[e.oid] }; }); });
        return R;
      });
    }
    loading = Promise.all([
      gql(Q, { o: p[0], n: p[1] }).then(function (d) { return fillTexts(d.repository).then(function () { return d; }); }),
      fetch(site() + 'data/news.json?cb=' + Date.now(), { cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; }),
    ]).then(function (r) {
      var R = r[0].repository, live = {};
      ((r[1] && r[1].news) || []).forEach(function (x) { live[x.id] = x; });
      function parse(e) { try { var a = JSON.parse(e.object.text); a._file = 'data/news/' + e.name; a._sha = e.oid; if (!a.id) a.id = e.name.replace(/\.json$/, ''); return a; } catch (x) { return null; } }
      var arts = ((R.news && R.news.entries) || []).filter(function (e) { return /\.json$/.test(e.name) && e.object && e.object.text; }).map(parse).filter(Boolean);
      var trash = ((R.trash && R.trash.entries) || []).filter(function (e) { return /\.json$/.test(e.name) && e.object && e.object.text; }).map(function (e) { var a = parse(e); if (a) a._file = 'data/trash/news/' + e.name; return a; }).filter(Boolean);
      arts.sort(function (a, b) { return String(b.publishedAt || '').localeCompare(String(a.publishedAt || '')); });
      trash.sort(function (a, b) { return String(b.deletedAt || '').localeCompare(String(a.deletedAt || '')); });
      var siteJ = null; try { siteJ = JSON.parse(R.site.text); } catch (e) {}
      var imgs = ((R.imgs && R.imgs.entries) || []).filter(function (e) { return e.type === 'blob' && /\.(jpe?g|png|webp|gif|avif)$/i.test(e.name); })
        .map(function (e) { return { path: 'img/news/' + e.name, name: e.name, sha: e.oid, size: e.object && e.object.byteSize }; });
      STORE = { head: R.ref.target.oid, articles: arts, trash: trash, site: siteJ, siteSha: R.site.oid, images: imgs, live: live, liveAt: r[1] && r[1].updatedAt, at: Date.now() };
      return STORE;
    }).finally(function () { loading = null; });
    return loading;
  }
  function usedBy(img, exceptId) { return STORE.articles.filter(function (a) { return a.image === img && a.id !== exceptId; }); }
  function featuredIds() { return ((STORE.site && STORE.site.featured) || []).map(function (f) { return typeof f === 'string' ? f : f && f.article; }).filter(Boolean); }
  function status(a) {
    if (a.published !== false) return { k: 'pub', t: 'Published' };
    if (a.publishAt) return { k: 'sched', t: 'Scheduled ' + fmtDate(a.publishAt) };
    if (a.heldBy) return { k: 'held', t: 'Held by the publish check' };
    if (a.imagePending) return { k: 'photo', t: 'Waiting for photo' };
    return { k: 'draft', t: 'Draft' };
  }
  function articleUrl(id) { return site() + 'war/' + encodeURIComponent(id) + '.html'; }
  function thumb(path) { if (!path) return ''; var m = String(path).match(/^img\/news\/([^/]+)\.(jpe?g|png|webp)$/i); return site() + (m ? 'img/news/w480/' + m[1] + '.webp' : path); }
  function full(path) { return path ? site() + path : ''; }
  function json2(o) { var c = {}; for (var k in o) if (k.charAt(0) !== '_') c[k] = o[k]; return JSON.stringify(c, null, 2) + '\n'; }
  function fmtDate(iso) { var d = new Date(iso); return isNaN(d) ? '—' : d.toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Mogadishu' }); }
  // a date as Mogadishu wall-clock time (UTC+3) for a datetime-local field
  function toLocal(iso) { var d = new Date(iso); return isNaN(d) ? '' : new Date(d.getTime() + 3 * 3600e3).toISOString().slice(0, 16); }
  function nowMogadishu() { var d = new Date(Date.now() + 3 * 3600e3); return d.toISOString().slice(0, 19) + '+03:00'; }
  function slug(t) { return String(t || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').split('-').slice(0, 7).join('-') || 'war'; }

  // ------------------------------------------------------------------ publication tracker (bottom right)
  var TR = null;
  function trackerBox() {
    var b = document.getElementById('pubTrack');
    if (!b) { b = h('aside', { id: 'pubTrack', class: 'pubtrack', role: 'status', 'aria-live': 'polite' }); document.body.append(b); }
    return b;
  }
  function drawTracker() {
    var b = trackerBox(); b.innerHTML = '';
    if (!TR) { b.hidden = true; return; }
    b.hidden = false;
    var steps = [['saved', 'Saved to the website files'], ['build', 'Website is being rebuilt'], ['live', 'Visible on wartabiyetv.com']];
    var idx = { saved: 0, build: 1, live: 2, done: 3 }[TR.step] || 0;
    b.append(h('div', { class: 'pt-h' }, h('b', { text: TR.label }), h('button', { class: 'iconbtn', type: 'button', 'aria-label': 'Close', html: W().ic('x'), onclick: function () { if (TR.step === 'done' || TR.error) { TR = null; save(); } else b.classList.toggle('min'); drawTracker(); } })));
    var ol = h('ol', { class: 'pt-steps' });
    steps.forEach(function (s, i) {
      var st = TR.error && i === idx ? 'bad' : i < idx ? 'ok' : i === idx ? 'on' : '';
      ol.append(h('li', { class: st }, h('span', { class: 'pt-dot', html: st === 'ok' ? W().ic('check') : st === 'bad' ? W().ic('x') : '' }), h('span', { text: s[1] })));
    });
    b.append(ol);
    if (TR.note) b.append(h('p', { class: 'pt-note', text: TR.note }));
    if (TR.error) b.append(h('p', { class: 'pt-err', text: TR.error }));
    if (TR.step === 'done' && TR.link) b.append(h('a', { class: 'btn primary small', href: TR.link, target: '_blank', rel: 'noopener', html: W().ic('ext') + '<span>Open on wartabiyetv.com</span>' }));
  }
  function save() { try { if (TR) sessionStorage.setItem('wtv-track', JSON.stringify(TR)); else sessionStorage.removeItem('wtv-track'); } catch (e) {} }
  // check = {id, expect: 'present'|'absent', title} or {siteFeatured: [...ids]}
  function track(label, commit, check, link, noBuild) {
    TR = { label: label, sha: commit.sha, at: Date.now(), step: 'build', check: check, link: link, noBuild: !!noBuild, note: noBuild ? 'Saved. The website reads it within a few minutes.' : 'Saved. Publishing usually takes 2–5 minutes.' };
    save(); drawTracker(); poll();
  }
  var pollT = 0;
  function poll() {
    clearTimeout(pollT);
    if (!TR || TR.step === 'done' || TR.error) return;
    if (TR.noBuild) return liveCheck().then(function (live) {
      if (live) { TR.step = 'done'; TR.note = 'Checked on the live data ' + new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) + '.'; }
      else TR.note = 'Waiting for the website to read the new version…';
      if (!live && Date.now() - TR.at > 20 * 60000) TR.error = 'Saved, but the website did not show it within 20 minutes. Nothing is lost: check News automation.';
    }).catch(function () {}).then(function () { save(); drawTracker(); if (TR && TR.step !== 'done' && !TR.error) pollT = setTimeout(poll, 15000); });
    var since = new Date(TR.at - 60000).toISOString();
    gh('GET', '/repos/' + repo() + '/actions/workflows/publish.yml/runs?per_page=10&created=%3E%3D' + encodeURIComponent(since)).then(function (j) {
      var runs = (j && j.workflow_runs) || [];
      var mine = runs.filter(function (r) { return Date.parse(r.created_at) >= TR.at - 30000; });
      var ok = mine.filter(function (r) { return r.conclusion === 'success'; });
      var failed = mine.filter(function (r) { return r.status === 'completed' && r.conclusion === 'failure'; });
      var running = mine.filter(function (r) { return r.status !== 'completed'; });
      if (running.length) TR.note = 'Website rebuild running (started ' + W().ago(running[0].run_started_at || running[0].created_at) + ').';
      else if (!mine.length) TR.note = 'Waiting for the website rebuild to start…';
      if (failed.length && !running.length && !ok.length) { TR.error = 'The website rebuild stopped with an error, so the change is saved but not visible yet. Open Automation Status for details; nothing was lost.'; save(); return drawTracker(); }
      return liveCheck().then(function (live) {
        if (live) { TR.step = 'done'; TR.note = 'Checked on wartabiyetv.com ' + new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) + '.'; }
        else if (ok.length) TR.note = 'Rebuilt. Waiting for wartabiyetv.com to show the new version (the website cache can take a few minutes)…';
        if (!live && Date.now() - TR.at > 25 * 60000) TR.error = 'The change is saved, but wartabiyetv.com did not show it within 25 minutes. Check Automation Status.';
      });
    }).catch(function (e) { TR.note = 'Checking… (' + e.message + ')'; }).then(function () { save(); drawTracker(); if (TR && TR.step !== 'done' && !TR.error) pollT = setTimeout(poll, 15000); else if (TR && TR.step === 'done') { load(true).catch(function () {}); } });
  }
  function liveCheck() {
    var c = TR.check || {};
    if (c.url) return fetch(c.url + (c.url.indexOf('?') < 0 ? '?' : '&') + 'cb=' + Date.now(), { cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (j) {
      if (!j) return false;
      if (c.item) { var it = (j[c.list || 'items'] || []).find(function (x) { return x.id === c.item; }); return c.absent ? !it : !!it && (!c.title || JSON.stringify(it).indexOf(c.title) >= 0); }
      return JSON.stringify(j[c.field]) === JSON.stringify(c.value);
    }).catch(function () { return false; });
    if (c.siteFeatured) return fetch(site() + 'data/site.json?cb=' + Date.now(), { cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (s) { return !!s && JSON.stringify(s[c.field || 'featured']) === JSON.stringify(c.value); }).catch(function () { return false; });
    return fetch(site() + 'data/news.json?cb=' + Date.now(), { cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (j) {
      if (!j) return false;
      var a = (j.news || []).find(function (x) { return x.id === c.id; });
      if (c.expect === 'absent') return !a;
      if (!a || (c.title && a.title !== c.title) || (c.image !== undefined && (a.image || '') !== (c.image || ''))) return false;
      return fetch(articleUrl(c.id) + '?cb=' + Date.now(), { cache: 'no-store' }).then(function (r) { return r.ok; });
    }).catch(function () { return false; });
  }
  try { TR = JSON.parse(sessionStorage.getItem('wtv-track') || 'null'); } catch (e) {}
  addEventListener('DOMContentLoaded', function () { if (TR) { drawTracker(); poll(); } });

  // ------------------------------------------------------------------ small UI pieces
  function toast(msg, bad) { var t = h('div', { class: 'toast' + (bad ? ' bad' : ''), role: 'status', text: msg }); document.body.append(t); setTimeout(function () { t.remove(); }, 5200); }
  function chip(k, t) { return h('span', { class: 'chip st-' + k, text: t }); }
  function field(label, input, hint) { return h('label', { class: 'fld' }, h('span', { class: 'fl', text: label }), input, hint ? h('small', { class: 'hint', text: hint }) : null); }
  function inp(v, attrs) { var e = h('input', Object.assign({ class: 'in', type: 'text' }, attrs || {})); e.value = v == null ? '' : v; return e; }
  function area(v, rows) { var e = h('textarea', { class: 'in', rows: rows || 4 }); e.value = v == null ? '' : v; return e; }
  function sel(v, opts) { var e = h('select', { class: 'in' }); opts.forEach(function (o) { var op = h('option', { value: o[0], text: o[1] }); if (String(o[0]) === String(v == null ? '' : v)) op.selected = true; e.append(op); }); return e; }
  function check(v, label) { var c = h('input', { type: 'checkbox' }); c.checked = !!v; return h('label', { class: 'chk' }, c, h('span', { text: label })); }
  function loadingBox(msg) { return h('div', { class: 'card' }, h('div', { class: 'skel', style: 'height:18px;width:40%;margin-bottom:12px' }), h('p', { class: 'sub', text: msg || 'Loading the website content…' }), h('div', { class: 'skel', style: 'height:300px' })); }
  function failBox(el, e, retry) { el.innerHTML = ''; var b = W().errBox(e); el.append(b, h('p', null, h('button', { class: 'btn', type: 'button', text: 'Try again', onclick: retry }))); }

  // ------------------------------------------------------------------ Articles
  var F = { q: '', section: '', st: '', tab: 'all', limit: 60, lang: '', from: '', to: '' };
  function renderList(el, preset) {
    F.section = preset || ''; F.limit = 60;
    el.innerHTML = ''; el.append(loadingBox());
    var params = new URLSearchParams(location.hash.split('?')[1] || '');
    load().then(function () {
      if (params.has('new')) return openEditor(el, null);
      if (params.get('edit')) { var a = STORE.articles.find(function (x) { return x.id === params.get('edit'); }); if (a) return openEditor(el, a); }
      drawList(el);
    }).catch(function (e) { failBox(el, e, function () { renderList(el, preset); }); });
  }
  function drawList(el) {
    el.innerHTML = '';
    var fe = featuredIds();
    var head = h('div', { class: 'hero' }, h('div', null, h('h2', { text: F.section ? (SECTIONS.find(function (s) { return s[0] === F.section; }) || [, 'Articles'])[1] + ' news' : 'All articles' }),
      h('p', { text: STORE.articles.length + ' articles in the website files (' + STORE.articles.filter(function (a) { return a.published !== false; }).length + ' published). This is the same content readers see on wartabiyetv.com.' })),
      h('div', { class: 'actions' },
        h('button', { class: 'btn primary', type: 'button', html: W().ic('plus') + '<span>New article</span>', onclick: function () { openEditor(el, null); } }),
        h('button', { class: 'btn', type: 'button', html: W().ic('refresh') + '<span>Reload</span>', onclick: function () { el.innerHTML = ''; el.append(loadingBox()); load(true).then(function () { drawList(el); }, function (e) { failBox(el, e, function () { drawList(el); }); }); } })));
    el.append(head);
    var tabs = h('div', { class: 'seg', role: 'tablist' });
    [['all', 'All'], ['pub', 'Published'], ['sched', 'Scheduled'], ['draft', 'Drafts'], ['photo', 'Waiting for photo'], ['held', 'Held'], ['trash', 'Recently deleted']].forEach(function (t) {
      tabs.append(h('button', { type: 'button', 'aria-pressed': String(F.tab === t[0]), text: t[1], onclick: function () { F.tab = t[0]; F.limit = 60; drawList(el); } }));
    });
    var q = inp(F.q, { type: 'search', placeholder: 'Search headline, text or id…', 'aria-label': 'Search articles' });
    q.addEventListener('input', function () { F.q = q.value; F.limit = 60; drawRows(); });
    var sec = sel(F.section, [['', 'All sections']].concat(SECTIONS)); sec.addEventListener('change', function () { F.section = sec.value; drawRows(); });
    var cats = ((STORE.site && STORE.site.categories) || []).map(function (c) { return [c, c]; });
    var cat = sel('', [['', 'All categories']].concat(cats)); cat.addEventListener('change', drawRows);
    var lang = sel(F.lang, [['', 'All languages']].concat(LANGS.map(function (l) { return ['has:' + l[0], 'Has ' + l[1]]; })).concat(LANGS.map(function (l) { return ['no:' + l[0], 'Missing ' + l[1]]; })));
    lang.setAttribute('aria-label', 'Filter by translation'); lang.addEventListener('change', function () { F.lang = lang.value; drawRows(); });
    var from = inp(F.from, { type: 'date', 'aria-label': 'From date' }), to = inp(F.to, { type: 'date', 'aria-label': 'To date' });
    from.addEventListener('change', function () { F.from = from.value; drawRows(); }); to.addEventListener('change', function () { F.to = to.value; drawRows(); });
    el.append(h('div', { class: 'card toolbar' }, tabs, h('div', { class: 'tb-row' }, q, sec, cat, lang), h('div', { class: 'tb-row' }, h('span', { class: 'sub', text: 'Date (Mogadishu):' }), from, h('span', { class: 'sub', text: 'to' }), to,
      h('button', { class: 'btn small ghost', type: 'button', text: 'Clear filters', onclick: function () { F.q = ''; F.lang = ''; F.from = ''; F.to = ''; F.section = ''; drawList(el); } }))));
    var list = h('div', { class: 'alist' }); el.append(list);
    function drawRows() {
      list.innerHTML = '';
      var src = F.tab === 'trash' ? STORE.trash : STORE.articles;
      var term = F.q.trim().toLowerCase();
      var rows = src.filter(function (a) {
        if (F.tab !== 'all' && F.tab !== 'trash' && status(a).k !== F.tab) return false;
        if (F.section && (a.section || 'somalia') !== F.section) return false;
        if (cat.value && a.category !== cat.value) return false;
        if (F.lang) { var lp = F.lang.split(':'), has = !!(a[lp[1]] && a[lp[1]].title); if ((lp[0] === 'has') !== has) return false; }
        var day = toLocal(a.publishAt || a.publishedAt).slice(0, 10);
        if (F.from && day < F.from) return false;
        if (F.to && day > F.to) return false;
        if (term && (a.title + ' ' + a.summary + ' ' + a.id + ' ' + (a.body || '')).toLowerCase().indexOf(term) < 0) return false;
        return true;
      });
      if (!rows.length) { list.append(h('div', { class: 'empty', text: F.tab === 'trash' ? 'Nothing deleted. Articles you delete here wait in this list so you can restore them.' : 'No article matches.' })); return; }
      rows.slice(0, F.limit).forEach(function (a) { list.append(row(a)); });
      if (rows.length > F.limit) list.append(h('button', { class: 'btn', type: 'button', style: 'margin:12px auto;display:flex', text: 'Show more (' + (rows.length - F.limit) + ' more)', onclick: function () { F.limit += 100; drawRows(); } }));
    }
    function row(a) {
      var st = status(a), pinned = fe.indexOf(a.id) >= 0, onSite = !!STORE.live[a.id], trash = F.tab === 'trash';
      var img = a.image ? h('img', { src: thumb(a.image), alt: '', loading: 'lazy', onerror: function () { this.onerror = null; this.src = full(a.image); } }) : h('div', { class: 'noimg', text: 'No photo' });
      var meta = h('div', { class: 'ameta' }, chip(st.k, trash ? 'Deleted' : st.t), a.breaking ? chip('brk', 'Breaking') : null, pinned ? chip('pin', (fe.indexOf(a.id) === 0 ? 'Lead story' : 'Pinned')) : null,
        h('span', { text: (SECTIONS.find(function (s) { return s[0] === (a.section || 'somalia'); }) || [, ''])[1] + ' · ' + (a.category || '—') + ' · ' + fmtDate(trash ? a.deletedAt : a.publishedAt) }),
        h('span', { class: 'by', text: a.by === 'admin' ? 'by you' : 'automatic' }), !trash && st.k === 'pub' ? h('span', { class: onSite ? 'live ok' : 'live', text: onSite ? '● on the website' : '○ not on the website yet' }) : null);
      var acts = h('div', { class: 'aacts' });
      if (trash) acts.append(h('button', { class: 'btn small primary', type: 'button', text: 'Restore', onclick: function () { restore(a, el); } }));
      else {
        acts.append(h('button', { class: 'btn small primary', type: 'button', text: 'Edit', onclick: function () { openEditor(el, a); } }));
        if (onSite) acts.append(h('a', { class: 'btn small', href: articleUrl(a.id), target: '_blank', rel: 'noopener', text: 'View' }));
        acts.append(h('button', { class: 'btn small', type: 'button', text: pinned ? 'Unpin' : 'Pin to homepage', onclick: function () { togglePin(a, el); } }));
      }
      return h('div', { class: 'arow' }, h('div', { class: 'athumb' }, img), h('div', { class: 'abody' }, h('b', { class: 'atitle', text: a.title || a.id }), h('p', { class: 'asum', text: a.summary || '' }), meta), acts);
    }
    drawRows();
  }

  function togglePin(a, el) {
    // keep every other pin exactly as saved (string or {article: …})
    var fe = ((STORE.site && STORE.site.featured) || []).slice(), i = featuredIds().indexOf(a.id);
    if (i >= 0) fe = fe.filter(function (f) { return (typeof f === 'string' ? f : f && f.article) !== a.id; }); else fe.push(a.id);
    saveSite({ featured: fe }, (i >= 0 ? 'Maamul: ka saar bogga hore "' : 'Maamul: ku dheji bogga hore "') + a.id + '"', i >= 0 ? 'Unpinned from the homepage' : 'Pinned to the homepage').then(function () { drawList(el); });
  }
  function saveSite(patch, msg, label) {
    var s = JSON.parse(JSON.stringify(STORE.site || {}));
    for (var k in patch) s[k] = patch[k];
    return commitFiles([{ path: 'data/site.json', text: JSON.stringify(s, null, 2) + '\n', expect: STORE.siteSha }], msg).then(function (c) {
      STORE.site = s; return load(true).then(function () {
        var key = Object.keys(patch)[0];
        track(label, c, { siteFeatured: true, field: key, value: patch[key] }, site());
      });
    }).catch(function (e) { toast(e.message, true); throw e; });
  }

  function restore(a, el) {
    var id = a.id, art = Object.assign({}, a); delete art.deletedAt; delete art.deletedFrom;
    if (STORE.articles.some(function (x) { return x.id === id; })) return toast('An article with this id already exists.', true);
    commitFiles([{ path: 'data/news/' + id + '.json', text: json2(art), expect: null }, { path: a._file, delete: true, expect: a._sha }], 'Maamul: soo celi "' + id + '"').then(function (c) {
      track('Restored: ' + (a.title || id), c, art.published !== false ? { id: id, expect: 'present', title: art.title } : { id: id, expect: 'absent' }, articleUrl(id));
      return load(true);
    }).then(function () { F.tab = 'all'; drawList(el); }).catch(function (e) { toast(e.message, true); });
  }

  // ------------------------------------------------------------------ the article editor
  function openEditor(el, a) {
    var isNew = !a;
    var art = a ? JSON.parse(JSON.stringify(a)) : { title: '', summary: '', body: '', category: ((STORE.site && STORE.site.categories) || ['Siyaasadda'])[0], section: F.section || 'somalia', publishedAt: nowMogadishu(), published: false, breaking: false, important: false, source: 'Wartabiye TV', by: 'admin', timeVerified: true };
    var newPhoto = null;   // {bytes, path, sha, url}
    el.innerHTML = '';
    var back = h('button', { class: 'btn', type: 'button', text: '← All articles', onclick: function () { if (!dirty || confirm('Leave without saving your changes?')) drawList(el); } });
    var dirty = false;
    var form = h('div', { class: 'editor' });
    el.append(h('div', { class: 'ed-top' }, back, h('h2', { text: isNew ? 'New article' : 'Edit article' }), !isNew ? chip(status(a).k, status(a).t) : null,
      !isNew && STORE.live[a.id] ? h('a', { class: 'btn small', href: articleUrl(a.id), target: '_blank', rel: 'noopener', html: W().ic('ext') + '<span>View on website</span>' }) : null), form);

    var title = inp(art.title, { maxlength: 160 }), summary = area(art.summary, 3), body = area(art.body, 10);
    var section = sel(art.section || 'somalia', SECTIONS);
    var cats = ((STORE.site && STORE.site.categories) || []).map(function (c) { return [c, c]; }); if (art.category && !cats.some(function (c) { return c[0] === art.category; })) cats.push([art.category, art.category]);
    var category = sel(art.category, cats);
    var dt = inp(toLocal(art.publishedAt), { type: 'datetime-local' });
    var breaking = check(art.breaking, 'Breaking (red label for 12 hours)'), important = check(art.important, 'Important (in “Muhiim hadda” for 72 hours)');
    var source = inp(art.source), sourceUrl = inp(art.sourceUrl, { type: 'url', placeholder: 'https://…' });
    var alt = inp(art.imageAlt), credit = inp(art.imageCredit), license = inp(art.imageLicense), srcUrl = inp(art.imageSourceUrl, { type: 'url' });
    var focus = sel(art.imageFocus || 'center', [['center', 'Centre'], ['top', 'Top (faces)'], ['bottom', 'Bottom'], ['left', 'Left'], ['right', 'Right']]);
    var kind = sel(art.imageKind || '', [['', '—'], ['actual', 'Photo of the event'], ['illustrative', 'Illustration / file photo']]);

    var main = h('div', { class: 'card ed-main' }, h('h3', { text: 'Somali (main text)' }),
      field('Headline', title, 'Under 120 characters works best.'), field('Summary', summary, '1–2 sentences, shown on the cards.'), field('Full text (optional)', body, 'Your own words; never copy another outlet\'s text.'));
    // translations
    var trBox = h('div', { class: 'card' }, h('h3', { text: 'Translations' }), h('p', { class: 'sub', text: 'The photo, category and links are shared by all nine languages. Edited translations are marked as checked by you.' }));
    var trTabs = h('div', { class: 'seg' }), trPane = h('div'), trInputs = {};
    LANGS.forEach(function (l, i) {
      var t = art[l[0]] || {};
      trInputs[l[0]] = { title: inp(t.title), summary: area(t.summary, 3), body: area(t.body, 6), imageAlt: inp(t.imageAlt), orig: JSON.stringify([t.title || '', t.summary || '', t.body || '', t.imageAlt || '']) };
      var p = h('div', { class: 'trp', hidden: i > 0 }, field('Headline (' + l[1] + ')', trInputs[l[0]].title), field('Summary (' + l[1] + ')', trInputs[l[0]].summary), field('Full text (' + l[1] + ')', trInputs[l[0]].body), field('Photo description (' + l[1] + ')', trInputs[l[0]].imageAlt),
        h('small', { class: 'hint', text: t.status === 'auto' ? 'Machine translation. Saving a change marks it as checked by you.' : t.title ? 'Checked by you.' : 'No translation yet: the automatic translator adds one, or write it here.' }));
      if (l[0] === 'ar') p.dir = 'rtl';
      trPane.append(p);
      trTabs.append(h('button', { type: 'button', 'aria-pressed': String(i === 0), text: l[1], onclick: function () { [].forEach.call(trPane.children, function (c, j) { c.hidden = j !== i; }); [].forEach.call(trTabs.children, function (b, j) { b.setAttribute('aria-pressed', String(j === i)); }); } }));
    });
    trBox.append(trTabs, trPane);
    // photo
    var ph = h('div', { class: 'ed-photo' });
    function drawPhoto() {
      ph.innerHTML = '';
      var src = newPhoto ? newPhoto.url : art.image ? full(art.image) : '';
      ph.append(src ? h('img', { src: src, alt: '' }) : h('div', { class: 'noimg big', text: 'No photo. A published article needs its own photo.' }));
      var others = art.image && !newPhoto ? usedBy(art.image, art.id) : [];
      if (others.length) ph.append(h('p', { class: 'pt-err', text: 'This photo is also used by: ' + others.map(function (o) { return o.title; }).join(', ') + '. Every article needs its own photo.' }));
      ph.append(h('div', { class: 'row' },
        h('button', { class: 'btn small primary', type: 'button', text: src ? 'Replace: upload new' : 'Upload photo', onclick: function () { pickFile(function (f) { cropDialog(f, art.id || slug(title.value), function (res) { newPhoto = res; dirty = true; drawPhoto(); }); }); } }),
        h('button', { class: 'btn small', type: 'button', text: 'Choose from library', onclick: function () { libraryPicker(art.id, function (img) { newPhoto = null; art.image = img.path; dirty = true; drawPhoto(); }); } }),
        src ? h('button', { class: 'btn small', type: 'button', text: 'Remove photo', onclick: function () { newPhoto = null; art.image = ''; dirty = true; drawPhoto(); } }) : null));
    }
    drawPhoto();
    var photoCard = h('div', { class: 'card' }, h('h3', { text: 'Photo' }), ph, field('Photo description (alt text)', alt, 'What the photo shows, for blind readers and Google.'),
      h('div', { class: 'two' }, field('Photo by (credit)', credit), field('Licence', license, 'e.g. “Own photo”, “CC BY 4.0”, “Used with permission”.')),
      h('div', { class: 'two' }, field('Where the photo comes from (link)', srcUrl), field('Kind', kind)), field('Keep this part visible when cropped', focus));
    var side = h('div', { class: 'card' }, h('h3', { text: 'Publishing' }), field('Section', section), field('Category', category), field('Date and time (Mogadishu)', dt, 'Correct it only when the original time was wrong.'), breaking, important,
      field('Source (outlet)', source), field('Source link', sourceUrl));
    var errs = h('div', { class: 'ed-errs', role: 'alert' });
    var prev = h('div', { class: 'card ed-prev', hidden: true });
    var bar = h('div', { class: 'ed-bar' });
    var hist = isNew ? null : historyCard(a);
    form.append(h('div', { class: 'ed-grid' }, h('div', null, main, trBox), h('div', null, side, photoCard, hist)), prev, errs, bar);
    form.addEventListener('input', function () { dirty = true; }); form.addEventListener('change', function () { dirty = true; });

    function collect(publish) {
      var n = JSON.parse(JSON.stringify(art));
      n.title = title.value.trim(); n.summary = summary.value.trim();
      if (body.value.trim()) n.body = body.value.trim(); else delete n.body;
      // fields the article did not have are only added when they say something (a correction keeps the file as it was)
      function put(k, v, dflt) { if (k in art || v !== dflt) n[k] = v; }
      put('section', section.value, 'somalia'); n.category = category.value;
      if (dt.value) { var old = String(art.publishedAt || ''); n.publishedAt = toLocal(old) === dt.value ? old : dt.value + ':00+03:00'; }
      put('breaking', breaking.firstChild.checked, false); put('important', important.firstChild.checked, false);
      put('source', source.value.trim(), ''); if (sourceUrl.value.trim()) n.sourceUrl = sourceUrl.value.trim(); else delete n.sourceUrl;
      ['imageAlt', 'imageCredit', 'imageLicense', 'imageSourceUrl', 'imageKind', 'imageFocus'].forEach(function (k, i) { var v = [alt, credit, license, srcUrl, kind, focus][i].value.trim(); if (k === 'imageFocus' && v === 'center' && !(k in art)) v = ''; if (v) n[k] = v; else delete n[k]; });
      if (newPhoto) n.image = newPhoto.path;
      if (!n.image) delete n.image;
      LANGS.forEach(function (l) {
        var I = trInputs[l[0]], vals = [I.title.value.trim(), I.summary.value.trim(), I.body.value.trim(), I.imageAlt.value.trim()];
        if (JSON.stringify(vals) === I.orig) return;
        var t = Object.assign({}, n[l[0]] || {});
        ['title', 'summary', 'body', 'imageAlt'].forEach(function (k, i) { if (vals[i]) t[k] = vals[i]; else delete t[k]; });
        t.status = 'manual';
        if (t.title) n[l[0]] = t; else delete n[l[0]];
      });
      if (publish === true) { n.published = true; delete n.imagePending; delete n.heldBy; delete n.publishAt; }
      if (publish === false) n.published = false;
      if (typeof publish === 'string' && publish.indexOf('schedule:') === 0) { n.published = false; n.publishAt = publish.slice(9); n.publishedAt = n.publishAt; delete n.imagePending; delete n.heldBy; }
      if (isNew) { n.by = 'admin'; n.id = (n.publishedAt || nowMogadishu()).slice(0, 10) + '-' + slug(n.title); var base = n.id, k = 2; while (STORE.articles.some(function (x) { return x.id === n.id; }) || STORE.trash.some(function (x) { return x.id === n.id; })) n.id = base + '-' + k++; }
      return n;
    }
    function validate(n) {
      var e = [];
      if (!n.title) e.push('Write a headline.');
      if (!n.category) e.push('Choose a category.');
      if (isNaN(Date.parse(n.publishedAt))) e.push('The date is not valid.');
      if (n.sourceUrl && !/^https?:\/\//.test(n.sourceUrl)) e.push('The source link must start with https://');
      if (n.published !== false || n.publishAt) {
        if (!n.summary) e.push('Write a summary.');
        if (!n.image) e.push('A published article needs its own photo (upload one or save as draft).');
        else {
          var others = newPhoto ? [] : usedBy(n.image, n.id);
          if (others.length) e.push('This photo is already used by “' + others[0].title + '”. Choose or upload a different photo.');
          if (!n.imageAlt) e.push('Describe the photo (alt text).');
          if (n.by !== 'admin' && (!n.imageCredit || !n.imageLicense)) e.push('Add the photo credit and licence.');
        }
        var dupe = n.sourceUrl && STORE.articles.find(function (x) { return x.id !== n.id && x.published !== false && (x.sourceUrl || '').split('?')[0] === n.sourceUrl.split('?')[0]; });
        if (dupe) e.push('Another published article already uses this source link: “' + dupe.title + '”.');
      }
      return e;
    }
    function doSave(publish, label) {
      var n = collect(publish);
      var e = validate(n);
      errs.innerHTML = '';
      if (e.length) { errs.append(h('div', { class: 'banner bad', html: W().ic('warn') + '<div><b>Not saved yet</b><span></span></div>' })); errs.querySelector('span').textContent = e.join(' '); errs.scrollIntoView({ behavior: 'smooth', block: 'center' }); return; }
      var changes = [{ path: 'data/news/' + n.id + '.json', text: json2(n), expect: isNew ? null : a._sha }];
      if (newPhoto) changes.push({ path: newPhoto.path, bytes: newPhoto.bytes, expect: null });
      busy(true);
      var verb = isNew ? 'war cusub' : n.publishAt ? 'jadwal' : publish === false && a && a.published !== false ? 'ka qari bogga' : 'wax ka beddel';
      commitFiles(changes, 'Maamul: ' + verb + ' "' + n.id + '"').then(function (c) {
        dirty = false;
        track(label + ': ' + n.title, c, n.published !== false ? { id: n.id, expect: 'present', title: n.title, image: n.image } : { id: n.id, expect: 'absent' }, n.published !== false ? articleUrl(n.id) : null);
        toast(n.published !== false ? 'Saved. Publishing to the website now.' : n.publishAt ? 'Scheduled. It goes on the website at ' + fmtDate(n.publishAt) + '.' : 'Saved as draft (not on the website).');
        return load(true).then(function () { var fresh = STORE.articles.find(function (x) { return x.id === n.id; }); if (fresh) openEditor(el, fresh); else drawList(el); });
      }).catch(function (er) { busy(false); errs.innerHTML = ''; errs.append(W().errBox(er)); }).finally(function () { busy(false); });
    }
    function busy(on) { [].forEach.call(bar.querySelectorAll('button'), function (b) { b.disabled = on; }); bar.classList.toggle('busy', on); }
    function preview() {
      var n = collect(null); prev.hidden = false; prev.innerHTML = '';
      var src = newPhoto ? newPhoto.url : n.image ? full(n.image) : '';
      prev.append(h('div', { class: 'card-h' }, h('h3', { text: 'Preview' }), h('button', { class: 'toggle', type: 'button', text: 'Close preview', onclick: function () { prev.hidden = true; } })),
        h('div', { class: 'pv' }, src ? h('div', { class: 'pv-img', style: 'background-image:url("' + src.replace(/"/g, '') + '");background-position:' + (n.imageFocus || 'center') }) : null,
          h('span', { class: 'pv-cat', text: n.category }), h('h1', { text: n.title }), h('p', { class: 'pv-sum', text: n.summary }), n.body ? h('div', { class: 'pv-body', text: n.body }) : null, h('small', { text: fmtDate(n.publishedAt) + (n.imageCredit ? ' · Photo: ' + n.imageCredit : '') })));
      prev.scrollIntoView({ behavior: 'smooth' });
    }
    var pub = !isNew && a.published !== false;
    if (pub) bar.append(
      h('button', { class: 'btn primary', type: 'button', text: 'Update', onclick: function () { doSave(true, 'Updated'); } }),
      h('button', { class: 'btn', type: 'button', text: 'Preview', onclick: preview }),
      h('button', { class: 'btn', type: 'button', text: 'Unpublish', onclick: function () { if (confirm('Take this article off the website? It stays here as a draft.')) doSave(false, 'Unpublished'); } }));
    else bar.append(
      h('button', { class: 'btn primary', type: 'button', text: 'Publish', onclick: function () { doSave(true, 'Published'); } }),
      h('button', { class: 'btn', type: 'button', text: art.publishAt ? 'Change schedule' : 'Schedule', onclick: schedule }),
      h('button', { class: 'btn', type: 'button', text: 'Save draft', onclick: function () { doSave(false, 'Draft saved'); } }),
      h('button', { class: 'btn', type: 'button', text: 'Preview', onclick: preview }));
    if (!isNew) bar.append(h('button', { class: 'btn danger', type: 'button', text: 'Delete', onclick: function () { del(); } }));
    bar.append(h('button', { class: 'btn ghost', type: 'button', text: 'Cancel', onclick: function () { if (!dirty || confirm('Discard your changes?')) drawList(el); } }));
    function schedule() {
      var when = inp(toLocal(art.publishAt || new Date(Date.now() + 3600e3).toISOString()), { type: 'datetime-local' });
      var m = modal('Schedule publishing', h('div', null, h('p', { class: 'sub', text: 'The article is saved now as scheduled (not on the website). It is published automatically at this time (Mogadishu), checked every 15 minutes, so it appears within about 20 minutes of the time you choose.' }), field('Publish at (Mogadishu)', when)),
        [art.publishAt ? h('button', { class: 'btn', type: 'button', text: 'Remove schedule', onclick: function () { m.remove(); delete art.publishAt; doSave(false, 'Schedule removed'); } }) : null,
          h('button', { class: 'btn', type: 'button', text: 'Cancel', onclick: function () { m.remove(); } }),
          h('button', { class: 'btn primary', type: 'button', text: 'Schedule', onclick: function () {
            var t = when.value ? when.value + ':00+03:00' : '';
            if (!t || Date.parse(t) < Date.now() - 60000) return toast('Choose a time in the future.', true);
            m.remove(); doSave('schedule:' + t, 'Scheduled for ' + fmtDate(t));
          } })]);
    }
    function del() {
      if (!confirm('Delete this article? It disappears from the website and waits under “Recently deleted”, where you can restore it.')) return;
      var t = JSON.parse(JSON.stringify(a)); t.deletedAt = new Date().toISOString(); t.deletedFrom = a._file;
      var fe = featuredIds(), changes = [{ path: 'data/trash/news/' + a.id + '.json', text: json2(t), expect: null }, { path: a._file, delete: true, expect: a._sha }];
      if (fe.indexOf(a.id) >= 0) { var s = JSON.parse(JSON.stringify(STORE.site)); s.featured = (s.featured || []).filter(function (f) { return (typeof f === 'string' ? f : f && f.article) !== a.id; }); changes.push({ path: 'data/site.json', text: JSON.stringify(s, null, 2) + '\n', expect: STORE.siteSha }); }
      busy(true);
      commitFiles(changes, 'Maamul: tirtir "' + a.id + '"').then(function (c) { track('Deleted: ' + a.title, c, { id: a.id, expect: 'absent' }, null); return load(true); }).then(function () { drawList(el); })
        .catch(function (er) { busy(false); errs.innerHTML = ''; errs.append(W().errBox(er)); });
    }
  }

  // ------------------------------------------------------------------ article history (the repository's own record)
  function historyCard(a) {
    var body = h('div', null, h('p', { class: 'sub', text: 'Loading…' }));
    var how = [['Written by', a.by === 'admin' ? 'You (dashboard)' : a.by === 'claude' || a.by === 'auto' || !a.by ? 'Automatic news routine' : String(a.by)],
      ['First published', fmtDate(a.publishedAt)], a.updatedAt ? ['Last updated', fmtDate(a.updatedAt)] : null, a.source ? ['Source outlet', a.source] : null,
      a.sourceUrl ? ['Source link', a.sourceUrl] : null, a.verification ? ['Verification', typeof a.verification === 'string' ? a.verification : JSON.stringify(a.verification)] : null].filter(Boolean);
    var card = h('div', { class: 'card' }, h('h3', { text: 'How it was published, and its history' }),
      h('dl', { class: 'kv' }, how.map(function (x) { return [h('dt', { text: x[0] }), h('dd', { text: x[1] })]; })), body);
    var path = a._file || ('data/news/' + a.id + '.json');
    gh('GET', '/repos/' + repo() + '/commits?per_page=30&path=' + encodeURIComponent(path)).then(function (list) {
      body.innerHTML = '';
      if (!list || !list.length) return body.append(h('p', { class: 'sub', text: 'No saved versions found.' }));
      body.append(h('ol', { class: 'hist' }, list.map(function (c, i) {
        var msg = (c.commit.message || '').split('\n')[0], who = /^Maamul:/.test(msg) ? 'You (dashboard)' : /bot|actions/i.test((c.commit.author || {}).name || '') ? 'Automation' : ((c.commit.author || {}).name || 'GitHub');
        return h('li', null, h('b', { text: fmtDate(c.commit.author.date) }), h('span', { text: ' · ' + who }), h('div', { class: 'sub', text: msg }),
          h('div', { class: 'row' }, h('a', { href: c.html_url, target: '_blank', rel: 'noopener', text: 'View this version' }),
            i > 0 ? h('button', { class: 'btn small ghost', type: 'button', text: 'Restore this version', onclick: function () { restoreVersion(a, c, path); } }) : null));
      })));
    }).catch(function (e) { body.innerHTML = ''; body.append(h('p', { class: 'sub', text: 'History could not be loaded: ' + e.message })); });
    return card;
  }

  // recovery: make an earlier saved version of the article the current one again (one new commit; nothing is lost)
  function restoreVersion(a, c, path) {
    if (!confirm('Restore the version of ' + fmtDate(c.commit.author.date) + '? The current version stays in the history.')) return;
    gh('GET', '/repos/' + repo() + '/contents/' + path.split('/').map(encodeURIComponent).join('/') + '?ref=' + c.sha).then(function (f) {
      var bin = atob(String(f.content || '').replace(/\n/g, '')), bytes = new Uint8Array(bin.length);
      for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      var text = new TextDecoder().decode(bytes), old = JSON.parse(text);
      return commitFiles([{ path: path, text: text, expect: a._sha }], 'Maamul: soo celi nooc hore "' + a.id + '"').then(function (cm) {
        track('Restored earlier version: ' + old.title, cm, old.published !== false ? { id: a.id, expect: 'present', title: old.title, image: old.image } : { id: a.id, expect: 'absent' }, old.published !== false ? articleUrl(a.id) : null);
        toast('Earlier version restored. Publishing to the website now.');
        return load(true).then(function () { var fresh = STORE.articles.find(function (x) { return x.id === a.id; }); var el = document.getElementById('v-native'); if (fresh && el) openEditor(el, fresh); });
      });
    }).catch(function (e) { toast(e.message, true); });
  }

  // ------------------------------------------------------------------ photos: upload, crop, resize
  function pickFile(cb) { var f = h('input', { type: 'file', accept: 'image/*' }); f.addEventListener('change', function () { if (f.files[0]) cb(f.files[0]); }); f.click(); }
  function modal(title, bodyEl, actions) {
    var m = h('div', { class: 'modal', role: 'dialog', 'aria-modal': 'true' }, h('div', { class: 'modal-card wide' }, h('div', { class: 'card-h' }, h('h2', { text: title }), h('button', { class: 'iconbtn', type: 'button', 'aria-label': 'Close', html: W().ic('x'), onclick: function () { m.remove(); } })), bodyEl, actions ? h('div', { class: 'row', style: 'justify-content:flex-end;margin-top:14px' }, actions) : null));
    document.body.append(m); return m;
  }
  function cropDialog(file, baseName, done) {
    if (file.size > 25e6) return toast('This file is too large (over 25 MB).', true);
    var url = URL.createObjectURL(file), img = new Image();
    img.onload = function () {
      var A = { ratio: 16 / 9, zoom: 1, x: 0.5, y: 0.5 };
      var cv = h('canvas', { class: 'crop-cv', width: 800, height: 450 });
      var ratios = h('div', { class: 'seg' });
      [['16:9 (cards & article)', 16 / 9], ['4:3', 4 / 3], ['1:1 square', 1], ['Original', img.width / img.height]].forEach(function (r, i) {
        ratios.append(h('button', { type: 'button', 'aria-pressed': String(i === 0), text: r[0], onclick: function (e) { A.ratio = r[1]; [].forEach.call(ratios.children, function (b) { b.setAttribute('aria-pressed', String(b === e.target)); }); draw(); } }));
      });
      var zoom = h('input', { type: 'range', min: '1', max: '3', step: '0.01', value: '1' }), px = h('input', { type: 'range', min: '0', max: '1', step: '0.01', value: '0.5' }), py = h('input', { type: 'range', min: '0', max: '1', step: '0.01', value: '0.5' });
      [zoom, px, py].forEach(function (r) { r.addEventListener('input', function () { A.zoom = +zoom.value; A.x = +px.value; A.y = +py.value; draw(); }); });
      var rights = check(false, 'I took this photo or have the right to use it on Wartabiye TV.');
      function rect() {
        var iw = img.width, ih = img.height, w = iw, hh = iw / A.ratio;
        if (hh > ih) { hh = ih; w = ih * A.ratio; }
        w /= A.zoom; hh /= A.zoom;
        return { sx: (iw - w) * A.x, sy: (ih - hh) * A.y, w: w, h: hh };
      }
      function draw() { var r = rect(); cv.height = Math.round(cv.width / A.ratio); var c = cv.getContext('2d'); c.drawImage(img, r.sx, r.sy, r.w, r.h, 0, 0, cv.width, cv.height); }
      draw();
      var info = h('p', { class: 'sub', text: 'Original ' + img.width + ' × ' + img.height + ' px. Saved at most 1600 px wide, as a compressed web photo.' });
      var m = modal('Crop and resize the photo', h('div', null, cv, ratios, h('div', { class: 'three' }, field('Zoom', zoom), field('Left ↔ right', px), field('Up ↕ down', py)), info, rights),
        [h('button', { class: 'btn', type: 'button', text: 'Cancel', onclick: function () { m.remove(); } }),
          h('button', { class: 'btn primary', type: 'button', text: 'Use this photo', onclick: function () {
            if (!rights.firstChild.checked) return toast('Please confirm you may use this photo.', true);
            var r = rect(), outW = Math.min(1600, Math.round(r.w)), outH = Math.round(outW / (r.w / r.h));
            var o = h('canvas', { width: outW, height: outH }); o.getContext('2d').drawImage(img, r.sx, r.sy, r.w, r.h, 0, 0, outW, outH);
            o.toBlob(function (blob) {
              var ext = blob.type === 'image/webp' ? 'webp' : 'jpg';
              function fin(b) {
                b.arrayBuffer().then(function (buf) {
                  var bytes = new Uint8Array(buf);
                  return gitBlobSha(bytes).then(function (sha) {
                    var same = STORE.images.find(function (x) { return x.sha === sha; });
                    if (same) { var u = usedBy(same.path); if (u.length) { toast('This exact photo is already used by “' + u[0].title + '”. Every article needs its own photo.', true); return; } }
                    var path = 'img/news/' + slug(baseName).slice(0, 60) + '-' + Date.now().toString(36) + '.' + ext;
                    m.remove(); done({ bytes: bytes, path: path, sha: sha, url: URL.createObjectURL(b) });
                  });
                });
              }
              if (blob.type === 'image/webp' || blob.type === 'image/jpeg') fin(blob); else o.toBlob(fin, 'image/jpeg', 0.86);
            }, 'image/webp', 0.85);
          } })]);
    };
    img.onerror = function () { toast('This file is not a photo the browser can read.', true); };
    img.src = url;
  }
  function libraryPicker(forId, cb) {
    var grid = h('div', { class: 'mgrid' }), q = inp('', { type: 'search', placeholder: 'Search photos…' });
    function draw() {
      grid.innerHTML = '';
      STORE.images.filter(function (x) { return !q.value || x.name.indexOf(q.value.toLowerCase()) >= 0; }).slice(0, 120).forEach(function (x) {
        var u = usedBy(x.path, forId);
        grid.append(h('button', { class: 'mitem' + (u.length ? ' used' : ''), type: 'button', title: u.length ? 'Used by: ' + u[0].title : 'Not used by another article', onclick: function () { if (u.length) return toast('Already used by “' + u[0].title + '”. Every article needs its own photo.', true); m.remove(); cb(x); } },
          h('img', { src: thumb(x.path), alt: '', loading: 'lazy', onerror: function () { this.onerror = null; this.src = full(x.path); } }), h('span', { text: u.length ? 'In use' : 'Free' })));
      });
    }
    q.addEventListener('input', draw); draw();
    var m = modal('Choose a photo from the library', h('div', null, q, grid));
  }

  // ------------------------------------------------------------------ Media Library view
  VIEWS.media = function (el) {
    el.innerHTML = ''; el.append(loadingBox('Loading the photo library…'));
    load().then(function () { drawMedia(el); }).catch(function (e) { failBox(el, e, function () { VIEWS.media(el); }); });
  };
  function drawMedia(el) {
    el.innerHTML = '';
    var used = {}; STORE.articles.forEach(function (a) { if (a.image) (used[a.image] = used[a.image] || []).push(a); });
    var free = STORE.images.filter(function (x) { return !used[x.path]; });
    var M = { f: 'all', q: '' };
    el.append(h('div', { class: 'hero' }, h('div', null, h('h2', { text: 'Media Library' }), h('p', { text: STORE.images.length + ' photos stored with the website (they are published with it and never lost on deployment). ' + free.length + ' are not used by any article.' })),
      h('div', { class: 'actions' }, h('button', { class: 'btn primary', type: 'button', html: W().ic('plus') + '<span>Upload photo</span>', onclick: function () {
        pickFile(function (f) { cropDialog(f, f.name.replace(/\.[^.]+$/, ''), function (res) {
          commitFiles([{ path: res.path, bytes: res.bytes, expect: null }], 'Maamul: sawir "' + res.path + '"').then(function (c) { toast('Photo uploaded to the library. Choose it in an article to publish it.'); return load(true); }).then(function () { drawMedia(el); }).catch(function (e) { toast(e.message, true); });
        }); });
      } }))));
    var seg = h('div', { class: 'seg' }), q = inp('', { type: 'search', placeholder: 'Search by file name…' });
    [['all', 'All photos'], ['used', 'In use'], ['free', 'Not used'], ['dupe', 'Used twice'], ['missing', 'Articles without photo']].forEach(function (t) { seg.append(h('button', { type: 'button', 'aria-pressed': String(t[0] === 'all'), text: t[1], onclick: function (e) { M.f = t[0]; [].forEach.call(seg.children, function (b) { b.setAttribute('aria-pressed', String(b === e.target)); }); draw(); } })); });
    q.addEventListener('input', function () { M.q = q.value.toLowerCase(); draw(); });
    var grid = h('div', { class: 'mgrid big' }), more = 120;
    el.append(h('div', { class: 'card toolbar' }, seg, h('div', { class: 'tb-row' }, q)), grid);
    function draw() {
      grid.innerHTML = '';
      if (M.f === 'missing') {
        var miss = STORE.articles.filter(function (a) { return !a.image && (!M.q || (a.title + a.id).toLowerCase().indexOf(M.q) >= 0); });
        if (!miss.length) grid.append(h('div', { class: 'empty', text: 'Every article has a photo.' }));
        miss.slice(0, 200).forEach(function (a) { grid.append(h('div', { class: 'mcard' }, h('div', { class: 'noimg', text: 'No photo' }), h('div', { class: 'mc-b' }, h('b', { text: a.title }), h('small', { text: status(a).t + ' · ' + fmtDate(a.publishedAt) }), h('a', { class: 'btn small primary', href: '#articles?edit=' + encodeURIComponent(a.id), text: 'Add a photo' })))); });
        return;
      }
      var list = STORE.images.filter(function (x) { var u = used[x.path] || []; return (M.f === 'all' || (M.f === 'dupe' ? u.length > 1 : (M.f === 'used') === !!u.length)) && (!M.q || x.name.indexOf(M.q) >= 0); });
      list.slice(0, more).forEach(function (x) {
        var u = used[x.path] || [];
        grid.append(h('div', { class: 'mcard' }, h('a', { href: full(x.path), target: '_blank', rel: 'noopener' }, h('img', { src: thumb(x.path), alt: u[0] ? (u[0].imageAlt || '') : '', loading: 'lazy', onerror: function () { this.onerror = null; this.src = full(x.path); } })),
          h('div', { class: 'mc-b' }, h('small', { text: x.name + (x.size ? ' · ' + Math.round(x.size / 1024) + ' KB' : '') }),
            u.length ? h('a', { class: 'mc-u', href: '#articles?edit=' + encodeURIComponent(u[0].id), text: 'Used by: ' + u[0].title + (u.length > 1 ? ' (+' + (u.length - 1) + ' more!)' : '') }) : h('span', { class: 'mc-u free', text: 'Not used' }),
            u[0] && u[0].imageAlt ? h('small', { class: 'hint', text: 'Description: ' + u[0].imageAlt }) : null,
            u[0] ? h('small', { class: 'hint' + (u[0].imageLicense || u[0].by === 'admin' ? '' : ' warnt'), text: 'Photo: ' + (u[0].imageCredit || '—') + ' · Licence: ' + (u[0].imageLicense || (u[0].by === 'admin' ? 'your own' : 'not recorded')) }) : null,
            !u.length ? h('button', { class: 'btn small danger', type: 'button', text: 'Delete', onclick: function () {
              if (!confirm('Delete this unused photo from the website files?')) return;
              var ch = [{ path: x.path, delete: true, expect: x.sha }];
              var m = x.name.match(/^(.+)\.(jpe?g|png|webp)$/i);
              var tp = m ? 'img/news/w480/' + m[1] + '.webp' : null;
              (tp ? gh('GET', '/repos/' + repo() + '/contents/' + tp.split('/').map(encodeURIComponent).join('/')).then(function (f) { ch.push({ path: tp, delete: true, expect: f.sha }); }, function () {}) : Promise.resolve())
                .then(function () { return commitFiles(ch, 'Maamul: tirtir sawir "' + x.path + '"'); }).then(function () { toast('Photo deleted.'); return load(true); }).then(function () { drawMedia(el); }).catch(function (e) { toast(e.message, true); });
            } }) : null)));
      });
      if (list.length > more) grid.append(h('button', { class: 'btn', type: 'button', text: 'Show more', onclick: function () { more += 200; draw(); } }));
    }
    draw();
  }

  // ------------------------------------------------------------------ Homepage view
  VIEWS.homepage = function (el) {
    el.innerHTML = ''; el.append(loadingBox('Loading the homepage settings…'));
    load().then(function () { drawHome(el); }).catch(function (e) { failBox(el, e, function () { VIEWS.homepage(el); }); });
  };
  function drawHome(el) {
    el.innerHTML = '';
    var S = JSON.parse(JSON.stringify(STORE.site || {}));
    var fe = featuredIds();
    el.append(h('div', { class: 'hero' }, h('div', null, h('h2', { text: 'Homepage' }), h('p', { text: 'Choose the lead story and pinned stories, the breaking-news ticker and the banners. Everything else on the homepage keeps filling itself from the automatic news feed.' })),
      h('div', { class: 'actions' }, h('a', { class: 'btn', href: site(), target: '_blank', rel: 'noopener', html: W().ic('ext') + '<span>Open homepage</span>' }))));
    // featured
    var fl = h('ol', { class: 'pins' });
    function drawPins() {
      fl.innerHTML = '';
      if (!fe.length) fl.append(h('li', { class: 'empty', text: 'No pinned stories: the newest important stories are shown automatically.' }));
      fe.forEach(function (id, i) {
        var a = STORE.articles.find(function (x) { return x.id === id; });
        fl.append(h('li', null, h('span', { class: 'pin-n', text: i === 0 ? 'Lead' : String(i + 1) }), a && a.image ? h('img', { src: thumb(a.image), alt: '' }) : null,
          h('span', { class: 'pin-t', text: a ? a.title : id + ' (not found)' }), a && a.published === false ? chip('draft', 'Not published') : null,
          h('span', { class: 'pin-a' },
            h('button', { class: 'iconbtn', type: 'button', 'aria-label': 'Move up', text: '↑', disabled: i === 0, onclick: function () { fe.splice(i - 1, 0, fe.splice(i, 1)[0]); drawPins(); } }),
            h('button', { class: 'iconbtn', type: 'button', 'aria-label': 'Move down', text: '↓', disabled: i === fe.length - 1, onclick: function () { fe.splice(i + 1, 0, fe.splice(i, 1)[0]); drawPins(); } }),
            h('button', { class: 'iconbtn', type: 'button', 'aria-label': 'Unpin', html: W().ic('x'), onclick: function () { fe.splice(i, 1); drawPins(); } }))));
      });
    }
    drawPins();
    var find = inp('', { type: 'search', placeholder: 'Find a published story to pin…' }), res = h('div', { class: 'pick' });
    find.addEventListener('input', function () {
      res.innerHTML = ''; var t = find.value.trim().toLowerCase(); if (t.length < 2) return;
      STORE.articles.filter(function (a) { return a.published !== false && fe.indexOf(a.id) < 0 && (a.title + ' ' + a.id).toLowerCase().indexOf(t) >= 0; }).slice(0, 8).forEach(function (a) {
        res.append(h('button', { type: 'button', class: 'pick-i', onclick: function () { fe.push(a.id); find.value = ''; res.innerHTML = ''; drawPins(); } }, h('b', { text: a.title }), h('small', { text: fmtDate(a.publishedAt) })));
      });
    });
    function saveBtn(label, patchFn, msg) { return h('button', { class: 'btn primary', type: 'button', text: label, onclick: function (e) { var b = e.target; b.disabled = true; var p = patchFn(); saveSite(p, msg, 'Homepage updated').then(function () { drawHome(el); }, function () { b.disabled = false; }); } }); }
    el.append(W().card('Lead story and pinned stories', 'The first one is the big lead story. Drag order with the arrows.', h('div', null, fl, find, res, h('div', { class: 'row' }, saveBtn('Save pinned stories', function () { return { featured: fe.slice() }; }, 'Maamul: bogga hore (warar la dhejiyay)')))));
    // breaking ticker
    var B = S.breaking || { mode: 'auto', label: 'DEGDEG', items: [] };
    var mode = sel(B.mode || 'auto', [['auto', 'Automatic: breaking stories, plus my lines below first'], ['manual', 'Only my lines below']]);
    var items = (B.items || []).map(function (x) { return { text: x.text || '', link: x.link || '' }; });
    var il = h('div');
    function drawItems() {
      il.innerHTML = '';
      items.forEach(function (x, i) {
        var t = inp(x.text, { placeholder: 'Breaking line (Somali)' }), l = inp(x.link, { placeholder: 'Link (optional), e.g. #war-… or https://…' });
        t.addEventListener('input', function () { x.text = t.value; }); l.addEventListener('input', function () { x.link = l.value; });
        il.append(h('div', { class: 'two tick-i' }, t, h('div', { class: 'row' }, l, h('button', { class: 'iconbtn', type: 'button', 'aria-label': 'Remove', html: W().ic('x'), onclick: function () { items.splice(i, 1); drawItems(); } }))));
      });
      il.append(h('button', { class: 'btn small', type: 'button', html: W().ic('plus') + '<span>Add a breaking line</span>', onclick: function () { items.push({ text: '', link: '' }); drawItems(); } }));
    }
    drawItems();
    var blabel = inp(B.label || 'DEGDEG');
    el.append(W().card('Breaking-news ticker', 'The red “DEGDEG” bar at the top of every page.', h('div', null, field('Mode', mode), field('Label', blabel), il,
      h('div', { class: 'row' }, saveBtn('Save ticker', function () {
        var old = {}; (B.items || []).forEach(function (x) { old[x.text] = x; });
        return { breaking: Object.assign({}, B, { mode: mode.value, label: blabel.value.trim() || 'DEGDEG', items: items.filter(function (x) { return x.text.trim(); }).map(function (x) { var o = Object.assign({}, old[x.text] || {}); o.text = x.text.trim(); if (x.link.trim()) o.link = x.link.trim(); else delete o.link; return o; }) }) };
      }, 'Maamul: degdeg (ticker)')))));
    // announcement + banner
    var An = S.announcement || {}, an = { en: check(An.enabled, 'Show the announcement bar'), label: inp(An.label || 'OGEYSIIS'), text: inp(An.text), link: inp(An.link) };
    el.append(W().card('Announcement bar', 'A short notice above the news (for example a programme change).', h('div', null, an.en, h('div', { class: 'two' }, field('Label', an.label), field('Link (optional)', an.link)), field('Text', an.text),
      h('div', { class: 'row' }, saveBtn('Save announcement', function () { return { announcement: Object.assign({}, An, { enabled: an.en.firstChild.checked, label: an.label.value.trim(), text: an.text.value.trim(), link: an.link.value.trim() }) }; }, 'Maamul: ogeysiis')))));
    var Bn = S.banner || {}, bn = { en: check(Bn.enabled, 'Show the banner next to the logo'), title: inp(Bn.title), label: inp(Bn.label), text: inp(Bn.text), link: inp(Bn.link), image: inp(Bn.image, { placeholder: 'img/… (optional)' }) };
    el.append(W().card('Banner next to the logo', 'The promotion area in the logo band.', h('div', null, bn.en, h('div', { class: 'two' }, field('Title', bn.title), field('Small label', bn.label)), field('Text', bn.text), h('div', { class: 'two' }, field('Link', bn.link), field('Image (path in the library)', bn.image)),
      h('div', { class: 'row' }, saveBtn('Save banner', function () { return { banner: Object.assign({}, Bn, { enabled: bn.en.firstChild.checked, title: bn.title.value.trim(), label: bn.label.value.trim(), text: bn.text.value.trim(), link: bn.link.value.trim(), image: bn.image.value.trim() }) }; }, 'Maamul: banner')))));
    // sections
    var SN = { featured: 'Featured stories (top mosaic)', latest: 'Latest news list', sidebar: 'Sidebar', sidebarLatest: 'Sidebar: latest', programmes: 'Programmes', footerLatest: 'Footer: latest', videos: 'Videos', live: 'LIVE TV block', liveSports: 'Live sports scores' };
    var secs = S.sections || {}, boxes = {};
    var sg = h('div', { class: 'secs' }); Object.keys(SN).forEach(function (k) { boxes[k] = check(secs[k] !== false, SN[k]); sg.append(boxes[k]); });
    el.append(W().card('Homepage sections', 'Switch whole sections of the homepage on or off.', h('div', null, sg, h('div', { class: 'row' }, saveBtn('Save sections', function () { var o = Object.assign({}, secs); Object.keys(boxes).forEach(function (k) { o[k] = boxes[k].firstChild.checked; }); return { sections: o }; }, 'Maamul: qaybaha bogga hore')))));
    el.append(h('p', { class: 'sub', html: 'Menu, social media links, categories, languages and all other settings: <a href="#settings">Settings</a> (full editor).' }));
  }

  // shared with the other dashboard screens (control.js)
  window.WTVC = { gh: gh, gql: gql, commitFiles: commitFiles, load: load, store: function () { return STORE; }, track: track, toast: toast, field: field, inp: inp, area: area, sel: sel, check: check, chip: chip,
    fmtDate: fmtDate, toLocal: toLocal, articleUrl: articleUrl, status: status, json2: json2, modal: modal, loadingBox: loadingBox, failBox: failBox, repo: repo, site: site, thumb: thumb, full: full,
    featuredIds: featuredIds, usedBy: usedBy, LANGS: LANGS, SECTIONS: SECTIONS, pickFile: pickFile, cropDialog: cropDialog, b64: b64, utf8: utf8 };
  VIEWS.articles = function (el) { renderList(el, ''); };
  VIEWS.somalia = function (el) { renderList(el, 'somalia'); };
  VIEWS.world = function (el) { renderList(el, 'world'); };
  VIEWS.sports = function (el) { renderList(el, 'sports'); };
})();
