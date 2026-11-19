/* Tile Match: a layered tile-matching game (mahjong-solitaire style). Pick two identical tiles that are free:
   nothing on top and an open left or right side. Every layout is built so it can be solved. Original tiles. */
WTG.register('tiles', function (api) {
  var h = api.h;
  var SYM = ['🍎', '🍌', '🍇', '🍉', '🥕', '🌽', '🌙', '⭐', '☀️', '⚽', '🏀', '🐪', '🦁', '🐘', '🦒', '🐢', '🐟', '🦋', '🌵', '🌴', '🚗', '✈️', '⛵', '🔔', '🎈', '📚', '🎵', '💎', '🔑', '🧭'];
  var LAYERS = { easy: [[6, 6], [4, 4]], medium: [[8, 6], [6, 4], [4, 2]], hard: [[10, 6], [8, 4], [6, 2], [2, 2]] }[api.level];
  var tiles, sel, shuffles, hintT, el, root, pairsLeft, t0;
  var css = h('style', { text: '.tm{position:relative}.tm .t{position:absolute;width:var(--tw);height:var(--th);border-radius:10px;background:linear-gradient(160deg,#fffdf7,#efe7d1);box-shadow:3px 4px 0 #b59f6b,4px 6px 8px rgba(0,0,0,.35);display:grid;place-items:center;font-size:calc(var(--tw) * .62);cursor:pointer;border:2px solid #d9cba3;transition:transform .12s,opacity .2s;padding:0}.tm .t.free{border-color:#22c55e}.tm .t.lock{filter:brightness(.78)}.tm .t.sel{transform:translateY(-5px);background:#ffe8a3;border-color:#f59e0b}.tm .t.hint{animation:hb .6s 3}@keyframes hb{50%{transform:scale(1.12)}}' });
  function build() {
    for (var attempt = 0; attempt < 40; attempt++) {
      var pos = [];
      var W0 = LAYERS[0][0], H0 = LAYERS[0][1];
      LAYERS.forEach(function (L, l) { var ox = (W0 - L[0]) / 2, oy = (H0 - L[1]) / 2; for (var r = 0; r < L[1]; r++) for (var c = 0; c < L[0]; c++) pos.push({ l: l, r: r + oy, c: c + ox, gone: false }); });
      // assign pairs by removing free tiles in reverse: guarantees at least one solution
      var left = pos.slice(), ok = true, symI = 0, syms = api.shuffle(SYM);
      while (left.length) {
        var free = left.filter(function (p) { return isFree(p, left); });
        if (free.length < 2) { ok = false; break; }
        free = api.shuffle(free); var a = free[0], b = free[1], s = syms[symI++ % syms.length];
        a.s = s; b.s = s; left = left.filter(function (p) { return p !== a && p !== b; });
      }
      if (ok) return pos;
    }
    return pos;
  }
  function at(list, l, r, c) { for (var i = 0; i < list.length; i++) { var p = list[i]; if (!p.gone && p.l === l && p.r === r && p.c === c) return p; } return null; }
  function isFree(p, list) { list = list || tiles; if (at(list, p.l + 1, p.r, p.c)) return false; return !at(list, p.l, p.r, p.c - 1) || !at(list, p.l, p.r, p.c + 1); }
  function render() {
    api.el.innerHTML = ''; var W0 = LAYERS[0][0], H0 = LAYERS[0][1];
    var tw = 'min(calc((var(--w) - 40px) / ' + (W0 + 0.6) + '), calc((var(--h) - 90px) / ' + (H0 * 1.25 + 0.6) + '), 70px)';
    root = h('div', { class: 'tm', style: { '--tw': tw, '--th': 'calc(' + tw + ' * 1.25)', width: 'calc(' + tw + ' * ' + (W0 + 0.4) + ')', height: 'calc(' + tw + ' * ' + (H0 * 1.25 + 0.4) + ')' } });
    tiles.forEach(function (p, i) {
      if (p.gone) return;
      var b = h('button', { type: 'button', class: 't', text: p.s, 'aria-label': 'tile ' + p.s, style: { left: 'calc(var(--tw) * ' + p.c + ' - ' + p.l * 5 + 'px)', top: 'calc(var(--th) * ' + p.r + ' - ' + p.l * 5 + 'px)', zIndex: p.l * 100 + Math.round(p.r * 10) + Math.round(p.c) }, onclick: function () { pick(p); } });
      var f = isFree(p); b.classList.add(f ? 'free' : 'lock'); if (sel === p) b.classList.add('sel'); p.el = b; root.append(b);
    });
    var bar = h('div', { class: 'g-row', style: { marginTop: '12px' } }, h('button', { type: 'button', class: 'g-btn sm', text: '💡 ' + api.t({ so: 'Tilmaan', en: 'Hint' }), onclick: hint }), h('button', { type: 'button', class: 'g-btn sm', text: '🔀 ' + api.t({ so: 'Isku qas', en: 'Shuffle' }) + ' (' + shuffles + ')', onclick: shuffle }));
    api.el.append(css, h('div', { class: 'g-col' }, root, bar));
    api.info('🀄', pairsLeft);
  }
  function pick(p) {
    if (api.paused || p.gone) return;
    if (!isFree(p)) { api.sfx('bad'); p.el.animate([{ transform: 'translateX(-4px)' }, { transform: 'translateX(4px)' }, { transform: 'none' }], 200); return; }
    if (sel === p) { sel = null; render(); return; }
    if (sel && sel.s === p.s) { sel.gone = true; p.gone = true; sel = null; pairsLeft--; api.add(20); api.sfx('good'); render(); afterMove(); return; }
    sel = p; api.sfx('tap'); render();
  }
  function moves() { var f = tiles.filter(function (p) { return !p.gone && isFree(p); }), m = []; for (var i = 0; i < f.length; i++) for (var j = i + 1; j < f.length; j++) if (f[i].s === f[j].s) m.push([f[i], f[j]]); return m; }
  function afterMove() {
    if (!pairsLeft) { var secs = Math.round((Date.now() - t0) / 1000); api.achieve('clear-' + api.level, { so: 'Shaxda waa la nadiifiyay (' + api.s(api.level) + ')', en: 'Board cleared (' + api.level + ')' }); api.win(api.score + Math.max(0, 600 - secs) + shuffles * 50, { so: WTG.fmtTime(secs), en: WTG.fmtTime(secs) }); return; }
    if (!moves().length) { if (shuffles > 0) api.toast(api.t({ so: 'Dhaqdhaqaaq ma jiro: isku qas', en: 'No moves left: shuffle' }), 2500); else api.lose(api.score, { so: 'Dhaqdhaqaaq kale ma jiro', en: 'No more moves' }); }
  }
  function hint() { if (api.paused) return; var m = moves(); if (!m.length) return; api.add(-10); m[0].forEach(function (p) { p.el.classList.add('hint'); }); }
  function shuffle() {
    if (api.paused || shuffles <= 0) return; shuffles--;
    var live = tiles.filter(function (p) { return !p.gone; });
    // re-deal symbols so the remaining layout is solvable again
    var syms = live.map(function (p) { return p.s; }), counts = {}; syms.forEach(function (s) { counts[s] = (counts[s] || 0) + 1; });
    var pairs = []; Object.keys(counts).forEach(function (s) { for (var k = 0; k < counts[s] / 2; k++) pairs.push(s); });
    pairs = api.shuffle(pairs); var left = live.slice(), i = 0;
    while (left.length) { var free = api.shuffle(left.filter(function (p) { return isFree(p, left); })); if (free.length < 2) { live.forEach(function (p, k) { p.s = syms[k]; }); break; } free[0].s = pairs[i]; free[1].s = pairs[i]; i++; left = left.filter(function (p) { return p !== free[0] && p !== free[1]; }); }
    sel = null; api.sfx('pop'); render();
  }
  var pAt = 0;
  return {
    start: function () { tiles = build(); sel = null; shuffles = 3; pairsLeft = tiles.length / 2; t0 = Date.now(); render(); },
    pause: function () { pAt = Date.now(); }, resume: function () { if (pAt) t0 += Date.now() - pAt; pAt = 0; }
  };
});
