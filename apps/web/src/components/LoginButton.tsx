// SPDX-FileCopyrightText: 2026 Ján Letko / LTK Solutions
// SPDX-License-Identifier: EUPL-1.2

'use client';

import { useMsal } from '@azure/msal-react';
import { LogIn } from 'lucide-react';

import type { JSX } from 'react';

import { loginRequest } from '@/lib/msal-config';

/**
 * Login button. Triggers MSAL redirect flow to login.microsoftonline.com.
 *
 * After successful auth the user lands back on this page; MsalProvider
 * sets the active account from the redirect response, and the page
 * re-renders with `useIsAuthenticated() === true`.
 */
export function LoginButton(): JSX.Element {
  const { instance } = useMsal();

  const handleLogin = (): void => {
    void instance.loginRedirect(loginRequest).catch((err: unknown) => {
      console.error('Login redirect failed:', err);
    });
  };

  return (
    <button
      type="button"
      onClick={handleLogin}
      className="inline-flex items-center gap-2 rounded-lg bg-brand-primary px-5 py-3 text-base font-semibold text-brand-primary-fg shadow-cta transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus focus-visible:ring-offset-2 focus-visible:ring-offset-surface-page"
    >
      <LogIn aria-hidden="true" className="h-5 w-5" />
      Prihlásiť sa cez Microsoft
    </button>
  );
}
