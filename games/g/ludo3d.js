/* Four Homes 3D: the race board game for 2–4 players in full 3D. Any mix of people and robots on one device, or
   online with friends through a private room code. Roll a 6 to leave home, go round the board and bring all four
   tokens to the centre. Play-coins are earned by playing and only buy looks (dice, tokens, boards); there is no real
   money, no buying and no betting. Original implementation and art. */
WTG.register3d('ludo3d', function (M, api) {
  var T = M.T, h = api.h, SO = api.lang === 'so';
  var TX = {
    so: { local: 'Isla qalabkan', online: 'Online la ciyaar saaxiibada', person: 'Qof', robot: 'Robot', off: 'Ma jiro', start: '▶ Bilow ciyaarta', roll: '🎲 Tuur', tapDice: 'Taabo laadhuuga si aad u tuurto', pick: 'Dooro gabal', none: 'Dhaqdhaqaaq ma jiro', six: '6! Mar kale tuur', win: '{c} ayaa guuleystay!', turn: 'Waa {c}', yourTurn: 'Adiga ayaa xiga!', wait: 'Sug {c}…', create: '➕ Samee qol', join: 'Gal qol', code: 'Koodhka qolka', name: 'Magacaaga', share: '🔗 La wadaag link-ga', copied: 'Link-ga waa la koobiyeeyay', friends: 'Saaxiibada qolka', waitHost: 'Sug inta martigeliyaha bilaabayo…', needTwo: 'Ugu yaraan 2 ciyaaryahan, 1 qof', noServer: 'Ciyaarta online wali lama diyaarin. Isku day mar dambe.', err_noroom: 'Qolkan ma jiro. Hubi koodhka.', err_full: 'Qolku waa buuxaa (4 qof).', err_started: 'Ciyaartu way bilaabatay.', err_kicked: 'Waa lagaa saaray qolka.', err_conn: 'Xiriirka waa go’ay. Dib ayaa loo isku dayayaa…', shop: '🛍️ Dukaanka', coins: 'lacag-ciyaareed', buy: 'Iibso', use: 'Isticmaal', inUse: '✓ La isticmaalayo', poor: 'Lacag-ciyaareed kugu filan ma haysid', dice: 'Laadhuug', tokens: 'Gabalada', board: 'Shaxda', coinsNote: 'Lacag-ciyaareedka waxaad ku kasbataa ciyaarid. Lacag dhab ah ma aha, lama iibsado.', back: '← Dib', host: 'Martigeliye', away: 'maqan', you: 'Adiga', presets: 'Dooro ciyaartoyda', leave: 'Ka bax qolka' },
    en: { local: 'On this device', online: 'Online with friends', person: 'Person', robot: 'Robot', off: 'Empty', start: '▶ Start game', roll: '🎲 Roll', tapDice: 'Tap the dice to roll', pick: 'Pick a token', none: 'No move possible', six: 'A 6! Roll again', win: '{c} wins!', turn: 'Turn: {c}', yourTurn: 'Your turn!', wait: 'Waiting for {c}…', create: '➕ Create a room', join: 'Join a room', code: 'Room code', name: 'Your name', share: '🔗 Share the link', copied: 'Link copied', friends: 'Players in the room', waitHost: 'Waiting for the host to start…', needTwo: 'At least 2 players, 1 person', noServer: 'Online play is not ready yet. Please try again later.', err_noroom: 'This room does not exist. Check the code.', err_full: 'The room is full (4 players).', err_started: 'The game has already started.', err_kicked: 'You were removed from the room.', err_conn: 'Connection lost. Reconnecting…', shop: '🛍️ Shop', coins: 'play-coins', buy: 'Buy', use: 'Use', inUse: '✓ In use', poor: 'Not enough play-coins', dice: 'Dice', tokens: 'Tokens', board: 'Board', coinsNote: 'You earn play-coins by playing. They are not real money and cannot be bought.', back: '← Back', host: 'Host', away: 'away', you: 'You', presets: 'Choose the players', leave: 'Leave room' }
  };
  function tx(k, c) { var s = (TX[api.lang] || TX.en)[k] || TX.en[k] || k; return c != null ? s.replace('{c}', c) : s; }
  var HEX = [0xef4444, 0x22c55e, 0xfacc15, 0x3b82f6], CSS = ['#ef4444', '#22c55e', '#facc15', '#3b82f6'];
  var CNAME = { so: ['Casaan', 'Cagaar', 'Jaalle', 'Buluug'], en: ['Red', 'Green', 'Yellow', 'Blue'] };
  function cname(c) { return (CNAME[api.lang] || CNAME.en)[c]; }

  // ------------------------------------------------------------------ the rules (pure state, shared online)
  var PATH = [];
  (function () {
    var i, s = [];
    for (i = 1; i <= 5; i++) s.push([6, i]); for (i = 5; i >= 0; i--) s.push([i, 6]); s.push([0, 7], [0, 8]);
    for (i = 1; i <= 5; i++) s.push([i, 8]); for (i = 9; i <= 14; i++) s.push([6, i]); s.push([7, 14], [8, 14]);
    for (i = 13; i >= 9; i--) s.push([8, i]); for (i = 9; i <= 14; i++) s.push([i, 8]); s.push([14, 7], [14, 6]);
    for (i = 13; i >= 9; i--) s.push([i, 6]); for (i = 5; i >= 0; i--) s.push([8, i]); s.push([7, 0], [6, 0]);
    PATH = s;
  })();
  var HOME = [[[7, 1], [7, 2], [7, 3], [7, 4], [7, 5]], [[1, 7], [2, 7], [3, 7], [4, 7], [5, 7]], [[7, 13], [7, 12], [7, 11], [7, 10], [7, 9]], [[13, 7], [12, 7], [11, 7], [10, 7], [9, 7]]];
  // the four home yards: row, col of the top-left corner (6×6)
  var YARD = [[0, 0], [0, 9], [9, 9], [9, 0]], OFF = [0, 13, 26, 39], SAFE = [0, 8, 13, 21, 26, 34, 39, 47];
  // red starts at PATH[0] (left arm), so red's yard is the top-left one, green top-right, yellow bottom-right, blue bottom-left
  function cellOf(c, pr) { if (pr < 0) return null; if (pr <= 50) return PATH[(OFF[c] + pr) % 52]; if (pr <= 55) return HOME[c][pr - 51]; return [7, 7]; }
  function absOf(c, pr) { return pr >= 0 && pr <= 50 ? (OFF[c] + pr) % 52 : -1; }
  function seatOf(S, c) { for (var i = 0; i < S.seats.length; i++) if (S.seats[i].c === c) return S.seats[i]; return null; }
  function curSeat(S) { return S.seats[S.cur]; }
  function movable(S, c, d) { var t = S.tok[c]; var r = []; for (var i = 0; i < 4; i++) { var pr = t[i]; if (pr < 0 ? d === 6 : pr + d <= 56) r.push(i); } return r; }
  function newState(seats) {
    var S = { v: 1, seats: seats, tok: {}, cur: 0, die: 0, rid: 0, rolled: false, sixes: 0, over: false, win: -1, seq: 0, msg: '', last: null, done: [] };
    seats.forEach(function (s) { S.tok[s.c] = [-1, -1, -1, -1]; });
    return S;
  }
  function doRoll(S, d) {
    S.die = d; S.rid++; S.rolled = true; S.seq++; S.last = null;
    var c = curSeat(S).c, mv = movable(S, c, d);
    S.sixes = d === 6 ? S.sixes + 1 : 0;
    S.pass = S.sixes === 3 || !mv.length; S.msg = S.pass ? 'none' : d === 6 ? 'six' : 'pick';
    if (S.sixes === 3) S.sixes = 0;
    return mv;
  }
  function doMove(S, i) {
    var c = curSeat(S).c, from = S.tok[c][i], d = S.die, to = from < 0 ? 0 : from + d;
    if (movable(S, c, d).indexOf(i) < 0) return null;
    S.tok[c][i] = to; var a = absOf(c, to), extra = d === 6, cap = [];
    if (a >= 0 && SAFE.indexOf(a) < 0) S.seats.forEach(function (s) { if (s.c === c) return; S.tok[s.c].forEach(function (qp, j) { if (absOf(s.c, qp) === a) { cap.push([s.c, j, qp]); S.tok[s.c][j] = -1; extra = true; } }); });
    if (to === 56) extra = true;
    S.last = { c: c, i: i, from: from, to: to, cap: cap, home: to === 56 }; S.seq++; S.rolled = false; S.pass = false;
    if (S.tok[c].every(function (v) { return v === 56; })) { S.over = true; S.win = c; S.msg = 'win'; return S.last; }
    if (extra) { S.msg = d === 6 ? 'six' : ''; } else nextTurn(S, true);
    return S.last;
  }
  function nextTurn(S, keepLast) { S.cur = (S.cur + 1) % S.seats.length; S.rolled = false; S.sixes = 0; S.pass = false; S.msg = ''; S.seq++; if (!keepLast) S.last = null; }
  function robotPick(S, mv) {
    var c = curSeat(S).c, d = S.die, best = mv[0], bv = -1e9, lv = api.level;
    mv.forEach(function (i) {
      var pr = S.tok[c][i], np = pr < 0 ? 0 : pr + d, a = absOf(c, np), v = 0;
      if (np === 56) v += 100; if (pr < 0) v += 60;
      if (a >= 0 && SAFE.indexOf(a) < 0) S.seats.forEach(function (s) { if (s.c !== c) S.tok[s.c].forEach(function (qp) { if (absOf(s.c, qp) === a) v += 120; }); });
      // danger: an opponent 1–6 squares behind
      if (lv !== 'easy' && a >= 0 && SAFE.indexOf(a) < 0) S.seats.forEach(function (s) { if (s.c !== c) S.tok[s.c].forEach(function (qp) { var qa = absOf(s.c, qp); if (qa >= 0) { var dist = (a - qa + 52) % 52; if (dist >= 1 && dist <= 6) v -= lv === 'hard' ? 45 : 20; } }); });
      if (a >= 0 && SAFE.indexOf(a) >= 0) v += 15; if (np > 50) v += 25;
      v += np * (lv === 'easy' ? 0 : 1) + Math.random() * (lv === 'easy' ? 80 : 6);
      if (v > bv) { bv = v; best = i; }
    });
    return best;
  }

  // ------------------------------------------------------------------ coins and looks (shop)
  var SHOP = {
    dice: [['ivory', 0, { so: 'Lafo cad', en: 'Ivory' }, '#f8fafc'], ['ruby', 100, { so: 'Yaaquud', en: 'Ruby' }, '#dc2626'], ['gold', 150, { so: 'Dahab', en: 'Gold' }, '#f5b301'], ['onyx', 120, { so: 'Madow dhalaalaya', en: 'Onyx' }, '#111827']],
    tokens: [['gloss', 0, { so: 'Dhalaal', en: 'Gloss' }, '#3b82f6'], ['metal', 120, { so: 'Bir', en: 'Metal' }, '#94a3b8'], ['gem', 250, { so: 'Jawharad', en: 'Gem' }, '#a855f7']],
    board: [['classic', 0, { so: 'Caadi', en: 'Classic' }, '#ffffff'], ['royal', 200, { so: 'Boqortooyo', en: 'Royal' }, '#d4a017'], ['night', 200, { so: 'Habeen nal leh', en: 'Neon night' }, '#0f172a']]
  };
  var looks = api.load('looks', { dice: 'ivory', tokens: 'gloss', board: 'classic' }), owned = api.load('owned', ['ivory', 'gloss', 'classic']);
  function coins() { return WTG.coins ? WTG.coins() : 0; }
  function earn(n, why) { if (!n || !WTG.addCoins) return; WTG.addCoins(n); coinEl.textContent = '🪙 ' + coins(); flashCoin('+' + n + ' 🪙' + (why ? ' ' + why : '')); }

  // ------------------------------------------------------------------ the 3D scene
  var X = M.setup(api, { fov: 42, far: 200, bg: ['#0b1220', '#13233d', '#1e3557'], label: 'Four Homes 3D', exposure: 0.95, envIntensity: 0.6 });
  var scene = X.scene, cam = X.camera;
  var S0 = M.sun(scene, { color: 0xfff4e0, intensity: 2.6, hemi: 0.55, sky: 0xdbeafe, ground: 0x3b2a1a, offset: new T.Vector3(-6, 18, 9), size: 12 });
  
  // table
  var tableTex = M.canvasTex(512, 512, function (x, w, hh) { var g = x.createRadialGradient(w / 2, hh / 2, 20, w / 2, hh / 2, w * 0.7); g.addColorStop(0, '#5b3a22'); g.addColorStop(1, '#24140a'); x.fillStyle = g; x.fillRect(0, 0, w, hh); for (var i = 0; i < 120; i++) { x.strokeStyle = 'rgba(0,0,0,' + (0.05 + Math.random() * 0.08) + ')'; x.lineWidth = 1 + Math.random() * 2; x.beginPath(); var y = Math.random() * hh; x.moveTo(0, y); x.bezierCurveTo(w * 0.3, y + 8, w * 0.7, y - 8, w, y + Math.random() * 6); x.stroke(); } }, [3, 3]);
  var table = new T.Mesh(new T.PlaneGeometry(80, 80), new T.MeshStandardMaterial({ map: tableTex, roughness: 0.55, metalness: 0.05 })); table.rotation.x = -Math.PI / 2; table.position.y = -0.62; table.receiveShadow = true; scene.add(table);

  var world = new T.Group(); scene.add(world);
  var TOP = 0.02;
  function wpos(r, c, y) { return new T.Vector3(c - 7, y == null ? TOP : y, r - 7); }
  var boardTop, frame;
  var logoYaw = 0; // the centre logo is drawn turned so it reads upright from every seat
  function boardTexture(theme) {
    var N = 15, R = M.mobile ? 1536 : 2048, s = R / N;
    return M.canvasTex(R, R, function (x) {
      var night = theme === 'night', royal = theme === 'royal';
      var base = night ? '#0b1220' : royal ? '#fbf3dc' : '#f8fafc', line = night ? 'rgba(148,163,184,.35)' : royal ? '#c8a96a' : '#cbd5e1';
      x.fillStyle = base; x.fillRect(0, 0, R, R);
      function col(c, a) { var v = CSS[c]; if (a == null) return v; var n = parseInt(v.slice(1), 16); return 'rgba(' + (n >> 16) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')'; }
      function rr(x0, y0, w, hh, r) { x.beginPath(); x.moveTo(x0 + r, y0); x.arcTo(x0 + w, y0, x0 + w, y0 + hh, r); x.arcTo(x0 + w, y0 + hh, x0, y0 + hh, r); x.arcTo(x0, y0 + hh, x0, y0, r); x.arcTo(x0, y0, x0 + w, y0, r); x.closePath(); }
      // yards
      YARD.forEach(function (y, c) {
        var x0 = y[1] * s, y0 = y[0] * s, g = x.createLinearGradient(x0, y0, x0 + 6 * s, y0 + 6 * s);
        g.addColorStop(0, col(c, night ? 0.55 : 1)); g.addColorStop(1, col(c, night ? 0.25 : 0.9)); x.fillStyle = g; rr(x0 + 6, y0 + 6, 6 * s - 12, 6 * s - 12, 40); x.fill();
        x.fillStyle = night ? 'rgba(2,6,23,.85)' : '#ffffff'; rr(x0 + s * 0.8, y0 + s * 0.8, s * 4.4, s * 4.4, 60); x.fill();
        if (night) { x.strokeStyle = col(c); x.lineWidth = 10; x.shadowColor = col(c); x.shadowBlur = 40; rr(x0 + s * 0.8, y0 + s * 0.8, s * 4.4, s * 4.4, 60); x.stroke(); x.shadowBlur = 0; }
        [[1.5, 1.5], [1.5, 3.5], [3.5, 1.5], [3.5, 3.5]].forEach(function (p) { x.fillStyle = col(c, night ? 0.35 : 0.22); x.beginPath(); x.arc(x0 + (p[1] + 0.5) * s, y0 + (p[0] + 0.5) * s, s * 0.62, 0, 7); x.fill(); x.strokeStyle = col(c); x.lineWidth = 8; x.stroke(); });
      });
      // track
      x.lineWidth = 4;
      PATH.forEach(function (p, i) {
        var cc = -1; OFF.forEach(function (o, k) { if (o === i) cc = k; });
        x.fillStyle = cc >= 0 ? col(cc, night ? 0.7 : 1) : night ? '#111c33' : base; x.fillRect(p[1] * s, p[0] * s, s, s); x.strokeStyle = line; x.strokeRect(p[1] * s + 2, p[0] * s + 2, s - 4, s - 4);
        if (SAFE.indexOf(i) >= 0 && cc < 0) { x.fillStyle = night ? '#e2e8f0' : royal ? '#b8860b' : '#94a3b8'; x.font = '900 ' + (s * 0.6) + 'px serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('★', p[1] * s + s / 2, p[0] * s + s / 2 + 4); }
        if (cc >= 0) { x.fillStyle = '#ffffff'; x.font = '900 ' + (s * 0.55) + 'px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('➜', p[1] * s + s / 2, p[0] * s + s / 2 + 4); }
      });
      HOME.forEach(function (hc, c) { hc.forEach(function (p) { x.fillStyle = col(c, night ? 0.75 : 0.92); x.fillRect(p[1] * s, p[0] * s, s, s); x.strokeStyle = line; x.strokeRect(p[1] * s + 2, p[0] * s + 2, s - 4, s - 4); }); });
      // centre: four triangles
      var m = 7.5 * s;
      [[0, 6, 6, 9, 6], [1, 6, 6, 6, 9], [2, 6, 9, 9, 9], [3, 9, 6, 9, 9]];
      [[0, [6, 6], [9, 6]], [1, [6, 6], [6, 9]], [2, [6, 9], [9, 9]], [3, [9, 6], [9, 9]]].forEach(function (t) {
        var g = x.createLinearGradient(m, m, t[1][1] * s, t[1][0] * s); g.addColorStop(0, col(t[0], 0.75)); g.addColorStop(1, col(t[0]));
        x.fillStyle = g; x.beginPath(); x.moveTo(m, m); x.lineTo(t[1][1] * s, t[1][0] * s); x.lineTo(t[2][1] * s, t[2][0] * s); x.closePath(); x.fill();
      });
      x.fillStyle = night ? '#e2e8f0' : '#04213f'; x.beginPath(); x.arc(m, m, s * 0.75, 0, 7); x.fill();
      x.fillStyle = night ? '#0b1220' : '#ffffff'; x.font = '900 ' + (s * 0.42) + 'px Archivo,sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.save(); x.translate(m, m + 2); x.rotate(logoYaw); x.fillText('WTV', 0, 0); x.restore();
      M.noise(x, R, R, 4000, 0.025);
    });
  }
  var boardMat = new T.MeshPhysicalMaterial({ roughness: 0.32, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.12 });
  boardTop = new T.Mesh(new T.PlaneGeometry(15, 15), boardMat); boardTop.rotation.x = -Math.PI / 2; boardTop.receiveShadow = true; world.add(boardTop);
  var frameMat = new T.MeshPhysicalMaterial({ color: 0x5a3416, roughness: 0.35, metalness: 0.1, clearcoat: 0.8, clearcoatRoughness: 0.2 });
  frame = new T.Mesh(new T.RoundedBoxGeometry(16.2, 0.6, 16.2, 4, 0.25), frameMat); frame.position.y = -0.31; frame.castShadow = true; frame.receiveShadow = true; world.add(frame);
  function setBoard(theme) {
    if (boardMat.map) boardMat.map.dispose(); boardMat.map = boardTexture(theme); boardMat.needsUpdate = true;
    frameMat.color.setHex(theme === 'royal' ? 0xb8860b : theme === 'night' ? 0x0f172a : 0x5a3416); frameMat.metalness = theme === 'royal' ? 0.85 : 0.1; frameMat.roughness = theme === 'royal' ? 0.25 : 0.35;
    boardMat.emissiveMap = theme === 'night' ? boardMat.map : null; boardMat.emissive = new T.Color(theme === 'night' ? 0x333333 : 0x000000); boardMat.emissiveIntensity = theme === 'night' ? 0.9 : 0;
    scene.background = M.gradientTex(theme === 'night' ? ['#020617', '#0b1220', '#1e1b4b'] : theme === 'royal' ? ['#1c1208', '#3b2a12', '#5b3a22'] : ['#0b1220', '#13233d', '#1e3557']);
  }

  // tokens: a turned pawn (lathe), glossy
  var pawnPts = [[0, 0], [0.36, 0], [0.38, 0.05], [0.33, 0.1], [0.24, 0.16], [0.15, 0.34], [0.12, 0.5], [0.2, 0.55], [0.12, 0.6], [0.2, 0.72], [0.18, 0.84], [0.1, 0.9], [0, 0.92]].map(function (p) { return new T.Vector2(p[0], p[1]); });
  var pawnGeo = new T.LatheGeometry(pawnPts, 28);
  function tokenMat(c, style) {
    var o = { color: HEX[c], roughness: 0.18, metalness: 0.05, clearcoat: 1, clearcoatRoughness: 0.06 };
    if (style === 'metal') { o.metalness = 0.9; o.roughness = 0.22; o.clearcoat = 0.6; }
    if (style === 'gem') { o.roughness = 0.05; o.metalness = 0.2; o.iridescence = 1; o.iridescenceIOR = 1.5; o.emissive = new T.Color(HEX[c]); o.emissiveIntensity = 0.25; o.sheen = 1; o.sheenColor = new T.Color(0xffffff); }
    return new T.MeshPhysicalMaterial(o);
  }
  var tokens = {}, ringGeo = new T.TorusGeometry(0.42, 0.05, 10, 40), ringMat = new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9 });
  function buildTokens(S) {
    Object.keys(tokens).forEach(function (k) { world.remove(tokens[k].g); }); tokens = {};
    S.seats.forEach(function (s) { for (var i = 0; i < 4; i++) {
      var g = new T.Group(), m = new T.Mesh(pawnGeo, tokenMat(s.c, looks.tokens)); m.castShadow = true; g.add(m);
      var ring = new T.Mesh(ringGeo, ringMat.clone()); ring.rotation.x = Math.PI / 2; ring.position.y = 0.03; ring.visible = false; g.add(ring);
      g.userData = { c: s.c, i: i, ring: ring }; m.userData = g.userData;
      var k = s.c + ':' + i; tokens[k] = { g: g, m: m, pr: -1, anim: null }; g.position.copy(spotOf(s.c, i, -1, 0)); world.add(g);
    } });
  }
  function spotOf(c, i, pr, stack) {
    var cell = cellOf(c, pr);
    if (!cell) { var y = YARD[c], q = [[1.5, 1.5], [1.5, 3.5], [3.5, 1.5], [3.5, 3.5]][i]; return wpos(y[0] + q[0] + 0.5 - 0.5, y[1] + q[1] + 0.5 - 0.5); }
    if (pr === 56) { var a = [[-0.35, -0.35], [0.35, -0.35], [-0.35, 0.35], [0.35, 0.35]][i], dir = [[0, -1], [-1, 0], [0, 1], [1, 0]][c]; return wpos(7 + dir[1] * 0.55 + a[1] * 0.5, 7 + dir[0] * 0.55 + a[0] * 0.5); }
    var p = wpos(cell[0], cell[1]); if (stack) { var o = [[0, 0], [0.2, -0.2], [-0.2, 0.2], [0.2, 0.2], [-0.2, -0.2]][stack % 5]; p.x += o[0]; p.z += o[1]; }
    return p;
  }
  // dice
  function pipTex(n, skin) {
    return M.canvasTex(256, 256, function (x, w) {
      var bg = { ivory: ['#ffffff', '#e2e8f0'], ruby: ['#ef4444', '#991b1b'], gold: ['#fde68a', '#d97706'], onyx: ['#374151', '#030712'] }[skin] || ['#fff', '#e2e8f0'];
      var g = x.createRadialGradient(90, 80, 10, 128, 128, 190); g.addColorStop(0, bg[0]); g.addColorStop(1, bg[1]); x.fillStyle = g; x.fillRect(0, 0, w, w);
      var P = { 1: [[0.5, 0.5]], 2: [[0.27, 0.27], [0.73, 0.73]], 3: [[0.27, 0.27], [0.5, 0.5], [0.73, 0.73]], 4: [[0.27, 0.27], [0.73, 0.27], [0.27, 0.73], [0.73, 0.73]], 5: [[0.27, 0.27], [0.73, 0.27], [0.5, 0.5], [0.27, 0.73], [0.73, 0.73]], 6: [[0.27, 0.25], [0.73, 0.25], [0.27, 0.5], [0.73, 0.5], [0.27, 0.75], [0.73, 0.75]] }[n];
      var pc = skin === 'ivory' ? (n === 1 ? '#dc2626' : '#0f172a') : skin === 'onyx' ? '#fbbf24' : '#ffffff';
      P.forEach(function (p) { var gg = x.createRadialGradient(p[0] * w - 6, p[1] * w - 6, 2, p[0] * w, p[1] * w, n === 1 ? 34 : 24); gg.addColorStop(0, pc); gg.addColorStop(1, skin === 'ivory' ? '#000' : pc); x.fillStyle = gg; x.beginPath(); x.arc(p[0] * w, p[1] * w, n === 1 ? 30 : 22, 0, 7); x.fill(); });
    });
  }
  var FACE = [3, 4, 1, 6, 2, 5];   // material order +x, -x, +y, -y, +z, -z
  var dice = new T.Mesh(new T.RoundedBoxGeometry(0.9, 0.9, 0.9, 5, 0.16), []); dice.castShadow = true; world.add(dice);
  function setDice(skin) {
    [].concat(dice.material).forEach(function (m) { if (m && m.map) { m.map.dispose(); m.dispose(); } });
    dice.material = FACE.map(function (n) { return new T.MeshPhysicalMaterial({ map: pipTex(n, skin), roughness: skin === 'gold' ? 0.25 : 0.2, metalness: skin === 'gold' ? 0.75 : 0, clearcoat: 1, clearcoatRoughness: 0.08 }); });
  }
  var UP = { 1: new T.Euler(0, 0, 0), 6: new T.Euler(Math.PI, 0, 0), 2: new T.Euler(-Math.PI / 2, 0, 0), 5: new T.Euler(Math.PI / 2, 0, 0), 3: new T.Euler(0, 0, Math.PI / 2), 4: new T.Euler(0, 0, -Math.PI / 2) };
  function faceQuat(n, yaw) { var q = new T.Quaternion().setFromEuler(UP[n]); return new T.Quaternion().setFromAxisAngle(new T.Vector3(0, 1, 0), yaw).multiply(q); }
  var DA = null;     // dice animation
  var diceRest = new T.Vector3(0, 0.45, 0);
  function throwDice(n, c) {
    var y = YARD[c], from = wpos(y[0] + 3, y[1] + 3, 1.6), to = wpos(7 + (Math.random() - 0.5) * 1.2, 7 + (Math.random() - 0.5) * 1.2, 0.45);
    // keep the dice off the centre triangles: it lands just in front of the thrower's side of the centre
    var dir = [[-1, -1], [-1, 1], [1, 1], [1, -1]][c]; to.x = dir[1] * 1.9 + (Math.random() - 0.5) * 0.5; to.z = dir[0] * 1.9 + (Math.random() - 0.5) * 0.5;
    DA = { t: 0, dur: 1.05, from: from, to: to, q0: new T.Quaternion().setFromEuler(new T.Euler(Math.random() * 6, Math.random() * 6, Math.random() * 6)), q1: faceQuat(n, Math.random() * Math.PI * 2), axis: new T.Vector3(Math.random() - 0.5, 1, Math.random() - 0.5).normalize(), spin: 16 + Math.random() * 8 };
    dice.visible = true; api.sfx('tick');
  }
  function stepDice(dt) {
    if (!DA) { dice.position.y = 0.45 + Math.sin(tt * 2) * 0.03; return; }
    DA.t += dt; var k = Math.min(1, DA.t / DA.dur), e = 1 - Math.pow(1 - k, 2.2);
    dice.position.lerpVectors(DA.from, DA.to, e);
    var bounce = Math.abs(Math.sin(k * Math.PI * 3)) * (1 - k) * 1.4; dice.position.y = 0.45 + bounce;
    if (k < 0.62) { dice.quaternion.copy(DA.q0); dice.rotateOnWorldAxis(DA.axis, DA.spin * DA.t * (1 - k)); }
    else { var q = dice.quaternion.clone(); q.slerp(DA.q1, Math.min(1, (k - 0.62) / 0.3)); dice.quaternion.copy(q); }
    if (k >= 1) { dice.quaternion.copy(DA.q1); dice.position.copy(DA.to); diceRest.copy(DA.to); DA = null; api.sfx('tap'); onDiceLanded(); }
  }

  // ------------------------------------------------------------------ HUD (DOM over the 3D view)
  var hud = X.hud; hud.style.pointerEvents = 'none';
  var css = h('style', { text: [
    '.l3 *{box-sizing:border-box}.l3-chips{position:absolute;left:8px;right:8px;top:8px;display:flex;gap:6px;justify-content:center;flex-wrap:wrap}',
    '.l3-chip{display:flex;align-items:center;gap:6px;background:rgba(2,6,23,.62);border:2px solid transparent;border-radius:999px;padding:4px 10px 4px 4px;font-weight:800;font-size:13px;backdrop-filter:blur(6px);transition:transform .2s,border-color .2s}',
    '.l3-chip i{width:22px;height:22px;border-radius:50%;display:grid;place-items:center;font-style:normal;font-size:12px;box-shadow:inset 0 -2px 0 rgba(0,0,0,.25)}',
    '.l3-chip.on{border-color:#fff;transform:scale(1.08)}.l3-chip small{opacity:.8;font-weight:700}@media (max-width:480px){.l3-chip{font-size:11px;padding:2px 7px 2px 2px;gap:4px}.l3-chip i{width:18px;height:18px;font-size:10px}.l3-coin{top:40px}}',
    '.l3-bot{position:absolute;left:0;right:0;bottom:10px;display:flex;flex-direction:column;align-items:center;gap:8px;pointer-events:none}',
    '.l3-msg{background:rgba(2,6,23,.7);padding:6px 14px;border-radius:999px;font-weight:900;font-size:15px;text-shadow:0 2px 4px rgba(0,0,0,.5);backdrop-filter:blur(6px)}',
    '.l3-roll{pointer-events:auto;border:0;border-radius:999px;padding:12px 28px;font:900 18px Archivo,sans-serif;color:#fff;background:linear-gradient(180deg,#ff3b3b,#c1121f);box-shadow:0 8px 22px rgba(193,18,31,.5),inset 0 -3px 0 rgba(0,0,0,.25);cursor:pointer}',
    '.l3-roll[disabled]{opacity:.45;filter:grayscale(.6)}',
    '.l3-coin{position:absolute;right:10px;top:46px;background:rgba(2,6,23,.62);border-radius:999px;padding:4px 10px;font-weight:900;font-size:13px}',
    '.l3-fly{position:absolute;right:14px;top:74px;font-weight:900;color:#ffd166;text-shadow:0 2px 6px rgba(0,0,0,.6);transition:transform 1.2s,opacity 1.2s}',
    '.l3-emo{display:flex;gap:4px;pointer-events:auto}.l3-emo button{border:0;background:rgba(2,6,23,.55);border-radius:12px;font-size:18px;padding:4px 7px;cursor:pointer}',
    '.l3-pop{position:absolute;font-size:34px;transition:transform 1.4s ease-out,opacity 1.4s;pointer-events:none}',
    '.l3-lobby{position:absolute;inset:0;display:grid;place-items:center;background:rgba(2,6,23,.55);backdrop-filter:blur(3px);pointer-events:auto;padding:10px;overflow:auto}',
    '.l3-card{background:linear-gradient(180deg,#0f1c31,#0b1426);color:#e7eef8;border:1px solid rgba(255,255,255,.12);border-radius:22px;max-width:520px;width:100%;padding:16px;box-shadow:0 30px 80px rgba(0,0,0,.6);max-height:100%;overflow:auto}',
    '.l3-card h2{margin:0 0 4px;font:900 22px Archivo,sans-serif;text-align:center}.l3-card h3{margin:12px 0 6px;font-size:12px;letter-spacing:.08em;text-transform:uppercase;opacity:.7}',
    '.l3-tabs{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin:8px 0}.l3-tabs button,.l3-btn{border:2px solid rgba(255,255,255,.16);background:rgba(255,255,255,.06);color:inherit;border-radius:14px;padding:10px;font-weight:800;cursor:pointer;font-size:14px}',
    '.l3-tabs button[aria-pressed="true"],.l3-btn.pri{background:#037bdc;border-color:#037bdc;color:#fff}.l3-btn.go{background:linear-gradient(180deg,#ff3b3b,#c1121f);border:0;width:100%;padding:14px;font-size:17px;margin-top:12px;color:#fff}',
    '.l3-pre{display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:6px}.l3-pre button{font-size:13px;padding:8px 6px}',
    '.l3-seats{display:grid;grid-template-columns:1fr 1fr;gap:6px}.l3-seat{display:flex;align-items:center;gap:8px;border-radius:14px;padding:8px;background:rgba(255,255,255,.05);border:2px solid rgba(255,255,255,.1);cursor:pointer;color:inherit;font-weight:800;text-align:start}',
    '.l3-seat i{width:26px;height:26px;border-radius:50%;flex:none;box-shadow:inset 0 -3px 0 rgba(0,0,0,.25)}.l3-seat.off{opacity:.45}',
    '.l3-code{font:900 40px/1 Archivo,monospace;letter-spacing:.18em;text-align:center;margin:8px 0;color:#ffd166}',
    '.l3-in{width:100%;border-radius:12px;border:2px solid rgba(255,255,255,.2);background:rgba(255,255,255,.06);color:inherit;padding:10px;font:800 16px system-ui;text-transform:none}',
    '.l3-row{display:flex;gap:6px;align-items:center}.l3-row>*{flex:1}.l3-note{font-size:12.5px;opacity:.75;margin:6px 0}.l3-err{color:#fca5a5;font-weight:800;text-align:center;min-height:1.2em}',
    '.l3-shop{display:grid;grid-template-columns:repeat(auto-fill,minmax(110px,1fr));gap:6px}.l3-item{border-radius:14px;padding:8px;background:rgba(255,255,255,.05);border:2px solid rgba(255,255,255,.1);text-align:center;font-size:13px;font-weight:800;color:inherit;cursor:pointer}',
    '.l3-item b{display:block;width:34px;height:34px;border-radius:10px;margin:0 auto 4px;box-shadow:inset 0 -3px 0 rgba(0,0,0,.25),0 0 0 2px rgba(255,255,255,.4)}.l3-item.use{border-color:#22c55e}'
  ].join('') });
  var root = h('div', { class: 'l3', style: { position: 'absolute', inset: 0 } }); hud.append(css, root);
  var chips = h('div', { class: 'l3-chips' }), coinEl = h('div', { class: 'l3-coin', text: '🪙 ' + coins() });
  var msgEl = h('div', { class: 'l3-msg', text: '' }), rollBtn = h('button', { type: 'button', class: 'l3-roll', text: tx('roll'), onclick: function () { localRoll(); } });
  var emoBar = h('div', { class: 'l3-emo', hidden: true });
  ['👍', '😂', '😮', '🔥', '👏', '😢'].forEach(function (e) { emoBar.append(h('button', { type: 'button', 'aria-label': e, text: e, onclick: function () { if (net) net.send({ t: 'emote', e: e }); } })); });
  var bot = h('div', { class: 'l3-bot' }, msgEl, rollBtn, emoBar);
  root.append(chips, coinEl, bot);
  function flashCoin(t) { var f = h('div', { class: 'l3-fly', text: t }); root.append(f); requestAnimationFrame(function () { f.style.transform = 'translateY(-30px)'; f.style.opacity = '0'; }); setTimeout(function () { f.remove(); }, 1300); }
  function popEmote(e, c) { var p = h('div', { class: 'l3-pop', text: e, style: { left: (20 + Math.random() * 60) + '%', top: '55%' } }); root.append(p); requestAnimationFrame(function () { p.style.transform = 'translateY(-120px) scale(1.4)'; p.style.opacity = '0'; }); setTimeout(function () { p.remove(); }, 1500); api.sfx('pop'); }

  // ------------------------------------------------------------------ game flow
  var S = null, role = 'local', myPid = api.load('pid', null), net = null, myName = api.load('name', ''), shown = {};
  if (!myPid) { myPid = Math.random().toString(36).slice(2, 12) + Math.random().toString(36).slice(2, 6); api.save('pid', myPid); }
  function seatName(s) { if (!s) return ''; if (s.kind === 'r') return '🤖 ' + cname(s.c); if (s.name) return s.name + (s.pid === myPid && role !== 'local' ? ' (' + tx('you') + ')' : ''); return cname(s.c); }
  function isMine(s) { if (!s) return false; if (role === 'local') return s.kind === 'h'; return s.kind === 'o' && s.pid === myPid; }
  function iAmDirector() { return role !== 'guest'; }
  function renderHud() {
    chips.innerHTML = '';
    if (!S) return;
    S.seats.forEach(function (s, k) {
      var home = S.tok[s.c].filter(function (v) { return v === 56; }).length;
      chips.append(h('div', { class: 'l3-chip' + (k === S.cur && !S.over ? ' on' : '') }, h('i', { style: { background: CSS[s.c] }, text: s.kind === 'r' ? '🤖' : '' }), h('span', { text: s.kind === 'r' ? cname(s.c) : seatName(s) }), h('small', { text: home + '/4' })));
    });
    var cs = curSeat(S), mine = isMine(cs);
    var t = S.over ? tx('win', seatName(seatOf(S, S.win))) : S.msg === 'none' ? tx('none') : mine ? (S.rolled ? tx('pick') : S.msg === 'six' ? tx('six') : (role === 'local' && S.seats.filter(function (x) { return x.kind === 'h'; }).length > 1 ? tx('turn', seatName(cs)) : tx('yourTurn'))) : (cs.kind === 'o' ? tx('wait', seatName(cs)) : tx('turn', seatName(cs)));
    msgEl.textContent = t; msgEl.style.color = CSS[S.over ? S.win : cs.c];
    rollBtn.disabled = !(mine && !S.rolled && !S.over && !busy());
    rollBtn.style.display = S.over ? 'none' : '';
    coinEl.textContent = '🪙 ' + coins();
  }
  // displayed state follows S with animations: tokens hop square by square
  var hops = [];    // queue of {k, path:[pr...], t}
  var PACE = api.cfg('pace', 1), STEP = 0.16 * PACE;
  function busy() { return !!DA || hops.length > 0; }
  function syncTokens(prev) {
    if (!S) return;
    var L = S.last, moved = {};
    if (L && prev && prev.seq !== S.seq && shown[L.c + ':' + L.i] !== L.to && (!prev.last || prev.last.c !== L.c || prev.last.i !== L.i || prev.last.to !== L.to || prev.seq < S.seq - 3)) {
      var k = L.c + ':' + L.i, path = [], from = tokens[k] ? tokens[k].pr : L.from;
      if (from < 0) path.push(0); else for (var p = from + 1; p <= L.to; p++) path.push(p);
      hops.push({ k: k, path: path, t: 0, cap: L.cap || [] }); moved[k] = 1;
      (L.cap || []).forEach(function (cp) { moved[cp[0] + ':' + cp[1]] = 1; });
    }
    // anything else jumps to its place (first frame, reconnect)
    Object.keys(tokens).forEach(function (k) { if (moved[k]) return; var c = +k.split(':')[0], i = +k.split(':')[1], pr = S.tok[c][i]; if (tokens[k].pr !== pr && !hops.some(function (hh) { return hh.k === k; })) { tokens[k].pr = pr; } });
    layoutIdle();
  }
  function stackIndex(k) {
    var c = +k.split(':')[0], i = +k.split(':')[1], pr = tokens[k].pr, cell = cellOf(c, pr); if (!cell || pr === 56) return 0;
    var n = 0; Object.keys(tokens).forEach(function (k2) { if (k2 >= k) return; var c2 = +k2.split(':')[0], cl = cellOf(c2, tokens[k2].pr); if (cl && tokens[k2].pr !== 56 && cl[0] === cell[0] && cl[1] === cell[1]) n++; });
    return n;
  }
  function layoutIdle() { Object.keys(tokens).forEach(function (k) { if (hops.some(function (hh) { return hh.k === k; })) return; var c = +k.split(':')[0], i = +k.split(':')[1]; tokens[k].target = spotOf(c, i, tokens[k].pr, stackIndex(k)); }); }
  function stepTokens(dt) {
    if (hops.length) {
      var H = hops[0], tk = tokens[H.k]; H.t += dt;
      var idx = Math.min(H.path.length - 1, Math.floor(H.t / STEP)), f = (H.t - idx * STEP) / STEP;
      var c = +H.k.split(':')[0], i = +H.k.split(':')[1];
      var fromPr = idx === 0 ? tk.pr : H.path[idx - 1], a = spotOf(c, i, fromPr, 0), b = spotOf(c, i, H.path[idx], 0);
      if (!H.started) { H.started = true; }
      if (H.lastIdx !== idx) { H.lastIdx = idx; api.sfx('move'); }
      tk.g.position.lerpVectors(a, b, Math.min(1, f)); tk.g.position.y = TOP + Math.sin(Math.min(1, f) * Math.PI) * 0.55;
      if (H.t >= H.path.length * STEP) {
        tk.pr = H.path[H.path.length - 1]; hops.shift();
        // captured tokens fly home
        H.cap.forEach(function (cp) { var k2 = cp[0] + ':' + cp[1]; if (tokens[k2]) { tokens[k2].pr = -1; tokens[k2].fly = { t: 0, from: tokens[k2].g.position.clone() }; } api.sfx('hit'); fxs.push(M.burst(world, tk.g.position.clone().setY(0.6), HEX[cp[0]], 30)); });
        if (tk.pr === 56) { api.sfx('good'); fxs.push(M.burst(world, tk.g.position.clone().setY(0.8), 0xffd166, 40)); }
        layoutIdle(); renderHud(); onHopsDone();
      }
    }
    Object.keys(tokens).forEach(function (k) {
      var tk = tokens[k]; if (hops.length && hops[0].k === k) return;
      if (tk.fly) { tk.fly.t += dt; var e = Math.min(1, tk.fly.t / 0.7); tk.g.position.lerpVectors(tk.fly.from, tk.target, e); tk.g.position.y = TOP + Math.sin(e * Math.PI) * 2.2; tk.g.rotation.z = e * Math.PI * 2; if (e >= 1) { tk.fly = null; tk.g.rotation.z = 0; } return; }
      if (tk.target) tk.g.position.lerp(tk.target, Math.min(1, dt * 12));
    });
  }
  var fxs = [], tt = 0, highlight = [];
  function setHighlight() {
    Object.keys(tokens).forEach(function (k) { tokens[k].g.userData.ring.visible = false; });
    highlight = [];
    if (!S || !S.rolled || S.pass || S.over || busy()) return;
    var cs = curSeat(S); if (!isMine(cs)) return;
    movable(S, cs.c, S.die).forEach(function (i) { var k = cs.c + ':' + i; if (tokens[k]) { tokens[k].g.userData.ring.visible = true; tokens[k].g.userData.ring.material.color.setHex(0xffffff); highlight.push(k); } });
  }

  // ---- the director (host or local): robots, passes, remote players
  var timer = null;
  function later(ms, fn) { if (timer) timer.cancel(); timer = api.after(ms, function () { timer = null; fn(); }); }
  function changed(prev) {
    syncTokens(prev); setHighlight(); renderHud();
    if (prev && S.rid !== prev.rid) throwDice(S.die, curSeatAtRoll(prev));
    if (role === 'host' && net) net.send({ t: 'state', s: S });
  }
  function curSeatAtRoll(prev) { return S.seats[S.cur].c; }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function act(fn) { var prev = clone(S); fn(); changed(prev); }
  function directorTick() {
    if (!iAmDirector() || !S || S.over || busy() || api.paused) return;
    var cs = curSeat(S);
    if (S.rolled && S.pass) { later(700 * PACE, function () { if (!busy()) act(function () { nextTurn(S); }); directorTick(); }); return; }
    if (cs.kind === 'r') {
      if (!S.rolled) later(650 * PACE, function () { if (S.over || busy() || S.rolled) return; act(function () { doRoll(S, api.rand(1, 6)); }); });
      else later(450 * PACE, function () { if (S.over || busy() || !S.rolled || S.pass) return; var mv = movable(S, cs.c, S.die); act(function () { doMove(S, robotPick(S, mv)); }); });
      return;
    }
    if (cs.kind === 'o' && cs.pid !== myPid) {
      // a friend who is away for 25 seconds is played by the robot so the game goes on
      later(25000, function () { if (S.over || busy() || curSeat(S) !== cs) return; if (!S.rolled) act(function () { doRoll(S, api.rand(1, 6)); }); else if (!S.pass) act(function () { doMove(S, robotPick(S, movable(S, cs.c, S.die))); }); });
      return;
    }
    // a person on this device: a single possible move is played automatically
    if (S.rolled && !S.pass) { var mv = movable(S, cs.c, S.die); if (mv.length === 1 && S.tok[cs.c][mv[0]] >= 0) later(350, function () { if (!busy() && S.rolled) act(function () { doMove(S, mv[0]); }); }); }
  }
  function onDiceLanded() { setHighlight(); renderHud(); after(); }
  function onHopsDone() { setHighlight(); renderHud(); after(); }
  function after() {
    if (busy()) return;
    if (S && S.last && !shown[S.seq]) { shown[S.seq] = 1; rewards(S.last); }
    if (S && S.over) return finish();
    directorTick();
  }
  function rewards(L) {
    var s = seatOf(S, L.c); if (!isMine(s)) return;
    if (L.cap && L.cap.length) { api.add(50 * L.cap.length); earn(3 * L.cap.length); api.achieve('cap', { so: 'Gabal cunay', en: 'Sent a token home' }); }
    if (L.home) { api.add(100); earn(5); }
  }
  var finished = false;
  function finish() {
    if (finished) return; finished = true; renderHud();
    var w = seatOf(S, S.win), mine = isMine(w), humans = S.seats.filter(function (s) { return s.kind !== 'r'; }).length;
    var msg = { so: TX.so.win.replace('{c}', seatName(w)), en: TX.en.win.replace('{c}', seatName(w)) };
    if (mine) { earn(role === 'local' && humans > 1 ? 20 : 60); api.achieve(role === 'local' ? 'win-' + S.seats.length : 'online', role === 'local' ? { so: 'Ku guuleystay ' + S.seats.length + ' ciyaaryahan', en: 'Won a ' + S.seats.length + '-player game' } : { so: 'Guul online', en: 'Won online' }); }
    else earn(10);
    if (net && role === 'host') net.send({ t: 'state', s: S });
    api.after(1600, function () { if (mine || (role === 'local' && w.kind === 'h')) api.win(api.score + 500, msg); else api.lose(api.score, msg); });
  }
  function localRoll() {
    if (!S || api.paused || S.over || S.rolled || busy()) return; var cs = curSeat(S); if (!isMine(cs)) return;
    if (role === 'guest') { net.send({ t: 'act', a: { roll: 1 } }); rollBtn.disabled = true; return; }
    act(function () { doRoll(S, api.rand(1, 6)); });
  }
  function localMove(i) {
    if (!S || api.paused || S.over || !S.rolled || busy()) return; var cs = curSeat(S); if (!isMine(cs) || movable(S, cs.c, S.die).indexOf(i) < 0) return;
    if (role === 'guest') { net.send({ t: 'act', a: { move: i } }); highlight = []; Object.keys(tokens).forEach(function (k) { tokens[k].g.userData.ring.visible = false; }); return; }
    if (timer) { timer.cancel(); timer = null; }
    act(function () { doMove(S, i); });
  }
  function remoteAct(from, a) {
    if (role !== 'host' || !S || S.over || busy()) return; var cs = curSeat(S); if (cs.kind !== 'o' || cs.pid !== from || !a) return;
    if (a.roll && !S.rolled) { if (timer) { timer.cancel(); timer = null; } act(function () { doRoll(S, api.rand(1, 6)); }); }
    else if (typeof a.move === 'number' && S.rolled && !S.pass) { if (timer) { timer.cancel(); timer = null; } act(function () { doMove(S, a.move | 0); }); }
  }
  function begin(seats) {
    finished = false; hops = []; DA = null; shown = {};
    S = newState(seats); buildTokens(S); Object.keys(tokens).forEach(function (k) { tokens[k].target = tokens[k].g.position.clone(); });
    orient(); layoutIdle(); setHighlight(); renderHud(); closeLobby();
    if (role === 'host' && net) { net.send({ t: 'start' }); net.send({ t: 'state', s: S }); }
    directorTick();
  }
  // the board turns so that your own home is at the bottom left
  var yaw = 0;
  function orient() {
    var me = S.seats.filter(function (s) { return isMine(s); })[0] || S.seats[0], best = 0;
    for (var k = 0; k < 4; k++) { var a = k * Math.PI / 2, y = YARD[me.c], px = y[1] + 3 - 7.5, pz = y[0] + 3 - 7.5, rx = px * Math.cos(a) + pz * Math.sin(a), rz = -px * Math.sin(a) + pz * Math.cos(a); if (rx < 0 && rz > 0) best = a; }
    yaw = best; world.rotation.y = yaw;
    if (logoYaw !== yaw) { logoYaw = yaw; setBoard(looks.board); }
  }

  // ------------------------------------------------------------------ input: tap the dice or a glowing token
  var ray = new T.Raycaster();
  X.cv.addEventListener('pointerdown', function (e) {
    if (!S || api.paused) return; ray.setFromCamera(X.ndc(e), cam);
    if (ray.intersectObject(dice, false).length) { localRoll(); return; }
    var objs = []; highlight.forEach(function (k) { objs.push(tokens[k].m); });
    var hit = ray.intersectObjects(objs, false)[0];
    if (hit) return localMove(hit.object.userData.i);
    // or the nearest glowing token to where the board was tapped
    var p = ray.intersectObject(boardTop, false)[0]; if (!p) return; var best = null, bd = 1.1;
    highlight.forEach(function (k) { var wp = new T.Vector3(); tokens[k].g.getWorldPosition(wp); var d = Math.hypot(wp.x - p.point.x, wp.z - p.point.z); if (d < bd) { bd = d; best = k; } });
    if (best) localMove(+best.split(':')[1]);
  });

  // ------------------------------------------------------------------ lobby: who plays
  var lobby = null;
  function closeLobby() { if (lobby) { lobby.remove(); lobby = null; } }
  function card(children) { closeLobby(); lobby = h('div', { class: 'l3-lobby' }, h('div', { class: 'l3-card' }, children)); root.append(lobby); return lobby; }
  var seatsCfg = api.load('seats', ['h', 'r', 'r', 'r']);
  var PRESETS = [['👤 + 🤖', ['h', 'off', 'r', 'off']], ['👤 + 🤖🤖🤖', ['h', 'r', 'r', 'r']], ['👤👤 + 🤖🤖', ['h', 'r', 'h', 'r']], ['👤👤👤 + 🤖', ['h', 'h', 'h', 'r']], ['👤👤👤👤', ['h', 'h', 'h', 'h']], ['👤👤', ['h', 'off', 'h', 'off']], ['👤👤👤', ['h', 'h', 'h', 'off']], ['👤 + 🤖🤖', ['h', 'r', 'r', 'off']]];
  function tabs(which) {
    return h('div', { class: 'l3-tabs' }, h('button', { type: 'button', 'aria-pressed': String(which === 'local'), text: '📱 ' + tx('local'), onclick: function () { localLobby(); } }), h('button', { type: 'button', 'aria-pressed': String(which === 'online'), text: '🌍 ' + tx('online'), onclick: function () { onlineLobby(); } }));
  }
  function coinRow() { return h('div', { class: 'l3-row', style: { justifyContent: 'space-between' } }, h('div', { style: { flex: '0 0 auto', fontWeight: 900, color: '#ffd166' }, text: '🪙 ' + coins() + ' ' + tx('coins') }), h('button', { type: 'button', class: 'l3-btn', style: { flex: '0 0 auto' }, text: tx('shop'), onclick: function () { shopPanel(); } })); }
  function localLobby() {
    role = 'local'; if (net) { net.close(); net = null; } emoBar.hidden = true;
    var seatEls = h('div', { class: 'l3-seats' });
    function drawSeats() {
      seatEls.innerHTML = '';
      seatsCfg.forEach(function (k, c) { seatEls.append(h('button', { type: 'button', class: 'l3-seat' + (k === 'off' ? ' off' : ''), onclick: function () { seatsCfg[c] = k === 'h' ? 'r' : k === 'r' ? 'off' : 'h'; drawSeats(); } }, h('i', { style: { background: CSS[c] } }), h('span', { text: (k === 'h' ? '👤 ' + tx('person') : k === 'r' ? '🤖 ' + tx('robot') : '✖ ' + tx('off')) + ' · ' + cname(c) }))); });
    }
    drawSeats();
    var pre = h('div', { class: 'l3-pre' }); PRESETS.forEach(function (p) { pre.append(h('button', { type: 'button', class: 'l3-btn', text: p[0], onclick: function () { seatsCfg = p[1].slice(); drawSeats(); } })); });
    var err = h('div', { class: 'l3-err' });
    card([h('h2', { text: '🎲 ' + (SO ? 'Afarta Guri 3D' : 'Four Homes 3D') }), coinRow(), tabs('local'), h('h3', { text: tx('presets') }), pre, h('h3', { text: '👤 / 🤖' }), seatEls, err,
      h('button', { type: 'button', class: 'l3-btn go', text: tx('start'), onclick: function () {
        var seats = []; seatsCfg.forEach(function (k, c) { if (k !== 'off') seats.push({ c: c, kind: k }); });
        if (seats.length < 2 || !seats.some(function (s) { return s.kind === 'h'; })) { err.textContent = tx('needTwo'); return; }
        api.save('seats', seatsCfg); begin(seats);
      } })]);
  }
  function shopPanel() {
    var box = h('div');
    function draw() {
      box.innerHTML = '';
      ['dice', 'tokens', 'board'].forEach(function (cat) {
        var g = h('div', { class: 'l3-shop' });
        SHOP[cat].forEach(function (it) {
          var have = owned.indexOf(it[0]) >= 0, inUse = looks[cat] === it[0];
          g.append(h('button', { type: 'button', class: 'l3-item' + (inUse ? ' use' : ''), onclick: function () {
            if (!have) { if (coins() < it[1]) { api.toast(tx('poor')); api.sfx('bad'); return; } WTG.addCoins(-it[1]); owned.push(it[0]); api.save('owned', owned); api.sfx('coin'); }
            looks[cat] = it[0]; api.save('looks', looks); applyLooks(); draw();
          } }, h('b', { style: { background: it[3] } }), h('div', { text: api.t(it[2]) }), h('small', { text: inUse ? tx('inUse') : have ? tx('use') : '🪙 ' + it[1] })));
        });
        box.append(h('h3', { text: tx(cat) }), g);
      });
    }
    draw();
    card([h('h2', { text: tx('shop') }), h('div', { style: { textAlign: 'center', fontWeight: 900, color: '#ffd166' }, text: '🪙 ' + coins() + ' ' + tx('coins') }), h('p', { class: 'l3-note', text: tx('coinsNote') }), box, h('button', { type: 'button', class: 'l3-btn go', text: tx('back'), onclick: function () { role === 'local' ? localLobby() : onlineLobby(); } })]);
  }
  function applyLooks() { setBoard(looks.board); setDice(looks.dice); if (S) Object.keys(tokens).forEach(function (k) { var c = +k.split(':')[0]; tokens[k].m.material.dispose(); tokens[k].m.material = tokenMat(c, looks.tokens); }); }

  // ------------------------------------------------------------------ online rooms
  var SERVER = null;
  function server() { return SERVER ? Promise.resolve(SERVER) : fetch('../data/games-online.json?v=' + Date.now(), { cache: 'no-store' }).then(function (r) { return r.json(); }).then(function (j) { if (!j || !(/^https:\/\//.test(j.url || '') || /^http:\/\/(localhost|127\.0\.0\.1)[:/]/.test(j.url || ''))) throw new Error('none'); SERVER = j.url.replace(/\/$/, ''); return SERVER; }); }
  function Net(code, host) {
    var self = this, ws = null, closed = false, tries = 0, ping = null;
    this.code = code; this.peers = []; this.started = false;
    function open() {
      var u = SERVER.replace(/^http/, 'ws') + '/room/' + code + '?g=ludo&pid=' + myPid + '&name=' + encodeURIComponent(myName || cname(0)) + (host ? '&host=1' : '');
      ws = new WebSocket(u);
      ws.onopen = function () { tries = 0; clearInterval(ping); ping = setInterval(function () { self.send({ t: 'ping' }); }, 25000); };
      ws.onmessage = function (e) { var m; try { m = JSON.parse(e.data); } catch (x) { return; } self.on(m); };
      ws.onclose = function () { clearInterval(ping); if (closed) return; if (self.fatal) return; if (tries++ < 8) { self.on({ t: 'down' }); setTimeout(open, Math.min(8000, 800 * tries)); } else self.on({ t: 'err', e: 'conn' }); };
    }
    this.send = function (o) { try { if (ws && ws.readyState === 1) ws.send(JSON.stringify(o)); } catch (e) {} };
    this.close = function () { closed = true; clearInterval(ping); try { ws.close(); } catch (e) {} };
    this.on = function () {};
    open();
  }
  function link(code) { return location.origin + location.pathname + '?room=' + code + '#play-' + api.game.id; }
  function onlineLobby(joinCode) {
    role = 'local'; if (net) { net.close(); net = null; }
    var nameIn = h('input', { class: 'l3-in', maxlength: '14', value: myName, placeholder: tx('name'), 'aria-label': tx('name'), autocomplete: 'off' });
    var codeIn = h('input', { class: 'l3-in', maxlength: '6', value: joinCode || '', placeholder: 'ABC123', 'aria-label': tx('code'), autocomplete: 'off', style: { textTransform: 'uppercase', letterSpacing: '.15em', textAlign: 'center' } });
    var err = h('div', { class: 'l3-err' });
    function nm() { myName = (nameIn.value || '').replace(/[^\p{L}\p{N} ]/gu, '').trim().slice(0, 14); api.save('name', myName); }
    card([h('h2', { text: '🌍 ' + tx('online') }), coinRow(), tabs('online'), h('h3', { text: tx('name') }), nameIn,
      h('button', { type: 'button', class: 'l3-btn go', text: tx('create'), onclick: function () { nm(); err.textContent = ''; server().then(function (u) { return fetch(u + '/new', { method: 'POST' }).then(function (r) { return r.json(); }); }).then(function (j) { if (!j.code) throw 0; connect(j.code, true); }).catch(function () { err.textContent = tx('noServer'); }); } }),
      h('h3', { text: tx('join') }), h('div', { class: 'l3-row' }, codeIn, h('button', { type: 'button', class: 'l3-btn pri', style: { flex: '0 0 auto' }, text: tx('join'), onclick: function () { nm(); var c = (codeIn.value || '').toUpperCase().replace(/[^A-Z0-9]/g, ''); if (c.length !== 6) { err.textContent = tx('err_noroom'); return; } server().then(function () { connect(c, false); }).catch(function () { err.textContent = tx('noServer'); }); } })),
      err, h('p', { class: 'l3-note', text: SO ? 'Ciyaaraha online waa saaxiibo kaliya: koodh gaar ah, sheeko (chat) ma jirto, dad aanad aqoon ma jiraan.' : 'Online play is for friends only: a private code, no chat and no strangers.' })]);
  }
  function connect(code, host) {
    if (net) net.close();
    role = host ? 'host' : 'guest'; net = new Net(code, host); emoBar.hidden = false;
    var openSeats = api.load('onlineSeats', ['o', 'o', 'o', 'o']);
    var list = h('div', { class: 'l3-seats' }), err = h('div', { class: 'l3-err' }), stBtn;
    function lobbyView() {
      var share = h('button', { type: 'button', class: 'l3-btn pri', text: tx('share'), onclick: function () {
        var u = link(code), t = (SO ? 'Kaalay aan ciyaarno Afarta Guri! Koodh: ' : 'Join my Four Homes game! Code: ') + code;
        if (navigator.share) navigator.share({ title: 'Four Homes', text: t, url: u }).catch(function () {}); else try { navigator.clipboard.writeText(t + ' ' + u); api.toast(tx('copied')); } catch (e) {}
      } });
      var kids = [h('h2', { text: '🌍 ' + tx('code') }), h('div', { class: 'l3-code', text: code }), share, h('h3', { text: tx('friends') }), list, err];
      if (host) kids.push(stBtn = h('button', { type: 'button', class: 'l3-btn go', text: tx('start'), onclick: function () { startOnline(); } })); else kids.push(h('p', { class: 'l3-note', style: { textAlign: 'center' }, text: tx('waitHost') }));
      kids.push(h('button', { type: 'button', class: 'l3-btn', style: { width: '100%', marginTop: '8px' }, text: tx('leave'), onclick: function () { onlineLobby(); } }));
      card(kids); drawList();
    }
    function seatPlan() {
      // the players in the room take the colours in order; the host may fill the rest with robots
      var people = (net.peers || []).filter(function (p) { return !p.away; }), seats = [], c = 0;
      people.slice(0, 4).forEach(function (p) { seats.push({ c: c, kind: 'o', pid: p.pid, name: p.name }); c++; });
      for (; c < 4; c++) if (openSeats[c] === 'r') seats.push({ c: c, kind: 'r' });
      if (seats.length === 2 && seats[1].c === 1) seats[1].c = 2;   // two players sit opposite each other
      return seats;
    }
    function drawList() {
      list.innerHTML = ''; var people = (net.peers || []).filter(function (p) { return !p.away; });
      for (var c = 0; c < 4; c++) (function (c) {
        var p = people[c];
        if (p) list.append(h('div', { class: 'l3-seat' }, h('i', { style: { background: CSS[c] } }), h('span', { text: '👤 ' + p.name + (p.host ? ' · ' + tx('host') : '') + (p.pid === myPid ? ' (' + tx('you') + ')' : '') })));
        else list.append(h('button', { type: 'button', class: 'l3-seat' + (openSeats[c] === 'r' ? '' : ' off'), disabled: !host, onclick: function () { openSeats[c] = openSeats[c] === 'r' ? 'o' : 'r'; api.save('onlineSeats', openSeats); drawList(); } }, h('i', { style: { background: CSS[c] } }), h('span', { text: openSeats[c] === 'r' ? '🤖 ' + tx('robot') : '⏳ …' })));
      })(c);
    }
    function startOnline() { var seats = seatPlan(); if (seats.length < 2) { err.textContent = tx('needTwo'); return; } begin(seats); }
    net.on = function (m) {
      if (m.t === 'peers') { net.peers = m.peers; if (lobby) drawList(); if (S && role === 'host') renderHud(); }
      else if (m.t === 'state' && role === 'guest') {
        var prev = S, s = m.s; if (!s || !s.seats) return;
        if (!prev || prev.seats.length !== s.seats.length || (prev.over && !s.over) || s.seq < prev.seq) { S = s; finished = false; shown = {}; buildTokens(S); Object.keys(tokens).forEach(function (k) { var c = +k.split(':')[0], i = +k.split(':')[1]; tokens[k].pr = S.tok[c][i]; }); orient(); layoutIdle(); Object.keys(tokens).forEach(function (k) { tokens[k].g.position.copy(tokens[k].target); }); closeLobby(); setHighlight(); renderHud(); if (S.over) finish(); return; }
        S = s; changed(prev); if (!busy()) after();
      }
      else if (m.t === 'act') remoteAct(m.from, m.a);
      else if (m.t === 'emote') popEmote(m.e);
      else if (m.t === 'joined' && S && role === 'host') net.send({ t: 'state', s: S });
      else if (m.t === 'err') { net.fatal = /noroom|full|started|kicked|replaced/.test(m.e); if (m.e === 'replaced') return; var t = tx('err_' + m.e); if (lobby || !S) { onlineLobby(code); var e2 = lobby && lobby.querySelector('.l3-err'); if (e2) e2.textContent = t; } else api.toast(t, 3000); }
      else if (m.t === 'down') { if (S) api.toast(tx('err_conn'), 2000); }
    };
    lobbyView();
  }

  // ------------------------------------------------------------------ camera and frame loop
  function placeCam() {
    var portrait = X.H > X.W * 1.05, top = api.cfg('cam', 'tilt') === 'top';
    if (top) { cam.position.set(0, portrait ? 34 : 25, portrait ? 3 : 2.2); cam.lookAt(0, 0, portrait ? 0.6 : 0.3); return; }
    // fit the whole board (with its frame) in the view, whatever the screen shape
    var a = X.W / Math.max(1, X.H), vf = cam.fov * Math.PI / 360, hf = Math.atan(Math.tan(vf) * a);
    var dist = Math.max(9.4 / Math.tan(hf), 10.2 / Math.tan(vf)) * 1.02, dir = new T.Vector3(0, 0.79, 0.61).normalize();
    cam.position.copy(dir.multiplyScalar(dist)); cam.lookAt(0, -0.4, portrait ? 0.9 : 0.6);
  }
  X.onResize = placeCam; placeCam();
  X.cv.wtgState = function () { return { S: S, busy: busy(), dice: !!DA, hops: hops.length, timer: !!timer, role: role }; };   // for tests
  applyLooks();
  var dimTokens = function () {};
  return {
    start: function () {
      var q = new URLSearchParams(location.search).get('room');
      if (q && api.first) onlineLobby(q.toUpperCase()); else localLobby();
      api.loop(function (dt) {
        tt += dt; stepDice(dt); stepTokens(dt);
        // glowing rings pulse
        highlight.forEach(function (k) { var r = tokens[k].g.userData.ring; r.scale.setScalar(1 + Math.sin(tt * 6) * 0.12); r.material.opacity = 0.6 + Math.sin(tt * 6) * 0.3; tokens[k].g.position.y = TOP + Math.abs(Math.sin(tt * 4)) * 0.12; });
        fxs = fxs.filter(function (f) { return f(dt); });
        world.rotation.y += (yaw - world.rotation.y) * Math.min(1, dt * 4);
        X.render();
      });
    },
    key: function (e, down) {
      if (!down) return;
      if (e.key === ' ' || e.key === 'Enter') { if (!lobby) { e.preventDefault(); localRoll(); } return; }
      var n = parseInt(e.key, 10); if (n >= 1 && n <= 4 && !lobby) localMove(n - 1);
    },
    destroy: function () { if (net) net.close(); X.dispose(); }
  };
});
