# PIXEL-RETAKE-2407 - pixel check of the 2.40.7 UI build before the gate: nothing moved, nothing re-taken

Branch `release/2407-train`, on top of `b08ac01ac` (the 2.40.7 UI rebuild: camera reboot, bridge key emergency revoke, recorded-days
month, WisKey visits, NVR reboot behind the writes switch). This record only: no baseline, product source, spec, version or changelog
change, no tag. No lab, Home Assistant, NVR, go2rtc, WisKey or station contact: the pixel specs run against `vite preview` of the built
UI with no backend (demo mode), as in the gate.

## 1. Why

The 2.40.6 gate lost a run to 36 stale pixel baselines (PIXEL-RETAKE-2406). This check runs the pixel set alone on the 2.40.7 build
first, so that any baseline the 2.40.7 UI changes moved intentionally is re-taken before the 2.5 h gate, not after it.

## 2. Method (no release gate)

As in PIXEL-RETAKE-2406. On the runner, with no gate running (`gate_status.json` = pass / done, `pgrep -f release_gate` empty) and
`~/.gate-pending` set for the duration, in a fresh worktree `~/work/pixfix-2407` (detached at `b08ac01ac`): `npm ci`, `npx vite build`,
`vite preview` on a free port with `SW_API_PORT` on a dead port, then one Playwright process over **all 32** top-level spec files that
call `toHaveScreenshot(` (the gate's pixel classification, `visual-matrix.spec.ts` left to the visual step), `--project=desktop
--project=mobile --workers=1 -g pixel-stable --grep-invert @timing-lane`. That is a superset of the last gate's pixel step, which ran
"mapped pixel specs only: 24 of 33". The tests lock (`~/.smplwise-tests.lock`) was held shared while Playwright ran.

The gate's M074 visual step was run too, the gate's way: `node scripts/visual.mjs run --touched --base origin/main` on the same preview.

| Run | Mode | Result |
|---|---|---|
| 1 | plain compare against the committed baselines | **273 passed, 0 failed, 0 flaky, 59 skipped** (332 tests, 11.7 min) |
| visual | `visual.mjs run --touched` (11 screens, 24 cases per viewport) | **pass 72, differs 0, error 0, no baseline 0** (75 Playwright tests passed) |
| 2 | plain compare again (stability) | **273 passed, 0 failed, 0 flaky, 59 skipped** (332 tests, 11.7 min), same set as run 1 |

The 59 skips are the specs' own per-project skips (single-project cases: bus times, notice TV, wall plan and wall follow-ups desktop
only; walk-touch, skin-QA follow-up and others split by project); none is a missing baseline.

## 3. Why nothing moved

None of the pixel specs or visual-matrix screens shows the 2.40.7 surfaces: the camera screen's reboot button and panel, the bridge key
revoke panel, the recorded-days month, the WisKey visits panel and the NVR system card are covered by unit specs only
(`unit-camera-reboot-2407`, `unit-bridge-key`, `unit-recorded-month`, `unit-wiskey-visits`). The 2.40.6 re-take (PIXEL-RETAKE-2406)
came in with the merge of `release/2406-train` and still matches.

## 4. Re-taken

None (0 images). No diff was seen, so no change was judged or rejected.

## 5. Receipts and NOT_RUN

- Runner worktree `~/work/pixfix-2407` (detached at `b08ac01ac`, clean after the runs); logs `~/work/pixfix-2407-out/pw_{1,2}.log`,
  JSON reports `pw_{1,2}.json`, visual artifacts `visual_1/` and `visual_1.log`.
- NOT_RUN: the tablet project of the pixel specs (the gate's pixel step runs desktop + mobile only); a release gate (the 2.40.7 gate
  runs everything). No pixel baseline exists for the new 2.40.7 surfaces, so this check cannot see them.
