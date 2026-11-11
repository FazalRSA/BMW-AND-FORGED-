/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { PlateCatalog } from './catalog';
import { PlateBox, PlateFormat, PlateSize, bodyPlatePath, wheelPlatePath } from './manifest';
import { Selection, wheelLayer } from './selection';

/**
 * From a selection to the picture: the files to fetch (a "frame": one body plate and at most one wheel
 * plate with its box) and the layers to draw while one frame gives way to the next.
 *
 * Pure: no DOM. Tested in tests/plates/frames.test.ts.
 */

/** Where and in which encoding the plates are fetched. */
export interface PlateSource {
  base: string;
  format: PlateFormat;
  size: PlateSize;
}

/** One picture file. */
export interface PlateImage {
  /** The plate's path (manifest.ts bodyPlatePath / wheelPlatePath): names the plate whatever its size or format. */
  plate: string;
  url: string;
}

export interface WheelPlateImage extends PlateImage {
  box: PlateBox;
}

/** The pictures of one combination. */
export interface Frame {
  /** Car and view: frames of one group share the camera, so their layers line up. */
  group: string;
  body: PlateImage;
  wheel: WheelPlateImage | null;
}

const plateUrl = (source: PlateSource, platePath: string) => `${source.base}/${platePath}${source.size.suffix}.${source.format}`;

export function frameFor(catalog: PlateCatalog, selection: Selection, source: PlateSource): Frame {
  const bodyPath = bodyPlatePath(selection.car, selection.view, selection.paint);
  const layer = wheelLayer(catalog, selection);
  const wheelPath = layer && wheelPlatePath(selection.car, selection.view, layer.key);
  return {
    group: `${selection.car}/${selection.view}`,
    body: { plate: bodyPath, url: plateUrl(source, bodyPath) },
    wheel: layer && wheelPath ? { plate: wheelPath, url: plateUrl(source, wheelPath), box: layer.box } : null
  };
}

export const frameImages = (frame: Frame): PlateImage[] => (frame.wheel ? [frame.body, frame.wheel] : [frame.body]);

export const sameFrame = (a: Frame | null | undefined, b: Frame | null | undefined): boolean =>
  !!a && !!b && a.group === b.group && a.body.url === b.body.url && (a.wheel?.url ?? null) === (b.wheel?.url ?? null);

/**
 * The encoded size to fetch for a stage `cssWidth` wide on a screen of the given pixel ratio: the
 * smallest that is at least as wide as the stage in device pixels, else the largest there is.
 * `atLeast` keeps a size already in use (a bigger picture is never swapped for a smaller one on resize).
 */
export function pickSize(sizes: PlateSize[], cssWidth: number, pixelRatio: number, atLeast?: PlateSize): PlateSize {
  const neededWidth = Math.max(cssWidth * Math.min(Math.max(pixelRatio, 1), 3), atLeast?.w ?? 0);
  const smallestFirst = [...sizes].sort((a, b) => a.w - b.w);
  return smallestFirst.find((size) => size.w >= neededWidth) ?? smallestFirst[smallestFirst.length - 1];
}

// ----------------------------------------------------
// Layers on the stage
// ----------------------------------------------------

/** A frame that has been put on the stage (all of its pictures were decoded first). */
export interface StagedFrame extends Frame {
  /** When it was put on the stage (ms, any monotonic clock). */
  stagedAt: number;
  /** Identity of its group, body and wheel layers. A frame that keeps a layer of the frame before it has the same number, so the element stays. */
  groupId: number;
  bodyId: number;
  wheelId: number | null;
}

/** Adds `next` on top of the frames on stage. Layers it shares with the top frame keep their identity. */
export function stageFrame(staged: StagedFrame[], next: Frame, now: number): StagedFrame[] {
  const top = staged[staged.length - 1];
  const highestId = staged.reduce((highest, frame) => Math.max(highest, frame.groupId, frame.bodyId, frame.wheelId ?? 0), 0);
  const sameGroup = !!top && top.group === next.group;
  return [
    ...staged,
    {
      ...next,
      stagedAt: now,
      groupId: sameGroup ? top.groupId : highestId + 1,
      bodyId: sameGroup && top.body.url === next.body.url ? top.bodyId : highestId + 2,
      wheelId: !next.wheel ? null : sameGroup && top.wheel?.url === next.wheel.url ? top.wheelId : highestId + 3
    }
  ];
}

/** Drops the frames hidden under a frame that has finished fading in (`fadeMs` after it was staged). */
export function dropHiddenFrames(staged: StagedFrame[], now: number, fadeMs: number): StagedFrame[] {
  for (let index = staged.length - 1; index > 0; index--) if (now - staged[index].stagedAt >= fadeMs) return staged.slice(index);
  return staged;
}

export interface BodyLayer {
  id: number;
  url: string;
  /** Fades in over the layer below it. */
  enter: boolean;
}

export interface WheelLayer {
  id: number;
  url: string;
  box: PlateBox;
  enter: boolean;
  /** Fades out: the frame above it has no wheel plate (the factory look of the body plate shows). */
  leave: boolean;
}

export interface GroupLayer {
  id: number;
  /** Fades in, as a whole, over the group below it (another car or view). */
  enter: boolean;
  bodies: BodyLayer[];
  wheels: WheelLayer[];
}

/**
 * The layers to draw for the frames on stage, bottom first. Within a group (one car and view) a new
 * paint fades its body plate in over the old one while the wheel plate stays put, and a new wheel
 * fades in over the old wheel while the body stays put. A new car or view is a new group, which fades
 * in whole, so a wheel plate is never seen over a body plate from another camera.
 */
export function layersOf(staged: StagedFrame[]): GroupLayer[] {
  const groups: GroupLayer[] = [];
  let previousInGroup: StagedFrame | undefined;
  for (const frame of staged) {
    let group = groups[groups.length - 1];
    if (!group || group.id !== frame.groupId) {
      group = { id: frame.groupId, enter: groups.length > 0, bodies: [], wheels: [] };
      groups.push(group);
      previousInGroup = undefined;
    }
    if (!group.bodies.some((body) => body.id === frame.bodyId)) group.bodies.push({ id: frame.bodyId, url: frame.body.url, enter: group.bodies.length > 0 });
    if (frame.wheel && frame.wheelId !== null) {
      // the wheel of a group's first frame appears with the group; later ones fade in over what is there
      const wheelId = frame.wheelId;
      if (!group.wheels.some((wheel) => wheel.id === wheelId)) group.wheels.push({ id: wheelId, url: frame.wheel.url, box: frame.wheel.box, enter: !!previousInGroup, leave: false });
    } else for (const wheel of group.wheels) wheel.leave = true;
    previousInGroup = frame;
  }
  return groups;
}
