/* Crossword: a new small crossword is built every game from a list of words and clues (Somali or English).
   Tap a square, type the letters (or use the on-screen keyboard). Check, reveal a letter, large readable text.
   Original implementation; the admin can add a custom list (options.entries). */
WTG.register('crossword', function (api) {
  var h = api.h;
  var ENTRIES = {
    so: [['GEEL', 'Xayawaan leh kurus oo lamadegaanka u adkeysta'], ['LIBAAX', 'Boqorka duurka'], ['BADDA', 'Biyo milix ah oo aad u waaweyn'], ['WEBI', 'Shabeelle iyo Jubba waa …'], ['DAYAX', 'Habeenkii ayuu samada ka iftiimaa'], ['QORRAX', 'Maalintii ayay iftiin iyo kulayl bixisaa'], ['BUUG', 'Waa la akhriyaa, bogag ayuu leeyahay'], ['DUGSI', 'Halka carruurtu wax ku bartaan'], ['MACALIN', 'Qofka fasalka wax ku dhiga'], ['ROOTI', 'Cunto laga sameeyo bur'], ['CAANO', 'Cabitaan cad oo geela iyo lo\'da laga helo'], ['BIYO', 'Waxa aan cabno marka aan harraadno'], ['ROOB', 'Biyaha cirka ka da\'a'], ['XIDDIG', 'Calanka Soomaaliya ayay dhexda uga taal'], ['MUQDISHO', 'Caasimadda Soomaaliya'], ['AFRIKA', 'Qaaradda ay Soomaaliya ku taal'], ['BULUUG', 'Midabka calanka Soomaaliya'], ['SHAN', 'Tirada geesaha xiddigta calanka'], ['KUBAD', 'Waa la laadaa ciyaarta kubadda cagta'], ['GOOL', 'Marka kubaddu shabagga gasho'], ['HOOYO', 'Waalidka dumarka ah'], ['AABBE', 'Waalidka ragga ah'], ['GURI', 'Meesha qoysku ku nool yahay'], ['MOOS', 'Miro jaalle ah oo dhaadheer'], ['QALIN', 'Waxa lagu qoro'], ['SHIMBIR', 'Xayawaan baal leh oo duula'], ['KALLUUN', 'Biyaha ayuu ku nool yahay, wuu dabaashaa'], ['TOBAN', 'Shan iyo shan'], ['SADDEX', 'Laba iyo hal'], ['MALAB', 'Waxa macaan ee shinnidu samayso']],
    en: [['CAMEL', 'Desert animal with a hump'], ['LION', 'King of the jungle'], ['OCEAN', 'A very large body of salt water'], ['RIVER', 'The Nile is the longest one in Africa'], ['MOON', 'It shines in the night sky'], ['SUN', 'Our nearest star'], ['BOOK', 'You read it page by page'], ['SCHOOL', 'Where children learn'], ['TEACHER', 'Person who teaches a class'], ['BREAD', 'Baked food made from flour'], ['MILK', 'White drink from cows and camels'], ['WATER', 'We drink it when we are thirsty'], ['RAIN', 'Water falling from clouds'], ['STAR', 'There is a white one on the flag of Somalia'], ['MOGADISHU', 'Capital city of Somalia'], ['AFRICA', 'The continent where Somalia is'], ['BLUE', 'Colour of the flag of Somalia'], ['FIVE', 'Number of points on a star like the one on the flag'], ['GOAL', 'When the ball goes into the net'], ['CHESS', 'Board game with kings, queens and knights'], ['PLANET', 'Earth or Mars'], ['APPLE', 'Red or green fruit'], ['BANANA', 'Long yellow fruit'], ['HONEY', 'Sweet food made by bees'], ['EAGLE', 'Large bird with sharp eyes'], ['CLOCK', 'It tells the time'], ['WINTER', 'The coldest season in Europe'], ['ISLAND', 'Land with water all around it'], ['DOCTOR', 'Person who helps sick people'], ['SEVEN', 'Days in a week']]
  };
  var NW = api.cfg('n', { easy: 6, medium: 9, hard: 12 }[api.level]);
  var css = h('style', { text: '.cw{display:flex;gap:16px;align-items:flex-start;justify-content:center;width:100%;height:100%;flex-wrap:wrap;overflow:auto}.cw .g{display:grid;gap:2px;background:#04213f;padding:2px;border-radius:8px;width:var(--gs);height:var(--gsh)}.cw .g i{background:transparent}.cw .g button{position:relative;border:0;background:#fff;font:800 calc(var(--cell) * .55)/1 Archivo,sans-serif;color:#0b1c33;cursor:pointer;padding:0;border-radius:3px}.cw .g button small{position:absolute;left:2px;top:1px;font-size:calc(var(--cell) * .26);color:#475569}.cw .g button.on{background:#cfe3f8}.cw .g button.cur{background:#ffd166}.cw .g button.ok{color:#16a34a}.cw .g button.bad{color:#dc2626}.cw .clues{flex:1 1 260px;max-width:420px;background:rgba(255,255,255,.08);border-radius:14px;padding:10px 14px;font-size:16px}.cw .clues h4{margin:6px 0;color:#ffd166}.cw .clues p{margin:4px 0;cursor:pointer;border-radius:6px;padding:3px 6px}.cw .clues p.on{background:rgba(255,209,102,.25)}.cw .clues p.done{opacity:.5;text-decoration:line-through}.cw .kb{display:flex;flex-wrap:wrap;gap:4px;justify-content:center;max-width:520px}.cw .kb button{min-width:34px;padding:8px 6px;font-size:16px}.cw .side{display:flex;flex-direction:column;gap:10px;align-items:center}' });
  var cells, words, W0, H0, sel = null, dir = 'a', inputs = {}, root, btns = {}, clueEls = [];
  function list() { var c = api.opts.entries; var L = api.lang === 'so' ? 'so' : 'en'; if (c && (c[L] || c.en)) return (c[L] || c.en).map(function (e) { return [String(e[0]).toUpperCase().replace(/[^A-Z]/g, ''), e[1]]; }); return ENTRIES[L]; }
  function layout() {
    var best = null;
    for (var attempt = 0; attempt < 30; attempt++) {
      var pool = api.shuffle(list()).slice(0, NW * 2), grid = {}, placed = [];
      function get(r, c) { return grid[r + ',' + c]; }
      function canPlace(w, r, c, d) {
        var dr = d === 'd' ? 1 : 0, dc = d === 'a' ? 1 : 0, cross = 0;
        if (get(r - dr, c - dc) || get(r + dr * w.length, c + dc * w.length)) return -1;
        for (var i = 0; i < w.length; i++) {
          var rr = r + dr * i, cc = c + dc * i, g = get(rr, cc);
          if (g) { if (g !== w[i]) return -1; cross++; }
          else if (get(rr + dc, cc + dr) || get(rr - dc, cc - dr)) return -1;
        }
        return cross;
      }
      var first = pool[0]; placed.push({ w: first[0], clue: first[1], r: 0, c: 0, d: 'a' }); for (var i = 0; i < first[0].length; i++) grid['0,' + i] = first[0][i];
      for (var k = 1; k < pool.length && placed.length < NW; k++) {
        var w = pool[k][0], opts = [];
        placed.forEach(function (p) { for (var i = 0; i < p.w.length; i++) for (var j = 0; j < w.length; j++) if (p.w[i] === w[j]) { var d = p.d === 'a' ? 'd' : 'a', r = p.d === 'a' ? p.r - j : p.r + i, c = p.d === 'a' ? p.c + i : p.c - j, x = canPlace(w, r, c, d); if (x > 0) opts.push({ r: r, c: c, d: d, x: x }); } });
        if (!opts.length) continue;
        var o = api.pick(opts); placed.push({ w: w, clue: pool[k][1], r: o.r, c: o.c, d: o.d });
        for (i = 0; i < w.length; i++) grid[(o.r + (o.d === 'd' ? i : 0)) + ',' + (o.c + (o.d === 'a' ? i : 0))] = w[i];
      }
      if (!best || placed.length > best.placed.length) best = { placed: placed, grid: grid };
      if (placed.length >= NW) break;
    }
    var minR = 1e9, minC = 1e9, maxR = -1e9, maxC = -1e9;
    Object.keys(best.grid).forEach(function (k) { var p = k.split(',').map(Number); minR = Math.min(minR, p[0]); maxR = Math.max(maxR, p[0]); minC = Math.min(minC, p[1]); maxC = Math.max(maxC, p[1]); });
    H0 = maxR - minR + 1; W0 = maxC - minC + 1; cells = {};
    Object.keys(best.grid).forEach(function (k) { var p = k.split(',').map(Number); cells[(p[0] - minR) + ',' + (p[1] - minC)] = { ch: best.grid[k], words: [] }; });
    words = best.placed.map(function (p) { return { w: p.w, clue: p.clue, r: p.r - minR, c: p.c - minC, d: p.d }; });
    words.sort(function (a, b) { return a.r - b.r || a.c - b.c; });
    var num = 0, nums = {};
    words.forEach(function (wd, i) { var k = wd.r + ',' + wd.c; if (!nums[k]) nums[k] = ++num; wd.n = nums[k]; wd.i = i; for (var q = 0; q < wd.w.length; q++) cells[(wd.r + (wd.d === 'd' ? q : 0)) + ',' + (wd.c + (wd.d === 'a' ? q : 0))].words.push(i); });
    Object.keys(nums).forEach(function (k) { cells[k].n = nums[k]; });
  }
  function keysOf(wd) { var a = []; for (var q = 0; q < wd.w.length; q++) a.push((wd.r + (wd.d === 'd' ? q : 0)) + ',' + (wd.c + (wd.d === 'a' ? q : 0))); return a; }
  function activeWord() { if (!sel) return null; var ws = cells[sel].words.map(function (i) { return words[i]; }); return ws.filter(function (w) { return w.d === dir; })[0] || ws[0]; }
  function render() {
    api.el.innerHTML = '';
    var cell = 'min(calc((var(--w) - 40px) / ' + W0 + '), calc((var(--h) - 200px) / ' + H0 + '), 52px)';
    if (W0 > 0 && innerWidth > 900) cell = 'min(calc((var(--w) - 500px) / ' + W0 + '), calc((var(--h) - 120px) / ' + H0 + '), 56px)';
    root = h('div', { class: 'cw', style: { '--cell': cell, '--gs': 'calc(' + cell + ' * ' + W0 + ' + ' + (W0 + 1) * 2 + 'px)', '--gsh': 'calc(' + cell + ' * ' + H0 + ' + ' + (H0 + 1) * 2 + 'px)' } });
    var G = h('div', { class: 'g', style: { gridTemplateColumns: 'repeat(' + W0 + ',1fr)', gridTemplateRows: 'repeat(' + H0 + ',1fr)' } });
    btns = {};
    for (var r = 0; r < H0; r++) for (var c = 0; c < W0; c++) { var k = r + ',' + c; if (!cells[k]) { G.append(h('i')); continue; } (function (k) { var b = h('button', { type: 'button', 'aria-label': 'square', onclick: function () { if (sel === k) dir = dir === 'a' ? 'd' : 'a'; sel = k; var ws = cells[k].words.map(function (i) { return words[i].d; }); if (ws.indexOf(dir) < 0) dir = ws[0]; paint(); } }); if (cells[k].n) b.append(h('small', { text: String(cells[k].n) })); b.append(h('span')); btns[k] = b; G.append(b); })(k); }
    var cl = h('div', { class: 'clues' }); clueEls = [];
    [['a', { so: 'Jiifta →', en: 'Across →' }], ['d', { so: 'Taagan ↓', en: 'Down ↓' }]].forEach(function (D) {
      cl.append(h('h4', { text: api.t(D[1]) }));
      words.filter(function (w) { return w.d === D[0]; }).forEach(function (w) { var p = h('p', { text: w.n + '. ' + w.clue + ' (' + w.w.length + ')', onclick: function () { sel = keysOf(w)[0]; dir = w.d; paint(); } }); clueEls[w.i] = p; cl.append(p); });
    });
    var kb = h('div', { class: 'kb' }); (api.lang === 'so' ? 'ABCDEFGHIJKLMNOQRSTUWXY' : 'ABCDEFGHIJKLMNOPQRSTUVWXYZ').split('').forEach(function (ch) { kb.append(h('button', { type: 'button', class: 'g-btn sm', text: ch, onclick: function () { type(ch); } })); });
    kb.append(h('button', { type: 'button', class: 'g-btn sm', text: '⌫', onclick: function () { back(); } }));
    var tools = h('div', { class: 'g-row' }, h('button', { type: 'button', class: 'g-btn sm blue', text: '✓ ' + api.t({ so: 'Hubi', en: 'Check' }), onclick: check }), h('button', { type: 'button', class: 'g-btn sm', text: '💡 ' + api.t({ so: 'Xaraf', en: 'Reveal letter' }), onclick: reveal }));
    root.append(h('div', { class: 'side' }, G, tools, kb), cl); api.el.append(css, root);
    paint();
  }
  function paint() {
    var aw = activeWord(), on = aw ? keysOf(aw) : [];
    Object.keys(btns).forEach(function (k) { var b = btns[k]; b.classList.toggle('cur', k === sel); b.classList.toggle('on', on.indexOf(k) >= 0 && k !== sel); b.lastChild.textContent = inputs[k] || ''; });
    words.forEach(function (w) { if (clueEls[w.i]) { clueEls[w.i].classList.toggle('on', aw === w); clueEls[w.i].classList.toggle('done', keysOf(w).every(function (k) { return inputs[k] === cells[k].ch; })); } });
  }
  function type(ch) {
    if (api.paused || !sel) return; inputs[sel] = ch; btns[sel].classList.remove('bad', 'ok'); api.sfx('tick');
    var aw = activeWord(), ks = keysOf(aw), i = ks.indexOf(sel); if (i < ks.length - 1) sel = ks[i + 1];
    paint(); maybeDone();
  }
  function back() { if (!sel) return; var aw = activeWord(), ks = keysOf(aw), i = ks.indexOf(sel); if (!inputs[sel] && i > 0) sel = ks[i - 1]; inputs[sel] = ''; paint(); }
  var reveals = 0, checks = 0;
  function check() { checks++; Object.keys(btns).forEach(function (k) { if (inputs[k]) { btns[k].classList.toggle('ok', inputs[k] === cells[k].ch); btns[k].classList.toggle('bad', inputs[k] !== cells[k].ch); } }); api.sfx('pop'); }
  function reveal() { if (!sel) { var e = Object.keys(btns).filter(function (k) { return inputs[k] !== cells[k].ch; }); if (!e.length) return; sel = e[0]; } inputs[sel] = cells[sel].ch; reveals++; btns[sel].classList.add('ok'); paint(); maybeDone(); }
  function maybeDone() {
    if (Object.keys(btns).some(function (k) { return inputs[k] !== cells[k].ch; })) return;
    var secs = Math.round((Date.now() - t0) / 1000), sc = Math.max(50, words.length * 60 - reveals * 30 - Math.floor(secs / 10));
    if (!reveals) api.achieve('clean', { so: 'Caawin la\'aan', en: 'Solved without reveals' });
    api.win(sc, { so: words.length + ' erey · ' + WTG.fmtTime(secs), en: words.length + ' words · ' + WTG.fmtTime(secs) });
  }
  var t0, pAt = 0;
  return {
    start: function () { layout(); inputs = {}; sel = null; reveals = 0; checks = 0; t0 = Date.now(); render(); },
    pause: function () { pAt = Date.now(); }, resume: function () { if (pAt) t0 += Date.now() - pAt; pAt = 0; },
    key: function (e, down) {
      if (!down) return; var k = e.key;
      if (/^[a-zA-Z]$/.test(k)) { e.preventDefault(); type(k.toUpperCase()); }
      else if (k === 'Backspace') { e.preventDefault(); back(); }
      else if (/^Arrow/.test(k) && sel) { e.preventDefault(); var p = sel.split(',').map(Number), d = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] }[k]; var nk = (p[0] + d[0]) + ',' + (p[1] + d[1]); if (cells[nk]) { sel = nk; dir = d[0] ? 'd' : 'a'; if (cells[nk].words.map(function (i) { return words[i].d; }).indexOf(dir) < 0) dir = words[cells[nk].words[0]].d; paint(); } }
    }
  };
});
