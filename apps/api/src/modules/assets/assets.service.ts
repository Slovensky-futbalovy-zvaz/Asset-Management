/**
 * Assets service — business logic layer.
 *
 * Orchestrates repository calls, applies business rules, transforms
 * documents into API response shape.
 *
 * In slice #1 this is intentionally thin (just pass-through to repo).
 * In later slices it will host:
 *   - Permission checks (can this user see this asset?)
 *   - Asset state transitions (AVAILABLE → BORROWED → AVAILABLE)
 *   - Audit log emission
 *   - Notifications
 */

import type { AssetsRepository, ListAssetsParams } from './assets.repository.js';

export interface ListAssetsResponse {
  data: Record<string, unknown>[];
  pagination: {
    total: number;
    limit: number;
    skip: number;
    hasMore: boolean;
  };
}

export class AssetsService {
  constructor(private readonly repo: AssetsRepository) {}

  async list(params: ListAssetsParams): Promise<ListAssetsResponse> {
    const limit = params.limit ?? 20;
    const skip = params.skip ?? 0;

    const { items, total } = await this.repo.list({ ...params, limit, skip });

    return {
      // Convert _id to string for JSON response (Mongo ObjectId is binary)
      data: items.map((doc) => ({
        ...doc,
        _id: String(doc._id),
      })) as Record<string, unknown>[],
      pagination: {
        total,
        limit,
        skip,
        hasMore: skip + items.length < total,
      },
    };
  }
}
