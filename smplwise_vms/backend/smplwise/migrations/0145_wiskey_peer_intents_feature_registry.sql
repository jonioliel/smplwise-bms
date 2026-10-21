-- Final number 0145 (built as PROVISIONAL 0137 on pilot/ECCACT-295; renumbered at the 2.11.0 integration, integ/2111). The content does not depend on the number.
--
-- ECCACT-295: the durable half of the WisKey peer / feature seam. No table here carries a secret, a key, a PIN, a card number, a name,
-- a phone, a CSV/media payload or a payload hash - ids, refs, revisions, states, codes and times only. None is a backup table.
--
--  wiskey_fence_intents   one immutable intent per WisKey people write (and per create), written BEFORE the frame leaves Arx.
--                         The exact-original references (repository, query owner ref, operation, request, origin, peer binding + revision)
--                         never change; `state` moves intent -> sent -> one terminal fact (committed | never_committed | unknown, unknown
--                         can later become a terminal fact only through the exact-original resolve) and never back. A created person's id
--                         is recorded only from a verified exact-original resolution.
--  wiskey_relay_map       Arx's record of which API relay of a station is which physical relay, with a revision. Rows are written only
--                         by an explicit operator/owner action (never derived silently); the feature policy hands them to WisKey.
--  wiskey_feature_registry  one row per WisKey feature (door_windows, emergency_buttons, door_automations, people_csv, live_media,
--                         live_validation): the owner-provisioned binding revision Arx expects and the host registration state.
--                         `registered` is a FACT Arx records only after a verified answer from the host; `enabled` is the switch.
--  wiskey_feature_intents one durable attempt per feature request (request_id unique): saved before any I/O, never replayed;
--                         the outcome stays `unknown` until a verified answer says otherwise.
-- Rollback: older code never reads these tables; dropping them loses only intent history (which, if rows exist, must first be
-- reconciled by the exact-original resolve).

CREATE TABLE wiskey_fence_intents (
  repository_id        TEXT NOT NULL,
  query_owner_ref      TEXT NOT NULL,
  operation_id         TEXT NOT NULL CHECK (length(operation_id) BETWEEN 1 AND 128),
  request_id           TEXT NOT NULL CHECK (length(request_id) BETWEEN 1 AND 128),
  origin_ref           TEXT NOT NULL CHECK (length(origin_ref) BETWEEN 1 AND 128),
  operation_binding_ref TEXT NOT NULL CHECK (length(operation_binding_ref) BETWEEN 1 AND 128),
  peer_binding_ref     TEXT NOT NULL CHECK (length(peer_binding_ref) BETWEEN 1 AND 128),
  peer_binding_revision INTEGER NOT NULL CHECK (peer_binding_revision BETWEEN 1 AND 9007199254740991),
  issued_epoch         INTEGER NOT NULL CHECK (issued_epoch BETWEEN 1 AND 9007199254740991),
  command              TEXT NOT NULL,
  is_create            INTEGER NOT NULL CHECK (is_create IN (0, 1)),
  user_id              TEXT,
  revision_before      INTEGER CHECK (revision_before IS NULL OR revision_before BETWEEN 1 AND 9007199254740991),
  journal_op_id        TEXT,
  state                TEXT NOT NULL CHECK (state IN ('intent', 'sent', 'committed', 'never_committed', 'unknown')),
  reason_code          TEXT,
  created_user_id      TEXT,
  revision_after       INTEGER CHECK (revision_after IS NULL OR revision_after BETWEEN 1 AND 9007199254740991),
  created_at           TEXT NOT NULL,
  sent_at              TEXT,
  settled_at           TEXT,
  PRIMARY KEY (repository_id, query_owner_ref, operation_id),
  UNIQUE (repository_id, request_id),
  UNIQUE (repository_id, origin_ref),
  CHECK (is_create = 0 OR (user_id IS NULL AND revision_before IS NULL)),
  CHECK (is_create = 1 OR (user_id IS NOT NULL AND revision_before IS NOT NULL)),
  CHECK (state <> 'committed' OR (revision_after IS NOT NULL AND (created_user_id IS NOT NULL OR is_create = 0)))
);
-- one central transition per person revision: two operations can never both be 'committed' from the same revision (OneCommitLedger, durable)
CREATE UNIQUE INDEX wiskey_fence_one_transition ON wiskey_fence_intents(repository_id, user_id, revision_before) WHERE state = 'committed' AND is_create = 0;
CREATE UNIQUE INDEX wiskey_fence_one_created_person ON wiskey_fence_intents(repository_id, created_user_id) WHERE state = 'committed' AND is_create = 1;
CREATE INDEX wiskey_fence_open ON wiskey_fence_intents(state) WHERE state IN ('intent', 'sent', 'unknown');

CREATE TABLE wiskey_relay_map (
  station_id       TEXT NOT NULL CHECK (length(station_id) BETWEEN 1 AND 128),
  api_relay        INTEGER NOT NULL CHECK (api_relay IN (1, 2)),
  physical_relay   INTEGER NOT NULL CHECK (physical_relay IN (1, 2)),
  revision         INTEGER NOT NULL CHECK (revision BETWEEN 1 AND 9007199254740991),
  active           INTEGER NOT NULL CHECK (active IN (0, 1)),
  confirmed_by     TEXT NOT NULL,                       -- the Arx user id who confirmed the mapping (audit); never a token
  updated_at       TEXT NOT NULL,
  PRIMARY KEY (station_id, api_relay)
);

CREATE TABLE wiskey_feature_registry (
  feature              TEXT PRIMARY KEY CHECK (feature IN ('door_windows', 'emergency_buttons', 'door_automations', 'people_csv', 'live_media', 'live_validation')),
  enabled              INTEGER NOT NULL DEFAULT 0 CHECK (enabled IN (0, 1)),
  peer_binding_ref     TEXT,
  peer_binding_revision INTEGER CHECK (peer_binding_revision IS NULL OR peer_binding_revision BETWEEN 1 AND 9007199254740991),
  host_registered      INTEGER NOT NULL DEFAULT 0 CHECK (host_registered IN (0, 1)),
  host_checked_at      TEXT,
  host_code            TEXT,
  updated_at           TEXT NOT NULL
);

CREATE TABLE wiskey_feature_intents (
  request_id           TEXT PRIMARY KEY CHECK (length(request_id) BETWEEN 1 AND 128),
  operation_id         TEXT NOT NULL UNIQUE,
  operation_binding_ref TEXT NOT NULL,
  feature              TEXT NOT NULL,
  actor_kind           TEXT NOT NULL CHECK (actor_kind IN ('human', 'automation')),
  actor_ref            TEXT NOT NULL,
  authority_ref        TEXT NOT NULL,
  authority_revision   INTEGER NOT NULL CHECK (authority_revision BETWEEN 1 AND 9007199254740991),
  scope_ref            TEXT NOT NULL,
  parameter_reference  TEXT NOT NULL,
  issued_at            TEXT NOT NULL,
  request_expires_at   TEXT NOT NULL,
  execution_expires_at TEXT NOT NULL,
  state                TEXT NOT NULL CHECK (state IN ('intent', 'sent', 'accepted', 'refused', 'unknown')),
  code                 TEXT,
  created_at           TEXT NOT NULL,
  settled_at           TEXT
);
CREATE INDEX wiskey_feature_intents_open ON wiskey_feature_intents(feature, state) WHERE state IN ('intent', 'sent', 'unknown');

INSERT INTO wiskey_feature_registry (feature, enabled, updated_at) VALUES
  ('door_windows', 0, '1970-01-01T00:00:00Z'), ('emergency_buttons', 0, '1970-01-01T00:00:00Z'), ('door_automations', 0, '1970-01-01T00:00:00Z'),
  ('people_csv', 0, '1970-01-01T00:00:00Z'), ('live_media', 0, '1970-01-01T00:00:00Z'), ('live_validation', 0, '1970-01-01T00:00:00Z');
