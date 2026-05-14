/**
 * Integration tests for DELETE /v1/assets/:id.
 *
 * DELETE is a soft-delete: the document stays in the collection but gets
 * `deletedAt` and `deletedBy` fields set, and is excluded from subsequent
 * reads.
 *
 * Covers:
 *   - 204 on successful soft-delete
 *   - 404 when asset doesn't exist
 *   - 404 when asset is already soft-deleted (idempotency boundary)
 *   - 400 when asset is currently on loan (currentLoanId !== null)
 *   - 400 for malformed _id
 *   - GET /:id returns 404 after DELETE (read excludes soft-deleted)
 *   - GET list excludes soft-deleted assets
 *   - deletedBy is set to the calling user _id, deletedAt is set
 *
 * What's tested elsewhere:
 *   - RBAC (only ADMIN can DELETE) → rbac.test.ts
 *   - Audit log entry for ASSET_DELETED → audit.test.ts
 *   - Auth gate → auth.test.ts
 */

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { buildTestApp, cleanTestDatabase } from '../helpers/test-app.js';
import {
  insertTestAsset,
  provisionUserAsAndSignToken,
  UserRole,
} from '../helpers/test-fixtures.js';
import { createTokenSigner } from '../helpers/test-jwt-loader.js';

import type { SignTestTokenInput } from '../helpers/test-jwt.js';
import type { FastifyInstance } from 'fastify';

const isCI = process.env['CI'] === 'true';

describe.skipIf(isCI)('DELETE /v1/assets/:id', () => {
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
      oid: 'admin-for-delete',
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
    it('soft-deletes an asset and returns 204', async () => {
      const asset = await insertTestAsset(app);

      const res = await app.inject({
        method: 'DELETE',
        url: `/v1/assets/${asset._id}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(res.statusCode).toBe(204);
      // 204 means no body. Fastify should return empty.
      expect(res.body).toBe('');
    });

    it('subsequent GET /:id returns 404', async () => {
      const asset = await insertTestAsset(app);

      const del = await app.inject({
        method: 'DELETE',
        url: `/v1/assets/${asset._id}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(del.statusCode).toBe(204);

      const get = await app.inject({
        method: 'GET',
        url: `/v1/assets/${asset._id}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(get.statusCode).toBe(404);
    });

    it('GET list excludes soft-deleted assets', async () => {
      const keep = await insertTestAsset(app, { name: 'Keeper' });
      const remove = await insertTestAsset(app, { name: 'Doomed' });

      // Sanity: both visible before delete
      const before = await app.inject({
        method: 'GET',
        url: '/v1/assets',
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(before.statusCode).toBe(200);
      const beforeBody = before.json<{
        data: Array<{ _id: string; name: string }>;
        pagination: { total: number };
      }>();
      expect(beforeBody.pagination.total).toBe(2);

      // Delete one
      await app.inject({
        method: 'DELETE',
        url: `/v1/assets/${remove._id}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });

      // After: only the keeper remains
      const after = await app.inject({
        method: 'GET',
        url: '/v1/assets',
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(after.statusCode).toBe(200);
      const afterBody = after.json<{
        data: Array<{ _id: string; name: string }>;
        pagination: { total: number };
      }>();
      expect(afterBody.pagination.total).toBe(1);
      expect(afterBody.data[0]?._id).toBe(keep._id);
    });

    it('sets deletedAt and deletedBy on the document', async () => {
      const asset = await insertTestAsset(app);
      const beforeDelete = Date.now();

      const del = await app.inject({
        method: 'DELETE',
        url: `/v1/assets/${asset._id}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(del.statusCode).toBe(204);

      // Read the soft-deleted document directly from the collection
      // (bypassing the route, which filters out deleted docs).
      const { ObjectId } = await import('mongodb');
      const doc = await app.mongo.db
        .collection<{ deletedAt: string | null; deletedBy: string | null }>('assets')
        .findOne({ _id: new ObjectId(asset._id) });

      expect(doc).not.toBeNull();
      expect(doc!.deletedAt).not.toBeNull();
      expect(doc!.deletedBy).toBe(adminId);

      // deletedAt is a fresh ISO timestamp from the delete call
      const deletedAtMs = new Date(doc!.deletedAt!).getTime();
      expect(deletedAtMs).toBeGreaterThanOrEqual(beforeDelete);
      expect(deletedAtMs).toBeLessThanOrEqual(Date.now());
    });
  });

  // -------------------------------------------------------------------------
  // Not found
  // -------------------------------------------------------------------------

  describe('not found', () => {
    it('returns 404 when asset _id does not exist', async () => {
      const fakeId = '0123456789abcdef01234567';

      const res = await app.inject({
        method: 'DELETE',
        url: `/v1/assets/${fakeId}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(res.statusCode).toBe(404);
    });

    it('returns 404 when asset is already soft-deleted', async () => {
      const asset = await insertTestAsset(app);

      // First delete succeeds
      const first = await app.inject({
        method: 'DELETE',
        url: `/v1/assets/${asset._id}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(first.statusCode).toBe(204);

      // Second delete on the same _id: 404 (the asset is gone from
      // the "visible" view, so this is correct from the API caller's
      // perspective).
      const second = await app.inject({
        method: 'DELETE',
        url: `/v1/assets/${asset._id}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(second.statusCode).toBe(404);
    });

    it('returns 400 for malformed _id (not 24-hex)', async () => {
      const res = await app.inject({
        method: 'DELETE',
        url: '/v1/assets/not-a-valid-id',
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(res.statusCode).toBe(400);
    });
  });

  // -------------------------------------------------------------------------
  // Business rule: cannot delete an asset currently on loan
  // -------------------------------------------------------------------------

  describe('business rule: on loan', () => {
    it('returns 400 when asset has currentLoanId set', async () => {
      const { ObjectId } = await import('mongodb');
      const loanId = new ObjectId();
      const asset = await insertTestAsset(app, { currentLoanId: loanId });

      const res = await app.inject({
        method: 'DELETE',
        url: `/v1/assets/${asset._id}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(res.statusCode).toBe(400);
      const body = res.json<{ message: string }>();
      // Error message mentions the inventory number and loan status
      expect(body.message).toMatch(/on loan/i);
    });

    it('does NOT soft-delete an on-loan asset (rollback after 400)', async () => {
      const { ObjectId } = await import('mongodb');
      const loanId = new ObjectId();
      const asset = await insertTestAsset(app, { currentLoanId: loanId });

      // Attempt delete — expect 400
      await app.inject({
        method: 'DELETE',
        url: `/v1/assets/${asset._id}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });

      // Verify the asset is still readable and NOT soft-deleted
      const get = await app.inject({
        method: 'GET',
        url: `/v1/assets/${asset._id}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(get.statusCode).toBe(200);
      const body = get.json<{ deletedAt: string | null }>();
      expect(body.deletedAt).toBeNull();
    });
  });
});
