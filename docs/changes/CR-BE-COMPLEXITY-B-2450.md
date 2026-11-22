# CR-BE-COMPLEXITY-B-2450 - six more complexity extractions; the singleton inventory sees module-level tables

Branch `pilot/CR-BE-COMPLEXITY-B-2450`, based on `origin/pilot/CR-BE-COMPLEXITY-2450` (e5b7ab627), which is based on
`origin/release/2440-train`. Target 2.45.0. Backend only (services and tests). Method as in docs/changes/CR-BE-COMPLEXITY-2450.md: per
function, a characterisation test recorded from the unchanged code in its own commit, then the split in the next commit; code moved
verbatim, check order unchanged.

## 1. Measurement (radon CC over `smplwise_vms/backend/smplwise/services`)

`radon cc -s -n C` on the base: 2171 functions of grade C or worse. The top of the list, with what this row did:

| CC | Function | This row |
|---|---|---|
| 265 | `plan_ifc_read.read` | open: its `skip` / `storey_ok` closures share a `nonlocal` counter with every section; a verbatim split needs a skip ledger object first |
| 146 | `plan_ifc.build` | **split** |
| 124 | `plan_dxf_map.map_geometry` | open (input is a parsed DXF document; needs a DXF corpus) |
| 122 | `temperature_runtime.evaluate` | open (database pass with side effects: needs a database-snapshot characterisation) |
| 114 | `temperature_explain.explain` | **split** |
| 108 | `calendar/events.update` | not touched: a booking permission / approval order sits in it (excluded family) |
| 108 | `automation_model.validate_draft` | **split** |
| 100 | `plan_detect_hollow.find_hollow` | open (numpy masks) |
| 95 | `shared_spaces.plan_edits`, `media_commands.run` | not touched: write permission callbacks / principal checks in the order |
| 94 | `wiskey_profiles.normalize_draft` | **split** |
| 94 | `media_commands.plan_audio` | open (store objects as input) |
| 91 | `schedule_policy.check_arguments` | **split** |
| 61 | `automation_blueprints.validate_definition` | **split** (a pure validator with a clean section structure; the remaining 60-90 band is mostly database / device / principal-bound) |

Excluded on purpose (brief): `approve`, `sign_in`, any auth / session / RBAC check order, `intercom_sync.py`, `wiskey_background_feed.py`,
`wiskey_feed_session.py`, routers, `*_store.py`, electricity / water / tariff / billing / meter, and the three the base branch did.

## 2. The six splits

| Function | Before | After | Largest helper | Characterisation (cases) |
|---|---|---|---|---|
| `services/temperature_explain.explain` | 114 | 11 | `_compressor_factor` 17 | `test_temperature_explain_char_2450.py` (288) |
| `services/automation_model.validate_draft` | 108 | 10 | `_check_action_block` 24 | `test_automation_validate_draft_char_2450.py` (719) |
| `services/wiskey_profiles.normalize_draft` | 94 | 14 | `_draft_fields` 38 | `test_wiskey_profiles_char_2450.py` (514) |
| `services/plan_ifc.build` | 146 | 4 | `_ifc_objects` 34 | `test_plan_ifc_build_char_2450.py` (150) |
| `services/schedule_policy.check_arguments` | 91 | 15 | `_check_number_arg` 27 | `test_schedule_policy_char_2450.py` (1549) |
| `services/automation_blueprints.validate_definition` | 61 | 4 | `_parameter_problems` 20 | `test_automation_blueprints_char_2450.py` (378) |

- **explain**: one helper per signal (maintenance, defrost, door, outage, compressor, unit mode / setpoint, gap, spike, neighbours, gradual
  rise) and `_verdict`; the side conditions (high excursion only, door visible, power sensor) stay in the caller, the call order is the
  factor order (the gradual-rise check reads the factors found before it).
- **validate_draft**: `_check_scene`, `_check_header` (name, description, the caps), `_check_trigger_ids`, per walked block
  `_check_trigger_block` / `_check_condition_block` / `_check_action_block`, `_check_script_fields`. The nested `trigger_id` moved to module
  level unchanged; the per-block `need()` closure stays in the loop.
- **normalize_draft**: the shape checks and the `bad()` closure (first 50 problems) stay; `_draft_fields`, `_draft_field_links`,
  `_draft_groups`, `_draft_group_ids`.
- **plan_ifc.build**: `_ifc_head`, `_ifc_storeys`, `_ifc_walls`, `_ifc_openings`, `_ifc_rooms`, `_ifc_objects`, `_ifc_connectors`,
  `_ifc_anchors`, `_ifc_relations`, called in the order the entities were always written (the IFC entity numbers follow it).
- **check_arguments**: one helper per argument kind (`_check_number_arg`, `_check_enum_arg`, `_check_str_arg`, `_check_vars_arg`) and one per
  check after the loop (`_check_entity_fit`, `_check_required_and_exclusive`, `_check_cover_position`). The one textual change: a `continue`
  that ended the loop iteration inside a kind branch is a `return` in its helper (nothing followed the branch in the loop body).
- **validate_definition**: `_header_problems`, `_parameter_problems` (returns the parameters by key), `_rule_problems`, then the template
  shape check (an early return) stays in the caller, then `_template_ref_problems` and `_template_step_problems`.

Verbatim check: a script compared every helper body (docstring left out) with the old function body, whitespace-stripped: each helper is
one contiguous run of the old lines; the only added lines are the helpers' `return <value>` and the calls in the caller.

The corpora (format and replay: new `tests/support/char_corpus.py`; recorder plugin for existing tests: new `tests/support/char_record.py`):

- explain: the 28 distinct calls of `test_tempexplain_093` / `test_be_twins_2440` + 260 seeded synthetic excursions; all 14 factor keys and
  all four confidences occur.
- validate_draft: the 185 distinct calls of 19 automation test files + up to three context variants of each (notify targets, Shabbat
  sensor, allowed actions, presence entity, wall buttons, presence sensors); 43 issue codes; the whole issue list in order, or the exception.
- normalize_draft: the 14 calls of `test_wiskey_profiles` + 500 seeded drafts (valid ones built from scratch, mutations of a base draft);
  13 problem codes, the 50-problem cap; the normalised draft or the `DraftError` with every problem in order.
- plan_ifc.build: 150 seeded exports of the five contract sample plans with mutations; the answer is the sha256 + length of the IFC text
  (byte-identical) and the counts, or the exception (5 cases raise `AttributeError` on malformed items today - recorded as is).
- check_arguments: the 149 distinct calls of six schedule test files + 1400 seeded calls over every service; all six problem codes.
- validate_definition: the 8 built-in blueprints + up to 60 seeded mutations of each + non-object definitions; every problem family
  (16 cases raise `TypeError` on malformed input today - recorded as is).

## 3. The singleton inventory sees module-level tables (base branch open question 2, answer a)

`tests/test_singletons_registered.py` now also counts a module-level dict / list / set / deque (defaultdict, OrderedDict and Counter are
dicts) when a function of its own module CHANGES it at run time (AST: `X[k] = ...`, `X[k] += ...`, `del X[k]`, `X |= ...`, a mutator call
such as `X.add / append / update / pop / clear / setdefault`, or `global X`). A table nobody changes after import is a constant and is not
counted (about 1,165 of the 1,439 module-level tables). New self-test `test_module_level_tables_changed_at_run_time_are_seen`.

- The allow-list of constant tables is the new `tests/singletons_constant_tables.txt` (17 names, each with its reason): registries filled
  while the package imports or wires itself up (`recorders.registry.VENDORS`, `notify_channels.CHANNELS`, `calendar_sync.registry._FACTORIES`,
  the reset registry itself, ...). A listed name the walk no longer counts, or that registers a reset, fails the test.
- 42 service modules register a per-test reset for their tables now, each with the reset function the module already had (no new reset
  logic): `access_external`, `announce_translate`, `app_download`, `automation_ops`, `bulk_people`, `camera_image_health`,
  `camera_sources` (+ `_HEALTH`), `compliance_export`, `device_activity` (+ its tables), `door_emergency`, `door_window_triggers`,
  `elevators_runtime`, `generator_alerts`, `generator_runtime`, `home_interface`, `ma_direct`, `media_query`, `media_queue`, `mobile_push`,
  `notify_email`, `notify_sources`, `notify_whatsapp`, `plan_door_tool`, `presence`, `presence_people`, `process_stats`, `push`,
  `recorder_health`, `recorders.frigate`, `recorders.frigate_http`, `recorders.frigate_io`, `recorders.provision_isr`,
  `recorders.provision_playback`, `schedule_ops`, `self_update`, `setup_wizard`, `temperature_runtime`, `tickets.public_portal`,
  `trusted_door`, `wiskey_event_resume`, `wiskey_pairing`, `wiskey_people_csv`. 103 names in all; four of them were already listed as
  class singletons and leave `singletons_unregistered.txt` (`announce_translate.CACHE`, `notify_email.GATE`, `presence.TOKEN_FAILURES`,
  `presence.TOKEN_FAILURES_ALL`, which those resets already put back).
- 154 tables are recorded in `tests/singletons_unregistered.txt`, grouped by why: routers (13, another agent's files today), the SQLite
  lock / pool bookkeeping in `db` (13, process-wide by design), auth / session / identity / RBAC (14, excluded), billing / electricity /
  water (10, excluded), files other agents change today (8: `events_ingest`, `exports`, `ha_sync`, `intercom_sync`, `media_store`), start-up
  wiring (7), and modules with no reset function yet (89, the next step of this seam).

## Tests actually run (workstation, Python 3.12, the main checkout's `.venv`, `pytest -p no:xdist -p no:cacheprovider`)

The workstation was at 100 % CPU all afternoon (several agents running pytest). The runner had the 2.44.0 train gate until 15:34 UTC;
after `gate_status.json` showed it done (`pass`), the reset run moved to the runner.

| Run | Files | Result |
|---|---|---|
| explain, before the split | `test_temperature_explain_char_2450.py` | **289 passed** |
| explain, after | + `test_tempexplain_093.py` | **305 passed** |
| validate_draft, before | `test_automation_validate_draft_char_2450.py` | **720 passed** |
| validate_draft, after | + `test_automation_model`, `test_kav079_model`, `test_automations_draft`, `test_building_presence_2271` | **791 passed** |
| normalize_draft, before | `test_wiskey_profiles_char_2450.py` | **515 passed** |
| normalize_draft, after | + `test_wiskey_profiles.py` | **550 passed** |
| plan_ifc.build, before | `test_plan_ifc_build_char_2450.py` | **151 passed** |
| plan_ifc.build, after | + `test_plan_ifc.py` | **170 passed** |
| check_arguments, before | `test_schedule_policy_char_2450.py` | **1550 passed** |
| check_arguments, after | + `test_schedules_model`, `test_schedules_more_actions`, `test_bridge_schedule_policy` | **1818 passed** |
| validate_definition, before | `test_automation_blueprints_char_2450.py` | **379 passed** |
| validate_definition, after | + `test_automation_blueprints_80.py` | **424 passed** |
| corpus recording runs (unchanged code) | 19 automation files; `test_wiskey_profiles`; six schedule files; `test_tempexplain_093` + `test_be_twins_2440` | 277, 35, 147 and 41 passed |
| singleton inventory | `test_singletons_registered.py` (4 tests incl. the new self-test) | **4 passed** |
| the registered resets, PC | 85 test files named after the 42 modules (1512 tests) | stopped at 39 % with **0 failures** when the runner became free (moved there) |
| the registered resets + every file above, runner (`nice -n 19`, own folder `~/work/becomplexb` from `git archive` of 7a9a4312d, the runner venv; removed after) | 102 files: the 85 reset files + the 17 split / characterisation files | **0 product failures**: files 1-48 **2361 passed** (that process ended from outside in `test_mobile_push.py` with no summary, no failure printed); `test_mobile_push.py` alone **52 passed, 1 failed** (the export lacked `services/push-relay`; with it the test **passed**); the other 53 files in three shards **2390 passed, 3 failed** / **485 passed** / **773 passed** - the 3 are `test_push_golive_check.py` needing a git checkout (`git check-ignore`); on the PC worktree that file is **15 passed** |
| ruff (`select = ["F"]`) | every file this branch adds or edits | **All checks passed** |

Not run: the full backend suite and the runner entry check (not queued: the train gates own the runner today); no UI change, no baselines.

## Open questions (recommendation first)

- Q1. `plan_ifc_read.read` (CC 265): a) a follow-up row that first moves its skip bookkeeping (`skip`, `storey_ok`, the `nonlocal`
  counter) into a small ledger object, then splits it the same way (recommended); b) leave it.
- Q2. The 89 tables recorded as "no reset function yet": a) give each module a reset in a later row, a few modules at a time with their
  own tests (recommended); b) keep them listed.
- Q3. The 5 `plan_ifc.build` corpus cases where malformed plan items raise `AttributeError` (a non-object entry in a collection the code
  reads with `.get`): a) a small follow-up that skips such entries, with the corpus case updated on purpose (recommended); b) leave (the
  editor never stores such entries).
