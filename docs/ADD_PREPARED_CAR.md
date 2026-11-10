# Add a prepared car to the configurator

For the car packages in Drive > **3d cars** (`BMW_M5_G90.zip`, `BMW_M5_Touring_G99.zip`,
`BMW_M4_CS_G82.zip`, `BMW_M2_CS_G87.zip`) and any future car built the same way. Each package holds
`web/<car>_web.glb` with the wheels named `C10_Wheel_FL` … `C13_Wheel_RR`, the brakes `C20_Brake_*`
and the body paint in a material called `Paint`. That is exactly what the configurator engine reads,
so one command does the whole job.

## One command per car

```bash
bun install                                              # once
bunx vite --host 127.0.0.1 --port 5173 &                 # dev server, needed only for --check and --render
node scripts/ingest-car.mjs BMW_M5_G90.zip --car m5_g90 --check
```

The script

1. unzips the package and takes the web build (`web/*_web.glb`);
2. checks it the way the engine will: four wheels by name in four corners, a `Paint` material, size,
   triangles, extensions (meshopt and WebP are fine; KTX2 is refused);
3. copies it to `public/models/<carId>.glb`;
4. writes the car's model fields into the bundled catalogue (`data/configuratorData.ts`) and a Supabase
   migration (`supabase/migrations/…_car_<carId>_prepared_model.sql`);
5. retires the car's old Blender render frames so the configurator draws the new GLB live (`--live`,
   the default), and rebuilds `public/renders/manifest.json`;
6. with `--check`, shoots four views headlessly into `docs/ingest/<carId>/` and a contact sheet
   `docs/ingest/<carId>.jpg`;
7. type-checks the catalogue edit.

Then: `git add -A && git commit && git push`, deploy, and apply the migration in Supabase (or set the
same fields in `/admin` > Cars). The migration also sets the car `active`.

### Which id

| Package | `--car` | Note |
|---|---|---|
| BMW_M5_G90.zip | `m5_g90` | replaces the old Sketchfab M5 |
| BMW_M5_Touring_G99.zip | `m5_touring_g99` | the row existed without a model; the migration activates it |
| BMW_M4_CS_G82.zip | `m4_cs_g82` | replaces the VR46 file |
| BMW_M2_CS_G87.zip | `m2_g87 --name "BMW M2 CS" --badge "M2 CS G87"` | the old "M2 Coupe" row, renamed |

A car that is not in the catalogue yet: add `--name "BMW X" --body coupe|sedan|suv|touring|…`; a row
with blank specs is created (the UI hides blank rows) for you to fill in `/admin`.

All four were ingested on 2026-11-10 (see `docs/ingest/*.jpg` for the check sheets).

### Options you may need

| Problem in the check sheet | Fix |
|---|---|
| Car faces the wrong way | `--rotation 180` (or 90 / 270) |
| Too big or small | `--length 4.79` (real length in metres) |
| A panel keeps its own colour | `--paint-match '(^\|[^a-z])paint($\|[^a-z])\|Body_Textured'` (regex on mesh + material names) |
| Model wheels still showing, forged wheels in the wrong place | `--hide-match '(^\|[^a-z])(wheel\|tyre\|brake)'`; the engine needs exactly four wheels by name |
| Only want the report | `--dry-run` |
| Re-run the screenshots without touching the renders | `--keep-renders --check` |

## Body modes: live GLB vs Blender frames

The configurator can draw a car two ways (`App.tsx`, `services/renderedBody.ts`):

- **Live GLB** (what the ingest sets up): the engine draws the model with the studio lighting, paint
  shader and materials pass; the forged wheels sit in the model's arches. Any car without render frames
  in `public/renders/manifest.json` works this way. This is the right mode for the prepared cars, whose
  panels are clean (the old Sketchfab files were dented, which is why their bodies were pre-rendered).
- **Blender frames** (`--render`): Cycles renders the body once per view with white and black paint
  bases, and the browser recolours them (the photoreal route from October). It needs Blender as a Python
  module and about 15 minutes per car:

  ```bash
  pip install bpy "numpy<2.0,>=1.26"
  node scripts/ingest-car.mjs BMW_M5_G90.zip --car m5_g90 --render --check
  ```

  Nothing else changes: the same GLB stays in the showroom, and the wheels stay live.

Going back to the old frames: `git checkout <commit> -- public/renders/<carId>` and rebuild the manifest
(`node scripts/ingest-car.mjs … --dry-run` does not; run `scripts/prerender/render-all.sh` with no
index, or delete `public/renders/manifest.json` entries by hand).

## The configurator screen looks like the viewer

Cars drawn live (the prepared four, and any car without Blender frames) sit in the four-car viewer's studio on
the configurator screen: the gradient dome, the floor that fogs into the horizon, the pool of shadow around the
footprint, Neutral tone mapping with the exposure set by the paint, and the viewer's two reflection coves (the
gloss cove for solid, metallic and pearl paints; the soft grey cove for Frozen). The port is
`services/viewerStudio.ts` (the viewer's numbers verbatim) and `CarConfiguratorEngine.setLook('viewer' | 'studio')`;
`App.tsx` turns it on for `/configure` only, so the showroom keeps its giant model name behind the car. The
headless harness takes `?look=viewer`. The viewer's Daylight and Golden-hour modes are not ported (the
configurator has one studio); its paint library maps onto the catalogue's paints (`type` Uni / Metallic / Pearl /
Frozen).

## Rims the same way

A rim GLB in the website's convention (`Rim_Barrel`, `Rim_Face_Spokes`, `Center_Cap`, `Hardware_Bolts`,
no tyre; see `public/models/wheels/README.md` in the Forgedwebsite repo) goes on a configurator wheel with:

```bash
node scripts/ingest-rim.mjs ../Forgedwebsite/public/models/wheels/fsa003.glb --wheel forged_fsa_03 --check
```

It packs the file (`scripts/rim3d/pack.mjs`), writes `public/models/rims/<wheelId>.glb`, sets
`modelUrl` on the wheel in the bundled catalogue plus a migration for `public.wheels`, and shoots the
wheel on two cars into `docs/ingest/rims/`. On the car the 3D rim replaces the wheel's photo face; the rim
page keeps its pre-rendered spin. Spokes facing into the car: add `--flip`. Back to the photo face:
remove `modelUrl` (or clear "Rim 3D model" in `/admin`).

Website rims that match configurator wheels by design: `fsa003.glb` = FSA-03 Kyalami 15 (done).
`fsa004.glb` (12 straight spokes) looks like FSA-06 Aldo Fork 15 but is not confirmed; `fsa002.glb` is
another 15-spoke, not the configurator's FSA-02; `ff-1` / `ff-3` are SIXNINE wheels, not in the
configurator.

## Licence

The four packages are game-derived and came without a licence (their READ ME says so). The ingest
records "Licence not confirmed" in `public/models/CREDITS.md`. Treat them as prototype assets until a
licence that covers real-time web use is in hand; BMW's trademarks are a separate matter.
