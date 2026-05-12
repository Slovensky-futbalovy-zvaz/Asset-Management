/**
 * Assets routes — HTTP endpoints for asset management.
 *
 * Slice #1 implemented `GET /v1/assets` as public.
 * Slice #2 makes it require authentication — any valid Entra ID JWT works.
 * Slice #2b will add POST / PATCH / DELETE with role-based authorization.
 */

import { z } from 'zod';

import { AssetsRepository } from './assets.repository.js';
import { AssetsService } from './assets.service.js';

import type { FastifyPluginAsync } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';

// ---------------------------------------------------------------------------
// Request / response schemas
// ---------------------------------------------------------------------------

const ListAssetsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  skip: z.coerce.number().int().min(0).default(0),
});

/**
 * Response schema is intentionally permissive (z.unknown for items)
 * to avoid pulling the full Asset schema validation onto the response path.
 * The data IS validated on write (in repo/service); on read we trust the DB.
 *
 * In production we'd narrow this to AssetSchema once we're confident the
 * stored documents always match. For now, schema-on-read is overkill.
 */
const ListAssetsResponseSchema = z.object({
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

const assetsRoutes: FastifyPluginAsync = async (fastify) => {
  const app = fastify.withTypeProvider<ZodTypeProvider>();

  // Wire up dependencies. In Fastify we don't have a DI container — we
  // instantiate per plugin scope. Repository is cheap (just wraps a
  // collection ref), so re-creating per plugin load is fine.
  const repo = new AssetsRepository(fastify.mongo.db);
  const service = new AssetsService(repo);

  // --- GET /v1/assets ------------------------------------------------------
  app.get(
    '/v1/assets',
    {
      preHandler: fastify.requireAuth,
      schema: {
        tags: ['Assets'],
        summary: 'List assets',
        description:
          'Returns a paginated list of assets, sorted by creation date (newest first). ' +
          'Soft-deleted assets are excluded. Requires authentication.',
        security: [{ bearerAuth: [] }],
        querystring: ListAssetsQuerySchema,
        response: {
          200: ListAssetsResponseSchema,
        },
      },
    },
    async (request) => {
      const { limit, skip } = request.query;
      return service.list({ limit, skip });
    },
  );
};

export default assetsRoutes;
