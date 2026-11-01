"""Make small card images: img/news/<name>.(jpg|png|webp) -> img/news/w480/<name>.webp (480px wide).
Cards and lists load these instead of the full photo, so the homepage downloads far less on phones.
Existing thumbnails are kept unless the photo is newer; thumbnails of deleted photos are removed.
Needs Pillow (pip install pillow). Run before tools/build_news.py so news.json can point at them."""
import os, glob
from PIL import Image
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
src_dir = os.path.join(root, 'img', 'news')
out_dir = os.path.join(src_dir, 'w480')
os.makedirs(out_dir, exist_ok=True)
made, wanted = 0, set()
for f in sorted(glob.glob(os.path.join(src_dir, '*'))):
    if not os.path.isfile(f) or os.path.splitext(f)[1].lower() not in ('.jpg', '.jpeg', '.png', '.webp'):
        continue
    dst = os.path.join(out_dir, os.path.splitext(os.path.basename(f))[0] + '.webp')
    wanted.add(dst)
    if os.path.exists(dst) and os.path.getmtime(dst) >= os.path.getmtime(f):
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
print(f'thumbnails: {made} made, {len(wanted)} total, {removed} removed')
