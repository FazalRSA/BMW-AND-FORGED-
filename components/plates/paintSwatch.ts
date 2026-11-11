/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { CSSProperties } from 'react';
import type { PaintFinish } from '../../services/plates/manifest';

/**
 * How a paint swatch is drawn so that it suggests its finish, from the paint's colour alone:
 *
 * - solid:    deep colour with one small, crisp highlight (a hard clear coat)
 * - metallic: a bright band across the colour and fine flake
 * - pearl:    the colour drifting towards its neighbours on the colour wheel
 * - frozen:   no highlight at all, a broad soft sheen (matte)
 * - satin:    a wide, dim highlight (between gloss and matte)
 *
 * The colours here are computed from the paint; none of them is a brand colour.
 */

type Rgb = [number, number, number];

const toRgb = (hex: string): Rgb => {
  const value = parseInt(hex.replace('#', ''), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
};

const css = ([red, green, blue]: Rgb, alpha = 1) => (alpha >= 1 ? `rgb(${red} ${green} ${blue})` : `rgb(${red} ${green} ${blue} / ${alpha})`);

/** Towards white (amount > 0) or black (amount < 0). */
const shade = (colour: Rgb, amount: number): Rgb =>
  colour.map((channel) => Math.round(amount > 0 ? channel + (255 - channel) * amount : channel * (1 + amount))) as Rgb;

/** The colour turned round the colour wheel by `degrees`. */
function rotateHue([red, green, blue]: Rgb, degrees: number): Rgb {
  const angle = (degrees * Math.PI) / 180;
  const cos = Math.cos(angle), sin = Math.sin(angle);
  // a rotation about the grey axis of RGB space: every row of the matrix is one output channel
  const even = (1 - cos) / 3, skew = sin / Math.sqrt(3);
  const matrix = [cos + even, even - skew, even + skew, even + skew, cos + even, even - skew, even - skew, even + skew, cos + even];
  const channel = (row: number) => Math.max(0, Math.min(255, Math.round(red * matrix[row * 3] + green * matrix[row * 3 + 1] + blue * matrix[row * 3 + 2])));
  return [channel(0), channel(1), channel(2)];
}

/** Fine speckle for metallic flake: an SVG noise tile, light and dark specks at low opacity. */
const FLAKE =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='48' height='48'%3E%3Cfilter id='f'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='1.6' numOctaves='2' seed='7'/%3E%3CfeColorMatrix values='0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  1.5 0 0 0 -0.6'/%3E%3C/filter%3E%3Crect width='48' height='48' filter='url(%23f)'/%3E%3C/svg%3E\")";

const WHITE: Rgb = [255, 255, 255];

export function paintSwatchStyle(hex: string, finish: PaintFinish): CSSProperties {
  const base = toRgb(hex);
  const body = `radial-gradient(circle at 50% 38%, ${css(shade(base, 0.1))} 0%, ${css(base)} 52%, ${css(shade(base, -0.5))} 100%)`;
  switch (finish) {
    case 'solid':
      return { backgroundImage: `radial-gradient(circle at 31% 25%, ${css(WHITE, 0.95)} 0%, ${css(WHITE, 0.5)} 7%, ${css(WHITE, 0)} 19%), ${body}` };
    case 'metallic':
      return {
        backgroundImage: `${FLAKE}, linear-gradient(128deg, ${css(WHITE, 0)} 22%, ${css(WHITE, 0.5)} 40%, ${css(WHITE, 0)} 58%), ${body}`,
        backgroundSize: '24px 24px, auto, auto',
        // the flake lightens the colour under it instead of sitting on it as white dots
        backgroundBlendMode: 'overlay, normal, normal'
      };
    case 'pearl':
      return {
        backgroundImage: `radial-gradient(circle at 32% 26%, ${css(WHITE, 0.7)} 0%, ${css(WHITE, 0)} 24%), conic-gradient(from 210deg at 50% 50%, ${css(shade(rotateHue(base, 38), 0.18))}, ${css(base)} 28%, ${css(shade(rotateHue(base, -42), 0.12))} 55%, ${css(shade(base, -0.25))} 78%, ${css(shade(rotateHue(base, 38), 0.18))})`
      };
    case 'frozen':
      return { backgroundImage: `linear-gradient(160deg, ${css(shade(base, 0.2))} 0%, ${css(base)} 48%, ${css(shade(base, -0.28))} 100%)` };
    case 'satin':
      return { backgroundImage: `radial-gradient(circle at 34% 28%, ${css(WHITE, 0.3)} 0%, ${css(WHITE, 0)} 46%), ${body}` };
  }
}
