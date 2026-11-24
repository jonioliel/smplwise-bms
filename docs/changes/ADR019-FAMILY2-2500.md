# ADR019-FAMILY2-2500

ADR-019 (`docs/architecture/ADR-019-error-envelope-and-request-strictness.md`), decision D1 (L2, one field-error envelope),
"Step 1..n" for **family 2: presence (35) and mobile (1)**, exactly as the ADR's order table lists it. Family 3 is not started. The
L14 part (request-model strictness) is another row and is not touched.

Branch `pilot/ADR019-FAMILY2-2500` from `origin/pilot/ADR019-STEP0-2500` (90e34c02e: Step 0 + family 1). Pixel-neutral: no text,
placement or style changes; statuses, envelope `code`s and `user_message`s are unchanged; every change under `details` is additive.

## What changed

| Module | Before | Now (legacy key still sent) |
|---|---|---|
| `services/presence.py` settings (`update_settings`, `_validate_sites` / `_beacons` / `_wifi_sites` / `_places`, `_place_floor`, `_int_or_none`, `_normalize_people`, `_normalize_required`, `break_glass`) - 35 sites, 422 | `details.field` (+ `known`) | `field_error(..., cls=PresenceError, legacy={"field"}, extra={"known"})` |
| `services/presence.py` unknown settings key | `details.fields` (names) | `field_error(..., sorted(unknown), cls=PresenceError)` (same keys) |
| `services/presence.py` `_normalize_people` whole object refused | `field: "people.*"` | canonical `fields: ["people"]`, `field: "people.*"` kept |
| `services/presence.py` phone-app 400s: `invalid_name`, `invalid_platform`, `invalid_install_id`, `invalid_notice_version`, `invalid_event` | `details.field` (+ `client_event_id`) | `field_error(code=..., status=400, cls=PresenceError, legacy={"field"}, extra={"client_event_id"})`; `field: "lat/lon"` -> `fields: ["lat", "lon"]` |
| `services/presence.py` `_check_value` (contract v2.2 strict value refusal, 400 `invalid_event`) | `field`, `reason`, `sensor`, `client_event_id`, `contract_version` | adds `fields` and `problems: [{field, code: <reason>}]`; every v2.2 key kept |
| `services/mobile_push.py` `register` (400 `invalid_platform` / `invalid_relay_token`), `set_muted` (422) | `details.field` (+ `known`) | `field_error(..., legacy={"field"}, extra={"known"})` |

The 400 refusals are converted too: D1 covers "422, and the few 400 / 409 refusals that name a field", and the phone app sees one
shape on every presence refusal. The inventory's family table counts 422 sites only.

**`errors.field_error(..., cls=ApiError)`** - one keyword added to the Step-0 helper: the family's own `ApiError` subclass.
`PresenceError` stays the raised class because `routers/presence.py` `register_device` catches it to audit the refusal; the default
stays `ApiError`.

**Screens:** none to move. No web-UI screen reads a presence / mobile field key (the presence settings, places, people and device
screens show `describeError()` only; the inventory's frontend readers list has no presence / mobile file). No frontend file changed.

**Phone-app contract** (`docs/api/mobile-presence-contract.md`): an additive **v2.3 note** in the changelog and section 0 - the
refusals that name a field also carry `details.fields`, the strict value refusal also `details.problems`; `details.field`, `reason`
and the other keys stay. `presence_values.CONTRACT_VERSION` stays `"2.2"` (see open question 1).

Legacy-key removal (Step 1 (d)) is NOT part of this row: one release later, after the phone apps read `fields`.

## Inventory (`scripts/error_contract_inventory.py`, run on the PC before / after)

| | before (90e34c02e) | after |
|---|---|---|
| legacy 422 sites, family `presence` | 35 (canonical `fields`: 1) | 0 (canonical `fields`: 36) |
| legacy 422 sites, family `mobile` | 1 (canonical 0) | 0 (canonical 1) |
| legacy 422 sites, all families (sum of the family table) | 256 | 220 |
| 422 shape `fields` / `field` | 461 / 164 | 497 / 128 |
| `fields` form `list[str]` | 301 | 338 |
| constructors `field_error` / `PresenceError` / `ApiError` | 22 / 61 / 3251 | 72 / 14 / 3248 |
| modules mixing 422 shapes | 12 (incl. `services/presence.py`) | 11 |

## Tests

New: `smplwise_vms/backend/tests/test_error_envelope_family2_2500.py` - `field_error(cls=)`, no presence / mobile refusal that names
a `field` without `fields` (scan), settings / people / device / event refusals, the strict v2.2 value refusal with `problems`, the
mobile push refusals (service helpers, no app).
Changed (API tests assert `details.fields`, and `problems` where present): `test_presence.py` (register `invalid_platform`, the
settings validation loop per field incl. the unknown key, the `invalid_event` loop, break-glass, `wifi_match_mode`,
`hardware_required`), `test_presence_contract_v22.py` (the exact strict-refusal details now include `fields` + `problems`; every
invalid example asserts its `problems`), `test_whoin034_295.py` (every places refusal: `fields == [field]`), `test_mobile_push.py`
(`invalid_platform`, `muted`).

## Results

PC (one file at a time, worktree code confirmed on the import path):
- `tests/test_error_envelope_family2_2500.py` - 7 passed.
- `tests/test_error_envelope_step0_2500.py` - 17 passed.
- `tests/test_presence_contract_v22.py` - 63 passed.
- `ruff check` on the three changed product files - clean; on the changed tests - no new finding (the F811 fixture
  redefinitions in `test_presence_contract_v22.py` / `test_mobile_push.py` are pre-existing).

Runner (slot B, `~/work/slotb.sh ~/work/adr019f2_run.sh`, summary `~/work/adr019f2-out/summary.txt`): RUNNER_RESULTS_PENDING

Not run on purpose: eslint, `vite build` and Playwright - no frontend file changed in this row (the bundle equals the base's).
