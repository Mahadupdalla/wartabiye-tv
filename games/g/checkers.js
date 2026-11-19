/* Checkers (draughts, 8×8): captures are compulsory, multi-jumps continue, reaching the far row makes a king.
   Against the computer or a second player on the same device. Original implementation. */
WTG.register('checkers', function (api) {
  var h = api.h;
  var TX = { so: { you: 'Adiga (casaan)', cpu: 'Kombiyuutar (caddaan)', red: 'Casaan', white: 'Caddaan', turn: '{c} ayaa ciyaaraya', must: 'Waa qasab inaad cunto!', win: '{c} ayaa guuleystay', cpuB: '🤖 Kombiyuutar', two: '👥 2 qof', undo: '↶ Dib u celi', think: 'Kombiyuutarku wuu fikirayaa…' },
    en: { you: 'You (red)', cpu: 'Computer (white)', red: 'Red', white: 'White', turn: '{c} to move', must: 'You must capture!', win: '{c} wins', cpuB: '🤖 vs computer', two: '👥 2 players', undo: '↶ Undo', think: 'Computer is thinking…' } };
  function tx(k, c) { var s = (TX[api.lang] || TX.en)[k] || TX.en[k]; return c ? s.replace('{c}', c) : s; }
  // board: 0 empty, 1 red man, 2 red king, -1 white man, -2 white king. Red (player) starts at the bottom and moves up.
  var B, turn, sel, chain, hist, busy, over, mode = api.load('mode', 'cpu');
  function init() { B = []; for (var r = 0; r < 8; r++) for (var c = 0; c < 8; c++) B.push((r + c) % 2 ? (r < 3 ? -1 : r > 4 ? 1 : 0) : 0); turn = 1; sel = -1; chain = -1; hist = []; busy = false; over = false; }
  function side(v) { return v > 0 ? 1 : v < 0 ? -1 : 0; }
  function movesFrom(b, i, onlyJumps) {
    var v = b[i], s = side(v), r = i >> 3, c = i & 7, out = [], dirs = Math.abs(v) === 2 ? [[-1, -1], [-1, 1], [1, -1], [1, 1]] : s === 1 ? [[-1, -1], [-1, 1]] : [[1, -1], [1, 1]];
    dirs.forEach(function (d) {
      var r1 = r + d[0], c1 = c + d[1], r2 = r + 2 * d[0], c2 = c + 2 * d[1];
      if (r1 < 0 || r1 > 7 || c1 < 0 || c1 > 7) return;
      var t = r1 * 8 + c1;
      if (!b[t]) { if (!onlyJumps) out.push({ f: i, t: t }); }
      else if (side(b[t]) === -s && r2 >= 0 && r2 < 8 && c2 >= 0 && c2 < 8 && !b[r2 * 8 + c2]) out.push({ f: i, t: r2 * 8 + c2, cap: t });
    });
    return out;
  }
  function allMoves(b, s) {
    var j = [], m = [];
    for (var i = 0; i < 64; i++) if (side(b[i]) === s) movesFrom(b, i).forEach(function (x) { (x.cap != null ? j : m).push(x); });
    return j.length ? j : m;
  }
  function apply(b, m) {
    var n = b.slice(), v = n[m.f]; n[m.f] = 0; n[m.t] = v; if (m.cap != null) n[m.cap] = 0;
    var r = m.t >> 3, crowned = false; if (v === 1 && r === 0) { n[m.t] = 2; crowned = true; } if (v === -1 && r === 7) { n[m.t] = -2; crowned = true; }
    return { b: n, crowned: crowned };
  }
  // a full turn for the AI: a move plus any jumps that must follow
  function sequences(b, s) {
    var res = [];
    allMoves(b, s).forEach(function (m) { walk(b, m, [m]); });
    function walk(bb, m, path) {
      var a = apply(bb, m);
      if (m.cap != null && !a.crowned) { var more = movesFrom(a.b, m.t, true); if (more.length) { more.forEach(function (x) { walk(a.b, x, path.concat([x])); }); return; } }
      res.push({ path: path, b: a.b });
    }
    return res;
  }
  function score(b) { var v = 0; for (var i = 0; i < 64; i++) { var p = b[i]; if (!p) continue; var r = i >> 3; v += (Math.abs(p) === 2 ? 175 : 100 + (p > 0 ? 7 - r : r) * 4) * side(p); } return v; }
  function negamax(b, s, d, a, bb) {
    var seqs = sequences(b, s); if (!seqs.length) return -10000 - d;
    if (d === 0) return score(b) * s;
    for (var i = 0; i < seqs.length; i++) { var v = -negamax(seqs[i].b, -s, d - 1, -bb, -a); if (v >= bb) return bb; if (v > a) a = v; }
    return a;
  }
  function aiPick(s) {
    var seqs = api.shuffle(sequences(B, s)); if (!seqs.length) return null;
    var depth = { easy: 1, medium: 4, hard: 6 }[api.level], best = seqs[0], bv = -1e9;
    if (api.level === 'easy' && Math.random() < 0.35) return seqs[0];
    seqs.forEach(function (q) { var v = -negamax(q.b, -s, depth - 1, -1e9, -bv); if (v > bv) { bv = v; best = q; } });
    return best;
  }

  var bd = h('div', { class: 'bd', role: 'grid', 'aria-label': 'Checkers board' }), sq = [];
  for (var i = 0; i < 64; i++) (function (i) { var b = h('button', { type: 'button', class: ((i >> 3) + (i & 7)) % 2 ? 'd' : 'l', onclick: function () { tap(i); } }); sq.push(b); bd.append(b); })(i);
  var st = h('div', { class: 'bd-st', 'aria-live': 'polite' });
  var bar = h('div', { class: 'bd-bar' },
    h('button', { type: 'button', class: 'g-btn sm' + (mode === 'cpu' ? ' blue' : ''), text: tx('cpuB'), onclick: function () { setMode('cpu'); } }),
    h('button', { type: 'button', class: 'g-btn sm' + (mode === 'two' ? ' blue' : ''), text: tx('two'), onclick: function () { setMode('two'); } }),
    h('button', { type: 'button', class: 'g-btn sm', text: tx('undo'), onclick: undo }));
  api.el.append(h('div', { class: 'bd-wrap' }, st, bd, bar));
  function setMode(m) { if (busy) return; mode = m; api.save('mode', m); bar.children[0].classList.toggle('blue', m === 'cpu'); bar.children[1].classList.toggle('blue', m === 'two'); init(); draw(); }
  function nm(s) { return s === 1 ? tx('red') : tx('white'); }
  function legalNow() { if (chain >= 0) return movesFrom(B, chain, true); return allMoves(B, turn); }
  function draw() {
    var L = legalNow(), from = {}, to = {};
    L.forEach(function (m) { from[m.f] = 1; if (m.f === sel) to[m.t] = m; });
    for (var i = 0; i < 64; i++) {
      var b = sq[i], v = B[i]; b.className = ((i >> 3) + (i & 7)) % 2 ? 'd' : 'l'; b.innerHTML = '';
      if (i === sel) b.classList.add('sel'); if (to[i]) b.classList.add('can');
      if (v) b.append(h('span', { class: 'ck ' + (v > 0 ? 'r' : 'w') + (Math.abs(v) === 2 ? ' k' : '') }));
      b.setAttribute('aria-label', (v ? (v > 0 ? 'red' : 'white') + (Math.abs(v) === 2 ? ' king' : '') : 'empty') + (from[i] && !busy ? ', can move' : ''));
    }
    if (!over) st.textContent = busy ? tx('think') : tx('turn', nm(turn)) + (L.length && L[0].cap != null ? ' · ' + tx('must') : '');
  }
  function tap(i) {
    if (api.paused || busy || over) return;
    if (mode === 'cpu' && turn !== 1) return;
    var L = legalNow(), m = L.filter(function (x) { return x.f === sel && x.t === i; })[0];
    if (m) return doMove(m);
    if (chain < 0 && L.some(function (x) { return x.f === i; })) { sel = i; api.sfx('tap'); } else if (chain < 0) sel = -1;
    draw();
  }
  function doMove(m) {
    if (chain < 0) hist.push({ B: B.slice(), turn: turn });
    var a = apply(B, m); B = a.b; api.sfx(m.cap != null ? 'hit' : 'move');
    if (a.crowned) { api.sfx('good'); if (turn === 1) api.achieve('king', { so: 'Boqor (king)', en: 'Got a king' }); }
    if (m.cap != null && !a.crowned && movesFrom(B, m.t, true).length) { chain = m.t; sel = m.t; draw(); return; }
    chain = -1; sel = -1; turn = -turn; draw();
    if (end()) return;
    if (mode === 'cpu' && turn === -1) cpu();
  }
  function cpu() {
    busy = true; draw();
    setTimeout(function () {
      if (over || api.isOver()) return;
      var q = aiPick(-1); if (!q) { busy = false; end(); return; }
      var k = 0;
      (function step() {
        if (api.isOver()) return;
        var m = q.path[k++]; var a = apply(B, m); B = a.b; api.sfx(m.cap != null ? 'hit' : 'move'); sel = m.t; draw();
        if (k < q.path.length) setTimeout(step, 350); else { busy = false; sel = -1; turn = 1; draw(); end(); }
      })();
    }, 300);
  }
  function end() {
    if (allMoves(B, turn).length) return false;
    over = true; var w = -turn; st.textContent = tx('win', nm(w));
    var left = B.filter(function (v) { return side(v) === w; }).length;
    if (mode === 'two' || w === 1) { if (mode === 'cpu') api.achieve('beat-' + api.level, { so: 'Ka adkaaday kombiyuutarka (' + api.s(api.level) + ')', en: 'Beat the computer (' + api.level + ')' }); api.win((mode === 'cpu' ? { easy: 300, medium: 700, hard: 1500 }[api.level] : 200) + left * 20, { so: tx('win', nm(w)), en: TX.en.win.replace('{c}', w === 1 ? 'Red' : 'White') }); }
    else api.lose(0, { so: tx('win', nm(w)), en: TX.en.win.replace('{c}', 'White') });
    return true;
  }
  function undo() { if (busy || over || !hist.length || api.paused) return; var hh = hist.pop(); if (mode === 'cpu' && hh.turn !== 1 && hist.length) hh = hist.pop(); B = hh.B; turn = hh.turn; chain = -1; sel = -1; draw(); }
  return { start: function () { init(); draw(); } };
});
