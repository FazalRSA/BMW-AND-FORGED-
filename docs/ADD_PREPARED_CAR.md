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

The configurator can draw a car two ways (`App.tsx`, `services/renderedBody.ts`), and it decides per view: a
view listed for the car in `public/renders/manifest.json` shows its Blender frame, any other view shows the live
GLB, and so does the turntable (Auto-rotate), because a frame is a fixed camera.

- **Live GLB** (what the ingest sets up by default): the engine draws the model with the studio lighting, paint
  shader and materials pass; the forged wheels sit in the model's arches. Any car without render frames
  works this way.
- **Blender frames** (`--render`; what the four prepared cars use since 2026-11-10): Cycles renders the body once
  per view chip (Front ¾, Side, Rear ¾, Front, Wheel, Top) with white and black paint bases, and the browser
  recolours them for any paint. The wheels are still drawn live on top, so paint, wheel, size and finish all
  change at once. It needs Blender as a Python module:

  ```bash
  pip install bpy "numpy<2.0,>=1.26"
  SAMPLES=12 IDLE_FRAMES=1000 node scripts/ingest-car.mjs BMW_M5_G90.zip --car m5_g90 --render --check
  ```

  Nothing else changes: the same GLB stays in the showroom, and the wheels stay live.

### What the frames of a prepared car need

- **Its own normals** (`keep_normals` in `CAR_FIXES`, `scripts/prerender/render_car.py`). The script welds, smooths
  and subdivides the paint panels of the old Sketchfab files. Done to a prepared car it crumples the bonnet and
  fenders (welding and re-weighting the normals), and subdividing has Blender killed for memory on an 8 GB
  machine. A prepared car renders exactly as exported.
- **Its own lamps** (`authored_lamps`). The export names a clear lamp cover `lens`, the parts behind it `lamp`, and
  keeps the glow of lit parts. With the flag the cover is clear glass and the DRLs, kidney outline and tail lamps
  are lit (capped by `LAMP_GLOW`); without it the covers and housings are satin black and nothing glows, as the
  old frames were.
- **A web GLB with 16-bit normals.** The packages' optimiser now writes them (meshopt `QUANTIZE`, not `FILTER`,
  which packs normals at 8 bits); the files are about 0.5 to 0.8 MB larger.
- **Time.** On 2 cores: the scene export takes 2.5 minutes with `IDLE_FRAMES=1000` (5.5 without; same meshes,
  cameras and wheel positions), and the six views take 21 minutes at 12 samples (`SAMPLES=12`; each of the 18
  renders has about 21 seconds of fixed cost, so fewer samples save little). `ingest-car.mjs --render` now stops
  with an error if Blender wrote no new frames; before, a killed Blender still read as "Rendered".

Going back to the old frames: `git checkout <commit> -- public/renders/<carId>` and rebuild the manifest
(`node scripts/ingest-car.mjs … --dry-run` does not; run `scripts/prerender/render-all.sh` with no
index, or delete `public/renders/manifest.json` entries by hand).

## The configurator screen looks like the viewer

Whatever is drawn live (a car or view without a Blender frame, and the turntable of any car) sits in the four-car
viewer's studio on the configurator screen: the gradient dome, the floor that fogs into the horizon, the pool of shadow around the
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

A wheel that is not in the catalogue yet is created on the way in:

```bash
node scripts/ingest-rim.mjs ../Forgedwebsite/public/models/wheels/fsa002.glb --wheel forged_fsa002 --new \
  --name "FSA002" --code FSA002 --spokes 15 --sizes 20,21 --price-zar 75000 \
  --finishes satin_gold,gunmetal,silver --default-finish satin_gold --image /rim-images/forged_fsa002.webp --check
```

`--new` appends a row (PLACEHOLDER copy, prices in USD from the ZAR figure at the ZA rate, +9 % per inch
above the smallest size) to the bundled catalogue and writes an `insert … on conflict` migration; the owner
sets the real names, copy and prices in `/admin`. `--rear <rear.glb>` packs a second file for a staggered
set (`rearModelUrl`; engine support for the rear file is the next step).

Thumbnails: `RimThumb` masks the photo by its alpha, so a website `front.webp` on white must be cut out
first (`rembg`, as the photo pipeline does), squared on a transparent canvas and saved as WebP with alpha
into `public/rim-images/<id>.webp`.

Website rims in the configurator on 2026-11-10: `fsa003.glb` → `forged_fsa_03` (Kyalami 15), `fsa002.glb` →
`forged_fsa002`, `fsa004.glb` → `forged_fsa004`, `ff-1.glb` → `sixnine_ff1`, `ff-3.glb` → `sixnine_ff3`
(names, copy and prices are placeholders from the website). Still to do: STF399 front/rear (needs the rear
file support) and the rim-page spins (`turntable.py`; the live engine is the fallback meanwhile).
`fsa004.glb` (12 straight spokes) may be the same design as FSA-06 Aldo Fork 15: if the owner confirms,
re-run `ingest-rim … --wheel forged_fsa_06` and hide `forged_fsa004`.

## Licence

The four packages are game-derived and came without a licence (their READ ME says so). The ingest
records "Licence not confirmed" in `public/models/CREDITS.md`. Treat them as prototype assets until a
licence that covers real-time web use is in hand; BMW's trademarks are a separate matter.
