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
