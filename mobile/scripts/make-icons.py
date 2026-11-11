"""Builds the app icons from the website's logo (img/icon-512.png).

The icon is the Wartabiye TV badge: the globe logo and "WARTABIYE TV" on a white circle, on the
dark blue background. Run from the repository root:  python3 mobile/scripts/make-icons.py
Needs Pillow and the Inter Black font (fonts-inter).
"""
import os
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, 'mobile', 'assets')
LOGO = Image.open(os.path.join(ROOT, 'img', 'icon-512.png')).convert('RGBA')
FONT = '/usr/share/fonts/opentype/inter/Inter-Black.otf'
BLUE, RED = (3, 123, 220, 255), (242, 6, 10, 255)
NAVY_TOP, NAVY_BOTTOM = (22, 38, 72), (32, 52, 92)
S = 2048  # drawn large, then scaled down


def navy(size):
    """The dark blue background, slightly lighter towards the bottom"""
    im = Image.new('RGBA', (size, size))
    d = ImageDraw.Draw(im)
    for y in range(size):
        t = y / (size - 1)
        d.line([(0, y), (size, y)], fill=tuple(round(a + (b - a) * t) for a, b in zip(NAVY_TOP, NAVY_BOTTOM)) + (255,))
    return im


def badge(diameter):
    """White circle with the logo and the name, on a transparent square of the same size"""
    im = Image.new('RGBA', (diameter, diameter), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.ellipse([0, 0, diameter - 1, diameter - 1], fill=(255, 255, 255, 255))
    logo_d = round(diameter * 0.64)
    logo = LOGO.resize((logo_d, logo_d), Image.LANCZOS)
    im.alpha_composite(logo, ((diameter - logo_d) // 2, round(diameter * 0.40 - logo_d / 2)))
    # "WARTABIYE TV": blue name, red TV, letter-spaced, centred under the logo
    size = round(diameter * 0.082)
    font = ImageFont.truetype(FONT, size)
    track = size * 0.07
    parts = [('WARTABIYE', BLUE), (' ', BLUE), ('TV', RED)]
    widths = [[font.getlength(ch) for ch in text] for text, _ in parts]
    total = sum(sum(w) for w in widths) + track * (sum(len(t) for t, _ in parts) - 1)
    x = (diameter - total) / 2
    y = diameter * 0.835
    for (text, color), ws in zip(parts, widths):
        for ch, w in zip(text, ws):
            d.text((x, y), ch, font=font, fill=color, anchor='ls')
            x += w + track
    return im


def full(size, circle):
    """Square icon: navy background with the badge in the middle (circle = share of the width)"""
    im = navy(S)
    b = badge(round(S * circle))
    im.alpha_composite(b, ((S - b.width) // 2, (S - b.height) // 2))
    return im.resize((size, size), Image.LANCZOS)


def save(im, name, rgb=False):
    path = os.path.join(OUT, name)
    (im.convert('RGB') if rgb else im).save(path, optimize=True)
    print(name, im.size)


# iOS and the store listing: one square picture without transparency
save(full(1024, 0.90), 'icon.png', rgb=True)
# Android adaptive icon: the launcher masks a 1024 square to about its middle 2/3, the safe zone is 61%
save(navy(1024), 'android-icon-background.png')
fg = Image.new('RGBA', (S, S), (0, 0, 0, 0))
b = badge(round(S * 0.60))
fg.alpha_composite(b, ((S - b.width) // 2, (S - b.height) // 2))
save(fg.resize((1024, 1024), Image.LANCZOS), 'android-icon-foreground.png')
# web app (PWA) and browser tab
save(full(192, 0.90), 'pwa-192.png')
save(full(512, 0.90), 'pwa-512.png')
save(full(512, 0.76), 'pwa-maskable-512.png')  # maskable: everything inside the 80% safe circle
save(full(96, 0.92), 'favicon.png')
