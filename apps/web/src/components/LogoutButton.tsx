// SPDX-FileCopyrightText: 2026 Ján Letko / LTK Solutions
// SPDX-License-Identifier: EUPL-1.2

'use client';

import { useMsal } from '@azure/msal-react';
import { LogOut } from 'lucide-react';

import type { JSX } from 'react';

/**
 * Logout button. Initiates the Entra ID logout redirect, which clears
 * the MSAL cache + the Microsoft SSO cookie, then returns the user
 * to the app's home page (where the LoginButton becomes visible again).
 */
export function LogoutButton(): JSX.Element {
  const { instance } = useMsal();

  const handleLogout = (): void => {
    void instance.logoutRedirect().catch((err: unknown) => {
      console.error('Logout failed:', err);
    });
  };

  return (
    <button
      type="button"
      onClick={handleLogout}
      className="inline-flex items-center gap-2 rounded-lg border border-border-default bg-surface-card px-3 py-2 text-sm font-medium text-text-primary transition hover:bg-surface-subtle"
    >
      <LogOut aria-hidden="true" className="h-4 w-4" />
      Odhlásiť sa
    </button>
  );
}
