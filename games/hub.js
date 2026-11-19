/*! © 2026 Wartabiye TV. All Rights Reserved. */
/* Wartabiye TV Games: the games homepage. Reads the game list from data/games.json (managed in /admin/ → Games),
   shows only enabled games whose game file exists, and opens a game with WTG.open (game files load on demand). */
(function () {
  'use strict';
  var h = WTG.h, t = WTG.t, s = WTG.s, L = WTG.lang;
  var U = {
    so: { lead: 'Ciyaaro bilaash ah oo bogga lagu dhex ciyaaro: carruurta, dhalinyarada, dadka waaweyn iyo odayaasha. Akoon looma baahna.', news: 'Wararka', featured: 'Ciyaaro la doortay', daily: 'Tartanka maanta', dailyText: 'Ka hel ugu yaraan {n} dhibcood ciyaarta {g}.', dailyWin: 'Ku guuleyso ciyaarta {g}.', dailyDone: 'Waad dhammaysay tartanka maanta! Berri soo noqo.', streak: '🔥 {n} maalmood oo isku xiga', mostPlayed: '🔥 Ciyaaraha ugu badan ee la ciyaaro', mostSub: 'Noocyada ciyaaraha ee adduunka laga jecel yahay', newG: '✨ Ciyaaro cusub', kids: 'Carruurta', teens: 'Dhalinyarada', adults: 'Dadka Waaweyn iyo Odayaasha', kidsSub: 'Midab badan, fudud oo waxbarasho leh', teensSub: 'Xawaare, xirfad iyo maskax', adultsSub: 'Qoraal weyn, kontarool fudud, heer la beddeli karo', brain: '🧠 Tababarka Maskaxda', multi: '👥 Ciyaaro dad badan', multiSub: 'Laba qof oo isku qalab ah ama kombiyuutarka', recent: '🕘 Kuwii aad dhowaan ciyaartay', favs: '❤️ Kuwa aad jeceshahay', all: 'Dhammaan ciyaaraha', allCats: 'Dhammaan', search: 'Raadi ciyaar…', play: 'Ciyaar hadda', best: 'Ugu fiican', none: 'Ciyaar lama helin.', profile: 'Xogtayda', players: 'Ciyaartoyda qalabkan', newPlayer: '+ Ciyaaryahan cusub', name: 'Magac-ciyaareed', nameHint: 'Magac la ciyaaro oo kaliya, ha qorin magacaaga dhabta ah.', avatar: 'Sawirka', save: 'Kaydi', use: 'Dooro', del: 'Tirtir', ach: 'Abaalmarinnada', scores: 'Dhibcaha ugu fiican', board: 'Shaxda horyaalka (qalabkan)', boardSub: 'Ciyaartoyda isku qalabka ku ciyaara. Wax internet looma diro.', played: 'Ciyaarood', total: 'Wadarta dhibcaha', game: 'Ciyaarta', player: 'Ciyaaryahan', noScores: 'Weli dhibco ma jiraan. Ciyaar bilow!', safetyT: 'Ammaan carruurta', safety: ['Ma jiro sheekeysi (chat) dad aan la aqoon.', 'Ma jiro khamaar, sharad ama lacag dhab ah.', 'Xayeysiis kuma jiro ciyaaraha.', 'Xog shakhsi ah lama weydiiyo: horumarka wuxuu ku keydsan yahay qalabkaaga oo kaliya.'], favAdd: 'Ku dar kuwa aan jeclahay', favDel: 'Ka saar kuwa aan jeclahay', streakNone: 'Bilow taxane maanta!', go: 'Bilow tartanka', ach0: 'Ciyaar si aad abaalmarin u hesho.', count: '{n} ciyaarood', theme: 'Midabka', playedN: '{n} jeer', lang: 'Luqadda', close: 'Xir' },
    en: { lead: 'Free games you play right here on the website: kids, teenagers, adults and seniors. No account needed.', news: 'News', featured: 'Featured games', daily: 'Daily challenge', dailyText: 'Score at least {n} in {g}.', dailyWin: 'Win a game of {g}.', dailyDone: 'Today’s challenge is done! Come back tomorrow.', streak: '🔥 {n}-day streak', mostPlayed: '🔥 Most played games', mostSub: 'Game types people love all over the world', newG: '✨ New games', kids: 'Kids', teens: 'Teenagers', adults: 'Adults & Seniors', kidsSub: 'Colourful, simple and educational', teensSub: 'Speed, skill and brain power', adultsSub: 'Large text, simple controls, adjustable difficulty', brain: '🧠 Brain training', multi: '👥 Multiplayer games', multiSub: 'Two players on one device, or against the computer', recent: '🕘 Recently played', favs: '❤️ Your favourites', all: 'All games', allCats: 'All', search: 'Search games…', play: 'Play now', best: 'Best', none: 'No game found.', profile: 'My profile', players: 'Players on this device', newPlayer: '+ New player', name: 'Player nickname', nameHint: 'A nickname only. Please don’t use your real name.', avatar: 'Avatar', save: 'Save', use: 'Choose', del: 'Delete', ach: 'Achievements', scores: 'High scores', board: 'Leaderboard (this device)', boardSub: 'Players who share this device. Nothing is sent over the internet.', played: 'Games played', total: 'Total score', game: 'Game', player: 'Player', noScores: 'No scores yet. Start playing!', safetyT: 'Safe for children', safety: ['No chat with strangers.', 'No gambling, betting or real money.', 'No adverts inside the games.', 'No personal information is asked for: progress is saved on your device only.'], favAdd: 'Add to favourites', favDel: 'Remove from favourites', streakNone: 'Start a streak today!', go: 'Take the challenge', ach0: 'Play to earn achievements.', count: '{n} games', theme: 'Theme', playedN: '{n}×', lang: 'Language', close: 'Close' },
    ar: { lead: 'ألعاب مجانية تلعبها هنا على الموقع: للأطفال والمراهقين والكبار وكبار السن. لا حاجة إلى حساب.', news: 'الأخبار', featured: 'ألعاب مختارة', daily: 'تحدي اليوم', dailyText: 'احصل على {n} نقطة على الأقل في {g}.', dailyWin: 'افز في لعبة {g}.', dailyDone: 'أكملت تحدي اليوم! عد غدًا.', streak: '🔥 {n} أيام متتالية', mostPlayed: '🔥 الألعاب الأكثر لعبًا', mostSub: 'أنواع ألعاب يحبها الناس حول العالم', newG: '✨ ألعاب جديدة', kids: 'الأطفال', teens: 'المراهقون', adults: 'الكبار وكبار السن', kidsSub: 'ملونة وبسيطة وتعليمية', teensSub: 'سرعة ومهارة وذكاء', adultsSub: 'خط كبير وتحكم بسيط وصعوبة قابلة للتعديل', brain: '🧠 تدريب الدماغ', multi: '👥 ألعاب جماعية', multiSub: 'لاعبان على جهاز واحد أو ضد الكمبيوتر', recent: '🕘 لُعبت مؤخرًا', favs: '❤️ المفضلة', all: 'كل الألعاب', allCats: 'الكل', search: 'ابحث عن لعبة…', play: 'العب الآن', best: 'الأفضل', none: 'لم يتم العثور على لعبة.', profile: 'ملفي', players: 'اللاعبون على هذا الجهاز', newPlayer: '+ لاعب جديد', name: 'اسم اللاعب', nameHint: 'اسم مستعار فقط، لا تكتب اسمك الحقيقي.', avatar: 'الصورة', save: 'حفظ', use: 'اختر', del: 'حذف', ach: 'الإنجازات', scores: 'أفضل النتائج', board: 'لوحة المتصدرين (هذا الجهاز)', boardSub: 'اللاعبون الذين يتشاركون هذا الجهاز. لا يُرسل شيء عبر الإنترنت.', played: 'مرات اللعب', total: 'مجموع النقاط', game: 'اللعبة', player: 'اللاعب', noScores: 'لا توجد نتائج بعد. ابدأ اللعب!', safetyT: 'آمنة للأطفال', safety: ['لا دردشة مع غرباء.', 'لا قمار ولا رهان ولا أموال حقيقية.', 'لا إعلانات داخل الألعاب.', 'لا نطلب معلومات شخصية: يُحفظ التقدم على جهازك فقط.'], favAdd: 'أضف إلى المفضلة', favDel: 'أزل من المفضلة', streakNone: 'ابدأ سلسلة اليوم!', go: 'خض التحدي', ach0: 'العب لتحصل على إنجازات.', count: '{n} لعبة', theme: 'المظهر', playedN: '{n} مرة', lang: 'اللغة', close: 'إغلاق' },
    fr: { lead: 'Des jeux gratuits à jouer directement sur le site : enfants, adolescents, adultes et seniors. Aucun compte nécessaire.', news: 'Actualités', featured: 'Jeux à la une', daily: 'Défi du jour', dailyText: 'Marquez au moins {n} points à {g}.', dailyWin: 'Gagnez une partie de {g}.', dailyDone: 'Défi du jour réussi ! Revenez demain.', streak: '🔥 {n} jours d’affilée', mostPlayed: '🔥 Les plus joués', mostSub: 'Les types de jeux préférés dans le monde', newG: '✨ Nouveaux jeux', kids: 'Enfants', teens: 'Ados', adults: 'Adultes et seniors', kidsSub: 'Colorés, simples et éducatifs', teensSub: 'Vitesse, adresse et réflexion', adultsSub: 'Grand texte, commandes simples, difficulté réglable', brain: '🧠 Entraînement cérébral', multi: '👥 Multijoueur', multiSub: 'Deux joueurs sur un appareil ou contre l’ordinateur', recent: '🕘 Joués récemment', favs: '❤️ Vos favoris', all: 'Tous les jeux', allCats: 'Tous', search: 'Chercher un jeu…', play: 'Jouer', best: 'Record', none: 'Aucun jeu trouvé.', profile: 'Mon profil', players: 'Joueurs sur cet appareil', newPlayer: '+ Nouveau joueur', name: 'Pseudo', nameHint: 'Un pseudo seulement, pas votre vrai nom.', avatar: 'Avatar', save: 'Enregistrer', use: 'Choisir', del: 'Supprimer', ach: 'Succès', scores: 'Meilleurs scores', board: 'Classement (cet appareil)', boardSub: 'Les joueurs qui partagent cet appareil. Rien n’est envoyé sur Internet.', played: 'Parties', total: 'Score total', game: 'Jeu', player: 'Joueur', noScores: 'Pas encore de score. À vous de jouer !', safetyT: 'Sûr pour les enfants', safety: ['Pas de discussion avec des inconnus.', 'Pas de jeux d’argent ni de paris.', 'Pas de publicité dans les jeux.', 'Aucune donnée personnelle demandée : la progression reste sur votre appareil.'], favAdd: 'Ajouter aux favoris', favDel: 'Retirer des favoris', streakNone: 'Commencez une série aujourd’hui !', go: 'Relever le défi', ach0: 'Jouez pour gagner des succès.', count: '{n} jeux', theme: 'Thème', playedN: '{n}×', lang: 'Langue', close: 'Fermer' },
    nl: { lead: 'Gratis spellen die je direct op de website speelt: voor kinderen, tieners, volwassenen en senioren. Geen account nodig.', news: 'Nieuws', featured: 'Uitgelichte spellen', daily: 'Dagelijkse uitdaging', dailyText: 'Haal minstens {n} punten in {g}.', dailyWin: 'Win een potje {g}.', dailyDone: 'Uitdaging van vandaag gehaald! Kom morgen terug.', streak: '🔥 {n} dagen op rij', mostPlayed: '🔥 Meest gespeeld', mostSub: 'Speltypes die mensen wereldwijd graag spelen', newG: '✨ Nieuwe spellen', kids: 'Kinderen', teens: 'Tieners', adults: 'Volwassenen & senioren', kidsSub: 'Kleurrijk, eenvoudig en leerzaam', teensSub: 'Snelheid, vaardigheid en denkkracht', adultsSub: 'Grote letters, eenvoudige besturing, instelbaar niveau', brain: '🧠 Hersentraining', multi: '👥 Multiplayer', multiSub: 'Twee spelers op één apparaat of tegen de computer', recent: '🕘 Onlangs gespeeld', favs: '❤️ Je favorieten', all: 'Alle spellen', allCats: 'Alle', search: 'Zoek een spel…', play: 'Nu spelen', best: 'Beste', none: 'Geen spel gevonden.', profile: 'Mijn profiel', players: 'Spelers op dit apparaat', newPlayer: '+ Nieuwe speler', name: 'Spelersnaam', nameHint: 'Alleen een bijnaam, niet je echte naam.', avatar: 'Avatar', save: 'Opslaan', use: 'Kiezen', del: 'Verwijderen', ach: 'Prestaties', scores: 'Topscores', board: 'Ranglijst (dit apparaat)', boardSub: 'Spelers die dit apparaat delen. Er wordt niets via internet verstuurd.', played: 'Gespeeld', total: 'Totaalscore', game: 'Spel', player: 'Speler', noScores: 'Nog geen scores. Begin met spelen!', safetyT: 'Veilig voor kinderen', safety: ['Geen chat met onbekenden.', 'Geen gokken, wedden of echt geld.', 'Geen advertenties in de spellen.', 'Er worden geen persoonsgegevens gevraagd: voortgang blijft op je apparaat.'], favAdd: 'Toevoegen aan favorieten', favDel: 'Verwijderen uit favorieten', streakNone: 'Begin vandaag een reeks!', go: 'Ga de uitdaging aan', ach0: 'Speel om prestaties te verdienen.', count: '{n} spellen', theme: 'Thema', playedN: '{n}×', lang: 'Taal', close: 'Sluiten' },
    it: { lead: 'Giochi gratuiti da giocare direttamente sul sito: bambini, ragazzi, adulti e anziani. Nessun account necessario.', news: 'Notizie', featured: 'Giochi in evidenza', daily: 'Sfida del giorno', dailyText: 'Fai almeno {n} punti a {g}.', dailyWin: 'Vinci una partita a {g}.', dailyDone: 'Sfida di oggi completata! Torna domani.', streak: '🔥 {n} giorni di fila', mostPlayed: '🔥 I più giocati', mostSub: 'I tipi di gioco amati in tutto il mondo', newG: '✨ Nuovi giochi', kids: 'Bambini', teens: 'Ragazzi', adults: 'Adulti e anziani', kidsSub: 'Colorati, semplici ed educativi', teensSub: 'Velocità, abilità e ingegno', adultsSub: 'Testo grande, comandi semplici, difficoltà regolabile', brain: '🧠 Allenamento mentale', multi: '👥 Multigiocatore', multiSub: 'Due giocatori sullo stesso dispositivo o contro il computer', recent: '🕘 Giocati di recente', favs: '❤️ I tuoi preferiti', all: 'Tutti i giochi', allCats: 'Tutti', search: 'Cerca un gioco…', play: 'Gioca ora', best: 'Record', none: 'Nessun gioco trovato.', profile: 'Il mio profilo', players: 'Giocatori su questo dispositivo', newPlayer: '+ Nuovo giocatore', name: 'Nickname', nameHint: 'Solo un soprannome, non il tuo vero nome.', avatar: 'Avatar', save: 'Salva', use: 'Scegli', del: 'Elimina', ach: 'Obiettivi', scores: 'Punteggi migliori', board: 'Classifica (questo dispositivo)', boardSub: 'I giocatori che usano questo dispositivo. Nulla viene inviato su Internet.', played: 'Partite', total: 'Punti totali', game: 'Gioco', player: 'Giocatore', noScores: 'Ancora nessun punteggio. Inizia a giocare!', safetyT: 'Sicuro per i bambini', safety: ['Nessuna chat con sconosciuti.', 'Niente gioco d’azzardo, scommesse o soldi veri.', 'Nessuna pubblicità nei giochi.', 'Nessun dato personale richiesto: i progressi restano sul tuo dispositivo.'], favAdd: 'Aggiungi ai preferiti', favDel: 'Rimuovi dai preferiti', streakNone: 'Inizia una serie oggi!', go: 'Accetta la sfida', ach0: 'Gioca per ottenere obiettivi.', count: '{n} giochi', theme: 'Tema', playedN: '{n}×', lang: 'Lingua', close: 'Chiudi' },
    de: { lead: 'Kostenlose Spiele direkt auf der Website: für Kinder, Jugendliche, Erwachsene und Senioren. Kein Konto nötig.', news: 'Nachrichten', featured: 'Empfohlene Spiele', daily: 'Tägliche Herausforderung', dailyText: 'Erreiche mindestens {n} Punkte in {g}.', dailyWin: 'Gewinne eine Partie {g}.', dailyDone: 'Heutige Herausforderung geschafft! Komm morgen wieder.', streak: '🔥 {n} Tage in Folge', mostPlayed: '🔥 Meistgespielt', mostSub: 'Spielarten, die Menschen weltweit lieben', newG: '✨ Neue Spiele', kids: 'Kinder', teens: 'Jugendliche', adults: 'Erwachsene & Senioren', kidsSub: 'Bunt, einfach und lehrreich', teensSub: 'Tempo, Geschick und Köpfchen', adultsSub: 'Große Schrift, einfache Steuerung, einstellbare Schwierigkeit', brain: '🧠 Gehirntraining', multi: '👥 Mehrspieler', multiSub: 'Zwei Spieler an einem Gerät oder gegen den Computer', recent: '🕘 Zuletzt gespielt', favs: '❤️ Deine Favoriten', all: 'Alle Spiele', allCats: 'Alle', search: 'Spiel suchen…', play: 'Jetzt spielen', best: 'Rekord', none: 'Kein Spiel gefunden.', profile: 'Mein Profil', players: 'Spieler auf diesem Gerät', newPlayer: '+ Neuer Spieler', name: 'Spielername', nameHint: 'Nur ein Spitzname, bitte nicht dein echter Name.', avatar: 'Avatar', save: 'Speichern', use: 'Wählen', del: 'Löschen', ach: 'Erfolge', scores: 'Bestwerte', board: 'Rangliste (dieses Gerät)', boardSub: 'Spieler, die dieses Gerät teilen. Nichts wird ins Internet gesendet.', played: 'Gespielt', total: 'Gesamtpunkte', game: 'Spiel', player: 'Spieler', noScores: 'Noch keine Punkte. Leg los!', safetyT: 'Sicher für Kinder', safety: ['Kein Chat mit Fremden.', 'Kein Glücksspiel, keine Wetten, kein echtes Geld.', 'Keine Werbung in den Spielen.', 'Keine persönlichen Daten: Der Fortschritt bleibt auf deinem Gerät.'], favAdd: 'Zu Favoriten', favDel: 'Aus Favoriten entfernen', streakNone: 'Starte heute eine Serie!', go: 'Herausforderung starten', ach0: 'Spiele, um Erfolge zu sammeln.', count: '{n} Spiele', theme: 'Design', playedN: '{n}×', lang: 'Sprache', close: 'Schließen' },
    tr: { lead: 'Doğrudan sitede oynanan ücretsiz oyunlar: çocuklar, gençler, yetişkinler ve yaşlılar için. Hesap gerekmez.', news: 'Haberler', featured: 'Öne çıkan oyunlar', daily: 'Günün görevi', dailyText: '{g} oyununda en az {n} puan al.', dailyWin: 'Bir {g} oyunu kazan.', dailyDone: 'Bugünün görevi tamam! Yarın yine gel.', streak: '🔥 {n} gün üst üste', mostPlayed: '🔥 En çok oynananlar', mostSub: 'Dünyada sevilen oyun türleri', newG: '✨ Yeni oyunlar', kids: 'Çocuklar', teens: 'Gençler', adults: 'Yetişkinler ve yaşlılar', kidsSub: 'Renkli, basit ve öğretici', teensSub: 'Hız, beceri ve zekâ', adultsSub: 'Büyük yazı, kolay kontroller, ayarlanabilir zorluk', brain: '🧠 Beyin egzersizi', multi: '👥 Çok oyunculu', multiSub: 'Aynı cihazda iki oyuncu ya da bilgisayara karşı', recent: '🕘 Son oynananlar', favs: '❤️ Favorilerin', all: 'Tüm oyunlar', allCats: 'Tümü', search: 'Oyun ara…', play: 'Hemen oyna', best: 'En iyi', none: 'Oyun bulunamadı.', profile: 'Profilim', players: 'Bu cihazdaki oyuncular', newPlayer: '+ Yeni oyuncu', name: 'Oyuncu adı', nameHint: 'Sadece bir takma ad; gerçek adını yazma.', avatar: 'Avatar', save: 'Kaydet', use: 'Seç', del: 'Sil', ach: 'Başarılar', scores: 'En yüksek puanlar', board: 'Sıralama (bu cihaz)', boardSub: 'Bu cihazı paylaşan oyuncular. İnternete hiçbir şey gönderilmez.', played: 'Oynanan', total: 'Toplam puan', game: 'Oyun', player: 'Oyuncu', noScores: 'Henüz puan yok. Oynamaya başla!', safetyT: 'Çocuklar için güvenli', safety: ['Yabancılarla sohbet yok.', 'Kumar, bahis ya da gerçek para yok.', 'Oyunların içinde reklam yok.', 'Kişisel bilgi istenmez: ilerleme yalnızca cihazında saklanır.'], favAdd: 'Favorilere ekle', favDel: 'Favorilerden çıkar', streakNone: 'Bugün bir seri başlat!', go: 'Göreve başla', ach0: 'Başarı kazanmak için oyna.', count: '{n} oyun', theme: 'Tema', playedN: '{n} kez', lang: 'Dil', close: 'Kapat' },
    es: { lead: 'Juegos gratis para jugar aquí mismo en la web: niños, adolescentes, adultos y mayores. No necesitas cuenta.', news: 'Noticias', featured: 'Juegos destacados', daily: 'Reto del día', dailyText: 'Consigue al menos {n} puntos en {g}.', dailyWin: 'Gana una partida de {g}.', dailyDone: '¡Reto de hoy completado! Vuelve mañana.', streak: '🔥 {n} días seguidos', mostPlayed: '🔥 Los más jugados', mostSub: 'Tipos de juego que encantan en todo el mundo', newG: '✨ Juegos nuevos', kids: 'Niños', teens: 'Adolescentes', adults: 'Adultos y mayores', kidsSub: 'Coloridos, sencillos y educativos', teensSub: 'Velocidad, habilidad e ingenio', adultsSub: 'Letra grande, controles sencillos, dificultad ajustable', brain: '🧠 Entrenamiento mental', multi: '👥 Multijugador', multiSub: 'Dos jugadores en un dispositivo o contra el ordenador', recent: '🕘 Jugados recientemente', favs: '❤️ Tus favoritos', all: 'Todos los juegos', allCats: 'Todos', search: 'Buscar juego…', play: 'Jugar ahora', best: 'Récord', none: 'No se encontró ningún juego.', profile: 'Mi perfil', players: 'Jugadores en este dispositivo', newPlayer: '+ Nuevo jugador', name: 'Apodo', nameHint: 'Solo un apodo, no tu nombre real.', avatar: 'Avatar', save: 'Guardar', use: 'Elegir', del: 'Eliminar', ach: 'Logros', scores: 'Mejores puntuaciones', board: 'Clasificación (este dispositivo)', boardSub: 'Jugadores que comparten este dispositivo. No se envía nada por Internet.', played: 'Partidas', total: 'Puntos totales', game: 'Juego', player: 'Jugador', noScores: 'Aún no hay puntuaciones. ¡A jugar!', safetyT: 'Seguro para niños', safety: ['Sin chat con desconocidos.', 'Sin apuestas ni dinero real.', 'Sin anuncios dentro de los juegos.', 'No se piden datos personales: el progreso se guarda solo en tu dispositivo.'], favAdd: 'Añadir a favoritos', favDel: 'Quitar de favoritos', streakNone: '¡Empieza una racha hoy!', go: 'Aceptar el reto', ach0: 'Juega para ganar logros.', count: '{n} juegos', theme: 'Tema', playedN: '{n}×', lang: 'Idioma', close: 'Cerrar' }
  };
  function u(k, vars) { var x = (U[L] && U[L][k]) || U.en[k] || k; if (vars) for (var v in vars) x = String(x).replace('{' + v + '}', vars[v]); return x; }
  var $ = function (id) { return document.getElementById(id); };
  var CATS = { kids: 'kids', teens: 'teens', adults: 'adults' };
  var CAT_ICON = { kids: '🧸', teens: '⚡', adults: '♟️' };
  var GAMES = [], BY = {};

  // ------------------------------------------------------------------ chrome
  function chrome() {
    document.documentElement.lang = L; document.documentElement.dir = L === 'ar' ? 'rtl' : 'ltr';
    $('heroLead').textContent = u('lead'); $('newsTxt').textContent = u('news'); $('q').placeholder = u('search'); $('qLab').textContent = u('search');
    $('profTxt').textContent = u('profile'); $('profBtn').setAttribute('aria-label', u('profile')); $('themeBtn').setAttribute('aria-label', u('theme'));
    $('langSel').value = L; $('langSel').setAttribute('aria-label', u('lang'));
    $('yr').textContent = new Date().getFullYear();
    var sf = $('safety'); sf.innerHTML = '';
    sf.append(h('div', { class: 'si', text: '🛡️' }), h('div', null, h('h3', { text: u('safetyT') }), h('ul', null, u('safety').map(function (x) { return h('li', { text: x }); }))));
  }
  $('langSel').addEventListener('change', function () { try { localStorage.setItem('wartabiye-lang', this.value); } catch (e) {} var q = new URLSearchParams(location.search); q.delete('lang'); location.search = q.toString(); if (!q.toString()) location.reload(); });
  $('themeBtn').addEventListener('click', function () { var d = document.documentElement, n = d.dataset.theme === 'dark' ? 'light' : 'dark'; d.dataset.theme = n; try { localStorage.setItem('wartabiye-theme', n); } catch (e) {} });
  $('profBtn').addEventListener('click', function () { profile(); });

  // ------------------------------------------------------------------ cards
  function diffOf(g) { return g.difficulty || 'medium'; }
  function catLabel(c) { return u(c); }
  function thumb(g) {
    var b = h('button', { type: 'button', class: 'thumb', 'aria-label': u('play') + ': ' + t(g.title), onclick: function () { play(g); } });
    if (g.thumb && /^(img\/|https:\/\/)/.test(g.thumb)) b.append(h('img', { src: (/^img\//.test(g.thumb) ? '../' : '') + g.thumb, alt: '', loading: 'lazy', decoding: 'async', onerror: function () { this.remove(); } }));
    b.append(h('span', { class: 'em', 'aria-hidden': 'true', text: g.icon || '🎮' }), h('span', { class: 'play', 'aria-hidden': 'true', text: '▶ ' + u('play') }));
    return b;
  }
  function card(g) {
    var D = WTG.data(), fav = D.fav.indexOf(g.id) >= 0;
    var fb = h('button', { type: 'button', class: 'fav', 'aria-pressed': String(fav), 'aria-label': fav ? u('favDel') : u('favAdd'), title: fav ? u('favDel') : u('favAdd'), html: '<svg viewBox="0 0 24 24"><path d="M12 20s-7-4.4-9.2-8.6C1.2 8.2 3 4.5 6.6 4.5c2 0 3.4 1.2 4.4 2.6 1-1.4 2.4-2.6 4.4-2.6 3.6 0 5.4 3.7 3.8 6.9C19 15.6 12 20 12 20z"/></svg>', onclick: function (e) { e.stopPropagation(); toggleFav(g.id); } });
    var badges = h('div', { class: 'badges' });
    if (g.popular) badges.append(h('span', { class: 'badge hot', text: '🔥' }));
    if (isNew(g)) badges.append(h('span', { class: 'badge new', text: 'NEW' }));
    var best = D.best[g.id];
    return h('article', { class: 'card', style: { '--gc': g.color || '#037BDC' }, 'data-game': g.id },
      thumb(g), fb, badges,
      h('div', { class: 'cbody' },
        h('h3', { text: t(g.title) }),
        h('p', { text: t(g.desc) }),
        h('div', { class: 'meta' }, (g.cats || []).slice(0, 2).map(function (c) { return h('span', { text: CAT_ICON[c] + ' ' + catLabel(c) }); }), h('span', { class: 'd-' + diffOf(g), text: s(diffOf(g)) })),
        h('div', { class: 'cfoot' }, h('small', { text: best ? u('best') + ': ' + best : '' }), h('button', { type: 'button', class: 'playbtn', html: '<svg viewBox="0 0 24 24"><path d="M7 4.5v15l12-7.5z"/></svg><span>' + u('play') + '</span>', onclick: function () { play(g); } }))));
  }
  function isNew(g) { if (g.isNew) return true; var a = Date.parse(g.added || ''); return a && Date.now() - a < 21 * 864e5; }
  function toggleFav(id) {
    WTG.update(function (D) { var i = D.fav.indexOf(id); if (i >= 0) D.fav.splice(i, 1); else D.fav.push(id); });
    render();
  }

  function row(title, sub, list, opts) {
    if (!list.length) return null;
    opts = opts || {};
    var sc = h('div', { class: opts.grid ? 'grid' : 'scroller' }, list.map(card));
    var nav2 = opts.grid ? null : h('div', { class: 'nav2' },
      h('button', { type: 'button', 'aria-label': '←', html: '<svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg>', onclick: function () { sc.scrollBy({ left: (L === 'ar' ? 1 : -1) * sc.clientWidth * 0.8, behavior: 'smooth' }); } }),
      h('button', { type: 'button', 'aria-label': '→', html: '<svg viewBox="0 0 24 24"><path d="M9 5l7 7-7 7"/></svg>', onclick: function () { sc.scrollBy({ left: (L === 'ar' ? -1 : 1) * sc.clientWidth * 0.8, behavior: 'smooth' }); } }));
    return h('section', { class: 'row', id: opts.id || null, 'aria-label': title }, h('div', { class: 'rowh' }, h('div', null, h('h2', { text: title }), sub ? h('p', { text: sub }) : null), nav2), sc);
  }

  // ------------------------------------------------------------------ filters
  var filter = 'all', query = '';
  var FILTERS = [['all', function () { return u('allCats'); }], ['kids', function () { return '🧸 ' + u('kids'); }], ['teens', function () { return '⚡ ' + u('teens'); }], ['adults', function () { return '♟️ ' + u('adults'); }], ['popular', function () { return u('mostPlayed'); }], ['brain', function () { return u('brain'); }], ['multi', function () { return u('multi'); }], ['favs', function () { return u('favs'); }]];
  function chips() {
    var c = $('chips'); c.innerHTML = '';
    FILTERS.forEach(function (f) { c.append(h('button', { type: 'button', class: 'chip', 'aria-pressed': String(filter === f[0]), text: f[1](), onclick: function () { filter = f[0]; chips(); render(); } })); });
  }
  $('q').addEventListener('input', function () { query = this.value.trim().toLowerCase(); render(); });
  function match(g) {
    if (query) { var hay = [t(g.title), t(g.desc), g.title && g.title.en, g.title && g.title.so, g.id, (g.tags || []).join(' ')].join(' ').toLowerCase(); if (hay.indexOf(query) < 0) return false; }
    if (filter === 'all') return true;
    if (CATS[filter]) return (g.cats || []).indexOf(filter) >= 0;
    if (filter === 'popular') return !!g.popular;
    if (filter === 'favs') return WTG.data().fav.indexOf(g.id) >= 0;
    return (g.tags || []).indexOf(filter) >= 0;
  }

  // ------------------------------------------------------------------ the page
  function render() {
    var R = $('rows'); R.innerHTML = '';
    var D = WTG.data();
    if (query || filter !== 'all') {
      var found = GAMES.filter(match);
      var x = row(query ? '“' + query + '”' : FILTERS.filter(function (f) { return f[0] === filter; })[0][1](), u('count', { n: found.length }), found, { grid: true });
      R.append(x || h('p', { class: 'empty', text: u('none') }));
      return;
    }
    var recent = Object.keys(D.last).filter(function (id) { return BY[id]; }).sort(function (a, b) { return D.last[b] - D.last[a]; }).slice(0, 12).map(function (id) { return BY[id]; });
    var favs = D.fav.filter(function (id) { return BY[id]; }).map(function (id) { return BY[id]; });
    var byOrder = function (a, b) { return (a.order || 999) - (b.order || 999); };
    var rows = [
      row(u('recent'), '', recent, { id: 'recent' }),
      row(u('favs'), '', favs, { id: 'favs' }),
      row(u('mostPlayed'), u('mostSub'), GAMES.filter(function (g) { return g.popular; }).sort(byOrder), { id: 'popular' }),
      row(u('newG'), '', GAMES.filter(isNew), { id: 'new' }),
      row('🧸 ' + u('kids'), u('kidsSub'), GAMES.filter(function (g) { return (g.cats || []).indexOf('kids') >= 0; }), { id: 'kids' }),
      row('⚡ ' + u('teens'), u('teensSub'), GAMES.filter(function (g) { return (g.cats || []).indexOf('teens') >= 0; }), { id: 'teens' }),
      row('♟️ ' + u('adults'), u('adultsSub'), GAMES.filter(function (g) { return (g.cats || []).indexOf('adults') >= 0; }), { id: 'adults' }),
      row(u('brain'), '', GAMES.filter(function (g) { return (g.tags || []).indexOf('brain') >= 0; }), { id: 'brain' }),
      row(u('multi'), u('multiSub'), GAMES.filter(function (g) { return (g.tags || []).indexOf('multi') >= 0; }), { id: 'multi' }),
      row(u('all'), u('count', { n: GAMES.length }), GAMES.slice().sort(function (a, b) { return t(a.title).localeCompare(t(b.title)); }), { grid: true, id: 'all' })
    ];
    rows.forEach(function (r) { if (r) R.append(r); });
  }

  // featured carousel
  var featTimer = 0;
  function featured() {
    var F = $('feat'); F.innerHTML = '';
    var list = GAMES.filter(function (g) { return g.featured; }); if (!list.length) list = GAMES.slice(0, 4);
    var dots = h('div', { class: 'feat-dots' }), i = 0;
    var slides = list.map(function (g, k) {
      var art = h('div', { class: 'feat-art', 'aria-hidden': 'true' });
      if (g.thumb && /^(img\/|https:\/\/)/.test(g.thumb)) art.append(h('img', { src: (/^img\//.test(g.thumb) ? '../' : '') + g.thumb, alt: '' })); else art.textContent = g.icon || '🎮';
      var sl = h('div', { class: 'feat-slide' + (k ? '' : ' on'), style: { background: 'linear-gradient(120deg,' + (g.color || '#037BDC') + ',#04213f 85%)' }, 'aria-hidden': String(!!k) },
        h('div', { class: 'fx' }, h('small', { text: '★ ' + u('featured') }), h('h2', { text: t(g.title) }), h('p', { text: t(g.desc) }), h('button', { type: 'button', class: 'btn', tabindex: k ? '-1' : null, html: '▶ <span>' + u('play') + '</span>', onclick: function () { play(g); } })), art);
      dots.append(h('button', { type: 'button', 'aria-label': t(g.title), 'aria-current': String(!k), onclick: function () { show(k); restartTimer(); } }));
      F.append(sl); return sl;
    });
    F.append(dots);
    function show(k) { i = k; slides.forEach(function (sl, j) { sl.classList.toggle('on', j === k); sl.setAttribute('aria-hidden', String(j !== k)); var b = sl.querySelector('button'); if (b) b.tabIndex = j === k ? 0 : -1; }); [].forEach.call(dots.children, function (d, j) { d.setAttribute('aria-current', String(j === k)); }); }
    function restartTimer() { clearInterval(featTimer); if (matchMedia('(prefers-reduced-motion: reduce)').matches) return; featTimer = setInterval(function () { if (!WTG.current() && !document.hidden) show((i + 1) % slides.length); }, 6000); }
    restartTimer();
  }

  // daily challenge (same for everyone on a given day, chosen from the game list)
  function today() { var d = new Date(); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
  function dailyPick() {
    var pool = GAMES.filter(function (g) { return g.daily !== false && (g.goals && g.goals.length || g.dailyWin); });
    if (!pool.length) return null;
    var k = today(), n = 0; for (var i = 0; i < k.length; i++) n = (n * 31 + k.charCodeAt(i)) >>> 0;
    var g = pool[n % pool.length];
    return { game: g, target: g.dailyWin ? 0 : g.goals[Math.min(g.goals.length - 1, n % 2)], day: k };
  }
  function streakOf(D) { var n = 0, d = new Date(); if (!D.daily[today()]) d.setDate(d.getDate() - 1); for (;;) { var k = d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); if (D.daily[k]) { n++; d.setDate(d.getDate() - 1); } else break; } return n; }
  function daily() {
    var box = $('daily'); box.innerHTML = ''; var C = dailyPick(); if (!C) { box.hidden = true; return; }
    var D = WTG.data(), done = !!D.daily[C.day], st = streakOf(D);
    box.className = 'daily' + (done ? ' done' : '');
    box.append(h('h3', { text: (done ? '✅ ' : '🎯 ') + u('daily') }),
      h('p', { text: done ? u('dailyDone') : (C.target ? u('dailyText', { n: C.target, g: t(C.game.title) }) : u('dailyWin', { g: t(C.game.title) })) }),
      h('div', { class: 'streak', text: st ? u('streak', { n: st }) : u('streakNone') }),
      done ? null : h('button', { type: 'button', class: 'btn small', style: { marginTop: '10px' }, text: C.game.icon + ' ' + u('go'), onclick: function () { play(C.game); } }));
  }
  function meCard() {
    var me = WTG.me(), D = WTG.data(), plays = 0; for (var k in D.plays) plays += D.plays[k];
    var box = $('meCard'); box.innerHTML = '';
    box.append(h('div', { class: 'av', text: me.avatar }), h('div', { class: 'mi' }, h('b', { text: me.name }), h('span', { text: u('played') + ': ' + plays + ' · 🏆 ' + Object.keys(D.ach).length + ' · ' + u('total') + ': ' + (D.total || 0) })),
      h('button', { type: 'button', class: 'btn ghost small', text: u('profile'), onclick: function () { profile(); } }));
    $('profAv').textContent = me.avatar;
  }

  // ------------------------------------------------------------------ profile drawer
  var GLOBAL_ACH = [
    ['first', '🎮', { so: 'Ciyaartii ugu horreysay', en: 'First game played' }, function (D) { return played(D) >= 1; }],
    ['ten', '🔟', { so: '10 ciyaarood', en: '10 games played' }, function (D) { return played(D) >= 10; }],
    ['fifty', '💯', { so: '50 ciyaarood', en: '50 games played' }, function (D) { return played(D) >= 50; }],
    ['explorer', '🧭', { so: '5 ciyaarood oo kala duwan', en: 'Tried 5 different games' }, function (D) { return Object.keys(D.plays).length >= 5; }],
    ['allcats', '🌈', { so: 'Qayb kasta mid ka ciyaar', en: 'Played every category' }, function (D) { var c = {}; Object.keys(D.plays).forEach(function (id) { (BY[id] && BY[id].cats || []).forEach(function (x) { c[x] = 1; }); }); return c.kids && c.teens && c.adults; }],
    ['daily1', '🎯', { so: 'Tartankii maalinlaha ahaa ee ugu horreeyay', en: 'First daily challenge' }, function (D) { return Object.keys(D.daily).length >= 1; }],
    ['streak3', '🔥', { so: '3 maalmood oo isku xiga', en: '3-day streak' }, function (D) { return streakOf(D) >= 3; }],
    ['streak7', '🏅', { so: '7 maalmood oo isku xiga', en: '7-day streak' }, function (D) { return streakOf(D) >= 7; }],
    ['fav', '❤️', { so: 'Ciyaar aad jeceshahay', en: 'Saved a favourite' }, function (D) { return D.fav.length >= 1; }],
    ['score1k', '⭐', { so: '1,000 dhibcood wadar ahaan', en: '1,000 total points' }, function (D) { return (D.total || 0) >= 1000; }]
  ];
  function played(D) { var n = 0; for (var k in D.plays) n += D.plays[k]; return n; }
  function checkGlobal() { WTG.update(function (D) { GLOBAL_ACH.forEach(function (a) { if (!D.ach['g:' + a[0]] && a[3](D)) D.ach['g:' + a[0]] = { at: Date.now(), label: a[2], game: '' }; }); }); }

  function profile() {
    var old = document.querySelector('.drawer'); if (old) old.remove();
    var P = WTG.profiles(), me = WTG.me(), D = WTG.data();
    var sec = h('section', { role: 'dialog', 'aria-modal': 'true', 'aria-label': u('profile') });
    var dr = h('div', { class: 'drawer', onclick: function (e) { if (e.target === dr) close(); } }, sec);
    function close() { dr.remove(); document.removeEventListener('keydown', esc); $('profBtn').focus(); }
    function esc(e) { if (e.key === 'Escape') close(); }
    document.addEventListener('keydown', esc);
    sec.append(h('h2', null, h('span', { text: me.avatar + ' ' + u('profile') }), h('button', { type: 'button', class: 'x', 'aria-label': u('close'), html: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg>', onclick: close })));
    // edit current player
    var nm = h('input', { id: 'pname', maxlength: '16', value: me.name, autocomplete: 'off' });
    var av = me.avatar, avs = h('div', { class: 'avs', role: 'radiogroup', 'aria-label': u('avatar') });
    WTG.AVATARS.forEach(function (a) { avs.append(h('button', { type: 'button', role: 'radio', 'aria-pressed': String(a === av), 'aria-checked': String(a === av), text: a, onclick: function () { av = a; [].forEach.call(avs.children, function (b) { b.setAttribute('aria-pressed', String(b.textContent === a)); b.setAttribute('aria-checked', String(b.textContent === a)); }); } })); });
    sec.append(h('div', { class: 'field' }, h('label', { for: 'pname', text: u('name') }), nm, h('small', { text: u('nameHint') })), h('div', { class: 'field' }, h('span', { text: u('avatar') }), avs),
      h('button', { type: 'button', class: 'btn blue small', text: u('save'), onclick: function () { var P2 = WTG.profiles(); P2.list.forEach(function (p) { if (p.id === P2.current) { p.name = clean(nm.value) || p.name; p.avatar = av; } }); WTG.saveProfiles(P2); refreshTop(); profile(); } }));
    var plays = played(D);
    sec.append(h('div', { class: 'stats3', style: { marginTop: '14px' } }, h('div', null, h('b', { text: String(plays) }), h('small', { text: u('played') })), h('div', null, h('b', { text: String(Object.keys(D.ach).length) }), h('small', { text: u('ach') })), h('div', null, h('b', { text: String(D.total || 0) }), h('small', { text: u('total') }))));
    // players on this device
    sec.append(h('h3', { text: u('players') }));
    var pl = h('div', { class: 'plist' });
    P.list.forEach(function (p) {
      pl.append(h('div', { class: 'prow' + (p.id === P.current ? ' on' : '') }, h('span', { class: 'av', text: p.avatar }), h('b', { text: p.name }),
        p.id === P.current ? null : h('button', { type: 'button', class: 'btn line small', text: u('use'), onclick: function () { var P2 = WTG.profiles(); P2.current = p.id; WTG.saveProfiles(P2); refreshTop(); profile(); } }),
        P.list.length > 1 && p.id !== P.current ? h('button', { type: 'button', class: 'btn line small', text: u('del'), onclick: function () { var P2 = WTG.profiles(); P2.list = P2.list.filter(function (x) { return x.id !== p.id; }); WTG.saveProfiles(P2); try { localStorage.removeItem('wtg-p-' + p.id); } catch (e) {} profile(); } }) : null));
    });
    sec.append(pl);
    if (P.list.length < 8) sec.append(h('button', { type: 'button', class: 'btn line small', style: { marginTop: '8px' }, text: u('newPlayer'), onclick: function () { var P2 = WTG.profiles(); var id = 'p' + Date.now().toString(36); P2.list.push({ id: id, name: u('player') + ' ' + (P2.list.length + 1), avatar: WTG.AVATARS[P2.list.length % WTG.AVATARS.length], created: Date.now() }); P2.current = id; WTG.saveProfiles(P2); refreshTop(); profile(); setTimeout(function () { var i = $('pname'); if (i) { i.focus(); i.select(); } }, 50); } }));
    // leaderboard across players on this device
    sec.append(h('h3', { text: u('board') }), h('p', { class: 'g-note', style: { color: 'var(--muted)', textAlign: 'start', margin: '0 0 6px' }, text: u('boardSub') }));
    var lb = P.list.map(function (p) { var d = WTG.data(p.id); return { p: p, total: d.total || 0, plays: played(d), ach: Object.keys(d.ach).length }; }).sort(function (a, b) { return b.total - a.total; });
    sec.append(h('table', { class: 'tbl' }, h('thead', null, h('tr', null, h('th', { text: '#' }), h('th', { text: u('player') }), h('th', { text: '🏆' }), h('th', { text: u('total') }))),
      h('tbody', null, lb.map(function (r, i) { return h('tr', null, h('td', { text: ['🥇', '🥈', '🥉'][i] || String(i + 1) }), h('td', { text: r.p.avatar + ' ' + r.p.name }), h('td', { class: 'n', text: String(r.ach) }), h('td', { class: 'n', text: String(r.total) })); }))));
    // personal high scores
    sec.append(h('h3', { text: u('scores') }));
    var bs = Object.keys(D.best).filter(function (id) { return BY[id]; });
    if (!bs.length) sec.append(h('p', { class: 'empty', style: { padding: '8px 0' }, text: u('noScores') }));
    else sec.append(h('table', { class: 'tbl' }, h('tbody', null, bs.sort(function (a, b) { return (D.last[b] || 0) - (D.last[a] || 0); }).map(function (id) { var g = BY[id]; return h('tr', null, h('td', { text: g.icon + ' ' + t(g.title) }), h('td', { class: 'n', text: u('playedN', { n: D.plays[id] || 0 }) }), h('td', { class: 'n', text: String(D.best[id]) })); }))));
    // achievements
    sec.append(h('h3', { text: u('ach') + ' (' + Object.keys(D.ach).length + ')' }));
    var ag = h('div', { class: 'achs' });
    GLOBAL_ACH.forEach(function (a) { var got = D.ach['g:' + a[0]]; ag.append(h('div', { class: 'ach' + (got ? '' : ' lock'), title: t(a[2]) }, h('span', { text: a[1] }), h('span', { text: t(a[2]) }))); });
    Object.keys(D.ach).filter(function (k) { return k.indexOf('g:') !== 0; }).sort(function (a, b) { return D.ach[b].at - D.ach[a].at; }).forEach(function (k) { var A = D.ach[k], g = BY[A.game]; ag.append(h('div', { class: 'ach' }, h('span', { text: g ? g.icon : '🏆' }), h('span', { text: A.label ? t(A.label) : k }))); });
    sec.append(ag);
    document.body.append(dr);
    sec.querySelector('.x').focus();
  }
  function clean(x) { return String(x || '').replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 16); }
  function refreshTop() { checkGlobal(); meCard(); daily(); render(); }

  // ------------------------------------------------------------------ play
  function play(g) {
    if (location.hash !== '#play-' + g.id) history.pushState(null, '', '#play-' + g.id);
    try { dispatchEvent(new HashChangeEvent('hashchange')); } catch (e) {}
    openGame(g);
  }
  function openGame(g) {
    WTG.open(g, {
      onExit: function () { if (/^#play-/.test(location.hash)) history.pushState(null, '', location.pathname + location.search); try { dispatchEvent(new HashChangeEvent('hashchange')); } catch (e) {} refreshTop(); },
      onPlay: function () { checkGlobal(); },
      onResult: function (game, r) {
        var C = dailyPick();
        if (C && C.game.id === game.id && (C.target ? r.score >= C.target : r.won)) {
          var D = WTG.data(); if (!D.daily[C.day]) { D.daily[C.day] = Date.now(); WTG.saveData(D); }
        }
        checkGlobal();
      }
    });
  }
  function fromHash() {
    var m = /^#play-([a-z0-9-]+)$/.exec(location.hash);
    if (m && BY[m[1]]) { if (!WTG.current() || WTG.current().game.id !== m[1]) openGame(BY[m[1]]); }
    else if (WTG.current()) WTG.close(true), refreshTop();
  }
  addEventListener('popstate', fromHash);

  // ------------------------------------------------------------------ start
  chrome(); chips(); meCard();
  $('loadingTxt').textContent = WTG.s('loading');
  fetch('../data/games.json?v=' + Math.floor(Date.now() / 300000), { cache: 'no-cache' }).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); }).then(function (J) {
    GAMES = (J.games || []).filter(function (g) { return g && g.enabled !== false && g.id && g.engine && /^[a-z0-9-]+$/.test(g.id) && /^[a-z0-9-]+$/.test(g.engine) && WTG.ENGINES.indexOf(g.engine) >= 0; });
    GAMES.sort(function (a, b) { return (a.order || 999) - (b.order || 999); });
    GAMES.forEach(function (g) { BY[g.id] = g; });
    checkGlobal(); featured(); daily(); meCard(); render(); fromHash();
  }).catch(function () { $('rows').innerHTML = ''; $('rows').append(h('p', { class: 'empty', text: WTG.s('fail') })); });
})();
