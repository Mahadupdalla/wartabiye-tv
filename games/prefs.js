/* Wartabiye TV Games: the settings each game offers in its ⚙ Settings panel.
   WTG.PREFS[engine] = [{ k: key, l: label, v: [[value, label, swatch?], …], d: default, css?: true }]
   A game reads a choice with api.cfg(key, fallback); the value 'auto' gives the fallback, which follows the difficulty.
   css: true also puts the choice on the stage as data-<key>="value", for settings that only change the look. */
(function () {
  var WTG = window.WTG = window.WTG || {};
  var L = {
    speed: { so: 'Xawaaraha', en: 'Speed', ar: 'السرعة' }, slow: { so: 'Gaabis', en: 'Slow', ar: 'بطيء' }, normal: { so: 'Caadi', en: 'Normal', ar: 'عادي' }, fast: { so: 'Degdeg', en: 'Fast', ar: 'سريع' }, turbo: { so: 'Aad u degdeg', en: 'Very fast', ar: 'سريع جدًا' },
    size: { so: 'Cabbirka', en: 'Size', ar: 'الحجم' }, small: { so: 'Yar', en: 'Small', ar: 'صغير' }, medium: { so: 'Dhexe', en: 'Medium', ar: 'متوسط' }, large: { so: 'Weyn', en: 'Large', ar: 'كبير' }, xl: { so: 'Aad u weyn', en: 'Extra large', ar: 'كبير جدًا' },
    lives: { so: 'Nolosha', en: 'Lives', ar: 'المحاولات' }, time: { so: 'Waqtiga', en: 'Time', ar: 'الوقت' }, rounds: { so: 'Wareegyada', en: 'Rounds', ar: 'الجولات' },
    color: { so: 'Midabka', en: 'Colour', ar: 'اللون' }, board: { so: 'Midabka shaxda', en: 'Board style', ar: 'شكل اللوحة' }, camera: { so: 'Kamarada', en: 'Camera', ar: 'الكاميرا' },
    close: { so: 'Dhow', en: 'Close', ar: 'قريبة' }, far: { so: 'Fog', en: 'Far', ar: 'بعيدة' }, high: { so: 'Kor', en: 'High', ar: 'عالية' },
    moves: { so: 'Muuji dhaqaaqyada', en: 'Show possible moves', ar: 'إظهار الحركات' }, coords: { so: 'Muuji xarfaha iyo lambarada', en: 'Show coordinates', ar: 'إظهار الإحداثيات' },
    red: { so: 'Casaan', en: 'Red', ar: 'أحمر' }, blue: { so: 'Buluug', en: 'Blue', ar: 'أزرق' }, green: { so: 'Cagaar', en: 'Green', ar: 'أخضر' }, gold: { so: 'Dahab', en: 'Gold', ar: 'ذهبي' }, purple: { so: 'Guduud', en: 'Purple', ar: 'بنفسجي' }, black: { so: 'Madow', en: 'Black', ar: 'أسود' }, white: { so: 'Cad', en: 'White', ar: 'أبيض' }, orange: { so: 'Oranji', en: 'Orange', ar: 'برتقالي' }, pink: { so: 'Basbaas', en: 'Pink', ar: 'وردي' },
    wood: { so: 'Alwaax', en: 'Wood', ar: 'خشب' }, classic: { so: 'Caadi', en: 'Classic', ar: 'كلاسيكي' }, marble: { so: 'Dhagax', en: 'Marble', ar: 'رخام' }, night: { so: 'Habeen', en: 'Night', ar: 'ليلي' },
    questions: { so: 'Tirada su’aalaha', en: 'Questions', ar: 'عدد الأسئلة' }, pairs: { so: 'Tirada lammaanaha', en: 'Pairs', ar: 'عدد الأزواج' }, grid: { so: 'Cabbirka shaxda', en: 'Grid size', ar: 'حجم الشبكة' },
    target: { so: 'Dhibcaha guusha', en: 'Points to win', ar: 'نقاط الفوز' }, unlimited: { so: 'Xad la’aan', en: 'No limit', ar: 'بلا حد' }
  };
  WTG.PL = L;
  var A = ['auto', ''];
  function onoff(k, l, d, css) { return { k: k, l: l, v: (d ? [] : [['auto', '']]).concat([['on', true], ['off', false]]), d: d || 'auto', css: css }; }
  var SPEED = function (vals) { return { k: 'speed', l: L.speed, v: [A, [vals[0], L.slow], [vals[1], L.normal], [vals[2], L.fast], [vals[3], L.turbo]], d: 'auto' }; };
  var KIT = [[0x037bdc, L.blue, '#037bdc'], [0xdc2626, L.red, '#dc2626'], [0x16a34a, L.green, '#16a34a'], [0xf59e0b, L.gold, '#f59e0b'], [0x7c3aed, L.purple, '#7c3aed'], [0x111827, L.black, '#111827']];
  var BOARD = { k: 'board', l: L.board, v: [['classic', L.classic, '#5b86b5'], ['wood', L.wood, '#b58863'], ['green', L.green, '#769656'], ['marble', L.marble, '#9aa5b1'], ['night', L.night, '#334155']], d: 'classic', css: true };
  var P = {
    runner3d: [SPEED([9, 14, 18, 22]), { k: 'lives', l: L.lives, v: [A, [1, '1'], [3, '3'], [5, '5']], d: 'auto' }, { k: 'shirt', l: L.color, v: KIT, d: 0x037bdc }, { k: 'cam', l: L.camera, v: [['close', L.close], ['far', L.far]], d: 'close' }],
    runner: [SPEED([9, 14, 18, 22]), { k: 'lives', l: L.lives, v: [A, [1, '1'], [3, '3'], [5, '5']], d: 'auto' }],
    racer3d: [SPEED([20, 28, 35, 42]), { k: 'traffic', l: { so: 'Gaadiidka kale', en: 'Traffic', ar: 'حركة المرور' }, v: [['light', { so: 'Yar', en: 'Light', ar: 'خفيفة' }], ['normal', L.normal], ['heavy', { so: 'Badan', en: 'Heavy', ar: 'كثيفة' }]], d: 'normal' }, { k: 'fuel', l: { so: 'Shidaalka', en: 'Fuel', ar: 'الوقود' }, v: [['on', true], ['off', L.unlimited]], d: 'on' }, { k: 'car', l: L.color, v: KIT, d: 0x037bdc }, { k: 'cam', l: L.camera, v: [['close', L.close], ['far', L.far], ['high', L.high]], d: 'close' }],
    racer: [SPEED([200, 280, 350, 420]), { k: 'fuel', l: { so: 'Shidaalka', en: 'Fuel', ar: 'الوقود' }, v: [['on', true], ['off', L.unlimited]], d: 'on' }],
    penalty3d: [{ k: 'rounds', l: L.rounds, v: [[3, '3'], [5, '5'], [10, '10']], d: 5 }, { k: 'kit', l: L.color, v: KIT, d: 0x037bdc }],
    penalty: [{ k: 'rounds', l: L.rounds, v: [[3, '3'], [5, '5'], [10, '10']], d: 5 }],
    hoops3d: [{ k: 'time', l: L.time, v: [A, [45, '0:45'], [60, '1:00'], [90, '1:30'], [120, '2:00']], d: 'auto' }, onoff('guide', { so: 'Khadka tilmaamaha', en: 'Aim guide', ar: 'خط التصويب' }), onoff('move', { so: 'Shabag dhaqaaqa', en: 'Moving hoop', ar: 'سلة متحركة' }), { k: 'court', l: L.color, v: [['blue', L.blue, '#037bdc'], ['red', L.red, '#dc2626'], ['green', L.green, '#16a34a'], ['purple', L.purple, '#7c3aed']], d: 'blue' }],
    hoops: [{ k: 'time', l: L.time, v: [A, [45, '0:45'], [60, '1:00'], [90, '1:30'], [120, '2:00']], d: 'auto' }],
    chess: [BOARD, onoff('moves', L.moves, 'on', true), onoff('coords', L.coords, 'on', true)],
    checkers: [BOARD, onoff('moves', L.moves, 'on', true)],
    four: [{ k: 'board', l: L.board, v: [['blue', L.blue, '#037bdc'], ['red', L.red, '#b91c1c'], ['green', L.green, '#15803d'], ['black', L.black, '#1f2937']], d: 'blue' }],
    dominoes: [{ k: 'target', l: L.target, v: [A, [50, '50'], [100, '100'], [150, '150'], [200, '200']], d: 'auto' }, { k: 'table', l: L.color, v: [['green', L.green, '#166534'], ['blue', L.blue, '#1e3a8a'], ['red', L.red, '#7f1d1d'], ['wood', L.wood, '#78350f']], d: 'green' }],
    solitaire: [{ k: 'draw', l: { so: 'Kaararka la rogo', en: 'Cards per draw', ar: 'أوراق لكل سحب' }, v: [A, [1, '1'], [3, '3']], d: 'auto' }, { k: 'back', l: { so: 'Gadaasha kaarka', en: 'Card back', ar: 'ظهر الورقة' }, v: [['blue', L.blue, '#037bdc'], ['red', L.red, '#c1121f'], ['green', L.green, '#15803d'], ['black', L.black, '#1f2937']], d: 'blue', css: true }],
    snake: [SPEED([5, 8, 12, 16]), { k: 'walls', l: { so: 'Darbiyada', en: 'Walls', ar: 'الجدران' }, v: [A, ['on', { so: 'Way dilaan', en: 'Solid', ar: 'صلبة' }], ['off', { so: 'Dhex mari', en: 'Pass through', ar: 'عبور' }]], d: 'auto' }, { k: 'skin', l: L.color, v: [['green', L.green, '#22c55e'], ['blue', L.blue, '#3b82f6'], ['orange', L.orange, '#f97316'], ['pink', L.pink, '#ec4899'], ['gold', L.gold, '#facc15']], d: 'green' }],
    blocks: [SPEED([1.1, 0.65, 0.42, 0.3]), onoff('ghost', { so: 'Hooska meesha ay ku dhacayso', en: 'Landing shadow', ar: 'ظل الهبوط' }, 'on')],
    merge: [{ k: 'grid', l: L.grid, v: [A, [4, '4×4'], [5, '5×5'], [6, '6×6']], d: 'auto' }],
    sudoku: [onoff('errors', { so: 'Muuji khaladaadka', en: 'Show mistakes', ar: 'إظهار الأخطاء' })],
    trivia: [{ k: 'n', l: L.questions, v: [[5, '5'], [10, '10'], [15, '15'], [20, '20']], d: 10 }, { k: 'time', l: { so: 'Waqtiga su’aal kasta', en: 'Time per question', ar: 'وقت كل سؤال' }, v: [A, [12, '12s'], [18, '18s'], [25, '25s'], [40, '40s']], d: 'auto' }],
    brain: [{ k: 'time', l: L.time, v: [A, [30, '0:30'], [60, '1:00'], [90, '1:30'], [120, '2:00']], d: 'auto' }],
    reaction: [{ k: 'size', l: { so: 'Cabbirka bartilmaameedka', en: 'Target size', ar: 'حجم الهدف' }, v: [A, [42, L.small], [56, L.medium], [70, L.large], [90, L.xl]], d: 'auto' }],
    parking: [{ k: 'lives', l: L.lives, v: [A, [3, '3'], [5, '5'], [9, '9']], d: 'auto' }],
    maze: [{ k: 'size', l: L.size, v: [A, [7, L.small], [9, L.medium], [11, L.large], [13, L.xl]], d: 'auto' }, onoff('dark', { so: 'Mugdi (iftiin yar)', en: 'Dark maze', ar: 'متاهة مظلمة' })],
    wordsearch: [{ k: 'grid', l: L.grid, v: [A, ['easy', L.small], ['medium', L.medium], ['hard', L.large]], d: 'auto' }],
    crossword: [{ k: 'n', l: { so: 'Tirada ereyada', en: 'Words', ar: 'عدد الكلمات' }, v: [A, [6, '6'], [9, '9'], [12, '12']], d: 'auto' }],
    tiles: [{ k: 'layout', l: L.size, v: [A, ['easy', L.small], ['medium', L.medium], ['hard', L.large]], d: 'auto' }],
    memory: [{ k: 'pairs', l: L.pairs, v: [A, [4, '4'], [6, '6'], [8, '8'], [12, '12']], d: 'auto' }],
    pairs: [{ k: 'n', l: { so: 'Sawirro wareeg kasta', en: 'Pictures per round', ar: 'صور لكل جولة' }, v: [A, [3, '3'], [4, '4'], [6, '6']], d: 'auto' }, { k: 'rounds', l: L.rounds, v: [[3, '3'], [5, '5'], [8, '8']], d: 3 }],
    shapes: [{ k: 'n', l: { so: 'Qaababka wareeg kasta', en: 'Shapes per round', ar: 'أشكال لكل جولة' }, v: [A, [3, '3'], [4, '4'], [6, '6']], d: 'auto' }, { k: 'rounds', l: L.rounds, v: [[3, '3'], [5, '5'], [8, '8']], d: 3 }],
    slide: function (g) { var pic = g.options && g.options.mode === 'picture'; return [{ k: 'grid', l: L.grid, v: pic ? [A, [2, '2×2'], [3, '3×3'], [4, '4×4'], [5, '5×5']] : [A, [3, '3×3'], [4, '4×4'], [5, '5×5'], [6, '6×6']], d: 'auto' }]; },
    kidsquiz: [{ k: 'n', l: L.questions, v: [[5, '5'], [10, '10'], [15, '15'], [20, '20']], d: 10 }],
    spell: [{ k: 'n', l: { so: 'Tirada ereyada', en: 'Words', ar: 'عدد الكلمات' }, v: [[5, '5'], [8, '8'], [12, '12']], d: 8 }, { k: 'len', l: { so: 'Dhererka ereyada', en: 'Word length', ar: 'طول الكلمات' }, v: [A, [4, L.small], [6, L.medium], [8, L.large]], d: 'auto' }],
    draw: [{ k: 'paper', l: { so: 'Midabka warqadda', en: 'Paper colour', ar: 'لون الورق' }, v: [['#ffffff', L.white, '#ffffff'], ['#fef3c7', { so: 'Jaalle khafiif ah', en: 'Cream', ar: 'كريمي' }, '#fef3c7'], ['#dbeafe', L.blue, '#dbeafe'], ['#0f172a', L.black, '#0f172a']], d: '#ffffff' }],
    ludo: [{ k: 'pace', l: L.speed, v: [[1.6, L.slow], [1, L.normal], [0.5, L.fast]], d: 1 }],
    coloring: []
  };
  // the 3D games' 2D versions (no WebGL) share their settings
  WTG.PREFS = P;
})();
