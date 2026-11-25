# ACCEPT-SWEEP-2411 - acceptance of merged REVIEW cards against v2.48.0

Registry only; branch `chore/MGMT-OWNER-ANSWERS-2211`; no product code changed. Method as LAB-ACCEPT-2311: DONE needs a merged commit
AND a PASS acceptance test in `management/test_catalog.json`. Tests ran on the runner (slot B, nice 19, never `-u`, no lab) in the worktree
`~/work/acc2411` at `origin/main` d6f09395e (= v2.48.0): `scripts/design_ratchet.py` (rc 0, no count above the baseline), backend in
chunks of up to 25 / 6 files (one pytest process each), Playwright `--workers=2` (1 where the gate classifier says so), `--retries=0`.
Receipt: `docs/changes/receipts/ACCEPT-SWEEP-2411.json` (per card: tests, result, evidence). A card's test commit stays the card's merged head.

## Scope 3 (other REVIEW rows blocked only by a dependency)
None. Every REVIEW row with a non-DONE dependency depends on a card that is itself REVIEW for another reason (class D/E, owner hold,
NOT_RUN tests): T006/T008/T009/T017/T076/T084 chains, WXD5B, WXH4, WXN5, POLISH4-WP2-LIVEINV-2370. No card depends on the eleven cards of
scopes 1-2, so nothing else becomes closable.

## Incident
The runner ran out of memory around 04:00 UTC and was rebooted at 05:54; the first Playwright pass lost its tail (37 failures, mostly mobile
timeouts under load average > 200). Run 4 re-runs every spec file that had a failure plus the groups that never completed.

## Result
See the receipt for the final status of each card. Cards still `PENDING` in the receipt had tests not yet (re-)run when this note was written.

## Owner answers 24.11 (questions_2026-11-24 Q7-Q9), applied on the same branch
Receipt: `docs/changes/receipts/ACCEPT-SWEEP-2411-OWNER.json`.

- **Q7 = a:** the owner approves T008 (architecture documents) and T006 (the go2rtc restart step, done in the lab drill). AT012, AT015 and
  AT016 are recorded PASS by owner approval; T006 and T008 are DONE. The Arx side has no restart log of its own: that acceptance rests on the
  owner statement (22.11 Q35-Q37 and 24.11 Q7), the create / consume / delete run of LAB-ACCEPT-2311 phase 2 is the only machine record.
- **Q8 = a:** "owner acceptance on evidence" is a valid test type for documentation / process / design cards. It is defined the way the other
  types are: the `kind` field of the acceptance test in `management/test_catalog.json` is set to `owner acceptance on evidence` (the catalog
  has no separate list of kinds; the validator does not restrict the field). Applied to the not-yet-PASS tests of the 65 remaining class E
  cards (66 minus T008) whose evidence files exist in `origin/main` or `private/`; the evidence line names the files and any referenced path
  that was not found. A card still needs every dependency DONE before it flips.
- **Cascade:** after T006 / T008 and the E acceptances, every REVIEW card with all tests PASS and all dependencies DONE flipped to DONE
  (owner-held T103, T118, WXH4, PUSH-GOLIVE-KIT-2380, TEST-DEBT-2412 excluded; Q81/Q82). Where a shared acceptance test fixed the commit,
  the card's commit field took the test's commit (noted in the card evidence).
- **Not closed, evidence missing** (no existing evidence file beyond the triage note): T009, T019, T056, T079, WXN11 (WXN11 flipped only through
  the cascade: its test AT317 was already PASS; its open item S14 live verification against the real WisKey stays an owner step).
  E cards that have evidence but stay REVIEW only wait for a dependency (the T009/T017/T019/T023/T024 chains) or a NOT_RUN class A/D test
  (T009 AT018, T019 AT037, T056 AT111-112, T079 AT157).
- **Q9:** the 27 device / owner requests (class D) are untouched.
