-- Final number 0127 (built as PROVISIONAL 0130 on pilot/ACCESSREQ-293; renumbered at the 2.9.3 integration, integ/293: 0125 is the
-- temperature phase 3, 0126 the external-access identity of SHAREDID-293, which this branch builds on). The content does not
-- depend on the number.
--
-- ACCESSREQ-293 (owner-approved mockup private/planning/mockup_access_request_2026-10-20, owner decisions 2026-10-20): the manual
-- "request external access" form.
--  - `purpose` (optional, at most 200 characters) and `notes` (internal, at most 1000 characters, never in a message to the person,
--    never audited) on the grant. Both are checked in services/access_request.py; they go with the row at retention.
--  - `scope_requested_by`: who asked for the scope that now waits for a decision (the request, a replacement of a still-requested
--    scope, or a widening of a decided grant). Owner decision (a): that person may not approve it - a second person must, except a
--    system administrator. NULL on older rows = the grant's `requested_by`.
--  - the privacy-notice tick may be given by the REQUESTER at request time (`via = 'requester'`), so a later approver does not have to
--    tick again. SQLite cannot widen a CHECK in place: access_grant_notices is rebuilt with the same columns and rows (nothing refers
--    to it; it refers to access_grants only).
--
-- Additive for access_grants (three nullable columns); the notices table keeps every row. Nothing here is read while
-- `access.external_grants` is off (and it cannot be turned on in this build).
-- Rollback: older code ignores the three columns; a 'requester' notice row is read by older code as "a notice exists" (the same
-- meaning), and the older CHECK only matters to new inserts, which older code never makes with 'requester'.

ALTER TABLE access_grants ADD COLUMN purpose TEXT;              -- optional, <= 200 characters (checked in code)
ALTER TABLE access_grants ADD COLUMN notes TEXT;                -- internal, <= 1000 characters (checked in code), never in a message
ALTER TABLE access_grants ADD COLUMN scope_requested_by TEXT;   -- users.id or 'contact:<id>' of who asked for the scope awaiting a decision

CREATE TABLE access_grant_notices_new (
  grant_id      TEXT NOT NULL REFERENCES access_grants(id) ON DELETE CASCADE,
  version       TEXT NOT NULL CHECK (length(version) BETWEEN 1 AND 16),
  via           TEXT NOT NULL CHECK (via IN ('page', 'approver', 'requester')),
  by_ref        TEXT NOT NULL,                         -- 'contact:<id>' (page) or users.id (approver, requester)
  at            TEXT NOT NULL,
  PRIMARY KEY (grant_id, via)
);
INSERT INTO access_grant_notices_new(grant_id, version, via, by_ref, at) SELECT grant_id, version, via, by_ref, at FROM access_grant_notices;
DROP TABLE access_grant_notices;
ALTER TABLE access_grant_notices_new RENAME TO access_grant_notices;
