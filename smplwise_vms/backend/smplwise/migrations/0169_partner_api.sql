-- Final number 0169 (built as PROVISIONAL 0197 on pilot/PARTNERAPI113-295; renumbered at the 2.16.0 integration, release/2160);
-- the content does not depend on the number. Design record: docs/changes/CR-PARTNERAPI113.md (section 11; owner answers 24.10 batch 3,
-- questions 164-172).
--
-- The partner interface: scoped partner tokens for the read API at /p/v1 and signed outgoing webhooks. Additive only. No column holds a
-- token in clear: a token is stored only as SHA-256(token) (256-bit random values). The webhook signing secret and the target URL are
-- sealed (AES-256-GCM, connection_store.seal_service_secret, kind `partner_webhook`). None of these tables is ever written to a backup
-- (services/backup.NEVER_EXPORTED_TABLES); the `partner.*` settings are never exported or restored (SETTINGS_KEEP_PREFIXES).
--
--  partner_clients     a named external system; disabling it stops all its tokens and endpoints at once
--  partner_tokens      bearer credentials (hash only), closed scope list, one restriction, mandatory expiry, per-token rate limits
--  partner_endpoints   a webhook target (sealed URL + host for display), sealed secret (+ the previous one during a rotation), events
--  partner_outbox      events waiting / being retried / delivered / dead (payload kept until delivered or dead + 14 days)
--  partner_deliveries  one row per attempt: status, duration, error class - never headers, bodies, signatures or the full URL
--  partner_idempotency the answer of a POST /p/v1/tickets per (token, Idempotency-Key hash), 24 h
-- Rollback: the feature switches off are the full stop (default OFF); older code never reads these tables.

CREATE TABLE partner_clients (
  id                       TEXT PRIMARY KEY CHECK (id GLOB 'pcl_[0-9a-f]*' AND length(id) = 20),
  label                    TEXT NOT NULL CHECK (length(label) BETWEEN 1 AND 80),
  opaque_installation_ref  TEXT NOT NULL CHECK (length(opaque_installation_ref) = 32),
  state                    TEXT NOT NULL DEFAULT 'active' CHECK (state IN ('active', 'disabled')),
  created_by               TEXT NOT NULL,
  created_at               TEXT NOT NULL,
  updated_at               TEXT NOT NULL,
  deleted_at               TEXT
);

CREATE TABLE partner_tokens (
  id                   TEXT PRIMARY KEY CHECK (id GLOB 'ptk_[0-9a-f]*' AND length(id) = 20),
  client_id            TEXT NOT NULL REFERENCES partner_clients(id) ON DELETE CASCADE,
  label                TEXT NOT NULL DEFAULT '' CHECK (length(label) <= 80),
  token_hash           TEXT NOT NULL UNIQUE CHECK (length(token_hash) = 64),
  last4                TEXT NOT NULL CHECK (length(last4) = 4),
  scopes_json          TEXT NOT NULL,
  restriction_kind     TEXT NOT NULL CHECK (restriction_kind IN ('installation', 'site', 'building', 'floor')),
  restriction_ids_json TEXT NOT NULL DEFAULT '[]',
  departments_json     TEXT NOT NULL DEFAULT '[]',
  source_cidrs_json    TEXT NOT NULL DEFAULT '[]',
  personal_json        TEXT NOT NULL DEFAULT '{}',
  rate_per_min         INTEGER NOT NULL CHECK (rate_per_min BETWEEN 1 AND 600),
  rate_per_hour        INTEGER NOT NULL CHECK (rate_per_hour BETWEEN 1 AND 20000),
  installation_id      TEXT NOT NULL,
  created_by           TEXT NOT NULL,
  created_at           TEXT NOT NULL,
  expires_at           TEXT NOT NULL,
  predecessor_id       TEXT,
  last_used_at         TEXT,
  last_used_addr       TEXT,
  request_count        INTEGER NOT NULL DEFAULT 0,
  revoked_at           TEXT,
  revoked_reason       TEXT,
  expiry_noticed_at    TEXT,
  owner_gone_at        TEXT
);
CREATE INDEX idx_partner_tokens_client ON partner_tokens (client_id, revoked_at);
CREATE INDEX idx_partner_tokens_expires ON partner_tokens (expires_at);

CREATE TABLE partner_endpoints (
  id                   TEXT PRIMARY KEY CHECK (id GLOB 'pep_[0-9a-f]*' AND length(id) = 20),
  client_id            TEXT NOT NULL REFERENCES partner_clients(id) ON DELETE CASCADE,
  label                TEXT NOT NULL DEFAULT '' CHECK (length(label) <= 80),
  url_enc              TEXT NOT NULL,
  host                 TEXT NOT NULL,
  secret_enc           TEXT NOT NULL,
  secret_prev_enc      TEXT,
  secret_prev_until    TEXT,
  events_json          TEXT NOT NULL,
  restriction_kind     TEXT NOT NULL CHECK (restriction_kind IN ('installation', 'site', 'building', 'floor')),
  restriction_ids_json TEXT NOT NULL DEFAULT '[]',
  departments_json     TEXT NOT NULL DEFAULT '[]',
  personal_json        TEXT NOT NULL DEFAULT '{}',
  skip_own             INTEGER NOT NULL DEFAULT 1 CHECK (skip_own IN (0, 1)),
  state                TEXT NOT NULL DEFAULT 'pending' CHECK (state IN ('pending', 'active', 'paused', 'disabled')),
  state_reason         TEXT,
  fail_streak          INTEGER NOT NULL DEFAULT 0,
  first_fail_at        TEXT,
  last_success_at      TEXT,
  last_attempt_at      TEXT,
  sequence             INTEGER NOT NULL DEFAULT 0,
  created_by           TEXT NOT NULL,
  created_at           TEXT NOT NULL,
  updated_at           TEXT NOT NULL
);
CREATE INDEX idx_partner_endpoints_client ON partner_endpoints (client_id, state);

CREATE TABLE partner_outbox (
  id            TEXT PRIMARY KEY CHECK (id GLOB 'evt_[0-9a-f]*' AND length(id) = 20),
  endpoint_id   TEXT NOT NULL REFERENCES partner_endpoints(id) ON DELETE CASCADE,
  type          TEXT NOT NULL,
  payload_json  TEXT NOT NULL,
  occurred_at   TEXT NOT NULL,
  next_at       TEXT NOT NULL,
  attempts      INTEGER NOT NULL DEFAULT 0,
  state         TEXT NOT NULL DEFAULT 'queued' CHECK (state IN ('queued', 'delivering', 'delivered', 'dead')),
  dead_reason   TEXT CHECK (dead_reason IS NULL OR dead_reason IN ('attempts', 'client_error', 'gone', 'overflow', 'expired', 'paused', 'disabled')),
  delivered_at  TEXT,
  ended_at      TEXT,
  redeliveries  INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_partner_outbox_due ON partner_outbox (state, next_at);
CREATE INDEX idx_partner_outbox_endpoint ON partner_outbox (endpoint_id, state);

CREATE TABLE partner_deliveries (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id     TEXT NOT NULL,
  endpoint_id  TEXT NOT NULL,
  type         TEXT NOT NULL,
  attempt      INTEGER NOT NULL,
  started_at   TEXT NOT NULL,
  duration_ms  INTEGER NOT NULL DEFAULT 0,
  http_status  INTEGER,
  error_class  TEXT
);
CREATE INDEX idx_partner_deliveries_endpoint ON partner_deliveries (endpoint_id, id);
CREATE INDEX idx_partner_deliveries_started ON partner_deliveries (started_at);

CREATE TABLE partner_idempotency (
  token_id      TEXT NOT NULL,
  key_hash      TEXT NOT NULL CHECK (length(key_hash) = 64),
  ticket_id     TEXT,
  status        INTEGER NOT NULL,
  response_json TEXT NOT NULL,
  created_at    TEXT NOT NULL,
  PRIMARY KEY (token_id, key_hash)
);
CREATE INDEX idx_partner_idempotency_created ON partner_idempotency (created_at);

-- the partner's own reference of a request it opened (tickets.origin stays 'inbound': the CHECK of migration 0079 cannot be widened
-- without rebuilding the table - recorded in the change record, section 16)
CREATE TABLE partner_ticket_links (
  ticket_id     TEXT PRIMARY KEY REFERENCES tickets(id) ON DELETE CASCADE,
  token_id      TEXT NOT NULL,
  client_id     TEXT NOT NULL,
  external_ref  TEXT,
  created_at    TEXT NOT NULL
);
CREATE INDEX idx_partner_ticket_links_client ON partner_ticket_links (client_id);
