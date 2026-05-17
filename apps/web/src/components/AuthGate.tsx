// SPDX-FileCopyrightText: 2026 Ján Letko / LTK Solutions
// SPDX-License-Identifier: EUPL-1.2

'use client';

import { useIsAuthenticated } from '@azure/msal-react';

import { AppShell } from './AppShell';
import { LoginScreen } from './LoginScreen';

import type { JSX, ReactNode } from 'react';

/**
 * Auth gate. Decides between the pre-login landing screen and the
 * authenticated app shell.
 *
 * `useIsAuthenticated()` reads from MSAL's account list — it returns
 * true when at least one account exists and the cached access token
 * is not expired. MSAL refreshes the token silently in the background
 * via `acquireTokenSilent` (our api-client uses the same path).
 *
 * Used in every page component:
 *   export default function Page() {
 *     return <AuthGate><DashboardContent /></AuthGate>;
 *   }
 */
export function AuthGate({ children }: { children: ReactNode }): JSX.Element {
  const isAuthenticated = useIsAuthenticated();

  if (!isAuthenticated) {
    return <LoginScreen />;
  }

  return <AppShell>{children}</AppShell>;
}
