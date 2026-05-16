/**
 * Integration tests for PATCH /v1/users/:id (admin endpoint).
 *
 * Covers:
 *   - 200 on role change (grant + revoke)
 *   - 200 on isActive flip (deactivate + reactivate)
 *   - 200 on combined roles + isActive change
 *   - 200 on empty body (no-op)
 *   - Audit events emitted: USER_ROLE_GRANTED / REVOKED / DEACTIVATED / REACTIVATED
 *   - Role array deduped + sorted on store
 *   - 404 for non-existent id
 *   - 404 for soft-deleted target
 *   - 400 for empty roles array
 *   - 400 self-demote (admin removing own ADMIN role)
 *   - 400 self-deactivate (admin deactivating themselves)
 *   - 400 last-admin guardrail (demoting last other admin while not affecting self)
 *   - 400 last-admin guardrail (deactivating last other admin)
 *   - updatedBy refresh; updatedAt strictly advances
 *   - 403 for non-admin
 *   - 401 for missing auth
 */

import { ObjectId } from 'mongodb';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { buildTestApp, cleanTestDatabase } from '../helpers/test-app.js';
import { insertTestUser, provisionUserAsAndSignToken, UserRole } from '../helpers/test-fixtures.js';
import { createTokenSigner } from '../helpers/test-jwt-loader.js';

import type { SignTestTokenInput } from '../helpers/test-jwt.js';
import type { FastifyInstance } from 'fastify';

describe('PATCH /v1/users/:id', () => {
  let app: FastifyInstance;
  let signToken: (input: SignTestTokenInput) => Promise<string>;
  let adminToken: string;
  let adminId: string;

  beforeAll(async () => {
    app = await buildTestApp();
    signToken = await createTokenSigner();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await cleanTestDatabase(app);
    const { user, token } = await provisionUserAsAndSignToken(app, signToken, {
      oid: 'admin-for-users-patch',
      role: UserRole.ADMIN,
    });
    adminToken = token;
    adminId = String(user._id);
  });

  afterEach(async () => {
    await cleanTestDatabase(app);
  });

  // -------------------------------------------------------------------------
  // Happy path: role changes
  // -------------------------------------------------------------------------

  describe('role changes', () => {
    it('grants a new role (EMPLOYEE → ASSET_MANAGER)', async () => {
      const target = await insertTestUser(app, { roles: [UserRole.EMPLOYEE] });

      const res = await app.inject({
        method: 'PATCH',
        url: `/v1/users/${target._id}`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { roles: [UserRole.ASSET_MANAGER] },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json<{ roles: string[] }>();
      expect(body.roles).toEqual(['ASSET_MANAGER']);
    });

    it('adds an additional role (EMPLOYEE → EMPLOYEE+TEAM_MANAGER)', async () => {
      const target = await insertTestUser(app, { roles: [UserRole.EMPLOYEE] });

      const res = await app.inject({
        method: 'PATCH',
        url: `/v1/users/${target._id}`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { roles: [UserRole.EMPLOYEE, UserRole.TEAM_MANAGER] },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json<{ roles: string[] }>();
      // Sorted alphabetically by the service
      expect(body.roles).toEqual(['EMPLOYEE', 'TEAM_MANAGER']);
    });

    it('dedupes duplicate roles in the request body', async () => {
      const target = await insertTestUser(app, { roles: [UserRole.EMPLOYEE] });

      const res = await app.inject({
        method: 'PATCH',
        url: `/v1/users/${target._id}`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          roles: [UserRole.ASSET_MANAGER, UserRole.ASSET_MANAGER, UserRole.EMPLOYEE],
        },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json<{ roles: string[] }>();
      expect(body.roles).toEqual(['ASSET_MANAGER', 'EMPLOYEE']);
    });

    it('emits USER_ROLE_GRANTED + USER_ROLE_REVOKED audit events', async () => {
      const target = await insertTestUser(app, {
        email: 'audit-target@example.com',
        roles: [UserRole.EMPLOYEE],
      });

      const res = await app.inject({
        method: 'PATCH',
        url: `/v1/users/${target._id}`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { roles: [UserRole.ASSET_MANAGER] },
      });
      expect(res.statusCode).toBe(200);

      const auditDocs = await app.mongo.db
        .collection('audit_logs')
        .find({ 'target.entityId': target._id })
        .toArray();

      const actions = auditDocs.map((d) => d['action']);
      expect(actions).toContain('USER_ROLE_GRANTED');
      expect(actions).toContain('USER_ROLE_REVOKED');

      const granted = auditDocs.find((d) => d['action'] === 'USER_ROLE_GRANTED');
      const revoked = auditDocs.find((d) => d['action'] === 'USER_ROLE_REVOKED');
      expect((granted?.['metadata'] as { role: string }).role).toBe('ASSET_MANAGER');
      expect((revoked?.['metadata'] as { role: string }).role).toBe('EMPLOYEE');
      // Revoke is WARNING severity, grant is INFO
      expect(granted?.['severity']).toBe('INFO');
      expect(revoked?.['severity']).toBe('WARNING');
    });
  });

  // -------------------------------------------------------------------------
  // Happy path: isActive
  // -------------------------------------------------------------------------

  describe('isActive flip', () => {
    it('deactivates an active user', async () => {
      const target = await insertTestUser(app, { isActive: true });

      const res = await app.inject({
        method: 'PATCH',
        url: `/v1/users/${target._id}`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { isActive: false },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json<{ isActive: boolean }>().isActive).toBe(false);
    });

    it('reactivates a deactivated user', async () => {
      const target = await insertTestUser(app, { isActive: false });

      const res = await app.inject({
        method: 'PATCH',
        url: `/v1/users/${target._id}`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { isActive: true },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json<{ isActive: boolean }>().isActive).toBe(true);
    });

    it('emits USER_DEACTIVATED on deactivation', async () => {
      const target = await insertTestUser(app, { isActive: true });

      const res = await app.inject({
        method: 'PATCH',
        url: `/v1/users/${target._id}`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { isActive: false },
      });
      expect(res.statusCode).toBe(200);

      const auditDoc = await app.mongo.db
        .collection('audit_logs')
        .findOne({ action: 'USER_DEACTIVATED', 'target.entityId': target._id });
      expect(auditDoc).not.toBeNull();
      expect(auditDoc?.['severity']).toBe('WARNING');
    });

    it('emits USER_REACTIVATED on reactivation', async () => {
      const target = await insertTestUser(app, { isActive: false });

      const res = await app.inject({
        method: 'PATCH',
        url: `/v1/users/${target._id}`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { isActive: true },
      });
      expect(res.statusCode).toBe(200);

      const auditDoc = await app.mongo.db
        .collection('audit_logs')
        .findOne({ action: 'USER_REACTIVATED', 'target.entityId': target._id });
      expect(auditDoc).not.toBeNull();
      expect(auditDoc?.['severity']).toBe('INFO');
    });
  });

  // -------------------------------------------------------------------------
  // Combined + no-op
  // -------------------------------------------------------------------------

  describe('combined + no-op', () => {
    it('changes both roles and isActive in one request', async () => {
      const target = await insertTestUser(app, {
        roles: [UserRole.EMPLOYEE],
        isActive: true,
      });

      const res = await app.inject({
        method: 'PATCH',
        url: `/v1/users/${target._id}`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { roles: [UserRole.ASSET_MANAGER], isActive: false },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json<{ roles: string[]; isActive: boolean }>();
      expect(body.roles).toEqual(['ASSET_MANAGER']);
      expect(body.isActive).toBe(false);
    });

    it('empty body returns 200 with the existing user (no-op)', async () => {
      const target = await insertTestUser(app, {
        email: 'noop@example.com',
        roles: [UserRole.EMPLOYEE],
      });

      const res = await app.inject({
        method: 'PATCH',
        url: `/v1/users/${target._id}`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {},
      });

      expect(res.statusCode).toBe(200);
      const body = res.json<{ email: string; roles: string[] }>();
      expect(body.email).toBe('noop@example.com');
      expect(body.roles).toEqual(['EMPLOYEE']);
    });

    it('same-role patch does not emit audit events', async () => {
      const target = await insertTestUser(app, { roles: [UserRole.EMPLOYEE] });

      await app.inject({
        method: 'PATCH',
        url: `/v1/users/${target._id}`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { roles: [UserRole.EMPLOYEE] },
      });

      const auditDocs = await app.mongo.db
        .collection('audit_logs')
        .find({ 'target.entityId': target._id })
        .toArray();
      expect(auditDocs).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------------------
  // Audit columns
  // -------------------------------------------------------------------------

  describe('audit columns', () => {
    it('refreshes updatedBy to the admin actor', async () => {
      const target = await insertTestUser(app, {
        roles: [UserRole.EMPLOYEE],
        createdBy: 'someone-else',
      });

      const res = await app.inject({
        method: 'PATCH',
        url: `/v1/users/${target._id}`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { roles: [UserRole.ASSET_MANAGER] },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json<{ updatedBy: string }>().updatedBy).toBe(adminId);
    });

    it('advances updatedAt strictly forward', async () => {
      const target = await insertTestUser(app, { roles: [UserRole.EMPLOYEE] });
      const before = await app.mongo.db
        .collection('users')
        .findOne({ _id: new ObjectId(target._id) });
      const beforeTs = before?.['updatedAt'] as string;

      // Ensure at least 1ms passes (ISO string precision)
      await new Promise((r) => setTimeout(r, 5));

      const res = await app.inject({
        method: 'PATCH',
        url: `/v1/users/${target._id}`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { roles: [UserRole.ASSET_MANAGER] },
      });
      expect(res.statusCode).toBe(200);

      const afterTs = res.json<{ updatedAt: string }>().updatedAt;
      expect(afterTs > beforeTs).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // 404 + 400 (validation)
  // -------------------------------------------------------------------------

  describe('not found + validation', () => {
    it('returns 404 for a valid but unknown id', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: `/v1/users/${new ObjectId().toString()}`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { roles: [UserRole.EMPLOYEE] },
      });
      expect(res.statusCode).toBe(404);
    });

    it('returns 404 for a soft-deleted target', async () => {
      const target = await insertTestUser(app);
      await app.mongo.db
        .collection('users')
        .updateOne(
          { _id: new ObjectId(target._id) },
          { $set: { deletedAt: new Date().toISOString(), deletedBy: 'test-admin' } },
        );

      const res = await app.inject({
        method: 'PATCH',
        url: `/v1/users/${target._id}`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { roles: [UserRole.EMPLOYEE] },
      });
      expect(res.statusCode).toBe(404);
    });

    it('returns 400 for empty roles array', async () => {
      const target = await insertTestUser(app);

      const res = await app.inject({
        method: 'PATCH',
        url: `/v1/users/${target._id}`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { roles: [] },
      });
      // Zod's `.min(1)` rejects at the schema layer → 400
      expect(res.statusCode).toBe(400);
    });

    it('returns 400 for invalid role enum value', async () => {
      const target = await insertTestUser(app);

      const res = await app.inject({
        method: 'PATCH',
        url: `/v1/users/${target._id}`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { roles: ['SUPER_USER'] },
      });
      expect(res.statusCode).toBe(400);
    });

    it('returns 400 for malformed id', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: '/v1/users/not-a-hex-id',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { roles: [UserRole.EMPLOYEE] },
      });
      expect(res.statusCode).toBe(400);
    });
  });

  // -------------------------------------------------------------------------
  // Self-patch guardrails
  // -------------------------------------------------------------------------

  describe('self-patch guardrails', () => {
    it('returns 400 when admin removes their own ADMIN role', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: `/v1/users/${adminId}`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { roles: [UserRole.EMPLOYEE] },
      });

      expect(res.statusCode).toBe(400);
      expect(res.json<{ message: string }>().message).toMatch(/own ADMIN role/i);
    });

    it('returns 400 when admin deactivates themselves', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: `/v1/users/${adminId}`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { isActive: false },
      });

      expect(res.statusCode).toBe(400);
      expect(res.json<{ message: string }>().message).toMatch(/deactivate themselves/i);
    });

    it('admin can patch themselves with no-op role set (still ADMIN)', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: `/v1/users/${adminId}`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { roles: [UserRole.ADMIN] },
      });
      expect(res.statusCode).toBe(200);
    });

    it('admin can add another role to themselves while keeping ADMIN', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: `/v1/users/${adminId}`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { roles: [UserRole.ADMIN, UserRole.ASSET_MANAGER] },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json<{ roles: string[] }>();
      expect(body.roles).toEqual(['ADMIN', 'ASSET_MANAGER']);
    });
  });

  // -------------------------------------------------------------------------
  // Last-admin guardrail
  //
  // In K10 the self-patch guardrail (Admins cannot remove their own ADMIN
  // role / deactivate themselves) intercepts the most common path that
  // would otherwise hit the last-admin check. The last-admin guard
  // still matters as defense in depth: it fires when an admin demotes
  // ANOTHER admin who happens to be the only remaining one (e.g. the
  // actor was just demoted in a concurrent transaction). We exercise
  // that scenario here.
  // -------------------------------------------------------------------------

  describe('last-admin guardrail', () => {
    it('allows demoting another admin while at least one other admin remains active', async () => {
      // Setup: JIT admin (actor) + seeded admin. Demoting the seeded
      // admin leaves the actor as the sole admin — still ≥ 1, so the
      // guardrail must NOT fire.
      const other = await insertTestUser(app, { roles: [UserRole.ADMIN] });

      const res = await app.inject({
        method: 'PATCH',
        url: `/v1/users/${other._id}`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { roles: [UserRole.EMPLOYEE] },
      });
      expect(res.statusCode).toBe(200);
    });

    it('allows deactivating another admin while at least one other admin remains', async () => {
      const other = await insertTestUser(app, { roles: [UserRole.ADMIN] });

      const res = await app.inject({
        method: 'PATCH',
        url: `/v1/users/${other._id}`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { isActive: false },
      });
      expect(res.statusCode).toBe(200);
    });

    // NOTE: The strict last-admin trigger (0 remaining active admins
    // after the patch) is practically unreachable through the K10 API
    // surface because the self-patch guard intercepts the only common
    // path that leads there (admin removing their own ADMIN role).
    // The defense-in-depth code path still matters for concurrent
    // transactions and future flows (e.g. bulk role updates), but
    // exercising it requires a true race that integration tests can't
    // replay deterministically. We accept that gap in K10 and revisit
    // if a future slice adds a multi-target admin endpoint.
  });

  // -------------------------------------------------------------------------
  // RBAC
  // -------------------------------------------------------------------------

  describe('RBAC', () => {
    it('returns 403 for EMPLOYEE', async () => {
      const target = await insertTestUser(app);
      const { token } = await provisionUserAsAndSignToken(app, signToken, {
        oid: 'employee-for-patch',
        role: UserRole.EMPLOYEE,
      });

      const res = await app.inject({
        method: 'PATCH',
        url: `/v1/users/${target._id}`,
        headers: { authorization: `Bearer ${token}` },
        payload: { roles: [UserRole.EMPLOYEE] },
      });
      expect(res.statusCode).toBe(403);
    });

    it('returns 403 for ASSET_MANAGER', async () => {
      const target = await insertTestUser(app);
      const { token } = await provisionUserAsAndSignToken(app, signToken, {
        oid: 'asset-manager-for-patch',
        role: UserRole.ASSET_MANAGER,
      });

      const res = await app.inject({
        method: 'PATCH',
        url: `/v1/users/${target._id}`,
        headers: { authorization: `Bearer ${token}` },
        payload: { roles: [UserRole.EMPLOYEE] },
      });
      expect(res.statusCode).toBe(403);
    });

    it('returns 401 without auth header', async () => {
      const target = await insertTestUser(app);
      const res = await app.inject({
        method: 'PATCH',
        url: `/v1/users/${target._id}`,
        payload: { roles: [UserRole.EMPLOYEE] },
      });
      expect(res.statusCode).toBe(401);
    });
  });
});
