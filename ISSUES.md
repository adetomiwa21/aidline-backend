# Backend issues

Open issues for **aidline-backend**, grouped by complexity. GitHub is the source of truth: [see all issues](https://github.com/aidline-org/aidline-backend/issues).

| Complexity | Wave points | Open issues |
| ---------- | ----------- | ----------- |
| Trivial    | 100         | 10          |
| Medium     | 150         | 15          |
| High       | 200         | 5           |
| **Total**  |             | **30**      |

Good first issues: 10. They are small, well scoped and a good way to start.

To pick one up, comment on the issue to get assigned, then follow [CONTRIBUTING.md](CONTRIBUTING.md).

## Trivial (100 points)

| #                                                               | Issue                                                | Type        | Good first issue |
| --------------------------------------------------------------- | ---------------------------------------------------- | ----------- | ---------------- |
| [#1](https://github.com/aidline-org/aidline-backend/issues/1)   | Add GET /campaigns/:id/refunds                       | enhancement | yes              |
| [#2](https://github.com/aidline-org/aidline-backend/issues/2)   | Search campaigns by title or location                | enhancement | yes              |
| [#3](https://github.com/aidline-org/aidline-backend/issues/3)   | Report indexer lag in /health                        | enhancement | yes              |
| [#9](https://github.com/aidline-org/aidline-backend/issues/9)   | Sort campaigns by newest, ending soon or most funded | enhancement | yes              |
| [#10](https://github.com/aidline-org/aidline-backend/issues/10) | Consistent JSON 404 for unknown routes               | enhancement | yes              |
| [#11](https://github.com/aidline-org/aidline-backend/issues/11) | Return a request id header                           | enhancement | yes              |
| [#12](https://github.com/aidline-org/aidline-backend/issues/12) | List campaigns a verifier oversees                   | enhancement | yes              |
| [#13](https://github.com/aidline-org/aidline-backend/issues/13) | Add docker compose for Postgres                      | tooling     | yes              |
| [#14](https://github.com/aidline-org/aidline-backend/issues/14) | Unit tests for URI helpers                           | testing     | yes              |
| [#15](https://github.com/aidline-org/aidline-backend/issues/15) | Retry the database connection at boot                | enhancement | yes              |

## Medium (150 points)

| #                                                               | Issue                                              | Type          | Good first issue |
| --------------------------------------------------------------- | -------------------------------------------------- | ------------- | ---------------- |
| [#4](https://github.com/aidline-org/aidline-backend/issues/4)   | Generate an OpenAPI spec and serve docs at /docs   | documentation |                  |
| [#5](https://github.com/aidline-org/aidline-backend/issues/5)   | Store proof files in S3 compatible storage         | enhancement   |                  |
| [#6](https://github.com/aidline-org/aidline-backend/issues/6)   | Webhook notifications when a milestone is released | enhancement   |                  |
| [#16](https://github.com/aidline-org/aidline-backend/issues/16) | Stricter rate limits for uploads                   | security      |                  |
| [#17](https://github.com/aidline-org/aidline-backend/issues/17) | Validate uploaded files by content, not just type  | security      |                  |
| [#18](https://github.com/aidline-org/aidline-backend/issues/18) | Generate thumbnails for proof images               | enhancement   |                  |
| [#19](https://github.com/aidline-org/aidline-backend/issues/19) | Cache stats and releases briefly                   | enhancement   |                  |
| [#20](https://github.com/aidline-org/aidline-backend/issues/20) | Separate liveness and readiness checks             | enhancement   |                  |
| [#21](https://github.com/aidline-org/aidline-backend/issues/21) | Admin review queue for verifier applications       | enhancement   |                  |
| [#22](https://github.com/aidline-org/aidline-backend/issues/22) | Keeper job to extend campaign storage TTL          | enhancement   |                  |
| [#23](https://github.com/aidline-org/aidline-backend/issues/23) | Recover when the RPC cursor falls out of retention | enhancement   |                  |
| [#24](https://github.com/aidline-org/aidline-backend/issues/24) | CSV export for auditors                            | enhancement   |                  |
| [#25](https://github.com/aidline-org/aidline-backend/issues/25) | Daily stats history for charts                     | enhancement   |                  |
| [#26](https://github.com/aidline-org/aidline-backend/issues/26) | Full text search across campaigns                  | enhancement   |                  |
| [#30](https://github.com/aidline-org/aidline-backend/issues/30) | Load testing and performance baseline              | testing       |                  |

## High (200 points)

| #                                                               | Issue                                                  | Type        | Good first issue |
| --------------------------------------------------------------- | ------------------------------------------------------ | ----------- | ---------------- |
| [#7](https://github.com/aidline-org/aidline-backend/issues/7)   | Wallet signature authentication for uploads            | security    |                  |
| [#8](https://github.com/aidline-org/aidline-backend/issues/8)   | Suggest emergency campaigns from GDACS disaster alerts | enhancement |                  |
| [#27](https://github.com/aidline-org/aidline-backend/issues/27) | Pin metadata and proofs to IPFS                        | enhancement |                  |
| [#28](https://github.com/aidline-org/aidline-backend/issues/28) | Support several networks from one deployment           | enhancement |                  |
| [#29](https://github.com/aidline-org/aidline-backend/issues/29) | Run several API instances with a single indexer        | enhancement |                  |
