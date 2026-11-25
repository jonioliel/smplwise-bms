# MULTI-BUILDING-FILTER-2520 - the building filter in the home interface and the resident's phone calendar

Approved for 2.52 (the lead's row; owner rule: unanswered = the recommendation). T119 design row MB-HOME-IFACE step 7
(`docs/design/t119-multi-building/DESIGN.md` on `pilot/FEATURE-DESIGNS-HOME-2490`: "notices, calendar and presence in the home interface
are filtered to the chosen building plus site-wide items") and open question 2 of MULTI-BUILDING-NEXT-2500 (recommendation (a): a later
row, after the owner sees the lists' filter - this is that row).

Branch `pilot/MULTI-BUILDING-FILTER-2520`, based on `origin/main` = v2.51.0 (3d71fb183). No migration, no new setting, no version bump.

## What

The same building filter as the full interface's lists (MULTI-BUILDING-NEXT-2500: `services/building_filter.prepare` / `apply`,
`building_filter` = `{buildings, building}`, each item's `buildings`), brought to:

1. **The home interface** (the simple home screen, `sw-home`):
   - **לוח הודעות** (`#/home/notices`): one building's notices. A notice's buildings are the buildings of its audience floors (and of
     its audience areas' floors); a notice with no floor in its audience (everyone / groups / roles) shows under every building; a floor of
     the shared building ("בניין משותף") serves every building (Q67). A notice for several buildings says "· גם ב..." next to its time.
     The "new" badge of the hub tile and the screen's counts follow the chosen building.
   - **יומן › חדרים משותפים** (`#/home/calendar/book`): one building's shared rooms (the room calendar's floor -> its building; a room of
     the shared building under every building). "ההזמנות שלי" stays the person's whole list.
   - The control is the home's own segmented control (`h.seg`, the look of the screen's other tabs): "כל הבניינים" (the home's words for
     the whole site) then the buildings in the full interface's order, the shared building last. On a desktop / tablet it sits in the
     header next to the screen's tabs; on a phone it takes its own row under the tabs (the first runner pass showed the two segmented
     controls side by side clipping the shared-rooms tab at 390 px; fixed in 44483b0c7, the lists still page without scrolling).
   - **Where a list opens** (design step 7): on the building the home interface shows (its building button), when the list offers it;
     "כל הבניינים" there = every building here; else the device's last choice of a list (`sw.building_filter`, the full interface's key);
     else every building. A choice made in a list holds while the home stays on the same building.
   - **A wall panel locked to its room** draws no control: its notice board follows the panel's building (when the board offers it) and
     never another choice made on the device. (The shared-rooms tab is not drawn on a locked panel, as before.)
2. **The resident's phone calendar** (`cal-resident`, the phone flow of a person who manages no calendar): the full interface's
   `sw-building-filter` as one row under the tabs, on the room list ("הזמנת חדר") and on the day grid ("יומן"); not inside one room, not on
   "ההזמנות שלי". It opens like the full interface's rooms view: the device's last choice when offered, else the whole site.
   `cal-view-calendar` gains `hideRooms` (the resident grid leaves out the room calendars of other buildings).
3. **הגדרות › בניינים ומיפוי › "סינון לפי בניין ברשימות"**: the hint names the home interface's notice board and shared rooms too.

### Server

`GET /notices?scope=mine` gains `building` (max 120) and, while the filter applies, `building_filter` and each notice's `buildings`
(`routers/notices.list_notices`, `_audience_floors`; wire `NoticesList.building_filter`, `NoticeRow.buildings`, both optional - additive,
ADR-015). The shared rooms reuse `GET /calendar/rooms/day` as it is (it already answers the filter since 2.50); the screens filter in the
browser from the full answer, like the full interface's rooms view.

- **It only narrows**: it runs after the audience rule (`in_audience`) on the notices the reader already sees; it never adds a notice, never
  reads or writes a binding.
- **Off = exactly before**: multi-building off, `home.multi_building.filter` = off, or fewer than two live buildings -> `prepare` answers
  None: no new key, `building` ignored, the filter's code not constructed (the test replaces `View` with a raising function). Fewer than
  two buildings among the reader's notices -> no key either (the screens then draw nothing).
- **The managers' list (`scope=all`) is unchanged** (no key, the parameter ignored).
- Unknown / deleted building while on: the shared 404 `building_not_found`.

### Not built (see the questions)

- **מי בבית** (presence) by building: the household list carries names only (no place leaves `services/home_family.presence_home`), so a
  filter would have to reveal which building each person lives in or is in.
- The wall panel's rest-screen takeover (an urgent notice taking the screen) still shows every urgent notice the panel's audience gets.

## Why

Design step 7 / the owner's approval of the 2.52 roadmap: on a multi-building site a person who lives in tower A and works in the annex
(or a household reaching two towers) gets one building's notices and rooms, the same way the full interface's lists already do.

## Files

| File | Change |
|---|---|
| `smplwise_vms/backend/smplwise/routers/notices.py` | `GET /notices` `building`, the filter on the reader's list, `_audience_floors` |
| `smplwise_vms/backend/smplwise/wire/notices.py` | `NoticeRow.buildings`, `NoticesList.building_filter` (optional) |
| `smplwise_vms/backend/tests/test_mb_filter_2520.py` | new (4 tests) |
| `contracts/API_INVENTORY.md`, `frontend/src/api/generated/wire-notices.ts` | regenerated (`scripts/api_inventory.py`, `scripts/gen_wire_types.py`) |
| `frontend/src/home/home-list-building.ts` | new: the home lists' filter rules (`homeListChoice`, `HomeListFilter`), DOM-free |
| `frontend/src/home/home-notices.ts`, `home-calendar.ts`, `home-p2-api.ts` | the control, the narrowing, "גם ב...", the answer types |
| `frontend/src/calendars/resident.ts`, `view-calendar.ts` | the resident's filter row; `hideRooms` for the resident grid |
| `frontend/src/screens/system-mapping.ts`, `src/i18n/lang/en/i18n/msg/system-b.ts` | the setting's hint (Hebrew + English) |
| `frontend/src/i18n/lang/en/i18n/msg/home.ts` | "בניין" -> "Building" |
| `frontend/tests/unit-mb-filter-2520.spec.ts` | new (6 tests) |
| `frontend/tests/mb-filter-2520-mocks.ts`, `evidence-mb-filter-2520.spec.ts`, `pixel-mb-filter-2520.spec.ts` (+ 10 Linux baselines from runner pass 2) | new |

No file of the 2.52 train rows (WisKey R1-R7, bridge 0.10.9, DESIGN-LITERALS-2510) is touched. The generated `wire-notices.ts` and
`API_INVENTORY.md` are regenerated files: on a merge conflict, regenerate them.

## Tests

Runner = the Linux test server, slot B (`~/work/slotb.sh`), worktree `~/work/mbf2520`; pass 1 at ebaa5d1ab, pass 2 (the phone row
fix) at 44483b0c7, pass 3 = a pixel re-check at 44483b0c7. Backend with `SW_WIRE_STRICT=1`, one pytest process per shard. Workstation = one small file at a time.

| Run | Where | Command / scope | Result |
|---|---|---|---|
| `tests/test_mb_filter_2520.py` (off / setting off / one building = before, with `View` replaced by a raising function; each notice's buildings, shared building serves all, no floor = every building, narrowing to one, 404; `scope=all` unchanged; a building-A reader only ever gets a subset and is offered only A and B) | workstation | `pytest -q tests/test_mb_filter_2520.py` | exit 0, **4 passed** (first run: 1 failed on the answer's own `now` clock differing between two calls - the test now drops `now`) |
| Backend shard 0: `test_mb_filter_2520`, `test_mb_next_2500`, `test_mb_home_2500`, `test_mb_safety_2500`, `test_building_reach_round14` | runner | pytest | rc 0, **45 passed** |
| Backend shard 1: `test_notices_106`, `_perm_295`, `_security_295`, `_info_295`, `_push_295` | runner | pytest | rc 0, **139 passed** |
| Backend shard 2: `test_wire_notices_2470`, `test_notice_delete_295`, `test_notice_remove_295`, `test_board_mgmt_2381`, `test_home_followup_b_2431`, `test_notice_news_empty_2500` | runner | pytest | rc 0, **60 passed** |
| Backend shard 3: `test_release_check`, `test_wire_route_coverage_2460`, `test_get_routes_read_conn`, `test_rbac_matrix` | runner | pytest | rc 0, **743 passed** |
| Mutation 1: the reader list never narrowed (`bf = None`) | runner | `test_mb_filter_2520.py` | rc 1, **3 failed** / 1 passed - caught |
| Mutation 2: the managers' list narrowed too | runner | `test_mb_filter_2520.py` | rc 1, **1 failed** / 3 passed - caught (file restored; `git status` clean after) |
| `ruff check smplwise` | runner | | rc 0, all checks passed |
| `scripts/gen_wire_types.py --check` | runner | | rc 0 (regenerated on the workstation first: `wire-notices.ts`) |
| `scripts/api_inventory.py` | workstation | | 1939 routes, one row changed (the `GET /notices` docstring) |
| `scripts/design_ratchet.py` | runner + workstation | | rc 0, no count above the baseline |
| `tsc --noEmit -p .` and `-p tsconfig.tests.json` | runner | pass 1 and pass 2 | rc 0, **0 errors** each |
| eslint on the changed source files | runner | pass 1 and pass 2 | rc 0 |
| `lazy-tags-check.mjs`, `unused-exports.mjs --enforce` | runner | | rc 0 |
| Unit: `unit-mb-filter-2520` (6), `unit-mb-next-2500`, `unit-mb-home-2500`, `unit-i18n-home`, `unit-i18n-plan-view-2443` (the system-b table) | runner | `-c playwright.unit.config.ts` | rc 0, **27 passed** (workstation earlier: `unit-mb-filter-2520` + `unit-mb-next-2500` 11 passed, `unit-i18n-home` 6 passed) |
| `npm run build` | runner | pass 1 and pass 2 | rc 0 |
| `tests/evidence-mb-filter-2520.spec.ts` (home notices: none before, opens on tower A, tower B with "גם ב...", desktop 1440 + phone 390, light + dark; home shared rooms the same; the locked wall panel; the resident phone room list + day grid + "my bookings"; no page scroll and no sideways overflow asserted on every screen) | runner | `--project=desktop --workers=2` | pass 1 rc 0 **6 passed**; pass 2 rc 0 **6 passed** |
| The same spec, "before" only, against a build of the base 3d71fb183 (`SW_MBF_BEFORE=1`) | runner | | rc 0, **5 passed, 1 skipped** (the after-only wall test) |
| `tests/pixel-mb-filter-2520.spec.ts` - new Linux baselines (10: home notices + home rooms desktop/phone light/dark, resident room list phone light/dark) | runner | `-u` then a re-check | pass 2: update rc 0 **10 passed, 2 skipped** (resident on desktop: phone only); re-check rc 0 **10 passed, 2 skipped** |
| `pixel-home-next-2500`, `pixel-home-fb-2431` (screens of this row without the filter: their baselines must not move) - no update | runner | `--project=desktop --project=mobile` | pass 1 rc 0 **18 passed**; pass 2 rc 1 **17 passed, 1 failed** (`wall notice board, all dark` desktop: 41 px against the 40 px allowance - a screen this row does not change without the filter, identical in pass 1); pass 3 (same build, re-check only) `pixel-home-next-2500` twice: rc 0 **10 passed** each - flaky by 1 px, no baseline changed |
| Regression: `home-v3-p2.spec.ts`, `evidence-mb-next-2500`, `evidence-mb-home-2500` | runner | desktop | pass 1 rc 0 **29 passed**; pass 2 (home-v3-p2) rc 0 **15 passed** |
| Regression: `evidence-calendars-settings-2310` (resident flow), `evidence-calendars-grid-edit-2343` | runner | mobile | rc 0, **35 passed, 8 skipped** (desktop-only tests) |
| The rest of the backend suite, the full Playwright suites, tablet | - | - | **NOT_RUN** (the release gate's job) |

Compare page (Hebrew, local): `private/planning/mb_filter_2520_compare_2026-11-25.html` - "before" from a build of the base (2.51),
"after" from pass 2.

## Safety review (RBAC)

- No route grants anything new; the new parameter only removes notices from a list the audience rule already built (test: a building-A
  reader gets a subset for every building choice, never tower B's or the car park's own notice; the choices are only the buildings his own
  notices sit in).
- `buildings` names building ids of the audience floors of a notice the reader already reads; the floors themselves are not sent (the
  reader's list never carried the audience).
- The home / resident controls are display only; a locked wall panel cannot be switched to another building's notices from the panel.

## Open questions (recommendation first)

1. **"מי בבית" by building.** (a) leave it as today (recommended: the household list has no place by design, filtering it would reveal where
   people live); (b) a later row that filters by each person's home building (the policy `building_id`), shown only to people of the same
   building.
2. **The wall panel's rest-screen takeover.** (a) leave it (recommended: an urgent notice the panel's audience gets always takes the screen);
   (b) take over only for the panel's building (and the shared building / everyone).
3. **Where a home list opens.** (a) on the home's building (built, design step 7); (b) on "כל הבניינים" like the full interface's lists.
4. **The full interface's notice board** (ראשי › לוח הודעות, the reader's list) now receives the same `building_filter` but draws nothing.
   (a) a later row if the owner wants it there too (recommended); (b) add it now.

## Rollback

Revert the branch commits. No migration; the new keys are optional and ignored by an older client.
