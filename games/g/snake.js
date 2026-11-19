/* Snake: eat the fruit, grow longer, don't hit the walls or yourself. Original implementation. */
WTG.register('snake', function (api) {
  var N = 20, SZ = 20, C = api.canvas(N * SZ, N * SZ, 130), x = C.ctx;
  var speed = { easy: 6, medium: 8, hard: 12 }[api.level], walls = api.level !== 'easy';
  var snake, dir, next, food, acc, eaten, dead, bonus;
  function reset() { snake = [{ x: 8, y: 10 }, { x: 7, y: 10 }, { x: 6, y: 10 }]; dir = { x: 1, y: 0 }; next = dir; acc = 0; eaten = 0; dead = false; place(); bonus = null; }
  function free(p) { return !snake.some(function (s) { return s.x === p.x && s.y === p.y; }); }
  function place() { var p; do { p = { x: api.rand(0, N - 1), y: api.rand(0, N - 1) }; } while (!free(p)); food = p; }
  function turn(dx, dy) { if (dx === -dir.x && dy === -dir.y) return; next = { x: dx, y: dy }; }
  function step() {
    dir = next;
    var hd = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };
    if (!walls) { hd.x = (hd.x + N) % N; hd.y = (hd.y + N) % N; }
    if (hd.x < 0 || hd.y < 0 || hd.x >= N || hd.y >= N || !free(hd)) { dead = true; api.sfx('hit'); api.lose(api.score); return; }
    snake.unshift(hd);
    if (hd.x === food.x && hd.y === food.y) {
      eaten++; api.add(10); api.sfx('coin'); place();
      if (eaten % 5 === 0) { var p; do { p = { x: api.rand(0, N - 1), y: api.rand(0, N - 1) }; } while (!free(p) || (p.x === food.x && p.y === food.y)); bonus = { x: p.x, y: p.y, t: 6 }; }
      if (eaten === 20) api.achieve('long', { so: 'Mas dheer (20 miro)', en: 'Long snake (20 fruit)' });
    } else if (bonus && hd.x === bonus.x && hd.y === bonus.y) { api.add(50); api.sfx('win'); bonus = null; }
    else snake.pop();
  }
  function draw() {
    x.fillStyle = '#0b2545'; x.fillRect(0, 0, C.W, C.H);
    for (var i = 0; i < N; i++) for (var j = 0; j < N; j++) if ((i + j) % 2) { x.fillStyle = '#0e2c52'; x.fillRect(i * SZ, j * SZ, SZ, SZ); }
    if (walls) { x.strokeStyle = '#F2060A'; x.lineWidth = 4; x.strokeRect(2, 2, C.W - 4, C.H - 4); }
    x.font = '16px serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText('🍎', food.x * SZ + SZ / 2, food.y * SZ + SZ / 2 + 1);
    if (bonus) x.fillText('⭐', bonus.x * SZ + SZ / 2, bonus.y * SZ + SZ / 2 + 1);
    snake.forEach(function (s, i) {
      x.fillStyle = i ? (i % 2 ? '#22c55e' : '#16a34a') : '#4ade80';
      x.beginPath(); x.roundRect ? x.roundRect(s.x * SZ + 1, s.y * SZ + 1, SZ - 2, SZ - 2, 6) : x.rect(s.x * SZ + 1, s.y * SZ + 1, SZ - 2, SZ - 2); x.fill();
    });
    var hd = snake[0]; x.fillStyle = '#052e16';
    x.beginPath(); x.arc(hd.x * SZ + SZ / 2 + dir.y * 4 + dir.x * 3, hd.y * SZ + SZ / 2 + dir.x * 4 + dir.y * 3, 2.4, 0, 7); x.arc(hd.x * SZ + SZ / 2 - dir.y * 4 + dir.x * 3, hd.y * SZ + SZ / 2 - dir.x * 4 + dir.y * 3, 2.4, 0, 7); x.fill();
  }
  // swipe on the board, or the arrow pad below it
  var sx = 0, sy = 0;
  C.cv.addEventListener('touchstart', function (e) { var t = e.touches[0]; sx = t.clientX; sy = t.clientY; }, { passive: true });
  C.cv.addEventListener('touchmove', function (e) { e.preventDefault(); }, { passive: false });
  C.cv.addEventListener('touchend', function (e) { var t = e.changedTouches[0], dx = t.clientX - sx, dy = t.clientY - sy; if (Math.max(Math.abs(dx), Math.abs(dy)) < 20) return; if (Math.abs(dx) > Math.abs(dy)) turn(dx > 0 ? 1 : -1, 0); else turn(0, dy > 0 ? 1 : -1); });
  var pad = api.h('div', { class: 'g-pad', style: { marginTop: '8px' } });
  [['', 0, 0], ['▲', 0, -1], ['', 0, 0], ['◀', -1, 0], ['▼', 0, 1], ['▶', 1, 0]].forEach(function (b) {
    var el = api.h('button', { type: 'button', 'aria-label': b[0] || null, text: b[0], style: b[0] ? null : { visibility: 'hidden' } });
    if (b[0]) el.addEventListener('pointerdown', function (e) { e.preventDefault(); turn(b[1], b[2]); });
    pad.append(el);
  });
  var wrap = api.h('div', { class: 'g-col', style: { height: '100%' } });
  api.el.append(wrap); wrap.append(C.cv, pad);
  return {
    start: function () { reset(); draw(); api.loop(function (dt) { if (dead) return; acc += dt; var sp = speed + Math.min(8, eaten * 0.25); while (acc > 1 / sp) { acc -= 1 / sp; step(); if (dead) return; } if (bonus) { bonus.t -= dt; if (bonus.t <= 0) bonus = null; } draw(); }); },
    key: function (e, down) { if (!down) return; var k = e.key; if (k === 'ArrowUp' || k === 'w') turn(0, -1); else if (k === 'ArrowDown' || k === 's') turn(0, 1); else if (k === 'ArrowLeft' || k === 'a') turn(-1, 0); else if (k === 'ArrowRight' || k === 'd') turn(1, 0); else return; e.preventDefault(); }
  };
});
