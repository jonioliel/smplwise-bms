# CR-IFC-SPLIT-2460 - plan_ifc_read.read split behind a recorded corpus; plan_ifc.build and the blueprint validator stop crashing on malformed input

Branch `pilot/CR-IFC-SPLIT-2460`, based on `origin/pilot/CR-BE-COMPLEXITY-B-2450` (febb78d37). Target 2.46.0. Backend only (two
services, one service's tests, fixtures). Method as in docs/changes/CR-BE-COMPLEXITY-2450.md and CR-BE-COMPLEXITY-B-2450.md: a
characterisation corpus recorded from the unchanged code in its own commit, then the refactor; behaviour changes only in their own
commits, with the corpus cases they change updated on purpose in a separate commit. Answers the open questions Q1 and Q3 of
CR-BE-COMPLEXITY-B-2450 (both "a").

## 1. `services/plan_ifc_read.read` (radon CC 265 -> 8)

Commits, in order:

1. `test(plan)` - `tests/test_plan_ifc_read_char_2460.py` + `tests/fixtures/plan_ifc_read_char_2460.json` (850 KB), recorded from the
   unchanged reader. 549 calls:
   - all 38 calls `tests/test_plan_ifc.py` makes (captured with a recording plugin: hostile files, the patched limits of the hostile-file
     test, the deadline test, the routes);
   - 65 reads of 36 exports of the `plan_ifc.build` corpus (the contract sample plans with mutations) with varied frame sizes, scales,
     target levels / elevations, storey index (also out of range), run ids and catalogs (the built-in one, empty, two hand-made ones:
     a catalog item whose `ifc` or `size` is not an object, no generic item);
   - 240 seeded synthetic foreign files: IFC4 / IFC2X3 / IFC4X1 / IFC4X3, metre / milli / centi / foot / no / area-only length units,
     0-3 storeys (also without an elevation), containment by IfcRelContainedInSpatialStructure, by IfcRelAggregates or none, every
     representation the reader knows or refuses (Axis + Body, rectangle / arbitrary / indexed polycurve / arc / circle profiles, faceted
     brep, triangulated face set, mapped item with or without an operator, boolean clipping, CSG, tilted or negative extrusion, FootPrint,
     a degenerate brep, far points, missing shapes), placement cycles / grid placements / absurd numbers, material layers (usage, set,
     plain material, none), Pset_WallCommon, our own Pset_SMPLWISE values (valid and not), voids on walls / other hosts / missing hosts,
     door / window / unsupported fillings with operation types, spaces, objects of 13 classes and connectors (our own objects or not,
     anchors), ignored classes;
   - 127 seeded text mutations of exports, of the tests' foreign file and of synthetic files (an instance dropped or duplicated under a
     new id, numbers and references broken, classes swapped, property values changed, the schema changed);
   - 79 targeted cases: more skipped elements than the report lists with `MAX_SKIPPED_ROWS` 0 / 1 / 3 / 200, the per-collection `LIMITS`
     patched, `MAX_CHAIN` patched, past and future deadlines (also on a file with nothing to map), the `Bulges` value of our own walls
     (not JSON, wrong length, too large, not numbers, booleans).

   The answer is the sha256 of the whole result as JSON (key order included; the report's wall-clock `ms` set to 0), a hash per part
   (walls, openings, objects, rooms, detector, report) and a readable summary (counts, skipped total / listed / by reason, warnings, the
   chosen storey), or the exception the unchanged code raised (7 IfcError codes occur). A line trace of the recording run showed every
   statement of the unchanged `read` (and of its `skip`, `storey_ok`, `to_plan` closures) executed. The recording is deterministic
   (byte-identical fixture across two runs with different `PYTHONHASHSEED`). The generator scripts were a development step and are not
   committed (as in the previous rows); the fixture holds the inputs themselves, so the replay needs nothing else.

2. `refactor(plan)` - the skip bookkeeping becomes `_SkipLedger` (the listed rows, the total, the count per reason; the `nonlocal`
   counter is gone) and the storey check `_StoreyScope.ok`. Same calls in the same order.

3. `refactor(plan)` - `read` calls, in the order the sections always ran (the instances are parsed, the skips listed and the first error
   raised in the same order): `_model` (the raw-byte refusals and the scan), `_chosen_storey`, `_containment`, `_layer_thickness`,
   `_walls` (+ `_wall_pieces`, `_wall_kind`, `_wall_bulges`), `_openings` (+ `_opening`, `_opening_centre`, `_nearest_host`,
   `_opening_fields`), `_rooms`, `_objects` (+ `_object`), `_report_the_rest`, `_alignment`, `_plan_frame` (the `to_plan` closure),
   `_out_walls`, `_out_openings`, `_out_objects`, `_out_rooms`. Largest helper `_walls` 33, then `_opening_fields` 30, `_object` 26,
   `_opening` 25; everything else 17 or less.

   Verbatim check (a script over the old and new bodies, whitespace-stripped): every line of every helper is a line of the old `read`
   except the helpers' calls and returns; every old line is in the new code except section comments (now docstrings), seven `continue`
   that ended one element's turn in a loop (now `return None` in the per-element helpers `_opening` / `_object`, or still `continue` in
   the loops that stayed) and the two `append`s that became the per-element helpers' `return {...}`. One check moved: a wall with no
   usable piece is skipped after both branches of `_wall_pieces` (it was inside the no-Axis branch; the Axis branch always has a piece).

## 2. `services/plan_ifc.build` skips entries that are not objects (CR-BE-COMPLEXITY-B-2450 Q3 a)

The five corpus cases that raised `AttributeError` were all one thing: the document's `dimensions` was not an object (`"2.1"`, `15`),
read with `.get` by `plan_geometry.effective_scale` (through `_Frame`) and by the project header. A fuzz of `build` (every key and
collection entry of three sample plans replaced by non-object values) found the same `AttributeError` for a non-object `calibration`,
a non-object entry in the `anchors` list, and (by reading) a non-object catalog entry. Each now counts as absent:

- `_dimensions(doc)`: `dimensions` that is not an object is `{}` - the scale falls back to the estimate, `ScaleStatus` is `missing`.
  `_Frame` passes `{"dimensions": _dimensions(doc)}` to `effective_scale` (which reads nothing else of the document), so the shared
  `plan_geometry` is unchanged.
- a non-object `calibration` gives `ScaleStatus` `missing`;
- a non-object anchor is not written; a non-object catalog entry gives the object the default class.

For every well-formed input the file is byte-identical (the other 145 build corpus cases replay unchanged; the 549 read cases do not
involve `build`). New test `test_plan_ifc.py::test_export_skips_entries_that_are_not_objects`: each bad entry gives exactly the file of the
document without it (it fails on the base with the `AttributeError`). The five corpus cases (3, 7, 54, 66, 99) were updated in their own
commit; each new answer was checked equal to the file of the same document without `dimensions`.

Not changed (open question Q2): the fuzz also found `TypeError` / `ValueError` when a whole collection is not a list (`"walls": 7`), when a
`level_id` / `wall_id` is a list or object, when `circuits[].member_ids` is not a list, and when a wall `polyline` holds non-numbers.

## 3. `automation_blueprints.validate_definition`: a clean problem instead of `TypeError`

Report asked for: yes, a validation problem is better, and it is trivially safe - `validate_definition` has no product caller (tests
only, kept by owner decision O10 a), the messages are the ones an unknown name already gets, and a valid blueprint gives the same (empty)
answer. The 16 corpus cases raised `TypeError: unhashable type` because a JSON list or object stood where a name belongs and was looked
up in a dict. A fuzz of the eight built-in blueprints (every value replaced by a list / object / `{"$param": {...}}`) found four places;
all now go through `_hashable` / `_declared`:

| Where | Problem now reported |
|---|---|
| a trigger's `trigger` | `triggers.<i>: trigger type not allowed` |
| a condition's `condition` | `conditions.<i>: condition type not allowed` |
| a rule's `a` / `b` | `bad rule` |
| a `{"$param": <list or object>}` reference | `template uses undeclared parameter <value>` (and, as an action, `a parameter may stand for a notify target only`) |

After the change the fuzz finds no exception. The 16 corpus cases were updated in their own commit (each was a recorded `TypeError`;
the other 362 replay unchanged). New test `test_automation_blueprints_80.py::test_a_list_or_object_where_a_name_belongs_is_a_problem_never_a_type_error`
(2 parameter sets).

## Tests actually run (workstation, Python 3.12, the main checkout's `.venv`, `pytest -p no:xdist -p no:cacheprovider`)

The workstation was at 100 % CPU (parallel agents). Ruff is `py -3.12 -m ruff` (0.17.5, the project's `select = ["F"]`).

| Run | Files | Result |
|---|---|---|
| recording run (unchanged code) | `test_plan_ifc.py` with the capture plugin | 38 calls captured |
| read corpus, unchanged code | `test_plan_ifc_read_char_2460.py` | **550 passed** |
| after the ledger | + `test_plan_ifc.py` | **569 passed** |
| after the split | `test_plan_ifc_read_char_2460.py`, `test_plan_ifc.py` | **569 passed** |
| build fix, before the corpus update | `test_plan_ifc_build_char_2450.py` | **146 passed, 5 failed** (exactly cases 3, 7, 54, 66, 99) |
| build unit test | `test_plan_ifc.py -k not_objects` | **1 passed** on the branch; **1 failed** (AttributeError) with the base `plan_ifc.py` |
| validate_definition fix, before the corpus update | `test_automation_blueprints_char_2450.py`, `test_automation_blueprints_80.py` (+ the new test) | the update script found exactly the 16 recorded `TypeError` cases changed; after it **426 passed** |
| blueprint unit test | `test_automation_blueprints_80.py -k never_a_type_error` | **2 passed** on the branch; **2 failed** (TypeError) with the base service |
| final, branch head 878a360f8 | `test_plan_ifc_read_char_2460`, `test_plan_ifc`, `test_plan_ifc_build_char_2450`, `test_automation_blueprints_char_2450`, `test_automation_blueprints_80` | **1147 passed** (550 + 20 + 151 + 379 + 47) |
| ruff | every file this branch adds or edits | **All checks passed**, except 3 older findings in `test_automation_blueprints_80.py` (unused `copy`, two `autos_app` F811), identical on the base and left alone |

Not run: the full backend suite and the runner entry check (no runner job queued by this row); no UI change, no baselines.

## Open questions (recommendation first)

- Q1. A quirk kept as is (behaviour-identical split): when a wall is skipped for its storey after the report's row list is full
  (`MAX_SKIPPED_ROWS` = 200), its openings are reported with the reason of the last LISTED row, not the wall's own reason (`wall_reason`
  reads `skips.rows[-1]`). a) a small follow-up: `_StoreyScope.ok` returns the reason and `_walls` keeps it (recommended; changes
  only files with more than 200 skipped elements); b) leave it.
- Q2. `plan_ifc.build` still raises `TypeError` / `ValueError` on wrongly-typed collections or ids (section 2). a) leave for now: the
  export route builds from the stored working document, which the geometry save path validates, so these shapes do not reach it
  (recommended); b) a later row with one input-shape guard at the top of `build` (the export route has no catch: such an input would
  be a server error there).
