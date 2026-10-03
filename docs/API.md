# API reference

Base URL in development: `http://localhost:4000`

Token amounts are returned as **strings** in the token's smallest unit (stroops for XLM, 7 decimals), because they can exceed what a JavaScript number holds safely. Timestamps are ISO 8601.

Errors share one shape:

```json
{
  "error": "validation_error",
  "message": "Request is invalid",
  "issues": [{ "path": "title", "message": "..." }]
}
```

## Platform

### `GET /health`

`{ "ok": true, "indexedLedger": 4993748 }`

### `GET /config`

Network details the frontend needs: `network`, `networkPassphrase`, `rpcUrl`, `contractId`, `tokenId`.

### `GET /stats`

```json
{
  "campaigns": 4,
  "activeCampaigns": 3,
  "totalDonated": "52000000000",
  "totalReleased": "18000000000",
  "donors": 11,
  "verifiers": 2,
  "milestonesVerified": 5
}
```

## Campaigns

### `GET /campaigns`

Query: `kind` (`emergency` | `climate`), `status` (`active` | `completed` | `cancelled` | `expired`), `creator`, `verifier`, `limit` (max 100), `offset`.

Returns `{ items, total }`. Each item:

```json
{
  "id": "0",
  "kind": "emergency",
  "status": "active",
  "creator": "G...",
  "beneficiary": "G...",
  "verifier": "G...",
  "goal": "2500000000",
  "raised": "1200000000",
  "released": "1000000000",
  "milestones": ["1000000000", "1500000000"],
  "milestonesReleased": 1,
  "deadline": "2026-10-10T01:52:32.000Z",
  "metadataUri": "http://.../metadata/<id>",
  "createdAt": "...",
  "donorCount": 1,
  "metadata": {
    "title": "...",
    "summary": "...",
    "location": "...",
    "category": "flood",
    "imageUrl": null
  }
}
```

`expired` is computed: an active campaign whose deadline has passed. Donors can claim refunds from it.

### `GET /campaigns/:id`

The same fields, plus `metadata.description` and a milestone timeline:

```json
"milestones": [
  {
    "index": 0, "amount": "1000000000", "released": true,
    "releasedAt": "...", "txHash": "4c5d...",
    "proofUri": "http://.../proofs/<id>",
    "proof": { "id": "...", "note": "Delivered 40 water tanks", "files": [{ "name": "...", "type": "image/png", "url": "..." }] }
  },
  { "index": 1, "amount": "1500000000", "released": false, "releasedAt": null, "txHash": null, "proofUri": null, "proof": null }
]
```

### `GET /campaigns/:id/donations`

Paginated `{ items: [{ donor, amount, txHash, createdAt }] }`, newest first.

## Metadata

### `POST /metadata`

Create the story for a campaign before calling `create_campaign` on chain.

| Field         | Rules                    |
| ------------- | ------------------------ |
| `title`       | 5 to 120 chars           |
| `summary`     | 10 to 280 chars          |
| `description` | 20 to 10,000 chars       |
| `location`    | 2 to 120 chars           |
| `category`    | optional, up to 60 chars |
| `imageUrl`    | optional URL             |

Returns `201 { "id": "<uuid>", "uri": "http://.../metadata/<uuid>" }`. Pass `uri` as `metadata_uri` to the contract. Metadata is immutable.

### `GET /metadata/:id`

## Proofs

### `POST /proofs`

`multipart/form-data` with fields `campaignId`, `milestoneIndex`, `note` (10 to 2000 chars) and up to 5 `files` (JPEG, PNG, WebP or PDF, 5 MB each).

Returns `201 { "id", "uri", "files" }`. Pass `uri` as `proof_uri` to `approve_milestone`.

### `GET /proofs/:id`

## Verifiers

### `GET /verifiers`

Verifiers that are active on chain, with their profile when one exists.

### `GET /verifiers/:address`

Profile and on chain status for one address.

### `POST /verifiers/applications`

`{ address, orgName, website?, country, description }`. Stores a profile. The admin still has to call `add_verifier` on chain before the address shows up as active.

## Donors

### `GET /donors/:address`

```json
{
  "address": "G...",
  "totalDonated": "1200000000",
  "campaignsSupported": 1,
  "donations": [
    {
      "campaignId": "0",
      "campaignTitle": "...",
      "amount": "...",
      "txHash": "...",
      "createdAt": "..."
    }
  ],
  "refunds": []
}
```

## Files

`GET /uploads/proofs/<proof id>/<file>` serves uploaded proof files.
