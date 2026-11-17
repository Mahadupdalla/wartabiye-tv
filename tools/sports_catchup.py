#!/usr/bin/env python3
"""Sports 24-hour catch-up list for the 3-hourly news task (owner's decision of 17 November 2026).

Collects every sports story the collector handed to branch world-feed in the last 24 hours (candidates.json in each
world-feed commit) and writes them as one candidate file, so the news task can run
`python3 tools/world_news.py dedup <out> --max-age-hours 24` on it. Only headlines, links and times are read.

  python3 tools/sports_catchup.py --out /tmp/sports24-cand.json [--hours 24]
"""
import json, subprocess, sys

def main(argv):
    out = argv[argv.index('--out') + 1] if '--out' in argv else '/tmp/sports24-cand.json'
    hours = argv[argv.index('--hours') + 1] if '--hours' in argv else '24'
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
    json.dump({'items': list(seen.values())}, open(out, 'w', encoding='utf-8'), ensure_ascii=False)
    print(f'{len(seen)} sports stories from {len(revs)} world-feed lists in the last {hours} h -> {out}')
    return 0

if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
