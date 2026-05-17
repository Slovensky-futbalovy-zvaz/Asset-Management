// SPDX-FileCopyrightText: 2026 Ján Letko / LTK Solutions
// SPDX-License-Identifier: EUPL-1.2

import { useIsAuthenticated } from '@azure/msal-react';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { apiClient } from './api-client';

/**
 * TanStack Query hooks wrapping the generated openapi-fetch client.
 *
 * Every hook follows the same pattern:
 *   1. Query key is namespaced under a string literal so we can
 *      invalidate slices independently (e.g. `assets`, `categories`).
 *   2. The query function calls apiClient and unwraps `{ data, error }`,
 *      throwing on error so TanStack can route it through its error
 *      state. The thrown value is the parsed error body when the
 *      backend returned one, or the underlying Error otherwise.
 *   3. `enabled` defaults to whether the user is authenticated —
 *      pre-login dashboards stay silent instead of hammering the API
 *      with 401s.
 *
 * Why one tiny hook per endpoint instead of a fully generic helper:
 *   typed query keys (e.g. ['assets', { limit, skip, filters }]) are
 *   much easier to reason about than a generic wrapper, and the
 *   compile-time autocomplete on filters is worth the small repetition.
 */

// ---------------------------------------------------------------------------
// Response type aliases
// ---------------------------------------------------------------------------

/**
 * The Me response shape. Defined here because /v1/me's response
 * schema is a small subset of the full User document — re-using a
 * full User type would over-expose fields and confuse downstream
 * code about what's actually available client-side.
 */
export interface MeResponse {
  _id: string;
  email: string;
  firstName: string;
  lastName: string;
  displayName: string;
  accountType: string;
  roles: string[];
  isActive: boolean;
  lastLoginAt: string | null;
  preferences: Record<string, unknown>;
  createdAt: string;
}

/**
 * Generic list-response wrapper used by all paginated endpoints
 * (assets, categories, locations, users).
 */
export interface ListResponse<T> {
  data: T[];
  pagination: {
    total: number;
    limit: number;
    skip: number;
    hasMore: boolean;
  };
}

// ---------------------------------------------------------------------------
// /v1/me — current authenticated user
// ---------------------------------------------------------------------------

/**
 * Fetch the current user. Pair with useIsAuthenticated() upstream;
 * this hook itself gates on the same signal so it doesn't fire
 * pre-login.
 */
export function useMe(): UseQueryResult<MeResponse, Error> {
  const isAuthenticated = useIsAuthenticated();

  return useQuery<MeResponse, Error>({
    queryKey: ['me'],
    enabled: isAuthenticated,
    queryFn: async () => {
      const { data, error } = await apiClient.GET('/v1/me');
      if (error) {
        // The openapi-fetch error type is `never` for endpoints that
        // don't declare error responses in the spec. Cast through
        // unknown so we can still surface the runtime payload (the
        // backend's error-handler.ts returns { message, code, ... }).
        const errObj = error as unknown as { message?: unknown };
        throw new Error(
          typeof errObj.message === 'string' ? errObj.message : 'Failed to load current user',
        );
      }
      if (!data) {
        throw new Error('Empty response from /v1/me');
      }
      // Cast through unknown — the openapi-typescript schema uses a
      // permissive record shape, but we know the route returns the
      // MeResponse fields (the response schema is enforced server-side).
      return data as unknown as MeResponse;
    },
  });
}

// ---------------------------------------------------------------------------
// Generic list fetchers — keep the signatures uniform across resources
// ---------------------------------------------------------------------------

interface ListQueryOptions {
  limit?: number;
  skip?: number;
}

/**
 * Build a list-fetcher hook for a resource. Reduces boilerplate while
 * keeping each call site type-checkable.
 *
 * Used internally — exported hooks below wrap this with concrete
 * resource names so the query keys stay readable.
 */
function makeListHook<TItem>(
  resourceKey: string,
  path: '/v1/assets' | '/v1/categories' | '/v1/locations',
) {
  return function useResourceList(
    options: ListQueryOptions = {},
  ): UseQueryResult<ListResponse<TItem>, Error> {
    const { limit = 50, skip = 0 } = options;
    const isAuthenticated = useIsAuthenticated();

    return useQuery<ListResponse<TItem>, Error>({
      queryKey: [resourceKey, { limit, skip }],
      enabled: isAuthenticated,
      queryFn: async () => {
        const { data, error } = await apiClient.GET(path, {
          params: { query: { limit, skip } },
        });
        if (error) {
          // See useMe — the spec doesn't declare error responses, so
          // openapi-fetch types `error` as `never`. Cast and inspect.
          const errObj = error as unknown as { message?: unknown };
          throw new Error(
            typeof errObj.message === 'string' ? errObj.message : `Failed to load ${resourceKey}`,
          );
        }
        if (!data) {
          throw new Error(`Empty response from ${path}`);
        }
        return data as unknown as ListResponse<TItem>;
      },
    });
  };
}

// ---------------------------------------------------------------------------
// Resource list hooks
// ---------------------------------------------------------------------------

/**
 * Minimal asset shape used by the dashboard and list pages. The full
 * Asset schema has many more fields; we only project what the UI
 * actually renders. Code that needs more fields casts the result.
 */
export interface AssetSummary {
  _id: string;
  inventoryNumber: string;
  name: string;
  status: string;
  categoryId: string;
  locationId: string;
  [key: string]: unknown;
}

export interface CategorySummary {
  _id: string;
  name: string;
  slug: string;
  assetType: string;
  isActive: boolean;
  [key: string]: unknown;
}

export interface LocationSummary {
  _id: string;
  name: string;
  slug: string;
  type: string;
  isActive: boolean;
  [key: string]: unknown;
}

export const useAssets = makeListHook<AssetSummary>('assets', '/v1/assets');
export const useCategories = makeListHook<CategorySummary>('categories', '/v1/categories');
export const useLocations = makeListHook<LocationSummary>('locations', '/v1/locations');
