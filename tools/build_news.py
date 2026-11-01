"""Build data/news.json (what the public page reads) from the editable sources:
data/news/<id>.json (one file per article; the admin dashboard and the daily task write these)
and data/status.json (last automatic run). Articles with "published": false are drafts and are left out.
Translations ("en", "ar", "fr") are kept; a machine translation ("status": "auto") whose text was edited
afterwards in /admin/ is published as "manual", so the page no longer labels it as machine-translated."""
import json, os, glob, datetime
from translations import LANGS, text_hash, has
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
news, pending = [], []
for f in sorted(glob.glob(os.path.join(root, 'data', 'news', '*.json'))):
    n = json.load(open(f, encoding='utf-8'))
    n['id'] = os.path.basename(f)[:-5]
    if n.get('published', True) is False:
        continue
    if n.get('image') and n['image'].startswith('/'):
        n['image'] = n['image'].lstrip('/')
    # Rule: no article goes public without its own photo. An article without a photo file (or whose photo is
    # missing) stays pending for review in /admin/ ("Sugaya sawir") until a legal, relevant photo is added.
    if not n.get('image') or not os.path.isfile(os.path.join(root, n['image'])):
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
    ads.append({k: v for k, v in a.items() if k in ('id', 'title', 'advertiser', 'text', 'positions', 'image', 'imageAlt', 'link', 'video', 'start', 'end', 'active', 'en', 'ar', 'fr')})
ads_path = os.path.join(root, 'data', 'ads.json')
ads_out = {'ads': ads}
old_ads = json.load(open(ads_path, encoding='utf-8')) if os.path.exists(ads_path) else None
if old_ads != ads_out:
    json.dump(ads_out, open(ads_path, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print(f'{len(ads)} active adverts -> data/ads.json')

# football data files (data/football/<league>.json, written by tools/fetch_football.py) -> data/football/index.json,
# so league pages only ask for files that exist
fdir = os.path.join(root, 'data', 'football')
os.makedirs(fdir, exist_ok=True)
fidx = {'leagues': sorted(os.path.basename(f)[:-5] for f in glob.glob(os.path.join(fdir, '*.json')) if not f.endswith('index.json'))}
fpath = os.path.join(fdir, 'index.json')
if not os.path.exists(fpath) or json.load(open(fpath, encoding='utf-8')) != fidx:
    json.dump(fidx, open(fpath, 'w', encoding='utf-8'))

if pending:
    print(f'{len(pending)} article(s) waiting for a photo, not published: ' + ', '.join(pending))

status = {}
p = os.path.join(root, 'data', 'status.json')
if os.path.exists(p):
    status = json.load(open(p, encoding='utf-8'))
out = {'lastRunAt': status.get('lastRunAt'), 'lastRunNote': status.get('lastRunNote'), 'news': news}
dst = os.path.join(root, 'data', 'news.json')
# keep the file untouched when nothing changed, so rebuilding never makes an empty commit
old = json.load(open(dst, encoding='utf-8')) if os.path.exists(dst) else {}
if {k: old.get(k) for k in out} == out:
    print(f'{len(news)} published articles, data/news.json unchanged')
    raise SystemExit(0)
out = {'updatedAt': datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=3))).isoformat(timespec='seconds'), **out}
json.dump(out, open(dst, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(f'{len(news)} published articles -> data/news.json')
