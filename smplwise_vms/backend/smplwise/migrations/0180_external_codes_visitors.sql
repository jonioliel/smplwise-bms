-- Number 0180 (built as PROVISIONAL on pilot/EXTERNALBUILD-297 from tag v2.23.2, where 0179 is the highest; confirmed at the
-- 2.24.1 integration, release/2241: 0179 is the highest on release/2240). The content does not depend on the number.
--
-- EXTERNALBUILD-297 (owner direction 2026-10-27, "full intake"; docs/changes/EXTERNALBUILD-297.md):
--  1. the one-time ("single entry") code option for a vendor's technician, beside the window code: `access_grants.code_mode`
--     ('window' = as before, the default; 'single_entry' = the grant ends after the first granted entry WisKey reports for the person at
--     one of the grant's doors - best effort, WisKey has no use-counted PIN) and `first_entry_at` (when that entry was seen);
--  2. the visitor flow on the same grant engine (CR-VISITOR105): one invitation = one access_grants row (source_kind 'manual',
--     source_ref NULL - it names a ticket elsewhere) + one `access_visitor_invites` row pointing at it; the visitor-specific reasons live on the invite (no rebuild of
--     access_grants - CR-VISITOR105 D3); `access_visitor_entries` = the entries WisKey reported for a visitor (ids only);
--     `access_station_visitor_entrance` = the per-station "visitor entrance" flag (D5).
-- Additive only: two columns with defaults (no table rebuild) and three new tables. Ids, codes and instants only - never a name, a phone,
-- a PIN or a token value. Nothing is read while the switches are off (`access.external_grants`, `access.visitors`, both default off).
-- Rollback = run the previous version: it never reads the new columns / tables. Before a downgrade run "revoke all" so no single-entry or
-- visitor PIN outlives the code that would end it (WisKey's validity window expires it anyway).
ALTER TABLE access_grants ADD COLUMN code_mode TEXT NOT NULL DEFAULT 'window' CHECK (code_mode IN ('window', 'single_entry'));
ALTER TABLE access_grants ADD COLUMN first_entry_at TEXT;

CREATE TABLE access_visitor_invites (
  id                 TEXT PRIMARY KEY,
  grant_id           TEXT NOT NULL UNIQUE REFERENCES access_grants(id) ON DELETE CASCADE,
  host_user_id       TEXT NOT NULL,
  visitor_contact_id TEXT NOT NULL,
  mode               TEXT NOT NULL CHECK (mode IN ('window', 'single_entry')),
  approval_kind      TEXT NOT NULL CHECK (approval_kind IN ('host_envelope', 'second_person')),
  purpose            TEXT NOT NULL CHECK (purpose IN ('guest', 'meeting', 'delivery', 'service', 'other')),
  token_sha256       TEXT CHECK (token_sha256 IS NULL OR length(token_sha256) = 64),
  token_expires_at   TEXT,
  message_state      TEXT NOT NULL DEFAULT 'pending' CHECK (message_state IN ('pending', 'sent', 'not_sent', 'unknown')),
  confirmed_at       TEXT,
  first_entry_at     TEXT,
  entries            INTEGER NOT NULL DEFAULT 0 CHECK (entries >= 0),
  end_reason         TEXT CHECK (end_reason IS NULL OR end_reason IN ('window_ended', 'single_entry_used', 'host_cancelled',
                       'manager_revoked', 'host_inactive', 'host_lost_permission', 'station_changed', 'visitor_erased',
                       'expired_unconfirmed', 'feature_off', 'refused', 'failed')),
  erase_due_at       TEXT,
  erased_at          TEXT,
  client_request_id  TEXT,
  created_at         TEXT NOT NULL,
  updated_at         TEXT NOT NULL,
  revision           INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX idx_avi_host ON access_visitor_invites (host_user_id, created_at);
CREATE INDEX idx_avi_contact ON access_visitor_invites (visitor_contact_id);
CREATE INDEX idx_avi_erase ON access_visitor_invites (erase_due_at) WHERE erased_at IS NULL;
CREATE UNIQUE INDEX idx_avi_token ON access_visitor_invites (token_sha256) WHERE token_sha256 IS NOT NULL;
CREATE UNIQUE INDEX idx_avi_client_request ON access_visitor_invites (host_user_id, client_request_id) WHERE client_request_id IS NOT NULL;

CREATE TABLE access_visitor_entries (
  invite_id          TEXT NOT NULL REFERENCES access_visitor_invites(id) ON DELETE CASCADE,
  event_id           TEXT NOT NULL,
  station_id         TEXT NOT NULL,
  door               INTEGER CHECK (door IS NULL OR door IN (1, 2)),
  result             TEXT NOT NULL CHECK (result IN ('granted', 'denied', 'attempt_limit')),
  event_at           TEXT NOT NULL,
  seen_at            TEXT NOT NULL,
  PRIMARY KEY (invite_id, event_id)
);

CREATE TABLE access_station_visitor_entrance (
  station_id         TEXT PRIMARY KEY,
  set_by             TEXT NOT NULL,
  set_at             TEXT NOT NULL
);
