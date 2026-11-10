"""Scheduled articles from the admin dashboard (owner's request, 10 Nov 2026: "Schedule publishing").

An article saved with "Schedule" in /admin/ has "published": false and "publishAt" (ISO time). This script, run every
15 minutes by .github/workflows/scheduled-publish.yml, publishes each such article once its time has come: it sets
"published": true, keeps the scheduled time as "publishedAt" and removes "publishAt". Nothing else in the file changes,
and only articles that carry "publishAt" are touched (drafts, held and automatic articles are never published here).

  python3 tools/scheduled_publish.py          publish the due articles, print their ids
  python3 tools/scheduled_publish.py test     offline self-test
"""
import datetime as D
import glob
import json
import os
import sys
import tempfile


def due(a, now):
    if a.get('published') is not False or not a.get('publishAt'):
        return False
    try:
        t = D.datetime.fromisoformat(str(a['publishAt']).replace('Z', '+00:00'))
    except ValueError:
        return False
    if t.tzinfo is None:
        t = t.replace(tzinfo=D.timezone(D.timedelta(hours=3)))
    return t <= now


def run(root, now=None):
    now = now or D.datetime.now(D.timezone.utc)
    done = []
    for f in sorted(glob.glob(os.path.join(root, 'data', 'news', '*.json'))):
        raw = open(f, encoding='utf-8').read()
        a = json.loads(raw)
        if not due(a, now):
            continue
        a['published'] = True
        a['publishedAt'] = a.pop('publishAt')
        open(f, 'w', encoding='utf-8').write(json.dumps(a, ensure_ascii=False, indent=2) + '\n')
        done.append(os.path.basename(f)[:-5])
    return done


def test():
    with tempfile.TemporaryDirectory() as d:
        os.makedirs(os.path.join(d, 'data', 'news'))
        def w(name, obj):
            json.dump(obj, open(os.path.join(d, 'data', 'news', name + '.json'), 'w'))
        w('due', {'title': 'a', 'published': False, 'publishAt': '2026-11-10T10:00:00+03:00', 'publishedAt': '2026-11-10T10:00:00+03:00'})
        w('later', {'title': 'b', 'published': False, 'publishAt': '2026-11-10T12:00:00+03:00'})
        w('draft', {'title': 'c', 'published': False})
        w('live', {'title': 'd', 'publishAt': '2026-11-01T00:00:00Z'})
        now = D.datetime(2026, 11, 10, 7, 30, tzinfo=D.timezone.utc)   # 10:30 in Mogadishu
        got = run(d, now)
        a = json.load(open(os.path.join(d, 'data', 'news', 'due.json')))
        ok = got == ['due'] and a['published'] is True and 'publishAt' not in a and a['publishedAt'] == '2026-11-10T10:00:00+03:00'
        ok = ok and json.load(open(os.path.join(d, 'data', 'news', 'later.json')))['published'] is False
        print('PASS' if ok else 'FAIL', 'scheduled publishing', got)
        return 0 if ok else 1


if __name__ == '__main__':
    if sys.argv[1:] == ['test']:
        sys.exit(test())
    ids = run(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    print('\n'.join(ids))
