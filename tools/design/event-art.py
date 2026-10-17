"""Draws the soft wedding pictures the app shows when there is no real photo
(event, workspace and outfit placeholders) — 1.0.23 redesign.
Usage: python3 tools/design/event-art.py web/public/art   (needs Pillow)"""
import math, random, sys
from PIL import Image, ImageDraw, ImageFilter, ImageChops

W, H = 960, 720
OUT = sys.argv[1]
MARI = ['#f5a300', '#f08c00', '#ffb627', '#e86a0a', '#ffd166']


def rgba(h, a=255):
    h = h.lstrip('#'); return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4)) + (a,)


def layer():
    return Image.new('RGBA', (W, H), (0, 0, 0, 0))


def grad(top, bot):
    im = Image.new('RGB', (W, H)); d = ImageDraw.Draw(im); t, b = rgba(top), rgba(bot)
    for y in range(H):
        k = y / H; d.line([(0, y), (W, y)], fill=tuple(int(t[i] * (1 - k) + b[i] * k) for i in range(3)))
    return im.convert('RGBA')


def blur_paste(im, L, r):
    return Image.alpha_composite(im, L.filter(ImageFilter.GaussianBlur(r)))


def bokeh(im, cols, n, rmin, rmax, blur, alpha=(60, 170)):
    L = layer(); d = ImageDraw.Draw(L)
    for _ in range(n):
        r = random.randint(rmin, rmax); x = random.randint(0, W); y = random.randint(0, H)
        d.ellipse([x - r, y - r, x + r, y + r], fill=rgba(random.choice(cols), random.randint(*alpha)))
    return blur_paste(im, L, blur)


def glow(im, x, y, r, col, a=160):
    L = layer(); ImageDraw.Draw(L).ellipse([x - r, y - r, x + r, y + r], fill=rgba(col, a)); return blur_paste(im, L, r * .6)


def petals(im, cols, n, size=(16, 44), region=(0, 0, W, H)):
    L = layer()
    for _ in range(n):
        s = random.randint(*size); P = Image.new('RGBA', (s * 2, s * 2), (0, 0, 0, 0)); d = ImageDraw.Draw(P)
        c = random.choice(cols); d.ellipse([s * .4, s * .1, s * 1.6, s * 1.9], fill=rgba(c, random.randint(180, 245)))
        d.ellipse([s * .75, s * .5, s * 1.25, s * 1.2], fill=tuple(min(255, v + 30) for v in rgba(c)[:3]) + (200,))
        P = P.rotate(random.randint(0, 360), expand=True)
        L.alpha_composite(P, (random.randint(region[0], region[2]), random.randint(region[1], region[3])))
    return blur_paste(im, L, .7)


def garland(im, y0, sag, count=56, r=13, strands=1, cols=MARI):
    L = layer(); d = ImageDraw.Draw(L)
    for s in range(strands):
        for i in range(count):
            t = i / (count - 1); x = t * W; y = y0 + s * 26 + sag * 4 * t * (1 - t)
            c = random.choice(cols); rr = r + random.uniform(-3, 3)
            for k in range(6):
                a = math.radians(k * 60 + random.uniform(0, 30)); dx, dy = math.cos(a) * rr * .45, math.sin(a) * rr * .45
                d.ellipse([x + dx - rr * .6, y + dy - rr * .6, x + dx + rr * .6, y + dy + rr * .6], fill=rgba(c, 240))
            d.ellipse([x - rr * .3, y - rr * .3, x + rr * .3, y + rr * .3], fill=rgba('#7a3b06', 210))
    return blur_paste(im, L, 1)


def rose(L, cx, cy, r, base='#c9707f', light='#f7c6cc'):
    """A soft rose: rings of rotated petals, darker towards the middle."""
    d = ImageDraw.Draw(L)
    for ring in range(5):
        rr = r * (1 - ring * .18); n = 7 - ring
        mix = ring / 5
        col = tuple(int(rgba(light)[i] * (1 - mix) + rgba(base)[i] * mix) for i in range(3))
        for k in range(n):
            a = math.radians(k * 360 / n + ring * 23)
            px, py = cx + math.cos(a) * rr * .45, cy + math.sin(a) * rr * .45
            d.ellipse([px - rr * .55, py - rr * .45, px + rr * .55, py + rr * .45], fill=col + (235,), outline=tuple(max(0, v - 25) for v in col) + (120,), width=2)
    d.ellipse([cx - r * .14, cy - r * .14, cx + r * .14, cy + r * .14], fill=rgba(base))


def leaf(L, x, y, ang, length, col='#8fa58a'):
    d = ImageDraw.Draw(L); a = math.radians(ang)
    tip = (x + math.cos(a) * length, y + math.sin(a) * length)
    w = length * .32; n = (-math.sin(a) * w, math.cos(a) * w)
    mid = (x + math.cos(a) * length * .5, y + math.sin(a) * length * .5)
    d.polygon([(x, y), (mid[0] + n[0], mid[1] + n[1]), tip, (mid[0] - n[0], mid[1] - n[1])], fill=rgba(col, 230))
    d.line([(x, y), tip], fill=rgba('#6d8268', 200), width=2)


def bouquet(im, cx, cy, scale=1.0, palette=(('#a63a4c', '#f2b7bf'), ('#c9707f', '#fbe1e4'), ('#e8a8b2', '#fff1f2'))):
    L = layer()
    for k in range(9):
        leaf(L, cx + random.uniform(-60, 60) * scale, cy + random.uniform(-30, 40) * scale, random.uniform(0, 360), random.uniform(70, 120) * scale)
    spots = [(0, 0, 70), (-95, 25, 55), (90, 30, 58), (-40, -70, 45), (55, -65, 42), (-150, -20, 30), (150, -15, 32)]
    for i, (dx, dy, r) in enumerate(spots):
        base, light = palette[i % len(palette)]
        rose(L, cx + dx * scale, cy + dy * scale, r * scale, base, light)
    sh = L.filter(ImageFilter.GaussianBlur(10)); sh = ImageChops.multiply(sh, Image.new('RGBA', (W, H), (0, 0, 0, 70)))
    return Image.alpha_composite(Image.alpha_composite(im, sh), L)


def rings(im, cx, cy):
    L = layer(); d = ImageDraw.Draw(L)
    for dx, r in ((-48, 78), (48, 70)):
        d.ellipse([cx + dx - r, cy - r, cx + dx + r, cy + r], outline=rgba('#d4a24a'), width=16)
        d.ellipse([cx + dx - r + 5, cy - r + 5, cx + dx + r - 5, cy + r - 5], outline=rgba('#f6dc9a', 200), width=4)
    d.polygon([(cx - 48, cy - 90), (cx - 34, cy - 112), (cx - 62, cy - 112)], fill=rgba('#ffffff', 240))
    sh = L.filter(ImageFilter.GaussianBlur(8)); sh = ImageChops.multiply(sh, Image.new('RGBA', (W, H), (0, 0, 0, 80)))
    return Image.alpha_composite(Image.alpha_composite(im, sh), L)


def diya(im, cx, cy, s=1.0):
    L = layer(); d = ImageDraw.Draw(L)
    d.chord([cx - 70 * s, cy - 40 * s, cx + 70 * s, cy + 50 * s], 0, 180, fill=rgba('#b5541e'))
    d.ellipse([cx - 70 * s, cy - 14 * s, cx + 70 * s, cy + 14 * s], fill=rgba('#d9772f'))
    im = Image.alpha_composite(im, L); im = glow(im, cx, cy - 46 * s, 70 * s, '#ffcf73', 150)
    L = layer(); ImageDraw.Draw(L).ellipse([cx - 11 * s, cy - 70 * s, cx + 11 * s, cy - 22 * s], fill=rgba('#fff2c4')); return blur_paste(im, L, 2)


def henna(im, col='#7a4a1c'):
    L = layer(); d = ImageDraw.Draw(L)
    for cx, cy in ((240, 360), (720, 380)):
        for r in range(30, 200, 28):
            d.arc([cx - r, cy - r, cx + r, cy + r], random.randint(0, 90), random.randint(200, 340), fill=rgba(col, 170), width=5)
        for k in range(12):
            a = math.radians(k * 30); x, y = cx + math.cos(a) * 215, cy + math.sin(a) * 215
            d.ellipse([x - 16, y - 26, x + 16, y + 26], outline=rgba(col, 170), width=4)
    return blur_paste(im, L, .8)


def candles(im, n, y=500):
    for i in range(n):
        x = int(W * (i + .5) / n + random.uniform(-20, 20)); yy = y + random.randint(-50, 50); h = random.randint(90, 170)
        L = layer(); ImageDraw.Draw(L).rounded_rectangle([x - 20, yy, x + 20, yy + h], 8, fill=rgba('#fbf3e4', 240)); im = blur_paste(im, L, 2)
        im = glow(im, x, yy - 18, 60, '#ffcf73', 120); im = glow(im, x, yy - 16, 12, '#fff4d6', 255)
    return im


def notes(im, col='#ffd9a8'):
    L = layer(); d = ImageDraw.Draw(L)
    for _ in range(9):
        x, y, s = random.randint(80, W - 80), random.randint(80, H - 200), random.uniform(.8, 1.4)
        d.ellipse([x, y + 40 * s, x + 26 * s, y + 60 * s], fill=rgba(col, 220)); d.line([(x + 24 * s, y + 50 * s), (x + 24 * s, y)], fill=rgba(col, 220), width=5)
        d.line([(x + 24 * s, y), (x + 50 * s, y + 12 * s)], fill=rgba(col, 220), width=7)
    return blur_paste(im, L, .6)


def finish(im, name, vig=110):
    V = Image.new('L', (W, H), 0); ImageDraw.Draw(V).ellipse([-W * .25, -H * .3, W * 1.25, H * 1.3], fill=255); V = V.filter(ImageFilter.GaussianBlur(140))
    dark = Image.new('RGBA', (W, H), (32, 14, 10, 255)); dark.putalpha(ImageChops.invert(V).point(lambda p: p * vig // 255))
    im = Image.alpha_composite(im, dark)
    N = Image.effect_noise((W, H), 10).convert('RGBA'); N.putalpha(14)
    Image.alpha_composite(im, N).convert('RGB').save(f'{OUT}/{name}.webp', quality=72, method=6)


random.seed(140227)
im = grad('#fbe7e9', '#d99aa3'); im = bokeh(im, ['#ffffff', '#f7c6cc', '#f3d7b5'], 60, 10, 70, 10); im = petals(im, ['#8a1c2b', '#c2384b', '#f2a7af'], 40); im = rings(im, W // 2, H // 2); finish(im, 'engagement')
im = grad('#fff1d6', '#f0b443'); im = bokeh(im, ['#fff6d8', '#ffd166'], 50, 10, 60, 10); im = garland(im, 40, 70); im = diya(im, 330, 520); im = diya(im, 640, 540, .8); im = petals(im, MARI, 50, (10, 26)); finish(im, 'haldi')
im = grad('#e7efd2', '#7f9152'); im = glow(im, W // 2, 300, 380, '#fff6d8', 170); im = henna(im); im = petals(im, ['#f5a300', '#ffd166'], 30, (10, 24)); finish(im, 'mehndi')
im = grad('#3d0d16', '#120406'); im = bokeh(im, ['#ffcf73', '#ff9e5e', '#f2a7af', '#fff4d6'], 150, 4, 36, 6, (90, 220)); im = notes(im); im = glow(im, W // 2, H, 480, '#8a1c2b', 160); finish(im, 'sangeet', 80)
im = grad('#fbf3e4', '#d8b98a'); im = bokeh(im, ['#ffffff', '#ffe8b8'], 50, 10, 50, 10); im = garland(im, 30, 60, strands=2); im = bouquet(im, W // 2, 430, 1.1, (('#b5541e', '#ffd9a8'), ('#e8a317', '#fff1d0'), ('#c9707f', '#fbe1e4'))); finish(im, 'mayra')
im = grad('#c4471c', '#5a1209'); im = glow(im, W // 2, 520, 300, '#ffb43c', 230); im = glow(im, W // 2, 560, 100, '#fff0b0', 255); im = bokeh(im, ['#ffd166', '#ff9e3d'], 60, 6, 46, 8); im = garland(im, 90, 130, strands=3, r=15, cols=MARI + ['#c2384b']); finish(im, 'wedding', 130)
im = grad('#2a1611', '#5e3524'); im = bokeh(im, ['#ffcf73', '#ffe8b8', '#f7b6a4'], 70, 10, 80, 14, (40, 130)); im = candles(im, 6); im = petals(im, ['#c2384b', '#f2a7af'], 30, region=(0, 600, W, H)); finish(im, 'reception')
im = grad('#fbe2e2', '#c2384b'); im = bokeh(im, ['#ffffff', '#f7c6cc'], 50, 10, 60, 12); im = garland(im, 60, 80, cols=['#c2384b', '#e8738a', '#ffffff']); im = diya(im, W // 2, 520); finish(im, 'roka')
im = grad('#fbf7f0', '#f3e2dc'); im = bouquet(im, W // 2, H // 2 + 20, 1.25); im = petals(im, ['#c2384b', '#f2a7af', '#f7c6cc'], 26); finish(im, 'other', 60)
im = grad('#8a1c2b', '#4a0c16'); im = bokeh(im, ['#b8323f', '#e8a317'], 40, 6, 30, 8); im = bouquet(im, W // 2, H // 2 + 40, 1.2); finish(im, 'outfit', 90)
