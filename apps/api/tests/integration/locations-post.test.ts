/**
 * Integration tests for POST /v1/locations.
 *
 * Mirrors `categories-post.test.ts` precisely — locations share the same
 * contract pattern (slug + hierarchy + soft-delete + audit). Where the
 * field set differs (`type` instead of `assetType`, `address`/`coordinates`
 * instead of `icon`/`color`/`approverIds`, no `sortOrder`), the tests
 * adapt.
 *
 * Covers:
 *   - 201 with valid body (root, child, GET round-trip)
 *   - Slug uniqueness (client-supplied collision)
 *   - Parent existence
 *   - Slug auto-generation (derive from name, diacritics, suffix on collision)
 *   - Hierarchy depth limit
 *   - Validation failures (empty name, bad slug, bad type, bad coordinates)
 *   - Audit fields (createdBy/updatedBy = user._id)
 */

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { buildTestApp, cleanTestDatabase } from '../helpers/test-app.js';
import {
  insertTestLocation,
  provisionUserAsAndSignToken,
  UserRole,
  validCreateLocationBody,
} from '../helpers/test-fixtures.js';
import { createTokenSigner } from '../helpers/test-jwt-loader.js';

import type { SignTestTokenInput } from '../helpers/test-jwt.js';
import type { FastifyInstance } from 'fastify';

describe('POST /v1/locations', () => {
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
      oid: 'admin-for-locations-post',
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
    it('creates a root location and returns 201', async () => {
      const body = validCreateLocationBody({
        name: 'Centrála Bratislava',
        slug: 'centrala-bratislava',
        type: 'OFFICE',
      });

      const res = await app.inject({
        method: 'POST',
        url: '/v1/locations',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: body,
      });

      expect(res.statusCode).toBe(201);
      const result = res.json<{
        _id: string;
        name: string;
        slug: string;
        parentId: string | null;
        type: string;
        isActive: boolean;
      }>();

      expect(result._id).toMatch(/^[a-f0-9]{24}$/);
      expect(result.name).toBe('Centrála Bratislava');
      expect(result.slug).toBe('centrala-bratislava');
      expect(result.parentId).toBeNull();
      expect(result.type).toBe('OFFICE');
      expect(result.isActive).toBe(true);
    });

    it('creates a child location referencing an existing parent', async () => {
      const parent = await insertTestLocation(app, { name: 'Hlavný sklad', slug: 'hlavny-sklad' });

      const body = validCreateLocationBody({
        name: 'Polica A1',
        slug: 'polica-a1',
        parentId: parent._id,
        type: 'WAREHOUSE',
      });

      const res = await app.inject({
        method: 'POST',
        url: '/v1/locations',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: body,
      });

      expect(res.statusCode).toBe(201);
      const result = res.json<{ parentId: string }>();
      expect(result.parentId).toBe(parent._id);
    });

    it('persists the location so GET returns it', async () => {
      const create = await app.inject({
        method: 'POST',
        url: '/v1/locations',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: validCreateLocationBody({ name: 'Persisted', slug: 'persisted-loc' }),
      });
      expect(create.statusCode).toBe(201);
      const id = create.json<{ _id: string }>()._id;

      const get = await app.inject({
        method: 'GET',
        url: `/v1/locations/${id}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(get.statusCode).toBe(200);
      const body = get.json<{ name: string; slug: string }>();
      expect(body.name).toBe('Persisted');
      expect(body.slug).toBe('persisted-loc');
    });

    it('accepts an address and coordinates', async () => {
      const body = validCreateLocationBody({
        name: 'Štadión Tehelné pole',
        slug: 'stadion-tehelne-pole',
        type: 'STADIUM',
        address: {
          street: 'Kalinčiakova 1',
          city: 'Bratislava',
          postalCode: '83104',
          country: 'SK',
        },
        coordinates: { lat: 48.16, lng: 17.13 },
      });

      const res = await app.inject({
        method: 'POST',
        url: '/v1/locations',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: body,
      });

      expect(res.statusCode).toBe(201);
      const result = res.json<{
        address: { city: string; country: string };
        coordinates: { lat: number; lng: number };
      }>();
      expect(result.address.city).toBe('Bratislava');
      expect(result.address.country).toBe('SK');
      expect(result.coordinates.lat).toBeCloseTo(48.16);
      expect(result.coordinates.lng).toBeCloseTo(17.13);
    });
  });

  // -------------------------------------------------------------------------
  // Slug uniqueness
  // -------------------------------------------------------------------------

  describe('slug uniqueness', () => {
    it('rejects a duplicate slug with 400', async () => {
      await insertTestLocation(app, { slug: 'duplicate-slug' });

      const res = await app.inject({
        method: 'POST',
        url: '/v1/locations',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: validCreateLocationBody({ slug: 'duplicate-slug', name: 'Second one' }),
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
    it('rejects parentId pointing to a non-existent location with 400', async () => {
      const fakeParentId = '0123456789abcdef01234567';

      const res = await app.inject({
        method: 'POST',
        url: '/v1/locations',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: validCreateLocationBody({ parentId: fakeParentId }),
      });

      expect(res.statusCode).toBe(400);
      const body = res.json<{ message: string }>();
      expect(body.message).toMatch(/parent.*does not exist/i);
    });

    it('rejects parentId pointing to a soft-deleted location with 400', async () => {
      const parent = await insertTestLocation(app, { slug: 'about-to-delete-loc' });

      const { ObjectId } = await import('mongodb');
      await app.mongo.db
        .collection('locations')
        .updateOne(
          { _id: new ObjectId(parent._id) },
          { $set: { deletedAt: new Date().toISOString(), deletedBy: 'test' } },
        );

      const res = await app.inject({
        method: 'POST',
        url: '/v1/locations',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: validCreateLocationBody({ parentId: parent._id }),
      });

      expect(res.statusCode).toBe(400);
    });
  });

  // -------------------------------------------------------------------------
  // Slug auto-generation
  // -------------------------------------------------------------------------

  describe('slug auto-generation', () => {
    it('derives slug from name when slug is omitted from the body', async () => {
      const body = validCreateLocationBody({ name: 'Centrála Bratislava' });
      delete body['slug'];

      const res = await app.inject({
        method: 'POST',
        url: '/v1/locations',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: body,
      });

      expect(res.statusCode).toBe(201);
      expect(res.json<{ slug: string }>().slug).toBe('centrala-bratislava');
    });

    it('appends -2 suffix when the derived slug already exists', async () => {
      await insertTestLocation(app, { name: 'Sklad', slug: 'sklad' });

      const body = validCreateLocationBody({ name: 'Sklad' });
      delete body['slug'];

      const res = await app.inject({
        method: 'POST',
        url: '/v1/locations',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: body,
      });

      expect(res.statusCode).toBe(201);
      expect(res.json<{ slug: string }>().slug).toBe('sklad-2');
    });

    it('returns 400 if name slugifies to an empty string', async () => {
      const body = validCreateLocationBody({ name: '!@#$%' });
      delete body['slug'];

      const res = await app.inject({
        method: 'POST',
        url: '/v1/locations',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: body,
      });

      expect(res.statusCode).toBe(400);
      expect(res.json<{ message: string }>().message).toMatch(/cannot derive a slug/i);
    });
  });

  // -------------------------------------------------------------------------
  // Hierarchy depth (K4)
  // -------------------------------------------------------------------------

  describe('hierarchy depth', () => {
    it('allows creating at the maximum legal depth (root + 4 nested)', async () => {
      const root = await insertTestLocation(app, { slug: 'cr-root-loc' });
      const d1 = await insertTestLocation(app, { slug: 'cr-d1-loc', parentId: root._id });
      const d2 = await insertTestLocation(app, { slug: 'cr-d2-loc', parentId: d1._id });
      const d3 = await insertTestLocation(app, { slug: 'cr-d3-loc', parentId: d2._id });

      const res = await app.inject({
        method: 'POST',
        url: '/v1/locations',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: validCreateLocationBody({
          name: 'Deep leaf',
          slug: 'cr-leaf-loc',
          parentId: d3._id,
        }),
      });

      expect(res.statusCode).toBe(201);
      expect(res.json<{ parentId: string }>().parentId).toBe(d3._id);
    });

    it('rejects creating one level past the maximum depth', async () => {
      const root = await insertTestLocation(app, { slug: 'crover-root-loc' });
      const d1 = await insertTestLocation(app, { slug: 'crover-d1-loc', parentId: root._id });
      const d2 = await insertTestLocation(app, { slug: 'crover-d2-loc', parentId: d1._id });
      const d3 = await insertTestLocation(app, { slug: 'crover-d3-loc', parentId: d2._id });
      const d4 = await insertTestLocation(app, { slug: 'crover-d4-loc', parentId: d3._id });

      const res = await app.inject({
        method: 'POST',
        url: '/v1/locations',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: validCreateLocationBody({
          name: 'Too deep',
          slug: 'crover-toodeep-loc',
          parentId: d4._id,
        }),
      });

      expect(res.statusCode).toBe(400);
      expect(res.json<{ message: string }>().message).toMatch(/depth/i);
    });
  });

  // -------------------------------------------------------------------------
  // Validation failures
  // -------------------------------------------------------------------------

  describe('validation failures', () => {
    it('rejects empty name with 400', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/v1/locations',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: validCreateLocationBody({ name: '' }),
      });
      expect(res.statusCode).toBe(400);
    });

    it('rejects slug with uppercase letters', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/v1/locations',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: validCreateLocationBody({ slug: 'UPPERCASE-Slug' }),
      });
      expect(res.statusCode).toBe(400);
    });

    it('rejects unknown type value', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/v1/locations',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: validCreateLocationBody({ type: 'NOT_A_REAL_TYPE' }),
      });
      expect(res.statusCode).toBe(400);
    });

    it('rejects coordinates with out-of-range latitude', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/v1/locations',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: validCreateLocationBody({
          coordinates: { lat: 150, lng: 0 }, // lat > 90
        }),
      });
      expect(res.statusCode).toBe(400);
    });

    it('rejects address with wrong-length country code', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/v1/locations',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: validCreateLocationBody({
          address: { country: 'SVK' }, // must be ISO 3166-1 alpha-2 (length 2)
        }),
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
      const adminUser = await usersColl.findOne({ entraOid: 'admin-for-locations-post' });
      expect(adminUser).not.toBeNull();
      const adminId = String(adminUser!._id);

      const res = await app.inject({
        method: 'POST',
        url: '/v1/locations',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: validCreateLocationBody(),
      });

      expect(res.statusCode).toBe(201);
      const body = res.json<{ createdBy: string; updatedBy: string }>();
      expect(body.createdBy).toBe(adminId);
      expect(body.updatedBy).toBe(adminId);
    });

    it('sets createdAt and updatedAt to equal ISO timestamps on insert', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/v1/locations',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: validCreateLocationBody(),
      });

      expect(res.statusCode).toBe(201);
      const body = res.json<{ createdAt: string; updatedAt: string }>();
      expect(body.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
      expect(body.updatedAt).toBe(body.createdAt);
    });
  });
});
