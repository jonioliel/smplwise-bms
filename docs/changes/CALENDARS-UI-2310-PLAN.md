# CALENDARS-UI-2310 - the calendars UI: implementation plan

> For agentic workers: executed with superpowers:subagent-driven-development (three parallel slices after the foundation) and
> superpowers:test-driven-development. Steps use checkbox syntax.

**Goal:** the front end of the calendars module that shipped server-side in v2.28.0 (module OFF by default), built to the full scope of the
approved round-8 mock-up, with every owner answer of 2026-10-30 night (questions 8-26) and the placement question as a setting.

**Architecture:** one page element `<calendars-page>` (src/calendars/cal-page.ts) answers at `#/calendars/<view>[/<id>]` (the side rail entry)
and `#/devices/calendars/<view>[/<id>]` (a tab of the home area between מבט על and קברניט). Where it is offered is the setting
`menu_position` (rail default / home_tab / both); a viewer without the home area always gets the rail entry (answer 25). Each view is its own
element fed one `CalCtx` object (src/calendars/ctx.ts). All wire calls go through `src/api/calendars.ts`; without a backend the same calls are
answered by `src/calendars/demo.ts` (invented data; hash parameters `data=worst|empty|error|slow`, `role=`, `mode=`).

**Tech stack:** Lit 3, TypeScript, Vite; FastAPI + SQLite backend; Playwright (desktop 1440x900, tablet 1024x768, mobile 390x844).

**Spec:** `docs/changes/CALENDARS-CONTRACT-298.md` (sections 7, 8, 11, 13, 16), the mock-up
`private/design-system-2026-10-27/round8/calendars/mockup.html` (+ `index.html`, `app.js`, `shots/final/*`), the owner answers
`private/planning/OWNER_ANSWERS_2026-10-30_NIGHT_HE.md` and the 29.10 answers (contract section 1A).

## Global constraints

- Hebrew RTL; no "Home Assistant" words outside the technical settings (docs/design/UI_COPY_RULES.md).
- No page scroll in the control screens (owner rule 2026-10-24): fit 1440x900, 1024x768, 390x844 - views page instead.
- CSS reads the design tokens for type, radius and colour (tests/unit-token-lint.spec.ts; src/calendars/ is inside its scope); the eight
  calendar hues are declared once in src/calendars/styles.ts; green is status only.
- Module OFF by default; the navigation entries appear only while GET /calendar/module says enabled + calendar.view.
- The static demo keeps the navigation entry OFF (no shift of other screens' pixel baselines); the screens answer from the demo data.
- Every behaviour is a setting (owner rule). Settings added in this branch (server `calendar.settings`, validated, defaults = owner answers):
  `menu_position` rail|home_tab|both, `contested_order` first_come|manual|by_kind (11B), `allow_displace` (12A) + `displace_approver`
  calendar_manager|any_manager (12), `override_scope` both|stricter|none (9A), `phone_time_picker` grid|timeline (16A), `reauth_mode`
  reauth_and_continue|reauth_only (21B), `sync_conflict_display` side_by_side|list_only (22A), `tablet_panels` collapse|shrink (23A),
  `resident_pending_display` count|free|blocked (13A), `resident_cancel_until` start|1h|24h (14A), `resident_rooms` bookable|all_busy (15A),
  `purge_confirm` type_word|one_click (24A), `loading_style` skeleton|spinner (26A), `default_approval_timeout_h`, `reopen_days`.
- No migration (the settings live in the existing `calendar.settings` document).

## Slices

### Slice 0 - server settings and the foundation (lead)
- [x] tests first: `test_calendar_engine_2300.py` (defaults, validation, legacy menu values, queue order, displace switch + approver,
      override scope, cancel window, default timeout), `test_calendar_sync_2300.py` (resume from needs_reauth per `reauth_mode`, flags list,
      occurrence marks)
- [x] model.py settings + `check_override`; decisions.py `_rank_queue`, `calendar_manager`, `allow_displace`; events.py `_cancel_window`;
      calendar_sync.py `GET /calendar/sync/flags`, resume rule; occurrences carry `contested` and `sync_flag`
- [x] api/calendars.ts, calendars/demo.ts, access.ts, ctx.ts, model.ts, styles.ts, cal-page.ts; nav.ts / router.ts / sw-app.ts /
      system-index.ts wiring; stubs for every view

### Slice A - calendar views (fork A): `view-calendar.ts`, `view-rooms.ts`, `event-drawer.ts`
- month / week / day with the calendar switcher (grouped by type, colour checkboxes, lock for view-only), today marker, now line,
  kind marks, sync-conflict side-by-side red frame (setting `sync_conflict_display`), phone month with dots + day list
- rooms timeline (time axis LTR inside the RTL page, 6-hour window on the phone, closed hours hatch, now line, legend, "מצא חדר פנוי",
  capacity / equipment filters, page of rooms that fit)
- new / edit drawer in the three permission variants (operator: own only; site_admin: on behalf + guest details + retention notice;
  calendar manager: no approval), recurrence summary, availability bar, preview (conflicts / needs approval), submit, errors 409/422

### Slice B - management views (fork B): `view-approvals.ts`, `view-maint.ts`, `maint-drawer.ts`, `view-manage.ts` (+ members)
- approvals inbox: pending / recently decided, contested window detail with the competing requesters and their queue order
  (setting `contested_order`: the suggested request first), approve + displace (setting `allow_displace`), reject with note, series
  approval with rejected occurrences, side panel collapses on tablet (setting `tablet_panels`)
- maintenance: list of windows + the drawer in the four overlap modes (preview first, then place; `ask` asks)
- calendars management list (type segments, manager, approval, pending, sync chip, my role, paging) and a calendar's members and roles

### Slice C - settings, sync and the resident phone flow (fork C)
- `screens/system-calendars.ts`: tabs חפיפת תחזוקה · התנהגות · אישור לכל יומן · הרשאות · פרטי אורחים - every setting above, defaults
  shown under each row, the module switch, retention with erase preview, purge with typed word (setting `purge_confirm`)
- `screens/system-calendar-sync.ts`: providers in order iCal, Google, Microsoft; needs-reauth card with "continue" per `reauth_mode`;
  flagged entries list (keep / cancel); rules rows
- `calendars/resident.ts`: phone flow - day strip, room cards (setting `resident_rooms`), start grid + duration or timeline
  (setting `phone_time_picker`), pending counts (setting `resident_pending_display`), confirm sheet, my bookings, cancel (setting
  `resident_cancel_until`), displaced sheet with alternatives, done

Status 2026-10-31: slices A, B and C are committed on `pilot/CALENDARS-UI-2310` (demo mode verified locally on a vite dev server:
unit + evidence specs at desktop / tablet / phone). Not yet done: slice D's visual-matrix entries and pixel baselines on the runner, the
owner's review page of the phone / tablet screenshots (answer 23 note), the provider OAuth flow (phase 5, not reachable from the screen).

### Slice D - verification (lead)
- unit spec of model.ts, evidence + layout-guard specs per screen (desktop / tablet / phone, light / dark, RTL, scrollTop 0, worst data),
  token lint, visual-matrix entries + baselines on the runner, screenshots page for the owner.
