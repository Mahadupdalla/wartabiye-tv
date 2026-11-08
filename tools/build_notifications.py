"""Build data/notifications.json, the feed the notification bell reads. Run after tools/build_news.py (publish workflow).

Only REAL, PUBLISHED content goes in:
  - articles from data/news.json (already published, with their own photo) from the last FEED_DAYS days;
  - the owner's own alerts from data/alerts/<id>.json (written in /admin/ -> Ogeysiisyada), only when "published" is on
    and the link is a published article or one of the site's own pages (LIVE TV, Ciyaaraha Toos, ...).
    An alert whose article is missing or still a draft is left out and reported (never a broken link).
LIVE TV is NOT stored here: the bell asks data/live-status.json itself, so "LIVE" is only shown while the broadcast is
verified (see assets/media.js).

Each item keeps the time it FIRST entered the feed ("addedAt"; taken from the previous data/notifications.json), so a
visitor's unread count only grows for stories that are new to the site. The time shown is always the publisher's
original publication time ("time"). Nothing is invented: no item without a real page, no made-up time.

  python3 tools/build_notifications.py          (writes data/notifications.json only when something changed)
  python3 tools/build_notifications.py test     (self-test, no files written)
"""
import json, os, sys, glob, datetime
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from translations import LANGS  # noqa: E402

FEED_DAYS = 7
MAX_ITEMS = 40
KINDS = ('breaking', 'somalia', 'eastAfrica', 'world', 'sports', 'live')
PAGES = {'toos': 'toos/', 'ciyaaraha-toos': 'ciyaaraha-toos/', 'muuqaal': 'muuqaal/', 'ciyaaraha': 'ciyaaraha/', 'caalamka': 'caalamka/', 'hoyga': ''}
BREAK_HOURS = 12  # the site shows "Degdeg" for 12 hours (assets/app.js BREAK_MS)
EAT = datetime.timezone(datetime.timedelta(hours=3))


def parse(t):
    try:
        d = datetime.datetime.fromisoformat(str(t).replace('Z', '+00:00'))
        return d if d.tzinfo else d.replace(tzinfo=EAT)
    except Exception:
        return None


def iso(d):
    return d.astimezone(EAT).isoformat(timespec='seconds')


def kind_of(n, now):
    if n.get('breaking') and parse(n.get('publishedAt')) and (now - parse(n['publishedAt'])).total_seconds() < BREAK_HOURS * 3600:
        return 'breaking'
    s = n.get('section')
    if s == 'sports' or (not s and n.get('category') == 'Ciyaaraha'): return 'sports'
    if s == 'world' and n.get('region') != 'east-africa' or (not s and n.get('category') == 'Adduunka'): return 'world'
    # the regional feed (internal section "somalia"): a story with an East African country (or region) is East Africa,
    # the owner's own Somali stories (no country) are Somalia News
    if n.get('country') or n.get('region') == 'east-africa': return 'eastAfrica'
    return 'somalia'


def short(s, n=160):
    s = ' '.join(str(s or '').split())
    return s if len(s) <= n else s[:n - 1].rsplit(' ', 1)[0] + '…'


def texts(src, title_key='title', body_key='summary'):
    """{lang: {title, summary}} for the translations that exist (Somali is the item's own title/summary)."""
    out = {}
    for lang in LANGS:
        t = src.get(lang)
        if isinstance(t, dict) and isinstance(t.get(title_key), str) and t[title_key].strip():
            out[lang] = {'title': t[title_key].strip()[:160], 'summary': short(t.get(body_key))}
    return out


def article_item(n, now):
    img = n.get('thumb') or n.get('image')
    return {'id': 'n-' + n['id'], 'kind': kind_of(n, now), 'title': n['title'][:160], 'summary': short(n.get('summary')),
            't': texts(n), 'url': 'war/' + n['id'] + '.html', 'thumb': img if img and str(img).startswith('img/') else None,
            'time': n['publishedAt'], 'important': bool(n.get('important') or n.get('breaking')), 'article': n['id']}


def alert_item(a, news_by_id, now, problems):
    aid = a['id']
    if a.get('published') is False: return None
    when = parse(a.get('publishedAt'))
    if not when: problems.append(f'{aid}: no valid time'); return None
    if when > now + datetime.timedelta(minutes=5): problems.append(f'{aid}: scheduled for {a["publishedAt"]}'); return None
    kind = a.get('kind') if a.get('kind') in KINDS else 'breaking'
    if not (a.get('title') or '').strip(): problems.append(f'{aid}: no title'); return None
    art = (a.get('article') or '').strip().replace('.json', '')
    page = (a.get('page') or '').strip()
    if art:
        n = news_by_id.get(art)
        if not n: problems.append(f'{aid}: article "{art}" is not published, alert left out'); return None
        url, thumb = 'war/' + art + '.html', n.get('thumb') or n.get('image')
    elif page in PAGES:
        url, thumb = PAGES[page], None
    else:
        problems.append(f'{aid}: needs a published article or a site page'); return None
    return {'id': 'm-' + aid, 'kind': kind, 'title': a['title'].strip()[:160], 'summary': short(a.get('message')), 't': texts(a, 'title', 'message'),
            'url': url, 'thumb': thumb if thumb and str(thumb).startswith('img/') else None, 'time': iso(when),
            'important': bool(a.get('urgent') or kind == 'breaking'), 'manual': True, 'push': a.get('push') is not False,
            'urgent': bool(a.get('urgent')), **({'article': art} if art else {})}


def build(news, alerts, status, settings, prev, now):
    news_by_id = {n['id']: n for n in news}
    cutoff = now - datetime.timedelta(days=FEED_DAYS)
    problems = []
    items = [article_item(n, now) for n in news if parse(n.get('publishedAt')) and cutoff <= parse(n['publishedAt']) <= now + datetime.timedelta(minutes=5)]
    for a in alerts:
        it = alert_item(a, news_by_id, now, problems)
        if it and parse(it['time']) >= cutoff: items.append(it)
    items.sort(key=lambda x: parse(x['time']), reverse=True)
    items = items[:MAX_ITEMS]
    old = {i['id']: i for i in (prev or {}).get('items', [])}
    first = not prev
    for it in items:
        if it['id'] in old and old[it['id']].get('addedAt'):
            it['addedAt'] = old[it['id']]['addedAt']
        else:
            # first feed ever: an existing story entered the site when it was published; afterwards: now
            it['addedAt'] = it['time'] if first else iso(max(now, parse(it['time'])))
    push = settings or {}
    public_push = {'enabled': bool(push.get('pushEnabled')) and bool(push.get('workerUrl')) and bool(push.get('publicKey')),
                   'workerUrl': push.get('workerUrl') or '', 'publicKey': push.get('publicKey') or '',
                   'categories': [k for k in KINDS if (push.get('categories') or {}).get(k, True)]}
    return {'lastRunAt': status.get('lastRunAt'), 'lastSuccessAt': status.get('lastSuccessAt') or status.get('lastRunAt'),
            'push': public_push, 'items': items}, problems


def load(p, default):
    try: return json.load(open(p, encoding='utf-8'))
    except Exception: return default


def main():
    now = datetime.datetime.now(EAT)
    news = load(os.path.join(root, 'data', 'news.json'), {}).get('news', [])
    alerts = []
    for f in sorted(glob.glob(os.path.join(root, 'data', 'alerts', '*.json'))):
        a = load(f, None)
        if isinstance(a, dict): a['id'] = os.path.basename(f)[:-5]; alerts.append(a)
    status = load(os.path.join(root, 'data', 'status.json'), {})
    settings = load(os.path.join(root, 'data', 'notify-settings.json'), {})
    dst = os.path.join(root, 'data', 'notifications.json')
    prev = load(dst, None)
    out, problems = build(news, alerts, status, settings, prev, now)
    for p in problems: print('alert:', p)
    if prev and {k: prev.get(k) for k in out} == out:
        print(f'{len(out["items"])} notifications, data/notifications.json unchanged'); return
    out = {'generatedAt': iso(now), **out}
    json.dump(out, open(dst, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print(f'{len(out["items"])} notifications -> data/notifications.json')


def test():
    now = datetime.datetime(2026, 11, 8, 12, 0, tzinfo=EAT)
    n = lambda i, h, **k: {'id': i, 'title': 'T ' + i, 'summary': 'S', 'publishedAt': iso(now - datetime.timedelta(hours=h)), 'image': f'img/news/{i}.jpg', **k}
    news = [n('a', 1, section='sports'), n('b', 2, breaking=True), n('c', 30, breaking=True, section='world'), n('d', 3, section='somalia', country='ke'),
            n('e', 24 * 8), n('f', 4, section='world', en={'title': 'F en', 'summary': 'x'}), n('s', 5, section='somalia')]
    alerts = [{'id': 'x1', 'title': 'Alert', 'message': 'm', 'article': 'a', 'publishedAt': iso(now), 'kind': 'breaking', 'urgent': True},
              {'id': 'x2', 'title': 'Draft link', 'article': 'zzz', 'publishedAt': iso(now)},
              {'id': 'x3', 'title': 'Live', 'page': 'toos', 'publishedAt': iso(now), 'kind': 'live'},
              {'id': 'x4', 'title': 'Off', 'page': 'toos', 'publishedAt': iso(now), 'published': False},
              {'id': 'x5', 'title': 'Later', 'page': 'toos', 'publishedAt': iso(now + datetime.timedelta(hours=2))}]
    out, probs = build(news, alerts, {'lastRunAt': '2026-11-08T11:40:00+03:00', 'lastSuccessAt': '2026-11-08T11:40:00+03:00'}, {}, None, now)
    ids = [i['id'] for i in out['items']]
    assert 'n-e' not in ids, 'older than 7 days stays out'
    assert 'm-x2' not in ids and any('zzz' in p for p in probs), 'alert to an unpublished article is refused'
    assert 'm-x4' not in ids and 'm-x5' not in ids, 'draft and future alerts stay out'
    k = {i['id']: i['kind'] for i in out['items']}
    assert k['n-a'] == 'sports' and k['n-b'] == 'breaking' and k['n-c'] == 'world' and k['n-d'] == 'eastAfrica' and k['n-s'] == 'somalia', k
    assert all(i['url'].startswith(('war/', 'toos/')) for i in out['items'])
    f = next(i for i in out['items'] if i['id'] == 'n-f'); assert f['t']['en']['title'] == 'F en'
    assert next(i for i in out['items'] if i['id'] == 'n-a')['addedAt'] == next(i for i in out['items'] if i['id'] == 'n-a')['time'], 'first feed: addedAt = publication time'
    # second build: a story new to the site gets addedAt = now, old ones keep theirs
    news2 = news + [n('g', 5)]
    later = now + datetime.timedelta(hours=1)
    out2, _ = build(news2, alerts, {}, {}, out, later)
    g = next(i for i in out2['items'] if i['id'] == 'n-g'); assert g['addedAt'] == iso(later) and g['time'] != g['addedAt']
    assert next(i for i in out2['items'] if i['id'] == 'n-a')['addedAt'] == next(i for i in out['items'] if i['id'] == 'n-a')['addedAt']
    assert ids == sorted(ids, key=lambda i: -parse(next(x for x in out['items'] if x['id'] == i)['time']).timestamp())
    assert out['push']['enabled'] is False
    print('build_notifications: all tests passed')


if __name__ == '__main__':
    test() if sys.argv[1:] == ['test'] else main()
