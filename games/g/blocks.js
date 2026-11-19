/* Block Drop: falling-block puzzle. Fill complete rows to clear them. Original implementation. */
WTG.register('blocks', function (api) {
  var COLS = 10, ROWS = 20, S = 26, SIDE = 120;
  var C = api.canvas(COLS * S + SIDE, ROWS * S, 140), x = C.ctx;
  var SH = [
    [[1, 1, 1, 1]], [[1, 1], [1, 1]], [[0, 1, 0], [1, 1, 1]], [[1, 0, 0], [1, 1, 1]], [[0, 0, 1], [1, 1, 1]], [[1, 1, 0], [0, 1, 1]], [[0, 1, 1], [1, 1, 0]]
  ];
  var COL = ['#38bdf8', '#facc15', '#a78bfa', '#3b82f6', '#fb923c', '#ef4444', '#22c55e'];
  var grid, cur, nxt, acc, lines, lvl, dead, lockT, soft;
  var base = { easy: 0.9, medium: 0.65, hard: 0.42 }[api.level];
  function rot(m) { var r = []; for (var i = 0; i < m[0].length; i++) { r.push([]); for (var j = m.length - 1; j >= 0; j--) r[i].push(m[j][i]); } return r; }
  function piece() { var k = api.rand(0, 6); return { m: SH[k], c: k, x: 3 + (k === 1 ? 1 : 0), y: 0 }; }
  function fits(p, dx, dy, m) { m = m || p.m; for (var i = 0; i < m.length; i++) for (var j = 0; j < m[i].length; j++) if (m[i][j]) { var X = p.x + j + dx, Y = p.y + i + dy; if (X < 0 || X >= COLS || Y >= ROWS || (Y >= 0 && grid[Y][X] >= 0)) return false; } return true; }
  function reset() { grid = []; for (var r = 0; r < ROWS; r++) { grid.push([]); for (var c = 0; c < COLS; c++) grid[r].push(-1); } cur = piece(); nxt = piece(); acc = 0; lines = 0; lvl = 1; dead = false; soft = false; info(); }
  function info() { api.info(api.t({ so: 'Saf', en: 'Lines', ar: 'صفوف', fr: 'Lignes', nl: 'Rijen', it: 'Righe', de: 'Reihen', tr: 'Satır', es: 'Líneas' }), lines); }
  function lock() {
    cur.m.forEach(function (row, i) { row.forEach(function (v, j) { if (v && cur.y + i >= 0) grid[cur.y + i][cur.x + j] = cur.c; }); });
    var n = 0;
    for (var r = ROWS - 1; r >= 0; r--) if (grid[r].every(function (v) { return v >= 0; })) { grid.splice(r, 1); var e = []; for (var c = 0; c < COLS; c++) e.push(-1); grid.unshift(e); n++; r++; }
    if (n) { api.add([0, 100, 300, 500, 800][n] * lvl); lines += n; lvl = 1 + Math.floor(lines / 10); api.sfx(n >= 4 ? 'win' : 'good'); if (n >= 4) api.achieve('four', { so: '4 saf hal mar', en: '4 lines at once' }); info(); } else api.sfx('tap');
    cur = nxt; nxt = piece();
    if (!fits(cur, 0, 0)) { dead = true; api.lose(api.score); }
  }
  function move(dx) { if (fits(cur, dx, 0)) { cur.x += dx; api.sfx('tick'); } }
  function rotate() { var m = rot(cur.m); [0, -1, 1, -2, 2].some(function (k) { if (fits(cur, k, 0, m)) { cur.x += k; cur.m = m; api.sfx('move'); return true; } }); }
  function drop() { var d = 0; while (fits(cur, 0, 1)) { cur.y++; d++; } api.add(d * 2); lock(); }
  function cell(c, r, k, a) { x.globalAlpha = a || 1; x.fillStyle = COL[k]; x.fillRect(c * S + 1, r * S + 1, S - 2, S - 2); x.fillStyle = 'rgba(255,255,255,.25)'; x.fillRect(c * S + 1, r * S + 1, S - 2, 5); x.globalAlpha = 1; }
  function draw() {
    x.fillStyle = '#0b1730'; x.fillRect(0, 0, C.W, C.H);
    x.strokeStyle = 'rgba(255,255,255,.05)'; for (var c = 0; c <= COLS; c++) { x.beginPath(); x.moveTo(c * S, 0); x.lineTo(c * S, C.H); x.stroke(); }
    for (var r = 0; r < ROWS; r++) for (c = 0; c < COLS; c++) if (grid[r][c] >= 0) cell(c, r, grid[r][c]);
    var gy = 0; while (fits(cur, 0, gy + 1)) gy++;
    cur.m.forEach(function (row, i) { row.forEach(function (v, j) { if (v) { cell(cur.x + j, cur.y + i + gy, cur.c, 0.22); cell(cur.x + j, cur.y + i, cur.c); } }); });
    x.fillStyle = '#04213f'; x.fillRect(COLS * S, 0, SIDE, C.H); x.fillStyle = '#F2060A'; x.fillRect(COLS * S, 0, 3, C.H);
    x.fillStyle = '#bcd3ee'; x.font = 'bold 13px sans-serif'; x.textAlign = 'center';
    x.fillText('NEXT', COLS * S + SIDE / 2, 26);
    nxt.m.forEach(function (row, i) { row.forEach(function (v, j) { if (v) { x.fillStyle = COL[nxt.c]; x.fillRect(COLS * S + SIDE / 2 - row.length * 9 + j * 18, 40 + i * 18, 16, 16); } }); });
    x.fillStyle = '#bcd3ee'; x.fillText('LEVEL', COLS * S + SIDE / 2, 140); x.fillStyle = '#fff'; x.font = 'bold 26px sans-serif'; x.fillText(lvl, COLS * S + SIDE / 2, 170);
    x.fillStyle = '#bcd3ee'; x.font = 'bold 13px sans-serif'; x.fillText('LINES', COLS * S + SIDE / 2, 210); x.fillStyle = '#fff'; x.font = 'bold 26px sans-serif'; x.fillText(lines, COLS * S + SIDE / 2, 240);
  }
  // touch: tap = rotate, swipe left/right = move, swipe down = drop; plus buttons
  var tx, ty, tt;
  C.cv.addEventListener('touchstart', function (e) { var t = e.touches[0]; tx = t.clientX; ty = t.clientY; tt = Date.now(); }, { passive: true });
  C.cv.addEventListener('touchmove', function (e) { e.preventDefault(); var t = e.touches[0], dx = t.clientX - tx; if (Math.abs(dx) > 28 && !api.paused) { move(dx > 0 ? 1 : -1); tx = t.clientX; } }, { passive: false });
  C.cv.addEventListener('touchend', function (e) { if (api.paused || dead) return; var t = e.changedTouches[0], dx = t.clientX - tx, dy = t.clientY - ty; if (dy > 60 && Math.abs(dy) > Math.abs(dx)) drop(); else if (Math.abs(dx) < 10 && Math.abs(dy) < 10 && Date.now() - tt < 300) rotate(); });
  C.cv.addEventListener('mousedown', function () { if (!api.paused && !dead) rotate(); });
  var bar = api.h('div', { class: 'g-row', style: { marginTop: '8px' } });
  [['◀', function () { move(-1); }], ['⟳', rotate], ['▼', function () { if (fits(cur, 0, 1)) { cur.y++; api.add(1); } }], ['⤓', drop], ['▶', function () { move(1); }]].forEach(function (b) {
    var el = api.h('button', { type: 'button', class: 'g-btn', text: b[0], 'aria-label': b[0] });
    el.addEventListener('pointerdown', function (e) { e.preventDefault(); if (!api.paused && !dead) b[1](); });
    bar.append(el);
  });
  var wrap = api.h('div', { class: 'g-col' }); api.el.append(wrap); wrap.append(C.cv, bar);
  return {
    start: function () {
      reset(); draw();
      api.loop(function (dt) {
        if (dead) return;
        acc += dt; var sp = soft ? 0.04 : Math.max(0.08, base - (lvl - 1) * 0.06);
        if (acc > sp) { acc = 0; if (fits(cur, 0, 1)) { cur.y++; if (soft) api.add(1); } else lock(); }
        draw();
      });
    },
    key: function (e, down) {
      var k = e.key;
      if (k === 'ArrowDown') { soft = down; e.preventDefault(); return; }
      if (!down) return;
      if (k === 'ArrowLeft') move(-1); else if (k === 'ArrowRight') move(1); else if (k === 'ArrowUp' || k === 'x') rotate(); else if (k === ' ') drop(); else return;
      e.preventDefault();
    }
  };
});
