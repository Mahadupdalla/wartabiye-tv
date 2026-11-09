// Wartabiye TV daily opening hours, decided on Cloudflare's server for every request.
// Open 07:00 -> 24:00 Africa/Nairobi (EAT, UTC+3, no summer time). Closed 00:00 -> 07:00: public pages answer
// 503 + Retry-After with the branded closed page. Nothing is deleted or changed; machine files the automation and
// search engines need (robots.txt, sitemap, RSS, /data/*.json, the admin redirect) keep answering normally.

const DAY = 86400000;

export function hm(s) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(s || '').trim());
  if (!m || +m[1] > 24 || +m[2] > 59) throw new Error('bad time ' + s);
  return (+m[1] * 60 + +m[2]) % 1440;
}

export function config(env = {}) {
  return {
    off: Number(env.TZ_OFFSET_MINUTES ?? 180),
    open: hm(env.OPEN ?? '07:00'),
    close: hm(env.CLOSE ?? '00:00'),
    on: String(env.CLOSURE ?? 'on').toLowerCase() !== 'off',
  };
}

// minutes since local midnight
const localMin = (ms, c) => Math.floor((((ms + c.off * 60000) % DAY) + DAY) % DAY / 60000);

export function isClosed(ms, c) {
  if (!c.on || c.open === c.close) return false;
  const m = localMin(ms, c);
  return c.close < c.open ? m >= c.close && m < c.open : m >= c.close || m < c.open;
}

// next moment (UTC ms) the local clock shows `minute`, strictly after ms
export function nextAt(ms, minute, c) {
  const local = ms + c.off * 60000;
  let t = Math.floor(local / DAY) * DAY + minute * 60000;
  if (t <= local) t += DAY;
  return t - c.off * 60000;
}

// Files that stay reachable at night: search-engine and automation files, the admin entrance, and what the closed page
// itself shows. None of them is a readable page of the website.
const EXEMPT = [
  /^\/robots\.txt$/, /^\/sitemap[^/]*\.xml$/, /^\/rss\.xml$/, /^\/google[0-9a-f]+\.html$/, /^\/\.well-known\//,
  /^\/admin(\/|$)/, /^\/data\/[^?]*\.json$/, /^\/sw\.js$/, /^\/manifest\.webmanifest$/, /^\/favicon\.ico$/,
  /^\/img\/(logo|icon-192|icon-512)\.png$/,
];
export const exempt = (path) => EXEMPT.some((r) => r.test(path));

// ---------- owner preview (optional secret OWNER_PREVIEW_KEY) ----------
const enc = new TextEncoder();
const COOKIE = 'wtv_owner';
function same(a, b) {
  a = String(a); b = String(b);
  let d = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) d |= (a.charCodeAt(i) | 0) ^ (b.charCodeAt(i) | 0);
  return d === 0;
}
async function sign(key, msg) {
  const k = await crypto.subtle.importKey('raw', enc.encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const s = new Uint8Array(await crypto.subtle.sign('HMAC', k, enc.encode(msg)));
  return [...s].map((b) => b.toString(16).padStart(2, '0')).join('');
}
async function ownerCookie(key, now) {
  const exp = String(now + 8 * 3600000);
  return exp + '.' + (await sign(key, 'owner-preview:' + exp));
}
export async function isOwner(req, env, now) {
  const key = env.OWNER_PREVIEW_KEY;
  if (!key || key.length < 16) return false;
  const v = (req.headers.get('cookie') || '').split(/;\s*/).find((x) => x.startsWith(COOKIE + '='));
  if (!v) return false;
  const [exp, sig] = v.slice(COOKIE.length + 1).split('.');
  if (!exp || !sig || !(+exp > now)) return false;
  return same(sig, await sign(key, 'owner-preview:' + exp));
}

// ---------- the closed page ----------
const DAYS = ['Axad', 'Isniin', 'Talaado', 'Arbaco', 'Khamiis', 'Jimce', 'Sabti'];
const MONTHS = ['Janaayo', 'Febraayo', 'Maarso', 'Abriil', 'May', 'Juun', 'Luulyo', 'Ogost', 'Sebtembar', 'Oktoobar', 'Nofembar', 'Desembar'];
export function openLabel(openMs, c) {
  const d = new Date(openMs + c.off * 60000);
  const h = d.getUTCHours(), m = String(d.getUTCMinutes()).padStart(2, '0');
  const part = h < 12 ? 'subaxnimo' : h < 17 ? 'galabnimo' : 'fiidnimo';
  return `${DAYS[d.getUTCDay()]}, ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()} · ${(h % 12) || 12}:${m} ${part} (EAT)`;
}
function left(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60];
}
const pad = (n) => String(n).padStart(2, '0');

export function closedPage(now, openMs, c) {
  const [h, m, s] = left(openMs - now);
  return `<!doctype html>
<html lang="so">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="color-scheme" content="light dark">
<meta name="theme-color" content="#037BDC">
<title>Wartabiye TV · Waa xiran yahay</title>
<link rel="icon" href="/img/logo.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,500..900&family=Public+Sans:wght@400;500;600;700&display=swap">
<script>try{var t=localStorage.getItem('wartabiye-theme');if(t==='dark'||t==='light')document.documentElement.dataset.theme=t}catch(e){}</script>
<style>
:root{--blue:#037BDC;--blue-d:#0263b3;--red:#F2060A;--bg:#f4f7fb;--surface:#fff;--fg:#0b1c33;--muted:#4a5b73;--line:#d7dde6;--chip:#eef3f9;--link:#037BDC;
--shadow:0 4px 10px rgba(11,28,51,.08),0 14px 34px rgba(11,28,51,.10);--display:"Archivo","Arial Narrow",Arial,sans-serif;--body:"Public Sans",system-ui,-apple-system,"Segoe UI",sans-serif;color-scheme:light}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--bg:#0a1424;--surface:#111e33;--fg:#e7eef8;--muted:#a7b6cb;--line:#22324c;--chip:#1a2b46;--link:#6cb6ff;--shadow:0 8px 28px rgba(0,0,0,.45);color-scheme:dark}}
:root[data-theme="dark"]{--bg:#0a1424;--surface:#111e33;--fg:#e7eef8;--muted:#a7b6cb;--line:#22324c;--chip:#1a2b46;--link:#6cb6ff;--shadow:0 8px 28px rgba(0,0,0,.45);color-scheme:dark}
*{box-sizing:border-box}
html,body{height:100%}
body{margin:0;background:var(--bg);color:var(--fg);font-family:var(--body);line-height:1.55;-webkit-font-smoothing:antialiased;display:flex;flex-direction:column}
.bar{background:var(--blue-d);border-bottom:4px solid var(--red);padding:12px max(16px,env(safe-area-inset-left)) 12px max(16px,env(safe-area-inset-right));padding-top:max(12px,env(safe-area-inset-top))}
.bar .in{max-width:1240px;margin:0 auto;display:flex;align-items:center;gap:12px;color:#fff;font:800 18px/1 var(--display);letter-spacing:.01em}
.bar img{width:40px;height:40px;border-radius:50%;background:#fff}
main{flex:1;display:grid;place-items:center;padding:32px 16px}
.card{width:100%;max-width:640px;background:var(--surface);border:1px solid var(--line);border-radius:14px;box-shadow:var(--shadow);padding:40px 32px;text-align:center}
.logo{width:96px;height:96px;border-radius:50%;box-shadow:0 0 0 6px var(--chip);margin:0 auto 20px;display:block;background:#fff}
.tag{display:inline-flex;align-items:center;gap:8px;background:var(--red);color:#fff;font:700 11px/1 var(--display);letter-spacing:.12em;text-transform:uppercase;padding:7px 11px;border-radius:4px}
.tag::before{content:"";width:7px;height:7px;border-radius:50%;background:#fff}
h1{font:800 clamp(24px,5.2vw,34px)/1.15 var(--display);margin:16px 0 10px;text-wrap:balance}
.msg{font-size:17px;margin:0 auto 6px;max-width:30em;text-wrap:pretty}
.en{color:var(--muted);font-size:14px;margin:0 0 24px}
.next{font-weight:600;margin:0 0 14px}
.next span{color:var(--link)}
.cd{display:flex;justify-content:center;gap:10px;margin:0 0 8px}
.cd div{min-width:88px;background:var(--chip);border-radius:10px;padding:12px 8px}
.cd b{display:block;font:800 clamp(28px,7vw,40px)/1 var(--display);font-variant-numeric:tabular-nums;color:var(--fg)}
.cd small{display:block;margin-top:6px;font-size:12px;color:var(--muted);text-transform:uppercase;letter-spacing:.06em}
.note{color:var(--muted);font-size:13px;margin:14px 0 0}
footer{background:var(--blue-d);color:#fff;text-align:center;font-size:13px;padding:16px;padding-bottom:max(16px,env(safe-area-inset-bottom))}
@media (max-width:420px){.card{padding:28px 18px}.cd{gap:6px}.cd div{min-width:0;flex:1}}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]) .bar,:root:not([data-theme="light"]) footer{background:#04213f}}
:root[data-theme="dark"] .bar,:root[data-theme="dark"] footer{background:#04213f}
</style>
</head>
<body>
<header class="bar"><div class="in"><img src="/img/logo.png" alt="" width="40" height="40">Wartabiye TV</div></header>
<main>
  <section class="card" aria-labelledby="t">
    <img class="logo" src="/img/logo.png" alt="Wartabiye TV" width="96" height="96">
    <span class="tag">Waa xiran yahay</span>
    <h1 id="t">Habeen wanaagsan</h1>
    <p class="msg">Wartabiye TV hadda waa xiran yahay. Waxaan dib u furmaynaa 7:00 subaxnimo. Mahadsanid.</p>
    <p class="en" lang="en">Wartabiye TV is closed for the night and reopens at 7:00 AM East Africa Time. Thank you.</p>
    <p class="next">Furitaanka xiga: <span>${openLabel(openMs, c)}</span></p>
    <div class="cd" id="cd" data-open="${openMs}" data-now="${now}" role="timer" aria-live="off" aria-label="Waqtiga ka hadhay furitaanka">
      <div><b id="h">${pad(h)}</b><small>Saacadood</small></div>
      <div><b id="m">${pad(m)}</b><small>Daqiiqo</small></div>
      <div><b id="s">${pad(s)}</b><small>Ilbiriqsi</small></div>
    </div>
    <p class="note">Bogga si toos ah ayuu u furmayaa marka waqtigu dhammaado.</p>
  </section>
</main>
<footer>© Wartabiye TV · Saacadaha: 7:00 subaxnimo – 12:00 habeennimo (Africa/Nairobi)</footer>
<script>
(function(){var el=document.getElementById('cd');if(!el)return;var open=+el.dataset.open,skew=+el.dataset.now-Date.now(),done=false;
function p(n){return(n<10?'0':'')+n}
function tick(){var ms=open-(Date.now()+skew),s=Math.max(0,Math.ceil(ms/1000));
document.getElementById('h').textContent=p(Math.floor(s/3600));document.getElementById('m').textContent=p(Math.floor(s%3600/60));document.getElementById('s').textContent=p(s%60);
if(s<=0&&!done){done=true;setTimeout(function(){location.reload()},1500+Math.random()*8000)}}
tick();setInterval(tick,1000);
document.addEventListener('visibilitychange',function(){if(!document.hidden)tick()});})();
</script>
</body>
</html>`;
}

export function closedResponse(req, now, c) {
  const openMs = nextAt(now, c.open, c);
  const headers = {
    'content-type': 'text/html; charset=utf-8',
    'retry-after': String(Math.max(60, Math.ceil((openMs - now) / 1000))),
    'cache-control': 'no-store',
    'x-wartabiye-hours': 'closed',
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'strict-origin-when-cross-origin',
  };
  return new Response(req.method === 'HEAD' ? null : closedPage(now, openMs, c), { status: 503, headers });
}

export async function handle(req, env, now = Date.now(), origin = fetch) {
  const c = config(env);
  const url = new URL(req.url);

  // owner preview: /?furo=<OWNER_PREVIEW_KEY> sets a signed 8-hour cookie and removes the key from the address bar
  const furo = url.searchParams.get('furo');
  if (furo !== null && env.OWNER_PREVIEW_KEY && env.OWNER_PREVIEW_KEY.length >= 16 && same(furo, env.OWNER_PREVIEW_KEY)) {
    url.searchParams.delete('furo');
    return new Response(null, { status: 303, headers: {
      location: url.pathname + url.search, 'cache-control': 'no-store',
      'set-cookie': `${COOKIE}=${await ownerCookie(env.OWNER_PREVIEW_KEY, now)}; Max-Age=28800; Path=/; HttpOnly; Secure; SameSite=Lax`,
    } });
  }

  if (isClosed(now, c) && !exempt(url.pathname) && !(await isOwner(req, env, now))) return closedResponse(req, now, c);

  const res = await origin(req);
  // An HTML page fetched shortly before midnight must not stay in the visitor's browser cache past closing time.
  const type = res.headers.get('content-type') || '';
  if (c.on && type.includes('text/html') && !isClosed(now, c)) {
    const untilClose = Math.floor((nextAt(now, c.close, c) - now) / 1000);
    const out = new Response(res.body, res);
    out.headers.set('cache-control', `public, max-age=${Math.max(0, Math.min(600, untilClose))}`);
    return out;
  }
  return res;
}

export default { fetch: (req, env) => handle(req, env) };
