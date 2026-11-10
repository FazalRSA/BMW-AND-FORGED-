# Checkpoint: photoreal cars and rims

**Last updated:** 2026-11-10 · **Branch:** `ccr-f52bf849-fnf7qs` · **To continue:** the
`forgedsa-resume` skill (`.claude/skills/forgedsa-resume/SKILL.md`) restores the tools, and this file says what is next.

## 2026-11-10: the four prepared cars are in (live GLB mode)
The owner's prepared packages (Drive > `3d cars`: M5 G90, M5 Touring G99, M4 CS G82, M2 CS G87; clean meshes,
`C10_Wheel_FL..` nodes, `Paint` material) replace the Sketchfab bodies. `scripts/ingest-car.mjs` is the one-command
route (`docs/ADD_PREPARED_CAR.md`); it copies the GLB to `public/models/<carId>.glb`, writes the catalogue fields and a
migration, and **retires the Blender frames of that car** so the configurator draws the GLB live (the frames were
renders of the old dented bodies). `--render` re-renders Blender frames from the new GLB (bpy, ~15 min/car) if the
photoreal route is wanted back for these cars. Check sheets: `docs/ingest/<carId>.jpg`. Rims: `scripts/ingest-rim.mjs`
puts a website-convention rim GLB on a wheel (FSA-03 done from the website's `fsa003.glb`; sheet in `docs/ingest/rims/`).
The migrations in `supabase/migrations/2026111013*_*` still have to be applied (no Supabase MCP in that session).
The configurator screen now uses the four-car viewer's studio for live cars (`services/viewerStudio.ts`, `engine.setLook`): dome,
fogged floor, pool shadow, Neutral tone mapping, gloss / soft coves by paint; `?look=viewer` in the harness.
**The panel is the viewer's too** (`components/journey/ViewerPanel.tsx`, rendered by `Configurator.tsx`; `?panel=steps` shows the
old stepped panel for comparison): Car chips, paint swatch groups by finish, rim thumbs, size chips, finish swatches, view chips
(incl. the new `front` preset), Auto-rotate, price + CTA; the paint name sits bottom-left of the stage. The harness selectors
("Step N: …" headings, "Summary", "Wheel details", "View in 360°", "Change model", "View your …") are kept.
**Legacy cars hidden** (`active: false` in the fallback + `20261110141000_legacy_cars_hidden.sql`): the showroom and configurator list
the four prepared cars until their packages arrive.

**Later the same day: the wheel catalogue is the stock sheet** (`docs/WHEEL_INVENTORY.md`, migration
`20261110153000_wheel_inventory_stock_sheet.sql`): FSA001 (staggered, `rearModelUrl` + engine support in `applyWheelDesign`),
FSA002, FSA003 (`forged_fsa_03` renamed), FSA004, FF-1, FF-3 with the sheet's sizes, finishes (new `gold`, `hyper_black`,
`polished_face`, `pure_bronze`, `black_matte`) and ZAR prices (USD ÷ 18.2; dearer finishes via `priceByFinish` /
`price_by_finish`, read by `rimPrice(wheel, size, finishId)` everywhere incl. the lead email). The eleven photo-traced wheels
are hidden (`active: false`; `WheelDesign.active`, `STATIC_CATALOG` filters). `pack.mjs` drops brake meshes inside rim files.
**"FORGED" plates** (the viewer's, ported: `engine.addNumberPlates`, `wheelKit.plateTexture`; `?plates=0`). **Customer accounts**
(Google via Supabase Auth, profiles, garage, `user_id` on share codes and leads): `docs/ACCOUNTS.md`,
`20261110150000_customer_accounts.sql`, `services/authService.ts`, `components/journey/AccountSheet.tsx`. Check sheets:
`docs/ingest/stock-wheels.jpg`. **Preview:** <https://forgedsa-configurator.onrender.com> (Render static site, bundled catalogue;
README → Hosting). Verified: tsc, vite build, `journey.cjs` phone + desktop, `pdf-check.cjs` (brochure 2 pages, lead +
share-code writes stubbed), accounts sheet check at both sizes.

## Goal of this phase (since 2026-11-10)
The owner's **four prepared cars** (M2 CS, M4 CS, M5, M5 Touring) drawn live from their GLBs in the viewer look, with the
**six stock-sheet wheels** (FSA001-004, FF-1, FF-3) as GLB rims, in the sheet's sizes, finishes and prices, verified with
the harness (`journey.cjs` both sizes, `pdf-check.cjs`, `shoot.cjs` sheets of the six wheels). Next: apply the migrations,
Google sign-in, spins for the six wheels (queue below).

*Superseded (Oct 2026 goal, kept for the history below):* M4 Competition and M5 G90 with Twin-Y (FSA-12), Star 6 (FSA-13),
Kyalami 15 (FSA-03), Turbine 25 (FSA-14). FSA-12/13/14 are hidden (`active: false`); the `forged_fsa_03` id now carries
the stock FSA003 GLB, not the photo-traced Kyalami 15.

## How it works now (decided, keep)
| Surface | What renders it |
|---|---|
| Car body (configurator) | **Prepared cars (M5, M5 Touring, M4 CS, M2 CS since 2026-11-10): the GLB live** (`docs/ADD_PREPARED_CAR.md`). Others: Blender Cycles images per car × view, recoloured per paint in the browser (`scripts/prerender/`, `components/journey/RenderedCarView.tsx`). Since 2026-10-07: darker reflection panels in the `STUDIO=dark` studio (no milky haze), a third `flake_w` frame (metallic base) blended in for Metallic/Pearl paints (`flakeLook` in `services/renderedBody.ts`), `BODY_EXPOSURE` 1.25 |
| Wheels on the car | live engine. **The six stocked wheels are 3D rim GLBs** (`modelUrl`, `rearModelUrl` for the staggered FSA001; `scripts/ingest-rim.mjs`; a GLB wins whenever `modelUrl` is set in `applyWheelDesign`), lit by the viewer studio on the live cars. The **2D photo/bar face** (`imageUrl`, `services/rimFaces.ts`, Blender studio HDR `public/env/forgedsa_studio.hdr`) applies only to the hidden legacy wheels |
| Rim detail page | **Blender 360° spin** for the hidden legacy wheels, 36 frames × 5 finishes (`scripts/rim3d/turntable.py` → `public/renders/rims/<id>/`, `RimSpinView.tsx`). None of the six stocked wheels has a spin yet (queue): their page draws the live GLB |
| Finishes (spins) | `scripts/rim3d/finishes.json` + `materials.py`: Liquid Metal, Satin Bronze, Satin Gold, Gloss Black, Silver = brushed aluminium |
| Finishes (car) | `services/wheelFinish.ts` (Satin Gold live in Supabase on every wheel since 2026-10-04) |

## Status of the Oct 2026 target set (history: these wheels are hidden since 2026-11-10, the M4 Competition too)
| Item | M4 Competition | M5 G90 | Rim page spin |
|---|---|---|---|
| Body (Blender) | done | done | n/a |
| FSA-12 Twin-Y | done (on-car check) | done | ✓ complete; brighter chrome, flat barrel |
| FSA-13 Star 6 | done | done | ✓ complete; brighter chrome, flat barrel |
| FSA-03 Kyalami 15 | done | done | ✓ complete; brighter chrome, flat barrel |
| FSA-14 Turbine 25 | done after fold fix | done after fold fix | ✓ complete; brighter chrome, flat barrel |

**Live since 2026-10-05:** FSA-12/13/14 are active in Supabase (migration `20261004180000_wheels_fsa_12_13_14_live.sql`)
with PLACEHOLDER names/sizes/prices from FSA-05. **Every one of the twelve spun wheels has a rim page spin, but all twelve
are hidden since 2026-11-10 (`active: false`); the six active stock wheels have no spin yet** (queue). FSA-01, 02, 04,
05, 06, 07, 08, 09 were added on 2026-10-05 (FSA-07 built from `public/rim-faces/forged_fsa_07.png`; FSA-09 rendered
with `turntable.py --resmooth`). Weakest matches: FSA-07 Dezzi Star, then FSA-04 Scribante 3P.

On-car check sheets for the five cars that were active in Oct 2026 (legacy bodies; M4 G82, M3, M3 Touring and M8 are hidden
now, the M5 G90 is a new prepared GLB): `docs/rim-template/oncar/{m4_g82,m3_g80,m3_touring_g81,m5_g90,m8_f92}.jpg`
(made with `scripts/render/oncar.cjs`; `PORT=` picks the dev server). The four live cars' sheets are `docs/ingest/<carId>.jpg`
and the stock wheels' `docs/ingest/stock-wheels.jpg`. Car body fixes in `scripts/prerender/render_car.py`
`CAR_FIXES`: M8 keeps only the Competition fender (four stacked variants z-fought), M3 has thin windscreen glass and
renders without subdivision (it needs >12.7 GB subdivided). Both re-rendered and live.

Responsive: `scripts/render/responsive.cjs` passes 180/180 (12 pages × 15 devices incl. iPad 834×1194 and 1366×1024).
Headless Chromium needs the proxy CA in `$HOME/.pki/nssdb` (`apt install libnss3-tools`, then `certutil -d sql:$HOME/.pki/nssdb
-A -t C,, -n agent-proxy -i /root/.ccr/agent-proxy-ca.crt`); without it Supabase fails and the app silently uses the
bundled catalogue.

**Owner review page:** https://claude.ai/artifact/XfokPgUT8rYWeJJKBy1UkT. Verdicts and notes land in its database,
collection `feedback` (doc ids `car_<carId>`, `rim_<wheelId>`, `details_<wheelId>`, `decision_star6`,
`decision_m3t_headlights`); read them with ArtifactData `list`.

## Queue (do the top unchecked item; tick it when committed)
- [ ] Apply the 2026-11-10 migrations in order (four cars, legacy cars hidden, the `_wheel_*_rim_model` files, customer accounts,
      wheel inventory) in Supabase, or set the same fields in /admin; deploy; smoke the live catalogue (source `supabase`).
- [ ] Owner: Supabase dashboard → Authentication → Providers → Google (client id/secret, redirect URLs) per `docs/ACCOUNTS.md`;
      then the manual sign-in → save → garage test on the preview URL.
- [ ] Rim-page spins for the six stocked wheels (`scripts/rim3d/turntable.py`, ~75 min each on CPU; the live engine is the fallback).
- [ ] Owner: look at `docs/ingest/*.jpg` and `docs/ingest/stock-wheels.jpg`; decide live GLB vs `--render` Blender frames for the four prepared cars.
- [ ] Owner: licence for the four prepared cars (game-derived, none supplied); real M5 Touring / M2 CS specs and palettes.
- [ ] Optional: the viewer's GTAO + SMAA composer behind a flag (`CarConfiguratorEngine.AO`) for the on-screen frame.
- [x] Spins for FSA-12, FSA-13, FSA-03, FSA-14 (all five finishes).
- [x] Re-render Liquid Metal + Silver for those four (brighter chrome surround, plain barrel; review fixes).
      All four wheels completed with improved chrome reflections and consistent brushed barrel texture.
- [x] Owner approved the four spins; FSA-12/13/14 inserted into Supabase and live (placeholders).
- [x] Re-shot the on-car sheets (Black now reads black) and extended them to all five active cars.
- [x] Rim page screenshots: 4 wheels × 2 finishes × phone / iPad portrait / iPad landscape / desktop.
- [x] M8 fender and M3 windscreen fixed and re-rendered; tablet/phone responsive pass; spins for all 12 wheels.
- [x] Round 1 answers worked through (PR #9, merged, live): FSA-14 straight blade edges (built from `fsa_14-spec.json`),
      FSA-09 mesh fills the face, FSA-02 spokes in one piece, FSA-04 arms bend (`docs/rim-template/fsa_0{2,4,9}-shapes.json`,
      `turntable.py --resmooth --weighted`); M3 Touring headlights (`CAR_FIXES['m3_touring_g81']` lamps); wheel swaps no
      longer freeze (spokes built in `services/rimFaceBuild.ts` in the worker, tyre/shell cache, `scripts/render/swap-perf.cjs`);
      code-review fixes (bounded image caches, phone memory, no GEMINI define).
- [x] Navigation dead ends fixed (PR #11): rim Back returns to its opener, Back never leaves the site, /summary → /configure,
      menu Escape, unknown rim id → not found. `scripts/render/e2e.cjs` clicks every control (lead/saved-config writes faked);
      desktop journey checks pass so far; a full run takes hours on SwiftShader, so run it section by section
      (`node scripts/render/e2e.cjs <out> desktop journey|forged|rims|info|deeplinks`).
- [x] Owner round 3 (rim page review of 2026-10-06): FSA-06 FORGED on the centre cap (car: `RIM_CAP_TEXT` in `services/rimFaces.ts`,
      spin: `"cap": {"text": "FORGED"}`) and car = spin; FSA-08 (hub streaks, polished three-piece lip with 40 bolts, spoke count 15);
      FSA-12 spokes as thick as the reference photo (~0.11 R mid-length, was 0.06-0.075); FSA-13 jagged spokes gone (smooth curved blades,
      `scripts/render/make-curve-face.py`). All four spins are rebuilt to the engine's hub kit: dished face (`dish_curve: parabola`),
      spoke ends 10 mm behind the lip, five lug nuts, black cap with gold ring and lettering, polished bolted lip for two/three-piece
      (specs: `docs/rim-template/fsa_{06,08,12,13}-rim.json`; face sources `fsa_12-curve.json`, `fsa_13-curve.json`). The other eight
      spins still have the older plain hub and flat face: re-render them from the same spec keys when convenient.
- [ ] **Owner round 2**: re-check FSA-14, 09, 02, 04 and the M3 Touring lamps on the review page (answers in `rim2_<id>`
      and `recheck_m3t_headlights`); cars and the other spins still unmarked.
- [ ] **Broken social links** (config/brand.ts): YouTube @ForgedSA 404, TikTok @forgedsa not found, www.forgedsa.com
      doesn't connect, Instagram unverifiable (login wall). Need the real handles from the owner.
- [ ] Real names, sizes and prices for FSA-12/13/14 → `/admin` or a migration, mirrored in `data/configuratorData.ts`
      (owner: keep placeholders for now). Contact phone/email stay placeholders (owner's choice).
- [ ] Owner decisions: Star 6 (keep, or front-on photo), Aldo Fork 15 spoke count (photo 12 vs name 15).
- [ ] Stale draft PRs #6 (2D wheel stage), #8 (old phone fixes), #10 (live-WebGL paint/lighting recalibration): all
      conflict with main and predate the Blender bodies; owner to decide close vs salvage (#10's verified paint codes).
- [ ] Optional: re-render the other eight spins with `--resmooth --weighted` for cleaner hub reflections.

## Later (parked)
- **Photo 7** (champagne, forked spokes) may be a different design from the catalogue's 12-spoke Aldo Fork 15: ask.
- Cars: the M4 Convertible has no real 3D model (placeholder body; hidden); X3 M50's model has filled
  wheel arches (hidden). The M5 Touring is one of the four prepared GLBs and live. Paid models need the owner's OK.
- Summary page and PDF stills still come from the live WebGL car, not the Blender renders.
- Spin frames are in git (~12 MB per wheel, 137 MB for 12). Before the full catalogue, move them to Supabase storage
  (and consider 720×540 or lazy preloading in `RimSpinView`).
- Not modelled on 3D rims: lip engraving, logos, milled channels on traced faces.

## Decisions log (so they aren't asked twice)
- Pre-rendered bodies instead of live WebGL cars **for the Sketchfab-era cars** (their GLB panels were dented; shader tweaks
  couldn't fix it). Superseded on 2026-11-10 for the four prepared cars: clean packages, drawn live from the GLB in the
  viewer look (`--render` can bring Blender frames back for them if the owner prefers).
- Free only: render on this CPU; no GPU rental, no paid APIs.
- Template rim: "High poly Rims" (CC-BY-4.0, credit in `docs/rim-template/PROFILE.md`), benchmark only.
- Silver in spins = brushed aluminium; Satin Gold measured from the client's photo (#c4aa7f).
- New wheels went live only after the owner approved their spin (Oct 2026, photo-traced wheels). Superseded on 2026-11-10:
  **the stock sheet is the catalogue** (`docs/WHEEL_INVENTORY.md`); stocked wheels are live as GLB rims without a spin,
  legacy wheels and cars are hidden (`active: false`), never deleted.
- 2026-11-10: live GLB for the prepared cars; viewer look and viewer panel on /configure; customer accounts via Google on
  Supabase Auth; admin allowlist untouched.
