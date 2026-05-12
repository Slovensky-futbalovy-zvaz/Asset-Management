/**
 * Config plugin — validates environment variables at startup using Zod.
 *
 * Why: catching a missing/malformed env var at boot is much better than
 * crashing mid-request in production. If validation fails, the server
 * refuses to start and prints a clear error.
 *
 * Usage:
 *   const config = fastify.config; // typed access to all env vars
 *   const mongoUri = config.MONGO_URI;
 */

import fp from 'fastify-plugin';
import { z } from 'zod';

import type { FastifyPluginAsync } from 'fastify';

// ---------------------------------------------------------------------------
// Schema definition
// ---------------------------------------------------------------------------

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal', 'silent']).default('info'),

  // MongoDB
  MONGO_URI: z
    .string()
    .min(1, 'MONGO_URI is required')
    .refine(
      (val) => val.startsWith('mongodb://') || val.startsWith('mongodb+srv://'),
      'MONGO_URI must start with mongodb:// or mongodb+srv://',
    ),
  MONGO_DB_NAME: z.string().min(1).default('sfz_asset_management'),

  // CORS
  // Accepts either:
  //   - '*' (wildcard, allow all origins) — for early dev only, NEVER in real prod
  //   - comma-separated list of origins: 'https://app.sfz.sk,https://staging.sfz.sk'
  CORS_ORIGINS: z
    .string()
    .default('http://localhost:3001')
    .transform((val) => {
      const trimmed = val.trim();
      if (trimmed === '*') return '*' as const;
      return trimmed
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    }),

  // Feature flags
  ENABLE_SWAGGER: z
    .enum(['true', 'false'])
    .default('true')
    .transform((val) => val === 'true'),

  // Auth (optional in slice #1 — wired up in slice #2)
  ENTRA_TENANT_ID: z.string().optional(),
  ENTRA_CLIENT_ID: z.string().optional(),
  ENTRA_JWKS_URI: z.string().url().optional(),
});

export type AppConfig = z.infer<typeof envSchema>;

// ---------------------------------------------------------------------------
// Fastify decoration — adds `fastify.config` to the instance
// ---------------------------------------------------------------------------

declare module 'fastify' {
  interface FastifyInstance {
    config: AppConfig;
  }
}

// ---------------------------------------------------------------------------
// Plugin
// ---------------------------------------------------------------------------

const configPlugin: FastifyPluginAsync = async (fastify) => {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    console.error('❌ Invalid environment variables:');
    for (const issue of parsed.error.issues) {
      console.error(`  - ${issue.path.join('.')}: ${issue.message}`);
    }
    throw new Error('Environment validation failed. Check .env.local against .env.example.');
  }

  fastify.decorate('config', parsed.data);
  fastify.log.info(
    {
      nodeEnv: parsed.data.NODE_ENV,
      port: parsed.data.PORT,
      mongoDb: parsed.data.MONGO_DB_NAME,
      corsOrigins: parsed.data.CORS_ORIGINS,
      swaggerEnabled: parsed.data.ENABLE_SWAGGER,
    },
    'Configuration loaded',
  );
};

export default fp(configPlugin, {
  name: 'config',
});
