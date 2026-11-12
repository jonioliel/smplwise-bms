# RELEASE-2430-TRAIN: assembly of the 2.43.0 train (home interface v3 phases 1 and 3, video-service health)

Branch `release/2430-train` (worktree `C:\cloude\smplwise-train34`), cut from `origin/main` = v2.42.1 (`a5618fad6`). Assembled
2026-11-11 by the release-train agent on the lead's delegation (standing release authority: tag and push after a passing full gate).
No lab, Home Assistant, NVR, go2rtc, WisKey or device contact; nothing installed.

## 1. Merges (`--no-ff`, in this order)

| # | Branch (change doc) | Tip | Runner entry check | Merge commit | Conflicts |
|---|---|---|---|---|---|
| a | `pilot/HOME-V3-P1-2430` (`HOME-V3-P1-2430.md`) - extension point (`home-ext.ts`, `more-registry.ts`), the "עוד" hub, recordings, home diary, intercom + guests, alarm screen, room wallpaper for everyone, the guest mark, migration **0213** | b0c90a84c | GREEN (`entry_pilot-HOME-V3-P1-2430_b0c90a84c.md`, run 73 min) | e49a0535e | none |
| b | `pilot/HOME-V3-P3-2432` (`HOME-V3-P3-2432.md`) - media, announcement, bill, water, house systems, map; no migration | 506ed9c56 | GREEN (`entry_pilot-HOME-V3-P3-2432_506ed9c56.md`) | c897bb174 | `frontend/src/home/sw-home.ts`, `services/home_interface.py` (below) |
| c | `pilot/HEALTH-GO2RTC-2430` (`HEALTH-GO2RTC-2430.md`) - `services/media_reach.py`, `/health` `media` + `degraded`, `GET /health/video`, the `video_service` health item and admin notice, the one video-down message | e8b727ab8 | GREEN (`entry_pilot-HEALTH-GO2RTC-2430_e8b727ab8.md`, run 107 min) | 27ef1ef2d | none |

Both GREEN reports list one expired quarantine entry (`pixel-wiskey-stations.spec.ts:87`, ticket WKWATER-POLISH-2331-pixel, expired
2026-11-09) counted as a failure; the engine still passed (it did not fail in those runs). The nightly on main was red (information only).

**Conflicts in b, resolved:**
- `sw-home.ts`: phase 1's registry side kept for routing, the screen switch (`security` is phase 1's `home-alarm.ts`), and the removed
  `ALARM_WORD`; phase 3's own hooks kept (`readonly p3`, the `P3Ovl` overlay member and its `ovlHtml` line, room chips, energy buttons,
  `a_p3Announce`). `SCREENS.push(...P3_SCREENS)` and the `isP3Screen` branch dropped: the registry now routes those names (section 2).
  Styles: `[homeMockupStyles, homeV3Styles, homeExtraStyles, homeP3Styles]`.
- `home_interface.py`: both checks kept in `home_allowed` - phase 1's GET/HEAD-only routes, then phase 3's whole-path patterns.

**Not boarded:** `pilot/PLAN3D-POLISH-2430`. Its baselines were refreshed on the runner (`5b127e991`, doc section present), but its
entry check (`~/pre/entry_polish.log`) was still queued behind `pilot/HOME-V3-P2-2431` and `pilot/PLAN3D-REALISM2-2433` when this train
was ready; the owner rule (no boarding without a GREEN entry check) keeps it for the next train. It merges clean on this tree
(`git merge-tree`). `pilot/PLAN3D-REALISM-2432`, `pilot/PLAN3D-REALISM2-2433`, `pilot/HOME-V3-P2-2431`: next train, as instructed.

## 2. Train commits

| Commit | What |
|---|---|
| fadbadc8e | `train(home)`: `home-p3-ext.ts`, the one-file adapter phase 3's doc describes - its five screens through `registerScreen` (back to the hub; bill and water back to electricity; nav marks "עוד"), one hub tile per `p3.tiles()` entry (order 100-150, visible only while `tiles()` offers it). `MoreTile.act` (optional): the announcement tile opens its sheet instead of a route. `home-p3-icons.ts` now re-exports phase 1's `hi` (all 12 phase-3 icons are byte-identical in `home-icons.ts`). New spec in `home-v3-p3.spec.ts` (tiles after phase 1's, live line and tone, announce sheet, back targets). |
| be2b6ecfd | release: 2.43.0 - version, changelog and API inventory (1888 routes) |
| (this document) | docs |
| (next) | release: 2.43.0 - rebuilt UI (`npm run build:addon` on the runner) |

`management/tasks.json` and `test_catalog.json` are not changed by any boarded branch or train commit; no view regenerated.

## 3. Receipts (before the UI build)

Local: workstation, project `.venv` Python 3.12, Node 24.21.0; `frontend/node_modules` is a junction to the main checkout's
(`package.json` / lock identical to main). Playwright on its own port 4434 (`SW_BASE_URL`), desktop project.

| Check | Where / SHA | Result |
|---|---|---|
| `npx tsc --noEmit` | merged P1+P3 + adapter (fadbadc8e tree) | exit 0 |
| `vite build` | same | built |
| Playwright desktop: `home-v3-p1`, `home-v3-p3`, `home-simple-2420`, `home-simple-2421` | same | **63 passed** |
| the new adapter spec (`-g RELEASE-2430`) | same | 1 passed |
| unit: `unit-home-v3-p1`, `unit-home-v3-p3-logic`, `unit-home-simple-logic` | same | 22 passed |
| backend: `test_home_config`, `test_home_interface`, `test_home_interface_doors_2421`, `test_home_links`, `test_home_screen`, `test_home_screen_options_295`, `test_home_v3_p1`, `test_home_v3_p3`, `test_rbac_matrix`, `test_me_permissions` | c897bb174 tree | 99 passed (rc 0) |
| backend after c: `test_health_go2rtc_2430`, `test_rbac_camera_scope`, `test_home_v3_p1`, `test_home_v3_p3` | 27ef1ef2d | **123 passed** |
| unit: `unit-health-go2rtc-2430` | 27ef1ef2d | 4 passed |
| `lint_spec_waits.py frontend/tests/home-v3-p3.spec.ts` | fadbadc8e | 0 findings |
| `scripts/release_check.py` | be2b6ecfd | one version 2.43.0; only `[FAIL] git tag v2.43.0 not yet`; RESULT: ready |

Migrations: main ends at 0212; 0213 (`0213_home_v3_p1.sql`, one additive column `home_interface_policy.guests DEFAULT 0`) is contiguous
(213 files).

## 4. Version commit (`be2b6ecfd`)

- 2.42.1 -> **2.43.0** in `smplwise_vms/config.yaml`, the Dockerfile label and `smplwise/__init__.py`. No bridge change.
- `CHANGELOG.md`: bilingual entry (Hebrew + English per item): the "More" hub, recordings, home diary, intercom and guest invitations
  (marked people only, off by default, the code never shown to the host), the alarm screen, music and screens, the home announcement,
  bill / water / house systems / map (read only), the administrator's room wallpaper; fixed: the video service down is said clearly
  (health "degraded", one message, auto recovery, admin notice after 5 min); install: migration 0213, nothing changes until the
  administrator switches it on, people with an earlier category list do not get the new categories until marked.
- `contracts/API_INVENTORY.md`: 1888 routes, header 2.43.0.

## 5. NOT_RUN and open items

- Locally: the full backend and unit suites, the tablet / mobile Playwright projects, pixel baselines - the runner's UI build and full
  release gate cover them (results in the lead's report, not in this document, so the gated sha stays the release sha).
- Lab: nothing installed or exercised (owner approves installs): real recordings playback in the home interface, a real guest
  invitation, real speakers / screens / an announcement, a real go2rtc outage and recovery.
- Owner questions open in the branch docs: HOME-V3-P1 section "Open questions", HOME-V3-P3 (existing category lists and the six new
  categories and others).
- Quarantine: the expired `pixel-wiskey-stations.spec.ts:87` entry still sits in `gate2_quarantine.json` `entries` (needs the lead).

## 6. Rollback

Back to 2.42.1 needs the database backup taken before the update (migration 0213 adds a column; the previous version ignores it, the
`home.room_wallpapers` setting and the shared-picture rows). No bridge or Home Assistant change.
