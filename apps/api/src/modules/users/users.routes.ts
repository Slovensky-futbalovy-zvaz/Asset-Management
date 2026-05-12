/**
 * Users routes — endpoints for user management.
 *
 * Slice #2 scope: just `GET /v1/me`, which doubles as the end-to-end
 * verification path for the entire auth stack. If `/v1/me` returns the
 * right shape with a valid token, we know JWKS fetching, signature
 * verification, claim validation, and JIT provisioning all work.
 *
 * Later slices:
 *   - `GET /v1/users` (admin) — list all users
 *   - `PATCH /v1/users/:id` (admin) — change roles, deactivate, etc.
 *   - `POST /v1/users/invite` (admin) — invite external users with LOCAL accounts
 */

import { z } from 'zod';

import { UsersRepository } from './users.repository.js';
import { UsersService } from './users.service.js';

import type { FastifyPluginAsync } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';

// ---------------------------------------------------------------------------
// Response schemas
// ---------------------------------------------------------------------------

/**
 * Shape of `GET /v1/me`. Intentionally narrower than the full `User`
 * schema — we never expose sensitive fields (passwordHash is already
 * stripped at the repo layer, but explicit is better than implicit).
 *
 * We use `z.record(z.string(), z.unknown())` for preferences and similar
 * nested objects to keep the response permissive on read. Validation
 * lives on write paths.
 */
const MeResponseSchema = z.object({
  _id: z.string(),
  email: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  displayName: z.string(),
  accountType: z.string(),
  roles: z.array(z.string()),
  isActive: z.boolean(),
  lastLoginAt: z.string().nullable(),
  preferences: z.record(z.string(), z.unknown()),
  createdAt: z.string(),
});

// ---------------------------------------------------------------------------
// Plugin
// ---------------------------------------------------------------------------

const usersRoutes: FastifyPluginAsync = async (fastify) => {
  const app = fastify.withTypeProvider<ZodTypeProvider>();

  // Wire up dependencies.
  const repo = new UsersRepository(fastify.mongo.db);
  const service = new UsersService(repo);

  // Ensure indexes exist. Idempotent — safe to call at every plugin load.
  // Failures here would prevent the server from starting, which is the
  // right behavior: a misconfigured DB is a blocker, not a degraded mode.
  await repo.ensureIndexes();

  // Expose service to other modules that need it (e.g. the auth flow can
  // call it from a preHandler to attach the User document to the request).
  // For now no one else needs it, but having it on the instance is cheap.
  fastify.decorate('usersService', service);

  // --- GET /v1/me ----------------------------------------------------------
  app.get(
    '/v1/me',
    {
      preHandler: fastify.requireAuth,
      schema: {
        tags: ['Users'],
        summary: 'Get the currently authenticated user',
        description:
          'Returns the user record corresponding to the JWT bearer. ' +
          'Creates a new user record on first call (JIT provisioning) with the default ' +
          '`EMPLOYEE` role. Subsequent calls return the existing record and update `lastLoginAt`.',
        security: [{ bearerAuth: [] }],
        response: {
          200: MeResponseSchema,
        },
      },
    },
    async (request) => {
      const user = await service.findOrProvision(request.entraClaims);

      return {
        _id: String(user._id),
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        displayName: user.displayName,
        accountType: user.accountType,
        roles: user.roles,
        isActive: user.isActive,
        lastLoginAt: user.lastLoginAt,
        preferences: user.preferences as Record<string, unknown>,
        createdAt: user.createdAt,
      };
    },
  );
};

// ---------------------------------------------------------------------------
// Fastify decoration declaration
// ---------------------------------------------------------------------------

declare module 'fastify' {
  interface FastifyInstance {
    usersService: UsersService;
  }
}

export default usersRoutes;
