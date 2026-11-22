#!/usr/bin/env python3
"""Sports 24-hour catch-up list for the 3-hourly news task (owner's decision of 17 November 2026).

Collects every sports story the collector handed to branch world-feed in the last 24 hours (candidates.json in each
world-feed commit) and writes them as one candidate file, so the news task can run
`python3 tools/world_news.py dedup <out> --max-age-hours 24` on it. Only headlines, links and times are read.

  python3 tools/sports_catchup.py --out /tmp/sports24-cand.json [--hours 24] [--max 200]
  python3 tools/sports_catchup.py --pool /tmp/sports-pool.json [--max 250]

--pool (run by the 5-minute monitor, tools/fast_loop.sh, about 25 minutes before every 3-hourly run, on GitHub's free
runners): also runs the dedup step and writes the finished, checked list with "builtAt", most useful first: stories that
two or more outlets report ("alsoReportedBy", the TWO-SOURCE RULE is then already met) before single-outlet ones,
newest first inside each group. The news task reads it from branch world-feed (sports-pool.json) in seconds instead of
spending up to 10 minutes of its own TIME BUDGET on the dedup.

To keep the dedup step fast (it compares every story with every article on the site), this list already drops
stories whose link the site has ever had, obvious non-news (live blogs, TV guides, betting, fantasy, quizzes,
galleries) and keeps the newest --max stories (default 200).
"""
import json, os, re, subprocess, sys

NOISE = re.compile(r'(?i)\b(live|en directo|en vivo|in diretta|en direct|liveticker|how to watch|where to watch|d[oó]nde ver|dove vedere|o[uù] regarder|tv channel|horario|prono|pronostic|cuotas|quote|odds|betting|bet\b|tips|fantasy|quiz|gallery|galer[ií]a|fotogallery|in pictures|player ratings|pagelle|notes|ratings|podcast|video|quelle cha[iî]ne|[àa] quelle heure|netflix|serie del momento)\b')
# big leagues and clubs (FOOTBALL PRIORITY in tools/news_task_prompt.md): these go first inside each group of the pool
BIG = re.compile(r'(?i)(premier league|la ?liga|serie a|bundesliga|ligue 1|champions league|europa league|saudi pro|afcon|world cup|mundial|coupe du monde|weltmeister|real madrid|barcelona|bar[cç]a|atl[eé]tico|manchester|man (city|utd|united)|liverpool|arsenal|chelsea|tottenham|spurs|bayern|dortmund|juventus|juve|inter\b|milan|napoli|psg|paris saint|al[- ]nassr|al[- ]hilal|al[- ]ittihad|ronaldo|messi|mbapp|haaland|salah|yamal|kane|bellingham|vin[ií]cius|guardiola|ancelotti|xabi|flick|slot\b|arteta|maresca|amorim|transfer|fichaj|wechsel|mercato|injur|lesi[oó]n|verletz|blessure|infortun)')

def norm(u):
    return (u or '').split('?')[0].split('#')[0].rstrip('/').lower()

def main(argv):
    pool = argv[argv.index('--pool') + 1] if '--pool' in argv else None
    out = argv[argv.index('--out') + 1] if '--out' in argv else ('/tmp/sports-pool-cand.json' if pool else '/tmp/sports24-cand.json')
    hours = argv[argv.index('--hours') + 1] if '--hours' in argv else '24'
    cap = int(argv[argv.index('--max') + 1]) if '--max' in argv else 400
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
    # big leagues, clubs, transfers and injuries from the WHOLE 24 hours first, then the newest of the rest (the 15:08 run
    # of 17 Nov 2026 got only the newest 200, all from the last 3 hours, so the 24-hour catch-up added nothing)
    keep.sort(key=lambda i: 0 if BIG.search(i.get('title') or '') else 1)
    json.dump({'items': keep[:cap]}, open(out, 'w', encoding='utf-8'), ensure_ascii=False)
    print(f'{len(allc)} sports stories from {len(revs)} world-feed lists in the last {hours} h: {len(onsite)} already on the site, '
          f'{len(noise)} live/TV/betting/quiz/gallery, {len(keep)} left, newest {min(cap, len(keep))} -> {out}')
    return build_pool(out, pool, hours) if pool else 0


SCORE = re.compile(r'\b(\d{1,2})\s*[-–:]\s*(\d{1,2})\b')
NAME = re.compile(r"\b[A-ZÀ-ÖØ-Þ][\w'À-ÿ-]{3,}")
COMMON = {'With','From','After','Before','Premier','League','Champions','Europa','Serie','Liga','Bundesliga','Ligue','World','Cup','Coupe','Copa',
          'Real','Madrid','Barcelona','Manchester','United','City','Inter','Milan','Juventus','Bayern','Paris','Saint','Germain','Chelsea','Arsenal',
          'Liverpool','Tottenham','Atlético','Atletico','Dortmund','Napoli','Roma','England','France','Spain','Italy','Germany','Brazil','Argentina',
          'Football','Soccer','Club','Coach','Match','Game','Final','Season','News','Sport','Sports','FIFA','UEFA','Nations','The','This','That','What',
          'When','Where','Their','There','After','Over','Under','Into','About','Says','Said','Will','Could','Would','Should','Report','Official','Breaking'}


def names(t):
    return {w.strip("'-").lower() for w in NAME.findall(t or '') if w.strip("'-") not in COMMON}


def site_sports_names(days=3):
    # names in the headlines (English, original and Somali) of the site's recent sports articles: a player or coach name is the same
    # in every language, so it catches a Spanish or German report of an event the site already has in English (the 18:08 run of
    # 20 Nov 2026 wrote 12 sports stories and had to delete 7 as repeats)
    import datetime, glob
    cut = (datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(days=days)).isoformat()[:19]
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    out = []
    for f in glob.glob(os.path.join(root, 'data', 'news', '*.json')):
        if os.path.basename(f)[:10] < cut[:10]: continue
        try: n = json.load(open(f, encoding='utf-8'))
        except Exception: continue
        if n.get('section') != 'sports' or (n.get('publishedAt') or '') < cut: continue
        en = n.get('en') if isinstance(n.get('en'), dict) else {}
        out.append((os.path.basename(f)[:-5], names(' '.join(filter(None, [en.get('title'), n.get('originalTitle'), n.get('title')])))))
    return out


def build_pool(cand, pool, hours):
    import datetime, time
    t0 = time.time()
    plan = pool + '.plan'
    r = subprocess.run([sys.executable, os.path.join(os.path.dirname(os.path.abspath(__file__)), 'world_news.py'), 'dedup', cand,
                        '--max-age-hours', str(hours), '--out', plan], timeout=1500)
    if r.returncode != 0: print('dedup failed: no pool written'); return 1
    d = json.load(open(plan, encoding='utf-8'))
    items = [i for i in (d.get('stories') or []) if (i.get('section') or 'sports') == 'sports']
    site = site_sports_names()
    for i in items:
        n = names(i.get('title'))
        hit = next((sid for sid, sn in site if len(n & sn) >= 2 or (len(n & sn) == 1 and len(next(iter(n & sn))) >= 6 and len(n) <= 3)), None)
        if hit: i['likelyOnSite'] = hit
    onsite = sum(1 for i in items if i.get('likelyOnSite'))
    # PAIR CANDIDATES (22 Nov 2026: only 22 of 505 pool stories had "alsoReportedBy", the sports sites are blocked for the run, and
    # the 18:08 run skipped 7 stories as one-source): another outlet's pool item with the same rare names (or one name and the same
    # score) is probably the same event. The run compares the two excerpts and, if they state the same fact, uses it as the second source.
    keys = [(names(i.get('title')), set(SCORE.findall(i.get('title') or ''))) for i in items]
    for a, i in enumerate(items):
        if i.get('alsoReportedBy') or i.get('likelyOnSite'): continue
        na, sa = keys[a]; got = []
        for b, j in enumerate(items):
            if a == b or (j.get('sourceName') or j.get('source')) == (i.get('sourceName') or i.get('source')): continue
            if any((g['source'] == (j.get('sourceName') or j.get('source'))) for g in got): continue
            nb, sb = keys[b]; c = na & nb
            if len(c) >= 2 or (c and sa & sb):
                got.append({'source': j.get('sourceName') or j.get('source'), 'url': j.get('url'), 'title': j.get('title'),
                            'excerpt': (j.get('excerpt') or j.get('description') or '')[:400], 'publishedAt': j.get('publishedAt')})
                if len(got) == 3: break
        if got: i['pairCandidates'] = got
    paired = sum(1 for i in items if i.get('pairCandidates'))
    items.sort(key=lambda i: i.get('publishedAt') or '', reverse=True)
    items.sort(key=lambda i: 0 if BIG.search(i.get('title') or '') else 1)
    items.sort(key=lambda i: 0 if i.get('alsoReportedBy') else 1 if i.get('pairCandidates') else 2)
    items.sort(key=lambda i: 1 if i.get('likelyOnSite') else 0)  # same names as a recent site article: last, check the event first
    two = sum(1 for i in items if i.get('alsoReportedBy'))
    json.dump({'builtAt': datetime.datetime.now(datetime.timezone.utc).isoformat(timespec='seconds'), 'hours': float(hours),
               'dedupSeconds': round(time.time() - t0), 'twoSource': two, 'pairCandidates': paired, 'likelyOnSite': onsite, 'items': items},
              open(pool, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print(f'sports pool: {len(items)} checked stories ({two} already reported by two or more outlets, {paired} with a likely second outlet to compare, {onsite} with the same names as a recent site article, put last) in {time.time() - t0:.0f} s -> {pool}')
    return 0

if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
