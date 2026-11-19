/* Highway Racer 3D: drive a sports car down a four-lane highway across the countryside at sunset. Weave through
   traffic, pick up fuel cans and coins. Original 3D models and scene (acacia trees, hills, guard rails). */
WTG.register3d('racer3d', function (M, api) {
  var T = M.T, SO = api.lang === 'so';
  var X = M.setup(api, { fov: 60, far: 260, bg: ['#1e3a8a', '#7c9cd6', '#ffb36b', '#ffd9a0'], reserve: 70, label: 'Highway Racer 3D', exposure: 1.1 });
  var scene = X.scene, cam = X.camera;
  scene.fog = new T.Fog(0xf3c597, 60, 200);
  var S = M.sun(scene, { color: 0xffc58a, intensity: 2.6, hemi: 0.85, sky: 0xffe2c2, ground: 0x4d5b2a, offset: new T.Vector3(-14, 18, -10), size: 22 });
  var LW = 3.4, LANES = 4, HALF = LW * LANES / 2;
  var base = api.cfg('speed', { easy: 22, medium: 28, hard: 35 }[api.level]), TRAF = { light: 1.6, normal: 1, heavy: 0.65 }[api.cfg('traffic', 'normal')] || 1, NOFUEL = api.cfg('fuel') === 'off';

  // ---------------------------------------------------------------- scenery
  var roadTex = M.canvasTex(512, 512, function (x, w, h) {
    x.fillStyle = '#353a45'; x.fillRect(0, 0, w, h); M.noise(x, w, h, 12000, 0.06);
    x.fillStyle = '#f8fafc'; for (var l = 1; l < 4; l++) for (var y = 0; y < h; y += 128) x.fillRect(l * w / 4 - 4, y, 8, 64);
    x.fillRect(6, 0, 8, h); x.fillRect(w - 14, 0, 8, h);
  }, [1, 10]);
  var road = new T.Mesh(new T.PlaneGeometry(LW * LANES + 1, 240), new T.MeshStandardMaterial({ map: roadTex, roughness: 0.8 })); road.rotation.x = -Math.PI / 2; road.receiveShadow = true; scene.add(road);
  var grassTex = M.canvasTex(256, 256, function (x, w, h) { x.fillStyle = '#7a8a3a'; x.fillRect(0, 0, w, h); for (var i = 0; i < 4000; i++) { x.fillStyle = ['#6b7a2f', '#8c9a45', '#a39a56', '#5d6b28'][i % 4]; x.fillRect(Math.random() * w, Math.random() * h, 3, 3); } }, [20, 60]);
  var ground = new T.Mesh(new T.PlaneGeometry(300, 240), new T.MeshStandardMaterial({ map: grassTex, roughness: 1 })); ground.rotation.x = -Math.PI / 2; ground.position.y = -0.02; ground.receiveShadow = true; scene.add(ground);
  // guard rails
  var railM = M.mat(0xcbd5e1, { metalness: 0.85, roughness: 0.3 }), postM = M.mat(0x64748b, { metalness: 0.5, roughness: 0.5 });
  var rails = [-1, 1].map(function (s) { var g = new T.Group(); var r = new T.Mesh(new T.BoxGeometry(0.1, 0.3, 240), railM); r.position.y = 0.65; g.add(r); for (var z = -120; z < 120; z += 6) { var p = new T.Mesh(new T.BoxGeometry(0.12, 0.7, 0.12), postM); p.position.set(0, 0.35, z); g.add(p); } g.position.x = s * (HALF + 0.9); M.shadowy(g); scene.add(g); return g; });
  // hills on the horizon (flat-shaded cones)
  var hillM = new T.MeshStandardMaterial({ color: 0x8a6f4e, roughness: 1, flatShading: true });
  var hills = new T.Group(); for (var i = 0; i < 18; i++) { var hh = 12 + Math.random() * 22, c = new T.Mesh(new T.ConeGeometry(18 + Math.random() * 20, hh, 6), hillM); c.position.set((i % 2 ? 1 : -1) * (60 + Math.random() * 70), hh / 2 - 1, -Math.random() * 200); hills.add(c); } scene.add(hills);
  // acacia trees: flat umbrella crowns
  var trunkM = M.mat(0x5b3a1e, { roughness: 0.9 }), leafM = new T.MeshStandardMaterial({ color: 0x4d7c2a, roughness: 0.9, flatShading: true });
  function acacia() {
    var g = new T.Group(), tr = new T.Mesh(new T.CylinderGeometry(0.18, 0.28, 3.4, 7), trunkM); tr.position.y = 1.7; tr.rotation.z = (Math.random() - 0.5) * 0.3; g.add(tr);
    for (var k = 0; k < 3; k++) { var cr = new T.Mesh(new T.CylinderGeometry(2.2 - k * 0.4, 2.6 - k * 0.3, 0.6, 9), leafM); cr.position.set((Math.random() - 0.5) * 0.8, 3.4 + k * 0.35, (Math.random() - 0.5) * 0.8); cr.scale.set(1, 1, 0.8 + Math.random() * 0.4); g.add(cr); }
    var s = 0.8 + Math.random() * 0.6; g.scale.setScalar(s); M.shadowy(g); return g;
  }
  var trees = []; for (i = 0; i < 26; i++) { var tg = acacia(); tg.position.set((i % 2 ? 1 : -1) * (HALF + 5 + Math.random() * 18), 0, -i * 9); scene.add(tg); trees.push(tg); }

  // ---------------------------------------------------------------- the player and traffic
  var me = M.car({ color: api.cfg('car', 0x037bdc) }); scene.add(me);
  var stripe = new T.Mesh(new T.BoxGeometry(0.35, 0.02, 4.0), M.mat(0xffffff)); stripe.position.set(0, 0.94, 0); me.add(stripe);
  var COLS = [0xef4444, 0xf59e0b, 0x22c55e, 0xa855f7, 0xe2e8f0, 0x14b8a6, 0x111827, 0xfde047];
  var canM = M.mat(0xdc2626, { metalness: 0.3, roughness: 0.4 });
  function fuelCan() { var g = new T.Group(), b = new T.Mesh(new T.RoundedBoxGeometry(0.8, 1.0, 0.4, 2, 0.08), canM); b.position.y = 0.9; g.add(b); var cap = new T.Mesh(new T.CylinderGeometry(0.08, 0.08, 0.2, 10), M.mat(0xfacc15)); cap.position.set(0.25, 1.48, 0); g.add(cap); var hd = new T.Mesh(new T.TorusGeometry(0.16, 0.05, 6, 12, Math.PI), canM); hd.position.set(-0.12, 1.4, 0); g.add(hd); M.shadowy(g); return g; }
  var coinG = new T.CylinderGeometry(0.45, 0.45, 0.1, 28); coinG.rotateX(Math.PI / 2);
  var coinM = new T.MeshStandardMaterial({ color: 0xffc928, metalness: 1, roughness: 0.25, emissive: 0x5a3a00, emissiveIntensity: 0.5 });
  var P, cars, items, speed, dist, steer, spawnZ, fuel, dead, t, coinScore, fx, keyL, keyR, drag, boost;
  var hud = api.h('div', { style: { position: 'absolute', left: '12px', top: '10px', right: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: 900, fontSize: '16px', textShadow: '0 2px 6px rgba(0,0,0,.6)' } });
  var fuelBar = api.h('div', { style: { width: '120px', height: '14px', borderRadius: '8px', background: 'rgba(0,0,0,.45)', overflow: 'hidden', border: '2px solid rgba(255,255,255,.6)' } }, api.h('i', { style: { display: 'block', height: '100%', width: '100%', background: 'linear-gradient(90deg,#22c55e,#a3e635)' } }));
  var spd = api.h('div', { style: { fontSize: '22px' } });
  hud.append(api.h('div', { style: { display: 'flex', gap: '8px', alignItems: 'center' } }, api.h('span', { text: '⛽' }), fuelBar), spd);
  var hint = api.h('div', { style: { position: 'absolute', left: '0', right: '0', bottom: '14px', textAlign: 'center', fontWeight: 800, fontSize: '15px', textShadow: '0 2px 6px rgba(0,0,0,.7)', transition: 'opacity .6s' }, text: SO ? 'Farta ku hay dhinaca aad u leexanayso' : 'Hold left or right side to steer' });
  X.hud.append(hud, hint);
  function clear() { (cars || []).concat(items || []).forEach(function (o) { scene.remove(o.m); }); }
  function reset() {
    clear(); P = { x: LW / 2, z: 0, yaw: 0 }; cars = []; items = []; fx = []; speed = base; dist = 0; steer = 0; spawnZ = -40; fuel = 100; dead = false; t = 0; coinScore = 0; keyL = keyR = false; drag = null; boost = 0;
    trees.forEach(function (g, i) { g.position.z = -i * 9; }); hint.style.opacity = '1';
  }
  function laneX(l) { return -HALF + LW / 2 + l * LW; }
  function spawn(z) {
    var lanes = api.shuffle([0, 1, 2, 3]), n = Math.random() < 0.45 + Math.min(0.25, t * 0.004) ? 2 : 1;
    for (var i = 0; i < n; i++) {
      var truck = Math.random() < 0.2, m = truck ? M.truck({ color: api.pick([0x1d4ed8, 0x15803d, 0xb91c1c]), stripe: api.pick([0xf2060a, 0x037bdc, 0xfacc15]) }) : M.car({ color: api.pick(COLS), taxi: Math.random() < 0.12 });
      m.position.set(laneX(lanes[i]), 0, z); scene.add(m); cars.push({ m: m, z: z, x: laneX(lanes[i]), v: (truck ? 12 : 14) + Math.random() * 6, len: truck ? 8.4 : 4.2, w: truck ? 2.3 : 1.8 });
    }
    var r = Math.random(), l = lanes[n];
    if (r < 0.22) { var f = fuelCan(); f.position.set(laneX(l), 0, z - 6); scene.add(f); items.push({ m: f, k: 'fuel', x: laneX(l), z: z - 6 }); }
    else if (r < 0.7) for (var j = 0; j < 4; j++) { var c = new T.Mesh(coinG, coinM); c.castShadow = true; c.position.set(laneX(l), 1.0, z - 4 - j * 3); scene.add(c); items.push({ m: c, k: 'coin', x: laneX(l), z: z - 4 - j * 3 }); }
  }
  function crash() { dead = true; api.sfx('hit'); fx.push(M.burst(scene, me.position.clone().add(new T.Vector3(0, 1, -2)), 0xff7a1a, 40)); api.setScore(Math.floor(dist) + coinScore); api.lose(api.score, { so: 'Gaadhi ayaad ku dhacday', en: 'You crashed' }); }
  function update(dt) {
    t += dt; if (boost > 0) boost -= dt;
    speed = base + Math.min(26, t * 0.45) + (keyUp ? 6 : 0) - (keyDown ? 8 : 0);
    var s = keyL ? -1 : keyR ? 1 : drag != null ? drag : 0; steer += (s - steer) * Math.min(1, dt * 8);
    P.x = Math.max(-HALF + 1, Math.min(HALF - 1, P.x + steer * 11 * dt)); P.yaw = -steer * 0.12;
    var dz = speed * dt; P.z -= dz; dist += dz; if (!NOFUEL) fuel -= dt * (api.level === 'easy' ? 2 : 3.2);
    if (P.z - 150 < spawnZ) { spawn(spawnZ); spawnZ -= Math.max(16, 30 - t * 0.12) * TRAF; }
    cars.forEach(function (c) { c.z -= c.v * dt; c.m.position.z = c.z; c.m.userData.wheels && c.m.userData.wheels.forEach(function (w) { w.rotation.x -= c.v * dt / 0.36; }); });
    items.forEach(function (i) { if (i.k === 'coin') i.m.rotation.y += dt * 4; else i.m.rotation.y += dt; });
    for (var k = 0; k < cars.length; k++) { var c = cars[k]; if (Math.abs(c.x - P.x) < (c.w + 1.8) / 2 - 0.15 && Math.abs(c.z - P.z) < (c.len + 4.2) / 2 - 0.3) { crash(); return; } }
    items = items.filter(function (i) {
      if (i.z > P.z + 10) { scene.remove(i.m); return false; }
      if (Math.abs(i.x - P.x) < 1.6 && Math.abs(i.z - P.z) < 2.4) {
        scene.remove(i.m); if (i.k === 'coin') { coinScore += 25; api.sfx('coin'); fx.push(M.burst(scene, i.m.position.clone(), 0xffd166, 12)); } else { fuel = Math.min(100, fuel + 35); api.sfx('good'); fx.push(M.burst(scene, i.m.position.clone().setY(1), 0x22c55e, 20)); }
        return false;
      }
      return true;
    });
    cars = cars.filter(function (c) { if (c.z > P.z + 16) { scene.remove(c.m); return false; } return true; });
    trees.forEach(function (g) { if (g.position.z > P.z + 12) { g.position.z -= 26 * 9; g.position.x = (g.position.x > 0 ? 1 : -1) * (HALF + 5 + Math.random() * 18); } });
    hills.children.forEach(function (hl) { if (hl.position.z > P.z + 20) hl.position.z -= 220; });
    fx = fx.filter(function (f) { return f(dt); });
    if (fuel <= 0) { fuel = 0; dead = true; api.setScore(Math.floor(dist) + coinScore); api.lose(api.score, { so: 'Shidaalku wuu dhammaaday', en: 'Out of fuel' }); return; }
    api.setScore(Math.floor(dist) + coinScore);
    if (dist > 1000) api.achieve('km1', { so: '1000 mitir', en: '1000 m' });
  }
  var keyUp = false, keyDown = false;
  function draw(dt) {
    me.position.set(P.x, 0, P.z); me.rotation.y = P.yaw; me.rotation.z = steer * 0.04;
    me.userData.wheels.forEach(function (w) { w.rotation.x -= speed * (dt || 0) / 0.36; });
    road.position.z = P.z - 90; roadTex.offset.y = (-P.z / 24) % 1; ground.position.z = P.z - 90; grassTex.offset.y = (-P.z / 4) % 1;
    rails.forEach(function (r) { r.position.z = P.z - (P.z % 6) - 80; });
    var cv = api.cfg('cam', 'close'); if (cv === 'high') { cam.position.set(P.x * 0.6, 9, P.z + 9); cam.lookAt(P.x * 0.8, 0, P.z - 12); } else if (cv === 'far') { cam.position.set(P.x * 0.7, 5, P.z + 13); cam.lookAt(P.x * 0.85, 1.2, P.z - 12); } else { cam.position.set(P.x * 0.7, 3.6, P.z + 8.6); cam.lookAt(P.x * 0.85, 1.2, P.z - 10); }
    S.follow(new T.Vector3(P.x, 0, P.z - 8));
    fuelBar.firstChild.style.width = Math.max(0, fuel) + '%'; fuelBar.firstChild.style.background = fuel > 30 ? 'linear-gradient(90deg,#22c55e,#a3e635)' : '#ef4444';
    spd.textContent = Math.round(speed * 3.6) + ' km/h';
    X.render();
  }
  // controls: hold a side of the screen, drag, buttons, keys
  X.cv.addEventListener('pointerdown', function (e) { if (api.paused || dead) return; e.preventDefault(); X.cv.setPointerCapture(e.pointerId); point(e); hint.style.opacity = '0'; });
  X.cv.addEventListener('pointermove', function (e) { if (drag != null) point(e); });
  ['pointerup', 'pointercancel'].forEach(function (k) { X.cv.addEventListener(k, function () { drag = null; }); });
  function point(e) { var r = X.cv.getBoundingClientRect(), f = (e.clientX - r.left) / r.width; drag = f < 0.45 ? -1 : f > 0.55 ? 1 : 0; }
  M.pad(api, X, [['◀', SO ? 'Bidix' : 'Left', function () { keyL = true; hint.style.opacity = '0'; }, function () { keyL = false; }], ['▶', SO ? 'Midig' : 'Right', function () { keyR = true; hint.style.opacity = '0'; }, function () { keyR = false; }]]);
  return {
    start: function () { reset(); draw(0); api.loop(function (dt) { if (!dead) update(dt); else fx = fx.filter(function (f) { return f(dt); }); draw(dt); }); },
    key: function (e, down) {
      var k = e.key;
      if (k === 'ArrowLeft' || k === 'a' || k === 'A') { keyL = down; e.preventDefault(); }
      else if (k === 'ArrowRight' || k === 'd' || k === 'D') { keyR = down; e.preventDefault(); }
      else if (k === 'ArrowUp' || k === 'w' || k === 'W') { keyUp = down; e.preventDefault(); }
      else if (k === 'ArrowDown' || k === 's' || k === 'S') { keyDown = down; e.preventDefault(); }
      if (down) hint.style.opacity = '0';
    },
    destroy: function () { clear(); X.dispose(); }
  };
});
