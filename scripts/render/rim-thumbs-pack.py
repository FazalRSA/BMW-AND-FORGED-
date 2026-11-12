#!/usr/bin/env python3
"""Trims the raw rim renders from rim-thumbs.cjs (.scratch/rim-thumbs/<wheel>__<finish>.png, transparent
background) to the rim, centres each on a square canvas and writes public/rim-thumbs/<wheel>/<finish>.webp
plus data/rimThumbs.json ({wheelId: [finishId, ...]}), which RimThumb reads to prefer a rendered thumbnail.

    python3 scripts/render/rim-thumbs-pack.py
"""
import json, pathlib
from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parents[2]
RAW, OUT = ROOT / '.scratch/rim-thumbs', ROOT / 'public/rim-thumbs'
PX = 768      # the collection hero shows it at 340 CSS px, so 2x screens get a sharp copy
MARGIN = 0.02

manifest = {}
for f in sorted(RAW.glob('*__*.png')):
    wheel, finish = f.stem.split('__')
    im = Image.open(f).convert('RGBA')
    # the rim's own pixels (alpha above a hair, so stray anti-aliasing doesn't widen the box)
    box = im.getchannel('A').point(lambda a: 255 if a > 8 else 0).getbbox()
    if not box:
        raise SystemExit(f'{f.name}: empty render')
    rim = im.crop(box)
    side = round(max(rim.size) * (1 + 2 * MARGIN))
    sq = Image.new('RGBA', (side, side), (0, 0, 0, 0))
    sq.paste(rim, ((side - rim.width) // 2, (side - rim.height) // 2))
    (OUT / wheel).mkdir(parents=True, exist_ok=True)
    sq.resize((PX, PX), Image.LANCZOS).save(OUT / wheel / f'{finish}.webp', 'WEBP', quality=88, method=6)
    manifest.setdefault(wheel, []).append(finish)
    print(f'{wheel}/{finish}.webp  rim {rim.size}')
(ROOT / 'data/rimThumbs.json').write_text(json.dumps(manifest, indent=2) + '\n')
