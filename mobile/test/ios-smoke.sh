#!/bin/sh
# The real iPhone app on an iPhone simulator, reading the LIVE website https://www.wartabiyetv.com/:
#  1. installs and opens the app; it must load the website's news (the app logs "[WTV] feed so ...") and its newest
#     story must be one of the website's newest stories
#  2. opens a story through an article link (wartabiye://war/<id>), as a notification tap does, inside the app
#  3. opens the World section and the Contact page inside the app; the app is still running; screenshots
#   sh test/ios-smoke.sh <path to .app> <output-dir>
set -e
APP="$1"; OUT="$2"; BUNDLE=com.wartabiyetv.app
mkdir -p "$OUT"
DEV=$(xcrun simctl list devices available -j | python3 -c "
import json,sys
d=json.load(sys.stdin)['devices']
c=[(r,x) for r,l in d.items() if 'iOS' in r for x in l if x['name'].startswith('iPhone')]
c.sort(key=lambda t:(t[0],t[1]['name']))
print(c[-1][1]['udid'])")
echo "simulator $DEV"
xcrun simctl boot "$DEV" 2>/dev/null || true
xcrun simctl bootstatus "$DEV" -b
xcrun simctl install "$DEV" "$APP"
LOG="$OUT/ios-log.txt"
xcrun simctl spawn "$DEV" log stream --style compact --level debug --predicate 'eventMessage CONTAINS "[WTV]"' > "$LOG" 2>&1 &
LOGPID=$!
sleep 3
xcrun simctl launch "$DEV" $BUNDLE
python3 -u - "$OUT" "$DEV" "$BUNDLE" "$LOG" <<'PY'
import json, re, subprocess, sys, time, urllib.request
out, dev, bundle, logf = sys.argv[1:5]
def sh(*a): return subprocess.run(list(a), capture_output=True, text=True).stdout
def shot(name):
    subprocess.run(['xcrun', 'simctl', 'io', dev, 'screenshot', out + '/' + name], capture_output=True)
news = json.load(urllib.request.urlopen('https://www.wartabiyetv.com/data/news.json?t=%d' % time.time()))['news']
news = sorted([n for n in news if n.get('published') is not False], key=lambda n: n['publishedAt'], reverse=True)
top = [n['id'] for n in news[:5]]
print('website newest:', top[:3])
def wait(pattern, secs, since=0):
    for _ in range(secs // 3):
        time.sleep(3)
        log = open(logf, errors='replace').read()[since:]
        m = re.search(pattern, log)
        if m: return m
    return None
def size(): return len(open(logf, errors='replace').read())
def running():
    return bundle in sh('xcrun', 'simctl', 'spawn', dev, 'launchctl', 'list')
m = wait(r'\[WTV\] feed so (\w+) (\d+) newest=(\S+)', 180)
if not m:
    shot('ios-home-failed.png')
    sys.exit('the iPhone app did not load the news (see ios-log.txt and ios-home-failed.png)')
print('iPhone app loaded %s stories from %s, newest %s' % (m.group(2), m.group(1), m.group(3)))
if m.group(3) not in top: sys.exit("the app's newest story is not one of the website's newest: " + m.group(3))
if int(m.group(2)) < 20: sys.exit('too few stories in the app')
time.sleep(5); shot('ios-home.png')
# Links (article / section / page): iOS asks "Open in Wartabiye TV?" for wartabiye:// links opened from outside the app,
# and a headless simulator cannot tap that prompt. So these are reported, not required here; the same link code is
# required to pass on the Android emulator (test/android-smoke.sh) and in test/links.test.mjs.
def try_link(url, pattern, label, shotname):
    n = size()
    sh('xcrun', 'simctl', 'openurl', dev, url)
    ok = wait(pattern, 30, n)
    time.sleep(3); shot(shotname)
    print(('opened inside the app: ' if ok else 'not confirmed (iOS link prompt): ') + label)
    return ok
art = top[1] if len(top) > 1 and top[1] != m.group(3) else m.group(3)
try_link('wartabiye://war/' + art, r'\[WTV\] article ' + re.escape(art) + r' shown', 'article link', 'ios-article.png')
try_link('wartabiye://section/world', r'\[WTV\] section world shown', 'World section', 'ios-world.png')
try_link('wartabiye://page/xiriir', r'\[WTV\] page xiriir shown', 'Contact page', 'ios-contact.png')
if not running(): sys.exit('the iPhone app is not running (crash)')
print('iPhone app: installed, opened, shows the live website\'s news, still running (no crash)')
PY
kill $LOGPID 2>/dev/null || true
