/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * The plate manifest: which pre-rendered pictures exist (docs/PLATES_MASTER_PLAN.md, section 5;
 * written by scripts/plates/encode.py). It is fetched at run time and comes from outside the bundle,
 * so nothing in it is trusted: `parseManifest` checks every field, drops what it cannot use (with a
 * warning) and returns a typed result. Ids become parts of URLs, so they must be plain slugs.
 *
 * This module has no DOM or React in it and can be tested as is.
 */

export const PAINT_FINISHES = ['solid', 'metallic', 'pearl', 'frozen', 'satin'] as const;
export type PaintFinish = (typeof PAINT_FINISHES)[number];

export const PLATE_FORMATS = ['avif', 'webp'] as const;
export type PlateFormat = (typeof PLATE_FORMATS)[number];

export interface PlateView {
  id: string;
  label: string;
}

export interface PlatePaint {
  id: string;
  name: string;
  /** BMW paint code; '' when there is none. */
  code: string;
  /** The range the paint belongs to ("Standard", "Individual", …). */
  group: string;
  finish: PaintFinish;
  hex: string;
}

export interface PlateFinish {
  id: string;
  name: string;
  hex: string;
}

export interface PlateWheel {
  id: string;
  name: string;
  finishes: PlateFinish[];
}

/** Where a wheel plate sits in the frame: left, top, right, bottom as fractions of the frame. */
export type PlateBox = readonly [left: number, top: number, right: number, bottom: number];

/** The plates of one car in one view. */
export interface PlateSet {
  /** Paint ids that have a body plate. */
  body: string[];
  /** `<wheel>__<finish>` (or the manifest's factoryWheel key) -> the plate's box. */
  wheels: Record<string, PlateBox>;
}

export interface PlateCar {
  id: string;
  label: string;
  chassis: string;
  defaultPaint: string;
  /** By view id. Every view of the manifest has an entry (empty when nothing is rendered). */
  plates: Record<string, PlateSet>;
}

/** One encoded width of every plate: the file is `<name><suffix>.<format>`. */
export interface PlateSize {
  /** Width of the full frame at this size, in pixels. */
  w: number;
  suffix: string;
}

export interface PlateManifest {
  version: 1;
  frame: { w: number; h: number };
  /** Best first, as the manifest lists them. */
  formats: PlateFormat[];
  /** Largest first. Always at least one entry. */
  sizes: PlateSize[];
  /** Key of the car's own wheel plate in `PlateSet.wheels`. */
  factoryWheel: string;
  /** True while stand-in pictures remain. Nothing is shown to customers; the page notes it in the console. */
  placeholder: boolean;
  views: PlateView[];
  paints: PlatePaint[];
  wheels: PlateWheel[];
  cars: PlateCar[];
}

/**
 * Why a manifest could not be used:
 * - `network`: the request did not complete (offline, blocked, timed out);
 * - `http`: the server answered, but not with the file (`status`);
 * - `json`: the file is not JSON (a half-written upload, an HTML error page);
 * - `shape`: it is JSON, but not a manifest this page can read.
 */
export interface ManifestError {
  kind: 'network' | 'http' | 'json' | 'shape';
  /** For the console and the report; the page shows its own calm wording. */
  message: string;
  status?: number;
}

export type ManifestResult = { ok: true; manifest: PlateManifest; warnings: string[] } | { ok: false; error: ManifestError };

export const DEFAULT_FACTORY_WHEEL = 'factory__factory';

/** The key of a wheel plate in `PlateSet.wheels`. */
export const wheelPlateKey = (wheelId: string, finishId: string) => `${wheelId}__${finishId}`;

/**
 * The path of a plate under the plates folder, without size suffix and extension:
 * `<car>/<view>/body/<paint>` or `<car>/<view>/wheels/<wheel>__<finish>`. It names a plate everywhere
 * (file names, the manifest's "placeholders" list, the page's list of plates that failed to load).
 */
export const bodyPlatePath = (carId: string, viewId: string, paintId: string) => `${carId}/${viewId}/body/${paintId}`;
export const wheelPlatePath = (carId: string, viewId: string, wheelKey: string) => `${carId}/${viewId}/wheels/${wheelKey}`;

const SLUG = /^[A-Za-z0-9][A-Za-z0-9_-]*$/;
const SUFFIX = /^[A-Za-z0-9_-]*$/;
const HEX = /^#[0-9a-fA-F]{6}$/;
/** Codes the render config uses for "no BMW code". */
const NO_CODE = /^(—|-|n\/c|n\/a|none)?$/i;

type Dict = Record<string, unknown>;
const isDict = (v: unknown): v is Dict => typeof v === 'object' && v !== null && !Array.isArray(v);
const slug = (v: unknown): string | null => (typeof v === 'string' && SLUG.test(v) ? v : null);
const text = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');
const list = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const positive = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : null);

function parseBox(v: unknown): PlateBox | null {
  if (!Array.isArray(v) || v.length !== 4 || !v.every((n) => typeof n === 'number' && Number.isFinite(n))) return null;
  const [l, t, r, b] = v as number[];
  return l >= 0 && t >= 0 && r <= 1 && b <= 1 && l < r && t < b ? [l, t, r, b] : null;
}

/** Entries with a usable id, first occurrence wins; the rest are reported. */
function collect<T extends { id: string }>(kind: string, raw: unknown, read: (d: Dict, id: string) => T | null, warn: (m: string) => void): T[] {
  const out: T[] = [];
  const seen = new Set<string>();
  list(raw).forEach((entry, i) => {
    const id = isDict(entry) ? slug(entry.id) : null;
    if (!id) return warn(`${kind} #${i}: no usable id, ignored`);
    if (seen.has(id)) return warn(`${kind} ${id}: listed twice, second entry ignored`);
    const item = read(entry as Dict, id);
    if (!item) return;
    seen.add(id);
    out.push(item);
  });
  return out;
}

/** Checks a manifest that was read from JSON. Structural problems fail; bad entries are dropped with a warning. */
export function parseManifest(raw: unknown): ManifestResult {
  const wrongShape = (message: string): ManifestResult => ({ ok: false, error: { kind: 'shape', message } });
  if (!isDict(raw)) return wrongShape('the manifest is not a JSON object');
  if (raw.version !== 1) return wrongShape(`unsupported manifest version ${JSON.stringify(raw.version)} (this page reads version 1)`);

  const warnings: string[] = [];
  const warn = (m: string) => void warnings.push(m);

  const frameRaw = isDict(raw.frame) ? raw.frame : {};
  const fw = positive(frameRaw.w), fh = positive(frameRaw.h);
  if (!fw || !fh) return wrongShape('the manifest has no frame size');

  const formats = PLATE_FORMATS.filter((f) => list(raw.formats).includes(f));
  // the manifest's own order (best first)
  formats.sort((a, b) => list(raw.formats).indexOf(a) - list(raw.formats).indexOf(b));
  if (!formats.length) return wrongShape('the manifest lists no image format this page can show (avif, webp)');

  // sizes are optional: a manifest without them has the full frame only
  const sizes: PlateSize[] = [];
  list(raw.sizes).forEach((s, i) => {
    const w = isDict(s) ? positive(s.w) : null;
    const suffix = isDict(s) && typeof s.suffix === 'string' && SUFFIX.test(s.suffix) ? s.suffix : null;
    if (!w || suffix === null) return warn(`size #${i}: needs a width and a plain suffix, ignored`);
    if (sizes.some((x) => x.suffix === suffix)) return warn(`size #${i}: suffix "${suffix}" listed twice, ignored`);
    sizes.push({ w, suffix });
  });
  if (!sizes.length) sizes.push({ w: fw, suffix: '' });
  sizes.sort((a, b) => b.w - a.w);

  const factoryWheel = slug(raw.factoryWheel) ?? DEFAULT_FACTORY_WHEEL;

  const views = collect<PlateView>('view', raw.views, (d, id) => ({ id, label: text(d.label) || id }), warn);
  if (!views.length) return wrongShape('the manifest lists no views');

  const paints = collect<PlatePaint>(
    'paint',
    raw.paints,
    (d, id) => {
      const hex = text(d.hex);
      if (!HEX.test(hex)) {
        warn(`paint ${id}: no usable colour (${JSON.stringify(d.hex)}), ignored`);
        return null;
      }
      let finish = text(d.finish).toLowerCase() as PaintFinish;
      if (!PAINT_FINISHES.includes(finish)) {
        warn(`paint ${id}: unknown finish ${JSON.stringify(d.finish)}, shown as solid`);
        finish = 'solid';
      }
      const code = text(d.code);
      return { id, name: text(d.name) || id, code: NO_CODE.test(code) ? '' : code, group: text(d.group), finish, hex };
    },
    warn
  );

  const wheels = collect<PlateWheel>(
    'wheel',
    raw.wheels,
    (d, id) => ({
      id,
      name: text(d.name) || id,
      finishes: collect<PlateFinish>(`wheel ${id} finish`, d.finishes, (f, fid) => ({ id: fid, name: text(f.name) || fid, hex: HEX.test(text(f.hex)) ? text(f.hex) : '#888888' }), warn)
    }),
    warn
  );

  const paintIds = new Set(paints.map((p) => p.id));
  const wheelKeys = new Set<string>([factoryWheel]);
  for (const w of wheels) for (const f of w.finishes) wheelKeys.add(wheelPlateKey(w.id, f.id));

  const cars = collect<PlateCar>(
    'car',
    raw.cars,
    (d, id) => {
      const platesRaw = isDict(d.plates) ? d.plates : {};
      const plates: Record<string, PlateSet> = {};
      for (const view of views) {
        const set = isDict(platesRaw[view.id]) ? (platesRaw[view.id] as Dict) : {};
        const body: string[] = [];
        for (const p of list(set.body)) {
          if (typeof p === 'string' && paintIds.has(p)) {
            if (!body.includes(p)) body.push(p);
          } else warn(`car ${id}, view ${view.id}: body plate for unknown paint ${JSON.stringify(p)}, ignored`);
        }
        const wheelPlates: Record<string, PlateBox> = {};
        for (const [key, boxRaw] of Object.entries(isDict(set.wheels) ? set.wheels : {})) {
          if (!wheelKeys.has(key)) {
            warn(`car ${id}, view ${view.id}: wheel plate ${JSON.stringify(key)} is not a wheel and finish of this manifest, ignored`);
            continue;
          }
          const box = parseBox(boxRaw);
          if (!box) {
            warn(`car ${id}, view ${view.id}: wheel plate ${key} has no usable box, ignored`);
            continue;
          }
          wheelPlates[key] = box;
        }
        plates[view.id] = { body, wheels: wheelPlates };
      }
      for (const key of Object.keys(platesRaw)) if (!views.some((v) => v.id === key)) warn(`car ${id}: plates for unknown view ${JSON.stringify(key)}, ignored`);
      const defaultPaint = slug(d.defaultPaint);
      if (!defaultPaint || !paintIds.has(defaultPaint)) warn(`car ${id}: default paint ${JSON.stringify(d.defaultPaint)} is not a paint of this manifest`);
      return { id, label: text(d.label) || id, chassis: text(d.chassis), defaultPaint: defaultPaint && paintIds.has(defaultPaint) ? defaultPaint : '', plates };
    },
    warn
  );

  return {
    ok: true,
    manifest: { version: 1, frame: { w: fw, h: fh }, formats, sizes, factoryWheel, placeholder: raw.placeholder === true, views, paints, wheels, cars },
    warnings
  };
}

export const manifestUrl = (base: string) => `${base.replace(/\/+$/, '')}/manifest.json`;

/**
 * Fetches and checks the manifest. Never throws: every failure comes back as `{ ok: false, error }`
 * with its kind (see ManifestError). The request revalidates with the server (`no-cache`), so new
 * plates show up without waiting for a cache to expire.
 */
export async function loadManifest(base: string, opts: { fetch?: typeof fetch; signal?: AbortSignal } = {}): Promise<ManifestResult> {
  const url = manifestUrl(base);
  const reason = (e: unknown) => (e instanceof Error ? e.message : String(e));
  let response: Response;
  try {
    response = await (opts.fetch ?? fetch)(url, { cache: 'no-cache', signal: opts.signal });
  } catch (e) {
    return { ok: false, error: { kind: 'network', message: `${url} could not be reached: ${reason(e)}` } };
  }
  if (!response.ok) return { ok: false, error: { kind: 'http', status: response.status, message: `${url} answered ${response.status}` } };
  let body: unknown;
  try {
    body = await response.json();
  } catch (e) {
    return { ok: false, error: { kind: 'json', message: `${url} is not JSON: ${reason(e)}` } };
  }
  return parseManifest(body);
}

const primed = new Map<string, Promise<ManifestResult>>();

/**
 * Starts loading the manifest ahead of the page that will read it (Root.tsx calls this while the
 * configurator's code is still downloading). `takePrimedManifest` hands the request over, once.
 */
export function primeManifest(base: string): void {
  if (!primed.has(base)) primed.set(base, loadManifest(base));
}

/** The request `primeManifest` started for this base, if any; a second call (a retry) gets nothing and loads afresh. */
export function takePrimedManifest(base: string): Promise<ManifestResult> | undefined {
  const request = primed.get(base);
  primed.delete(base);
  return request;
}
