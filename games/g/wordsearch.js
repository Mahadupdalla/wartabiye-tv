/* Word Search: find the hidden words. Drag across the letters (or tap the first and the last letter).
   Somali or English word lists by theme; the admin can add a custom list (options.words). Original implementation. */
WTG.register('wordsearch', function (api) {
  var h = api.h;
  var LISTS = {
    so: {
      'Xayawaanka': ['LIBAAX', 'GEEL', 'BISAD', 'FARAS', 'MAROODI', 'SHIMBIR', 'KALLUUN', 'YAXAAS', 'DAMEER', 'JIIR', 'WEYL', 'ORGI'],
      'Guriga iyo dugsiga': ['QALIN', 'BUUG', 'MIIS', 'KURSI', 'ALBAAB', 'DAAQAD', 'GURI', 'DUGSI', 'MACALIN', 'FASAL', 'SAACAD', 'SARIIR'],
      'Dabeecadda': ['ROOB', 'DAYAX', 'QORRAX', 'XIDDIG', 'WEBI', 'BUUR', 'BADDA', 'DHIR', 'DHAGAX', 'CIID', 'CIR', 'DABAYL'],
      'Cuntada': ['MOOS', 'TUFAAX', 'CANAB', 'CAMBE', 'LIIN', 'ROOTI', 'CAANO', 'BARIIS', 'HILIB', 'MALAB', 'BIYO', 'SONKOR']
    },
    en: {
      'Animals': ['CAMEL', 'LION', 'ZEBRA', 'GIRAFFE', 'ELEPHANT', 'TIGER', 'MONKEY', 'RABBIT', 'TURTLE', 'EAGLE', 'DOLPHIN', 'HORSE'],
      'Sports': ['FOOTBALL', 'TENNIS', 'GOAL', 'RUNNING', 'SWIMMING', 'BOXING', 'CHESS', 'CYCLING', 'KARATE', 'HOCKEY', 'RUGBY', 'GOLF'],
      'Space': ['PLANET', 'MOON', 'STAR', 'ROCKET', 'COMET', 'GALAXY', 'ORBIT', 'EARTH', 'MARS', 'SATURN', 'SUN', 'ASTRONAUT'],
      'Food': ['BANANA', 'APPLE', 'MANGO', 'BREAD', 'RICE', 'HONEY', 'ORANGE', 'GRAPES', 'CARROT', 'TOMATO', 'LEMON', 'PASTA']
    }
  };
  var conf = { easy: { n: 9, w: 6, dirs: [[0, 1], [1, 0]] }, medium: { n: 11, w: 8, dirs: [[0, 1], [1, 0], [1, 1], [-1, 1]] }, hard: { n: 13, w: 10, dirs: [[0, 1], [1, 0], [1, 1], [-1, 1], [0, -1], [-1, 0], [-1, -1], [1, -1]] } }[api.level];
  var css = h('style', { text: '.ws{--s:min(calc(var(--w) - 24px),calc(var(--h) - 170px),600px);display:flex;flex-direction:column;align-items:center;gap:10px}.ws .g{display:grid;width:var(--s);height:var(--s);background:#fff;border-radius:14px;padding:6px;touch-action:none;box-shadow:0 14px 34px rgba(0,0,0,.35);user-select:none}.ws .g span{display:grid;place-items:center;font:800 calc(var(--s) / var(--n) * .52)/1 Archivo,sans-serif;color:#0b1c33;border-radius:8px;cursor:pointer}.ws .g span.cur{background:#ffd166}.ws .g span.f{color:#fff}.ws .list{display:flex;flex-wrap:wrap;gap:6px;justify-content:center;max-width:var(--s)}.ws .list b{background:rgba(255,255,255,.12);border-radius:8px;padding:4px 9px;font-size:15px;letter-spacing:.04em}.ws .list b.ok{text-decoration:line-through;opacity:.55;background:#16a34a}.ws .th{font-weight:800;color:#ffd166}' });
  var COLORS = ['#037BDC', '#16a34a', '#a855f7', '#f97316', '#e11d48', '#0891b2', '#ca8a04', '#4f46e5', '#db2777', '#059669'];
  var grid, words, found, cellsEl, root, listEl, startCell = null, curPath = [], tapFirst = null, t0, timer;
  function lang() { return api.lang === 'so' ? 'so' : 'en'; }
  function pickWords() {
    var custom = api.opts.words && api.opts.words[lang()] || api.opts.words && api.opts.words.en;
    if (custom && custom.length) return { theme: api.t(api.opts.theme) || '', words: api.shuffle(custom.map(function (w) { return String(w).toUpperCase().replace(/[^A-Z]/g, ''); }).filter(function (w) { return w.length >= 2 && w.length <= conf.n; })).slice(0, conf.w) };
    var L = LISTS[lang()], themes = Object.keys(L), th = api.pick(themes);
    return { theme: th, words: api.shuffle(L[th].filter(function (w) { return w.length <= conf.n; })).slice(0, conf.w) };
  }
  function build() {
    for (var tries = 0; tries < 50; tries++) {
      var n = conf.n, g = [], ok = true, P = pickWords(), placed = [];
      for (var i = 0; i < n * n; i++) g.push('');
      P.words.sort(function (a, b) { return b.length - a.length; });
      for (var w = 0; w < P.words.length && ok; w++) {
        var word = P.words[w], done = false;
        for (var k = 0; k < 200 && !done; k++) {
          var d = api.pick(conf.dirs), r = api.rand(0, n - 1), c = api.rand(0, n - 1), er = r + d[0] * (word.length - 1), ec = c + d[1] * (word.length - 1);
          if (er < 0 || er >= n || ec < 0 || ec >= n) continue;
          var fit = true; for (var q = 0; q < word.length; q++) { var ch = g[(r + d[0] * q) * n + c + d[1] * q]; if (ch && ch !== word[q]) { fit = false; break; } }
          if (!fit) continue;
          var path = []; for (q = 0; q < word.length; q++) { var idx = (r + d[0] * q) * n + c + d[1] * q; g[idx] = word[q]; path.push(idx); }
          placed.push({ w: word, path: path }); done = true;
        }
        if (!done) ok = false;
      }
      if (!ok) continue;
      var AL = lang() === 'so' ? 'ABCDEFGHIJKLMNOQRSTUWXY' : 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
      for (i = 0; i < n * n; i++) if (!g[i]) g[i] = AL[api.rand(0, AL.length - 1)];
      return { g: g, words: placed, theme: P.theme };
    }
  }
  function render(B) {
    api.el.innerHTML = ''; root = h('div', { class: 'ws' });
    var G = h('div', { class: 'g', style: { gridTemplateColumns: 'repeat(' + conf.n + ',1fr)', '--n': conf.n } }); cellsEl = [];
    B.g.forEach(function (ch, i) { var s = h('span', { 'data-i': i, text: ch }); cellsEl.push(s); G.append(s); });
    listEl = h('div', { class: 'list' }); B.words.forEach(function (w) { listEl.append(h('b', { 'data-w': w.w, text: w.w })); });
    root.append(h('div', { class: 'th', text: '📚 ' + B.theme }), G, listEl); api.el.append(css, root);
    G.addEventListener('pointerdown', function (e) { var c = cellOf(e); if (c < 0 || api.paused) return; e.preventDefault(); G.setPointerCapture(e.pointerId); startCell = c; curPath = [c]; paint(); });
    G.addEventListener('pointermove', function (e) { if (startCell == null) return; var c = cellOf(e); if (c < 0) return; curPath = line(startCell, c); paint(); });
    G.addEventListener('pointerup', function (e) {
      if (startCell == null) return; var c = cellOf(e); if (c < 0) c = curPath[curPath.length - 1];
      if (c === startCell) { // tap mode: first tap then last tap
        if (tapFirst != null && tapFirst !== c) { curPath = line(tapFirst, c); tapFirst = null; finish(); } else { tapFirst = c; curPath = [c]; paint(); api.sfx('tap'); }
      } else { tapFirst = null; finish(); }
      startCell = null;
    });
  }
  function cellOf(e) { var el = document.elementFromPoint(e.clientX, e.clientY); return el && el.dataset && el.dataset.i != null ? +el.dataset.i : -1; }
  function line(a, b) { var n = conf.n, ar = Math.floor(a / n), ac = a % n, br = Math.floor(b / n), bc = b % n, dr = Math.sign(br - ar), dc = Math.sign(bc - ac), len = Math.max(Math.abs(br - ar), Math.abs(bc - ac)); if (!(ar === br || ac === bc || Math.abs(br - ar) === Math.abs(bc - ac))) return [a]; var p = []; for (var k = 0; k <= len; k++) p.push((ar + dr * k) * n + ac + dc * k); return p; }
  function paint() { cellsEl.forEach(function (s, i) { s.classList.toggle('cur', curPath.indexOf(i) >= 0); }); }
  function finish() {
    var hit = words.filter(function (w) { if (found[w.w]) return false; var p = w.path; return p.length === curPath.length && (p.every(function (x, i) { return x === curPath[i]; }) || p.every(function (x, i) { return x === curPath[curPath.length - 1 - i]; })); })[0];
    if (hit) {
      found[hit.w] = true; var col = COLORS[Object.keys(found).length % COLORS.length];
      hit.path.forEach(function (i) { cellsEl[i].classList.add('f'); cellsEl[i].style.background = col; });
      listEl.querySelector('[data-w="' + hit.w + '"]').classList.add('ok'); api.add(hit.w.length * 10); api.sfx('good');
      if (Object.keys(found).length === words.length) { clearInterval(timer); var secs = Math.round((Date.now() - t0) / 1000); api.win(api.score + Math.max(0, 300 - secs), { so: 'Waqtiga: ' + WTG.fmtTime(secs), en: 'Time: ' + WTG.fmtTime(secs) }); }
    } else if (curPath.length > 1) api.sfx('bad');
    curPath = []; paint();
  }
  var pausedFor = 0, pAt = 0;
  return {
    start: function () { var B = build(); words = B.words; found = {}; render(B); t0 = Date.now(); clearInterval(timer); timer = setInterval(function () { if (!api.paused) api.info('⏱', WTG.fmtTime((Date.now() - t0) / 1000)); }, 1000); api.info('⏱', '0:00'); },
    pause: function () { pAt = Date.now(); }, resume: function () { if (pAt) t0 += Date.now() - pAt; pAt = 0; },
    destroy: function () { clearInterval(timer); }
  };
});
