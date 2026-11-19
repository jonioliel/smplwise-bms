# CR-BRIDGE-BUMP-RATCHETS-2460 - bridge 0.10.8, lowered design-debt baseline, lowered entry-chunk budget

2.46.0 row. Branch `pilot/CR-BRIDGE-BUMP-RATCHETS-2460`, base `origin/release/2450-train` at `521165ad4` (2.45.0 rebuilt UI).
Owner answers of 19.11: **N38** (bump the bridge version, with ONE approved lab Home Assistant restart that the lead performs at
release) and **N39** (lower the bundle-size budget after the first download shrank by about 25 %). Not touched: the add-on version,
`smplwise_vms/CHANGELOG.md` (the 2.46.0 release step writes its entry - text below), `management/tasks.json`, the lab, the runner.

## 1. Bridge 0.10.7 -> 0.10.8 (N38)

Why: two branches changed the bridge's files after 0.10.7 without a version bump - `CR-BRIDGE-GAPS-2438` (`2cf3ef683`) and
`CR-BRIDGE-COMMON-2440` (`ce1e19bab`, new `_common.py`); `git tag --contains` puts both in **v2.43.8** already (the 2.43.9 notes say
"bridge stays 0.10.7"). Since `WISKEY-RC4-2310` the add-on re-copies the bridge when its content digest differs, so those files most
likely reached the lab's `custom_components` at the 2.43.8 install - but the label stayed 0.10.7, so the add-on's bridge status kept
saying `active` (installed 0.10.7 = active 0.10.7) and never asked for the restart that loads them. With 0.10.8 the status reads
`update_pending` until Home Assistant has loaded the current files, and the bridge's ping reports which code is really running.

No bridge code changes here; only the version label and its history line.

| Where the bridge version lives | Change |
|---|---|
| `custom_components/smplwise_bridge/manifest.json` `version` | 0.10.8 |
| `custom_components/smplwise_bridge/const.py` `VERSION` + its history comment (the bridge's changelog) | 0.10.8, history line naming GAPS-2438 / COMMON-2440 and the one restart |
| `custom_components/smplwise_bridge/www/smplwise-card.js` `const VERSION` (also the Lovelace resource `?v=` query) | 0.10.8 |
| `smplwise_vms/integration/smplwise_bridge/` (the add-on image's copy) | regenerated with `py -3.12 scripts/sync_integration.py` (`--check`: up to date) |
| version pins in 19 backend test files (assertions only) | 0.10.7 -> 0.10.8: `test_bridge_080`, `test_bridge_config_drift`, `test_bridge_gaps_2438`, `test_bridge_key_activation_295`, `test_bridge_lease_event`, `test_bridge_media_players`, `test_bridge_media_policy`, `test_bridge_runnable`, `test_bridge_schedule_service`, `test_bridge_service_identity`, `test_bridge_stale_discovery_2383`, `test_bridge_stream_source`, `test_bridge_update_listener_2401`, `test_door_bridge_block_2404`, `test_extid_followups`, `test_lovelace_card`, `test_wiskey_adopt_2272_review`, `test_wiskey_s4_core_observer`, `test_wxh4_emergency_revoke_2407` |
| `test_bridge_common_2440`, `test_bridge_preverify_2440` | **unchanged**: their "0.10.7" is only a version string inside a signed payload sent to the add-on (any value works), as in CR-BRIDGE-RUNTIME-2436 |

`scripts/release_check.py` reads the manifest and `const.py` and checks both copies are identical. Nothing in the add-on needs a
newer bridge (`BRIDGE_EQUIPMENT_REQUIRED` 0.8.0, `BRIDGE_KAV_REQUIRED` 0.10.0, `BRIDGE_EXTENDED_REQUIRED` 0.9.6 - unchanged). No
pinned digest of the bridge exists (the WisKey contract examples use a placeholder), so the new content digest needs no edit.

### 1.1 What the lab needs at the 2.46.0 install (for the lead; nothing was done on the lab here)

1. **Install / update the add-on to 2.46.0 as usual.** At add-on start, `bridge_install.run_startup` copies the bundled bridge into
   `<ha config>/custom_components/smplwise_bridge` because the installed label (0.10.7) differs. Add-on log line to look for:
   `bridge integration 0.10.8 copied into Home Assistant's custom_components (N files); restart Home Assistant to load it`.
2. **Before the restart, check** the add-on's bridge status - System diagnostics screen, Home Assistant card, row "Integration install
   in Home Assistant" (or `GET /api/ha/status` -> `integration`): expected `state = update_pending`, `installed_version = 0.10.8`,
   `active_version = 0.10.7`. Stop and do not restart if it says `error` (`copy_failed:...`) or `not_available` (for example
   `manual_owner_upgrade_profile`: then nothing was copied and a restart would load nothing new).
3. **The ONE approved restart: restart Home Assistant Core only** (Settings > System > Restart Home Assistant > "Restart", or
   `ha core restart` over the approved SSH key). Not a host reboot, not a Supervisor restart, not an add-on restart. Custom
   integrations load only at Core start, so this restart is what loads 0.10.8 (and, if the lab has not restarted Core since the
   2.43.8 install, the GAPS-2438 / COMMON-2440 code for the first time).
4. **After the restart, check** (read-only):
   - Home Assistant log: no `smplwise_bridge` import / setup error; the integration "SMPLWISE Bridge" shows as loaded (not "Failed to
     set up") in Settings > Devices & services.
   - Add-on bridge status: `state = active`, `active_version = 0.10.8` (the bridge's ping at setup writes it); `paired = true`.
   - Directory push: "last directory" time (`bridge.last_directory_at`) moves within about 60 s (the periodic push); no refused-push
     reason (`addon_refused_signature`, `no_signing_key`) in the add-on's bridge health.
   - Lovelace: the bridge updates its own dashboard resource to `/smplwise_bridge/smplwise-card.js?v=0.10.8` at setup (a storage write
     by the bridge, as every bump does). A dashboard with the card needs a browser refresh to load the new file; the card works the same.
   - Doors: the bridge entry's options are untouched, so `wiskey_execute_policy` stays as it was (default `blocked`).
   - WisKey readiness (only if `wiskey.auto_install` is ON in the lab): the loaded distribution digest equals the installed one again,
     so readiness leaves `distribution_digest_mismatch`. With the switch OFF there is nothing to check.
5. **Rollback:** install 2.45.0 again; it copies 0.10.7 back (label differs) and needs one more Core restart (a new owner approval).

### 1.2 Text for the 2.46.0 CHANGELOG "Install" section (bilingual, for the release step)

- גשר 0.10.8: נדרשת הפעלה מחדש אחת של מערכת הבית כדי לטעון אותו (השינויים בגשר מ־2.43.8 נטענים בה). - Bridge 0.10.8: one home-system
  restart is needed to load it (it also loads the bridge changes shipped since 2.43.8).

## 2. Design-debt ratchet baseline lowered (`scripts/design_ratchet_baseline.json`)

`py -3.12 scripts/design_ratchet.py --update` on the base (it only lowers, never raises). Every metric that was lower than its
baseline was lowered to today's count, including the two the request did not name (native-table, scroll-container - `--update`
lowers all, and both counts went down with the 2.45.0 tables work):

| Metric | Before | Now |
|---|---|---|
| color-literal | 2500 | 2497 |
| px-literal | 25895 | 25495 |
| undefined-token | 14 | 0 |
| native-dialog | 3 | 3 (unchanged) |
| native-select | 582 | 551 |
| native-table | 109 | 78 |
| hand-switch | 378 | 361 |
| scroll-container | 230 | 229 |

px-literal: owner answer N3 (morning of 19.11) kept a margin "until every 2.43.9 branch has merged"; 2.43.9, 2.44.0 and 2.45.0 are
all merged now, so the margin's condition is met. Effect for the 2.46.0 train: any branch that ADDS one of these patterns (counted on
the merged tree) now fails the ratchet at the train merge and must remove one elsewhere or get an owner-approved `--allow-raise`.

## 3. Entry-chunk budget lowered (`frontend/scripts/gates-baseline.json`, N39)

The blocking `fe_static` bundle check (`npm run gate:budget` = `node scripts/bundle-budget.mjs --dir dist --enforce`) reads
`bundle.measured`, `bundle.marginPct` and `bundle.budget` from this file; `tests/unit-entry-chunk.spec.ts` pins
budget = ceil(measured x (1 + marginPct/100) / 1000) x 1000 and **marginPct <= 5**.

| | Before | Now |
|---|---|---|
| measured gzip / raw | 1,069,016 / 3,609,730 (2.43.8 train) | **807,703 / 2,810,184** (`vite build` of this branch = 2.45.0, Windows; the runner's 2.45.0 add-on build: 807,666 / 2,810,141) |
| marginPct | 3 | **5** |
| budget gzip / raw | 1,102,000 / 3,719,000 | **849,000 / 2,951,000** |

Why 5 % and not the ~10 % the request named: the unit spec caps the margin at 5 % (`CR-FE-GATES-ENFORCE-2442`, whose margin
question proposed 3 %), and raising that cap is a change to a guard rule, not just a number. 5 % is the most room the existing rule
allows: 41 KB gzip / 141 KB raw above today's entry - enough for a build on Linux and normal shell growth, too small for a screen to
land in the entry (the on-demand screen chunks are 70-270 KB raw), which is the check's purpose. The old budget had 294 KB gzip of
slack, so it no longer caught anything. If the owner wants 10 %: `marginPct` 10 -> budget 889,000 / 3,092,000, plus the spec's cap
raised to 10 (one line in `unit-entry-chunk.spec.ts`).

N39 said "after the next nightly run": this branch boards the 2.46.0 train, which runs after the night of 19-20.11, so the lower
budget takes effect after that nightly.

## 4. Tests (workstation, Windows; nothing on the runner or the lab)

| Run | Result |
|---|---|
| `py -3.12 scripts/release_check.py` | every check ok (bridge 0.10.8 consistent, copies identical, ratchet ok) except `git tag for this version: v2.45.0 not yet` - expected, the base's own release tag is not created yet |
| `py -3.12 scripts/sync_integration.py --check` | up to date |
| `py -3.12 scripts/design_ratchet.py` (after `--update`) | no count above the baseline |
| `npm run build` (tsc + vite) then `npm run gate:budget` | build ok (7 min 14 s); budget check exit 0, entry gzip 807,703 within 849,000, raw 2,810,184 within 2,951,000, 0 mock modules |
| `node scripts/bundle-budget.mjs --enforce` on the committed `smplwise_vms/www` | within budget (807,666 / 2,810,141) |
| `npx playwright test -c playwright.unit.config.ts tests/unit-entry-chunk.spec.ts --workers=1` | 14 passed |
| bridge backend tests (below) | see BRIDGE_TESTS |
| `ruff check` on the 21 touched Python files | no new finding (same count per file as on the base: 15 pre-existing in 6 test files) |

## 5. Rollback

Revert the commit(s). For the bridge part, run `py -3.12 scripts/sync_integration.py`; an installation that already loaded 0.10.8
gets 0.10.7 copied back and needs one more Home Assistant restart. The two baseline files only loosen again.
