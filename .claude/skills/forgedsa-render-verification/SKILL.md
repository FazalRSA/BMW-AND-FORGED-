---
name: forgedsa-render-verification
description: Take screenshots of the FORGEDSA configurator and 3D engine headlessly to verify visual changes (paint, lighting, cars, wheels, UI theme, PDF, emails) in a sandbox without a GPU. Covers the .scratch harness pages, Playwright + SwiftShader flags, routing Supabase storage through curl, contact sheets, and the pitfalls that wasted time before. Use before claiming any visual change works.
---

# Render verification (headless, no GPU)

Never report a visual change as done without looking at a render.

## Dev server

```bash
cd /home/user/BMW-AND-FORGED-
rm -rf node_modules/.vite          # stale pre-bundles after `bun add` make pages hang
(setsid nohup npx vite --host 127.0.0.1 --port 5173 > "$SCRATCH/vite.log" 2>&1 &)
for i in $(seq 1 30); do curl -s -o /dev/null http://127.0.0.1:5173/ && break; sleep 1; done
```

- `hmr` is off. Restart Vite after editing `vite.config.ts`.
- **Never run `pkill -f vite ...` in a command that also contains "vite"**: it kills its own shell
  (exit 144). Find PIDs with `pgrep -af bin/vite` and `kill` them in a separate call.

## Committed harness (`scripts/render/`)

- **`scripts/render/shoot.cjs <outDir> shots.json [rimCacheDir]`:** batch screenshots from a JSON
  shot list (`car`, `paint`, `wheel`, `finish`, `size`, `view`, `q`, `cam`).
  - `wheel` is a **wheel id** (`"forged_fsa002"`, preferred) or an index into the full bundled
    `WHEEL_DESIGNS` list, hidden designs included (`0` is the hidden photo wheel FSA-01; the six
    stocked wheels `forged_fsa001`, `forged_fsa002`, `forged_fsa_03`, `forged_fsa004`, `sixnine_ff1`,
    `sixnine_ff3` are indexes 11-16). Use ids in shot lists. `car` is an index into `BMW_MODELS`
    including hidden cars: live cars are `1` (M4 CS), `5` (M2 CS), `7` (M5), `8` (M5 Touring); `0` is
    the hidden M4 G82. `q` appends raw params, e.g. `"&look=viewer"` for what /configure shows.
  - It loads `scripts/render/engine.html`, routes Supabase storage to a local rim cache (curl
    fallback) and waits for `window.done`. Stock wheels are GLBs under `public/models/rims/` served
    by Vite, so they need no rim cache; the cache only matters for the hidden photo wheels.
  - Waits use `domcontentloaded` with long timeouts.
  - About a minute per shot. See `scripts/render/README.md` and the `3d-car-perfect` skill.
- **App routes** (`/rims/<id>`, `/`): the CSS is built by Vite (Tailwind via PostCSS, `index.css`),
  so the page is styled offline. Only `ERR_CERT_AUTHORITY_INVALID` (sandbox network) errors are
  acceptable. (It used to need the Tailwind Play CDN routed to a local copy: that CDN is gone, and
  must stay gone: it compiled the CSS in every visitor's browser.)
- **Screenshot timeout:** pass `timeout: 180000` to `page.screenshot`. Continuous SwiftShader
  frames on big pages can exceed the default 30 s.

## Older harness pages (`.scratch/`, gitignored)

- **`scripts/render/engine.html?car=N&paint=N&wheel=<id|N>&finish=id&size=20"&view=frontThreeQuarter`**
  (the `.scratch/` copy is the same page): the bare engine. `car=N` indexes `STATIC_CATALOG.cars`,
  all 12 including hidden (live: 1, 5, 7, 8; `car=0` is the hidden M4 G82). `wheel=` takes a wheel id
  (preferred) or an index into the full `WHEEL_DESIGNS` list, hidden ones included (`wheel=0` is the
  hidden FSA-01, not a stock wheel). The page sets `window.done` when the car has loaded, and exposes `window.e`.
  Extra params: `rimModel=/path.glb` (+ `rimFlip=1` if the face points inward) puts a 3D rim file on
  the chosen wheel; `look=viewer` draws the viewer look that /configure uses for the live cars;
  `plates=0` hides the "FORGED" plates; `model=`, `rot=`, `len=`, `paintMatch=`, `hideMatch=` for
  ad-hoc car GLBs; `tone=agx|neutral`, `studio=hdri`, `exposure=`, `photoreal=1`.
- **`.scratch/pdf-test.html`:** builds a brochure with `downloadBrochurePdf`. Load it through a
  route that maps `https://forged-configurator.vercel.app/**` to the dev server, so the PDF prints
  live URLs, not 127.0.0.1.
- Full journeys: a Playwright script that clicks Enter → Build → Confirm → steps → View your … →
  Share. Button names change with the catalogue (e.g. wheel names), so update the selectors.

## Playwright setup

- `require('/opt/node22/lib/node_modules/playwright')` with
  `executablePath: '/opt/pw-browsers/chromium'`. Never run `playwright install`.
- WebGL flags: `--use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader --ignore-gpu-blocklist`.
- The sandbox browser **cannot fetch Supabase storage** (rim PNGs fail as "Failed to load custom 2D
  wheel texture"). This only matters for the hidden photo wheels; the six stocked wheels are GLB
  rims (`modelUrl`) served by the dev server. Route storage requests through curl:
  ```js
  await p.route(/supabase\.co\/storage\//, r => { const u = r.request().url();
    const body = require('child_process').execFileSync('curl', ['-sSL', u], { maxBuffer: 64 << 20 });
    r.fulfill({ body, contentType: u.endsWith('.png') ? 'image/png' : 'application/octet-stream',
                headers: { 'access-control-allow-origin': '*' } }); });
  ```
- Whole journey, both sizes: `node scripts/render/journey.cjs <out> <rimCache> both` (`visual-qa`).
- **The current gate before claiming a visual change is done:** `journey.cjs` at both sizes,
  `node scripts/render/pdf-check.cjs <out>` (brochure, writes stubbed), and `shoot.cjs` sheets of
  the six stocked wheels (by id) on the live cars with `"q": "&look=viewer"`. `qa-matrix.py` and
  `wheel-qa.cjs` cover the hidden photo wheels only.

## Reviewing output

- Build contact sheets with PIL. **Crop from the full-size PNG in full-size coordinates.** Earlier
  crops went wrong because positions were read off a downscaled sheet with a column offset.
- Render PDFs to PNG with `pypdfium2` (`pip install pypdfium2`); pdftoppm and fitz aren't
  installed.
- Compare before and after at the same view, paint and viewport.
