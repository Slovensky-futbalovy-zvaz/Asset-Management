/**
 * Integration tests for audit log creation on asset CRUD operations.
 *
 * Audit logs are written transactionally with asset writes (in slice #2b).
 * This file verifies the contract end-to-end:
 *
 *   1. Each successful CRUD operation creates exactly one audit log
 *      entry with the right action, actor, and target.
 *   2. PATCH includes a diff (`changes` array) of which fields changed.
 *   3. No-op PATCH (same values, no real change) does NOT create an
 *      audit log entry — only the asset's `updatedAt` is bumped.
 *   4. Failed operations create NO audit log (transactional atomicity:
 *      asset and audit log either both succeed or both roll back).
 *
 * Why these tests matter:
 *   The audit log is the system of record for who-did-what. Missing
 *   entries (e.g. due to a service error after the asset write) would
 *   silently corrupt compliance / forensics evidence. Conversely,
 *   orphan entries (audit log written, asset write rolled back) would
 *   show actions that never happened. Either is a serious bug.
 *
 * Setup:
 *   ADMIN user (highest privileges, so RBAC isn't in scope). Fresh DB
 *   before each test so audit log counts are exact.
 */

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { buildTestApp, cleanTestDatabase } from '../helpers/test-app.js';
import {
  insertTestAsset,
  provisionUserAsAndSignToken,
  seedAssetFkRefs,
  UserRole,
  validCreateAssetBody,
} from '../helpers/test-fixtures.js';
import { createTokenSigner } from '../helpers/test-jwt-loader.js';

import type { SignTestTokenInput } from '../helpers/test-jwt.js';
import type { FastifyInstance } from 'fastify';

/**
 * Shape of audit log documents we read back from the DB. Loose-typed
 * because we want to assert on a subset of fields without importing
 * the full AuditLog type (which is wider than what we use here).
 */
interface AuditLogDoc {
  at: string;
  action: string;
  actor: {
    userId: string;
    displayName: string;
    accountType: string;
  };
  target: {
    entityType: string;
    entityId: string;
    snapshot?: Record<string, unknown>;
  };
  description: string;
  changes: Array<{ field: string; before: unknown; after: unknown }> | null;
  severity: string;
}

describe('Audit log on /v1/assets operations', () => {
  let app: FastifyInstance;
  let signToken: (input: SignTestTokenInput) => Promise<string>;
  let adminToken: string;
  let adminId: string;
  let adminDisplayName: string;
  let fkCategoryId: string;
  let fkLocationId: string;

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
      oid: 'admin-for-audit',
      role: UserRole.ADMIN,
    });
    adminToken = token;
    adminId = String(user._id);
    adminDisplayName = user.displayName;
    const fk = await seedAssetFkRefs(app);
    fkCategoryId = fk.categoryId;
    fkLocationId = fk.locationId;
  });

  afterEach(async () => {
    await cleanTestDatabase(app);
  });

  /**
   * Local convenience: build a valid POST body with the per-test FK refs.
   * See assets-post.test.ts for full rationale (slice #3 K7).
   */
  const bodyWithFk = (overrides: Record<string, unknown> = {}) =>
    validCreateAssetBody({
      categoryId: fkCategoryId,
      locationId: fkLocationId,
      ...overrides,
    });

  // -------------------------------------------------------------------------
  // Helper: read audit logs filtered by entityId
  // -------------------------------------------------------------------------

  async function readAuditLogsFor(entityId: string): Promise<AuditLogDoc[]> {
    return app.mongo.db
      .collection<AuditLogDoc>('audit_logs')
      .find({ 'target.entityId': entityId })
      .sort({ at: 1 }) // chronological order
      .toArray();
  }

  // -------------------------------------------------------------------------
  // ASSET_CREATED
  // -------------------------------------------------------------------------

  describe('POST creates ASSET_CREATED audit entry', () => {
    it('records one ASSET_CREATED entry with correct actor and target', async () => {
      const before = Date.now();

      const create = await app.inject({
        method: 'POST',
        url: '/v1/assets',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: bodyWithFk({ name: 'Audited asset', inventoryNumberPrefix: 'AUD' }),
      });
      expect(create.statusCode).toBe(201);
      const assetId = create.json<{ _id: string }>()._id;
      const inventoryNumber = create.json<{ inventoryNumber: string }>().inventoryNumber;

      const logs = await readAuditLogsFor(assetId);
      expect(logs).toHaveLength(1);

      const entry = logs[0]!;
      expect(entry.action).toBe('ASSET_CREATED');
      expect(entry.severity).toBe('INFO');

      // Actor matches the calling user
      expect(entry.actor.userId).toBe(adminId);
      expect(entry.actor.displayName).toBe(adminDisplayName);
      expect(entry.actor.accountType).toBe('ENTRA_ID');

      // Target identifies the new asset
      expect(entry.target.entityType).toBe('Asset');
      expect(entry.target.entityId).toBe(assetId);
      expect(entry.target.snapshot).toMatchObject({
        inventoryNumber,
        name: 'Audited asset',
        status: 'AVAILABLE',
      });

      // Description mentions the inventory number and name
      expect(entry.description).toContain(inventoryNumber);
      expect(entry.description).toContain('Audited asset');

      // No diff on create (changes is null)
      expect(entry.changes).toBeNull();

      // Timestamp is recent
      const atMs = new Date(entry.at).getTime();
      expect(atMs).toBeGreaterThanOrEqual(before);
      expect(atMs).toBeLessThanOrEqual(Date.now());
    });
  });

  // -------------------------------------------------------------------------
  // ASSET_UPDATED
  // -------------------------------------------------------------------------

  describe('PATCH creates ASSET_UPDATED audit entry with diff', () => {
    it('records single-field change in changes array', async () => {
      const asset = await insertTestAsset(app, { name: 'Original name' });

      await app.inject({
        method: 'PATCH',
        url: `/v1/assets/${asset._id}`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { name: 'New name' },
      });

      const logs = await readAuditLogsFor(asset._id);
      expect(logs).toHaveLength(1);

      const entry = logs[0]!;
      expect(entry.action).toBe('ASSET_UPDATED');
      expect(entry.changes).not.toBeNull();
      expect(entry.changes).toHaveLength(1);
      expect(entry.changes![0]).toEqual({
        field: 'name',
        before: 'Original name',
        after: 'New name',
      });
    });

    it('records multiple changes when several fields update', async () => {
      const asset = await insertTestAsset(app, { name: 'A', condition: 'NEW' });

      await app.inject({
        method: 'PATCH',
        url: `/v1/assets/${asset._id}`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { name: 'B', condition: 'GOOD', internalNotes: 'Refurbished' },
      });

      const logs = await readAuditLogsFor(asset._id);
      expect(logs).toHaveLength(1);

      const entry = logs[0]!;
      expect(entry.changes).not.toBeNull();
      expect(entry.changes).toHaveLength(3);

      // Convert to a map for order-independent assertion
      const changeMap = new Map(entry.changes!.map((c) => [c.field, c]));
      expect(changeMap.get('name')).toEqual({ field: 'name', before: 'A', after: 'B' });
      expect(changeMap.get('condition')).toEqual({
        field: 'condition',
        before: 'NEW',
        after: 'GOOD',
      });
      expect(changeMap.get('internalNotes')).toEqual({
        field: 'internalNotes',
        before: null,
        after: 'Refurbished',
      });
    });

    it('does NOT create an audit entry when PATCH is a no-op (same values)', async () => {
      const asset = await insertTestAsset(app, { name: 'Same' });

      await app.inject({
        method: 'PATCH',
        url: `/v1/assets/${asset._id}`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { name: 'Same' }, // same value
      });

      const logs = await readAuditLogsFor(asset._id);
      expect(logs).toHaveLength(0);
    });

    it('does NOT create an audit entry for empty patch body', async () => {
      const asset = await insertTestAsset(app);

      await app.inject({
        method: 'PATCH',
        url: `/v1/assets/${asset._id}`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {},
      });

      const logs = await readAuditLogsFor(asset._id);
      expect(logs).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------------------
  // ASSET_DELETED
  // -------------------------------------------------------------------------

  describe('DELETE creates ASSET_DELETED audit entry with WARNING severity', () => {
    it('records ASSET_DELETED entry with severity WARNING', async () => {
      const asset = await insertTestAsset(app, { name: 'About to be deleted' });

      const del = await app.inject({
        method: 'DELETE',
        url: `/v1/assets/${asset._id}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(del.statusCode).toBe(204);

      const logs = await readAuditLogsFor(asset._id);
      expect(logs).toHaveLength(1);

      const entry = logs[0]!;
      expect(entry.action).toBe('ASSET_DELETED');
      expect(entry.severity).toBe('WARNING'); // deletions get elevated severity
      expect(entry.actor.userId).toBe(adminId);
      expect(entry.target.entityId).toBe(asset._id);
    });
  });

  // -------------------------------------------------------------------------
  // Transactional atomicity — failed ops must NOT write audit logs
  // -------------------------------------------------------------------------

  describe('failed operations write no audit log', () => {
    it('PATCH on non-existent asset creates no audit entry', async () => {
      const fakeId = '0123456789abcdef01234567';

      // Count all audit logs before (should be 0 in fresh DB)
      const beforeCount = await app.mongo.db.collection('audit_logs').countDocuments();
      expect(beforeCount).toBe(0);

      const res = await app.inject({
        method: 'PATCH',
        url: `/v1/assets/${fakeId}`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { name: 'Whatever' },
      });
      expect(res.statusCode).toBe(404);

      const afterCount = await app.mongo.db.collection('audit_logs').countDocuments();
      expect(afterCount).toBe(0);
    });

    it('DELETE on on-loan asset creates no audit entry (transaction rolled back)', async () => {
      const { ObjectId } = await import('mongodb');
      const asset = await insertTestAsset(app, { currentLoanId: new ObjectId() });

      // No audit log expected (the asset insert was done directly, bypassing audit)
      const beforeCount = await readAuditLogsFor(asset._id);
      expect(beforeCount).toHaveLength(0);

      const res = await app.inject({
        method: 'DELETE',
        url: `/v1/assets/${asset._id}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(res.statusCode).toBe(400);

      // Still no audit log — DELETE failed before any write was committed
      const afterCount = await readAuditLogsFor(asset._id);
      expect(afterCount).toHaveLength(0);
    });

    it('DELETE on non-existent asset creates no audit entry', async () => {
      const fakeId = '0123456789abcdef01234567';

      const beforeCount = await app.mongo.db.collection('audit_logs').countDocuments();
      expect(beforeCount).toBe(0);

      const res = await app.inject({
        method: 'DELETE',
        url: `/v1/assets/${fakeId}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(res.statusCode).toBe(404);

      const afterCount = await app.mongo.db.collection('audit_logs').countDocuments();
      expect(afterCount).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // Multi-operation sequence — verifies audit log ordering
  // -------------------------------------------------------------------------

  describe('multiple operations on same asset', () => {
    it('records create + update + delete as three separate entries in order', async () => {
      // CREATE
      const create = await app.inject({
        method: 'POST',
        url: '/v1/assets',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: bodyWithFk({ name: 'Lifecycle test', inventoryNumberPrefix: 'LIFE' }),
      });
      expect(create.statusCode).toBe(201);
      const assetId = create.json<{ _id: string }>()._id;

      // UPDATE
      await app.inject({
        method: 'PATCH',
        url: `/v1/assets/${assetId}`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { name: 'Lifecycle test - updated' },
      });

      // DELETE
      await app.inject({
        method: 'DELETE',
        url: `/v1/assets/${assetId}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });

      const logs = await readAuditLogsFor(assetId);
      expect(logs).toHaveLength(3);

      const actions = logs.map((l) => l.action);
      expect(actions).toEqual(['ASSET_CREATED', 'ASSET_UPDATED', 'ASSET_DELETED']);

      // All three entries point at the same asset
      expect(logs.every((l) => l.target.entityId === assetId)).toBe(true);

      // All three entries have the same actor
      expect(logs.every((l) => l.actor.userId === adminId)).toBe(true);
    });
  });
});
