"""Search-engine check of the built website files (no network, no JavaScript): what Googlebot receives in the HTML.
Run after tools/build_pages.py. Writes data/seo-report.json, which /admin/ -> SEO & website health shows.

  python3 tools/seo_audit.py            check, write data/seo-report.json, exit 1 when a hard error was found
  python3 tools/seo_audit.py --report   the same, but never fail (used by publish.yml, so a report never blocks the news)
  python3 tools/seo_audit.py test       self-test of the checks on the current files (used by check-news.yml)

Hard errors: invalid sitemap XML, a sitemap URL without a page, an old article in the Google News sitemap, an article
page without its headline / text / date / canonical / NewsArticle data, broken links between the site's own pages,
hreflang links that do not point back, duplicate titles, robots.txt blocking the site or missing the sitemaps.
Warnings: things to improve in the content itself (no body text, short description, small photo …).
Nothing here is a Google ranking or score: it only checks the website's own files."""
import json, os, re, sys, glob, datetime, html
import xml.etree.ElementTree as ET
from html.parser import HTMLParser
from urllib.parse import urljoin, urlparse, unquote

root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE = 'https://www.wartabiyetv.com/'
NS = {'s': 'http://www.sitemaps.org/schemas/sitemap/0.9', 'n': 'http://www.google.com/schemas/sitemap-news/0.9',
      'x': 'http://www.w3.org/1999/xhtml'}
LANGS = ('so', 'en', 'ar', 'fr', 'nl', 'it', 'de', 'tr', 'es')
errors, warnings = [], []
err = lambda where, msg: errors.append({'where': where, 'problem': msg})
warn = lambda where, msg: warnings.append({'where': where, 'problem': msg})


class Page(HTMLParser):
    """What a crawler sees in the raw HTML: head tags, structured data, visible headings and links."""

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.title, self.meta, self.links, self.ld, self.h1, self.times, self.imgs, self.hrefs = '', {}, [], [], [], [], [], []
        self.base, self.lang, self._in, self._buf, self._hidden = None, None, None, '', 0
        self.stack = []

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == 'html':
            self.lang = a.get('lang')
        if tag == 'base':
            self.base = a.get('href')
        if tag in ('div', 'section', 'main', 'article', 'nav', 'aside', 'span', 'p', 'figure', 'ul', 'li', 'header', 'footer', 'a', 'h1', 'h2', 'h3', 'h4'):
            hid = 'hidden' in a
            self.stack.append((tag, hid))
            self._hidden += hid
        if tag == 'meta':
            k = a.get('name') or a.get('property')
            if k:
                self.meta.setdefault(k, []).append(a.get('content') or '')
        elif tag == 'link':
            self.links.append(a)
        elif tag == 'script' and a.get('type') == 'application/ld+json':
            self._in, self._buf = 'ld', ''
        elif tag == 'title':
            self._in, self._buf = 'title', ''
        elif tag == 'h1' and not self._hidden:
            self._in, self._buf = 'h1', ''
        elif tag == 'time' and not self._hidden:
            self.times.append(a.get('datetime'))
        elif tag == 'img' and not self._hidden:
            self.imgs.append(a)
        if tag == 'a' and a.get('href') and not self._hidden:
            self.hrefs.append(a['href'])

    def handle_endtag(self, tag):
        if self.stack and tag == self.stack[-1][0]:
            self._hidden -= self.stack.pop()[1]
        if tag == 'script' and self._in == 'ld':
            self.ld.append(self._buf); self._in = None
        elif tag == 'title' and self._in == 'title':
            self.title = self._buf.strip(); self._in = None
        elif tag == 'h1' and self._in == 'h1':
            self.h1.append(re.sub(r'\s+', ' ', self._buf).strip()); self._in = None

    def handle_data(self, d):
        if self._in:
            self._buf += d


def parse_file(path):
    p = Page()
    p.feed(open(path, encoding='utf-8').read())
    return p


def url_to_file(u):
    """https://www.wartabiyetv.com/x/ -> x/index.html; None for other sites."""
    if not u.startswith(SITE):
        return None
    rel = unquote(urlparse(u).path.lstrip('/'))
    if rel == '' or rel.endswith('/'):
        rel += 'index.html'
    return os.path.join(root, rel)


def page_url(path):
    rel = os.path.relpath(path, root).replace(os.sep, '/')
    return SITE + (rel[:-len('index.html')] if rel.endswith('index.html') else rel)


def iso(s):
    try:
        d = datetime.datetime.fromisoformat(str(s).replace('Z', '+00:00'))
        return d if d.tzinfo else None
    except Exception:
        return None


def jsonld(p, where):
    out = []
    for raw in p.ld:
        try:
            o = json.loads(raw)
        except Exception as e:
            err(where, f'structured data is not valid JSON ({e})')
            continue
        out += o if isinstance(o, list) else (o.get('@graph') or [o])
    return out


def check_article(path, n, lang, seen_titles, seen_desc):
    where = os.path.relpath(path, root)
    p = parse_file(path)
    url = page_url(path)
    canon = [l.get('href') for l in p.links if l.get('rel') == 'canonical']
    if canon != [url]:
        err(where, f'canonical link is {canon}, expected {url}')
    if p.lang != lang:
        err(where, f'<html lang="{p.lang}">, expected {lang}')
    x = n if lang == 'so' else n.get(lang) or {}
    if not p.title or not p.title.startswith(str(x.get('title') or '').strip()[:40]):
        err(where, 'the <title> is not the article headline')
    seen_titles.setdefault(p.title, []).append(where)
    desc = (p.meta.get('description') or [''])[0]
    if not desc:
        err(where, 'no meta description')
    else:
        seen_desc.setdefault(desc, []).append(where)
        if len(desc) < 70:
            warn(where, f'short description ({len(desc)} characters)')
    if len(p.h1) != 1 or p.h1[0] != str(x.get('title') or '').strip():
        err(where, f'expected one visible <h1> with the headline, found {len(p.h1)}')
    for k in ('og:title', 'og:description', 'og:image', 'og:url', 'twitter:card', 'article:published_time'):
        if not p.meta.get(k):
            err(where, f'missing <meta {k}>')
    if not any(iso(t) for t in p.times):
        err(where, 'no visible publication date (<time datetime>)')
    robots = ' '.join(p.meta.get('robots') or [])
    if 'noindex' in robots:
        err(where, 'article page is noindex')
    if 'max-image-preview:large' not in robots:
        warn(where, 'robots meta without max-image-preview:large')
    for im in p.imgs:
        if im.get('alt') is None:
            err(where, f'image without alt attribute: {im.get("src")}')
    if n.get('image') and not any(n['image'] in (im.get('src') or '') for im in p.imgs):
        err(where, 'the article photo is not in the HTML')
    objs = jsonld(p, where)
    art = [o for o in objs if o.get('@type') in ('NewsArticle', 'AdvertiserContentArticle')]
    if len(art) != 1:
        err(where, f'expected one NewsArticle structured data block, found {len(art)}')
    else:
        a = art[0]
        for k in ('headline', 'datePublished', 'dateModified', 'image', 'author', 'publisher', 'mainEntityOfPage'):
            if not a.get(k):
                err(where, f'NewsArticle without "{k}"')
        if len(str(a.get('headline') or '')) > 110:
            err(where, 'NewsArticle headline longer than 110 characters')
        dp, dm = iso(a.get('datePublished')), iso(a.get('dateModified'))
        if not dp:
            err(where, f'datePublished is not an ISO 8601 date with time zone: {a.get("datePublished")}')
        elif a.get('datePublished') != n.get('publishedAt'):
            err(where, 'datePublished differs from the article\'s own publishedAt')
        if dp and dm and dm < dp:
            err(where, 'dateModified is before datePublished')
        au = a.get('author') or {}
        if not (isinstance(au, dict) and au.get('name') and au.get('url')):
            err(where, 'author needs a name and url')
        pub = a.get('publisher') or {}
        if not (pub.get('name') == 'Wartabiye TV' and (pub.get('logo') or {}).get('url')):
            err(where, 'publisher must be Wartabiye TV with its logo')
        imgs = a.get('image') or []
        for im in imgs:
            u = im.get('url') if isinstance(im, dict) else im
            if not str(u).startswith('https://'):
                err(where, f'structured data image is not an absolute https URL: {u}')
            if isinstance(im, dict) and im.get('width') and im['width'] < 1200:
                warn(where, f'photo is {im["width"]} px wide (Google recommends at least 1200 px for large previews)')
    bc = [o for o in objs if o.get('@type') == 'BreadcrumbList']
    if len(bc) != 1 or not all(i.get('item', '').startswith(SITE) for i in bc[0].get('itemListElement', [])):
        err(where, 'BreadcrumbList missing or with a link outside the site')
    if lang == 'so' and not str(n.get('body') or '').strip():
        warn(where, 'only a summary, no full article text (thin page)')
    if lang == 'so' and not n.get('imageAlt') and n.get('image'):
        warn(where, 'photo has no description (alt text) of its own')
    alts = {l.get('hreflang'): l.get('href') for l in p.links if l.get('rel') == 'alternate' and l.get('hreflang')}
    return p, url, alts


def check_links(path, p):
    """Links between the site's own pages must open a real file (search engines follow these)."""
    where = os.path.relpath(path, root)
    base = urljoin(page_url(path), p.base) if p.base else page_url(path)
    bad = []
    for h in p.hrefs:
        if h.startswith(('#', 'mailto:', 'tel:', 'javascript:')):
            continue
        u = urljoin(base, h).split('#')[0].split('?')[0]
        f = url_to_file(u)
        if f and not os.path.exists(f):
            bad.append(u.replace(SITE, '/'))
    for u in sorted(set(bad))[:20]:
        err(where, f'broken internal link: {u}')
    return len(bad)


def main(report_only=False):
    news = json.load(open(os.path.join(root, 'data', 'news.json'), encoding='utf-8'))['news']
    by_id = {n['id']: n for n in news}
    now = datetime.datetime.now(datetime.timezone.utc)
    try:
        seo = json.load(open(os.path.join(root, 'data', 'seo.json'), encoding='utf-8'))
    except Exception:
        seo = {}
    hours = int(seo.get('newsSitemapHours') or 48)
    # robots.txt
    rb = open(os.path.join(root, 'robots.txt'), encoding='utf-8').read() if os.path.exists(os.path.join(root, 'robots.txt')) else ''
    robots = {'present': bool(rb), 'sitemaps': re.findall(r'(?im)^sitemap:\s*(\S+)', rb),
              'blocksSite': bool(re.search(r'(?im)^disallow:\s*/\s*$', rb)), 'privateExcluded': '/admin/' in rb}
    if not rb:
        err('robots.txt', 'missing')
    if robots['blocksSite']:
        err('robots.txt', 'Disallow: / blocks the whole website')
    for sm in (SITE + 'sitemap.xml', SITE + 'news-sitemap.xml'):
        if sm not in robots['sitemaps']:
            err('robots.txt', f'does not list {sm}')
    # sitemaps
    sm_urls, sm_info = [], {'valid': False, 'urls': 0, 'articles': 0, 'translated': 0, 'missingFiles': 0}
    try:
        t = ET.parse(os.path.join(root, 'sitemap.xml')).getroot()
        sm_info['valid'] = True
        for u in t.findall('s:url', NS):
            loc = u.findtext('s:loc', '', NS).strip()
            sm_urls.append(loc)
            lm = u.findtext('s:lastmod', '', NS)
            if lm and not iso(lm):
                err('sitemap.xml', f'lastmod is not a full date and time with time zone: {loc} {lm}')
            if lm and iso(lm) and iso(lm) > now + datetime.timedelta(minutes=10):
                err('sitemap.xml', f'lastmod in the future: {loc} {lm}')
            f = url_to_file(loc)
            if not f or not os.path.exists(f):
                sm_info['missingFiles'] += 1
                err('sitemap.xml', f'URL without a page: {loc}')
            elif 'noindex' in open(f, encoding='utf-8').read(4000):
                err('sitemap.xml', f'noindex page listed: {loc}')
        sm_info['urls'] = len(sm_urls)
        sm_info['articles'] = sum(1 for u in sm_urls if re.search(r'/war/[^/]+\.html$', u) and not re.search(r'/[a-z]{2}/war/', u))
        sm_info['translated'] = sum(1 for u in sm_urls if re.search(r'/[a-z]{2}/war/', u))
        if len(sm_urls) != len(set(sm_urls)):
            err('sitemap.xml', 'the same URL is listed twice')
    except Exception as e:
        err('sitemap.xml', f'not valid XML ({e})')
    pub_ids = {n['id'] for n in news}
    listed = {re.sub(r'.*/war/([^/]+)\.html$', r'\1', u) for u in sm_urls if '/war/' in u}
    for i in sorted(pub_ids - listed)[:20]:
        err('sitemap.xml', f'published article missing: {i}')
    for i in sorted(listed - pub_ids)[:20]:
        err('sitemap.xml', f'lists an article that is not published: {i}')
    ns_info = {'valid': False, 'urls': 0, 'oldest': None, 'newest': None}
    try:
        t = ET.parse(os.path.join(root, 'news-sitemap.xml')).getroot()
        ns_info['valid'] = True
        dates = []
        for u in t.findall('s:url', NS):
            loc = u.findtext('s:loc', '', NS)
            d = iso(u.findtext('n:news/n:publication_date', '', NS))
            name = u.findtext('n:news/n:publication/n:name', '', NS)
            if not d:
                err('news-sitemap.xml', f'publication date missing or invalid: {loc}')
                continue
            dates.append(d)
            if now - d > datetime.timedelta(hours=hours, minutes=30):
                err('news-sitemap.xml', f'older than {hours} hours: {loc}')
            if name != 'Wartabiye TV' or not u.findtext('n:news/n:title', '', NS):
                err('news-sitemap.xml', f'publication name or title missing: {loc}')
            if loc not in sm_urls:
                err('news-sitemap.xml', f'not in sitemap.xml: {loc}')
        ns_info['urls'] = len(dates)
        if dates:
            ns_info['oldest'], ns_info['newest'] = min(dates).isoformat(), max(dates).isoformat()
    except Exception as e:
        err('news-sitemap.xml', f'not valid XML ({e})')
    # article pages (Somali and translated)
    seen_t, seen_d, alt_map = {}, {}, {}
    checked = links_bad = 0
    for path in sorted(glob.glob(os.path.join(root, 'war', '*.html')) + glob.glob(os.path.join(root, '[a-z][a-z]', 'war', '*.html'))):
        rel = os.path.relpath(path, root).replace(os.sep, '/')
        lang = rel.split('/')[0] if not rel.startswith('war/') else 'so'
        nid = os.path.basename(path)[:-5]
        if nid not in by_id:
            err(rel, 'page of an article that is not published')
            continue
        p, url, alts = check_article(path, by_id[nid], lang, seen_t, seen_d)
        alt_map[url] = alts
        links_bad += check_links(path, p)
        checked += 1
    for url, alts in alt_map.items():
        if alts and alts.get('x-default') is None:
            err(url, 'hreflang links without x-default')
        for l, u in alts.items():
            if l == 'x-default':
                continue
            if u not in alt_map:
                err(url, f'hreflang {l} points to a page that does not exist: {u}')
            elif url not in alt_map[u].values():
                err(url, f'hreflang {l} page does not link back: {u}')
    for t, w in seen_t.items():
        if len(w) > 1:
            err(w[0], f'duplicate <title> on {len(w)} pages: {t[:80]}')
    for d, w in seen_d.items():
        if len(w) > 1:
            warn(w[0], f'the same description on {len(w)} pages')
    # text that only makes sense while the page is loading must never be in the HTML: crawlers and AI tools that read
    # the raw page (and ignore `hidden`) would report it as the site's content
    for path in [os.path.join(root, 'index.html')] + glob.glob(os.path.join(root, '*', 'index.html')) + glob.glob(os.path.join(root, 'war', '*.html'))[:50]:
        t = open(path, encoding='utf-8').read()
        for ph in ('Weli war lama dhigin', 'ayaa soo dhacaya'):
            if ph in t:
                err(os.path.relpath(path, root), f'placeholder text in the HTML: "{ph}"')
    # homepage and section pages
    other = [os.path.join(root, 'index.html')] + sorted(glob.glob(os.path.join(root, '*', 'index.html')) + glob.glob(os.path.join(root, 'qayb', '*', 'index.html')))
    other = [f for f in other if not re.search(r'/(admin|app|mobile|workers|tools|api|data|img|assets)/', f.replace(os.sep, '/'))]
    home = None
    for path in other:
        rel = os.path.relpath(path, root)
        p = parse_file(path)
        robots_meta = ' '.join(p.meta.get('robots') or [])
        if 'noindex' in robots_meta:
            continue  # redirect pages (e.g. the old Ciyaaraha Toos address)
        canon = [l.get('href') for l in p.links if l.get('rel') == 'canonical']
        if canon != [page_url(path)]:
            err(rel, f'canonical link is {canon}, expected {page_url(path)}')
        if not p.title or not (p.meta.get('description') or [''])[0]:
            err(rel, 'missing title or description')
        seen_t.setdefault(p.title, []).append(rel)
        if len(seen_t[p.title]) > 1:
            err(rel, f'duplicate <title>: {p.title}')
        links_bad += check_links(path, p)
        jsonld(p, rel)
        if rel == 'index.html':
            home = p
    home_info = {}
    if home:
        arts = [h for h in home.hrefs if re.match(r'^war/[^/]+\.html$', h)]
        types = [o.get('@type') for o in jsonld(home, 'index.html')]
        home_info = {'title': home.title, 'articleLinks': len(set(arts)), 'structuredData': types,
                     'verificationMeta': len(home.meta.get('google-site-verification') or [])}
        if len(set(arts)) < 10:
            err('index.html', f'only {len(set(arts))} article links in the HTML (search engines need real links to the news)')
        for t in ('NewsMediaOrganization', 'WebSite'):
            if t not in types:
                err('index.html', f'{t} structured data missing')
    # Search Console verification methods present in the website files
    files = sorted(os.path.basename(f) for f in glob.glob(os.path.join(root, 'google*.html'))
                   if re.fullmatch(r'google-site-verification: google[0-9a-f]+\.html', open(f, encoding='utf-8').read().strip()))
    rep = {
        'basedOn': max((n.get('updatedAt') or n.get('publishedAt') or '' for n in news), default=''),
        'note': 'Checks of the website files as Googlebot receives them (HTML without JavaScript). Not a Google ranking or score.',
        'robots': robots, 'sitemap': sm_info, 'newsSitemap': ns_info, 'home': home_info,
        'articles': {'published': len(news), 'pagesChecked': checked, 'withoutBody': sum(1 for n in news if not str(n.get('body') or '').strip()),
                     'withoutAlt': sum(1 for n in news if n.get('image') and not n.get('imageAlt')),
                     'withoutImage': sum(1 for n in news if not n.get('image'))},
        'translations': {'mode': seo.get('translatedPages', 'reviewed'), 'pages': sm_info.get('translated', 0)},
        'brokenInternalLinks': links_bad,
        'verification': {'htmlFiles': files, 'metaTags': home_info.get('verificationMeta', 0),
                         'property': (seo.get('searchConsole') or {}).get('property'), 'dnsTxt': 'checked in Search Console (not visible to the website files)'},
        'errors': errors[:200], 'errorCount': len(errors), 'warnings': warnings[:200], 'warningCount': len(warnings),
    }
    new = json.dumps(rep, ensure_ascii=False, indent=1) + '\n'
    out = os.path.join(root, 'data', 'seo-report.json')
    if not os.path.exists(out) or open(out, encoding='utf-8').read() != new:
        open(out, 'w', encoding='utf-8').write(new)
    print(f'SEO check: {checked} article pages, sitemap {sm_info["urls"]} URLs, news sitemap {ns_info["urls"]} URLs, '
          f'{home_info.get("articleLinks")} article links on the homepage, {len(errors)} errors, {len(warnings)} warnings')
    for e in errors[:30]:
        print('ERROR', e['where'], '-', e['problem'])
    return 0 if report_only or not errors else 1


def selftest():
    # the parser sees only what a crawler sees: hidden blocks do not count as the page's headline
    p = Page(); p.feed('<html lang="so"><div hidden><h1>x</h1></div><article><h1>Cinwaan</h1><time datetime="2026-11-12T10:00:00+03:00">t</time></article></html>')
    assert p.h1 == ['Cinwaan'] and p.lang == 'so' and p.times, p.h1
    assert url_to_file(SITE + 'soomaaliya/').endswith('soomaaliya/index.html') and url_to_file('https://example.com/') is None
    assert iso('2026-11-12T10:00:00+03:00') and not iso('2026-11-12')
    rc = main(report_only=False)
    print('seo_audit self-test OK' if rc == 0 else 'seo_audit self-test: the website files have SEO errors')
    return rc


if __name__ == '__main__':
    if 'test' in sys.argv[1:]:
        sys.exit(selftest())
    sys.exit(main(report_only='--report' in sys.argv[1:]))
