import type { rpc } from '@stellar/stellar-sdk';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import type { Db } from '../src/db/pool.js';
import { Indexer, type EventSource } from '../src/indexer/indexer.js';
import type { ChainCampaign } from '../src/stellar/contract.js';
import { account, chainCampaign, CONTRACT_ID, events, resetDb, setupApp } from './helpers.js';

const { app, db } = (await setupApp()) as { app: FastifyInstance; db: Db };

class FakeChain implements EventSource {
  pages: rpc.Api.EventResponse[][] = [];
  campaigns = new Map<bigint, ChainCampaign>();
  requests: rpc.Api.GetEventsRequest[] = [];

  async getEvents(req: rpc.Api.GetEventsRequest) {
    this.requests.push(req);
    const events = this.pages.shift() ?? [];
    return { events, cursor: `cursor-${this.requests.length}`, latestLedger: 500 } as never;
  }
  async getHealth() {
    return { oldestLedger: 50, latestLedger: 500 };
  }
  async getCampaign(id: bigint) {
    const c = this.campaigns.get(id);
    if (!c) throw new Error(`no campaign ${id}`);
    return c;
  }
}

function indexerFor(chain: FakeChain) {
  return new Indexer({
    db,
    source: chain,
    contract: chain,
    contractId: CONTRACT_ID,
    startLedger: 10,
    pollMs: 1000,
    log: app.log,
  });
}

describe('Indexer', () => {
  beforeEach(() => resetDb(db));
  afterAll(async () => {
    await app.close();
    await db.end();
  });

  it('mirrors a campaign lifecycle into the database', async () => {
    const chain = new FakeChain();
    const donor = account();
    const campaign = chainCampaign({ raised: 1000n, released: 300n, milestonesReleased: 1 });
    chain.campaigns.set(0n, campaign);
    chain.pages.push([
      events.created(0n, campaign.creator),
      events.donated(0n, donor, 600n),
      events.donated(0n, account(), 400n),
      events.released(0n, 0, 300n, 'ipfs://proof'),
    ]);

    await indexerFor(chain).syncOnce();

    const c = await db.query('SELECT raised, released, milestones_released FROM campaigns');
    expect(c.rows[0]).toEqual({ raised: '1000', released: '300', milestones_released: 1 });
    const d = await db.query('SELECT count(*)::int AS n FROM donations');
    expect(d.rows[0].n).toBe(2);
    const r = await db.query('SELECT index, amount FROM milestone_releases');
    expect(r.rows).toEqual([{ index: 0, amount: '300' }]);
  });

  it('starts from the configured ledger, then follows the cursor', async () => {
    const chain = new FakeChain();
    const indexer = indexerFor(chain);
    await indexer.syncOnce();
    await indexer.syncOnce();

    expect(chain.requests[0]).toMatchObject({ startLedger: 50 });
    expect(chain.requests[1]).toMatchObject({ cursor: 'cursor-1' });
  });

  it('is idempotent when the same events are replayed', async () => {
    const chain = new FakeChain();
    const campaign = chainCampaign();
    chain.campaigns.set(0n, campaign);
    const page = [events.created(0n, campaign.creator), events.donated(0n, account(), 50n)];
    chain.pages.push(page, page);

    const indexer = indexerFor(chain);
    await indexer.syncOnce();
    await indexer.syncOnce();

    const d = await db.query('SELECT count(*)::int AS n FROM donations');
    expect(d.rows[0].n).toBe(1);
  });

  it('tracks verifiers being added and removed', async () => {
    const chain = new FakeChain();
    const v = account();
    chain.pages.push([events.verifier(v, true)], [events.verifier(v, false)]);
    const indexer = indexerFor(chain);

    await indexer.syncOnce();
    expect((await db.query('SELECT active FROM verifiers')).rows[0].active).toBe(true);
    await indexer.syncOnce();
    expect((await db.query('SELECT active FROM verifiers')).rows[0].active).toBe(false);
  });

  it('rolls back the whole page if the chain read fails', async () => {
    const chain = new FakeChain();
    chain.pages.push([events.donated(9n, account(), 5n)]);

    await expect(indexerFor(chain).syncOnce()).rejects.toThrow('no campaign 9');
    const s = await db.query('SELECT cursor FROM indexer_state');
    expect(s.rowCount).toBe(0);
  });
});
