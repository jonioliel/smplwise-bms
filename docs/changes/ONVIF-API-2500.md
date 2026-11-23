# ONVIF-API-2500 - camera discovery phase 1: the HTTP routes, wire models and settings

Branch `pilot/ONVIF-API-2500` (from `pilot/ONVIF-DISCOVER-2500` @ 5a729cbca). Target: the 2.5x series. Design
`docs/design/onvif-discovery-2412/DESIGN.md` on `pilot/FEATURE-DESIGNS-SEC-2490` (sections 7, 13 owner decisions 2026-11-22, 14 build
rows); error envelope ADR-019 (`docs/architecture/ADR-019-error-envelope-and-request-strictness.md` on `release/2480-train`, D1).
This is the **ONVIF-API** row over the ONVIF-DISCOVER service (`services/camera_discovery`, `MANAGER`). No device, camera, recorder,
go2rtc, Supervisor or lab network was contacted: every test runs on the fake ONVIF network of `tests/fixtures/fake_onvif.py`.

## Routes (`routers/camera_discovery.py`, mounted BEFORE `cameras` - see below)

| Route | Body | Answer (wire model) | Refusals |
|---|---|---|---|
| `GET /cameras/discovery/capabilities` | - | `DiscoveryCapabilities {enabled, engines: [{id: unicast, available, reason?}], suggested_range, max_addresses, running}` | 403 |
| `GET /cameras/discovery/scans` | - | `ScanList {scans: [ScanSummary]}` - the scans this person may see, newest first, no devices (finds a running scan again after a reload) | 403 |
| `POST /cameras/discovery/scans` | `{range?}` (empty = the suggested range) | 202 `ScanJob` | 403; 409 `discovery_off` / `scan_running`; 422 `range_invalid` / `range_too_large` / `range_refused` (`fields: ["range"]`), `site_network_unknown`, `validation`; 413 / 415; 429 `rate_limited` + `Retry-After` |
| `GET /cameras/discovery/scans/{scan_id}` | - | `ScanJob {id, state, range, engines, started_at, finished_at, progress, counts, devices: [FoundDevice]}` | 403; 404 `scan_not_found` |
| `DELETE /cameras/discovery/scans/{scan_id}` | - | `ScanCancelled {cancelled: true}` (credentials of the scan forgotten) | 403; 404 |
| `POST /cameras/discovery/scans/{scan_id}/identify` | `{device_ids, username, password, same_for_all}` | `IdentifyResult {devices: [FoundDevice]}` (`auth` per device) | 403; 404; 409 `scan_not_active`; 422 `same_for_all_required` / `device_unknown` / `credentials_invalid` / `validation` (field names); 429 + `Retry-After` |

`FoundDevice {id, address, port, engines, kind: camera|nvr|unknown, known: none|standalone|behind_recorder|recorder, known_ref?,
addable, manufacturer, model, name, firmware, clock_offset_s, auth, has_service, recorder_prefill?}`. `recorder_prefill {host,
http_port, vendor?, name?}` is set for a device that looks like a recorder and is not this installation's recorder (Q59: "add as a
recorder" opens the existing recorder wizard pre-filled; never a credential).

- **RBAC**: `system.configure` at the installation on every route (checked by the service; the refusal is the audited 403). The two
  body routes check it on a READ connection before the body is read (review L7, `read_gate` + `raw_body`, covered by
  `tests/test_raw_body_order.py`); a non-JSON body from an unauthorised caller is still the 403.
- **Audit**: the service's rows (`camera.discovery.scan` written at start and completed in place, `camera.discovery.identify`,
  `camera.discovery.cancel`, refused starts as `denied` with the reason). The route passes the request id.
- **Errors**: the five-key envelope everywhere. A refusal about request fields carries `details.fields` (names) and
  `details.problems` (`[{field, code, message?}]`, `code` = the domain code or the pydantic type) - ADR-019 D1. Body models are
  `extra="forbid", strict=True` (an extra key is `extra_forbidden`, `"yes"` is not a boolean). The router's own `_parse` reads pydantic
  errors with `include_input=False`: a refusal never echoes a value (it may be a password).
- **Rate limits**: 429 `rate_limited`, `retryable: true`, `details.retry_after_s` and the same number in the `Retry-After` header
  (the `JSONResponse(payload, headers=...)` pattern of `routers/notifications.py`). Limits are the service's (3 scans / 10 min / person,
  6 / hour / installation, 20 identification presses / 10 min / person).
- **No secrets**: no model has a field for a user name, a password, a serial, a MAC or a URL with credentials (a test checks the
  field names); answers, audit rows and the captured log are grepped for the password, the wrong password, the user name and the serials.
- **Write lock**: the start route reads the site network (Supervisor, cached 60 s) under `db.unlocked` before the service runs; the
  identification's device calls already run unlocked inside the service.
- **Route order**: `GET /cameras/{camera_id}/capabilities` (routers/cameras.py) would swallow `GET /cameras/discovery/capabilities`;
  `routers.ROUTERS` mounts `camera_discovery` before `camera_sources` / `cameras` (a test pins it).

## Wire models (`smplwise/wire/camera_discovery.py`)

`ExactModel` (pydantic strict, undeclared keys refused in the strict tests) per the RESPONSE-MODELS-E-2480 convention. That row is not
merged into this branch's base yet, so the module imports `ExactModel` from `smplwise.wire` when it exists and otherwise defines the same
class locally (one `try/except ImportError`; after that row merges the import wins and the fallback is dead code - remove it then).
Literal values are declared in sorted order, the order the E row's generator writes them in, so the generated file does not change when
that row merges. Family `CameraDiscovery` in `scripts/gen_wire_types.py` (`FAMILIES`) -> `frontend/src/api/generated/wire-camera-discovery.ts`
(generated, `--check` clean). Every route is modelled (`NO_JSON` empty): the response-model ratchet of the E row
(`scripts/wire_ratchet.py`) does not go up - checked on a trial merge (below).

## Settings (`services/settings_store.DEFAULTS`, `PATCH /settings`)

| Key | Values | Default | Validation |
|---|---|---|---|
| `cameras.discovery` | `manual` \| `off` | `manual` | pattern (no `weekly`: Q60) |
| `cameras.discovery_range_max` | `/22` .. `/28` | `/22` | pattern (the 1,024 cap of Q56 is never lifted) |
| `cameras.discovery_allowed_ranges` | IPv4 CIDRs, comma / space separated, <= 32 | empty (= the whole site network) | `settings_patch/cameras.py`: RFC 1918 only, not the Supervisor's 172.30.32.0/23, stored normalised (`10.77.0.64/26, 192.168.5.0/24`); a refusal names the field, never echoes the value |
| `cameras.discovery_rate_pps` | 10 .. 200 | `50` | pattern |
| `cameras.discovery_http_fallback` | `on` \| `off` | `off` | pattern |
| `cameras.discovery_job_ttl_min` | 5 .. 60 | `15` | pattern |

`cameras.discovery_allowed_ranges` is in `PRIVATE_KEYS`: `GET /settings` shows it only to `system.configure` (the ranges describe the
site's network), like the manual site position. The service keeps reading the raw values with its own clamps (a value stored before
this validation existed is still safe). Reserved keys of the design that nothing reads yet (`discovery_engines`, `allow_other_host`,
`plaintext_password`, `notify_new`) are not registered.

## Service changes (`services/camera_discovery/service.py`)

- `_error`: field codes get `details.fields` / `details.problems` (`FIELDS_OF`: `range_*` -> `range`, `device_unknown` -> `device_ids`,
  `same_for_all_required` -> `same_for_all`); `credentials_invalid` names `username` and / or `password`; a 429 is `retryable`.
- `Manager.list_scans` (+ `Job.summary`) for `GET /cameras/discovery/scans`: own scans; every scan for a system administrator.
- `Device.recorder_prefill` / `offer_recorder` (Q59).

## Tests

`tests/test_camera_discovery_api_2500.py` (37 tests) with `tests/fixtures/fake_onvif.py`: the route table and its exact models, the
generated types (`gen_wire_types.py --check`), no secret-looking model field, the mount order; the happy path through HTTP
(capabilities -> 202 scan -> poll -> list -> identify with `same_for_all`: one GetDeviceInformation per camera, the recorder `skipped`,
`recorder_prefill`), the refused pair not resent, cancel then `scan_not_active`; 403 + audit row for each of the 6 routes and the 403
before an unreadable body; range refusals with `fields: ["range"]`, `discovery_off`, `site_network_unknown`, the empty body (suggested
range), bad bodies (extra key, wrong type, too long, not an object, not JSON), 8 identification refusals with their field names and no
echo of the password, 404s; both 429s with `Retry-After`; the settings (registered, normalised, followed by the service and the
capabilities, private in `GET /settings`, switched off -> 409) and 10 refused setting values.

| Run | Where | Command | Result |
|---|---|---|---|
| pyflakes lane | runner, ruff 0.17.5 (rule set F from `pyproject.toml`) | `ruff check` of the 9 changed / new Python files at 036a1dfeb | All checks passed (each file) |
| route tests | PC, main `.venv` Python 3.12.10 | `python -m pytest -q -p no:cacheprovider tests/test_camera_discovery_api_2500.py` | 37 passed, exit 0 |
| touched areas | PC, main `.venv` at 2253068f1 | the two discovery files + `test_plan_routes_unique` `test_raw_body_order` `test_setting_value_parity` `test_settings_patch_audit_order` `test_singletons_registered` `test_site_location` `test_wire_routers_b_2450` `test_wire_routers_c_2470` `test_wire_routers_d_2470` `test_wire_consumption_2450` `test_settings_nav_pref` | 350 tests: 348 passed, 2 failed - both in `test_settings_patch_audit_order.py`, which pins the `VALIDATORS` table (the new entry had to be listed); fixed in 036a1dfeb, that file then 8 passed, exit 0 |
| wide run | runner slot A (`flock ~/.smplwise-tests.lock nice -n 19 ~/run_remote.sh backend pilot/ONVIF-API-2500 <36 files>`: the two discovery files, `test_camera*`, `test_settings*`, `test_wire*`, `test_error*`, `test_self_update*`, `test_autosync`, `test_source_policy`, `test_nvr_system`, `test_raw_body_order`, `test_plan_routes_unique`, `test_singletons_registered`, `test_setting_value_parity`, `test_site_location`) | NOT_RUN at hand-back: queued behind four other agents' jobs on the slot (about 25 minutes of waiting at hand-back); the run checks out the branch head when it gets the lock. Result file `~/smplwise-results/onvifapi2500_tests.out` (pytest summary line; the script's last line `EXIT= ` is a quoting slip, read the summary) | |
| trial merge with `origin/pilot/RESPONSE-MODELS-E-2480` (6bf65de99) | PC, throw-away worktree of 2253068f1 | merge: no conflict; `python scripts/wire_ratchet.py`: "every count equals its baseline (901 unmodelled JSON routes in 119 router modules)", `--list camera_discovery`: 0 unmodelled; `gen_wire_types.py --check` exit 0; `pytest tests/test_wire_ratchet_2480.py tests/test_wire_routers_e_2480.py tests/test_wire_routers_d_2470.py tests/test_camera_discovery_api_2500.py` | 288 passed, exit 0 (with the E row's real `ExactModel`) |

## Known limits / not done here

- **Add step** (`POST /cameras/discovery/scans/{id}/add`, batch add on `create_standalone`), the **preview form** of
  `POST /cameras/source/test` (`{scan_id, device_id, profile}`) and the **origin migration** (`camera_stream_sources.origin`,
  `onvif_json`) need the stream addresses (Media `GetProfiles` / `GetStreamUri`) of the ONVIF-CLIENT row; the service already keeps
  the working credentials for that step (`credentials_for`). Not built here.
- `contracts/API_INVENTORY.md` is regenerated at release (`scripts/api_inventory.py`), not in a feature row.
- UI: ONVIF-UI. Real devices: NOT_RUN (fixtures only); the lab read-only run is ONVIF-LAB-DOCS and needs the owner's per-step approval.
- One system-administrator-only permission holds `system.configure` today, so "another person's scan is 404" is reachable only
  through a custom role; the service test covers the rule, the route test does not.

## Rollback

Code only: revert the branch. The six settings rows are written only when an administrator saves them; an older version ignores them.
