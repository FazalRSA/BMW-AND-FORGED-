# CLAUDE.md

<!-- handoff:learnings:begin -->
## Session Learnings (auto-updated by handoff)

### Implicit Rules
- Stack: React 19, Vite 6, Three.js, bun, Supabase, Vercel, n8n; typecheck with bun run lint
- PR flow: draft PR after push, subscribe PR activity, attribution footer on PR and commits
- Brand and copy in config/brand.ts; catalogue source of truth is Supabase, data/configuratorData.ts is fallback
- Permission mode is set in the UI dropdown; settings.json only sets allow rules
- Scratchpad is session-scoped; do not rely on it persisting
- Wheel catalogue = the owner's stock sheet (docs/WHEEL_INVENTORY.md): real names FSA001-004/FF-1/FF-3, ZAR prices stored as USD/18.2; the legacy cars and photo wheels were deleted on 2026-11-11 (rows archived in Supabase schema `archive`); to retire an item now, archive its row first, then delete
- Journey is welcome carousel -> /configure -> /summary (no showroom); /configure is the stage look (services/viewerStudio.ts STAGE, engine.setLook('stage')) + the stepped drawer (StepDrawer in Configurator.tsx); verify visual work with scripts/render/shoot.cjs and ?look=stage before claiming done
- Rim page /rims/<id> shows the ONE wheel viewer shared with the FORGED website: shared/wheel-viewer/ is a byte-identical copy of Forgedwebsite src/wheel-viewer/ (edit it there, then `node scripts/wheel-viewer-sync.mjs pull ../Forgedwebsite`; `bun run lint` fails if the copy was edited here). This app's bits are components/WheelStage.tsx (finish rows, photo fallback) and services/wheelViewerPaint.ts (the car's finish recipe as the viewer's paint plug-in); no spin frames
- Summary and PDF stills of all four prepared cars (M2 CS, M4 CS, M5 G90, M5 Touring) are Cycles bodies + live wheels (public/renders/stills.json, scripts/prerender/stills-frames.sh, docs/ADD_PREPARED_CAR.md); since 2026-11-23 the stage shows them from Cycles frames too (all six views in manifest.json, rendered with STUDIO=dark SAMPLES=12 scripts/prerender/render-all.sh 0 1 2 3 and PATH=/opt/bpyenv/bin:$PATH); their GLBs stay for the turntable; re-render a car after its GLB changes. Every car in the line-up is now path-traced on the stage
- The cloud sandbox has no GPU: renders are SwiftShader on CPU (about 50 s a shot); never claim real-GPU or phone results
- Commit messages: type(scope) subject, body says why and what was checked; never rewrite pushed history
- Harness runs (journey.cjs, e2e.cjs) stub Supabase writes; never create real leads (each one emails the owner)
- Prepared cars/rims go in with scripts/ingest-car.mjs / scripts/ingest-rim.mjs (docs/ADD_PREPARED_CAR.md); migrations are applied from the sandbox with the Supabase connector (apply_migration) without asking once the change has passed its reviews (owner, 2026-11-23: "stop asking me to accept, just approve it"): read the live schema first, apply in file order, read it back; destructive SQL (drops, deletes, rewrites of live rows) still needs the owner
- Blender MCP: Blender 5.3 + mcp-for-blender@2.2.7 (.mcp.json) + the Blendkit add-on (the owner's zip; not downloadable); a fresh container needs scripts/blender-mcp/setup.sh <zip> then start.sh (UI on Xvfb, the add-on refuses -b); Blendkit is driven via execute_blender_code (docs/BLENDER_MCP.md)
- Frames-only cars (licence forbids serving the GLB, e.g. Blendkit Royalty Free; first: ix3_m60): no modelUrl, body = Cycles frames + per-view depth.png, wheel layout in public/renders/manifest.json (framesOnly); build with prepare_blend.py -> export-scene.cjs (CAR_QUERY) -> render_depth.py + render_car.py -> frames-only.sh; check with scripts/render/frames-car.cjs (fails on any .glb request for the car); licensed files only in /opt and .scratch/private (docs/ADD_PREPARED_CAR.md)
- A frames-only car ships only after three independent reviews (fit, materials, accuracy; brief .scratch/briefs/REVIEW.md) and a review of the fixes; a view rendered with render_car.py --hide needs render_depth.py --hide too; paint proofs come from shoot.cjs with an eval of services/renderedBody.ts renderedStills; a missing real launch colour or a paint BMW never offered on that car is a blocker
- Rendered views draw path-traced wheel layers (render_car.py --wheel-layer, body and floor as holdouts; scripts/prerender/wheel-layers.sh then publish_wheel_layers.py -> public/renders/<car>/<view>/wheels/*.webp + wheels.json); live WebGL wheels only where a layer is missing; re-render a car's layers when its frames change, and a finish's layers when /admin changes its values
- Wheel layers size the rim from its real inches (lip radius = inches x 0.0127 + 0.008 m, so 0.262 m at 20") on the car's own factory tyre (the radius in .wheels.json), never as a fraction of the tyre radius (that made rims too small on the M2/M3 and too big on the X5/M5); finish recipes are photo-matched in scripts/prerender/wheel-combos.ts PHOTO_RECIPES (calibrate with finish_calibrate.py against the website's product photos); publish_wheel_layers.py also removes layer files with no render behind them
- Welcome stills (public/hero/*): the 11 Nov M2/M4 CS/M5/M5 Touring stills came from the owner's reference studio .blend (not in the repo, /home/claude/m2/out; scripts/cycles/batch_stills.py) and are the quality bar; render_car.py --hero is tuned to match them (low-key: black void, narrow key with falloff, close low 32 mm camera, EV -0.5; knobs HERO_*); compare any new still side by side with the originals (git show 588c06b:public/hero/<car>-1600.webp) before replacing one, and bump HERO_VERSION in HeroStage.tsx (the files keep their names and /hero/ is cached for days)
- The M340i saloon could not be built from the Blendkit 3 Series models (three judged attempts failed), so the M340i ships as the Touring (m340i_touring_g21) with European figures; BMW SA sells the M340i only as a saloon (owner to confirm the Touring is wanted)

### Key Decisions
- Decision: allow rules in .claude/settings.json for git, bun/npm, node, ffmpeg and basic file commands only — Reason: cut prompts without pre-approving credential lookups or external installs
- Decision: build video with local /hyperframes skill, not hosted MCP — Reason: user chose skill; hosted compose disabled for CLI
- Decision: 16:9, about 90s, British female VO with best voice model — Reason: user spec for BMW pitch
- Decision: customer accounts via Google on Supabase Auth with a garage; admin allowlist untouched — Reason: owner's choice (2026-11-10 plan)
- Decision: one wheel viewer for the website and this app, owned by the website repo and copied here with a hash check, not forked — Reason: owner asked for one shared viewer; no package registry between the two private repos yet
- Decision: legacy Sketchfab cars and photo-traced wheels deleted from the catalogue, code and public assets (2026-11-11) — Reason: owner's instruction; supersedes the earlier hide-not-delete decision. Restore from archive.legacy_cars / archive.legacy_wheels in Supabase if ever needed
- Decision: showroom removed, stepped drawer over the viewer's glass panel, scenes modelled on the Cycles hero stills — Reason: owner's direction (2026-11-11)
- Decision: BlendKit Royalty Free cars only as pre-rendered images, never as a live GLB — Reason: its licence FAQ forbids assets that are directly extractable from the distribution

<!-- handoff:learnings:end -->
