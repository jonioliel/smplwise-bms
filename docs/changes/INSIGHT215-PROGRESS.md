# INSIGHT215 - progress note (slice 1 backend complete, 2026-10-23)

Branch `pilot/INSIGHT215-295`, from `origin/main` @ 90cd7d9ae. Slice 1 of the 2.15.0 bundle "insights and reports". Change record: `docs/changes/CR-INSIGHT215.md`.

Migrations: NONE used by this slice (settings rows and existing tables only), so there is no provisional number for the lead to renumber.

## Done and verified on the runner (targeted files only)

- Services, routes, PDF child, permissions: see CR-INSIGHT215 sections 3-6.
- `tests/test_insight215_doors.py` + `tests/test_insight215_waste.py`: 35 passed.
- Permission consistency `tests/test_alarm.py tests/test_automations_scope.py tests/test_access_permissions_wxperm.py tests/test_schedules_scope.py`: 89 passed.
- `tests/test_insight215_report.py` (new): 14 passed, including the real PDF render through the child (default engine and fpdf2) parsed with pymupdf for Hebrew text.
- `contracts/API_INVENTORY.md` regenerated on the runner (1204 routes) and applied.
- No full suite was run.

## Remaining (slice 2+)

- `docs/design/` HTML mockup of the insight screens and the report picker.
- UI (frontend) screens, i18n, Playwright specs.
- Scheduled monthly delivery / WhatsApp text (owner question 4), retention (5), generator run counts (6).
- Lead: answer the owner questions in CR-INSIGHT215 section 8; full gate at integration.

## Runner state

Worktree `~/work/pilot-INSIGHT215-295` belongs to run_remote.sh (reused); nothing of this agent is running. `~/ins215_*.log` are small logs.
