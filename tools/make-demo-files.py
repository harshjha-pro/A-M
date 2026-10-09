#!/usr/bin/env python3
"""Demo files for the staging seed (db/dev/seed_demo.sql `files` rows), so the demo
documents open and show thumbnails instead of 404. Staging only: tools/make-site.sh
copies db/dev/demo-files/ into private/storage/ for the staging flavour.

Run once after changing the seed:  python3 tools/make-demo-files.py
"""
import os
import re
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'db', 'dev', 'demo-files')
SEED = os.path.join(ROOT, 'db', 'dev', 'seed_demo.sql')

ROW = re.compile(r"\(\d+, '[0-9A-Z]{26}', '(uploads/[^']+)', '((?:[^']|'')+)', '([a-z/]+)', \d+, '[0-9a-f]{64}', (\d+|NULL), (\d+|NULL),")


def font(size):
    for path in ('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', '/usr/share/fonts/dejavu/DejaVuSans-Bold.ttf'):
        if os.path.exists(path):
            return ImageFont.truetype(path, size)
    return ImageFont.load_default()


def image(path, name, mime, w, h):
    img = Image.new('RGB', (w, h), (250, 246, 240))
    d = ImageDraw.Draw(img)
    d.rectangle([0, 0, w, h // 6], fill=(122, 28, 43))
    d.text((w // 20, h // 24), 'A&M demo file', font=font(max(24, w // 16)), fill=(255, 255, 255))
    y = h // 4
    for line in (name, 'Sample only — not a real document', 'Bhilwara · 2026'):
        d.text((w // 20, y), line, font=font(max(18, w // 24)), fill=(40, 30, 30))
        y += max(30, w // 12)
    for i in range(6):
        d.line([w // 20, y + i * (h // 20), w - w // 20, y + i * (h // 20)], fill=(200, 190, 180), width=3)
    if mime == 'image/png':
        img.save(path, 'PNG', optimize=True)
    else:
        img.save(path, 'JPEG', quality=60, optimize=True)


def pdf(path, name):
    text = f'A&M demo file: {name} (sample only)'.replace('\\', '\\\\').replace('(', '\\(').replace(')', '\\)')
    stream = f'BT /F1 18 Tf 60 760 Td ({text}) Tj ET'.encode('latin-1', 'replace')
    objs = [
        b'<< /Type /Catalog /Pages 2 0 R >>',
        b'<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
        b'<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
        b'<< /Length ' + str(len(stream)).encode() + b' >>\nstream\n' + stream + b'\nendstream',
        b'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    ]
    out = bytearray(b'%PDF-1.4\n')
    offsets = []
    for i, o in enumerate(objs, 1):
        offsets.append(len(out))
        out += f'{i} 0 obj\n'.encode() + o + b'\nendobj\n'
    xref = len(out)
    out += f'xref\n0 {len(objs) + 1}\n0000000000 65535 f \n'.encode()
    for off in offsets:
        out += f'{off:010d} 00000 n \n'.encode()
    out += f'trailer\n<< /Size {len(objs) + 1} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF\n'.encode()
    with open(path, 'wb') as f:
        f.write(out)


def main():
    sql = open(SEED, encoding='utf-8').read()
    rows = ROW.findall(sql)
    assert rows, 'no files rows found in the seed'
    for rel, name, mime, w, h in rows:
        name = name.replace("''", "'")
        path = os.path.join(OUT, rel)
        os.makedirs(os.path.dirname(path), exist_ok=True)
        if mime == 'application/pdf':
            pdf(path, name)
        else:
            image(path, name, mime, int(w), int(h))
        print(rel, os.path.getsize(path))


if __name__ == '__main__':
    main()
