# The 28 constant pixel failures of the nightly (TESTDEBT3-295)

Written 2026-10-21. Read-only analysis: the nightly reports and logs on the runner were listed and read through the read-only helper;
nothing was run on the runner, no baseline image was regenerated or overwritten, no test was skipped or quarantined.

## Verdict in one paragraph

All 28 are **stale baselines** of `visual-matrix.spec.ts:83` (`vm <screen> <state> <scheme> is pixel-stable`). They are deterministic (the
same 28 cases with the same pixel counts in every nightly and on the retry), so they are not nondeterministic rendering and not an
environment fault. The triage of VISMATRIX-FIX-293 found no real regression (32 intended UI changes, 9 stale dark baselines, 2 wrong-screen
captures), and the baselines were refreshed after review in `e04019b61` (all 28 files are among its 45). What is **not proven** is that
the refresh makes the nightly green: the only nightly after it (21.10, `main` @ `61ddf6a91`, which contains `e04019b61`) was killed
(`signal 15`) at 71 min, inside the pixel group, before it reached `visual-matrix.spec.ts`. So the 21.10 nightly says nothing about the
matrix. The first nightly that runs to the end of the pixel group is the verification.

## Classification

All 28 are `visual-matrix.spec.ts:83`. By size of the difference (pixel counts of the 20.10 nightly, identical on 16.10 / 19.10):

| Class | Count | Cases (pixels different) |
|---|---|---|
| stale baseline, dark palette (the whole background differs, 244k-1.07M px) | 6 | devices-schedules dark (desktop 1,025,574; mobile 253,739); settings-notifications dark (desktop 1,074,181; mobile 244,439); multimedia-screens dark (desktop 891,627; mobile 245,497) |
| stale baseline, wrong screen captured (the picture is another screen than the case name) | 6 | devices-building light/dark on desktop and mobile (same counts as devices-home: 8394 / 8609 desktop, 1452 / 1376 mobile, because the building case captured the home page); settings-diagnostics light/dark on mobile (33,569 / 128,136: "now the health tab"). Fixed in the spec/matrix by the routing change `49e3407bb` / `7ab3be9f0` with the "no two screens share a baseline" guard |
| stale baseline, intended UI change (small, 854-89,837 px) | 16 | devices-home light/dark (desktop 8394 / 8609, mobile 1452 / 1376); devices-home dialog light (desktop 4395); devices-schedules light (desktop 89,837; mobile 4306); map-floor dark (desktop 5186); settings-notifications light (desktop 23,577; mobile 25,815); security-alarm light/dark (desktop 15,700 / 20,464); multimedia-screens light (desktop 6820; mobile 4244); live-wall light/dark (mobile 854 / 919) |
| real regression | 0 | none found by the triage; none visible in the evidence |
| nondeterministic rendering | 0 | identical counts on 16.10, 19.10 and 20.10 and on the retry |
| environment | 0 | the counts never moved between nights |

6 + 6 + 16 = 28. The grouping by size is mine, from the counts; the triage commit (item 5 below) names the same three kinds (32 intended
diffs, 9 stale dark baselines, 2 wrong-screen cases) over the larger set of 72 cases it looked at.

## Evidence lines

Source: `~/smplwise-results/nightly/gate_main_<sha>.logs/pw_pixel.log` (Playwright output with `N pixels (ratio R of all image pixels)
are different`), read on the runner.

1. Nightly 20.10 (`gate_main_6cd558f2`, `main` @ `6cd558f24`, the 2.9.0 head): `pixel 208 passed, 28 failed`; all 28 are
   `visual-matrix.spec.ts:83`; each "failed again alone" (the retry reproduced it).
2. The same 28 file names with the same pixel counts are in the nightlies of 16.10 (`gate_main_bbd9dfd2`), 19.10
   (`gate_main_3d02b3f4`) and 20.10. Examples (desktop): devices-home light 8394, devices-home dark 8609, devices-schedules light 89837,
   devices-schedules dark 1025574, multimedia-screens dark 891627, map-floor dark 5186, security-alarm light 15700 / dark 20464.
   Only four counts moved between 16.10 and 19.10, all on the settings-notifications screen (desktop light 23263 -> 23577, desktop dark
   1074316 -> 1074181, mobile light 25856 -> 25815, mobile dark 244316 -> 244439): a product change to that screen, then stable again.
   Identical counts across three nights and a retry exclude nondeterminism.
3. devices-building has the same counts as devices-home on both schemes and both sizes (8394 / 8609 desktop, 1452 / 1376 mobile): the
   baseline of devices-building was a picture of the home page.
4. Dark ratios 0.69-0.83 (`1025574`, `1074181`, `891627` pixels of about 1.28 M) mean the dark baseline differs on almost every pixel:
   an old dark palette, not a layout change. 9 stale dark baselines is what `e04019b61` records.
5. `git show -s e04019b61`: "Triage 2026-10-20: 32 intended diffs, 9 stale dark baselines, plus devices-building (now the area-tiles
   view) and settings-diagnostics (now the health tab). Taken with visual.mjs accept --all on the runner at 7ab3be9f; a follow-up run of
   all 72 cases passes, as do the three no-duplicate-baseline guards." All 28 file names above are in that commit's 45 PNGs (checked by
   name against `git show --stat`). The same commit is in `61ddf6a91`, `integ/2111` and `release/2101`.
6. Nightly 21.10 (`gate_main_61ddf6a91`): verdict FAIL, but `pixel 23 passed, 0 failed, 1 skipped`; the engine finished with
   `[gate] terminated (time budget): signal 15` at `05:06`, 71 min after the start (the configured budget is 225 min). `pw_pixel.log`
   ends inside `pixel-access-s12.spec.ts` (7 of 12 tests done; the crystal case at `:47` is marked failed, the log ends before its
   retry). `visual-matrix.spec.ts` was never reached. The baseline category reports `pixel 23 vs 188 (12%)`, `backend 0 vs 11717`, `dev 0`,
   `fixture 0` as a consequence. `GATE_SPEED.md` 5.2a already says the verification of the matrix is NOT_RUN.
7. `integ/2111` has later baseline refreshes of the matrix (`fef91ec0c` 35 images, `fd400a40a` 4 images, 2.10.0 intended changes, reviewed).

## What follows

- The 28 do not need a baseline change: they are already refreshed. **Nothing was regenerated here.**
- The 21.10 nightly cannot confirm that. Open question for the lead: why was the engine terminated at 71 min with a 225 min budget
  (an external `SIGTERM`, probably a gate start or a cleanup; the log does not say). Until a nightly runs through the pixel group the
  "first nightly after the 2.9.3 merge shows 0 visual-matrix failures" check stays open.
- Possible new staleness on `integ/2111` since the last refresh (`fd400a40a`): `frontend/src/screens/devices-building.ts` (+181 lines)
  changes the area-tiles view, which is the screen of the 4 devices-building cases (6 with tablet); `system-diagnostics.ts` adds a phone
  select only when the user chose "dropdown" (default unchanged) and an off-box backup card only on the backup tab. If the first
  matrix run on the release head shows devices-building red, the baselines of exactly those cases need regeneration after a reviewed
  look, with `node scripts/visual.mjs accept` on the runner (never an automatic `--update-snapshots`).
- Not a matrix item but seen in the same logs: `pixel-access-s12.spec.ts:47 [desktop] crystal` failed in the 21.10 nightly run before
  the kill (19.10 had `pixel-access-status` `status-domus-list-1440` with 112 px). Not investigated here.
