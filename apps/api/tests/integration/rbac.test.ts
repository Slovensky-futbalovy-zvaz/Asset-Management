/**
 * Integration tests for RBAC on /v1/assets endpoints.
 *
 * The matrix being verified (slice #2b):
 *
 *   ENDPOINT                  EMPLOYEE  TEAM_MGR  ASSET_MGR  ADMIN  EXTERNAL
 *   GET /v1/assets                ✓         ✓         ✓        ✓        ✓
 *   GET /v1/assets/:id            ✓         ✓         ✓        ✓        ✓
 *   POST /v1/assets               ✗         ✗         ✓        ✓        ✗
 *   PATCH /v1/assets/:id          ✗         ✗         ✓        ✓        ✗
 *   DELETE /v1/assets/:id         ✗         ✗         ✗        ✓        ✗
 *
 * Test strategy:
 *   Rather than expanding the full 25-cell matrix into 25 tests, we
 *   verify the access boundary at three levels:
 *
 *     1. Read access: any non-empty role can read. Test EMPLOYEE (the
 *        lowest read-capable role) on all 2 read endpoints — if EMPLOYEE
 *        succeeds, all higher roles trivially succeed.
 *     2. Write access (POST/PATCH): ASSET_MANAGER and ADMIN succeed;
 *        EMPLOYEE/TEAM_MANAGER/EXTERNAL forbidden. We test ASSET_MANAGER
 *        success + EMPLOYEE forbidden for each.
 *     3. Delete access: only ADMIN. Test ADMIN success +
 *        ASSET_MANAGER forbidden.
 *
 *   This catches every "cell" of the matrix that has unique business
 *   semantics, without redundantly testing equivalent rows.
 *
 * What's tested elsewhere:
 *   - Validation, audit fields, business rules → assets-{post,patch,delete}.test.ts
 *   - Auth gate (no token, deactivated user) → auth.test.ts
 *
 * Setup:
 *   Each test provisions ONE user with ONE specific role via the
 *   `provisionUserAs` helper. Fresh DB before every test.
 */

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { buildTestApp, cleanTestDatabase } from '../helpers/test-app.js';
import {
  insertTestAsset,
  provisionUserAsAndSignToken,
  UserRole,
  validCreateAssetBody,
} from '../helpers/test-fixtures.js';
import { createTokenSigner } from '../helpers/test-jwt-loader.js';

import type { SignTestTokenInput } from '../helpers/test-jwt.js';
import type { FastifyInstance } from 'fastify';

describe('RBAC on /v1/assets', () => {
  let app: FastifyInstance;
  let signToken: (input: SignTestTokenInput) => Promise<string>;

  beforeAll(async () => {
    app = await buildTestApp();
    signToken = await createTokenSigner();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await cleanTestDatabase(app);
  });

  afterEach(async () => {
    await cleanTestDatabase(app);
  });

  // -------------------------------------------------------------------------
  // Read access — EMPLOYEE (lowest read-capable role)
  // -------------------------------------------------------------------------
  //
  // If EMPLOYEE can read, all higher roles can too (the role list for
  // `canRead` is [EMPLOYEE, TEAM_MANAGER, ASSET_MANAGER, ADMIN, EXTERNAL]).

  describe('read access (EMPLOYEE)', () => {
    it('EMPLOYEE can GET /v1/assets (list)', async () => {
      const { token } = await provisionUserAsAndSignToken(app, signToken, {
        oid: 'employee-read-list',
        role: UserRole.EMPLOYEE,
      });

      const res = await app.inject({
        method: 'GET',
        url: '/v1/assets',
        headers: { authorization: `Bearer ${token}` },
      });

      expect(res.statusCode).toBe(200);
    });

    it('EMPLOYEE can GET /v1/assets/:id', async () => {
      const asset = await insertTestAsset(app);
      const { token } = await provisionUserAsAndSignToken(app, signToken, {
        oid: 'employee-read-one',
        role: UserRole.EMPLOYEE,
      });

      const res = await app.inject({
        method: 'GET',
        url: `/v1/assets/${asset._id}`,
        headers: { authorization: `Bearer ${token}` },
      });

      expect(res.statusCode).toBe(200);
    });

    it('EXTERNAL can also GET /v1/assets (verifies read role list includes EXTERNAL)', async () => {
      const { token } = await provisionUserAsAndSignToken(app, signToken, {
        oid: 'external-read-list',
        role: UserRole.EXTERNAL,
      });

      const res = await app.inject({
        method: 'GET',
        url: '/v1/assets',
        headers: { authorization: `Bearer ${token}` },
      });

      expect(res.statusCode).toBe(200);
    });
  });

  // -------------------------------------------------------------------------
  // Write access — ASSET_MANAGER (lowest write-capable role)
  // -------------------------------------------------------------------------

  describe('write access (ASSET_MANAGER)', () => {
    it('ASSET_MANAGER can POST /v1/assets', async () => {
      const { token } = await provisionUserAsAndSignToken(app, signToken, {
        oid: 'asset-mgr-post',
        role: UserRole.ASSET_MANAGER,
      });

      const res = await app.inject({
        method: 'POST',
        url: '/v1/assets',
        headers: { authorization: `Bearer ${token}` },
        payload: validCreateAssetBody({ inventoryNumberPrefix: 'AM' }),
      });

      expect(res.statusCode).toBe(201);
    });

    it('ASSET_MANAGER can PATCH /v1/assets/:id', async () => {
      const asset = await insertTestAsset(app);
      const { token } = await provisionUserAsAndSignToken(app, signToken, {
        oid: 'asset-mgr-patch',
        role: UserRole.ASSET_MANAGER,
      });

      const res = await app.inject({
        method: 'PATCH',
        url: `/v1/assets/${asset._id}`,
        headers: { authorization: `Bearer ${token}` },
        payload: { name: 'Updated by asset manager' },
      });

      expect(res.statusCode).toBe(200);
    });

    it('ASSET_MANAGER cannot DELETE /v1/assets/:id (403)', async () => {
      const asset = await insertTestAsset(app);
      const { token } = await provisionUserAsAndSignToken(app, signToken, {
        oid: 'asset-mgr-delete-attempt',
        role: UserRole.ASSET_MANAGER,
      });

      const res = await app.inject({
        method: 'DELETE',
        url: `/v1/assets/${asset._id}`,
        headers: { authorization: `Bearer ${token}` },
      });

      expect(res.statusCode).toBe(403);
      const body = res.json<{ message: string }>();
      // Error message mentions the required role(s)
      expect(body.message).toMatch(/ADMIN/);
    });
  });

  // -------------------------------------------------------------------------
  // Delete access — ADMIN only
  // -------------------------------------------------------------------------

  describe('delete access (ADMIN only)', () => {
    it('ADMIN can DELETE /v1/assets/:id', async () => {
      const asset = await insertTestAsset(app);
      const { token } = await provisionUserAsAndSignToken(app, signToken, {
        oid: 'admin-delete',
        role: UserRole.ADMIN,
      });

      const res = await app.inject({
        method: 'DELETE',
        url: `/v1/assets/${asset._id}`,
        headers: { authorization: `Bearer ${token}` },
      });

      expect(res.statusCode).toBe(204);
    });
  });

  // -------------------------------------------------------------------------
  // Forbidden writes — EMPLOYEE, TEAM_MANAGER, EXTERNAL
  // -------------------------------------------------------------------------
  //
  // The role list for `canWrite` is [ASSET_MANAGER, ADMIN]. Every other
  // authenticated role must get 403 on POST/PATCH.

  describe('EMPLOYEE forbidden writes', () => {
    it('EMPLOYEE cannot POST /v1/assets (403)', async () => {
      const { token } = await provisionUserAsAndSignToken(app, signToken, {
        oid: 'employee-post-attempt',
        role: UserRole.EMPLOYEE,
      });

      const res = await app.inject({
        method: 'POST',
        url: '/v1/assets',
        headers: { authorization: `Bearer ${token}` },
        payload: validCreateAssetBody({ inventoryNumberPrefix: 'EMP' }),
      });

      expect(res.statusCode).toBe(403);
    });

    it('EMPLOYEE cannot PATCH /v1/assets/:id (403)', async () => {
      const asset = await insertTestAsset(app);
      const { token } = await provisionUserAsAndSignToken(app, signToken, {
        oid: 'employee-patch-attempt',
        role: UserRole.EMPLOYEE,
      });

      const res = await app.inject({
        method: 'PATCH',
        url: `/v1/assets/${asset._id}`,
        headers: { authorization: `Bearer ${token}` },
        payload: { name: 'Should not be allowed' },
      });

      expect(res.statusCode).toBe(403);
    });

    it('EMPLOYEE cannot DELETE /v1/assets/:id (403)', async () => {
      const asset = await insertTestAsset(app);
      const { token } = await provisionUserAsAndSignToken(app, signToken, {
        oid: 'employee-delete-attempt',
        role: UserRole.EMPLOYEE,
      });

      const res = await app.inject({
        method: 'DELETE',
        url: `/v1/assets/${asset._id}`,
        headers: { authorization: `Bearer ${token}` },
      });

      expect(res.statusCode).toBe(403);
    });
  });

  describe('TEAM_MANAGER forbidden writes', () => {
    it('TEAM_MANAGER cannot POST /v1/assets (403)', async () => {
      const { token } = await provisionUserAsAndSignToken(app, signToken, {
        oid: 'team-mgr-post-attempt',
        role: UserRole.TEAM_MANAGER,
      });

      const res = await app.inject({
        method: 'POST',
        url: '/v1/assets',
        headers: { authorization: `Bearer ${token}` },
        payload: validCreateAssetBody({ inventoryNumberPrefix: 'TM' }),
      });

      expect(res.statusCode).toBe(403);
    });

    it('TEAM_MANAGER cannot PATCH /v1/assets/:id (403)', async () => {
      const asset = await insertTestAsset(app);
      const { token } = await provisionUserAsAndSignToken(app, signToken, {
        oid: 'team-mgr-patch-attempt',
        role: UserRole.TEAM_MANAGER,
      });

      const res = await app.inject({
        method: 'PATCH',
        url: `/v1/assets/${asset._id}`,
        headers: { authorization: `Bearer ${token}` },
        payload: { name: 'Should not be allowed' },
      });

      expect(res.statusCode).toBe(403);
    });
  });

  describe('EXTERNAL forbidden writes', () => {
    it('EXTERNAL cannot POST /v1/assets (403)', async () => {
      const { token } = await provisionUserAsAndSignToken(app, signToken, {
        oid: 'external-post-attempt',
        role: UserRole.EXTERNAL,
      });

      const res = await app.inject({
        method: 'POST',
        url: '/v1/assets',
        headers: { authorization: `Bearer ${token}` },
        payload: validCreateAssetBody({ inventoryNumberPrefix: 'EXT' }),
      });

      expect(res.statusCode).toBe(403);
    });
  });
});
