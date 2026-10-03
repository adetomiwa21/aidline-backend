import type { PoolClient } from 'pg';

import { metadataIdFromUri, proofIdFromUri } from '../lib/uris.js';
import type { ChainCampaign } from '../stellar/contract.js';
import type { AidlineEvent } from '../stellar/events.js';

export async function upsertCampaign(
  client: PoolClient,
  c: ChainCampaign,
  seenAt: { ledger: number; closedAt: Date },
): Promise<void> {
  const metadataId = metadataIdFromUri(c.metadataUri);
  // Only link metadata we actually have, so a foreign URI never breaks the FK.
  const { rowCount } = metadataId
    ? await client.query('SELECT 1 FROM campaign_metadata WHERE id = $1', [metadataId])
    : { rowCount: 0 };

  await client.query(
    `INSERT INTO campaigns (id, creator, beneficiary, verifier, kind, metadata_uri, metadata_id,
       goal, deadline, milestones, milestones_released, raised, released, status,
       created_ledger, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, to_timestamp($9), $10, $11, $12, $13, $14, $15, $16)
     ON CONFLICT (id) DO UPDATE SET
       verifier = EXCLUDED.verifier,
       metadata_id = COALESCE(campaigns.metadata_id, EXCLUDED.metadata_id),
       milestones_released = EXCLUDED.milestones_released,
       raised = EXCLUDED.raised,
       released = EXCLUDED.released,
       status = EXCLUDED.status,
       updated_at = now()`,
    [
      c.id.toString(),
      c.creator,
      c.beneficiary,
      c.verifier,
      c.kind,
      c.metadataUri,
      rowCount ? metadataId : null,
      c.goal.toString(),
      c.deadline.toString(),
      c.milestones.map((m) => m.toString()),
      c.milestonesReleased,
      c.raised.toString(),
      c.released.toString(),
      c.status,
      seenAt.ledger,
      seenAt.closedAt,
    ],
  );
}

export async function recordEvent(client: PoolClient, ev: AidlineEvent): Promise<void> {
  const common = [ev.eventId, ev.ledger, ev.txHash, ev.closedAt] as const;

  switch (ev.type) {
    case 'campaign_created':
      // The campaign row is written by upsertCampaign. Pin its creation time
      // to this event in case it was first seen through a later event.
      await client.query(
        'UPDATE campaigns SET created_ledger = $2, created_at = $3 WHERE id = $1',
        [ev.campaignId.toString(), ev.ledger, ev.closedAt],
      );
      return;

    case 'donated':
      await client.query(
        `INSERT INTO donations (event_id, ledger, tx_hash, created_at, campaign_id, donor, amount)
         VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT DO NOTHING`,
        [...common, ev.campaignId.toString(), ev.donor, ev.amount.toString()],
      );
      return;

    case 'refunded':
      await client.query(
        `INSERT INTO refunds (event_id, ledger, tx_hash, created_at, campaign_id, donor, amount)
         VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT DO NOTHING`,
        [...common, ev.campaignId.toString(), ev.donor, ev.amount.toString()],
      );
      return;

    case 'milestone_released': {
      const proofId = proofIdFromUri(ev.proofUri);
      const { rowCount } = proofId
        ? await client.query('SELECT 1 FROM proofs WHERE id = $1', [proofId])
        : { rowCount: 0 };
      await client.query(
        `INSERT INTO milestone_releases
           (event_id, ledger, tx_hash, created_at, campaign_id, index, amount, proof_uri, proof_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) ON CONFLICT DO NOTHING`,
        [
          ...common,
          ev.campaignId.toString(),
          ev.index,
          ev.amount.toString(),
          ev.proofUri,
          rowCount ? proofId : null,
        ],
      );
      return;
    }

    case 'campaign_cancelled':
      return;

    case 'verifier_updated':
      await client.query(
        `INSERT INTO verifiers (address, active) VALUES ($1, $2)
         ON CONFLICT (address) DO UPDATE SET active = EXCLUDED.active, updated_at = now()`,
        [ev.verifier, ev.active],
      );
      return;
  }
}
