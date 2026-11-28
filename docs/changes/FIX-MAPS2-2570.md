# FIX-MAPS2-2570 - second deep review of maps / home (MH2-01..MH2-09)

Findings: `docs/review/DEEP-REVIEW-2570-MAPS-HOME.md` on `origin/review/DEEP2-2570-MAPS-HOME` (second pass, reviewed at `6ea807b2e`).
Branch `pilot/FIX-MAPS2-2570`, based on `origin/pilot/FIX-HOME-MAPS-2570` (`6d2a01ad4`, lead's instruction: that row already changed
the home / map files, so the two rows merge cleanly). Each finding was re-checked at the base before fixing: all nine still present.

## What changed

| Finding | Change |
|---|---|
| MH2-01 (medium) wizard rooms orphaned after a failed tag | `plan-wizard/wizard-rooms.ts saveWizardRooms` (moved out of `plan-wizard.ts saveRooms`): the wizard keeps the new rooms as soon as `acceptRooms` answers, before tagging. Every room is tagged; a failure names the untagged rooms ("save again replaces them, without duplicates"). "Save" again replaces that set (one set on the floor), "discard" (`confirmReplace`) reaches it. |
| MH2-04 (low) room linked to another building's area by name | `GET /ha/entities?area_buildings=true` (additive; `routers/ha.py`, wire `HaEntitiesArea.building_id`) adds each listed area's building from `building_scope.area_buildings` (null = none). The wizard (`areaOfName`) links / offers only areas of the floor's building or of no building; a name of another building's area is not linked and the field's hint names that building. Without the parameter the answer is as before. |
| MH2-02 (medium) site turn-off hides runs already sent | `screens/site-off-run.ts startSiteRuns`: the dialog follows each building's run as soon as it is started; when a later building's request fails, the started runs are followed to the end and the dialog says where it was sent, which request failed and where nothing was sent (no retry, no queue). The headline is the single dialog's `bulkHeadline` over the summed counts: only-sent devices read "נשלח" / "בוצע (חלק נשלחו ללא אישור)", never "בוצע"; the running count is of confirmed devices. |
| MH2-03 (low) pin moved during a save lost; double Ctrl+S false conflict | `screens/pin-save.ts savePinsOnce`: the set is read once; at the end only pins saved with the values they have now leave the unsaved set (a pin moved during the save keeps its mark; the toast says so). `PinSaveFlight`: the button and Ctrl+S share one save; a call during a save waits and saves again only if something is still unsaved. |
| MH2-05 (low) wall profile save without a version check | `PATCH /wall/profiles/{id}` takes an optional `version` (>= 1). A different current version answers 409 `stale_version` (details `current_version`, `sent_version`), audited as a denied `wall.profile.update`, nothing written, no binding re-sync. Without `version`: as before. `system-wall.ts` sends the version the dialog loaded. |
| MH2-06 (low) `GET /skins/status` open to any signed-in user | `require(system.configure, installation)` - the audited 403 for a viewer, an editor, a wall / kiosk user. |
| MH2-08 (low) English home pager and chevrons | The pager's numbers are isolated `.num` spans and the words follow the language (`direction: rtl` removed); directional chevrons (`hi(name, 'flip')`: pager, header back, favourite rooms, widget move, camera / day steps, menu rows) are mirrored under `:dir(ltr)`. Keypad delete icons, video and map geometry are not mirrored. Hebrew renders as before. |
| MH2-09 (low) "Electricity today" clipped at 360 px | The energy tile's label is one line inside the tile (`clamp1`, `.wg-c.en1` grid column `minmax(0, 1fr)`), English "Used today". |
| MH2-07 (low) failure paths untested | `frontend/tests/unit-fix-maps2-2570.spec.ts` drives the code the screens run (wizard rooms save, site runs, pin save) with in-memory servers: failed tag then save again, untagged names, discard reach, room-to-area by building, later building failing, headline words, pin moved during save, Ctrl+S during save. Backend `tests/test_fix_maps2_2570.py`. |

New texts are Hebrew + English (`i18n/lang/en/i18n/msg/{plan-wizard,screens,plan-editor}.ts`, backend `error_text_en.json`); the
modules have no Arabic / Russian tables.

## Tests (runner, real results)

All on the runner (slot B). "Before" = commit `dd3aac4ab` (the extraction step: the old code moved unchanged into the new modules).

| What | Before | After |
|---|---|---|
| `tests/unit-fix-maps2-2570.spec.ts` (8 tests, MH2-01..04) | 8 failed (at `dd3aac4ab`) | 8 passed (at `681223b43`) |
| `tests/test_fix_maps2_2570.py` (5 tests, MH2-04/05/06) | 4 failed, 1 passed (the no-version wall save, by design) | at `681223b43`: 4 passed, 1 failed (test bug: `empty_room` has no entities, so it is not in the area list); test corrected in `e24f6c1f9` - its re-run was queued, NOT_RUN at the time of this note |
| Evidence checks MH2-08 / MH2-09 (`evidence-fix-maps2-2570.spec.ts`, phone 360 px) | 2 failed (base `6d2a01ad4`) | 2 passed |
| Full node unit lane (`playwright.unit.config.ts --workers=2`) | - | 5556 passed, 16 skipped, 0 failed (at `681223b43`) |
| `tsc` app + tests, `eslint` on the changed files | - | exit 0 / 0 / 0 |
| `gen_wire_types.py` | - | no diff after regeneration (`wire-ha.ts` committed) |
| Backend related files (SW_WIRE_STRICT=1): `test_wall` + `test_wall_alerts`; `test_plan_skins` + `test_secrets_store` | - | 23 passed; 45 passed |
| Backend `test_mb_next_2500`, `test_building_scope_control_2351`, `test_plan_wizard_api_2434`, `test_i18n_errors_en_2520`, wire drift / ratchet / route coverage | - | passed at `88197cea7` (15 / 14 / 27 passed); the `681223b43` re-run was still running - NOT_RUN for the final head |
| Pixel specs: `pixel-home-*` (5 files), `pixel-plan-wizard-2433/2434`, `pixel-wall-followups-2390` | - | 78 passed, 54 skipped (Hebrew look unchanged, no baseline refreshed) |

NOT_RUN: page-driving unit specs (`SW_UNIT_PAGES=1`), the full evidence / layout suites, the full backend suite, tablet size.
Compare page: `private/planning/fix_maps2_2570_compare_2026-11-28.html` (desktop 1440 + phone 360, light + dark, Hebrew + English).

## Notes for the lead

- Files outside the home / maps area touched for the additive API: `routers/ha.py` (the `area_buildings` parameter), `wire/ha.py`,
  `frontend/src/api/generated/wire-ha.ts` (regenerated), `routers/skins.py`, `routers/wall.py`, `screens/system-wall.ts`, `api/wall.ts`,
  `api/ha.ts`. Merge order: after `pilot/FIX-HOME-MAPS-2570`.
- The site turn-off dialog pictures on the compare page are rendered from a state set on the element (the flow itself is covered by the
  unit spec); the home pictures are the real screen with the home mocks.
- Rollback: revert the branch's commits; the API additions are optional parameters / keys (an older client never sends them).
