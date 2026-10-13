-- CR-036 WA (the people screen's WhatsApp messages; docs/changes/CR-036-WA-NOTES.md): the record of the messages Arx handed to the
-- messaging service, and the list of people who asked not to receive any. Additive only (rollback = run the previous version; the
-- tables are ignored by it). Number 0076: the next free number on this line (scripts/release_check.py requires a contiguous sequence);
-- the door path (CR-033) brings 0077 / 0078 and follows it. RENUMBER AT MERGE if another slice took 0076 first.
--
-- NEVER stored here: the message text (a free text may be typed by a person who should not be typing credentials, and a template's
-- body is in the settings), a phone number, a PIN or card, WisKey's one-use token. A message is recorded as: who sent it, to which
-- person (WisKey's id - a logical target, never a number), which template (or "free"), how many characters, and what happened.

CREATE TABLE intercom_messages (
  id                TEXT PRIMARY KEY,                 -- uuid4 hex; also the `message_id` the audit rows carry
  at                TEXT NOT NULL,                    -- UTC: when the attempt was recorded (BEFORE anything is sent)
  actor_user_id     TEXT NOT NULL,                    -- the Arx user who pressed "send" (the real initiator)
  actor_name        TEXT,                             -- name snapshot, so a removed user still reads in the history
  person_id         TEXT NOT NULL,                    -- the recipient, as WisKey identifies them
  kind              TEXT NOT NULL CHECK (kind IN ('template', 'free')),
  template_id       TEXT,                             -- NULL for a free text
  template_label    TEXT,                             -- label snapshot (the template may be renamed or removed later)
  template_revision INTEGER,                          -- the revision of the template catalogue the sender saw
  chars             INTEGER NOT NULL,                 -- length of the text as sent - the text itself is never kept
  bulk_id           TEXT,                             -- one id for every message of one "send to the selection" run
  client_request_id TEXT NOT NULL,                    -- the browser's id of this attempt (a duplicate is refused)
  request_id        TEXT,                             -- the HTTP correlation id (the audit rows carry the same one)
  outcome           TEXT NOT NULL DEFAULT 'pending' CHECK (outcome IN ('pending', 'sent', 'refused', 'unknown')),
  reason            TEXT,                             -- the code of a refusal / an unknown outcome (a word, never a value)
  done_at           TEXT,                             -- UTC: when the outcome was recorded
  UNIQUE (actor_user_id, client_request_id)
);
CREATE INDEX idx_intercom_messages_person ON intercom_messages (person_id, at DESC);
CREATE INDEX idx_intercom_messages_at ON intercom_messages (at);
CREATE INDEX idx_intercom_messages_bulk ON intercom_messages (bulk_id) WHERE bulk_id IS NOT NULL;

-- People who asked not to receive messages (the consent model WisKey has not answered yet, ask W11): a message to one of them is
-- refused (409 message_no_consent) whatever WisKey says. Set and cleared by a holder of access.people.message, each change audited.
CREATE TABLE intercom_message_optout (
  person_id  TEXT PRIMARY KEY,
  at         TEXT NOT NULL,
  by_user_id TEXT,
  by_name    TEXT
);
