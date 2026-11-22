/* Block Builder: a creative building game. Pick a block and tap or drag to place it; use the eraser to remove.
   Build houses, towers and gardens. Your world is saved on this device. Original implementation and art. */
WTG.register('builder', function (api) {
  var h = api.h, COLS = 32, ROWS = 20, S = 24, W = COLS * S, H = ROWS * S;
  var C = api.canvas(W, H, 150), x = C.ctx;
  var B = [
    { id: 'grass', n: { so: 'Caws', en: 'Grass' }, c: '#16a34a', top: '#4ade80' }, { id: 'dirt', n: { so: 'Ciid', en: 'Dirt' }, c: '#92400e' },
    { id: 'stone', n: { so: 'Dhagax', en: 'Stone' }, c: '#64748b' }, { id: 'wood', n: { so: 'Alwaax', en: 'Wood' }, c: '#a16207', lines: 1 },
    { id: 'leaf', n: { so: 'Caleen', en: 'Leaves' }, c: '#15803d', dots: 1 }, { id: 'sand', n: { so: 'Bacaad', en: 'Sand' }, c: '#fcd34d' },
    { id: 'water', n: { so: 'Biyo', en: 'Water' }, c: '#38bdf8', alpha: 0.8 }, { id: 'brick', n: { so: 'Leben', en: 'Brick' }, c: '#b91c1c', brick: 1 },
    { id: 'glass', n: { so: 'Muraayad', en: 'Glass' }, c: '#e0f2fe', alpha: 0.45 }, { id: 'gold', n: { so: 'Dahab', en: 'Gold' }, c: '#facc15', shine: 1 },
    { id: 'white', n: { so: 'Cad', en: 'White' }, c: '#f8fafc' }, { id: 'blue', n: { so: 'Buluug', en: 'Blue' }, c: '#037BDC' },
    { id: 'red', n: { so: 'Cas', en: 'Red' }, c: '#F2060A' }, { id: 'lamp', n: { so: 'Nal', en: 'Lamp' }, c: '#fde68a', glow: 1 }
  ];
  var grid, cur = 3, erase = false, placed = 0, drawing = false, night = false;
  function blank() { var g = []; for (var i = 0; i < COLS * ROWS; i++) g.push(-1); return g; }
  function world() {
    var g = blank(), hgt = 13;
    for (var c = 0; c < COLS; c++) {
      hgt += api.rand(-1, 1); hgt = Math.max(11, Math.min(15, hgt));
      for (var r = hgt; r < ROWS; r++) g[r * COLS + c] = r === hgt ? 0 : r < hgt + 3 ? 1 : 2;
      if (c > 2 && c < COLS - 3 && Math.random() < 0.12) { for (var t = 1; t <= 3; t++) g[(hgt - t) * COLS + c] = 3; [[-4, -1], [-4, 0], [-4, 1], [-5, 0], [-3, -1], [-3, 1]].forEach(function (o) { var rr = hgt + o[0], cc = c + o[1]; if (rr >= 0) g[rr * COLS + cc] = 4; }); }
    }
    for (c = 20; c < 26; c++) for (r = 0; r < ROWS; r++) if (g[r * COLS + c] === 0) { g[r * COLS + c] = 6; if (g[(r + 1) * COLS + c] === 1) g[(r + 1) * COLS + c] = 5; }
    return g;
  }
  function drawBlock(c, r, b) {
    var X = c * S, Y = r * S, T = B[b];
    x.globalAlpha = T.alpha || 1; x.fillStyle = T.c; x.fillRect(X, Y, S, S);
    if (T.top) { x.fillStyle = T.top; x.fillRect(X, Y, S, 6); }
    if (T.lines) { x.fillStyle = 'rgba(0,0,0,.18)'; x.fillRect(X + 7, Y, 2, S); x.fillRect(X + 16, Y, 2, S); }
    if (T.dots) { x.fillStyle = 'rgba(255,255,255,.18)'; x.fillRect(X + 4, Y + 5, 4, 4); x.fillRect(X + 14, Y + 12, 4, 4); x.fillRect(X + 8, Y + 17, 3, 3); }
    if (T.brick) { x.fillStyle = 'rgba(255,255,255,.35)'; x.fillRect(X, Y + 11, S, 2); x.fillRect(X + 11, Y, 2, 11); x.fillRect(X + 4, Y + 13, 2, 11); x.fillRect(X + 18, Y + 13, 2, 11); }
    if (T.shine) { x.fillStyle = 'rgba(255,255,255,.6)'; x.fillRect(X + 4, Y + 4, 6, 3); }
    if (T.glow && night) { x.globalAlpha = 0.25; x.fillStyle = '#fde68a'; x.beginPath(); x.arc(X + S / 2, Y + S / 2, S * 2.4, 0, 7); x.fill(); }
    x.globalAlpha = 1; x.strokeStyle = 'rgba(0,0,0,.18)'; x.strokeRect(X + 0.5, Y + 0.5, S - 1, S - 1);
  }
  function draw() {
    var g = x.createLinearGradient(0, 0, 0, H); if (night) { g.addColorStop(0, '#020617'); g.addColorStop(1, '#1e1b4b'); } else { g.addColorStop(0, '#7dd3fc'); g.addColorStop(1, '#e0f2fe'); }
    x.fillStyle = g; x.fillRect(0, 0, W, H);
    x.fillStyle = night ? '#f1f5f9' : '#facc15'; x.beginPath(); x.arc(W - 60, 50, 26, 0, 7); x.fill();
    if (night) { x.fillStyle = '#fff'; for (var s = 0; s < 40; s++) x.fillRect((s * 131) % W, (s * 71) % (H / 2), 2, 2); }
    for (var i = 0; i < grid.length; i++) if (grid[i] >= 0) drawBlock(i % COLS, Math.floor(i / COLS), grid[i]);
  }
  function put(e) {
    if (api.paused) return; var p = C.pt(e), c = Math.floor(p.x / S), r = Math.floor(p.y / S); if (c < 0 || r < 0 || c >= COLS || r >= ROWS) return;
    var i = r * COLS + c, v = erase ? -1 : cur; if (grid[i] === v) return;
    grid[i] = v; if (!erase) { placed++; api.add(1); if (placed === 100) api.achieve('100', { so: '100 dhagax la dhigay', en: '100 blocks placed' }); if (placed === 500) api.achieve('500', { so: '500 dhagax', en: '500 blocks' }); }
    api.sfx(erase ? 'pop' : 'tick'); draw(); dirty = true;
  }
  var dirty = false;
  C.cv.addEventListener('pointerdown', function (e) { e.preventDefault(); drawing = true; C.cv.setPointerCapture(e.pointerId); put(e); });
  C.cv.addEventListener('pointermove', function (e) { if (drawing) put(e); });
  C.cv.addEventListener('pointerup', function () { drawing = false; save(); });
  function save() { if (dirty) { api.save('world', grid.join(',')); dirty = false; } }
  var pal = h('div', { class: 'g-row', style: { maxWidth: '760px' } });
  function paletteUI() {
    pal.innerHTML = '';
    B.forEach(function (b, i) { pal.append(h('button', { type: 'button', title: api.t(b.n), 'aria-label': api.t(b.n), 'aria-pressed': String(i === cur && !erase), style: { width: '38px', height: '38px', borderRadius: '9px', border: i === cur && !erase ? '3px solid #ffb703' : '2px solid rgba(255,255,255,.4)', background: b.c, cursor: 'pointer', opacity: b.alpha ? 0.85 : 1 }, onclick: function () { cur = i; erase = false; paletteUI(); } })); });
    pal.append(h('button', { type: 'button', class: 'g-btn sm' + (erase ? ' blue' : ''), text: '🧽', 'aria-label': 'Eraser', onclick: function () { erase = !erase; paletteUI(); } }),
      h('button', { type: 'button', class: 'g-btn sm', text: night ? '☀️' : '🌙', 'aria-label': 'Day / night', onclick: function () { night = !night; paletteUI(); draw(); } }),
      h('button', { type: 'button', class: 'g-btn sm', text: '🌍 ' + api.t({ so: 'Adduun cusub', en: 'New world' }), onclick: function () { grid = world(); dirty = true; save(); draw(); } }),
      h('button', { type: 'button', class: 'g-btn sm', text: '⬜ ' + api.t({ so: 'Bannaan', en: 'Empty' }), onclick: function () { grid = blank(); for (var c = 0; c < COLS; c++) grid[(ROWS - 1) * COLS + c] = 0; dirty = true; save(); draw(); } }),
      h('button', { type: 'button', class: 'g-btn sm blue', text: '💾 ' + api.t({ so: 'Kaydi', en: 'Save' }), onclick: function () { dirty = true; save(); api.toast(api.s('saved')); api.sfx('good'); } }));
  }
  var wrap = h('div', { class: 'g-col' }); api.el.append(wrap); wrap.append(C.cv, pal);
  return {
    start: function () { var sv = api.load('world'); grid = sv ? sv.split(',').map(Number) : world(); if (grid.length !== COLS * ROWS) grid = world(); placed = 0; paletteUI(); draw(); if (sv) api.toast(api.s('saved')); },
    pause: save, destroy: save,
    key: function (e, down) { if (!down) return; var n = parseInt(e.key, 10); if (n >= 1 && n <= 9) { cur = n - 1; erase = false; paletteUI(); } else if (e.key === 'e') { erase = !erase; paletteUI(); } }
  };
});
