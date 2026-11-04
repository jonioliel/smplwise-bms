# RELEASE-2400-TRAIN: assembly of the 2.40.0 train (WisKey installer, operations, conflicts, access diagnostics, event cursor, WhatsApp queue; wall and round-4 leftovers)

Branch `release/2400-train`, cut from `origin/release/2390-train` @ `bee36c9e6` (the 2.39.0 train, itself on the 2.38.2 train; both still
being finalised by their own owners - nothing was pushed to them). No version bump (every version line stays 2.38.1, the base's), no
changelog entry, no UI rebuild (`smplwise_vms/www` is still 2.38.1's), no tag, no merge to `main`. This document is the input for the
version commit and the runner gate.

## 1. Merged (one `--no-ff` merge commit each, in this order)

| # | Branch (change doc in `docs/changes/`) | Tip | Cut from | Merge commit | Conflicts |
|---|---|---|---|---|---|
| 1 | `pilot/WISKEY-INSTALLER-NATIVE-2400` - installer tools, channel `installer`, settings area "התקנה ותחזוקת מערכת האינטרקום" | 2a854b2a5 | main v2.38.0 | b916a04fb | channels (3 files), `main.py` |
| 2 | `pilot/WISKEY-OPS-VIEWS-2400` - operations and fleet views, channel `operations`, migration **0200**, settings area "תפעול האינטרקום" | 01a092fd5 | 2.38.2 train | 452b01501 | channels (3), `main.py`, `nav.ts`, `sw-app.ts`, `lazy-screens.ts`, `unit-wiskey-deeplinks` |
| 3 | `pilot/WISKEY-EVENT-CURSOR-2400` - gap-free door events across restarts, migration **0201** | dea002ed4 | 2.38.2 train | 90f3e0cf8 | none |
| 4 | `pilot/WISKEY-CONFLICTS-2400` - conflicts and fleet alerts acted on in Arx, channel `triage`, migration 0198 -> **0202** | a1c684b44 | 2.38.2 train | aa33b33f3 | channels (3), `main.py`, shell (3), `deep-links.ts`, `wk-deep-links.ts`, deep-link specs (2), 2 PNG |
| 5 | `pilot/WISKEY-ACCESS-DIAG-2400` - "אבחון הרשאות", channels `diagnostics` + `access_review`, migration 0198 -> **0203** | f2274279a | 2.38.2 train | cad0bfc88 | channels (3), `main.py`, shell (3), `deep-links.ts`, deep-link specs (2), 2 PNG |
| 6 | `pilot/WALL-FOLLOWUPS-2390` - wall desktop mode, foldable detection | 4410f031c | main v2.38.1 | e6e74c5fb | none |
| 7 | `pilot/ROUND4-LEFTOVERS-2390` - WP9 (WisKey area) and calendars D22 | 864df4640 | 2.38.2 train | 51044acd5 | none |
| 8 | `pilot/WISKEY-WA-QUEUE-2400` - WhatsApp completion on the installed WisKey client, channel `messaging_paced` (coordinator 04.11: merge it) | 7b57898de | 2.38.2 train | 57ecaa6c8 | channels (3), `contracts/API_INVENTORY.md` |

Train commits on top:

| Commit | Kind | What |
|---|---|---|
| f21342be3 | product (deep links) + stale specs | installer natives replace the Q7 bridges (1.2); five specs follow (2.1) |
| 718ad0bee | generated | API inventory 1771 -> 1837 routes (3) |
| 370111535 | **product fix** | the merged screens pass the source lints (2.2) |
| 7b21f5bcc | **product fix** + stale spec | the settings column keeps fitting: installer entries search-only (2.3) |
| 6e1f891f9 | baselines | 16 PNG re-taken on the merged UI (5) |
| a792c1901 | stale spec (security pin) | the signing-caller pin knows the event resume sender and the WhatsApp queue (2.4) |
| 94a3501c7 | baselines | 2 `pixel-access-status` forbidden PNG re-taken (5) |
| (this document) | docs | RELEASE-2400-TRAIN |

### 1.1 Conflict resolutions

- **`services/wiskey_channels.py`** (1, 2, 4, 5, 8): every branch adds closed allow-lists on the same lines. All kept, in merge order
  after the 2.39.0 train's five: constants `INSTALLER`, `OPERATIONS`, `TRIAGE`, `DIAGNOSTICS`, `ACCESS_REVIEW`, `MESSAGING_PACED` (each with
  its comment), one `ALLOWLISTS` and one `ADAPTER_CHANNELS` (`read, technical, messaging, readback, pacing, maintenance, door_technical,
  station_people, profiles, schedules, installer, operations, triage, diagnostics, access_review, messaging_paced`), `HA_FRAMES` and
  `describe()`. WA-QUEUE's `UNPINNED_CHANNELS` gains `messaging_paced`; its second definition (a "both" side) was removed so there is one.
  `platform/capacity` sits on both `installer` and `operations` (OPS-VIEWS: "one command on two guards is fine").
- **`tests/test_wiskey_channels.py`**: the adapter-channel tuple and the live-guard map list all sixteen, same order.
- **`tests/test_pwclean_295.py`**: the 2.39.0 train's rule kept - one `ADDED_AFTER_CLEANUP` tuple entry per channel and branch, left out of
  the catalog, the ORIGINAL pre-cleanup hash `0fdcbd37...abafe` stays. Each branch had done it its own way and each is replaced by an entry:
  INSTALLER `k != "installer"`; OPS-VIEWS `CATALOG_SHA256_WITH_OPERATIONS` (`b9ae08da...5ac59`) + `ADDED_CHANNELS` + a second assert;
  CONFLICTS a second `ADDED_AFTER_CLEANUP = frozenset({"triage"})` that **auto-merged** above the function and would have shadowed the
  tuple (removed); ACCESS-DIAG an inline `("diagnostics", "access_review")` (two entries); WA-QUEUE a recomputed `CATALOG_SHA256`
  (`63741829...fb169`). The branches' own values are recorded in the comment.
- **`main.py`**: the train's station-ops / profiles / schedule-writes / station-people routers plus `access_control_triage`,
  `access_control_diag`, `wiskey_installer`, `access_control_ops` (and WA-QUEUE's `access_control_wa_queue`, auto-merged): all mounted.
- **Shell** (`shell/nav.ts` `TAB_PERMISSIONS`, `INSTALLATION_ONLY_HREFS`, `wiskeyActiveTab`; `shell/sw-app.ts`; `shell/lazy-screens.ts`):
  every side kept - `intercom-installer`, `intercom-operations` (settings), `profiles`, `conflicts` / `alerts`, `access-diag` (WisKey area).
- **`wiskey/deep-links.ts`**: OPS-VIEWS' native `health.fleet` (capacity view, label "קיבולת ומגמות של העמדות") with CONFLICTS' native
  `alerts.act` and new `conflicts.resolve`; `DeepLinkViewer` keeps both `canInstallation` (OPS) and `area` (CONFLICTS) and `deepLinksFor`
  applies both rules; `PLACES.stations` = CONFLICTS' two + ACCESS-DIAG's `access.scenario` / `stations.permission_audit`.
  `components/wk-deep-links.ts` passes `canInstallation` and `area`.
- **Deep-link specs** (`unit-wiskey-deeplinks`, `evidence-wiskey-deeplinks`): the expectations of all branches combined.
- **Migrations**: see 3.
- **Pixel baselines**: `pixel-wiskey-deeplinks` `deeplinks-classic-stations-menu-{1440-desktop,390-mobile}` were changed by OPS-VIEWS,
  CONFLICTS and ACCESS-DIAG; the train's side was kept at both merges and they were re-taken on the runner (5).
  WA-QUEUE's re-taken `pixel-wiskey-messaging` `settings-classic-errors-1440` merged without a conflict (the 2.39.0 train had not
  touched that one image); it is checked in the no-refresh run.
- **`contracts/API_INVENTORY.md`** (8): train's side, then regenerated (3).
- **Nothing from the base reverted**: a script compared, for every merge, each line the merge removed from the train with the lines the
  merged branch removed from its own merge base. The only extra removals are the train's union lines (the channel tuples / lists, the
  pwclean comment, `INSTALLATION_ONLY_HREFS`, the combined deep-link expectations and `PLACES.stations`, `wk-deep-links` viewer). EVENT-CURSOR,
  WALL-FOLLOWUPS (cut from main 2.38.1, 120 commits behind) and ROUND4: 0 extra removed lines.

### 1.2 Deep links registered (`f21342be3`)

`frontend/src/wiskey/deep-links.ts` - INSTALLER-NATIVE asked for these "once the link map merges":

| Capability | Native route | Need | Was |
|---|---|---|---|
| `clock.settings` | `#/system/intercom-installer/clock` | `system.configure` at the installation | Q7 bridge `tools/clock_options` |
| `stations.technical` (label "הגדרות טכניות של עמדה") | `#/system/intercom-installer/technical` | same | Q7 bridge `devices` tab |
| `stations.lifecycle` (new, row 50, label "הוספה והסרה של עמדות אינטרקום", on the stations screen) | `#/system/intercom-installer/lifecycle` | same | - (panel target `tools/platform_center`) |
| `platform.center` (label "תצורת מערכת האינטרקום") | `#/system/intercom-installer/platform` | same | Q7 bridge `tools/platform_center` |

The Q7 bridges are retired; `BRIDGED` is `schedules.edit` (Q4) only. OPS-VIEWS keys (`operations.center`, `operations.investigations`,
`events.report`, `health.fleet`, `audit.panel`), CONFLICTS (`alerts.act`, `conflicts.resolve`) and ACCESS-DIAG (`access.reviews`,
`access.compare`, `people.quality`, `access.scenario`, `stations.permission_audit`) came registered from their branches and are kept.
The panel addresses stay in every entry (`deepLinkHref`). The installer tools live in Settings, so they stay when the WisKey area is
hidden (CONFLICTS' area rule hides only natives under `#/wiskey/`).

## 2. Failures found and fixed

### 2.1 Specs made stale by the merges (`f21342be3`, spec only)

| Spec | Why stale | Change |
|---|---|---|
| `unit-wiskey-deeplinks` | four natives more (1.2), `BRIDGED` | installer map, places, `BRIDGED = [schedules.edit]`, an installer describe |
| `unit-intercom-ops` "every native deep link points at a tab of this screen" | written when only OPS had natives; profiles (2.39.0), triage, access-diag and installer natives have their own routes | checks only links under `#/system/intercom-operations/` |
| `unit-wiskey-triage-2400` (area hidden) | expected no native at all; the area rule only hides natives under `#/wiskey/`, the Settings views stay | expects the installer and capacity links |
| `unit-wiskey-access-diag` | OPS' capacity view also follows `access.read` and joins the stations menu | expects `health.fleet:native` first |
| `evidence-wiskey-deeplinks` | stations list (+ lifecycle); the drawer's clock / technical links are native, so the "a tool link opens the tool" check clicks the panel's sync tab; the station-settings link now opens `#/system/intercom-installer/technical`; hidden-area list keeps the installer tools | as said |

### 2.2 Source lints over the merged screens (`370111535`, product fix)

The full unit run (432 files, explicit lists in 5 batches) failed 3 specs; none of the branches ran them over all of `src`:

| Spec | Defect | Fix |
|---|---|---|
| `unit-date-format-module` (DATEFMT60-295) | `installer-platform.ts`: the maintenance window's 2 time inputs without the Hebrew `lang` | `lang=${dateInputLang()}` |
| `unit-empty-state-icons` | 8 empty `sw-state-panel`s without a topical icon (`installer-technical`, `system-intercom-installer`, 6 in `system-intercom-ops`) | `door`, `wrench`, `wrench` / `door` / `activity` / `list` / `history` / `users` |
| `unit-token-lint` (radius scale) | `system-intercom-ops.ts` meter bar and fill: `border-radius: 4px` on an 8 px bar | `var(--sw-r-pill)` (same shape) |

### 2.3 The settings column scrolled (`7b21f5bcc`, product fix + stale spec)

`layout-settings-nav-fit-402` (owner decision 402: the settings column never scrolls) failed on the merged tree: the "מערכת ותשתית"
group needed 866 px for 852 at 1440x900 (workstation render). INSTALLER-NATIVE (cut from main) added a top-level row to the group that
OPS-VIEWS had already found full (7 px over with one more row, so OPS made its entries search-only). The installer's five entries are
now search-only sub-entries right after OPS' entries, under the access-control screen (`ownTabs`); the shell's tab row ("התקנת
האינטרקום") and the deep links reach the tools. `unit-settings-index` "every top-level settings tab has an entry" knows the two
search-only tabs - it already failed since OPS-VIEWS (that branch did not run it). Owner question 6.1. On the runner (evidence run @ 94a3501c7) the
layout spec passed at 1440x900 and 1366x768.

### 2.4 The signing-caller pin (`a792c1901`, stale spec - security review asked)

The runner's backend run @ 6e1f891f9 failed 1 test: `test_t06_admission_295::test_the_only_modules_that_reach_a_signing_call_are_the_known_ones`.
Two new modules reach the signing seam and neither branch ran the pin: `wiskey_event_resume.py` (EVENT-CURSOR: `BridgeSigner.command_proof`
of `events/resume_v1` {cursor, limit} on the service feed's socket, its own one-command sender) and `wiskey_wa_queue.py` (WA-QUEUE:
`port.call` over the direct join's signed port, only while the join selects the command). Both added to the pinned set with their reasons,
and a new test pins by name what each may send (`events/resume_v1`; `DIRECT_COMMANDS` = template registry / enqueue / job / cancel /
send_v3, the paced send not among them - it is the `messaging_paced` channel). The admission decision is the branches' (their change docs
2.2 / 2.1); `docs/changes/T06-ADMISSION-MAPPING-295.md` was not edited: the lead's review (6.2).

### 2.5 Not product faults, recorded

- `evidence-settings-cards-2380` (20 tests, desktop / tablet / mobile) failed in the `preview` job: the spec imports `/src/api/session.ts`
  at run time, which only a vite dev server serves. In the `spec` job (dev server) on the runner: 20 passed, 4 skipped. A harness
  choice, not a defect; the 2.39.0 train's list did not hold this spec.
- A unit run rewrites 18 `docs/evidence/USR2/*.png` files on the workstation as a side effect; restored with `git checkout` after each run
  (not committed).
- Kept from the branches: the floating shell pill over the lifecycle wizard card's corner in `installer-lifecycle-wizard-card-390` is the
  same in the old and new image (INSTALLER-NATIVE's own baseline).

## 3. Migrations, release check, API inventory

Map (file -> train number):

| Branch | Built as | Train | File |
|---|---|---|---|
| 2.39.0 train (PEOPLE-COMPLETE) | 0198 | 0198 | `0198_wiskey_station_people.sql` (unchanged) |
| 2.39.0 train (LIVE-VALIDATION) | 0199 | 0199 | `0199_wiskey_live_validation.sql` (unchanged) |
| OPS-VIEWS | 0200 | 0200 | `0200_wiskey_capacity_samples.sql` (unchanged) |
| EVENT-CURSOR | 0201 | 0201 | `0201_wiskey_event_cursor.sql` (unchanged) |
| CONFLICTS | 0198 | **0202** | `0202_wiskey_conflict_reviews.sql` (`git mv`; header and the two references in `services/wiskey_triage.py` follow) |
| ACCESS-DIAG | 0198 | **0203** | `0203_wiskey_access_review_decisions.sql` (`git mv`; header follows) |

Both renumbered files depend on nothing but their own tables (no code names a migration number; tests read the tables). INSTALLER,
WALL, ROUND4 and WA-QUEUE add no migration. The branch change docs keep their own numbers as written (history).

- `scripts/release_check.py` (project venv) @ 94a3501c7: `migrations contiguous: 203 files, last 0203_wiskey_access_review_decisions.sql`,
  one version 2.38.1 everywhere (incl. the API inventory), RESULT: ready for the owner's approval (the 2.40.0 version commit is not part
  of this train).
- `test_migrations_263_upgrade` (contiguous and final), `test_wiskey_s5_migration_upgrade` (0192..0196 once each, then every later file
  once), `test_migrations`, `test_db_gate`, `test_db_template`, `test_release_check`: passed on the workstation and on the runner (4).
- `contracts/API_INVENTORY.md` regenerated with `scripts/api_inventory.py` (project venv): **1837 routes** (1771 + 66: INSTALLER +33,
  ACCESS-DIAG +12, OPS-VIEWS +10, WA-QUEUE +6, CONFLICTS +5); none removed; version line 2.38.1.

## 4. Receipts

Runner jobs: `private/runner/run_smart.py <job> release/2400-train ... --machine=runner` from the train worktree. Before **every** job:
`~/smplwise-results/gate_status.json` not `running`, no `release_gate` process, `df -h /` >= 30 GB free (83 / 80 / 72 / 76 / 73 / 73 GB
seen). When the train was ready the nightly `release_gate.py main --tier L` was running (started 02:21 UTC); no runner job was started
until it had ended (06:19 local). The runner worktree `~/work/release-2400-train` is this train's only; the backend job and the pixel
job ran together at the same SHA (6e1f891f9). `.tmp_*` removed after the runs (4.3 GB, then 640 MB).

| Check | Where / SHA | Result |
|---|---|---|
| `tsc --noEmit -p tsconfig.json` | workstation @ the merged tree + f21342be3 | 0 errors |
| the same | workstation @ 94a3501c7 | 0 errors |
| Unit: the deep-link / triage / ops / access-diag specs (4 files) | workstation @ f21342be3 | 61 passed |
| Unit: every `tests/unit-*.spec.ts` (432 files, explicit lists, 5 batches, `--workers=2`) | workstation @ 718ad0bee | 3968 passed, 8 skipped, **4 failed** (2.2, 2.3) |
| Unit: the 4 failed + neighbours (8 files) | workstation @ the fixes | 69 passed |
| Unit: every `tests/unit-*.spec.ts` again (432 files, 5 batches) | workstation @ 94a3501c7 | **3972 passed, 8 skipped, 0 failed** |
| `layout-settings-nav-fit-402` + `layout-settings-nav-295`, desktop, local vite dev | workstation @ 718ad0bee / after 7b21f5bcc | 1 failed (866 > 852) / **3 passed**, 4 skipped |
| Backend targeted (18 files: the 9 new suites, channels, pwclean, migrations x3, release check, pairing, notify core, wall) | workstation @ 718ad0bee, project venv | **330 passed, 3 skipped** (20 min) |
| Pixel `--update-snapshots=changed`: `pixel-wiskey-deeplinks`, `evidence-intercom-ops`, `evidence-wiskey-installer`, desktop + mobile, workers 1 | runner @ 7b21f5bcc | 92 passed; **16 PNG** written (5) |
| Pixel **without** refresh: all 25 `pixel-*` + `evidence-intercom-ops` + `evidence-wiskey-installer` + `visual-matrix`, desktop + mobile + tablet, workers 1 | runner @ 6e1f891f9 | 483 passed, 340 skipped, **2 failed** (`pixel-access-status` forbidden 1440 / 390) |
| Backend targeted (51 files: the 9 new suites; wall / wall alerts / kiosk; notify core; pairing; channels, pwclean, contract, adapter, authority, wire, fake WisKey x2; messaging: eccact readback, pacing coverage, tplv2, adopt-2272 features + contrib, rc10 pin, W11 template send, intercom messaging x2, consent link, owner26 callers, wkjoin, registry startup; migrations x3, db gate, db template, release check; capabilities, guard-first, T06 admission; the 2.39.0 suites station ops, door tech, station people, profiles, schedule writes, live validation; backup) | runner @ 6e1f891f9 | 1454 passed, 4 skipped, 3 xfailed, **1 failed** (2.4), 25 min |
| Pixel `--update-snapshots=changed`: `pixel-access-status`, desktop + mobile | runner @ a792c1901 | 14 passed; 2 PNG written (5) |
| Evidence + regression, `preview`, desktop + mobile + tablet (35 specs: the merged branches' evidence specs - triage, access-diag, wall follow-ups, presence round 16, WA installed, messaging settings, layout messaging, deep links; nav fit, nav 295, calendars nav, nav size; pairing; stations, stations layout, station ops, people, people native, people writes, people layout, station people; messaging; wall, wall plan, wall phone, wall alerts; calendars views / manage / settings; settings cards; switch-UI; live validation; talk dial; incoming call - and `pixel-access-status` without refresh) | runner @ 94a3501c7 | 864 passed, 571 skipped (project skips), **20 failed** - all `evidence-settings-cards-2380` (2.5) |
| `evidence-settings-cards-2380`, `spec` job (dev server), desktop + mobile + tablet | runner @ 94a3501c7 | **20 passed, 4 skipped** |
| Backend after the pin (T06 admission, channels, pwclean, event cursor, WA queue, release check) | runner @ 94a3501c7 | **193 passed, 3 skipped, 3 xfailed** |
| `scripts/release_check.py` | workstation @ 94a3501c7 | ready (3) |

WA-QUEUE's final head (`48c80cb81`, not re-run on its branch because of the nightly gate): its evidence specs
(`evidence-wa-installed-2400`, `evidence-wiskey-messaging-settings`, `layout-wiskey-messaging`) passed in the evidence run, and
`pixel-wiskey-messaging` (incl. its re-taken `settings-classic-errors-1440`) passed without refresh in the pixel run, on the merged train.

## 5. Baseline review (18 PNG)

Every rewritten PNG was compared with HEAD as old / new / difference sheets and crops of the changed region.

- `pixel-wiskey-deeplinks` stations-menu 1440 / 390 (the conflicted pair): the merged menu with 8 links - technical settings and
  lifecycle (native, chevron), sync (panel, window icon), conflicts, alerts, capacity, "האם יכול לפתוח את הדלת עכשיו", station audit.
  On the phone the list stays inside the screen.
- `pixel-wiskey-deeplinks` drawer 1440 / 390: same four links; technical settings ("הגדרות טכניות של עמדה") and clock are native now.
- `evidence-intercom-ops` empty 1440 / 390: the empty state's icon is the topical `list` instead of the preset (2.2); overview 1440: the
  settings tab row holds the installer tab too and is scrolled one tab further.
- `evidence-wiskey-installer` clock / lifecycle / platform / technical 1440: the settings column marks "בקרת כניסה" (the installer row is
  search-only, 2.3) and the tab row holds the operations tab; 390: the tab strip shows its scroll arrow. Lifecycle wizard card 390: the
  card is captured whole (the old image had the shell's top band over its first 78 px).
- `pixel-access-status` forbidden 1440 / 390: the persona without the status page holds `access.read` at the installation, so it now sees
  OPS-VIEWS' "תפעול האינטרקום" tab and the "מערכת ותשתית" group; the forbidden card is unchanged (moved down with the header).
- Not moved (no-refresh run): stations, station media, people, people writes, messaging (incl. WA-QUEUE's re-taken image), schedules,
  schedule writes, door tech, talk dial, incoming call, access events / S12, triage, access diag, wall plan, wall follow-ups, round-4
  leftovers, the other pixel specs and the visual matrix.

## 6. What remains

1. **Owner question - the installer's place in the settings column** (2.3): (a) keep it search-only under "בקרת כניסה" (as now, like
   the operations views); (b) a top-level row, and the column gets denser at 1440x900 (a design change of the column); (c) another group.
2. **Lead review - the two new signing callers** (2.4): admission rows for `events/resume_v1` and the WA queue's five template
   commands in `docs/changes/T06-ADMISSION-MAPPING-295.md` (the pin test now names them; the mapping document was not edited).
3. The deep-link list's heading still says "פתיחה בחלון האינטרקום" although most entries in the stations menu and the drawer are native
   now (cosmetic; owner / design call).
4. `schedules.edit` stays the only (Q4) bridge; `stations.lifecycle` is offered on the stations screen only (not in Settings › status).
5. **The 2.38.2 train moved again** after the 2.39.0 train's cut (`954cb6c7e` JOIN-LIVE, `bbe75bd75` its document) and is not in
   `release/2390-train` @ bee36c9e6 (nor here). `git merge-tree` of it into this train: no conflict. It comes in through the 2.39.0
   train's owner, then here, before the 2.40.0 gate.
6. Each branch's open WisKey asks and owner questions stand as written in its change doc (Q-WK-11 service-identity permissions for
   every new write channel: installer, operations cancel, triage, access_review, messaging_paced).
7. `management/tasks.json` / `test_catalog.json` not edited by this train.
8. NOT_RUN: the full backend suite and the release gate (the gate covers them); any lab / WisKey / station / Home Assistant / phone
   contact (no branch allows it without the owner); the UI build (`build:addon`); Windows pixel
   baselines; the dark scheme and the non-classic skins in pixel (structural smoke only, as the specs define).

## 7. Cascade: the 2.39.0 train with the final 2.38.2 merged in (2026-11-04, workstation only, runner down)

- `git merge --no-ff origin/release/2390-train` (`c336273e9`). The 2.39.0 train had just merged the final 2.38.2 train
  (`be6879190`, merge commit `e67993e44`, version 2.38.2, main `83ce74480`), so this brings the 2382 commits after `bc4f5aded`
  (WISKEY-JOIN-LIVE-2382 and its document, the quiet-hours test pin, the pairing test isolation, the 2.38.2 version / changelog commit,
  the main registry audit) and the 2.39.0 train's cascade note. Point 5 of section 6 is closed by this merge.
- One textual conflict: `contracts/API_INVENTORY.md` (header line only, 2.38.1 vs 2.38.2), regenerated with `scripts/api_inventory.py`
  (1837 routes, header 2.38.2). Auto-merged and reviewed: `main.py` (the JOIN-LIVE manager replaces the direct `wiskey_direct_join.startup`
  call at start-up and stops first at shutdown; the module's `JOIN` global, which this train's WA queue and door engine read, is kept),
  `tests/conftest.py` (`SW_WISKEY_JOIN_LIVE_THREAD=0`), `test_wiskey_pairing_2382.py`. Version lines stay 2.38.2 (no 2.40.0 bump here),
  `CHANGELOG.md` head is the 2.38.2 entry; no frontend file, no PNG baseline and no channel list changed.
- `scripts/project_status.py --write` after the merge: PASS (423 tasks, 532 requirements); the generated views differ from the merged
  ones only by the timestamp, so the merged versions were kept.
- Local receipts (workstation @ the merge): migrations contiguous 0001..0203 (203 files, no duplicate); `release_check.py` all `[ok]`
  except the expected missing tag `v2.38.2`; `npx tsc --noEmit` exit 0; targeted backend pytest, 41 files (T06 admission, WisKey
  channels, pwclean, the migration tests, the 2382 join-live / pairing / intercom-calls / intercom-writes / talk-caps tests, the 2390
  live-validation / station-people tests, the nine test files this train added, and every test importing `wiskey_direct_join`,
  `wiskey_feature_status`, `access_control_writes` or `join_state`): **1191 passed, 15 skipped, 3 xfailed, 0 failed** (48 min).
- Needs the runner (NOT_RUN here): the pixel set without `-u` on the merged UI (stations / people / settings / access control),
  the full backend suite, the evidence / regression specs, the release gate, the UI build (`build:addon`).

## 8. Main v2.39.0 and the owner-answer branches of 04.11 (2026-11-04, afternoon)

Branch `release/2400-train` @ `a96798dc8` -> this section. Version lines are now **2.39.0** (main's); no 2.40.0 bump, no changelog
entry, no UI rebuild (`smplwise_vms/www` is main's 2.39.0 build), no tag. The 2.40.0 version commit, `build:addon`, the gate, the tag
and the merge to `main` are the owner's.

### 8.1 Merges (`--no-ff`, in this order)

| # | Branch (change doc in `docs/changes/`) | Tip | Cut from | Merge commit | Conflicts |
|---|---|---|---|---|---|
| 0 | `origin/main` = v2.39.0 | a8eac3176 | - | 121e29861 | `contracts/API_INVENTORY.md` (header) |
| 1 | `pilot/WISKEY-INSTALL-ANSWERS-2400` - round 18 Q2-Q8: settings group "בקרת כניסה" with the installer row, start-up install switch (default off), kept runs 5 | a7d6054e7 | train 8e3ac8398 | caea80b2a | none (`main.py` auto) |
| 2 | `pilot/WISKEY-OPS-ANSWERS-2400` - Q9-Q11, Q21: maintenance label, schedule-deploy warning, "no talk" reasons name WisKey | 9b05b0edf | train 8e3ac8398 | 8148e8e55 | none (`test_wiskey_station_ops.py` auto with main) |
| 3 | `pilot/BOARD-ANSWERS-2400` - Q12-Q17: pre-0173 board link sealed on TV connect, "הפוך" chip lists | 9e69b26ea | train 8e3ac8398 | 15ae3816a | none (`main.py` auto) |
| 4 | `pilot/WALL-ANSWERS-2400` - Q18-Q20: open-foldable setting, portrait health chip once, kiosk header on a phone, desktop flag column, migration **0204** | 604334317 | train 8e3ac8398 | 80983c8db | `contracts/API_INVENTORY.md` |
| 5 | `pilot/PRESENCE-COUNT-2400` - Q25-Q28: "מונה ושמות" presence card, the new default style | 003a88a83 | train 8e3ac8398 | 7cbd8930e | none |
| 6 | `pilot/WXD10-DOOR-JOBS-2400` - CR-033 D10a / D10b, API only, migration **0205** | 8d562f1cf | train 8e3ac8398 | a839ceeba | `contracts/API_INVENTORY.md` |
| 7 | `pilot/TTS-DEFAULT-ENGINE-2400` - fixed announcement engine / language (coordinator 04.11: add it) | 5795a6ecd | train a96798dc8 | 1879f1095 | none |

Train commits on top: `0ee9302e6` (generated: API inventory), `2cec97a47` (26 PNG re-taken, 8.4), this document.

- **Conflicts**: only `contracts/API_INVENTORY.md`. At the main merge it was regenerated (1837 routes, header 2.39.0); at WALL and WXD10
  the train's side was kept and the file regenerated once after the last merge (`0ee9302e6`): **1843 routes** (+ `PUT
  wiskey/managed/keep-runs`, + `GET` / `PATCH wall/settings`, + three `intercom/door-path-conversion` routes), none removed, header
  2.39.0. TTS adds no route (it uses `PATCH /settings` and widens the reader of `GET intercom/tts/engines` to `system.configure`).
- **Channel lists / admission tests**: none of the seven branches touched `wiskey_channels.py`, `test_wiskey_channels.py`,
  `test_pwclean_295.py` or `test_t06_admission_295.py`; the `ADDED_AFTER_CLEANUP` union of section 1.1 stands unchanged. WXD10 adds
  no WisKey command caller (the T06 pin passes).
- **Settings column**: INSTALL-ANSWERS' group "בקרת כניסה" (access-control screen, "התקנה ותחזוקה", "מתגי מסכי כניסה") is kept as the
  branch built it; it replaces the train's earlier search-only placement of the installer (section 2.3; owner question 6.1 is
  answered: ג). No other branch edits `system-index.ts`. TTS adds two rows inside the "תצוגת מסך התחנות" card (content pane), no column
  entry. `layout-settings-nav-fit-402` on the runner: **passed** at 1440x900 and 1366x768 (8.3).
- **Migrations**: WALL 0204, then WXD10 0205 - contiguous `0001..0205`, 205 files, no duplicate number (WXD10's own release check
  failed only on the missing 0204, as its change doc expected).
- **WXD10 owner questions** (its section 7): answered by the coordinator with the recommended "as built" options - 1א (undo of a
  disable stays for the system administrator, confirmed and audited), 2א (undo of a conversion deletes the Arx door job only), 3א (no
  Settings screen while the inventory is empty). No code change.
- **Nothing reverted**: every branch was cut from this train (8e3ac8398 / a96798dc8, ancestors of the train) and merged without a
  textual conflict except the generated inventory, so no train line was dropped by a resolution.

### 8.2 Local receipts (workstation, project `.venv` Python 3.12, Node 24.21.0)

| Check | Tree | Result |
|---|---|---|
| Migrations | 0ee9302e6 / 1879f1095 | contiguous 0001..0205, 205 files, no duplicate |
| `scripts/release_check.py` | 0ee9302e6 and 1879f1095 | every item `[ok]` (incl. the tag `v2.39.0`), RESULT: ready for the owner's approval |
| `npx tsc --noEmit -p tsconfig.json` | 0ee9302e6 and 1879f1095 | exit 0 both |
| Unit, explicit files (47: the branches' own specs - managed, settings index / nav / rows, installer, intercom ops, schedule editor, talk dial / caps, station media / ops, board answers, TV chips, wall device class / logic / alerts, kiosk idle, glass wall, presence count / compact / logic / line, home clock / screen / config, door conversion / settings, deep links, triage, access diag - and the lints: tokens, design tokens x2, empty-state icons, date format, a11y x2, phone buttons, menu, RTL, white label, motion, dark beds, pending tokens, uxrest2, polish4) | 0ee9302e6 | **458 passed, 8 skipped, 0 failed** |
| Unit after TTS (11 files: tts-default, round4 leftovers, stations, talk max, wxmedset, settings index / rows, token lint, empty-state icons, date format, a11y) | 1879f1095 | **125 passed** |
| Backend group 1 (14 files: install answers, managed install, policy B x2, r3 owner switch, MAC managed, station ops, intercom authority, permissions wxperm, schedule writes, door tech, live validation, wiskeyarx 291, progress matcher) | 0ee9302e6 | **471 passed, 3 skipped** |
| Backend group 2 (20 files: board answers, board mgmt, TV chips, notices perm / info / security / caps / tvsettings / 106, wall, wall alerts, kiosk role, me permissions, presence count / compact / history / building / area line, ui settings, settings nav pref) | 0ee9302e6 | **356 passed** |
| Backend group 3 (20 files: WXD10, door gate / enable / inventory / d6-d8 / signed, wxd fixes, door automation, doorwin, migrations x3, db gate, db template, release check, WisKey channels, pwclean, T06 admission, backup, docs config) | 0ee9302e6 | **391 passed, 3 skipped, 3 xfailed** |
| Backend after TTS (8 files: tts default, intercom, ui settings, intercom authority, settings nav pref, permissions wxperm, wxd fixes, release check) | 1879f1095 | **281 passed** |

Skips / xfails are the files' existing markers. The worktree's `frontend/node_modules` is a junction to the main checkout's (identical
`package-lock.json`, gitignored). The unit runs left `docs/evidence/USR2` untouched this time.

### 8.3 Runner receipts

`private/runner/run_smart.py <job> release/2400-train ... --machine=runner` from the train worktree. Before these jobs the runner was
idle: `gate_status.json` `pass` (the 2.39.0 gate of `release/2390-train` @ a8eac3176 had ended 10:30 UTC), no `release_gate`
process, 105-110 GB free.

| Job | SHA | Result |
|---|---|---|
| Pixel **without** refresh: all 26 `pixel-*` + `evidence-intercom-ops` + `evidence-wiskey-installer` + `evidence-wiskey-live-validation-2390` + `visual-matrix`, desktop + mobile + tablet, workers 1 (`preview`) | 0ee9302e6 | 483 passed, 348 skipped, **18 failed** - all desktop 1440 settings pages: the column (8.4) |
| Re-take `--update-snapshots=changed`, the 7 failing spec files, desktop, workers 1 | 0ee9302e6 | 26 PNG written, reviewed, committed `2cec97a47` |
| Verify **without** refresh, the same 7 spec files, desktop, workers 1 | 2cec97a47 | **101 passed, 0 failed** |
| Evidence / regression `preview`, desktop + mobile + tablet (24 specs: `layout-settings-nav-fit-402`, `layout-settings-nav-295`, `evidence-wiskey-managed-2382`, `evidence-wiskey-schedule-writes`, `evidence-wiskey-talk-caps-2382`, `evidence-wiskey-talk-dial-2382`, `unit-schedule-editor-logic`, `evidence-board-answers-2400`, `evidence-board-mgmt-2381`, `evidence-tv-chips-2381`, `evidence-wall-answers-2400`, `evidence-wall-followups-2390`, `evidence-wall`, `evidence-wall-alerts`, `evidence-wall-plan`, `evidence-wall-phone`, `evidence-mobile-wall-kiosk`, `evidence-kiosk-polish`, `evidence-kiosk`, `layout-wall-plan`, `evidence-look-polish-2331`, `evidence-wiskey-deeplinks`, `evidence-calendars-nav-2310`, `evidence-nav-size`) | 2cec97a47 | 341 passed, 345 skipped (project-scoped), **1 failed**: `evidence-mobile-wall-kiosk.spec.ts:61` [mobile] (8.5) |
| `spec` job (vite dev server), desktop + mobile + tablet: `evidence-presence-count-2400`, `evidence-presence-design-2300`, `layout-widgets-break-297`, `layout-home-widgets-wide-298`, `layout-home-edit-bar-wp4`, `evidence-presence-round16`, `evidence-settings-cards-2380` | 2cec97a47 | **74 passed, 40 skipped, 0 failed** |

`layout-settings-nav-fit-402` (INSTALL-ANSWERS had not run it): 1440x900 and 1366x768 "every group, opened one at a time, fits" and the
header toggle - **3 passed** (desktop; skipped on tablet / phone by design). OPS-ANSWERS' 9 re-taken baselines
(`pixel-wiskey-schedule-writes` x7, `pixel-wiskey-talk-dial-2382` x2) and WALL-ANSWERS' `wall-fold-inner-portrait` **passed without
refresh** in the first pixel run on the merged UI (the column does not reach them).

### 8.4 Baseline review (26 PNG, `2cec97a47`)

Every image was compared with HEAD by a script (bounding box of the pixels that differ by more than 16 levels) and the changed region
was looked at old / new side by side. In all 26 the changed pixels lie inside the settings column (x 1108-1327 of 1440); page content,
header and shell are identical. What changed: the column has six groups; "בקרת כניסה" (door icon) sits between "מדיה" and "מערכת
ותשתית" and, open, lists "בקרת כניסה", "התקנה ותחזוקה", "מתגי מסכי כניסה"; "מערכת ותשתית" lost those rows.

- `evidence-intercom-ops` overview; `evidence-wiskey-installer` clock / lifecycle / platform / technical (the group "בקרת כניסה" is
  the open one; on the installer pages "התקנה ותחזוקה" is the marked row);
- `evidence-wiskey-live-validation-2390` empty / run-all (one more closed group header);
- `pixel-access-s12` `s12-classic-audit-person`; `pixel-access-status` 12 (classic audit / busy / empty / forbidden / groups / list /
  lower / muted / not-connected / policy / stale, domus list); `pixel-wiskey-messaging` 4 (classic, dark, service down, domus);
- `pixel-access-status` forbidden: the persona with `access.read` only sees "התראות ואוטומציה" and "בקרת כניסה" (the operations tab
  moved with its group) instead of "מערכת ותשתית"; the forbidden card is unchanged;
- `visual-matrix` `settings-diagnostics-ready-{light,dark}`: "מערכת ותשתית" open and two rows shorter, plus the new closed header.

### 8.5 `evidence-mobile-wall-kiosk.spec.ts:61` - recorded, not fixed

[mobile] "camera wall on a phone: one short toolbar row": the phone toolbar of `#/live/wall` is 94 px against the spec's 56 px bound.
It fails the same way on `main` (WALL-FOLLOWUPS-2390 section 4, WALL-ANSWERS-2400 section 6). Cause: DROPDOWNFIT-295 (`833fc840e`,
after an owner report that the toolbar's labels were cut with an ellipsis) gave every control of the bar `flex: 1 1 150px` so each
label fits whole; three 150 px controls and the 40 px kiosk button do not fit one row at 390 px, so the bar wraps to two rows. The spec
still states the 2026-09-30 mobile audit's "one row". The two owner requirements conflict (whole labels vs one row), so this is a
design decision, not a clear defect: not changed, not hidden, not quarantined here. Owner question 8.7.1.

### 8.6 Runner incident

At 12:01 local a `preview` job for the TTS checks was started while the hotfix gate (`fix/BRIDGE-STALE-DISCOVERY-2383`, tier L,
started 11:38 UTC) was running: the status read and the launch were in one command and its output was read after the launch. The job
was stopped about 40 s later - locally its `run_smart.py` processes and shells, on the runner exactly its own `run_remote.sh preview
release/2400-train` and its child `tsc --noEmit && vite build` in `~/work/release-2400-train` (the only work it had started). Nothing
of the gate was touched; that 40 s `tsc` may have added to the gate's load (it reported a 3 s late `playwright-pool` phase, load 39).

### 8.7 What remains

1. **Owner question - the camera wall's phone toolbar** (8.5): (a) keep the two-row bar (whole labels, DROPDOWNFIT-295) and set the
   spec's bound to two rows; (b) one row again with shorter labels or icon-only selects (a design change of the bar); (c) leave as is.
2. **SR-1 program-write pin** - closed by the main v2.39.1 merge (9.2).
3. Main will become v2.39.1 (`fix/BRIDGE-STALE-DISCOVERY-2383`); it is merged here only when the coordinator says so.
   `pilot/VIDEO-TRANSPORT-2400` comes later.
4. NOT_RUN: the full backend suite, the full unit sweep (432 files), `layout-access-s12` (TTS NOT_RUN), the release gate,
   `build:addon`, Windows pixel baselines, any lab / WisKey / station / Home Assistant / device contact (none allowed).
   `management/tasks.json` / `test_catalog.json` not edited.

### 8.8 TTS-DEFAULT-ENGINE-2400 on the runner (after the hotfix gate had ended)

Runner re-checked before each job: `gate_status.json` `fail` (the hotfix gate of `fix/BRIDGE-STALE-DISCOVERY-2383` had finished
12:45 UTC), no `release_gate` process, 105-106 GB free.

| Job | SHA | Result |
|---|---|---|
| Pixel **without** refresh: `pixel-access-s12`, `pixel-wiskey-stations`, `pixel-wiskey-station-media`, `visual-matrix`, desktop + mobile + tablet, workers 1 (`preview`) | 82598a1fe | **131 passed, 28 skipped, 0 failed** |
| `spec` job: `evidence-tts-default-2400`, `evidence-access-s12`, `evidence-wxmedset`, `evidence-wiskey-stations`, desktop + mobile + tablet | 82598a1fe | **181 passed, 53 skipped, 0 failed** |

TTS' nine re-taken `pixel-access-s12` images hold on the merged train without a re-take: the display / parity / checklist images are
screenshots of the card element (`page.locator(target)`), not of the page, so the new settings-column group does not reach them (the
one full-page S12 image, `s12-classic-audit-person-1440`, was re-taken in `2cec97a47`). No baseline re-taken for TTS.

### 8.9 Known red: `test_fake_doorwin_closed_rule_sr1.py::test_program_writes_are_pinned`

Run on the train @ 82598a1fe (workstation, `.venv`): 4 passed, **1 failed** - the program-write sites differ from `ENGINE_WRITES` by
exactly four pairs, all from main v2.39.0 (WISKEY-DOOR-TECH-2390): `services/wiskey_channels.py` and `services/wiskey_door_tech.py` x
`stations/technical_program_save` / `stations/technical_program_action`. Coordinator 04.11: the lead reviewed them against SR-1; the
test-only fix is `613f4b0ef` on `fix/BRIDGE-STALE-DISCOVERY-2383` and arrives with main v2.39.1 (merged here when the coordinator says
so; not cherry-picked). None of the eight 2.40.0 branches adds a `technical_program_save` / `technical_program_action` site (WXD10's
`door_conversion.py` included), and the file's other four pins (open sites, Home Assistant lock-service sites, timer-shaped modules)
pass, so no `ENGINE_WRITES` entry is owed by this train.

## 9. VIDEO-TRANSPORT-2400 and main v2.39.1 (2026-11-04, evening)

Coordinator 04.11: merge `pilot/VIDEO-TRANSPORT-2400`, then main v2.39.1 once the 2.39.1 re-gate had ended. Version lines are now
**2.39.1** (main's); still no 2.40.0 bump, changelog entry, UI rebuild (`www` = main's 2.39.1 build) or tag.

### 9.1 Merges (`--no-ff`)

| # | Branch | Tip | Cut from | Merge commit | Conflicts |
|---|---|---|---|---|---|
| 1 | `pilot/VIDEO-TRANSPORT-2400` - one server-side live-video transport decision (`services/video_transport.py`, `GET /media/video-policy`), the personal `user_prefs` key `video.transport`, the station profile rule, MSE stall detection, a 45 s WisKey lease grace, go2rtc error logging; no migration | 06da48b15 | train 0ee9302e6 | 4b43b95b7 | none - no file changed on both sides since 0ee9302e6 |
| 2 | `origin/main` = v2.39.1 (`fix/BRIDGE-STALE-DISCOVERY-2383`: bridge pairing survives re-pair and HA restarts, bridge 0.10.2 -> 0.10.3; SR-1 pin `613f4b0ef`) | 613f4b0ef | - | 6b80f3187 | `contracts/API_INVENTORY.md` only |

- **API inventory**: after the video merge `scripts/api_inventory.py` gave 1844 routes, byte-identical to the branch's file (nothing to
  commit). After main: regenerated, **1844 routes**, header 2.39.1 (+ `GET /media/video-policy` against section 8's 1843).
- **Version pins** (bridge 0.10.3 in the integration copies, manifest, const, tests, `config.yaml` 2.39.1) and `CHANGELOG.md` came in
  without a conflict: the train has no 2.40.0 entry yet, so the head is main's 2.39.1 entry, then 2.39.0. The remaining "0.10.2"
  strings are history comments and test data, identical to main.
- **Migrations**: unchanged, contiguous 0001..0205 (VIDEO-TRANSPORT adds none; it uses the existing `user_prefs` table).
- `git merge-base --is-ancestor origin/main HEAD`: true.

### 9.2 Receipts

Local: workstation, project `.venv` Python 3.12, Node 24.21.0. Runner: `run_smart.py`, checked before every job - the 2.39.1 re-gate
had ended (`gate_status.json` `pass`, finished 13:21 UTC), no `release_gate` process, 105 GB free. No runner job was started while a
gate ran.

| Check | Where / SHA | Result |
|---|---|---|
| `scripts/release_check.py` | workstation @ 4b43b95b7 and @ 6b80f3187 | every item `[ok]` (one version 2.39.1, bridge copies identical, bridge 0.10.3, migrations 205 contiguous, tag `v2.39.1`), RESULT: ready |
| `npx tsc --noEmit -p tsconfig.json` | workstation @ 4b43b95b7 and @ 6b80f3187 | exit 0 both |
| Unit, explicit files (17: `unit-video-transport-2400`, the branch's updated `unit-video-policy-webrtc-only`, `unit-wiskey-station-media`, `unit-user-menu-sections`, plus stations, talk dial / caps, TTS default and the source lints - tokens x2, a11y, empty-state icons, date format, menu, RTL, white label, phone buttons) | workstation @ 4b43b95b7 | **166 passed** |
| The same + settings index, managed, wall device class, presence count, door conversion, board answers (23 files) | workstation @ 6b80f3187 | **260 passed** |
| Backend group V1 (10 files: `test_video_transport_2400`, intercom media, station media readiness, ASGI WisKey lifecycle, join live, user prefs, settings nav pref, bridge stream source, release check, **`test_fake_doorwin_closed_rule_sr1`**) | workstation @ 6b80f3187 | **248 passed** - the SR-1 pin passes with main's `613f4b0ef` (section 8.9 closed) |
| Backend group V2 (11 live / go2rtc files: go2rtc big media, HA camera live, live H.265, live review fixes, multi-NVR live, Provision ISR live shape and source cache, camera scope, readiness, live events, Frigate live) | workstation @ 6b80f3187 | 305 passed, **1 failed**: `test_readiness_96::test_a_demo_runs_on_a_separate_database_and_leaves_the_real_one_untouched` (9.3) |
| Backend group V3 (15 files: main's `test_bridge_stale_discovery_2383`, pairing 2382, T06 admission, channels, pwclean, migrations x2, and the 2.40.0 suites install answers, managed install, WXD10, wall, TTS default, board answers, presence count, station ops) | workstation @ 6b80f3187 | **397 passed, 3 skipped, 3 xfailed** |
| Backend `test_readiness_96`, `test_video_transport_2400`, `test_asgi_wiskey_295` (`backend` job) | runner @ 6b80f3187 | **98 passed, 0 failed** |
| Pixel **without** refresh - the player screens: `pixel-wiskey-station-media` (stations drawer), `pixel-wiskey-stations`, `pixel-wiskey-talk-dial-2382`, `pixel-incoming-call`, `pixel-wall-plan`, `pixel-wall-followups-2390`, `pixel-walk-touch`, `visual-matrix` (incl. `live-wall`), desktop + mobile + tablet, workers 1 (`preview`) | runner @ 6b80f3187 | **152 passed, 67 skipped, 0 failed** - no baseline changed, none re-taken |
| Evidence `preview`, desktop + mobile + tablet: `evidence-video-transport-2400`, `evidence-webrtc-only`, `evidence-webrtc-first`, `evidence-remote-video`, `evidence-wall-pano`, `evidence-wiskey-station-media`, `layout-wiskey-station-media`, `evidence-wall`, `evidence-kiosk`, `evidence-mobile-wall-kiosk`, `evidence-wiskey-pairing-2382` (main's pairing fix), `evidence-tts-default-2400` | runner @ 6b80f3187 | 167 passed, 189 skipped (project-scoped), **1 failed**: the known `evidence-mobile-wall-kiosk.spec.ts:61` [mobile] (8.5) |

The camera page itself has no pixel spec; its transport behaviour is covered by `evidence-video-transport-2400` (remote MSE only on the
camera page, wall and kiosk; retry; personal over installation; frozen-MSE recovery) and `evidence-webrtc-only`.

### 9.3 Red, recorded

- `test_readiness_96.py::test_a_demo_runs_on_a_separate_database_and_leaves_the_real_one_untouched` fails **on the Windows workstation
  only**: after `demo/stop` the test expects `<data>/demo` to be gone and it still exists. It fails the same way alone, and on the main
  checkout at v2.39.1 (`613f4b0ef`, untouched by this train); no demo / readiness file changed in this train since `a96798dc8`. On the
  runner (Linux) the file passes (above), and the 2.39.1 gate passed. Most likely Windows refuses to remove a directory while a SQLite
  file in it is still open - not a product fault on the add-on's platform (Linux). Not changed here.
- `evidence-mobile-wall-kiosk.spec.ts:61` [mobile]: unchanged, owner question 8.7.1.

### 9.4 What remains

1. The 2.40.0 version commit, `build:addon`, the gate, the tag and the merge to `main` (owner / lead).
2. Owner question 8.7.1 (camera wall phone toolbar).
3. VIDEO-TRANSPORT's own owner test plan in the lab (its change doc, section 9) after the train is installed.
4. NOT_RUN: the full backend suite, the full unit sweep, `layout-access-s12`, the release gate, `build:addon`, Windows pixel baselines,
   any lab / WisKey / station / go2rtc / Home Assistant / device contact (none allowed). `management/tasks.json` / `test_catalog.json`
   not edited.
