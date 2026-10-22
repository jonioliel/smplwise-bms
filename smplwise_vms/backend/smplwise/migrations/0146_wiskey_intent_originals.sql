-- WKB-295 (WisKey T05) + WKB2-295 (owner decision 2026-10-23). PROVISIONAL NUMBER 0146: the lead renumbers at integration
-- (contiguous sequence rule); the content does not depend on the number.
--
-- wiskey_intent_originals  the FULL original of one WisKey people write, its SHA-256 and the verified writer context it was admitted
--                          under, recorded in the SAME committed transaction as its `wiskey_fence_intents` row and BEFORE any I/O
--                          (services/wiskey_intents.admit_with_original). One row per intent. An intent WITHOUT a readable original
--                          here (every row admitted before this migration, one admitted through the older `admit`, one purged, or a
--                          database restored without its key) stays UNKNOWN for good: nothing reconstructs, replays or re-creates it.
--   Protection (owner decision 2026-10-23):
--   - person REFERENCES only: the writer refuses display names and contact fields (and, as before, PIN / card / password / token keys);
--   - `original_enc` / `context_enc` are SEALED at rest with the same mechanism as the bridge keys (services/connection_store, AES-256-GCM,
--     the per-install key file keys/connections.key, `v1:` blobs, associated data bound to this intent and field). The two SHA-256
--     values are computed over the canonical PLAINTEXT before sealing and stay in clear as the proof of what was sent;
--   - retention: once the intent is terminal (committed / never_committed) and the retention window has passed
--     (`wiskey.intent_original_retention_days`, default 30, clamped 1..365), the purge (services/wiskey_intent_retention) NULLs both
--     sealed columns and stamps `purged_at`. The row, both hashes and the intent's terminal state stay as proof. That purge is the ONLY
--     update this table accepts (trigger below, which also re-checks: terminal intent, at least one day after its terminal fact,
--     nothing else changes, once only). Rows are never deleted;
--   - backup: never in an Arx backup export, never touched by a restore (services/backup.NEVER_EXPORTED_TABLES).
--   This changes the 0145 rule "no payload, no payload hash" for this one table (docs/changes/WKB-295-T05.md).
--
-- Also: the exact-original selector columns of wiskey_fence_intents become immutable (CR-ACR7-FENCE-02 section 3 asked for this
-- trigger; 0145 did not carry it). Only state / reason / settlement columns may still change.
-- Rollback: older code never reads this table; drop the table and the three triggers. Open rows must first be reconciled by the
-- exact-original resolve (they are the only durable copy of what was sent).

CREATE TABLE wiskey_intent_originals (
  repository_id     TEXT NOT NULL,
  query_owner_ref   TEXT NOT NULL,
  operation_id      TEXT NOT NULL,
  canonicalization  TEXT NOT NULL CHECK (canonicalization = 'arx-json-c14n-v1'),
  original_enc      TEXT CHECK (original_enc IS NULL OR (substr(original_enc, 1, 3) = 'v1:' AND length(original_enc) BETWEEN 40 AND 120000)),
  original_sha256   TEXT NOT NULL CHECK (length(original_sha256) = 64 AND original_sha256 NOT GLOB '*[^0-9a-f]*'),
  context_enc       TEXT CHECK (context_enc IS NULL OR (substr(context_enc, 1, 3) = 'v1:' AND length(context_enc) BETWEEN 40 AND 8000)),
  context_sha256    TEXT NOT NULL CHECK (length(context_sha256) = 64 AND context_sha256 NOT GLOB '*[^0-9a-f]*'),
  recorded_at       TEXT NOT NULL,
  purged_at         TEXT CHECK (purged_at IS NULL OR julianday(purged_at) IS NOT NULL),
  PRIMARY KEY (repository_id, query_owner_ref, operation_id),
  FOREIGN KEY (repository_id, query_owner_ref, operation_id) REFERENCES wiskey_fence_intents (repository_id, query_owner_ref, operation_id),
  CHECK ((purged_at IS NULL AND original_enc IS NOT NULL AND context_enc IS NOT NULL)
         OR (purged_at IS NOT NULL AND original_enc IS NULL AND context_enc IS NULL))
);

-- The only allowed UPDATE: the purge of a terminal intent, at least one day (0.999 d: float tolerance) after its terminal fact, nulling both sealed columns and
-- stamping purged_at once, every other column unchanged. Anything else (and anything the condition cannot evaluate) is refused.
CREATE TRIGGER wiskey_intent_originals_guarded BEFORE UPDATE ON wiskey_intent_originals
WHEN NOT coalesce((
  OLD.purged_at IS NULL AND OLD.original_enc IS NOT NULL
  AND NEW.purged_at IS NOT NULL AND NEW.original_enc IS NULL AND NEW.context_enc IS NULL
  AND NEW.repository_id IS OLD.repository_id AND NEW.query_owner_ref IS OLD.query_owner_ref AND NEW.operation_id IS OLD.operation_id
  AND NEW.canonicalization IS OLD.canonicalization AND NEW.original_sha256 IS OLD.original_sha256
  AND NEW.context_sha256 IS OLD.context_sha256 AND NEW.recorded_at IS OLD.recorded_at
  AND EXISTS (SELECT 1 FROM wiskey_fence_intents f
              WHERE f.repository_id = OLD.repository_id AND f.query_owner_ref = OLD.query_owner_ref AND f.operation_id = OLD.operation_id
                AND f.state IN ('committed', 'never_committed') AND f.settled_at IS NOT NULL
                AND julianday(NEW.purged_at) - julianday(f.settled_at) >= 0.999)
), 0)
BEGIN
  SELECT RAISE(ABORT, 'wiskey_intent_originals: only the purge of a terminal intent past its retention is allowed');
END;

CREATE TRIGGER wiskey_intent_originals_kept BEFORE DELETE ON wiskey_intent_originals
BEGIN
  SELECT RAISE(ABORT, 'wiskey_intent_originals is never deleted');
END;

CREATE TRIGGER wiskey_fence_intents_selectors_immutable
BEFORE UPDATE OF repository_id, query_owner_ref, operation_id, request_id, origin_ref, operation_binding_ref, peer_binding_ref,
                 peer_binding_revision, issued_epoch, command, is_create, user_id, revision_before, journal_op_id, created_at
ON wiskey_fence_intents
BEGIN
  SELECT RAISE(ABORT, 'wiskey_fence_intents selectors are immutable');
END;
