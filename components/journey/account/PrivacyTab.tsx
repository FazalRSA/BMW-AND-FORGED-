/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { Download, Trash2 } from 'lucide-react';
import { BRAND } from '../../../config/brand';
import { Profile, deleteMyAccount, exportMyData, updateMyProfile } from '../../../services/authService';
import { Alert, Button, Status } from '../ui';
import { Section, Switch, formatDate } from './accountUi';

export interface PrivacyTabProps {
  user: User;
  profile: Profile | null;
  onProfile: (profile: Profile) => void;
  /** The account is gone: the sheet falls back to the signed-out view and says so. */
  onAccountDeleted: () => void;
}

const privacyUrl = `https://${BRAND.contact.website}/privacy-policy`;

/** POPIA in the customer's hands: the email choice, a copy of their data, and deletion. */
export const PrivacyTab: React.FC<PrivacyTabProps> = ({ user, profile, onProfile, onAccountDeleted }) => {
  const [mailBusy, setMailBusy] = useState(false);
  const [mailError, setMailError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [armed, setArmed] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const optedIn = !!profile?.marketingOptIn;
  const setOptIn = async (next: boolean) => {
    setMailBusy(true);
    setMailError(null);
    try {
      onProfile(await updateMyProfile({ marketingOptIn: next }));
    } catch (e) {
      setMailError(e instanceof Error ? e.message : 'Your choice could not be saved.');
    } finally {
      setMailBusy(false);
    }
  };

  const download = async () => {
    setExporting(true);
    setExportError(null);
    try {
      const data = await exportMyData();
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `${BRAND.name.toLowerCase()}-my-data.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      setExportError(e instanceof Error ? e.message : 'Your data could not be downloaded.');
    } finally {
      setExporting(false);
    }
  };

  const remove = async () => {
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteMyAccount();
      onAccountDeleted();
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : 'Your account could not be deleted.');
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-3.5">
      <Section title="Email from us" hint={`Service emails (your welcome, enquiry confirmations) always come from ${BRAND.contact.email}. These are the only optional ones.`}>
        <Switch
          checked={optedIn}
          onChange={setOptIn}
          busy={mailBusy}
          label="News and offers"
          hint={optedIn && profile?.marketingOptInAt ? `You opted in on ${formatDate(profile.marketingOptInAt)}. Switch off at any time.` : 'Off unless you turn it on. We never subscribe you ourselves.'}
        />
        {mailError && <Alert className="mt-3">{mailError}</Alert>}
        <Status className="sr-only">{mailBusy ? 'Saving your choice…' : ''}</Status>
      </Section>

      <Section
        title="Your data"
        hint={`This one account works on the configurator and on ${BRAND.contact.website}. We keep your name, email, optional details and saved builds to run it, and use them for nothing else.`}
      >
        <Button variant="secondary" size="sm" className="w-full sm:w-auto" disabled={exporting} onClick={download} icon={<Download className="h-3.5 w-3.5" strokeWidth={1.8} />}>
          {exporting ? 'Preparing…' : 'Download my data'}
        </Button>
        {exportError && <Alert className="mt-3">{exportError}</Alert>}
        <p className="mt-3 text-[11.5px] leading-relaxed text-mute">
          A JSON file with your account, profile, saved builds and enquiries.{' '}
          <a href={privacyUrl} target="_blank" rel="noopener noreferrer" className="underline decoration-line underline-offset-2 hover:text-gold">
            Privacy notice
          </a>
        </p>
      </Section>

      <Section title="Delete my account">
        {!armed ? (
          <Button variant="ghost" size="sm" className="-ml-2 text-red-400 hover:text-red-400" onClick={() => setArmed(true)} icon={<Trash2 className="h-3.5 w-3.5" strokeWidth={1.8} />}>
            Delete my account
          </Button>
        ) : (
          <div role="alertdialog" aria-label="Delete your account" className="space-y-3">
            <p className="text-[12.5px] leading-relaxed text-ink/90">
              This deletes your login, your profile and every build in your garage, on both sites. It cannot be undone. Enquiries you already sent stay with us as sales records; write to{' '}
              <a href={`mailto:${BRAND.contact.email}`} className="underline decoration-line underline-offset-2 hover:text-gold">
                {BRAND.contact.email}
              </a>{' '}
              and we will remove those too.
            </p>
            {deleteError && <Alert>{deleteError}</Alert>}
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" size="sm" disabled={deleting} onClick={remove} className="text-red-400 ring-red-400/50">
                {deleting ? 'Deleting…' : 'Yes, delete everything'}
              </Button>
              <Button variant="ghost" size="sm" disabled={deleting} onClick={() => setArmed(false)}>
                Keep my account
              </Button>
            </div>
          </div>
        )}
        <Status className="sr-only">{deleting ? 'Deleting your account…' : ''}</Status>
      </Section>
      <p className="px-1 text-[11px] text-mute/70">Signed in as {user.email}.</p>
    </div>
  );
};
