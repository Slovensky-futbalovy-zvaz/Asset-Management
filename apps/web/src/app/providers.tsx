// SPDX-FileCopyrightText: 2026 Ján Letko / LTK Solutions
// SPDX-License-Identifier: EUPL-1.2

'use client';

import { MsalProvider } from '@azure/msal-react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import type { PublicClientApplication } from '@azure/msal-browser';
import type { JSX, ReactNode } from 'react';

import { getMsalInstance } from '@/lib/api-client';

/**
 * Client-side provider tree. Wraps the app in:
 *   1. MsalProvider — exposes MSAL hooks (useAccount, useMsal, ...)
 *      and account-change events.
 *   2. QueryClientProvider — TanStack Query cache + dedup.
 *
 * Rendered inside the root server component (`app/layout.tsx`) so the
 * server-rendered HTML still streams fast; only the auth-dependent
 * subtree hydrates on the client.
 *
 * The QueryClient is held in component state (not module scope) so
 * Next.js Fast Refresh doesn't share it across HMR boundaries —
 * which would otherwise cache stale data after a hot reload.
 *
 * The MSAL instance is fetched via `getMsalInstance()` (lazy singleton
 * — see api-client.ts) so the heavy construction only happens in the
 * browser, never during Next's static page generation pass.
 */
export function AppProviders({ children }: { children: ReactNode }): JSX.Element {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Refetch on window focus is loud for an internal tool —
            // users alt-tabbing back to the app don't expect the
            // assets list to re-fetch and shift around. They can
            // explicitly refresh with the page reload button.
            refetchOnWindowFocus: false,
            // Keep cached data fresh for 30s before considering it
            // stale and refetching in the background.
            staleTime: 30_000,
            // Retry transient network failures once. Auth errors (401)
            // are not retried — our middleware redirects to login.
            retry: 1,
          },
        },
      }),
  );

  // MSAL instance is constructed in the effect (browser-only) and held
  // in state so re-renders see the same singleton.
  const [msalInstance, setMsalInstance] = useState<PublicClientApplication | null>(null);

  useEffect(() => {
    let cancelled = false;
    const instance = getMsalInstance();
    instance
      .initialize()
      .then(() => {
        if (cancelled) return;
        // If a redirect login completed on this page load, MSAL needs
        // to process the URL hash. Without this, the active account
        // is never set after a /redirect callback.
        return instance.handleRedirectPromise();
      })
      .then(() => {
        if (cancelled) return;
        const accounts = instance.getAllAccounts();
        if (accounts.length > 0 && !instance.getActiveAccount()) {
          instance.setActiveAccount(accounts[0] ?? null);
        }
        setMsalInstance(instance);
      })
      .catch((err: unknown) => {
        console.error('MSAL initialisation failed:', err);
        // Still set the instance so the rest of the app renders —
        // login attempts will fail with a visible error, which is more
        // useful than a blank page.
        setMsalInstance(instance);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (!msalInstance) {
    // Tiny full-page loader while MSAL initialises (single round-trip
    // to login.microsoftonline.com for the OpenID metadata document,
    // typically ~200ms). Keep it dependency-free so we don't pull in
    // heavier UI before it's needed.
    return (
      <div
        role="status"
        aria-live="polite"
        className="flex min-h-screen items-center justify-center bg-surface-page"
      >
        <span className="sr-only">Načítavam Inventario…</span>
        <span className="text-sm text-text-secondary">Načítavam Inventario…</span>
      </div>
    );
  }

  return (
    <MsalProvider instance={msalInstance}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </MsalProvider>
  );
}
