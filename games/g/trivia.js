/* Trivia quiz: 10 general-knowledge questions, a timer and one 50:50 help per game. Child-safe questions in Somali
   and English. The admin can add a custom quiz (options.questions). Original questions. */
WTG.register('trivia', function (api) {
  var h = api.h;
  // [question, answers (first is correct), level 1 easy … 3 hard]
  var Q = [
    [{ so: 'Waa maxay caasimadda Soomaaliya?', en: 'What is the capital of Somalia?' }, [{ so: 'Muqdisho', en: 'Mogadishu' }, { so: 'Hargeysa', en: 'Hargeisa' }, { so: 'Kismaayo', en: 'Kismayo' }, { so: 'Baydhabo', en: 'Baidoa' }], 1],
    [{ so: 'Calanka Soomaaliya xiddigtiisu waa midab noocee ah?', en: 'What colour is the star on the flag of Somalia?' }, [{ so: 'Cad', en: 'White' }, { so: 'Jaalle', en: 'Yellow' }, { so: 'Cas', en: 'Red' }, { so: 'Cagaar', en: 'Green' }], 1],
    [{ so: 'Imisa maalmood ayuu toddobaadku leeyahay?', en: 'How many days are there in a week?' }, [{ so: '7', en: '7' }, { so: '5', en: '5' }, { so: '6', en: '6' }, { so: '10', en: '10' }], 1],
    [{ so: 'Meeraha aan ku nool nahay waa?', en: 'Which planet do we live on?' }, [{ so: 'Dhulka', en: 'Earth' }, { so: 'Marikh', en: 'Mars' }, { so: 'Zuhal', en: 'Saturn' }, { so: 'Qamar', en: 'Venus' }], 1],
    [{ so: 'Xayawaanka ugu dheer adduunka waa?', en: 'What is the tallest animal in the world?' }, [{ so: 'Geri', en: 'Giraffe' }, { so: 'Maroodi', en: 'Elephant' }, { so: 'Geel', en: 'Camel' }, { so: 'Libaax', en: 'Lion' }], 1],
    [{ so: 'Imisa ciyaartoy ayaa koox kubadda cagta ah garoonka ku jira?', en: 'How many players does a football team have on the pitch?' }, [{ so: '11', en: '11' }, { so: '9', en: '9' }, { so: '7', en: '7' }, { so: '12', en: '12' }], 1],
    [{ so: 'Biyuhu waxay ku karaan heerkul imisa ah (°C)?', en: 'At what temperature does water boil (°C)?' }, [{ so: '100', en: '100' }, { so: '50', en: '50' }, { so: '0', en: '0' }, { so: '200', en: '200' }], 1],
    [{ so: 'Webiga ugu dheer Afrika waa?', en: 'What is the longest river in Africa?' }, [{ so: 'Niil', en: 'Nile' }, { so: 'Shabeelle', en: 'Shabelle' }, { so: 'Kongo', en: 'Congo' }, { so: 'Niger', en: 'Niger' }], 2],
    [{ so: 'Midabyada aasaasiga ah kee ka mid ah?', en: 'Which of these is a primary colour?' }, [{ so: 'Buluug', en: 'Blue' }, { so: 'Cagaar', en: 'Green' }, { so: 'Oranji', en: 'Orange' }, { so: 'Guduud', en: 'Purple' }], 1],
    [{ so: 'Badweynta ugu weyn adduunka waa?', en: 'Which is the largest ocean in the world?' }, [{ so: 'Baasifigga', en: 'Pacific' }, { so: 'Hindiya', en: 'Indian' }, { so: 'Atlantigga', en: 'Atlantic' }, { so: 'Arctic', en: 'Arctic' }], 2],
    [{ so: 'Soomaaliya waxay ku taal qaaradda?', en: 'Somalia is on which continent?' }, [{ so: 'Afrika', en: 'Africa' }, { so: 'Aasiya', en: 'Asia' }, { so: 'Yurub', en: 'Europe' }, { so: 'Ameerika', en: 'America' }], 1],
    [{ so: 'Geedaha waxay hawada ka qaataan gaas noocee ah si ay cunto u sameeyaan?', en: 'Which gas do plants take from the air to make food?' }, [{ so: 'Kaarboon daay-oksaayd', en: 'Carbon dioxide' }, { so: 'Oksijiin', en: 'Oxygen' }, { so: 'Nitrojiin', en: 'Nitrogen' }, { so: 'Hiliyam', en: 'Helium' }], 2],
    [{ so: 'Imisa daqiiqo ayay saacaddu leedahay?', en: 'How many minutes are in an hour?' }, [{ so: '60', en: '60' }, { so: '100', en: '100' }, { so: '30', en: '30' }, { so: '24', en: '24' }], 1],
    [{ so: '9 × 8 = ?', en: '9 × 8 = ?' }, [{ so: '72', en: '72' }, { so: '64', en: '64' }, { so: '81', en: '81' }, { so: '98', en: '98' }], 2],
    [{ so: 'Qorraxdu waxay ka soo baxdaa jihada?', en: 'The sun rises in the…' }, [{ so: 'Bari', en: 'East' }, { so: 'Galbeed', en: 'West' }, { so: 'Waqooyi', en: 'North' }, { so: 'Koonfur', en: 'South' }], 1],
    [{ so: 'Lafaha jirka qofka weyn waa ilaa imisa?', en: 'About how many bones are in an adult human body?' }, [{ so: '206', en: '206' }, { so: '106', en: '106' }, { so: '306', en: '306' }, { so: '56', en: '56' }], 3],
    [{ so: 'Meeraha ugu weyn nidaamka qorraxda waa?', en: 'What is the largest planet in the solar system?' }, [{ so: 'Mushtari (Jupiter)', en: 'Jupiter' }, { so: 'Dhulka', en: 'Earth' }, { so: 'Marikh', en: 'Mars' }, { so: 'Neptune', en: 'Neptune' }], 2],
    [{ so: 'Soomaaliya xorriyadda waxay qaadatay sanadkee?', en: 'In which year did Somalia become independent?' }, [{ so: '1960', en: '1960' }, { so: '1950', en: '1950' }, { so: '1970', en: '1970' }, { so: '1945', en: '1945' }], 2],
    [{ so: 'Shinnidu waxay sameysaa?', en: 'What do bees make?' }, [{ so: 'Malab', en: 'Honey' }, { so: 'Caano', en: 'Milk' }, { so: 'Sonkor', en: 'Sugar' }, { so: 'Rooti', en: 'Bread' }], 1],
    [{ so: 'Saddexagal (triangle) imisa dhinac ayuu leeyahay?', en: 'How many sides does a triangle have?' }, [{ so: '3', en: '3' }, { so: '4', en: '4' }, { so: '5', en: '5' }, { so: '6', en: '6' }], 1],
    [{ so: 'Xeebta ugu dheer dhul-weynaha Afrika waxaa leh?', en: 'Which country has the longest coastline on mainland Africa?' }, [{ so: 'Soomaaliya', en: 'Somalia' }, { so: 'Kenya', en: 'Kenya' }, { so: 'Masar', en: 'Egypt' }, { so: 'Itoobiya', en: 'Ethiopia' }], 3],
    [{ so: 'Kumbuyuutarka "maskaxdiisa" waxaa la yiraahdaa?', en: 'What is called the "brain" of a computer?' }, [{ so: 'CPU (processor)', en: 'CPU (processor)' }, { so: 'Shaashad', en: 'Screen' }, { so: 'Kiiboodh', en: 'Keyboard' }, { so: 'Jiir (mouse)', en: 'Mouse' }], 2],
    [{ so: 'Biyuhu marka ay barafoobaan waxay noqdaan?', en: 'When water freezes it becomes…' }, [{ so: 'Baraf', en: 'Ice' }, { so: 'Uumi', en: 'Steam' }, { so: 'Ciid', en: 'Sand' }, { so: 'Roob', en: 'Rain' }], 1],
    [{ so: 'Waa imisa 15 + 27?', en: 'What is 15 + 27?' }, [{ so: '42', en: '42' }, { so: '32', en: '32' }, { so: '41', en: '41' }, { so: '52', en: '52' }], 1],
    [{ so: 'Xayawaankee ayaa loo yaqaan "markabka lamadegaanka"?', en: 'Which animal is called the "ship of the desert"?' }, [{ so: 'Geel', en: 'Camel' }, { so: 'Faras', en: 'Horse' }, { so: 'Dameer', en: 'Donkey' }, { so: 'Ari', en: 'Goat' }], 1],
    [{ so: 'Ciyaaraha Olombikada waxaa la qabtaa sanad kasta oo imisa ah?', en: 'The Summer Olympic Games are held every how many years?' }, [{ so: '4', en: '4' }, { so: '2', en: '2' }, { so: '5', en: '5' }, { so: '1', en: '1' }], 2],
    [{ so: 'Hal kiilo (kg) waa imisa garaam?', en: 'One kilogram is how many grams?' }, [{ so: '1000', en: '1000' }, { so: '100', en: '100' }, { so: '10', en: '10' }, { so: '10000', en: '10000' }], 1],
    [{ so: 'Dalka ugu dadka badan adduunka (2024) waa?', en: 'Which country had the largest population in 2024?' }, [{ so: 'Hindiya', en: 'India' }, { so: 'Maraykanka', en: 'USA' }, { so: 'Brazil', en: 'Brazil' }, { so: 'Ruushka', en: 'Russia' }], 3],
    [{ so: 'Iftiinku wuu ka dheereeyaa codka. Run ama been?', en: 'Light travels faster than sound. True or false?' }, [{ so: 'Run', en: 'True' }, { so: 'Been', en: 'False' }], 2],
    [{ so: 'Gacanta qofku imisa far ayay leedahay?', en: 'How many fingers are on one human hand?' }, [{ so: '5', en: '5' }, { so: '4', en: '4' }, { so: '6', en: '6' }, { so: '10', en: '10' }], 1],
    [{ so: 'Buurta ugu dheer Afrika waa?', en: 'What is the highest mountain in Africa?' }, [{ so: 'Kilimanjaro', en: 'Kilimanjaro' }, { so: 'Kenya', en: 'Mount Kenya' }, { so: 'Shimbiris', en: 'Shimbiris' }, { so: 'Atlas', en: 'Atlas' }], 2],
    [{ so: 'Buurta ugu dheer Soomaaliya waa?', en: 'What is the highest mountain in Somalia?' }, [{ so: 'Shimbiris', en: 'Shimbiris' }, { so: 'Kilimanjaro', en: 'Kilimanjaro' }, { so: 'Everest', en: 'Everest' }, { so: 'Bur Dhexe', en: 'Bur Dhexe' }], 3],
    [{ so: 'Waa imisa 100 − 37?', en: 'What is 100 − 37?' }, [{ so: '63', en: '63' }, { so: '73', en: '73' }, { so: '67', en: '67' }, { so: '53', en: '53' }], 2],
    [{ so: 'Xilliga roobka badan ee Soomaaliya ugu weyn waxaa la yiraahdaa?', en: 'What is the main rainy season in Somalia called?' }, [{ so: 'Gu', en: 'Gu' }, { so: 'Jiilaal', en: 'Jilal' }, { so: 'Xagaa', en: 'Hagaa' }, { so: 'Dayr', en: 'Deyr' }], 3],
    [{ so: 'Qalabka lagu arko xiddigaha fog waa?', en: 'Which tool do we use to see faraway stars?' }, [{ so: 'Teleskoob', en: 'Telescope' }, { so: 'Mikroskoob', en: 'Microscope' }, { so: 'Heerkulbeeg', en: 'Thermometer' }, { so: 'Kamarad', en: 'Camera' }], 2],
    [{ so: 'Waa imisa 12 × 12?', en: 'What is 12 × 12?' }, [{ so: '144', en: '144' }, { so: '124', en: '124' }, { so: '122', en: '122' }, { so: '148', en: '148' }], 3],
    [{ so: 'Shan geesood (pentagon) imisa dhinac ayuu leeyahay?', en: 'How many sides does a pentagon have?' }, [{ so: '5', en: '5' }, { so: '6', en: '6' }, { so: '8', en: '8' }, { so: '4', en: '4' }], 2],
    [{ so: 'Wadnaha qofku wuxuu dhiigga u diraa?', en: 'The heart pumps…' }, [{ so: 'Dhiig', en: 'Blood' }, { so: 'Hawo', en: 'Air' }, { so: 'Cunto', en: 'Food' }, { so: 'Biyo', en: 'Water' }], 1],
    [{ so: 'Sanad caadi ah imisa maalmood ayuu leeyahay?', en: 'How many days are in a normal year?' }, [{ so: '365', en: '365' }, { so: '360', en: '360' }, { so: '366', en: '366' }, { so: '300', en: '300' }], 1],
    [{ so: 'Xayawaankee ayaa ugu dheereeya orodka?', en: 'Which land animal is the fastest runner?' }, [{ so: 'Haramcad (cheetah)', en: 'Cheetah' }, { so: 'Libaax', en: 'Lion' }, { so: 'Faras', en: 'Horse' }, { so: 'Gorayo', en: 'Ostrich' }], 2]
  ];
  var css = h('style', { text: '.tq{width:min(100%,680px);display:flex;flex-direction:column;gap:12px;align-items:stretch}.tq .bar{height:8px;border-radius:6px;background:rgba(255,255,255,.15);overflow:hidden}.tq .bar i{display:block;height:100%;background:linear-gradient(90deg,#22c55e,#facc15,#ef4444);transition:width .1s linear}.tq .n{display:flex;justify-content:space-between;font-weight:800;color:#bcd3ee}.tq .qq{font-size:clamp(20px,3.6vmin,30px);font-weight:800;text-align:center;background:rgba(255,255,255,.08);border-radius:18px;padding:20px 16px;line-height:1.3}.tq .ans{display:grid;grid-template-columns:1fr 1fr;gap:10px}@media(max-width:520px){.tq .ans{grid-template-columns:1fr}}.tq .ans button{font-size:clamp(17px,3vmin,22px);text-align:center;padding:16px 12px}' });
  var list, idx, right, timeLeft, perQ, used5050, answered, tId, pausedQ = false;
  function pool() {
    var custom = api.opts.questions;
    if (custom && custom.length) return api.shuffle(custom.map(function (c) { return [c.q, c.a, 2]; }));
    var max = { easy: 2, medium: 3, hard: 3 }[api.level], min = api.level === 'hard' ? 2 : 1;
    return api.shuffle(Q.filter(function (q) { return q[2] <= max && q[2] >= min; }));
  }
  function show() {
    var q = list[idx], answers = q[1].map(function (a, i) { return { a: a, ok: i === 0 }; });
    answers = api.shuffle(answers); answered = false; timeLeft = perQ;
    api.el.innerHTML = '';
    var timeBar = h('i', { style: { width: '100%' } });
    var btns = answers.map(function (A) { return h('button', { type: 'button', class: 'g-btn', text: api.t(A.a), onclick: function () { pick(A, this); } }); });
    var help = h('button', { type: 'button', class: 'g-btn sm', text: '50 : 50', disabled: used5050 || answers.length < 4, onclick: function () { if (used5050) return; used5050 = true; help.disabled = true; var wrong = btns.filter(function (b, i) { return !answers[i].ok; }); api.shuffle(wrong).slice(0, 2).forEach(function (b) { b.disabled = true; b.style.visibility = 'hidden'; }); } });
    api.el.append(css, h('div', { class: 'tq' }, h('div', { class: 'n' }, h('span', { text: (idx + 1) + ' / ' + list.length }), h('span', { text: '✓ ' + right })), h('div', { class: 'bar' }, timeBar), h('div', { class: 'qq', text: api.t(q[0]) }), h('div', { class: 'ans' }, btns), h('div', { class: 'g-row' }, help)));
    clearInterval(tId);
    tId = setInterval(function () {
      if (api.paused || answered) return;
      timeLeft -= 0.1; timeBar.style.width = Math.max(0, timeLeft / perQ * 100) + '%';
      if (timeLeft <= 0) { answered = true; api.sfx('bad'); btns.forEach(function (b, i) { b.disabled = true; if (answers[i].ok) b.classList.add('ok'); }); api.after(1300, next); }
    }, 100);
    function pick(A, b) {
      if (answered || api.paused) return; answered = true;
      btns.forEach(function (x, i) { x.disabled = true; if (answers[i].ok) x.classList.add('ok'); });
      if (A.ok) { right++; api.add(100 + Math.round(timeLeft * 10)); api.sfx('good'); } else { b.classList.add('no'); api.sfx('bad'); }
      api.after(1100, next);
    }
  }
  function next() {
    idx++;
    if (idx >= list.length) { clearInterval(tId); if (right === list.length) api.achieve('perfect', { so: 'Dhammaan waa sax!', en: 'All answers right!' }); var won = right >= Math.ceil(list.length * 0.6); api.end({ won: won, score: api.score, msg: { so: right + ' / ' + list.length + ' sax ah', en: right + ' / ' + list.length + ' correct' } }); return; }
    show();
  }
  return {
    start: function () { list = pool().slice(0, api.cfg('n', 10)); idx = 0; right = 0; used5050 = false; perQ = api.cfg('time', { easy: 25, medium: 18, hard: 12 }[api.level]); show(); },
    destroy: function () { clearInterval(tId); },
    key: function (e, down) { if (!down) return; var n = parseInt(e.key, 10); if (n >= 1 && n <= 4) { var b = api.el.querySelectorAll('.ans button')[n - 1]; if (b && !b.disabled) { e.preventDefault(); b.click(); } } }
  };
});
