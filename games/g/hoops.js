/* Hoop Shot: basketball shooting. Drag back from the ball and let go to throw; score as many baskets as you can
   before the clock runs out. Original implementation. */
WTG.register('hoops', function (api) {
  var W = 360, H = 600, C = api.canvas(W, H, 20), x = C.ctx;
  var TIME = api.cfg('time', { easy: 75, medium: 60, hard: 45 }[api.level]), G = 900;
  var ball, hoop, dragging, start, cur, left, streak, made, shots, moving, scored, tries;
  function newHoop() { var m = api.level === 'easy' ? 0 : made; hoop = { x: 90 + Math.random() * 180, y: 170 + Math.random() * 60, vx: m >= 6 ? (api.level === 'hard' ? 70 : 40) * (Math.random() < 0.5 ? -1 : 1) : 0 }; }
  function newBall() { ball = { x: 90 + Math.random() * 180, y: H - 90, vx: 0, vy: 0, r: 18, live: false, rot: 0 }; scored = false; tries = 0; }
  function reset() { left = TIME; streak = 0; made = 0; shots = 0; newHoop(); newBall(); api.info('⏱', WTG.fmtTime(left)); }
  function rim() { return [{ x: hoop.x - 34, y: hoop.y }, { x: hoop.x + 34, y: hoop.y }]; }
  function update(dt) {
    left -= dt; api.info('⏱', WTG.fmtTime(left));
    if (left <= 0) { api.end({ won: made >= 10, score: api.score, msg: { so: made + ' kubadood oo gashay', en: made + ' baskets' } }); return; }
    if (hoop.vx) { hoop.x += hoop.vx * dt; if (hoop.x < 70 || hoop.x > W - 70) hoop.vx *= -1; }
    if (!ball.live) return;
    var steps = 4; for (var s = 0; s < steps; s++) {
      var d = dt / steps;
      ball.vy += G * d; ball.x += ball.vx * d; ball.y += ball.vy * d; ball.rot += ball.vx * d * 0.05;
      rim().forEach(function (p) { var dx = ball.x - p.x, dy = ball.y - p.y, dd = Math.hypot(dx, dy); if (dd < ball.r + 4 && dd > 0) { var nx = dx / dd, ny = dy / dd, dot = ball.vx * nx + ball.vy * ny; if (dot < 0) { ball.vx -= 1.6 * dot * nx; ball.vy -= 1.6 * dot * ny; ball.vx *= 0.8; ball.vy *= 0.8; api.sfx('tick'); } ball.x = p.x + nx * (ball.r + 4); ball.y = p.y + ny * (ball.r + 4); tries++; } });
      if (!scored && ball.vy > 0 && Math.abs(ball.x - hoop.x) < 28 && ball.y > hoop.y - 4 && ball.y < hoop.y + 14) {
        scored = true; made++; streak++;
        var pts = (tries === 0 ? 3 : 2) + (streak >= 3 ? 1 : 0); api.add(pts * 10); api.sfx('win');
        api.toast((tries === 0 ? 'SWISH! ' : '') + '+' + pts * 10);
        if (streak === 5) api.achieve('hot', { so: '5 isku xigta', en: '5 in a row' });
        if (made === 20) api.achieve('20', { so: '20 kubadood', en: '20 baskets' });
      }
    }
    if (ball.x < -40 || ball.x > W + 40 || ball.y > H + 40) { if (!scored) { streak = 0; api.sfx('bad'); } if (scored) newHoop(); newBall(); }
  }
  function draw() {
    var g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#0a2f5c'); g.addColorStop(1, '#04213f'); x.fillStyle = g; x.fillRect(0, 0, W, H);
    x.fillStyle = '#c2843b'; x.fillRect(0, H - 60, W, 60); x.strokeStyle = 'rgba(0,0,0,.2)'; for (var i = 0; i < W; i += 40) { x.beginPath(); x.moveTo(i, H - 60); x.lineTo(i, H); x.stroke(); }
    x.fillStyle = 'rgba(255,255,255,.06)'; x.font = 'bold 60px Archivo,sans-serif'; x.textAlign = 'center'; x.fillText('WTV', W / 2, H / 2 + 40);
    // board and hoop
    x.fillStyle = 'rgba(255,255,255,.92)'; x.fillRect(hoop.x - 50, hoop.y - 88, 100, 66); x.strokeStyle = '#F2060A'; x.lineWidth = 3; x.strokeRect(hoop.x - 22, hoop.y - 54, 44, 32);
    x.fillStyle = '#64748b'; x.fillRect(hoop.x - 4, hoop.y - 22, 8, 22);
    x.strokeStyle = 'rgba(255,255,255,.8)'; x.lineWidth = 1.5;
    for (var k = 0; k <= 6; k++) { x.beginPath(); x.moveTo(hoop.x - 32 + k * 10.6, hoop.y); x.lineTo(hoop.x - 20 + k * 6.6, hoop.y + 42); x.stroke(); }
    var bb = ball;
    if (bb.y < hoop.y) drawBall();
    x.strokeStyle = '#ff6b00'; x.lineWidth = 5; x.beginPath(); x.moveTo(hoop.x - 36, hoop.y); x.lineTo(hoop.x + 36, hoop.y); x.stroke();
    if (bb.y >= hoop.y) drawBall();
    if (dragging && cur) {
      var v = vel(); x.fillStyle = 'rgba(255,255,255,.7)';
      var px = ball.x, py = ball.y, vx = v.x, vy = v.y;
      for (var s = 0; s < 14; s++) { px += vx * 0.05; py += vy * 0.05; vy += G * 0.05; x.beginPath(); x.arc(px, py, 3, 0, 7); x.fill(); }
    }
    x.fillStyle = '#fff'; x.font = 'bold 14px sans-serif'; x.textAlign = 'left'; x.fillText('🏀 ' + made + '   🔥 ' + streak, 12, 24);
    if (!ball.live && !dragging) { x.textAlign = 'center'; x.fillStyle = 'rgba(255,255,255,.75)'; x.font = 'bold 13px sans-serif'; x.fillText('↓ ' + api.t({ so: 'Hoos u jiid oo sii daa', en: 'Pull back and release', ar: 'اسحب للخلف ثم اترك', fr: 'Tirez puis relâchez', nl: 'Trek terug en laat los', it: 'Tira indietro e rilascia', de: 'Zurückziehen und loslassen', tr: 'Geri çek ve bırak', es: 'Tira hacia atrás y suelta' }), W / 2, H - 20); }
  }
  function drawBall() {
    x.save(); x.translate(ball.x, ball.y); x.rotate(ball.rot);
    x.fillStyle = '#f97316'; x.beginPath(); x.arc(0, 0, ball.r, 0, 7); x.fill();
    x.strokeStyle = '#7c2d12'; x.lineWidth = 2; x.beginPath(); x.moveTo(-ball.r, 0); x.lineTo(ball.r, 0); x.moveTo(0, -ball.r); x.lineTo(0, ball.r); x.stroke();
    x.beginPath(); x.arc(-ball.r * 1.1, 0, ball.r * 0.8, -0.9, 0.9); x.stroke(); x.beginPath(); x.arc(ball.r * 1.1, 0, ball.r * 0.8, Math.PI - 0.9, Math.PI + 0.9); x.stroke();
    x.restore();
  }
  function vel() { var dx = start.x - cur.x, dy = start.y - cur.y; var k = 5.2; return { x: Math.max(-700, Math.min(700, dx * k)), y: Math.max(-1150, Math.min(0, dy * k)) }; }
  C.cv.addEventListener('pointerdown', function (e) { if (api.paused || ball.live) return; e.preventDefault(); dragging = true; start = C.pt(e); cur = start; C.cv.setPointerCapture(e.pointerId); });
  C.cv.addEventListener('pointermove', function (e) { if (dragging) cur = C.pt(e); });
  C.cv.addEventListener('pointerup', function () { if (!dragging) return; dragging = false; var v = vel(); if (Math.hypot(v.x, v.y) < 200) return; ball.vx = v.x; ball.vy = v.y; ball.live = true; shots++; api.sfx('jump'); });
  api.el.append(C.cv);
  return {
    start: function () { reset(); draw(); api.loop(function (dt) { update(dt); draw(); }); }
  };
});
