-- MGRDASH phase 2 (docs/design/MANAGER_DASHBOARD_SPEC_HE.md sections 5, 7 and 10): the manager overview's summary route
-- (GET /tickets/dashboard) counts status moves of the timeline per period and the requests marked done per period. Two indexes,
-- no table, no data change. PROVISIONAL NUMBER 0121 (0119 / 0120 are taken by branches in flight for 2.8.0); the lead renumbers at
-- integration under the contiguous-sequence rule.
--
-- 1. ticket_events by the status a move led TO, then the time: "closed", "returned to handling" and "opened" of a period are one
--    range read per status (equality on to_status, range on at). Partial: notes, messages and other timeline rows carry no status.
-- 2. tickets by the completion time `done_at` (the HANDLERLOAD definition of "marked done", services/tickets/handler_load.py): the
--    requests completed in a period without walking every closed request.

CREATE INDEX IF NOT EXISTS idx_ticket_events_status_at ON ticket_events (to_status, at) WHERE to_status IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tickets_done_at ON tickets (done_at) WHERE done_at IS NOT NULL;
