/**
 * Which source files does nothing import any more?
 *
 *   node scripts/unreferenced.mjs                       # from index.tsx (what the site ships)
 *   node scripts/unreferenced.mjs --root <checkout>     # the same question for another checkout
 *   node scripts/unreferenced.mjs --cut App.tsx:services/CarConfiguratorEngine.ts
 *                                                       # "and if App.tsx no longer imported the engine?"
 *   node scripts/unreferenced.mjs --why services/viewerStudio.ts     # the chain of imports that keeps a file
 *
 * It follows static imports, re-exports, dynamic import() and `new URL('./x', import.meta.url)`
 * (workers) from the entry (index.tsx; add more with --entry), over the app's source folders, and
 * prints the source files that are never reached. `--cut from:to` removes one import before walking
 * (repeatable), to see what a planned removal would free. Test files and type declarations are not
 * source. It reads imports with a regular expression, not a compiler: check a surprising answer by hand.
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';

const args = process.argv.slice(2);
const option = (name) => args.flatMap((arg, index) => (arg === name ? [args[index + 1]] : []));
const root = resolve(option('--root')[0] ?? '.');
const entries = ['index.tsx', ...option('--entry')];
const cuts = new Set(option('--cut'));
const why = option('--why')[0];

const SOURCE_DIRS = ['components', 'services', 'config', 'data'];
const SOURCE = /\.(tsx?|jsx?|mjs)$/;
const NOT_SOURCE = /(\.d\.ts|\.test\.tsx?)$/;

function sourceFiles() {
  const found = readdirSync(root).filter((name) => SOURCE.test(name) && !NOT_SOURCE.test(name) && !/\.config\./.test(name));
  const walk = (dir) => {
    for (const name of readdirSync(join(root, dir))) {
      const path = join(dir, name);
      if (statSync(join(root, path)).isDirectory()) walk(path);
      else if (SOURCE.test(name) && !NOT_SOURCE.test(name)) found.push(path);
    }
  };
  for (const dir of SOURCE_DIRS) if (existsSync(join(root, dir))) walk(dir);
  return found.sort();
}

const IMPORT = /(?:\bimport\s+(?:type\s+)?(?:[\w*${}\s,]+\s+from\s+)?|\bexport\s+(?:type\s+)?[\w*{}\s,]+\s+from\s+|\bimport\s*\(\s*|\bnew\s+URL\s*\(\s*)['"]([^'"]+)['"]/g;

/** The file a specifier points at, relative to the root, or null for a package or something outside the source. */
function resolveImport(from, specifier) {
  let base;
  if (specifier.startsWith('@/')) base = specifier.slice(2);
  else if (specifier.startsWith('/')) base = specifier.slice(1);
  else if (specifier.startsWith('.')) base = relative(root, resolve(root, dirname(from), specifier));
  else return null;
  for (const candidate of [base, `${base}.ts`, `${base}.tsx`, `${base}.js`, `${base}.mjs`, join(base, 'index.ts'), join(base, 'index.tsx')]) {
    if (existsSync(join(root, candidate)) && statSync(join(root, candidate)).isFile()) return candidate;
  }
  return null;
}

function importsOf(file) {
  const text = readFileSync(join(root, file), 'utf8');
  const found = new Set();
  for (const match of text.matchAll(IMPORT)) {
    const target = resolveImport(file, match[1]);
    if (target && !cuts.has(`${file}:${target}`)) found.add(target);
  }
  return [...found];
}

const all = sourceFiles();
const importedBy = new Map(); // file -> the file that first reached it
const queue = entries.filter((entry) => existsSync(join(root, entry)));
for (const entry of queue) importedBy.set(entry, null);
while (queue.length) {
  const file = queue.shift();
  for (const target of importsOf(file)) {
    if (importedBy.has(target)) continue;
    importedBy.set(target, file);
    queue.push(target);
  }
}

if (why) {
  if (!importedBy.has(why)) console.log(`${why} is not reached from ${entries.join(', ')}`);
  else {
    const chain = [why];
    while (importedBy.get(chain[0])) chain.unshift(importedBy.get(chain[0]));
    console.log(chain.join('\n  -> '));
  }
  process.exit(0);
}

const unreferenced = all.filter((file) => !importedBy.has(file));
const lines = (file) => readFileSync(join(root, file), 'utf8').split('\n').length;
console.log(`${all.length} source files under ${root}; ${importedBy.size} reached from ${entries.join(', ')}${cuts.size ? ` with ${cuts.size} import(s) cut` : ''}`);
console.log(`${unreferenced.length} unreferenced (${unreferenced.reduce((total, file) => total + lines(file), 0)} lines):`);
for (const file of unreferenced) console.log(`  ${file}  (${lines(file)} lines)`);
