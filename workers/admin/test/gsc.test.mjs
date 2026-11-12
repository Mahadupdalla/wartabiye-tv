// Search Console data in the admin: real numbers from Google's API only, never invented; the key stays on the server.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, createVerify } from 'node:crypto';
import { searchConsole } from '../src/gsc.js';

const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const SA = { client_email: 'wartabiye-seo@example.iam.gserviceaccount.com', private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }) };
const req = new Request('https://admin.test/api/search-console?days=28');

test('without authorisation nothing is shown and nothing is estimated', async () => {
  const r = await (await searchConsole(req, {})).json();
  assert.equal(r.connected, false);
  assert.equal(r.reason, 'not_configured');
  assert.equal(r.totals, undefined);
});

test('a signed service-account token is exchanged and Google\'s own numbers are passed through unchanged', async () => {
  const calls = [];
  const fake = async (url, init = {}) => {
    calls.push({ url: String(url), init });
    const J = o => new Response(JSON.stringify(o), { headers: { 'content-type': 'application/json' } });
    if (String(url) === 'https://oauth2.googleapis.com/token') {
      const jwt = new URLSearchParams(init.body).get('assertion').split('.');
      const v = createVerify('RSA-SHA256'); v.update(jwt[0] + '.' + jwt[1]);
      assert.ok(v.verify(publicKey, Buffer.from(jwt[2], 'base64url')), 'JWT signed with the service-account key');
      const claims = JSON.parse(Buffer.from(jwt[1], 'base64url'));
      assert.equal(claims.iss, SA.client_email);
      assert.equal(claims.scope, 'https://www.googleapis.com/auth/webmasters.readonly', 'read-only scope');
      return J({ access_token: 'ya29.test', expires_in: 3600 });
    }
    assert.equal(init.headers.authorization, 'Bearer ya29.test');
    assert.ok(String(url).includes(encodeURIComponent('sc-domain:wartabiyetv.com')));
    if (String(url).endsWith('/sitemaps')) return J({ sitemap: [{ path: 'https://www.wartabiyetv.com/sitemap.xml', lastDownloaded: '2026-11-12T10:00:00Z', errors: '0', warnings: '0', contents: [{ type: 'web', submitted: '458' }] }] });
    const body = JSON.parse(init.body);
    if (!body.dimensions) return J({ rows: [{ clicks: 12, impressions: 340, ctr: 0.035, position: 18.2 }] });
    if (body.dimensions[0] === 'query') return J({ rows: [{ keys: ['wararka soomaaliya'], clicks: 5, impressions: 90, ctr: 0.055, position: 9.1 }] });
    if (body.dimensions[0] === 'page') return J({ rows: [{ keys: ['https://www.wartabiyetv.com/'], clicks: 7, impressions: 120, ctr: 0.058, position: 11 }] });
    return J({ rows: [{ keys: ['2026-11-01'], clicks: 1, impressions: 20 }] });
  };
  const r = await (await searchConsole(req, { GSC_SERVICE_ACCOUNT: JSON.stringify(SA) }, fake)).json();
  assert.equal(r.connected, true);
  assert.deepEqual(r.totals, { clicks: 12, impressions: 340, ctr: 0.035, position: 18.2 });
  assert.equal(r.queries[0].query, 'wararka soomaaliya');
  assert.equal(r.sitemaps[0].contents[0].submitted, '458');
  assert.ok(!JSON.stringify(r).includes('PRIVATE KEY'), 'the key never leaves the server');
});

test('a Google error is reported as an error, not as zero traffic', async () => {
  const fake = async () => new Response(JSON.stringify({ error: 'invalid_grant', error_description: 'Invalid JWT Signature.' }), { status: 400 });
  const other = { client_email: 'other@example.iam.gserviceaccount.com', private_key: SA.private_key };
  const r = await (await searchConsole(req, { GSC_SERVICE_ACCOUNT: JSON.stringify(other) }, fake)).json();
  assert.equal(r.connected, false);
  assert.equal(r.reason, 'google_error');
  assert.match(r.message, /Invalid JWT Signature/);
  assert.equal(r.totals, undefined);
});
