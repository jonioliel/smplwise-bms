-- Final number 0141 (built as PROVISIONAL 0136 on pilot/VENDMARK-295; renumbered at the 2.11.0 integration, integ/2111). The content does not depend on the number.
--
-- VENDMARK-295 (owner decision GRANTS3 Q1, 2026-10-21): an explicit "permanent vendor" marker in the directory ("more information is always
-- better"). One flag on the directory row of an external technician or vendor company: 1 = permanent, 0 = temporary (the default, which is
-- what every existing row already was). It carries no authority: nothing reads it to allow or deny anything - it is shown (directory list,
-- identity card, export) and filtered on. Employees and rows that name an internal user never carry it (checked in services/tickets/contacts.py).
--
-- Additive only: one column with a default. Rollback: older code ignores the column.

ALTER TABLE ticket_contacts ADD COLUMN permanent_vendor INTEGER NOT NULL DEFAULT 0 CHECK (permanent_vendor IN (0, 1));
