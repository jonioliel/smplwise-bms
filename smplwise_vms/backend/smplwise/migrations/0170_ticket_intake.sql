-- CR-INTAKE99 (docs/changes/CR-INTAKE99.md) as answered by the owner 2026-10-24 (questions 143-156, follow-up 267): phases 1-3 only -
-- free-text WhatsApp requests become DRAFTS that a human approves; only numbers on a managed list may open one.
-- Final number 0170 (built as PROVISIONAL 0198; renumbered at the 2.16.0 integration, release/2160). Everything here is inert while
-- tickets.enabled or intake.enabled is off. No public surface: no requester sessions, codes or tokens (owner 156: decided later).
--
-- 1. ticket_intake_known    the managed list of numbers that may open a request by WhatsApp (owner 146): number, HMAC match key, last four
--                           digits for display. A listed person is NOT added to the contact directory (owner 151).
-- 2. ticket_intake_drafts   one draft per message burst of a known number; text, suggestion and the handler's working values.
-- 3. ticket_intake_lexicon  the configurer's own synonyms / seed-domain -> category mapping (the rules are editable data).
-- 4. ticket_intake_feedback per-field counts of suggestion vs final value (no text, no number).
-- 5. ticket_intake_blocks   30-day sender blocks set by a handler.
-- 6. ticket_intake_unlisted daily counts of messages from numbers that are not on the list (owner 267: a daily summary to the list manager).
-- 7. ticket_inbound.intake_draft_id
-- 8. ticket_outbox rebuilt ONLY to add the purpose 'intake_reply' to its CHECK (the 0089 / 0128 pattern, same columns, same indexes).
--    COLLISION RISK: any other open branch that also rebuilds ticket_outbox must be folded by the integrator (union of the purpose lists).
--
-- Times are UTC ISO-8601 `...Z` text, as everywhere in the tickets tables.

CREATE TABLE ticket_intake_known (
  id           TEXT PRIMARY KEY,
  phone_key    TEXT NOT NULL,                  -- HMAC(k_tickets, digits) under the module key
  key_id       TEXT,
  phone_e164   TEXT NOT NULL,                  -- the managed list holds the number (a reply goes to it); shown masked (last four)
  last4        TEXT NOT NULL,
  display_name TEXT NOT NULL,
  org          TEXT NOT NULL DEFAULT '',       -- company / apartment / unit, free text for the handler
  lang         TEXT NOT NULL DEFAULT 'he' CHECK (lang IN ('he', 'en', 'ar', 'ru')),
  active       INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  created_by   TEXT NOT NULL,
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL,
  revision     INTEGER NOT NULL DEFAULT 1
);
CREATE UNIQUE INDEX idx_intake_known_phone ON ticket_intake_known (phone_key) WHERE active = 1;

CREATE TABLE ticket_intake_drafts (
  id                TEXT PRIMARY KEY,
  channel           TEXT NOT NULL DEFAULT 'whatsapp' CHECK (channel IN ('whatsapp')),
  state             TEXT NOT NULL DEFAULT 'open' CHECK (state IN ('open', 'approved', 'merged', 'rejected', 'expired')),
  revision          INTEGER NOT NULL DEFAULT 1,
  received_at       TEXT NOT NULL,
  last_message_at   TEXT NOT NULL,
  message_count     INTEGER NOT NULL DEFAULT 1 CHECK (message_count BETWEEN 1 AND 10),
  text              TEXT,                      -- cleaned; NULLed by the retention step
  sender_key        TEXT,                      -- HMAC match key (never the number)
  known_id          TEXT,                      -- the list row (name shown to the handler)
  account_key       TEXT,
  suggestion_json   TEXT NOT NULL DEFAULT '{}',
  edited_json       TEXT NOT NULL DEFAULT '{}',
  urgency_key       TEXT,
  flags             TEXT NOT NULL DEFAULT '[]',
  decided_by        TEXT,
  decided_at        TEXT,
  reject_reason     TEXT CHECK (reject_reason IS NULL OR reject_reason IN
                      ('not_a_request', 'duplicate', 'spam', 'abusive', 'out_of_scope', 'test')),
  ticket_id         TEXT
);
CREATE INDEX idx_intake_open ON ticket_intake_drafts (state, urgency_key, received_at) WHERE state = 'open';
CREATE INDEX idx_intake_sender ON ticket_intake_drafts (sender_key, received_at) WHERE sender_key IS NOT NULL;

CREATE TABLE ticket_intake_lexicon (
  id          TEXT PRIMARY KEY,
  kind        TEXT NOT NULL CHECK (kind IN ('category', 'place', 'urgency', 'stop', 'domain_map')),
  target_id   TEXT NOT NULL DEFAULT '',        -- category id / org location id / priority key (urgent | high | low) / seed domain
  phrase      TEXT NOT NULL,
  norm        TEXT NOT NULL,
  created_by  TEXT NOT NULL,
  created_at  TEXT NOT NULL,
  UNIQUE (kind, norm, target_id)
);

CREATE TABLE ticket_intake_feedback (
  draft_id    TEXT NOT NULL,
  field       TEXT NOT NULL,
  suggested   TEXT,
  final       TEXT,
  confidence  TEXT,
  rules       TEXT NOT NULL DEFAULT '[]',
  at          TEXT NOT NULL,
  PRIMARY KEY (draft_id, field)
);

CREATE TABLE ticket_intake_blocks (
  sender_key  TEXT PRIMARY KEY,
  until       TEXT NOT NULL,
  by_user     TEXT NOT NULL,
  at          TEXT NOT NULL
);

CREATE TABLE ticket_intake_unlisted (
  day         TEXT NOT NULL,                   -- UTC date
  sender_key  TEXT NOT NULL,
  last4       TEXT NOT NULL,
  attempts    INTEGER NOT NULL DEFAULT 1,
  replied     INTEGER NOT NULL DEFAULT 0 CHECK (replied IN (0, 1)),
  PRIMARY KEY (day, sender_key)
);

ALTER TABLE ticket_inbound ADD COLUMN intake_draft_id TEXT;

-- ---------------------------------------------------------------- ticket_outbox: purpose 'intake_reply'

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
                                                       'phone_verify', 'report', 'intake_reply')),
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
  code_id             TEXT,
  idempotency_key     TEXT,
  send_now            INTEGER NOT NULL DEFAULT 0,
  requested_by        TEXT,
  created_at          TEXT NOT NULL,
  sent_at             TEXT,
  updated_at          TEXT NOT NULL,
  link_generation     INTEGER CHECK (link_generation IS NULL OR link_generation >= 1),
  rfq_id              TEXT,
  source_module       TEXT CHECK (source_module IS NULL OR (length(source_module) BETWEEN 1 AND 32
                                                            AND source_module NOT GLOB '*[^a-z_]*')),
  source_id           TEXT CHECK (source_id IS NULL OR length(source_id) BETWEEN 1 AND 64),
  document_id         TEXT,
  CHECK ((purpose = 'report') = (source_module IS NOT NULL AND source_id IS NOT NULL))
);
INSERT INTO ticket_outbox_new (id, ticket_id, assignment_id, link_id, recipient_kind, contact_id, channel, purpose, use_key, department_id,
                               account_key, template_id, template_revision, params_json, state, held_reason, held_since, attempts,
                               first_attempt_at, not_before, priority, outcome_code, provider_message_id, reply_nonce, fallback_of,
                               resend_of, code_id, idempotency_key, send_now, requested_by, created_at, sent_at, updated_at,
                               link_generation, rfq_id, source_module, source_id, document_id)
SELECT id, ticket_id, assignment_id, link_id, recipient_kind, contact_id, channel, purpose, use_key, department_id, account_key,
       template_id, template_revision, params_json, state, held_reason, held_since, attempts, first_attempt_at, not_before, priority,
       outcome_code, provider_message_id, reply_nonce, fallback_of, resend_of, code_id, idempotency_key, send_now, requested_by,
       created_at, sent_at, updated_at, link_generation, rfq_id, source_module, source_id, document_id
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
CREATE INDEX idx_ticket_outbox_source ON ticket_outbox (source_module, source_id) WHERE source_module IS NOT NULL;
