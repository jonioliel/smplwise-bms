# CR-038 slice 6 - stuck / escalation and the manager board: implementation notes

Branch `pilot/TICKETS-s6`, cut from `origin/pilot/TICKETS-s1` @ `02f6a57a`. Spec: `docs/changes/CR-038-TICKETS-MODULE.md` (r2.7) sections
13.1-13.7, 14.1, 8.1 (board / facets rows), D11, D18-D22, D28, D30, D33; section 20 row 6. Not in this slice: the table / kanban view (6b),
cost claims (9), the message channel (5b).

## 1. What slice 6 delivers

**The SLA monitor** (`services/tickets/stuck.py` pure, `services/tickets/monitor.py` the step). It rides on the module's existing janitor
step (`retention.janitor`, called every 30 s by `main.janitor_tick`) with its own once-a-minute throttle - `main.py` needed no janitor line.
Per run it looks at the open tickets that were never looked at, are due (`next_check_at <= now`) or changed since the previous run
(`updated_at`; after a restart, the last day's changes), at most 200 per run, each in its own write transaction:

| Threshold (13.1, per department x priority, empty cell = off) | Applies while | Crossed at |
|---|---|---|
| unassigned | `new` / `returned`, nobody holds it | unassigned since (creation, return, reopen) + `unassigned_after_min` |
| overdue | open, not `done` | created + `resolve_within_min` |
| unopened (D11) | `assigned` to an outside contact whose live link has no `first_opened_at` | link created + `link_unopened_min` |
| ack | `assigned` | assigned + `ack_within_min` |
| stuck | `acknowledged` / `in_progress` | last activity + `stuck_after_min` (a future ETA pushes it out, 13.2) |
| waiting | `waiting_part` | last activity + `stuck_waiting_min` (same ETA rule) |

One reason per ticket (first crossed of: unassigned, overdue, unopened, ack, stuck, waiting) is stored in `stuck_kind`. The ladder (13.3):
the first reminder at the crossing, then every `remind_every_min`, at most `max_reminders`; the managers are alerted on the NOMINAL ladder
(crossing + `manager_alert_after_steps` x cadence; 0 = at the crossing; at once for `unassigned` and when the assignee cannot be reminded);
then nothing more - the ticket stays stuck on the board. `stuck_level` 0 / 1 (reminded) / 2 (managers alerted). Progress (a status, note,
photo, ETA, assignment - anything that moves `last_activity_at` or the status) ends the crossing: its notifications are resolved and a later
crossing starts from zero. Idempotent: the crossing (kind + due) is kept on the `stuck` timeline row; the monitor's own writes
(`store.set_sla_state`) move neither `revision` nor `updated_at`.

Timeline rows (actor `system`, internal): `stuck` (data kind + due), `reminder` (n, channel, queued), `manager_alerted`, `auto_closed`,
`link_expired`. The same tick closes `done` tickets after the department's `auto_close_after_days` (D10, actor system, audit `ticket.close`
with `auto: true`; a manager's reopen first wins) and moves an open ticket whose handler link passed its expiry / cap to "waiting for the
manager" (`link_expired`, once).

**Send hours / quiet hours.** Internal reminders and every manager alert go through CR-018, whose quiet hours apply to non-critical rows.
D28: a ticket's severity is its priority's `notify_severity`; `critical` (passes quiet hours, gets CR-018's own escalation) only while
`urgent_is_critical` holds - the department's column, else the installation's `tickets.settings.urgent_is_critical` (default true) -
otherwise capped at `alert`. A reminder to an OUTSIDE contact waits for the department's / installation's vendor send window (D4, the
installation `time.zone`, DST-correct) while the managers' alert keeps its nominal time (13.1's example: the 02:00 reminder leaves at 07:00,
the 02:00 manager alert does not wait).

**The CR-018 bridge** (`services/tickets/notify_bridge.py`, catalogue `services/tickets/notify_sources.py`). Category `tickets`, subject
kind `ticket` (visibility = `access.visible`, so every recipient may see the ticket now), recipient rules `ticket_managers` (the manager
members of the ticket's department who hold manager rights where it lies; a department with none falls back to tickets.manage +
tickets.all_departments holders; `ticket.new_unassigned` goes to the `notify_new` managers only) and `ticket_assignee`, link
`#/tickets/<id>` (the assignee's one-tap "received" is the detail's state strip). Sources and their keys:

| Source | When (who emits) | Dedupe / resolved |
|---|---|---|
| `ticket.new_unassigned` | created or reopened without an assignee (slice 1 hook) | `ticket:<id>:unassigned` / on assignment, close |
| `ticket.assigned` | assigned to an internal user (slice 1 hook) | `ticket:<id>:assign:<assignment>` / leaving `assigned`, reassignment, return, close |
| `ticket.reminder` | the ladder, internal assignee (monitor) | `ticket:<id>:remind:<n>` / progress, close |
| `ticket.stuck` | the ladder, managers (monitor) | `ticket:<id>:stuck:<kind>` / progress, close |
| `ticket.returned` | the assignee returned it (slice 1 hook) | `ticket:<id>:returned` / reassignment, close |
| `ticket.done` | done, awaiting the manager (slice 1 hook) | `ticket:<id>:done` / close, back to handling |
| `ticket.reply_unmatched` | `notify_bridge.reply_unmatched(conn, inbound_id, ticket_ids)` - 5b | `ticket-inbound:<id>:<department>` |
| `ticket.send_failed` | `notify_bridge.send_failed(conn, ticket_id[, resolved=True])` - 5b | `ticket:<id>:send` |
| `ticket.contact_changed` | `notify_bridge.contact_changed(conn, ticket_id[, resolved=True])` - 4 | `ticket:<id>:contact` |
| `ticket.channel_down` | `notify_bridge.channel_state(conn, account_key, label, down=)` - 5a / 5b | `ticket-channel:<account>` (subject `system`) |

Texts name the number and the place only (never a typed title, note, reason, phone or reply) and carry the configured name (D33). The
policy matrix lists the ticket sources only while the module is on; the bridge emits nothing while it is off.

**The board** - `GET /tickets/board` (manager members and all-department managers; an audited 403 otherwise) and `GET /tickets/facets`
(tickets.view; counts per status / group / department / place / stuck kind / waiting over the caller's VISIBLE set, capped at 2000 rows).
Both read only through `access.visible_page()` (`services/tickets/board.py scan()`). The board answers the managed open tickets with their
section (waiting / stuck / handling), the stuck reason with "since", the SLA cell (nearest due or the crossed one), the place keys and the
automatic-close date; the handling groups by assignee (count, oldest, last activity, nearest ETA); the state-strip counts (all, waiting,
stuck, unassigned, closed this week, all closed); the department chips with counts; the floors tree with counts; the recently closed
(D21: this week or all). Filters: department, priority keys, assignee, place, stuck kind, waiting, text, state.

**The screen** `#/tickets/board` (tab "לוח מנהל" between "המחלקה" and "הכול", `TAB_PERMISSIONS` tickets.manage): mock-up v2's board -
title, department chips with counts, the state strip with counts, search, "+ חדשה", a one-line stuck banner with a jump, the sections
(ממתין לי / תקועות / בטיפול by assignee / נסגרו לאחרונה collapsed), reason chips on the cards (waiting reason, "תקועה · <reason> <time>",
"תיסגר אוטומטית"), the side tree / chips / filter panel, the drawer and the create form of slice 1, refresh every 30 s while visible.

**Settings** (`tickets.settings`, revision-checked, `system.configure`): `ui.board_floors` (tree | chips | chips_tree, default tree),
`ui.grouping` (no_status_filter | always | never), `ui.closed_strip` (all | week | hidden), `urgent_is_critical` (bool, default true);
served to everyone by `GET /tickets/module` (`ui`). Rows in Settings > the module > display (`tickets/board-settings.ts`, light DOM inside
slice 1's display card). Personal: `/me/prefs` `tickets.board.tree_hidden` (hidden | shown | null).

## 2. Readings taken (spec vs code, the safest one each time)

1. **Slice 2 merged (`origin/pilot/TICKETS-s2` @ 45208163).** Slice 2's `sla.py` stores the dues (`ack_due_at` / `stuck_due_at` /
   `resolve_due_at`, and `next_check_at` = the earliest due) at every change; its `policy.py` is the effective department policy. The
   monitor stays `stuck.py` (pure: the dues + "link not opened" + the reason + the ladder) and `monitor.py` (the step); a test proves
   `stuck.evaluate()` and `sla.compute()` give the same dues for every status. Both write `next_check_at`: slice 2 at a change (the earliest
   due - possibly already past, which only makes the monitor look sooner), the monitor after each look (the ladder's next step). The
   monitor reads the send window, `urgent_is_critical` and the automatic close through `policy.effective()` only and calls
   `sla.refresh()` after an automatic close. Conflicts resolved: `settings_doc.SCHEMA` (slice 2's `boolean` / links / send_hours + the
   three board ui keys), `tickets_admin.SettingsBody` (slice 2's, incl. `urgent_is_critical`), `system-tickets.ts` (slice 2's cards + the
   board rows in the display card; the D28 toggle is slice 2's, so the board rows carry none), `test_tickets_admin.py` (subset assertions).
2. **External reminders.** The message channel is slice 5b. `monitor.EXTERNAL_REMINDER` is the port: `fn(conn, ticket_row, n, now) -> bool`
   (5b registers its outbox `reminder` enqueue - the outbox keeps pacing, send hours and the link's sliding expiry). While it is None an
   outside assignee cannot be reminded, so the managers are alerted at the crossing (never a silent nothing). The `unopened` threshold reads
   slice 4's `ticket_links` only when the table exists (`store.current_link`).
3. **New category `tickets`** (spec 13.4) ripples outside the CR-018 files: the phone-app categories list (`mobile_push.categories`, its
   name is the module's default plural - that function has no database connection, so a rename does not reach the phone app's mute list;
   recorded), the push relay Worker's category allow-list (`services/push-relay/src/index.ts` - **needs a Worker redeploy**; until then an
   `app` delivery of a ticket row is refused by the relay; the `app` channel is off by default for every ticket source), and the frontend
   lists (`Category`, labels with the configured name, order, icon, `SubjectKind` + the four records keyed by it).
4. **Frontend source catalogue.** The settings matrix joins policies to the client catalogue; the ticket sources are a separate export
   `TICKET_SOURCES` joined in `system-notifications.ts`, so `SOURCE_CATALOG` (and every test counting it) is unchanged.
5. **Who gets `ticket.stuck` when a department has no manager member**: the tickets.manage + tickets.all_departments holders where the ticket
   lies (a stuck ticket is never told to nobody). `notify_new` stays exactly the flagged managers.
6. **Board scope.** "Department (only mine by default)": the board lists the tickets the caller MANAGES (`seen.manager`); an all-departments
   manager sees every department, a department manager only theirs. Non-manager members get 403 (the list screens are theirs).
7. **Grouping of "בטיפול" by assignee** is drawn as sub-headers inside the section only when there are two or more assignees.
8. **Capping.** Facets / board scan at most 2000 visible rows (`truncated: true` beyond); the board returns at most 500 open cards and 50
   closed ones (the table of 6b pages properly).
9. **Notification text and gender.** Labels of the policy matrix never name the module (a rename must not leave a stale word there);
   titles / bodies are rendered at emit time (rows already delivered keep their wording, as 14.3 says).
10. **The board tab** is offered for tickets.manage at any scope (`TAB_PERMISSIONS`); the server additionally requires a manager
    membership or tickets.all_departments and the screen shows "הלוח פתוח למנהלי מחלקות" otherwise.

## 3. Shared-file one-liners (for the integrator)

| File | Change |
|---|---|
| `services/notify_policy.py` | `CATEGORIES` + `tickets`; `RECIPIENT_RULES` + `ticket_managers`, `ticket_assignee`; `SUBJECT_KINDS` + `ticket`; `SOURCES += notify_sources` (2 lines); `list_policies` hides ticket sources while the module is off (2 lines) |
| `services/notify.py` | `recipients_for` branch for the two ticket rules (4 lines); `_default_link` `ticket` -> `#/tickets/<id>` (1) |
| `services/notify_visibility.py` | `can_see` branch `ticket` -> `notify_bridge.can_see` (4 lines) |
| `services/mobile_push.py` | `categories()` names the `tickets` category (2 lines) + `tests/test_mobile_push.py` expected list |
| `services/user_prefs.py` + `routers/me.py` | `tickets.board.tree_hidden` validator / default (3 lines) and the PrefsPatch field (1) |
| `services/tickets/settings_doc.py` (slice 2 owns) | `_bool` helper + 4 SCHEMA keys (board_floors, grouping, closed_strip, urgent_is_critical) |
| `routers/tickets_admin.py` (slice 2 owns) | `UiPatch` + 3 fields, `SettingsBody.urgent_is_critical` (StrictBool) + 2 lines in `put_settings`, import StrictBool |
| `services/tickets/store.py` | appended functions only (monitor / board / bridge readers; `monitor_rows_system`, `ticket_row_system`, `done_rows_system` are SYSTEM readers - a test lists their callers) |
| `services/tickets/retention.py` | calls the monitor first (1 line + a guarded helper) |
| `main.py` | mounts `routers/tickets_board.py` BEFORE `routers/tickets.py` (2 lines - the `{ticket_id}` pattern would swallow `/tickets/board`) |
| `services/push-relay/src/index.ts` | `tickets` in the category allow-list (redeploy) |
| `frontend/src/shell/nav.ts` | `TICKETS_BOARD_HREF`, the tab, `TAB_PERMISSIONS` row, `activeAreaTab` `board`, the `bt` import |
| `frontend/src/shell/sw-app.ts` | import + `s[1] === 'board'` route line (before the scope redirect) |
| `frontend/src/screens/system-tickets.ts` | `<ticket-board-settings>` in the display card + 2 imports |
| `frontend/src/tickets/ticket-card.ts` | `<slot name="chips">` |
| `frontend/src/tickets/model.ts` | `eventLine` cases for the monitor's rows + import |
| `frontend/src/tickets/icons.ts` | 4 icons |
| `frontend/src/api/notifications.ts`, `notifications-mock.ts`, `components/notify-logic.ts`, `screens/system-notifications.ts` | the category / subject kind / ticket sources (see 2.3 / 2.4) |

## 4. For the next slices

- **6b (table / kanban):** `GET /tickets/facets` is ready for the strip / tree counts of every view; `board.Filters` / `board.matches()` /
  `board.board_item()` (stuck reason, `sla_cell` = "בעוד 3 ש׳" / "חריגה 2 ימים", place keys, assignee key) are the row semantics to reuse
  for the table's stuck / SLA columns and filters; `user_prefs` gets `tickets.board` beside `tickets.board.tree_hidden`; the view switch
  goes into the board header's title row (`screens/tickets-board.ts header()`); the board route parser `tickets/board-model.ts` takes the
  extra params.
- **4:** call `notify_bridge.contact_changed(conn, ticket_id)` when a phone / e-mail change revokes links (`resolved=True` on reassign / new
  link); the monitor reads `ticket_links.created_at / first_opened_at / expires_at / cap_at / revoked_at` of the CURRENT assignment. When
  the monitor marks `waiting_reason = link_expired` (waiting for the manager), "new link" / "resend" must set `waiting_on` / `waiting_reason`
  back (`model.waiting_for(status)`) - the monitor sets it once and never clears it.
- **5a / 5b:** register `monitor.EXTERNAL_REMINDER` (outbox purpose `reminder`, same live link, extends the sliding expiry); call
  `notify_bridge.send_failed`, `reply_unmatched`, `channel_state` (and `messaging_accounts.state_transitions` -> `channel_state` per account).
  `hours.signal_severity` of msg-core and `notify_bridge.severity_of` implement the same D28 rule - keep one at integration.
- **9:** a required cost claim blocks the automatic close - `monitor.auto_close` is the place for the gate.

## 5. Tests

Backend (new): `tests/test_tickets_stuck.py` (pure, fake clock: every threshold, precedence, ETA, empty = off, the ladder incl. steps 0,
no cadence, catch-up, unassigned, cannot-remind, send window + DST, SLA cell), `tests/test_tickets_monitor.py` (the bridge's hooks and their
recipients / visibility / D33 / D28, the monitor's look, ladder and resolve on progress, automatic close, the tick and its throttle, the
external-reminder port, the system-reader guard), `tests/test_tickets_board.py` (the gate matrix, module off, route order, sections /
counts / chips / tree / filters / state strip, deny binding and floor scope removing rows from every count, facets per caller, the
display settings incl. 409 / 422 / 403, the personal tree choice). Frontend: `tests/unit-tickets-board.spec.ts`,
`tests/evidence-tickets-board.spec.ts` (evidence images in `docs/design/evidence/tickets-s6/`), `tests/layout-tickets-board.spec.ts` (five
skins x two themes x widths 320-1440).

Results (all on the runner, 2026-10-13/14):
- before the slice-2 merge, full backend suite @ 01bcd1b2: 7344 passed, 3 failed - `test_tickets_admin::test_display_settings_document`
  (fixed: subset assertions), `test_tickets_api::test_assignment_rules` (passes on the merged head), and
  `test_wiskey_door_path::test_d3_grant_card_switches_users_groups_and_custom_roles` (see below);
- merged head @ f772045a: tsc ok; tickets + touched backend suites (16 files) 291 passed, 1 failed (the same WisKey test); frontend unit
  specs (7 files) 119 passed; `evidence-tickets-board` desktop + phone 17 passed (1 phone skip: the tree is never drawn on a phone) and
  `layout-tickets-board` five skins x two themes x ten widths, all passed.
- **Not slice 6's:** `test_wiskey_door_path.py:302` asserts the exact built-in role list of the door-grant card; slice 1's six
  single-permission roles `tickets_*` (roles.json) appear there. It fails on slice 1's base too - for the integrator / slice 1.

Owner rename of 14.10 ("בקשת שירות" / "בקשות שירות", "ניהול השירות"): slice 6 writes no default noun in any visible text - every text
that names the module is a `{ticket}` / `{tickets}` template (board-text.ts, notify_bridge.py). The only places that still show the OLD
default are inherited: slice 1's `naming.DEFAULTS` / `DEFAULT_TICKET_NAMES` (used by `mobile_push.categories()` for the phone category
name) and slice 1's test mocks (`tests/tickets-mocks.ts` `/me` names; on the board screens the module route of the board's own mock,
`tests/tickets-board-mocks.ts`, already carries the new noun, so the slice-6 evidence shows "בקשות שירות").
