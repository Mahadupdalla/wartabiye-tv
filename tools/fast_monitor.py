"""5-minute source monitor (Ilaha degdegga ah): finds NEW articles from the sources marked "fastPoll" in
data/world/sources.json within minutes of publication, without a Claude run.

It runs on GitHub Actions (.github/workflows/fast-sources.yml, every 5 minutes inside the owner's operating hours
from data/schedule.json). Standard library only. It publishes NOTHING by itself:
  - reads each fastPoll source's official RSS feed (conditional GET: ETag / Last-Modified, robots.txt respected);
  - an item is NEW only when its stable id (canonical URL / guid) was never seen before AND the publisher's own
    publication time is recent; the very first check of a source only records what already exists (baseline), so old
    stories are never treated as new; the publisher's time is kept exactly as published, never estimated;
  - for each new item it opens the article page once for the canonical URL, the publication time and the photo credit;
  - "monitorOnly" sources (no permission yet, e.g. DutchNews) are checked for availability only: no headline, link or
    text is stored or passed on;
  - new items go to candidates.json on branch "fast-feed" (same format as tools/world_news.py fetch) and are added to
    the hourly news task's own list (branch world-feed, candidates.json), so the next hourly run writes the verified
    Somali story, finds a licensed photo and publishes;
  - it follows each story through the pipeline: first discovered -> article file on main (published or held for a photo)
    -> really live on https://www.wartabiyetv.com/data/news.json, and measures the delays;
  - it writes the diagnostics (data/world/fast-status.json) and raises an admin alert (GitHub issue) when a source is
    unavailable or silent for too long.

  python3 tools/fast_monitor.py run --state DIR [--force]   one check (DIR = checkout of branch fast-feed, may be empty)
  python3 tools/fast_monitor.py hours                       prints "open" or "closed" for the current Nairobi time
  python3 tools/fast_monitor.py handoff --fast cand.json --world world-cand.json   add fresh items to the hourly task's list
  python3 tools/fast_monitor.py probe                       feed check: does each feed answer, newest items
  python3 tools/fast_monitor.py test                        self-test, no network
"""
import json, os, re, sys, glob, time, datetime, subprocess, statistics, email.utils
import urllib.request, urllib.error, urllib.parse
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import world_news as w
import east_africa

root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SOURCES = os.path.join(root, 'data', 'world', 'sources.json')
SCHEDULE = os.path.join(root, 'data', 'schedule.json')
STATUS_MAIN = os.path.join(root, 'data', 'world', 'fast-status.json')
SITE_NEWS = 'https://www.wartabiyetv.com/data/news.json'
EAT = w.EAT
NEW_MAX_AGE_H = 2        # owner's rule (8 Nov 2026): a never-seen item older than 2 hours is never "new"
KEEP_CANDIDATE_H = 3     # how long a discovered item stays in the hand-off list for the news task
# Somalia (owner's request of 10 Nov 2026: "actively search for eligible Somalia stories instead of ignoring the category"):
# a Somali source's story stays in the hand-off list, and a never-seen one is still passed on, for the 24-hour Somalia
# catch-up (tools/world_news.py SOMALIA_HOURS). With the 3-hour limit the 3-hourly news task saw at most the last 3 hours
# of Somalia stories (a late run saw less), and a story left "pending" (headline-only, no second source yet) vanished
# before the next run could look for its confirmation again. The task's dedup still marks these "catchUp" (never breaking,
# publisher's own time) and still rejects anything the site already has.
SO_KEEP_H = w.SOMALIA_HOURS
KEEP_DAYS = 7            # how long seen ids are remembered
ERRORS_FOR_ALERT = 3     # consecutive failed checks (about 15 minutes) before "unavailable"
# owner's rule (8 Nov 2026, evening): new intake = SOURCE STORY AGE <= 5 MINUTES. Age = the moment this check saw the item
# minus the publisher's own publication time (RSS pubDate / Atom published / article:published_time / JSON-LD datePublished),
# never the import time. Priority 1 = age <= 5 min ("fresh", the only items that may be breaking news). Priority 2 = older
# than 5 min but inside NEW_MAX_AGE_H (fallback for the editorial rules: never breaking, never shown as "just now").
FRESH_INTAKE_MIN = 5
CLOCK_SKEW_MIN = 2       # a publisher time up to 2 min in the future (clock difference) counts as age 0
FUTURE_UNTRUSTED_MIN = 10  # a publisher time more than 10 min in the future cannot be trusted: timestamp_unverified
HEALTH_STALE_MIN = 20    # no completed check for 20 minutes = the collector has stopped (0 new stories is healthy)


def now():
    return datetime.datetime.now(EAT).replace(microsecond=0)


def iso(d): return w.iso(d)


def parse(s): return w.parse_date(s)


def load(p, default):
    try: return json.load(open(p, encoding='utf-8'))
    except Exception: return default


# ---------------------------------------------------------------- operating hours
def hours_of(sched):
    """(start_hour, end_hour) in Africa/Nairobi, or None for 24/7. Accepts "24/7" or "07:00-23:00"."""
    h = str((sched or {}).get('hours') or '24/7').strip()
    m = re.fullmatch(r'(\d{1,2})(?::00)?\s*[-–]\s*(\d{1,2})(?::00)?', h)
    if not m: return None
    a, b = int(m[1]), int(m[2])
    return None if a == b or (a, b) == (0, 24) else (a, b)


def is_open(t, sched):
    hb = hours_of(sched)
    if not hb: return True
    a, b = hb; h = t.astimezone(EAT).hour
    return a <= h < b if a < b else (h >= a or h < b)


def window_start(t, sched):
    """Start of the current operating period (for labelling overnight stories), or None for 24/7."""
    hb = hours_of(sched)
    if not hb: return None
    t = t.astimezone(EAT); s = t.replace(hour=hb[0], minute=0, second=0)
    return s if s <= t else s - datetime.timedelta(days=1)


# ---------------------------------------------------------------- fetching
def fetch_feed(url, src_state):
    """Conditional GET. Returns (status, bytes|None). 304 -> (304, None)."""
    if not w.allowed(url):
        raise PermissionError('robots.txt does not allow ' + url)
    h = {'User-Agent': w.UA, 'Accept': 'application/rss+xml, application/atom+xml, application/xml;q=0.9, */*;q=0.5'}
    c = (src_state.get('cache') or {}).get(url) or {}
    if c.get('etag'): h['If-None-Match'] = c['etag']
    if c.get('lastModified'): h['If-Modified-Since'] = c['lastModified']
    req = urllib.request.Request(url, headers=h)
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            data = r.read(4_000_000)
            src_state.setdefault('cache', {})[url] = {'etag': r.headers.get('ETag'), 'lastModified': r.headers.get('Last-Modified')}
            return r.status, data
    except urllib.error.HTTPError as e:
        if e.code == 304: return 304, None
        raise


def parse_listing(f, data):
    """The same feed types as tools/world_news.py fetch: rss / sitemap, a public page (links matching linkPattern,
    no dates: the article page gives the time) and an official Telegram channel preview."""
    if f['type'] == 'telegram':
        return w.parse_telegram(data.decode('utf-8', 'replace'), f.get('linkPattern'))
    if f['type'] == 'html':
        p = w.Meta(); p.feed(data.decode('utf-8', 'replace'))
        seen, got = set(), []
        for h in p.links:
            u = urllib.parse.urljoin(f['url'], h).split('#')[0]
            if u not in seen and re.match(f['linkPattern'], u): seen.add(u); got.append({'url': u})
        return got
    if not data.lstrip()[:300].lower().startswith((b'<?xml', b'<rss', b'<feed', b'<urlset')) and b'<rss' not in data[:500]:
        raise ValueError('not a feed (the address answers with a web page)')
    return w.parse_feed(data)


def item_key(g):
    return w.norm_url(g.get('url') or '')


def intake(published_at, seen_at, date_only=False, max_h=None):
    """(age_minutes, tier) for a never-seen item. tier: 'fresh' (age <= 5 min: priority 1), 'recent' (older, inside the
    2-hour fallback: priority 2), 'old' (rejected), 'unverified' (no trustworthy publisher time: never fresh, never breaking)."""
    p = parse(published_at)
    if not p or date_only: return None, 'unverified'
    age = (seen_at - p).total_seconds() / 60
    if age < -FUTURE_UNTRUSTED_MIN: return round(age, 1), 'unverified'
    age = max(0.0, age) if age >= -CLOCK_SKEW_MIN else age
    if age < 0: return round(age, 1), 'unverified'
    if age <= FRESH_INTAKE_MIN: return round(age, 1), 'fresh'
    if age <= NEW_MAX_AGE_H * 60: return round(age, 1), 'recent'
    # a Somali source's story found late (max_h = SO_KEEP_H): kept for the Somalia catch-up, never fresh or breaking
    if max_h and age <= max_h * 60: return round(age, 1), 'catchup'
    return round(age, 1), 'old'


def is_somali(s):
    return (s or {}).get('country') == 'so'


def so_sources():
    return {s['id'] for s in load(SOURCES, {'sources': []})['sources'] if s.get('country') == 'so'}


def date_only_time(s):
    """A publisher time of exactly midnight (UTC or Nairobi) is usually a date without a time: not trustworthy for age."""
    d = parse(s)
    if not d: return False
    return any(x.hour == 0 and x.minute == 0 and x.second == 0 for x in (d.astimezone(datetime.timezone.utc), d.astimezone(EAT)))


def check_source(s, st, t, log):
    """One check of one source. Mutates st (source state). Returns the list of NEW candidate items."""
    st['lastCheckAt'] = iso(t)
    c = st['lastRunCounts'] = {'at': iso(t), 'seen': 0, 'new': 0, 'fresh': 0, 'rejectedOld': 0, 'rejectedNoTimestamp': 0,
                               'excluded': 0, 'rejectedDuplicate': 0, 'ok': False}
    new, errors, listing, used = [], [], None, None
    t0 = time.time()
    for f in s.get('feeds') or []:
        try:
            code, data = fetch_feed(f['url'], st)
            if code == 304:
                listing, used = [], f['url']; st['lastNotModified'] = True; break
            got = parse_listing(f, data)
            if f.get('linkPattern') and f['type'] not in ('html', 'telegram'):
                got = [g for g in got if re.match(f['linkPattern'], g['url'])]
            if not got: raise ValueError('feed has no items')
            dated = [parse(g.get('publishedAt')) for g in got if g.get('publishedAt')]
            if f.get('maxAgeDays') and dated and max(dated) < t - datetime.timedelta(days=f['maxAgeDays']):
                raise ValueError(f'feed is stale (newest item {iso(max(dated))[:10]})')
            listing, used = got, f['url']; st['lastNotModified'] = False; st['feedType'] = f['type']; break
        except Exception as e:
            errors.append(f"{f['url']}: {type(e).__name__}: {e}"[:300])
    st['fetchSeconds'] = round(time.time() - t0, 1)
    if listing is None:
        st['consecutiveErrors'] = st.get('consecutiveErrors', 0) + 1
        st['lastError'] = '; '.join(errors)[:600]; st['lastErrorAt'] = iso(t)
        log.append(f"{s['id']}: FAILED {st['lastError'][:200]}")
        return []
    st['consecutiveErrors'] = 0; st['lastOkAt'] = iso(t); st['feedUrl'] = used; c['ok'] = True
    if errors: st['lastError'] = '; '.join(errors)[:600]; st['lastErrorAt'] = iso(t)
    if not listing:
        log.append(f"{s['id']}: not modified"); return []
    listing = [g for g in listing if not re.search(r'/(video|videos|gallery|live-news|live|live-updates)/', g.get('url') or '')]
    dated = [parse(g.get('publishedAt')) for g in listing if g.get('publishedAt')]
    if dated: st['latestPublishedAt'] = iso(max(dated))
    st['feedItems'] = len(listing); c['seen'] = len(listing)
    if s.get('monitorOnly'):
        # no permission yet: availability and recency only; nothing about the articles is kept
        st['baselineDone'] = True
        log.append(f"{s['id']}: reachable, {len(listing)} items, newest {st.get('latestPublishedAt')} (monitor only, not collected)")
        return []
    seen = st.setdefault('seen', {})
    # a Somali source's first check is not a silent baseline: its stories of the last 24 hours go to the Somalia catch-up
    # (the dedup step still drops everything the site already has). Other sources start with a baseline as before.
    first = not st.get('baselineDone') and not is_somali(s)
    cut = t - datetime.timedelta(hours=SO_KEEP_H if is_somali(s) else NEW_MAX_AGE_H)
    for g in listing:
        k = item_key(g)
        if not k or k in seen: continue
        pubd = parse(g.get('publishedAt'))
        if first:
            seen[k] = {'at': iso(t), 'kind': 'baseline', 'publishedAt': g.get('publishedAt')}; continue
        if pubd and pubd < cut:
            seen[k] = {'at': iso(t), 'kind': 'old', 'publishedAt': g.get('publishedAt')}
            st['oldIgnored'] = st.get('oldIgnored', 0) + 1; c['rejectedOld'] += 1; continue
        it = {'source': s['id'], 'sourceName': s['name'], 'section': s.get('section', 'world'), 'url': g['url'],
              'title': g.get('title'), 'description': g.get('description'), 'publishedAt': g.get('publishedAt'),
              'image': g.get('image'), 'timeVerified': bool(g.get('publishedAt')), 'discoveredAt': iso(t),
              'dateSource': 'publisher RSS feed' if g.get('publishedAt') else None, 'firstSeenBy': '5-minute monitor'}
        for kk in ('channelPost', 'postLabel'):
            if g.get(kk): it[kk] = g[kk]
        if g.get('dateSource'): it['dateSource'] = g['dateSource']
        if s.get('headlineOnly'):
            # publisher's terms (e.g. BBC Somali): only the feed's headline, link and time are used; the article page,
            # its text and its photos are never read or kept
            it['description'] = None; it['image'] = None; it['headlineOnly'] = True
        try:
            if s.get('headlineOnly'):
                raise PermissionError('article page not opened: headline and link only (publisher terms)')
            if st.get('feedType') == 'telegram':
                raise PermissionError('article page not opened: the publisher site refuses automated readers; text from its official channel post')
            a = w.article(g['url'])
            for kk in ('canonicalUrl', 'imageCaption', 'imageCredit', 'imageLicenseHint', 'author'):
                if a.get(kk): it[kk] = a[kk]
            if not it.get('title') and a.get('title'): it['title'] = a['title']
            if a.get('publishedAt') and not a.get('dateOnly'):
                it['pagePublishedAt'] = a['publishedAt']
                if not it.get('publishedAt'):
                    it['publishedAt'], it['timeVerified'], it['dateSource'] = a['publishedAt'], True, 'article page'
            if a.get('image'): it['image'] = a['image']
            paras = a.get('_paras') or []
            it['excerpt'] = ' '.join(paras)[:600] or None
        except Exception as e:
            it['articleError'] = f'{type(e).__name__}: {e}'[:200]
        if not it.get('publishedAt'):
            seen[k] = {'at': iso(t), 'kind': 'no-date'}; c['rejectedNoTimestamp'] += 1
            log.append(f"{s['id']}: no verifiable publication time, not passed on: {g['url']}"); continue
        # the article page's own published time wins when it is EARLIER than the feed time (a re-sent or edited story is
        # not new) or when the feed only gave an "updated" time
        pp, fp = parse(it.get('pagePublishedAt')), parse(it['publishedAt'])
        upd = str(it.get('dateSource') or '').startswith('feed updated')
        if pp and (upd or (fp and (fp - pp).total_seconds() > 600)):
            it['feedPublishedAt'] = it['publishedAt']; it['publishedAt'] = it['pagePublishedAt']; it['dateSource'] = 'article page (earlier than the feed time)'; upd = False
        # the age is measured against the moment this check first SAW the item (t), never against the import time
        age, tier = intake(it['publishedAt'], t, upd or (date_only_time(it['publishedAt']) and not it.get('pagePublishedAt')),
                           SO_KEEP_H if is_somali(s) else None)
        if tier == 'unverified':
            # timestamp_unverified: never fresh, never breaking, never a made-up time; not passed on automatically
            seen[k] = {'at': iso(t), 'kind': 'timestamp-unverified', 'publishedAt': it['publishedAt']}; c['rejectedNoTimestamp'] += 1
            log.append(f"{s['id']}: publication time not trustworthy ({it['publishedAt']}), timestamp_unverified, not passed on: {g['url']}"); continue
        if tier == 'old':
            seen[k] = {'at': iso(t), 'kind': 'old', 'publishedAt': it['publishedAt']}
            st['oldIgnored'] = st.get('oldIgnored', 0) + 1; c['rejectedOld'] += 1; continue
        ok, why = east_africa.gate(it, s)
        if not ok:
            seen[k] = {'at': iso(t), 'kind': 'excluded', 'why': why}; c['excluded'] += 1; continue
        it['sourceAgeMin'] = age; it['intake'] = tier; it['priority'] = 1 if tier == 'fresh' else 2
        it['freshAtDiscovery'] = tier == 'fresh'
        c['fresh'] += tier == 'fresh'
        seen[k] = {'at': iso(t), 'kind': 'new', 'publishedAt': it['publishedAt'], 'ageMin': age, 'intake': tier}
        new.append({k2: v for k2, v in it.items() if v not in (None, '')}); c['new'] += 1
        time.sleep(0.3)
    if first:
        st['baselineDone'] = True; st['baselineAt'] = iso(t)
        log.append(f"{s['id']}: first check, {len(listing)} existing items recorded as baseline (not new)")
    else:
        log.append(f"{s['id']}: {len(listing)} items, {len(new)} new ({c['fresh']} within {FRESH_INTAKE_MIN} min of the source time)")
    st['newTotal'] = st.get('newTotal', 0) + len(new)
    return new


# ---------------------------------------------------------------- pipeline tracking
def site_articles():
    """data/news/*.json on main: normalised sourceUrl -> (id, published, imagePending, committedAt)."""
    out = {}
    for f in glob.glob(os.path.join(root, 'data', 'news', '*.json')):
        n = load(f, None)
        if not isinstance(n, dict) or not n.get('sourceUrl'): continue
        out[w.norm_url(n['sourceUrl'])] = {'id': os.path.basename(f)[:-5], 'published': n.get('published', True) is not False,
                                           'held': bool(n.get('imagePending')) or n.get('published') is False, 'path': f,
                                           'verifiedAt': n.get('verifiedAt')}
    return out


def committed_at(path):
    r = subprocess.run(['git', '-C', root, 'log', '--diff-filter=A', '--format=%cI', '-1', '--', os.path.relpath(path, root)],
                       capture_output=True, text=True)
    d = parse(r.stdout.strip())
    return iso(d) if d else None


LIVE = {}


def live_ids():
    """Article ids that are really on the live website (data/news.json as GitHub Pages serves it), read once per check.
    Also keeps what the live file says about the last publication and the build that is live (LIVE['meta'])."""
    if 'ids' in LIVE: return LIVE['ids']
    try:
        req = urllib.request.Request(SITE_NEWS + '?ts=' + str(int(time.time())), headers={'User-Agent': w.UA, 'Cache-Control': 'no-cache'})
        with urllib.request.urlopen(req, timeout=20) as r:
            d = json.loads(r.read())
        news = [n for n in d.get('news', []) if n.get('id')]
        LIVE['ids'] = {n['id'] for n in news}
        newest = max(news, key=lambda n: parse(n.get('createdAt') or n.get('verifiedAt') or n.get('publishedAt')) or datetime.datetime.min.replace(tzinfo=EAT), default={})
        LIVE['meta'] = {'deployedAt': d.get('updatedAt'), 'lastPublishRunAt': d.get('lastSuccessAt'), 'newestLiveArticle': newest.get('id')}
    except Exception as e:
        print('live site not readable:', e)
        LIVE['ids'] = None
    return LIVE['ids']


def minutes(a, b):
    a, b = parse(a), parse(b)
    return round((b - a).total_seconds() / 60, 1) if a and b else None


def track(tracked, t):
    """Follow every discovered story: on main (published / held) and really live. Returns the stories that became
    live or were held (no licensed photo / not published) in this check."""
    arts = site_articles()
    live = None
    became = {'live': [], 'held': []}
    for x in tracked.values():
        if x.get('liveAt') or x.get('state') == 'expired': continue
        keys = {x['key'], w.norm_url(x.get('canonicalUrl') or '')} - {''}
        a = next((arts[k] for k in keys if k in arts), None)
        if a:
            x['articleId'] = a['id']
            if a['held'] and x.get('state') != 'held': became['held'].append(x)
            x['state'] = 'held' if a['held'] else 'committed'
            x.setdefault('committedAt', committed_at(a['path']) or iso(t))
            if a.get('verifiedAt'): x['verifiedAt'] = a['verifiedAt']
            if not a['held']:
                if live is None: live = live_ids() or set()
                if a['id'] in live:
                    x['liveAt'] = iso(t); x['state'] = 'live'; became['live'].append(x)
        elif parse(x['discoveredAt']) < t - datetime.timedelta(hours=24):
            x['state'] = 'expired'   # the news task did not choose it (duplicate, not important, not verified)
        for k, a_, b_ in (('discoveryDelayMin', 'publishedAt', 'discoveredAt'), ('commitDelayMin', 'publishedAt', 'committedAt'),
                          ('liveDelayMin', 'publishedAt', 'liveAt'), ('pipelineMin', 'discoveredAt', 'liveAt')):
            if x.get(a_) and x.get(b_): x[k] = minutes(x[a_], x[b_])
    return became


def duplicates(items, log):
    """{normalised url: reason} for the items that are duplicates (tools/world_news.py dedup: same URL / canonical URL as
    anything the site ever had or as another item, same event as a story on the site, or the weaker report of an event
    two sources carry). On any error nothing is removed (the news task runs the same check again before writing)."""
    if not items: return {}
    import tempfile, contextlib, io
    try:
        with tempfile.TemporaryDirectory() as d:
            ci, po = os.path.join(d, 'c.json'), os.path.join(d, 'p.json')
            w.save(ci, {'fetchedAt': iso(now()), 'sources': [], 'items': items})
            with contextlib.redirect_stdout(io.StringIO()):
                w.dedup([ci, '--out', po, '--max-age-hours', str(NEW_MAX_AGE_H)])
            plan = load(po, {})
    except Exception as e:
        log.append(f'duplicate check not available this time ({type(e).__name__}: {e}); the news task checks again')
        return {}
    out = {}
    kept = {w.norm_url(e.get('url')) for e in plan.get('stories', [])}
    for r in plan.get('rejected', []):
        if r.get('why') in ('known', 'duplicate', 'on-site') and w.norm_url(r['url']) not in kept:
            out[w.norm_url(r['url'])] = {'known': 'same URL already on the site', 'on-site': f"same event as {r.get('of')} on the site",
                                         'duplicate': f"same event as {r.get('of')}"}[r['why']]
    return out


def med(v):
    v = [x for x in v if x is not None]
    return round(statistics.median(v), 1) if v else None


# ---------------------------------------------------------------- run
def run(args):
    sdir = w.opt(args, '--state')
    force = '--force' in args
    os.makedirs(sdir, exist_ok=True)
    t = now()
    sched = load(SCHEDULE, {})
    cfg = load(SOURCES, {'sources': []})
    fast = [s for s in cfg['sources'] if s.get('fastPoll')]
    state = load(os.path.join(sdir, 'state.json'), {}) or {}
    state.setdefault('sources', {}); state.setdefault('tracked', {}); state.setdefault('runs', [])
    open_now = is_open(t, sched)
    log = []
    if not open_now and not force:
        print(f'{iso(t)}: outside operating hours ({sched.get("hours")}, Africa/Nairobi): no source is checked')
        state['lastSkippedAt'] = iso(t)
        save_all(sdir, state, cfg, fast, t, sched, [], log, skipped=True)
        return
    started = time.time()
    ws = window_start(t, sched)
    first_of_day = bool(ws) and (not state.get('lastRunAt') or parse(state['lastRunAt']) < ws)
    new_items = []
    for s in fast:
        st = state['sources'].setdefault(s['id'], {})
        if east_africa.excluded_source(s):
            st['lastError'] = 'excluded: ' + east_africa.excluded_source(s); continue
        if not s.get('enabled', True) and not s.get('monitorOnly'):
            st['disabled'] = True; continue
        st.pop('disabled', None)
        got = check_source(s, st, t, log)
        new_items += got
    # duplicate check of this run's new items (same URL / canonical URL as anything the site ever had, the same event as a
    # story already on the site, or two sources with the same event): tools/world_news.py dedup, the news task's own rules
    dups = duplicates(new_items, log)
    have = set()
    for it in list(new_items):
        k = w.norm_url(it['url'])
        if k in have: dups[k] = 'same URL from two sources in this check'
        have.add(k)
        if k in dups:
            new_items.remove(it)
            cs = state['sources'].get(it['source'], {}).get('lastRunCounts')
            if cs: cs['rejectedDuplicate'] += 1; cs['new'] -= 1; cs['fresh'] -= bool(it.get('freshAtDiscovery'))
            sk = state['sources'].get(it['source'], {}).get('seen', {}).get(item_key(it))
            if sk: sk['kind'] = 'duplicate'; sk['of'] = dups[k]
            log.append(f"{it['source']}: duplicate skipped ({dups[k]}): {it['url']}")
    for it in new_items:
        if first_of_day and ws and parse(it['publishedAt']) < ws:
            it['overnight'] = True   # published while monitoring was paused: labelled with its real time
        state['tracked'][it.get('canonicalUrl') and w.norm_url(it['canonicalUrl']) or item_key(it)] = {
            'key': item_key(it), 'source': it['source'], 'url': it['url'], 'canonicalUrl': it.get('canonicalUrl'),
            'title': it.get('title'), 'publishedAt': it['publishedAt'], 'discoveredAt': it['discoveredAt'],
            'overnight': it.get('overnight', False), 'state': 'discovered',
            'sourceAgeMin': it.get('sourceAgeMin'), 'intake': it.get('intake')}
    # forget old ids and old tracked stories
    cut = t - datetime.timedelta(days=KEEP_DAYS)
    for st in state['sources'].values():
        st['seen'] = {k: v for k, v in (st.get('seen') or {}).items() if (parse(v.get('at')) or t) >= cut}
    state['tracked'] = {k: v for k, v in state['tracked'].items() if (parse(v.get('discoveredAt')) or t) >= cut}
    became = track(state['tracked'], t)
    live_ids()
    # four separate records (owner's request, 8 Nov 2026): a real source check, a new article found, an article published,
    # the website build that is live. None of them is a browser timer.
    rec = state.setdefault('records', {})
    rec['lastSuccessfulSourceCheckAt'] = iso(t) if any(state['sources'].get(s['id'], {}).get('lastOkAt') == iso(t) for s in fast) else rec.get('lastSuccessfulSourceCheckAt')
    if new_items: rec['lastNewArticleDiscoveredAt'] = iso(t); rec['lastNewArticle'] = {k: new_items[0].get(k) for k in ('source', 'title', 'url', 'publishedAt')}
    if became['live']: rec['lastArticleLiveAt'] = iso(t); rec['lastArticleLive'] = became['live'][-1].get('articleId')
    m = LIVE.get('meta') or {}
    if m.get('lastPublishRunAt'): rec['lastArticlePublicationAt'] = m['lastPublishRunAt']
    if m.get('deployedAt'): rec['lastWebsiteDeploymentAt'] = m['deployedAt']; rec['websiteCheckedAt'] = iso(t)
    if m.get('newestLiveArticle'): rec['newestLiveArticle'] = m['newestLiveArticle']
    state['lastRunAt'] = iso(t)
    fin = now()
    per = []
    for s in fast:
        c = state['sources'].get(s['id'], {}).get('lastRunCounts')
        if not c or c.get('at') != iso(t): continue
        c['published'] = sum(1 for x in became['live'] if x['source'] == s['id'])
        c['heldNoImage'] = sum(1 for x in became['held'] if x['source'] == s['id'])
        per.append({'source': s['id'], **{k: v for k, v in c.items() if k != 'at'}})
    tot = lambda k: sum(x.get(k, 0) for x in per)
    entry = {'at': iso(t), 'check_started_at': iso(t), 'check_finished_at': iso(fin), 'seconds': round(time.time() - started, 1),
             'sources_checked': len(per), 'sources_failed': sum(1 for x in per if not x['ok']),
             'stories_seen': tot('seen'), 'stories_new': len(new_items), 'stories_fresh_5min': sum(1 for x in new_items if x.get('freshAtDiscovery')),
             'stories_rejected_old': tot('rejectedOld'), 'stories_rejected_duplicate': tot('rejectedDuplicate'),
             'stories_rejected_no_timestamp': tot('rejectedNoTimestamp'), 'stories_excluded': tot('excluded'),
             'stories_rejected_no_image': len(became['held']), 'stories_published': len(became['live']),
             'new': len(new_items),
             'failed': [x['source'] for x in per if not x['ok']]}
    state['runs'] = ([entry] + state['runs'])[:400]
    state['lastRunSources'] = per
    save_all(sdir, state, cfg, fast, t, sched, new_items, log)
    print('\n'.join(log))
    print(f'{len(new_items)} new article(s) discovered')


def alerts_of(state, fast, t, sched):
    out = []
    for s in fast:
        st = state['sources'].get(s['id'], {})
        if st.get('disabled'): continue
        if st.get('consecutiveErrors', 0) >= ERRORS_FOR_ALERT and st.get('lastOkAt'):
            out.append(f"{s['name']}: unavailable since {st.get('lastOkAt') or 'the first check'} (feed {st.get('feedUrl') or (s.get('feeds') or [{}])[0].get('url')} does not answer)")
            continue
        gap = None if s.get('monitorOnly') else s.get('expectedMaxGapHours')   # a source we do not collect: availability only
        lp = parse(st.get('latestPublishedAt'))
        if gap and lp and is_open(t, sched) and t - lp > datetime.timedelta(hours=gap) and (window_start(t, sched) is None or t - window_start(t, sched) > datetime.timedelta(hours=gap)):
            out.append(f"{s['name']}: delayed, no new article in its feed since {iso(lp)} (usual maximum gap {gap} h)")
    for x in state['tracked'].values():
        if x.get('state') == 'committed' and x.get('committedAt') and parse(x['committedAt']) < t - datetime.timedelta(minutes=40):
            out.append(f"{x.get('articleId')}: saved on main at {x['committedAt']} but not live on the website after 40 minutes (GitHub Pages)")
    return out


def save_all(sdir, state, cfg, fast, t, sched, new_items, log, skipped=False):
    # candidates for the hourly news task: discovered, not yet on the site, still fresh
    old = load(os.path.join(sdir, 'candidates.json'), {}) or {}
    sos = so_sources()
    keep = {w.norm_url(x['url']): x for x in old.get('items', []) if parse(x.get('discoveredAt'))
            and parse(x['discoveredAt']) >= t - datetime.timedelta(hours=SO_KEEP_H if x.get('source') in sos or x.get('country') == 'so' else KEEP_CANDIDATE_H)
            # a Somalia story is kept 24 h after its PUBLISHER's time at most (never longer than the catch-up)
            and not ((x.get('source') in sos or x.get('country') == 'so') and (parse(x.get('publishedAt')) or t) < t - datetime.timedelta(hours=SO_KEEP_H))}
    for x in new_items: keep[w.norm_url(x['url'])] = x
    for k, x in list(keep.items()):
        tr = state['tracked'].get(w.norm_url(x.get('canonicalUrl') or '')) or state['tracked'].get(k) or {}
        if tr.get('articleId'): keep.pop(k)
    srcrep = []
    for s in fast:
        st = state['sources'].get(s['id'], {})
        srcrep.append({'id': s['id'], 'name': s['name'], 'section': s.get('section', 'world'), 'enabled': s.get('enabled', True),
                       'method': ('rss ' + st['feedUrl']) if st.get('feedUrl') and not s.get('monitorOnly') and not st.get('consecutiveErrors') else None,
                       'collected': sum(1 for x in keep.values() if x['source'] == s['id']), 'found': st.get('feedItems', 0),
                       'errors': [st['lastError']] if st.get('lastError') and st.get('consecutiveErrors') else
                                 (['monitor only: no permission to collect'] if s.get('monitorOnly') else [])})
    cand = {'fetchedAt': state.get('lastRunAt') or iso(t), 'since': None, 'by': '5-minute monitor (fast-sources.yml)',
            'sources': srcrep,
            # priority 1 (source age <= 5 min when first seen) first, then newest first by the PUBLISHER's time
            'items': sorted(sorted(keep.values(), key=lambda x: parse(x.get('publishedAt')) or t, reverse=True), key=lambda x: x.get('priority', 2))}
    w.save(os.path.join(sdir, 'candidates.json'), cand)
    alerts = alerts_of(state, fast, t, sched)
    state['alerts'] = alerts
    w.save(os.path.join(sdir, 'state.json'), state)
    status = diagnostics(state, cfg, fast, t, sched, skipped)
    w.save(os.path.join(sdir, 'fast-status.json'), status)
    open(os.path.join(sdir, 'alerts.txt'), 'w').write('\n'.join(alerts) + ('\n' if alerts else ''))
    open(os.path.join(sdir, 'README.txt'), 'w').write(report_text(status, log))


def diagnostics(state, cfg, fast, t, sched, skipped):
    tr = list(state['tracked'].values())
    out_src = []
    day = t - datetime.timedelta(hours=24)
    for s in fast:
        st = state['sources'].get(s['id'], {})
        mine = [x for x in tr if x['source'] == s['id']]
        last24 = [x for x in mine if parse(x['discoveredAt']) >= day]
        lastx = max(mine, key=lambda x: x['discoveredAt'], default={})
        lastlive = max([x for x in mine if x.get('liveAt')], key=lambda x: x['liveAt'], default={})
        perm = s.get('permission') or {}
        out_src.append({
            'id': s['id'], 'name': s['name'], 'homepage': s.get('homepage'), 'section': s.get('section', 'world'),
            'state': 'disabled' if st.get('disabled') else 'monitor-only' if s.get('monitorOnly') else
                     'unavailable' if st.get('consecutiveErrors', 0) >= ERRORS_FOR_ALERT else
                     'error' if st.get('consecutiveErrors') else 'working' if st.get('lastOkAt') else 'not checked yet',
            'permission': perm.get('status', 'as before (own rewrite + link)'), 'permissionNote': perm.get('summary', ''),
            'pollMinutes': 5, 'feedUrl': st.get('feedUrl') or ((s.get('feeds') or [{}])[0].get('url')),
            'lastCheckAt': st.get('lastCheckAt'), 'lastSuccessAt': st.get('lastOkAt'),
            'latestOriginalPublishedAt': st.get('latestPublishedAt'),
            'lastDiscoveredAt': lastx.get('discoveredAt'), 'lastDiscoveredPublishedAt': lastx.get('publishedAt'),
            'lastSitePublishedAt': lastlive.get('liveAt'),
            'newTotal': st.get('newTotal', 0), 'new24h': len(last24),
            'published24h': sum(1 for x in last24 if x.get('liveAt')), 'held24h': sum(1 for x in last24 if x.get('state') == 'held'),
            'notChosen24h': sum(1 for x in last24 if x.get('state') == 'expired'),
            'oldIgnored': st.get('oldIgnored', 0),
            'medianDiscoveryDelayMin': med([x.get('discoveryDelayMin') for x in last24]),
            'medianLiveDelayMin': med([x.get('liveDelayMin') for x in mine]),
            'consecutiveErrors': st.get('consecutiveErrors', 0), 'lastError': st.get('lastError') or '', 'lastErrorAt': st.get('lastErrorAt'),
            'fetchSeconds': st.get('fetchSeconds')})
    runs = state.get('runs') or []
    gaps = []
    for a, b in zip(runs, runs[1:]):
        m = minutes(b['at'], a['at'])
        if m is not None and m < 120: gaps.append(m)
    recent = sorted([x for x in tr if x.get('liveAt')], key=lambda x: x['liveAt'], reverse=True)[:30]
    last = parse(state.get('lastRunAt'))
    health = ('stopped' if not last or t - last > datetime.timedelta(minutes=HEALTH_STALE_MIN) else
              'failing' if runs and runs[0].get('sources_checked') and runs[0].get('sources_failed') == runs[0]['sources_checked'] else 'healthy')
    r24 = [r for r in runs if (parse(r.get('at')) or t) >= day]
    sm = lambda k: sum(r.get(k) or 0 for r in r24)
    summary = {
        'health': health,
        'healthRule': f'healthy = a completed check in the last {HEALTH_STALE_MIN} min; 0 new stories is healthy; '
                      'stopped = no check for that long; failing = every source failed in the last check',
        'lastSourceCheckAt': state.get('lastRunAt'),
        'nextExpectedCheckAt': iso(last + datetime.timedelta(minutes=5)) if last else None,
        'checks24h': len(r24),
        'freshRule': f'source age <= {FRESH_INTAKE_MIN} min when first seen = priority 1 (fresh); up to {NEW_MAX_AGE_H} h = priority 2 '
                     '(fallback, never breaking); older = rejected; no trustworthy publisher time = timestamp_unverified, not passed on',
        'newFound24h': sm('stories_new'), 'fresh5min24h': sm('stories_fresh_5min'), 'published24h': sm('stories_published'),
        'duplicatesSkipped24h': sm('stories_rejected_duplicate'), 'oldSkipped24h': sm('stories_rejected_old'),
        'missingTimestampSkipped24h': sm('stories_rejected_no_timestamp'), 'missingImageHeld24h': sm('stories_rejected_no_image'),
        'records': state.get('records') or {},
        'activeCollectors': sum(1 for s in fast if s.get('enabled', True) and not s.get('monitorOnly') and not east_africa.excluded_source(s)),
    }
    if skipped: summary['health'] = 'paused (outside operating hours)'
    return {
        'status': summary,
        'runLog': [{k: v for k, v in r.items() if k not in ('at', 'new')} for r in runs[:36]],
        'lastRunSources': state.get('lastRunSources') or [],
        'updatedAt': iso(t), 'lastCheckAt': state.get('lastRunAt'), 'skippedOutsideHours': skipped,
        'operatingHours': sched.get('hours') or '24/7', 'timezone': 'Africa/Nairobi', 'open': is_open(t, sched),
        'pollMinutes': 5,
        'measuredIntervalMin': {'median': med(gaps), 'max': max(gaps) if gaps else None, 'runs': len(runs)},
        'delays24h': {'medianDiscoveryMin': med([x.get('discoveryDelayMin') for x in tr if parse(x['discoveredAt']) >= day]),
                      'medianLiveMin': med([x.get('liveDelayMin') for x in tr if x.get('liveAt') and parse(x['liveAt']) >= day]),
                      'medianDiscoveryToLiveMin': med([x.get('pipelineMin') for x in tr if x.get('liveAt') and parse(x['liveAt']) >= day])},
        'alerts': state.get('alerts') or [],
        'sources': out_src,
        'recentPublished': [{k: x.get(k) for k in ('articleId', 'source', 'title', 'url', 'publishedAt', 'discoveredAt', 'verifiedAt', 'committedAt', 'liveAt',
                                                   'discoveryDelayMin', 'liveDelayMin', 'overnight')} for x in recent],
        'recentDiscovered': [{k: x.get(k) for k in ('source', 'title', 'url', 'publishedAt', 'discoveredAt', 'discoveryDelayMin', 'sourceAgeMin', 'intake', 'state', 'articleId', 'overnight')}
                             for x in sorted(tr, key=lambda x: x['discoveredAt'], reverse=True)[:40]],
    }


def report_text(st, log):
    S = st['status']
    L = [f"5-minute source monitor, {st['updatedAt']} (operating hours {st['operatingHours']} Africa/Nairobi; {'open' if st['open'] else 'closed'})",
         f"health {S['health']} | last check {S['lastSourceCheckAt']} | next expected {S['nextExpectedCheckAt']} | {S['activeCollectors']} active collectors",
         'records: ' + ' | '.join(f'{k} {v}' for k, v in S['records'].items() if k.endswith('At')),
         f"last 24 h: {S['checks24h']} checks, {S['newFound24h']} new ({S['fresh5min24h']} within 5 min of the source time), {S['published24h']} published, "
         f"{S['duplicatesSkipped24h']} duplicates, {S['oldSkipped24h']} old, {S['missingTimestampSkipped24h']} no trustworthy time, {S['missingImageHeld24h']} held for a photo",
         f"measured interval between checks: median {st['measuredIntervalMin']['median']} min, max {st['measuredIntervalMin']['max']} min",
         f"last 24 h: median source->discovery {st['delays24h']['medianDiscoveryMin']} min, source->live {st['delays24h']['medianLiveMin']} min", '']
    for s in st['sources']:
        L.append(f"{s['name']:<20} {s['state']:<13} perm={s['permission']:<20} last ok {s['lastSuccessAt']} | newest original {s['latestOriginalPublishedAt']} "
                 f"| new 24h {s['new24h']} live {s['published24h']} held {s['held24h']} | median discovery {s['medianDiscoveryDelayMin']} min"
                 + (f" | ERROR {s['lastError'][:160]}" if s['consecutiveErrors'] else ''))
    if st['alerts']: L += ['', 'ALERTS:'] + ['  ' + a for a in st['alerts']]
    if log: L += ['', 'this run:'] + ['  ' + x for x in log]
    return '\n'.join(L) + '\n'


# ---------------------------------------------------------------- self-test (no network)
def test(_args):
    bad = []
    def ok(c, m):
        if not c: bad.append(m)
    T = lambda h, m=0: datetime.datetime(2026, 11, 8, h, m, tzinfo=EAT)
    ok(is_open(T(3), {'hours': '24/7'}), '24/7 open at night')
    ok(is_open(T(7), {'hours': '07:00-23:00'}) and is_open(T(22, 55), {'hours': '07:00-23:00'}), 'open 07:00 and 22:55')
    ok(not is_open(T(23, 0), {'hours': '07:00-23:00'}) and not is_open(T(6, 59), {'hours': '07:00-23:00'}), 'closed 23:00 and 06:59')
    ok(window_start(T(7, 5), {'hours': '07:00-23:00'}) == T(7), 'window start')
    ok(hours_of({}) is None and hours_of({'hours': '0-24'}) is None, 'default 24/7')
    # first check = baseline, later only genuinely new and recent items
    rss = lambda items: ('<?xml version="1.0"?><rss><channel>' + ''.join(
        f'<item><title>{a}</title><link>https://ex.test/{a}</link><pubDate>{email.utils.format_datetime(d)}</pubDate></item>' for a, d in items)
        + '</channel></rss>').encode()
    feeds = {}
    global fetch_feed
    real_fetch, real_article = fetch_feed, w.article
    fetch_feed = lambda url, st: (200, feeds[url])
    w.article = lambda url: {}
    try:
        s = {'id': 'x', 'name': 'X', 'section': 'world', 'feeds': [{'type': 'rss', 'url': 'u'}]}
        st, log = {}, []
        now_ = now()
        feeds['u'] = rss([('a', now_ - datetime.timedelta(hours=1)), ('b', now_ - datetime.timedelta(days=3))])
        ok(check_source(s, st, now_, log) == [] and st['baselineDone'], 'baseline: nothing new on the first check')
        feeds['u'] = rss([('c', now_ - datetime.timedelta(minutes=3)), ('old', now_ - datetime.timedelta(days=4)),
                          ('a', now_ - datetime.timedelta(hours=1))])
        got = check_source(s, st, now_, log)
        ok([g['title'] for g in got] == ['c'], f'only the recent unseen item is new: {[g["title"] for g in got]}')
        ok(got and got[0]['publishedAt'] and got[0]['discoveredAt'] and got[0]['timeVerified'], 'original time and discovery time kept')
        ok(got and got[0]['intake'] == 'fresh' and got[0]['priority'] == 1 and got[0]['sourceAgeMin'] == 3.0, 'age measured from the source time')
        ok(st['lastRunCounts']['seen'] == 3 and st['lastRunCounts']['rejectedOld'] == 1 and st['lastRunCounts']['new'] == 1, f"per-check counts: {st['lastRunCounts']}")
        feeds['u'] = rss([('d', now_ - datetime.timedelta(minutes=40))])
        g2 = check_source(s, st, now_, log)
        ok(g2 and g2[0]['intake'] == 'recent' and g2[0]['priority'] == 2 and not g2[0]['freshAtDiscovery'], '40 min old -> priority 2, not fresh')
        # the article page says the story is older than the feed claims: the page's (earlier) time wins
        w.article = lambda url: {'publishedAt': iso(now_ - datetime.timedelta(hours=5))}
        feeds['u'] = rss([('e', now_ - datetime.timedelta(minutes=1))])
        ok(check_source(s, st, now_, log) == [] and st['lastRunCounts']['rejectedOld'] == 1, 'a re-sent old story is not new (page time wins)')
        w.article = lambda url: {}
        ok(st.get('oldIgnored') == 2, 'old never-seen items (the 4-day-old one and the re-sent one) are ignored, not new')
        ok(check_source(s, st, now_, log) == [], 'same item is never new twice')
        # a Somali source: a story found 6 hours after its publisher's time is still passed on for the Somalia catch-up
        # (owner's request, 10 Nov 2026); a 30-hour-old one is not; a world source's 6-hour-old story is still "old"
        so = {'id': 'hiiraan', 'name': 'Hiiraan Online', 'section': 'somalia', 'country': 'so', 'feeds': [{'type': 'rss', 'url': 'so'}]}
        sst = {}
        feeds['so'] = rss([('soomaaliya-base', now_ - datetime.timedelta(hours=1)), ('soomaaliya-old', now_ - datetime.timedelta(hours=40))])
        g0 = check_source(so, sst, now_, log)
        ok([g['title'] for g in g0] == ['soomaaliya-base'], f'Somali source, first check: its last-24 h stories go to the catch-up (no silent baseline): {[g["title"] for g in g0]}')
        feeds['so'] = rss([('soomaaliya-shir-6h', now_ - datetime.timedelta(hours=6)), ('soomaaliya-shir-30h', now_ - datetime.timedelta(hours=30))])
        g3 = check_source(so, sst, now_, log)
        ok([g['title'] for g in g3] == ['soomaaliya-shir-6h'] and g3[0]['intake'] == 'catchup' and g3[0]['priority'] == 2 and not g3[0]['freshAtDiscovery'],
           f'Somali source: 6 h old story kept for the 24 h catch-up (never fresh), 30 h old one dropped: {[(g["title"], g.get("intake")) for g in g3]}')
        feeds['u'] = rss([('world-6h', now_ - datetime.timedelta(hours=6))])
        ok(check_source(s, st, now_, log) == [], 'world source: a 6 h old never-seen story is still old')
        ok(intake(iso(now_ - datetime.timedelta(hours=6)), now_)[1] == 'old' and intake(iso(now_ - datetime.timedelta(hours=6)), now_, max_h=SO_KEEP_H)[1] == 'catchup',
           'intake: catch-up tier only with the Somalia limit')
        nodate = b'<?xml version="1.0"?><rss><channel><item><title>n</title><link>https://ex.test/n</link></item></channel></rss>'
        feeds['u'] = nodate
        ok(check_source(s, st, now_, log) == [], 'item without a publication time is never passed on')
        mo = {'id': 'm', 'name': 'M', 'monitorOnly': True, 'feeds': [{'type': 'rss', 'url': 'u'}]}
        feeds['u'] = rss([('z', now_)]); st2 = {}
        check_source(mo, st2, now_, log); feeds['u'] = rss([('z2', now_)])
        ok(check_source(mo, st2, now_, log) == [] and 'seen' not in st2, 'monitor-only source stores and passes on nothing')
        def boom(url, st): raise OSError('down')
        fetch_feed = boom
        for _ in range(3): check_source(s, st, now_, log)
        ok(st['consecutiveErrors'] == 3, 'errors counted')
        a = alerts_of({'sources': {'x': st}, 'tracked': {}}, [s], now_, {'hours': '24/7'})
        ok(a and 'unavailable' in a[0], 'alert when unavailable')
        # TEST 9 / 13: a check at night with 0 new stories is healthy; no check for 20+ min = stopped
        night = T(3, 10)
        hs = {'sources': {}, 'tracked': {}, 'lastRunAt': iso(night), 'runs': [{'at': iso(night), 'sources_checked': 30, 'sources_failed': 0, 'stories_new': 0}]}
        ok(diagnostics(hs, {}, [], night, {'hours': '24/7'}, False)['status']['health'] == 'healthy', 'TEST 9: 0 new stories at night is healthy')
        ok(diagnostics(hs, {}, [], night + datetime.timedelta(minutes=25), {'hours': '24/7'}, False)['status']['health'] == 'stopped', 'no check for 25 min -> stopped')
    finally:
        fetch_feed, w.article = real_fetch, real_article
    ok(minutes('2026-11-08T10:00:00+03:00', '2026-11-08T10:07:30+03:00') == 7.5, 'delay minutes')
    # owner's tests (8 Nov 2026): SOURCE STORY AGE <= 5 MINUTES, measured from the publisher's own time
    seen_at = T(14, 0)
    ok(intake(iso(seen_at - datetime.timedelta(minutes=2)), seen_at) == (2.0, 'fresh'), 'TEST 1: 2 min old -> accepted as fresh')
    ok(intake(iso(seen_at - datetime.timedelta(minutes=5)), seen_at) == (5.0, 'fresh'), 'TEST 2: 5 min old -> accepted as fresh')
    ok(intake(iso(seen_at - datetime.timedelta(minutes=5, seconds=30)), seen_at)[1] == 'recent', '5.5 min old -> not fresh')
    ok(intake(iso(seen_at - datetime.timedelta(minutes=30)), seen_at) == (30.0, 'recent'), 'TEST 3: 30 min old -> not fresh (priority 2 only)')
    ok(intake(iso(seen_at - datetime.timedelta(hours=4)), seen_at)[1] == 'old', 'TEST 4: 4 h old found now -> rejected, never "just now"')
    ok(intake(iso(seen_at + datetime.timedelta(minutes=1)), seen_at) == (0.0, 'fresh'), 'publisher clock 1 min ahead -> age 0')
    ok(intake(iso(seen_at + datetime.timedelta(minutes=30)), seen_at)[1] == 'unverified', 'time 30 min in the future -> timestamp_unverified')
    ok(intake(None, seen_at) == (None, 'unverified'), 'TEST 7: no time -> timestamp_unverified, no fake freshness')
    ok(date_only_time('2026-11-08T03:00:00+03:00') and date_only_time('2026-11-08T00:00:00+03:00') and not date_only_time('2026-11-08T14:02:11+03:00'),
       'a midnight time is treated as a date without a time')
    # TEST 5 / 6: the same URL, and the same event under a slightly different headline, are duplicates; the first is kept
    tq = iso(now())
    da = {'source': 'bbc-world', 'sourceName': 'BBC', 'section': 'world', 'url': 'https://ex.test/quake', 'publishedAt': tq, 'timeVerified': True,
          'title': 'Earthquake of magnitude 6.1 strikes eastern Turkey, killing 12 people',
          'description': 'A strong earthquake hit Malatya province in eastern Turkey on Sunday, officials said.'}
    db = dict(da, source='aljazeera', sourceName='AJ', url='https://ex.test/quake-2', title='Magnitude 6.1 earthquake strikes eastern Turkey, 12 people killed',
              description='A strong earthquake struck Malatya province in eastern Turkey on Sunday, officials say.')
    dc = dict(da, source='cnn', url='https://ex.test/quake?utm_source=rss')
    import contextlib, io
    with contextlib.redirect_stderr(io.StringIO()):
        dd = duplicates([da, db, dc], [])
    ok('ex.test/quake-2' in dd and 'ex.test/quake' not in dd, f'TEST 6: similar headline of the same event is a duplicate, the first report is kept: {dd}')
    import tempfile
    with tempfile.TemporaryDirectory() as d:
        fa, wa = os.path.join(d, 'f.json'), os.path.join(d, 'w.json')
        w.save(fa, {'fetchedAt': 'x', 'sources': [{'id': 'abcnews'}], 'items': [
            {'url': 'https://a.test/1', 'discoveredAt': 'T1', 'firstSeenBy': '5-minute monitor', 'source': 'abcnews'},
            {'url': 'https://a.test/2', 'discoveredAt': 'T2', 'firstSeenBy': '5-minute monitor', 'source': 'abcnews'}]})
        w.save(wa, {'fetchedAt': '2026-11-07T21:55:31+03:00', 'sources': [{'id': 'bbc-world'}], 'items': [
            {'url': 'https://a.test/2?x=1', 'source': 'abcnews', 'title': 'kept', 'publishedAt': iso(now())},
            {'url': 'https://a.test/old', 'source': 'bbc-world', 'title': 'old', 'publishedAt': '2026-11-07T10:00:00+03:00'},
            {'url': 'https://so.test/10h', 'source': 'hiiraan', 'title': 'somalia 10h', 'publishedAt': iso(now() - datetime.timedelta(hours=10))},
            {'url': 'https://so.test/30h', 'source': 'hiiraan', 'title': 'somalia 30h', 'publishedAt': iso(now() - datetime.timedelta(hours=30))}]})
        import contextlib, io
        with contextlib.redirect_stdout(io.StringIO()):
            handoff(['--fast', fa, '--world', wa]); handoff(['--fast', fa, '--world', wa])
        r = load(wa, {})
        ok(len(r['items']) == 3 and r['items'][0].get('discoveredAt') == 'T2' and r['items'][0]['title'] == 'kept'
           and 'somalia 10h' in [x.get('title') for x in r['items']] and 'somalia 30h' not in [x.get('title') for x in r['items']], f'hand-off adds once, keeps fresh items and 24h Somalia items, drops old ones: {r}')
        ok(r['fetchedAt'] == 'x' and r['collectorFetchedAt'] == '2026-11-07T21:55:31+03:00', 'list time = monitor check time')
        # the monitor's own hand-off list keeps a Somalia story for 24 h (catch-up, retry of "pending"), a world story 3 h
        t0 = now(); H = lambda h: iso(t0 - datetime.timedelta(hours=h))
        sd = os.path.join(d, 'fast'); os.makedirs(sd)
        w.save(os.path.join(sd, 'candidates.json'), {'items': [
            {'url': 'https://so.test/a', 'source': 'hiiraan', 'discoveredAt': H(10), 'publishedAt': H(10.5)},
            {'url': 'https://so.test/b', 'source': 'hiiraan', 'discoveredAt': H(10), 'publishedAt': H(25)},
            {'url': 'https://w.test/c', 'source': 'bbc-world', 'discoveredAt': H(4), 'publishedAt': H(4)}]})
        with contextlib.redirect_stdout(io.StringIO()):
            save_all(sd, {'sources': {}, 'tracked': {}}, {}, [], t0, {'hours': '24/7'}, [], [])
        kept = [x['url'] for x in load(os.path.join(sd, 'candidates.json'), {})['items']]
        ok(kept == ['https://so.test/a'], f'hand-off list: Somalia story kept 24 h after its publisher time, world story 3 h: {kept}')
    # every fastPoll source in sources.json is complete
    for s in load(SOURCES, {'sources': []})['sources']:
        if not s.get('fastPoll'): continue
        ok(s.get('feeds'), f"{s['id']}: has a feed")
        ok(s.get('section') in ('somalia', 'world', 'sports'), f"{s['id']}: known section")
        ok(not east_africa.excluded_source(s), f"{s['id']}: not an excluded address")
        if s.get('headlineOnly'):
            ok((s.get('permission') or {}).get('status') == 'headline-and-link' and s.get('imagePolicy') == 'all-rights-reserved',
               f"{s['id']}: headline-only source has its terms recorded and never reuses photos")
        if (s.get('permission') or {}).get('status') == 'permission-required':
            ok(s.get('monitorOnly') and not s.get('enabled'), f"{s['id']}: no permission -> monitor only and switched off")
    print('OK' if not bad else 'FAILED:\n  ' + '\n  '.join(bad))
    sys.exit(1 if bad else 0)


def probe(_args):
    """Prints, for every feed of every fastPoll source, whether it answers and its three newest items (feed check)."""
    for s in load(SOURCES, {'sources': []})['sources']:
        if not s.get('fastPoll'): continue
        for f in s.get('feeds') or []:
            try:
                t0 = time.time(); data = w.get(f['url'])
                got = w.parse_feed(data)
                got.sort(key=lambda g: g.get('publishedAt') or '', reverse=True)
                print(f"OK   {s['id']:<13} {f['url']}  {len(got)} items, {len(data)} bytes, {time.time() - t0:.1f}s")
                if not s.get('monitorOnly'):
                    for g in got[:3]: print(f"       {g.get('publishedAt')}  {(g.get('title') or '')[:90]}  {g.get('url')}")
                else:
                    print(f"       newest {got[0].get('publishedAt') if got else None} (monitor only: titles not shown)")
            except Exception as e:
                print(f"FAIL {s['id']:<13} {f['url']}  {type(e).__name__}: {e}"[:300])


def handoff(args):
    """Put the monitor's fresh candidates into the hourly task's list (branch world-feed, candidates.json), so the next
    news run sees articles discovered minutes ago without waiting for the :35 collection. Items already in that list keep
    their data and only get "discoveredAt"; the task's own dedup still removes duplicates and known stories."""
    fast = load(w.opt(args, '--fast'), {}) or {}
    path = w.opt(args, '--world')
    wf = load(path, None) or {'fetchedAt': fast.get('fetchedAt'), 'since': None, 'sources': [], 'items': []}
    # the hourly collector's own items older than the freshness limit are dropped (they can never be published)
    # Somalia stories stay for the collector's 24-hour Somalia catch-up (tools/world_news.py SOMALIA_HOURS); dropping them
    # here every 5 minutes was why the catch-up never reached the news task (9 Nov 2026)
    cut = now() - datetime.timedelta(hours=KEEP_CANDIDATE_H)
    so_cut = now() - datetime.timedelta(hours=w.SOMALIA_HOURS)
    so_src = {s['id'] for s in load(SOURCES, {'sources': []})['sources'] if s.get('country') == 'so'}
    is_so = lambda x: x.get('country') == 'so' or x.get('source') in so_src
    wf['items'] = [x for x in wf.get('items', []) if x.get('firstSeenBy') != '5-minute monitor'
                   and (parse(x.get('publishedAt')) or now()) >= (so_cut if is_so(x) else cut)]
    # the list is now as fresh as this monitor check (it reads every enabled source); the collector's own time is kept
    if not wf.get('collectorFetchedAt'): wf['collectorFetchedAt'] = wf.get('fetchedAt')
    wf['fetchedAt'] = fast.get('fetchedAt') or wf.get('fetchedAt')
    have = {w.norm_url(x.get('url')): x for x in wf['items']}
    have.update({w.norm_url(x.get('canonicalUrl')): x for x in wf['items'] if x.get('canonicalUrl')})
    added = 0
    for x in fast.get('items', []):
        old = have.get(w.norm_url(x['url'])) or have.get(w.norm_url(x.get('canonicalUrl') or ''))
        if old: old.setdefault('discoveredAt', x['discoveredAt']); continue
        wf['items'].append(x); added += 1
    ids = {s['id'] for s in wf.get('sources', [])}
    for s in fast.get('sources', []):
        if s['id'] not in ids: wf.setdefault('sources', []).append(s)
    wf['fastMonitor'] = {'at': fast.get('fetchedAt'), 'added': added}
    w.save(path, wf)
    print(f'hand-off: {added} fresh article(s) from the 5-minute monitor added to the news task list')


def hours(_args):
    print('open' if is_open(now(), load(SCHEDULE, {})) else 'closed')


if __name__ == '__main__':
    cmd, rest = (sys.argv[1], sys.argv[2:]) if len(sys.argv) > 1 else ('help', [])
    fn = {'run': run, 'test': test, 'hours': hours, 'probe': probe, 'handoff': handoff}.get(cmd)
    if not fn: print(__doc__); sys.exit(2)
    fn(rest)
