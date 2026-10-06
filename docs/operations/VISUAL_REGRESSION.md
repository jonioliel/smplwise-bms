# Visual regression and product feedback loop (T074)

**Status:** the screenshot suites run on every segment locally (0.1.10 … 0.1.28); CI execution is not wired yet.

## What runs today

| Suite | Data | Checks | Output |
|---|---|---|---|
| `frontend/tests/screenshots.spec.ts` | demo fixtures (backend stopped) | shell RTL, every floor-map state, drawers, no horizontal overflow | `docs/evidence/T007/*.png` |
| `frontend/tests/screens.spec.ts` | demo fixtures | one screenshot per screen × viewport (desktop / mobile), overflow rule | `docs/evidence/T007/screens/*.png` |
| `frontend/tests/evidence-*.spec.ts` | the running developer backend + lab NVR / HA (`SW_LIVE=1`, real Chrome) | behaviour of each feature against real devices | `private-evidence/<task>-live/*.png` (gitignored) |

The fixture suites are 129 checks and must pass before every commit (`npx playwright test tests/screenshots.spec.ts tests/screens.spec.ts`
with the dev backend stopped, so the UI takes the demo path). The live specs are evidence, not gates: they depend on
what the lab happens to contain (recordings, events, placed items).

## Approving intentional changes

1. Run the fixture suites; the PNGs under `docs/evidence/T007` are regenerated in place.
2. `git diff --stat docs/evidence/T007` shows which screens changed. Open the changed ones side by side (`git difftool` or the IDE).
3. Unintended change → fix the code and rerun. Intended change → commit the new PNGs in the same commit as the code, and name
   the screens in the commit body (`sc06-plan-editor`, `sc20-storage`, …). A segment that only refreshes evidence uses `git checkout --
   docs/evidence/T007` to drop noise.
4. The design reference (`docs/design/`) is the arbiter; a screenshot that drifts from it is a defect even when the test passes.

## Masking changing content

- Fixture screens contain no live video: `sw-scene` draws synthetic scenes, timestamps are fixed in the fixtures.
- Live evidence screenshots contain video frames and lab names and therefore never enter the repository. When a live
  screenshot is needed in a public document, blur the frame and rename the camera before copying it out of `private-evidence/`.
- If a live screen must be compared automatically in the future, mask `sw-live-player`, `[data-tl-preview]`, `.frame` and the
  clock chips (`page.screenshot({ mask: [...] })`).

## Linking feedback to screen / requirement / commit

Every evidence line in `management/tasks.json` follows `pre-evidence (<date>, <version>): <what> … - private-evidence/<task>-live/*.png`.
Owner feedback is recorded on the task card (or in `docs/changes/`) with: screen id (`sc..`), requirement id (`R..`), the version
the feedback was given on, and the commit that answered it. `python scripts/project_status.py --write` regenerates the boards.

## UX measurements (planned, privacy-first)

- Time to first camera frame (live) and time to first recording frame (playback) measured in the browser from the click to the
  first decoded frame; reported as numbers only, no frames, no camera names beyond the internal id.
- Failure counters per feature (player errors, playback session refusals) in the health report, not per user.
- Nothing is collected by default; an opt-in setting will gate it.

## Open

- CI job for the fixture suites (GitHub Actions on `main`), with the PNG diff posted as an artifact.
- A state matrix per screen (loading / empty / error / forbidden / stale / partial) for screens beyond the floor map.
- Perceptual diff thresholds instead of byte comparison once CI exists.

## Visual-diff matrix (M074) - usage
1. Matrix: `frontend/tests/visual/matrix.json` (screens x states x light/dark x desktop/tablet/mobile); baselines are per OS in `frontend/tests/visual-matrix.spec.ts-snapshots/` (`-linux` is the reference, generated on the runner).
2. Local: `cd frontend && npm run build && npm run visual -- run --touched` (or `--screens a,b`, `--all`); `plan` prints the selection only. Artifacts: `frontend/visual-out/<time>/{summary.md,index.html,images/}` (expected | actual | diff).
3. Runner: `python private/runner/run_smart.py visual <branch> --touched` (or `~/run_remote.sh visual <branch> ...` on the runner); it holds `~/.smplwise-tests.lock` shared, and copies the report to `private-evidence/visual-out/<branch>-<sha>/` (gitignored).
4. Release gate (ON by default, warning-only, every tier): `release_gate.sh <branch>` runs `visual.mjs run --touched` against `origin/main` (`--visual-base <ref>` changes the reference) after the build and adds a "visual" section to the report: counts, one warning line per differing screen/state/scheme/viewport, and the path of `summary.md` / `index.html` (expected | actual | diff) under the gate's `.logs/visual/`. Differences never change the verdict and show as `WARNING (non-blocking)` in the summary line. `--visual-block` (or `GATE_VISUAL=block`) makes every difference a gate failure; `--no-visual` (or `GATE_VISUAL=off`) switches the step off. If no screen is touched the section says so. Evidence of a real run: `docs/release/VISUAL_REGRESSION.md`.
5. Intended change: `node scripts/visual.mjs accept --screens <ids>` on the runner (linux baselines only), review the images, commit them with the code.
6. Per screen in matrix.json: `threshold` / `maxDiffPixelRatio` override the tolerance; `mask: ["css selector", ...]` paints animated or live regions (top-level `mask` applies to all). Changing a mask requires re-accepting that screen's baselines.
7. Exit code 1 = differences; a missing baseline is "no baseline" (never a pass). `npm run visual:test` covers the driver logic without a browser.
