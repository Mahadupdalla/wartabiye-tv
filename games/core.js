/*! © 2026 Wartabiye TV. All Rights Reserved. */
/* Wartabiye TV Games: the shared game player.
   Every game lives in games/g/<engine>.js and is loaded only when someone opens it. A game registers itself with
   WTG.register(engine, factory). The player gives the game a stage, a score counter, sound, saving and the
   Start / Pause / Resume / Restart / Sound / Help controls, so every game behaves the same way.
   Nothing here talks to any server: scores, progress and profiles stay in this browser (localStorage). */
(function () {
  'use strict';
  var WTG = window.WTG = window.WTG || {};
  var engines = {}, waiting = {};
  // every game file in games/g/ (a game in data/games.json with any other engine is not shown)
  WTG.ENGINES = ['blocks', 'brain', 'builder', 'checkers', 'chess', 'coloring', 'crossword', 'dominoes', 'draw', 'four', 'hoops', 'hoops3d', 'kidsquiz', 'ludo', 'ludo3d', 'maze', 'memory', 'merge', 'pairs', 'parking', 'penalty', 'penalty3d', 'racer', 'racer3d', 'reaction', 'runner', 'runner3d', 'shapes', 'slide', 'snake', 'solitaire', 'spell', 'sudoku', 'tiles', 'trivia', 'wordsearch'];
  WTG.register = function (id, factory) { engines[id] = factory; (waiting[id] || []).forEach(function (f) { f(); }); delete waiting[id]; };

  // ------------------------------------------------------------------ language
  var LANGS = ['so', 'en', 'ar', 'fr', 'nl', 'it', 'de', 'tr', 'es'];
  function pickLang() {
    var l = '';
    try { l = new URLSearchParams(location.search).get('lang') || localStorage.getItem('wartabiye-lang') || ''; } catch (e) {}
    return LANGS.indexOf(l) >= 0 ? l : 'so';
  }
  WTG.lang = pickLang();
  // shell words in every site language
  var S = {
    so: { start: 'Bilow', pause: 'Jooji', resume: 'Sii wad', restart: 'Dib u bilow', sound: 'Codka', help: 'Sida loo ciyaaro', level: 'Heerka', easy: 'Fudud', medium: 'Dhexdhexaad', hard: 'Adag', score: 'Dhibcaha', best: 'Ugu fiican', paused: 'Waa la joojiyay', over: 'Ciyaartu way dhammaatay', win: 'Waad guuleysatay!', again: 'Mar kale ciyaar', exit: 'Ka bax', newBest: 'Dhibco cusub oo ugu fiican!', ach: 'Abaalmarin cusub', loading: 'Waa la soo rarayaa…', fail: 'Ciyaarta lama soo rarin. Hubi internetka oo isku day mar kale.', retry: 'Isku day mar kale', saved: 'Horumarkaaga waa la kaydiyay', controls: 'Kontaroolada', twoPlayer: '2 qof (isla qalab)', vsCpu: 'Kombiyuutar', mode: 'Qaabka', settings: 'Habaynta', thisGame: 'Ciyaartan', allGames: 'Dhammaan ciyaaraha', volume: 'Heerka codka', voice: 'Akhris cod ah', vibration: 'Gariir', textSize: 'Cabbirka qoraalka', calm: 'Dhaqdhaqaaq yar', graphics: 'Tayada sawirka (3D)', auto: 'Iskiis', low: 'Hoose', high: 'Sare', on: 'Shid', off: 'Dami', apply: 'Kaydi oo ciyaar', reset: 'Dib u celi', cancel: 'Ka noqo', appliedNext: 'Habayntu waxay shaqaynaysaa ciyaarta xigta' },
    en: { start: 'Start', pause: 'Pause', resume: 'Resume', restart: 'Restart', sound: 'Sound', help: 'How to play', level: 'Difficulty', easy: 'Easy', medium: 'Medium', hard: 'Hard', score: 'Score', best: 'Best', paused: 'Paused', over: 'Game over', win: 'You win!', again: 'Play again', exit: 'Exit', newBest: 'New best score!', ach: 'Achievement unlocked', loading: 'Loading…', fail: 'The game could not load. Check your connection and try again.', retry: 'Try again', saved: 'Progress saved', controls: 'Controls', twoPlayer: '2 players (same device)', vsCpu: 'vs computer', mode: 'Mode', settings: 'Settings', thisGame: 'This game', allGames: 'All games', volume: 'Volume', voice: 'Read aloud', vibration: 'Vibration', textSize: 'Text size', calm: 'Less motion', graphics: 'Graphics (3D)', auto: 'Auto', low: 'Low', high: 'High', on: 'On', off: 'Off', apply: 'Save and play', reset: 'Reset', cancel: 'Cancel', appliedNext: 'Settings apply from the next game' },
    ar: { start: 'ابدأ', pause: 'إيقاف مؤقت', resume: 'متابعة', restart: 'إعادة', sound: 'الصوت', help: 'طريقة اللعب', level: 'الصعوبة', easy: 'سهل', medium: 'متوسط', hard: 'صعب', score: 'النقاط', best: 'الأفضل', paused: 'متوقفة مؤقتًا', over: 'انتهت اللعبة', win: 'لقد فزت!', again: 'العب مجددًا', exit: 'خروج', newBest: 'أفضل نتيجة جديدة!', ach: 'إنجاز جديد', loading: 'جارٍ التحميل…', fail: 'تعذّر تحميل اللعبة. تحقق من الاتصال وحاول مجددًا.', retry: 'حاول مجددًا', saved: 'تم حفظ التقدم', controls: 'التحكم', twoPlayer: 'لاعبان (نفس الجهاز)', vsCpu: 'ضد الكمبيوتر', mode: 'الوضع', settings: 'الإعدادات', thisGame: 'هذه اللعبة', allGames: 'كل الألعاب', volume: 'مستوى الصوت', voice: 'القراءة بصوت', vibration: 'الاهتزاز', textSize: 'حجم النص', calm: 'حركة أقل', graphics: 'الرسومات (3D)', auto: 'تلقائي', low: 'منخفضة', high: 'عالية', on: 'تشغيل', off: 'إيقاف', apply: 'حفظ واللعب', reset: 'إعادة الضبط', cancel: 'إلغاء', appliedNext: 'تُطبَّق الإعدادات من اللعبة التالية' },
    fr: { start: 'Jouer', pause: 'Pause', resume: 'Reprendre', restart: 'Recommencer', sound: 'Son', help: 'Comment jouer', level: 'Difficulté', easy: 'Facile', medium: 'Moyen', hard: 'Difficile', score: 'Score', best: 'Record', paused: 'En pause', over: 'Partie terminée', win: 'Gagné !', again: 'Rejouer', exit: 'Quitter', newBest: 'Nouveau record !', ach: 'Succès débloqué', loading: 'Chargement…', fail: 'Le jeu n’a pas pu se charger. Vérifiez la connexion et réessayez.', retry: 'Réessayer', saved: 'Progression enregistrée', controls: 'Commandes', twoPlayer: '2 joueurs (même appareil)', vsCpu: 'contre l’ordinateur', mode: 'Mode', settings: 'Réglages', thisGame: 'Ce jeu', allGames: 'Tous les jeux', volume: 'Volume', voice: 'Lecture à voix haute', vibration: 'Vibration', textSize: 'Taille du texte', calm: 'Moins d’animations', graphics: 'Graphismes (3D)', auto: 'Auto', low: 'Bas', high: 'Élevé', on: 'Oui', off: 'Non', apply: 'Enregistrer et jouer', reset: 'Réinitialiser', cancel: 'Annuler', appliedNext: 'Les réglages s’appliquent à la prochaine partie' },
    nl: { start: 'Start', pause: 'Pauze', resume: 'Verder', restart: 'Opnieuw', sound: 'Geluid', help: 'Speluitleg', level: 'Niveau', easy: 'Makkelijk', medium: 'Gemiddeld', hard: 'Moeilijk', score: 'Score', best: 'Beste', paused: 'Gepauzeerd', over: 'Spel voorbij', win: 'Gewonnen!', again: 'Nog een keer', exit: 'Stoppen', newBest: 'Nieuwe topscore!', ach: 'Prestatie behaald', loading: 'Laden…', fail: 'Het spel kon niet laden. Controleer de verbinding en probeer opnieuw.', retry: 'Opnieuw proberen', saved: 'Voortgang opgeslagen', controls: 'Besturing', twoPlayer: '2 spelers (zelfde apparaat)', vsCpu: 'tegen de computer', mode: 'Modus', settings: 'Instellingen', thisGame: 'Dit spel', allGames: 'Alle spellen', volume: 'Volume', voice: 'Voorlezen', vibration: 'Trillen', textSize: 'Tekstgrootte', calm: 'Minder beweging', graphics: 'Graphics (3D)', auto: 'Auto', low: 'Laag', high: 'Hoog', on: 'Aan', off: 'Uit', apply: 'Opslaan en spelen', reset: 'Herstellen', cancel: 'Annuleren', appliedNext: 'Instellingen gelden vanaf het volgende spel' },
    it: { start: 'Gioca', pause: 'Pausa', resume: 'Riprendi', restart: 'Ricomincia', sound: 'Audio', help: 'Come si gioca', level: 'Difficoltà', easy: 'Facile', medium: 'Media', hard: 'Difficile', score: 'Punti', best: 'Record', paused: 'In pausa', over: 'Partita finita', win: 'Hai vinto!', again: 'Gioca ancora', exit: 'Esci', newBest: 'Nuovo record!', ach: 'Obiettivo sbloccato', loading: 'Caricamento…', fail: 'Il gioco non si è caricato. Controlla la connessione e riprova.', retry: 'Riprova', saved: 'Progressi salvati', controls: 'Comandi', twoPlayer: '2 giocatori (stesso dispositivo)', vsCpu: 'contro il computer', mode: 'Modalità', settings: 'Impostazioni', thisGame: 'Questo gioco', allGames: 'Tutti i giochi', volume: 'Volume', voice: 'Lettura ad alta voce', vibration: 'Vibrazione', textSize: 'Dimensione testo', calm: 'Meno animazioni', graphics: 'Grafica (3D)', auto: 'Auto', low: 'Bassa', high: 'Alta', on: 'Sì', off: 'No', apply: 'Salva e gioca', reset: 'Ripristina', cancel: 'Annulla', appliedNext: 'Le impostazioni valgono dalla prossima partita' },
    de: { start: 'Start', pause: 'Pause', resume: 'Weiter', restart: 'Neu starten', sound: 'Ton', help: 'Spielanleitung', level: 'Schwierigkeit', easy: 'Leicht', medium: 'Mittel', hard: 'Schwer', score: 'Punkte', best: 'Rekord', paused: 'Pausiert', over: 'Spiel vorbei', win: 'Gewonnen!', again: 'Nochmal spielen', exit: 'Beenden', newBest: 'Neuer Rekord!', ach: 'Erfolg freigeschaltet', loading: 'Lädt…', fail: 'Das Spiel konnte nicht geladen werden. Verbindung prüfen und erneut versuchen.', retry: 'Erneut versuchen', saved: 'Fortschritt gespeichert', controls: 'Steuerung', twoPlayer: '2 Spieler (gleiches Gerät)', vsCpu: 'gegen den Computer', mode: 'Modus', settings: 'Einstellungen', thisGame: 'Dieses Spiel', allGames: 'Alle Spiele', volume: 'Lautstärke', voice: 'Vorlesen', vibration: 'Vibration', textSize: 'Textgröße', calm: 'Weniger Bewegung', graphics: 'Grafik (3D)', auto: 'Auto', low: 'Niedrig', high: 'Hoch', on: 'An', off: 'Aus', apply: 'Speichern und spielen', reset: 'Zurücksetzen', cancel: 'Abbrechen', appliedNext: 'Einstellungen gelten ab dem nächsten Spiel' },
    tr: { start: 'Başla', pause: 'Duraklat', resume: 'Devam', restart: 'Yeniden başla', sound: 'Ses', help: 'Nasıl oynanır', level: 'Zorluk', easy: 'Kolay', medium: 'Orta', hard: 'Zor', score: 'Puan', best: 'En iyi', paused: 'Duraklatıldı', over: 'Oyun bitti', win: 'Kazandın!', again: 'Tekrar oyna', exit: 'Çık', newBest: 'Yeni rekor!', ach: 'Başarı kazanıldı', loading: 'Yükleniyor…', fail: 'Oyun yüklenemedi. Bağlantını kontrol edip tekrar dene.', retry: 'Tekrar dene', saved: 'İlerleme kaydedildi', controls: 'Kontroller', twoPlayer: '2 oyuncu (aynı cihaz)', vsCpu: 'bilgisayara karşı', mode: 'Mod', settings: 'Ayarlar', thisGame: 'Bu oyun', allGames: 'Tüm oyunlar', volume: 'Ses düzeyi', voice: 'Sesli okuma', vibration: 'Titreşim', textSize: 'Yazı boyutu', calm: 'Daha az hareket', graphics: 'Grafik (3D)', auto: 'Otomatik', low: 'Düşük', high: 'Yüksek', on: 'Açık', off: 'Kapalı', apply: 'Kaydet ve oyna', reset: 'Sıfırla', cancel: 'Vazgeç', appliedNext: 'Ayarlar bir sonraki oyunda geçerli olur' },
    es: { start: 'Jugar', pause: 'Pausa', resume: 'Continuar', restart: 'Reiniciar', sound: 'Sonido', help: 'Cómo jugar', level: 'Dificultad', easy: 'Fácil', medium: 'Media', hard: 'Difícil', score: 'Puntos', best: 'Récord', paused: 'En pausa', over: 'Fin del juego', win: '¡Has ganado!', again: 'Jugar otra vez', exit: 'Salir', newBest: '¡Nuevo récord!', ach: 'Logro desbloqueado', loading: 'Cargando…', fail: 'No se pudo cargar el juego. Revisa la conexión e inténtalo de nuevo.', retry: 'Reintentar', saved: 'Progreso guardado', controls: 'Controles', twoPlayer: '2 jugadores (mismo dispositivo)', vsCpu: 'contra el ordenador', mode: 'Modo', settings: 'Ajustes', thisGame: 'Este juego', allGames: 'Todos los juegos', volume: 'Volumen', voice: 'Lectura en voz alta', vibration: 'Vibración', textSize: 'Tamaño del texto', calm: 'Menos movimiento', graphics: 'Gráficos (3D)', auto: 'Auto', low: 'Baja', high: 'Alta', on: 'Sí', off: 'No', apply: 'Guardar y jugar', reset: 'Restablecer', cancel: 'Cancelar', appliedNext: 'Los ajustes se aplican desde la próxima partida' }
  };
  WTG.S = S;
  WTG.s = function (k) { return (S[WTG.lang] && S[WTG.lang][k]) || S.en[k] || k; };
  // game text: {so, en, ar, …} or a plain string. Falls back to English, then Somali.
  WTG.t = function (o) {
    if (o == null) return '';
    if (typeof o !== 'object') return String(o);
    return o[WTG.lang] || o.en || o.so || '';
  };

  // ------------------------------------------------------------------ storage (this browser only)
  function lsGet(k, d) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }
  function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } }
  WTG.lsGet = lsGet; WTG.lsSet = lsSet;

  var AVATARS = ['🦁', '🐯', '🐼', '🦊', '🐨', '🐸', '🦉', '🐬', '🚀', '⚽', '🏀', '⭐', '🌙', '🐪', '🦒', '🐢'];
  WTG.AVATARS = AVATARS;
  function profiles() {
    var P = lsGet('wtg-profiles', null);
    if (!P || !P.list || !P.list.length) { P = { current: 'p1', list: [{ id: 'p1', name: WTG.lang === 'so' ? 'Ciyaaryahan' : 'Player', avatar: '🦁', created: Date.now() }] }; lsSet('wtg-profiles', P); }
    if (!P.list.some(function (p) { return p.id === P.current; })) P.current = P.list[0].id;
    return P;
  }
  WTG.profiles = profiles;
  WTG.saveProfiles = function (P) { lsSet('wtg-profiles', P); };
  WTG.me = function () { var P = profiles(); return P.list.filter(function (p) { return p.id === P.current; })[0]; };
  function blank() { return { best: {}, plays: {}, wins: {}, last: {}, fav: [], ach: {}, daily: {}, total: 0, saves: {} }; }
  WTG.data = function (pid) { var d = lsGet('wtg-p-' + (pid || profiles().current), null) || blank(); var b = blank(); for (var k in b) if (d[k] == null) d[k] = b[k]; return d; };
  WTG.saveData = function (d, pid) { lsSet('wtg-p-' + (pid || profiles().current), d); };
  WTG.update = function (fn) { var d = WTG.data(); fn(d); WTG.saveData(d); return d; };
  // play-coins: earned by playing, spent only on looks inside games. Not money: they cannot be bought or cashed out.
  WTG.coins = function () { return Math.max(0, WTG.data().coins || 0); };
  WTG.addCoins = function (n) { var d = WTG.update(function (D) { D.coins = Math.max(0, Math.min(999999, (D.coins || 0) + Math.round(n || 0))); }); return d.coins; };

  // ------------------------------------------------------------------ sound (synthesised: no files to download)
  // player preferences for all games (this device only)
  var GP0 = { vol: 100, voice: true, vib: true, text: 1, calm: false, gfx: 'auto' };
  WTG.gprefs = function () { var g = lsGet('wtg-prefs', {}) || {}, o = {}; for (var k in GP0) o[k] = k in g ? g[k] : GP0[k]; return o; };
  WTG.setGprefs = function (o) { lsSet('wtg-prefs', o); };
  WTG.GP0 = GP0;
  function vibe(ms) { try { if (WTG.gprefs().vib && navigator.vibrate) navigator.vibrate(ms); } catch (e) {} }
  WTG.vibe = vibe;
  var VIB = { bad: 60, hit: 90, lose: [80, 60, 120], win: [30, 40, 30] };
  var actx = null, muted = lsGet('wtg-muted', false);
  WTG.muted = function () { return muted; };
  WTG.setMuted = function (m) { muted = !!m; lsSet('wtg-muted', muted); };
  var SFX = {
    tap: [[660, 0.05, 'square', 0.05]], move: [[440, 0.06, 'triangle', 0.08]], good: [[660, 0.08, 'sine', 0.12], [880, 0.1, 'sine', 0.12]],
    bad: [[220, 0.15, 'sawtooth', 0.08]], coin: [[988, 0.06, 'square', 0.06], [1319, 0.12, 'square', 0.06]], jump: [[330, 0.12, 'triangle', 0.1, 660]],
    win: [[523, 0.12, 'sine', 0.12], [659, 0.12, 'sine', 0.12], [784, 0.12, 'sine', 0.12], [1047, 0.3, 'sine', 0.12]],
    lose: [[392, 0.15, 'triangle', 0.1], [330, 0.15, 'triangle', 0.1], [262, 0.35, 'triangle', 0.1]],
    hit: [[150, 0.12, 'square', 0.1, 60]], pop: [[800, 0.04, 'sine', 0.1, 1200]], tick: [[1200, 0.02, 'square', 0.03]]
  };
  WTG.sfx = function (name) {
    if (VIB[name]) vibe(VIB[name]);
    var vol = WTG.gprefs().vol / 100;
    if (muted || !vol) return;
    try {
      if (!actx) { var AC = window.AudioContext || window.webkitAudioContext; if (!AC) return; actx = new AC(); }
      if (actx.state === 'suspended') actx.resume();
      var t = actx.currentTime;
      (SFX[name] || SFX.tap).forEach(function (n) {
        var o = actx.createOscillator(), g = actx.createGain();
        o.type = n[2]; o.frequency.setValueAtTime(n[0], t);
        if (n[4]) o.frequency.exponentialRampToValueAtTime(n[4], t + n[1]);
        g.gain.setValueAtTime(Math.max(0.0002, n[3] * vol), t); g.gain.exponentialRampToValueAtTime(0.0001, t + n[1]);
        o.connect(g); g.connect(actx.destination); o.start(t); o.stop(t + n[1] + 0.02);
        t += n[1] * 0.9;
      });
    } catch (e) {}
  };
  // children's games can read a word aloud (the device's own voice; nothing is downloaded)
  WTG.say = function (text, lang) {
    if (muted || !WTG.gprefs().voice || !window.speechSynthesis || !text) return;
    try { speechSynthesis.cancel(); var u = new SpeechSynthesisUtterance(text); u.lang = lang || (WTG.lang === 'so' ? 'so-SO' : WTG.lang); u.rate = 0.85; speechSynthesis.speak(u); } catch (e) {}
  };

  // ------------------------------------------------------------------ small DOM helper
  function h(tag, attrs) {
    var el = document.createElement(tag);
    if (attrs) for (var k in attrs) {
      var v = attrs[k];
      if (v == null || v === false) continue;
      if (k === 'text') el.textContent = v;
      else if (k === 'html') el.innerHTML = v;
      else if (k.slice(0, 2) === 'on' && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else if (k === 'style' && typeof v === 'object') { for (var sk in v) { if (sk.slice(0, 2) === '--') el.style.setProperty(sk, v[sk]); else el.style[sk] = v[sk]; } }
      else el.setAttribute(k, v === true ? '' : v);
    }
    for (var i = 2; i < arguments.length; i++) {
      var c = arguments[i];
      if (c == null || c === false) continue;
      if (Array.isArray(c)) c.forEach(function (x) { if (x != null && x !== false) el.append(x); }); else el.append(c);
    }
    return el;
  }
  WTG.h = h;
  WTG.rand = function (a, b) { return Math.floor(Math.random() * (b - a + 1)) + a; };
  WTG.shuffle = function (a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; } return a; };
  WTG.pick = function (a) { return a[Math.floor(Math.random() * a.length)]; };
  WTG.fmtTime = function (s) { s = Math.max(0, Math.floor(s)); return Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2); };

  // ------------------------------------------------------------------ loading a game file
  var VER = (document.currentScript && (document.currentScript.src.split('?v=')[1] || '')) || '';
  // 3D games: the shared toolkit (three.js subset) is loaded once, only when a 3D game is opened
  var w3d = null;
  WTG.w3d = function () { return w3d || (w3d = import('./vendor/w3d.js' + (VER ? '?v=' + VER : '')).catch(function (e) { w3d = null; throw e; })); };
  WTG.webgl = function () { try { var c = document.createElement('canvas'); return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl'))); } catch (e) { return false; } };
  // a 3D game file calls WTG.register3d(id, factory(M, api)); if the toolkit cannot load, the player shows the retry screen
  WTG.register3d = function (id, factory) {
    WTG.w3d().then(function (M) { WTG.register(id, function (api) { return factory(M, api); }); }, function () { (waiting[id] || []).forEach(function (f) { f(true); }); delete waiting[id]; delete engines[id]; var sc = document.querySelector('script[data-engine="' + id + '"]'); if (sc) sc.remove(); });
  };
  WTG.load = function (engine) {
    return new Promise(function (ok, bad) {
      if (engines[engine]) return ok(engines[engine]);
      if (!/^[a-z0-9-]{1,40}$/.test(engine)) return bad(new Error('bad engine'));
      (waiting[engine] = waiting[engine] || []).push(function (failed) { if (failed) bad(new Error('3d')); else ok(engines[engine]); });
      if (document.querySelector('script[data-engine="' + engine + '"]')) return;
      var s = document.createElement('script');
      s.src = 'g/' + engine + '.js' + (VER ? '?v=' + VER : '');
      s.async = true; s.dataset.engine = engine;
      s.onerror = function () { s.remove(); delete waiting[engine]; bad(new Error('load failed')); };
      document.head.append(s);
    });
  };

  // ------------------------------------------------------------------ the player
  var ICON = {
    pause: '<path d="M8 5v14M16 5v14"/>', play: '<path d="M7 4.5v15l12-7.5z"/>', restart: '<path d="M4 12a8 8 0 1 0 2.4-5.7"/><path d="M4 4v4.5h4.5"/>',
    sound: '<path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/>', mute: '<path d="M4 9v6h4l5 4V5L8 9z"/><path d="M17 9l5 6M22 9l-5 6"/>',
    help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6v.6M12 17h.01"/>', back: '<path d="M15 5l-7 7 7 7"/>',
    full: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>', gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>', star: '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>'
  };
  function ic(n) { return '<svg viewBox="0 0 24 24" aria-hidden="true">' + ICON[n] + '</svg>'; }
  WTG.ic = ic;

  var cur = null;   // the open game
  WTG.current = function () { return cur; };

  // open(game, {onExit, onResult}) — game is one entry of data/games.json
  WTG.open = function (game, hooks) {
    if (cur) WTG.close(true);
    hooks = hooks || {};
    var s = WTG.s, t = WTG.t;
    // a 3D game names a 2D engine in "fallback" for devices without WebGL
    var engine = game.fallback && WTG.ENGINES.indexOf(game.fallback) >= 0 && !WTG.webgl() ? game.fallback : game.engine;
    var levels = game.levels === false ? null : ['easy', 'medium', 'hard'];
    var lvKey = 'wtg-level-' + game.id;
    var level = lsGet(lvKey, game.defaultLevel || (game.cats && game.cats.indexOf('kids') >= 0 && game.cats.length === 1 ? 'easy' : 'medium'));
    if (levels && levels.indexOf(level) < 0) level = 'medium';
    // game settings: WTG.PREFS[engine] lists them (games/prefs.js); values are saved per game on this device
    var cfgKey = 'wtg-cfg-' + game.id, cfg = lsGet(cfgKey, {}) || {};
    function prefList() { var L = (WTG.PREFS && (WTG.PREFS[engine] || WTG.PREFS[game.engine])) || []; return typeof L === 'function' ? L(game) : L; }
    function prefVal(P) { var v = P.k in cfg ? cfg[P.k] : P.d; return P.v.some(function (o) { return o[0] === v; }) ? v : P.d; }
    var D0 = WTG.data();
    var state = { game: game, score: 0, best: D0.best[game.id] || 0, running: false, paused: false, over: false, inst: null, loops: [], timers: [], canvases: [] };

    var scoreEl = h('b', { class: 'wtg-num', text: '0' }), bestEl = h('b', { class: 'wtg-num', text: String(state.best) });
    var extraEl = h('span', { class: 'wtg-extra', hidden: true });
    var pauseBtn = h('button', { type: 'button', class: 'wtg-ib', 'aria-label': s('pause'), title: s('pause'), html: ic('pause'), onclick: function () { state.paused ? resume() : pause(); } });
    var soundBtn = h('button', { type: 'button', class: 'wtg-ib', 'aria-pressed': String(!muted), 'aria-label': s('sound'), title: s('sound'), html: ic(muted ? 'mute' : 'sound'), onclick: function () { WTG.setMuted(!muted); soundBtn.innerHTML = ic(muted ? 'mute' : 'sound'); soundBtn.setAttribute('aria-pressed', String(!muted)); if (state.inst && state.inst.sound) state.inst.sound(!muted); } });
    var restartBtn = h('button', { type: 'button', class: 'wtg-ib', 'aria-label': s('restart'), title: s('restart'), html: ic('restart'), onclick: function () { restart(); } });
    var gearBtn = h('button', { type: 'button', class: 'wtg-ib', 'aria-label': s('settings'), title: s('settings'), html: ic('gear'), onclick: function () { settings(); } });
    var helpBtn = h('button', { type: 'button', class: 'wtg-ib', 'aria-label': s('help'), title: s('help'), html: ic('help'), onclick: function () { if (state.running && !state.over && !state.paused) pause(true); intro(true); } });
    var fullBtn = (document.fullscreenEnabled || document.webkitFullscreenEnabled) ? h('button', { type: 'button', class: 'wtg-ib wtg-hide-s', 'aria-label': 'Fullscreen', title: 'Fullscreen', html: ic('full'), onclick: function () { var r = root; try { if (document.fullscreenElement) document.exitFullscreen(); else (r.requestFullscreen || r.webkitRequestFullscreen).call(r); } catch (e) {} } }) : null;
    var stage = h('div', { class: 'wtg-stage', tabindex: '-1' });
    var overlay = h('div', { class: 'wtg-ov', hidden: true });
    var toastEl = h('div', { class: 'wtg-toast', role: 'status', 'aria-live': 'polite' });
    var root = h('div', { class: 'wtg-player', role: 'dialog', 'aria-modal': 'true', 'aria-label': t(game.title), style: { '--gc': game.color || '#037BDC' } },
      h('div', { class: 'wtg-bar' },
        h('button', { type: 'button', class: 'wtg-ib wtg-back', 'aria-label': s('exit'), title: s('exit'), html: ic('back'), onclick: function () { WTG.close(); } }),
        h('div', { class: 'wtg-title' }, h('span', { class: 'wtg-gi', 'aria-hidden': 'true', text: game.icon || '🎮' }), h('b', { text: t(game.title) })),
        h('div', { class: 'wtg-scores' }, h('span', null, h('small', { text: s('score') }), scoreEl), h('span', null, h('small', { text: s('best') }), bestEl), extraEl),
        h('div', { class: 'wtg-btns' }, pauseBtn, restartBtn, gearBtn, soundBtn, helpBtn, fullBtn)),
      h('div', { class: 'wtg-main' }, stage, overlay), toastEl);
    function applyLook() {
      var G = WTG.gprefs(); root.style.setProperty('--tx', G.text); root.classList.toggle('wtg-calm', !!G.calm); root.classList.toggle('wtg-big', G.text > 1);
      prefList().forEach(function (P) { if (P.css) stage.setAttribute('data-' + P.k, String(prefVal(P))); });
    }
    document.body.append(root);
    document.documentElement.classList.add('wtg-open');
    state.root = root;
    cur = state;

    function sizeStage() { var r = stage.getBoundingClientRect();
      state.canvases.forEach(function (c) { var k = Math.max(0.1, Math.min((r.width - 20) / c.w, (r.height - 20 - c.reserve) / c.h)); c.cv.style.width = Math.floor(c.w * k) + 'px'; c.cv.style.height = Math.floor(c.h * k) + 'px'; }); stage.style.setProperty('--w', r.width + 'px'); stage.style.setProperty('--h', r.height + 'px'); stage.style.setProperty('--sz', Math.min(r.width, r.height) + 'px'); if (state.inst && state.inst.resize) state.inst.resize(r.width, r.height); }
    var ro = window.ResizeObserver ? new ResizeObserver(sizeStage) : null;
    if (ro) ro.observe(stage); else addEventListener('resize', sizeStage);

    function setScore(n) {
      state.score = Math.max(0, Math.round(n)); scoreEl.textContent = String(state.score);
      if (state.score > state.best && !game.lowWins) { bestEl.textContent = String(state.score); bestEl.classList.add('up'); }
    }
    function toast(msg, ms) { toastEl.textContent = msg; toastEl.classList.add('on'); clearTimeout(toastEl._t); toastEl._t = setTimeout(function () { toastEl.classList.remove('on'); }, ms || 1800); }

    var api = {
      el: stage, game: game, opts: game.options || {}, lang: WTG.lang, t: t, s: s, h: h, sfx: WTG.sfx, say: WTG.say, rand: WTG.rand, shuffle: WTG.shuffle, pick: WTG.pick, toast: toast,
      // a game setting: the saved choice, or d when it is 'auto' (follows the difficulty)
      cfg: function (k, d) { var P = prefList().filter(function (x) { return x.k === k; })[0]; var v = P ? prefVal(P) : cfg[k]; return v === undefined || v === 'auto' ? d : v; },
      get gfx() { return WTG.gprefs().gfx; }, get calm() { return WTG.gprefs().calm; },
      get level() { return level; }, get first() { return state.first; }, get paused() { return state.paused || !state.running; }, get score() { return state.score; },
      setScore: setScore, add: function (n) { setScore(state.score + n); },
      // a free-form counter beside the score (time, moves, lives …)
      info: function (label, value) { if (label == null) { extraEl.hidden = true; return; } extraEl.hidden = false; extraEl.innerHTML = ''; extraEl.append(h('small', { text: label }), h('b', { class: 'wtg-num', text: String(value) })); },
      // requestAnimationFrame loop that stops while paused; fn(dt seconds)
      loop: function (fn) {
        var L = { fn: fn, last: 0, on: true, id: 0 };
        function step(ts) { if (!L.on) return; L.id = requestAnimationFrame(step); if (state.paused || !state.running || state.over) { L.last = 0; return; } var dt = L.last ? Math.min(0.05, (ts - L.last) / 1000) : 0; L.last = ts; if (dt) fn(dt); }
        L.id = requestAnimationFrame(step); state.loops.push(L);
        return { stop: function () { L.on = false; cancelAnimationFrame(L.id); } };
      },
      // setTimeout that waits while paused
      after: function (ms, fn) { var T = { left: ms, fn: fn, on: true }; state.timers.push(T); return { cancel: function () { T.on = false; } }; },
      // a canvas that keeps its logical size (w × h) and fits the stage, sharp on every screen
      // reserve: pixels of the stage height kept free for controls below the canvas
      canvas: function (w, hgt, reserve) {
        var cv = h('canvas', { class: 'wtg-cv', width: w, height: hgt }); var ctx = cv.getContext('2d');
        var dpr = Math.min(2, window.devicePixelRatio || 1); cv.width = w * dpr; cv.height = hgt * dpr; ctx.scale(dpr, dpr);
        state.canvases.push({ cv: cv, w: w, h: hgt, reserve: reserve || 0 });
        stage.append(cv); sizeStage();
        return { cv: cv, ctx: ctx, W: w, H: hgt, pt: function (e) { var r = cv.getBoundingClientRect(), p = e.touches ? (e.touches[0] || e.changedTouches[0]) : e; return { x: (p.clientX - r.left) * w / r.width, y: (p.clientY - r.top) * hgt / r.height }; } };
      },
      load: function (k, d) { var D = WTG.data(); var v = D.saves[game.id]; return v && k in v ? v[k] : d; },
      save: function (k, v) { WTG.update(function (D) { var x = D.saves[game.id] || (D.saves[game.id] = {}); if (v === undefined) delete x[k]; else x[k] = v; }); },
      achieve: function (key, label) { award(game.id + ':' + key, label); },
      win: function (score, msg) { end(true, score, msg); }, lose: function (score, msg) { end(false, score, msg); },
      end: function (o) { o = o || {}; end(!!o.won, o.score, o.msg); },
      isOver: function () { return state.over; }
    };

    function award(key, label) {
      var D = WTG.data(); if (D.ach[key]) return;
      D.ach[key] = { at: Date.now(), label: label ? (typeof label === 'object' ? label : { en: label }) : null, game: game.id }; WTG.saveData(D);
      setTimeout(function () { toast('🏆 ' + s('ach') + (label ? ': ' + t(label) : ''), 2600); WTG.sfx('coin'); }, 300);
      if (hooks.onAchievement) hooks.onAchievement(key);
    }

    function clearOv() { overlay.hidden = true; overlay.innerHTML = ''; }
    function panel() { overlay.innerHTML = ''; overlay.hidden = false; var p = h('div', { class: 'wtg-panel' }); overlay.append(p); return p; }

    function intro(fromHelp) {
      var p = panel();
      p.append(h('div', { class: 'wtg-pi', 'aria-hidden': 'true', text: game.icon || '🎮' }), h('h2', { text: t(game.title) }));
      var how = t(game.how) || t(game.desc);
      if (how) { var ul = h('div', { class: 'wtg-how' }); how.split('\n').forEach(function (line) { if (line.trim()) ul.append(h('p', { text: line })); }); p.append(h('h3', { text: s('help') }), ul); }
      if (game.keys) p.append(h('p', { class: 'wtg-keys', text: '⌨️ ' + t(game.keys) }));
      if (levels && !(fromHelp && state.running)) {
        var seg = h('div', { class: 'wtg-seg', role: 'radiogroup', 'aria-label': s('level') });
        levels.forEach(function (lv) {
          seg.append(h('button', { type: 'button', role: 'radio', 'aria-checked': String(lv === level), text: s(lv), onclick: function () { level = lv; lsSet(lvKey, lv); [].forEach.call(seg.children, function (b) { b.setAttribute('aria-checked', String(b.textContent === s(lv))); }); } }));
        });
        p.append(h('h3', { text: s('level') }), seg);
      }
      var go = h('button', { type: 'button', class: 'wtg-go', html: ic('play') + '<span>' + (fromHelp && state.running && !state.over ? s('resume') : s('start')) + '</span>', onclick: function () {
        if (fromHelp && state.running && !state.over) { clearOv(); resume(); } else begin();
      } });
      p.append(go, h('button', { type: 'button', class: 'wtg-sec', html: ic('gear') + '<span>' + s('settings') + '</span>', onclick: function () { settings(); } }));
      setTimeout(function () { try { go.focus({ preventScroll: true }); } catch (e) {} }, 30);
    }

    function settings(keep) {
      var wasRunning = keep === true || (state.running && !state.over && !state.paused);
      if (wasRunning) pause(true);
      var G = WTG.gprefs(), C = {}, lv = level, list = prefList();
      list.forEach(function (P) { C[P.k] = prefVal(P); });
      var p = panel(); p.classList.add('wtg-set');
      p.append(h('h2', null, h('span', { 'aria-hidden': 'true', html: ic('gear') }), document.createTextNode(' ' + s('settings'))));
      function seg(label, opts, val, set, cls) {
        var row = h('div', { class: 'wtg-row' + (cls ? ' ' + cls : '') }), g = h('div', { class: 'wtg-seg', role: 'radiogroup', 'aria-label': label });
        opts.forEach(function (o) { g.append(h('button', { type: 'button', role: 'radio', 'aria-checked': String(o[0] === val), style: o[2] ? { '--sw': o[2] } : null, class: o[2] ? 'sw' : null, text: o[1], onclick: function () { set(o[0]); [].forEach.call(g.children, function (b) { b.setAttribute('aria-checked', String(b === this)); }, this); } })); });
        row.append(h('label', { text: label }), g); return row;
      }
      var box = h('div', { class: 'wtg-sets' });
      box.append(h('h3', { text: s('thisGame') + ' · ' + t(game.title) }));
      if (levels) box.append(seg(s('level'), levels.map(function (x) { return [x, s(x)]; }), lv, function (v) { lv = v; }));
      list.forEach(function (P) {
        box.append(seg(t(P.l), P.v.map(function (o) { return [o[0], o[0] === 'auto' ? s('auto') : o[1] === true ? s('on') : o[1] === false ? s('off') : t(o[1]), o[2]]; }), C[P.k], function (v) { C[P.k] = v; }));
      });
      box.append(h('h3', { text: s('allGames') }));
      box.append(seg(s('volume'), [[0, '🔇'], [25, '25%'], [50, '50%'], [75, '75%'], [100, '100%']], G.vol, function (v) { G.vol = v; }));
      box.append(seg(s('voice'), [[true, s('on')], [false, s('off')]], G.voice, function (v) { G.voice = v; }));
      if (navigator.vibrate) box.append(seg(s('vibration'), [[true, s('on')], [false, s('off')]], G.vib, function (v) { G.vib = v; }));
      box.append(seg(s('textSize'), [[1, 'A'], [1.15, 'A+'], [1.3, 'A++']], G.text, function (v) { G.text = v; }));
      box.append(seg(s('calm'), [[false, s('off')], [true, s('on')]], G.calm, function (v) { G.calm = v; }));
      if (/3d$/.test(game.engine)) box.append(seg(s('graphics'), [['auto', s('auto')], ['low', s('low')], ['high', s('high')]], G.gfx, function (v) { G.gfx = v; }));
      p.append(box);
      function close() { if (wasRunning) { clearOv(); resume(); } else if (state.running && state.paused && !state.over) pause(); else if (state.over) { clearOv(); begin(); } else intro(); }
      p.append(h('div', { class: 'wtg-acts' },
        h('button', { type: 'button', class: 'wtg-go', html: ic('play') + '<span>' + s('apply') + '</span>', onclick: function () {
          WTG.setGprefs(G); var changed = lv !== level || list.some(function (P) { return C[P.k] !== prefVal(P); });
          if (levels) { level = lv; lsSet(lvKey, lv); }
          cfg = {}; list.forEach(function (P) { if (C[P.k] !== P.d) cfg[P.k] = C[P.k]; }); lsSet(cfgKey, cfg);
          applyLook();
          if (changed && state.running) begin(); else if (!state.running) begin(); else close();
        } }),
        h('button', { type: 'button', class: 'wtg-sec', html: '<span>' + s('reset') + '</span>', onclick: function () { cfg = {}; lsSet(cfgKey, cfg); WTG.setGprefs({}); applyLook(); settings(wasRunning); } }),
        h('button', { type: 'button', class: 'wtg-sec', html: '<span>' + s('cancel') + '</span>', onclick: function () { close(); } })));
      setTimeout(function () { try { p.querySelector('[aria-checked="true"]').focus({ preventScroll: true }); } catch (e) {} }, 30);
    }

    function begin() {
      clearOv();
      teardownInst();
      stage.innerHTML = ''; stage.className = 'wtg-stage'; state.canvases = []; applyLook();
      state.first = !state.begun; state.begun = true;
      state.over = false; state.paused = false; state.running = true; setScore(0); api.info(null);
      bestEl.classList.remove('up'); state.best = WTG.data().best[game.id] || 0; bestEl.textContent = String(state.best);
      pauseBtn.innerHTML = ic('pause'); pauseBtn.setAttribute('aria-label', s('pause')); pauseBtn.title = s('pause');
      try {
        state.inst = engines[engine](api) || {};
        sizeStage();
        if (state.inst.start) state.inst.start();
      } catch (e) { console.warn('[games]', game.id, e); fail(); return; }
      WTG.update(function (D) { D.plays[game.id] = (D.plays[game.id] || 0) + 1; D.last[game.id] = Date.now(); });
      if (hooks.onPlay) hooks.onPlay(game);
      try { stage.focus({ preventScroll: true }); } catch (e) {}
    }
    function teardownInst() {
      state.loops.forEach(function (L) { L.on = false; cancelAnimationFrame(L.id); }); state.loops = [];
      state.timers.forEach(function (T) { T.on = false; }); state.timers = [];
      if (state.inst && state.inst.destroy) { try { state.inst.destroy(); } catch (e) {} }
      state.inst = null;
    }
    function pause(silent) {
      if (!state.running || state.over || state.paused) return;
      state.paused = true; if (state.inst && state.inst.pause) state.inst.pause();
      pauseBtn.innerHTML = ic('play'); pauseBtn.setAttribute('aria-label', s('resume')); pauseBtn.title = s('resume');
      if (silent === true) return;
      var p = panel();
      p.append(h('div', { class: 'wtg-pi', 'aria-hidden': 'true', text: '⏸️' }), h('h2', { text: s('paused') }),
        h('button', { type: 'button', class: 'wtg-go', html: ic('play') + '<span>' + s('resume') + '</span>', onclick: function () { resume(); } }),
        h('button', { type: 'button', class: 'wtg-sec', html: ic('restart') + '<span>' + s('restart') + '</span>', onclick: function () { restart(); } }),
        h('button', { type: 'button', class: 'wtg-sec', html: ic('back') + '<span>' + s('exit') + '</span>', onclick: function () { WTG.close(); } }));
      p.querySelector('.wtg-go').focus({ preventScroll: true });
    }
    function resume() {
      if (!state.running || state.over) { if (!state.running) intro(); return; }
      clearOv(); state.paused = false; if (state.inst && state.inst.resume) state.inst.resume();
      pauseBtn.innerHTML = ic('pause'); pauseBtn.setAttribute('aria-label', s('pause')); pauseBtn.title = s('pause');
      try { stage.focus({ preventScroll: true }); } catch (e) {}
    }
    function restart() { if (!state.running) return intro(); begin(); }
    function fail() {
      state.running = false;
      var p = panel(); p.append(h('div', { class: 'wtg-pi', text: '⚠️' }), h('p', { text: s('fail') }), h('button', { type: 'button', class: 'wtg-go', text: s('exit'), onclick: function () { WTG.close(); } }));
    }
    function end(won, score, msg) {
      if (state.over) return;
      if (score != null) setScore(score);
      state.over = true;
      var sc = state.score, D = WTG.data(), prev = D.best[game.id] || 0;
      var better = game.lowWins ? (won && sc > 0 && (!prev || sc < prev)) : sc > prev;
      if (better) D.best[game.id] = sc;
      if (won) D.wins[game.id] = (D.wins[game.id] || 0) + 1;
      D.total = (D.total || 0) + (game.lowWins ? (won ? 100 : 0) : sc);
      // every finished game gives a few play-coins (games with their own coins skip this)
      var gotCoins = game.ownCoins ? 0 : (won ? 5 : 1) + Math.min(10, Math.floor((game.lowWins ? 0 : sc) / 300));
      D.coins = Math.min(999999, (D.coins || 0) + gotCoins);
      WTG.saveData(D);
      // standard achievements of every game
      if (won) award(game.id + ':win', { so: 'Guushii ugu horreysay: ' + t(game.title), en: 'First win: ' + t(game.title) });
      (game.goals || []).forEach(function (g) { if (!game.lowWins && sc >= g) award(game.id + ':s' + g, { so: t(game.title) + ': ' + g + ' dhibcood', en: t(game.title) + ': ' + g + ' points' }); });
      if (hooks.onResult) hooks.onResult(game, { won: won, score: sc, best: better });
      WTG.sfx(won ? 'win' : 'lose');
      setTimeout(function () {
        if (cur !== state) return;
        var p = panel();
        p.append(h('div', { class: 'wtg-pi', 'aria-hidden': 'true', text: won ? '🏆' : '🎯' }), h('h2', { text: won ? s('win') : s('over') }));
        if (msg) p.append(h('p', { class: 'wtg-msg', text: t(msg) }));
        p.append(h('div', { class: 'wtg-final' }, h('span', null, h('small', { text: s('score') }), h('b', { text: String(sc) })), h('span', null, h('small', { text: s('best') }), h('b', { text: String(WTG.data().best[game.id] || sc) }))));
        if (better && sc > 0) p.append(h('p', { class: 'wtg-new', text: '⭐ ' + s('newBest') }));
        if (gotCoins) p.append(h('p', { class: 'wtg-new', text: '+' + gotCoins + ' 🪙 · ' + WTG.coins() }));
        p.append(h('button', { type: 'button', class: 'wtg-go', html: ic('restart') + '<span>' + s('again') + '</span>', onclick: function () { begin(); } }),
          h('button', { type: 'button', class: 'wtg-sec', html: ic('back') + '<span>' + s('exit') + '</span>', onclick: function () { WTG.close(); } }));
        p.querySelector('.wtg-go').focus({ preventScroll: true });
      }, won ? 700 : 500);
    }

    // timers that respect pause
    var tick = setInterval(function () {
      if (!state.running || state.paused || state.over) return;
      // run the due timers after the list is updated, so a timer started inside a timer is kept
      var due = [];
      state.timers = state.timers.filter(function (T) { if (!T.on) return false; T.left -= 100; if (T.left <= 0) { T.on = false; due.push(T); return false; } return true; });
      due.forEach(function (T) { try { T.fn(); } catch (e) { console.warn(e); } });
    }, 100);
    function onVis() { if (document.hidden) pause(); }
    function onKey(e) {
      if (e.key === 'Escape') { if (!overlay.hidden && state.paused) resume(); else if (state.running && !state.over) pause(); else WTG.close(); e.preventDefault(); return; }
      if ((e.key === 'p' || e.key === 'P') && !e.target.matches('input,textarea')) { state.paused ? resume() : pause(); }
      if (state.inst && state.inst.key && !state.paused && state.running && !state.over && overlay.hidden) state.inst.key(e, true);
    }
    function onKeyUp(e) { if (state.inst && state.inst.key && state.running) state.inst.key(e, false); }
    document.addEventListener('visibilitychange', onVis);
    document.addEventListener('keydown', onKey);
    document.addEventListener('keyup', onKeyUp);
    state.cleanup = function () {
      clearInterval(tick); teardownInst(); if (ro) ro.disconnect(); else removeEventListener('resize', sizeStage);
      document.removeEventListener('visibilitychange', onVis); document.removeEventListener('keydown', onKey); document.removeEventListener('keyup', onKeyUp);
      try { if (window.speechSynthesis) speechSynthesis.cancel(); } catch (e) {}
      try { if (document.fullscreenElement) document.exitFullscreen(); } catch (e) {}
      root.remove(); document.documentElement.classList.remove('wtg-open');
    };
    state.hooks = hooks;

    // load the game's file, then show the instructions (a game with its own menus, "direct", opens straight away)
    var p = panel(); p.append(h('div', { class: 'wtg-spin', 'aria-hidden': 'true' }), h('p', { text: s('loading') }));
    WTG.load(engine).then(function () { if (cur !== state) return; if (game.direct && engine === game.engine) begin(); else intro(); }).catch(function () {
      if (cur !== state) return;
      var p2 = panel(); p2.append(h('div', { class: 'wtg-pi', text: '📶' }), h('p', { text: s('fail') }), h('button', { type: 'button', class: 'wtg-go', text: s('retry'), onclick: function () { WTG.open(game, hooks); } }), h('button', { type: 'button', class: 'wtg-sec', text: s('exit'), onclick: function () { WTG.close(); } }));
    });
    return api;
  };
  WTG.close = function (silent) {
    if (!cur) return;
    var st = cur; cur = null; st.cleanup();
    if (!silent && st.hooks && st.hooks.onExit) st.hooks.onExit(st.game);
  };
})();
