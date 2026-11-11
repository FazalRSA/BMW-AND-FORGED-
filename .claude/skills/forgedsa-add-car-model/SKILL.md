---
name: forgedsa-add-car-model
description: Add or replace a BMW car in the FORGEDSA configurator. Covers sourcing a licensed 3D model, compressing it, finding the paint and hide regexes, wiring it into Supabase and the bundled fallback, and verifying it renders. Use when a car is added, swapped, looks wrong (unpainted panels, original wheels showing, wrong size or rotation) or when a model has to be rebuilt from a multi-variant source.
---

# Add or replace a car model

The car catalogue lives in Supabase `public.cars` (source of truth) and is mirrored in
`data/configuratorData.ts` (offline fallback). Both must agree.

> Full process with file types, limits, checks and go-live: `docs/PRODUCT_SPEC_CARS_AND_WHEELS.md`.

## 0. Prepared package? One command (do this first)

A car package in the `3d cars` convention (zip with `web/<car>_web.glb`, wheels `C10_Wheel_FL..C13_Wheel_RR`,
brakes `C20..C23`, material `Paint`; any clean GLB whose wheels and paint are findable by name also works):

```bash
node scripts/ingest-car.mjs <car.zip|car.glb> --car <id> --check        # dev server on 5173 for --check
```

It checks the file like the engine (4 wheels in 4 corners, paint material), copies it to `public/models/<id>.glb`,
updates the fallback + writes the migration, retires the car's old Blender frames (live GLB mode) or re-renders
them with `--render` (bpy), and shoots `docs/ingest/<id>.jpg`. Full runbook: `docs/ADD_PREPARED_CAR.md`.
Rims: `node scripts/ingest-rim.mjs <rim.glb> --wheel <id> --check`. Steps 1-6 below are the manual route for
other files.

## 1. Source the model and check the licence first

- The browser downloads the GLB, so anyone can extract it. The licence must allow **commercial,
  real-time/web** use. CC BY (credit required), Sketchfab Free Standard, or a paid licence that
  names real-time/interactive use.
- Reject **Editorial** licences (no commercial use) and CC BY-NC. Watch for "CC BY" re-uploads of
  someone else's NC model; they are unlicensed.
- Many community uploads derive from game assets. Note it in `public/models/CREDITS.md` and flag a
  formal licence check before a large launch.
- Record author, link and licence in `public/models/CREDITS.md` in the same commit.

## 2. Prepare the GLB

- Compress: `npx @gltf-transform/cli optimize in.glb out.glb --texture-compress webp`. Aim for
  under 15 MB (the `car-models` bucket limit is 50 MB).
- Multi-variant sources (game mods that stack every bumper, hood and interior in one file) need a
  build script. The old X5 M script (`scripts/build-x5m-lci.mjs`, removed 2026-11-11, see git history) showed the pattern: keep one coherent variant, zero the kept parts'
  node translations, rebuild PBR materials from mesh names, mount one wheel per corner, then run
  meshopt.
- Do **not** smooth or crease normals on car bodies (`toCreasedNormals` broke the M5 bumper).

## 3. Find the paint and hide regexes

The engine (`services/CarConfiguratorEngine.ts`) paints meshes whose own or material name matches
`paint_mesh_match`, except those matching `notPaintRe`
(`glass|window|light|lamp|chrome|trim|rubber|interior|carbon|grille|badge|logo|plastic`). It hides
the model's own wheels via `hide_mesh_match`, default `DEFAULT_HIDE`
(`(^|[^a-z])(wheel|rim|tyre|tire|brake|caliper|calliper|rotor|lugs?)`).

- Real exports rarely use "paint" or "body". List the mesh and material names (browser console
  after load, or a small `@gltf-transform/core` script) and write **literal** per-model patterns.
  Example: M4 = `zx1mtl|body151mtl|pillars1mtl`.
- A panel left in its baked grey or black texture means a body material is missing from the regex.
- Forged wheels are placed only when **four** wheels are found by the hide regex.

## 3b. Part rules that fix wrong-looking trim (services/carMaterials.ts)

- `NAME_OVERRIDES`: per-file quirks (a white grille-bar material, a yellow livery outline).
- A black, untextured, non-metal material is never chrome, whatever its parent groups are called.
- Chrome in the middle of the front fascia becomes gloss black (grille bars modelled as chrome).
- Materials named engine / radiator are black (seen through the grille).
- Keep the model's own calipers: leave `caliper` out of `hide_mesh_match`. The caliper-named material
  takes the caliper colour and our calipers are hidden. A GLB's own credit is in its `asset.extras`.

## 4. Wire it in

- Write a migration in `supabase/migrations/` (see `20260927020000_m4_paint_fix.sql` and
  `20260927100000_x5m_lci_and_photoreal_paint.sql`) that upserts the row. Set `model_url`,
  `model_rotation_deg`, `model_length_m` (the real length in metres), `paint_mesh_match`,
  `hide_mesh_match` and `paint_ids`.
- Apply it with the Supabase MCP `apply_migration` (project `qxlfkfhzpqbxffuqqewg`) and read the row
  back.
- Mirror the same values in `data/configuratorData.ts`.
- Or, for non-developers: `/admin` → Cars → Upload GLB → set the fields → Save.

## 5. Material pass (automatic, but check it)

Every non-paint part goes through `services/carMaterials.ts` (`passMaterial`). It classifies the
part by mesh, parent and material names and sets studio values:
- tinted glass with an additive reflection overlay;
- clear lens; red tail lens; neutral chrome; gloss carbon; gloss "shadow line" black;
- interior at envMapIntensity 0.35.

Names lie (the M3's front windows use `Taillightglass21Mtl`). After adding a car, load it in
`scripts/render/engine.html`, group `window.e.bodyMeshGroup` meshes by `material.userData.partKind`,
and fix any misfiled part by tightening the rules (colour-gate them), never with per-mesh hacks.

## 6. Verify

Use the `forgedsa-render-verification` skill and the full checklist in `3d-car-perfect`. Render
front three-quarter, side and rear in at least one metallic and one black paint. Check:
- one consistent paint colour and no floating unpainted panels;
- glass tinted, not coloured;
- red tail lights, clear headlight covers;
- forged wheels seated in the arches, with the caliper visible behind the spokes;
- correct scale.

## Current line-up (Nov 2026)

**Active (4), all prepared GLBs drawn live** (`data/configuratorData.ts`, migration
`20261110141000_legacy_cars_hidden.sql`): M4 CS G82 (`m4_cs_g82`), M2 CS G87 (`m2_g87`), M5 G90
(`m5_g90`), M5 Touring G99 (`m5_touring_g99`).

**Hidden (`active: false`, 8):** M4 G82, M4 Convertible G83 (no model), M3 G80, M3 Touring G81,
M235i F74, M8 F92, X3 M50 G45, X5 M F95: Sketchfab-era bodies kept until a prepared package
replaces them (reactivate in `/admin`). Reactivate a car only with a model that passes the checks
above. In `scripts/render/engine.html`, `car=N` indexes the full `BMW_MODELS` list including the
hidden cars: the live ones are 1 (M4 CS), 5 (M2 CS), 7 (M5), 8 (M5 Touring); `car=0` is the hidden M4 G82.
