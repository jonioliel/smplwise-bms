# COMPLEXITY-3-2480 - three more backend complexity extractions behind recorded corpora (partial row)

Branch `pilot/COMPLEXITY-3-2480`, based on `origin/release/2450-train` (521165ad4) with `origin/pilot/CR-IFC-SPLIT-2460` merged
(9c86f9b2c; it brings `tests/support/char_corpus.py` / `char_record.py`). `origin/pilot/CR-FE-COMPLEXITY-2450` is already in the train.
Target 2.48.0. Method as in docs/changes/CR-BE-COMPLEXITY-2450.md, CR-BE-COMPLEXITY-B-2450.md and CR-IFC-SPLIT-2460.md: per function,
a characterisation corpus recorded from the UNCHANGED code in its own commit, then the verbatim split in the next commit; check order
unchanged.

**Status: partial.** The row asked for 8 backend + 8 frontend functions. The lead stopped all agents (weekly usage nearly exhausted)
after 3 backend functions were done. Nothing on the frontend side was changed.

## Done (backend, radon CC)

| Function | Before | After | Largest helper | Corpus (cases) |
|---|---|---|---|---|
| `services/automation_model.parse_condition` | 74 | 21 | `_condition_state` 24 | `test_automation_parse_condition_char_2480.py` (3648) |
| `services/automation_model.parse_action` | 61 | 18 | `_action_service` 22 | `test_automation_parse_action_char_2480.py` (5150) |
| `services/nvr_settings.validate_changes` | 60 | 3 | `_check_field_value` 30 | `test_nvr_validate_changes_char_2480.py` (1586) |

- **parse_condition**: the preflight, template / device locks, the `bad()` closure and the common block (its uid taken at the same
  point) stay; each type branch moved into `_condition_state` / `_numeric_state` / `_time` / `_sun` / `_trigger` / `_group`.
- **parse_action**: the preflight, the `bad()` / `mk()` closures, the condition step and the device lock stay; `_action_choose` / `_if` /
  `_repeat` / `_delay` / `_stop` / `_service`.
- **validate_changes**: `_check_requested` (the loop body; the `continue` after the b_frames check is a `return`), `_check_field_value`
  (the elif chain), `_check_smart_locks`, `_check_kept_under_new_codec`, `_stream_diff`.
- Verbatim check (script over the old and new bodies, whitespace-stripped): the only added lines are helper signatures, docstrings,
  the calls and returns; the only removed line is that one `continue`.

New test support: `tests/support/char_digest.py` - the automation model contexts the parse corpora replay under (four variants with
a deterministic uid source) and `digest()` (a large block is stored as the sha256 of its corpus encoding, key order included, plus a
readable summary). Corpus inputs: every distinct call captured from the existing test files on the unchanged code (a scratch capture
plugin, not committed, like the previous rows' generators) plus seeded mutations.

## Tests actually run (PC, Python 3.12, the main checkout's `.venv`, `pytest -p no:xdist -p no:cacheprovider`)

| Run | Result |
|---|---|
| parse corpora on the unchanged code | **8800 passed** |
| after the parse_condition split: its corpus + `test_automation_model`, `test_kav079_model`, `test_building_presence_2271`, validate_draft corpus | **4430 passed** |
| after the parse_action split: both parse corpora + `test_automation_model`, `test_kav079_model`, `test_automations_draft`, validate_draft corpus | **9566 passed** |
| validate_changes corpus on the unchanged code | **1587 passed** |
| after the validate_changes split: its corpus + `test_nvr_encoding_plan`, `_encoding_batch`, `_stream_document`, `_stream_write`, `_h264_bulk_2341`, `_stream_review_fixes` | **not finished when the agents were stopped**: about 97 % of the run (the corpus file runs first and was fully through) with **0 failures, 0 errors** so far; no final summary line, so NOT_RUN as a verdict - re-run before the train |
| ruff (project `select = ["F"]`) on the two changed services | **All checks passed** |

NOT_RUN: the full backend suite, `test_nvr_stream_write_locks.py` (lock / timing test: run alone), the runner entry check; frontend
nothing (no frontend change). No UI change, no baselines.

## Remaining (for a follow-up row)

Backend, chosen and inputs already captured (not committed): `plan_geometry.merge_candidates` (68), `plan_geometry.transform_crop` (60),
`plan_catalog.check_item` (57), `calendar/model.calendar_values` (55), `notices/model.normalize_display` (53).
Frontend (complexity-report.mjs), chosen, nothing done: `api/automations.ts validateDraft` (67), `screens/schedule-edit-logic.ts
validateDraft` (62), `tickets/status-sentence.ts sentenceFor` (55), `design/palette.ts schemaErrors` (54), `temperature/model.ts chipsOf`
(54), `api/media-players.ts playerCommandOffered` (52), `public-ticket/claim/claim-model.ts parseDraft` (50),
`screens/nvr-batch-logic.ts batchView` (49). None of these files is edited by another open branch (checked against origin).

## Open questions (recommendation first)

- Q1. `_check_field_value` (CC 30) is the verbatim elif chain of per-field checks. a) leave it (recommended: one flat chain, one check
  per field); b) a table of per-field checkers later.
