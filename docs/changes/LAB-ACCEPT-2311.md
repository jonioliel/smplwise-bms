# LAB-ACCEPT-2311 - acceptance of every REVIEW card against the lab version (v2.47.0)

Owner request 23.11: plan and run the acceptance tests of all cards still in REVIEW (302 at the start; ACC-SWEEP-2211 had
closed 58 of the 116 owner-accepted ones) in the lab environment. Branch `chore/MGMT-OWNER-ANSWERS-2211`. Registry only; no
product code changed.

## Classes (302 cards)

| Class | Cards | Meaning |
|---|---|---|
| A | 196 | automated tests on the runner (slot B, nice 19, never `-u`) at main `619f94d04` = v2.47.0 (code identical to the gated `7d5476e92`) |
| B | 11 | read-only checks against the lab add-on running v2.47.0 (GET only, Supervisor info, add-on log reads) |
| C | 2 | lab write tests, one action at a time with rollback (phase 2) |
| D | 27 | needs the owner, a real phone / device, a physical action or an HA user change (not allowed to the agent) |
| E | 66 | not testable by a run (documents, process, design acceptance without a deterministic test) |

A card's class is what it still needs to close: one D test makes the card D even if its other tests pass.

## What ran

- Runner (A): 731 test files not covered by ACC-SWEEP-2211 - backend 393 files in 16 chunks (9,244 passed, 11 skipped, 0 failed);
  Playwright unit 146 specs (1,516 passed), preview / dev specs 180 (2,384 passed, the rest skipped by their own gates, 0 failed);
  fixture-backed specs: 3 of 8 completed (shared-space stations, local user create, WisKey credentials - all passed), 5 WisKey
  fixture specs do not complete against the current `wiskey_fake_ha.py` (harness problem, see Findings); the five gate
  self-tests (all OK); plus the ACC-SWEEP-2211 results at the same commit. Receipts: `runner:~/work/acc2311-out/`.
- Lab (B): 18 read-only checks (`private-evidence/lab-1611/acceptance-2311/bcheck_b2.json`, redacted; script `bcheck.py`
  beside it): add-on as built by the Supervisor, health split, stream namespace, foreign go2rtc streams untouched (34), camera
  mapping, capabilities, recording search with coverage, historic frame (and 404 outside any recording), storage and recorder
  health, event ingest, home-system sync, secret leaks, update view, alarm panels, the WisKey MIT notice in the served bundle,
  live video through the relay, discovery / codecs, event facets. 18 / 18 PASS.
- Tracked-tree secret scan at 619f94d04: every real lab secret value 0 files (`secret_scan_619f94d04.md`).
- Train cards: the release-gate reports of 2.43.8 (`4679923b4`) and 2.43.9 (`66527605c`), verdict PASS.

## Result

- 243 acceptance tests recorded PASS (runner or lab), 0 FAIL; 130 stay NOT_RUN with their class in the notes.
- 159 cards REVIEW -> DONE (129 code-review cards and 30 others); 143 stay REVIEW: E 66, A 40 (blocked by a dependency, held by
  the owner, or a fixture spec that did not complete), D 27, B 8 (dependency chain), C 2.
- 77 cards of the T005-T097 chain stay REVIEW because T006 (go2rtc restart part, owner step) and T008 (architecture documents,
  class E) are not closable here.
- AT177 is shared with the DONE card ST7DPR: re-verified at 619f94d04, the record keeps ST7DPR's commit.
- Owner-held cards (22.11 Q81/Q82) were tested where possible but not flipped.

## Findings (no new product bug)

1. go2rtc's own service log holds 23 RTSP source URLs with credentials of the product streams - the owner-accepted risk Q-SEC-2
   (`OWNER-R32-BACKEND-2438.md` section 2). The Arx log and the read APIs hold none.
2. The runner nightly did not complete on 21.11 / 22.11 (disk full) nor 23.11 (tests lock busy 3 h); NIGHTSP cannot be shown.
3. One pytest process over 393 backend files errors from about test 4,500 on and then stops with rc 0 and an empty junit -
   test isolation, not product; split into 16 processes everything passes. The gate shards, so it does not see it.
4. Five WisKey fixture-backed specs (actions, camera, capture, editor, people) do not complete against the current fixture
   (control `/reset` answers no JSON; one actor assertion) - test debt; the gate does not run them either.

## Phase 2 (C) and D

C (playback session + seek + close, go2rtc create / update / delete of `smplwise_acc2311_test`, a 30 s export job) waits for the
lead's 2.48.0 install and probe; script `private-evidence/lab-1611/acceptance-2311/ccheck.py`, one step per run, go2rtc
snapshot before / after. The D asks are on the owner page `private/planning/lab_acceptance_plan_2026-11-23.html`.

## Rollback

Registry only: revert this commit (tasks.json, test_catalog.json, the regenerated views and `receipts/LAB-ACCEPT-2311.json`).
