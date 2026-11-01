"""Build one search-engine friendly page per published article (war/<id>.html), plus sitemap.xml.
Each page is the normal site (index.html) opened on that article, with the article's own <title>, description,
canonical link, Open Graph / Twitter card tags, NewsArticle structured data and the headline and summary
already in the HTML, so search engines and link previews see the story without running JavaScript.
Pages of articles that were deleted or unpublished are removed. Run after tools/build_news.py."""
import json, os, glob, html, datetime
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE_URL = 'https://mahadupdalla.github.io/wartabiye-tv/'
esc = lambda s: html.escape(str(s or ''), quote=True)

tpl = open(os.path.join(root, 'index.html'), encoding='utf-8').read()
a, b = tpl.index('<!--seo-->'), tpl.index('<!--/seo-->') + len('<!--/seo-->')
assert '<!--story-->' in tpl, 'story marker missing in index.html'
news = json.load(open(os.path.join(root, 'data', 'news.json'), encoding='utf-8'))['news']

out_dir = os.path.join(root, 'war')
os.makedirs(out_dir, exist_ok=True)
wanted = set()
for n in news:
    nid = n['id']
    url = f'{SITE_URL}war/{nid}.html'
    title, summary = n.get('title', ''), (n.get('summary') or '')
    desc = summary[:300]
    img = SITE_URL + n['image'] if n.get('image') else SITE_URL + 'img/logo.png'
    ld = {'@context': 'https://schema.org', '@type': 'NewsArticle', 'headline': title[:110], 'description': desc,
          'datePublished': n.get('publishedAt'), 'dateModified': n.get('publishedAt'), 'inLanguage': 'so',
          'image': [img], 'mainEntityOfPage': url, 'articleSection': n.get('category'),
          'author': {'@type': 'Organization', 'name': 'Wartabiye TV'},
          'publisher': {'@type': 'Organization', 'name': 'Wartabiye TV', 'logo': {'@type': 'ImageObject', 'url': SITE_URL + 'img/logo.png'}}}
    ldj = json.dumps(ld, ensure_ascii=False).replace('</', '<\\/')
    alts = ''.join(f'<link rel="alternate" hreflang="{l}" href="{url}?lang={l}">\n' for l in ('en', 'ar', 'fr') if isinstance(n.get(l), dict) and n[l].get('title'))
    seo = (f'<title>{esc(title)} | Wartabiye TV</title>\n'
           f'<meta name="description" content="{esc(desc)}">\n'
           f'<link rel="canonical" href="{url}">\n{alts}'
           f'<meta property="og:site_name" content="Wartabiye TV">\n<meta property="og:type" content="article">\n'
           f'<meta property="og:url" content="{url}">\n<meta property="og:title" content="{esc(title)}">\n'
           f'<meta property="og:description" content="{esc(desc)}">\n<meta property="og:image" content="{esc(img)}">\n'
           f'<meta property="article:published_time" content="{esc(n.get("publishedAt"))}">\n'
           f'<meta name="twitter:card" content="summary_large_image">\n'
           f'<script type="application/ld+json">{ldj}</script>\n'
           f'<script>window.WARTABIYE_STORY={json.dumps(nid)}</script>')
    page = tpl[:a] + seo + tpl[b:]
    # all relative links (img/, data/, #hoyga …) resolve from the site root
    page = page.replace('<meta charset="utf-8">', '<meta charset="utf-8">\n<base href="../">', 1)
    pre = f'<h1>{esc(title)}</h1><div class="body"><p>{esc(summary)}</p></div>'
    page = page.replace('<!--story-->', pre, 1)
    page = page.replace('<div id="homeView">', '<div id="homeView" hidden>', 1).replace('<div id="storyView" hidden>', '<div id="storyView">', 1)
    path = os.path.join(out_dir, nid + '.html')
    wanted.add(path)
    if not os.path.exists(path) or open(path, encoding='utf-8').read() != page:
        open(path, 'w', encoding='utf-8').write(page)
removed = 0
for f in glob.glob(os.path.join(out_dir, '*.html')):
    if f not in wanted:
        os.remove(f); removed += 1

day = lambda s: (s or '')[:10]
urls = [f'<url><loc>{SITE_URL}</loc><changefreq>daily</changefreq><lastmod>{day(news[0]["publishedAt"]) if news else datetime.date.today().isoformat()}</lastmod></url>']
urls += [f'<url><loc>{SITE_URL}war/{esc(n["id"])}.html</loc><lastmod>{day(n.get("publishedAt"))}</lastmod></url>' for n in news]
sm = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + '\n'.join(urls) + '\n</urlset>\n'
open(os.path.join(root, 'sitemap.xml'), 'w', encoding='utf-8').write(sm)
print(f'{len(news)} article pages in war/ ({removed} old removed), sitemap.xml')
