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
 *
 * Phase C Blok 2 additions (multi-tenant scoping):
 *   - Every read/write method takes `organisationId` as a required first
 *     parameter. The repository validates the id via `requireTenantId`
 *     and composes it into every filter via `tenantFilter`, so no query
 *     can accidentally span tenants.
 *   - `inventoryNumber` uniqueness becomes per-tenant (composite index
 *     `{organisationId: 1, inventoryNumber: 1}`). Two tenants can now
 *     have an asset with the same inventoryNumber without collision.
 *   - The unchanged primary keys (`_id` lookups) still get a tenant
 *     filter on top, so even a leaked id cannot read a different
 *     tenant's document.
 */

import { ObjectId } from 'mongodb';

import { requireTenantId, tenantFilter } from '../../lib/organisation-scoping.js';

import type { Asset } from '@inventario/shared-types';
import type { ClientSession, Collection, Db, Filter, FindOptions, WithId } from 'mongodb';

export interface ListAssetsParams {
  /** Tenant scope. Required. */
  organisationId: string;
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
 *
 * `organisationId` is excluded because tenant scope is immutable post
 * creation — moving an asset between tenants requires an explicit data
 * migration, not a PATCH.
 */
export type AssetUpdatePatch = Partial<
  Omit<Asset, '_id' | 'organisationId' | 'inventoryNumber' | 'createdAt' | 'createdBy'>
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
   *   - `organisationId_inventoryNumber_unique` — schema-level dedup;
   *     uniqueness is per-tenant (composite key) so two tenants can
   *     each have e.g. "LT-2026-001" without colliding. The
   *     auto-increment generator inside transactions is the primary
   *     defense, but the unique index is a hard floor.
   *   - `organisationId_categoryId`, `organisationId_locationId`,
   *     `organisationId_status` — composite filters: every list query
   *     is scoped to a tenant AND filtered by one of these fields, so
   *     leading with `organisationId` makes the index usable for both.
   *   - `organisationId_createdAt_desc` — default sort for the list
   *     endpoint, scoped per-tenant.
   *   - `deletedAt` — soft-delete filter is applied to every list
   *     query.
   */
  async ensureIndexes(): Promise<void> {
    await Promise.all([
      this.collection.createIndex(
        { organisationId: 1, inventoryNumber: 1 },
        { unique: true, name: 'organisationId_inventoryNumber_unique' },
      ),
      this.collection.createIndex(
        { organisationId: 1, categoryId: 1 },
        { name: 'organisationId_categoryId' },
      ),
      this.collection.createIndex(
        { organisationId: 1, locationId: 1 },
        { name: 'organisationId_locationId' },
      ),
      this.collection.createIndex(
        { organisationId: 1, status: 1 },
        { name: 'organisationId_status' },
      ),
      this.collection.createIndex(
        { organisationId: 1, createdAt: -1 },
        { name: 'organisationId_createdAt_desc' },
      ),
      this.collection.createIndex({ deletedAt: 1 }, { name: 'deletedAt' }),
    ]);
  }

  /**
   * List assets matching the given filter, with pagination. Tenant-scoped.
   *
   * Returns items + total count. Total is computed via `countDocuments`
   * which is fast on small collections; for large collections we'd
   * switch to cursor-based pagination (using last `_id` as cursor).
   */
  async list({
    organisationId,
    limit = 20,
    skip = 0,
    filter = {},
    sort = { createdAt: -1 },
  }: ListAssetsParams): Promise<ListAssetsResult> {
    const tenantId = requireTenantId(organisationId);
    const effectiveFilter = tenantFilter<Asset>(tenantId, filter);

    const [items, total] = await Promise.all([
      this.collection.find(effectiveFilter, { limit, skip, sort }).toArray(),
      this.collection.countDocuments(effectiveFilter),
    ]);

    return { items, total };
  }

  /**
   * Find a single asset by its MongoDB `_id` (24-char hex string).
   * Returns `null` if not found, soft-deleted, or in a different tenant.
   *
   * Throws nothing for invalid id format — caller should validate before
   * calling (Zod handles this on route params).
   */
  async findById(
    organisationId: string,
    id: string,
    session?: ClientSession,
  ): Promise<WithId<Asset> | null> {
    const tenantId = requireTenantId(organisationId);
    if (!ObjectId.isValid(id)) return null;

    return this.collection.findOne(
      tenantFilter<Asset>(tenantId, {
        _id: new ObjectId(id) as unknown as Asset['_id'],
      } as Filter<Asset>),
      session ? { session } : undefined,
    );
  }

  /**
   * Find the highest existing inventory sequence number for a
   * (tenant, prefix, year) tuple. Returns 0 if no asset matches yet.
   *
   * Used by `AssetsService.create` inside a transaction to determine
   * the next sequence number for new assets. Tenant-scoped: each tenant
   * keeps its own independent sequence — tenant A's "LT-2026-001" and
   * tenant B's "LT-2026-001" do not collide.
   *
   * Format reminder: `${prefix}-${year}-${seq}` where seq is 3-6 digits.
   *
   * NOTE: This intentionally scans ALL documents matching the prefix
   * +year regex within the tenant (not just non-deleted), because a
   * deleted asset's number must not be reused — that would create
   * inventory-number ambiguity in the audit history. The unique index
   * enforces this at DB level too.
   */
  async findHighestInventorySequence(
    organisationId: string,
    prefix: string,
    year: number,
    session?: ClientSession,
  ): Promise<number> {
    const tenantId = requireTenantId(organisationId);
    // Match e.g. "LT-2026-001" through "LT-2026-999999". The schema
    // regex already validated the prefix shape (1-5 uppercase letters),
    // so we can interpolate directly without further escaping.
    const pattern = new RegExp(`^${prefix}-${year}-(\\d{3,6})$`);

    const doc = await this.collection.findOne(
      tenantFilter<Asset>(tenantId, { inventoryNumber: { $regex: pattern } } as Filter<Asset>, {
        includeDeleted: true,
      }),
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
   *   - Providing all fields including `organisationId` and
   *     `inventoryNumber` (the service sets both before calling).
   *   - Setting audit fields (`createdAt`, `updatedAt`, `createdBy`,
   *     `updatedBy`)
   *   - Validating against `CreateAssetSchema` from shared-types
   *
   * Pass a `session` to make this part of a transaction.
   *
   * No tenantId parameter here: the document being inserted already
   * carries `organisationId`, and the service has set it from the
   * authenticated actor's tenant. The driver writes what we give it.
   */
  async insert(asset: Omit<Asset, '_id'>, session?: ClientSession): Promise<WithId<Asset>> {
    const result = await this.collection.insertOne(
      asset as unknown as Asset,
      session ? { session } : undefined,
    );

    // Re-fetch within the same session so we observe our own write
    // (read-after-write inside a transaction is consistent by
    // definition, but outside a transaction we still want the
    // canonical document).
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
   * Apply a partial update to an asset. Returns the updated document,
   * or `null` if the asset does not exist, was already soft-deleted, or
   * belongs to a different tenant.
   *
   * Caller is responsible for setting `updatedAt` / `updatedBy` in the
   * patch. Pass a `session` to make this part of a transaction.
   */
  async update(
    organisationId: string,
    id: string,
    patch: AssetUpdatePatch,
    session?: ClientSession,
  ): Promise<WithId<Asset> | null> {
    const tenantId = requireTenantId(organisationId);
    if (!ObjectId.isValid(id)) return null;

    const result = await this.collection.findOneAndUpdate(
      tenantFilter<Asset>(tenantId, {
        _id: new ObjectId(id) as unknown as Asset['_id'],
      } as Filter<Asset>),
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
   * now populated). Returns `null` if not found, already deleted, or in
   * a different tenant.
   *
   * Pass a `session` to make this part of a transaction.
   */
  async softDelete(
    organisationId: string,
    id: string,
    deletedBy: string,
    session?: ClientSession,
  ): Promise<WithId<Asset> | null> {
    const tenantId = requireTenantId(organisationId);
    if (!ObjectId.isValid(id)) return null;

    const now = new Date().toISOString();

    const result = await this.collection.findOneAndUpdate(
      tenantFilter<Asset>(tenantId, {
        _id: new ObjectId(id) as unknown as Asset['_id'],
      } as Filter<Asset>),
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
   * Count non-deleted assets within the given tenant that reference a
   * particular category id. Used by CategoriesService.delete to refuse
   * a delete that would orphan referencing assets (slice #3 K9 FK
   * protection).
   *
   * Soft-deleted assets are excluded because a deleted asset is no
   * longer a real reference — if you delete an asset, the category it
   * pointed at becomes safe to delete.
   *
   * Pass `session` to make this part of a transaction.
   */
  async countByCategory(
    organisationId: string,
    categoryId: string,
    session?: ClientSession,
  ): Promise<number> {
    const tenantId = requireTenantId(organisationId);
    return this.collection.countDocuments(
      tenantFilter<Asset>(tenantId, { categoryId } as Filter<Asset>),
      session ? { session } : undefined,
    );
  }

  /**
   * Count non-deleted assets within the given tenant that reference a
   * particular location id. Used by LocationsService.delete to refuse a
   * delete that would orphan referencing assets (slice #3 K9 FK
   * protection).
   */
  async countByLocation(
    organisationId: string,
    locationId: string,
    session?: ClientSession,
  ): Promise<number> {
    const tenantId = requireTenantId(organisationId);
    return this.collection.countDocuments(
      tenantFilter<Asset>(tenantId, { locationId } as Filter<Asset>),
      session ? { session } : undefined,
    );
  }
}
