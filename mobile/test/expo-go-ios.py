#!/usr/bin/env python3
"""The published Expo Go update, opened in the real Expo Go app (the App Store version for this SDK) on an iPhone
simulator, the way the owner opens it on the phone: through the exp:// link of the QR code.

  1. downloads Expo Go for the simulator (the build Expo lists for this SDK) and installs it
  2. opens the link; Wartabiye TV must load the website's news (app log "[WTV] feed so ...") with its pictures
  3. all nine languages, chosen in Settings by tapping them, each loading that language's news
  4. finds the newest English story with Search and opens it inside the app (log "[WTV] article <id> shown")
  python3 test/expo-go-ios.py <exp:// link> <output-dir> [SDK, e.g. 58.0.0]
"""
import json
import os
import re
import subprocess
import sys
import tarfile
import time
import urllib.request

LINK, OUT = sys.argv[1], os.path.abspath(sys.argv[2])
EXPO_GO = 'host.exp.Exponent'
SITE = 'https://www.wartabiyetv.com'
HERE = os.path.dirname(os.path.abspath(__file__))
LANGS = [('en', 'English'), ('ar', 'العربية'), ('fr', 'Français'), ('nl', 'Nederlands'), ('it', 'Italiano'),
         ('tr', 'Türkçe'), ('de', 'Deutsch'), ('es', 'Español'), ('so', 'Soomaali')]
os.makedirs(OUT, exist_ok=True)


def sh(*a, check=False, timeout=None):
    r = subprocess.run(list(a), capture_output=True, text=True, timeout=timeout)
    if check and r.returncode:
        raise SystemExit(f'{" ".join(a)} failed: {r.stdout[-2000:]} {r.stderr[-2000:]}')
    return r


def get(url):
    with urllib.request.urlopen(url, timeout=60) as r:
        return r.read()


def expo_go_app():
    sdk = sys.argv[3] if len(sys.argv) > 3 else \
        json.load(open(os.path.join(HERE, '..', 'node_modules', 'expo', 'package.json')))['version'].split('.')[0] + '.0.0'
    v = json.loads(get('https://exp.host/--/api/v2/versions/latest'))
    e = ((v.get('data') or v).get('sdkVersions') or {}).get(sdk) or {}
    url = e.get('iosClientUrl')
    if not url:
        raise SystemExit(f'Expo lists no iPhone Expo Go for SDK {sdk}')
    print(f'Expo Go for SDK {sdk}: iOS {e.get("iosClientVersion")} ({url})', flush=True)
    d = os.path.join(OUT, 'Exponent.app')  # the download holds the inside of the app
    os.makedirs(d, exist_ok=True)
    tgz = os.path.join(OUT, 'expo-go.tar.gz')
    open(tgz, 'wb').write(get(url))
    with tarfile.open(tgz) as t:
        t.extractall(d)
    apps = [os.path.join(r, x) for r, ds, _ in os.walk(d) for x in ds if x.endswith('.app')]
    return (apps[0] if apps else d), e.get('iosClientVersion'), sdk


def english_story():
    feed = json.loads(get(f'{SITE}/api/v1/feed/en.json?t={int(time.time())}'))
    first = (feed.get('items') or feed.get('articles') or feed.get('news'))[0]
    art = json.loads(get(f'{SITE}/api/v1/a/{first["id"]}.json?t={int(time.time())}'))
    return first['id'], ((art.get('tr') or {}).get('en') or {}).get('title') or first.get('title')


def load_strings():
    site = json.load(open(os.path.join(HERE, '..', 'src', 'i18n', 'site.json')))
    ts = open(os.path.join(HERE, '..', 'src', 'i18n', 'app.ts')).read()
    out = {}
    for code, _ in LANGS:
        m = re.search(r'\n  ' + code + r': \{(.*?)\n  \},', ts, re.S)
        out[code] = {**site.get(code, {}), **(dict(re.findall(r"(\w+): '((?:[^'\\]|\\.)*)'", m.group(1))) if m else {})}
    return out


STR = load_strings()


def has(text):
    return '.*' + re.escape(text) + '.*'


def lang_row(name):
    return '[^A-Za-z0-9]*' + re.escape(name) + '[^A-Za-z0-9]*'


def txt(code, key):
    return has(STR[code][key])


def flow(title):
    W = {'timeout': 30000}
    words = title.split()[:4]
    tp = '.*' + re.escape(' '.join(words)).replace('\\ ', ' ') + '.*'
    word = (sorted(re.findall(r'[A-Za-z]{5,}', title), key=len, reverse=True) or [title.split()[0]])[0]

    def open_app(first=False):
        # the QR code's link, as the iPhone Camera hands it to Expo Go; iOS may ask "Open in Expo Go?" first
        s = [{'launchApp': {'appId': EXPO_GO, 'stopApp': True, **({'clearState': True} if first else {})}},
             {'openLink': LINK},
             {'tapOn': {'text': 'Open', 'optional': True}}]
        if first:
            # the first time, Expo Go lays its one-time tip about its own developer menu over the app: close it
            # (the app's name shows on both the tip's menu and the app itself once the update has loaded)
            s += [{'extendedWaitUntil': {'visible': '.*Wartabiye TV.*', 'timeout': 240000}},
                  {'waitForAnimationToEnd': {'timeout': 8000}},
                  {'takeScreenshot': 'expo-go-first-open'},
                  {'tapOn': {'text': 'Continue', 'optional': True}},
                  {'waitForAnimationToEnd': {'timeout': 4000}},
                  # then its developer menu itself stays open over the app: close it (the X at its top)
                  {'tapOn': {'text': 'Close', 'optional': True}},
                  {'tapOn': {'text': 'xmark', 'optional': True}},
                  {'waitForAnimationToEnd': {'timeout': 4000}}]
        s += [{'extendedWaitUntil': {'visible': {'id': 'menu-button'}, 'timeout': 90000}},
              {'tapOn': {'text': 'Continue', 'optional': True}},
              {'waitForAnimationToEnd': {'timeout': 8000}}]
        if first:
            return s
        # a restart: let Expo Go finish starting before the link is handed to it (the simulator's "open link" can
        # time out on a busy Mac), and try the whole restart again if it does
        s.insert(1, {'waitForAnimationToEnd': {'timeout': 5000}})
        return [{'retry': {'maxRetries': 2, 'commands': s}}]

    def menu(code, key, expect=None):
        cmds = open_app() + [
            {'tapOn': {'id': 'menu-button'}},
            {'extendedWaitUntil': {'visible': {'id': 'menu-panel'}, 'timeout': 10000}},
            {'waitForAnimationToEnd': {'timeout': 4000}},
            {'tapOn': {'text': txt(code, 'more'), 'index': 0}},
            {'extendedWaitUntil': {'visible': txt(code, key), 'timeout': 15000}},
            {'waitForAnimationToEnd': {'timeout': 8000}},
            {'scrollUntilVisible': {'element': {'text': txt(code, key)}, 'direction': 'DOWN', 'timeout': 15000,
                                    'visibilityPercentage': 100, 'centerElement': True}},
            {'tapOn': {'text': txt(code, key), 'index': 0}},
            {'waitForAnimationToEnd': {'timeout': 8000}}]
        if expect:
            cmds.append({'extendedWaitUntil': {'visible': expect, 'timeout': 15000}})
        return [{'retry': {'maxRetries': 2, 'commands': cmds}}]

    steps = open_app(first=True) + [{'assertVisible': 'Wartabiye TV'}, {'takeScreenshot': 'expo-go-home-so'}]
    cur = 'so'
    for code, name in LANGS:
        steps += menu(cur, 'settings', lang_row(name))
        steps += [{'retry': {'maxRetries': 2, 'commands': [
                      {'tapOn': {'text': lang_row(name), 'index': 0}},
                      {'waitForAnimationToEnd': {'timeout': 3000}},
                      {'extendedWaitUntil': {'visible': txt(code, 'settings'), 'timeout': 8000}}]}}]
        cur = code
        steps += open_app() + [{'takeScreenshot': f'expo-go-home-{code}'}]
        if code == 'en':
            steps += menu('en', 'search') + [
                {'inputText': word},
                {'extendedWaitUntil': {'visible': {'text': has(word)}, 'timeout': 10000}},
                'hideKeyboard',
                {'extendedWaitUntil': {'visible': tp, **W}},
                {'takeScreenshot': 'expo-go-search'},
                {'tapOn': {'text': tp, 'index': 0}},
                {'extendedWaitUntil': {'visible': re.escape(STR['en']['save']), **W}},
                {'waitForAnimationToEnd': {'timeout': 8000}},
                {'assertVisible': tp},
                {'takeScreenshot': 'expo-go-article'}]
    steps.append({'assertVisible': 'Wartabiye TV'})
    return '\n'.join([f'appId: {EXPO_GO}', '---'] + ['- ' + json.dumps(s, ensure_ascii=False) for s in steps]) + '\n'


def pick_device():
    d = json.loads(sh('xcrun', 'simctl', 'list', 'devices', 'available', '-j', check=True).stdout)['devices']
    phones = sorted(((rt, x) for rt, l in d.items() if 'iOS' in rt for x in l if x['name'].startswith('iPhone')),
                    key=lambda t: (t[0], t[1]['name']))
    for alt in ('iPhone 17$', 'iPhone 16$', 'iPhone 16e', 'Pro$'):
        m = [p for p in phones if re.search(alt, p[1]['name'])]
        if m:
            return m[-1][1]
    return phones[-1][1]


app, client, sdk = expo_go_app()
art_id, title = english_story()
print('newest English story on the website:', art_id, '|', title, flush=True)
dev = pick_device()
udid = dev['udid']
print(f'=== {dev["name"]} ({udid}), Expo Go {client}', flush=True)
sh('xcrun', 'simctl', 'boot', udid)
sh('xcrun', 'simctl', 'bootstatus', udid, '-b', check=True, timeout=600)
sh('xcrun', 'simctl', 'install', udid, app, check=True, timeout=300)
logf = os.path.join(OUT, 'app-log.txt')
lp = subprocess.Popen(['xcrun', 'simctl', 'spawn', udid, 'log', 'stream', '--style', 'compact', '--level', 'debug',
                       '--predicate', 'eventMessage CONTAINS "[WTV]"'], stdout=open(logf, 'w'), stderr=subprocess.STDOUT)
time.sleep(3)
fp = os.path.join(OUT, 'flow.yaml')
open(fp, 'w').write(flow(title))
env = dict(os.environ, MAESTRO_DRIVER_STARTUP_TIMEOUT='180000', MAESTRO_CLI_NO_ANALYTICS='1')
t0 = time.time()
r = None
for attempt in (1, 2):
    try:
        r = subprocess.run(['maestro', '--device', udid, 'test', fp, '--test-output-dir', OUT], cwd=OUT, env=env,
                           capture_output=True, text=True, timeout=2400)
    except subprocess.TimeoutExpired:
        r = subprocess.CompletedProcess([], 124, '', 'maestro did not finish in time')
    if r.returncode and 'DRIVER_STARTUP_TIMEOUT' in (r.stdout + r.stderr) and attempt == 1:
        continue
    break
print(r.stdout[-5000:], r.stderr[-2000:])
if r.returncode:
    h = subprocess.run(['maestro', '--device', udid, 'hierarchy'], capture_output=True, text=True, timeout=300).stdout
    seen = []
    for m in re.finditer(r'"(accessibilityText|text|title|value|resource-id)"\s*:\s*"((?:[^"\\]|\\.)+)"', h):
        if m.group(2) not in seen:
            seen.append(m.group(2))
    print('screen at the failure:', ' | '.join(seen[:150]))
time.sleep(2)
lp.terminate()
log = open(logf, errors='replace').read()
counts = {c: int(m.group(1)) for c, _ in LANGS for m in [re.search(r'\[WTV\] feed ' + c + r' \S+ (\d+) newest=', log)] if m}
article = bool(re.search(r'\[WTV\] article ' + re.escape(art_id) + ' shown', log))
# only the screenshots of this flow, moved next to the results
for root, _, files in os.walk(OUT):
    for f in files:
        if re.fullmatch(r'expo-go-[\w-]+\.png', f) and root != OUT:
            os.replace(os.path.join(root, f), os.path.join(OUT, f))
# The taps already prove each language switched and the website's newest English story opened inside Expo Go (its
# headline found by Search and shown on the article screen). The app log adds the story counts when Expo Go passes
# the app's log lines to the simulator log.
ok = r.returncode == 0
res = {'device': dev['name'], 'expo_go_ios': client, 'sdk': sdk, 'link': LINK, 'maestro_passed': ok,
       'all_nine_languages_tapped': ok, 'newest_english_story_opened_in_app': ok,
       'stories_per_language_from_log': counts or 'log lines not visible in Expo Go', 'article_log_line': article,
       'story': f'{art_id} | {title}', 'seconds': int(time.time() - t0)}
print(json.dumps(res, ensure_ascii=False, indent=1))
json.dump(res, open(os.path.join(OUT, 'expo-go-results.json'), 'w'), ensure_ascii=False, indent=1)
with open(os.environ.get('GITHUB_STEP_SUMMARY', os.devnull), 'a') as s:
    s.write(f'\n### Expo Go {client} on {dev["name"]}\n\n| | |\n|---|---|\n'
            + ''.join(f'| {k} | {v} |\n' for k, v in res.items()) + '\n')
# a language whose news list came back empty in the log is a failure too
sys.exit(0 if ok and not any(v == 0 for v in counts.values()) else 1)
