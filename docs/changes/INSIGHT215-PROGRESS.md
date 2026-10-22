# INSIGHT215 - progress note (interrupted by a workstation reboot, 2026-10-23)

Branch `pilot/INSIGHT215-295`, from `origin/main` @ 90cd7d9ae. Slice 1 of the 2.15.0 bundle "insights and reports".

## Done (written, NOT yet run)

Nothing on this branch has been executed: no pytest, no import check, no PDF render. Every test status is NOT_RUN.

- `smplwise/services/insights_common.py` - switches (`insights.doors.enabled`, `insights.waste.enabled`, `reports.building.enabled`,
  all default OFF), the settings document `insights.settings` (every threshold, bounds, whole-document validation), permissions
  (`insights.read`, `insights.manage`, `reports.building`; switches also need `system.configure`), the per-entity Scope (ha_scope rule),
  the range parser (24h/7d/30d/custom <= 31 days), the state timeline over `ha_state_history`, interval helpers, local nightly windows.
- `smplwise/services/insights_doors.py` - door opening without a matching entry event: explicit door pairs (contact sensor, optional
  lock, up to 4 exit inputs, invert); evidence = lock transition, held unlocked, Arx unlock command (`ha_actions`), exit input, door
  window (`intercom_door_map` -> `door_window_occurrences`); verdicts explained / unexplained / unverifiable; door + time only.
- `smplwise/services/insights_waste.py` - empty room (presence decay), after hours (areas without a presence sensor), night
  consumption anomaly vs the median of the same weekday (energy.db quarter hours); protected switches excluded; unknown is never waste.
- `smplwise/services/building_report.py` - monthly report model (sections summary, tickets, energy, elevators, generator, temperature,
  doors, cameras, waste; omitted sections listed with a reason), HTML (he RTL / en LTR, bundled fonts), fallback plain lines.
- `smplwise/services/building_report_pdf.py` + `building_report_engine.py` - the isolated render child (WeasyPrint, fpdf2 fallback),
  same shape as the temperature report PDF.
- `smplwise/routers/insights.py` - GET/PUT `/insights/settings`, GET `/insights/doors`, GET `/insights/waste`,
  GET `/reports/building/preview`, GET `/reports/building.pdf`; uniform 404 while a switch is off; audited; registered in `main.py`.
- Permissions added to `roles.json` and `contracts/examples/role-catalog.design.json` (site_admin, system_admin) and labelled in
  `routers/access.py` PERMISSION_LABELS.
- Tests written: `tests/insight215_fixtures.py`, `tests/test_insight215_doors.py`, `tests/test_insight215_waste.py`.

## Half done / missing

- `tests/test_insight215_report.py` (report model, sections/omitted per permission with a custom role, tickets counts, real PDF
  render through the child + pymupdf parse checking Hebrew text and section titles, fpdf2 fallback) - NOT written.
- `docs/changes/CR-INSIGHT215.md` (the change record) - NOT written. Owner questions below are the draft for its last section.
- `docs/design/` HTML mockup - not started.
- `contracts/API_INVENTORY.md` not regenerated.
- No runner worktree was ever created; nothing of this agent is running.

## Next 5 steps, in order

1. On the runner: `cd ~/smplwisebms && git fetch -q origin && git worktree add -f ~/work/insight215 origin/pilot/INSIGHT215-295`, then
   from `~/work/insight215/smplwise_vms/backend`: `nice -n 10 ~/smplwisebms/.venv/bin/python -m pytest -q -o addopts= -p no:cacheprovider
   tests/test_insight215_doors.py tests/test_insight215_waste.py` and fix what fails (first run - expect import / schema slips).
2. Run the permission consistency tests touched by the new permissions: `tests/test_alarm.py tests/test_automations_scope.py
   tests/test_access_permissions_wxperm.py tests/test_schedules_scope.py`.
3. Write `tests/test_insight215_report.py` (see above) and run it, including the real render.
4. Write `docs/changes/CR-INSIGHT215.md` (data per insight with table/file refs, algorithms and settings, privacy, permissions, NOT built,
   owner questions) and an HTML mockup in `docs/design/`.
5. Regenerate `contracts/API_INVENTORY.md` on the runner (`python scripts/api_inventory.py`), commit, push, remove the runner worktree.

## Open owner questions (draft, with recommendation)

1. Who reads the insights by default: a) site_admin + system_admin only (built), b) operators too. Recommend a.
2. Door insight evidence: a) lock / exit input / Arx commands / door windows only (built; no person data), b) also read the door system's
   entry log (names) in slice 2 behind its own switch. Recommend a now, b later only with `access.events.read`.
3. Door pairs: a) set explicitly in Settings (built), b) suggested from map placement. Recommend a, with b as a suggestion list later.
4. Monthly report delivery: a) download only (built), b) also scheduled on the 1st + WhatsApp text like the temperature report. Recommend b in slice 2.
5. Report retention: keep generated PDFs 7 years like bills (idea 23) or generate on demand only (built). Recommend on demand now.
6. Generator section: alerts only (built) or also run counts / hours (needs a role mapping decision).
