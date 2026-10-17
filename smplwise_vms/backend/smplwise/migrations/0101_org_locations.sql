-- CR-ORG-LOCATIONS (owner request 2026-10-17, docs/changes/CR-ORG-LOCATIONS.md): the organisation's locations - addresses defined once
-- in Settings > service management, picked in the request-for-quotation and service-request creation forms instead of free text.
-- Migration 0101 (provisional 0101 on pilot/ORGLOC, confirmed at the integ/264 integration). Additive only: one new table,
-- nullable columns on existing tables, no row rewritten. Old free-text places stay valid.
--
-- A request keeps a REFERENCE (`location_id`) AND a SNAPSHOT (`location_snapshot`, JSON: name, street, city, details, lat, lng) taken at
-- creation, so a later edit of the location never rewrites history. A referenced location is never hard-deleted (deactivated instead);
-- the plain REFERENCES clause makes a hard delete of a referenced row fail even if the service check were bypassed.
-- `plan_zone_id` is reserved (owner answer 17.10 (a)): a later, optional link from a location to a plan area / room. Not read yet.
-- Nothing here is read while the module switch `tickets.enabled` is off.

CREATE TABLE ticket_org_locations (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  street        TEXT NOT NULL DEFAULT '',
  city          TEXT NOT NULL DEFAULT '',
  details       TEXT NOT NULL DEFAULT '',
  lat           REAL CHECK (lat IS NULL OR (lat >= -90 AND lat <= 90)),
  lng           REAL CHECK (lng IS NULL OR (lng >= -180 AND lng <= 180)),
  active        INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  is_default    INTEGER NOT NULL DEFAULT 0 CHECK (is_default IN (0, 1)),
  sort_order    INTEGER NOT NULL DEFAULT 0,
  plan_zone_id  TEXT,
  created_by    TEXT NOT NULL,
  created_at    TEXT NOT NULL,
  updated_by    TEXT,
  updated_at    TEXT NOT NULL,
  revision      INTEGER NOT NULL DEFAULT 1,
  CHECK ((lat IS NULL) = (lng IS NULL)),
  CHECK (is_default = 0 OR active = 1)
);
CREATE UNIQUE INDEX idx_ticket_org_locations_name ON ticket_org_locations (name COLLATE NOCASE);
CREATE UNIQUE INDEX idx_ticket_org_locations_default ON ticket_org_locations (is_default) WHERE is_default = 1;
CREATE INDEX idx_ticket_org_locations_order ON ticket_org_locations (active, sort_order, name);

ALTER TABLE tickets ADD COLUMN location_id TEXT REFERENCES ticket_org_locations(id);
ALTER TABLE tickets ADD COLUMN location_snapshot TEXT;
ALTER TABLE ticket_rfqs ADD COLUMN location_id TEXT REFERENCES ticket_org_locations(id);
ALTER TABLE ticket_rfqs ADD COLUMN location_snapshot TEXT;
-- owner answer 17.10 (c): the navigation link goes into the vendor messages of THIS request only when the manager switched it on
ALTER TABLE ticket_rfqs ADD COLUMN location_nav INTEGER NOT NULL DEFAULT 0 CHECK (location_nav IN (0, 1));
-- owner answer 17.10 (b): an optional per-department default (overrides the organisation default); NULL = none
ALTER TABLE ticket_departments ADD COLUMN default_location_id TEXT REFERENCES ticket_org_locations(id);

CREATE INDEX idx_tickets_location ON tickets (location_id) WHERE location_id IS NOT NULL;
CREATE INDEX idx_ticket_rfqs_location ON ticket_rfqs (location_id) WHERE location_id IS NOT NULL;
