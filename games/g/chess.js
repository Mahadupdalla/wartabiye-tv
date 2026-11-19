/* Chess: full rules (castling, en passant, promotion, check, checkmate, stalemate, draws) against the computer
   or a second player on the same device. Original implementation. */
WTG.register('chess', function (api) {
  var h = api.h;
  var TX = {
    so: { white: 'Caddaan', black: 'Madow', turn: '{c} ayaa ciyaaraya', check: 'Jees! (Check)', mate: 'Jeesmaat! {c} ayaa guuleystay', stale: 'Barbarro (stalemate)', draw: 'Barbarro', think: 'Kombiyuutarku wuu fikirayaa…', undo: '↶ Dib u celi', cpu: '🤖 Kombiyuutar', two: '👥 2 qof', promo: 'Dooro: ' },
    en: { white: 'White', black: 'Black', turn: '{c} to move', check: 'Check!', mate: 'Checkmate! {c} wins', stale: 'Stalemate: draw', draw: 'Draw', think: 'Computer is thinking…', undo: '↶ Undo', cpu: '🤖 vs computer', two: '👥 2 players', promo: 'Promote to: ' }
  };
  function tx(k, c) { var s = (TX[api.lang] || TX.en)[k] || TX.en[k]; return c ? s.replace('{c}', c) : s; }
  var G = { K: '♚', Q: '♛', R: '♜', B: '♝', N: '♞', P: '♟' };
  var VAL = { P: 100, N: 320, B: 330, R: 500, Q: 900, K: 0 };
  // piece-square tables (white's view, a8 = index 0)
  var PST = {
    P: [0, 0, 0, 0, 0, 0, 0, 0, 50, 50, 50, 50, 50, 50, 50, 50, 10, 10, 20, 30, 30, 20, 10, 10, 5, 5, 10, 25, 25, 10, 5, 5, 0, 0, 0, 20, 20, 0, 0, 0, 5, -5, -10, 0, 0, -10, -5, 5, 5, 10, 10, -20, -20, 10, 10, 5, 0, 0, 0, 0, 0, 0, 0, 0],
    N: [-50, -40, -30, -30, -30, -30, -40, -50, -40, -20, 0, 0, 0, 0, -20, -40, -30, 0, 10, 15, 15, 10, 0, -30, -30, 5, 15, 20, 20, 15, 5, -30, -30, 0, 15, 20, 20, 15, 0, -30, -30, 5, 10, 15, 15, 10, 5, -30, -40, -20, 0, 5, 5, 0, -20, -40, -50, -40, -30, -30, -30, -30, -40, -50],
    B: [-20, -10, -10, -10, -10, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 10, 10, 5, 0, -10, -10, 5, 5, 10, 10, 5, 5, -10, -10, 0, 10, 10, 10, 10, 0, -10, -10, 10, 10, 10, 10, 10, 10, -10, -10, 5, 0, 0, 0, 0, 5, -10, -20, -10, -10, -10, -10, -10, -10, -20],
    R: [0, 0, 0, 0, 0, 0, 0, 0, 5, 10, 10, 10, 10, 10, 10, 5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, 0, 0, 0, 5, 5, 0, 0, 0],
    Q: [-20, -10, -10, -5, -5, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 5, 5, 5, 0, -10, -5, 0, 5, 5, 5, 5, 0, -5, 0, 0, 5, 5, 5, 5, 0, -5, -10, 5, 5, 5, 5, 5, 0, -10, -10, 0, 5, 0, 0, 0, 0, -10, -20, -10, -10, -5, -5, -10, -10, -20],
    K: [-30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -20, -30, -30, -40, -40, -30, -30, -20, -10, -20, -20, -20, -20, -20, -20, -10, 20, 20, 0, 0, 0, 0, 20, 20, 20, 30, 10, 0, 0, 10, 30, 20]
  };
  var S; // state: b[64] ('' or 'wP' etc), turn 'w'|'b', castle {wK,wQ,bK,bQ}, ep (index or -1), half, hist[]
  function init() {
    var r = 'RNBQKBNR'; var b = [];
    for (var i = 0; i < 64; i++) b.push('');
    for (i = 0; i < 8; i++) { b[i] = 'b' + r[i]; b[8 + i] = 'bP'; b[48 + i] = 'wP'; b[56 + i] = 'w' + r[i]; }
    return { b: b, turn: 'w', castle: { wK: 1, wQ: 1, bK: 1, bQ: 1 }, ep: -1, half: 0, reps: {} };
  }
  function clone(s) { return { b: s.b.slice(), turn: s.turn, castle: { wK: s.castle.wK, wQ: s.castle.wQ, bK: s.castle.bK, bQ: s.castle.bQ }, ep: s.ep, half: s.half, reps: s.reps }; }
  var DIRS = { N: [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]], B: [[-1, -1], [-1, 1], [1, -1], [1, 1]], R: [[-1, 0], [1, 0], [0, -1], [0, 1]] };
  DIRS.Q = DIRS.B.concat(DIRS.R); DIRS.K = DIRS.Q;
  function attacked(b, sq, by) {
    var r = sq >> 3, c = sq & 7, i, d, rr, cc, p;
    var pr = by === 'w' ? r + 1 : r - 1;
    if (pr >= 0 && pr < 8) for (i = -1; i <= 1; i += 2) { cc = c + i; if (cc >= 0 && cc < 8 && b[pr * 8 + cc] === by + 'P') return true; }
    for (i = 0; i < 8; i++) { d = DIRS.N[i]; rr = r + d[0]; cc = c + d[1]; if (rr >= 0 && rr < 8 && cc >= 0 && cc < 8 && b[rr * 8 + cc] === by + 'N') return true; }
    for (i = 0; i < 8; i++) { d = DIRS.K[i]; rr = r + d[0]; cc = c + d[1]; if (rr >= 0 && rr < 8 && cc >= 0 && cc < 8 && b[rr * 8 + cc] === by + 'K') return true; }
    for (i = 0; i < 8; i++) {
      d = DIRS.Q[i]; rr = r + d[0]; cc = c + d[1];
      while (rr >= 0 && rr < 8 && cc >= 0 && cc < 8) {
        p = b[rr * 8 + cc];
        if (p) { if (p[0] === by && (p[1] === 'Q' || (i < 4 ? p[1] === 'B' : p[1] === 'R'))) return true; break; }
        rr += d[0]; cc += d[1];
      }
    }
    return false;
  }
  function kingSq(b, c) { for (var i = 0; i < 64; i++) if (b[i] === c + 'K') return i; return -1; }
  function inCheck(s, c) { return attacked(s.b, kingSq(s.b, c), c === 'w' ? 'b' : 'w'); }
  function pseudo(s) {
    var b = s.b, me = s.turn, op = me === 'w' ? 'b' : 'w', mv = [];
    for (var i = 0; i < 64; i++) {
      var p = b[i]; if (!p || p[0] !== me) continue;
      var t = p[1], r = i >> 3, c = i & 7;
      if (t === 'P') {
        var dir = me === 'w' ? -1 : 1, r1 = r + dir, start = me === 'w' ? 6 : 1, last = me === 'w' ? 0 : 7;
        if (r1 >= 0 && r1 < 8 && !b[r1 * 8 + c]) { add(i, r1 * 8 + c, r1 === last); if (r === start && !b[(r + 2 * dir) * 8 + c]) mv.push({ f: i, t: (r + 2 * dir) * 8 + c, dbl: 1 }); }
        for (var dc = -1; dc <= 1; dc += 2) { var cc = c + dc; if (cc < 0 || cc > 7 || r1 < 0 || r1 > 7) continue; var tt = r1 * 8 + cc; if (b[tt] && b[tt][0] === op) add(i, tt, r1 === last); else if (tt === s.ep) mv.push({ f: i, t: tt, ep: 1 }); }
      } else {
        var ds = DIRS[t], slide = t === 'B' || t === 'R' || t === 'Q';
        for (var k = 0; k < ds.length; k++) {
          var rr = r + ds[k][0], c2 = c + ds[k][1];
          while (rr >= 0 && rr < 8 && c2 >= 0 && c2 < 8) {
            var q = b[rr * 8 + c2];
            if (q) { if (q[0] === op) mv.push({ f: i, t: rr * 8 + c2 }); break; }
            mv.push({ f: i, t: rr * 8 + c2 });
            if (!slide) break; rr += ds[k][0]; c2 += ds[k][1];
          }
        }
        if (t === 'K') {
          var home = me === 'w' ? 60 : 4;
          if (i === home && !attacked(b, home, op)) {
            if (s.castle[me + 'K'] && !b[home + 1] && !b[home + 2] && b[home + 3] === me + 'R' && !attacked(b, home + 1, op) && !attacked(b, home + 2, op)) mv.push({ f: i, t: home + 2, cs: 'K' });
            if (s.castle[me + 'Q'] && !b[home - 1] && !b[home - 2] && !b[home - 3] && b[home - 4] === me + 'R' && !attacked(b, home - 1, op) && !attacked(b, home - 2, op)) mv.push({ f: i, t: home - 2, cs: 'Q' });
          }
        }
      }
    }
    function add(f, t, promo) { if (promo) ['Q', 'R', 'B', 'N'].forEach(function (pp) { mv.push({ f: f, t: t, pr: pp }); }); else mv.push({ f: f, t: t }); }
    return mv;
  }
  function make(s, m) {
    var n = clone(s), b = n.b, p = b[m.f], me = s.turn;
    var cap = b[m.t] || (m.ep ? (me === 'w' ? 'bP' : 'wP') : '');
    b[m.t] = m.pr ? me + m.pr : p; b[m.f] = '';
    if (m.ep) b[m.t + (me === 'w' ? 8 : -8)] = '';
    if (m.cs === 'K') { b[m.t - 1] = b[m.t + 1]; b[m.t + 1] = ''; }
    if (m.cs === 'Q') { b[m.t + 1] = b[m.t - 2]; b[m.t - 2] = ''; }
    n.ep = m.dbl ? (m.f + m.t) / 2 : -1;
    if (p[1] === 'K') { n.castle[me + 'K'] = 0; n.castle[me + 'Q'] = 0; }
    [[56, 'wQ'], [63, 'wK'], [0, 'bQ'], [7, 'bK']].forEach(function (z) { if (m.f === z[0] || m.t === z[0]) n.castle[z[1]] = 0; });
    n.half = (p[1] === 'P' || cap) ? 0 : s.half + 1;
    n.turn = me === 'w' ? 'b' : 'w';
    n.cap = cap;
    return n;
  }
  function legal(s) { var me = s.turn; return pseudo(s).filter(function (m) { var n = make(s, m); return !attacked(n.b, kingSq(n.b, me), n.turn); }); }
  function key(s) { return s.b.join(',') + s.turn + JSON.stringify(s.castle) + s.ep; }
  function insufficient(b) { var ps = b.filter(Boolean).filter(function (p) { return p[1] !== 'K'; }); return !ps.length || (ps.length === 1 && (ps[0][1] === 'N' || ps[0][1] === 'B')); }
  function evaluate(s) {
    var v = 0;
    for (var i = 0; i < 64; i++) { var p = s.b[i]; if (!p) continue; var t = p[1], sc = VAL[t] + PST[t][p[0] === 'w' ? i : (7 - (i >> 3)) * 8 + (i & 7)]; v += p[0] === 'w' ? sc : -sc; }
    return s.turn === 'w' ? v : -v;
  }
  var nodes = 0;
  function order(s, ms) { return ms.map(function (m) { var c = s.b[m.t]; return { m: m, k: (c ? VAL[c[1]] * 10 - VAL[s.b[m.f][1]] : 0) + (m.pr ? 800 : 0) }; }).sort(function (a, b) { return b.k - a.k; }).map(function (x) { return x.m; }); }
  function search(s, d, a, bb) {
    nodes++;
    if (d === 0) return quiet(s, a, bb, 3);
    var ms = legal(s);
    if (!ms.length) return inCheck(s, s.turn) ? -100000 - d : 0;
    ms = order(s, ms);
    for (var i = 0; i < ms.length; i++) { var v = -search(make(s, ms[i]), d - 1, -bb, -a); if (v >= bb) return bb; if (v > a) a = v; if (nodes > 250000) break; }
    return a;
  }
  function quiet(s, a, bb, d) {
    var st = evaluate(s); if (st >= bb) return bb; if (st > a) a = st; if (d === 0) return a;
    var ms = pseudo(s).filter(function (m) { return s.b[m.t] || m.pr === 'Q'; });
    ms = order(s, ms);
    for (var i = 0; i < ms.length; i++) { var n = make(s, ms[i]); if (attacked(n.b, kingSq(n.b, s.turn), n.turn)) continue; var v = -quiet(n, -bb, -a, d - 1); if (v >= bb) return bb; if (v > a) a = v; }
    return a;
  }
  function best(s) {
    var ms = legal(s).filter(function (m) { return !m.pr || m.pr === 'Q'; }); nodes = 0;
    if (api.level === 'easy') {
      // easy: looks one move ahead and often picks a reasonable but not best move
      var sc = ms.map(function (m) { return { m: m, v: -quiet(make(s, m), -1e9, 1e9, 1) + Math.random() * 160 }; }).sort(function (a, b) { return b.v - a.v; });
      return sc[Math.min(sc.length - 1, Math.floor(Math.random() * 3))].m;
    }
    var depth = api.level === 'hard' ? 4 : 3, bestM = ms[0], bestV = -1e9;
    ms = order(s, api.shuffle(ms)); bestM = ms[0];   // shuffled first, so equal moves vary from game to game
    for (var i = 0; i < ms.length; i++) { var v = -search(make(s, ms[i]), depth - 1, -1e9, -bestV); if (v > bestV) { bestV = v; bestM = ms[i]; } }
    return bestM;
  }

  if (window.WTG_DEBUG) window.__chess = { init: init, legal: legal, make: make, best: best, evaluate: evaluate, nodes: function () { return nodes; } };
  // ------------------------------------------------------------------ UI
  var mode = api.load('mode', 'cpu'), sel = -1, moves = [], last = null, hist = [], busy = false, over = false, flip = false;
  var bd = h('div', { class: 'bd', role: 'grid', 'aria-label': 'Chess board' }), sqs = [];
  for (var i = 0; i < 64; i++) { (function (i) { var b = h('button', { type: 'button', class: ((i >> 3) + (i & 7)) % 2 ? 'd' : 'l', onclick: function () { tap(i); } }); sqs.push(b); bd.append(b); })(i); }
  var st = h('div', { class: 'bd-st', 'aria-live': 'polite' });
  var modeSel = h('div', { class: 'bd-bar' },
    h('button', { type: 'button', class: 'g-btn sm' + (mode === 'cpu' ? ' blue' : ''), text: tx('cpu'), onclick: function () { setMode('cpu'); } }),
    h('button', { type: 'button', class: 'g-btn sm' + (mode === 'two' ? ' blue' : ''), text: tx('two'), onclick: function () { setMode('two'); } }),
    h('button', { type: 'button', class: 'g-btn sm', text: tx('undo'), onclick: undo }));
  var promoBar = h('div', { class: 'bd-bar', hidden: true });
  api.el.append(h('div', { class: 'bd-wrap' }, st, bd, promoBar, modeSel));
  function setMode(m) { if (busy) return; mode = m; api.save('mode', m); [].forEach.call(modeSel.children, function (b, i) { if (i < 2) b.classList.toggle('blue', (i === 0) === (m === 'cpu')); }); newGame(); }
  function newGame() { S = init(); sel = -1; last = null; hist = []; over = false; busy = false; S.reps = {}; S.reps[key(S)] = 1; api.save('pos', undefined); draw(); }
  function name(c) { return c === 'w' ? tx('white') : tx('black'); }
  function draw() {
    var chk = inCheck(S, S.turn) ? kingSq(S.b, S.turn) : -1;
    var tg = {}; moves.forEach(function (m) { tg[m.t] = 1; });
    for (var v = 0; v < 64; v++) {
      var i = flip ? 63 - v : v, b = sqs[v], p = S.b[i];
      b.className = ((i >> 3) + (i & 7)) % 2 ? 'd' : 'l';
      if (i === sel) b.classList.add('sel');
      if (last && (i === last.f || i === last.t)) b.classList.add('last');
      if (i === chk) b.classList.add('chk');
      if (tg[i]) { b.classList.add('can'); if (p) b.classList.add('cap'); }
      b.innerHTML = '';
      if (p) b.append(h('span', { class: p[0] === 'w' ? 'pw' : 'pb', text: G[p[1]] }));
      if ((i & 7) === 0) b.append(h('span', { class: 'co', text: String(8 - (i >> 3)) }));
      b.setAttribute('aria-label', 'abcdefgh'[i & 7] + (8 - (i >> 3)) + (p ? ' ' + (p[0] === 'w' ? 'white ' : 'black ') + { K: 'king', Q: 'queen', R: 'rook', B: 'bishop', N: 'knight', P: 'pawn' }[p[1]] : ''));
    }
    if (!over) st.textContent = busy ? tx('think') : (chk >= 0 ? tx('check') + ' ' : '') + tx('turn', name(S.turn));
  }
  function tap(v) {
    if (api.paused || busy || over) return;
    var i = flip ? 63 - v : v;
    if (mode === 'cpu' && S.turn !== 'w') return;
    var p = S.b[i];
    var ms = moves.filter(function (m) { return m.t === i; });
    if (sel >= 0 && ms.length) {
      if (ms.length > 1) return askPromo(ms);
      return play(ms[0]);
    }
    if (p && p[0] === S.turn) { sel = i; moves = legal(S).filter(function (m) { return m.f === i; }); api.sfx('tap'); }
    else { sel = -1; moves = []; }
    draw();
  }
  function askPromo(ms) {
    promoBar.innerHTML = ''; promoBar.hidden = false; promoBar.append(h('span', { text: tx('promo') }));
    ['Q', 'R', 'B', 'N'].forEach(function (pp) { promoBar.append(h('button', { type: 'button', class: 'g-btn', text: G[pp], onclick: function () { promoBar.hidden = true; play(ms.filter(function (m) { return m.pr === pp; })[0]); } })); });
  }
  function play(m) {
    hist.push(S); var cap = S.b[m.t] || m.ep;
    S = make(S, m); S.reps = Object.assign({}, hist[hist.length - 1].reps); var k = key(S); S.reps[k] = (S.reps[k] || 0) + 1;
    last = m; sel = -1; moves = [];
    api.sfx(cap ? 'hit' : 'move');
    if (m.cs) api.achieve('castle', { so: 'Qalcad (castling)', en: 'Castled' });
    if (m.pr) api.achieve('promo', { so: 'Askari la kordhiyay', en: 'Pawn promoted' });
    draw();
    if (checkEnd()) return;
    api.save('pos', { b: S.b, turn: S.turn, castle: S.castle, ep: S.ep, half: S.half, mode: mode });
    if (mode === 'cpu' && S.turn === 'b') {
      busy = true; draw();
      setTimeout(function () {
        if (over || api.isOver()) return;
        var bm = best(S); busy = false;
        if (bm) play(bm); else draw();
      }, 250);
    }
  }
  function checkEnd() {
    var ms = legal(S), res = null;
    if (!ms.length) res = inCheck(S, S.turn) ? 'mate' : 'stale';
    else if (S.half >= 100 || insufficient(S.b) || S.reps[key(S)] >= 3) res = 'draw';
    if (!res) return false;
    over = true; api.save('pos', undefined);
    var winner = S.turn === 'w' ? 'b' : 'w';
    var nMoves = Math.ceil(hist.length / 2);
    if (res === 'mate') {
      st.textContent = tx('mate', name(winner));
      var msg = { so: tx('mate', name(winner)), en: TX.en.mate.replace('{c}', winner === 'w' ? 'White' : 'Black') };
      if (mode === 'two' || winner === 'w') { var sc = mode === 'two' ? 300 : { easy: 500, medium: 1000, hard: 2000 }[api.level] + Math.max(0, 300 - nMoves * 5); if (mode === 'cpu') api.achieve('beat-' + api.level, { so: 'Ka adkaaday kombiyuutarka (' + api.s(api.level) + ')', en: 'Beat the computer (' + api.level + ')' }); api.win(sc, msg); }
      else api.lose(0, msg);
    } else { st.textContent = res === 'stale' ? tx('stale') : tx('draw'); api.end({ won: false, score: 150, msg: { so: st.textContent, en: res === 'stale' ? TX.en.stale : TX.en.draw } }); }
    return true;
  }
  function undo() {
    if (busy || over || !hist.length || api.paused) return;
    var n = mode === 'cpu' ? (S.turn === 'w' ? 2 : 1) : 1;
    while (n-- && hist.length) S = hist.pop();
    last = null; sel = -1; moves = []; draw();
  }
  return {
    start: function () {
      var sv = api.load('pos');
      newGame();
      if (api.first && sv && sv.b && sv.mode === mode) { S.b = sv.b; S.turn = sv.turn; S.castle = sv.castle; S.ep = sv.ep; S.half = sv.half; S.reps = {}; S.reps[key(S)] = 1; api.toast(api.s('saved')); draw(); if (mode === 'cpu' && S.turn === 'b') { busy = true; setTimeout(function () { busy = false; play(best(S)); }, 300); } }
    }
  };
});
