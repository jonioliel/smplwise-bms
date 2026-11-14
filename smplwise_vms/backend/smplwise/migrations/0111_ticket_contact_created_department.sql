-- CR-DEPT-MANAGER-HANDLERS follow-up (owner decision 2026-10-17, open question 5 approved): the department a department manager created a
-- directory row in, stored on the row (the "creating department" of the vendor list). NULL = created in Settings by a directory editor
-- (tickets.configure) or before this migration.
-- Migration 0111 (provisional 0113 on pilot/DEPTMGR2; renumbered at the integ/270 integration, 2.7.0).
-- Additive only: one nullable column, no foreign key (a department is deactivated, never deleted; an unknown id reads as "another
-- department"); an older build ignores it.
ALTER TABLE ticket_contacts ADD COLUMN created_department_id TEXT;

-- Backfill the rows a department manager created before this migration: the creating department is in their creation audit row
-- (`ticket.contact.create`, details `department_id` + `via: department_manager`). Ids only; nothing else is read.
UPDATE ticket_contacts
   SET created_department_id = (
         SELECT json_extract(a.details_json, '$.department_id') FROM audit_log a
          WHERE a.action = 'ticket.contact.create' AND a.decision = 'allowed' AND a.resource_type = 'ticket_contact'
            AND a.resource_id = ticket_contacts.id AND json_valid(a.details_json)
            AND json_extract(a.details_json, '$.via') = 'department_manager'
          ORDER BY a.id LIMIT 1)
 WHERE created_department_id IS NULL;
