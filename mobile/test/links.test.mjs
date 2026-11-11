// Which screen every Wartabiye TV address opens INSIDE the app (Android App Links, iPhone Universal Links, links in
// pages and notifications). Run: node --experimental-strip-types --test test/links.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { appPathFor, appPathForUrl, isInternal } from '../src/lib/linkmap.ts';
import { systemPath } from '../src/lib/linkmap.ts';
const redirectSystemPath = ({ path }) => systemPath(path);

const S = 'https://www.wartabiyetv.com';
const cases = [
  [S + '/', '/'],
  ['https://wartabiyetv.com/', '/'],
  [S + '/war/abc-123.html', '/war/abc-123'],
  [S + '/war/abc-123', '/war/abc-123'],
  [S + '/war/abc-123.html?utm_source=wa#top', '/war/abc-123'],
  [S + '/soomaaliya/', '/section/somalia'],
  [S + '/bariga-afrika/', '/section/somalia'],
  [S + '/caalamka/', '/section/world'],
  [S + '/ciyaaraha/', '/section/sports'],
  [S + '/wararka-tooska/', '/live'],
  [S + '/toos/', '/videos'],
  [S + '/muuqaal/', '/videos'],
  [S + '/nagu-saabsan/', '/page/nagu-saabsan'],
  [S + '/xiriir/', '/page/xiriir'],
  [S + '/asturnaanta/', '/page/asturnaanta'],
  [S + '/anshaxa/', '/page/anshaxa'],
  [S + '/saxitaannada/', '/page/saxitaannada'],
  [S + '/xayeysiimaha/', '/page/xayeysiimaha'],
  [S + '/siyaasadda-xayeysiiska/', '/page/siyaasadda-xayeysiiska'],
  [S + '/#xiriir', '/page/xiriir'],
  [S + '/#caalamka', '/section/world'],
];

test('every Wartabiye TV address opens an app screen', () => {
  for (const [url, want] of cases) assert.equal(appPathForUrl(url), want, url);
});

test('the admin is never opened by the public app', () => {
  assert.equal(appPathForUrl(S + '/admin/'), null);
  assert.equal(appPathForUrl(S + '/admin/index.html'), null);
  assert.equal(appPathFor('/admin'), null);
  assert.equal(redirectSystemPath({ path: S + '/admin/', initial: true }), '/');
  assert.equal(isInternal('https://wartabiye-admin.wartabiye.workers.dev/login'), false);
});

test('other websites are not mistaken for Wartabiye TV', () => {
  for (const u of ['https://www.bbc.com/news', 'https://wartabiyetv.com.evil.example/war/x.html', 'https://evilwartabiyetv.com/war/x.html', 'http://example.org/?u=https://www.wartabiyetv.com/'])
    assert.equal(appPathForUrl(u), null, u);
});

test('links from outside the app (App Links, Universal Links, wartabiye://, notifications)', () => {
  assert.equal(redirectSystemPath({ path: S + '/war/abc.html', initial: true }), '/war/abc');
  assert.equal(redirectSystemPath({ path: 'wartabiye://war/abc', initial: false }), '/war/abc');
  assert.equal(redirectSystemPath({ path: '/war/abc', initial: false }), '/war/abc');
  assert.equal(redirectSystemPath({ path: 'wartabiye://live', initial: false }), '/live');
  assert.equal(redirectSystemPath({ path: 'wartabiye://page/xiriir', initial: false }), '/page/xiriir');
  assert.equal(redirectSystemPath({ path: 'wartabiye://section/world', initial: false }), '/section/world');
  assert.equal(redirectSystemPath({ path: S + '/caalamka/', initial: true }), '/section/world');
  assert.equal(redirectSystemPath({ path: S + '/something-unknown/', initial: true }), '/');
});
