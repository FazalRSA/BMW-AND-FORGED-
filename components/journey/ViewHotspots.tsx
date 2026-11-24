import React, { useEffect, useLayoutEffect, useRef } from 'react';
import type { CameraViewPreset, PaintColor } from '../../types';
import { recolouredNow } from '../../services/renderedBody';
import { cx } from './ui';

/**
 * The rendered azimuths a drag can step through, in the order a drag to the right reaches them (the camera orbits
 * towards the front). A car has no frame behind it (180 degrees) or on its left side, and the frames are not mirrored:
 * the plate, the lettering and the studio's key light would read backwards.
 */
export const TURN_VIEWS: CameraViewPreset[] = ['rearThreeQuarter', 'side', 'frontThreeQuarter', 'front'];

/** The view just left (body and wheel layer as they were), drawn over the new one and faded out in 0.3 s. */
export const FadeOutFrame: React.FC<{ carId: string; view: CameraViewPreset; paint: PaintColor; layer: { url: string; box: Box } | null }> = ({ carId, view, paint, layer }) => {
  const ref = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  useLayoutEffect(() => {
    const img = recolouredNow(carId, view, paint);
    const c = canvas.current;
    if (!img || !c) return void (ref.current && (ref.current.style.display = 'none'));
    c.width = img.width;
    c.height = img.height;
    c.getContext('2d')?.putImageData(img, 0, 0);
  }, [carId, view, paint]);
  useEffect(() => {
    ref.current?.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 300, easing: 'ease-out', fill: 'forwards' });
  }, []);
  return (
    <div ref={ref} className="absolute inset-0">
      <canvas ref={canvas} style={{ width: '100%', height: '100%' }} />
      {layer && (
        <img
          src={layer.url}
          alt=""
          draggable={false}
          className="absolute"
          style={{ left: `${layer.box[0] * 100}%`, top: `${layer.box[1] * 100}%`, width: `${(layer.box[2] - layer.box[0]) * 100}%`, height: `${(layer.box[3] - layer.box[1]) * 100}%` }}
        />
      )}
    </div>
  );
};

/**
 * The camera views as hotspots over the car: a small white circle labelled with the view name, on a thin white leader
 * line to the part of the car it shows (Front: the nose, Side: the door, Rear: the tail, Wheel: the front wheel, Top: the
 * roof). They sit on the Cycles stage (App.tsx computeStage), so every position is a fraction of that frame. The frames
 * are the same camera for every car, so one table of anchors fits them all; the Wheel anchor comes from the wheel
 * layer's own box (public/renders/wheels.json) when there is one.
 */
export type Box = [number, number, number, number];
export type StageRect = { left: number; top: number; width: number; height: number };

export const HOTSPOTS: { id: CameraViewPreset; label: string }[] = [
  { id: 'frontThreeQuarter', label: 'Front' },
  { id: 'side', label: 'Side' },
  { id: 'rearThreeQuarter', label: 'Rear' },
  { id: 'frontWheel', label: 'Wheel' },
  { id: 'top', label: 'Top' }
];
type Target = 'Front' | 'Side' | 'Rear' | 'Wheel' | 'Top';
/** [anchor x, anchor y, label x, label y]: fractions of the stage, from its top left. The label sits in the black beside the car. */
type Pin = [number, number, number, number];

const PINS: Partial<Record<CameraViewPreset, Record<Target, Pin>>> = {
  frontThreeQuarter: { Front: [0.31, 0.52, 0.17, 0.26], Top: [0.53, 0.32, 0.5, 0.17], Rear: [0.73, 0.5, 0.82, 0.27], Wheel: [0.3, 0.64, 0.17, 0.86], Side: [0.55, 0.52, 0.56, 0.86] },
  side: { Front: [0.2, 0.46, 0.17, 0.2], Top: [0.5, 0.31, 0.5, 0.14], Rear: [0.8, 0.42, 0.83, 0.2], Wheel: [0.25, 0.55, 0.22, 0.82], Side: [0.52, 0.56, 0.58, 0.82] },
  rearThreeQuarter: { Front: [0.29, 0.47, 0.17, 0.26], Top: [0.48, 0.31, 0.45, 0.16], Rear: [0.68, 0.5, 0.82, 0.28], Wheel: [0.26, 0.63, 0.17, 0.86], Side: [0.43, 0.58, 0.5, 0.86] },
  front: { Front: [0.4, 0.51, 0.2, 0.36], Top: [0.5, 0.33, 0.5, 0.14], Rear: [0.56, 0.35, 0.8, 0.22], Wheel: [0.355, 0.66, 0.2, 0.82], Side: [0.635, 0.5, 0.82, 0.62] },
  frontWheel: { Front: [0.1, 0.2, 0.1, 0.07], Top: [0.5, 0.1, 0.5, 0.05], Rear: [0.9, 0.2, 0.88, 0.07], Wheel: [0.6, 0.52, 0.5, 0.9], Side: [0.9, 0.5, 0.88, 0.75] },
  top: { Front: [0.3, 0.72, 0.14, 0.8], Top: [0.545, 0.42, 0.22, 0.2], Rear: [0.7, 0.22, 0.88, 0.14], Wheel: [0.42, 0.68, 0.55, 0.9], Side: [0.6, 0.55, 0.86, 0.7] }
};

/** The front wheel's hub from the wheel layer's box (fractions of the frame), per view (where the front wheel sits in that box). */
const WHEEL_IN_BOX: Partial<Record<CameraViewPreset, [number, number]>> = {
  side: [0.115, 0.5],
  frontThreeQuarter: [0.4, 0.59],
  rearThreeQuarter: [0.09, 0.36],
  frontWheel: [0.38, 0.46]
};

export const ViewHotspots: React.FC<{
  view: CameraViewPreset;
  stage: StageRect;
  /** The wheel layer's box for this car and view, when it has one */
  wheelBox?: Box | null;
  /** True while the view is changing or being dragged: the hotspots fade out and stop taking taps */
  hidden: boolean;
  onCamera: (view: CameraViewPreset) => void;
}> = ({ view, stage, wheelBox, hidden, onCamera }) => {
  const pins = PINS[view];
  if (!pins) return null;
  const k = WHEEL_IN_BOX[view];
  const wheelPin: Pin = wheelBox && k ? [wheelBox[0] + k[0] * (wheelBox[2] - wheelBox[0]), wheelBox[1] + k[1] * (wheelBox[3] - wheelBox[1]), pins.Wheel[2], pins.Wheel[3]] : pins.Wheel;
  const pct = (n: number) => `${(n * 100).toFixed(2)}%`;
  return (
    <div
      className={cx('absolute z-20 pointer-events-none transition-opacity duration-300', hidden ? 'opacity-0' : 'opacity-100 delay-100')}
      style={stage}
    >
      <svg aria-hidden className="absolute inset-0 h-full w-full overflow-visible">
        {HOTSPOTS.map((h) => {
          const [ax, ay, lx, ly] = h.label === 'Wheel' ? wheelPin : pins[h.label as Target];
          const on = h.id === view;
          return (
            <g key={h.id} stroke="white" strokeOpacity={on ? 0.95 : 0.55} strokeWidth={1}>
              <line x1={pct(lx)} y1={pct(ly)} x2={pct(ax)} y2={pct(ay)} stroke="black" strokeOpacity={0.35} strokeWidth={3} vectorEffect="non-scaling-stroke" />
              <line x1={pct(lx)} y1={pct(ly)} x2={pct(ax)} y2={pct(ay)} vectorEffect="non-scaling-stroke" />
              <circle cx={pct(ax)} cy={pct(ay)} r={2} fill="white" stroke="none" fillOpacity={on ? 1 : 0.8} />
            </g>
          );
        })}
      </svg>
      {HOTSPOTS.map((h) => {
        const [, , lx, ly] = h.label === 'Wheel' ? wheelPin : pins[h.label as Target];
        const on = h.id === view;
        const flip = lx > 0.62; // the name reads towards the middle of the stage, never off its edge
        return (
          <button
            key={h.id}
            type="button"
            aria-label={h.label}
            aria-pressed={on}
            tabIndex={hidden ? -1 : 0}
            onClick={() => onCamera(h.id)}
            className={cx('group absolute h-11 w-11 -translate-x-1/2 -translate-y-1/2 outline-none', hidden ? 'pointer-events-none' : 'pointer-events-auto')}
            style={{ left: pct(lx), top: pct(ly) }}
          >
            <span
              className={cx(
                'absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full ring-1 ring-white transition-all duration-200 ease-lux',
                'group-hover:scale-125 group-focus-visible:ring-2 group-focus-visible:ring-offset-2 group-focus-visible:ring-offset-black',
                on ? 'bg-white shadow-[0_0_0_4px_rgba(255,255,255,0.18)]' : 'bg-white/25 backdrop-blur-sm'
              )}
            />
            <span
              className={cx(
                'absolute top-1/2 -translate-y-1/2 whitespace-nowrap rounded-full bg-black/55 px-2 py-[3px] text-[10px] font-semibold uppercase leading-none tracking-[0.14em] text-white backdrop-blur-sm',
                flip ? 'right-[calc(50%+9px)]' : 'left-[calc(50%+9px)]',
                on ? 'opacity-100' : 'opacity-80 group-hover:opacity-100'
              )}
              aria-hidden
            >
              {h.label}
            </span>
          </button>
        );
      })}
    </div>
  );
};
