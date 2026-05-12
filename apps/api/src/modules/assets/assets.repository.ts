/**
 * Assets repository — thin wrapper around MongoDB collection.
 *
 * Convention:
 *   - Repository methods return raw documents (with _id as ObjectId).
 *   - Service layer is responsible for converting to API response shape.
 *   - No business logic here — just Mongo primitives.
 */

import type { Asset } from '@sfz/shared-types';
import type { Collection, Db, Filter, FindOptions, WithId } from 'mongodb';

export interface ListAssetsParams {
  limit?: number;
  skip?: number;
  filter?: Filter<Asset>;
  sort?: FindOptions<Asset>['sort'];
}

export interface ListAssetsResult {
  items: WithId<Asset>[];
  total: number;
}

export class AssetsRepository {
  private readonly collection: Collection<Asset>;

  constructor(db: Db) {
    this.collection = db.collection<Asset>('assets');
  }

  /**
   * List assets matching the given filter, with pagination.
   *
   * Returns items + total count. Total is computed via `countDocuments`
   * which is fast on small collections; for large collections we'd
   * switch to cursor-based pagination (using last `_id` as cursor).
   */
  async list({
    limit = 20,
    skip = 0,
    filter = {},
    sort = { createdAt: -1 },
  }: ListAssetsParams): Promise<ListAssetsResult> {
    // Exclude soft-deleted assets by default
    const effectiveFilter: Filter<Asset> = {
      ...filter,
      ...(filter.deletedAt === undefined ? { deletedAt: null } : {}),
    };

    const [items, total] = await Promise.all([
      this.collection.find(effectiveFilter, { limit, skip, sort }).toArray(),
      this.collection.countDocuments(effectiveFilter),
    ]);

    return { items, total };
  }

  /**
   * Find a single asset by its MongoDB `_id` (string form).
   * Returns `null` if not found or soft-deleted.
   */
  async findById(id: string): Promise<WithId<Asset> | null> {
    // We store _id as ObjectId by default; if your seed data uses strings,
    // adjust accordingly. For now, treat the id as opaque string.
    return this.collection.findOne({
      _id: id as unknown as Asset['_id'],
      deletedAt: null,
    } as Filter<Asset>);
  }
}
