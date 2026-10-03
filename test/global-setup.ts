import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import EmbeddedPostgres from 'embedded-postgres';

export const TEST_DB_PORT = 5434;

// One throwaway Postgres for the whole test run.
export default async function setup() {
  const dir = mkdtempSync(join(tmpdir(), 'aidline-test-pg-'));
  const pg = new EmbeddedPostgres({
    databaseDir: dir,
    user: 'aidline',
    password: 'aidline',
    port: TEST_DB_PORT,
    persistent: false,
    onLog: () => {},
    onError: () => {},
  });
  await pg.initialise();
  await pg.start();
  await pg.createDatabase('aidline_test');

  return async () => {
    await pg.stop();
    rmSync(dir, { recursive: true, force: true });
  };
}
