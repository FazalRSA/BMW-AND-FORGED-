/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import type { PlateView } from '../../services/plates/manifest';
import type { Option } from '../../services/plates/selection';
import { cx } from '../journey/ui';
import { NOT_PICTURED, optionButtonProps } from './controls';

/** The views of the car (Front, Side, Rear, Wheel), as a row of text tabs under the picture. */
export const ViewTabs: React.FC<{
  views: Option<PlateView>[];
  onSelect: (viewId: string) => void;
  onIntent: (viewId: string) => void;
  onUnavailable: (view: PlateView) => void;
  className?: string;
}> = ({ views, onSelect, onIntent, onUnavailable, className }) => (
  <div role="group" aria-label="View" className={cx('flex items-stretch justify-center', className)}>
    {views.map((view) => (
      <button
        key={view.id}
        {...optionButtonProps({
          label: `${view.value.label} view`,
          selected: view.selected,
          available: view.available,
          onSelect: () => onSelect(view.id),
          onIntent: () => onIntent(view.id),
          onUnavailable: () => onUnavailable(view.value)
        })}
        className={cx(
          'relative flex min-h-11 min-w-[72px] flex-1 flex-col items-center justify-center px-3 text-[10.5px] font-semibold uppercase tracking-[0.2em] transition-colors duration-200 sm:flex-none sm:px-6',
          view.selected ? 'text-gold' : view.available ? 'text-mute hover:text-ink' : 'text-mute/45'
        )}
      >
        {view.value.label}
        {!view.available && <span className="mt-0.5 text-[8.5px] tracking-[0.16em] text-mute/80">{NOT_PICTURED}</span>}
        <span aria-hidden className={cx('absolute inset-x-3 bottom-0 h-px transition-opacity duration-200 sm:inset-x-6', view.selected ? 'bg-gold opacity-100' : 'opacity-0')} />
      </button>
    ))}
  </div>
);
