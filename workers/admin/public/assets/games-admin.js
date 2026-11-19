// Wartabiye TV admin: Games Management. Reads and writes data/games.json in the website repository (one commit per save)
// and uploads game thumbnails to img/games/. Play counts come from this Worker's own visitor counter (/games-<id> paths).
// Each game uses one of the built-in game engines in games/g/<engine>.js; a new card can reuse an engine with its own
// title, text, category and options (for example a second word search with different words).
(function () {
  'use strict';
  var V = window.WTV_VIEWS;
  var W = function () { return window.WTV; }, C = function () { return window.WTVC; };
  var h = function () { return W().h.apply(null, arguments); };
  var PATH = 'data/games.json';
  var ENGINES = [['blocks', 'Falling blocks'], ['brain', 'Brain Gym (quick maths, colours…)'], ['builder', 'Block Builder (sandbox)'], ['checkers', 'Checkers'], ['chess', 'Chess'],
    ['coloring', 'Colouring book'], ['crossword', 'Crossword'], ['dominoes', 'Dominoes'], ['draw', 'Drawing'], ['four', 'Four in a Row'], ['hoops', 'Basketball shots'],
    ['kidsquiz', 'Kids quiz (letters, counting, maths, words)'], ['ludo', 'Four Homes (dice board game)'], ['maze', 'Maze adventure'], ['memory', 'Memory cards'], ['merge', '2048-style merge'],
    ['pairs', 'Picture matching'], ['parking', 'Car parking'], ['penalty', 'Football penalties'], ['racer', 'Highway racing'], ['reaction', 'Reaction test'], ['runner', 'City runner'],
    ['shapes', 'Shape sorter'], ['slide', 'Sliding puzzle'], ['snake', 'Snake'], ['solitaire', 'Solitaire'], ['spell', 'Word builder'], ['sudoku', 'Sudoku'], ['tiles', 'Tile match (mahjong-style)'],
    ['trivia', 'Trivia quiz'], ['wordsearch', 'Word search']];
  var CATS = [['kids', 'Kids'], ['teens', 'Teenagers'], ['adults', 'Adults & Seniors']];
  var TAGS = [['brain', 'Brain training'], ['multi', 'Multiplayer']];
  var OPTION_HELP = 'Optional settings for the engine, as JSON. Examples: memory {"set":"animals","big":true} · kidsquiz {"mode":"letters|counting|kidsmath|words"} · slide {"mode":"picture|numbers"} · pairs {"set":"animals|homes"} · wordsearch {"words":{"so":["GEEL","BISAD"],"en":["CAMEL","CAT"]}} · trivia {"questions":[{"q":{"so":"…","en":"…"},"a":[{"so":"right answer","en":"right answer"},{"so":"wrong","en":"wrong"},…]}]} (the first answer is the right one; they are shuffled)';

  function slug(s) { return String(s || '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30); }
  function pill(kind, text) { return h('span', { class: 'chip ' + kind, text: text }); }
  function td(x) { return x instanceof Node ? h('td', null, x) : h('td', { text: x == null ? '—' : String(x) }); }

  function read() {
    var p = C().repo().split('/');
    var q = 'query($o:String!,$n:String!){repository(owner:$o,name:$n){f:object(expression:"main:' + PATH + '"){... on Blob{oid text}}}}';
    return C().gql(q, { o: p[0], n: p[1] }).then(function (d) {
      var o = d.repository.f; if (!o) return { games: [], sha: null, raw: { games: [] } };
      var j = JSON.parse(o.text); return { games: j.games || [], sha: o.oid, raw: j };
    });
  }
  function plays() {
    return W().api('/api/analytics/summary?range=30d').then(function (S) {
      var out = {}; (S.sections || []).forEach(function (x) { var m = /^\/games-([a-z0-9-]+)$/.exec(x.path || ''); if (m) out[m[1]] = (out[m[1]] || 0) + (x.views || 0); else if (x.path === '/games') out._hub = x.views || 0; });
      return out;
    }).catch(function () { return null; });
  }

  V.games = function (el) {
    el.innerHTML = ''; el.append(C().loadingBox());
    Promise.all([read(), plays()]).then(function (r) {
      var D = r[0], P = r[1], list = D.games.slice().sort(function (a, b) { return (a.order || 999) - (b.order || 999); });
      el.innerHTML = '';
      var site = C().site();
      el.append(h('div', { class: 'hero' }, h('div', null, h('h2', { text: 'Games' }), h('p', { text: list.length + ' games in the catalogue, ' + list.filter(function (g) { return g.enabled !== false; }).length + ' shown on ' + site.replace(/^https?:\/\//, '') + 'games/. Saving publishes within 2–5 minutes.' })),
        h('div', { class: 'actions' }, h('button', { class: 'btn primary', type: 'button', html: W().ic('plus') + '<span>New game</span>', onclick: function () { edit(null); } }), h('a', { class: 'btn', href: site + 'games/', target: '_blank', rel: 'noopener', text: 'Open the Games page' }))));
      var tot = 0; if (P) Object.keys(P).forEach(function (k) { if (k !== '_hub') tot += P[k]; });
      el.append(h('div', { class: 'grid kpis' },
        kpi('Games shown', String(list.filter(function (g) { return g.enabled !== false; }).length), list.filter(function (g) { return g.enabled === false; }).length + ' turned off'),
        kpi('Featured', String(list.filter(function (g) { return g.featured; }).length), 'in the big carousel'),
        kpi('Games opened (30 days)', P ? String(tot) : '—', P ? 'from the visitor counter' : 'visitor counter not reachable'),
        kpi('Games page visits (30 days)', P ? String(P._hub || 0) : '—', 'the games homepage')));
      var rows = list.map(function (g, i) {
        var st = g.enabled === false ? pill('', 'Off') : pill('ok', 'Shown');
        return h('tr', null,
          td(h('div', { style: 'display:flex;gap:10px;align-items:center' }, h('span', { style: 'font-size:26px', text: g.icon || '🎮' }), h('div', null, h('b', { text: (g.title && (g.title.en || g.title.so)) || g.id }), h('div', { class: 'sub', text: g.id + ' · ' + g.engine })))),
          td((g.cats || []).map(function (c) { return (CATS.find(function (x) { return x[0] === c; }) || [, c])[1]; }).join(', ')),
          td(h('div', { class: 'row' }, g.featured ? pill('warn', '★ Featured') : null, g.popular ? pill('warn', '🔥 Popular') : null, (g.tags || []).indexOf('brain') >= 0 ? pill('', 'Brain') : null, (g.tags || []).indexOf('multi') >= 0 ? pill('', 'Multi') : null)),
          td(P ? String(P[g.id] || 0) : '—'), td(st),
          td(h('div', { class: 'row' },
            h('button', { class: 'btn small', type: 'button', text: 'Edit', onclick: function () { edit(g); } }),
            h('button', { class: 'btn small ghost', type: 'button', text: '↑', 'aria-label': 'Move up', disabled: i === 0 ? true : null, onclick: function () { move(g, -1); } }),
            h('button', { class: 'btn small ghost', type: 'button', text: '↓', 'aria-label': 'Move down', disabled: i === list.length - 1 ? true : null, onclick: function () { move(g, 1); } }),
            h('button', { class: 'btn small ghost', type: 'button', text: g.enabled === false ? 'Turn on' : 'Turn off', onclick: function () { change(g.id, function (x) { x.enabled = g.enabled === false; }, (g.enabled === false ? 'Game turned on: ' : 'Game turned off: ') + g.id); } }),
            h('button', { class: 'btn small ghost', type: 'button', text: g.featured ? 'Unfeature' : 'Feature', onclick: function () { change(g.id, function (x) { x.featured = !g.featured; }, 'Featured changed: ' + g.id); } }),
            h('button', { class: 'btn small ghost', type: 'button', text: g.popular ? 'Not popular' : 'Popular', onclick: function () { change(g.id, function (x) { x.popular = !g.popular; }, 'Most played changed: ' + g.id); } }),
            h('button', { class: 'btn small danger', type: 'button', text: 'Remove', onclick: function () { if (confirm('Remove the game "' + g.id + '" from the website? Players keep their own saved scores.')) save(D.games.filter(function (x) { return x.id !== g.id; }), 'Game removed: ' + g.id); } }))));
      });
      el.append(W().card('All games', 'The order here is the order on the Games page. Play counts are the last 30 days.', rows.length ? h('div', { class: 'tablewrap big' }, h('table', { class: 'tbl' }, h('thead', null, h('tr', null, ['Game', 'Categories', 'Labels', 'Opened', 'State', ''].map(function (x) { return h('th', { text: x }); }))), h('tbody', null, rows))) : h('div', { class: 'empty', text: 'No game yet. Press “New game”.' })));

      function kpi(l, v, n) { return h('div', { class: 'card kpi' }, h('div', { class: 'lab' }, h('span', { text: l })), h('div', { class: 'val', text: v }), h('div', { class: 'note', text: n })); }
      function save(games, label, extra) {
        games.forEach(function (g, i) { g.order = i + 1; });
        var out = Object.assign({}, D.raw, { games: games });
        var ch = [{ path: PATH, text: JSON.stringify(out, null, 1) + '\n', expect: D.sha }].concat(extra || []);
        return C().commitFiles(ch, 'Maamul: ciyaaraha — ' + label).then(function (c) { C().track(label, c, { url: site + PATH, field: 'games', value: games }, site + 'games/', true); C().toast('Saved. The Games page updates within a few minutes.'); V.games(el); }).catch(function (e) { C().toast(e.message, true); });
      }
      function change(id, fn, label) { var gs = JSON.parse(JSON.stringify(list)); gs.forEach(function (x) { if (x.id === id) fn(x); }); save(gs, label); }
      function move(g, d) { var gs = JSON.parse(JSON.stringify(list)), i = gs.findIndex(function (x) { return x.id === g.id; }), j = i + d; if (j < 0 || j >= gs.length) return; var t = gs[i]; gs[i] = gs[j]; gs[j] = t; save(gs, 'Order changed'); }
      function edit(g) {
        var b = g ? JSON.parse(JSON.stringify(g)) : { id: '', engine: 'memory', icon: '🎮', color: '#037BDC', cats: ['teens'], tags: [], enabled: true, difficulty: 'medium', title: {}, desc: {}, how: {} };
        var tEn = C().inp(b.title.en), tSo = C().inp(b.title.so), dEn = C().area(b.desc.en, 2), dSo = C().area(b.desc.so, 2), hEn = C().area((b.how || {}).en, 2), hSo = C().area((b.how || {}).so, 2);
        var id = C().inp(b.id, { placeholder: 'made from the English title', disabled: g ? true : null }), eng = C().sel(b.engine, ENGINES), icon = C().inp(b.icon, { maxlength: '8' }), color = C().inp(b.color || '#037BDC', { type: 'color' });
        var diff = C().sel(b.difficulty || 'medium', [['easy', 'Easy'], ['medium', 'Medium'], ['hard', 'Hard']]);
        var levels = C().check(b.levels !== false, 'Player can choose Easy / Medium / Hard');
        var cats = h('div', { class: 'chips' }, CATS.map(function (c) { var x = C().check((b.cats || []).indexOf(c[0]) >= 0, c[1]); x.dataset.v = c[0]; return x; }));
        var tags = h('div', { class: 'chips' }, TAGS.map(function (c) { var x = C().check((b.tags || []).indexOf(c[0]) >= 0, c[1]); x.dataset.v = c[0]; return x; }));
        var flags = { enabled: C().check(b.enabled !== false, 'Shown on the website'), featured: C().check(b.featured, '★ Featured'), popular: C().check(b.popular, '🔥 Most played'), isNew: C().check(b.isNew, '✨ Mark as new') };
        var goals = C().inp((b.goals || []).join(', '), { placeholder: 'e.g. 100, 500 (score badges and daily challenge)' });
        var opts = C().area(b.options ? JSON.stringify(b.options) : '', 3);
        var thumb = C().inp(b.thumb, { placeholder: 'img/games/… (optional; the icon is used otherwise)' }), upload = null;
        var thumbBtn = h('button', { class: 'btn small', type: 'button', text: 'Upload picture', onclick: function () {
          C().pickFile(function (f) { toJpeg(f).then(function (bytes) { upload = bytes; thumb.value = 'img/games/' + (slug(id.value || tEn.value) || 'game') + '-' + Date.now().toString(36).slice(-4) + '.jpg'; C().toast('Picture ready. It is uploaded when you save.'); }).catch(function (e) { C().toast(e.message, true); }); });
        } });
        var m = C().modal(g ? 'Edit game' : 'New game', h('div', null,
          h('div', { class: 'two' }, C().field('Title (English)', tEn), C().field('Title (Somali)', tSo)),
          h('div', { class: 'two' }, C().field('Short description (English)', dEn), C().field('Short description (Somali)', dSo)),
          h('div', { class: 'two' }, C().field('How to play (English)', hEn), C().field('How to play (Somali)', hSo)),
          h('div', { class: 'two' }, C().field('Game type', eng, 'The built-in game this card opens.'), C().field('Card id (web address)', id, 'Letters, numbers and dashes. Cannot be changed later.')),
          h('div', { class: 'two' }, C().field('Icon (emoji)', icon), C().field('Card colour', color)),
          C().field('Categories', cats), C().field('Labels', tags),
          h('div', { class: 'two' }, C().field('Difficulty shown on the card', diff), C().field('Difficulty levels', levels)),
          C().field('On the website', h('div', { class: 'chips' }, flags.enabled, flags.featured, flags.popular, flags.isNew)),
          C().field('Score goals', goals), h('div', { class: 'two' }, C().field('Thumbnail', thumb, 'A 16:9 picture works best. You need the right to use it.'), C().field(' ', thumbBtn)),
          C().field('Engine options (advanced)', opts, OPTION_HELP)),
          [h('button', { class: 'btn', type: 'button', text: 'Cancel', onclick: function () { m.remove(); } }), h('button', { class: 'btn primary', type: 'button', text: 'Save and publish', onclick: function () {
            if (!tEn.value.trim() && !tSo.value.trim()) return C().toast('Write the game title.', true);
            var nid = g ? g.id : (slug(id.value) || slug(tEn.value || tSo.value));
            if (!/^[a-z0-9][a-z0-9-]{0,34}$/.test(nid)) return C().toast('The card id must be letters, numbers and dashes (max 35).', true);
            if (!g && D.games.some(function (x) { return x.id === nid; })) return C().toast('A game with the id "' + nid + '" already exists.', true);
            var o = null; if (opts.value.trim()) { try { o = JSON.parse(opts.value); if (!o || typeof o !== 'object' || Array.isArray(o)) throw 0; } catch (e) { return C().toast('Engine options must be a JSON object, like {"set":"animals"}.', true); } }
            var cs = [].filter.call(cats.children, function (c) { return c.firstChild.checked; }).map(function (c) { return c.dataset.v; });
            if (!cs.length) return C().toast('Choose at least one category.', true);
            var tv = thumb.value.trim(); if (tv && !/^(img\/[\w\/.-]+\.(jpe?g|png|webp)|https:\/\/\S+)$/i.test(tv)) return C().toast('The thumbnail must be a path in img/ or an https:// link.', true);
            b.id = nid; b.engine = eng.value; b.icon = icon.value.trim() || '🎮'; b.color = color.value; b.cats = cs; b.difficulty = diff.value;
            b.tags = [].filter.call(tags.children, function (c) { return c.firstChild.checked; }).map(function (c) { return c.dataset.v; });
            b.title = { en: tEn.value.trim(), so: tSo.value.trim() }; b.desc = { en: dEn.value.trim(), so: dSo.value.trim() }; b.how = { en: hEn.value.trim(), so: hSo.value.trim() };
            ['title', 'desc', 'how'].forEach(function (k) { if (!b[k].en) delete b[k].en; if (!b[k].so) delete b[k].so; });
            Object.keys(flags).forEach(function (k) { b[k] = flags[k].firstChild.checked; });
            if (levels.firstChild.checked) delete b.levels; else b.levels = false;
            var gl = goals.value.split(/[,\s]+/).map(Number).filter(function (x) { return x > 0; }); if (gl.length) b.goals = gl; else delete b.goals;
            if (o) b.options = o; else delete b.options;
            if (tv) b.thumb = tv; else delete b.thumb;
            if (!g) b.added = new Date().toISOString().slice(0, 10);
            var gs = JSON.parse(JSON.stringify(list)); if (g) gs = gs.map(function (x) { return x.id === g.id ? b : x; }); else gs.push(b);
            m.remove(); save(gs, (g ? 'Game updated: ' : 'Game added: ') + nid, upload && tv ? [{ path: tv, bytes: upload, expect: null }] : null);
          } })]);
      }
    }).catch(function (e) { C().failBox(el, e, function () { V.games(el); }); });
  };

  // the uploaded picture is resized to 640×360 (16:9, centre crop) and saved as JPEG
  function toJpeg(file) {
    return new Promise(function (res, rej) {
      if (file.size > 25e6) return rej(new Error('This file is too large (over 25 MB).'));
      var url = URL.createObjectURL(file), img = new Image();
      img.onload = function () {
        var cv = document.createElement('canvas'); cv.width = 640; cv.height = 360; var x = cv.getContext('2d');
        var s = Math.max(640 / img.width, 360 / img.height), w = img.width * s, hh = img.height * s;
        x.fillStyle = '#fff'; x.fillRect(0, 0, 640, 360); x.drawImage(img, (640 - w) / 2, (360 - hh) / 2, w, hh); URL.revokeObjectURL(url);
        cv.toBlob(function (bl) { if (!bl) return rej(new Error('The picture could not be read.')); bl.arrayBuffer().then(function (ab) { res(new Uint8Array(ab)); }); }, 'image/jpeg', 0.85);
      };
      img.onerror = function () { URL.revokeObjectURL(url); rej(new Error('This file is not a picture the browser can read.')); };
      img.src = url;
    });
  }
})();
