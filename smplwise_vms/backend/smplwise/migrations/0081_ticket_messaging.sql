-- CR-038 slice 5b (docs/changes/CR-038-TICKETS-MODULE.md section 7.3): the ticket outbox and the inbound log of the ticket message
-- channel (WhatsApp through ha-whatsapp, e-mail as the fallback). Additive only; nothing here is read while `tickets.enabled` is off.
--
-- ticket_outbox: every outbound message is WRITTEN first (in the transaction of the act that causes it), then sent by the one
-- `tickets-outbox` worker. No phone number, e-mail address, link token or verification code is stored: the recipient is read from
-- the directory at send time, the link URL is derived from (link_id, generation), a code's six digits are derived from `code_id`
-- (the ticket_link_codes row) at render time (code review W9), and params_json never holds {link} / {code}. The WhatsApp account is
-- written when the worker CLAIMS the row (`sending`), never at queue time (9.9.4, D27) - except a per-account test send.
-- Columns added to the spec's table (the message core's notes, section 4): held_since (the hold_when_down_min clock),
-- first_attempt_at (the 30-minute retry span), resend_of ("שלח שוב" of an unknown / failed row), code_id (W9), idempotency_key
-- (a repeated enqueue returns the first row) and send_now (D29: a person released the send hours).
--
-- ticket_inbound: one row per inbound WhatsApp event that passed the account filter (9.6). The raw event is never stored; the
-- sender is an HMAC (`sender_key`), never the number; `content` is kept ONLY for ambiguous / note / late replies (<= 1000 chars,
-- Cc / Cf stripped). Added to the spec's table: assignment_id, reason, candidates_json (the candidate tickets and departments of an
-- ambiguous reply: who may claim it), claimed_by / claimed_at (claim-before-reveal, review T13-2) and handled_kind.
-- Operational data: not project-backup tables; retention 90 days (outbox) / 30 days (inbound), janitor `tickets.messaging`.
-- Numbering: 0079 slice 1, 0080 slice 4, 0081 slice 5b, 0082 slice 5a (the spec's reservation); independent of 0080 / 0082.
CREATE TABLE ticket_outbox (
  id                  TEXT PRIMARY KEY,
  ticket_id           TEXT REFERENCES tickets(id) ON DELETE SET NULL,
  assignment_id       TEXT,
  link_id             TEXT,                          -- the worker derives the URL from (link_id, generation) at send time
  recipient_kind      TEXT NOT NULL CHECK (recipient_kind IN ('contact', 'test')),
  contact_id          TEXT,                          -- phone / e-mail are read from the directory at send time, never copied here
  channel             TEXT NOT NULL CHECK (channel IN ('whatsapp', 'email')),
  purpose             TEXT NOT NULL CHECK (purpose IN ('assign', 'reminder', 'code', 'closed', 'reassigned', 'reopened',
                                                       'update', 'cost_rejected', 'cost_approved', 'cost_reopened', 'test')),
  use_key             TEXT NOT NULL,                 -- 'tickets.messages' | 'tickets.codes' (WhatsApp rows); 'email' otherwise
  department_id       TEXT,                          -- the per-department account override (resolved at claim time)
  account_key         TEXT,                          -- written when the worker claims the row; NULL for e-mail rows
  template_id         TEXT,
  template_revision   INTEGER,
  params_json         TEXT NOT NULL DEFAULT '{}',    -- placeholders except {link} and {code}; never a phone, token or code
  state               TEXT NOT NULL CHECK (state IN ('queued', 'held', 'sending', 'sent', 'refused', 'unknown', 'not_sent',
                                                     'cancelled', 'superseded')),
  held_reason         TEXT CHECK (held_reason IN ('send_hours', 'channel_down', 'account_unmapped', 'module_off')),
  held_since          TEXT,
  attempts            INTEGER NOT NULL DEFAULT 0,
  first_attempt_at    TEXT,
  not_before          TEXT NOT NULL,                 -- send hours (D4) move it to the window's next opening
  priority            INTEGER NOT NULL DEFAULT 1,    -- 0 = code / test, 1 = assign / update / reopened, 2 = reminder / closed / reassigned
  outcome_code        TEXT,                          -- 'ha_unavailable', 'service_not_found', 'timeout', 'no_phone', ...
  provider_message_id TEXT,                          -- whatsapp send_message response (UNVERIFIED shape, section 9.3)
  reply_nonce         TEXT UNIQUE,                   -- 64-bit random (16 hex), in button ids 't:<nonce>:<action>'
  fallback_of         TEXT,                          -- the failed outbox row this one replaces
  resend_of           TEXT,                          -- "שלח שוב": the row it repeats (that row keeps its state)
  code_id             TEXT,                          -- purpose 'code': the ticket_link_codes row; digits derived at render time
  idempotency_key     TEXT,
  send_now            INTEGER NOT NULL DEFAULT 0,    -- D29
  requested_by        TEXT,                          -- users.id, 'system' or 'link:<id6>'
  created_at          TEXT NOT NULL,
  sent_at             TEXT,
  updated_at          TEXT NOT NULL
);
CREATE INDEX idx_ticket_outbox_queue ON ticket_outbox (state, priority, not_before) WHERE state IN ('queued', 'held', 'sending');
CREATE INDEX idx_ticket_outbox_ticket ON ticket_outbox (ticket_id, created_at);
CREATE INDEX idx_ticket_outbox_contact_sent ON ticket_outbox (contact_id, sent_at) WHERE state = 'sent';
CREATE INDEX idx_ticket_outbox_provider ON ticket_outbox (provider_message_id) WHERE provider_message_id IS NOT NULL;
CREATE INDEX idx_ticket_outbox_channel_sent ON ticket_outbox (channel, sent_at) WHERE state IN ('sent', 'unknown');
CREATE INDEX idx_ticket_outbox_account_sent ON ticket_outbox (account_key, sent_at) WHERE account_key IS NOT NULL;
CREATE INDEX idx_ticket_outbox_updated ON ticket_outbox (updated_at);
CREATE UNIQUE INDEX idx_ticket_outbox_idempotency ON ticket_outbox (idempotency_key) WHERE idempotency_key IS NOT NULL;

CREATE TABLE ticket_inbound (
  id               TEXT PRIMARY KEY,
  received_at      TEXT NOT NULL,                    -- when Arx got the event
  provider_at      TEXT,                             -- the event's own timestamp
  event_type       TEXT NOT NULL,                    -- whatsapp_message_received | whatsapp_button_pressed
  msg_type         TEXT,                             -- chat | button_reply | list_reply | ...
  sender_key       TEXT,                             -- HMAC(k_tickets, digits(sender_number)) - never the number; NULL for LID senders
  account_key      TEXT,                             -- 'entry:<entry_id>' when the event carries entry_id, else NULL
  dedupe_key       TEXT NOT NULL UNIQUE,             -- sha256(account | sender | provider_at | type | selected_id | content)
  contact_id       TEXT,
  ticket_id        TEXT,
  assignment_id    TEXT,
  outbox_id        TEXT,
  result           TEXT NOT NULL CHECK (result IN ('status', 'note', 'late', 'ignored', 'ambiguous', 'unknown_sender', 'stale',
                                                   'duplicate', 'refused')),
  reason           TEXT,                             -- why ignored / refused / stale / a note instead of a status
  action           TEXT,                             -- acknowledged | in_progress
  content          TEXT,                             -- ONLY for 'ambiguous' / 'note' / 'late' (<= 1000, plain, Cc/Cf stripped)
  candidates_json  TEXT NOT NULL DEFAULT '{}',       -- ambiguous: {"tickets": [...], "departments": [...]} - who may claim it
  claimed_by       TEXT,                             -- the manager who pressed "זה שלי" (the text is revealed to them only)
  claimed_at       TEXT,
  handled_by       TEXT,                             -- the manager who attached or dismissed an ambiguous reply
  handled_at       TEXT,
  handled_kind     TEXT CHECK (handled_kind IN ('attached', 'dismissed', 'expired'))
);
CREATE INDEX idx_ticket_inbound_open ON ticket_inbound (result, received_at) WHERE result = 'ambiguous' AND handled_at IS NULL;
CREATE INDEX idx_ticket_inbound_ticket ON ticket_inbound (ticket_id, received_at);
CREATE INDEX idx_ticket_inbound_received ON ticket_inbound (received_at);
