#!/usr/bin/env bash
# Puts licensed cars on the live engine: their web GLB (scripts/prerender/web-cars.sh) goes to public/models, the catalogue row gets the
# model fields (real length kept), the manifest entry turns from frames-only into frames + live model (as the four prepared cars: Cycles frames
# at rest, the GLB when the car is turned), and the credits row records the author's permission. One migration per car is written, not applied.
#   scripts/prerender/ship-web-cars.sh <car id> [car id ...]
# Needs no dev server (ingest runs without --check). The author's written permission (CREDITS.md) must be filed before this is merged.
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
  credits_before=$(mktemp) && cp public/models/CREDITS.md "$credits_before" || { echo "FAILED $id: cannot back up CREDITS.md"; fail=1; continue; }
  if ! node scripts/ingest-car.mjs "$glb" --car "$id" --length "$len" --hide-match '(^|[^a-z])rim($|[^a-z])' --keep-renders > ".scratch/web/ship-$id.log" 2>&1; then
    cp "$credits_before" public/models/CREDITS.md; rm -f "$credits_before"   # a failed ingest must not leave its generic credits row behind
    echo "FAILED $id: ingest (see .scratch/web/ship-$id.log); inspect git status before going on"; fail=1; continue
  fi
  # ingest adds a generic 'licence not confirmed' row; put back the file as it was before (keeping earlier cars' rows from this run), the real row is written below
  cp "$credits_before" public/models/CREDITS.md && rm -f "$credits_before" || { echo "FAILED $id: cannot restore CREDITS.md"; fail=1; continue; }
  python3 - "$id" <<'PY' || { echo "FAILED $id: manifest/credits edit"; fail=1; continue; }
import json, re, sys
car = sys.argv[1]
p = 'public/renders/manifest.json'
raw = open(p).read(); m = json.loads(raw)
e = m.get(car)
if isinstance(e, dict): m[car] = e['views']
elif e is None: sys.exit(f'{car} is not in the manifest')
import os
tmp = p + '.tmp'; open(tmp, 'w').write(json.dumps(m, indent=1, ensure_ascii=False) + ('\n' if raw.endswith('\n') else '')); os.replace(tmp, p)
c = 'public/models/CREDITS.md'; t = open(c).read()
old_file = f"_(no file: frames only)_ `../renders/{car}/`"
if f"`{car}.glb`, frames" in t:
    sys.exit(0)   # already shipped: the row is done
if old_file not in t: sys.exit(f'no frames-only credits row for {car}')
t = t.replace(old_file, f"`{car}.glb`, frames `../renders/{car}/`", 1)
i = t.index(f"`{car}.glb`, frames"); j = t.index('\n', i)
row = t[i:j].replace("Blendkit **Royalty Free** (paid plan, the owner's account)",
    "Blendkit **Royalty Free** (paid plan, the owner's account); served live with the author's permission (Zifir3D Fedorov, 2026-11-25, written reply to be filed)", 1)
t = t[:i] + row + t[j:]
tmp = c + '.tmp'; open(tmp, 'w').write(t); os.replace(tmp, c)
PY
  echo "OK $id (length $len)"
done
exit $fail
