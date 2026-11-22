// Image search and download for /admin/ -> Image sources. No network: the providers are fake.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { imageSearch, imageFetch, IMAGE_HOSTS, commonsUrls } from '../src/images.js';

const J = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'content-type': 'application/json' } });
globalThis.fetch = async (input) => {
  const u = new URL(typeof input === 'string' ? input : input.url);
  if (u.host === 'commons.wikimedia.org' && u.pathname === '/w/api.php') return J({ query: { search: [{ title: 'File:Hassan Sheikh Mohamud 2022.jpg' }, { title: 'File:Some map.svg' }] } });
  if (u.host === 'commons.wikimedia.org' && u.pathname === '/w/index.php') return new Response('== Summary ==\n{{Information\n|description={{en|1=President Hassan Sheikh Mohamud}}\n|date=2022-06-09\n|author=[[User:X|Villa staff]]\n}}\n{{self|cc-by-sa-4.0}}\n');
  if (u.host === 'api.openverse.org') return J({ results: [{ id: 'a1', title: 'Patrol in Mogadishu', url: 'https://live.staticflickr.com/1/2.jpg', foreign_landing_url: 'https://www.flickr.com/photos/amisom/2', creator: 'AMISOM Public Information', license: 'cc0', license_version: '1.0', license_url: 'https://creativecommons.org/publicdomain/zero/1.0/', source: 'flickr', tags: [{ name: 'somalia' }] },
    { id: 'a2', title: 'no landing page', url: 'https://live.staticflickr.com/1/3.jpg', license: 'by' }] });
  if (u.host === 'live.staticflickr.com') return new Response(new Uint8Array([0xff, 0xd8, 0xff, 1, 2, 3]), { headers: { 'content-type': 'image/jpeg' } });
  if (u.host === 'upload.wikimedia.org') return new Response('<html>', { headers: { 'content-type': 'text/html' } });
  throw new Error('unexpected ' + u);
};
const req = p => new Request('https://admin.test' + p);

test('Commons search: licence, author and source page from the file page; only photos', async () => {
  const j = await (await imageSearch(req('/api/images/search?q=hassan&provider=commons'), {})).json();
  assert.equal(j.results.length, 1);
  const c = j.results[0];
  assert.equal(c.license, 'CC BY-SA 4.0'); assert.equal(c.author, 'Villa staff'); assert.match(c.pageUrl, /^https:\/\/commons\.wikimedia\.org\/wiki\/File:Hassan_Sheikh_Mohamud_2022\.jpg$/);
  assert.match(c.directUrl, /Special:FilePath/);
});
test('Openverse search: candidates without a source page are dropped; CC0 kept', async () => {
  const j = await (await imageSearch(req('/api/images/search?q=mogadishu&provider=openverse'), {})).json();
  assert.equal(j.results.length, 1); assert.equal(j.results[0].license, 'CC0'); assert.equal(j.results[0].author, 'AMISOM Public Information');
});
test('stock sources say which API key they need instead of failing', async () => {
  for (const [p, k] of [['unsplash', 'UNSPLASH_ACCESS_KEY'], ['pexels', 'PEXELS_API_KEY'], ['pixabay', 'PIXABAY_API_KEY']]) {
    const j = await (await imageSearch(req('/api/images/search?q=x&provider=' + p), {})).json();
    assert.equal(j.needsKey, k);
  }
});
test('download only from the providers\' image hosts, and only real photos', async () => {
  assert.equal((await imageFetch(req('/api/images/fetch?url=' + encodeURIComponent('https://www.reuters.com/a.jpg')))).status, 403);
  assert.equal((await imageFetch(req('/api/images/fetch?url=' + encodeURIComponent('http://live.staticflickr.com/1/2.jpg')))).status, 403);
  const ok = await imageFetch(req('/api/images/fetch?url=' + encodeURIComponent('https://live.staticflickr.com/1/2.jpg')));
  assert.equal(ok.status, 200); assert.equal(ok.headers.get('content-type'), 'image/jpeg');
  assert.equal((await imageFetch(req('/api/images/fetch?url=' + encodeURIComponent('https://upload.wikimedia.org/x.jpg')))).status, 502);
  assert.ok(IMAGE_HOSTS.test('images.unsplash.com') && !IMAGE_HOSTS.test('evil.example'));
  assert.match(commonsUrls('File:A b.jpg').page, /File:A_b\.jpg$/);
});
