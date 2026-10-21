-- Final number 0128 (CR-VENDORQ-294; built as PROVISIONAL 0129 on pilot/VENDORQ-294 over main 0123; renumbered at the 2.10.0 integration, integ/2100: 0124 = 2.9.2, 0125-0127 = 2.9.3).
-- docs/changes/CR-VENDORQ-294-DESIGN.md section 2. Three changes, ONE file, one transaction (db.migrate wraps it):
--
-- 1. ticket_outbox REBUILD (last rebuilt by 0089): the purpose `report` (a module's report to an external contact through the message
--    queue - owner item "sending to vendors through the message queue") and three nullable columns: `source_module` / `source_id` (the
--    module and its own row; a report row always names them, no other row ever does) and `document_id` (an outbound_documents row, no FK:
--    the purge order). Nothing references ticket_outbox by a foreign key, so the DROP cascades nothing. Every row, column and index is kept.
-- 2. ticket_rfq_messages REBUILD (0089 + the 0104 columns): author_kind gains `system` (CR-RFQ-PAYMENT-SCHEDULE D21 /
--    backlog rfq-thread-system-author); the system never writes an inbound line. The D21 rows (author_kind 'user', author_id 'system')
--    become author_kind 'system'. Nothing references ticket_rfq_messages by a foreign key; its own two FKs are re-declared identically.
-- 3. outbound_documents (new): a document snapshot (PDF / HTML, at most 2 MiB) reachable for a short time through a derived link
--    (`#d.<token>`, token domain `doc`; only sha256(token) is stored). The bytes are purged at expiry / revocation.
--
-- Times are UTC ISO-8601 `...Z` text, as everywhere in the tickets tables.

-- ---------------------------------------------------------------- 1. ticket_outbox

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
                                                       'phone_verify', 'report')),
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
       created_at, sent_at, updated_at, link_generation, rfq_id, NULL, NULL, NULL
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

-- ---------------------------------------------------------------- 2. ticket_rfq_messages

CREATE TABLE ticket_rfq_messages_new (
  id              TEXT PRIMARY KEY,
  rfq_id          TEXT NOT NULL REFERENCES ticket_rfqs(id) ON DELETE CASCADE,
  rfq_vendor_id   TEXT NOT NULL REFERENCES ticket_rfq_vendors(id) ON DELETE CASCADE,
  direction       TEXT NOT NULL CHECK (direction IN ('out', 'in')),
  body            TEXT NOT NULL,
  author_kind     TEXT NOT NULL CHECK (author_kind IN ('user', 'contact', 'system')),
  author_id       TEXT NOT NULL,
  source_kind     TEXT CHECK (source_kind IN ('award', 'clarify')),
  source_id       TEXT,
  notified        INTEGER NOT NULL DEFAULT 0 CHECK (notified IN (0, 1)),
  outbox_id       TEXT,
  created_at      TEXT NOT NULL,
  quote_id        TEXT,
  read_at         TEXT,
  read_by         TEXT,
  answered_at     TEXT,
  answered_by     TEXT,
  answer_id       TEXT,
  reminded_at     TEXT,
  answers_id      TEXT,
  broadcast_id    TEXT,
  CHECK (author_kind <> 'system' OR direction = 'out')
);
INSERT INTO ticket_rfq_messages_new (id, rfq_id, rfq_vendor_id, direction, body, author_kind, author_id, source_kind, source_id, notified,
                                     outbox_id, created_at, quote_id, read_at, read_by, answered_at, answered_by, answer_id, reminded_at,
                                     answers_id, broadcast_id)
SELECT id, rfq_id, rfq_vendor_id, direction, body,
       CASE WHEN author_kind = 'user' AND author_id = 'system' AND direction = 'out' THEN 'system' ELSE author_kind END,
       author_id, source_kind, source_id, notified, outbox_id, created_at, quote_id, read_at, read_by, answered_at, answered_by, answer_id,
       reminded_at, answers_id, broadcast_id
FROM ticket_rfq_messages;
DROP TABLE ticket_rfq_messages;
ALTER TABLE ticket_rfq_messages_new RENAME TO ticket_rfq_messages;
CREATE INDEX idx_ticket_rfq_messages_vendor ON ticket_rfq_messages (rfq_vendor_id, created_at);
CREATE INDEX idx_ticket_rfq_messages_pending ON ticket_rfq_messages (rfq_id, rfq_vendor_id) WHERE direction = 'in' AND answered_at IS NULL;

-- ---------------------------------------------------------------- 3. outbound_documents

CREATE TABLE outbound_documents (
  id              TEXT PRIMARY KEY CHECK (length(id) = 32 AND id NOT GLOB '*[^0-9a-f]*'),
  key_id          TEXT NOT NULL,
  token_hash      TEXT NOT NULL UNIQUE,
  module          TEXT NOT NULL CHECK (length(module) BETWEEN 1 AND 32 AND module NOT GLOB '*[^a-z_]*'),
  source_id       TEXT,
  recipient_kind  TEXT NOT NULL CHECK (recipient_kind IN ('contact', 'user')),
  recipient_id    TEXT NOT NULL,
  media_type      TEXT NOT NULL CHECK (media_type IN ('application/pdf', 'text/html')),
  filename        TEXT NOT NULL CHECK (length(filename) BETWEEN 5 AND 80),
  size_bytes      INTEGER NOT NULL CHECK (size_bytes BETWEEN 1 AND 2097152),
  sha256          TEXT NOT NULL,
  content         BLOB,
  max_opens       INTEGER NOT NULL CHECK (max_opens BETWEEN 1 AND 20),
  open_count      INTEGER NOT NULL DEFAULT 0 CHECK (open_count >= 0),
  first_opened_at TEXT,
  last_opened_at  TEXT,
  created_by      TEXT,
  created_at      TEXT NOT NULL,
  expires_at      TEXT NOT NULL,
  revoked_at      TEXT,
  revoked_reason  TEXT CHECK (revoked_reason IN ('manual', 'contact_changed', 'contact_erased', 'module_key', 'send_failed', 'source_cancelled')),
  purged_at       TEXT,
  CHECK (expires_at > created_at)
);
CREATE INDEX idx_outbound_documents_live ON outbound_documents (expires_at) WHERE purged_at IS NULL;
CREATE INDEX idx_outbound_documents_recipient ON outbound_documents (recipient_kind, recipient_id);
CREATE INDEX idx_outbound_documents_source ON outbound_documents (module, source_id);
