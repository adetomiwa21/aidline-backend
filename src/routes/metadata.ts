import { randomUUID } from 'node:crypto';

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { notFound } from '../lib/http.js';

const body = z.object({
  title: z.string().trim().min(5).max(120),
  summary: z.string().trim().min(10).max(280),
  description: z.string().trim().min(20).max(10_000),
  location: z.string().trim().min(2).max(120),
  category: z.string().trim().max(60).optional(),
  imageUrl: z.url().optional(),
});

/**
 * Campaign metadata is written here first. The returned URI is then passed
 * to `create_campaign`, which ties the on chain campaign to this record.
 * Records are immutable so the URI on chain always means the same thing.
 */
export async function metadataRoutes(app: FastifyInstance) {
  app.post('/metadata', async (req, reply) => {
    const m = body.parse(req.body);
    const id = randomUUID();
    await app.db.query(
      `INSERT INTO campaign_metadata (id, title, summary, description, location, category, image_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [id, m.title, m.summary, m.description, m.location, m.category ?? null, m.imageUrl ?? null],
    );
    return reply.code(201).send({ id, uri: `${app.config.PUBLIC_BASE_URL}/metadata/${id}` });
  });

  app.get('/metadata/:id', async (req, reply) => {
    const { id } = z.object({ id: z.uuid() }).parse(req.params);
    const { rows } = await app.db.query(
      `SELECT id, title, summary, description, location, category, image_url AS "imageUrl",
              created_at AS "createdAt"
       FROM campaign_metadata WHERE id = $1`,
      [id],
    );
    return rows[0] ?? notFound(reply, 'metadata');
  });
}
