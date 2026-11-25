# BRIDGE-REPAIR-LEGACY-2520 - a bridge re-pair holds on every key-store format; the bridge's own services fenced

Row of the 2.52 train (bridge 0.10.9). Branch `pilot/BRIDGE-REPAIR-LEGACY-2520`, cut from `origin/release/2520-train` at `189ec3f4a`.
Source: deep review 2.52 WISKEY-BRIDGE, findings WB-02 (high) and WB-07 (low).

The full record (findings, the 2.11.0 - 2.14.0 store format from git, the fix, the per-format table, hashes, real test results, open
questions) is section 9 of `docs/changes/WISKEY-BRIDGE-KEYSET-2520.md`, the note the WisKey hand-off cites. In short:

- `custom_components/smplwise_bridge/keyset.py`: a retired key set without the pairing tag (the store Arx 2.11.0 - 2.14.0 wrote) plus a
  code in the entry is a re-pair; `Persister.clean_entry` blanks only the retired code recognised by its saved tag (it used to blank a
  re-pair's new code - at setup for the old format, and on every format when a save ran before the reload); new `PairingFence`.
- `custom_components/smplwise_bridge/__init__.py`: execute & co., the cast origin, the lease services and `rotate` go through the fence
  (`pairing_changed`, `rotate` unsigned) - the same live "same pairing" check as `native_keyset` (unchanged byte for byte).
- Mirror regenerated (`scripts/sync_integration.py`, `--check` up to date).
- Tests: new `smplwise_vms/backend/tests/test_bridge_repair_legacy_2520.py` (13; base sources: 11 failed, fixed: 13 passed); three
  existing test files adjusted (9.6). Every bridge file of 5.1 / 8.4 run, one process each (PC + runner): all pass except
  `test_capmap_295`'s pre-existing `ha_bridge.py` drift from I18N-RUNTIME-ERRORS-2520 (not this row; question 9.8-3).
- NOT_RUN: WisKey's own harness, real Home Assistant, lab (by rule).
