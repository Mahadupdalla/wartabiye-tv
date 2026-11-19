/* Sudoku: every row, column and 3×3 box holds 1–9 once. Each puzzle is generated here and has exactly one solution.
   Notes, hints, mistake checking and saved progress. Original implementation. */
WTG.register('sudoku', function (api) {
  var h = api.h;
  var CLUES = { easy: 40, medium: 32, hard: 26 }[api.level];
  var sol, puz, cur, notes, given, selI = -1, noteMode = false, hints, mistakes, t0, elapsed, timerId;
  var css = h('style', { text: '.sdk{--s:min(calc(var(--w) - 24px),calc(var(--h) - 150px),560px);display:flex;flex-direction:column;align-items:center;gap:10px}.sdk .g{display:grid;grid-template-columns:repeat(9,1fr);width:var(--s);height:var(--s);background:#04213f;border:3px solid #04213f;border-radius:10px;overflow:hidden;gap:1px}.sdk .g button{border:0;background:#fff;color:#037BDC;font:800 calc(var(--s) / 9 * .55)/1 Archivo,sans-serif;cursor:pointer;padding:0;position:relative}.sdk .g button.gv{color:#0b1c33}.sdk .g button.bR{margin-right:2px}.sdk .g button.bB{margin-bottom:2px}.sdk .g button.hl{background:#e8f1fb}.sdk .g button.same{background:#cfe3f8}.sdk .g button.sel{background:#ffd166}.sdk .g button.bad{color:#dc2626;background:#fee2e2}.sdk .g .nt{position:absolute;inset:2px;display:grid;grid-template-columns:repeat(3,1fr);font-size:calc(var(--s) / 9 * .22);color:#64748b;font-weight:700}.sdk .pad{display:grid;grid-template-columns:repeat(9,1fr);gap:6px;width:var(--s)}.sdk .pad button{padding:10px 0;font-size:20px;min-width:0}.sdk .tools{display:flex;gap:6px;flex-wrap:wrap;justify-content:center}' });
  var root = h('div', { class: 'sdk' }), grid = h('div', { class: 'g', role: 'grid', 'aria-label': 'Sudoku' }), pad = h('div', { class: 'pad' }), cells = [];
  for (var i = 0; i < 81; i++) (function (i) { var r = Math.floor(i / 9), c = i % 9; var b = h('button', { type: 'button', class: (c === 2 || c === 5 ? 'bR ' : '') + (r === 2 || r === 5 ? 'bB' : ''), onclick: function () { selI = i; api.sfx('tap'); render(); } }); cells.push(b); grid.append(b); })(i);
  for (var n = 1; n <= 9; n++) (function (n) { pad.append(h('button', { type: 'button', class: 'g-btn', text: String(n), onclick: function () { input(n); } })); })(n);
  var noteBtn = h('button', { type: 'button', class: 'g-btn sm', text: '✎ Notes', onclick: function () { noteMode = !noteMode; noteBtn.classList.toggle('blue', noteMode); } });
  var hintBtn = h('button', { type: 'button', class: 'g-btn sm', onclick: hint });
  var tools = h('div', { class: 'tools' }, noteBtn, h('button', { type: 'button', class: 'g-btn sm', text: '⌫', 'aria-label': 'Erase', onclick: function () { input(0); } }), hintBtn);
  root.append(grid, pad, tools); api.el.append(css, root);

  function ok(g, i, v) { var r = Math.floor(i / 9), c = i % 9, br = r - r % 3, bc = c - c % 3; for (var k = 0; k < 9; k++) { if (g[r * 9 + k] === v || g[k * 9 + c] === v || g[(br + Math.floor(k / 3)) * 9 + bc + k % 3] === v) return false; } return true; }
  function fill(g) { var i = g.indexOf(0); if (i < 0) return true; var vs = api.shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]); for (var k = 0; k < 9; k++) { if (ok(g, i, vs[k])) { g[i] = vs[k]; if (fill(g)) return true; g[i] = 0; } } return false; }
  function count(g, lim) {
    var best = -1, bestN = 10;
    for (var i = 0; i < 81; i++) if (!g[i]) { var n = 0; for (var v = 1; v <= 9; v++) if (ok(g, i, v)) n++; if (n < bestN) { bestN = n; best = i; if (n <= 1) break; } }
    if (best < 0) return 1; var tot = 0;
    for (v = 1; v <= 9 && tot < lim; v++) if (ok(g, best, v)) { g[best] = v; tot += count(g, lim - tot); g[best] = 0; }
    return tot;
  }
  function generate() {
    var g = []; for (var i = 0; i < 81; i++) g.push(0); fill(g); sol = g.slice();
    var p = g.slice(), order = api.shuffle(Array.from({ length: 81 }, function (_, k) { return k; })), left = 81;
    for (var k = 0; k < 81 && left > CLUES; k++) { var j = order[k], keep = p[j]; p[j] = 0; if (count(p.slice(), 2) !== 1) p[j] = keep; else left--; }
    puz = p;
  }
  function render() {
    var sv = selI >= 0 ? cur[selI] : 0, sr = Math.floor(selI / 9), sc = selI % 9;
    for (var i = 0; i < 81; i++) {
      var b = cells[i], r = Math.floor(i / 9), c = i % 9, v = cur[i];
      b.classList.toggle('gv', given[i]); b.classList.toggle('sel', i === selI);
      b.classList.toggle('hl', selI >= 0 && i !== selI && (r === sr || c === sc || (Math.floor(r / 3) === Math.floor(sr / 3) && Math.floor(c / 3) === Math.floor(sc / 3))));
      b.classList.toggle('same', !!sv && v === sv && i !== selI);
      b.classList.toggle('bad', !!v && !given[i] && v !== sol[i] && (api.cfg('errors', 'auto') === 'auto' ? api.level !== 'hard' : api.cfg('errors') === 'on'));
      b.innerHTML = '';
      if (v) b.textContent = v; else if (notes[i].length) { var nt = h('span', { class: 'nt' }); for (var q = 1; q <= 9; q++) nt.append(h('span', { text: notes[i].indexOf(q) >= 0 ? String(q) : '' })); b.append(nt); }
      b.setAttribute('aria-label', 'row ' + (r + 1) + ' column ' + (c + 1) + (v ? ': ' + v : ': empty'));
    }
    hintBtn.textContent = '💡 ' + hints;
    // numbers already used 9 times fade out
    [].forEach.call(pad.children, function (b, k) { var n = k + 1; b.disabled = cur.filter(function (x, j) { return x === n && x === sol[j]; }).length >= 9; });
  }
  function input(n) {
    if (api.paused || selI < 0 || given[selI]) return;
    if (noteMode && n) { var a = notes[selI], k = a.indexOf(n); if (k >= 0) a.splice(k, 1); else a.push(n); cur[selI] = 0; render(); save(); return; }
    cur[selI] = n; notes[selI] = [];
    if (n && n !== sol[selI]) { mistakes++; api.info('✗', mistakes); api.sfx('bad'); if (api.level === 'hard' && mistakes >= 5) { render(); api.save('s', undefined); api.lose(0, { so: '5 khalad', en: '5 mistakes' }); return; } }
    else if (n) { api.sfx('good'); var r = Math.floor(selI / 9), c = selI % 9; for (var j = 0; j < 9; j++) { [r * 9 + j, j * 9 + c].forEach(function (q) { var x = notes[q].indexOf(n); if (x >= 0) notes[q].splice(x, 1); }); } }
    render(); save(); done();
  }
  function hint() { if (api.paused || !hints) return; var empty = []; for (var i = 0; i < 81; i++) if (cur[i] !== sol[i]) empty.push(i); if (!empty.length) return; var i2 = selI >= 0 && cur[selI] !== sol[selI] ? selI : api.pick(empty); cur[i2] = sol[i2]; given[i2] = true; hints--; selI = i2; api.sfx('pop'); render(); save(); done(); }
  function done() {
    if (cur.some(function (v, i) { return v !== sol[i]; })) return;
    clearInterval(timerId); api.save('s', undefined);
    var secs = Math.round(elapsed()), base = { easy: 500, medium: 1000, hard: 2000 }[api.level];
    var sc = Math.max(100, base - secs + (3 - (3 - hints)) * 50 - mistakes * 20);
    if (!mistakes) api.achieve('clean-' + api.level, { so: 'Khalad la\'aan (' + api.s(api.level) + ')', en: 'No mistakes (' + api.level + ')' });
    api.win(sc, { so: 'Waqtiga: ' + WTG.fmtTime(secs), en: 'Time: ' + WTG.fmtTime(secs) });
  }
  function save() { api.save('s', { lv: api.level, sol: sol, puz: puz, cur: cur, notes: notes, given: given, hints: hints, mistakes: mistakes, t: elapsed() }); }
  var paused = 0, pauseAt = 0;
  return {
    start: function () {
      var sv = api.load('s');
      if (api.first && sv && sv.lv === api.level && sv.sol) { sol = sv.sol; puz = sv.puz; cur = sv.cur; notes = sv.notes; given = sv.given; hints = sv.hints; mistakes = sv.mistakes; t0 = Date.now() - sv.t * 1000; api.toast(api.s('saved')); }
      else { generate(); cur = puz.slice(); notes = cur.map(function () { return []; }); given = cur.map(function (v) { return !!v; }); hints = 3; mistakes = 0; t0 = Date.now(); }
      paused = 0; elapsed = function () { return (Date.now() - t0 - paused) / 1000; };
      api.info('⏱', WTG.fmtTime(elapsed()));
      timerId = setInterval(function () { if (!api.paused) api.info('⏱', WTG.fmtTime(elapsed())); }, 1000);
      selI = -1; render();
    },
    pause: function () { pauseAt = Date.now(); },
    resume: function () { if (pauseAt) paused += Date.now() - pauseAt; pauseAt = 0; },
    destroy: function () { clearInterval(timerId); },
    key: function (e, down) {
      if (!down) return; var k = e.key;
      if (/^[1-9]$/.test(k)) { input(+k); e.preventDefault(); } else if (k === 'Backspace' || k === 'Delete' || k === '0') { input(0); e.preventDefault(); }
      else if (k === 'n') { noteBtn.click(); }
      else if (/^Arrow/.test(k)) { if (selI < 0) selI = 0; else selI = k === 'ArrowUp' ? (selI + 72) % 81 : k === 'ArrowDown' ? (selI + 9) % 81 : k === 'ArrowLeft' ? (selI + 80) % 81 : (selI + 1) % 81; render(); e.preventDefault(); }
    }
  };
});
