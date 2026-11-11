/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { BRAND, Region } from '../../config/brand';
import { cleanShareCode } from '../../services/plates/address';
import { Alert, Button, Eyebrow, Modal, cx } from '../journey/ui';

/**
 * The configurator's menu: region and currency, reopening a saved build by its code, the account,
 * an enquiry, and the way to the rest of the site.
 */
export const OptionsMenu: React.FC<{
  open: boolean;
  onClose: () => void;
  region: Region;
  onRegion: (region: Region) => void;
  /** Opens the saved build with this code; resolves false when there is none. */
  onOpenCode: (code: string) => Promise<boolean>;
  onOpenAccount: () => void;
  onEnquire: () => void;
  onNavigate: (path: string) => void;
}> = ({ open, onClose, region, onRegion, onOpenCode, onOpenAccount, onEnquire, onNavigate }) => {
  const [code, setCode] = useState('');
  const [state, setState] = useState<'idle' | 'loading' | 'not-found'>('idle');
  const row = 'flex min-h-12 w-full items-center justify-between rounded-xl px-4 text-left text-[13px] transition-colors';

  const openCode = async (event: React.FormEvent) => {
    event.preventDefault();
    const clean = cleanShareCode(code);
    if (!clean) return setState('not-found');
    setState('loading');
    let found = false;
    try {
      found = await onOpenCode(clean);
    } catch {
      found = false; // the lookup itself failed: the same calm message
    }
    setState(found ? 'idle' : 'not-found');
    if (found) {
      setCode('');
      onClose();
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Menu" width="max-w-md">
      <Eyebrow className="mb-3">Region and currency</Eyebrow>
      <div className="grid gap-1.5">
        {BRAND.regions.map((candidate) => (
          <button
            key={candidate.id}
            type="button"
            aria-pressed={candidate.id === region.id}
            onClick={() => onRegion(candidate)}
            className={cx(row, candidate.id === region.id ? 'bg-gold/[0.12] text-gold ring-1 ring-inset ring-gold/60' : 'bg-ink/[0.04] hover:bg-ink/[0.07]')}
          >
            <span className="font-medium">{candidate.label}</span>
            <span className={candidate.id === region.id ? 'text-gold/80' : 'text-mute'}>{candidate.currency}</span>
          </button>
        ))}
      </div>

      <Eyebrow className="mb-3 mt-7">Open a saved build</Eyebrow>
      <form className="flex gap-2" onSubmit={openCode}>
        <input
          value={code}
          onChange={(event) => {
            setCode(event.target.value.toUpperCase());
            setState('idle');
          }}
          aria-label="Configuration code"
          placeholder="e.g. K7QM4XR2PD"
          maxLength={14}
          autoComplete="off"
          spellCheck={false}
          className="h-12 min-w-0 flex-1 rounded-full bg-ink/[0.04] px-5 font-mono text-[13px] tracking-[0.18em] text-ink outline-none ring-1 ring-line transition focus:ring-gold/60 placeholder:text-mute/50"
        />
        <Button type="submit" variant="secondary" className="h-12" disabled={!cleanShareCode(code) || state === 'loading'}>
          {state === 'loading' ? 'Opening' : 'Open'}
        </Button>
      </form>
      {state === 'not-found' && <Alert className="mt-2">No build was found for that code.</Alert>}

      <Eyebrow className="mb-3 mt-7">More</Eyebrow>
      <div className="grid gap-1.5">
        {[
          { label: 'Account and garage', detail: 'Sign in · saved builds', action: onOpenAccount },
          { label: 'Enquire', detail: 'Talk to our team', action: onEnquire },
          { label: 'The wheels', detail: 'The collection', action: () => onNavigate('/forged') },
          { label: 'Delivery and fitment', detail: '', action: () => onNavigate('/delivery') },
          { label: 'Home', detail: '', action: () => onNavigate('/') }
        ].map((item) => (
          <button
            key={item.label}
            type="button"
            onClick={() => {
              onClose();
              item.action();
            }}
            className={cx(row, 'bg-ink/[0.04] hover:bg-ink/[0.07]')}
          >
            <span className="font-medium">{item.label}</span>
            <span className="text-mute">{item.detail}</span>
          </button>
        ))}
      </div>
    </Modal>
  );
};
