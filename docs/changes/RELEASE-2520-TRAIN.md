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
| 19 | `pilot/NOTIFY-RECIPIENT-LANG-2520` | `7b55e0e76` | `f3fdb961f` | none | cut from row 12 `f493b96a9`; push, e-mail and phone-app notifications in each recipient's language (`services/notify_delivery_lang.py`; WhatsApp unchanged). Backend only. Train fix `61a6959ef` (below). No card in `management/tasks.json` (MGMT-SYNC left it unregistered; open point 9) |
| 20 | `pilot/WISKEY-R8-2520` | `fee46e05a` | `2b9a3a839` | none | cut from R7 `d4e7d1d3c`; `GET /system/bridge-key/service-grant` (local-only), the v3 service-write contract (journal unwired), the people-write path chosen once, the service approval block + 8 Linux pixel baselines, the "מושבת" hint. `gen_wire_types.py --check` 0; `wire_ratchet.py` 897 = baseline; i18n ratchet unchanged. Train fix `8a91908a3` (below) |
| 21 | `pilot/ADR019-L14-STRICT-F123-2520` | `0204770f4` | `6a1b42ef5` | none | base main; 19 family-3 request models (nvr_write, nvr_privacy, mask_copy, cameras) to `extra=forbid`; `scripts/request_strict_ratchet.py` + baseline (144). Lead decisions Q1 = a, Q2 = a; CHANGELOG line `66cca52e8`. On the merged tree `request_strict_ratchet.py --check` holds (144), `gen_wire_types.py --check` 0. No card in `management/tasks.json` (open point 9) |
| 22 | `pilot/ADR019-FAMILY678-2520` | `1eef30527` | `22ba0e9fb` | none | base main; ADR-019 families 6-8 and the inventory's `--check` / `--write-ratchet`. Then, once (lead's order, after FAMILY45 + FAMILY678): `error_contract_inventory.py --write-ratchet` + `--check` (`53a6b8da8`): 74 -> **0 legacy 422 sites**, "error contract ratchet holds" (FAMILY45's families at 0) |
| 23 | `pilot/STARTING-STYLE-AUDIT-2520` | `900de0c46` | `a605434f8` | none | base row 15; CSS-only entrance fixes in 10 files + the `unit-starting-style-audit-2520` checker (the `sw-app.ts` overlap: two comment lines) |
| 24 | `pilot/MFA-PASSKEY-ADMIN-REMOVE-2520` | `18b6ff7f0` | `299dda4d9` | none | base row 16; `.../passkeys/{pk_id}/remove-check`; `gen_wire_types --check` 0, `build_guide --check` up to date; API inventory `48536a4e4` (1944 -> 1945) |
| 25 | `pilot/MFA-RESET-CHANNEL-UI-2520` | `06375d311` | `b6cd0d9aa` | `frontend/src/i18n/lang/en/i18n/msg/mfa.ts` | base the train at `ea04ad4fd`; both sides only appended entries at the end of the table -> kept both (HEAD's first). Decisions Q1-Q4 = a. The row's rewritten baseline `mfa-policy-preview-1440-desktop-linux.png` re-checked in the full pixel run (section 3.4) |
| 26 | `pilot/NOTIFY-LANG-SENDERS-2520` | `aafbd5ccd` | `bb80821ed` | none | base row 19; Q1-Q4 = a. `notify_policy.render()` now has both language mechanisms side by side (this row's per-signal `_i18n` overlay and the train's `PARAM_VALUES_EN`, `61a6959ef`), only for a language other than Hebrew; `second_factor_changed` sends no `_i18n`, so they never meet |
| 27 | `pilot/WISKEY-SCHED-READS-2520` | `8c1f3ae90` | `c3af014da` | none | base `b5604b743`; migration `0225_wiskey_schedule_reads.sql` (free: the train ended at 0224). Follow-ups `f8fa8c508` (API inventory 1948; lead Q1 = a: `test_wiskey_system_status_2520.py` in `tests/gate_always_run.json`; Q4 = a: `test_wiskey_schedule_writes`' "07:00" audit check leaves the rows' ISO instants out first - it failed whenever an `expires_at` fell on minute 07) and `493beba09` (design ratchet, below) |
| 28 | `pilot/GEN-UNITS-FIELD-2520` | `8ae3cbaa3` | `890a645cf` | none | base main; generator routing texts in the reader's language, unit inside the field. Its merge message says "design ratchet unchanged" - wrong, see `493beba09` below. `evidence-genlog-092` "switch on" (tablet) classified in section 3.4 |
| 29 | `pilot/DOOR-TECH-HOLD-FIX-2520` | `b7c4a474a` | `35365a2be` | none | docs only (`docs/changes/DOOR-TECH-HOLD-FIX-2480.md`); DOOR-TECH-HOLD-FIX-2480's card -> REVIEW with `5efb30eb1` (v2.48.0) |
| 30 | `pilot/I18N-RUNTIME-ERRORS-2520` | `8420d7bdf` | `189ec3f4a` | 10 modules + 2 ratchets | base row 12. Where the ADR-019 rows had moved a refusal to `field_error(f"...", [fields], code=, legacy=, extra=)` and this row made the text `tpl(...)` in the old call (backup, brand, capture_lease, settings_patch/identity x2, white_label, access_external, access_grants x2, app_refresh x3, automation_ops, schedule_ops - 14 hunks): kept BOTH, HEAD's `field_error` with the row's `tpl(...)` (Tpl is a Msg; field_error passes it on); ruff F clean. Ratchet files regenerated. Lead Q1 = a at the merge: station_ops' three `_error()` texts and wiskey_visits' generic refusal as `tpl()` (MESSAGES values as English "words"), SCHED-READS' three constant texts in `error_text_en.json` -> backend refusal ratchet **258 -> 0** run-time, 0 without English. EN ratchet `keptTotal` 868 -> 871 (`--allow-raise`, the row's documented +3) |
| 31 | `pilot/WISKEY-STATUS-I18N-2520` | `4c0014602` | `9d42de979` | none | base `eadaa25b8`; the "מצב WisKey" reasons in the page language (open point 1). All 33 reason codes of the merged `wiskey_feature_status.R` have a Hebrew and an English entry; `i18n-split-langs --dry` moves nothing |
| 32 | `pilot/WISKEY-VISITS-ENDED-FILTER-2520` | `6d744bd41` | `f343f829b` | none | base `eadaa25b8`; Q1 = a, Q2 = a. `gen_wire_types --check` 0; `GUIDE_ALL_HE.html` rebuilt in the merge (`--check` said stale after it) |
| 33 | `pilot/GEN-SENSOR-NAMES-EN-2520` | `e0d4a597b` | `78a8ad1f2` | none | cut from row 28; English generator sensor names (additive `needs_en`, `label_en`, `labels_en`) and CSV headers in the page language; `gen_wire_types --check` 0, ratchets unchanged |
| 34 | `pilot/WISKEY-NOFALLBACK-FIX-2520` | `76ee24bcb` | `af0021b2c` | none | base `189ec3f4a`; WB-01 no classic people write after a v2 refusal, WB-03 discovery re-read with backoff; backend only; Q1-Q4 = a |
| 35 | `pilot/WISKEY-PAIRING-I18N-2520` | `fba8a8062` | `7109362dc` | none | cut from row 31; additive fix_code / params / step codes on the pairing card + a he / en catalogue; `gen_wire_types --check` 0. Q1 = a train fix `9fb9b9cfa` (below) |
| 36 | `pilot/SCREENS-FIX-B-2520` | `1226df73d` | `026d1e55f` | none | base `bd20831e6`; frontend only (public ticket with ar / ru packs, home calendar, resident calendars, investigation playback + `playback-day.ts`). The public bundle is rebuilt with the train's UI rebuild (`build:public:addon`; public chunk budget 62 KB) |
| 37 | `pilot/OVERLAY-FADE-2520` | `f628421cc` | `c5adefc60` | none | cut from row 23; overlay entrances move-only + the `unit-overlay-fade-2520` checker + the "דורש אישור" heading token. Design ratchet lowered 25514 -> 25513 (`997dbe643`). Its phone notification-centre failures (the runner's disk-full window) re-run in section 3.5 |
| 38 | `pilot/BRIDGE-REPAIR-LEGACY-2520` | `fadca9072` | `764e442c7` | none | base `189ec3f4a`; bridge `keyset.py` + `__init__.py` (WB-02 a legacy untagged store is a re-pair; WB-07 the PairingFence); `sync_integration --check` up to date. sha256 of BOTH copies (`custom_components/` and `smplwise_vms/integration/`), as expected: `keyset.py` `05d6458f4fc8843121c4a6d003191d825a17724f042ceddccb4c43021bb005c4`, `__init__.py` `4b497464e7f27a4edd02a0d3f1338d951d864428644c6908a061164856d86fe1`, `native_keyset.py` `5fda54de2f2caffe78bb32d4bddce2784d607f285be48f3e6eedc500bc97d1df` (unchanged) |
| 39 | `pilot/VIDEO-SECFIX-2520` | `92fa64855` | `0a9d23c01` | none | base `189ec3f4a`; V-01 the shared go2rtc frame sanitizer, V-04 the camera scope on NVR change undo / detail / list; backend only. Train fix `2b9810f38` (T06 admission: `wiskey_schedule_reads.py` reviewed into the signing-caller pin) |
| 40 | `pilot/FE-SAFETY-FIX-2520` | `ad07934e0` | `88070190a` | none | base `f343f829b`; FC-02 push registrations tied to the sign-in (migration `0226` - free), FC-04 Enter confirms only on the confirm button; shared files with the MFA rows merged clean |
| 41 | `pilot/SCREENS-FIX-A-2520` | `55323bed1` | `91de5c377` | none | base `bd20831e6`; SCR-01 / SCR-06 / SCR-07; Q1 = a, Q2 = a; the train's `--sw-danger-text` fix and `error_text_en.json`'s format kept |
| 42 | `pilot/GATE-HARDEN-2520` | `5aaca2e2c` | `78e1a68d0` | none | base `198db5c3e`; gate engine fixes, `scripts/gate/engine_sync.py` (drift check), bundle-version release check, clock-independent quiet-hours tests. Must be merged before the gate (the installed engine refuses a drifted branch) |
| 43 | `pilot/SCREENS-FIX-B2-2520` | `9f0626e90` | `bf59244c0` | none | cut from row 36; public-ticket draft bound to its link; `/me/calendar` pending items carry `revision`; `gen_wire_types --check` 0; API inventory unchanged (1948) |
| 44 | `pilot/SEC-FIX-2520` | `99456c1d5` | `53788848e` | none | base `f343f829b`; SEC-1 / SEC-2 / SEC-3, CORE-01 / CORE-02 / CORE-04; Q1-Q3 = a; `gen_wire_types --check` 0, refusal inventory 0 / 0, error-contract ratchet 0, strict ratchet 144. The last 2.52 row |

Train fixes after rows 16-20:
- `61a6959ef` (row 16 x rows 12 / 19): MFA-FACTOR-HARDEN-2520's new notice `security.second_factor_changed` came after I18N-REST-2520
  wrote the English templates, so the merged train had none - an English reader got it in Hebrew (the centre, and per recipient
  push / e-mail / app since row 19) and `test_i18n_errors_en_2520::test_every_english_template_belongs_to_a_source_and_keeps_its_placeholders`
  FAILED (PC: 1 failed / 8 passed without the fix, 9 passed with it; the runner's combined job at `32f758bb1` shows the same failure,
  146 passed / 1 failed in its group). Added: the English template in `services/notify_policy_en.py`, and `PARAM_VALUES_EN` - the
  English of the FIXED Hebrew phrases the source puts in `{change}` (`notify_sources.FACTOR_CHANGES_HE`); `notify_policy.render()`
  swaps such a value only when `lang != "he"` and the source has English (Hebrew output and the stored rows unchanged; names stay as
  written). New regression test `tests/test_notify_factor_changed_en_2520.py` (6 passed, PC).
- `8a91908a3` (row 20): `contracts/API_INVENTORY.md` 1943 -> 1944 routes (the new route). Design ratchet: `px-literal` 25509 -> 25512,
  all three in R8's new block of `components/sw-bridge-key-card.ts` (the row was cut before row 8 lowered the baseline). The on-scale
  4px padding is now `var(--sw-s-1)` (same 4 px, pixel-neutral); the 1px border and the coarse-pointer 44px touch target stay literal,
  as row 8 keeps them (its note: 1 px borders / hairlines have no token; a coarse-pointer touch target is `44px` across the
  components). `--update --allow-raise`: 25509 -> 25511 (the only raise; precedent `85c91c865` of the 2.51 train) - open point 8.

Train fixes after rows 22-32:
- `493beba09`: design ratchet `px-literal` 25511 -> 25514 (`--allow-raise`): all three in WISKEY-SCHED-READS' new
  `components/wk-schedule-reads.ts` (per-file counts compared between `a605434f8` and HEAD) - a 1px border, an off-scale 2px gap and a
  640px media-query breakpoint, none with a token (a media query cannot read a custom property); the same kind as R8's +2 the lead accepted.
- Registry `e98e8e544` (lead decision 4): cards for NOTIFY-RECIPIENT-LANG-2520 and ADR019-L14-STRICT-F123-2520, and for the seven other
  merged rows that had none (STARTING-STYLE-AUDIT, MFA-PASSKEY-ADMIN-REMOVE, MFA-RESET-CHANNEL-UI, NOTIFY-LANG-SENDERS, I18N-RUNTIME-ERRORS,
  WISKEY-STATUS-I18N, WISKEY-VISITS-ENDED-FILTER), each REVIEW with R-/AT- entries (AT NOT_RUN); rows 22, 27, 28 -> REVIEW;
  `project_status.py --write` PASS (697 tasks, 811 requirements).

Train fixes after rows 33-38:
- `bd20831e6` (row 27 x rows 17 / 22): SCHED-READS' invalid-draft refusal was a legacy 422 (`details.field`) - after the error-contract
  ratchet went to 0 (`53a6b8da8`), `error_contract_inventory --check` failed ("access: 1 legacy 422 sites") and so did FAMILY45's /
  FAMILY678's "no legacy left" tests (rows 22-32 job). Now `field_error(..., problems, legacy={"field"}, extra=...)` like the writes router;
  `--check` holds at 0; `test_wiskey_schedule_reads_2520` on the PC 73 passed.
- `928f05e64`: the CHANGELOG 2.52.0 heading lost its upper-case DRAFT mark - `release_check.changelog_head()` skips a DRAFT heading, so the
  head read 2.51.0 against version files at 2.52.0 and `test_release_check` failed. The section's own comment still says it is the train's
  draft list. `release_check.py`: one version everywhere 2.52.0 (only the v2.52.0 tag is missing, as expected); `test_release_check` 3 passed.
- `e328f3ca2` (rows 24, 31): `unit-a11y-polished-lint` - `.pk-reset .err` (system-local-users.ts) on `var(--sw-danger-text)` instead of the
  bare state colour; `unit-uxfix-rtl` - `i18n/wiskey-feature-status.ts` is a byte-for-byte mirror of the server's Hebrew texts (its spec
  asserts the equality; it is never shown - a Hebrew page shows the server's text), and the server's texts use U+203A (148 Hebrew lines in
  68 backend files); the RTL guard skips that one mirror file (`MIRRORS_SERVER`, reason beside it) - open point 11.
- `9fb9b9cfa` (row 35, lead Q1 = a): `scripts/i18n_backend_errors.py` also reads the `text` keyword of `require_system_admin`
  (`TEXT_KEYWORD_GATES`); that found four constant texts without English (the pairing card's two, `access_grants` readiness,
  `wiskey_managed`) - now in `error_text_en.json`; inventory 0 without English, BE ratchet 0 / 0.
- `628c0e259` (lead Q3 = a): `test_capmap_295` - the reviewed successor of `services/ha_bridge.py` (58cfc913... -> 3a7ee1f8...) after
  I18N-RUNTIME-ERRORS: ten argument-check refusals of the generic device route f-string -> `tpl()` (same Hebrew) + the import, nothing else
  (`git diff a7ba23483 33e121b63`); capmap on the PC 65 passed.

Train fixes after rows 39-44:
- `2b9810f38` (row 27 x the T06 pin): `test_t06_admission_295` pins the modules that reach the signing seam; `wiskey_schedule_reads.py`
  reaches it only through the installed direct join's own session and sends only its two pinned reads (`schedules/read_start_v1`,
  `schedules/read_status_v1`) while discovery declares the contract - added with that reason (PC: 63 passed, 3 xfailed).
- `cff4e13b6` (rows 1, 4 x `test_wiskeyarx_291` N07): `SYNC_V1_API_CONTRACT` (R4, the station-sync contract's const 1) allowed by name and
  pinned to 1; `wiskey_system_status.py` (R1) only READS WisKey's reported `api_contract` - skipped by name. PC: 52 passed.
- `c128c2f86` (rows 35, 36): `i18n/wiskey-pairing-status.ts` uses the shared U+2039 (not a server mirror; no exemption);
  `unit-modal-stack-guard-2442` count for `home-calendar.ts` 1 -> 2 (SCR-04's alertdialog, the same sw-home sheet).
- `9fb8109fb`: `gate_always_run.json` + `test_i18n_errors_en_2520.py` and `test_wiskey_service_grants_v3_2520.py` (package walks);
  `test_error_contract_inventory_2490` no longer expects the legacy `field` shape (ADR-019 Step 1 complete) - it now asserts its absence.

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


### 3.3 Runner, rows 12-21 (priority jobs `~/work/p2520_*.sh`)

Note: in the summary lines of `p2520_train.sh`, `p2520_r1718.sh` and `p2520_r1920.sh` the `rc=` of the backend groups and of the
every-pixel step is NOT the test's exit (the file list was expanded after `$?`); the counts below are read from each group's pytest /
Playwright summary line, and every `FAILED` line was looked up.

**Bridge re-pair fix at `bfe445ee6`** (`~/work/p2520_files.sh`, one process per file): `test_bridge_native_keyset_2520` 32,
`test_wiskey_direct_v2_2520` 39, `test_bridge_keyrot_harness_295` 34, `test_capmap_295` 65 - all exit 0 (170 passed). The capmap row
needed nothing (`keyset.py` untouched).

**Combined run at `32f758bb1`** (rows 1-16; `~/work/p2520_train.sh`):

| check | result |
|---|---|
| `gen_wire_types --check` / `sync_integration --check` / `wire_ratchet` | 0 / 0 (up to date) / 0 (897 = baseline) |
| backend i18n / default names / ui.lang / notify / calendar / error-contract files + `test_bill_ledger_lifecycle_b` (30 files, 4 groups) | 2491 passed, **1 failed**: `test_i18n_errors_en_2520::test_every_english_template_belongs_to_a_source...` = the missing English of `security.second_factor_changed`, fixed by `61a6959ef` (green in the rows 19-20 run below) |
| the MFA files one process each (16 files incl. `test_mfa_factor_harden_2520` 17, `test_mfa_ha_passkey_2520` 15, `test_wire_consumption_2450` 13) | all exit 0, 363 passed |
| `tsc` app / tests + scripts; `npm run lint`; `npm run build` | 0 errors / 0 errors; clean; built |
| Node unit suite | 5251 passed, 13 skipped, 3 failed = the `unit-mfa-passkeys-2490` page tests with no server (harness) |
| `unit-dialog-toplayer-2381` | 6 passed |
| `camera-discovery-2500` "the whole flow" `--repeat-each=5` desktop + mobile (localhost preview) | **10 passed, 0 failed** (FLAKY-FIX) |
| `evidence-mfa-screens-2510` `--repeat-each=5` desktop + mobile | **130 passed, 0 failed**, 10 skipped (FLAKY-FIX) |
| `evidence-mfa-factor-harden-2520` + `unit-mfa-passkeys-2490` (playwright.config.ts) desktop + mobile | 14 passed, 2 skipped |
| **every pixel spec (47 files), desktop + mobile, Hebrew baselines, no `-u`** | 479 passed, 83 skipped, **1 failed** (`pixel-wiskey-people-writes:137` desktop, 23203 px); no baseline file changed. Cause and fix below |

`pixel-wiskey-people-writes:137` ("the editor: a contractor with the weekly timing"): bisect, desktop `--repeat-each=3`: main `3d71fb183`
3/3, `10ee1aa8f` 3/3, `0f690fec1` 3/3 passed; `1cc3aedb6` (FLAKY-FIX merged) 2 failed; `8a91908a3` 1 failed - always the same 23203 px,
the editor body 26 px lower. FLAKY-FIX made the dialog box really land (`scale(0.96) translateY(6px)`; before, the starting style never
won); the test acts right after the editor opens, Playwright scrolls each target into view as it acts, and an action during the landing
left the body at a scaled offset that the later `scrollIntoViewIfNeeded()` kept. Fix `2be69330d` (test only): wait for the box's
animations to finish before acting. Runner at `02934fad8`: committed spec 6 of 10 failed; fixed spec 10 of 10 passed; whole file desktop +
mobile 14 passed; `tsc -p tsconfig.tests.json` 0 errors.

**Rows 17-18 at `f2c8a3765`** (`~/work/p2520_r1718.sh`): `gen_wire_types --check` 0; backend 35 files (FAMILY45's 19 + MULTI-BUILDING's 16)
in 5 groups: **910 passed, 0 failed**; tsc 0 / 0 errors; lint clean; build; unit `unit-error-fields`, `unit-mb-filter-2520`,
`unit-mb-next-2500`, `unit-mb-home-2500`, `unit-i18n-home` 33 passed; `pixel-wiskey-messaging`, `pixel-wiskey-schedule-writes`,
`pixel-mb-filter-2520` (no `-u`), `evidence-mb-filter-2520`, `home-v3-p2`, `evidence-mb-next-2500`, `evidence-mb-home-2500` desktop + mobile:
77 passed, 37 skipped, 0 failed; calendar resident / grid regressions (`evidence-calendars-settings-2310`, `evidence-calendars-grid-edit-2343`,
mobile): 35 passed, 8 skipped.

**Rows 19-20 at `8a91908a3`** (`~/work/p2520_r1920.sh`): `scripts/gate/lint_backend.py --strict` 0 findings; `gen_wire_types --check` 0;
`wire_ratchet` 897 = baseline; `i18n_backend_errors` 0 without English / 258 run-time (= ratchet); notify / push / generator-alert files +
`test_i18n_errors_en_2520` + `test_notify_factor_changed_en_2520` (17 files, 3 groups): **432 passed, 0 failed**; R8's files one process
each (`test_wiskey_service_grants_v3_2520` 58, `test_externalbuild_297` 32, `test_wiskey_mac_adopt_298` 45, `..._review` 40,
`test_wiskey_adopt_2272_install` 41, `test_wiskey_join_live_2382` 38, `test_wiskey_direct_v2_2520` 39, `test_singletons_registered` 4,
`test_remote_access` 66, `test_bridge_native_keyset_2520` 32): all exit 0, 395 passed; tsc 0 / 0 errors; build; unit `unit-bridge-key`,
`unit-wiskey-deeplinks`, `unit-people-writes-logic`, `unit-people-writes-wire` 51 passed; `evidence-wiskey-r8-2520` + `pixel-wiskey-r8-2520`
(no `-u`) desktop + mobile: 50 passed.

**Row 21 at `66cca52e8`** (`~/work/p2520_r21.sh`): `request_strict_ratchet.py --check` 0 (144 tolerant web-UI models); the new file and every
backend test file that calls `/api/v1/cameras*`, `/api/v1/nvr/*` or `privacy-masks` (130 files, 9 groups): all exit 0, **1961 passed,
3 skipped, 0 failed**.

NOT_RUN on the train: the release gate (the lead's), the full backend suite in one sweep (the touched areas above only), the full
Playwright suites beyond the specs named, tablet, any lab / live WisKey check.

## 4. Problems and open points

1. ~~English path of the "מצב WisKey" status block~~ - DONE by row 31 (WISKEY-STATUS-I18N-2520). Was: (row 9): the block's server texts (all its reasons, old and new) are Hebrew only;
   it does not go through `smplwise/i18n.py`. a) a later row moves `wiskey_feature_status.R` to `Msg` keys with English (recommended)
   b) accept Hebrew-only for this installer-facing block.
2. ~~`evidence-mfa-screens-2510:88` intermittent~~ - RESOLVED by row 15 (FLAKY-FIX-2520: the refusal reason survives the reload, the
   spec waits for it). Lead decision: no quarantine. Train run at `32f758bb1`, `--repeat-each=5` desktop + mobile: **130 passed, 0 failed**
   (10 skipped, the shots).
3. **Harness notes for the gate** (no product change): `unit-mfa-passkeys-2490` fails in a node-only unit run (it needs a localhost
   server, as the gate gives it since `319f81676`); `unit-mfa-ha-passkey-2520` needs `SW_UNIT_PAGES=1` and a `localhost` **dev** server
   (it imports `/src/arx/*.ts`).
4. The UI bundle (`smplwise_vms/www`, `www-public`) is not rebuilt here; the CHANGELOG 2.52.0 section is a DRAFT.
5. Bridge 0.10.9: installing 2.52.0 needs ONE owner-approved Home Assistant Core restart.

6. ~~`camera-discovery-2500` "the whole flow" intermittent~~ - RESOLVED by row 15 (FLAKY-FIX-2520: `sw-dialog`'s backdrop fade no longer
   fades the dialog's texts). Lead decision: no quarantine. Train run at `32f758bb1`, "the whole flow" `--repeat-each=5` desktop +
   mobile: **10 passed, 0 failed** (main failed 10 of 20 before; section 3.2).
7. ~~R4's run-time refusal text~~ - DONE at row 30 (`tpl()`, backend ratchet 0). Was: (`routers/access_control_station_ops.py` `_error()`, numbered-sync "outcome unknown"): recorded in the
   backend refusal ratchet (257 -> 258) rather than made a `Msg`, because its subject comes from the module's Hebrew `MESSAGES`.
   a) a later row moves `_error()` and `MESSAGES` to `Msg` keys with English and lowers the ratchet (recommended) b) keep.
8. **Design ratchet raised by 2** (accepted by the lead), and by 3 more for SCHED-READS (`493beba09`, same kind) (`px-literal` 25509 -> 25511, R8's 1px border and coarse-pointer 44px): a) accept for 2.52, as the
   2.51 train did for new screens (recommended) b) the R8 owner replaces them with tokens once a hairline / touch token exists.
9. ~~Cards missing~~ - DONE (`e98e8e544`, nine cards registered). Was: `NOTIFY-RECIPIENT-LANG-2520` (row 19) and `ADR019-L14-STRICT-F123-2520` (row 21) had no card in `management/tasks.json` (recorded on RELEASE-2520-TRAIN's card).
   a) the next MGMT-SYNC registers it as REVIEW with `7b55e0e76` / `f3fdb961f` (recommended) b) the train adds the card.
10. ~~FAMILY678 and the error-contract ratchet~~ - DONE (rows 22, `53a6b8da8`: 0 legacy 422 sites).
11. **The RTL guard's mirror exemption** (`e328f3ca2`): `i18n/wiskey-feature-status.ts` keeps the server's U+203A. a) keep the exemption;
    the server's Hebrew separators move to U+2039 in a later row together with the mirror (recommended) b) change the server's 14 texts now.
12. **Runner disk-full window** (this evening): failures with "database or disk is full" / ENOSPC were re-run, not triaged (section 3.5).

## 5. Gate readiness (the complete 2.52 scope: 44 rows)

Final code head `9d06b64cc` (docs / registry commits after it change no code). Runner, at the final heads:
- generators and ratchets (`53788848e`): `gen_wire_types --check`, `sync_integration --check` (bridge copies identical), `wire_ratchet`
  897 = baseline, `request_strict_ratchet` 144, `error_contract_inventory --check` 0 legacy 422 sites, `i18n_backend_errors` 0 without
  English / 0 run-time, `lint_backend --strict` 0 findings, `design_ratchet` no count above the baseline, `build_guide --check` up to date;
- `engine_sync check --ref 53788848e`: the engine `release_gate.py` is the tree's (sha256 42294cde08ddc167); one WARNING - `~/gate2/gate_budget.py`
  differs from `scripts/gate/gate_budget.py` (install with `engine_sync.py install --src <checkout> --apply` before the gate - the lead's step);
- `release_check.py`: every check ok except (1) the shipped UI bundle (`www/arx-sw.js` still `arx-shell-2.51.0`) and (2) the v2.52.0 tag.
  (1) is closed by the release commit's UI rebuild (`npm run build:addon` + `build:public:addon`; public chunk 58 KB of 62 KB), which also turns
  `test_release_check` and `test_release_bundle_version_2520` green; (2) comes after the owner's approval;
- every row's own test files green (sections 3.2-3.3 and the runs per row above), every pixel spec green twice (514 passed, no baseline
  changed), the Node unit suite green except the three `unit-mfa-passkeys-2490` page tests that need a server (green under their own config).

## 6. Gate run 1 (6d8fd71e1, FAIL, 199 min) - triage

| item | real? | evidence | fix |
|---|---|---|---|
| [lint] `evidence-wiskey-relay-inv-2520.spec.ts:96` geometry read after a click without a wait | yes (spec) | `lint_spec_waits.py --new-since 3d71fb183`: 1 finding before, 0 after (PC and runner) | `522985143`: `settle(page)` before the read |
| [fe_static] 17 new file-local exports | yes | `unused-exports --enforce` OK at `07effe334`; tsc app / tests 0 errors; lint; the 11 files' unit specs 68 passed; `build:addon` output identical to the committed bundle (0 changed paths) - no new release rebuild | `977710cd8` (no `export`), `07effe334` (STARTABLE, jobCounts, WkReadState were dead code: removed) |
| [pixel] pixel_53 "No tests found / 0 tests" | yes (spec) | pixel_53 = the 54th entry of the engine's pixel list = `pixel-wiskey-schedule-reads-2520.spec.ts`; the engine runs pixel specs with `--grep pixel-stable` and no title said so. Runner, as the gate runs it: 8 passed, baselines unchanged | `522985143`: the two titles carry "is pixel-stable" |
| [backend] two "ids" that are log lines (`smplwise.events:db.py:386 ...`, `smplwise:main.py:195 ...`) | engine bug | `parse_pytest` took pytest's captured log lines ("ERROR    ...") as failed ids; the alone-retry got them as arguments and aborted ("file or directory not found", no summary) | `522985143`: only short-summary lines (one space, an id that starts with a .py path); `selftest_gate.py` case added - SELFTEST PASSED on the runner; engine re-installed (`engine_sync install --apply`, gate not running), `engine_sync check`: engine sha256 cb445b1cd4f48eaa = tree (one remaining WARNING: `~/gate2/gate_budget.py`, not in the default install set) |
| [backend] `test_soak_edges2_2450::test_g1_a_real_full_database_under_load` | no - load timing | never retried in run 1 (the retry aborted); alone on the runner at `07effe334`: 3 / 3 passed | - (the fixed retry gives it its alone-run next time) |
| [backend] `test_wiskey_media_v11::test_batches_are_never_sent_faster_than_real_time...` | no - load timing (a 0.022 s gap against a 0.030 s floor under the gate's load) | alone on the runner: 3 / 3 passed | - |

Next run: the hard failures were lint and fe_static only (no tsc / build / release_check / engine guard), all fixed on the branch; the
engine is re-installed from the branch. An `--after` run on the run-1 report is allowed by the engine; its spec lint uses `--new-since` the
report's sha (6d8fd71e1), so the lint fix is evidenced above, not by that run.

## 7. Release gate results and release

| Run | Head | Mode | Wall | Verdict |
|---|---|---|---|---|
| 1 | 6d8fd71e1 | full (base v2.51.0) | 199 min | FAIL: 2 hard (lint settle in evidence-wiskey-relay-inv-2520, 17 unused exports), pixel_53 zero tests (spec name lacked "pixel-stable"), 4 backend items misread by the retry (engine took captured log lines for test ids); 32 flaky |
| 2 | 20fc43ef9 | --after run 1 (16 files changed) | 34 min | PASS (0 hard, 0 test failures, 1 flaky: evidence-nvr-h264-bulk:54 desktop) |

Fixes between the runs: 522985143 (settle, exports, pixel spec name, engine log-line fix + selftest, engine reinstalled with engine_sync install --apply while no gate ran). The two backend tests passed 3/3 alone on the runner (load sensitivity).
Owner approval 26.11: "כן, לפרסם ולהתקין" (publish + lab install); the bridge 0.10.9 Home Assistant restart: "לא עכשיו" - the add-on copies bridge 0.10.9, the running bridge stays 0.10.8 until the owner approves a restart.
