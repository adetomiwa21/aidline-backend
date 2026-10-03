import { rpc } from '@stellar/stellar-sdk';

import { buildApp } from './app.js';
import { loadConfig } from './config.js';
import { migrate } from './db/migrate.js';
import { createPool } from './db/pool.js';
import { Indexer } from './indexer/indexer.js';
import { AidlineContract } from './stellar/contract.js';

const config = loadConfig();
const db = createPool(config.DATABASE_URL);
await migrate(db);

const app = await buildApp(config, db, {
  logger: process.stdout.isTTY ? { transport: { target: 'pino-pretty' } } : true,
});

let indexer: Indexer | null = null;
if (config.INDEXER_ENABLED && config.AIDLINE_CONTRACT_ID) {
  const server = new rpc.Server(config.AIDLINE_RPC_URL, {
    allowHttp: config.AIDLINE_RPC_URL.startsWith('http://'),
  });
  indexer = new Indexer({
    db,
    source: server,
    contract: new AidlineContract(server, config.AIDLINE_CONTRACT_ID, config.networkPassphrase),
    contractId: config.AIDLINE_CONTRACT_ID,
    startLedger: config.INDEXER_START_LEDGER,
    pollMs: config.INDEXER_POLL_MS,
    log: app.log.child({ module: 'indexer' }),
  });
  indexer.start();
} else {
  app.log.warn('indexer disabled: set AIDLINE_CONTRACT_ID to index contract events');
}

const shutdown = async () => {
  indexer?.stop();
  await app.close();
  await db.end();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

await app.listen({ port: config.PORT, host: config.HOST });
