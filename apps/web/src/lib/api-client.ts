// SPDX-FileCopyrightText: 2026 Ján Letko / LTK Solutions
// SPDX-License-Identifier: EUPL-1.2

import {
  InteractionRequiredAuthError,
  PublicClientApplication,
  type AccountInfo,
} from '@azure/msal-browser';
import createClient, { type Middleware } from 'openapi-fetch';

import { apiTokenRequest, msalConfig } from './msal-config';

import type { paths } from './api-types';

/**
 * Lazy singleton accessor for the MSAL public client.
 *
 * Why lazy: Next.js statically pre-renders pages at build time in a
 * Node runtime where `window` is not defined. Constructing
 * `new PublicClientApplication(msalConfig)` at module top level
 * crashes that build (MSAL logger touches `window` in its
 * constructor). The lazy getter delays construction to first call,
 * which only happens client-side via `AppProviders` or `LoginButton`.
 *
 * The instance itself is cached across calls, so we still have a
 * singleton — just one that exists only in the browser tab.
 *
 * Callers that run on the server should NEVER call this; if you find
 * yourself adding a server-side call site, refactor the call site to
 * pass through `useMsal()` instead.
 */
let _msalInstance: PublicClientApplication | null = null;

export function getMsalInstance(): PublicClientApplication {
  if (typeof window === 'undefined') {
    // Programmer error: a server component or route handler is trying
    // to touch MSAL. Throw loudly so the call site is fixed.
    throw new Error(
      'getMsalInstance() called on the server. MSAL is browser-only. ' +
        'Move the call into a "use client" component or a useEffect.',
    );
  }
  if (!_msalInstance) {
    _msalInstance = new PublicClientApplication(msalConfig);
  }
  return _msalInstance;
}

const API_BASE_URL = process.env['NEXT_PUBLIC_API_BASE_URL'] ?? 'http://localhost:3000';

/**
 * Acquire an Entra ID access token for the Inventario API.
 *
 * Order of operations:
 *   1. Pick the active account from MSAL (set by `MsalProvider` on
 *      successful login).
 *   2. Try `acquireTokenSilent` — uses the SSO cookie + cached refresh
 *      token. ~99% of calls hit this path.
 *   3. If silent acquisition needs user interaction (consent expired,
 *      MFA required, etc.), fall through to `acquireTokenRedirect`.
 *      That redirects the browser to login.microsoftonline.com and
 *      back; the in-flight HTTP request loses; the user re-runs the
 *      operation after the redirect completes.
 *
 * Throws if there is no active account. Callers should check
 * `useIsAuthenticated()` before invoking API operations.
 */
export async function acquireApiToken(account: AccountInfo): Promise<string> {
  const msalInstance = getMsalInstance();
  try {
    const result = await msalInstance.acquireTokenSilent({
      ...apiTokenRequest,
      account,
    });
    return result.accessToken;
  } catch (err) {
    if (err instanceof InteractionRequiredAuthError) {
      // Throw a marker so the auth middleware below can route the
      // user to re-login. We don't redirect here because the caller
      // (TanStack Query) might want to retry or surface to the user.
      await msalInstance.acquireTokenRedirect(apiTokenRequest);
      throw new Error('Redirecting to login...');
    }
    throw err;
  }
}

/**
 * Auth middleware — automatically attaches a bearer token to every
 * request. Pulls the active account at call time so the token is
 * always for the currently logged-in user.
 *
 * Runs only in the browser (openapi-fetch middleware fires inside
 * fetch invocations, which only happen on the client for our usage).
 */
const authMiddleware: Middleware = {
  async onRequest({ request }) {
    if (typeof window === 'undefined') {
      // Server-side fetch (e.g. from a server component) cannot read
      // MSAL state. Let the request through unauthenticated; the
      // backend will reject it with 401 if the endpoint requires auth.
      return request;
    }
    const msalInstance = getMsalInstance();
    const account = msalInstance.getActiveAccount();
    if (!account) {
      // No active account means the user is not logged in. The
      // request will fail with 401 at the backend, which our error
      // boundary will catch and route to the login page. Don't block
      // the request here — public endpoints (health, etc.) still work.
      return request;
    }
    try {
      const token = await acquireApiToken(account);
      request.headers.set('Authorization', `Bearer ${token}`);
      return request;
    } catch {
      // acquireApiToken triggered a redirect — abandon this request.
      // The page will navigate away before the request can complete.
      return request;
    }
  },
};

/**
 * Type-safe API client. Generated from `apps/api/openapi.json` so
 * every path, query param, body, and response is typed end-to-end.
 *
 * Usage:
 *   const { data, error } = await apiClient.GET('/v1/assets', {
 *     params: { query: { limit: 50, skip: 0 } },
 *   });
 *
 * For React components, prefer the TanStack Query hooks in
 * `src/lib/api-hooks.ts` (added in K4) — they cache, dedupe, and
 * handle loading states automatically.
 */
export const apiClient = createClient<paths>({
  baseUrl: API_BASE_URL,
});

apiClient.use(authMiddleware);
