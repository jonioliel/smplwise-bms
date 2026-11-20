# T119 - several buildings on one home system: next-phase design

Row: FEATURE-DESIGNS-HOME-2490 (work plan 2.48.0 / 2.49.0, `private/planning/WORK_PLAN_2448_2449_2026-11-19.md`).
Status: **design only, nothing built**. The owner chooses what gets built and in which version.
Mockup: [`mockup.html`](mockup.html) (RTL Hebrew; desktop 1440x900, phone 390x844, lobby screen 1920x1080).
Base: `origin/main` 51da93753 (2.44.0 train docs). Written 2026-11-20.

## 0. Summary

Most of what the 30.10 proposal asked for is already shipped. Between 2.33.0 and 2.36.0 the product got the site level
on the full interface's home screen, a mapping assistant that links home-system floors and areas to our buildings, a
multi-building switch that is off by default, building-scoped "show and control", and building role bindings that
follow the mapping. Section 2 lists what shipped.

What is still building-blind:
- **The home interface** (T120, the resident face). It lists every floor of the installation, and its "house off" acts
  on everything the person can reach.
- **Moving a floor to another building.** There is no route for it, so an install whose floors were all drawn under
  one building cannot be split without redrawing the plans.
- **Turning the switch on.** It is one click, with no review of the mapping that becomes authority at that moment
  (round-14 open item 1).
- **Energy, schedules, the plan editor's device search and the lobby TV boards** do not know buildings.
- **Resident groups per building.** These are built by hand in user management.

This document designs those gaps as nine rows (section 12). Each row can ship on its own behind the existing switch
`home.multi_building.enabled`. While the switch is off, nothing changes, byte for byte.

## 1. Problem

One home-system installation (one server) often serves several buildings: two towers and a shared car park, or an
office building and its annex. The home system has no "building" level, only floors, areas and labels. Our product
models site -> building -> floor -> plan, and RBAC scopes by building. The two hierarchies have to be bound together
(done: the mapping), and every place where a person reads, acts, or is told about the building has to keep to the
building in question (partly done).

## 2. Current state (what shipped, with evidence)

| Capability | Where | Shipped | Change record |
|---|---|---|---|
| Site level on the home screen: building cards, grouped tree, building switch, breadcrumb, mini cross-section, building / site "turn everything off" with a strong confirmation, shared building last | `screens/home-site-view.ts`, `home-site-off.ts`, `api/home-site.ts` | 2.33.0 | `docs/changes/MULTIBUILDING-HOME-2330.md` |
| `buildings.is_shared` (migration 0188); entry view settings `home.screen.site_entry`, `site_entry_building`, `site_off_shared`; personal `site_entry`, `hide_shared` | `services/home_screen_options.py`, `routers/catalog.py` | 2.33.0 | same |
| Mapping assistant: token table, separators, floor inheritance, exceptions, advanced rules, versions + restore, health card + home chip; switch `home.multi_building.enabled` (default **off**, `PUT /home/multi-building`) | `api/mapping-engine.ts`, `screens/mapping-*.ts`, `routers/home_mapping.py`, migration 0189 (`home_area_buildings`, `home_mapping_state`, `home_mapping_versions`) | 2.33.0 | `MAPPING-ASSIST-2330.md` |
| Floors with no level asked about; auto-insert as a server job after every registry refresh | `services/mapping_auto.py`, `services/mapping_engine.py` | 2.36.0 | `MAPPING-IMPROVE-2351.md` |
| Home-system labels mirrored (label rules work on a real site) | | 2.36.0 | `HA-LABELS-SYNC-2351.md` |
| "Show and control" per building: the `building` parameter on `/devices/items`, `/devices/actions/preview`, `POST /devices/actions`, `POST /ha/entities/{id}/actions`; one check `services/building_scope.Cut`; 403 `outside_building` audited | `services/building_scope.py` | 2.36.0 | `BUILDING-SCOPE-CONTROL-2351.md` |
| Round 14: a **building** binding also reaches devices whose area is mapped to that building (`security.building_reach` = `map_and_mapping` default / `map`); the RemapGuard on mapping writes; sockets re-scoped on mapping writes | `services/ha_scope.py` | 2.36.0 | same, section "Round 14" |

**Data model already in place** (no new hierarchy is needed):
- `sites`, `buildings` (+ `is_shared`), `floors` (`building_id`, `level`, `ha_area_id`), all from migration 0001.
- `bindings`: `scope_type` is installation | site | building | floor | camera | access_control_station (0032, 0077).
  Effect is allow | deny; deny overrides.
- `home_floor_links`, `home_area_links` (0187): home-system floor -> our floor, and area -> our floor.
- `home_area_buildings`, `home_mapping_state`, `home_mapping_versions` (0189).
- Notices carry `site_id` / `building_id` / `floor_id`, and their audience is by floors (0165). Tickets carry
  `site_id` / `building_id` / `floor_id` / `area_id` (0079).

**Gaps found in the code (2026-11-20, `origin/main`):**

| # | Gap | Evidence |
|---|---|---|
| G1 | The home interface has no building level. `GET /home/overview` returns floors -> rooms for the whole installation (filtered by permission and the person's room list). Room / house off use the bulk path without `building`. | `routers/home_interface.py`, `services/home_interface.py` (no building reference except `can_bulk`) |
| G2 | A floor cannot move to another building. `FloorPatch` has name / level / sort_order / ha_area_id only. | `routers/catalog.py:366` |
| G3 | Turning the switch on makes the mapping authority (round 14) with no review step. Rows prepared while the switch was off become reach at once. | `BUILDING-SCOPE-CONTROL-2351.md`, "Open for the owner (1)" |
| G4 | When the home system moves an entity to another area, an open socket re-scopes only within 60 s (the registry sync sends no access signal). | same, "Open for the owner (2)" |
| G5 | Energy meters, schedules and calendar shared rooms have no building filter (0 references in their routers). The plan editor's device search matches name / id / area name only. | `routers/energy_meters.py`, `schedules.py`, `calendar.py`, `routers/ha.py` search |
| G6 | A lobby TV board shows one installation-wide building name (`services/notices/display.building_name`), and a board is not tied to a building. | `migrations/0165_notices.sql` (`notice_boards` has no building), `services/notices/display.py` |
| G7 | Residents per building are assigned by hand, one binding at a time. There is no template for "the residents of building A". | user management |
| G8 | The mini cross-section is a fixed last card, not a configurable home widget. | 2330 "TODO" |
| G9 | The T119 card exists only on the unmerged branch `pilot/MULTI-BUILDING-HOME-PLAN` (564e41c75, not pushed). `management/tasks.json` on main has no T119. | `git log --all --grep MULTI-BUILDING` |

Out of scope, closed by the owner on 31.10: several sites (addresses) on one home system. Live links between separate
installations are CR-041 (`docs/changes/CR-041-MULTISITE-LIVE-LINK.md`), a different feature.

## 3. Users and stories

| Who | Story | Row |
|---|---|---|
| Resident of building A (home interface, maybe home-only) | I see my building's floors only, under our own floor names, and "turn off the house" never touches building B. | MB-HOME-IFACE |
| Household member who lives in A and works in the annex | I can switch between the buildings I am allowed in with one chip, and the screen remembers my last choice on this device. | MB-HOME-IFACE |
| Wall panel in an apartment of building A | It opens its room. The house-off of the panel means building A. | MB-HOME-IFACE |
| Installer of an existing one-building install | I drew all the floors under "בניין 1". I want to move the floors of the second tower to a new building without redrawing the plans or losing the cameras on them. Before I confirm, I see who gains or loses access. | MB-FLOOR-MOVE |
| Installation administrator | Before I turn on multi-building, I see what the mapping will grant (new reach per role holder) and which mapping versions were applied, by whom, since the switch was last on. | MB-ENABLE-REVIEW |
| Building manager of A | Energy, schedules and search open filtered to my building when I hold a building binding. On a site view I can pick a building. | MB-SCREENS-FILTER |
| Building manager | The lobby screen of tower B says "ברוכים הבאים למגדל ב" and shows only the notices for tower B and the whole site. | MB-LOBBY-BOARD |
| Administrator | I add 40 residents of building A in one step: a "דיירי בניין א" group with the resident role bound to building A. | MB-RESIDENT-GROUPS |
| Owner | The site's cross-section can be a home widget wherever I want it. | MB-XSECTION-WIDGET |

## 4. Rules that do not change

- **Authority stays where it is.** A person reaches a device through role bindings: placement on the building's floor
  maps, or, for building and higher bindings, the home mapping (`security.building_reach`). The `building` parameter
  only ever narrows. Nothing in this design adds a person -> building authority. The new "home building" of a person
  (MB-HOME-IFACE) is a display preference, like `site_entry_building`. `HA_IDENTITY_RBAC_HE` section 6: role AND scope
  together, context alone is not authorization.
- **Switch off = today, exactly.** Every row repeats the identity proof of 2330 / 2351: with the switch off (or fewer
  than two buildings shown to the caller), the requests, answers and pixels are the same as before the row. A test
  replaces the new code with a function that raises.
- **Nothing is written to the home system.** The mapping reads names, floors, areas and labels. It never renames,
  re-floors or re-labels in the home system.
- **No HA branding in the UI.** Screens say "מערכת הבית", never the platform name.
- **Owner UI rules:** no scrolling on control screens (lists page), the floor / area tree is kept (grouped per
  building), green is status only, lobby screens use the luxury lobby styles (Gallery / Concierge / Stone,
  `frontend/src/notice-tv/tv-luxury.css`).

## 5. Flows

### 5.1 Home interface on a multi-building site (MB-HOME-IFACE)
1. `GET /home/overview` gains `buildings: [{id, name, is_shared, alerts}]`: the buildings the caller can see rooms
   in. Each floor gains `building_id`, and floors take our floor name (the `scopeTree` rule of 2330).
2. Fewer than two buildings in the answer, or the switch off: the home interface is exactly today's. No chip, no
   field read.
3. Two or more: the top strip shows a **building chip** ("בניין א ▾") next to the room name. One tap opens a small
   sheet with the buildings (shared last, a red dot on a building with an alarm) and "כל הבניינים" (the default is
   off, see question 3).
4. The **rooms screen** keeps the floor columns. They are grouped under the chosen building, and with "כל הבניינים"
   under one header per building (never interleaved).
5. **House off** is named by the building ("כבה הכל בבניין א") and sends `building` on the bulk preview / run, which
   `building_scope.Cut` already enforces. There is no whole-site off in the home interface. That stays in the full
   interface's site dialog.
6. The entry building is the person's `home building` (policy, set by an administrator), else the last building on
   this device (`localStorage`), else the first one in the list. A wall panel always uses its room's building.
7. Notices, calendar and presence in the home interface are filtered to the chosen building plus site-wide items
   (notices: an audience floor in the building, or no floor; shared rooms: rooms whose floor is in the building).

### 5.2 Move a floor to another building (MB-FLOOR-MOVE)
Explore > sites > building > floor menu > "העבר לבניין אחר".
1. Pick the target building (same site only; another site is refused, because a site's time zone and address are
   its own).
2. **Impact preview** from the server (`GET /floors/{id}/move-preview?building=`):
   - people who **lose** reach: they hold bindings on the source building only;
   - people who **gain** reach: they hold bindings on the target building;
   - floor bindings, which move with the floor;
   - cameras, plans and anchors, which move unchanged;
   - blockers: a shared room linked across the new boundary (`shared_spaces.py` refuses cross-building sharing),
     a level clash with a target floor (a warning only, two floors may share a level), the floor's home links, which
     stay valid (they point at the floor id).
3. Confirm with the exact counts ("3 אנשים יאבדו גישה, 12 יקבלו"). The write is one transaction:
   `floors.building_id`, audit `floor.move` (from, to, counts), access generation bump for every user
   (`revocation.mark`), so open sockets re-scope at once.
4. Undo = move it back (same flow). Nothing is deleted.

### 5.3 Review before turning multi-building on (MB-ENABLE-REVIEW)
Settings > general > "בניינים ומיפוי" > switch "הפעל ריבוי בניינים".
1. Switching **on** opens a review sheet (switching off stays one confirmation):
   - mapping health: mapped / unmapped areas, floors without a level, new names waiting;
   - versions applied since the switch was last on (who, when, kind: apply / confirm / auto / restore);
   - **reach change** under the current `security.building_reach` (`GET /home/multi-building/preview`): per
     building binding, how many devices it gains through the mapping (placement reach is unchanged). The person
     list pages; it never scrolls.
2. "הפעל" stays disabled until "בדקתי את המיפוי" is checked. The audit row `home.multi_building` gains
   `reviewed_version` and the counts.

### 5.4 Building filter in other screens (MB-SCREENS-FILTER)
One shared control, `<sw-building-filter>`: a segmented chip row (buildings + "כל האתר"). It is drawn only with the
switch on, at least two buildings visible to the caller, and a screen that lists things that live in buildings. A
caller with bindings in one building gets no control (the list is already theirs).

| Screen | Filter means | Server |
|---|---|---|
| Energy > meters / consumption by area | meters whose area maps to the building | `GET /energy/meters?building=` through `building_scope.Cut` (the area set) |
| Schedules / automations list | items with at least one target in the building (an item touching two buildings shows in both with a "גם בבניין ב" note) | computed on the server from each item's target entities; display only, it never gates a run |
| Plan editor > add device | home-system floor / building facet next to the search box | `routers/ha.py` entity search gains `building` (area set) and `ha_floor` |
| Search (global) | building facet | `/search?building=` (narrowing only) |
| Calendar > shared rooms | rooms whose floor is in the building | `GET /calendar/rooms/day?building=` |

### 5.5 Lobby board per building (MB-LOBBY-BOARD)
1. Settings > notice board > TV boards > a board gains "בניין" (one of the site's buildings, or "כל האתר").
2. The board's feed (`services/notices/display.build_feed`) uses that building's name in the header greeting.
   With "כל האתר" it keeps today's `building_name()` chain.
3. The notice editor's audience gains a shortcut "בניין א" (= every floor of the building) and the tag list of
   boards shows the board's building. A notice's TV visibility stays "tagged to the board" (unchanged rule: the
   audience does not apply to a TV).
4. The style is the owner-approved luxury family. The mockup shows Concierge with the building greeting, the shared
   building's car-park notice and a per-building ticker.

### 5.6 Resident groups per building (MB-RESIDENT-GROUPS)
User management > groups > "קבוצה לבניין": pick a building and a role (resident / building manager), name it
"דיירי בניין א". This creates a group and one building binding (`rbac.assign`, the existing T082 delegation rules).
Adding people is the group's member editor (bulk select, paged). No new authority type: it is a template over
groups
+ bindings.

## 6. Data model changes

| Row | Change | Migration | Backup |
|---|---|---|---|
| MB-HOME-IFACE | `home_interface_policy.building_id TEXT NULL` (the person's home building, display only; NULL = none) | yes, additive `ALTER TABLE` | already in ACCESS_TABLES |
| MB-FLOOR-MOVE | none (`floors.building_id` updated in place); audit action `floor.move` | no | - |
| MB-ENABLE-REVIEW | `home_mapping_state` gains `reviewed_version INTEGER NULL` (the version shown when the switch was last turned on) | yes, additive | PROJECT_TABLES (already) |
| MB-LOBBY-BOARD | `notice_boards.building_id TEXT NULL` (NULL = the whole site / today) | yes, additive | already (notices tables) |
| MB-RESIDENT-GROUPS | none (groups + bindings) | no | - |
| MB-SCREENS-FILTER, MB-XSECTION-WIDGET, MB-HA-AREA-SIGNAL | none (a new `WidgetId` `site_xsection` in `api/home-config.ts` + `services/home_config.py`) | no | - |

Migration numbers are taken at train integration (the next free number after the train's last; 0216 is the last on
main today).

## 7. API sketch

| Method + path | Row | Permission | Notes |
|---|---|---|---|
| `GET /home/overview` (+ `buildings`, floor `building_id`) | MB-HOME-IFACE | unchanged | Fields are added only while the switch is on and two or more buildings are visible; otherwise the answer is byte-identical. |
| `PUT /home/policies/{user_id}` (+ `building_id`) | MB-HOME-IFACE | `rbac.assign` | 422 if the building is not on a live site; audited |
| `GET /floors/{id}/move-preview?building=` | MB-FLOOR-MOVE | `site.content.configure` on the source AND target building | lose / gain / move counts, a paged people list, blockers |
| `POST /floors/{id}/move {building_id, preview_digest}` | MB-FLOOR-MOVE | same | 409 `preview_stale` when the digest differs (the bulk-preview pattern); audited `floor.move`; `revocation.mark(all)` |
| `GET /home/multi-building/preview` | MB-ENABLE-REVIEW | `site.content.configure` on every live site (the switch's own rule) | health, versions since `reviewed_version`, reach gain per building binding (counts, paged names) |
| `PUT /home/multi-building {enabled, reviewed_version}` | MB-ENABLE-REVIEW | unchanged | `reviewed_version` is required when turning on (422 without it); audited |
| `GET /energy/meters?building=`, `/calendar/rooms/day?building=`, `/search?building=`, `/ha/entities?building=&ha_floor=` | MB-SCREENS-FILTER | unchanged (narrowing only) | unknown building -> 404 `building_not_found`, the shared answer of `Cut` |
| `PATCH /notices/boards/{id}` (+ `building_id`) | MB-LOBBY-BOARD | notice-board manage | the feed uses the board's building name |
| `POST /access/groups/building-template {building_id, role_id, name}` (next to `/access/groups`, `/access/groups/{id}/bindings`) | MB-RESIDENT-GROUPS | `rbac.assign` with the delegation rules | creates a group + one binding in one transaction |

No route is removed. `contracts/API_INVENTORY.md` is regenerated by each build row.

## 8. Settings

| Key | Options | Default | Where | Row |
|---|---|---|---|---|
| `home.multi_building.enabled` (exists) | on / off | off | settings > בניינים ומיפוי | - |
| `home.iface.building_all` | `allow` / `hide` - may the home interface offer "כל הבניינים" | `hide` | user management > ממשק ביתי > הגדרות התקנה | MB-HOME-IFACE |
| `home.iface.building_entry` | `home` (the person's home building) / `last` | `home` | same | MB-HOME-IFACE |
| policy `building_id` | a building / none | none | user management > ממשק ביתי > per person | MB-HOME-IFACE |
| `catalog.floor_move` | `allow` / `off` | `allow` | settings > בניינים ומיפוי > מתקדם | MB-FLOOR-MOVE |
| `home.multi_building.review` | `required` / `skip` | `required` | settings > בניינים ומיפוי | MB-ENABLE-REVIEW |
| `ui.building_filter` | `on` / `off` | `on` | settings > תצוגה | MB-SCREENS-FILTER |
| board `building_id` | a building / the whole site | the whole site | notice board > TV boards | MB-LOBBY-BOARD |

Every behaviour the owner might want to change is a setting. The default is the recommended answer
(`feedback-unanswered-means-recommendation`).

## 9. Migration of an existing one-building installation

| Step | Who | What changes | Rollback |
|---|---|---|---|
| 0. Upgrade | - | nothing (switch off, pixel identity proven by the 2330 / 2351 specs) | the previous version ignores the new columns |
| 1. Names in the home system (optional) | installer | the naming convention of `private/guides/multi-building-setup-2026-10-30.html` (prefix "א · " on floors and areas, labels "בניין א / ב / משותף"). The assistant also copes with messy names. | - |
| 2. Buildings | installer | the assistant's apply creates the missing buildings and floors (audited `building.create` / `floor.create` via `home.mapping.apply`) | mapping versions: "חזרה לגרסה זו" (creates nothing new, deletes nothing) |
| 3. Existing floors drawn under the first building | installer | **MB-FLOOR-MOVE** for each floor of the other building: plans, anchors, cameras and floor bindings move with it; the impact preview shows who gains or loses access | move it back |
| 4. Shared building | installer | the "בניין משותף" check (exists) | uncheck |
| 5. People | administrator | resident groups per building (MB-RESIDENT-GROUPS); each person's home building (MB-HOME-IFACE) | remove the group bindings |
| 6. Review and turn on | administrator | MB-ENABLE-REVIEW: health, versions, reach change -> on | switch off = the exact one-building product, the mapping kept |

Risk in step 3: people with a binding on the original building lose the moved floors. The preview names them before
the confirmation, and the recommended order is to create the group of the new building first (step 5 before step 3)
so that nobody is left without access. The mockup's move sheet says this in one line.

## 10. Risks

| Risk | Likelihood | Effect | Control |
|---|---|---|---|
| A floor move silently removes access from people of the source building | medium | high | preview with names, digest-checked confirm, audit, access signal; recommended order (groups first) |
| Turning the switch on grants devices nobody reviewed (round 14) | medium | high | MB-ENABLE-REVIEW (required by default), `reviewed_version` audited |
| The home interface's building chip is taken as authority by a later developer | low | high | display-only field, the server never reads it in `ha_scope`; a unit guard that `ha_scope` / `building_scope` never import the policy's `building_id` |
| Moving an entity to another area in the home system changes its building without a signal (G4) | medium | medium | MB-HA-AREA-SIGNAL: `ha_sync` calls `building_scope.mapping_changed` when an area change touches a mapped area while the mapping counts |
| Filters hide items that span buildings (a schedule for both towers) | medium | low | an item shows in every building it touches, with a note; the filter is display only |
| The lobby board shows the wrong building after a building rename | low | low | the feed reads the name live; no cached copy |
| Pixel baselines drift for one-building installs | low | medium | each row's identity proof plus a baseline refresh on the runner for the screens that change with the switch on |

## 11. Test plan

| Layer | What | Where (new files) |
|---|---|---|
| Backend unit / API | home overview buildings + byte identity with the switch off; policy building 422 / audit; floor move preview counts (lose / gain / floor bindings), blockers, digest 409, permission on both ends (403 audited), access signal; enable review required + `reviewed_version` audited; filters narrow only (a caller never gains an item); board building name in the feed; group template creates exactly one binding, delegation refused above the caller's own | `tests/test_mb_home_iface.py`, `test_floor_move.py`, `test_mb_enable_review.py`, `test_mb_filters.py`, `test_notice_board_building.py`, `test_rbac_building_groups.py` |
| Identity proofs | for each row: switch off -> the new code replaced by a raising function never runs; answers equal | in each file above |
| Mutation checks | disable the cut / the digest / the review gate -> named tests fail | recorded in each change record |
| RBAC matrix | building-A resident: never controls B through the home interface's room / house off, a scene tile, or a wall panel | `tests/test_rbac_matrix.py` additions |
| Frontend unit | building chip model, grouping without interleaving, house-off target, filter model, move-preview words | `frontend/tests/unit-mb-*.spec.ts` |
| Evidence (Playwright, desktop 1440x900 / tablet 1280x800 / phone 390x844, light + dark) | no scroll (scrollTop 0, no vertical overflow) on every control screen; the tree present; no platform words; RTL; 56 px targets on the tablet | `frontend/tests/evidence-mb-*.spec.ts` |
| Pixel | the one-building home and home interface unchanged | the 2330 spec + the home pixel specs, run on the runner |
| Lab (owner approval per step) | a read-only look at the lab's mapping (one building today); no writes | `LAB-PACK-2490` style runbook step, not run by this row |

## 12. Rollout and effort (rows per agent)

Each row is one agent on its own branch from the train base. A row with a migration owns the shared table it changes
(single owner for shared API / DB changes, AGENTS.md).

| Row | Branch | Scope | Depends on | Migration | Size | Model | Est. agent hours |
|---|---|---|---|---|---|---|---|
| MB-ENABLE-REVIEW | `pilot/MB-ENABLE-REVIEW-25xx` | review sheet, preview route, `reviewed_version` | - | yes (state column) | M | deep (authority) | 5 |
| MB-FLOOR-MOVE | `pilot/MB-FLOOR-MOVE-25xx` | preview + move routes, Explore menu + sheet, access signal | - | no | M | deep (authority) | 6 |
| MB-HOME-IFACE | `pilot/MB-HOME-IFACE-25xx` | overview fields, building chip / sheet, grouped rooms, building house-off, policy building, wall panel building, notices / calendar / presence filter | MB-ENABLE-REVIEW (shares the switch rules) | yes (policy column) | L | balanced (+deep review of the house-off path) | 10 |
| MB-SCREENS-FILTER | `pilot/MB-SCREENS-FILTER-25xx` | `<sw-building-filter>` + 5 screens + server params | - | no | M | balanced | 7 |
| MB-LOBBY-BOARD | `pilot/MB-LOBBY-BOARD-25xx` | board building, feed name, audience shortcut, luxury header check | - | yes (board column) | S | balanced | 3 |
| MB-RESIDENT-GROUPS | `pilot/MB-RESIDENT-GROUPS-25xx` | template route + group dialog | - | no | S | deep review (delegation) | 3 |
| MB-XSECTION-WIDGET | `pilot/MB-XSECTION-WIDGET-25xx` | widget id + editor + backend config | - | no | S | balanced | 2 |
| MB-HA-AREA-SIGNAL | `pilot/MB-HA-AREA-SIGNAL-25xx` | access signal on area moves while the mapping counts | - | no | S | deep review | 2 |
| MB-DOCS | `pilot/MB-DOCS-25xx` | user guide section (DOCS_HE.md), redacted from the private installer guide; register T119 on main with these rows | all | no | S | balanced | 2 |

Suggested order: (1) MB-ENABLE-REVIEW and MB-FLOOR-MOVE (they close the authority risks); (2) MB-HOME-IFACE and
MB-RESIDENT-GROUPS; (3) MB-SCREENS-FILTER, MB-LOBBY-BOARD, MB-XSECTION-WIDGET, MB-HA-AREA-SIGNAL, MB-DOCS. Two trains
at most. Every UI row refreshes its own pixel baselines on the runner before it boards a train.

## 13. Open questions (recommendation first)

1. **Floor move permission.** a. `site.content.configure` on both buildings plus the impact preview (recommended);
   b. also require `rbac.roles.manage` whenever someone loses access; c. installation administrators only.
2. **Review before switching on.** a. Required, and a setting can skip it (recommended); b. always required, no
   setting; c. none (today).
3. **"כל הבניינים" in the home interface.** a. Hidden by default, a setting allows it (recommended: residents think in
   one building); b. shown to anyone who sees two buildings; c. never.
4. **A person's home building.** a. Set by an administrator per person, with "last chosen on this device" as the
   fallback (recommended); b. the person chooses it in their own settings; c. last chosen only.
5. **House off in the home interface.** a. The chosen building only, named on the button (recommended); b. also a
   whole-site off with the strong confirmation; c. today's behaviour.
6. **Items that span two buildings (a schedule, a meter for both).** a. Show in each building with a note "גם בבניין
   ב" (recommended); b. only under "כל האתר"; c. a fixed "primary building" chosen by the administrator.
7. **Lobby screen per building.** a. A board picks its building, and the header greets by building (recommended);
   b. one greeting for the whole site (today).
8. **Order of work.** a. Authority first (review + floor move), then the home interface, then filters and lobby
   (recommended); b. home interface first; c. all in one train.

## 14. Design notes (skills used)

- **ui-ux-pro-max** (`search.py ... --domain ux`). Taken: a breadcrumb for three levels (site > building > floor),
  touch spacing of 8 px or more, "live" data labelled with its update time. Rejected: its glassmorphism style and
  green accent (green is status only here) and its Latin font (Heebo stays).
- **impeccable** (context + craft floor, detector on the mockup). The mockup extends the incumbent system: `ds.css`
  tokens (Arx Infra direction), the home-interface themes, and the luxury lobby tokens (Concierge) for the lobby
  screen. No new visual world was chosen. PRODUCT.md / DESIGN.md (impeccable's own) do not exist in the project;
  the incumbent code was the authority, and `/impeccable init` is offered to the lead as a follow-up.
- **apple-design**: wayfinding (where am I / where can I go: the breadcrumb + chip), materials not stacked, reduced
  motion = cross-fade.
- **emil-design-eng**: press feedback `scale(.97)` 120 ms, ease-out `cubic-bezier(.23,1,.32,1)`, sheets from their
  trigger, no animation on the building switch itself (used tens of times a day: an instant swap, not a slide).

## 15. Mockup evidence (2026-11-20, workstation)

| Check | Command / tool | Result |
|---|---|---|
| Render + layout check of every screen, both schemes | Playwright (Chromium, the main checkout's `frontend/node_modules`), each frame at its native size (390x844, 1280x800, 1440x900, 1920x1080); a script lists any element outside the frame, any clipped box and any overflowing text | 7 screens x 2 schemes: no element outside its frame, no clipped or overflowing text, no scrolling |
| Screenshots | the same run, JPEG | `shots/t119-NN.jpg` (default scheme), `shots/t119-NN-alt.jpg` (the other scheme) |
| impeccable detector | `.claude/skills/impeccable/scripts/impeccable.cmd detect --json mockup.html` | after one fix loop (heading order): 9 `cramped-padding` warnings on fixed-height list rows whose text is vertically centred (kept: the rows are 40-68 px with centred text), 2 `nested-cards` (floor columns holding room rows: the approved rooms layout, kept). Output: `inspect/impeccable-detect.json` |
| ui-ux-pro-max | `search.py "multi-building site navigation breadcrumb segmented switch" --domain ux` | `inspect/ui-ux-pro-max-ux.txt` (taken / rejected: section 14) |
| Not run | a real phone or tablet, the product build, the 6 other home themes | NOT_RUN (design only) |
