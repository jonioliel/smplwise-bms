# CR-038 slice 1 - skeleton and internal tickets: implementation notes

Branch `pilot/TICKETS-s1` (from `origin/integ/2410`, with `origin/pilot/TICKETS-spec` merged). Spec:
`docs/changes/CR-038-TICKETS-MODULE.md` (r2.6), section 20 row 1. This file records what slice 1 delivers, the readings taken
where the spec was ambiguous or met the code (the safest one each time), owner decision D33, and what the next slices take over.

## 1. What slice 1 delivers

**Module switch.** `tickets.enabled` ("false" by default; `routers/settings.py` DEFAULTS + `SettingsPatch`; its own audit rows
`tickets.module.enable` / `tickets.module.disable`). While off every `/api/v1/tickets*` route answers the uniform 404
`feature_disabled` through a router-level dependency (`routers/tickets.py module_gate`), so a route a later slice adds to these
routers is gated with no further code; `GET /tickets/module` is the one route that answers. `/me` carries
`modules: {tickets, tickets_name}`. The shell hides the area until the session says the module is on (`applyTicketsHidden`,
hidden by default - no flash for an operator); the settings tab stays (it holds the switch).

**Migration 0079** (`0079_tickets_core.sql`, the highest of the branch; 0080-0084 stay reserved for the later slices): the 14 core
tables of section 7.1 with the r2 columns (departments, members, priorities, categories, SLA rules, templates, the running number,
tickets, assignments, events, request idempotency, saved views, attachments, device context), the "אחזקה" department open to all,
four priorities and the section 13.1 SLA matrix, one open ticket per dedupe key (partial unique index).

**Permissions** (`roles.json`, `PERMISSION_LABELS`, the sensitive list): `tickets.view`, `tickets.create`, `tickets.manage`,
`tickets.external`, `tickets.all_departments`, `tickets.configure`, and `messaging.accounts.manage` (catalogued here for slice 5a so
it does not touch the shared files). view + create: operator, site_admin, system_admin; manage: site_admin, system_admin; sensitive:
external (site_admin, system_admin), all_departments, configure, messaging.accounts.manage (system_admin). The six single-permission
built-in roles `tickets_<name>` (D25, section 8.2); `tickets_view` / `tickets_create` / `tickets_manage` join the default delegable
list. The cost permissions of D31 are slice 9.

**Visibility.** One function decides every list row, detail, count and sub-resource: `services/tickets/access.visible()` - module on,
then `tickets.view` where the ticket lies (floor -> building -> site; a placeless ticket: at any scope), then department membership
(direct or through a group, manager or member) / `tickets.all_departments` / the creator / the current internal assignee; full or
limited content (a limited viewer never gets internal notes, internal photos, the assignment history or the close note). The store's
unchecked readers are called from `access.py` only (a static test fails otherwise); every `{ticket_id}` route is enumerated by a test
that asserts the uniform 404 for an invisible ticket, so a new route that forgets the check fails the suite.

**Routes (29).** `GET /tickets/module`; `GET /tickets/meta`; `GET /tickets` (scope mine / department / all / visible, status group,
department, text filter on number / title / device, keyset cursor, a scan budget per page); `POST /tickets` (idempotent by
`client_request_id`; optional assignment for a manager); `GET /tickets/assignees`; `GET|PATCH /tickets/{id}`;
`POST /tickets/{id}/status` (the section 11.2 table incl. close without "done" with a reason, cancel as a duplicate with
`duplicate_of`, reopen within the department window with `reopen_count`); `POST /tickets/{id}/assign` (internal users of the
department who may see the ticket; external assignment answers 409 `public_link_unavailable` until slice 4); `POST /tickets/{id}/return`
(cannot handle / not mine, reason required); `POST /tickets/{id}/notes` (the external flag for managers); `POST /tickets/{id}/eta`;
photos `POST|GET|DELETE /tickets/{id}/attachments[/{att}]` (the ONE validator: JPEG / PNG only, 8 MiB body-limit row, 16 MP judged on
the header before any decode, re-encoded without EXIF / GPS, own decode slot, storage cap checked first, 60 per ticket); settings
`GET|PUT /tickets/settings` (D18 / D22, revision-checked), `PUT /tickets/name` (D33), departments with categories, priorities and
members (`/tickets/admin/...`, the escalation rule of review T19), the people picker and the permission holders (section 8.2).
Errors are the ApiError envelope; texts carry the configured name. Audit rows carry ids and field names, never free text.

**Screens.** The area "קריאות" (`#/tickets/mine | department | all`; last in the rail, icon `ticket`): the board page frame of mock-up v2
(large title, department chips, the state filter, the text filter, "+ חדשה"), ticket cards in the automation card's anatomy, the
drawer `?t=<id>` and the full screen `#/tickets/<id>` by D18, the create form as a side sheet or a centred dialog by D22 (`?new=1`,
duplicate hint by title), the dialogs of close / cancel (duplicate number) / reopen / assign / return / edit / ETA, photos, the
timeline with the note composer. Settings > the module (`#/system/tickets?tab=general|departments|permissions`). The demo store
(`api/tickets-mock.ts`) answers without a backend.

## 2. Owner decision D33 (2026-10-13) - the module's name is configurable

> The module's USER-FACING NAME must be renameable in Settings. Internal identifiers (tables, routes, permission keys, module flag)
> stay `tickets`; every user-facing occurrence uses ONE configurable display name pair (singular + plural, per UI language; default
> he "קריאה"/"קריאות", en "Ticket"/"Tickets", ar, ru) read from the settings through a single i18n helper.

**Contract.** A text that names the module is a template with three tokens, rendered by `services/tickets/naming.py` on the server and
`frontend/src/tickets/naming.ts` in the client (the same tokens, the same defaults):

| Token | Renders | Example (default he) |
|---|---|---|
| `{ticket}` | the singular | קריאה |
| `{tickets}` | the plural | קריאות |
| `{f:<text>\|m:<text>}` (`\|n:<text>` for Russian) | the word that agrees with the name's grammatical gender | `{ticket} {f:חדשה\|m:חדש}` -> "קריאה חדשה"; renamed to "אירוע" (m) -> "אירוע חדש" |

The stored document is `tickets.name` (per language `{one, many, gender}` + `revision`; kept out of project backups). Validation on
both sides: 1-30 characters after whitespace folding, letters / marks / digits / spaces and `- ' " ׳ ״ . ( )` only (no markup), no
control or format characters (Cc / Cf, so no bidi overrides), at least one letter, a gender the language knows (he / ar: f, m; ru: f,
m, n; en: none). A corrupt stored value reads as the default. Saving needs `tickets.configure` (the module's settings permission; a
holder of the single-permission role `tickets_configure` may rename), is revision-checked and audited `tickets.name.update`
(languages changed, never the text).

**Where it reaches.** The rail and phone dock label, the page titles, the settings tab, the settings index and its search words, the
role names of the six grant roles and the permission labels (`rbac.role_name`, `access.rendered_labels`: `/me` bindings, roles,
preview, group impact, door grants), every server message of the module, every text of the screens (`tickets/text.ts`, read through
`tt()`), and the notification texts of slice 6 / WhatsApp templates and the vendor page of slices 4-5b (the hook: write their texts
with the tokens and render with `naming.render_for(conn, text, lang)` / `tn()`). A rename is applied live: `setTicketNames()` notifies
the shell (rail, tabs, crumbs) and every open tickets screen.

**Tests.** Backend `test_tickets_naming.py`: defaults, render and gender agreement, validation table, a corrupt stored value, the
permission and audit of a save, the name reaching `/me`, `/tickets/module` (with its revision), role names, permission labels,
preview and bindings, server messages, and a lint over `services/tickets`, `routers/tickets*.py` and the labels that fails on the
default name. Frontend `unit-tickets-naming.spec.ts`: the same render and validation rules, live listeners, the catalogue (every text
in he and en, none with the default name), the rail / tabs / settings tab / index labels after a rename, and the D33 lint: no file of
the module (`src/tickets/**`, `src/api/tickets*.ts`, `src/screens/tickets-*`, `system-tickets`) and no tickets line of `shell/nav.ts`,
`screens/system-index.ts`, `shell/sw-app.ts`, `router.ts` may write the default name (Hebrew forms or "Ticket(s)" inside a string);
a planted line proves the lint catches one. The evidence spec renames the module and asserts the default name appears nowhere.

## 3. Readings taken (spec vs code or brief), and why

1. **Department editing in slice 1.** The brief asks for "departments / categories / priorities basic CRUD" in slice 1; the spec's table
   puts the department screens in slice 2. Slice 1 ships the basics (create / rename / activate / open-to-all / reopen days / delete when
   no open ticket; categories add / remove; the default priority; members with the escalation rule). The SLA grid, templates, the
   automatic close, history-to-handler, urgent-as-critical and the link / send-hour overrides stay slice 2.
2. **The "הרשאות" sub-tab.** The spec (r2.3 note, +3 in slice 1) names a sub-tab; mock-up v2 drew the "מי רשאי" and "הרשאה אישית" cards on
   "כללי". The approved CR outranks the design asset (CLAUDE.md precedence): a sub-tab, with the holders list and the personal grants
   (one `tickets_<name>` role bound to one user through the ordinary `/access/bindings` route - `rbac.assign` and the delegation rules
   decide, as everywhere else).
3. **Everything closed while off.** The settings routes of the module are behind the same gate (only `/tickets/module` answers), so while
   the module is off Settings shows the switch alone. The switch itself is the product setting (system.configure).
4. **Who edits what.** The switch and the display document (D18 / D22): `system.configure` (spec 14.1: the whole document). The name
   (D33: "edited with the settings permission"): `tickets.configure`, the module's settings permission. Departments: `tickets.configure`.
5. **Placeless tickets.** Slice 1 has no place or device input (place resolution and the device tab are slice 3); the visibility rule
   already handles both forms, and the card's "where" line shows the department and the category until a place exists.
6. **The duplicate hint** lists open tickets with a similar title while the title is typed (the text filter); slice 3 lists the device's
   open tickets first, as the spec says.
7. **No counts on the state filter** (the facets route is slice 6). The manager board, its floors tree, grouping and state strip
   (D19-D21) are slice 6; the table and kanban (D24) slice 6b; "לוח מנהל" is not offered before them.
8. **Notifications.** `services/tickets/notify_bridge.py` exists with the calls in place (assigned, status, returned ...) and does
   nothing yet: the CR-018 sources, recipients and visibility are slice 6 (the spec keeps the shared notify files for slice 6 only).
9. **Backups.** The module's settings, its name and the WhatsApp mapping join `SETTINGS_KEEP` (review C4 / T13). The ticket tables are
   not project tables: a replace restore must not delete departments that open tickets reference (a test proves a restore keeps them).
10. **`name_revision`** is part of `GET /tickets/module` (the settings editor sends it back with a rename; `/me` keeps the names only).
11. **State names.** The chips use the mock-up's state names ("חדש", "שויך", "התקבל", "בטיפול", "ממתין לחלק", "הסתיים", "סגור");
    texts that NAME the module use the tokens, and words that describe it agree with its gender through `{f:..|m:..}`.
12. **Free text and bidi.** Titles, descriptions and notes are shown as typed: the product's `bidi()` helper (an LRM before "-1" for
    floor names such as "קומה -1") would turn "ל-27" in prose into "-27"; names (departments, categories, people) keep it.
13. **Line endings.** LF everywhere (`.gitattributes`).

## 4. For the next slices

- **Slice 2 (departments + SLA):** extend `routers/tickets_admin.py` (revision-checked like the routes here), `settings_doc.SCHEMA` for
  new installation keys, the "מחלקות" tab of `screens/system-tickets.ts` (the department card is the place for the SLA grid and the
  flags), migration from 0080 on, texts in `tickets/text.ts` with the tokens.
- **Slice 3 (device tab):** `place.py` / `device_context.py`; `create.TicketSpec` already carries `origin`, `dedupe_key`, `rule_ref`
  and the creation path handles an absorbed duplicate; `place_text` / `device_name` are read by the card.
- **Slice 4 (public page):** external assignment raises 409 `public_link_unavailable` today (`service.assign`) and
  `present.can_block.assign_external` waits for `access.public_ready()`; the attachment validator is shared (`attachments.store`).
  Internal-content marks appear on the screens as soon as a ticket has an external assignment (`marksInternal`).
- **Slice 5a (WhatsApp accounts):** `messaging.accounts.manage` is in `roles.json` (system_admin), in `PERMISSION_LABELS` and in the
  sensitive list; `messaging.whatsapp` is in `SETTINGS_KEEP`; migration 0082 is reserved. The settings tab of 5a's screen is one
  additive entry each in `shell/nav.ts` (`AREA_TABS.system`, `TAB_PERMISSIONS`, `INSTALLATION_ONLY_HREFS`), `shell/sw-app.ts`
  (the `system` case) and `screens/system-index.ts` - not added here, so no tab points at a screen that does not exist yet.
- **Slice 6 (board, notifications):** fill `notify_bridge.py`; the list route already returns `waiting_on` / `waiting_reason`; the
  board is a new screen beside `screens/tickets-list.ts` (add its tab to `TICKETS_TABS`).

## 5. Tests (local, one process at a time; the runner gate is NOT_RUN by instruction)

| Suite | Result |
|---|---|
| Backend `tests/test_tickets_*.py` (model, naming, module gate, visibility, API, admin, attachments, migration) + `test_migrations.py` | 153 passed, 1 skipped (the naming lint's case for `naming.py`, the home of the defaults) |
| Backend: the 36 existing suites the shared files touch (access, roles, delegation, doors, groups, settings, backup, body limit, me, nav order, migrations lists, presence, media ...) | 749 passed (run after the shared-file changes; none of them changed afterwards) |
| Frontend unit: tickets naming + model, tabs config, token / menu lints, settings index and the other nav-related specs | 107 passed |
| Frontend unit sweep (all 165 `unit-*.spec.ts` under the node-only config) | 1805 passed, 9 skipped, 67 failed - only page-based specs that need the preview server; 8 of those files re-run under the browser config: 38 passed, 4 skipped (the 3D plan specs were not re-run locally: NOT_RUN) |
| `evidence-tickets.spec.ts` (desktop 1440 + phone 390) | 17 passed, 1 skipped (a phone-only test on desktop) |
| `layout-tickets.spec.ts` (5 skins x 2 themes x 10 widths 320-1440 x 11 screens = 1100 checks) | 0 escape / overflow / clipped findings, 0 page errors; target / floating findings are reported, not asserted (the shared controls of the automations area are 44 px on phones and touch pointers only, as on the automations screens) |
| `evidence-shell.spec.ts` (desktop + phone; the stored order now ends with "tickets", the demo shows the area) | 36 passed, 2 skipped |
| Runner gate (tier L) | NOT_RUN - no runner job by instruction |

Evidence images: `docs/design/evidence/tickets-s1/` (list, drawer, full screen, create sheet and dialog, close dialog, empty, off, renamed
module, settings general / departments / permissions / off, the phone dock with every area).
