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

import type { User } from '@sfz/shared-types';
import type { Collection, Db, WithId } from 'mongodb';

// ---------------------------------------------------------------------------
// Projection — fields never returned to callers of the public methods.
// ---------------------------------------------------------------------------

const PUBLIC_PROJECTION = { passwordHash: 0 } as const;

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
