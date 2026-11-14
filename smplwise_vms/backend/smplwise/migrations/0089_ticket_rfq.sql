-- CR-038 requests for quotation, stage C1 (TKRFQ1, docs/tickets/RFQ_BACKEND_CONTRACT.md; owner decisions 16.10): an RFQ sent to
-- several vendors with no commitment to award, the invited vendors, their personal links (the handler-link token model, its own
-- table: ticket_links needs a ticket and an assignment), the awards with the optional per-department second approval, the private
-- thread with each vendor and the RFQ's own timeline. Final number 0089 (integ/263, release 2.6.3).
--
-- Quotes are NOT a new table: an RFQ quote is a `ticket_quotes` row with `rfq_vendor_id` set and `ticket_id` NULL (0088 reserved it).
-- Nothing here is read while the module switch `tickets.enabled` is off. Times are UTC ISO-8601 `...Z` text; money is an integer in
-- minor units, as in 0083 / 0088.
--
-- ONE table rebuild: `ticket_outbox` (0081 + 0086). Its `purpose` CHECK cannot be widened in place; nothing references the table by a
-- foreign key (ticket_link_codes.outbox_id is plain text), so dropping it cascades nothing. Every row, column and index is kept; the
-- new purposes are rfq_invite / rfq_reminder / rfq_update / rfq_cancelled / rfq_order (C4) and the new column `rfq_id` (no FK).
-- Integration (2.6.3): this is the ONLY rebuild of ticket_outbox in the release - TKNOTIFOTP's purpose `phone_verify` (the fixed
-- number-verification code message; its table and columns are 0091) is folded in here instead of a second rebuild.

CREATE TABLE ticket_rfqs (
  id                     TEXT PRIMARY KEY,
  number                 INTEGER NOT NULL UNIQUE,
  department_id          TEXT NOT NULL REFERENCES ticket_departments(id),
  title                  TEXT NOT NULL,
  description            TEXT NOT NULL DEFAULT '',
  site_id                TEXT,
  building_id            TEXT,
  floor_id               TEXT,
  place_text             TEXT,
  source_ticket_id       TEXT REFERENCES tickets(id) ON DELETE SET NULL,
  allowed_line_kinds     TEXT NOT NULL,
  due_at                 TEXT NOT NULL,
  work_from              TEXT,
  work_to                TEXT,
  internal_owner_user_id TEXT,
  state                  TEXT NOT NULL CHECK (state IN ('draft', 'sent', 'collecting', 'due_passed', 'awarded', 'ordered', 'closed',
                                                        'cancelled')),
  created_by             TEXT NOT NULL,
  created_at             TEXT NOT NULL,
  updated_at             TEXT NOT NULL,
  sent_at                TEXT,
  due_passed_at          TEXT,
  awarded_at             TEXT,
  closed_at              TEXT,
  cancelled_at           TEXT,
  cancel_reason          TEXT,
  revision               INTEGER NOT NULL DEFAULT 1,
  CHECK (work_to IS NULL OR work_from IS NULL OR work_to >= work_from)
);
CREATE INDEX idx_ticket_rfqs_dept_state ON ticket_rfqs (department_id, state);
CREATE INDEX idx_ticket_rfqs_updated ON ticket_rfqs (updated_at, id);
CREATE INDEX idx_ticket_rfqs_due ON ticket_rfqs (due_at) WHERE state IN ('sent', 'collecting');
CREATE INDEX idx_ticket_rfqs_ended ON ticket_rfqs (closed_at) WHERE closed_at IS NOT NULL;
CREATE INDEX idx_ticket_rfqs_source ON ticket_rfqs (source_ticket_id) WHERE source_ticket_id IS NOT NULL;

CREATE TABLE ticket_rfq_vendors (
  id              TEXT PRIMARY KEY,
  rfq_id          TEXT NOT NULL REFERENCES ticket_rfqs(id) ON DELETE CASCADE,
  contact_id      TEXT NOT NULL REFERENCES ticket_contacts(id),
  channel         TEXT NOT NULL CHECK (channel IN ('whatsapp', 'email', 'manual')),
  state           TEXT NOT NULL CHECK (state IN ('draft', 'sent', 'opened', 'quoted', 'declined', 'expired', 'withdrawn', 'awarded',
                                                 'not_awarded', 'removed')),
  require_code    INTEGER NOT NULL DEFAULT 0 CHECK (require_code IN (0, 1)),
  channel_choice  TEXT NOT NULL DEFAULT 'auto' CHECK (channel_choice IN ('auto', 'whatsapp', 'email', 'manual')),
  invited_at      TEXT NOT NULL,
  sent_at         TEXT,
  first_opened_at TEXT,
  last_opened_at  TEXT,
  open_count      INTEGER NOT NULL DEFAULT 0,
  quoted_at       TEXT,
  declined_at     TEXT,
  decline_reason  TEXT,
  removed_at      TEXT,
  created_by      TEXT NOT NULL,
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL,
  revision        INTEGER NOT NULL DEFAULT 1,
  UNIQUE (rfq_id, contact_id)
);
CREATE INDEX idx_ticket_rfq_vendors_contact ON ticket_rfq_vendors (contact_id);

CREATE TABLE ticket_rfq_links (
  id              TEXT PRIMARY KEY,
  rfq_vendor_id   TEXT NOT NULL UNIQUE REFERENCES ticket_rfq_vendors(id) ON DELETE CASCADE,
  rfq_id          TEXT NOT NULL REFERENCES ticket_rfqs(id) ON DELETE CASCADE,
  contact_id      TEXT NOT NULL REFERENCES ticket_contacts(id),
  generation      INTEGER NOT NULL DEFAULT 1 CHECK (generation >= 1),
  key_id          TEXT NOT NULL,
  token_hash      TEXT NOT NULL UNIQUE,
  require_code    INTEGER NOT NULL CHECK (require_code IN (0, 1)),
  sent_via        TEXT CHECK (sent_via IN ('whatsapp', 'email', 'manual')),
  sent_at         TEXT,
  created_at      TEXT NOT NULL,
  generation_at   TEXT,
  expires_at      TEXT NOT NULL,
  cap_at          TEXT NOT NULL,
  grace_until     TEXT,
  revoked_at      TEXT,
  revoked_reason  TEXT CHECK (revoked_reason IN ('closed', 'cancelled', 'removed', 'manual', 'resent', 'module_key', 'contact_changed',
                                                'contact_erased')),
  first_opened_at TEXT,
  last_opened_at  TEXT,
  open_count      INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_ticket_rfq_links_rfq ON ticket_rfq_links (rfq_id);
CREATE INDEX idx_ticket_rfq_links_contact ON ticket_rfq_links (contact_id) WHERE revoked_at IS NULL;
CREATE INDEX idx_ticket_rfq_links_key ON ticket_rfq_links (key_id);

CREATE TABLE ticket_rfq_link_redeems (
  id_hash      TEXT PRIMARY KEY,
  link_id      TEXT NOT NULL REFERENCES ticket_rfq_links(id) ON DELETE CASCADE,
  generation   INTEGER NOT NULL,
  created_at   TEXT NOT NULL,
  expires_at   TEXT NOT NULL,
  uses         INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_ticket_rfq_link_redeems_link ON ticket_rfq_link_redeems (link_id);
CREATE INDEX idx_ticket_rfq_link_redeems_expiry ON ticket_rfq_link_redeems (expires_at);

-- TKRFQVP (contract section 15.2): the OPTIONAL verification code of a vendor link (owner decision 16.10: off by default, per vendor) -
-- the same columns and rules as ticket_link_codes / ticket_link_failures / ticket_link_sessions (0080), per link generation.
CREATE TABLE ticket_rfq_link_codes (
  id            TEXT PRIMARY KEY,
  link_id       TEXT NOT NULL REFERENCES ticket_rfq_links(id) ON DELETE CASCADE,
  generation    INTEGER NOT NULL,
  code_hash     TEXT NOT NULL,
  channel       TEXT NOT NULL CHECK (channel IN ('whatsapp', 'email')),
  created_at    TEXT NOT NULL,
  expires_at    TEXT NOT NULL,
  attempts      INTEGER NOT NULL DEFAULT 0,
  consumed_at   TEXT,
  outbox_id     TEXT
);
CREATE INDEX idx_ticket_rfq_link_codes_link ON ticket_rfq_link_codes (link_id, generation, created_at DESC);
CREATE INDEX idx_ticket_rfq_link_codes_expiry ON ticket_rfq_link_codes (expires_at);

CREATE TABLE ticket_rfq_link_failures (
  link_id      TEXT NOT NULL REFERENCES ticket_rfq_links(id) ON DELETE CASCADE,
  generation   INTEGER NOT NULL,
  window_start TEXT NOT NULL,
  failures     INTEGER NOT NULL DEFAULT 0,
  locked_until TEXT,
  PRIMARY KEY (link_id, generation)
);

CREATE TABLE ticket_rfq_link_sessions (
  id_hash      TEXT PRIMARY KEY,
  link_id      TEXT NOT NULL REFERENCES ticket_rfq_links(id) ON DELETE CASCADE,
  generation   INTEGER NOT NULL,
  created_at   TEXT NOT NULL,
  expires_at   TEXT NOT NULL
);
CREATE INDEX idx_ticket_rfq_link_sessions_link ON ticket_rfq_link_sessions (link_id);
CREATE INDEX idx_ticket_rfq_link_sessions_expiry ON ticket_rfq_link_sessions (expires_at);

CREATE TABLE ticket_rfq_awards (
  id                      TEXT PRIMARY KEY,
  rfq_id                  TEXT NOT NULL REFERENCES ticket_rfqs(id) ON DELETE CASCADE,
  rfq_vendor_id           TEXT NOT NULL REFERENCES ticket_rfq_vendors(id) ON DELETE CASCADE,
  quote_id                TEXT NOT NULL,
  state                   TEXT NOT NULL CHECK (state IN ('pending_second', 'approved', 'declined', 'cancelled')),
  line_indexes_json       TEXT NOT NULL,
  finalize                INTEGER NOT NULL DEFAULT 1 CHECK (finalize IN (0, 1)),
  currency                TEXT NOT NULL,
  approved_subtotal_minor INTEGER NOT NULL CHECK (approved_subtotal_minor >= 0),
  approved_vat_minor      INTEGER NOT NULL CHECK (approved_vat_minor >= 0),
  approved_total_minor    INTEGER NOT NULL CHECK (approved_total_minor >= 0),
  second_required         INTEGER NOT NULL DEFAULT 0 CHECK (second_required IN (0, 1)),
  threshold_minor         INTEGER,
  first_by                TEXT NOT NULL,
  first_at                TEXT NOT NULL,
  second_by               TEXT,
  second_at               TEXT,
  decline_reason          TEXT,
  created_at              TEXT NOT NULL,
  updated_at              TEXT NOT NULL,
  revision                INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX idx_ticket_rfq_awards_rfq ON ticket_rfq_awards (rfq_id, created_at);
CREATE UNIQUE INDEX idx_ticket_rfq_awards_live_quote ON ticket_rfq_awards (quote_id) WHERE state IN ('pending_second', 'approved');

CREATE TABLE ticket_rfq_messages (
  id              TEXT PRIMARY KEY,
  rfq_id          TEXT NOT NULL REFERENCES ticket_rfqs(id) ON DELETE CASCADE,
  rfq_vendor_id   TEXT NOT NULL REFERENCES ticket_rfq_vendors(id) ON DELETE CASCADE,
  direction       TEXT NOT NULL CHECK (direction IN ('out', 'in')),
  body            TEXT NOT NULL,
  author_kind     TEXT NOT NULL CHECK (author_kind IN ('user', 'contact')),
  author_id       TEXT NOT NULL,
  source_kind     TEXT CHECK (source_kind IN ('award', 'clarify')),
  source_id       TEXT,
  notified        INTEGER NOT NULL DEFAULT 0 CHECK (notified IN (0, 1)),
  outbox_id       TEXT,
  created_at      TEXT NOT NULL
);
CREATE INDEX idx_ticket_rfq_messages_vendor ON ticket_rfq_messages (rfq_vendor_id, created_at);

CREATE TABLE ticket_rfq_events (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  rfq_id         TEXT NOT NULL REFERENCES ticket_rfqs(id) ON DELETE CASCADE,
  rfq_vendor_id  TEXT,
  kind           TEXT NOT NULL,
  actor_kind     TEXT NOT NULL CHECK (actor_kind IN ('user', 'contact', 'system')),
  actor_user_id  TEXT,
  actor_name     TEXT NOT NULL DEFAULT '',
  data_json      TEXT NOT NULL DEFAULT '{}',
  at             TEXT NOT NULL
);
CREATE INDEX idx_ticket_rfq_events_rfq ON ticket_rfq_events (rfq_id, id);

-- TKRFQVP (contract 15.4): how long the vendor's quote stays valid (an instant; NULL = not stated)
ALTER TABLE ticket_quotes ADD COLUMN valid_until TEXT;

ALTER TABLE ticket_departments ADD COLUMN rfq_second_approval_minor INTEGER CHECK (rfq_second_approval_minor IS NULL OR rfq_second_approval_minor >= 0);

INSERT OR IGNORE INTO ticket_sequence(name, value) VALUES ('rfq', 0);

-- ---------------------------------------------------------------- ticket_outbox: the RFQ purposes and `rfq_id` (rebuild)

CREATE TABLE ticket_outbox_new (
  id                  TEXT PRIMARY KEY,
  ticket_id           TEXT REFERENCES tickets(id) ON DELETE SET NULL,
  assignment_id       TEXT,
  link_id             TEXT,
  recipient_kind      TEXT NOT NULL CHECK (recipient_kind IN ('contact', 'test')),
  contact_id          TEXT,
  channel             TEXT NOT NULL CHECK (channel IN ('whatsapp', 'email')),
  purpose             TEXT NOT NULL CHECK (purpose IN ('assign', 'reminder', 'code', 'closed', 'reassigned', 'reopened',
                                                       'update', 'cost_rejected', 'cost_approved', 'cost_reopened', 'test',
                                                       'rfq_invite', 'rfq_reminder', 'rfq_update', 'rfq_cancelled', 'rfq_order',
                                                       'phone_verify')),
  use_key             TEXT NOT NULL,
  department_id       TEXT,
  account_key         TEXT,
  template_id         TEXT,
  template_revision   INTEGER,
  params_json         TEXT NOT NULL DEFAULT '{}',
  state               TEXT NOT NULL CHECK (state IN ('queued', 'held', 'sending', 'sent', 'refused', 'unknown', 'not_sent',
                                                     'cancelled', 'superseded')),
  held_reason         TEXT CHECK (held_reason IN ('send_hours', 'channel_down', 'account_unmapped', 'module_off')),
  held_since          TEXT,
  attempts            INTEGER NOT NULL DEFAULT 0,
  first_attempt_at    TEXT,
  not_before          TEXT NOT NULL,
  priority            INTEGER NOT NULL DEFAULT 1,
  outcome_code        TEXT,
  provider_message_id TEXT,
  reply_nonce         TEXT UNIQUE,
  fallback_of         TEXT,
  resend_of           TEXT,
  code_id             TEXT,                          -- purpose 'code': the ticket_link_codes row; 'phone_verify': the ticket_phone_verifications row (0091)
  idempotency_key     TEXT,
  send_now            INTEGER NOT NULL DEFAULT 0,
  requested_by        TEXT,
  created_at          TEXT NOT NULL,
  sent_at             TEXT,
  updated_at          TEXT NOT NULL,
  link_generation     INTEGER CHECK (link_generation IS NULL OR link_generation >= 1),
  rfq_id              TEXT
);
INSERT INTO ticket_outbox_new (id, ticket_id, assignment_id, link_id, recipient_kind, contact_id, channel, purpose, use_key, department_id,
                               account_key, template_id, template_revision, params_json, state, held_reason, held_since, attempts,
                               first_attempt_at, not_before, priority, outcome_code, provider_message_id, reply_nonce, fallback_of,
                               resend_of, code_id, idempotency_key, send_now, requested_by, created_at, sent_at, updated_at,
                               link_generation, rfq_id)
SELECT id, ticket_id, assignment_id, link_id, recipient_kind, contact_id, channel, purpose, use_key, department_id, account_key,
       template_id, template_revision, params_json, state, held_reason, held_since, attempts, first_attempt_at, not_before, priority,
       outcome_code, provider_message_id, reply_nonce, fallback_of, resend_of, code_id, idempotency_key, send_now, requested_by,
       created_at, sent_at, updated_at, link_generation, NULL
FROM ticket_outbox;
DROP TABLE ticket_outbox;
ALTER TABLE ticket_outbox_new RENAME TO ticket_outbox;
CREATE INDEX idx_ticket_outbox_queue ON ticket_outbox (state, priority, not_before) WHERE state IN ('queued', 'held', 'sending');
CREATE INDEX idx_ticket_outbox_ticket ON ticket_outbox (ticket_id, created_at);
CREATE INDEX idx_ticket_outbox_contact_sent ON ticket_outbox (contact_id, sent_at) WHERE state = 'sent';
CREATE INDEX idx_ticket_outbox_provider ON ticket_outbox (provider_message_id) WHERE provider_message_id IS NOT NULL;
CREATE INDEX idx_ticket_outbox_channel_sent ON ticket_outbox (channel, sent_at) WHERE state IN ('sent', 'unknown');
CREATE INDEX idx_ticket_outbox_account_sent ON ticket_outbox (account_key, sent_at) WHERE account_key IS NOT NULL;
CREATE INDEX idx_ticket_outbox_updated ON ticket_outbox (updated_at);
CREATE UNIQUE INDEX idx_ticket_outbox_idempotency ON ticket_outbox (idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE INDEX idx_ticket_outbox_rfq ON ticket_outbox (rfq_id, created_at) WHERE rfq_id IS NOT NULL;
