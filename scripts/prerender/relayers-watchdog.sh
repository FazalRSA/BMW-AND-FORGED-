#!/usr/bin/env bash
# Restarts the wheel-layer re-render after a container restart (docs/ADD_PREPARED_CAR.md, "Path-traced wheel layers").
# Idempotent: does nothing if the render is already running or its log already says DONE. The render itself is resumable
# (render_car.py keeps every finished file), so a restart loses at most one render.
#   scripts/prerender/relayers-watchdog.sh [out dir, default .scratch/wl/out3]
cd "$(dirname "$0")/../.." || exit 0
OUT=${1:-.scratch/wl/out3}
LOG=$OUT.log
[ -d "$OUT" ] || exit 0
pgrep -f scripts/prerender/wheel-layers.sh >/dev/null && exit 0
grep -q '^DONE' "$LOG" 2>/dev/null && exit 0
[ -f /tmp/prerender/m2_g87.glb ] || exit 0   # the four prepared cars' scenes are rebuilt by render-all.sh; nothing to resume without them
CARS=; [ -f "$OUT.cars" ] && CARS=$(cat "$OUT.cars")   # a run limited to some cars lists them in <out>.cars
(PATH=/opt/bpyenv/bin:$PATH setsid nohup scripts/prerender/wheel-layers.sh .scratch/wl/rims2 "$OUT" $CARS >> "$LOG" 2>&1 &)
echo "wheel-layer render restarted ($(date -u +%T))"
