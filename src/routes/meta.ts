import type { FastifyInstance } from 'fastify';
import { getStatsHistory } from '../indexer/stats.js';

export async function metaRoutes(app: FastifyInstance) {
  app.get('/health', async () => {
    const { rows } = await app.db.query<{ last_ledger: number | null }>(
      'SELECT last_ledger FROM indexer_state WHERE id = 1',
    );
    return { ok: true, indexedLedger: rows[0]?.last_ledger ?? null };
  });

  /** Everything a frontend needs to talk to the right contract. */
  app.get('/config', async () => ({
    network: app.config.AIDLINE_NETWORK,
    networkPassphrase: app.config.networkPassphrase,
    rpcUrl: app.config.AIDLINE_RPC_URL,
    contractId: app.config.AIDLINE_CONTRACT_ID,
    tokenId: app.config.AIDLINE_TOKEN_ID,
  }));

  app.get('/stats', async () => {
    const { rows } = await app.db.query(
      `SELECT
         (SELECT count(*)::int FROM campaigns) AS campaigns,
         (SELECT count(*)::int FROM campaigns WHERE status = 'active' AND deadline >= now())
           AS "activeCampaigns",
         (SELECT COALESCE(sum(amount), 0) FROM donations) AS "totalDonated",
         (SELECT COALESCE(sum(released), 0) FROM campaigns) AS "totalReleased",
         (SELECT COALESCE(sum(amount), 0) FROM refunds) AS "totalRefunded",
         (SELECT count(DISTINCT donor)::int FROM donations) AS donors,
         (SELECT count(*)::int FROM verifiers WHERE active) AS verifiers,
         (SELECT count(*)::int FROM milestone_releases) AS "milestonesVerified"`,
    );
    return rows[0];
  });

  app.get('/stats/history', async () => {
    const history = await getStatsHistory(app.db);
    return { items: history };
  });
}
