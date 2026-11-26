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
or a known 24 V bank below 16 V draws differently. No pixel baseline refresh and no compare page were needed (no visible change on the
captured screens).

## Tests

RESULTS_PLACEHOLDER

## Open questions (recommendation first)

1. Critical mute cap: (a) 4 hours (built); (b) 12 hours (one shift); (c) a generator setting, default 4.
2. A control for the battery system in the generator settings (thresholds section): (a) yes, a 3-way choice "detect / 12 V / 24 V" in a
   later UI row (recommended); (b) API only.
3. The review's second D-01 layer - a continuity note in the bill snapshot when the previous sealed bill does not end where the period
   starts: (a) add it as a status warning on the account (not in the sealed snapshot) in a later row (recommended); (b) in the snapshot;
   (c) not needed after this fix.
4. A draft a PERSON left that expires after 30 days on an automatic account leaves its period `skipped` (same class as D-05, rarer):
   (a) let retention re-open the run row of such a period so the next pass makes an automatic draft (recommended, later row); (b) keep.
