-- CR-038 owner request 2026-10-14 ("מטפלים וספקים"): an employee WITHOUT an Arx account is a directory row of its own kind. The API
-- names the kind "employee"; the row is stored as kind 'person' with `employee` = 1, because 0080's CHECK on `kind` cannot be
-- widened in place and rebuilding `ticket_contacts` (the parent of ticket_contact_departments ON DELETE CASCADE and of ticket_links)
-- inside the migration's transaction with foreign keys on would cascade-delete the department rows. Additive only: every existing
-- row stays a person / vendor (employee = 0). An employee never names an internal user and never works for a vendor (enforced by
-- services/tickets/contacts.py); it receives the handler link like any contact (code / WhatsApp / e-mail rules unchanged).

ALTER TABLE ticket_contacts ADD COLUMN employee INTEGER NOT NULL DEFAULT 0 CHECK (employee IN (0, 1));
