# CR-RESPONSE-MODELS-C-2470 - response models and generated client types for the batch-B routers (14 of 14)

Branch `pilot/CR-RESPONSE-MODELS-C-2470`. Base `origin/release/2450-train` (`521165ad4`), with `origin/pilot/CR-ROUTE-CHAR-2460`
(`345bea645`, the oracle coverage file and `scripts/wire_route_coverage.py`) merged first. Target 2.47.0. Code review finding 07:F8
step 2 (`MASTER_PLAN.md` 3.6), the routers whose SQL CR-ROUTER-SQL-B-2450 moved into store modules. Same rules as
`CR-RESPONSE-MODELS-B-2450.md` (WireModel, `**wire(Model)`, `exclude_unset`, int / float / `Num` / bool per value, stored documents as
`Any`). No route, status code, key, value or number type changed; no migration; no version bump.

The first session stopped at 12 of the 14 routers (usage ran out); a second session (20.11, `d9e8868bf`, `884bd8294`) added
`notifications` and `tickets_costs`, so every row of `tests/test_wire_routers_c_2470.py` passes.

The work ran in three parallel lanes (worktrees `smplwise-respmodelsc-a|b|c`, branches `pilot/CR-RESPONSE-MODELS-C-2470-a|b|c`,
merged here with git's default merge messages), one commit per router.

## What changed

| Router | JSON routes modelled | `NO_JSON` | Models | Lane commit |
|---|---|---|---|---|
| `views` | 4 | 0 | 3 | `6dec06f68` |
| `access_custom_roles` | 6 | 0 | 8 | `c7d2796dd` |
| `rules` | 7 | 1 (204 delete) | 7 | `8633b9aa9` |
| `notices` (`router` only) | 39 (`GET /notices/boards` is a union of the names-only and the full answer) | 3 (pictures) | 39 | `238dbf78c` |
| `calendar_feeds` | 5 (the `.ics` document is on `public_router`) | 0 | 4 | `6dac6675e` |
| `doors` | 17 | 0 | 44 | `f784f1fbd` |
| `door_windows` | 30 | 0 | 57 | `86aca3476` |
| `calendar` | 29 (25 on `router`, module state / settings / guest purge on `open_router`) | 1 (204 guest erase) | 46 | `cf0ace637` |
| `recorders` | 11 | 0 | see `wire/recorders.py` | `88ead4eb1` |
| `generator` | 24 | 0 | see `wire/generator.py` | `81b7ae54a` |
| `frigate` | 14 (discover reuses `wire/cameras.CameraSync`) | 7 (thumbnail, snapshot, HLS playlist / segments, three clips) | see `wire/frigate.py` | `1887753dc` |
| `devices` | 23 | 0 | see `wire/devices.py` | `e59e4ad3e` |
| `notifications` | 20 (inbox, summary, read-all, one row + read / snooze / ack, own deliveries, test push, push action; settings, policies, mail + its test, delivery log, stats) | 1 (snapshot) | 32 | `d9e8868bf` |
| `tickets_costs` | 11 (a ticket's costs + every cost write, the TK257 quote-decision alias, pending file, report, vendors account, bulk mark-paid, department defaults) | 3 (CSV export, file download, assembled PDF) | 33 | `884bd8294` |

Other changes:
- `scripts/gen_wire_types.py`: 14 new families (`18bf71b6e`), and `module_routes()` reads a router module's `open_router` too
  (`EXTRA_ROUTERS`, `d4766a7de`) - the calendar module state / settings live there. `scripts/wire_route_coverage.py` lists through it.
- `tests/test_wire_routers_c_2470.py`: the route table of the 14 routers (same checks as the batch-A file).
- New oracle tests for routes no existing test answered successfully: `test_wire_notices_2470.py` (board preview),
  `test_wire_doors_2470.py` (`DELETE /intercom/door-map/{entity_id}`), `test_wire_calendar_2470.py` (calendar restore, booking preview,
  the `open_router` routes in the route map), `test_wire_recorders_2470.py` (recorder connection test and save).
- Model class names are unique across all `smplwise/wire/*.py` (checked on the merged tree: no duplicate `class` name).

### Frontend

On the generated types (alias / `Pick` / `Omit`, narrowings documented in place): `api/views.ts`, `api/rules.ts`, `api/access.ts`
(custom roles; `RoleInfo` stays hand-written, `routers/access.py` is not modelled), `api/notices.ts`, `api/calendars.ts`, `api/doors.ts`,
`api/door-blocks.ts`, `api/door-windows.ts`, `api/recorders.ts`, `api/nvr-connection.ts`, `api/generator.ts`, `api/frigate.ts`,
`api/devices.ts`, `api/device-bulk.ts`, `api/home-config.ts`, `screens/device-types-logic.ts`, `screens/devices-climate-kind-admin.ts`,
`screens/protected-switches-logic.ts`; unit-spec fixtures given the fields the server always sends.

Drift the generated types found (no real client crash was found in these 12 routers; types only, behaviour unchanged):
1. Calendar booking preview: a conflict carries `event_id` and no `title`, so the clash hint never names the entry against a real
   server (only the demo store sends a title). Typed as such; a UI follow-up could look the title up (open question 1).
2. Calendar entry read also answers `history` / `guests_count` / `guests_visible` (now typed, optional).
3. Rules: the alert's `occurred_at` is always sent (was undeclared).
4. Notices: `Slide.updated_at` undeclared; the board create / patch / rotate / issue-link answers are full boards (were all-optional).
5. Generator: an alert type's `event` is a bool (client said string; nothing reads it).
6. NVR connection test: a Frigate test sends `transport` without `auth`, a pin-required test may send `certificate: null`.
7. Devices: bulk records' `requested_at` / `origin`, a protected switch's `platform` always sent (fixtures updated).
8. Ticket costs: a department's `active` is the stored `0` / `1` (client said boolean; only read as a truth value - typed
   `number | boolean`). The report group's `tickets` comes after the per-kind sums (order only). A revision always carries `basis`,
   a decision `internal_note` (undeclared before).
9. Notifications: a delivery row also carries `title`, `source`, `mode`; a policy `label`, `subject_kind`, `resolves`; the summary
   `center_layout`, `quiet_active`, `quiet_until`; the settings' `companion` three keys (client knew one); the stats `by_source`,
   `push_devices`, `app_relay`; the mail test `message`, `delivered`, `total`. All added (optional where the demo store does not build
   them). The admin delivery filter accepts channel `announce`, which the client's `Channel` union lacks (open question 4).

### notifications and tickets_costs (second session)

- `wire/notifications.py`, `wire/tickets_costs.py`, the routes decorated with `**wire(...)`; the FAMILIES rows already existed
  (`18bf71b6e`), generated `wire-notifications.ts`, `wire-tickets-costs.ts`.
- Passed through as built (typed `dict[str, Any]`): a ticket digest's list (notification row), a cost revision's lines and exceptional
  lines and a quote's lines (stored JSON), a claim's `basis` / `schedule_check` / `quote_check` (other services' documents). Typing those
  is a follow-up (open question 5).
- `frontend/src/api/notifications.ts` (a coordinator-owned contract file: types only, no behaviour) and `frontend/src/api/tickets-costs.ts`:
  the hand types `extend Omit<Wire.X, ...>` with the closed vocabularies narrowed (category, channel, subject kind, recipient rule;
  claim / revision status, kind, mode); fields the server always sends but the demo stores do not build stay optional, marked in place.
  The report, vendors-account, bulk-paid, pending-file and department answers are the generated types.
- New `tests/test_wire_tickets_costs_2470.py`: `GET /tickets/costs/departments` (no test read it) through the oracle.

## Tests

All on the workstation (`C:/cloude/smplwisebms/.venv`, `pytest -p no:xdist`, conftest sets `SW_WIRE_STRICT=1` + the oracle), PC at
100 % CPU throughout. Characterisation first: each lane ran its routers' suites with a scratch shape recorder (not committed) before
writing the models, then again under the strict oracle.

| What | Result |
|---|---|
| Lane A: views / access_custom_roles / rules suites (`test_saved_views`, `test_correlation_helper_2440`, `test_custom_roles`, `test_access`, `test_rbac_groups`, `test_rules`, `test_rbac_camera_scope`, `test_p2_batch`, `test_announcements`, `test_push`, `test_security_review_220`) + route table | 40 + 118 + 72 passed (the 30 route-table failures in that run were the other lanes' routers, not yet modelled) |
| Lane A: the 14 notices files, then `test_wire_notices_2470` + `test_lobby_styles_2300`, `test_notice_tvopt_295`, `test_notice_tvsettings_2380` | 139 + 113 + 121 passed; 135 passed |
| Lane B: calendar_feeds (`test_calendar_connect_2330`, `test_calendar_feed_review_2351`, `test_home_v3_p2`) | every route compared (55 answers); counts in the lane commit |
| Lane B: doors, 11 files + `test_wire_doors_2470` | 179 passed |
| Lane B: door_windows, 27 files | 443 passed, 1 failed: `test_fake_doorwin_closed_rule_sr1::test_open_primitives_are_pinned`, which fails on the base too (not this row) |
| Lane B: calendar, 10 files + `test_wire_calendar_2470` | 259 passed, 2 skipped |
| Lane C: recorders / generator / frigate / devices suites under the strict oracle | run by the lane (commit bodies: answers unchanged); exact counts NOT reported - the lane stopped at its turn limit |
| Merged head: `test_wire_routers_c_2470.py`, `test_wire_routers_b_2450.py`, `test_wire_consumption_2450.py`, `test_wire_route_coverage_2460.py`, `-k "not tickets_costs and not notifications"` | exit 0 (all selected passed; the count line was not captured) |
| `scripts/gen_wire_types.py --check` (merged head) | rc 0 |
| ruff (F rules): `smplwise/wire`, `smplwise/routers`, both scripts, the new tests (merged head) | All checks passed |
| Frontend `tsc --noEmit -p tsconfig.tests.json` | lanes: 0 errors each; merged head: 0 errors (rc 0) |
| Lane A: ESLint (4 files) clean; unit specs 9 files 58 passed + 1 fixed and re-run 3/3; browser specs (Vite dev, desktop, 1 worker) 10 specs 56 passed, 5 skipped (need a live backend: custom roles, delegation x2, kiosk, rules - NOT_RUN in effect) | |
| Lanes B / C: ESLint, unit and browser specs | NOT reported (lanes stopped at their turn limit) - treat as NOT_RUN |
| Second session (20.11): notifications, the 6 suites (`test_notify_core`, `test_notify_email`, `test_home_interface`, `test_local_auth_inventory`, `test_second_factor_followups`, `test_xsecfix_297`) under the strict oracle | 163 passed, 0 failed (rc 0); 19 of the 20 JSON routes compared (not `POST /notifications/test`, see Remaining 5) |
| Second session: tickets_costs, `test_tickets_vendor_accounts` + `test_tickets_quotes` under the strict oracle | 19 passed, 0 failed (rc 0) |
| Second session: tickets_costs, the 14 ticket suites in one strict run | STOPPED UNFINISHED at the session's time limit: ~91 of ~257 tests ran (`test_tickets_costs` .. into `test_tickets_detail`), 0 failures, 1 skip; PC at 100 % CPU (other agents) |
| Second session: `test_wire_tickets_costs_2470` | 1 passed |
| Second session: all 11 tickets_costs JSON routes compared by the oracle across the runs above | yes (report, claims, bulk mark-paid, GET costs, requirement, decision, quote-decision alias, pending file, on-behalf, department GET / PUT) |
| Second session: `test_wire_routers_c_2470`, `test_wire_routers_b_2450`, `test_wire_consumption_2450`, `test_wire_route_coverage_2460` (head `884bd8294`) | 142 passed, 0 failed |
| Second session: `gen_wire_types.py --check` | rc 0 |
| Second session: ruff (`smplwise/wire`, both routers, the generator, both test files) | All checks passed |
| Second session: ESLint `api/notifications.ts`, `api/tickets-costs.ts` | rc 0 |
| Second session: `tsc --noEmit -p tsconfig.tests.json` | 0 errors (rc 0) with both modules edited; final run on the head: see below |
| NOT_RUN | full backend suite, unit / browser specs of the notification center and the costs tab, tablet / mobile projects, pixel specs, anything on the runner (gates were running) | |

No pixel change is expected (types only); no baseline refreshed.

## Remaining

1. Done in the second session: `tickets_costs` and `notifications`.
2. Lanes B / C: ESLint, unit and browser specs on the merged head (the second session linted its two modules only).
5. `POST /notifications/test` answered only with refusals in the suites (no registered device): its model follows
   services/notify_channels.send_test but no successful answer was compared by the oracle.
6. The full strict run of the 14 ticket suites did not finish inside the session (see Tests); finish it before the train.
3. `notices.open_router` (module, settings, logos, news sources) and the login-free TV routers are not modelled; the generator now
   reads `open_router`, so modelling them puts them in `wire-notices.ts`.
4. `routers/access.py` role list (`RoleInfo`) not modelled.

## Open questions (recommendation)

1. Calendar clash hint without a title against a real server: add `title` to the preview's conflicts (server) - recommended - or look it
   up on the client.
2. Model `notices.open_router` and `routers/access.py` in a follow-up row - recommended yes.
3. Vite's dependency cache sits in the shared `node_modules` junction: parallel lanes should run their Vite servers one at a time.
4. The admin delivery log accepts and shows channel `announce` (the lobby announcement channel) but the client's `Channel` union lacks
   it: add `announce` to `Channel` and `CHANNEL_LABEL` (recommended) - a contract change of `api/notifications.ts`, so the coordinator's.
5. Type the passed-through cost documents (`basis`, `schedule_check`, `quote_check`, stored lines) in a follow-up row - recommended,
   together with `GET /tickets/{id}/quotes` (routers/tickets_detail, same quote block, not modelled).
