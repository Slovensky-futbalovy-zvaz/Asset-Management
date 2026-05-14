/**
 * Integration tests for POST /v1/categories.
 *
 * Covers:
 *   - 201 Created with valid body
 *   - Slug uniqueness check (409-ish via 400 BadRequestError)
 *   - Parent existence check (parentId non-null must reference existing)
 *   - Required field validation (400 for missing/malformed)
 *   - Audit fields populated correctly (createdBy/updatedBy = user._id)
 *
 * What's tested elsewhere:
 *   - RBAC → categories.rbac will be added later; for now we rely on the
 *     same RBAC enforcement pattern as assets (covered in assets RBAC tests)
 *   - Audit log entry creation → categories audit test (future)
 *   - Auth gate → auth.test.ts
 *
 * Setup:
 *   Each test starts with a clean DB and an ADMIN user. ADMIN has the
 *   broadest privileges, so authentication/RBAC is out of the picture
 *   and we focus on POST behaviour.
 */

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { buildTestApp, cleanTestDatabase } from '../helpers/test-app.js';
import {
  insertTestCategory,
  provisionUserAsAndSignToken,
  UserRole,
  validCreateCategoryBody,
} from '../helpers/test-fixtures.js';
import { createTokenSigner } from '../helpers/test-jwt-loader.js';

import type { SignTestTokenInput } from '../helpers/test-jwt.js';
import type { FastifyInstance } from 'fastify';

describe('POST /v1/categories', () => {
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
      oid: 'admin-for-categories-post',
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
    it('creates a root category and returns 201', async () => {
      const body = validCreateCategoryBody({
        name: 'Notebooky',
        slug: 'notebooky',
        assetType: 'IT',
      });

      const res = await app.inject({
        method: 'POST',
        url: '/v1/categories',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: body,
      });

      expect(res.statusCode).toBe(201);
      const result = res.json<{
        _id: string;
        name: string;
        slug: string;
        parentId: string | null;
        assetType: string;
        isActive: boolean;
      }>();

      expect(result._id).toMatch(/^[a-f0-9]{24}$/);
      expect(result.name).toBe('Notebooky');
      expect(result.slug).toBe('notebooky');
      expect(result.parentId).toBeNull();
      expect(result.assetType).toBe('IT');
      expect(result.isActive).toBe(true);
    });

    it('creates a child category referencing an existing parent', async () => {
      const parent = await insertTestCategory(app, { name: 'Šport', slug: 'sport' });

      const body = validCreateCategoryBody({
        name: 'Dresy',
        slug: 'dresy',
        parentId: parent._id,
        assetType: 'SPORTS_GEAR',
      });

      const res = await app.inject({
        method: 'POST',
        url: '/v1/categories',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: body,
      });

      expect(res.statusCode).toBe(201);
      const result = res.json<{ parentId: string }>();
      expect(result.parentId).toBe(parent._id);
    });

    it('persists the category so GET returns it', async () => {
      const create = await app.inject({
        method: 'POST',
        url: '/v1/categories',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: validCreateCategoryBody({ name: 'Persisted', slug: 'persisted-cat' }),
      });
      expect(create.statusCode).toBe(201);
      const id = create.json<{ _id: string }>()._id;

      const get = await app.inject({
        method: 'GET',
        url: `/v1/categories/${id}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(get.statusCode).toBe(200);
      const body = get.json<{ name: string; slug: string }>();
      expect(body.name).toBe('Persisted');
      expect(body.slug).toBe('persisted-cat');
    });
  });

  // -------------------------------------------------------------------------
  // Slug uniqueness
  // -------------------------------------------------------------------------

  describe('slug uniqueness', () => {
    it('rejects a duplicate slug with 400', async () => {
      await insertTestCategory(app, { slug: 'duplicate-slug' });

      const res = await app.inject({
        method: 'POST',
        url: '/v1/categories',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: validCreateCategoryBody({ slug: 'duplicate-slug', name: 'Second one' }),
      });

      expect(res.statusCode).toBe(400);
      const body = res.json<{ message: string }>();
      expect(body.message).toMatch(/slug.*already exists/i);
    });
  });

  // -------------------------------------------------------------------------
  // Parent existence
  // -------------------------------------------------------------------------

  describe('parent existence', () => {
    it('rejects parentId pointing to a non-existent category with 400', async () => {
      const fakeParentId = '0123456789abcdef01234567';

      const res = await app.inject({
        method: 'POST',
        url: '/v1/categories',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: validCreateCategoryBody({ parentId: fakeParentId }),
      });

      expect(res.statusCode).toBe(400);
      const body = res.json<{ message: string }>();
      expect(body.message).toMatch(/parent.*does not exist/i);
    });

    it('rejects parentId pointing to a soft-deleted category with 400', async () => {
      const parent = await insertTestCategory(app, { slug: 'about-to-delete' });

      // Soft-delete the parent manually
      const { ObjectId } = await import('mongodb');
      await app.mongo.db
        .collection('categories')
        .updateOne(
          { _id: new ObjectId(parent._id) },
          { $set: { deletedAt: new Date().toISOString(), deletedBy: 'test' } },
        );

      const res = await app.inject({
        method: 'POST',
        url: '/v1/categories',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: validCreateCategoryBody({ parentId: parent._id }),
      });

      expect(res.statusCode).toBe(400);
    });
  });

  // -------------------------------------------------------------------------
  // Validation failures
  // -------------------------------------------------------------------------

  describe('validation failures', () => {
    it('rejects empty name with 400', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/v1/categories',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: validCreateCategoryBody({ name: '' }),
      });
      expect(res.statusCode).toBe(400);
    });

    it('rejects slug with uppercase letters (must be lowercase-with-dashes)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/v1/categories',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: validCreateCategoryBody({ slug: 'UPPERCASE-Slug' }),
      });
      expect(res.statusCode).toBe(400);
    });

    it('rejects slug with spaces', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/v1/categories',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: validCreateCategoryBody({ slug: 'has spaces' }),
      });
      expect(res.statusCode).toBe(400);
    });

    it('rejects unknown assetType value', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/v1/categories',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: validCreateCategoryBody({ assetType: 'NOT_A_REAL_TYPE' }),
      });
      expect(res.statusCode).toBe(400);
    });

    it('rejects malformed color (not hex)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/v1/categories',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: validCreateCategoryBody({ color: 'not-a-color' }),
      });
      expect(res.statusCode).toBe(400);
    });
  });

  // -------------------------------------------------------------------------
  // Audit fields
  // -------------------------------------------------------------------------

  describe('audit fields', () => {
    it('sets createdBy and updatedBy to the calling user _id', async () => {
      const usersColl = app.mongo.db.collection('users');
      const adminUser = await usersColl.findOne({ entraOid: 'admin-for-categories-post' });
      expect(adminUser).not.toBeNull();
      const adminId = String(adminUser!._id);

      const res = await app.inject({
        method: 'POST',
        url: '/v1/categories',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: validCreateCategoryBody(),
      });

      expect(res.statusCode).toBe(201);
      const body = res.json<{ createdBy: string; updatedBy: string }>();
      expect(body.createdBy).toBe(adminId);
      expect(body.updatedBy).toBe(adminId);
    });

    it('sets createdAt and updatedAt to equal ISO timestamps on insert', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/v1/categories',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: validCreateCategoryBody(),
      });

      expect(res.statusCode).toBe(201);
      const body = res.json<{ createdAt: string; updatedAt: string }>();
      expect(body.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
      expect(body.updatedAt).toBe(body.createdAt);
    });
  });
});
