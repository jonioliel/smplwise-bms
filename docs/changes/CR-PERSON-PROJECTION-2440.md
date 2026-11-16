# CR-PERSON-PROJECTION-2440

Code-review batch 16.11, wave 3A (backend). Plan row `pilot/CR-PERSON-PROJECTION-2436` in
`private/code-review-2026-11-13/MASTER_PLAN.md`; finding 02:P2-7.
Base: `origin/pilot/CR-WAVE2-COMBINED-2439` (`4e52e5e4a`). Risk in the plan: medium. Output keys of both stay as they are.

## What and why

A WisKey person record has two projections: `intercom_sync.project_person` (the read people view, the base of the
editor) and `intercom_adapter.project_person` (the closed superset every read uses). Each parsed the record on its
own; parity was held by one test, and a field one of them learned to read was silently missing in the other
(`permission_overrides` once, see `tests/test_permovr_293.py`).

1. **One reader of the record's containers.** New `intercom_sync.person_fields(raw)`: the completeness verdict
   (`person_scope`, already shared) plus `assignments`, `group_ids`, `permission_overrides`, `cards`, `profile`,
   each read once and `None` when it is not of its type (absent stays distinguishable from empty). The three
   projections (`project_person`, `project_person_editor`, the adapter's `project_person`) take their containers
   from it instead of re-reading the raw record.
2. **What stays per projection, on purpose.** The value rules differ by contract and are unchanged: the superset
   accepts only valid ids, clips texts, accepts only doors 1 / 2 and known sync states, and answers `null` for a
   withheld field; the read people view shows what WisKey sent and marks it with `access_known` /
   `stations_known`. Unifying those would change output values, which the row forbids. The editor needs no field
   the superset deliberately drops from a shared source: it reads cards and overrides from the raw record through
   the same reader, as before.
3. **The guard the finding asks for.** New `tests/test_person_projection_parity_2440.py`: over 35 fixture records
   (well formed, minimal, every redaction marker, absent and malformed containers) every key either projection
   emits is classified: the same value in both (9 keys), a stated relation (`employee_no`, `group_ids`,
   `access_known`, `stations_known`), or deliberately on one side (`stations` vs `assignments` compared row by row,
   and the superset-only fields). A key added to one projection fails `test_every_key_is_classified` until it is
   given a rule. The editor is held to the pair as well: its keys are the people view's plus seven named ones, and whenever
   the superset knows the override stations they are exactly the stations of the editor's `permission_overrides` (the
   drift of PERMOVR-293). One more test pins the out-of-contract scalars that differ by design (unknown category,
   over-long name, control character), so unifying the value rules later is a decision and not an accident.

No output key or value of either projection changes.

## Files

Changed: `smplwise_vms/backend/smplwise/services/intercom_sync.py` (`person_fields`; `project_person` and
`project_person_editor` use it), `services/intercom_adapter.py` (`project_person` uses it).
New: `smplwise_vms/backend/tests/test_person_projection_parity_2440.py`.

Outside my rows: none.

## Found on resume (16.11 afternoon)

The previous account stopped mid-work: the two service files and this note were uncommitted in the worktree, and the parity
test this note already described did not exist on disk. The half-done service change was read against the row and kept as
it was (it is right); the test file was written from scratch, so its record count (35) differs from the 25 first written
here. `pilot/CR-INTERCOM-SHARED-2440` (`a60551eec`) refactors `services/intercom_listen.py`, `services/intercom_media.py` and
their two routers only; it shares no file with this branch, so the two merge without a conflict.

## Tests actually run

Workstation, Python 3.12 from the repository venv, `pytest -p no:xdist`, after a free-memory check (6.2 GB free).

- **Before / after comparison**: the outputs of the three projections (`intercom_sync.project_person`,
  `project_person_editor`, `intercom_adapter.project_person`) over the 35 fixture records, dumped as sorted JSON once from
  the base tree (`git archive 4e52e5e4a`) and once from this branch: byte-identical (58,023 bytes).
- `tests/test_person_projection_parity_2440.py` (new), `tests/test_wiskeyarx_291.py`, `tests/test_permovr_293.py`,
  `tests/test_intercom_people_s7.py`, `tests/test_intercom_writes_s11.py` (the person editor and its saves),
  `tests/test_wiskey_round3.py`, `tests/test_wiskey_station_people_2390.py`: **350 passed, 0 failed** in one run (8 min 42 s);
  179 of them are the new file.

NOT_RUN: the rest of the backend suite (other callers of the projections: `test_intercom.py`, `test_wiskey_background.py`,
`test_wiskey_final280.py`, `test_wiskey_ops_views_2400.py`, `test_bulkpeople_295.py`), ruff (not installed in the venv), the
entry check, anything against WisKey, Home Assistant or a device.

Pixels to refresh: none (backend only).
