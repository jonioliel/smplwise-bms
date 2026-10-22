-- WKB-295 (WisKey T05). PROVISIONAL NUMBER 0146: the lead renumbers at integration (contiguous sequence rule); the content does not
-- depend on the number.
--
-- wiskey_intent_originals  the FULL original of one WisKey people write, its SHA-256 and the verified writer context it was admitted
--                          under, recorded in the SAME committed transaction as its `wiskey_fence_intents` row and BEFORE any I/O
--                          (services/wiskey_intents.admit_with_original). One row per intent, written once, never updated, never
--                          deleted (triggers). An intent WITHOUT a row here (every row admitted before this migration, or through
--                          the older `admit`) stays UNKNOWN for good: nothing reconstructs, replays or re-creates its original.
--   Contents: canonical JSON (sorted keys, compact, UTF-8; `canonicalization` names the rule). The writer refuses PIN / card / password
--   / token keys, so no secret is stored here; names and other personal fields of the original MAY be stored (this changes the 0145
--   rule "no payload, no payload hash" for this one table - recorded in docs/changes/WKB-295-T05.md, pending owner + WisKey agreement).
--
-- Also: the exact-original selector columns of wiskey_fence_intents become immutable (CR-ACR7-FENCE-02 section 3 asked for this
-- trigger; 0145 did not carry it). Only state / reason / settlement columns may still change.
-- Rollback: older code never reads this table; drop the table and the three triggers. Rows that exist must first be reconciled by
-- the exact-original resolve (they are the only durable copy of what was sent).

CREATE TABLE wiskey_intent_originals (
  repository_id     TEXT NOT NULL,
  query_owner_ref   TEXT NOT NULL,
  operation_id      TEXT NOT NULL,
  canonicalization  TEXT NOT NULL CHECK (canonicalization = 'arx-json-c14n-v1'),
  original_json     TEXT NOT NULL CHECK (length(original_json) BETWEEN 2 AND 65536),
  original_sha256   TEXT NOT NULL CHECK (length(original_sha256) = 64 AND original_sha256 NOT GLOB '*[^0-9a-f]*'),
  context_json      TEXT NOT NULL CHECK (length(context_json) BETWEEN 2 AND 4096),
  context_sha256    TEXT NOT NULL CHECK (length(context_sha256) = 64 AND context_sha256 NOT GLOB '*[^0-9a-f]*'),
  recorded_at       TEXT NOT NULL,
  PRIMARY KEY (repository_id, query_owner_ref, operation_id),
  FOREIGN KEY (repository_id, query_owner_ref, operation_id) REFERENCES wiskey_fence_intents (repository_id, query_owner_ref, operation_id)
);

CREATE TRIGGER wiskey_intent_originals_immutable BEFORE UPDATE ON wiskey_intent_originals
BEGIN
  SELECT RAISE(ABORT, 'wiskey_intent_originals is immutable');
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
