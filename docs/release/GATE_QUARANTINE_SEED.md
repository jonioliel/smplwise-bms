# Seed quarantine register (GATEEFF2-295)

Written 2026-10-21 from the release reports 2.9.0 .. 2.10.0 (`private/planning/RELEASE_290..293_REPORT_HE_EN.md`,
`RELEASE_2100_REPORT_DRAFT.md`), `docs/release/GATE_SPEED.md`, `docs/changes/GATE-TEST-HYGIENE.md` and the repo history. No gate report JSON of
the runner was available to this task (gate 1, 2.10.1, was still running; `RELEASE_2101_REPORT_DRAFT.md` does not exist yet), so every
evidence line below is a line of a written report, not a test id read from a machine report. Where a test id is unknown it says so.

## Result in one paragraph

**No test qualifies for the live quarantine today, and `scripts/gate/gate_quarantine.json` stays `"entries": []`.** The managed quarantine
(`GATE_SPEED.md` 7.3) is for a test that STILL FAILS after its retry alone, for a reason that is stale or environmental, with a named owner and
a ticket. Every red of the last five gates was either fixed by a test-only commit that is already in the tree (so quarantining it would
excuse nothing), or passed alone (the FLAKY lane already handles it and counts it), or was a real defect (which must never be
quarantined). Pre-filling the file would also be harmful: an entry that matches no failure is only a "remove it?" line, an expired or
malformed entry turns the gate red, and an entry the branch adds is printed as a branch-added excuse.

The register below is what to do instead. Use `python3 ~/gate_policy.py propose <gate_*.json> --owner N --ticket T --reason R` on the
FIRST gate that has a test failing alone for a stale/environmental reason; that prints valid draft entries from the machine report.

## A. Quarantine now

None.

## B. Fixed already: do NOT quarantine (stale tests met an intended change; test-only fix is in the tree)

| Test(s) | Gate | Evidence line | Fix |
|---|---|---|---|
| nn1-p2 x15, public-ui5 x2, frigate-ui:438 x3, shell x2 (44 px corner keys), multi-nvr x1, uxrest-295 x1, security tab "ממשק ציבורי" x8 (alarm, security-r1, nvr-cameras), vendor-accounts x1, layout-electricity-meters x1 | 2.10.0 (`fef91ec0c`) | `RELEASE_2100_REPORT_DRAFT.md`: "stale tests meeting intended 2.10.0 changes (test-only fixes `1542e765b`, `5c3547f92`, `26251b334`)" | those commits; targeted verification GREEN on `fd400a40a` |
| backend x2: passkeys-only lease hook, Frigate last-zone delete | 2.10.0 | same report, same triage | same commits |
| pixel x104 (settings label, heading style, 44 px targets, contrast) | 2.10.0 | same report: "intended UX changes; baselines regenerated after review (`02375da6a`, `fd400a40a`)" | baselines regenerated; this is the PIXEL_REVIEW lane's job, not the quarantine's |
| `evidence-tabs-styles.spec.ts:226` (8 style selects, now 12) on 3 sizes | 2.9.3 | `RELEASE_293_REPORT_HE_EN.md`: "RED only from one stale test", fixed `9b14e158b` | targeted run 161 / 0 on `df2dfe75c` |
| 2 backend reds from two branches meeting | 2.9.2 | `RELEASE_292_REPORT_HE_EN.md`: "Both reds come from two branches meeting" | fixed; 37 files, 883 passed |
| 7 reds from one feature (6 UI/evidence, 1 stale backend table `test_tickets_model [system]`) | 2.9.1 | `RELEASE_291_REPORT_HE_EN.md` | `de52217b7`, `cadc3a44f`, `2d04cfe53` |
| display-settings test and the monthly-report cap test (machine date vs installation day) | 2.9.0 | `RELEASE_290_REPORT_HE_EN.md` | `ca56b9d5b`; the date class guarded by `test_gate_hygiene` since 2.9.1 |
| `visual-matrix.spec.ts`: 28 constant pixel failures in every nightly 10-15 .. 10-20 | nightly | `GATE_SPEED.md` 5.2a: baselines re-accepted after review on integ/293 (`e04019b61`), "No real regression was found" | baselines refreshed; the first nightly after the 2.9.3 merge must show 0 (NOT verified: the 2.9.3 nightly ended FAIL for a reason nobody has read, `RELEASE_2100_REPORT_DRAFT.md` For the lead item 4) |
| `unit-tabs-config.spec.ts:124/125` [desktop, tablet], flaky in 2.9.0, 2.9.1, 2.9.2, 2.9.3 | 2.9.0-2.9.3 | `RELEASE_290..293`, `GATE_SPEED.md` 2 | root-caused and fixed in `53c4e4e7e` and `c4429e3e0` (both in this branch's history); not in the 2.10.0 flaky list |

## C. Recurrent FLAKY: not a quarantine, a fix-ticket queue

These pass alone, so the gate already reports them as FLAKY and the flaky counter (`(xN)` in the summary) tracks them. By the rule in
`GATE_SPEED.md` ("a FLAKY in two consecutive gates is a defect") they need a root-cause ticket. Quarantining a test that passes alone would
only move it out of sight. Node ids are NOT known here (the machine reports were not available): get them from the gate's `.json`.

| Test | Gates flaky | Evidence line | Likely class | Action |
|---|---|---|---|---|
| backend `test_messaging_accounts_api` / `test_messaging_accounts_runtime`, 5 tests | 2.9.2, 2.9.3, 2.10.0 | `RELEASE_292` ("5 tests in ..."), `RELEASE_293` ("messaging accounts (5)"), `RELEASE_2100` ("messaging accounts x5 (the known temperature-order case)") | ordering/shared state between tests; the "temperature-order" wording is the lead's, the mechanism is not documented | root-cause ticket; reproduce with `pytest --sw-repeat 20` (method in `TEST_POLICY.md`) |
| preview `evidence-wiskey-people-native.spec.ts:182` | 2.9.3, 2.10.0 | `RELEASE_293` ("timeout"), `RELEASE_2100` | timeout under load | ticket; check one-shot reads |
| preview `evidence-tickets-device.spec.ts:185` | 2.9.3, 2.10.0 | `RELEASE_293`, `RELEASE_2100` ("tickets-device") | not stated | ticket |
| backend `test_lat1_toggle_latency` (file has 4 tests; which one flaked is not recorded) | 2.9.2, 2.9.3 | `RELEASE_292`: "a timing bound. Another agent (PERMOVR-293) ran its own pytest on the runner during the gate"; `RELEASE_293` repeats it | environmental: wall-clock bound under shared load | do not loosen the bound; keep the runner exclusive during a gate; ticket only if it recurs on an idle runner |
| pixel `evidence-design-foundation.spec.ts:74` [mobile] | 2.9.2 | `RELEASE_292` | late render before a 0-pixel comparison (`pixel-settle.ts` fix is documented as NOT VERIFIED on the runner, `TEST_POLICY.md`) | verify the settle fix on the runner |
| preview `unit-devices-tiles.spec.ts:116` [mobile] | 2.2.0 era | `TEST_POLICY.md`: "NOT ROOT-CAUSED ... not quarantined; keep it visible" | unknown | keep visible |
| one-off flakies of 2.10.0 (compare-dropdown, uxfix-rtl x3, tickets-ui4, dropdown-capsule) | 2.10.0 only | `RELEASE_2100` | none established | watch; the counter will show a second occurrence |
| capture lease (1), devices bulk concurrency (1) | 2.9.3 only | `RELEASE_293` | concurrency/timing under shared load | watch |

## D. Real defects found by a gate: must NEVER be quarantined

| Defect | Where found | Evidence |
|---|---|---|
| "labels off" did not hide the phone bar labels (UXFIX-NAV) | 2.10.0 prep | `RELEASE_2100`: fixed `216c26977` |
| dd chips ran under the widened phone corner (UXFIX-A11Y) | 2.10.0 prep | `RELEASE_2100`: reserve 84 -> 112 px, `c4dde254a` |
| notification table severity keys ran under the recipient select (desktop) | visual matrix, 2.10.0 prep | `RELEASE_2100`: `9fa8fb3f4`, new test red on the old CSS |
| phone-only settings dropdown broke the 0.1.157 rule "no phone-only gate" and drew a 32 px chip (tabs-mode-apply x2, layout-access-s12 x2, layout-bubble-lists x1) | 2.10.0 gate | `RELEASE_2100`: reverted, owner decision pending. Those 5 tests are RIGHT; they stay red-capable |
| schedule editor race (stale server preview merged into the new draft's validation) | 2.4.6 flaky analysis | `TEST_POLICY.md`: a REAL PRODUCT RACE, fixed with a regression test |
| `TEMPCTL-291`: `next_window_start` adds a local minute difference to a UTC base on the DST night | GATE-TEST-HYGIENE | `GATE-TEST-HYGIENE.md` section 5 (suspected product bug, not fixed, on the DST change of 2026-10-25) |
| `test_permovr_293` 403 vs 404 for a malformed record of a person the writer cannot see | 2.9.3 prep | `RELEASE_293_RESUME.md`: open item for the security review |
| Rule for the PIXEL_REVIEW lane | any | a screenshot diff is a person's decision (`--resolve-review --accept|--reject`), never a quarantine entry |

## E. Dead entry in the runner's `known_issues.json`

The runner's `~/known_issues.json` (a copy is in `private/runner/known_issues.json`) holds one entry:
`evidence-pwa-push.spec.ts:91`, added 2026-10-02, reason "intermittent timeout (a new release: update notice / service-worker swap);
known, not a regression", no expiry. On the current tree line 91 of that spec is the `test.describe('PWA shell (CR-008 P3)', ...)` line, not a
test, so the entry can no longer match a failing test; the underlying flakiness was fixed by `939b0f5c2` and `24c2378c4` (merged `a7e77c434`).
Recommendation: after the install, remove the entry from `~/known_issues.json` (a KNOWN entry has no expiry; the managed quarantine does).
This is a runner file and was NOT touched.

## F. Rules for adding an entry later (all enforced by the engine)

1. The test failed in a gate AND failed again alone, and a person read the failure and found the cause outside the product (a stale
   expectation of a test whose fix is not in the diff, or an environment fault). The reason line says which, with the evidence.
2. A defect in the product is never a reason. If in doubt it is a defect.
3. Fields: id, kind, selector (backend `nodeid`; Playwright `file` + `line` or `title_contains`, optional `project`), reason, owner, added,
   expires (at most 14 days), ticket (URL or task id such as `GATEEFF2-295`). A whole spec file is never quarantined.
4. Every entry is a reviewed commit; the report prints entries a branch added compared with `origin/main`. Renew on purpose or fix the test.
5. The 14-day clock from 2026-10-21 ends 2026-11-04; a calendar check belongs in the weekly review of `GATE_V2_ROLLOUT.md` section 8.
