# COMPLEXITY-3-2480 - complexity extractions behind recorded characterisation corpora (8 backend + 8 frontend functions)

Branch `pilot/COMPLEXITY-3-2480`. First part based on `origin/release/2450-train` (521165ad4) with `origin/pilot/CR-IFC-SPLIT-2460`
merged (9c86f9b2c; it brings `tests/support/char_corpus.py` / `char_record.py`); `origin/release/2470-train` merged on 22.11 (88dd3d168,
no conflict) and again before the final push. Target 2.48.0. Method as in docs/changes/CR-BE-COMPLEXITY-2450.md,
CR-BE-COMPLEXITY-B-2450.md, CR-IFC-SPLIT-2460.md and CR-FE-COMPLEXITY-2450.md: per function, a characterisation corpus / record taken from
the UNCHANGED code in its own `test(...)` commit, then the split in the next `refactor(...)` commit, the same tests green. Bodies are moved
verbatim; the order of the checks, of the side effects and of the output is unchanged. No export added or removed. **No UI change**: all
frontend targets are pure logic (no markup, no CSS), so no pixel spec and no baseline is affected; no comparison page is needed.

**Status: done** - all 16 functions of the row (the 3 of the first part, 13 on 22.11).

## Backend (radon CC)

| Function | Before | After | Largest helper | Corpus (cases) |
|---|---|---|---|---|
| `services/automation_model.parse_condition` | 74 | 21 | `_condition_state` 24 | `test_automation_parse_condition_char_2480.py` (3648) |
| `services/automation_model.parse_action` | 61 | 18 | `_action_service` 22 | `test_automation_parse_action_char_2480.py` (5150) |
| `services/nvr_settings.validate_changes` | 60 | 3 | `_check_field_value` 30 | `test_nvr_validate_changes_char_2480.py` (1586) |
| `services/plan_geometry.merge_candidates` | 68 | 12 | `_replace_auto` 19 | `test_plan_merge_candidates_char_2480.py` (277) |
| `services/plan_geometry.transform_crop` | 60 | 15 | `_recrop_wall` 18 | `test_plan_transform_crop_char_2480.py` (620) |
| `services/plan_catalog.check_item` | 57 | 4 | `_check_identity` 17 | `test_plan_catalog_check_item_char_2480.py` (1851) |
| `services/calendar/model.calendar_values` | 55 | 9 | `_room_values` 12 | `test_calendar_values_char_2480.py` (1798) |
| `services/notices/model.normalize_display` | 53 | 8 | `_display_weather_news` 15 | `test_notices_normalize_display_char_2480.py` (1377) |

- **merge_candidates**: `_candidate_pool` (shape / source / duplicate), `_apply_edits`, `_replace_auto` (returns the two counts; called only
  with replace_auto), `_append_chosen` (orphan check, re-issued ids, append; returns the counts and the re-issue count).
- **transform_crop**: the four closures and the walk's tallies became the module-private `_Recrop`; `_recrop_wall` (curved rule) ->
  `_recrop_segment` (Liang-Barsky) / `_recrop_polyline` (per point), `_recrop_openings`, `_recrop_labels`; a wall loop's `continue` is
  `return False`, the walls list is built by the same filter in the same order.
- **check_item**: `_check_identity`, `_check_body`, `_check_realistic` (the local plan_studio6 imports kept), `_check_builtin_only`.
- **calendar_values**: `_identity_values`, `_room_values`, `_booking_values`, `_hours_values`, `_approval_values`, called in the old field
  order; the min / max and the create checks stay.
- **normalize_display**: the `take` closure stays and is passed to `_display_scalars`; `_display_tv_choices`, `_display_blocks`,
  `_display_weather_news`, `_display_night`; place and transit stay in the function, in their old places.

Corpus inputs: every distinct call captured from the existing test files on the unchanged code (a scratch input-capture plugin, not
committed, like the previous rows' generators) plus seeded mutations; large answers are stored as `char_digest.digest()` of the document
with a readable summary (counts, notes). `merge_candidates` replays with a deterministic id source (`re-1`, `re-2` ... per call).

## Frontend (ESLint complexity, `scripts/complexity-report.mjs`)

| Function | Before | After | Largest helper | Record (`tests/fixtures/cx/`) |
|---|---|---|---|---|
| `api/automations.ts validateDraft` | 67 | 10 | `capIssues` / `actionBlockIssues` 17 | `validate-draft.json` |
| `screens/schedule-edit-logic.ts validateDraft` (its per-action callback) | 62 | callback gone; `validateDraft` 19 | `argProblems` 24 | `schedule-validate.json` |
| `tickets/status-sentence.ts sentenceFor` | 55 | 20 | `assignedSentence` 17 | `sentence-for.json` |
| `design/palette.ts schemaErrors` | 54 | 13 | `tokenError` 19 | `schema-errors.json` |
| `temperature/model.ts chipsOf` | 54 | 17 | `eventChips` 18 | `chips-of.json` |
| `api/media-players.ts playerCommandOffered` | 52 | 9 | `commandCapable` 24 | `player-command-offered.json` |
| `public-ticket/claim/claim-model.ts parseDraft` | 50 | 17 | `parsePage` 14 | `parse-draft.json` |
| `screens/nvr-batch-logic.ts batchView` | 49 | 19 | `completedView` 14 | `batch-view.json` |

Each record has its spec `tests/unit-cx-<name>-2480.spec.ts` (helper `tests/cx-record.ts`; `SW_CX_RECORD=1` rewrites a record - only
when a behaviour change is meant). Large answers are stored compactly (one line per answer; validate-draft indexes its messages).
The only edits inside moved code: a branch's `return` / `continue` inside a moved loop body became the helper's `return`, an if / else-if
chain that pushed became one that returns its value (schemaErrors `tokenError`, chipsOf `doorChip` / `defrostChip`), closures became
module consts or typed parameters (`triggerIdOf`, `Need`, `Report`), and batchView's completed case is taken first only when it is not an
unknown stop (the old body checked the two early returns before the switch; same answers, recorded).

## Tests actually run (PC; backend: Python 3.12, the main checkout's `.venv`, `pytest -p no:xdist -p no:cacheprovider`;
frontend: `playwright.unit.config.ts`, `--workers=2`)

First part (before 22.11): parse corpora 8800 passed on the unchanged code; after parse_condition 4430 passed; after parse_action 9566
passed; validate_changes corpus 1587 passed unchanged / 1743 passed after the split (with the NVR stream / encoding files).

22.11, per split (each record / corpus first passed on the unchanged code):

| Split | Run after the split | Result |
|---|---|---|
| FE validateDraft (automations) | unit-cx-validate-draft + unit-cx-parse-* + unit-automation* + unit-kavarnit-ext | 140 passed |
| FE sentenceFor | unit-cx-sentence-for + unit-textkey-2435 + unit-tickets-drawer-model / -list / -status-sentence / -board / -table | 88 passed |
| FE schemaErrors | unit-cx-schema-errors + unit-design-tokens + unit-hud-opaque + unit-menu-surfaces + unit-palettes | 43 passed |
| FE chipsOf | unit-cx-chips-of + unit-temperature* | 22 passed |
| FE playerCommandOffered | unit-cx-player-command-offered + unit-media-* | 198 passed |
| FE parseDraft | unit-cx-parse-draft + unit-public-claim-* + unit-public-ticket* | 68 passed |
| FE batchView | unit-cx-batch-view + unit-*nvr* | 102 passed |
| FE schedule validateDraft | unit-cx-schedule-validate + unit-schedule* | 101 passed, 8 skipped (the spec's own desktop-only skip) |
| BE check_item | corpus + test_plan_catalog, _catalog_api, _package, _studio6, test_catalog_images | 1935 passed |
| BE merge_candidates | first cut: corpus + test_plan_geometry_model, test_wall_curves, test_plan_detect_api, test_plan_dxf_map, test_plan_wizard_api_2434, test_shared_spaces, test_zones; after `_append_chosen`: corpus + geometry_model, wall_curves, wizard_api | 403 passed; 337 passed |
| BE transform_crop | corpus alone (both cuts) 621 passed; crop + merge corpora + test_plan_crop, _geometry_store, _geometry_model, test_wall_curves, _geometry_integration, test_plans | 979 passed |
| BE calendar_values | corpus + test_calendar_* + test_wire_calendar_2470 | 1989 passed |
| BE normalize_display | corpus + test_notice* + test_wire_notices_2470 + test_brand_notice_tv_295 | corpus alone 1378 passed; with the files 1777 passed |

Also: `tsc --noEmit` app (`tsconfig.json`) exit 0, tests (`tsconfig.tests.json`) exit 0 (after 111c58251; the first run found one
wrong type import in the schedule record spec); ruff (project `select = ["F"]`) on every changed service: all checks passed;
ESLint (repo config, type-aware) on the eight changed frontend source files: exit 0, no report. `scripts/unused-exports.mjs --enforce`:
FAIL on two file-local types of `src/arx/webauthn.ts` (`CreationOptionsJSON`, `RequestOptionsJSON`) - that file is the train's, untouched
here (no diff against `origin/release/2470-train`); it also notes `src/design/palette.ts#SCHEMA` left the baseline (the schemaErrors
record spec now uses it). The baseline was not updated by this row.

NOT_RUN: the full backend suite, `test_nvr_stream_write_locks.py` (lock / timing: run alone), the full unit / evidence suites, browser
evidence and pixel specs (no markup or CSS touched: nothing a user can see changes), the runner entry check (not queued by this agent; the
2.47.0 gate had the runner).

## Notes

- Commit `bf18286e8` carries a wrong subject and body ("refactor(components): COLOR-LITERAL-A-2480 ..."): a commit-message file in a
  scratch folder shared with a parallel agent was overwritten between writing and committing. Its content is the automations
  validateDraft split of this row (`frontend/src/api/automations.ts` only); the next commit (95c38b086) says so. Not rewritten (the branch
  was already pushed).

## Open questions (recommendation first)

- Q1. `_check_field_value` (CC 30, validate_changes), `argProblems` (24, schedules) and `commandCapable` (24, media) are verbatim flat
  chains / switches. a) leave them (recommended: one flat check per field / command); b) tables of checkers later.
- Q2. The corpora add about 9 MB of JSON fixtures (backend ~8 MB, frontend ~2 MB). a) keep (recommended: they guard the splits and
  run in seconds); b) drop each corpus one release after its split shipped.
