// Starts a local Postgres for development without Docker or Homebrew.
// Data lives in .pgdata/ and survives restarts. Stop it with Ctrl+C.
import { existsSync } from 'node:fs';

import EmbeddedPostgres from 'embedded-postgres';

const PORT = 5433;
const dataDir = '.pgdata';
const fresh = !existsSync(dataDir);

const pg = new EmbeddedPostgres({
  databaseDir: dataDir,
  user: 'aidline',
  password: 'aidline',
  port: PORT,
  persistent: true,
});

if (fresh) await pg.initialise();
await pg.start();
if (fresh) await pg.createDatabase('aidline');

console.log(`Postgres ready at postgres://aidline:aidline@localhost:${PORT}/aidline`);

const stop = async () => {
  await pg.stop();
  process.exit(0);
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
