/**
 * Test fixtures — helpers for creating users + assets in tests.
 *
 * Two concerns this file solves:
 *
 *   1. Role-scoped test users:
 *      Production user roles are `EMPLOYEE` by default after JIT. Most
 *      CRUD tests need elevated roles (ASSET_MANAGER, ADMIN). The
 *      `provisionUserAs()` helper does JIT then directly bumps the role.
 *
 *   2. Test asset creation:
 *      PATCH/DELETE tests need an existing asset to operate on. Instead
 *      of going through the full POST endpoint (which has its own test
 *      coverage), `insertTestAsset()` writes directly to the collection.
 *      This isolates each test from the asset-creation pipeline.
 *
 * Why direct DB writes for fixtures:
 *   Integration tests for endpoint X should fail when endpoint X is
 *   broken, not when a fixture happens to use endpoint Y. By bypassing
 *   the API for setup, failures point exactly at the SUT.
 */

import { UserRole, AccountType, type User } from '@sfz/shared-types';

import type { SignTestTokenInput } from './test-jwt.js';
import type { FastifyInstance } from 'fastify';
import type { ObjectId, WithId } from 'mongodb';

// ---------------------------------------------------------------------------
// User fixtures
// ---------------------------------------------------------------------------

/**
 * Provision a user via the normal JIT flow, then promote them to the
 * specified role. Returns the resulting user document (with the bumped
 * role applied).
 *
 * Why go through JIT first instead of direct insert?
 *   The auth flow sets fields we shouldn't have to hand-construct in
 *   every test (preferences, audit fields, accountType, entraOid uniqueness
 *   in the schema). Letting the service build them keeps the fixture
 *   minimal AND keeps tests honest about real provisioning behaviour.
 *
 * Concurrency note:
 *   Tests run sequentially under singleFork, so the JIT call here cannot
 *   race against another provisioning attempt for the same oid.
 */
export async function provisionUserAs(
  app: FastifyInstance,
  signToken: (input: SignTestTokenInput) => Promise<string>,
  options: {
    oid: string;
    role: UserRole;
    email?: string;
    firstName?: string;
    lastName?: string;
  },
): Promise<WithId<User>> {
  const token = await signToken({
    oid: options.oid,
    ...(options.email !== undefined && { email: options.email }),
    ...(options.firstName !== undefined && { given_name: options.firstName }),
    ...(options.lastName !== undefined && { family_name: options.lastName }),
  });

  // JIT-provision via GET /v1/me
  const meRes = await app.inject({
    method: 'GET',
    url: '/v1/me',
    headers: { authorization: `Bearer ${token}` },
  });
  if (meRes.statusCode !== 200) {
    throw new Error(`provisionUserAs: JIT failed with ${meRes.statusCode}: ${meRes.body}`);
  }

  // Bump role directly in DB (simulating admin action; there's no
  // role-management endpoint yet — that's slice #3 territory).
  const usersColl = app.mongo.db.collection<User>('users');
  const updateResult = await usersColl.findOneAndUpdate(
    { entraOid: options.oid },
    { $set: { roles: [options.role] } },
    { returnDocument: 'after' },
  );

  if (!updateResult) {
    throw new Error(`provisionUserAs: could not find user after JIT for oid=${options.oid}`);
  }

  return updateResult;
}

/**
 * Variant of `provisionUserAs` that returns the token alongside the user.
 * Useful when a test wants to JIT a user AND then make requests as them.
 */
export async function provisionUserAsAndSignToken(
  app: FastifyInstance,
  signToken: (input: SignTestTokenInput) => Promise<string>,
  options: {
    oid: string;
    role: UserRole;
    email?: string;
  },
): Promise<{ user: WithId<User>; token: string }> {
  const user = await provisionUserAs(app, signToken, options);
  const tokenInput: SignTestTokenInput = { oid: options.oid };
  if (options.email !== undefined) tokenInput.email = options.email;
  const token = await signToken(tokenInput);
  return { user, token };
}

// ---------------------------------------------------------------------------
// Asset fixtures
// ---------------------------------------------------------------------------

export interface InsertTestAssetOptions {
  /**
   * Inventory number. Defaults to a unique value based on the current
   * test timestamp, avoiding collisions across tests.
   */
  inventoryNumber?: string;
  /** Asset display name. Defaults to "Test Asset". */
  name?: string;
  /** Asset status. Defaults to AVAILABLE. */
  status?: 'AVAILABLE' | 'BORROWED' | 'IN_REPAIR' | 'RETIRED' | 'LOST';
  /** Asset condition. Defaults to NEW. */
  condition?: 'NEW' | 'GOOD' | 'FAIR' | 'POOR' | 'BROKEN';
  /** Asset type. Defaults to IT. */
  type?: string;
  /** Category ID (24-hex string). Defaults to a fixed test sentinel. */
  categoryId?: string;
  /** Location ID (24-hex string). Defaults to a fixed test sentinel. */
  locationId?: string;
  /** ID of the user who "created" this asset. Defaults to "test-creator". */
  createdBy?: string;
  /** Override `currentLoanId` (defaults to null = not on loan). */
  currentLoanId?: ObjectId | null;
}

/**
 * Insert an asset directly into the `assets` collection, bypassing the
 * service layer. Returns the inserted document with its assigned `_id`.
 *
 * Use this in test setup for endpoints that operate on an existing
 * asset (GET /:id, PATCH, DELETE). For POST tests, do NOT use this —
 * exercise the POST endpoint directly so its full behaviour is covered.
 */
export async function insertTestAsset(
  app: FastifyInstance,
  options: InsertTestAssetOptions = {},
): Promise<{ _id: string; inventoryNumber: string; name: string }> {
  const now = new Date().toISOString();
  // Unique-ish default inventory number so parallel tests don't clobber.
  // Format mirrors production: PREFIX-YYYY-NNN (but with millis for uniqueness).
  const defaultInventoryNumber =
    options.inventoryNumber ??
    `TEST-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`;

  const doc = {
    inventoryNumber: defaultInventoryNumber,
    serialNumber: null,
    name: options.name ?? 'Test Asset',
    description: null,
    type: options.type ?? 'IT',
    categoryId: options.categoryId ?? '000000000000000000000001',
    condition: options.condition ?? 'NEW',
    locationId: options.locationId ?? '000000000000000000000002',
    manufacturer: null,
    model: null,
    acquiredAt: now,
    acquisitionCost: null,
    warrantyUntil: null,
    specs: {},
    tags: [],
    imageIds: [],
    internalNotes: null,
    isLoanable: true,
    requiresApproval: true,
    status: options.status ?? 'AVAILABLE',
    currentLoanId: options.currentLoanId ?? null,
    createdAt: now,
    updatedAt: now,
    createdBy: options.createdBy ?? 'test-creator',
    updatedBy: options.createdBy ?? 'test-creator',
    deletedAt: null,
    deletedBy: null,
  };

  const insertResult = await app.mongo.db.collection('assets').insertOne(doc);

  return {
    _id: String(insertResult.insertedId),
    inventoryNumber: doc.inventoryNumber,
    name: doc.name,
  };
}

// ---------------------------------------------------------------------------
// Convenience: a minimal valid POST /v1/assets body
// ---------------------------------------------------------------------------

/**
 * Returns a minimal valid request body for `POST /v1/assets`. Tests that
 * need only the happy path use this directly; tests verifying validation
 * errors override one field to introduce the error.
 *
 * Note: this object matches what the API EXPECTS (with `inventoryNumberPrefix`,
 * not `inventoryNumber`). The service generates the full inventory number
 * server-side.
 */
export function validCreateAssetBody(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    inventoryNumberPrefix: 'TEST',
    name: 'Integration test asset',
    type: 'IT',
    categoryId: '000000000000000000000001',
    condition: 'NEW',
    locationId: '000000000000000000000002',
    acquiredAt: new Date().toISOString(),
    isLoanable: true,
    requiresApproval: true,
    ...overrides,
  };
}

// Re-export UserRole so tests can use it without importing shared-types.
export { UserRole, AccountType };
