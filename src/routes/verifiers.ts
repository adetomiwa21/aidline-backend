import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { stellarAddress } from '../lib/http.js';

const application = z.object({
  address: stellarAddress,
  orgName: z.string().trim().min(2).max(120),
  website: z.url().optional(),
  country: z.string().trim().min(2).max(60),
  description: z.string().trim().min(20).max(2000),
});

/**
 * Verifier profiles live here, but whether a verifier is active is decided
 * on chain by the admin. The indexer keeps `active` in sync.
 */
export async function verifierRoutes(app: FastifyInstance) {
  app.get('/verifiers', async () => {
    const { rows } = await app.db.query(
      `SELECT address, org_name AS "orgName", website, country, description
       FROM verifiers WHERE active ORDER BY org_name NULLS LAST, address`,
    );
    return { items: rows };
  });

  app.get('/verifiers/:address', async (req) => {
    const { address } = z.object({ address: stellarAddress }).parse(req.params);
    const { rows } = await app.db.query(
      `SELECT address, active, org_name AS "orgName", website, country, description,
              applied_at AS "appliedAt"
       FROM verifiers WHERE address = $1`,
      [address],
    );
    return rows[0] ?? { address, active: false, orgName: null };
  });

  app.post('/verifiers/applications', async (req, reply) => {
    const a = application.parse(req.body);
    await app.db.query(
      `INSERT INTO verifiers (address, org_name, website, country, description, applied_at)
       VALUES ($1, $2, $3, $4, $5, now())
       ON CONFLICT (address) DO UPDATE SET
         org_name = EXCLUDED.org_name, website = EXCLUDED.website, country = EXCLUDED.country,
         description = EXCLUDED.description, applied_at = now(), updated_at = now()`,
      [a.address, a.orgName, a.website ?? null, a.country, a.description],
    );
    return reply.code(201).send({ address: a.address, status: 'pending_review' });
  });
}
