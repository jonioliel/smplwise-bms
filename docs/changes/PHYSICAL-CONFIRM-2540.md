# PHYSICAL-CONFIRM-2540 - physical actions behind their confirmation, honest outcomes, the call banner does not swap

Row PHYSICAL-CONFIRM-2540 (target 2.54). Base `origin/release/2530-train` (`aeb05ad3d`). Branch `pilot/PHYSICAL-CONFIRM-2540`.
Source: `docs/review/DEEP-REVIEW-2520-INDEX.md` (branch `chore/REVIEW-FINDINGS-INDEX-2530`) and
`docs/review/DEEP-REVIEW-2520-FRONTEND-SCREENS.md` (branch `review/DEEP-2520-FRONTEND-SCREENS`).

## What and why

| Finding | Was | Now |
|---|---|---|
| SCR-15 (medium) | NVR alarm-output "pulse" energised a physical relay (siren, light, gate) on one click | The shared confirmation dialog names the output, the recorder (with two or more) and the pulse length; it opens with the focus on **cancel**; one pulse to the recorder that was shown when it was confirmed. No typed word (the codebase uses one only for the restart and for the installer / validation door pulse, not for this class). |
| SCR-14 (medium) | A late `nvr/system` answer for recorder A was shown while the buttons acted on recorder B | The answer is dropped when the selected recorder changed; the restart dialog names the recorder; the restart and the pulse capture the recorder id at confirmation. |
| (same card) | Any failure of the pulse / restart was red "failed" | Physical actions are read by `api/physical-outcome.ts`: a refusal (4xx, structured `not_sent` / `refused`, `source_forbidden`) is red with the reason; no answer / time-out / 5xx is amber "unknown, check on site before trying again". The success line says "the NVR accepted the command" (not "done"). |
| SCR-11 (medium) | Incoming-call banner showed `shown[front]` by index: a newer station ringing swapped the sheet under the finger; another call's open door question disabled every door | The front call is tracked by `call_id` (`frontCall`): it stays while shown, the newer one waits behind "עוד 1". When the front call leaves by itself (ended / hidden) the next one ignores taps for `FRONT_SETTLE_MS` (800 ms, monotonic clock). The door question belongs to its call: dropped when another call comes to the front, never disables another call's doors. The home full-screen call (`sw-home-call`) uses the same front call. |
| SCR-12 (medium) | Banner door open: any thrown error said red "the door was not opened" and re-enabled the buttons at once; `openDoor` overwrote the call's busy slot (wiping an answer in flight) | `doorFailure()` (the stations screen's rule): only a structured `not_sent` / `refused` is "the door was not opened"; anything else is amber "unknown, check on site" and the door's button is **held** ("ממתין לבירור…") for the backend's `retry_after_s` (fallback 70 s, as the stations screen); `intercom_release_in_progress` holds too. The release has its own per-door sending set and an entry guard. |
| SCR-18 (medium) | Automation "device test": each step was marked "done" without reading the action record; restore set `restored = true` regardless; a sensitive step (unlock) carried the confirmation grant from one tap | Each device's record is followed (`awaitAction`): confirmed = done ("sent, the device reports no state" when `confirmation: none`), failed / denied = error with the reason, unknown / still pending = amber unknown. A refused device stops the step. A sensitive step and a restore that contains sensitive actions run only from their own confirmation (focus on cancel). `restored` is set only when every device confirmed; an unknown restore is not re-sent by closing. |
| SCR-16 (medium) | Map: the sensitive-action (unlock) and room-card confirmations focused the danger button first | Cancel first, with `autofocus` (as the tiles panel's unlock dialog). |
| SCR-43 (low) | Shared confirm dialog accepted an auto-repeated Enter | An Enter with `repeat` never answers. New option `focusCancel` (default off = unchanged) for physical confirmations. |

Survey of the other physical actions in the screens (no change needed): stations door release and call controls
(`wiskey-stations-actions.ts`: confirm + hold on unknown, two-tap calls), emergency doors (hold + server prepare/start), open-for-N-hours
(two steps), door-tech hold / program (`wk-door-tech.ts` confirm object), WisKey validation pulse and installer pulse (typed phrase +
witness), alarm arm / disarm / bypass, tiles-panel unlock, cover arm-then-confirm, bulk device dialog.

Not in this row (listed for the final review): SCR-10 (an offline lock counted as an open door - a state display in the home module),
SCR-13 (commands stamped from an unsynchronised device clock), SCR-23 (step-up dialog replay, step-up is off by default), SCR-22 / SCR-49 /
SCR-53 (one-click non-physical writes).

Permissions, audit and API are unchanged (frontend only; no backend file touched). Setting: none added - a confirmation before a physical
action and an honest result line are safety rules, not preferences (see question 1).

## Files

- `frontend/src/api/physical-outcome.ts` (new) - refused vs unknown for physical commands without a structured outcome.
- `frontend/src/components/confirm-dialog.ts` - `focusCancel`, auto-repeat Enter ignored.
- `frontend/src/components/incoming-call-logic.ts` - `frontCall`, `frontSettled`, `FRONT_SETTLE_MS`, `doorFailure`, `DOOR_HOLD_FALLBACK_MS`.
- `frontend/src/components/sw-incoming-call.ts`, `frontend/src/home/sw-home-call.ts` - front call by id, settle, per-door sending / held.
- `frontend/src/screens/system-setup.ts` - pulse confirmation, recorder guard, honest physical result line.
- `frontend/src/screens/automation-device-test-logic.ts` (new), `frontend/src/screens/automation-ext-dialogs.ts` - device test outcomes and confirmations.
- `frontend/src/screens/explore-floor-map.ts` - cancel first + autofocus in the two confirmations.
- i18n (Hebrew + English): `i18n/incoming-calls.ts` + en pack, en packs `msg/system-b.ts`, `msg/automation.ts`.
- Tests: `tests/unit-physical-confirm-2540.spec.ts`, `tests/evidence-physical-confirm-2540.spec.ts`, `tests/pixel-physical-confirm-2540.spec.ts`
  (+ baselines), `tests/pixel-incoming-call.spec.ts` (+ the `call-door-unknown` baselines).

Files of other 2.5x rows touched: none of the WisKey R1-R7 / bridge rows; `explore-floor-map.ts` and `system-setup.ts` are shared screens
(small, local hunks).

## Tests

All on mocked backends; nothing physical was actuated anywhere. PC = the workstation (one unit file only); runner = the Linux test
server through `~/work/slotb.sh` (jobs `p2520_physconfirm_run.sh` at `8ef4eb6d3`, `p2520_physconfirm_pix2.sh` at `f1a7a051a`).

| Check | Command (in `frontend/`) | Exit | Result |
|---|---|---|---|
| Unit (PC) | `npx playwright test -c playwright.unit.config.ts tests/unit-physical-confirm-2540.spec.ts` | 0 | 13 passed |
| Build (runner) | `npm run build` (tsc + vite) | 0 | - |
| Typecheck tests + scripts (runner) | `npm run typecheck` | 0 | 0 TS errors |
| ESLint (runner) | `npx eslint src <the 4 changed spec files> --pass-on-unpruned-suppressions` | 0 | 0 errors (4 warnings: spec files outside the lint scope, "file ignored") |
| Design ratchet (runner) | `python scripts/design_ratchet.py` | 0 | no count above the baseline |
| Unit group (runner) | `unit-physical-confirm-2540`, `unit-incoming-calls`, `unit-fe-safety-fix-2520`, `unit-kavarnit-ext`, `unit-no-native-dialogs`, `unit-modal-stack-guard-2442`, `unit-wiskey-stations`, `unit-i18n-lang-packs-2443` | 0 | 101 passed |
| English ratchet (runner) | `unit-i18n-en-ratchet-2490.spec.ts` | 0 | 6 passed (every new key has its English) |
| New evidence (runner) | `evidence-physical-confirm-2540.spec.ts --project=desktop --project=mobile` | 0 | 10 passed (banner unknown / refused / no swap; NVR pulse confirm, Enter on cancel sends nothing, one pulse to the confirmed recorder, unknown amber, refusal red; device test unknown / error / sensitive confirm) |
| Regression evidence (runner) | `evidence-incoming-call`, `evidence-confirm-dialog-2438`, `evidence-multi-nvr` (desktop + mobile) | 0 | 38 passed, 4 skipped (the specs' own skips) |
| Home call regression (runner) | `home-simple-2420.spec.ts` (desktop + mobile) | 0 | 22 passed, 22 skipped (the spec's own project skips) |
| Pixel baselines (runner) | `pixel-physical-confirm-2540.spec.ts` + `pixel-incoming-call.spec.ts -g "unknown door outcome"` with `--update-snapshots` | 0 | 12 + 2 new Linux baselines |
| Pixel compare (runner) | both pixel files, desktop + mobile, `--repeat-each=2` | 0 | 28 passed (the existing incoming-call baselines unchanged). The first compare run had one 50 px diff on the output row (focus ring returning from the dialog); fixed in the spec (`f1a7a051a`, the row is photographed at rest), baselines regenerated. |
| Before / after shots (runner) | uncommitted shots spec on the base build and on the branch build | 0 / 0 | 12 + 12 passed, 32 pictures -> `private/planning/physical-confirm-2540_compare_2026-11-25.html` |

NOT_RUN: the full release gate; the map confirmation dialogs in a browser (no mocked map with a sensitive entity exists - covered by the
source guard in the unit spec only); the automation device test inside the real automation editor (the e2e mounts the element alone,
unstyled); backend tests (no backend file changed); anything on the lab.

## Open questions

1. Should the new confirmations be a setting (off = the old one-click pulse)?
   a. No - a physical action always confirms (recommended, built). b. A setting, default on.
2. The settle time after the front call changes by itself is 800 ms. a. Keep 800 ms (recommended). b. 1.5 s. c. A setting.
3. NVR pulse confirmation: plain confirm (built) or a typed word like the restart? a. Plain confirm naming the output (recommended). b. Typed word.
