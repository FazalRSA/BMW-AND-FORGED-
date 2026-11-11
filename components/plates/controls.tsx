/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { cx } from '../journey/ui';

/**
 * The configurator's controls: quiet, hairline-thin, one warm accent for what is selected. Colours are
 * the theme's roles (config/theme.ts), never hex codes. Every control is a real button at least 44 px
 * tall, says whether it is pressed, and keeps the page's focus ring.
 */

/** What an option shows when its picture does not exist yet. */
export const NOT_PICTURED = 'Soon';
export const notPicturedLabel = (name: string) => `${name}, picture coming soon`;

export interface OptionState {
  /** What the option is, for screen readers and the tooltip. */
  label: string;
  selected: boolean;
  /** False: its picture is not rendered yet. The button stays focusable and explains itself when pressed. */
  available: boolean;
  onSelect: () => void;
  /** The customer pressed an option that is not pictured yet. */
  onUnavailable?: () => void;
  /** The pointer or the keyboard focus reached the option (its picture can be fetched ahead of the click). */
  onIntent?: () => void;
}

/** The attributes every option button shares. */
export const optionButtonProps = (option: OptionState): React.ButtonHTMLAttributes<HTMLButtonElement> => {
  const label = option.available ? option.label : notPicturedLabel(option.label);
  const intent = option.available && !option.selected ? option.onIntent : undefined;
  return {
    type: 'button',
    'aria-pressed': option.selected,
    'aria-disabled': option.available ? undefined : true,
    'aria-label': label,
    title: label,
    onClick: () => (option.available ? option.onSelect() : option.onUnavailable?.()),
    onPointerEnter: intent,
    onPointerDown: intent,
    onFocus: intent
  };
};

/** A titled block of options, separated from the one above by a hairline. `value` names the current choice. */
export const Section: React.FC<{ title: string; value?: React.ReactNode; children: React.ReactNode; className?: string }> = ({ title, value, children, className }) => {
  const headingId = React.useId();
  return (
    <section aria-labelledby={headingId} className={cx('border-t border-line py-5 first:border-t-0 first:pt-0 sheet:py-4', className)}>
      <div className="mb-3 flex items-baseline justify-between gap-4">
        <h2 id={headingId} className="shrink-0 text-[10.5px] font-semibold uppercase tracking-[0.24em] text-mute">
          {title}
        </h2>
        {value && <div className="min-w-0 truncate text-right text-[12.5px] text-ink">{value}</div>}
      </div>
      {children}
    </section>
  );
};

/** A text option (car, size). */
export const OptionChip: React.FC<{ option: OptionState; children: React.ReactNode; className?: string }> = ({ option, children, className }) => (
  <button
    {...optionButtonProps(option)}
    className={cx(
      'relative inline-flex min-h-11 items-center justify-center rounded-full px-4 text-[12px] font-medium tracking-[0.02em] ring-1 ring-inset transition-colors duration-200',
      option.selected ? 'bg-gold/[0.12] text-gold ring-gold/70' : option.available ? 'text-ink ring-line hover:bg-ink/[0.05]' : 'text-mute/60 ring-line',
      className
    )}
  >
    {children}
    {!option.available && <span className="ml-2 text-[9.5px] font-semibold uppercase tracking-[0.16em] text-mute">{NOT_PICTURED}</span>}
  </button>
);

/**
 * A round swatch (paint): a 44 px touch target around a smaller disc. Selected: a ring in the accent
 * colour. Not pictured yet: dimmed, with a line through it.
 */
export const SwatchButton: React.FC<{ option: OptionState; swatchStyle: React.CSSProperties }> = ({ option, swatchStyle }) => (
  <button {...optionButtonProps(option)} className="group relative flex aspect-square min-h-11 w-full items-center justify-center rounded-full">
    <span
      className={cx(
        'relative block h-[30px] w-[30px] rounded-full ring-1 ring-inset ring-white/15 transition-transform duration-200',
        option.selected ? 'outline outline-[1.5px] outline-offset-[4px] outline-gold' : option.available && 'group-hover:scale-110',
        !option.available && 'opacity-30'
      )}
      style={swatchStyle}
    />
    {!option.available && <span aria-hidden className="pointer-events-none absolute h-px w-[34px] rotate-[-38deg] bg-mute" />}
  </button>
);

/** A picture option with its name under it (wheel design, wheel finish). */
export const TileButton: React.FC<{ option: OptionState; name: string; children: React.ReactNode }> = ({ option, name, children }) => (
  <button {...optionButtonProps(option)} className="group flex min-h-11 w-full min-w-0 flex-col items-center gap-1.5 rounded-xl px-1 pb-1.5 pt-2 text-center">
    <span
      className={cx(
        'flex h-[52px] w-[52px] items-center justify-center rounded-full transition-all duration-200',
        option.selected ? 'outline outline-[1.5px] outline-offset-[3px] outline-gold' : option.available && 'group-hover:scale-105',
        !option.available && 'opacity-30 grayscale'
      )}
    >
      {children}
    </span>
    <span className={cx('w-full truncate text-[11px] leading-tight', option.selected ? 'font-semibold text-gold' : option.available ? 'text-ink' : 'text-mute/70')}>{name}</span>
    {!option.available && <span className="-mt-1 text-[9px] font-semibold uppercase tracking-[0.16em] text-mute">{NOT_PICTURED}</span>}
  </button>
);
