#!/usr/bin/env python3
"""Catalogue thumbnails of the rims as Cycles renders in the white product-photo studio of finish_calibrate.py, one per
wheel and finish, with the same photo-matched finish recipes as the wheel layers (wheel-combos.ts). Writes transparent
PNGs to .scratch/rim-thumbs/<wheel>__<finish>.png; scripts/render/rim-thumbs-pack.py then trims and packs them.

    bun scripts/prerender/wheel-combos.ts <decoded rims dir> 0 > combos.json
    PATH=/opt/bpyenv/bin:$PATH python3 scripts/prerender/rim-thumbs-cycles.py combos.json <decoded rims dir>
"""
import json, os, subprocess, sys, tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if len(sys.argv) != 3:
    sys.exit(__doc__)
combos_path, rims_dir = sys.argv[1], sys.argv[2]
try:
    with open(combos_path) as f:
        combos = json.load(f)
except (OSError, ValueError) as e:
    sys.exit(f'{combos_path}: {e}')
out_dir = os.path.join(ROOT, '.scratch', 'rim-thumbs')
try:
    os.makedirs(out_dir, exist_ok=True)
except OSError as e:
    sys.exit(f'cannot create {out_dir}: {e}')
by_rim = {}
for c in combos:
    wheel, finish, _ = c['name'].split('__')
    by_rim.setdefault(c['rims'][0], []).append({'name': f'{wheel}__{finish}', 'finish': c['finish']})
for rim, trials in by_rim.items():
    try:
        with tempfile.NamedTemporaryFile('w', suffix='.json', delete=False) as t:
            json.dump(trials, t)
    except OSError as e:
        sys.exit(f'cannot write the trials file for {rim}: {e}')
    try:
        r = subprocess.run(['flock', '/tmp/forged-heavy.lock', sys.executable, os.path.join(ROOT, 'scripts/prerender/finish_calibrate.py'), '--',
                            rim, t.name, out_dir, '--size', '900', '--samples', '64'], capture_output=True, text=True)
    finally:
        try:
            os.unlink(t.name)
        except OSError:
            pass   # a temp file that is already gone is not an error
    if r.returncode:
        sys.exit(f'{rim}: finish_calibrate.py failed:\n{r.stderr[-400:]}')
    print(rim, [x['name'] for x in trials], flush=True)
