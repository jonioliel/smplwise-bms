# ADR019-FAMILY3-2510

ADR-019 (`docs/architecture/ADR-019-error-envelope-and-request-strictness.md`), decision D1 (L2, one field-error envelope),
"Step 1..n" for **family 3: NVR, recorders, connection, camera, device layouts and wall**, exactly as the ADR's order table lists
it. Family 4 is not started. The L14 part (request-model strictness) is another row and is not touched.

Branch `pilot/ADR019-FAMILY3-2510` from `origin/release/2500-train` (60fc78e3d: Step 0, families 1-2 and L14 observe merged).
Pixel-neutral: no text, placement or style changes; statuses, envelope `code`s and `user_message`s are unchanged; every change
under `details` is additive (the legacy key is still sent - Step 1 (d) removes it one release later).

## What changed

| Module | Before | Now (legacy key still sent) |
|---|---|---|
| `routers/nvr_connection.py` - 19 refusals (vendor, host, ports, username, extra, password incl. `reason: destination_changed`, `if_revision`, `tls_pin`, `confirm_text`, `confirm`) | `details.field` (+ `reason`) | `field_error(..., code=<same>, legacy={"field"}, extra={"reason"})` |
| `routers/nvr_connection.py`, `routers/recorders.py` - 409 `recorder_duplicate` (3 sites) | `details.field: host` | same keys + `fields: ["host"]` (D1: "the few 400 / 409 refusals that name a field") |
| `routers/recorders.py` (`name_invalid`, `time_zone_invalid`, `confirm_required`), `routers/nvr_settings.py` (`stream_ref`), `routers/camera_image_health.py` (`action`) | `details.field` | `field_error(..., legacy={"field"})` |
| `services/nvr_settings.py` - body type, `value_not_allowed` (+ `allowed`, `codec`), `field_not_supported`, `field_locked` (+ `by`) | `details.field` (+ extras) | `field_error(..., legacy={"field"}, extra=...)` |
| `services/nvr.py`, `services/recorders/hikvision.py`, `provision_isr.py`, `provision_isr_auth.py`, `provision_playback.py` - `value_not_allowed` / `field_not_supported` | `details.field` (+ `allowed`) | `field_error(..., legacy={"field"}, extra={"allowed"})` |
| `services/nvr_batch.py`, `services/nvr_encoding_batch.py` `_invalid(..., field=)` (12 call sites, built at run time - the scan reads them as `dynamic`) | `details.field` (+ `min`, `max`) | `field_error(..., legacy={"field"}, extra=...)` when a field is named; `index` / `extra` refusals unchanged |
| `services/camera_image_health.py`, `services/recorder_health.py` settings `validate()` | `details.field` (+ `min`, `max`) | `field_error(..., legacy={"field"}, extra={"min", "max"})` |
| `services/connection_probe.py` `host_refused`, `port_refused` | `details.field` | `field_error(..., legacy={"field"})` |
| `services/recorders/frigate_config.py` (`frigate_config_value_invalid`, `frigate_config_key_unknown`) | `details.key` (+ `min`, `max`) | `field_error([key], legacy={"key"}, extra=...)` |
| `services/frigate_config_svc.py` `put_settings`, a key outside its section (inventory family `frigate`, ADR order 8) | `details.key` | the same `field_error` as `FrigateConfig.write_settings` above - one route, one shape (see open question 1) |
| `routers/wall.py` PATCH profile, refused `config` | `details.errors: [{loc, msg}]` | `_config_error()`: `fields` + `problems` (`{field: "config.<loc>", code: <pydantic type>, message: <the global handler's Hebrew constraint text>}`), `errors` kept |
| `routers/device_layouts.py` PUT, semantic issues | `details.errors: [string]` | `fields` = the path each issue line names (`_issue_field`: the text before `: `, else its first word), `errors` kept; no `problems` (the lines carry no machine code and no Hebrew text) |

The canonical field names are the legacy names as they were (the NVR write `changes` keys, the Frigate setting keys, the layout
paths); only the wall configuration, which had no field name, gets body-relative paths (`config.rotate_s`).

**Screens** (the only family-3 readers of a field key in the inventory):
- `components/nvr-connection-form.ts` `fieldError()` marks the field from `fieldsOf(err)[0]` (was `details.field`).
- `screens/nvr-cameras-edit.ts` `errorLine()` names the refused stream field from `fieldsOf` (a local `fieldOf()` wraps the plain
  `ErrorShape` in an `ApiError`; was `details.field`).
- `api/nvr-settings.ts` (demo mock) sends `fields` beside `field`, as the backend does.
The recorder / camera health, Frigate, wall and layout screens show `describeError()` only.

**Inventory script** (`scripts/error_contract_inventory.py`): new `site_shape(site)` - a site built by `field_error()` /
`to_api_error()` (marked `canonical`) is shape `fields` even when its legacy key is a domain `errors` list (which sorts before
`fields` in `shape_of`); the counts, examples, module mix and the legacy / canonical family tables use it. `shape_of` itself is
unchanged (a hand-built `{"errors", "fields"}` dict stays `errors`).

**NVR characterisation corpus** (`tests/fixtures/nvr_validate_changes_char_2480.json`): the 137 recorded refusals that name a field
gained `fields: [field]` (scripted, exact; every other recorded value is unchanged; the file round-trips byte-identically).

Legacy-key removal (Step 1 (d)) is NOT part of this row: one release later, after the inventory shows no reader of the legacy key.

## Inventory (`scripts/error_contract_inventory.py`, run on the PC before / after)

| | before (60fc78e3d) | after |
|---|---|---|
| legacy 422 sites: nvr / recorders / recorder / connection / camera / device / wall | 28 / 26 / 4 / 2 / 5 / 1 / 1 = 67 | 0 / 0 / 0 / 0 / 0 / 0 / 0 |
| canonical `fields` 422 sites: same families | 5 / 0 / 0 / 0 / 12 / 14 / 0 | 35 / 26 / 4 / 2 / 17 / 15 / 1 |
| legacy 422 sites, family `frigate` (the one site of the same Frigate settings route) | 1 | 0 |
| legacy 422 sites, all families (sum of the family table) | 220 | 152 |
| 422 shape `fields` / `field` / `key` / `errors` | 505 / 128 / 26 / 14 | 575 / 68 / 20 / 12 |
| `fields` form `list[str]` | 342 | 412 |
| 422 sites | 1496 | 1498 (the two batch `_invalid` wrappers now hold a `field_error` call) |
| constructors `field_error` / `ApiError` | 72 / 3261 | 145 / 3190 |
| modules mixing 422 shapes | 11 | 8 (`routers/device_layouts.py`, `routers/nvr_connection.py`, `services/nvr_settings.py` left the list) |
| frontend readers of `details.field` | 8 (incl. `nvr-connection-form.ts:213`, `nvr-cameras-edit.ts:184`) | 6 (no family-3 file) |

## Tests

New: `smplwise_vms/backend/tests/test_error_envelope_family3_2510.py` - no family-3 422 left legacy and no family-3 refusal that names
`field` / `key` without `fields` (scan, 409 included); the inventory's `site_shape`; stream write body / value / kept-codec /
not-supported refusals; both batch `_invalid`s; camera-image and recorder health settings; Frigate configuration; the wall
`_config_error` (fields, problems with Hebrew text, legacy `errors`); `_issue_field` on the layout issue lines.
Frontend: `frontend/tests/unit-error-fields.spec.ts` - the NVR stream editor's `errorLine` names the field from the canonical key,
the legacy key and both.
Changed (API tests assert `details.fields`): `test_cr022_security_review.py` (password / destination changed, port refusals,
revision required), `test_nvr_connection.py` (port refused, confirm text), `test_multi_nvr.py` (batch targets / recorder id,
409 duplicate, time zone), `test_nvr_stream_write.py` (fps, resolution under a codec change), `test_provision_encoding_write.py`,
`test_frigate_config.py` (every value / key refusal: `fields == [key]`), `test_device_layouts.py` (a semantic refusal names
`layout.items.floor:ground`), `frontend/tests/evidence-nvr-connection-live.spec.ts` (live-backend spec: `fields` in the two
`toMatchObject`s), `test_error_envelope_step0_2500.py` (the inventory's site dict carries `canonical`),
`test_nvr_validate_changes_char_2480.py` (docstring; corpus above).

## Results

PC (one file at a time, `-o addopts= -q`, worktree code on the import path, each with its own `--basetemp`, deleted afterwards):
- `tests/test_error_envelope_family3_2510.py` - 14 passed.
- `tests/test_error_envelope_step0_2500.py` - 17 passed; `tests/test_error_envelope_family2_2500.py` - 7 passed;
  `tests/test_error_contract_inventory_2490.py` - 7 passed.
- `tests/test_nvr_validate_changes_char_2480.py` - 1587 passed (the corpus with the additive key).
- `tests/test_provision_encoding_write.py` - 32 passed; `tests/test_device_layouts.py` - 14 passed;
  `tests/test_nvr_stream_write.py` - 45 passed; `tests/test_multi_nvr.py` - 18 passed; `tests/test_nvr_connection.py` - 78 passed;
  `tests/test_cr022_security_review.py` - 34 passed.
- `tests/test_frigate_config.py` - first run 1 failed / 16 passed: the Frigate settings route's own key refusal
  (`frigate_config_svc.put_settings`) still answered `key` only; fixed in 494159aff (same `field_error`); rerun 17 passed.
- `ruff check` on every changed Python file: clean on the product files and the script; on the changed tests no new finding
  (the F811 fixture redefinitions in `test_frigate_config.py`, `test_provision_encoding_write.py`, `test_cr022_security_review.py`
  are pre-existing, same count as the base).
- Inventory before / after: the table above.

Runner (slot B, `~/work/slotb.sh ~/work/adr019f3_run.sh`, queued 14:12 UTC, ran 15:45-15:50 UTC at 494159aff; summary in
`~/work/adr019f3-out/summary.txt`):
- `gen_wire_types.py --check` exit 0; `error_contract_inventory.py` exit 0.
- `tsc -p tsconfig.json` (app) exit 0; `tsc -p tsconfig.tests.json` exit 0; `eslint` on the three changed frontend files exit 0;
  `unused-exports.mjs --enforce` exit 0 ("no export outside the baseline").
- Node unit specs `unit-error-fields.spec.ts`, `unit-nvr-cameras-edit.spec.ts`, `unit-insights.spec.ts` (`--workers=2`) - 45 passed.
- `vite build` exit 0; Playwright desktop `evidence-nvr-connection.spec.ts`, `evidence-nvr-cameras-write.spec.ts`,
  `evidence-nvr-cameras.spec.ts` (`--workers=2`, mocked backend) - 75 passed.
- Backend related files (117 files that mention a touched module / route, `field_error` or the inventory, in 4 shards):
  **NOT_RUN** - run 1's shards errored at setup (my script did not create the `--basetemp` parent directory; no test ran). The
  fixed backend-only job `~/work/adr019f3_run2.sh` was queued at 15:50 UTC and had not got slot B by 17:17 UTC (a release gate
  running, ~2 GB free); it stays queued and writes `~/work/adr019f3-out2/summary.txt` when it runs.

Not run: `frontend/tests/evidence-nvr-connection-live.spec.ts` (needs its own live backend fixture, `SW_LIVE=1`; only two
`toMatchObject` keys were added). No visible change, so no compare page.

## Open questions (built to the recommendation)

1. `services/frigate_config_svc.py` belongs to the inventory family `frigate` (ADR order 8), but its one refusal is the same
   `frigate_config_key_unknown` of the same settings route as family-3 `FrigateConfig.write_settings`. Recommendation: keep it in
   this row (converted, one site) so one route answers one shape; family 8 then has one site less.
2. The canonical names keep the legacy names (`fps` for the write body's `changes.fps`, `motion.threshold` for the Frigate
   `values` map) rather than the full body path the ADR describes. Recommendation: keep them now (the two screens match on these
   names, nothing visible changes) and decide body-relative prefixes once, for every family, before Step 1 (d).
3. The device-layout semantic issues are English developer lines without a machine code, so they give `fields` but no `problems`.
   Recommendation: leave as is; codes per issue are a separate improvement if a screen ever marks layout fields.
