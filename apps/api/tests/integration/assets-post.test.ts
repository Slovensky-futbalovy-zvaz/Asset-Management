/**
 * Integration tests for POST /v1/assets.
 *
 * Covers:
 *   - 201 Created with auto-generated inventoryNumber on valid body
 *   - Inventory number sequence increments across calls
 *   - Required field validation (400 for missing/malformed body)
 *   - Field constraints (prefix regex, ID format)
 *   - Audit fields populated correctly (createdBy/updatedBy = user._id)
 *
 * What's tested elsewhere:
 *   - RBAC (only ASSET_MANAGER / ADMIN can POST) → rbac.test.ts
 *   - Transactional atomicity (asset + audit_log together) → audit.test.ts
 *   - Auth gate (no token) → auth.test.ts
 *
 * Setup:
 *   Each test starts with a clean DB and an ADMIN user. ADMIN has the
 *   broadest privileges, so authentication is taken out of the picture
 *   and we focus on POST behaviour.
 */

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { buildTestApp, cleanTestDatabase } from '../helpers/test-app.js';
import {
  provisionUserAsAndSignToken,
  UserRole,
  validCreateAssetBody,
} from '../helpers/test-fixtures.js';
import { createTokenSigner } from '../helpers/test-jwt-loader.js';

import type { SignTestTokenInput } from '../helpers/test-jwt.js';
import type { FastifyInstance } from 'fastify';

describe('POST /v1/assets', () => {
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

  // Fresh DB + admin user before each test, so inventory sequence and
  // user state don't leak between tests.
  beforeEach(async () => {
    await cleanTestDatabase(app);
    const { token } = await provisionUserAsAndSignToken(app, signToken, {
      oid: 'admin-for-post',
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
    it('creates an asset with auto-generated inventoryNumber', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/v1/assets',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: validCreateAssetBody({ name: 'My laptop', inventoryNumberPrefix: 'LT' }),
      });

      expect(res.statusCode).toBe(201);

      const body = res.json<{
        _id: string;
        inventoryNumber: string;
        name: string;
        status: string;
        createdBy: string;
      }>();

      // _id is 24-char hex
      expect(body._id).toMatch(/^[a-f0-9]{24}$/);
      // inventoryNumber follows PREFIX-YYYY-NNN pattern
      const year = new Date().getFullYear();
      expect(body.inventoryNumber).toBe(`LT-${year}-001`);
      expect(body.name).toBe('My laptop');
      // Default status applied by service
      expect(body.status).toBe('AVAILABLE');
      // createdBy is the admin's user _id
      expect(body.createdBy).toMatch(/^[a-f0-9]{24}$/);
    });

    it('increments the inventory sequence across successive creates', async () => {
      // First asset → 001
      const first = await app.inject({
        method: 'POST',
        url: '/v1/assets',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: validCreateAssetBody({ inventoryNumberPrefix: 'SEQ' }),
      });
      expect(first.statusCode).toBe(201);
      const year = new Date().getFullYear();
      expect(first.json<{ inventoryNumber: string }>().inventoryNumber).toBe(`SEQ-${year}-001`);

      // Second asset → 002
      const second = await app.inject({
        method: 'POST',
        url: '/v1/assets',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: validCreateAssetBody({ inventoryNumberPrefix: 'SEQ' }),
      });
      expect(second.statusCode).toBe(201);
      expect(second.json<{ inventoryNumber: string }>().inventoryNumber).toBe(`SEQ-${year}-002`);

      // Third asset with DIFFERENT prefix → starts again at 001
      const third = await app.inject({
        method: 'POST',
        url: '/v1/assets',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: validCreateAssetBody({ inventoryNumberPrefix: 'OTHER' }),
      });
      expect(third.statusCode).toBe(201);
      expect(third.json<{ inventoryNumber: string }>().inventoryNumber).toBe(`OTHER-${year}-001`);
    });

    it('persists the asset so GET retrieves it', async () => {
      const create = await app.inject({
        method: 'POST',
        url: '/v1/assets',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: validCreateAssetBody({ name: 'Persisted asset', inventoryNumberPrefix: 'PERS' }),
      });
      expect(create.statusCode).toBe(201);
      const id = create.json<{ _id: string }>()._id;

      const get = await app.inject({
        method: 'GET',
        url: `/v1/assets/${id}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(get.statusCode).toBe(200);
      const body = get.json<{ name: string; inventoryNumber: string }>();
      expect(body.name).toBe('Persisted asset');
      const year = new Date().getFullYear();
      expect(body.inventoryNumber).toBe(`PERS-${year}-001`);
    });
  });

  // -------------------------------------------------------------------------
  // Validation failures (400)
  // -------------------------------------------------------------------------

  describe('validation failures', () => {
    it('rejects missing name with 400', async () => {
      const body = validCreateAssetBody();
      delete body['name'];
      const res = await app.inject({
        method: 'POST',
        url: '/v1/assets',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: body,
      });
      expect(res.statusCode).toBe(400);
    });

    it('rejects empty name with 400 (min length 1)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/v1/assets',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: validCreateAssetBody({ name: '' }),
      });
      expect(res.statusCode).toBe(400);
    });

    it('rejects inventoryNumberPrefix with lowercase letters', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/v1/assets',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: validCreateAssetBody({ inventoryNumberPrefix: 'lt' }),
      });
      expect(res.statusCode).toBe(400);
    });

    it('rejects inventoryNumberPrefix longer than 5 chars', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/v1/assets',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: validCreateAssetBody({ inventoryNumberPrefix: 'LONGPREFIX' }),
      });
      expect(res.statusCode).toBe(400);
    });

    it('rejects malformed categoryId (not 24 hex)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/v1/assets',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: validCreateAssetBody({ categoryId: 'not-a-real-id' }),
      });
      expect(res.statusCode).toBe(400);
    });

    it('rejects missing acquiredAt with 400', async () => {
      const body = validCreateAssetBody();
      delete body['acquiredAt'];
      const res = await app.inject({
        method: 'POST',
        url: '/v1/assets',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: body,
      });
      expect(res.statusCode).toBe(400);
    });
  });

  // -------------------------------------------------------------------------
  // Audit fields
  // -------------------------------------------------------------------------

  describe('audit fields', () => {
    it('sets createdBy and updatedBy to the calling user _id', async () => {
      // Look up the admin user's _id from the DB
      const usersColl = app.mongo.db.collection('users');
      const adminUser = await usersColl.findOne({ entraOid: 'admin-for-post' });
      expect(adminUser).not.toBeNull();
      const adminId = String(adminUser!._id);

      const res = await app.inject({
        method: 'POST',
        url: '/v1/assets',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: validCreateAssetBody(),
      });

      expect(res.statusCode).toBe(201);
      const body = res.json<{ createdBy: string; updatedBy: string }>();
      expect(body.createdBy).toBe(adminId);
      expect(body.updatedBy).toBe(adminId);
    });

    it('sets createdAt and updatedAt to ISO timestamps (equal on create)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/v1/assets',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: validCreateAssetBody(),
      });

      expect(res.statusCode).toBe(201);
      const body = res.json<{ createdAt: string; updatedAt: string }>();

      // ISO 8601 with milliseconds + Z (or offset)
      expect(body.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
      expect(body.updatedAt).toBe(body.createdAt);
    });
  });
});
