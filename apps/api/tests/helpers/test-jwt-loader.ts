/**
 * Test JWT loader — pulls the test private key + audience from the temp
 * file written by `tests/setup.ts`. Tests use this in `beforeAll` to
 * get a `signToken(input)` helper they can call to mint tokens.
 *
 * Why a separate loader file:
 *   `tests/setup.ts` runs in a different vitest worker than test files,
 *   so we cannot share JS objects directly. We pass the keypair info
 *   through a temp file (JSON). This loader hides the file-reading
 *   boilerplate behind a clean API.
 *
 * Usage in a test file:
 *
 *   import { createTokenSigner } from '../helpers/test-jwt-loader.js';
 *
 *   describe('something', () => {
 *     let signToken: Awaited<ReturnType<typeof createTokenSigner>>;
 *
 *     beforeAll(async () => {
 *       signToken = await createTokenSigner();
 *     });
 *
 *     it('lets ADMIN list assets', async () => {
 *       const token = await signToken({ oid: 'admin-user' });
 *       const res = await app.inject({
 *         method: 'GET',
 *         url: '/v1/assets',
 *         headers: { authorization: `Bearer ${token}` },
 *       });
 *       expect(res.statusCode).toBe(200);
 *     });
 *   });
 */

import { readFileSync } from 'node:fs';

import { TEST_KEYS_FILE } from '../setup.js';

import { importTestPrivateKey, signTestToken, type SignTestTokenInput } from './test-jwt.js';

import type { KeyLike } from 'jose';

interface TestKeysPayload {
  privateKeyPem: string;
  audience: string;
}

/**
 * Reads the test keys file and returns a `signToken(input)` function.
 *
 * Called once per test file (in `beforeAll`). The returned function
 * is cheap to call repeatedly — the private key is imported once and
 * reused for all signs.
 */
export async function createTokenSigner(): Promise<(input: SignTestTokenInput) => Promise<string>> {
  const raw = readFileSync(TEST_KEYS_FILE, 'utf-8');
  const payload = JSON.parse(raw) as TestKeysPayload;

  let cachedKey: KeyLike | null = null;

  async function getKey(): Promise<KeyLike> {
    if (cachedKey) return cachedKey;
    cachedKey = await importTestPrivateKey(payload.privateKeyPem);
    return cachedKey;
  }

  return async (input: SignTestTokenInput) => {
    const key = await getKey();
    return signTestToken(key, input, payload.audience);
  };
}
