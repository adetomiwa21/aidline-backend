import {
  Account,
  BASE_FEE,
  contract,
  Contract,
  nativeToScVal,
  rpc,
  scValToNative,
  TransactionBuilder,
  type xdr,
} from '@stellar/stellar-sdk';

/** On chain campaign, as returned by the contract's `get_campaign`. */
export interface ChainCampaign {
  id: bigint;
  creator: string;
  beneficiary: string;
  verifier: string;
  kind: 'emergency' | 'climate';
  metadataUri: string;
  goal: bigint;
  deadline: bigint;
  milestones: bigint[];
  milestonesReleased: number;
  raised: bigint;
  released: bigint;
  status: 'active' | 'completed' | 'cancelled';
}

export interface ContractReader {
  getCampaign(id: bigint): Promise<ChainCampaign>;
}

export class AidlineContract implements ContractReader {
  private readonly contract: Contract;

  constructor(
    private readonly server: rpc.Server,
    contractId: string,
    private readonly networkPassphrase: string,
  ) {
    this.contract = new Contract(contractId);
  }

  async getCampaign(id: bigint): Promise<ChainCampaign> {
    const raw = await this.read('get_campaign', nativeToScVal(id, { type: 'u64' }));
    return parseCampaign(raw);
  }

  private async read(method: string, ...args: xdr.ScVal[]): Promise<unknown> {
    // Read only calls are simulated, so the source account never needs to exist.
    const tx = new TransactionBuilder(new Account(contract.NULL_ACCOUNT, '0'), {
      fee: BASE_FEE,
      networkPassphrase: this.networkPassphrase,
    })
      .addOperation(this.contract.call(method, ...args))
      .setTimeout(30)
      .build();

    const sim = await this.server.simulateTransaction(tx);
    if (rpc.Api.isSimulationError(sim)) {
      throw new Error(`${method} failed: ${sim.error}`);
    }
    if (!sim.result) throw new Error(`${method} returned no result`);
    return scValToNative(sim.result.retval);
  }
}

// Unit enum variants decode as a one element array, for example ['Emergency'].
function variant(value: unknown): string {
  const name = Array.isArray(value) ? value[0] : value;
  return String(name).toLowerCase();
}

export function parseCampaign(raw: unknown): ChainCampaign {
  const c = raw as Record<string, unknown>;
  return {
    id: BigInt(c.id as bigint),
    creator: String(c.creator),
    beneficiary: String(c.beneficiary),
    verifier: String(c.verifier),
    kind: variant(c.kind) as ChainCampaign['kind'],
    metadataUri: String(c.metadata_uri),
    goal: BigInt(c.goal as bigint),
    deadline: BigInt(c.deadline as bigint),
    milestones: (c.milestones as bigint[]).map((m) => BigInt(m)),
    milestonesReleased: Number(c.milestones_released),
    raised: BigInt(c.raised as bigint),
    released: BigInt(c.released as bigint),
    status: variant(c.status) as ChainCampaign['status'],
  };
}
