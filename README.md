# Aidline Backend

API and Soroban event indexer for **Aidline**, transparent funding for disaster relief and climate action on Stellar.

The [Aidline contract](https://github.com/aidline-org/aidline-contracts) holds donations in escrow and releases them milestone by milestone after a verifier confirms the work. This service makes that on chain activity easy to use:

- **Indexer:** follows contract events on Soroban RPC and mirrors campaigns, donations, milestone releases, refunds and verifiers into Postgres.
- **Metadata:** stores campaign stories (title, description, location, image) and returns a URI that gets written on chain.
- **Proofs:** verifiers upload photos, receipts and reports before approving a milestone. The proof URI is emitted on chain, so every payout links to its evidence.
- **API:** campaign listings, campaign detail with a milestone timeline, donor history, verifier directory and platform stats for the [frontend](https://github.com/aidline-org/aidline-frontend).

The contract is always the source of truth. The backend never moves funds and only stores what the chain cannot hold cheaply.

## Quick start

Requires Node.js 20 or newer. No Docker or system Postgres needed.

```sh
git clone https://github.com/aidline-org/aidline-backend
cd aidline-backend
npm install
cp .env.example .env        # points at the shared testnet deployment by default

npm run dev:db              # terminal 1: starts a local Postgres on port 5433
npm run dev                 # terminal 2: runs migrations, the API and the indexer
```

Open http://localhost:4000/stats. Within a few seconds the indexer catches up with the testnet contract and campaigns appear at http://localhost:4000/campaigns.

## Configuration

All settings come from environment variables. See [`.env.example`](.env.example) for the full list.

| Variable               | Default                 | Purpose                                                |
| ---------------------- | ----------------------- | ------------------------------------------------------ |
| `DATABASE_URL`         | local dev Postgres      | Postgres connection string                             |
| `PUBLIC_BASE_URL`      | `http://localhost:4000` | Used to build metadata and proof URIs stored on chain  |
| `CORS_ORIGINS`         | `http://localhost:3000` | Comma separated frontend origins                       |
| `AIDLINE_NETWORK`      | `testnet`               | `testnet`, `mainnet` or `futurenet`                    |
| `AIDLINE_RPC_URL`      | SDF testnet RPC         | Soroban RPC endpoint                                   |
| `AIDLINE_CONTRACT_ID`  |                         | Contract to index. Indexer is off when empty           |
| `AIDLINE_TOKEN_ID`     |                         | Token the contract raises in, shared with the frontend |
| `INDEXER_START_LEDGER` | latest minus 1000       | Where to start on a fresh database                     |
| `INDEXER_POLL_MS`      | `5000`                  | Poll interval                                          |
| `UPLOAD_DIR`           | `uploads`               | Where proof files are stored                           |

Variables are prefixed with `AIDLINE_` on purpose: the Stellar CLI reads `STELLAR_*` variables from `.env`, and sharing names would make CLI commands run from this folder fail.

## Testnet deployment

|          |                                                                                                                             |
| -------- | --------------------------------------------------------------------------------------------------------------------------- |
| Contract | `CBV6XOB66LTO4QCIXYNEVAY5ZGIWAWIDFCCFCW33NJ5A23R7YAFWKLX4`                                                                  |
| Token    | Native XLM (`CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC`)                                                     |
| Explorer | [stellar.expert](https://stellar.expert/explorer/testnet/contract/CBV6XOB66LTO4QCIXYNEVAY5ZGIWAWIDFCCFCW33NJ5A23R7YAFWKLX4) |

## Scripts

| Command                       | What it does                           |
| ----------------------------- | -------------------------------------- |
| `npm run dev`                 | API and indexer with reload on change  |
| `npm run dev:db`              | Local Postgres in `.pgdata/`           |
| `npm run migrate`             | Apply database migrations              |
| `npm test`                    | Run tests against a throwaway Postgres |
| `npm run lint`                | ESLint                                 |
| `npm run typecheck`           | TypeScript without emitting            |
| `npm run build` / `npm start` | Production build and run               |

## Documentation

- [API reference](docs/API.md)
- [Architecture](docs/ARCHITECTURE.md): how the indexer stays consistent, data model, design decisions
- [Contributing](CONTRIBUTING.md)

## Related repos

| Repo                                                                  |                         |
| --------------------------------------------------------------------- | ----------------------- |
| [aidline-contracts](https://github.com/aidline-org/aidline-contracts) | Soroban escrow contract |
| [aidline-backend](https://github.com/aidline-org/aidline-backend)     | This repo               |
| [aidline-frontend](https://github.com/aidline-org/aidline-frontend)   | Web app                 |

## License

[MIT](LICENSE)
