#!/usr/bin/env bash
# Path-traced wheel layers for the configurator, every car in the line-up (docs/ADD_PREPARED_CAR.md, "Path-traced wheel
# layers"). Three passes, so the most-seen pictures land first: the main views at the first size, the other views, then
# the second size. Resumable: render_car.py keeps every finished file, so a container restart loses one render.
#
#   PATH=/opt/bpyenv/bin:$PATH scripts/prerender/wheel-layers.sh <decoded rims dir> <out dir> [car ...]
#   python3 scripts/prerender/publish_wheel_layers.py <out dir>      # any time: tone, WebP, public/renders/wheels.json
#
# Scenes: the four prepared cars from /tmp/prerender/<car>.glb (scripts/prerender/render-all.sh writes them), the
# frames-only cars from their private folder .scratch/private/<dir>/scene.glb (licensed files never leave it).
set -euo pipefail
cd "$(dirname "$0")/../.."
RIMS=${1:?usage: wheel-layers.sh <decoded rims dir> <out dir> [car ...]}
OUT=${2:?usage: wheel-layers.sh <decoded rims dir> <out dir> [car ...]}
shift 2
CARS=${*:-m4_cs_g82 m2_g87 m5_g90 m5_touring_g99 ix3_m60 m3_g80 m3_touring_g81 x1_u11 x3_g45 m3_cs_g80 m3_cs_touring_g81 m4_g82 m4_csl_g82 m4_convertible_g83 x3_30e_g45 x5_g05 x5m_f95 m240i_g42 m340i_touring_g21}
PY=$(command -v python || command -v python3)
mkdir -p "$OUT"
bun scripts/prerender/wheel-combos.ts "$RIMS" 0 > "$OUT/combos_0.json"
bun scripts/prerender/wheel-combos.ts "$RIMS" 1 > "$OUT/combos_1.json"

scene() {
  case $1 in
    m2_g87|m4_cs_g82|m5_g90|m5_touring_g99) echo /tmp/prerender/$1.glb;;
    ix3_m60) echo .scratch/private/ix3/scene.glb;;
    m3_g80) echo .scratch/private/m3/scene.glb;;
    m3_touring_g81) echo .scratch/private/m3t/scene.glb;;
    x1_u11) echo .scratch/private/x1/scene.glb;;
    x3_g45) echo .scratch/private/x3/scene.glb;;
    x3_30e_g45) echo .scratch/private/x3_20d_g45/scene.glb;;
    *) echo .scratch/private/$1/scene.glb;;
  esac
}
run() { # <combos file> <views>
  for car in $CARS; do
    g=$(scene "$car")
    if [ ! -f "$g" ]; then echo "== $car: no scene at $g, skipped"; continue; fi
    extra=()
    [ "$car" = m2_g87 ] && extra=(--hide '^Combined3DWheel')   # the M2 file's own wheel rings, as for its hero still
    # the car's own factory tyres (extract-all-tyres.sh), sized to the rim fitted; the four prepared cars (/tmp/prerender) keep theirs
    tb="$(dirname "$g")/factory_tyres.blend"; [ -f "$tb" ] && extra+=(--tyres-blend "$tb")
    echo "== $car $2 ($(date +%T))"
    if flock /tmp/forged-heavy.lock "$PY" scripts/prerender/render_car.py "$g" "$OUT/$car" --car "$car" --studio dark \
         --samples 12 --width 1440 --views "$2" --wheel-layer "$1" "${extra[@]}" > "$OUT/last.log" 2>&1; then
      echo "   rendered $(grep -c '^rendered' "$OUT/last.log" || true)"
    else
      echo "   FAILED (exit $?): see the end of $OUT/last.log"; tail -5 "$OUT/last.log"
    fi
  done
}
run "$OUT/combos_0.json" frontThreeQuarter,side,rearThreeQuarter
run "$OUT/combos_0.json" frontWheel,front,top
run "$OUT/combos_1.json" frontThreeQuarter,side,rearThreeQuarter,frontWheel,front,top
echo "DONE $(date +%T)"
