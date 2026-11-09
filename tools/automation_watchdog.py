"""Publishing watchdog: keeps automatic publishing going without anyone opening GitHub.

Run by the 5-minute source loop (tools/fast_loop.sh) after every check, on GitHub Actions. Cheap: a few GitHub API calls
and one download of the live data/news.json. It never changes an article and never skips a check.

  1. Live site in sync? data/news.json on wartabiyetv.com is compared with data/news.json on main.
  2. Publishing healthy? The latest "Daabac bogga" (publish.yml) runs on main are read.
  3. Recovery, automatically:
       - new content on main that no successful publish run has handled yet, or a failed publish run that is the newest
         one: the publish workflow is started again (at most once every RETRY_COOLDOWN_MIN minutes, at most MAX_RETRIES
         times for the same content; a run already queued or running is never doubled);
       - main is published but the live site still shows an older version: GitHub Pages is asked to build again.
  4. When recovery does not help (MAX_RETRIES failed runs for the same content, or the live site more than
     STALE_LIVE_MIN minutes behind), it opens ONE GitHub issue "Daabacaadda: ..." (GitHub e-mails the owner) and closes it
     by itself when publishing works again.
  5. Writes the automation status (shown in /admin/ -> "Xaaladda otomaatigga"): last successful publication, last source
     check, published articles, stories waiting for a photo, failures and retries.

  python3 tools/automation_watchdog.py run --state DIR    (needs GH_TOKEN and REPO; DIR holds watchdog.json between checks)
  python3 tools/automation_watchdog.py test               offline self-test of the decisions
"""
import datetime, glob, json, os, subprocess, sys, time, urllib.request, urllib.error

root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EAT = datetime.timezone(datetime.timedelta(hours=3))
RETRY_COOLDOWN_MIN = 15
MAX_RETRIES = 4
STALE_LIVE_MIN = 45
PAGES_REBUILD_MIN = 12
ISSUE_TITLE = 'Daabacaadda: waxay u baahan tahay faragelin (publishing needs attention)'
PHOTO_RULE_FROM = '2026-11-02'


def now():
    return datetime.datetime.now(datetime.timezone.utc)


def ptime(s):
    try:
        t = datetime.datetime.fromisoformat(str(s).replace('Z', '+00:00'))
        return t if t.tzinfo else t.replace(tzinfo=datetime.timezone.utc)
    except Exception:
        return None


def mins(a, b):
    return None if not a or not b else (a - b).total_seconds() / 60


def http(url, method='GET', body=None, token=None, tries=3):
    """-> (status, parsed JSON or text). Retries network errors and 5xx answers."""
    if method != 'GET' and os.environ.get('WATCHDOG_DRY'):
        print(f'(dry run) would {method} {url}')
        return 204, None
    last = None
    for i in range(tries):
        req = urllib.request.Request(url, method=method, data=json.dumps(body).encode() if body is not None else None)
        req.add_header('User-Agent', 'wartabiye-watchdog')
        if token:
            req.add_header('Authorization', 'Bearer ' + token)
            req.add_header('Accept', 'application/vnd.github+json')
        if body is not None:
            req.add_header('Content-Type', 'application/json')
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                raw = r.read().decode('utf-8', 'replace')
                try:
                    return r.status, json.loads(raw) if raw else None
                except ValueError:
                    return r.status, raw
        except urllib.error.HTTPError as e:
            last = (e.code, e.read().decode('utf-8', 'replace')[:300])
            if e.code < 500 and e.code != 429:
                return last
        except Exception as e:
            last = (0, str(e)[:300])
        time.sleep(3 * (i + 1))
    return last


def git_time(*paths):
    out = subprocess.run(['git', '-C', root, 'log', '-1', '--format=%cI', 'origin/main', '--', *paths], capture_output=True, text=True).stdout.strip()
    if not out:
        out = subprocess.run(['git', '-C', root, 'log', '-1', '--format=%cI', '--', *paths], capture_output=True, text=True).stdout.strip()
    return ptime(out)


def article_counts():
    published = waiting = 0
    for f in glob.glob(os.path.join(root, 'data', 'news', '*.json')):
        try:
            n = json.load(open(f, encoding='utf-8'))
        except Exception:
            continue
        img = (n.get('image') or '').lstrip('/')
        has_img = img.startswith('img/') and os.path.isfile(os.path.join(root, img))
        auto = n.get('by') != 'admin' and n.get('by') != 'auto-results' and (n.get('publishedAt') or '')[:10] >= PHOTO_RULE_FROM
        if n.get('published', True) is False:
            waiting += bool(n.get('imagePending'))
        elif auto and not has_img:
            waiting += 1
    try:
        published = len(json.load(open(os.path.join(root, 'data', 'news.json'), encoding='utf-8'))['news'])
    except Exception:
        pass
    return published, waiting


# ---------------------------------------------------------------- the decision (pure, tested offline)

def decide(t, runs, content_at, repo_news, live_news, wd):
    """runs: publish.yml runs on main, newest first ({status, conclusion, created_at, head_sha, html_url, event}).
    content_at: newest commit time of the files the publish workflow builds from. -> (actions, status dict)"""
    active = [r for r in runs if r.get('status') in ('queued', 'in_progress', 'waiting', 'pending', 'requested')]
    done = [r for r in runs if r.get('status') == 'completed']
    last = done[0] if done else None
    ok = next((r for r in done if r.get('conclusion') == 'success'), None)
    ok_at = ptime(ok['created_at']) if ok else None
    actions, problems = [], []
    # content pushed after the start of the last successful publish run has not been published by a successful run yet
    unpublished = bool(content_at and (not ok_at or content_at > ok_at + datetime.timedelta(seconds=5)))
    failed_newest = bool(last and last.get('conclusion') in ('failure', 'timed_out', 'startup_failure') and (not ok or last is not ok))
    key = (last or {}).get('head_sha') if failed_newest else ('content@' + content_at.isoformat() if unpublished and content_at else None)
    if key != wd.get('key'):
        wd.update(key=key, attempts=0, alerted=False, firstSeenAt=t.isoformat(timespec='seconds') if key else None)
    need = (failed_newest or (unpublished and mins(t, content_at) is not None and mins(t, content_at) > 8))
    if need and not active:
        if wd.get('attempts', 0) < MAX_RETRIES:
            since = mins(t, ptime(wd.get('lastRetryAt')))
            if since is None or since >= RETRY_COOLDOWN_MIN:
                actions.append('publish')
                wd['attempts'] = wd.get('attempts', 0) + 1
                wd['lastRetryAt'] = t.isoformat(timespec='seconds')
        else:
            problems.append(f"publishing failed {wd['attempts'] + 1} times for the same content; automatic retries stopped "
                            f"(last run: {(last or {}).get('html_url', '?')})")
    # live site behind main although publishing succeeded: ask GitHub Pages to build again, then alert
    repo_u, live_u = (repo_news or {}).get('updatedAt'), (live_news or {}).get('updatedAt')
    in_sync = bool(live_news) and repo_u == live_u and len((repo_news or {}).get('news', [])) == len(live_news.get('news', []))
    wd['liveFails'] = 0 if live_news is not None else wd.get('liveFails', 0) + 1
    if wd['liveFails'] >= 3:   # one unanswered request is a network hiccup; three checks in a row (15 minutes) is a problem
        problems.append(f"the live site wartabiyetv.com/data/news.json could not be read ({wd['liveFails']} checks in a row)")
    news_at = ptime(wd.get('repoNewsCommitAt'))
    behind = None if in_sync or not news_at else mins(t, news_at)
    if not in_sync and live_news is not None and behind is not None and not active:
        if behind > PAGES_REBUILD_MIN:
            since = mins(t, ptime(wd.get('lastPagesAt')))
            if since is None or since >= PAGES_REBUILD_MIN:
                actions.append('pages'); wd['lastPagesAt'] = t.isoformat(timespec='seconds')
        if behind > STALE_LIVE_MIN:
            problems.append(f'the live site is {behind:.0f} minutes behind main (live {live_u}, main {repo_u})')
    overall = 'ok'
    if active:
        overall = 'publishing'
    elif need or (not in_sync and live_news is not None):
        overall = 'retrying'
    if problems:
        overall = 'needs-attention'
    status = {
        'overall': overall,
        'liveInSync': in_sync,
        'liveUpdatedAt': live_u, 'mainUpdatedAt': repo_u,
        'liveArticles': len(live_news.get('news', [])) if live_news else None,
        'lastPublishRun': {k: (last or {}).get(k) for k in ('created_at', 'conclusion', 'event', 'html_url')} if last else None,
        'lastSuccessfulPublishAt': ok['created_at'] if ok else None,
        'publishRunning': bool(active),
        'retry': {'attempts': wd.get('attempts', 0), 'max': MAX_RETRIES, 'lastRetryAt': wd.get('lastRetryAt'), 'since': wd.get('firstSeenAt')} if key else None,
        'problems': problems,
    }
    return actions, status


# ---------------------------------------------------------------- run on GitHub Actions

def run(state_dir):
    token, repo = os.environ.get('GH_TOKEN'), os.environ.get('REPO')
    api = f'https://api.github.com/repos/{repo}'
    t = now()
    wd_path = os.path.join(state_dir, 'watchdog.json')
    try:
        wd = json.load(open(wd_path, encoding='utf-8'))
    except Exception:
        wd = {}
    code, data = http(f'{api}/actions/workflows/publish.yml/runs?branch=main&per_page=15', token=token)
    runs = data.get('workflow_runs', []) if code == 200 and isinstance(data, dict) else []
    if code != 200:
        print(f'watchdog: could not read the publish runs ({code})')
    # what the publish workflow builds from (not what it writes itself: data/news.json, the small card images, the pages)
    content_at = git_time('data/news', 'data/ads', 'data/videos', 'data/alerts', 'data/site.json', 'data/pages.json', 'data/status.json',
                          'img', ':(exclude)img/news/w480')
    wd['repoNewsCommitAt'] = (git_time('data/news.json') or t).isoformat(timespec='seconds')
    try:
        repo_news = json.load(open(os.path.join(root, 'data', 'news.json'), encoding='utf-8'))
    except Exception:
        repo_news = None
    host = open(os.path.join(root, 'CNAME')).read().strip()
    code, live = http(f'https://{host}/data/news.json?watchdog={int(t.timestamp())}')
    live_news = live if code == 200 and isinstance(live, dict) else None
    actions, st = decide(t, runs, content_at, repo_news, live_news, wd)
    for a in actions:
        if a == 'publish':
            c, _ = http(f'{api}/actions/workflows/publish.yml/dispatches', 'POST', {'ref': 'main'}, token)
            print(f'watchdog: started the publish workflow again (attempt {wd["attempts"]}/{MAX_RETRIES}): HTTP {c}')
        elif a == 'pages':
            c, _ = http(f'{api}/pages/builds', 'POST', {}, token)
            print(f'watchdog: asked GitHub Pages to build again: HTTP {c}')
    # one issue while the owner is needed; closed automatically when everything works again
    if st['problems'] and not wd.get('alerted'):
        body = ('Automatic publishing needs your attention (' + datetime.datetime.now(EAT).strftime('%Y-%m-%d %H:%M') + ' Africa/Nairobi):\n\n'
                + '\n'.join('- ' + p for p in st['problems'])
                + '\n\nThe watchdog already retried automatically. Unpublished articles are kept safely on main and are published '
                  'as soon as a publish run succeeds. Status: /admin/ -> "Xaaladda otomaatigga". This issue closes by itself when '
                  'publishing works again.')
        num = find_issue(api, token)
        if num:
            http(f'{api}/issues/{num}/comments', 'POST', {'body': body}, token)
        else:
            http(f'{api}/issues', 'POST', {'title': ISSUE_TITLE, 'body': body}, token)
        wd['alerted'] = True
    elif st['overall'] == 'ok':
        wd['alerted'] = False
    if st['overall'] == 'ok' and wd.get('openIssue', True):
        num = find_issue(api, token)
        if num:
            http(f'{api}/issues/{num}/comments', 'POST', {'body': 'Publishing works again: the live site is up to date. Closing.'}, token)
            http(f'{api}/issues/{num}', 'PATCH', {'state': 'closed', 'state_reason': 'completed'}, token)
        wd['openIssue'] = False
    if st['problems']:
        wd['openIssue'] = True
    # automation status for /admin/
    published, waiting = article_counts()
    fs = {}
    try:
        fs = json.load(open(os.path.join(state_dir, 'fast-status.json'), encoding='utf-8'))
    except Exception:
        pass
    s = fs.get('status') or {}
    writers = {}
    for name, f in (('news', 'news-writer-status.json'), ('sports', 'sports-writer-status.json')):
        try:
            w = json.load(open(os.path.join(state_dir, f), encoding='utf-8'))
            writers[name] = {'mode': w.get('mode'), 'lastCheckAt': w.get('lastCheckAt'), 'lastWrittenAt': w.get('lastWrittenAt'), 'lastRun': w.get('lastRun')}
        except Exception:
            pass
    try:
        routine = json.load(open(os.path.join(root, 'data', 'status.json'), encoding='utf-8'))
    except Exception:
        routine = {}
    failures = sum(1 for r in runs if r.get('conclusion') == 'failure' and (mins(t, ptime(r.get('created_at'))) or 1e9) < 1440)
    newest = max((n.get('publishedAt') or '' for n in (live_news or repo_news or {}).get('news', [])), default=None)
    out = {
        'about': 'Written every 5 minutes by tools/automation_watchdog.py (GitHub Actions); this copy is saved about once an hour '
                 'and at once when the state changes. Do not edit.',
        'updatedAt': datetime.datetime.now(EAT).isoformat(timespec='seconds'),
        'overall': st['overall'],
        'overallText': {'ok': 'Wax walba si otomaatig ah ayay u shaqeynayaan', 'publishing': 'Daabacaad ayaa socota',
                        'retrying': 'Cillad ku meel gaar ah: si otomaatig ah ayaa dib loogu celinayaa',
                        'needs-attention': 'Waxay u baahan tahay faragelintaada (eeg dhibaatooyinka)'}[st['overall']],
        'lastSuccessfulPublishAt': st['lastSuccessfulPublishAt'],
        'newestArticleAt': newest,
        'lastSourceCheckAt': s.get('lastSourceCheckAt') or fs.get('lastCheckAt'),
        'sourceChecks24h': s.get('checks24h'),
        'publishedArticles': published,
        'liveArticles': st['liveArticles'],
        'waitingForImage': waiting,
        'liveInSync': st['liveInSync'],
        'publishFailures24h': failures,
        'lastPublishRun': st['lastPublishRun'],
        'retry': st['retry'],
        'problems': st['problems'],
        'hourlyRoutineLastRunAt': routine.get('lastRunAt'),
        'writers': writers,
    }
    json.dump(out, open(os.path.join(state_dir, 'automation-status.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    json.dump(wd, open(wd_path, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print(f"watchdog: {st['overall']} | live in sync: {st['liveInSync']} | last successful publish {st['lastSuccessfulPublishAt']} | "
          f"{published} published, {waiting} waiting for a photo" + (' | ' + '; '.join(st['problems']) if st['problems'] else ''))
    return 0


def find_issue(api, token):
    code, data = http(f'{api}/issues?state=open&per_page=50', token=token)
    for i in data if code == 200 and isinstance(data, list) else []:
        if i.get('title') == ISSUE_TITLE and not i.get('pull_request'):
            return i['number']
    return None


def self_test():
    ok = True

    def check(c, msg):
        nonlocal ok
        print(('ok   ' if c else 'FAIL ') + msg)
        ok = ok and bool(c)
    T = lambda m: datetime.datetime(2026, 11, 9, 12, 0, tzinfo=datetime.timezone.utc) + datetime.timedelta(minutes=m)
    run = lambda m, concl, sha='a', status='completed': {'status': status, 'conclusion': concl, 'created_at': T(m).isoformat(), 'head_sha': sha, 'html_url': 'u'}
    news = {'updatedAt': 'x', 'news': [1, 2]}
    wd = {'repoNewsCommitAt': T(-60).isoformat()}
    a, s = decide(T(0), [run(-30, 'success')], T(-40), news, news, wd)
    check(a == [] and s['overall'] == 'ok' and s['liveInSync'], 'healthy: nothing to do')
    wd = {'repoNewsCommitAt': T(-60).isoformat()}
    a, s = decide(T(0), [run(-5, 'failure', 'b'), run(-30, 'success')], T(-6), news, news, wd)
    check(a == ['publish'] and s['overall'] == 'retrying' and wd['attempts'] == 1, 'failed newest run: publish again')
    a, s = decide(T(5), [run(-5, 'failure', 'b'), run(-30, 'success')], T(-6), news, news, wd)
    check(a == [], 'no second retry inside the cool-down')
    a, s = decide(T(20), [run(18, None, 'b', 'in_progress'), run(-5, 'failure', 'b')], T(-6), news, news, wd)
    check(a == [] and s['overall'] == 'publishing', 'never a second run while one is running')
    wd2 = {'repoNewsCommitAt': T(-60).isoformat()}
    for i in range(MAX_RETRIES):
        decide(T(i * 20), [run(-5, 'failure', 'c')], T(-6), news, news, wd2)
    a, s = decide(T(200), [run(190, 'failure', 'c')], T(-6), news, news, wd2)
    check(a == [] and s['overall'] == 'needs-attention' and s['problems'], 'after the retries: stop and alert the owner')
    wd3 = {'repoNewsCommitAt': T(-60).isoformat()}
    a, s = decide(T(0), [run(-30, 'success')], T(-10), news, news, wd3)
    check(a == ['publish'], 'content pushed after the last successful run (no run started): publish it')
    wd3b = {'repoNewsCommitAt': T(-60).isoformat()}
    a, s = decide(T(0), [run(-30, 'success')], T(-3), news, news, wd3b)
    check(a == [], 'content pushed 3 minutes ago: give the normal run time first')
    wd4 = {'repoNewsCommitAt': T(-20).isoformat()}
    a, s = decide(T(0), [run(-25, 'success')], T(-40), news, {'updatedAt': 'old', 'news': [1]}, wd4)
    check(a == ['pages'] and s['overall'] == 'retrying' and not s['liveInSync'], 'live site behind: ask Pages to build')
    wd5 = {'repoNewsCommitAt': T(-60).isoformat()}
    a, s = decide(T(0), [run(-65, 'success')], T(-70), news, {'updatedAt': 'old', 'news': [1]}, wd5)
    check('pages' in a and s['overall'] == 'needs-attention', 'live site behind for an hour: alert')
    wd6 = {'repoNewsCommitAt': T(-60).isoformat()}
    a, s = decide(T(0), [run(-30, 'success')], T(-40), news, None, wd6)
    check(s['overall'] == 'ok' and a == [], 'live site unreachable once: a hiccup, no alert')
    decide(T(5), [run(-30, 'success')], T(-40), news, None, wd6)
    a, s = decide(T(10), [run(-30, 'success')], T(-40), news, None, wd6)
    check(s['overall'] == 'needs-attention' and a == [], 'live site unreachable 3 checks in a row: alert, no blind re-publish')
    print('WATCHDOG OK' if ok else 'WATCHDOG FAILED')
    return 0 if ok else 1


if __name__ == '__main__':
    a = sys.argv[1:]
    if a[:1] == ['test']:
        sys.exit(self_test())
    if a[:1] == ['run']:
        sys.exit(run(a[a.index('--state') + 1] if '--state' in a else '/tmp/fast'))
    print(__doc__); sys.exit(2)
