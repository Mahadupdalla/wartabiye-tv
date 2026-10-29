"""Build data/news.json (what the public page reads) from the editable sources:
data/news/<id>.json (one file per article; the admin dashboard and the daily task write these)
and data/status.json (last automatic run). Articles with "published": false are drafts and are left out."""
import json, os, glob, datetime
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
news = []
for f in sorted(glob.glob(os.path.join(root, 'data', 'news', '*.json'))):
    n = json.load(open(f, encoding='utf-8'))
    n['id'] = os.path.basename(f)[:-5]
    if n.get('published', True) is False:
        continue
    if n.get('image') and n['image'].startswith('/'):
        n['image'] = n['image'].lstrip('/')
    news.append(n)
news.sort(key=lambda x: x.get('publishedAt') or '', reverse=True)
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
