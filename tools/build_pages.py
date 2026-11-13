"""Build search-engine friendly pages from index.html. Run after tools/build_news.py (publish.yml does, after every save).

Everything Google needs is in the HTML itself, so search engines do not depend on JavaScript to see the news:
- index.html (homepage): the top headlines, the newest Somalia & East Africa stories, World and Sports blocks and the
  footer links are written into the page as real <a href="war/<id>.html"> links (between <!--pre:…--> markers).
  assets/app.js draws the same page again when it starts, so visitors see no difference.
- war/<id>.html: one page per published article: unique <title>, description, canonical link, Open Graph / X tags,
  NewsArticle + BreadcrumbList structured data and the whole article in the HTML: breadcrumbs, headline, visible
  publication (and update) date, photo with alt text and credit, full text and related-article links.
  Pages of deleted or unpublished articles are removed.
- <lang>/war/<id>.html: a translated article page, only for translations allowed by data/seo.json "translatedPages"
  ("reviewed" = only translations the owner wrote or corrected in /admin/ (status "manual"), "all" = every complete
  translation, "off" = none). Each one has its own language, canonical and hreflang links to the other versions.
  Untranslated or out-of-date translations are never published as their own page.
- <section>/index.html (Soomaaliya, Bariga Afrika, Caalamka, Ciyaaraha, LIVE …, About, Contact, policies) and
  qayb/<category>/index.html, with the newest stories of that section as real links.
- kaydka/index.html: the archive, every published article by day (an HTML sitemap for readers and crawlers).
- sitemap.xml (every public page, real modification times, photos, language alternates), news-sitemap.xml (Google
  News: only articles published in the last 48 hours) and rss.xml (newest 30 articles).
Dates are never invented: every date comes from the article's own publishedAt / updatedAt."""
import json, os, glob, html, datetime, re, sys, subprocess
from email.utils import format_datetime
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE_URL = 'https://www.wartabiyetv.com/'
esc = lambda s: html.escape(str(s or ''), quote=True)
EAT = datetime.timezone(datetime.timedelta(hours=3))
LANGS = ('en', 'ar', 'fr', 'nl', 'it', 'de', 'tr', 'es')

tpl = open(os.path.join(root, 'index.html'), encoding='utf-8').read()
a, b = tpl.index('<!--seo-->'), tpl.index('<!--/seo-->') + len('<!--/seo-->')
assert '<!--story-->' in tpl, 'story marker missing in index.html'
REGIONS = ('mosaic', 'list', 'blocks', 'ftrend', 'fcats', 'tick')


def region(page, name, content=''):
    s, e = f'<!--pre:{name}-->', f'<!--/pre:{name}-->'
    i, j = page.find(s), page.find(e)
    assert i >= 0 and j > i, f'{s} marker missing in index.html'
    return page[:i + len(s)] + content + page[j:]


for _r in REGIONS:  # the template itself never carries the previous build's homepage content
    tpl = region(tpl, _r)
tpl = tpl.replace('id="mosaicHead">', 'id="mosaicHead" hidden>', 1)
tpl = re.sub(r'<h2 id="listTitle"[^>]*>.*?</h2>', '<h2 id="listTitle" data-i18n="latest">Wararka cusub</h2>', tpl, count=1)
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import build_adsense  # noqa: E402  Google AdSense Auto ads per kind of page (data/adsense.json; off without a publisher ID)
ADSENSE = build_adsense.load()
news = json.load(open(os.path.join(root, 'data', 'news.json'), encoding='utf-8'))['news']
pages = json.load(open(os.path.join(root, 'data', 'pages.json'), encoding='utf-8'))
try:
    SEO = json.load(open(os.path.join(root, 'data', 'seo.json'), encoding='utf-8'))
except Exception:
    SEO = {}
TR_MODE = SEO.get('translatedPages', 'reviewed')
NEWS_HOURS = int(SEO.get('newsSitemapHours') or 48)
try:
    SITE = json.load(open(os.path.join(root, 'data', 'site.json'), encoding='utf-8'))
except Exception:
    SITE = {}
LOGO = SITE_URL + 'img/logo.png'
ORG_ID = SITE_URL + '#organization'
SAME_AS = ['https://www.facebook.com/share/18bkUUeoJx/?mibextid=wwXIfr', 'https://www.youtube.com/@WarTabiye-channel',
           'https://www.tiktok.com/@wartabiyetv']
PUBLISHER = {'@type': 'NewsMediaOrganization', '@id': ORG_ID, 'name': 'Wartabiye TV', 'url': SITE_URL,
             'logo': {'@type': 'ImageObject', 'url': LOGO, 'width': 512, 'height': 512}, 'sameAs': SAME_AS,
             'publishingPrinciples': SITE_URL + 'anshaxa/', 'correctionsPolicy': SITE_URL + 'saxitaannada/'}
ROBOTS = '<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1">\n'


# interface words (assets/i18n.js) for the prerendered pages; Somali fallback when node is not available
def load_i18n():
    try:
        out = subprocess.run(['node', '-e', 'global.window=global;require(process.argv[1]);process.stdout.write(JSON.stringify(window.WT_I18N))',
                              os.path.join(root, 'assets', 'i18n.js')], capture_output=True, text=True, timeout=60, check=True).stdout
        return json.loads(out)
    except Exception:
        return {}


I18N = load_i18n()
SO_WORDS = {'home': 'Hoyga', 'somaliaNav': 'Soomaaliya', 'eastAfrica': 'Bariga Afrika', 'world': 'Caalamka', 'sports': 'Ciyaaraha',
            'related': 'Wararka la xiriira', 'photo': 'Sawirka', 'back': '← Ku noqo bogga hore', 'seeAll': 'Dhammaan',
            'pubBy': 'Waxaa daabacay Wartabiye TV', 'wroteBy': 'Wartabiye TV ayaa qortay', 'srcLabel': 'Isha',
            'illus': 'Sawir muujin ah', 'latestWorld': 'Wararka Caalamka', 'latestSports': 'Wararka Ciyaaraha', 'categories': 'Qaybaha',
            'latestShort': 'Ugu dambeeyay', 'updatedWord': 'La cusbooneysiiyay'}


def T(key, lang='so'):
    d = I18N.get(lang) or {}
    v = d.get(key)
    if isinstance(v, str) and v.strip():
        return v
    v = (I18N.get('so') or {}).get(key)
    return v if isinstance(v, str) and v.strip() else SO_WORDS.get(key, key)


CATN = {'en': {'Siyaasadda': 'Politics', 'Amniga': 'Security', 'Bulshada': 'Society', 'Dhaqaalaha': 'Economy', 'Adduunka': 'World', 'Ciyaaraha': 'Sports'},
        'ar': {'Siyaasadda': 'سياسة', 'Amniga': 'أمن', 'Bulshada': 'مجتمع', 'Dhaqaalaha': 'اقتصاد', 'Adduunka': 'العالم', 'Ciyaaraha': 'رياضة'},
        'fr': {'Siyaasadda': 'Politique', 'Amniga': 'Sécurité', 'Bulshada': 'Société', 'Dhaqaalaha': 'Économie', 'Adduunka': 'Monde', 'Ciyaaraha': 'Sport'},
        'nl': {'Siyaasadda': 'Politiek', 'Amniga': 'Veiligheid', 'Bulshada': 'Samenleving', 'Dhaqaalaha': 'Economie', 'Adduunka': 'Wereld', 'Ciyaaraha': 'Sport'},
        'it': {'Siyaasadda': 'Politica', 'Amniga': 'Sicurezza', 'Bulshada': 'Società', 'Dhaqaalaha': 'Economia', 'Adduunka': 'Mondo', 'Ciyaaraha': 'Sport'},
        'de': {'Siyaasadda': 'Politik', 'Amniga': 'Sicherheit', 'Bulshada': 'Gesellschaft', 'Dhaqaalaha': 'Wirtschaft', 'Adduunka': 'Welt', 'Ciyaaraha': 'Sport'},
        'tr': {'Siyaasadda': 'Siyaset', 'Amniga': 'Güvenlik', 'Bulshada': 'Toplum', 'Dhaqaalaha': 'Ekonomi', 'Adduunka': 'Dünya', 'Ciyaaraha': 'Spor'},
        'es': {'Siyaasadda': 'Política', 'Amniga': 'Seguridad', 'Bulshada': 'Sociedad', 'Dhaqaalaha': 'Economía', 'Adduunka': 'Mundo', 'Ciyaaraha': 'Deportes'}}
CATS = [c for c in (SITE.get('categories') or []) if isinstance(c, str)] or ['Siyaasadda', 'Amniga', 'Bulshada', 'Dhaqaalaha', 'Adduunka', 'Ciyaaraha']
cat_name = lambda k, lang='so': (CATN.get(lang) or {}).get(k, k) if lang != 'so' else k
slug = lambda c: str(c or '').lower()
DAYS = ['Isniin', 'Talaado', 'Arbaco', 'Khamiis', 'Jimce', 'Sabti', 'Axad']  # Python weekday(): Monday = 0
MONTHS = ['Janaayo', 'Febraayo', 'Maarso', 'Abriil', 'Maajo', 'Juun', 'Luulyo', 'Ogost', 'Sebtembar', 'Oktoobar', 'Nofembar', 'Desembar']


def parse(s):
    try:
        d = datetime.datetime.fromisoformat(str(s).replace('Z', '+00:00'))
        return d if d.tzinfo else d.replace(tzinfo=EAT)
    except Exception:
        return None


def show_date(s, lang='so', with_time=True):
    d = parse(s)
    if not d:
        return ''
    d = d.astimezone(EAT)
    if lang == 'so':
        t = f'{DAYS[d.weekday()]}, {d.day} {MONTHS[d.month - 1]} {d.year}'
    else:
        t = d.strftime('%d.%m.%Y')
    return t + (d.strftime(' · %H:%M') + ' (EAT)' if with_time else '')


def section(n):
    s = n.get('section')
    if s in ('sports', 'world', 'somalia'):
        return s
    return 'sports' if n.get('category') == 'Ciyaaraha' else 'world' if n.get('category') == 'Adduunka' else 'somalia'


def section_link(n):
    s = section(n)
    if s == 'sports':
        return 'ciyaaraha/', 'sports'
    if s == 'world':
        return 'caalamka/', 'world'
    return ('soomaaliya/', 'somaliaNav') if n.get('country') == 'so' else ('bariga-afrika/', 'eastAfrica')


def describe(text, limit=200):
    """A meta description: the article's own summary, cut at a word boundary (never mid-word)."""
    t = re.sub(r'\s+', ' ', str(text or '')).strip()
    if len(t) <= limit:
        return t
    cut = t[:limit].rsplit(' ', 1)[0].rstrip(',;:–-')
    return cut + '…'


# real photo sizes (width/height attributes stop the layout from jumping, and Google wants them for large previews)
try:
    from PIL import Image
except Exception:  # pragma: no cover
    Image = None
_sizes = {}


def img_size(rel):
    if not rel or Image is None:
        return None
    if rel not in _sizes:
        try:
            with Image.open(os.path.join(root, rel)) as im:
                _sizes[rel] = im.size
        except Exception:
            _sizes[rel] = None
    return _sizes[rel]


def img_url(rel):
    if not rel:
        return ''
    return rel if rel.startswith('https://') else SITE_URL + rel.lstrip('/')


def ld(obj):
    return '<script type="application/ld+json">' + json.dumps(obj, ensure_ascii=False).replace('</', '<\\/') + '</script>\n'


def head(title, desc, url, img, kind='website', extra='', img_alt='', size=None, robots=True):
    big = img != LOGO
    s = (f'<title>{esc(title)}</title>\n<meta name="description" content="{esc(desc)}">\n'
         f'<link rel="canonical" href="{url}">\n' + (ROBOTS if robots else '') +
         f'<meta property="og:site_name" content="Wartabiye TV">\n<meta property="og:type" content="{kind}">\n'
         f'<meta property="og:url" content="{url}">\n<meta property="og:title" content="{esc(title)}">\n'
         f'<meta property="og:description" content="{esc(desc)}">\n<meta property="og:image" content="{esc(img)}">\n')
    if size:
        s += f'<meta property="og:image:width" content="{size[0]}">\n<meta property="og:image:height" content="{size[1]}">\n'
    if img_alt:
        s += f'<meta property="og:image:alt" content="{esc(img_alt)}">\n'
    s += (f'<meta name="twitter:card" content="{"summary_large_image" if big else "summary"}">\n'
          f'<meta name="twitter:title" content="{esc(title)}">\n<meta name="twitter:description" content="{esc(desc)}">\n'
          f'<meta name="twitter:image" content="{esc(img)}">\n')
    if img_alt:
        s += f'<meta name="twitter:image:alt" content="{esc(img_alt)}">\n'
    return s + extra


def write(path, page, wanted):
    wanted.add(path)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    if not os.path.exists(path) or open(path, encoding='utf-8').read() != page:
        open(path, 'w', encoding='utf-8').write(page)


def subpage(seo, pre=None, show='storyView', kind='articles', base='../', lang='so', home_pre=None):
    page = build_adsense.apply(tpl[:a] + seo + tpl[b:], ADSENSE, kind)
    if lang != 'so':
        page = page.replace('<html lang="so">', f'<html lang="{lang}"{" dir=\"rtl\"" if lang == "ar" else ""}>', 1)
    # all relative links (img/, data/, assets/, war/ …) resolve from the site root
    page = page.replace('<meta charset="utf-8">', f'<meta charset="utf-8">\n<base href="{base}">', 1)
    if show != 'homeView':
        page = page.replace('<div id="homeView">', '<div id="homeView" hidden>', 1)
    if show == 'storyView':
        page = page.replace('<div id="storyView" hidden>', '<div id="storyView">', 1)
        page = page.replace('<!--story-->', pre or '', 1)
    elif show == 'pageView':
        page = page.replace('<div id="pageView" hidden></div>', f'<div id="pageView">{pre or ""}</div>', 1)
    else:  # a category page: the home layout with only the list
        page = page.replace('<div class="mosaic" id="mosaic">', '<div class="mosaic" id="mosaic" hidden>', 1)
        for k, v in (home_pre or {}).items():
            page = region(page, k, v)
    page = region(page, 'ftrend', FOOT_TREND)
    page = region(page, 'fcats', FOOT_CATS)
    page = region(page, 'tick', TICK)
    return page


# ---------- prerendered pieces (same classes as assets/app.js, so the page does not jump when the app takes over) ----------
art_href = lambda n: f'war/{n["id"]}.html'


def ph(n, big=False, hero=False, lang='so'):
    full, small = n.get('image') or '', n.get('thumb') or ''
    src = full if big else (small or full)
    alt = (n.get(lang) or {}).get('imageAlt') if lang != 'so' and isinstance(n.get(lang), dict) else None
    alt = alt or n.get('imageAlt') or n.get('title') or ''
    if not src:
        return f'<span class="ph s-{section(n)} none"></span>'
    size = img_size(src)
    wh = f' width="{size[0]}" height="{size[1]}"' if size else ''
    extra = ' loading="eager" fetchpriority="high"' if hero else ' loading="lazy"'
    srcset = ''
    if small and full and small != full:
        sizes = '(max-width:1000px) 100vw, 860px' if big else '(max-width:640px) 92vw, (max-width:1000px) 46vw, 320px'
        srcset = f' srcset="{esc(small)} 480w, {esc(full)} 1200w" sizes="{sizes}"'
    return (f'<span class="ph s-{section(n)}{" hero" if hero else ""}"><img src="{esc(src)}"{srcset} alt="{esc(alt)}"{wh}'
            f' decoding="async"{extra}>' + (f'<span class="illus">{esc(T("illus", lang))}</span>' if n.get('imageKind') == 'illustrative' else '') + '</span>')


def meta_line(n, lang='so'):
    p = n.get('publishedAt')
    return (f'<div class="meta"><b>Wartabiye TV</b><time class="dot" datetime="{esc(p)}">{esc(show_date(p, lang))}</time></div>'
            if parse(p) else '<div class="meta"><b>Wartabiye TV</b></div>')


def cat_tag(n, lang='so'):
    s = section(n)
    if s in ('sports', 'world'):
        return f'<span class="cat">{esc(T(s, lang))}</span>'
    return f'<span class="cat">{esc(cat_name(n.get("category"), lang))}</span>' if n.get('category') else ''


def row(n):
    return (f'<article class="row"><a href="{art_href(n)}" tabindex="-1" aria-hidden="true">{ph(n)}</a><div class="tx">'
            f'<h3><a href="{art_href(n)}">{esc(n.get("title"))}</a></h3>{meta_line(n)}'
            + (f'<p>{esc(n.get("summary"))}</p>' if n.get('summary') else '') + '</div></article>')


def card(n, lead=False):
    return (f'<a class="card{" lead" if lead else ""}" href="{art_href(n)}">{ph(n, big=lead)}<div class="cb">'
            f'<h3>{esc(n.get("title"))}</h3>' + (f'<p>{esc(n.get("summary"))}</p>' if n.get('summary') else '') + f'{meta_line(n)}</div></a>')


def tile(n, big=False):
    inner = cat_tag(n) + (f'<h2>{esc(n.get("title"))}</h2>' + (f'<p>{esc(n.get("summary"))}</p>' if n.get('summary') else '') + meta_line(n)
                          if big else f'<h3>{esc(n.get("title"))}</h3>')
    return f'<a class="tile{" big" if big else ""}" href="{art_href(n)}">{ph(n, big=big, hero=big)}<span class="in">{inner}</span></a>'


public = [n for n in news if not n.get('_preview')]
by_id = {n['id']: n for n in public}
FOOT_TREND = ''.join(f'<a href="{art_href(n)}"><span>{esc(n.get("title"))}</span><small>{esc(show_date(n.get("publishedAt"), "so", False))}</small></a>' for n in public[:3])
# the DEGDEG ticker: the newest headlines as real links (never a "loading" placeholder in the HTML)
TICK = ''.join(f'<a href="{art_href(n)}">{esc(n.get("title"))}</a>' for n in [x for x in public if not x.get('sponsored')][:8])
FOOT_CATS = ''.join(f'<a href="qayb/{slug(k)}/">{esc(k)}<span>{sum(1 for n in public if n.get("category") == k)}</span></a>' for k in CATS)

# ---------- translations that may have their own page ----------


def tr_ok(n, lang):
    x = n.get(lang)
    if TR_MODE not in ('reviewed', 'all') or not isinstance(x, dict) or n.get('sponsored'):
        return False
    if not (str(x.get('title') or '').strip() and str(x.get('summary') or '').strip()):
        return False
    if str(n.get('body') or '').strip() and not str(x.get('body') or '').strip():
        return False  # only the summary was translated: not a real translated article
    if lang in (n.get('translationsBehind') or []):
        return False  # the Somali text changed after this translation was made
    return TR_MODE == 'all' or x.get('status') == 'manual'


def page_url(n, lang='so'):
    return f'{SITE_URL}war/{n["id"]}.html' if lang == 'so' else f'{SITE_URL}{lang}/war/{n["id"]}.html'


def related(n, k=6):
    s, c = section(n), n.get('category')
    pool = [x for x in public if x is not n and not x.get('sponsored') and section(x) == s]
    first = [x for x in pool if x.get('category') == c]
    return (first + [x for x in pool if x not in first])[:k]


# ---------- 1. article pages ----------
out_dir = os.path.join(root, 'war')
wanted, tr_wanted = set(), set()
tr_pages = {}  # id -> [lang, …] (translated pages that exist)
for n in public:
    langs = [l for l in LANGS if tr_ok(n, l)]
    if langs:
        tr_pages[n['id']] = langs

for n in public:
    nid = n['id']
    langs = tr_pages.get(nid, [])
    alts = ''
    if langs:
        alts = (f'<link rel="alternate" hreflang="so" href="{page_url(n)}">\n'
                + ''.join(f'<link rel="alternate" hreflang="{l}" href="{page_url(n, l)}">\n' for l in langs)
                + f'<link rel="alternate" hreflang="x-default" href="{page_url(n)}">\n')
    for lang in ['so'] + langs:
        x = n if lang == 'so' else n[lang]
        url = page_url(n, lang)
        title, summary = str(x.get('title') or ''), str(x.get('summary') or '')
        body = str(x.get('body') or '')
        desc = describe(summary or body or title)
        img = img_url(n.get('image')) or LOGO
        size = img_size(n.get('image')) if n.get('image') else None
        alt = str(x.get('imageAlt') or n.get('imageAlt') or title)
        pub, mod = n.get('publishedAt'), n.get('updatedAt') or n.get('publishedAt')
        sec_href, sec_key = section_link(n)
        crumbs = [(T('home', lang), SITE_URL), (T(sec_key, lang), SITE_URL + sec_href)]
        if n.get('category') and section(n) == 'somalia':
            crumbs.append((cat_name(n['category'], lang), f'{SITE_URL}qayb/{slug(n["category"])}/'))
        crumbs.append((title, url))
        art = {'@context': 'https://schema.org', '@type': 'NewsArticle', 'headline': title[:110], 'description': desc,
               'datePublished': pub, 'dateModified': mod, 'inLanguage': lang, 'mainEntityOfPage': {'@type': 'WebPage', '@id': url},
               'url': url, 'articleSection': cat_name(n.get('category'), lang) if n.get('category') else None,
               'isAccessibleForFree': True,
               'author': {'@type': 'Organization', '@id': ORG_ID, 'name': 'Wartabiye TV', 'url': SITE_URL + 'nagu-saabsan/'},
               'publisher': PUBLISHER}
        if n.get('image'):
            io = {'@type': 'ImageObject', 'url': img, 'caption': alt}
            if size:
                io['width'], io['height'] = size
            if n.get('imageCredit'):
                io['creditText'] = n['imageCredit']
            if n.get('imageLicense') and str(n.get('imageSourceUrl') or '').startswith('https://'):
                io['acquireLicensePage'] = n['imageSourceUrl']
            art['image'] = [io]
        else:
            art['image'] = [LOGO]
        if body:
            art['wordCount'] = len(re.findall(r'\w+', summary + ' ' + body))
        if n.get('sourceUrl'):
            art['isBasedOn'] = n['sourceUrl']
        if lang != 'so':
            art['translationOfWork'] = {'@id': page_url(n)}
        if n.get('sponsored'):
            art['@type'] = 'AdvertiserContentArticle'
        art = {k: v for k, v in art.items() if v is not None}
        bc = {'@context': 'https://schema.org', '@type': 'BreadcrumbList',
              'itemListElement': [{'@type': 'ListItem', 'position': i + 1, 'name': c[0], 'item': c[1]} for i, c in enumerate(crumbs)]}
        extra = (alts + f'<meta property="article:published_time" content="{esc(pub)}">\n'
                 f'<meta property="article:modified_time" content="{esc(mod)}">\n'
                 + (f'<meta property="article:section" content="{esc(cat_name(n.get("category"), lang))}">\n' if n.get('category') else '')
                 + ld(art) + ld(bc) + f'<script>window.WARTABIYE_STORY={json.dumps(nid)}'
                 + (f';window.WARTABIYE_LANG={json.dumps(lang)}' if lang != 'so' else '') + '</script>')
        seo = head(f'{title} | Wartabiye TV', desc, url, img, 'article', extra, alt if n.get('image') else '', size)
        # the whole article for readers without JavaScript and for search engines
        cr = '<nav class="crumbs" aria-label="breadcrumb">' + '<span>/</span>'.join(
            f'<a href="{c[1].replace(SITE_URL, "") or "./"}">{esc(c[0])}</a>' for c in crumbs[:-1]) + '</nav>'
        paras = [p.strip() for p in re.split(r'\n+', body) if p.strip()]
        inner = ''.join(f'<h2 class="sub">{esc(p[3:].strip())}</h2>' if p.startswith('## ') else f'<p>{esc(p)}</p>' for p in paras)
        when = (f'<time class="dot" datetime="{esc(pub)}">{esc(show_date(pub, lang))}</time>' if parse(pub) else '')
        if mod and mod != pub and parse(mod):
            when += f'<span class="dot">{esc(T("updatedWord", lang) if lang == "so" else "↻")} <time datetime="{esc(mod)}">{esc(show_date(mod, lang))}</time></span>'
        fig = ''
        if n.get('image'):
            cap = ''
            if n.get('imageKind') == 'illustrative':
                cap += f'<b>{esc(T("illus", lang))}</b> '
            credit = n.get('imageCredit') or ('Wartabiye TV' if n.get('by') == 'admin' else '')
            if credit:
                src = str(n.get('imageSourceUrl') or '')
                cap += f'{esc(T("photo", lang))}: ' + (f'<a href="{esc(src)}" target="_blank" rel="noopener">{esc(credit)}</a>' if src.startswith('https://') else esc(credit))
                if n.get('imageLicense'):
                    cap += f' · {esc(n["imageLicense"])}'
            fig = f'<figure class="figure">{ph(n, big=True, hero=True, lang=lang)}' + (f'<figcaption>{cap}</figcaption>' if cap else '') + '</figure>'
        # small publisher byline (no disclaimer box): "Wartabiye TV ayaa qortay" only for the newsroom's own stories,
        # "Waxaa daabacay Wartabiye TV" for every story built on other outlets' reporting (same rule as assets/app.js)
        src_name = str(n.get('source') or '')
        own = n.get('by') == 'admin' and (not src_name or src_name == 'Wartabiye TV')
        by_txt = esc(T('wroteBy' if own else 'pubBy', lang))
        by_html = '<span class="by">' + (by_txt.replace('Wartabiye TV', '<b>Wartabiye TV</b>', 1) if 'Wartabiye TV' in by_txt else by_txt) + '</span>'
        # a licence that requires public credit gets one small source line under the text
        based = ''
        if src_name and src_name != 'Wartabiye TV' and n.get('attributionRequired') is True:
            su = str(n.get('sourceUrl') or '')
            based = (f'<p class="srcline">{esc(T("srcLabel", lang))}: '
                     + (f'<a href="{esc(su)}" target="_blank" rel="noopener">{esc(src_name)} ↗</a>' if su.startswith('https://') else esc(src_name)) + '</p>')
        rel = related(n)
        rel_html = ''
        if rel:
            rel_html = ('<section class="related"><div class="blockhead"><h2>' + esc(T('related', lang)) + '</h2></div><div class="rgrid">'
                        + ''.join(f'<a href="{art_href(r)}">{ph(r)}{cat_tag(r)}<h4>{esc(r.get("title"))}</h4>{meta_line(r)}</a>' for r in rel)
                        + '</div></section>')
        lede = f'<p class="lede">{esc(summary)}</p>' if body and summary else ''
        text = inner if body else f'<p>{esc(summary or title)}</p>'
        pre = (cr + cat_tag(n, lang) + f'<h1>{esc(title)}</h1>{lede}<div class="byline"><img src="img/logo.png" alt="" width="36" height="36">'
               f'<div class="meta">{by_html}{when}</div></div>{fig}<div class="body">{text}</div>{based}{rel_html}'
               f'<a class="back" href="./">{esc(T("back", lang))}</a>')
        if lang == 'so':
            write(os.path.join(out_dir, nid + '.html'), subpage(seo, pre), wanted)
        else:
            write(os.path.join(root, lang, 'war', nid + '.html'), subpage(seo, pre, base='../../', lang=lang), tr_wanted)
removed = 0
for f in glob.glob(os.path.join(out_dir, '*.html')):
    if f not in wanted:
        os.remove(f); removed += 1
for lang in LANGS:
    for f in glob.glob(os.path.join(root, lang, 'war', '*.html')):
        if f not in tr_wanted:
            os.remove(f); removed += 1

# ---------- 2. section and information pages: route -> (title, description, key in pages.json or None) ----------
# which AdSense setting each route follows ("sections" = news lists, "info" = advertising, contact, about, policies)
INFO_ROUTES = {'xayeysiimaha', 'xiriir', 'nagu-saabsan', 'anshaxa', 'saxitaannada', 'asturnaanta', 'siyaasadda-xayeysiiska'}
SECTIONS = {
    'ciyaaraha': ('Wararka Ciyaaraha', 'Wararka ciyaaraha ugu muhiimsan ee maalinta, hal meel: kubadda cagta, kubadda koleyga, teniska, Formula 1, feerka, orodka, esports iyo kuwo kale.', None),
    'soomaaliya': ('Wararka Soomaaliya', 'Wararka Soomaaliya ee la hubiyay: dowladda iyo baarlamaanka, dowlad goboleedyada, siyaasadda, dhaqaalaha, waxbarashada, gargaarka, horumarinta iyo wararka degdegga ah.', None),
    'bariga-afrika': ('Soomaaliya & Bariga Afrika', 'Wararka gobolka: Soomaaliya, Kenya, Itoobiya, Jabuuti, Uganda, Tansaaniya, Ruwanda, Burundi, Koonfur Suudaan iyo Eritreya. Kuwa ugu cusub ayaa ugu horreeya.', None),
    'caalamka': ('Wararka Caalamka', 'Wararka caalamka oo dhan oo hal meel isugu jira, af-Soomaali. Kuwa ugu cusub ayaa ugu horreeya.', None),
    'wararka-tooska': ('Wararka Tooska ah', 'Wararka degdegga ah ee Wartabiye TV ay hubisay, kuwa ugu cusub ayaa ugu horreeya, waqtiga Nairobi (EAT). Bogga si toos ah ayuu isu cusbooneysiiyaa.', None),
    'muuqaal': ('Muuqaal Wararka', 'Wararka muuqaalka ah ee Wartabiye TV: Soomaaliya, adduunka, ciyaaraha, wareysiyada iyo barnaamijyada.', None),
    'toos': ('LIVE TV', 'Baahinta tooska ah ee rasmiga ah ee Wartabiye TV iyo jadwalka baahinta soo socota.', None),
    'ciyaaraha-toos': ('Ciyaaraha Toos', 'Natiijooyinka tooska ah ee kubadda cagta, ciyaaraha soo socda, natiijooyinka iyo kala sarreynta.', None),
    'xayeysiimaha': ('Ku Xayeysiiso Ganacsigaaga Wartabiye TV', 'Gaadhsii ganacsigaaga akhristayaasha iyo daawadayaasha Wartabiye TV. Codso xayeysiis.', None),
    'xiriir': ('Nala Soo Xiriir', 'La xiriir tifaftirka Wartabiye TV: talo, sixitaan ama war.', None),
    'nagu-saabsan': (None, None, 'about'),
    'anshaxa': (None, None, 'editorial'),
    'saxitaannada': (None, None, 'corrections'),
    'asturnaanta': (None, None, 'privacy'),
    'siyaasadda-xayeysiiska': (None, None, 'adpolicy'),
}
# which stories each news route lists (the same rules as assets/app.js inHub)
HUBS = {'ciyaaraha': lambda x: section(x) == 'sports', 'caalamka': lambda x: section(x) == 'world',
        'bariga-afrika': lambda x: section(x) == 'somalia', 'soomaaliya': lambda x: section(x) == 'somalia' and x.get('country') == 'so',
        'wararka-tooska': lambda x: True}
HUB_CLASS = {'ciyaaraha': 'sports', 'caalamka': 'world', 'bariga-afrika': 'somalia', 'soomaaliya': 'soomaaliya'}
sec_wanted = set()
# public match results switched off in /admin/ (data/site.json sections.liveSports = false, owner's decision 9 Nov 2026):
# the old Ciyaaraha Toos address sends visitors to the Ciyaaraha (sports news) page and leaves the sitemap
LIVE_SPORTS = (SITE.get('sections') or {}).get('liveSports', True) is not False
if not LIVE_SPORTS:
    SECTIONS.pop('ciyaaraha-toos', None)
    write(os.path.join(root, 'ciyaaraha-toos', 'index.html'),
          '<!doctype html><html lang="so"><head><meta charset="utf-8"><title>Ciyaaraha | Wartabiye TV</title>'
          f'<link rel="canonical" href="{SITE_URL}ciyaaraha/"><meta name="robots" content="noindex">'
          f'<meta http-equiv="refresh" content="0; url={SITE_URL}ciyaaraha/"></head>'
          f'<body><p><a href="{SITE_URL}ciyaaraha/">Ciyaaraha · Wartabiye TV</a></p></body></html>\n', sec_wanted)
newest_of = {}
for route, (title, desc, key) in SECTIONS.items():
    url = f'{SITE_URL}{route}/'
    if key:
        p = pages[key]['so']
        title, desc = p['title'], describe(p.get('intro', ''), 300)
        pre = (f'<article class="article"><h1>{esc(title)}</h1><p>{esc(p.get("intro"))}</p>'
               + ''.join(f'<h2>{esc(s.get("h"))}</h2><p>{esc(s.get("p"))}</p>' for s in p.get('sections', [])) + '</article>')
    elif route in HUBS:
        items = [x for x in public if HUBS[route](x)][:50]
        if items:
            newest_of[route] = max(x.get('updatedAt') or x.get('publishedAt') or '' for x in items)
        cls = HUB_CLASS.get(route, 'somalia')
        pre = (f'<section class="hubhead {cls}"><div class="wrap"><h1>{esc(title)}</h1><p>{esc(desc)}</p></div></section>'
               '<div class="wrap layout"><div>'
               + (f'<div class="cards one">{card(items[0], True)}</div><section class="secblock"><div class="cards">'
                  + ''.join(card(x) for x in items[1:]) + '</div></section>' if items else '')
               + '</div><aside class="sidebar"></aside></div>')
    else:
        pre = f'<div class="wrap"><h1>{esc(title)}</h1><p>{esc(desc)}</p></div>'
    crumbs = {'@context': 'https://schema.org', '@type': 'BreadcrumbList', 'itemListElement': [
        {'@type': 'ListItem', 'position': 1, 'name': 'Hoyga', 'item': SITE_URL}, {'@type': 'ListItem', 'position': 2, 'name': title, 'item': url}]}
    page_type = 'AboutPage' if route == 'nagu-saabsan' else 'ContactPage' if route == 'xiriir' else 'CollectionPage' if route in HUBS else 'WebPage'
    extra = (ld({'@context': 'https://schema.org', '@type': page_type, 'name': title, 'url': url, 'inLanguage': 'so', 'publisher': PUBLISHER})
             + ld(crumbs) + f'<script>window.WARTABIYE_ROUTE={json.dumps(route)}</script>')
    seo_title = f'{title} | Wartabiye TV'
    write(os.path.join(root, route, 'index.html'), subpage(head(seo_title, desc, url, LOGO, 'website', extra), pre, 'pageView',
                                                          'info' if route in INFO_ROUTES else 'sections'), sec_wanted)

# category pages: qayb/<category>/ (Siyaasadda, Amniga, Bulshada, Dhaqaalaha …), the home layout with that category's list
cat_wanted = set()
CAT_DESC = {'Siyaasadda': 'Wararka siyaasadda Soomaaliya iyo gobolka: dowladda federaalka, baarlamaanka, doorashooyinka iyo dowlad goboleedyada.',
            'Amniga': 'Wararka amniga Soomaaliya iyo Bariga Afrika: hawlgallada ciidamada, dagaallada iyo xaaladda nabadgelyada.',
            'Bulshada': 'Wararka bulshada: waxbarashada, caafimaadka, gargaarka, abaaraha iyo nolosha dadka Soomaaliyeed.',
            'Dhaqaalaha': 'Wararka dhaqaalaha Soomaaliya iyo caalamka: ganacsiga, maalgashiga, qiimaha iyo horumarinta.',
            'Adduunka': 'Wararka adduunka oo af-Soomaali ah.', 'Ciyaaraha': 'Wararka ciyaaraha oo af-Soomaali ah.'}
for k in CATS:
    items = [x for x in public if x.get('category') == k][:50]
    if not items:
        continue
    route, url = f'qayb/{slug(k)}', f'{SITE_URL}qayb/{slug(k)}/'
    title, desc = f'Wararka {k}' if k not in ('Adduunka', 'Ciyaaraha') else k, CAT_DESC.get(k, f'Wararka {k} ee Wartabiye TV.')
    newest_of[route] = max(x.get('updatedAt') or x.get('publishedAt') or '' for x in items)
    crumbs = {'@context': 'https://schema.org', '@type': 'BreadcrumbList', 'itemListElement': [
        {'@type': 'ListItem', 'position': 1, 'name': 'Hoyga', 'item': SITE_URL}, {'@type': 'ListItem', 'position': 2, 'name': k, 'item': url}]}
    extra = (ld({'@context': 'https://schema.org', '@type': 'CollectionPage', 'name': title, 'url': url, 'inLanguage': 'so', 'publisher': PUBLISHER})
             + ld(crumbs) + f'<script>window.WARTABIYE_ROUTE={json.dumps("qayb-" + slug(k))}</script>')
    page = subpage(head(f'{title} | Wartabiye TV', desc, url, LOGO, 'website', extra), None, 'homeView', 'sections', base='../../',
                   home_pre={'list': ''.join(row(x) for x in items)})
    page = page.replace('<h2 id="listTitle" data-i18n="latest">Wararka cusub</h2>', f'<h1 id="listTitle">{esc(k)}</h1>', 1)
    write(os.path.join(root, 'qayb', slug(k), 'index.html'), page, cat_wanted)
for f in glob.glob(os.path.join(root, 'qayb', '*', 'index.html')):
    if f not in cat_wanted:
        os.remove(f)

# ---------- 3. the homepage itself: real headlines and links in the HTML ----------
feat_ids = [f if isinstance(f, str) else (f or {}).get('article') for f in (SITE.get('featured') or [])]
featured = [by_id[i] for i in feat_ids if i in by_id]
pool = [x for x in public if not x.get('sponsored') and x not in featured]
mosaic = (featured + pool)[:5]
rest = [x for x in public if x not in mosaic and section(x) == 'somalia'][:20]
blocks = ''
for route, key, sec in (('caalamka', 'latestWorld', 'world'), ('ciyaaraha', 'latestSports', 'sports')):
    its = [x for x in public if x not in mosaic and section(x) == sec][:6]
    if its:
        blocks += (f'<section class="secblock"><div class="blockhead"><h2>{esc(T(key))}</h2><a class="all" href="{route}/">{esc(T("seeAll"))} →</a></div>'
                   f'<div class="cards">' + ''.join(card(x) for x in its) + '</div></section>')
HOME_TITLE = 'Wartabiye TV | Wararka Soomaaliya, Muqdisho, Caalamka iyo Ciyaaraha'
HOME_DESC = ('Wartabiye TV: wararkii ugu dambeeyay ee Soomaaliya iyo Muqdisho, Bariga Afrika, caalamka iyo ciyaaraha, '
             'af-Soomaali. Warar la hubiyay oo maalin kasta la cusbooneysiiyo.')
org = {'@context': 'https://schema.org', '@type': 'NewsMediaOrganization', '@id': ORG_ID, 'name': 'Wartabiye TV', 'alternateName': 'Wartabiye',
       'url': SITE_URL, 'logo': {'@type': 'ImageObject', 'url': LOGO, 'width': 512, 'height': 512}, 'sameAs': SAME_AS,
       'publishingPrinciples': SITE_URL + 'anshaxa/', 'ethicsPolicy': SITE_URL + 'anshaxa/', 'correctionsPolicy': SITE_URL + 'saxitaannada/',
       'verificationFactCheckingPolicy': SITE_URL + 'anshaxa/', 'actionableFeedbackPolicy': SITE_URL + 'xiriir/',
       'contactPoint': {'@type': 'ContactPoint', 'contactType': 'Newsroom', 'url': SITE_URL + 'xiriir/', 'availableLanguage': ['so', 'en', 'ar']},
       'areaServed': 'SO', 'knowsLanguage': ['so', 'en', 'ar', 'fr', 'nl', 'it', 'de', 'tr', 'es']}
website = {'@context': 'https://schema.org', '@type': 'WebSite', '@id': SITE_URL + '#website', 'name': 'Wartabiye TV', 'alternateName': 'Wartabiye TV News',
           'url': SITE_URL, 'inLanguage': 'so', 'publisher': {'@id': ORG_ID}}
verif = ''.join(f'<meta name="google-site-verification" content="{esc(t)}">\n' for t in ((SEO.get('verification') or {}).get('google') or [])
                if re.fullmatch(r'[A-Za-z0-9_-]{20,100}', str(t)))
bing = (SEO.get('verification') or {}).get('bing')
if bing and re.fullmatch(r'[A-Fa-f0-9]{20,64}', str(bing)):
    verif += f'<meta name="msvalidate.01" content="{esc(bing)}">\n'
home_seo = ('<!--seo-->\n' + head(HOME_TITLE, HOME_DESC, SITE_URL, LOGO, 'website', verif + ld(org) + ld(website)) + '<!--/seo-->')
home = tpl[:a] + home_seo + tpl[b:]
home = region(home, 'mosaic', ''.join(tile(x, i == 0) for i, x in enumerate(mosaic)) if mosaic else
              '<a class="tile big" href="./"><span class="ph none"></span><span class="in"><span class="cat" data-i18n="news">Wararka</span><h2 data-i18n="mosaicLoading">Wararkii ugu danbeeyay ayaa soo dhacaya</h2></span></a>')
home = region(home, 'list', ''.join(row(x) for x in rest))
if mosaic:  # the same headings the app shows, so nothing moves when it starts
    home = home.replace('id="mosaicHead" hidden', 'id="mosaicHead"', 1)
    home = home.replace('<h2 id="listTitle" data-i18n="latest">Wararka cusub</h2>', f'<h2 id="listTitle">{esc(T("eaBlock"))}</h2>', 1)
home = region(home, 'blocks', blocks)
home = region(home, 'ftrend', FOOT_TREND)
home = region(home, 'fcats', FOOT_CATS)
home = region(home, 'tick', TICK)
if home != open(os.path.join(root, 'index.html'), encoding='utf-8').read():
    open(os.path.join(root, 'index.html'), 'w', encoding='utf-8').write(home)

# ---------- 4. archive: every published article by day ----------
days = {}
for n in public:
    d = parse(n.get('publishedAt'))
    days.setdefault(d.astimezone(EAT).date().isoformat() if d else '', []).append(n)
arch = ''.join(f'<section class="secblock"><div class="blockhead"><h2>{esc(show_date(k + "T12:00:00+03:00", "so", False) if k else "—")}</h2></div><ul class="archive">'
               + ''.join(f'<li><a href="{art_href(x)}">{esc(x.get("title"))}</a></li>' for x in v) + '</ul></section>'
               for k, v in sorted(days.items(), reverse=True))
arch_url = SITE_URL + 'kaydka/'
arch_desc = f'Dhammaan wararka Wartabiye TV ({len(public)} war), maalin maalin: Soomaaliya, Bariga Afrika, caalamka iyo ciyaaraha.'
arch_pre = (f'<section class="hubhead somalia"><div class="wrap"><h1>Kaydka Wararka</h1><p>{esc(arch_desc)}</p></div></section>'
            f'<div class="wrap">{arch}</div>')
extra = (ld({'@context': 'https://schema.org', '@type': 'CollectionPage', 'name': 'Kaydka Wararka', 'url': arch_url, 'inLanguage': 'so', 'publisher': PUBLISHER})
         + '<script>window.WARTABIYE_ROUTE="kaydka"</script>')
write(os.path.join(root, 'kaydka', 'index.html'), subpage(head('Kaydka Wararka | Wartabiye TV', arch_desc, arch_url, LOGO, 'website', extra),
                                                         arch_pre, 'pageView', 'sections'), set())

# ---------- 5. video pages: muuqaal/<id>.html with VideoObject structured data, only for public videos ----------
from media_rules import provider, parse_time  # noqa: E402
vids = []
vp = os.path.join(root, 'data', 'videos.json')
if os.path.exists(vp):
    vids = json.load(open(vp, encoding='utf-8')).get('videos', [])
now = datetime.datetime.now(datetime.timezone.utc)
vids = [v for v in vids if not (parse_time(v.get('publishAt')) and parse_time(v['publishAt']) > now)]
EMBED = {'youtube': 'https://www.youtube-nocookie.com/embed/{}', 'vimeo': 'https://player.vimeo.com/video/{}',
         'dailymotion': 'https://geo.dailymotion.com/player.html?video={}'}


def iso_duration(d):
    try:
        parts = [int(x) for x in str(d).split(':')]
    except ValueError:
        return None
    sec = 0
    for x in parts:
        sec = sec * 60 + x
    return f'PT{sec // 60}M{sec % 60}S' if sec else None


vwanted = set()
vdir = os.path.join(root, 'muuqaal')
for v in vids:
    url = f'{SITE_URL}muuqaal/{v["id"]}.html'
    title, desc = v.get('title', ''), describe(v.get('summary') or v.get('title') or '', 300)
    pv = next((provider(u) for u in (v.get('youtube'), v.get('embed'), v.get('file')) if provider(u)[0]), (None, None))
    thumb = v.get('thumbnail') or (f'https://i.ytimg.com/vi/{pv[1]}/hqdefault.jpg' if pv[0] == 'youtube' else '')
    thumb = (SITE_URL + thumb.lstrip('/')) if thumb and not thumb.startswith('https://') else (thumb or LOGO)
    obj = {'@context': 'https://schema.org', '@type': 'VideoObject', 'name': title[:100], 'description': desc,
           'thumbnailUrl': [thumb], 'uploadDate': v.get('publishedAt'), 'url': url, 'inLanguage': v.get('language') or 'so',
           'publisher': PUBLISHER}
    if pv[0] == 'file':
        obj['contentUrl'] = pv[1] if pv[1].startswith('https://') else SITE_URL + pv[1]
    elif pv[0] in EMBED:
        obj['embedUrl'] = EMBED[pv[0]].format(pv[1])
    if iso_duration(v.get('duration')):
        obj['duration'] = iso_duration(v['duration'])
    extra = (f'<meta property="og:video:url" content="{esc(obj.get("embedUrl") or obj.get("contentUrl") or url)}">\n' + ld(obj)
             + f'<script>window.WARTABIYE_ROUTE={json.dumps("muuqaal?v=" + v["id"])}</script>')
    pre = f'<div class="wrap"><h1>{esc(title)}</h1><p>{esc(desc)}</p></div>'
    write(os.path.join(vdir, v['id'] + '.html'), subpage(head(f'{title} | Wartabiye TV', desc, url, thumb, 'video.other', extra), pre, 'pageView', 'sections'), vwanted)
for f in glob.glob(os.path.join(vdir, '*.html')):
    if f not in vwanted and os.path.basename(f) != 'index.html':
        os.remove(f)

# ---------- 6. sitemap.xml, news-sitemap.xml and RSS ----------
def w3c(s):
    d = parse(s)
    return d.isoformat(timespec='seconds') if d else ''


def lm(s):
    t = w3c(s)
    return f'<lastmod>{t}</lastmod>' if t else ''


xesc = lambda s: html.escape(str(s or ''), quote=False)
newest = max((n.get('updatedAt') or n.get('publishedAt') or '' for n in public), default='')
urls = [f'<url><loc>{SITE_URL}</loc>{lm(newest)}</url>']
pages_updated = pages.get('updated') if isinstance(pages.get('updated'), str) else ''
for r in SECTIONS:
    urls.append(f'<url><loc>{SITE_URL}{r}/</loc>{lm(newest_of.get(r) or (pages_updated if r in INFO_ROUTES else ""))}</url>')
for r in sorted(k for k in newest_of if k.startswith('qayb/')):
    urls.append(f'<url><loc>{SITE_URL}{r}/</loc>{lm(newest_of[r])}</url>')
urls.append(f'<url><loc>{arch_url}</loc>{lm(newest)}</url>')
for n in public:
    langs = tr_pages.get(n['id'], [])
    alt = ''
    if langs:
        alt = (f'<xhtml:link rel="alternate" hreflang="so" href="{page_url(n)}"/>'
               + ''.join(f'<xhtml:link rel="alternate" hreflang="{l}" href="{page_url(n, l)}"/>' for l in langs)
               + f'<xhtml:link rel="alternate" hreflang="x-default" href="{page_url(n)}"/>')
    im = f'<image:image><image:loc>{xesc(img_url(n["image"]))}</image:loc></image:image>' if n.get('image') else ''
    for lang in ['so'] + langs:
        urls.append(f'<url><loc>{page_url(n, lang)}</loc>{lm(n.get("updatedAt") or n.get("publishedAt"))}{alt}{im}</url>')
urls += [f'<url><loc>{SITE_URL}muuqaal/{xesc(v["id"])}.html</loc>{lm(v.get("publishedAt"))}</url>' for v in vids]
sm = ('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" '
      'xmlns:xhtml="http://www.w3.org/1999/xhtml" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n' + '\n'.join(urls) + '\n</urlset>\n')
open(os.path.join(root, 'sitemap.xml'), 'w', encoding='utf-8').write(sm)

# Google News: only articles published in the last 48 hours (Google's rule), never sponsored content, at most 1000
cutoff = now - datetime.timedelta(hours=NEWS_HOURS)
fresh = [n for n in public if parse(n.get('publishedAt')) and cutoff <= parse(n['publishedAt']) <= now + datetime.timedelta(minutes=10)
         and not n.get('sponsored')]
nurls = []
for n in fresh:
    for lang in ['so'] + tr_pages.get(n['id'], []):
        x = n if lang == 'so' else n[lang]
        nurls.append(f'<url><loc>{page_url(n, lang)}</loc><news:news><news:publication><news:name>Wartabiye TV</news:name>'
                     f'<news:language>{lang}</news:language></news:publication><news:publication_date>{w3c(n["publishedAt"])}</news:publication_date>'
                     f'<news:title>{xesc(x.get("title"))}</news:title></news:news></url>')
nurls = nurls[:1000]
nsm = ('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" '
       'xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">\n' + '\n'.join(nurls) + ('\n' if nurls else '') + '</urlset>\n')
open(os.path.join(root, 'news-sitemap.xml'), 'w', encoding='utf-8').write(nsm)


def rfc822(s):
    try:
        return format_datetime(datetime.datetime.fromisoformat(s.replace('Z', '+00:00')))
    except Exception:
        return ''


items = []
for n in public[:30]:
    link = f'{SITE_URL}war/{n["id"]}.html'
    items.append(f'<item><title>{esc(n.get("title"))}</title><link>{link}</link><guid isPermaLink="true">{link}</guid>'
                 f'<pubDate>{rfc822(n.get("publishedAt") or "")}</pubDate><category>{esc(n.get("category"))}</category>'
                 f'<description>{esc(n.get("summary"))}</description></item>')
rss = ('<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0"><channel><title>Wartabiye TV</title>'
       f'<link>{SITE_URL}</link><description>Wararka Soomaaliya, Afrika, adduunka iyo ciyaaraha.</description><language>so</language>\n'
       + '\n'.join(items) + '\n</channel></rss>\n')
open(os.path.join(root, 'rss.xml'), 'w', encoding='utf-8').write(rss)
ntr = sum(len(v) for v in tr_pages.values())
print(f'{len(public)} article pages in war/ + {ntr} translated pages ({TR_MODE}; {removed} old removed), {len(SECTIONS)} section pages, '
      f'{len(cat_wanted)} category pages, {len(vids)} video pages, sitemap.xml ({len(urls)} URLs), news-sitemap.xml ({len(nurls)} URLs), rss.xml')
