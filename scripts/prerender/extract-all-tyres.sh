#!/usr/bin/env bash
# Extracts every licensed car's own factory tyres (extract_factory_tyres.py) next to its scene.glb, for wheel-layers.sh.
#   PATH=/opt/bpyenv/bin:$PATH scripts/prerender/extract-all-tyres.sh
cd "$(dirname "$0")/../.."
# car id | original blend (under /opt/blendkit-assets) | folder holding its scene.glb (under .scratch/private)
while IFS='|' read -r car blend dir; do
  f=/opt/blendkit-assets/$blend
  [ -f "$f" ] || { echo "== $car: no $f"; continue; }
  mkdir -p ".scratch/private/$dir"
  out=$(python scripts/prerender/extract_factory_tyres.py -- "$f" ".scratch/private/$dir/factory_tyres.blend" 2>&1)
  # a car that did not print EXTRACTED failed, whatever the reason: say so instead of skipping it quietly
  echo "$out" | grep -E "EXTRACTED|no tyre|Error" | sed "s/^/$car: /"
  echo "$out" | grep -q EXTRACTED || echo "$car: FAILED (no EXTRACTED line)"
done <<'LIST'
ix3_m60|ix3_m60/ix3_m60.blend|ix3
m240i_g42|m240i_g42/m240i_g42_fixed.blend|m240i_g42
m340i_touring_g21|m340i_touring_g21/m340i_touring_g21.fixed.blend|m340i_touring_g21
m3_cs_g80|m3_cs_g80/m3_cs_g80_fixed.blend|m3_cs_g80
m3_cs_touring_g81|m3_cs_touring_g81/m3_cs_touring_g81.fixed.blend|m3_cs_touring_g81
m3_g80|m3_g80/m3_g80.blend|m3
m3_touring_g81|m3_touring_g81/m3_touring.blend|m3t
m4_convertible_g83|m4_convertible_g83/m4_convertible_g83.blend|m4_convertible_g83
m4_csl_g82|m4_csl_g82/m4_csl_g82_fixed.blend|m4_csl_g82
m4_g82|m4_g82/m4_g82_fixed.blend|m4_g82
x1_u11|x1_u11/x1.blend|x1
x3_g45|x3_g45/x3.blend|x3
x3_30e_g45|x3_20d_g45/x3_20d_g45.fixed.blend|x3_20d_g45
x5_g05|x5_g05/x5_g05.fixed.blend|x5_g05
x5m_f95|x5m_f95/x5m_f95.blend|x5m_f95
LIST
