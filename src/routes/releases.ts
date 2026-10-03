import type { FastifyInstance } from 'fastify';

import { pagination } from '../lib/http.js';

/** Recent milestone payouts across all campaigns, newest first, with their evidence. */
export async function releaseRoutes(app: FastifyInstance) {
  app.get('/releases', async (req) => {
    const q = pagination.parse(req.query);
    const { rows } = await app.db.query(
      `SELECT r.campaign_id AS "campaignId", r.index, r.amount, r.tx_hash AS "txHash",
              r.created_at AS "releasedAt", r.proof_uri AS "proofUri",
              c.kind, c.verifier, v.org_name AS "verifierName",
              m.title AS "campaignTitle", m.location, m.organizer,
              CASE WHEN p.id IS NULL THEN NULL ELSE json_build_object(
                'id', p.id, 'note', p.note, 'files', p.files) END AS proof
       FROM milestone_releases r
       JOIN campaigns c ON c.id = r.campaign_id
       LEFT JOIN campaign_metadata m ON m.id = c.metadata_id
       LEFT JOIN verifiers v ON v.address = c.verifier
       LEFT JOIN proofs p ON p.id = r.proof_id
       ORDER BY r.created_at DESC
       LIMIT $1 OFFSET $2`,
      [q.limit, q.offset],
    );
    return { items: rows };
  });
}
