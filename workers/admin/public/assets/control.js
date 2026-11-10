// Wartabiye TV admin: the owner's control centre screens (Overview, News automation, Sections, LIVE News, Advertising,
// SEO & website health, Website settings) plus the admin-wide search and the alerts bell.
// Everything is read from the real sources: the website repository (through the owner-only GitHub proxy), the public
// website itself, the visitor counter of this Worker and GitHub Actions. Nothing is estimated or invented: when a number
// cannot be measured, the screen says so.
(function () {
  'use strict';
  var V = window.WTV_VIEWS;
  var W = function () { return window.WTV; }, C = function () { return window.WTVC; };
  var h = function () { return W().h.apply(null, arguments); };
  var n = function (x) { return W().n(x); };
  var ago = function (t) { return t ? W().ago(t) : '—'; };
  var site = function () { return C().site(); };
  var repo = function () { return C().repo(); };
  var EAT = 3 * 3600e3;
  var dayEAT = function (t) { var d = new Date((t ? Date.parse(t) : Date.now()) + EAT); return isNaN(d) ? '' : d.toISOString().slice(0, 10); };
  var fmt = function (t) { return t ? C().fmtDate(t) : '—'; };

  // ---------------------------------------------------------------- shared reads
  // several repository files in one request; returns {path: {text, oid, json}}
  function files(paths, ref) {
    ref = ref || 'main';
    var p = repo().split('/'), q = 'query($o:String!,$n:String!){repository(owner:$o,name:$n){' + paths.map(function (x, i) { return 'f' + i + ':object(expression:' + JSON.stringify(ref + ':' + x) + '){... on Blob{oid text}... on Tree{entries{name oid type object{... on Blob{text}}}}}'; }).join('') + '}}';
    return C().gql(q, { o: p[0], n: p[1] }).then(function (d) {
      var out = {};
      paths.forEach(function (x, i) {
        var o = d.repository['f' + i];
        if (!o) { out[x] = null; return; }
        if (o.entries) { out[x] = { entries: o.entries }; return; }
        var j = null; try { j = JSON.parse(o.text); } catch (e) {}
        out[x] = { text: o.text, oid: o.oid, json: j };
      });
      return out;
    });
  }
  var autoCache = null;
  function automationData(force) {
    if (autoCache && !force && Date.now() - autoCache.at < 60000) return Promise.resolve(autoCache.v);
    return W().api('/api/automation').then(function (A) { autoCache = { at: Date.now(), v: A }; return A; });
  }
  function siteStatus() {
    var t0 = performance.now();
    return fetch(site() + '?cb=' + Date.now(), { cache: 'no-store', mode: 'cors' }).then(function (r) {
      return { ok: r.ok, status: r.status, ms: Math.round(performance.now() - t0) };
    }).catch(function (e) { return { ok: false, status: 0, ms: null, error: e.message }; });
  }
  function banner(kind, title, text) { var b = h('div', { class: 'banner ' + (kind || ''), html: W().ic(kind === 'bad' ? 'warn' : kind === 'ok' ? 'check' : 'info') + '<div><b></b><span></span></div>' }); b.querySelector('b').textContent = title; b.querySelector('span').textContent = text || ''; return b; }
  function stat(label, value, note, cls, href) {
    var e = h(href ? 'a' : 'div', { class: 'card kpi ' + (cls || ''), href: href || null }, h('div', { class: 'lab' }, h('span', { text: label })), h('div', { class: 'val', text: value }), note ? h('div', { class: 'note', text: note }) : null);
    return e;
  }
  function pill(kind, text) { return h('span', { class: 'chip ' + kind, text: text }); }
  function hero(title, text, actions) { return h('div', { class: 'hero' }, h('div', null, h('h2', { text: title }), text ? h('p', { text: text }) : null), actions ? h('div', { class: 'actions' }, actions) : null); }
  function section(title, sub, body, right) { return W().card(title, sub, body, '', right); }
  function skel(hgt) { return h('div', { class: 'skel', style: 'height:' + (hgt || 120) + 'px' }); }
  function table(head, rows, cls) {
    return h('div', { class: 'tablewrap big' }, h('table', { class: 'tbl ' + (cls || '') }, h('thead', null, h('tr', null, head.map(function (x) { return h('th', { text: x }); }))), h('tbody', null, rows)));
  }
  function td(x, cls) { return x instanceof Node ? h('td', { class: cls || null }, x) : h('td', { class: cls || null, text: x == null ? '—' : String(x) }); }
  function link(href, text) { return h('a', { href: href, target: /^https?:/.test(href) ? '_blank' : null, rel: 'noopener', text: text }); }

  // ---------------------------------------------------------------- cron (GitHub schedules are in UTC)
  function cronNext(expr, from) {
    var f = String(expr).trim().split(/\s+/); if (f.length !== 5) return null;
    function set(field, lo, hi) {
      var out = {};
      field.split(',').forEach(function (part) {
        var m = part.match(/^(\*|\d+(?:-\d+)?)(?:\/(\d+))?$/); if (!m) return;
        var a = lo, b = hi;
        if (m[1] !== '*') { var r = m[1].split('-'); a = +r[0]; b = r[1] != null ? +r[1] : (m[2] ? hi : a); }
        for (var i = a; i <= b; i += +(m[2] || 1)) out[i === 7 && hi === 6 ? 0 : i] = 1;
      });
      return out;
    }
    var mi = set(f[0], 0, 59), ho = set(f[1], 0, 23), dm = set(f[2], 1, 31), mo = set(f[3], 1, 12), dw = set(f[4], 0, 6);
    var t = Math.floor((from || Date.now()) / 60000) * 60000 + 60000;
    for (var i = 0; i < 60 * 24 * 9; i++, t += 60000) {
      var d = new Date(t);
      if (!mo[d.getUTCMonth() + 1] || !ho[d.getUTCHours()] || !mi[d.getUTCMinutes()]) continue;
      var dOk = dm[d.getUTCDate()], wOk = dw[d.getUTCDay()];
      if (f[2] === '*' && f[4] === '*' ? true : f[2] === '*' ? wOk : f[4] === '*' ? dOk : dOk || wOk) return new Date(t);
    }
    return null;
  }
  function cronText(expr) {
    var f = expr.split(/\s+/);
    if (/^\*\/(\d+)$/.test(f[0]) && f[1] === '*') return 'every ' + f[0].slice(2) + ' minutes';
    if (/^\d+-59\/(\d+)$/.test(f[0]) && f[1] === '*') return 'every ' + f[0].split('/')[1] + ' minutes';
    if (/^[\d,]+$/.test(f[0]) && f[1] === '*') return 'every hour at :' + f[0].split(',').join(', :');
    if (/^\d+$/.test(f[0]) && /^\*\/(\d+)$/.test(f[1])) return 'every ' + f[1].slice(2) + ' hours';
    return expr + ' (UTC)';
  }
  function workflowCrons(text) {
    var out = [], re = /cron:\s*['"]([^'"]+)['"]/g, m;
    while ((m = re.exec(text || ''))) out.push(m[1]);
    return out;
  }
  function triggers(text) {
    var t = [];
    if (/\n\s*schedule:/.test(text)) t.push('schedule');
    if (/\n\s*push:/.test(text)) t.push('on save');
    if (/workflow_dispatch/.test(text)) t.push('by hand');
    if (/workflow_run/.test(text)) t.push('after another job');
    if (/pull_request/.test(text)) t.push('on review');
    return t;
  }

  // ---------------------------------------------------------------- alerts (shared by Overview and the bell)
  function computeAlerts(D) {
    var a = [];
    if (D.siteStat && !D.siteStat.ok) a.push({ k: 'bad', t: 'wartabiyetv.com did not answer', d: 'The website check failed' + (D.siteStat.status ? ' (HTTP ' + D.siteStat.status + ')' : '') + '. Check again in a minute.', href: '#health' });
    var S = D.auto && D.auto.status;
    if (S) {
      (S.problems || []).forEach(function (p) { a.push({ k: 'bad', t: 'Automation problem', d: typeof p === 'string' ? p : (p.text || p.message || JSON.stringify(p)), href: '#automation' }); });
      if (S.liveInSync === false) a.push({ k: 'warn', t: 'Website not in sync', d: 'The live website does not show all published articles yet.', href: '#automation' });
      if (S.publishFailures24h) a.push({ k: 'bad', t: S.publishFailures24h + ' failed website rebuild(s) in 24 h', d: 'Publishing stopped with an error at least once.', href: '#automation' });
      if (S.updatedAt && Date.now() - Date.parse(S.updatedAt) > 3 * 3600e3) a.push({ k: 'warn', t: 'Automation watchdog is quiet', d: 'Its last report was ' + ago(S.updatedAt) + '.', href: '#automation' });
    }
    if (D.auto) (D.auto.workflows || []).forEach(function (w) { if (w.status === 'completed' && w.conclusion === 'failure' && !/admin-cms-check|admin-test/.test(w.path)) a.push({ k: 'bad', t: 'Failed: ' + w.name, d: 'Last run ' + ago(w.updated) + '.', href: w.url }); });
    if (D.store) {
      var held = D.store.articles.filter(function (x) { return x.published === false && x.heldBy; }).length;
      if (held) a.push({ k: 'warn', t: held + ' article(s) held by the publish check', d: 'They are not on the website. Open them to see why.', href: '#articles' });
      var sched = D.store.articles.filter(function (x) { return x.publishAt && x.published === false && Date.parse(x.publishAt) < Date.now() - 40 * 60000; }).length;
      if (sched) a.push({ k: 'warn', t: sched + ' scheduled article(s) are late', d: 'Their time passed more than 40 minutes ago.', href: '#articles' });
    }
    return a;
  }

  // ---------------------------------------------------------------- Overview
  var OV = { range: 'today', from: '', to: '' };
  V.overview = function (el) {
    el.innerHTML = '';
    var me = W().me(), hour = new Date().getHours();
    el.append(hero((hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening') + (me && (me.name || me.login) ? ', ' + (me.name || me.login).split(' ')[0] : ''),
      'Everything happening on wartabiyetv.com, from the real website, its files, the visitor counter and the automation.',
      [h('a', { class: 'btn primary', href: '#articles?new', html: W().ic('plus') + '<span>New article</span>' }),
        h('a', { class: 'btn', href: '#homepage', html: W().ic('layers') + '<span>Homepage</span>' }),
        h('a', { class: 'btn', href: site(), target: '_blank', rel: 'noopener', html: W().ic('ext') + '<span>Open website</span>' })]));
    var alertsBox = h('div', { class: 'alerts' }); el.append(alertsBox);
    var siteRow = h('div', { class: 'grid kpis' }, skel(96), skel(96), skel(96), skel(96)); el.append(h('h3', { class: 'gh', text: 'Website' }), siteRow);
    var contentRow = h('div', { class: 'grid kpis' }, skel(96), skel(96), skel(96), skel(96)); el.append(h('h3', { class: 'gh', text: 'Content' }), contentRow);
    // visitors with a period choice
    var seg = h('div', { class: 'seg', role: 'tablist' });
    var from = C().inp(OV.from, { type: 'date', 'aria-label': 'From' }), to = C().inp(OV.to, { type: 'date', 'aria-label': 'To' }), cust = h('span', { class: 'custom', hidden: OV.range !== 'custom' }, from, h('span', { text: '–' }), to);
    [['today', 'Today'], ['yesterday', 'Yesterday'], ['7d', '7 days'], ['30d', '30 days'], ['custom', 'Custom']].forEach(function (r) {
      seg.append(h('button', { type: 'button', 'aria-pressed': String(OV.range === r[0]), text: r[1], onclick: function () { OV.range = r[0]; cust.hidden = r[0] !== 'custom'; [].forEach.call(seg.children, function (b) { b.setAttribute('aria-pressed', String(b.textContent === r[1])); }); if (r[0] !== 'custom' || (OV.from && OV.to)) visitors(); } }));
    });
    [from, to].forEach(function (x) { x.addEventListener('change', function () { OV.from = from.value; OV.to = to.value; if (OV.from && OV.to) visitors(); }); });
    var visRow = h('div', { class: 'grid kpis' }, skel(96), skel(96), skel(96), skel(96));
    el.append(h('div', { class: 'gh-row' }, h('h3', { class: 'gh', text: 'Visitors' }), h('div', { class: 'rangebar' }, seg, cust)), visRow,
      h('p', { class: 'sub fine', text: 'Counted without cookies: a visitor is one device per day, so a person who returns on another day is counted again. Nothing is estimated.' }));
    var two = h('div', { class: 'grid cols-2' }), topBody = h('div', null, skel(200)), actBody = h('div', null, skel(200));
    two.append(section('Most read', 'Article page views in the chosen period', topBody, h('a', { class: 'toggle', href: '#analytics', text: 'Analytics →' })),
      section('Latest admin activity', 'Saves, sign-ins and automation controls (security log)', actBody, h('a', { class: 'toggle', href: '#security', text: 'All →' })));
    el.append(two);
    var three = h('div', { class: 'grid cols-2' }), schedBody = h('div', null, skel(160)), wfBody = h('div', null, skel(160));
    three.append(section('Publishing schedule', 'What publishes when (Nairobi / Mogadishu time)', schedBody, h('a', { class: 'toggle', href: '#automation', text: 'Automation →' })),
      section('News workflows', 'Latest result of each automatic job', wfBody));
    el.append(three);

    var D = {};
    function visitors() {
      visRow.innerHTML = ''; visRow.append(skel(96), skel(96), skel(96), skel(96));
      var q = OV.range === 'custom' ? 'range=custom&from=' + OV.from + '&to=' + OV.to : 'range=' + OV.range;
      Promise.all([W().api('/api/analytics/summary?' + q), W().api('/api/analytics/realtime')]).then(function (r) {
        var S = r[0], RT = r[1], T = S.totals, P = S.previous;
        visRow.innerHTML = '';
        var pct = function (c, p) { return p ? (c >= p ? '▲ ' : '▼ ') + Math.abs(Math.round((c - p) * 100 / p)) + '% vs the period before' : 'no earlier period to compare'; };
        visRow.append(stat('Active now', n(RT.active5), n(RT.active30) + ' in the last 30 minutes', 'live'),
          stat('Visitors', n(T.visitors), pct(T.visitors, P.visitors)),
          stat('Page views', n(T.views), pct(T.views, P.views)),
          stat('All-time page views', n(S.quick.allTime.views), S.since ? 'counted since ' + W().dayLabel(S.since, true) : 'counting has not started yet'));
        var arts = (S.articles || []).slice(0, 8);
        W().articleTitles(arts.map(function (a) { return a.id; })).then(function (t) {
          topBody.innerHTML = '';
          topBody.append(W().ranked(arts.map(function (a, i) { return { label: t[i].title, meta: t[i].category || a.cat || '', v: a.views, href: site() + 'war/' + a.id + '.html' }; }), { empty: 'No article page was read in this period.', pct: false }));
        });
      }).catch(function (e) { visRow.innerHTML = ''; visRow.append(W().errBox(e)); });
    }
    function refresh(force) {
      Promise.all([siteStatus(), automationData(force).catch(function (e) { return { error: e.message }; }), C().load(force).catch(function () { return null; }),
        files(['data/schedule.json', 'data/world/sports-writer-status.json']).catch(function () { return {}; }), fetch('/health').then(function (r) { return r.json(); }).catch(function () { return null; })]).then(function (r) {
        D.siteStat = r[0]; D.auto = r[1].error ? null : r[1]; D.store = r[2]; var F = r[3] || {}, HL = r[4];
        // website
        siteRow.innerHTML = '';
        var pub = D.auto && (D.auto.allRuns || []).filter(function (x) { return /publish\.yml$/.test(x.path); });
        var lastOk = pub && pub.find(function (x) { return x.conclusion === 'success'; });
        var running = pub && pub.find(function (x) { return x.status !== 'completed'; });
        var newest = D.store && D.store.articles.find(function (x) { return x.published !== false; });
        siteRow.append(
          stat('Website', D.siteStat.ok ? 'Online' : 'Offline', D.siteStat.ok ? 'answered in ' + D.siteStat.ms + ' ms (checked now)' : 'no answer' + (D.siteStat.status ? ' (HTTP ' + D.siteStat.status + ')' : ''), D.siteStat.ok ? 'good' : 'badk', '#health'),
          stat('Last successful deployment', lastOk ? ago(lastOk.updated) : '—', running ? 'a rebuild is running now' : lastOk ? fmt(lastOk.updated) : 'no data', '', lastOk ? lastOk.url : null),
          stat('Last news publication', newest ? ago(newest.publishedAt) : '—', newest ? newest.title : '', '', newest ? C().articleUrl(newest.id) : null),
          stat('Admin backend', HL && HL.ok ? 'Healthy' : 'Problem', HL ? 'database ' + (HL.db ? 'ok' : 'down') + ', sign-in ' + (HL.signIn ? 'ready' : 'not set up') : 'no answer', HL && HL.ok ? 'good' : 'badk'));
        // content
        contentRow.innerHTML = '';
        if (D.store) {
          var A = D.store.articles, today = dayEAT();
          var isPub = function (x) { return x.published !== false; };
          contentRow.append(
            stat('Published today', n(A.filter(function (x) { return isPub(x) && dayEAT(x.publishedAt) === today; }).length), 'since 00:00 Mogadishu', '', '#articles'),
            stat('Published articles', n(A.filter(isPub).length), n(Object.keys(D.store.live).length) + ' in the live website feed', '', '#articles'),
            stat('Drafts', n(A.filter(function (x) { return !isPub(x) && !x.heldBy && !x.imagePending && !x.publishAt; }).length), n(A.filter(function (x) { return x.publishAt && !isPub(x); }).length) + ' scheduled', '', '#articles'),
            stat('Waiting for photo', n(A.filter(function (x) { return !isPub(x) && x.imagePending; }).length), 'held until a photo is added', '', '#articles'),
            stat('Failed / held', n(A.filter(function (x) { return !isPub(x) && x.heldBy; }).length), 'stopped by the publish check', '', '#articles'));
        } else contentRow.append(W().errBox(new Error('The website files could not be read')));
        // alerts
        var al = computeAlerts(D); alertsBox.innerHTML = '';
        if (!al.length) alertsBox.append(banner('ok', 'No problems found', 'Website online, automation reporting normally, nothing held. Checked ' + new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) + '.'));
        al.forEach(function (x) { var b = banner(x.k === 'bad' ? 'bad' : 'warn', x.t, x.d); if (x.href) b.append(link(x.href, 'Open')); alertsBox.append(b); });
        setBell(al);
        // schedule
        schedBody.innerHTML = '';
        var sch = F['data/schedule.json'] && F['data/schedule.json'].json, sw = F['data/world/sports-writer-status.json'] && F['data/world/sports-writer-status.json'].json;
        var newsNext = cronNext('8 */3 * * *'), S2 = D.auto && D.auto.status;
        var scheduled = D.store ? D.store.articles.filter(function (x) { return x.publishAt && x.published === false; }).sort(function (a, b) { return a.publishAt.localeCompare(b.publishAt); }) : [];
        schedBody.append(h('ul', { class: 'sched' },
          h('li', null, h('b', { text: 'Regular news' }), h('span', { text: sch && sch.hourly === false ? 'Paused: only the 08:00 and 18:00 runs work' : 'Every 3 hours, 24/7 (00:08, 03:08 … 21:08)' }),
            h('small', { text: 'Last run ' + ago(S2 && S2.hourlyRoutineLastRunAt) + ' · next about ' + (newsNext ? fmt(newsNext.toISOString()) : '—') })),
          h('li', null, h('b', { text: 'Sports articles' }), h('span', { text: '08:00 and 18:00 Nairobi, one article each' }),
            h('small', { text: sw && sw.schedule && sw.schedule.nextRun ? 'next ' + fmt(sw.schedule.nextRun) : 'next run time not reported' })),
          h('li', null, h('b', { text: 'LIVE News' }), h('span', { text: 'Event-driven: only when a newsroom feed reports something new' }), h('small', { text: 'sources checked every 5 minutes' })),
          h('li', null, h('b', { text: 'Your scheduled articles' }), h('span', { text: scheduled.length ? scheduled.length + ' waiting' : 'none' }),
            scheduled.length ? h('small', { text: 'next: ' + scheduled[0].title + ' · ' + fmt(scheduled[0].publishAt) }) : null)));
        wfBody.innerHTML = '';
        if (D.auto) wfBody.append(W().autoList(D.auto.workflows.slice(0, 8))); else wfBody.append(W().errBox(new Error(r[1].error || 'not available')));
      });
      W().api('/api/security').then(function (S) {
        actBody.innerHTML = '';
        actBody.append(W().auditTable(S.log.filter(function (x) { return /content_change|login|signout|denied|github_blocked/.test(x.event); }).slice(0, 8)));
      }).catch(function (e) { actBody.innerHTML = ''; actBody.append(W().errBox(e)); });
    }
    visitors(); refresh(false);
    W().every(60000, function () { refresh(true); visitors(); });
  };

  // ---------------------------------------------------------------- News automation
  V.automation = function (el) {
    el.innerHTML = '';
    el.append(hero('News automation', 'Every scheduled job, its last and next run, what it found and published, and its errors. Read live from GitHub Actions and the automation reports.',
      [h('button', { class: 'btn', type: 'button', html: W().ic('refresh') + '<span>Refresh</span>', onclick: function () { V.automation(el); } })]));
    var top = h('div', null, skel(80)), jobs = h('div', null, skel(300)), news = h('div', null, skel(200)), sports = h('div', null, skel(160)), live = h('div', null, skel(160)), runs = h('div', null, skel(200));
    el.append(top, section('Scheduled jobs', 'State, last run and next planned run. GitHub may start a planned run a few minutes late.', jobs),
      h('div', { class: 'grid cols-2' }, section('Regular news: last collection', 'From the news collector report (data/world/status.json)', news), section('Sports and results', 'Sports writer and results reports', sports)),
      section('LIVE News updates', 'The 5-minute LIVE News check (branch live-data)', live),
      section('Recent runs and retries', 'Latest runs of all jobs; a run number above 1 is a retry', runs));
    var me = W().me(), appUrl = me && me.app && me.app.slug ? 'https://github.com/settings/apps/' + me.app.slug + '/permissions' : 'https://github.com/settings/apps';
    Promise.all([automationData(true), files(['data/schedule.json', 'data/world/status.json', 'data/world/fast-status.json', 'data/world/sports-writer-status.json', 'data/world/sports-results-status.json', '.github/workflows']),
      files(['live-updates-status.json'], 'live-data').catch(function () { return {}; })]).then(function (r) {
      var A = r[0], F = r[1], L = r[2], S = A.status || {};
      var wfTree = (F['.github/workflows'] && F['.github/workflows'].entries) || [];
      var texts = {}; wfTree.forEach(function (e) { texts['.github/workflows/' + e.name] = e.object && e.object.text; });
      top.innerHTML = '';
      if (!A.status) top.append(banner('warn', 'The automation watchdog report could not be read', 'The jobs below are still read live from GitHub.'));
      else top.append(banner(S.overall === 'ok' ? 'ok' : 'warn', S.overall === 'ok' ? 'Automation is working' : 'Automation needs attention', (S.overallText || '') + (S.updatedAt ? ' (watchdog report ' + ago(S.updatedAt) + ')' : '')));
      // the Claude news task (not a GitHub job): its switch is data/schedule.json
      var sch = F['data/schedule.json'] && F['data/schedule.json'].json, schOid = F['data/schedule.json'] && F['data/schedule.json'].oid;
      var rows = [];
      var newsNext = cronNext('8 */3 * * *');
      rows.push(h('tr', null, td(h('div', null, h('b', { text: 'Regular news (Claude task)' }), h('div', { class: 'sub', text: 'Every 3 hours at :08 Nairobi; switch in data/schedule.json' }))),
        td(pill(sch && sch.hourly === false ? 'warn' : 'ok', sch && sch.hourly === false ? 'Paused' : 'Active')),
        td(ago(S.hourlyRoutineLastRunAt)), td(sch && sch.hourly === false ? '08:00 / 18:00 only' : newsNext ? fmt(newsNext.toISOString()) : '—'),
        td(h('button', { class: 'btn small', type: 'button', text: sch && sch.hourly === false ? 'Resume 3-hourly' : 'Pause 3-hourly', onclick: function () {
          var on = !(sch && sch.hourly !== false);
          if (!confirm(on ? 'Resume regular news every 3 hours?' : 'Pause the 3-hourly news? Only the 08:00 and 18:00 runs will then publish.')) return;
          var s2 = Object.assign({}, sch || {}, { hourly: on });
          C().commitFiles([{ path: 'data/schedule.json', text: JSON.stringify(s2, null, 2) + '\n', expect: schOid }], 'Maamul: jadwalka wararka ' + (on ? 'shid' : 'dami')).then(function (c) {
            C().track(on ? 'Regular news resumed' : 'Regular news paused', c, { url: site() + 'data/schedule.json', field: 'hourly', value: on }, null); V.automation(el);
          }).catch(function (e) { C().toast(e.message, true); });
        } }))));
      var latest = {}; (A.allRuns || []).forEach(function (x) { if (!latest[x.path]) latest[x.path] = x; });
      (A.defs || []).filter(function (d) { return /^\.github\/workflows\//.test(d.path); }).sort(function (a, b) { return a.name.localeCompare(b.name); }).forEach(function (d) {
        var x = latest[d.path], text = texts[d.path] || '', crons = workflowCrons(text);
        var state = d.state !== 'active' ? ['warn', 'Paused'] : !x ? ['', 'Idle'] : x.status !== 'completed' ? ['live', 'Running'] : x.conclusion === 'failure' ? ['bad', 'Failed'] : x.conclusion === 'success' ? ['ok', 'Idle'] : ['', x.conclusion || 'Idle'];
        var nx = crons.map(function (c) { return cronNext(c); }).filter(Boolean).sort(function (a, b) { return a - b; })[0];
        var file = d.path.split('/').pop();
        var acts = h('div', { class: 'row' });
        if (/workflow_dispatch/.test(text)) acts.append(h('button', { class: 'btn small', type: 'button', text: 'Run now', onclick: function () { control('POST', '/actions/workflows/' + file + '/dispatches', { ref: 'main' }, 'Started: ' + d.name); } }));
        acts.append(h('button', { class: 'btn small ghost', type: 'button', text: d.state === 'active' ? 'Pause' : 'Resume', onclick: function () {
          if (d.state === 'active' && !confirm('Pause "' + d.name + '"? It will not run again until you resume it.')) return;
          control('PUT', '/actions/workflows/' + d.id + '/' + (d.state === 'active' ? 'disable' : 'enable'), null, (d.state === 'active' ? 'Paused: ' : 'Resumed: ') + d.name);
        } }));
        if (x && x.conclusion === 'failure') acts.append(h('button', { class: 'btn small ghost', type: 'button', text: 'Retry', onclick: function () { control('POST', '/actions/runs/' + x.id + '/rerun-failed-jobs', null, 'Retrying: ' + d.name); } }));
        rows.push(h('tr', null, td(h('div', null, h('a', { href: d.url, target: '_blank', rel: 'noopener', text: d.name }), h('div', { class: 'sub', text: file + ' · ' + (triggers(text).join(', ') || '—') + (crons.length ? ' · ' + crons.map(cronText).join(', ') : '') }))),
          td(pill(state[0], state[1])), td(x ? h('a', { href: x.url, target: '_blank', rel: 'noopener', text: ago(x.updated) + (x.conclusion ? ' · ' + x.conclusion : '') }) : '—'),
          td(nx ? fmt(nx.toISOString()) : crons.length ? '—' : 'not scheduled'), td(acts)));
      });
      jobs.innerHTML = '';
      jobs.append(table(['Job', 'State', 'Last run', 'Next planned run', ''], rows),
        h('p', { class: 'sub fine', html: 'Pause, Resume, Run now and Retry need the dashboard\'s GitHub App to have <b>Actions: Read and write</b>. If GitHub refuses, it is a one-time permission change: ' }, h('a', { href: appUrl, target: '_blank', rel: 'noopener', text: 'open the App permissions' }), h('span', { text: ', set Actions to "Read and write", save, then accept the new permission on the installation page GitHub shows you.' })));
      // regular news collector
      var ws = F['data/world/status.json'] && F['data/world/status.json'].json, lr = ws && ws.lastRun, fs = F['data/world/fast-status.json'] && F['data/world/fast-status.json'].json, fst = fs && fs.status;
      news.innerHTML = '';
      if (lr) {
        news.append(h('div', { class: 'grid kpis mini' }, stat('Discovered', n(lr.collected), 'last run ' + ago(lr.at)), stat('Published', n(lr.published), (lr.pendingImage || 0) + ' waiting for a photo'),
          stat('Rejected', n((lr.duplicatesRemoved || 0) + (lr.alreadyKnown || 0) + ((lr.somalia && lr.somalia.rejected) ? Object.values(lr.somalia.rejected).reduce(function (a, b) { return a + b; }, 0) : 0)), (lr.duplicatesRemoved || 0) + ' duplicates, ' + (lr.alreadyKnown || 0) + ' already known'),
          stat('Errors', n((lr.errors || []).length + (lr.imageErrors || []).length), lr.ok ? 'run finished normally' : 'run had problems', lr.ok ? '' : 'badk')));
        var reasons = (lr.somalia && lr.somalia.rejectedReasons) || [];
        if (reasons.length) news.append(h('details', { class: 'why' }, h('summary', { text: 'Why stories were not published (' + reasons.length + ')' }), h('ul', null, reasons.map(function (x) { return h('li', { text: x }); }))));
        (lr.errors || []).concat(lr.imageErrors || []).slice(0, 8).forEach(function (e) { news.append(banner('bad', 'Error', typeof e === 'string' ? e : JSON.stringify(e))); });
      } else news.append(banner('', 'No collector report yet', ''));
      if (fst) news.append(h('p', { class: 'sub fine', text: '5-minute source monitor: ' + (fst.health || '?') + ', last check ' + ago(fst.lastSourceCheckAt) + ', ' + n(fst.checks24h) + ' checks, ' + n(fst.newFound24h) + ' new items found, ' + n(fst.published24h) + ' published, ' + n(fst.duplicatesSkipped24h) + ' duplicates and ' + n(fst.oldSkipped24h) + ' old items skipped in 24 h.' }));
      // sports
      var sw = F['data/world/sports-writer-status.json'] && F['data/world/sports-writer-status.json'].json, sr = F['data/world/sports-results-status.json'] && F['data/world/sports-results-status.json'].json;
      sports.innerHTML = '';
      sports.append(h('ul', { class: 'sched' },
        h('li', null, h('b', { text: 'Sports writer' }), h('span', { text: sw ? 'mode ' + (sw.mode || (S.writers && S.writers.sports && S.writers.sports.mode) || '?') + ', times ' + ((sw.schedule && sw.schedule['times (Africa/Nairobi)']) || ['08:00', '18:00']).join(' and ') + ' Nairobi' : 'no report' }),
          h('small', { text: sw ? 'last check ' + ago(sw.lastCheckAt || (S.writers && S.writers.sports && S.writers.sports.lastCheckAt)) + ' · last article ' + ago(sw.lastWrittenAt) + (sw.schedule && sw.schedule.nextRun ? ' · next ' + fmt(sw.schedule.nextRun) : '') : '' })),
        h('li', null, h('b', { text: 'Match results' }), h('span', { text: sr ? 'last success ' + ago(sr.lastSuccessAt) : 'no report' }), h('small', { text: sr ? (sr.newReports || 0) + ' new reports in the last run' + ((sr.failed || []).length ? ', ' + sr.failed.length + ' failed' : '') : '' }))));
      // live
      var ls = L['live-updates-status.json'] && L['live-updates-status.json'].json;
      live.innerHTML = '';
      if (ls) {
        var d = (ls.days || {})[dayEAT()] || {};
        live.append(h('div', { class: 'grid kpis mini' }, stat('Writer', ls.mode === 'on' ? 'On' : 'Off', ls.mode === 'on' ? 'paid API, limit $' + ((ls.limits || {}).usdPerDay || '?') + '/day' : 'paid API use is off; only you can switch it on', ls.mode === 'on' ? 'good' : ''),
          stat('Last check', ago(ls.lastCheckAt), ls.lastWrittenAt ? 'last update written ' + ago(ls.lastWrittenAt) : 'no update written yet'),
          stat('Today', n(d.written || 0) + ' written', (d.merged || 0) + ' merged, ' + (d.skipped || 0) + ' skipped, ' + (d.declined || 0) + ' declined'),
          stat('Failed today', n(d.failed || 0), (d.calls || 0) + ' API calls, $' + (d.usd || 0) + ' spent', d.failed ? 'badk' : '')),
          h('p', { class: 'sub fine' }, h('span', { text: 'Edit, add or remove LIVE updates on the ' }), h('a', { href: '#live', text: 'LIVE News screen' }), h('span', { text: '.' })));
      } else live.append(banner('', 'No LIVE News report found on branch live-data', ''));
      // runs
      runs.innerHTML = '';
      runs.append(table(['Run', 'Result', 'Attempt', 'When'], (A.allRuns || []).slice(0, 25).map(function (x) {
        return h('tr', null, td(h('div', null, h('a', { href: x.url, target: '_blank', rel: 'noopener', text: x.name }), h('div', { class: 'sub', text: x.title || '' }))), td(W().runChip(x)), td(String(x.attempt || 1)), td(ago(x.created)));
      })));
    }).catch(function (e) { top.innerHTML = ''; top.append(W().errBox(e)); });
    function control(method, path, body, label) {
      C().gh(method, '/repos/' + repo() + path, body).then(function () { C().toast(label + '. GitHub accepted it.'); setTimeout(function () { autoCache = null; V.automation(el); }, 2500); })
        .catch(function (e) { C().toast(e.status === 403 || e.status === 404 ? 'GitHub refused: the dashboard\'s GitHub App needs "Actions: Read and write" (see the note under the table).' : e.message, true); });
    }
  };

  // ---------------------------------------------------------------- Sections & categories
  V.sections = function (el) {
    el.innerHTML = ''; el.append(C().loadingBox());
    Promise.all([C().load(), files(['data/world/sources.json', 'data/world/status.json', 'data/world/fast-status.json', 'data/sports/publishers.json']), automationData().catch(function () { return null; }),
      files(['live-updates.json', 'live-updates-status.json', 'live-wire.json'], 'live-data').catch(function () { return {}; })]).then(function (r) {
      var ST = r[0], F = r[1], L = r[3], src = (F['data/world/sources.json'] && F['data/world/sources.json'].json) || { sources: [] };
      var ws = F['data/world/status.json'] && F['data/world/status.json'].json, fs = F['data/world/fast-status.json'] && F['data/world/fast-status.json'].json;
      el.innerHTML = '';
      el.append(hero('Sections & categories', 'Each news section with its real numbers, its authorised sources and when it last updated. Source records stay private to this dashboard.',
        [h('a', { class: 'btn', href: '#articles', text: 'All articles' }), h('a', { class: 'btn', href: '#editor', text: 'Edit sources (Full editor)' })]));
      var A = ST.articles, week = Date.now() - 7 * 864e5;
      function block(key, name, list, srcs, extra, viewHash, siteHash) {
        var pub = list.filter(function (x) { return x.published !== false; }), newest = pub[0];
        var pend = list.filter(function (x) { return x.published === false && !x.heldBy; }).length, held = list.filter(function (x) { return x.published === false && x.heldBy; }).length;
        var perDay = pub.filter(function (x) { return Date.parse(x.publishedAt) > week; }).length / 7;
        return h('div', { class: 'card secard' },
          h('div', { class: 'card-h' }, h('div', null, h('h3', { text: name }), h('p', { class: 'sub', text: newest ? 'Newest: ' + newest.title : 'No published article' })),
            h('div', { class: 'row' }, viewHash ? h('a', { class: 'btn small', href: viewHash, text: 'Manage' }) : null, siteHash ? h('a', { class: 'btn small ghost', href: site() + siteHash, target: '_blank', rel: 'noopener', text: 'View' }) : null)),
          h('div', { class: 'grid kpis mini' }, stat('Published', n(pub.length)), stat('Last update', newest ? ago(newest.publishedAt) : '—', newest ? fmt(newest.publishedAt) : ''),
            stat('Per day (7 days)', perDay.toFixed(1)), stat('Pending / held', pend + ' / ' + held, held ? 'held by the publish check' : '', held ? 'badk' : '')),
          srcs ? h('details', { class: 'why' }, h('summary', { text: srcs.filter(function (s) { return s.enabled !== false; }).length + ' authorised sources switched on (' + srcs.length + ' listed)' }),
            table(['Source', 'Use allowed', 'State'], srcs.map(function (s) {
              var ps = src.perSource && src.perSource[s.id];
              return h('tr', null, td(h('div', null, h('b', { text: s.name }), h('div', { class: 'sub', text: (s.country || '') + (s.attributionRequired ? ' · public credit required' : '') }))), td(s.permission || '—'),
                td(pill(s.enabled === false ? '' : s.verified ? 'ok' : 'warn', s.enabled === false ? 'off' : s.verified ? 'on, checked' : 'on, not verified')));
            }))) : null, extra || null);
      }
      var bySec = function (k) { return A.filter(function (x) { return (x.section || 'somalia') === k; }); };
      var srcFor = function (k) { return (src.sources || []).filter(function (s) { return (s.section || 'world') === k; }); };
      var chk = ws ? h('p', { class: 'sub fine', text: 'Source check: last run ' + ago(ws.lastRunAt) + (ws.lastRun && ws.lastRun.ok ? ', finished normally' : ', had problems') + (fs && fs.status ? '; 5-minute monitor ' + fs.status.health + ', last check ' + ago(fs.status.lastSourceCheckAt) : '') + '.' }) : null;
      el.append(block('somalia', 'Soomaaliya & East Africa', bySec('somalia'), srcFor('somalia'), chk, '#somalia', '#soomaaliya'),
        block('world', 'Caalamka (World)', bySec('world'), srcFor('world'), null, '#world', '#caalamka'),
        block('sports', 'Ciyaaraha (Sports)', bySec('sports'), srcFor('sports'), null, '#sports', '#ciyaaraha'));
      // breaking + homepage all news
      var brk = A.filter(function (x) { return x.breaking && x.published !== false; });
      el.append(block('breaking', 'Breaking news', brk, null, h('p', { class: 'sub fine', text: 'The breaking banner is set on the Homepage screen (' + (((ST.site || {}).breaking || {}).mode || 'auto') + ' mode).' }), '#homepage', ''));
      el.append(block('all', 'Homepage “All news” feed', A, null, h('p', { class: 'sub fine', text: 'One unified feed of every published article, newest first, as built by the website (data/news.json updated ' + ago(ST.liveAt) + ').' }), '#homepage', ''));
      // live
      var LU = (L['live-updates.json'] && L['live-updates.json'].json) || { items: [] }, LS = L['live-updates-status.json'] && L['live-updates-status.json'].json;
      el.append(h('div', { class: 'card secard' }, h('div', { class: 'card-h' }, h('div', null, h('h3', { text: 'LIVE News' }), h('p', { class: 'sub', text: (LU.items || []).length + ' updates on the timeline (48 h); writer ' + (LS ? LS.mode : '?') + ', last check ' + ago(LS && LS.lastCheckAt) })),
        h('a', { class: 'btn small', href: '#live', text: 'Manage' }))));
      // categories editor
      var cats = ((ST.site && ST.site.categories) || []).slice();
      var list = h('div', { class: 'catlist' });
      function drawCats() {
        list.innerHTML = '';
        cats.forEach(function (c, i) {
          var used = A.filter(function (x) { return x.category === c; }).length, pubc = A.filter(function (x) { return x.category === c && x.published !== false; }).length;
          var nm = C().inp(c, { 'aria-label': 'Category name' }); nm.addEventListener('change', function () { cats[i] = nm.value.trim() || c; });
          list.append(h('div', { class: 'catrow' }, nm, h('span', { class: 'sub', text: pubc + ' published, ' + used + ' in all' }),
            h('button', { class: 'iconbtn', type: 'button', 'aria-label': 'Move up', text: '↑', disabled: i === 0, onclick: function () { cats.splice(i - 1, 0, cats.splice(i, 1)[0]); drawCats(); } }),
            h('button', { class: 'iconbtn', type: 'button', 'aria-label': 'Remove', html: W().ic('x'), disabled: used > 0, title: used ? 'Used by articles: rename instead' : 'Remove', onclick: function () { cats.splice(i, 1); drawCats(); } })));
        });
      }
      drawCats();
      var add = C().inp('', { placeholder: 'New category name' });
      el.append(section('Categories', 'Shown on articles and used by the filters. A category used by articles cannot be removed; renaming changes the list only, so articles keep their saved category until you edit them.',
        h('div', null, list, h('div', { class: 'row' }, add, h('button', { class: 'btn small', type: 'button', text: 'Add', onclick: function () { var v = add.value.trim(); if (v && cats.indexOf(v) < 0) { cats.push(v); add.value = ''; drawCats(); } } }),
          h('button', { class: 'btn small primary', type: 'button', text: 'Save categories', onclick: function () {
            var s = JSON.parse(JSON.stringify(ST.site)); s.categories = cats.filter(Boolean);
            C().commitFiles([{ path: 'data/site.json', text: JSON.stringify(s, null, 2) + '\n', expect: ST.siteSha }], 'Maamul: qaybaha (categories)').then(function (c) {
              C().track('Categories saved', c, { url: site() + 'data/site.json', field: 'categories', value: s.categories }, site()); return C().load(true);
            }).catch(function (e) { C().toast(e.message, true); });
          } })))));
    }).catch(function (e) { C().failBox(el, e, function () { V.sections(el); }); });
  };

  // ---------------------------------------------------------------- LIVE News
  var REGIONS = [['somalia', 'Somalia'], ['eastafrica', 'East Africa'], ['africa', 'Africa'], ['world', 'World']];
  V.live = function (el) {
    el.innerHTML = ''; el.append(C().loadingBox('Loading the LIVE News timeline…'));
    Promise.all([files(['live-updates.json', 'live-updates-status.json'], 'live-data'), files(['data/live-admin.json'])]).then(function (R) {
      var F = R[0], ADf = R[1]['data/live-admin.json'];
      var LU = (F['live-updates.json'] && F['live-updates.json'].json) || { items: [] }, LS = (F['live-updates-status.json'] && F['live-updates-status.json'].json) || {};
      var AD = (ADf && ADf.json) || { items: [], edits: {}, removed: [] };
      // the owner's own updates show at once here, even before the 5-minute check has put them on the timeline
      var shown = {}; (LU.items || []).forEach(function (u) { shown[u.id] = 1; });
      var waiting = (AD.items || []).filter(function (u) { return !shown[u.id] && (AD.removed || []).indexOf(u.id) < 0; });
      el.innerHTML = '';
      el.append(hero('LIVE News', 'The developing-news timeline on the LIVE News page. Updates appear only when something new is reported; nothing is published on a timer. You can correct, add, approve or remove updates.',
        [h('button', { class: 'btn primary', type: 'button', html: W().ic('plus') + '<span>Add update</span>', onclick: function () { editor(null); } }),
          h('a', { class: 'btn', href: site() + '#wararka-tooska', target: '_blank', rel: 'noopener', html: W().ic('ext') + '<span>Open LIVE News</span>' }),
          h('a', { class: 'btn ghost', href: '#livesrc', text: 'Sources' })]));
      var d = (LS.days || {})[dayEAT()] || {};
      el.append(h('div', { class: 'grid kpis' }, stat('Automatic writer', LS.mode === 'on' ? 'On' : 'Off', LS.mode === 'on' ? 'paid API within $' + ((LS.limits || {}).usdPerDay || '?') + '/day' : 'your own updates still publish; the paid writer stays off until you switch it on'),
        stat('Latest update', LU.items && LU.items[0] ? ago(LU.items[0].publishedAt) : '—', LU.items && LU.items[0] ? LU.items[0].so && LU.items[0].so.title : 'no update in the last 48 hours'),
        stat('Last source check', ago(LS.lastCheckAt), (d.skipped || 0) + ' items checked and skipped today'), stat('Failed updates today', n(d.failed || 0), (d.declined || 0) + ' declined as unverified', d.failed ? 'badk' : '')));
      var tl = h('ol', { class: 'ltl' });
      waiting.concat(LU.items || []).forEach(function (u) {
        tl.append(h('li', { class: u.breaking ? 'brk' : '' }, h('time', { text: fmt(u.publishedAt) }),
          h('div', null, h('div', { class: 'row' }, pill(u.by === 'admin' ? 'ok' : '', u.by === 'admin' ? 'by you' : u.editedBy ? 'automatic, corrected by you' : 'automatic'), !shown[u.id] ? pill('warn', 'reaching the website…') : null, u.breaking ? pill('bad', 'Breaking') : null, h('span', { class: 'sub', text: (REGIONS.find(function (r) { return r[0] === u.region; }) || [, u.region || ''])[1] })),
            h('b', { text: (u.so && u.so.title) || '(no headline)' }), h('p', { text: (u.so && u.so.text) || '' }),
            (u.sources || []).length ? h('details', { class: 'why' }, h('summary', { text: 'Sources used for verification (' + u.sources.length + ', private)' }), h('ul', null, u.sources.map(function (s) { return h('li', null, h('b', { text: (s.name || '') + ': ' }), s.url ? link(s.url, s.title || s.url) : h('span', { text: s.title || '' }), h('small', { text: s.publishedAt ? ' · ' + fmt(s.publishedAt) : '' })); }))) : null,
            h('div', { class: 'row' }, h('button', { class: 'btn small', type: 'button', text: 'Correct', onclick: function () { editor(u); } }),
              h('button', { class: 'btn small danger', type: 'button', text: 'Remove', onclick: function () {
                if (!confirm('Remove this update from the LIVE News page?')) return;
                var A2 = clone(); A2.items = A2.items.filter(function (x) { return x.id !== u.id; }); delete A2.edits[u.id];
                if (u.by !== 'admin' || shown[u.id]) A2.removed = A2.removed.concat([u.id]);
                save(A2, 'Removed LIVE update', { item: u.id, absent: true });
              } })))));
      });
      el.append(section('Timeline (last 48 hours)', 'Newest first, as shown on the website. The website shows the last 24 hours.', (LU.items || []).length ? tl : h('div', { class: 'empty', text: 'No LIVE update in the last 48 hours. While the automatic writer is off, the LIVE News page shows the newest Wartabiye TV stories; you can add an update yourself.' })));
      // pending developments: what the newsroom feeds reported and the checker did not publish
      var rec = (LS.recent || []).slice(0, 30);
      el.append(section('Pending developments', 'Recent newsroom reports the checker saw but did not publish, with the reason. Approve one to write it as your own update.',
        rec.length ? table(['Report', 'Result', ''], rec.map(function (x) {
          return h('tr', null, td(h('div', null, x.url ? link(x.url, x.title || x.url) : h('span', { text: x.title || '' }), h('div', { class: 'sub', text: (x.source || '') + ' · ' + fmt(x.at) }))),
            td(h('div', null, pill(x.result === 'written' ? 'ok' : x.result === 'failed' ? 'bad' : 'warn', x.result || '?'), h('div', { class: 'sub', text: x.reason || '' }))),
            td(x.result === 'written' ? '' : h('button', { class: 'btn small', type: 'button', text: 'Approve…', onclick: function () { editor(null, x); } })));
        })) : h('div', { class: 'empty', text: 'Nothing pending.' })));

      function clone() {
        var A2 = JSON.parse(JSON.stringify(AD)); A2.items = A2.items || []; A2.edits = A2.edits || {}; A2.removed = A2.removed || [];
        // keep the file small: forget what left the 48-hour timeline long ago
        var old = Date.now() - 72 * 3600e3;
        A2.items = A2.items.filter(function (u) { return Date.parse(u.publishedAt) > old; });
        return A2;
      }
      function save(A2, label, check) {
        A2.removed = A2.removed.filter(function (id, i, a) { return a.indexOf(id) === i; }).slice(-300);
        return C().commitFiles([{ path: 'data/live-admin.json', text: JSON.stringify(A2, null, 1) + '\n', expect: ADf ? ADf.oid : null }], 'Maamul: LIVE ' + label).then(function (c) {
          C().track(label, c, Object.assign({ url: 'https://raw.githubusercontent.com/' + repo() + '/live-data/live-updates.json' }, check), site() + '#wararka-tooska', true);
          C().toast('Saved. The 5-minute LIVE check puts it on the website, usually within 5–10 minutes.'); V.live(el);
        }).catch(function (e) { C().toast(e.message, true); });
      }
      function editor(u, from) {
        var isNew = !u;
        u = u ? JSON.parse(JSON.stringify(u)) : { id: 'admin-' + Date.now().toString(36), publishedAt: new Date().toISOString(), region: from && from.region || 'somalia', so: { title: '', text: '' }, by: 'admin', sources: from ? [{ name: from.source, url: from.url, title: from.title, publishedAt: from.at }] : [] };
        var t = C().inp(u.so && u.so.title, { maxlength: 160 }), x = C().area(u.so && u.so.text, 4), reg = C().sel(u.region, REGIONS), brk = C().check(u.breaking, 'Breaking (only when the event really is)');
        var when = C().inp(C().toLocal(u.publishedAt), { type: 'datetime-local' });
        var en = { title: C().inp(u.en && u.en.title), text: C().area(u.en && u.en.text, 3) };
        var body = h('div', null, from ? banner('', 'Reported by ' + (from.source || 'a newsroom'), from.title || '') : null,
          C().field('Headline (Somali)', t), C().field('Update text (Somali)', x, 'Two or three sentences in your own words; name the newsroom that reported it.'),
          h('div', { class: 'two' }, C().field('Region', reg), C().field('Time of the event (Mogadishu)', when, 'The time the news was first reported.')), brk,
          h('details', { class: 'why' }, h('summary', { text: 'English (optional; other languages show the Somali text when empty)' }), C().field('Headline (English)', en.title), C().field('Text (English)', en.text)));
        var m = C().modal(isNew ? 'Add a LIVE update' : 'Correct a LIVE update', body, [h('button', { class: 'btn', type: 'button', text: 'Cancel', onclick: function () { m.remove(); } }),
          h('button', { class: 'btn primary', type: 'button', text: isNew ? 'Publish update' : 'Save correction', onclick: function () {
            if (!t.value.trim() || !x.value.trim()) return C().toast('Write the headline and the text.', true);
            var at = when.value ? when.value + ':00+03:00' : u.publishedAt;
            if (Date.parse(at) > Date.now() + 5 * 60000) return C().toast('The time cannot be in the future.', true);
            if (Date.now() - Date.parse(at) > 24 * 3600e3) return C().toast('The LIVE page shows the last 24 hours only; use an article for older news.', true);
            u.so = { title: t.value.trim(), text: x.value.trim() }; u.region = reg.value; u.publishedAt = C().toLocal(u.publishedAt) === when.value ? u.publishedAt : new Date(at).toISOString();
            if (brk.firstChild.checked) u.breaking = true; else delete u.breaking;
            if (en.title.value.trim() && en.text.value.trim()) u.en = { title: en.title.value.trim(), text: en.text.value.trim() }; else if (isNew) delete u.en;
            m.remove();
            var A2 = clone();
            if (u.by === 'admin') { A2.items = A2.items.filter(function (y) { return y.id !== u.id; }).concat([{ id: u.id, publishedAt: u.publishedAt, region: u.region, so: u.so, en: u.en, breaking: u.breaking, sources: u.sources, by: 'admin' }]); }
            else { var e = { so: u.so, region: u.region, publishedAt: u.publishedAt, breaking: !!u.breaking }; if (u.en) e.en = u.en; A2.edits[u.id] = e; }
            save(A2, isNew ? 'Added LIVE update' : 'Corrected LIVE update', { item: u.id, title: u.so.title });
          } })]);
      }
    }).catch(function (e) { C().failBox(el, e, function () { V.live(el); }); });
  };

  // ---------------------------------------------------------------- Advertising
  var POS = [['home', 'Homepage banner'], ['sidebar', 'Sidebar'], ['card', 'Card in the news list'], ['article', 'Below articles'], ['mobile', 'Phones only'], ['spotlight', 'Business spotlight (homepage)'], ['video', 'YouTube video (sidebar)']];
  V.ads = function (el) {
    el.innerHTML = ''; el.append(C().loadingBox());
    Promise.all([files(['data/ads', 'data/site.json']), fetch(site() + 'ads.txt?cb=' + Date.now(), { cache: 'no-store' }).then(function (r) { return r.ok ? r.text() : ''; }).catch(function () { return ''; }),
      fetch(site() + '?cb=' + Date.now(), { cache: 'no-store' }).then(function (r) { return r.text(); }).catch(function () { return ''; })]).then(function (r) {
      var F = r[0], adsTxt = r[1], home = r[2];
      var ads = ((F['data/ads'] && F['data/ads'].entries) || []).filter(function (e) { return /\.json$/.test(e.name); }).map(function (e) { var a = {}; try { a = JSON.parse(e.object.text); } catch (x) {} a._id = e.name.slice(0, -5); a._sha = e.oid; return a; });
      var adsense = /pagead2\.googlesyndication\.com|ca-pub-\d+/.test(home), pubId = (home.match(/ca-pub-\d+/) || adsTxt.match(/pub-\d+/) || [''])[0];
      el.innerHTML = '';
      el.append(hero('Advertising', 'Your business adverts on the website, and the state of Google AdSense. No earnings or impressions are shown unless a real, authorised source provides them.',
        [h('button', { class: 'btn primary', type: 'button', html: W().ic('plus') + '<span>New advert</span>', onclick: function () { editAd(null); } }), h('a', { class: 'btn', href: '/cms/codsiyada/', target: '_blank', rel: 'noopener', text: 'Advertising requests (private)' })]));
      var today = dayEAT();
      var running = ads.filter(function (a) { return a.active !== false && (!a.start || a.start <= today) && (!a.end || a.end >= today); });
      el.append(h('div', { class: 'grid kpis' }, stat('Google AdSense', adsense ? 'Code on the site' : 'Not connected', adsense ? 'publisher ' + pubId + '; approval is shown only in your AdSense account' : 'no AdSense code on wartabiyetv.com', adsense ? '' : ''),
        stat('ads.txt', adsTxt ? 'Present' : 'Missing', adsTxt ? adsTxt.split('\n').filter(Boolean).length + ' line(s)' : 'needed once AdSense approves the site'),
        stat('Business adverts running', n(running.length), ads.length + ' saved in total'),
        stat('Revenue', 'Not available', 'needs the AdSense Management API authorised by you; never estimated')));
      el.append(banner('', 'What is measured', 'AdSense approval, impressions and earnings exist only inside your Google AdSense account. This dashboard shows them only after you connect AdSense through Google\'s official API; until then they are not shown. Business adverts are not counted separately yet.'));
      var rows = ads.map(function (a) {
        var st = a.active === false ? ['', 'Paused'] : a.end && a.end < today ? ['', 'Ended'] : a.start && a.start > today ? ['warn', 'Starts ' + a.start] : ['ok', 'Running'];
        return h('tr', null, td(h('div', null, h('b', { text: a.title || a._id }), h('div', { class: 'sub', text: a.advertiser || '' }))), td((a.positions || []).map(function (p) { return (POS.find(function (x) { return x[0] === p; }) || [, p])[1]; }).join(', ')),
          td((a.start || '…') + ' → ' + (a.end || '…')), td(pill(st[0], st[1])),
          td(h('div', { class: 'row' }, h('button', { class: 'btn small', type: 'button', text: 'Edit', onclick: function () { editAd(a); } }),
            h('button', { class: 'btn small ghost', type: 'button', text: a.active === false ? 'Resume' : 'Pause', onclick: function () { var b = JSON.parse(JSON.stringify(a)); b.active = a.active === false; saveAd(b, a, b.active ? 'Advert resumed' : 'Advert paused'); } }),
            h('button', { class: 'btn small danger', type: 'button', text: 'Delete', onclick: function () { if (confirm('Delete the advert "' + (a.title || a._id) + '"?')) commitAd([{ path: 'data/ads/' + a._id + '.json', delete: true, expect: a._sha }], 'Advert deleted', a._id, true); } }))));
      });
      el.append(section('Business adverts and sponsored campaigns', 'Each advert runs between its start and end dates in the positions you choose.', rows.length ? table(['Advert', 'Placements', 'Campaign dates', 'State', ''], rows) : h('div', { class: 'empty', text: 'No advert yet. Press “New advert” to add one.' })));
      function commitAd(changes, label, id, absent) {
        C().commitFiles(changes, 'Maamul: xayeysiis "' + id + '"').then(function (c) { C().track(label, c, { url: site() + 'data/ads.json', list: 'ads', item: id, absent: absent }, site()); V.ads(el); }).catch(function (e) { C().toast(e.message, true); });
      }
      function saveAd(b, old, label) {
        var id = old ? old._id : (b.title || 'xayeysiis').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) + '-' + Date.now().toString(36).slice(-4);
        var c = {}; for (var k in b) if (k.charAt(0) !== '_') c[k] = b[k];
        var visible = c.active !== false && (!c.end || c.end >= today) && (!c.start || c.start <= today);
        commitAd([{ path: 'data/ads/' + id + '.json', text: JSON.stringify(c, null, 2) + '\n', expect: old ? old._sha : null }], label, id, !visible);
      }
      function editAd(a) {
        var b = a ? JSON.parse(JSON.stringify(a)) : { title: '', advertiser: '', text: '', positions: ['sidebar'], active: true };
        var t = C().inp(b.title), adv = C().inp(b.advertiser), tx = C().area(b.text, 2), lk = C().inp(b.link, { type: 'url', placeholder: 'https://…' }), img = C().inp(b.image, { placeholder: 'img/… (optional)' }), alt = C().inp(b.imageAlt);
        var st = C().inp(b.start, { type: 'date' }), en = C().inp(b.end, { type: 'date' });
        var pos = h('div', { class: 'chips' }, POS.map(function (p) { var c = C().check((b.positions || []).indexOf(p[0]) >= 0, p[1]); c.dataset.v = p[0]; return c; }));
        var m = C().modal(a ? 'Edit advert' : 'New advert', h('div', null, h('div', { class: 'two' }, C().field('Advert title', t), C().field('Business name', adv)), C().field('Short text', tx),
          C().field('Placements', pos), h('div', { class: 'two' }, C().field('Link', lk), C().field('Picture (path in the website files)', img, 'Upload pictures in the Media Library first.')), C().field('Picture description', alt),
          h('div', { class: 'two' }, C().field('Campaign start', st), C().field('Campaign end', en))),
          [h('button', { class: 'btn', type: 'button', text: 'Cancel', onclick: function () { m.remove(); } }), h('button', { class: 'btn primary', type: 'button', text: 'Save and publish', onclick: function () {
            if (!t.value.trim()) return C().toast('Write the advert title.', true);
            if (lk.value && !/^https:\/\//.test(lk.value)) return C().toast('The link must start with https://', true);
            b.title = t.value.trim(); b.advertiser = adv.value.trim(); b.text = tx.value.trim(); b.link = lk.value.trim(); b.image = img.value.trim(); b.imageAlt = alt.value.trim();
            b.start = st.value || undefined; b.end = en.value || undefined;
            b.positions = [].filter.call(pos.children, function (c) { return c.firstChild.checked; }).map(function (c) { return c.dataset.v; });
            if (!b.positions.length) return C().toast('Choose at least one placement.', true);
            ['text', 'link', 'image', 'imageAlt'].forEach(function (k) { if (!b[k]) delete b[k]; });
            m.remove(); saveAd(b, a, a ? 'Advert updated' : 'Advert published');
          } })]);
      }
    }).catch(function (e) { C().failBox(el, e, function () { V.ads(el); }); });
  };

  // ---------------------------------------------------------------- SEO & website health
  V.health = function (el) {
    el.innerHTML = ''; el.append(C().loadingBox('Checking the website…'));
    var get = function (p) { var t0 = performance.now(); return fetch(site() + p + (p.indexOf('?') < 0 ? '?' : '&') + 'cb=' + Date.now(), { cache: 'no-store' }).then(function (r) { return r.text().then(function (t) { return { ok: r.ok, status: r.status, text: t, ms: Math.round(performance.now() - t0), bytes: t.length }; }); }).catch(function (e) { return { ok: false, status: 0, text: '', error: e.message }; }); };
    Promise.all([C().load(), get(''), get('sitemap.xml'), get('robots.txt'), get('data/news.json'), automationData().catch(function () { return null; }), fetch('/health').then(function (r) { return r.json(); }).catch(function () { return null; })]).then(function (r) {
      var ST = r[0], home = r[1], sm = r[2], rb = r[3], nj = r[4], A = r[5], HL = r[6];
      el.innerHTML = '';
      el.append(hero('SEO & website health', 'Checked now from this browser against the real wartabiyetv.com, and from the website files.',
        [h('button', { class: 'btn', type: 'button', html: W().ic('refresh') + '<span>Check again</span>', onclick: function () { V.health(el); } })]));
      var pub = ST.articles.filter(function (x) { return x.published !== false; });
      var locs = (sm.text.match(/<loc>/g) || []).length, lastmod = (sm.text.match(/<lastmod>([^<]+)/g) || []).map(function (x) { return x.slice(9); }).sort().pop();
      var lastOk = A && (A.allRuns || []).filter(function (x) { return /publish\.yml$/.test(x.path) && x.conclusion === 'success'; })[0];
      el.append(h('div', { class: 'grid kpis' },
        stat('Homepage', home.ok ? home.ms + ' ms' : 'Error', home.ok ? Math.round(home.bytes / 1024) + ' KB HTML, loaded from this browser' : 'HTTP ' + home.status, home.ok ? (home.ms < 1500 ? 'good' : '') : 'badk'),
        stat('Sitemap', sm.ok ? n(locs) + ' pages' : 'Missing', sm.ok ? (lastmod ? 'updated ' + ago(lastmod) : '') + ' · ' + n(pub.length) + ' published articles' : 'sitemap.xml not found', sm.ok ? 'good' : 'badk'),
        stat('robots.txt', rb.ok ? 'Present' : 'Missing', rb.ok && /sitemap/i.test(rb.text) ? 'points search engines to the sitemap' : rb.ok ? 'does not mention the sitemap' : '', rb.ok ? 'good' : 'badk'),
        stat('News feed', nj.ok ? Math.round(nj.bytes / 1024) + ' KB' : 'Error', nj.ok ? nj.ms + ' ms · data/news.json' : 'HTTP ' + nj.status),
        stat('Last successful deployment', lastOk ? ago(lastOk.updated) : '—', lastOk ? fmt(lastOk.updated) : ''),
        stat('Admin service (Cloudflare)', HL && HL.ok ? 'Healthy' : 'Problem', HL ? 'database ' + (HL.db ? 'ok' : 'down') : 'no answer', HL && HL.ok ? 'good' : 'badk')));
      // content checks
      var noSum = pub.filter(function (x) { return !x.summary; }), noAlt = pub.filter(function (x) { return x.image && !x.imageAlt; }), noImg = pub.filter(function (x) { return !x.image; });
      var dupT = {}, dupI = {}, dupS = {};
      pub.forEach(function (x) { var t = (x.title || '').trim().toLowerCase(); if (t) (dupT[t] = dupT[t] || []).push(x); if (x.image) (dupI[x.image] = dupI[x.image] || []).push(x); if (x.sourceUrl) { var s = x.sourceUrl.split('?')[0]; (dupS[s] = dupS[s] || []).push(x); } });
      var multi = function (o) { return Object.keys(o).filter(function (k) { return o[k].length > 1; }).map(function (k) { return o[k]; }); };
      var dT = multi(dupT), dI = multi(dupI), dS = multi(dupS);
      var trMiss = pub.filter(function (x) { return C().LANGS.some(function (l) { return !(x[l[0]] && x[l[0]].title); }); });
      // links in the menu, breaking banner and homepage pins
      var ids = {}; ST.articles.forEach(function (x) { ids[x.id] = x; });
      var broken = [];
      var S = ST.site || {};
      function chkLink(where, l) {
        if (!l) return;
        var m = String(l).match(/(?:#war-|\/war\/)([a-z0-9-]+?)(?:\.html)?$/);
        if (m && (!ids[m[1]] || ids[m[1]].published === false)) broken.push([where, l, ids[m[1]] ? 'article not published' : 'article does not exist']);
      }
      (S.nav || []).forEach(function (x) { chkLink('Menu: ' + x.label, x.link); });
      ((S.breaking || {}).items || []).forEach(function (x) { chkLink('Breaking banner', x.link); });
      (S.announcement || {}).link && chkLink('Announcement', S.announcement.link);
      C().featuredIds().forEach(function (id) { if (!ids[id] || ids[id].published === false) broken.push(['Homepage pin', id, ids[id] ? 'article not published' : 'article does not exist']); });
      pub.forEach(function (x) { String(x.body || '').replace(/#war-([a-z0-9-]+)/g, function (_, id) { if (!ids[id]) broken.push(['Article: ' + x.title, '#war-' + id, 'article does not exist']); }); });
      function list(items, fn) { return items.length ? h('details', { class: 'why' }, h('summary', { text: 'Show ' + items.length }), h('ul', null, items.slice(0, 80).map(fn))) : null; }
      var artLi = function (x) { return h('li', null, h('a', { href: '#articles?edit=' + encodeURIComponent(x.id), text: x.title || x.id })); };
      var grpLi = function (g) { return h('li', null, h('span', { text: g.length + '× ' }), g.map(function (x, i) { return [i ? h('span', { text: ' / ' }) : null, h('a', { href: '#articles?edit=' + encodeURIComponent(x.id), text: x.title })]; })); };
      el.append(section('Content checks', 'Published articles only', table(['Check', 'Result', ''], [
        h('tr', null, td('Broken internal links (menu, banner, pins, article text)'), td(pill(broken.length ? 'bad' : 'ok', broken.length ? broken.length + ' found' : 'none')), td(list(broken, function (b) { return h('li', { text: b[0] + ' → ' + b[1] + ' (' + b[2] + ')' }); }))),
        h('tr', null, td('Missing summary (description for Google)'), td(pill(noSum.length ? 'warn' : 'ok', noSum.length || 'none')), td(list(noSum, artLi))),
        h('tr', null, td('Missing photo description (alt text)'), td(pill(noAlt.length ? 'warn' : 'ok', noAlt.length || 'none')), td(list(noAlt, artLi))),
        h('tr', null, td('No photo'), td(pill(noImg.length ? 'warn' : 'ok', noImg.length || 'none')), td(list(noImg, artLi))),
        h('tr', null, td('Duplicate headlines'), td(pill(dT.length ? 'warn' : 'ok', dT.length || 'none')), td(list(dT, grpLi))),
        h('tr', null, td('Same photo on several articles'), td(pill(dI.length ? 'warn' : 'ok', dI.length || 'none')), td(list(dI, grpLi))),
        h('tr', null, td('Same source link twice'), td(pill(dS.length ? 'warn' : 'ok', dS.length || 'none')), td(list(dS, grpLi))),
        h('tr', null, td('Duplicate page addresses (URLs)'), td(pill('ok', 'none possible')), td(h('span', { class: 'sub', text: 'Each article has one file and one address: war/<id>.html' }))),
        h('tr', null, td('Not translated into all 9 languages'), td(pill(trMiss.length ? 'warn' : 'ok', trMiss.length || 'none')), td(list(trMiss, artLi)))])));
      // performance via Google PageSpeed Insights (public API, no key, limited number of checks)
      var ps = h('div', null, h('p', { class: 'sub', text: 'Runs Google\'s own Lighthouse test on wartabiyetv.com (takes about 30 seconds). Free, without a key, limited to a few checks per day.' }),
        h('div', { class: 'row' }, h('button', { class: 'btn small primary', type: 'button', text: 'Test mobile', onclick: function () { pagespeed('mobile'); } }), h('button', { class: 'btn small', type: 'button', text: 'Test desktop', onclick: function () { pagespeed('desktop'); } })));
      var psOut = h('div');
      el.append(section('Page speed (mobile and desktop)', 'Google PageSpeed Insights', h('div', null, ps, psOut)));
      function pagespeed(strategy) {
        psOut.innerHTML = ''; psOut.append(skel(80), h('p', { class: 'sub', text: 'Google is testing the ' + strategy + ' version…' }));
        fetch('https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=' + encodeURIComponent(site()) + '&strategy=' + strategy + '&category=performance&category=seo&category=accessibility').then(function (r) { return r.json(); }).then(function (j) {
          psOut.innerHTML = '';
          if (j.error) return psOut.append(banner('bad', 'Google could not run the test', j.error.message + (j.error.code === 429 ? ' (the free daily limit is used up; try again later)' : '')));
          var c = j.lighthouseResult.categories, a = j.lighthouseResult.audits;
          var sc = function (k) { return c[k] ? Math.round(c[k].score * 100) : '—'; };
          psOut.append(h('div', { class: 'grid kpis mini' }, stat('Performance (' + strategy + ')', String(sc('performance')), 'out of 100', sc('performance') >= 90 ? 'good' : sc('performance') < 50 ? 'badk' : ''),
            stat('SEO', String(sc('seo')), 'out of 100'), stat('Accessibility', String(sc('accessibility')), 'out of 100'),
            stat('Largest content shown', a['largest-contentful-paint'] ? a['largest-contentful-paint'].displayValue : '—', 'LCP'), stat('Layout shift', a['cumulative-layout-shift'] ? a['cumulative-layout-shift'].displayValue : '—', 'CLS')));
        }).catch(function (e) { psOut.innerHTML = ''; psOut.append(W().errBox(e)); });
      }
      // search console + workflow failures
      el.append(section('Google Search Console', 'Indexing and search clicks', h('div', null, banner('', 'Needs your authorisation', 'Google shows indexing status and search clicks only to the verified site owner. Open Search Console with your Google account; connecting it here would need Google\'s official API and your sign-in.'),
        h('a', { class: 'btn small', href: 'https://search.google.com/search-console?resource_id=' + encodeURIComponent(site()), target: '_blank', rel: 'noopener', text: 'Open Search Console' }))));
      var fails = A ? (A.workflows || []).filter(function (w) { return w.status === 'completed' && w.conclusion === 'failure'; }) : [];
      el.append(section('GitHub workflow failures', 'Jobs whose latest run failed', fails.length ? W().autoList(fails) : banner('ok', 'No failing job', '')));
    }).catch(function (e) { C().failBox(el, e, function () { V.health(el); }); });
  };

  // ---------------------------------------------------------------- Website settings
  V.settings = function (el) {
    el.innerHTML = ''; el.append(C().loadingBox());
    // only the two settings files: fresh from GitHub, without reloading every article
    files(['data/site.json', 'data/notify-settings.json']).then(function (r) {
      var SF = r['data/site.json'], NS = r['data/notify-settings.json'];
      if (!SF || !SF.json) throw new Error('Could not read data/site.json');
      var ST = { site: SF.json, siteSha: SF.oid }, S = JSON.parse(JSON.stringify(ST.site)), N = (NS && NS.json) || {};
      el.innerHTML = '';
      el.append(hero('Website settings', 'Saved to the website files and published like an article. Secrets are never stored here.', [h('a', { class: 'btn ghost', href: '#editor', text: 'Every other setting (Full editor)' })]));
      // identity
      var tag = C().inp(S.tagline), about = C().area(S.about, 3), motto = C().inp(S.motto), city = C().inp(S.city);
      var enTag = C().inp(S.en && S.en.tagline), enAbout = C().area(S.en && S.en.about, 3);
      el.append(section('Website identity', 'Shown in the header, footer and “About”. The other languages are edited in the Full editor.', h('div', null,
        h('div', { class: 'two' }, C().field('Tagline (Somali)', tag), C().field('Tagline (English)', enTag)), h('div', { class: 'two' }, C().field('About (Somali)', about), C().field('About (English)', enAbout)),
        h('div', { class: 'two' }, C().field('Motto', motto), C().field('City / location', city)),
        h('button', { class: 'btn primary', type: 'button', text: 'Save identity', onclick: function () {
          S.tagline = tag.value.trim(); S.about = about.value.trim(); S.motto = motto.value.trim(); S.city = city.value.trim();
          S.en = Object.assign({}, S.en, { tagline: enTag.value.trim(), about: enAbout.value.trim() });
          saveSite('identity', 'tagline', S.tagline);
        } }))));
      // navigation
      var nav = (S.nav || []).map(function (x) { return Object.assign({}, x); }), navBox = h('div', { class: 'catlist' });
      function drawNav() {
        navBox.innerHTML = '';
        nav.forEach(function (x, i) {
          var l = C().inp(x.label, { 'aria-label': 'Menu label' }), k = C().inp(x.link, { 'aria-label': 'Menu link' });
          l.addEventListener('change', function () { x.label = l.value.trim(); }); k.addEventListener('change', function () { x.link = k.value.trim(); });
          navBox.append(h('div', { class: 'catrow' }, l, k, h('button', { class: 'iconbtn', type: 'button', text: '↑', 'aria-label': 'Move up', disabled: i === 0, onclick: function () { nav.splice(i - 1, 0, nav.splice(i, 1)[0]); drawNav(); } }),
            h('button', { class: 'iconbtn', type: 'button', html: W().ic('x'), 'aria-label': 'Remove', onclick: function () { if (confirm('Remove "' + x.label + '" from the menu?')) { nav.splice(i, 1); drawNav(); } } })));
        });
      }
      drawNav();
      el.append(section('Navigation menu', 'The main menu, in order. Links like #caalamka open a section; full https:// links open another site.', h('div', null, navBox,
        h('div', { class: 'row' }, h('button', { class: 'btn small', type: 'button', text: 'Add menu item', onclick: function () { nav.push({ label: 'Cusub', link: '#' }); drawNav(); } }),
          h('button', { class: 'btn small primary', type: 'button', text: 'Save menu', onclick: function () {
            if (nav.some(function (x) { return !x.label || !x.link; })) return C().toast('Every menu item needs a label and a link.', true);
            S.nav = nav; saveSite('menu', 'nav', nav);
          } })))));
      // social + contact
      var soc = Object.assign({}, S.social || {}), socBox = h('div', { class: 'two' });
      ['facebook', 'youtube', 'tiktok', 'instagram', 'x', 'whatsapp', 'telegram'].forEach(function (k) { var i = C().inp(soc[k], { type: 'url', placeholder: 'https://…' }); i.addEventListener('change', function () { if (i.value.trim()) soc[k] = i.value.trim(); else delete soc[k]; }); socBox.append(C().field(k.charAt(0).toUpperCase() + k.slice(1), i)); });
      el.append(section('Social media links', 'Facebook, YouTube and TikTok are shown on the website (header, menu and footer). The other platforms are kept here but are not shown. A footer icon also needs its switch on under Footer below.', h('div', null, socBox, h('button', { class: 'btn primary', type: 'button', text: 'Save social links', onclick: function () {
        for (var k in soc) if (!/^https:\/\//.test(soc[k])) return C().toast(k + ': the link must start with https://', true);
        S.social = soc; saveSite('social links', 'social', soc);
      } }))));
      // footer: contact email + which official accounts get an icon (the header is not changed by these settings)
      var FT = Object.assign({}, S.footer || {}), FI = Object.assign({}, FT.icons || {});
      var MAIL = /^[^\s@<>()"',;:\\]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/;
      var fm = C().inp(S.contact && S.contact.email, { type: 'email', placeholder: 'name@example.com', autocomplete: 'off' });
      var fshow = C().check(FT.showEmail !== false, 'Show the email in the footer');
      var FSOC = [['facebook', 'Facebook'], ['youtube', 'YouTube'], ['tiktok', 'TikTok']];
      var fchk = FSOC.map(function (x) { var has = /^https:\/\//.test((S.social || {})[x[0]] || ''); var c = C().check(has && FI[x[0]] !== false, x[1] + (has ? '' : ' (no link set above)')); c.firstChild.disabled = !has; return c; });
      var fprev = h('div', { class: 'banner' });
      function footPrev() {
        var e = fm.value.trim(), icons = FSOC.filter(function (x, i) { return fchk[i].firstChild.checked; }).map(function (x) { return x[1]; });
        var mail = !e ? 'no email (set one to show it)' : !MAIL.test(e) ? 'email not valid yet' : fshow.firstChild.checked ? e + ' (opens the reader\'s email app)' : 'email hidden';
        fprev.className = 'banner ' + (e && !MAIL.test(e) ? 'bad' : 'ok');
        fprev.textContent = 'Preview of the website footer: ' + mail + ' · icons: ' + (icons.length ? icons.join(', ') : 'none');
      }
      [fm, fshow.firstChild].concat(fchk.map(function (c) { return c.firstChild; })).forEach(function (x) { x.addEventListener('input', footPrev); x.addEventListener('change', footPrev); });
      footPrev();
      el.append(section('Footer', 'The contact email and the social icons at the bottom of every page. The header keeps its own icons and is not changed here.', h('div', null,
        C().field('Contact email (shown as a clickable mailto: link)', fm, 'Leave empty to show no email.'), fshow,
        h('div', { class: 'chips' }, fchk), fprev,
        h('button', { class: 'btn primary', type: 'button', text: 'Save footer', onclick: function () {
          var e = fm.value.trim();
          if (e && !MAIL.test(e)) return C().toast('Enter a valid email address, for example name@example.com', true);
          FSOC.forEach(function (x, i) { FI[x[0]] = fchk[i].firstChild.checked || (fchk[i].firstChild.disabled && FI[x[0]] !== false); });
          var mailChanged = ((S.contact && S.contact.email) || '') !== e;
          S.contact = Object.assign({}, S.contact, { email: e });
          S.footer = Object.assign({}, FT, { showEmail: fshow.firstChild.checked, icons: FI });
          // the publish tracker confirms the changed part on the live data/site.json
          if (mailChanged) saveSite('footer email', 'contact', S.contact); else saveSite('footer', 'footer', S.footer);
        } }))));
      var forms = Object.assign({}, S.forms || {}), fe = C().inp(forms.endpoint, { type: 'url' });
      el.append(section('Contact form', 'Where messages from the contact page are sent (' + (forms.provider || 'not set') + '). The form provider\'s key is public by design; no password belongs here.', h('div', null,
        C().field('Form address', fe), h('button', { class: 'btn', type: 'button', text: 'Save contact form', onclick: function () { forms.endpoint = fe.value.trim(); S.forms = forms; saveSite('contact form', 'forms', forms); } }))));
      // homepage sections
      var secs = Object.assign({}, S.sections || {}), names = { featured: 'Featured stories', latest: 'Latest news', sidebar: 'Sidebar', sidebarLatest: 'Sidebar: latest', programmes: 'Programmes', footerLatest: 'Footer: latest', videos: 'Videos', live: 'LIVE News', liveSports: 'Live scores' };
      var secBox = h('div', { class: 'chips' }, Object.keys(names).map(function (k) { var c = C().check(secs[k] !== false, names[k]); c.firstChild.addEventListener('change', function () { secs[k] = c.firstChild.checked; }); return c; }));
      el.append(section('Homepage sections', 'Switch whole parts of the homepage on or off. Pins, the lead story and banners are on the Homepage screen.', h('div', null, secBox,
        h('button', { class: 'btn', type: 'button', text: 'Save sections', onclick: function () { S.sections = secs; saveSite('homepage sections', 'sections', secs); } }))));
      // notifications
      var pe = C().check(N.pushEnabled, 'Send browser push alerts'), qh = C().check(N.quietHours && N.quietHours.enabled, 'Quiet hours (no routine alerts at night)');
      var qf = C().inp(N.quietHours && N.quietHours.from, { type: 'number', min: 0, max: 23 }), qt = C().inp(N.quietHours && N.quietHours.to, { type: 'number', min: 0, max: 23 });
      var mr = C().inp(N.maxRoutinePerDay, { type: 'number', min: 0, max: 50 }), mb = C().inp(N.maxBreakingPerDay, { type: 'number', min: 0, max: 20 });
      var nc = Object.assign({}, N.categories || {}), ncBox = h('div', { class: 'chips' }, Object.keys(nc).map(function (k) { var c = C().check(nc[k], k); c.firstChild.addEventListener('change', function () { nc[k] = c.firstChild.checked; }); return c; }));
      el.append(section('Notifications', 'Browser alerts to readers who subscribed. ' + (N.workerUrl ? '' : 'Push sending is not set up yet (no push service address), so alerts are not sent even when switched on.'), h('div', null, pe, ncBox,
        h('div', { class: 'two' }, C().field('Routine alerts per day (max)', mr), C().field('Breaking alerts per day (max)', mb)), qh, h('div', { class: 'two' }, C().field('Quiet from (hour)', qf), C().field('Quiet until (hour)', qt)),
        h('button', { class: 'btn', type: 'button', text: 'Save notifications', onclick: function () {
          var N2 = Object.assign({}, N, { pushEnabled: pe.firstChild.checked, categories: nc, maxRoutinePerDay: +mr.value || 0, maxBreakingPerDay: +mb.value || 0, quietHours: { enabled: qh.firstChild.checked, from: +qf.value || 0, to: +qt.value || 0 } });
          C().commitFiles([{ path: 'data/notify-settings.json', text: JSON.stringify(N2, null, 1) + '\n', expect: NS && NS.oid }], 'Maamul: ogeysiisyada').then(function (c) {
            C().track('Notification settings saved', c, { url: site() + 'data/notify-settings.json', field: 'pushEnabled', value: N2.pushEnabled }, null); V.settings(el);
          }).catch(function (e) { C().toast(e.message, true); });
        } }))));
      el.append(section('Languages', 'The website has nine languages: Somali (main), English, Arabic, French, Dutch, Italian, German, Turkish and Spanish. Each article\'s translations are edited in its editor.', h('div', { class: 'chips' }, [['so', 'Somali']].concat(C().LANGS).map(function (l) { return pill('ok', l[1]); }))));
      el.append(section('Not editable here', 'These are part of the website\'s code, not its settings, so a mistake could take the site down or hurt search ranking.', h('ul', { class: 'plain' },
        h('li', { text: 'Logo, favicon and website title: in the website code (index.html, img/logo.png). Ask for a change and it is made and tested as code.' }),
        h('li', { text: 'SEO defaults (page descriptions and sharing pictures): generated for every page from each article\'s headline, summary and photo.' }),
        h('li', { text: 'Maintenance mode: not built, on purpose: hiding the site would remove it from Google. Use the announcement bar on the Homepage screen to tell readers about a problem.' }),
        h('li', { text: 'Opening hours: the website has none configured.' }))));
      function saveSite(label, key, value) {
        C().commitFiles([{ path: 'data/site.json', text: JSON.stringify(S, null, 2) + '\n', expect: ST.siteSha }], 'Maamul: ' + label).then(function (c) {
          C().track('Saved ' + label, c, { url: site() + 'data/site.json', field: key, value: value }, site()); V.settings(el);
        }).catch(function (e) { C().toast(e.message, true); });
      }
    }).catch(function (e) { C().failBox(el, e, function () { V.settings(el); }); });
  };

  // ---------------------------------------------------------------- admin-wide search (top bar, also Ctrl+K or /)
  var SCREENS = [['dashboard', 'Overview'], ['analytics', 'Analytics'], ['articles', 'Articles'], ['somalia', 'Somalia news'], ['world', 'World news'], ['sports', 'Sports news'], ['sections', 'Sections & categories'], ['live', 'LIVE News'],
    ['media', 'Media Library'], ['homepage', 'Homepage editor'], ['ads', 'Advertising'], ['automation', 'News automation'], ['health', 'SEO & website health'], ['settings', 'Website settings'], ['notifications', 'Notifications'], ['security', 'Security & sessions'], ['editor', 'Full editor']];
  function setupSearch() {
    var box = document.getElementById('gsearch'), res = document.getElementById('gresults');
    if (!box || !res) return;
    var sel = -1, items = [];
    function close() { res.hidden = true; sel = -1; }
    function draw() {
      var q = box.value.trim().toLowerCase(); res.innerHTML = ''; items = [];
      if (!q) return close();
      SCREENS.filter(function (s) { return s[1].toLowerCase().indexOf(q) >= 0; }).slice(0, 4).forEach(function (s) { items.push({ k: 'Screen', t: s[1], href: '#' + s[0] }); });
      var ST = C().store();
      if (ST) {
        ST.articles.filter(function (a) { return (a.title + ' ' + a.id).toLowerCase().indexOf(q) >= 0; }).slice(0, 7).forEach(function (a) { items.push({ k: a.published === false ? 'Draft' : 'Article', t: a.title, href: '#articles?edit=' + encodeURIComponent(a.id) }); });
        ST.images.filter(function (i) { return i.name.toLowerCase().indexOf(q) >= 0; }).slice(0, 3).forEach(function (i) { items.push({ k: 'Photo', t: i.name, href: '#media' }); });
        ((ST.site && ST.site.categories) || []).filter(function (c) { return c.toLowerCase().indexOf(q) >= 0; }).forEach(function (c) { items.push({ k: 'Category', t: c, href: '#sections' }); });
      } else C().load().then(draw).catch(function () {});
      if (!items.length) res.append(h('div', { class: 'gr-empty', text: ST ? 'Nothing found' : 'Loading the website content…' }));
      items.forEach(function (x, i) { res.append(h('a', { href: x.href, class: 'gr' + (i === sel ? ' on' : ''), onclick: function () { box.value = ''; close(); } }, h('small', { text: x.k }), h('span', { text: x.t }))); });
      res.hidden = false;
    }
    box.addEventListener('input', function () { sel = -1; draw(); });
    box.addEventListener('focus', function () { C().load().catch(function () {}); if (box.value) draw(); });
    box.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); sel = Math.max(0, Math.min(items.length - 1, sel + (e.key === 'ArrowDown' ? 1 : -1))); draw(); }
      if (e.key === 'Enter' && items.length) { location.hash = items[Math.max(0, sel)].href; box.value = ''; close(); box.blur(); }
      if (e.key === 'Escape') { box.value = ''; close(); box.blur(); }
    });
    document.addEventListener('click', function (e) { if (!res.contains(e.target) && e.target !== box) close(); });
    addEventListener('keydown', function (e) { if ((e.key === 'k' && (e.ctrlKey || e.metaKey)) || (e.key === '/' && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName))) { e.preventDefault(); box.focus(); } });
  }

  // ---------------------------------------------------------------- alerts bell (checked every 3 minutes)
  var lastAlerts = [];
  function setBell(al) {
    lastAlerts = al;
    var b = document.getElementById('bellBtn'); if (!b) return;
    var c = b.querySelector('.cnt'); c.textContent = al.length ? String(al.length) : ''; c.hidden = !al.length;
    b.classList.toggle('bad', al.some(function (x) { return x.k === 'bad'; }));
    b.title = al.length ? al.length + ' alert(s)' : 'No alerts';
  }
  function setupBell() {
    var b = document.getElementById('bellBtn'), p = document.getElementById('bellPanel'); if (!b || !p) return;
    b.addEventListener('click', function (e) {
      e.stopPropagation();
      if (!p.hidden) { p.hidden = true; return; }
      p.innerHTML = '';
      p.append(h('div', { class: 'card-h' }, h('h3', { text: 'Alerts' }), h('a', { class: 'toggle', href: '#dashboard', text: 'Overview →', onclick: function () { p.hidden = true; } })));
      if (!lastAlerts.length) p.append(h('p', { class: 'sub', text: 'No problems found in the last check.' }));
      lastAlerts.forEach(function (x) { p.append(h('a', { class: 'al ' + x.k, href: x.href || '#dashboard', target: /^https?:/.test(x.href || '') ? '_blank' : null, onclick: function () { p.hidden = true; } }, h('b', { text: x.t }), h('span', { text: x.d }))); });
      p.hidden = false;
    });
    document.addEventListener('click', function (e) { if (!p.contains(e.target)) p.hidden = true; });
    function check() {
      Promise.all([siteStatus(), automationData(true).catch(function () { return null; }), Promise.resolve(C().store())]).then(function (r) { setBell(computeAlerts({ siteStat: r[0], auto: r[1], store: r[2] })); });
    }
    setTimeout(check, 4000); setInterval(function () { if (!document.hidden) check(); }, 180000);
  }
  // exposed for tests
  window.WTV_CONTROL = { cronNext: cronNext, computeAlerts: computeAlerts };
  if (document.readyState === 'loading') addEventListener('DOMContentLoaded', function () { setupSearch(); setupBell(); }); else { setupSearch(); setupBell(); }
})();
