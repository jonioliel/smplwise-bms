# FRIGATE-F2B-2405 - the F2b operator screens: reconciled, walked in every skin, one fold defect fixed

Branch `pilot/FRIGATE-F2B-2405`, cut from `origin/main` @ `eab715e53` (2.40.4). Board card T116 (CR-029 / NN5). No migration, no
route, no setting, no version bump. Nothing was sent to a real Frigate, NVR or Home Assistant; every test runs against the mocked
backend (`frontend/tests/frigate-mocks.ts`) or the in-process fake Frigate.

## 1. What the task asked, and what the repository already had

The task: build the F2b operator screens (recorder profile, exports, cases, manual events) on the server routes that exist since
2.3.0, plus a PTZ pad if the server supports it, because T116 said "there is no operator screen for the F2b calls yet".

Checked before building (git log, CR-029, the components): **the screens exist and are shipped.** FRGD (CR-029 section 12, commit
`935a6b411`, 2026-10-08, released in 2.4.0, first tag containing it `v2.7.2`) built Settings > the Frigate recorder as one tabbed card -
write classes, profiles (alarm mapping + the automatic profile), exports, cases, manual events, the change log with undo, supervision
(first supervised writes, the supervised clip read) - and the review drawer's "ייצוא הקטע". FRIGATE-295 phase 3 (`95c037b40`, 2.10.0)
added "move an export into a case"; FRGS (section 13) the zones / settings tab. The T116 evidence line was simply never updated after
FRGD. Rebuilding the screens would have duplicated shipped work, so this branch does not.

**PTZ:** the server does not support it for use. `services/frigate_control_svc.py` has `PTZ_RELEASED = False` (owner answer
2026-10-06, form round 10 q10: no PTZ now, prepare for later); `POST .../ptz` answers 409 `frigate_ptz_disabled` and the policy
reports the class `available: false`. The plumbing is tested server-side; a pad would be a control that can only fail. No pad was
built; the new contract spec (section 3) turns red the day the flag flips, so the pad cannot be forgotten.

## 2. What this branch adds

| What | Where |
| --- | --- |
| Gap closed: the management card's F2b tabs in **every selectable skin** (classic, domus, tesla, crystal, infra, soft), light and dark, desktop 1440 / tablet 1024 / phone 390. The FRGD spec guarded the review screen per skin, but the card only in classic light and one dark pass, and its per-skin shots were bubble (frozen since 2026-10-26). | `frontend/tests/evidence-frigate-f2b-skins-2405.spec.ts` |
| Per state: no page error, no sideways page overflow, the layout guard (escape / overflow / clipped) over the card or the dialog, no platform name; classes list exports and cases and never PTZ; the export create dialog carries the supervision box and waits for it; the typed-name delete waits for the exact name (protected action); the review drawer's export dialog is supervised and nothing is written by looking. Foundation skins (infra, soft) record findings as annotations instead of failing (SKINFOUND-297); there were none. | same |
| Pixel baselines where none guarded the card: the exports tab and the automatic-profile tab, element shots, classic + domus, desktop 1440 + phone 390 (8 linux PNGs, taken on the runner); tesla / crystal run the structural smoke. | `frontend/tests/pixel-frigate-f2b-2405.spec.ts` + `-snapshots/` |
| Drift guard: every route of `routers/frigate_f2b.py` (16), `routers/frigate_control.py` and the three `clip.mp4` reads has a caller in `src/api/frigate-control.ts`, and every client call has a server route. Two documented exceptions: PTZ (must stay uncalled while `PTZ_RELEASED` is False, must be called once it is True) and `GET .../profile-suggestion` (an F2 read helper; the profiles tab reads the whole mapping and the automatic profile its live suggestions). | `frontend/tests/unit-frigate-f2b-contract-2405.spec.ts` |
| **Fix** (the one defect the walk found): the card is narrower than its 640 px fold on every screen size, so the exports and cases tables always show folded rows - and the fold hid the state column (an export Frigate is still writing) and the origin column (a Frigate-made row, which is why it has no rename / delete). Both come back as a tag on the sub line, drawn only while folded: "בתהליך" as a warn chip, "Frigate ·" before the camera / description. The wide table is unchanged. Regression asserted in every skin / scheme / project. | `frigate-admin-shared.ts`, `frigate-exports-panel.ts`, `frigate-cases-panel.ts` |
| Evidence shots (runner, SW_SHOTS=1): classic every state, every skin the exports tab, light and dark, three projects (84 PNGs). | `docs/design/evidence/frigate-f2b-2405/` |

Design review (impeccable, emil-design-eng loaded; detector on the three changed components: no findings): the tag reuses the card's
own chip and muted text, no new token, no motion; RTL order is state, origin, camera, date; video and stills are untouched.

## 3. Receipts

| Run | Where | Result |
| --- | --- | --- |
| `npx playwright test -c playwright.unit.config.ts tests/unit-frigate-f2b-contract-2405.spec.ts tests/unit-frigate-control.spec.ts tests/unit-frigate.spec.ts tests/unit-frigate-config.spec.ts` | workstation (node only) | 41 passed |
| `npx tsc --noEmit -p .` (frontend) | workstation | exit 0 |
| `run_smart.py spec ... evidence-frigate-f2b-skins-2405 evidence-frigate-ui evidence-frigate-control` @ `c7eec4eb4` (before the fix) | runner | 115 passed, 2 skipped (the FRGD spec's own tablet skips) |
| same three specs, SW_SHOTS=1, @ `1a640cae1` (with the fix + regression) | runner | 115 passed, 2 skipped, 0 flaky; 0 foundation-skin findings |
| `run_smart.py spec ... pixel-frigate-f2b-2405 --project=desktop --project=mobile --workers=1 -u` @ `1a640cae1` | runner | 16 passed, 8 baselines written |
| same, `--grep pixel-stable`, compare against the committed baselines @ `6f9b1fcab` | runner | 8 passed |
| `run_smart.py backend ... tests/test_frigate_f2b.py tests/test_frigate_control.py` | runner | 55 passed (no server change; regression only) |
| `npx tsc --noEmit -p .` after the fix (`1a640cae1`) | workstation | exit 0 |
| `scripts/project_status.py --write` then `scripts/release_check.py` | workstation | planning registry PASS (451 tasks); RESULT: ready for the owner's approval |

## 4. NOT_RUN / not proven

- Nothing against a real Frigate: the first supervised write of each F2b kind on the owner's Frigate (runbook
  `docs/operations/FRIGATE_SUPERVISED_VERIFICATION_HE.md`) is still to do; AT230 / AT240 / AT241 stay NOT_RUN.
- No lab contact, no Home Assistant, no device.
- The full Playwright suite, the release gate and the visual matrix were not run on this branch (only the specs above).
- A PTZ pad: not built (server flag off, owner decision).
- Touch-target size and floating findings are filtered out of this walk exactly as in the FRGD guard (the touch / a11y specs own them).

## 5. Rollback

Revert the fix commit `1a640cae1` (three components) to drop the folded tags; the spec commits only add tests, baselines and shots.
