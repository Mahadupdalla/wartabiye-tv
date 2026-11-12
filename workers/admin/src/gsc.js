// Google Search Console data for the admin (SEO & website health), through Google's official Search Console API.
// Real numbers only: clicks, impressions, CTR and average position come from Google for the verified property. Without
// the owner's authorisation nothing is shown and nothing is estimated.
//
// Authorisation (once, free): a Google Cloud service account with the "Google Search Console API" enabled, whose
// e-mail address the owner adds in Search Console -> Settings -> Users and permissions (permission "Restricted" is
// enough: read-only). Its JSON key is stored ONLY as the Cloudflare secret GSC_SERVICE_ACCOUNT (admin-deploy.yml puts it
// there from the GitHub secret of the same name). The key never reaches the browser or the repository.
import { json, b64u } from './util.js';

const SCOPE = 'https://www.googleapis.com/auth/webmasters.readonly';
const enc = new TextEncoder();
let cached = null; // { token, exp }

function pemToDer(pem) {
  const b = atob(String(pem).replace(/-----[^-]+-----/g, '').replace(/\s+/g, ''));
  const out = new Uint8Array(b.length);
  for (let i = 0; i < b.length; i++) out[i] = b.charCodeAt(i);
  return out.buffer;
}

export function serviceAccount(env) {
  try {
    const sa = JSON.parse(env.GSC_SERVICE_ACCOUNT || '');
    return sa && sa.client_email && sa.private_key ? sa : null;
  } catch { return null; }
}

// a signed JWT exchanged for a short-lived read-only access token (RFC 7523, Google's service-account flow)
async function token(sa, fetchImpl = fetch) {
  const t = Math.floor(Date.now() / 1000);
  if (cached && cached.email === sa.client_email && cached.exp > t + 60) return cached.token;
  const head = b64u(enc.encode(JSON.stringify({ alg: 'RS256', typ: 'JWT' })));
  const claims = b64u(enc.encode(JSON.stringify({ iss: sa.client_email, scope: SCOPE, aud: 'https://oauth2.googleapis.com/token', iat: t, exp: t + 3600 })));
  const key = await crypto.subtle.importKey('pkcs8', pemToDer(sa.private_key), { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const sig = b64u(new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, enc.encode(head + '.' + claims))));
  const r = await fetchImpl('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=' + encodeURIComponent('urn:ietf:params:oauth:grant-type:jwt-bearer') + '&assertion=' + head + '.' + claims + '.' + sig,
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.access_token) throw new Error('Google refused the service account (' + (j.error_description || j.error || r.status) + ')');
  cached = { token: j.access_token, exp: t + (j.expires_in || 3600), email: sa.client_email };
  return cached.token;
}

const day = d => d.toISOString().slice(0, 10);

export async function searchConsole(req, env, fetchImpl = fetch) {
  const sa = serviceAccount(env);
  const property = env.GSC_PROPERTY || 'sc-domain:wartabiyetv.com';
  if (!sa) return json({ connected: false, property, reason: 'not_configured' });
  const u = new URL(req.url);
  const days = Math.min(90, Math.max(7, parseInt(u.searchParams.get('days') || '28', 10) || 28));
  // Search Console data arrives with a delay of about 2-3 days; the range ends 3 days ago
  const end = new Date(Date.now() - 3 * 864e5), start = new Date(end.getTime() - (days - 1) * 864e5);
  try {
    const tk = await token(sa, fetchImpl);
    const base = 'https://searchconsole.googleapis.com/webmasters/v3/sites/' + encodeURIComponent(property);
    const q = (body) => fetchImpl(base + '/searchAnalytics/query', { method: 'POST', headers: { authorization: 'Bearer ' + tk, 'content-type': 'application/json' }, body: JSON.stringify(Object.assign({ startDate: day(start), endDate: day(end), dataState: 'final' }, body)) })
      .then(async r => { const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error((j.error && j.error.message) || 'HTTP ' + r.status); return j.rows || []; });
    const [total, byDay, queries, pages, sitemaps] = await Promise.all([
      q({}), q({ dimensions: ['date'] }), q({ dimensions: ['query'], rowLimit: 25 }), q({ dimensions: ['page'], rowLimit: 25 }),
      fetchImpl(base + '/sitemaps', { headers: { authorization: 'Bearer ' + tk } }).then(r => r.json()).then(j => j.sitemap || []).catch(() => []),
    ]);
    const t = total[0] || { clicks: 0, impressions: 0, ctr: 0, position: 0 };
    return json({
      connected: true, property, account: sa.client_email, startDate: day(start), endDate: day(end),
      totals: { clicks: t.clicks, impressions: t.impressions, ctr: t.ctr, position: t.position },
      days: byDay.map(r => ({ date: r.keys[0], clicks: r.clicks, impressions: r.impressions })),
      queries: queries.map(r => ({ query: r.keys[0], clicks: r.clicks, impressions: r.impressions, ctr: r.ctr, position: r.position })),
      pages: pages.map(r => ({ page: r.keys[0], clicks: r.clicks, impressions: r.impressions, ctr: r.ctr, position: r.position })),
      sitemaps: sitemaps.map(s => ({ path: s.path, lastSubmitted: s.lastSubmitted, lastDownloaded: s.lastDownloaded, errors: s.errors, warnings: s.warnings, pending: s.isPending,
        contents: (s.contents || []).map(c => ({ type: c.type, submitted: c.submitted, indexed: c.indexed })) })),
    });
  } catch (e) {
    return json({ connected: false, property, account: sa.client_email, reason: 'google_error', message: String(e.message || e).slice(0, 300) });
  }
}
