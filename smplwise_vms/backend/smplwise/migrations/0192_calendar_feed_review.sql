-- CAL-FEED-REVIEW-2351 (docs/changes/CAL-FEED-REVIEW-2351.md): the outgoing iCal feed after its security review (contract 15.6 / 15.11).
-- Number 0192 = the next after the highest on release/2350-train (0191); if another branch departs first the lead re-sequences at
-- assembly (train-departure order, no gaps).
-- Additive only: two columns on cal_feeds. Rollback = leave them (nothing else reads them) or rebuild cal_feeds without them.
--   remote_enabled - may this feed's address answer on the remote channel (the tunnel). 0 by default: the remote channel answers the
--                    uniform 404 exactly as before; switched only from a local session by the feed's creator or an administrator, audited.
--   token_set_at   - when the current token was issued (create / rotate); the age limit `feed_max_age_days` counts from here
--                    (NULL on rows made before this migration: their created_at counts).

ALTER TABLE cal_feeds ADD COLUMN remote_enabled INTEGER NOT NULL DEFAULT 0 CHECK (remote_enabled IN (0, 1));
ALTER TABLE cal_feeds ADD COLUMN token_set_at TEXT;
