/**
 * Categories routes — HTTP endpoints for category management.
 *
 * Slice #3 K1: full CRUD with RBAC + audit logging + transactions.
 *
 * RBAC matrix (mirrors assets):
 *   - GET    /v1/categories       any authenticated user
 *   - GET    /v1/categories/:id   any authenticated user
 *   - POST   /v1/categories       ASSET_MANAGER + ADMIN
 *   - PATCH  /v1/categories/:id   ASSET_MANAGER + ADMIN
 *   - DELETE /v1/categories/:id   ADMIN only
 *
 * Body schemas:
 *   - POST uses `CreateCategorySchema` from shared-types (slug supplied by client)
 *   - PATCH uses an inline partial schema (UpdateCategorySchema is not yet in shared-types)
 *
 * Future K3/K4 hooks:
 *   When slug auto-generation lands, the POST body will accept `slug` as
 *   optional and derive it from `name`. When cycle detection lands, the
 *   PATCH service-level parentId check will gain a tree traversal.
 */

import { ASSET_TYPE_VALUES, CreateCategorySchema, type AssetType } from '@sfz/shared-types';
import { z } from 'zod';

import { CategoriesRepository } from './categories.repository.js';
import { CategoriesService } from './categories.service.js';

import type { FastifyPluginAsync } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';

// ---------------------------------------------------------------------------
// Request / response schemas
// ---------------------------------------------------------------------------

const ListCategoriesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  skip: z.coerce.number().int().min(0).default(0),
  /** Filter to only categories under a specific parent. Use `null` literal string for root. */
  parentId: z
    .string()
    .regex(/^([a-f\d]{24}|null)$/i, 'parentId musí byť 24 hex znakov alebo "null".')
    .optional(),
  /** Filter by assetType (IT, SPORT, OFFICE...). */
  assetType: z.string().optional(),
  /** Filter to active categories only. */
  isActive: z.coerce.boolean().optional(),
});

const CategoryIdParamsSchema = z.object({
  id: z.string().regex(/^[a-f\d]{24}$/i, 'Neplatný formát ID (očakáva sa 24 hex znakov).'),
});

/**
 * PATCH body schema. Mirrors what the service accepts: a partial of the
 * writable category fields. Audit + identity columns are excluded.
 *
 * NOTE: This is defined locally rather than imported from shared-types
 * because there's no UpdateCategorySchema there yet. When we add one in
 * a future cleanup, this gets swapped out.
 */
const UpdateCategoryBodySchema = z
  .object({
    name: z.string().min(1).max(200).trim(),
    slug: z
      .string()
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug musí byť lowercase s pomlčkami.')
      .max(200),
    parentId: z
      .string()
      .regex(/^[a-f\d]{24}$/i, 'parentId musí byť 24 hex znakov.')
      .nullable(),
    assetType: z.enum(
      ASSET_TYPE_VALUES as unknown as [string, ...string[]],
    ) as z.ZodType<AssetType>,
    description: z.string().max(1000).nullable(),
    icon: z.string().max(50).nullable(),
    color: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/, 'Farba musí byť hex.')
      .nullable(),
    approverIds: z.array(z.string().regex(/^[a-f\d]{24}$/i)),
    requiresApprovalByDefault: z.boolean(),
    maxLoanDays: z.number().int().positive().max(3650).nullable(),
    isActive: z.boolean(),
    sortOrder: z.number().int(),
  })
  .partial()
  .describe('Čiastočná aktualizácia kategórie; všetky polia voliteľné.');

const CategoryResponseSchema = z.record(z.string(), z.unknown());

const ListCategoriesResponseSchema = z.object({
  data: z.array(z.record(z.string(), z.unknown())),
  pagination: z.object({
    total: z.number().int().nonnegative(),
    limit: z.number().int().positive(),
    skip: z.number().int().nonnegative(),
    hasMore: z.boolean(),
  }),
});

// ---------------------------------------------------------------------------
// Plugin
// ---------------------------------------------------------------------------

const categoriesRoutes: FastifyPluginAsync = async (fastify) => {
  const app = fastify.withTypeProvider<ZodTypeProvider>();

  const repo = new CategoriesRepository(fastify.mongo.db);
  const service = new CategoriesService(repo, fastify.auditLog, fastify.mongo.client);

  await repo.ensureIndexes();

  // Same RBAC pattern as assets.
  const canRead = fastify.requireRole([
    'EMPLOYEE',
    'TEAM_MANAGER',
    'ASSET_MANAGER',
    'ADMIN',
    'EXTERNAL',
  ]);
  const canWrite = fastify.requireRole(['ASSET_MANAGER', 'ADMIN']);
  const canDelete = fastify.requireRole(['ADMIN']);

  // --- GET /v1/categories --------------------------------------------------
  app.get(
    '/v1/categories',
    {
      preHandler: [fastify.requireAuth, fastify.loadCurrentUser, canRead],
      schema: {
        tags: ['Categories'],
        summary: 'List categories',
        description:
          'Returns a paginated list of categories, sorted by sortOrder then name. ' +
          'Soft-deleted categories are excluded. Optional filters: parentId, ' +
          'assetType, isActive.',
        security: [{ bearerAuth: [] }],
        querystring: ListCategoriesQuerySchema,
        response: {
          200: ListCategoriesResponseSchema,
        },
      },
    },
    async (request) => {
      const { limit, skip, parentId, assetType, isActive } = request.query;

      // Build filter from query params
      const filter: Record<string, unknown> = {};
      if (parentId !== undefined) {
        filter['parentId'] = parentId === 'null' ? null : parentId;
      }
      if (assetType !== undefined) {
        filter['assetType'] = assetType;
      }
      if (isActive !== undefined) {
        filter['isActive'] = isActive;
      }

      return service.list({ limit, skip, filter });
    },
  );

  // --- GET /v1/categories/:id ----------------------------------------------
  app.get(
    '/v1/categories/:id',
    {
      preHandler: [fastify.requireAuth, fastify.loadCurrentUser, canRead],
      schema: {
        tags: ['Categories'],
        summary: 'Get a single category by ID',
        description: 'Returns one category by its _id. 404 if not found or soft-deleted.',
        security: [{ bearerAuth: [] }],
        params: CategoryIdParamsSchema,
        response: {
          200: CategoryResponseSchema,
        },
      },
    },
    async (request) => {
      return service.getById(request.params.id);
    },
  );

  // --- POST /v1/categories -------------------------------------------------
  app.post(
    '/v1/categories',
    {
      preHandler: [fastify.requireAuth, fastify.loadCurrentUser, canWrite],
      schema: {
        tags: ['Categories'],
        summary: 'Create a new category',
        description:
          'Creates a new category. Slug must be unique. If parentId is supplied, ' +
          'the parent must exist. Requires ASSET_MANAGER or ADMIN role.',
        security: [{ bearerAuth: [] }],
        body: CreateCategorySchema,
        response: {
          201: CategoryResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const created = await service.create(request.body, request.currentUser, request);
      return reply.status(201).send(created);
    },
  );

  // --- PATCH /v1/categories/:id --------------------------------------------
  app.patch(
    '/v1/categories/:id',
    {
      preHandler: [fastify.requireAuth, fastify.loadCurrentUser, canWrite],
      schema: {
        tags: ['Categories'],
        summary: 'Update an existing category',
        description:
          'Partial update — only provided fields are changed. Slug uniqueness ' +
          'and parent existence are revalidated on change. Records an audit ' +
          'event with a per-field diff. Requires ASSET_MANAGER or ADMIN role.',
        security: [{ bearerAuth: [] }],
        params: CategoryIdParamsSchema,
        body: UpdateCategoryBodySchema,
        response: {
          200: CategoryResponseSchema,
        },
      },
    },
    async (request) => {
      return service.update(request.params.id, request.body, request.currentUser, request);
    },
  );

  // --- DELETE /v1/categories/:id -------------------------------------------
  app.delete(
    '/v1/categories/:id',
    {
      preHandler: [fastify.requireAuth, fastify.loadCurrentUser, canDelete],
      schema: {
        tags: ['Categories'],
        summary: 'Soft-delete a category',
        description:
          'Marks a category as deleted. Refuses deletion if the category has ' +
          'any non-deleted child categories (would orphan them). Asset FK ' +
          'protection lands in slice #3 K9. Requires ADMIN role.',
        security: [{ bearerAuth: [] }],
        params: CategoryIdParamsSchema,
        response: {
          204: z.null(),
        },
      },
    },
    async (request, reply) => {
      await service.delete(request.params.id, request.currentUser, request);
      return reply.status(204).send(null);
    },
  );
};

export default categoriesRoutes;
