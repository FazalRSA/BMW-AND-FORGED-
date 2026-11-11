/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Colour themes.
 *
 * A theme gives a colour to each role (page, surface, text, accent, main action). Every role is a
 * CSS variable that the Tailwind tokens read (tailwind.config.cjs: `carbon`, `surface`, `gunmetal`,
 * `ink`, `mute`, `line`, `gold`, `ember`), so a component written with those tokens follows whichever
 * theme is applied, dialogs included. The site's default values are in index.css (`:root`); a theme
 * overrides them for as long as it is applied (`applyTheme`).
 *
 * The hex codes of a palette are written once, here. Nothing else in the app repeats them.
 */

/** The configurator's palette (owner's brief, docs/PLATES_MASTER_PLAN.md): dark, quiet, one warm metal. */
export const LUXURY = {
  obsidian: '#0B0B0C',
  carbon: '#1A1A1D',
  ivory: '#F2EDE4',
  champagne: '#C9A96E',
  titanium: '#8A8A8F'
} as const;

export interface Theme {
  /** Used in the class name (`theme-<id>`) put on <html> while the theme is applied. */
  id: string;
  /** Page background. */
  page: string;
  /** Cards, panels, sheets. */
  surface: string;
  /** Surfaces raised above a surface (price card, pressed chips). */
  raised: string;
  /** Text. */
  text: string;
  /** Secondary text. */
  textMuted: string;
  /** Hairlines and rings (drawn at 10 % opacity). */
  hairline: string;
  /** Selected options, prices, focus rings. */
  accent: string;
  /** The main action button, and its hover. */
  action: string;
  actionHover: string;
  /** Opacity of the glow under the main action button (0 = none). */
  actionGlow: number;
}

type Rgb = [number, number, number];

const channels = (hex: string): Rgb => {
  const value = parseInt(hex.replace('#', ''), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
};

/** `from` moved `amount` (0..1) of the way to `to`, as a hex code: for shades derived from the palette. */
export const mixColours = (from: string, to: string, amount: number): string => {
  const start = channels(from), end = channels(to);
  return '#' + start.map((channel, index) => Math.round(channel + (end[index] - channel) * amount).toString(16).padStart(2, '0')).join('');
};

/** "r g b", the form the Tailwind tokens take (`rgb(var(--ink) / <alpha>)`). */
const triplet = (hex: string) => channels(hex).join(' ');

export const LUXURY_THEME: Theme = {
  id: 'lux',
  page: LUXURY.obsidian,
  surface: LUXURY.carbon,
  raised: mixColours(LUXURY.carbon, LUXURY.ivory, 0.07),
  text: LUXURY.ivory,
  textMuted: LUXURY.titanium,
  hairline: LUXURY.ivory,
  accent: LUXURY.champagne,
  action: LUXURY.champagne,
  actionHover: mixColours(LUXURY.champagne, LUXURY.ivory, 0.35),
  actionGlow: 0.16
};

/** The theme as CSS variables. `.stage-dark` (dialogs reset the text colours there) is covered too. */
export const themeCss = (theme: Theme): string => {
  const scope = `.theme-${theme.id}`;
  const vars = [
    `--carbon:${triplet(theme.page)}`,
    `--surface:${triplet(theme.surface)}`,
    `--gunmetal:${triplet(theme.raised)}`,
    `--ink:${triplet(theme.text)}`,
    `--mute:${triplet(theme.textMuted)}`,
    `--line:${triplet(theme.hairline)}`,
    `--gold:${triplet(theme.accent)}`,
    `--ember:${triplet(theme.action)}`,
    `--ember-light:${triplet(theme.actionHover)}`,
    `--ember-glow:${theme.actionGlow}`
  ].join(';');
  return `${scope},${scope} .stage-dark{${vars}}${scope} body{background-color:${theme.page};color:${theme.text}}`;
};

/**
 * Applies a theme to the whole document (dialogs are rendered outside the app root, so the class goes
 * on <html>). Returns the function that takes it off again.
 */
export function applyTheme(theme: Theme): () => void {
  const id = `theme-${theme.id}`;
  if (!document.getElementById(id)) {
    const style = document.createElement('style');
    style.id = id;
    style.textContent = themeCss(theme);
    document.head.appendChild(style);
  }
  const root = document.documentElement;
  root.classList.add(id);
  const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  const before = meta?.content;
  if (meta) meta.content = theme.page;
  return () => {
    root.classList.remove(id);
    if (meta && before) meta.content = before;
  };
}
