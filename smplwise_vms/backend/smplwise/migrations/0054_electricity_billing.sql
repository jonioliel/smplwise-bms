-- CR-023 P2 (docs/changes/CR-023-ELECTRICITY-METERS-BILLS.md sections 4.3, 6, 7, 9-13; owner decisions 2026-10-04 rounds 1-3):
-- electricity billing in the main database - customers, accounts (meters combined by a formula), fixed-price tariffs with
-- effective dates, VAT rates with effective dates, bills with their sealed snapshot, the automatic-generation runs and the
-- ledger of bill numbers ever used. Number 0054 set at the 0.1.160 integration (the meters/readings migration is
-- 0053_electricity_meters.sql; this file references meters by their text id only, no foreign key across the two).
-- Money, prices and kWh are decimal TEXT (never REAL). Dates of periods are local dates; instants are UTC ISO-8601 'Z'.

-- the customer card (D2): one or more accounts per customer
CREATE TABLE energy_customers (
  id              TEXT PRIMARY KEY,
  customer_number TEXT NOT NULL UNIQUE,      -- digits, zero padded to >= 4; unique for ever (a deleted customer keeps it)
  name            TEXT NOT NULL,
  address         TEXT NOT NULL DEFAULT '',
  phone           TEXT NOT NULL DEFAULT '',
  email           TEXT NOT NULL DEFAULT '',
  tax_id          TEXT NOT NULL DEFAULT '',
  notes           TEXT NOT NULL DEFAULT '',
  revision        INTEGER NOT NULL DEFAULT 1,
  created_by      TEXT,
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL,
  deleted_at      TEXT
);

-- a fixed price per kWh (D0); kind 'tou' is reserved for time-of-use later
CREATE TABLE energy_tariffs (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  currency    TEXT NOT NULL DEFAULT 'ILS',
  kind        TEXT NOT NULL DEFAULT 'fixed' CHECK (kind IN ('fixed', 'tou')),
  created_by  TEXT,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL,
  deleted_at  TEXT
);

-- a price valid from a local date (D6: as typed, before or including VAT); definition_json stays NULL for 'fixed'
CREATE TABLE energy_tariff_versions (
  id              TEXT PRIMARY KEY,
  tariff_id       TEXT NOT NULL REFERENCES energy_tariffs(id),
  effective_from  TEXT NOT NULL,             -- YYYY-MM-DD
  price           TEXT NOT NULL,             -- decimal, 4 places
  price_mode      TEXT NOT NULL CHECK (price_mode IN ('ex_vat', 'inc_vat')),
  definition_json TEXT,
  created_by      TEXT,
  created_at      TEXT NOT NULL,
  UNIQUE (tariff_id, effective_from)
);

-- VAT rate valid from a local date (a change inside a period splits the period, owner round 2 Q4 = b)
CREATE TABLE energy_vat_rates (
  id              TEXT PRIMARY KEY,
  effective_from  TEXT NOT NULL UNIQUE,
  rate_percent    TEXT NOT NULL,             -- decimal, up to 2 places
  created_by      TEXT,
  created_at      TEXT NOT NULL
);

-- an account: meters combined by a formula (D1), a customer, a tariff and a billing period
CREATE TABLE energy_accounts (
  id                  TEXT PRIMARY KEY,
  name                TEXT NOT NULL,
  customer_id         TEXT NOT NULL REFERENCES energy_customers(id),
  formula_json        TEXT NOT NULL,         -- AST referencing meter ids (docs/architecture/ELECTRICITY_BILLING_API.md section 5)
  tariff_id           TEXT NOT NULL REFERENCES energy_tariffs(id),
  period_months       INTEGER NOT NULL CHECK (period_months IN (1, 2)),
  period_anchor_day   INTEGER NOT NULL CHECK (period_anchor_day BETWEEN 1 AND 31),
  period_anchor_month INTEGER NOT NULL DEFAULT 1 CHECK (period_anchor_month BETWEEN 1 AND 12),
  first_period_start  TEXT NOT NULL,         -- YYYY-MM-DD
  timezone            TEXT NOT NULL,         -- IANA
  auto_mode           TEXT NOT NULL DEFAULT 'draft' CHECK (auto_mode IN ('off', 'draft', 'issue')),
  status              TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused')),
  revision            INTEGER NOT NULL DEFAULT 1,
  created_by          TEXT,
  created_at          TEXT NOT NULL,
  updated_at          TEXT NOT NULL,
  deleted_at          TEXT
);
CREATE INDEX idx_energy_accounts_customer ON energy_accounts (customer_id);

-- derived from the formula: which meters an account uses ("used in", retention / retire guards of the meters branch)
CREATE TABLE energy_account_meters (
  account_id TEXT NOT NULL REFERENCES energy_accounts(id),
  meter_id   TEXT NOT NULL,
  PRIMARY KEY (account_id, meter_id)
);
CREATE INDEX idx_energy_account_meters_meter ON energy_account_meters (meter_id);

-- a bill: a draft, or an issued bill with its sealed snapshot (docs/architecture/ELECTRICITY_BILL_SNAPSHOT.md)
CREATE TABLE energy_bills (
  id                  TEXT PRIMARY KEY,
  account_id          TEXT NOT NULL REFERENCES energy_accounts(id),
  customer_id         TEXT NOT NULL,
  number              TEXT,                  -- NULL while a draft
  number_base         TEXT,                  -- YYYY-MM-CCCC
  number_seq          INTEGER,               -- 1 = no suffix, 2 = "/2"...
  revision            INTEGER NOT NULL DEFAULT 1,
  replaces_bill_id    TEXT,
  replaced_by_bill_id TEXT,
  period_start        TEXT NOT NULL,         -- local date, inclusive
  period_end          TEXT NOT NULL,         -- local date, EXCLUSIVE
  state               TEXT NOT NULL CHECK (state IN ('draft', 'issued', 'sent', 'paid', 'void')),
  origin              TEXT NOT NULL DEFAULT 'manual' CHECK (origin IN ('manual', 'auto')),
  kwh                 TEXT,
  total               TEXT,
  snapshot_json       TEXT NOT NULL,
  snapshot_sha256     TEXT,                  -- set when issued
  pdf_path            TEXT,                  -- relative to the data directory; the first PDF of an issued bill
  pdf_sha256          TEXT,
  issue_date          TEXT,
  due_date            TEXT,
  issued_by           TEXT,
  issued_at           TEXT,
  issue_request_id    TEXT,                  -- client_request_id of the issue (a double click returns the same bill)
  create_request_id   TEXT UNIQUE,           -- client_request_id of the creation
  sent_at             TEXT,
  sent_how            TEXT,
  sent_note           TEXT,
  paid_at             TEXT,
  paid_ref            TEXT,
  void_reason         TEXT,
  voided_at           TEXT,
  row_version         INTEGER NOT NULL DEFAULT 1,
  created_by          TEXT,
  created_at          TEXT NOT NULL,
  updated_at          TEXT NOT NULL
);
CREATE UNIQUE INDEX idx_energy_bills_number ON energy_bills (number) WHERE number IS NOT NULL;
CREATE UNIQUE INDEX idx_energy_bills_one_draft ON energy_bills (account_id, period_start, period_end) WHERE state = 'draft';
CREATE INDEX idx_energy_bills_account ON energy_bills (account_id, period_start);
CREATE INDEX idx_energy_bills_state ON energy_bills (state, updated_at);

-- what happened to a bill, for the bill page (the audit log keeps the security record)
CREATE TABLE energy_bill_events (
  id           TEXT PRIMARY KEY,
  bill_id      TEXT NOT NULL,
  at           TEXT NOT NULL,
  action       TEXT NOT NULL,
  actor_kind   TEXT NOT NULL CHECK (actor_kind IN ('user', 'system')),
  actor_id     TEXT,
  actor_name   TEXT,
  details_json TEXT
);
CREATE INDEX idx_energy_bill_events_bill ON energy_bill_events (bill_id, at);

-- automatic generation: one row per (account, period) - the idempotency key; written in the same transaction as the draft
CREATE TABLE energy_auto_runs (
  account_id      TEXT NOT NULL,
  period_start    TEXT NOT NULL,
  period_end      TEXT NOT NULL,
  status          TEXT NOT NULL CHECK (status IN ('created', 'issued', 'skipped', 'failed')),
  bill_id         TEXT,
  error_code      TEXT,
  attempts        INTEGER NOT NULL DEFAULT 1,
  next_attempt_at TEXT,
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL,
  PRIMARY KEY (account_id, period_start, period_end)
);

-- every bill number ever assigned. NOT part of the project backup and never emptied by a restore: a restore of an older
-- archive can never make a number reusable (CR-023 section 18).
CREATE TABLE energy_bill_numbers (
  number      TEXT PRIMARY KEY,
  number_base TEXT NOT NULL,
  number_seq  INTEGER NOT NULL,
  revision    INTEGER NOT NULL,
  bill_id     TEXT NOT NULL,
  assigned_at TEXT NOT NULL
);
CREATE INDEX idx_energy_bill_numbers_base ON energy_bill_numbers (number_base, number_seq);

-- content-addressed business logos: a sealed snapshot references its logo by sha256, so a logo is never deleted while kept
CREATE TABLE energy_assets (
  sha256       TEXT PRIMARY KEY,
  kind         TEXT NOT NULL CHECK (kind IN ('logo')),
  mime         TEXT NOT NULL,
  width        INTEGER,
  height       INTEGER,
  storage_path TEXT NOT NULL,              -- relative to the data directory
  created_at   TEXT NOT NULL
);
