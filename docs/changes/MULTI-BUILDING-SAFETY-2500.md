# MULTI-BUILDING-SAFETY-2500 - the two safety steps of a multi-building site

Owner decisions 22.11 (questions page `private/planning/questions_all_open_2026-11-22.html`, Q62-Q69 = the recommendations; Q69 work
order: **safety first**). This row builds the two safety items of the T119 next-phase design
(`docs/design/t119-multi-building/DESIGN.md` on `pilot/FEATURE-DESIGNS-HOME-2490`, rows MB-FLOOR-MOVE and MB-ENABLE-REVIEW):

- **Q62** - moving a floor between buildings is allowed only to someone who manages the content in BOTH buildings, with a preview of who
  loses access.
- **Q63** - a check before turning multi-building on is mandatory; a setting lets an administrator skip it.

Branch `pilot/MULTI-BUILDING-SAFETY-2500` from `main` 619f94d04 (2.47.0). No version bump, no migration, no merge.
Builds on MULTIBUILDING-HOME-2330, MAPPING-ASSIST-2330 and BUILDING-SCOPE-CONTROL-2351 (round 14: a building binding also reaches the
devices whose area the mapping puts in its building, while the switch is on).

## Q62 - moving a floor to another building

`services/floor_move.py`, routes in `routers/catalog.py`.

| Route | Permission | Answer |
|---|---|---|
| `GET /floors/{id}/move-preview?building=` (read connection, writes nothing) | `site.content.configure` on the floor's building **and** on the target building (each refusal is the audited 403 of `require`) | `FloorMovePreview`: the floor, from / to, `people` (counts `loses` / `gains` / `changes` / `total` + up to 200 rows, those who lose access first), `moves_with` (floor bindings, cameras, anchors, plans, mapped areas, records), `blockers`, `warnings`, `can_move`, `digest` |
| `POST /floors/{id}/move {building_id, preview_digest}` | the same two checks | `FloorMoveResult`: the floor row in its new building, from / to, the records updated, the counts. 409 `move_blocked` (a blocker), 409 `preview_stale` (the preview's digest changed since it was shown; `details.digest` = the new one) |

Refusals before any permission question: unknown floor 404 `not_found`; unknown or deleted target 404 `building_not_found`; the floor is
already in that building 422; a building of another site 422 (a site's time zone and address are its own).

**Who loses access** is worked out with the one RBAC rule, without writing: for every active person bound (directly or through a group,
allow or deny) on the source or the target building, the permissions held on the floor through its chain now (floor -> source
building -> site -> installation) and after the move (floor -> target building -> site -> installation) - `rbac.effective_on_chain`, a
new sibling of `effective_permissions` (deny overrides, an allow on a dead place grants nothing, a disabled user holds nothing). Floor,
site and installation bindings are in both chains, so they cannot change. `loses` = something now, nothing after; `gains` = the reverse;
`changes` = both have something but differ (e.g. operator on A + viewer on B keeps the viewer's permissions and loses the rest).
Cameras on the floor and the round-14 mapping reach follow the same chain, so the floor's permissions are the whole answer.

**What moves with the floor**: plans, anchors (cameras and devices), the floor's home-system links and its floor bindings all point at the
floor id and move unchanged. Records that keep a copy of the floor's building next to the floor id - `tickets`, `ticket_rfqs`,
`maint_tasks`, `notices`, `incidents` - get the new `building_id` in the same transaction (the ticket budget scopes and other
building-scoped lists read that copy). The mapped areas (home-system areas the mapping puts on this floor) follow the floor to the target
building - counted in `moves_with.areas`.

**Blocker**: a room shared between this floor and a floor that would stay in another building (`shared_spaces` allows sharing inside one
building only). **Warnings**: `level_clash` (the target already has a floor on that level - allowed) and `people_lose_access`.

**The move**: one transaction - `floors.building_id`, the record copies, the audit row `floor.move` (`from`, `to`, `loses`, `gains`,
`changes`, `lost_users`, `records`, `digest`), then `revocation.mark(all users)` so every open socket re-scopes at once. Undo = move it
back (the same flow). Nothing is deleted.

## Q63 - the check before turning multi-building on

`services/multi_building_check.py`, routes in `routers/home_mapping.py`.

| Route | Permission | What |
|---|---|---|
| `GET /home/multi-building/check` | the switch's own rule: `site.content.configure` on every live site | `HomeMultiBuildingCheck`: `digest`, `reach_mode`, `review_mode`, `buildings`, `blocking`, `warnings`, `last_on`, `findings[]` (`code`, `severity` blocking / warning / info, `count`, up to 20 `items`) |
| `PUT /home/multi-building {enabled, check_digest?}` | unchanged | turning it **on** (from off) re-computes the check: no digest -> 409 `check_required`; another digest -> 409 `check_stale` (`details.digest` = the new one); a blocking finding -> 409 `check_blocked`. Each refusal is audited `home.multi_building` denied with the reason and the check's numbers. Allowed -> the audit row gains `check` (`result` passed / skipped, `digest`, `blocking`, `warnings`, `reach_mode`, `reach_gain`, `cross_building`, `versions_since`) and the answer `check`. Turning off, or on while already on, is as before |
| `PUT /home/multi-building/review {mode}` | `rbac.roles.manage` across the installation (skipping lets the mapping become reach unreviewed - the same authority as "הרשאת בניין לפי") | the installation setting `home.multi_building.review` = `required` (default) / `skip`; audited `home.multi_building.review` (`mode`, `was`, `multi_building`). With `skip` the switch turns on without a digest; the check is still computed and its numbers written to the audit row (`result: skipped`) |

`GET /sites/{id}/mapping` gains `review_mode` and `can_set_review`.

**Findings** (worked out from the stored rows with the same resolution as the building cut and the round-14 reach):

| Code | Severity | Meaning |
|---|---|---|
| `entity_cross_building` | **blocking** (warning under "מיקום במפה") | a device placed on the maps of one building whose area the mapping puts in another: that other building's holders would control a device that physically sits elsewhere |
| `reach_gain` | warning (info under "מיקום במפה") | per building: the devices its building / site holders gain through the mapping (not placed on its maps), the sensitive ones (locks, alarm panels, sirens, door / garage / gate covers) and the holders (a group = one holder, by name) |
| `single_building` | warning | fewer than two live buildings: the home screen does not change, but the mapping still becomes reach |
| `mapping_empty` | warning | no area resolves to a building |
| `unmapped_areas` | warning | areas with devices that resolve to no building |
| `versions_since` | info | mapping versions applied since the switch was last turned on (who, when, kind) - BUILDING-SCOPE-CONTROL-2351 "open for the owner (1)" |
| `stale_rows` | info | mapping rows naming a deleted floor / building (they count for nothing) |

"Since the switch was last turned on": each turn-on writes the settings row `home.multi_building.last_on` (`at`, `by`, the newest mapping
version per site). No migration (the design's `reviewed_version` column became this settings row).

## Frontend (keep each module's look)

- `api/mb-safety.ts` - the pure rules (`moveTargets`, `moveGate`, `peopleOf`, `recordsMoving`, `checkGate`, `needsCheck`,
  `orderedFindings`), the routes, and the static demo's stand-ins (`?mbcheck=block`, `?mbmove=clean`).
- `screens/mb-enable-check.ts` `<mb-enable-check>` - the check dialog (sw-dialog `wide`): the findings blocking first, "עברתי על הממצאים" (an `sw-toggle`, like the other confirmations since HAND-SWITCH),
  "הפעל ריבוי בניינים" confirmed with the digest; a stale / blocked answer reloads the report. Its events do not bubble.
- הגדרות › בניינים ומיפוי (`screens/system-mapping.ts`): pressing the switch ON opens the check (with `skip` it turns on at once, as
  before); turning it off is one press, as before. A new row in "איך המיפוי מתנהג": "בדיקה לפני הפעלת ריבוי בניינים" - חובה / לדלג,
  disabled for anyone but an administrator of roles.
- The mapping assistant's last step ("הפעל עכשיו את תצוגת ריבוי הבניינים") goes through the same check.
- מפה › בניין › קומות › עריכה (`screens/explore-floors.ts`): on a site with two or more buildings the edit dialog shows the floor's
  building and "העברה לבניין אחר", which opens the move dialog: the target building (the shared `sw-dropdown`), the preview (people who lose access first, in red,
  a few names and "ועוד N"; gains; changes; what moves with the floor; a level clash; a shared-room blocker), "אני מבין ש־N אנשים יאבדו
  גישה" (`sw-toggle`) when anybody loses access, and "העבר את הקומה" (danger when somebody loses access). After the move the screen opens the target
  building. A one-building site: nothing new is drawn.
- English for every new text (`i18n/lang/en/i18n/msg/system-b.ts`, `media.ts`).

Before / after captures: `private/planning/mb_safety_2500_compare_2026-11-23.html` (demo mode, desktop / tablet / phone, light + dark).

## Tests

Run on the workstation 23.11 (one worker unless said).

- Backend `tests/test_mb_safety_2500.py` (12): the preview names who loses / gains / changes (a group member, an operator-on-A /
  viewer-on-B "changes", a disabled user and floor / site holders not listed, the digest stable, nothing written); the permission on
  BOTH buildings (source-only, target-only and floor editors each refused on preview and move, the audited 403 names the building);
  the move confirmed by the digest (a new binding since the preview -> 409 `preview_stale`, nothing written; then moved: the incident's
  building copy follows, sockets signalled, `floor.move` audit row, reach follows the floor, move back = undo); target validation
  (same building / other site 422, deleted / unknown 404, digest required); the shared-room blocker (409 `move_blocked`) and a share that
  stays inside the target building does not block; the preview's "after" agrees with `rbac.authorize` after the real move; the check
  required + digest (409 `check_required` / `check_stale`, audited, then passed and audited with the check); reach gain per building with
  holders (a group = one holder) and placement removing a device from the gain; a device placed in B but mapped to A blocks (409
  `check_blocked`), and under "מיקום במפה" it is a warning and the switch goes on; the review setting is the roles administrator's
  (403 for a site administrator, 422 for an unknown mode, audited `mode` / `was`), and with `skip` the switch turns on without a digest
  (`check: skipped`, the blocking count still audited); versions applied since the last turn-on; one building = warnings only.
  **12 passed.**
- Existing tests that turn the switch on now confirm with the check's digest (`test_mapping_assist_2330`, the `_multi_on` helper of
  `test_building_scope_single_2351`, used by round 14 too).
- Targeted regression, 22 files (the new file + access, building reach / scope control / scope single, catalog, home links, mapping
  assist / improve, multibuilding home, rbac x5, setting parity, singletons, wire consumption / route coverage / routers b, c, d):
  **427 passed, 0 failed** (16 min).
- Mutation check (each guard disabled in turn, its tests must fail; the file restored after each): target-building permission,
  source-building permission, the move digest, the shared-room blocker, `check_required`, `check_stale`, `check_blocked`, the review
  setting's permission, the preview's after-chain - **9 of 9 caught** (1-2 tests fail each).
- `scripts/design_ratchet.py`: no count above the baseline (the first runner run caught +28 px literals, one native select and two
  native checkboxes in the new dialogs; replaced by spacing tokens, `sw-dropdown` and `sw-toggle`). `scripts/release_check.py` on the
  workstation after the fix: see Runner below.
- `scripts/gen_wire_types.py` and `scripts/api_inventory.py` regenerated (1910 -> 1914 routes).
- Frontend: `npx tsc --noEmit` (app and tests) clean; `tests/unit-mb-safety-2500.spec.ts` **7 passed**; with
  unit-building-scope-control-2351, unit-home-site-2330, unit-mapping-assist-2330: 34 passed before the last unit was added;
  unit-i18n-api-2442 (Hebrew literals stay in the demo module `api/mb-safety-demo.ts`) + the new unit spec **34 passed**;
  `scripts/unused-exports.mjs --enforce` OK; `scripts/lazy-tags-check.mjs` OK.
- Evidence against a build of the branch (demo mode; desktop / tablet / mobile): `evidence-mb-safety-2500` + `evidence-mapping-assist-2330`
  (its "turn on now" step now goes through the check) **37 passed, 2 skipped** (the floor dialogs on the phone, which has no structure
  editing).
- Before / after captures: 24 images, all with 0 px horizontal overflow (`private/planning/mb_safety_2500_compare_2026-11-23.html`).

RUNNER_PLACEHOLDER

## Open questions for the owner (not blockers; recommendation first)

1. **Who may skip the check.** Built: only an administrator of roles (`rbac.roles.manage` everywhere), because skipping lets the mapping
   become permission without review. (a) keep (recommended); (b) anyone who may turn the switch on.
2. **A device placed in one building but mapped to another** is blocking while the mapping counts for reach. A device that really serves
   two buildings (the 30.10 convention: it keeps its physical area) would then block. (a) keep blocking, the fix is in the mapping or the
   map (recommended); (b) a warning only.
3. **Floor move setting.** The design listed `catalog.floor_move` (allow / off). Not built: the permission rule of Q62 already limits it
   to people who manage both buildings. (a) not needed (recommended); (b) add the setting.
4. **People who lose access - one more step?** Built: the preview names them and the confirm asks "אני מבין". The design's option b
   (also requiring role management whenever someone loses access) was not chosen in Q62. Nothing to decide unless the owner wants b.

## Known limits

- The preview lists people bound on the two buildings; a person whose only reach to the floor is installation-wide is never affected and
  is not listed. Inactive users are left out (they hold nothing).
- The people list in the answer is capped at 200 (counts are complete); the dialog shows six names per kind and "ועוד N".
- `home.multi_building.review` and `home.multi_building.last_on` are settings rows outside `GET /settings` (like
  `security.building_reach`); they are read through `GET /sites/{id}/mapping` and the check.
- Mutation / identity proofs: see Tests.

## Rollback

Revert the branch commits. No migration; the two new settings rows are ignored by an older version (turning the switch on is then one
press again).
