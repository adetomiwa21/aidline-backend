import { Account, contract } from '@stellar/stellar-sdk';
import { describe, expect, it } from 'vitest';

import { parseCampaign } from '../src/stellar/contract.js';

describe('AidlineContract', () => {
  it('uses a valid placeholder account for simulations', () => {
    expect(() => new Account(contract.NULL_ACCOUNT, '0')).not.toThrow();
  });

  it('parses a campaign as returned by scValToNative', () => {
    const c = parseCampaign({
      id: 3n,
      creator: 'GC',
      beneficiary: 'GB',
      verifier: 'GV',
      kind: ['Climate'],
      metadata_uri: 'ipfs://x',
      goal: 500n,
      deadline: 1700000000n,
      milestones: [200n, 300n],
      milestones_released: 1,
      raised: 500n,
      released: 200n,
      status: ['Active'],
    });
    expect(c).toMatchObject({
      id: 3n,
      kind: 'climate',
      status: 'active',
      milestones: [200n, 300n],
    });
  });
});
