/* Park It!: drive the car into the green parking space without touching anything. 6 levels.
   Hold ▲ / ▼ to drive forward or back and ◀ ▶ to steer (arrow keys on a keyboard). Original implementation. */
WTG.register('parking', function (api) {
  var W = 360, H = 600, C = api.canvas(W, H, 150), x = C.ctx;
  var LV = [
    { car: [180, 520, -90], spot: [180, 120, -90], obs: [] },
    { car: [90, 520, -90], spot: [270, 140, -90], obs: [[150, 260, 60, 120]] },
    { car: [180, 540, -90], spot: [300, 300, 0], obs: [[255, 190, 90, 50], [255, 360, 90, 50]] },
    { car: [70, 540, -90], spot: [180, 90, 90], obs: [[110, 40, 40, 100], [210, 40, 40, 100], [0, 300, 200, 30]] },
    { car: [300, 540, -90], spot: [60, 300, 180], obs: [[0, 220, 120, 50], [0, 330, 120, 50], [180, 200, 30, 220]] },
    { car: [180, 550, -90], spot: [180, 300, -90], obs: [[120, 240, 30, 120], [210, 240, 30, 120], [60, 420, 90, 30], [210, 420, 90, 30], [140, 140, 80, 30]] }
  ];
  var lv, car, spot, obs, input = { t: 0, s: 0 }, hold, lives, tL;
  var tol = { easy: [22, 18], medium: [16, 13], hard: [11, 9] }[api.level];
  function load() { var L = LV[lv]; car = { x: L.car[0], y: L.car[1], a: L.car[2] * Math.PI / 180, v: 0 }; spot = { x: L.spot[0], y: L.spot[1], a: L.spot[2] * Math.PI / 180 }; obs = L.obs.map(function (o) { return { x: o[0], y: o[1], w: o[2], h: o[3] }; }); hold = 0; tL = 60; api.toast(api.t({ so: 'Heerka ', en: 'Level ' }) + (lv + 1) + ' / ' + LV.length); }
  var CL = 54, CW = 28;
  function corners(c) { var co = Math.cos(c.a), si = Math.sin(c.a), out = []; [[CL / 2, CW / 2], [CL / 2, -CW / 2], [-CL / 2, -CW / 2], [-CL / 2, CW / 2], [CL / 2, 0], [-CL / 2, 0], [0, CW / 2], [0, -CW / 2]].forEach(function (p) { out.push({ x: c.x + p[0] * co - p[1] * si, y: c.y + p[0] * si + p[1] * co }); }); return out; }
  function inCar(px, py) { var dx = px - car.x, dy = py - car.y, co = Math.cos(-car.a), si = Math.sin(-car.a), lx = dx * co - dy * si, ly = dx * si + dy * co; return Math.abs(lx) < CL / 2 && Math.abs(ly) < CW / 2; }
  function crashed() {
    var cs = corners(car);
    if (cs.some(function (p) { return p.x < 0 || p.x > W || p.y < 0 || p.y > H; })) return true;
    return obs.some(function (o) { return cs.some(function (p) { return p.x > o.x && p.x < o.x + o.w && p.y > o.y && p.y < o.y + o.h; }) || [[o.x, o.y], [o.x + o.w, o.y], [o.x, o.y + o.h], [o.x + o.w, o.y + o.h]].some(function (q) { return inCar(q[0], q[1]); }); });
  }
  function angDiff(a, b) { var d = (a - b) % (2 * Math.PI); if (d > Math.PI) d -= 2 * Math.PI; if (d < -Math.PI) d += 2 * Math.PI; return Math.abs(d); }
  function update(dt) {
    tL -= dt; api.info('⏱', Math.ceil(tL));
    var acc = 160, max = 120;
    car.v += input.t * acc * dt; car.v *= input.t ? 0.995 : 0.9; car.v = Math.max(-max * 0.6, Math.min(max, car.v));
    var steer = input.s * 0.6; car.a += car.v * Math.tan(steer) / 46 * dt;
    car.x += Math.cos(car.a) * car.v * dt; car.y += Math.sin(car.a) * car.v * dt;
    if (crashed()) { api.sfx('hit'); lives--; api.toast('💥 ❤️ ' + lives); if (lives <= 0) { api.lose(api.score, { so: 'Heerka ' + (lv + 1), en: 'Level ' + (lv + 1) }); return; } load(); return; }
    if (tL <= 0) { lives--; api.toast('⏱ ❤️ ' + lives); if (lives <= 0) { api.lose(api.score); return; } load(); return; }
    var d = Math.hypot(car.x - spot.x, car.y - spot.y), ad = Math.min(angDiff(car.a, spot.a), angDiff(car.a, spot.a + Math.PI));
    var ok = d < tol[0] && ad < tol[1] * Math.PI / 180 && Math.abs(car.v) < 12;
    hold = ok ? hold + dt : 0;
    if (hold > 0.8) {
      var pts = 200 + Math.ceil(tL) * 5 + Math.round((tol[0] - d) * 4); api.add(pts); api.sfx('win');
      if (d < 5) api.achieve('perfect', { so: 'Baarkin sax ah', en: 'Perfect parking' });
      lv++; if (lv >= LV.length) { api.win(api.score, { so: 'Dhammaan heerarka!', en: 'All levels done!' }); return; } load();
    }
  }
  function draw() {
    x.fillStyle = '#475569'; x.fillRect(0, 0, W, H);
    x.strokeStyle = 'rgba(255,255,255,.25)'; x.setLineDash([14, 12]); x.lineWidth = 2; x.beginPath(); x.moveTo(W / 2, 0); x.lineTo(W / 2, H); x.stroke(); x.setLineDash([]);
    // spot
    x.save(); x.translate(spot.x, spot.y); x.rotate(spot.a);
    x.fillStyle = hold > 0 ? 'rgba(34,197,94,.55)' : 'rgba(34,197,94,.3)'; x.fillRect(-CL / 2 - 8, -CW / 2 - 8, CL + 16, CW + 16);
    x.strokeStyle = '#fff'; x.lineWidth = 3; x.strokeRect(-CL / 2 - 8, -CW / 2 - 8, CL + 16, CW + 16);
    x.fillStyle = '#fff'; x.font = 'bold 18px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.rotate(-spot.a); x.fillText('P', 0, 0); x.restore();
    obs.forEach(function (o) { x.fillStyle = '#1e293b'; x.fillRect(o.x, o.y, o.w, o.h); x.fillStyle = '#f59e0b'; for (var i = 0; i < o.w; i += 20) x.fillRect(o.x + i, o.y, 10, 5); });
    // car
    x.save(); x.translate(car.x, car.y); x.rotate(car.a);
    x.fillStyle = 'rgba(0,0,0,.3)'; x.fillRect(-CL / 2 + 3, -CW / 2 + 4, CL, CW);
    x.fillStyle = '#037BDC'; x.beginPath(); x.roundRect ? x.roundRect(-CL / 2, -CW / 2, CL, CW, 7) : x.rect(-CL / 2, -CW / 2, CL, CW); x.fill();
    x.fillStyle = 'rgba(10,25,45,.8)'; x.fillRect(6, -CW / 2 + 4, 10, CW - 8); x.fillRect(-20, -CW / 2 + 4, 8, CW - 8);
    x.fillStyle = '#fde68a'; x.fillRect(CL / 2 - 3, -CW / 2 + 2, 3, 6); x.fillRect(CL / 2 - 3, CW / 2 - 8, 3, 6);
    x.fillStyle = '#F2060A'; x.fillRect(-CL / 2, -CW / 2 + 2, 3, 6); x.fillRect(-CL / 2, CW / 2 - 8, 3, 6);
    x.restore();
    x.fillStyle = '#fff'; x.font = 'bold 14px sans-serif'; x.textAlign = 'left'; x.fillText('❤️ ' + lives + '   ' + api.t({ so: 'Heer', en: 'Level' }) + ' ' + (lv + 1), 10, 22);
  }
  // controls: steering on the left, pedals on the right
  var pad = api.h('div', { class: 'g-row', style: { gap: '30px' } });
  function holdBtn(label, on, off) { var b = api.h('button', { type: 'button', class: 'g-btn', style: { minWidth: '64px', minHeight: '56px', fontSize: '24px' }, text: label, 'aria-label': label }); b.addEventListener('pointerdown', function (e) { e.preventDefault(); b.setPointerCapture(e.pointerId); on(); }); ['pointerup', 'pointercancel'].forEach(function (ev) { b.addEventListener(ev, off); }); return b; }
  pad.append(api.h('div', { class: 'g-row' }, holdBtn('◀', function () { input.s = -1; }, function () { if (input.s < 0) input.s = 0; }), holdBtn('▶', function () { input.s = 1; }, function () { if (input.s > 0) input.s = 0; })),
    api.h('div', { class: 'g-row' }, holdBtn('▼', function () { input.t = -1; }, function () { if (input.t < 0) input.t = 0; }), holdBtn('▲', function () { input.t = 1; }, function () { if (input.t > 0) input.t = 0; })));
  var wrap = api.h('div', { class: 'g-col' }); api.el.append(wrap); wrap.append(C.cv, pad);
  return {
    start: function () { lv = 0; lives = api.cfg('lives', api.level === 'easy' ? 5 : 3); load(); draw(); api.loop(function (dt) { update(dt); draw(); }); },
    key: function (e, down) { var k = e.key; if (k === 'ArrowUp' || k === 'w') input.t = down ? 1 : (input.t > 0 ? 0 : input.t); else if (k === 'ArrowDown' || k === 's') input.t = down ? -1 : (input.t < 0 ? 0 : input.t); else if (k === 'ArrowLeft' || k === 'a') input.s = down ? -1 : (input.s < 0 ? 0 : input.s); else if (k === 'ArrowRight' || k === 'd') input.s = down ? 1 : (input.s > 0 ? 0 : input.s); else return; e.preventDefault(); }
  };
});
