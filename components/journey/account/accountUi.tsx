/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Loader2 } from 'lucide-react';
import { cx } from '../ui';

export const fieldCls =
  'mt-1.5 h-12 w-full rounded-xl bg-ink/[0.04] px-4 text-[14px] text-ink outline-none ring-1 ring-line focus:ring-gold/60 transition placeholder:text-mute/50';

export const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <label className="block">
    <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-mute">{label}</span>
    {children}
  </label>
);

/** A section heading with an optional one-line explanation, the account sheet's unit of structure. */
export const Section: React.FC<{ title: string; hint?: React.ReactNode; children: React.ReactNode; className?: string }> = ({ title, hint, children, className }) => (
  <section className={cx('rounded-[14px] bg-ink/[0.035] p-4 ring-1 ring-line', className)}>
    <h4 className="text-[13.5px] font-semibold text-ink">{title}</h4>
    {hint && <p className="mt-1 text-[12px] leading-relaxed text-mute">{hint}</p>}
    <div className="mt-3.5">{children}</div>
  </section>
);

/** An on/off switch with its label and explanation (a real button with role="switch", so it works by keyboard and screen reader). */
export const Switch: React.FC<{ checked: boolean; onChange: (next: boolean) => void; label: string; hint: React.ReactNode; busy?: boolean }> = ({ checked, onChange, label, hint, busy }) => (
  <div className="flex items-start justify-between gap-4">
    <div className="min-w-0">
      <div className="text-[13.5px] font-semibold text-ink">{label}</div>
      <div className="mt-0.5 text-[12px] leading-relaxed text-mute">{hint}</div>
    </div>
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={busy}
      onClick={() => onChange(!checked)}
      className={cx(
        'relative mt-0.5 h-7 w-12 shrink-0 rounded-full transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold disabled:opacity-60',
        checked ? 'bg-gold' : 'bg-ink/20'
      )}
    >
      <span className={cx('absolute left-0.5 top-0.5 h-6 w-6 rounded-full bg-carbon shadow transition-transform duration-200', checked ? 'translate-x-5' : 'translate-x-0')} />
    </button>
  </div>
);

/** Google's standard-colour "G" on white, as its sign-in branding guidelines require. */
const GoogleMark: React.FC = () => (
  <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white">
    <svg viewBox="0 0 48 48" className="h-[18px] w-[18px]" aria-hidden>
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  </span>
);

/**
 * "Continue with Google" to Google's branding guidelines (dark theme), which app verification requires: fill #131314,
 * a 1px #8E918F inside stroke, #E3E3E3 text in Google Sans Medium 14/20 (loaded for this label in index.html), the
 * standard G on white, 12px before the logo, 10px after it and 12px after the text. Never the brand's orange button.
 */
export const GoogleButton: React.FC<{ busy: boolean; onClick: () => void }> = ({ busy, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={busy}
    aria-busy={busy}
    className="relative flex h-12 w-full items-center rounded-full bg-[#131314] px-3 text-[#E3E3E3] ring-1 ring-inset ring-[#8E918F] transition-colors duration-200 hover:bg-[#1f1f21] active:bg-[#28292b] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold disabled:cursor-progress"
    style={{ fontFamily: "'Google Sans', Roboto, Arial, sans-serif", fontWeight: 500, fontSize: 14, lineHeight: '20px' }}
  >
    <GoogleMark />
    {/* Centred on the button, not on the space beside the logo (the logo and its gap are 34px) */}
    <span className="ml-2.5 flex-1 pr-[34px] text-center">Continue with Google</span>
    {busy && <Loader2 className="absolute right-4 h-4 w-4 animate-spin text-[#E3E3E3]/80" aria-hidden />}
  </button>
);

export const formatDate = (iso: string) => {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? '' : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
};
