# CATALOG-SWEEP-B-2406 - catalog sweep, slice B (partial, stopped at the usage ceiling)

Branch `chore/CATALOG-SWEEP-B-2406` from `release/2405-train` @ eadc5b080. `management/test_catalog.json` is NOT edited.
Receipts: `docs/changes/receipts/CATALOG-SWEEP-B-2406.json` (list of {id, class, tests, evidence:{sha, report}, note}).

## Slice
Every NOT_RUN entry of kind `unit/integration` (133), `unit/contract/visual` (37) or `unit/contract/security` (6): 176 entries.

## Evidence source
Nightly gate on main @ eab715e53 (verdict PASS, 2026-11-06): runner `~/smplwise-results/nightly/gate_main_eab715e53.md`
and its `.logs/backend_s*.xml` + `pw_*.json`, copied read-only and indexed per test file (41,821 passed, 9,545 skipped,
18 first-try failures that passed on retry / quarantine). No runner job was started (a 2.40.5 gate was running).
No local test was run by this sweep.

## Counts (status at stop)
| Class | Count |
|---|---|
| COVERED | 3 (AT133, AT145, AT146) |
| PARTLY | 4 (ADDON-IMAGE-BUILD-FIXES-2311, COORD-DOCS-2310, DEPFIX-2310, LEGAL-WKMIT-2320) |
| MISSING | 1 (LICENSE-2310) |
| TODO (not classified) | 168 |

The 168 TODO rows carry an automated candidate mapping (change record, task evidence, file name, id mentions) with the
nightly pass/fail/skip count per file. It is a mapping, not a classification: 150 of them have at least one candidate
file that passed in the nightly; 18 have none found yet (AT015, AT016, DEPHARDEN-2310, PROVISION-BACKCHANNEL-2320,
SWITCH-AS-LIGHT-2321, HOME-DEVICES-LOAD-2342, NOTICE-BOARD-FOLLOWUPS-295, LOBBY-STYLES-2290, MOBILE-APP-SERVER-295,
ENTRY-CHECK-2310, TRANSIT-CHECK-2370, APP-TEAM-R11-2380, REAL-TV-SESSION-2380, BOARD-ADMIN-2380, CAST-FIRST-TEST-2380,
WALL-FOLLOWUPS-2380, ROUND4-LEFTOVERS-2380, REGISTRY-UPDATE-2380). Hints found by hand for some of these (not yet in
the JSON): test_provision_backchannel.py, unit-xs-floor-match.spec.ts (SWITCH-AS-LIGHT test), test_perf_home_devices.py,
test_notice_*_295.py / test_bustimes_295.py, test_notice_styles_2300.py + unit-lobbystyles-2300.spec.ts,
test_app_refresh_295.py / test_app_session_295.py / test_critical_sound.py / test_offline_field_295.py,
test_transit_check_wp8.py, test_board_mgmt_2381.py, evidence-wall-followups-2390.spec.ts.

## Findings
- LEGAL-WKMIT-2320: the WisKey embed-api-v1 MIT notice is in `THIRD_PARTY_NOTICES.md` and
  `frontend/src/wiskey/LICENSE-embed-api-v1.txt`, but no file of the add-on (`smplwise_vms/`, including the built
  `www/` JS and source maps) carries it, so "ships with the product" is not met as built.
- Most legacy `evidence-*.spec.ts` specs of the T0xx cards are skipped in the gate (0 passed), so the T0xx cards rest
  on backend tests only.
- DEPFIX-2310: `test_offbox_sftp.py` has no result in the nightly reports.

## Not done (TODO)
- Classify the 168 TODO rows; write the quick tests for MISSING rows (LICENSE-2310 first); run them.
- `scripts/release_check.py`: NOT_RUN (stopped at the usage ceiling).
