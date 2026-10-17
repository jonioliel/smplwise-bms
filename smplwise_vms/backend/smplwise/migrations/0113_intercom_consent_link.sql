-- WA-CONSENT-LINK (docs/changes/CR-WA-CONSENT-LINK.md): opt-in consent by link for the people screen's WhatsApp messages. With the
-- administrator's `consent_by_link` on (default OFF), the first message to a person whose consent is unknown is a fixed, code-owned
-- consent request carrying a single-use signed link; the message the sender asked for waits here until the person answers.
-- Additive only (rollback = run the previous version; it ignores these tables). Number 0113 (provisional 0116 on
-- pilot/WA-CONSENT-LINK; renumbered at the integ/270 integration, 2.7.0 - the release set 0107..0114 is contiguous).
--
-- NEVER stored here: a phone number, a message text, the link's token (only its SHA-256), the person's name, a PIN.

-- One consent request = one link = one WhatsApp message. `id` is the HMAC input of the token (links.derive_token, domain `wac`,
-- generation 1, under the tickets module key `key_id`); the database keeps only `token_hash` (the public lookup key).
CREATE TABLE intercom_consent_requests (
  id             TEXT PRIMARY KEY,                    -- 32 lowercase hex (128 random bits)
  person_id      TEXT NOT NULL,                       -- WisKey's id of the person (a logical target, never a number)
  key_id         TEXT NOT NULL,                       -- the module key the token derives under (kept while the request is live)
  token_hash     TEXT NOT NULL UNIQUE,                -- sha256(token) hex
  created_at     TEXT NOT NULL,                       -- UTC
  expires_at     TEXT NOT NULL,                       -- UTC: created_at + consent_wait_days
  actor_user_id  TEXT NOT NULL,                       -- the sender whose message started it
  message_id     TEXT,                                -- the intercom_messages row of the consent message itself
  lang           TEXT NOT NULL DEFAULT 'he' CHECK (lang IN ('he', 'en', 'ar', 'ru')),
  state          TEXT NOT NULL DEFAULT 'sending' CHECK (state IN ('sending', 'open', 'granted', 'declined', 'expired', 'failed')),
  answered_at    TEXT,                                -- UTC: when the person pressed a button (single use)
  notice_version TEXT                                 -- the version of the notice text the person saw when answering
);
CREATE INDEX idx_intercom_consent_requests_person ON intercom_consent_requests (person_id, created_at DESC);
CREATE INDEX idx_intercom_consent_requests_live ON intercom_consent_requests (state, expires_at);

-- A consent GRANTED by link (a decline is written to intercom_message_optout, so the opt-out list keeps its meaning and its switch).
CREATE TABLE intercom_consent (
  person_id          TEXT PRIMARY KEY,
  state              TEXT NOT NULL CHECK (state IN ('granted')),
  at                 TEXT NOT NULL,                   -- UTC
  notice_version     TEXT NOT NULL,
  consent_request_id TEXT
);

-- The template messages that wait for the person's answer. Only TEMPLATE messages are held (the template body lives in the settings;
-- `body_hash` proves at release time that the text is still the one the sender saw). A free text is never stored, so never held.
CREATE TABLE intercom_held_messages (
  id                 TEXT PRIMARY KEY,                -- uuid4 hex
  consent_request_id TEXT NOT NULL,
  person_id          TEXT NOT NULL,
  actor_user_id      TEXT NOT NULL,
  actor_name         TEXT,
  actor_username     TEXT,
  actor_source       TEXT NOT NULL,                   -- the sender's principal source (the permission is checked again at release)
  template_id        TEXT NOT NULL,
  template_label     TEXT,
  body_hash          TEXT NOT NULL,                   -- sha256 of the template body the sender saw (never the rendered text)
  client_request_id  TEXT NOT NULL,
  request_id         TEXT,
  created_at         TEXT NOT NULL,
  state              TEXT NOT NULL DEFAULT 'held' CHECK (state IN ('held', 'due', 'releasing', 'released', 'dropped')),
  reason             TEXT,                            -- a word: declined | no_answer | template_changed | forbidden | ... (never a value)
  message_id         TEXT,                            -- the intercom_messages row of the released message
  done_at            TEXT,
  UNIQUE (actor_user_id, client_request_id)
);
CREATE INDEX idx_intercom_held_messages_request ON intercom_held_messages (consent_request_id);
CREATE INDEX idx_intercom_held_messages_state ON intercom_held_messages (state);
CREATE INDEX idx_intercom_held_messages_person ON intercom_held_messages (person_id, created_at DESC);
