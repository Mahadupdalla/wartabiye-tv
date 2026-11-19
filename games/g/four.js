/* Four in a Row: drop discs and connect four in a line before your opponent. Strategy game against the computer
   or a second player. Original implementation. */
WTG.register('four', function (api) {
  var h = api.h, COLS = 7, ROWS = 6;
  var TX = { so: { turn: '{c} ayaa ciyaaraya', win: '{c} ayaa guuleystay!', draw: 'Barbarro', red: 'Casaan', yel: 'Jaalle', cpu: '🤖 Kombiyuutar', two: '👥 2 qof' }, en: { turn: '{c} to play', win: '{c} wins!', draw: 'Draw', red: 'Red', yel: 'Yellow', cpu: '🤖 vs computer', two: '👥 2 players' } };
  function tx(k, c) { var s = (TX[api.lang] || TX.en)[k] || TX.en[k]; return c ? s.replace('{c}', c) : s; }
  var g, turn, over, busy, mode = api.load('mode', 'cpu'), moves;
  var boardEl = h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: '6px', background: '#037BDC', padding: '10px', borderRadius: '18px', width: 'min(calc(var(--w) - 20px), calc((var(--h) - 120px) * 7 / 6), 620px)', boxShadow: '0 16px 40px rgba(0,0,0,.45)', touchAction: 'manipulation' } });
  var cells = [];
  for (var r = 0; r < ROWS; r++) for (var c = 0; c < COLS; c++) (function (c) { var el = h('button', { type: 'button', 'aria-label': 'column ' + (c + 1), style: { aspectRatio: '1', borderRadius: '50%', border: '0', background: '#04213f', cursor: 'pointer', boxShadow: 'inset 0 4px 8px rgba(0,0,0,.5)', transition: 'background .15s' }, onclick: function () { drop(c); } }); cells.push(el); boardEl.append(el); })(c);
  var st = h('div', { class: 'bd-st', 'aria-live': 'polite' });
  var bar = h('div', { class: 'bd-bar' }, h('button', { type: 'button', class: 'g-btn sm' + (mode === 'cpu' ? ' blue' : ''), text: tx('cpu'), onclick: function () { setMode('cpu'); } }), h('button', { type: 'button', class: 'g-btn sm' + (mode === 'two' ? ' blue' : ''), text: tx('two'), onclick: function () { setMode('two'); } }));
  api.el.append(h('div', { class: 'bd-wrap' }, st, boardEl, bar));
  function setMode(m) { if (busy) return; mode = m; api.save('mode', m); bar.children[0].classList.toggle('blue', m === 'cpu'); bar.children[1].classList.toggle('blue', m === 'two'); init(); }
  function init() { g = []; for (var r = 0; r < ROWS; r++) { g.push([0, 0, 0, 0, 0, 0, 0]); } turn = 1; over = false; busy = false; moves = 0; draw(); }
  function nm(p) { return p === 1 ? tx('red') : tx('yel'); }
  function draw(winLine) {
    for (var r = 0; r < ROWS; r++) for (var c = 0; c < COLS; c++) { var v = g[r][c], el = cells[r * COLS + c]; el.style.background = v === 1 ? 'radial-gradient(circle at 35% 30%,#ff6b6b,#c1121f)' : v === 2 ? 'radial-gradient(circle at 35% 30%,#fff3a3,#f59e0b)' : '#04213f'; el.style.outline = winLine && winLine.some(function (p) { return p[0] === r && p[1] === c; }) ? '4px solid #fff' : 'none'; }
    if (!over) st.textContent = tx('turn', nm(turn));
  }
  function rowFor(G, c) { for (var r = ROWS - 1; r >= 0; r--) if (!G[r][c]) return r; return -1; }
  function line(G, p) {
    var D = [[0, 1], [1, 0], [1, 1], [1, -1]];
    for (var r = 0; r < ROWS; r++) for (var c = 0; c < COLS; c++) if (G[r][c] === p) for (var k = 0; k < 4; k++) {
      var L = [[r, c]]; for (var s = 1; s < 4; s++) { var rr = r + D[k][0] * s, cc = c + D[k][1] * s; if (rr < 0 || rr >= ROWS || cc < 0 || cc >= COLS || G[rr][cc] !== p) break; L.push([rr, cc]); }
      if (L.length === 4) return L;
    }
    return null;
  }
  function drop(c) {
    if (api.paused || over || busy) return; if (mode === 'cpu' && turn !== 1) return;
    place(c);
  }
  function place(c) {
    var r = rowFor(g, c); if (r < 0) return;
    g[r][c] = turn; moves++; api.sfx('move'); var L = line(g, turn);
    if (L) { over = true; draw(L); st.textContent = tx('win', nm(turn)); var msg = { so: tx('win', nm(turn)), en: TX.en.win.replace('{c}', turn === 1 ? 'Red' : 'Yellow') }; if (mode === 'two' || turn === 1) { if (mode === 'cpu') api.achieve('beat-' + api.level, { so: 'Ka adkaaday kombiyuutarka', en: 'Beat the computer (' + api.level + ')' }); api.win((mode === 'cpu' ? { easy: 200, medium: 500, hard: 1000 }[api.level] : 200) + (42 - moves) * 5, msg); } else api.lose(0, msg); return; }
    if (moves === 42) { over = true; draw(); st.textContent = tx('draw'); api.end({ won: false, score: 100, msg: { so: 'Barbarro', en: 'Draw' } }); return; }
    turn = 3 - turn; draw();
    if (mode === 'cpu' && turn === 2) { busy = true; setTimeout(function () { if (api.isOver()) return; busy = false; place(ai()); }, 350); }
  }
  function scoreWin(G, p) {
    var s = 0, D = [[0, 1], [1, 0], [1, 1], [1, -1]];
    for (var c = 0; c < ROWS; c++) if (G[c][3] === p) s += 3;
    for (var r = 0; r < ROWS; r++) for (c = 0; c < COLS; c++) for (var k = 0; k < 4; k++) {
      var mine = 0, theirs = 0, ok = true;
      for (var q = 0; q < 4; q++) { var rr = r + D[k][0] * q, cc = c + D[k][1] * q; if (rr < 0 || rr >= ROWS || cc < 0 || cc >= COLS) { ok = false; break; } if (G[rr][cc] === p) mine++; else if (G[rr][cc]) theirs++; }
      if (!ok || (mine && theirs)) continue;
      s += mine === 3 ? 5 : mine === 2 ? 2 : 0; s -= theirs === 3 ? 4 : 0;
    }
    return s;
  }
  function mm(G, d, a, b, p) {
    if (line(G, 2)) return 100000 + d; if (line(G, 1)) return -100000 - d;
    var valid = [3, 2, 4, 1, 5, 0, 6].filter(function (c) { return rowFor(G, c) >= 0; });
    if (!valid.length) return 0; if (d === 0) return scoreWin(G, 2) - scoreWin(G, 1);
    if (p === 2) { var v = -1e9; for (var i = 0; i < valid.length; i++) { var r = rowFor(G, valid[i]); G[r][valid[i]] = 2; v = Math.max(v, mm(G, d - 1, a, b, 1)); G[r][valid[i]] = 0; a = Math.max(a, v); if (a >= b) break; } return v; }
    v = 1e9; for (i = 0; i < valid.length; i++) { r = rowFor(G, valid[i]); G[r][valid[i]] = 1; v = Math.min(v, mm(G, d - 1, a, b, 2)); G[r][valid[i]] = 0; b = Math.min(b, v); if (a >= b) break; } return v;
  }
  function ai() {
    var depth = { easy: 1, medium: 4, hard: 6 }[api.level], valid = [3, 2, 4, 1, 5, 0, 6].filter(function (c) { return rowFor(g, c) >= 0; });
    if (api.level === 'easy' && Math.random() < 0.4) return api.pick(valid);
    var best = valid[0], bv = -1e9;
    valid.forEach(function (c) { var r = rowFor(g, c); g[r][c] = 2; var v = mm(g, depth - 1, -1e9, 1e9, 1) + Math.random(); g[r][c] = 0; if (v > bv) { bv = v; best = c; } });
    return best;
  }
  return {
    start: init,
    key: function (e, down) { if (!down) return; var n = parseInt(e.key, 10); if (n >= 1 && n <= 7) { e.preventDefault(); drop(n - 1); } }
  };
});
