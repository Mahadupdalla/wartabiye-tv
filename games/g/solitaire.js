/* Solitaire (Klondike patience). Tap a card, then tap where it should go. Tapping a selected card again sends it
   to the foundation when it can go there. Easy and Medium turn one card from the stock, Hard turns three. Original implementation. */
WTG.register('solitaire', function (api) {
  var h = api.h, SU = ['♠', '♥', '♦', '♣'], RK = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
  var draw3 = api.level === 'hard';
  var css = h('style', { text: '.sol{--cw:min(calc((var(--w) - 40px) / 7.4),96px);--chh:calc(var(--cw) * 1.4);width:calc(var(--cw) * 7 + 48px);display:flex;flex-direction:column;gap:12px;height:100%}.sol .top,.sol .tab{display:grid;grid-template-columns:repeat(7,var(--cw));gap:8px}.sol .tab{flex:1;overflow:auto;padding-bottom:20px;align-items:start}.sol .slot{width:var(--cw);height:var(--chh);border-radius:8px;border:2px dashed rgba(255,255,255,.3);position:relative;display:grid;place-items:center;color:rgba(255,255,255,.35);font-size:calc(var(--cw) * .4);cursor:pointer}.sol .col{position:relative;min-height:var(--chh);cursor:pointer}.sol .cd{position:absolute;left:0;width:var(--cw);height:var(--chh);border-radius:8px;background:#fff;box-shadow:0 2px 4px rgba(0,0,0,.35);color:#0b1c33;font-weight:800;font-size:calc(var(--cw) * .26);line-height:1;padding:4px;cursor:pointer;user-select:none;border:1px solid #cbd5e1}.sol .cd.red{color:#c1121f}.sol .cd .big{position:absolute;right:5px;bottom:4px;font-size:calc(var(--cw) * .5)}.sol .cd.down{background:repeating-linear-gradient(45deg,#037BDC 0 6px,#0263b3 6px 12px);border:2px solid #fff}.sol .cd.down *{display:none}.sol .cd.sel{outline:3px solid #ffb703;outline-offset:1px;z-index:5}.sol .slot .cd{top:0}.sol .bar{display:flex;gap:8px;justify-content:center}' });
  var deck, stock, waste, found, tab, sel, moves, undo, won;
  var root = h('div', { class: 'sol' }), top = h('div', { class: 'top' }), tabEl = h('div', { class: 'tab' });
  var bar = h('div', { class: 'bar' }, h('button', { type: 'button', class: 'g-btn sm', text: '↶', 'aria-label': 'Undo', onclick: doUndo }), h('button', { type: 'button', class: 'g-btn sm', text: '⚡ Auto', onclick: autoAll }));
  root.append(top, tabEl, bar); api.el.append(css, root);
  function red(c) { return c.s === 1 || c.s === 2; }
  function deal() {
    deck = []; for (var s = 0; s < 4; s++) for (var r = 0; r < 13; r++) deck.push({ s: s, r: r, up: false });
    deck = api.shuffle(deck); tab = []; for (var i = 0; i < 7; i++) { tab.push([]); for (var j = 0; j <= i; j++) { var c = deck.pop(); c.up = j === i; tab[i].push(c); } }
    stock = deck; waste = []; found = [[], [], [], []]; sel = null; moves = 0; undo = []; won = false;
  }
  function snap() { undo.push(JSON.stringify({ stock: stock, waste: waste, found: found, tab: tab, score: api.score })); if (undo.length > 60) undo.shift(); }
  function doUndo() { if (api.paused || !undo.length) return; var u = JSON.parse(undo.pop()); stock = u.stock; waste = u.waste; found = u.found; tab = u.tab; api.setScore(u.score); sel = null; render(); }
  function canFound(c, f) { var p = found[f]; return c.s === f && (p.length ? p[p.length - 1].r === c.r - 1 : c.r === 0); }
  function canTab(c, col) { var t = tab[col]; if (!t.length) return c.r === 12; var l = t[t.length - 1]; return l.up && red(l) !== red(c) && l.r === c.r + 1; }
  function cardsAt(src) { if (src.from === 'w') return [waste[waste.length - 1]]; if (src.from === 'f') return [found[src.i][found[src.i].length - 1]]; return tab[src.i].slice(src.j); }
  function remove(src) { if (src.from === 'w') waste.pop(); else if (src.from === 'f') found[src.i].pop(); else { tab[src.i].splice(src.j); var t = tab[src.i]; if (t.length && !t[t.length - 1].up) { t[t.length - 1].up = true; api.add(5); } } }
  function tryMove(src, dst) {
    var cs = cardsAt(src); if (!cs.length || !cs[0]) return false;
    if (dst.to === 'f') { if (cs.length !== 1 || !canFound(cs[0], dst.i)) return false; snap(); remove(src); found[dst.i].push(cs[0]); api.add(src.from === 'f' ? 0 : 10); }
    else { if (dst.i === src.i && src.from === 't') return false; if (!canTab(cs[0], dst.i)) return false; snap(); remove(src); if (src.from === 'f') api.add(-15); else if (src.from === 'w') api.add(5); tab[dst.i] = tab[dst.i].concat(cs); }
    moves++; api.sfx('move'); check(); return true;
  }
  function toFoundation(src) { var cs = cardsAt(src); if (cs.length !== 1) return false; for (var f = 0; f < 4; f++) if (canFound(cs[0], f)) return tryMove(src, { to: 'f', i: f }); return false; }
  function anywhere(src) { if (toFoundation(src)) return true; var cs = cardsAt(src); for (var i = 0; i < 7; i++) if (canTab(cs[0], i) && !(src.from === 't' && src.i === i)) { if (!tab[i].length && src.from === 't' && src.j === 0) continue; return tryMove(src, { to: 't', i: i }); } return false; }
  function check() {
    if (found.every(function (f) { return f.length === 13; })) { won = true; render(); var bonus = Math.max(0, 700 - moves * 2); api.achieve('clear', { so: 'Solitaire waa la dhammeeyay', en: 'Solitaire cleared' }); api.win(api.score + bonus); }
  }
  function autoAll() { if (api.paused) return; var again = true, n = 0; while (again && n++ < 200) { again = false; if (waste.length && toFoundation({ from: 'w' })) again = true; for (var i = 0; i < 7 && !won; i++) if (tab[i].length && toFoundation({ from: 't', i: i, j: tab[i].length - 1 })) again = true; } sel = null; render(); }
  function drawStock() {
    if (api.paused) return; snap(); sel = null;
    if (!stock.length) { stock = waste.reverse().map(function (c) { c.up = false; return c; }); waste = []; if (draw3) api.add(-20); else api.add(-50); }
    else { for (var k = 0; k < (draw3 ? 3 : 1) && stock.length; k++) { var c = stock.pop(); c.up = true; waste.push(c); } }
    api.sfx('tick'); render();
  }
  function clickCard(src, e) {
    e.stopPropagation(); if (api.paused || won) return;
    if (sel) {
      if (sel.from === src.from && sel.i === src.i && sel.j === src.j) { var s0 = sel; sel = null; if (!toFoundation(s0)) anywhere(s0); render(); return; }
      if (src.from === 't' && tryMove(sel, { to: 't', i: src.i })) { sel = null; render(); return; }
      if (src.from === 'f' && tryMove(sel, { to: 'f', i: src.i })) { sel = null; render(); return; }
    }
    sel = src; api.sfx('tap'); render();
  }
  function cardEl(c, src, topPx) {
    var el = h('div', { class: 'cd' + (c.up ? '' : ' down') + (red(c) ? ' red' : ''), style: { top: topPx }, role: 'button', tabindex: c.up ? '0' : '-1', 'aria-label': c.up ? RK[c.r] + ' ' + ['spades', 'hearts', 'diamonds', 'clubs'][c.s] : 'face-down card' },
      h('div', { text: RK[c.r] + SU[c.s] }), h('div', { class: 'big', text: SU[c.s] }));
    if (c.up && src) { el.addEventListener('click', function (e) { clickCard(src, e); }); el.addEventListener('keydown', function (e) { if (e.key === 'Enter') clickCard(src, e); }); el.addEventListener('dblclick', function (e) { e.stopPropagation(); sel = null; anywhere(src); render(); }); }
    return el;
  }
  function render() {
    top.innerHTML = ''; tabEl.innerHTML = '';
    var st = h('div', { class: 'slot', role: 'button', 'aria-label': 'stock', onclick: drawStock, text: '↻' });
    if (stock.length) st.append(cardEl(stock[stock.length - 1], null, '0'));
    var ws = h('div', { class: 'slot', style: { borderStyle: 'solid', borderColor: 'transparent' } });
    var show = waste.slice(draw3 ? -3 : -1);
    show.forEach(function (c, k) { var isTop = k === show.length - 1, el = cardEl(c, isTop ? { from: 'w' } : null, '0'); el.style.left = (k * 14) + 'px'; if (isTop && sel && sel.from === 'w') el.classList.add('sel'); ws.append(el); });
    top.append(st, ws, h('div'));
    found.forEach(function (f, i) {
      var sl = h('div', { class: 'slot', text: SU[i], onclick: function () { if (sel && tryMove(sel, { to: 'f', i: i })) { sel = null; render(); } } });
      if (f.length) { var el = cardEl(f[f.length - 1], { from: 'f', i: i }, '0'); if (sel && sel.from === 'f' && sel.i === i) el.classList.add('sel'); sl.append(el); }
      top.append(sl);
    });
    tab.forEach(function (col, i) {
      var y = 0, c = h('div', { class: 'col', onclick: function () { if (sel && tryMove(sel, { to: 't', i: i })) { sel = null; render(); } else if (sel) { sel = null; render(); } } });
      if (!col.length) c.append(h('div', { class: 'slot', text: 'K' }));
      col.forEach(function (card, j) {
        var el = cardEl(card, { from: 't', i: i, j: j }, 'calc(var(--cw) * ' + y.toFixed(2) + ')');
        if (sel && sel.from === 't' && sel.i === i && j >= sel.j) el.classList.add('sel');
        c.append(el); y += card.up ? 0.36 : 0.18;
      });
      c.style.height = 'calc(var(--cw) * ' + (y + 1.4).toFixed(2) + ')';
      tabEl.append(c);
    });
  }
  return {
    start: function () { deal(); api.setScore(0); render(); },
    key: function (e, down) { if (!down) return; if (e.key === ' ') { e.preventDefault(); drawStock(); } else if (e.key === 'u' || (e.key === 'z' && (e.ctrlKey || e.metaKey))) { e.preventDefault(); doUndo(); } }
  };
});
