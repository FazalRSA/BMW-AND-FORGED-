/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { ArrowRight, ArrowUpRight, Mail } from 'lucide-react';
import { Region, formatMoney } from '../../config/brand';
import type { WheelFinish } from '../../types';
import { finishSurcharge, rimPrice } from '../../services/pricing';
import { ConfigCar, ConfigWheel, PAINT_FINISH_LABEL, paintDetail } from '../../services/plates/catalog';
import type { PlatePaint } from '../../services/plates/manifest';
import { FACTORY_WHEEL, Option, PaintGroup, WantedSelection } from '../../services/plates/selection';
import { Button, FinishChip, RimPhotoThumb, cx } from '../journey/ui';
import { OptionChip, Section, SwatchButton, TileButton } from './controls';
import { paintSwatchStyle } from './paintSwatch';

export interface OptionsPanelProps {
  cars: Option<ConfigCar>[];
  paintGroups: PaintGroup[];
  wheels: Option<ConfigWheel>[];
  finishes: Option<WheelFinish>[];
  /** The current choices (undefined: the factory wheel, which has no design, finish or size). */
  paint?: PlatePaint;
  wheel?: ConfigWheel;
  finish?: WheelFinish;
  factoryWheelSelected: boolean;
  sizes: string[];
  size?: string;
  region: Region;
  onChange: (change: WantedSelection) => void;
  /** The pointer or focus reached an option: its picture may be fetched ahead of the click. */
  onIntent: (change: WantedSelection) => void;
  /** An option whose picture is not rendered yet was pressed; `what` names it. */
  onUnavailable: (what: string) => void;
  onSize: (size: string) => void;
  onWheelDetails: (wheel: ConfigWheel) => void;
}

/** A ring standing in for a wheel without a picture (and for the car's own wheels): no logo, no badge. */
const WheelRing: React.FC = () => (
  <span aria-hidden className="block h-[46px] w-[46px] rounded-full border border-mute/60 p-[7px]">
    <span className="block h-full w-full rounded-full border border-mute/40" />
  </span>
);

/**
 * The choices: car, paint (grouped by finish type), wheel, finish, size. Presentational: what is
 * available comes in as options, every change goes out through `onChange`.
 */
export const OptionsPanel: React.FC<OptionsPanelProps> = (p) => {
  const somePaintsNotPictured = p.paintGroups.some((group) => group.options.some((option) => !option.available));
  return (
    <>
      {p.cars.length > 1 && (
        <Section title="Car">
          <div className="flex flex-wrap gap-2">
            {p.cars.map((car) => (
              <OptionChip
                key={car.id}
                option={{
                  label: car.value.model.name,
                  selected: car.selected,
                  available: car.available,
                  onSelect: () => p.onChange({ car: car.id }),
                  onIntent: () => p.onIntent({ car: car.id }),
                  onUnavailable: () => p.onUnavailable(car.value.model.name)
                }}
              >
                {car.value.shortName}
              </OptionChip>
            ))}
          </div>
        </Section>
      )}

      <Section
        title="Paint"
        value={
          p.paint && (
            <>
              {p.paint.name}
              <span className="text-mute"> · {paintDetail(p.paint)}</span>
            </>
          )
        }
      >
        <div className="space-y-3">
          {p.paintGroups.map((group) => (
            <div key={group.finish} role="group" data-options="paints" aria-label={`${PAINT_FINISH_LABEL[group.finish]} paints`}>
              <div className="mb-1 text-[11px] text-mute">{PAINT_FINISH_LABEL[group.finish]}</div>
              <div className="-mx-1.5 grid grid-cols-[repeat(auto-fill,minmax(44px,1fr))]">
                {group.options.map((paint) => (
                  <SwatchButton
                    key={paint.id}
                    swatchStyle={paintSwatchStyle(paint.value.hex, paint.value.finish)}
                    option={{
                      label: [paint.value.name, paint.value.code && `(${paint.value.code})`].filter(Boolean).join(' '),
                      selected: paint.selected,
                      available: paint.available,
                      onSelect: () => p.onChange({ paint: paint.id }),
                      onIntent: () => p.onIntent({ paint: paint.id }),
                      onUnavailable: () => p.onUnavailable(`${paint.value.name} in this view`)
                    }}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
        {somePaintsNotPictured && <p className="mt-3 text-[11px] leading-relaxed text-mute">Colours with a line through them are not pictured in this view yet.</p>}
      </Section>

      <Section title="Wheels" value={p.wheel ? p.wheel.design.name : 'Factory'}>
        <ul data-options="wheels" className="-mx-1 grid grid-cols-4 gap-y-1">
          <li>
            <TileButton
              name="Factory"
              option={{
                label: "The car's factory wheels",
                selected: p.factoryWheelSelected,
                available: true,
                onSelect: () => p.onChange({ wheel: FACTORY_WHEEL }),
                onIntent: () => p.onIntent({ wheel: FACTORY_WHEEL })
              }}
            >
              <WheelRing />
            </TileButton>
          </li>
          {p.wheels.map((wheel) => (
            <li key={wheel.id} className="min-w-0">
              <TileButton
                name={wheel.value.design.name}
                option={{
                  label: `${wheel.value.design.name}, ${wheel.value.design.subtitle}`,
                  selected: wheel.selected,
                  available: wheel.available,
                  onSelect: () => p.onChange({ wheel: wheel.id }),
                  onIntent: () => p.onIntent({ wheel: wheel.id }),
                  onUnavailable: () => p.onUnavailable(`${wheel.value.design.name} on this car in this view`)
                }}
              >
                <RimPhotoThumb
                  wheel={wheel.value.design}
                  finish={wheel.selected && p.finish ? p.finish : wheel.value.finishes.find((finish) => finish.id === wheel.value.design.defaultVariant) ?? wheel.value.finishes[0]}
                  size={50}
                  fallback={<WheelRing />}
                />
              </TileButton>
            </li>
          ))}
        </ul>
        {p.wheel && (
          <div className="mt-3 flex items-center justify-between gap-4 rounded-xl bg-ink/[0.04] px-4 py-3">
            <div className="min-w-0">
              <div className="truncate text-[13px] font-medium text-ink">{p.wheel.design.subtitle || p.wheel.design.name}</div>
              <div className="truncate text-[11.5px] text-mute">{p.wheel.design.style}</div>
            </div>
            <button
              type="button"
              onClick={() => p.onWheelDetails(p.wheel!)}
              className="inline-flex min-h-11 shrink-0 items-center gap-1 text-[10.5px] font-semibold uppercase tracking-[0.18em] text-mute transition-colors hover:text-gold"
            >
              Details
              <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={1.6} aria-hidden />
            </button>
          </div>
        )}
      </Section>

      {p.wheel && (
        <Section
          title="Finish"
          value={
            p.finish && (
              <>
                {p.finish.name}
                {p.size && finishSurcharge(p.wheel.design, p.size, p.finish.id) > 0 && (
                  <span className="text-mute"> · +{formatMoney(finishSurcharge(p.wheel.design, p.size, p.finish.id), p.region)}</span>
                )}
              </>
            )
          }
        >
          <ul data-options="finishes" className="-mx-1 grid grid-cols-4 gap-y-1">
            {p.finishes.map((finish) => (
              <li key={finish.id} className="min-w-0">
                <TileButton
                  name={finish.value.name}
                  option={{
                    label: `${finish.value.name} finish`,
                    selected: finish.selected,
                    available: finish.available,
                    onSelect: () => p.onChange({ finish: finish.id }),
                    onIntent: () => p.onIntent({ finish: finish.id }),
                    onUnavailable: () => p.onUnavailable(`${p.wheel!.design.name} in ${finish.value.name}`)
                  }}
                >
                  <FinishChip finish={finish.value} size={40} />
                </TileButton>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {p.wheel && p.sizes.length > 0 && (
        <Section title="Size" value={p.size}>
          <div className="flex flex-wrap gap-2">
            {p.sizes.map((size) => (
              <OptionChip key={size} option={{ label: `${size} wheels`, selected: size === p.size, available: true, onSelect: () => p.onSize(size) }}>
                {size}
              </OptionChip>
            ))}
          </div>
          <p className="mt-3 text-[11px] leading-relaxed text-mute">The picture shows the wheel in the car's factory tyre. Size and fitment are confirmed with our team.</p>
        </Section>
      )}
    </>
  );
};

/** The price of the chosen wheel set and the one main action. With the factory wheels there is no price: the action is an enquiry. */
export const PriceBar: React.FC<{
  /** False while there is no configuration on screen (loading, or the pictures could not be loaded). */
  ready: boolean;
  wheel?: ConfigWheel;
  finish?: WheelFinish;
  size?: string;
  region: Region;
  onViewBuild: () => void;
  onEnquire: () => void;
  className?: string;
}> = ({ ready, wheel, finish, size, region, onViewBuild, onEnquire, className }) => (
  <div className={cx('flex items-center justify-between gap-4', className)}>
    <div className="min-w-0">
      <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-mute">{wheel ? 'Wheel set of four' : ready ? 'Factory wheels' : 'Forged wheels'}</div>
      {wheel && finish && size ? (
        <div className="mt-0.5 font-display text-[22px] font-bold leading-tight tracking-[-0.01em] text-ink tabular-nums">{formatMoney(rimPrice(wheel.design, size, finish.id), region)}</div>
      ) : (
        <div className="mt-1 text-[12.5px] leading-snug text-mute">{ready ? 'Choose a wheel to see its price' : 'Talk to our team about any wheel'}</div>
      )}
    </div>
    {wheel ? (
      <Button size="lg" className="h-12 shrink-0 px-6" onClick={onViewBuild} icon={<ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden />}>
        View build
      </Button>
    ) : (
      <Button variant="secondary" size="lg" className="h-12 shrink-0 px-6" onClick={onEnquire} icon={<Mail className="h-4 w-4" strokeWidth={1.7} aria-hidden />}>
        Enquire
      </Button>
    )}
  </div>
);
