# WISKEY-R8-2520 - manual service grant v3: the READ, the v3 write contract, explicit path selection (row R8)

Branch `pilot/WISKEY-R8-2520`, cut from `origin/pilot/WISKEY-R7-2520` (`d4e7d1d3c`): manual v3 builds on R7's direct v2 transport and its
`WISKEY_OWNER_ONLY` / `DIRECT_READS_V2` tables (`services/wiskey_direct_catalog.py`). Spec: section 4.2 and row R8 of
`docs/changes/WISKEY-RESYNC-2520.md`, plus WisKey's contracts (read-only checkout, commit `8c6b10208e3f`, PRODUCT `3e7bfc58`,
2.0.1-rc.19): `docs/contracts/full-management-v1/service_grants--*_v3.*`, `definitions.json` (`ManualGrantServiceRead`,
`ManualServiceGrant`), `mac-arx-resync/R2_PEOPLE_CARDS_CONTRACT.json` (`transports.selection`, `service_profiles`, `disabled_card`),
`CONSUMER_ADOPTION_DELTA.json` (R2 / C3), and the source as read (not run): `manual_service_grants.py`, `direct_bridge_api.py`,
`native_service_write_api.py`, `trusted_actions/direct_bridge_origin.py`, `direct_bridge_discovery.py`, `frontend/panel.js`.
Nothing was installed, nothing touched the lab, no grant was created anywhere, no message went to WisKey.

## Owner decisions applied (25.11, all recommendations)

- The owner-only grant actions (`service_grants/read_v3 | preview_v3 | commit_v3 | revoke_v3`) stay in WisKey's own screen. Arx never
  self-grants and never revokes over the wire: R7's `WISKEY_OWNER_ONLY` refuses them before any byte; this row adds no caller and a
  test scans the whole package so that only that refusal table names them.
- Arx only SHOWS what WisKey reports. The contract allows exactly one read for the add-on (pairing-service) identity:
  `service_grants/current_v3`, a signed direct READ in WisKey's `DIRECT_READ_COMMANDS` (always listed in direct discovery; v2 signed
  envelope with the kid; answer `ManualGrantServiceRead`). The owner's screen is WisKey's panel, tab `tools` (the
  `hikvision-service-authority` card, shown by the panel to the home-system owner only).
- A refusal is shown honestly (state `refused` + WisKey's code), never followed by another command.

## What changed

| file | change |
|---|---|
| `services/wiskey_service_grants_v3.py` (new) | The reader. `read_current` is the closed `ManualGrantServiceRead` (format, revision >= 0, status `active` / `absent_or_revoked`; `active` must carry the closed `ManualServiceGrant` - role `access_manager`, exactly the four service commands, exactly the 13 data fields, `stations` / `user_ids` empty, `allow_create` true, `expires_at` null - and `absent_or_revoked` must carry none; anything else `contract_mismatch`). `ManualGrantSource.refresh` sends ONE `service_grants/current_v3 {}` only when the direct join selects it on the current connection, the connection is v2 and its `direct/capabilities_v3` offered the `manual_service_write` v3 block; otherwise nothing is sent and the reason is kept (`direct_not_installed`, a transport refusal, `command_not_discovered`, `v3_needs_direct_v2`, `manual_v3_not_offered`, `discovery_missing`). Verified refusal -> `refused` + code (final; never `read_v3`, never an older grant source); lost answer -> `unknown`; proven not sent -> `unavailable`; an answer arriving after the connection changed -> `unknown connection_changed`. `current_grant` gives the GrantRef only from a fresh (60 s) `active` observation of the CURRENT connection; any observation (also a refusal) is kept for the window, so a refusal is not re-asked on every write. `view` = the screen's answer (no grant reference, no connection reference, `cards_granted` always false, `owner_actions_in: wiskey_owner_screen`, `owner_screen_tab: tools`, Hebrew + English text). `CARD_OFF_TEXT` = the R2 disabled-card wording (removed from the station only after sync + readback; may still be accepted until then or while offline). Registered for the per-test reset. |
| `services/wiskey_service_write.py` | `CONTRACT_V3 = wiskey-native-service-write.v3` in `CONTRACTS` (same 13 metadata keys; WisKey echoes it; an echo of another contract stays UNKNOWN). `FinalServiceWriter.from_manual_v3(join, source)`: grant = what `current_v3` reported, actor = the current connection's `arx-service:<entry>` subject (WisKey checks `actor_id` against it), contract v3. `available()` now checks the client first: an unwired writer reads nothing. Production passes no client (the service-write journal connection is still not wired, as in WISKEY-ADOPT-2272): the v3 writer is never available in production and sends nothing. |
| `services/access_service_writer.py` | `select_path(action, join)` -> `PathChoice(path, reason, writer)`: decided once, before anything is sent. `cards/add`, `cards/remove`, `users/delete` are never a service write in any contract version (`not_a_service_write_action`, also when an installed writer claims them); `users/create` / `users/update` take the service writer only when one is available, else the service channel (`direct_service_writer_missing`, unchanged). `writer_for` selects the v3 writer exactly when the current v2 connection offered the v3 block, else the v1 writer as before - never another contract in its place. |
| `services/access_grant_engine.py` | `WiskeyServiceEngine._write` uses `select_path` (selection only); a refusal / UNKNOWN on the chosen path is final (unchanged behaviour, now tested). |
| `services/wiskey_direct_join.py` | `FALLBACK_REFUSALS` emptied: a VERIFIED WisKey refusal of a native (human-path) people write is final, no classic re-send (rc19 R2 `transports.selection`: "never downgrade or switch transport automatically after refusal or UNKNOWN"). The pre-dispatch cases (`not_sent`, the native writer's own refusal before its intent) keep their classic attempt - nothing left Arx there. |
| `routers/bridge_key.py`, `wire/bridge_key.py`, `frontend/src/api/generated/wire-bridge-key.ts` | `GET /api/v1/system/bridge-key/service-grant`: the view above after one `refresh` (same gate as the other bridge-key routes: `system.configure` + system administrator, audited 403; local sessions only by the existing prefix). Model `BridgeKeyServiceGrant`; generated TS regenerated. No grant / preview / commit / revoke route. |
| `tests/test_wiskey_service_grants_v3_2520.py` (new) | 51 tests (below). |
| `tests/test_wiskey_adopt_2272_install.py` | its "unknown contract" example was v3 (now known): v4. |
| `tests/test_wiskey_join_live_2382.py` | the fallback-rule table: the three "cannot carry" refusal codes are now `False`. |
| `tests/test_remote_access.py` | the new route in the local-only list (it sits under the existing blocked `/system/bridge-key` prefix). |
| `tests/fixtures/wiskey_rc19/manual-v3/` | WisKey's synthetic examples copied unchanged (git blobs at PRODUCT: `current_v3` result valid `29463405`, wrong `fa852656`, extra `c0a5c637`, missing `d7766530`; error valid `27b07df3`, extra `bda4fb8a`, missing `2ded3315`, wrong `1eb5eda9`; signed-reply v2 valid `b4c6477c`, extra `e07f5429`, missing `95f72afe`, wrong `a37f9224`; `commit_v3` result valid `309a8b32` - the only published ACTIVE grant, used without `replay_available` as the `current_v3` active answer). No IPs, serials or secrets. |

No channel registry change (`current_v3` is a signed direct READ, not a WS channel: the R1 note's correction), no `routers/__init__.py`
or `scripts/gen_wire_types.py` change (the route extends the existing `bridge_key` family), no migration, no setting. Rollback: revert.

## Invariants kept

- No self-grant: the only grant references Arx ever sends come from WisKey's `current_v3` answer for this pairing on this connection.
- No owner action over the wire; no revoke; no fallback after a refusal (read or write); UNKNOWN stays unknown (journal unchanged, no
  replay); v3 is never card authority; a v3 grant is re-checked by WisKey on every write anyway (`lookup` in `grant`).
- The screen never receives a grant reference, a connection reference or key material.

## Tests (PC, one file at a time, repo venv; real results)

| command (in `smplwise_vms/backend`) | exit | result |
|---|---|---|
| `python -m pytest -rA tests/test_wiskey_service_grants_v3_2520.py` | 0 | 51 passed |
| `python -m pytest -q tests/test_externalbuild_297.py` | 0 | 32 passed |
| `python -m pytest -q tests/test_wiskey_mac_adopt_298.py` | 0 | 45 passed |
| `python -m pytest -q tests/test_wiskey_mac_adopt_298_review.py` | 0 | 40 passed |
| `python -m pytest -q tests/test_wiskey_adopt_2272_install.py` | 1, then 0 | first run 1 failed (its "unknown contract" example was v3, now a known contract); the example is now v4; rerun 39 passed, 2 skipped |
| `python -m pytest -q tests/test_wiskey_join_live_2382.py` | 0 | 40 passed (the fallback table with the three refusal rows now `False`) |
| `python -m pytest -q tests/test_wiskey_direct_v2_2520.py` | 0 | 39 passed |
| `python -m pytest -q tests/test_singletons_registered.py` | 0 | 4 passed |
| `python -m pytest -q tests/test_remote_access.py` | 0 | 66 passed |
| `python scripts/gen_wire_types.py --check` (repo root) | 0 | generated files match |
| `python scripts/wire_ratchet.py` | 0 | 897 unmodelled = baseline 897 (the new route is modelled) |
| `py -3.12 -m ruff check` on the changed Python files | 1 | one pre-existing F401 in `tests/test_wiskey_join_live_2382.py` (unused `ACTOR` import, present on the base too); nothing new |
| full backend suite, frontend `tsc`, Playwright | - | **NOT_RUN** (PC memory rule; runner slot B not used for this row). The train gate runs them. |
| live WisKey / lab | - | **NOT_RUN** by rule. The lab has rc10 (v1 direct connection, no v3 block): the read answers `unsupported` and sends nothing. |

## Not done here (by design)

- No UI. The route and its Hebrew / English texts are ready; rendering them (bridge-key card or the R2 status section, with the deep link
  to WisKey's `tools` tab) is a visible change that needs its compare page - question 1.
- The production service-write journal is still not wired (as since WISKEY-ADOPT-2272), so no service write - v1, v2 or v3 - can be sent
  in production; turning it on is a separate, owner-approved step (question 2).
- `contracts/API_INVENTORY.md` is regenerated by the release train (version-bound), not here.

## Open questions

1. Showing the grant: a) render it in the bridge-key card (Settings › system) next to R7's direct-transport block, with the link to
   WisKey's tools tab and the compare page, as a small follow-up row (recommended) b) in R2's access-control status section c) leave it
   API-only for now.
2. Wiring the service-write journal so a v3 write can actually be sent: a) not in 2.52 - keep every service write off until the owner
   approves a live V5 window (recommended) b) wire it now behind the existing go-live permit.
3. The human-path fallback after a verified refusal (`native_write_action_unsupported`, `native_write_source_not_observed`,
   `unknown_command`) is now final per WisKey's rc19 selection rule. a) keep it final (recommended; contract text) b) restore the
   classic re-send for these three codes and ask WisKey to confirm they are pre-effect.
4. The people screen's card label "מושבת / Deactivated" (`cards.disabled`) is a central flag, not a station claim. a) add the
   `CARD_OFF_TEXT` wording as its hint with R8's UI follow-up (recommended) b) leave the label as is.
