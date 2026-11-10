---
name: forgedsa-resume
description: Pick up the FORGEDSA photoreal work exactly where it was left - the four prepared cars drawn live from GLB in the viewer look, the six stock-sheet GLB rims, Blender bodies and 360° rim spins for the hidden legacy wheels, the Blender spin finishes. Reads docs/CHECKPOINT.md, restores the tooling in a fresh container (bpy, rembg, numpy pin, dev server), and runs the next queued item with the exact commands. Use when someone says "continue", "carry on with the rims/cars", "where were we", "pick up the checkpoint", or starts a new session on this work.
---

# Resume the photoreal work

**The source of truth is `docs/CHECKPOINT.md`.** Read it first, then do the top unchecked item of its
queue. Update it (tick, add what you learned) before you stop, and commit it with the work.

## 1. Restore the tools (a fresh container has none of them)
```bash
pip install -q bpy "rembg[cpu]" pillow && pip install -q "numpy<2.0,>=1.26"   # bpy needs numpy 1.x; rembg still works
python3 -c "import bpy, rembg, numpy; print(numpy.__version__)"                  # expect 1.26.x
bun install
bunx vite --host 127.0.0.1 --port 5173 > /tmp/vite.log 2>&1 &                   # trace-mask, oncar, export need it
```
Rim photos come from Supabase storage; the harnesses fetch them with curl (pass a cache dir to reuse).

## 2. The rules (decided with the owner; don't re-litigate)
- **Live cars = the owner's prepared GLBs drawn live** (M2 CS `m2_g87`, M4 CS `m4_cs_g82`, M5 `m5_g90`, M5 Touring
  `m5_touring_g99`; `scripts/ingest-car.mjs`, `docs/ADD_PREPARED_CAR.md`) in the viewer look (`services/viewerStudio.ts`,
  `engine.setLook('viewer')`, "FORGED" plates). The eight hidden cars (`active: false`) keep their Blender bodies:
  `scripts/prerender/` → `public/renders/<car>/<view>/{gloss,matte}_{w,b}.webp`, recoloured per paint by `RenderedCarView`.
- **Wheels on the car: a GLB rim wins whenever `modelUrl` is set** (`applyWheelDesign` picks mode `model`; `rearModelUrl`
  for the staggered FSA001). All six stocked wheels (`forged_fsa001`, `forged_fsa002`, `forged_fsa_03`, `forged_fsa004`,
  `sixnine_ff1`, `sixnine_ff3`) are GLBs (`scripts/ingest-rim.mjs`). The photo/bar-face 2D route (`imageUrl`,
  `services/rimFaces.ts`) remains for wheels without a model: today the hidden legacy wheels. Never strip a stock wheel's
  `modelUrl` to "fix" it back to a photo face.
- **Rim page = Blender 360° spin where one exists** (the hidden legacy wheels). `scripts/rim3d/` builds a complete rim,
  `turntable.py` renders 36 frames × 5 finishes into `public/renders/rims/<wheelId>/`, `spin-manifest.py` lists them,
  `RimSpinView` plays them. The six stocked wheels have no spin yet (queue item), so their page draws the live GLB.
- **Spin finishes** (`scripts/rim3d/finishes.json` + `materials.py`): Liquid Metal (chrome), Satin Bronze, Satin Gold
  (#c4aa7f, measured from the client photo), Gloss Black (very-high-contrast tone curve), Silver = **brushed aluminium**.
  The finishes customers pick on the car are the stock sheet's (`forgedsa-rim-finishes`, `docs/WHEEL_INVENTORY.md`).
- Free only: CPU rendering here, no paid APIs, no GPU rental. Ask before buying any model.
- **The wheel catalogue is the owner's stock sheet** (`docs/WHEEL_INVENTORY.md`): real names FSA001-004/FF-1/FF-3, sizes,
  finishes and ZAR prices stored as USD ÷ 18.2. Hide a wheel with `active: false`, never delete it. A spin is no longer a
  gate for going live; stocked wheels are live as GLBs.

## 3. Common jobs
| Job | Commands |
|---|---|
| New wheel, clean front-on cut-out | `scripts/rim3d/convert.sh <cutout.png> <wheelId>` then judge with `turntable.py … --frames 1 --only silver` |
| New wheel, angled photo | `rembg` cut-out → `scripts/rim3d/rectify.py` (fit the lip) → if spokes are straight bars: polar grid, write `docs/rim-template/<id>-spec.json`, `make-bar-face.py`, `overlay.py`, `build_rim.py <spec> full.glb` |
| Spin for the rim page | `python3 scripts/rim3d/turntable.py <full.glb> public/renders/rims/<id> --frames 36 --samples 16 --size 900x675 --only liquid_metal,bronze,satin_gold,black,silver && python3 scripts/rim3d/spin-manifest.py` (~75 min, resumable: rerun to continue) |
| New stock rim (GLB) | `node scripts/ingest-rim.mjs <rim.glb> --wheel <id> --check` (staggered: `--rear <rear.glb>`); sheet in `docs/ingest/rims/<id>.jpg` |
| Check a wheel on a live car | `node scripts/render/shoot.cjs <out> shots.json` with `"wheel":"<wheelId>"`, `"car":<1|5|7|8>` and `"q":"&look=viewer"` (as customers see it). `oncar.cjs` is for the hidden Blender-bodied cars |
| New prepared car | `node scripts/ingest-car.mjs <car.zip|car.glb> --car <id> --check` (live GLB; `--render` for Blender frames) |
| New car body (Blender, hidden cars) | `scripts/prerender/render-all.sh <carIndex>` (~15 min/car) |

## 4. Pitfalls already paid for
- Background jobs are killed at 2 h: one wheel per job, or rely on turntable's resume.
- `pkill -f <pattern>` matches your own shell; kill by PID from `ps`.
- `rembg` keeps the barrel seen through the windows as solid: fine for silver-on-wood photos after rectify,
  useless for black wheels (use the bar route). Rectify must never mirror (directional spokes).
- `processRimPhoto` can guess the wrong symmetry (FSA-06 traced 12-fold): count spokes in the cut-out first.
- Traced faces stay flat (`dish` 0): bending a curve-filled face kinks it. No hub pad on traced faces (coplanar = crumple).
- Commit spin frames only when a wheel is complete (the manifest is rebuilt from `spin.json`, written last).
