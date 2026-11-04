"""Build search-engine friendly pages from index.html. Run after tools/build_news.py.
- war/<id>.html: one page per published article, with its own <title>, description, canonical link,
  Open Graph / Twitter tags, NewsArticle structured data and the headline and summary already in the HTML.
  Pages of deleted or unpublished articles are removed.
- <section>/index.html for the Sports, World, Advertising, About, Contact and policy pages, so they have
  real addresses (e.g. /ciyaaraha/) that search engines can index and people can share.
- sitemap.xml and rss.xml (newest 30 articles, headline + our own summary + link)."""
import json, os, glob, html, datetime
from email.utils import format_datetime
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE_URL = 'https://www.wartabiyetv.com/'
esc = lambda s: html.escape(str(s or ''), quote=True)

tpl = open(os.path.join(root, 'index.html'), encoding='utf-8').read()
a, b = tpl.index('<!--seo-->'), tpl.index('<!--/seo-->') + len('<!--/seo-->')
assert '<!--story-->' in tpl, 'story marker missing in index.html'
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


def subpage(seo, pre=None, show='storyView'):
    page = tpl[:a] + seo + tpl[b:]
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
    pre = f'<h1>{esc(title)}</h1><div class="body"><p>{esc(summary)}</p></div>'
    write(os.path.join(out_dir, nid + '.html'), subpage(seo, pre), wanted)
removed = 0
for f in glob.glob(os.path.join(out_dir, '*.html')):
    if f not in wanted:
        os.remove(f); removed += 1

# 2. section and information pages: route -> (title, description, key in pages.json or None)
SECTIONS = {
    'ciyaaraha': ('Ciyaaraha', 'Wararka ciyaaraha ugu muhiimsan ee maalinta, hal meel: kubadda cagta, kubadda koleyga, teniska, Formula 1, feerka, orodka, esports iyo kuwo kale.', None),
    'caalamka': ('Wararka Caalamka', 'Wararka caalamka oo dhan oo hal meel isugu jira. Kuwa ugu cusub ayaa ugu horreeya.', None),
    'xayeysiimaha': ('Ku Xayeysiiso Ganacsigaaga Wartabiye TV', 'Gaadhsii ganacsigaaga akhristayaasha iyo daawadayaasha Wartabiye TV. Codso xayeysiis.', None),
    'xiriir': ('Nala Soo Xiriir', 'La xiriir tifaftirka Wartabiye TV: talo, sixitaan ama war.', None),
    'nagu-saabsan': (None, None, 'about'),
    'anshaxa': (None, None, 'editorial'),
    'saxitaannada': (None, None, 'corrections'),
    'asturnaanta': (None, None, 'privacy'),
    'siyaasadda-xayeysiiska': (None, None, 'adpolicy'),
}
sec_wanted = set()
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
    write(os.path.join(root, route, 'index.html'), subpage(head(f'{title} | Wartabiye TV', desc, url, LOGO, 'website', extra), pre, 'pageView'), sec_wanted)

# 3. sitemap and RSS
day = lambda s: (s or '')[:10]
today = datetime.date.today().isoformat()
urls = [f'<url><loc>{SITE_URL}</loc><changefreq>hourly</changefreq><lastmod>{day(news[0]["publishedAt"]) if news else today}</lastmod></url>']
urls += [f'<url><loc>{SITE_URL}{r}/</loc><changefreq>{"daily" if r in ("ciyaaraha", "caalamka") else "monthly"}</changefreq></url>' for r in SECTIONS]
urls += [f'<url><loc>{SITE_URL}war/{esc(n["id"])}.html</loc><lastmod>{day(n.get("publishedAt"))}</lastmod></url>' for n in news]
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
print(f'{len(news)} article pages in war/ ({removed} old removed), {len(SECTIONS)} section pages, sitemap.xml, rss.xml')
