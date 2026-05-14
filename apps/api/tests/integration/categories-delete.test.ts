/**
 * Integration tests for DELETE /v1/categories/:id.
 *
 * DELETE is a soft-delete: the document stays in the collection but gets
 * `deletedAt` and `deletedBy` fields set, and is excluded from subsequent
 * reads.
 *
 * Covers:
 *   - 204 on successful soft-delete
 *   - GET /:id returns 404 after DELETE
 *   - GET list excludes soft-deleted categories
 *   - 404 when category doesn't exist
 *   - 404 when category is already soft-deleted (idempotency boundary)
 *   - 400 when category has direct children (orphan protection)
 *   - 400 for malformed _id
 *   - deletedBy is set to the calling user _id
 *
 * What's tested elsewhere:
 *   - RBAC, audit content → other files
 *   - Asset FK protection — slice #3 K9 (assets referencing the category
 *     will block deletion). Not enforced yet in K1.
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

describe('DELETE /v1/categories/:id', () => {
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
      oid: 'admin-for-categories-delete',
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
    it('soft-deletes a leaf category and returns 204', async () => {
      const cat = await insertTestCategory(app);

      const res = await app.inject({
        method: 'DELETE',
        url: `/v1/categories/${cat._id}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(res.statusCode).toBe(204);
      expect(res.body).toBe('');
    });

    it('subsequent GET /:id returns 404', async () => {
      const cat = await insertTestCategory(app);

      await app.inject({
        method: 'DELETE',
        url: `/v1/categories/${cat._id}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });

      const get = await app.inject({
        method: 'GET',
        url: `/v1/categories/${cat._id}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(get.statusCode).toBe(404);
    });

    it('GET list excludes soft-deleted categories', async () => {
      const keep = await insertTestCategory(app, { name: 'Keeper', slug: 'keeper-cat' });
      const remove = await insertTestCategory(app, { name: 'Doomed', slug: 'doomed-cat' });

      const before = await app.inject({
        method: 'GET',
        url: '/v1/categories',
        headers: { authorization: `Bearer ${adminToken}` },
      });
      const beforeBody = before.json<{ pagination: { total: number } }>();
      expect(beforeBody.pagination.total).toBe(2);

      await app.inject({
        method: 'DELETE',
        url: `/v1/categories/${remove._id}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });

      const after = await app.inject({
        method: 'GET',
        url: '/v1/categories',
        headers: { authorization: `Bearer ${adminToken}` },
      });
      const afterBody = after.json<{
        data: Array<{ _id: string }>;
        pagination: { total: number };
      }>();
      expect(afterBody.pagination.total).toBe(1);
      expect(afterBody.data[0]?._id).toBe(keep._id);
    });

    it('sets deletedAt and deletedBy on the document', async () => {
      const cat = await insertTestCategory(app);
      const beforeDelete = Date.now();

      await app.inject({
        method: 'DELETE',
        url: `/v1/categories/${cat._id}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });

      const { ObjectId } = await import('mongodb');
      const doc = await app.mongo.db
        .collection<{ deletedAt: string | null; deletedBy: string | null }>('categories')
        .findOne({ _id: new ObjectId(cat._id) });

      expect(doc).not.toBeNull();
      expect(doc!.deletedAt).not.toBeNull();
      expect(doc!.deletedBy).toBe(adminId);

      const deletedAtMs = new Date(doc!.deletedAt!).getTime();
      expect(deletedAtMs).toBeGreaterThanOrEqual(beforeDelete);
      expect(deletedAtMs).toBeLessThanOrEqual(Date.now());
    });
  });

  // -------------------------------------------------------------------------
  // Not found
  // -------------------------------------------------------------------------

  describe('not found', () => {
    it('returns 404 when category _id does not exist', async () => {
      const fakeId = '0123456789abcdef01234567';

      const res = await app.inject({
        method: 'DELETE',
        url: `/v1/categories/${fakeId}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(res.statusCode).toBe(404);
    });

    it('returns 404 when category is already soft-deleted', async () => {
      const cat = await insertTestCategory(app);

      const first = await app.inject({
        method: 'DELETE',
        url: `/v1/categories/${cat._id}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(first.statusCode).toBe(204);

      const second = await app.inject({
        method: 'DELETE',
        url: `/v1/categories/${cat._id}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(second.statusCode).toBe(404);
    });

    it('returns 400 for malformed _id (not 24-hex)', async () => {
      const res = await app.inject({
        method: 'DELETE',
        url: '/v1/categories/not-a-valid-id',
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(res.statusCode).toBe(400);
    });
  });

  // -------------------------------------------------------------------------
  // Tree integrity — refuse if has children
  // -------------------------------------------------------------------------

  describe('child orphan protection', () => {
    it('returns 400 when deleting a category with one direct child', async () => {
      const parent = await insertTestCategory(app, { slug: 'parent-with-child' });
      await insertTestCategory(app, { slug: 'a-child', parentId: parent._id });

      const res = await app.inject({
        method: 'DELETE',
        url: `/v1/categories/${parent._id}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(res.statusCode).toBe(400);
      const body = res.json<{ message: string }>();
      expect(body.message).toMatch(/cannot delete/i);
      expect(body.message).toMatch(/child categor/i);
    });

    it('returns 400 with the correct count when there are multiple children', async () => {
      const parent = await insertTestCategory(app, { slug: 'parent-many-children' });
      await insertTestCategory(app, { slug: 'child-one', parentId: parent._id });
      await insertTestCategory(app, { slug: 'child-two', parentId: parent._id });
      await insertTestCategory(app, { slug: 'child-three', parentId: parent._id });

      const res = await app.inject({
        method: 'DELETE',
        url: `/v1/categories/${parent._id}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(res.statusCode).toBe(400);
      const body = res.json<{ message: string }>();
      expect(body.message).toContain('3');
    });

    it('allows deletion of a category whose only child was already soft-deleted', async () => {
      const parent = await insertTestCategory(app, { slug: 'parent-with-deleted-child' });
      const child = await insertTestCategory(app, {
        slug: 'soft-deleted-child',
        parentId: parent._id,
      });

      // Soft-delete the child first
      const { ObjectId } = await import('mongodb');
      await app.mongo.db
        .collection('categories')
        .updateOne(
          { _id: new ObjectId(child._id) },
          { $set: { deletedAt: new Date().toISOString(), deletedBy: adminId } },
        );

      // Now the parent should be deletable
      const res = await app.inject({
        method: 'DELETE',
        url: `/v1/categories/${parent._id}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(res.statusCode).toBe(204);
    });
  });
});
