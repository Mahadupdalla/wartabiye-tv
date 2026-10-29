"""Health check for the public site: valid news.json, required fields, real dates, no duplicate URLs, every image file present."""
import json, os, sys, datetime
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
news = json.load(open(os.path.join(root, 'data', 'news.json'), encoding='utf-8'))
items = news['news'] if isinstance(news, dict) else news
errors, seen = [], set()
for n in items:
    nid = n.get('id', '?')
    for k in ('id', 'title', 'category', 'publishedAt'):
        if not n.get(k): errors.append(f'{nid}: missing {k}')
    try: datetime.datetime.fromisoformat(n['publishedAt'].replace('Z', '+00:00'))
    except Exception: errors.append(f'{nid}: bad publishedAt {n.get("publishedAt")!r}')
    u = (n.get('sourceUrl') or '').split('?')[0]
    if u:
        if u in seen: errors.append(f'{nid}: duplicate sourceUrl {u}')
        seen.add(u)
    img = n.get('image')
    if img:
        if not img.startswith('img/'): errors.append(f'{nid}: image must be a local img/ path, got {img}')
        elif not os.path.isfile(os.path.join(root, img)): errors.append(f'{nid}: image file missing {img}')
        if n.get('by') != 'admin' and (not n.get('imageCredit') or not n.get('imageLicense')): errors.append(f'{nid}: image without credit/licence')
    for lang in ('en', 'ar', 'fr'):
        t = n.get(lang)
        if t is None: continue
        if not isinstance(t, dict): errors.append(f'{nid}: translation {lang} is not an object')
        elif any(k in t and not isinstance(t[k], str) for k in ('title', 'summary', 'body', 'imageAlt')): errors.append(f'{nid}: translation {lang} has a non-text field')
with_img = sum(1 for n in items if n.get('image'))
print(f'articles={len(items)} with_image={with_img} placeholder={len(items)-with_img}')
meta = news.get('updatedAt') if isinstance(news, dict) else None
print('updatedAt', meta)
# a missing translation is not an error: the page then shows the Somali original with a clear label
print('translated', ' '.join(f"{l}={sum(1 for n in items if isinstance(n.get(l), dict))}/{len(items)}" for l in ('en', 'ar', 'fr')))
if errors:
    print('\n'.join(errors)); sys.exit(1)
print('OK')
