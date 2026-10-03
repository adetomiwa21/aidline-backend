import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { notFound, pagination } from '../lib/http.js';

const listQuery = pagination.extend({
  kind: z.enum(['emergency', 'climate']).optional(),
  status: z.enum(['active', 'completed', 'cancelled', 'expired']).optional(),
  creator: z.string().optional(),
  verifier: z.string().optional(),
});

// "expired" is not stored: it is an active campaign whose deadline has passed.
const STATUS_SQL = `CASE WHEN c.status = 'active' AND c.deadline < now() THEN 'expired' ELSE c.status END`;

const CAMPAIGN_COLUMNS = `
  c.id, c.kind, ${STATUS_SQL} AS status, c.creator, c.beneficiary, c.verifier,
  c.goal, c.raised, c.released, c.milestones, c.milestones_released AS "milestonesReleased",
  c.deadline, c.metadata_uri AS "metadataUri", c.created_at AS "createdAt",
  (SELECT count(DISTINCT d.donor)::int FROM donations d WHERE d.campaign_id = c.id) AS "donorCount",
  CASE WHEN m.id IS NULL THEN NULL ELSE json_build_object(
    'title', m.title, 'summary', m.summary, 'location', m.location, 'organizer', m.organizer,
    'category', m.category, 'imageUrl', m.image_url
  ) END AS metadata`;

export async function campaignRoutes(app: FastifyInstance) {
  app.get('/campaigns', async (req) => {
    const q = listQuery.parse(req.query);
    const where: string[] = [];
    const params: unknown[] = [];
    const add = (sql: string, value: unknown) => {
      params.push(value);
      where.push(sql.replace('?', `$${params.length}`));
    };
    if (q.kind) add('c.kind = ?', q.kind);
    if (q.status) add(`${STATUS_SQL} = ?`, q.status);
    if (q.creator) add('c.creator = ?', q.creator);
    if (q.verifier) add('c.verifier = ?', q.verifier);
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    params.push(q.limit, q.offset);
    const { rows } = await app.db.query(
      `SELECT ${CAMPAIGN_COLUMNS}, count(*) OVER()::int AS total
       FROM campaigns c LEFT JOIN campaign_metadata m ON m.id = c.metadata_id
       ${whereSql}
       ORDER BY c.created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );
    const total = rows[0]?.total ?? 0;
    return { items: rows.map(({ total: _t, ...r }) => r), total };
  });

  app.get('/campaigns/:id', async (req, reply) => {
    const { id } = z.object({ id: z.coerce.bigint() }).parse(req.params);
    const { rows } = await app.db.query(
      `SELECT ${CAMPAIGN_COLUMNS}, m.description AS "metadataDescription"
       FROM campaigns c LEFT JOIN campaign_metadata m ON m.id = c.metadata_id
       WHERE c.id = $1`,
      [id.toString()],
    );
    const row = rows[0];
    if (!row) return notFound(reply, 'campaign');

    const releases = await app.db.query(
      `SELECT r.index, r.amount, r.proof_uri AS "proofUri", r.tx_hash AS "txHash",
              r.created_at AS "releasedAt",
              CASE WHEN p.id IS NULL THEN NULL ELSE json_build_object(
                'id', p.id, 'note', p.note, 'files', p.files) END AS proof
       FROM milestone_releases r LEFT JOIN proofs p ON p.id = r.proof_id
       WHERE r.campaign_id = $1`,
      [id.toString()],
    );
    const byIndex = new Map(releases.rows.map((r) => [r.index, r]));
    const milestones = (row.milestones as string[]).map((amount, index) => {
      const release = byIndex.get(index);
      return {
        index,
        amount,
        released: Boolean(release),
        releasedAt: release?.releasedAt ?? null,
        txHash: release?.txHash ?? null,
        proofUri: release?.proofUri ?? null,
        proof: release?.proof ?? null,
      };
    });

    const { metadataDescription, ...campaign } = row;
    if (campaign.metadata) campaign.metadata.description = metadataDescription;
    return { ...campaign, milestones };
  });

  app.get('/campaigns/:id/donations', async (req) => {
    const { id } = z.object({ id: z.coerce.bigint() }).parse(req.params);
    const q = pagination.parse(req.query);
    const { rows } = await app.db.query(
      `SELECT donor, amount, tx_hash AS "txHash", created_at AS "createdAt"
       FROM donations WHERE campaign_id = $1
       ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
      [id.toString(), q.limit, q.offset],
    );
    return { items: rows };
  });
}
