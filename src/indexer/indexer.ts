import type { rpc } from '@stellar/stellar-sdk';
import type { FastifyBaseLogger } from 'fastify';

import type { Db } from '../db/pool.js';
import type { ContractReader } from '../stellar/contract.js';
import { decodeEvent, type AidlineEvent } from '../stellar/events.js';
import { recordEvent, upsertCampaign } from './store.js';

const PAGE_SIZE = 100;

/** The slice of the RPC server the indexer needs. Kept small so tests can fake it. */
export interface EventSource {
  getEvents(req: rpc.Api.GetEventsRequest): Promise<rpc.Api.GetEventsResponse>;
  getHealth(): Promise<{ oldestLedger: number; latestLedger: number }>;
}

export interface IndexerOptions {
  db: Db;
  source: EventSource;
  contract: ContractReader;
  contractId: string;
  startLedger?: number;
  pollMs: number;
  log: FastifyBaseLogger;
}

/**
 * Polls Soroban RPC for Aidline contract events and mirrors them into Postgres.
 * Each page is applied in a single transaction together with the new cursor,
 * so a crash can never skip or double count events.
 */
export class Indexer {
  private timer: NodeJS.Timeout | null = null;
  private stopped = true;

  constructor(private readonly opts: IndexerOptions) {}

  start(): void {
    this.stopped = false;
    void this.loop();
  }

  stop(): void {
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
  }

  private async loop(): Promise<void> {
    if (this.stopped) return;
    let delay = this.opts.pollMs;
    try {
      const count = await this.syncOnce();
      // Keep draining without waiting while there is a backlog.
      if (count === PAGE_SIZE) delay = 0;
    } catch (err) {
      this.opts.log.error({ err }, 'indexer sync failed');
    }
    if (!this.stopped) this.timer = setTimeout(() => void this.loop(), delay);
  }

  /** Fetches and applies one page of events. Returns how many events were seen. */
  async syncOnce(): Promise<number> {
    const { db, source, contractId } = this.opts;
    const state = await db.query<{ cursor: string | null }>(
      'SELECT cursor FROM indexer_state WHERE id = 1',
    );
    const cursor = state.rows[0]?.cursor;
    const filters: rpc.Api.EventFilter[] = [{ type: 'contract', contractIds: [contractId] }];

    const res = cursor
      ? await source.getEvents({ cursor, filters, limit: PAGE_SIZE })
      : await source.getEvents({
          startLedger: await this.startLedger(),
          filters,
          limit: PAGE_SIZE,
        });

    const events = res.events.map(decodeEvent).filter((e): e is AidlineEvent => e !== null);
    const campaigns = await this.fetchCampaigns(events);

    const client = await db.connect();
    try {
      await client.query('BEGIN');
      for (const ev of events) {
        if ('campaignId' in ev) {
          const campaign = campaigns.get(ev.campaignId);
          if (campaign) await upsertCampaign(client, campaign, ev);
        }
        await recordEvent(client, ev);
      }
      await client.query(
        `INSERT INTO indexer_state (id, cursor, last_ledger) VALUES (1, $1, $2)
         ON CONFLICT (id) DO UPDATE SET cursor = EXCLUDED.cursor, last_ledger = EXCLUDED.last_ledger`,
        [res.cursor, res.latestLedger],
      );
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    if (events.length) this.opts.log.info({ count: events.length }, 'indexed events');
    return res.events.length;
  }

  /**
   * Reads the latest state of every campaign touched by this page. The
   * contract is the source of truth, so totals are copied rather than summed.
   */
  private async fetchCampaigns(events: AidlineEvent[]) {
    const ids = new Set<bigint>();
    for (const ev of events) if ('campaignId' in ev) ids.add(ev.campaignId);
    const entries = await Promise.all(
      [...ids].map(async (id) => [id, await this.opts.contract.getCampaign(id)] as const),
    );
    return new Map(entries);
  }

  private async startLedger(): Promise<number> {
    const { oldestLedger, latestLedger } = await this.opts.source.getHealth();
    const wanted = this.opts.startLedger ?? latestLedger - 1000;
    // RPC only keeps recent history. Starting before that is an error.
    return Math.max(wanted, oldestLedger);
  }
}
