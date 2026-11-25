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
| `services/wiskey_direct_join.py` | Lead decision 25.11 (Q3): a VERIFIED WisKey refusal of a native (human-path) people write is final ON A V2 DIRECT CONNECTION only (rc19 R2 `transports.selection`: "never downgrade or switch transport automatically after refusal or UNKNOWN"). On v1 (WisKey rc10, the lab today) the classic fallback for the three "cannot carry" codes (`native_write_action_unsupported`, `native_write_source_not_observed`, `unknown_command`) stays exactly as before. `fallback_permitted(state, code, *, protocol_version=1)`; `people_send` reads the join's connection protocol before and after the write (`_protocol_version`, no I/O) and treats the write as v2 when either side saw v2. The pre-dispatch cases (`not_sent`, the native writer's own refusal before its intent) are unchanged on both. |
| `routers/bridge_key.py`, `wire/bridge_key.py`, `frontend/src/api/generated/wire-bridge-key.ts` | `GET /api/v1/system/bridge-key/service-grant`: the view above after one `refresh` (same gate as the other bridge-key routes: `system.configure` + system administrator, audited 403; local sessions only by the existing prefix). Model `BridgeKeyServiceGrant`; generated TS regenerated. No grant / preview / commit / revoke route. |
| `tests/test_wiskey_service_grants_v3_2520.py` (new) | 58 tests (below), incl. the fallback rule on v1 / v2 (table) and end to end over the fake direct server of `test_wiskey_join_live_2382` (each "cannot carry" code: classic once on v1, final on v2, the native frame sent once). |
| `frontend/src/components/sw-bridge-key-card.ts`, `frontend/src/api/bridge-key.ts`, `frontend/src/i18n/bridge-key.ts` + `lang/{en,ar,ru}` | Lead decision Q1 a: the Bridge key card (Settings › Connections, system administrator, local only) shows "הרשאת שירות מ־WisKey" read only: a state badge, one plain sentence per state (active / none / refused with WisKey's code / unknown / unsupported / unavailable), the approved actions and "cards are not included" only when active, and the pointer "only the system owner gives or withdraws it, in WisKey's tools screen" with a link to the panel's tools page (`targetHref({tab: 'tools'})` from the deep-link helpers, shown only to a caller who may open the panel). One GET per visit (never polled); 403 / 404 hide the block (an older server); a server error is said as unknown; an answer this client does not know is `unknown`. Existing components (`sw-badge`, the card's rows and notes) and tokens only; no button, no new literal colour or size, no scrolling. Arabic / Russian columns are an initial translation (dev-marked, as the rest of the card). |
| `frontend/src/screens/wiskey-person-actions.ts`, `frontend/src/i18n/access-writes.ts` (+ en) | Lead decision Q4 a: the "מושבת / Deactivated" card label gets the R2 wording as its hint (`title`): removed from the station only after sync and readback; until then, or while the station is offline, it may still be accepted. No layout change. |
| `frontend/tests/unit-bridge-key.spec.ts` (+3), `frontend/tests/evidence-wiskey-r8-2520.spec.ts` (new), `frontend/tests/pixel-wiskey-r8-2520.spec.ts` (new, baselines made on the runner) | state mapping, texts in four languages, no grant / revoke call; every state he / en, light / dark, desktop / phone, no button in the block, one GET only, no sideways scroll, 403 / 404 hidden, 500 unknown; pixel baselines of the active and refused block (classic, domus; 1440 and 390). |
| `tests/test_wiskey_adopt_2272_install.py` | its "unknown contract" example was v3 (now known): v4. |
| `tests/test_remote_access.py` | the new route in the local-only list (it sits under the existing blocked `/system/bridge-key` prefix). |
| `tests/fixtures/wiskey_rc19/manual-v3/` | WisKey's synthetic examples copied unchanged (git blobs at PRODUCT: `current_v3` result valid `29463405`, wrong `fa852656`, extra `c0a5c637`, missing `d7766530`; error valid `27b07df3`, extra `bda4fb8a`, missing `2ded3315`, wrong `1eb5eda9`; signed-reply v2 valid `b4c6477c`, extra `e07f5429`, missing `95f72afe`, wrong `a37f9224`; `commit_v3` result valid `309a8b32` - the only published ACTIVE grant, used without `replay_available` as the `current_v3` active answer). No IPs, serials or secrets. |

No channel registry change (`current_v3` is a signed direct READ, not a WS channel: the R1 note's correction), no `routers/__init__.py`
or `scripts/gen_wire_types.py` change (the route extends the existing `bridge_key` family), no migration, no setting. Rollback: revert.

## Invariants kept

- No self-grant: the only grant references Arx ever sends come from WisKey's `current_v3` answer for this pairing on this connection.
- No owner action over the wire; no revoke; no fallback after a refusal of the grant read or a service write, and none after a
  verified refusal of a human people write on a v2 connection (v1 unchanged, lead decision); UNKNOWN stays unknown (journal unchanged, no
  replay); v3 is never card authority; a v3 grant is re-checked by WisKey on every write anyway (`lookup` in `grant`).
- The screen never receives a grant reference, a connection reference or key material.

## Tests (PC, one file at a time, repo venv; real results)

| command (in `smplwise_vms/backend`) | exit | result |
|---|---|---|
| `python -m pytest -rA tests/test_wiskey_service_grants_v3_2520.py` | 0 | 51 passed (first commit); after the lead follow-up: 58 passed |
| `python -m pytest -q tests/test_externalbuild_297.py` | 0 | 32 passed |
| `python -m pytest -q tests/test_wiskey_mac_adopt_298.py` | 0 | 45 passed |
| `python -m pytest -q tests/test_wiskey_mac_adopt_298_review.py` | 0 | 40 passed |
| `python -m pytest -q tests/test_wiskey_adopt_2272_install.py` | 1, then 0 | first run 1 failed (its "unknown contract" example was v3, now a known contract); the example is now v4; rerun 39 passed, 2 skipped |
| `python -m pytest -q tests/test_wiskey_join_live_2382.py` | 0 | after the follow-up (file identical to the base again): 38 passed |
| `python -m pytest -q tests/test_wiskey_direct_v2_2520.py` | 0 | 39 passed |
| `python -m pytest -q tests/test_singletons_registered.py` | 0 | 4 passed |
| `python -m pytest -q tests/test_remote_access.py` | 0 | 66 passed |
| `python scripts/gen_wire_types.py --check` (repo root) | 0 | generated files match |
| `python scripts/wire_ratchet.py` | 0 | 897 unmodelled = baseline 897 (the new route is modelled) |
| `py -3.12 -m ruff check` on the changed Python files | 1 | one pre-existing F401 in `tests/test_wiskey_join_live_2382.py` (unused `ACTOR` import, present on the base too); nothing new |
| runner (slot B, `~/work/wkr8_job.sh`) | - | see "Runner results" below |
| full backend suite, full Playwright | - | **NOT_RUN** (the train gate runs them) |
| live WisKey / lab | - | **NOT_RUN** by rule. The lab has rc10 (v1 direct connection, no v3 block): the read answers `unsupported` and sends nothing. |

### Runner results (Linux test server, slot B via `~/work/slotb.sh`, job `~/work/wkr8_job.sh`; real results)

Run A at `70a61e61d` (backend + frontend), run B at `7ba9124f4` (frontend only; the backend files did not change after run A). Between
them: run A's `tsc` found 3 TS2367 errors in the card (type-only comparisons, fixed in `6deb6b908`) and its R8 evidence spec failed 24
of 32 because the mocked administrator lacked `access.read` (the link is offered only to a caller who may open the panel - the
component was right; the specs now grant it, and one more test covers the caller without it). A screenshot review then showed WisKey's
code reading out of order inside the Hebrew sentence; it is now set apart in `<bdi dir=ltr>` (`7ba9124f4`).

| step | run | exit | result |
|---|---|---|---|
| `test_wiskey_service_grants_v3_2520` (`SW_WIRE_STRICT=1`, one process per file, as all below) | A | 0 | 58 passed |
| `test_wiskey_join_live_2382` | A | 0 | 38 passed |
| `test_wiskey_direct_v2_2520` | A | 0 | 39 passed |
| `test_externalbuild_297` | A | 0 | 32 passed |
| `test_wiskey_mac_adopt_298` | A | 0 | 45 passed |
| `test_wiskey_mac_adopt_298_review` | A | 0 | 40 passed |
| `test_wiskey_adopt_2272_install` | A | 0 | 41 passed |
| `test_remote_access` | A | 0 | 66 passed |
| `test_singletons_registered` | A | 0 | 4 passed |
| `test_wire_routers_e_2480` | A | 0 | 95 passed |
| `gen_wire_types.py --check` | B | 0 | match |
| `tsc --noEmit` (app) | B | 0 | 0 errors (run A: 3, fixed) |
| `npm run typecheck` (tests + scripts) | B | 0 | 0 errors |
| `eslint` on the changed source files | B | 0 | 0 errors (3 "file ignored" warnings for spec files the config ignores) |
| `vite build` | B | 0 | built |
| `unit-bridge-key` + `unit-wiskey-deeplinks` + `unit-people-writes-logic` | B | 0 | 47 passed |
| `pixel-wiskey-r8-2520 --update-snapshots` (desktop + mobile) | B | 0 | 16 passed; 8 baselines made (classic, domus x active, refused x 1440, 390), committed |
| `pixel-wiskey-r8-2520` again without update | B | 0 | 16 passed |
| `evidence-wiskey-r8-2520` (desktop + mobile; shots for the compare page) | B | 0 | 34 passed (run A: 24 failed, see above) |
| "before" shots (`SW_R8_BEFORE=1`: the block hidden = the card as before) | B | 0 | 4 passed |
| `evidence-bridge-key` + `evidence-breakui-bridgekey` + `evidence-wxh-leftovers-2405` (desktop + mobile) | B | 0 | 50 passed |


## Not done here (by design)

- The production service-write journal is still not wired (as since WISKEY-ADOPT-2272), so no service write - v1, v2 or v3 - can be sent
  in production (lead decision Q2 a: not in 2.52).
- `contracts/API_INVENTORY.md` is regenerated by the release train (version-bound), not here.
- Compare page: `private/planning/wiskey_r8_compare_2026-11-25.html` (main checkout, not in git). "Before" = the same build with the block
  hidden (the 404 path), which is exactly the card as it was.

## Lead decisions (25.11)

1. Showing the grant: a - in the bridge-key card, done here (above).
2. Service-write journal: a - not in 2.52.
3. Human-path fallback after a verified refusal: final on v2 only; v1 / rc10 keeps today's fallback exactly (done here, tested both sides).
4. Inactive-card wording: a - added as the label's hint (done here).

## Open questions

None left from this row.
