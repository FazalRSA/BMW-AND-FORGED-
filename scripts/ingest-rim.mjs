#!/usr/bin/env node
/**
 * Puts a 3D rim file on a configurator wheel in one command.
 *
 *   node scripts/ingest-rim.mjs <rim.glb> --wheel forged_fsa_03 [--flip] [--check] [--budget 40000]
 *
 * Takes a rim GLB in the website's convention (public/models/wheels/README.md in the Forgedwebsite repo:
 * meshes Rim_Barrel, Rim_Face_Spokes, Hardware_Bolts, Center_Cap; axle bore at the origin; no tyre) or any
 * complete rim (face + barrel + lip + centre, no tyre), and:
 *
 *   1. reads it and checks what the engine needs (CarConfiguratorEngine.mountRimModel): a complete rim
 *      without a tyre, one thin axis (the axle), sensible width-to-diameter
 *   2. packs it for the live site with scripts/rim3d/pack.mjs (weld, simplify to the triangle budget,
 *      quantize, meshopt) into public/models/rims/<wheelId>.glb
 *   3. sets modelUrl / modelFlip on the wheel in the bundled catalogue (data/configuratorData.ts) and
 *      writes a Supabase migration for public.wheels, so both sources of truth agree
 *   4. --check shoots the wheel on the M4 (close-up and front three-quarter, two finishes) into
 *      docs/ingest/rims/<wheelId>/ with a contact sheet docs/ingest/rims/<wheelId>.jpg (needs the dev
 *      server: bunx vite --host 127.0.0.1 --port 5173)
 *
 * On the car the 3D rim replaces the wheel's photo face (the engine prefers modelUrl); the rim detail page
 * keeps its pre-rendered spin. The engine gives every mesh the selected finish material, so the file's own
 * colours do not matter. If the spokes face into the car in the check shot, run again with --flip.
 *
 * To go back to the photo face: remove modelUrl from the wheel (or clear "Rim 3D model" in /admin).
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const CATALOGUE = path.join(ROOT, 'data/configuratorData.ts');
const RIMS = path.join(ROOT, 'public/models/rims');
const MIGRATIONS = path.join(ROOT, 'supabase/migrations');

const die = (msg) => {
  console.error(`\nERROR: ${msg}`);
  process.exit(1);
};
const log = (msg) => console.log(msg);
// A failed read, write or spawn ends with one line, not a stack trace.
process.on('uncaughtException', (e) => die(e?.message || String(e)));
process.on('unhandledRejection', (e) => die(e?.message || String(e)));

const opts = { flip: false, check: false, dryRun: false, budget: '40000', port: '5173' };
const positional = [];
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  const valued = { '--wheel': 'wheel', '--budget': 'budget', '--port': 'port' };
  if (valued[a]) {
    if (argv[i + 1] === undefined) die(`${a} needs a value`);
    opts[valued[a]] = argv[++i];
  } else if (a === '--flip') opts.flip = true;
  else if (a === '--check') opts.check = true;
  else if (a === '--dry-run') opts.dryRun = true;
  else if (a === '-h' || a === '--help') { console.log(fs.readFileSync(new URL(import.meta.url), 'utf8').split('*/')[0]); process.exit(0); }
  else if (a.startsWith('--')) die(`unknown option ${a} (see --help)`);
  else positional.push(a);
}
const input = positional[0];
if (!input) die('usage: node scripts/ingest-rim.mjs <rim.glb> --wheel <id> [--flip] [--check] (see --help)');
if (!fs.existsSync(input)) die(`${input} does not exist`);
if (!/\.glb$/i.test(input)) die('the input must be a .glb (STEP/IGES/STL/OBJ: `bun run rim:convert` first, or upload in /admin)');
if (!opts.wheel || !/^[a-z0-9_]+$/.test(opts.wheel)) die('--wheel <id> is required, e.g. forged_fsa_03');
if (!(+opts.budget > 1000)) die('--budget is a triangle count, e.g. 40000');

// ---------------------------------------------------------------------------------------------------
// 1. Read and check
// ---------------------------------------------------------------------------------------------------
await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
let doc;
try {
  doc = await io.read(input);
} catch (e) {
  die(`could not read ${input}: ${e.message}`);
}
const root = doc.getRoot();
const meshes = [];
const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
let tris = 0;
for (const node of root.listNodes()) {
  const mesh = node.getMesh();
  if (!mesh) continue;
  const m = node.getWorldMatrix();
  const v = [0, 0, 0];
  let count = 0;
  for (const prim of mesh.listPrimitives()) {
    const pos = prim.getAttribute('POSITION');
    if (!pos) continue;
    const idx = prim.getIndices();
    count += (idx ? idx.getCount() : pos.getCount()) / 3;
    const n = pos.getCount();
    const stride = Math.max(1, Math.floor(n / 60000));
    for (let i = 0; i < n; i += stride) {
      pos.getElement(i, v);
      const p = [
        m[0] * v[0] + m[4] * v[1] + m[8] * v[2] + m[12],
        m[1] * v[0] + m[5] * v[1] + m[9] * v[2] + m[13],
        m[2] * v[0] + m[6] * v[1] + m[10] * v[2] + m[14]
      ];
      for (let k = 0; k < 3; k++) { if (p[k] < min[k]) min[k] = p[k]; if (p[k] > max[k]) max[k] = p[k]; }
    }
  }
  tris += count;
  meshes.push({ name: node.getName() || mesh.getName() || '(unnamed)', tris: Math.round(count), materials: mesh.listPrimitives().map((p) => p.getMaterial()?.getName() || '').filter(Boolean) });
}
if (!meshes.length) die('the file has no meshes');
const size = max.map((v, i) => v - min[i]);
const axle = size.indexOf(Math.min(...size));
const diameter = Math.max(...size.filter((_, i) => i !== axle));
const width = size[axle];
const ratio = width / diameter;
const names = meshes.map((x) => x.name);
const tyre = names.filter((n) => /tyre|tire/i.test(n));
const partOf = (re) => names.filter((n) => re.test(n));
const fileSize = fs.statSync(input).size;

log(`Rim check (${path.basename(input)}, ${(fileSize / 1024).toFixed(0)} kB, ${Math.round(tris).toLocaleString()} triangles, ${meshes.length} mesh${meshes.length === 1 ? '' : 'es'})`);
log(`  meshes: ${meshes.map((x) => `${x.name} (${x.tris.toLocaleString()})`).join(', ')}`);
log(`  barrel/lip: ${partOf(/barrel|lip/i).join(', ') || 'none named'}   face: ${partOf(/face|spoke/i).join(', ') || 'none named'}   cap: ${partOf(/cap/i).join(', ') || 'none named'}   bolts: ${partOf(/bolt|nut|hardware/i).join(', ') || 'none named'}`);
log(`  size: ${size.map((v) => v.toFixed(3)).join(' x ')} (axle along ${'XYZ'[axle]}, diameter ${diameter.toFixed(3)}, width ${width.toFixed(3)}, width/diameter ${ratio.toFixed(2)})`);
log(`  extensions: ${root.listExtensionsUsed().map((e) => e.extensionName).join(', ') || 'none'}`);
const problems = [];
if (tyre.length) problems.push(`the file holds a tyre (${tyre.join(', ')}); the engine adds its own tyre, so export the rim only.`);
if (ratio < 0.25 || ratio > 0.8) problems.push(`width/diameter ${ratio.toFixed(2)} is outside 0.25-0.8: this is not a complete rim (a flat face only?), or the units differ per axis. The engine needs face + barrel + lip + centre.`);
if (!partOf(/barrel|lip/i).length) log('  note: no mesh named barrel/lip; fine if the barrel is part of another mesh (the engine hides its own barrel and lip whatever the names)');
for (const p of problems) log(`  PROBLEM: ${p}`);
if (problems.length) {
  log('\nFix the problems above and run again. Nothing was changed.');
  process.exit(2);
}

// ---------------------------------------------------------------------------------------------------
// 2. Catalogue lookup
// ---------------------------------------------------------------------------------------------------
const source = fs.readFileSync(CATALOGUE, 'utf8');
const wheelsStart = source.indexOf('export const WHEEL_DESIGNS');
const wheelsEnd = source.indexOf('\n];', wheelsStart);
if (wheelsStart < 0 || wheelsEnd < 0) die('data/configuratorData.ts: WHEEL_DESIGNS not found');
const wheelIds = [...source.slice(wheelsStart, wheelsEnd).matchAll(/^    id: '([^']+)'/gm)].map((m) => m[1]);
if (!wheelIds.includes(opts.wheel)) die(`${opts.wheel} is not a wheel in the catalogue: ${wheelIds.join(', ')}`);
const modelUrl = `/models/rims/${opts.wheel}.glb`;
const target = path.join(RIMS, `${opts.wheel}.glb`);
log(`\nPlan for ${opts.wheel}: model_url ${modelUrl}, model_flip ${opts.flip}, packed to <= ${(+opts.budget).toLocaleString()} triangles`);
if (opts.dryRun) {
  log('--dry-run: nothing changed.');
  process.exit(0);
}

// ---------------------------------------------------------------------------------------------------
// 3. Pack
// ---------------------------------------------------------------------------------------------------
fs.mkdirSync(RIMS, { recursive: true });
const pack = spawnSync('node', [path.join(ROOT, 'scripts/rim3d/pack.mjs'), path.resolve(input), target, opts.budget], { encoding: 'utf8' });
process.stdout.write(pack.stdout || '');
if (pack.status !== 0) die(`pack.mjs failed: ${pack.stderr}`);
log(`Wrote ${path.relative(ROOT, target)} (${(fs.statSync(target).size / 1024).toFixed(0)} kB)`);

// ---------------------------------------------------------------------------------------------------
// 4. Bundled catalogue + migration
// ---------------------------------------------------------------------------------------------------
const lines = source.split('\n');
const start = lines.findIndex((l) => l === `    id: '${opts.wheel}',`);
let end = start;
while (end < lines.length && !/^  },?\s*(\/\/.*)?$/.test(lines[end])) end++;   // "  }," with or without a trailing comment
if (start < 0 || end >= lines.length) die('could not find the wheel entry');
const kept = lines.slice(start, end).filter((l) => !/^    (modelUrl|modelFlip):/.test(l));
{ // a trailing comma on the last line that holds code (not on a trailing full-line comment), in front of any "// comment"
  let last = kept.length - 1;
  while (last > 0 && /^\s*(\/\/.*)?$/.test(kept[last])) last--;
  const m = kept[last].match(/^(.*?)(\s*\/\/.*)?$/);
  const code = m[1].trimEnd(), comment = m[2] || '';
  if (code && !code.endsWith(',')) kept[last] = `${code},${comment}`;
}
kept.push(`    modelUrl: '${modelUrl}',`, `    modelFlip: ${opts.flip}`);
lines.splice(start, end - start, ...kept);
fs.writeFileSync(CATALOGUE, lines.join('\n'));
log(`Updated ${path.relative(ROOT, CATALOGUE)}`);

const stamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
const migration = path.join(MIGRATIONS, (fs.existsSync(MIGRATIONS) && fs.readdirSync(MIGRATIONS).find((f) => f.endsWith(`_wheel_${opts.wheel}_rim_model.sql`))) || `${stamp}_wheel_${opts.wheel}_rim_model.sql`);
fs.writeFileSync(migration, `-- ${opts.wheel}: 3D rim ${path.basename(input)} packed by scripts/ingest-rim.mjs on ${new Date().toISOString().slice(0, 10)}.
-- Served from the repo at ${modelUrl}; on the car it replaces the wheel's photo face (the rim page keeps its spin).
update public.wheels set model_url = '${modelUrl}', model_flip = ${opts.flip}, updated_at = now() where id = '${opts.wheel}';
`);
log(`Wrote ${path.relative(ROOT, migration)} (apply it to Supabase, or upload the same file in /admin > Wheels > ${opts.wheel} > Rim 3D model)`);

// ---------------------------------------------------------------------------------------------------
// 5. Check shots
// ---------------------------------------------------------------------------------------------------
if (opts.check) {
  const up = spawnSync('curl', ['-s', '-o', '/dev/null', '-w', '%{http_code}', `http://127.0.0.1:${opts.port}/scripts/render/engine.html`]);
  if (!(up.status === 0 && up.stdout.toString() === '200')) {
    log(`\n--check skipped: start the dev server first (bunx vite --host 127.0.0.1 --port ${opts.port}).`);
  } else {
    const idx = wheelIds.indexOf(opts.wheel);
    const outDir = path.join(ROOT, 'docs/ingest/rims', opts.wheel);
    fs.rmSync(outDir, { recursive: true, force: true });
    fs.mkdirSync(outDir, { recursive: true });
    const shots = [
      { name: '1-wheel-liquid-metal', car: 0, paint: 2, wheel: idx, finish: 'liquid_metal', view: 'frontWheel', w: 1280, h: 800 },
      { name: '2-wheel-black', car: 0, paint: 2, wheel: idx, finish: 'black', view: 'frontWheel', w: 1280, h: 800 },
      { name: '3-front34-silver', car: 0, paint: 3, wheel: idx, finish: 'silver', view: 'frontThreeQuarter', w: 1280, h: 800 },
      { name: '4-front34-bronze-21', car: 7, paint: 7, wheel: idx, finish: 'bronze', size: '21"', view: 'frontThreeQuarter', w: 1280, h: 800 }
    ];
    const spec = path.join(os.tmpdir(), `ingest-rim-${opts.wheel}-shots.json`);
    fs.writeFileSync(spec, JSON.stringify(shots));
    log(`\nShooting ${shots.length} check views (about a minute each on SwiftShader)...`);
    const r = spawnSync('node', [path.join(ROOT, 'scripts/render/shoot.cjs'), outDir, spec], { encoding: 'utf8' });
    process.stdout.write(r.stdout || '');
    if (r.status !== 0) log(`shoot.cjs failed: ${r.stderr}`);
    const sheet = path.join(ROOT, 'docs/ingest/rims', `${opts.wheel}.jpg`);
    const py = spawnSync('python3', ['-I', '-', outDir, sheet, `${opts.wheel}: ${path.basename(input)}${opts.flip ? ' (flipped)' : ''}`], {
      input: `
import sys, os, glob
from PIL import Image, ImageDraw
src, dst, title = sys.argv[1:4]
files = sorted(glob.glob(os.path.join(src, '*.png')))
if files:
    W = 640
    ims = [Image.open(f).convert('RGB') for f in files]
    ims = [im.resize((W, round(im.height * W / im.width))) for im in ims]
    cols = 2; rows = (len(ims) + cols - 1) // cols
    h = max(im.height for im in ims)
    sheet = Image.new('RGB', (cols * W, 28 + rows * (h + 22)), (18, 18, 20))
    d = ImageDraw.Draw(sheet); d.text((8, 7), title, fill=(230, 230, 230))
    for i, (im, f) in enumerate(zip(ims, files)):
        x = (i % cols) * W; y = 28 + (i // cols) * (h + 22)
        sheet.paste(im, (x, y + 20)); d.text((x + 6, y + 4), os.path.basename(f)[:-4], fill=(200, 200, 200))
    sheet.save(dst, quality=86)
    print('contact sheet', dst)
`, encoding: 'utf8' });
    process.stdout.write(py.stdout || '');
    log(`Look at ${path.relative(ROOT, sheet)}: spokes facing out (else --flip), the rim filling the tyre, the caliper visible behind the spokes.`);
  }
}

const tsc = spawnSync('npx', ['tsc', '--noEmit'], { cwd: ROOT, encoding: 'utf8' });
log(tsc.status === 0 ? '\nType-check passed (tsc --noEmit).' : `\nType-check FAILED:\n${(tsc.stdout || tsc.stderr).split('\n').slice(0, 12).join('\n')}`);
log(`\nNext: git add -A && git commit -m "3D rim for ${opts.wheel}" && git push, then deploy and apply ${path.basename(migration)}.`);
