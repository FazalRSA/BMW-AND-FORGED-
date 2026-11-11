/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Frame, StagedFrame, dropHiddenFrames, frameImages, layersOf, sameFrame, stageFrame } from '../../services/plates/frames';
import type { PlateLoader } from '../../services/plates/loader';
import type { PlateBox } from '../../services/plates/manifest';
import { cx } from '../journey/ui';
import { usePrefersReducedMotion } from './hooks';

/** How long a picture takes to fade in over the one before it. */
export const PLATE_FADE_MS = 320;
/** A picture that takes longer than this to arrive gets the progress hint. */
const PROGRESS_HINT_AFTER_MS = 150;

export interface PlateStageProps {
  /** The pictures to show. Null while there is nothing to show yet. */
  frame: Frame | null;
  loader: PlateLoader;
  /** Frame width divided by height (16 / 9): the stage keeps this shape whether or not a picture is in it. */
  aspectRatio: number;
  /** Names the configuration, for people who cannot see the picture. */
  description: string;
  /** Set on the pictures when the plates come from another origin (the same value the loader uses). */
  crossOrigin?: 'anonymous';
  /** The frame is on the stage (all of its pictures decoded). */
  onShown?: (frame: Frame) => void;
  /** Pictures of the frame could not be loaded (their plate paths): the stage keeps the last good picture. */
  onFailed?: (frame: Frame, failedPlates: string[]) => void;
  className?: string;
}

const percent = (fraction: number) => `${(fraction * 100).toFixed(4)}%`;
const boxStyle = ([left, top, right, bottom]: PlateBox): React.CSSProperties => ({
  left: percent(left),
  top: percent(top),
  width: percent(right - left),
  height: percent(bottom - top)
});

/**
 * The picture: a body plate with a wheel plate laid over it at the manifest's box.
 *
 * A new frame is loaded and decoded off screen first, then faded in over the one on stage, so a
 * half-loaded picture is never shown. A paint change fades only the body layer, a wheel change only the
 * wheel layer, and another car or view the whole picture (services/plates/frames.ts `layersOf`).
 * The stage reserves its shape, so nothing around it moves when pictures arrive.
 */
export const PlateStage: React.FC<PlateStageProps> = ({ frame, loader, aspectRatio, description, crossOrigin, onShown, onFailed, className }) => {
  const reducedMotion = usePrefersReducedMotion();
  const fadeMs = reducedMotion ? 0 : PLATE_FADE_MS;
  const [staged, setStaged] = useState<StagedFrame[]>([]);
  const [waiting, setWaiting] = useState(false);
  const stagedRef = useRef(staged);
  stagedRef.current = staged;
  /** Counts requests, so pictures that arrive for a frame the customer has moved on from are ignored. */
  const latestRequest = useRef(0);
  const callbacks = useRef({ onShown, onFailed });
  callbacks.current = { onShown, onFailed };

  useEffect(() => {
    if (!frame) return;
    const request = ++latestRequest.current;
    if (sameFrame(stagedRef.current[stagedRef.current.length - 1], frame)) {
      // back on the picture that is showing: whatever was on its way is no longer wanted
      setWaiting(false);
      return;
    }
    const images = frameImages(frame);
    const hint = images.every((image) => loader.ready(image.url)) ? undefined : setTimeout(() => request === latestRequest.current && setWaiting(true), PROGRESS_HINT_AFTER_MS);
    Promise.allSettled(images.map((image) => loader.load(image.url))).then((results) => {
      clearTimeout(hint);
      if (request !== latestRequest.current) return;
      setWaiting(false);
      const failedPlates = images.filter((_, index) => results[index].status === 'rejected').map((image) => image.plate);
      if (failedPlates.length) {
        callbacks.current.onFailed?.(frame, failedPlates);
        return;
      }
      const now = performance.now();
      setStaged((current) => stageFrame(dropHiddenFrames(current, now, fadeMs), frame, now));
      callbacks.current.onShown?.(frame);
      // once the new picture has faded in, the ones under it are taken off the stage (the timer is left to
      // run when another frame follows: that frame drops hidden frames itself as it is staged)
      setTimeout(() => setStaged((current) => dropHiddenFrames(current, performance.now(), fadeMs)), fadeMs + 40);
    });
    return () => clearTimeout(hint);
    // the frame is identified by its files, not by the object
  }, [frame?.group, frame?.body.url, frame?.wheel?.url, loader, fadeMs]);

  const groups = useMemo(() => layersOf(staged), [staged]);
  const empty = staged.length === 0;
  const shown = staged[staged.length - 1];

  return (
    <div
      role="img"
      aria-label={description}
      aria-busy={waiting || (empty && !!frame)}
      // which plates are on the stage, for the render harness (scripts/render/plates.cjs)
      data-plate-stage={shown ? [shown.body.plate, shown.wheel?.plate].filter(Boolean).join(' ') : ''}
      className={cx('plate-stage relative w-full overflow-hidden', className)}
      style={{ aspectRatio: String(aspectRatio), ['--plate-fade' as string]: `${Math.max(fadeMs, 1)}ms` }}
    >
      {groups.map((group, index) => (
        // the very first picture fades in from the empty stage; later groups fade in over the one below
        <div key={`group-${group.id}`} className={cx('absolute inset-0', (group.enter || index === 0) && 'plate-enter')}>
          {group.bodies.map((body) => (
            <img
              key={`body-${body.id}`}
              src={body.url}
              alt=""
              draggable={false}
              decoding="sync"
              crossOrigin={crossOrigin}
              className={cx('absolute inset-0 h-full w-full select-none', body.enter && 'plate-enter')}
            />
          ))}
          {group.wheels.map((wheel) => (
            <img
              key={`wheel-${wheel.id}`}
              src={wheel.url}
              alt=""
              draggable={false}
              decoding="sync"
              crossOrigin={crossOrigin}
              data-plate-layer="wheel"
              className={cx('absolute select-none', wheel.leave ? 'plate-leave' : wheel.enter && 'plate-enter')}
              style={boxStyle(wheel.box)}
            />
          ))}
        </div>
      ))}
      {(waiting || (empty && !!frame)) && <div className="plate-progress" aria-hidden />}
    </div>
  );
};

/**
 * A frame as a still picture (the summary): the same two layers, no transitions. Lazy: it loads when it
 * nears the screen. A picture that fails to load leaves its place empty instead of a broken-image icon.
 */
export const PlateStill: React.FC<{ frame: Frame; description: string; crossOrigin?: 'anonymous'; className?: string }> = ({ frame, description, crossOrigin, className }) => {
  const hide = (event: React.SyntheticEvent<HTMLImageElement>) => (event.currentTarget.style.visibility = 'hidden');
  return (
    <div role="img" aria-label={description} className={cx('relative h-full w-full overflow-hidden', className)}>
      <img src={frame.body.url} alt="" loading="lazy" decoding="async" draggable={false} crossOrigin={crossOrigin} onError={hide} className="absolute inset-0 h-full w-full select-none" />
      {frame.wheel && (
        <img src={frame.wheel.url} alt="" loading="lazy" decoding="async" draggable={false} crossOrigin={crossOrigin} onError={hide} className="absolute select-none" style={boxStyle(frame.wheel.box)} />
      )}
    </div>
  );
};
