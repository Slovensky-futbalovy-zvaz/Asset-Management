/**
 * Integration tests for PATCH /v1/categories/:id.
 *
 * Covers:
 *   - 200 with updated body on partial patch (single + multi field)
 *   - 404 when category doesn't exist or is soft-deleted
 *   - 400 for self-parent assignment
 *   - 400 for slug collision with another category
 *   - 400 for parentId pointing to a non-existent parent
 *   - Empty body no-op
 *   - updatedBy refresh, updatedAt strictly advances
 *
 * What's tested elsewhere:
 *   - RBAC, audit log content → other test files (later)
 *   - Cycle detection (parentId chain forming a loop) → K4, future
 *
 * Setup:
 *   ADMIN user, fresh DB per test. Each test inserts a baseline category
 *   via `insertTestCategory` then PATCHes it.
 */

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { buildTestApp, cleanTestDatabase } from '../helpers/test-app.js';
import {
  insertTestCategory,
  provisionUserAsAndSignToken,
  UserRole,
} from '../helpers/test-fixtures.js';
import { createTokenSigner } from '../helpers/test-jwt-loader.js';

import type { SignTestTokenInput } from '../helpers/test-jwt.js';
import type { FastifyInstance } from 'fastify';

describe('PATCH /v1/categories/:id', () => {
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
      oid: 'admin-for-categories-patch',
      role: UserRole.ADMIN,
    });
    adminToken = token;
    adminId = String(user._id);
  });

  afterEach(async () => {
    await cleanTestDatabase(app);
  });

  // -------------------------------------------------------------------------
  // Happy path
  // -------------------------------------------------------------------------

  describe('happy path', () => {
    it('updates a single field (name) and returns 200', async () => {
      const cat = await insertTestCategory(app, { name: 'Old name', slug: 'old-name' });

      const res = await app.inject({
        method: 'PATCH',
        url: `/v1/categories/${cat._id}`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { name: 'New name' },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json<{ _id: string; name: string }>();
      expect(body._id).toBe(cat._id);
      expect(body.name).toBe('New name');
    });

    it('updates multiple fields in one request', async () => {
      const cat = await insertTestCategory(app, { name: 'Pôvodný', slug: 'povodny' });

      const res = await app.inject({
        method: 'PATCH',
        url: `/v1/categories/${cat._id}`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          name: 'Premenovaný',
          description: 'Nový popis',
          icon: 'briefcase',
          color: '#1450df',
          isActive: false,
          sortOrder: 10,
        },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json<{
        name: string;
        description: string;
        icon: string;
        color: string;
        isActive: boolean;
        sortOrder: number;
      }>();
      expect(body.name).toBe('Premenovaný');
      expect(body.description).toBe('Nový popis');
      expect(body.icon).toBe('briefcase');
      expect(body.color).toBe('#1450df');
      expect(body.isActive).toBe(false);
      expect(body.sortOrder).toBe(10);
    });

    it('updates parentId to a valid parent', async () => {
      const parent = await insertTestCategory(app, { slug: 'new-parent' });
      const child = await insertTestCategory(app, { slug: 'orphan-to-reparent' });

      const res = await app.inject({
        method: 'PATCH',
        url: `/v1/categories/${child._id}`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { parentId: parent._id },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json<{ parentId: string }>().parentId).toBe(parent._id);
    });

    it('updates parentId to null (reparent to root)', async () => {
      const parent = await insertTestCategory(app, { slug: 'will-be-detached' });
      const child = await insertTestCategory(app, {
        slug: 'attached-child',
        parentId: parent._id,
      });

      const res = await app.inject({
        method: 'PATCH',
        url: `/v1/categories/${child._id}`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { parentId: null },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json<{ parentId: string | null }>().parentId).toBeNull();
    });

    it('persists the change — second GET returns the updated values', async () => {
      const cat = await insertTestCategory(app, { name: 'Before' });

      await app.inject({
        method: 'PATCH',
        url: `/v1/categories/${cat._id}`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { name: 'After' },
      });

      const get = await app.inject({
        method: 'GET',
        url: `/v1/categories/${cat._id}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(get.statusCode).toBe(200);
      expect(get.json<{ name: string }>().name).toBe('After');
    });
  });

  // -------------------------------------------------------------------------
  // Not found
  // -------------------------------------------------------------------------

  describe('not found', () => {
    it('returns 404 when category _id does not exist', async () => {
      const fakeId = '0123456789abcdef01234567';

      const res = await app.inject({
        method: 'PATCH',
        url: `/v1/categories/${fakeId}`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { name: 'Whatever' },
      });

      expect(res.statusCode).toBe(404);
    });

    it('returns 404 for a soft-deleted category', async () => {
      const cat = await insertTestCategory(app);

      const { ObjectId } = await import('mongodb');
      await app.mongo.db
        .collection('categories')
        .updateOne(
          { _id: new ObjectId(cat._id) },
          { $set: { deletedAt: new Date().toISOString(), deletedBy: adminId } },
        );

      const res = await app.inject({
        method: 'PATCH',
        url: `/v1/categories/${cat._id}`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { name: 'Trying to update a deleted category' },
      });

      expect(res.statusCode).toBe(404);
    });

    it('returns 400 for malformed _id (not 24-hex)', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: '/v1/categories/not-a-valid-id',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { name: 'Whatever' },
      });
      expect(res.statusCode).toBe(400);
    });
  });

  // -------------------------------------------------------------------------
  // Self-parent + parent existence
  // -------------------------------------------------------------------------

  describe('hierarchy validation', () => {
    it('rejects self-parent assignment with 400', async () => {
      const cat = await insertTestCategory(app);

      const res = await app.inject({
        method: 'PATCH',
        url: `/v1/categories/${cat._id}`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { parentId: cat._id },
      });

      expect(res.statusCode).toBe(400);
      const body = res.json<{ message: string }>();
      expect(body.message).toMatch(/own parent/i);
    });

    it('rejects parentId pointing to a non-existent parent with 400', async () => {
      const cat = await insertTestCategory(app);
      const fakeParent = '0123456789abcdef01234567';

      const res = await app.inject({
        method: 'PATCH',
        url: `/v1/categories/${cat._id}`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { parentId: fakeParent },
      });

      expect(res.statusCode).toBe(400);
    });
  });

  // -------------------------------------------------------------------------
  // Slug collision
  // -------------------------------------------------------------------------

  describe('slug collision', () => {
    it('rejects changing slug to one that exists on another category with 400', async () => {
      const other = await insertTestCategory(app, { slug: 'already-taken' });
      const cat = await insertTestCategory(app, { slug: 'free-slug' });

      const res = await app.inject({
        method: 'PATCH',
        url: `/v1/categories/${cat._id}`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { slug: 'already-taken' },
      });

      expect(res.statusCode).toBe(400);
      const body = res.json<{ message: string }>();
      expect(body.message).toMatch(/slug.*already exists/i);
      // Ensure we identified the right one (not Claude paranoia)
      expect(other.slug).toBe('already-taken');
    });

    it('allows PATCH with the same slug as the category currently has (no-op slug)', async () => {
      const cat = await insertTestCategory(app, { slug: 'unchanged-slug' });

      const res = await app.inject({
        method: 'PATCH',
        url: `/v1/categories/${cat._id}`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { slug: 'unchanged-slug', name: 'New name only' },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json<{ slug: string; name: string }>().slug).toBe('unchanged-slug');
    });
  });

  // -------------------------------------------------------------------------
  // Empty body / validation
  // -------------------------------------------------------------------------

  describe('validation', () => {
    it('accepts empty body (no-op)', async () => {
      const cat = await insertTestCategory(app, { name: 'Original' });

      const res = await app.inject({
        method: 'PATCH',
        url: `/v1/categories/${cat._id}`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {},
      });

      expect(res.statusCode).toBe(200);
      expect(res.json<{ name: string }>().name).toBe('Original');
    });

    it('rejects invalid assetType enum', async () => {
      const cat = await insertTestCategory(app);

      const res = await app.inject({
        method: 'PATCH',
        url: `/v1/categories/${cat._id}`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { assetType: 'TOTALLY_FAKE' },
      });

      expect(res.statusCode).toBe(400);
    });
  });

  // -------------------------------------------------------------------------
  // Audit fields
  // -------------------------------------------------------------------------

  describe('audit fields', () => {
    it('updates updatedBy to the calling user _id', async () => {
      const cat = await insertTestCategory(app, { createdBy: 'someone-else' });

      const res = await app.inject({
        method: 'PATCH',
        url: `/v1/categories/${cat._id}`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { name: 'New name' },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json<{ createdBy: string; updatedBy: string }>();
      expect(body.createdBy).toBe('someone-else');
      expect(body.updatedBy).toBe(adminId);
    });

    it('advances updatedAt to a newer timestamp', async () => {
      const oldTimestamp = new Date(Date.now() - 60_000).toISOString();
      const insertResult = await app.mongo.db.collection('categories').insertOne({
        name: 'Old',
        slug: 'old-ts-cat',
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
        createdAt: oldTimestamp,
        updatedAt: oldTimestamp,
        createdBy: 'test',
        updatedBy: 'test',
        deletedAt: null,
        deletedBy: null,
      });
      const id = String(insertResult.insertedId);

      const res = await app.inject({
        method: 'PATCH',
        url: `/v1/categories/${id}`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { name: 'Trigger update' },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json<{ createdAt: string; updatedAt: string }>();
      expect(body.createdAt).toBe(oldTimestamp);
      expect(new Date(body.updatedAt).getTime()).toBeGreaterThan(new Date(oldTimestamp).getTime());
    });
  });
});
