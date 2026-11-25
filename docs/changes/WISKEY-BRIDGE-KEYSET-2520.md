# WISKEY-BRIDGE-KEYSET-2520 - bridge 0.10.9: `smplwise_bridge.native_keyset`, the key-set binding WisKey's direct v2 needs

Branch `pilot/WISKEY-BRIDGE-KEYSET-2520`, cut from `origin/pilot/WISKEY-R7-2520` (`d4e7d1d3c`). Target version: 2.52.
Origin: R7 open question 1 (`docs/changes/WISKEY-DIRECT-V2-2520.md` section 5), answered with its recommendation (a).
Status: implemented and unit-tested against fakes and Arx's own v2 signer. **Nothing installed, no lab, no Home Assistant, no WisKey
contact.** Installing 0.10.9 needs **one owner-approved Home Assistant Core restart** (custom integrations load only at Core start);
no install and no restart were done here.

## 1. Inputs (read only)

- WisKey PRODUCT `3e7bfc585d5a30bddd97ceeed1bb0d7032ee021d` (rc19): `trusted_actions/existing_bridge_auth.py` (`verify`, `check`,
  `_check_key`, `proof_protocol`, `legacy_key_current`), `trusted_actions/direct_bridge_origin.py` (`send_message`, `check_connection`,
  `bind_pairing_origin`), `direct_bridge_api.py` (the 0.25 s socket watcher, `pairing_status_v2`), `manual_service_grants.py`
  (`pairing_fingerprint`), `tests/ha/test_m15_direct_v2.py` (read, not run).
- Contracts `8c6b10208e3fc356581d73a49a062a7a62f726f9`, `docs/owner-development-2026-11-24/mac-arx-resync/`: `source/HISTORICAL_ARX_BINDING.json`
  names a `native_keyset.py` (5610 bytes, sha256 `ad9f3221...`) in a Mac-assembled "M15 arx-after candidate" only; its source is in
  neither repository. This module is written from WisKey's calls, not from that file.
- R7 (`pilot/WISKEY-R7-2520`): `services/wiskey_media_bridge.py` `sign_connect / reply_mac / open_reply / BridgeSigner(protocol_version=2)`,
  `services/bridge_keys.sign_with`.

## 2. The interface: what WisKey rc19 calls vs what 0.10.9 provides

| WisKey rc19 call site | call | 0.10.9 provides |
|---|---|---|
| `existing_bridge_auth.verify` (message has `kid`, direct socket only) | `from ...native_keyset import Unavailable, verify`; `key_binding = await verify(hass, message)`; `bound_entry, _kid = key_binding.check()`; `except Unavailable` -> `Unauthorized` | `async def verify(hass, message) -> KeyBinding`; `KeyBinding.check() -> (entry, kid)`; `class Unavailable(Exception)` with a fixed `code` (also its `str`) |
| `existing_bridge_auth._check_key` / `proof_protocol`, `direct_bridge_origin.check_connection` (every 0.25 s per open v2 socket), `bind_pairing_origin` | `binding.check()` -> `(entry, kid)`, `Unavailable` | same; synchronous, no I/O |
| `direct_bridge_origin.send_message` (version 2) | `row.key_binding.sign_reply(encoded)` with `encoded = json.dumps({connection_ref, frame, kid}, sort_keys, (",", ":"), ensure_ascii=False, allow_nan=False).encode()`; any exception -> `Unauthorized` | `KeyBinding.sign_reply(encoded: bytes) -> str` (64 hex) = HMAC-SHA256(material of kid, `b"wiskey-direct-reply.v2." + encoded`) - R7's recipe |
| `existing_bridge_auth.legacy_key_current` (v1 path; ImportError -> None = allowed) | `legacy_allowed(hass, entry)`; `is False` refuses the legacy key | `legacy_allowed(hass, entry) -> bool` |
| `manual_service_grants.pairing_fingerprint` | `source_fingerprint(hass, entry)` -> stored/compared, must be 64 lowercase hex; `Unavailable` -> `service_grant_pairing_changed` | `source_fingerprint(hass, entry) -> str` (64 hex) |
| `tests/ha/test_m15_direct_v2.py` (WisKey's HA test, against an Arx bridge source) | `attach(hass, entry, keyset, saver)`; `saver.control(msg)`; `saver.saved_through(kid, ts)`; `Unavailable` matching `bridge_highwater_not_persisted` | `attach(...) -> detach callable`; `Persister.control`, `Persister.saved_through`; that exact code |

Key-id and material lookup: by `kid` in the key set of each ATTACHED setup (`attach` is called by the bridge's own `async_setup_entry`
with its live `KeySet` + `Persister`, `entry.async_on_unload(...)` detaches). An attachment counts only while it is the entry's
current setup, Home Assistant still holds that entry object and its state is `loaded`. Material is read inside the module
(`KeySet._material`) and never returned; a `KeyBinding` has no attributes (its record is in a module-private weak map); reprs and
refusal texts carry only fixed codes.

Refusal codes (all mean `Unauthorized` to WisKey): `bridge_protocol_unsupported` (no `kid`: never the v1 recipe here),
`bridge_bad_format`, `bridge_key_unversioned` (`g0-legacy` on v2), `bridge_key_unknown` (no current setup verifies the kid: unknown,
retired, aborted, capped), `bridge_key_ambiguous` (two loaded entries hold the kid - PAIRING-Q2, no silent choice),
`bridge_bad_signature` / `bridge_stale` / `bridge_replay` (the key set's own `_check`), `bridge_highwater_not_persisted`,
`bridge_source_changed` (reloaded / unloaded / removed entry), `bridge_key_retired` (binding's kid no longer verifiable),
`bridge_binding_unknown`, `bridge_reply_invalid`, `bridge_pairing_unknown`.

## 3. Security rules as implemented

- **Verification** is `KeySet._check` unchanged: format, the constant-time `hmac.compare_digest` FIRST (dummy key when the kid cannot
  be used), the 60 s window, the persisted boot high-water mark, the nonce cache. v2 recipe `HMAC(material, "v2.<kid>.<ts>.<nonce>.<sha256
  canonical body>")` - the same one R7's `bridge_keys.sign_with` uses.
- **No v1 fallback**: a message without `kid` is refused before any key is touched; `g0-legacy` is refused on v2 (Arx signs v2 only with
  a rotated key, `protocol_for_key`); see question 2.
- **Replay**: WisKey owns replay inside a running process (its own 120 s nonce cache in `existing_bridge_auth`, after our call). This
  layer adds what only the bridge can do, because WisKey's own regression test requires it (`test_rotation_save_rollback_cannot_admit_unpersisted_native_highwater`):
  the nonce also enters the key set's cache, and the message is admitted only once the STORE holds a high-water mark >= its `ts`
  for its kid. After a Core restart every in-memory nonce cache is empty; the saved mark then refuses a captured message of the last
  60 s. At most one save per kid and second (a message in an already-saved second does not write).
- **Reply signing** signs only the exact canonical JSON of `{connection_ref (32 hex), frame (object), kid (= the binding's kid)}`
  (parsed, re-encoded with WisKey's settings and compared byte for byte; NaN / duplicate keys / extra fields / another kid refused), and
  only while the binding is current - not a signing oracle for other bytes or another key.
- **legacy_allowed** is True only while the entry is loaded and attached, its key set still verifies with `g0-legacy` (signing key, or
  the old/next key of an open rotation) AND the entry's pairing code equals that secret (constant-time). It is False after retire, a
  hard cut or the 180 s cap - even before the entry's copy is blanked - and for an unattached entry (fail closed). Today (rotation
  blocked while WisKey is installed) it answers True, exactly what WisKey assumed without the module.
- **source_fingerprint** = SHA-256(`"smplwise-native-source.v1|" + entry_id + "|" + legacy_fingerprint(pairing code)`); the key set
  keeps the same one-way tag after retiring the code, so the value survives key rotations of the pairing and changes on a re-pair
  (K-02). No material and not the stored tag itself.

## 4. What changed

| file | change |
|---|---|
| `custom_components/smplwise_bridge/native_keyset.py` (new) | the module above; dependency-free (no Home Assistant import; entry state read by value `"loaded"`) |
| `custom_components/smplwise_bridge/keyset.py` | `Persister` only: `persist()` under an asyncio lock (one save at a time - a second `persist()` used to return at once while the first save was still running), records the saved high-water marks; `saved_through(kid, ts)`; `control(msg, now)` = the rotation service's write-ahead step moved from `__init__.rotate` unchanged. `KeySet` untouched. |
| `custom_components/smplwise_bridge/__init__.py` | imports `native_keyset`; `entry.async_on_unload(native_keyset.attach(hass, entry, keyset, saver))` in setup; `rotate` returns `await saver.control(dict(call.data))` |
| `manifest.json`, `const.py` (VERSION + history line), `www/smplwise-card.js` | 0.10.9 |
| `smplwise_vms/integration/smplwise_bridge/` | regenerated with `py -3.12 scripts/sync_integration.py` (`--check`: up to date) |
| version pins in 19 backend test files (assertions + one comment) | 0.10.8 -> 0.10.9 (the list of CR-BRIDGE-BUMP-RATCHETS-2460) |
| `tests/test_capmap_295.py` | `REVIEWED_SUCCESSORS` row for `keyset.py` (`2193b0d7...` -> `dddf12a3...`): only the Persister changed; `_check` / `handle_control` / recipes byte-for-byte unchanged |
| `tests/test_bridge_native_keyset_2520.py` (new) | 29 tests, below |

Not touched: the add-on code (R7's files), `smplwise_vms/CHANGELOG.md` (the 2.52 release step writes it - text in 6.2), the rotation
block while WisKey is installed (`bridge_rotation`: `wiskey_present`), `management/`, main, tags, addon.

## 5. Tests (real results)

| command | where | exit | result |
|---|---|---|---|
| `.venv\Scripts\python -m pytest tests/test_bridge_native_keyset_2520.py` (repo venv, `smplwise_vms/backend`) | PC | 0 | 29 passed |
| same, one file per process: the 19 version-pin files + `test_capmap_295` | PC | see 5.1 | see 5.1 |
| `py -3.12 scripts/sync_integration.py --check` | PC | 0 | up to date |
| runner (slot B), full backend suite, frontend, Playwright | - | - | **NOT_RUN** (bridge-only change; the train gate runs them) |
| WisKey's own `tests/ha/test_m15_direct_v2.py` against this bridge | - | - | **NOT_RUN** (WisKey repository, needs its HA test harness; never run from here) |
| real Home Assistant / lab / WisKey | - | - | **NOT_RUN** by rule |

`test_bridge_native_keyset_2520.py` covers: the imported surface; **cross** - R7 `sign_connect(version=2)` and
`BridgeSigner(protocol_version=2).command_proof` verify and bind `(entry, kid)`; the bridge's `sign_reply` over WisKey's exact
`send_message` bytes (Hebrew text, a float, a nested list) equals R7 `reply_mac(version=2)` and is accepted by R7 `open_reply`; the
recipe is exactly the documented one. **Negative** - wrong kid (unknown kid; known kid with another key's material); tampered frame
(request refused by the bridge; tampered reply refused by R7); wrong recipe prefix (`.v1.`, missing dot, none; a v1-recipe request with
a kid); no kid (no v1 fallback); `g0-legacy` on v2; retired key (routine retire then hard cut: old binding's `check` and `sign_reply`
refuse, new verify refuses, the new key verifies); the 180 s cap; replay and stale; `sign_reply` strictness (10 malformed inputs);
ambiguous kid on two entries; reload / unload / removal stop old bindings and an old detach never removes a newer attachment; attach
refuses a foreign saver. **Persistence** - the mark is saved before admission and a restarted key set refuses the replay; one write
per second; a failed save refuses admission; WisKey's rollback regression (a rotation save in flight fails -> the concurrent v2
admission is refused, `saved_through` false); one save at a time; `control` rolls back like the old `rotate`. `legacy_allowed` and
`source_fingerprint` lifecycles; no material in reprs or refusals; `__init__` wiring, version 0.10.9 and identical mirror copies.

### 5.1 Existing bridge test files (one process each, PC)

Command per file: `C:\cloude\smplwisebms\.venv\Scripts\python.exe -m pytest tests/<file>.py` in `smplwise_vms/backend`, one process at a
time, on the final bytes unless noted. All exit 0 (counts: passed / skipped).

| file | result | file | result |
|---|---|---|---|
| `test_bridge_native_keyset_2520` (new) | 29 | `test_bridge_080` | 3 |
| `test_bridge_config_drift` | 13 | `test_bridge_gaps_2438` | 8 |
| `test_bridge_key_activation_295` | 30 | `test_bridge_keyrot_harness_295` (real `__init__` with stubs) | 34 |
| `test_bridge_lease_event` | 66 | `test_bridge_media_players` | 17 |
| `test_bridge_media_policy` | 49 | `test_bridge_runnable` | 110 / 1 |
| `test_bridge_runtime_2436` | 12 / 1 | `test_bridge_schedule_service` | 83 |
| `test_bridge_service_identity` | 171 | `test_bridge_stale_discovery_2383` | 32 |
| `test_bridge_stream_source` | 50 | `test_bridge_update_listener_2401` | 13 |
| `test_door_bridge_block_2404` | 21 | `test_extid_followups` | 20 |
| `test_lovelace_card` | 5 | `test_wiskey_adopt_2272_review` | 38 / 3 |
| `test_wiskey_s4_core_observer` | 30 / 1 | `test_wxh4_emergency_revoke_2407` | 22 |
| `test_capmap_295` | 65 | `test_lease_wire_closed_295` | 131 / 4 |
| `test_wiskey_direct_v2_2520` (R7) | 39 | `test_bridge_common_2440` | 22 |
| `test_bridge_preverify_2440` | 17 | `test_wiskey_native_bundle_2272` | 7 |
| `test_wiskey_managed_install_2382` | 73 | `test_wiskey_rc7_adopt_2331` | 27 / 5 |
| `test_mac_managed_auto_policy` | 5 / 3 | `test_wiskey_install_answers_2400` | 39 |

`test_bridge_common_2440` first FAILED (1 of 22: `test_the_duplicates_are_gone_from_the_modules` - `sign_reply` spelled out its own
canonical `json.dumps`); fixed by using the bridge's one `_common.canonical`, then 22 passed; `test_bridge_native_keyset_2520`,
`test_bridge_080`, `test_door_bridge_block_2404`, `test_bridge_runtime_2436` and the harness were re-run after that fix (pass). Counts
for files not re-run come from pytest's progress output of the first run (the project's `addopts = -q` hides the summary line).
`ruff check` on the changed bridge modules and the new test: see 5.2.

After a last lint-only edit (import of `collections.abc`, sorted `__slots__`, dropped unused `noqa` comments; no logic change)
`test_capmap_295` (65), `test_bridge_native_keyset_2520` (29), `test_bridge_key_activation_295` (30), `test_bridge_common_2440` (22)
and `test_bridge_080` (3) were re-run: all exit 0. The keyrot harness (34, 193 s) last ran before that lint-only edit.

### 5.2 Lint

`py -3.12 -m ruff check` on `native_keyset.py`, `keyset.py`, `test_bridge_native_keyset_2520.py`, `test_capmap_295.py`: exit 1 with 5
findings, all in `keyset.py` lines that this row did not write and that the base has too (I001, UP035, 3x UP012). `native_keyset.py`
and the new test: 0 findings. `__init__.py` keeps its base findings (unused lease imports, I001, S110); this row added none.

## 6. Install (for the lead; nothing done here)

### 6.1 Lab steps at the 2.52 install

1. Install / update the add-on as usual; `bridge_install.run_startup` copies the bundled bridge (label 0.10.8 -> 0.10.9 differs).
2. Before the restart: add-on bridge status `update_pending`, `installed_version 0.10.9`, `active_version 0.10.8`. Stop if `error`
   or `not_available`.
3. **The ONE owner-approved restart: Home Assistant Core only** (not host, not Supervisor, not the add-on).
4. After: no `smplwise_bridge` import/setup error; status `active`, `active_version 0.10.9`; directory push moves within ~60 s;
   Lovelace resource `?v=0.10.9`. WisKey readiness (only if `wiskey.auto_install` is on): the loaded distribution digest now includes
   `native_keyset.py` and matches the installed one after the restart.
5. Behaviour to expect: none visible. While rotation stays blocked with WisKey installed, every Arx connection is v1 and
   `legacy_allowed` answers True (what WisKey assumed without the module). v2 becomes live only when that block is lifted (R7 question 5).
6. Rollback: install the previous add-on; it copies 0.10.8 back (one more Core restart, a new owner approval). No data migration: the
   key store format is unchanged.

### 6.2 CHANGELOG "Install" line (bilingual, for the release step)

- גשר 0.10.9: נדרשת הפעלה מחדש אחת של מערכת הבית (באישור הבעלים) כדי לטעון אותו; אין שינוי נראה. - Bridge 0.10.9: one home-system
  restart (owner-approved) is needed to load it; nothing visible changes.

## 7. Open questions (owner; WisKey via the owner)

1. Replay at this layer: WisKey's test requires the saved high-water mark before admission (one Store write per kid and second at most).
   a) keep it (recommended; it is the only cross-restart replay guard) b) leave replay entirely to WisKey (no write; a captured frame is
   replayable within 60 s after a Core restart).
2. `g0-legacy` on v2 (the contract's kid pattern allows it). a) refuse - v2 only for rotated keys, as R7 signs (recommended) b) accept it
   with the v2 recipe.
3. `source_fingerprint` stability. a) per pairing: survives key rotations, changes on re-pair (recommended - a routine rotation does not
   void the owner's service grant) b) per key: every rotation forces a new owner grant in WisKey.
4. Tell WisKey the interface and the reply recipe this module implements (section 2). a) via the owner, with this note (recommended)
   b) ask WisKey for the Mac candidate file and diff it first.
5. `legacy_allowed` for an entry the bridge has not attached (setup not finished / failed). a) False - fail closed (recommended; the
   entry is not loaded then anyway) b) None-like "unknown" so WisKey keeps v1 as without the module.

Rollback: revert the commits; no migration, setting or data.
