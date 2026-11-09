"""Check the official sports sources in data/sports/official-sources.json (run on GitHub Actions; this container
cannot reach most sites).

  python3 tools/sports_sources.py check            for every club / competition: is the website reachable, does its
                                                   robots.txt allow reading the news page, does the website link to
                                                   each listed social account (= the account is the official one),
                                                   which RSS feeds / news sitemaps the site announces
  python3 tools/sports_sources.py check --write    also save the result in the file ("checked" block per entry)
  python3 tools/sports_sources.py for "<text>"     the official sites of the clubs a story names (used by the writer)

Social networks are never opened: an account is "verified" only when the club's own website links to it.
Honest User-Agent, robots.txt respected, one request at a time."""
import json, os, re, sys, time, urllib.parse, urllib.request, urllib.robotparser, datetime

root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FILE = os.path.join(root, 'data', 'sports', 'official-sources.json')
UA = 'WartabiyeTV-SourceCheck/1.0 (+https://www.wartabiyetv.com/)'
SOCIAL = ('x', 'facebook', 'instagram', 'youtube')
ALIASES = {'real-madrid': ['real madrid'], 'barcelona': ['barcelona', 'barca', 'barça'], 'atletico-madrid': ['atletico', 'atlético'],
           'man-city': ['manchester city', 'man city'], 'man-united': ['manchester united', 'man utd', 'man united'],
           'liverpool': ['liverpool'], 'arsenal': ['arsenal'], 'chelsea': ['chelsea'], 'tottenham': ['tottenham', 'spurs'],
           'bayern': ['bayern'], 'dortmund': ['dortmund', 'bvb'], 'leverkusen': ['leverkusen'], 'juventus': ['juventus', 'juve'],
           'inter': ['inter milan', 'internazionale', ' inter '], 'ac-milan': ['ac milan', 'rossoneri'], 'napoli': ['napoli'],
           'psg': ['paris saint-germain', 'psg', 'paris sg']}


def load():
    return json.load(open(FILE, encoding='utf-8'))


def get(url, limit=600000):
    req = urllib.request.Request(url, headers={'User-Agent': UA, 'Accept': 'text/html,application/xml,*/*'})
    with urllib.request.urlopen(req, timeout=20) as r:
        return r.status, r.geturl(), r.read(limit).decode('utf-8', 'replace')


def handle(u):
    p = urllib.parse.urlparse(u)
    return p.path.strip('/').split('/')[0].lstrip('@').lower()


def check_one(e):
    out = {'at': datetime.datetime.now(datetime.timezone.utc).isoformat(timespec='seconds')}
    site = e['website']
    base = '{0.scheme}://{0.netloc}'.format(urllib.parse.urlparse(site))
    rp = urllib.robotparser.RobotFileParser()
    try:
        _, _, robots = get(base + '/robots.txt', 200000)
        rp.parse(robots.splitlines())
        out['sitemaps'] = [l.split(':', 1)[1].strip() for l in robots.splitlines() if l.lower().startswith('sitemap:')][:10]
    except Exception as x:
        robots = ''
        out['robots'] = f'unreadable ({str(x)[:80]})'
    out['newsAllowed'] = rp.can_fetch(UA, e.get('news') or site) if robots else None
    try:
        if robots and not rp.can_fetch(UA, site):
            raise RuntimeError('robots.txt refuses automated readers')
        code, final, html = get(site)
        out['website'] = f'ok {code}' + (f' -> {final}' if final.rstrip('/') != site.rstrip('/') else '')
        low = html.lower()
        links = set(m.lower() for m in re.findall(r'href=["\']([^"\']+)["\']', html))
        for k in SOCIAL:
            if not e.get(k):
                continue
            h = handle(e[k])
            dom = {'x': ('x.com/', 'twitter.com/'), 'facebook': ('facebook.com/',), 'instagram': ('instagram.com/',), 'youtube': ('youtube.com/',)}[k]
            found = any(any(d + h in l or d + '@' + h in l for d in dom) for l in links) or any(d + h in low or d + '@' + h in low for d in dom)
            out[k] = 'linked from the official website' if found else 'NOT found on the website (check by hand)'
        out['feeds'] = sorted(set(re.findall(r'<link[^>]+type=["\']application/(?:rss|atom)\+xml["\'][^>]*href=["\']([^"\']+)', html, re.I)))[:5]
    except Exception as x:
        out['website'] = f'unavailable ({str(x)[:100]})'
    return out


def check(write=False):
    d = load()
    for group in ('clubs', 'competitions'):
        for e in d[group]:
            r = check_one(e)
            print(f"{e['name']}: website {r.get('website')} | news page allowed: {r.get('newsAllowed')} | feeds {r.get('feeds') or '-'}")
            for k in SOCIAL:
                if k in r:
                    print(f"    {k:9} {e[k]}  {r[k]}")
            if r.get('sitemaps'):
                print('    sitemaps', ', '.join(r['sitemaps'][:4]))
            if write:
                e['checked'] = r
            time.sleep(1)
    if write:
        json.dump(d, open(FILE, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)


def for_text(text):
    """-> [{name, website, news}] for the clubs a text names (the writer's first places to verify a story)"""
    t = ' ' + (text or '').lower() + ' '
    d = load()
    out = []
    for e in d['clubs']:
        if any(a in t for a in ALIASES.get(e['id'], [e['name'].lower()])):
            out.append({'name': e['name'], 'website': e['website'], 'news': e.get('news')})
    for e in d['competitions']:
        if e['name'].lower() in t or (e['id'] == 'premier-league' and 'premier league' in t):
            out.append({'name': e['name'], 'website': e['website'], 'news': e.get('news')})
    return out[:6]


if __name__ == '__main__':
    a = sys.argv[1:]
    if a[:1] == ['check']:
        check('--write' in a)
    elif a[:1] == ['for'] and len(a) > 1:
        print(json.dumps(for_text(a[1]), ensure_ascii=False, indent=1))
    elif a[:1] == ['test']:
        r = for_text('Salah scores as Liverpool beat Tottenham in the Premier League')
        assert [x['name'] for x in r] == ['Liverpool', 'Tottenham Hotspur', 'Premier League'], r
        assert [x['name'] for x in for_text('Winter break: Inter beat AC Milan')] == ['Inter Milan', 'AC Milan']
        assert handle('https://www.youtube.com/@realmadrid') == 'realmadrid' and handle('https://x.com/LFC') == 'lfc'
        d = load(); assert all(e.get('website', '').startswith('https://') for e in d['clubs'] + d['competitions'])
        print('SPORTS SOURCES OK')
    else:
        sys.exit(__doc__)
