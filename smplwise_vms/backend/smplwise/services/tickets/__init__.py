"""CR-038 - the optional tickets / fault-management module (docs/changes/CR-038-TICKETS-MODULE.md).

Internal identifiers stay `tickets`; the user-facing name is a setting (D33).

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

Messaging core (built on pilot/TICKETS-msg-core, wired by slices 5a / 5b):
  channel.py, channel_whatsapp.py   the outbound channel abstraction and the ha-whatsapp adapter
  outbox.py, hours.py, message_templates.py, inbound.py

Layering (the intended direction of imports; code review 2026-11-13, finding 01:F-21). The package grew to about 130 modules and
about 400 imports inside functions, most of them there to break an import cycle. A module imports at module level only from its own
layer or from a layer above it in this list; an import in the other direction is a cycle, and stays inside the function that needs it
until the dependency is turned round:

  1. leaves     no import from the package, or from other leaves only: model.py, timeutil.py, text_hygiene.py, money.py, naming.py,
                module_key.py, keyring.py, ratelimit.py
  2. store      store.py and store_*.py: the SQL of the module. They import nothing from the package, and take a connection and plain
                values, never a Viewer or a request. (outbox_store.py and public_store.py are stores of their own sub-area and also
                import its leaves.)
  3. documents  settings_doc.py, rules_doc.py, policy.py: the settings documents and what they decide
  4. access     access.py: the module switch, the Viewer and `visible()`. Every read and every action goes through it; nothing above
                it decides visibility by itself
  5. services   one area per file group, each action one transaction: service.py / create.py (the ticket), costs*.py, quotes.py,
                rfq*.py, visits.py, budgets.py, handler_*.py, messaging.py with channel*.py / outbox.py / inbound.py, present.py and
                table*.py (the read projections), ...
  6. wiring     what the application starts and stops, and the hooks toward the rest of Arx: notify_bridge.py, notify_sources.py,
                monitor.py, retention.py, public_runtime.py with public_*.py (the separate public listener)

Known cycles that the function-level imports hold today (not to be "fixed" by moving the import up): service <-> present,
service <-> create, vendor_portal <-> portal_more, messaging <-> the services that send (costs, rfq, visits, intake, ...),
access -> public_runtime, settings_doc <-> work_calendar / notify_matrix. New code does not add to them: a helper two layers need
goes down into a leaf (as timeutil.py, money.py and text_hygiene.py did), and the routers (`routers/tickets*.py`) import from
this package, never the reverse.

Slice 1 builds the skeleton and internal tickets; contacts, links, the public page, WhatsApp, SLA monitoring, the board,
device integration and cost claims are later slices (section 20).
"""
