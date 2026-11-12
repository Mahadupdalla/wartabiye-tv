"""Google AdSense Auto ads for the website (never the mobile app), from data/adsense.json.

data/adsense.json (edited in the admin: Advertising -> Google AdSense):
  publisherId  "pub-" + 16 digits, exactly as shown in the AdSense account (Account -> Settings -> Account information).
               Empty = AdSense is OFF: no Google code, no meta tag and no ads.txt are published. Nothing is invented.
  autoAds      true = load Google's official Auto ads code; false = only the site verification tag and ads.txt.
  pages        which kinds of page load the Auto ads code: home, sections (Soomaaliya, Caalamka, Ciyaaraha, Bariga
               Afrika, LIVE, videos), articles (war/<id>.html), info (Xayeysiimaha, About, Contact, policies).

What it writes:
  index.html   the block between <!--adsense--> and <!--/adsense--> in <head> (the homepage). tools/build_pages.py
               calls head_block() for every other page with its own kind.
  ads.txt      "google.com, pub-…, DIRECT, f08c47fec0942fa0" (Google's published line), only with a real publisher ID.

  python3 tools/build_adsense.py         write index.html and ads.txt
  python3 tools/build_adsense.py check   only validate data/adsense.json (exit 1 when invalid)"""
import json, os, re, sys

root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CFG_PATH = os.path.join(root, 'data', 'adsense.json')
KINDS = ('home', 'sections', 'articles', 'info')
PUB_RE = re.compile(r'^pub-\d{16}$')
# Google's own certification authority id for ads.txt (https://support.google.com/adsense/answer/12171612)
GOOGLE_TAG_ID = 'f08c47fec0942fa0'
START, END = '<!--adsense-->', '<!--/adsense-->'
ASSET_VERSION = '20261112as'


def load(path=CFG_PATH):
    try:
        cfg = json.load(open(path, encoding='utf-8'))
    except FileNotFoundError:
        cfg = {}
    return cfg if isinstance(cfg, dict) else {}


def errors(cfg):
    out = []
    pid = cfg.get('publisherId', '')
    if not isinstance(pid, str):
        out.append('publisherId must be text')
    elif pid and not PUB_RE.match(pid.strip()):
        out.append('publisherId must look like pub-1234567890123456 (16 digits), as shown in your AdSense account')
    if 'autoAds' in cfg and not isinstance(cfg['autoAds'], bool):
        out.append('autoAds must be true or false')
    pages = cfg.get('pages', {})
    if not isinstance(pages, dict) or any(k not in KINDS or not isinstance(v, bool) for k, v in pages.items()):
        out.append('pages must only contain ' + ', '.join(KINDS) + ' set to true or false')
    return out


def publisher(cfg):
    """the real publisher id, or '' (AdSense off) when it is missing or invalid"""
    pid = cfg.get('publisherId') if isinstance(cfg.get('publisherId'), str) else ''
    pid = pid.strip()
    return pid if PUB_RE.match(pid) else ''


def page_on(cfg, kind):
    pages = cfg.get('pages') if isinstance(cfg.get('pages'), dict) else {}
    return cfg.get('autoAds', True) is True and pages.get(kind, kind != 'info') is True


def head_block(cfg, kind):
    """the <head> block for one kind of page; empty markers when AdSense is off"""
    pid = publisher(cfg)
    if not pid:
        return START + END
    client = 'ca-' + pid
    pages = {k: page_on(cfg, k) for k in KINDS}
    lines = [START,
             f'<meta name="google-adsense-account" content="{client}">',
             '<script>window.WARTABIYE_ADS=' + json.dumps({'client': client, 'pages': pages}, separators=(',', ':')) + '</script>']
    if pages.get(kind):
        # Google's official Auto ads code, unchanged (https://support.google.com/adsense/answer/9274025)
        lines.append(f'<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client={client}" crossorigin="anonymous"></script>')
    lines.append(f'<script src="assets/ads.js?v={ASSET_VERSION}" defer></script>')
    lines.append(END)
    return '\n'.join(lines)


def apply(html, cfg, kind):
    a, b = html.find(START), html.find(END)
    assert a >= 0 and b > a, 'the <!--adsense--> markers are missing in index.html'
    return html[:a] + head_block(cfg, kind) + html[b + len(END):]


def ads_txt(cfg):
    pid = publisher(cfg)
    return f'google.com, {pid}, DIRECT, {GOOGLE_TAG_ID}\n' if pid else None


def main():
    cfg = load()
    bad = errors(cfg)
    if bad:
        print('data/adsense.json: ' + '; '.join(bad))
        sys.exit(1)
    if sys.argv[1:] == ['check']:
        print('data/adsense.json OK (' + ('publisher ' + publisher(cfg) if publisher(cfg) else 'AdSense off: no publisher ID yet') + ')')
        return
    ix = os.path.join(root, 'index.html')
    html = open(ix, encoding='utf-8').read()
    new = apply(html, cfg, 'home')
    if new != html:
        open(ix, 'w', encoding='utf-8').write(new)
    at = os.path.join(root, 'ads.txt')
    txt = ads_txt(cfg)
    if txt:
        if not os.path.exists(at) or open(at, encoding='utf-8').read() != txt:
            open(at, 'w', encoding='utf-8').write(txt)
    elif os.path.exists(at) and re.fullmatch(r'google\.com, pub-\d{16}, DIRECT, ' + GOOGLE_TAG_ID + r'\n?', open(at, encoding='utf-8').read()):
        os.remove(at)   # only the line this tool wrote; an ads.txt written by hand is never deleted
    print('AdSense: ' + ('publisher ' + publisher(cfg) + ', Auto ads ' + ', '.join(k for k in KINDS if page_on(cfg, k)) if txt else 'off (no publisher ID), nothing published'))


if __name__ == '__main__':
    main()
