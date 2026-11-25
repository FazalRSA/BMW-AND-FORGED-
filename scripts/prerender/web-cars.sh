#!/usr/bin/env bash
# Builds the live-web GLB of licensed cars from their original .blend (export_web_car.py + meshopt/WebP), into .scratch/web/<id>.glb.
#   scripts/prerender/web-cars.sh [car id ...]     (default: every row of web-cars.tsv)
# Needs blender on PATH and /opt/blendkit-assets. Output stays in .scratch (never commit a GLB before the author's reply is filed in CREDITS.md).
set -uo pipefail
cd "$(dirname "$0")/../.."
mkdir -p .scratch/web
want=("$@"); fail=0
while IFS=$'\t' read -r id blend paint cal; do
  [[ -z "$id" || "$id" == \#* ]] && continue
  if [ ${#want[@]} -gt 0 ] && [[ ! " ${want[*]} " == *" $id "* ]]; then continue; fi
  args=(--paint "$paint"); [ -n "$cal" ] && args+=(--caliper "$cal")
  rm -f ".scratch/web/$id.raw.glb" ".scratch/web/$id.glb"   # never accept a file left by an earlier run
  blender -b --python scripts/prerender/export_web_car.py -- "/opt/blendkit-assets/$blend" ".scratch/web/$id.raw.glb" "${args[@]}" > ".scratch/web/$id.export.log" 2>&1
  rc=$?
  grep -E "EXPORTED|dropped|Error|Traceback|no material|no part|no TireColor|cannot open" ".scratch/web/$id.export.log" || true
  if [ $rc -ne 0 ] || [ ! -s ".scratch/web/$id.raw.glb" ]; then echo "FAILED $id: export (exit $rc), see .scratch/web/$id.export.log"; fail=1; continue; fi
  if ! npx --yes @gltf-transform/cli optimize ".scratch/web/$id.raw.glb" ".scratch/web/$id.glb" --compress meshopt --texture-compress webp --texture-size 2048 \
      --join false --flatten false --instance false --palette false --simplify false >/dev/null 2>&1; then echo "FAILED $id: optimize"; fail=1; continue; fi
  echo "OK $id $(du -h ".scratch/web/$id.glb" | cut -f1)"
done < scripts/prerender/web-cars.tsv
exit $fail
