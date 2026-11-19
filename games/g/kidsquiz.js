/* Children's learning quizzes, one game file with four modes (options.mode):
   "letters"  ABC Letters: find the letter, or the first letter of a picture word (Somali or English alphabet)
   "counting" Count 1-2-3: count the pictures and tap the number
   "kidsmath" Kids Maths: add and take away with pictures
   "words"    Word Learning: tap the picture that matches the word
   Big buttons, bright colours, spoken words (the device's own voice), 10 friendly rounds. Original content. */
WTG.register('kidsquiz', function (api) {
  var h = api.h, mode = api.opts.mode || 'letters', SO = api.lang === 'so';
  var WORDS = SO ? [['A', 'ARI', '🐐'], ['B', 'BISAD', '🐱'], ['T', 'TUFAAX', '🍎'], ['J', 'JIIR', '🐭'], ['X', 'XIDDIG', '⭐'], ['KH', 'KHUDAAR', '🥕'], ['D', 'DAMEER', '🫏'], ['R', 'ROOB', '🌧️'], ['S', 'SAACAD', '⌚'], ['SH', 'SHIMBIR', '🐦'], ['DH', 'DHAGAX', '🪨'], ['C', 'CANAB', '🍇'], ['G', 'GEEL', '🐪'], ['F', 'FARAS', '🐴'], ['Q', 'QALIN', '✏️'], ['K', 'KALLUUN', '🐟'], ['L', 'LIBAAX', '🦁'], ['M', 'MOOS', '🍌'], ['N', 'NAL', '💡'], ['W', 'WEYL', '🐄'], ['H', 'HOOYO', '👩'], ['Y', 'YAXAAS', '🐊'], ['E', 'EEY', '🐕'], ['I', 'ILIG', '🦷'], ['O', 'ODAY', '👴'], ['U', 'UKUN', '🥚']]
    : [['A', 'APPLE', '🍎'], ['B', 'BALL', '⚽'], ['C', 'CAT', '🐱'], ['D', 'DOG', '🐶'], ['E', 'EGG', '🥚'], ['F', 'FISH', '🐟'], ['G', 'GRAPES', '🍇'], ['H', 'HOUSE', '🏠'], ['I', 'ICE', '🧊'], ['J', 'JUICE', '🧃'], ['K', 'KITE', '🪁'], ['L', 'LION', '🦁'], ['M', 'MOON', '🌙'], ['N', 'NOSE', '👃'], ['O', 'ORANGE', '🍊'], ['P', 'PEN', '🖊️'], ['Q', 'QUEEN', '👸'], ['R', 'RAIN', '🌧️'], ['S', 'SUN', '☀️'], ['T', 'TREE', '🌳'], ['U', 'UMBRELLA', '☂️'], ['V', 'VAN', '🚐'], ['W', 'WATCH', '⌚'], ['X', 'XYLOPHONE', '🎵'], ['Y', 'YO-YO', '🪀'], ['Z', 'ZEBRA', '🦓']];
  var NUMW = SO ? ['eber', 'kow', 'laba', 'saddex', 'afar', 'shan', 'lix', 'toddoba', 'siddeed', 'sagaal', 'toban'] : ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
  var OBJ = ['🍎', '⭐', '🐟', '🎈', '🐥', '🌸', '🚗', '🍌', '⚽', '🦋'];
  var PRAISE = SO ? ['Fiican!', 'Waa sax!', 'Mahadsanid, waa sax!', 'Aad u wanaagsan!'] : ['Great!', 'Well done!', 'Super!', 'Correct!'];
  var TRY = SO ? 'Isku day mar kale' : 'Try again';
  var N = api.cfg('n', 10), round, right, firstTry, prog, root;
  function lv(e, m, hd) { return api.level === 'easy' ? e : api.level === 'medium' ? m : hd; }
  function build() {
    var q = {}, nC = lv(3, 4, 6);
    if (mode === 'letters') {
      var w = api.pick(WORDS), others = api.shuffle(WORDS.filter(function (x) { return x[0] !== w[0]; })).slice(0, nC - 1);
      var picture = api.level === 'hard' || (api.level === 'medium' && Math.random() < 0.5);
      q.pic = w[2]; q.word = picture ? '_' + w[1].slice(w[0].length).toLowerCase() : w[1]; q.ask = picture ? (SO ? 'Ereygani xarafkee ku bilowdaa?' : 'Which letter does it start with?') : (SO ? 'Taabo xarafka ' : 'Tap the letter ') + w[0];
      q.opts = api.shuffle([w[0]].concat(others.map(function (x) { return x[0]; }))); q.ans = w[0]; q.speak = picture ? w[1] : w[0] + ', ' + w[1];
    } else if (mode === 'counting') {
      var max = lv(5, 10, 20), n = api.rand(1, max), o = api.pick(OBJ);
      var near = api.shuffle(Array.from({ length: max }, function (_, i) { return i + 1; }).filter(function (k) { return k !== n; })).sort(function (a, b) { return Math.abs(a - n) - Math.abs(b - n); });
      var set = [n].concat(api.shuffle(near.slice(0, nC + 1)).slice(0, nC - 1));
      q.objs = new Array(n + 1).join(o + ' ').trim().split(' '); q.ask = SO ? 'Imisa ayaa jira?' : 'How many are there?';
      q.opts = api.shuffle(set).map(String); q.ans = String(n); q.speak = n <= 10 ? NUMW[n] : String(n);
    } else if (mode === 'kidsmath') {
      var mx = lv(5, 10, 20), add = api.level === 'easy' || Math.random() < 0.6, a, b, r;
      if (add) { a = api.rand(1, mx - 1); b = api.rand(1, mx - a); r = a + b; } else { a = api.rand(2, mx); b = api.rand(1, a - 1); r = a - b; }
      var ob = api.pick(OBJ), pics = mx <= 10;
      q.math = { a: a, b: b, add: add, o: ob, pics: pics }; q.ask = a + (add ? ' + ' : ' − ') + b + ' = ?';
      var s2 = [r]; while (s2.length < nC) { var w2 = r + api.rand(-3, 3); if (w2 >= 0 && s2.indexOf(w2) < 0) s2.push(w2); }
      q.opts = api.shuffle(s2).map(String); q.ans = String(r); q.speak = a + (add ? (SO ? ' iyo ' : ' plus ') : (SO ? ' laga jaro ' : ' minus ')) + b;
    } else {
      var t = api.pick(WORDS), o2 = api.shuffle(WORDS.filter(function (x) { return x !== t; })).slice(0, nC - 1);
      q.word = t[1]; q.ask = SO ? 'Taabo sawirka ereygan' : 'Tap the picture for this word';
      q.opts = api.shuffle([t[2]].concat(o2.map(function (x) { return x[2]; }))); q.ans = t[2]; q.speak = t[1]; q.emoji = true;
    }
    return q;
  }
  function show() {
    var q = build(); firstTry = true; api.el.innerHTML = '';
    root = h('div', { class: 'kq' });
    prog = h('div', { class: 'prog' }); for (var i = 0; i < N; i++) prog.append(h('i', { class: i < round ? (hist[i] ? 'ok' : 'no') : '' }));
    root.append(prog);
    if (q.pic) root.append(h('div', { class: 'pic', text: q.pic }));
    if (q.word && !q.pic) root.append(h('div', { class: 'word', text: q.word }));
    if (q.word && q.pic) root.append(h('div', { class: 'word', text: q.word }));
    if (q.objs) { var ob = h('div', { class: 'objs' }); q.objs.forEach(function (o, i) { ob.append(h('span', { text: o, style: { animation: 'rise .3s ' + i * 0.04 + 's both' } })); }); root.append(ob); }
    if (q.math) { var m = q.math, row = h('div', { class: 'objs', style: { alignItems: 'center' } }); if (m.pics) { row.append(h('span', { text: new Array(m.a + 1).join(m.o) })); row.append(h('b', { text: m.add ? ' + ' : ' − ', style: { margin: '0 8px' } })); row.append(h('span', { text: new Array(m.b + 1).join(m.o), style: { opacity: m.add ? 1 : 0.5 } })); } root.append(row); }
    root.append(h('div', { class: 'say', text: q.ask }));
    var ch = h('div', { class: 'ch' });
    q.opts.forEach(function (o) {
      var b = h('button', { type: 'button', class: 'g-btn', text: o, style: q.emoji ? { fontSize: 'clamp(40px,10vmin,72px)' } : null, onclick: function () {
        if (api.paused || b.disabled) return;
        if (o === q.ans) { b.classList.add('ok'); api.sfx('good'); api.say(api.pick(PRAISE)); if (firstTry) { right++; api.add(10); } hist[round] = firstTry; ch.querySelectorAll('button').forEach(function (x) { x.disabled = true; }); api.after(1100, next); }
        else { b.classList.add('no'); b.disabled = true; firstTry = false; api.sfx('bad'); api.toast(TRY); }
      } });
      ch.append(b);
    });
    root.append(ch, h('button', { type: 'button', class: 'g-btn sm', text: '🔊', 'aria-label': 'Listen', onclick: function () { api.say(q.speak); } }));
    api.el.append(root);
    api.after(300, function () { api.say(q.speak); });
  }
  var hist = [];
  function next() {
    round++;
    if (round >= N) { var stars = right >= N * 0.9 ? 3 : right >= N * 0.6 ? 2 : 1; if (right === N) api.achieve('all-' + mode, { so: 'Dhammaan waa sax!', en: 'All correct!' }); api.win(api.score + stars * 10, { so: new Array(stars + 1).join('⭐') + ' ' + right + ' / ' + N, en: new Array(stars + 1).join('⭐') + ' ' + right + ' / ' + N }); return; }
    show();
  }
  return { start: function () { round = 0; right = 0; hist = []; show(); } };
});
