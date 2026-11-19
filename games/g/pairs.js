/* Animal Match (and other matching sets): tap a picture, then tap its name. options.set: "animals" (default),
   "babies" (animal and its baby), "homes" (animal and where it lives). 3 rounds. Original content. */
WTG.register('pairs', function (api) {
  var h = api.h, SO = api.lang === 'so';
  var SETS = {
    animals: SO ? [['🦁', 'Libaax'], ['🐪', 'Geel'], ['🐘', 'Maroodi'], ['🐱', 'Bisad'], ['🐕', 'Eey'], ['🐴', 'Faras'], ['🐟', 'Kalluun'], ['🐦', 'Shimbir'], ['🐊', 'Yaxaas'], ['🦒', 'Geri'], ['🐐', 'Ari'], ['🐄', 'Lo\''], ['🐭', 'Jiir'], ['🫏', 'Dameer'], ['🦓', 'Dameer-farow'], ['🐢', 'Diin']]
      : [['🦁', 'Lion'], ['🐪', 'Camel'], ['🐘', 'Elephant'], ['🐱', 'Cat'], ['🐕', 'Dog'], ['🐴', 'Horse'], ['🐟', 'Fish'], ['🐦', 'Bird'], ['🐊', 'Crocodile'], ['🦒', 'Giraffe'], ['🐐', 'Goat'], ['🐄', 'Cow'], ['🐭', 'Mouse'], ['🐵', 'Monkey'], ['🦓', 'Zebra'], ['🐢', 'Turtle']],
    homes: [['🐟', '🌊'], ['🐦', '🪺'], ['🐝', '🍯'], ['🐄', '🌾'], ['🐪', '🏜️'], ['🐧', '🧊'], ['🐒', '🌳'], ['🐸', '🪷']]
  };
  var set = SETS[api.opts.set] || SETS.animals, n = { easy: 3, medium: 4, hard: 6 }[api.level], ROUNDS = 3;
  var round, selL, done, mistakes, colors = ['#fde68a', '#bfdbfe', '#fbcfe8', '#bbf7d0', '#fed7aa', '#ddd6fe'];
  var css = h('style', { text: '.pm{display:grid;grid-template-columns:1fr 1fr;gap:clamp(20px,8vw,90px);width:min(100%,640px)}.pm .c{display:flex;flex-direction:column;gap:10px}.pm button{min-height:clamp(56px,11vmin,84px);font:800 clamp(20px,4.5vmin,30px)/1.1 Archivo,sans-serif;border-radius:18px}.pm .l button{font-size:clamp(36px,8vmin,58px)}.pm button.sel{outline:4px solid #ffb703}.pm button.m{opacity:.9;color:#04213f}' });
  function show() {
    api.el.innerHTML = ''; selL = null; done = 0;
    var pick = api.shuffle(set).slice(0, n), L = h('div', { class: 'c l' }), R = h('div', { class: 'c r' });
    var lb = pick.map(function (p, i) { return h('button', { type: 'button', class: 'g-btn', text: p[0], 'data-k': i, 'aria-label': p[0], onclick: function () { if (api.paused || this.disabled) return; L.querySelectorAll('button').forEach(function (b) { b.classList.remove('sel'); }); this.classList.add('sel'); selL = this; api.sfx('tap'); } }); });
    api.shuffle(lb).forEach(function (b) { L.append(b); });
    api.shuffle(pick.map(function (p, i) { return { p: p, i: i }; })).forEach(function (o) {
      R.append(h('button', { type: 'button', class: 'g-btn', text: o.p[1], onclick: function () {
        if (api.paused || this.disabled) return; var b = this;
        if (!selL) { api.toast(SO ? 'Marka hore taabo sawir' : 'Tap a picture first'); return; }
        if (+selL.dataset.k === o.i) { var c = colors[done % colors.length]; selL.style.background = c; b.style.background = c; selL.classList.add('m'); b.classList.add('m'); selL.classList.remove('sel'); selL.disabled = true; b.disabled = true; selL = null; done++; api.add(10); api.sfx('good'); if (!SETS[api.opts.set] || api.opts.set === 'animals') api.say(o.p[1]); if (done === n) api.after(900, next); }
        else { mistakes++; b.classList.add('no'); api.sfx('bad'); setTimeout(function () { b.classList.remove('no'); }, 400); }
      } }));
    });
    api.el.append(css, h('div', { class: 'g-col' }, h('div', { class: 'say', style: { fontWeight: 800, color: '#ffd166', fontSize: '20px', textAlign: 'center' }, text: (round + 1) + ' / ' + ROUNDS + ' · ' + (SO ? 'Isku xir sawirka iyo magaca' : 'Match each picture') }), h('div', { class: 'pm' }, L, R)));
  }
  function next() { round++; if (round >= ROUNDS) { if (!mistakes) api.achieve('perfect', { so: 'Khalad la\'aan', en: 'No mistakes' }); api.win(api.score + Math.max(0, 30 - mistakes * 5), { so: mistakes + ' khalad', en: mistakes + ' mistakes' }); return; } show(); }
  return { start: function () { round = 0; mistakes = 0; show(); } };
});
