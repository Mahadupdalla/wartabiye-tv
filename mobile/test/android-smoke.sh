#!/bin/sh
# Installs the real APK on an Android emulator, opens it, and checks that it shows the newest headline from the
# LIVE website (https://www.wartabiyetv.com/data/news.json) and that the app is still running (no crash).
#   sh test/android-smoke.sh <apk> <output-dir>
set -e
APK="$1"; OUT="$2"; PKG=com.wartabiyetv.app
mkdir -p "$OUT"
adb install -r "$APK"
adb logcat -c || true
adb shell monkey -p $PKG -c android.intent.category.LAUNCHER 1 >/dev/null
python3 - "$OUT" <<'PY'
import html, json, subprocess, sys, time, urllib.request
out = sys.argv[1]
news = json.load(urllib.request.urlopen('https://www.wartabiyetv.com/data/news.json?t=%d' % time.time()))['news']
news = sorted([n for n in news if n.get('published') is not False], key=lambda n: n['publishedAt'], reverse=True)
want = [n['title'][:22] for n in news[:6]]
print('website headlines:', want[:3])
seen = ''
for i in range(36):                      # up to 3 minutes
    time.sleep(5)
    subprocess.run(['adb', 'shell', 'uiautomator', 'dump', '/sdcard/ui.xml'], capture_output=True)
    seen = html.unescape(subprocess.run(['adb', 'shell', 'cat', '/sdcard/ui.xml'], capture_output=True, text=True).stdout)
    hit = [w for w in want if w in seen]
    if hit:
        print('the app shows the website headline:', hit[0])
        break
else:
    open(out + '/ui.xml', 'w').write(seen)
    sys.exit('the app did not show any of the newest website headlines')
open(out + '/ui.xml', 'w').write(seen)
PY
sleep 5
adb exec-out screencap -p > "$OUT/android-home.png"
adb shell pidof $PKG >/dev/null || { adb logcat -d | tail -200 > "$OUT/logcat.txt"; echo "the app is not running (crash)"; exit 1; }
adb logcat -d -b crash > "$OUT/crash.txt" || true
if grep -q "$PKG" "$OUT/crash.txt"; then cat "$OUT/crash.txt"; exit 1; fi
echo "Android app: installed, opened, shows the live website's news, no crash"
