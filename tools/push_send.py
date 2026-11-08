"""Send browser push notifications for NEW published stories, after GitHub Pages is live (publish workflow, last step),
and for a verified LIVE TV broadcast (live-status workflow).

Order: source monitoring -> verification -> article published -> GitHub Pages live -> THIS -> each visitor's browser.
Rules (the owner sets the numbers in /admin/ -> Ogeysiisyada -> Settings, file data/notify-settings.json):
  - nothing is sent unless push is switched on and the Worker address and public key are set (the "Push: deploy"
    workflow fills them in);
  - only items that are NEW to the feed since the last run (data/push-log.json "knownIds"), published less than
    "maxAgeHours" ago, and whose page answers HTTP 200 on the live site; the very first run only records what exists;
  - Degdeg (breaking) stories and the owner's urgent alerts: to every subscriber at once (at most 3 per run,
    "maxBreakingPerDay" per day);
  - the other new stories (at most "maxPerUpdate" per run) go to the visitors who chose their category, as each
    visitor chose: "all" (every story; more than 3 at once are grouped), "digest" (one alert per update) or "top"
    (only the most important story: at most one per run, "maxRoutinePerDay" per day, "minMinutesBetweenRoutine" apart,
    none in quiet hours);
  - the same id is never sent twice (here AND in the Worker); every link is a published page of the site.
Authentication: a short-lived GitHub OIDC token of this repository (no password), or PUSH_ADMIN_TOKEN if set.
The result of every run is written to data/push-log.json ("sent", "lastRun", subscriber counts), shown in /admin/.

  python3 tools/push_send.py news [--dry-run]     new stories from data/notifications.json
  python3 tools/push_send.py live [--dry-run]     the verified broadcast in data/live-status.json
  python3 tools/push_send.py test                 self-test, no network, no files
"""
import json, os, sys, datetime, urllib.request, urllib.parse, time
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EAT = datetime.timezone(datetime.timedelta(hours=3))
SITE = 'https://www.wartabiyetv.com/'
DEFAULTS = {'pushEnabled': False, 'workerUrl': '', 'publicKey': '',
            'categories': {'breaking': True, 'somalia': True, 'eastAfrica': True, 'world': True, 'sports': True, 'live': True},
            'maxRoutinePerDay': 6, 'minMinutesBetweenRoutine': 90, 'maxBreakingPerDay': 4, 'maxAgeHours': 6, 'maxPerUpdate': 10,
            'quietHours': {'enabled': True, 'from': 23, 'to': 6}}
PRIORITY = {'live': 0, 'somalia': 1, 'eastAfrica': 2, 'world': 3, 'sports': 4}
AUDIENCE = 'wartabiye-push'
# texts for grouped alerts ({n} = number of stories), in the visitor's language
STRINGS = {
    'so': {'more': '+{n} war kale oo cusub', 'moreTitle': '{n} war cusub oo kale'},
    'en': {'more': '+{n} more new stories', 'moreTitle': '{n} more new stories'},
    'ar': {'more': '+{n} أخبار جديدة أخرى', 'moreTitle': '{n} أخبار جديدة أخرى'},
    'fr': {'more': '+{n} autres nouveaux articles', 'moreTitle': '{n} autres nouveaux articles'},
    'nl': {'more': '+{n} andere nieuwe berichten', 'moreTitle': '{n} andere nieuwe berichten'},
    'it': {'more': '+{n} altre nuove notizie', 'moreTitle': '{n} altre nuove notizie'},
    'de': {'more': '+{n} weitere neue Meldungen', 'moreTitle': '{n} weitere neue Meldungen'},
    'tr': {'more': '+{n} yeni haber daha', 'moreTitle': '{n} yeni haber daha'},
    'es': {'more': '+{n} noticias nuevas más', 'moreTitle': '{n} noticias nuevas más'},
}


def parse(t):
    try:
        d = datetime.datetime.fromisoformat(str(t).replace('Z', '+00:00'))
        return d if d.tzinfo else d.replace(tzinfo=EAT)
    except Exception:
        return None


def iso(d): return d.astimezone(EAT).isoformat(timespec='seconds')


def load(p, default):
    try: return json.load(open(p, encoding='utf-8'))
    except Exception: return default


def settings_of(s):
    out = json.loads(json.dumps(DEFAULTS))
    for k, v in (s or {}).items():
        if isinstance(v, dict) and isinstance(out.get(k), dict): out[k].update(v)
        elif v is not None: out[k] = v
    return out


def quiet(now, q):
    if not q.get('enabled'): return False
    h, a, b = now.astimezone(EAT).hour, int(q.get('from', 23)), int(q.get('to', 6))
    return (a <= h or h < b) if a > b else (a <= h < b)


def message(it, urgent=False, top=False):
    t = {lang: {'title': x['title'], 'body': x.get('summary') or ''} for lang, x in (it.get('t') or {}).items()}
    return {'id': it['id'], 'category': 'breaking' if urgent else it['kind'], 'urgent': urgent, 'top': bool(top or urgent), 'title': it['title'],
            'body': it.get('summary') or '', 't': t, 'url': it['url'], 'image': it.get('thumb')}


def plan(feed, log, cfg, now, live_ok=lambda it: True):
    """(to_send [(item, urgent, top)], skipped [(id, reason)], new_known, retry_ids). Pure apart from live_ok."""
    items = feed.get('items', [])
    known = set(log.get('knownIds') or [])
    first = not log.get('knownIds') and not log.get('sent')
    sent_ids = {s['id'] for s in log.get('sent', [])}
    new = [i for i in items if i['id'] not in known and i['id'] not in sent_ids]
    keep = [i['id'] for i in items]
    if first:
        return [], [(i['id'], 'first run: existing stories are not announced') for i in new], keep, set()
    if not cfg['pushEnabled'] or not cfg['workerUrl'] or not cfg['publicKey']:
        return [], [(i['id'], 'push is switched off or not configured') for i in new], keep, set()
    day = now.astimezone(EAT).date().isoformat()
    today = [s for s in log.get('sent', []) if (parse(s.get('at')) or now).astimezone(EAT).date().isoformat() == day and s.get('result', {}).get('ok', True)]
    b_today = sum(1 for s in today if s.get('urgent'))
    r_today = [s for s in today if not s.get('urgent') and s.get('top', True)]
    last_r = max([parse(s['at']) for s in r_today] or [None], key=lambda d: d or datetime.datetime.min.replace(tzinfo=EAT))
    cats = cfg['categories']
    send, skip, retry = [], [], set()
    fresh = []
    for i in new:
        t = parse(i.get('time'))
        if not t or (now - t).total_seconds() > cfg['maxAgeHours'] * 3600:
            skip.append((i['id'], f'published more than {cfg["maxAgeHours"]} h ago')); continue
        if i.get('manual') and i.get('push') is False:
            skip.append((i['id'], 'alert without push')); continue
        if not live_ok(i):
            skip.append((i['id'], 'page is not live yet: will be tried again')); retry.add(i['id']); continue
        fresh.append(i)
    urgent = [i for i in fresh if i['kind'] == 'breaking' or (i.get('manual') and i.get('urgent'))]
    for i in urgent:
        if not cats.get('breaking', True): skip.append((i['id'], 'breaking alerts switched off')); continue
        if b_today >= cfg['maxBreakingPerDay'] or sum(1 for _, u, _ in send if u) >= 3:
            skip.append((i['id'], 'daily breaking limit reached')); continue
        send.append((i, True, True)); b_today += 1
    routine = [i for i in fresh if i not in urgent and cats.get(i['kind'], True)]
    for i in fresh:
        if i not in urgent and not cats.get(i['kind'], True): skip.append((i['id'], f'category {i["kind"]} switched off'))
    routine.sort(key=lambda i: (not i.get('manual'), not i.get('important'), PRIORITY.get(i['kind'], 5), -(parse(i['time']).timestamp())))
    for i in routine[cfg['maxPerUpdate']:]: skip.append((i['id'], f'more than {cfg["maxPerUpdate"]} new stories in one update (shown in the bell)'))
    routine = routine[:cfg['maxPerUpdate']]
    if routine:
        why = None
        if quiet(now, cfg['quietHours']): why = 'quiet hours'
        elif len(r_today) >= cfg['maxRoutinePerDay']: why = 'daily limit for important-only alerts reached'
        elif last_r and (now - last_r).total_seconds() < cfg['minMinutesBetweenRoutine'] * 60: why = f'less than {cfg["minMinutesBetweenRoutine"]} min since the last important-only alert'
        for n, i in enumerate(routine): send.append((i, False, n == 0 and why is None))
        if why: skip.append((routine[0]['id'], f'not sent to "important only" visitors: {why}'))
    return send, skip, keep, retry


def page_is_live(it, timeout=20):
    """The story's own page must answer 200 on the public site (GitHub Pages) before anyone is told about it."""
    url = SITE + it['url'].lstrip('/')
    try:
        req = urllib.request.Request(url + ('&' if '?' in url else '?') + 'pushcheck=' + str(int(time.time())), headers={'User-Agent': 'WartabiyeTV-publish/1.0', 'Cache-Control': 'no-cache'})
        with urllib.request.urlopen(req, timeout=timeout) as r:
            if r.status != 200: return False
            if it.get('article'): return it['article'].encode() in r.read(400000)
            return True
    except Exception as e:
        print('live check', url, e); return False


def auth_token():
    """A GitHub OIDC token for the push Worker (no password), or the optional PUSH_ADMIN_TOKEN."""
    u, t = os.environ.get('ACTIONS_ID_TOKEN_REQUEST_URL'), os.environ.get('ACTIONS_ID_TOKEN_REQUEST_TOKEN')
    if u and t:
        try:
            req = urllib.request.Request(u + ('&' if '?' in u else '?') + 'audience=' + urllib.parse.quote(AUDIENCE), headers={'Authorization': 'bearer ' + t})
            with urllib.request.urlopen(req, timeout=20) as r: return json.load(r)['value']
        except Exception as e: print('GitHub OIDC token:', e)
    return os.environ.get('PUSH_ADMIN_TOKEN', '')


def post(url, token, body, timeout=30):
    req = urllib.request.Request(url, data=json.dumps(body).encode(), method='POST', headers={'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token, 'User-Agent': 'WartabiyeTV-publish/1.0'})
    with urllib.request.urlopen(req, timeout=timeout) as r: return json.load(r)


def get(url, token, timeout=30):
    req = urllib.request.Request(url, headers={'Authorization': 'Bearer ' + token, 'User-Agent': 'WartabiyeTV-publish/1.0'})
    with urllib.request.urlopen(req, timeout=timeout) as r: return json.load(r)


def deliver(cfg, token, msgs, dry):
    base = cfg['workerUrl'].rstrip('/')
    tot = {'ok': True, 'matched': 0, 'sent': 0, 'failed': 0, 'removed': 0, 'messages': 0}
    cursor, limit, ids = None, 10, None
    for _ in range(3000):
        items = [m for m in msgs if ids is None or m['id'] in ids]
        try:
            r = post(base + '/v1/send', token, {'items': items, 'strings': STRINGS, 'cursor': cursor, 'limit': limit, 'dryRun': dry, 'totals': tot})
        except Exception as e:
            if limit > 1: limit = max(1, limit // 2); continue  # the Worker ran out of time on a big page: smaller pages
            raise
        if r.get('duplicate'): return {**tot, 'duplicate': True}
        for k in ('matched', 'sent', 'failed', 'removed', 'messages'): tot[k] += int(r.get(k) or 0)
        if r.get('errors'): tot['errors'] = {k: tot.get('errors', {}).get(k, 0) + v for k, v in r['errors'].items()}
        ids = r.get('ids') or ids
        cursor = r.get('next')
        if not cursor: break
    return tot


def run(mode, dry):
    now = datetime.datetime.now(EAT)
    cfg = settings_of(load(os.path.join(root, 'data', 'notify-settings.json'), {}))
    log_p = os.path.join(root, 'data', 'push-log.json')
    log = load(log_p, {})
    if mode == 'live':
        st = load(os.path.join(root, 'data', 'live-status.json'), {})
        if not (st.get('live') and st.get('videoId') and st.get('checkedAt')):
            print('not live: nothing to send'); return
        lid = 'live-' + st['videoId']
        title = (st.get('title') or 'Wartabiye TV').strip()
        feed = {'items': [{'id': lid, 'kind': 'live', 'title': 'LIVE: ' + title, 'summary': 'Wartabiye TV hadda waa toos.', 't': {'en': {'title': 'LIVE: ' + title, 'summary': 'Wartabiye TV is live now.'}},
                           'url': 'toos/', 'time': st.get('startedAt') or st['checkedAt'], 'important': True}]}
        # a verified broadcast is always new: plan it as a normal (not first) run, without touching the news baseline
        to_send, skipped, _, retry = plan(feed, {**log, 'knownIds': (log.get('knownIds') or []) + ['live-baseline']}, cfg, now)
        keep = log.get('knownIds') or []
    else:
        feed = load(os.path.join(root, 'data', 'notifications.json'), {'items': []})
        to_send, skipped, keep, retry = plan(feed, log, cfg, now, live_ok=(lambda it: True) if dry else page_is_live)
    token = auth_token() if to_send or cfg['workerUrl'] else ''
    results = []
    if to_send and not token:
        skipped += [(i['id'], 'no GitHub OIDC token (permission id-token: write) and no PUSH_ADMIN_TOKEN') for i, _, _ in to_send]; to_send = []
    if to_send:
        msgs = [message(it, u, t) for it, u, t in to_send]
        try:
            res = deliver(cfg, token, msgs, dry)
        except Exception as e:
            res = {'ok': False, 'error': str(e)[:200]}; retry |= {m['id'] for m in msgs}  # try again next run while still fresh
        print(f"{'DRY ' if dry else ''}push {[m['id'] for m in msgs]}: {res}")
        for (it, urgent, top), m in zip(to_send, msgs):
            results.append({'id': it['id'], 'at': iso(now), 'category': m['category'], 'urgent': urgent, 'top': top, 'title': it['title'][:120], 'url': SITE + it['url'], 'result': res})
    for i, why in skipped: print(f'no push {i}: {why}')
    if dry: return
    log['knownIds'] = keep if mode == 'live' else [i for i in keep if i not in retry]
    log['sent'] = (results + log.get('sent', []))[:100]
    stats = None
    if token and cfg['workerUrl']:
        try:
            j = get(cfg['workerUrl'].rstrip('/') + '/v1/stats', token)
            langs = j.get('languages') or {}
            stats = {**j.get('subscribers', {}), 'frequencies': j.get('frequencies'),
                     'languages': ', '.join(f'{k}: {v}' for k, v in sorted(langs.items(), key=lambda kv: -kv[1])) or '-'}
            log['recentRuns'] = [{k: r.get(k) for k in ('at', 'sent', 'failed', 'removed', 'matched', 'messages')} | {'titles': ' | '.join(r.get('titles') or [])[:300]}
                                 for r in (j.get('recent') or [])][:30]
        except Exception as e: print('stats:', e)
    log['lastRun'] = {'at': iso(now), 'mode': mode, 'sent': len([r for r in results if r['result'].get('ok')]), 'skipped': [{'id': i, 'why': w} for i, w in skipped][:40],
                      'pushEnabled': bool(cfg['pushEnabled']), 'configured': bool(cfg['workerUrl'] and cfg['publicKey'] and token),
                      'delivery': ({k: results[0]['result'].get(k) for k in ('ok', 'matched', 'sent', 'failed', 'removed', 'messages', 'error')} | {'errors': json.dumps(results[0]['result'].get('errors') or {})}) if results else None}
    if stats is not None: log['subscribers'] = stats
    json.dump(log, open(log_p, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)


def test():
    now = datetime.datetime(2026, 11, 8, 14, 0, tzinfo=EAT)
    it = lambda i, kind, h, **k: {'id': i, 'kind': kind, 'title': i, 'url': f'war/{i}.html', 'time': iso(now - datetime.timedelta(hours=h)), **k}
    feed = {'items': [it('n-a', 'eastAfrica', 1), it('n-b', 'sports', 0.5), it('n-c', 'breaking', 0.2), it('n-old', 'world', 30), it('n-s', 'somalia', 0.3)]}
    on = settings_of({'pushEnabled': True, 'workerUrl': 'https://w', 'publicKey': 'k'})
    ids = lambda s: [(i['id'], u, t) for i, u, t in s]
    # first run: nothing is announced, everything becomes known
    s, sk, keep, _ = plan(feed, {}, on, now); assert s == [] and set(keep) == {'n-a', 'n-b', 'n-c', 'n-old', 'n-s'}
    # switched off: nothing sent
    s, sk, _, _ = plan(feed, {'knownIds': ['x']}, settings_of({}), now); assert s == []
    # on: breaking urgent; every fresh story goes in the update (visitors choose), ONE is the "important only" alert
    s, sk, _, _ = plan(feed, {'knownIds': ['x']}, on, now)
    assert ids(s) == [('n-c', True, True), ('n-s', False, True), ('n-a', False, False), ('n-b', False, False)], ids(s)
    assert ('n-old', 'published more than 6 h ago') in sk
    # not live yet on GitHub Pages: not sent, tried again next run
    s, sk, _, retry = plan(feed, {'knownIds': ['x']}, on, now, live_ok=lambda i: i['id'] != 'n-a')
    assert 'n-a' not in [i['id'] for i, _, _ in s] and retry == {'n-a'}
    # already known / already sent: never again
    s, _, _, _ = plan(feed, {'knownIds': ['n-a', 'n-b', 'n-c', 'n-old', 'n-s']}, on, now); assert s == []
    s, _, _, _ = plan(feed, {'knownIds': ['x'], 'sent': [{'id': 'n-c', 'at': iso(now)}]}, on, now); assert all(i['id'] != 'n-c' for i, _, _ in s)
    # gap between "important only" alerts: stories still go to All News / digest visitors, none is "top"
    log = {'knownIds': ['x'], 'sent': [{'id': 'n-z', 'at': iso(now - datetime.timedelta(minutes=30)), 'urgent': False, 'top': True}]}
    s, sk, _, _ = plan(feed, log, on, now); assert [t for i, u, t in s if not u] == [False, False, False] and any('min since' in w for _, w in sk)
    # quiet hours: breaking still goes, no "important only" alert
    night = datetime.datetime(2026, 11, 8, 2, 0, tzinfo=EAT)
    f2 = {'items': [dict(x, time=iso(night)) for x in [it('n-a', 'eastAfrica', 0), it('n-c', 'breaking', 0)]]}
    s, sk, _, _ = plan(f2, {'knownIds': ['x']}, on, night); assert ids(s) == [('n-c', True, True), ('n-a', False, False)] and any('quiet hours' in w for _, w in sk)
    # category switched off by the owner
    s, sk, _, _ = plan(feed, {'knownIds': ['x']}, settings_of({'pushEnabled': True, 'workerUrl': 'w', 'publicKey': 'k', 'categories': {'eastAfrica': False}}), now)
    assert [i['id'] for i, _, _ in s] == ['n-c', 'n-s', 'n-b']
    # daily breaking limit
    many = {'items': [it(f'n-b{k}', 'breaking', 0.1) for k in range(6)]}
    s, sk, _, _ = plan(many, {'knownIds': ['x']}, on, now); assert len(s) == 3
    # at most maxPerUpdate stories per update
    lots = {'items': [it(f'n-w{k}', 'world', 0.1 + k / 100) for k in range(14)]}
    s, sk, _, _ = plan(lots, {'knownIds': ['x']}, on, now); assert len(s) == 10 and sum(1 for _, _, t in s if t) == 1
    # manual alert without push stays in the bell only
    s, sk, _, _ = plan({'items': [it('m-1', 'world', 0, manual=True, push=False)]}, {'knownIds': ['x']}, on, now); assert s == []
    m = message(it('n-a', 'eastAfrica', 1, t={'en': {'title': 'E', 'summary': 'S'}}))
    assert m['t']['en'] == {'title': 'E', 'body': 'S'} and m['category'] == 'eastAfrica' and m['top'] is False
    assert set(STRINGS) == {'so', 'en', 'ar', 'fr', 'nl', 'it', 'de', 'tr', 'es'} and all('{n}' in v['more'] and '{n}' in v['moreTitle'] for v in STRINGS.values())
    print('push_send: all tests passed')


if __name__ == '__main__':
    a = sys.argv[1:]
    if a[:1] == ['test']: test()
    elif a[:1] in (['news'], ['live']): run(a[0], '--dry-run' in a)
    else: print(__doc__); sys.exit(2)
