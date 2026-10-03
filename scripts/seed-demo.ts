// Seeds a testnet deployment with clearly labelled demo campaigns.
//
// Usage:
//   SEED_ADMIN_SECRET=S... npm run seed:demo
//
// SEED_ADMIN_SECRET must be the contract admin. Everything else (verifiers,
// creators, donors) is generated and funded with Friendbot. Generated keys are
// written to .seed-accounts.json (gitignored) so you can import a verifier or
// donor into Freighter and try the app with them.
//
// All organisations below are fictional and every campaign says so.

import { writeFile } from 'node:fs/promises';

import {
  Address,
  BASE_FEE,
  Contract,
  Keypair,
  nativeToScVal,
  rpc,
  scValToNative,
  TransactionBuilder,
  xdr,
} from '@stellar/stellar-sdk';

import { loadConfig } from '../src/config.js';

const config = loadConfig();
const API = process.env.SEED_API_URL ?? config.PUBLIC_BASE_URL;
const server = new rpc.Server(config.AIDLINE_RPC_URL);
const contract = new Contract(config.AIDLINE_CONTRACT_ID);
const XLM = 10_000_000n;
const DAY = 86_400;

const DEMO_NOTE =
  'This is a demonstration campaign on Stellar testnet. The organisations named here are fictional and no real funds are involved.';

const adminSecret = process.env.SEED_ADMIN_SECRET;
if (!adminSecret) throw new Error('Set SEED_ADMIN_SECRET to the contract admin secret key');
if (!config.AIDLINE_CONTRACT_ID) throw new Error('Set AIDLINE_CONTRACT_ID');
const admin = Keypair.fromSecret(adminSecret);

// Chain helpers

async function fund(kp: Keypair) {
  const res = await fetch(`https://friendbot.stellar.org?addr=${kp.publicKey()}`);
  if (!res.ok && res.status !== 400) throw new Error(`friendbot failed for ${kp.publicKey()}`);
}

async function invoke(signer: Keypair, method: string, ...args: xdr.ScVal[]): Promise<unknown> {
  const account = await server.getAccount(signer.publicKey());
  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: config.networkPassphrase,
  })
    .addOperation(contract.call(method, ...args))
    .setTimeout(120)
    .build();
  const prepared = await server.prepareTransaction(tx);
  prepared.sign(signer);
  const sent = await server.sendTransaction(prepared);
  if (sent.status === 'ERROR') throw new Error(`${method} rejected`);
  for (let i = 0; i < 40; i++) {
    const res = await server.getTransaction(sent.hash).catch(() => null);
    if (res && res.status === rpc.Api.GetTransactionStatus.SUCCESS) {
      return res.returnValue ? scValToNative(res.returnValue) : undefined;
    }
    if (res && res.status === rpc.Api.GetTransactionStatus.FAILED)
      throw new Error(`${method} failed`);
    await new Promise((r) => setTimeout(r, 1500));
  }
  throw new Error(`${method} not confirmed`);
}

const addr = (kp: Keypair) => new Address(kp.publicKey()).toScVal();
const u64 = (n: bigint | number) => nativeToScVal(BigInt(n), { type: 'u64' });
const i128 = (n: bigint) => nativeToScVal(n, { type: 'i128' });
const str = (s: string) => nativeToScVal(s, { type: 'string' });
const kind = (k: 'Emergency' | 'Climate') => xdr.ScVal.scvVec([xdr.ScVal.scvSymbol(k)]);

// API helpers

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`POST ${path} failed: ${res.status} ${await res.text()}`);
  return (await res.json()) as T;
}

async function proof(campaignId: bigint, milestoneIndex: number, note: string): Promise<string> {
  const form = new FormData();
  form.set('campaignId', campaignId.toString());
  form.set('milestoneIndex', String(milestoneIndex));
  form.set('note', note);
  const res = await fetch(`${API}/proofs`, { method: 'POST', body: form });
  if (!res.ok) throw new Error(`proof upload failed: ${await res.text()}`);
  return ((await res.json()) as { uri: string }).uri;
}

// Demo content

const verifierProfiles = [
  {
    orgName: 'Delta Field Monitors (demo)',
    country: 'Nigeria',
    description:
      'Fictional verifier for this demo. Represents a local monitoring group that visits sites, photographs deliveries and checks receipts against budgets.',
  },
  {
    orgName: 'East Africa Impact Audit (demo)',
    country: 'Kenya',
    description:
      'Fictional verifier for this demo. Represents an independent auditor that confirms installations and interviews the communities served.',
  },
  {
    orgName: 'Coastal Response Verification (demo)',
    country: 'Mozambique',
    description:
      'Fictional verifier for this demo. Represents a disaster response network that confirms repairs and distributions after storms.',
  },
];

interface DemoCampaign {
  kind: 'Emergency' | 'Climate';
  verifier: number;
  title: string;
  summary: string;
  location: string;
  story: string[];
  milestones: number[];
  days: number;
  donations: number[];
  releases: string[];
  cancel?: { refundDonors: number };
}

const campaigns: DemoCampaign[] = [
  {
    kind: 'Emergency',
    verifier: 0,
    title: 'Clean water for flood displaced families in Lokoja',
    summary:
      'Water tanks, purification tablets and hygiene kits for families sheltering in camps after river flooding.',
    location: 'Lokoja, Nigeria',
    story: [
      'Seasonal flooding where the Niger and Benue rivers meet regularly forces families from riverside homes into temporary camps, where safe drinking water runs out first.',
      'This campaign funds water storage tanks for three camps, purification tablets for six weeks, and hygiene kits for the most crowded sites. Each milestone is a delivery the verifier can photograph and count.',
    ],
    milestones: [400, 600, 500],
    days: 21,
    donations: [500, 350, 250],
    releases: [
      'Forty 1,000 litre water tanks delivered and installed across three camps. Delivery notes and site photos checked against the supplier invoice.',
    ],
  },
  {
    kind: 'Climate',
    verifier: 0,
    title: 'Mangrove restoration along the Niger Delta coast',
    summary:
      'Community nurseries and replanting of degraded mangrove along tidal creeks, with survival checks at six months.',
    location: 'Bonny, Nigeria',
    story: [
      'Mangroves protect coastal villages from storm surge and hold far more carbon per hectare than most forests. Many creeks here have lost theirs.',
      'Funds pay local planters and nursery keepers in stages: nursery setup, first planting, and a survival count six months later. Payment for the last stage depends on how many seedlings survive.',
    ],
    milestones: [800, 800, 1200],
    days: 60,
    donations: [700, 300, 400],
    releases: [
      'Two community nurseries built and stocked with 12,000 propagules. Nursery keepers contracted and paid for the first month.',
    ],
  },
  {
    kind: 'Climate',
    verifier: 1,
    title: 'Solar water pumps for smallholder farms in Turkana',
    summary: 'Replacing diesel pumps with solar irrigation for four farming cooperatives.',
    location: 'Turkana, Kenya',
    story: [
      'Farmers here depend on diesel pumps that are expensive to run and break down often. Solar pumps cut running costs to almost nothing and remove a steady source of emissions.',
      'Each milestone is one cooperative pump installed, tested and handed over.',
    ],
    milestones: [500, 500, 500, 500],
    days: 45,
    donations: [800, 600, 600],
    releases: [
      'Pump installed for the first cooperative. Flow test recorded at 18,000 litres per day.',
      'Second pump installed and handed over. Diesel unit decommissioned and recorded.',
      'Third pump installed. Cooperative members trained on panel cleaning and basic maintenance.',
      'Fourth and final pump installed. All four cooperatives visited and confirmed operational.',
    ],
  },
  {
    kind: 'Emergency',
    verifier: 2,
    title: 'Roof repairs after cyclone damage in coastal Sofala',
    summary:
      'Roofing sheets, timber and local labour to make damaged homes weatherproof before the rains.',
    location: 'Beira, Mozambique',
    story: [
      'After a strong cyclone, the most common damage is to roofs. Families who cannot repair them before the rainy season face a second disaster.',
      'The first milestone buys materials in bulk. The second pays local builders per completed roof, confirmed by the verifier house by house.',
    ],
    milestones: [300, 700],
    days: 14,
    donations: [150, 100],
    releases: [],
  },
  {
    kind: 'Climate',
    verifier: 1,
    title: 'Rainwater harvesting for rural schools',
    summary: 'Gutters and storage tanks so schools have water through the dry season.',
    location: 'Marsabit, Kenya',
    story: [
      'Schools here lose pupils every dry season as children are kept home to fetch water. Roof catchment and storage can carry a school through the driest months.',
      'This demo campaign was cancelled by its creator after a government programme covered the same schools, so donors could reclaim their funds.',
    ],
    milestones: [600, 900],
    days: 30,
    donations: [250, 150],
    releases: [],
    cancel: { refundDonors: 1 },
  },
];

// Seeding

const accounts: Record<string, string> = {};
const remember = (label: string, kp: Keypair) => {
  accounts[label] = kp.secret();
  return kp;
};

async function main() {
  console.log(`Seeding contract ${config.AIDLINE_CONTRACT_ID} through ${API}`);

  const verifiers = verifierProfiles.map((_, i) => remember(`verifier-${i + 1}`, Keypair.random()));
  const creators = campaigns.map((_, i) => remember(`creator-${i + 1}`, Keypair.random()));
  const donors = [0, 1, 2].map((i) => remember(`donor-${i + 1}`, Keypair.random()));
  await Promise.all([...verifiers, ...creators, ...donors].map(fund));
  console.log('funded demo accounts');

  for (const [i, v] of verifiers.entries()) {
    await post('/verifiers/applications', { address: v.publicKey(), ...verifierProfiles[i] });
    await invoke(admin, 'add_verifier', addr(v));
  }
  // The deploy script registers the admin as a verifier for quick testing.
  // Remove it so only named demo verifiers appear.
  await invoke(admin, 'remove_verifier', addr(admin));
  console.log('registered demo verifiers');

  const now = Math.floor(Date.now() / 1000);
  for (const [i, c] of campaigns.entries()) {
    const creator = creators[i]!;
    const verifier = verifiers[c.verifier]!;
    const meta = await post<{ uri: string }>('/metadata', {
      title: c.title,
      summary: c.summary,
      location: c.location,
      description: [...c.story, DEMO_NOTE].join('\n\n'),
      category: c.kind === 'Emergency' ? 'emergency' : 'climate',
    });
    const id = (await invoke(
      creator,
      'create_campaign',
      addr(creator),
      addr(creator),
      addr(verifier),
      kind(c.kind),
      str(meta.uri),
      u64(now + c.days * DAY),
      nativeToScVal(c.milestones.map((m) => i128(BigInt(m) * XLM))),
    )) as bigint;

    for (const [d, amount] of c.donations.entries()) {
      await invoke(donors[d]!, 'donate', addr(donors[d]!), u64(id), i128(BigInt(amount) * XLM));
    }
    for (const [m, note] of c.releases.entries()) {
      await invoke(verifier, 'approve_milestone', u64(id), str(await proof(id, m, note)));
    }
    if (c.cancel) {
      await invoke(creator, 'cancel_campaign', addr(creator), u64(id));
      for (let d = 0; d < c.cancel.refundDonors; d++) {
        await invoke(donors[d]!, 'refund', addr(donors[d]!), u64(id));
      }
    }
    console.log(`campaign ${id}: ${c.title}`);
  }

  await writeFile('.seed-accounts.json', JSON.stringify(accounts, null, 2));
  console.log('done. Demo account keys saved to .seed-accounts.json (keep it private).');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
