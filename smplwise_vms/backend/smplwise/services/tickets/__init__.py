"""CR-038 - the optional tickets / fault-management module (docs/changes/CR-038-TICKETS-MODULE.md).

One package, one storage layer (section 5):
  store.py          all SQL of the module (the only place that reads or writes the ticket tables)
  model.py          statuses, the state machine of section 11.2, text hygiene, field validation
  access.py         the module switch and THE visibility rule `visible()` (permission x department membership, section 8)
  naming.py         the configurable display name of the module (owner decision D33)
  settings_doc.py   the `tickets.settings` document (display settings D18 / D22 in slice 1)
  create.py         create_ticket() - the one creation path (and the phase-2 hook, section 18)
  service.py        the ticket actions (edit, status, assign, return, notes, ETA, attachments) as one transaction each
  attachments.py    the image validator and store shared by the internal and (slice 4) public uploads
  notify_bridge.py  the CR-018 hooks (no-ops until slice 6)
  retention.py      the janitor step

Slice 1 builds the skeleton and internal tickets; contacts, links, the public page, WhatsApp, SLA monitoring, the board,
device integration and cost claims are later slices (section 20).
"""
