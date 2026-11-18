# CR-W2-FOLLOWUPS-2441 - the backend follow-ups of code-review wave 2

Branch `pilot/CR-W2-FOLLOWUPS-2441`, based on `origin/pilot/CR-W3-BE-COMBINED-2441` (`b49cca9bc`). Backend only.
Sources: `docs/changes/CR-WAVE2-COMBINED-2439.md` ("Follow-ups"), `docs/changes/CR-W3-BE-COMBINED-2441.md` ("For the lead" (b)),
`docs/changes/CR-TK-TIMEUTIL-2438.md` ("Follow-ups").

## 1. `routers/wiskey_lineage.py` gates through `rbac.require_system_admin`

The router's own `_gate` wrote the two steps of the system-administrator gate by hand (`require("system.configure")`, then
`is_system_admin` with its own audit row). It now calls `rbac.require_system_admin(conn, principal, action=..., text=...,
request_id=..., resource_type="wiskey_lineage")`, like the other WisKey administrator routes. The third step the shared gate does
not have - `interactive_only` for the three POST actions - stays in `_gate`, after the shared call.

Unchanged: the order of the refusals, the status and codes (`forbidden` / `not_system_admin` / `interactive_only`, all 403), both
Hebrew texts, the audit rows (same action, `resource_type = wiskey_lineage`, `resource_id = *`, reason, request id), the connection
each route uses (read connection for the GET, its own write connection for the POSTs) and the thread-pool hop of `resolve`.

Tests (in `tests/test_admin_gate_2438.py`): each of the four routes refuses a user without `system.configure` (403 `forbidden`)
and a `system.configure` holder who is not a system administrator (403 `not_system_admin`, the route's text, the audit row); the
module no longer names `is_system_admin`.

## 2. The notify module's active-user lists use the one rule

`services/active_users.py` gains the list form of `has_active_account`:

- `ACTIVE_ACCOUNT_SQL` - a WHERE condition over `users`: `users.active = 1` and no `ha_users` row with `is_active = 0`;
- `active_account_ids(conn)` - those ids, in id order, one statement.

Used by `notify_recipients.active_user_ids` (feeds `expand`, `validate`, `Known`), `notify._active_users` (the `scope` and
`energy_bills` recipients, the emergency engine's count) and `notify_visibility.active_principals` (the managers, the maintenance
reminders). No statement was added on any path (one statement before, one after).

**Why not `active_users.active_user_ids`** (what the wave-2 note named): that set also holds people known ONLY to the Home
Assistant directory. A notification goes to a `users` row (its inbox, `principal_of`); such a person has none, so `validate` would
accept a recipient nothing can be delivered to. The list form of `has_active_account` is the same rule (owner decision O16 a) for
"an Arx account".

**Behaviour.** Identical whenever the two sides agree (the normal state: `routers/ha_users._set_active` writes both). The only
difference is the drift case the one rule exists for: a user with `users.active = 1` whose `ha_users` row says `is_active = 0`
is no longer in these lists. `rbac.authorize` already refuses such a user (CR-ADMIN-GATE-2438), so the visibility step of
`notify.recipients_for` already dropped them from every notification whose subject is checked by permission; what changes is that
they can no longer be SAVED as a named recipient (`recipient_user`) and are not counted. Nobody is added to any list.

Tests (in `tests/test_active_user_rest_2438.py`): the three lists equal `has_active_account` per user, in id order; the HA-disabled
and the HA-only person are out; with the two sides in agreement the list equals the old statement's; the three notify modules
no longer read `FROM users WHERE active = 1`.

### Next row: the other builders of an active-user list (NOT changed here)

The three "local copies" the wave-2 note named (`routers/access.py`, `services/tickets/store.py`,
`services/tickets/store_rfq.py`) already delegate to `services/active_users` (CR-RBAC-EVAL-2438); nothing to do.
The rest still read `users.active = 1` on their own. Each is a behaviour change in the drift case and several feed a picker whose
tests pin the listed people, so they are one row of their own (suggested: `CR-ACTIVE-USER-LISTS`), using `ACTIVE_ACCOUNT_SQL`:

Id sets / lists (same shape as this branch's three):
- `services/generator_alerts.py:601` (known users of a recipients save)
- `services/temperature_whatsapp.py:169` (active set), `:131` (picker with names)
- `services/insights_delivery.py:147` (active set), `:187` (picker with names)
- `services/emergency/engine.py:367` (active set of the reachable-contacts check)
- `services/notify_whatsapp.py:923` (the notice filter; a statement-count test pins it: `test_notify_fanout_2436`)
- `services/notices/audience.py:76` (the notice-board audience)
- `services/access_readiness.py:173`, `services/bridge_key_notice.py:73` (administrators among the active users)
- `rbac.py:578` (`admin_count`: already subtracts the HA-disabled by hand - can use the constant)

Pickers and directories (id + names):
- `routers/alarm.py:858`, `routers/tickets_admin_settings.py:54`, `services/access_request.py:179`,
  `services/home_interface.py:367`, `services/maintenance/service.py:940`, `services/scenarios.py:874`,
  `services/calendar/attendees.py:492`, `services/local_passkeys.py:189`

Per-id reads the no-drift guard does not match (`SELECT ... WHERE id = ? AND active = 1`, or `active` read with other columns):
- `services/notify_visibility.principal_of` / `principals_of`, `services/calendar/calendars.py:34`,
  `services/calendar/attendees.py:211`, `services/calendar/attendee_notices.py:347`, `services/maintenance/service.py:274`

Joins: `services/readiness.py:192`, `services/home_family.py:107`, `services/presence_people.py:194` (`u.active = 1` in a join).

Reports that count rows on purpose (`services/fleet_report.py:283` `users_active`) and `routers/wall.py:270` (a list of the HA
directory itself) are not candidates.

## 3. `GET /presence/config` and `GET /presence/people` answer while the write lock is held

Both routes already ran on a read connection of their own (`mode="read"`); the 500 `database_busy` came from three side writes
(`db.write_aside`, which waits `BUSY_TIMEOUT_S` = 10 s for the lock and then fails the request):

| route | side write | now |
|---|---|---|
| config (any caller) | the installation's push id, created by the first read (`push.server_id`) | created once at start-up: `startup_steps.ensure_push_server_id` (last `AFTER_MIGRATE` step, guarded like its neighbours). The read keeps its lazy creation for a database where the step failed |
| config (device token) | the phone's `last_seen_at` stamp, on every call | waits `SIDE_WAIT_S` (0.5 s) for the lock, then is skipped: the next poll stamps it |
| people | the throttled `presence.people.view` audit row (one per viewer per 10 minutes, counts only) | waits 0.5 s, then the row is left for the viewer's NEXT request: the throttle is not started (`presence_people.audit_missed`) and a warning is logged |

Unchanged: every answer body, the refusal of `GET /presence/people` (its `denied` audit row is still written before the 403, with
the full wait - a refusal is never answered unrecorded), the once-a-minute `touch_user` of a session (the pattern of every read
route), and everything while the lock is free (each row is written in the same request as before).

**For the lead - one decision inside this item.** With the lock busy for more than 0.5 s, a `presence.people` answer (sensitive:
who is inside) leaves before its `allowed` audit row exists; the row is written by the viewer's next poll, or never if the viewer
does not come back. That is the price of "this read answers under a held lock". The alternatives are the READCONN-B question
(success-audit GETs): keep the full wait (the 500 stays), or a longer `SIDE_WAIT_S`. It is one constant in `routers/presence.py`.

Tests (in `tests/test_presence.py`): with another connection holding the write lock, `GET /presence/config` (session, and device
token) and `GET /presence/people` answer 200; nothing was written meanwhile; after the release the next poll writes the audit row
(once) and the stamp. The lazy creation of a deleted push id still works. `tests/test_routers_table_2440.py` lists the new step.

Not covered: `tests/test_get_routes_read_conn.py` still skips the presence routes in its behaviour sweep (they take no request
connection, so its "labelled request connection" assertion does not apply); the new test is the lock-held check for these two.

## 4. `services/timeutil.zone` answers the default for an unusable name

`zone()` now also catches `OSError`: a name that is a tzdata directory (`"Asia"`) made `ZoneInfo` raise `PermissionError` /
`IsADirectoryError`, which reached the caller. Lead decision 14.11 (`CR-TK-TIMEUTIL-2438`, "Follow-ups"). The other readers with
the same two-exception catch (`routers/settings_patch/site.py:75`, `door_windows.py:166`, `door_window_program.py:81`,
`intercom_writes.py:452`, `recorders/provision_time.py:192`, `site_location.py:58`, `wiskey_door_tech.py:291`) are not touched:
whether a save should REFUSE such a name (the validators) or fall back (the readers) differs per site.

Test (in `tests/test_timeutil_formats.py`): three directory-like names answer the default zone.

## Tests actually run

Workstation (Windows, Python 3.12 venv, `-p no:xdist`, twelve agents on the PC), on the final tree:

- One run of 23 files, 485 tests: `test_admin_gate_2438`, `test_authrevoke_2435`, `test_wkr5_295_writer`,
  `test_router_common_helpers`, `test_async_routes_no_inline_db`, `test_active_user_rest_2438`, `test_timeutil_formats`,
  `test_tickets_timeutil`, `test_routers_table_2440`, `test_presence`, `test_whoin034_295`, `test_area_presence_line_2351`,
  `test_mobile_push`, `test_notify_recipients`, `test_notify_fanout_2436`, `test_notify_core`, `test_notify_sources`,
  `test_elevator_alert_recipients_295`, `test_water_alerts_s2`, `test_emergency_readiness_295`, `test_db_gate`,
  `test_singletons_registered`, `test_gate_always_run` - **462 passed, 23 failed**:
  - 22 in `test_notify_recipients`: its hand-made in-memory schema had no `ha_users` table (`no such table`). The table was added
    to that fixture (test-only); the file then passed whole.
  - 1 in `test_db_gate` (`test_one_attempt_never_waits_longer_than_the_busy_timeout`: 2.47 s against a 1.5 s bound, a stopwatch
    under machine load; this branch does not touch `db.py`). Passed on the re-run.
- Re-run after the fixture fix: `test_notify_recipients` + `test_db_gate` + the two new presence tests - **69 passed, 0 failed**.
- `test_get_routes_read_conn -k "lineage or allow_listed or well_formed or presence"` - **4 passed** (the inventory, and the
  lineage GET under a held write lock). The other ~710 parametrised routes of that file were NOT run here.

Found on the base (`b49cca9bc`) and fixed in a commit of its own: `test_router_common_helpers::
test_the_waiting_list_names_only_routers_that_still_hold_a_copy` failed with `remove from WAITING: ['access']` (the split of
`routers/access.py` left it without a helper copy). `access` was removed from the list.

## NOT_RUN

- The full backend suite, Playwright, pixel / layout runs: the runner entry check (queued by the lead; none queued here).
- No device or lab access.

## Pixels to refresh

None (backend only).

## Entry check 1 (`09f2e6e94`, RED) - the combined branch merged, one golden list (17.11.2026)

Runner verdict: 10 failures outside the quarantine. No guard was loosened and nothing was quarantined.

### Nine failures of the base - merged, not redone

The maintenance scan on a read connection, the `test_capmap_295` / `test_wk4adopt_295` hash pins, the stream-batch label, the
two provision `Proc` fakes and the tickets column spec path are failures of the wave-2 base and are fixed on
`pilot/CR-W3-BE-COMBINED-2441` at `35bcf973e` (its note, "Entry check 1"). That branch was merged here
(`git merge --no-ff`, merge commit `d2ebbafb8`): **no conflicts**. The merge also brings main 2.43.7 (`cc69447f1`: the
version, the built UI, `services/home_interface.py`). `cf06aa896` ("'access' leaves the helper waiting list") merged cleanly
with the same change on the other side.

### One failure of this branch: `test_bill_ledger_lifecycle_b::test_automatic_generation_statements_labels_logs_and_outcomes_are_unchanged[energy]`

A golden list of the SQL statements of an automatic bill generation (`tests/fixtures/bill_ledger_b_sql_golden.json`). 13
entries of `auto:energy` (`auto_first_pass` 8, `auto_before_retry` 3, `auto_after_retry` 2) were
`SELECT id FROM users WHERE active = 1 ORDER BY id` and are now the one rule's statement
(`... WHERE users.active = 1 AND NOT EXISTS (SELECT 1 FROM ha_users h WHERE h.id = users.id AND h.is_active = 0) ORDER BY id`).

**Cause.** That statement is not the billing code: it is `notify._active_users`, the candidates of the recipient rule
`energy_bills` - the notification "a draft bill is ready" (`energy.bill_draft`) that `services/energy_notify.draft_ready`
emits to the STAFF who hold `energy.bills`. Item 2 above changed it on purpose and names it ("the `scope` and `energy_bills` recipients"). The test is
stale; the golden was regenerated for the `auto` section only (`SW_BILL_LEDGER_GOLDEN_WRITE=1`) and compared with the old
file: the same keys, the same number of statements per list, only these 13 entries differ. `auto:water`, `drafts:*` and
`retention:*` are byte-identical. Statement count, order, labels, logs and outcomes are unchanged.

**Behaviour for billing.** None on who gets a bill: accounts, customers, periods, amounts, numbering and PDFs do not read
this list (`services/energy_billing.py` and `services/bill_ledger.py` have no active-user read). The only list that moved is the staff notification's candidates, and
only in the drift case (a user with `users.active = 1` whose `ha_users` row says `is_active = 0`). Such a user was already
dropped from this notification by the visibility step (`rbac.authorize` refuses them since CR-ADMIN-GATE-2438, and the
subject kind `energy_bills` is checked by permission), so the people notified are the same before and after.

### Tests actually run (workstation, `.venv` of the main checkout, `pytest -p no:xdist`, on the merged tree)

- One process, 11 files in full: `test_bill_ledger_lifecycle_b`, `test_singletons_registered`, `test_wk4adopt_295`,
  `test_nvr_stream_batch_review_fixes`, `test_maintenance_215`, `test_capmap_295`, `test_provision_playback`,
  `test_active_user_rest_2438`, `test_router_common_helpers`, `test_async_routes_no_inline_db`, `test_home_interface` -
  **305 passed, 0 failed**. The merge had no conflict list; the files are the failing tests' files, the files the merge
  changed and this branch's own.

### NOT_RUN

- `unit-tickets-1440-column-setting-2360.spec.ts`, `tsc`, the full backend suite, Playwright, pixels: the entry check.
- No device or lab access.

## Entry check 2 (59e4215fe, 18.11 01:04) - 2 preview failures

Runner file `~/smplwise-results/entry/gate_pilot-CR-W2-FOLLOWUPS-2441_59e4215fe.json`; both failed in the full run and
again alone (mobile, 60 s timeout). Runner load at the time: max load1 57, memory down to 371 MB available. This branch
touches neither screen (no change under `devices-building`, `tree-unassigned` or the multimedia settings).

### 1. `evidence-tree-unassigned-2331.spec.ts:80` [mobile] - "הסתר מהעץ" and its undo notice

**What failed.** `locator.click` on the notice's "בטל" (line 99) waited until the timeout: the notice was already gone.
**History on main.** The same test FAILED (also alone) in the nightly of main 0a8fb55e1 (14.11), was FLAKY in the
nightly of main ccb77f28d (05.11) and in today's entry check of pilot/CR-I18N-COMBINED-C-2442 - not caused by this branch.
**Cause.** `devices-building.showLooseNote` closes the notice 8 s after it opens, unconditionally. The screen moves the
keyboard focus into the notice (its "בטל", because the row it was on is gone) and the test asserts that focus, takes a
screenshot and measures the overflow, then presses "בטל". On a loaded runner the phone screenshot alone took more than the
8 s, so the notice closed under the focus and the click found nothing. The same thing is a real defect for a user: a keyboard
or screen-reader user standing on "בטל" lost both the undo and the focus (dropped to the page) when the 8 s ran out
(WCAG 2.2.1 timing adjustable, 2.4.3 focus order).
**Fix (code, not the test).** `expireLooseNote`: at the 8 s mark the notice stays while it holds the focus (`:focus-within`)
or the pointer (`:hover`), looks again every 2 s and closes once both have left. Close ("×"), "בטל", a refused save and
leaving the screen behave as before; a notice nobody is on still closes at 8 s. The test is unchanged.

### 2. `evidence-system-multimedia.spec.ts:261` [mobile] - connection: MA, Sonos, library unavailable

**What failed.** `page.screenshot` at the end (line 283 -> `shot`) ran into the 60 s test timeout.
**History on main.** FLAKY with the same timeout in the nightly of main 4a345f8af (15.11) - not caused by this branch.
**Cause.** The test boots the whole app three times (`open` x3, two `install`s) and ends with a screenshot - three tests'
worth of work under the 60 s of a one-boot test. On a loaded runner the last step is the one that runs out. The product
behaviour asserted is right; only the budget is short.
**Fix (test budget).** `test.setTimeout(120_000)` for this one test, with the reason in a comment (the repository's usual
form for multi-boot evidence tests, e.g. `evidence-area-redesign.spec.ts`). No assertion changed; not quarantined.

### Tests actually run (entry check 2 fixes)

- Workstation: `npx tsc --noEmit` on the worktree - rc 0.
- Runner, own checkout `~/work/w2fu` (59e4215fe + this change, removed after), `npx vite build` (rc 0), then
  `evidence-tree-unassigned-2331.spec.ts` + `evidence-system-multimedia.spec.ts`, `--project=mobile --workers=1`, private
  port, runner load about 31-36 (the nightly running): **19 passed, 0 failed, 2 skipped** - both failing tests among the passes
  (tree :80 in 7.1 s).

### NOT_RUN

- desktop / tablet projects of the two files, the rest of Playwright, pixels, backend: the entry check.
- No test of the notice outliving 8 s with the focus on it was added (the existing test covers the focus; timing proof is
  the entry check under load).
