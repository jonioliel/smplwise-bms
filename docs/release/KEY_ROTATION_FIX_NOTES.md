# Bridge key rotation - fixes for the harness findings K-01 .. K-07 (KEYROT-FIX-295)

Base: `pilot/KEYROT-HARNESS-295` @ 51c9355a0 (the in-process harness: the Arx engine against the REAL bridge code). Every finding has a
test that fails on 51c9355a0 and passes on this branch (`tests/test_bridge_keyrot_harness_295.py`, `..._doors_295.py`,
`tests/test_keyrot_fix_k07_dto_kid_295.py`). No migration. No live system was touched.

| Finding | Fix | Where | Tests |
|---|---|---|---|
| K-01 discovery posted the current key after a rotation | `announce_discovery` posts only a pairing code that is NOT adopted into the key set (`ensure_pairing` value while `bridge_keys.adopted()` is false); otherwise it posts nothing and returns False. A regenerate (re-pair) announces the new code again. | `services/bridge_install.py` | `test_k01_*` (3) |
| K-02 re-pair through discovery into the existing entry failed | The bridge's saved key state keeps `legacy_fp` = SHA-256 of a label + the RETIRED pairing code (written when the code is dropped). At setup, an entry code that is neither that code nor a key of the set is a new pairing: a fresh key set starts on it (`KeySet.repaired`, saved at once). The retired code left in the entry (HA-06 restart case) is still recognised and blanked. Limitation: a state retired by bridge 0.9.5 .. 0.9.8 has no `legacy_fp`; for such a bridge the re-pair stays "delete and re-add the integration". | `custom_components/smplwise_bridge/keyset.py`, `__init__.py` | `test_f6_repair_through_discovery_into_the_existing_entry`, `test_k02_a_retired_code_left_in_the_entry_is_still_blanked` |
| K-03 needs_repair past the cap could never be resumed | `Engine._status_either`: `status` under the first key; when the peer cannot verify it (unsigned refusal = `peer_bad_answer`) once more under the rotation's other key. Used by `_repair` (resume) and `_unknown_commit` (the R2 tick), so a commit whose answer was lost is recovered under K_next even past the bridge's 180 s cap. H-09 / H-05 are unchanged (the answer's signing key is still judged; aligning to K_next still needs a K_next probe). | `services/bridge_rotation.py` | `test_r2_silent_past_the_budget_needs_repair_and_resume_aligns_with_the_real_bridge`, `test_r2_status_under_k_cur_refused_past_the_cap_recovers_without_repair` |
| K-04 re-pair did not lift needs_repair | `bridge_keys.reset_set` also closes a `needs_repair` rotation (`rolled_back`, `repaired`). | `services/bridge_keys.py` | `test_repair_after_needs_repair_lifts_the_pause_and_allows_a_new_first_rotation` |
| K-05 failed bridge save left a half-committed state | `KeySet.state()` returns a real snapshot (copies of `rotation` and `hw`), so `reload(saved)` after a failed save restores the old state exactly; `reload` keeps the process's boot high-water (and the nonce cache) instead of taking the reloaded `hw` as a new boot mark (that refused the rollback's own `status` / `abort` signed in the same second). | `custom_components/smplwise_bridge/keyset.py` | `test_r2_commit_reverted_by_a_failed_bridge_save_rolls_back`, `test_k05_*` (2), `test_r1_bridge_save_fails_at_begin_*` |
| K-06 removed entry left its keys in `.storage` | `async_remove_entry` removes the entry's key Store (best effort). | `custom_components/smplwise_bridge/__init__.py` | `test_f6_repair_by_removing_and_re_adding_the_integration` |
| K-07 `kid` rejected by DTO v3 on the trusted-door path | Contract side: the v3 reference accepts the ONE optional wire field `kid` (KID format at the schema stage) and verifies signature v2 under the receiver's key set; kid-less messages and every golden vector are unchanged. The Arx wire is unchanged (owner decision 2026-10-24). | `tests/test_wiskey_golden_vectors.py` (reference), `tests/fake_trusted_bridge.py` (`keys`) | `test_keyrot_fix_k07_dto_kid_295.py`, the doors harness test |

## K-07: what the live run will show

The receiver of `door_open` is not in this repository (`trusted_door.MIN_BRIDGE_FOR_TRUSTED_PATH` is None). A receiver that verifies with
the pairing secret only refuses every door message after the first rotation - now at the signature stage (`bad_signature`), not the
schema stage. Nothing is dispatched. Expected and documented: with the trusted path on, a door test after the rotation is refused until
the receiver verifies through the bridge key set. The interim station-release path (trusted path off) is not affected.

## Release notes for the lead

- The bridge changed (keyset.py, `__init__.py`): the bridge version must be bumped at release (0.9.8 -> next), or `bridge_install` will
  not copy the fix into Home Assistant (it copies only on a version change). Pinned version tests (`test_bridge_080`,
  `test_bridge_config_drift`) move with the bump.
- `test_bridge_key_activation_295.test_ha04_*` now expects three `saver.save_soon()` calls (the K-02 save).
