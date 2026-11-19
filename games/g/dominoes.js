/* Dominoes (double-six, draw game) against the computer. Match a tile to either end of the line; draw from the pile
   when you cannot play. First to empty their hand wins the round. Original implementation. */
WTG.register('dominoes', function (api) {
  var h = api.h;
  var TX = { so: { you: 'Adiga', cpu: 'Kombiyuutar', draw: 'Ka qaado kaydka ({n})', pass: 'Gudub', left: '◀ Bidix', right: 'Midig ▶', yourTurn: 'Waa kaa: dooro dhagax ku habboon', cpuTurn: 'Kombiyuutarku wuu ciyaarayaa…', roundW: 'Wareegga waad ku guuleysatay! +{n}', roundL: 'Kombiyuutarka ayaa wareegga qaatay. +{n}', blocked: 'Ciyaartu way xirantay', target: 'Ciyaarta: {n} dhibcood', next: 'Wareegga xiga', start: 'Dhagax kasta waa la dhigi karaa' },
    en: { you: 'You', cpu: 'Computer', draw: 'Draw from pile ({n})', pass: 'Pass', left: '◀ Left', right: 'Right ▶', yourTurn: 'Your turn: pick a matching tile', cpuTurn: 'Computer is playing…', roundW: 'You won the round! +{n}', roundL: 'Computer won the round. +{n}', blocked: 'Blocked game', target: 'Match to {n} points', next: 'Next round', start: 'Play any tile to start' } };
  function tx(k, n) { var s = (TX[api.lang] || TX.en)[k] || TX.en[k]; return n != null ? s.replace('{n}', n) : s; }
  var TARGET = api.cfg('target', { easy: 50, medium: 100, hard: 150 }[api.level]), TB = { green: ['#166534', '#14532d'], blue: ['#1e3a8a', '#172554'], red: ['#7f1d1d', '#450a0a'], wood: ['#78350f', '#451a03'] }[api.cfg('table', 'green')] || ['#166534', '#14532d'];
  var hand, cpu, pile, line, ends, turn, picked, myPts, cpuPts, busy, roundOver;
  var PIPS = { 0: [], 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
  function half(n) { var g = h('span', { class: 'dh' }); for (var i = 0; i < 9; i++) g.append(h('i', { class: PIPS[n].indexOf(i) >= 0 ? 'on' : '' })); return g; }
  function tileEl(t, vertical, cls) { return h('span', { class: 'dt' + (vertical ? ' v' : '') + (cls ? ' ' + cls : ''), 'aria-label': t[0] + ' | ' + t[1] }, half(t[0]), h('b'), half(t[1])); }
  var css = h('style', { text: '.dt{display:inline-flex;align-items:center;background:#fffdf5;border-radius:8px;padding:3px;gap:2px;box-shadow:0 3px 0 #c9c2a8,0 4px 10px rgba(0,0,0,.3);vertical-align:middle}.dt.v{flex-direction:column}.dt b{width:2px;height:80%;background:#b9b29a}.dt.v b{height:2px;width:80%}.dh{display:grid;grid-template-columns:repeat(3,1fr);gap:2px;width:var(--ts,34px);height:var(--ts,34px);padding:3px}.dh i{border-radius:50%}.dh i.on{background:#0b1c33}.dt.back{background:linear-gradient(135deg,#037BDC,#04213f)}.dt.back .dh i.on{background:transparent}.dt.can{cursor:pointer;outline:3px solid #22c55e;outline-offset:2px}.dt.pick{transform:translateY(-8px);outline-color:#ffb703}.dt.no{opacity:.45}.dline{display:flex;flex-wrap:wrap;gap:4px;justify-content:center;align-items:center;max-height:calc(var(--h) * .45);overflow:auto;padding:12px;background:' + TB[0] + ';border-radius:16px;box-shadow:inset 0 0 0 4px ' + TB[1] + ';width:min(100%,860px);min-height:110px;--ts:22px}.dhand{display:flex;flex-wrap:wrap;gap:8px;justify-content:center}.dcpu{display:flex;flex-wrap:wrap;gap:3px;justify-content:center;--ts:12px}' });
  var cpuEl = h('div', { class: 'dcpu' }), lineEl = h('div', { class: 'dline' }), handEl = h('div', { class: 'dhand' }), st = h('div', { class: 'bd-st', 'aria-live': 'polite' }), sc = h('div', { class: 'g-note' });
  var acts = h('div', { class: 'g-row' });
  api.el.append(css, h('div', { class: 'g-col', style: { justifyContent: 'center' } }, sc, cpuEl, lineEl, st, handEl, acts));
  function deal() {
    var all = []; for (var a = 0; a <= 6; a++) for (var b = a; b <= 6; b++) all.push([a, b]);
    all = api.shuffle(all); hand = all.slice(0, 7); cpu = all.slice(7, 14); pile = all.slice(14);
    line = []; ends = null; picked = -1; roundOver = false; busy = false;
    // highest double starts; otherwise you start
    var best = -1, who = 'me'; [[hand, 'me'], [cpu, 'cpu']].forEach(function (z) { z[0].forEach(function (t) { if (t[0] === t[1] && t[0] > best) { best = t[0]; who = z[1]; } }); });
    turn = who; render(); if (turn === 'cpu') cpuMove();
  }
  function fits(t) { if (!ends) return ['L']; var o = []; if (t[0] === ends[0] || t[1] === ends[0]) o.push('L'); if (t[0] === ends[1] || t[1] === ends[1]) o.push('R'); return o; }
  function place(t, side) {
    if (!ends) { line.push({ t: t, d: t[0] === t[1] }); ends = [t[0], t[1]]; return; }
    if (side === 'L') { var e = ends[0], o = t[0] === e ? [t[1], t[0]] : [t[0], t[1]]; line.unshift({ t: o, d: t[0] === t[1] }); ends[0] = o[0]; }
    else { e = ends[1]; o = t[0] === e ? [t[0], t[1]] : [t[1], t[0]]; line.push({ t: o, d: t[0] === t[1] }); ends[1] = o[1]; }
  }
  function render() {
    sc.textContent = tx('you') + ' ' + myPts + ' · ' + tx('cpu') + ' ' + cpuPts + ' · ' + tx('target', TARGET);
    cpuEl.innerHTML = ''; cpu.forEach(function () { cpuEl.append(tileEl([0, 0], true, 'back')); });
    lineEl.innerHTML = ''; line.forEach(function (l) { lineEl.append(tileEl(l.t, l.d)); });
    handEl.innerHTML = ''; acts.innerHTML = '';
    var mine = turn === 'me' && !busy && !roundOver, any = false;
    hand.forEach(function (t, i) {
      var f = fits(t), el = tileEl(t, true, mine ? (f.length ? 'can' + (i === picked ? ' pick' : '') : 'no') : '');
      if (f.length && mine) { any = true; el.setAttribute('role', 'button'); el.tabIndex = 0; el.addEventListener('click', function () { choose(i); }); el.addEventListener('keydown', function (e) { if (e.key === 'Enter') choose(i); }); }
      handEl.append(el);
    });
    if (mine && picked >= 0) { var f2 = fits(hand[picked]); if (f2.length === 2 && ends[0] !== ends[1]) { acts.append(h('button', { type: 'button', class: 'g-btn sm blue', text: tx('left'), onclick: function () { playMine('L'); } }), h('button', { type: 'button', class: 'g-btn sm blue', text: tx('right'), onclick: function () { playMine('R'); } })); } }
    if (mine && !any) { if (pile.length) acts.append(h('button', { type: 'button', class: 'g-btn sm', text: tx('draw', pile.length), onclick: drawTile })); else acts.append(h('button', { type: 'button', class: 'g-btn sm', text: tx('pass'), onclick: function () { turn = 'cpu'; render(); cpuMove(); } })); }
    if (!roundOver) st.textContent = turn === 'me' ? (ends ? tx('yourTurn') : tx('start')) : tx('cpuTurn');
  }
  function choose(i) { if (api.paused || turn !== 'me' || busy) return; picked = i; var f = fits(hand[i]); api.sfx('tap'); if (f.length === 1 || (ends && ends[0] === ends[1])) playMine(f[0]); else render(); }
  function playMine(side) { var t = hand.splice(picked, 1)[0]; picked = -1; place(t, side); api.sfx('move'); if (!hand.length) return endRound('me'); turn = 'cpu'; render(); cpuMove(); }
  function drawTile() { if (api.paused || !pile.length) return; hand.push(pile.pop()); api.sfx('tick'); render(); }
  function cpuMove() {
    busy = true; render();
    setTimeout(function step() {
      if (api.isOver() || roundOver) return;
      if (api.paused) { setTimeout(step, 400); return; }
      var opts = []; cpu.forEach(function (t, i) { fits(t).forEach(function (s) { opts.push({ i: i, s: s, v: t[0] + t[1] + (t[0] === t[1] ? 4 : 0) }); }); });
      if (!opts.length) {
        if (pile.length) { cpu.push(pile.pop()); api.sfx('tick'); render(); setTimeout(step, 350); return; }
        busy = false; if (blocked()) return; turn = 'me'; render(); return;
      }
      var o = api.level === 'easy' ? api.pick(opts) : opts.sort(function (a, b) { return b.v - a.v; })[0];
      place(cpu.splice(o.i, 1)[0], o.s); api.sfx('move'); busy = false;
      if (!cpu.length) return endRound('cpu');
      turn = 'me'; render();
      if (!hand.some(function (t) { return fits(t).length; }) && !pile.length) blocked();
    }, 700);
  }
  function pips(a) { return a.reduce(function (s, t) { return s + t[0] + t[1]; }, 0); }
  function blocked() {
    var canMe = hand.some(function (t) { return fits(t).length; }), canCpu = cpu.some(function (t) { return fits(t).length; });
    if (canMe || canCpu || pile.length) return false;
    st.textContent = tx('blocked'); endRound(pips(hand) <= pips(cpu) ? 'me' : 'cpu'); return true;
  }
  function endRound(w) {
    roundOver = true; busy = false;
    var pts = w === 'me' ? pips(cpu) : pips(hand); if (w === 'me') { myPts += pts; api.add(pts); } else cpuPts += pts;
    api.sfx(w === 'me' ? 'good' : 'bad');
    render(); st.textContent = w === 'me' ? tx('roundW', pts) : tx('roundL', pts);
    cpuEl.innerHTML = ''; cpu.forEach(function (t) { cpuEl.append(tileEl(t, true)); });
    if (myPts >= TARGET || cpuPts >= TARGET) {
      var msg = { so: myPts + ' – ' + cpuPts, en: myPts + ' – ' + cpuPts };
      setTimeout(function () { if (myPts >= TARGET) { api.achieve('match', { so: 'Ciyaar domino ah ayaad ku guuleysatay', en: 'Won a dominoes match' }); api.win(myPts, msg); } else api.lose(myPts, msg); }, 900);
      return;
    }
    acts.innerHTML = ''; acts.append(h('button', { type: 'button', class: 'g-btn blue', text: tx('next'), onclick: deal }));
  }
  return { start: function () { myPts = 0; cpuPts = 0; deal(); } };
});
