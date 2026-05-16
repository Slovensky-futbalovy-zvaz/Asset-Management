/**
 * Categories repository — thin wrapper around MongoDB `categories` collection.
 *
 * Mirrors `AssetsRepository` patterns:
 *   - Repository returns raw docs (with _id as ObjectId)
 *   - Service is responsible for API response shape conversion
 *   - All write methods accept optional ClientSession for transactional use
 *
 * Categories form a hierarchy via `parentId` (nullable). The repository
 * does NOT enforce hierarchy invariants — that's the service's job
 * (cycle detection, max depth). The repository's responsibility is
 * mechanical CRUD + a few index-supported queries.
 */

import { ObjectId } from 'mongodb';

import type { Category } from '@inventario/shared-types';
import type { ClientSession, Collection, Db, Filter, FindOptions, WithId } from 'mongodb';

export interface ListCategoriesParams {
  limit?: number;
  skip?: number;
  filter?: Filter<Category>;
  sort?: FindOptions<Category>['sort'];
}

export interface ListCategoriesResult {
  items: WithId<Category>[];
  total: number;
}

/**
 * Patch shape for `update`. All fields optional; repository writes only
 * what's provided. Caller (service) adds `updatedAt`/`updatedBy`.
 *
 * `slug` is mutable because rename of a category may need to regenerate
 * the slug; service is responsible for collision check.
 */
export type CategoryUpdatePatch = Partial<Omit<Category, '_id' | 'createdAt' | 'createdBy'>>;

export class CategoriesRepository {
  private readonly collection: Collection<Category>;

  constructor(db: Db) {
    this.collection = db.collection<Category>('categories');
  }

  /**
   * Creates indexes if they don't exist. Idempotent.
   *
   * Index rationale:
   *   - `slug_unique` — slugs must be unique (URL routing depends on it)
   *   - `parentId` — common filter for "list children of X"
   *   - `assetType` — filter categories by asset type (IT/SPORT/etc)
   *   - `isActive` — common filter for active-only category pickers
   *   - `deletedAt` — soft-delete filter applied to every list query
   */
  async ensureIndexes(): Promise<void> {
    await Promise.all([
      this.collection.createIndex({ slug: 1 }, { unique: true, name: 'slug_unique' }),
      this.collection.createIndex({ parentId: 1 }, { name: 'parentId' }),
      this.collection.createIndex({ assetType: 1 }, { name: 'assetType' }),
      this.collection.createIndex({ isActive: 1 }, { name: 'isActive' }),
      this.collection.createIndex({ deletedAt: 1 }, { name: 'deletedAt' }),
    ]);
  }

  /**
   * List categories matching the given filter, with pagination.
   * Soft-deleted are excluded by default.
   */
  async list({
    limit = 50,
    skip = 0,
    filter = {},
    sort = { sortOrder: 1, name: 1 },
  }: ListCategoriesParams): Promise<ListCategoriesResult> {
    const effectiveFilter: Filter<Category> = {
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
   * Find a category by its `_id`. Returns null if not found or soft-deleted.
   */
  async findById(id: string, session?: ClientSession): Promise<WithId<Category> | null> {
    if (!ObjectId.isValid(id)) return null;

    return this.collection.findOne(
      {
        _id: new ObjectId(id) as unknown as Category['_id'],
        deletedAt: null,
      } as Filter<Category>,
      session ? { session } : undefined,
    );
  }

  /**
   * Find a category by its slug. Returns null if not found or soft-deleted.
   * Used for slug-uniqueness check and slug-based routing.
   */
  async findBySlug(slug: string, session?: ClientSession): Promise<WithId<Category> | null> {
    return this.collection.findOne(
      { slug, deletedAt: null } as Filter<Category>,
      session ? { session } : undefined,
    );
  }

  /**
   * Insert a new category. Returns the inserted document.
   * Caller is responsible for setting all required fields including slug,
   * audit fields, and ensuring schema compliance.
   */
  async insert(
    category: Omit<Category, '_id'>,
    session?: ClientSession,
  ): Promise<WithId<Category>> {
    const result = await this.collection.insertOne(
      category as unknown as Category,
      session ? { session } : undefined,
    );

    const inserted = await this.collection.findOne(
      { _id: result.insertedId } as Filter<Category>,
      session ? { session } : undefined,
    );

    if (!inserted) {
      throw new Error(
        `Category insert succeeded but read-back failed for _id=${String(result.insertedId)}`,
      );
    }

    return inserted;
  }

  /**
   * Apply a partial update. Returns updated doc or null if not found/deleted.
   * Caller is responsible for setting `updatedAt`/`updatedBy` in the patch.
   */
  async update(
    id: string,
    patch: CategoryUpdatePatch,
    session?: ClientSession,
  ): Promise<WithId<Category> | null> {
    if (!ObjectId.isValid(id)) return null;

    const result = await this.collection.findOneAndUpdate(
      {
        _id: new ObjectId(id) as unknown as Category['_id'],
        deletedAt: null,
      } as Filter<Category>,
      { $set: patch },
      {
        returnDocument: 'after',
        ...(session ? { session } : {}),
      },
    );

    return result ?? null;
  }

  /**
   * Soft-delete a category. Returns the document with deletedAt populated,
   * or null if not found / already deleted.
   */
  async softDelete(
    id: string,
    deletedBy: string,
    session?: ClientSession,
  ): Promise<WithId<Category> | null> {
    if (!ObjectId.isValid(id)) return null;

    const now = new Date().toISOString();

    const result = await this.collection.findOneAndUpdate(
      {
        _id: new ObjectId(id) as unknown as Category['_id'],
        deletedAt: null,
      } as Filter<Category>,
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
   * Count direct children (categories with parentId = this id).
   * Used by delete to prevent removing a category that has descendants.
   *
   * NOTE: parentId is stored as a 24-hex string (per ObjectIdSchema), not
   * as a BSON ObjectId. This matches the convention used for asset.categoryId,
   * asset.locationId, etc. The unique-index lookup is still fast on string.
   */
  async countChildren(parentId: string, session?: ClientSession): Promise<number> {
    return this.collection.countDocuments(
      { parentId, deletedAt: null } as Filter<Category>,
      session ? { session } : undefined,
    );
  }
}
