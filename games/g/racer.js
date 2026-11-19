/* Highway Racer: steer through traffic, collect coins and fuel. Original implementation. */
WTG.register('racer', function (api) {
  var W = 360, H = 600, C = api.canvas(W, H, 80), x = C.ctx;
  var ROAD = 260, L0 = (W - ROAD) / 2, LANES = 4, LW = ROAD / LANES;
  var base = { easy: 220, medium: 280, hard: 350 }[api.level];
  var car, cars, items, speed, dist, steer, spawnT, fuel, dead, t;
  var COLORS = ['#ef4444', '#f59e0b', '#22c55e', '#a855f7', '#e2e8f0', '#14b8a6'];
  function reset() { car = { x: W / 2, y: H - 110, w: 36, h: 62 }; cars = []; items = []; speed = base; dist = 0; steer = 0; spawnT = 0.5; fuel = 100; dead = false; t = 0; }
  function spawn() {
    var lane = api.rand(0, LANES - 1), lx = L0 + lane * LW + LW / 2;
    if (cars.some(function (c) { return c.y < 80 && Math.abs(c.x - lx) < 40; })) return;
    var r = Math.random();
    if (r < 0.15) items.push({ x: lx, y: -40, k: 'fuel' });
    else if (r < 0.4) items.push({ x: lx, y: -40, k: 'coin' });
    else cars.push({ x: lx, y: -80, w: 36, h: 62, v: 90 + Math.random() * 90, c: api.pick(COLORS), truck: Math.random() < 0.2 });
  }
  function drawCar(cx, cy, w, h, col, me) {
    x.fillStyle = 'rgba(0,0,0,.3)'; x.fillRect(cx - w / 2 + 3, cy - h / 2 + 5, w, h);
    x.fillStyle = col; x.beginPath(); x.roundRect ? x.roundRect(cx - w / 2, cy - h / 2, w, h, 9) : x.rect(cx - w / 2, cy - h / 2, w, h); x.fill();
    x.fillStyle = 'rgba(10,25,45,.85)'; x.fillRect(cx - w / 2 + 5, cy - h / 2 + (me ? 12 : h - 24), w - 10, 12); x.fillRect(cx - w / 2 + 5, cy - h / 2 + (me ? h - 18 : 8), w - 10, 8);
    x.fillStyle = me ? '#fff' : '#fde68a'; x.fillRect(cx - w / 2 + 4, cy - h / 2 + (me ? 1 : h - 4), 7, 3); x.fillRect(cx + w / 2 - 11, cy - h / 2 + (me ? 1 : h - 4), 7, 3);
    if (me) { x.fillStyle = '#F2060A'; x.fillRect(cx - 3, cy - h / 2, 6, h); }
  }
  function update(dt) {
    t += dt; speed = base + Math.min(260, t * 6);
    car.x += steer * 260 * dt; car.x = Math.max(L0 + car.w / 2, Math.min(L0 + ROAD - car.w / 2, car.x));
    dist += speed * dt / 50; fuel -= dt * (api.level === 'easy' ? 2 : 3.2);
    spawnT -= dt; if (spawnT <= 0) { spawn(); spawnT = Math.max(0.28, 0.9 - t * 0.008) * (300 / speed) * 1.4; }
    cars.forEach(function (c) { c.y += (speed - c.v) * dt; });
    items.forEach(function (i) { i.y += speed * dt; });
    cars = cars.filter(function (c) { return c.y < H + 100; });
    items = items.filter(function (i) {
      if (i.y > H + 40) return false;
      if (Math.abs(i.x - car.x) < 30 && Math.abs(i.y - car.y) < 40) { if (i.k === 'coin') { coinScore += 25; api.sfx('coin'); } else { fuel = Math.min(100, fuel + 35); api.sfx('good'); } return false; }
      return true;
    });
    for (var k = 0; k < cars.length; k++) { var c = cars[k]; var hh = c.truck ? 90 : c.h; if (Math.abs(c.x - car.x) < (c.w + car.w) / 2 - 4 && Math.abs(c.y - car.y) < (hh + car.h) / 2 - 6) { crash(); return; } }
    if (fuel <= 0) { fuel = 0; dead = true; api.lose(api.score, { so: 'Shidaalku wuu dhammaaday', en: 'Out of fuel' }); return; }
    api.setScore(Math.floor(dist) + coinScore);
    if (dist > 1000) api.achieve('km1', { so: '1000 mitir', en: '1000 m' });
  }
  var coinScore = 0;
  function crash() { dead = true; api.sfx('hit'); api.lose(api.score, { so: 'Gaadhi ayaad ku dhacday', en: 'You crashed' }); }
  var off = 0;
  function draw() {
    x.fillStyle = '#166534'; x.fillRect(0, 0, W, H);
    x.fillStyle = '#15803d'; for (var i = 0; i < 14; i++) { var ty = ((i * 60 + off) % (H + 60)) - 30; x.beginPath(); x.arc(20, ty, 12, 0, 7); x.arc(W - 20, ty + 30, 12, 0, 7); x.fill(); }
    x.fillStyle = '#374151'; x.fillRect(L0, 0, ROAD, H);
    x.fillStyle = '#fff'; x.fillRect(L0 - 6, 0, 6, H); x.fillRect(L0 + ROAD, 0, 6, H);
    x.fillStyle = '#e5e7eb'; for (var l = 1; l < LANES; l++) for (i = -1; i < 12; i++) x.fillRect(L0 + l * LW - 2, i * 60 + (off % 60), 4, 32);
    items.forEach(function (it) { x.font = '26px serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(it.k === 'coin' ? '🪙' : '⛽', it.x, it.y); });
    cars.forEach(function (c) { drawCar(c.x, c.y, c.w, c.truck ? 90 : c.h, c.c, false); });
    drawCar(car.x, car.y, car.w, car.h, '#037BDC', true);
    // fuel gauge
    x.fillStyle = 'rgba(0,0,0,.45)'; x.fillRect(10, 10, 120, 20); x.fillStyle = fuel > 30 ? '#22c55e' : '#ef4444'; x.fillRect(12, 12, 116 * fuel / 100, 16);
    x.fillStyle = '#fff'; x.font = 'bold 12px sans-serif'; x.textAlign = 'left'; x.textBaseline = 'middle'; x.fillText('⛽ ' + Math.ceil(fuel) + '%', 16, 20);
    x.textAlign = 'right'; x.font = 'bold 14px sans-serif'; x.fillText(Math.round(speed / 3) + ' km/h', W - 10, 20);
  }
  // hold buttons, drag, or tilt-free keys
  var dragging = false;
  C.cv.addEventListener('pointerdown', function (e) { dragging = true; C.cv.setPointerCapture(e.pointerId); move(e); });
  C.cv.addEventListener('pointermove', function (e) { if (dragging) move(e); });
  C.cv.addEventListener('pointerup', function () { dragging = false; steer = 0; });
  function move(e) { if (api.paused || dead) return; var p = C.pt(e); steer = Math.max(-1, Math.min(1, (p.x - car.x) / 40)); }
  var bar = api.h('div', { class: 'g-row', style: { marginTop: '8px' } });
  [['◀', -1], ['▶', 1]].forEach(function (b) { var el = api.h('button', { type: 'button', class: 'g-btn', style: { minWidth: '110px' }, text: b[0], 'aria-label': b[0] }); el.addEventListener('pointerdown', function (e) { e.preventDefault(); steer = b[1]; }); ['pointerup', 'pointerleave', 'pointercancel'].forEach(function (ev) { el.addEventListener(ev, function () { if (steer === b[1]) steer = 0; }); }); bar.append(el); });
  var wrap = api.h('div', { class: 'g-col' }); api.el.append(wrap); wrap.append(C.cv, bar);
  return {
    start: function () { reset(); coinScore = 0; draw(); api.loop(function (dt) { if (!dead) { off += speed * dt; update(dt); } draw(); }); },
    key: function (e, down) { if (e.key === 'ArrowLeft' || e.key === 'a') { steer = down ? -1 : (steer < 0 ? 0 : steer); e.preventDefault(); } else if (e.key === 'ArrowRight' || e.key === 'd') { steer = down ? 1 : (steer > 0 ? 0 : steer); e.preventDefault(); } }
  };
});
