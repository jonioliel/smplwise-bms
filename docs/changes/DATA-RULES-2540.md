# DATA-RULES-2540 - backend data rules of the 2.52 deep review (billing cycle, automatic drafts, generator battery, generator mute)

Target 2.54. Branch `pilot/DATA-RULES-2540`, base `origin/release/2530-train` at `aeb05ad3d`.
Findings: `docs/review/DEEP-REVIEW-2520-DOMAIN-MODULES.md` (D-01, D-02, D-03, D-05) and `DEEP-REVIEW-2520-FRONTEND-SCREENS.md` (SCR-21).
Each was confirmed still present at the base before the fix (code read at `aeb05ad3d`; the new tests fail on the base, see Tests).

**No migration.** Everything new is stored in existing tables / the settings table (`generator.battery_system` JSON). All API
changes are additive (ADR-015): two optional fields on the generator device answer, one optional field on the device PUT body, one new
route (`DELETE /generator/alerts/{id}/mute`), one new notification source. Permissions only get stricter (critical mute), never wider.

## D-01 - a billing-cycle change after bills exist left a silent unbilled gap

Before: `_account_fields` copied `period_months` / `period_anchor_day` / `period_anchor_month` / `first_period_start` unchecked; the regular
periods were re-laid from the account's first start on the new grid, the automatic pass recorded the period overlapping the last issued
bill as `skipped` (settled for good) and the days between that bill's end and the next new boundary were in no bill.

Now (`services/bill_ledger.guard_cycle_change`, called by `energy_billing.update_account` and `water_billing.update_account`):

- a cycle field that really changes (the screen sends the whole form; the anchor month of a monthly cycle does not count) on an account
  with a sealed bill (issued / sent / paid): the new cycle starts where the LAST sealed bill ends - `first_period_start` is set to that day
  (a partial first period up to the next boundary, like a new account's first period), or kept when it already lies later; the update's
  audit row names `first_period_start` among the changed fields;
- an explicit different `first_period_start` is refused: 409 `cycle_start_mismatch`, details `last_billed_end`, `first_period_start`
  (Hebrew + English text);
- a cycle change while the account has an open draft or correction: 409 `cycle_change_open_draft`, details `bill_id` (issue or delete it
  first) - an open draft of the old grid would otherwise overlap and skip the new periods;
- an account without sealed bills changes exactly as before.

Recommendation taken: "close the gap" (align), with a clear refusal for the two cases that cannot be aligned safely. The review's second
layer (a continuity note in every computed snapshot) was NOT done: it changes the sealed snapshot of every bill; open question 3.

## D-05 - an unreviewed automatic draft was deleted by retention and its period never generated again

`bill_ledger.retention`: a draft of origin `auto` is no longer removed by `energy.draft_retention_days` (its run row settles the period, so
deleting it lost the period silently). It waits for review; only the retention years remove it (a period that ended before the cut, as
for an issued bill). Drafts a person made still expire after 30 days, as before.

Water drafts were not announced: the water pass now has the `draft_ready` hook - new source `water.bill_draft` ("חיובי מים: טיוטה
מוכנה" / "Water bills: draft ready"), subject kind `water_bills` (visibility: `water.bills` at the installation while the water module is
on), recipient rule `energy_bills` (every active user, filtered by that visibility), period-only text, phone app on, WhatsApp off, listed
in the policy matrix only while the water module is on (`water.` prefix rule). Emitted in the same transaction as the draft, once per
draft (dedupe key carries the bill id). `services/energy_notify.water_draft_ready`.

## D-02 + SCR-21 - generator battery 12 V / 24 V detection

Before: the server guessed the system from every sample (`b <= 16` = 12 V), the dial from its own boundary (`batt > 18`). A 24 V bank that
sagged to 15.8 V was judged against 11.6 V and the alert was CLEARED; the dial showed 16.1-18 V on a 24 V bank as a healthy 12 V bank.

Now ONE rule, `services/generator_core.battery_system` and `frontend/src/generator/gen-logic.ts batterySystem`:
the administrator's choice (`battery_nominal_v` 12 / 24 on `PUT /generator/devices/{id}`, null = detect, default), else 24 once the bank
was EVER seen above 16 V (latched in `generator.battery_system`, also from the stored history - read once per generator and process, so
a bank already sagging when the release starts is caught), else the reading itself (above 16 V = 24). The device answer carries
`battery_system_v` (what is known without the reading) and `battery_nominal_v`; `gen-live-page.ts` passes it to `gaugeList`. A 12 V bank
never stays above 16 V, so the latch only errs towards "24 V" (a false low, never a false healthy).

The settings screen has no control for `battery_nominal_v` yet (API only); open question 2.

## D-03 - generator mute (server rules only; the buttons' confirmation is PHYSICAL-CONFIRM-2540)

- Muting a CRITICAL type (the alert fired as critical, the type is critical by default, or the generator's policy makes it critical) needs
  `generator.manage` (the audited 403 of `rbac.require` otherwise) and lasts at most `MUTE_CRITICAL_MAX_H` = 4 hours (a longer request is
  shortened; `muted_until` in the answer is the real end). Other severities: as before (`generator.view`, up to 7 days).
- `DELETE /generator/alerts/{id}/mute` ends a mute now (generator.view - it can only make alerts louder; idempotent; audited
  `generator.alert.unmute` when a running mute was removed); answers the alert detail.
- A mute delays, it no longer swallows: an open alert without a notification (raised while muted, including a flap re-raise inside the
  fold window) is notified on the first engine pass after the mute ends (expired or removed) while the condition still holds; the later
  clear then emits the "resolved" too. Tried once per alert and process (`_TOLD_LATE`, registered for the test reset).
- Audit: `generator.alert.mute` now carries `hours` (applied), `requested_hours`, `critical`, `device_id`, `key`, `until`.

Not changed here (owned by PHYSICAL-CONFIRM-2540): `gen-alerts-page.ts` (the "mute 24 h" / "ack all" buttons, their confirmation, an
un-mute button, showing the 403 for an operator on a critical alert). The API client has no un-mute call yet (an unused export would fail
the unused-exports gate); the route is ready for that row.

## Files

Backend: `services/bill_ledger.py`, `services/energy_billing.py`, `services/water_billing.py`, `services/energy_notify.py`,
`services/notify_policy.py`, `services/notify_policy_en.py`, `services/notify_policy_text.py`, `services/notify_visibility.py`,
`services/generator_alerts.py`, `services/generator_core.py`, `routers/generator.py`, `wire/generator.py`, `error_text_en.json`,
`error_text_tpl_en.json`; tests `tests/test_data_rules_generator_2540.py`, `tests/test_data_rules_billing_2540.py`,
`tests/test_data_rules_water_2540.py`; golden `tests/fixtures/bill_ledger_b_sql_golden.json` regenerated on purpose
(`SW_BILL_LEDGER_GOLDEN_WRITE=1`): the retention statement and the water automatic pass now emitting `water.bill_draft`.
Frontend: `src/generator/gen-logic.ts`, `src/generator/gen-live-page.ts` (one argument), `src/api/generated/wire-generator.ts`
(regenerated), `tests/unit-data-rules-2540.spec.ts`.

Shared files other rows may also touch: `error_text_en.json` / `error_text_tpl_en.json` (one line each, sorted table), `notify_policy*.py`.
None of the files owned by TIME-CORRECT-2540, CORE-RELIABILITY-2540, HONEST-STATES-2540, PHYSICAL-CONFIRM-2540 or CAST-RELAY-HARDEN-2540.

UI: no screen changes in the shipped fixtures (the pixel fixtures read 27.4 V / 13.x V, which look as before); only a 24 V bank at 16-18 V
or a known 24 V bank below 16 V draws differently. No pixel baseline refresh was needed (no visible change on the captured screens); the
before / after of the edge values is a table page (local, Hebrew): `private/planning/data-rules-2540_compare_2026-11-26.html`.

## Tests

All on the Linux runner (slot B) unless marked PC. Branch head tested: `1eee3f203` (code identical to this commit's; this commit adds
only this note).

Fails before / passes after (the new test files copied onto `origin/release/2530-train` at `130ca5213`, which has none of these fixes):

| file | base (before) | branch (after) |
|---|---|---|
| `tests/test_data_rules_generator_2540.py` | exit 1: 8 failed, 1 passed | exit 0: 9 passed |
| `tests/test_data_rules_billing_2540.py` | exit 1: 3 failed, 2 passed | exit 0: 5 passed |
| `tests/test_data_rules_water_2540.py` | exit 1: 3 failed, 1 passed | exit 0: 4 passed |
| `frontend/tests/unit-data-rules-2540.spec.ts` | exit 1: `gen-logic` has no `batterySystem` (SyntaxError on import) | exit 0: 4 passed |

The tests that pass on the base too are the guards of unchanged behaviour (a non-critical mute stays with the operator, an account
without issued bills changes its cycle freely, the anchor month of a monthly cycle, the water source hidden while the module is off).
The same three backend files also passed on the PC (one file per process): 9, 5 and 4 passed.

Other checks (runner):
- `scripts/gen_wire_types.py --check` exit 0; `wire_ratchet.py` exit 0; `request_strict_ratchet.py --check` exit 0;
  `error_contract_inventory.py --check` exit 0; `i18n_backend_errors.py` exit 0 (without English: 0); `gate/lint_backend.py --strict`
  exit 0 (0 findings); `design_ratchet.py` exit 0; `api_inventory.py` regenerated and committed (the new DELETE route), then unchanged.
- `ruff check` on the changed product files and the generator test: exit 0. (The two billing / water test files reuse the fixtures of
  `test_energy_billing_api` / `test_water_billing_s3` by import, which ruff reports as F811 - the same pattern and the same report as the
  existing `tests/test_energy_elecbill77.py`; the blocking backend lint passes.)
- Frontend: `tsc --noEmit -p tsconfig.json` exit 0 (0 errors); `npm run typecheck` exit 0; `npm run lint` exit 0;
  `unused-exports.mjs --enforce` exit 0; `api-client-check.mjs` exit 0.
- Node unit suite (`playwright.unit.config.ts`, 2 workers): 5336 passed, 15 skipped, 3 failed - the 3 are
  `unit-mfa-passkeys-2490.spec.ts` browser cases that need a preview server on port 4173 (`ERR_CONNECTION_REFUSED`); they fail the same
  way on the base worktree. Not related.
- Golden SQL traces: `tests/test_bill_ledger_lifecycle_b.py` regenerated with `SW_BILL_LEDGER_GOLDEN_WRITE=1` (PC), then passed without
  it (PC: 25 passed); `tests/test_bill_ledger_cross_kind.py` 11 passed (PC); `tests/test_generator.py` 49 passed (PC).

FULL backend suite (runner, all 1,123 `tests/test_*.py`, one pytest process per 10 files, 4 lanes, `-m "not timing_lane"`):
46,409 passed, 32 skipped, 3 xfailed, 4 deselected, **3 failed** - all three fail identically on this row's base `aeb05ad3d` without any
change of this row (runner: 3 failed) and pass on the newer train head `3b4654f8b` (the train fixed them after this branch was cut;
they go away when the row is merged onto the train). None touches this row's code:
- `tests/test_gate_speed.py::test_v2_jobs_cover_exactly_the_v1_specs_and_projects` (the gate's fixture job list);
- `tests/test_secfix_restore_settings_2520.py::test_every_security_and_remote_setting_is_classified_keep_or_travel`
  (`access.station_media_direct_v2` not classified in backup.py - owned by CORE-RELIABILITY-2540);
- `tests/test_t06_admission_295.py::test_the_only_modules_that_reach_a_signing_call_are_the_known_ones`.

NOT_RUN: pixel specs (no captured screen changes - see UI above); the Playwright browser suites; lab (not allowed).

## Open questions (recommendation first)

1. Critical mute cap: (a) 4 hours (built); (b) 12 hours (one shift); (c) a generator setting, default 4.
2. A control for the battery system in the generator settings (thresholds section): (a) yes, a 3-way choice "detect / 12 V / 24 V" in a
   later UI row (recommended); (b) API only.
3. The review's second D-01 layer - a continuity note in the bill snapshot when the previous sealed bill does not end where the period
   starts: (a) add it as a status warning on the account (not in the sealed snapshot) in a later row (recommended); (b) in the snapshot;
   (c) not needed after this fix.
4. A draft a PERSON left that expires after 30 days on an automatic account leaves its period `skipped` (same class as D-05, rarer):
   (a) let retention re-open the run row of such a period so the next pass makes an automatic draft (recommended, later row); (b) keep.
