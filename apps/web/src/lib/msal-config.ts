// SPDX-FileCopyrightText: 2026 Ján Letko / LTK Solutions
// SPDX-License-Identifier: EUPL-1.2

import { LogLevel, type Configuration } from '@azure/msal-browser';

/**
 * Microsoft Entra ID (MSAL) configuration for the Inventario web app.
 *
 * The OAuth dance happens entirely in the browser via the
 * authorization-code-with-PKCE flow. We never see the user's password,
 * and the access token is held in browser storage (sessionStorage —
 * see `cacheLocation` below) until expiry, then refreshed silently
 * by MSAL using the SSO cookie.
 *
 * Env vars required (set in apps/web/.env.local for dev, in Vercel
 * project settings for preview/production):
 *
 *   NEXT_PUBLIC_ENTRA_CLIENT_ID — the FRONTEND app registration's
 *     Application (client) ID. This is a SEPARATE registration from
 *     ENTRA_API_CLIENT_ID on the backend. The frontend is a SPA
 *     (public client, no secret); the backend is a web API. The
 *     frontend's "API permissions" must include
 *     `api://<ENTRA_API_CLIENT_ID>/access_as_user`.
 *
 *   NEXT_PUBLIC_ENTRA_TENANT_ID — the Entra tenant GUID. Same value
 *     as the backend's ENTRA_TENANT_ID. Single-tenant for now (the
 *     SFZ tenant); future white-label tenants will use the same
 *     frontend code but a different tenant ID baked at build time
 *     per Vercel preview.
 *
 *   NEXT_PUBLIC_API_BASE_URL — base URL of the Fastify backend. In
 *     dev this is http://localhost:3000; in production it will be
 *     https://api.inventario.sportup.sk.
 *
 * Why NEXT_PUBLIC_*: these are baked into the client bundle, so they
 * cannot hold secrets. The Entra client ID and tenant GUID are
 * non-sensitive — they're visible to any user who logs in. The PKCE
 * exchange is the actual security boundary.
 */

const tenantId = process.env['NEXT_PUBLIC_ENTRA_TENANT_ID'] ?? '';
const clientId = process.env['NEXT_PUBLIC_ENTRA_CLIENT_ID'] ?? '';
const apiClientId = process.env['NEXT_PUBLIC_ENTRA_API_CLIENT_ID'] ?? '';

/**
 * The scope the frontend must request to call the Inventario API.
 *
 * Maps to the `access_as_user` delegated permission defined on the
 * backend's app registration. The backend `auth.ts` plugin rejects
 * tokens whose `scp` claim doesn't contain this exact scope.
 */
export const API_SCOPE = `api://${apiClientId}/access_as_user`;

export const msalConfig: Configuration = {
  auth: {
    clientId,
    authority: `https://login.microsoftonline.com/${tenantId}`,
    redirectUri: typeof window === 'undefined' ? '/' : window.location.origin,
    postLogoutRedirectUri: typeof window === 'undefined' ? '/' : window.location.origin,
  },
  cache: {
    // sessionStorage clears when the tab closes, which is a tighter
    // security posture than localStorage (which persists across
    // restarts). The trade-off is users have to re-login after closing
    // all browser tabs; that's the right default for an internal tool
    // handling asset and personnel data.
    cacheLocation: 'sessionStorage',
  },
  system: {
    loggerOptions: {
      logLevel: LogLevel.Warning,
      piiLoggingEnabled: false,
      loggerCallback: (level, message, containsPii) => {
        if (containsPii) return;
        switch (level) {
          case LogLevel.Error:
            console.error(`[MSAL] ${message}`);
            return;
          case LogLevel.Warning:
            console.warn(`[MSAL] ${message}`);
            return;
          default:
            return;
        }
      },
    },
  },
};

/**
 * Scopes requested at login + on every silent token acquisition.
 *
 * `openid` and `profile` are the OIDC standard scopes that give us
 * the user's basic identity claims (name, email). Without them MSAL
 * cannot show a name + email in the account picker.
 */
export const loginRequest = {
  scopes: ['openid', 'profile', 'email', API_SCOPE],
};

/**
 * Scopes used by `acquireTokenSilent` when refreshing the API token.
 * Only the API scope — OIDC scopes are already cached from login.
 */
export const apiTokenRequest = {
  scopes: [API_SCOPE],
};

/**
 * Quick sanity check at module load time. If the env vars are missing
 * the app would silently route every login to a 404 — surfacing the
 * misconfiguration in the console is much friendlier than debugging
 * an opaque MSAL error.
 */
if (typeof window !== 'undefined') {
  if (!tenantId) {
    console.error(
      'NEXT_PUBLIC_ENTRA_TENANT_ID is not set. Login will fail. ' +
        'Copy .env.example to .env.local and fill it in.',
    );
  }
  if (!clientId) {
    console.error(
      'NEXT_PUBLIC_ENTRA_CLIENT_ID is not set. Login will fail. ' +
        'Create a SPA app registration in Azure Portal and add its client ID here.',
    );
  }
  if (!apiClientId) {
    console.error(
      'NEXT_PUBLIC_ENTRA_API_CLIENT_ID is not set. Token requests will fail. ' +
        'Use the same value as the backend ENTRA_API_CLIENT_ID.',
    );
  }
}
