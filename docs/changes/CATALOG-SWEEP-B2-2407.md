# CATALOG-SWEEP-B2-2407 - catalog sweep B, second half (classification of the 168 TODO rows)

Branch `chore/CATALOG-SWEEP-B2-2407` from `release/2406-train`. Receipt: `docs/changes/receipts/CATALOG-SWEEP-B2-2407.json`
(same shape as sweep A: id, class, tests, evidence, note; it carries all 176 slice-B rows, the 8 already classified by
`CATALOG-SWEEP-B-2406` unchanged). `management/test_catalog.json` is NOT edited; the lead applies COVERED.

## Method
- Input: the 168 TODO rows of `CATALOG-SWEEP-B-2406.json` (candidate test files with nightly counts from the nightly on
  main @ eab715e53, tier L, PASS), plus the catalog entry and its task card (acceptance, status, hardware flag).
- Six read-only workers on fixed chunks of 28 with one brief: read the candidate tests, search for better ones, and classify.
  COVERED = named tests assert the expected behaviour on fakes AND passed in that nightly (pass>0, fail=0). PARTLY = part
  asserted, part not. LAB = decisive proof needs real hardware/HA/NVR/go2rtc or a human check. MISSING = nothing asserts it.
- Nightly counts were filled from the per-file index for tests outside the candidate lists. Rule applied by the merge:
  a COVERED row with no named test that passed in the nightly is downgraded to PARTLY (2: AT-PROVISION-BACKCHANNEL-2320-1, AT-LOBBY-STYLES-2290-1).
- Judgement was by reading test titles and assertions; a few rows were judged more from titles than from every assertion
  (CALMSG, WKWATER, LOOK, EVENTS-POLISH as COVERED; MEDIA-POLISH, TKSET-POLISH, HOMEEDIT-POLISH as PARTLY). No test or lab run was done.
- Several PARTLY rows rest on phone-project/evidence specs that are skipped in the nightly, or on a spec with failures in it
  (e.g. layout-skin-qa-2403 had 4 failures, pixel-access-s12 had 3).

## Counts (168 rows classified here)
| Class | Count |
|---|---|
| COVERED | 96 |
| PARTLY | 62 |
| LAB | 3 |
| MISSING | 7 |
| TODO | 0 |

Whole slice B (176) with the earlier 8: COVERED 99, PARTLY 66, LAB 3, MISSING 8.

## LAB list
- AT041: Backend half passes (normalized x/y, FOV, 409), but drag, numeric placement, delete, undo/redo UI is proven only by evidence-editor*.spec.ts, skipped without SW_LIVE. Lab step: run evidence-editor and evidence-editor-move with SW_LIVE=1 on the dev backend; drag, undo/redo, change zoom, reload.
- AT-REAL-TV-SESSION-2380-1: Real-TV runbook session (TV page, lobby styles, overscan, remote keys, CSS zoom, saver, day/night) needs a physical TV; task is BLOCKED/requires hardware. Lab step: joint session on a lab TV walking the runbook checklist and fixing findings.
- AT-CAST-FIRST-TEST-2380-1: First physical cast of one camera to a lab TV plus the phase-2 decision memo needs real cameras and a TV; task BLOCKED/requires hardware. Lab step: run CAST_FIRST_PHYSICAL_TEST_RUNBOOK.md jointly on one camera and one lab TV, then write the memo.

## MISSING list
- AT119: No AI provider path exists: only local deterministic stylize; no consent, prompt version/schema lock or budget. Needs feature work first (L), then tests.
- AT120: No AI normalizer, so text-as-data, unknown/uncertain output and raw-response handling cannot be tested; only the local stylize with explicit render_mode switch exists. Feature plus tests, L.
- AT122: No stored prompt/model/schema hashes, corrections or approver for an AI plan, and no reject flow; test_progress_matcher is noise. Needs the AI path first; then API test, M.
- AT-SHARED-POLISH-2342-1: Shared kit pieces (tech disclosure, centred empty, failure tone, focusable rows) have no dedicated passing test; candidates are unrelated. Effort M: one unit/evidence spec per shared component.
- AT-DEVICES-POLISH-2331-1: Only evidence-devices and devpolish shoot cover it and both are skipped in nightly (0 pass); no passing test for grouped panel, cover tilt or automations skeleton. Effort M.
- AT-SCHED-POLISH-2331-1: Only a shoot harness (shoot-sched-polish-2331) exists; no passing test asserts stacked rows, tidy slot panel or create-dialog actions on screen. Effort M.
- AT-INSIGHTS-POLISH-2331-1: evidence-insights-polish-2331 has no assertions and is skipped without SW_SHOTS_DIR; no test for counters, segment track, door rows or touch targets. Effort M.
