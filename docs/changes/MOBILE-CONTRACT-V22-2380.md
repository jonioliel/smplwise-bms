# MOBILE-CONTRACT-V22-2380 - presence contract v2.2 for the phone apps (work package M2 / A2)

Branch `pilot/MOBILE-CONTRACT-V22-2380` from `origin/release/2360-train` @ `eb9525d9b`. No version bump, no merge, no runner, no device,
no push sent, no lab access. Plan: `private/planning/NEXT_PHASE_DISPLAY_MOBILE_PLAN_2026-11-02.md` sections 1.3 (A2) and 3 (M2).

## 1. What and why

The app teams were told on 2026-10-24 (`APP_TEAM_REQUESTS_2026-10-24_HE.md` S-1..S-4, K-5) that the sensor value shapes, the battery
"unknown" case, the `confidence` / `proximity` lists, the `intervals_s` defaults and the key-rotation proof would come with the next contract
version; MOBILE214 had stayed a proposal. Contract v2.2 (`docs/api/mobile-presence-contract.md`) now fixes them, and the server can check
them - **off by default**, so the 2.1.x apps in the field see no change.

| Item | Contract v2.2 | Server |
|---|---|---|
| Sensor value shapes (S-1) | section 4.1: keys, required keys, closed enums per sensor; `location` never a sensor event | `services/presence_values.py` (new): `problems()` / `normalize()`; wired into `presence._validate_event` after the envelope and the allow-list, before the Wi-Fi verdict |
| `presence.value_check` | `off` (default, 2.1: stored as sent) / `normalize` (never refuses; keeps only valid v2.2 keys; `type` read as `network`) / `strict` (`400 invalid_event`, `details.field = value.<key>`, `details.reason` = `unknown_key` / `invalid_value` / `missing_key`; the value is never echoed) | new setting, validated (422), audited by the existing `presence.settings.update` row, returned in `GET presence/settings` and `GET presence/config` (`sensors.value_check`); does not bump the notice version |
| Battery level unknown (S-2) | `level_percent: null`, key always present; an app with nothing to report may skip the event (both current app behaviours conform) | enforced in `strict` only |
| `confidence` / `proximity` | `confidence`: `high` / `medium` / `low` / `unknown`; `proximity`: `immediate` / `near` / `far` / `unknown` | `unknown` proximity is stored but never places a person (unchanged `presence_people._proximity_ok`) |
| `network` | `wifi` / `cellular` / `none` / `other`; Wi-Fi keys only with `wifi`; `wifi_site_id` only with `wifi_match: true`; no `network_ssid` | cross-field rules in `strict`, dropped in `normalize` |
| `intervals_s` defaults (S-4) | section 2.2: every sensor but `location` (`activity` 300, `steps` 300, `altitude` 300, `battery` 900, `network` 60, `beacon` 60, `app_state` 300); a change of state is never dropped | `DEFAULT_INTERVALS` extended; a stored map overrides per key and the rest falls back to the defaults (a stored bad entry, e.g. a boolean, is now ignored) |
| Status object | section 4.2: `location_auth` = `always` / `when_in_use` / `denied` / `restricted` / `not_determined` with the platform mapping; `sensors` = `on` / `off` / `unavailable` | unchanged (never refused) |
| `contract_version` | `GET presence/config` answers `"2.2"` (absent = 2.1 or older) | additive field |
| `relay_url: null` (P-1) | section 8: no relay URL = that server sends no push; no build default | text only |
| Key rotation proof (K-5) | section 11: normative for the apps - pin, `device_key.replaces`, the four `409 device_key_bound` reasons, what releases the pin | **already built** (APPREFRESH2/3-295, spec rev 2) and unchanged; v2.2 adds the official fixtures and a verification vector (below) |

K-6 (hardware attestation; server side exists behind `security.app_refresh_attestation`, default off) and K-7 (signing every call) stay
outside v2.2, as the plan says.

## 2. Files

- `smplwise_vms/backend/smplwise/services/presence_values.py` (new) - the shapes; pure functions, no I/O, no logging of values.
- `smplwise_vms/backend/smplwise/services/presence.py` - `DEFAULT_INTERVALS`, `presence.value_check`, `_check_value`, `config_for`.
- `docs/api/mobile-presence-contract.md` - v2.2 (changelog, sections 2, 2.2, 4, 4.1, 4.2, 8, 11).
- `docs/changes/MOBILE214-CONTRACT-GAPS.md` - marked resolved by v2.2 (proposal kept as history).
- `contracts/examples/presence-sensor-values.v2.2.example.json` (new) - valid values, refused values with their exact field / reason, and
  what `normalize` keeps of the 2.1.x shapes reported by the 2026-10-23 review (not verified on a device).
- `contracts/fixtures/device_key_rotation/` (new) - `challenge_ok`, `mint_replace_ok`, `mint_replace_missing`, `mint_replace_nonce`,
  `mint_replace_invalid`, `mint_replace_clock`, `mint_same_key_ok`, `index.json` (cases + placeholder legend), `replace_vector.json`
  (a TEST public key, the replace message and a signature the server verifies; no private key was stored).
- Tests: `tests/test_presence_contract_v22.py` (new), `tests/test_app_refresh_rotation_fixtures_k5.py` (new).

`routers/presence.py` and `routers/app_refresh.py` did not need a change (the settings route passes the body to the service; the K-5 routes
are as built).

## 3. Security and privacy (AGENTS.md, docs/security/HA_IDENTITY_RBAC_HE.md)

- Nothing is switched on: `presence.enabled` stays false, `presence.value_check` defaults to `off`, `security.app_refresh` and the device-key
  modes are untouched. No route, permission or role changed; `value_check` is written only through `PUT presence/settings`
  (`system.configure`), like every other presence setting.
- Data minimisation: `normalize` and `strict` stop storing keys the contract does not name (personal data nobody asked for), including a
  coordinate sent as a `location` sensor value. A `strict` refusal names the key and the reason, never the value; nothing new is logged.
- Fixtures and the vector carry placeholders or test-only public material; the fixture test refuses token / nonce / device-token / family
  prefixes and any 60+ character base64url run in a fixture file.
- The status object is never refused by the value check (it is how "sharing off" reaches the server).

## 4. Tests

Single process, the workstation venv, from `smplwise_vms/backend`:

| Command | Result |
|---|---|
| `pytest tests/test_presence.py` (before the change, baseline) | 19 passed |
| `pytest tests/test_presence_contract_v22.py tests/test_presence.py` (final code) | 82 passed (63 + 19) |
| `pytest tests/test_app_refresh_rotation_fixtures_k5.py` (verify mode, after writing the fixtures once with `ARX_WRITE_FIXTURES=1`) | 9 passed (inside the regression run) |
| Regression, one process: the two new files + `test_presence`, `test_app_refresh_295`, `test_app_refresh_devicekey_295`, `test_app_refresh_keypin_295`, `test_mobile_push`, `test_app_session_fixtures_sx25`, `test_whoin034_295`, `test_area_presence_line_2351`, `test_xsecfix_297`, `test_xsecfollow_297`, `test_tickets_app_push` | 328 passed, 1 failed - the failure was the new no-partial-write assertion running against the pre-fix service (the test file was edited while the run was collecting); the fix is in commit 3 and the rerun above passes |

NOT_RUN: lint (no linter installed in the venv, no repo config); the full backend suite and every runner gate (release gates have priority tonight); any app, device, relay or lab check; no
frontend change, so no frontend test.

## 5. Open points for the owner and the lead

1. **`value_check` before switching presence on** - recommend `normalize` on the first installation that turns presence on (unknown keys
   are not stored), `strict` only after the app teams report v2.2 shapes BUILT. Owner's choice; it is a setting, default `off`.
2. **Battery level unknown** - v2.2 picks `level_percent: null` with the key always present (both current apps conform). The owner may
   choose "no event" instead; that is a one-line contract change.
3. **Settings UI** - `value_check` has no control in הגדרות › אפליקציה לנייד yet: `system-presence.ts` belongs to polish round 4 (WP8) until
   2.37.0 merges. Until then it is set through the API. Follow-up for after 2.37.0.
4. **App teams (R11, package M1)** - attach contract v2.2, `presence-sensor-values.v2.2.example.json` and `contracts/fixtures/device_key_rotation/`;
   ask each team to report S-1/S-2/S-4/W-3/K-5 as BUILT / NOT_RUN / BLOCKED against them.
