"""Build the demo media of the Xayeysiimaha page (img/ads/demo/) from openly licensed photos.

  python3 tools/make_ad_demos.py <folder with <name>.jpg photos> <picks.json>

picks.json maps each photo name (air-1, hotel-2 …) to {"title": "File:… on Wikimedia Commons", "lic": "CC BY-SA 4.0",
"author": "…"}. The script writes:
  img/ads/demo/<name>.webp          1280 px photos for the animated adverts
  img/ads/demo/<video>.mp4 + -poster.webp   short silent H.264 videos (slow zoom + cross-fade), made from those photos
  assets/ads-credits.js             author, licence and link of every photo (shown at the bottom of the page)
The videos have no sound and no text (the text is HTML over them, so it follows the site language).
H.264 Main profile, yuv420p, +faststart: plays inline on iPhone (Safari) and Android (Chrome)."""
import json, os, subprocess, sys

root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
src, picks = sys.argv[1], json.load(open(sys.argv[2], encoding='utf-8'))
out = os.path.join(root, 'img', 'ads', 'demo')
os.makedirs(out, exist_ok=True)
SHOT, FADE = 3.2, 0.6  # seconds per photo and cross-fade; assets/ads.js REEL_SEG = SHOT - FADE
VIDEOS = {
    'hotel': ((960, 540), 750, ['hotel-1', 'hotel-2', 'hotel-3', 'hotel-4']),
    'fashion': ((540, 960), 700, ['fashion-4', 'fashion-1', 'fashion-3', 'fashion-2']),
    'telecom': ((640, 640), 550, ['telecom-1', 'telecom-3', 'telecom-2']),
    'reel': ((960, 540), 750, ['air-1', 'hotel-1', 'food-1', 'tech-1', 'estate-1', 'edu-1', 'fashion-4', 'market-1', 'telecom-1', 'car-1']),
}
LIC_URL = {'CC0': 'https://creativecommons.org/publicdomain/zero/1.0/', 'CC BY 2.0': 'https://creativecommons.org/licenses/by/2.0/',
           'CC BY-SA 2.0': 'https://creativecommons.org/licenses/by-sa/2.0/', 'CC BY-SA 3.0': 'https://creativecommons.org/licenses/by-sa/3.0/',
           'CC BY-SA 4.0': 'https://creativecommons.org/licenses/by-sa/4.0/', 'CC BY 4.0': 'https://creativecommons.org/licenses/by/4.0/'}


def run(args):
    subprocess.run(args, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)


# 1. photos
for name in picks:
    run(['convert', os.path.join(src, name + '.jpg'), '-auto-orient', '-resize', '1280x>', '-strip', '-quality', '74',
         os.path.join(out, name + '.webp')])

# 2. videos: every photo slowly zooms (alternating in and out), then cross-fades into the next one
for vid, ((w, h), kbps, names) in VIDEOS.items():
    args = ['ffmpeg', '-y', '-hide_banner']
    for n in names:
        args += ['-i', os.path.join(src, n + '.jpg')]  # one frame each: zoompan makes the {SHOT} s of motion
    fr, frames = 25, int(SHOT * 25)
    parts = []
    for i, _ in enumerate(names):
        z = f"1.0+0.08*on/{frames}" if i % 2 == 0 else f"1.08-0.08*on/{frames}"
        parts.append(f"[{i}:v]scale={w*3//2}:{h*3//2}:force_original_aspect_ratio=increase,crop={w*3//2}:{h*3//2},"
                     f"zoompan=z='{z}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d={frames}:s={w}x{h}:fps={fr},setsar=1,format=yuv420p[v{i}]")
    last, off = 'v0', SHOT - FADE
    for i in range(1, len(names)):
        parts.append(f"[{last}][v{i}]xfade=transition=fade:duration={FADE}:offset={off:.2f}[x{i}]")
        last, off = f'x{i}', off + SHOT - FADE
    args += ['-filter_complex', ';'.join(parts), '-map', f'[{last}]', '-an', '-c:v', 'libx264', '-profile:v', 'main',
             '-pix_fmt', 'yuv420p', '-b:v', f'{kbps}k', '-maxrate', f'{kbps*3//2}k', '-bufsize', f'{kbps*3}k', '-preset', 'medium', '-movflags', '+faststart', os.path.join(out, vid + '.mp4')]
    run(args)
    run(['ffmpeg', '-y', '-hide_banner', '-ss', '0.4', '-i', os.path.join(out, vid + '.mp4'), '-frames:v', '1', '-q:v', '80',
         os.path.join(out, vid + '-poster.webp')])
    print(vid, os.path.getsize(os.path.join(out, vid + '.mp4')) // 1024, 'KB')

# 3. credits
cred = []
for name, p in picks.items():
    t = p['title']
    cred.append({'cat': name.split('-')[0], 'n': name.split('-')[1], 'title': t[5:], 'author': p.get('author') or '',
                 'lic': p['lic'], 'licUrl': LIC_URL.get(p['lic'], ''), 'page': 'https://commons.wikimedia.org/wiki/' + t.replace(' ', '_')})
cred.sort(key=lambda c: (c['cat'], c['n']))
with open(os.path.join(root, 'assets', 'ads-credits.js'), 'w', encoding='utf-8') as f:
    f.write('/* Photos of the demo adverts (Wikimedia Commons, open licences). Written by tools/make_ad_demos.py. */\n')
    f.write('window.WT_AD_CREDITS=' + json.dumps(cred, ensure_ascii=False, indent=0) + ';\n')
print(len(cred), 'photos credited')
