# MAINT215 progress (handoff, 2026-10-23)

Branch `pilot/MAINT215-295` from `origin/main` @ `90cd7d9ae`. Change record: `docs/changes/CR-MAINT215.md`.

## Done and tested
- Migration `0147_maintenance.sql` (provisional number; lead renumbers): `maint_tasks`, `maint_records`, `maint_tags`.
- Services `services/maintenance/` (model, access, service, reminders), router `routers/maintenance.py` (19 routes, module gate,
  permission, visibility), switch `maintenance.enabled` (default false, audited), permissions `maintenance.view/perform/manage`
  in `roles.json` + design contract + labels, notification sources `maintenance.due_soon/overdue`, recipient rule and subject
  kind `maintenance`, janitor hook (15 min throttle).
- `tests/test_maintenance_215.py`: **33 passed** on the runner (commit de0dab676, 108 s).

## Session 2 (2026-10-23) results
- Regression run on the runner (11 files: notify_core, access_permissions_wxperm, alarm, infra_elevators_280, tickets_monitor,
  migrations, needs_review, janitor, me_permissions, ui_settings, tickets_s4_wiring): 203 passed, 1 failed. The failure was a stale
  pin in `test_notify_core.py` (the policy list now hides `maintenance.*` while the module is off, like tickets); test fixed
  (671c7871d) and `test_notify_core.py` re-run: 27 passed.
- API inventory regenerated (1218 routes, +20 maintenance routes). The CR mockup path was already correct.
- Migration number 0147 is PROVISIONAL, isolated in `0147_maintenance.sql`; the lead renumbers at integration.

## Remaining
- Mockup `docs/design/mockups/maintenance-215/index.html` not reviewed in a browser (light/dark, phone width).
- Slice 2 (UI) proposal: CR section 12, after the owner approves the mockup. Full gate not run (by design).
- Steps 1-4 below are DONE (see Session 2).

## Next 5 steps
1. On the runner run: `tests/test_notify_core.py tests/test_access_permissions_wxperm.py tests/test_alarm.py tests/test_infra_elevators_280.py tests/test_tickets_monitor.py tests/test_migrations.py tests/test_needs_review.py` (at most 3 pytest processes; split).
2. Grep tests for `janitor_tick` / settings DEFAULTS pins and run those files.
3. Regenerate the API inventory on the runner (`python scripts/api_inventory.py` from the worktree, venv python), commit.
4. Fix the mockup path in CR-MAINT215.md section 8; view the mockup in a browser (light/dark, phone width).
5. Final report to the lead; slice 2 proposal is CR section 12.

## Open owner questions
See CR-MAINT215.md section 11 (8 questions: lead times, manage sensitivity, placeless visibility, QR address, expired supplier
assignment, backups, request closure -> plan done, notification category).

## For the next session
- Runner worktree used: `~/work/maint215` (removed at handoff). Recreate:
  `cd ~/smplwisebms && git fetch -q origin && git worktree add -f ~/work/maint215 origin/pilot/MAINT215-295`
- Test command that worked (from `~/work/maint215/smplwise_vms/backend`, in background with nohup):
  `nice -n 10 ~/smplwisebms/.venv/bin/python -m pytest -q -o addopts= -p no:cacheprovider tests/test_maintenance_215.py > ~/maint215_t1.out 2>&1 &`
- rr.py calls that run longer than ~60 s get moved to the background; use nohup + poll the .out file.
