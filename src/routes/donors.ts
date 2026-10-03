import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { pagination, stellarAddress } from '../lib/http.js';

export async function donorRoutes(app: FastifyInstance) {
  app.get('/donors/:address', async (req) => {
    const { address } = z.object({ address: stellarAddress }).parse(req.params);
    const q = pagination.parse(req.query);

    const [summary, donations, refunds] = await Promise.all([
      app.db.query(
        `SELECT COALESCE(sum(amount), 0) AS "totalDonated",
                count(DISTINCT campaign_id)::int AS "campaignsSupported"
         FROM donations WHERE donor = $1`,
        [address],
      ),
      app.db.query(
        `SELECT d.campaign_id AS "campaignId", d.amount, d.tx_hash AS "txHash",
                d.created_at AS "createdAt", m.title AS "campaignTitle", c.kind,
                c.goal, c.released, c.raised
         FROM donations d
         JOIN campaigns c ON c.id = d.campaign_id
         LEFT JOIN campaign_metadata m ON m.id = c.metadata_id
         WHERE d.donor = $1
         ORDER BY d.created_at DESC LIMIT $2 OFFSET $3`,
        [address, q.limit, q.offset],
      ),
      app.db.query(
        `SELECT campaign_id AS "campaignId", amount, tx_hash AS "txHash", created_at AS "createdAt"
         FROM refunds WHERE donor = $1 ORDER BY created_at DESC`,
        [address],
      ),
    ]);

    return {
      address,
      ...summary.rows[0],
      donations: donations.rows,
      refunds: refunds.rows,
    };
  });
}
