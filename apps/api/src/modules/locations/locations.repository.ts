/**
 * Locations repository — thin wrapper around MongoDB `locations` collection.
 *
 * Mirrors the categories repository in structure and contract — both
 * resources have the same shape (slug + hierarchy + soft-delete + audit
 * fields) so the patterns are identical. Only the type parameter and
 * a couple of index choices differ.
 *
 * Locations form a hierarchy via `parentId` (nullable). The repository
 * does NOT enforce hierarchy invariants — that's the service's job
 * (cycle detection, max depth). Repository responsibility is mechanical
 * CRUD + a few index-supported queries.
 */

import { ObjectId } from 'mongodb';

import type { Location } from '@sfz/shared-types';
import type { ClientSession, Collection, Db, Filter, FindOptions, WithId } from 'mongodb';

export interface ListLocationsParams {
  limit?: number;
  skip?: number;
  filter?: Filter<Location>;
  sort?: FindOptions<Location>['sort'];
}

export interface ListLocationsResult {
  items: WithId<Location>[];
  total: number;
}

/**
 * Patch shape for `update`. All fields optional; repository writes only
 * what's provided. Caller (service) adds `updatedAt`/`updatedBy`.
 *
 * `slug` is mutable but the service uses URL-stability rules: rename
 * via `name` does NOT regenerate slug, only an explicit slug patch does.
 */
export type LocationUpdatePatch = Partial<Omit<Location, '_id' | 'createdAt' | 'createdBy'>>;

export class LocationsRepository {
  private readonly collection: Collection<Location>;

  constructor(db: Db) {
    this.collection = db.collection<Location>('locations');
  }

  /**
   * Creates indexes if they don't exist. Idempotent.
   *
   * Index rationale:
   *   - `slug_unique` — slugs must be unique (URL routing depends on it)
   *   - `parentId` — common filter for "list children of X"
   *   - `type` — filter by location type (WAREHOUSE/OFFICE/STADIUM/etc)
   *   - `isActive` — filter for active-only location pickers
   *   - `deletedAt` — soft-delete filter applied to every list query
   */
  async ensureIndexes(): Promise<void> {
    await Promise.all([
      this.collection.createIndex({ slug: 1 }, { unique: true, name: 'slug_unique' }),
      this.collection.createIndex({ parentId: 1 }, { name: 'parentId' }),
      this.collection.createIndex({ type: 1 }, { name: 'type' }),
      this.collection.createIndex({ isActive: 1 }, { name: 'isActive' }),
      this.collection.createIndex({ deletedAt: 1 }, { name: 'deletedAt' }),
    ]);
  }

  /**
   * List locations matching the given filter, with pagination.
   * Soft-deleted are excluded by default.
   */
  async list({
    limit = 50,
    skip = 0,
    filter = {},
    sort = { name: 1 },
  }: ListLocationsParams): Promise<ListLocationsResult> {
    const effectiveFilter: Filter<Location> = {
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
   * Find a location by its `_id`. Returns null if not found or soft-deleted.
   */
  async findById(id: string, session?: ClientSession): Promise<WithId<Location> | null> {
    if (!ObjectId.isValid(id)) return null;

    return this.collection.findOne(
      {
        _id: new ObjectId(id) as unknown as Location['_id'],
        deletedAt: null,
      } as Filter<Location>,
      session ? { session } : undefined,
    );
  }

  /**
   * Find a location by its slug. Returns null if not found or soft-deleted.
   * Used for slug-uniqueness check and slug-based routing.
   */
  async findBySlug(slug: string, session?: ClientSession): Promise<WithId<Location> | null> {
    return this.collection.findOne(
      { slug, deletedAt: null } as Filter<Location>,
      session ? { session } : undefined,
    );
  }

  /**
   * Insert a new location. Returns the inserted document.
   * Caller is responsible for setting all required fields including slug,
   * audit fields, and ensuring schema compliance.
   */
  async insert(
    location: Omit<Location, '_id'>,
    session?: ClientSession,
  ): Promise<WithId<Location>> {
    const result = await this.collection.insertOne(
      location as unknown as Location,
      session ? { session } : undefined,
    );

    const inserted = await this.collection.findOne(
      { _id: result.insertedId } as Filter<Location>,
      session ? { session } : undefined,
    );

    if (!inserted) {
      throw new Error(
        `Location insert succeeded but read-back failed for _id=${String(result.insertedId)}`,
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
    patch: LocationUpdatePatch,
    session?: ClientSession,
  ): Promise<WithId<Location> | null> {
    if (!ObjectId.isValid(id)) return null;

    const result = await this.collection.findOneAndUpdate(
      {
        _id: new ObjectId(id) as unknown as Location['_id'],
        deletedAt: null,
      } as Filter<Location>,
      { $set: patch },
      {
        returnDocument: 'after',
        ...(session ? { session } : {}),
      },
    );

    return result ?? null;
  }

  /**
   * Soft-delete a location. Returns the document with deletedAt populated,
   * or null if not found / already deleted.
   */
  async softDelete(
    id: string,
    deletedBy: string,
    session?: ClientSession,
  ): Promise<WithId<Location> | null> {
    if (!ObjectId.isValid(id)) return null;

    const now = new Date().toISOString();

    const result = await this.collection.findOneAndUpdate(
      {
        _id: new ObjectId(id) as unknown as Location['_id'],
        deletedAt: null,
      } as Filter<Location>,
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
   * Count direct children (locations with parentId = this id).
   * Used by delete to prevent removing a location that has descendants.
   *
   * NOTE: parentId is stored as a 24-hex string (per ObjectIdSchema), not
   * as a BSON ObjectId. Matches the convention used for asset.locationId
   * and category.parentId.
   */
  async countChildren(parentId: string, session?: ClientSession): Promise<number> {
    return this.collection.countDocuments(
      { parentId, deletedAt: null } as Filter<Location>,
      session ? { session } : undefined,
    );
  }
}
