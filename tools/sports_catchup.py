#!/usr/bin/env python3
"""Sports 24-hour catch-up list for the 3-hourly news task (owner's decision of 17 November 2026).

Collects every sports story the collector handed to branch world-feed in the last 24 hours (candidates.json in each
world-feed commit) and writes them as one candidate file, so the news task can run
`python3 tools/world_news.py dedup <out> --max-age-hours 24` on it. Only headlines, links and times are read.

  python3 tools/sports_catchup.py --out /tmp/sports24-cand.json [--hours 24] [--max 200]

To keep the dedup step fast (it compares every story with every article on the site), this list already drops
stories whose link the site has ever had, obvious non-news (live blogs, TV guides, betting, fantasy, quizzes,
galleries) and keeps the newest --max stories (default 200).
"""
import json, os, re, subprocess, sys

NOISE = re.compile(r'(?i)\b(live|en directo|en vivo|in diretta|en direct|liveticker|how to watch|where to watch|d[oó]nde ver|dove vedere|o[uù] regarder|tv channel|horario|prono|pronostic|cuotas|quote|odds|betting|bet\b|tips|fantasy|quiz|gallery|galer[ií]a|fotogallery|in pictures|player ratings|pagelle|notes|ratings|podcast|video)\b')

def norm(u):
    return (u or '').split('?')[0].split('#')[0].rstrip('/').lower()

def main(argv):
    out = argv[argv.index('--out') + 1] if '--out' in argv else '/tmp/sports24-cand.json'
    hours = argv[argv.index('--hours') + 1] if '--hours' in argv else '24'
    cap = int(argv[argv.index('--max') + 1]) if '--max' in argv else 200
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    try:
        import known_sources
        known = {norm(u) for u in known_sources.collect()[1]}
    except Exception as e:
        print(f'known_sources failed ({e}); dedup will still remove what the site has'); known = set()
    subprocess.run(['git', 'fetch', '-q', 'origin', 'world-feed', f'--shallow-since={hours} hours ago'], check=False)
    revs = subprocess.check_output(['git', 'log', 'FETCH_HEAD', f'--since={hours} hours ago', '--format=%H', '--', 'candidates.json']).decode().split()
    seen = {}
    for r in revs[::3]:  # every third hourly list is enough: each list keeps several hours of stories
        try:
            d = json.loads(subprocess.check_output(['git', 'show', r + ':candidates.json'], stderr=subprocess.DEVNULL))
        except Exception:
            continue
        items = d if isinstance(d, list) else (d.get('items') or d.get('candidates') or [])
        for i in items:
            if i.get('section') == 'sports' and i.get('url'):
                seen.setdefault((i.get('canonicalUrl') or i['url']).split('?')[0].rstrip('/'), i)
    allc = list(seen.values())
    onsite = [i for i in allc if norm(i.get('canonicalUrl') or i['url']) in known or norm(i['url']) in known]
    noise = [i for i in allc if i not in onsite and NOISE.search(i.get('title') or '')]
    keep = sorted((i for i in allc if i not in onsite and i not in noise), key=lambda i: i.get('publishedAt') or '', reverse=True)
    json.dump({'items': keep[:cap]}, open(out, 'w', encoding='utf-8'), ensure_ascii=False)
    print(f'{len(allc)} sports stories from {len(revs)} world-feed lists in the last {hours} h: {len(onsite)} already on the site, '
          f'{len(noise)} live/TV/betting/quiz/gallery, {len(keep)} left, newest {min(cap, len(keep))} -> {out}')
    return 0

if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
