# WISKEY-MEDIA-V2-2530 - station media over the signed direct transport v2 (opt-in, default off)

Branch `pilot/WISKEY-MEDIA-V2-2530`, cut from `origin/release/2520-train` at `eadaa25b8`. Target version: 2.53.
Origin: R7 open question 4 (`docs/changes/WISKEY-DIRECT-V2-2520.md` section 5): station media (video / talk / listen,
`services/intercom_media.py`) stayed on v1, so with a rotated bridge key it is refused (`bridge_key_rotated`). Owner decision 25.11:
media over v2 is a separate part, enabled only after bridge 0.10.9 (`smplwise_bridge.native_keyset`, WISKEY-BRIDGE-KEYSET-2520) is
installed. Status: implemented and unit-tested against in-memory fakes only. Nothing installed, no lab, no Home Assistant, no WisKey,
no station; no talk or listen was actuated (every talk / floor / frame in the tests goes to the fake station).

## 1. What changed

One new switch, `access.station_media_direct_v2` = `off` (default) | `on`. The media path reads ONE gate,
`wiskey_media_v2.enabled(conn)` = switch `on` AND the bridge Arx last saw (`bridge.integration_version`, written by the bridge's own
hello) is 0.10.9 or newer (an unknown version is "not installed"). While the gate is closed - the default, and on every bridge below
0.10.9 even with the switch on - every media path is the code as it was, byte for byte (the provider is built by the unchanged branch,
its marker is today's 2-tuple, the capabilities read calls `caps.listing` with today's arguments).

While the gate is open:

| where | behaviour |
|---|---|
| `intercom_media.bridge_provider` | `DirectApiTransport(..., opener_v2=websocket_opener(settings, version=2))`: a rotated KeySet key opens WisKey's v2 socket (R7's signer: kid on the wire, v2 kinds, B2-ABI timeouts, `bridge_key_changed`); the pairing secret / `g0-legacy` still opens v1 exactly as before. The Home Assistant path is wrapped in `_V1OnlyFallback`: a rotated key never opens it (`bridge_key_rotated` before any connection) - also inside `AutoTransport`'s 60 s retry window after an earlier v1 direct failure. `signing_ready` = the v2 key rule. The gate is part of the provider marker: switching it (or the bridge version crossing 0.10.9) closes the earlier provider (its leased streams) and builds the other. |
| `intercom_media.signing_problem` / `provider_for` / `readiness` / `talk_gap` | a rotated key with a valid kid counts as signing (`wiskey_media_v2.key_problem`); a rotated key with an invalid kid stays `key_rotated`; no key stays `not_paired`. |
| `intercom_media.listing` -> `wiskey_media_caps.listing(..., v2=True)` | a rotated key gets its own salted fingerprint (`v2|kid|material`, never equal to a v1 entry's); the direct join's document is used only when it is a v2 document of exactly that kid on a v2 connection of that kid; else ONE read on its own v2 socket: `direct/capabilities_v3`, `direct/time`, `direct/pairing_status_v2` (R7's closed readers, empty parameters, pairing must bind to the connection's kid - otherwise `unread`). Never v1 after it. |
| `wiskey_media_contract.ERRORS` | the v2 key / pairing refusals (`bridge_key_unversioned`, `bridge_key_changed`, `pairing_ambiguous`, `direct_kid_mismatch`) read `provider_forbidden`, like the v1 key refusals (they cannot occur on v1). |

Rules kept: no fallback to v1 or to the Home Assistant path after a v2 refusal (R7's `AutoTransport` rule plus the wrapper above); an
unknown outcome is never re-sent (`media_outcome_unknown`, one `talk_open` on the wire); a key that changes under an open v2 connection
is never used on it (closed, `not_sent`); the listen gate of R5 is untouched and holds on v2 (a listen whose fresh descriptor does not
offer `signed_ws_pcmu_v1` is refused `listen_not_offered` before any `talk_open`); `access.station_media`, the provider choice
`access.station_media_provider`, permissions and audit are unchanged; no key material in a log, repr, error or answer.

The switch (`PATCH /settings`, `routers/settings_patch/modules.station_media_direct_v2`, last in the check table): only a system
administrator changes it (`403 forbidden`, audited `denied not_system_admin`); turning it `on` needs bridge 0.10.9+
(`409 bridge_outdated` with `required` / `version`, audited `denied bridge_outdated`); an actual change is audited `allowed` with
`from` / `to` / `bridge_version`; a repeated value is dropped. Hebrew message + `details.message_en`. No UI control (see question 2);
`GET /settings` shows the value. No wire model change (the settings body is a free map).

## 2. How this row becomes live (owner Q8: rotation stays blocked while WisKey is installed)

This row does NOT lift the block. `bridge_rotation.preflight` still refuses `wiskey_present` (a test pins the line). While WisKey is
installed the key is never rotated, `protocol_for_key` is 1 for every key, and the switch changes nothing at all - media keeps v1
with the pairing secret, as today. The order to make it live, each step a separate owner decision:

1. Install bridge 0.10.9 with the one approved HA restart (WISKEY-BRIDGE-KEYSET-2520 section 6); confirm `bridge.integration_version`
   reads 0.10.9 (the bridge-key card / `GET /system/bridge-key`).
2. WisKey confirms its v2 against that bridge (WISKEY-BRIDGE-KEYSET-2520 question 8.5: `FINAL-ARX-REPAIR`, `test_m15_direct_v2`).
3. The owner lifts the rotation block (R7 question 5) - a code change in `bridge_rotation.wiskey_present` / `preflight` in its own row,
   plus `GO_LIVE_PERMITTED` and `bridge.key_rotation = on` as today.
4. A system administrator sets `access.station_media_direct_v2 = on` (refused before step 1).
5. Only then a rotation makes the key v2: the direct join (R7) and station media (this row) move to v2 together; without step 4 the
   join moves and station media is refused `bridge_key_rotated` exactly as today (falls back to Arx's own video source).

Rollback: set the switch `off` (the provider is rebuilt on the next request), or revert the commit; no migration, no stored data
beyond the setting row.

## 3. Files

- `smplwise_vms/backend/smplwise/services/wiskey_media_v2.py` (new): `SETTING_KEY`, `BRIDGE_REQUIRED`, `setting`, `bridge_version`,
  `bridge_ok`, `enabled`, `state`, `key_problem`, `is_rotated`.
- `smplwise_vms/backend/smplwise/services/intercom_media.py`: `_V1OnlyFallback`, `bridge_provider`, `signing_problem`, `listing`.
- `smplwise_vms/backend/smplwise/services/wiskey_media_caps.py`: `key_fingerprint(v2=)`, `_from_join(kid=)`, `_read_async(opener_v2=)`,
  `listing(v2=)`, test seam `set_opener_for_tests(opener_v2=)`.
- `smplwise_vms/backend/smplwise/services/wiskey_media_contract.py`: four v2 codes in `ERRORS`.
- `smplwise_vms/backend/smplwise/services/settings_store.py` (default `off`), `routers/settings.py` (field),
  `routers/settings_patch/__init__.py` + `modules.py` (the check).
- `smplwise_vms/backend/tests/test_wiskey_media_v2_2530.py` (new; in-file v2 media fake, R7's v2 helpers imported),
  `tests/test_settings_patch_audit_order.py` (the check table pins: +1 validator, one refused request, one administrator-only row).

Not touched: `wiskey_media_bridge.py` (byte-pinned by `test_wk4adopt_295`; R7's API was enough), `bridge_rotation.py`,
`wiskey_feature_status.py` / `wiskey_pairing.py` (R5 / R8 files), the bridge, the frontend, `management/`.

## 4. Tests (real results)

Command per file (repo venv, in `smplwise_vms/backend`, one pytest process per file, on the PC):
`C:\cloude\smplwisebms\.venv\Scripts\python.exe -m pytest tests/<file> -p no:cacheprovider`.

| what | where | exit | result |
|---|---|---|---|
| `tests/test_wiskey_media_v2_2530.py` (new) | PC | 0 | 39 passed |
| mutation check: the gate forced on in `bridge_provider` | PC | 1 | the "off / older bridge" tests fail as they must (restored afterwards) |
| every test file that imports `intercom_media`, `wiskey_media_caps`, `wiskey_media_contract` or the settings patch table (33 files), plus `test_wiskey_direct_v2_2520`, `test_wkjoin_295`, `test_settings_intercom_cards_2401`, `test_settings_nav_pref`, `test_setting_value_parity`, `test_setting_callers_2440` - 39 files | PC | 0 for all 39 | all passed. Counts: adoptr6 25, asgi_wiskey 28, asyncio_default 18, body_limit 12, confirm_words 50, f3c_g03 3, fake_wiskey 21, intercom_media 35, intercom_shared 9, popup_layout 4, settings_patch_audit_order 8, station_media_readiness 29, t06_admission 63 (+3 xfailed), video_transport 49, w031 5, wall_phone_bar 6, wiskey_contract 53, wiskey_join_live 38, wiskey_listen_gate_2520 31, wiskey_live_validation 58, m12_policy_b_owner_switch 34, mac_adopt_298 45, mac_adopt_298_review 40, wiskey_media_v11 67, wiskey_pairing 32, r2_align_2272_contracts 9 (+1 skipped), rc10_pin 97 (+1 skipped), rc7_adopt 27 (+5 skipped), talk_caps 28, wk4adopt 44, wkaudin 19, wkdirect 53, wkf01f02 28, direct_v2_2520 39, settings_intercom_cards 5, settings_nav_pref 1, wkjoin 23, setting_value_parity 8, setting_callers 7 |
| `scripts/gen_wire_types.py --check` | PC | 0 | generated files match (no wire change) |
| `py -3.12 -m ruff check` on the 8 changed modules + the 2 test files | PC | 0 | all checks passed |
| runner (slot B), full backend suite, frontend `tsc`, Playwright | - | - | **NOT_RUN** (backend-only change, no UI; the train gate runs them) |
| real WisKey / bridge 0.10.9 / lab / station | - | - | **NOT_RUN** by rule. Media over v2 is unverified against WisKey; rotation is blocked while WisKey is installed, so it cannot occur live. |

## 5. Open questions (owner)

1. The WisKey status page (`wiskey_feature_status`, `wiskey_pairing.key_facts`) still says "key rotated, WisKey v1 refuses it" for a
   rotated key even where the join (R7) and media (this row) can sign v2. a) a small follow-up row makes those rows protocol-aware,
   together with lifting the rotation block (recommended - until then a rotated key cannot exist with WisKey installed) b) change it now
   (touches R5 / R8 files).
2. A UI control for the switch. a) none until the rotation block is lifted; the value is set by a system administrator through the
   settings API and shown in `GET /settings` (recommended - a visible switch that can do nothing would mislead) b) add a row to
   Settings > WisKey now (pixel baselines + compare page).
3. Turning `on` before bridge 0.10.9 is seen. a) refuse (`409 bridge_outdated`) and also gate at runtime (recommended, built) b) store
   it and let the runtime gate wait for the bridge.
4. Switching the gate rebuilds the media provider, which closes the streams it leased. a) accept (a rare administrator action;
   recommended, built) b) rebuild only when no stream is leased.
