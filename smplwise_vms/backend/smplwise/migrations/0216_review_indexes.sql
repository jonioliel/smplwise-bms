-- CR-AUDIT-INDEX-2436 (code review 2026-11-13: 05:P1-04, 05:P2-12, 01:F-09). Indexes for lookups that were full table
-- scans on the migrated schema. Plans only: no row, column or result changes. Idempotent (IF NOT EXISTS).
-- The further candidates in the review (actor on audit_log, 22 foreign-key child columns, the other ticket columns) wait
-- for row counts from a lab database copy; they are not added here.

-- audit_log filtered by action first (~25 queries; retention 365 days). The `at` column serves the time-window ones.
CREATE INDEX IF NOT EXISTS idx_audit_action_at ON audit_log (action, at);

-- nvr_changes by batch (services/nvr_batch.py, 13 queries). Most rows have no batch, so the index skips them.
CREATE INDEX IF NOT EXISTS idx_nvr_changes_batch ON nvr_changes (batch_id, batch_index) WHERE batch_id IS NOT NULL;

-- notifications by source (the monitors' open-row lookups).
CREATE INDEX IF NOT EXISTS idx_notifications_source ON notifications (source, state);

-- notifications by dedupe key in any state (idx_notifications_open_key is partial on open rows and cannot serve it).
CREATE INDEX IF NOT EXISTS idx_notifications_dedupe ON notifications (dedupe_key);

-- ticket_visits by assignment (the public visit page: latest / missed visit of an assignment).
CREATE INDEX IF NOT EXISTS idx_ticket_visits_assignment ON ticket_visits (assignment_id, created_at) WHERE assignment_id IS NOT NULL;
