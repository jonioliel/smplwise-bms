-- CR-ORG-LOCATIONS follow-up (owner decision 2026-10-17, docs/changes/CR-ORG-LOCATIONS.md section 6 (d)): the "add a navigation link to
-- the message" choice of ONE external assignment of a service request, kept on the assignment so that a resend, a new link and the
-- SLA reminders render the same text the manager saw in the preview.
-- Migration 0106 (provisional 0107 on pilot/ORGLOC-NAV, renumbered at the integ/264 integration).
-- Additive only: one column with a default of 0 (off); no row rewritten; an older build ignores it.
ALTER TABLE ticket_assignments ADD COLUMN location_nav INTEGER NOT NULL DEFAULT 0 CHECK (location_nav IN (0, 1));
