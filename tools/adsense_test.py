"""Tests for Google AdSense on the website (tools/build_adsense.py, assets/ads.js, the page builder). No network.
   python3 tools/adsense_test.py
Checks: data/adsense.json is valid; with no publisher ID nothing from Google is published (no code, no meta tag,
no ads.txt); with an example ID every kind of page gets the verification tag and only enabled kinds load the official
Auto ads code; ads.txt has Google's published line; invalid IDs are refused; the mobile app is not touched."""
import os, re, sys, tempfile, shutil, subprocess

root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(root, 'tools'))
import build_adsense as B  # noqa: E402

fails = []


def ok(cond, msg):
    if not cond:
        fails.append(msg)


EXAMPLE = 'pub-0000000000000000'   # test value only, never written to the repository
cfg = B.load()
ok(not B.errors(cfg), 'data/adsense.json is invalid: ' + '; '.join(B.errors(cfg)))

# 1. the real file: off until a real ID is saved, and then exactly what the config says
html = open(os.path.join(root, 'index.html'), encoding='utf-8').read()
ok(html.count(B.START) == 1 and html.count(B.END) == 1, 'index.html must contain the <!--adsense--> markers once')
ok(html.index(B.START) < html.index('</head>'), 'the AdSense block must be inside <head>')
ok(B.apply(html, cfg, 'home') == html, 'index.html is not up to date with data/adsense.json: run python3 tools/build_adsense.py')
if not B.publisher(cfg):
    ok('googlesyndication' not in html and 'google-adsense-account' not in html, 'Google code on the homepage without a publisher ID')
    ok(B.head_block(cfg, 'articles') == B.START + B.END, 'AdSense block must be empty without a publisher ID')
    ok(B.ads_txt(cfg) is None, 'ads.txt must not be written without a publisher ID')
    at = os.path.join(root, 'ads.txt')
    ok(not os.path.exists(at) or 'pub-' not in open(at, encoding='utf-8').read() or B.publisher(cfg) in open(at, encoding='utf-8').read(),
       'ads.txt names a publisher that is not in data/adsense.json')

# 2. validation: only "pub-" + 16 digits; anything else stays off
for bad in ('ca-pub-123', 'pub-12345', 'pub-00000000000000001', 'xyz', 123):
    ok(B.errors({'publisherId': bad}), f'publisherId {bad!r} should be refused')
    ok(B.head_block({'publisherId': bad}, 'home') == B.START + B.END, f'invalid publisherId {bad!r} must publish nothing')
ok(not B.errors({'publisherId': EXAMPLE}), 'a valid publisherId is refused')
ok(B.errors({'pages': {'everywhere': True}}), 'unknown page kinds should be refused')
ok(B.errors({'autoAds': 'yes'}), 'autoAds must be true/false')

# 3. with an example ID
c = {'publisherId': EXAMPLE, 'autoAds': True, 'pages': {'home': True, 'sections': True, 'articles': True, 'info': False}}
CODE = f'<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-{EXAMPLE}" crossorigin="anonymous"></script>'
for kind in B.KINDS:
    blk = B.head_block(c, kind)
    ok(f'<meta name="google-adsense-account" content="ca-{EXAMPLE}">' in blk, f'{kind}: verification meta tag missing')
    ok((CODE in blk) == (kind != 'info'), f'{kind}: Auto ads code should be {"on" if kind != "info" else "off"}')
    ok('assets/ads.js' in blk, f'{kind}: assets/ads.js missing')
ok(B.ads_txt(c) == f'google.com, {EXAMPLE}, DIRECT, f08c47fec0942fa0\n', 'ads.txt line is wrong')
off = dict(c, autoAds=False)
ok(all(CODE not in B.head_block(off, k) and 'google-adsense-account' in B.head_block(off, k) for k in B.KINDS),
   'autoAds false must keep only the verification tag')
ok(B.ads_txt(off), 'ads.txt is still needed with Auto ads paused')

# 4. the whole page build in a copy of the site, with the example ID: every page kind gets the right block
tmp = tempfile.mkdtemp()
try:
    dst = os.path.join(tmp, 'site')
    shutil.copytree(root, dst, ignore=shutil.ignore_patterns('.git', 'node_modules', 'mobile', 'app', 'api', 'workers', 'img'))
    import json
    json.dump(c, open(os.path.join(dst, 'data', 'adsense.json'), 'w'))
    for cmd in (['python3', 'tools/build_adsense.py'], ['python3', 'tools/build_pages.py']):
        r = subprocess.run(cmd, cwd=dst, capture_output=True, text=True)
        ok(r.returncode == 0, ' '.join(cmd) + ' failed: ' + r.stderr[-400:])
    rd = lambda p: open(os.path.join(dst, p), encoding='utf-8').read()
    ok(CODE in rd('index.html'), 'homepage: Auto ads code missing')
    ok(rd('ads.txt').startswith(f'google.com, {EXAMPLE}, DIRECT'), 'ads.txt not written')
    for p in ('soomaaliya/index.html', 'caalamka/index.html', 'ciyaaraha/index.html'):
        ok(CODE in rd(p), p + ': Auto ads code missing')
    for p in ('xayeysiimaha/index.html', 'asturnaanta/index.html', 'xiriir/index.html'):
        ok(CODE not in rd(p) and 'google-adsense-account' in rd(p), p + ': info pages should only have the verification tag')
    arts = [f for f in os.listdir(os.path.join(dst, 'war')) if f.endswith('.html')]
    ok(arts and all(CODE in rd('war/' + f) for f in arts[:50]), 'article pages: Auto ads code missing')
    ok(all(rd('war/' + f).count(B.START) == 1 for f in arts[:50]), 'article pages: AdSense block repeated')
    # back to no ID: everything is removed again, ads.txt too
    json.dump({'publisherId': '', 'autoAds': True}, open(os.path.join(dst, 'data', 'adsense.json'), 'w'))
    for cmd in (['python3', 'tools/build_adsense.py'], ['python3', 'tools/build_pages.py']):
        subprocess.run(cmd, cwd=dst, capture_output=True, text=True)
    ok(not os.path.exists(os.path.join(dst, 'ads.txt')), 'ads.txt not removed when the ID is cleared')
    ok('googlesyndication' not in rd('index.html') and 'googlesyndication' not in rd('war/' + arts[0]), 'Google code not removed when the ID is cleared')
finally:
    shutil.rmtree(tmp, ignore_errors=True)

# 5. ads.js never touches ads themselves, and the mobile app has no AdSense
js = open(os.path.join(root, 'assets', 'ads.js'), encoding='utf-8').read()
ok('.click(' not in js and 'adsbygoogle.push' not in js and 'style.display' not in js, 'assets/ads.js must not click, create or hide ads')
for d in ('mobile', 'app'):
    for dp, _, fs in os.walk(os.path.join(root, d)):
        if 'node_modules' in dp:
            continue
        for f in fs:
            if f.endswith(('.js', '.ts', '.tsx', '.json', '.html')):
                try:
                    t = open(os.path.join(dp, f), encoding='utf-8', errors='ignore').read()
                except OSError:
                    continue
                ok('googlesyndication' not in t and 'ca-pub-' not in t, f'{os.path.relpath(os.path.join(dp, f), root)}: AdSense must not be in the mobile app')

if fails:
    print('AdSense test FAILED:\n- ' + '\n- '.join(fails))
    sys.exit(1)
print('AdSense test OK (' + ('publisher ' + B.publisher(cfg) if B.publisher(cfg) else 'off until a real publisher ID is saved') + ')')
