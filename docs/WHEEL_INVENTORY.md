# Wheel inventory: the stock sheet is the catalogue

The configurator offers exactly the wheels on the owner's stock sheet (**BMW M / M Performance Wheel
Inventory (in stock)**, Nov 2026), under the sheet's real names, sizes, finishes and prices. Everything
else that was in the wheel table (the photo-traced "Killarney S5", "Kyalami 15" … designs and the
rim-template builds FSA-12/13/14) stays in the table but hidden (`active = false`), so it can be switched
back on in `/admin > Wheels` the day it is stocked again.

Source of truth: Supabase `public.wheels` and `public.wheel_finishes` (migration
`supabase/migrations/20261110153000_wheel_inventory_stock_sheet.sql`), mirrored in
`data/configuratorData.ts` (`WHEEL_DESIGNS`, `WHEEL_FINISHES`) for the offline fallback.

## The six stocked designs

| Sheet name | Catalogue id | Sizes | Finishes (sheet → finish id) | Set price (ZAR → USD stored) | 3D files | Fitment (sheet) |
|---|---|---|---|---|---|---|
| FSA001 (2-piece) | `forged_fsa001` | 19", 20" | BlackMatte → `black_matte` | R90 000 → 4945.05 | `forged_fsa001.glb` + `forged_fsa001-rear.glb` (staggered; website `stf399-front/rear.glb`) | M3 Sedan (G80), PCD 5×112, ET8/15, CB 66.6 |
| FSA002 | `forged_fsa002` | 20", 21" | HyperBlack → `hyper_black`; PolishedFace → `polished_face` (the forked-spoke wheel; the gold 15-spoke wheel the sheet once listed here is the FSA003) | R75 000 → 4120.88; PolishedFace R85 000 → 4670.33 | `forged_fsa002-v2.glb` (website `fsa002-forked-v3.glb`) | M3 Competition Sedan (G80), PCD 5×112, ET8/15, CB 66.6 |
| FSA003 | `forged_fsa_03` (kept: older share codes point at it) | 20", 21" | Gold → `gold`; Silver → `silver`; HyperBlack → `hyper_black` | R75 000 → 4120.88 | `forged_fsa_03-v2.glb` (website `fsa003-v5.glb`) | M3 Sedan (G80), PCD 5×112, ET8/15, CB 66.6 |
| FSA004 | `forged_fsa004` | 20", 21" | Silver → `silver`; HyperBlack → `hyper_black`; GlossBlack → `black` | R70 000 → 3846.15 | `forged_fsa004-v2.glb` (website `fsa004-v5.glb`) | M3 Sedan / M3 Competition (G80), PCD 5×112, ET8/15, CB 66.6 |
| FF-1 | `sixnine_ff1` | 20", 21" | Silver → `silver`; LiquidMetal → `liquid_metal` | R80 000 → 4395.60; LiquidMetal R95 000 → 5219.78 | `sixnine_ff1-v2.glb` (website `ff-1-sixnine-v3.glb`) | M3 Sedan / M3 Competition (G80), PCD 5×112, ET15/20 (ET15/17 for LiquidMetal), CB 66.6 |
| FF-3 | `sixnine_ff3` | 20", 21" | PureBronze → `pure_bronze`; GlossBlack → `black`; LiquidMetal → `liquid_metal` | R80 000 → 4395.60; LiquidMetal R95 000 → 5219.78 | `sixnine_ff3-v2.glb` (website `ff-3-sixnine-v3.glb`) | M3 Competition Sedan (G80), PCD 5×112, ET15/17, CB 66.6 |

Notes

- **Prices are stored in USD** because `config/brand.ts formatMoney` prices every region from USD
  (ZA = USD × 18.2, rounded to R10). The USD figures above are ZAR ÷ 18.2 to the cent, so the ZA price
  shows exactly as on the sheet. The sheet gives one price per design and finish regardless of size, so
  both sizes carry the same price.
- **A dearer finish** (PolishedFace on FSA002, LiquidMetal on FF-1 and FF-3) is a per-wheel override:
  `price_by_finish` (`WheelDesign.priceByFinish`), read by `services/pricing.ts rimPrice(wheel, size, finishId)`.
  The panel, the rim page, the summary, the PDF and the lead email all use it. In `/admin > Wheels` it is the
  "Dearer finishes" field; leave a finish blank when it costs the same as the others. The finish price raises the
  set price to that figure and never lowers it: if a size is priced above the finish figure, the size price stands.
- **Old share links and lead codes** that point at a hidden design (the photo-traced wheels, now off) reopen with
  the first stocked wheel instead; the summary and the PDF always show the wheel actually loaded, so no stale price
  is quoted. Switch the design back on in `/admin` if an old build must open as it was.
- **The fitment and the car the sheet lists** are in each wheel's description and highlights. The
  configurator still lets a customer put any wheel on any of the four prepared cars: the sheet says what
  is in stock, the configurator is for seeing it.
- **FSA001 is staggered.** The rear file is `rear_model_url` (`WheelDesign.rearModelUrl`); the engine
  mounts it on the rear corners (`applyWheelDesign`) and falls back to the front file if it fails to load.
  The website's brake caliper and rotor meshes inside the STF399 files are dropped when packing
  (`scripts/rim3d/pack.mjs`), because the engine draws its own.
- **FSA003's old spin frames were removed** (`public/renders/rims/forged_fsa_03/` and its `manifest.json` entry, 2026-11-10):
  they showed the earlier photo-traced design under the reused id. Since 2026-11-11 no wheel has a spin: the rim page
  (`/rims/<id>`) draws each stocked wheel's rim file live in the wheel studio (`shared/wheel-viewer/WheelStudio.tsx`), in every
  finish, with the same finish recipe as on the car (`services/wheelFinish.ts`). `scripts/rim3d/turntable.py` is a legacy
  script; nothing in the app uses its output.
- **Stock quantity and status** are not shown in the configurator (the sheet says one or two sets each).
  Hide a design when it sells out: `/admin > Wheels > Visible in configurator`.

## The finishes

| Sheet | Finish id | Look (services/wheelFinish.ts kind) | Values (hex, metal, rough, clear) |
|---|---|---|---|
| Gold | `gold` | gloss metallic paint, warm | #c9a24e, 0.9, 0.32, 0.85 |
| HyperBlack | `hyper_black` | dark gloss metallic (bright flop, near-black pockets) | #3a3e44, 0.9, 0.24, 0.9 |
| PolishedFace | `polished_face` | bare polished aluminium | #e6e9ec, 1.0, 0.08, 0.6 |
| Silver | `silver` (existing) | metallic silver paint | #c3c8cd, 0.9, 0.28, 0.7 |
| GlossBlack | `black` (renamed from "Black Gloss" on 2026-11-12) | gloss black paint | #141618, 0.7, 0.15, 0.95 |
| PureBronze | `pure_bronze` | metallic bronze with a soft sheen (SIXNINE's chocolate bronze; was #9c6b3a until 2026-11-12; a satin #6e4a30 at rough 0.45 read as flat clay) | #75523f, 0.9, 0.3, 0.7 |
| LiquidMetal | `liquid_metal` (existing) | polished chrome | #dfe4e8, 0.98, 0.12, 1.0 |
| BlackMatte | `black_matte` | satin solid black (no flake, no flop) | #26282b, 0.0, 0.5, 0.0 |

The older finishes (`bronze` BronzeMatte, `satin_gold`, `gunmetal`) stay in the table for the hidden
wheels and for any wheel the owner ticks them on.

## Updating from a new sheet

1. Names, sizes, prices, finishes: `/admin > Wheels` (or a migration like the one above plus the same edit
   in `data/configuratorData.ts`).
2. A new design with a rim file: `node scripts/ingest-rim.mjs <rim.glb> --wheel <id> --new --name … --sizes … --price-zar … --finishes …`
   (`docs/ADD_PREPARED_CAR.md`, "Rims the same way"); a staggered set adds `--rear <rear.glb>`.
3. A new finish: `/admin > Finishes` (the `forgedsa-rim-finishes` skill explains the numbers), then tick it
   on the wheel.
4. Render the wheel on the car before telling anyone it is live (`visual-qa` skill):
   `node scripts/render/shoot.cjs <out> shots.json` with `"q": "&look=stage"` (what `/configure` draws), and open
   `/rims/<id>` to check it in the wheel studio.

## Rims match the website (2026-11-23)

The rim files are the website's own (Forgedwebsite `public/models/wheels/`, packed with `scripts/ingest-rim.mjs`), named with a
version suffix (`-v2`) because `/models/` is cached for a day plus a week of stale-while-revalidate: a changed file keeps its name only
if nobody has cached it. The old files stay in `public/models/rims/` until nothing points at them. FSA001 was already the website's
`stf399` wheel (same size to the millimetre) and was left as it was. Wheel layers and catalogue thumbnails are Cycles renders of these
files with finish recipes matched to the website's product photographs (`scripts/prerender/wheel-combos.ts`, `finish_calibrate.py`).
