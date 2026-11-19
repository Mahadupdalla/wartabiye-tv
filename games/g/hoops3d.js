/* Hoop Shot 3D: basketball shooting in an indoor arena. Swipe the ball up towards the basket: the length of the swipe
   is the power, its direction the aim. Score as many baskets as you can before the clock runs out.
   Original 3D models (court, glass backboard, rim and net) with simple real ball physics. */
WTG.register3d('hoops3d', function (M, api) {
  var T = M.T, SO = api.lang === 'so';
  var X = M.setup(api, { fov: 55, far: 120, bg: ['#020617', '#0f172a', '#1e293b'], reserve: 10, label: 'Hoop Shot 3D', exposure: 1.1, envIntensity: 0.6 });
  var scene = X.scene, cam = X.camera;
  var COURT = { blue: 'rgba(3,123,220,.85)', red: 'rgba(220,38,38,.85)', green: 'rgba(22,163,74,.85)', purple: 'rgba(124,58,237,.85)' }[api.cfg('court', 'blue')] || 'rgba(3,123,220,.85)', GUIDE = api.cfg('guide', 'auto'), MOVE = api.cfg('move', 'auto');
  var TIME = api.cfg('time', { easy: 75, medium: 60, hard: 45 }[api.level]), G = 9.8, RIM = 3.05, RR = 0.23, BR = 0.12, BOARD_Z = -0.38;
  scene.add(new T.AmbientLight(0x8090b0, 0.45));
  var S = M.sun(scene, { color: 0xfff4e0, intensity: 2.0, hemi: 0.55, sky: 0xd6e4ff, ground: 0x4a2f16, offset: new T.Vector3(3, 12, 8), size: 10 });
  S.follow(new T.Vector3(0, 0, 3));
  var spot = new T.SpotLight(0xffffff, 60, 30, 0.6, 0.5, 1.2); spot.position.set(0, 10, 3); spot.target.position.set(0, 2, 0); scene.add(spot, spot.target);

  // ---------------------------------------------------------------- arena
  var woodTex = M.canvasTex(1024, 1024, function (x, w, h) {
    for (var i = 0; i < 32; i++) { var c = 175 + ((i * 37) % 30); x.fillStyle = 'rgb(' + c + ',' + (c - 60) + ',' + (c - 120) + ')'; x.fillRect(i * 32, 0, 32, h); x.fillStyle = 'rgba(70,35,10,.35)'; x.fillRect(i * 32, 0, 2, h); for (var j = 0; j < 4; j++) { x.fillRect(i * 32, ((i * 131 + j * 260) % h), 32, 2); } }
    M.noise(x, w, h, 20000, 0.05);
    x.strokeStyle = 'rgba(255,255,255,.95)'; x.lineWidth = 8;
    var cx = w / 2, by = 60, s = 1024 / 15;                     // 15 m texture, basket at y = 60 px + 1.2 m
    x.fillStyle = COURT; x.fillRect(cx - 2.45 * s, by, 4.9 * s, 5.8 * s);
    x.strokeRect(cx - 2.45 * s, by, 4.9 * s, 5.8 * s); x.beginPath(); x.arc(cx, by + 5.8 * s, 1.8 * s, 0, Math.PI); x.stroke();
    x.beginPath(); x.arc(cx, by + 1.2 * s, 6.75 * s, 0.03 * Math.PI, 0.97 * Math.PI); x.stroke();
    x.strokeStyle = '#f2060a'; x.beginPath(); x.moveTo(0, by); x.lineTo(w, by); x.stroke();
    x.fillStyle = 'rgba(255,255,255,.16)'; x.font = '900 120px Archivo,sans-serif'; x.textAlign = 'center'; x.fillText('WTV', cx, by + 10.5 * s);
  });
  var floor = new T.Mesh(new T.PlaneGeometry(15, 15), new T.MeshStandardMaterial({ map: woodTex, roughness: 0.35, metalness: 0.05 }));
  floor.rotation.x = -Math.PI / 2; floor.position.set(0, 0, 15 / 2 - 60 / 1024 * 15 - 1.2); floor.receiveShadow = true; scene.add(floor);
  var crowdTex = M.canvasTex(1024, 256, function (x, w, h) { x.fillStyle = '#0b1220'; x.fillRect(0, 0, w, h); var cols = ['#7f1d1d', '#1e3a8a', '#9ca3af', '#a16207', '#9a3412', '#166534', '#374151']; for (var r = 0; r < 14; r++) for (var c = 0; c < 110; c++) { x.fillStyle = cols[(Math.random() * cols.length) | 0]; x.beginPath(); x.arc(c * 9.4 + 5 + (r % 2) * 4, r * 18 + 10, 3.6, 0, 7); x.fill(); x.fillStyle = '#6b4226'; x.beginPath(); x.arc(c * 9.4 + 5 + (r % 2) * 4, r * 18 + 4, 2.4, 0, 7); x.fill(); } }, [2, 1]);
  var wallM = new T.MeshStandardMaterial({ map: crowdTex, roughness: 0.95, color: 0x8a8a8a });
  var wall = new T.Mesh(new T.PlaneGeometry(40, 12), wallM); wall.position.set(0, 5, -7); scene.add(wall);
  [-1, 1].forEach(function (s) { var sw = new T.Mesh(new T.PlaneGeometry(30, 12), wallM); sw.rotation.y = -s * Math.PI / 2; sw.position.set(s * 9, 5, 6); scene.add(sw); });
  var banner = M.canvasTex(1024, 96, function (x, w, h) { var g = x.createLinearGradient(0, 0, w, 0); g.addColorStop(0, '#0b2545'); g.addColorStop(0.5, '#037bdc'); g.addColorStop(1, '#0b2545'); x.fillStyle = g; x.fillRect(0, 0, w, h); x.fillStyle = '#fff'; x.font = '900 54px Archivo,sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('WARTABIYE TV', w / 4, h / 2 + 2); x.fillText('WARTABIYE TV', w * 3 / 4, h / 2 + 2); });
  var ban = new T.Mesh(new T.PlaneGeometry(14, 1.3), new T.MeshStandardMaterial({ map: banner, emissiveMap: banner, emissive: 0xffffff, emissiveIntensity: 0.5 })); ban.position.set(0, 1.0, -6.95); scene.add(ban);

  // ---------------------------------------------------------------- basket
  var hoop = new T.Group(); scene.add(hoop);
  var glass = new T.Mesh(new T.BoxGeometry(1.8, 1.05, 0.04), new T.MeshPhysicalMaterial({ color: 0xffffff, transparent: true, opacity: 0.28, roughness: 0.05, metalness: 0, clearcoat: 1 }));
  glass.position.set(0, RIM + 0.45, BOARD_Z - 0.02); hoop.add(glass);
  var frameM = M.mat(0xffffff, { roughness: 0.3 }), redM = M.mat(0xf2060a, { roughness: 0.4 });
  [[0, RIM + 0.97, 1.8, 0.05], [0, RIM - 0.07, 1.8, 0.05]].forEach(function (b) { var m = new T.Mesh(new T.BoxGeometry(b[2], b[3], 0.05), frameM); m.position.set(b[0], b[1], BOARD_Z); hoop.add(m); });
  [-0.9, 0.9].forEach(function (x0) { var m = new T.Mesh(new T.BoxGeometry(0.05, 1.05, 0.05), frameM); m.position.set(x0, RIM + 0.45, BOARD_Z); hoop.add(m); });
  [[0, RIM + 0.15, 0.59, 0.04], [0, RIM + 0.6, 0.59, 0.04]].forEach(function (b) { var m = new T.Mesh(new T.BoxGeometry(b[2], b[3], 0.01), redM); m.position.set(b[0], b[1], BOARD_Z + 0.02); hoop.add(m); });
  [-0.295, 0.295].forEach(function (x0) { var m = new T.Mesh(new T.BoxGeometry(0.04, 0.49, 0.01), redM); m.position.set(x0, RIM + 0.375, BOARD_Z + 0.02); hoop.add(m); });
  var rimM = new T.MeshStandardMaterial({ color: 0xff5a00, metalness: 0.6, roughness: 0.35 });
  var rim = new T.Mesh(new T.TorusGeometry(RR, 0.018, 10, 36), rimM); rim.rotation.x = Math.PI / 2; rim.position.set(0, RIM, 0); hoop.add(rim);
  var arm = new T.Mesh(new T.BoxGeometry(0.1, 0.04, 0.16), rimM); arm.position.set(0, RIM, BOARD_Z + 0.08); hoop.add(arm);
  var pole = new T.Mesh(new T.CylinderGeometry(0.09, 0.11, RIM + 0.5, 12), M.mat(0x334155, { metalness: 0.7, roughness: 0.4 })); pole.position.set(0, (RIM + 0.5) / 2, BOARD_Z - 1.1); hoop.add(pole);
  var beam = new T.Mesh(new T.BoxGeometry(0.12, 0.12, 1.1), M.mat(0x334155, { metalness: 0.7 })); beam.position.set(0, RIM + 0.45, BOARD_Z - 0.55); hoop.add(beam);
  var pad = new T.Mesh(new T.CylinderGeometry(0.2, 0.2, 1.6, 12), M.mat(0x037bdc)); pad.position.set(0, 0.8, BOARD_Z - 1.1); hoop.add(pad);
  var netTex = M.canvasTex(256, 128, function (x, w, h) { x.strokeStyle = '#fff'; x.lineWidth = 3; for (var i = -8; i < 24; i++) { x.beginPath(); x.moveTo(i * 16, 0); x.lineTo(i * 16 + 64, h); x.stroke(); x.beginPath(); x.moveTo(i * 16 + 64, 0); x.lineTo(i * 16, h); x.stroke(); } }, [3, 1]);
  var net = new T.Mesh(new T.CylinderGeometry(RR, RR * 0.6, 0.42, 20, 1, true), new T.MeshStandardMaterial({ map: netTex, transparent: true, alphaTest: 0.3, side: T.DoubleSide, roughness: 0.9 }));
  net.position.set(0, RIM - 0.21, 0); hoop.add(net);
  M.shadowy(hoop);

  // ---------------------------------------------------------------- ball and aim guide
  var ball = M.ball('basket', BR); scene.add(ball);
  var bShadow = M.blob(0.2, 0.55); scene.add(bShadow);
  var guide = new T.Group(); var gm = new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.75, depthWrite: false });
  for (var i = 0; i < 16; i++) guide.add(new T.Mesh(new T.SphereGeometry(0.035, 8, 6), gm)); scene.add(guide); guide.visible = false;
  var hud = api.h('div', { style: { position: 'absolute', left: '12px', top: '10px', fontWeight: 900, fontSize: '18px', textShadow: '0 2px 6px rgba(0,0,0,.7)' } });
  var hint = api.h('div', { style: { position: 'absolute', left: 0, right: 0, bottom: '16px', textAlign: 'center', fontWeight: 800, fontSize: '15px', textShadow: '0 2px 6px rgba(0,0,0,.8)', transition: 'opacity .4s' }, text: SO ? '↑ Kubadda kor ugu mari xagga shabagga' : '↑ Swipe the ball up towards the basket' });
  var pop = api.h('div', { style: { position: 'absolute', left: 0, right: 0, top: '30%', textAlign: 'center', fontSize: 'clamp(30px,8vw,54px)', fontWeight: 900, color: '#ffd166', textShadow: '0 4px 16px rgba(0,0,0,.7)', opacity: 0, transition: 'opacity .25s' } });
  X.hud.append(hud, hint, pop);

  var B, left, streak, made, shots, hoopV, scored, tries, fx, rest, t, netK;
  function newSpot() {
    var d = api.level === 'easy' ? 3.6 + Math.random() * 1.4 : api.level === 'medium' ? 4 + Math.random() * 2.2 : 4.6 + Math.random() * 2.6;
    var ang = (Math.random() - 0.5) * 1.1;
    B = { p: new T.Vector3(Math.sin(ang) * d, 1.15, Math.cos(ang) * d), v: new T.Vector3(), live: false, spin: 0 }; scored = false; tries = 0; rest = 0;
  }
  function reset() { left = TIME; streak = 0; made = 0; shots = 0; hoopV = 0; hoop.position.x = 0; fx = []; t = 0; netK = 0; newSpot(); api.info('⏱', WTG.fmtTime(left)); hint.style.opacity = '1'; }
  // the velocity that sends the ball from p through the rim centre in time tt
  function ideal(p) {
    var tgt = new T.Vector3(hoop.position.x, RIM + 0.02, 0), d = tgt.clone().sub(p), dist = Math.hypot(d.x, d.z), tt = 0.75 + dist * 0.07;
    return new T.Vector3(d.x / tt, (d.y + 0.5 * G * tt * tt) / tt, d.z / tt);
  }
  function shotVel(dx, dy) {
    // dy: upward swipe in fractions of the canvas height (0.35 ≈ perfect), dx: sideways fraction of the width
    var v = ideal(B.p), SENS = { easy: 0.22, medium: 0.32, hard: 0.42 }[api.level] || 0.32, pw = Math.max(0.6, Math.min(1.4, 1 + (dy / 0.35 - 1) * SENS)), k = 0.55 + 0.45 * pw;
    var dir = new T.Vector3(v.x, 0, v.z), len = dir.length(); dir.normalize(); var side = new T.Vector3(-dir.z, 0, dir.x);
    var out = new T.Vector3(dir.x * len * pw, v.y * k, dir.z * len * pw).add(side.multiplyScalar(dx * 3.2));
    return out;
  }
  function flash(s) { pop.textContent = s; pop.style.opacity = '1'; api.after(900, function () { pop.style.opacity = '0'; }); }
  function step(d) {
    var py = B.p.y; B.v.y -= G * d; B.p.addScaledVector(B.v, d);
    // rim: the nearest point of the ring
    var c = new T.Vector3(hoop.position.x, RIM, 0), rel = B.p.clone().sub(c), hz = new T.Vector3(rel.x, 0, rel.z), hl = hz.length();
    var near = hl > 1e-4 ? c.clone().add(hz.multiplyScalar(RR / hl)) : c.clone().add(new T.Vector3(RR, 0, 0));
    var n = B.p.clone().sub(near), nd = n.length();
    if (nd < BR + 0.018 && nd > 0) { n.divideScalar(nd); var dot = B.v.dot(n); if (dot < 0) { B.v.addScaledVector(n, -1.55 * dot); B.v.multiplyScalar(0.82); api.sfx('tap'); tries++; } B.p.copy(near).addScaledVector(n, BR + 0.019); }
    // backboard
    if (B.p.z - BR < BOARD_Z && B.p.z > BOARD_Z - 0.2 && Math.abs(B.p.x - hoop.position.x) < 0.9 && B.p.y > RIM - 0.1 && B.p.y < RIM + 1.0 && B.v.z < 0) { B.v.z = -B.v.z * 0.6; B.p.z = BOARD_Z + BR; api.sfx('hit'); tries++; }
    // floor
    if (B.p.y < BR) { B.p.y = BR; if (B.v.y < 0) { B.v.y = -B.v.y * 0.62; B.v.x *= 0.85; B.v.z *= 0.85; if (Math.abs(B.v.y) > 1) api.sfx('move'); } }
    // basket: passing down through the ring
    if (!scored && B.v.y < 0 && py >= RIM - 0.05 && B.p.y < RIM - 0.05 && Math.hypot(B.p.x - c.x, B.p.z - c.z) < RR - BR * 0.3) {
      scored = true; made++; streak++; netK = 1;
      var pts = (tries === 0 ? 3 : 2) + (streak >= 3 ? 1 : 0); api.add(pts * 10); api.sfx('win'); flash((tries === 0 ? 'SWISH! ' : '') + '+' + pts * 10);
      fx.push(M.burst(scene, c.clone(), 0xffd166, 30));
      if (streak === 5) api.achieve('hot', { so: '5 isku xigta', en: '5 in a row' }); if (made === 20) api.achieve('20', { so: '20 kubadood', en: '20 baskets' });
      if (made >= 6 && (MOVE === 'on' || (MOVE === 'auto' && api.level !== 'easy')) && !hoopV) hoopV = api.level === 'hard' ? 1.1 : 0.6;
    }
  }
  function update(dt) {
    t += dt; left -= dt; api.info('⏱', WTG.fmtTime(Math.max(0, left)));
    if (left <= 0) { api.end({ won: made >= 10, score: api.score, msg: { so: made + ' kubadood oo gashay', en: made + ' baskets' } }); return; }
    if (hoopV) { hoop.position.x += hoopV * dt; if (Math.abs(hoop.position.x) > 1.8) hoopV *= -1; hoop.position.x = Math.max(-1.8, Math.min(1.8, hoop.position.x)); }
    if (B.live) {
      var n = Math.ceil(Math.min(dt, 0.1) / 0.004); for (var s = 0; s < n; s++) step(Math.min(dt, 0.1) / n);
      B.spin += dt; ball.rotation.x -= dt * 8;
      rest += dt;
      if (rest > 3.2 || B.p.z > 9 || Math.abs(B.p.x) > 8) { if (!scored) { streak = 0; api.sfx('bad'); } newSpot(); }
    }
    if (netK > 0) netK = Math.max(0, netK - dt * 2.5);
    fx = fx.filter(function (f) { return f(dt); });
    hud.textContent = '🏀 ' + made + '   🔥 ' + streak;
  }
  function draw() {
    ball.position.copy(B.p);
    bShadow.position.set(B.p.x, 0.012, B.p.z); bShadow.scale.setScalar(Math.max(0.35, 1 - B.p.y * 0.18));
    net.scale.set(1 - netK * 0.25, 1 + netK * 0.35, 1 - netK * 0.25); net.position.y = RIM - 0.21 - netK * 0.07;
    var portrait = X.H > X.W;
    var cp = new T.Vector3(B.live ? camHold.x : B.p.x * 1.05, portrait ? 1.95 : 1.75, (B.live ? camHold.z : B.p.z) + (portrait ? 2.9 : 2.2));
    if (!B.live) camHold = cp.clone().setZ(B.p.z), camHold.x = cp.x;
    cam.position.copy(cp); cam.lookAt(hoop.position.x * 0.6, RIM - (portrait ? 0.75 : 0.95), 0);
    X.render();
  }
  var camHold = new T.Vector3();
  // swipe to shoot
  var sx = 0, sy = 0, on = false;
  function preview(dx, dy) {
    if (GUIDE === 'off' || (GUIDE === 'auto' && api.level === 'hard')) return; var v = shotVel(dx, dy), p = B.p.clone(), n = GUIDE === 'on' || api.level === 'easy' ? 16 : 7; guide.visible = true;
    guide.children.forEach(function (m, i) { m.visible = i < n; for (var k = 0; k < 4; k++) { v.y -= G * 0.02; p.addScaledVector(v, 0.02); } m.position.copy(p); });
  }
  X.cv.addEventListener('pointerdown', function (e) { if (api.paused || B.live) return; e.preventDefault(); on = true; sx = e.clientX; sy = e.clientY; try { X.cv.setPointerCapture(e.pointerId); } catch (x) {} });
  X.cv.addEventListener('pointermove', function (e) { if (!on) return; var r = X.cv.getBoundingClientRect(); var dy = (sy - e.clientY) / r.height, dx = (e.clientX - sx) / r.width; if (dy > 0.05) preview(dx, dy); else guide.visible = false; });
  X.cv.addEventListener('pointerup', function (e) {
    if (!on) return; on = false; guide.visible = false; var r = X.cv.getBoundingClientRect(), dy = (sy - e.clientY) / r.height, dx = (e.clientX - sx) / r.width;
    if (dy < 0.06) return; B.v.copy(shotVel(dx, dy)); B.live = true; shots++; api.sfx('jump'); hint.style.opacity = '0';
  });
  ['pointercancel'].forEach(function (k) { X.cv.addEventListener(k, function () { on = false; guide.visible = false; }); });
  return {
    start: function () { reset(); draw(); api.loop(function (dt) { update(dt); draw(); }); },
    // keyboard: Space shoots a well-judged shot (arrow keys nudge it)
    key: function (e, down) { if (!down || B.live || api.paused) return; var k = e.key; if (k === ' ' || k === 'Enter' || k === 'ArrowUp') { e.preventDefault(); B.v.copy(shotVel(nudge * 0.03, 0.35 + (Math.random() - 0.5) * 0.06)); B.live = true; shots++; api.sfx('jump'); hint.style.opacity = '0'; } else if (k === 'ArrowLeft') nudge--; else if (k === 'ArrowRight') nudge++; },
    destroy: function () { X.dispose(); }
  };
  var nudge = 0;
});
