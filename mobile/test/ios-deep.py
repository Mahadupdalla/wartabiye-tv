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

APP, OUT = os.path.abspath(sys.argv[1]), os.path.abspath(sys.argv[2])
# a small iPhone (SE, or the smallest current model) and the largest one; names differ between Xcode versions
WANTED = sys.argv[3:] or ['iPhone SE|iPhone 16e|iPhone 17e|iPhone 17$|iPhone 16$', 'Pro Max']
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
    print('iPhone simulators on this Mac:', sorted({x['name'] for _, x in phones}))
    for w in WANTED:
        for alt in w.split('|'):
            m = [p for p in phones if re.search(alt, p[1]['name'])]
            if m:
                if m[-1][1]['udid'] not in [c['udid'] for c in chosen]:
                    chosen.append(m[-1][1])
                break
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
    return '.*' + re.escape(' '.join(words)).replace('\\ ', ' ') + '.*'


HERE = os.path.dirname(os.path.abspath(__file__))


def load_strings():
    """The app's own interface text per language (src/i18n/app.ts, then the website's src/i18n/site.json)"""
    site = json.load(open(os.path.join(HERE, '..', 'src', 'i18n', 'site.json')))
    ts = open(os.path.join(HERE, '..', 'src', 'i18n', 'app.ts')).read()
    out = {}
    for code, _ in LANGS:
        m = re.search(r'\n  ' + code + r': \{(.*?)\n  \},', ts, re.S)
        app = dict(re.findall(r"(\w+): '((?:[^'\\]|\\.)*)'", m.group(1))) if m else {}
        out[code] = {**site.get(code, {}), **app}
    return out


STR = load_strings()


def has(text):
    # iOS joins a button's texts into one label (icon glyph, flag, name, tick), so match the text anywhere in it
    return '.*' + re.escape(text) + '.*'


def txt(code, key):
    return has(STR[code][key])


def flow(art_id, title):
    """Taps like a reader. iOS asks before a wartabiye:// link from outside opens the app, so the test never uses links:
    it taps the tab bar and the Menu, and restarts the app to return home (which also proves settings are kept)."""
    tp = regex_prefix(title)
    word = search_word(title)
    W = {'timeout': 30000}

    def restart(code):
        return [{'launchApp': {'appId': BUNDLE, 'stopApp': True}},
                {'extendedWaitUntil': {'visible': {'id': 'menu-button'}, **W}},
                {'waitForAnimationToEnd': {'timeout': 8000}}]

    def menu(code, key, expect=None):
        # restart the app (home screen, and proof the settings were kept), then the blue MENU button in the header,
        # its last item ("More") and the item. A tap while a screen is still sliding in can land on the wrong item,
        # so the whole path is tried up to three times, each time from a fresh start.
        cmds = restart(code) + [
            {'tapOn': {'id': 'menu-button'}},
            {'extendedWaitUntil': {'visible': {'id': 'menu-panel'}, 'timeout': 10000}},
            {'waitForAnimationToEnd': {'timeout': 4000}},
            {'tapOn': {'text': txt(code, 'more'), 'index': 0}},
            {'extendedWaitUntil': {'visible': txt(code, key), 'timeout': 15000}},
            {'waitForAnimationToEnd': {'timeout': 8000}},
            {'tapOn': {'text': txt(code, key), 'index': 0}},
            {'waitForAnimationToEnd': {'timeout': 8000}}]
        if expect:
            cmds.append({'extendedWaitUntil': {'visible': expect, 'timeout': 15000}})
        return [{'retry': {'maxRetries': 2, 'commands': cmds}}]

    steps = [
        {'launchApp': {'appId': BUNDLE, 'clearState': True}},
        {'extendedWaitUntil': {'visible': 'Wartabiye TV', 'timeout': 120000}},
        {'extendedWaitUntil': {'visible': {'id': 'menu-button'}, **W}},
        {'waitForAnimationToEnd': {'timeout': 8000}},
        {'takeScreenshot': 'home-so-start'},
    ]
    cur = 'so'
    for code, name in LANGS:
        steps += menu(cur, 'settings', has(name))
        steps += [  # tap the language and see the screen switch to it (the title "Settings" in that language);
                  # a tap during the screen's slide-in can miss, so it is tried up to three times
                  {'retry': {'maxRetries': 2, 'commands': [
                      {'tapOn': {'text': has(name), 'index': 0}},
                      {'waitForAnimationToEnd': {'timeout': 3000}},
                      {'extendedWaitUntil': {'visible': txt(code, 'settings'), 'timeout': 8000}}]}}]
        cur = code
        steps += restart(code)
        steps.append({'takeScreenshot': f'home-{code}'})
        if code == 'en':
            steps += menu('en', 'search')
            steps += [
                {'inputText': word},
                {'extendedWaitUntil': {'visible': tp, **W}},
                {'takeScreenshot': 'search'},
                # the story the website publishes now, opened inside the app from the search result
                {'tapOn': {'text': tp, 'index': 0}},
                {'extendedWaitUntil': {'visible': re.escape(STR['en']['save']), **W}},
                {'waitForAnimationToEnd': {'timeout': 8000}},
                {'assertVisible': tp},
                {'takeScreenshot': 'article-top'},
                {'scroll': {}}, {'scroll': {}},
                {'takeScreenshot': 'article-body'},
                # bookmark it, restart, and find it under Saved
                {'tapOn': {'text': re.escape(STR['en']['save']), 'index': 0}},
                {'extendedWaitUntil': {'visible': re.escape(STR['en']['unsave']), 'timeout': 10000}},
                {'waitForAnimationToEnd': {'timeout': 2000}},
            ]
            steps += menu('en', 'saved', tp) + [{'takeScreenshot': 'saved'}]
            for key, shot in (('somaliaNav', 'section-somalia'), ('world', 'section-world'), ('sports', 'section-sports'),
                              ('liveNewsNav', 'live')):
                steps += menu('en', key) + [{'takeScreenshot': shot}]
    steps.append({'assertVisible': 'Wartabiye TV'})
    lines = [f'appId: {BUNDLE}', '---']
    for st in steps:
        lines.append('- ' + json.dumps(st, ensure_ascii=False))
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
    if r.returncode:
        # what the screen holds at the failure: every label, text and id Maestro can see
        h = subprocess.run(['maestro', '--device', udid, 'hierarchy'], capture_output=True, text=True, timeout=300).stdout
        open(os.path.join(out, 'hierarchy.json'), 'w').write(h)
        seen = []
        for m in re.finditer(r'"(accessibilityText|text|title|value|resource-id|hintText)"\s*:\s*"((?:[^"\\]|\\.)+)"', h):
            v = m.group(1) + '=' + m.group(2)
            if v not in seen:
                seen.append(v)
        print('screen at the failure:', ' | '.join(seen[:150]))
        for root, _, files in os.walk(out):
            if 'maestro.log' in files:
                tail = open(os.path.join(root, 'maestro.log'), errors='replace').read().splitlines()[-40:]
                print('maestro.log (end):\n' + '\n'.join(tail))
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
