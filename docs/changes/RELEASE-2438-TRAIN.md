# RELEASE-2438-TRAIN: assembly of the 2.43.8 train (first part - the branches whose entry check is GREEN)

Branch `release/2438-train` (worktree `C:\cloude\smplwise-train48`), cut from `origin/main` = v2.43.7 (`cc69447f1`). Assembled
2026-11-17 by the release-train agent on the lead's delegation, so that the release gate can start as soon as the last pending
branches turn green. **Not done here, by instruction:** no tag, no push of `main`, nothing run on the runner, no add-on UI build
(`smplwise_vms/www*` is rebuilt by the lead on the runner), no version / changelog commit. No lab, Home Assistant, NVR, go2rtc,
WisKey or device contact.

The GREEN verdicts were given by the lead (handoff `READ_FIRST_2026-11-16-PM.md`, entries of 17.11); the verdict files on the
runner were **not** re-read here (no runner access in this task). Every merge is of the exact SHA below, which was also the
branch's `origin` head at merge time.

## 1. Merges (`--no-ff`, in this order)

| # | Branch | SHA merged | Merge commit | Conflicts |
|---|---|---|---|---|
| 1 | `pilot/PLAN3D-R32-ANSWERS-2438` - 3D map, the owner's round-32 answers | 62187c44c | b5db2bdee | 1 file (below) |
| 2 | `pilot/TEST-STABLE-2442` - home mocks pinned to noon, intercom-cards settled wait | f8a9869a0 | ff4d85420 | none |
| 3 | `pilot/FLAKY-S12-FIX-2441` - S12 fix, six mobile baselines | 3a764f953 | 192cdece6 | none (`system-access-display.ts` identical to 2, as its note says) |
| 4 | `pilot/DIALOG-DRAWER-ONE-2439` - one dialog, one drawer | e7a9fcf52 | 2eabacc93 | none |
| 5 | `pilot/CR-MODAL-STACK-2441` - the modal stack (contains 4) | 436fdb701 | f1593e2fd | none |
| 6 | `pilot/CR-W3-BE-COMBINED-2441` - code-review wave 3, backend | 35bcf973e | 93b3c1dd2 | none |
| 7 | `pilot/CR-W3-FE-COMBINED-2441` - code-review wave 3, frontend | 68db28df0 | 321a9f4cc | 2 files (below) |
| 8 | `pilot/FIX-ICON-TEST-2442` - test-only: the backend icon test reads `icon-paths.ts` (contains 7) | e7394f8d4 | 993ac273e | none |
| 9 | `pilot/CR-I18N-COMBINED-2441` - English switch, core codemod, home / calendars / electricity / map / plan wizard | 910a7dbc0 | 853fb33f9 | 62 files, 105 hunks (below) |

Order: the small and the contained first (4 before 5, 7 before 8), the backend wave before the frontend wave, the translation
branch last because it touches the text of almost every screen the others restructure.

Train commits after the merges: `a34698b59` and `c7b5cca05` (`fix(merge)`, section 3), then this document.

**Skipped as contained:** none. Two branches are ancestors of a later one (4 in 5, 7 in 8); each was merged first so that every
SHA of the list has its own merge commit, and the later merge then brought only the difference.

git rerere (shared) replayed nothing for these merges; every resolution below is now recorded in it.

## 2. Conflicts and resolutions

### Merge 1 (`b5db2bdee`) - `smplwise_vms/backend/smplwise/routers/settings.py`

The branch (cut from 2.43.6) edited `DEFAULTS` in the router; 2.43.7 (`CR-SETTINGS-STORE-2436`) moved that table to
`services/settings_store.py`. The store layout kept; the branch's two edits ported into the store at the same keys:
`map.room_card_camera` default `"live"` (was `"snapshot"`, owner Q-MAP-6 b) and the `map.stack_backdrop` comment
(`theme | light | dark`). The `SettingsPatch` pattern `^(theme|light|dark)$` auto-merged in the router. Checked: the branch's diff
of the router against its merge base has exactly these two `DEFAULTS` hunks and the pattern line.

### Merge 7 (`321a9f4cc`)

- `frontend/src/api/nvr.ts`: `CameraSmart` keeps `writes_enabled` (CR-NVR-GUARD-2438, came with merge 6) and the smart / channel-name
  calls use the `path` tag of W3-FE.
- `frontend/src/tickets/settings-locations.ts`: the remove question stays on `confirmDialog` (DIALOG-DRAWER-ONE) and reads its
  text through `loct` (W3-FE renamed `lt`).

### Merge 9 (`853fb33f9`) - 62 files

The translation rows wrapped the Hebrew texts in `tr()` on lines that merges 1, 4, 5, 7 and 2 had moved or rewritten. One rule
for every hunk: **the train's structure, the translation row's `tr()` around the text.** The resolutions were applied by a
script with one explicit instruction per hunk (kept side, or exact text replacements that had to match once), not by hand editing.

| Files | Resolution |
|---|---|
| 26 files, imports only (`calendars/view-rooms`, `electricity/elec-format`, `meter-card`, `map/walk-world`, `screens/automation-editor-base`, `devices-area`, `devices-*-admin` x3, `electricity/page-meters`, `investigate-events`, `-exports`, `-history-map`, `live-overview`, `live-wall`, `mapping-assistant`, `mapping-health`, `multimedia-screens`, `nvr-camera-batch`, `system-calendar-sync`, `system-calendars`, `system-design`, `system-devices`, `system-look`, `system-nav-size`, `system-palette-editor`, `system-presence`, `system-mapping`) | both sides' imports; where W3-FE removed a constant or an import the translation row still carried (`PAGE`, `defaultLevelId`, `applyMultimediaKinds`, `Phase`, the eager `MappingAssistant` import) it stays removed |
| `tickets/*-text.ts` (16) | the CR-TK-CATALOGUE-2440 shape (`makeCatalogue`, `catalogue.t`, `catalogue.KEYS`) plus the i18n core's `registerCatalogue('tickets/...', { he, en })` line and its import |
| `calendars/view-approvals.ts`, `view-manage.ts`, `view-maint.ts` | the `sw-dialog` of DIALOG-DRAWER-ONE and the paged / scroll switch of PAGING-SETTING; their texts through `tr()`. The table key `דחיית בקשה` (the old panel's aria-label) is no longer used and was removed from `msg/calendars.ts` |
| `components/sw-dialog.ts`, `sw-sheet.ts` | the modal stack (`modal-stack.ts`) instead of the local `OPEN_STACK` / `deepActive`; `sw-dialog`'s close label stays `t('actions.close')` (already bilingual), so its `tr` import is not added |
| `components/sw-icon.ts` | the path table stays in `icon-paths.ts` (CR-ICONS-PALETTE-2440); the `globe` glyph of the English switch was added there (fix commit) |
| `electricity/meter-card.ts`, `screens/electricity/page-meters.ts` | the shared bases of W3-FE (`meter-card-base`, `meters-page-base`); the texts the subclasses hand to the base (`TEXTS`, `actionsRow`, `rangeSeg`, load error) go through `tr()` |
| `map/floor-finish.ts`, `plan-wizard/plan-wizard.ts`, `wizard-model.ts` | the round-32 finishes (polished Calacatta, travertine) and the six kits; names and notes through `tr()`. The sentence "more kits will be added later" is gone with the six kits and its key was removed |
| `screens/automation-editor-base.ts` (7 hunks) | the save gate by code (`automation-save-gate.ts`, `warningsOnly`) and `dlgFoot()`; every text through `tr()` |
| `screens/devices-camera-card.ts` | the `sw-dialog xl` of DIALOG-DRAWER-ONE (its own close button; the old bar's "סגור" is gone) |
| `screens/devices-climate-kind-admin.ts`, `-protected-switches-admin.ts`, `-type-admin.ts` | the shared override base (`errorCard`, `loadingCard`, `place`); headings and error texts through `tr()` |
| `screens/investigate-events.ts`, `investigate-playback.ts`, `schedule-editor.ts`, `system-calendar-sync.ts`, `system-calendars.ts`, `system-tickets.ts` | line by line, the side that changed the line: W3-FE's `onRowSelect`, `wantThumb`, `perPageFor`, `views()`, `loct`, the local `tz`; the translation row's `tr()` text |
| `screens/mapping-health.ts`, `multimedia-groups.ts`, `multimedia-players.ts`, `multimedia-screens.ts` | W3-FE's moves kept (the chip in `mapping-health-chip.ts`, `connectedCallback` in `multimedia-base.ts`) |
| `screens/system-home-screen.ts` | the long-lists row stays removed (PAGING-SETTING moved it to the interface design settings) |
| `screens/system-mapping.ts` | the lazy assistant loader; `start: 'decide'` (W3-FE dropped `MappingAssistant.hasDecisions` with the eager import) |
| `tests/home-simple-mocks.ts` | the real `/intercom/overview` shape of the talk fix (I18N-HOME) with the pinned clock `opts.now ?? Date.now()` (TEST-STABLE) |

### Built UI (`smplwise_vms/www`, `www-public`)

No merge conflicted there. Note for the lead: merge 6 (W3-BE) carries main's 2.43.7 build **minus its 282 `.map` files and
the 282 `sourceMappingURL` comments** - that branch's own state, required by its new build guard (CR-BUILD-GUARDS-2438:
`release_check.py` reports a `.map` in the add-on as a finding). Nothing was stripped or restored by this train; the runner
build replaces the folder anyway.

## 3. Merge interactions fixed in `fix(merge)` (no textual conflict; found by the checks)

| What | Cause | Fix |
|---|---|---|
| `tests/unit-i18n-core` x3: `i18n/confirm-dialog.ts` reads `<html lang>` itself, does not register, `CD_DEV_MARKED` unread | the catalogue is new in DIALOG-DRAWER-ONE; the core codemod (CR-I18N-CORE-2441) had not seen it | `docLang(['en','ar','ru'])` and `registerCatalogue('i18n/confirm-dialog', ..., CD_DEV_MARKED)`; same tables and exports |
| `tests/unit-no-native-dialogs`: "native alert()" in `i18n/wiskey-installer.ts` | the guard (DIALOG-DRAWER-ONE) read the English catalogue text `'Offline alert (seconds)'` (English switch) as a call | guard only: an unqualified call has its bracket right after the name (a qualified `window.alert (` may keep a space); a self-test case added. Product text unchanged |
| `tests/unit-icon-registries`: registry names differ by `globe` | the English switch added the glyph to the table W3-FE moved and pinned | `globe` added to `icon-paths.ts`; the fixture gains its hash (486 icons) |
| `tests/unit-i18n-cal-elec-*`, `unit-i18n-map-wizard-2441` (lint, completeness, unused keys) | new Hebrew of the train's branches in the linted folders, and keys whose text is gone | texts wrapped; English added for the new texts (`msg/map.ts`: polished Calacatta marble, travertine; `msg/plan-wizard.ts`: three kit names and three notes); unused keys removed (`שיש`, the "more kits later" sentence, `דחיית בקשה`) |
| `tests/unit-modal-stack-2441:160`: `sw-dialog.ts` keeps a private focus walk (`shadowRoot?.activeElement`) | the walk is main's 2.43.7 gate fix (`b19e99165`: a field focused in the frame before keeps the focus); CR-MODAL-STACK-2441 was cut before it and forbids such copies in the three primitives | the same walk, unchanged, is now `focusWithin(host)` in `components/modal-stack.ts`; `sw-dialog` calls it |
| translations lost by W3-FE's moves (no test) | text the translation rows had wrapped now lives in a W3-FE module | `automation-save-gate.ts` (`GATE_TEXT`), `devices-override-admin.ts` (`place`), the three multimedia `editEntry` labels, `plan-wizard/wizard-prefs.ts` (`KIT_HE`) wrapped with their existing keys; `mapping-health-chip.ts` takes its four words from `msg/shell.ts` (the chip is in the entry chunk - the shell table is already there, the settings family's table is not) and `unit-home-lazy-2440` lists that one new import |

English wording added here (six plan-wizard texts, two finishes) is the assembler's; the glossary owner may want to review it.

### NOT fixed here - a gate blocker for the lead: the design-debt ratchet (colour literals 2520 > 2512)

`tests/test_build_guards_2438.py::test_the_checkout_is_at_or_below_its_baseline` fails on the train, and `scripts/release_check.py`
will report the same: `color-literal 2512 -> 2520`. Every other metric is at or below its number.

The ratchet and its baseline (`scripts/design_ratchet_baseline.json`, CR-BUILD-GUARDS-2438) arrive with merge 6; the branches cut
from main never ran against it. Counted per tree with `scripts/design_ratchet.py` (`scan`):

| Tree | `color-literal` |
|---|---|
| main 2.43.7 | 2511 |
| W3-BE tip (the baseline's owner; baseline 2512) | 2511 |
| W3-FE tip | 2504 (-7) |
| PLAN3D-R32 tip | 2516 (+5: `map/floor-finish.ts` +2 travertine tints, `map/room-pill-view.ts` +2, `screens/automation-editor-base.ts` +1) |
| MODAL-STACK tip (with DIALOG-DRAWER-ONE) | 2521 (+10: `components/sw-drawer.ts` +12 and `components/sw-dialog.ts` +4, all `#000`; -6 elsewhere) |
| I18N-COMBINED tip | 2511 |
| the train | 2520 |

Raising a baseline needs the owner's approval (the script's own rule, `--update --allow-raise`), and replacing the sixteen `#000`
by a token touches the pixels of two GREEN branches - so neither was done here. The lead's choice before the gate: (a) raise
`color-literal` to 2520 with the owner's approval, or (b) remove eight literals (the `#000` of the dialog / drawer shadows are
the obvious candidates) and re-check the dialog / drawer pixels. (On this workstation the same test also prints a cp1255 decode
warning from the script's `git show` reader; that is local and does not change the verdict.)

## 4. Tests actually run (workstation, main checkout `.venv` Python 3.12, Node 24.21.0, `frontend/node_modules` junction)

| Check | At | Result |
|---|---|---|
| `npx tsc --noEmit` (frontend) | after the nine merges and the first fix commit (`a34698b59` tree) | exit 0 |
| `npx tsc --noEmit` | `c7b5cca05` (after the `focusWithin` fix) | exit 0 |
| backend `python -c "import smplwise.main"` (main checkout `.venv`) | the merge-9 tree (no backend change after it) | import ok |
| backend, `-p no:xdist`: `test_map3d_r28_settings_2433`, `test_plan_view_settings`, `test_setting_value_parity`, `test_user_prefs`, `test_video_services_2431` (the files around the one backend conflict, `routers/settings.py`), `test_device_layouts` (FIX-ICON-TEST), `test_build_guards_2438` | `a34698b59` tree | 121 tests: **120 passed, 1 failed** - `test_the_checkout_is_at_or_below_its_baseline` (the ratchet above, not fixed) |
| Playwright unit config, every `tests/unit-*.spec.ts`, `--workers=1` (covers the specs that read the 64 conflicted frontend files) | `a34698b59` tree | 4727 tests: **4711 passed, 10 skipped (declared), 6 failed**: `unit-modal-stack-2441:160` (fixed after the run, below) and the five cases of `unit-session-me-failure-2435` - a browser spec the node config picks up by mistake (it needs a preview server; the same five fail on every branch, see the handoff) |
| the unit specs that read `sw-dialog.ts` / `modal-stack.ts`, after the `focusWithin` fix | `c7b5cca05` tree | 7 spec files, 44 passed, 0 failed (`unit-modal-stack-2441` included) |
| `scripts/design_ratchet.py` (`scan` per tree) | 11 trees | the table above |
| `git merge-tree --write-tree` dry runs of the five pending branches | head | section 7 |

Before the fixes the same node specs showed, at the merge-9 tree: `unit-i18n-core` 3 failed, `unit-i18n-cal-elec-lint` 2,
`unit-i18n-cal-elec-completeness` 2, `unit-icon-registries` 1, `unit-no-native-dialogs` 1 (section 3).

## 5. NOT_RUN

- The runner: entry checks, the full release gate, pixel / evidence / layout suites, baselines. Nothing was run there.
- The browser projects (desktop / tablet / mobile) of every Playwright spec, `vite build`, `npm run build:addon`.
- The full backend suite (only the files named above).
- The verdict files of the nine entry checks (runner) were not re-read.
- Version, changelog, API inventory, `scripts/release_check.py`: not done - the train is not complete.
- `management/tasks.json`, `test_catalog.json`: not changed; no view regenerated.

## 6. Open items for the lead

- `screens/system-plan-view.ts` and `api/plan-view.ts`: the round-32 "3D map" settings card and labels (PLAN3D-R32) are new text
  that no translation row has seen - they stay Hebrew in the English interface (`screens/` and `api/` are not under an i18n lint
  yet; `api/plan-view.ts` is in CR-I18N-COMBINED-C's conflict list below).
- `msg/media.ts` keeps the chip's four keys and `msg/system-a.ts` the three long-lists keys although their texts moved (no
  unused-key rule on those tables).
- Pixels: nothing was refreshed. Merges 1, 4, 5 and 7 each brought their own runner baselines; the translation merge changes no
  Hebrew pixel by design. Baselines that two branches re-took for the same screen did not conflict.

## 7. Branches still pending (entry check not GREEN yet) - merge hints

Dry runs against this train's head (`git merge-tree --write-tree`, heads as of 17.11 evening; a head that moves needs a new look):

| Branch | Head seen | Hints |
|---|---|---|
| `pilot/CR-MODAL-STACK-B-2442` | e99a8cba0 | Contains CR-MODAL-STACK-2441 and DIALOG-DRAWER-ONE (both already here): only its own two commits arrive. Expected conflicts (2, small): `frontend/src/home/sw-home-call.ts` - imports, keep both (`tr` of the home row and `HandModal`); `frontend/src/screens/devices-building.ts` - `updated()`: keep both bodies (W3-FE's `warmHomePanels` block with its three fields, and the branch's `treeLayer` + `syncLayer(...)`). Then run `unit-i18n-home`, `unit-home-lazy-2440` and `unit-modal-stack-guard-2442` |
| `pilot/CR-W2-FOLLOWUPS-2441` | 59e4215fe | Contains CR-W3-BE-COMBINED-2441 35bcf973e (already here). Dry run: **no conflict**. Its note: the `bill_ledger` golden was regenerated for the `auto` section (staff notification candidates only). Backend only |
| `pilot/CR-LOCAL-ID-SWITCH-2442` | f817bf7ae | Base main, one commit. Expected conflict: `frontend/src/i18n/local-identity.ts` only (the switch's new keys next to lines the core codemod / English switch rewrote in the same table) - keep the train's lines and add the branch's new keys in each language table; run `unit-i18n-core` and the branch's own spec |
| `pilot/CR-I18N-COMBINED-C-2442` | 89d53b12d | Contains CR-I18N-COMBINED-2441 (already here) + DATES + API + UNITS + CONFIRM-WORDS (COMBINED-B is inside it). Expected conflicts: `frontend/src/api/automations.ts`, `cases.ts`, `events.ts`, `notifications.ts`, `plan-view.ts`, `rules.ts` (the api-layer `tr()` vs W3-FE / PLAN3D-R32 edits - same rule as merge 9; in `plan-view.ts` wrap the new round-32 labels too), `smplwise_vms/backend/smplwise/routers/capture_lease.py` (imports: keep both, `_common.rid` and `services.confirm_words`) and `routers/settings.py` (three hunks: W3-BE split the PATCH into `routers/settings_patch/` - keep `settings_patch.apply(...)` and the short import line, and move the branch's change into the split: `ALLOW_DISARM_WORD` / `LOCAL_PURGE_WORD = confirm_words.he(...)` belong in `settings_patch/identity.py`, which re-exports them; whatever the branch changed inside the old inline PATCH body must be ported to the matching `settings_patch` module, not pasted back into the router). After it: `unit-i18n-api-2442` allow-list (union of removals), `unit-confirm-words-2442`, backend confirm-word tests. Merge it after MODAL-STACK-B and LOCAL-ID so its lint sees their texts |
| `pilot/DOMUS-DEFAULT-2439` | 98d8d4b44 | Merge **last** (it changes the default skin, so every default-skin baseline). Expected conflicts: `docs/design/system/DESIGN.md`, `frontend/src/design/skins/domus.ts`, `screens/automation-drawer.ts`, `infra-temperature.ts`, `mapping-assistant.ts`, `multimedia-screens.ts`, `schedule-create-dialog.ts`, `system-automations.ts`, `smplwise_vms/backend/smplwise/main.py` (W3-BE moved the after-migration steps to `startup_steps.after_migrate(...)`: keep that one call and port the branch's one-time `skin_switch.run_once` step into `startup_steps` in the same place of the order, without a commit by hand), and 16 baselines: `audit30-f-calendars` x2, `evidence-replay-3d` x10, `pixel-plan-wizard-2433` x2, `pixel-plan-wizard-2434` x2. For a baseline both sides re-took neither file is right after the merge: take the branch's (Domus) file to finish the merge and refresh on the runner before the gate - its note lists `pixel-home-fb-2431`, `pixel-home-gaps-2436`, `pixel-home-auditfix-2437` and the T087 3D determinism set (`~/pre/domus_t087_refresh.sh`); add the plan-wizard step 5 (six kits) and replay-3d shots (low cut, travertine) that PLAN3D-R32 re-took |

Suggested order for the rest: W2-FOLLOWUPS, LOCAL-ID-SWITCH, MODAL-STACK-B, I18N-COMBINED-C, DOMUS-DEFAULT; then the version
commit (2.43.8, changelog, API inventory), the runner build and the gate.

After the merge of the backend chain (not in this release unless the lead adds it): CR-PYFLAKES-ENFORCE needs the `~/gate2`
scripts synced and ruff on the runner (handoff note).

## 8. Rollback

The train is a branch; `main` is untouched. Dropping a branch from the train = rebuilding the train without its merge (the 2.43.6
precedent, `release/2436-train-r2`); the rerere records of section 2 replay the resolutions.


---

# Part 2 (18.11 evening) - the remaining branches, owner acceleration (c)

Owner decision 18.11 08:35 (handoff `READ_FIRST_2026-11-16-PM.md`, "acceleration a+b+c"): every remaining branch merges into this
train **without waiting for its own entry verdict**; then ONE release gate on the train, fixed forward with targeted re-runs. Every
SHA below was the branch's `origin` head at merge time (`git fetch` just before). The entry verdicts read on the runner
(`~/smplwise-results/entry_pilot-<branch>_<sha9>.md`) at merge time are listed for information only.

## 9. Merges (`--no-ff`, in this order)

| # | Branch | SHA merged | Entry verdict (information) | Merge commit | Conflicts |
|---|---|---|---|---|---|
| 10 | `pilot/CR-W2-FOLLOWUPS-2441` - wave-2 backend follow-ups (contains W3-BE, already here) | c193fab64 | GREEN | 8f90151d3 | none |
| 11 | `pilot/CR-LOCAL-USER-CREATE-2438` - Arx user create sends, admin-set password (contains CR-LOCAL-ID-SWITCH-2442 f817bf7ae, not merged separately) | e26f001ec | RED: 2 x `evidence-tickets-drawer` :40 / :87 [mobile] (fixed by merge 18) | 7f593b53e | 2 files (below) |
| 12 | `pilot/CR-MODAL-STACK-B-2442` - the hand-built dialogs join the modal stack | e99a8cba0 | GREEN | 69a198901 | 2 files (below) |
| 13 | `pilot/CR-I18N-COMBINED-C-2442` - durations / units, typed confirmation words (contains COMBINED-B) | 590f53d85 | still running at merge time | 317a63fcc | 9 files (below) |
| 14 | `pilot/DOMUS-DEFAULT-2439` - Domus the default skin, the strengthened selected chip | 2771a0b90 | RED: 1 x `evidence-media-queue:425` [desktop] (fixed by merge 18) | 69079a5cd | 9 text files + 16 baselines (below) |
| 15 | `pilot/FIX-CAMVF-FLAKE-2443` - the viewfinder shot goes to review at once | b2b57e734 | GREEN | 93a45f2cb | none |
| 16 | `pilot/CR-UI-POLISH-2443` - "my screen" first read (data-loss fix), plan-view card translated | 6ee4fa70a | not queued (by instruction) | fe078d867 | 1 file (below) |
| 17 | `pilot/CR-COLOR-LITERALS-2443` - 8 colour literals to tokens, ratchet 2520 -> 2500 | b5e294ee1 | not queued | 1adb0b646 | none |
| 18 | `pilot/FIX-2438-REDS` - fixes for the RED entries of 11 and 14 (lead instruction, added after 17) | f002e41eb | not queued | 5bcea468d | none (`media-ma-connection.ts` unchanged on the train since aa20f05ae) |

## 10. Conflicts and resolutions (part 2)

### Merge 11 (`7f593b53e`)
- `smplwise/services/local_identity.py` `_Cache`: the train (W3-BE, code review P2-4) moved the cache onto the shared
  `services/session_cache.py`, whose **ended keys** (`ENDED_KEEP_S` = 300 s, refused by `put`) already close the exact race the
  branch's second commit fixed with its own `DROP_HOLD_S` (30 s) / `_dropped`. Kept the shared cache; the branch's copy (constant,
  `put` override, `drop_chains` bookkeeping) dropped. `tests/test_local_session_cache_race_2438.py`: the three race cases are
  unchanged and pass on the shared cache; the "hold ends" case now ends the hold through `session_cache.ENDED_KEEP_S` (test-only
  adaptation, stated in the file). `app_session.py` (the branch note: "same cache shape - not checked") uses the same shared cache
  on the train, so it has the rule too.
- `frontend/src/i18n/local-identity.ts` (English table): the train's translated keys kept; the branch's new `off` text and its switch
  keys (`offNotAdmin`, `onState`, `switchOn` / `switchOff`, their bodies, `switchedOn` / `switchedOff`) in place of the old `off`.
  No duplicate key in the table (checked).

### Merge 12 (`69a198901`)
Only the branch's own two commits arrive (MODAL-STACK and DIALOG-DRAWER-ONE are already here); `components/modal-stack.ts`
auto-merged beside the train's `focusWithin` (c7b5cca05).
- `home/sw-home-call.ts`: imports - both (`tr`, `HandModal`).
- `screens/devices-building.ts` `updated()`: both bodies - W3-FE's `warmHomePanels` block and its three fields, then the branch's
  `treeLayer` field and `syncLayer(...)`.

### Merge 13 (`317a63fcc`)
- `api/automations.ts`, `events.ts`, `notifications.ts`: imports - both. `api/cases.ts`, `rules.ts`: the train's client import (W3-FE
  `path` / `query` tags) plus the `tr` / `trTime` imports.
- `api/plan-view.ts`: the train's labels (round-32 keys, polished Calacatta, travertine) wrapped in `tr()` - replaced by merge 16.
- `routers/capture_lease.py`: imports - both (`_common.rid`, `services.confirm_words`).
- `routers/wiskey_lineage.py`: the train's `require_system_admin` import (W2-FOLLOWUPS) plus `services.confirm_words`.
- `routers/settings.py` (3 hunks): the train's layout (W3-BE split the PATCH into `routers/settings_patch/`); the router is
  byte-identical to the train's. The branch's changes were ported into the split, not pasted back: `settings_patch/identity.py`
  takes `ALLOW_DISARM_WORD` / `LOCAL_PURGE_WORD` from `confirm_words.he(...)` (the router still re-exports them), both checks accept
  the typed word through `confirm_words.typed_lang(...)`, and both audit rows carry `confirm_word`; the disarm word reaches its
  after-store audit row through a new `Patch.disarm_word` field (`settings_patch/__init__.py`).

### Merge 14 (`69079a5cd`)
- `design/skins/domus.ts` "domus 9": **the train's rule kept** (DIALOG-DRAWER-ONE, owner round 33 Q-DES-8A / 8B: one opaque dialog
  and drawer, no blur; the skin adds only the lit top edge). The branch's version put the glass sheen, the sheet blur and
  `--sw-r-xl` back on the dialog. Its reason - inside a device screen the layer must keep the palette's own solid surface, or a dark
  palette draws light text on a light sheet - is already met on the train: `sw-dialog` / `sw-drawer` paint `var(--sw-menu-surface)`,
  which `styles/devices-themes.ts` points at `--dv-surface-solid` on a device screen. (`--dv-sheet-sheen`, set by the branch, is
  now read by nothing; harmless.)
- `docs/design/system/DESIGN.md`: one question left OPEN (§13.3); §13.1 (dialog / drawer, train), §13.2 (selected chip, branch)
  and the default skin are decided.
- `smplwise/main.py`: the train's single `startup_steps.after_migrate(...)` call (CR-MAIN-ROUTERS-TABLE-2440). The branch's one-time
  `skin_switch.run_once` step is `startup_steps.move_classic_skin_once`, second in `AFTER_MIGRATE` (right after
  `keep_home_interface_defaults`, its place in the old inline order), guarded exactly as before; `tests/test_routers_table_2440.py`
  lists it.
- `screens/automation-drawer.ts`, `infra-temperature.ts`, `mapping-assistant.ts`, `schedule-create-dialog.ts`,
  `system-automations.ts`: imports - both (`tr` / `LongListsController` / `OneAtATime` and the branch's `chip-selected`).
- `screens/multimedia-screens.ts`: the train's imports (W3-FE moved `applyMultimediaKinds` and `Phase` to `multimedia-base`) plus
  `chip-selected`.
- `screens/devices-building.ts` `disconnectedCallback`: both (`removeLayer` of merge 12, the branch's fit-observer teardown).
- 16 baselines both sides re-took (`audit30-f-calendars` x2, `evidence-replay-3d` x10, `pixel-plan-wizard-2433` x2,
  `pixel-plan-wizard-2434` x2): the branch's (Domus) file to finish the merge, then refreshed on the runner (section 12).

### Merge 16 (`fe078d867`)
- `api/plan-view.ts`: the branch's version (its own table `i18n/msg/api-plan-view.ts`). Per its merge hint vs I18N-COMBINED-C: the 39
  plan-view keys dropped from `i18n/msg/api-home.ts`, and `msg/api-plan-view` added to `TABLES` in
  `tests/unit-i18n-api-2442.spec.ts`.

The design-debt ratchet after all merges (`scripts/design_ratchet.py`): every metric at or below its baseline; `color-literal`
2500 = baseline 2500 (merge 17 lowered it; the domus.ts resolution keeps the branch's glass rule out).

## 11. Train commits after the merges (part 2)

| Commit | What |
|---|---|
| 18e0ebdb6 | test(pixel): the 16 baselines of merge 14 refreshed on the runner (section 12) |
| b69abad89 | fix(merge): `tests/test_confirm_words_2442.py` lists `routers/settings_patch/identity.py` (not `routers/settings.py`) among the callers of `confirm_words.typed_lang()` - the consequence of the merge-13 port |
| 21e4ef10d | release: 2.43.8 - version (config.yaml, Dockerfile label, `__init__.py`), bilingual changelog, API inventory (1909 routes, header only) |
| 59ec7cde6 | release: 2.43.8 - rebuilt UI (`npm run build:addon` on the runner at 21e4ef10d) + this section. **The release gate started on this head** (18:02 UTC) |
| 04f735276 | fix(merge): `i18n/msg/api-home.ts` keeps `'אוטומטי'` ('Automatic') - merge 16 dropped it with the 39 plan-view keys, but `api/tile-layout.ts` reads it too (`unit-i18n-api-2442` 1 failure, found by another agent on 5bcea468d; `i18n_missing_keys` 21 -> 20 = the committed report). The other 38 dropped keys have no other reader (checked by script). Pushed after the gate had started on 59ec7cde6 |
| (next) | release: 2.43.8 - rebuilt UI at 04f735276 (`~/work/build_ui2438b.sh`, rc=0, 319 maps archived, tarball sha256 `1256bd1c...bdc06ed` checked after the copy; 0 `.map`, 0 `sourceMappingURL`). The gate's targeted re-run (`--after` its report) covers it |

No migration (0216 stays the last). Bridge stays **0.10.7**: the wave-3 bridge refactors (CR-BRIDGE-COMMON-2440, CR-BRIDGE-GAPS-2438)
change the integration's files without a version bump, so an installed 0.10.7 keeps its old files (behaviour-compatible; the add-on
does not depend on them). The bump (manifest, `const.py`, card `VERSION`, the test pins) and the Home Assistant restart it needs are
an open item for the lead / owner (section 14).

### Built UI
`npm run build:addon` on the runner (`~/work/build_ui2438.sh`, the 2.43.7 script with the names changed; worktree
`~/work/rel-build2438` at 21e4ef10d, node_modules linked, nice 10, no tests lock): DONE rc=0. The build's own
`scripts/sourcemaps-archive.mjs` (CR-BUILD-GUARDS-2438) moved 319 `.map` files to `~/smplwise-results/sourcemaps/2.43.8/` and removed
319 `sourceMappingURL` comments - no hand stripping. Tarball `/tmp/ui2438.tgz` sha256 `8f7c86eb...b64d7e77832`, checked after the copy;
`smplwise_vms/www` and `www-public` replaced from it: 0 `.map` files, 0 `sourceMappingURL` comments.

## 12. Receipts (part 2)

Workstation: Python 3.12 (main checkout `.venv`), Node 24.21.0, `frontend/node_modules` junction to the main checkout.

| Check | At | Result |
|---|---|---|
| backend `test_local_session_cache_race_2438`, `test_local_user_create_2438`, `test_local_identity` (`-p no:xdist`) | merge-11 tree | 56 passed, 0 failed |
| `npx tsc --noEmit` | 1adb0b646 (merges 10-17) | exit 0 |
| backend, the 28 test files the merges changed + 14 around the conflicts (`test_build_guards_2438`, five `test_capture_lease_*`, `test_gate_always_run`, `test_setting_value_parity`, `test_settings_patch_audit_order`, `test_authrevoke_2435`, `test_router_common_helpers`, `test_t06_admission_295`, `test_async_routes_no_inline_db`, `test_wiskey_live_validation_2390`), `-x` | 1adb0b646 | stopped at the first failure: `test_confirm_words_2442::test_every_check_of_a_typed_word_goes_through_the_table` (fixed in b69abad89) |
| the same 42 files without `-x` | b69abad89 | see the release report (running when this section was written) |
| Playwright unit config, every `tests/unit-*.spec.ts`, `--workers=1` | 1adb0b646 | see the release report (running when this section was written) |
| `scripts/design_ratchet.py` | 1adb0b646 | every metric at or below the baseline; `color-literal` 2500 / 2500 |
| runner `run_smart.py preview` `audit30-f-calendars`, `evidence-replay-3d`, `pixel-plan-wizard-2433`, `-2434`, `-u --workers=1`, all projects | 5bcea468d | 82 passed, 35 skipped (per-project); the 16 conflict baselines rewritten, nothing else |
| `scripts/api_inventory.py` | 21e4ef10d | 1909 routes (header only) |
| `scripts/release_check.py` | 21e4ef10d | one version 2.43.8; bridge 0.10.7 consistent; only `[FAIL] git tag v2.43.8 not yet`; RESULT: ready |

## 13. NOT_RUN (part 2)

- Locally: the browser projects of the evidence / pixel / layout specs, the full backend suite - the runner's release gate covers them.
- The entry checks of merges 16, 17, 18 (not queued, by instruction); the I18N-COMBINED-C entry was still running at merge time.
- Pixels beyond the 16 conflict files: not refreshed. DOMUS-DEFAULT re-took its own baselines on its branch; screens that the
  train changed under classic AND that open the default skin may differ in the gate (fix forward with a targeted re-run).
- Lab: nothing installed. No tag, no push of `main`, `#addon` untouched.

## 14. Open items for the lead (part 2)

- Bridge version bump for the wave-3 bridge refactors (section 11): recommended in 2.43.9 with one Home Assistant restart.
- `--dv-sheet-sheen` (DOMUS) is now unused on the train (section 10, merge 14) - a cleanup row.
