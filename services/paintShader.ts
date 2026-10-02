/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as THREE from 'three';
import type { PaintColor } from '../types';

/**
 * Car paint layers on top of MeshPhysicalMaterial, without any per-colour textures:
 *
 * - **Metallic flake:** aluminium flakes in the base coat, each tilted a little differently, so
 *   close up the paint sparkles under the smooth clear coat. Computed from the model-space
 *   position (no UVs needed, so it works on any car file) and faded out when a flake is smaller
 *   than a pixel, so distant views stay clean instead of shimmering.
 * - **Flop:** metallic paint is bright where the panel faces you and darker where it turns away
 *   (the "face/flop" travel that makes a metallic read as metallic, not as a solid colour).
 *
 * The clear coat keeps the unperturbed normal (three.js uses it for the clear-coat layer), so
 * reflections stay mirror-smooth on top of the sparkle, like real paint.
 */
export interface PaintLayerUniforms {
  uFlakeStrength: THREE.IUniform<number>;
  uFlakeScale: THREE.IUniform<number>;
  uFlop: THREE.IUniform<number>;
}

/** Look per BMW paint type. Exposed so tuning sessions can adjust them live. */
export const PAINT_LAYERS: Record<PaintColor['type'], { flake: number; flop: number }> = {
  Metallic: { flake: 0.22, flop: 0.55 },
  // Frozen (matte) paints are metallic underneath, but the matte clear coat diffuses the sparkle.
  Frozen: { flake: 0.08, flop: 0.78 },
  Uni: { flake: 0, flop: 0.92 }
};

/** Flake cells per metre in model space (about 1.5 mm flakes on a real-scale car). */
export const FLAKE_SCALE = 650;

export function installPaintLayers(material: THREE.MeshPhysicalMaterial): PaintLayerUniforms {
  const uniforms: PaintLayerUniforms = {
    uFlakeStrength: { value: PAINT_LAYERS.Metallic.flake },
    uFlakeScale: { value: FLAKE_SCALE },
    uFlop: { value: PAINT_LAYERS.Metallic.flop }
  };
  material.userData.paintLayers = uniforms;
  material.customProgramCacheKey = () => 'forgedsa-paint-v1';
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vPaintPos;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvPaintPos = transformed;');
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
varying vec3 vPaintPos;
uniform float uFlakeStrength;
uniform float uFlakeScale;
uniform float uFlop;
vec3 paintHash3(vec3 p) {
  p = fract(p * vec3(0.1031, 0.1030, 0.0973));
  p += dot(p, p.yxz + 33.33);
  return fract((p.xxy + p.yxx) * p.zyx);
}`
      )
      .replace(
        '#include <normal_fragment_maps>',
        `#include <normal_fragment_maps>
{
  // Face/flop: darker as the panel turns away from the viewer
  float ndv = clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0);
  diffuseColor.rgb *= mix(uFlop, 1.0, pow(ndv, 0.55));

  // Flakes: one random tilt per cell, faded out once cells are smaller than a pixel
  vec3 fp = vPaintPos * uFlakeScale;
  float footprint = length(fwidth(fp));
  float visible = 1.0 - smoothstep(0.6, 1.6, footprint);
  if (uFlakeStrength > 0.0 && visible > 0.0) {
    vec3 tilt = paintHash3(floor(fp)) * 2.0 - 1.0;
    vec3 tiltView = normalize((viewMatrix * vec4(tilt, 0.0)).xyz);
    normal = normalize(normal + tiltView * uFlakeStrength * visible);
  }
}`
      );
  };
  return uniforms;
}

/** Sets the flake and flop for a paint on every material carrying the paint layers. */
export function applyPaintLayers(material: THREE.Material, paint: Pick<PaintColor, 'type'>) {
  const u = material.userData.paintLayers as PaintLayerUniforms | undefined;
  if (!u) return;
  const look = PAINT_LAYERS[paint.type] ?? PAINT_LAYERS.Metallic;
  u.uFlakeStrength.value = look.flake;
  u.uFlop.value = look.flop;
}
