/**
 * Categories service — business logic for category management.
 *
 * Responsibilities:
 *   - Set audit fields (createdAt/updatedAt/createdBy/updatedBy)
 *   - Compute diffs for audit log on update
 *   - Wrap state-changing ops in transactions (category write + audit atomic)
 *   - Reject slug collisions on create and on slug-changing patches
 *
 * Slug handling (K3 scope):
 *   POST: slug is OPTIONAL in the request body. The service derives one
 *   from `name` via the slugify utility (diacritics stripped, lowercased,
 *   non-alphanumeric runs collapsed to hyphens). If the derived slug
 *   already exists, the service tries `slug-2`, `slug-3`, ... until it
 *   finds one that's free. This auto-suffixing is silent — the client
 *   never sees a collision error for auto-generated slugs.
 *
 *   If the client DOES supply a slug explicitly, it's used as-is. A
 *   collision then throws 400 (client must resolve, the server doesn't
 *   silently rewrite client input).
 *
 *   PATCH: slug is updated only if the client explicitly sends one.
 *   Renaming via `name` does NOT regenerate the slug — URLs stay stable.
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

import { isValidSlug, slugify, slugWithSuffix } from '../../lib/slugify.js';
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
 * Service-layer input for creating a category.
 *
 * Differs from `CreateCategoryInput` (shared-types) by making `slug` optional.
 * If omitted, the service derives it from `name` via slugify() and resolves
 * collisions by appending numeric suffixes (`-2`, `-3`, ...). The route layer
 * is responsible for normalizing `request.body.slug === ''` to undefined if
 * needed; the service treats `undefined` as "derive me one".
 */
export type CreateCategoryServiceInput = Omit<CreateCategoryInput, 'slug'> & {
  slug?: string | undefined;
};

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
   * Slug resolution (see service docstring for full semantics):
   *   - If `input.slug` is provided, validate format, then enforce uniqueness
   *     strictly (throw 400 on collision).
   *   - If `input.slug` is absent, derive from `input.name` via slugify().
   *     If the derived base collides, try `${base}-2`, `${base}-3`, ...
   *     transparently. If the name slugifies to an empty string (e.g. all
   *     non-Latin script), throw 400 — client must supply a slug.
   *
   * Parent existence is checked if `parentId` is non-null.
   *
   * Records an `CATEGORY_CREATED` audit event atomically with the insert.
   */
  async create(
    input: CreateCategoryServiceInput,
    user: WithId<User>,
    request: FastifyRequest,
  ): Promise<Record<string, unknown>> {
    const userId = String(user._id);

    const inserted = await this.runInTransaction(async (session) => {
      // ----- Step 1: resolve slug (client-provided OR auto-derived) -----
      const resolvedSlug = await this.resolveSlugForCreate(input, session);

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
        slug: resolvedSlug,
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
   * Resolve which slug to store on insert.
   *
   * Strategy:
   *   - Client provided slug: must be valid format and unique. Collision
   *     surfaces as 400 so the caller knows their input was used as-is.
   *   - Client omitted slug: derive `slugify(name)` as the base. Probe
   *     base, base-2, base-3, ... until a free slug is found. Stops at 100
   *     attempts to avoid infinite loops on pathological inputs.
   *
   * Runs inside the caller's transaction so the read-then-write window is
   * protected against concurrent inserts. (If another transaction commits
   * the same slug between our findBySlug and our insert, the unique index
   * will reject our insert and the driver retries the whole transaction.)
   */
  private async resolveSlugForCreate(
    input: CreateCategoryServiceInput,
    session: ClientSession,
  ): Promise<string> {
    // -- Path A: client supplied a slug -------------------------------------
    if (input.slug !== undefined && input.slug !== '') {
      // Format validation is also done by the route schema, but we defend
      // here in case the service is called directly (tests, future code).
      if (!isValidSlug(input.slug)) {
        throw new BadRequestError(
          `Slug "${input.slug}" is not in the expected format (lowercase letters, digits, hyphens).`,
        );
      }

      const collision = await this.repo.findBySlug(input.slug, session);
      if (collision) {
        throw new BadRequestError(
          `Slug "${input.slug}" already exists (category ${String(collision._id)}).`,
        );
      }
      return input.slug;
    }

    // -- Path B: derive from name + auto-suffix -----------------------------
    const base = slugify(input.name);
    if (base === '') {
      throw new BadRequestError(
        `Cannot derive a slug from name "${input.name}". Supply a slug explicitly.`,
      );
    }

    // Try base, base-2, base-3, ... up to a sanity cap.
    const MAX_ATTEMPTS = 100;
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const candidate = attempt === 0 ? base : slugWithSuffix(base, attempt + 1);
      const collision = await this.repo.findBySlug(candidate, session);
      if (!collision) return candidate;
    }

    throw new BadRequestError(
      `Could not derive a free slug from "${input.name}" after ${MAX_ATTEMPTS} attempts. Supply a slug explicitly.`,
    );
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
