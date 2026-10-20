# Release-gate test hygiene audit (GATEHYGIENE-291, 2026-10-20)

Branch `pilot/GATEHYGIENE-291`, cut from `origin/integ/290-rel` @ `ca56b9d5b`. Test-only and gate-tooling changes; no product code.
Trigger: the 2.9.0 tier-L gate (about 140 min) went red on two STALE tests, not product bugs, plus 1 flaky preview test, 2 flaky
backend tests (passed alone) and 41 warn-only visual differences.

What a red gate should mean: a product regression. Everything below either removes a way a test goes stale, or makes a
re-check cheaper when one does.

## 0. Summary

| # | Finding | Done on this branch | Left open |
|---|---|---|---|
| 1 | Tests that copy a settings block by hand break when another feature adds a key | `test_tickets_board` derives the `ui` block from `settings_doc.SCHEMA`; shared `hygiene.assert_defaults()`; schema self-consistency and safe-default guards | 4 smaller whole-dict expectations listed below |
| 2 | Tests that ask the MACHINE for "today" (runner is Etc/UTC, the product counts by the installation zone) | helper `tests/hygiene.py` (`installation_today/installation_day`); 5 call sites fixed; a fixed +03:00 day fixed (DST trap from 25.10); a lint test forbids the patterns; `clock_shift.py` false-failure fixed; Node side of Playwright runs in Asia/Jerusalem | review of `datetime.now(UTC)`-relative tests that are correct but clock-dependent (listed) |
| 3 | Flaky tests | known flaky spots hardened (tabs-ui one-shot reads); dashboard wall-clock budget replaced in the gate by a deterministic scaling guard | the 2.9.0 flaky NAMES are only in the runner's gate report (not readable from this workstation): see the triage recipe |
| 4 | Gate efficiency | `scripts/gate/targeted_plan.py` (fast tier / red-gate rule, unit-tested) | the larger cuts need one look at the runner's phase timings; proposals with estimates below |
| 5 | Missing coverage 2.8.0-2.9.1 | dashboard speed-fix scaling guard; notification sources decided OFF; public/privacy switches OFF; schema defaults valid | gaps on the unmerged 2.9.1 branches (listed per branch), incl. one suspected product bug |
| 6 | Fast gate tier + red-gate rule | written below and enforced mechanically by `targeted_plan.py` | owner confirmation of the exact skip list |

## 1. Values copied from product settings / constants

**The 2.9.0 red** (`test_tickets_board::test_display_settings_d19_d21_and_d28`): the test compared GET `/tickets/module` `ui` with a
hand-written 16-key dict. MGRDASH phase 5 added `dash_digest_hour` / `dash_dept_stuck` (with their own tests) and broke this unrelated
test.

Fixed: the expected block is now `hygiene.schema_defaults(settings_doc.SCHEMA, "ui")`; only the decisions the test is about (D18-D22)
are pinned by hand. `hygiene.assert_defaults(actual, expected, pinned=...)` reports, by name: a pinned key that left the source, a
pinned default that changed, a key served but not in the source (or the reverse), and any served value that differs from its default.
A NEW key extends the expectation by itself. The owner defaults of the other keys stay pinned in their own feature tests
(`test_tickets_mgrdash_settings`, `test_tickets_mgrdash_alerts`, `test_tickets_handler_load`).

Guards added (`tests/test_gate_hygiene.py`):
- every `settings_doc.SCHEMA` default passes its own validator unchanged (78 parametrised cases, under a second) - a new setting is well-formed by
  construction, so schema-derived expectations stay true;
- a fresh installation reads exactly the schema defaults, block by block;
- the public / privacy switches that ship OFF (WhatsApp, vendor portal and its RFQ / technician parts, vendor uploads, office
  attachments, full phones for managers, phone verification, arrival schedule) and the two that ship ON as protections
  (`vendor_portal.require_confirmed_number`, `staff_links.require_code`) are pinned one by one with the decision they come from.

Remaining whole-dict expectations of a defaults block (lower risk - the dict is built by hand in the product too, so a new key there is a
deliberate change of the same route; convert when next touched, with `hygiene.assert_defaults`):

| Test | Expectation |
|---|---|
| `test_announcements.py:59` `test_off_by_default_and_nothing_spoken` | the whole announcement config (17 keys incl. quiet hours) |
| `test_automations_api.py:25` | the 5-key `ui` projection of `automation_settings.DEFAULTS` |
| `test_tickets_s2.py:149` | the 3-key `links` block (could derive from `settings_doc.SCHEMA`) |
| `test_tickets_vendor_portal.py:802` | the `brand` block |
| (branch TKNOTIFMATRIX-291) `test_tickets_notify_matrix.py:83` | the whole 7-key `notify` block - derive from `settings_doc` before merging |

Good example already in the suite: `test_plan_view_settings.py:59` derives from `pv.SITE_DIALS`.

## 2. Time-dependent tests

The runner is Etc/UTC; the installation zone is `time.zone` (default Asia/Jerusalem, UTC+3 until 2026-10-25, then UTC+2). Between the
installation's midnight and the machine's (21:00/22:00 UTC) the two calendar days differ. The product itself is clean: no
`date.today()`, zone-less `datetime.now()` or `localtime()` anywhere in `smplwise/` (grep, 2026-10-20).

**Shared helper** `smplwise_vms/backend/tests/hygiene.py`: `installation_zone(conn=None)` (the product's `time_zone(conn)` reader when a
connection is given), `installation_today(days=0, conn=None, now=None)`, `installation_day(...)` (ISO text). Aware `now` only.

Fixed:

| Test | Problem | Fix |
|---|---|---|
| `test_tickets_table::test_monthly_report_cap_returns_413` (2.9.0 red) | machine `date.today()` vs the report's installation day | rows pinned to a FIXED instant (2026-07-03T21:30Z = 4 July 00:30 local); asks 4 July (413) AND 3 July (200) - now also proves the bucketing is by installation day |
| `test_events_cache::test_timeline_is_cached_and_invalidated` | local day from a fixed `+03:00`: wrong every evening 21:00-22:00 UTC from 25.10 (DST end), and in the first 5 min after midnight | the installation's yesterday 12:00; asserts the event is inside the asked day |
| `test_tickets_vendor_accounts` (`TODAY`, the "future date" case) | `date.today()` | `installation_day()` / `installation_day(5)` |
| `test_tickets_costs:271`, `test_tickets_tk251r:98` | `payment_date=date.today()` | `installation_day()` |

Guard: `test_gate_hygiene::test_no_test_asks_the_machine_for_today` fails on `date.today()`, a zone-less `datetime.now()` /
`today()`, `utcnow()`, or a calendar day read through a fixed `timedelta(hours=3)` in any `tests/test_*.py` (reviewed exceptions in
`ALLOWED`, each with its reason; a docstring that names the call in backticks is not a call).

`tests/clock_shift.py` (run the suite at another wall-clock instant) gave FALSE failures: it swapped `datetime.date` before `sqlite3`
was imported, so sqlite3's default adapters were registered for the fakes and every real `date` bound as a parameter failed
("type 'datetime.date' is not supported", e.g. `energy_billing` due dates). Fixed: sqlite3 is imported before the swap and the fakes get
ISO adapters. (Side note, not a bug today: `services/energy_billing.py:658` binds a `date` object and so relies on sqlite3's DEPRECATED
default adapter - DeprecationWarning on Python 3.12; worth an explicit `.isoformat()` when that module is next touched.)

Frontend: `playwright.config.ts` / `playwright.unit.config.ts` set `process.env.TZ = SW_TEST_TZ || 'Asia/Jerusalem'` before the workers
start. The browser already ran in `timezoneId: 'Asia/Jerusalem'`; the Node side (expected dates computed in the spec, e.g.
`evidence-tickets-3b` `local()`/`day()` which says "in the browser's zone", and the unit specs that run product modules in Node) ran in
the runner's UTC - "today" in the test and "today" on the page differed 21:00-24:00 UTC, and never on a workstation in Israel.
`SW_TEST_TZ=UTC` reproduces the old behaviour. 241 Node-side `new Date()`/`Date.now()` uses in 104 specs were not individually
reviewed; the zone fix covers the day-boundary class of them.

Clock-relative tests that are correct but read the real clock (instants, not days; no change needed): `test_tickets_qvalid` (`_at`,
UTC-day `_day` checked against an `T23:59:59Z` end), `test_rbac_camera_scope._today` (only 403 vs not-403), `test_backpressure`,
`test_db_*` (`device_time` with an explicit offset = a correct instant).

Wall-clock sweep with the fixed `clock_shift` (the 18 most date-sensitive files, 3 local shards, at `2026-11-01T00:05+02:00` with
`SW_FAKE_LOCAL_TZ=UTC`, i.e. the UTC runner at 22:05 on 31 October = installation day AND month boundary, after DST): result in the
"Runs" section.

## 3. Flaky tests

The 2.9.0 gate's FLAKY names live in `~/smplwise-results/gate_integ-290-rel_<sha>.md` on the runner (this task had no runner access).
Known history and state:
- 2.2.0 / 2.4.6 gate flakies: root-caused and fixed (`docs/release/TEST_POLICY.md`, tables). Pattern: a ONE-SHOT read right after an
  action (`expect(await x)`), satisfied by a state the page has before the action lands. This branch additionally makes the remaining
  one-shot reads of `evidence-tabs-ui` retrying (`expect.poll`, and the "hidden tab" check can no longer pass on an undrawn row).
- `unit-devices-tiles.spec.ts:116 [mobile]`: still NOT root-caused (TEST_POLICY row). It is not quarantined; keep it visible.
- Backend load-flaky pattern: wall-clock bounds under 3 shards + Playwright on one box (e.g. `test_generator` live summary in 2.5.6).
  The suite already scales such bounds with `conftest.sw_load_factor()`; the new MGRDASH perf test is opt-in (`SW_DASH_PERF=1`).
- The suite has 1,368 `expect(await ...)` one-shot assertions in 208 specs. Most read static state and are fine; the risky ones are the
  first read after `click`/`goto`. Rule for new specs (added to TEST_POLICY guidance): after an action, use a web-first assertion or
  `expect.poll`, and never a negative assertion (`not.toContain`, `toHaveCount(0)`) that an undrawn page already satisfies.

Quarantine rule (never a silent skip): a test that fails in a gate and passes alone twice in a row goes to `~/known_issues.json` with
an expiry and a named owner task - it is then reported as KNOWN in every gate, not hidden - and gets a root-cause task. No `skip` /
`fixme` without a reason string and a task id.

Triage recipe for the 2.9.0 flakies (one command each, after the next gate frees the lock): `run_smart.py backend <branch> <node ids>
--sw-repeat 20` with the CPU burner (backend), `run_smart.py preview <branch> <spec> -g "<title>" --repeat-each=15` (preview) - the
2.4.6 method in TEST_POLICY.

## 4. Gate efficiency (where the 140 minutes go)

Measured data available here: `scripts/gate/gate_durations.json` (per-spec seconds, summed over projects, from the 2.4.10 gate:
106 min, ~260 of today's 609 spec files) and the engine's structure. The per-phase seconds of the 2.9.0 run are in the gate report's
"שלבים" section on the runner - read them before acting on the estimates below.

Structure (tier L, `release_gate.py main()`): npm ci -> backend 3 shards START (in the background) -> tsc -> vite build -> release_check
-> **preview** (all "rest" specs, one process per (projects, workers=1) group, 3 workers) -> **pixel** (one Playwright process PER pixel
spec, sequential, workers=1) -> fixture -> **visual matrix** (warn-only, sequential, capped at 25 min) -> **dev server** specs -> wait
for backend. Everything after the build is sequential except the groups inside one phase and the backend.

Where the time is (2.4.10 seed, summed test seconds): evidence-* 16,075 s (50 %), layout-* 12,794 s (40 %), unit-* 1,407 s, the rest
~1,800 s. Preview tests grew 7,960 -> 11,312 and backend 6,200 -> 11,213 since then.

Proposals (none lowers the coverage of auth, permissions, door access, money or migrations - those are backend tests and the
permission/security specs, which every proposal keeps in full):

| # | Change | Estimated saving | Risk |
|---|---|---|---|
| E1 | **Fast tier for a test-only / doc-only re-gate** (section 6, `targeted_plan.py`): the 2.9.0 second run would have been release_check + 2 backend files (+ hygiene) instead of a full gate | ~125-135 min per stale-red re-gate | none: the product bytes are the ones the red gate already verified |
| E2 | **Visual matrix off the critical path**: run it concurrently with the dev-server phase (it has its own preview port), or after the verdict. Warn-only, so the verdict never waits for it. Separately, triage / accept the 41 standing differences once so the warning means something again | up to its own duration (cap 25 min; actual in the phases list) | none (warn-only) |
| E3 | **Pixel phase in one process** (all pixel specs, desktop+mobile, workers=1) and concurrently with the fixture phase | ~3-6 min (12 process start-ups + serial run) | low |
| E4 | **Evidence specs on desktop + mobile only**: 46 evidence specs without `--project` flags still run on tablet (~1,650 summed s at 2.4.10 = ~9 min at 3 workers); 70 more skip tablet per test but still pay the page start. The layout-* sweeps remain the tablet guard | ~9-12 min | low (tablet layout stays covered by layout-*) |
| E5 | **Backend shards by recorded time, not file size**, only if "backend-wait" in the phases list is > 0 (the backend is then the tail): `--junitxml` per shard, balance the next gate by the previous gate's per-file seconds (same pattern as `prior_costs()`), or a 4th shard on the 16-core box | 0 - 15 min, depends on the tail | low |
| E6 | **Refresh `gate_durations.json`** from the 2.9.0 logs (it is 2.4.10 data for 43 % of today's files; unknown files weigh the median) | better --workers=1 chunk balance | none |
| E7 | Overlap candidates for a later consolidation pass (same screen in evidence-*, layout-*, pixel-*): access-events/s12/schedules/status, bubble-*, wiskey-stations/people/messaging/station-media, nvr-cameras-batch. Not cut here: each family needs a look at what each spec asserts | 10-20 min if consolidated | medium |

Also observed: 111 spec files never open a page (pure unit specs) but run on all 3 projects; they cost ~46 s in total - not worth a change.

## 5. Coverage for 2.8.0-2.9.1

Added on this branch (deterministic, cheap):
- `test_tickets_mgrdash_batched_guard.py`: the manager dashboard's speed fix is STRUCTURAL (batched visibility / assignments); the existing
  equivalence tests pass even if the per-ticket path comes back. The guard counts `access.visible_by_id` / `store_dash.assignment_at`
  calls for 120 vs 360 seeded requests across both viewers and the three periods and requires equality. Verified to FAIL with the
  batching switched off (22 -> 58 and 10 -> 34 calls). This is the gate-safe stand-in for the opt-in 150 ms budget.
- `test_gate_hygiene.py::test_notification_sources_decided_off_ship_off`: elevator fire/fault/out-of-service, the manager morning summary,
  busy department, payment due tomorrow, camera motion/person/vehicle ship disabled (per decision, one by one).
- the settings guards of section 1.

Coverage already strong in the merged 2.8.0 / 2.9.0 features (elevators 29 tests incl. alerts-off, hold, visibility; dashboard summary,
payments incl. statement-count scaling, alerts; needs-review; WisKey rounds) - no gap worth a new test found there.

Unmerged 2.9.1 branches (audited read-only; add these on the branches before they merge):

| Branch | Gap / flag |
|---|---|
| SLACAL-291 (calendar / SLA) | month boundary `add_working_time(2026-10-29 16:00, 120)` -> 2026-11-01 09:00; a start at 21:30Z (= 00:30 local next day); `auto_close_at` in calendar-days mode adds days in UTC (local time slips 1 h across 25.10) - pin the intended behaviour; 403 for a non-admin saving the `calendar` block; two tests depend on the real clock (lines 304-321, 357-364) |
| TKNOTIFMATRIX-291 | clock pinned to January 2030, DST never exercised: a digest at 00:00 and 01:30 on 2026-10-25, an event held at 23:59 released after midnight; whole-dict `notify` defaults (section 1) |
| COSTINST-291 (instalments) | pure `timing()` boundary test (due = today -> soon, +13 soon, +14 later, -1 late) and `today(conn, 21:30Z)` = next local date |
| TKRULES-291 | `local_day(conn, 2026-10-24T21:30Z)` = 2026-10-25; the daily limit resets at LOCAL midnight (21:59Z vs 22:01Z with a fixed clock); `tick` helper patches `utcnow` to the real clock, a run crossing local midnight can flake |
| PRIVORG-291 | organisation name with `{`, `}` or bidi characters through `render_code_message` |
| WISKEYARX-291 | `_revision` / `_int` with `True` / `"1"` |
| ELEVTRAVEL-291 / ELEVFU-291 | the `travelling` "since" stamp (inferred_active); `evidence-elevators-followup.spec.ts:95` waits 200 ms then asserts `toHaveCount(0)` (can pass vacuously) |
| RFQSYS-291 | one HTTP-level check through the public vendor route |
| TEMPCTL-291 | **suspected product bug** (not fixed - not this branch's code): `services/temperature.py` `next_window_start` adds a LOCAL minute difference to a UTC base; on the DST night (03:00 window evaluated at 2026-10-24T20:00Z) it returns 00:00Z instead of 01:00Z. Also no DST test for `window_intervals`, `detect_episodes`/`cluster`, no janitor retention test; `evidence-temperature.spec.ts:123` one-shot read |
| ELEVTRAVEL-291 + TKRULES-291 | **both add migration 0122** (`0122_infra_elevator_show_travel.sql`, `0122_ticket_rule_fires.sql`); `schema_migrations` is keyed by the number, so one must be renumbered at integration (the existing renumbering rule) |

## 6. Fast gate tier and the red-gate rule

**Rule** (owner approval 2026-10-20, made mechanical): a red tier-L gate may be resolved by a TARGETED run instead of a new full gate
only when ALL hold:
1. every FAIL is shown stale: the failing test (not the product) was wrong, the reason is written in the integration notes;
2. the diff from the red gate's commit to the fixed commit is test-only: `smplwise_vms/backend/tests/**`, `frontend/tests/**`, the
   Playwright configs, `scripts/gate/**`, `docs/**`, `management/**`, root `*.md` - no product byte (backend code, `frontend/src`,
   migrations, `www`/`www-public` bundles, add-on files, `smplwise_vms/CHANGELOG.md`, `scripts/release_check.py`, vite configs);
3. every FAIL lives in a file the fix touched;
4. no suite-wide test file changed (`tests/conftest.py`, `frontend/playwright.config.ts`) - those need the full suite of that side;
5. the targeted run passes: release_check, tsc when anything under `frontend/` changed, every changed backend test file + every test
   file importing a changed helper + `test_gate_hygiene.py`, every changed spec + every spec importing a changed spec helper (on the
   server its header asks for), and the named failures;
6. FLAKY results of the red gate are not "stale" - they follow section 3 (KNOWN with expiry, or root-caused), never this rule.

`python scripts/gate/targeted_plan.py --base <red gate sha> [--head <fixed sha>] --failed <ids...>` checks 2-4 and prints the run list
for 5 (exit 0 = targeted run allowed, 2 = full gate required). On the 2.9.0 fix (`ca56b9d5b~1..ca56b9d5b`) it answers "allowed:
release_check + test_tickets_board.py + test_tickets_table.py". The gate report's counts of the red run stay the release's numbers;
the targeted run's output is appended to the integration notes next to them.

**Fast tier for a release whose WHOLE diff since the last green gate is test-only / doc-only** (e.g. a test-hygiene or docs release):
the same run list as above against the last green gate's commit. What may be skipped there: the full preview / dev / pixel / fixture
Playwright phases, the visual matrix and the full backend suite (the product bytes are the ones the last green gate verified). What may
NOT be skipped: release_check, tsc for any frontend change, the changed tests themselves, and the hygiene guard.

## Runs (local, this workstation, 2026-10-20; main checkout `.venv` against the worktree code)

See the final report of the task for the exact counts; in short:
- backend targeted: the 4 changed/new backend tests of the two 2.9.0 reds + the new guard (4 passed); `test_gate_hygiene.py` (103 passed);
  `test_targeted_plan.py` (23 passed); the dashboard guard verified to fail with batching disabled.
- frontend: `tsc --noEmit` rc=0; `vite build` rc=0; 6 date-related unit specs (68 passed, Node TZ = Asia/Jerusalem);
  `evidence-tabs-ui.spec.ts` on the dist preview, 3 projects (24 passed; evidence pictures restored).

NOT run: the full backend suite, the full Playwright suites, any gate on the runner (the runner was reserved for the release gate).
