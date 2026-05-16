/**
 * Cross-tenant isolation tests (Phase C Blok 5).
 *
 * These are the safety net that guarantees multi-tenant scoping is
 * actually enforced end-to-end. If a future refactor drops a tenant
 * filter anywhere in the stack — repository, service, route — one of
 * these tests fails immediately.
 *
 * Scope
 * -----
 * Two synthetic tenants A and B are seeded for each test. Tenant A
 * has its own JIT-provisioned admin (via the default test Entra
 * tenant id `00000000-...`). Tenant B has data seeded via direct
 * insert with `organisationId = tenantB._id`, but NO authenticated
 * actor — tenant B exists only as a target the requests should not
 * be able to reach.
 *
 * The contract we verify for every tenant-scoped collection:
 *
 *   1. GET /v1/<resource> from tenant A returns ONLY tenant A's rows.
 *   2. GET /v1/<resource>/:id of a tenant B row returns 404 (not 403).
 *      404 is the right answer because revealing existence of cross-
 *      tenant data is itself a leak.
 *   3. PATCH /v1/<resource>/:id of a tenant B row returns 404.
 *   4. DELETE /v1/<resource>/:id of a tenant B row returns 404.
 *   5. Slug + email uniqueness is per-tenant: tenant A can create a
 *      row with the same slug / email that tenant B already uses.
 *   6. Audit log is queryable per tenant (defense-in-depth).
 *
 * Why 404 instead of 403
 * ----------------------
 * 403 means "you exist and we know about this, but you can't touch
 * it" — that leaks the cross-tenant id's existence. 404 is the
 * proper answer to "I cannot find this within YOUR tenant". Every
 * tenant-scoped repository method enforces this by returning null
 * when `organisationId` does not match, which surfaces at the
 * service layer as NotFoundError → 404.
 */

import { ObjectId } from 'mongodb';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { buildTestApp, cleanTestDatabase } from '../helpers/test-app.js';
import {
  insertTestAsset,
  insertTestCategory,
  insertTestLocation,
  insertTestUser,
  provisionUserAsAndSignToken,
  resolveTestTenantId,
  seedTestTenant,
  UserRole,
} from '../helpers/test-fixtures.js';
import { createTokenSigner } from '../helpers/test-jwt-loader.js';

import type { SignTestTokenInput } from '../helpers/test-jwt.js';
import type { FastifyInstance } from 'fastify';

describe('Cross-tenant isolation', () => {
  let app: FastifyInstance;
  let signToken: (input: SignTestTokenInput) => Promise<string>;
  let adminToken: string;
  let tenantAId: string;
  let tenantBId: string;

  beforeAll(async () => {
    app = await buildTestApp();
    signToken = await createTokenSigner();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await cleanTestDatabase(app);

    // Tenant A is the actor — JIT-provision an admin against the
    // default test Entra tenant. This also seeds the tenant A
    // Organisation document via the auth middleware's findOrProvision
    // path, mirroring real first-login behaviour.
    const { token } = await provisionUserAsAndSignToken(app, signToken, {
      oid: 'admin-cross-tenant-a',
      role: UserRole.ADMIN,
    });
    adminToken = token;
    tenantAId = await resolveTestTenantId(app);

    // Tenant B is a stranger — data we seed there must remain
    // unreachable from tenant A's actor.
    const tenantB = await seedTestTenant(app, {
      slug: 'tenant-b',
      displayName: 'Tenant B',
    });
    tenantBId = tenantB._id;
  });

  afterEach(async () => {
    await cleanTestDatabase(app);
  });

  // -------------------------------------------------------------------------
  // Assets
  // -------------------------------------------------------------------------

  describe('assets', () => {
    it('GET /v1/assets only returns tenant A assets', async () => {
      await insertTestAsset(app, {
        organisationId: tenantAId,
        name: 'Tenant A asset',
        inventoryNumber: 'A-001',
      });
      await insertTestAsset(app, {
        organisationId: tenantBId,
        name: 'Tenant B asset',
        inventoryNumber: 'B-001',
      });

      const res = await app.inject({
        method: 'GET',
        url: '/v1/assets',
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json<{
        data: Array<{ name: string; organisationId: string }>;
        pagination: { total: number };
      }>();
      expect(body.pagination.total).toBe(1);
      expect(body.data).toHaveLength(1);
      expect(body.data[0]?.name).toBe('Tenant A asset');
      expect(body.data[0]?.organisationId).toBe(tenantAId);
    });

    it('GET /v1/assets/:id returns 404 for a tenant B asset id', async () => {
      const tenantBAsset = await insertTestAsset(app, {
        organisationId: tenantBId,
        name: 'Hidden from A',
        inventoryNumber: 'B-002',
      });

      const res = await app.inject({
        method: 'GET',
        url: `/v1/assets/${tenantBAsset._id}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(res.statusCode).toBe(404);
    });

    it('PATCH /v1/assets/:id returns 404 for a tenant B asset id', async () => {
      const tenantBAsset = await insertTestAsset(app, {
        organisationId: tenantBId,
        inventoryNumber: 'B-003',
      });

      const res = await app.inject({
        method: 'PATCH',
        url: `/v1/assets/${tenantBAsset._id}`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { name: 'I should never land' },
      });

      expect(res.statusCode).toBe(404);

      // Defense in depth: confirm the row was not mutated.
      const after = await app.mongo.db
        .collection('assets')
        .findOne({ _id: new ObjectId(tenantBAsset._id) });
      expect(after?.['name']).not.toBe('I should never land');
    });

    it('DELETE /v1/assets/:id returns 404 for a tenant B asset id', async () => {
      const tenantBAsset = await insertTestAsset(app, {
        organisationId: tenantBId,
        inventoryNumber: 'B-004',
      });

      const res = await app.inject({
        method: 'DELETE',
        url: `/v1/assets/${tenantBAsset._id}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(res.statusCode).toBe(404);

      // Defense in depth: confirm the row is still present + not deleted.
      const after = await app.mongo.db
        .collection('assets')
        .findOne({ _id: new ObjectId(tenantBAsset._id) });
      expect(after).not.toBeNull();
      expect(after?.['deletedAt']).toBeNull();
    });

    it('inventory number is per-tenant: same value can exist in A and B', async () => {
      const sharedNumber = 'SHARED-2026-001';
      await insertTestAsset(app, {
        organisationId: tenantAId,
        inventoryNumber: sharedNumber,
        name: 'A copy',
      });
      // This insert succeeds only if the unique index is composite
      // `{organisationId, inventoryNumber}`, not single-field
      // `{inventoryNumber}`. Phase C Blok 4 dropped the legacy
      // single-field index for exactly this case.
      const bAsset = await insertTestAsset(app, {
        organisationId: tenantBId,
        inventoryNumber: sharedNumber,
        name: 'B copy',
      });

      expect(bAsset._id).toMatch(/^[a-f0-9]{24}$/);
    });
  });

  // -------------------------------------------------------------------------
  // Categories
  // -------------------------------------------------------------------------

  describe('categories', () => {
    it('GET /v1/categories only returns tenant A categories', async () => {
      await insertTestCategory(app, {
        organisationId: tenantAId,
        slug: 'iso-cat-a',
        name: 'Tenant A category',
      });
      await insertTestCategory(app, {
        organisationId: tenantBId,
        slug: 'iso-cat-b',
        name: 'Tenant B category',
      });

      const res = await app.inject({
        method: 'GET',
        url: '/v1/categories',
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json<{
        data: Array<{ name: string; organisationId: string }>;
      }>();
      const names = body.data.map((c) => c.name);
      expect(names).toContain('Tenant A category');
      expect(names).not.toContain('Tenant B category');
    });

    it('GET /v1/categories/:id returns 404 for a tenant B category id', async () => {
      const tenantBCat = await insertTestCategory(app, {
        organisationId: tenantBId,
        slug: 'iso-cat-b-hidden',
      });

      const res = await app.inject({
        method: 'GET',
        url: `/v1/categories/${tenantBCat._id}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(res.statusCode).toBe(404);
    });

    it('PATCH /v1/categories/:id returns 404 for a tenant B category id', async () => {
      const tenantBCat = await insertTestCategory(app, {
        organisationId: tenantBId,
        slug: 'iso-cat-b-patch',
        name: 'Original',
      });

      const res = await app.inject({
        method: 'PATCH',
        url: `/v1/categories/${tenantBCat._id}`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { name: 'Patched name' },
      });

      expect(res.statusCode).toBe(404);

      const after = await app.mongo.db
        .collection('categories')
        .findOne({ _id: new ObjectId(tenantBCat._id) });
      expect(after?.['name']).toBe('Original');
    });

    it('DELETE /v1/categories/:id returns 404 for a tenant B category id', async () => {
      const tenantBCat = await insertTestCategory(app, {
        organisationId: tenantBId,
        slug: 'iso-cat-b-del',
      });

      const res = await app.inject({
        method: 'DELETE',
        url: `/v1/categories/${tenantBCat._id}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(res.statusCode).toBe(404);

      const after = await app.mongo.db
        .collection('categories')
        .findOne({ _id: new ObjectId(tenantBCat._id) });
      expect(after).not.toBeNull();
      expect(after?.['deletedAt']).toBeNull();
    });

    it('slug is per-tenant: same value can exist in A and B', async () => {
      const sharedSlug = 'elektronika';

      // Seed tenant B first via direct insert (no auth needed).
      await insertTestCategory(app, {
        organisationId: tenantBId,
        slug: sharedSlug,
        name: 'B Elektronika',
      });

      // Then create the same slug in tenant A through the real POST
      // endpoint. This exercises the full slug-uniqueness check at the
      // service layer; if it were globally unique we would get a 400.
      const res = await app.inject({
        method: 'POST',
        url: '/v1/categories',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          name: 'A Elektronika',
          slug: sharedSlug,
          parentId: null,
          assetType: 'IT',
          description: null,
          icon: null,
          color: null,
          approverIds: [],
          requiresApprovalByDefault: true,
          maxLoanDays: null,
          isActive: true,
          sortOrder: 0,
        },
      });

      expect(res.statusCode).toBe(201);
      expect(res.json<{ slug: string }>().slug).toBe(sharedSlug);
    });
  });

  // -------------------------------------------------------------------------
  // Locations
  // -------------------------------------------------------------------------

  describe('locations', () => {
    it('GET /v1/locations only returns tenant A locations', async () => {
      await insertTestLocation(app, {
        organisationId: tenantAId,
        slug: 'iso-loc-a',
        name: 'Tenant A location',
      });
      await insertTestLocation(app, {
        organisationId: tenantBId,
        slug: 'iso-loc-b',
        name: 'Tenant B location',
      });

      const res = await app.inject({
        method: 'GET',
        url: '/v1/locations',
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json<{ data: Array<{ name: string }> }>();
      const names = body.data.map((l) => l.name);
      expect(names).toContain('Tenant A location');
      expect(names).not.toContain('Tenant B location');
    });

    it('PATCH /v1/locations/:id returns 404 for a tenant B location id', async () => {
      const tenantBLoc = await insertTestLocation(app, {
        organisationId: tenantBId,
        slug: 'iso-loc-b-patch',
        name: 'Sklad B',
      });

      const res = await app.inject({
        method: 'PATCH',
        url: `/v1/locations/${tenantBLoc._id}`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { name: 'Should never apply' },
      });

      expect(res.statusCode).toBe(404);

      const after = await app.mongo.db
        .collection('locations')
        .findOne({ _id: new ObjectId(tenantBLoc._id) });
      expect(after?.['name']).toBe('Sklad B');
    });
  });

  // -------------------------------------------------------------------------
  // Users
  // -------------------------------------------------------------------------

  describe('users', () => {
    it('GET /v1/users only returns tenant A users', async () => {
      // Tenant A's admin is already provisioned by the JIT call in
      // beforeEach. Seed an additional user in tenant B that should
      // never appear in the list.
      await insertTestUser(app, {
        organisationId: tenantBId,
        email: 'tenant-b-user@example.com',
      });

      const res = await app.inject({
        method: 'GET',
        url: '/v1/users',
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json<{
        data: Array<{ email: string; organisationId: string }>;
      }>();
      const emails = body.data.map((u) => u.email);
      expect(emails).not.toContain('tenant-b-user@example.com');
      // Every returned user must be tenant A's.
      for (const user of body.data) {
        expect(user.organisationId).toBe(tenantAId);
      }
    });

    it('GET /v1/users/:id returns 404 for a tenant B user id', async () => {
      const tenantBUser = await insertTestUser(app, {
        organisationId: tenantBId,
      });

      const res = await app.inject({
        method: 'GET',
        url: `/v1/users/${tenantBUser._id}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(res.statusCode).toBe(404);
    });

    it('PATCH /v1/users/:id returns 404 for a tenant B user id', async () => {
      const tenantBUser = await insertTestUser(app, {
        organisationId: tenantBId,
        roles: [UserRole.EMPLOYEE],
      });

      const res = await app.inject({
        method: 'PATCH',
        url: `/v1/users/${tenantBUser._id}`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { roles: [UserRole.ADMIN] },
      });

      expect(res.statusCode).toBe(404);

      const after = await app.mongo.db
        .collection('users')
        .findOne({ _id: new ObjectId(tenantBUser._id) });
      // The roles array must remain unchanged.
      expect(after?.['roles']).toEqual([UserRole.EMPLOYEE]);
    });

    it('email is per-tenant: same value can exist in A and B', async () => {
      const sharedEmail = 'admin@inventario.test';

      // Seed in tenant B first.
      await insertTestUser(app, {
        organisationId: tenantBId,
        email: sharedEmail,
      });

      // Insert into tenant A — must succeed because the unique index
      // is composite `{organisationId, email}`, not single-field
      // `{email}`. Phase C Blok 4 dropped the legacy single-field
      // email index for exactly this scenario.
      const tenantAUser = await insertTestUser(app, {
        organisationId: tenantAId,
        email: sharedEmail,
      });

      expect(tenantAUser._id).toMatch(/^[a-f0-9]{24}$/);
    });
  });

  // -------------------------------------------------------------------------
  // Audit log scope
  // -------------------------------------------------------------------------
  //
  // The audit_logs collection carries `organisationId` on each record
  // (set by AuditLogService.record from `actor.organisationId`). We do
  // not expose read endpoints yet, but the field is the basis for any
  // future per-tenant forensic query, so verify it is being stamped
  // correctly on writes triggered by tenant A's actor.

  describe('audit log scope', () => {
    it('audit entries created by tenant A actions carry tenant A organisationId', async () => {
      // Trigger an audit-emitting operation: PATCH a tenant A user.
      const target = await insertTestUser(app, {
        organisationId: tenantAId,
        roles: [UserRole.EMPLOYEE],
      });

      const res = await app.inject({
        method: 'PATCH',
        url: `/v1/users/${target._id}`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { roles: [UserRole.ASSET_MANAGER] },
      });
      expect(res.statusCode).toBe(200);

      // The PATCH emits at least USER_ROLE_GRANTED + USER_ROLE_REVOKED.
      // Every record must carry tenant A's organisationId.
      const auditDocs = await app.mongo.db
        .collection('audit_logs')
        .find({ 'target.entityId': target._id })
        .toArray();

      expect(auditDocs.length).toBeGreaterThan(0);
      for (const doc of auditDocs) {
        expect(doc['organisationId']).toBe(tenantAId);
      }
    });
  });
});
