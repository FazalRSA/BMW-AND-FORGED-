/**
 * What does a visitor download for each half of the site, and is three.js in the configurator's?
 *
 *   bun run build && node scripts/route-chunks.mjs [dist]
 *
 * For the configurator (/configure) and for the 3D half (welcome, showroom, wheel pages, admin) it lists
 * the chunks loaded before anything is clicked: the entry chunk of index.html, the half's own chunk, and
 * every chunk those import statically (chunks behind import() are not counted: they load on demand).
 * Exits 1 when a chunk of the configurator contains three.js, which that page must never load.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { join } from 'node:path';

const dist = process.argv[2] ?? 'dist';
const assets = join(dist, 'assets');
const scripts = readdirSync(assets).filter((file) => file.endsWith('.js'));
const kilobytes = (bytes) => `${(bytes / 1024).toFixed(1).padStart(8)} kB`;
/** Marks left by three.js in a minified bundle. */
const THREE_JS = /WebGLRenderer|__THREE__|WebGLRenderTarget|BufferGeometry/;

const staticImports = (file) => [...readFileSync(join(assets, file), 'utf8').matchAll(/(?:from|import)\s*["']\.\/([^"']+\.js)["']/g)].map((match) => match[1]);
const entry = readFileSync(join(dist, 'index.html'), 'utf8').match(/assets\/(index-[^"']+\.js)/)?.[1];
if (!entry) throw new Error(`no entry script found in ${join(dist, 'index.html')}`);

function report(title, chunkPrefix) {
  const own = scripts.find((file) => file.startsWith(chunkPrefix));
  if (!own) throw new Error(`no chunk named ${chunkPrefix}* in ${assets}`);
  const loaded = new Set();
  const walk = (file) => {
    if (loaded.has(file)) return;
    loaded.add(file);
    staticImports(file).forEach(walk);
  };
  walk(entry);
  walk(own);
  let raw = 0, zipped = 0, withThree = [];
  console.log(`\n${title}`);
  for (const file of [...loaded].sort()) {
    const bytes = readFileSync(join(assets, file));
    const gzip = gzipSync(bytes).length;
    const three = THREE_JS.test(bytes.toString('utf8'));
    if (three) withThree.push(file);
    raw += bytes.length;
    zipped += gzip;
    console.log(`  ${file.padEnd(34)} ${kilobytes(bytes.length)}   gzip ${kilobytes(gzip)}   three.js: ${three ? 'YES' : 'no'}`);
  }
  console.log(`  ${`total, ${loaded.size} scripts`.padEnd(34)} ${kilobytes(raw)}   gzip ${kilobytes(zipped)}`);
  return withThree;
}

const inConfigurator = report('The configurator (/configure)', 'ConfigurePage-');
report('The 3D half (/, /models, /forged, /rims, /admin)', 'App-');
for (const file of readdirSync(assets).filter((name) => name.endsWith('.css'))) {
  const bytes = readFileSync(join(assets, file));
  console.log(`\nStyles (both halves)\n  ${file.padEnd(34)} ${kilobytes(bytes.length)}   gzip ${kilobytes(gzipSync(bytes).length)}`);
}
if (inConfigurator.length) {
  console.error(`\nFAIL: the configurator loads three.js (${inConfigurator.join(', ')})`);
  process.exit(1);
}
console.log('\nOK: no chunk of the configurator contains three.js');
