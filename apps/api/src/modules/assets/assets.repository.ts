/**
 * Assets repository — thin wrapper around MongoDB collection.
 *
 * Convention:
 *   - Repository methods return raw documents (with _id as ObjectId).
 *   - Service layer is responsible for converting to API response shape.
 *   - No business logic here — just Mongo primitives.
 *
 * Slice #2b additions:
 *   - `insert`, `update`, `softDelete` accept an optional `ClientSession`
 *     for transactional use (asset write + audit log in one atomic step).
 *   - `findHighestInventorySequence` powers server-side inventoryNumber
 *     auto-increment, called inside the same transaction as the insert.
 *   - `inventoryNumber_unique` index prevents accidental duplicates if
 *     transaction retry logic ever fails us.
 */

import { ObjectId } from 'mongodb';

import type { Asset } from '@inventario/shared-types';
import type { ClientSession, Collection, Db, Filter, FindOptions, WithId } from 'mongodb';

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

/**
 * Patch shape for `update`. All fields optional; repository only writes
 * what's provided. Caller (service) is responsible for adding
 * `updatedAt`/`updatedBy` to the patch.
 */
export type AssetUpdatePatch = Partial<
  Omit<Asset, '_id' | 'inventoryNumber' | 'createdAt' | 'createdBy'>
>;

export class AssetsRepository {
  private readonly collection: Collection<Asset>;

  constructor(db: Db) {
    this.collection = db.collection<Asset>('assets');
  }

  /**
   * Creates indexes if they do not already exist. Idempotent.
   *
   * Called once at server startup from the assets routes plugin.
   *
   * Index rationale:
   *   - `inventoryNumber_unique` — schema-level dedup; the auto-increment
   *     generator inside transactions is the primary defense, but the
   *     unique index is a hard floor.
   *   - `categoryId`, `locationId`, `status` — common filter columns for
   *     listing endpoints (slice #2b lists are unfiltered, but coming soon).
   *   - `createdAt_desc` — default sort for the list endpoint.
   *   - `deletedAt` — soft-delete filter is applied to every list query.
   */
  async ensureIndexes(): Promise<void> {
    await Promise.all([
      this.collection.createIndex(
        { inventoryNumber: 1 },
        { unique: true, name: 'inventoryNumber_unique' },
      ),
      this.collection.createIndex({ categoryId: 1 }, { name: 'categoryId' }),
      this.collection.createIndex({ locationId: 1 }, { name: 'locationId' }),
      this.collection.createIndex({ status: 1 }, { name: 'status' }),
      this.collection.createIndex({ createdAt: -1 }, { name: 'createdAt_desc' }),
      this.collection.createIndex({ deletedAt: 1 }, { name: 'deletedAt' }),
    ]);
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
   * Find a single asset by its MongoDB `_id` (24-char hex string).
   * Returns `null` if not found or soft-deleted.
   *
   * Throws nothing for invalid id format — caller should validate before
   * calling (Zod handles this on route params).
   */
  async findById(id: string, session?: ClientSession): Promise<WithId<Asset> | null> {
    if (!ObjectId.isValid(id)) return null;

    return this.collection.findOne(
      {
        _id: new ObjectId(id) as unknown as Asset['_id'],
        deletedAt: null,
      } as Filter<Asset>,
      session ? { session } : undefined,
    );
  }

  /**
   * Find the highest existing inventory sequence number for a (prefix, year)
   * pair. Returns 0 if no asset matches that prefix/year yet.
   *
   * Used by `AssetsService.create` inside a transaction to determine the
   * next sequence number for new assets.
   *
   * Format reminder: `${prefix}-${year}-${seq}` where seq is 3-6 digits.
   *
   * NOTE: This intentionally scans ALL documents matching the prefix+year
   * regex (not just non-deleted), because a deleted asset's number must
   * not be reused — that would create inventory-number ambiguity in the
   * audit history. The unique index enforces this at DB level too.
   */
  async findHighestInventorySequence(
    prefix: string,
    year: number,
    session?: ClientSession,
  ): Promise<number> {
    // Match e.g. "LT-2026-001" through "LT-2026-999999". The schema regex
    // already validated the prefix shape (1-5 uppercase letters), so we
    // can interpolate directly without further escaping.
    const pattern = new RegExp(`^${prefix}-${year}-(\\d{3,6})$`);

    const doc = await this.collection.findOne(
      { inventoryNumber: { $regex: pattern } } as Filter<Asset>,
      {
        sort: { inventoryNumber: -1 },
        projection: { inventoryNumber: 1 },
        ...(session ? { session } : {}),
      },
    );

    if (!doc) return 0;

    const match = pattern.exec(doc.inventoryNumber);
    if (!match || !match[1]) return 0;

    return parseInt(match[1], 10);
  }

  /**
   * Insert a new asset. Returns the inserted document.
   *
   * Caller is responsible for:
   *   - Providing all fields including `inventoryNumber` (generated by service)
   *   - Setting audit fields (`createdAt`, `updatedAt`, `createdBy`, `updatedBy`)
   *   - Validating against `CreateAssetSchema` from shared-types
   *
   * Pass a `session` to make this part of a transaction.
   */
  async insert(asset: Omit<Asset, '_id'>, session?: ClientSession): Promise<WithId<Asset>> {
    const result = await this.collection.insertOne(
      asset as unknown as Asset,
      session ? { session } : undefined,
    );

    // Re-fetch within the same session so we observe our own write
    // (read-after-write inside a transaction is consistent by definition,
    // but outside a transaction we still want the canonical document).
    const inserted = await this.collection.findOne(
      { _id: result.insertedId } as Filter<Asset>,
      session ? { session } : undefined,
    );

    if (!inserted) {
      throw new Error(
        `Asset insert succeeded but read-back failed for _id=${String(result.insertedId)}`,
      );
    }

    return inserted;
  }

  /**
   * Apply a partial update to an asset. Returns the updated document, or
   * `null` if the asset does not exist (or was already soft-deleted).
   *
   * Caller is responsible for setting `updatedAt` / `updatedBy` in the patch.
   * Pass a `session` to make this part of a transaction.
   */
  async update(
    id: string,
    patch: AssetUpdatePatch,
    session?: ClientSession,
  ): Promise<WithId<Asset> | null> {
    if (!ObjectId.isValid(id)) return null;

    const result = await this.collection.findOneAndUpdate(
      {
        _id: new ObjectId(id) as unknown as Asset['_id'],
        deletedAt: null,
      } as Filter<Asset>,
      { $set: patch },
      {
        returnDocument: 'after',
        ...(session ? { session } : {}),
      },
    );

    return result ?? null;
  }

  /**
   * Soft-delete an asset by setting `deletedAt` and `deletedBy`.
   *
   * Returns the document AS IT WAS AT DELETE TIME (i.e. with deletedAt
   * now populated). Returns `null` if not found or already deleted.
   *
   * Pass a `session` to make this part of a transaction.
   */
  async softDelete(
    id: string,
    deletedBy: string,
    session?: ClientSession,
  ): Promise<WithId<Asset> | null> {
    if (!ObjectId.isValid(id)) return null;

    const now = new Date().toISOString();

    const result = await this.collection.findOneAndUpdate(
      {
        _id: new ObjectId(id) as unknown as Asset['_id'],
        deletedAt: null,
      } as Filter<Asset>,
      {
        $set: {
          deletedAt: now,
          deletedBy,
          updatedAt: now,
          updatedBy: deletedBy,
        },
      },
      {
        returnDocument: 'after',
        ...(session ? { session } : {}),
      },
    );

    return result ?? null;
  }

  /**
   * Count non-deleted assets that reference a particular category id.
   * Used by CategoriesService.delete to refuse a delete that would
   * orphan referencing assets (slice #3 K9 FK protection).
   *
   * Soft-deleted assets are excluded because a deleted asset is no
   * longer a real reference — if you delete an asset, the category it
   * pointed at becomes safe to delete.
   *
   * Pass `session` to make this part of a transaction.
   */
  async countByCategory(categoryId: string, session?: ClientSession): Promise<number> {
    return this.collection.countDocuments(
      { categoryId, deletedAt: null } as Filter<Asset>,
      session ? { session } : undefined,
    );
  }

  /**
   * Count non-deleted assets that reference a particular location id.
   * Used by LocationsService.delete to refuse a delete that would
   * orphan referencing assets (slice #3 K9 FK protection).
   */
  async countByLocation(locationId: string, session?: ClientSession): Promise<number> {
    return this.collection.countDocuments(
      { locationId, deletedAt: null } as Filter<Asset>,
      session ? { session } : undefined,
    );
  }
}
