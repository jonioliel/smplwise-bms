# integ/2111 - integration notes (release 2.11.0, gate 2)

Branch `integ/2111`, cut from `origin/integ/2102` @ `9a8adbaf8` (DATASTORE phase 2 = migration 0136, DOORWIN = 0137, REGSTART,
BULKPEOPLE already on main). Every branch was merged with `git merge --no-ff` (no cherry-picks), one at a time, in the order below;
each provisional migration was renumbered in its own `chore(integ-2111)` commit right after its merge.

The version strings are still 2.10.0; the 2.11.0 bump, CHANGELOG and release notes belong to the release round.

## Merge order and merged heads

| # | Branch | Merged head | Merge commit | Notes |
|---|---|---|---|---|
| 1 | pilot/DOORHARD-295 | a3bd8e6fa | e53ea0cff | clean; migration renumbered |
| 2 | pilot/HMACACT-295 | 8ddaede87 | 02361bed8 | clean; migration renumbered |
| 3 | pilot/PUBCOUNT-295 | 8881a2412 | b573ca2bf | clean |
| 4 | pilot/WKV2B-295 | 284c81698 | 11f6c5025 | clean; migration renumbered |
| 5 | pilot/VENDMARK-295 | e24d97e98 | e0e68b5dd | clean; migration renumbered (test pin updated) |
| 6 | pilot/GRANTDENY-295 | 7a52798d6 | 7d1c2717b | 1 conflict; migration renumbered |
| 7 | pilot/TICKPERM-295 | 86c917e5f | cdd42289d | 1 conflict |
| 8 | pilot/SMALLFIX-295 | 84cf2b28a | 2eb3834f2 | clean |
| 9 | pilot/CLEANUP-295 | c04cb918b | bee732c02 | clean |
| 10 | pilot/FRIGLIVE-295 | 07e8a2768 | 5cfb33d32 | clean |
| 11 | pilot/DOORWIN2-295 | 98adc836b | 61bebdd6b | clean; migration renumbered |
| 12 | pilot/DOORWIN3-295 | f45d8f637 | b6caf1d44 | clean (cut from an older DOORWIN2 head; nothing to resolve) |
| 13 | pilot/MASKUI-295 | fd1edb369 | 259939ad0 | clean |
| 14 | pilot/WAPACE-295 | f3431107a | 2f3fb4484 | clean; migration renumbered. Branch still receiving commits: the rest merges later |
| 15 | pilot/HOMELIVE-295 | e589dc0c7 | 24b7d457a | 1 conflicted file (4 hunks) |
| 16 | pilot/ECCACT-295 | 7e19427e4 | 81550519a | 8 conflicted paths + 2 semantic fixes; migration renumbered. Branch still receiving commits |
| 17 | pilot/ELECNOTE-295 | 33278370b | eff5c076a | clean |

## Migration mapping

main ends at 0135; integ/2102 holds 0136 and 0137. Final sequence 0001..0145, contiguous, no duplicates. Numbers follow the merge
order; no migration depends on a later-numbered one (checked: every table a migration from 0136 on alters or reads is created
by the same or an earlier file). The SQL bodies are unchanged; only the leading provisional-number comment was rewritten.

| Branch | Old (provisional) file | New file |
|---|---|---|
| DATASTORE-295 (integ/2102) | 0132_backup_offbox.sql | 0136_backup_offbox.sql (unchanged here) |
| DOORWIN-295 (integ/2102) | 0130_door_windows_emergency.sql | 0137_door_windows_emergency.sql (unchanged here) |
| DOORHARD-295 | 0150_door_automation_hardening.sql | 0138_door_automation_hardening.sql |
| HMACACT-295 | 0136_bridge_key_activation.sql | 0139_bridge_key_activation.sql |
| WKV2B-295 | 0143_access_grants_revoke_proof.sql | 0140_access_grants_revoke_proof.sql |
| VENDMARK-295 | 0136_vendor_permanent_marker.sql | 0141_vendor_permanent_marker.sql |
| GRANTDENY-295 | 0140_asp_group_grants.sql | 0142_asp_group_grants.sql |
| DOORWIN2-295 (and DOORWIN3-295) | 0138_door_windows_events.sql | 0143_door_windows_events.sql |
| WAPACE-295 | 0150_wa_pacing.sql | 0144_wa_pacing.sql |
| ECCACT-295 | 0136_door_windows_emergency.sql (its copy of DOORWIN) | dropped: same body as 0137_door_windows_emergency.sql |
| ECCACT-295 | 0137_wiskey_peer_intents_feature_registry.sql | 0145_wiskey_peer_intents_feature_registry.sql |

References that followed the numbers:
- `tests/test_vendmark_295.py`: `MIG` file name and the header pin (`"Final number 0141"` instead of `"PROVISIONAL number 0136"`).
- `tests/test_eccact_features_295.py`, `tests/test_eccact_intents_295.py`: `MIG` paths.
- Comments / docstrings: `routers/tickets_contacts.py`, `services/access_external.py`, `services/tickets/contacts.py`,
  `services/tickets/store_links.py` (VENDMARK), `services/wa_pacing.py` (WAPACE), `services/wiskey_intents.py`,
  `services/wiskey_feature_exec.py` (ECCACT).
- Docs: `CR-AUTODOORS-295.md`, `CR-WISKEY-HMAC-ROTATION-295.md`, `CR-DOORWIN2-295-BUILD-NOTES.md`, `CR-039-DOOR-WINDOWS-AND-EMERGENCY.md`,
  `CR-WA-PACING-295.md`, `CR-WA-PACING-295-PORT-CONTRACT.md`, `CR-ECCACT-295.md`.

When the lead merges the later commits of WAPACE-295 / ECCACT-295: those branches still name the provisional files
(`0150_wa_pacing.sql`, `0137_wiskey_peer_intents_feature_registry.sql`). Git's rename detection should carry edits onto the
renumbered files; if a later commit adds a NEW migration, it takes 0146 onward.

## Conflicts and resolutions

1. GRANTDENY - `services/access_station_permissions.py` `_send_once`. GRANTDENY widened every return to a 4-tuple
   (state, code, after, person-before-write); WKV2B had added the v1 "deny in place but unverified" branches (`UNVERIFIED_CODE`)
   as 3-tuples. Kept both: the WKV2B branches return the GRANTDENY 4-tuple.
2. TICKPERM - `frontend/src/tickets/contacts-directory.ts` section header. TICKPERM gated the "new" button on `canEditStaff` for the
   employee list; VENDMARK added the permanent/temporary `markerBar()` under the header. Kept both.
3. HOMELIVE - `frontend/src/screens/devices-building.ts` (4 hunks). HOMELIVE replaced the per-widget `setInterval` polls with one
   `LiveController`; DOORWIN2 had added the doors home widget with its own `doorsTimer`. Kept HOMELIVE's controller and moved the
   doors widget onto it the same way as the generators widget: `loadDoors()` returns `noteRead('doors', ok)`, `setupLive()` registers
   a `doors` source (enabled while the widget is offered, or the tab is on and the first read failed; silent while there is no
   widget), `isStale()` counts doors, the failure panel's retry calls `live.refreshOne('doors')`, connect marks the first read,
   disconnect removes the source. No bare widget timer remains (`unit-live-refresh-295.spec.ts` pins that).
4. ECCACT - ECCACT carries its own older merge of DOORWIN-295 and WKV2-295, and a parallel implementation of "v1 never proves a
   revocation" next to WKV2B-295.
   - Migration rename/rename (0130 -> 0137 here, -> 0136 on ECCACT): kept 0137; the ECCACT copy is dropped (identical body).
   - `services/backup.py` `NEVER_EXPORTED_TABLES`: kept DOORHARD's `door_automation_fires` and ECCACT's four `wiskey_*` tables.
   - `services/access_grant_engine.py`: kept WKV2B's `_v1_status` / `revocation_pending_verdict` / `revocation_evidence_verdict`
     (boolean behaviour identical to ECCACT: a v1 answer is never False). The auto-merge had applied ECCACT's "always None" tail
     inside WKV2B's `_v1_status`, which would have stopped `revocation_evidence` from ever answering `revoked_unverified`; restored
     the clean-looking-shape `False` there. `revocation_evidence_from` gained ECCACT's `(answer, schema)` tuple unpacking (the live
     readback returns that shape). ECCACT's `station_removal_from` / `station_removal_pending` kept.
   - `services/wiskey_acr5.py` (no textual conflict, same semantic fix): `_v1_status` tail restored as above.
   - `services/access_station_permissions.py`: ECCACT's per-station `_station_removal_pending` is the deny proof (was the
     person-level `_revocation_pending`); WKV2B's `deny_unverified` branches and GRANTDENY's 4-tuples kept.
   - Tests `test_stationsync_295.py`, `test_wkpeer_295.py`, `test_wkv2_295.py`: the WKV2B versions (a superset of ECCACT's assertions).
   - `tests/test_bridge_key_rotation_295.py` permit pin: follows both branches (bridge rotation True from HMACACT; access_grants and
     capture_lease True from ECCACT).
   - Cross-branch pin without a textual conflict: `tests/test_doorwin2_review2.py` pinned `door_windows_engine.GO_LIVE_PERMITTED = False`;
     ECCACT opened it (owner decision 2026-10-21, option A; the switches still ship off), so the pin follows ECCACT.

Permits after the merge: access_grants, bulk_people, capture_lease, door_windows_engine, wiskey_acr5, wiskey_peer,
wiskey_peer_registry and bridge_rotation are True (switches default OFF); door_automation stays False.

## Checks on the workstation

- PASS: migration contiguity (0001..0145, no duplicates, no later-numbered dependency); `scripts/release_check.py` (all items ok,
  version still 2.10.0); every changed `.py` parses (133 files, no duplicate top-level / class-level definitions); the six
  conflict-touched backend modules import.
- NOT_RUN: pytest (backend), vitest / Playwright (frontend), `tsc`, the UI build, the visual matrix, a fresh-database migration run.
  The runner belongs to gate 1 and the workstation has too little free memory. Gate 2 runs them.
