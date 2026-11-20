---
name: forgedsa-frames-only-car
description: Make a licensed car model (Blendkit Royalty Free, or any model whose licence forbids serving the GLB) look exactly like the cars already in the FORGEDSA configurator, end to end - private model fixes, Cycles frames in the dark studio, per-view depth, frames-only publish, in-app check, paint proofs, three independent reviews plus a review of the fixes, then one commit per car. Use when adding any BMW from a Blender file, when a frames-only car looks wrong (tailpipes hanging below the bumper, grille parts poking past the outline, satin trim rendering black, squiggly lamp reflections, near-black glass, a plate sliver at the frame edge), or when asked to make all cars look like the ones in the app.
---

# A frames-only car that matches the app

The cars in the line-up look alike because they are made the same way, not because each one was tuned: the same
dark studio (`render_car.py --studio dark --samples 12 --width 1440`), the same recolour passes (`gloss_w/b`,
`matte_w/b`, `flake_w`), the same live forged wheels behind a per-view `depth.png`. The only per-car levers are
**private model fixes** and **`CAR_FIXES`** entries. Never relight or re-grade one car to make it look better: fix the
model or the material, and the studio does the rest.

Base runbook (commands, file formats, licence rules): `docs/ADD_PREPARED_CAR.md`, "Frames-only cars". This skill is
the process around it and the defects it has to catch. Third-party Blender skill packs were searched on 2026-11-20
(cc-blender-skill, kevinbadi/blender-skills, skills-hub "realistic style"): none has car paint, bodywork lighting or
colour-management rules, and all need Blender's UI, so they add nothing here.

## 1. Build (one car at a time; the machine has no GPU)

1. **Research first**: the exact variant the model shows (facelift or not, trim colours, tailpipes, badges), BMW's
   data sheet figures, the launch paint range of *that* model year. Save it as `research.json` in the evidence folder.
2. **Private fixes** in `.scratch/private/<carId>/` (git-ignored, never committed): `fix_blend.py` on a copy of the
   download in `/opt/blendkit-assets/<carId>/`, `prepare_blend.py`, `export-scene.cjs` with `len=` **scaled by the
   wheelbase**, then `patch_scene.py` (plates to the model's own plate positions). Keep a `REBUILD.txt` listing the
   order: the container restarts every few hours and the next session must be able to redo it.
3. **Preview before rendering**: render close-ups of the fixed blend in a quick studio (`studio.py`, about 15 s each)
   from the angles the app uses. For the wheel view use the exact camera: read `CAM_frontWheel` from `scene.glb`
   (node matrix) and convert glTF to Blender as `(x, -z + dy, y)`, where `dy` lines the two files up.
4. **Render**: depth for every view, then frames; per-view options with a suffixed key (`--car <carId>:top --views
   top`); a view rendered with `--hide` needs `render_depth.py --hide` with the same regex. Then `despeckle.py` (stray
   shadow-catcher dots from light linking) and `frames-only.sh` under `/tmp/forged-manifest.lock`.
5. **Data**: catalogue entry (BMW's `modelLengthM`, comment says the scaled length), migration
   `<stamp>_car_<carId>_frames_only.sql` (`model_url` NULL), `HERO_SLIDES` (paint is one of the car's), `CREDITS.md`
   row. A paint the palette lacks goes into `BMW_PAINTS` **and** its own paints migration that sorts before the car's.

Heavy work (Blender, Chromium) takes `/tmp/forged-heavy.lock` one job at a time. About 25-40 minutes of CPU per car.

## 2. Check in the real app

- `CAR_ROW=row.json PAINT_ROWS=paint_rows.json node scripts/render/frames-car.cjs <out> <carId> "<slide>" --hero`,
  then once more without `--hero` (run 1 writes the welcome image, run 2 shows it). It must end `<carId>: ok` with no
  `.glb` of the car requested.
- **Paint proofs** in every paint the car offers, plus rear, side, front, top and wheel: `scripts/render/shoot.cjs`
  with an `eval` that calls `renderedStills` from `services/renderedBody.ts`. Look paints up **by id**
  (`STATIC_CATALOG.paints.find(...)`), never by index: adding a paint shifts every index. Shoot at 20": the proof page
  drops FSA001's spoke face at 19" (the real configurator does not; checked on the M4 CSL).

## 3. Review: nothing is committed on the builder's word

1. **Round 1, three independent reviewers in parallel**, each with one lens, read-only, judging only images they open
   at full size:
   - **fit**: wheels in the arches, far wheels hidden, plates, nothing floating or poking past the outline;
   - **materials**: paint in every proof, what is and is not recoloured (diff `gloss_w` against `gloss_b`), glass,
     lamps, trim, chrome;
   - **accuracy**: reference photos against the renders, and every published figure and paint id against the data.
   A blocker is anything a customer would see as wrong, fake or broken. A missing real launch colour, or a paint BMW
   never offered on that model year, is a blocker. Give reviewers local evidence; a reviewer that waits on a tool
   permission stalls the run, so tell them which tools to use.
2. **Fix** every blocker and every cheap minor at the cause, re-render only the views that change, re-run the app check
   and the affected proofs.
3. **Round 2**, one reviewer of the fixes, with the round-1 findings and the before frames (`frames.r0`): each fix
   confirmed or not, plus any regression. Measure what can be measured (silhouette pixels, sampled colours) and say so
   in the commit.

## 4. Defects seen so far, and what fixed them

| Looks like | Cause | Fix |
|---|---|---|
| A real launch colour missing, or a later model year's colour standing in | palette gap | add to `BMW_PAINTS` with its own paints migration; use the shown car's range (Melbourne Red, not Fire Red, on a pre-2024 M240i) |
| Pale V or white squiggles on a tail-lamp bar | the outer lens mirrors the light strips at its cut edges | `glass_unlink` on the outer lens meshes (`backlamp_...`) |
| Near-black side glass | no light inside the cabin | `dark: {cabin_h, cabin_y, cabin_l, cabin_rad, cabin_floor: 0}` (G05: 1.45/0.35/2.0/5.0; G2x and G8x: 1.29/0.525/1.55/2.0) |
| Satin trim (Cerium Grey) renders black | high metallic reflects the black backdrop | its own satin material: more diffuse share, lower metallic |
| Chrome reads as grey plastic | metallic 0.75, roughness 0.12 | metallic about 0.92, roughness about 0.06 |
| Black saw-teeth past the nose in the wheel view | lower-grille insert stands proud of the intake frame | set the whole insert back behind the frame and taper it at the ends; check from the exact wheel camera |
| Tailpipe box hanging below the bumper or past it in profile | the donor's pipe position and a flat rear face | bottom flush with the apron edge, face cut to the apron's curve and set back; measure the side silhouette |
| Dark sliver at the wheel view's edge | front plate seen edge-on | `--hide '^Plate_Front$'` for that view's frames and depth |
| Dots of shadow in mid-air | shadow catcher plus light linking | `despeckle.py` before publishing |

## 5. Commit

- One car per commit, only its files and its entries in the shared files: stage with a helper that excludes the cars
  still in progress, take `BMW_PAINTS` from HEAD unless this car adds a paint, and never stage `.glb`, `.blend`,
  `.scratch/` or `row.json`.
- Lint the **committed** tree (a temporary worktree), push, keep one draft PR for the batch, list the migrations in
  order. Never apply a migration unless the owner says so.
- The commit body says what each review round found and what was fixed, with numbers, and what the owner must confirm
  (figures, paint codes and hex values, the SA paint list, the model year shown).
