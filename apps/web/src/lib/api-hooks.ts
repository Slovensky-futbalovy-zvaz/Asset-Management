// SPDX-FileCopyrightText: 2026 Ján Letko / LTK Solutions
// SPDX-License-Identifier: EUPL-1.2

import { useIsAuthenticated } from '@azure/msal-react';
import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query';

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

// ---------------------------------------------------------------------------
// Single asset — detail + update
// ---------------------------------------------------------------------------

/**
 * Full asset shape returned by GET /v1/assets/:id.
 *
 * Wider than AssetSummary because the detail page needs every column
 * the backend persists. The schema lives in @inventario/shared-types
 * (AssetSchema), but we keep a local copy of the field surface here
 * for two reasons:
 *
 *   - openapi-typescript generates a deeply permissive record type
 *     for the path response (lots of `unknown`), so a narrow local
 *     interface gives much better autocomplete at every call site.
 *   - The shared Zod schema includes Date objects after parsing,
 *     but the HTTP boundary always ships ISO strings — we want the
 *     wire shape, not the parsed runtime shape.
 *
 * Stays in sync via the openapi.json freshness CI check + manual
 * review when the backend asset schema changes.
 */
export interface AssetDetail {
  _id: string;
  organisationId: string;
  inventoryNumber: string;
  serialNumber: string | null;
  name: string;
  description: string | null;
  type: string;
  categoryId: string;
  status: string;
  condition: string;
  locationId: string;
  currentLoanId: string | null;
  manufacturer: string | null;
  model: string | null;
  acquiredAt: string;
  acquisitionCost: number | null;
  warrantyUntil: string | null;
  specs: Record<string, unknown>;
  tags: string[];
  imageIds: string[];
  internalNotes: string | null;
  isLoanable: boolean;
  requiresApproval: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy: string | null;
  updatedBy: string | null;
  deletedAt: string | null;
  deletedBy: string | null;
}

/**
 * Patchable subset of AssetDetail. Mirrors the server's
 * UpdateAssetSchema (shared-types) — everything optional, but never
 * `inventoryNumber` (immutable identity) and never `organisationId`
 * (tenant scope is immutable).
 */
export type AssetUpdatePatch = Partial<
  Omit<
    AssetDetail,
    | '_id'
    | 'organisationId'
    | 'inventoryNumber'
    | 'createdAt'
    | 'updatedAt'
    | 'createdBy'
    | 'updatedBy'
    | 'deletedAt'
    | 'deletedBy'
    | 'currentLoanId'
  >
>;

/**
 * Fetch a single asset by ID. Returns isError + 404-aware error so
 * the page can render a "not found" empty state distinct from
 * "server unreachable".
 *
 * Why a separate hook instead of useAssets({ filter: { _id } }):
 *   the backend exposes /v1/assets/:id with stricter tenant scoping
 *   and access logging than the list endpoint. We want to honour
 *   that boundary on the client too.
 */
export function useAsset(id: string | null): UseQueryResult<AssetDetail, Error> {
  const isAuthenticated = useIsAuthenticated();

  return useQuery<AssetDetail, Error>({
    queryKey: ['asset', id],
    enabled: isAuthenticated && typeof id === 'string' && id.length > 0,
    queryFn: async () => {
      if (!id) {
        // useQuery only invokes queryFn when `enabled` is true, so this
        // path is unreachable at runtime — but the type narrowing helps
        // satisfy openapi-fetch's path-param requirement below.
        throw new Error('Asset ID is required.');
      }
      const result = await apiClient.GET('/v1/assets/{id}', {
        params: { path: { id } },
      });
      const { data, error } = result;
      // openapi-fetch types `response` as `never` when the spec doesn't
      // declare error responses for the endpoint. Cast to a vanilla
      // Response so we can read the status code for the 404-vs-other
      // branch the UI cares about.
      const response = (result as unknown as { response?: Response }).response;
      if (error) {
        const errObj = error as unknown as { message?: unknown };
        const msg = typeof errObj.message === 'string' ? errObj.message : 'Failed to load asset';
        // Attach status code so the page can render the right empty
        // state for 404 vs 403 vs 5xx without re-parsing the message.
        const wrapped = new Error(msg) as Error & { status?: number };
        if (response?.status != null) {
          wrapped.status = response.status;
        }
        throw wrapped;
      }
      if (!data) {
        throw new Error('Empty response from /v1/assets/:id');
      }
      return data as unknown as AssetDetail;
    },
  });
}

/**
 * PATCH an asset. On success invalidates both the single-asset cache
 * and any list views so the change shows up everywhere immediately.
 *
 * Variables shape is `{ id, patch }` rather than the patch alone so a
 * single mutation instance can be reused across different assets
 * (rare, but cheap to support and makes the call site read naturally:
 * `mutate({ id, patch: dirtyFields })`).
 */
export function useUpdateAsset(): UseMutationResult<
  AssetDetail,
  Error,
  { id: string; patch: AssetUpdatePatch }
> {
  const queryClient = useQueryClient();

  return useMutation<AssetDetail, Error, { id: string; patch: AssetUpdatePatch }>({
    mutationFn: async ({ id, patch }) => {
      const { data, error } = await apiClient.PATCH('/v1/assets/{id}', {
        params: { path: { id } },
        // openapi-fetch types the body off the spec; cast through unknown
        // because the spec's Update body has the same shape as our local
        // AssetUpdatePatch but with more permissive `unknown` fields.
        body: patch as unknown as never,
      });
      if (error) {
        const errObj = error as unknown as { message?: unknown };
        throw new Error(
          typeof errObj.message === 'string' ? errObj.message : 'Failed to update asset',
        );
      }
      if (!data) {
        throw new Error('Empty response after asset update');
      }
      return data as unknown as AssetDetail;
    },
    onSuccess: (updated) => {
      // Replace the cached detail with the freshly-returned document,
      // so the UI flips back to read mode without an extra round-trip.
      queryClient.setQueryData(['asset', updated._id], updated);
      // Invalidate every list — we can't know which page the asset
      // appears on, and refetching is cheaper than reconciling.
      void queryClient.invalidateQueries({ queryKey: ['assets'] });
    },
  });
}

// ---------------------------------------------------------------------------
// Role helpers
// ---------------------------------------------------------------------------

/**
 * Roles defined by the backend. Kept in sync with packages/shared-types
 * (UserRole enum). Listed here as a const tuple so `Role` is a narrow
 * union type useful in role-gating hooks.
 */
export const USER_ROLES = ['EMPLOYEE', 'ASSET_MANAGER', 'ADMIN'] as const;
export type Role = (typeof USER_ROLES)[number];

/**
 * Returns whether the current user can mutate assets. Matches the
 * backend's RBAC for POST/PATCH /v1/assets: ASSET_MANAGER and ADMIN
 * pass, EMPLOYEE does not. Stays in sync via the route guards in
 * apps/api/src/routes/assets.ts.
 *
 * Returns `false` while the /v1/me query is loading — pessimistic by
 * design, so the UI never flashes an edit button to a user who
 * shouldn't see it.
 */
export function useCanEditAssets(): boolean {
  const me = useMe();
  const roles = me.data?.roles ?? [];
  return roles.includes('ASSET_MANAGER') || roles.includes('ADMIN');
}
