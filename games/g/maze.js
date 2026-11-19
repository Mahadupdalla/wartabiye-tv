/* Maze Quest: an adventure through 5 maze levels. Collect the stars, find the key, open the door before time runs out.
   Each maze is generated fresh. On Hard you only see the area around you. Original implementation. */
WTG.register('maze', function (api) {
  var LEVELS = 5, lvl, M, N, P, stars, key, door, hasKey, tLeft, CS, C, x, dark = api.cfg('dark', 'auto') === 'auto' ? api.level === 'hard' : api.cfg('dark') === 'on';
  var base = api.cfg('size', { easy: 7, medium: 9, hard: 11 }[api.level]);
  var wrap = api.h('div', { class: 'g-col' }); api.el.append(wrap);
  function gen(n) {
    var cells = []; for (var i = 0; i < n * n; i++) cells.push({ w: [1, 1, 1, 1], v: 0 }); // top right bottom left
    var st = [0]; cells[0].v = 1;
    while (st.length) {
      var c = st[st.length - 1], r = Math.floor(c / n), k = c % n, nb = [];
      if (r > 0 && !cells[c - n].v) nb.push([c - n, 0, 2]); if (k < n - 1 && !cells[c + 1].v) nb.push([c + 1, 1, 3]);
      if (r < n - 1 && !cells[c + n].v) nb.push([c + n, 2, 0]); if (k > 0 && !cells[c - 1].v) nb.push([c - 1, 3, 1]);
      if (!nb.length) { st.pop(); continue; }
      var q = api.pick(nb); cells[c].w[q[1]] = 0; cells[q[0]].w[q[2]] = 0; cells[q[0]].v = 1; st.push(q[0]);
    }
    // a few extra openings so there is more than one path
    for (i = 0; i < n; i++) { var a = api.rand(0, n * n - 1), d = api.rand(1, 2); if (d === 1 && a % n < n - 1) { cells[a].w[1] = 0; cells[a + 1].w[3] = 0; } if (d === 2 && a < n * n - n) { cells[a].w[2] = 0; cells[a + n].w[0] = 0; } }
    return cells;
  }
  function level() {
    N = base + lvl - 1; M = gen(N); P = { c: 0, x: 0, y: 0 }; hasKey = false;
    var free = []; for (var i = 1; i < N * N; i++) free.push(i); free = api.shuffle(free);
    door = N * N - 1; free = free.filter(function (f) { return f !== door; });
    key = free.pop(); stars = free.slice(0, 3 + lvl);
    tLeft = { easy: 120, medium: 90, hard: 80 }[api.level] + N * 2;
    var S = 480; CS = S / N;
    wrap.innerHTML = ''; api.el.querySelectorAll('canvas').forEach(function (c) { c.remove(); });
    C = api.canvas(S, S, 140); x = C.ctx; wrap.append(C.cv, pad);
    bindSwipe();
    api.toast(api.t({ so: 'Heerka ', en: 'Level ' }) + lvl + ' / ' + LEVELS);
  }
  function go(d) {
    if (api.paused || api.isOver()) return;
    var dirs = [[-1, 0], [0, 1], [1, 0], [0, -1]], c = P.c;
    if (M[c].w[d]) { api.sfx('tick'); return; }
    var r = Math.floor(c / N) + dirs[d][0], k = c % N + dirs[d][1]; P.c = r * N + k; api.sfx('move');
    var si = stars.indexOf(P.c); if (si >= 0) { stars.splice(si, 1); api.add(25); api.sfx('coin'); }
    if (P.c === key) { hasKey = true; key = -1; api.sfx('good'); api.toast('🔑'); }
    if (P.c === door) { if (hasKey) { api.add(100 + Math.ceil(tLeft) * 2); api.sfx('win'); if (!stars.length) api.achieve('allstars', { so: 'Xiddigaha oo dhan', en: 'Collected every star' }); if (lvl >= LEVELS) { api.win(api.score, { so: 'Dhammaan 5-ta heer!', en: 'All 5 levels cleared!' }); return; } lvl++; level(); } else api.toast(api.t({ so: 'Furaha marka hore raadi 🔑', en: 'Find the key first 🔑' })); }
    draw();
  }
  function draw() {
    x.fillStyle = '#0b2545'; x.fillRect(0, 0, 480, 480);
    x.strokeStyle = '#7cc3ff'; x.lineWidth = Math.max(2, CS * 0.1); x.lineCap = 'round';
    var pr = Math.floor(P.c / N), pk = P.c % N;
    for (var i = 0; i < N * N; i++) {
      var r = Math.floor(i / N), k = i % N, X = k * CS, Y = r * CS, w = M[i].w;
      if (dark && Math.abs(r - pr) + Math.abs(k - pk) > 3) continue;
      x.beginPath(); if (w[0]) { x.moveTo(X, Y); x.lineTo(X + CS, Y); } if (w[1]) { x.moveTo(X + CS, Y); x.lineTo(X + CS, Y + CS); } if (w[2]) { x.moveTo(X, Y + CS); x.lineTo(X + CS, Y + CS); } if (w[3]) { x.moveTo(X, Y); x.lineTo(X, Y + CS); } x.stroke();
    }
    x.font = Math.floor(CS * 0.62) + 'px serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
    function at(c, s) { var r = Math.floor(c / N), k = c % N; if (dark && Math.abs(r - pr) + Math.abs(k - pk) > 3) return; x.fillText(s, k * CS + CS / 2, r * CS + CS / 2 + 1); }
    stars.forEach(function (s) { at(s, '⭐'); }); if (key >= 0) at(key, '🔑'); at(door, hasKey ? '🚪' : '🔒');
    at(P.c, '🧑‍🚀');
    x.fillStyle = '#fff'; x.font = 'bold 14px sans-serif'; x.textAlign = 'left';
  }
  var pad = api.h('div', { class: 'g-pad' });
  [['', -1], ['▲', 0], ['', -1], ['◀', 3], ['▼', 2], ['▶', 1]].forEach(function (b) { var el = api.h('button', { type: 'button', text: b[0], 'aria-label': b[0] || null, style: b[0] ? null : { visibility: 'hidden' } }); if (b[0]) el.addEventListener('pointerdown', function (e) { e.preventDefault(); go(b[1]); }); pad.append(el); });
  function bindSwipe() { var sx, sy; C.cv.addEventListener('pointerdown', function (e) { sx = e.clientX; sy = e.clientY; }); C.cv.addEventListener('pointerup', function (e) { var dx = e.clientX - sx, dy = e.clientY - sy; if (Math.max(Math.abs(dx), Math.abs(dy)) < 20) return; go(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 1 : 3) : (dy > 0 ? 2 : 0)); }); }
  return {
    start: function () { lvl = 1; level(); draw(); api.loop(function (dt) { tLeft -= dt; api.info('⏱', WTG.fmtTime(tLeft)); if (tLeft <= 0) api.lose(api.score, { so: 'Waqtigii wuu dhammaaday (heerka ' + lvl + ')', en: 'Time is up (level ' + lvl + ')' }); }); },
    key: function (e, down) { if (!down) return; var d = { ArrowUp: 0, ArrowRight: 1, ArrowDown: 2, ArrowLeft: 3, w: 0, d: 1, s: 2, a: 3 }[e.key]; if (d != null) { e.preventDefault(); go(d); } }
  };
});
