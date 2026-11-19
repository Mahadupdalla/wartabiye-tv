/* Shape Sorter: drag each coloured shape onto its matching outline (or tap a shape, then tap the outline).
   3 rounds; more shapes on harder levels. Original implementation. */
WTG.register('shapes', function (api) {
  var h = api.h, SO = api.lang === 'so';
  var SH = {
    circle: ['<circle cx="50" cy="50" r="42"/>', SO ? 'Goobo' : 'Circle'], square: ['<rect x="10" y="10" width="80" height="80" rx="6"/>', SO ? 'Afargeesle' : 'Square'],
    triangle: ['<path d="M50 8 94 90H6z"/>', SO ? 'Saddexagal' : 'Triangle'], star: ['<path d="M50 6l12.5 28 30.5 3-23 20.5 7 30L50 72 23 87.5l7-30L7 37l30.5-3z"/>', SO ? 'Xiddig' : 'Star'],
    heart: ['<path d="M50 88S8 62 8 34A20 20 0 0 1 50 24a20 20 0 0 1 42 10c0 28-42 54-42 54z"/>', SO ? 'Wadne' : 'Heart'], hexagon: ['<path d="M28 8h44l22 42-22 42H28L6 50z"/>', SO ? 'Lixgeesle' : 'Hexagon'],
    diamond: ['<path d="M50 4l42 46-42 46L8 50z"/>', SO ? 'Dheeman' : 'Diamond'], moon: ['<path d="M64 8a42 42 0 1 0 28 64A34 34 0 0 1 64 8z"/>', SO ? 'Bil' : 'Moon']
  };
  var COL = ['#ef4444', '#3b82f6', '#22c55e', '#eab308', '#a855f7', '#f97316', '#ec4899', '#14b8a6'];
  var n = api.cfg('n', { easy: 3, medium: 4, hard: 6 }[api.level]), ROUNDS = api.cfg('rounds', 3), round, placed, mistakes, picked = null;
  var css = h('style', { text: '.ss{display:flex;flex-direction:column;align-items:center;gap:18px;width:min(100%,760px)}.ss .row{display:flex;flex-wrap:wrap;gap:14px;justify-content:center;min-height:clamp(70px,14vmin,110px)}.ss .sh{width:clamp(64px,13vmin,104px);height:clamp(64px,13vmin,104px);touch-action:none;cursor:grab;filter:drop-shadow(0 6px 6px rgba(0,0,0,.35));transition:transform .15s}.ss .sh.sel{transform:scale(1.15)}.ss .sh svg,.ss .ho svg{width:100%;height:100%}.ss .ho{width:clamp(70px,14vmin,112px);height:clamp(70px,14vmin,112px);border-radius:18px;background:rgba(255,255,255,.08);padding:4px}.ss .ho svg *{fill:rgba(255,255,255,.12);stroke:rgba(255,255,255,.7);stroke-width:4;stroke-dasharray:8 6}.ss .ho.done svg *{stroke:none;stroke-dasharray:none}' });
  function svg(k, fill) { return '<svg viewBox="0 0 100 100" aria-hidden="true">' + SH[k][0].replace('/>', ' fill="' + fill + '"/>') + '</svg>'; }
  function show() {
    api.el.innerHTML = ''; placed = 0; picked = null;
    var keys = api.shuffle(Object.keys(SH)).slice(0, n), holes = h('div', { class: 'row' }), pieces = h('div', { class: 'row' });
    keys.forEach(function (k) { var ho = h('div', { class: 'ho', 'data-k': k, html: svg(k, 'none'), role: 'button', 'aria-label': SH[k][1], onclick: function () { if (picked) tryDrop(picked, ho); } }); holes.append(ho); });
    api.shuffle(keys).forEach(function (k, i) {
      var col = COL[i % COL.length], el = h('div', { class: 'sh', 'data-k': k, 'data-c': col, html: svg(k, col), role: 'button', tabindex: '0', 'aria-label': SH[k][1] });
      var ox, oy, moved;
      el.addEventListener('pointerdown', function (e) { if (api.paused) return; e.preventDefault(); el.setPointerCapture(e.pointerId); ox = e.clientX; oy = e.clientY; moved = false; el.style.zIndex = 10; });
      el.addEventListener('pointermove', function (e) { if (ox == null) return; var dx = e.clientX - ox, dy = e.clientY - oy; if (Math.abs(dx) + Math.abs(dy) > 6) moved = true; el.style.transform = 'translate(' + dx + 'px,' + dy + 'px) scale(1.1)'; });
      el.addEventListener('pointerup', function (e) {
        if (ox == null) return; ox = null; el.style.zIndex = '';
        if (!moved) { el.style.transform = ''; pieces.querySelectorAll('.sh').forEach(function (s) { s.classList.remove('sel'); }); el.classList.add('sel'); picked = el; api.sfx('tap'); api.say(SH[k][1]); return; }
        el.style.visibility = 'hidden'; var under = document.elementFromPoint(e.clientX, e.clientY); el.style.visibility = '';
        var ho = under && under.closest && under.closest('.ho'); el.style.transform = '';
        if (ho) tryDrop(el, ho);
      });
      pieces.append(el);
    });
    api.el.append(css, h('div', { class: 'ss' }, h('div', { style: { fontWeight: 800, color: '#ffd166', fontSize: '20px', textAlign: 'center' }, text: (round + 1) + ' / ' + ROUNDS + ' · ' + (SO ? 'Qaab kasta geli meeshiisa' : 'Put each shape in its place') }), holes, pieces));
  }
  function tryDrop(el, ho) {
    if (ho.classList.contains('done')) return;
    if (ho.dataset.k === el.dataset.k) { ho.innerHTML = svg(el.dataset.k, el.dataset.c); ho.classList.add('done'); el.remove(); picked = null; placed++; api.add(10); api.sfx('good'); api.say(SH[ho.dataset.k][1]); if (placed === n) api.after(800, next); }
    else { mistakes++; api.sfx('bad'); el.classList.remove('sel'); picked = null; el.animate([{ transform: 'translateX(-6px)' }, { transform: 'translateX(6px)' }, { transform: 'none' }], 250); }
  }
  function next() { round++; if (round >= ROUNDS) { if (!mistakes) api.achieve('perfect', { so: 'Khalad la\'aan', en: 'No mistakes' }); api.win(api.score + Math.max(0, 30 - mistakes * 5)); return; } show(); }
  return { start: function () { round = 0; mistakes = 0; show(); } };
});
