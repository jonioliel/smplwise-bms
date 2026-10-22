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

## Mockup (2026-10-23, waiting for owner approval)

`docs/design/mockups/insight-215/index.html` - single self-contained file, RTL Hebrew, light + dark, desktop + phone widths,
fake data only. Screens: building report (month, language, section picker, in-page HTML preview, PDF download, "not
included" list with the reason no permission / module off / switch off), the PDF paper, doors, waste, settings (three
switches, door pairs, thresholds with a 422 field error, protected switches), states (empty, loading, error, switched off).
The top bar of the mockup toggles the switches, the tickets / elevators modules, a viewer without camera permission, the
data state, and the not-built variants of owner questions 2b, 4b and 6b. Checked in the built-in browser at 1366, 1024 and
375 px, light and dark; no horizontal overflow at 375 px.

### Owner questions that block the UI (CR-INSIGHT215 section 8, recommendation first)

1. Default readers: a) site_admin + system_admin only (built), b) operators too. Recommend a.
2. Door evidence: a) lock / exit input / Arx commands / door windows only (built), b) also the door system's entry log, slice 2,
   own switch + `access.events.read` (mockup toggle "2b"). Recommend a now.
3. Door pairs: a) explicit in Settings (built, shown on the settings screen), b) suggested from map placement. Recommend a, b later.
4. Report delivery: a) download only (built), b) also scheduled on the 1st plus WhatsApp text (mockup toggle "4b"). Recommend b in slice 2.
5. Retention: a) generate on demand (built), b) keep PDFs 7 years like bills. Recommend a.
6. Generator section: a) alerts only (built), b) also run counts and hours (mockup toggle "6b"). Recommend a.

Plus approval of the mockup itself (layout, section order, the "not included" list at the end of the report).

## Remaining (slice 2+)

- Owner approval of the mockup above.
- UI (frontend) screens, i18n, Playwright specs.
- Scheduled monthly delivery / WhatsApp text (owner question 4), retention (5), generator run counts (6).
- Lead: answer the owner questions in CR-INSIGHT215 section 8; full gate at integration.

## Runner state

Worktree `~/work/pilot-INSIGHT215-295` belongs to run_remote.sh (reused); nothing of this agent is running. `~/ins215_*.log` are small logs.
