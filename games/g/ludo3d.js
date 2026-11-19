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
  function canLeave(S, d) { return d === 6 || (S.mode === 'quick' && d === 1); }
  function movable(S, c, d) { var t = S.tok[c]; var r = []; for (var i = 0; i < 4; i++) { var pr = t[i]; if (pr < 0 ? canLeave(S, d) : pr + d <= 56) r.push(i); } return r; }
  function mates(S, a, b) { return !!S.team && a % 2 === b % 2; }
  function allHome(S, c) { return !!S.tok[c] && S.tok[c].every(function (v) { return v === 56; }); }
  // modes: classic, or quick (a 1 also brings a token out, and every player starts with one token on the board).
  // team: four players, the opposite colours play together, partners never capture each other and win together.
  function newState(seats, opt) {
    opt = opt || {};
    seats = seats.slice().sort(function (a, b) { return a.c - b.c; });
    var S = { v: 2, seats: seats, tok: {}, cur: 0, die: 0, rid: 0, rolled: false, sixes: 0, over: false, win: -1, seq: 0, msg: '', last: null, done: [], mode: opt.mode === 'quick' ? 'quick' : 'classic', team: !!opt.team && seats.length === 4 };
    seats.forEach(function (s) { S.tok[s.c] = S.mode === 'quick' ? [0, -1, -1, -1] : [-1, -1, -1, -1]; });
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
    if (a >= 0 && SAFE.indexOf(a) < 0) S.seats.forEach(function (s) { if (s.c === c || mates(S, s.c, c)) return; S.tok[s.c].forEach(function (qp, j) { if (absOf(s.c, qp) === a) { cap.push([s.c, j, qp]); S.tok[s.c][j] = -1; extra = true; } }); });
    if (to === 56) extra = true;
    S.last = { c: c, i: i, from: from, to: to, cap: cap, home: to === 56 }; S.seq++; S.rolled = false; S.pass = false;
    if (allHome(S, c)) {
      if (!S.team || allHome(S, (c + 2) % 4)) { S.over = true; S.win = c; S.msg = 'win'; return S.last; }
      nextTurn(S, true); return S.last;
    }
    if (extra) { S.msg = d === 6 ? 'six' : ''; } else nextTurn(S, true);
    return S.last;
  }
  function nextTurn(S, keepLast) { for (var n = 0; n < 4; n++) { S.cur = (S.cur + 1) % S.seats.length; if (!S.team || !allHome(S, S.seats[S.cur].c)) break; } S.rolled = false; S.sixes = 0; S.pass = false; S.msg = ''; S.seq++; if (!keepLast) S.last = null; }
  function robotPick(S, mv) {
    var c = curSeat(S).c, d = S.die, best = mv[0], bv = -1e9, lv = api.level;
    mv.forEach(function (i) {
      var pr = S.tok[c][i], np = pr < 0 ? 0 : pr + d, a = absOf(c, np), v = 0;
      if (np === 56) v += 100; if (pr < 0) v += 60;
      if (a >= 0 && SAFE.indexOf(a) < 0) S.seats.forEach(function (s) { if (s.c !== c && !mates(S, s.c, c)) S.tok[s.c].forEach(function (qp) { if (absOf(s.c, qp) === a) v += 120; }); });
      // danger: an opponent 1–6 squares behind
      if (lv !== 'easy' && a >= 0 && SAFE.indexOf(a) < 0) S.seats.forEach(function (s) { if (s.c !== c && !mates(S, s.c, c)) S.tok[s.c].forEach(function (qp) { var qa = absOf(s.c, qp); if (qa >= 0) { var dist = (a - qa + 52) % 52; if (dist >= 1 && dist <= 6) v -= lv === 'hard' ? 45 : 20; } }); });
      if (a >= 0 && SAFE.indexOf(a) >= 0) v += 15; if (np > 50) v += 25;
      v += np * (lv === 'easy' ? 0 : 1) + Math.random() * (lv === 'easy' ? 80 : 6);
      if (v > bv) { bv = v; best = i; }
    });
    return best;
  }

  // ------------------------------------------------------------------ coins and looks (shop)
  var SHOP = {
    dice: [['ivory', 0, { so: 'Lafo cad', en: 'Ivory' }, '#f8fafc'], ['ruby', 100, { so: 'Yaaquud', en: 'Ruby' }, '#dc2626'], ['gold', 150, { so: 'Dahab', en: 'Gold' }, '#f5b301'], ['onyx', 120, { so: 'Madow dhalaalaya', en: 'Onyx' }, '#111827']],
    tokens: [['gloss', 0, { so: 'Dhalaal', en: 'Gloss' }, '#3b82f6'], ['metal', 120, { so: 'Bir', en: 'Metal' }, '#94a3b8'], ['gem', 30, { so: 'Jawharad', en: 'Gem' }, '#a855f7', 'g']],
    board: [['classic', 0, { so: 'Caadi', en: 'Classic' }, '#ffffff'], ['royal', 200, { so: 'Boqortooyo', en: 'Royal' }, '#d4a017'], ['night', 40, { so: 'Habeen nal leh', en: 'Neon night' }, '#0f172a', 'g']]
  };
  var looks = api.load('looks', { dice: 'ivory', tokens: 'gloss', board: 'classic' }), owned = api.load('owned', ['ivory', 'gloss', 'classic']);
  function coins() { return WTG.coins ? WTG.coins() : 0; }
  // gems are a second play-currency: only the daily rewards and achievements give them, nothing sells them
  function gems() { return api.load('gems', 0) | 0; }
  function addGems(n) { api.save('gems', Math.max(0, gems() + n)); }
  function earn(n, why) { if (!n || !WTG.addCoins) return; WTG.addCoins(n); coinEl.textContent = '🪙 ' + coins(); flashCoin('+' + n + ' 🪙' + (why ? ' ' + why : '')); }

  // ------------------------------------------------------------------ the 3D scene
  var X = M.setup(api, { fov: 42, far: 200, bg: ['#0b1220', '#13233d', '#1e3557'], label: 'Four Homes 3D', exposure: 0.95, envIntensity: 0.6 });
  var scene = X.scene, cam = X.camera;
  var S0 = M.sun(scene, { color: 0xfff4e0, intensity: 2.6, hemi: 0.55, sky: 0xdbeafe, ground: 0x3b2a1a, offset: new T.Vector3(-6, 18, 9), size: 12 });
  
  // table
  var tableTex = M.canvasTex(512, 512, function (x, w, hh) { var g = x.createRadialGradient(w / 2, hh / 2, 20, w / 2, hh / 2, w * 0.7); g.addColorStop(0, '#5b3a22'); g.addColorStop(1, '#24140a'); x.fillStyle = g; x.fillRect(0, 0, w, hh); for (var i = 0; i < 120; i++) { x.strokeStyle = 'rgba(0,0,0,' + (0.05 + Math.random() * 0.08) + ')'; x.lineWidth = 1 + Math.random() * 2; x.beginPath(); var y = Math.random() * hh; x.moveTo(0, y); x.bezierCurveTo(w * 0.3, y + 8, w * 0.7, y - 8, w, y + Math.random() * 6); x.stroke(); } }, [3, 3]);
  var table = new T.Mesh(new T.PlaneGeometry(80, 80), new T.MeshStandardMaterial({ map: tableTex, roughness: 0.55, metalness: 0.05 })); table.rotation.x = -Math.PI / 2; table.position.y = -0.62; table.receiveShadow = true; scene.add(table);

  function flat() { return api.cfg('cam', 'top') === 'top'; }   // the straight-down, flat board style (default)
  var world = new T.Group(); scene.add(world);
  var TOP = 0.02;
  function wpos(r, c, y) { return new T.Vector3(c - 7, y == null ? TOP : y, r - 7); }
  var boardTop, frame;
  var logoYaw = 0; // the centre logo is drawn turned so it reads upright from every seat
  function flatTexture() {
    // a clean, flat board seen from above: solid homes, white squares with grid lines, star and globe squares
    var N = 15, R = M.mobile ? 1536 : 2048, s = R / N;
    return M.canvasTex(R, R, function (x) {
      function shade(c, k) { var n = parseInt(CSS[c].slice(1), 16), f = function (v) { return Math.round(k < 0 ? v * (1 + k) : v + (255 - v) * k); }; return 'rgb(' + f(n >> 16) + ',' + f((n >> 8) & 255) + ',' + f(n & 255) + ')'; }
      function rr(x0, y0, w, hh, r) { x.beginPath(); x.moveTo(x0 + r, y0); x.arcTo(x0 + w, y0, x0 + w, y0 + hh, r); x.arcTo(x0 + w, y0 + hh, x0, y0 + hh, r); x.arcTo(x0, y0 + hh, x0, y0, r); x.arcTo(x0, y0, x0 + w, y0, r); x.closePath(); }
      function star(cx, cy, r, fill) { x.beginPath(); for (var i = 0; i < 10; i++) { var a = -Math.PI / 2 + i * Math.PI / 5, q = i % 2 ? r * 0.45 : r; x.lineTo(cx + Math.cos(a) * q, cy + Math.sin(a) * q); } x.closePath(); x.fillStyle = fill; x.fill(); }
      function globe(cx, cy, r) {
        x.save(); x.lineWidth = s * 0.055; x.strokeStyle = '#ffffff'; x.fillStyle = 'rgba(255,255,255,.18)';
        x.beginPath(); x.arc(cx, cy, r, 0, 7); x.fill(); x.stroke();
        x.beginPath(); x.ellipse(cx, cy, r * 0.45, r, 0, 0, 7); x.stroke();
        x.beginPath(); x.moveTo(cx - r, cy); x.lineTo(cx + r, cy); x.stroke();
        x.beginPath(); x.moveTo(cx - r * 0.86, cy - r * 0.5); x.lineTo(cx + r * 0.86, cy - r * 0.5); x.moveTo(cx - r * 0.86, cy + r * 0.5); x.lineTo(cx + r * 0.86, cy + r * 0.5); x.stroke();
        x.restore();
      }
      var line = '#1f2937', lw = Math.max(2, s * 0.03);
      x.fillStyle = '#ffffff'; x.fillRect(0, 0, R, R);
      // the four homes: solid colour, a darker square inside, four round spots
      YARD.forEach(function (y, c) {
        var x0 = y[1] * s, y0 = y[0] * s;
        x.fillStyle = CSS[c]; x.fillRect(x0, y0, 6 * s, 6 * s);
        x.fillStyle = 'rgba(255,255,255,.14)'; x.fillRect(x0, y0, 6 * s, s * 0.5);
        x.fillStyle = shade(c, -0.32); rr(x0 + s * 0.8, y0 + s * 0.8, s * 4.4, s * 4.4, s * 0.45); x.fill();
        x.strokeStyle = 'rgba(255,255,255,.55)'; x.lineWidth = s * 0.06; x.stroke();
        [[1.5, 1.5], [1.5, 3.5], [3.5, 1.5], [3.5, 3.5]].forEach(function (p) {
          var cx = x0 + (p[1] + 0.5) * s, cy = y0 + (p[0] + 0.5) * s;
          x.fillStyle = shade(c, -0.5); x.beginPath(); x.arc(cx, cy + s * 0.05, s * 0.6, 0, 7); x.fill();
          x.fillStyle = shade(c, 0.25); x.beginPath(); x.arc(cx, cy, s * 0.58, 0, 7); x.fill();
          x.strokeStyle = '#ffffff'; x.lineWidth = s * 0.07; x.stroke();
        });
        x.strokeStyle = line; x.lineWidth = lw; x.strokeRect(x0, y0, 6 * s, 6 * s);
      });
      // the track: white squares, the start square in colour with a globe, grey star squares
      PATH.forEach(function (p, i) {
        var cc = OFF.indexOf(i), X0 = p[1] * s, Y0 = p[0] * s;
        x.fillStyle = cc >= 0 ? CSS[cc] : SAFE.indexOf(i) >= 0 ? '#d1d5db' : '#ffffff'; x.fillRect(X0, Y0, s, s);
        if (cc >= 0) globe(X0 + s / 2, Y0 + s / 2, s * 0.32);
        else if (SAFE.indexOf(i) >= 0) star(X0 + s / 2, Y0 + s / 2, s * 0.36, '#475569');
        x.strokeStyle = line; x.lineWidth = lw; x.strokeRect(X0, Y0, s, s);
      });
      // the home columns in each colour, with an arrow into them
      HOME.forEach(function (hc, c) { hc.forEach(function (p, k) { if (k > 4) return; x.fillStyle = CSS[c]; x.fillRect(p[1] * s, p[0] * s, s, s); x.strokeStyle = line; x.lineWidth = lw; x.strokeRect(p[1] * s, p[0] * s, s, s); }); });
      // centre: four solid triangles and the logo
      var m = 7.5 * s;
      [[0, [6, 6], [9, 6]], [1, [6, 6], [6, 9]], [2, [6, 9], [9, 9]], [3, [9, 6], [9, 9]]].forEach(function (t) {
        x.fillStyle = CSS[t[0]]; x.beginPath(); x.moveTo(m, m); x.lineTo(t[1][1] * s, t[1][0] * s); x.lineTo(t[2][1] * s, t[2][0] * s); x.closePath(); x.fill();
        x.strokeStyle = line; x.lineWidth = lw; x.stroke();
      });
      x.fillStyle = '#ffffff'; x.beginPath(); x.arc(m, m, s * 0.8, 0, 7); x.fill(); x.strokeStyle = '#04213f'; x.lineWidth = s * 0.08; x.stroke();
      x.fillStyle = '#04213f'; x.font = '900 ' + (s * 0.44) + 'px Archivo,sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.save(); x.translate(m, m + 2); x.rotate(logoYaw); x.fillText('WTV', 0, 0); x.restore();
      x.strokeStyle = line; x.lineWidth = lw * 2; x.strokeRect(lw, lw, R - 2 * lw, R - 2 * lw);
    });
  }
  function boardTexture(theme) {
    if (theme === 'classic' && flat()) return flatTexture();
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
    var F = flat();
    // flat style: the board shows its own true colours (no tone mapping wash), with a little light for the token shadows
    var FC = F && theme === 'classic';
    boardMat.toneMapped = !FC; boardMat.color.setHex(FC ? 0x3a3a3a : 0xffffff);
    if (FC) { boardMat.emissiveMap = boardMat.map; boardMat.emissive = new T.Color(0xffffff); boardMat.emissiveIntensity = 0.8; }
    boardMat.clearcoat = F ? 0.35 : 1; boardMat.roughness = F ? 0.55 : 0.32; table.visible = !F;
    if (F && theme === 'classic') { frameMat.color.setHex(0x04213f); frameMat.metalness = 0.2; }
    scene.background = M.gradientTex(F ? ['#04213f', '#0a3a6b', '#04213f'] : theme === 'night' ? ['#020617', '#0b1220', '#1e1b4b'] : theme === 'royal' ? ['#1c1208', '#3b2a12', '#5b3a22'] : ['#0b1220', '#13233d', '#1e3557']);
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
  // flat style: a round glossy disc with a gold rim and an emblem on top
  var discGeo = new T.CylinderGeometry(0.4, 0.43, 0.22, 44), rimGeo = new T.TorusGeometry(0.375, 0.045, 10, 44), capGeo = new T.CircleGeometry(0.335, 44);
  var rimMat = new T.MeshPhysicalMaterial({ color: 0xffd166, metalness: 0.6, roughness: 0.25, clearcoat: 1, emissive: new T.Color(0x6b4a00), emissiveIntensity: 0.35 }), capMats = {};
  function capMat(c) {
    if (capMats[c]) return capMats[c];
    var tex = M.canvasTex(256, 256, function (x, w) {
      var g = x.createRadialGradient(w * 0.5, w * 0.5, w * 0.2, w / 2, w / 2, w * 0.5); g.addColorStop(0, CSS[c]); g.addColorStop(1, 'rgba(0,0,0,.35)');
      x.fillStyle = CSS[c]; x.fillRect(0, 0, w, w); x.fillStyle = g; x.beginPath(); x.arc(w / 2, w / 2, w / 2, 0, 7); x.fill();
      var hl = x.createLinearGradient(0, 0, 0, w * 0.55); hl.addColorStop(0, 'rgba(255,255,255,.75)'); hl.addColorStop(1, 'rgba(255,255,255,0)');
      x.fillStyle = hl; x.beginPath(); x.ellipse(w / 2, w * 0.3, w * 0.36, w * 0.22, 0, 0, 7); x.fill();
      x.beginPath(); for (var i = 0; i < 10; i++) { var a = -Math.PI / 2 + i * Math.PI / 5, q = i % 2 ? w * 0.15 : w * 0.34; x.lineTo(w / 2 + Math.cos(a) * q, w / 2 + Math.sin(a) * q); } x.closePath();
      x.fillStyle = '#ffffff'; x.shadowColor = 'rgba(0,0,0,.5)'; x.shadowBlur = 12; x.fill(); x.shadowBlur = 0; x.strokeStyle = 'rgba(0,0,0,.35)'; x.lineWidth = 5; x.stroke();
    });
    return (capMats[c] = new T.MeshBasicMaterial({ map: tex, toneMapped: false }));
  }
  var tokens = {}, ringGeo = new T.TorusGeometry(0.42, 0.05, 10, 40), ringGeoF = new T.TorusGeometry(0.5, 0.06, 10, 44), ringMat = new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9 });
  function buildTokens(S) {
    Object.keys(tokens).forEach(function (k) { world.remove(tokens[k].g); }); tokens = {};
    S.seats.forEach(function (s) { for (var i = 0; i < 4; i++) {
      var g = new T.Group(), m;
      if (flat()) {
        m = new T.Mesh(discGeo, tokenMat(s.c, looks.tokens)); m.position.y = 0.11; m.castShadow = true; g.add(m);
        var rim = new T.Mesh(rimGeo, rimMat); rim.rotation.x = Math.PI / 2; rim.position.y = 0.22; g.add(rim);
        var cap = new T.Mesh(capGeo, capMat(s.c)); cap.rotation.x = -Math.PI / 2; cap.position.y = 0.225; g.add(cap);
      } else { m = new T.Mesh(pawnGeo, tokenMat(s.c, looks.tokens)); m.castShadow = true; g.add(m); }
      var ring = new T.Mesh(flat() ? ringGeoF : ringGeo, ringMat.clone()); ring.rotation.x = Math.PI / 2; ring.position.y = 0.03; ring.visible = false; g.add(ring);
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
    DA.n = n; dice.visible = !flat(); api.sfx('tick');
    if (flat()) { DA.dur = 0.8; DA.ft = 0; dieEl.classList.add('roll'); dieEl.classList.remove('go'); }
  }
  function stepDice(dt) {
    if (!DA) { dice.position.y = 0.45 + Math.sin(tt * 2) * 0.03; return; }
    DA.t += dt; var k = Math.min(1, DA.t / DA.dur), e = 1 - Math.pow(1 - k, 2.2);
    if (flat()) {
      DA.ft += dt; if (DA.ft > 0.07) { DA.ft = 0; var r; do { r = 1 + (Math.random() * 6 | 0); } while (r === dieFace); setDieFace(r); }
      if (k >= 1) { setDieFace(DA.n); dieEl.classList.remove('roll'); DA = null; api.sfx('tap'); onDiceLanded(); }
      return;
    }
    dice.position.lerpVectors(DA.from, DA.to, e);
    var bounce = Math.abs(Math.sin(k * Math.PI * 3)) * (1 - k) * 1.4; dice.position.y = 0.45 + bounce;
    if (k < 0.62) { dice.quaternion.copy(DA.q0); dice.rotateOnWorldAxis(DA.axis, DA.spin * DA.t * (1 - k)); }
    else { var q = dice.quaternion.clone(); q.slerp(DA.q1, Math.min(1, (k - 0.62) / 0.3)); dice.quaternion.copy(q); }
    if (k >= 1) { dice.quaternion.copy(DA.q1); dice.position.copy(DA.to); diceRest.copy(DA.to); DA = null; api.sfx('tap'); onDiceLanded(); }
  }

  // ------------------------------------------------------------------ more words for the app screens
  var TX2 = {
    so: { p2: '2 Ciyaaryahan', p4: '4 Ciyaaryahan', privateT: 'Miis gaar ah', onlineT: 'Saaxiibo online', teamT: 'Koox', offline: 'Ciyaar offline', classic: 'Caadi', quick: 'Degdeg', teamMode: 'Koox ahaan u ciyaar', go: 'BILOW', daily: 'Abaalmarinta maalinlaha', today: 'Maanta', tomorrow: 'Berri', day: 'Maalin {c}', collect: 'Qaado', congrats: 'Hambalyo!', gotIt: 'Waa hagaag', nHome: 'Guriga', nLooks: 'Muuqaal', nFriends: 'Saaxiibo', nRewards: 'Hadiyad', nProfile: 'Aniga', level: 'Heer', games: 'Ciyaarood', wins: 'Guul', caps: 'Cunis', homeN: 'Guri gaaray', ach: 'Guulaha', invite: 'Saaxiibadaa la ciyaar', inviteBtn: '🔗 Samee qol oo la wadaag', joinCode: 'Ku gal koodh', recent: 'Saaxiibadii', teamWin: 'Kooxda {c} ayaa guuleystay!', playerN: 'Ciyaaryahan {c}', save: 'Kaydi', settings: 'Habaynta' },
    en: { p2: '2 Players', p4: '4 Players', privateT: 'Private Table', onlineT: 'Friends Online', teamT: 'Team Up', offline: 'Play offline', classic: 'Classic', quick: 'Quick', teamMode: 'Play as teams', go: 'START', daily: 'Daily Rewards', today: 'Today', tomorrow: 'Tomorrow', day: 'Day {c}', collect: 'Collect', congrats: 'Congratulations!', gotIt: 'Got it!', nHome: 'Home', nLooks: 'Looks', nFriends: 'Friends', nRewards: 'Rewards', nProfile: 'Profile', level: 'Level', games: 'Games', wins: 'Wins', caps: 'Captures', homeN: 'Tokens home', ach: 'Achievements', invite: 'Play with your friends', inviteBtn: '🔗 Create a room and share', joinCode: 'Join with code', recent: 'Friends', teamWin: 'Team {c} wins!', playerN: 'Player {c}', save: 'Save', settings: 'Settings' }
  };
  Object.keys(TX2).forEach(function (l) { Object.keys(TX2[l]).forEach(function (k) { TX[l][k] = TX2[l][k]; }); });
  var AV = (WTG.AVATARS || ['🦁', '🐯', '🐼', '🦊']), SEATAV = ['🦊', '🐼', '🐯', '🐨'];
  var me0 = (WTG.me && WTG.me()) || {};
  var myAv = api.load('av', me0.avatar || '🦁');

  // ------------------------------------------------------------------ HUD (DOM over the 3D view), Wartabiye colours
  var hud = X.hud; hud.style.pointerEvents = 'none';
  var css = h('style', { text: [
    '.l3 *{box-sizing:border-box}.l3{font-family:Archivo,system-ui,sans-serif;color:#fff}',
    '.l3-bot{position:absolute;left:0;right:0;bottom:10px;display:flex;flex-direction:column;align-items:center;gap:8px;pointer-events:none}',
    '.l3-msg{background:rgba(2,6,23,.7);padding:6px 14px;border-radius:999px;font-weight:900;font-size:15px;text-shadow:0 2px 4px rgba(0,0,0,.5);backdrop-filter:blur(6px);max-width:calc(100% - 220px);text-align:center}',
    '.l3-roll{pointer-events:auto;border:0;border-radius:999px;padding:12px 26px;font:900 18px Archivo,sans-serif;color:#fff;background:linear-gradient(180deg,#ff5a5f,#c1121f);box-shadow:0 6px 0 #7f0d16,0 12px 22px rgba(0,0,0,.45);cursor:pointer}',
    '.l3-roll[disabled]{opacity:.45;filter:grayscale(.6)}',
    '.l3-coin{position:absolute;left:50%;transform:translateX(-50%);top:10px;background:rgba(2,6,23,.62);border-radius:999px;padding:4px 12px;font-weight:900;font-size:13px;white-space:nowrap}',
    '.l3-fly{position:absolute;left:50%;top:40px;font-weight:900;color:#ffd166;text-shadow:0 2px 6px rgba(0,0,0,.6);transition:transform 1.2s,opacity 1.2s;white-space:nowrap}',
    '.l3-emo{display:flex;gap:4px;pointer-events:auto}.l3-emo button{border:0;background:rgba(2,6,23,.55);border-radius:12px;font-size:18px;padding:4px 7px;cursor:pointer}',
    '.l3-pop{position:absolute;font-size:34px;transition:transform 1.4s ease-out,opacity 1.4s;pointer-events:none}',
    // players around the board
    '.l3-pl{position:absolute;display:flex;flex-direction:column;align-items:center;gap:4px;width:96px;transition:transform .25s,filter .25s,opacity .25s;pointer-events:none;--c:#fff}',
    '.l3-pl .a{width:54px;height:54px;border-radius:50%;display:grid;place-items:center;font-size:31px;background:radial-gradient(circle at 35% 30%,#fff,#cfe0f5);box-shadow:0 0 0 4px var(--c),0 6px 14px rgba(0,0,0,.5);position:relative}',
    '.l3-pl .a b{position:absolute;right:-8px;bottom:-5px;background:var(--c);color:#fff;font:900 11px Archivo;border-radius:999px;padding:1px 6px;box-shadow:0 0 0 2px #fff;text-shadow:0 1px 1px rgba(0,0,0,.4)}',
    '.l3-pl .a u{position:absolute;left:-8px;top:-6px;text-decoration:none;font-size:15px}',
    '.l3-pl span{max-width:96px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font:800 12px Archivo;background:rgba(2,6,23,.65);padding:2px 9px;border-radius:999px}',
    '.l3-pl.on{transform:scale(1.14)}.l3-pl.on .a{box-shadow:0 0 0 4px var(--c),0 0 0 8px rgba(255,255,255,.9),0 0 28px var(--c);animation:l3glow 1s infinite alternate}.l3-pl.done{filter:grayscale(.6);opacity:.7}',
    '@keyframes l3glow{to{box-shadow:0 0 0 4px var(--c),0 0 0 10px rgba(255,255,255,.5),0 0 40px var(--c)}}',
    // app screens
    '.l3-app{position:absolute;inset:0;pointer-events:auto;display:flex;flex-direction:column;background:radial-gradient(130% 90% at 50% 0%,#1478d4 0%,#074a8f 40%,#04213f 100%);overflow:hidden}',
    '.l3-rays{position:absolute;left:-50%;top:-60%;width:200%;height:200%;background:repeating-conic-gradient(rgba(255,255,255,.055) 0 8deg,transparent 8deg 16deg);animation:l3spin 60s linear infinite;pointer-events:none}',
    '@keyframes l3spin{to{transform:rotate(360deg)}}',
    '.l3-top,.l3-head,.l3-main,.l3-nav{position:relative;z-index:1}',
    '.l3-top{display:flex;align-items:center;gap:8px;padding:10px 12px 6px}.l3-top .sp{flex:1}',
    '.l3-av{width:48px;height:48px;flex:none;border-radius:50%;background:radial-gradient(circle at 35% 30%,#fff,#cfe0f5);display:grid;place-items:center;font-size:28px;box-shadow:0 0 0 3px #ffd166,0 5px 12px rgba(0,0,0,.45);position:relative;cursor:pointer;border:0;padding:0}',
    '.l3-lv{position:absolute;bottom:-7px;left:50%;transform:translateX(-50%);background:#e11d2e;font:900 10px Archivo;padding:1px 7px;border-radius:999px;color:#fff;white-space:nowrap;box-shadow:0 0 0 2px #fff}',
    '.l3-pill{display:flex;align-items:center;gap:6px;background:rgba(0,0,0,.38);border-radius:999px;padding:3px 12px 3px 4px;font:900 14px Archivo;box-shadow:inset 0 0 0 2px rgba(255,255,255,.12);white-space:nowrap}',
    '.l3-pill i{font-style:normal;font-size:19px;filter:drop-shadow(0 2px 2px rgba(0,0,0,.4))}',
    '.l3-main{flex:1;overflow:auto;padding:8px 14px 16px;-webkit-overflow-scrolling:touch}',
    '.l3-wrap{max-width:520px;margin:0 auto}',
    '.l3-big{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:8px}',
    '.l3-tile{position:relative;border:0;border-radius:24px;color:#fff;cursor:pointer;padding:0;overflow:hidden;font:900 16px Archivo;box-shadow:0 7px 0 rgba(0,0,0,.28),0 14px 28px rgba(0,0,0,.35),inset 0 2px 0 rgba(255,255,255,.4);transition:transform .12s}',
    '.l3-tile:active{transform:translateY(4px) scale(.98)}.l3-tile::after{content:"";position:absolute;left:-30%;top:-60%;width:60%;height:220%;background:linear-gradient(90deg,transparent,rgba(255,255,255,.25),transparent);transform:rotate(25deg);animation:l3shine 4s infinite}',
    '@keyframes l3shine{0%,70%{left:-60%}100%{left:130%}}',
    '.l3-tile.big{aspect-ratio:1/1.08;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;padding-bottom:12px}',
    '.l3-tile .num{position:absolute;top:6%;left:50%;transform:translateX(-50%) rotate(-7deg);font:900 min(104px,25vw)/1 Archivo;color:#fff;-webkit-text-stroke:4px rgba(0,0,0,.18);filter:drop-shadow(0 6px 0 rgba(0,0,0,.25)) drop-shadow(0 0 18px rgba(255,255,255,.35))}',
    '.l3-tile .art{position:absolute;bottom:38px;font-size:min(34px,6.5vw);display:flex;gap:2px;filter:drop-shadow(0 5px 4px rgba(0,0,0,.35))}',
    '.l3-tile .lab{position:relative;background:rgba(0,0,0,.3);padding:5px 14px;border-radius:999px;white-space:nowrap}',
    '.t-red{background:linear-gradient(160deg,#ff6b6b,#c1121f 70%)}.t-blue{background:linear-gradient(160deg,#4fb0ff,#0353a4 70%)}.t-gold{background:linear-gradient(160deg,#ffe08a,#e09f00 75%);color:#3b2600}.t-green{background:linear-gradient(160deg,#4ade80,#047857 75%)}.t-navy{background:linear-gradient(160deg,#4a77b8,#0b2a52 75%)}',
    '.l3-small{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:16px}',
    '.l3-tile.sm{aspect-ratio:1/1.02;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;font-size:12.5px;padding:6px}',
    '.l3-tile.sm .ic{font-size:38px;filter:drop-shadow(0 4px 4px rgba(0,0,0,.3))}',
    '.l3-wide{margin-top:14px;width:100%;display:flex;align-items:center;gap:12px;padding:12px 16px;font-size:16px}.l3-wide .ic{font-size:30px}',
    '.l3-nav{display:grid;grid-template-columns:repeat(5,1fr);gap:2px;background:linear-gradient(#0b2a52,#04213f);border-top:2px solid rgba(255,255,255,.12);padding:6px 4px calc(6px + env(safe-area-inset-bottom))}',
    '.l3-nav button{border:0;background:none;color:#a9c7ea;font:800 10.5px Archivo;display:flex;flex-direction:column;align-items:center;gap:2px;cursor:pointer;padding:5px 0;border-radius:14px;position:relative;transition:transform .15s}',
    '.l3-nav button i{font-style:normal;font-size:22px}.l3-nav button.on{background:linear-gradient(#4fb0ff,#0353a4);color:#fff;transform:translateY(-8px);box-shadow:0 6px 14px rgba(0,0,0,.45),inset 0 2px 0 rgba(255,255,255,.35)}',
    '.l3-dot{position:absolute;top:2px;right:24%;width:11px;height:11px;border-radius:50%;background:#e11d2e;box-shadow:0 0 0 2px #04213f}',
    '.l3-head{display:flex;align-items:center;gap:8px;padding:10px 12px}.l3-head h2{flex:1;margin:0 48px 0 0;font:900 20px Archivo;text-align:center;text-shadow:0 2px 0 rgba(0,0,0,.3)}',
    '.l3-back{border:0;background:rgba(0,0,0,.32);color:#fff;width:40px;height:40px;border-radius:12px;font-size:20px;cursor:pointer;flex:none}',
    '.l3-ribbon{margin:4px auto 14px;display:table;background:linear-gradient(#ff6b6b,#c1121f);padding:8px 26px;font:900 20px Archivo;border-radius:12px;box-shadow:0 5px 0 #7f0d16,0 10px 20px rgba(0,0,0,.3);text-shadow:0 2px 0 rgba(0,0,0,.25);position:relative}',
    '.l3-panel{background:rgba(2,16,38,.55);border:2px solid rgba(255,255,255,.12);border-radius:20px;padding:14px;margin-bottom:12px}',
    '.l3-cal{display:grid;grid-template-columns:repeat(3,1fr);gap:9px}',
    '.l3-day{border-radius:14px;background:linear-gradient(#fff8e6,#ffdf8f);color:#5b3a00;padding:6px 4px 8px;text-align:center;font:900 12px Archivo;box-shadow:0 4px 0 #c98d00;position:relative}',
    '.l3-day b{display:block;font-size:28px;margin:3px 0 1px;filter:drop-shadow(0 3px 2px rgba(0,0,0,.2))}.l3-day small{display:block;font-size:12px}',
    '.l3-day.now{background:linear-gradient(#d9fbe5,#4ade80);box-shadow:0 4px 0 #15803d,0 0 0 3px #fff;animation:l3pulse 1.1s infinite}',
    '.l3-day.got{opacity:.6}.l3-day.got::after{content:"✓";position:absolute;inset:0;display:grid;place-items:center;font-size:44px;color:#15803d;text-shadow:0 2px 0 #fff}',
    '.l3-day.d7{grid-column:1/-1}.l3-day.d7 b{font-size:34px}',
    '@keyframes l3pulse{50%{transform:scale(1.05)}}',
    '.l3-go{display:block;margin:14px auto 0;border:0;border-radius:16px;padding:13px 44px;font:900 20px Archivo;color:#fff;background:linear-gradient(#5ee28e,#16a34a);box-shadow:0 6px 0 #166534,0 12px 22px rgba(0,0,0,.35);cursor:pointer;text-shadow:0 2px 0 rgba(0,0,0,.22);letter-spacing:.03em}',
    '.l3-go:active{transform:translateY(3px)}.l3-go.red{background:linear-gradient(#ff6b6b,#c1121f);box-shadow:0 6px 0 #7f0d16,0 12px 22px rgba(0,0,0,.35)}.l3-go.blue{background:linear-gradient(#4fb0ff,#0353a4);box-shadow:0 6px 0 #023a73,0 12px 22px rgba(0,0,0,.35)}.l3-go.full{width:100%}.l3-go[disabled]{filter:grayscale(1);opacity:.55}',
    '.l3-modal{position:absolute;inset:0;background:rgba(0,8,20,.72);display:grid;place-items:center;z-index:5;pointer-events:auto;overflow:hidden}',
    '.l3-gift{position:relative;width:min(88%,360px);background:linear-gradient(#1478d4,#04213f);border:3px solid #ffd166;border-radius:24px;padding:18px 16px;text-align:center;animation:l3in .45s cubic-bezier(.2,1.6,.4,1);box-shadow:0 0 60px rgba(255,209,102,.35)}',
    '.l3-gift h2{margin:0;font:900 26px Archivo;color:#ffd166;text-shadow:0 3px 0 #7f0d16}',
    '@keyframes l3in{from{transform:scale(.3);opacity:0}}',
    '.l3-gift .row{display:flex;justify-content:center;gap:12px;margin:16px 0 4px}.l3-gift .row div{background:rgba(255,255,255,.1);border-radius:16px;padding:10px 16px;font:900 17px Archivo}',
    '.l3-gift .row b{display:block;font-size:44px;animation:l3bob .9s infinite alternate}@keyframes l3bob{to{transform:translateY(-7px) rotate(7deg)}}',
    '.l3-conf{position:absolute;top:-16px;width:9px;height:14px;border-radius:2px;animation:l3fall linear forwards;pointer-events:none}@keyframes l3fall{to{transform:translateY(900px) rotate(800deg)}}',
    '.l3-flycoin{position:absolute;font-size:26px;z-index:9;transition:transform .85s cubic-bezier(.5,-.35,.7,1),opacity .85s;pointer-events:none}',
    '.l3-splash{position:absolute;inset:0;z-index:10;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;background:radial-gradient(circle at 50% 38%,#1f8cf0,#063a73 55%,#04213f);pointer-events:auto;transition:opacity .45s;overflow:hidden}',
    '.l3-splash>*{position:relative}.l3-splash .logo{width:84px;height:84px;border-radius:50%;box-shadow:0 0 0 4px #fff,0 10px 30px rgba(0,0,0,.5);background:#fff}',
    '.l3-splash h1{margin:0;font:900 46px/1 Archivo;text-align:center;color:#fff;-webkit-text-stroke:2px rgba(4,33,63,.4);filter:drop-shadow(0 5px 0 #c1121f) drop-shadow(0 10px 14px rgba(0,0,0,.5))}.l3-splash h1 em{display:block;font-style:normal;color:#ffd166;font-size:.62em;letter-spacing:.12em;margin-top:6px}',
    '.l3-cube{width:86px;height:86px;margin:34px 0 26px;position:relative;transform-style:preserve-3d;animation:l3cube 2.4s infinite cubic-bezier(.5,0,.5,1)}',
    '.l3-cw{perspective:520px}.l3-cube i{position:absolute;inset:0;backface-visibility:hidden;-webkit-backface-visibility:hidden;border-radius:18px;background:radial-gradient(circle at 30% 25%,#fff,#dbe6f3);box-shadow:inset 0 0 0 2px rgba(0,0,0,.08);display:grid;grid-template:repeat(3,1fr)/repeat(3,1fr);padding:12px}',
    '.l3-cube i span{width:15px;height:15px;border-radius:50%;background:#04213f;place-self:center}.l3-cube i.f1 span{background:#e11d2e;width:22px;height:22px}',
    '@keyframes l3cube{0%{transform:translateY(0) rotateX(-20deg) rotateY(30deg)}50%{transform:translateY(-34px) rotateX(200deg) rotateY(250deg)}100%{transform:translateY(0) rotateX(340deg) rotateY(390deg)}}',
    '.l3-bar{width:min(70%,280px);height:16px;border-radius:999px;background:rgba(0,0,0,.45);box-shadow:inset 0 0 0 2px rgba(255,255,255,.2);overflow:hidden}.l3-bar i{display:block;height:100%;width:0;background:linear-gradient(90deg,#5ee28e,#c6f432);border-radius:999px;transition:width .15s}',
    // offline setup
    '.l3-var{display:flex;justify-content:center;gap:22px}.l3-var button{border:0;background:none;color:#a9c7ea;font:900 12px Archivo;display:flex;flex-direction:column;align-items:center;gap:5px;cursor:pointer}',
    '.l3-var button i{width:60px;height:60px;border-radius:50%;display:grid;place-items:center;font-size:30px;font-style:normal;background:linear-gradient(#4a77b8,#0b2a52);box-shadow:0 4px 0 rgba(0,0,0,.35)}.l3-var button.on{color:#fff}.l3-var button.on i{background:linear-gradient(#ffe08a,#e09f00);box-shadow:0 4px 0 #8a6000,0 0 0 3px #fff}',
    '.l3-cnt{display:flex;justify-content:center;gap:8px;margin:4px 0 10px}.l3-cnt button{border:0;border-radius:12px;padding:8px 18px;font:900 16px Archivo;background:rgba(255,255,255,.1);color:#fff;cursor:pointer}.l3-cnt button.on{background:#037bdc;box-shadow:0 0 0 2px #fff}',
    '.l3-prow{display:flex;align-items:center;gap:8px;margin:7px 0}.l3-prow .cdot{width:40px;height:40px;border-radius:50%;border:3px solid #fff;flex:none;cursor:pointer;box-shadow:0 3px 0 rgba(0,0,0,.3);font-size:18px;display:grid;place-items:center}',
    '.l3-prow input{flex:1;min-width:0;border-radius:12px;border:2px solid rgba(255,255,255,.14);background:rgba(0,0,0,.35);color:#fff;padding:10px;font:800 15px system-ui}.l3-prow input:disabled{opacity:.6}',
    '.l3-prow .kind{border:0;border-radius:12px;width:48px;height:42px;font-size:22px;background:rgba(255,255,255,.14);cursor:pointer;flex:none}',
    '.l3-check{display:flex;align-items:center;justify-content:center;gap:8px;margin-top:10px;font:800 14px Archivo;cursor:pointer}.l3-check input{width:22px;height:22px;accent-color:#22c55e}',
    // profile
    '.l3-prof{text-align:center}.l3-prof .l3-av{width:92px;height:92px;font-size:56px;margin:4px auto 12px;cursor:default}.l3-prof h3{margin:0;font:900 22px Archivo}',
    '.l3-xp{height:12px;border-radius:999px;background:rgba(0,0,0,.4);overflow:hidden;margin:8px auto;max-width:260px}.l3-xp i{display:block;height:100%;background:linear-gradient(90deg,#ffd166,#ff9f1c)}',
    '.l3-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin:12px 0}.l3-stats div{background:rgba(255,255,255,.08);border-radius:14px;padding:8px 2px;font:900 19px Archivo}.l3-stats small{display:block;font:700 10.5px system-ui;opacity:.75;margin-top:2px}',
    '.l3-achs{display:grid;grid-template-columns:repeat(5,1fr);gap:8px}.l3-ach{aspect-ratio:1;border-radius:16px;display:grid;place-items:center;font-size:28px;background:linear-gradient(#fff0b8,#f5b301);box-shadow:0 4px 0 #a16207;border:0;cursor:pointer;padding:0}.l3-ach.lock{background:rgba(255,255,255,.08);box-shadow:none;filter:grayscale(1);opacity:.45}',
    '.l3-avs{display:flex;flex-wrap:wrap;gap:6px;justify-content:center;margin:10px 0}.l3-avs button{width:42px;height:42px;border-radius:50%;border:0;font-size:24px;background:rgba(255,255,255,.1);cursor:pointer;padding:0}.l3-avs button.on{box-shadow:0 0 0 3px #ffd166;background:rgba(255,255,255,.28)}',
    '.l3-sub{font:900 13px Archivo;letter-spacing:.08em;text-transform:uppercase;color:#ffd166;margin:4px 0 8px;text-align:center}',
    '.l3-in{width:100%;border-radius:12px;border:2px solid rgba(255,255,255,.18);background:rgba(0,0,0,.35);color:#fff;padding:11px;font:800 16px system-ui}',
    '.l3-row{display:flex;gap:8px;align-items:center}.l3-row>*{flex:1}.l3-err{color:#fecaca;font-weight:800;text-align:center;min-height:1.2em;margin-top:6px}',
    '.l3-inv{display:flex;align-items:center;gap:12px;font:900 16px Archivo}.l3-inv .ic{font-size:46px}',
    '.l3-fr{display:flex;flex-wrap:wrap;gap:8px;justify-content:center}.l3-fr span{background:rgba(255,255,255,.1);border-radius:999px;padding:6px 12px;font-weight:800}',
    '.l3-code{font:900 44px/1 Archivo,monospace;letter-spacing:.18em;text-align:center;margin:6px 0 12px;color:#ffd166;text-shadow:0 4px 0 #7f0d16}',
    '.l3-seats{display:grid;grid-template-columns:1fr 1fr;gap:8px}.l3-seat{display:flex;align-items:center;gap:8px;border-radius:14px;padding:8px;background:rgba(255,255,255,.07);border:2px solid rgba(255,255,255,.12);color:inherit;font:800 14px Archivo;text-align:start;min-width:0;cursor:pointer}',
    '.l3-seat i{width:30px;height:30px;border-radius:50%;flex:none;box-shadow:inset 0 -3px 0 rgba(0,0,0,.25);display:grid;place-items:center;font-style:normal;font-size:16px}.l3-seat span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.l3-seat.off{opacity:.5}',
    '.l3-shop{display:grid;grid-template-columns:repeat(auto-fill,minmax(100px,1fr));gap:8px}.l3-item{border-radius:16px;padding:10px 6px;background:rgba(255,255,255,.07);border:2px solid rgba(255,255,255,.12);text-align:center;font:800 13px Archivo;color:inherit;cursor:pointer}',
    '.l3-item b{display:block;width:40px;height:40px;border-radius:12px;margin:0 auto 6px;box-shadow:inset 0 -4px 0 rgba(0,0,0,.25),0 0 0 2px rgba(255,255,255,.45)}.l3-item.use{border-color:#4ade80;background:rgba(74,222,128,.14)}.l3-item small{display:block;margin-top:3px;color:#ffd166}',
    '@media (max-width:380px){.l3-tile.sm{font-size:11px}.l3-tile.sm .ic{font-size:32px}}',
    // richer lobby look (Wartabiye navy, blue, red and gold)
    '.l3-app{background:radial-gradient(70% 40% at 50% 14%,rgba(120,190,255,.55),transparent 70%),radial-gradient(140% 100% at 50% 0%,#1c8cf0 0%,#0b5bb0 34%,#073a78 62%,#04213f 100%)}',
    '.l3-spot{position:absolute;left:50%;top:-20%;width:120%;height:90%;transform:translateX(-50%);background:conic-gradient(from 160deg at 50% 0%,transparent 0deg,rgba(255,255,255,.16) 12deg,transparent 24deg,transparent 40deg,rgba(255,255,255,.12) 50deg,transparent 60deg);pointer-events:none;filter:blur(2px)}',
    '.l3-cur{position:absolute;top:0;width:30%;height:42%;pointer-events:none;background:repeating-linear-gradient(90deg,#e0303c 0 10px,#a10f1c 10px 22px,#c71f2d 22px 30px);filter:drop-shadow(0 8px 10px rgba(0,0,0,.35))}',
    '.l3-cur.l{left:0;clip-path:polygon(0 0,100% 0,62% 18%,30% 55%,0 100%)}.l3-cur.r{right:0;clip-path:polygon(0 0,100% 0,100% 100%,70% 55%,38% 18%)}',
    '.l3-cur::after{content:"";position:absolute;left:0;right:0;top:0;height:14px;background:radial-gradient(circle at 10px -2px,#ffd166 9px,transparent 10px) 0 0/20px 14px repeat-x,linear-gradient(#ffe08a,#e09f00) 0 0/100% 6px no-repeat}',
    '.l3-spk{position:absolute;inset:0;pointer-events:none}.l3-spk i{position:absolute;font-style:normal;opacity:.2;animation:l3tw 2.6s infinite;text-shadow:0 0 8px #fff}@keyframes l3tw{50%{opacity:1;transform:scale(1.4) rotate(20deg)}}',
    '.l3-top{padding:12px 12px 8px}',
    '.l3-av{width:54px;height:54px;background:conic-gradient(#ffd166 var(--p,0%),rgba(0,0,0,.35) 0);box-shadow:0 5px 12px rgba(0,0,0,.45);padding:4px}.l3-av .f{display:grid;place-items:center;width:100%;height:100%;border-radius:50%;background:radial-gradient(circle at 35% 30%,#fff,#cfe0f5);font-size:28px;box-shadow:0 0 0 2px #04213f}',
    '.l3-lv{background:linear-gradient(#ff6b6b,#c1121f);font-size:11px;bottom:-8px;padding:1px 8px}',
    '.l3-pill{position:relative;height:34px;padding:0 6px 0 34px;margin-left:16px;border-radius:12px;background:linear-gradient(#04213f,#0a3266);box-shadow:inset 0 0 0 2px rgba(255,255,255,.18),0 3px 0 rgba(0,0,0,.35);font-size:15px}',
    '.l3-pill .pi{position:absolute;left:-14px;top:50%;transform:translateY(-50%);width:44px;height:44px;object-fit:contain;filter:drop-shadow(0 3px 3px rgba(0,0,0,.45))}.l3-pill span.pi{font-size:26px;width:auto;height:auto}',
    '.l3-pill .plus{border:0;margin-left:6px;width:24px;height:24px;border-radius:8px;background:linear-gradient(#5ee28e,#16a34a);color:#fff;font:900 18px/1 Archivo;box-shadow:0 2px 0 #166534;cursor:pointer;padding:0}',
    '.l3-tile{border:3px solid rgba(255,255,255,.6);box-shadow:0 0 0 3px #04213f,0 8px 0 3px #031a36,0 18px 30px rgba(0,0,0,.45)}',
    '.l3-tile::before{content:"";position:absolute;left:5px;right:5px;top:4px;height:44%;border-radius:18px 18px 60% 60%/18px 18px 26% 26%;background:linear-gradient(rgba(255,255,255,.5),rgba(255,255,255,.05));pointer-events:none;z-index:1}',
    '.t-red{background:radial-gradient(circle at 50% 30%,#ff8a8f,#e11d2e 55%,#9b0f1b)}.t-blue{background:radial-gradient(circle at 50% 30%,#8fd0ff,#1c8cf0 55%,#0353a4)}.t-gold{background:radial-gradient(circle at 50% 30%,#fff1b3,#f5b301 60%,#b45309);color:#3b2600}.t-green{background:radial-gradient(circle at 50% 30%,#a7f3c0,#22c55e 55%,#047857)}.t-navy{background:radial-gradient(circle at 50% 30%,#7aa7e6,#1d4f99 60%,#0b2a52)}.t-purple{background:linear-gradient(90deg,#1d4f99,#5b3fd1 60%,#7c3aed)}',
    '.l3-tile .num{z-index:0;top:-2%;font-size:min(112px,27vw);color:#fff;-webkit-text-stroke:5px #04213f;paint-order:stroke fill;text-shadow:0 7px 0 #04213f,0 0 26px rgba(255,255,255,.55);filter:none}',
    '.l3-tile .art{position:absolute;left:50%;bottom:32px;transform:translateX(-50%);width:88%;height:auto;max-height:54%;object-fit:contain;z-index:2;filter:drop-shadow(0 8px 6px rgba(0,0,0,.4))}.l3-tile span.art{font-size:34px;width:auto}',
    '.l3-tile .lab{z-index:3;background:linear-gradient(#04213f,#0a3266);border:2px solid rgba(255,255,255,.35);font-size:15px;text-shadow:0 2px 0 rgba(0,0,0,.4)}',
    '.l3-tile.sm{justify-content:flex-end;padding:4px 4px 8px}.l3-tile.sm .ic{width:100%;height:auto;max-height:72%;object-fit:contain;position:relative;z-index:2;font-size:38px;filter:drop-shadow(0 6px 5px rgba(0,0,0,.4))}.l3-tile.sm span.ic{width:auto}',
    '.l3-tile.sm .lb{position:relative;z-index:3;text-shadow:0 2px 0 rgba(0,0,0,.35);line-height:1.1}.t-gold .lb{text-shadow:0 1px 0 rgba(255,255,255,.5)}',
    '.l3-wide{padding:6px 14px;min-height:64px}.l3-wide .ic{width:66px;height:58px;object-fit:contain;position:relative;z-index:2;font-size:30px}.l3-wide>span{position:relative;z-index:2}',
    '.l3-badge{margin-inline-start:auto;background:linear-gradient(#ff6b6b,#c1121f);border:2px solid #fff;border-radius:999px;padding:3px 12px;font-size:14px;animation:l3pulse 1.1s infinite}',
    '.l3-nav{background:linear-gradient(#0d3a75,#04213f);border-top:3px solid #ffd166;box-shadow:0 -6px 16px rgba(0,0,0,.35)}.l3-nav button i{font-size:25px;filter:drop-shadow(0 3px 2px rgba(0,0,0,.4))}',
    '.l3-nav button.on{background:radial-gradient(circle at 50% 30%,#8fd0ff,#1c8cf0 55%,#0353a4);border:2px solid #ffd166;transform:translateY(-12px) scale(1.08)}',
    '.l3-ribbon{background:linear-gradient(#ff6b6b,#c1121f);border:3px solid #ffd166;font-size:21px;padding:8px 30px;border-radius:14px}',
    '.l3-ribbon::before,.l3-ribbon::after{content:"";position:absolute;top:12px;width:22px;height:30px;background:#9b0f1b;z-index:-1}.l3-ribbon::before{left:-16px;clip-path:polygon(0 0,100% 0,100% 100%,0 100%,40% 50%)}.l3-ribbon::after{right:-16px;clip-path:polygon(0 0,100% 0,60% 50%,100% 100%,0 100%)}',
    '.l3-day{background:linear-gradient(#fffaf0,#ffe6a8);border:3px solid #fff;box-shadow:0 0 0 2px #c98d00,0 5px 0 2px #a16207;padding:0 4px 6px;overflow:hidden}',
    '.l3-day .tag{display:block;margin:0 -4px 2px;padding:3px 0;background:linear-gradient(#f59e0b,#c2410c);color:#fff;font-size:12px;text-shadow:0 1px 0 rgba(0,0,0,.3)}.l3-day.now .tag{background:linear-gradient(#4ade80,#15803d)}',
    '.l3-day .dimg{display:block;width:100%;height:64px;object-fit:contain;margin:2px 0}.l3-day.d7 .dimg{height:84px}.l3-day small{font-size:13px;color:#7c2d12}',
    '.l3-day.now{background:linear-gradient(#f0fff4,#bbf7d0);box-shadow:0 0 0 2px #15803d,0 5px 0 2px #166534,0 0 22px rgba(74,222,128,.8)}',
    '.l3-burst{position:absolute;left:50%;top:44%;width:900px;height:900px;margin:-450px 0 0 -450px;background:repeating-conic-gradient(rgba(255,209,102,.28) 0 10deg,transparent 10deg 20deg);border-radius:50%;-webkit-mask:radial-gradient(circle,#000 20%,transparent 65%);mask:radial-gradient(circle,#000 20%,transparent 65%);animation:l3spin 14s linear infinite;pointer-events:none}',
    '.l3-gift{border:4px solid #ffd166;background:linear-gradient(#1c8cf0,#073a78 60%,#04213f);padding-top:8px}.l3-gift .top{display:block;width:78%;margin:-60px auto 0;filter:drop-shadow(0 10px 10px rgba(0,0,0,.5));animation:l3bob 1s infinite alternate}',
    '.l3-gift h2{background:linear-gradient(#ff6b6b,#c1121f);color:#fff;margin:4px -8px 0;padding:8px;border-radius:12px;border:3px solid #ffd166;text-shadow:0 2px 0 rgba(0,0,0,.3)}',
    '.l3-gift .row div{display:flex;flex-direction:column;align-items:center;gap:2px}.l3-gift .ri{width:58px;height:58px;object-fit:contain;animation:l3bob .9s infinite alternate}',
    '.l3-flycoin .fc{width:34px;height:34px;display:block}',
    '.l3-die{position:absolute;left:0;top:0;width:60px;height:60px;border:0;border-radius:15px;padding:8px;background:linear-gradient(160deg,#ffffff,#dbe4ef);box-shadow:0 0 0 4px var(--c,#ef4444),0 0 0 6px #fff,0 6px 0 5px rgba(0,0,0,.3),0 12px 22px rgba(0,0,0,.45);display:grid;grid-template-columns:repeat(3,1fr);grid-template-rows:repeat(3,1fr);gap:2px;pointer-events:auto;cursor:pointer;transition:left .3s,top .3s;z-index:3}',
    '.l3-die i{border-radius:50%;background:radial-gradient(circle at 35% 30%,#64748b,#020617 70%);visibility:hidden}.l3-die i.on{visibility:visible}.l3-die.one i.on{background:radial-gradient(circle at 35% 30%,#ff8a8a,#b91c1c 70%)}',
    '.l3-die.go{animation:l3pulse .6s infinite alternate}.l3-die.roll{animation:l3shake .14s infinite}.l3-die[disabled]{cursor:default}',
    '@keyframes l3pulse{to{transform:scale(1.13)}}@keyframes l3shake{0%{transform:rotate(-14deg) scale(1.05)}50%{transform:rotate(14deg) scale(.95)}100%{transform:rotate(-14deg) scale(1.05)}}',
    '.l3-flat .l3-pl.on::before{content:"";position:absolute;top:-28px;left:50%;margin-left:-12px;border-left:12px solid transparent;border-right:12px solid transparent;border-top:18px solid #ffd166;filter:drop-shadow(0 2px 2px rgba(0,0,0,.55));animation:l3arr .45s infinite alternate}@keyframes l3arr{to{transform:translateY(8px)}}',
    '.l3-flat .l3-bot{bottom:6px}.l3-flat .l3-msg{font-size:13px;padding:6px 12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:calc(100% - 200px)}.l3-flat .l3-coin{left:auto;right:8px;transform:none}',
    '.l3-flat .l3-pl .a{border-radius:16px;background:linear-gradient(160deg,#ffffff,#cfe0f5)}.l3-flat .l3-pl.on .a{border-radius:16px}',
    '.l3-tl{position:absolute;left:6px;top:8px;display:flex;flex-direction:column;gap:8px;pointer-events:auto;z-index:2}.l3-tl button{width:38px;height:38px;border-radius:13px;border:2px solid rgba(255,255,255,.75);background:linear-gradient(#2b9bff,#0353a4);color:#fff;font:900 20px Archivo,sans-serif;box-shadow:0 4px 0 #02386f,0 8px 14px rgba(0,0,0,.4);cursor:pointer;display:grid;place-items:center;padding:0}',
    '@media (prefers-reduced-motion:reduce){.l3-die.go,.l3-die.roll,.l3-flat .l3-pl.on::before{animation:none}}',
    '@media (prefers-reduced-motion:reduce){.l3-rays,.l3-tile::after,.l3-cube,.l3-spk i,.l3-burst{animation:none}}'
  ].join('') });
  var root = h('div', { class: 'l3', style: { position: 'absolute', inset: 0 } }); hud.append(css, root);
  var panelsEl = h('div'), coinEl = h('div', { class: 'l3-coin', text: '🪙 ' + coins() });
  var msgEl = h('div', { class: 'l3-msg', text: '' }), rollBtn = h('button', { type: 'button', class: 'l3-roll', text: tx('roll'), onclick: function () { localRoll(); } });
  var emoBar = h('div', { class: 'l3-emo', hidden: true });
  ['👍', '😂', '😮', '🔥', '👏', '😢'].forEach(function (e) { emoBar.append(h('button', { type: 'button', 'aria-label': e, text: e, onclick: function () { if (net) net.send({ t: 'emote', e: e }); } })); });
  var bot = h('div', { class: 'l3-bot' }, msgEl, rollBtn, emoBar);
  // flat style: a dice box beside the player whose turn it is, and exit / settings buttons at the top left
  var dieEl = h('button', { type: 'button', class: 'l3-die', 'aria-label': tx('roll'), hidden: true, onclick: function () { localRoll(); } });
  for (var di = 0; di < 9; di++) dieEl.append(h('i'));
  var DPIPS = { 1: [4], 2: [2, 6], 3: [2, 4, 6], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] }, dieFace = 6;
  function setDieFace(n) { dieFace = n; [].forEach.call(dieEl.children, function (p, k) { p.classList.toggle('on', DPIPS[n].indexOf(k) >= 0); }); dieEl.classList.toggle('one', n === 1); }
  setDieFace(6);
  var tlEl = h('div', { class: 'l3-tl' },
    h('button', { type: 'button', 'aria-label': tx('back'), title: tx('back'), text: '✕', onclick: function () { api.sfx('tap'); exitGame(); } }),
    api.settings ? h('button', { type: 'button', 'aria-label': tx('settings'), title: tx('settings'), text: '⚙', onclick: function () { api.sfx('tap'); api.settings(); } }) : null);
  root.append(panelsEl, coinEl, bot, dieEl, tlEl);
  function flashCoin(t) { var f = h('div', { class: 'l3-fly', text: t, style: { transform: 'translateX(-50%)' } }); root.append(f); requestAnimationFrame(function () { f.style.transform = 'translate(-50%,-30px)'; f.style.opacity = '0'; }); setTimeout(function () { f.remove(); }, 1300); }
  function popEmote(e) { var p = h('div', { class: 'l3-pop', text: e, style: { left: (20 + Math.random() * 60) + '%', top: '55%' } }); root.append(p); requestAnimationFrame(function () { p.style.transform = 'translateY(-120px) scale(1.4)'; p.style.opacity = '0'; }); setTimeout(function () { p.remove(); }, 1500); api.sfx('pop'); }

  // ------------------------------------------------------------------ progress: stats, level, achievements, daily rewards
  var ST = api.load('stats', { games: 0, wins: 0, caps: 0, home: 0, team: 0, online: 0, quick: 0, win4: 0 });
  function saveStats() { api.save('stats', ST); checkAch(); }
  function xp() { return ST.games * 20 + ST.wins * 60 + ST.caps * 5 + ST.home * 3; }
  function level() { return Math.floor(xp() / 150) + 1; }
  var DAILY = [[100, 0], [150, 2], [200, 0], [250, 5], [300, 0], [400, 10], [1000, 25]];
  function dayKey(off) { var d = new Date(); d.setDate(d.getDate() + (off || 0)); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); }
  function dailyState() {
    var D = api.load('daily', { last: '', day: 0, best: 0 }), now = dayKey(0);
    if (D.last === now) return { D: D, cur: D.day, can: false };
    return { D: D, cur: D.last === dayKey(-1) ? D.day % 7 + 1 : 1, can: true };
  }
  var ACH = [
    ['win1', '🏆', { so: 'Guushii ugu horreysay', en: 'First win' }, function () { return ST.wins >= 1; }],
    ['win10', '🥇', { so: '10 guulood', en: '10 wins' }, function () { return ST.wins >= 10; }],
    ['games25', '🎲', { so: '25 ciyaarood', en: '25 games' }, function () { return ST.games >= 25; }],
    ['caps25', '⚔️', { so: '25 cunis', en: '25 captures' }, function () { return ST.caps >= 25; }],
    ['home50', '🏠', { so: '50 gabal guriga gaaray', en: '50 tokens home' }, function () { return ST.home >= 50; }],
    ['team', '🤝', { so: 'Guul koox', en: 'Team win' }, function () { return ST.team >= 1; }],
    ['online', '🌍', { so: 'Guul online', en: 'Online win' }, function () { return ST.online >= 1; }],
    ['quick', '⚡', { so: 'Guul degdeg', en: 'Quick win' }, function () { return ST.quick >= 1; }],
    ['win4', '👑', { so: 'Ka adkaaday 3 qof', en: 'Beat three players' }, function () { return ST.win4 >= 1; }],
    ['week', '📅', { so: '7 maalmood oo hadiyad', en: '7-day rewards' }, function () { return (api.load('daily', {}).best || 0) >= 7; }]
  ];
  function checkAch() { var got = api.load('ach', []); ACH.forEach(function (a) { if (got.indexOf(a[0]) < 0 && a[3]()) { got.push(a[0]); addGems(5); api.achieve('l3-' + a[0], a[2]); } }); api.save('ach', got); }

  // ------------------------------------------------------------------ game flow
  var S = null, role = 'local', myPid = api.load('pid', null), net = null, myName = api.load('name', ''), shown = {}, names = {};
  if (!myPid) { myPid = Math.random().toString(36).slice(2, 12) + Math.random().toString(36).slice(2, 6); api.save('pid', myPid); }
  if (!myName && me0.name) myName = String(me0.name).replace(/[^\p{L}\p{N} ]/gu, '').trim().slice(0, 14);
  function seatName(s) { if (!s) return ''; if (s.kind === 'r') return '🤖 ' + cname(s.c); if (s.name) return s.name + (s.pid === myPid && role !== 'local' ? ' (' + tx('you') + ')' : ''); return cname(s.c); }
  function seatAv(s) { if (s.kind === 'r') return '🤖'; if ((role === 'local' && s.me) || (role !== 'local' && s.pid === myPid)) return myAv; return SEATAV[s.c]; }
  function isMine(s) { if (!s) return false; if (role === 'local') return s.kind === 'h'; return s.kind === 'o' && s.pid === myPid; }
  function iAmDirector() { return role !== 'guest'; }
  var panels = {};
  function buildPanels() {
    panelsEl.innerHTML = ''; panels = {};
    S.seats.forEach(function (s) {
      var el = h('div', { class: 'l3-pl', style: { '--c': CSS[s.c] } }, h('div', { class: 'a' }, h('u', { text: S.team ? (s.c % 2 ? '🔷' : '🔶') : '' }), document.createTextNode(seatAv(s)), h('b', { text: '0/4' })), h('span', { text: s.kind === 'r' ? cname(s.c) : seatName(s) }));
      panels[s.c] = el; panelsEl.append(el);
    });
    placePanels();
  }
  function placePanels() {
    if (!S) return;
    var portrait = X.H > X.W * 1.05, F = flat();
    root.classList.toggle('l3-flat', F);
    if (F && portrait) {
      // just outside the top and bottom edges of the board
      var yT = X.toScreen(new T.Vector3(0, 0, -8.1)).y, yB = X.toScreen(new T.Vector3(0, 0, 8.1)).y;
      S.seats.forEach(function (s) {
        var el = panels[s.c]; if (!el) return;
        var y = YARD[s.c], px = y[1] + 3 - 7.5, pz = y[0] + 3 - 7.5, rx = px * Math.cos(yaw) + pz * Math.sin(yaw), rz = -px * Math.sin(yaw) + pz * Math.cos(yaw);
        el.style.left = rx < 0 ? (rz < 0 ? '50px' : '6px') : ''; el.style.right = rx < 0 ? '' : '6px'; el.style.bottom = '';
        el.style.top = (rz < 0 ? Math.max(30, yT - 84) : Math.min(X.H - 96, yB + 6)) + 'px';
      });
      placeDie(); return;
    }
    S.seats.forEach(function (s) {
      var el = panels[s.c]; if (!el) return;
      var y = YARD[s.c], px = y[1] + 3 - 7.5, pz = y[0] + 3 - 7.5, rx = px * Math.cos(yaw) + pz * Math.sin(yaw), rz = -px * Math.sin(yaw) + pz * Math.cos(yaw);
      el.style.left = rx < 0 ? '6px' : ''; el.style.right = rx < 0 ? '' : '6px';
      el.style.top = rz < 0 ? (portrait ? '44px' : F ? '58px' : '10px') : ''; el.style.bottom = rz < 0 ? '' : (portrait ? '12px' : '10px');
    });
    placeDie();
  }
  function placeDie() {
    var F = flat() && S && !S.over;
    dieEl.hidden = !F; rollBtn.hidden = flat();
    dice.visible = !flat();
    if (!F) return;
    var cs = curSeat(S), el = panels[cs.c]; if (!el) return;
    var left = el.style.left !== '';
    dieEl.style.left = (left ? el.offsetLeft + el.offsetWidth + 2 : el.offsetLeft - 62) + 'px';
    dieEl.style.top = (el.offsetTop - 2) + 'px';
    dieEl.style.setProperty('--c', CSS[cs.c]);
    var can = isMine(cs) && !S.rolled && !busy();
    dieEl.disabled = !can; dieEl.classList.toggle('go', can && !DA);
  }
  function exitGame() {
    if (net) { net.close(); net = null; } if (timer) { timer.cancel(); timer = null; }
    hops = []; DA = null; S = null; highlight = []; finished = true;
    Object.keys(tokens).forEach(function (k) { world.remove(tokens[k].g); }); tokens = {};
    panelsEl.innerHTML = ''; panels = {}; dieEl.hidden = true; msgEl.textContent = '';
    homeScreen();
  }
  function renderHud() {
    if (!S) return;
    S.seats.forEach(function (s, k) {
      var el = panels[s.c]; if (!el) return;
      var home = S.tok[s.c].filter(function (v) { return v === 56; }).length;
      el.classList.toggle('on', k === S.cur && !S.over); el.classList.toggle('done', home === 4 && !S.over);
      el.querySelector('b').textContent = home + '/4';
    });
    var cs = curSeat(S), mine = isMine(cs);
    var t = S.over ? winText() : S.msg === 'none' ? tx('none') : mine ? (S.rolled ? tx('pick') : S.msg === 'six' ? tx('six') : (role === 'local' && S.seats.filter(function (x) { return x.kind === 'h'; }).length > 1 ? tx('turn', seatName(cs)) : tx('yourTurn'))) : (cs.kind === 'o' ? tx('wait', seatName(cs)) : tx('turn', seatName(cs)));
    msgEl.textContent = t; msgEl.style.color = CSS[S.over ? S.win : cs.c];
    rollBtn.disabled = !(mine && !S.rolled && !S.over && !busy());
    rollBtn.style.display = S.over ? 'none' : '';
    placeDie();
    coinEl.textContent = '🪙 ' + coins() + '   💎 ' + gems();
  }
  function winText() { if (S.team) return tx('teamWin', cname(S.win % 2) + ' & ' + cname(S.win % 2 + 2)); return tx('win', seatName(seatOf(S, S.win))); }
  // displayed state follows S with animations: tokens hop square by square
  var hops = [];
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
    Object.keys(tokens).forEach(function (k) { if (moved[k]) return; var c = +k.split(':')[0], i = +k.split(':')[1], pr = S.tok[c][i]; if (tokens[k].pr !== pr && !hops.some(function (hh) { return hh.k === k; })) { tokens[k].pr = pr; } });
    layoutIdle();
  }
  function stackIndex(k) {
    var c = +k.split(':')[0], pr = tokens[k].pr, cell = cellOf(c, pr); if (!cell || pr === 56) return 0;
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
      if (H.lastIdx !== idx) { H.lastIdx = idx; api.sfx('move'); }
      tk.g.position.lerpVectors(a, b, Math.min(1, f)); tk.g.position.y = TOP + Math.sin(Math.min(1, f) * Math.PI) * 0.55;
      if (H.t >= H.path.length * STEP) {
        tk.pr = H.path[H.path.length - 1]; hops.shift();
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
    if (prev && S.rid !== prev.rid) throwDice(S.die, S.seats[S.cur].c);
    if (role === 'host' && net) net.send({ t: 'state', s: S });
  }
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
      later(25000, function () { if (S.over || busy() || curSeat(S) !== cs) return; if (!S.rolled) act(function () { doRoll(S, api.rand(1, 6)); }); else if (!S.pass) act(function () { doMove(S, robotPick(S, movable(S, cs.c, S.die))); }); });
      return;
    }
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
    if (L.cap && L.cap.length) { api.add(50 * L.cap.length); earn(3 * L.cap.length); ST.caps += L.cap.length; saveStats(); }
    if (L.home) { api.add(100); earn(5); ST.home++; saveStats(); }
  }
  var finished = false;
  function finish() {
    if (finished) return; finished = true; renderHud();
    var w = seatOf(S, S.win), humans = S.seats.filter(function (s) { return s.kind !== 'r'; }).length;
    var mine = S.team ? S.seats.some(function (s) { return s.c % 2 === S.win % 2 && isMine(s); }) : isMine(w);
    function wn(L) { return S.team ? CNAME[L][S.win % 2] + ' & ' + CNAME[L][S.win % 2 + 2] : seatName(w); }
    var msg = { so: TX.so[S.team ? 'teamWin' : 'win'].replace('{c}', wn('so')), en: TX.en[S.team ? 'teamWin' : 'win'].replace('{c}', wn('en')) };
    ST.games++;
    if (mine) {
      earn(role === 'local' && humans > 1 ? 20 : 60); ST.wins++;
      if (S.team) ST.team++; if (S.mode === 'quick') ST.quick++; if (role !== 'local') ST.online++; if (S.seats.length === 4 && !S.team) ST.win4++;
    } else earn(10);
    saveStats();
    if (net && role === 'host') net.send({ t: 'state', s: S });
    api.after(1600, function () { if (mine || (role === 'local' && w.kind === 'h')) api.win(api.score + 500, msg); else api.lose(api.score, msg); });
  }
  function localRoll() {
    if (!S || api.paused || S.over || S.rolled || busy() || lobby) return; var cs = curSeat(S); if (!isMine(cs)) return;
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
  function begin(seats, opt) {
    finished = false; hops = []; DA = null; shown = {};
    S = newState(seats, opt); buildTokens(S); Object.keys(tokens).forEach(function (k) { tokens[k].target = tokens[k].g.position.clone(); });
    orient(); layoutIdle(); buildPanels(); setHighlight(); renderHud(); closeLobby();
    Object.keys(tokens).forEach(function (k) { tokens[k].pr = S.tok[+k.split(':')[0]][+k.split(':')[1]]; }); layoutIdle();
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
    if (!S || api.paused || lobby) return; ray.setFromCamera(X.ndc(e), cam);
    if (ray.intersectObject(dice, false).length) { localRoll(); return; }
    var objs = []; highlight.forEach(function (k) { objs.push(tokens[k].m); });
    var hit = ray.intersectObjects(objs, false)[0];
    if (hit) return localMove(hit.object.userData.i);
    var p = ray.intersectObject(boardTop, false)[0]; if (!p) return; var best = null, bd = 1.1;
    highlight.forEach(function (k) { var wp = new T.Vector3(); tokens[k].g.getWorldPosition(wp); var d = Math.hypot(wp.x - p.point.x, wp.z - p.point.z); if (d < bd) { bd = d; best = k; } });
    if (best) localMove(+best.split(':')[1]);
  });

  // ------------------------------------------------------------------ app screens: splash, home, setup, rewards, profile, friends, looks
  var lobby = null, coinPill = null, autoDaily = false;
  function closeLobby() { if (lobby) { lobby.remove(); lobby = null; } }
  function pill(kind, v) { return h('div', { class: 'l3-pill' }, art(kind, 'pi', kind === 'coin' ? '🪙' : '💎'), h('span', { text: String(v) }), h('button', { type: 'button', class: 'plus', 'aria-label': tx('nRewards'), text: '+', onclick: function () { rewardsScreen(); } })); }
  function topBar() {
    coinPill = pill('coin', coins());
    var pct = Math.round((xp() % 150) / 150 * 100);
    return h('div', { class: 'l3-top' }, h('button', { type: 'button', class: 'l3-av', 'aria-label': tx('nProfile'), style: { '--p': pct + '%' }, onclick: function () { profileScreen(); } }, h('span', { class: 'f', text: myAv }), h('span', { class: 'l3-lv', text: '⭐ ' + level() })), h('div', { class: 'sp' }), coinPill, pill('gem', gems()));
  }
  function navBar(tab) {
    var ds = dailyState();
    var items = [['looks', '🎨', 'nLooks', looksScreen], ['friends', '👥', 'nFriends', function () { friendsScreen(); }], ['home', '🏠', 'nHome', homeScreen], ['rewards', '🎁', 'nRewards', rewardsScreen], ['profile', '😀', 'nProfile', profileScreen]];
    return h('div', { class: 'l3-nav' }, items.map(function (it) { return h('button', { type: 'button', class: tab === it[0] ? 'on' : '', onclick: function () { api.sfx('tap'); it[3](); } }, h('i', { text: it[1] }), h('span', { text: tx(it[2]) }), it[0] === 'rewards' && ds.can ? h('span', { class: 'l3-dot' }) : null); }));
  }
  function screen(kids, o) {
    o = o || {}; closeLobby(); role = o.keepRole ? role : 'local';
    if (!o.keepRole && net) { net.close(); net = null; } emoBar.hidden = !net;
    lobby = h('div', { class: 'l3-app' }, h('div', { class: 'l3-rays' }), h('div', { class: 'l3-spot' }), h('div', { class: 'l3-cur l' }), h('div', { class: 'l3-cur r' }), sparkles(), o.head || topBar(), h('div', { class: 'l3-main' }, h('div', { class: 'l3-wrap' }, kids)), o.nav === false ? null : navBar(o.tab));
    root.append(lobby); return lobby;
  }
  function sparkles() { var b = h('div', { class: 'l3-spk', 'aria-hidden': 'true' }); for (var i = 0; i < 18; i++) b.append(h('i', { text: i % 3 ? '✦' : '★', style: { left: (Math.random() * 96) + '%', top: (Math.random() * 90) + '%', fontSize: (8 + Math.random() * 12) + 'px', animationDelay: (Math.random() * 3) + 's', color: i % 4 ? '#ffe08a' : '#ffffff' } })); return b; }
  function head(title, back) { return h('div', { class: 'l3-head' }, h('button', { type: 'button', class: 'l3-back', 'aria-label': tx('back'), text: '←', onclick: function () { (back || homeScreen)(); } }), h('h2', { text: title })); }
  function splash(then) {
    var bar = h('i'), cube = h('div', { class: 'l3-cube', 'aria-hidden': 'true' });
    // a small 3D dice: six faces with pips
    var PIPS = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
    [[1, 'translateZ(43px)'], [6, 'rotateY(180deg) translateZ(43px)'], [2, 'rotateY(90deg) translateZ(43px)'], [5, 'rotateY(-90deg) translateZ(43px)'], [3, 'rotateX(90deg) translateZ(43px)'], [4, 'rotateX(-90deg) translateZ(43px)']].forEach(function (f) {
      var face = h('i', { class: 'f' + f[0], style: { transform: f[1] } });
      for (var p = 0; p < 9; p++) face.append(h('span', { style: { visibility: PIPS[f[0]].indexOf(p) >= 0 ? 'visible' : 'hidden' } }));
      cube.append(face);
    });
    var sp = h('div', { class: 'l3-splash' }, h('div', { class: 'l3-rays' }), h('div', { class: 'l3-cw' }, cube), h('h1', { html: (SO ? 'Afarta Guri' : 'Four Homes') + '<em>WARTABIYE TV</em>' }), h('div', { class: 'l3-bar' }, bar));
    root.append(sp);
    var p = 0, iv = setInterval(function () { p = Math.min(100, p + 7 + Math.random() * 9); bar.style.width = p + '%'; if (p >= 100) { clearInterval(iv); setTimeout(function () { then(); sp.style.opacity = '0'; setTimeout(function () { sp.remove(); }, 460); }, 180); } }, 90);
  }
  function homeScreen() {
    var ds = dailyState();
    screen([
      h('div', { class: 'l3-big' },
        h('button', { type: 'button', class: 'l3-tile big t-red', onclick: function () { setupScreen(2, false); } }, h('span', { class: 'num', 'data-n': '2', text: '2' }), art('p2', 'art', '🎲'), h('span', { class: 'lab', text: tx('p2') })),
        h('button', { type: 'button', class: 'l3-tile big t-blue', onclick: function () { setupScreen(4, false); } }, h('span', { class: 'num', 'data-n': '4', text: '4' }), art('p4', 'art', '🎲'), h('span', { class: 'lab', text: tx('p4') }))),
      h('div', { class: 'l3-small' },
        h('button', { type: 'button', class: 'l3-tile sm t-gold', onclick: function () { createRoom(); } }, art('priv', 'ic', '🎲'), h('span', { class: 'lb', text: tx('privateT') })),
        h('button', { type: 'button', class: 'l3-tile sm t-green', onclick: function () { friendsScreen(); } }, art('online', 'ic', '🌍'), h('span', { class: 'lb', text: tx('onlineT') })),
        h('button', { type: 'button', class: 'l3-tile sm t-navy', onclick: function () { setupScreen(4, true); } }, art('team', 'ic', '🤝'), h('span', { class: 'lb', text: tx('teamT') }))),
      h('button', { type: 'button', class: 'l3-tile l3-wide t-purple', onclick: function () { rewardsScreen(); } }, art('gift', 'ic', '🎁'), h('span', { text: tx('daily') }), ds.can ? h('span', { class: 'l3-badge', text: '+' + DAILY[ds.cur - 1][0] }) : null)
    ], { tab: 'home' });
    if (ds.can && !autoDaily) { autoDaily = true; api.after(500, function () { if (lobby && !S) rewardsScreen(); }); }
  }
  // play offline: 2, 3 or 4 seats, a name, colour and person/robot for each, Classic or Quick, teams for four
  var setup = api.load('setup', { kinds: ['h', 'r', 'r', 'r'], cols: [0, 2, 1, 3], names: ['', '', '', ''], mode: 'classic' });
  function setupScreen(n, team) {
    var st = { n: n, team: !!team && n === 4 };
    if (st.team) setup.cols = [0, 1, 2, 3];
    var box = h('div');
    function fixCols() {
      // two players sit opposite each other; colours never repeat
      if (st.n === 2 && (setup.cols[1] - setup.cols[0] + 4) % 4 !== 2) setup.cols[1] = (setup.cols[0] + 2) % 4;
      for (var i = 0; i < st.n; i++) for (var j = 0; j < i; j++) if (setup.cols[i] === setup.cols[j]) { for (var c = 0; c < 4; c++) if (setup.cols.slice(0, st.n).indexOf(c) < 0) { setup.cols[i] = c; break; } }
    }
    function draw() {
      fixCols(); box.innerHTML = '';
      var vars = h('div', { class: 'l3-var' }, [['classic', '⭐'], ['quick', '⚡']].map(function (v) { return h('button', { type: 'button', class: setup.mode === v[0] ? 'on' : '', onclick: function () { setup.mode = v[0]; draw(); } }, h('i', { text: v[1] }), h('span', { text: tx(v[0]) })); }));
      var cnt = h('div', { class: 'l3-cnt' }, [2, 3, 4].map(function (k) { return h('button', { type: 'button', class: st.n === k ? 'on' : '', onclick: function () { st.n = k; if (k !== 4) st.team = false; draw(); } }, document.createTextNode(k + 'P')); }));
      var rows = h('div');
      for (var i = 0; i < st.n; i++) (function (i) {
        var c = setup.cols[i], k = setup.kinds[i];
        var inp = h('input', { maxlength: '14', value: k === 'r' ? '🤖 ' + cname(c) : (setup.names[i] || (i === 0 ? myName : '') || tx('playerN', i + 1)), 'aria-label': tx('name'), disabled: k === 'r', oninput: function () { setup.names[i] = this.value.replace(/[<>]/g, '').slice(0, 14); } });
        rows.append(h('div', { class: 'l3-prow' },
          h('button', { type: 'button', class: 'cdot', style: { background: CSS[c] }, 'aria-label': cname(c), text: i === 0 && k === 'h' ? myAv : '', onclick: function () { if (st.team) return; var used = setup.cols.slice(0, st.n); for (var d = 1; d < 4; d++) { var nc = (c + d) % 4; if (used.indexOf(nc) < 0) { setup.cols[i] = nc; if (st.n === 2) setup.cols[1 - i] = (nc + 2) % 4; break; } } draw(); } }),
          inp,
          h('button', { type: 'button', class: 'kind', 'aria-label': k === 'h' ? tx('person') : tx('robot'), text: k === 'h' ? '👤' : '🤖', onclick: function () { setup.kinds[i] = k === 'h' ? 'r' : 'h'; draw(); } })));
      })(i);
      var chk = h('input', { type: 'checkbox', onchange: function () { st.team = this.checked; if (st.team) setup.cols = [0, 1, 2, 3]; draw(); } }); chk.checked = st.team;
      var err = h('div', { class: 'l3-err' });
      box.append(h('div', { class: 'l3-panel' }, vars), h('div', { class: 'l3-panel' }, cnt, rows, st.n === 4 ? h('label', { class: 'l3-check' }, chk, h('span', { text: '🤝 ' + tx('teamMode') })) : null), err,
        h('button', { type: 'button', class: 'l3-go full', text: tx('go'), onclick: function () {
          var seats = [];
          for (var i = 0; i < st.n; i++) seats.push({ c: setup.cols[i], kind: setup.kinds[i], name: setup.kinds[i] === 'h' ? (String(setup.names[i] || (i === 0 ? myName : '') || '').replace(/[<>]/g, '').trim().slice(0, 14) || cname(setup.cols[i])) : '', me: i === 0 });
          if (!seats.some(function (s) { return s.kind === 'h'; })) { err.textContent = tx('needTwo'); api.sfx('bad'); return; }
          api.save('setup', setup); api.sfx('good'); role = 'local'; begin(seats, { mode: setup.mode, team: st.team });
        } }));
    }
    draw();
    screen([h('div', { class: 'l3-ribbon', text: st.team ? '🤝 ' + tx('teamT') : '🎲 ' + tx('offline') }), box], { head: head(SO ? 'Afarta Guri' : 'Four Homes') , nav: false });
  }
  function rewardsScreen() {
    var ds = dailyState(), cal = h('div', { class: 'l3-cal' });
    DAILY.forEach(function (r, i) {
      var d = i + 1, got = ds.can ? d < ds.cur : d <= ds.cur, now = ds.can && d === ds.cur;
      var lab = now ? tx('today') : (!ds.can && d === ds.cur + 1) || (ds.can && d === ds.cur + 1) ? tx('tomorrow') : tx('day', d);
      cal.append(h('div', { class: 'l3-day' + (now ? ' now' : '') + (got ? ' got' : '') + (d === 7 ? ' d7' : '') }, h('span', { class: 'tag', text: lab }), art(d === 7 ? 'chest' : r[1] ? 'stackgem' : 'stack', 'dimg', '🪙'), h('small', { text: r[0] + (r[1] ? '  +' + r[1] + ' 💎' : '') })));
    });
    var btn = h('button', { type: 'button', class: 'l3-go', text: ds.can ? tx('collect') : '✓', disabled: !ds.can, onclick: function () { collectDaily(); } });
    screen([h('div', { class: 'l3-ribbon', text: '🎁 ' + tx('daily') }), h('div', { class: 'l3-panel' }, cal), btn], { tab: 'rewards' });
  }
  function confetti(box, n) { var cols = ['#e11d2e', '#ffd166', '#037bdc', '#22c55e', '#ffffff']; for (var i = 0; i < n; i++) box.append(h('i', { class: 'l3-conf', style: { left: Math.random() * 100 + '%', background: cols[i % cols.length], animationDuration: (1.6 + Math.random() * 1.8) + 's', animationDelay: (Math.random() * 0.6) + 's' } })); }
  function collectDaily() {
    var ds = dailyState(); if (!ds.can) return;
    var r = DAILY[ds.cur - 1], D = ds.D;
    D.last = dayKey(0); D.day = ds.cur; D.best = Math.max(D.best || 0, ds.cur === 7 ? 7 : 0, D.streak7 || 0); api.save('daily', D);
    WTG.addCoins && WTG.addCoins(r[0]); if (r[1]) addGems(r[1]); checkAch(); api.sfx('coin');
    var ok = h('button', { type: 'button', class: 'l3-go', text: tx('gotIt') });
    var m = h('div', { class: 'l3-modal' }, h('div', { class: 'l3-burst' }), h('div', { class: 'l3-gift' }, art(ds.cur === 7 ? 'chest' : 'stack', 'top', '🎉'), h('h2', { text: tx('congrats') }), h('div', { class: 'row' }, h('div', null, art('coin', 'ri', '🪙'), document.createTextNode('+' + r[0])), r[1] ? h('div', null, art('gem', 'ri', '💎'), document.createTextNode('+' + r[1])) : null), ok));
    confetti(m, 60); lobby.append(m);
    ok.onclick = function () { flyCoins(m, function () { rewardsScreen(); }); };
  }
  function flyCoins(m, done) {
    var R = root.getBoundingClientRect(), t = coinPill ? coinPill.getBoundingClientRect() : { left: R.right - 80, top: R.top + 10, width: 40, height: 30 };
    for (var i = 0; i < 12; i++) (function (i) {
      var c = h('div', { class: 'l3-flycoin', style: { left: (R.width / 2 - 13 + (Math.random() - 0.5) * 120) + 'px', top: (R.height / 2 + (Math.random() - 0.5) * 80) + 'px' } }); root.append(c);
      c.append(art('coin', 'fc', '🪙'));
      setTimeout(function () { var cr = c.getBoundingClientRect(); c.style.transform = 'translate(' + (t.left + t.width / 2 - cr.left - 13) + 'px,' + (t.top - cr.top) + 'px) scale(.6)'; c.style.opacity = '0.2'; }, 30 + i * 45);
      setTimeout(function () { c.remove(); if (i === 0) api.sfx('coin'); }, 950 + i * 45);
    })(i);
    m.style.transition = 'opacity .3s'; m.style.opacity = '0';
    setTimeout(done, 1000);
  }
  function profileScreen() {
    var avs = h('div', { class: 'l3-avs' });
    AV.forEach(function (a) { avs.append(h('button', { type: 'button', class: a === myAv ? 'on' : '', text: a, 'aria-label': a, onclick: function () { myAv = a; api.save('av', a); profileScreen(); } })); });
    var nameIn = h('input', { class: 'l3-in', maxlength: '14', value: myName, 'aria-label': tx('name'), style: { textAlign: 'center' }, onchange: function () { myName = (this.value || '').replace(/[^\p{L}\p{N} ]/gu, '').trim().slice(0, 14); api.save('name', myName); } });
    var got = api.load('ach', []), achs = h('div', { class: 'l3-achs' });
    ACH.forEach(function (a) { achs.append(h('button', { type: 'button', class: 'l3-ach' + (got.indexOf(a[0]) >= 0 ? '' : ' lock'), title: api.t(a[2]), 'aria-label': api.t(a[2]), text: a[1], onclick: function () { api.toast(a[1] + ' ' + api.t(a[2])); } })); });
    var lv = level(), pct = (xp() % 150) / 150 * 100;
    screen([h('div', { class: 'l3-panel l3-prof' }, h('div', { class: 'l3-av' }, document.createTextNode(myAv), h('span', { class: 'l3-lv', text: tx('level') + ' ' + lv })), nameIn, h('div', { class: 'l3-xp' }, h('i', { style: { width: pct + '%' } })), avs,
      h('div', { class: 'l3-stats' }, [[ST.games, 'games'], [ST.wins, 'wins'], [ST.caps, 'caps'], [ST.home, 'homeN']].map(function (x) { return h('div', null, document.createTextNode(String(x[0])), h('small', { text: tx(x[1]) })); }))),
      h('div', { class: 'l3-panel' }, h('div', { class: 'l3-sub', text: '🏅 ' + tx('ach') + ' ' + got.length + '/' + ACH.length }), achs)], { tab: 'profile' });
  }
  function looksScreen() {
    var box = h('div');
    ['dice', 'tokens', 'board'].forEach(function (cat) {
      var g = h('div', { class: 'l3-shop' });
      SHOP[cat].forEach(function (it) {
        var have = owned.indexOf(it[0]) >= 0, inUse = looks[cat] === it[0], gem = it[4] === 'g';
        g.append(h('button', { type: 'button', class: 'l3-item' + (inUse ? ' use' : ''), onclick: function () {
          if (!have) {
            if ((gem ? gems() : coins()) < it[1]) { api.toast(tx('poor')); api.sfx('bad'); return; }
            if (gem) addGems(-it[1]); else WTG.addCoins(-it[1]); owned.push(it[0]); api.save('owned', owned); api.sfx('coin');
          }
          looks[cat] = it[0]; api.save('looks', looks); applyLooks(); looksScreen();
        } }, h('b', { style: { background: it[3] } }), h('div', { text: api.t(it[2]) }), h('small', { text: inUse ? '✓' : have ? tx('use') : (gem ? '💎 ' : '🪙 ') + it[1] })));
      });
      box.append(h('div', { class: 'l3-panel' }, h('div', { class: 'l3-sub', text: tx(cat) }), g));
    });
    screen([h('div', { class: 'l3-ribbon', text: '🎨 ' + tx('nLooks') }), box], { tab: 'looks' });
  }
  // ------------------------------------------------------------------ 3D art for the menus: rendered once from the game's own dice, tokens, coins and gems
  function makeArt() {
    if (WTG._l3art) return WTG._l3art;
    var out = {};
    try {
      var r = new T.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
      r.setPixelRatio(1); r.outputColorSpace = X.renderer.outputColorSpace; r.toneMapping = X.renderer.toneMapping; r.toneMappingExposure = 1.08; r.setClearColor(0x000000, 0);
      var sc = new T.Scene(); sc.environment = scene.environment;
      var key = new T.DirectionalLight(0xffffff, 2.4); key.position.set(3, 7, 5); sc.add(key);
      var rim = new T.DirectionalLight(0x9fd0ff, 1.2); rim.position.set(-5, 3, -4); sc.add(rim); sc.add(new T.HemisphereLight(0xeaf3ff, 0x1e293b, 0.9));
      var cm = new T.PerspectiveCamera(30, 1, 0.1, 100);
      var diceGeo = new T.RoundedBoxGeometry(0.9, 0.9, 0.9, 5, 0.16);
      function mkDice(skin, e) { var m = new T.Mesh(diceGeo, FACE.map(function (n) { return new T.MeshPhysicalMaterial({ map: pipTex(n, skin), roughness: skin === 'gold' ? 0.25 : 0.18, metalness: skin === 'gold' ? 0.75 : 0, clearcoat: 1, clearcoatRoughness: 0.06 }); })); m.rotation.set(e[0], e[1], e[2]); return m; }
      function mkPawn(c, style, x, z, s) { var m = new T.Mesh(pawnGeo, tokenMat(c, style || 'gloss')); m.position.set(x || 0, 0, z || 0); m.scale.setScalar(s || 1); return m; }
      var coinFace = M.canvasTex(256, 256, function (x, w) {
        var g = x.createRadialGradient(100, 90, 10, 128, 128, 140); g.addColorStop(0, '#fff3b0'); g.addColorStop(0.55, '#f5b301'); g.addColorStop(1, '#b45309'); x.fillStyle = g; x.fillRect(0, 0, w, w);
        x.strokeStyle = 'rgba(120,53,15,.55)'; x.lineWidth = 12; x.beginPath(); x.arc(128, 128, 104, 0, 7); x.stroke();
        x.fillStyle = '#92400e'; x.font = '900 120px Archivo,sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('W', 128, 136); x.fillStyle = '#fff7d6'; x.fillText('W', 124, 130);
      });
      var goldSide = new T.MeshPhysicalMaterial({ color: 0xffbf1f, metalness: 0.45, roughness: 0.28, clearcoat: 1, emissive: 0x8a5a00, emissiveIntensity: 0.35 }), goldFace = new T.MeshPhysicalMaterial({ map: coinFace, metalness: 0.3, roughness: 0.3, clearcoat: 1, emissive: 0xffffff, emissiveMap: coinFace, emissiveIntensity: 0.28 });
      var coinGeo = new T.CylinderGeometry(0.5, 0.5, 0.12, 48);
      function mkCoin(x, y, z, rx, rz) { var m = new T.Mesh(coinGeo, [goldSide, goldFace, goldFace]); m.position.set(x || 0, y || 0, z || 0); m.rotation.set(rx || 0, 0, rz || 0); return m; }
      var gemMat = new T.MeshPhysicalMaterial({ color: 0x22b8ff, metalness: 0.15, roughness: 0.04, clearcoat: 1, iridescence: 0.6, emissive: 0x0b4f8a, emissiveIntensity: 0.35, flatShading: true });
      function mkGem(x, y, z, s) { var g = new T.Group(), top = new T.Mesh(new T.CylinderGeometry(0.3, 0.5, 0.22, 8), gemMat), bot = new T.Mesh(new T.ConeGeometry(0.5, 0.55, 8), gemMat); top.position.y = 0.11; bot.rotation.x = Math.PI; bot.position.y = -0.275; g.add(top, bot); g.position.set(x || 0, y || 0, z || 0); g.scale.setScalar(s || 1); g.rotation.set(0.35, 0.4, 0); return g; }
      function mkGift(col, x, z, s) {
        var g = new T.Group(), box = new T.Mesh(new T.RoundedBoxGeometry(1, 0.8, 1, 4, 0.08), new T.MeshPhysicalMaterial({ color: col, roughness: 0.3, clearcoat: 1 })), lid = new T.Mesh(new T.RoundedBoxGeometry(1.1, 0.24, 1.1, 4, 0.08), box.material);
        var rib = new T.MeshPhysicalMaterial({ color: 0xffd166, metalness: 0.8, roughness: 0.25, clearcoat: 1 });
        box.position.y = 0.4; lid.position.y = 0.88; g.add(box, lid);
        [[1.12, 0.18], [0.18, 1.12]].forEach(function (d) { var b = new T.Mesh(new T.BoxGeometry(d[0], 1.06, d[1]), rib); b.position.y = 0.5; g.add(b); });
        [-1, 1].forEach(function (k) { var t = new T.Mesh(new T.TorusGeometry(0.2, 0.07, 10, 24), rib); t.position.set(k * 0.18, 1.12, 0); t.rotation.set(0, 0, k * 0.7); g.add(t); });
        g.position.set(x || 0, 0, z || 0); g.scale.setScalar(s || 1); g.rotation.y = 0.5; return g;
      }
      function shot(name, w, hh, objs, cp, look) {
        objs.forEach(function (o) { sc.add(o); }); r.setSize(w, hh, false); cm.aspect = w / hh; cm.updateProjectionMatrix();
        cm.position.set(cp[0], cp[1], cp[2]); cm.lookAt(look ? new T.Vector3(look[0], look[1], look[2]) : new T.Vector3(0, 0.35, 0)); r.render(sc, cm);
        out[name] = r.domElement.toDataURL('image/png'); objs.forEach(function (o) { sc.remove(o); });
      }
      var CAM = [0, 2.3, 3.4];
      shot('p2', 320, 240, [mkDice('ivory', [0.5, 0.6, 0.2]), mkPawn(0, 'gloss', -0.95, 0.2), mkPawn(3, 'gloss', 0.95, 0.25)].map(function (o, i) { if (!i) { o.position.set(0, 0.45, -0.15); } return o; }), CAM);
      shot('p4', 320, 240, [mkPawn(0, 'gloss', -1.05, 0.35), mkPawn(1, 'gloss', -0.4, -0.45), mkPawn(2, 'gloss', 0.45, -0.45), mkPawn(3, 'gloss', 1.1, 0.35), (function () { var d = mkDice('ruby', [0.3, 0.8, 0.5]); d.position.set(0, 0.45, 0.45); d.scale.setScalar(0.8); return d; })()], CAM);
      shot('priv', 240, 200, [(function () { var d = mkDice('gold', [0.4, 0.7, 0.1]); d.position.set(-0.35, 0.45, 0); return d; })(), (function () { var d = mkDice('onyx', [1.2, 0.2, 0.6]); d.position.set(0.55, 0.4, 0.35); d.scale.setScalar(0.85); return d; })()], [0, 2, 3]);
      shot('online', 240, 200, [mkPawn(1, 'gem', -0.45, 0), mkPawn(3, 'gem', 0.5, 0.1), mkGem(0, 1.0, -0.3, 0.5)], [0, 2.1, 3.5], [0, 0.5, 0]);
      shot('team', 240, 200, [mkPawn(0, 'metal', -0.55, 0.2), mkPawn(2, 'metal', -0.15, -0.25), mkPawn(1, 'metal', 0.35, -0.25), mkPawn(3, 'metal', 0.75, 0.2)], [0, 2, 3.2], [0.1, 0.4, 0]);
      shot('coin', 96, 96, [mkCoin(0, 0, 0, 1.15, 0.25)], [0, 0.3, 2.1], [0, 0, 0]);
      shot('gem', 96, 96, [mkGem(0, 0.05, 0, 1)], [0, 0.4, 2.1], [0, 0, 0]);
      shot('stack', 200, 160, [mkCoin(-0.3, 0, 0.1), mkCoin(-0.3, 0.13, 0.1), mkCoin(-0.28, 0.26, 0.12), mkCoin(-0.3, 0.39, 0.1), mkCoin(0.45, 0, -0.1), mkCoin(0.45, 0.13, -0.12), mkCoin(0.15, 0.5, 0.45, 1.1, 0.2)], [0, 1.7, 2.6], [0.05, 0.25, 0]);
      shot('stackgem', 200, 160, [mkCoin(-0.45, 0, 0.1), mkCoin(-0.45, 0.13, 0.1), mkCoin(-0.43, 0.26, 0.12), mkGem(0.45, 0.42, 0, 0.8)], [0, 1.7, 2.6], [0, 0.3, 0]);
      shot('gift', 200, 180, [mkGift(0xe11d2e, 0, 0, 0.9)], [0, 2, 3], [0, 0.55, 0]);
      shot('chest', 320, 180, [mkGift(0x037bdc, -0.55, 0, 0.85), mkCoin(0.55, 0, 0.3), mkCoin(0.55, 0.13, 0.3), mkCoin(0.58, 0.26, 0.32), mkGem(0.75, 0.25, -0.35, 0.65)], [0, 2.1, 3.4], [0, 0.5, 0]);
      r.dispose(); if (r.forceContextLoss) r.forceContextLoss();
    } catch (e) { out = {}; }
    WTG._l3art = out; return out;
  }
  function art(name, cls, fb) { var a = makeArt()[name]; return a ? h('img', { class: cls || '', src: a, alt: '', draggable: 'false' }) : h('span', { class: cls || '', text: fb || '' }); }
  function applyLooks() { setBoard(looks.board); setDice(looks.dice); if (S) Object.keys(tokens).forEach(function (k) { var c = +k.split(':')[0]; tokens[k].m.material.dispose(); tokens[k].m.material = tokenMat(c, looks.tokens); }); }

  // ------------------------------------------------------------------ online rooms (friends only: a private code)
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
  function cleanNm(v) { return (v || '').replace(/[^\p{L}\p{N} ]/gu, '').trim().slice(0, 14); }
  function createRoom(errEl) {
    server().then(function (u) { return fetch(u + '/new', { method: 'POST' }).then(function (r) { return r.json(); }); }).then(function (j) { if (!j.code) throw 0; connect(j.code, true); })
      .catch(function () { if (errEl) errEl.textContent = tx('noServer'); else api.toast(tx('noServer'), 2600); });
  }
  function friendsScreen(joinCode) {
    var nameIn = h('input', { class: 'l3-in', maxlength: '14', value: myName, placeholder: tx('name'), 'aria-label': tx('name'), autocomplete: 'off' });
    var codeIn = h('input', { class: 'l3-in', maxlength: '6', value: joinCode || '', placeholder: 'ABC123', 'aria-label': tx('code'), autocomplete: 'off', style: { textTransform: 'uppercase', letterSpacing: '.2em', textAlign: 'center', fontSize: '20px' } });
    var err = h('div', { class: 'l3-err' });
    function nm() { myName = cleanNm(nameIn.value); api.save('name', myName); }
    var fr = api.load('friends', []);
    screen([h('div', { class: 'l3-ribbon', text: '👥 ' + tx('nFriends') }),
      h('div', { class: 'l3-panel' }, h('div', { class: 'l3-inv' }, h('span', { class: 'ic', text: '🎲' }), h('span', { text: tx('invite') })), h('div', { style: { marginTop: '10px' } }, nameIn),
        h('button', { type: 'button', class: 'l3-go full', text: tx('inviteBtn'), onclick: function () { nm(); err.textContent = ''; createRoom(err); } })),
      h('div', { class: 'l3-panel' }, h('div', { class: 'l3-sub', text: '🔑 ' + tx('joinCode') }), codeIn,
        h('button', { type: 'button', class: 'l3-go red full', text: tx('join'), onclick: function () { nm(); var c = (codeIn.value || '').toUpperCase().replace(/[^A-Z0-9]/g, ''); if (c.length !== 6) { err.textContent = tx('err_noroom'); return; } server().then(function () { connect(c, false); }).catch(function () { err.textContent = tx('noServer'); }); } })),
      err,
      fr.length ? h('div', { class: 'l3-panel' }, h('div', { class: 'l3-sub', text: tx('recent') }), h('div', { class: 'l3-fr' }, fr.map(function (n) { return h('span', { text: '👤 ' + n }); }))) : null
    ], { tab: 'friends' });
  }
  function connect(code, host) {
    if (net) net.close();
    role = host ? 'host' : 'guest'; net = new Net(code, host); emoBar.hidden = false;
    var openSeats = api.load('onlineSeats', ['o', 'o', 'o', 'o']);
    var list = h('div', { class: 'l3-seats' }), err = h('div', { class: 'l3-err' });
    function lobbyView() {
      var share = h('button', { type: 'button', class: 'l3-go blue full', text: tx('share'), onclick: function () {
        var u = link(code), t = (SO ? 'Kaalay aan ciyaarno Afarta Guri! Koodh: ' : 'Join my Four Homes game! Code: ') + code;
        if (navigator.share) navigator.share({ title: 'Four Homes', text: t, url: u }).catch(function () {}); else try { navigator.clipboard.writeText(t + ' ' + u); api.toast(tx('copied')); } catch (e) {}
      } });
      var kids = [h('div', { class: 'l3-panel' }, h('div', { class: 'l3-sub', text: '🎲 ' + tx('code') }), h('div', { class: 'l3-code', text: code }), share), h('div', { class: 'l3-panel' }, h('div', { class: 'l3-sub', text: tx('friends') }), list), err];
      if (host) kids.push(h('button', { type: 'button', class: 'l3-go full', text: tx('go'), onclick: function () { startOnline(); } })); else kids.push(h('div', { class: 'l3-sub', style: { marginTop: '12px' }, text: '⏳ ' + tx('waitHost') }));
      screen(kids, { keepRole: true, nav: false, head: head(tx('privateT'), function () { if (net) { net.close(); net = null; } friendsScreen(); }) });
      drawList();
    }
    function seatPlan() {
      var people = (net.peers || []).filter(function (p) { return !p.away; }), seats = [], c = 0;
      people.slice(0, 4).forEach(function (p) { seats.push({ c: c, kind: 'o', pid: p.pid, name: p.name }); c++; });
      for (; c < 4; c++) if (openSeats[c] === 'r') seats.push({ c: c, kind: 'r' });
      if (seats.length === 2 && seats[1].c === 1) seats[1].c = 2;
      return seats;
    }
    function drawList() {
      list.innerHTML = ''; var people = (net.peers || []).filter(function (p) { return !p.away; });
      for (var c = 0; c < 4; c++) (function (c) {
        var p = people[c];
        if (p) list.append(h('div', { class: 'l3-seat' }, h('i', { style: { background: CSS[c] }, text: p.pid === myPid ? myAv : SEATAV[c] }), h('span', { text: p.name + (p.host ? ' 👑' : '') + (p.pid === myPid ? ' (' + tx('you') + ')' : '') })));
        else list.append(h('button', { type: 'button', class: 'l3-seat' + (openSeats[c] === 'r' ? '' : ' off'), disabled: !host, onclick: function () { openSeats[c] = openSeats[c] === 'r' ? 'o' : 'r'; api.save('onlineSeats', openSeats); drawList(); } }, h('i', { style: { background: CSS[c] }, text: openSeats[c] === 'r' ? '🤖' : '' }), h('span', { text: openSeats[c] === 'r' ? tx('robot') : '⏳ …' })));
      })(c);
    }
    function startOnline() { var seats = seatPlan(); if (seats.length < 2) { err.textContent = tx('needTwo'); return; } begin(seats, { mode: setup.mode }); }
    net.on = function (m) {
      if (m.t === 'peers') {
        net.peers = m.peers; if (lobby) drawList(); if (S && role === 'host') renderHud();
        var fr = api.load('friends', []); (m.peers || []).forEach(function (p) { if (p.pid !== myPid && p.name && fr.indexOf(p.name) < 0) fr.unshift(p.name); }); api.save('friends', fr.slice(0, 12));
      }
      else if (m.t === 'state' && role === 'guest') {
        var prev = S, s = m.s; if (!s || !s.seats) return;
        if (!prev || prev.seats.length !== s.seats.length || (prev.over && !s.over) || s.seq < prev.seq) { S = s; finished = false; shown = {}; buildTokens(S); Object.keys(tokens).forEach(function (k) { var c = +k.split(':')[0], i = +k.split(':')[1]; tokens[k].pr = S.tok[c][i]; }); orient(); layoutIdle(); Object.keys(tokens).forEach(function (k) { tokens[k].g.position.copy(tokens[k].target); }); closeLobby(); buildPanels(); setHighlight(); renderHud(); if (S.over) finish(); return; }
        S = s; changed(prev); if (!busy()) after();
      }
      else if (m.t === 'act') remoteAct(m.from, m.a);
      else if (m.t === 'emote') popEmote(m.e);
      else if (m.t === 'joined' && S && role === 'host') net.send({ t: 'state', s: S });
      else if (m.t === 'err') { net.fatal = /noroom|full|started|kicked|replaced/.test(m.e); if (m.e === 'replaced') return; var t = tx('err_' + m.e); if (lobby || !S) { friendsScreen(code); var e2 = lobby && lobby.querySelector('.l3-err'); if (e2) e2.textContent = t; } else api.toast(t, 3000); }
      else if (m.t === 'down') { if (S) api.toast(tx('err_conn'), 2000); }
    };
    lobbyView();
  }

  // ------------------------------------------------------------------ camera and frame loop
  function placeCam() {
    var portrait = X.H > X.W * 1.05, top = flat();
    if (top) {
      // straight down; the board fills the width on a phone and leaves room above and below for the players
      var vf = cam.fov * Math.PI / 360, W = X.W, H = X.H;
      var P = portrait ? Math.min(W * 0.98, H - 214) : Math.min(H * 0.95, W - 260), topPx = portrait ? 114 + (H - 214 - P) / 2 : (H - P) / 2;
      var upp = 16.2 / P, dist = H * upp / (2 * Math.tan(vf)), tz = -((topPx + P / 2) - H / 2) * upp;
      cam.position.set(0, dist, tz + dist * 0.035); cam.lookAt(0, 0, tz);
    }
    else {
      // fit the whole board (with its frame) in the view, whatever the screen shape; leave room for the players around it
      var a = X.W / Math.max(1, X.H), vf = cam.fov * Math.PI / 360, hf = Math.atan(Math.tan(vf) * a);
      var dist = Math.max(9.4 / Math.tan(hf), (portrait ? 10.2 : 11.4) / Math.tan(vf)) * 1.02, dir = new T.Vector3(0, 0.79, 0.61).normalize();
      cam.position.copy(dir.multiplyScalar(dist)); cam.lookAt(0, -0.4, portrait ? 0.9 : 0.6);
    }
    placePanels();
  }
  X.onResize = placeCam; placeCam();
  X.cv.wtgState = function () { return { S: S, busy: busy(), dice: !!DA, hops: hops.length, timer: !!timer, role: role, lobby: !!lobby }; };   // for tests
  applyLooks();
  return {
    start: function () {
      var q = new URLSearchParams(location.search).get('room');
      var first = function () { if (q && api.first) friendsScreen(q.toUpperCase()); else homeScreen(); };
      if (!WTG._l3splash) { WTG._l3splash = 1; first(); splash(function () {}); } else first();
      api.loop(function (dt) {
        tt += dt; stepDice(dt); stepTokens(dt);
        highlight.forEach(function (k) { var r = tokens[k].g.userData.ring; r.scale.setScalar(1 + Math.sin(tt * 6) * 0.12); r.material.opacity = 0.6 + Math.sin(tt * 6) * 0.3; tokens[k].g.position.y = TOP + Math.abs(Math.sin(tt * 4)) * 0.12; });
        fxs = fxs.filter(function (f) { return f(dt); });
        world.rotation.y += (yaw - world.rotation.y) * Math.min(1, dt * 4);
        if (!lobby) X.render(); else if ((tt * 10 | 0) % 6 === 0) X.render();
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
