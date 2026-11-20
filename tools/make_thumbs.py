"""Make small card images: img/news/<name>.(jpg|png|webp) -> img/news/w480/<name>.webp (480px wide).
Cards and lists load these instead of the full photo, so the homepage downloads far less on phones.
A thumbnail is remade whenever the photo's CONTENT changes (SHA-256 kept in img/news/w480/sources.json), not by file
time: a fresh git checkout gives every file the same time, so a replaced photo could keep its old card thumbnail.
Thumbnails of deleted photos are removed. The category graphics (img/category/) have their own w480 versions.
Needs Pillow (pip install pillow). Run before tools/build_news.py so news.json can point at them."""
import os, glob, json, hashlib
from PIL import Image
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
src_dir = os.path.join(root, 'img', 'news')
out_dir = os.path.join(src_dir, 'w480')
os.makedirs(out_dir, exist_ok=True)
made, wanted = 0, set()
man_p = os.path.join(out_dir, 'sources.json')
try: man = json.load(open(man_p))
except Exception: man = {}
new_man = {}
def digest(p):
    h = hashlib.sha256()
    with open(p, 'rb') as fh:
        for b in iter(lambda: fh.read(1 << 16), b''): h.update(b)
    return h.hexdigest()
for f in sorted(glob.glob(os.path.join(src_dir, '*'))):
    if not os.path.isfile(f) or os.path.splitext(f)[1].lower() not in ('.jpg', '.jpeg', '.png', '.webp'):
        continue
    dst = os.path.join(out_dir, os.path.splitext(os.path.basename(f))[0] + '.webp')
    wanted.add(dst)
    d = digest(f)
    name = os.path.basename(dst)
    new_man[name] = d
    if os.path.exists(dst) and man.get(name) == d:
        continue
    try:
        im = Image.open(f)
        im = im.convert('RGBA' if im.mode in ('RGBA', 'LA', 'P') else 'RGB')
        if im.width > 480:
            im = im.resize((480, round(im.height * 480 / im.width)), Image.LANCZOS)
        im.save(dst, 'WEBP', quality=72, method=6)
        made += 1
    except Exception as e:  # a broken upload must not stop publishing; the card then uses the full image
        print('skip', os.path.basename(f), e)
removed = 0
for f in glob.glob(os.path.join(out_dir, '*.webp')):
    if f not in wanted:
        os.remove(f); removed += 1
with open(man_p, 'w') as fh:
    json.dump(dict(sorted(new_man.items())), fh, indent=0)
    fh.write('\n')
print(f'thumbnails: {made} made, {len(wanted)} total, {removed} removed')
