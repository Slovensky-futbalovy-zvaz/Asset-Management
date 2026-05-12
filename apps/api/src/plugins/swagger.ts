/**
 * Swagger / OpenAPI plugin — generates OpenAPI 3.1 spec from Fastify route
 * schemas and exposes interactive Swagger UI at /docs.
 *
 * How it works:
 *   - @fastify/swagger collects route schemas at startup
 *   - fastify-type-provider-zod (registered in server.ts) converts Zod
 *     schemas to JSON Schema as routes are defined
 *   - @fastify/swagger-ui serves the interactive UI
 *
 * In production, set ENABLE_SWAGGER=false to skip this plugin entirely.
 */

import fastifySwagger from '@fastify/swagger';
import fastifySwaggerUi from '@fastify/swagger-ui';
import fp from 'fastify-plugin';
import { jsonSchemaTransform } from 'fastify-type-provider-zod';

import type { FastifyPluginAsync } from 'fastify';

const swaggerPlugin: FastifyPluginAsync = async (fastify) => {
  if (!fastify.config.ENABLE_SWAGGER) {
    fastify.log.info('Swagger UI disabled via ENABLE_SWAGGER=false');
    return;
  }

  await fastify.register(fastifySwagger, {
    openapi: {
      openapi: '3.1.0',
      info: {
        title: 'SFZ Asset Management API',
        description:
          'REST API for managing physical assets, loans, and inventory at Slovenský futbalový zväz (SFZ).',
        version: '0.1.0',
        contact: {
          name: 'SFZ IT Team',
          url: 'https://github.com/Slovensky-futbalovy-zvaz/Asset-Management',
        },
        license: {
          name: 'MIT',
          url: 'https://github.com/Slovensky-futbalovy-zvaz/Asset-Management/blob/main/LICENSE',
        },
      },
      servers: [
        { url: `http://localhost:${fastify.config.PORT}`, description: 'Local dev' },
        // Production server URL will be auto-set by Vercel
      ],
      tags: [
        { name: 'Health', description: 'Liveness and readiness probes' },
        { name: 'Users', description: 'User accounts and current-user lookup' },
        { name: 'Assets', description: 'Physical asset inventory' },
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
            description:
              'Microsoft Entra ID access token (v2.0). Obtain via device code flow ' +
              'using the CLI app registration — see apps/api/README.md.',
          },
        },
      },
    },
    transform: jsonSchemaTransform,
  });

  await fastify.register(fastifySwaggerUi, {
    routePrefix: '/docs',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: true,
      tryItOutEnabled: true,
    },
    staticCSP: true,
  });

  fastify.log.info('Swagger UI available at /docs');
};

export default fp(swaggerPlugin, {
  name: 'swagger',
  dependencies: ['config'],
});
