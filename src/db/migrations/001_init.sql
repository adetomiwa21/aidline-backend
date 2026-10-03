CREATE TABLE campaign_metadata (
  id          UUID PRIMARY KEY,
  title       TEXT NOT NULL,
  summary     TEXT NOT NULL,
  description TEXT NOT NULL,
  location    TEXT NOT NULL,
  category    TEXT,
  image_url   TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE campaigns (
  id                  BIGINT PRIMARY KEY,
  creator             TEXT NOT NULL,
  beneficiary         TEXT NOT NULL,
  verifier            TEXT NOT NULL,
  kind                TEXT NOT NULL CHECK (kind IN ('emergency', 'climate')),
  metadata_uri        TEXT NOT NULL,
  metadata_id         UUID REFERENCES campaign_metadata (id),
  goal                NUMERIC(39, 0) NOT NULL,
  deadline            TIMESTAMPTZ NOT NULL,
  milestones          NUMERIC(39, 0)[] NOT NULL,
  milestones_released INTEGER NOT NULL DEFAULT 0,
  raised              NUMERIC(39, 0) NOT NULL DEFAULT 0,
  released            NUMERIC(39, 0) NOT NULL DEFAULT 0,
  status              TEXT NOT NULL CHECK (status IN ('active', 'completed', 'cancelled')),
  created_ledger      INTEGER NOT NULL,
  created_at          TIMESTAMPTZ NOT NULL,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX campaigns_kind_idx ON campaigns (kind);
CREATE INDEX campaigns_creator_idx ON campaigns (creator);

CREATE TABLE donations (
  event_id    TEXT PRIMARY KEY,
  campaign_id BIGINT NOT NULL REFERENCES campaigns (id),
  donor       TEXT NOT NULL,
  amount      NUMERIC(39, 0) NOT NULL,
  ledger      INTEGER NOT NULL,
  tx_hash     TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL
);
CREATE INDEX donations_campaign_idx ON donations (campaign_id, created_at DESC);
CREATE INDEX donations_donor_idx ON donations (donor, created_at DESC);

CREATE TABLE proofs (
  id              UUID PRIMARY KEY,
  campaign_id     BIGINT NOT NULL,
  milestone_index INTEGER NOT NULL,
  note            TEXT NOT NULL,
  files           JSONB NOT NULL DEFAULT '[]',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE milestone_releases (
  event_id    TEXT PRIMARY KEY,
  campaign_id BIGINT NOT NULL REFERENCES campaigns (id),
  index       INTEGER NOT NULL,
  amount      NUMERIC(39, 0) NOT NULL,
  proof_uri   TEXT NOT NULL,
  proof_id    UUID REFERENCES proofs (id),
  ledger      INTEGER NOT NULL,
  tx_hash     TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL,
  UNIQUE (campaign_id, index)
);

CREATE TABLE refunds (
  event_id    TEXT PRIMARY KEY,
  campaign_id BIGINT NOT NULL REFERENCES campaigns (id),
  donor       TEXT NOT NULL,
  amount      NUMERIC(39, 0) NOT NULL,
  ledger      INTEGER NOT NULL,
  tx_hash     TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL
);

CREATE TABLE verifiers (
  address     TEXT PRIMARY KEY,
  active      BOOLEAN NOT NULL DEFAULT false,
  org_name    TEXT,
  website     TEXT,
  country     TEXT,
  description TEXT,
  applied_at  TIMESTAMPTZ,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE indexer_state (
  id          INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  cursor      TEXT,
  last_ledger INTEGER
);
