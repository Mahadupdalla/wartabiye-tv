/* Draw & Doodle: free drawing with brushes, colours, stickers, eraser and undo. Save the drawing to the device. */
WTG.register('draw', function (api) {
  var h = api.h, SO = api.lang === 'so', W = 800, H = 560;
  var C = api.canvas(W, H, 130), x = C.ctx;
  var PAL = ['#111827', '#ef4444', '#f97316', '#facc15', '#22c55e', '#037BDC', '#a855f7', '#ec4899', '#a16207', '#ffffff'];
  var STK = ['⭐', '❤️', '🌸', '🐱', '🌈', '☀️', '🚗', '🎈'];
  var color = PAL[1], size = 10, tool = 'pen', sticker = STK[0], strokes = 0, hist = [], drawing = false, last = null;
  var PAPER = api.cfg('paper', '#ffffff');
  function clear() { x.fillStyle = PAPER; x.fillRect(0, 0, W, H); }
  function snap() { try { hist.push(x.getImageData(0, 0, C.cv.width, C.cv.height)); if (hist.length > 20) hist.shift(); } catch (e) {} }
  function undo() { var d = hist.pop(); if (d) x.putImageData(d, 0, 0); }
  C.cv.style.background = PAPER; C.cv.style.cursor = 'crosshair';
  C.cv.addEventListener('pointerdown', function (e) {
    if (api.paused) return; e.preventDefault(); C.cv.setPointerCapture(e.pointerId); snap();
    var p = C.pt(e);
    if (tool === 'sticker') { x.font = size * 6 + 'px serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(sticker, p.x, p.y); api.sfx('pop'); strokes++; api.add(1); return; }
    drawing = true; last = p; dot(p);
  });
  C.cv.addEventListener('pointermove', function (e) { if (!drawing) return; var p = C.pt(e); x.strokeStyle = tool === 'eraser' ? PAPER : color; x.lineWidth = tool === 'eraser' ? size * 3 : size; x.lineCap = 'round'; x.lineJoin = 'round'; x.beginPath(); x.moveTo(last.x, last.y); x.lineTo(p.x, p.y); x.stroke(); last = p; });
  C.cv.addEventListener('pointerup', function () { if (drawing) { drawing = false; strokes++; api.add(1); if (strokes === 50) api.achieve('50', { so: '50 xarriiq', en: '50 strokes' }); } });
  function dot(p) { x.fillStyle = tool === 'eraser' ? PAPER : color; x.beginPath(); x.arc(p.x, p.y, (tool === 'eraser' ? size * 3 : size) / 2, 0, 7); x.fill(); }
  var bar = h('div', { class: 'g-row', style: { maxWidth: '820px' } });
  function ui() {
    bar.innerHTML = '';
    PAL.forEach(function (c) { bar.append(h('button', { type: 'button', 'aria-label': c, style: { width: '34px', height: '34px', borderRadius: '50%', background: c, border: c === color && tool === 'pen' ? '3px solid #ffb703' : '2px solid rgba(255,255,255,.5)', cursor: 'pointer' }, onclick: function () { color = c; tool = 'pen'; ui(); } })); });
    [[4, '•'], [10, '●'], [22, '⬤']].forEach(function (s) { bar.append(h('button', { type: 'button', class: 'g-btn sm' + (size === s[0] ? ' blue' : ''), text: s[1], 'aria-label': 'size ' + s[0], onclick: function () { size = s[0]; ui(); } })); });
    bar.append(h('button', { type: 'button', class: 'g-btn sm' + (tool === 'eraser' ? ' blue' : ''), text: '🧽', 'aria-label': 'Eraser', onclick: function () { tool = 'eraser'; ui(); } }));
    STK.forEach(function (s) { bar.append(h('button', { type: 'button', class: 'g-btn sm' + (tool === 'sticker' && sticker === s ? ' blue' : ''), text: s, onclick: function () { tool = 'sticker'; sticker = s; ui(); } })); });
    bar.append(h('button', { type: 'button', class: 'g-btn sm', text: '↶', 'aria-label': 'Undo', onclick: undo }),
      h('button', { type: 'button', class: 'g-btn sm', text: '🗑️', 'aria-label': SO ? 'Masax' : 'Clear', onclick: function () { snap(); clear(); } }),
      h('button', { type: 'button', class: 'g-btn sm', text: '💾', 'aria-label': SO ? 'Kaydi' : 'Save', onclick: function () { try { var a = document.createElement('a'); a.href = C.cv.toDataURL('image/png'); a.download = 'wartabiye-drawing.png'; document.body.append(a); a.click(); a.remove(); api.sfx('good'); } catch (e) {} } }),
      h('button', { type: 'button', class: 'g-btn sm blue', text: '✓', 'aria-label': SO ? 'Waan dhammeeyay' : 'Finished', onclick: function () { api.achieve('art', { so: 'Sawir la dhammeeyay', en: 'Finished a drawing' }); api.win(api.score, { so: strokes + ' xarriiq', en: strokes + (strokes === 1 ? ' stroke' : ' strokes') }); } }));
  }
  var wrap = h('div', { class: 'g-col' }); api.el.append(wrap); wrap.append(C.cv, bar);
  return { start: function () { clear(); strokes = 0; hist = []; ui(); } };
});
