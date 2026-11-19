/* Penalty Shootout 3D: five penalties each in a floodlit stadium. Shoot (aim, then lock the height, or swipe at the
   goal), then save the computer's shots by diving left, centre or right. Original 3D models and stadium. */
WTG.register3d('penalty3d', function (M, api) {
  var T = M.T, SO = api.lang === 'so';
  var X = M.setup(api, { fov: 50, far: 220, bg: ['#020617', '#0b1d3a', '#13325e'], reserve: 70, label: 'Penalty Shootout 3D', exposure: 1.15, envIntensity: 0.45 });
  var scene = X.scene, cam = X.camera;
  var TX = { so: { aimX: 'Taabo si aad u xirto jihada', aimY: 'Taabo mar kale si aad u xirto dhererka', swipe: 'ama gacanta u mari goolka', save: 'Taabo dhinaca aad u boodayso', goal: 'GOOL!', saved: 'Waa la qabtay!', miss: 'Waa ka baxay', you: 'Adiga', cpu: 'Kombiyuutar' },
    en: { aimX: 'Tap to lock the direction', aimY: 'Tap again to lock the height', swipe: 'or swipe at the goal', save: 'Tap where to dive', goal: 'GOAL!', saved: 'SAVED!', miss: 'MISSED', you: 'You', cpu: 'CPU' } };
  function tx(k) { return (TX[api.lang] || TX.en)[k] || TX.en[k]; }
  var GW = 7.32, GH = 2.44, SPOT = 11;
  var skill = { easy: 0.25, medium: 0.4, hard: 0.55 }[api.level], cpuAcc = { easy: 0.6, medium: 0.72, hard: 0.85 }[api.level];

  // ---------------------------------------------------------------- stadium
  scene.add(new T.AmbientLight(0x6b7da8, 0.5));
  var S = M.sun(scene, { color: 0xf1f5ff, intensity: 2.4, hemi: 0.5, sky: 0x9db7e8, ground: 0x1d3b1d, offset: new T.Vector3(8, 22, 16), size: 14 });
  S.follow(new T.Vector3(0, 0, 5));
  var pitchTex = M.canvasTex(1024, 1024, function (x, w, h) {
    for (var i = 0; i < 16; i++) { x.fillStyle = i % 2 ? '#2f8f3a' : '#36a043'; x.fillRect(0, i * h / 16, w, h / 16); }
    M.noise(x, w, h, 30000, 0.05);
    x.strokeStyle = 'rgba(255,255,255,.92)'; x.lineWidth = 6;
    var s = w / 60;                                     // 60 m wide texture, goal line at y = 80 px
    x.beginPath(); x.moveTo(0, 80); x.lineTo(w, 80); x.stroke();
    x.strokeRect(w / 2 - 20.16 * s, 80, 40.32 * s, 16.5 * s); x.strokeRect(w / 2 - 9.16 * s, 80, 18.32 * s, 5.5 * s);
    x.fillStyle = '#fff'; x.beginPath(); x.arc(w / 2, 80 + 11 * s, 3, 0, 7); x.fill();
    x.beginPath(); x.arc(w / 2, 80 + 11 * s, 9.15 * s, 0.2 * Math.PI, 0.8 * Math.PI); x.stroke();
  });
  var pitch = new T.Mesh(new T.PlaneGeometry(60, 60), new T.MeshStandardMaterial({ map: pitchTex, roughness: 0.95 }));
  pitch.rotation.x = -Math.PI / 2; pitch.position.set(0, 0, 60 / 2 - 80 / 1024 * 60); pitch.receiveShadow = true; scene.add(pitch);
  var outer = new T.Mesh(new T.PlaneGeometry(200, 200), M.mat(0x235f2a, { roughness: 1 })); outer.rotation.x = -Math.PI / 2; outer.position.y = -0.01; outer.receiveShadow = true; scene.add(outer);
  // goal frame and net
  var postM = M.mat(0xffffff, { roughness: 0.3, metalness: 0.2 });
  var goal = new T.Group(); scene.add(goal);
  [-GW / 2, GW / 2].forEach(function (px) { var p = new T.Mesh(new T.CylinderGeometry(0.06, 0.06, GH, 16), postM); p.position.set(px, GH / 2, 0); goal.add(p); });
  var bar = new T.Mesh(new T.CylinderGeometry(0.06, 0.06, GW + 0.12, 16), postM); bar.rotation.z = Math.PI / 2; bar.position.y = GH; goal.add(bar);
  var netTex = M.canvasTex(256, 256, function (x, w, h) { x.strokeStyle = 'rgba(255,255,255,.85)'; x.lineWidth = 2; for (var i = 0; i <= w; i += 16) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, h); x.stroke(); x.beginPath(); x.moveTo(0, i); x.lineTo(w, i); x.stroke(); } }, [6, 2]);
  var netM = new T.MeshStandardMaterial({ map: netTex, transparent: true, alphaTest: 0.2, side: T.DoubleSide, roughness: 0.9 });
  var back = new T.Mesh(new T.PlaneGeometry(GW, GH), netM); back.position.set(0, GH / 2, -2); goal.add(back);
  var top = new T.Mesh(new T.PlaneGeometry(GW, 2), netM); top.rotation.x = Math.PI / 2; top.position.set(0, GH, -1); goal.add(top);
  [-1, 1].forEach(function (s) { var sd = new T.Mesh(new T.PlaneGeometry(2, GH), netM); sd.rotation.y = Math.PI / 2; sd.position.set(s * GW / 2, GH / 2, -1); goal.add(sd); });
  goal.traverse(function (m) { if (m.isMesh) m.castShadow = true; });
  // stands with a crowd, adverts board, floodlights
  var crowdTex = M.canvasTex(1024, 256, function (x, w, h) {
    x.fillStyle = '#1e293b'; x.fillRect(0, 0, w, h);
    var cols = ['#f2060a', '#037bdc', '#ffffff', '#facc15', '#22c55e', '#f97316', '#e2e8f0', '#0ea5e9', '#a16207', '#1d4ed8'];
    for (var r = 0; r < 16; r++) for (var c = 0; c < 128; c++) { x.fillStyle = cols[(Math.random() * cols.length) | 0]; x.beginPath(); x.arc(c * 8 + 4 + (r % 2) * 4, r * 16 + 6, 3.2, 0, 7); x.fill(); x.fillStyle = '#7c4a2d'; x.beginPath(); x.arc(c * 8 + 4 + (r % 2) * 4, r * 16 + 1.5, 2, 0, 7); x.fill(); }
  }, [3, 1]);
  var standM = new T.MeshStandardMaterial({ map: crowdTex, roughness: 0.9 });
  for (var k = 0; k < 3; k++) { var st = new T.Mesh(new T.BoxGeometry(90, 4, 6), standM); st.position.set(0, 2 + k * 3.2, -14 - k * 5); st.rotation.x = -0.18; scene.add(st); }
  [-1, 1].forEach(function (s) { for (var k2 = 0; k2 < 3; k2++) { var sd = new T.Mesh(new T.BoxGeometry(6, 4, 60), standM); sd.position.set(s * (32 + k2 * 5), 2 + k2 * 3.2, 10); scene.add(sd); } });
  var adTex = M.canvasTex(1024, 64, function (x, w, h) { x.fillStyle = '#0b2545'; x.fillRect(0, 0, w, h); x.textBaseline = 'middle'; for (var i = 0; i < 4; i++) { var fs = 34; do { x.font = '900 ' + fs + 'px Archivo,sans-serif'; fs -= 2; } while (x.measureText('WARTABIYE').width > 170 && fs > 14); var tw = x.measureText('WARTABIYE').width, ox = i * 256 + (256 - tw - 50) / 2; x.fillStyle = '#fff'; x.fillText('WARTABIYE', ox, h / 2 + 1); x.fillStyle = '#f2060a'; x.fillRect(ox + tw + 8, 12, 42, 40); x.fillStyle = '#fff'; x.font = '900 26px Archivo,sans-serif'; x.fillText('TV', ox + tw + 13, h / 2 + 2); } });
  var adM = new T.MeshStandardMaterial({ map: adTex, emissiveMap: adTex, emissive: 0xffffff, emissiveIntensity: 0.6 });
  var ad = new T.Mesh(new T.BoxGeometry(40, 0.9, 0.2), adM); ad.position.set(0, 0.45, -5.5); scene.add(ad);
  var lampM = new T.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 3 });
  [[-30, -24], [30, -24], [-34, 30], [34, 30]].forEach(function (p) { var tw = new T.Mesh(new T.CylinderGeometry(0.4, 0.6, 26, 8), M.mat(0x64748b, { metalness: 0.7 })); tw.position.set(p[0], 13, p[1]); scene.add(tw); var lp = new T.Mesh(new T.BoxGeometry(5, 3, 0.6), lampM); lp.position.set(p[0], 26, p[1]); lp.lookAt(0, 0, 5); scene.add(lp); });

  // ---------------------------------------------------------------- players and ball
  var keeperY = M.person({ shirt: 0xf59e0b, pants: 0x111827, shoe: 0x111827, skin: 0x8d5524 }), keeperB = M.person({ shirt: 0x22c55e, pants: 0x111827, shoe: 0x111827, skin: 0x6b4423, hair: 0x1f1f1f });
  [keeperY, keeperB].forEach(function (k) { k.parts.armL.children[0].material = k.parts.armL.children[0].material.clone(); var gl = M.mat(0xffffff); k.parts.armL.userData.knee.children[1].material = gl; k.parts.armR.userData.knee.children[1].material = gl; k.g.position.set(0, 0, -0.3); scene.add(k.g); });
  var shooterMe = M.person({ shirt: 0x037bdc, pants: 0xffffff, shoe: 0xf2060a, number: 10, bareLegs: true }), shooterCpu = M.person({ shirt: 0xdc2626, pants: 0x111827, shoe: 0xffffff, number: 9, bareLegs: true, skin: 0x5c3a21 });
  [shooterMe, shooterCpu].forEach(function (p) { p.g.rotation.y = Math.PI; scene.add(p.g); });
  var ball = M.ball('football', 0.11); scene.add(ball);
  var ballShadow = M.blob(0.16, 0.5); scene.add(ballShadow);
  var reticle = new T.Group(); var rm = new T.MeshBasicMaterial({ color: 0xf2060a, transparent: true, opacity: 0.95, depthTest: false });
  reticle.add(new T.Mesh(new T.RingGeometry(0.22, 0.3, 32), rm)); var cr1 = new T.Mesh(new T.PlaneGeometry(0.9, 0.05), rm), cr2 = new T.Mesh(new T.PlaneGeometry(0.05, 0.9), rm); reticle.add(cr1, cr2); reticle.renderOrder = 10; scene.add(reticle);
  var zones = new T.Group(); [0, 1, 2].forEach(function (z) { var m = new T.Mesh(new T.PlaneGeometry(GW / 3 - 0.1, GH - 0.1), new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.12, depthWrite: false })); m.position.set(-GW / 3 + z * GW / 3, GH / 2, 0.05); zones.add(m); }); scene.add(zones);

  // ---------------------------------------------------------------- HUD
  var hudT = api.h('div', { style: { position: 'absolute', left: '50%', top: '10px', transform: 'translateX(-50%)', display: 'flex', alignItems: 'center', gap: '10px', background: 'rgba(2,6,23,.7)', padding: '6px 12px', borderRadius: '12px', fontWeight: 900, fontSize: 'clamp(12px,3.6vw,16px)', whiteSpace: 'nowrap', border: '1px solid rgba(255,255,255,.2)' } });
  var big = api.h('div', { style: { position: 'absolute', left: 0, right: 0, top: '38%', textAlign: 'center', fontSize: 'clamp(34px,9vw,64px)', fontWeight: 900, letterSpacing: '.04em', textShadow: '0 4px 18px rgba(0,0,0,.7)', opacity: 0, transition: 'opacity .25s, transform .25s' } });
  var tip = api.h('div', { style: { position: 'absolute', left: 0, right: 0, bottom: '12px', textAlign: 'center', fontWeight: 800, fontSize: '15px', textShadow: '0 2px 6px rgba(0,0,0,.8)', padding: '0 10px' } });
  X.hud.append(hudT, big, tip);
  function dots(arr) { var s = ''; for (var i = 0; i < Math.max(5, arr.length); i++) s += arr[i] === undefined ? '⚪' : arr[i] ? '🟢' : '🔴'; return s; }
  function drawHud() { hudT.innerHTML = ''; hudT.append(api.h('span', { text: tx('you') + ' ' + myGoals }), api.h('span', { style: { fontSize: '11px' }, text: dots(mine) }), api.h('span', { text: '–' }), api.h('span', { style: { fontSize: '11px' }, text: dots(theirs) }), api.h('span', { text: cpuGoals + ' ' + tx('cpu') })); }
  function flash(s, col) { big.textContent = s; big.style.color = col || '#fff'; big.style.opacity = '1'; big.style.transform = 'scale(1.1)'; api.after(1100, function () { big.style.opacity = '0'; big.style.transform = 'scale(1)'; }); }

  // ---------------------------------------------------------------- game flow (same rules as the 2D version)
  var phase, aim, tAim, fly, kd, round, mine, theirs, myGoals, cpuGoals, turn, saves, fx, runT;
  function reset() { round = 0; mine = []; theirs = []; myGoals = 0; cpuGoals = 0; saves = 0; turn = 'shoot'; fx = []; next(); }
  function next() {
    ball.position.set(0, 0.11, SPOT); ball.rotation.set(0, 0, 0); fly = null; kd = { x: 0, y: 0, t: 0, rot: 0 }; runT = 0;
    phase = turn === 'shoot' ? 'aimX' : 'save'; tAim = 0; aim = new T.Vector3(0, GH / 2, 0);
    keeperY.g.visible = turn === 'shoot'; keeperB.g.visible = turn !== 'shoot';
    shooterMe.g.visible = turn === 'shoot'; shooterCpu.g.visible = turn !== 'shoot';
    tip.textContent = turn === 'shoot' ? tx('aimX') + ' · ' + tx('swipe') : tx('save');
    reticle.visible = turn === 'shoot'; zones.visible = turn !== 'shoot'; drawHud();
  }
  function done() {
    var n = Math.max(mine.length, theirs.length), sc = myGoals + ' – ' + cpuGoals;
    if (mine.length === theirs.length && n >= 5 && (myGoals !== cpuGoals || n >= 10)) { if (myGoals > cpuGoals) api.win(api.score, { so: sc, en: sc }); else api.lose(api.score, { so: sc, en: sc }); return true; }
    if (mine.length === theirs.length && mine.length < 5) { var left = 5 - mine.length; if (myGoals + left < cpuGoals || cpuGoals + left < myGoals) { if (myGoals > cpuGoals) api.win(api.score, { so: sc, en: sc }); else api.lose(api.score, { so: sc, en: sc }); return true; } }
    return false;
  }
  function launch(target, keeperX, keeperHigh) {
    phase = 'run'; runT = 0; reticle.visible = false; zones.visible = false; tip.textContent = '';
    fly = { from: ball.position.clone(), to: target.clone(), t: 0, curve: (Math.random() - 0.5) * 1.2, res: null };
    kd = { x: Math.max(-GW / 2 + 0.6, Math.min(GW / 2 - 0.6, keeperX)), y: keeperHigh ? 0.9 : 0, t: 0 };
  }
  function shoot(target) {
    var guess = Math.random() < skill ? target.x : (Math.random() - 0.5) * GW;
    launch(target, guess, target.y > GH * 0.55);
  }
  function dive(zone) {
    if (phase !== 'save') return;
    var cz = Math.random() < 0.5 ? api.pick([0, 2]) : api.rand(0, 2), high = Math.random() < 0.4, acc = Math.random() < cpuAcc;
    var tx2 = -GW / 2 + 0.8 + cz * (GW - 1.6) / 2 + (Math.random() - 0.5) * 0.6, ty = high ? GH - 0.45 : 0.4;
    if (!acc) { tx2 = (Math.random() < 0.5 ? -1 : 1) * (GW / 2 + 0.5 + Math.random()); ty = Math.random() < 0.3 ? GH + 0.4 : ty; }
    launch(new T.Vector3(tx2, ty, 0), -GW / 2 + 1.2 + zone * (GW - 2.4) / 2, high);
    fly.cpu = true;
  }
  function resolve() {
    var p = fly.to, inGoal = Math.abs(p.x) < GW / 2 - 0.1 && p.y < GH - 0.08 && p.y > 0;
    var savedIt = inGoal && Math.abs(p.x - kd.x) < (fly.cpu ? 1.25 : 1.05) && Math.abs(p.y - (kd.y + 1.0)) < 1.25;
    var res = !inGoal ? 'miss' : savedIt ? 'saved' : 'goal'; fly.res = res;
    if (!fly.cpu) {
      mine.push(res === 'goal');
      if (res === 'goal') { myGoals++; api.add(100); api.sfx('win'); flash(tx('goal'), '#ffd166'); fx.push(M.burst(scene, p.clone(), 0xffd166, 40)); if (p.y > GH - 0.7 && Math.abs(p.x) > GW / 2 - 1.2) { api.add(50); api.achieve('top', { so: 'Gool geeska sare ah', en: 'Top-corner goal' }); } }
      else { api.sfx('bad'); flash(tx(res), '#fca5a5'); }
    } else {
      theirs.push(res === 'goal');
      if (res === 'goal') { cpuGoals++; api.sfx('bad'); flash(tx('goal'), '#fca5a5'); }
      else { if (res === 'saved') { saves++; api.add(60); api.sfx('good'); if (saves >= 3) api.achieve('wall', { so: '3 badbaadin', en: '3 saves' }); } else api.sfx('good'); flash(tx(res), '#86efac'); }
    }
    drawHud(); phase = 'after';
    api.after(1700, function () { if (fly.cpu) { round++; turn = 'shoot'; } else turn = 'save'; if (!done()) next(); });
  }
  function update(dt) {
    tAim += dt;
    var sp = 1.6 + (api.level === 'hard' ? 0.8 : api.level === 'medium' ? 0.4 : 0);
    if (phase === 'aimX') { aim.x = Math.sin(tAim * sp * 2) * (GW / 2 + 0.6); aim.y = GH / 2; }
    if (phase === 'aimY') aim.y = GH / 2 + Math.sin(tAim * sp * 2.2) * (GH / 2 + 0.5);
    if (phase === 'run') { runT += dt; if (runT > 0.55) { phase = 'fly'; api.sfx('hit'); } }
    if (phase === 'fly' || phase === 'after') {
      kd.t = Math.min(1, kd.t + dt * 2.4);
      if (fly && fly.t < 1) {
        fly.t = Math.min(1, fly.t + dt * 1.9); var e = fly.t;
        ball.position.lerpVectors(fly.from, fly.to, e); ball.position.y += Math.sin(e * Math.PI) * 0.6; ball.position.x += Math.sin(e * Math.PI) * fly.curve;
        ball.rotation.x -= dt * 25; ball.rotation.y += dt * 8;
        if (fly.t >= 1) resolve();
      } else if (fly && fly.res) {
        // after: into the net, deflected, or wide
        if (fly.res === 'goal') { if (ball.position.z > -1.8) ball.position.z -= dt * 6; ball.position.y = Math.max(0.11, ball.position.y - dt * 2); }
        else if (fly.res === 'saved') { ball.position.z += dt * 5; ball.position.x += (ball.position.x - kd.x || 1) * dt * 1.5; ball.position.y = Math.max(0.11, ball.position.y - dt * 3); }
        else { ball.position.z -= dt * 8; }
      }
    }
    fx = fx.filter(function (f) { return f(dt); });
  }
  function draw() {
    var K = turn === 'shoot' ? keeperY : keeperB, e = kd.t, ease = 1 - Math.pow(1 - e, 3);
    K.g.position.set(kd.x * ease, kd.y * Math.sin(Math.min(1, e) * Math.PI * 0.6), -0.3);
    var side = kd.x > 0.3 ? -1 : kd.x < -0.3 ? 1 : 0; K.g.rotation.z = side * ease * 1.25; K.g.rotation.y = 0;
    if (phase === 'aimX' || phase === 'aimY' || phase === 'save') { K.pose(tAim * 6, 'idle'); K.parts.armL.rotation.z = 0.6; K.parts.armR.rotation.z = -0.6; K.parts.body.position.y = Math.abs(Math.sin(tAim * 5)) * 0.05; }
    else { K.pose(0, 'idle'); K.parts.armL.rotation.z = 2.4 * ease; K.parts.armR.rotation.z = -2.4 * ease; }
    var Sh = turn === 'shoot' ? shooterMe : shooterCpu, rz = phase === 'run' ? 1 - runT / 0.55 : phase === 'fly' || phase === 'after' ? 0 : 1;
    Sh.g.position.set(-0.75 - rz * 1.3, 0, SPOT + 0.45 + rz * 2.2); Sh.g.rotation.y = Math.PI + 0.45;
    if (phase === 'run') Sh.pose(runT * 18, 'run'); else if (phase === 'fly' || phase === 'after') { Sh.pose(0, 'idle'); Sh.parts.legR.rotation.x = -1.3 + Math.min(1, kd.t * 3) * 0.6; } else Sh.pose(tAim * 3, 'idle');
    reticle.position.set(aim.x, aim.y, 0.12); reticle.scale.setScalar(phase === 'aimY' ? 0.85 : 1); cr2.visible = phase !== 'aimY';
    ballShadow.position.set(ball.position.x, 0.01, ball.position.z); ballShadow.scale.setScalar(Math.max(0.4, 1 - ball.position.y * 0.3));
    var cz = phase === 'fly' || phase === 'after' ? 18.5 - Math.min(1, fly ? fly.t : 0) * 2.5 : 18.5;
    var portrait = X.H > X.W; cam.position.set(portrait ? 0.9 : 0.6, portrait ? 2.9 : 2.5, cz + (portrait ? 2.5 : 0)); cam.lookAt(0, portrait ? 1.0 : 1.2, 0);
    X.render();
  }
  // input: tap (lock aim / dive) and swipe at the goal
  var ray = new T.Raycaster(), goalPlane = new T.Plane(new T.Vector3(0, 0, 1), 0), sx = 0, sy = 0, st = 0;
  X.cv.addEventListener('pointerdown', function (e) { if (api.paused) return; e.preventDefault(); sx = e.clientX; sy = e.clientY; st = performance.now(); });
  X.cv.addEventListener('pointerup', function (e) {
    if (api.paused) return; var dx = e.clientX - sx, dy = e.clientY - sy;
    ray.setFromCamera(X.ndc(e), cam); var hit = new T.Vector3(); ray.ray.intersectPlane(goalPlane, hit);
    if (turn === 'shoot' && (phase === 'aimX' || phase === 'aimY') && dy < -40 && Math.abs(dy) > Math.abs(dx) * 0.6) {
      // swipe: aim where the finger ended, with a little spread for fast flicks
      var err = Math.min(0.9, 0.25 + 160 / Math.max(80, performance.now() - st) * 0.1);
      var tg = new T.Vector3(hit.x + (Math.random() - 0.5) * err, Math.max(0.2, hit.y + (Math.random() - 0.5) * err), 0); aim.copy(tg); shoot(tg); return;
    }
    tap(hit);
  });
  function tap(hit) {
    if (phase === 'aimX') { phase = 'aimY'; tAim = 0; tip.textContent = tx('aimY'); api.sfx('tap'); }
    else if (phase === 'aimY') shoot(aim.clone());
    else if (phase === 'save') dive(!hit ? 1 : hit.x < -GW / 6 ? 0 : hit.x > GW / 6 ? 2 : 1);
  }
  return {
    start: function () { reset(); draw(); api.loop(function (dt) { update(dt); draw(); }); },
    key: function (e, down) {
      if (!down) return;
      if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); tap(null); }
      else if (phase === 'save' && (e.key === 'ArrowLeft' || e.key === 'ArrowUp' || e.key === 'ArrowRight')) { e.preventDefault(); dive(e.key === 'ArrowLeft' ? 0 : e.key === 'ArrowUp' ? 1 : 2); }
    },
    destroy: function () { X.dispose(); }
  };
});
