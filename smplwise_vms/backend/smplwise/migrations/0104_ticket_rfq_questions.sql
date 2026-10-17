-- RFQQUESTIONS (docs/tickets/RFQ_BACKEND_CONTRACT.md section 21; docs/changes/CR-RFQ-QUESTIONS.md): a vendor's question to the
-- organisation is a first-class, visible item. Migration 0104 (provisional 0106 on pilot/RFQQUESTIONS, confirmed at the integ/264
-- integration). Additive only: no table rebuild, nothing references these columns by foreign key.
--
-- A question IS an inbound `ticket_rfq_messages` row (direction 'in'); its state lives on that row:
--   pending   answered_at IS NULL (shown as a badge while the request is open)
--   unread    pending AND read_at IS NULL (no RFQ manager opened it yet - one shared state for the request's managers)
--   answered  answered_at set; answer_id = the outbound message that answered it (NULL = handled without a reply, e.g. by phone)
-- An outbound row may name the question it answers (answers_id) and the "answer every vendor" act it belongs to (broadcast_id).

ALTER TABLE ticket_rfq_messages ADD COLUMN quote_id TEXT;      -- in: the quote the question was sent with (the quote form's own field)
ALTER TABLE ticket_rfq_messages ADD COLUMN read_at TEXT;       -- in: first opened by an RFQ manager
ALTER TABLE ticket_rfq_messages ADD COLUMN read_by TEXT;       -- in: that manager's user id
ALTER TABLE ticket_rfq_messages ADD COLUMN answered_at TEXT;   -- in: answered or handled
ALTER TABLE ticket_rfq_messages ADD COLUMN answered_by TEXT;   -- in: the manager's user id
ALTER TABLE ticket_rfq_messages ADD COLUMN answer_id TEXT;     -- in: the outbound message that answered it (no FK: purge order)
ALTER TABLE ticket_rfq_messages ADD COLUMN reminded_at TEXT;   -- in: the "still unanswered" reminder was raised (once per question)
ALTER TABLE ticket_rfq_messages ADD COLUMN answers_id TEXT;    -- out: the question this message answers
ALTER TABLE ticket_rfq_messages ADD COLUMN broadcast_id TEXT;  -- out: one "answer all vendors" act (the same id on every copy)

CREATE INDEX idx_ticket_rfq_messages_pending ON ticket_rfq_messages (rfq_id, rfq_vendor_id) WHERE direction = 'in' AND answered_at IS NULL;

-- Before this migration a manager's message to the vendor resolved his question (the TKRFQ5 notification rule): an inbound message
-- followed by an outbound clarification to the same vendor counts as answered (and read) by that message.
UPDATE ticket_rfq_messages AS m
   SET answer_id = (SELECT o.id FROM ticket_rfq_messages AS o
                     WHERE o.rfq_vendor_id = m.rfq_vendor_id AND o.direction = 'out' AND o.created_at >= m.created_at
                     ORDER BY o.created_at, o.rowid LIMIT 1)
 WHERE m.direction = 'in';
UPDATE ticket_rfq_messages AS m
   SET answered_at = (SELECT o.created_at FROM ticket_rfq_messages AS o WHERE o.id = m.answer_id),
       answered_by = (SELECT o.author_id FROM ticket_rfq_messages AS o WHERE o.id = m.answer_id),
       read_at = (SELECT o.created_at FROM ticket_rfq_messages AS o WHERE o.id = m.answer_id)
 WHERE m.direction = 'in' AND m.answer_id IS NOT NULL;
