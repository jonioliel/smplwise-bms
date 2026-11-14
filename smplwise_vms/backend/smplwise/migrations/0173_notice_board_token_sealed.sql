-- NOTICEPERM-295: the TV link is permanent. The board token is also kept sealed (services/connection_store, AEAD bound to the board id)
-- so an administrator can copy the SAME link again. token_hash stays the only thing the TV feed checks. NULL = a board saved before this
-- migration (hash only): it shows an "issue link" action once, which creates the stored token a single time.
ALTER TABLE notice_boards ADD COLUMN token_sealed TEXT;
