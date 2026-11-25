# RELEASE-2520-TRAIN - the 2.52.0 train

Branch `release/2520-train`, worktree `C:\cloude\smplwise-2520train`, cut from `origin/main` = v2.51.0 = `3d71fb183`.
Coordinator: the train agent (merges, version bump, train checks). The release gate (`~/gate2/release_gate2.sh`) is run by the lead,
not here. Nothing was installed, no lab, no Home Assistant, no WisKey contact.

## 1. Merge log

Every row merged with `--no-ff` in the order the lead set; each merge commit names the row head.

| # | row | head | merge commit | conflicts | notes |
|---|---|---|---|---|---|
| 1 | `pilot/WISKEY-RESYNC-2520` (R1) | `6a66cca80` | `7ba2c445a` | none | plan + slice 1 (`system/status_v1`, `jobs/status_v1`); rc10 pin exemptions; `relay_inventory` and `station_sync_v1` channels IN USE, `RESERVED_CHANNELS` empty |
| 2 | `pilot/WISKEY-R2-2520` | `a297010d7` | `f94bbdeea` | none | the "מערכת האינטרקום" segment; refreshed Linux baselines of `pixel-access-status`, `pixel-access-s12`, `pixel-wiskey-messaging` (tab bar) |
| 3 | `pilot/WISKEY-R3-2520` | `daea1bc4b` | `0e04d43eb` | none | `stations/relay_inventory_v1`; the scratchpad patch `wk_r3_registry_followup.patch` is NOT needed: R1 `6a66cca80` already marks `relay_inventory` in use and its test asserts no channel is reserved (`test_wiskey_system_status_2520.py` 40 passed on the merged tree, section 3) |
| 4 | `pilot/WISKEY-R4-2520` | `36a04800f` | `564e98d71` | none | `sync/station_v1`; the slice-1 contradiction its note records (section 3 there) is the same one R1 `6a66cca80` resolved |
| 5 | `pilot/WISKEY-R6-2520` | `1dc994650` | `94def9d34` | none | B8 `visits/record_external_v1` on rc.19 `external-visits-v1`; the ended label |
| 6 | `pilot/WISKEY-R7-2520` | `d4e7d1d3c` | `4b4d83847` | none | direct transport v2 (kid, `pairing_status_v2`); generated wire types match (`gen_wire_types.py --check` 0) |
| 7 | `pilot/WISKEY-BRIDGE-KEYSET-2520` | `8e412b0c0` | `4b2bf1ea4` | none | bridge 0.10.9 (`native_keyset`); cut from R7, so R7's commits were already in. Pins checked (section 2) |
| 8 | `pilot/DESIGN-LITERALS-2510` | `344e3163a` | `10ee1aa8f` | `scripts/design_ratchet_baseline.json` | cut from `release/2500-train` at `60fc78e3d`, an ancestor of main: only its 3 commits come in. The 5 source / spec files it touches are byte-identical on main and at `60fc78e3d` (`git diff --stat 60fc78e3d origin/main -- <files>` empty), so nothing older is reintroduced |
| 9 | `pilot/WISKEY-R5-2520` (joined after the bump) | `49f7d3020` | `7a3a3154f` | none | cut from R1 `6a66cca80`; listen gate on the last negotiated signed discovery (WisKey C4). Lead decisions on its questions: the runtime refusal commit `e61a81f95` (`intercom_media.py`, `wiskey_listen_adapter.py`) stays in R5; latest discovery = the live connection, else the last accepted signed check (as built); the row stays installation-wide |
| 10 | `pilot/MFA-REVIEW-DOCS-2520` (joined after the bump) | `284ac25ea` | `0154ba924` | none | base main `3d71fb183`; three small security fixes (`routers/local_passkeys.py`, `services/factor_reset.py`, `services/ha_user_auth.py`) + `test_mfa_review_docs_2520.py`, `docs/security/MFA-REVIEW-2520.md`, guide 82 he + en. `docs/user-guide/he/GUIDE_ALL_HE.html` REBUILT in the merge commit (`scripts/build_guide.py`): `--check` said stale after the merge because R6 added a section to `52-external-access_HE.md` that no row had built into the combined guide; after the rebuild `--check` = up to date |
| 11 | `pilot/MFA-HA-PASSKEY-2520` (joined after the bump) | `7a8cd98b2` | `b5604b743` | none | base main; passkey as the remote sign-in second step of home-system users, behind `security.passkey_remote_factor` (default off). Overlap with row 10 in `services/ha_user_auth.py` merged textually and was read: row 10's N-4 fix (no step-up proof for `ha_mfa_ok`) is kept, the passkey step is additive (`second_factor_need(..., passkey=True)` on the browser exchange only; `pk1:` answers checked against the caller's token). `routers/local_passkeys.py` (row 10) is not touched by this row (`services/local_passkeys.py` is). Refreshed baseline `pixel-mfa-screens-2510 / mfa-policy-preview-1440-desktop-linux.png` comes with the row |
| 12 | `pilot/I18N-REST-2520` | `f493b96a9` | `0f690fec1` | none | base main; the rest of the hard-coded Hebrew, plan editor / floor map / plan studio texts, server refusal texts (`error_text_en.json`) and notification titles (`notify_policy_en.py`) in the reader's language. `frontend/scripts/i18n-split-langs.mjs --dry`: nothing to move. Train fixes `f3dfcd158` and `714fe967e` (below) |
| 13 | `pilot/WISKEY-BRIDGE-KEYSET-2520` re-pair fix | `4dee910e2` | `bfe445ee6` | none | `82a335a93` native_keyset refuses the old pairing at once on a re-pair (both copies + tests), `4dee910e2` note; bridge stays 0.10.9, `keyset.py` untouched. `sync_integration.py --check` up to date. sha256 of BOTH `native_keyset.py` copies = `5fda54de2f2caffe78bb32d4bddce2784d607f285be48f3e6eedc500bc97d1df` (as expected) |
| 14 | `chore/MGMT-SYNC-2520` | `f5bb79936` | `dd4d70330` | none | the task registry brought up to date with git (incl. `chore/MGMT-OWNER-ANSWERS-2211`); `project_status.py --write` right after the merge changed only the timestamp (views consistent); cards updated and views regenerated at the end (section 5) |
| 15 | `pilot/FLAKY-FIX-2520` | `606246076` | `1cc3aedb6` | none | base main; product fix of both intermittent specs (`sw-dialog` backdrop fade; `sw-device-keys` / `sw-access-tokens` / `sw-remote-sessions` keep a refusal's reason across the reload; the mfa spec waits for the reload). Lead decision: NO quarantine for `evidence-mfa-screens-2510:88` or `camera-discovery-2500` (none had been added in the train) |
| 16 | `pilot/MFA-FACTOR-HARDEN-2520` | `eeb4bab89` | `32f758bb1` | none | cut from row 10 `284ac25ea`; owner-approved N-1 (fresh sign-in for every factor added from outside), N-5 (fresh sign-in for an administrator's reset from outside), N-6 (content-free notice `security.second_factor_changed`); guide he + en. On the merged tree: `gen_wire_types.py --check` 0 (reset reason `reauth` generated), `build_guide.py --check` up to date, both i18n ratchets and the design ratchet unchanged |
| 17 | `pilot/ADR019-FAMILY45-2520` | `95d2043a6` | `202e3678f` | none | base main; ADR-019 Step 1 families 4 and 5 (canonical field keys). Lead decisions Q1-Q4 = a; Q1's CHANGELOG line added (`f2c8a3765`: `details.fields` in tickets / messaging / notifications refusals is a list of names, the per-field codes in `details.problems`). `gen_wire_types.py --check` 0; backend refusal ratchet unchanged. `error_contract_inventory.py --write-ratchet` / `--check` do not exist on the train yet: they run once after ADR019-FAMILY678-2520 (lead's order; that row is not final) |
| 18 | `pilot/MULTI-BUILDING-FILTER-2520` | `66a33d2a6` | `b24dd9cb1` | none | base main; the building filter in the home interface (notice board, shared rooms) and the resident phone calendar; `GET /notices?scope=mine` gains `building`; 10 Linux pixel baselines. `gen_wire_types.py --check` 0 (`wire-notices.ts` as generated); `api_inventory.py` gives the same file (1943 routes); design and i18n ratchets unchanged |

Train fixes after row 12:
- `f3dfcd158`: the 34 hard-coded Hebrew literals I18N-REST left are the WisKey demo installation (demo rows of `wiskey-events / overview /
  people / schedules / stations`) and one HTML comment of a template: marked `i18n-keep-start / -end` (reason beside them) and an
  `i18n-keep` note inside the HTML comment. `node scripts/i18n_missing_keys.mjs --ratchet --allow-raise`: `hardcodedTotal` 34 -> 0;
  `keptTotal` 834 -> 868 - the only raise, exactly the 34 marked (kept-on-purpose is a count of reasoned exceptions, not debt).
- `714fe967e`: `scripts/i18n_backend_errors.py` on the merged tree - every constant Hebrew refusal text of the WisKey rows already has its
  English (2303 distinct, 0 missing; nothing to add to `error_text_en.json`); ONE new run-time (f-string) text, R4's numbered-sync
  "outcome unknown" refusal in `routers/access_control_station_ops.py` `_error()` (2 -> 3). Its two neighbours there are run-time texts
  already and the subject `{what}` comes from the module's Hebrew `MESSAGES`, so a `Msg` for this line alone would still show Hebrew
  in English; recorded with `--ratchet --allow-raise` (257 -> 258), open point 7. `tests/test_i18n_errors_en_2520.py`: 9 passed (PC).
- R5's listen reasons: `error_text_en.json` only serves the `ApiError` envelope (`errors.ApiError.message_in`); the status block's
  reasons are row data, not refusals, so neither that table nor another existing path can carry them - still Hebrew (open point 1).

After rows 9 and 10, `python scripts/api_inventory.py` at `0154ba924` gives the same file (1943 routes, no diff).

Row 9, English texts: the new reasons `listen_unknown`, `listen_offer_rejected` and the rewritten `listen_no_downlink` are Hebrew only.
The "מצב WisKey" status block (`services/wiskey_feature_status.py`) has no English path in this train: it does not use the
`smplwise/i18n.py` `Msg` catalogue (I18N-BACKEND-2490), and none of its existing reasons has an English copy. No English copy was added;
an English path for the whole block is a later row (open point 1 in section 4).

Conflict resolution, row 8: main had raised `px-literal` to 25639 for the 2.51 second-factor screens (`85c91c865`); the row lowered
`color-literal` / `px-literal` from the 2.50 numbers (1984 / 25482). Taken: main's file, then the merged tree measured and lowered with
`python scripts/design_ratchet.py --update` -> `color-literal 1984`, `px-literal 25509`, `hand-switch 160` (161 before); nothing raised.

Version bump `a9dd8243c`, committed after row 8 (rows 9-11 joined later and add no version file; the files the 2.51.0 release commit `cded1dfe3` set): `smplwise_vms/config.yaml`, the `io.hass.version` label in
`smplwise_vms/Dockerfile`, `smplwise_vms/backend/smplwise/__init__.py` -> `2.52.0`; `contracts/API_INVENTORY.md` regenerated with
`scripts/api_inventory.py` (1939 -> 1943 routes, version line 2.52.0); a DRAFT 2.52.0 section at the top of `smplwise_vms/CHANGELOG.md`
(marked DRAFT; the final bilingual text is the lead's at release). No other `2.51.0` version reference outside docs / CHANGELOG / `www`.
The UI bundle (`smplwise_vms/www`, `www-public`) is NOT rebuilt here (the release step does it). No new migration in the train.

## 2. Bridge 0.10.9 pins

`git grep 0.10.9` (outside docs): both copies of the bridge (`custom_components/smplwise_bridge/` and
`smplwise_vms/integration/smplwise_bridge/`: `__init__.py`, `const.py`, `keyset.py`, `manifest.json`, `native_keyset.py`,
`www/smplwise-card.js`) and the backend tests that pin the bridge version (`test_bridge_*`, `test_capmap_295`, `test_door_bridge_block_2404`,
`test_extid_followups`, `test_lovelace_card`, `test_wiskey_adopt_2272_review`, `test_wiskey_s4_core_observer`, `test_wxh4_emergency_revoke_2407`).
The remaining `0.10.8` strings outside docs are comments / history only (`const.py` history line, `wiskey_media_bridge.py` and
`test_wiskey_direct_v2_2520.py` docstrings saying 0.10.8 lacks `native_keyset`, the keyset test's split marker).
`python scripts/sync_integration.py --check`: "integration mirror is up to date". Installing 2.52.0 with bridge 0.10.9 needs ONE
owner-approved Home Assistant Core restart (not done; no install here).

## 3. Checks

### 3.1 PC (one small process at a time)

| command | where | exit | result |
|---|---|---|---|
| `python scripts/gen_wire_types.py --check` | merged tree `10ee1aa8f` | 0 | generated files match |
| `python scripts/sync_integration.py --check` | `10ee1aa8f` | 0 | integration mirror is up to date |
| `python scripts/wire_ratchet.py` | `10ee1aa8f` | 0 | 897 unmodelled JSON routes = baseline 897 |
| `python scripts/design_ratchet.py` (after `--update`) | `10ee1aa8f` | 0 | no count above the baseline |
| `python scripts/api_inventory.py` | `a9dd8243c` | 0 | 1943 routes written |
| `python -m pytest tests/test_wiskey_system_status_2520.py` | `a9dd8243c` | 0 | 40 passed |

### 3.2 Runner, slot B (`~/work/slotb.sh ~/work/rel2520_tests.sh <sha> <run>`)

Slot B / C (priority lines `rel2520_*` added to `~/work/slot.priority`, the train's own jobs). Own worktrees under `~/work/rel2520*`,
`SW_WIRE_STRICT=1` for pytest, one pytest process per group of 15 files (run 1) or per file (rows 9-11). No release gate was started.

**Run 1 at `a9dd8243c`** (rows 1-8 + version; `~/work/rel2520_tests.sh`, results `~/work/rel2520-out1`):

| check | exit | result |
|---|---|---|
| `scripts/gen_wire_types.py --check` | 0 | match |
| `scripts/sync_integration.py --check` | 0 | integration mirror is up to date |
| backend: every test file the train changed + `test_wiskey_*`, `test_bridge_*`, `test_wire_*`, `test_wk*`, `test_*station_ops*`, `test_*relay*`, `test_*visit*`, `test_integration*` (148 files, 10 groups) | 0 x 10 | **5299 passed, 11 skipped, 0 failed** |
| `tsc --noEmit -p tsconfig.json` | 0 | 0 errors |
| `npm run typecheck` (tests + scripts) | 0 | 0 errors |
| `npm run lint` | 0 | clean |
| `npm run build` | 0 | built |
| Node unit suite `playwright.unit.config.ts --workers=2` | 1 | 5250 passed, 13 skipped, **3 failed**: all three `unit-mfa-passkeys-2490` (`ERR_CONNECTION_REFUSED` on `localhost:4173` - a page spec in the node-only run with no server; harness, see below) |
| Playwright against a preview of the build, 73 spec files (`*wiskey*`, `*access*` non-unit, `camera-discovery-2500`, `evidence-onvif-ui-2500`, `pixel-home-auditfix-2437`, `pixel-home-fb-2431`, `pixel-home-gaps-2436`), desktop + mobile, 2 workers, no retries | (0) | **1031 passed, 512 skipped, 1 failed**: `camera-discovery-2500:132` desktop, axe `color-contrast` x9 inside `camera-discovery-dialog` (see section 4) |

**Row 9 (R5) at `7a3a3154f`** (`~/work/rel2520_r5.sh`, one process per file, the 13 files of `docs/changes/WISKEY-R5-2520.md`): all exit 0 -
`test_wiskey_listen_gate_2520` 31, `test_wkf01f02_295` 28, `test_wkaudin_295` 19, `test_asgi_wiskey_295` 28, `test_wiskey_pairing_2382` 32,
`test_wiskey_activation_runbook` 16, `test_wiskey_adopt_2272_contrib` 39, `test_wiskey_mac_adopt_298` 45, `test_wiskey_mac_adopt_298_review` 40,
`test_intercom_shared_2440` 9, `test_wk4adopt_295` 44, `test_wiskey_talk_caps_2382` 28, `test_singletons_registered` 4 = **363 passed, 0 failed**.

**Row 10 (MFA-REVIEW-DOCS) at `0154ba924`** (`~/work/rel2520_files.sh`, one process per file): all exit 0 - `test_mfa_review_docs_2520` 3,
`test_mfa_reset_hardening_2510` 22, `test_local_passkeys` 73, `test_mfa_policy_2490` 70, `test_mfa_tokens_2490` 22, `test_mfa_secreview_2500` 8,
`test_mfa_secfix_2500` 17 = **215 passed, 0 failed**.

**Row 11 (MFA-HA-PASSKEY) at `b5604b743`** (`~/work/rel2520_hapk.sh`, `rel2520_hprerun.sh`, `rel2520_pk2.sh`):

| check | exit | result |
|---|---|---|
| backend, one process per file: `test_mfa_ha_passkey_2520` 15, the 7 row-10 files (3 / 22 / 73 / 70 / 22 / 8 / 17), `test_mfa_passkeys_2490` 26, `test_passkey_only` 10, `test_singletons_registered` 4, `test_settings_patch_audit_order` 8 | 0 x 12 | **278 passed, 0 failed** |
| `tsc --noEmit -p tsconfig.json` / `npm run typecheck` | 0 / 0 | 0 errors / 0 errors |
| `vite build` | 0 | built |
| `unit-mfa-ha-passkey-2520` with `SW_UNIT_PAGES=1` on a `localhost` **Vite dev server** | 0 | **5 passed, 2 skipped** (a first try against a `vite preview` failed 5/5 "Failed to fetch dynamically imported module /src/arx/arx-login.ts": the spec imports source modules, so it needs the dev server - harness) |
| `unit-mfa-passkeys-2490` with `playwright.config.ts` on a `localhost` preview (as its header says), desktop + mobile | 0 | **6 passed, 2 skipped** (clears run 1's three node-only failures) |
| `evidence-mfa-ha-passkey-2520` + `evidence-mfa-screens-2510` + `pixel-mfa-screens-2510` on a `localhost` preview, desktop + mobile | 1 | 35 passed, 4 skipped, **1 failed**: `evidence-mfa-screens-2510:88` mobile (pre-existing intermittent, below); the refreshed `mfa-policy-preview` baseline passes |
| `evidence-mfa-screens-2510` mobile `--repeat-each=3`: train / main `3d71fb183` | 1 / 1 | train 2 of 3 runs of `:88` failed; **main 1 of 3 failed** (37 / 38 passed) |
| `evidence-mfa-screens-2510:88` desktop `--repeat-each=3`: train / main | 1 / 1 | **2 of 3 failed at both** (same element not found: `[data-device-keys-error]` after the step-up cancel) |

**Head-level checks at `b5604b743`** (after rows 9-11; `~/work/rel2520_cd.sh`): `npm run lint` exit 0 (clean); the Node unit suite exit 1 -
5248 passed, 15 skipped, 3 failed = the same three `unit-mfa-passkeys-2490` page tests with no server (harness; they pass under
`playwright.config.ts` on a localhost preview, above).

**`camera-discovery-2500` "the whole flow" (axe at step 1)**, preview of the build, desktop + mobile, no retries:

| where | runs | failed |
|---|---|---|
| train run 1 (`a9dd8243c`) | 2 (desktop + mobile) | 1 (desktop) |
| train `b5604b743` `--repeat-each=3` | 6 | 3 |
| main `3d71fb183` `--repeat-each=3` | 6 | 0 |
| train `2aaa64f5b` (with an axe wait for animations, `--repeat-each=5`) | 10 | 3 |
| **main `3d71fb183` `--repeat-each=10`** | **20** | **10** |
| train `2aaa64f5b` `--repeat-each=5` (diagnostic copy printing axe's colours) | 10 | 2 |

Every failure is axe `color-contrast` (critical / serious) on the wizard's muted texts at step 1 ("scan setup") only, with blended
colours (e.g. `.sub` `#868f9f` on `#f7f9fc` = 3.09; the current step `#6282d3` on `#ebeff7` = 3.22); every later step reports 0. It fails
at main as often as on the train, so it is NOT a 2.52 regression (the first 0-of-6 at main was chance). A test-side wait for the
document's finite animations before axe (`2aaa64f5b`) did not change it and was reverted (`15615179e`); the spec is the row's version.

## 4. Problems and open points

1. **English path of the "מצב WisKey" status block** (row 9): the block's server texts (all its reasons, old and new) are Hebrew only;
   it does not go through `smplwise/i18n.py`. a) a later row moves `wiskey_feature_status.R` to `Msg` keys with English (recommended)
   b) accept Hebrew-only for this installer-facing block.
2. **`evidence-mfa-screens-2510:88` is intermittent on main too** ("a cancelled step-up keeps the key and says so"): 2 of 3 desktop runs
   fail at main `3d71fb183` and at the train alike, so it is NOT a 2.52 regression (not checked here how the 2.51 gate saw it). Per the owner's rule
   (flaky -> quarantine with a ticket and an expiry) a) quarantine it for the 2.52 gate with a ticket to fix the wait after the cancel
   (recommended) b) leave it and rely on the gate's retry policy.
3. **Harness notes for the gate** (no product change): `unit-mfa-passkeys-2490` fails in a node-only unit run (it needs a localhost
   server, as the gate gives it since `319f81676`); `unit-mfa-ha-passkey-2520` needs `SW_UNIT_PAGES=1` and a `localhost` **dev** server
   (it imports `/src/arx/*.ts`).
4. The UI bundle (`smplwise_vms/www`, `www-public`) is not rebuilt here; the CHANGELOG 2.52.0 section is a DRAFT.
5. Bridge 0.10.9: installing 2.52.0 needs ONE owner-approved Home Assistant Core restart.

6. **`camera-discovery-2500` "the whole flow" is intermittent on main** (about half the runs: axe color-contrast at step 1 with blended
   colours; section 3.2). Not a 2.52 regression, but the gate may hit it. a) quarantine it for the 2.52 gate with a ticket (the axe call
   at step 1 overlaps the dialog's opening - find what is still blending; a plain wait for CSS animations did not help) (recommended)
   b) re-run on failure.
