/**
 * Vitest configuration for @sfz/api.
 *
 * Test layout:
 *   tests/
 *     setup.ts           — global setup: generate ephemeral JWT keypair,
 *                          set TEST_JWT_PUBLIC_KEY env var before any
 *                          plugin loads
 *     helpers/           — shared utilities (test-app, test-jwt, test-mongo)
 *     unit/              — pure function tests (fast, no DB)
 *     integration/       — full app tests via app.inject() (slow, hits Atlas)
 *
 * Test isolation:
 *   Integration tests run against a SEPARATE database
 *   `sfz_asset_management_test` (set via TEST_MONGO_DB_NAME env var or
 *   via the test-app helper's override). Each test suite drops the
 *   database in `beforeAll` for a tabula-rasa starting state.
 *
 * Why a longer testTimeout:
 *   Atlas Flex round-trips from a developer machine are typically 30-80ms
 *   per operation. A single CRUD test does 4-6 operations (POST + GET +
 *   PATCH + DELETE + audit log inserts), totaling 200-500ms. With the
 *   default 5s timeout, a slow network would cause flaky failures.
 *   10 seconds is comfortable headroom.
 */

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Run setup once for the whole test process (generates keypair, sets env)
    globalSetup: ['./tests/setup.ts'],

    // Where to find test files
    include: ['tests/**/*.test.ts'],

    // Atlas network latency makes 5s default tight; 10s is safer
    testTimeout: 10_000,
    hookTimeout: 30_000, // beforeAll can take longer (DB cleanup, app boot)

    // Reporter — default is fine; verbose only on CI failures
    reporters: 'default',

    // We hit a real database, so parallel test files would race on collections.
    // Use `pool: 'forks'` + `singleFork: true` to serialize file execution.
    // (Tests within a single file still run sequentially by default.)
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },

    // Silence noisy Fastify dev logs during tests (we only want vitest output)
    silent: false, // toggle to true if logs get distracting
  },
});
