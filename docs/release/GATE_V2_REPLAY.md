# Gate v2 retrospective replay (GATE2-295)

**Update 2026-10-25 (second replay, section 7): rules R1-R4 are implemented, plus one selector bug the replay exposed (the
unit-* smoke set masked closure hits). Re-run on the same 10 gates: 0 of 138 failing files escape (was 15).** Sections 1-6 below
describe the FIRST replay, at `1530a6f17`, and are kept unchanged as the record.

Status (first replay): analysis only. **No test was run.** The gate-2 selector (`scripts/gate/gate2_select.py` at `1530a6f17`) was run in select mode
(it reads git and source files and starts nothing) once per historical red gate. The only runner contact was reading the gate
reports (`~/smplwise-results/gate_release-*.json`) through `rr.py`; the runner's lock and any gate were not touched. One deviation
to disclose: the command that printed the report summaries wrote one small read-only helper script to the runner's `/tmp`; no
repository or results file was touched.

## 1. Method

For each red gate report on the runner (11 red reports, 2.10.0 to 2.19.0; the green second gates of 2.15.0 and 2.16.0 are not
replayed):

1. Checkout the exact gate sha (the release candidate the gate ran) in a scratch worktree.
2. Base = the previous release tag (`v2.9.3`, `v2.10.0`, `v2.10.1`, `v2.11.1`, `v2.12.4`, `v2.14.0`, `v2.15.0`, `v2.16.0`, `v2.17.0`,
   `v2.17.0`, `v2.18.0`, in gate order). There is no `v2.13.x` and no `v2.17.1` tag, so 2.14.0 uses `v2.12.4` and 2.18.0 uses
   `v2.17.0` (its diff therefore includes the 2.17.1 content). `release/2111` is an ancestor of `v2.11.0`, so it is a candidate for
   2.11.0 and its base is `v2.10.1`; `release/2120b` is a candidate for 2.12.0 with base `v2.11.1`.
3. `select_gate2(root, base, head, costs=gate2_costs.json)` with default settings (closure depth 2, heavy deferral on). This is the
   function the `plan` dry-run calls.
4. Failing tests = items with status `FAIL` in the report (they failed in the pool and again when retried alone). `FLAKY` items
   (passed alone) are excluded; the quarantine list is empty, so nothing is excluded for quarantine. Each failing test is mapped to
   its file (`test_x.py` or `x.spec.ts`) as `failed_files()` does. Engine guard items (count-drop baseline, the 90-minute budget)
   are not tests and are listed as "not a test".
5. A file is "selected" when it is in the selection and not in `deferred_to_nightly`.

## 2. Result

Escape rate = failing test files that gate 2 would not have run / failing test files, over 10 gates (2.17.1 excluded, see below).

| Gate | Failing files | Not selected | Failing cases | Cases in unselected files |
|---|---|---|---|---|
| 2.10.0 | 29 | 3 | 153 | 17 |
| 2.10.1 | 1 | 0 | 1 | 0 |
| 2.11.1 cand | 10 | 0 | 29 | 0 |
| 2.12.0b | 4 | 0 | 4 | 0 |
| 2.14.0 | 6 | 0 | 17 | 0 |
| 2.15.0 #1 | 16 | 1 | 75 | 3 |
| 2.16.0B #1 | 45 | 9 | 168 | 26 |
| 2.17.0W | 3 | 1 | 4 | 1 |
| 2.17.1 (starved, excluded) | 9 | 5 | 20 | 14 |
| 2.18.0 | 21 | 1 | 159 | 3 |
| 2.19.0 | 3 | 0 | 14 | 0 |
| **Total (10 gates, 2.17.1 excluded)** | **138** | **15** | **624** | **50** |

**Headline: 15 of 138 failing files (10.9 percent) and 50 of 624 failing cases (8.0 percent) would have escaped. 5 of the 10 gates
would have missed at least one real failure** (2.10.0, 2.15.0, 2.16.0B, 2.17.0W, 2.18.0). This is not a clean result; it needs the
rule changes in section 4 before gate 2 can replace the full gate.

Two facts that qualify the number:

- **Most "selected" is not evidence for the narrowing.** In 7 of the 10 gates a hub file forced one side to the full tier
  (`rbac.py`, `main.py` lines that cannot be attributed, `conftest.py`, `config.py`, `db.py`, fixtures, `vite.config.ts`, `index.html`),
  so every failure on that side was selected trivially: 97 of the 123 selected failing files were selected only because their side was
  full. Only 26 were selected by the real rules (changed in the diff, import closure, name or API mapping). The three gates with no
  full side are the real test of the narrowing: 2.10.1 (1 of 1 selected), 2.14.0 (6 of 6), 2.17.0W (2 of 3). The corollary: on this
  history gate 2 would have saved little on 7 of 10 gates, because those diffs touch the security core or test infrastructure.
- **2.17.1 is excluded from the rate.** That was the tier-M gate that exhausted its 90-minute budget; its 62 failures include backend
  shard timeouts, "no report" items and `no time left to retry` cases that were never re-run alone. They are not verified failures.
  For completeness: 9 failing files, 5 not selected (one has a plausible real cause the selector misses, see 3.4).

## 3. Why the escapes happened (all 15, plus the 2.17.1 case)

### 3.1 Heavy deferral applied to a full-tier side (13 files: 2.10.0 x3, 2.16.0B x9, 2.18.0 x1)

In these gates the frontend side was already the full tier (`frontend/tests/fixtures/media_fake_ha.py` in 2.10.0; `fixture_specs.json`
and `vite.config.ts` in 2.16.0B; `index.html` in 2.18.0). With the heavy deferral switched off, the replay shows each of these 13 specs
as selected ("full tier"). They were lost only by the rule "an unchanged spec above 900 worker-seconds goes to the nightly". Files:
`evidence-nn1-p2`, `layout-bubble-lists`, `layout-electricity-meters` (2.10.0); `evidence-automations-list`, `layout-access-events`,
`layout-access-schedules`, `layout-access-status`, `layout-bubble-lists`, `layout-bubble-screens`, `layout-electricity-meters`,
`layout-material`, `layout-update-screens` (2.16.0B); `evidence-automations-builder` (2.18.0). The `layout-*` failures were reported
as layout findings (overlap or clipping); `evidence-automations-builder` was a 60 s test timeout that failed alone again, so it counts
but may be load related.

Caveat: the heavy classification uses today's cost seed (2.19.0 timings), not the timings of the day; a spec that is heavy now may
have been lighter in 2.10.0.

### 3.2 A source-tree scanning spec (1 file: 2.15.0, `unit-date-format-module.spec.ts`)

The failing case (`every lit date/time input outside the public pages carries lang=dateInputLang()`) reads the whole `frontend/src`
tree with `readdirSync` and fails when any screen has a date input without `lang`. The diff added many screens; none is imported by
the spec, so the import closure, name stems and tag mapping cannot reach it. Same class: 23 specs use `readdirSync` on source (about
2.1 worker-min in total; largest `evidence-public-ui5` 57 s and `unit-three-chunk` 31 s).

### 3.3 A repo-wide lint (1 file: 2.17.0W, `test_no_ip_literals.py`)

It scans every tracked file (`git ls-files`) for private IPv4 literals. The diff added one; no backend module or test maps to it. It
is the only backend test that calls `git ls-files`.

### 3.4 (2.17.1, unverified) a spec that bundles its subject by string

`unit-brand-login.spec.ts` (9 cases) builds the login element with `esbuild` from an inline string (`import './arx-login'`), so its real
dependencies (`arx-login.ts`, then `sw-brand.ts`, which the diff changed) are invisible to the static import closure. 4 specs use the
`esbuild` `build()` pattern. The other four starved files in 2.17.1 (`evidence-nvr-connection`, `evidence-setup-wizard`,
`evidence-tickets-device`, `unit-plan-3d-realistic`) show timeouts or a missing screenshot and cannot be classified from the report.

## 4. Proposed selector rules (NOT implemented; the rules were not changed)

| # | Rule | Fixes | Cost |
|---|---|---|---|
| R1 | Heavy deferral applies only to a side selected by change impact. When a side is full-tier (a KEEP_FULL trigger fired), do not defer heavy specs: skip the deferral block for the side where `full[side]` is non-empty in `select_gate2`. | 13 of 15 | none on narrow gates; on full-side gates the heavy sweeps (up to about 460 worker-min) run, as they do today |
| R2 | Tree-scanner specs are core when any `frontend/src` file changed. Detect by content (`readdirSync` or a recursive read of the src folder): 23 specs. | 1 of 15 | about 2 worker-min |
| R3 | Add `test_no_ip_literals.py` to `CORE_BACKEND`, and treat any backend test that calls `git ls-files` or walks the repo root as core. | 1 of 15 | seconds |
| R4 | Import closure for specs that bundle by string: parse the `import '...'` specifiers inside the `esbuild` stdin contents (4 specs). | the 2.17.1 case (unverified) | none |

With R1 to R3 all 15 would be selected (13 + 1 + 1). R1 was checked in this replay (the 13 specs are selected once deferral is off);
R2 and R3 were reasoned from the failing tests' code and not re-run through the selector. Confirm by implementing the rules and
re-running this replay before adopting them.

Limits of this replay: 10 gates is a small history; 7 of 10 were full-side anyway; stale-test reds (the dominant class) select
themselves because the stale test is changed in the same diff, which flatters every rate here; the nightly remains the safety net
for anything dropped.

## 5. Per gate tables

Columns: failing test file, side and engine category, number of failed cases in that file, selected by gate 2 (yes or **NO**), and why.
"full tier" means the side was the full tier, so the selection says nothing about the narrowing.

### 2.10.0: release/2100 (candidate for 2.10.0)

Gate sha `fef91ec0c`, verdict fail, tier L; selector base `v2.9.3`; 981 files changed. Selected: backend 558/558 files, frontend 650/671 specs, 21 heavy specs deferred. Full-tier triggers: `be:main.py`, `be:rbac.py`, `be:tests/conftest.py`, `be:tests/db_template.py`, `fe:tests/fixtures/media_fake_ha.py`.

| Failing test file | Side / cat | Failed cases | Selected | Why |
|---|---|---|---|---|
| `evidence-nn1-p2.spec.ts` | frontend/preview | 15 | **NO** | DEFERRED heavy (26.2 min) to the nightly |
| `layout-bubble-lists.spec.ts` | frontend/dev | 1 | **NO** | DEFERRED heavy (29.8 min) to the nightly |
| `layout-electricity-meters.spec.ts` | frontend/dev | 1 | **NO** | DEFERRED heavy (19.0 min) to the nightly |
| `test_capture_lease_local_actor.py` | backend/backend | 1 | yes | full tier |
| `test_security_review_242_poc.py` | backend/backend | 1 | yes | full tier |
| `evidence-alarm.spec.ts` | frontend/preview | 3 | yes | full tier |
| `evidence-design-foundation.spec.ts` | frontend/pixel | 8 | yes | full tier |
| `evidence-frigate-ui.spec.ts` | frontend/preview | 3 | yes | full tier |
| `evidence-multi-nvr.spec.ts` | frontend/preview | 1 | yes | full tier |
| `evidence-nav-size.spec.ts` | frontend/preview | 1 | yes | full tier |
| `evidence-nvr-cameras.spec.ts` | frontend/preview | 2 | yes | full tier |
| `evidence-public-ui5.spec.ts` | frontend/preview | 2 | yes | full tier |
| `evidence-security-r1.spec.ts` | frontend/preview | 6 | yes | full tier |
| `evidence-shell.spec.ts` | frontend/preview | 2 | yes | full tier |
| `evidence-tickets-vendor-accounts.spec.ts` | frontend/preview | 1 | yes | full tier |
| `evidence-uxrest-295.spec.ts` | frontend/preview | 1 | yes | full tier |
| `layout-access-s12.spec.ts` | frontend/dev | 2 | yes | full tier |
| `layout-dd-place.spec.ts` | frontend/dev | 4 | yes | full tier |
| `pixel-access-events.spec.ts` | frontend/pixel | 8 | yes | full tier |
| `pixel-access-s12.spec.ts` | frontend/pixel | 7 | yes | full tier |
| `pixel-access-schedules.spec.ts` | frontend/pixel | 8 | yes | full tier |
| `pixel-access-status.spec.ts` | frontend/pixel | 16 | yes | full tier |
| `pixel-nvr-encoding-batch.spec.ts` | frontend/pixel | 6 | yes | full tier |
| `pixel-wiskey-messaging.spec.ts` | frontend/pixel | 19 | yes | full tier |
| `pixel-wiskey-people-writes.spec.ts` | frontend/pixel | 3 | yes | full tier |
| `pixel-wiskey-people.spec.ts` | frontend/pixel | 12 | yes | full tier |
| `pixel-wiskey-station-media.spec.ts` | frontend/pixel | 6 | yes | full tier |
| `pixel-wiskey-stations.spec.ts` | frontend/pixel | 11 | yes | full tier |
| `tabs-mode-apply.spec.ts` | frontend/dev | 2 | yes | full tier |
| (not a test) pixel | baseline | 1 | n/a | engine guard / infrastructure, no selection can address it |

Files: 29 failing, 3 not selected. Cases: 153 failing, 17 in unselected files.

### 2.10.1: release/2101 (2.10.1)

Gate sha `3370bd704`, verdict fail, tier L; selector base `v2.10.0`; 181 files changed. Selected: backend 446/564 files, frontend 303/676 specs, 18 heavy specs deferred. No full-tier trigger.

| Failing test file | Side / cat | Failed cases | Selected | Why |
|---|---|---|---|---|
| `test_recorder_health.py` | backend/backend | 1 | yes | imports smplwise.services.recorder_health |

Files: 1 failing, 0 not selected. Cases: 1 failing, 0 in unselected files.

### 2.11.1 cand: release/2111 (candidate for 2.11.0)

Gate sha `5cbfe7df4`, verdict fail, tier L; selector base `v2.10.1`; 433 files changed. Selected: backend 593/593 files, frontend 421/689 specs, 19 heavy specs deferred. Full-tier triggers: `be:requirements.txt`, `be:main.py`, `be:rbac.py`, `be:tests/conftest.py`.

| Failing test file | Side / cat | Failed cases | Selected | Why |
|---|---|---|---|---|
| `test_bridge_schedule_service.py` | backend/backend | 2 | yes | full tier |
| `test_gate_hygiene.py` | backend/backend | 1 | yes | full tier |
| `test_generator_home_widget.py` | backend/backend | 1 | yes | full tier |
| `test_intercom_authority.py` | backend/backend | 1 | yes | full tier |
| `test_presence.py` | backend/backend | 1 | yes | full tier |
| `test_stationperm_295.py` | backend/backend | 4 | yes | full tier |
| `test_wkv2b_295.py` | backend/backend | 4 | yes | full tier |
| `pixel-nvr-encoding-batch.spec.ts` | frontend/pixel | 3 | yes | uses <system-security> |
| `unit-empty-state-icons.spec.ts` | frontend/preview | 3 | yes | uses <infra-elevators> (defined in or next to a changed shell/design/i18n file) |
| `unit-token-lint.spec.ts` | frontend/preview | 9 | yes | uses <system-diagnostics> (defined in or next to a changed shell/design/i18n file) |

Files: 10 failing, 0 not selected. Cases: 29 failing, 0 in unselected files.

### 2.12.0b: release/2120b (candidate for 2.12.0)

Gate sha `7f60f3fd9`, verdict fail, tier L; selector base `v2.11.1`; 166 files changed. Selected: backend 608/608 files, frontend 83/695 specs, 2 heavy specs deferred. Full-tier triggers: `be:rbac.py`.

| Failing test file | Side / cat | Failed cases | Selected | Why |
|---|---|---|---|---|
| `test_cr022_security_review.py` | backend/backend | 1 | yes | full tier |
| `test_custom_roles.py` | backend/backend | 1 | yes | full tier |
| `test_db_gate.py` | backend/backend | 1 | yes | full tier |
| `test_no_ip_literals.py` | backend/backend | 1 | yes | full tier |

Files: 4 failing, 0 not selected. Cases: 4 failing, 0 in unselected files.

### 2.14.0: release/2140 (2.14.0)

Gate sha `a60effc27`, verdict fail, tier L; selector base `v2.12.4`; 282 files changed. Selected: backend 565/639 files, frontend 404/705 specs, 20 heavy specs deferred. No full-tier trigger.

| Failing test file | Side / cat | Failed cases | Selected | Why |
|---|---|---|---|---|
| `evidence-alarm.spec.ts` | frontend/preview | 3 | yes | uses <live-wall> |
| `evidence-maskui-295.spec.ts` | frontend/dev | 1 | yes | uses <system-security> |
| `evidence-nvr-cameras.spec.ts` | frontend/preview | 1 | yes | uses <system-security> |
| `evidence-security-r1.spec.ts` | frontend/preview | 6 | yes | security/permission suite |
| `pixel-nvr-encoding-batch.spec.ts` | frontend/pixel | 3 | yes | uses <system-security> |
| `unit-notifications.spec.ts` | frontend/preview | 3 | yes | names a changed permission/role id |

Files: 6 failing, 0 not selected. Cases: 17 failing, 0 in unselected files.

### 2.15.0 #1: release/2150, first gate (2.15.0)

Gate sha `06d2b6f45`, verdict fail, tier L; selector base `v2.14.0`; 439 files changed. Selected: backend 661/661 files, frontend 468/718 specs, 21 heavy specs deferred. Full-tier triggers: `be:config.py`, `be:db.py`, `be:main.py`, `be:rbac.py`.

| Failing test file | Side / cat | Failed cases | Selected | Why |
|---|---|---|---|---|
| `unit-date-format-module.spec.ts` | frontend/preview | 3 | **NO** | dropped by selection |
| `test_no_ip_literals.py` | backend/backend | 1 | yes | full tier |
| `test_nvr_connection.py` | backend/backend | 1 | yes | full tier |
| `evidence-design-foundation.spec.ts` | frontend/pixel | 1 | yes | uses <sw-dialog> |
| `evidence-insights.spec.ts` | frontend/preview | 1 | yes | changed in the diff |
| `evidence-messaging-accounts.spec.ts` | frontend/preview | 2 | yes | imports a changed file |
| `evidence-tickets-overview.spec.ts` | frontend/preview | 2 | yes | name matches 'tickets' |
| `evidence-tickets-ui4.spec.ts` | frontend/preview | 2 | yes | name matches 'tickets' |
| `layout-wall-plan.spec.ts` | frontend/preview | 35 | yes | uses <system-wall> |
| `pixel-access-s12.spec.ts` | frontend/pixel | 1 | yes | name matches 'access' |
| `pixel-access-status.spec.ts` | frontend/pixel | 8 | yes | name matches 'access' |
| `pixel-nvr-encoding-batch.spec.ts` | frontend/pixel | 3 | yes | uses <system-security> |
| `pixel-wiskey-messaging.spec.ts` | frontend/pixel | 6 | yes | name matches 'messaging' |
| `unit-empty-state-icons.spec.ts` | frontend/preview | 3 | yes | uses <infra-elevators> (defined in or next to a changed shell/design/i18n file) |
| `unit-lead-reserve.spec.ts` | frontend/preview | 3 | yes | uses <devices-area> (defined in or next to a changed shell/design/i18n file) |
| `unit-uxfix-rtl.spec.ts` | frontend/preview | 3 | yes | uses <system-multimedia> (defined in or next to a changed shell/design/i18n file) |

Files: 16 failing, 1 not selected. Cases: 75 failing, 3 in unselected files.

### 2.16.0B #1: release/2160B, first gate (2.16.0)

Gate sha `734ae94f1`, verdict fail, tier L; selector base `v2.15.0`; 569 files changed. Selected: backend 678/678 files, frontend 727/748 specs, 21 heavy specs deferred. Full-tier triggers: `be:config.py`, `be:main.py`, `be:rbac.py`, `be:tests/conftest.py`, `fe:tests/fixtures/fixture_specs.json`, `fe:vite.config.ts`.

| Failing test file | Side / cat | Failed cases | Selected | Why |
|---|---|---|---|---|
| `evidence-automations-list.spec.ts` | frontend/preview | 3 | **NO** | DEFERRED heavy (38.6 min) to the nightly |
| `layout-access-events.spec.ts` | frontend/dev | 2 | **NO** | DEFERRED heavy (21.4 min) to the nightly |
| `layout-access-schedules.spec.ts` | frontend/dev | 2 | **NO** | DEFERRED heavy (16.0 min) to the nightly |
| `layout-access-status.spec.ts` | frontend/dev | 2 | **NO** | DEFERRED heavy (19.0 min) to the nightly |
| `layout-bubble-lists.spec.ts` | frontend/dev | 3 | **NO** | DEFERRED heavy (29.8 min) to the nightly |
| `layout-bubble-screens.spec.ts` | frontend/dev | 2 | **NO** | DEFERRED heavy (65.2 min) to the nightly |
| `layout-electricity-meters.spec.ts` | frontend/dev | 1 | **NO** | DEFERRED heavy (19.0 min) to the nightly |
| `layout-material.spec.ts` | frontend/dev | 3 | **NO** | DEFERRED heavy (29.0 min) to the nightly |
| `layout-update-screens.spec.ts` | frontend/dev | 8 | **NO** | DEFERRED heavy (31.7 min) to the nightly |
| `test_fake_doorwin_closed_rule_sr1.py` | backend/backend | 1 | yes | full tier |
| `test_notify_core.py` | backend/backend | 1 | yes | full tier |
| `test_security.py` | backend/backend | 1 | yes | full tier |
| `test_tickets_rfq.py` | backend/backend | 1 | yes | full tier |
| `test_tickets_rfq_inbound.py` | backend/backend | 1 | yes | full tier |
| `test_whoin034_295.py` | backend/backend | 3 | yes | full tier |
| `evidence-alarm.spec.ts` | frontend/preview | 3 | yes | full tier |
| `evidence-breakui-areanav.spec.ts` | frontend/preview | 24 | yes | full tier |
| `evidence-dropdown-capsule.spec.ts` | frontend/dev | 6 | yes | full tier |
| `evidence-kavarnit.spec.ts` | frontend/preview | 1 | yes | full tier |
| `evidence-nvr-cameras.spec.ts` | frontend/preview | 1 | yes | full tier |
| `evidence-nvr-connection.spec.ts` | frontend/preview | 10 | yes | full tier |
| `evidence-schedules-list.spec.ts` | frontend/preview | 6 | yes | full tier |
| `evidence-security-r1.spec.ts` | frontend/preview | 6 | yes | full tier |
| `evidence-shell.spec.ts` | frontend/preview | 2 | yes | full tier |
| `evidence-tabs-styles.spec.ts` | frontend/preview | 3 | yes | full tier |
| `evidence-tabs-ui.spec.ts` | frontend/preview | 3 | yes | full tier |
| `evidence-tabset-293.spec.ts` | frontend/preview | 3 | yes | full tier |
| `evidence-white-label.spec.ts` | frontend/preview | 1 | yes | full tier |
| `layout-access-s12.spec.ts` | frontend/dev | 2 | yes | full tier |
| `layout-bv1-tiles.spec.ts` | frontend/dev | 2 | yes | full tier |
| `layout-camera-image-health.spec.ts` | frontend/preview | 1 | yes | full tier |
| `layout-dropdown-capsule.spec.ts` | frontend/dev | 4 | yes | full tier |
| `layout-recorder-health.spec.ts` | frontend/preview | 1 | yes | full tier |
| `layout-visdiff-246.spec.ts` | frontend/preview | 12 | yes | full tier |
| `layout-wiskey-messaging.spec.ts` | frontend/preview | 2 | yes | full tier |
| `pixel-access-status.spec.ts` | frontend/pixel | 1 | yes | full tier |
| `pixel-notice-tv-mock.spec.ts` | frontend/preview | 1 | yes | full tier |
| `unit-brand-logo.spec.ts` | frontend/preview | 3 | yes | full tier |
| `unit-date-format-module.spec.ts` | frontend/preview | 3 | yes | full tier |
| `unit-empty-state-icons.spec.ts` | frontend/preview | 3 | yes | full tier |
| `unit-lead-reserve.spec.ts` | frontend/preview | 3 | yes | full tier |
| `unit-menu-lint.spec.ts` | frontend/preview | 6 | yes | full tier |
| `unit-notifications.spec.ts` | frontend/preview | 3 | yes | full tier |
| `unit-token-lint.spec.ts` | frontend/preview | 15 | yes | full tier |
| `unit-uxfix-rtl.spec.ts` | frontend/preview | 3 | yes | full tier |

Files: 45 failing, 9 not selected. Cases: 168 failing, 26 in unselected files.

### 2.17.0W: release/2170W (2.17.0)

Gate sha `dde6c9280`, verdict fail, tier L; selector base `v2.16.0`; 83 files changed. Selected: backend 545/684 files, frontend 374/751 specs, 17 heavy specs deferred. No full-tier trigger.

| Failing test file | Side / cat | Failed cases | Selected | Why |
|---|---|---|---|---|
| `test_no_ip_literals.py` | backend/backend | 1 | **NO** | dropped by selection |
| `test_db_gate.py` | backend/backend | 1 | yes | smoke |
| `test_wkv2_295.py` | backend/backend | 2 | yes | imports smplwise.services.access_grant_engine |

Files: 3 failing, 1 not selected. Cases: 4 failing, 1 in unselected files.

### 2.17.1: release/2171 (2.17.1, tier M)

Gate sha `d15aa9e84`, verdict fail, tier M; selector base `v2.17.0`; 26 files changed. Selected: backend 200/685 files, frontend 300/753 specs, 13 heavy specs deferred. No full-tier trigger.

**This gate was budget-starved** (engine verdict: 90-minute budget exhausted, run incomplete). Its failures carry `no time left to retry` and were never re-run alone, so they are NOT verified real failures. They are listed for completeness and excluded from the headline rate.

| Failing test file | Side / cat | Failed cases | Selected | Why |
|---|---|---|---|---|
| `evidence-nvr-connection.spec.ts` | frontend/preview | 1 | **NO** | dropped by selection |
| `evidence-setup-wizard.spec.ts` | frontend/preview | 2 | **NO** | dropped by selection |
| `evidence-tickets-device.spec.ts` | frontend/preview | 1 | **NO** | dropped by selection |
| `unit-brand-login.spec.ts` | frontend/preview | 9 | **NO** | dropped by selection |
| `unit-plan-3d-realistic.spec.ts` | frontend/preview | 1 | **NO** | dropped by selection |
| `dropdown-styles-b.spec.ts` | frontend/dev | 1 | yes | uses <multimedia-screens> (defined in or next to a changed shell/design/i18n file) |
| `evidence-kavarnit.spec.ts` | frontend/preview | 1 | yes | uses <devices-schedules> (defined in or next to a changed shell/design/i18n file) |
| `evidence-nvr-cameras-batch.spec.ts` | frontend/dev | 1 | yes | uses <system-security> (defined in or next to a changed shell/design/i18n file) |
| `unit-tabset-registry.spec.ts` | frontend/preview | 3 | yes | imports a changed shell/design file directly |
| (not a test) shard 1 | backend | 10 | n/a | engine guard / infrastructure, no selection can address it |
| (not a test) dev_desktop_w1_c0: no report | frontend | 16 | n/a | engine guard / infrastructure, no selection can address it |
| (not a test) preview_desktop-tablet-mobile_w1_c5: no report | frontend | 15 | n/a | engine guard / infrastructure, no selection can address it |
| (not a test) 90-minute budget exhausted: the run is incomplete | gate | 1 | n/a | engine guard / infrastructure, no selection can address it |

Files: 9 failing, 5 not selected. Cases: 20 failing, 14 in unselected files.

### 2.18.0: release/2180 (2.18.0)

Gate sha `6e4dd8a8b`, verdict fail, tier L; selector base `v2.17.0`; 228 files changed. Selected: backend 696/696 files, frontend 747/767 specs, 20 heavy specs deferred. Full-tier triggers: `be:tests/conftest.py`, `fe:index.html`.

| Failing test file | Side / cat | Failed cases | Selected | Why |
|---|---|---|---|---|
| `evidence-automations-builder.spec.ts` | frontend/preview | 3 | **NO** | DEFERRED heavy (25.0 min) to the nightly |
| `test_mobile_push.py` | backend/backend | 1 | yes | full tier |
| `test_service_identity_extended.py` | backend/backend | 1 | yes | full tier |
| `evidence-design-foundation.spec.ts` | frontend/pixel | 6 | yes | full tier |
| `layout-tickets.spec.ts` | frontend/preview | 4 | yes | full tier |
| `pixel-access-events.spec.ts` | frontend/pixel | 12 | yes | full tier |
| `pixel-access-s12.spec.ts` | frontend/pixel | 7 | yes | full tier |
| `pixel-access-schedules.spec.ts` | frontend/pixel | 9 | yes | full tier |
| `pixel-access-status.spec.ts` | frontend/pixel | 12 | yes | full tier |
| `pixel-notice-tv-mock.spec.ts` | frontend/preview | 1 | yes | full tier |
| `pixel-nvr-encoding-batch.spec.ts` | frontend/pixel | 3 | yes | full tier |
| `pixel-wiskey-messaging.spec.ts` | frontend/pixel | 21 | yes | full tier |
| `pixel-wiskey-people-writes.spec.ts` | frontend/pixel | 8 | yes | full tier |
| `pixel-wiskey-people.spec.ts` | frontend/pixel | 22 | yes | full tier |
| `pixel-wiskey-station-media.spec.ts` | frontend/pixel | 12 | yes | full tier |
| `pixel-wiskey-stations.spec.ts` | frontend/pixel | 19 | yes | full tier |
| `unit-maintenance.spec.ts` | frontend/preview | 3 | yes | full tier |
| `unit-notifications.spec.ts` | frontend/preview | 3 | yes | full tier |
| `unit-tickets-board.spec.ts` | frontend/preview | 3 | yes | full tier |
| `unit-token-lint.spec.ts` | frontend/preview | 6 | yes | full tier |
| `unit-uxfix-rtl.spec.ts` | frontend/preview | 3 | yes | full tier |
| (not a test) pixel | baseline | 1 | n/a | engine guard / infrastructure, no selection can address it |

Files: 21 failing, 1 not selected. Cases: 159 failing, 3 in unselected files.

### 2.19.0: release/2190 (2.19.0)

Gate sha `e476e48ae`, verdict fail, tier L; selector base `v2.18.0`; 215 files changed. Selected: backend 705/705 files, frontend 403/770 specs, 16 heavy specs deferred. Full-tier triggers: `be:auth.py`.

| Failing test file | Side / cat | Failed cases | Selected | Why |
|---|---|---|---|---|
| `test_tickets_visibility.py` | backend/backend | 1 | yes | full tier |
| `test_xscenario109_295.py` | backend/backend | 1 | yes | full tier |
| `pixel-wiskey-station-media.spec.ts` | frontend/pixel | 12 | yes | name matches 'wiskey' |

Files: 3 failing, 0 not selected. Cases: 14 failing, 0 in unselected files.

## 6. Reproduce

Reports: `~/smplwise-results/gate_release-{2100_fef91ec0c,2101_3370bd704,2111_5cbfe7df4,2120b_7f60f3fd9,2140_a60effc27,2150_06d2b6f45,2160B_734ae94f1,2170W_dde6c9280,2171_d15aa9e84,2180_6e4dd8a8b,2190_e476e48ae}.json`.
For each: checkout the sha, then `py -3.12 scripts/gate/gate2_select.py select --root <checkout> --base <tag> --head <sha> --json out.json`
and compare `out.json` (`backend.selected`, `frontend.selected`, `deferred_to_nightly`) with the report's `FAIL` items. The driver used
here imported `select_gate2` directly with the same arguments. Not run: any test, the real gate-2 run on the runner, the `--after` path.

## 7. Second replay after R1-R4 (2026-10-25)

Same method, same 11 reports (local copies of the runner reports, read earlier; the runner was not contacted for this replay),
same bases, same scratch worktree, one gate per process. The selector is the one on `pilot/GATE2-295` after the change.

### Changes in `scripts/gate/gate2_select.py`
| # | Change | How it is verified |
|---|---|---|
| R1 | No heavy deferral on a side whose `full[side]` is set (a kept full-tier trigger fired). | replay: all 13 deferred escapes selected ("full tier"); unit test `test_r1_no_heavy_deferral_on_a_full_tier_side` |
| R2 | Specs whose text contains `readdirSync` or `ls-files` (source-tree scanners) run whenever any `frontend/src` file changed, and are never deferred. 23 specs on 2.20.0. | replay: `unit-date-format-module` (2.15.0) selected, why "reads the frontend/src tree"; unit tests |
| R3 | `test_no_ip_literals.py` in `CORE_BACKEND`; any backend test containing `ls-files` is core. | replay: selected on 2.17.0W, why "gate2 core"; unit test |
| R4 | `esbuild` specs: the `import '...'` specifiers inside the stdin `contents` (resolved against `resolveDir: path.join(HERE, ...)`) and `entryPoints: [path.join(HERE, '...ts')]` become graph edges of the spec (4 specs). | unit test on a synthetic tree; on the 2.17.1 tree the edge `sw-brand.ts -> arx-login.ts -> unit-brand-login.spec.ts` is reached at closure level 2 (checked with a debug script) |
| fix | **Selector bug found while checking R4**: select_tests' `SMOKE_FRONTEND_GLOBS` (every `unit-*` spec) tagged each `unit-*` spec "smoke" BEFORE the mapping ran. Gate 2 then removed the "smoke" specs that are not in its own core, so every `unit-*` spec reached ONLY by the closure, a tag or a name rule was silently dropped. Gate 2 now runs the mapping without that smoke set. | unit test `test_unit_spec_reached_by_the_closure_is_kept_and_tree_scanner_runs`; frontend selection per gate grew by 10-166 specs (table below) |

### Result
| Gate | Failing files | Escaped before | Escaped now | Frontend selected before -> now |
|---|---|---|---|---|
| 2.10.0 | 29 | 3 | 0 | 650 -> 671/671 (no deferral on the full side) |
| 2.10.1 | 1 | 0 | 0 | 303 -> 373/676 |
| 2.11.1 cand | 10 | 0 | 0 | 421 -> 505/689 |
| 2.12.0b | 4 | 0 | 0 | 83 -> 116/695 |
| 2.14.0 | 6 | 0 | 0 | 404 -> 591/705 |
| 2.15.0 #1 | 16 | 1 | 0 | 468 -> 583/718 |
| 2.16.0B #1 | 45 | 9 | 0 | 727 -> 748/748 |
| 2.17.0W | 3 | 1 | 0 | 374 -> 493/751 |
| 2.18.0 | 21 | 1 | 0 | 747 -> 767/767 |
| 2.19.0 | 3 | 0 | 0 | 403 -> 503/770 |
| **Total (10 gates)** | **138** | **15** | **0** | |
| 2.17.1 (starved, excluded) | 9 | 5 | 4 | 300 -> 328/753 |

**Escape rate on the 10 gates: 0 of 138 failing files (0 of 624 failing cases); 0 of 10 gates miss a failure.**

2.17.1 (budget-starved tier-M run, excluded as before): `unit-brand-login` is now selected. The reason recorded is
"security/permission suite" (its name contains `login`); before the fix that rule's hit was overwritten by the smoke tag and
dropped. The R4 edge reaches it too. Four files stay unselected, and none of them is a verified failure: each failed only in the
starved run, without the retry alone ("no time left to retry"):
- `evidence-nvr-connection` and `evidence-setup-wizard`: timeouts (60 s test, 20 s click);
- `evidence-tickets-device`: `ENOENT` on a `test-results` file of the run itself;
- `unit-plan-3d-realistic`: a 5 s predicate timeout. It is a known flaky spec (FLAKY in the 2.19.0 gate).

The 26-file diff (notices screens, `sw-brand.ts`, nav) reaches none of them through imports, tags or names. Load or
infrastructure errors in a starved run are not something a selector can or should chase. If any of them is real, the nightly
full run shows it.

### What the result does and does not prove
- It proves the 15 known escapes and their classes are closed, and that the fix did not drop any previously selected failure.
- It is fitted to these 10 gates: the rules were written after looking at these failures, so 0 here is an upper bound on
  quality, not a measurement on unseen data. The next real gates and `select_tests.py audit` on the nightlies are the test.
- 7 of 10 gates had at least one full side, so most selections on this history are still trivial.

### Cost of the new rules (estimates recomputed, `GATE_V2.md` section 3)
The extra specs are mostly cheap `unit-*` specs. Wall-time estimates barely move:
- 2.20.0 train: 96-117 -> 95-116 min;
- 2.19.0: 83-101 -> 81-98 min;
- core only: 27-31 min (76 backend files, 24 specs).

R1 has its real cost on releases whose FRONTEND is full-tier (`vite.config.ts`, `index.html`, shared fixtures): there the heavy
sweeps (about 460 worker-min) run again, and that side costs as much as today's gate.
