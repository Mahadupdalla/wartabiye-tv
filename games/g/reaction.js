/* Reaction Rush: tap as soon as the screen turns green (5 rounds), then a 20-second target round.
   Measures your reaction time in milliseconds. Original implementation. */
WTG.register('reaction', function (api) {
  var h = api.h, ROUNDS = 5;
  var T = { so: { wait: 'Sug… taabo marka uu cagaar noqdo', now: 'HADDA! Taabo!', early: 'Hore ayaad u taabatay! Sug cagaarka.', tap: 'Taabo si aad u bilowdo', ms: 'ms', targets: 'Taabo goobaabinta inta ugu badan ee aad kartid!', avg: 'Celcelis' },
    en: { wait: 'Wait… tap when it turns green', now: 'NOW! Tap!', early: 'Too early! Wait for green.', tap: 'Tap to start', ms: 'ms', targets: 'Tap as many targets as you can!', avg: 'Average' } };
  function tx(k) { return (T[api.lang] || T.en)[k] || T.en[k]; }
  var pad = h('button', { type: 'button', style: { width: 'min(92vw,640px)', height: 'min(60vh,420px)', border: '0', borderRadius: '24px', font: '900 clamp(22px,5vmin,40px)/1.2 Archivo,sans-serif', color: '#fff', cursor: 'pointer', boxShadow: '0 16px 40px rgba(0,0,0,.45)', touchAction: 'manipulation', position: 'relative', overflow: 'hidden' } });
  var log = h('div', { class: 'g-row' });
  api.el.append(h('div', { class: 'g-col' }, pad, log));
  var phase, round, times, tGo, waitT, tLeft, hits, tgtTimer, endT;
  function setPad(bg, text) { pad.style.background = bg; pad.textContent = text; }
  function nextRound() {
    phase = 'wait'; setPad('#b91c1c', tx('wait'));
    var d = api.rand(1200, api.level === 'hard' ? 4200 : 3200);
    waitT = api.after(d, function () { phase = 'go'; tGo = performance.now(); setPad('#16a34a', tx('now')); api.sfx('tick'); });
  }
  pad.addEventListener('pointerdown', function (e) {
    e.preventDefault(); if (api.paused || api.isOver()) return;
    if (phase === 'ready') { nextRound(); return; }
    if (phase === 'wait') { waitT.cancel(); api.sfx('bad'); setPad('#7c2d12', tx('early')); phase = 'pen'; times.push(1000); log.append(h('span', { class: 'g-btn sm no', text: '✗' })); api.after(1200, next); return; }
    if (phase === 'go') {
      var ms = Math.round(performance.now() - tGo); times.push(ms); api.sfx('good');
      setPad('#037BDC', ms + ' ' + tx('ms')); log.append(h('span', { class: 'g-btn sm', text: ms + ' ms' }));
      api.add(Math.max(0, 600 - ms)); if (ms < 250) api.achieve('fast', { so: 'Ka dhakhso 250 ms', en: 'Faster than 250 ms' });
      phase = 'shown'; api.after(900, next); return;
    }
    if (phase === 'targets' && e.target.dataset.t) { hits++; api.add(api.level === 'hard' ? 40 : 30); api.sfx('pop'); e.target.remove(); spawn(); }
  });
  function next() { round++; if (round < ROUNDS) nextRound(); else targets(); }
  function spawn() {
    var s = { easy: 70, medium: 56, hard: 42 }[api.level], b = h('span', { 'data-t': '1', style: { position: 'absolute', width: s + 'px', height: s + 'px', borderRadius: '50%', background: 'radial-gradient(circle,#fff 0 20%,#F2060A 21% 45%,#fff 46% 62%,#F2060A 63%)', left: Math.random() * 85 + '%', top: Math.random() * 80 + '%', boxShadow: '0 4px 10px rgba(0,0,0,.35)', animation: 'pop .2s' } });
    pad.append(b);
    if (api.level !== 'easy') { var bb = b; api.after(api.level === 'hard' ? 900 : 1400, function () { if (bb.isConnected) { bb.remove(); spawn(); } }); }
  }
  function targets() {
    phase = 'targets'; hits = 0; setPad('#04213f', ''); pad.append(h('div', { style: { position: 'absolute', top: '10px', left: 0, right: 0, fontSize: '16px', opacity: '.8' }, text: tx('targets') }));
    spawn(); tLeft = 20; api.info('⏱', tLeft);
    (function tick() { endT = api.after(1000, function () { tLeft--; api.info('⏱', tLeft); if (tLeft <= 0) finish(); else tick(); }); })();
  }
  function finish() {
    var ok = times.filter(function (t) { return t < 1000; }), avg = ok.length ? Math.round(ok.reduce(function (a, b) { return a + b; }, 0) / ok.length) : 0;
    setPad('#037BDC', tx('avg') + ': ' + (avg || '–') + ' ms');
    api.end({ won: avg && avg < 400, score: api.score, msg: { so: 'Celcelis ' + avg + ' ms · ' + hits + ' bartilmaameed', en: 'Average ' + avg + ' ms · ' + hits + ' targets' } });
  }
  return { start: function () { round = 0; times = []; log.innerHTML = ''; phase = 'ready'; setPad('#037BDC', '👆 ' + tx('tap')); }, key: function (e, down) { if (down && (e.key === ' ' || e.key === 'Enter')) { e.preventDefault(); pad.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); } } };
});
