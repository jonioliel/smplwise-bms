# CR-BRIDGE-RUNTIME-2436 - the bridge's import-time digest and its runtime edges (code review 2026-11-13, P1-11 / P1-12)

Branch `pilot/CR-BRIDGE-RUNTIME-2436`, cut from `origin/main` at `665ec8f24` (release 2.43.4). Plan row: `private/code-review-2026-11-13/MASTER_PLAN.md`
section 3.2 (backend, wave 1); findings: report 05, P1-11 and P1-12. Bridge `smplwise_bridge` 0.10.6 -> **0.10.7**. No add-on version bump,
no tag, no merge, no runner entry check queued here (the lead does that).

**Install note:** a bridge change means **one Home Assistant restart** at the lab install (the `bridge_update_pending` row asks for it, as for
every bridge version). That restart needs the owner's approval. Nothing was installed, loaded into a real Home Assistant or run on a device.

## 1. Findings

- **P1-11.** `__init__.py` computed the loaded distribution digest twice at import (once after the `const` import, once at the end of the
  module), both unguarded. `wiskey_distribution_digest.files()` raises `ValueError` on a symlink, a non-regular file or a missing
  `manifest.json` in the bridge folder, so one stray file stopped Home Assistant from importing the integration at all.
- **P1-12.** The setup started its directory pushes and the update listener's push with `hass.async_create_task` (not tied to the entry),
  and `async_unload_entry` could not reach the key saver (a closure of the setup). A new high-water mark waits up to 2 s for its delayed
  save (`keyset.Persister.save_soon`); an unload in that window dropped it, and the reloaded setup accepted a replay of the last message
  until the window closed.

## 2. Change (bridge 0.10.7)

Files, resolved list (the row's `I/__init__.py`, `I/keyset.py` and the mirror, plus the version files the repository convention needs):

| File | Change |
|---|---|
| `custom_components/smplwise_bridge/__init__.py` | the first digest removed; the end-of-module one now runs once through `_loaded_distribution()`, inside `try/except`, `None` on failure (one warning with the exception type only). `LOADED_BOOT_ID` / `LOADED_PROCESS_ID` unchanged. `entry.runtime_data = saver`. The setup's push and the listener's push are `entry.async_create_background_task(hass, push_directory(), "smplwise_bridge push_directory")`. `async_unload_entry` (after removing the services) awaits `saver.persist()`, best effort: a failed save is logged and the unload still returns `True`. |
| `custom_components/smplwise_bridge/const.py`, `manifest.json`, `www/smplwise-card.js` | version 0.10.7 (with its history line in `const.py`) |
| `smplwise_vms/integration/smplwise_bridge/` | regenerated with `scripts/sync_integration.py` (`--check`: up to date) |
| `I/keyset.py` | **no change needed**: `Persister.persist()` already saves only a dirty set and keeps it dirty on a failed save |

Why the version moves: `bridge_install` copies the bundled bridge only when the installed version differs (0.10.4 / 0.10.6 did the same), so
without 0.10.7 an installed 0.10.6 would never get the fix.

Deliberate limits, for the lead:

- **The native WisKey setup stays `hass.async_create_task(_async_setup_native(hass))`.** The row says "the three setup tasks"; the third is the
  native setup. An entry background task is cancelled at unload, and a bridge reload (a re-pair right after the automatic install) would then
  cancel `async_setup_component("hikvision_intercom")` half-way - another integration's setup. It already is a Home Assistant task (tracked
  by the core), and `test_wiskey_adopt_2272_contrib.py` pins that exact call.
- **The saver's own delayed save keeps `hass.async_create_task`.** Cancelling it at unload could interrupt a save that is already writing
  (the unload's `persist()` is a no-op while that save holds the set clean); left running, a late save after the flush is a no-op.
- `schedule_reload`'s fallback task (an older core without `async_schedule_reload`) is untouched: an entry task would be cancelled by the
  reload it starts.

Identical behaviour: on a clean tree the loaded digest is the same value as before (computed over the same folder; `__pycache__` / `.pyc` are
excluded by the digest). While loaded, the same pushes run at the same moments; the only differences are the cancel of a still-pending push
at unload and the one save at unload.

## 3. The reader and a `None` digest (verified)

WisKey's reader, `smplwise_vms/integration/hikvision_intercom/installation_readiness.py` (byte-exact, never edited), builds
`base["loaded"]["smplwise_bridge"] = getattr(bridge, "LOADED_DISTRIBUTION", None)` and answers `distribution_digest_mismatch` unless
`base[k] == state["expected"]` for `staged`, `installed` and `loaded`. `expected` comes from the controller projection, which
`installation_controller.component_map(..., full=True)` accepts only with 64-hex strings for both names. So a `None` loaded digest can never
equal `expected`: the reader reports "not matching", never `ready`. (A bridge module that was not imported at all already gave `None`
through the same `getattr` default.) The new test executes the real `component_map` (extracted from the file) and pins the reader's lines.

## 4. Tests

New `smplwise_vms/backend/tests/test_bridge_runtime_2436.py`, written before the fix (13 cases):

- a clean copy imports with the same digest as `digest(folder)`; a copy without `manifest.json`, and a copy whose digest raises, still import
  (`LOADED_DISTRIBUTION is None`, boot and process ids set); a stray symlink still imports (skipped on a host without the symlink privilege,
  as on this workstation); one digest call inside a `try`, bound once (both copies);
- the reader treats `None` as not matching (section 3);
- static pin on both copies: the two pushes are entry background tasks, the native setup is not, `entry.runtime_data = saver`, the unload
  persists;
- under the key-rotation harness (the real bridge): **unload flushes a dirty high-water mark** (a signed, refused `execute` sets it; the
  pending delayed save is dropped as a reload does; the store holds the mark after the unload); after a restart the replayed message is
  refused; a failed flush never fails the unload; the listener's push is an entry task.

Harness: `tests/keyrot_harness.py` `FakeEntry` gained `async_create_background_task` (queued like any task; `stop()` drops what never ran,
as Home Assistant's cancel does). Version pins 0.10.6 -> 0.10.7 in 18 test files (assertions only; signed payloads that merely carry a
version string are unchanged).

Runs (workstation, `-p no:xdist`, per file): see section 5.

## 5. Results

All on the workstation, `.venv` Python, `python -m pytest -p no:xdist -rfE tests/<file>.py`, one file per run, fakes only (no Home Assistant,
no network, no lab). Run 2026-11-13.

| File | Result |
|---|---|
| `test_bridge_runtime_2436.py` (new) | 12 passed, 1 skipped (the symlink case: no symlink privilege on this host) |
| `test_wiskey_native_bundle_2272.py` | 7 passed |
| `test_wiskey_rc7_adopt_2331.py` | 27 passed, 5 skipped |
| `test_bridge_key_activation_295.py` | 30 passed |
| `test_bridge_update_listener_2401.py` | 13 passed |
| `test_bridge_keyrot_harness_295.py` | 34 passed |
| `test_door_bridge_block_2404.py` | 21 passed |
| `test_wiskey_adopt_2272_contrib.py` | 39 passed |
| `test_wiskey_s4_core_observer.py` | 30 passed, 1 skipped |
| `test_bridge_lease_lifecycle.py` | 31 passed |
| version-pin files: `test_bridge_080` 3, `test_bridge_config_drift` 13, `test_bridge_lease_event` 66, `test_bridge_media_players` 17, `test_bridge_media_policy` 49, `test_bridge_runnable` 109 (+1 skipped), `test_bridge_schedule_service` 83, `test_bridge_service_identity` 171, `test_bridge_stale_discovery_2383` 31, `test_bridge_stream_source` 50, `test_extid_followups` 20, `test_lovelace_card` 5, `test_wiskey_adopt_2272_review` 38 (+3 skipped), `test_wxh4_emergency_revoke_2407` 22 | all passed |

`scripts/sync_integration.py --check`: up to date.

Regression proof: with the 0.10.6 `custom_components/smplwise_bridge/__init__.py` restored (new tests on the source copy), 7 of 8 selected cases
fail for the expected reasons - `ValueError: component_manifest_missing` / `component_non_regular` at import, two digest calls, the pushes
not entry tasks, no key state saved at unload (`stored_state()` is `None`), the replayed message accepted after the restart. The eighth
(a failed flush never fails the unload) passes on both, as it should. The fixed file was put back and the mirror check is clean.

NOT_RUN: the full backend suite, the runner entry check (not queued, by instruction), any real Home Assistant load of 0.10.7.

## 6. Rollback

Revert the commit and run `scripts/sync_integration.py`; the add-on then ships 0.10.6 again (one more Home Assistant restart to load it).
