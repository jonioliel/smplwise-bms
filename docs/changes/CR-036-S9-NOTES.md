# CR-036 slice S9 - the native door schedules screen (read only): notes for the slices built on top

Branch `pilot/WISKEY-native-s9-schedules` (from `integ/248` @ `5ab763a5`). Read with `docs/changes/CR-036-S3-S4-INTERFACE-NOTES.md`
(section 4, the typed reads) and the owner answers of 2026-10-11 / 2026-10-12. Nothing here contacted a WisKey, Home Assistant, station or
device: the Playwright specs mock the typed endpoints (`frontend/tests/access-control-mocks.ts`), the backend tests use the fake WisKey
(`backend/tests/fake_wiskey.py`). Live behaviour is NOT_RUN until slice S14. Planned for a release AFTER 2.4.8.

No migration. No new route. No write path.

## 1. What was built

The screen `לוחות זמנים` (`<wiskey-schedules>`, `#/wiskey/schedules`), stage 1, view only (CR-036 3.4, design section 3.4).

- **Where it shows.** Only when the administrator setting `access.ui.schedules` is `smplwise` (Settings -> "מתגי מסכי כניסה", the
  per-screen list gained a row). The default is `wiskey`: the embedded panel has NO top-level schedules tab (its schedule editors live in its
  management tools), so with the switch off the WisKey area's tab row is byte-for-byte what it was and nothing changes for anyone. Switched on,
  the tab "לוחות זמנים" appears after "תחנות ודלתות" (static list and embed-catalog list alike; `shell/nav.ts` `NATIVE_ONLY_WISKEY_TABS`,
  `WISKEY_TAB_ORDER`). `?classic=1` still shows the embedded panel for a visit. No header switch (owner answer 1).
- **Per door** (relays of the stations the server sent WITH their technical part, i.e. `access.stations.read` on that station): the door's
  hold-open program as a week grid (`sw-week-grid`, read only, Sunday first, hours left to right), its state (פעיל / מושהה / בהסרה / שגיאה /
  טיוטה שמורה / לא ידוע), the execution word of its last command ("מוחזק פתוח · התחנה אישרה קבלה" - never "open"), the weekly lines, the
  specific dates, when it was last checked in the station's zone, and the public-code pill "קוד ציבורי: מוגדר / לא מוגדר / לא ידוע"
  (presence only, never a value). A door with no program but an older saved draft shows the draft as a draft, never as active.
- **Table view** across every door (desktop and tablet; no table below 820 px): door, station, program, kind, when, state, public code. A row
  opens that door.
- **The library and the proposals** (installation-wide in the integration; only for `access.stations.read` at installation scope - a
  station-scoped caller is never asked, because the server would refuse with an audited 403): library schedules (name, version, hours,
  holidays, "proposed for <stations>") and deployment proposals (name and station, the latest check job's state else how the proposal relates
  to its library schedule, "prepared from an older version", and always "לא הוחל על התחנה": the reference copy never applies them -
  `can_apply` false, `writes_enabled` false).
- **Admin**: "עריכה בחלון האינטרקום" (`system.configure` at installation) opens the embedded panel's tools (`#/wiskey/tools`) until the
  write phase edits in Arx.
- **Doors on a phone**: a door chip (44 px) opens a bottom sheet with the same door list; the door view only.
- **States**: loading, empty (no doors / no program / empty library / no proposals), error with retry, busy (rate limited, calm), unsupported
  (the per-door panel; the library / proposal blocks and the code pill are ABSENT when the installed version does not list them), forbidden
  (plain "המסך הזה אינו זמין לך", no tab), stale (a last-known copy, with when it was read), the stations feed states (not configured,
  connecting, unavailable, not installed).
- **Refresh**: every 60 s while the page is visible (CR-036 3.4: the change notice may not cover these stores, W6), on becoming visible, and on
  the refresh button. Per-station reads are not repeated within 30 s; the server caches them anyway.
- **RTL**: times, dates and their ranges are left-to-right isolates (U+2066 / U+2069) inside the Hebrew lines; without them "07:00–09:00"
  displays as "09:00–07:00" (the S6 drawer's `weeklyLines` has the same problem - not touched here, see 5).

## 2. Permissions (what the screen offers; the server decides every read)

| Piece | Offered when | Server gate |
|---|---|---|
| the tab (while native) | `access.stations.read` at ANY scope (`NATIVE_WISKEY_TABS['#/wiskey/schedules']`) | - |
| the doors | the station arrived with `technical` | `GET stations` (access.read, filtered) |
| programs, code presence of a station | the door is listed | `access.stations.read` on the station (404 off scope) |
| library, proposals, checks | `access.stations.read` at installation scope | `access.stations.read` unrestricted (audited 403 `station_scoped` otherwise) |
| "edit in the intercom window" | `system.configure` at installation scope | - (a link to the embedded panel) |

`access.schedules.manage` stays catalogue-only (no write here).

## 3. Settings

| Key | Values | Default | Effect |
|---|---|---|---|
| `access.ui.schedules` | `wiskey` / `smplwise` | `wiskey` | the native screen and its tab (no tab while `wiskey`) |

`routers/settings.py` DEFAULTS + `SettingsPatch` (pattern `^(wiskey|smplwise)$`); audited like every product setting; any user reads it,
`system.configure` changes it. Frontend type in `api/media.ts` `ProductSettings`.

## 4. Typed endpoints used (all existing, S4)

`GET /access-control/stations`, `/features`, `/stations/{id}/programs`, `/stations/{id}/codes`, `/schedules`, `/schedules/plans`,
`/schedules/operations`. Not used: `/stations/{id}/doors/{door}/hold` (the programs read already carries each door's program and the saved
drafts; the hold draft read adds a write blocker the view does not need).

**Adapter change (projection only):** `project_schedule_plans` keeps `draft_id` (an id, `_id`) and `draft_revision` (`_int`) - the library
schedule a proposal was prepared from, which WisKey's plan `public()` sends (docs/integrations/wiskey/WISKEY_SOURCE_EXTRACTION.md, deployment proposals; the rc.37 fixture
`schedules_plan_list.json` carries it). It lets the screen say which
stations a library schedule was proposed for, and whether a proposal is older than its library schedule. Nothing personal: the report's
device-user counts stay dropped (test).

**Gap worked around:** the shapes are W? until WisKey's W2 - the screen maps what the typed model knows and says "לא ידוע" for anything it
cannot read (an unreadable window is not drawn and the door says its hours are unknown). The library schedules carry no deployment state of
their own; the screen does not invent one (no "פעיל" pill on a library row).

## 5. Gaps and hand-offs

1. **Write phase (S11 / S15-S16):** the block headers get an "עריכה" button in place of "עריכה בחלון האינטרקום"; gate it on
   `access.schedules.manage` / `access.stations.manage`.
2. **S6 deep link:** the stations drawer has no "לוחות זמנים" link yet; the target exists now: `#/wiskey/schedules?door=<station>:<relay>`
   (offer it only while `access.ui.schedules` is `smplwise` and the station has `technical`).
3. **S6 `weeklyLines`** (stations drawer) shows time ranges reversed in RTL; the fix is the same isolate (`ltr()` in
   `access-control/schedules-logic.ts`).
4. **S12:** the switch row joins the Settings access-control "תצוגה" segment with the other screens.
5. **Places:** no floor / area tree over the doors (no station placement read before CR-033); the door list groups by station.
6. **Holidays / dates** are listed, not drawn on the week grid (a weekly grid has no dates); the operations journal and claims are not shown.
7. **English** covers the main texts only; Hebrew is complete.

## 6. Tests

| What | File | Result (workstation, 2026-10-12) |
|---|---|---|
| Settings switch: default, validation, audit, gate | `backend/tests/test_ui_settings.py` (+1 test) | with the adapter schedules test: 16 passed |
| Wire shapes of the five reads, schedule enums, the plan projection's library link | `backend/tests/test_access_control_wire.py` (+5 parametrized, +2) | 23 passed |
| Logic (doors, week grid, lines, dates, states, code presence, library, proposals, table, stamps, access) | `frontend/tests/unit-access-schedules-logic.spec.ts` | 19 passed |
| Navigation (off by default, tab place, catalog, gate, demo) | `frontend/tests/unit-wiskey-schedules-nav.spec.ts` (+ `unit-wiskey-stations-nav` updated) | 6 + 7 passed |
| Behaviour, states, personas, phone sheet, skins x light / dark (evidence in `docs/design/evidence/CR-036-S9/`) | `frontend/tests/evidence-access-schedules.spec.ts` | 25 passed (desktop / tablet / mobile, dev server) |
| Layout guard, 5 skins x light / dark x 10 widths | `frontend/tests/layout-access-schedules.spec.ts` | 10 passed, 76 checks each, 0 findings |
| Linux pixel baselines | `frontend/tests/pixel-access-schedules.spec.ts` | flows 16 passed; baselines NOT generated (runner job) |
