/* Sliding puzzle. options.mode "picture": a picture drawn here is cut into squares (children's puzzle);
   options.mode "numbers": the classic 15-puzzle (number puzzle). Tap a tile next to the gap to slide it. */
WTG.register('slide', function (api) {
  var h = api.h, pic = api.opts.mode === 'picture';
  var N = pic ? { easy: 2, medium: 3, hard: 4 }[api.level] : { easy: 3, medium: 4, hard: 5 }[api.level];
  var board, gap, moves, t0, img, scene = 0;
  function paint() {
    // an original picture: sun, hills, a house and a tree (no outside image needed)
    var S = 480, c = document.createElement('canvas'); c.width = c.height = S; var x = c.getContext('2d');
    var scenes = [
      function () { var g = x.createLinearGradient(0, 0, 0, S); g.addColorStop(0, '#7dd3fc'); g.addColorStop(1, '#e0f2fe'); x.fillStyle = g; x.fillRect(0, 0, S, S); x.fillStyle = '#facc15'; x.beginPath(); x.arc(380, 90, 50, 0, 7); x.fill(); x.fillStyle = '#4ade80'; x.beginPath(); x.ellipse(120, 470, 260, 150, 0, 0, 7); x.fill(); x.fillStyle = '#22c55e'; x.beginPath(); x.ellipse(420, 480, 220, 140, 0, 0, 7); x.fill(); x.fillStyle = '#ef4444'; x.beginPath(); x.moveTo(150, 250); x.lineTo(260, 170); x.lineTo(370, 250); x.fill(); x.fillStyle = '#fde68a'; x.fillRect(170, 250, 180, 130); x.fillStyle = '#92400e'; x.fillRect(240, 300, 45, 80); x.fillStyle = '#38bdf8'; x.fillRect(185, 275, 40, 35); x.fillRect(300, 275, 40, 35); x.fillStyle = '#78350f'; x.fillRect(60, 260, 22, 110); x.fillStyle = '#16a34a'; x.beginPath(); x.arc(71, 240, 55, 0, 7); x.fill(); x.fillStyle = '#fff'; [[90, 80], [130, 70], [160, 85]].forEach(function (p) { x.beginPath(); x.arc(p[0], p[1], 28, 0, 7); x.fill(); }); },
      function () { x.fillStyle = '#0c4a6e'; x.fillRect(0, 0, S, S); x.fillStyle = '#0369a1'; x.fillRect(0, 300, S, 180); x.fillStyle = '#fef3c7'; x.beginPath(); x.arc(360, 110, 60, 0, 7); x.fill(); x.fillStyle = '#fff'; for (var i = 0; i < 30; i++) x.fillRect((i * 97) % S, (i * 53) % 240, 3, 3); x.fillStyle = '#f97316'; x.beginPath(); x.moveTo(120, 330); x.lineTo(360, 330); x.lineTo(320, 380); x.lineTo(160, 380); x.fill(); x.fillStyle = '#fff'; x.beginPath(); x.moveTo(240, 140); x.lineTo(240, 320); x.lineTo(340, 320); x.fill(); x.fillStyle = '#F2060A'; x.beginPath(); x.moveTo(230, 170); x.lineTo(230, 320); x.lineTo(150, 320); x.fill(); x.fillStyle = '#fde047'; x.beginPath(); x.arc(100, 430, 30, 0, 7); x.fill(); },
      function () { x.fillStyle = '#fef9c3'; x.fillRect(0, 0, S, S); x.fillStyle = '#f59e0b'; x.fillRect(0, 360, S, 120); x.fillStyle = '#a16207'; x.beginPath(); x.ellipse(250, 300, 120, 70, 0, 0, 7); x.fill(); x.fillRect(300, 180, 30, 120); x.beginPath(); x.ellipse(330, 170, 45, 30, 0, 0, 7); x.fill(); x.fillRect(170, 330, 20, 80); x.fillRect(220, 340, 20, 80); x.fillRect(270, 340, 20, 80); x.fillRect(320, 330, 20, 80); x.beginPath(); x.ellipse(240, 230, 50, 40, 0, 0, 7); x.fill(); x.fillStyle = '#000'; x.beginPath(); x.arc(345, 162, 5, 0, 7); x.fill(); x.fillStyle = '#ef4444'; x.beginPath(); x.arc(80, 80, 45, 0, 7); x.fill(); x.fillStyle = '#15803d'; x.fillRect(420, 250, 18, 120); x.fillRect(395, 290, 60, 14); }
    ];
    scenes[scene % scenes.length]();
    x.strokeStyle = 'rgba(0,0,0,.15)'; x.lineWidth = 6; x.strokeRect(3, 3, S - 6, S - 6);
    return c.toDataURL('image/png');
  }
  var root;
  function build() {
    board = []; for (var i = 0; i < N * N - 1; i++) board.push(i + 1); board.push(0); gap = N * N - 1;
    var last = -1; for (var k = 0; k < N * N * 40; k++) { var nb = neigh(gap).filter(function (q) { return q !== last; }); var m = api.pick(nb); last = gap; board[gap] = board[m]; board[m] = 0; gap = m; }
    if (solved()) return build();
    moves = 0; t0 = Date.now();
  }
  function neigh(i) { var r = Math.floor(i / N), c = i % N, o = []; if (r > 0) o.push(i - N); if (r < N - 1) o.push(i + N); if (c > 0) o.push(i - 1); if (c < N - 1) o.push(i + 1); return o; }
  function solved() { for (var i = 0; i < N * N - 1; i++) if (board[i] !== i + 1) return false; return true; }
  var G;
  function render() {
    api.el.innerHTML = '';
    var size = 'min(calc(var(--w) - 24px), calc(var(--h) - ' + (pic ? 150 : 70) + 'px), 520px)';
    G = h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(' + N + ',1fr)', gap: pic ? '3px' : '8px', width: size, height: size, background: '#04213f', padding: '8px', borderRadius: '16px', boxShadow: '0 14px 34px rgba(0,0,0,.4)', touchAction: 'manipulation' } });
    board.forEach(function (v, i) {
      var b = h('button', { type: 'button', 'aria-label': v ? 'tile ' + v : 'gap', style: { border: '0', borderRadius: pic ? '6px' : '12px', cursor: v ? 'pointer' : 'default', font: '900 calc(' + size + ' / ' + N + ' * .42) Archivo,sans-serif', color: '#04213f', padding: '0', visibility: v ? 'visible' : 'hidden', background: v ? (pic ? 'url(' + img + ') ' + ((v - 1) % N) * 100 / (N - 1) + '% ' + Math.floor((v - 1) / N) * 100 / (N - 1) + '% / ' + N * 100 + '% ' + N * 100 + '%' : (v === (Math.floor(i / N)) * N + (i % N) + 1 ? '#86efac' : '#fff')) : 'transparent', boxShadow: v ? '0 4px 0 rgba(0,0,0,.25)' : 'none' }, onclick: function () { tap(i); } }, pic ? '' : String(v || ''));
      G.append(b);
    });
    var parts = [G];
    if (pic) parts.push(h('div', { class: 'g-row' }, h('img', { src: img, alt: 'picture', style: { width: '80px', height: '80px', borderRadius: '10px', border: '3px solid #fff' } }), h('span', { class: 'g-note', text: api.t({ so: 'Sawirkan samee', en: 'Make this picture' }) })));
    api.el.append(h('div', { class: 'g-col' }, parts));
    api.info(api.t({ so: 'Tallaabo', en: 'Moves', ar: 'حركات', fr: 'Coups', nl: 'Zetten', it: 'Mosse', de: 'Züge', tr: 'Hamle', es: 'Jugadas' }), moves);
  }
  function tap(i) {
    if (api.paused || api.isOver()) return;
    var r = Math.floor(i / N), c = i % N, gr = Math.floor(gap / N), gc = gap % N;
    if (r !== gr && c !== gc) return;
    // slide a whole row/column segment towards the gap
    var step = r === gr ? (c < gc ? -1 : 1) : (r < gr ? -N : N);
    while (gap !== i) { var n = gap + step; board[gap] = board[n]; board[n] = 0; gap = n; }
    moves++; api.sfx('move'); render();
    if (solved()) { var secs = Math.round((Date.now() - t0) / 1000); api.win(Math.max(50, N * N * 40 - moves * 2 - secs), { so: moves + ' tallaabo · ' + WTG.fmtTime(secs), en: moves + ' moves · ' + WTG.fmtTime(secs) }); }
  }
  var pAt = 0;
  return {
    start: function () { scene = api.rand(0, 2); if (pic) img = paint(); build(); render(); },
    pause: function () { pAt = Date.now(); }, resume: function () { if (pAt) t0 += Date.now() - pAt; pAt = 0; },
    key: function (e, down) { if (!down) return; var gr = Math.floor(gap / N), gc = gap % N, t = -1; if (e.key === 'ArrowLeft' && gc < N - 1) t = gap + 1; if (e.key === 'ArrowRight' && gc > 0) t = gap - 1; if (e.key === 'ArrowUp' && gr < N - 1) t = gap + N; if (e.key === 'ArrowDown' && gr > 0) t = gap - N; if (t >= 0) { e.preventDefault(); tap(t); } }
  };
});
