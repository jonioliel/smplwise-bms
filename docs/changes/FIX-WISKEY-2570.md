# FIX-WISKEY-2570 - WisKey area: the open findings of the 2.56 deep review (WA-02, WA-03, SCR-51 part)

Row FIX-WISKEY-2570 (target 2.57). Base `origin/release/2570-train` at `6ea807b2e` (= v2.56.0). Branch `pilot/FIX-WISKEY-2570`.
Source: `docs/review/DEEP-REVIEW-2560-WISKEY-ACCESS.md` on `origin/review/DEEP-2560-WISKEY-ACCESS`. Every finding was re-read at the
base before it was changed: all three still existed. Out of scope (lead): WB-04 (bridge store write rate - needs a lab measurement
first). The bridge (`custom_components/smplwise_bridge`, its mirror and its version) is not touched. Nothing was sent to WisKey, Home
Assistant, a station or the lab.

## Findings -> outcome

| ID | Finding (short) | Outcome | Where |
|---|---|---|---|
| WA-02 | Schedule execution: a review read that fails after a good one keeps half the counts and shows a phase from half the reviews | fixed | `services/wiskey_schedule_execution.py`, `wire/access_control_schedule_execution.py`, `frontend/src/components/wk-schedule-exec.ts`, `access-control/schedule-execution-logic.ts`, i18n `schedule-editor` (he + en) |
| WA-03 | Visit list: a status the WisKey filter contract leaves out is refused as `ended_filter_not_offered` | fixed | `routers/access_wiskey_visits.py`, `services/wiskey_visits.py` (`REASON_HE`), `error_text_en.json` |
| SCR-51 (part) | Call banner: a failed read that is not a 403 keeps the last list and any talk session silently | fixed (honest line; owner answer LOWS-FRONTEND-2550 Q2 a kept: the list and its buttons stay) | `components/sw-incoming-call.ts`, `components/incoming-call-logic.ts`, i18n `incoming-calls` (he + en) |

### WA-02
`_read_reviews` now counts into its own dict and returns it only when EVERY read of the check succeeded (`None` otherwise). On a failed
pending or review read `_check` uses the last COMPLETE review counts of the job (the remembered view had `reviews_read`, or already
carried them), else zero (phase `waiting_owner`, as before for a first failure). The job view gets a new key `reviews_unread: bool`
(additive, ADR-015) and the status read answers `{outcome: "ok", code: "reviews_unread"}`. Nothing new is sent: still only the three reads.
The row in "מצב הביצוע ב־WisKey" adds one line when `reviews_unread` is true: "לא ניתן היה לקרוא עכשיו את האישורים ב־WisKey - מוצג המצב
המלא האחרון שנקרא." / "WisKey's approvals could not be read now - the last complete state read is shown." The generated wire type
`frontend/src/api/generated/wire-access-control-schedule-execution.ts` was regenerated (`scripts/gen_wire_types.py`).

### WA-03
`status=ended` not offered keeps `ended_filter` / `ended_filter_not_offered`. Any other status the contract leaves out (e.g. WisKey
publishes `["all", "pending", "approved"]` and a stale panel asks `superseded`) is refused before any frame with 409
`wiskey_visits_unsupported`, details `{feature: "status_filter", reason: "status_filter_not_offered"}`, text "מערכת בקרת הכניסה המותקנת
אינה מציעה סינון לפי המצב הזה. לא נשלח דבר." (English in `error_text_en.json`).

### SCR-51 (the non-403 part)
The owner answered LOWS-FRONTEND-2550 question 2 with (a): after a failed read the banner keeps the last list and its buttons (the
server refuses an answer or a door for a call that ended; a talk session keeps its own server-side expiry). That stays. New: the failure
is classified by `pollFailure()` (403 -> `forbidden`, everything else -> `unread`); on `unread` the banner shows one amber line "לא ניתן
לקרוא כרגע את מצב השיחה · מוצג המצב האחרון שנקרא" / "The call state cannot be read right now · showing the last state read", cleared by
the next good read. No talk session is closed and nothing is sent again because of a failed read (no retry of any physical action; the
read itself keeps its normal poll schedule). The 403 branch is unchanged.

## Tests (run on the runner, slot B)

Runner job `~/work/p2570_fixwiskey_run.sh` at `8751812d3` (the generated wire type regenerated in the job, then committed).

| Test | Before (base `6ea807b2e` sources) | After |
|---|---|---|
| backend `tests/test_fix_wiskey_2570.py` (7 tests: WA-02 x4, WA-03 x3) | 7 failed | 7 passed |
| backend regression: `test_wiskey_schedule_execution_2530.py`, `test_wiskey_visit_filters_2560.py`, `test_wiskey_visits_ended_filter_2520.py`, `test_wiskey_visits_2407.py`, `test_i18n_errors_en_2520.py` | - | 61 passed |
| `scripts/gen_wire_types.py --check` | - | rc=0 |
| frontend unit `tests/unit-fix-wiskey-2570.spec.ts` | failed (module has no `pollFailure`; no tests ran) | passed |
| frontend unit regression: `unit-lows-frontend-2550-wiskey`, `unit-schedule-execution-2530`, `unit-incoming-calls`, `unit-physical-confirm-2540` (+ the new spec) | - | 39 passed |
| `tsc --noEmit` app and tests | - | rc=0 / rc=0 |
| eslint on the changed sources | - | rc=0 |
| ruff on the changed backend files (PC) | - | clean |

`tests/evidence-fix-wiskey-2570.spec.ts` (runner job `~/work/p2570_fixwiskey_shots.sh`, desktop + phone, light + dark): after 8 passed;
before (base sources) the banner and schedule tests fail on the missing new line, as expected. All 16 before / after screenshots taken.
Full backend / e2e suites: NOT_RUN (the train gate runs them).

## Look
Only new lines in failure states; no existing look changes, so no pixel baseline changes. Compare page (local, not committed): `private/planning/fix_wiskey_2570_compare_2026-11-28.html` with the screenshots in
`private/planning/fix_wiskey_2570_shots/` (desktop + phone, light + dark, before / after).
