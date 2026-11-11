#!/usr/bin/env python3
"""The real iPhone app on iPhone simulators, driven by taps like a reader (Maestro), against the LIVE website.

For each simulator (a small iPhone without a notch and the largest iPhone with the Dynamic Island):
  1. installs the app and opens it fresh; the home screen must show the website's news (app log "[WTV] feed ...")
  2. all nine languages, chosen in Settings by tapping them: each one loads that language's news
     (log "[WTV] feed <lang> ...") and gets a screenshot (Arabic right-to-left)
  3. opens the newest English story and checks it shows the headline the website publishes right now
     (api/v1/a/<id>.json, the version after any edit in /admin/), scrolls through the body and photo
  4. bookmarks it (Save -> Remove), finds it under Saved, and finds it with Search
  5. Somalia, World, Sports and LIVE screens; then the app must still be running (no crash)
  python3 test/ios-deep.py <path to .app> <output-dir> [simulator name ...]
"""
import json
import os
import re
import shutil
import subprocess
import sys
import time
import urllib.request

APP, OUT = sys.argv[1], sys.argv[2]
WANTED = sys.argv[3:] or ['iPhone SE (3rd generation)', 'Pro Max']
BUNDLE = 'com.wartabiyetv.app'
SITE = 'https://www.wartabiyetv.com'
LANGS = [('en', 'English'), ('ar', 'العربية'), ('fr', 'Français'), ('nl', 'Nederlands'), ('it', 'Italiano'),
         ('tr', 'Türkçe'), ('de', 'Deutsch'), ('es', 'Español'), ('so', 'Soomaali')]
os.makedirs(OUT, exist_ok=True)
results = []


def sh(*a, check=False, timeout=None):
    r = subprocess.run(list(a), capture_output=True, text=True, timeout=timeout)
    if check and r.returncode:
        raise SystemExit(f'{" ".join(a)} failed: {r.stdout[-2000:]} {r.stderr[-2000:]}')
    return r


def get(path):
    with urllib.request.urlopen(f'{SITE}{path}{"&" if "?" in path else "?"}t={int(time.time())}', timeout=30) as r:
        return json.load(r)


def pick_devices():
    d = json.loads(sh('xcrun', 'simctl', 'list', 'devices', 'available', '-j', check=True).stdout)['devices']
    phones = [(rt, x) for rt, l in d.items() if 'iOS' in rt for x in l if x['name'].startswith('iPhone')]
    phones.sort(key=lambda t: (t[0], t[1]['name']))
    chosen = []
    for w in WANTED:
        m = [p for p in phones if w in p[1]['name']]
        if m:
            chosen.append(m[-1][1])
    if not chosen:
        chosen = [phones[-1][1]]
    return chosen


def english_story():
    """The newest English story and its headline as the website publishes it now (after any admin edit)"""
    try:
        feed = get('/api/v1/feed/en.json')
        items = feed.get('items') or feed.get('articles') or feed.get('news') or []
    except Exception as e:
        print('api/v1 not reachable, using data/news.json:', e)
        items = []
    if items:
        first = items[0]
        art = get(f'/api/v1/a/{first["id"]}.json')
        tr = (art.get('tr') or {}).get('en') or {}
        title = tr.get('title') or first.get('title')
        return first['id'], title
    news = get('/data/news.json')['news']
    news = [n for n in news if n.get('published') is not False]
    news.sort(key=lambda n: n['publishedAt'], reverse=True)
    for n in news:
        t = (n.get('translations') or {}).get('en') or {}
        if t.get('title'):
            return n['id'], t['title']
    return news[0]['id'], news[0]['title']


def search_word(title):
    words = sorted(re.findall(r'[A-Za-z]{5,}', title), key=len, reverse=True)
    return words[0] if words else title.split()[0]


def regex_prefix(title):
    # Maestro matches text as a regular expression over the whole label: the first words of the headline, then anything
    words = title.split()[:4]
    return re.escape(' '.join(words)).replace('\\ ', ' ') + '.*'


def flow(art_id, title):
    tp = regex_prefix(title)
    word = search_word(title)
    steps = [
        {'launchApp': {'appId': BUNDLE, 'clearState': True}},
        {'extendedWaitUntil': {'visible': 'Wartabiye TV', 'timeout': 90000}},
        {'waitForAnimationToEnd': {'timeout': 8000}},
        {'takeScreenshot': 'home-so-start'},
    ]
    for code, name in LANGS:
        steps += [
            {'openLink': 'wartabiye://settings'},
            {'extendedWaitUntil': {'visible': re.escape(name), 'timeout': 30000}},
            {'tapOn': {'text': re.escape(name), 'index': 0}},
            {'openLink': 'wartabiye://'},
            {'extendedWaitUntil': {'visible': 'Wartabiye TV', 'timeout': 30000}},
            {'waitForAnimationToEnd': {'timeout': 8000}},
            {'takeScreenshot': f'home-{code}'},
        ]
        if code == 'en':
            steps += [
                # the story the website publishes now, opened inside the app
                {'openLink': f'wartabiye://war/{art_id}'},
                {'extendedWaitUntil': {'visible': tp, 'timeout': 60000}},
                {'waitForAnimationToEnd': {'timeout': 8000}},
                {'takeScreenshot': 'article-top'},
                {'scroll': {}}, {'scroll': {}},
                {'takeScreenshot': 'article-body'},
                # bookmark it
                {'tapOn': {'text': 'Save', 'index': 0}},
                {'extendedWaitUntil': {'visible': 'Remove', 'timeout': 10000}},
                {'openLink': 'wartabiye://saved'},
                {'extendedWaitUntil': {'visible': tp, 'timeout': 20000}},
                {'takeScreenshot': 'saved'},
                # search for it
                {'openLink': 'wartabiye://search'},
                {'waitForAnimationToEnd': {'timeout': 5000}},
                {'inputText': word},
                {'extendedWaitUntil': {'visible': tp, 'timeout': 20000}},
                {'hideKeyboard': None},
                {'takeScreenshot': 'search'},
                # sections and LIVE
                {'openLink': 'wartabiye://section/somalia'}, {'waitForAnimationToEnd': {'timeout': 8000}}, {'takeScreenshot': 'section-somalia'},
                {'openLink': 'wartabiye://section/world'}, {'waitForAnimationToEnd': {'timeout': 8000}}, {'takeScreenshot': 'section-world'},
                {'openLink': 'wartabiye://section/sports'}, {'waitForAnimationToEnd': {'timeout': 8000}}, {'takeScreenshot': 'section-sports'},
                {'openLink': 'wartabiye://live'}, {'waitForAnimationToEnd': {'timeout': 8000}}, {'takeScreenshot': 'live'},
            ]
    steps.append({'assertVisible': 'Wartabiye TV'})
    lines = [f'appId: {BUNDLE}', '---']
    for s in steps:
        (cmd, arg), = s.items()
        lines.append('- ' + cmd if arg is None else '- ' + json.dumps(s, ensure_ascii=False))
    return '\n'.join(lines) + '\n'


def run_device(dev, art_id, title):
    udid, name = dev['udid'], dev['name']
    tag = re.sub(r'[^A-Za-z0-9]+', '-', name).strip('-').lower()
    out = os.path.join(OUT, tag)
    os.makedirs(out, exist_ok=True)
    print(f'\n=== {name} ({udid})', flush=True)
    sh('xcrun', 'simctl', 'boot', udid)
    sh('xcrun', 'simctl', 'bootstatus', udid, '-b', check=True, timeout=600)
    sh('xcrun', 'simctl', 'install', udid, APP, check=True, timeout=300)
    logf = os.path.join(out, 'app-log.txt')
    lp = subprocess.Popen(['xcrun', 'simctl', 'spawn', udid, 'log', 'stream', '--style', 'compact', '--level', 'debug',
                           '--predicate', 'eventMessage CONTAINS "[WTV]"'], stdout=open(logf, 'w'), stderr=subprocess.STDOUT)
    time.sleep(3)
    fp = os.path.join(out, 'flow.yaml')
    open(fp, 'w').write(flow(art_id, title))
    t0 = time.time()
    r = subprocess.run(['maestro', '--device', udid, 'test', fp, '--test-output-dir', out], cwd=out,
                       capture_output=True, text=True, timeout=1800)
    open(os.path.join(out, 'maestro.txt'), 'w').write(r.stdout + '\n' + r.stderr)
    print(r.stdout[-4000:], r.stderr[-2000:])
    time.sleep(2)
    lp.terminate()
    log = open(logf, errors='replace').read()
    running = BUNDLE in sh('xcrun', 'simctl', 'spawn', udid, 'launchctl', 'list').stdout
    langs_ok = {c: bool(re.search(r'\[WTV\] feed ' + c + r' \S+ (\d+) newest=', log)) for c, _ in LANGS}
    counts = {c: int(m.group(1)) for c, _ in LANGS for m in [re.search(r'\[WTV\] feed ' + c + r' \S+ (\d+) newest=', log)] if m}
    article_ok = bool(re.search(r'\[WTV\] article ' + re.escape(art_id) + ' shown', log))
    for f in os.listdir(out):
        if f.endswith('.png'):
            shutil.copy(os.path.join(out, f), os.path.join(OUT, f'{tag}-{f}'))
    res = {'device': name, 'maestro_passed': r.returncode == 0, 'still_running': running, 'languages_loaded': langs_ok,
           'stories_per_language': counts, 'article_opened': article_ok, 'seconds': int(time.time() - t0)}
    results.append(res)
    print(json.dumps(res, ensure_ascii=False, indent=1))
    sh('xcrun', 'simctl', 'shutdown', udid)
    return r.returncode == 0 and running and all(langs_ok.values()) and article_ok


art_id, title = english_story()
print('newest English story on the website:', art_id, '|', title)
ok = True
for dev in pick_devices():
    ok = run_device(dev, art_id, title) and ok
json.dump({'story': {'id': art_id, 'title': title}, 'results': results}, open(os.path.join(OUT, 'ios-deep-results.json'), 'w'),
          ensure_ascii=False, indent=1)
summ = os.environ.get('GITHUB_STEP_SUMMARY')
if summ:
    with open(summ, 'a') as f:
        f.write('\n### iPhone simulator test (taps, live website)\n\n')
        f.write(f'Story checked: `{art_id}`: {title}\n\n')
        f.write('| Simulator | Taps passed | 9 languages loaded | Article | Still running |\n|---|---|---|---|---|\n')
        for r in results:
            f.write(f"| {r['device']} | {'yes' if r['maestro_passed'] else 'NO'} | {sum(r['languages_loaded'].values())}/9 | "
                    f"{'yes' if r['article_opened'] else 'NO'} | {'yes' if r['still_running'] else 'NO'} |\n")
print('\nRESULT:', 'PASS' if ok else 'FAIL')
sys.exit(0 if ok else 1)
