"""Build data/news.json (what the public page reads) from the editable sources:
data/news/<id>.json (one file per article; the admin dashboard and the daily task write these)
and data/status.json (last automatic run). Articles with "published": false are drafts and are left out.
Translations ("en", "ar", "fr", "nl", "it", "de", "tr", "es") are kept; a machine translation ("status": "auto") whose text was edited
afterwards in /admin/ is published as "manual", so the page no longer labels it as machine-translated."""
import json, os, glob, datetime, sys
from translations import LANGS, text_hash, has
PHOTO_RULE_FROM = '2026-11-02'  # articles before this date were published under the old rule (placeholder allowed)


def result_card(n):
    # automatic match-result report (tools/sports_results.py): its picture is the result card (crests + score) drawn by
    # the page from the "result" block, so it needs no photo file and no photo licence
    r = n.get('result')
    return n.get('by') == 'auto-results' and isinstance(r, dict) and isinstance(r.get('score'), dict) and isinstance(r.get('home'), dict) and isinstance(r.get('away'), dict)


def needs_photo(n):
    return n.get('by') != 'admin' and not result_card(n) and (n.get('publishedAt') or '')[:10] >= PHOTO_RULE_FROM


def image_ok(n):
    img = (n.get('image') or '').lstrip('/')
    return img.startswith('img/') and os.path.isfile(os.path.join(root, img))
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
# Banned addresses (tools/east_africa.py EXCLUDED_SITES; empty since the owner lifted the Somalia ban on 8 Nov 2026):
# a NEW automatic article from one is not published. The owner's own articles are never touched.
import east_africa
try: ARCHIVED = set(json.load(open(os.path.join(root, east_africa.ARCHIVE), encoding='utf-8'))['ids'])
except Exception: ARCHIVED = None
# Public match results (owner's decision, 9 Nov 2026): while /admin/ → Bogga → "Ciyaaraha Toos" (sections.liveSports) is
# off, the automatic match-result reports (tools/sports_results.py) stay INTERNAL: their files and verified match data
# are kept in data/news/ (and in /admin/), but they are not published as results-only cards. Sports news is unaffected.
try: RESULTS_PUBLIC = json.load(open(os.path.join(root, 'data', 'site.json'), encoding='utf-8')).get('sections', {}).get('liveSports', True) is not False
except Exception: RESULTS_PUBLIC = True
news, pending, internal = [], [], 0
for f in sorted(glob.glob(os.path.join(root, 'data', 'news', '*.json'))):
    n = json.load(open(f, encoding='utf-8'))
    n['id'] = os.path.basename(f)[:-5]
    if n.get('published', True) is False:
        continue
    if result_card(n) and not RESULTS_PUBLIC:
        internal += 1
        continue
    why = east_africa.blocked_article(n, ARCHIVED) if ARCHIVED is not None else None
    if why:
        print(f"{n['id']}: not published, {why}")
        continue
    # photo rule: an automatic article from the photo-rule date on is only published with its own image file;
    # otherwise it stays a draft in /admin/ under "Sugaya sawir" until the owner adds a photo
    if needs_photo(n) and not image_ok(n):
        print(f"{n['id']}: no image file, kept as draft (Sugaya sawir)")
        continue
    if n.get('image') and n['image'].startswith('/'):
        n['image'] = n['image'].lstrip('/')
    # Rule: no article goes public without its own photo. An article without a photo file (or whose photo is
    # missing) stays pending for review in /admin/ ("Sugaya sawir") until a legal, relevant photo is added.
    if not result_card(n) and (not n.get('image') or not os.path.isfile(os.path.join(root, n['image']))):
        pending.append(n['id']); continue
    # small card image made by tools/make_thumbs.py (publish workflow); cards fall back to the full image without it
    n.pop('thumb', None)
    if n.get('image'):
        t = os.path.join('img', 'news', 'w480', os.path.splitext(os.path.basename(n['image']))[0] + '.webp')
        if os.path.isfile(os.path.join(root, t)):
            n['thumb'] = t
    for lang in LANGS:
        if not has(n, lang):
            n.pop(lang, None); continue
        t = dict(n[lang]); h = t.pop('hash', None)
        if t.get('status') != 'manual':
            t['status'] = 'auto' if h and h == text_hash(t) else 'manual'
        n[lang] = t
    news.append(n)
news.sort(key=lambda x: x.get('publishedAt') or '', reverse=True)
# adverts: data/ads/<id>.json (edited in /admin/) -> data/ads.json; paused and expired ones are left out
ads = []
for f in sorted(glob.glob(os.path.join(root, 'data', 'ads', '*.json'))):
    a = json.load(open(f, encoding='utf-8'))
    a['id'] = os.path.basename(f)[:-5]
    if a.get('active') is False:
        continue
    if a.get('end') and str(a['end'])[:10] < datetime.date.today().isoformat():
        continue
    if a.get('image') and str(a['image']).startswith('/'):
        a['image'] = a['image'].lstrip('/')
    ads.append({k: v for k, v in a.items() if k in ('id', 'title', 'advertiser', 'text', 'positions', 'image', 'imageAlt', 'link', 'video', 'start', 'end', 'active', 'en', 'ar', 'fr', 'nl', 'it', 'de', 'tr', 'es')})
ads_path = os.path.join(root, 'data', 'ads.json')
ads_out = {'ads': ads}
old_ads = json.load(open(ads_path, encoding='utf-8')) if os.path.exists(ads_path) else None
if old_ads != ads_out:
    json.dump(ads_out, open(ads_path, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print(f'{len(ads)} active adverts -> data/ads.json')

# videos: data/videos/<id>.json (edited in /admin/ "Muuqaalada") -> data/videos.json; drafts are left out.
# Only a player from an authorised provider (YouTube, Vimeo, Dailymotion, Facebook, Cloudflare Stream, HLS) or a
# .mp4/.webm file that Wartabiye TV may publish is accepted (tools/media_rules.py).
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from media_rules import provider as _provider, parse_time as _ptime  # noqa: E402
videos = []
for f in sorted(glob.glob(os.path.join(root, 'data', 'videos', '*.json'))):
    v = json.load(open(f, encoding='utf-8'))
    v['id'] = os.path.basename(f)[:-5]
    if v.get('published') is False:
        continue
    # "publishAt" (scheduled): the site shows the video from that moment on (assets/media.js); its page is built then
    if _ptime(v.get('publishAt')) and _ptime(v['publishAt']) > datetime.datetime.now(datetime.timezone.utc):
        print(f"{v['id']}: video scheduled for {v['publishAt']}")
    links = [v.get('youtube'), v.get('embed'), v.get('file')]
    if not any(_provider(u)[0] for u in links):
        print(f"{v['id']}: video skipped (needs a YouTube/Vimeo/Dailymotion/Facebook/Cloudflare link or an .mp4/.webm file)")
        continue
    if v.get('tags') and isinstance(v['tags'], str):
        v['tags'] = [t.strip() for t in v['tags'].split(',') if t.strip()]
    videos.append({k: v[k] for k in ('id', 'title', 'summary', 'body', 'kind', 'language', 'featured', 'tags', 'youtube', 'embed', 'file',
                                       'thumbnail', 'thumbnailAlt', 'duration', 'publishedAt', 'publishAt', 'updatedAt', 'source', 'sourceUrl', 'credit',
                                       'license', 'en', 'ar', 'fr', 'nl', 'it', 'de', 'tr', 'es') if v.get(k) not in (None, '', [], False)})
videos.sort(key=lambda x: x.get('publishedAt') or '', reverse=True)
vpath = os.path.join(root, 'data', 'videos.json')
vout = {'videos': videos}
if not os.path.exists(vpath) or json.load(open(vpath, encoding='utf-8')) != vout:
    json.dump(vout, open(vpath, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print(f'{len(videos)} videos -> data/videos.json')

if internal:
    print(f'{internal} match-result report(s) kept internal (public results are off: site.json sections.liveSports)')
if pending:
    print(f'{len(pending)} article(s) waiting for a photo, not published: ' + ', '.join(pending))

status = {}
p = os.path.join(root, 'data', 'status.json')
if os.path.exists(p):
    status = json.load(open(p, encoding='utf-8'))
out = {'lastRunAt': status.get('lastRunAt'), 'lastSuccessAt': status.get('lastSuccessAt') or status.get('lastRunAt'), 'lastRunNote': status.get('lastRunNote'), 'news': news}
dst = os.path.join(root, 'data', 'news.json')
# keep the file untouched when nothing changed, so rebuilding never makes an empty commit
old = json.load(open(dst, encoding='utf-8')) if os.path.exists(dst) else {}
if {k: old.get(k) for k in out} == out:
    print(f'{len(news)} published articles, data/news.json unchanged')
    raise SystemExit(0)
out = {'updatedAt': datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=3))).isoformat(timespec='seconds'), **out}
json.dump(out, open(dst, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(f'{len(news)} published articles -> data/news.json')
