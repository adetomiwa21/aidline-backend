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

/** Retries a network call a few times. Testnet RPC and Friendbot drop requests now and then. */
async function retry<T>(fn: () => Promise<T>, attempts = 5): Promise<T> {
  for (let i = 1; ; i++) {
    try {
      return await fn();
    } catch (err) {
      if (i >= attempts) throw err;
      await new Promise((r) => setTimeout(r, 1500 * i));
    }
  }
}

async function fund(kp: Keypair) {
  await retry(async () => {
    const res = await fetch(`https://friendbot.stellar.org?addr=${kp.publicKey()}`);
    if (!res.ok && res.status !== 400) throw new Error(`friendbot failed for ${kp.publicKey()}`);
  });
}

async function invoke(signer: Keypair, method: string, ...args: xdr.ScVal[]): Promise<unknown> {
  const account = await retry(() => server.getAccount(signer.publicKey()));
  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: config.networkPassphrase,
  })
    .addOperation(contract.call(method, ...args))
    .setTimeout(120)
    .build();
  const prepared = await retry(() => server.prepareTransaction(tx));
  prepared.sign(signer);
  const hash = Buffer.from(prepared.hash()).toString('hex');

  // Resending the same signed transaction is safe: it can only land once.
  // A resend after it already landed is rejected, so check by hash before failing.
  const sent = await retry(() => server.sendTransaction(prepared));
  if (sent.status === 'ERROR') {
    const existing = await retry(() => server.getTransaction(hash));
    if (existing.status === rpc.Api.GetTransactionStatus.NOT_FOUND) {
      throw new Error(`${method} rejected`);
    }
  }
  for (let i = 0; i < 40; i++) {
    const res = await server.getTransaction(hash).catch(() => null);
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
  const res = await retry(() =>
    fetch(`${API}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
  );
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
    orgName: 'Caribbean Field Verification (demo)',
    country: 'Haiti',
    description:
      'Fictional verifier for this demo. Represents a local monitoring group in the Caribbean that visits sites, photographs deliveries and checks receipts against budgets.',
  },
  {
    orgName: 'Asia Pacific Impact Audit (demo)',
    country: 'Philippines',
    description:
      'Fictional verifier for this demo. Represents an independent auditor that confirms installations and interviews the communities served.',
  },
  {
    orgName: 'Horn and West Africa Monitors (demo)',
    country: 'Kenya',
    description:
      'Fictional verifier for this demo. Represents a field network that confirms water deliveries, repairs and distributions.',
  },
];

interface DemoCampaign {
  kind: 'Emergency' | 'Climate';
  verifier: number;
  title: string;
  summary: string;
  location: string;
  organizer: string;
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
    title: 'Clean water after flooding in Les Cayes',
    summary:
      'Water storage, purification tablets and hygiene kits for families sheltering in schools after coastal flooding.',
    location: 'Les Cayes, Haiti',
    organizer: 'Haitian community association, Montreal (demo)',
    story: [
      'When heavy rains flood the southern coast, families move into schools and churches where safe drinking water runs out first. Relatives in Montreal are usually the first to send help, but rarely see where it goes.',
      'This campaign funds water tanks for three shelters, purification tablets for six weeks, and hygiene kits for the most crowded sites. Each milestone is a delivery the verifier can photograph and count.',
    ],
    milestones: [400, 600, 500],
    days: 21,
    donations: [500, 350, 250],
    releases: [
      'Forty 1,000 litre water tanks delivered and installed across three shelters. Delivery notes and site photos checked against the supplier invoice.',
    ],
  },
  {
    kind: 'Climate',
    verifier: 1,
    title: 'Mangrove replanting to shield fishing villages in Leyte',
    summary:
      'Community nurseries and replanting along the coast, with survival checks at six months.',
    location: 'Leyte, Philippines',
    organizer: 'Filipino nurses network, London (demo)',
    story: [
      'Mangroves break storm surge before it reaches coastal homes and store far more carbon per hectare than most forests. Many fishing villages here lost theirs.',
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
    title: 'Solar irrigation pumps for farmers in Rangpur',
    summary: 'Replacing diesel pumps with solar irrigation for four farming cooperatives.',
    location: 'Rangpur, Bangladesh',
    organizer: 'Bangladeshi diaspora, Toronto (demo)',
    story: [
      'Farmers here rely on diesel pumps that are expensive to run and break down often. Solar pumps cut running costs to almost nothing and remove a steady source of emissions.',
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
    title: 'Water trucking for pastoralist families in Gedo',
    summary: 'Emergency water deliveries to villages cut off by drought until the rains return.',
    location: 'Gedo, Somalia',
    organizer: 'Somali community, Minneapolis (demo)',
    story: [
      'In a failed rainy season, shallow wells dry up and families walk for days to find water for people and livestock.',
      'This campaign pays for water trucking in two phases. Each phase is confirmed by the verifier with delivery logs signed by village committees.',
    ],
    milestones: [600, 600],
    days: 30,
    donations: [400, 300],
    releases: [
      'First phase complete: 52 truck deliveries to nine villages, logged and countersigned by each village water committee.',
    ],
  },
  {
    kind: 'Emergency',
    verifier: 0,
    title: 'Hurricane roof repairs in St Elizabeth',
    summary: 'Roofing sheets, timber and local labour to make damaged homes weatherproof again.',
    location: 'St Elizabeth, Jamaica',
    organizer: 'Jamaican diaspora, Birmingham (demo)',
    story: [
      'After a hurricane, the most common damage is to roofs. Families who cannot repair them before the next rains face a second disaster.',
      'The first milestone buys materials in bulk. The second pays local builders per completed roof, confirmed house by house.',
    ],
    milestones: [300, 700],
    days: 14,
    donations: [150, 100],
    releases: [],
  },
  {
    kind: 'Climate',
    verifier: 2,
    title: 'Rainwater harvesting for schools in the Upper East',
    summary: 'Gutters and storage tanks so rural schools have water through the dry season.',
    location: 'Bolgatanga, Ghana',
    organizer: 'Ghanaian diaspora, Houston (demo)',
    story: [
      'Schools lose pupils every dry season as children are kept home to fetch water. Roof catchment and storage can carry a school through the driest months.',
      'This demo campaign was cancelled by its organisers after a government programme covered the same schools, so donors could reclaim their funds.',
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
      organizer: c.organizer,
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
