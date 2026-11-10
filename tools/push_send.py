"""Send browser push notifications for NEW published stories, after GitHub Pages is live (publish workflow, last step),
and for a verified LIVE TV broadcast (live-status workflow).

Rules (the owner sets the numbers in /admin/ -> Ogeysiisyada -> Settings, file data/notify-settings.json):
  - nothing is sent unless push is switched on, the Worker address and public key are set, and the GitHub secret
    PUSH_ADMIN_TOKEN exists;
  - only items that are NEW to the feed since the last run (data/push-log.json "knownIds") and published less than
    "maxAgeHours" ago; the very first run only records what exists (no alert for old stories);
  - Degdeg (breaking) stories and the owner's urgent alerts: sent at once to every subscriber (at most 3 per run,
    "maxBreakingPerDay" per day);
  - routine stories: at most ONE per run (the most important, then the newest), only to visitors who chose that
    category, at most "maxRoutinePerDay" per day, at least "minMinutesBetweenRoutine" apart, never in quiet hours;
  - the same id is never sent twice (here AND in the Worker); every link is a published page of the site.
The result of every run is written to data/push-log.json ("sent", "lastRun", subscriber counts), shown in /admin/.

  python3 tools/push_send.py news [--dry-run]     new stories from data/notifications.json
  python3 tools/push_send.py live [--dry-run]     the verified broadcast in data/live-status.json
  python3 tools/push_send.py test                 self-test, no network, no files
"""
import json, os, sys, datetime, urllib.request
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EAT = datetime.timezone(datetime.timedelta(hours=3))
SITE = 'https://www.wartabiyetv.com/'
DEFAULTS = {'pushEnabled': False, 'workerUrl': '', 'publicKey': '',
            'categories': {'breaking': True, 'eastAfrica': True, 'world': True, 'sports': True, 'live': True},
            'maxRoutinePerDay': 6, 'minMinutesBetweenRoutine': 90, 'maxBreakingPerDay': 4, 'maxAgeHours': 6,
            'quietHours': {'enabled': True, 'from': 23, 'to': 6}}
PRIORITY = {'eastAfrica': 0, 'world': 1, 'sports': 2}


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


def message(it, urgent=False):
    t = {lang: {'title': x['title'], 'body': x.get('summary') or ''} for lang, x in (it.get('t') or {}).items()}
    return {'id': it['id'], 'category': 'breaking' if urgent else it['kind'], 'urgent': urgent, 'title': it['title'],
            'body': it.get('summary') or '', 't': t, 'url': it['url'], 'image': it.get('thumb')}


def plan(feed, log, cfg, now):
    """(to_send [(item, urgent)], skipped [(id, reason)], new_known). Pure: no network, no files."""
    items = feed.get('items', [])
    known = set(log.get('knownIds') or [])
    first = not log.get('knownIds') and not log.get('sent')
    sent_ids = {s['id'] for s in log.get('sent', [])}
    new = [i for i in items if i['id'] not in known and i['id'] not in sent_ids]
    keep = [i['id'] for i in items]
    if first:
        return [], [(i['id'], 'first run: existing stories are not announced') for i in new], keep
    # the browser bell needs the public key too, but the mobile app needs only the Worker address
    if not cfg['pushEnabled'] or not cfg['workerUrl']:
        return [], [(i['id'], 'push is switched off or not configured') for i in new], keep
    day = now.astimezone(EAT).date().isoformat()
    today = [s for s in log.get('sent', []) if (parse(s.get('at')) or now).astimezone(EAT).date().isoformat() == day and s.get('result', {}).get('ok', True)]
    b_today = sum(1 for s in today if s.get('urgent'))
    r_today = [s for s in today if not s.get('urgent')]
    last_r = max([parse(s['at']) for s in r_today] or [None], key=lambda d: d or datetime.datetime.min.replace(tzinfo=EAT))
    cats = cfg['categories']
    send, skip = [], []
    fresh = []
    for i in new:
        t = parse(i.get('time'))
        if not t or (now - t).total_seconds() > cfg['maxAgeHours'] * 3600:
            skip.append((i['id'], f'published more than {cfg["maxAgeHours"]} h ago')); continue
        if i.get('manual') and i.get('push') is False:
            skip.append((i['id'], 'alert without push')); continue
        fresh.append(i)
    urgent = [i for i in fresh if i['kind'] == 'breaking' or (i.get('manual') and i.get('urgent'))]
    for i in urgent:
        if not cats.get('breaking', True): skip.append((i['id'], 'breaking alerts switched off')); continue
        if b_today >= cfg['maxBreakingPerDay'] or sum(1 for _, u in send if u) >= 3:
            skip.append((i['id'], 'daily breaking limit reached')); continue
        send.append((i, True)); b_today += 1
    routine = [i for i in fresh if i not in urgent and cats.get(i['kind'], True)]
    for i in fresh:
        if i not in urgent and not cats.get(i['kind'], True): skip.append((i['id'], f'category {i["kind"]} switched off'))
    routine.sort(key=lambda i: (not i.get('manual'), not i.get('important'), PRIORITY.get(i['kind'], 3), -(parse(i['time']).timestamp())))
    why = None
    if routine:
        if quiet(now, cfg['quietHours']): why = 'quiet hours'
        elif len(r_today) >= cfg['maxRoutinePerDay']: why = 'daily limit for routine alerts reached'
        elif last_r and (now - last_r).total_seconds() < cfg['minMinutesBetweenRoutine'] * 60: why = f'less than {cfg["minMinutesBetweenRoutine"]} min since the last routine alert'
        if why is None:
            send.append((routine[0], False)); routine = routine[1:]
        for i in routine: skip.append((i['id'], why or 'one routine alert per update (shown in the bell)'))
    return send, skip, keep


def post(url, token, body, timeout=30):
    req = urllib.request.Request(url, data=json.dumps(body).encode(), method='POST', headers={'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token, 'User-Agent': 'WartabiyeTV-publish/1.0'})
    with urllib.request.urlopen(req, timeout=timeout) as r: return json.load(r)


def get(url, token, timeout=30):
    req = urllib.request.Request(url, headers={'Authorization': 'Bearer ' + token, 'User-Agent': 'WartabiyeTV-publish/1.0'})
    with urllib.request.urlopen(req, timeout=timeout) as r: return json.load(r)


def deliver(cfg, token, msg, dry):
    base = cfg['workerUrl'].rstrip('/')
    tot = {'ok': True, 'matched': 0, 'sent': 0, 'failed': 0, 'removed': 0}
    cursor = None
    for _ in range(500):  # 500 pages x 40 = 20 000 subscribers
        r = post(base + '/v1/send', token, {**msg, 'cursor': cursor, 'limit': 40, 'dryRun': dry})
        if r.get('duplicate'): return {**tot, 'duplicate': True}
        for k in ('matched', 'sent', 'failed', 'removed'): tot[k] += int(r.get(k) or 0)
        cursor = r.get('next')
        if not cursor: break
    return tot


def run(mode, dry):
    now = datetime.datetime.now(EAT)
    cfg = settings_of(load(os.path.join(root, 'data', 'notify-settings.json'), {}))
    log_p = os.path.join(root, 'data', 'push-log.json')
    log = load(log_p, {})
    token = os.environ.get('PUSH_ADMIN_TOKEN', '')
    if mode == 'live':
        st = load(os.path.join(root, 'data', 'live-status.json'), {})
        if not (st.get('live') and st.get('videoId') and st.get('checkedAt')):
            print('not live: nothing to send'); return
        lid = 'live-' + st['videoId']
        title = (st.get('title') or 'Wartabiye TV').strip()
        feed = {'items': [{'id': lid, 'kind': 'live', 'title': 'LIVE: ' + title, 'summary': 'Wartabiye TV hadda waa toos.', 't': {'en': {'title': 'LIVE: ' + title, 'summary': 'Wartabiye TV is live now.'}},
                           'url': 'toos/', 'time': st.get('startedAt') or st['checkedAt'], 'important': True}]}
        # a verified broadcast is always new: plan it as a normal (not first) run, without touching the news baseline
        to_send, skipped, _ = plan(feed, {**log, 'knownIds': (log.get('knownIds') or []) + ['live-baseline']}, cfg, now)
        keep = log.get('knownIds') or []
    else:
        feed = load(os.path.join(root, 'data', 'notifications.json'), {'items': []})
        to_send, skipped, keep = plan(feed, log, cfg, now)
    results = []
    if to_send and not token:
        skipped += [(i['id'], 'GitHub secret PUSH_ADMIN_TOKEN is missing') for i, _ in to_send]; to_send = []
    retry = set()
    for it, urgent in to_send:
        msg = message(it, urgent)
        try:
            res = deliver(cfg, token, msg, dry)
        except Exception as e:
            res = {'ok': False, 'error': str(e)[:200]}; retry.add(it['id'])  # try again next run while it is still fresh
        print(f"{'DRY ' if dry else ''}push {it['id']} ({msg['category']}{', urgent' if urgent else ''}): {res}")
        results.append({'id': it['id'], 'at': iso(now), 'category': msg['category'], 'urgent': urgent, 'title': it['title'][:120], 'url': SITE + it['url'], 'result': res})
    for i, why in skipped: print(f'no push {i}: {why}')
    if dry: return
    if mode == 'live':
        log['knownIds'] = keep
    else:
        log['knownIds'] = [i for i in keep if i not in retry]
    log['sent'] = (results + log.get('sent', []))[:100]
    stats = app_stats = None
    if token and cfg['workerUrl']:
        try:
            st = get(cfg['workerUrl'].rstrip('/') + '/v1/stats', token)
            stats, app_stats = st.get('subscribers'), st.get('app')
        except Exception as e: print('stats:', e)
    log['lastRun'] = {'at': iso(now), 'mode': mode, 'sent': len([r for r in results if r['result'].get('ok')]), 'skipped': [{'id': i, 'why': w} for i, w in skipped][:40],
                      'pushEnabled': bool(cfg['pushEnabled']), 'configured': bool(cfg['workerUrl'] and token), 'browserConfigured': bool(cfg['workerUrl'] and cfg['publicKey'] and token)}
    if stats is not None: log['subscribers'] = stats
    if app_stats is not None: log['appSubscribers'] = app_stats
    json.dump(log, open(log_p, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)


def test():
    now = datetime.datetime(2026, 11, 8, 14, 0, tzinfo=EAT)
    it = lambda i, kind, h, **k: {'id': i, 'kind': kind, 'title': i, 'url': f'war/{i}.html', 'time': iso(now - datetime.timedelta(hours=h)), **k}
    feed = {'items': [it('n-a', 'eastAfrica', 1), it('n-b', 'sports', 0.5), it('n-c', 'breaking', 0.2), it('n-old', 'world', 30)]}
    on = settings_of({'pushEnabled': True, 'workerUrl': 'https://w', 'publicKey': 'k'})
    # first run: nothing is announced, everything becomes known
    s, sk, keep = plan(feed, {}, on, now); assert s == [] and set(keep) == {'n-a', 'n-b', 'n-c', 'n-old'}
    # switched off: nothing sent
    s, sk, _ = plan(feed, {'knownIds': ['x']}, settings_of({}), now); assert s == []
    # on: breaking urgent + ONE routine (East Africa before sports), old story never
    s, sk, _ = plan(feed, {'knownIds': ['x']}, on, now)
    assert [(i['id'], u) for i, u in s] == [('n-c', True), ('n-a', False)], s
    assert ('n-old', 'published more than 6 h ago') in sk and any(i == 'n-b' for i, _ in sk)
    # already known / already sent: never again
    s, _, _ = plan(feed, {'knownIds': ['n-a', 'n-b', 'n-c', 'n-old']}, on, now); assert s == []
    s, _, _ = plan(feed, {'knownIds': ['x'], 'sent': [{'id': 'n-c', 'at': iso(now)}]}, on, now); assert all(i['id'] != 'n-c' for i, _ in s)
    # gap between routine alerts
    log = {'knownIds': ['x'], 'sent': [{'id': 'n-z', 'at': iso(now - datetime.timedelta(minutes=30)), 'urgent': False}]}
    s, sk, _ = plan(feed, log, on, now); assert [i['id'] for i, _ in s] == ['n-c'] and any('min since' in w for _, w in sk)
    # quiet hours: routine waits, breaking still goes
    night = datetime.datetime(2026, 11, 8, 2, 0, tzinfo=EAT)
    f2 = {'items': [it('n-a', 'eastAfrica', 0), it('n-c', 'breaking', 0)]}
    f2['items'] = [dict(x, time=iso(night)) for x in f2['items']]
    s, sk, _ = plan(f2, {'knownIds': ['x']}, on, night); assert [i['id'] for i, _ in s] == ['n-c'] and ('n-a', 'quiet hours') in sk
    # category switched off by the owner
    s, sk, _ = plan(feed, {'knownIds': ['x']}, settings_of({'pushEnabled': True, 'workerUrl': 'w', 'publicKey': 'k', 'categories': {'eastAfrica': False}}), now)
    assert [i['id'] for i, _ in s] == ['n-c', 'n-b']
    # daily breaking limit
    many = {'items': [it(f'n-b{k}', 'breaking', 0.1) for k in range(6)]}
    s, sk, _ = plan(many, {'knownIds': ['x']}, on, now); assert len(s) == 3
    # manual alert without push stays in the bell only
    s, sk, _ = plan({'items': [it('m-1', 'world', 0, manual=True, push=False)]}, {'knownIds': ['x']}, on, now); assert s == []
    m = message(it('n-a', 'eastAfrica', 1, t={'en': {'title': 'E', 'summary': 'S'}}))
    assert m['t']['en'] == {'title': 'E', 'body': 'S'} and m['category'] == 'eastAfrica'
    print('push_send: all tests passed')


if __name__ == '__main__':
    a = sys.argv[1:]
    if a[:1] == ['test']: test()
    elif a[:1] in (['news'], ['live']): run(a[0], '--dry-run' in a)
    else: print(__doc__); sys.exit(2)
