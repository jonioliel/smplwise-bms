# WISKEY-BRIDGE-KEYSET-2520 - bridge 0.10.9: `smplwise_bridge.native_keyset`, the key-set binding WisKey's direct v2 needs

Branch `pilot/WISKEY-BRIDGE-KEYSET-2520`, cut from `origin/pilot/WISKEY-R7-2520` (`d4e7d1d3c`). Target version: 2.52.
Origin: R7 open question 1 (`docs/changes/WISKEY-DIRECT-V2-2520.md` section 5), answered with its recommendation (a).
Status: implemented and unit-tested against fakes and Arx's own v2 signer. **Nothing installed, no lab, no Home Assistant, no WisKey
contact.** Installing 0.10.9 needs **one owner-approved Home Assistant Core restart** (custom integrations load only at Core start);
no install and no restart were done here.

**Update 25.11 (row WISKEY-BRIDGE-REPAIR-2520, section 8):** WisKey's acceptance on `8e412b0c0` found two real FAILs on a re-pair
before detach / reload; fixed in this same module (the old pairing is refused at once, `bridge_pairing_changed`). Sections 2-4 are
updated for it; the original FAILs and the new receipts are in section 8.

**Update 25.11 (row BRIDGE-REPAIR-LEGACY-2520, section 9):** deep review 2.52 WB-02 (high) and WB-07 (low). A re-pair now holds on
every key-store format the bridge can load (the tag-less 2.11.0 - 2.14.0 format included, and a save between the re-pair's entry write
and the reload no longer undoes it), and the bridge's own signed services refuse the old pairing at once (`pairing_changed`).
`keyset.py` and `__init__.py` changed; `native_keyset.py` is byte for byte unchanged. Hashes in 9.5.

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
`bridge_source_changed` (reloaded / unloaded / removed entry), `bridge_pairing_changed` (the entry's pairing code changed - a
re-pair - and the old setup is not reloaded yet; section 8), `bridge_key_retired` (binding's kid no longer verifiable),
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
- **Re-pair before reload** (section 8): every call reads the entry's pairing code live and compares it with the attached key set's
  pairing (`_same_pairing`): the secret while the key set holds it; after retirement the bridge's own blank (HA-06) or the retired
  code (by the key set's one-way `legacy_fp` tag). Anything else - a new code, a blank the bridge did not write, a non-string,
  unreadable data - voids the old setup at once: `verify` refuses every kid of the old key set (before the key set's check, so no
  nonce or high-water write), open bindings refuse `check()` / `sign_reply`, `source_fingerprint` raises and `legacy_allowed` is
  False. Only the new setup that the update listener's reload attaches serves the new pairing.

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
| `tests/test_bridge_native_keyset_2520.py` (new) | 29 tests, below; +3 for the re-pair fix (section 8) = 32 |
| `native_keyset.py` again (WISKEY-BRIDGE-REPAIR-2520) | `_same_pairing`, checked in `verify`, `_record` (binding `check` / `sign_reply`) and `_attached` (`legacy_allowed`, `source_fingerprint`); new code `bridge_pairing_changed`; docstrings. Nothing else in the bridge changed. |
| `keyset.py`, `__init__.py` (BRIDGE-REPAIR-LEGACY-2520, section 9) | K-02 re-pair rule for a tag-less retired state; `Persister.clean_entry` blanks only the tag-recognised retired code; `PairingFence` in front of the bridge's own signed services and `rotate`. `native_keyset.py` unchanged. |

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

## 8. WISKEY-BRIDGE-REPAIR-2520 (25.11): re-pair before detach / reload

### 8.1 The finding (record kept; WisKey's receipts, read only)

WisKey handoff commit `57e4615e0b943638b7e6cdcd4565c183e559483e`, folder `docs/owner-development-2026-11-25/mac-arx-adoption/`
(`FORWARD_TO_ARX_HE.txt` 2.1 / 2.3, `TEST_RESULTS_HE.txt`, `evidence/RUN_INDEX.json`). WisKey PRODUCT rc20
`dcebb9f34c8f95638e498115a2aeb5ce2711981e`; bridge tested = this branch at `8e412b0c09e1f1e456c9ad2110ec8d964d706fe2`
(`native_keyset.py` 13338 bytes, sha256 `0ec0d2b6458235ae0e2d2f3fc73a502c521a0a263fadfb1562458e065d972478`, both copies - re-checked
here byte for byte).

| WisKey run | CODE | exit | result |
|---|---|---|---|
| `ARX-REPAIR-ACCEPTANCE` | rc19 `3e7bfc58` | 2 | 1 ERROR (recipe namespace; not a finding) |
| `ARX-REPAIR-ACCEPTANCE-02` | rc19 `3e7bfc58` | 1 | **2 FAIL** |
| `FINAL-ARX-REPAIR` | rc20 `dcebb9f3` | 1 | **2 FAIL** (`tests/ha/test_arx_pairing_gap.py`, real HA test harness) |

The two FAILs (both runs identical):

1. `test_repairing_cannot_keep_previous_pairing_fingerprint` - `async_update_entry(entry, data={"pairing_code": <new>})`, no detach, no
   reload; `source_fingerprint` must raise `Unavailable`: **DID NOT RAISE** (it answered the OLD pairing's value - the key set still held
   the old secret and the function never looked at the entry's code).
2. `test_old_key_cannot_open_new_v2_socket_during_repair` - same change; R7's `DirectApiTransport.connect` with the OLD rotated key over
   WisKey's real `PATH_V2` must raise `MediaBridgeError`: **DID NOT RAISE** (`verify` found the kid in the still-attached old key set).

The fixture's key set had a routine rotation begun and committed, not retired (`g0-legacy` still the old key, `g1-01234567` signing).
WisKey's other results at the same bridge stay as WisKey reported them (FINAL-RC20-NEW-BRIDGE 42 PASS; the 29 original tests of this
note passed there against fakes); nothing of those is re-claimed here.

### 8.2 The fix (same module, nothing else in the bridge)

`native_keyset._same_pairing(entry, keyset)`, read live on every call (section 3, "Re-pair before reload"), in `verify` (after the kid
lookup and the ambiguity check, BEFORE `KeySet._check`: no nonce enters the cache and no high-water mark is saved for a voided pairing),
in `_record` (every binding `check()` - WisKey's 0.25 s socket watcher - and `sign_reply`) and in `_attached` (`source_fingerprint`,
`legacy_allowed`). Refusal code `bridge_pairing_changed` (WisKey maps it to `Unauthorized` like every other code).

Unchanged: the verifier (`KeySet._check`, untouched; `keyset.py` not edited in this row), the request and reply recipes, every earlier
refusal and its order, the persistence rule, `__init__.py`. Not done (by the constraints of WisKey and the owner): no replacement
verifier, no stub, the historical module (`source/HISTORICAL_native_keyset_5610.py`, sha256 `ad9f3221...`) NOT adopted and not copied
from (it was not read for this fix), no fail-closed rule weakened, no test edited to hide the finding. The three policy choices WisKey
accepted stay: `g0-legacy` refused on v2; the fingerprint is per pairing and stable across rotation; an unattached entry refuses legacy.

Design notes:
- The comparison is stateless (not a latch): writing the pairing's own value back before the reload makes the old setup current again -
  it IS the same pairing. Every pairing-field change also schedules the reload (`entry_updated`, 0.10.4), which replaces the setup.
- A blank written by anyone while the key set still holds the secret (before the first retirement) is a change - fail closed. The only
  blank the bridge writes comes after the retirement was saved (HA-06), and that one stays current.
- Cost of the 0.25 s check: one constant-time compare; one SHA-256 only in the short window after a retirement while the entry still
  holds the retired code.

**Fingerprint algorithm vs the historical module (WisKey 2.3 (b)).** `source_fingerprint` here is
SHA-256(`"smplwise-native-source.v1|" + entry_id + "|" + legacy_tag`); the historical Mac-assembled module returned the legacy tag
itself. The two values therefore differ: a WisKey service grant recorded against a historical fingerprint does not match this bridge
and is not effective. This row adds **no migration, no grant, no rebind and no revoke** (nothing silent); if a re-approval is ever
needed it is an explicit, separate action of the Home Assistant owner in WisKey.

### 8.3 Tests (real results, 25.11)

| command | where | exit | result |
|---|---|---|---|
| `C:\cloude\smplwisebms\.venv\Scripts\python.exe -m pytest tests/test_bridge_native_keyset_2520.py -p no:cacheprovider --junitxml <scratch>` (`smplwise_vms/backend`) with the 3 new tests, source still `8e412b0c0` | PC | 1 | **3 failed / 29 passed** - the two ported acceptance tests fail exactly as WisKey's did (`DID NOT RAISE Unavailable`; `DID NOT RAISE MediaBridgeError`, after its positive control connected), plus the lifecycle test |
| same, after the fix (`82a335a93`) | PC | 0 | **32 passed** |
| `py -3.12 scripts/sync_integration.py`, then `--check` | PC | 0 / 0 | mirrored 35 files; "integration mirror is up to date" |
| `py -3.12 -m ruff check` on `native_keyset.py` and the test file | PC | 0 | All checks passed |
| 23 bridge files of 5.1, one pytest process each, sequential | PC | 0 each | 8.4 |
| 9 heavier bridge files, one pytest process each, via `~/work/slotb.sh` | runner | 0 each | 8.4 |
| WisKey's own recipe (`FINAL-ARX-REPAIR` overlay `tests/ha/test_arx_pairing_gap.py` + rc20 source) against the fixed bridge | - | - | **NOT_RUN**: it needs Home Assistant Core and `pytest-homeassistant-custom-component` (WisKey's Mac env: Python 3.14.2, Core 2026.10.4, plugin 0.13.375); neither the PC venv nor the runner venv has them (`find_spec` is False for both modules on both), and installing them is outside this row (no installs). The two scenarios are ported instead (rows 1-2). |
| real Home Assistant / lab / WisKey | - | - | **NOT_RUN** by rule |

Ported tests in `test_bridge_native_keyset_2520.py`:
- `test_wiskey_acceptance_a_a_re_pair_before_reload_voids_the_previous_pairing_fingerprint` (WisKey FAIL 1) - WisKey's fixture shape
  (begin + commit, not retired), the entry's code changed with the attachment left in place -> `bridge_pairing_changed`;
  `legacy_allowed` False.
- `test_wiskey_acceptance_b_the_old_key_cannot_open_a_new_v2_socket_during_a_re_pair` (WisKey FAIL 2) - Arx's own R7
  `DirectApiTransport` (its v1 opener asserts it is never used) against a fake WisKey v2 socket whose connect calls
  `native_keyset.verify` and signs the identity reply with `binding.sign_reply`; a positive control connects first; after the change
  `connect` raises `MediaBridgeError`, the server saw `bridge_pairing_changed`, no store write happened, and the binding of the earlier
  socket refuses `check()` and `sign_reply`.
- `test_the_bridges_own_pairing_states_stay_current_and_any_other_code_is_refused` - retired and blanked by the bridge, and the retired
  code left in the entry (HA-06), stay current with the same fingerprint; a new code, a padded code, a non-string and unreadable data
  are refused; a blank before the first retirement is refused.

### 8.4 Bridge test files at the fixed head `82a335a93`

PC - command per file: `C:\cloude\smplwisebms\.venv\Scripts\python.exe -m pytest tests/<file>.py -p no:cacheprovider -q --tb=short
--junitxml <scratch>` in `smplwise_vms/backend`, one process at a time. Counts from each junit file (tests / skipped; 0 failures and
0 errors in every file). All exit 0.

| file | tests / skipped | file | tests / skipped |
|---|---|---|---|
| `test_bridge_080` | 3 | `test_bridge_config_drift` | 13 |
| `test_bridge_gaps_2438` | 8 | `test_bridge_key_activation_295` | 30 |
| `test_bridge_media_players` | 17 | `test_bridge_media_policy` | 49 |
| `test_bridge_runtime_2436` | 13 / 1 | `test_bridge_stale_discovery_2383` | 32 |
| `test_bridge_stream_source` | 50 | `test_bridge_update_listener_2401` | 13 |
| `test_door_bridge_block_2404` | 21 | `test_extid_followups` | 20 |
| `test_lovelace_card` | 5 | `test_wiskey_adopt_2272_review` | 41 / 3 |
| `test_wiskey_s4_core_observer` | 31 / 1 | `test_wxh4_emergency_revoke_2407` | 22 |
| `test_capmap_295` | 65 | `test_bridge_common_2440` | 22 |
| `test_bridge_preverify_2440` | 17 | `test_wiskey_native_bundle_2272` | 7 |
| `test_wiskey_rc7_adopt_2331` | 32 / 5 | `test_mac_managed_auto_policy` | 8 / 3 |
| `test_wiskey_install_answers_2400` | 39 | | |

(Junit `tests` counts include skipped ones, so a few differ from the passed / skipped pairs of 5.1.)

Runner (slot B, `~/smplwisebms/.venv/bin/python -m pytest tests/<file>.py -p no:cacheprovider -q --tb=short --junitxml ...` in a
worktree at `82a335a93`, one process per file, sequential). All exit 0, 0 failures, 0 errors.

| file | tests / skipped | time | file | tests / skipped | time |
|---|---|---|---|---|---|
| `test_bridge_keyrot_harness_295` | 34 | 138 s | `test_lease_wire_closed_295` | 135 / 4 | 28 s |
| `test_bridge_service_identity` | 171 | 4 s | `test_bridge_runnable` | 111 / 1 | 4 s |
| `test_wiskey_managed_install_2382` | 73 | 160 s | `test_bridge_schedule_service` | 83 | 5 s |
| `test_bridge_lease_event` | 66 | 4 s | `test_bridge_native_keyset_2520` | 32 | 4 s |
| `test_wiskey_direct_v2_2520` (R7) | 39 | 14 s | | | |

Together with the PC table this covers every file of 5.1 (32 files), each in its own process.

### 8.5 Open question

1. Tell WisKey the fix through the owner (new head SHA, both copies' hashes, refusal code `bridge_pairing_changed`) and ask them to
   re-run `FINAL-ARX-REPAIR` and `test_m15_direct_v2` against it. a) yes, via the owner (recommended - only their harness runs the real
   Home Assistant path) b) wait for the 2.52 train first.

## 9. BRIDGE-REPAIR-LEGACY-2520 (25.11): a re-pair holds on every store format; the bridge's own services fenced (WB-02, WB-07)

Branch `pilot/BRIDGE-REPAIR-LEGACY-2520`, cut from `origin/release/2520-train` at `189ec3f4a` (contains 0.10.9 with the re-pair fix
of section 8). Source: deep review 2.52, area WISKEY-BRIDGE (`origin/review/DEEP-2520-WISKEY-BRIDGE` `1f8045720`,
`docs/review/DEEP-REVIEW-2520-WISKEY-BRIDGE.md`), findings WB-02 (high) and WB-07 (low). Nothing installed, no lab, no Home Assistant,
no WisKey contact.

### 9.1 The findings

- **WB-02.** `KeySet.__init__` recognised a new pairing code (K-02) only against the one-way tag of the retired code (`legacy_fp`). That
  tag exists since 2.15.0 (KEYROT-FIX-295, `1213e264b`). A bridge whose first rotation was saved by Arx 2.11.0 - 2.14.0 holds
  `legacy_retired: true` without a tag, forever. On it a re-pair went: entry updated -> reload -> `KeySet(new code, state)` not
  `repaired` -> `Persister.clean_entry()` **blanked the new code** -> `native_keyset._same_pairing` saw a blank entry and a retired
  key set = "same pairing" -> the old rotated key verified again, for the bridge's own services and for WisKey v2.
- **Found while fixing, same root (every store format):** `clean_entry()` blanked ANY code while the saved state was retired, and it
  also runs after every successful save. A save between the re-pair's entry write and the reload (the 2 s delayed high-water save, or
  the unload's flush of 0.10.7) therefore blanked the new code on a TAGGED store too; the listener then saw "no new pairing" (or the
  reload saw a blank entry) and the old key set stayed. Shown on the base `keyset.py` by a read-only probe (9.6): tagged retired
  state, entry blank, a new code written, one pending save -> base: "entry BLANKED, reloaded setup repaired False, old key still in
  the set"; fixed: "kept, repaired True, old key gone".
- **WB-07.** The 25.11 fence (`_same_pairing`) covered `native_keyset` only; execute / schedule / stream_source / media_query /
  cast_stream / config_item (through `service_identity.screen`), the cast origin of the directory answer, the two lease services and
  `rotate` verified with the bare key set until the reload ran.

### 9.2 The store as 2.11.0 - 2.14.0 wrote it (from git, not from memory)

`git log -S legacy_fp -- custom_components/smplwise_bridge/keyset.py` -> `1213e264b` (first tag: v2.15.0). The released blobs before it:

| `keyset.py` blob | releases | `state()` |
|---|---|---|
| `d09a74be5b01e728e5b21a6c2a5df89e7ddae9a9` | v2.11.0, v2.11.1, v2.12.0, v2.12.1 | `{v: 1, signing, keys, old, next, legacy_retired, rotation, hw}` - no `legacy_fp` |
| `01bc6c381d35d984bae97d59c74e4a412b6f0de0` | v2.12.2, v2.12.3, v2.12.4, v2.14.0 | the same keys (adds the Persister / `clean_entry`, HA-06) |

Both blobs, driven through a real begin / commit (/ retire) with synthetic keys, write the same JSON; the test fixture
(`LEGACY_STATES`, routine and hard cut) is that output, and `test_the_fixture_is_what_2_11_0_to_2_14_0_wrote` re-runs both blobs from
git (`git cat-file -p <blob>`) and compares key by key, in order (skipped only when git or the blob is not available).

### 9.3 The fix

| where | change |
|---|---|
| `keyset.KeySet.__init__` | The K-02 rule also fires when the retired state has **no valid tag** (the old format, or a damaged / non-hex tag): a non-empty string code in the entry that is not a key of the set is a new pairing -> a fresh key set on it (`repaired`), saved in today's format at setup. A non-string entry value never re-pairs (and no longer reaches `legacy_fingerprint`). |
| `keyset.Persister.clean_entry` | Blanks the entry's code only when the SAVED state is retired AND the code is that retired code, recognised by the SAVED tag (`_saved_fp`, kept like `_saved_retired`). A new code, a non-string, a stored key's material, or anything without a tag is never blanked. HA-06 itself (the retired code left by a restart between the two writes) is unchanged. |
| `keyset.PairingFence` (new) + `__init__.async_setup_entry` | `verifier = PairingFence(keyset, lambda: native_keyset._same_pairing(entry, keyset))` - the one definition of "same pairing", read live. `verify()` answers `pairing_changed` BEFORE the key set's check (no nonce cached, no high-water mark, no save) when the entry carries another pairing; `verifiable()` is empty then; a predicate that raises counts as changed. Used by `service_identity.screen` (all screened services), `note_origin` (cast origin) and the lease services; `rotate` refuses `{"ok": false, "code": "pairing_changed"}` UNSIGNED before `Persister.control` (HA-01). Stateless: the same pairing written back is current again. |

What each path answers for an old pairing before the reload: screened services `{"ok": false, "request_id": ..., "error":
"pairing_changed"}`; `rotate` the unsigned refusal above; the lease services the contract's own `signature / bad_signature` (its code
set is closed); the cast origin is ignored (stays unknown); WisKey v2 `bridge_pairing_changed` (section 8, unchanged).

Unchanged: `native_keyset.py` (byte for byte - the same hash as at `82a335a93`), the verifier (`KeySet._check`, `verify`, `sign`,
`handle_control` and the rotation ops), the v1 / v2 / reply recipes, every refusal and its order, the persistence rule, WisKey's
accepted policy choices (`g0-legacy` refused on v2, fingerprint per pairing, an unattached entry refuses legacy). No stub, no second
verifier, no rewrite of a stored state: a tag-less store is interpreted as it is until a re-pair replaces it.

### 9.4 Every store format the bridge can load, and what a setup does with it

| stored state | entry's pairing code | before | now |
|---|---|---|---|
| none / another `v` | any | fresh key set on the code | same |
| not retired (no rotation yet, or one open) | the pairing code | the code is `g0-legacy` | same |
| retired, tag (2.15.0+) | blank (the bridge's own HA-06 wipe) | same pairing, rotated keys | same |
| retired, tag | the retired code (HA-06 leftover) | blanked, same pairing | same |
| retired, tag | a new code | re-pair at setup; **undone** when a save ran before the reload | re-pair; a save never blanks the new code |
| retired, **no tag** (2.11.0 - 2.14.0) | blank | same pairing; `source_fingerprint` -> `bridge_pairing_unknown` | same |
| retired, **no tag** | a new code | **code blanked, the old key verifies again** (WB-02) | re-pair: fresh key set, old keys dead everywhere |
| retired, damaged / non-hex tag | a code | as "no tag" (WB-02) | as "no tag": re-pair |
| retired, any | not a string, or a stored key's own material | blanked -> old keys verified | not blanked; nothing of the old set verifies (fail closed) until a real re-pair |

The one case given up (documented in the code): a tag-less store whose retired code is STILL in the entry - an HA-06 leftover of
2.11.0 - 2.12.1 that no setup on 2.12.2 or later ever saw (a bridge that jumps from 2.12.1 or older straight to 0.10.9 with it). It is
read as a re-pair: the old rotated keys are dropped, the add-on (signing with the rotated key) is refused, and the owner pairs again.
Availability only - never an old key - and no setup since 2.12.2 can leave this state behind.

### 9.5 Hashes (sha256; both copies identical: `py -3.12 scripts/sync_integration.py`, then `--check`: "integration mirror is up to date")

| file | sha256 (`custom_components/smplwise_bridge/` = `smplwise_vms/integration/smplwise_bridge/`) |
|---|---|
| `native_keyset.py` | `5fda54de2f2caffe78bb32d4bddce2784d607f285be48f3e6eedc500bc97d1df` (unchanged by this row) |
| `keyset.py` | `05d6458f4fc8843121c4a6d003191d825a17724f042ceddccb4c43021bb005c4` (was `dddf12a3...`) |
| `__init__.py` | `4b497464e7f27a4edd02a0d3f1338d951d864428644c6908a061164856d86fe1` |

WisKey's distribution digest of the bridge changes with `keyset.py` / `__init__.py`. The bridge label stays 0.10.9: this ships with the
first 0.10.9 release; no 0.10.9 was ever installed.

### 9.6 Tests (real results, 25.11)

New file `tests/test_bridge_repair_legacy_2520.py` (13 tests): the fixture's provenance from git (2); a legacy store + a new code at
setup is a re-pair - old key dead in the key set / fence / rotation service / native verify, new pairing live, saved in today's
format, survives a restart (routine, hard cut); the review's probe end to end - today's legacy bridge works, the re-pair voids it at
once, a save before the reload does not blank, the reload is the new pairing (routine, hard cut); the tagged-store save race; damaged
tags and odd entry values fail closed; the fence is checked before the key set and is stateless (+ the lease contract's verdict); the
`__init__` wiring on both copies; and on the REAL `async_setup_entry` (key-rotation harness): a legacy store + a re-paired entry
(routine, hard cut), and WB-07 + the save race (execute / rotate with the old key refused before the reload, the queued save keeps the
new code, the listener schedules the reload, the reloaded setup is the new pairing).

Existing tests changed (a spec change, not hiding a finding): `test_bridge_key_activation_295::test_ha06_...` - the HA-06 state now
carries its tag (a tag-less state + a code is a re-pair; asserted in the same test); `test_bridge_lease_event` - `LEGACY_SIGNING_STATE`
carries the tag of the code the tests hand in (it models the HA-06 leftover), and the wiring pin names `verifier`; `test_capmap_295` -
the reviewed successor row for `keyset.py` (`dddf12a3...` -> `05d6458f...`).

| command | where | exit | result |
|---|---|---|---|
| `C:\cloude\smplwisebms\.venv\Scripts\python.exe -m pytest tests/test_bridge_repair_legacy_2520.py -p no:cacheprovider -q --tb=line --junitxml <scratch>` (`smplwise_vms/backend`) with the BASE `keyset.py` / `__init__.py` (fail first) | PC | 1 | **11 failed / 2 passed** (the provenance tests): the real-setup tests fail exactly on WB-02 ("the setup took the re-pair and did not blank the code") and WB-07 (`service_not_allowed` where `pairing_changed` is due); the fake-level tests fail on the missing fence class |
| same, fixed sources | PC | 0 | 13 passed (junit: 13 tests, 0 skipped, 101 s) |
| `py -3.12 -I <scratch>/probe_race.py` (the tagged-store save race, `Persister` + `KeySet` only) against `keyset.py` of `189ec3f4a`, then of this branch | PC | 0 / 0 | base: entry blanked, reloaded setup not repaired, old key kept; fixed: entry kept, repaired, old key gone |
| same command, `test_bridge_native_keyset_2520.py` | PC | 0 | 32 passed |
| same command, `test_bridge_key_activation_295.py` | PC | 0 | 30 passed |
| same command, `test_capmap_295.py` | PC | 1 | **64 passed / 1 FAILED - pre-existing, not this row**: `test_the_receiver_source_is_the_one_the_vectors_were_made_from` fails on `smplwise_vms/backend/smplwise/services/ha_bridge.py` (sha `3a7ee1f8...`, changed by I18N-RUNTIME-ERRORS-2520 `33e121b63` on the train without a reviewed successor row; the same file on the base `189ec3f4a`). The `keyset.py` chain with this row's successor, checked on its own: OK. |
| `py -3.12 scripts/sync_integration.py`, then `--check` | PC | 0 / 0 | mirrored 35 files; up to date |
| `py -3.12 -m ruff check` on the new test file | PC | 0 | All checks passed |
| `py -3.12 -m ruff check` on `keyset.py`, `__init__.py` | PC | 1 | 16 findings, the same 16 as on the base (none in lines this row wrote) |
| same PC command, one process per file, sequential, at `ec104d249` (junit tests / skipped; 0 failures, 0 errors each): `test_bridge_lease_event` 66, `test_bridge_080` 3, `test_bridge_config_drift` 13, `test_bridge_gaps_2438` 8, `test_bridge_media_players` 17, `test_bridge_media_policy` 49, `test_bridge_runtime_2436` 13 / 1, `test_bridge_stale_discovery_2383` 32, `test_bridge_stream_source` 50, `test_bridge_update_listener_2401` 13, `test_door_bridge_block_2404` 21, `test_extid_followups` 20, `test_lovelace_card` 5, `test_bridge_common_2440` 22, `test_bridge_preverify_2440` 17, `test_bridge_cast_policy` 29, `test_bridge_service_identity` 171, `test_wiskey_adopt_2272_review` 41 / 3, `test_wiskey_s4_core_observer` 31 / 1, `test_wxh4_emergency_revoke_2407` 22, `test_wiskey_native_bundle_2272` 7, `test_wiskey_rc7_adopt_2331` 32 / 5, `test_mac_managed_auto_policy` 8 / 3, `test_wiskey_install_answers_2400` 39 | PC | 0 each | all pass (24 files) |
| `~/smplwisebms/.venv/bin/python -m pytest tests/<file>.py -p no:cacheprovider -q --tb=short --junitxml ...` (job `~/work/p2520_bridgelegacy_run.sh` via `~/work/slotb.sh`, a detached worktree at `ec104d249`, one process per file, sequential): `test_bridge_repair_legacy_2520` 13 (provenance tests ran, 0 skipped), `test_bridge_native_keyset_2520` 32, `test_bridge_keyrot_harness_295` 34 (240 s), `test_lease_wire_closed_295` 135 / 4, `test_bridge_runnable` 111 / 1, `test_wiskey_managed_install_2382` 73 (140 s), `test_bridge_schedule_service` 83, `test_wiskey_direct_v2_2520` 39 | runner | 0 each | all pass |
| same job, `test_capmap_295` | runner | 1 | 64 / 1 FAILED - the same pre-existing `ha_bridge.py` drift as on the PC (not this row) |
| WisKey's `FINAL-ARX-REPAIR` / `test_m15_direct_v2` against this head | - | - | **NOT_RUN** (WisKey's harness; see 8.3) |
| real Home Assistant / lab / WisKey | - | - | **NOT_RUN** by rule |

### 9.7 Install / lab

No new step: the same bridge 0.10.9 and the same one owner-approved Core restart as 6.1. No data migration: a tag-less store keeps
working as it is (entry blank) and is replaced by today's format only by the next re-pair. The review's interim advice (check the lab's
key store for `legacy_retired` without `legacy_fp` before any re-pair, read only) still applies while the lab runs bridge 0.10.8; it is
not needed once 0.10.9 with this fix is loaded.

### 9.8 Open questions

1. Tell WisKey through the owner: `keyset.py` / `__init__.py` hashes changed (9.5), `native_keyset.py` unchanged, the bridge's own
   services now refuse `pairing_changed`. a) in the consolidated WisKey hand-off, citing this section (recommended) b) a separate note now.
2. The tag-less HA-06 leftover of a direct jump from 2.12.1 or older (9.4, last paragraph). a) read it as a re-pair - old keys dropped,
   the owner pairs again (recommended; fail closed for the keys) b) refuse everything until the owner deletes and re-adds the integration.
3. `test_capmap_295` is red on the train (`ha_bridge.py` after I18N-RUNTIME-ERRORS-2520). a) the train lead reviews that change into
   `REVIEWED_SUCCESSORS` (recommended - it is that row's file) b) this row adds it.

Together the PC and runner tables cover every file of 5.1 / 8.4 (32 files) plus `test_bridge_cast_policy` and the new file, each in
its own process, all at `ec104d249` (the fix commit; the commit after it changes only this note).
