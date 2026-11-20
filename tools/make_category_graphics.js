// WARTABIYE TV category graphics (img/category/<slug>.jpg, 1200x675, and w480/<slug>.webp for cards).
// Used by tools/image_system.py when no accurate, legal photo of the event exists. They carry no words except the brand,
// so they suit all nine languages; the website adds the translated label "Category graphic: <category>" on top.
// Layout: brand top-left, icon right, bottom-left kept free for the category chip the cards draw there.
// Run once after changing the design:  node tools/make_category_graphics.js   (needs Playwright + Chromium)
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..'), out = path.join(root, 'img', 'category');
const logo = 'data:image/png;base64,' + fs.readFileSync(path.join(root, 'img', 'logo.png')).toString('base64');
// icons: 24x24 strokes (same family as the site's placeholder icons in assets/app.js)
const I = {
  siyaasadda: ['#2f80ed', 'M3 21h18M5 21V10M9.5 21V10M14.5 21V10M19 21V10M2 10l10-6 10 6z'],
  amniga: ['#c0392b', 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6zM9 12l2 2 4-4'],
  bulshada: ['#16a085', 'M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM16 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM2 20c0-3 3-5 6-5s6 2 6 5M14 15.5c.6-.3 1.3-.5 2-.5 3 0 6 2 6 5'],
  dhaqaalaha: ['#e1a100', 'M3 20h18M6 17v-4M11 17V9M16 17v-6M4 9l5-4 4 3 7-5'],
  adduunka: ['#1abc9c', 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM3 12h18M12 3c3.5 3.5 3.5 14.5 0 18M12 3c-3.5 3.5-3.5 14.5 0 18'],
  ciyaaraha: ['#27ae60', 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7.5l4 2.9-1.5 4.6h-5L8 10.4zM12 3v4.5M21 10.5l-5 0M16.5 20l-2-5M7.5 20l2-5M3 10.5h5'],
  teknolojiyadda: ['#8e44ad', 'M5 5h14v10H5zM2 19h20M9 15v4M15 15v4M9 9h.01M12 9h3'],
  caafimaadka: ['#e74c3c', 'M12 21s-7-4.5-9-9.5C1.6 7.8 4 4 7.6 4c2 0 3.4 1.2 4.4 2.6C13 5.2 14.4 4 16.4 4 20 4 22.4 7.8 21 11.5 19 16.5 12 21 12 21zM12 9v6M9 12h6'],
  waxbarashada: ['#3498db', 'M2 9l10-5 10 5-10 5zM6 11v5c3 2.5 9 2.5 12 0v-5M22 9v6'],
  fikrad: ['#f39c12', 'M4 5h16v11H8l-4 4zM8 9h8M8 12h5'],
  degdeg: ['#f2060a', 'M13 2L4 14h7l-1 8 9-12h-7z'],
  soomaaliya: ['#4aa3ff', 'M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.6 6.6 19.5l1.2-6L3.3 9.3l6.1-.7z'],
  afrika: ['#d35400', 'M9 3h5l2 3 3 1 1 4-2 3-1 4-3 3h-2l-1-4-2-2-1-4-3-2 1-3z'],
  wartabiye: ['#037bdc', 'M3 7h18v13H3zM8 3l4 4 4-4'],
};
function html(color, d) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
  html,body{margin:0;width:1200px;height:675px;overflow:hidden}
  body{font-family:"Archivo","Helvetica Neue",Arial,sans-serif;background:
    radial-gradient(900px 520px at 78% 38%, ${color}55, transparent 62%),
    radial-gradient(700px 420px at 10% 110%, #037bdc55, transparent 60%),
    linear-gradient(150deg,#04162d 0%,#06264a 48%,#031326 100%);position:relative}
  .grid{position:absolute;inset:0;background-image:linear-gradient(rgba(255,255,255,.045) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.045) 1px,transparent 1px);background-size:48px 48px;
    -webkit-mask-image:radial-gradient(circle at 78% 40%,#000 0,transparent 70%)}
  .bar{position:absolute;left:0;right:0;top:0;height:10px;background:linear-gradient(90deg,#037bdc 0 72%,#f2060a 72%)}
  .rings{position:absolute;right:90px;top:100px;width:500px;height:500px;border-radius:50%;
    background:radial-gradient(circle,rgba(255,255,255,.10) 0 38%,transparent 38.5%),radial-gradient(circle,transparent 0 52%,rgba(255,255,255,.07) 52.3% 53%,transparent 53.3% 68%,rgba(255,255,255,.05) 68.3% 69%,transparent 69.3%)}
  .disc{position:absolute;right:190px;top:200px;width:300px;height:300px;border-radius:50%;background:linear-gradient(145deg,${color},${color}99);
    box-shadow:0 30px 80px ${color}66, inset 0 2px 0 rgba(255,255,255,.35);display:grid;place-items:center}
  .disc svg{width:168px;height:168px;fill:none;stroke:#fff;stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round;filter:drop-shadow(0 4px 10px rgba(0,0,0,.25))}
  .brand{position:absolute;left:72px;top:72px;display:flex;align-items:center;gap:22px}
  .brand img{width:96px;height:96px;border-radius:50%;box-shadow:0 10px 30px rgba(0,0,0,.45)}
  .brand b{color:#fff;font-size:58px;font-weight:800;letter-spacing:.5px;line-height:1}
  .brand b span{background:#f2060a;border-radius:8px;padding:2px 12px;margin-left:10px}
  .line{position:absolute;left:72px;top:196px;width:120px;height:6px;border-radius:3px;background:${color}}
  .dots{position:absolute;left:72px;top:80px;display:flex;gap:10px}.dots i{width:12px;height:12px;border-radius:50%;background:rgba(255,255,255,.18)}.dots i:first-child{background:${color}}
  </style></head><body><div class="grid"></div><div class="bar"></div>
  <div class="rings"></div><div class="disc"><svg viewBox="0 0 24 24"><path d="${d}"/></svg></div><div class="line"></div>
  <div class="brand"><img src="${logo}" alt=""><b>WARTABIYE<span>TV</span></b></div></body></html>`;
}
(async () => {
  fs.mkdirSync(path.join(out, 'w480'), { recursive: true });
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1200, height: 675 }, deviceScaleFactor: 1 });
  for (const [slug, [color, d]] of Object.entries(I)) {
    await p.setContent(html(color, d), { waitUntil: 'load' });
    await p.screenshot({ path: path.join(out, slug + '.jpg'), type: 'jpeg', quality: 86 });
    console.log('img/category/' + slug + '.jpg');
  }
  await b.close();
})();
