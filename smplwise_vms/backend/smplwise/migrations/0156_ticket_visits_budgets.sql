-- Final number 0156 (built as PROVISIONAL 0155 on pilot/SVC215-295; renumbered at the 2.15.0 integration, release/2150 - the content does not depend on the number).
--
-- CR-SVC215 slice 1 (docs/changes/CR-SVC215.md sections 3, 4, 6, 12; owner answers 2026-10-24 items 27-37): the service-module
-- upgrades' two new tables and two department columns. The CR planned two files (0150 visits, 0151 budgets); they are one file
-- here so the renumbering moves one number.
--
-- 1. `ticket_visits`: one row per planned presence of a vendor in the building (sources: the vendor's ETA on his page, the
--    confirmed RFQ arrival, the arrival step's day and hours, a manager). The vendor's "I arrived" is a CLAIM (`arrived_by =
--    vendor_link`); staff marks (`staff`) and a door credential (`door`, when external grants go live) are the other signals. The
--    janitor's detector turns a `planned` visit whose window + grace passed into `missed`. No position data of any kind.
-- 2. `ticket_departments.visit_grace_min` (NULL = the installation default `visits.grace_min`, 60 minutes by the owner's answer)
--    and `visit_detect` (1 = the missed-arrival detector looks at this department's visits).
-- 3. `ticket_budgets`: a budget per scope (owner answer 34: a department, the whole installation, a site, a building or a
--    category), period (year / quarter / month, `period_start` = the local first day) and currency - money in minor units, one
--    currency per row, never summed across currencies. `alert_state` remembers the last state notified (warning / exceeded), so a
--    crossing notifies once and a fall back resolves it. A budget is a management number, never a lock (owner answer 33).
--
-- Additive only: nothing here is read while `tickets.enabled` or the owning switch (`visits.enabled`, `budgets.enabled` in the
-- `tickets.settings` document) is off. Rollback: the switches off (data kept, routes 404, the detector idle); an older build
-- ignores the tables and the columns. Ticket tables stay out of project backups (backup.PROJECT_TABLES), like the module's others.

CREATE TABLE ticket_visits (
  id                  TEXT PRIMARY KEY,
  ticket_id           TEXT NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  assignment_id       TEXT,
  department_id       TEXT NOT NULL,
  contact_id          TEXT,
  vendor_id           TEXT,
  planned_from        TEXT NOT NULL,
  planned_to          TEXT NOT NULL,
  source              TEXT NOT NULL CHECK (source IN ('vendor_eta', 'rfq_terms', 'manager', 'vendor_arrival_step')),
  grace_min           INTEGER NOT NULL CHECK (grace_min BETWEEN 0 AND 240),
  state               TEXT NOT NULL CHECK (state IN ('planned', 'arrived', 'missed', 'cancelled', 'done')),
  claimed_at          TEXT,
  arrived_at          TEXT,
  arrived_by          TEXT CHECK (arrived_by IN ('vendor_link', 'staff', 'door')),
  arrived_actor       TEXT,
  late                INTEGER NOT NULL DEFAULT 0 CHECK (late IN (0, 1)),
  claim_undone_at     TEXT,
  claim_undone_by     TEXT,
  missed_at           TEXT,
  missed_notified_at  TEXT,
  vendor_messaged_at  TEXT,
  rescheduled_to      TEXT,
  cancelled_at        TEXT,
  cancelled_by        TEXT,
  created_by_kind     TEXT NOT NULL CHECK (created_by_kind IN ('user', 'contact', 'system')),
  created_by          TEXT,
  revision            INTEGER NOT NULL DEFAULT 1,
  created_at          TEXT NOT NULL,
  updated_at          TEXT NOT NULL,
  CHECK (planned_to >= planned_from)
);
CREATE UNIQUE INDEX idx_ticket_visits_planned_assignment ON ticket_visits (assignment_id) WHERE state = 'planned' AND assignment_id IS NOT NULL;
CREATE INDEX idx_ticket_visits_ticket ON ticket_visits (ticket_id, planned_from);
CREATE INDEX idx_ticket_visits_due ON ticket_visits (planned_to) WHERE state = 'planned';
CREATE INDEX idx_ticket_visits_vendor ON ticket_visits (vendor_id, planned_from);

ALTER TABLE ticket_departments ADD COLUMN visit_grace_min INTEGER CHECK (visit_grace_min IS NULL OR visit_grace_min BETWEEN 0 AND 240);
ALTER TABLE ticket_departments ADD COLUMN visit_detect INTEGER NOT NULL DEFAULT 1 CHECK (visit_detect IN (0, 1));

CREATE TABLE ticket_budgets (
  id            TEXT PRIMARY KEY,
  scope_kind    TEXT NOT NULL CHECK (scope_kind IN ('installation', 'department', 'site', 'building', 'category')),
  scope_id      TEXT NOT NULL,             -- '*' for the installation
  period_kind   TEXT NOT NULL CHECK (period_kind IN ('year', 'quarter', 'month')),
  period_start  TEXT NOT NULL,             -- the local first day of the period, YYYY-MM-DD
  amount_minor  INTEGER NOT NULL CHECK (amount_minor > 0),
  currency      TEXT NOT NULL,
  warn_bp       INTEGER NOT NULL CHECK (warn_bp BETWEEN 1 AND 10000),
  note          TEXT NOT NULL DEFAULT '',
  alert_state   TEXT NOT NULL DEFAULT 'ok' CHECK (alert_state IN ('ok', 'warning', 'exceeded')),
  created_by    TEXT NOT NULL,
  created_at    TEXT NOT NULL,
  updated_by    TEXT,
  updated_at    TEXT NOT NULL,
  revision      INTEGER NOT NULL DEFAULT 1,
  deleted_at    TEXT
);
CREATE UNIQUE INDEX idx_ticket_budgets_unique ON ticket_budgets (scope_kind, scope_id, period_kind, period_start, currency) WHERE deleted_at IS NULL;
CREATE INDEX idx_ticket_budgets_period ON ticket_budgets (period_start) WHERE deleted_at IS NULL;
