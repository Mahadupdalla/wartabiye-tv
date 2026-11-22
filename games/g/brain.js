/* Brain Gym: one minute of mixed quick challenges: mental maths, colour words, the bigger number and the odd one out.
   Faster correct answers give more points. Original implementation. */
WTG.register('brain', function (api) {
  var h = api.h;
  var COLS = [['#ef4444', { so: 'CAS', en: 'RED' }], ['#3b82f6', { so: 'BULUUG', en: 'BLUE' }], ['#22c55e', { so: 'CAGAAR', en: 'GREEN' }], ['#eab308', { so: 'JAALLE', en: 'YELLOW' }]];
  var TIME = api.cfg('time', { easy: 75, medium: 60, hard: 45 }[api.level]), left, streak, right, wrong, tId, qStart;
  var types = api.opts.types || ['math', 'color', 'bigger', 'odd'];
  var css = h('style', { text: '.bg{width:min(100%,560px);display:flex;flex-direction:column;align-items:center;gap:14px}.bg .k{font-weight:800;color:#bcd3ee;text-transform:uppercase;letter-spacing:.06em;font-size:13px}.bg .q{font:900 clamp(34px,9vmin,64px)/1.1 Archivo,sans-serif;text-align:center;min-height:1.2em}.bg .opts{display:grid;grid-template-columns:1fr 1fr;gap:10px;width:100%}.bg .opts button{font-size:clamp(20px,5vmin,30px);padding:18px 8px}.bg .bar{width:100%;height:8px;border-radius:5px;background:rgba(255,255,255,.15);overflow:hidden}.bg .bar i{display:block;height:100%;background:#22c55e}' });
  var bar = h('i'), kind = h('div', { class: 'k' }), q = h('div', { class: 'q' }), opts = h('div', { class: 'opts' });
  api.el.append(css, h('div', { class: 'bg' }, h('div', { class: 'bar' }, bar), kind, q, opts));
  var L = { math: { so: 'Xisaab degdeg ah', en: 'Quick maths' }, color: { so: 'Taabo MIDABKA qoraalka (ha akhrin erayga)', en: 'Tap the INK colour (not the word)' }, bigger: { so: 'Kee ka weyn?', en: 'Which is bigger?' }, odd: { so: 'Kee ka duwan?', en: 'Which one is different?' } };
  function ask() {
    var t = api.pick(types), answers, correct;
    kind.textContent = api.t(L[t]); opts.innerHTML = ''; q.style.color = '#fff'; q.style.fontSize = '';
    var hard = api.level === 'hard', med = api.level !== 'easy';
    if (t === 'math') {
      var op = api.pick(med ? ['+', '−', '×'] : ['+', '−']), a, b, r;
      if (op === '+') { a = api.rand(2, hard ? 99 : 30); b = api.rand(2, hard ? 99 : 30); r = a + b; }
      else if (op === '−') { a = api.rand(10, hard ? 120 : 40); b = api.rand(1, a); r = a - b; }
      else { a = api.rand(2, hard ? 15 : 9); b = api.rand(2, hard ? 12 : 9); r = a * b; }
      q.textContent = a + ' ' + op + ' ' + b;
      var set = [r]; while (set.length < 4) { var w = r + api.rand(-10, 10); if (w >= 0 && set.indexOf(w) < 0) set.push(w); }
      answers = api.shuffle(set).map(String); correct = String(r);
    } else if (t === 'color') {
      var ink = api.pick(COLS), word = api.pick(COLS.filter(function (c) { return c !== ink; }));
      q.textContent = api.t(word[1]); q.style.color = ink[0];
      answers = api.shuffle(COLS).map(function (c) { return api.t(c[1]); }); correct = api.t(ink[1]);
    } else if (t === 'bigger') {
      var m = hard ? 999 : med ? 199 : 50, x = api.rand(1, m), y; do { y = api.rand(1, m); } while (y === x);
      if (med && Math.random() < 0.5) { var x1 = api.rand(1, 20), x2 = api.rand(1, 20), y1 = api.rand(1, 20), y2 = api.rand(1, 20); if (x1 + x2 === y1 + y2) y2++; answers = [x1 + ' + ' + x2, y1 + ' + ' + y2]; correct = x1 + x2 > y1 + y2 ? answers[0] : answers[1]; }
      else { answers = [String(x), String(y)]; correct = String(Math.max(x, y)); }
      q.textContent = '⚖️';
    } else {
      var sets = [['🍎', '🍏'], ['🐶', '🐱'], ['⭐', '🌟'], ['🔵', '🟣'], ['🚗', '🚙'], ['😀', '😃'], ['🌙', '🌛'], ['⚽', '🏀']], s = api.pick(sets), n = hard ? 9 : 6, odd = api.rand(0, n - 1);
      answers = []; for (var i = 0; i < n; i++) answers.push(i === odd ? s[1] + '​' + i : s[0] + '​' + i); correct = answers[odd];
      q.textContent = '🔍'; opts.style.gridTemplateColumns = 'repeat(3,1fr)';
    }
    if (t !== 'odd') opts.style.gridTemplateColumns = answers.length === 2 ? '1fr 1fr' : '1fr 1fr';
    qStart = Date.now();
    answers.forEach(function (a) {
      var b = h('button', { type: 'button', class: 'g-btn', text: a.split('​')[0], onclick: function () {
        if (api.paused) return;
        if (a === correct) { streak++; right++; var fast = Math.max(0, 3000 - (Date.now() - qStart)); api.add(10 + Math.round(fast / 100) + Math.min(20, streak * 2)); api.sfx('good'); b.classList.add('ok'); if (streak === 10) api.achieve('streak10', { so: '10 sax ah oo isku xiga', en: '10 right in a row' }); }
        else { streak = 0; wrong++; left = Math.max(0, left - 3); api.sfx('bad'); b.classList.add('no'); }
        opts.querySelectorAll('button').forEach(function (x) { x.disabled = true; });
        api.after(a === correct ? 250 : 600, ask);
      } });
      opts.append(b);
    });
  }
  return {
    start: function () { left = TIME; streak = 0; right = 0; wrong = 0; ask(); clearInterval(tId); tId = setInterval(function () { if (api.paused) return; left -= 0.1; bar.style.width = Math.max(0, left / TIME * 100) + '%'; api.info('⏱', Math.ceil(left)); if (left <= 0) { clearInterval(tId); api.end({ won: right >= 15, score: api.score, msg: { so: right + ' sax · ' + wrong + ' khalad', en: right + ' right · ' + wrong + ' wrong' } }); } }, 100); },
    destroy: function () { clearInterval(tId); },
    key: function (e, down) { if (!down) return; var n = parseInt(e.key, 10); var bs = opts.querySelectorAll('button'); if (n >= 1 && n <= bs.length && !bs[n - 1].disabled) { e.preventDefault(); bs[n - 1].click(); } }
  };
});
