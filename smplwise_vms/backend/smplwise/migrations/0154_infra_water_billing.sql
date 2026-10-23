-- PROVISIONAL NUMBER 0154 (CR-WATER78 slice 3 / slice A of mockup v4, pilot/WATER78C-295): renumbered at the integration to the next free
-- number after the water slice-1 / slice-2 files. The content does not depend on the number.
--
-- CR-WATER78 section 16 (owner review 24.10, mockup v4 APPROVED): water accounts, water + sewage tariffs, bills and their sealed snapshot,
-- the automatic-generation runs, and the alert snooze. SHARED with electricity, never copied here (owner correction 24.10): VAT
-- (energy_vat_rates), the business details / payment terms / numbering / automatic delay (the `energy.billing` settings document), the bill
-- retention keys (energy.draft_retention_days / energy.bill_retention_years), the customers (energy_customers - one tenant card for both
-- media) and the ledger of bill numbers ever used (energy_bill_numbers - one number space). Money, prices and m3 are decimal TEXT; period dates
-- are local dates; instants are UTC ISO-8601 'Z'. Rollback: drop the tables below and the added columns; nothing of electricity reads them.

-- a water + sewage price per m3 valid from a local date (as typed: before or including VAT, the shared default_price_mode)
CREATE TABLE water_tariffs (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  currency    TEXT NOT NULL DEFAULT 'ILS',
  created_by  TEXT,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL,
  deleted_at  TEXT
);

CREATE TABLE water_tariff_versions (
  id              TEXT PRIMARY KEY,
  tariff_id       TEXT NOT NULL REFERENCES water_tariffs(id),
  effective_from  TEXT NOT NULL,             -- YYYY-MM-DD
  water_price     TEXT NOT NULL,             -- per m3, decimal, 4 places, > 0
  sewage_price    TEXT NOT NULL DEFAULT '0.0000',   -- per m3, decimal, 4 places, >= 0 (0 = no sewage line, e.g. irrigation)
  price_mode      TEXT NOT NULL CHECK (price_mode IN ('ex_vat', 'inc_vat')),
  created_by      TEXT,
  created_at      TEXT NOT NULL,
  UNIQUE (tariff_id, effective_from)
);

-- an account: water meters combined by a signed formula (+ / -; "main minus every sub-meter" = the losses account), a customer, a tariff, a period
CREATE TABLE water_accounts (
  id                  TEXT PRIMARY KEY,
  name                TEXT NOT NULL,
  customer_id         TEXT NOT NULL REFERENCES energy_customers(id),   -- the shared customer card
  formula_json        TEXT NOT NULL,         -- the energy_formula AST over water meter ids
  tariff_id           TEXT NOT NULL REFERENCES water_tariffs(id),
  period_months       INTEGER NOT NULL CHECK (period_months IN (1, 2)),
  period_anchor_day   INTEGER NOT NULL CHECK (period_anchor_day BETWEEN 1 AND 31),
  period_anchor_month INTEGER NOT NULL DEFAULT 1 CHECK (period_anchor_month BETWEEN 1 AND 12),
  first_period_start  TEXT NOT NULL,
  timezone            TEXT NOT NULL,
  auto_mode           TEXT NOT NULL DEFAULT 'draft' CHECK (auto_mode IN ('off', 'draft', 'issue')),
  status              TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused')),
  revision            INTEGER NOT NULL DEFAULT 1,
  created_by          TEXT,
  created_at          TEXT NOT NULL,
  updated_at          TEXT NOT NULL,
  deleted_at          TEXT
);
CREATE INDEX idx_water_accounts_customer ON water_accounts (customer_id);

CREATE TABLE water_account_meters (
  account_id TEXT NOT NULL REFERENCES water_accounts(id),
  meter_id   TEXT NOT NULL,
  PRIMARY KEY (account_id, meter_id)
);
CREATE INDEX idx_water_account_meters_meter ON water_account_meters (meter_id);

-- a bill: a draft, or an issued bill with its sealed snapshot (water and sewage lines per m3, then VAT)
CREATE TABLE water_bills (
  id                  TEXT PRIMARY KEY,
  account_id          TEXT NOT NULL REFERENCES water_accounts(id),
  customer_id         TEXT NOT NULL,
  number              TEXT,
  number_base         TEXT,
  number_seq          INTEGER,
  revision            INTEGER NOT NULL DEFAULT 1,
  replaces_bill_id    TEXT,
  replaced_by_bill_id TEXT,
  period_start        TEXT NOT NULL,
  period_end          TEXT NOT NULL,         -- EXCLUSIVE
  state               TEXT NOT NULL CHECK (state IN ('draft', 'issued', 'sent', 'paid', 'void')),
  origin              TEXT NOT NULL DEFAULT 'manual' CHECK (origin IN ('manual', 'auto')),
  m3                  TEXT,
  total               TEXT,
  snapshot_json       TEXT NOT NULL,
  snapshot_sha256     TEXT,
  issue_date          TEXT,
  due_date            TEXT,
  issued_by           TEXT,
  issued_at           TEXT,
  issue_request_id    TEXT,
  create_request_id   TEXT UNIQUE,
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
CREATE UNIQUE INDEX idx_water_bills_number ON water_bills (number) WHERE number IS NOT NULL;
CREATE UNIQUE INDEX idx_water_bills_one_draft ON water_bills (account_id, period_start, period_end) WHERE state = 'draft';
CREATE INDEX idx_water_bills_account ON water_bills (account_id, period_start);
CREATE INDEX idx_water_bills_state ON water_bills (state, updated_at);

CREATE TABLE water_bill_events (
  id           TEXT PRIMARY KEY,
  bill_id      TEXT NOT NULL,
  at           TEXT NOT NULL,
  action       TEXT NOT NULL,
  actor_kind   TEXT NOT NULL CHECK (actor_kind IN ('user', 'system')),
  actor_id     TEXT,
  actor_name   TEXT,
  details_json TEXT
);
CREATE INDEX idx_water_bill_events_bill ON water_bill_events (bill_id, at);

-- automatic generation: one row per (account, period) - the idempotency key
CREATE TABLE water_auto_runs (
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

-- the alert snooze ("נדנוד", section 16): offered durations, the main button's default and the maximum - one revision with the routing
ALTER TABLE water_alert_settings ADD COLUMN snooze_minutes_json TEXT NOT NULL DEFAULT '[15,60,240,1440]';
ALTER TABLE water_alert_settings ADD COLUMN snooze_default_min INTEGER NOT NULL DEFAULT 60;
ALTER TABLE water_alert_settings ADD COLUMN snooze_max_min INTEGER NOT NULL DEFAULT 10080;
-- one open alert row snoozed until an instant (not acknowledged; it returns at the end if the condition persists)
ALTER TABLE water_alert_events ADD COLUMN snoozed_until TEXT;
ALTER TABLE water_alert_events ADD COLUMN snoozed_by TEXT;
