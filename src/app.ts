import { mkdirSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';

import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import rateLimit from '@fastify/rate-limit';
import fastifyStatic from '@fastify/static';
import Fastify, { type FastifyServerOptions } from 'fastify';
import { ZodError } from 'zod';

import type { Config } from './config.js';
import type { Db } from './db/pool.js';
import { campaignRoutes } from './routes/campaigns.js';
import { donorRoutes } from './routes/donors.js';
import { metaRoutes } from './routes/meta.js';
import { metadataRoutes } from './routes/metadata.js';
import { proofRoutes } from './routes/proofs.js';
import { releaseRoutes } from './routes/releases.js';
import { verifierRoutes } from './routes/verifiers.js';

declare module 'fastify' {
  interface FastifyInstance {
    db: Db;
    config: Config;
  }
}

export async function buildApp(
  config: Config,
  db: Db,
  opts: FastifyServerOptions = { logger: true },
) {
  const app = Fastify(opts);
  app.decorate('db', db);
  app.decorate('config', config);

  await app.register(cors, { origin: config.corsOrigins });
  await app.register(rateLimit, { max: 300, timeWindow: '1 minute' });
  await app.register(multipart, { limits: { fileSize: 5 * 1024 * 1024, files: 5 } });

  const uploadRoot = resolve(config.UPLOAD_DIR);
  mkdirSync(uploadRoot, { recursive: true });
  await app.register(fastifyStatic, { root: uploadRoot, prefix: '/uploads/' });

  app.setErrorHandler((err, _req, reply) => {
    if (err instanceof ZodError) {
      return reply.code(400).send({
        error: 'validation_error',
        message: 'Request is invalid',
        issues: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      });
    }
    const status = (err as { statusCode?: number }).statusCode ?? 500;
    if (status >= 500) app.log.error(err);
    return reply.code(status).send({
      error: status >= 500 ? 'internal_error' : 'request_error',
      message: status >= 500 ? 'Something went wrong' : (err as Error).message,
    });
  });

  // #10 – consistent JSON 404 for unknown routes
  app.setNotFoundHandler((_req, reply) => {
    return reply.code(404).send({ error: 'not_found', message: 'Route not found' });
  });

  // #11 – attach a unique X-Request-Id header to every response
  app.addHook('onSend', (_req, reply, _payload, done) => {
    if (!reply.hasHeader('x-request-id')) {
      reply.header('x-request-id', randomUUID());
    }
    done();
  });

  await app.register(metaRoutes);
  await app.register(campaignRoutes);
  await app.register(metadataRoutes);
  await app.register(proofRoutes);
  await app.register(releaseRoutes);
  await app.register(verifierRoutes);
  await app.register(donorRoutes);

  return app;
}
