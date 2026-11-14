-- CR-038 slice 5a (section 7.3A, owned by services/messaging_accounts.py): the shared per-ACCOUNT WhatsApp send ledger.
-- One row per send that may have left (outcome sent or unknown): the pacing budget of an account (minimum gap, per hour, per day,
-- per recipient) is counted here, shared by every use and every module that sends from that account. No phone number is stored:
-- recipient_key = HMAC(k_messaging, digits) with the separate key <data>/secrets/messaging_key. Accounts, labels, pacing values and
-- the use mapping are NOT here: they live in the settings document `messaging.whatsapp` (revision-checked, backup.SETTINGS_KEEP).
-- Operational data: not a project-backup table; the janitor prunes rows older than 2 days (the longest pacing window is one day).
-- Numbering: 0079 slice 1, 0080 slice 4, 0081 slice 5b, 0082 slice 5a (the spec's reservation); independent of 0080 / 0081.
CREATE TABLE messaging_send_ledger (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  account_key    TEXT NOT NULL,                     -- 'entry:<config_entry_id>' | 'manual:<id>' (9.9.1)
  use_key        TEXT NOT NULL,                     -- 'tickets.messages', 'tickets.codes', later other modules' uses
  recipient_key  TEXT NOT NULL,                     -- HMAC(k_messaging, digits) - never the number
  kind           TEXT NOT NULL CHECK (kind IN ('message', 'code', 'test')),
  at             TEXT NOT NULL                      -- UTC ISO-8601 with milliseconds and Z
);
CREATE INDEX idx_messaging_ledger_account ON messaging_send_ledger (account_key, at);
CREATE INDEX idx_messaging_ledger_recipient ON messaging_send_ledger (account_key, recipient_key, at);
