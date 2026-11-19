/* City Dash: endless 3-lane runner. Jump the low barriers, slide under the high ones, switch lanes past the boxes.
   Original implementation (own drawings, no characters or art from other games). */
WTG.register('runner', function (api) {
  var W = 360, H = 600, C = api.canvas(W, H, 80), x = C.ctx;
  var HOR = 170, GROUND = 540, FAR = 40;
  var sp0 = api.cfg('speed', { easy: 11, medium: 14, hard: 18 }[api.level]);
  var P, objs, speed, dist, coins, spawnZ, t, dead, lives;
  function reset() { P = { lane: 1, lx: 1, jump: 0, vy: 0, slide: 0 }; objs = []; speed = sp0; dist = 0; coins = 0; spawnZ = 12; t = 0; dead = false; lives = api.cfg('lives', api.level === 'easy' ? 3 : 1); info(); }
  function info() { api.info('❤️', lives); }
  function proj(lane, z) { var k = 1 / (1 + z * 0.12); return { x: W / 2 + (lane - 1) * 110 * k, y: HOR + (GROUND - HOR) * k, k: k }; }
  function spawn(z) {
    var free = [0, 1, 2], kinds = ['low', 'high', 'box'];
    var n = Math.random() < 0.35 ? 2 : 1; // never block all three lanes
    free = api.shuffle(free);
    for (var i = 0; i < n; i++) objs.push({ lane: free[i], z: z, kind: api.pick(kinds), hit: false });
    var cl = free[2]; if (Math.random() < 0.8) for (var j = 0; j < 4; j++) objs.push({ lane: cl, z: z + j * 1.6, kind: 'coin' });
  }
  function act(a) {
    if (api.paused || dead) return;
    if (a === 'l' && P.lane > 0) { P.lane--; api.sfx('move'); }
    else if (a === 'r' && P.lane < 2) { P.lane++; api.sfx('move'); }
    else if (a === 'u' && P.jump <= 0.001) { P.vy = 9.5; P.jump = 0.01; P.slide = 0; api.sfx('jump'); }
    else if (a === 'd') { P.slide = 0.7; if (P.jump > 0) P.vy = -14; api.sfx('move'); }
  }
  function update(dt) {
    t += dt; speed = sp0 + Math.min(16, t * 0.25); dist += speed * dt;
    P.lx += (P.lane - P.lx) * Math.min(1, dt * 14);
    if (P.jump > 0) { P.vy -= 26 * dt; P.jump += P.vy * dt; if (P.jump <= 0) { P.jump = 0; P.vy = 0; } }
    if (P.slide > 0) P.slide -= dt;
    objs.forEach(function (o) { o.z -= speed * dt; });
    spawnZ -= speed * dt;
    if (spawnZ < FAR - 6) { spawn(FAR); spawnZ = FAR + Math.max(6, 11 - t * 0.04); }
    objs.forEach(function (o) {
      if (o.hit || o.z > 0.6 || o.z < -0.6 || Math.abs(o.lane - P.lx) > 0.45) return;
      if (o.kind === 'coin') { o.hit = true; coins++; api.add(10); api.sfx('coin'); if (coins === 100) api.achieve('c100', { so: '100 lacag-ciyaareed', en: '100 coins' }); return; }
      var safe = (o.kind === 'low' && P.jump > 0.9) || (o.kind === 'high' && P.slide > 0);
      if (safe) return;
      o.hit = true; lives--; info(); api.sfx('hit');
      if (lives <= 0) { dead = true; api.lose(api.score, { so: Math.floor(dist) + ' mitir', en: Math.floor(dist) + ' m run' }); }
      else api.toast('❤️ ' + lives);
    });
    objs = objs.filter(function (o) { return o.z > -2 && !(o.kind === 'coin' && o.hit); });
    api.setScore(Math.floor(dist) + coins * 10);
    if (dist > 2000) api.achieve('d2000', { so: '2 km oo orod ah', en: '2 km run' });
  }
  function draw() {
    var sky = x.createLinearGradient(0, 0, 0, HOR); sky.addColorStop(0, '#0a2f5c'); sky.addColorStop(1, '#3aa0f0'); x.fillStyle = sky; x.fillRect(0, 0, W, HOR);
    // skyline
    x.fillStyle = '#0b2545';
    for (var b = 0; b < 12; b++) { var bx = ((b * 47 - dist * 0.6) % (W + 60) + W + 60) % (W + 60) - 30, bh = 30 + (b * 37 % 60); x.fillRect(bx, HOR - bh, 34, bh); }
    x.fillStyle = '#ffd166'; for (b = 0; b < 12; b++) { bx = ((b * 47 - dist * 0.6) % (W + 60) + W + 60) % (W + 60) - 30; x.fillRect(bx + 8, HOR - 20, 5, 5); x.fillRect(bx + 20, HOR - 34, 5, 5); }
    x.fillStyle = '#334155'; x.fillRect(0, HOR, W, H - HOR);
    // track
    var a = proj(-0.5, FAR), bb = proj(2.5, FAR), c = proj(2.5, -1), d = proj(-0.5, -1);
    x.fillStyle = '#475569'; x.beginPath(); x.moveTo(a.x, a.y); x.lineTo(bb.x, bb.y); x.lineTo(c.x, H); x.lineTo(d.x, H); x.fill();
    x.strokeStyle = '#e2e8f0'; x.lineWidth = 2;
    [0.5, 1.5].forEach(function (l) { var p1 = proj(l, FAR), p2 = proj(l, -1); x.beginPath(); x.moveTo(p1.x, p1.y); x.lineTo(p2.x, H); x.stroke(); });
    for (var z = (-(dist % 4)); z < FAR; z += 4) { var q = proj(-0.5, z), q2 = proj(2.5, z); x.strokeStyle = 'rgba(255,255,255,.12)'; x.beginPath(); x.moveTo(q.x, q.y); x.lineTo(q2.x, q2.y); x.stroke(); }
    // objects far to near
    objs.slice().sort(function (m, n) { return n.z - m.z; }).forEach(function (o) {
      if (o.z > FAR || o.z < -1.5) return;
      var p = proj(o.lane, o.z), s = p.k * 90;
      if (o.kind === 'coin') { x.fillStyle = '#ffb703'; x.beginPath(); x.ellipse(p.x, p.y - s * 0.6, s * 0.18, s * 0.22, 0, 0, 7); x.fill(); x.fillStyle = '#ffe08a'; x.fillRect(p.x - s * 0.04, p.y - s * 0.74, s * 0.08, s * 0.28); return; }
      if (o.kind === 'low') { x.fillStyle = '#F2060A'; x.fillRect(p.x - s * 0.5, p.y - s * 0.35, s, s * 0.2); x.fillStyle = '#fff'; for (var i = 0; i < 4; i++) x.fillRect(p.x - s * 0.5 + i * s * 0.28, p.y - s * 0.35, s * 0.12, s * 0.2); x.fillStyle = '#94a3b8'; x.fillRect(p.x - s * 0.45, p.y - s * 0.15, s * 0.06, s * 0.15); x.fillRect(p.x + s * 0.39, p.y - s * 0.15, s * 0.06, s * 0.15); }
      else if (o.kind === 'high') { x.fillStyle = '#94a3b8'; x.fillRect(p.x - s * 0.5, p.y - s * 1.3, s * 0.07, s * 1.3); x.fillRect(p.x + s * 0.43, p.y - s * 1.3, s * 0.07, s * 1.3); x.fillStyle = '#facc15'; x.fillRect(p.x - s * 0.5, p.y - s * 1.3, s, s * 0.35); x.fillStyle = '#04213f'; x.font = 'bold ' + Math.max(6, s * 0.2) + 'px sans-serif'; x.textAlign = 'center'; x.fillText('▼▼', p.x, p.y - s * 1.05); }
      else { x.fillStyle = '#b45309'; x.fillRect(p.x - s * 0.48, p.y - s * 0.95, s * 0.96, s * 0.95); x.strokeStyle = '#78350f'; x.lineWidth = Math.max(1, s * 0.05); x.strokeRect(p.x - s * 0.48, p.y - s * 0.95, s * 0.96, s * 0.95); x.beginPath(); x.moveTo(p.x - s * 0.48, p.y - s * 0.95); x.lineTo(p.x + s * 0.48, p.y); x.moveTo(p.x + s * 0.48, p.y - s * 0.95); x.lineTo(p.x - s * 0.48, p.y); x.stroke(); }
    });
    // runner (own simple design: Wartabiye blue kit)
    var pp = proj(P.lx, 0), s2 = 70, jy = P.jump * 22, sl = P.slide > 0;
    x.fillStyle = 'rgba(0,0,0,.3)'; x.beginPath(); x.ellipse(pp.x, pp.y, 22, 7, 0, 0, 7); x.fill();
    var by = pp.y - jy, run = Math.sin(t * 18) * (P.jump ? 0 : 1);
    if (sl) { x.fillStyle = '#037BDC'; x.fillRect(pp.x - 26, by - 26, 52, 20); x.fillStyle = '#f1c27d'; x.beginPath(); x.arc(pp.x + 26, by - 20, 10, 0, 7); x.fill(); }
    else {
      x.strokeStyle = '#04213f'; x.lineWidth = 7; x.lineCap = 'round';
      x.beginPath(); x.moveTo(pp.x - 6, by - s2 * 0.42); x.lineTo(pp.x - 8 - run * 8, by - 4); x.moveTo(pp.x + 6, by - s2 * 0.42); x.lineTo(pp.x + 8 + run * 8, by - 4); x.stroke();
      x.fillStyle = '#037BDC'; x.fillRect(pp.x - 14, by - s2 * 0.95, 28, s2 * 0.55); x.fillStyle = '#F2060A'; x.fillRect(pp.x - 14, by - s2 * 0.62, 28, 5);
      x.strokeStyle = '#f1c27d'; x.lineWidth = 6; x.beginPath(); x.moveTo(pp.x - 14, by - s2 * 0.85); x.lineTo(pp.x - 22, by - s2 * 0.55 + run * 6); x.moveTo(pp.x + 14, by - s2 * 0.85); x.lineTo(pp.x + 22, by - s2 * 0.55 - run * 6); x.stroke();
      x.fillStyle = '#f1c27d'; x.beginPath(); x.arc(pp.x, by - s2 * 1.1, 11, 0, 7); x.fill(); x.fillStyle = '#111'; x.fillRect(pp.x - 11, by - s2 * 1.24, 22, 6);
    }
    x.fillStyle = '#fff'; x.font = 'bold 16px sans-serif'; x.textAlign = 'left'; x.fillText('🪙 ' + coins + '   ' + Math.floor(dist) + ' m', 12, 26);
  }
  var sx, sy;
  C.cv.addEventListener('pointerdown', function (e) { sx = e.clientX; sy = e.clientY; e.preventDefault(); });
  C.cv.addEventListener('pointerup', function (e) { var dx = e.clientX - sx, dy = e.clientY - sy; if (Math.max(Math.abs(dx), Math.abs(dy)) < 18) { act('u'); return; } act(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'r' : 'l') : (dy > 0 ? 'd' : 'u')); });
  var bar = api.h('div', { class: 'g-row', style: { marginTop: '8px' } });
  [['◀', 'l'], ['▲', 'u'], ['▼', 'd'], ['▶', 'r']].forEach(function (b) { var el = api.h('button', { type: 'button', class: 'g-btn', text: b[0], 'aria-label': b[0] }); el.addEventListener('pointerdown', function (e) { e.preventDefault(); act(b[1]); }); bar.append(el); });
  var wrap = api.h('div', { class: 'g-col' }); api.el.append(wrap); wrap.append(C.cv, bar);
  return {
    start: function () { reset(); spawn(18); spawn(30); draw(); api.loop(function (dt) { if (!dead) update(dt); draw(); }); },
    key: function (e, down) { if (!down) return; var m = { ArrowLeft: 'l', ArrowRight: 'r', ArrowUp: 'u', ArrowDown: 'd', ' ': 'u', a: 'l', d: 'r', w: 'u', s: 'd' }[e.key]; if (m) { e.preventDefault(); act(m); } }
  };
});
