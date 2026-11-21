"""Health check for the public site: valid news.json, required fields, real dates, no duplicate URLs, every article has its
own photo (present, described, credited, not shared with another article),
known section / sport / region values, sponsored articles named, and every advert in data/ads.json labelled and well formed."""
import json, os, sys, datetime
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
news = json.load(open(os.path.join(root, 'data', 'news.json'), encoding='utf-8'))
items = news['news'] if isinstance(news, dict) else news
errors, seen, used_imgs = [], set(), {}
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from image_system import image_problem as _image_problem  # noqa: E402  (no image, no publication: 21 Nov 2026)
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
    if not img and n.get('by') != 'auto-results': errors.append(f'{nid}: published without a photo (every article needs its own photo)')
    elif img and (img.startswith('img/category/') or n.get('imageKind') == 'category'): errors.append(f'{nid}: published with only the category graphic (no image, no publication: it must wait in Sugaya sawir)')
    elif img and img in used_imgs: errors.append(f'{nid}: uses the same photo as {used_imgs[img]} (every article needs its own photo)')
    else: used_imgs[img] = nid
    if img and not n.get('imageAlt'): errors.append(f'{nid}: photo needs a description (imageAlt)')
    if img:
        if not img.startswith('img/'): errors.append(f'{nid}: image must be a local img/ path, got {img}')
        elif not os.path.isfile(os.path.join(root, img)): errors.append(f'{nid}: image file missing {img}')
        elif _image_problem(n, root): errors.append(f'{nid}: broken featured image: {_image_problem(n, root)}')
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
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
def _src_key(u):
    # the source page, without tracking parameters; keeps ?curid= / ?title= (every Commons file found through
    # Openverse has a commons.wikimedia.org/w/index.php?curid=<n> link, and those are different photos)
    base, _, q = str(u or '').partition('?')
    keep = [kv for kv in q.split('&') if kv and kv.split('=')[0].lower() in ('curid', 'title', 'id', 'oldid', 'v', 'photo', 'image')]
    return (base + ('?' + '&'.join(sorted(keep)) if keep else '')) or None
users = {}
for n in items:
    for key in (n.get('image'), _src_key(n.get('imageSourceUrl'))):
        if key and not key.startswith('img/category/'): users.setdefault(key, []).append(n)
for n in items:
    if n.get('by') == 'admin' or (n.get('publishedAt') or '')[:10] < RULE_FROM: continue
    if n.get('by') == 'auto-results':   # match-result report: the result card (crests + score) is its picture
        r = n.get('result') or {}
        if n.get('image') or not all(isinstance(r.get(k), dict) for k in ('home', 'away', 'score')): errors.append(f"{n.get('id')}: result report without a valid result block")
        continue
    if not n.get('image'): errors.append(f"{n.get('id')}: published without its own photo (should be a draft under Sugaya sawir)")
    for key in (n.get('image'), _src_key(n.get('imageSourceUrl'))):
        if key and len(users.get(key, [])) > 1:
            errors.append(f"{n.get('id')}: photo {key} is also used by " + ', '.join(o.get('id', '?') for o in users[key] if o is not n))
# image system (tools/image_system.py, from RULE_FROM): an automatic article's photo must have confirmed usage rights
# (VERIFIED / ATTRIBUTION REQUIRED) or be the category graphic; no agency photo, no non-commercial or no-changes licence,
# no near-identical copy of another story's photo, AI illustrations only when switched on and never on breaking news
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import image_system as _IS  # noqa: E402
_settings = _IS.load_settings()
try: _reg = json.load(open(_IS.REGISTRY, encoding='utf-8')).get('images', {})
except Exception: _reg = {}
_dh = {}
for _e in _reg.values():
    for _u in _e.get('uses', []):
        if _u.get('current') and _e.get('dhash'): _dh[_u['article']] = _e['dhash']
for n in items:
    nid = n.get('id', '?')
    info = n.get('imageInfo') or {}
    img = n.get('image') or ''
    if not img or n.get('by') in ('admin', 'auto-results') or (n.get('publishedAt') or '')[:10] < _IS.RULE_FROM: continue
    st = info.get('status')
    if st not in _IS.PUBLISHABLE_AUTO:
        errors.append(f"{nid}: photo usage rights not confirmed (status {st or 'unknown'}); use another photo or keep the story in Sugaya sawir")
    if st == 'CATEGORY_GRAPHIC' and not img.startswith('img/category/'): errors.append(f'{nid}: category graphic status on a photo that is not a category graphic')
    if img.startswith('img/category/') and n.get('imageKind') != 'category': errors.append(f'{nid}: category graphic must have imageKind "category"')
    if st == 'AI_ILLUSTRATION':
        if not _settings.get('aiIllustrations'): errors.append(f'{nid}: AI illustrations are switched off (data/image-settings.json)')
        if n.get('breaking'): errors.append(f'{nid}: breaking news needs a real, verified photo, not an AI illustration')
        if n.get('imageKind') != 'ai-illustration': errors.append(f'{nid}: AI illustration must have imageKind "ai-illustration" (shown with the label)')
    lic = _IS.licence_info(info.get('license'), info.get('licenseUrl'))
    if st in ('VERIFIED', 'ATTRIBUTION_REQUIRED'):
        if not lic or not lic['free']: errors.append(f"{nid}: licence {info.get('license')!r} does not allow publication")
        if _IS.is_agency(info.get('pageUrl'), n.get('imageCredit')): errors.append(f'{nid}: news-agency photo (all rights reserved)')
        if not str(info.get('pageUrl') or '').startswith('https://'): errors.append(f'{nid}: photo without a source page link')
        if st == 'ATTRIBUTION_REQUIRED' and not (info.get('photographer') or info.get('owner')): errors.append(f'{nid}: licence needs a credit but no photographer/owner is recorded')
    d = _dh.get(nid)
    cont = set(((json.load(open(os.path.join(root, 'data', 'news', nid + '.json'), encoding='utf-8')).get('imageRights') or {}).get('continuing') or [])) if d and os.path.exists(os.path.join(root, 'data', 'news', nid + '.json')) else set()
    for other, d2 in _dh.items():
        if d and other != nid and other not in cont and _IS.hamming(d, d2) <= _IS.NEAR:
            errors.append(f'{nid}: photo is a near-identical copy of the photo of {other} (every story needs its own photo)'); break
with_img = sum(1 for n in items if n.get('image'))
print(f'articles={len(items)} with_image={with_img} placeholder={len(items)-with_img}')
meta = news.get('updatedAt') if isinstance(news, dict) else None
print('updatedAt', meta)
# a missing translation is not an error: in that language the article is left out of the lists (with a notice) and its page
# says the translation is not available, so no Somali text is mixed in. An empty translation block (an article written in
# /admin/ whose translation fields were left blank) counts as missing. `python3 tools/translations.py missing` lists them.
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from translations import has as _has_tr  # noqa: E402
_TL = ('en', 'ar', 'fr', 'nl', 'it', 'de', 'tr', 'es')
print('translated', ' '.join(f"{l}={sum(1 for n in items if _has_tr(n, l))}/{len(items)}" for l in _TL))
_untr = [n.get('id', '?') for n in items if any(not _has_tr(n, l) for l in _TL)]
if _untr:
    print(f'WARNING: {len(_untr)} article(s) not yet in all nine languages: ' + ', '.join(_untr[:10]) + (' …' if len(_untr) > 10 else ''))
# Video News, LIVE TV, LIVE Sports (data/videos.json, data/live.json, data/sports.json). A wrong link is never turned into a
# player by the site (assets/media.js), so these are warnings for the admin, not reasons to stop publishing the news.
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from media_rules import provider, parse_time, stream_authorised  # noqa: E402
warnings = []
def load(name, default):
    p = os.path.join(root, 'data', name)
    if not os.path.exists(p): return default
    try: return json.load(open(p, encoding='utf-8'))
    except Exception as e: errors.append(f'data/{name}: not valid JSON ({e})'); return default
vids = load('videos.json', {}).get('videos', [])
for v in vids:
    if not v.get('title') or not v.get('publishedAt'): errors.append(f"video {v.get('id')}: needs a title and a date")
    if v.get('license') not in (None, '', 'Wartabiye TV') and not v.get('source'): warnings.append(f"video {v.get('id')}: third-party video without the owner's name (source)")
live = load('live.json', {})
if live.get('streamUrl') and not provider(live['streamUrl'])[0]: warnings.append('live.json: the stream link is not from an accepted provider, so no player is shown')
if live.get('statusMode') == 'manual' and live.get('onAir') and not parse_time(live.get('onAirUntil')): warnings.append('live.json: "On air" needs an end time; LIVE is not shown without it')
for i, x in enumerate(live.get('schedule') or []):
    if not x.get('title') or not parse_time(x.get('start')): warnings.append(f'live.json schedule {i + 1}: needs a title and a start time')
sp = load('sports.json', {})
if sp.get('apiBase') and not str(sp['apiBase']).startswith('https://'): warnings.append('sports.json: apiBase must start with https://')
if any(k in json.dumps(sp).lower() for k in ('apikey', 'api_key', 'x-auth-token', 'x-apisports-key')): errors.append('sports.json: looks like it contains an API key; keys belong in the sports proxy secret, never in the public site')
for s in sp.get('streams') or []:
    if not stream_authorised(s): warnings.append(f"sports.json stream {s.get('title')!r}: hidden (rights not confirmed, rights holder or authorisation missing, or link not accepted)")
print(f'videos={len(vids)} live_stream={"set" if live.get("streamUrl") else "not set"} sports_api={"set" if sp.get("apiBase") else "not set"} open_data_leagues={len([l for l in ((sp.get("openData") or {}).get("leagues") or []) if l and l.get("enabled") is not False]) if (sp.get("openData") or {}).get("enabled") is not False else 0} feed={"on" if os.path.exists("data/sports-feed/index.json") and json.load(open("data/sports-feed/index.json")).get("updatedAt") else "off"}')
for w in warnings: print('WARNING', w)
if errors:
    print('\n'.join(errors)); sys.exit(1)
print('OK')
