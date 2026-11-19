/* Merge 2048-style: slide the tiles, equal numbers merge. Original implementation. */
WTG.register('merge', function (api) {
  var N = api.level === 'easy' ? 5 : api.level === 'hard' ? 4 : 4, target = api.level === 'hard' ? 4096 : 2048;
  var g, won, busy = false, undo = null;
  var COL = { 2: '#eef4fb', 4: '#dbe9f8', 8: '#7cc3ff', 16: '#3aa0f0', 32: '#037BDC', 64: '#0263b3', 128: '#ffd166', 256: '#ffb703', 512: '#fb8500', 1024: '#F2060A', 2048: '#b5179e', 4096: '#7209b7' };
  var board = api.h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(' + N + ',1fr)', gridTemplateRows: 'repeat(' + N + ',1fr)', gap: '10px', background: '#0b2545', padding: '10px', borderRadius: '18px', width: 'min(92vw, calc(var(--h) - 90px), 520px)', aspectRatio: '1', touchAction: 'none', boxShadow: '0 16px 40px rgba(0,0,0,.4)' } });
  var cells = [];
  for (var i = 0; i < N * N; i++) { var c = api.h('div', { style: { borderRadius: '10px', background: 'rgba(255,255,255,.06)', display: 'grid', placeItems: 'center', fontFamily: 'Archivo,sans-serif', fontWeight: '900', transition: 'transform .12s' } }); cells.push(c); board.append(c); }
  var undoBtn = api.h('button', { type: 'button', class: 'g-btn sm', text: '↶ Undo', onclick: function () { if (undo && !api.paused) { g = undo.g; api.setScore(undo.s); undo = null; draw(); } } });
  var wrap = api.h('div', { class: 'g-col' }, board, api.h('div', { class: 'g-row' }, undoBtn, api.h('span', { class: 'g-note', text: '→ ' + target })));
  api.el.append(wrap);
  function empty() { var e = []; for (var r = 0; r < N; r++) for (var c = 0; c < N; c++) if (!g[r][c]) e.push([r, c]); return e; }
  function add() { var e = empty(); if (!e.length) return; var p = api.pick(e); g[p[0]][p[1]] = Math.random() < 0.9 ? 2 : 4; return p; }
  function draw(pop) {
    for (var r = 0; r < N; r++) for (var c = 0; c < N; c++) {
      var v = g[r][c], el = cells[r * N + c];
      el.textContent = v || '';
      el.style.background = v ? (COL[v] || '#3c096c') : 'rgba(255,255,255,.06)';
      el.style.color = v && v <= 4 ? '#04213f' : '#fff';
      el.style.fontSize = 'calc(min(92vw, calc(var(--h) - 90px), 520px) / ' + N + ' * ' + (v >= 1000 ? 0.28 : v >= 100 ? 0.36 : 0.45) + ')';
      el.style.transform = pop && pop[0] === r && pop[1] === c ? 'scale(.6)' : 'scale(1)';
    }
    if (pop) requestAnimationFrame(function () { requestAnimationFrame(function () { var el = cells[pop[0] * N + pop[1]]; if (el) el.style.transform = 'scale(1)'; }); });
  }
  function slide(dir) {
    if (api.paused || busy || api.isOver()) return;
    var moved = false, gain = 0, before = JSON.parse(JSON.stringify(g)), sc = api.score;
    for (var k = 0; k < N; k++) {
      var line = [];
      for (var j = 0; j < N; j++) { var r = dir === 'u' ? j : dir === 'd' ? N - 1 - j : k, c = dir === 'l' ? j : dir === 'r' ? N - 1 - j : k; line.push(g[r][c]); }
      var vals = line.filter(Boolean), out = [];
      for (var q = 0; q < vals.length; q++) { if (vals[q] === vals[q + 1]) { out.push(vals[q] * 2); gain += vals[q] * 2; q++; } else out.push(vals[q]); }
      while (out.length < N) out.push(0);
      for (j = 0; j < N; j++) { r = dir === 'u' ? j : dir === 'd' ? N - 1 - j : k; c = dir === 'l' ? j : dir === 'r' ? N - 1 - j : k; if (g[r][c] !== out[j]) moved = true; g[r][c] = out[j]; }
    }
    if (!moved) return;
    undo = { g: before, s: sc };
    api.add(gain); api.sfx(gain ? 'pop' : 'move');
    var p = add(); draw(p);
    var mx = Math.max.apply(null, g.map(function (r) { return Math.max.apply(null, r); }));
    if (mx >= 512) api.achieve('t512', { so: 'Gaar 512', en: 'Reach 512' });
    if (mx >= 1024) api.achieve('t1024', { so: 'Gaar 1024', en: 'Reach 1024' });
    if (!won && mx >= target) { won = true; api.save('g', undefined); api.win(api.score, { so: 'Waxaad gaartay ' + target + '!', en: 'You reached ' + target + '!' }); return; }
    if (!canMove()) { api.save('g', undefined); api.lose(api.score); return; }
    api.save('g', { g: g, s: api.score, n: N });
  }
  function canMove() { if (empty().length) return true; for (var r = 0; r < N; r++) for (var c = 0; c < N; c++) { if (c < N - 1 && g[r][c] === g[r][c + 1]) return true; if (r < N - 1 && g[r][c] === g[r + 1][c]) return true; } return false; }
  var sx, sy;
  board.addEventListener('pointerdown', function (e) { sx = e.clientX; sy = e.clientY; });
  board.addEventListener('pointerup', function (e) { var dx = e.clientX - sx, dy = e.clientY - sy; if (Math.max(Math.abs(dx), Math.abs(dy)) < 25) return; slide(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'r' : 'l') : (dy > 0 ? 'd' : 'u')); });
  return {
    start: function () {
      won = false; undo = null;
      var sv = api.load('g');
      if (api.first && sv && sv.n === N && sv.g && canMoveSaved(sv.g)) { g = sv.g; api.setScore(sv.s); api.toast(api.s('saved')); }
      else { g = []; for (var r = 0; r < N; r++) { g.push([]); for (var c = 0; c < N; c++) g[r].push(0); } add(); add(); }
      draw();
    },
    key: function (e, down) { if (!down) return; var m = { ArrowLeft: 'l', ArrowRight: 'r', ArrowUp: 'u', ArrowDown: 'd', a: 'l', d: 'r', w: 'u', s: 'd' }[e.key]; if (m) { e.preventDefault(); slide(m); } }
  };
  function canMoveSaved(G) { var old = g; g = G; var ok = canMove(); g = old; return ok; }
});
