/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useMemo, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { Profile, getMyProfile, useAuthUser } from './authService';

export interface CustomerAccount {
  /** The signed-in customer (Google through Supabase Auth), or null. */
  user: User | null;
  profile: Profile | null;
  setProfile: (profile: Profile | null) => void;
  /** Their picture, when Google gave one. */
  avatarUrl: string | null;
  /** Their details, offered in the enquiry and PDF forms for the fields still blank. */
  contactPrefill: { name: string; email: string; phone: string } | undefined;
}

/** The signed-in customer and their profile, kept up to date across sign-in and sign-out. */
export function useCustomerAccount(): CustomerAccount {
  const user = useAuthUser();
  const [profile, setProfile] = useState<Profile | null>(null);
  useEffect(() => {
    if (!user) {
      setProfile(null);
      return;
    }
    let current = true;
    getMyProfile()
      .then((loaded) => current && setProfile(loaded))
      .catch((error) => console.warn('Account: the profile could not be loaded', error));
    return () => {
      current = false;
    };
  }, [user?.id]);
  const contactPrefill = useMemo(
    () =>
      user
        ? {
            name: profile?.displayName ?? (user.user_metadata?.full_name as string | undefined) ?? '',
            email: profile?.email ?? user.email ?? '',
            phone: profile?.phone ?? ''
          }
        : undefined,
    [user, profile]
  );
  const avatarUrl = profile?.avatarUrl ?? (user?.user_metadata?.avatar_url as string | undefined) ?? (user?.user_metadata?.picture as string | undefined) ?? null;
  return { user, profile, setProfile, avatarUrl, contactPrefill };
}
