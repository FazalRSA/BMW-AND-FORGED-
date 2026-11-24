/**
 * The wheel layers to render (render_car.py --wheel-layer), from the bundled catalogue: every active stock wheel with a
 * rim model, in each of its finishes, at one of its sizes. Writes the JSON list render_car.py reads.
 *
 *   bun scripts/prerender/wheel-combos.ts <decoded rims dir> <size index: 0 = first size, 1 = second> > combos.json
 *
 * The rims dir holds the rim GLBs decoded for Blender (bpy has no meshopt decoder; see docs/ADD_PREPARED_CAR.md,
 * "Path-traced wheel layers"), named as in public/models/rims/. Names are <wheel id>__<finish id>__<inches>, the key
 * the configurator looks up (services/renderedBody.ts wheelLayerFor). The finish values are the catalogue's, so a
 * finish changed in /admin needs its layers rendered again.
 */
import { existsSync } from 'node:fs';
import { basename, join } from 'node:path';
import { STATIC_CATALOG } from '../../services/catalogService';

const [dir, which] = process.argv.slice(2);
if (!dir || !['0', '1'].includes(which ?? '')) {
  console.error('usage: bun scripts/prerender/wheel-combos.ts <decoded rims dir> <0|1>');
  process.exit(2);
}
const sizeIndex = Number(which);
const rimFile = (url: string) => {
  const f = join(dir, basename(url));
  if (!existsSync(f)) {
    console.error(`${f}: missing (decode ${url} first)`);
    process.exit(1);
  }
  return f;
};

/**
 * Photo-matched Cycles recipes: [hex, metalness, roughness, clearcoat] per catalogue finish, replacing the catalogue's own
 * numbers for the path-traced layers only. The catalogue's numbers are tuned for the live WebGL wheels; Cycles reflects the
 * studio properly, so the same numbers come out darker and glossier than the website's product photographs. These were
 * calibrated against those photographs (scripts/prerender/finish_calibrate.py, white photo studio, face-on): the median
 * colour of the wheel is within a few levels of the photo for each. A finish not listed uses the catalogue's numbers
 * (gloss black and satin black already matched).
 */
const PHOTO_RECIPES: Record<string, [string, number, number, number]> = {
  hyper_black: ['#686a6d', 1, 0.24, 0.8],
  silver: ['#cacaca', 1, 0.38, 0],
  pure_bronze: ['#5b3e30', 1, 0.32, 0.4],
  liquid_metal: ['#a4a7ab', 1, 0.16, 0.8],
  polished_face: ['#c9c9c9', 1, 0.25, 0],
  gold: ['#c6b690', 1, 0.5, 0.1]
};

const combos = [];
for (const w of STATIC_CATALOG.wheels) {
  if (!w.modelUrl) continue; // the live-only legacy wheels have no rim model to render
  // the larger size first: 20" is the configurator's default, and FSA001 comes in 19" and 20"
  const sizes = [...(w.standardSizes ?? [])].sort((a, b) => parseInt(b, 10) - parseInt(a, 10));
  const ordered = sizes.length > 1 && parseInt(sizes[0], 10) > 20 ? [sizes[1], sizes[0]] : sizes;
  const size = ordered[sizeIndex];
  if (!size) continue;
  const rims = [rimFile(w.modelUrl), ...(w.rearModelUrl ? [rimFile(w.rearModelUrl)] : [])];
  for (const id of w.availableVariants ?? []) {
    const f = STATIC_CATALOG.finishes[id];
    if (!f) {
      console.error(`${w.id}: finish ${id} is not in the catalogue`);
      process.exit(1);
    }
    combos.push({ name: `${w.id}__${id}__${parseInt(size, 10)}`, rims, finish: PHOTO_RECIPES[id] ?? [f.hex, f.metalness, f.roughness, f.clearcoat ?? 0], inches: parseInt(size, 10) });
  }
}
console.log(JSON.stringify(combos, null, 1));
