/**
 * Integration tests for DELETE /v1/locations/:id.
 *
 * Mirrors `categories-delete.test.ts` precisely. DELETE is a soft-delete:
 * the document stays in the collection but gets `deletedAt`/`deletedBy`
 * fields set, and is excluded from subsequent reads.
 *
 * Covers:
 *   - 204 on successful soft-delete
 *   - GET /:id returns 404 after DELETE
 *   - GET list excludes soft-deleted locations
 *   - 404 when location doesn't exist
 *   - 404 when location is already soft-deleted (idempotency boundary)
 *   - 400 when location has direct children (orphan protection)
 *   - 400 for malformed _id
 *   - deletedBy is set to the calling user _id
 */

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { buildTestApp, cleanTestDatabase } from '../helpers/test-app.js';
import {
  insertTestLocation,
  provisionUserAsAndSignToken,
  UserRole,
} from '../helpers/test-fixtures.js';
import { createTokenSigner } from '../helpers/test-jwt-loader.js';

import type { SignTestTokenInput } from '../helpers/test-jwt.js';
import type { FastifyInstance } from 'fastify';

describe('DELETE /v1/locations/:id', () => {
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
      oid: 'admin-for-locations-delete',
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
    it('soft-deletes a leaf location and returns 204', async () => {
      const loc = await insertTestLocation(app);

      const res = await app.inject({
        method: 'DELETE',
        url: `/v1/locations/${loc._id}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(res.statusCode).toBe(204);
      expect(res.body).toBe('');
    });

    it('subsequent GET /:id returns 404', async () => {
      const loc = await insertTestLocation(app);

      await app.inject({
        method: 'DELETE',
        url: `/v1/locations/${loc._id}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });

      const get = await app.inject({
        method: 'GET',
        url: `/v1/locations/${loc._id}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(get.statusCode).toBe(404);
    });

    it('GET list excludes soft-deleted locations', async () => {
      const keep = await insertTestLocation(app, { name: 'Keeper', slug: 'keeper-loc' });
      const remove = await insertTestLocation(app, { name: 'Doomed', slug: 'doomed-loc' });

      const before = await app.inject({
        method: 'GET',
        url: '/v1/locations',
        headers: { authorization: `Bearer ${adminToken}` },
      });
      const beforeBody = before.json<{ pagination: { total: number } }>();
      expect(beforeBody.pagination.total).toBe(2);

      await app.inject({
        method: 'DELETE',
        url: `/v1/locations/${remove._id}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });

      const after = await app.inject({
        method: 'GET',
        url: '/v1/locations',
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
      const loc = await insertTestLocation(app);
      const beforeDelete = Date.now();

      await app.inject({
        method: 'DELETE',
        url: `/v1/locations/${loc._id}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });

      const { ObjectId } = await import('mongodb');
      const doc = await app.mongo.db
        .collection<{ deletedAt: string | null; deletedBy: string | null }>('locations')
        .findOne({ _id: new ObjectId(loc._id) });

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
    it('returns 404 when location _id does not exist', async () => {
      const fakeId = '0123456789abcdef01234567';

      const res = await app.inject({
        method: 'DELETE',
        url: `/v1/locations/${fakeId}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(res.statusCode).toBe(404);
    });

    it('returns 404 when location is already soft-deleted', async () => {
      const loc = await insertTestLocation(app);

      const first = await app.inject({
        method: 'DELETE',
        url: `/v1/locations/${loc._id}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(first.statusCode).toBe(204);

      const second = await app.inject({
        method: 'DELETE',
        url: `/v1/locations/${loc._id}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(second.statusCode).toBe(404);
    });

    it('returns 400 for malformed _id (not 24-hex)', async () => {
      const res = await app.inject({
        method: 'DELETE',
        url: '/v1/locations/not-a-valid-id',
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(res.statusCode).toBe(400);
    });
  });

  // -------------------------------------------------------------------------
  // Tree integrity — refuse if has children
  // -------------------------------------------------------------------------

  describe('child orphan protection', () => {
    it('returns 400 when deleting a location with one direct child', async () => {
      const parent = await insertTestLocation(app, { slug: 'parent-with-child-loc' });
      await insertTestLocation(app, { slug: 'a-child-loc', parentId: parent._id });

      const res = await app.inject({
        method: 'DELETE',
        url: `/v1/locations/${parent._id}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(res.statusCode).toBe(400);
      const body = res.json<{ message: string }>();
      expect(body.message).toMatch(/cannot delete/i);
      expect(body.message).toMatch(/child location/i);
    });

    it('returns 400 with the correct count when there are multiple children', async () => {
      const parent = await insertTestLocation(app, { slug: 'parent-many-loc' });
      await insertTestLocation(app, { slug: 'child-one-loc', parentId: parent._id });
      await insertTestLocation(app, { slug: 'child-two-loc', parentId: parent._id });
      await insertTestLocation(app, { slug: 'child-three-loc', parentId: parent._id });

      const res = await app.inject({
        method: 'DELETE',
        url: `/v1/locations/${parent._id}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(res.statusCode).toBe(400);
      expect(res.json<{ message: string }>().message).toContain('3');
    });

    it('allows deletion of a location whose only child was already soft-deleted', async () => {
      const parent = await insertTestLocation(app, { slug: 'parent-deleted-child-loc' });
      const child = await insertTestLocation(app, {
        slug: 'soft-deleted-child-loc',
        parentId: parent._id,
      });

      const { ObjectId } = await import('mongodb');
      await app.mongo.db
        .collection('locations')
        .updateOne(
          { _id: new ObjectId(child._id) },
          { $set: { deletedAt: new Date().toISOString(), deletedBy: adminId } },
        );

      const res = await app.inject({
        method: 'DELETE',
        url: `/v1/locations/${parent._id}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(res.statusCode).toBe(204);
    });
  });
});
