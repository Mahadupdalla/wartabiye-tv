/* Word Builder: look at the picture and tap the letters in the right order to spell the word.
   Somali or English words, read aloud. Easy shows the word faintly as a helper. */
WTG.register('spell', function (api) {
  var h = api.h, SO = api.lang === 'so';
  var W = SO ? [['🐱', 'BISAD'], ['🐪', 'GEEL'], ['🦁', 'LIBAAX'], ['🍌', 'MOOS'], ['🐟', 'KALLUUN'], ['🐦', 'SHIMBIR'], ['🌧️', 'ROOB'], ['⭐', 'XIDDIG'], ['✏️', 'QALIN'], ['📖', 'BUUG'], ['🏠', 'GURI'], ['🐴', 'FARAS'], ['🥚', 'UKUN'], ['🐕', 'EEY'], ['🌙', 'DAYAX'], ['☀️', 'QORRAX'], ['🍇', 'CANAB'], ['🐐', 'ARI'], ['💡', 'NAL'], ['🦷', 'ILIG']]
    : [['🐱', 'CAT'], ['🐶', 'DOG'], ['☀️', 'SUN'], ['🐟', 'FISH'], ['🍎', 'APPLE'], ['🦁', 'LION'], ['🌙', 'MOON'], ['⭐', 'STAR'], ['🏠', 'HOUSE'], ['📖', 'BOOK'], ['🐪', 'CAMEL'], ['🚗', 'CAR'], ['🥚', 'EGG'], ['🐄', 'COW'], ['🌳', 'TREE'], ['🍌', 'BANANA'], ['⚽', 'BALL'], ['🐦', 'BIRD'], ['🐸', 'FROG'], ['🎈', 'BALLOON']];
  var maxLen = api.cfg('len', { easy: 4, medium: 6, hard: 8 }[api.level]), N = api.cfg('n', 8), list, i, typed, mistakes, slots, tiles;
  function show() {
    api.el.innerHTML = ''; typed = '';
    var w = list[i], word = w[1];
    var root = h('div', { class: 'kq' });
    root.append(h('div', { class: 'say', text: (i + 1) + ' / ' + N }), h('div', { class: 'pic', text: w[0] }));
    if (api.level === 'easy') root.append(h('div', { class: 'word', style: { opacity: 0.35, fontSize: '28px' }, text: word }));
    slots = h('div', { class: 'ch' }); for (var k = 0; k < word.length; k++) slots.append(h('span', { class: 'g-btn', style: { minWidth: '46px', minHeight: '56px', background: 'rgba(255,255,255,.15)', color: '#fff', fontSize: '28px', display: 'grid', placeItems: 'center' }, text: '' }));
    var letters = word.split(''); if (api.level === 'hard') { var AL = SO ? 'ABCDEFGHIJKLMNOQRSTUWXY' : 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'; for (var e = 0; e < 2; e++) letters.push(AL[api.rand(0, AL.length - 1)]); }
    tiles = h('div', { class: 'ch' });
    api.shuffle(letters).forEach(function (ch) { var b = h('button', { type: 'button', class: 'g-btn', text: ch, onclick: function () { tap(b, ch); } }); tiles.append(b); });
    root.append(slots, tiles, h('div', { class: 'g-row' }, h('button', { type: 'button', class: 'g-btn sm', text: '🔊', 'aria-label': 'Listen', onclick: function () { api.say(word.toLowerCase()); } }), h('button', { type: 'button', class: 'g-btn sm', text: '↶', 'aria-label': 'Undo', onclick: undo })));
    api.el.append(root); api.after(300, function () { api.say(word.toLowerCase()); });
  }
  var used = [];
  function tap(b, ch) {
    if (api.paused || b.disabled) return; var word = list[i][1];
    if (word[typed.length] !== ch) { mistakes++; api.sfx('bad'); b.classList.add('no'); setTimeout(function () { b.classList.remove('no'); }, 350); return; }
    typed += ch; b.disabled = true; b.style.visibility = 'hidden'; used.push(b); slots.children[typed.length - 1].textContent = ch; slots.children[typed.length - 1].style.background = '#22c55e'; api.sfx('tap');
    if (typed === word) { api.add(word.length * 5); api.sfx('good'); api.say(word.toLowerCase()); api.after(1200, next); }
  }
  function undo() { if (!typed.length) return; var b = used.pop(); b.disabled = false; b.style.visibility = ''; typed = typed.slice(0, -1); var s = slots.children[typed.length]; s.textContent = ''; s.style.background = 'rgba(255,255,255,.15)'; }
  function next() { i++; if (i >= N) { if (!mistakes) api.achieve('perfect', { so: 'Higaad sax ah', en: 'Perfect spelling' }); api.win(api.score + Math.max(0, 40 - mistakes * 4), { so: N + ' erey', en: N + ' words' }); return; } show(); }
  return {
    start: function () { list = api.shuffle(W.filter(function (w) { return w[1].length <= maxLen && w[1].length >= (api.level === 'hard' ? 4 : 2); })).slice(0, N); N = list.length; i = 0; mistakes = 0; used = []; show(); },
    key: function (e, down) { if (!down || !/^[a-zA-Z]$/.test(e.key)) return; var ch = e.key.toUpperCase(); var b = [].filter.call(tiles.children, function (x) { return !x.disabled && x.textContent === ch; })[0]; if (b) { e.preventDefault(); tap(b, ch); } }
  };
});
