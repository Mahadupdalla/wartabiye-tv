#!/bin/sh
# The real APK on an Android emulator, reading the LIVE website https://www.wartabiyetv.com/:
#  1. installs and opens the app; it must load the website's news (the app writes "[WTV] feed so ..." to the phone log)
#     and its newest story must be one of the website's newest stories
#  2. opens the newest story through an article link (wartabiye://war/<id>), as a notification tap does
#  3. the app is still running (no crash), screenshots of both screens
#   sh test/android-smoke.sh <apk> <output-dir>
set -e
APK="$1"; OUT="$2"; PKG=com.wartabiyetv.app
mkdir -p "$OUT"
adb install -r "$APK"
adb logcat -c || true
adb shell monkey -p $PKG -c android.intent.category.LAUNCHER 1 >/dev/null
python3 -u - "$OUT" "$PKG" <<'PY'
import json, re, subprocess, sys, time, urllib.request
out, pkg = sys.argv[1], sys.argv[2]
def sh(*a, **k): return subprocess.run(list(a), capture_output=True, text=True, **k).stdout
news = json.load(urllib.request.urlopen('https://www.wartabiyetv.com/data/news.json?t=%d' % time.time()))['news']
news = sorted([n for n in news if n.get('published') is not False], key=lambda n: n['publishedAt'], reverse=True)
top = [n['id'] for n in news[:5]]
print('website newest:', top[:3])
def wait(pattern, secs):
    for _ in range(secs // 3):
        time.sleep(3)
        log = sh('adb', 'logcat', '-d', '-s', 'ReactNativeJS:V', 'ReactNative:V', 'AndroidRuntime:E')
        m = re.search(pattern, log)
        if m: return m, log
        if 'FATAL EXCEPTION' in log: break
    return None, log
m, log = wait(r'\[WTV\] feed so (\w+) (\d+) newest=(\S+)', 180)
if not m:
    open(out + '/logcat.txt', 'w').write(log + sh('adb', 'logcat', '-d')[-20000:])
    sys.exit('the app did not load the news (see logcat.txt)')
print('app loaded %s stories from %s, newest %s' % (m.group(2), m.group(1), m.group(3)))
if m.group(3) not in top: sys.exit('the app\'s newest story is not one of the website\'s newest: ' + m.group(3))
if int(m.group(2)) < 20: sys.exit('too few stories in the app')
time.sleep(6)
open(out + '/android-home.png', 'wb').write(subprocess.run(['adb', 'exec-out', 'screencap', '-p'], capture_output=True).stdout)
sh('adb', 'shell', 'am', 'start', '-a', 'android.intent.action.VIEW', '-d', 'wartabiye://war/' + m.group(3), pkg)
a, log = wait(r'\[WTV\] article ' + re.escape(m.group(3)) + r' shown', 60)
if not a:
    open(out + '/logcat.txt', 'w').write(log)
    sys.exit('the article link did not open the article')
print('article link opened the article')
def show(log):
    lines = [l for l in log.splitlines() if re.search(r'FATAL|Exception|Error|error|\[WTV\]|AndroidRuntime', l)]
    print('\n'.join(lines[-60:]))
    print('--- crash buffer ---'); print(sh('adb', 'logcat', '-d', '-b', 'crash')[-6000:])
def front():
    out = sh('adb', 'shell', 'dumpsys', 'activity', 'activities')
    m2 = re.search(r'(mResumedActivity|topResumedActivity|ResumedActivity)[^\n]*', out)
    return m2.group(0) if m2 else ''
def in_app(label):
    f = front()
    print('  in front:', f.strip()[:160])
    if pkg not in f: sys.exit(label + ': another app (a browser?) came to the front instead of Wartabiye TV')
# a website link (Android App Link) opens INSIDE the app: article, section, an internal page
web = 'https://www.wartabiyetv.com'
id2 = top[1] if len(top) > 1 and top[1] != m.group(3) else top[0]
id3 = next((x for x in top if x not in (m.group(3), id2)), m.group(3))
time.sleep(4)
sh('adb', 'logcat', '-c')
sh('adb', 'shell', 'am', 'start', '-W', '-a', 'android.intent.action.VIEW', '-c', 'android.intent.category.BROWSABLE', '-d', web + '/war/' + id2 + '.html', pkg)
a, log = wait(r'\[WTV\] article ' + re.escape(id2) + r' shown', 60)
if not a: open(out + '/logcat.txt', 'w').write(log); show(log); sys.exit('the https article link did not open the article in the app')
in_app('https article link'); print('https://www.wartabiyetv.com/war/<id>.html opened the article inside the app')
sh('adb', 'logcat', '-c')
sh('adb', 'shell', 'am', 'start', '-W', '-a', 'android.intent.action.VIEW', '-c', 'android.intent.category.BROWSABLE', '-d', web + '/caalamka/', pkg)
a, log = wait(r'\[WTV\] section world shown', 45)
if not a: open(out + '/logcat.txt', 'w').write(log); show(log); sys.exit('the https World link did not open the World section in the app')
in_app('https section link'); print('https://www.wartabiyetv.com/caalamka/ opened the World section inside the app')
time.sleep(3)
open(out + '/android-world.png', 'wb').write(subprocess.run(['adb', 'exec-out', 'screencap', '-p'], capture_output=True).stdout)
sh('adb', 'logcat', '-c')
sh('adb', 'shell', 'am', 'start', '-W', '-a', 'android.intent.action.VIEW', '-c', 'android.intent.category.BROWSABLE', '-d', web + '/xiriir/', pkg)
a, log = wait(r'\[WTV\] page xiriir shown', 60)
if not a: open(out + '/logcat.txt', 'w').write(log); show(log); sys.exit('the Contact page did not open inside the app')
in_app('Contact page'); print('https://www.wartabiyetv.com/xiriir/ (Contact) opened inside the app, not in Chrome')
time.sleep(3)
open(out + '/android-contact.png', 'wb').write(subprocess.run(['adb', 'exec-out', 'screencap', '-p'], capture_output=True).stdout)
sh('adb', 'logcat', '-c')
sh('adb', 'shell', 'am', 'start', '-W', '-a', 'android.intent.action.VIEW', '-d', 'wartabiye://war/' + id3, pkg)
a, log = wait(r'\[WTV\] article ' + re.escape(id3) + r' shown', 60)
if not a: open(out + '/logcat.txt', 'w').write(log); show(log); sys.exit('a notification-style link (wartabiye://war/<id>) did not open the article')
in_app('notification link'); print('notification link wartabiye://war/<id> opened the right article inside the app')
time.sleep(5)
open(out + '/android-article.png', 'wb').write(subprocess.run(['adb', 'exec-out', 'screencap', '-p'], capture_output=True).stdout)
if not sh('adb', 'shell', 'pidof', pkg).strip(): sys.exit('the app is not running (crash)')
crash = sh('adb', 'logcat', '-d', '-b', 'crash')
if pkg in crash: print(crash); sys.exit('crash in the log')
print('Android app: installed, opened, shows the live website\'s news, opens articles, no crash')
PY
