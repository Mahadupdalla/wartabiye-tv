"""Build search-engine friendly pages from index.html. Run after tools/build_news.py.
- war/<id>.html: one page per published article, with its own <title>, description, canonical link,
  Open Graph / Twitter tags, NewsArticle structured data and the headline and summary already in the HTML.
  Pages of deleted or unpublished articles are removed.
- <section>/index.html for the Sports, World, Advertising, About, Contact and policy pages, so they have
  real addresses (e.g. /ciyaaraha/) that search engines can index and people can share.
- sitemap.xml and rss.xml (newest 30 articles, headline + our own summary + link)."""
import json, os, glob, html, datetime, re, sys
from email.utils import format_datetime
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE_URL = 'https://www.wartabiyetv.com/'
esc = lambda s: html.escape(str(s or ''), quote=True)

tpl = open(os.path.join(root, 'index.html'), encoding='utf-8').read()
a, b = tpl.index('<!--seo-->'), tpl.index('<!--/seo-->') + len('<!--/seo-->')
assert '<!--story-->' in tpl, 'story marker missing in index.html'
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import build_adsense  # noqa: E402  Google AdSense Auto ads per kind of page (data/adsense.json; off without a publisher ID)
ADSENSE = build_adsense.load()
news = json.load(open(os.path.join(root, 'data', 'news.json'), encoding='utf-8'))['news']
pages = json.load(open(os.path.join(root, 'data', 'pages.json'), encoding='utf-8'))
LOGO = SITE_URL + 'img/logo.png'
PUBLISHER = {'@type': 'NewsMediaOrganization', 'name': 'Wartabiye TV', 'url': SITE_URL,
             'logo': {'@type': 'ImageObject', 'url': LOGO}}


def ld(obj):
    return '<script type="application/ld+json">' + json.dumps(obj, ensure_ascii=False).replace('</', '<\\/') + '</script>\n'


def head(title, desc, url, img, kind='website', extra=''):
    return (f'<title>{esc(title)}</title>\n<meta name="description" content="{esc(desc)}">\n'
            f'<link rel="canonical" href="{url}">\n'
            f'<meta property="og:site_name" content="Wartabiye TV">\n<meta property="og:type" content="{kind}">\n'
            f'<meta property="og:url" content="{url}">\n<meta property="og:title" content="{esc(title)}">\n'
            f'<meta property="og:description" content="{esc(desc)}">\n<meta property="og:image" content="{esc(img)}">\n'
            f'<meta name="twitter:card" content="{"summary_large_image" if img != LOGO else "summary"}">\n' + extra)


def write(path, page, wanted):
    wanted.add(path)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    if not os.path.exists(path) or open(path, encoding='utf-8').read() != page:
        open(path, 'w', encoding='utf-8').write(page)


def subpage(seo, pre=None, show='storyView', kind='articles'):
    page = build_adsense.apply(tpl[:a] + seo + tpl[b:], ADSENSE, kind)
    # all relative links (img/, data/, assets/, #hoyga …) resolve from the site root
    page = page.replace('<meta charset="utf-8">', '<meta charset="utf-8">\n<base href="../">', 1)
    page = page.replace('<div id="homeView">', '<div id="homeView" hidden>', 1)
    if show == 'storyView':
        page = page.replace('<div id="storyView" hidden>', '<div id="storyView">', 1)
        page = page.replace('<!--story-->', pre or '', 1)
    else:
        page = page.replace('<div id="pageView" hidden></div>', f'<div id="pageView">{pre or ""}</div>', 1)
    return page


# 1. article pages
out_dir = os.path.join(root, 'war')
wanted = set()
for n in news:
    nid = n['id']
    url = f'{SITE_URL}war/{nid}.html'
    title, summary = n.get('title', ''), (n.get('summary') or '')
    desc = summary[:300]
    img = SITE_URL + n['image'] if n.get('image') else LOGO
    art = {'@context': 'https://schema.org', '@type': 'NewsArticle', 'headline': title[:110], 'description': desc,
           'datePublished': n.get('publishedAt'), 'dateModified': n.get('updatedAt') or n.get('publishedAt'),
           'inLanguage': 'so', 'image': [img], 'mainEntityOfPage': url, 'articleSection': n.get('category'),
           'author': {'@type': 'Organization', 'name': 'Wartabiye TV'}, 'publisher': PUBLISHER}
    if n.get('sourceUrl'):
        art['isBasedOn'] = n['sourceUrl']
    if n.get('sponsored'):
        art['@type'] = 'AdvertiserContentArticle'
    alts = ''.join(f'<link rel="alternate" hreflang="{l}" href="{url}?lang={l}">\n'
                   for l in ('en', 'ar', 'fr', 'nl', 'it', 'de', 'tr', 'es') if isinstance(n.get(l), dict) and n[l].get('title'))
    if alts:
        alts = f'<link rel="alternate" hreflang="so" href="{url}">\n' + alts
    extra = (alts + f'<meta property="article:published_time" content="{esc(n.get("publishedAt"))}">\n' + ld(art)
             + f'<script>window.WARTABIYE_STORY={json.dumps(nid)}</script>')
    seo = head(f'{title} | Wartabiye TV', desc, url, img, 'article', extra)
    # the whole article for readers without JavaScript and for search engines: lede, then paragraphs and "## " subheadings
    paras = [p.strip() for p in re.split(r'\n+', str(n.get('body') or '')) if p.strip()]
    inner = ''.join(f'<h2 class="sub">{esc(p[3:].strip())}</h2>' if p.startswith('## ') else f'<p>{esc(p)}</p>' for p in paras)
    pre = f'<h1>{esc(title)}</h1><div class="body"><p>{esc(summary)}</p>{inner}</div>'
    write(os.path.join(out_dir, nid + '.html'), subpage(seo, pre), wanted)
removed = 0
for f in glob.glob(os.path.join(out_dir, '*.html')):
    if f not in wanted:
        os.remove(f); removed += 1

# 2. section and information pages: route -> (title, description, key in pages.json or None)
# which AdSense setting each route follows ("sections" = news lists, "info" = advertising, contact, about, policies)
INFO_ROUTES = {'xayeysiimaha', 'xiriir', 'nagu-saabsan', 'anshaxa', 'saxitaannada', 'asturnaanta', 'siyaasadda-xayeysiiska'}
SECTIONS = {
    'ciyaaraha': ('Ciyaaraha', 'Wararka ciyaaraha ugu muhiimsan ee maalinta, hal meel: kubadda cagta, kubadda koleyga, teniska, Formula 1, feerka, orodka, esports iyo kuwo kale.', None),
    'soomaaliya': ('Wararka Soomaaliya', 'Wararka Soomaaliya ee la hubiyay: dowladda iyo baarlamaanka, dowlad goboleedyada, siyaasadda, dhaqaalaha, waxbarashada, gargaarka, horumarinta iyo wararka degdegga ah.', None),
    'bariga-afrika': ('Soomaaliya & Bariga Afrika', 'Wararka gobolka: Soomaaliya, Kenya, Itoobiya, Jabuuti, Uganda, Tansaaniya, Ruwanda, Burundi, Koonfur Suudaan iyo Eritreya. Kuwa ugu cusub ayaa ugu horreeya.', None),
    'caalamka': ('Wararka Caalamka', 'Wararka caalamka oo dhan oo hal meel isugu jira. Kuwa ugu cusub ayaa ugu horreeya.', None),
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
sec_wanted = set()
# public match results switched off in /admin/ (data/site.json sections.liveSports = false, owner's decision 9 Nov 2026):
# the old Ciyaaraha Toos address sends visitors to the Ciyaaraha (sports news) page and leaves the sitemap
try: LIVE_SPORTS = json.load(open(os.path.join(root, 'data', 'site.json'), encoding='utf-8')).get('sections', {}).get('liveSports', True) is not False
except Exception: LIVE_SPORTS = True
if not LIVE_SPORTS:
    SECTIONS.pop('ciyaaraha-toos', None)
    write(os.path.join(root, 'ciyaaraha-toos', 'index.html'),
          '<!doctype html><html lang="so"><head><meta charset="utf-8"><title>Ciyaaraha | Wartabiye TV</title>'
          f'<link rel="canonical" href="{SITE_URL}ciyaaraha/"><meta name="robots" content="noindex">'
          f'<meta http-equiv="refresh" content="0; url={SITE_URL}ciyaaraha/"></head>'
          f'<body><p><a href="{SITE_URL}ciyaaraha/">Ciyaaraha · Wartabiye TV</a></p></body></html>\n', sec_wanted)
for route, (title, desc, key) in SECTIONS.items():
    pre = ''
    if key:
        p = pages[key]['so']
        title, desc = p['title'], p.get('intro', '')[:300]
        pre = (f'<article class="article"><h1>{esc(title)}</h1><p>{esc(p.get("intro"))}</p>'
               + ''.join(f'<h2>{esc(s.get("h"))}</h2><p>{esc(s.get("p"))}</p>' for s in p.get('sections', [])) + '</article>')
    else:
        pre = f'<h1>{esc(title)}</h1><p>{esc(desc)}</p>'
    url = f'{SITE_URL}{route}/'
    extra = (ld({'@context': 'https://schema.org', '@type': 'WebPage', 'name': title, 'url': url, 'publisher': PUBLISHER})
             + f'<script>window.WARTABIYE_ROUTE={json.dumps(route)}</script>')
    write(os.path.join(root, route, 'index.html'), subpage(head(f'{title} | Wartabiye TV', desc, url, LOGO, 'website', extra), pre, 'pageView',
                                                          'info' if route in INFO_ROUTES else 'sections'), sec_wanted)

# 3. video pages: muuqaal/<id>.html with VideoObject structured data (Google video search), only for public videos
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
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
    title, desc = v.get('title', ''), (v.get('summary') or v.get('title') or '')[:300]
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

# 4. sitemap and RSS
day = lambda s: (s or '')[:10]
today = datetime.date.today().isoformat()
urls = [f'<url><loc>{SITE_URL}</loc><changefreq>hourly</changefreq><lastmod>{day(news[0]["publishedAt"]) if news else today}</lastmod></url>']
urls += [f'<url><loc>{SITE_URL}{r}/</loc><changefreq>{"daily" if r in ("ciyaaraha", "caalamka", "soomaaliya", "bariga-afrika", "wararka-tooska", "muuqaal", "toos", "ciyaaraha-toos") else "monthly"}</changefreq></url>' for r in SECTIONS]
urls += [f'<url><loc>{SITE_URL}war/{esc(n["id"])}.html</loc><lastmod>{day(n.get("publishedAt"))}</lastmod></url>' for n in news]
urls += [f'<url><loc>{SITE_URL}muuqaal/{esc(v["id"])}.html</loc><lastmod>{day(v.get("publishedAt"))}</lastmod></url>' for v in vids]
sm = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + '\n'.join(urls) + '\n</urlset>\n'
open(os.path.join(root, 'sitemap.xml'), 'w', encoding='utf-8').write(sm)


def rfc822(s):
    try:
        return format_datetime(datetime.datetime.fromisoformat(s.replace('Z', '+00:00')))
    except Exception:
        return ''


items = []
for n in news[:30]:
    link = f'{SITE_URL}war/{n["id"]}.html'
    items.append(f'<item><title>{esc(n.get("title"))}</title><link>{link}</link><guid isPermaLink="true">{link}</guid>'
                 f'<pubDate>{rfc822(n.get("publishedAt") or "")}</pubDate><category>{esc(n.get("category"))}</category>'
                 f'<description>{esc(n.get("summary"))}</description></item>')
rss = ('<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0"><channel><title>Wartabiye TV</title>'
       f'<link>{SITE_URL}</link><description>Wararka Soomaaliya, Afrika, adduunka iyo ciyaaraha.</description><language>so</language>\n'
       + '\n'.join(items) + '\n</channel></rss>\n')
open(os.path.join(root, 'rss.xml'), 'w', encoding='utf-8').write(rss)
print(f'{len(news)} article pages in war/ ({removed} old removed), {len(SECTIONS)} section pages, {len(vids)} video pages, sitemap.xml, rss.xml')
