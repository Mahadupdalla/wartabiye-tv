"""Test the major international sports publishers in data/sports/publishers.json (run on GitHub Actions; this container
cannot reach most sites).

  python3 tools/sports_publishers.py probe [--out FILE]   test every candidate feed: robots.txt, does it answer with a feed,
                                                          how many items, the newest article and its time; writes
                                                          data/sports/publishers-report.json (or FILE)
  python3 tools/sports_publishers.py apply                add / update the publishers whose feed works in
                                                          data/world/sources.json (section sports, every 5 minutes)
  python3 tools/sports_publishers.py test                 self-test, no network

Only headlines, links and times are read. Honest User-Agent, robots.txt respected, one request at a time. A publisher
with no working, allowed feed is kept as a manually reviewed source (searchOnly), never scraped around a restriction."""
import json, os, sys, time, datetime
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import world_news as w

root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CFG = os.path.join(root, 'data', 'sports', 'publishers.json')
REPORT = os.path.join(root, 'data', 'sports', 'publishers-report.json')
SOURCES = os.path.join(root, 'data', 'world', 'sources.json')
EAT = datetime.timezone(datetime.timedelta(hours=3))
STALE_DAYS = 3
CREDENTIALS = {'paywall': 'subscription for full articles (headlines are free)'}


def now():
    return datetime.datetime.now(EAT).isoformat(timespec='seconds')


def listing(url, data):
    head = data.lstrip()[:400].lower()
    if b'<sitemapindex' in data[:800]:
        raise ValueError('a sitemap index (no articles in it)')
    if not head.startswith((b'<?xml', b'<rss', b'<feed', b'<urlset')) and b'<rss' not in data[:500]:
        raise ValueError('not a feed (the address answers with a web page)')
    return w.parse_feed(data)


def test_feed(url):
    r = {'url': url}
    t0 = time.time()
    try:
        if not w.allowed(url):
            r.update(ok=False, error='robots.txt does not allow automated readers'); return r
        items = listing(url, w.get(url, check=False, timeout=20))
        if not items:
            r.update(ok=False, error='feed has no items'); return r
        dated = sorted([i for i in items if i.get('publishedAt')], key=lambda i: i['publishedAt'], reverse=True)
        top = (dated or items)[0]
        r.update(ok=True, items=len(items), dated=len(dated),
                 newest={'title': top.get('title'), 'url': top.get('url'), 'publishedAt': top.get('publishedAt')})
    except Exception as e:
        r.update(ok=False, error=f'{type(e).__name__}: {str(e)[:120]}')
    r['seconds'] = round(time.time() - t0, 1)
    return r


def probe(out=REPORT):
    cfg = json.load(open(CFG, encoding='utf-8'))
    rep = {'about': 'Result of tools/sports_publishers.py probe (GitHub Actions). working = at least one feed answered '
                    'with dated articles and robots.txt allows it.', 'checkedAt': now(), 'publishers': []}
    for p in cfg['publishers']:
        home_ok = None
        try:
            home_ok = w.allowed(p['homepage'])
        except Exception:
            pass
        feeds = [test_feed(u) for u in p.get('feeds', [])]
        trans = [test_feed(u) for u in p.get('transfers', [])]
        cut = (datetime.datetime.now(EAT) - datetime.timedelta(days=STALE_DAYS)).isoformat()
        live = lambda f: f.get('ok') and f.get('dated') and ((f.get('newest') or {}).get('publishedAt') or '') >= cut
        for f in feeds + trans:
            if f.get('ok') and not live(f):
                f['ok'] = False; f['error'] = f"stale: newest article {(f.get('newest') or {}).get('publishedAt')}"
        good = [f for f in feeds if live(f)]
        good_t = [f for f in trans if live(f)]
        newest = max([f['newest'] for f in good + good_t if f['newest'].get('publishedAt')],
                     key=lambda n: n['publishedAt'], default=None)
        e = {'id': p['id'], 'name': p['name'], 'country': p.get('country'), 'homepage': p['homepage'],
             'robotsAllowsHomepage': home_ok, 'working': bool(good or good_t),
             'feeds': feeds, 'transferFeeds': trans, 'workingFeeds': [f['url'] for f in good],
             'workingTransferFeeds': [f['url'] for f in good_t], 'newestArticle': newest,
             'lastSuccessfulCheck': now() if (good or good_t) else None,
             'terms': cfg['terms'][p.get('terms', 'rss-headlines')],
             'credentials': CREDENTIALS.get(p.get('terms'), 'none'),
             'collection': 'automatic, every 5 minutes' if (good or good_t) else 'manually reviewed (no allowed feed answered)'}
        rep['publishers'].append(e)
        print(f"{'OK  ' if e['working'] else 'NONE'} {p['name']}: " + (', '.join(e['workingFeeds'] + e['workingTransferFeeds']) or
              '; '.join(f"{f['url']} {f.get('error')}" for f in feeds + trans)[:400]))
        if newest:
            print(f"       newest {newest['publishedAt']}  {(newest.get('title') or '')[:90]}")
    rep['counts'] = {'publishers': len(rep['publishers']), 'working': sum(e['working'] for e in rep['publishers'])}
    print(f"{rep['counts']['working']} of {rep['counts']['publishers']} publishers have a working feed")
    json.dump(rep, open(out, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    return rep


def apply(rep_path=REPORT):
    rep = json.load(open(rep_path, encoding='utf-8'))
    d = json.load(open(SOURCES, encoding='utf-8'))
    by = {s['id']: s for s in d['sources']}
    added, updated = [], []
    cut = (datetime.datetime.fromisoformat(rep['checkedAt']) - datetime.timedelta(days=STALE_DAYS)).isoformat()
    fresh = lambda fs: [f['url'] for f in sorted([f for f in fs if f.get('ok') and ((f.get('newest') or {}).get('publishedAt') or '') >= cut],
                                                 key=lambda f: f['newest']['publishedAt'], reverse=True)]
    for e in rep['publishers']:
        # the freshest feeds first; a feed whose newest article is older than STALE_DAYS is not used (abandoned feed)
        feeds = [{'type': 'rss', 'url': u} for u in fresh(e['feeds'])[:2] + fresh(e['transferFeeds'])[:1]]
        note = (f"Tested from GitHub Actions {rep['checkedAt'][:10]} (tools/sports_publishers.py). Headline, link and time only, "
                f"to find a story; written in our own words; photos never reused. {e['terms']}")
        if e['id'] in by:
            s = by[e['id']]
            if feeds and [f['url'] for f in s.get('feeds', [])] != [f['url'] for f in feeds]:
                s['feeds'] = feeds; s['notes'] = note; s['fastPoll'] = True; s.pop('searchOnly', None); updated.append(e['id'])
            continue
        s = {'id': e['id'], 'name': e['name'], 'shareLink': '', 'homepage': e['homepage'], 'section': 'sports',
             'enabled': True, 'verified': True, 'priority': 74, 'feeds': feeds, 'imagePolicy': 'all-rights-reserved', 'notes': note}
        if feeds:
            s['fastPoll'] = True
        else:
            s['searchOnly'] = True
            s['notes'] = 'Manually reviewed source: no allowed public feed answered our test. ' + e['terms']
        d['sources'].append(s); added.append(e['id'])
    json.dump(d, open(SOURCES, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print(f'added {added}, updated {updated}')


def self_test():
    cfg = json.load(open(CFG, encoding='utf-8'))
    ids = [p['id'] for p in cfg['publishers']]
    assert len(ids) == len(set(ids)), 'publisher ids are unique'
    for p in cfg['publishers']:
        assert p['homepage'].startswith('https://') and p.get('terms', 'rss-headlines') in cfg['terms'], p['id']
        assert all(u.startswith('https://') for u in p.get('feeds', []) + p.get('transfers', [])), p['id']
    rss = b'<?xml version="1.0"?><rss><channel><item><title>A</title><link>https://x.test/a</link><pubDate>Mon, 09 Nov 2026 08:00:00 GMT</pubDate></item></channel></rss>'
    assert listing('u', rss)[0]['url'] == 'https://x.test/a'
    for bad in (b'<!doctype html><html></html>', b'<?xml version="1.0"?>\n<sitemapindex><sitemap><loc>x</loc></sitemap></sitemapindex>'):
        try:
            listing('u', bad); raise AssertionError('a web page or sitemap index is not a feed')
        except ValueError:
            pass
    print('SPORTS PUBLISHERS OK')


if __name__ == '__main__':
    a = sys.argv[1:]
    if a[:1] == ['probe']:
        probe(a[a.index('--out') + 1] if '--out' in a else REPORT)
    elif a[:1] == ['apply']:
        apply()
    elif a[:1] == ['test']:
        self_test()
    else:
        sys.exit(__doc__)
