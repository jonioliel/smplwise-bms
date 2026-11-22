# CR-BE-FOLLOWUPS-2470 - five small backend follow-ups (site edit, LAT1 timing lane, IFC reader reason, IFC export 422, golive test outside git)

Branch `pilot/CR-BE-FOLLOWUPS-2470`, based on `origin/pilot/CR-IFC-SPLIT-2460` (85b816176) with `origin/release/2450-train`
(521165ad4) merged in. Target 2.47.0. Backend only. Each item is its own commit with a test that fails before it; the one corpus
change (item 3) is its own commit.

## 1. `PATCH /sites/{site_id}` trims like create and refuses an unknown time zone (`fix(catalog)`)

Create trimmed `name` / `address`; the edit stored them as sent and took any `timezone` string. `_site_patch_fields` (routers/catalog.py)
now trims both, refuses a name that is only blanks (`422 validation`, details `name`) and a zone `zoneinfo` does not know (`422
validation` "אזור זמן לא מוכר.", details `timezone`; the same check as the installation's `time.zone` setting). The checks run after
the permission check. A refused edit changes nothing and writes no audit row; the accepted edit audits as before (`site.update`,
details = the stored fields, now trimmed). Test: `tests/test_catalog.py::test_site_edit_trims_like_create_and_refuses_an_unknown_time_zone`.

## 2. LAT1 held-lock test: the wall-clock ceiling moves to the timing lane (`test(ha)`)

`test_the_command_is_recorded_before_it_leaves_and_waits_for_a_short_write_lock` asserted both the SEC246 L3 ordering and a ceiling
("the call leaves within 400 ms of the lock being free", scaled by `sw_time_factor`); the ceiling failed under load on old and new code.
Marking the whole test `timing_lane` would also have taken the record-before-send security check out of the blocking gate, so the test
is split (the pattern GATE_LANES.md already uses for the door slot test):

- blocking, unchanged name: the record is durable before the call reaches the fake HA, the call does not leave before the lock is free,
  202 pending, the `attempt` audit row - no wall-clock ceiling;
- `@pytest.mark.timing_lane` `test_the_recorded_command_leaves_promptly_once_the_write_lock_is_free`: the 400 ms ceiling.

Shared setup in `_dispatch_under_held_write_lock`. `docs/testing/GATE_LANES.md` lists the new lane test.

## 3. IFC reader: a skipped wall keeps its own reason for its openings (`fix(plan)` + `test(plan)` corpus)

CR-IFC-SPLIT-2460 Q1 (a). `_walls` read a storey-skipped wall's reason from the last LISTED skip row, so once `MAX_SKIPPED_ROWS` rows
were listed (or with the cap at 0: the fallback `other_storey`) the wall's openings were counted under another element's reason.
`_StoreyScope.skipped` returns the reason it skipped with (`ok` delegates to it; rooms and objects unchanged) and `_walls` keeps it.
Test: `tests/test_plan_ifc.py::test_a_full_skipped_list_does_not_change_the_reason_an_opening_of_a_skipped_wall_gets` (a capped read
counts the same reasons as the uncapped read).

Corpus `tests/fixtures/plan_ifc_read_char_2460.json`, re-recorded in its own commit: exactly 4 of 549 cases changed, all with
`MAX_SKIPPED_ROWS` patched (0 / 1 / 3). Totals, counts and listed rows are unchanged; only `skipped_by_reason` (and the hashes) moved:

| Case | Cap | Before | After |
|---|---|---|---|
| 474 | 0 | no_storey 1, other_storey 13 | no_storey 2, other_storey 12 |
| 475 | 1 | no_storey 1, other_storey 15 | no_storey 2, other_storey 14 |
| 476 | 3 | no_storey 1, other_storey 15 | no_storey 2, other_storey 14 |
| 480 | 3 | no_geometry 14, other_storey 16 | no_geometry 5, other_storey 25 |

Each new `skipped_by_reason` equals the answer for the same file read without the cap (checked for all four).

## 4. IFC export of a wrongly typed stored document is a clean 422 (`fix(plan)`)

CR-IFC-SPLIT-2460 Q2. `plan_ifc.build` raises `TypeError` / `ValueError` on a wrongly typed collection or id. The export route
(routers/plan_ifc.py) now catches both around `build` and answers `422 geometry_structure` with the standard envelope
(`details.error` = the exception class name; message: the stored structure is not valid, open it in the editor and save it again).
Nothing is exported and no export audit row is written (like the other export refusals). `build` itself is unchanged, so the
`plan_ifc.build` characterisation corpus is untouched. Test: `tests/test_plan_ifc.py::test_export_of_a_wrongly_typed_stored_document_is_a_clean_422`
(`"walls": 7`, a list as a wall's `level_id`, an object as an opening's `wall_id`, planted directly in the published row, since the
save path validates the document; all three gave 500 / TypeError before).

## 5. `test_push_golive_check.py` outside a git checkout (`test(push)`)

In a plain copy of the tree (no `.git`) three tests failed. `IN_GIT` (git `rev-parse --show-toplevel` equals ROOT) gates them:
`test_git_ignored_inside_outside_the_repository` and the new `test_the_folders_the_owner_session_writes_into_are_ignored_by_git` (the
git half of the former `test_secret_shaped_file_patterns_and_git_ignore`) skip with a reason; the pattern half
(`test_secret_shaped_file_patterns`) always runs; outside a checkout the dry-run test expects `15 passed` and the tracked-files check
listed as `NOT_RUN` (the script already reports it that way) and keeps its no-token checks.

## Tests actually run (workstation, Python 3.12, the main checkout's `.venv`, `pytest -p no:xdist -p no:cacheprovider`)

- Each new test FAILED before its fix (item 1: trim; item 3: `skipped_by_reason` differed; item 4: 3 x TypeError 500; item 5: plain
  copy 3 failed / 12 passed).
- `test_lat1_toggle_latency.py -m "not timing_lane"`: 4 passed, 2 deselected. Alone.
- `test_lat1_toggle_latency.py -m timing_lane`: 2 FAILED (both wall-clock bounds, the old idle-path test and the new one: "the call
  waited 3779 ms", f=1.60) - the workstation was loaded by other agents; this is the lane's reason to exist. NOT_RUN on a quiet runner.
- `test_plan_ifc.py` + `test_plan_ifc_read_char_2460.py` after the corpus re-record: 571 passed (the 3 then-failing cases were the item 4
  test before its fix); `test_plan_ifc.py` after item 4: 24 passed.
- `test_catalog.py`, `test_site_location.py`, `test_catalog_images.py`, `test_multibuilding_home_2330.py`, `test_plan_catalog_api.py`,
  `test_plan_ifc_build_char_2450.py`, `test_push_golive_check.py`: 211 passed.
- `test_push_golive_check.py` in a plain copy (git archive, no .git): 14 passed, 2 skipped.
- ruff (rule set F) on the touched files and on `smplwise/`: clean.
- NOT_RUN: the full backend suite, `scripts/gate/selftest_gate.py` (POSIX / runner), anything on the runner (gates running).

## Open questions (recommendation first)

- Q1. Create (`POST /sites`) still accepts any time-zone string (the item asked for the edit only). a) apply the same zoneinfo check
  to create in a follow-up (recommended; one line, same helper); b) leave it.
- Q2. Item 2 was done as a split, not by marking the whole test `timing_lane`, to keep the SEC246 L3 record-before-send check
  blocking. a) keep the split (recommended); b) mark the whole test.
