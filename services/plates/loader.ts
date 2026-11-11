/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Loads plates off screen so the stage only ever swaps in a picture that is fully decoded.
 *
 * - `load(url)` is for the picture the customer is waiting for: it starts at once.
 * - `warm(urls)` is for pictures they are likely to ask for next (the neighbouring views, the swatch
 *   under the pointer). At most `concurrency` of these download at a time, and each call replaces the
 *   list of those not started yet, so intent that has moved on costs nothing. It never preloads a set.
 *
 * Decoded pictures are kept (the most recent `keep`) so that going back to one is instant.
 * The image factory is injectable, so this runs in tests without a DOM.
 */

/** The part of HTMLImageElement the loader uses. */
export interface LoadableImage {
  src: string;
  crossOrigin: string | null;
  decoding?: string;
  onload: ((this: never, ev: never) => unknown) | null;
  onerror: ((this: never, ev: never) => unknown) | null;
  decode?: () => Promise<void>;
}

export interface PlateLoader {
  /** Resolves when the picture is downloaded and decoded; rejects when it cannot be loaded (it can be asked for again). */
  load(url: string): Promise<void>;
  /** Replaces the list of pictures to warm in the background. */
  warm(urls: string[]): void;
  /** True when the picture is decoded and kept. */
  ready(url: string): boolean;
}

export interface PlateLoaderOptions {
  /** Background downloads at a time (default 2). */
  concurrency?: number;
  /** Decoded pictures kept (default 24: a few views of a few paints and wheels). */
  keep?: number;
  /** Set on every image, e.g. 'anonymous' for plates on another origin (the PDF draws them onto a canvas). */
  crossOrigin?: string | null;
  createImage?: () => LoadableImage;
}

interface Entry {
  promise: Promise<void>;
  /** Held so the browser keeps the decoded picture. */
  image: LoadableImage;
  done: boolean;
}

export function createPlateLoader(opts: PlateLoaderOptions = {}): PlateLoader {
  const concurrency = Math.max(1, opts.concurrency ?? 2);
  const keep = Math.max(1, opts.keep ?? 24);
  const createImage = opts.createImage ?? (() => new Image() as unknown as LoadableImage);
  const entries = new Map<string, Entry>(); // least recently used first
  let queue: string[] = [];
  let warming = 0;

  const trim = () => {
    for (const [url, e] of entries) {
      if (entries.size <= keep) break;
      if (e.done) entries.delete(url);
    }
  };

  const start = (url: string): Promise<void> => {
    const known = entries.get(url);
    if (known) {
      // most recently used last
      entries.delete(url);
      entries.set(url, known);
      return known.promise;
    }
    const image = createImage();
    if (opts.crossOrigin !== undefined) image.crossOrigin = opts.crossOrigin;
    image.decoding = 'async';
    const entry: Entry = { image, done: false, promise: Promise.resolve() };
    entry.promise = new Promise<void>((resolve, reject) => {
      const fail = () => reject(new Error(`could not load ${url}`));
      image.src = url;
      if (typeof image.decode === 'function') image.decode().then(resolve, fail);
      else {
        image.onload = () => resolve();
        image.onerror = fail;
      }
    }).then(
      () => {
        entry.done = true;
        trim();
      },
      (err) => {
        // forgotten, so the next request tries again
        if (entries.get(url) === entry) entries.delete(url);
        throw err;
      }
    );
    entries.set(url, entry);
    return entry.promise;
  };

  const pump = () => {
    while (warming < concurrency && queue.length) {
      const url = queue.shift()!;
      if (entries.has(url)) continue;
      warming++;
      start(url)
        .catch(() => undefined) // a picture that fails to warm is simply loaded when it is asked for
        .then(() => {
          warming--;
          pump();
        });
    }
  };

  return {
    load(url) {
      queue = queue.filter((u) => u !== url);
      return start(url);
    },
    warm(urls) {
      queue = [...new Set(urls)].filter((u) => !entries.has(u));
      pump();
    },
    ready: (url) => entries.get(url)?.done === true
  };
}
