"""Build the public read-only content API for the Wartabiye TV mobile app and PWA (api/v1/).

The app has NO database of its own. Everything here is derived, on every publish, from the same files the website uses:
  data/news.json      (built by tools/build_news.py from data/news/<id>.json: only "published" articles)
  data/ads.json       (sponsored placements, written by /admin/)
  data/videos.json    (Wartabiye TV's own videos, written by /admin/)
  data/site.json      (breaking-news ticker settings, written by /admin/)
So an article published, edited, unpublished or given a new image in /admin/ (or by the news task) changes the website and
the app in the same publish run: tools/build_news.py -> tools/build_app_api.py -> GitHub Pages.

Output (static JSON on GitHub Pages; no secrets, no write access, no AI calls):
  api/v1/meta.json           version, times, counts per language, where the LIVE updates are, active ads
  api/v1/feed/<lang>.json    one card per article (newest first) in that language. Somali has every article; another
                             language lists only articles with a real translation there (the same rule as the website).
  api/v1/a/<id>.json         the full article in every language it exists in, image credit and licence, rev
  api/v1/ids.json            [id, rev] of every published article (offline copies are checked against it)
Every article carries "rev" (a hash of its public content): when /admin/ edits an article its rev changes and the app
reloads it; when an article is unpublished its file disappears and the app drops it from its feeds and offline copies.

  python3 tools/build_app_api.py           build api/v1 from data/
  python3 tools/build_app_api.py test      self-test (no files written)
"""
import hashlib, json, os, shutil, sys, datetime

root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE = 'https://www.wartabiyetv.com/'
LANGS = ['so', 'en', 'ar', 'fr', 'nl', 'it', 'tr', 'de', 'es']
LIVE_UPDATES = 'https://raw.githubusercontent.com/Mahadupdalla/wartabiye-tv/live-data/live-updates.json'
LIVE_UPDATES_FALLBACK = 'data/live-feeds/live-updates.json'
VIDEO_FEED = 'https://raw.githubusercontent.com/Mahadupdalla/wartabiye-tv/live-data/video-feed.json'
SCHEMA = 1
CARD_TEXT = 320  # summary characters on a card (the article file has the full text)


def load(p, default):
    try:
        return json.load(open(os.path.join(root, p), encoding='utf-8'))
    except Exception:
        return default


def section(it):
    """Same rule as assets/app.js section(): explicit section, else derived from the category."""
    s = it.get('section')
    if s in ('sports', 'world', 'somalia'):
        return s
    if it.get('category') == 'Ciyaaraha':
        return 'sports'
    if it.get('category') == 'Adduunka':
        return 'world'
    return 'somalia'


def s(v):
    return v.strip() if isinstance(v, str) else ''


def img(u):
    """Only the site's own image files or https URLs (assets/app.js imgUrl())."""
    u = s(u).lstrip('/')
    return u if u.startswith('img/') or u.startswith('https://') else ''


def translation(it, lang):
    """The real translation in `lang`, or None (assets/app.js trOf())."""
    if lang == 'so':
        return {'title': s(it.get('title')), 'summary': s(it.get('summary')), 'body': s(it.get('body')), 'imageAlt': s(it.get('imageAlt')), 'status': 'original'}
    x = it.get(lang)
    if not isinstance(x, dict) or not s(x.get('title')):
        return None
    return {'title': s(x.get('title')), 'summary': s(x.get('summary')), 'body': s(x.get('body')), 'imageAlt': s(x.get('imageAlt')),
            # "manual" = checked by a person in /admin/; anything else is an automatic translation and is labelled as such
            'status': 'manual' if x.get('status') == 'manual' else 'auto'}


def show_source(it):
    return bool(it.get('source') and it.get('source') != 'Wartabiye TV' and it.get('attributionRequired') is True)


def article(it):
    a = {
        'id': it['id'], 'url': SITE + 'war/' + it['id'] + '.html',
        'publishedAt': it.get('publishedAt'), 'timeVerified': it.get('timeVerified') is not False,
        'section': section(it), 'category': s(it.get('category')),
        'country': s(it.get('country')), 'region': s(it.get('region')), 'sport': s(it.get('sport')), 'competition': s(it.get('competition')),
        'breaking': bool(it.get('breaking')), 'important': bool(it.get('important')),
        'sponsored': bool(it.get('sponsored')), 'sponsor': s(it.get('sponsor')),
        'by': 'admin' if it.get('by') == 'admin' else 'newsroom',
        'image': img(it.get('image')), 'thumb': img(it.get('thumb')),
        'imageCredit': s(it.get('imageCredit')) or ('Wartabiye TV' if it.get('by') == 'admin' and img(it.get('image')) else ''),
        'imageLicense': s(it.get('imageLicense')), 'imageSourceUrl': s(it.get('imageSourceUrl')) if s(it.get('imageSourceUrl')).startswith('https://') else '',
        'imageKind': s(it.get('imageKind')), 'imageNote': s(it.get('imageNote')),
        # the website shows a publisher only when it must be credited; otherwise "based on reports from other media"
        'source': s(it.get('source')) if show_source(it) else '',
        'sourceUrl': s(it.get('sourceUrl')) if show_source(it) and s(it.get('sourceUrl')).startswith('http') else '',
        'basedOnOthers': bool(it.get('by') != 'admin' and it.get('source') and it.get('source') != 'Wartabiye TV' and not show_source(it)),
        'tr': {},
    }
    for lang in LANGS:
        t = translation(it, lang)
        if t:
            a['tr'][lang] = t
    a['rev'] = hashlib.sha1(json.dumps(a, sort_keys=True, ensure_ascii=False).encode()).hexdigest()[:12]
    return a


def card(a, lang):
    t = a['tr'][lang]
    summ = t['summary'] or t['body']
    if len(summ) > CARD_TEXT:
        summ = summ[:CARD_TEXT].rsplit(' ', 1)[0] + '…'
    c = {'id': a['id'], 'rev': a['rev'], 'title': t['title'], 'summary': summ, 'publishedAt': a['publishedAt'],
         'section': a['section'], 'category': a['category'], 'image': a['image'], 'thumb': a['thumb'] or a['image'],
         'imageAlt': t['imageAlt'] or a['tr']['so']['imageAlt'] if 'so' in a['tr'] else t['imageAlt']}
    for k in ('country', 'region', 'sport', 'competition', 'sponsor'):
        if a[k]:
            c[k] = a[k]
    for k in ('breaking', 'important', 'sponsored'):
        if a[k]:
            c[k] = True
    if not a['timeVerified']:
        c['timeVerified'] = False
    if a['imageKind'] == 'illustrative':          # the website marks these photos "Sawir muujin ah"
        c['imageKind'] = 'illustrative'
    if t['status'] == 'auto':
        c['autoTranslated'] = True
    return c


def active_ads(ads, today):
    out = []
    for a in ads if isinstance(ads, list) else []:
        if not isinstance(a, dict) or a.get('active') is False or not isinstance(a.get('positions'), list):
            continue
        if a.get('start') and str(a['start'])[:10] > today:
            continue
        if a.get('end') and str(a['end'])[:10] < today:
            continue
        out.append({k: a[k] for k in a if k in ('id', 'title', 'text', 'image', 'imageAlt', 'video', 'link', 'positions', 'advertiser', 'label', 'start', 'end') or k in LANGS})
    return out


def build(news, ads, videos, site, now, notify=None):
    items = [n for n in news.get('news', []) if isinstance(n, dict) and n.get('id') and s(n.get('title')) and n.get('published', True) is not False]
    items.sort(key=lambda x: x.get('publishedAt') or '', reverse=True)
    arts = [article(n) for n in items]
    feeds = {}
    for lang in LANGS:
        feeds[lang] = [card(a, lang) for a in arts if lang in a['tr']]
    ids = {a['id'] for a in arts}
    def picks(key):  # the editor's homepage picks in /admin/ (data/site.json "featured" / "trending"), as on the website
        out = []
        for f in (site or {}).get(key) or []:
            i = f if isinstance(f, str) else (f.get('article') if isinstance(f, dict) else None)
            if i in ids and i not in out:
                out.append(i)
        return out[:10]
    featured, trending = picks('featured'), picks('trending')
    version = hashlib.sha1(('|'.join(a['id'] + ':' + a['rev'] for a in arts) + json.dumps(ads, sort_keys=True)
                            + json.dumps([featured, trending, (site or {}).get('breaking')], sort_keys=True)).encode()).hexdigest()[:16]
    today = now.astimezone(datetime.timezone(datetime.timedelta(hours=3))).date().isoformat()
    brk = (site or {}).get('breaking') or {}
    # no build clock in the files: a publish run that changes nothing leaves api/v1 byte-for-byte the same (no empty commits)
    meta = {
        'schema': SCHEMA, 'version': version,
        'contentUpdatedAt': news.get('updatedAt'), 'lastRunAt': news.get('lastRunAt'), 'lastSuccessAt': news.get('lastSuccessAt'),
        'site': SITE, 'languages': LANGS, 'defaultLanguage': 'so',
        'counts': {lang: len(feeds[lang]) for lang in LANGS},
        'newest': arts[0]['publishedAt'] if arts else None,
        'liveUpdates': {'url': LIVE_UPDATES, 'fallback': LIVE_UPDATES_FALLBACK},
        'videoFeed': {'url': VIDEO_FEED, 'fallback': 'data/live-feeds/video-feed.json', 'own': 'data/videos.json'},
        'breaking': {'mode': brk.get('mode', 'auto'), 'label': brk.get('label') or 'DEGDEG',
                     'items': [x for x in brk.get('items', []) if isinstance(x, (str, dict))][:10] if isinstance(brk.get('items'), list) else []},
        'featured': featured, 'trending': trending,
        'social': {k: v for k, v in ((site or {}).get('social') or {}).items() if isinstance(v, str) and v.startswith('https://')},
        'ads': active_ads(ads.get('ads') if isinstance(ads, dict) else ads, today),
        # push notifications for the app: the same Worker and the same rules as the website's bell (/admin/ -> Ogeysiisyada)
        'push': {'enabled': bool((notify or {}).get('pushEnabled') and s((notify or {}).get('workerUrl')).startswith('https://')),
                 'workerUrl': s((notify or {}).get('workerUrl')) if s((notify or {}).get('workerUrl')).startswith('https://') else '',
                 'categories': ['breaking', 'eastAfrica', 'world', 'sports']},
        'ownVideos': len([v for v in (videos.get('videos') if isinstance(videos, dict) else []) or [] if isinstance(v, dict) and v.get('published') is not False]),
    }
    return meta, feeds, arts


def write(meta, feeds, arts):
    out = os.path.join(root, 'api', 'v1')
    tmp = out + '.tmp'
    shutil.rmtree(tmp, ignore_errors=True)
    os.makedirs(os.path.join(tmp, 'feed'))
    os.makedirs(os.path.join(tmp, 'a'))
    dump = lambda p, o: json.dump(o, open(os.path.join(tmp, p), 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
    for lang, f in feeds.items():
        dump(f'feed/{lang}.json', {'schema': SCHEMA, 'version': meta['version'], 'lang': lang, 'items': f})
    for a in arts:
        dump(f'a/{a["id"]}.json', {'schema': SCHEMA, **a})
    # every published article and its rev (all languages): the app uses it to drop unpublished articles from its offline
    # copies and to reload saved articles that were edited in /admin/
    dump('ids.json', {'schema': SCHEMA, 'version': meta['version'], 'items': [[a['id'], a['rev']] for a in arts]})
    dump('meta.json', meta)
    # replace the whole folder: an unpublished or deleted article leaves no file behind
    shutil.rmtree(out, ignore_errors=True)
    os.replace(tmp, out)
    print(f"api/v1: {len(arts)} articles, version {meta['version']}, " + ', '.join(f'{k} {v}' for k, v in meta['counts'].items()))


def test():
    now = datetime.datetime(2026, 11, 10, 12, 0, tzinfo=datetime.timezone.utc)
    news = {'updatedAt': 'x', 'news': [
        {'id': 'a-1', 'title': 'Cinwaan', 'summary': 'Soo koobid', 'body': 'Qoraal', 'category': 'Siyaasadda', 'publishedAt': '2026-11-10T10:00:00+03:00', 'image': 'img/news/a.jpg', 'thumb': 'img/news/w480/a.webp', 'imageAlt': 'Sawir',
         'source': 'BBC', 'attributionRequired': False, 'en': {'title': 'Title', 'summary': 'Sum', 'status': 'auto'}, 'ar': {'title': ' '}},
        {'id': 'b-2', 'title': 'Kubadda', 'summary': 'x' * 500, 'category': 'Ciyaaraha', 'publishedAt': '2026-11-10T11:00:00+03:00', 'image': 'javascript:x', 'breaking': True, 'source': 'X', 'sourceUrl': 'https://x', 'attributionRequired': True,
         'en': {'title': 'Ball', 'status': 'manual'}},
        {'id': 'c-3', 'title': 'Qabyo', 'published': False, 'publishedAt': '2026-11-10T11:30:00+03:00'},
    ]}
    meta, feeds, arts = build(news, {'ads': [{'id': 'ad1', 'positions': ['home'], 'end': '2026-11-01'}, {'id': 'ad2', 'positions': ['home']}]}, {'videos': []}, {}, now)
    assert [a['id'] for a in arts] == ['b-2', 'a-1'], 'newest first, drafts left out'
    assert meta['counts'] == {'so': 2, 'en': 2, 'ar': 0, 'fr': 0, 'nl': 0, 'it': 0, 'tr': 0, 'de': 0, 'es': 0}, meta['counts']
    a1 = arts[1]
    assert a1['section'] == 'somalia' and arts[0]['section'] == 'sports'
    assert a1['source'] == '' and a1['basedOnOthers'] is True, 'publisher shown only when it must be credited'
    assert arts[0]['source'] == 'X' and arts[0]['sourceUrl'] == 'https://x'
    assert arts[0]['image'] == '', 'unsafe image dropped'
    assert feeds['en'][1]['autoTranslated'] is True and 'autoTranslated' not in feeds['en'][0]
    assert len(feeds['so'][0]['summary']) <= CARD_TEXT + 1 and feeds['so'][0]['breaking'] is True
    assert [a['id'] for a in meta['ads']] == ['ad2'], 'expired ad left out'
    rev = a1['rev']
    news['news'][0]['title'] = 'Cinwaan la saxay'
    _, _, arts2 = build(news, {}, {}, {}, now)
    assert arts2[1]['rev'] != rev, 'an edit changes rev'
    news['news'][0]['image'] = 'img/news/b.jpg'
    _, _, arts3 = build(news, {}, {}, {}, now)
    assert arts3[1]['rev'] != arts2[1]['rev'], 'a new image changes rev'
    print('build_app_api: all tests passed')


if __name__ == '__main__':
    if sys.argv[1:2] == ['test']:
        test()
    else:
        meta, feeds, arts = build(load('data/news.json', {}), load('data/ads.json', {}), load('data/videos.json', {}), load('data/site.json', {}),
                                  datetime.datetime.now(datetime.timezone.utc), load('data/notify-settings.json', {}))
        if not arts:
            sys.exit('build_app_api: data/news.json has no published articles; api/v1 left unchanged')
        write(meta, feeds, arts)
