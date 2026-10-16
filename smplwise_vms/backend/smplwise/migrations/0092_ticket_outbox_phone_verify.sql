-- TKNOTIFOTP: the outbox purpose `phone_verify` (the fixed number-verification code message; migration 0091 holds the rest).
-- PROVISIONAL NUMBER: the lead renumbers at integration (contiguous sequence rule).
--
-- INTEGRATION NOTE: TKRFQ1 (pilot/TKRFQ1-core, its 0089) rebuilds `ticket_outbox` as well (the rfq_* purposes and the `rfq_id`
-- column). This file is written against the integ/260 shape (0081 + 0086 `link_generation`). Whichever of the two rebuilds runs
-- LAST must carry the union: if this one is applied after TKRFQ1's, add `rfq_id` (and its index idx_ticket_outbox_rfq) and the
-- rfq_* purposes below; if TKRFQ1's runs after this one, add 'phone_verify' to its purpose list. Nothing else changes here.
--
-- SQLite cannot widen a CHECK in place, so the table is rebuilt with every column, row and index kept. Nothing references
-- ticket_outbox by a foreign key (ticket_link_codes.outbox_id is plain text), so the DROP cascades nothing.

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
  code_id             TEXT,                          -- purpose 'code': the ticket_link_codes row; 'phone_verify': the ticket_phone_verifications row
  idempotency_key     TEXT,
  send_now            INTEGER NOT NULL DEFAULT 0,
  requested_by        TEXT,
  created_at          TEXT NOT NULL,
  sent_at             TEXT,
  updated_at          TEXT NOT NULL,
  link_generation     INTEGER CHECK (link_generation IS NULL OR link_generation >= 1)
);
INSERT INTO ticket_outbox_new (id, ticket_id, assignment_id, link_id, recipient_kind, contact_id, channel, purpose, use_key, department_id,
                               account_key, template_id, template_revision, params_json, state, held_reason, held_since, attempts,
                               first_attempt_at, not_before, priority, outcome_code, provider_message_id, reply_nonce, fallback_of,
                               resend_of, code_id, idempotency_key, send_now, requested_by, created_at, sent_at, updated_at, link_generation)
SELECT id, ticket_id, assignment_id, link_id, recipient_kind, contact_id, channel, purpose, use_key, department_id, account_key,
       template_id, template_revision, params_json, state, held_reason, held_since, attempts, first_attempt_at, not_before, priority,
       outcome_code, provider_message_id, reply_nonce, fallback_of, resend_of, code_id, idempotency_key, send_now, requested_by,
       created_at, sent_at, updated_at, link_generation
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
