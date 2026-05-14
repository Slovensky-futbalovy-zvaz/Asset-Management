/**
 * Categories service — business logic for category management.
 *
 * Responsibilities:
 *   - Set audit fields (createdAt/updatedAt/createdBy/updatedBy)
 *   - Compute diffs for audit log on update
 *   - Wrap state-changing ops in transactions (category write + audit atomic)
 *   - Reject slug collisions on create and on slug-changing patches
 *
 * Slug handling (K1 scope):
 *   The slug is taken AS-IS from the request body. Auto-generation from `name`
 *   with Slovak diacritics stripping lands in K3. Until then, the client must
 *   supply a valid slug (validated by CreateCategorySchema in shared-types).
 *
 * Hierarchy handling (K1 scope):
 *   `parentId` is stored as provided. Cycle detection and depth limits land
 *   in K4. K1 only validates that the parent (if non-null) exists.
 *
 * Why no inventoryNumber-style server generation here:
 *   Categories don't have a sequence. Slug is the URL key but it derives
 *   from the human-given name, so the human supplies it (or, after K3,
 *   the server derives it deterministically from name).
 */

import { BadRequestError, NotFoundError } from '../../plugins/error-handler.js';
import { computeShallowDiff } from '../assets/assets-diff.js';

import type {
  CategoriesRepository,
  CategoryUpdatePatch,
  ListCategoriesParams,
} from './categories.repository.js';
import type { AuditLogService } from '../audit/audit.service.js';
import type { Category, CreateCategoryInput, User } from '@sfz/shared-types';
import type { FastifyRequest } from 'fastify';
import type { ClientSession, MongoClient, WithId } from 'mongodb';

// ---------------------------------------------------------------------------
// Public API types
// ---------------------------------------------------------------------------

export interface ListCategoriesResponse {
  data: Record<string, unknown>[];
  pagination: {
    total: number;
    limit: number;
    skip: number;
    hasMore: boolean;
  };
}

/**
 * Service-layer input for updating a category. Mirrors `UpdateCategoryInput`
 * if we had one in shared-types; for now we accept a partial of the writable
 * fields, omitting audit + identity columns the service controls.
 *
 * Note on `| undefined` in each field type: with TS `exactOptionalPropertyTypes`
 * enabled, `{ name?: string }` and `{ name?: string | undefined }` are
 * distinct types. The Zod `.partial()` schema produces the latter; the
 * service signature must match.
 */
export type UpdateCategoryInput = {
  [K in keyof Omit<
    Category,
    '_id' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy' | 'deletedAt' | 'deletedBy'
  >]?: Category[K] | undefined;
};

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class CategoriesService {
  constructor(
    private readonly repo: CategoriesRepository,
    private readonly auditLog: AuditLogService,
    private readonly mongoClient: MongoClient,
  ) {}

  // -------------------------------------------------------------------------
  // Read paths (no transaction)
  // -------------------------------------------------------------------------

  async list(params: ListCategoriesParams): Promise<ListCategoriesResponse> {
    const limit = params.limit ?? 50;
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
      throw new NotFoundError('Category', id);
    }
    return toApiShape(doc);
  }

  // -------------------------------------------------------------------------
  // Write paths (transactional)
  // -------------------------------------------------------------------------

  /**
   * Create a new category.
   *
   * Validations performed BEFORE insert (inside the transaction):
   *   - Slug must not collide with an existing non-deleted category.
   *   - If `parentId` is set, the parent must exist and be non-deleted.
   *
   * Records an `CATEGORY_CREATED` audit event atomically with the insert.
   */
  async create(
    input: CreateCategoryInput,
    user: WithId<User>,
    request: FastifyRequest,
  ): Promise<Record<string, unknown>> {
    const userId = String(user._id);

    const inserted = await this.runInTransaction(async (session) => {
      // ----- Step 1: slug uniqueness check -----
      const slugCollision = await this.repo.findBySlug(input.slug, session);
      if (slugCollision) {
        throw new BadRequestError(
          `Slug "${input.slug}" already exists (category ${String(slugCollision._id)}).`,
        );
      }

      // ----- Step 2: parent existence check (if applicable) -----
      if (input.parentId !== null) {
        const parent = await this.repo.findById(input.parentId, session);
        if (!parent) {
          throw new BadRequestError(`Parent category ${input.parentId} does not exist.`);
        }
      }

      // ----- Step 3: build document with audit fields -----
      const now = new Date().toISOString();
      const doc: Omit<Category, '_id'> = {
        ...input,
        createdAt: now,
        updatedAt: now,
        createdBy: userId,
        updatedBy: userId,
        deletedAt: null,
        deletedBy: null,
      };

      // ----- Step 4: insert + audit -----
      const insertedDoc = await this.repo.insert(doc, session);

      await this.auditLog.record(
        user,
        request,
        {
          action: 'CATEGORY_CREATED',
          target: {
            entityType: 'Category',
            entityId: String(insertedDoc._id),
            snapshot: {
              name: insertedDoc.name,
              slug: insertedDoc.slug,
              assetType: insertedDoc.assetType,
            },
          },
          description: `Created category "${insertedDoc.name}" (slug: ${insertedDoc.slug})`,
        },
        session,
      );

      return insertedDoc;
    });

    return toApiShape(inserted);
  }

  /**
   * Update an existing category.
   *
   * Validations:
   *   - Category must exist and not be soft-deleted.
   *   - If slug changes, the new slug must not collide with another category.
   *   - If parentId changes to a non-null value, that parent must exist.
   *     (Cycle detection lands in K4 — for K1 we accept that misuse here
   *     could create orphan cycles. K4 closes the gap.)
   *
   * Records `CATEGORY_UPDATED` with per-field diff. No-op patches don't
   * write an audit entry.
   */
  async update(
    id: string,
    patch: UpdateCategoryInput,
    user: WithId<User>,
    request: FastifyRequest,
  ): Promise<Record<string, unknown>> {
    const userId = String(user._id);

    const updated = await this.runInTransaction(async (session) => {
      // ----- Step 1: load current doc -----
      const before = await this.repo.findById(id, session);
      if (!before) {
        throw new NotFoundError('Category', id);
      }

      // ----- Step 2: slug collision check (only if slug is changing) -----
      if (patch.slug !== undefined && patch.slug !== before.slug) {
        const slugCollision = await this.repo.findBySlug(patch.slug, session);
        if (slugCollision && String(slugCollision._id) !== id) {
          throw new BadRequestError(
            `Slug "${patch.slug}" already exists (category ${String(slugCollision._id)}).`,
          );
        }
      }

      // ----- Step 3: parent existence check (only if parentId is changing to non-null) -----
      if (patch.parentId !== undefined && patch.parentId !== null) {
        if (patch.parentId === id) {
          throw new BadRequestError('A category cannot be its own parent.');
        }
        const parent = await this.repo.findById(patch.parentId, session);
        if (!parent) {
          throw new BadRequestError(`Parent category ${patch.parentId} does not exist.`);
        }
      }

      // ----- Step 4: apply patch with audit fields -----
      const now = new Date().toISOString();
      const fullPatch: CategoryUpdatePatch = {
        ...(patch as CategoryUpdatePatch),
        updatedAt: now,
        updatedBy: userId,
      };

      const after = await this.repo.update(id, fullPatch, session);
      if (!after) {
        throw new NotFoundError('Category', id);
      }

      // ----- Step 5: diff + audit (only if real changes) -----
      const changes = computeShallowDiff(before, after, ['updatedAt', 'updatedBy']);
      if (changes.length > 0) {
        await this.auditLog.record(
          user,
          request,
          {
            action: 'CATEGORY_UPDATED',
            target: {
              entityType: 'Category',
              entityId: String(after._id),
              snapshot: {
                name: after.name,
                slug: after.slug,
              },
            },
            description: `Updated category "${after.name}" (${changes.length} field${changes.length === 1 ? '' : 's'} changed)`,
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
   * Soft-delete a category.
   *
   * Defense in depth: refuses to delete if the category has any non-deleted
   * direct children. (Asset FK check lands in K9 as a separate concern;
   * for K1 we only protect the category tree from orphans.)
   *
   * Records `CATEGORY_DELETED` with severity WARNING.
   */
  async delete(id: string, user: WithId<User>, request: FastifyRequest): Promise<void> {
    const userId = String(user._id);

    await this.runInTransaction(async (session) => {
      // ----- Step 1: load -----
      const existing = await this.repo.findById(id, session);
      if (!existing) {
        throw new NotFoundError('Category', id);
      }

      // ----- Step 2: tree integrity — refuse if has children -----
      const childCount = await this.repo.countChildren(id, session);
      if (childCount > 0) {
        throw new BadRequestError(
          `Cannot delete category "${existing.name}": ${childCount} child categor${childCount === 1 ? 'y' : 'ies'} would be orphaned. Reparent or delete children first.`,
        );
      }

      // ----- Step 3: soft-delete -----
      const deleted = await this.repo.softDelete(id, userId, session);
      if (!deleted) {
        throw new NotFoundError('Category', id);
      }

      // ----- Step 4: audit -----
      await this.auditLog.record(
        user,
        request,
        {
          action: 'CATEGORY_DELETED',
          target: {
            entityType: 'Category',
            entityId: String(deleted._id),
            snapshot: {
              name: deleted.name,
              slug: deleted.slug,
            },
          },
          description: `Soft-deleted category "${deleted.name}" (slug: ${deleted.slug})`,
          severity: 'WARNING',
        },
        session,
      );
    });
  }

  // -------------------------------------------------------------------------
  // Transaction helper (mirrors AssetsService.runInTransaction)
  // -------------------------------------------------------------------------

  private async runInTransaction<T>(work: (session: ClientSession) => Promise<T>): Promise<T> {
    const session = this.mongoClient.startSession();
    try {
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

function toApiShape(doc: WithId<Category>): Record<string, unknown> {
  return {
    ...doc,
    _id: String(doc._id),
  };
}
