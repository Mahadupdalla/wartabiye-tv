"""World News (Wararka Caalamka) collector: the eight sources in data/world/sources.json.

Standard library only, so it runs both on GitHub Actions (.github/workflows/world-feeds.yml, which has open internet)
and in the Claude news task. Nothing is published by this tool: it gathers verified candidates, removes duplicate
stories, checks whether each publisher photo may be reused, and writes the run report shown in /admin/.

  python3 tools/world_news.py fetch --out cand.json [--per 10] [--since ISO]   read every enabled source (RSS / sitemap /
                                       public page, robots.txt respected), open each article for its canonical URL,
                                       publication time, Open Graph image and photo credit
  python3 tools/world_news.py merge a.json b.json --out cand.json   join candidate files (e.g. Actions + WebFetch)
  python3 tools/world_news.py dedup cand.json --out plan.json [--since ISO]
                                       group reports of the same event (within the run and against everything the site
                                       has ever had), choose one main article per event, assess its image
  python3 tools/world_news.py report plan.json            readable test report (per source, duplicates, images)
  python3 tools/world_news.py status plan.json [--run run.json]
                                       write data/world/status.json (admin dashboard: sources, counts, errors)

Candidate item: {"source","sourceName","url","canonicalUrl","title","description","excerpt","publishedAt","timeVerified",
 "image","imageCaption","imageCredit","imageLicenseHint","author"}. A candidate added by hand (WebFetch) uses the same keys.
"""
import json, os, re, sys, glob, html, time, datetime, difflib, math, hashlib, subprocess
import urllib.request, urllib.parse, urllib.robotparser
from email.utils import parsedate_to_datetime
from html.parser import HTMLParser
import xml.etree.ElementTree as ET

root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SOURCES = os.path.join(root, 'data', 'world', 'sources.json')
STATUS = os.path.join(root, 'data', 'world', 'status.json')
UA = 'WartabiyeTV-WorldNews/1.0 (+https://mahadupdalla.github.io/wartabiye-tv/)'
EAT = datetime.timezone(datetime.timedelta(hours=3))


def now():
    return datetime.datetime.now(EAT).replace(microsecond=0)


def iso(d):
    return d.astimezone(EAT).isoformat(timespec='seconds') if d else None


def parse_date(s):
    if not s: return None
    s = str(s).strip()
    try:
        d = datetime.datetime.fromisoformat(s.replace('Z', '+00:00'))
        return d if d.tzinfo else None
    except Exception: pass
    try:
        d = parsedate_to_datetime(s)
        return d if d and d.tzinfo else None
    except Exception: return None


# ---------------------------------------------------------------- fetching
_robots = {}


def allowed(url):
    p = urllib.parse.urlsplit(url)
    base = f'{p.scheme}://{p.netloc}'
    if base not in _robots:
        rp = urllib.robotparser.RobotFileParser()
        try:
            body = get(base + '/robots.txt', check=False, timeout=15).decode('utf-8', 'replace')
            rp.parse(body.splitlines())
        except Exception:
            rp.parse([])  # no robots.txt: allowed
        _robots[base] = rp
    return _robots[base].can_fetch(UA, url)


def get(url, check=True, timeout=25):
    if check and not allowed(url):
        raise PermissionError('robots.txt does not allow ' + url)
    last = None
    for i in range(3):
        try:
            req = urllib.request.Request(url, headers={'User-Agent': UA, 'Accept': '*/*'})
            with urllib.request.urlopen(req, timeout=timeout) as r:
                return r.read(4_000_000)
        except urllib.error.HTTPError as e:
            last = e
            if e.code in (401, 402, 403, 404, 410, 451): break
        except Exception as e:
            last = e
        time.sleep(2 * (i + 1))
    raise last


def strip_tags(s):
    s = re.sub(r'(?is)<(script|style).*?</\1>', ' ', s or '')
    return re.sub(r'\s+', ' ', html.unescape(re.sub(r'<[^>]+>', ' ', s))).strip()


def local(tag):
    return tag.rsplit('}', 1)[-1].lower()


def parse_feed(data):
    """RSS 2.0 / Atom / news sitemap -> [{url,title,description,publishedAt,image}]"""
    out = []
    rootel = ET.fromstring(data)
    for it in rootel.iter():
        t = local(it.tag)
        if t not in ('item', 'entry', 'url'): continue
        d = {'url': None, 'title': None, 'description': None, 'publishedAt': None, 'image': None}
        for c in it.iter():
            n = local(c.tag); txt = (c.text or '').strip()
            if n == 'link':
                href = c.get('href'); rel = c.get('rel', 'alternate')
                if href and rel == 'alternate': d['url'] = d['url'] or href
                elif txt: d['url'] = d['url'] or txt
            elif n == 'loc' and t == 'url': d['url'] = d['url'] or txt
            elif n == 'title': d['title'] = d['title'] or strip_tags(txt)
            elif n in ('description', 'summary') : d['description'] = d['description'] or strip_tags(txt)[:600]
            elif n == 'encoded' and not d['description']: d['description'] = strip_tags(txt)[:600]
            elif n in ('pubdate', 'published', 'publication_date', 'date', 'updated', 'lastmod') and not d['publishedAt']:
                dt = parse_date(txt)
                if dt: d['publishedAt'] = iso(dt)
            elif n in ('content', 'thumbnail') and c.get('url') and not d['image'] and (c.get('medium') in (None, 'image') or n == 'thumbnail'):
                d['image'] = c.get('url')
            elif n == 'enclosure' and c.get('url') and 'image' in (c.get('type') or 'image') and not d['image']:
                d['image'] = c.get('url')
            elif n == 'loc' and t != 'url' and not d['image']:
                d['image'] = txt  # image:image/image:loc inside a sitemap url
        if d['url'] and (t != 'url' or d['url'] != d['image']):
            out.append(d)
    return out


class Meta(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.meta, self.canon, self.ld, self.paras, self.caps, self.links = {}, None, [], [], [], []
        self._in = None; self._buf = []

    def handle_starttag(self, tag, a):
        a = dict(a)
        if tag == 'meta':
            k = (a.get('property') or a.get('name') or a.get('itemprop') or '').lower()
            if k and a.get('content') and k not in self.meta: self.meta[k] = a['content']
        elif tag == 'link' and (a.get('rel') or '').lower() == 'canonical' and a.get('href'):
            self.canon = a['href']
        elif tag == 'a' and a.get('href'):
            self.links.append(a['href'])
        elif tag == 'script' and 'ld+json' in (a.get('type') or ''):
            self._in, self._buf = 'ld', []
        elif tag in ('p', 'figcaption') and self._in is None:
            self._in, self._buf = tag, []

    def handle_data(self, d):
        if self._in: self._buf.append(d)

    def handle_endtag(self, tag):
        if self._in == 'ld' and tag == 'script':
            self.ld.append(''.join(self._buf)); self._in = None
        elif self._in == tag:
            t = re.sub(r'\s+', ' ', ''.join(self._buf)).strip()
            if t: (self.paras if tag == 'p' else self.caps).append(t)
            self._in = None


def ld_items(blobs):
    for b in blobs:
        try: j = json.loads(b)
        except Exception: continue
        stack = [j]
        while stack:
            x = stack.pop()
            if isinstance(x, list): stack.extend(x)
            elif isinstance(x, dict):
                if '@graph' in x: stack.extend(x['@graph'] if isinstance(x['@graph'], list) else [x['@graph']])
                yield x


AGENCY = re.compile(r'\b(AP Photo|Associated Press|AFP|Getty|Reuters|EPA|Anadolu|AA Photo|IHA|DHA|Shutterstock|Alamy|PA Images|Pool via)\b', re.I)
FREE = re.compile(r'creativecommons\.org/(licenses|publicdomain)/|\bCC[ -]?(BY|0)\b|public domain', re.I)
GENERIC = re.compile(r'(logo|placeholder|default|thumbnail-?\d|text-thumbnail|fallback|og-image|share-image|sprite)', re.I)


def article(url):
    """Open the article page; return the verified metadata (never the full text)."""
    p = Meta()
    p.feed(get(url).decode('utf-8', 'replace'))
    m = p.meta
    out = {'canonicalUrl': p.canon or m.get('og:url'), 'title': m.get('og:title') or m.get('twitter:title'),
           'description': m.get('og:description') or m.get('description'),
           'publishedAt': None, 'image': m.get('og:image') or m.get('twitter:image'), 'author': m.get('author')}
    for k in ('article:published_time', 'og:article:published_time', 'datepublished', 'publishdate', 'pubdate', 'date'):
        d = parse_date(m.get(k))
        if d: out['publishedAt'] = iso(d); break
    for x in ld_items(p.ld):
        if not out['publishedAt'] and x.get('datePublished'):
            d = parse_date(x['datePublished'])
            if d: out['publishedAt'] = iso(d)
        if out['title']:
        out['title'] = re.sub(r'\s+[-|–]\s+(Türkiye Today|CNN( Politics| Business)?|Euronews|Daily Sabah|IGAD)\s*$', '', out['title'])
    if not out['author'] and isinstance(x.get('author'), (dict, list)):
            a = x['author'][0] if isinstance(x['author'], list) and x['author'] else x['author']
            if isinstance(a, dict): out['author'] = a.get('name')
    out['_paras'] = [t for t in p.paras if len(t) > 60][:25]
    text = ' '.join(out['_paras'])
    cap = ' | '.join(p.caps[:2])
    out['imageCaption'] = cap[:300] or None
    credit = AGENCY.search(cap) or AGENCY.search(m.get('og:image:alt') or '') or AGENCY.search(text[:300])
    out['imageCredit'] = credit.group(1) if credit else None
    out['imageLicenseHint'] = 'free' if FREE.search(cap) else None
    return out


def fetch(args):
    cfg = json.load(open(SOURCES, encoding='utf-8'))
    per = int(opt(args, '--per', cfg.get('perSource', {}).get('max', 10)))
    since = parse_date(opt(args, '--since', None))
    items, report = [], []
    for s in cfg['sources']:
        rep = {'id': s['id'], 'name': s['name'], 'homepage': s.get('homepage'), 'enabled': s.get('enabled', True),
               'method': None, 'found': 0, 'collected': 0, 'errors': []}
        report.append(rep)
        if not s.get('enabled', True) or not s.get('feeds'):
            rep['errors'].append(s.get('notes') or 'disabled'); continue
        listing = []
        for f in s['feeds']:
            try:
                data = get(f['url'])
                if f['type'] in ('rss', 'sitemap'):
                    if not data.lstrip()[:200].lower().startswith((b'<?xml', b'<rss', b'<feed', b'<urlset')) and b'<rss' not in data[:500]:
                        raise ValueError('not a feed (the address answers with a web page)')
                    got = parse_feed(data)
                else:
                    p = Meta(); p.feed(data.decode('utf-8', 'replace'))
                    seen = set(); got = []
                    for h in p.links:
                        u = urllib.parse.urljoin(f['url'], h).split('#')[0]
                        if u not in seen and re.match(f['linkPattern'], u): seen.add(u); got.append({'url': u})
                if f.get('linkPattern') and f['type'] != 'html':
                    got = [g for g in got if re.match(f['linkPattern'], g['url'])]
                if not got: raise ValueError('feed has no items')
                dated = [parse_date(g.get('publishedAt')) for g in got if g.get('publishedAt')]
                if f.get('maxAgeDays') and dated and max(dated) < now() - datetime.timedelta(days=f['maxAgeDays']):
                    raise ValueError(f'feed is stale (newest item {iso(max(dated))[:10]})')
                listing = got; rep['method'] = f"{f['type']} {f['url']}"; break
            except Exception as e:
                rep['errors'].append(f"{f['type']} {f['url']}: {type(e).__name__}: {e}"[:300])
        if not listing: continue
        first = len(items)
        rep['found'] = len(listing)
        # video clips, galleries and live blogs are not articles
        listing = [g for g in listing if not re.search(r'/(video|videos|gallery|live-news|live)/', g['url'])]
        listing.sort(key=lambda g: g.get('publishedAt') or '', reverse=True)
        for g in listing[:per * 2]:
            if rep['collected'] >= per: break
            if since and g.get('publishedAt') and parse_date(g['publishedAt']) < since: continue
            it = {'source': s['id'], 'sourceName': s['name'], 'url': g['url'], 'title': g.get('title'),
                  'description': g.get('description'), 'publishedAt': g.get('publishedAt'), 'image': g.get('image'),
                  'timeVerified': bool(g.get('publishedAt'))}
            try:
                a = article(g['url'])
                for k, v in a.items():
                    if v and (k in ('canonicalUrl', '_paras', 'imageCaption', 'imageCredit', 'imageLicenseHint', 'author') or not it.get(k)):
                        it[k] = v
                if a.get('publishedAt'): it['publishedAt'] = a['publishedAt']; it['timeVerified'] = True
                if a.get('image'): it['image'] = a['image']
            except Exception as e:
                it['articleError'] = f'{type(e).__name__}: {e}'[:200]
            if not it.get('publishedAt'):
                rep['errors'].append(f"no verifiable publication date: {g['url']}"); continue
            if since and parse_date(it['publishedAt']) < since: continue
            if not it.get('title'): continue
            if it.get('title'):
                it['title'] = re.sub(r'\s+[-|–]\s+(Türkiye Today|CNN( Politics| Business)?|Euronews|Daily Sabah|IGAD)\s*$', '', it['title'])
            items.append(it); rep['collected'] += 1
            time.sleep(0.5)
        mine = items[first:]
        seenp = {}
        for it in mine:
            for t in set(it.get('_paras') or []): seenp[t] = seenp.get(t, 0) + 1
        for it in mine:
            body = [t for t in it.pop('_paras', None) or [] if seenp.get(t, 0) < 2]
            it['excerpt'] = ' '.join(body)[:1000] or None
    out = {'fetchedAt': iso(now()), 'since': iso(since) if since else None, 'sources': report, 'items': items}
    save(opt(args, '--out', '-'), out)


# ---------------------------------------------------------------- duplicates
STOP = set('''a an the of to in on for and or but with by from at as is are was were be been being it its this that these those
has have had will would can could may might says said say after before over under into about amid against between new latest
than more most up down out off also not no yes he she they them their his her we our you your who what when where why how
which while during per via vs report reports reported according live update updates news video watch photos year years day
days week weeks month time first last two three one four five six seven eight nine ten amid set us'''.split())
DEMONYM = {'iranian': 'iran', 'israeli': 'israel', 'ukrainian': 'ukraine', 'russian': 'russia', 'turkish': 'turkiye', 'turkey': 'turkiye',
           'türkiye': 'turkiye', 'american': 'usa', 'u.s.': 'usa', 'us': 'usa', 'united states': 'usa', 'washington': 'usa',
           'chinese': 'china', 'beijing': 'china', 'german': 'germany', 'berlin': 'germany', 'french': 'france', 'paris': 'france',
           'british': 'uk', 'britain': 'uk', 'london': 'uk', 'palestinian': 'palestine', 'gazan': 'gaza', 'syrian': 'syria',
           'lebanese': 'lebanon', 'somali': 'somalia', 'ethiopian': 'ethiopia', 'kenyan': 'kenya', 'sudanese': 'sudan',
           'djiboutian': 'djibouti', 'eritrean': 'eritrea', 'ugandan': 'uganda', 'egyptian': 'egypt', 'saudi': 'saudi arabia',
           'qatari': 'qatar', 'emirati': 'uae', 'european': 'eu', 'bulgarian': 'bulgaria', 'polish': 'poland', 'indian': 'india',
           'pakistani': 'pakistan', 'afghan': 'afghanistan', 'japanese': 'japan', 'korean': 'korea', 'tehran': 'iran',
           'moscow': 'russia', 'kyiv': 'ukraine', 'ankara': 'turkiye', 'istanbul': 'turkiye', 'jordanian': 'jordan',
           'yemeni': 'yemen', 'iraqi': 'iraq', 'venezuelan': 'venezuela', 'mexican': 'mexico', 'brazilian': 'brazil',
           'nigerian': 'nigeria', 'belgian': 'belgium', 'dutch': 'netherlands', 'italian': 'italy', 'spanish': 'spain'}
PLACES = set('''afghanistan albania algeria angola argentina armenia australia austria azerbaijan bahrain bangladesh belarus belgium
bolivia bosnia brazil bulgaria burundi cambodia cameroon canada chad chile china colombia congo croatia cuba cyprus czechia denmark
djibouti egypt eritrea estonia ethiopia eu finland france gabon gaza georgia germany ghana greece greenland guinea haiti hungary india
indonesia iran iraq ireland israel italy japan jordan kazakhstan kenya korea kosovo kuwait lebanon libya lithuania mali mexico moldova
morocco mozambique myanmar nepal netherlands niger nigeria norway oman pakistan palestine philippines poland portugal qatar romania
russia rwanda saudi serbia somalia somaliland spain sudan sweden switzerland syria taiwan tanzania thailand tunisia turkiye uae uganda
uk ukraine usa venezuela vietnam yemen zambia zimbabwe hormuz zaporizhzhia khartoum darfur tigray mogadishu nairobi addis sofia florida
doha cairo beirut damascus baghdad kabul riyadh lagos'''.split())


def norm_url(u):
    if not u: return ''
    p = urllib.parse.urlsplit(u.strip())
    host = p.netloc.lower().removeprefix('www.').removeprefix('edition.').removeprefix('amp.')
    path = re.sub(r'/(amp|index\.html?)$', '', p.path.rstrip('/'))
    return (host + path).lower()


def skel(w):
    """spelling-insensitive key: Yotova/Iotova, Zelensky/Zelenskyy"""
    w = w.lower().replace('ü', 'u').replace('ö', 'o').replace('ç', 'c').replace('ş', 's').replace('ğ', 'g').replace('ı', 'i')
    w = w.replace('y', 'i').replace('ph', 'f').replace('c', 'k').replace('q', 'k')
    return re.sub(r'(.)\1+', r'\1', w)


def words(s):
    s = (s or '').replace('’', "'")
    toks = re.findall(r"[A-Za-zÀ-ÿĞğİıŞşÇçÖöÜü0-9][A-Za-zÀ-ÿĞğİıŞşÇçÖöÜü0-9.'-]*", s)
    out = []
    for t in toks:
        t = t.lower().strip(".'-").removesuffix("'s")
        if len(t) < 2 or t in STOP: continue
        t = DEMONYM.get(t, t)
        if len(t) > 4 and t.endswith('s') and not t.endswith('ss'): t = t[:-1]
        out.append(skel(t) if not t.isdigit() else t)
    return out


def entities(s):
    """Capitalised names (people, organisations, places) in the original-case text, spelling-insensitive."""
    ents = set()
    for m in re.finditer(r"(?:[A-ZÇĞİÖŞÜ][\w'’.-]+|[A-Z]{2,})(?:\s+(?:[A-ZÇĞİÖŞÜ][\w'’.-]+|[A-Z]{2,}))*", s or ''):
        for w in m.group(0).split():
            w = w.strip(".'’-").removesuffix("'s").removesuffix("’s")
            lw = w.lower()
            if len(w) < 3 or lw in STOP: continue
            ents.add(skel(DEMONYM.get(lw, lw)))
    return ents


def places(s):
    t = ' ' + re.sub(r'[^a-zçğıöşü. ]', ' ', (s or '').lower()) + ' '
    out = set()
    for k, v in DEMONYM.items():
        if f' {k} ' in t and v in PLACES | {'usa', 'uk', 'eu', 'saudi arabia'}: out.add(v)
    for p in PLACES:
        if f' {p} ' in t: out.add(p)
    return out


def numbers(s):
    return set(re.findall(r'\b\d+(?:[.,]\d+)?\b', s or '')) - {str(y) for y in range(2020, 2031)}


def fuzzy_jaccard(a, b):
    a, b = set(a), set(b)
    if not a or not b: return 0.0
    hit = 0
    for x in a:
        if x in b or (len(x) > 4 and any(len(y) > 4 and difflib.SequenceMatcher(None, x, y).ratio() >= 0.84 for y in b)): hit += 1
    return hit / (len(a) + len(b) - hit)


def cosine(a, b, idf):
    va, vb = {}, {}
    for w in a: va[w] = va.get(w, 0) + idf.get(w, 1)
    for w in b: vb[w] = vb.get(w, 0) + idf.get(w, 1)
    dot = sum(v * vb.get(k, 0) for k, v in va.items())
    na = math.sqrt(sum(v * v for v in va.values())); nb = math.sqrt(sum(v * v for v in vb.values()))
    return dot / (na * nb) if na and nb else 0.0


def features(x):
    full = ' '.join(filter(None, [x.get('title'), x.get('description'), x.get('excerpt')]))
    return {'tw': words(x.get('title')), 'cw': words(full), 'ents': entities(' '.join(filter(None, [x.get('title'), x.get('description')]))),
            'places': places(full), 'nums': numbers(' '.join(filter(None, [x.get('title'), x.get('description')]))),
            'date': parse_date(x.get('publishedAt'))}


def compare(a, b, idf):
    """-> (verdict, score, reasons): verdict 'duplicate' (same event), 'related' (same ongoing story, new development) or None"""
    fa, fb = a['_f'], b['_f']
    if fa['date'] and fb['date'] and abs((fa['date'] - fb['date']).total_seconds()) > 72 * 3600: return None, 0, []
    t = fuzzy_jaccard(fa['tw'], fb['tw'])
    c = cosine(fa['cw'], fb['cw'], idf)
    e = fuzzy_jaccard(fa['ents'], fb['ents'])
    shared_places = fa['places'] & fb['places']
    pl = len(shared_places) / max(1, len(fa['places'] | fb['places']))
    score = 0.35 * t + 0.35 * c + 0.2 * e + 0.1 * pl
    hours = abs((fa['date'] - fb['date']).total_seconds()) / 3600 if fa['date'] and fb['date'] else 0
    reasons = [f'headline {t:.2f}', f'content {c:.2f}', f'names {e:.2f}', 'places ' + (','.join(sorted(shared_places)) or '-'), f'{hours:.0f}h apart']
    # conflicting key figures in the headline (e.g. a new death toll, a new vote result) mean a new development
    nums_conflict = fa['nums'] and fb['nums'] and not (fa['nums'] & fb['nums']) and t < 0.5
    same_place = (bool(shared_places) and (e >= 0.2 or t >= 0.5)) or e >= 0.3
    if same_place and hours <= 36 and not nums_conflict and (score >= 0.40 or (t >= 0.5 and c >= 0.3) or (e >= 0.45 and c >= 0.45) or (e >= 0.55 and c >= 0.3)):
        return 'duplicate', score, reasons
    if same_place and score >= 0.25:
        return 'related', score, reasons + (['different figures'] if nums_conflict else [])
    return None, score, reasons


def known_articles(days=5):
    """Everything the site has (World and others), plus URLs and titles of deleted/unpublished ones (never brought back)."""
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    import known_sources
    ids, urls, titles, deleted = known_sources.collect()
    cut = (now() - datetime.timedelta(days=days)).isoformat()
    arts = []
    for f in glob.glob(os.path.join(root, 'data', 'news', '*.json')):
        try: n = json.load(open(f, encoding='utf-8'))
        except Exception: continue
        if (n.get('publishedAt') or '') < cut[:19]: continue
        en = n.get('en') if isinstance(n.get('en'), dict) else {}
        arts.append({'id': os.path.basename(f)[:-5], 'url': n.get('sourceUrl'), 'title': en.get('title') or n.get('originalTitle') or n.get('title'),
                     'description': en.get('summary') or n.get('summary'), 'publishedAt': n.get('publishedAt'),
                     'alsoUrls': [x.get('url') for x in n.get('alsoReportedBy') or [] if isinstance(x, dict)]})
    return {norm_url(u) for u in urls}, arts


def image_check(x, cfg_src):
    """May Wartabiye TV show this publisher photo? Only with a stated free licence; agency photos never."""
    img = x.get('image')
    if not img: return 'none', 'no image in the feed or Open Graph data'
    if GENERIC.search(img.rsplit('/', 1)[-1]) or x.get('_sharedImage'):
        return 'generic', 'generic thumbnail or logo, not a photo of this story'
    if x.get('imageCredit') and AGENCY.search(x['imageCredit']):
        return 'not-reusable', f"agency photo ({x['imageCredit']}), all rights reserved"
    if x.get('imageLicenseHint') == 'free':
        return 'reusable', 'caption states a free licence (verify on the publisher page)'
    pol = (cfg_src or {}).get('imagePolicy', 'unknown')
    if pol == 'all-rights-reserved':
        return 'not-reusable', f"{(cfg_src or {}).get('name')} photos are all rights reserved"
    return 'unknown', 'licence not stated: treated as not reusable'


def dedup(args):
    cand = json.load(open(args[0], encoding='utf-8'))
    cfg = {s['id']: s for s in json.load(open(SOURCES, encoding='utf-8'))['sources']}
    since = parse_date(opt(args, '--since', None))
    known_urls, site = known_articles()
    items = [dict(x) for x in cand['items']]
    # images used by two or more items of the same source are generic thumbnails
    imgcount = {}
    for x in items:
        if x.get('image'): imgcount[(x['source'], x['image'])] = imgcount.get((x['source'], x['image']), 0) + 1
    for x in items:
        x['_sharedImage'] = bool(x.get('image')) and imgcount.get((x['source'], x['image']), 0) > 1
    for x in items + site:
        x['_f'] = features(x)
    df = {}
    docs = items + site
    for x in docs:
        for w in set(x['_f']['cw']): df[w] = df.get(w, 0) + 1
    idf = {w: math.log((1 + len(docs)) / (1 + c)) + 1 for w, c in df.items()}
    rejected, plan = [], []
    # 1. same URL / canonical URL as something the site has ever had, or as another candidate
    seen = {}
    fresh = []
    for x in items:
        keys = {norm_url(x.get('url')), norm_url(x.get('canonicalUrl'))} - {''}
        if since and x.get('publishedAt') and parse_date(x['publishedAt']) < since:
            rejected.append({**pub(x), 'why': 'old', 'detail': 'published before the last successful update'}); continue
        if keys & known_urls:
            rejected.append({**pub(x), 'why': 'known', 'detail': 'same URL already on the site (or deleted/unpublished by the owner)'}); continue
        dup = next((seen[k] for k in keys if k in seen), None)
        if dup is not None:
            rejected.append({**pub(x), 'why': 'duplicate', 'of': dup['url'], 'detail': 'same article URL / canonical URL'}); continue
        for k in keys: seen[k] = x
        fresh.append(x)
    # 2. same event already published on the site
    left = []
    for x in fresh:
        best = None
        for a in site:
            v, sc, why = compare(x, a, idf)
            if v == 'duplicate' and (not best or sc > best[1]): best = (a, sc, why)
        if best:
            rejected.append({**pub(x), 'why': 'on-site', 'of': best[0]['id'], 'score': round(best[1], 2), 'detail': '; '.join(best[2])})
        else: left.append(x)
    # 3. group candidates that report the same event (single-link clustering on "duplicate")
    groups = []
    for x in sorted(left, key=lambda i: i.get('publishedAt') or ''):
        hit = None
        for g in groups:
            for y in g[:1]:
                v, sc, why = compare(x, y, idf)
                if v == 'duplicate': hit = (g, y, sc, why); break
            if hit: break
        if hit:
            hit[0].append(x); x['_dupof'] = (hit[1]['url'], round(hit[2], 2), '; '.join(hit[3]))
        else: groups.append([x])
    for g in groups:
        def rank(i):
            s = cfg.get(i['source'], {})
            return (s.get('priority', 50) + min(len(i.get('excerpt') or i.get('description') or ''), 1000) / 50
                    + (5 if i.get('timeVerified') else 0) + (3 if i.get('image') else 0))
        g.sort(key=rank, reverse=True)
        main = g[0]
        st, why = image_check(main, cfg.get(main['source']))
        entry = {**pub(main), 'imageStatus': st, 'imageReason': why,
                 'alsoReportedBy': [{'source': y['sourceName'], 'url': y['url']} for y in g[1:]], 'related': []}
        for y in g[1:]:
            v, sc, why = compare(y, main, idf)
            rejected.append({**pub(y), 'why': 'duplicate', 'of': main['url'], 'score': round(sc, 2),
                             'detail': '; '.join(why) + f" | kept {main['sourceName']} (more complete / more reliable)"})
        plan.append(entry)
    # 4. related coverage (same ongoing story, separate development): kept, but linked so the writer can tell them apart
    for e in plan:
        ex = next(i for i in left if i['url'] == e['url'])
        for o in plan:
            if o is e: continue
            oy = next(i for i in left if i['url'] == o['url'])
            v, sc, why = compare(ex, oy, idf)
            if v == 'related': e['related'].append({'url': o['url'], 'score': round(sc, 2)})
        for a in site:
            v, sc, why = compare(ex, a, idf)
            if v == 'related': e['related'].append({'id': a['id'], 'score': round(sc, 2)})
    plan.sort(key=lambda e: e.get('publishedAt') or '', reverse=True)
    counts = {}
    for s in cand.get('sources', []):
        c = {'collected': s.get('collected', 0), 'kept': 0, 'duplicates': 0, 'known': 0, 'old': 0}
        counts[s['id']] = c
    for e in plan: counts.setdefault(e['source'], {'collected': 0, 'kept': 0, 'duplicates': 0, 'known': 0, 'old': 0})['kept'] += 1
    for r in rejected:
        c = counts.setdefault(r['source'], {'collected': 0, 'kept': 0, 'duplicates': 0, 'known': 0, 'old': 0})
        c['duplicates' if r['why'] in ('duplicate', 'on-site') else r['why']] += 1
    out = {'plannedAt': iso(now()), 'fetchedAt': cand.get('fetchedAt'), 'since': cand.get('since'), 'sources': cand.get('sources', []),
           'counts': counts, 'stories': plan, 'rejected': rejected}
    save(opt(args, '--out', '-'), out)


def pub(x):
    return {k: x.get(k) for k in ('source', 'sourceName', 'url', 'canonicalUrl', 'title', 'description', 'excerpt', 'publishedAt',
                                  'timeVerified', 'image', 'imageCaption', 'imageCredit', 'author', 'articleError') if x.get(k) not in (None, '')}


# ---------------------------------------------------------------- report / status
def report(args):
    p = json.load(open(args[0], encoding='utf-8'))
    L = []
    L.append(f"World News test — fetched {p.get('fetchedAt')}  window since {p.get('since') or '-'}")
    L.append('')
    L.append(f"{'source':<16}{'method / error':<62}{'got':>4}{'kept':>5}{'dup':>5}{'known':>6}")
    for s in p['sources']:
        c = p['counts'].get(s['id'], {})
        m = s.get('method') or ('FAILED: ' + '; '.join(s.get('errors') or ['-']))
        L.append(f"{s['name'][:15]:<16}{m[:61]:<62}{s.get('collected', 0):>4}{c.get('kept', 0):>5}{c.get('duplicates', 0):>5}{c.get('known', 0):>6}")
    L.append('')
    img = {}
    for e in p['stories']: img[e['imageStatus']] = img.get(e['imageStatus'], 0) + 1
    L.append(f"stories kept: {len(p['stories'])}   duplicates removed: {sum(1 for r in p['rejected'] if r['why'] in ('duplicate', 'on-site'))}"
             f"   already known: {sum(1 for r in p['rejected'] if r['why'] == 'known')}   images: " + ', '.join(f'{k} {v}' for k, v in sorted(img.items())))
    L.append('')
    L.append('DUPLICATES')
    for r in p['rejected']:
        if r['why'] in ('duplicate', 'on-site'):
            L.append(f"  - [{r['sourceName']}] {r['title'][:90]}\n      same event as {r['of']}\n      {r.get('detail', '')}")
    L.append('')
    L.append('FEED (newest first)')
    for e in p['stories']:
        also = ' + ' + ', '.join(a['source'] for a in e['alsoReportedBy']) if e['alsoReportedBy'] else ''
        L.append(f"  {e['publishedAt'][:16]}  [{e['sourceName']}{also}] {e['title'][:95]}")
        L.append(f"      image: {e['imageStatus']} ({e['imageReason']})" + (f"  related: {len(e['related'])}" if e['related'] else ''))
    print('\n'.join(L))


def status(args):
    p = json.load(open(args[0], encoding='utf-8'))
    run = json.load(open(opt(args, '--run'), encoding='utf-8')) if opt(args, '--run') else {}
    old = json.load(open(STATUS, encoding='utf-8')) if os.path.exists(STATUS) else {}
    ok_sources = [s for s in p['sources'] if s.get('method')]
    srcs = []
    for s in p['sources']:
        c = p['counts'].get(s['id'], {})
        r = (run.get('perSource') or {}).get(s['id'], {})
        srcs.append({'id': s['id'], 'name': s['name'], 'homepage': s.get('homepage') or '', 'working': bool(s.get('method')),
                     'method': s.get('method') or '', 'collected': s.get('collected', 0), 'duplicates': c.get('duplicates', 0),
                     'published': r.get('published', 0), 'pendingImage': r.get('pendingImage', 0),
                     'errors': '; '.join(s.get('errors') or [])[:500]})
    ok = bool(ok_sources) and not run.get('failed')
    at = run.get('at') or iso(now())
    entry = {'at': at, 'ok': ok, 'collected': sum(s['collected'] for s in srcs),
             'duplicatesRemoved': sum(1 for r in p['rejected'] if r['why'] in ('duplicate', 'on-site')),
             'alreadyKnown': sum(1 for r in p['rejected'] if r['why'] == 'known'),
             'published': run.get('published', 0), 'pendingImage': run.get('pendingImage', 0),
             'pendingIds': run.get('pendingIds', []), 'imageErrors': run.get('imageErrors', []), 'errors': run.get('errors', [])}
    out = {'lastRunAt': at, 'lastSuccessAt': at if ok else old.get('lastSuccessAt'), 'lastRun': entry, 'sources': srcs,
           'history': ([{k: entry[k] for k in ('at', 'ok', 'collected', 'duplicatesRemoved', 'published', 'pendingImage')}]
                       + (old.get('history') or []))[:30]}
    save(STATUS, out)
    print(f"data/world/status.json: {len(ok_sources)}/{len(srcs)} sources working, {entry['collected']} collected, "
          f"{entry['duplicatesRemoved']} duplicates, {entry['published']} published, {entry['pendingImage']} waiting for a photo")


def merge(args):
    files = [a for a in args if not a.startswith('--') and a != opt(args, '--out')]
    out = {'fetchedAt': iso(now()), 'since': None, 'sources': [], 'items': []}
    bysrc = {}
    for f in files:
        d = json.load(open(f, encoding='utf-8'))
        out['since'] = out['since'] or d.get('since')
        for s in d.get('sources', []):
            b = bysrc.get(s['id'])
            if not b: bysrc[s['id']] = dict(s); out['sources'].append(bysrc[s['id']])
            elif s.get('method') and not b.get('method'): b.update(s)
            elif s.get('method'): b['collected'] = b.get('collected', 0) + s.get('collected', 0)
        out['items'] += d.get('items', [])
    save(opt(args, '--out', '-'), out)


def opt(args, name, default=None):
    return args[args.index(name) + 1] if name in args and args.index(name) + 1 < len(args) else default


def save(path, obj):
    s = json.dumps(obj, ensure_ascii=False, indent=1, default=lambda o: None)
    if path == '-': print(s)
    else:
        os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
        open(path, 'w', encoding='utf-8').write(s + '\n')


if __name__ == '__main__':
    cmd, rest = (sys.argv[1], sys.argv[2:]) if len(sys.argv) > 1 else ('help', [])
    fn = {'fetch': fetch, 'dedup': dedup, 'report': report, 'status': status, 'merge': merge}.get(cmd)
    if not fn: print(__doc__); sys.exit(2)
    fn(rest)
