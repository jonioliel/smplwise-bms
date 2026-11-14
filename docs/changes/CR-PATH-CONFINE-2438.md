# CR-PATH-CONFINE-2438 - one containment rule, one folder per stored file column

Code review 2026-11-13, findings **05:P2-13** and the path / name parts of **05:P3-06** (MASTER_PLAN entry
`CR-PATH-CONFINE-2436`, wave 2 backend).

## Base

`origin/main` (`0a8fb55e1`, 2.43.5) **plus a merge of `origin/pilot/BACKEND-SAFETY-2435` (`300945228`)**. The plan row says this
branch uses `confine()` from BACKEND-SAFETY-2435 and comes after it; that branch is not on main yet, so it is merged here (clean
merge, no conflict). Once BACKEND-SAFETY-2435 reaches main the merge commit adds nothing. None of this branch's files is touched by
`pilot/CR-WAVE1B-COMBINED-2436`, so no wave-1 base is needed. BACKEND-SAFETY's own lines are not edited: `safe_paths.py` only gains
new functions at its end, and in `services/backup._unsafe_rows` the new lines sit beside (not on) the lines BACKEND-SAFETY changed.

## What and why

**P2-13.** The plan and energy file routes relied on the restore-time check only, and that check accepted any restorable folder
for any file column: a restored `plan_versions.image_path` could name a stored bill (`energy/bills/...`), a bake, a ticket photo,
and the plan routes then served it, copied it into the plan folder (rollback) or deleted it (draft delete). The containment check
itself existed in ten copies.

- `services/safe_paths.py` (new, appended): `inside(root, candidate)` - the one containment rule; `stored_under(data_dir, root,
  rel)`; `plan_asset_dir(data_dir, asset_id)` (a plain id, never `floor-images` / `bakes`); `COLUMN_ROOTS` - the folder of each
  stored file column (`plan_assets.storage_path` and `plan_versions.image_path` / `stylized_path` -> `plans/<asset id>/`,
  `floor_images.path` -> `plans/floor-images/`, `plan_bakes.path` -> `plans/bakes/`, `energy_bills.pdf_path` -> `energy/bills/`,
  `energy_assets.storage_path` -> `energy/assets/`); `column_file(data_dir, table, column, row)`.
- Serving routes use `column_file`: `routers/plans.py` (image, source, stylized, stylize, rollback copy, draft delete, page render,
  version create, DXF layers / summary / import), `routers/energy_billing.py` (stored bill PDF; a path outside `energy/bills/` is
  treated as a missing file and the bill is rendered again from its snapshot; the store-once write is skipped for a bill id that
  would leave `energy/bills/`).
- Restore: `services/backup._unsafe_rows` skips a row whose file column is outside that column's own folder (on top of the
  existing restorable-roots rule), and the archive writer uses `inside`.
- The ten copies now call `safe_paths.inside`, each keeping its error type and message: `services/floor_images.py`,
  `plan_bakes.py`, `skins/store.py`, `maintenance/files.py`, `tickets/image_intake.py`, `tickets/attachments.py`,
  `bundle_import.py`, `backup.py`, `wall_photos.py` (still a direct child of the root), `tickets/public_app.py` (still a direct
  child of `assets/`). `confine_stored` in floor images, bakes and skins uses `safe_paths.confine`'s plain-relative-path rule
  (it also refuses `.`/empty segments, a drive colon and NUL; the product never writes those).

**P3-06 (paths and names).**
- Restored ids that name a folder - `cases/<case id>/`, `plans/<asset id>/`, `thumbs/frames/<camera id>/` - get the floors' rule
  (`FOLDER_ID_TABLES` in services/backup.py): a row whose id is not a plain id (`db.ID_RE`, full match) is skipped, and so is
  every row pointing at it (`case_id`, `asset_id`, `camera_id`). Events are not a backup table (nothing restored).
- `routers/backup.py` (`NAME_RE`) and `services/bundle_import.py` (`FILE_RE`) use `fullmatch`: `$` alone accepted a trailing newline.
- Not in this branch: the `TimeoutExpired` log point in `services/recorders/provision_playback.py` / `services/exports.py`
  (the report marks it "verify reachability"; it is not a path check and the plan row lists neither file).

No functional loss: every path the product writes passes (the plan, energy, floor image, bake, skin, ticket, maintenance and backup
suites below run green). A stored path the product never writes (absolute, outside the column's folder) is now a 404 / a skipped
restore row, as intended.

## Tests

New `smplwise_vms/backend/tests/test_path_confine_2438.py` (9 tests).

Reproduced before the fix (the branch's code files reset to the merge commit, new test present): **7 failed, 1 passed, 1 skipped**
- the two unit tests of the new rule, the plan routes serving / deleting a bill (`image.png` answered 200 with the bill), the bill
route serving a plan-folder file, the crafted archive (only 1 plan version and 1 asset skipped instead of 4 + 1, plus the case and
case item), the restored camera id, the trailing newline in a bundle file name. The one that passed is
`test_the_module_checks_keep_their_answers` - by design: it pins the ten copies' answers before and after.
After the fix: **8 passed, 1 skipped** (`test_the_backup_routes_refuse_a_name_with_a_trailing_newline` needs a POSIX file name with
a newline; it runs on the runner).

Local focused run of the existing suites (workstation, `-p no:xdist`, venv Python 3.12): see below.

## NOT_RUN

- Full backend suite and the POSIX-only test: runner entry check.
- `routers/plan_geometry.py`, `routers/zones.py`, `services/plan_package.py` also read `plan_versions.image_path` /
  `plan_assets.storage_path`; they are outside this plan row's file list and are covered by the restore-time column rule. Moving them
  onto `column_file` is a one-line follow-up each.
- No UI change, no pixels.
