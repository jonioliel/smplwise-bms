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

## Mockup reviewed in browser (2026-10-23)
Mockup reviewed in browser at 1366, 1024 and 375 px, light and dark, RTL Hebrew. Fixed: no horizontal scroll at 375 (grid
min-width), the floor/area tree kept on phones (a places select instead of hiding it), tree counts consistent with the rows,
low-contrast muted text and state colours darkened, dark primary button contrast, bidi fixes (step counter, file name), chips as
real buttons with a working filter and search, mobile cards built from the table rows, number checkpoint shows "out of range" and
the request action, supplier picker shows the expired-insurance confirmation (question 5a), revoke-tag action, focus rings,
reduced motion. Added the states the CR describes: empty, loading, error / not found, module off (every screen), plus a role
switch (manager / operator / viewer) so manage-only actions and the "no permission" panels are visible, and the tickets-off
switch (no request action anywhere). Screenshots (gitignored): `private/review/maint-215/` (desktop and phone, light and dark).
Not verified: the product's real design tokens (the mockup keeps its own local tokens, no product token file was found for it).

## Mockup v2 - restyled in the product language (2026-10-23, owner directive 23.10)
`docs/design/mockups/maintenance-215/index.html` redrawn (same content, screens, roles and states) in the visual language of the existing
temperature / elevators / schedules screens, with the product's REAL token table (`frontend/src/design/tokens.ts`, classic skin, light
and dark columns copied verbatim - the v1 review had not found it), the real shell (`shell/sw-app.ts`: area rail at the inline start,
no top bar and no breadcrumb - the search / status pill floats in the content corner; phone: bottom bar), the real tab rows
(`components/sw-tabs.ts`: level 1 pill track, level 2 compact underline), the temperature page head and KPI-filter row, the places
tree of `components/sw-place-tree.ts` (a select on phones), the electricity table, the solid state badge / soft chips, the pill
buttons and the `sw-state-panel` states.
Placement (lead 2026-10-23; the owner is reorganising the service-management area): a section **"תחזוקה ובקרה"** inside the
service-management area (#/tickets/...), visible only while the module is on and by `maintenance.view`; its level-2 row = the four
pages drawn: פנקס אישורים ובדיקות (certificates, inspections, supplier documents; the task sheet and the supplier card open from it),
תחזוקה מונעת, סבבים ובדיקות (with the one-checkpoint-per-screen run), תגי QR/NFC (manage only). The section label is written ONCE
(`SECTION_LABEL` in the script) so the final name is a one-line change.
Verified in the built-in browser (own tab) at 1366x768, 1024 and 375x812, light and dark, RTL: no horizontal scroll at any width, the
tree becomes a select and the table becomes cards on the phone, the supplier / request columns leave at <= 1100 px (the electricity
screens' rule), all CR states (ready / empty / loading / error / module off / forbidden), the three roles, tickets off (no request
action anywhere), bidi (step counter, dates, paths), focus rings, reduced motion. Side-by-side with the live temperature screen:
NOT_RUN (no dev backend was running); compared instead with the evidence capture `docs/evidence/temperature/temprep-samples-desktop.png`
(rail, pill row, page head, KPI cards, badges and buttons match). Screenshots (gitignored): `private/review/maint-215-v2/`
(16 files: desktop / tablet / phone, light / dark, states, dialogs); the html copy: `private/review/maint-215-mockup-v2.html`.
No code changes.

## Remaining
- Slice 2 (UI) proposal: CR section 12, after the owner approves the mockup. Full gate not run (by design).
- Steps 1-4 below are DONE (see Session 2).

## Next 5 steps
1. On the runner run: `tests/test_notify_core.py tests/test_access_permissions_wxperm.py tests/test_alarm.py tests/test_infra_elevators_280.py tests/test_tickets_monitor.py tests/test_migrations.py tests/test_needs_review.py` (at most 3 pytest processes; split).
2. Grep tests for `janitor_tick` / settings DEFAULTS pins and run those files.
3. Regenerate the API inventory on the runner (`python scripts/api_inventory.py` from the worktree, venv python), commit.
4. Fix the mockup path in CR-MAINT215.md section 8; view the mockup in a browser (light/dark, phone width).
5. Final report to the lead; slice 2 proposal is CR section 12.

## Open owner questions
These eight block the UI (CR-MAINT215.md section 11); recommendation first:
1. Reminder lead times (30 / 7 / 0 days, editable per task): a. as built (recommended); b. 60 days for certificates; c. one installation-wide value.
2. `maintenance.manage` permission: a. ordinary, site_admin + system_admin (recommended: no money, no person data); b. sensitive, system_admin only.
3. Placeless task visibility: a. installation-level holders only, as built (recommended); b. any scope, like tickets.
4. QR sticker address: a. the remote address, sign-in required (recommended); b. local address only; c. ask per print.
5. Request assigned to a supplier with expired insurance (slice 2): a. red mark + manager confirmation (recommended; shown in the mockup); b. mark only; c. refuse.
6. Maintenance tables in project backups: a. yes, in slice 2 with restore tests (recommended); b. no.
7. Closing the request opened by a plan: a. marks the plan done automatically, closer as performer (recommended); b. stays manual.
8. Notification category of the two sources: a. keep `device_faults` (recommended); b. a new "maintenance" category.

## For the next session
- Runner worktree used: `~/work/maint215` (removed at handoff). Recreate:
  `cd ~/smplwisebms && git fetch -q origin && git worktree add -f ~/work/maint215 origin/pilot/MAINT215-295`
- Test command that worked (from `~/work/maint215/smplwise_vms/backend`, in background with nohup):
  `nice -n 10 ~/smplwisebms/.venv/bin/python -m pytest -q -o addopts= -p no:cacheprovider tests/test_maintenance_215.py > ~/maint215_t1.out 2>&1 &`
- rr.py calls that run longer than ~60 s get moved to the background; use nohup + poll the .out file.
