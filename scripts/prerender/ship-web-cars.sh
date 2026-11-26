#!/usr/bin/env bash
# Puts licensed cars on the live engine: their web GLB (scripts/prerender/web-cars.sh) goes to public/models, the catalogue row gets the
# model fields (real length kept), the manifest entry turns from frames-only into frames + live model (as the four prepared cars: Cycles frames
# at rest, the GLB when the car is turned), and the credits row records the author's permission. One migration per car is written, not applied.
#   scripts/prerender/ship-web-cars.sh <car id> [car id ...]
# Needs the dev server only for nothing: ingest runs without --check. Author's permission (CREDITS.md) must be filed before this is merged.
set -uo pipefail
cd "$(dirname "$0")/../.."
[ $# -gt 0 ] || { echo "usage: $0 <car id> ..."; exit 2; }
fail=0
for id in "$@"; do
  glb=".scratch/web/$id.glb"
  [ -s "$glb" ] || { echo "FAILED $id: no $glb (run web-cars.sh)"; fail=1; continue; }
  len=$(node -e "
const t=require('fs').readFileSync('data/configuratorData.ts','utf8');const m=t.slice(t.indexOf('export const BMW_MODELS'),t.indexOf('export const BMW_PAINTS'));
const p=m.split(/^    id: '/m).slice(1).find(s=>s.startsWith('$id'+\"'\"));const v=p&&(p.match(/modelLengthM:\s*([\d.]+)/)||[])[1];if(!v){process.exit(1)}console.log(v)") \
    || { echo "FAILED $id: no modelLengthM in the catalogue"; fail=1; continue; }
  if ! node scripts/ingest-car.mjs "$glb" --car "$id" --length "$len" --hide-match '(^|[^a-z])rim($|[^a-z])' --keep-renders > ".scratch/web/ship-$id.log" 2>&1; then
    echo "FAILED $id: ingest (see .scratch/web/ship-$id.log)"; fail=1; continue
  fi
  git checkout -- public/models/CREDITS.md   # ingest writes a generic 'licence not confirmed' row; the real one is written below
  python3 - "$id" <<'PY' || { echo "FAILED $id: manifest/credits edit"; fail=1; continue; }
import json, re, sys
car = sys.argv[1]
p = 'public/renders/manifest.json'
raw = open(p).read(); m = json.loads(raw)
e = m.get(car)
if isinstance(e, dict): m[car] = e['views']
elif e is None: sys.exit(f'{car} is not in the manifest')
open(p, 'w').write(json.dumps(m, indent=1, ensure_ascii=False) + ('\n' if raw.endswith('\n') else ''))
c = 'public/models/CREDITS.md'; t = open(c).read()
old_file = f"_(no file: frames only)_ `../renders/{car}/`"
if old_file not in t: sys.exit(f'no frames-only credits row for {car}')
t = t.replace(old_file, f"`{car}.glb`, frames `../renders/{car}/`", 1)
i = t.index(f"`{car}.glb`, frames"); j = t.index('\n', i)
row = t[i:j].replace("Blendkit **Royalty Free** (paid plan, the owner's account)",
    "Blendkit **Royalty Free** (paid plan, the owner's account); served live with the author's permission (Zifir3D Fedorov, 2026-11-25, written reply to be filed)", 1)
t = t[:i] + row + t[j:]
open(c, 'w').write(t)
PY
  echo "OK $id (length $len)"
done
exit $fail
