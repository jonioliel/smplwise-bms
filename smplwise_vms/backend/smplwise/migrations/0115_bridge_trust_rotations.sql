-- 0115: the bridge trust-key rotations (CR-040, WXROT). Written as 0089 on pilot/WXROT-2411; renumbered on pilot/WXROT-REBASE
-- (onto integ/264, which ends at 0106; 0107-0114 are allocated to other branches), so this takes 0115.
-- One row per rotation request, keyed by the Arx-generated UUID that is never reused. The rows are the add-on's anti-replay record:
-- never deleted (trigger), the id never changed (trigger), a resolved row never re-opened (trigger). At most one row is open
-- (`dispatching` or `unknown`): `open_slot` is 1 exactly then and is UNIQUE. No key, salt, proof, nonce, signature or hash is ever
-- stored here (the pending key lives in the never-exported setting `bridge.trust.pending_key` while a row is open).
CREATE TABLE bridge_trust_rotations (
  request_id      TEXT PRIMARY KEY,
  initiator_id    TEXT NOT NULL,
  initiator_name  TEXT,
  epoch_from      INTEGER NOT NULL CHECK (epoch_from >= 1),
  epoch_to        INTEGER NOT NULL CHECK (epoch_to = epoch_from + 1),
  state           TEXT NOT NULL CHECK (state IN ('dispatching', 'unknown', 'rotated', 'not_rotated', 'superseded')),
  code            TEXT,
  open_slot       INTEGER CHECK (open_slot IS NULL OR open_slot = 1),
  requested_at    TEXT NOT NULL,
  resolved_at     TEXT,
  status_checks   INTEGER NOT NULL DEFAULT 0,
  last_check_at   TEXT,
  CHECK ((state IN ('dispatching', 'unknown')) = (open_slot IS NOT NULL))
);
CREATE UNIQUE INDEX ux_bridge_trust_rotations_open ON bridge_trust_rotations(open_slot);
CREATE INDEX ix_bridge_trust_rotations_requested ON bridge_trust_rotations(requested_at);
CREATE TRIGGER tr_bridge_trust_rotations_no_delete BEFORE DELETE ON bridge_trust_rotations
BEGIN
  SELECT RAISE(ABORT, 'bridge_trust_rotations rows are never deleted');
END;
CREATE TRIGGER tr_bridge_trust_rotations_fixed_id BEFORE UPDATE OF request_id ON bridge_trust_rotations
WHEN NEW.request_id IS NOT OLD.request_id
BEGIN
  SELECT RAISE(ABORT, 'a rotation request id never changes');
END;
CREATE TRIGGER tr_bridge_trust_rotations_never_reopened BEFORE UPDATE OF state ON bridge_trust_rotations
WHEN OLD.state IN ('rotated', 'not_rotated', 'superseded') AND NEW.state IS NOT OLD.state
BEGIN
  SELECT RAISE(ABORT, 'a resolved rotation is never re-opened');
END;
