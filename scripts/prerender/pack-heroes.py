#!/usr/bin/env python3
"""Packs the --hero renders (<dir>/<car>/hero.png) into public/hero/<car>-1600.webp and -960.webp.

    python3 scripts/prerender/pack-heroes.py <heroes dir> [car ...]     # no cars: every car found in the folder

Bump HERO_VERSION in components/journey/HeroStage.tsx afterwards (the files keep their names and /hero/ is cached for days).
"""
import os, sys
from PIL import Image

if len(sys.argv) < 2:
    sys.exit(__doc__)
src, only = sys.argv[1], sys.argv[2:]
out = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), 'public', 'hero')
try:
    cars = sorted(d for d in os.listdir(src) if os.path.exists(os.path.join(src, d, 'hero.png')))
except OSError as e:
    sys.exit(f'{src}: {e}')
for car in (only or cars):
    path = os.path.join(src, car, 'hero.png')
    try:
        with Image.open(path) as im:
            still = im.convert('RGB')
    except OSError as e:
        sys.exit(f'{path}: {e}')
    for w in (1600, 960):
        dst = os.path.join(out, f'{car}-{w}.webp')
        try:
            still.resize((w, round(w * 9 / 16)), Image.LANCZOS).save(dst, 'WEBP', quality=86, method=6)
        except OSError as e:
            sys.exit(f'{dst}: {e}')
    print(car, 'packed')
