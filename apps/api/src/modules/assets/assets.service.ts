/**
 * Assets service — business logic for asset management.
 *
 * Responsibilities:
 *   - Generate `inventoryNumber` server-side (auto-increment per prefix+year)
 *   - Set audit fields (`createdAt`, `updatedAt`, `createdBy`, `updatedBy`)
 *   - Compute diffs for audit log on update
 *   - Wrap state-changing ops in transactions (asset + audit atomic)
 *
 * Transaction strategy:
 *   Every state-changing op (create/update/delete) opens a Mongo session,
 *   does the asset write and the audit log write under the same session,
 *   then commits. If either fails, the transaction aborts and BOTH writes
 *   are rolled back. No orphan audit records, no missing audit records.
 *
 *   This requires a replica set (Flex tier or higher). On a single-node
 *   M0 cluster, `client.startSession()` works but `session.startTransaction()`
 *   fails with "Transaction numbers are only allowed on a replica set member".
 *
 * Why server-generated inventoryNumber:
 *   Clients sending sequence numbers directly would race on concurrent
 *   inserts and create duplicates. Generating inside the transaction
 *   that does the insert ensures consistency: if another insert finishes
 *   between our find-max and our insert, the unique index aborts our
 *   transaction and the driver retries with the updated max.
 */

import { BadRequestError, NotFoundError } from '../../plugins/error-handler.js';

import { computeShallowDiff } from './assets-diff.js';

import type { AssetsRepository, AssetUpdatePatch, ListAssetsParams } from './assets.repository.js';
import type { AuditLogService } from '../audit/audit.service.js';
import type { CategoriesRepository } from '../categories/categories.repository.js';
import type { LocationsRepository } from '../locations/locations.repository.js';
import type { Asset, CreateAssetInput, UpdateAssetInput, User } from '@inventario/shared-types';
import type { FastifyRequest } from 'fastify';
import type { ClientSession, MongoClient, WithId } from 'mongodb';

// ---------------------------------------------------------------------------
// Public API types
// ---------------------------------------------------------------------------

export interface ListAssetsResponse {
  data: Record<string, unknown>[];
  pagination: {
    total: number;
    limit: number;
    skip: number;
    hasMore: boolean;
  };
}

/**
 * Service-layer input for creating an asset.
 *
 * Differs from `CreateAssetInput` (shared-types) in one key way:
 *   - Schema's `inventoryNumber` is replaced by `inventoryNumberPrefix`.
 *     The service computes the full number from prefix + current year + seq.
 *
 * The routes layer is responsible for transforming the HTTP body into this
 * shape (stripping `inventoryNumber` if present, requiring `inventoryNumberPrefix`).
 */
export type CreateAssetServiceInput = Omit<CreateAssetInput, 'inventoryNumber'> & {
  inventoryNumberPrefix: string;
};

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class AssetsService {
  constructor(
    private readonly repo: AssetsRepository,
    private readonly auditLog: AuditLogService,
    private readonly mongoClient: MongoClient,
    private readonly categoriesRepo: CategoriesRepository,
    private readonly locationsRepo: LocationsRepository,
  ) {}

  // -------------------------------------------------------------------------
  // Read paths (no transaction needed)
  // -------------------------------------------------------------------------

  async list(params: ListAssetsParams): Promise<ListAssetsResponse> {
    const limit = params.limit ?? 20;
    const skip = params.skip ?? 0;

    const { items, total } = await this.repo.list({ ...params, limit, skip });

    return {
      data: items.map(toApiShape),
      pagination: {
        total,
        limit,
        skip,
        hasMore: skip + items.length < total,
      },
    };
  }

  async getById(id: string): Promise<Record<string, unknown>> {
    const doc = await this.repo.findById(id);
    if (!doc) {
      throw new NotFoundError('Asset', id);
    }
    return toApiShape(doc);
  }

  // -------------------------------------------------------------------------
  // Write paths (transactional)
  // -------------------------------------------------------------------------

  /**
   * Create a new asset. Server generates `inventoryNumber` from the
   * provided prefix and the current year, sequenced via the highest
   * existing number in `(prefix, year)`.
   *
   * Records an `ASSET_CREATED` audit log event atomically with the insert.
   */
  async create(
    input: CreateAssetServiceInput,
    user: WithId<User>,
    request: FastifyRequest,
  ): Promise<Record<string, unknown>> {
    const { inventoryNumberPrefix, ...assetData } = input;
    const userId = String(user._id);

    const inserted = await this.runInTransaction(async (session) => {
      // ----- Step 0: FK validation (category + location must exist) -----
      //
      // Defense in depth: route schemas enforce 24-hex format, but the IDs
      // could still point to non-existent or soft-deleted documents. We
      // verify both before doing anything else so the user gets a clear
      // "category X does not exist" instead of a successful insert that
      // leaves the asset pointing at a phantom reference.
      await this.assertFkExists('category', input.categoryId, session);
      await this.assertFkExists('location', input.locationId, session);

      // ----- Step 1: generate the next inventoryNumber -----
      //
      // Inside the transaction so any concurrent insert that committed
      // between our find and our insert would conflict on the unique
      // index and trigger a retry (Mongo's retryWrites + startTransaction
      // semantics).
      const year = new Date().getFullYear();
      const highestSeq = await this.repo.findHighestInventorySequence(
        inventoryNumberPrefix,
        year,
        session,
      );
      const nextSeq = highestSeq + 1;
      const inventoryNumber = `${inventoryNumberPrefix}-${year}-${String(nextSeq).padStart(3, '0')}`;

      // ----- Step 2: build the full Asset document -----
      const now = new Date().toISOString();
      const doc: Omit<Asset, '_id'> = {
        ...(assetData as Omit<
          Asset,
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
        >),
        organisationId: String(user.organisationId),
        inventoryNumber,
        currentLoanId: null,
        createdAt: now,
        updatedAt: now,
        createdBy: userId,
        updatedBy: userId,
        deletedAt: null,
        deletedBy: null,
      };

      // ----- Step 3: insert + audit log, atomically -----
      const insertedDoc = await this.repo.insert(doc, session);

      await this.auditLog.record(
        user,
        request,
        {
          action: 'ASSET_CREATED',
          target: {
            entityType: 'Asset',
            entityId: String(insertedDoc._id),
            snapshot: {
              inventoryNumber: insertedDoc.inventoryNumber,
              name: insertedDoc.name,
              status: insertedDoc.status,
            },
          },
          description: `Created asset ${insertedDoc.inventoryNumber} — ${insertedDoc.name}`,
        },
        session,
      );

      return insertedDoc;
    });

    return toApiShape(inserted);
  }

  /**
   * Update an existing asset with a partial patch.
   *
   * Records an `ASSET_UPDATED` audit log event with a per-field diff
   * (top-level fields only — nested object diffing is a future enhancement).
   *
   * Throws `NotFoundError` if the asset doesn't exist or is soft-deleted.
   */
  async update(
    id: string,
    patch: UpdateAssetInput,
    user: WithId<User>,
    request: FastifyRequest,
  ): Promise<Record<string, unknown>> {
    const userId = String(user._id);

    const updated = await this.runInTransaction(async (session) => {
      // ----- Step 1: load the current document for diff computation -----
      const before = await this.repo.findById(id, session);
      if (!before) {
        throw new NotFoundError('Asset', id);
      }

      // ----- Step 1b: FK validation (only when changing the FK fields) -----
      //
      // Same rationale as in create: catch dangling references early. We
      // only check fields the patch actually changes, so a patch that
      // doesn't touch categoryId/locationId pays no extra DB cost.
      const typedPatch = patch as Partial<{ categoryId: string; locationId: string }>;
      if (typedPatch.categoryId !== undefined && typedPatch.categoryId !== before.categoryId) {
        await this.assertFkExists('category', typedPatch.categoryId, session);
      }
      if (typedPatch.locationId !== undefined && typedPatch.locationId !== before.locationId) {
        await this.assertFkExists('location', typedPatch.locationId, session);
      }

      // ----- Step 2: prepare the patch with audit fields -----
      const now = new Date().toISOString();
      const fullPatch: AssetUpdatePatch = {
        ...(patch as AssetUpdatePatch),
        updatedAt: now,
        updatedBy: userId,
      };

      // ----- Step 3: apply the update -----
      const after = await this.repo.update(id, fullPatch, session);
      if (!after) {
        // Race: the doc was soft-deleted between our findById and update.
        // Treat as not-found from the caller's perspective.
        throw new NotFoundError('Asset', id);
      }

      // ----- Step 4: compute diff and log audit event -----
      const changes = computeShallowDiff(before, after, ['updatedAt', 'updatedBy']);

      // Only log if there were actual changes — a "no-op" PATCH (sending
      // the same values back) shouldn't pollute the audit log.
      if (changes.length > 0) {
        await this.auditLog.record(
          user,
          request,
          {
            action: 'ASSET_UPDATED',
            target: {
              entityType: 'Asset',
              entityId: String(after._id),
              snapshot: {
                inventoryNumber: after.inventoryNumber,
                name: after.name,
              },
            },
            description: `Updated asset ${after.inventoryNumber} (${changes.length} field${changes.length === 1 ? '' : 's'} changed)`,
            changes,
          },
          session,
        );
      }

      return after;
    });

    return toApiShape(updated);
  }

  /**
   * Soft-delete an asset. Records an `ASSET_DELETED` audit event.
   *
   * Throws `NotFoundError` if the asset doesn't exist or is already deleted.
   * Throws `BadRequestError` if the asset is currently on loan
   * (status=BORROWED) — that case must be resolved before deletion to
   * avoid stranding open loans.
   */
  async delete(id: string, user: WithId<User>, request: FastifyRequest): Promise<void> {
    const userId = String(user._id);

    await this.runInTransaction(async (session) => {
      // ----- Step 1: load and validate state -----
      const existing = await this.repo.findById(id, session);
      if (!existing) {
        throw new NotFoundError('Asset', id);
      }

      // Defense in depth: don't delete an asset currently on loan.
      // (Loan logic is out of scope for slice #2b; this check just avoids
      // future foot-guns and clearly signals intent.)
      if (existing.currentLoanId !== null) {
        throw new BadRequestError(
          `Cannot delete asset ${existing.inventoryNumber}: it is currently on loan. Return the loan first.`,
        );
      }

      // ----- Step 2: soft-delete -----
      const deleted = await this.repo.softDelete(id, userId, session);
      if (!deleted) {
        // Race condition — already deleted by a parallel request.
        throw new NotFoundError('Asset', id);
      }

      // ----- Step 3: audit log -----
      await this.auditLog.record(
        user,
        request,
        {
          action: 'ASSET_DELETED',
          target: {
            entityType: 'Asset',
            entityId: String(deleted._id),
            snapshot: {
              inventoryNumber: deleted.inventoryNumber,
              name: deleted.name,
              status: deleted.status,
            },
          },
          description: `Soft-deleted asset ${deleted.inventoryNumber} — ${deleted.name}`,
          severity: 'WARNING',
        },
        session,
      );
    });
  }

  // -------------------------------------------------------------------------
  // FK validation helper
  // -------------------------------------------------------------------------

  /**
   * Verify that a referenced category or location exists (and is not
   * soft-deleted) inside the current transaction.
   *
   * The kind discriminator selects which repository to query. Throwing
   * BadRequestError with a clear message is preferable to letting Mongo
   * accept the write and end up with a dangling reference — catching it
   * here keeps the assets table in a clean state and surfaces the bug
   * to the caller immediately.
   *
   * Both lookups skip soft-deleted records (the underlying repos do that
   * already), so an asset cannot reference a category/location that's
   * been deleted, even if the deletion just happened.
   */
  private async assertFkExists(
    kind: 'category' | 'location',
    id: string,
    session: ClientSession,
  ): Promise<void> {
    const repo = kind === 'category' ? this.categoriesRepo : this.locationsRepo;
    const doc = await repo.findById(id, session);
    if (!doc) {
      throw new BadRequestError(`Referenced ${kind} ${id} does not exist.`);
    }
  }

  // -------------------------------------------------------------------------
  // Transaction helper
  // -------------------------------------------------------------------------

  /**
   * Run `work` inside a Mongo transaction. Commits if `work` resolves,
   * aborts if it throws. The session is passed to `work` for inclusion
   * in all DB calls.
   *
   * Uses `withTransaction` which handles transient transaction errors
   * (TransientTransactionError, UnknownTransactionCommitResult) by
   * retrying automatically — useful when concurrent writes conflict on
   * the unique inventoryNumber index.
   */
  private async runInTransaction<T>(work: (session: ClientSession) => Promise<T>): Promise<T> {
    const session = this.mongoClient.startSession();
    try {
      // `withTransaction` returns whatever `work` returns. The driver
      // handles retries on transient errors transparently.
      //
      // We capture the result in `let` because the driver's types say
      // `withTransaction` returns `void` even though it forwards the
      // callback's return value at runtime. The cast at the end keeps
      // TypeScript happy without compromising correctness.
      let result: T | undefined;
      await session.withTransaction(async () => {
        result = await work(session);
      });
      return result as T;
    } finally {
      await session.endSession();
    }
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Convert a Mongo document into the API response shape:
 *   - `_id` → string (binary ObjectId is not JSON-serializable in clients)
 */
function toApiShape(doc: WithId<Asset>): Record<string, unknown> {
  return {
    ...doc,
    _id: String(doc._id),
  };
}
