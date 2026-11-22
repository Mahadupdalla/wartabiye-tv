/* City Dash 3D: an endless 3-lane runner through an evening city. Jump the low barriers, slide under the high bars,
   change lanes past the crates and the parked vans, collect coins and magnets. Original 3D models and scene. */
WTG.register3d('runner3d', function (M, api) {
  var T = M.T, SO = api.lang === 'so';
  var X = M.setup(api, { fov: 62, far: 140, bg: ['#0b1f4a', '#2c5aa0', '#f6a35b'], reserve: 70, label: 'City Dash 3D', envIntensity: 0.5 });
  var scene = X.scene, cam = X.camera;
  scene.fog = new T.Fog(0x9fb4d8, 40, 95);
  var S = M.sun(scene, { color: 0xffd8a8, intensity: 2.4, hemi: 0.9, sky: 0xbcd4ff, ground: 0x3d3229, offset: new T.Vector3(-8, 16, 6), size: 16 });
  var LANE = 2.4, sp0 = api.cfg('speed', { easy: 11, medium: 14, hard: 18 }[api.level]);

  // ---------------------------------------------------------------- world
  var roadTex = M.canvasTex(512, 512, function (x, w, h) {
    x.fillStyle = '#3b4252'; x.fillRect(0, 0, w, h); M.noise(x, w, h, 9000, 0.06);
    x.fillStyle = '#f8fafc'; [w / 3, w * 2 / 3].forEach(function (lx) { for (var y = 0; y < h; y += 128) x.fillRect(lx - 5, y, 10, 70); });
    x.fillStyle = '#facc15'; x.fillRect(10, 0, 10, h); x.fillRect(w - 20, 0, 10, h);
  }, [1, 12]);
  var road = new T.Mesh(new T.PlaneGeometry(LANE * 3 + 1.2, 160), new T.MeshStandardMaterial({ map: roadTex, roughness: 0.85, metalness: 0.05 }));
  road.rotation.x = -Math.PI / 2; road.receiveShadow = true; scene.add(road);
  var walkTex = M.canvasTex(256, 256, function (x, w, h) { x.fillStyle = '#9ca3af'; x.fillRect(0, 0, w, h); x.strokeStyle = '#6b7280'; x.lineWidth = 3; for (var i = 0; i <= w; i += 64) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, h); x.stroke(); x.beginPath(); x.moveTo(0, i); x.lineTo(w, i); x.stroke(); } M.noise(x, w, h, 3000, 0.05); }, [2, 40]);
  var walks = [-1, 1].map(function (s) { var m = new T.Mesh(new T.BoxGeometry(4, 0.25, 160), new T.MeshStandardMaterial({ map: walkTex, roughness: 0.9 })); m.position.set(s * (LANE * 1.5 + 2.6), 0.12, 0); m.receiveShadow = true; scene.add(m); return m; });
  // buildings: a pool on both sides, moved ahead as the runner passes them
  var winTex = function (base, lit) {
    return M.canvasTex(128, 256, function (x, w, h) {
      x.fillStyle = base; x.fillRect(0, 0, w, h);
      for (var r = 0; r < 12; r++) for (var c = 0; c < 4; c++) { x.fillStyle = Math.random() < lit ? 'rgba(255,214,140,.95)' : 'rgba(20,30,50,.85)'; x.fillRect(10 + c * 29, 10 + r * 20, 18, 12); }
    });
  };
  var BCOL = ['#c2410c', '#475569', '#0f766e', '#7c2d12', '#334155', '#a16207', '#1e3a8a', '#6b21a8'];
  var bMats = BCOL.map(function (c) { var t = winTex(c, 0.45); return new T.MeshStandardMaterial({ map: t, emissiveMap: t, emissive: 0xffffff, emissiveIntensity: 0.35, roughness: 0.7 }); });
  var roofM = M.mat(0x1f2937), bGeo = new T.BoxGeometry(1, 1, 1);
  var blds = [];
  for (var i = 0; i < 28; i++) {
    var side = i % 2 ? 1 : -1, g = new T.Group(), hgt = 6 + Math.random() * 16, wd = 5 + Math.random() * 3;
    var b = new T.Mesh(bGeo, bMats[i % bMats.length]); b.scale.set(wd, hgt, 7); b.position.y = hgt / 2; b.castShadow = false; b.receiveShadow = true; g.add(b);
    var rf = new T.Mesh(bGeo, roofM); rf.scale.set(wd + 0.4, 0.4, 7.4); rf.position.y = hgt + 0.2; g.add(rf);
    g.position.set(side * (LANE * 1.5 + 4.6 + wd / 2), 0, -Math.floor(i / 2) * 8); scene.add(g); blds.push(g);
  }
  // street lights
  var poleM = M.mat(0x1f2937, { metalness: 0.6, roughness: 0.4 }), lampM = new T.MeshStandardMaterial({ color: 0xfff3c4, emissive: 0xffe08a, emissiveIntensity: 2 });
  var lamps = [];
  for (i = 0; i < 10; i++) {
    var lp = new T.Group(), pole = new T.Mesh(new T.CylinderGeometry(0.07, 0.09, 5, 8), poleM); pole.position.y = 2.5; lp.add(pole);
    var arm = new T.Mesh(new T.BoxGeometry(1.2, 0.08, 0.08), poleM); arm.position.set(-0.55 * (i % 2 ? 1 : -1), 4.95, 0); lp.add(arm);
    var lmp = new T.Mesh(new T.BoxGeometry(0.4, 0.12, 0.25), lampM); lmp.position.set(-1.1 * (i % 2 ? 1 : -1), 4.88, 0); lp.add(lmp);
    lp.position.set((i % 2 ? 1 : -1) * (LANE * 1.5 + 1.2), 0, -i * 16); M.shadowy(lp); scene.add(lp); lamps.push(lp);
  }

  // ---------------------------------------------------------------- runner
  var P3 = M.person({ shirt: api.cfg('shirt', 0x037bdc), pants: 0x0f172a, shoe: 0xf2060a, skin: 0x8d5524, number: 7, cap: 0xf2060a });
  P3.g.rotation.y = Math.PI; scene.add(P3.g);
  var pShadow = M.blob(0.55, 0.5); scene.add(pShadow);

  // ---------------------------------------------------------------- obstacles and coins
  var stripe = M.canvasTex(256, 64, function (x, w, h) { for (var k = 0; k < 8; k++) { x.fillStyle = k % 2 ? '#f8fafc' : '#dc2626'; x.beginPath(); x.moveTo(k * 40 - 20, h); x.lineTo(k * 40 + 20, 0); x.lineTo(k * 40 + 60, 0); x.lineTo(k * 40 + 20, h); x.fill(); } });
  var stripeM = new T.MeshStandardMaterial({ map: stripe, roughness: 0.5 }), metal = M.mat(0x94a3b8, { metalness: 0.8, roughness: 0.3 });
  var crateTex = M.canvasTex(128, 128, function (x, w, h) { x.fillStyle = '#b7791f'; x.fillRect(0, 0, w, h); x.strokeStyle = '#7c4a12'; x.lineWidth = 10; x.strokeRect(5, 5, w - 10, h - 10); x.beginPath(); x.moveTo(8, 8); x.lineTo(w - 8, h - 8); x.stroke(); M.noise(x, w, h, 1500, 0.08); });
  var crateM = new T.MeshStandardMaterial({ map: crateTex, roughness: 0.8 });
  var coinM = new T.MeshStandardMaterial({ color: 0xffc928, metalness: 1, roughness: 0.25, emissive: 0x5a3a00, emissiveIntensity: 0.4 });
  var coinG = new T.CylinderGeometry(0.32, 0.32, 0.08, 28); coinG.rotateX(Math.PI / 2);
  function make(kind) {
    var g = new T.Group();
    if (kind === 'low') {
      var bd = new T.Mesh(new T.BoxGeometry(2.0, 0.42, 0.14), stripeM); bd.position.y = 0.6; g.add(bd);
      [-0.85, 0.85].forEach(function (sx) { var l = new T.Mesh(new T.BoxGeometry(0.1, 0.7, 0.5), metal); l.position.set(sx, 0.35, 0); g.add(l); });
    } else if (kind === 'high') {
      var bar = new T.Mesh(new T.BoxGeometry(2.1, 0.45, 0.2), stripeM); bar.position.y = 1.65; g.add(bar);
      [-1.0, 1.0].forEach(function (sx) { var l = new T.Mesh(new T.CylinderGeometry(0.06, 0.06, 1.9, 8), metal); l.position.set(sx, 0.95, 0); g.add(l); });
      var sign = new T.Mesh(new T.CircleGeometry(0.22, 24), new T.MeshStandardMaterial({ color: 0xfacc15, emissive: 0x5a4500 })); sign.position.set(0, 1.65, 0.11); g.add(sign);
    } else if (kind === 'box') {
      for (var k = 0; k < 3; k++) { var c = new T.Mesh(new T.BoxGeometry(1.1, 1.1, 1.1), crateM); c.position.set(k === 2 ? 0 : (k ? 0.56 : -0.56), k === 2 ? 1.65 : 0.55, 0); c.rotation.y = (Math.random() - 0.5) * 0.3; g.add(c); }
    } else if (kind === 'van') {
      var v = M.car({ color: api.pick([0xf8fafc, 0x16a34a, 0xf59e0b, 0x7c3aed]), long: 4.6 }); v.scale.set(1.05, 1.25, 1); g.add(v);
    } else { var cn = new T.Mesh(coinG, coinM); cn.position.y = 1.0; cn.castShadow = true; g.add(cn); }
    M.shadowy(g); return g;
  }
  var objs = [], fx = [], P, speed, dist, coins, spawnZ, t, dead, lives, hitT, shake;
  function info() { api.info('❤️', lives); }
  var hud = api.h('div', { style: { position: 'absolute', left: '12px', top: '10px', fontWeight: 900, fontSize: '18px', textShadow: '0 2px 6px rgba(0,0,0,.6)' } });
  var hint = api.h('div', { style: { position: 'absolute', left: '0', right: '0', bottom: '14px', textAlign: 'center', fontWeight: 800, fontSize: '15px', textShadow: '0 2px 6px rgba(0,0,0,.7)', transition: 'opacity .6s' }, text: SO ? 'Gacanta mari: bidix / midig / kor (bood) / hoos (gunuuc)' : 'Swipe left / right, up to jump, down to slide' });
  X.hud.append(hud, hint);
  function clear() { objs.forEach(function (o) { scene.remove(o.m); }); objs = []; }
  function reset() {
    clear(); P = { lane: 1, lx: 1, jump: 0, vy: 0, slide: 0, z: 0 }; speed = sp0; dist = 0; coins = 0; spawnZ = -24; t = 0; dead = false; hitT = 0; shake = 0;
    lives = api.cfg('lives', api.level === 'easy' ? 3 : 1); info(); hint.style.opacity = '1';
    blds.forEach(function (g, i) { g.position.z = -Math.floor(i / 2) * 8; }); lamps.forEach(function (l, i) { l.position.z = -i * 16; });
  }
  function spawn(z) {
    var lanes = api.shuffle([0, 1, 2]), n = Math.random() < 0.38 ? 2 : 1, kinds = t > 25 ? ['low', 'high', 'box', 'van'] : ['low', 'high', 'box'];
    for (var i = 0; i < n; i++) { var k = api.pick(kinds), m = make(k); m.position.set((lanes[i] - 1) * LANE, 0, z); scene.add(m); objs.push({ kind: k, lane: lanes[i], z: z, m: m, len: k === 'van' ? 2.4 : 0.6 }); }
    if (Math.random() < 0.85) { var cl = lanes[2], arc = Math.random() < 0.3; for (var j = 0; j < 5; j++) { var c = make('coin'); var zz = z - 3 - j * 1.8; c.position.set((cl - 1) * LANE, arc ? Math.sin(j / 4 * Math.PI) * 1.4 : 0, zz); scene.add(c); objs.push({ kind: 'coin', lane: cl, z: zz, m: c, len: 0.6, y: c.position.y }); } }
  }
  function act(a) {
    if (api.paused || dead) return;
    if (a === 'l' && P.lane > 0) { P.lane--; api.sfx('move'); }
    else if (a === 'r' && P.lane < 2) { P.lane++; api.sfx('move'); }
    else if (a === 'u' && P.jump <= 0.001) { P.vy = 9.8; P.jump = 0.01; P.slide = 0; api.sfx('jump'); }
    else if (a === 'd') { P.slide = 0.75; if (P.jump > 0) P.vy = -15; api.sfx('move'); }
    hint.style.opacity = '0';
  }
  M.swipe(X.cv, function (d) { if (d !== 'tap') act(d); else act('u'); });
  M.pad(api, X, [['◀', 'Left', function () { act('l'); }], ['▲', 'Jump', function () { act('u'); }], ['▼', 'Slide', function () { act('d'); }], ['▶', 'Right', function () { act('r'); }]]);

  function update(dt) {
    t += dt; speed = sp0 + Math.min(16, t * 0.25); var dz = speed * dt; dist += dz; P.z -= dz;
    P.lx += (P.lane - P.lx) * Math.min(1, dt * 12);
    if (P.jump > 0) { P.vy -= 27 * dt; P.jump += P.vy * dt; if (P.jump <= 0) { P.jump = 0; P.vy = 0; } }
    if (P.slide > 0) P.slide -= dt; if (hitT > 0) hitT -= dt; if (shake > 0) shake -= dt;
    api.setScore(Math.floor(dist) + coins * 10);
    if (P.z - 70 < spawnZ) { spawn(spawnZ); spawnZ -= Math.max(9, 15 - t * 0.05); }
    objs.forEach(function (o) {
      if (o.kind === 'coin') { o.m.children[0].rotation.y += dt * 4; }
      if (o.hit || Math.abs(o.z - P.z) > o.len || Math.abs(o.lane - P.lx) > 0.45) return;
      if (o.kind === 'coin') {
        if (o.y > 0.5 && P.jump < o.y - 0.4) return;
        o.hit = true; scene.remove(o.m); coins++; api.setScore(Math.floor(dist) + coins * 10); api.sfx('coin'); fx.push(M.burst(scene, new T.Vector3(o.m.position.x, 1 + (o.y || 0), o.z), 0xffd166, 14));
        if (coins === 100) api.achieve('c100', { so: '100 lacag-ciyaareed', en: '100 coins' }); return;
      }
      var safe = (o.kind === 'low' && P.jump > 0.85) || (o.kind === 'high' && P.slide > 0);
      if (safe || hitT > 0) return;
      o.hit = true; lives--; info(); api.sfx('hit'); hitT = 1.2; shake = 0.35;
      if (lives <= 0) { dead = true; api.lose(api.score, { so: Math.floor(dist) + ' mitir', en: Math.floor(dist) + ' m run' }); }
      else api.toast('❤️ ' + lives);
    });
    objs = objs.filter(function (o) { if (o.z > P.z + 12 || (o.kind === 'coin' && o.hit)) { if (!o.hit || o.kind !== 'coin') scene.remove(o.m); return false; } return true; });
    blds.forEach(function (g) { if (g.position.z > P.z + 14) g.position.z -= 14 * 8; });
    lamps.forEach(function (l) { if (l.position.z > P.z + 14) l.position.z -= 10 * 16; });
    fx = fx.filter(function (f) { return f(dt); });
    api.setScore(Math.floor(dist) + coins * 10);
    if (dist > 2000) api.achieve('d2000', { so: '2 km oo orod ah', en: '2 km run' });
    hud.textContent = '🪙 ' + coins + '   ' + Math.floor(dist) + ' m';
  }
  function draw() {
    var px = (P.lx - 1) * LANE;
    P3.g.position.set(px, P.jump, P.z);
    P3.pose(t * speed * 0.75, P.jump > 0 ? 'jump' : P.slide > 0 ? 'slide' : 'run');
    P3.g.visible = !(hitT > 0 && Math.floor(hitT * 12) % 2);
    P3.g.position.y = P.jump + (P.slide > 0 ? -0.35 : 0);
    pShadow.position.set(px, 0.27, P.z); pShadow.scale.setScalar(Math.max(0.4, 1 - P.jump * 0.25));
    road.position.z = P.z - 50; roadTex.offset.y = (-P.z / (160 / 12)) % 1; walks.forEach(function (w) { w.position.z = P.z - 50; w.material.map.offset.y = (-P.z / 4) % 1; });
    var sx = shake > 0 ? (Math.random() - 0.5) * shake : 0;
    var far = api.cfg('cam') === 'far'; cam.position.set(px * 0.6 + sx, (far ? 3.6 : 2.75) + P.jump * 0.35, P.z + (far ? 8 : 5.6)); cam.lookAt(px * 0.75, 1.25 + P.jump * 0.4, P.z - 6);
    S.follow(new T.Vector3(px, 0, P.z - 6));
    X.render();
  }
  return {
    start: function () { reset(); draw(); api.loop(function (dt) { update(dt); draw(); }); },
    key: function (e, down) { if (!down) return; var k = e.key, m = { ArrowLeft: 'l', a: 'l', A: 'l', ArrowRight: 'r', d: 'r', D: 'r', ArrowUp: 'u', w: 'u', W: 'u', ' ': 'u', ArrowDown: 'd', s: 'd', S: 'd' }[k]; if (m) { e.preventDefault(); act(m); } },
    destroy: function () { clear(); X.dispose(); }
  };
});
