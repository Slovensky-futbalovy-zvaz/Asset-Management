/**
 * Vitest global setup — runs once before any test file loads.
 *
 * Responsibilities:
 *   1. Generate an ephemeral RS256 keypair for signing test JWTs.
 *   2. Export the public key as `TEST_JWT_PUBLIC_KEY` env var, so the
 *      auth plugin (in src/plugins/auth.ts) knows to accept tokens
 *      signed by this key.
 *   3. Export the private key + the original audience (api://<client-id>)
 *      to a temp file that test files can import.
 *
 * Why a temp file for the private key?
 *   vitest's globalSetup runs in a separate process from test files. We
 *   cannot pass JS objects directly between them — only env vars and
 *   the filesystem. PEM strings in env vars work fine for the public
 *   key (auth plugin reads it from env), but for the private key we
 *   want a structured handoff so tests can pull both the PEM and the
 *   expected audience cleanly.
 *
 * Why .env.local for MONGO_URI?
 *   vitest does NOT auto-load .env.local (unlike `tsx --env-file=...`).
 *   We load it manually here so tests can connect to the same Atlas
 *   cluster the dev app uses.
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { generateTestKeyPair } from './helpers/test-jwt.js';

// ESM equivalent of __dirname
const __dirname = dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// Temp file location for handing the private key to test processes
// ---------------------------------------------------------------------------

/**
 * Path where the test private key + metadata is written. Test files
 * read this in `beforeAll` via `loadTestKeys()` (in test-jwt-loader.ts).
 *
 * Located in the OS temp dir so it doesn't pollute the repo. Cleaned
 * up by teardown (or just left to be overwritten on next run).
 */
export const TEST_KEYS_FILE = join(tmpdir(), 'sfz-test-keys.json');

// ---------------------------------------------------------------------------
// Load .env.local into process.env (vitest doesn't do this automatically)
// ---------------------------------------------------------------------------

function loadEnvLocal(): void {
  // Find .env.local relative to this file (tests/setup.ts → ../.env.local)
  const envPath = join(__dirname, '..', '.env.local');

  if (!existsSync(envPath)) {
    console.warn(
      `⚠️  tests/setup.ts: ${envPath} not found — tests requiring MONGO_URI or Entra env vars will fail.`,
    );
    return;
  }

  const content = readFileSync(envPath, 'utf-8');
  for (const rawLine of content.split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const eq = line.indexOf('=');
    if (eq === -1) continue;

    const key = line.slice(0, eq).trim();
    const value = line.slice(eq + 1).trim();

    // Only set if not already in env (so explicit overrides win).
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

// ---------------------------------------------------------------------------
// Main setup function — vitest calls this exactly once
// ---------------------------------------------------------------------------

export default async function setup(): Promise<void> {
  // -- Load .env.local first so we have MONGO_URI, ENTRA_* etc. ----------
  loadEnvLocal();

  // -- Ensure NODE_ENV is "test" so the auth plugin enables test JWT path
  process.env['NODE_ENV'] = 'test';

  // -- Generate keypair --------------------------------------------------
  const { publicKeyPem, privateKeyPem } = await generateTestKeyPair();

  // -- Export public key via env var so config plugin picks it up --------
  process.env['TEST_JWT_PUBLIC_KEY'] = publicKeyPem;

  // -- Pre-compute the audience tests should use ------------------------
  //
  // Auth plugin accepts tokens whose `aud` is either the raw client ID
  // GUID or `api://<client-id>`. Tests use the raw GUID for simplicity.
  const apiClientId = process.env['ENTRA_API_CLIENT_ID'];
  if (!apiClientId) {
    throw new Error(
      'tests/setup.ts: ENTRA_API_CLIENT_ID is not set after loading .env.local. ' +
        'Cannot determine the audience for test JWTs.',
    );
  }

  // -- Write private key + metadata to temp file for test files ---------
  const payload = {
    privateKeyPem,
    audience: apiClientId,
  };
  writeFileSync(TEST_KEYS_FILE, JSON.stringify(payload), { mode: 0o600 });

  console.log(
    `\n🔑 Test JWT keypair generated. Public key in TEST_JWT_PUBLIC_KEY env. Private key at ${TEST_KEYS_FILE}.\n`,
  );
}
