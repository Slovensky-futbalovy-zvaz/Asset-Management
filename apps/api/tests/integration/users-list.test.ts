/**
 * Integration tests for GET /v1/users (admin list endpoint).
 *
 * Covers:
 *   - 200 with paginated list and metadata
 *   - Default + custom limit/skip pagination
 *   - Filter by role
 *   - Filter by isActive
 *   - Free-text search across email / displayName / firstName / lastName
 *   - Regex escaping for special chars in q
 *   - Soft-deleted users excluded
 *   - passwordHash never returned
 *   - 403 for non-admin (EMPLOYEE, ASSET_MANAGER, TEAM_MANAGER, EXTERNAL)
 *   - 401 for missing / invalid auth
 *
 * Setup:
 *   ADMIN user via JIT, plus a fleet of fixture users via direct insert
 *   for filter / pagination probing.
 */

import { ObjectId } from 'mongodb';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { buildTestApp, cleanTestDatabase } from '../helpers/test-app.js';
import { insertTestUser, provisionUserAsAndSignToken, UserRole } from '../helpers/test-fixtures.js';
import { createTokenSigner } from '../helpers/test-jwt-loader.js';

import type { SignTestTokenInput } from '../helpers/test-jwt.js';
import type { FastifyInstance } from 'fastify';

describe('GET /v1/users', () => {
  let app: FastifyInstance;
  let signToken: (input: SignTestTokenInput) => Promise<string>;
  let adminToken: string;

  beforeAll(async () => {
    app = await buildTestApp();
    signToken = await createTokenSigner();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await cleanTestDatabase(app);
    const { token } = await provisionUserAsAndSignToken(app, signToken, {
      oid: 'admin-for-users-list',
      role: UserRole.ADMIN,
    });
    adminToken = token;
  });

  afterEach(async () => {
    await cleanTestDatabase(app);
  });

  // -------------------------------------------------------------------------
  // Happy path + shape
  // -------------------------------------------------------------------------

  describe('happy path', () => {
    it('returns the calling admin plus inserted users (no filters)', async () => {
      await insertTestUser(app, { email: 'alice@example.com', roles: [UserRole.EMPLOYEE] });
      await insertTestUser(app, { email: 'bob@example.com', roles: [UserRole.ASSET_MANAGER] });

      const res = await app.inject({
        method: 'GET',
        url: '/v1/users',
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json<{
        data: Array<{ email: string }>;
        pagination: { total: number; limit: number; skip: number; hasMore: boolean };
      }>();
      // 2 inserted + 1 admin (JIT-provisioned during beforeEach)
      expect(body.pagination.total).toBe(3);
      expect(body.pagination.limit).toBe(50);
      expect(body.pagination.skip).toBe(0);
      expect(body.pagination.hasMore).toBe(false);
      expect(body.data).toHaveLength(3);
    });

    it('returns documents without passwordHash', async () => {
      await insertTestUser(app, { email: 'check-hash@example.com' });

      const res = await app.inject({
        method: 'GET',
        url: '/v1/users',
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json<{ data: Array<Record<string, unknown>> }>();
      for (const user of body.data) {
        expect(user).not.toHaveProperty('passwordHash');
      }
    });

    it('sorts users alphabetically by displayName ascending', async () => {
      await insertTestUser(app, { displayName: 'Zora Z', email: 'z@example.com' });
      await insertTestUser(app, { displayName: 'Adam A', email: 'a@example.com' });
      await insertTestUser(app, { displayName: 'Milan M', email: 'm@example.com' });

      const res = await app.inject({
        method: 'GET',
        url: '/v1/users',
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json<{ data: Array<{ displayName: string }> }>();
      const displayNames = body.data.map((u) => u.displayName);
      // Adam comes first; Zora last. The JIT admin's displayName starts
      // with a lowercase 'a' so we check relative order of seeded users.
      const adamIdx = displayNames.indexOf('Adam A');
      const milanIdx = displayNames.indexOf('Milan M');
      const zoraIdx = displayNames.indexOf('Zora Z');
      expect(adamIdx).toBeLessThan(milanIdx);
      expect(milanIdx).toBeLessThan(zoraIdx);
    });
  });

  // -------------------------------------------------------------------------
  // Pagination
  // -------------------------------------------------------------------------

  describe('pagination', () => {
    it('respects limit', async () => {
      for (let i = 0; i < 5; i++) {
        await insertTestUser(app, {
          email: `user-${i}@example.com`,
          displayName: `User ${i}`,
        });
      }

      const res = await app.inject({
        method: 'GET',
        url: '/v1/users?limit=3',
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json<{ data: unknown[]; pagination: { limit: number; hasMore: boolean } }>();
      expect(body.data).toHaveLength(3);
      expect(body.pagination.limit).toBe(3);
      expect(body.pagination.hasMore).toBe(true);
    });

    it('respects skip', async () => {
      for (let i = 0; i < 5; i++) {
        await insertTestUser(app, {
          email: `user-skip-${i}@example.com`,
          displayName: `Skip ${i}`,
        });
      }

      const res = await app.inject({
        method: 'GET',
        url: '/v1/users?limit=2&skip=2',
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json<{
        data: unknown[];
        pagination: { skip: number; total: number; hasMore: boolean };
      }>();
      expect(body.data).toHaveLength(2);
      expect(body.pagination.skip).toBe(2);
      // 5 inserted + 1 admin = 6; with skip=2, limit=2 there's 6-2-2=2 more
      expect(body.pagination.hasMore).toBe(true);
    });

    it('rejects limit > 200', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/v1/users?limit=500',
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(res.statusCode).toBe(400);
    });
  });

  // -------------------------------------------------------------------------
  // Filters
  // -------------------------------------------------------------------------

  describe('filters', () => {
    it('filters by role', async () => {
      await insertTestUser(app, { email: 'emp@example.com', roles: [UserRole.EMPLOYEE] });
      await insertTestUser(app, { email: 'mgr@example.com', roles: [UserRole.ASSET_MANAGER] });
      await insertTestUser(app, {
        email: 'both@example.com',
        roles: [UserRole.EMPLOYEE, UserRole.TEAM_MANAGER],
      });

      const res = await app.inject({
        method: 'GET',
        url: '/v1/users?role=EMPLOYEE',
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json<{ data: Array<{ email: string; roles: string[] }> }>();
      // emp + both both have EMPLOYEE in their roles array
      const emails = body.data.map((u) => u.email).sort();
      expect(emails).toContain('emp@example.com');
      expect(emails).toContain('both@example.com');
      expect(emails).not.toContain('mgr@example.com');
    });

    it('filters by isActive=false (deactivated only)', async () => {
      await insertTestUser(app, { email: 'active@example.com', isActive: true });
      await insertTestUser(app, { email: 'inactive@example.com', isActive: false });

      const res = await app.inject({
        method: 'GET',
        url: '/v1/users?isActive=false',
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json<{ data: Array<{ email: string; isActive: boolean }> }>();
      expect(body.data).toHaveLength(1);
      expect(body.data[0]!.email).toBe('inactive@example.com');
      expect(body.data[0]!.isActive).toBe(false);
    });

    it('combines role + isActive filters', async () => {
      await insertTestUser(app, {
        email: 'admin-active@example.com',
        roles: [UserRole.ADMIN],
        isActive: true,
      });
      await insertTestUser(app, {
        email: 'admin-inactive@example.com',
        roles: [UserRole.ADMIN],
        isActive: false,
      });

      const res = await app.inject({
        method: 'GET',
        url: '/v1/users?role=ADMIN&isActive=true',
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json<{ data: Array<{ email: string }> }>();
      const emails = body.data.map((u) => u.email);
      expect(emails).toContain('admin-active@example.com');
      expect(emails).not.toContain('admin-inactive@example.com');
    });
  });

  // -------------------------------------------------------------------------
  // Free-text search
  // -------------------------------------------------------------------------

  describe('q (free-text search)', () => {
    it('matches partial email (case-insensitive)', async () => {
      await insertTestUser(app, { email: 'jano.letko@sfz.sk' });
      await insertTestUser(app, { email: 'someone@example.com' });

      const res = await app.inject({
        method: 'GET',
        url: '/v1/users?q=LETKO',
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json<{ data: Array<{ email: string }> }>();
      const emails = body.data.map((u) => u.email);
      expect(emails).toContain('jano.letko@sfz.sk');
      expect(emails).not.toContain('someone@example.com');
    });

    it('matches partial displayName', async () => {
      await insertTestUser(app, {
        email: 'mária@example.com',
        firstName: 'Mária',
        lastName: 'Slovenská',
        displayName: 'Mária Slovenská',
      });

      const res = await app.inject({
        method: 'GET',
        url: '/v1/users?q=Slovens',
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json<{ data: Array<{ displayName: string }> }>();
      const found = body.data.find((u) => u.displayName === 'Mária Slovenská');
      expect(found).toBeDefined();
    });

    it('escapes regex meta-characters so q="a.b" is not a wildcard', async () => {
      await insertTestUser(app, { email: 'aXb@example.com', firstName: 'aXb' });
      await insertTestUser(app, { email: 'a.b@example.com', firstName: 'a.b' });

      const res = await app.inject({
        method: 'GET',
        url: '/v1/users?q=a.b',
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json<{ data: Array<{ email: string }> }>();
      const emails = body.data.map((u) => u.email);
      expect(emails).toContain('a.b@example.com');
      expect(emails).not.toContain('aXb@example.com');
    });
  });

  // -------------------------------------------------------------------------
  // Soft-delete exclusion
  // -------------------------------------------------------------------------

  describe('soft-deleted users', () => {
    it('excludes soft-deleted users from listings', async () => {
      const target = await insertTestUser(app, { email: 'will-be-deleted@example.com' });

      // Soft-delete directly via DB (no admin DELETE endpoint exists yet).
      await app.mongo.db
        .collection('users')
        .updateOne(
          { _id: new ObjectId(target._id) },
          { $set: { deletedAt: new Date().toISOString(), deletedBy: 'test-admin' } },
        );

      const res = await app.inject({
        method: 'GET',
        url: '/v1/users',
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json<{ data: Array<{ email: string }> }>();
      const emails = body.data.map((u) => u.email);
      expect(emails).not.toContain('will-be-deleted@example.com');
    });
  });

  // -------------------------------------------------------------------------
  // RBAC + auth
  // -------------------------------------------------------------------------

  describe('RBAC', () => {
    it.each([
      ['EMPLOYEE', UserRole.EMPLOYEE],
      ['TEAM_MANAGER', UserRole.TEAM_MANAGER],
      ['ASSET_MANAGER', UserRole.ASSET_MANAGER],
      ['EXTERNAL', UserRole.EXTERNAL],
    ])('returns 403 for %s', async (_label, role) => {
      const { token } = await provisionUserAsAndSignToken(app, signToken, {
        oid: `non-admin-${role}`,
        role,
      });

      const res = await app.inject({
        method: 'GET',
        url: '/v1/users',
        headers: { authorization: `Bearer ${token}` },
      });
      expect(res.statusCode).toBe(403);
    });

    it('returns 401 without Authorization header', async () => {
      const res = await app.inject({ method: 'GET', url: '/v1/users' });
      expect(res.statusCode).toBe(401);
    });

    it('returns 401 with malformed Bearer token', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/v1/users',
        headers: { authorization: 'Bearer not-a-jwt' },
      });
      expect(res.statusCode).toBe(401);
    });
  });
});
