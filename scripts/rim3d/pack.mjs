// Packs a rim GLB for the live site: weld, simplify to a triangle budget, quantize, meshopt-compress
// (same extensions as public/models/*.glb; the engine registers MeshoptDecoder).
//   node scripts/rim3d/pack.mjs in.glb out.glb [maxTriangles=40000] [dropRegex]
// Meshes whose node or mesh name matches dropRegex (default: brake parts and tyres, which the engine
// draws itself) are removed before packing; pass '' to keep everything.
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { weld, simplify, quantize, meshopt, dedup, prune } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer';
const [, , input, output, budgetArg, dropArg] = process.argv;
const budget = +(budgetArg || 40000);
const drop = dropArg === '' ? null : new RegExp(dropArg || '^(brake|caliper|calliper|rotor|disc|tyre|tire)', 'i');
await MeshoptEncoder.ready; await MeshoptSimplifier.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder });
const doc = await io.read(input);
const tris = (d) => d.getRoot().listMeshes().reduce((n, m) => n + m.listPrimitives().reduce((k, p) => k + (p.getIndices() ? p.getIndices().getCount() : p.getAttribute('POSITION').getCount()) / 3, 0), 0);
const dropped = [];
if (drop) {
  for (const node of doc.getRoot().listNodes()) {
    const mesh = node.getMesh();
    if (!mesh) continue;
    const name = node.getName() || mesh.getName();
    if (drop.test(name)) { dropped.push(name); node.dispose(); }
  }
}
const before = tris(doc);
await doc.transform(dedup(), weld());
if (before > budget) await doc.transform(simplify({ simplifier: MeshoptSimplifier, ratio: budget / before, error: 0.001, lockBorder: true }));
await doc.transform(prune(), quantize(), meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
await io.write(output, doc);
const fs = await import('node:fs');
console.log(`${input}: ${Math.round(before)} -> ${Math.round(tris(doc))} triangles, ${(fs.statSync(output).size / 1024).toFixed(0)} kB${dropped.length ? ` (dropped ${dropped.join(', ')})` : ''}`);
