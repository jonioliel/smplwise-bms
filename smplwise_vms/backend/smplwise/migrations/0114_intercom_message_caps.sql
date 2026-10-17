-- CR-036 WA, the 2.6.5 security review of the people-messaging surface (findings F3, F6): the per-recipient and per-station caps and
-- the opt-out that follows the phone number. Additive only (rollback = run the previous version; it ignores the new columns).
-- Number 0114 (provisional 0117 on pilot/WA-SEND-FIX; renumbered at the integ/270 integration, 2.7.0).
--
-- `phone_hash` is an HMAC-SHA256 of the normalised number under a random per-installation key (setting `access.messaging.phone_key`,
-- never served by GET /settings): it lets Arx say "the same number" without keeping one. Still NEVER stored here: a number, a text,
-- a PIN or WisKey's token. `station_ids` is the JSON list of the stations the person was assigned to when the message was recorded
-- (the per-station hourly cap counts it; WisKey's ids, not names).

ALTER TABLE intercom_messages ADD COLUMN phone_hash TEXT;
ALTER TABLE intercom_messages ADD COLUMN station_ids TEXT;
CREATE INDEX idx_intercom_messages_actor ON intercom_messages (actor_user_id, at);
CREATE INDEX idx_intercom_messages_phone ON intercom_messages (phone_hash, at) WHERE phone_hash IS NOT NULL;

ALTER TABLE intercom_message_optout ADD COLUMN phone_hash TEXT;
CREATE INDEX idx_intercom_message_optout_phone ON intercom_message_optout (phone_hash) WHERE phone_hash IS NOT NULL;
