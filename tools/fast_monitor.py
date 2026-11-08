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
KEEP_DAYS = 7            # how long seen ids are remembered
ERRORS_FOR_ALERT = 3     # consecutive failed checks (about 15 minutes) before "unavailable"


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


def check_source(s, st, t, log):
    """One check of one source. Mutates st (source state). Returns the list of NEW candidate items."""
    st['lastCheckAt'] = iso(t)
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
    st['consecutiveErrors'] = 0; st['lastOkAt'] = iso(t); st['feedUrl'] = used
    if errors: st['lastError'] = '; '.join(errors)[:600]; st['lastErrorAt'] = iso(t)
    if not listing:
        log.append(f"{s['id']}: not modified"); return []
    listing = [g for g in listing if not re.search(r'/(video|videos|gallery|live-news|live|live-updates)/', g.get('url') or '')]
    dated = [parse(g.get('publishedAt')) for g in listing if g.get('publishedAt')]
    if dated: st['latestPublishedAt'] = iso(max(dated))
    st['feedItems'] = len(listing)
    if s.get('monitorOnly'):
        # no permission yet: availability and recency only; nothing about the articles is kept
        st['baselineDone'] = True
        log.append(f"{s['id']}: reachable, {len(listing)} items, newest {st.get('latestPublishedAt')} (monitor only, not collected)")
        return []
    seen = st.setdefault('seen', {})
    first = not st.get('baselineDone')
    cut = t - datetime.timedelta(hours=NEW_MAX_AGE_H)
    for g in listing:
        k = item_key(g)
        if not k or k in seen: continue
        pubd = parse(g.get('publishedAt'))
        if first:
            seen[k] = {'at': iso(t), 'kind': 'baseline', 'publishedAt': g.get('publishedAt')}; continue
        if pubd and pubd < cut:
            seen[k] = {'at': iso(t), 'kind': 'old', 'publishedAt': g.get('publishedAt')}
            st['oldIgnored'] = st.get('oldIgnored', 0) + 1; continue
        it = {'source': s['id'], 'sourceName': s['name'], 'section': s.get('section', 'world'), 'url': g['url'],
              'title': g.get('title'), 'description': g.get('description'), 'publishedAt': g.get('publishedAt'),
              'image': g.get('image'), 'timeVerified': bool(g.get('publishedAt')), 'discoveredAt': iso(t),
              'dateSource': 'publisher RSS feed' if g.get('publishedAt') else None, 'firstSeenBy': '5-minute monitor'}
        for kk in ('channelPost', 'postLabel'):
            if g.get(kk): it[kk] = g[kk]
        if g.get('dateSource'): it['dateSource'] = g['dateSource']
        try:
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
            seen[k] = {'at': iso(t), 'kind': 'no-date'}
            log.append(f"{s['id']}: no verifiable publication time, not passed on: {g['url']}"); continue
        if parse(it['publishedAt']) < cut:
            seen[k] = {'at': iso(t), 'kind': 'old', 'publishedAt': it['publishedAt']}
            st['oldIgnored'] = st.get('oldIgnored', 0) + 1; continue
        ok, why = east_africa.gate(it, s)
        if not ok:
            seen[k] = {'at': iso(t), 'kind': 'excluded', 'why': why}; continue
        seen[k] = {'at': iso(t), 'kind': 'new', 'publishedAt': it['publishedAt']}
        new.append({k2: v for k2, v in it.items() if v not in (None, '')})
        time.sleep(0.3)
    if first:
        st['baselineDone'] = True; st['baselineAt'] = iso(t)
        log.append(f"{s['id']}: first check, {len(listing)} existing items recorded as baseline (not new)")
    else:
        log.append(f"{s['id']}: {len(listing)} items, {len(new)} new")
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


def live_ids():
    try:
        req = urllib.request.Request(SITE_NEWS + '?ts=' + str(int(time.time())), headers={'User-Agent': w.UA, 'Cache-Control': 'no-cache'})
        with urllib.request.urlopen(req, timeout=20) as r:
            d = json.loads(r.read())
        return {n.get('id') for n in d.get('news', []) if n.get('id')}
    except Exception as e:
        print('live site not readable:', e)
        return None


def minutes(a, b):
    a, b = parse(a), parse(b)
    return round((b - a).total_seconds() / 60, 1) if a and b else None


def track(tracked, t):
    """Follow every discovered story: on main (published / held) and really live."""
    arts = site_articles()
    live = None
    for x in tracked.values():
        if x.get('liveAt') or x.get('state') == 'expired': continue
        keys = {x['key'], w.norm_url(x.get('canonicalUrl') or '')} - {''}
        a = next((arts[k] for k in keys if k in arts), None)
        if a:
            x['articleId'] = a['id']
            x['state'] = 'held' if a['held'] else 'committed'
            x.setdefault('committedAt', committed_at(a['path']) or iso(t))
            if a.get('verifiedAt'): x['verifiedAt'] = a['verifiedAt']
            if not a['held']:
                if live is None: live = live_ids() or set()
                if a['id'] in live:
                    x['liveAt'] = iso(t); x['state'] = 'live'
        elif parse(x['discoveredAt']) < t - datetime.timedelta(hours=24):
            x['state'] = 'expired'   # the news task did not choose it (duplicate, not important, not verified)
        for k, a_, b_ in (('discoveryDelayMin', 'publishedAt', 'discoveredAt'), ('commitDelayMin', 'publishedAt', 'committedAt'),
                          ('liveDelayMin', 'publishedAt', 'liveAt'), ('pipelineMin', 'discoveredAt', 'liveAt')):
            if x.get(a_) and x.get(b_): x[k] = minutes(x[a_], x[b_])


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
    ws = window_start(t, sched)
    first_of_day = bool(ws) and (not state.get('lastRunAt') or parse(state['lastRunAt']) < ws)
    new_items = []
    for s in fast:
        st = state['sources'].setdefault(s['id'], {})
        if east_africa.excluded_source(s):
            st['lastError'] = 'excluded by the East Africa rule'; continue
        if not s.get('enabled', True) and not s.get('monitorOnly'):
            st['disabled'] = True; continue
        st.pop('disabled', None)
        got = check_source(s, st, t, log)
        for it in got:
            if first_of_day and ws and parse(it['publishedAt']) < ws:
                it['overnight'] = True   # published while monitoring was paused: labelled with its real time
            state['tracked'][it.get('canonicalUrl') and w.norm_url(it['canonicalUrl']) or item_key(it)] = {
                'key': item_key(it), 'source': s['id'], 'url': it['url'], 'canonicalUrl': it.get('canonicalUrl'),
                'title': it.get('title'), 'publishedAt': it['publishedAt'], 'discoveredAt': it['discoveredAt'],
                'overnight': it.get('overnight', False), 'state': 'discovered'}
        new_items += got
    # forget old ids and old tracked stories
    cut = t - datetime.timedelta(days=KEEP_DAYS)
    for st in state['sources'].values():
        st['seen'] = {k: v for k, v in (st.get('seen') or {}).items() if (parse(v.get('at')) or t) >= cut}
    state['tracked'] = {k: v for k, v in state['tracked'].items() if (parse(v.get('discoveredAt')) or t) >= cut}
    track(state['tracked'], t)
    state['lastRunAt'] = iso(t)
    state['runs'] = ([{'at': iso(t), 'new': len(new_items), 'failed': [s['id'] for s in fast
                       if state['sources'].get(s['id'], {}).get('lastErrorAt') == iso(t) and state['sources'][s['id']].get('consecutiveErrors')]}]
                     + state['runs'])[:400]
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
    keep = {w.norm_url(x['url']): x for x in old.get('items', []) if parse(x.get('discoveredAt')) and parse(x['discoveredAt']) >= t - datetime.timedelta(hours=KEEP_CANDIDATE_H)}
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
            'sources': srcrep, 'items': sorted(keep.values(), key=lambda x: x.get('publishedAt') or '', reverse=True)}
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
    return {
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
        'recentDiscovered': [{k: x.get(k) for k in ('source', 'title', 'url', 'publishedAt', 'discoveredAt', 'discoveryDelayMin', 'state', 'articleId', 'overnight')}
                             for x in sorted(tr, key=lambda x: x['discoveredAt'], reverse=True)[:40]],
    }


def report_text(st, log):
    L = [f"5-minute source monitor, {st['updatedAt']} (operating hours {st['operatingHours']} Africa/Nairobi; {'open' if st['open'] else 'closed'})",
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
        ok(st.get('oldIgnored') == 1, 'old never-seen item is ignored, not new')
        ok(check_source(s, st, now_, log) == [], 'same item is never new twice')
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
    finally:
        fetch_feed, w.article = real_fetch, real_article
    ok(minutes('2026-11-08T10:00:00+03:00', '2026-11-08T10:07:30+03:00') == 7.5, 'delay minutes')
    import tempfile
    with tempfile.TemporaryDirectory() as d:
        fa, wa = os.path.join(d, 'f.json'), os.path.join(d, 'w.json')
        w.save(fa, {'fetchedAt': 'x', 'sources': [{'id': 'abcnews'}], 'items': [
            {'url': 'https://a.test/1', 'discoveredAt': 'T1', 'firstSeenBy': '5-minute monitor', 'source': 'abcnews'},
            {'url': 'https://a.test/2', 'discoveredAt': 'T2', 'firstSeenBy': '5-minute monitor', 'source': 'abcnews'}]})
        w.save(wa, {'sources': [{'id': 'bbc-world'}], 'items': [{'url': 'https://a.test/2?x=1', 'source': 'abcnews', 'title': 'kept'}]})
        import contextlib, io
        with contextlib.redirect_stdout(io.StringIO()):
            handoff(['--fast', fa, '--world', wa]); handoff(['--fast', fa, '--world', wa])
        r = load(wa, {})
        ok(len(r['items']) == 2 and r['items'][0].get('discoveredAt') == 'T2' and r['items'][0]['title'] == 'kept', f'hand-off adds once, keeps existing items: {r}')
    # every fastPoll source in sources.json is complete
    for s in load(SOURCES, {'sources': []})['sources']:
        if not s.get('fastPoll'): continue
        ok(s.get('feeds'), f"{s['id']}: has a feed")
        ok(s.get('section') in ('somalia', 'world', 'sports'), f"{s['id']}: known section")
        ok(not east_africa.excluded_source(s), f"{s['id']}: never a Somalia source")
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
    wf['items'] = [x for x in wf.get('items', []) if x.get('firstSeenBy') != '5-minute monitor']
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
