/**
 * Users repository — MongoDB CRUD for the `users` collection.
 *
 * The collection stores both Entra ID (SSO) and LOCAL accounts. For now,
 * only the Entra path is exercised — JIT provisioning happens on first
 * authenticated request.
 *
 * Indexes (created lazily on first use via `ensureIndexes`):
 *   - `entraOid` unique, sparse  → fast SSO lookup, allows null for LOCAL
 *   - `email`    unique          → enforce one account per email
 *   - `isActive + deletedAt`     → list-active queries
 *
 * We project out `passwordHash` on every read so secrets cannot accidentally
 * end up in API responses. Code that needs the hash (login flow, password
 * change) must use the dedicated `findByEmailWithCredentials` method.
 */

import { UserRole, type User } from '@sfz/shared-types';
import {
  ObjectId,
  type ClientSession,
  type Collection,
  type Db,
  type Filter,
  type FindOptions,
  type WithId,
} from 'mongodb';

// ---------------------------------------------------------------------------
// Projection — fields never returned to callers of the public methods.
// ---------------------------------------------------------------------------

const PUBLIC_PROJECTION = { passwordHash: 0 } as const;

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface ListUsersParams {
  limit?: number;
  skip?: number;
  filter?: Filter<User>;
  sort?: FindOptions<User>['sort'];
}

export interface ListUsersResult {
  items: WithId<User>[];
  total: number;
}

/**
 * Patch shape for `update`. All fields optional; repository writes only
 * what's provided. Caller (service) adds `updatedAt`/`updatedBy`.
 *
 * Intentionally narrower than `Partial<User>`: identity / audit / security
 * columns the admin endpoint must NEVER change are excluded at the type
 * level so we cannot accidentally PATCH them even if a future route forgets
 * to filter them out.
 */
export type UserUpdatePatch = Partial<
  Pick<
    User,
    | 'roles'
    | 'isActive'
    | 'firstName'
    | 'lastName'
    | 'displayName'
    | 'organizationalUnit'
    | 'teams'
    | 'mustChangePassword'
    | 'preferences'
    | 'updatedAt'
    | 'updatedBy'
  >
>;

// ---------------------------------------------------------------------------
// Repository
// ---------------------------------------------------------------------------

export class UsersRepository {
  private readonly collection: Collection<User>;

  constructor(db: Db) {
    this.collection = db.collection<User>('users');
  }

  /**
   * Creates indexes if they do not already exist. Idempotent — MongoDB
   * `createIndex` is a no-op when the index with the same spec exists.
   *
   * Called once at server startup (from users.service.ts during plugin
   * registration). Safe to call multiple times.
   */
  async ensureIndexes(): Promise<void> {
    await Promise.all([
      this.collection.createIndex(
        { entraOid: 1 },
        { unique: true, sparse: true, name: 'entraOid_unique' },
      ),
      this.collection.createIndex({ email: 1 }, { unique: true, name: 'email_unique' }),
      this.collection.createIndex({ isActive: 1, deletedAt: 1 }, { name: 'isActive_deletedAt' }),
    ]);
  }

  /**
   * Find a user by their Entra ID Object ID (`oid` claim).
   *
   * Returns `null` if no match. Soft-deleted users are EXCLUDED — we
   * treat them as non-existent for auth purposes.
   */
  async findByEntraOid(entraOid: string): Promise<WithId<User> | null> {
    return this.collection.findOne(
      { entraOid, deletedAt: null },
      { projection: PUBLIC_PROJECTION },
    );
  }

  /**
   * Find a user by their MongoDB `_id`. Soft-deleted users are EXCLUDED.
   *
   * Returns `null` if the id is malformed (not 24-hex) or no match.
   * Project out passwordHash as everywhere else.
   */
  async findById(id: string, session?: ClientSession): Promise<WithId<User> | null> {
    if (!ObjectId.isValid(id)) return null;

    return this.collection.findOne(
      {
        _id: new ObjectId(id) as unknown as User['_id'],
        deletedAt: null,
      } as Filter<User>,
      {
        projection: PUBLIC_PROJECTION,
        ...(session ? { session } : {}),
      },
    );
  }

  /**
   * List users matching the filter, with pagination. Soft-deleted are
   * excluded by default. Sort defaults to `displayName` ascending so the
   * admin UI gets a stable alphabetical ordering.
   *
   * Caller supplies the filter — `q` (free-text search) and role/active
   * filters are composed in the service layer so the repository stays
   * generic.
   */
  async list({
    limit = 50,
    skip = 0,
    filter = {},
    sort = { displayName: 1 },
  }: ListUsersParams): Promise<ListUsersResult> {
    const effectiveFilter: Filter<User> = {
      ...filter,
      ...(filter.deletedAt === undefined ? { deletedAt: null } : {}),
    };

    const [items, total] = await Promise.all([
      this.collection
        .find(effectiveFilter, { limit, skip, sort, projection: PUBLIC_PROJECTION })
        .toArray(),
      this.collection.countDocuments(effectiveFilter),
    ]);

    return { items, total };
  }

  /**
   * Apply a partial update. Returns updated doc or null if not found /
   * soft-deleted. Caller is responsible for setting `updatedAt`/`updatedBy`
   * in the patch.
   *
   * passwordHash is projected out of the returned document for consistency
   * with the rest of the repository's public methods.
   */
  async update(
    id: string,
    patch: UserUpdatePatch,
    session?: ClientSession,
  ): Promise<WithId<User> | null> {
    if (!ObjectId.isValid(id)) return null;

    const result = await this.collection.findOneAndUpdate(
      {
        _id: new ObjectId(id) as unknown as User['_id'],
        deletedAt: null,
      } as Filter<User>,
      { $set: patch },
      {
        returnDocument: 'after',
        projection: PUBLIC_PROJECTION,
        ...(session ? { session } : {}),
      },
    );

    return result ?? null;
  }

  /**
   * Count users who are active AND have the ADMIN role, excluding the
   * given userId (so the service can ask "would there still be an admin
   * AFTER I deactivate / demote this one?").
   *
   * Used by the last-admin guardrail in `UsersService.update` to refuse
   * patches that would leave the system with zero ADMINs. Runs inside the
   * same transaction as the patch to avoid a race with another admin
   * being deactivated in parallel.
   */
  async countActiveAdminsExcluding(userId: string, session?: ClientSession): Promise<number> {
    if (!ObjectId.isValid(userId)) {
      // Defensive: an invalid id means we can't exclude anything, so this
      // would return the full active-admin count. The route layer already
      // validates the id format, but mirror the guard from findById.
      return this.collection.countDocuments(
        {
          roles: UserRole.ADMIN,
          isActive: true,
          deletedAt: null,
        } as Filter<User>,
        session ? { session } : undefined,
      );
    }

    return this.collection.countDocuments(
      {
        _id: { $ne: new ObjectId(userId) as unknown as User['_id'] },
        roles: UserRole.ADMIN,
        isActive: true,
        deletedAt: null,
      } as Filter<User>,
      session ? { session } : undefined,
    );
  }

  /**
   * Insert a new user. Returns the inserted document with `_id` populated.
   *
   * Caller passes the document WITHOUT `_id` — MongoDB generates one.
   * We type this as `Omit<User, '_id'>` rather than `OptionalUnlessRequiredId<User>`
   * because the shared-types `UserSchema` declares `_id` as required (it always
   * is, post-insert), but at insert time we don't know it yet.
   *
   * Caller is responsible for providing all audit fields (`createdAt`,
   * `updatedAt`, `createdBy`, `updatedBy`). We don't fill them here because
   * the service layer needs to set them based on context.
   */
  async insert(user: Omit<User, '_id'>): Promise<WithId<User>> {
    // The Mongo driver types `insertOne` strictly: it expects either a full
    // document with `_id` matching the collection's type, or a document
    // where `_id` is optional. Our `_id` is a string in shared-types but
    // we let Mongo generate it as ObjectId, so cast through `unknown`.
    const { insertedId } = await this.collection.insertOne(user as unknown as User);

    // Re-fetch with projection so we don't accidentally return passwordHash
    // even though the caller may not have included it.
    const inserted = await this.collection.findOne(
      { _id: insertedId },
      { projection: PUBLIC_PROJECTION },
    );

    if (!inserted) {
      // This should never happen — we just inserted. But TS needs the guard.
      throw new Error(`User insert succeeded but read-back failed for _id=${String(insertedId)}`);
    }

    return inserted;
  }

  /**
   * Update `lastLoginAt` to the current time. Best-effort — failures here
   * should NOT block authentication, only be logged. Use `void` return to
   * make that contract explicit.
   */
  async touchLastLogin(entraOid: string): Promise<void> {
    const now = new Date().toISOString();
    await this.collection.updateOne({ entraOid }, { $set: { lastLoginAt: now, updatedAt: now } });
  }
}
