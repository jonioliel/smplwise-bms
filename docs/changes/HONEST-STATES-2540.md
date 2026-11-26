# HONEST-STATES-2540 - honest lock / alarm states on the home interface; controlled sw-toggle

Branch `pilot/HONEST-STATES-2540` from `origin/release/2530-train` (aeb05ad3d). Target 2.54. Frontend only: no backend, wire, migration
or setting change; nothing was run against the lab, a device or Home Assistant.

Findings from `docs/review/DEEP-REVIEW-2520-INDEX.md` (on `origin/chore/REVIEW-FINDINGS-INDEX-2530`):

| Finding | What was wrong | Fix |
|---|---|---|
| SCR-10 (medium) | An offline lock (`available: false`, `locked: false`) - and a lock answering `unknown` / no state - was counted, announced and coloured as an open door ("דלת הכניסה פתוחה", warn tone, "לא נעולות" filter, the leaving-scene "lock it?" suggestion) | `HDoor.known` (`lockKnown(state, available)`: available and a lock state the screen knows). Unknown = neutral tone, the door icon, "לא ידוע" / "לא זמינה כרגע"; never counted as open and never lets "כל הדלתות נעולות" through ("מצב {name} לא ידוע", "מצב הדלתות לא ידוע", "מצב {n} דלתות לא ידוע"). The "לא נעולות" filter keeps doors it cannot vouch for; the scene suggestion skips them |
| SCR-09 (medium) | The home "אבטחה" chip said "דרוך" (green) for an unavailable / unknown panel (`state !== 'disarmed'`); the alarm screen offered "נטרול" for an unknown state | `alarmLook()` + `securityChip()` in `home-v3-words.ts`: triggered > armed > all unavailable ("לא זמין", warn) > any unknown ("לא ידוע", plain) > "לא דרוך". The alarm screen: an unknown state says "מצב המערכת לא ידוע כרגע." and its arm buttons are disabled |
| FC-01 (medium) / SCR-29 | `sw-toggle` flipped itself before the screen decided, so a cancelled confirmation or a refused save left the switch on a state never saved | Opt-in `controlled` property (like `<sw-tabs controlled>`): a press only dispatches `change` with `detail.checked` = the asked value; the switch draws `checked` until the screen sets it. `toggled(e)` reads `detail.checked` (native check boxes unchanged). Applied to the automation editor's enable switch and the two camera OSD switches ("שם על התמונה", "חותמת זמן"); every other switch keeps today's behaviour |
| FC-04 | already fixed on main (FE-SAFETY-FIX-2520) | skipped |

## Files

- `frontend/src/home/home-logic.ts` - `lockKnown`, `doorOpen`, `doorNotLocked`, `doorTone`, `doorsTone`; `doorsText`, `doorState`
- `frontend/src/home/home-api.ts` - `HDoor.known`; the adapter sets it and never reports an unknown lock as locked
- `frontend/src/home/home-v3-words.ts` - `alarmLook`, `securityChip`
- `frontend/src/home/sw-home.ts` - strip pill, category chips (doors, security), door row, "לא נעולות" filter
- `frontend/src/home/home-wall-rest.ts` - the wall panel's doors pill tone
- `frontend/src/home/home-favgrid.ts` - the leaving / night suggestion skips unknown doors
- `frontend/src/home/home-alarm.ts` - buttons and line from `alarmLook`
- `frontend/src/i18n/lang/en/i18n/msg/home.ts` - English of the five new texts
- `frontend/src/components/sw-toggle.ts`, `frontend/src/components/toggle-value.ts` - controlled mode, `toggled()`
- `frontend/src/screens/automation-editor-base.ts`, `frontend/src/screens/live-camera.ts` - `controlled` on the switches above
- tests: `unit-honest-states-2540.spec.ts` (new), `evidence-honest-states-2540.spec.ts` (new), `pixel-honest-states-2540.spec.ts` (new,
  Linux baselines), `honest-states-2540-mocks.ts`, `honest-states-2540-shots.spec.ts` (compare-page captures, SW_SHOTS=1 only),
  two FC-01 cases + two knobs (`itemPatch`, `refuseToggle`) in `evidence-automations-builder.spec.ts`, the `known` field in the
  `unit-home-simple-logic.spec.ts` fixture

## Tests

All on the Linux runner (slot B, `~/work/p2520_honeststates_run.sh` at 3ce7a0e21, re-run `~/work/p2520_hs_rerun.sh` at 10b35b42d),
mocked backends only, except the three unit files marked PC.

| Check | Command | Exit | Result |
|---|---|---|---|
| build (tsc + vite) | `npm run build` | 0 | - |
| typecheck tests + scripts | `npm run typecheck` | 0 | - |
| lint | `npx eslint src --pass-on-unpruned-suppressions` | 0 | - |
| design ratchet | `python scripts/design_ratchet.py` | 0 | no count above the baseline |
| unit | `playwright -c playwright.unit.config.ts` unit-honest-states-2540, unit-home-simple-logic, unit-i18n-home, unit-home-favorites-2500, unit-home-v3-p1, unit-home-screen, unit-i18n-lang-packs-2443 | 0 | 64 passed |
| unit (PC) | the same config, one file each: unit-honest-states-2540 / unit-i18n-home / unit-home-simple-logic / unit-home-favorites-2500 | 0 | 12 / 6 / 9 / 19 passed |
| new pixel baselines | `pixel-honest-states-2540.spec.ts --project=desktop --project=mobile --update-snapshots`, then compare at 10b35b42d | 0 | 8 written; 8 passed against the committed baselines |
| behaviour | `evidence-honest-states-2540.spec.ts` desktop + mobile | 0 | 9 passed, 1 skipped (the OSD case runs on desktop only) |
| automation enable switch | `evidence-automations-builder.spec.ts -g "enable switch"` desktop | 0 (re-run) | 3 passed. First run: 1 failed - the test checked the zero-size `sw-dialog` host for visibility; fixed to check the dialog body (test-only, 10b35b42d) |
| home regression | home-simple-2420, home-simple-2421, home-v3-p1, home-wall-night-2500, home-alarm-follow-2520, home-account-2530, desktop + mobile | 0 | 66 passed, 66 skipped (their own project skips) |
| existing home pixels | pixel-home-account-2530, -next-2500, -gaps-2436, -auditfix-2437, -fb-2431, desktop + mobile | 0 | 42 passed, 4 skipped - the demo house looks exactly as before |
| compare captures | `honest-states-2540-shots.spec.ts` SW_SHOTS=1, base build (before) and branch (after) | 0 | 24 pictures: `private/planning/honest_states_2540_compare_2026-11-25.html` |

NOT_RUN: the full release gate; the full `evidence-automations-builder.spec.ts` and the other sw-toggle screens (the default,
uncontrolled path is unchanged: same `checked` flip, same `detail.checked`); the lab (forbidden for this row).

## Known limits (not in this row)

- The FULL interface's area row (`api/area-row.ts` locks chip, backend `services/devices.py` `locks_locked` count) still counts an
  offline lock as "not locked"; the backend's area `alarm` summary still lets `unavailable` win over `disarmed`.
- SCR-29's second half (an OSD switch writes to the NVR on one press, with no confirmation) is unchanged.
- `sw-automation-card` / `sw-automation-row` keep their `switchPress` helper (already correct); other switches that save at once are
  not converted - the controlled mode is opt-in.

## Open questions

1. A setting for the new wording? (a) no - showing an unknown state as open / armed is a bug, not a preference (recommended);
   (b) a setting "show unknown locks as open".
2. Convert the remaining save-at-once switches (schedules, settings rows) to `controlled`? (a) yes, one row per screen family with
   its own tests (recommended); (b) leave as is.
3. Fix the full interface's area-row lock / alarm counts the same way? (a) yes, a small follow-up row (backend counts additive:
   `locks_unknown`) (recommended); (b) no.
