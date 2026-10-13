-- CR-038 slice 4 (docs/changes/CR-038-TICKETS-MODULE.md section 7.2; slice 7 uses the code tables): the contact / vendor
-- directory of people who are not users, the handler links of external assignments, their code sessions, verification codes,
-- wrong-code windows, the access log the manager sees under "opened" and the e-mail redeem ids. Additive only: nothing here is
-- read while the module switch `tickets.enabled` is off.
--
-- Secrets are never stored: a link keeps sha256(token) only (the token is derived from (id, generation) under the module key),
-- a code keeps HMAC(k, link | generation | code), a session and a redeem id keep their sha256. Every row that depends on the
-- module key names it (`key_id`, `phone_key_id`; code review V4: a key rotation re-derives under a staged key in one
-- transaction and no crash point strands a row). Codes, their send caps and the wrong-code window are per link GENERATION
-- (code review V8): the manager's "new link" starts clean by construction.
-- Times are UTC ISO-8601 `...Z` text like every other table of the module.

CREATE TABLE ticket_contacts (
  id               TEXT PRIMARY KEY,
  kind             TEXT NOT NULL CHECK (kind IN ('person', 'vendor')),
  vendor_id        TEXT REFERENCES ticket_contacts(id),
  user_id          TEXT,
  display_name     TEXT NOT NULL,
  company          TEXT NOT NULL DEFAULT '',
  phone_e164       TEXT,
  phone_key        TEXT,
  phone_key_id     TEXT,
  email            TEXT,
  preferred_channel TEXT NOT NULL DEFAULT 'whatsapp' CHECK (preferred_channel IN ('whatsapp', 'email', 'manual')),
  require_code     INTEGER NOT NULL DEFAULT 0 CHECK (require_code IN (0, 1)),
  share_history    INTEGER CHECK (share_history IN (0, 1)),
  lang             TEXT NOT NULL DEFAULT 'he' CHECK (lang IN ('he', 'en', 'ar', 'ru')),
  notes            TEXT NOT NULL DEFAULT '',
  active           INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  created_by       TEXT NOT NULL,
  created_at       TEXT NOT NULL,
  updated_at       TEXT NOT NULL,
  last_assigned_at TEXT,
  erased_at        TEXT,
  revision         INTEGER NOT NULL DEFAULT 1,
  CHECK (kind = 'person' OR vendor_id IS NULL)
);
CREATE INDEX idx_ticket_contacts_phone ON ticket_contacts (phone_key) WHERE phone_key IS NOT NULL AND erased_at IS NULL;
CREATE INDEX idx_ticket_contacts_vendor ON ticket_contacts (vendor_id);
CREATE UNIQUE INDEX idx_ticket_contacts_user ON ticket_contacts (user_id) WHERE user_id IS NOT NULL AND erased_at IS NULL;
CREATE INDEX idx_ticket_contacts_name ON ticket_contacts (display_name);

CREATE TABLE ticket_contact_departments (
  contact_id    TEXT NOT NULL REFERENCES ticket_contacts(id) ON DELETE CASCADE,
  department_id TEXT NOT NULL REFERENCES ticket_departments(id) ON DELETE CASCADE,
  PRIMARY KEY (contact_id, department_id)
);
CREATE INDEX idx_ticket_contact_departments_dept ON ticket_contact_departments (department_id);

CREATE TABLE ticket_links (
  id               TEXT PRIMARY KEY,
  ticket_id        TEXT NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  assignment_id    TEXT NOT NULL REFERENCES ticket_assignments(id) ON DELETE CASCADE,
  contact_id       TEXT NOT NULL REFERENCES ticket_contacts(id),
  generation       INTEGER NOT NULL DEFAULT 1 CHECK (generation >= 1),
  key_id           TEXT NOT NULL,
  token_hash       TEXT NOT NULL UNIQUE,
  require_code     INTEGER NOT NULL CHECK (require_code IN (0, 1)),
  sent_via         TEXT CHECK (sent_via IN ('whatsapp', 'email', 'manual')),
  created_at       TEXT NOT NULL,
  expires_at       TEXT NOT NULL,
  cap_at           TEXT NOT NULL,
  grace_until      TEXT,
  revoked_at       TEXT,
  revoked_reason   TEXT CHECK (revoked_reason IN ('closed', 'cancelled', 'reassigned', 'returned', 'not_mine', 'manual',
                                                'resent', 'module_key', 'contact_changed', 'contact_erased')),
  first_opened_at  TEXT,
  last_opened_at   TEXT,
  open_count       INTEGER NOT NULL DEFAULT 0,
  update_count     INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_ticket_links_ticket ON ticket_links (ticket_id);
CREATE UNIQUE INDEX idx_ticket_links_assignment ON ticket_links (assignment_id);
CREATE INDEX idx_ticket_links_contact ON ticket_links (contact_id) WHERE revoked_at IS NULL;
CREATE INDEX idx_ticket_links_expiry ON ticket_links (expires_at) WHERE revoked_at IS NULL;
CREATE INDEX idx_ticket_links_key ON ticket_links (key_id);

CREATE TABLE ticket_link_sessions (
  id_hash      TEXT PRIMARY KEY,
  link_id      TEXT NOT NULL REFERENCES ticket_links(id) ON DELETE CASCADE,
  generation   INTEGER NOT NULL,
  created_at   TEXT NOT NULL,
  expires_at   TEXT NOT NULL
);
CREATE INDEX idx_ticket_link_sessions_link ON ticket_link_sessions (link_id);
CREATE INDEX idx_ticket_link_sessions_expiry ON ticket_link_sessions (expires_at);

CREATE TABLE ticket_link_codes (
  id            TEXT PRIMARY KEY,
  link_id       TEXT NOT NULL REFERENCES ticket_links(id) ON DELETE CASCADE,
  generation    INTEGER NOT NULL,
  code_hash     TEXT NOT NULL,
  channel       TEXT NOT NULL CHECK (channel IN ('whatsapp', 'email')),
  created_at    TEXT NOT NULL,
  expires_at    TEXT NOT NULL,
  attempts      INTEGER NOT NULL DEFAULT 0,
  consumed_at   TEXT,
  outbox_id     TEXT
);
CREATE INDEX idx_ticket_link_codes_link ON ticket_link_codes (link_id, generation, created_at DESC);
CREATE INDEX idx_ticket_link_codes_expiry ON ticket_link_codes (expires_at);

CREATE TABLE ticket_link_failures (
  link_id      TEXT NOT NULL REFERENCES ticket_links(id) ON DELETE CASCADE,
  generation   INTEGER NOT NULL,
  window_start TEXT NOT NULL,
  failures     INTEGER NOT NULL DEFAULT 0,
  locked_until TEXT,
  PRIMARY KEY (link_id, generation)
);

CREATE TABLE ticket_link_access (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  link_id     TEXT NOT NULL REFERENCES ticket_links(id) ON DELETE CASCADE,
  at          TEXT NOT NULL,
  kind        TEXT NOT NULL CHECK (kind IN ('open', 'update', 'code_ok', 'code_bad', 'locked')),
  client_key  TEXT NOT NULL
);
CREATE INDEX idx_ticket_link_access_link ON ticket_link_access (link_id, at);
CREATE INDEX idx_ticket_link_access_at ON ticket_link_access (at);

CREATE TABLE ticket_link_redeems (
  id_hash      TEXT PRIMARY KEY,
  link_id      TEXT NOT NULL REFERENCES ticket_links(id) ON DELETE CASCADE,
  generation   INTEGER NOT NULL,
  created_at   TEXT NOT NULL,
  expires_at   TEXT NOT NULL,
  uses         INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_ticket_link_redeems_link ON ticket_link_redeems (link_id);
CREATE INDEX idx_ticket_link_redeems_expiry ON ticket_link_redeems (expires_at);
