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

## UX measurements (T074, server side, numbers only)

Implemented by T074 on 2026-11-06 (branch `chore/T074-VISUAL-METRICS-2405`, `docs/changes/T074-VISUAL-METRICS-2405.md`; in the release that merges it):

- The add-on measures, on its own sockets: live socket open -> first media byte (MSE, `ttff_ms`) or -> go2rtc's WebRTC answer
  (`answer_ms`); playback start request -> first media byte of generation 0 (`first_media_ms`, the time to recording); seek request
  -> first media byte of the new generation (`seek_media_ms`). They are in the `video.live.stop` / `video.playback.stop` audit rows
  and in the log lines `live session ... (transport T, first media N ms, answer N ms)` / `playback session ... gN socket closed: ...
  (B bytes, first media N ms)`.
- `scripts/gate/video_timing.py report` turns a log file, audit API exports or a read-only database copy into p50 / p90 / p95 / max per
  metric, no-media ratios and go2rtc error classes, checked against `scripts/gate/video_timing_thresholds.json` (PROVISIONAL limits,
  report only until calibrated). The nightly appends the section when input sits in `~/smplwise-results/video_timing/`.
- Nothing new is collected: the rows and lines existed; the output carries no session, camera, user, stream, URL, address or error text.
- Not measured: the browser's first DECODED frame (WebRTC media never crosses the add-on), per-user numbers, UI error counters.

## Open

- CI job for the fixture suites (GitHub Actions on `main`), with the PNG diff posted as an artifact.
- A state matrix per screen (loading / empty / error / forbidden / stale / partial) for screens beyond the floor map.
- Perceptual diff thresholds instead of byte comparison once CI exists.

## Visual-diff matrix (M074) - usage
1. Matrix: `frontend/tests/visual/matrix.json` (screens x states x light/dark x desktop/tablet/mobile); baselines are per OS in `frontend/tests/visual-matrix.spec.ts-snapshots/` (`-linux` is the reference, generated on the runner).
2. Local: `cd frontend && npm run build && npm run visual -- run --touched` (or `--screens a,b`, `--all`); `plan` prints the selection only. Artifacts: `frontend/visual-out/<time>/{summary.md,index.html,images/}` (expected | actual | diff).
3. Runner: `python private/runner/run_smart.py visual <branch> --touched` (or `~/run_remote.sh visual <branch> ...` on the runner); it holds `~/.smplwise-tests.lock` shared, and copies the report to `private-evidence/visual-out/<branch>-<sha>/` (gitignored).
4. Release gate (ON by default, BLOCKING since T074, every tier; `docs/changes/T074-VISUAL-METRICS-2405.md`): the gate runs `visual.mjs run --touched` against `origin/main` (`--visual-base <ref>` changes the reference; a changed baseline image touches its own screen, a change of the spec or the driver touches all) after the build. A case that differs is re-captured ONCE alone: matching then = FLAKY (listed, not a failure), differing again = FAIL (category `visual`; quarantinable in `gate2_quarantine.json` with a ticket and at most 7 days, match = `screen / state / scheme / project`). No linux baseline = SKIPPED (never a pass, a summary warning). The step unable to run (no preview, no results) = FAIL `visual-run`, never quarantined. The entry check runs the same step (a UI branch fixes or re-takes its baselines before boarding); the nightly compares every screen. Rollback: `--visual` / `GATE_VISUAL=warn` (the old warning-only step), `--no-visual` / `GATE_VISUAL=off` (off). Report: the "visual" section (first run, retry, flaky, failed, no baseline) and `.logs/visual/` + `.logs/visual-retry/` (`summary.md`, `index.html`: expected | actual | diff). Evidence of the 2.3.0 warning-only runs: `docs/release/VISUAL_REGRESSION.md`.
5. Intended change: `node scripts/visual.mjs accept --screens <ids>` on the runner (linux baselines only), review the images, commit them with the code.
6. Per screen in matrix.json: `threshold` / `maxDiffPixelRatio` override the tolerance; `mask: ["css selector", ...]` paints animated or live regions (top-level `mask` applies to all). Changing a mask requires re-accepting that screen's baselines.
7. Exit code 1 = differences; a missing baseline is "no baseline" (never a pass). `npm run visual:test` covers the driver logic without a browser.
