# ACCEPT-SWEEP-2530 - acceptance of merged and released REVIEW cards on released-gate evidence

Registry only; branch `chore/ACCEPT-SWEEP-2530` from `origin/release/2520-train` (91de5c377). No product code and no test changed;
nothing was run against the lab, a device or Home Assistant. Receipt: `docs/changes/receipts/ACCEPT-SWEEP-2530.json` (per acceptance
test: card, status, gate commit, the test files with their pass / skip counts, and why they cover the acceptance).

## Method

1. Every REVIEW card with a not-PASS acceptance test (109 of 175) was taken; the 36 rows merged into the unreleased 2.52 train were
   left alone (no gate yet).
2. For each remaining card the tests were mapped from the change note(s), the test files that name the card id, and the spec names.
3. Per-test results were read (read-only) from the released gate runs on the runner: the Playwright JSON and the backend junit in
   `~/smplwise-results/gate_release-2490-train_f73c20728.logs/` (v2.49.0, FULL PASS), `gate_release-2500-train_bdf28fc37.logs/`
   (v2.50.0, FULL PASS) and `gate_release-2510-train_{df3ee6d12,d886d7929}.logs/` (v2.51.0: FULL run 1 whose only failure was the
   test-setup fault in `unit-mfa-passkeys-2490.spec.ts:182`, then run 2 `--after` PASS). The 2.48.0 gate runs left no per-test logs, so
   2.48.0 and older cards use the 2.49.0 full gate (its commit contains them).
4. An acceptance test is PASS only when every named test file ran (not skipped by its own gate) and passed in a released gate whose
   commit has the card head as an ancestor (`git merge-base --is-ancestor`), with no real failure (a failure counts only if it is not in
   the gate's "failed once, passed alone" list), and no part of the expected result is left to a lab, device, owner or visual step.
   Partial coverage stays NOT_RUN. A card flips to DONE only when every acceptance test is PASS and every dependency is DONE.

## Result

| | Before | After |
|---|---|---|
| tasks DONE / REVIEW | 485 / 175 | 514 / 146 |
| test catalog PASS / NOT_RUN | 645 / 189 | 675 / 159 |

29 cards REVIEW -> DONE (30 acceptance tests PASS): 2.49.0 gate f73c20728 - CR-FEED-BASE-2450, CR-ROUTER-SQL-2450,
CR-CMP2-SELECTS-2450, FLAKY-CAPTURE-SCREENSHOT-2490, TICKETS-PAGING-2490, DOOR-TECH-HOLD-FIX-2480, HAND-SWITCH-2480,
PHONE-SKIP-DESKTOP-SHOTS-2490, COLOR-LITERAL-A-2480, COLOR-LITERAL-B-2480, I18N-DEFAULT-NAMES-2490, I18N-SETTINGS-KEYWORDS-2490,
I18N-EN-2490, I18N-BACKEND-2490, PY-CONSTRAINTS-2407 (both tests; the second is the gate's add-on image build from the Supervisor
base image with `pip -c constraints.txt`; card commit set to 33360d2a8); 2.50.0 gate bdf28fc37 - T068-EDGE-2450, ADR019-STEP0-2500,
ADR019-L14-OBSERVE-2500, NOTICE-WIRE-DRIFT-2490, REVIEW-2490-FIXES-2500, ADR019-FAMILY2-2500, DOOR-PREVIEW-I18N-2500,
NOTICE-NEWS-EMPTY-2500, NOTICE-NEWS-FEEDS-2500, MULTI-BUILDING-NEXT-2490; 2.51.0 gate df3ee6d12 / d886d7929 - DOOR-BLOCKS-I18N-2510,
DOOR-WINDOW-TERM-2510, ADR019-FAMILY3-2510, RESPONSE-MODELS-E-2500. No cascade: no REVIEW card waited only on one of these.

Two notes on evidence that is not a single spec file: FLAKY-CAPTURE-SCREENSHOT-2490 rests on its guard spec plus zero "Unable to
capture screenshot" lines in the logs of the four gate runs; PHONE-SKIP-DESKTOP-SHOTS-2490 rests on the gate JSON holding no mobile
result for any of the 25 listed files and no tablet result for the 20 tabletAlso files (f73c20728 and df3ee6d12).

## Examined, stays REVIEW (reason in the card evidence and the test notes)

- Runner follow-up (automated, but not covered by a released gate): FLOORSTRIP, DEVICES-POLISH-2331, MEDIA-POLISH-2331,
  EVIDENCE-CAMERAS-2412, CR-MULTIMEDIA-BASE-2440, CR-WISKEY-NOTIF-2443, DIALOG-DRAWER-ONE-2439 (their fixture-backed specs are
  skipped in every gate), GATEAUDIT-297 / GATELANES-297 (gate selftest and the timing lane are not part of a gate),
  HAND-SWITCH-HOME-PERSONAL-2490 / HAND-SWITCH-HOME-EDIT-2500 (only source-check units ran; the devices-fixture behaviour spec and the
  compare captures did not).
- Owner: GEN-UNITS-FIELD-2490 (the acceptance names 4 languages; the change adds unit words in Hebrew and English only - a gap to
  confirm or fix), DOCS-GUIDE-REFRESH-2500 (content review; guide screenshots NOT_RUN).
- Lab / device: ONVIF-DISCOVERY-2412 (discovery on the real network), HOME-INTERFACE-NEXT-2490 (dim layer and long-press drag on a
  real wall tablet), MFA-STEPUP-TRAIN-2490 (slice 12 is on the unreleased 2.52 train; a passkey / device-key sign-in on a real phone).
- Unchanged: the 25 class D cards and the 4 class E cards of LAB-ACCEPT-2311 / ACCEPT-SWEEP-2411, the 66 all-PASS cards that wait on
  those dependency chains or owner holds, and the 36 rows of the 2.52 train.

## Tests run

None. Evidence only, read from the released gate results on the runner (read-only). `python scripts/project_status.py --write`
regenerated the views.

## Rollback

Revert this commit (tasks.json, test_catalog.json, the regenerated views, this note and the receipt).
