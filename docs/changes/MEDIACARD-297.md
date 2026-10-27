# MEDIACARD-297 - AVPIXEL-295 retargeted to the WisKey station media drawer

Board rows r172 / r424; week plan item t8. Branch `pilot/MEDIACARD-297` on `origin/main` (v2.23.2).

## What the "tested change" was
`pilot/AVPIXEL-295` (one commit, f92baccfe) added `frontend/tests/pixel-multimedia.spec.ts`: pixel baselines of the
multimedia screens / players / groups pages. The owner chose on 2026-10-26 that these baselines belong to the WisKey
media drawer (dark / tablet), not the multimedia screens (handoff READ_FIRST_2026-10-26-night: "retarget to the WisKey
media drawer").

## What changed
- The AVPIXEL-295 branch is merged (history kept) and its multimedia spec is removed.
- `frontend/tests/pixel-wiskey-station-media.spec.ts` (the existing CR-036 S18 spec of the station drawer: live video +
  push-to-talk) gains a second block on the same drawer and the same mocks (`wiskey-stations-mocks.ts`,
  `wiskey-station-media-mocks.ts`, no real intercom): every skin under test in dark on desktop 1440, tablet 1024 and
  phone 390; light on the tablet (light desktop / phone already existed); classic talking in dark on all three.
- 19 new Linux baselines generated on the runner. Existing 16 baselines untouched. No product code changed.

## Runs (runner, Vite dev server, `run_remote.sh spec`, projects desktop + tablet + mobile)
- Before baselines: 29 passed, 13 skipped (the skips are by design: the old block is desktop/phone only, the light-tablet
  case runs on tablet only).
- `--update-snapshots`: 19 files written, 0 existing files changed.
- `--repeat-each=2` against the new baselines: 58 passed, 26 skipped, 0 failed, 0 flaky.

## Targeted gate rerun
`tests/pixel-wiskey-station-media.spec.ts --project=desktop --project=tablet --project=mobile`

## 2.24.1 integration (release/2241): classic + domus pixels only
The policy of GATELANES-297 (`frontend/tests/helpers/pixel-skins.ts`: pixel baselines for classic and domus only) now covers the
second block too: its per-skin cases use `pixelTitle` / `skinCheck`, so tesla and crystal run the same case as the structural
smoke, and the 8 tesla / crystal baselines of this slice are deleted (11 of the 19 remain: classic and domus).
