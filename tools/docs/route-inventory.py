#!/usr/bin/env python3
"""Write docs/ROUTES.md: every API operation in docs/openapi.yaml with who may use it.

Run from the repo root: python3 tools/docs/route-inventory.py
The endpoint coverage test already proves every built route is in openapi.yaml, so this
table is the full list. Re-run after adding routes.
"""
import pathlib
import yaml

root = pathlib.Path(__file__).resolve().parents[2]
spec = yaml.safe_load((root / 'docs/openapi.yaml').read_text(encoding='utf-8'))
WHO = 'Adm = Ayush and Mahi · Ed = anyone who edits (not Viewer) · Money = money users · All = everyone logged in'
rows = []
for path, item in spec['paths'].items():
    for method in ('get', 'post', 'put', 'patch', 'delete'):
        op = item.get(method)
        if not op:
            continue
        summary = ' '.join(str(op.get('summary', '')).split()).replace('|', '\\|')
        perm = str(op.get('x-permission', 'Public' if not op.get('security', True) else '—')).replace('|', '\\|')
        tag = (op.get('tags') or ['—'])[0]
        rows.append((tag, path, method.upper(), perm, summary))
rows.sort(key=lambda r: (r[0], r[1], r[2]))
out = ['# API route inventory', '', f'Generated from `docs/openapi.yaml` by `tools/docs/route-inventory.py` — {len(rows)} operations.', '',
       f'Who: {WHO}.', '', '| Area | Method | Path | Who | What |', '|---|---|---|---|---|']
out += [f'| {t} | {m} | `{p}` | {w} | {s} |' for t, p, m, w, s in rows]
(root / 'docs/ROUTES.md').write_text('\n'.join(out) + '\n', encoding='utf-8')
print(f'docs/ROUTES.md: {len(rows)} operations')
