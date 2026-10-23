-- IDENT146 (docs/changes/CR-IDENT146.md): purge of Arx-only (local) accounts disabled / deleted for 30 days.
-- Final number 0147 (built as PROVISIONAL 0150; renumbered at the 2.14.0 integration, release/2140). Additive only: one nullable column.
-- `purged_at` marks the tombstone row the purge leaves behind (the id must keep resolving for audit rows, ticket authorship and grants);
-- it is never read while `privacy.local_purge` is `off` (the default).
ALTER TABLE users ADD COLUMN purged_at TEXT;
