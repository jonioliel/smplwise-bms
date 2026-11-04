# WISKEY-OPS-ANSWERS-2400 - owner answers 04.11 on station maintenance, the schedule deploy and the "no talk" wording

Branch `pilot/WISKEY-OPS-ANSWERS-2400`, cut from `origin/release/2400-train` @ `8e3ac8398`. Target 2.40.0. No version bump, no tag, no
merge. No lab, device, station, Home Assistant or WisKey contact: code, fakes and mocks only.

Source: `private/planning/OWNER_ANSWERS_2026-10-30_NIGHT_HE.md`, section "04.11 בוקר - סבב 18", answers 9, 10, 11 and 21.

## Q9 = a - station maintenance stays system-administrator only (verified, no code change)

What is built (`pilot/WISKEY-STATION-OPS-2390`, merged into the 2.40.0 train; `docs/changes/WISKEY-STATION-OPS-2390.md`):

- Every maintenance action (sync now, rescan, health refresh, clock check) is gated by `access.stations.manage`: anywhere at the gate
  (before the body is read, audited 403), then on the station's chain (a deny wins) - `routers/access_control_station_ops.py`.
- Of the built-in roles (`roles.json`) only `system_admin` carries `access.stations.manage`; `site_admin`, `operator`, `editor` and the
  rest do not. It is in `sensitive_permissions_not_implied`, so no broader grant implies it, and it is not in
  `rbac.STATION_PERMISSIONS` (a station-scoped allow binding cannot carry it). A custom role can carry it only by naming it, and only a
  system administrator edits roles.
- Already pinned by `tests/test_intercom_authority.py` and `tests/test_access_permissions_wxperm.py` (`access.stations.manage:
  {"system_admin"}`) and by `test_wiskey_station_ops.py::test_without_stations_manage_the_gate_refuses_before_the_body` (operator and
  site administrator get 403, nothing sent).
- Added: `test_owner_0411_maintenance_stays_system_admin_only_and_the_roles_label_names_it` (the built-in holders are exactly
  `{system_admin}`, the permission stays sensitive, plus the Q10 label).

Outcome: matches the answer; nothing to fix.

## Q10 = a - the permission's description names maintenance

`access.stations.manage` label, backend `routers/access.py` `PERMISSION_LABELS` and the frontend fallback
`frontend/src/access-control/access.ts` (they must be equal - `test_the_frontend_label_fallback_equals_the_backend_labels`):

- before: `בקרת כניסה: עריכת הגדרות עמדה (תוכניות דלת, החזקה פתוחה, קודים ציבוריים)`
- after: `בקרת כניסה: עריכת הגדרות עמדה ותחזוקת עמדות (תוכניות דלת, החזקה פתוחה, קודים ציבוריים; סנכרון, סריקה מחדש, רענון בריאות ובדיקת שעון)`

English: the permission labels exist in Hebrew only (the roles screen, `screens/system-access.ts`, renders the server's Hebrew label,
with the Hebrew frontend fallback); there is no English permission-label table to update. Adding one would be a new mechanism for the
whole roles screen - not done here (recorded as a gap, not silently resolved).

## Q11 = a - the schedule deploy button is shown, with a warning from the live readiness

The deploy button ("פריסה לעמדות", each library row) was already shown by `pilot/WISKEY-SCHED-WRITE-2390` (never hidden). What was
missing is a clear warning before the operator deploys. Built in `frontend/src/components/wk-schedule-library.ts`:

- `writesOff` = `ops.writes_enabled === false`, i.e. the live `operations_list` answer the screen already reads (`GET
  /access-control/schedules/operations`). No version number anywhere: when WisKey enables its station schedule writer
  (`writes_enabled: true`) the warning disappears by itself. No operations answer yet (loading / refused) -> no claim either way.
- The library card shows the warning under its header (`data-se-writes-off`); it replaces the shorter line the jobs card carried (one
  warning on the page, visible even when there are no jobs yet).
- The deploy drawer shows it at the top before any station is picked (`data-se-deploy-warning`); the progress view keeps its own line.
- The deploy confirmation dialog adds one sentence (`data-se-confirm-writes-off`).
- Text (Hebrew, `i18n/schedule-editor.ts` `deployWritesOff`): "שימו לב: כרגע פריסה לא משנה דבר בעמדות. WisKey עדיין לא הפעיל כתיבה של
  לוחות זמנים לעמדות, ולכן פריסה רק יוצרת עבודה ומריצה בדיקה מקדימה. העבודה תיעצר במצב "חסום" ושום דבר לא ייכתב לעמדה. ההודעה תיעלם
  כש־WisKey יפעיל את הכתיבה." English counterparts added (`en` table).
- Why it blocks (for the record, WisKey 2.0.1-rc.10): every job ends `blocked` with `schedule_writes_unverified` (WisKey's station
  schedule writer is not enabled) and `schedule_ownership_unknown`; the deploy creates the job and runs WisKey's preflight only.

## Q21 = b - the station drawer's "no talk" reasons name WisKey (owner exception)

Owner exception 04.11 to the rule "an operator screen never names the platform" (UI_COPY_RULES), for the drawer's "no talk" reasons
only. `frontend/src/i18n/wiskey-station-media.ts` `dial.reasons`, Hebrew and English. All four reasons that said "מערכת האינטרקום"
describe WisKey itself, so all four changed:

| reason | before | after |
|---|---|---|
| `not_listed` | מערכת האינטרקום לא מפרסמת פקודות דיבור ל-Arx | WisKey לא מפרסם פקודות דיבור ל-Arx |
| `pairing` | חסר צימוד חתום למערכת האינטרקום, ולכן אין דיבור מהמסך | חסר צימוד חתום ל-WisKey, ולכן אין דיבור מהמסך |
| `capabilities_unread` | לא ניתן היה לבדוק מול מערכת האינטרקום אם דיבור זמין; מוצג וידאו בלבד | לא ניתן היה לבדוק מול WisKey אם דיבור זמין; מוצג וידאו בלבד |
| `wiskey_unavailable` | מערכת האינטרקום לא זמינה כרגע; מוצג וידאו מהמקור המקומי | WisKey לא זמין כרגע; מוצג וידאו מהמקור המקומי |

Unchanged (they do not describe WisKey): `off`, `provider_local`, `unsupported`, `forbidden`, `unavailable`; the talk problems; every
other drawer word. The station-maintenance words ("מערכת האינטרקום עסוקה" etc., `i18n/wiskey-station-ops.ts`) are not talk reasons and
keep the rule.

Tests adjusted for these strings only:
- `unit-wiskey-talk-dial-2382.spec.ts`: `not_listed` pinned to the new text; the four named reasons must say WisKey; every other dial
  word and reason still must not; no dial text says "מערכת האינטרקום".
- `unit-wiskey-talk-caps-2382.spec.ts`: `capabilities_unread` names WisKey, never the home platform.
- `evidence-wiskey-talk-caps-2382.spec.ts`, `evidence-wiskey-talk-dial-2382.spec.ts`: the exact texts; the BANNED check of the call
  section now runs on its text minus the reason string (the exception is that string only).

## Files

- `smplwise_vms/backend/smplwise/routers/access.py`, `frontend/src/access-control/access.ts` (Q10)
- `frontend/src/components/wk-schedule-library.ts`, `frontend/src/i18n/schedule-editor.ts` (Q11)
- `frontend/src/i18n/wiskey-station-media.ts` (Q21)
- Tests: `smplwise_vms/backend/tests/test_wiskey_station_ops.py`, `frontend/tests/unit-schedule-editor-logic.spec.ts`,
  `frontend/tests/evidence-wiskey-schedule-writes.spec.ts` (warning in the drawer and the confirmation; a new test: writes enabled ->
  no warning, the button stays), `frontend/tests/unit-wiskey-talk-dial-2382.spec.ts`, `frontend/tests/unit-wiskey-talk-caps-2382.spec.ts`,
  `frontend/tests/evidence-wiskey-talk-caps-2382.spec.ts`, `frontend/tests/evidence-wiskey-talk-dial-2382.spec.ts`.

Pixel baselines expected to change: `pixel-wiskey-schedule-writes` (the warning on the library card and in the deploy drawer: manage,
editor, deploy-impact, deploy-done; desktop + phone) and `pixel-wiskey-talk-dial-2382` `talk-dial-classic-pairing` (desktop + phone).
They are re-taken on the runner (see the receipts).

## Rollback

Revert the branch's commits. No migration, no setting, no stored state.

## Receipts

See the commit that adds them below (filled after the runs).
