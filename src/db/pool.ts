import pg from 'pg';

// Return NUMERIC and BIGINT columns as strings. Token amounts are i128 on
// chain and must never pass through a JS number.
pg.types.setTypeParser(pg.types.builtins.NUMERIC, (v) => v);
pg.types.setTypeParser(pg.types.builtins.INT8, (v) => v);
// NUMERIC[] (oid 1231) parses like TEXT[] (oid 1009) so array items stay strings too.
pg.types.setTypeParser(1231 as never, pg.types.getTypeParser(1009 as never));

export type Db = pg.Pool;

export function createPool(connectionString: string): Db {
  return new pg.Pool({ connectionString, max: 10 });
}
