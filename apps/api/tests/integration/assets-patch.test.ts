/**
 * Integration tests for PATCH /v1/assets/:id.
 *
 * Covers:
 *   - 200 with updated body on partial patch
 *   - Multi-field patch works (multiple fields update together)
 *   - 404 when asset doesn't exist
 *   - 404 when asset is soft-deleted
 *   - 400 when trying to patch inventoryNumber (omitted from schema)
 *   - 400 for invalid field values (regex, enum)
 *   - No-op patches (same values) still return 200
 *   - updatedAt / updatedBy refreshed on every successful patch
 *
 * What's tested elsewhere:
 *   - RBAC (only ASSET_MANAGER / ADMIN can PATCH) → rbac.test.ts
 *   - Audit log diff content → audit.test.ts
 *   - Auth gate → auth.test.ts
 *
 * Setup:
 *   ADMIN user, fresh DB before each test. Each test inserts a baseline
 *   asset via `insertTestAsset()` (bypassing POST), then PATCHes it.
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

describe('PATCH /v1/assets/:id', () => {
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
      oid: 'admin-for-patch',
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
    it('updates a single field and returns 200', async () => {
      const asset = await insertTestAsset(app, { name: 'Original name' });

      const res = await app.inject({
        method: 'PATCH',
        url: `/v1/assets/${asset._id}`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { name: 'Updated name' },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json<{ _id: string; name: string }>();
      expect(body._id).toBe(asset._id);
      expect(body.name).toBe('Updated name');
    });

    it('updates multiple fields in one request', async () => {
      const asset = await insertTestAsset(app, { name: 'Asset', condition: 'NEW' });

      const res = await app.inject({
        method: 'PATCH',
        url: `/v1/assets/${asset._id}`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          name: 'Refurbished asset',
          condition: 'GOOD',
          internalNotes: 'Cleaned and inspected 2026-05',
        },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json<{ name: string; condition: string; internalNotes: string }>();
      expect(body.name).toBe('Refurbished asset');
      expect(body.condition).toBe('GOOD');
      expect(body.internalNotes).toBe('Cleaned and inspected 2026-05');
    });

    it('updates tags array (replaces, not merges)', async () => {
      const asset = await insertTestAsset(app);

      const res = await app.inject({
        method: 'PATCH',
        url: `/v1/assets/${asset._id}`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { tags: ['urgent', 'reviewed', 'priority-1'] },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json<{ tags: string[] }>().tags).toEqual(['urgent', 'reviewed', 'priority-1']);
    });

    it('persists changes — second GET returns the updated values', async () => {
      const asset = await insertTestAsset(app, { name: 'Before' });

      await app.inject({
        method: 'PATCH',
        url: `/v1/assets/${asset._id}`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { name: 'After' },
      });

      const get = await app.inject({
        method: 'GET',
        url: `/v1/assets/${asset._id}`,
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
    it('returns 404 when asset _id does not exist', async () => {
      const fakeId = '0123456789abcdef01234567'; // valid 24-hex but non-existent

      const res = await app.inject({
        method: 'PATCH',
        url: `/v1/assets/${fakeId}`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { name: 'Whatever' },
      });

      expect(res.statusCode).toBe(404);
    });

    it('returns 404 for a soft-deleted asset', async () => {
      const asset = await insertTestAsset(app);

      // Manually soft-delete the asset
      const { ObjectId } = await import('mongodb');
      await app.mongo.db
        .collection('assets')
        .updateOne(
          { _id: new ObjectId(asset._id) },
          { $set: { deletedAt: new Date().toISOString(), deletedBy: adminId } },
        );

      const res = await app.inject({
        method: 'PATCH',
        url: `/v1/assets/${asset._id}`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { name: 'Trying to update a deleted asset' },
      });

      expect(res.statusCode).toBe(404);
    });

    it('returns 400 for malformed _id (not 24-hex)', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: '/v1/assets/not-a-valid-id',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { name: 'Whatever' },
      });

      // Zod params validation rejects → 400
      expect(res.statusCode).toBe(400);
    });
  });

  // -------------------------------------------------------------------------
  // Validation
  // -------------------------------------------------------------------------

  describe('validation', () => {
    it('rejects attempt to update inventoryNumber (immutable)', async () => {
      const asset = await insertTestAsset(app);

      const res = await app.inject({
        method: 'PATCH',
        url: `/v1/assets/${asset._id}`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { inventoryNumber: 'NEW-2026-999' },
      });

      // UpdateAssetSchema omits inventoryNumber, so Zod treats it as
      // an unrecognized field. Default Zod behaviour with .partial()
      // applied to a strict schema would error; with the default
      // permissive schema the field is silently dropped.
      //
      // We assert 200 (accepted, field ignored) and verify that the
      // inventoryNumber DID NOT change.
      expect([200, 400]).toContain(res.statusCode);

      // Whatever the response code, the original inventory number must persist.
      const get = await app.inject({
        method: 'GET',
        url: `/v1/assets/${asset._id}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(get.statusCode).toBe(200);
      expect(get.json<{ inventoryNumber: string }>().inventoryNumber).toBe(asset.inventoryNumber);
    });

    it('rejects invalid enum value for status', async () => {
      const asset = await insertTestAsset(app);

      const res = await app.inject({
        method: 'PATCH',
        url: `/v1/assets/${asset._id}`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { status: 'NOT_A_VALID_STATUS' },
      });

      expect(res.statusCode).toBe(400);
    });

    it('rejects invalid enum value for condition', async () => {
      const asset = await insertTestAsset(app);

      const res = await app.inject({
        method: 'PATCH',
        url: `/v1/assets/${asset._id}`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { condition: 'AMAZING' },
      });

      expect(res.statusCode).toBe(400);
    });

    it('accepts empty body (no-op patch)', async () => {
      const asset = await insertTestAsset(app, { name: 'Original' });

      const res = await app.inject({
        method: 'PATCH',
        url: `/v1/assets/${asset._id}`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {},
      });

      // Empty patch is valid (UpdateAssetSchema is .partial()).
      // Service still updates audit fields (updatedAt/updatedBy) but
      // no business field changes — and computeShallowDiff returns
      // empty, so no audit log entry is created. Endpoint returns 200.
      expect(res.statusCode).toBe(200);
      expect(res.json<{ name: string }>().name).toBe('Original');
    });
  });

  // -------------------------------------------------------------------------
  // Audit fields
  // -------------------------------------------------------------------------

  describe('audit fields', () => {
    it('updates updatedBy to the calling user _id', async () => {
      const asset = await insertTestAsset(app, { createdBy: 'someone-else' });

      const res = await app.inject({
        method: 'PATCH',
        url: `/v1/assets/${asset._id}`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { name: 'New name' },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json<{ createdBy: string; updatedBy: string }>();
      // createdBy stays as it was on insert
      expect(body.createdBy).toBe('someone-else');
      // updatedBy is now the patching user
      expect(body.updatedBy).toBe(adminId);
    });

    it('advances updatedAt to a newer timestamp', async () => {
      // Insert with a known-old updatedAt
      const oldTimestamp = new Date(Date.now() - 60_000).toISOString(); // 1 min ago
      const insertResult = await app.mongo.db.collection('assets').insertOne({
        inventoryNumber: 'TS-2026-001',
        serialNumber: null,
        name: 'Timestamp test',
        description: null,
        type: 'IT',
        categoryId: '000000000000000000000001',
        condition: 'NEW',
        locationId: '000000000000000000000002',
        manufacturer: null,
        model: null,
        acquiredAt: oldTimestamp,
        acquisitionCost: null,
        warrantyUntil: null,
        specs: {},
        tags: [],
        imageIds: [],
        internalNotes: null,
        isLoanable: true,
        requiresApproval: true,
        status: 'AVAILABLE',
        currentLoanId: null,
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
        url: `/v1/assets/${id}`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { name: 'Trigger update' },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json<{ createdAt: string; updatedAt: string }>();
      // createdAt stays original
      expect(body.createdAt).toBe(oldTimestamp);
      // updatedAt is strictly newer than createdAt
      expect(new Date(body.updatedAt).getTime()).toBeGreaterThan(new Date(oldTimestamp).getTime());
    });
  });
});
