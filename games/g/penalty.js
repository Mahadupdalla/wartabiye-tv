/* Penalty Kick: football penalty shoot-out against the computer. Take a shot, then save one. Original implementation. */
WTG.register('penalty', function (api) {
  var W = 360, H = 560, C = api.canvas(W, H, 30), x = C.ctx;
  var GX = 50, GY = 90, GW = 260, GH = 120;
  var T = { so: { shoot: 'Laad: taabo si aad u doorato jihada, mar kale si aad u doorato dhererka', save: 'Ilaali: taabo meesha aad u boodayso (bidix, dhex, midig)', goal: 'GOOL!', saved: 'Waa la qabtay!', miss: 'Waa ka baxay', you: 'Adiga', cpu: 'Kombiyuutar' },
    en: { shoot: 'Shoot: tap to lock direction, tap again to lock height', save: 'Save: tap where to dive (left, centre, right)', goal: 'GOAL!', saved: 'Saved!', miss: 'Missed', you: 'You', cpu: 'CPU' } };
  function tx(k) { return (T[api.lang] || T.en)[k] || T.en[k]; }
  var skill = { easy: 0.25, medium: 0.4, hard: 0.55 }[api.level];   // keeper skill
  var cpuAcc = { easy: 0.6, medium: 0.72, hard: 0.85 }[api.level];
  var phase, ax, ay, tAim, ball, keeper, msg, msgT, round, mine, theirs, myGoals, cpuGoals, turn, saves;
  function reset() { round = 0; mine = []; theirs = []; myGoals = 0; cpuGoals = 0; saves = 0; turn = 'shoot'; next(); }
  function next() {
    ball = { x: W / 2, y: H - 90, tx: 0, ty: 0, t: 0, fly: false }; keeper = { x: W / 2, y: GY + GH - 34, dx: 0, dy: 0, t: 0 };
    phase = turn === 'shoot' ? 'aimX' : 'save'; tAim = 0; msg = turn === 'shoot' ? tx('shoot') : tx('save'); msgT = 99;
  }
  function done() {
    var n = Math.max(mine.length, theirs.length);
    if (mine.length === theirs.length && n >= 5) {
      if (myGoals !== cpuGoals || n >= 10) {
        if (myGoals > cpuGoals) api.win(api.score, { so: myGoals + ' – ' + cpuGoals, en: myGoals + ' – ' + cpuGoals }); else api.lose(api.score, { so: myGoals + ' – ' + cpuGoals, en: myGoals + ' – ' + cpuGoals });
        return true;
      }
    }
    if (mine.length === theirs.length && mine.length < 5) {
      // early finish when one side cannot catch up
      var left = 5 - mine.length; if (myGoals + left < cpuGoals || cpuGoals + left < myGoals) { if (myGoals > cpuGoals) api.win(api.score, { en: myGoals + ' – ' + cpuGoals }); else api.lose(api.score, { en: myGoals + ' – ' + cpuGoals }); return true; }
    }
    return false;
  }
  function shoot() {
    phase = 'fly'; ball.fly = true; ball.t = 0; ball.sx = ball.x; ball.sy = ball.y; ball.tx = ax; ball.ty = ay;
    // keeper guesses; better keepers read the shot more often
    var guess = Math.random() < skill ? ax : GX + Math.random() * GW;
    keeper.dx = Math.max(GX + 20, Math.min(GX + GW - 20, guess)) - keeper.x; keeper.dy = (ay < GY + GH / 2 ? -40 : 0); keeper.t = 0;
    api.sfx('hit');
  }
  function resolveShot() {
    var inGoal = ax > GX + 6 && ax < GX + GW - 6 && ay > GY + 6 && ay < GY + GH;
    var kx = keeper.x + keeper.dx, ky = keeper.y + keeper.dy;
    var savedIt = inGoal && Math.abs(ax - kx) < 38 && Math.abs(ay - (ky + 10)) < 50;
    var res = !inGoal ? 'miss' : savedIt ? 'saved' : 'goal';
    mine.push(res === 'goal'); if (res === 'goal') { myGoals++; api.add(100); api.sfx('win'); if (ay < GY + 30 && (ax < GX + 40 || ax > GX + GW - 40)) { api.add(50); api.achieve('top', { so: 'Gool geeska sare ah', en: 'Top-corner goal' }); } } else api.sfx('bad');
    msg = tx(res); msgT = 1.4; phase = 'wait';
    api.after(1400, function () { turn = 'save'; if (!done()) next(); });
  }
  function dive(zone) {
    if (phase !== 'save') return;
    phase = 'fly';
    var cz = Math.random() < 0.5 ? api.pick([0, 2]) : api.rand(0, 2);
    var high = Math.random() < 0.4;
    var acc = Math.random() < cpuAcc;
    ax = GX + 30 + cz * (GW - 60) / 2 + (Math.random() * 30 - 15); ay = high ? GY + 22 : GY + GH - 22;
    if (!acc) { ax = Math.random() < 0.5 ? GX - 15 : GX + GW + 15; }
    ball.fly = true; ball.t = 0; ball.sx = ball.x; ball.sy = ball.y; ball.tx = ax; ball.ty = ay;
    keeper.dx = GX + 30 + zone * (GW - 60) / 2 - keeper.x; keeper.dy = high ? -40 : 0; keeper.t = 0;
    ball.cpu = { zone: cz, acc: acc };
    api.sfx('hit');
  }
  function resolveSave() {
    var c = ball.cpu, kx = keeper.x + keeper.dx;
    var inGoal = c.acc, savedIt = inGoal && Math.abs(ax - kx) < 44;
    var res = !inGoal ? 'miss' : savedIt ? 'saved' : 'goal';
    theirs.push(res === 'goal'); if (res === 'goal') { cpuGoals++; api.sfx('bad'); } else { if (res === 'saved') { saves++; api.add(60); api.sfx('good'); if (saves >= 3) api.achieve('wall', { so: '3 badbaadin', en: '3 saves' }); } }
    msg = tx(res); msgT = 1.4; phase = 'wait';
    api.after(1400, function () { round++; turn = 'shoot'; if (!done()) next(); });
  }
  function update(dt) {
    tAim += dt; if (msgT < 99) msgT -= dt;
    var sp = 1.6 + (api.level === 'hard' ? 0.8 : api.level === 'medium' ? 0.4 : 0);
    if (phase === 'aimX') { ax = W / 2 + Math.sin(tAim * sp * 2) * (GW / 2 + 20); ay = GY + GH / 2; }
    if (phase === 'aimY') { ay = GY + GH / 2 + Math.sin(tAim * sp * 2.2) * (GH / 2 + 18); }
    if (ball.fly) {
      ball.t = Math.min(1, ball.t + dt * 2.2); var e = ball.t;
      ball.x = ball.sx + (ball.tx - ball.sx) * e; ball.y = ball.sy + (ball.ty - ball.sy) * e - Math.sin(e * Math.PI) * 40;
      keeper.t = Math.min(1, keeper.t + dt * 2.6);
      if (ball.t >= 1) { ball.fly = false; if (turn === 'shoot') resolveShot(); else resolveSave(); }
    }
  }
  function draw() {
    var g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#14532d'); g.addColorStop(1, '#16a34a'); x.fillStyle = g; x.fillRect(0, 0, W, H);
    for (var i = 0; i < 8; i++) { x.fillStyle = i % 2 ? 'rgba(255,255,255,.04)' : 'rgba(0,0,0,.04)'; x.fillRect(0, GY + GH + i * 50, W, 50); }
    x.fillStyle = '#0b2545'; x.fillRect(0, 0, W, GY - 20);
    x.font = 'bold 14px sans-serif'; x.textAlign = 'left'; x.fillStyle = '#fff'; x.textBaseline = 'middle';
    x.fillText(tx('you') + ' ' + myGoals, 12, 18); x.textAlign = 'right'; x.fillText(cpuGoals + ' ' + tx('cpu'), W - 12, 18);
    function dots(arr, y, right) { for (var k = 0; k < Math.max(5, arr.length); k++) { x.beginPath(); x.arc(right ? W - 18 - k * 16 : 18 + k * 16, y, 5, 0, 7); x.fillStyle = arr[k] === undefined ? 'rgba(255,255,255,.25)' : arr[k] ? '#22c55e' : '#ef4444'; x.fill(); } }
    dots(mine, 42, false); dots(theirs, 42, true);
    // goal
    x.strokeStyle = 'rgba(255,255,255,.35)'; x.lineWidth = 1;
    for (var nx = GX; nx <= GX + GW; nx += 13) { x.beginPath(); x.moveTo(nx, GY); x.lineTo(nx, GY + GH); x.stroke(); }
    for (var ny = GY; ny <= GY + GH; ny += 13) { x.beginPath(); x.moveTo(GX, ny); x.lineTo(GX + GW, ny); x.stroke(); }
    x.strokeStyle = '#fff'; x.lineWidth = 6; x.beginPath(); x.moveTo(GX, GY + GH); x.lineTo(GX, GY); x.lineTo(GX + GW, GY); x.lineTo(GX + GW, GY + GH); x.stroke();
    x.lineWidth = 3; x.beginPath(); x.moveTo(0, GY + GH); x.lineTo(W, GY + GH); x.stroke();
    x.beginPath(); x.arc(W / 2, H - 90, 4, 0, 7); x.fillStyle = '#fff'; x.fill();
    // keeper
    var e = keeper.t, kx = keeper.x + keeper.dx * e, ky = keeper.y + keeper.dy * e, lean = keeper.dx * e / 140;
    x.save(); x.translate(kx, ky + 20); x.rotate(lean);
    x.fillStyle = turn === 'shoot' ? '#f59e0b' : '#037BDC'; x.fillRect(-14, -30, 28, 34);
    x.strokeStyle = turn === 'shoot' ? '#f59e0b' : '#037BDC'; x.lineWidth = 7; x.lineCap = 'round'; x.beginPath(); x.moveTo(-14, -26); x.lineTo(-30, -44); x.moveTo(14, -26); x.lineTo(30, -44); x.stroke();
    x.strokeStyle = '#111'; x.beginPath(); x.moveTo(-7, 4); x.lineTo(-9, 22); x.moveTo(7, 4); x.lineTo(9, 22); x.stroke();
    x.fillStyle = '#c68642'; x.beginPath(); x.arc(0, -40, 10, 0, 7); x.fill(); x.restore();
    // aim
    if (phase === 'aimX' || phase === 'aimY') { x.strokeStyle = '#F2060A'; x.lineWidth = 3; x.beginPath(); x.arc(ax, ay, 13, 0, 7); x.moveTo(ax - 20, ay); x.lineTo(ax + 20, ay); x.moveTo(ax, ay - 20); x.lineTo(ax, ay + 20); x.stroke(); }
    if (phase === 'save') { x.fillStyle = 'rgba(255,255,255,.12)'; for (var z = 0; z < 3; z++) { x.fillRect(GX + 4 + z * GW / 3, GY + 4, GW / 3 - 8, GH - 8); } x.fillStyle = '#fff'; x.font = 'bold 28px sans-serif'; x.textAlign = 'center'; ['◀', '●', '▶'].forEach(function (s, z) { x.fillText(s, GX + GW / 6 + z * GW / 3, GY + GH / 2); }); }
    // ball
    var bs = ball.fly ? 14 - ball.t * 6 : 14;
    x.fillStyle = 'rgba(0,0,0,.25)'; x.beginPath(); x.ellipse(ball.x, ball.fly ? ball.sy + (ball.ty - ball.sy) * ball.t + 10 : ball.y + 10, bs, bs / 3, 0, 0, 7); x.fill();
    x.fillStyle = '#fff'; x.beginPath(); x.arc(ball.x, ball.y, bs, 0, 7); x.fill(); x.fillStyle = '#111'; x.beginPath(); x.arc(ball.x, ball.y, bs * 0.38, 0, 7); x.fill();
    if (msg) { x.font = msgT < 99 ? 'bold 34px Archivo,sans-serif' : 'bold 14px sans-serif'; x.textAlign = 'center'; x.fillStyle = '#fff'; x.strokeStyle = 'rgba(0,0,0,.5)'; x.lineWidth = 4; wrapText(msg, W / 2, msgT < 99 ? GY + GH + 70 : H - 36); }
  }
  function wrapText(s, cx, cy) { var words = s.split(' '), lines = [''], max = 320; words.forEach(function (w) { var tt = lines[lines.length - 1] + (lines[lines.length - 1] ? ' ' : '') + w; if (x.measureText(tt).width > max) lines.push(w); else lines[lines.length - 1] = tt; }); lines.forEach(function (l, i) { x.strokeText(l, cx, cy + i * 18 - (lines.length - 1) * 9); x.fillText(l, cx, cy + i * 18 - (lines.length - 1) * 9); }); }
  function tap(e) {
    if (api.paused) return; e.preventDefault();
    if (phase === 'aimX') { phase = 'aimY'; tAim = Math.asin(0) ; api.sfx('tap'); }
    else if (phase === 'aimY') { shoot(); }
    else if (phase === 'save') { var p = C.pt(e); dive(p.x < GX + GW / 3 ? 0 : p.x > GX + 2 * GW / 3 ? 2 : 1); }
  }
  C.cv.addEventListener('pointerdown', tap);
  api.el.append(C.cv);
  return {
    start: function () { reset(); api.loop(function (dt) { update(dt); draw(); }); draw(); },
    key: function (e, down) { if (!down) return; if (e.key === ' ' || e.key === 'Enter') { tap(e); } else if (phase === 'save' && (e.key === 'ArrowLeft' || e.key === 'ArrowUp' || e.key === 'ArrowRight')) { e.preventDefault(); dive(e.key === 'ArrowLeft' ? 0 : e.key === 'ArrowRight' ? 2 : 1); } }
  };
});
