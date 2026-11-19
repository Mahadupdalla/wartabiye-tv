/* Four Homes: a classic race board game for 2–4 players (cross-and-circle family). Roll a 6 to leave home, go round
   the board and reach the centre with all four tokens. Original implementation: no money, no betting. */
WTG.register('ludo', function (api) {
  var h = api.h, CS = 30, W = CS * 15, C = api.canvas(W, W, 150), x = C.ctx;
  var TX = { so: { roll: '🎲 Tuur laadhuuga', you: 'Adiga', cpu: 'Kombiyuutar', p: 'Ciyaaryahan', turn: 'Waa {c}', pick: 'Dooro gabal aad dhaqaajiso', none: 'Dhaqdhaqaaq ma jiro', six: '6! Mar kale tuur', win: '{c} ayaa guuleystay!', m1: '🤖 1 kombiyuutar', m3: '🤖 3 kombiyuutar', m2: '👥 2 qof', m4: '👥 4 qof' },
    en: { roll: '🎲 Roll the dice', you: 'You', cpu: 'Computer', p: 'Player', turn: 'Turn: {c}', pick: 'Pick a token to move', none: 'No move possible', six: 'A 6! Roll again', win: '{c} wins!', m1: '🤖 vs 1 computer', m3: '🤖 vs 3 computers', m2: '👥 2 players', m4: '👥 4 players' } };
  function tx(k, c) { var s = (TX[api.lang] || TX.en)[k] || TX.en[k]; return c ? s.replace('{c}', c) : s; }
  var COL = ['#ef4444', '#22c55e', '#facc15', '#3b82f6'], NAME = { so: ['Casaan', 'Cagaar', 'Jaalle', 'Buluug'], en: ['Red', 'Green', 'Yellow', 'Blue'] };
  var PATH = [];
  (function () {
    function seg(a) { a.forEach(function (p) { PATH.push(p); }); }
    var i; var s = [];
    for (i = 1; i <= 5; i++) s.push([6, i]); for (i = 5; i >= 0; i--) s.push([i, 6]); s.push([0, 7], [0, 8]);
    for (i = 1; i <= 5; i++) s.push([i, 8]); for (i = 9; i <= 14; i++) s.push([6, i]); s.push([7, 14], [8, 14]);
    for (i = 13; i >= 9; i--) s.push([8, i]); for (i = 9; i <= 14; i++) s.push([i, 8]); s.push([14, 7], [14, 6]);
    for (i = 13; i >= 9; i--) s.push([i, 6]); for (i = 5; i >= 0; i--) s.push([8, i]); s.push([7, 0], [6, 0]);
    seg(s);
  })();
  var HOME = [[[7, 1], [7, 2], [7, 3], [7, 4], [7, 5]], [[1, 7], [2, 7], [3, 7], [4, 7], [5, 7]], [[7, 13], [7, 12], [7, 11], [7, 10], [7, 9]], [[13, 7], [12, 7], [11, 7], [10, 7], [9, 7]]];
  var BASE = [[1.5, 1.5], [1.5, 10.5], [10.5, 10.5], [10.5, 1.5]], OFF = [0, 13, 26, 39], SAFE = [0, 8, 13, 21, 26, 34, 39, 47];
  var mode = api.load('mode', 'm1'), players, tok, cur, die, rolled, busy, over, sixes, anim;
  function setup() {
    players = mode === 'm1' ? [0, 2] : mode === 'm2' ? [0, 2] : [0, 1, 2, 3];
    var cpu = mode === 'm1' || mode === 'm3';
    tok = {}; players.forEach(function (p) { tok[p] = [-1, -1, -1, -1]; });
    players.cpu = function (p) { return cpu && p !== 0; };
    cur = 0; die = 0; rolled = false; busy = false; over = false; sixes = 0; anim = null; turnMsg(); draw(); if (players.cpu(players[cur])) cpuTurn();
  }
  function pname(p) { if (players.cpu(p)) return tx('cpu') + ' (' + (NAME[api.lang] || NAME.en)[p] + ')'; return (mode === 'm1' || mode === 'm3') ? tx('you') : (NAME[api.lang] || NAME.en)[p]; }
  function cell(p, prog) { if (prog < 0) return null; if (prog <= 50) return PATH[(OFF[p] + prog) % 52]; if (prog <= 55) return HOME[p][prog - 51]; return [7, 7]; }
  function abs(p, prog) { return prog >= 0 && prog <= 50 ? (OFF[p] + prog) % 52 : -1; }
  function movable(p, d) { return tok[p].map(function (pr, i) { return { i: i, ok: pr < 0 ? d === 6 : pr + d <= 56 }; }).filter(function (m) { return m.ok; }).map(function (m) { return m.i; }); }
  var st = h('div', { class: 'bd-st', 'aria-live': 'polite' });
  var rollBtn = h('button', { type: 'button', class: 'g-btn blue', text: tx('roll'), onclick: function () { humanRoll(); } });
  var dieEl = h('div', { class: 'g-big', style: { fontSize: '44px', minWidth: '60px' }, text: '🎲' });
  var modes = h('div', { class: 'bd-bar' }); ['m1', 'm3', 'm2', 'm4'].forEach(function (m) { modes.append(h('button', { type: 'button', class: 'g-btn sm' + (m === mode ? ' blue' : ''), text: tx(m), onclick: function () { if (busy) return; mode = m; api.save('mode', m); [].forEach.call(modes.children, function (b, i) { b.classList.toggle('blue', ['m1', 'm3', 'm2', 'm4'][i] === m); }); setup(); } })); });
  var wrap = h('div', { class: 'g-col' }); api.el.append(wrap);
  wrap.append(st, C.cv, h('div', { class: 'g-row' }, dieEl, rollBtn), modes);
  function turnMsg(t) { var p = players[cur]; st.textContent = t || tx('turn', pname(p)); st.style.color = COL[p]; rollBtn.disabled = players.cpu(p) || rolled || over; }
  function humanRoll() { if (api.paused || busy || rolled || over || players.cpu(players[cur])) return; roll(); }
  function roll() {
    die = api.rand(1, 6); rolled = true; api.sfx('tick');
    dieEl.textContent = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'][die - 1];
    var p = players[cur], mv = movable(p, die);
    if (die === 6) sixes++; else sixes = 0;
    if (sixes === 3) { sixes = 0; turnMsg(tx('none')); setTimeout(nextTurn, 700); return; }
    if (!mv.length) { turnMsg(tx('none')); setTimeout(nextTurn, 800); return; }
    if (players.cpu(p)) { setTimeout(function () { move(p, cpuPick(p, mv)); }, 450); return; }
    if (mv.length === 1 && tok[p][mv[0]] >= 0) { setTimeout(function () { move(p, mv[0]); }, 250); return; }
    turnMsg(tx('pick')); draw();
  }
  function cpuPick(p, mv) {
    var best = mv[0], bv = -1e9;
    mv.forEach(function (i) {
      var pr = tok[p][i], np = pr < 0 ? 0 : pr + die, a = abs(p, np), v = 0;
      if (np === 56) v += 100; if (pr < 0) v += 60;
      if (a >= 0 && SAFE.indexOf(a) < 0) players.forEach(function (q) { if (q !== p) tok[q].forEach(function (qp) { if (abs(q, qp) === a) v += 120; }); });
      if (a >= 0 && SAFE.indexOf(a) >= 0) v += 15; if (np > 50) v += 25;
      v += np * (api.level === 'easy' ? 0 : 1) + (api.level === 'easy' ? Math.random() * 80 : Math.random() * 5);
      if (v > bv) { bv = v; best = i; }
    });
    return best;
  }
  function move(p, i) {
    busy = true;
    var from = tok[p][i], to = from < 0 ? 0 : from + die, steps = from < 0 ? [0] : [];
    for (var s = from + 1; from >= 0 && s <= to; s++) steps.push(s);
    var k = 0;
    (function step() {
      tok[p][i] = steps[k++]; api.sfx('move'); draw();
      if (k < steps.length) { setTimeout(step, 120); return; }
      // capture
      var a = abs(p, to), extra = die === 6;
      if (a >= 0 && SAFE.indexOf(a) < 0) players.forEach(function (q) { if (q === p) return; tok[q].forEach(function (qp, j) { if (abs(q, qp) === a) { tok[q][j] = -1; extra = true; api.sfx('hit'); if (!players.cpu(p)) { api.add(50); api.achieve('cap', { so: 'Gabal cunay', en: 'Sent a token home' }); } } }); });
      if (to === 56) { extra = true; api.sfx('good'); if (!players.cpu(p)) api.add(100); }
      draw(); busy = false;
      if (tok[p].every(function (v) { return v === 56; })) {
        over = true; turnMsg(tx('win', pname(p)));
        var msg = { so: tx('win', pname(p)), en: TX.en.win.replace('{c}', pname(p)) };
        if (players.cpu(p)) api.lose(api.score, msg); else api.win(api.score + 500, msg);
        return;
      }
      if (extra) { rolled = false; turnMsg(die === 6 ? tx('six') : null); if (players.cpu(p)) cpuTurn(); return; }
      nextTurn();
    })();
  }
  function nextTurn() { if (over || api.isOver()) return; rolled = false; sixes = 0; cur = (cur + 1) % players.length; turnMsg(); draw(); if (players.cpu(players[cur])) cpuTurn(); }
  function cpuTurn() { setTimeout(function () { if (over || api.isOver()) return; if (api.paused) return cpuTurn(); roll(); }, 650); }
  function draw() {
    x.fillStyle = '#fff'; x.fillRect(0, 0, W, W);
    [[0, 0, 0], [1, 0, 9], [2, 9, 9], [3, 9, 0]].forEach(function (b) { x.fillStyle = COL[b[0]]; x.fillRect(b[2] * CS, b[1] * CS, 6 * CS, 6 * CS); x.fillStyle = '#fff'; x.fillRect(b[2] * CS + CS, b[1] * CS + CS, 4 * CS, 4 * CS); });
    x.strokeStyle = '#cbd5e1'; x.lineWidth = 1;
    PATH.forEach(function (c, i) { var col = null; OFF.forEach(function (o, p) { if (i === o) col = COL[p]; }); x.fillStyle = col || '#fff'; x.fillRect(c[1] * CS, c[0] * CS, CS, CS); x.strokeRect(c[1] * CS, c[0] * CS, CS, CS); if (SAFE.indexOf(i) >= 0 && !col) { x.fillStyle = '#94a3b8'; x.font = '16px serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('★', c[1] * CS + CS / 2, c[0] * CS + CS / 2); } });
    HOME.forEach(function (hc, p) { hc.forEach(function (c) { x.fillStyle = COL[p]; x.fillRect(c[1] * CS, c[0] * CS, CS, CS); x.strokeRect(c[1] * CS, c[0] * CS, CS, CS); }); });
    // centre
    var m = 7.5 * CS; [[0, 6, 6, 9, 6], [1, 6, 6, 6, 9], [2, 6, 9, 9, 9], [3, 9, 6, 9, 9]].forEach(function (t) { x.fillStyle = COL[t[0]]; x.beginPath(); x.moveTo(m, m); x.lineTo(t[2] * CS, t[1] * CS); x.lineTo(t[4] * CS, t[3] * CS); x.fill(); });
    x.fillStyle = '#04213f'; x.font = 'bold 13px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('WTV', m, m);
    // tokens
    var p0 = players[cur], mv = rolled && !busy && !players.cpu(p0) ? movable(p0, die) : [];
    var spots = {};
    players.forEach(function (p) { tok[p].forEach(function (pr, i) {
      var c = cell(p, pr), cx, cy;
      if (!c) { var bx = BASE[p]; cx = (bx[1] + 0.5 + (i % 2) * 2) * CS; cy = (bx[0] + 0.5 + (i > 1 ? 2 : 0)) * CS; }
      else { var kk = c[0] + ',' + c[1]; var n = spots[kk] = (spots[kk] || 0) + 1; cx = c[1] * CS + CS / 2 + (n - 1) * 5; cy = c[0] * CS + CS / 2 - (n - 1) * 5; }
      var hot = p === p0 && mv.indexOf(i) >= 0;
      if (hot) { x.fillStyle = 'rgba(4,33,63,.25)'; x.beginPath(); x.arc(cx, cy, 15, 0, 7); x.fill(); }
      x.fillStyle = '#04213f'; x.beginPath(); x.arc(cx, cy + 2, 11, 0, 7); x.fill();
      x.fillStyle = COL[p]; x.beginPath(); x.arc(cx, cy, 10, 0, 7); x.fill(); x.strokeStyle = '#fff'; x.lineWidth = 2; x.stroke();
      if (hot) { x.strokeStyle = '#04213f'; x.lineWidth = 2; x.beginPath(); x.arc(cx, cy, 14 + Math.sin(Date.now() / 150) * 1.5, 0, 7); x.stroke(); }
      tokPos[p + ':' + i] = [cx, cy];
    }); });
  }
  var tokPos = {};
  C.cv.addEventListener('pointerdown', function (e) {
    if (api.paused || busy || !rolled || over) return; var p = players[cur]; if (players.cpu(p)) return;
    var pt = C.pt(e), mv = movable(p, die), best = -1, bd = 22;
    mv.forEach(function (i) { var q = tokPos[p + ':' + i]; if (!q) return; var d = Math.hypot(q[0] - pt.x, q[1] - pt.y); if (d < bd) { bd = d; best = i; } });
    if (best >= 0) move(p, best);
  });
  return {
    start: function () { setup(); api.loop(function () { if (rolled && !busy) draw(); }); },
    key: function (e, down) { if (!down) return; if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); humanRoll(); } var n = parseInt(e.key, 10); if (n >= 1 && n <= 4 && rolled && !busy) { var p = players[cur]; if (!players.cpu(p) && movable(p, die).indexOf(n - 1) >= 0) move(p, n - 1); } }
  };
});
