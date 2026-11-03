# WISKEY-LIVE-VALIDATION-2390 - station acceptance tool ("בדיקת קבלה לעמדות")

WisKey integration plan T16 (`private/planning/WISKEY_FULL_INTEGRATION_PLAN_2026-11-03.md`, rows 70 / G8). Branch
`pilot/WISKEY-LIVE-VALIDATION-2390` from `origin/main` (v2.38.1). Target release 2.39.0. No merge, no tag.

## What it does

An installer's acceptance checklist per station, in Settings next to the WisKey status, on its own route
`#/system/wiskey-validation[?station=<id>]`. Runs only when someone presses a button - one station, or all of them.
Per station, in this order:

| Check | Path | Result |
|---|---|---|
| `identity` - זהות העמדה | WisKey Native `live_validation` step `identity` (`/ISAPI/System/deviceInfo` against the pinned identity) | pass / fail / unsupported / not_run |
| `door_capabilities` - יכולות הדלת | step `door_capabilities` per mapped door (remote-open advertised, relay in range) | same |
| `door_read` - קריאת הגדרות הדלת | step `door_read` per mapped door (the door's configuration is readable; nothing is kept) | same |
| `media_arx` - תמונה דרך Arx | one JPEG through Arx's own source (`LocalProvider`, go2rtc in-memory stream, by name) | same |
| `media_wiskey` - תמונה דרך WisKey | the installed WisKey still when `wiskey.auto_install` is on, else W10 descriptor + stream lease (WisKey only, no fallback) | same |
| `talk` - זמינות דיבור | the talk availability rule of `GET /stations/{id}/media` with its reason; no talk session, no microphone | same |
| `events` - זרם אירועים | WisKey `health/get` (else the feed's technical copy) AND Arx's own feed state | same |
| `clock` - סטיית שעון | WisKey's measured skew / drift state, tolerance 2 s (the drawer's own "clock ok" line) | same |

The three WisKey checks are ONE `features/start` per station (feature `live_validation`, private input
`native_validation.v1`: owner go, checklist ref, ordered steps bound to station + physical relay + mapping revision of the
confirmed relay map), then `features/result` until the native receipt is finished. WisKey stops a run at the first step that
does not succeed and marks the rest `aborted`: Arx shows that step as `fail` and the rest as `not_run`
(`aborted_after_failure`). An unknown / lost / still-running result is `fail` (`result_unknown`), never a pass. One request id
per station run (`wiskey_feature_intents`, no replay); settled `accepted` only when every step was acknowledged.
WisKey's `features/status` is never read (WisKey T06, `tests/test_t06_work_states_297.py`: a static availability flag proves
nothing) - the start itself answers.

The optional **door pulse** is a separate run ("פעולה פיזית - דלת תיפתח"): one `pulse` step of one mapped door through the same
feature, for a system administrator on a local session (refused through the remote tunnel), with `access.doors.open` on the
station, after typing the station's name exactly, with a witness's name; at most one attempt per station per check run; never
part of "run all"; refused while any run is in progress; never retried. WisKey's receipt only says the command was
acknowledged (`physical_result` / `human_witness` stay `unknown` there), so the result stays `pending / awaiting_witness`
until the administrator records the witness's verdict once: `opened` passes, `not_opened` / `unsure` fail.

Results are honest: `pass`, `fail` + reason, `unsupported` (WisKey does not offer it: the start refused with a closed code such
as `feature_disabled` / `authenticated_current_source_not_installed` / `unknown_command`, W10 not listed ...), `not_run` + why (switch, no relay map, direct join off, cancelled, interrupted, earlier step failed). Every reason
code has one Hebrew line in `services/wiskey_live_validation.REASON_TEXT` (served with each result and used in the export).

Kept per run (migration 0199): the run (who, when, scope, state) and one row per station and check (status, reason code, a
small detail of codes / numbers / times). Never a frame, a source, an address, a credential or WisKey's target `identity`
(a device identity - dropped on read). Export: CSV (UTF-8 BOM, formula-safe cells, audited) and print / PDF through the browser
(the events-print frame). A run cut by a restart is closed as `interrupted`, never resumed. Cancel stops between checks.

Audited: `wiskey.validation.run` (allowed / denied), `wiskey.validation.run.end` (state + counts), `wiskey.validation.cancel`,
`wiskey.validation.export`, `wiskey.validation.pulse` (before anything is sent; refusals with their reason),
`wiskey.validation.pulse.result`, `wiskey.validation.witness`, and the gate's own 403s (`access.stations.manage`).

## Files

New
- `smplwise_vms/backend/smplwise/services/wiskey_live_validation.py` - runs, native steps, Arx probes, pulse, witness, CSV.
- `smplwise_vms/backend/smplwise/routers/wiskey_validation.py` - `GET /wiskey-validation`, `POST /wiskey-validation/runs`,
  `GET /wiskey-validation/runs/{id}`, `POST .../cancel`, `GET .../export.csv`, `POST /wiskey-validation/pulse`,
  `POST /wiskey-validation/pulse/{id}/witness`. Gate: `access.stations.manage` anywhere (audited 403); a station counts with
  `access.read` + `access.stations.manage` on its chain.
- `smplwise_vms/backend/smplwise/migrations/0199_wiskey_live_validation.sql` - `wiskey_validation_runs`, `wiskey_validation_results`.
- `frontend/src/screens/system-wiskey-validation.ts` (the page), `frontend/src/screens/system-wiskey-validation-card.ts`
  (the settings card), `frontend/src/api/wiskey-validation.ts`, `frontend/src/wiskey/live-validation-link.ts` (drawer row).
- Tests: `smplwise_vms/backend/tests/test_wiskey_live_validation_2390.py`,
  `smplwise_vms/backend/tests/fixtures/wiskey_live_validation/rc10_live_validation.json`,
  `frontend/tests/unit-wiskey-live-validation-2390.spec.ts`, `frontend/tests/evidence-wiskey-live-validation-2390.spec.ts`
  (+ its linux baselines when taken on the runner).

Shared edits (minimal; report to the train owner)
- `services/wiskey_feature_direct.py`: `SPECS["live_validation"]` `needs_targets` False -> True (one line). WisKey's
  ValidationCoordinator needs 1..64 granted targets; with False the adapter dropped the targets and every real start would
  have been refused. Existing callers pass no targets and behave as before (the feature is not station-scoped in
  `resolve_policy`).
- `main.py`: the router (two lines, after the quiet router - away from the other WisKey branches' insertions).
- `frontend/src/shell/sw-app.ts`: one route line (after `readiness`); `frontend/src/shell/lazy-screens.ts`: one entry.
- `frontend/src/screens/system-diagnostics.ts`: one import + one tag (after `<system-wiskey-diagnostics>`; the pairing branch
  inserts before it).
- `frontend/src/screens/wiskey-stations-views.ts`: one import + one row inside the technical `<dl>` (after the relays row; the
  station-ops and deep-links branches insert after `</dl>`).

## Migration

`0199_wiskey_live_validation.sql` - the next free number after 0197 (intercom calls, 2.38.2 train) and 0198
(WISKEY-PEOPLE-COMPLETE-2390). Old pilot `pilot/XSCENARIO109-295` also carries a `0199_scenarios.sql` (not on a train).
On this branch alone 0197 / 0198 are a gap: `test_wiskey_s5_migration_upgrade.py::...contiguous...` (contiguity +
`nums[-1] == 196`) fails here until the train carries 0197 / 0198 - as on every branch that adds a migration; renumber at the
merge if needed. The runner applies migrations by number and tolerates the gap. Additive; rollback = drop both tables.

## Contract source

WisKey `C:\hik intercom`, `origin/codex/wiskey-mac-m12-policy-b-2026-11-02` @ `2834aa5e`, rc.10:
`access/arx_validation_execution.py` (VALIDATION_KIND, PERMISSIONS, OBSERVATIONS, ValidationCoordinator), `access/arx_feature_plans.py`
(REQUIREMENTS), `access/arx_feature_host.py` (start_admitted, feature_host_status), `arx_feature_api.py` (COMMANDS). Read as data;
the facts are in the test fixture `rc10_live_validation.json`. The rc.10 pin (`docs/integrations/wiskey/catalog/rc10-extract/`,
branch `pilot/WISKEY-RC10-PIN-2382`) is checked by a test when it is in the tree (skipped on this branch).

## WisKey gaps found

1. **No media step for Arx.** `live_validation`'s `video` step needs `features/prepare_media` with ingress tickets for the
   validation feature (`native_media_ingress_required` otherwise); Arx's direct client prepares media for `live_media` only.
   The media checks therefore use Arx's existing W10 / still paths. `two_way_audio` is a microphone session and is not used.
2. **No physical or witness evidence from WisKey.** The receipt always says `physical_result: unknown`, `human_witness: unknown`;
   the pulse step's observation is only `command_acknowledged`. Arx records the witness itself.
3. **One failure stops the station.** A failed step aborts every later step of the operation (also other doors); Arx shows
   them `not_run`. Per-door independence would need one operation per door.
4. **No identity detail.** `identity` reports only `identity_matched`; model / firmware come from the overview, not the step.
5. **W10 commands not in `overview.api.commands`** (plan finding 2): `media_wiskey` / `talk` answer `unsupported`
   (`not_listed` / `wiskey_talk_not_listed`) on the lab until agent (a)'s fix or WisKey lists them.
6. **Rotated pairing key** (plan finding 3) turns the direct join off: the WisKey checks answer `not_run` (`direct_join_off`).
7. **No clock / event command of its own in the feature.** Events and clock come from `health/get` (else the feed copy).

## Tests

- Backend (fakes only: `FakeValidationHost` plays rc.10's ValidationCoordinator from the fixture; scripted Arx probes; the
  intercom_media fakes): `tests/test_wiskey_live_validation_2390.py`.
- Unit (node only): `frontend/tests/unit-wiskey-live-validation-2390.spec.ts`.
- Browser (runner, mocked backend, desktop 1440 + mobile 390; three `pixel-stable` cases):
  `frontend/tests/evidence-wiskey-live-validation-2390.spec.ts`.
- No lab, no device write, no door pulse outside the fake.

## Receipts (2026-11-03/04)

| What | Where | Result |
|---|---|---|
| `tests/test_wiskey_live_validation_2390.py` + `test_t06_work_states_297.py` + `test_wkcap_295.py` | workstation, `.venv` Python 3.12, `pytest -q` | 159 passed, 1 skipped (the rc10 pin is not in this tree) |
| `test_w031_295.py`, `test_eccact_features_295.py`, `test_wkpeer_295.py`, `test_door_automation_295.py` | workstation | passed |
| `test_wiskey_s5_migration_upgrade.py` | workstation | 3 FAILED - expected: the 0199 gap (0197 / 0198 live on other branches) and `nums[-1] == 196`; see Migration |
| `npx tsc --noEmit` | workstation (node only) | 0 errors |
| `tests/unit-wiskey-live-validation-2390.spec.ts` (node only) | workstation, `playwright.unit.config.ts` | 5 passed |
| `tests/evidence-wiskey-live-validation-2390.spec.ts` desktop + mobile (16 cases, 3 `pixel-stable`) | runner, `run_smart.py spec` @ `530c77b4d` | 16 passed, three runs in a row |
| regression: `pixel-wiskey-stations`, `pixel-access-s12`, `evidence-wiskey-stations`, `evidence-access-s12`, `layout-wiskey-stations`, `unit-a11y-polished-lint` | runner, desktop + mobile | 151 passed, 25 skipped (the specs' own skips), 0 failed |

NOT_RUN: the full backend suite and the full browser gate; any lab / WisKey / station / door contact (by design); the
rc10-pin test (skipped until `pilot/WISKEY-RC10-PIN-2382` lands).
