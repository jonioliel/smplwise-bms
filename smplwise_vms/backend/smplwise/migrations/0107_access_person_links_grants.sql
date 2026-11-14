-- CR-ARX-WISKEY-SHARED-IDENTITY (docs/changes/CR-ARX-WISKEY-SHARED-IDENTITY.md sections 2.2 and 2.5; owner answers 2026-10-17):
-- one person in Arx and in WisKey as a LINK, not a merge, and the time-bounded door grants of external people.
-- Final number 0107 (provisional 0108 on pilot/WISKEYID-BUILD; renumbered at the integ/270 integration, 2.7.0).
--
-- Additive only. Nothing here is read while the switch `access.external_grants` is off (default), and the switch cannot be
-- turned on in this build (services/access_grants.GO_LIVE_PERMITTED is False). Ids only in both tables: never a name, a phone
-- number, a PIN, its hash or length, a card number or mask (CR 2.5 last line).
--
-- Deviation from the CR's sketch (recorded in the build notes): a grant names its SUBJECT (`subject_kind`, `subject_id`) and the
-- link is filled at provisioning (`link_id` nullable), because a request from the vendor page exists before any WisKey person
-- does; the one-live-grant index is therefore on the subject (owner answer 12: one live grant per person).
--
-- Rollback: additive; older code ignores both tables. WisKey persons provisioned through them keep their own validity and expire
-- on their own (D6); run "end all external grants" before a downgrade so their PINs are removed too (CR section 7).

CREATE TABLE access_person_links (
  id                 TEXT PRIMARY KEY,                 -- uuid4 hex
  subject_kind       TEXT NOT NULL CHECK (subject_kind IN ('user', 'contact')),
  subject_id         TEXT NOT NULL,                    -- users.id | ticket_contacts.id (kind 'person' only, enforced in code)
  wiskey_person_id   TEXT NOT NULL CHECK (length(wiskey_person_id) BETWEEN 1 AND 128),
  origin             TEXT NOT NULL CHECK (origin IN ('created_from_arx', 'matched')),
  employee_no        TEXT,                             -- 'x' + 12 hex Arx wrote for a person it created; NULL when matched
  linked_by          TEXT NOT NULL,                    -- users.id of the human who linked (or 'system:provisioning')
  linked_at          TEXT NOT NULL,
  last_pushed_rev    INTEGER,                          -- WisKey revision after Arx's last write (drift detection, T12)
  state              TEXT NOT NULL DEFAULT 'linked' CHECK (state IN ('linked', 'unlinking', 'wiskey_missing')),
  revision           INTEGER NOT NULL DEFAULT 1
);
CREATE UNIQUE INDEX idx_apl_subject ON access_person_links (subject_kind, subject_id);
CREATE UNIQUE INDEX idx_apl_wiskey ON access_person_links (wiskey_person_id);

CREATE TABLE access_grants (
  id                  TEXT PRIMARY KEY,                -- uuid4 hex; in the audit and (first 8) in the code message's reference
  subject_kind        TEXT NOT NULL CHECK (subject_kind IN ('user', 'contact')),
  subject_id          TEXT NOT NULL,
  link_id             TEXT REFERENCES access_person_links(id) ON DELETE SET NULL,
  source_kind         TEXT NOT NULL CHECK (source_kind IN ('manual', 'ticket', 'rfq_order')),
  source_ref          TEXT,                            -- ticket id (ids only)
  assignment_id       TEXT,                            -- the external assignment the request came through (vendor page)
  outside_window      INTEGER NOT NULL DEFAULT 0 CHECK (outside_window IN (0, 1)),
  doors_json          TEXT NOT NULL,                   -- {station_id: [relay, ...]} - explicit, never "all"; '{}' only while requested
  valid_from          TEXT NOT NULL,                   -- UTC instants (...Z); chosen in the installation's IANA zone
  valid_until         TEXT NOT NULL,
  timing_json         TEXT,                            -- optional daily hours: a WisKey timing schedule (intercom_writes.timing_draft)
  credential          TEXT NOT NULL CHECK (credential IN ('pin', 'card', 'none')),
  state               TEXT NOT NULL CHECK (state IN ('requested', 'approved', 'provisioning', 'active', 'revoking', 'ended',
                                                     'revoked', 'refused', 'failed', 'unknown')),
  pending_json        TEXT,                            -- a requested WIDENING of an approved grant, waiting for a new approval
  needs_push          INTEGER NOT NULL DEFAULT 0 CHECK (needs_push IN (0, 1)),  -- a narrowing of an active grant not yet in WisKey
  pushed              INTEGER NOT NULL DEFAULT 0 CHECK (pushed IN (0, 1)),      -- a WisKey write may have happened for this grant
  requested_by        TEXT NOT NULL,                   -- users.id, or 'contact:<id>' when the request came from a vendor page
  approved_by         TEXT,
  approved_at         TEXT,
  approval_revision   INTEGER,                         -- permission_revision at approval / last re-decision (CR 3.5)
  phone_confirmed_at  TEXT,                            -- the contact's phone_confirmed_at at approval: a number change clears it (R3)
  wiskey_revision     INTEGER,                         -- WisKey person revision after Arx's last write
  provision_attempts  INTEGER NOT NULL DEFAULT 0,
  provision_after     TEXT,                            -- E1: the next provisioning attempt (WisKey unreachable)
  code_state          TEXT CHECK (code_state IN ('not_needed', 'pending', 'queued', 'sent', 'not_delivered', 'unknown')),
  code_due_at         TEXT,                            -- when the code message is due (owner answer 4: the evening before)
  code_sends          INTEGER NOT NULL DEFAULT 0 CHECK (code_sends >= 0),
  last_code_at        TEXT,
  revoking_since      TEXT,
  revoke_attempts     INTEGER NOT NULL DEFAULT 0,
  alerted_at          TEXT,                            -- the managers were told about this grant's attention state (once)
  end_reason          TEXT CHECK (end_reason IS NULL OR end_reason IN ('ended', 'manual', 'contact_inactive', 'contact_erased',
                                  'contact_changed', 'vendor_inactive', 'ticket_ended', 'ticket_reassigned', 'rfq_ended',
                                  'approver_lost_authority', 'unlinked', 'wiskey_missing', 'station_changed', 'feature_off',
                                  'emergency', 'person_deleted', 'refused', 'failed')),
  created_at          TEXT NOT NULL,
  updated_at          TEXT NOT NULL,
  ended_at            TEXT,
  revision            INTEGER NOT NULL DEFAULT 1,
  CHECK (valid_until > valid_from)
);
CREATE UNIQUE INDEX idx_grants_one_live ON access_grants (subject_kind, subject_id)
  WHERE state IN ('requested', 'approved', 'provisioning', 'active', 'revoking', 'unknown');
CREATE INDEX idx_grants_state ON access_grants (state, updated_at);
CREATE INDEX idx_grants_source ON access_grants (source_ref) WHERE source_ref IS NOT NULL;
CREATE INDEX idx_grants_link ON access_grants (link_id) WHERE link_id IS NOT NULL;
