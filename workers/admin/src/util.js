// Small helpers: encoding, hashing, encryption, one-time codes (RFC 6238), responses and security headers.
const enc = new TextEncoder();
const dec = new TextDecoder();
const subtle = globalThis.crypto.subtle;

export const now = () => Math.floor(Date.now() / 1000);

export function b64u(buf) {
  const b = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
export function unb64u(s) {
  s = String(s).replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(s + '==='.slice((s.length + 3) % 4));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
export const randomBytes = n => crypto.getRandomValues(new Uint8Array(n));
export const randomToken = (n = 32) => b64u(randomBytes(n));

export async function sha256(s) {
  return new Uint8Array(await subtle.digest('SHA-256', typeof s === 'string' ? enc.encode(s) : s));
}
export async function sha256hex(s) {
  return [...await sha256(s)].map(x => x.toString(16).padStart(2, '0')).join('');
}
export function safeEqual(a, b) {
  a = String(a); b = String(b);
  let d = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) d |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return d === 0;
}

// ---- encryption at rest (AES-256-GCM, key derived from the SESSION_SECRET Worker secret) ----------------------
const keyCache = new Map();
async function aesKey(secret) {
  if (!secret || String(secret).length < 32) throw new Error('SESSION_SECRET is missing or too short');
  if (keyCache.has(secret)) return keyCache.get(secret);
  const base = await subtle.importKey('raw', enc.encode(secret), 'HKDF', false, ['deriveKey']);
  const k = await subtle.deriveKey({ name: 'HKDF', hash: 'SHA-256', salt: enc.encode('wartabiye-admin'), info: enc.encode('data-at-rest-v1') },
    base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  keyCache.set(secret, k);
  return k;
}
export async function seal(secret, text) {
  if (text == null) return null;
  const iv = randomBytes(12);
  const ct = await subtle.encrypt({ name: 'AES-GCM', iv }, await aesKey(secret), enc.encode(String(text)));
  return 'v1.' + b64u(iv) + '.' + b64u(ct);
}
export async function unseal(secret, box) {
  if (!box) return null;
  const [v, iv, ct] = String(box).split('.');
  if (v !== 'v1') return null;
  try { return dec.decode(await subtle.decrypt({ name: 'AES-GCM', iv: unb64u(iv) }, await aesKey(secret), unb64u(ct))); }
  catch { return null; }
}
// HMAC signature for short-lived values kept in a cookie (OAuth state)
export async function hmac(secret, msg) {
  const k = await subtle.importKey('raw', enc.encode('hmac:' + secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return b64u(await subtle.sign('HMAC', k, enc.encode(msg)));
}

// ---- authenticator app codes (TOTP, RFC 6238: SHA-1, 30 s, 6 digits) ------------------------------------------
const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
export function base32(bytes) {
  let bits = 0, val = 0, out = '';
  for (const b of bytes) { val = (val << 8) | b; bits += 8; while (bits >= 5) { out += B32[(val >>> (bits - 5)) & 31]; bits -= 5; } }
  if (bits > 0) out += B32[(val << (5 - bits)) & 31];
  return out;
}
export function unbase32(s) {
  s = String(s).toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = 0, val = 0; const out = [];
  for (const c of s) { val = (val << 5) | B32.indexOf(c); bits += 5; if (bits >= 8) { out.push((val >>> (bits - 8)) & 255); bits -= 8; } }
  return new Uint8Array(out);
}
export async function totpAt(secretB32, step) {
  const key = await subtle.importKey('raw', unbase32(secretB32), { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']);
  const msg = new Uint8Array(8);
  let x = step;
  for (let i = 7; i >= 0; i--) { msg[i] = x & 255; x = Math.floor(x / 256); }
  const h = new Uint8Array(await subtle.sign('HMAC', key, msg));
  const o = h[19] & 15;
  const n = ((h[o] & 127) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3];
  return String(n % 1e6).padStart(6, '0');
}
// returns the accepted step (to block re-use) or 0; accepts the previous, current and next 30-second step
export async function verifyTotp(secretB32, code, lastStep = 0, t = Date.now()) {
  code = String(code || '').replace(/\D/g, '');
  if (code.length !== 6) return 0;
  const cur = Math.floor(t / 30000);
  for (const s of [cur, cur - 1, cur + 1]) {
    if (s <= lastStep) continue;
    if (safeEqual(await totpAt(secretB32, s), code)) return s;
  }
  return 0;
}

// ---- requests and responses --------------------------------------------------------------------------------
export function clientIp(req) { return req.headers.get('cf-connecting-ip') || req.headers.get('x-forwarded-for')?.split(',')[0].trim() || '0.0.0.0'; }
export function shortIp(ip) {
  if (ip.includes(':')) return ip.split(':').slice(0, 3).join(':') + ':…';
  const p = ip.split('.'); return p.length === 4 ? `${p[0]}.${p[1]}.x.x` : '?';
}
export function country(req) { const c = req.cf?.country; return typeof c === 'string' && /^[A-Z]{2}$/.test(c) && c !== 'XX' && c !== 'T1' ? c : ''; }
export function shortUa(ua = '') {
  const b = /Edg\//.test(ua) ? 'Edge' : /OPR\//.test(ua) ? 'Opera' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : 'Browser';
  const o = /Android/.test(ua) ? 'Android' : /iPhone|iPad|iPod/.test(ua) ? 'iOS' : /Windows/.test(ua) ? 'Windows' : /Mac OS X/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : 'device';
  return `${b} · ${o}`;
}
export function parseCookies(req) {
  const out = {};
  for (const part of (req.headers.get('cookie') || '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}
export function cookie(name, value, { maxAge, path = '/', sameSite = 'Strict' } = {}) {
  let c = `${name}=${encodeURIComponent(value)}; Path=${path}; HttpOnly; Secure; SameSite=${sameSite}`;
  if (maxAge !== undefined) c += `; Max-Age=${maxAge}`;
  return c;
}
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function securityHeaders(h, { csp } = {}) {
  h.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  h.set('X-Content-Type-Options', 'nosniff');
  h.set('Referrer-Policy', 'same-origin');   // 'no-referrer' would make browsers send "Origin: null" on our own forms
  h.set('X-Frame-Options', 'SAMEORIGIN');
  h.set('Cross-Origin-Opener-Policy', 'same-origin');
  h.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=()');
  h.set('X-Robots-Tag', 'noindex, nofollow');
  if (csp) h.set('Content-Security-Policy', csp);
  return h;
}
export function json(data, status = 200, extra = {}) {
  const h = new Headers({ 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...extra });
  return new Response(JSON.stringify(data), { status, headers: securityHeaders(h) });
}
export function redirect(to, status = 302, cookies = []) {
  const h = new Headers({ location: to, 'cache-control': 'no-store' });
  for (const c of cookies) h.append('set-cookie', c);
  return new Response(null, { status, headers: securityHeaders(h) });
}
