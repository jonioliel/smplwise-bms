# CR-038 slice 6b - the board TABLE view (D24, section 13.6): implementation notes

Branch `pilot/TICKETS-s6b`, cut from `origin/pilot/TICKETS-s1` (`02f6a57a`). Spec: `docs/changes/CR-038-TICKETS-MODULE.md` (on
`origin/pilot/TICKETS-spec`) sections 13.6 and D24, slice table row 6b. Built in parallel with slices 2, 3, 4, 5a and 6; no migration
(the `ticket_saved_views` table and the sort indexes are in slice 1's `0079`).

## 1. What slice 6b delivers

**API** (`routers/tickets_table.py`, mounted in `main.py` BEFORE `routers/tickets.py` so `/tickets/table` and `/tickets/views` are never
read as `/tickets/{ticket_id}`; every route sits behind slice 1's `module_gate`):

| Route | Gate | What |
|---|---|---|
| `GET /tickets/table` | `tickets.view` | one page: `sort=<key>:<dir>[,<key>:<dir>]` (whitelist `number title department priority status assignee place device created activity stuck sla`, at most two keys, the id breaks ties in the primary key's direction), filters `scope status(group or list) department[] priority[] assignee(user:/contact:/none/me) floor area stuck(any or a kind) waiting(manager) created_from created_to q`, `limit` 25/50/100/200, opaque keyset `cursor` (base64 of the sort, the last row's sort values and its id; another sort or a malformed one is 422 `cursor`). Answer `{items, next_cursor, sort, limit, filters}` |
| `GET /tickets/export.csv` | `tickets.manage` in at least one department (a manager member, or `tickets.all_departments`) | the caller's visible rows for the same filters and sort; `columns=` (the table's columns, exactly as asked), `lang=he\|en`; 5,000 rows (more -> 413 `export_too_large`), one export a minute per user (429 `export_rate`, `retry_after_s`; a refused export does not count), UTF-8 BOM, every cell quoted, CRLF, times in `time.zone`, every cell through the shared formula guard `intercom_adapter.csv_cell`; audit `ticket.export` (filter, sort, columns, row count - never a row) |
| `POST /tickets/bulk` | `tickets.manage` anywhere, then manager rights per ticket | `{action: assign\|remind\|priority\|close, items: [{id, revision}] (1-50, distinct), params, client_request_id}`; per-item results `ok unchanged stale forbidden invalid_transition not_found assignee_not_allowed unavailable too_soon invalid`; idempotent by `client_request_id` (`ticket_requests`, route `POST /tickets/bulk`) |
| `GET/POST /tickets/views`, `PATCH/DELETE /tickets/views/{view_id}` | `tickets.view`, own rows only | saved filters / layouts; another user's view is the same 404 `view_not_found` as an unknown one; 20 per user (409 `too_many_views`), unique name per user (409 `view_name_taken`), name 1-60 after the Cc/Cf hygiene |

**Visibility.** The table's rows come from `access.visible_table_page()` / `access.visible_export_rows()` (appended to `access.py`),
which read `store.table_rows_unchecked()` (appended to `store.py`: the indexed SUPERSET - membership / all departments / creator /
current internal assignee, exactly `visible_page()`'s - plus the whitelisted filters, the ORDER BY and the keyset clause) and pass
EVERY row through the single `visible()`. A page scans at most 5 x `limit` candidates and comes back SHORT with a cursor (the client
keeps loading); an export scans at most 50,000 candidates (more -> 413 too). A forged cursor only moves the position (every value is
a bound parameter and every row is still checked). `tests/test_tickets_table.py` guards that only `access.py` calls
`table_rows_unchecked`. A limited viewer (creator / internal assignee who is not a member) gets the stuck and SLA columns blank and
no inline moves.

**Bulk.** `services/tickets/bulk.py`: each item is read through `access.visible_by_id` (invisible = `not_found`, its number is not
told), needs manager rights in its own department, the revision the table showed, and runs in its OWN savepoint
(`store.item_transaction`) through the same service function a single action uses (`service.assign / change_status / edit`), so the
rules, the timeline row and the per-ticket audit row are the single action's; a failing item is rolled back alone and gets a
`denied` audit row with its result; the request gets one `ticket.bulk` row (action, total, counts). `close` requires a note (422
`params.note`); `priority` takes a key mapped per department (`unchanged` when equal); `assign` to a contact needs
`tickets.external` (`forbidden` without it) and answers `unavailable` until the public page exists (slice 4); `remind` = a timeline
row `reminder` `{manual: true}` + audit `ticket.remind`, only for an internal assignee in a handling state, at most one manual
reminder per ticket per hour (`too_soon`); a reminder is not progress (it does not move `last_activity_at`).

**Saved views and the preference.** `services/tickets/views.py` validates a view document with the SAME whitelists as the list
(`services/tickets/table.py`); a stored view a later version cannot read is served with its broken parts reset. The per-user
preference `tickets.board` (`services/tickets/table_prefs.py`, registered in `user_prefs` + `PrefsPatch`): `{view, columns, sort,
density, limit, default_view}`, a partial object, null = defaults. The default saved view lives there (no migration needed).

**Screens.** `screens/tickets-list.ts` (slice 1) gains a cards / table switch in its tools row (remembered as `tickets.board.view`)
and renders `<tickets-table>` instead of the cards in the table view, handing it the scope, the address filters (state, department,
text), the meta and its D18 address of a ticket. `<tickets-table>` (`screens/tickets-table.ts`): sortable headers (click; Shift+click
adds a second key; `aria-sort` on the primary, an order number on both), sticky header inside the table card (the card scrolls),
checkbox column with Shift ranges and the page checkbox (managers only - the selection exists for the bulk actions), inline status
menu (the moves the server lists for this caller; a move that needs a reason asks for it) and inline handler picker (slice 1's
`POST /tickets/{id}/status` and `/assign` with the row's revision; a 409 reloads the row), the keyboard (↑ ↓ Home End PageUp
PageDown move the row focus - vertical, the same in RTL; Enter opens per D18; Space selects; Ctrl/Cmd+A selects the page; Esc closes
a menu, then clears the selection; `/` goes to the area's search box; ARIA `grid`, `aria-rowcount`, `aria-selected`, roving
tabindex, the help sentence on `aria-describedby`), polling every 30 s while visible (one page loaded; selection and scroll kept),
and below 768 px the compact list (number, title, state chip, handler, age; a tap opens; no selection, no column chooser).
`<tickets-table-toolbar>` (`tickets/table-toolbar.ts`): column chooser (show / hide / reorder / reset; number and title always
shown), saved filters (apply, save the current view, star = the default, delete with a second tap), the table's own filters
(priority, handler, waiting for a manager, stuck, opened between), density (comfortable / compact), the count and CSV.
`<tickets-table-bulk>` (`tickets/table-bulk.ts`): "N נבחרו", assign / remind / priority / close with a short dialog each, one request,
the answer said in one line ("בוצע ב־12 מתוך 14" + the other results); what did not succeed stays selected. Every popover and menu is
OPAQUE (`--sw-menu-surface`, the menu lint passes without registry entries because the rules are clean). Texts: a separate
catalogue `tickets/table-text.ts` with the D33 tokens (`tbt()`), Hebrew and English. Pure logic: `tickets/table-model.ts`.
Wire contract: `api/tickets-table.ts` (REST + a demo store built on slice 1's).

## 2. Readings and deviations (the safest reading each time)

1. **A route of its own: `GET /tickets/table`** instead of extending slice 1's `GET /tickets`. The spec writes the sort / limit /
   cursor onto `GET /tickets`; slice 1 owns that route (and slices 6 / 3 add to it in parallel). The new route is additive and uses
   the same superset and `visible()`; the integration may later point `GET /tickets` at the same engine (`table.from_query_params`
   + `access.visible_table_page`). Slice 1's list keeps its last-activity order for the cards.
2. **No kanban.** The task scope of 6b names the table only; the view switch offers cards and table (`BOARD_VIEWS`), the preference
   and saved views already accept `kanban`.
3. **Outside contacts.** Contacts, links and messages are slices 4 / 5b: the inline picker lists internal users only (the assignee
   route answers `contacts: []`); bulk `assign` to a contact answers `unavailable` (after the `tickets.external` check), bulk `remind`
   for a contact assignee answers `unavailable`. The assign confirmation with the message preview (13.6) arrives with those slices.
4. **The CR-018 reminder signal** is slice 6's: bulk `remind` writes the timeline row and the audit row and calls
   `notify_bridge.ticket_reminder(conn, ticket_id, assignment_id, manual=True)` IF slice 6 defines it (`getattr`), so no shared file
   is touched here.
5. **Facets / the floor tree / the state strip** (D19-D21) are slice 6. `floor` and `area` filters exist in the API (they act on
   `tickets.floor_id` / `area_id`, filled by slice 3); the table UI does not offer them yet - slice 6's tree can pass them.
6. **Phone.** The compact list replaces the TABLE view below 768 px; the cards view on a phone stays slice 1's cards (13.6 says every
   view falls back - left to slice 6, which owns the board).
7. **`/` shortcut** works while the focus is inside the table (a page-wide shortcut would need the shell).
8. **Export rate** is per process in memory (one add-on process); the CSV header language follows `lang` (the client sends the
   document language).
9. **Saved view status.** A view stores the address's state filter as written; a status LIST (possible through the API) cannot be
   shown by the area's state chips and reads as "open" on the screen.
10. **Operator screens stay clean**: no hint line under the table (the mock-up's keyboard hint is the screen reader's
    `aria-describedby` sentence instead).
11. **Owner decision 14.10 (rename):** every text of this slice uses the D33 tokens; nothing of 6b writes the module's noun. The tests
    no longer assert the default words (they render the configured default), and the 6b lints refuse the old AND the new default words.

## 3. Shared files touched (additive only)

| File | Change |
|---|---|
| `smplwise_vms/backend/smplwise/main.py` | 2 lines: import + `include_router(tickets_table_router.router)` before `/tickets/{ticket_id}` |
| `smplwise_vms/backend/smplwise/services/user_prefs.py` | 1 import line + `VALIDATORS["tickets.board"]` / `DEFAULTS["tickets.board"]` (+2 comment lines) |
| `smplwise_vms/backend/smplwise/routers/me.py` | 1 line: `tickets_board` field (alias `tickets.board`) in `PrefsPatch` |
| `smplwise_vms/backend/smplwise/services/tickets/store.py` | an appended block at the end (table SQL, savepoint helper, saved-view CRUD, last manual reminder); nothing above changed |
| `smplwise_vms/backend/smplwise/services/tickets/access.py` | an appended block at the end (`visible_table_page`, `visible_export_rows`, `ExportTooLarge`); nothing above changed |
| `frontend/src/screens/tickets-list.ts` | 4 import lines, the `view` state, the prefs read in `boot()`, the switch in the tools row (+1 phone CSS rule), the table branch in `body()`, `patchTicket` in `onTicketChanged`, `setView()` |

Not touched: `roles.json`, `rbac.py`, `routers/access.py`, migration `0079`, slice 1's text catalogue, icons, styles, mock.

## 4. For slices 6 and 9

- **Slice 6 (board, notifications):** host the table in the board screen exactly as `tickets-list.ts` does (`<tickets-table .scope
  .base .meta .hrefOf .picked @table-filters>`; call `patchTicket(detail)` after a drawer change). The facets route can reuse
  `table.parse_filters` / `table.Filters` (the same whitelist) and the superset of `access._table_superset`; the WHERE builder lives
  inside `store.table_rows_unchecked` (factor it out when the facets need it). Define `notify_bridge.ticket_reminder(conn, ticket_id,
  assignment_id, manual)` to send `ticket.reminder` for manual reminders. The SLA monitor's fields (`stuck_kind`, `stuck_level`,
  `*_due_at`, `reminders_sent`) already feed the stuck and SLA columns and sorts.
- **Slice 9 (cost columns):** a new column = `table.SORT_KEYS`/`COLUMNS` + `store.TABLE_SORT_SQL` (a NOT NULL expression) +
  `table_present.table_row` (blank it unless `tickets.costs.view`) + `export.HEADERS` / `cell_values` + `COLUMN_KEYS`, the cell and
  the label in `tickets/table-model.ts` / `screens/tickets-table.ts` / `tickets/table-text.ts`. The export gate stays
  `tickets.manage`; cost columns additionally need `tickets.costs.view` per row.

## 5. Tests

Backend: `tests/test_tickets_table_query.py` (whitelists, cursor tampering, saved-view documents, the preference validator) and
`tests/test_tickets_table.py` (route order and module gate, 422 per field, every sort key and the id tie-break, keyset stability
across an insert, short pages under the visibility check with 130 invisible candidates, filters, the RBAC matrix of the whole cast
incl. floor scope / placeless any-scope / deny binding / another department / module off, forged cursors, blank columns for limited
viewers, bulk partial failure and own savepoints, per-ticket manager rights, assign / priority / remind incl. `too_soon`, caps,
duplicates and idempotency, CSV gate / BOM / zone / no invisible row / formula injection / 5,000 cap / rate / renamed header,
saved views privacy and caps, the preference, the static guards). Frontend: `tests/unit-tickets-table.spec.ts`,
`tests/evidence-tickets-table.spec.ts` (desktop 1440 + phone 390, light / dark, classic / domus; images in
`docs/design/evidence/tickets-s6b/`), `tests/layout-tickets-table.spec.ts` (5 skins x 2 schemes x widths 320-1440). Results: the
slice report.
