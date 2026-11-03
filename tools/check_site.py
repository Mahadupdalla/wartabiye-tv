"""Health check for the public site: valid news.json, required fields, real dates, no duplicate URLs, every article has its
own photo (present, described, credited, not shared with another article),
known section / sport / region values, sponsored articles named, and every advert in data/ads.json labelled and well formed."""
import json, os, sys, datetime
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
news = json.load(open(os.path.join(root, 'data', 'news.json'), encoding='utf-8'))
items = news['news'] if isinstance(news, dict) else news
errors, seen, used_imgs = [], set(), {}
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
    if not img: errors.append(f'{nid}: published without a photo (every article needs its own photo)')
    elif img in used_imgs: errors.append(f'{nid}: uses the same photo as {used_imgs[img]} (every article needs its own photo)')
    else: used_imgs[img] = nid
    if img and not n.get('imageAlt'): errors.append(f'{nid}: photo needs a description (imageAlt)')
    if img:
        if not img.startswith('img/'): errors.append(f'{nid}: image must be a local img/ path, got {img}')
        elif not os.path.isfile(os.path.join(root, img)): errors.append(f'{nid}: image file missing {img}')
        if n.get('by') != 'admin' and (not n.get('imageCredit') or not n.get('imageLicense')): errors.append(f'{nid}: image without credit/licence')
    for lang in ('en', 'ar', 'fr', 'nl', 'it', 'de', 'tr', 'es'):
        t = n.get(lang)
        if t is None: continue
        if not isinstance(t, dict): errors.append(f'{nid}: translation {lang} is not an object')
        elif any(k in t and not isinstance(t[k], str) for k in ('title', 'summary', 'body', 'imageAlt')): errors.append(f'{nid}: translation {lang} has a non-text field')
    if n.get('section') not in (None, '', 'somalia', 'world', 'sports'): errors.append(f'{nid}: unknown section {n.get("section")!r}')
    if n.get('sponsored') and not n.get('sponsor'): errors.append(f'{nid}: sponsored article must name the sponsor')
    if n.get('tags') is not None and not isinstance(n['tags'], list): errors.append(f'{nid}: tags must be a list')
    if n.get('sourceUrl') and not str(n['sourceUrl']).startswith(('https://', 'http://')): errors.append(f'{nid}: bad sourceUrl')
p_ads = os.path.join(root, 'data', 'ads.json')
ads = json.load(open(p_ads, encoding='utf-8'))['ads'] if os.path.exists(p_ads) else []
POS = {'home', 'sidebar', 'card', 'article', 'mobile', 'spotlight', 'video'}
for ad in ads:
    aid = ad.get('id', '?')
    if not ad.get('title') or not ad.get('advertiser'): errors.append(f'ad {aid}: needs a title and the advertiser name')
    if not ad.get('positions') or not set(ad['positions']) <= POS: errors.append(f'ad {aid}: bad positions {ad.get("positions")}')
    if ad.get('image') and not os.path.isfile(os.path.join(root, ad['image'])): errors.append(f'ad {aid}: image file missing {ad["image"]}')
    if ad.get('image') and not ad.get('imageAlt'): errors.append(f'ad {aid}: image needs a description (imageAlt)')
    if ad.get('link') and not str(ad['link']).startswith('https://'): errors.append(f'ad {aid}: link must start with https://')
    if ad.get('video') and 'youtu' not in str(ad['video']): errors.append(f'ad {aid}: only YouTube video links are supported')
print(f'adverts={len(ads)}')
# photo rule (from 2026-11-02): every automatic article has its own image, never shared with another article
RULE_FROM = '2026-11-02'
users = {}
for n in items:
    for key in (n.get('image'), (n.get('imageSourceUrl') or '').split('?')[0] or None):
        if key: users.setdefault(key, []).append(n)
for n in items:
    if n.get('by') == 'admin' or (n.get('publishedAt') or '')[:10] < RULE_FROM: continue
    if not n.get('image'): errors.append(f"{n.get('id')}: published without its own photo (should be a draft under Sugaya sawir)")
    for key in (n.get('image'), (n.get('imageSourceUrl') or '').split('?')[0] or None):
        if key and len(users.get(key, [])) > 1:
            errors.append(f"{n.get('id')}: photo {key} is also used by " + ', '.join(o.get('id', '?') for o in users[key] if o is not n))
with_img = sum(1 for n in items if n.get('image'))
print(f'articles={len(items)} with_image={with_img} placeholder={len(items)-with_img}')
meta = news.get('updatedAt') if isinstance(news, dict) else None
print('updatedAt', meta)
# a missing translation is not an error: the page then shows the Somali original with a clear label
print('translated', ' '.join(f"{l}={sum(1 for n in items if isinstance(n.get(l), dict))}/{len(items)}" for l in ('en', 'ar', 'fr', 'nl', 'it', 'de', 'tr', 'es')))
if errors:
    print('\n'.join(errors)); sys.exit(1)
print('OK')
