# Render harness

Headless screenshots of the 3D engine, used to check every visual change (paint, studio, cars,
wheels, tyres, brakes) without a GPU. The full method is in
[`.claude/skills/3d-car-perfect/SKILL.md`](../../.claude/skills/3d-car-perfect/SKILL.md).

1. Start the dev server: `bunx vite --host 127.0.0.1 --port 5173`.
2. Write a shot list (JSON, see the header of `shoot.cjs`).
3. Run `node scripts/render/shoot.cjs <outDir> shots.json [rimCacheDir]`.

`engine.html` is the bare engine page. Its query parameters come from `data/configuratorData.ts`,
unfiltered, so hidden rows count:

- `car` is an index into the full `BMW_MODELS` list, hidden cars included. Live on 2026-11-10:
  `1` m4_cs_g82, `5` m2_g87 (M2 CS), `7` m5_g90, `8` m5_touring_g99. `0` is the retired Sketchfab
  M4; 2-4, 6 and 9-11 are the other hidden legacy cars.
- `paint` is an index into `BMW_PAINTS`.
- `wheel` is a wheel **id** (preferred, the same ids `ingest-rim.mjs` takes: `forged_fsa001`,
  `forged_fsa002`, `forged_fsa_03`, `forged_fsa004`, `sixnine_ff1`, `sixnine_ff3`) or an index into
  the full `WHEEL_DESIGNS` list, hidden designs included: `0`-`10` are the hidden legacy designs
  (`forged_fsa_01` .. `forged_fsa_14`), `11`-`16` the six stocked wheels in the order above.
- `finish` (id), `size` (e.g. `21"`) and `view` (camera preset).

For ad-hoc GLBs it also takes `model`, `rot`, `len`, `paintMatch` and `hideMatch`; `rimModel=` and
`rimFlip=1` put a rim file on the chosen wheel; `rendered=1` uses the Blender body frames.

`look=` picks the scene. `look=stage` is what `/configure` draws for customers (a black backdrop and a
pool of light on a pale floor). `look=viewer` is the older grey viewer dome, kept for comparison.
Without `look=` the page draws the softbox studio. The other engine switches are `plates=0` and, in
the softbox studio only, `studio=hdri`, `tone=agx|neutral` and `exposure=` (the stage and viewer
looks set their own tone mapping and exposure). A shot's `q` field in `shoot.cjs` passes any of these
through.

Shots take about a minute each on SwiftShader. Judge colour and gloss on a real device as well.

`outlines.cjs` checks how rim photos turn into spoke outlines, in seconds rather than minutes. It
draws the processed mask with the traced outlines over it, once per settings variant (see its
header). Use it to compare settings before rendering wheel close-ups. `blank.html` is the empty
page it runs in.

`swap-perf.cjs` measures wheel swaps in the real configurator: it taps every wheel twice (and
changes the size twice) at desktop and phone sizes, and writes each tap's long tasks and the time
until the new spokes are in the scene to a JSON file (see its header; `cold` and `preload` modes).
