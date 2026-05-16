/**
 * Integration tests for GET /v1/users/:id (admin endpoint).
 *
 * Covers:
 *   - 200 with user document by id
 *   - passwordHash never returned
 *   - 404 for non-existent id
 *   - 404 for soft-deleted user
 *   - 400 for malformed id
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

describe('GET /v1/users/:id', () => {
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
      oid: 'admin-for-users-get',
      role: UserRole.ADMIN,
    });
    adminToken = token;
  });

  afterEach(async () => {
    await cleanTestDatabase(app);
  });

  // -------------------------------------------------------------------------
  // Happy path
  // -------------------------------------------------------------------------

  describe('happy path', () => {
    it('returns 200 with the user matching :id', async () => {
      const target = await insertTestUser(app, {
        email: 'fetch-me@example.com',
        firstName: 'Fetch',
        lastName: 'Me',
      });

      const res = await app.inject({
        method: 'GET',
        url: `/v1/users/${target._id}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json<{
        _id: string;
        email: string;
        firstName: string;
        lastName: string;
      }>();
      expect(body._id).toBe(target._id);
      expect(body.email).toBe('fetch-me@example.com');
      expect(body.firstName).toBe('Fetch');
      expect(body.lastName).toBe('Me');
    });

    it('does not return passwordHash', async () => {
      const target = await insertTestUser(app);

      const res = await app.inject({
        method: 'GET',
        url: `/v1/users/${target._id}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json()).not.toHaveProperty('passwordHash');
    });
  });

  // -------------------------------------------------------------------------
  // 404 paths
  // -------------------------------------------------------------------------

  describe('not found', () => {
    it('returns 404 for a valid but unknown id', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/v1/users/${new ObjectId().toString()}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(res.statusCode).toBe(404);
    });

    it('returns 404 for a soft-deleted user', async () => {
      const target = await insertTestUser(app, { email: 'deleted@example.com' });

      await app.mongo.db
        .collection('users')
        .updateOne(
          { _id: new ObjectId(target._id) },
          { $set: { deletedAt: new Date().toISOString(), deletedBy: 'test-admin' } },
        );

      const res = await app.inject({
        method: 'GET',
        url: `/v1/users/${target._id}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(res.statusCode).toBe(404);
    });
  });

  // -------------------------------------------------------------------------
  // 400 — malformed id
  // -------------------------------------------------------------------------

  describe('validation', () => {
    it('returns 400 for a non-24-hex id', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/v1/users/not-a-hex-id',
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(res.statusCode).toBe(400);
    });
  });

  // -------------------------------------------------------------------------
  // RBAC
  // -------------------------------------------------------------------------

  describe('RBAC', () => {
    it('returns 403 for EMPLOYEE', async () => {
      const target = await insertTestUser(app);
      const { token } = await provisionUserAsAndSignToken(app, signToken, {
        oid: 'employee-for-get-by-id',
        role: UserRole.EMPLOYEE,
      });

      const res = await app.inject({
        method: 'GET',
        url: `/v1/users/${target._id}`,
        headers: { authorization: `Bearer ${token}` },
      });
      expect(res.statusCode).toBe(403);
    });

    it('returns 401 without auth header', async () => {
      const target = await insertTestUser(app);
      const res = await app.inject({
        method: 'GET',
        url: `/v1/users/${target._id}`,
      });
      expect(res.statusCode).toBe(401);
    });
  });
});
