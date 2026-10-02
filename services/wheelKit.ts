/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as THREE from 'three';
import { mergeGeometries, toCreasedNormals } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * Photoreal wheel parts, generated in code so they follow any rim design, size and car:
 *
 * - tyre: a 35-series performance tyre profile (crowned tread with four circumferential
 *   grooves, rounded shoulders, bulging sidewall, rim-protector rib) with a generated tread
 *   pattern and raised sidewall lettering in a matte "velvet" band;
 * - rim shell: the lip and barrel as a lathe of a real rim cross-section (rounded flange, inner
 *   wall, drop centre), with a polished, bolted lip for two- and three-piece designs;
 * - brakes: a two-piece floating disc (cross-drilled vented friction ring with concentric
 *   machining, anodised hat, bobbins) and a six-piston monoblock caliper in gloss paint;
 * - hub: hex lug nuts and a domed centre cap.
 *
 * Units are metres. Every part is built around the axle on +X (the outward face of the wheel),
 * the convention of the engine's wheel assemblies. Base sizes are for a 20" rim in a 0.35 m tyre;
 * `rimScale` = inches / 20.
 */

// ---------------------------------------------------------------------------
// Dimensions
// ---------------------------------------------------------------------------

export interface WheelDims {
  /** Tyre outer radius. */
  tyreRadius: number;
  /** Tyre section width (widest point of the sidewalls). */
  tyreWidth: number;
  /** Rim diameter relative to 20". */
  rimScale: number;
  isFront: boolean;
}

export const SPOKE_BEVEL = 0.003;

export function rimLayout(d: WheelDims) {
  const s = d.rimScale;
  const lipOuter = 0.262 * s; // outer edge of the rim lip
  const faceRadius = 0.24 * s; // where the spokes meet the lip
  const beadSeat = 0.254 * s;
  const rimWidth = d.tyreWidth - 0.03;
  const lipX = d.tyreWidth / 2 - 0.012; // front plane of the lip
  const faceEdgeX = lipX - 0.01; // spokes meet the lip a little behind its front face
  const dish = d.isFront ? 0.036 : 0.058; // concavity: hub sits this far behind the spoke ends
  const spokeDepth = 0.032;
  const hubFrontX = faceEdgeX - dish;
  const hubBackX = hubFrontX - spokeDepth - 2 * SPOKE_BEVEL - 0.001; // wheel mounting face
  const discRadius = d.isFront ? 0.19 : 0.185; // 380 / 370 mm discs
  const discThickness = d.isFront ? 0.036 : 0.028;
  // Disc centre plane: deep enough that the caliper clears the back of the concave spokes
  const discX = d.isFront ? -0.014 : -0.008;
  return { s, lipOuter, faceRadius, beadSeat, rimWidth, lipX, faceEdgeX, dish, spokeDepth, hubFrontX, hubBackX, discRadius, discThickness, discX };
}

/** Lathe around +X: points are (radius, axial x). */
function lathe(points: [number, number][], segments: number, uvAlongProfile = true): THREE.BufferGeometry {
  const pts = points.map(([r, x]) => new THREE.Vector2(r, x));
  const geo = new THREE.LatheGeometry(pts, segments);
  if (uvAlongProfile) {
    // v by arc length (LatheGeometry spaces v by point index), so textures don't stretch
    const s = [0];
    for (let j = 1; j < pts.length; j++) s.push(s[j - 1] + pts[j].distanceTo(pts[j - 1]));
    const total = s[s.length - 1] || 1;
    const uv = geo.attributes.uv as THREE.BufferAttribute;
    for (let i = 0; i <= segments; i++) {
      for (let j = 0; j < pts.length; j++) uv.setY(i * pts.length + j, s[j] / total);
    }
    uv.needsUpdate = true;
  }
  geo.rotateZ(-Math.PI / 2); // lathe axis +Y -> axle +X
  return geo;
}

function cubic(p0: [number, number], p1: [number, number], p2: [number, number], p3: [number, number], n: number, skipFirst = true) {
  const out: [number, number][] = [];
  for (let i = skipFirst ? 1 : 0; i <= n; i++) {
    const t = i / n;
    const a = (1 - t) ** 3, b = 3 * (1 - t) ** 2 * t, c = 3 * (1 - t) * t * t, e = t ** 3;
    out.push([a * p0[0] + b * p1[0] + c * p2[0] + e * p3[0], a * p0[1] + b * p1[1] + c * p2[1] + e * p3[1]]);
  }
  return out;
}

function arcPts(cr: number, cx: number, rad: number, a0: number, a1: number, n: number, skipFirst = true) {
  const out: [number, number][] = [];
  for (let i = skipFirst ? 1 : 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n;
    out.push([cr + Math.sin(a) * rad, cx + Math.cos(a) * rad]);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Generated textures (cached, shared by every wheel)
// ---------------------------------------------------------------------------

function heightToNormal(h: Float32Array, w: number, hh: number, strength: number, wrapX = true): Uint8ClampedArray {
  const out = new Uint8ClampedArray(w * hh * 4);
  const at = (x: number, y: number) => {
    if (wrapX) x = (x + w) % w;
    else x = Math.min(w - 1, Math.max(0, x));
    y = Math.min(hh - 1, Math.max(0, y));
    return h[y * w + x];
  };
  for (let y = 0; y < hh; y++) {
    for (let x = 0; x < w; x++) {
      const dx = (at(x + 1, y) - at(x - 1, y)) * strength;
      const dy = (at(x, y + 1) - at(x, y - 1)) * strength;
      // canvas rows run down, texture v runs up: flip the y slope
      let nx = -dx, ny = dy, nz = 1;
      const l = Math.hypot(nx, ny, nz);
      nx /= l; ny /= l; nz /= l;
      const i = (y * w + x) * 4;
      out[i] = (nx * 0.5 + 0.5) * 255;
      out[i + 1] = (ny * 0.5 + 0.5) * 255;
      out[i + 2] = (nz * 0.5 + 0.5) * 255;
      out[i + 3] = 255;
    }
  }
  return out;
}

function blur(h: Float32Array, w: number, hh: number, passes = 1, wrapX = true) {
  const tmp = new Float32Array(h.length);
  for (let p = 0; p < passes; p++) {
    for (let y = 0; y < hh; y++) {
      for (let x = 0; x < w; x++) {
        const xl = wrapX ? (x - 1 + w) % w : Math.max(0, x - 1);
        const xr = wrapX ? (x + 1) % w : Math.min(w - 1, x + 1);
        tmp[y * w + x] = (h[y * w + xl] + 2 * h[y * w + x] + h[y * w + xr]) / 4;
      }
    }
    for (let y = 0; y < hh; y++) {
      const yu = Math.max(0, y - 1), yd = Math.min(hh - 1, y + 1);
      for (let x = 0; x < w; x++) h[y * w + x] = (tmp[yu * w + x] + 2 * tmp[y * w + x] + tmp[yd * w + x]) / 4;
    }
  }
}

function dataTexture(data: Uint8ClampedArray, w: number, h: number, srgb = false): THREE.DataTexture {
  const tex = new THREE.DataTexture(new Uint8Array(data.buffer), w, h, THREE.RGBAFormat);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.anisotropy = 8;
  tex.flipY = false;
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

let treadCache: THREE.Texture | null = null;
/**
 * Tread pattern, one tile of seven pitches (u = around the tyre, v = across the tread): angled
 * lateral grooves in the shoulder blocks and fine sipes across the ribs. The four main
 * circumferential grooves are real geometry in the tyre profile.
 */
export function treadNormalMap(): THREE.Texture {
  if (treadCache) return treadCache;
  const W = 1024, H = 256, pitches = 7;
  const h = new Float32Array(W * H).fill(1);
  const pitch = W / pitches;
  for (let y = 0; y < H; y++) {
    const v = y / (H - 1); // 0 = inner shoulder, 1 = outer shoulder (texture v; canvas rows map to v directly, flipY off)
    for (let x = 0; x < W; x++) {
      let val = 1;
      const shoulder = v < 0.17 || v > 0.83;
      if (shoulder) {
        // lateral grooves, slightly curved, deepening towards the tyre edge
        const edge = v < 0.5 ? (0.17 - v) / 0.17 : (v - 0.83) / 0.17;
        const slant = (v < 0.5 ? -1 : 1) * 0.35 * pitch * (1 - edge) ** 1.5;
        const p = ((x + slant) % pitch + pitch) % pitch;
        const gw = pitch * (0.13 + 0.05 * edge);
        if (p < gw) val = 0.15 + 0.25 * (1 - edge);
        // a fine sipe in the middle of each shoulder block
        const q = ((x + slant + pitch / 2) % pitch + pitch) % pitch;
        if (q < 2.2 && edge < 0.75) val = Math.min(val, 0.45);
      } else {
        // ribs: thin sipes at 28°, every half pitch, not running into the grooves
        const along = x + (v - 0.5) * H * 0.55;
        const p = ((along % (pitch / 2)) + pitch / 2) % (pitch / 2);
        const ribPos = v < 0.5 ? (v - 0.17) / 0.33 : (0.83 - v) / 0.33;
        if (p < 2.0 && ribPos > 0.12) val = 0.55;
      }
      h[y * W + x] = val;
    }
  }
  blur(h, W, H, 2);
  treadCache = dataTexture(heightToNormal(h, W, H, 6), W, H);
  return treadCache;
}

const sidewallCache = new Map<string, { normal: THREE.Texture; rough: THREE.Texture }>();
/**
 * Sidewall markings for one half of the tyre (the texture repeats twice around): raised size and
 * load markings in a matte band, the way premium performance tyres are finished. Generic text
 * only; no tyre brand. u = around the tyre, v = from the bead (0) to the shoulder (1).
 */
export function sidewallMaps(sizeLabel: string): { normal: THREE.Texture; rough: THREE.Texture } {
  const cached = sidewallCache.get(sizeLabel);
  if (cached) return cached;
  const W = 4096, H = 256;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#fff';
  ctx.textBaseline = 'middle';
  const font = (px: number, weight = 800) => `${weight} ${px}px "Arial Narrow", Arial, Helvetica, sans-serif`;
  // Orientation checked on the rendered tyre: drawn as-is, the markings read clockwise round the
  // outer sidewall with the letter tops towards the tread, as on a real tyre.
  const write = (text: string, x: number, y: number, px: number, spacing = 0.06, weight = 800) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.font = font(px, weight);
    let cx = 0;
    const widths = [...text].map((ch) => ctx.measureText(ch).width + px * spacing);
    const total = widths.reduce((a, b) => a + b, 0);
    cx = -total / 2;
    [...text].forEach((ch, i) => {
      ctx.fillText(ch, cx, 0);
      cx += widths[i];
    });
    ctx.restore();
  };
  write(sizeLabel, W * 0.25, H * 0.56, 92, 0.05);
  write('RADIAL  TUBELESS', W * 0.62, H * 0.62, 44, 0.12, 700);
  write('EXTRA LOAD', W * 0.62, H * 0.42, 40, 0.12, 700);
  write('MAX LOAD 850 KG (1874 LBS)  AT 340 KPA (50 PSI) MAX PRESS', W * 0.86, H * 0.66, 22, 0.06, 600);
  write('TREADWEAR 300   TRACTION AA   TEMPERATURE A', W * 0.86, H * 0.5, 22, 0.06, 600);
  write('DOT  XB 4T  3925', W * 0.05, H * 0.5, 28, 0.08, 700);
  // tread-wear indicator arrows
  for (const x of [W * 0.12, W * 0.47, W * 0.95]) {
    ctx.beginPath();
    ctx.moveTo(x - 14, H * 0.86);
    ctx.lineTo(x + 14, H * 0.86);
    ctx.lineTo(x, H * 0.95);
    ctx.closePath();
    ctx.fill();
  }
  const img = ctx.getImageData(0, 0, W, H).data;
  const letters = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) letters[i] = img[i * 4] / 255;
  const height = new Float32Array(letters);
  blur(height, W, H, 1);
  // matte velvet band behind the lettering: v 0.3..0.78, with soft edges
  const rough = new Uint8ClampedArray(W * H * 4);
  for (let y = 0; y < H; y++) {
    const v = y / (H - 1);
    const band = smoothstep(0.26, 0.32, v) * (1 - smoothstep(0.76, 0.82, v));
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      // band edge is a fine raised step, letters are raised 0.6 mm
      height[i] = height[i] * 0.9 + band * 0.12;
      const r = 0.62 + band * 0.28 - letters[i] * band * 0.32; // satin wall, matte band, glossy letters
      const o = i * 4;
      rough[o] = rough[o + 1] = rough[o + 2] = Math.round(THREE.MathUtils.clamp(r, 0, 1) * 255);
      rough[o + 3] = 255;
    }
  }
  const res = {
    normal: dataTexture(heightToNormal(height, W, H, 3.5), W, H),
    rough: dataTexture(rough, W, H)
  };
  sidewallCache.set(sizeLabel, res);
  return res;
}

function smoothstep(a: number, b: number, x: number) {
  const t = THREE.MathUtils.clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
}

let discCache: { normal: THREE.Texture; aniso: THREE.Texture; color: THREE.Texture } | null = null;
/**
 * Brake disc friction face, planar UVs over the disc (u, v = x, y / disc diameter + 0.5):
 * concentric machining grooves (normal map), a concentric brushing direction for anisotropic
 * reflections, and a faint darker bedding band where the pads run.
 */
export function discMaps() {
  if (discCache) return discCache;
  const N = 512;
  const h = new Float32Array(N * N);
  const aniso = new Uint8ClampedArray(N * N * 4);
  const color = new Uint8ClampedArray(N * N * 4);
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const u = (x + 0.5) / N - 0.5, v = (y + 0.5) / N - 0.5;
      const r = Math.hypot(u, v) * 2; // 1 = disc edge
      const i = y * N + x;
      h[i] = 0.5 + 0.5 * Math.sin(r * Math.PI * 2 * 95) * 0.6 + 0.2 * Math.sin(r * Math.PI * 2 * 23);
      // Lathe-turned faces: the grooves are circles, so highlights stretch radially (the
      // anisotropy direction is radial). Never (0.5, 0.5): a zero direction gives NaN.
      const dx = r > 1e-4 ? u / Math.hypot(u, v) : 1;
      const dy = r > 1e-4 ? v / Math.hypot(u, v) : 0;
      const o = i * 4;
      aniso[o] = (dx * 0.5 + 0.5) * 255;
      aniso[o + 1] = (dy * 0.5 + 0.5) * 255;
      aniso[o + 2] = 255;
      aniso[o + 3] = 255;
      // bedding band (pad track) slightly darker and bluish
      const band = smoothstep(0.66, 0.72, r) * (1 - smoothstep(0.95, 0.99, r));
      const g = 200 - band * 38 + Math.sin(r * 300) * 4;
      color[o] = g - band * 6;
      color[o + 1] = g - band * 3;
      color[o + 2] = g + band * 4;
      color[o + 3] = 255;
    }
  }
  discCache = {
    normal: dataTexture(heightToNormal(h, N, N, 0.8, false), N, N),
    aniso: dataTexture(aniso, N, N),
    color: dataTexture(color, N, N, true)
  };
  for (const t of Object.values(discCache)) t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return discCache;
}

let barrelAoCache: THREE.Texture | null = null;
/**
 * Ambient occlusion along the barrel profile (v = 0 at the face ring, 1 at the inner bead): the
 * environment light can't see past the spokes, tyre and brake, so the barrel darkens with depth.
 * In three.js r181 an aoMap also dims the environment reflections, which is what matters on metal.
 */
export function barrelAoMap(): THREE.Texture {
  if (barrelAoCache) return barrelAoCache;
  const W = 4, H = 128;
  const data = new Uint8ClampedArray(W * H * 4);
  for (let y = 0; y < H; y++) {
    const v = y / (H - 1);
    const ao = 0.85 - 0.6 * smoothstep(0.0, 0.45, v) + 0.1 * smoothstep(0.85, 1, v);
    for (let x = 0; x < W; x++) {
      const o = (y * W + x) * 4;
      data[o] = data[o + 1] = data[o + 2] = Math.round(ao * 255);
      data[o + 3] = 255;
    }
  }
  barrelAoCache = dataTexture(data, W, H);
  barrelAoCache.wrapT = THREE.ClampToEdgeWrapping;
  return barrelAoCache;
}

let capCache: THREE.Texture | null = null;
/** Centre cap face: black with a gold FSA monogram in a thin ring (brand gold #CF9F52). */
export function capTexture(): THREE.Texture {
  if (capCache) return capCache;
  const N = 256;
  const c = document.createElement('canvas');
  c.width = c.height = N;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(N * 0.45, N * 0.4, 0, N / 2, N / 2, N / 2);
  grad.addColorStop(0, '#26272a');
  grad.addColorStop(1, '#0c0c0d');
  g.fillStyle = grad;
  g.beginPath();
  g.arc(N / 2, N / 2, N / 2, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = '#CF9F52';
  g.lineWidth = 6;
  g.beginPath();
  g.arc(N / 2, N / 2, N * 0.42, 0, Math.PI * 2);
  g.stroke();
  g.fillStyle = '#CF9F52';
  g.font = '800 70px "Arial Narrow", Arial, Helvetica, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('FSA', N / 2, N / 2 + 3);
  capCache = new THREE.CanvasTexture(c);
  capCache.colorSpace = THREE.SRGBColorSpace;
  capCache.anisotropy = 4;
  return capCache;
}

// ---------------------------------------------------------------------------
// Wheel-arch occlusion and loaded tyre
// ---------------------------------------------------------------------------

/**
 * Shared by every wheel material. `uArchStrength` is 1 on a car and 0 in the stand-alone rim
 * showcase (no car, so no wheel arch); `uFloorY` is the floor the tyres stand on.
 */
export const wheelShadingUniforms = {
  uArchStrength: { value: 1 },
  uFloorY: { value: 0 }
};

/**
 * Environment and studio light in three.js aren't blocked by geometry, so the top of the tyre and
 * whatever sits under the fender is lit as if the car weren't there. This darkens wheel parts
 * towards the top of the wheel (world height), the way the wheel arch shades them in a photo.
 * Tyres can also flatten where they meet the floor (a loaded tyre, not a toy on a line contact);
 * done on the GPU in world space, so it stays at the bottom while the wheel spins.
 */
export function installWheelShading(material: THREE.Material, opts: { arch: number; flatten?: boolean }) {
  const m = material as THREE.MeshStandardMaterial;
  const key = `forgedsa-wheel-${opts.arch}-${opts.flatten ? 1 : 0}`;
  m.customProgramCacheKey = () => key;
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uArchStrength = wheelShadingUniforms.uArchStrength;
    shader.uniforms.uFloorY = wheelShadingUniforms.uFloorY;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uFloorY;\nvarying float vArchY;')
      .replace(
        '#include <project_vertex>',
        (opts.flatten
          ? `{
  // loaded tyre: the bottom 9 mm flattens onto the floor
  vec4 wpF = modelMatrix * vec4(transformed, 1.0);
  float flatY = uFloorY + 0.009;
  if (wpF.y < flatY) {
    wpF.y = flatY + (wpF.y - flatY) * 0.08;
    transformed = (inverse(modelMatrix) * wpF).xyz;
  }
}
`
          : '') + '#include <project_vertex>\nvArchY = (modelMatrix * vec4(transformed, 1.0)).y - uFloorY;'
      );
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uArchStrength;\nvarying float vArchY;')
      .replace(
        '#include <aomap_fragment>',
        `#include <aomap_fragment>
{
  // shade of the wheel arch over the top of the wheel (tyre top at ~0.7 m)
  float archOcc = 1.0 - uArchStrength * ${opts.arch.toFixed(2)} * smoothstep(0.38, 0.68, vArchY);
  reflectedLight.indirectDiffuse *= archOcc;
  reflectedLight.indirectSpecular *= archOcc;
  reflectedLight.directDiffuse *= mix(1.0, archOcc, 0.8);
  reflectedLight.directSpecular *= mix(1.0, archOcc, 0.8);
}`
      );
  };
  m.needsUpdate = true;
}

// ---------------------------------------------------------------------------
// Materials
// ---------------------------------------------------------------------------

export interface WheelKitMaterials {
  tread: THREE.MeshPhysicalMaterial;
  sidewall: THREE.MeshPhysicalMaterial;
  lipPolished: THREE.MeshPhysicalMaterial;
  bolt: THREE.MeshPhysicalMaterial;
  lugNut: THREE.MeshPhysicalMaterial;
  cap: THREE.MeshPhysicalMaterial;
  discFace: THREE.MeshPhysicalMaterial;
  discEdge: THREE.MeshStandardMaterial;
  hat: THREE.MeshPhysicalMaterial;
  caliper: THREE.MeshPhysicalMaterial;
  pad: THREE.MeshStandardMaterial;
}

export function createWheelKitMaterials(): WheelKitMaterials {
  const disc = discMaps();
  const tread = treadNormalMap();
  tread.repeat.set(12, 1);
  const kit: WheelKitMaterials = {
    // Rubber: dark charcoal rather than black, a soft sheen at grazing angles
    tread: new THREE.MeshPhysicalMaterial({
      name: 'tyre_tread', side: THREE.DoubleSide,
      // rubber albedo ~0.023 linear: lighter than it looks, ACES crushes it otherwise
      color: 0x302e2d,
      roughness: 0.88,
      metalness: 0,
      normalMap: tread,
      normalScale: new THREE.Vector2(0.9, 0.9),
      sheen: 0.5,
      sheenRoughness: 0.6,
      sheenColor: new THREE.Color(0x4a4847),
      envMapIntensity: 0.7
    }),
    sidewall: new THREE.MeshPhysicalMaterial({
      name: 'tyre_sidewall', side: THREE.DoubleSide,
      color: 0x333130,
      roughness: 1,
      metalness: 0,
      sheen: 0.55,
      sheenRoughness: 0.55,
      sheenColor: new THREE.Color(0x4f4d4b),
      envMapIntensity: 0.75
    }),
    lipPolished: new THREE.MeshPhysicalMaterial({
      name: 'rim_lip_polished', side: THREE.DoubleSide,
      color: 0xeceef0,
      metalness: 1,
      roughness: 0.06,
      clearcoat: 1,
      clearcoatRoughness: 0.03
    }),
    bolt: new THREE.MeshPhysicalMaterial({ name: 'rim_bolt', color: 0xb9bdc3, metalness: 1, roughness: 0.22 }),
    lugNut: new THREE.MeshPhysicalMaterial({ name: 'lug_nut', side: THREE.DoubleSide, color: 0x9da2a8, metalness: 1, roughness: 0.18 }),
    cap: new THREE.MeshPhysicalMaterial({
      name: 'centre_cap', side: THREE.DoubleSide,
      map: capTexture(),
      metalness: 0.35,
      roughness: 0.28,
      clearcoat: 1,
      clearcoatRoughness: 0.05
    }),
    // Cast iron friction ring with concentric machining: anisotropic reflections follow the grooves
    discFace: new THREE.MeshPhysicalMaterial({
      name: 'brake_disc',
      color: 0xa19f9b,
      map: disc.color,
      metalness: 1,
      roughness: 0.38,
      normalMap: disc.normal,
      normalScale: new THREE.Vector2(0.35, 0.35),
      anisotropy: 0.8,
      anisotropyMap: disc.aniso,
      envMapIntensity: 0.75
    }),
    discEdge: new THREE.MeshStandardMaterial({ name: 'brake_disc_edge', color: 0x4b4846, metalness: 0.8, roughness: 0.75, envMapIntensity: 0.5 }),
    hat: new THREE.MeshPhysicalMaterial({
      name: 'brake_hat', side: THREE.DoubleSide,
      color: 0x26282b,
      metalness: 0.55,
      roughness: 0.34,
      clearcoat: 0.4,
      clearcoatRoughness: 0.2,
      envMapIntensity: 0.7
    }),
    // Gloss caliper paint under clear coat
    caliper: new THREE.MeshPhysicalMaterial({
      name: 'caliper_paint',
      color: 0x1d4f9c,
      metalness: 0,
      roughness: 0.36,
      clearcoat: 1,
      clearcoatRoughness: 0.03,
      envMapIntensity: 0.8
    }),
    pad: new THREE.MeshStandardMaterial({ name: 'brake_pad', color: 0x1b1b1c, metalness: 0.2, roughness: 0.85 })
  };
  installWheelShading(kit.tread, { arch: 0.62, flatten: true });
  installWheelShading(kit.sidewall, { arch: 0.62, flatten: true });
  installWheelShading(kit.discFace, { arch: 0.45 });
  installWheelShading(kit.discEdge, { arch: 0.45 });
  installWheelShading(kit.hat, { arch: 0.45 });
  installWheelShading(kit.caliper, { arch: 0.4 });
  installWheelShading(kit.pad, { arch: 0.45 });
  return kit;
}

// ---------------------------------------------------------------------------
// Tyre
// ---------------------------------------------------------------------------

export function tyreSizeLabel(d: WheelDims): string {
  const inches = Math.round(20 * d.rimScale);
  const width = Math.round((d.tyreWidth * 1000) / 5) * 5 + (d.isFront ? 0 : 0);
  const sidewall = d.tyreRadius - 0.254 * d.rimScale; // metres
  const aspect = Math.round(((sidewall * 1000) / width) * 20) * 5;
  return `${width}/${aspect} ZR${inches} ${d.isFront ? '98' : '102'}Y XL`;
}

/**
 * Tyre as three lathes (tread, outer and inner sidewall) sharing their edge rings, so the tread
 * and the sidewall lettering each get their own UV space.
 */
export function buildTyre(d: WheelDims, mats: WheelKitMaterials): THREE.Group {
  const L = rimLayout(d);
  const R = d.tyreRadius;
  const half = d.tyreWidth / 2;
  const shoulderR = 0.024; // shoulder rounding radius
  const crown = 0.004;
  const segs = 192;

  // --- tread: inner shoulder -> crown with grooves -> outer shoulder
  const tread: [number, number][] = [];
  const treadHalf = half - 0.006; // tread edge before the shoulder curve
  const crownR = (x: number) => R - crown * (x / treadHalf) ** 2;
  // inner shoulder: quarter circle from the sidewall-facing edge up onto the tread
  const sCenterX = -(treadHalf - shoulderR), sCenterR = R - shoulderR - crown * 0.8;
  for (let i = 0; i <= 8; i++) {
    const t = (i / 8) * (Math.PI / 2);
    tread.push([sCenterR + Math.sin(t) * shoulderR, sCenterX - Math.cos(t) * shoulderR]);
  }
  const grooves = [-0.62, -0.22, 0.22, 0.62].map((f) => f * (treadHalf - shoulderR)); // groove centres
  const gw = d.tyreWidth * 0.04, gd = 0.0075;
  const xs: number[] = [];
  for (let k = 0; k <= 40; k++) xs.push(sCenterX + ((-sCenterX * 2) * k) / 40);
  const inGroove = (x: number) => grooves.find((g) => Math.abs(x - g) < gw / 2 + 0.0015);
  let lastX = sCenterX;
  for (const g of grooves) {
    // flat crown up to the groove, then the groove walls (slightly chamfered) and bottom
    for (const x of xs) if (x > lastX + 1e-6 && x < g - gw / 2 - 0.0015 && !inGroove(x)) tread.push([crownR(x), x]);
    const e0 = g - gw / 2, e1 = g + gw / 2;
    tread.push([crownR(e0 - 0.0015), e0 - 0.0015]);
    tread.push([crownR(e0) - 0.0012, e0]);
    tread.push([crownR(e0) - gd, e0 + 0.0012]);
    tread.push([crownR(e1) - gd, e1 - 0.0012]);
    tread.push([crownR(e1) - 0.0012, e1]);
    tread.push([crownR(e1 + 0.0015), e1 + 0.0015]);
    lastX = e1 + 0.0015;
  }
  for (const x of xs) if (x > lastX + 1e-6 && x < -sCenterX - 1e-6) tread.push([crownR(x), x]);
  for (let i = 0; i <= 8; i++) {
    const t = (Math.PI / 2) * (1 - i / 8);
    tread.push([sCenterR + Math.sin(t) * shoulderR, -sCenterX + Math.cos(t) * shoulderR]);
  }
  const treadGeo = lathe(tread, segs);

  // --- sidewalls: from the shoulder edge down to the bead, bulging out, with a rim-protector rib
  const sidewall = (sign: 1 | -1) => {
    const startR = sCenterR, startX = sign * treadHalf; // the shoulder's last ring
    const bulgeR = L.beadSeat + (R - L.beadSeat) * 0.52;
    const ribR = L.lipOuter + 0.007;
    const flangeX = sign === 1 ? L.lipX : L.rimWidth / 2 + 0.003;
    const pts: [number, number][] = [[startR, startX]];
    // shoulder -> widest point of the sidewall
    pts.push(...cubic([startR, startX], [startR - 0.012, sign * (half + 0.0005)], [bulgeR + 0.02, sign * half], [bulgeR, sign * half], 10));
    // widest point -> rim protector rib (stands a little proud of the lip)
    pts.push(...cubic([bulgeR, sign * half], [bulgeR - 0.02, sign * half], [ribR + 0.012, sign * (half - 0.004)], [ribR + 0.004, sign * (half - 0.002)], 8));
    pts.push([ribR, sign * (half - 0.0015)]);
    pts.push([ribR - 0.004, sign * (half - 0.004)]);
    // tuck behind the rim flange
    pts.push(...cubic([ribR - 0.004, sign * (half - 0.004)], [ribR - 0.007, sign * (half - 0.008)], [L.lipOuter + 0.001, sign * (flangeX - 0.002)], [L.lipOuter - 0.003, sign * (flangeX - 0.006)], 6));
    // v runs from the bead (0) to the shoulder (1)
    return lathe(pts.slice().reverse(), segs);
  };
  const outerGeo = sidewall(1); // v = 0 at the bead, 1 at the shoulder
  const innerGeo = sidewall(-1);

  const label = tyreSizeLabel(d);
  const maps = sidewallMaps(label);
  const sideMat = mats.sidewall.clone();
  sideMat.normalMap = maps.normal;
  sideMat.normalScale = new THREE.Vector2(1, 1);
  sideMat.roughnessMap = maps.rough;
  maps.normal.repeat.set(2, 1);
  maps.rough.repeat.set(2, 1);
  const innerMat = mats.sidewall.clone();
  innerMat.roughness = 0.72;
  innerMat.envMapIntensity = 0.45; // faces the car: in the wheel arch's shadow
  installWheelShading(sideMat, { arch: 0.62, flatten: true });
  installWheelShading(innerMat, { arch: 0.62, flatten: true });

  const g = new THREE.Group();
  g.name = 'tyre';
  const treadMesh = new THREE.Mesh(treadGeo, mats.tread);
  const outer = new THREE.Mesh(outerGeo, sideMat);
  const inner = new THREE.Mesh(innerGeo, innerMat);
  g.add(treadMesh, outer, inner);
  g.userData.dispose = () => {
    treadGeo.dispose();
    outerGeo.dispose();
    innerGeo.dispose();
    sideMat.dispose();
    innerMat.dispose();
  };
  return g;
}

// ---------------------------------------------------------------------------
// Rim shell (lip + barrel)
// ---------------------------------------------------------------------------

export type LipStyle = 'mono' | 'two' | 'three';

export function lipStyleFor(style: string | undefined, name?: string): LipStyle {
  const s = `${style ?? ''} ${name ?? ''}`;
  if (/three[- ]?piece|\b3p\b/i.test(s)) return 'three';
  if (/two[- ]?piece|\b2p\b/i.test(s)) return 'two';
  return 'mono';
}

/**
 * The rim's lip and barrel as a lathe of a real cross-section. Returns the outer lip (finish or
 * polished) and the barrel (finish, a little darker inside) as separate meshes so they can take
 * different materials, plus the lip bolts of multi-piece rims.
 */
export function buildRimShell(d: WheelDims, lip: LipStyle, finish: THREE.Material, barrel: THREE.Material, mats: WheelKitMaterials) {
  const L = rimLayout(d);
  const lo = L.lipOuter, li = L.faceRadius, x0 = L.lipX;
  const er = 0.0035; // edge rounding
  const multi = lip !== 'mono';
  // Lip, from under the tyre bead: outer edge (rounded) -> front face -> inner edge (rounded) ->
  // inner wall. Multi-piece rims have a polished outer lip with a ledge for the assembly bolts.
  const lipProfile: [number, number][] = [
    [lo - 0.006, x0 - 0.02],
    [lo - 0.001, x0 - 0.012],
    [lo, x0 - er],
    ...arcPts(lo - er, x0 - er, er, Math.PI / 2, 0, 5),
    [li + er + 0.004, x0],
    ...arcPts(li + er, x0 - er, er, 0, -Math.PI / 2, 5)
  ];
  const ledgeX = x0 - 0.007;
  const ledgeR = li - 0.008;
  if (multi) lipProfile.push([li, ledgeX + 0.001], [li - 0.0008, ledgeX], [ledgeR, ledgeX], [ledgeR, x0 - 0.03]);
  else lipProfile.push([li, x0 - 0.028]);
  const lipGeo = lathe(lipProfile, 160);

  // Barrel inner surface, seen through the spokes: face ring -> drop centre -> inner bead seat.
  // The drop centre stays clear of the caliper (r >= 0.233 m at 20").
  const rb = L.beadSeat;
  const inX = -L.rimWidth / 2;
  const start = lipProfile[lipProfile.length - 1];
  const well = rb - 0.02;
  const barrelProfile: [number, number][] = [
    start,
    [rb - 0.012, x0 - 0.05],
    [rb - 0.012, x0 - 0.08],
    ...cubic([rb - 0.012, x0 - 0.08], [rb - 0.012, x0 - 0.095], [well, x0 - 0.092], [well, x0 - 0.108], 6),
    [well, inX + 0.055],
    ...cubic([well, inX + 0.055], [well, inX + 0.04], [rb - 0.01, inX + 0.042], [rb - 0.01, inX + 0.028], 6),
    [rb - 0.01, inX + 0.008],
    [rb + 0.006, inX],
    [rb + 0.008, inX - 0.004]
  ];
  const barrelGeo = lathe(barrelProfile, 160);

  barrelGeo.userData.aoProfile = true; // v = 0 at the face, 1 at the inner bead: see barrelAoMap()
  const lipMesh = new THREE.Mesh(lipGeo, multi ? mats.lipPolished : finish);
  lipMesh.name = 'rim_lip';
  const barrelMesh = new THREE.Mesh(barrelGeo, barrel);
  barrelMesh.name = 'rim_barrel';

  let bolts: THREE.InstancedMesh | null = null;
  if (multi) {
    const count = lip === 'three' ? 40 : 30;
    const head = mergeGeometries([
      new THREE.CylinderGeometry(0.0034, 0.0036, 0.0024, 6).rotateZ(-Math.PI / 2).translate(0.0012, 0, 0),
      new THREE.SphereGeometry(0.0027, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2).rotateZ(-Math.PI / 2).translate(0.0024, 0, 0)
    ].map((g) => (g.index ? g.toNonIndexed() : g)))!;
    bolts = new THREE.InstancedMesh(head, mats.bolt, count);
    const m = new THREE.Matrix4();
    const br = (li - 0.0008 + ledgeR) / 2;
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2;
      m.makeTranslation(ledgeX, Math.cos(a) * br, Math.sin(a) * br);
      bolts.setMatrixAt(i, m);
    }
    bolts.name = 'rim_lip_bolts';
  }
  return { lipMesh, barrelMesh, bolts };
}

// ---------------------------------------------------------------------------
// Spoke face from a rim photo
// ---------------------------------------------------------------------------

export interface RimFaceMask {
  /** Mask on a disc: 1 = solid. Size n x n; the face (spokes end) is at radius n/2 * FACE_FRACTION. */
  data: Float32Array;
  size: number;
  symmetry: number; // fold applied (1 = none)
  /**
   * How the photo's outer ring was read: `barrel` = spoke arms traced across a barrel seen
   * between them, `flange` = a solid face ring out to the lip, `stretch` = fallback (the
   * see-through spokes stretched to the lip).
   */
  mode: 'barrel' | 'flange' | 'stretch';
}

/** Where the spokes meet the lip, as a fraction of the rim's outer radius (3D: 240 / 262 mm). */
const LIP_FRACTION = 0.916;

export const FACE_FRACTION = 0.94; // face radius inside the mask square (the rest is the overlap band)
const OVERLAP = 1.035; // face outline extends this far past the spoke ends, into the lip wall
const HUB = 0.3; // solid hub pad radius (of the face radius)

export interface RimPhotoOptions {
  /** Resolution the photo is read at (capped at the photo's own size). Default 1536. */
  res?: number;
  /** Quantile taken across the symmetric sectors. Default 0.5 (median); lower values thin the
   *  spokes and let partly covered windows through, which tested worse. */
  quantile?: number;
  /** Smoothing along the radius in output pixels, applied before the mask is drawn. Default 8. */
  radialSigma?: number;
}

/**
 * Cleans a front-on rim photo into a spoke mask the 3D face is built from:
 *
 * 1. measures where the spoke windows end: the photo's outer ring (lip and the barrel wall seen
 *    in perspective) is cut away and the spokes are stretched out to meet the 3D lip;
 * 2. detects the design's rotational symmetry and takes the median of the photo over it, which
 *    removes perspective, reflections and cut-out noise (skipped when the photo isn't symmetric
 *    enough, e.g. shot at an angle);
 * 3. smooths the result along the radius, so the small steps a cut-out leaves along each spoke
 *    edge become straight runs (the outline is smoothed again when traced);
 * 4. replaces the centre with a solid hub pad (lug nuts and centre cap are 3D parts).
 */
export function processRimPhoto(image: CanvasImageSource & { width: number; height: number }, out = 1024, opts: RimPhotoOptions = {}): RimFaceMask | null {
  const RES = Math.round(Math.min(opts.res ?? 1536, Math.max(256, image.width, image.height)));
  const q = opts.quantile ?? 0.5;
  const radialSigma = opts.radialSigma ?? 8;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = RES;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(image, 0, 0, RES, RES);
  const px = ctx.getImageData(0, 0, RES, RES).data; // throws on a tainted image
  const a = new Float32Array(RES * RES);
  const lum = new Float32Array(RES * RES);
  for (let i = 0; i < RES * RES; i++) {
    a[i] = px[i * 4 + 3] / 255;
    lum[i] = (0.2126 * px[i * 4] + 0.7152 * px[i * 4 + 1] + 0.0722 * px[i * 4 + 2]) / 255;
  }
  const c = (RES - 1) / 2;

  const sample = (x: number, y: number) => {
    if (x < 0 || y < 0 || x > RES - 1.001 || y > RES - 1.001) return 0;
    const x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0;
    const i = y0 * RES + x0;
    return a[i] * (1 - fx) * (1 - fy) + a[i + 1] * fx * (1 - fy) + a[i + RES] * (1 - fx) * fy + a[i + RES + 1] * fx * fy;
  };

  // radial coverage (fraction solid per ring)
  const BINS = 200;
  const ringSolid = new Float32Array(BINS), ringAll = new Float32Array(BINS);
  for (let y = 0; y < RES; y++) {
    for (let x = 0; x < RES; x++) {
      const r = Math.sqrt((x - c) * (x - c) + (y - c) * (y - c)) / (RES / 2); // (hypot is slow)
      if (r >= 1) continue;
      const b = Math.floor(r * BINS);
      ringAll[b]++;
      if (a[y * RES + x] > 0.5) ringSolid[b]++;
    }
  }
  const cov = (r: number) => {
    const b = Math.min(BINS - 1, Math.floor(r * BINS));
    return ringAll[b] ? ringSolid[b] / ringAll[b] : 0;
  };
  let rOut = 0.5;
  for (let b = BINS - 1; b > 0; b--) if (cov(b / BINS) > 0.5) { rOut = (b + 1) / BINS; break; }
  let rEnd = 0.9 * rOut;
  let seenOpen = false;
  for (let b = Math.floor(0.4 * rOut * BINS); b < BINS; b++) {
    const r = b / BINS;
    if (cov(r) < 0.8) seenOpen = true;
    if (seenOpen && cov(r) >= 0.9 && cov(r + 1 / BINS) >= 0.9) { rEnd = r; break; }
  }
  // no window region at all: not a usable cut-out
  if (!seenOpen) return null;

  // rotational symmetry
  const ANG = 1440;
  const profile = (rr: number) => {
    const p = new Float32Array(ANG);
    for (let k = 0; k < ANG; k++) {
      const t = (k / ANG) * Math.PI * 2;
      p[k] = sample(c + Math.cos(t) * rr * (RES / 2), c + Math.sin(t) * rr * (RES / 2));
    }
    return p;
  };
  const profiles = [0.55, 0.65, 0.75, 0.85].map((f) => profile(f * rEnd));
  const corr = (p: Float32Array, shift: number) => {
    let ma = 0, mb = 0;
    for (let k = 0; k < ANG; k++) { ma += p[k]; mb += p[(k + shift) % ANG]; }
    ma /= ANG; mb /= ANG;
    let num = 0, da = 0, db = 0;
    for (let k = 0; k < ANG; k++) {
      const x = p[k] - ma, y = p[(k + shift) % ANG] - mb;
      num += x * y; da += x * x; db += y * y;
    }
    return da && db ? num / Math.sqrt(da * db) : 0;
  };
  const scores = new Map<number, number>();
  for (let n = 3; n <= 24; n++) {
    const shift = Math.round(ANG / n);
    scores.set(n, profiles.reduce((s, p) => s + corr(p, shift), 0) / profiles.length);
  }
  const best = Math.max(...scores.values());
  let fold = 1;
  if (best >= 0.4) {
    for (const [n, v] of scores) if (v >= 0.85 * best && n > fold) fold = n;
  }

  // Spokes over the barrel: in most photos the barrel (and its bolts, rings and lettering) is
  // seen solid behind the outer half of the spokes, so the see-through windows end well inside
  // the lip. Trace the spoke arms across it to the lip and map the photo 1:1 onto the 3D face;
  // if that fails, fall back to stretching the see-through spokes out to the lip.
  const arms = traceFaceArms(a, lum, RES, fold, rOut);
  const mode: RimFaceMask['mode'] = arms ? arms.mode : 'stretch';
  const rFace = arms ? arms.rLip : rEnd; // photo radius (of RES / 2) that becomes rho = 1
  const value = (rr: number, t: number) => (arms ? arms.value(rr, t) : sample(c + Math.cos(t) * rr * (RES / 2), c + Math.sin(t) * rr * (RES / 2)));

  // One sector in polar form (rows: rho 0..1, columns: angle within the sector), about one
  // output pixel per cell. Each cell is a quantile across the symmetric sectors: a spoke is solid
  // in (nearly) all of them, while the barrel wall, a reflection or a side wall seen in
  // perspective shows in only some and is rejected.
  const faceR = (out / 2) * FACE_FRACTION;
  const sector = (Math.PI * 2) / fold;
  const NR = Math.ceil(faceR) + 1;
  const NA = Math.max(8, Math.ceil(faceR * sector));
  const polar = new Float32Array(NR * NA);
  const sectors = new Float32Array(fold);
  for (let i = 0; i < NR; i++) {
    const rr = (i / (NR - 1)) * rFace;
    for (let j = 0; j < NA; j++) {
      const t0 = (j / NA) * sector;
      for (let k = 0; k < fold; k++) sectors[k] = value(rr, t0 + k * sector);
      polar[i * NA + j] = fold === 1 ? sectors[0] : quantile(sectors, fold, q);
    }
  }
  // Smoothing along the radius turns the small steps a cut-out leaves along a spoke edge into
  // straight runs, without softening the edge itself. Traced arms are smooth already and often
  // slanted, so the smoothing fades out before they start.
  if (radialSigma > 0) {
    const stop = arms ? arms.rStart / rFace : Infinity;
    gaussianColumns(polar, NR, NA, (i) => radialSigma * THREE.MathUtils.clamp((stop - i / (NR - 1)) / 0.05, 0, 1));
  }

  // output mask: rho = 1 at the spoke ends
  const data = new Float32Array(out * out);
  const oc = (out - 1) / 2;
  for (let y = 0; y < out; y++) {
    for (let x = 0; x < out; x++) {
      const dx = x - oc, dy = y - oc;
      const rho = Math.sqrt(dx * dx + dy * dy) / faceR;
      let v = 0;
      if (rho > OVERLAP) v = 0;
      else if (rho > 1 || rho < HUB) v = 1;
      else {
        let t = Math.atan2(dy, dx) % sector;
        if (t < 0) t += sector;
        const fi = rho * (NR - 1);
        const fj = (t / sector) * NA;
        const i0 = Math.min(NR - 2, Math.floor(fi));
        const j0 = Math.floor(fj) % NA;
        const j1 = (j0 + 1) % NA;
        const fy = fi - i0, fx = fj - Math.floor(fj);
        v =
          (polar[i0 * NA + j0] * (1 - fx) + polar[i0 * NA + j1] * fx) * (1 - fy) +
          (polar[(i0 + 1) * NA + j0] * (1 - fx) + polar[(i0 + 1) * NA + j1] * fx) * fy;
        // blend the hub pad edge into the spoke roots
        v = Math.max(v, 1 - smoothstep(HUB, HUB + 0.04, rho));
      }
      data[y * out + x] = v;
    }
  }
  // Soften the cut-out edges (Gaussian-like, about 2 px) so the traced outline follows the
  // spoke's real edge instead of every pixel step and speck of the photo's alpha.
  blur(data, out, out, 4, false);
  return { data, size: out, symmetry: fold, mode };
}

/** Quantile q (0..1) of the first n values (sorts them in place; n is small). */
function quantile(v: Float32Array, n: number, q: number) {
  for (let i = 1; i < n; i++) {
    const x = v[i];
    let j = i - 1;
    while (j >= 0 && v[j] > x) { v[j + 1] = v[j]; j--; }
    v[j + 1] = x;
  }
  const p = q * (n - 1);
  const i = Math.floor(p);
  return i + 1 < n ? v[i] + (v[i + 1] - v[i]) * (p - i) : v[i];
}

interface FaceArms {
  mode: 'barrel' | 'flange';
  /** Photo radius (fraction of the half-width) where the spokes meet the lip: rho = 1. */
  rLip: number;
  /** Smallest radius at which traced arms take over from the cut-out. */
  rStart: number;
  /** Face value 0..1 at photo radius rr (fraction of the half-width) and angle t. */
  value: (rr: number, t: number) => number;
}

/**
 * Spoke arms across the barrel band of a front-on rim photo.
 *
 * Inside the see-through zone the cut-out is the face. Further out, most photos show the barrel
 * (its rings, bolts and lettering) solid behind the outer half of the spokes. Treating that as
 * solid face loses the arms; stretching the see-through part to the lip distorts every design.
 * This follows each arm across the band instead:
 *
 * 1. Where each column's main window ends (later specks ignored), smoothed and bounded by a
 *    robust off-centre fit: photos are rarely centred on the barrel.
 * 2. Arm cross-sections a little inside that boundary, where the cut-out is clean.
 * 3. Each arm edge: a straight line in the image plane fitted to its cut-out edge, then an
 *    optimal smooth path (dynamic programming) through the brightness edges around that line,
 *    out to the lip at LIP_FRACTION of the rim radius.
 * 4. If most arms show real edges along their path, the band is barrel and only the arms are
 *    solid; otherwise it is a solid face ring (a flange) out to the lip.
 *
 * Returns null when the photo can't be read this way (the caller then stretches as before).
 */
function traceFaceArms(a: Float32Array, lum: Float32Array, RES: number, fold: number, rOut: number): FaceArms | null {
  const NRp = 768, NT = 4096;
  const c = (RES - 1) / 2, half = RES / 2;
  const rowR = (i: number) => i / (NRp - 1);
  const wrap = (j: number) => ((j % NT) + NT) % NT;
  const iOut = Math.min(NRp - 1, Math.round(rOut * (NRp - 1)));
  const ia = Math.max(1, Math.floor(0.4 * iOut)), ib = Math.floor(0.95 * iOut);
  const iLip = Math.round(LIP_FRACTION * rowR(iOut) * (NRp - 1));
  if (iLip <= ia + 20) return null;
  const rows = iOut - ia + 1;
  const cosT = new Float32Array(NT), sinT = new Float32Array(NT);
  for (let j = 0; j < NT; j++) {
    const t = (j / NT) * Math.PI * 2;
    cosT[j] = Math.cos(t);
    sinT[j] = Math.sin(t);
  }
  const bil = (img: Float32Array, x: number, y: number) => {
    x = Math.min(Math.max(x, 0), RES - 1.001);
    y = Math.min(Math.max(y, 0), RES - 1.001);
    const x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0, k = y0 * RES + x0;
    return img[k] * (1 - fx) * (1 - fy) + img[k + 1] * fx * (1 - fy) + img[k + RES] * (1 - fx) * fy + img[k + RES + 1] * fx * fy;
  };

  // polar alpha (0..255) and luminance edges (between two solid samples only, so the cut-out's
  // own boundary never counts as a spoke edge), smoothed +-3 rows along the radius
  const A = new Uint8Array(rows * NT);
  const E = new Float32Array(rows * NT);
  {
    const Lp = new Float32Array(rows * NT);
    for (let i = 0; i < rows; i++) {
      const rr = rowR(ia + i) * half;
      for (let j = 0; j < NT; j++) {
        const x = c + cosT[j] * rr, y = c + sinT[j] * rr;
        A[i * NT + j] = Math.round(bil(a, x, y) * 255);
        Lp[i * NT + j] = bil(lum, x, y);
      }
    }
    for (let i = 0; i < rows; i++) {
      const o = i * NT;
      for (let j = 0; j < NT; j++) {
        const jl = j === 0 ? NT - 1 : j - 1, jr = j === NT - 1 ? 0 : j + 1;
        if (A[o + jl] > 127 && A[o + jr] > 127) E[o + j] = Math.abs(Lp[o + jr] - Lp[o + jl]) / 2;
      }
    }
    const col = new Float32Array(rows);
    for (let j = 0; j < NT; j++) {
      for (let i = 0; i < rows; i++) col[i] = E[i * NT + j];
      for (let i = 0; i < rows; i++) {
        let sum = 0, n = 0;
        for (let d = -3; d <= 3; d++) {
          const k = i + d;
          if (k >= 0 && k < rows) { sum += col[k]; n++; }
        }
        E[i * NT + j] = sum / n;
      }
    }
  }
  const solid = (i: number, j: number) => A[(i - ia) * NT + wrap(j)] > 127;
  const noise = new Float32Array(rows);
  {
    const tmp = new Float32Array(NT >> 2);
    for (let i = 0; i < rows; i++) {
      for (let k = 0; k < tmp.length; k++) tmp[k] = E[i * NT + k * 4];
      tmp.sort();
      noise[i] = tmp[tmp.length >> 1];
    }
  }
  const ealp = (i: number, j: number) => Math.abs(A[(i - ia) * NT + wrap(j + 1)] - A[(i - ia) * NT + wrap(j - 1)]) / 510;
  const ecomb = (i: number, j: number) =>
    Math.max(Math.min(E[(i - ia) * NT + wrap(j)] / (4 * noise[i - ia] + 0.004), 3), Math.min(ealp(i, j) * 10, 3));

  // 1. where each column's main window ends
  const len = ib - ia;
  const W = new Float64Array(NT).fill(NaN);
  for (let j = 0; j < NT; j++) {
    let k = 0;
    while (k < len && solid(ia + k, j)) k++;
    if (k >= len) continue;
    while (k < len) {
      if (!solid(ia + k, j)) { k++; continue; }
      let run = 0;
      while (run < 20 && k + run < len && solid(ia + k + run, j)) run++;
      if (run === 20) break;
      k++;
    }
    W[j] = ia + k;
  }
  const okIdx: number[] = [];
  for (let j = 0; j < NT; j++) if (!Number.isNaN(W[j])) okIdx.push(j);
  if (okIdx.length < 16) return null;
  // robust off-centre fit: W(t) = c0 + c1 cos t + c2 sin t + c3 cos 2t + c4 sin 2t
  const B = new Float64Array(NT * 5);
  for (let j = 0; j < NT; j++) {
    const t = (j / NT) * Math.PI * 2;
    B.set([1, Math.cos(t), Math.sin(t), Math.cos(2 * t), Math.sin(2 * t)], j * 5);
  }
  let coef = [0, 0, 0, 0, 0];
  const Wfit = (j: number) => {
    let sum = 0;
    for (let p = 0; p < 5; p++) sum += B[j * 5 + p] * coef[p];
    return sum;
  };
  const use = new Uint8Array(okIdx.length).fill(1);
  const res = new Float64Array(okIdx.length);
  for (let it = 0; it < 6; it++) {
    const M5 = Array.from({ length: 5 }, () => new Float64Array(5));
    const v5 = new Float64Array(5);
    for (let n = 0; n < okIdx.length; n++) {
      if (!use[n]) continue;
      const j = okIdx[n];
      for (let p = 0; p < 5; p++) {
        v5[p] += B[j * 5 + p] * W[j];
        for (let q2 = 0; q2 < 5; q2++) M5[p][q2] += B[j * 5 + p] * B[j * 5 + q2];
      }
    }
    const sol = solveSmall(M5, v5);
    if (!sol) break;
    coef = sol;
    const used: number[] = [];
    for (let n = 0; n < okIdx.length; n++) {
      res[n] = Math.abs(W[okIdx[n]] - Wfit(okIdx[n]));
      if (use[n]) used.push(res[n]);
    }
    used.sort((x, y) => x - y);
    const lim = 2.5 * ((used[used.length >> 1] ?? 0) + 1e-6) * 1.4826 + 2;
    let kept = 0;
    for (let n = 0; n < okIdx.length; n++) kept += use[n] = res[n] < lim ? 1 : 0;
    if (kept < 8) break;
  }
  // measured ends, median over +-8 columns, arm columns interpolated between their windows
  const Wm = new Map<number, number>();
  for (const j of okIdx) {
    const nb: number[] = [];
    for (let d = -8; d <= 8; d++) {
      const v = W[wrap(j + d)];
      if (!Number.isNaN(v)) nb.push(v);
    }
    nb.sort((x, y) => x - y);
    Wm.set(j, nb[nb.length >> 1]);
  }
  const Ws = new Float64Array(NT);
  for (let n = 0; n < okIdx.length; n++) {
    const p = okIdx[n], q2 = okIdx[(n + 1) % okIdx.length];
    const span = wrap(q2 - p) || NT;
    const vp = Wm.get(p)!, vq = Wm.get(q2)!;
    for (let d = 0; d < span; d++) Ws[wrap(p + d)] = vp + ((vq - vp) * d) / span;
  }
  const rc = new Int32Array(NT), rcw = new Int32Array(NT);
  const up = Math.floor(0.04 * NRp);
  for (let j = 0; j < NT; j++) {
    const fit = Wfit(j);
    const w = Math.abs(Ws[j] - fit) > 0.06 * NRp ? fit : Ws[j];
    rc[j] = Math.min(ib, Math.max(ia, Math.round(w - 10)));
    rcw[j] = Math.min(ib, Math.max(ia, rc[j] - up));
  }

  // 2. arm cross-sections just inside the barrel edge
  let start = -1;
  for (let j = 0; j < NT; j++) if (!solid(rcw[j], j)) { start = j; break; }
  if (start < 0) return null;
  const spans: [number, number][] = [];
  for (let n = 0; n < NT; ) {
    const j = start + n;
    if (solid(rcw[wrap(j)], j)) {
      let m = n;
      while (m < NT && solid(rcw[wrap(start + m)], start + m)) m++;
      spans.push([j, start + m - 1]);
      n = m;
    } else n++;
  }

  // 3. each arm edge: image-plane line from the cut-out edge, then an optimal smooth path
  const peak = (vals: number[]) => {
    let k = 0;
    for (let n = 1; n < vals.length; n++) if (vals[n] > vals[k]) k = n;
    let off = 0;
    if (k > 0 && k < vals.length - 1) {
      const den = vals[k - 1] - 2 * vals[k] + vals[k + 1];
      if (den !== 0) off = (0.5 * (vals[k - 1] - vals[k + 1])) / den;
    }
    return { k: k + off, v: vals[k] };
  };
  const fitEdge = (j0: number, iS: number) => {
    let th = j0;
    const P: [number, number][] = [];
    const stop = Math.max(iS - Math.floor(0.07 * NRp), ia);
    for (let i = iS; i > stop; i--) {
      const r0 = Math.round(th);
      const vals = [-2, -1, 0, 1, 2].map((d) => ealp(i, r0 + d));
      const pk = peak(vals);
      if (pk.v < 0.05) break;
      th = r0 - 2 + pk.k;
      const ang = (th / NT) * Math.PI * 2, rr = rowR(i);
      P.push([rr * Math.cos(ang), rr * Math.sin(ang)]);
    }
    if (P.length < 8) {
      const ang = (j0 / NT) * Math.PI * 2, rr = rowR(iS);
      return { p0: [rr * Math.cos(ang), rr * Math.sin(ang)] as [number, number], d: [Math.cos(ang), Math.sin(ang)] as [number, number] };
    }
    let mx = 0, my = 0;
    for (const [x, y] of P) { mx += x; my += y; }
    mx /= P.length; my /= P.length;
    let sxx = 0, sxy = 0, syy = 0;
    for (const [x, y] of P) { sxx += (x - mx) ** 2; sxy += (x - mx) * (y - my); syy += (y - my) ** 2; }
    const phi = 0.5 * Math.atan2(2 * sxy, sxx - syy);
    let d: [number, number] = [Math.cos(phi), Math.sin(phi)];
    if (d[0] * mx + d[1] * my < 0) d = [-d[0], -d[1]];
    return { p0: P[0], d };
  };
  const lineCol = (p0: [number, number], d: [number, number], rr: number) => {
    const bq = 2 * (p0[0] * d[0] + p0[1] * d[1]);
    const cq = p0[0] * p0[0] + p0[1] * p0[1] - rr * rr;
    const disc = bq * bq - 4 * cq;
    if (disc < 0) return null;
    const sl = (-bq + Math.sqrt(disc)) / 2;
    const x = p0[0] + sl * d[0], y = p0[1] + sl * d[1];
    return (((Math.atan2(y, x) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)) / (Math.PI * 2) * NT;
  };
  const WD = 24, NO = 2 * WD + 1, LAM = 0.35, MU = 0.004, MU_IN = 0.03;
  // side: -1 for an arm's left edge (the arm lies at larger columns), +1 for its right edge
  const trackEdge = (e: { p0: [number, number]; d: [number, number] }, iS: number, side: number) => {
    const n = iLip - iS;
    const th0 = wrap((Math.atan2(e.p0[1], e.p0[0]) / (Math.PI * 2)) * NT);
    const path = new Float64Array(n + 1);
    path[0] = th0;
    if (n < 4) return { path, ev: 0 };
    const prior = new Float64Array(n);
    let last = th0;
    for (let s2 = 0; s2 < n; s2++) {
      let t = lineCol(e.p0, e.d, rowR(iS + 1 + s2));
      if (t === null) t = last;
      t = last + (wrap(t - last + NT / 2) - NT / 2);
      prior[s2] = t;
      last = t;
    }
    let score = new Float64Array(NO).fill(-1e9);
    score[WD] = 0;
    const back = new Int8Array(n * NO);
    const evid = new Float32Array(n * NO);
    const next = new Float64Array(NO);
    for (let s2 = 0; s2 < n; s2++) {
      const i = iS + 1 + s2;
      for (let o = 0; o < NO; o++) {
        const sc = ecomb(i, Math.round(prior[s2] + o - WD));
        evid[s2 * NO + o] = sc;
        let best = -1e18, arg = 0;
        for (let dlt = -1; dlt <= 1; dlt++) {
          const from = o - dlt;
          if (from < 0 || from >= NO) continue;
          const cand = score[from] - LAM * Math.abs(dlt);
          if (cand > best) { best = cand; arg = dlt; }
        }
        // keep the outer silhouette (as in the cut-out) rather than an inner chamfer line
        const inward = side < 0 ? o - WD : WD - o;
        next[o] = best + sc - MU * Math.abs(o - WD) - MU_IN * Math.max(0, inward);
        back[s2 * NO + o] = arg;
      }
      score = Float64Array.from(next);
    }
    let k = 0;
    for (let o = 1; o < NO; o++) if (score[o] > score[k]) k = o;
    let good = 0;
    for (let s2 = n - 1; s2 >= 0; s2--) {
      path[s2 + 1] = prior[s2] + k - WD;
      if (evid[s2 * NO + k] >= 1) good++;
      k -= back[s2 * NO + k];
    }
    // the path moves at most a column per row; smoothing it (sigma 6 rows) leaves a clean edge
    const sm = new Float64Array(n + 1);
    for (let i = 0; i <= n; i++) {
      let sum = 0, sw = 0;
      for (let d = -18; d <= 18; d++) {
        const k2 = i + d;
        if (k2 < 0 || k2 > n) continue;
        const w = Math.exp(-(d * d) / 72);
        sum += path[k2] * w;
        sw += w;
      }
      sm[i] = sum / sw;
    }
    sm[0] = path[0];
    return { path: sm, ev: good / n };
  };
  const sectorCols = NT / fold;
  const arms: { iS: number; L: Float64Array; R: Float64Array; ev: number }[] = [];
  for (const [sa, sb] of spans) {
    if (sb - sa > 0.6 * sectorCols || sb - sa < 12) continue; // narrower than ~3 mm: a sliver, not an arm
    const iS = Math.min(rcw[wrap(sa)], rcw[wrap(sb)]);
    const tL = trackEdge(fitEdge(sa - 0.5, iS), iS, -1);
    const tR = trackEdge(fitEdge(sb + 0.5, iS), iS, 1);
    arms.push({ iS, L: tL.path, R: tR.path, ev: Math.min(tL.ev, tR.ev) });
  }
  if (arms.length < Math.max(fold, 3)) return null;
  // 4. barrel (arms cross it) or flange (solid ring)
  const crossing = arms.filter((x) => x.ev >= 0.4);
  const barrel = crossing.length >= 0.5 * arms.length;

  const MIN_ARM = (3 / (2 * Math.PI * 240)) * NT; // 3 mm at the 240 mm face radius, in columns
  // 5. Symmetric arms as curves: the photo is off-centre, so one arm's copies in the other sectors
  //    sit a few pixels apart and a per-pixel median would erase thin tips. Arms are grouped by
  //    their place in the sector and each group's edge curves averaged into one canonical arm.
  const S = sectorCols;
  const mid = (x: { iS: number; L: Float64Array; R: Float64Array }) => {
    const k = Math.floor((iLip - x.iS) / 2);
    return (x.L[k] + x.R[k]) / 2;
  };
  // Slots: the arms of the sector with the most arms; every other arm joins the nearest slot,
  // at most one per sector, so two close twin arms are never merged into one.
  type Arm = (typeof crossing)[number];
  const secOf = (x: Arm) => Math.floor(wrap(mid(x)) / S);
  const bySector = new Map<number, Arm[]>();
  for (const x of crossing) {
    const k = secOf(x);
    if (!bySector.has(k)) bySector.set(k, []);
    bySector.get(k)!.push(x);
  }
  let template: Arm[] = [];
  for (const list of bySector.values()) if (list.length > template.length) template = list;
  const posIn = (x: Arm) => ((mid(x) % S) + S) % S;
  const circ = (d: number) => Math.abs(((d % S) + S * 1.5) % S - S / 2);
  const slots = template.map((x) => ({ ref: x, pos: posIn(x), members: new Map<number, { x: Arm; d: number }>() }));
  let spacing = S;
  for (let p1 = 0; p1 < slots.length; p1++)
    for (let p2 = p1 + 1; p2 < slots.length; p2++) spacing = Math.min(spacing, circ(slots[p1].pos - slots[p2].pos));
  for (const x of crossing) {
    let best = -1, bd = Infinity;
    for (let n = 0; n < slots.length; n++) {
      const d = circ(posIn(x) - slots[n].pos);
      if (d < bd) { bd = d; best = n; }
    }
    if (best < 0 || bd > Math.min(0.5 * spacing, 0.15 * S)) continue;
    // sector of this arm relative to the slot's reference arm
    const k = wrap(Math.round((mid(x) - mid(slots[best].ref)) / S) * S) / S;
    const kk = Math.round(k) % fold;
    const cur = slots[best].members.get(kk);
    if (!cur || bd < cur.d) slots[best].members.set(kk, { x, d: bd });
  }
  const canon: { iS: number; L: Float64Array; R: Float64Array; own: Map<number, Arm> }[] = [];
  for (const slot of slots) {
    if (slot.members.size < Math.max(2, Math.ceil(0.4 * fold))) continue; // not repeated around the wheel
    const ref = mid(slot.ref);
    const members = [...slot.members.entries()];
    const iS = Math.min(...members.map(([, m]) => m.x.iS));
    const n = iLip - iS + 1;
    const L = new Float64Array(n), R = new Float64Array(n), cnt = new Float64Array(n);
    const own = new Map<number, Arm>();
    for (const [k, m] of members) {
      own.set(k, m.x);
      // whole sectors between this copy and the reference arm (its residual offset is kept)
      const dd = mid(m.x) - ref;
      const shift = dd - ((((dd % S) + S * 1.5) % S) - S / 2);
      for (let i = m.x.iS; i <= iLip; i++) {
        L[i - iS] += m.x.L[i - m.x.iS] - shift;
        R[i - iS] += m.x.R[i - m.x.iS] - shift;
        cnt[i - iS]++;
      }
    }
    for (let k = 0; k < n; k++) {
      if (cnt[k]) { L[k] /= cnt[k]; R[k] /= cnt[k]; } else { L[k] = NaN; R[k] = NaN; }
    }
    // an arm that is only ever its minimum width is a crossed pair of edges, not an arm
    let thin = 0, wn = 0;
    for (let k = 0; k < n; k++) if (!Number.isNaN(L[k])) { wn++; if (R[k] - L[k] < MIN_ARM) thin++; }
    if (wn && thin < 0.7 * wn) canon.push({ iS, L, R, own });
  }
  if (barrel && !canon.length) return null;
  // Traced arms take over just after the rows they were fitted on, column by column: the photo is
  // often off-centre, so a common row would fall inside the barrel on one side of the wheel, and
  // the window corners' fillets near the barrel edge would leave steps on the arms.
  const rcs = new Int32Array(NT);
  for (let j = 0; j < NT; j++) rcs[j] = barrel ? rcw[j] + 8 : rc[j];
  let rcMinS = ib;
  for (let j = 0; j < NT; j++) rcMinS = Math.min(rcMinS, rcs[j]);

  const mRows = iLip - ia + 1;
  const M = new Uint8Array(mRows * NT);
  for (let i = ia; i <= iLip; i++) {
    const o = (i - ia) * NT;
    for (let j = 0; j < NT; j++) M[o + j] = i >= rcs[j] ? (barrel ? 0 : 1) : solid(i, j) ? 1 : 0;
    if (!barrel) continue;
    for (const arm of canon) {
      if (i < arm.iS) continue;
      const cl = arm.L[i - arm.iS], cr = arm.R[i - arm.iS];
      if (Number.isNaN(cl) || Number.isNaN(cr)) continue;
      for (let k = 0; k < fold; k++) {
        // Each sector's arm starts on its own traced edges (continuous with its own cut-out, even
        // in a photo taken slightly off-axis) and eases into the symmetric shape.
        let x0 = cl + k * S, x1 = cr + k * S;
        const mine = arm.own.get(k);
        if (mine && i >= mine.iS) {
          const w = Math.min(1, (i - mine.iS) / 60);
          const near = (v: number, ref: number) => ref + (wrap(v - ref + NT / 2) - NT / 2);
          x0 = (1 - w) * near(mine.L[i - mine.iS], x0) + w * x0;
          x1 = (1 - w) * near(mine.R[i - mine.iS], x1) + w * x1;
        }
        // an arm always meets the lip: tapered tips keep at least ~3 mm of width
        if (x1 - x0 < MIN_ARM) {
          const m2 = (x0 + x1) / 2;
          x0 = m2 - MIN_ARM / 2;
          x1 = m2 + MIN_ARM / 2;
        }
        for (let col = Math.floor(x0); col <= Math.ceil(x1); col++) {
          const jj = wrap(col);
          // drawn from 16 rows before the handover, so a small offset against the cut-out arm
          // widens it slightly instead of leaving a step
          if (i >= rcs[jj] - 16) M[o + jj] = 1;
        }
      }
    }
  }
  // 6. Slots inside arms (Y-branched spokes, FSA-02): a see-through pocket beyond the main window,
  //    inside a traced arm, is the start of the gap between two branches. The pocket itself is cut
  //    from the arm, and its two edges are followed on to the lip like arm edges (the branches
  //    then show the barrel between them, as in the photo).
  if (barrel) {
    const top = new Int32Array(NT).fill(-1);
    const bot = new Int32Array(NT).fill(-1);
    // a pocket row: a run of see-through pixels inside the painted arm, with solid arm on both sides
    for (let i = ia; i <= iLip; i++) {
      const o = (i - ia) * NT;
      for (let j = 0; j < NT; ) {
        if (!M[o + j] || solid(i, j)) { j++; continue; }
        let e = j;
        while (e < NT && M[o + e] && !solid(i, e)) e++;
        const left = wrap(j - 1), right = wrap(e);
        if (e - j >= 2 && e - j < 0.3 * S && M[o + left] && solid(i, left) && M[o + right] && solid(i, right)) {
          for (let k = j; k < e; k++) {
            M[o + k] = 0;
            if (bot[k] < 0) bot[k] = i;
            top[k] = i;
          }
        }
        j = e;
      }
    }
    const slotTracks: { iS: number; L: Float64Array; R: Float64Array }[] = [];
    let j = 0;
    while (j < NT && top[j] >= 0) j++; // start the scan outside a pocket
    for (let n = 0; n < NT; n++) {
      const j0 = wrap(j + n);
      if (top[j0] < 0 || (n > 0 && top[wrap(j0 - 1)] >= 0)) continue;
      let w = 0, iTop = -1;
      while (w < NT && top[wrap(j0 + w)] >= 0) { iTop = Math.max(iTop, top[wrap(j0 + w)]); w++; }
      if (w < 6 || iTop - 30 < ia || iLip - iTop < 8) continue;
      const iS = iTop - 4;
      let jl = -1, jr = -1;
      for (let d = 0; d < w; d++) {
        if (!solid(iS, j0 + d)) { if (jl < 0) jl = j0 + d; jr = j0 + d; }
      }
      if (jl < 0 || jr - jl < 3) continue;
      const eL = trackEdge(fitEdge(jl - 0.5, iS), iS, 1);
      const eR = trackEdge(fitEdge(jr + 0.5, iS), iS, -1);
      if (Math.min(eL.ev, eR.ev) < 0.35) continue;
      const L = new Float64Array(iLip - iS + 1), R = new Float64Array(iLip - iS + 1);
      for (let i = iS; i <= iLip; i++) {
        L[i - iS] = eL.path[i - iS];
        R[i - iS] = L[i - iS] + (wrap(eR.path[i - iS] - L[i - iS] + NT / 2) - NT / 2);
      }
      // edges that cross before the lip are not a slot
      if (R[R.length - 1] - L[L.length - 1] >= 4) slotTracks.push({ iS, L, R });
    }
    // Slots are averaged across the sectors like the arms and cut in every sector. Branches only
    // diverge, so a slot never narrows towards the lip.
    const used = new Uint8Array(slotTracks.length);
    // compared where every track ends (the lip): slots slant, and tracks start at different rows
    const midOf = (t: { iS: number; L: Float64Array; R: Float64Array }) => (t.L[t.L.length - 1] + t.R[t.R.length - 1]) / 2;
    for (let a = 0; a < slotTracks.length; a++) {
      if (used[a]) continue;
      const ref = slotTracks[a];
      const members: { t: typeof ref; shift: number }[] = [];
      for (let b = a; b < slotTracks.length; b++) {
        if (used[b]) continue;
        const dd = midOf(slotTracks[b]) - midOf(ref);
        const res = (((dd % S) + S * 1.5) % S) - S / 2;
        // an off-centre photo puts copies of one slot up to ~0.1 sector apart
        if (Math.abs(res) > Math.max(16, 0.15 * S)) continue;
        used[b] = 1;
        members.push({ t: slotTracks[b], shift: dd - res });
      }
      if (members.length < Math.max(2, Math.ceil(0.4 * fold))) continue;
      const iS = Math.round(members.reduce((acc, m) => acc + m.t.iS, 0) / members.length);
      let width = 0;
      for (let i = iS; i <= iLip; i++) {
        let cl = 0, cr = 0, n = 0;
        for (const m of members) {
          const k = i - m.t.iS;
          if (k < 0 || k >= m.t.L.length) continue;
          cl += m.t.L[k] - m.shift;
          cr += m.t.R[k] - m.shift;
          n++;
        }
        if (!n) continue;
        cl /= n; cr /= n;
        // never narrower towards the lip, and never wider than a branch gap (~18 mm at the lip)
        width = Math.min(Math.max(width, cr - cl), 0.12 * S);
        if (width < 1) continue;
        const mid = (cl + cr) / 2;
        const o = (i - ia) * NT;
        for (let k = 0; k < fold; k++) {
          for (let col = Math.ceil(mid - width / 2 + k * S); col <= Math.floor(mid + width / 2 + k * S); col++) M[o + wrap(col)] = 0;
        }
      }
    }
  }
  const value = (rr: number, t: number) => {
    const fi = rr * (NRp - 1);
    if (fi >= iLip) return 1;
    if (fi < ia) return bil(a, c + Math.cos(t) * rr * half, c + Math.sin(t) * rr * half);
    const tc = wrap((t / (Math.PI * 2)) * NT);
    const i0 = Math.min(mRows - 2, Math.floor(fi) - ia), fy = fi - ia - i0;
    const j0 = Math.floor(tc) % NT, j1 = (j0 + 1) % NT, fx = tc - Math.floor(tc);
    return (M[i0 * NT + j0] * (1 - fx) + M[i0 * NT + j1] * fx) * (1 - fy) + (M[(i0 + 1) * NT + j0] * (1 - fx) + M[(i0 + 1) * NT + j1] * fx) * fy;
  };
  return { mode: barrel ? 'barrel' : 'flange', rLip: rowR(iLip), rStart: rowR(rcMinS), value };
}

/** Solves a small dense linear system (Gaussian elimination, partial pivoting); null if singular. */
function solveSmall(M: Float64Array[], v: Float64Array): number[] | null {
  const n = v.length;
  const A = M.map((row, i) => [...row, v[i]]);
  for (let col = 0; col < n; col++) {
    let piv = col;
    for (let r = col + 1; r < n; r++) if (Math.abs(A[r][col]) > Math.abs(A[piv][col])) piv = r;
    if (Math.abs(A[piv][col]) < 1e-9) return null;
    [A[col], A[piv]] = [A[piv], A[col]];
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const f = A[r][col] / A[col][col];
      for (let k = col; k <= n; k++) A[r][k] -= f * A[col][k];
    }
  }
  return A.map((row, i) => row[n] / row[i]);
}

/** 1D Gaussian down each column of a row-major grid (ends clamped); sigma may vary by row. */
function gaussianColumns(g: Float32Array, rows: number, cols: number, sigma: number | ((row: number) => number)) {
  const sig = typeof sigma === 'number' ? () => sigma : sigma;
  // weights depend only on the row: computed once, reused for every column
  const taps: Float32Array[] = [];
  for (let i = 0; i < rows; i++) {
    const sg = sig(i);
    if (sg < 0.3) { taps.push(new Float32Array(0)); continue; }
    const R = Math.ceil(sg * 3);
    const w = new Float32Array(R + 1);
    for (let d = 0; d <= R; d++) w[d] = Math.exp(-(d * d) / (2 * sg * sg));
    taps.push(w);
  }
  const col = new Float32Array(rows);
  for (let j = 0; j < cols; j++) {
    for (let i = 0; i < rows; i++) col[i] = g[i * cols + j];
    for (let i = 0; i < rows; i++) {
      const w = taps[i];
      if (!w.length) { g[i * cols + j] = col[i]; continue; }
      let s = col[i] * w[0], sw = w[0];
      for (let d = 1; d < w.length; d++) {
        if (i - d >= 0) { s += col[i - d] * w[d]; sw += w[d]; }
        if (i + d < rows) { s += col[i + d] * w[d]; sw += w[d]; }
      }
      g[i * cols + j] = s / sw;
    }
  }
}

/**
 * Bevelled, dished 3D spoke face from mask outlines (shapes on a unit disc, 1 = spoke ends).
 * The dish is a curve, steep near the lip and flat at the hub, like a concave forged face. The
 * front face takes the dish's exact normal; the bevel and walls are smooth among themselves and
 * sharp at the machined corners.
 */
export function buildSpokeFace(shapes: THREE.Shape[], opts: { radius: number; depth: number; dish: number; bevel: number }): THREE.BufferGeometry {
  const { radius, depth, dish, bevel } = opts;
  const scaled = shapes.map((s) => {
    const shape = new THREE.Shape(s.getPoints(48).map((p) => p.clone().multiplyScalar(radius)));
    shape.holes = s.holes.map((hole) => new THREE.Path(hole.getPoints(48).map((p) => p.clone().multiplyScalar(radius))));
    return shape;
  });
  const uvAt = (v: ArrayLike<number>, i: number) => new THREE.Vector2(v[i * 3] / (2 * radius) + 0.5, v[i * 3 + 1] / (2 * radius) + 0.5);
  const geo = new THREE.ExtrudeGeometry(scaled, {
    depth,
    curveSegments: 12,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelOffset: -bevel,
    bevelSegments: 4,
    UVGenerator: {
      generateTopUV: (_g: unknown, v: ArrayLike<number>, a: number, b: number, c: number) => [uvAt(v, a), uvAt(v, b), uvAt(v, c)],
      generateSideWallUV: (_g: unknown, v: ArrayLike<number>, a: number, b: number, c: number, d: number) => [uvAt(v, a), uvAt(v, b), uvAt(v, c), uvAt(v, d)]
    } as unknown as THREE.UVGenerator
  });
  subdivideCaps(geo, radius * 0.045);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  // front cap: the triangles lying in the extrude's top plane, before the dish moves them
  const capZ = depth + bevel;
  const frontCap = new Uint8Array(pos.count / 3);
  for (let f = 0; f < frontCap.length; f++) {
    let onCap = true;
    for (let k = 0; k < 3 && onCap; k++) onCap = Math.abs(pos.getZ(f * 3 + k) - capZ) < 1e-7;
    frontCap[f] = onCap ? 1 : 0;
  }
  for (let i = 0; i < pos.count; i++) {
    const rho = Math.min(1, Math.hypot(pos.getX(i), pos.getY(i)) / radius);
    const sink = dish * (1 - rho * rho);
    pos.setZ(i, pos.getZ(i) - depth - bevel - sink);
  }
  pos.needsUpdate = true;
  // Before turning: front (+Z) -> +X maps (x, y, z) to (z, y, -x).
  geo.rotateY(Math.PI / 2);
  const creased = toCreasedNormals(geo, THREE.MathUtils.degToRad(38));
  if (creased !== geo) geo.dispose();
  // The front cap gets the dish's exact normal. Averaged with the bevel (whose first row is
  // within the crease angle), the long cap triangles carried the bevel's tilt across the spoke
  // and shaded it in blotches, like a hand-filed face rather than a machined one.
  const p = creased.attributes.position as THREE.BufferAttribute;
  const nrm = creased.attributes.normal as THREE.BufferAttribute;
  const k = (2 * dish) / (radius * radius);
  const n = new THREE.Vector3();
  for (let f = 0; f < frontCap.length; f++) {
    if (!frontCap[f]) continue;
    for (let v = f * 3; v < f * 3 + 3; v++) {
      // pre-turn coordinates: x = -z', y = y'
      const x = -p.getZ(v), y = p.getY(v);
      const inside = Math.hypot(x, y) < radius;
      const gx = inside ? k * x : 0, gy = inside ? k * y : 0;
      n.set(-gx, -gy, 1).normalize();
      nrm.setXYZ(v, n.z, n.y, -n.x);
    }
  }
  nrm.needsUpdate = true;
  creased.computeBoundingSphere();
  return creased;
}

/** Splits long cap triangles (in the face plane) so the dish bends smoothly. */
function subdivideCaps(geo: THREE.BufferGeometry, maxEdge: number) {
  const src = geo.index ? geo.toNonIndexed() : geo;
  const pos = src.attributes.position.array as ArrayLike<number>;
  const uv = src.attributes.uv.array as ArrayLike<number>;
  const outPos: number[] = [];
  const outUv: number[] = [];
  const max2 = maxEdge * maxEdge;
  type V = [number, number, number, number, number];
  const vert = (i: number): V => [pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2], uv[i * 2], uv[i * 2 + 1]];
  const mid = (p: V, q: V): V => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2, (p[2] + q[2]) / 2, (p[3] + q[3]) / 2, (p[4] + q[4]) / 2];
  const len2 = (p: V, q: V) => (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2;
  const emit = (p: V, q: V, r: V, depth: number) => {
    const ab = len2(p, q), bc = len2(q, r), ca = len2(r, p);
    const longest = Math.max(ab, bc, ca);
    // side walls (triangles spanning z) are left alone
    const flat = Math.abs(p[2] - q[2]) < 1e-6 && Math.abs(q[2] - r[2]) < 1e-6;
    if (!flat || longest <= max2 || depth > 14) {
      for (const v of [p, q, r]) {
        outPos.push(v[0], v[1], v[2]);
        outUv.push(v[3], v[4]);
      }
      return;
    }
    if (longest === ab) { const m = mid(p, q); emit(p, m, r, depth + 1); emit(m, q, r, depth + 1); }
    else if (longest === bc) { const m = mid(q, r); emit(p, q, m, depth + 1); emit(p, m, r, depth + 1); }
    else { const m = mid(r, p); emit(p, q, m, depth + 1); emit(m, q, r, depth + 1); }
  };
  for (let i = 0; i < pos.length / 3; i += 3) emit(vert(i), vert(i + 1), vert(i + 2), 0);
  geo.setIndex(null);
  geo.setAttribute('position', new THREE.Float32BufferAttribute(outPos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(outUv, 2));
  geo.deleteAttribute('normal');
  geo.clearGroups();
}

// ---------------------------------------------------------------------------
// Hub: lug nuts + centre cap
// ---------------------------------------------------------------------------

let lugGeoCache: THREE.BufferGeometry | null = null;
function lugNutGeometry() {
  if (lugGeoCache) return lugGeoCache;
  // hex body (6 segments = flat facets) on a conical seat, with a domed, chamfered top
  const hex = toCreasedNormals(lathe([[0.0, 0.0], [0.0085, 0.0], [0.0105, 0.003], [0.0105, 0.016], [0.0092, 0.018], [0.0, 0.018]], 6, false), 0.5);
  const dome = lathe([[0.0, 0.0215], [0.0045, 0.021], [0.0075, 0.0195], [0.0088, 0.0178]], 24, false);
  lugGeoCache = mergeGeometries([hex.index ? hex.toNonIndexed() : hex, dome.toNonIndexed()])!;
  return lugGeoCache;
}

export function buildHub(d: WheelDims, mats: WheelKitMaterials): THREE.Group {
  const L = rimLayout(d);
  const g = new THREE.Group();
  g.name = 'hub';
  const hubFront = L.hubFrontX; // front of the hub pad
  const pcd = 0.056; // 5 x 112
  const nut = lugNutGeometry();
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + Math.PI / 2;
    const m = new THREE.Mesh(nut, mats.lugNut);
    m.position.set(hubFront - 0.003, Math.cos(a) * pcd, Math.sin(a) * pcd);
    g.add(m);
  }
  // centre cap: a low dome with the monogram on its face
  const capGeo = lathe([[0, 0.009], [0.018, 0.0085], [0.029, 0.0066], [0.0335, 0.0035], [0.0345, 0]], 48, false);
  const cap = new THREE.Mesh(capGeo, mats.cap);
  // planar UVs for the logo, from the cap's front view
  const pos = capGeo.attributes.position as THREE.BufferAttribute;
  const uv = capGeo.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) uv.setXY(i, -pos.getZ(i) / 0.069 + 0.5, pos.getY(i) / 0.069 + 0.5);
  uv.needsUpdate = true;
  cap.position.x = hubFront - 0.002;
  g.add(cap);
  return g;
}

// ---------------------------------------------------------------------------
// Brakes
// ---------------------------------------------------------------------------

const discGeoCache = new Map<string, THREE.BufferGeometry[]>();

/** Two-piece floating disc: cross-drilled vented friction ring, vanes, anodised hat, bobbins. Spins with the wheel. */
export function buildDisc(d: WheelDims, mats: WheelKitMaterials): THREE.Group {
  const L = rimLayout(d);
  const Rd = L.discRadius;
  const Ri = Rd * 0.63;
  const t = L.discThickness;
  const plate = t * 0.3;
  const key = `${Rd}|${t}`;
  let geos = discGeoCache.get(key);
  if (!geos) {
    const ring = new THREE.Shape();
    ring.absarc(0, 0, Rd, 0, Math.PI * 2, false);
    const hole = new THREE.Path();
    hole.absarc(0, 0, Ri, 0, Math.PI * 2, true);
    ring.holes.push(hole);
    // three staggered rows of drillings, curved like a real cross-drilled pattern
    const rows = [0.73, 0.82, 0.91];
    const perRow = 24;
    rows.forEach((f, ri) => {
      for (let k = 0; k < perRow; k++) {
        const a = ((k + ri * 0.33) / perRow) * Math.PI * 2 + ri * 0.08;
        const r = Rd * f;
        const p = new THREE.Path();
        p.absarc(Math.cos(a) * r, Math.sin(a) * r, 0.0034, 0, Math.PI * 2, true);
        ring.holes.push(p);
      }
    });
    const uvAt = (v: ArrayLike<number>, i: number) => new THREE.Vector2(v[i * 3] / (2 * Rd) + 0.5, v[i * 3 + 1] / (2 * Rd) + 0.5);
    const plateGeo = new THREE.ExtrudeGeometry(ring, {
      depth: plate,
      curveSegments: 10,
      bevelEnabled: true,
      bevelThickness: 0.0006,
      bevelSize: 0.0006,
      bevelSegments: 1,
      UVGenerator: {
        generateTopUV: (_g: unknown, v: ArrayLike<number>, a: number, b: number, c: number) => [uvAt(v, a), uvAt(v, b), uvAt(v, c)],
        generateSideWallUV: (_g: unknown, v: ArrayLike<number>, a: number, b: number, c: number, e: number) => [uvAt(v, a), uvAt(v, b), uvAt(v, c), uvAt(v, e)]
      } as unknown as THREE.UVGenerator
    });
    plateGeo.rotateY(Math.PI / 2); // extrusion -> +X
    // vanes between the plates (curved, 36 of them)
    const vane = new THREE.BoxGeometry(t - 2 * plate, 0.004, Rd - Ri - 0.004);
    const vanes: THREE.BufferGeometry[] = [];
    for (let k = 0; k < 36; k++) {
      const a = (k / 36) * Math.PI * 2;
      const v = vane.clone();
      v.rotateX(0.35); // curved vanes read as angled at the edge
      v.translate(0, 0, (Rd + Ri) / 2);
      v.rotateX(a);
      vanes.push(v);
    }
    const vaneGeo = mergeGeometries(vanes)!;
    // hat: a cup from the ring's inner edge to the hub face
    const hatDepth = L.hubBackX - (L.discX + t / 2);
    const hatGeo = lathe([
      [Ri + 0.004, t / 2 - 0.002],
      [Ri - 0.004, t / 2],
      [0.098, t / 2 + 0.004],
      [0.094, t / 2 + hatDepth * 0.6],
      [0.092, t / 2 + hatDepth - 0.003],
      [0.088, t / 2 + hatDepth],
      [0.033, t / 2 + hatDepth]
    ].reverse() as [number, number][], 64, false);
    const bobbin = new THREE.CylinderGeometry(0.0055, 0.0055, t * 0.42, 12).rotateZ(Math.PI / 2);
    const bobbins: THREE.BufferGeometry[] = [];
    for (let k = 0; k < 10; k++) {
      const a = (k / 10) * Math.PI * 2;
      bobbins.push(bobbin.clone().translate(t / 2, Math.cos(a) * (Ri + 0.001), Math.sin(a) * (Ri + 0.001)));
    }
    geos = [plateGeo, vaneGeo, hatGeo, mergeGeometries(bobbins)!];
    discGeoCache.set(key, geos);
  }
  const [plateGeo, vaneGeo, hatGeo, bobbinGeo] = geos;
  const g = new THREE.Group();
  g.name = 'brake_disc';
  const outerPlate = new THREE.Mesh(plateGeo, mats.discFace);
  outerPlate.position.x = L.discX + t / 2 - plate;
  const innerPlate = new THREE.Mesh(plateGeo, mats.discFace);
  innerPlate.position.x = L.discX - t / 2;
  const vanes = new THREE.Mesh(vaneGeo, mats.discEdge);
  vanes.position.x = L.discX;
  const hat = new THREE.Mesh(hatGeo, mats.hat);
  hat.position.x = L.discX;
  const bob = new THREE.Mesh(bobbinGeo, mats.lugNut);
  bob.position.x = L.discX - t / 2;
  g.add(outerPlate, innerPlate, vanes, hat, bob);
  return g;
}

const caliperGeoCache = new Map<string, THREE.BufferGeometry[]>();

/**
 * Six-piston monoblock caliper straddling the disc: a kidney-shaped body with large cast radii,
 * a raised outer plate, a bridge over the disc and two bleed screws. Stationary (not in the
 * spinning group); sits on the upper trailing side of the disc.
 */
export function buildCaliper(d: WheelDims, mats: WheelKitMaterials, isRight: boolean): THREE.Group {
  const L = rimLayout(d);
  const Rd = L.discRadius;
  const rIn = Rd - 0.064;
  const rOut = Rd + 0.022;
  const span = THREE.MathUtils.degToRad(d.isFront ? 84 : 70); // ~278 / 230 mm along the disc
  const halfW = L.discThickness / 2 + (d.isFront ? 0.036 : 0.03); // disc plane to outer face
  const key = `${Rd}|${span}|${halfW}`;
  let geos = caliperGeoCache.get(key);
  if (!geos) {
    const kidney = (r0: number, r1: number, a0: number, a1: number) => {
      const s = new THREE.Shape();
      const mr = (r0 + r1) / 2, er = (r1 - r0) / 2;
      s.absarc(0, 0, r1, a0, a1, false);
      s.absarc(Math.cos(a1) * mr, Math.sin(a1) * mr, er, a1, a1 + Math.PI, false);
      s.absarc(0, 0, r0, a1, a0, true);
      s.absarc(Math.cos(a0) * mr, Math.sin(a0) * mr, er, a0 + Math.PI, a0 + Math.PI * 2, false);
      return s;
    };
    const a0 = Math.PI / 2 - span / 2, a1 = Math.PI / 2 + span / 2; // centred on +Y (top) before rotation
    const bodyShape = kidney(rIn, rOut, a0, a1);
    const bev = 0.011;
    const body = new THREE.ExtrudeGeometry(bodyShape, {
      depth: halfW * 2 - bev * 2,
      curveSegments: 40,
      bevelEnabled: true,
      bevelThickness: bev,
      bevelSize: bev * 0.9,
      bevelOffset: -bev * 0.9,
      bevelSegments: 6
    });
    body.translate(0, 0, -(halfW * 2 - bev * 2) / 2);
    // raised plate on the outer face
    const plateShape = kidney(rIn + 0.012, rOut - 0.014, a0 + 0.06, a1 - 0.06);
    const plate = new THREE.ExtrudeGeometry(plateShape, {
      depth: 0.0015,
      curveSegments: 40,
      bevelEnabled: true,
      bevelThickness: 0.0018,
      bevelSize: 0.0018,
      bevelOffset: -0.0018,
      bevelSegments: 3
    });
    plate.translate(0, 0, halfW - 0.0005);
    // bleed screws on top of the bridge
    const screws: THREE.BufferGeometry[] = [];
    for (const f of [0.22, 0.78]) {
      const a = a0 + (a1 - a0) * f;
      const sc = new THREE.CylinderGeometry(0.0035, 0.0042, 0.012, 6);
      sc.rotateZ(-(Math.PI / 2 - a));
      sc.translate(Math.cos(a) * (rOut + 0.007), Math.sin(a) * (rOut + 0.007), halfW * 0.25);
      screws.push(sc);
    }
    // pads, visible in the gap at the caliper's inner edge
    const padShape = kidney(Rd - 0.058, Rd - 0.004, a0 + 0.1, a1 - 0.1);
    const pad = new THREE.ExtrudeGeometry(padShape, { depth: 0.012, curveSegments: 24, bevelEnabled: false });
    const pads = mergeGeometries([
      pad.clone().translate(0, 0, L.discThickness / 2 + 0.0005),
      pad.clone().translate(0, 0, -L.discThickness / 2 - 0.0125)
    ])!;
    geos = [body, plate, mergeGeometries(screws)!, pads];
    for (const gg of geos) gg.rotateY(Math.PI / 2); // shape plane -> disc plane (YZ), extrusion -> axle
    caliperGeoCache.set(key, geos);
  }
  const [body, plate, screws, pads] = geos;
  const g = new THREE.Group();
  g.name = 'caliper';
  g.add(
    new THREE.Mesh(body, mats.caliper),
    new THREE.Mesh(plate, mats.caliper),
    new THREE.Mesh(screws, mats.lugNut),
    new THREE.Mesh(pads, mats.pad)
  );
  g.position.x = L.discX;
  // Upper trailing side of the disc on both sides of the car: right-hand assemblies face +X with
  // the car's front at +Z, left-hand ones are turned 180deg, so the angle mirrors.
  g.rotation.x = (isRight ? -1 : 1) * THREE.MathUtils.degToRad(48);
  return g;
}
