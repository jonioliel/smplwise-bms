# INSIGHT215 - progress note (slice 1 backend complete, mockup v2 restyled, 2026-10-23)

Branch `pilot/INSIGHT215-295`, from `origin/main` @ 90cd7d9ae. Slice 1 of the 2.15.0 bundle "insights and reports". Change record: `docs/changes/CR-INSIGHT215.md`.

Migrations: NONE used by this slice (settings rows and existing tables only), so there is no provisional number for the lead to renumber.

## Done and verified on the runner (targeted files only)

- Services, routes, PDF child, permissions: see CR-INSIGHT215 sections 3-6.
- `tests/test_insight215_doors.py` + `tests/test_insight215_waste.py`: 35 passed.
- Permission consistency `tests/test_alarm.py tests/test_automations_scope.py tests/test_access_permissions_wxperm.py tests/test_schedules_scope.py`: 89 passed.
- `tests/test_insight215_report.py` (new): 14 passed, including the real PDF render through the child (default engine and fpdf2) parsed with pymupdf for Hebrew text.
- `contracts/API_INVENTORY.md` regenerated on the runner (1204 routes) and applied.
- No full suite was run.

## Mockup v2 (2026-10-23, restyle in the product's language; content = the owner-approved v1)

`docs/design/mockups/insight-215/index.html` (copy for review: `private/review/insight-215-mockup-v2.html`, gitignored). Owner directive 23.10:
every mockup follows the visual language of the existing infrastructure temperature screen, the elevators screen and the schedules /
automations screens. v2 keeps every screen, section, state and mock switch of v1 and redraws them with what those screens use:

- the shell as the real one draws it: the area rail (70 px, brand tile, the active area in accent-soft with the edge bar), the floating search
  pill at the top start corner, the area's level-1 row as the segmented pill (`sw-tabs` variant pill), the section's level-2 page row as the
  compact underline row (variant underline-compact), the crumbs line above the h1 (as tickets-handlers / tickets-overview draw it), h1 26 px /
  700 / -0.6 px, the subtitle in text-2; on the phone the rail becomes the bottom bar (7 areas, crowded) and the long area row becomes the
  dropdown chip beside the search, like the meters screen;
- the KPI row of the temperature screen (each a filter; dot with halo, 20 px tabular number, 12 px label), cards with r-lg and shadow-1,
  the pill buttons of temperature/styles.ts (`.btn`, `.btn.pri`), the soft status chips with a dot of the meters list ("מדווח" style), the
  filter pills and segmented controls of the schedules screen, tables with the 12.5 px text-3 header, `sw-state-panel` for empty / loading /
  error / forbidden / switched off (48 px icon tile, accent / danger / forbidden / offline soft fills), the skeleton token for loading;
- tokens copied one to one from `frontend/src/design/tokens.ts` (classic skin, light + dark), type scale only from the token tiers; charts
  and timelines keep LTR geometry; the floors / areas tree beside every list (a "כל האזורים" dropdown on the phone).

Checked in the built-in browser (own tab) and with Playwright at 1366x768, 1024x768 and 375x812, light and dark; `scrollWidth ==
innerWidth` at every width (no horizontal overflow). Screenshots: `private/review/insight-215-v2/` (gitignored): report-1366-light,
report-1024-light, report-375-light, report-1366-dark (+ report-375-dark, doors-1366-light, settings-1366-light, states-1024-dark). Compared
side by side with the real meters / schedules screens of the static build (the temperature and elevators screens need a backend and show
"forbidden" in the static demo; their look was taken from infra-temperature.ts / infra-elevators.ts and temperature/styles.ts).

### Placement (lead's proposal, owner delegated the decision; updated 23.10 after the owner's re-organisation of the service-management area)

The building report is a page of a new section **"סקירה ודוחות"** inside the service-management area (`#/tickets/...`), not a top-level
screen of its own. The section is a level-1 tab of the area (its first tab, where the manager overview was), and its level-2 page row - drawn
exactly like the electricity / generator page rows (`INFRA_ELECTRICITY_PAGES`) - holds:

1. `מסך סקירה` - the manager overview (MGRDASH, managers only; moves under the section),
2. `דוחות בניין` - this mockup (`#/tickets/reports/building`); the doors and waste screens are its drill-downs
   (`#/tickets/reports/doors`, `#/tickets/reports/waste`), with a crumb back to the report.

The section label lives in ONE place in the mockup - the `LABELS` constant at the top of the script (`section`, `pageOverview`,
`pageReport`, `area`) - so the final name is a one-line edit. The earlier five-page hub ("דוחות ובקרות": building reports, approvals and
inspections register, preventive maintenance, rounds and checks, QR/NFC tags) is superseded by this section; the other pages are drawn by
other agents in their own mockups and are not in this row any more.

Settings stay in הגדרות › "תובנות ודוחות" (the settings area's underline row, `system-nav`), as in v1.

### Navigation change needed (frontend/src/shell/nav.ts; no code change in this slice)

- `TICKETS_TABS`: a new entry `{ id: 'reports', label: SECTION_LABEL ('סקירה ודוחות'), href: TICKETS_REPORTS_HREF = '#/tickets/reports/overview' }`
  placed first (where `overview` is today); `overview` becomes the section's first page rather than an area tab.
- A level-2 page registry `TICKETS_REPORTS_PAGES: TabItem[] = [{ id: 'overview', label: 'מסך סקירה', href: '#/tickets/reports/overview' },
  { id: 'building', label: 'דוחות בניין', href: '#/tickets/reports/building' }]`, a `TAB_SECTIONS` entry `tabSection('tickets.reports', ..., 2)`
  so `ui.tabs` orders / hides the pages like `infra.electricity`, and a `ticketsPageTabs('tickets.reports', items, api)` twin of
  `infraPageTabs`. The screen draws the row itself (like `infra-electricity.ts`), and in the dropdown tab mode publishes it as the second
  chip (`shell/infra-pages.ts` pattern).
- `TAB_PERMISSIONS`: `'#/tickets/reports/overview': ['tickets.manage']` (the overview's gate, unchanged);
  `'#/tickets/reports/building': ['insights.reports.read']` (CR-INSIGHT215 section 6; default readers site_admin + system_admin, owner
  question 1); the doors / waste drill-downs keep their own permissions (`insights.doors.read`, `insights.waste.read`).
- Visibility rule: the section tab is offered only while the tickets module is on (`ticketsModuleOn()`, as the whole area) AND at least one
  of its pages is offered to the viewer: the overview by `tickets.manage`, the reports page by `insights.reports.read` AND the report switch
  (`insights.report.enabled`, applied like `applyDoorWindowsTab`: an `applyInsightsReports(settings)` flag read from the product settings and
  re-applied after a save in Settings). With no page offered the tab is absent (never an empty row), and the `sw-app` route answers a direct
  URL with the neutral "not available" panel (the "switched off" state of the mockup).
- Settings tab of הגדרות: `{ id: 'insights', label: 'תובנות ודוחות', href: '#/system/insights' }` in `AREA_TABS.system`, `TAB_PERMISSIONS`
  `['system.configure']`.

### Owner questions that block the UI (CR-INSIGHT215 section 8, recommendation first)

1. Default readers: a) site_admin + system_admin only (built), b) operators too. Recommend a.
2. Door evidence: a) lock / exit input / Arx commands / door windows only (built), b) also the door system's entry log, slice 2,
   own switch + `access.events.read` (mockup toggle "2b"). Recommend a now.
3. Door pairs: a) explicit in Settings (built, shown on the settings screen), b) suggested from map placement. Recommend a, b later.
4. Report delivery: a) download only (built), b) also scheduled on the 1st plus WhatsApp text (mockup toggle "4b"). Recommend b in slice 2.
5. Retention: a) generate on demand (built), b) keep PDFs 7 years like bills. Recommend a.
6. Generator section: a) alerts only (built), b) also run counts and hours (mockup toggle "6b"). Recommend a.

Plus approval of the restyled mockup and of the placement above (the section's final label).

## Remaining (slice 2+)

- Owner approval of the mockup v2 and the placement.
- UI (frontend) screens, the nav change above, i18n, Playwright specs.
- Scheduled monthly delivery / WhatsApp text (owner question 4), retention (5), generator run counts (6).
- Lead: answer the owner questions in CR-INSIGHT215 section 8; full gate at integration.

## Slice 2 (UI) - STOPPED part-way on the owner's restyle directive (2026-10-23)

The mockup is being restyled (temperature / elevators / schedules-automations look; screen moves to the new 'דוחות ובקרות' hub). Built so far, `tsc --noEmit` clean locally; NO frontend spec written or run, backend tests NOT_RUN (pytest does not run locally; not sent to the runner):

Backend (small, additive):
- `GET /insights/status` -> `{doors, waste, report}` = switch on AND permission held; no computation, no audit; 403 when none of insights.read/manage/reports.building anywhere. For navigation.
- `floor` (HA floor name) added to every door row and waste item (LEFT JOIN ha_floors), for the floors/areas tree.
- Two tests appended to `tests/test_insight215_doors.py` (status, floor). contracts/API_INVENTORY.md NOT regenerated (+1 route).

Frontend, all reusable under the new design (logic and data layers are look-independent):
- `src/api/insights.ts` typed client (settings, doors, waste, report preview, PDF download via saveBlob, `fieldErrors` for the 422, `isOff` for the uniform 404).
- `src/i18n/insights.ts` he + en strings, `ix(key, vars, lang)`.
- `src/insights/model.ts` pure logic: month math, durations, report figures, picker/omitted rules, door lines/counts, places tree (floor/area), waste filters, settings form <-> document with the server bounds and 422 field mapping.
- `src/insights/access.ts` permissions + status-driven visibility; `applyInfraInsights` and helpers in `shell/nav.ts` (tabs deliberately NOT registered in INFRA_TABS; TAB_PERMISSIONS/installation-only entries added).
- `src/insights/report-preview.ts` section renderers (restyle target), `src/insights/styles.ts` (mockup CSS on v2 tokens, restyle target), `src/insights/list-base.ts` shared range/tree/phase frame for list screens.
- `src/screens/infra-report.ts` report screen (month, language, section picker, preview, PDF, 'not included', states). NOT mounted in sw-app.

Not built: doors screen, waste screen, settings screen (three switches, door pairs, thresholds + 422), sw-app routing, Settings section registration, unit and Playwright specs, visual checks. Deviations decided: no places tree on the report (model has no place filter); door list shows only unexplained/unverifiable rows (backend returns explained as counts + evidence kinds only); protected switches stay in their existing Settings page (link only).

## Slice 2 (UI) - resumed and built against mockup v2 (2026-10-24)

Screens (all mounted; `tsc --noEmit` clean): building report `infra-report` (month, language, section picker, KPI row, preview, PDF, "not included", states), `insights-doors` (verdict KPI filters, floors/areas tree, range, row timeline, explained evidence), `insights-waste` (kind filters, tree, night-consumption bars), `insights-settings` (three switches, door pairs through a dialog, every threshold with the server bounds and the 422 field error, default report sections, link to the existing protected-switches page). States: loading, empty, error, switched off (uniform 404), forbidden, PDF failure with retry.
Look: crumbs + h1 + subtitle + `sw-tabs` underline-compact page row, temperature-style KPI tiles, pill buttons, `sw-place-tree`, `sw-toggle`, `sw-dialog`, v2 tokens only.
Placement: temporary - tab `סקירה ודוחות` of the tickets area (`#/tickets/reports/{building,doors,waste}`, `TICKETS_REPORTS_HREF`, TODO(SERVICEIA) in nav.ts); it disappears with the tickets module switch. Settings section `תובנות ודוחות` inside הגדרות › תשתיות (`#/system/infra/insights`). Nav change is confined to nav.ts (one tab + helpers), sw-app.ts (three imports, one route line, one refresh call) and system-infra.ts (one section).
Tab visibility comes from `GET /insights/status` (added in slice 2; no computation, no audit).

NOT built (needs slice-3 backend): scheduled delivery (more than monthly, dates/hours, recipients, WhatsApp text) and the roles that see the generator run counts/hours (no schedule store and no run-hours data exist). The settings card is in `insights-settings.ts` behind `DELIVERY_BACKEND = false`; the generator section is still alerts only, so owner answer 26 is open. Owner answer 21 (readers via permissions): the screens gate on the permissions (`insights.read`, `reports.building`, `insights.manage`), so any role granted them sees the pages; roles.json defaults unchanged.
Deviations from v2: no places tree on the report (no place filter in the model); the door list shows only unexplained/unverifiable openings (the server returns explained ones as counts + evidence kinds).

Tests: `tests/unit-insights.spec.ts` 10 passed locally; `tests/evidence-insights.spec.ts` 14 passed locally (desktop project, local chromium, vite dev server, mocked backend; includes 1366/375 px light/dark overflow checks and a screenshot test skipped without SW_SHOTS_DIR). Backend tests for the two slice-2 tests: see the final report. API_INVENTORY.md not regenerated (+1 route).

## Runner state

Worktree `~/work/pilot-INSIGHT215-295` belongs to run_remote.sh (reused); nothing of this agent is running. `~/ins215_*.log` are small logs.

## Slice 3 (2026-10-24, branch `pilot/INSIGHT215B-295`, from `pilot/INSIGHT215-295` @ b1d2d33b4)

Details: CR-INSIGHT215 "Slice 3". Provisional migration **0146_insight215_runs_delivery.sql** (generator_runs, insights_report_sends).

- Backend: `services/insights_generator.py` (run recorder, called from the generator tick; report), `services/insights_delivery.py` (setup / enable rules, planning, e-mail + WhatsApp text send, retry, janitor hooked into `main.janitor_tick`), `services/insights_access.py` (the report's section gate, shared by the routes and the delivery), settings `generator.min_run_s` and `report.generator_runs`, routes `GET/PUT /reports/building/delivery`, `wa_pacing.USE_CLASS` (`insights.reports` = reminder).
- Frontend: `DELIVERY_BACKEND` is gone - the delivery card in `insights-settings.ts` is real (day, time, language, channels, recipients with their reach, save, explicit enable switch locked until setup is complete and for anyone without `system.configure`); generator run table in the report preview; `min_run_s` and the "who sees the runs" select in the settings; two-column card flow on wide settings (still a little taller than a 768 px window - the thresholds card).
- `contracts/API_INVENTORY.md` regenerated on the runner (1207 routes: the slice-2 status route and the two delivery routes).
