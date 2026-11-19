/* Memory cards: turn two cards at a time and find all the pairs. Sets for children (animals, fruit) and for adults
   (symbols, flags of colours, numbers). options.set picks the set, options.big gives large cards. Original implementation. */
WTG.register('memory', function (api) {
  var h = api.h;
  var SETS = {
    animals: ['🐶', '🐱', '🦁', '🐯', '🐮', '🐷', '🐸', '🐵', '🐔', '🐧', '🐢', '🐟', '🦒', '🐘', '🐪', '🦓'],
    fruit: ['🍎', '🍌', '🍇', '🍉', '🍓', '🍒', '🍍', '🥭', '🍑', '🍐', '🥝', '🍋', '🥥', '🍊', '🥕', '🌽'],
    symbols: ['★', '♥', '♦', '♣', '♠', '☀', '☂', '☎', '✈', '⚓', '⚽', '♫', '✿', '☘', '⌛', '✉'],
    mixed: ['🚗', '🚀', '⛵', '🚲', '🏠', '🌙', '⭐', '⚽', '🏀', '🎈', '📚', '🎵', '🔑', '💡', '⏰', '🌍']
  };
  var big = !!api.opts.big, set = SETS[api.opts.set] || SETS.mixed;
  var pairs = (api.opts.pairs && api.opts.pairs[api.level]) || { easy: big ? 4 : 6, medium: big ? 6 : 8, hard: big ? 8 : 12 }[api.level];
  var cols = pairs <= 4 ? 4 : pairs <= 6 ? 4 : pairs <= 8 ? 4 : 6;
  var css = h('style', { text: '.mm{display:grid;gap:10px;perspective:800px;width:min(calc(var(--w) - 24px), calc((var(--h) - 40px) * var(--ar)), 760px)}.mm button{aspect-ratio:3/4;border:0;padding:0;background:transparent;cursor:pointer;position:relative;transform-style:preserve-3d;transition:transform .35s}.mm button.up,.mm button.done{transform:rotateY(180deg)}.mm .f,.mm .b{position:absolute;inset:0;border-radius:14px;backface-visibility:hidden;display:grid;place-items:center}.mm .b{background:linear-gradient(135deg,#037BDC,#04213f);border:3px solid #fff;box-shadow:0 6px 14px rgba(0,0,0,.35)}.mm .b::after{content:"WTV";font:900 14px Archivo,sans-serif;color:rgba(255,255,255,.5)}.mm .f{background:#fff;transform:rotateY(180deg);font-size:calc(min(calc(var(--w) - 24px), calc((var(--h) - 40px) * var(--ar)), 760px) / var(--c) * .5);color:#0b1c33;box-shadow:0 6px 14px rgba(0,0,0,.35)}.mm button.done .f{background:#dcfce7;box-shadow:0 0 0 4px #22c55e}' });
  var deck, open, lock, found, moves, t0;
  function deal() {
    var s = api.shuffle(set).slice(0, pairs); deck = api.shuffle(s.concat(s)); open = []; lock = false; found = 0; moves = 0;
    var rows = Math.ceil(deck.length / cols);
    var G = h('div', { class: 'mm', style: { gridTemplateColumns: 'repeat(' + cols + ',1fr)', '--c': cols, '--ar': (cols / rows / (4 / 3)).toFixed(3) } });
    deck.forEach(function (sym, i) { var b = h('button', { type: 'button', 'aria-label': 'card ' + (i + 1), onclick: function () { flip(i, b); } }, h('span', { class: 'b' }), h('span', { class: 'f', text: sym })); G.append(b); });
    api.el.innerHTML = ''; api.el.append(css, G);
    api.info(api.t({ so: 'Isku day', en: 'Moves', ar: 'محاولات', fr: 'Coups', nl: 'Zetten', it: 'Mosse', de: 'Züge', tr: 'Hamle', es: 'Jugadas' }), 0);
  }
  function flip(i, b) {
    if (api.paused || lock || b.classList.contains('up') || b.classList.contains('done')) return;
    b.classList.add('up'); api.sfx('tap'); open.push({ i: i, b: b });
    if (open.length < 2) return;
    moves++; api.info(api.t({ so: 'Isku day', en: 'Moves', ar: 'محاولات', fr: 'Coups', nl: 'Zetten', it: 'Mosse', de: 'Züge', tr: 'Hamle', es: 'Jugadas' }), moves);
    var a = open[0], c = open[1];
    if (deck[a.i] === deck[c.i]) {
      a.b.classList.add('done'); c.b.classList.add('done'); open = []; found++; api.add(big ? 20 : 25); api.sfx('good');
      if (found === pairs) { var secs = Math.round((Date.now() - t0) / 1000), bonus = Math.max(0, pairs * 30 - (moves - pairs) * 8); if (moves === pairs) api.achieve('perfect', { so: 'Xusuus dhammaystiran', en: 'Perfect memory' }); api.win(api.score + bonus, { so: moves + ' isku day · ' + WTG.fmtTime(secs), en: moves + ' moves · ' + WTG.fmtTime(secs) }); }
    } else {
      lock = true; api.sfx('bad');
      api.after(big ? 1100 : 800, function () { a.b.classList.remove('up'); c.b.classList.remove('up'); open = []; lock = false; });
    }
  }
  var pAt = 0;
  return {
    start: function () { deal(); t0 = Date.now(); },
    pause: function () { pAt = Date.now(); }, resume: function () { if (pAt) t0 += Date.now() - pAt; pAt = 0; }
  };
});
