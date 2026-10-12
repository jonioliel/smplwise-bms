# CR-036 slices S8 + S10 - the entry log completion and the Settings status pages

Branch `pilot/WISKEY-native-s8-events` (from `pilot/WISKEY-native-s3-s4`). Nothing here contacted a WisKey, Home Assistant, a
station or a device: every test runs against the mocked backend of `frontend/tests/access-control-mocks.ts`, the in-process fake
WisKey of `backend/tests/fake_wiskey.py`, or the committed live fixture `frontend/tests/fixtures/wiskey_fake_ha.py` (a fake
Home Assistant answering like WisKey). Live behaviour against a real WisKey is NOT_RUN until slice S14.

Read with `docs/changes/CR-036-WISKEY-NATIVE-SCREENS.md`, `docs/changes/CR-036-S3-S4-INTERFACE-NOTES.md` and the owner answers of
2026-10-12 (event picture needs no extra permission; an unpictured view-log row is an administrator setting, default on; an
operator sees synced / pending / error without the error text, site managers see the errors; the screen switch lives only in
Settings).

Two commits on one branch: S8 (the entry log), then S10 (Settings: the access-control status page and the groups view).

## S8 - the entry log ("פעילות", `#/wiskey/events`)

### What it is

The native screen `wiskey-events` is rebuilt on the typed reads of S4. It never names an integration command and never filters for
permission: the server omits the rows and fields a caller may not see, the screen shapes itself from what it was sent.

| Piece | Where |
|---|---|
| Typed client | `src/api/access-events.ts` |
| Pure logic (filters to wire filters, zone-aware days, DST refusal, grouping, row wording, failures) | `src/access-control/events-logic.ts` |
| The paged, single-flight loader (notices, cursors, stale rows) | `src/access-control/events-feed.ts` |
| Print document and hidden-frame printer, local glyphs | `src/access-control/events-print.ts`, `glyphs.ts` |
| Strings (Hebrew, a partial English set) | `src/i18n/access-events.ts` (its own module, like `announce.ts`, so `he.ts` is not touched) |
| Screen, drawer, export dialog | `src/screens/wiskey-events.ts`, `wiskey-event-drawer.ts`, `wiskey-events-export.ts` |
| Tab gate | `src/shell/nav.ts` (`NATIVE_WISKEY_TABS`) |
| Quiet state panels | `src/components/sw-state-panel.ts` (`quiet`) |

### Endpoints used (all `GET /api/v1/access-control/...`)

`events` (page, filters, opaque cursor), `events/{id}` (the evidence of how identity and time were established), `events/{id}/portrait?station_id=&at=`
(the picture, audited server-side), `events/export.csv`, `stations` (names and clock zones), `features` (what the installed integration
offers). The legacy `GET /intercom/...` reads are not used by the native screen.

### Behaviour that is decided here

- **Cursors.** `next` is opaque (an Arx `c.` token for a restricted caller, the integration's own id otherwise) and goes back as
  `before` exactly as served. A 422 `intercom_cursor_expired` keeps the rows shown and offers "reload from the start".
- **Refresh.** The integration only says "something changed". With one page shown the list re-reads page 1; with more pages the
  reader keeps their place and is offered a refresh (decided when the load runs, not when the notice arrives). While the notice socket is
  down the list re-reads every 30 s. A failed or not-ready reload keeps the rows and marks them stale with the time they were read.
- **Periods are days of the filter zone** (the selected station's clock zone, else the installation default), never of the browser.
  A wall time a DST change repeats or skips is refused in the custom-period dialog and nothing is sent; no silent coercion.
- **The picture.** Fetched lazily, once per opened row, only when the row said `portrait: true`; a row with `portrait: false` asks for
  nothing; `portrait: null` (the caller may not open pictures) shows no section at all (absent, never greyed). "Gone" and "failed" are two
  calm states; "try again" is one more audited view asked for by the person. The object URL is released when the drawer closes.
  No extra permission: whoever may open the entry log sees the picture (owner answer 4); the view-log row is written by the endpoint.
- **Export.** CSV through `events/export.csv`, shown only to holders of `access.events.export` when the integration offers it. A caller
  who does not see every station must name one: the server says `intercom_export_station_required` and the dialog asks. The dialog ends in
  one of three honest states (downloaded with the server's row count, refused in plain words, or asks for a station); file name from the
  local date.
- **Print** is the browser's print of the loaded rows, built into a document of its own in a hidden frame (only what is on the screen,
  every value escaped); it needs no permission beyond the list itself.
- **States.** loading skeleton, empty (one line, with the way back when a filter is on), error with retry, busy (rate limited, said
  calmly), not installed (an administrator is pointed to Settings, an operator is not), not connected, unsupported version, forbidden
  (plain "המסך הזה אינו זמין לך" and no tab), stale. Operator screens carry no hint paragraphs and no platform names.
- **The tab is gated on the NEW permission.** While a WisKey screen is the native one (`access.ui.<screen>` = smplwise) its tab needs the
  permission of its typed read, at any scope (the server decides per station): `NATIVE_WISKEY_TABS['#/wiskey/events']` =
  `access.events.read`. The embedded panel keeps `access.read` at installation scope. A viewer is therefore not offered a tab that would
  only say "not available", and a typed address shows the plain no-permission panel.
- **Deep link.** `#/wiskey/events?station=<id>&result=denied&authentication=pin&door=1&range=today&person=<text>` is applied from the
  first request (`filtersFromHash`); unknown keys and values are ignored. The stations screen (S6) can link to "the activity of this
  station" with it.
- **Phone.** The search and the three actions (export, print, refresh) are one row of 44 px icons below the title; the table view is
  not offered; the chips are one scrolling row.

### Settings that already exist and are honoured

`access.event_portrait_sensitive` (false), `access.event_portrait_audit` (true), `access.employee_no_sensitive` (false) and
`access.sync_errors_everyone` (false) are enforced by the S4 endpoints; the screen reads only the outcome (a field absent, a `portrait`
of `null`). No toggle for them is built in this slice (they are in the registry of `routers/settings.py`).

### Tests (S8)

| What | File |
|---|---|
| Node unit: logic (zones, DST, grouping, wire filters, hash filters, print escaping), the loader, the tab gate | `unit-access-events-logic.spec.ts`, `unit-access-events-feed.spec.ts`, `unit-wiskey-native-tabs.spec.ts` |
| Mocked-backend evidence at desktop / tablet / phone: behaviour, every state, five skins x light / dark (the skins the checkout has) | `evidence-access-events.spec.ts` (+ `docs/design/evidence/CR-036-S8/*.png`) |
| Layout guard (overflow, clipping, 44 px targets, light + dark) across widths | `layout-access-events.spec.ts` |
| Linux pixel baselines, new states only | `pixel-access-events.spec.ts` |
| The mock replies equal the real endpoints' shapes (the mock cannot drift) | `backend/tests/test_access_control_wire.py` against `fixtures/access_control_wire.json` |
| Live: no integration (plain backend) and the fixture WisKey | `evidence-wiskey-events.spec.ts` (ported to the new markup) |

The mock and the wire test share one fixture file on purpose: the frontend specs exercise exactly the key set and value types the
server produces (`shape` / `merge2` / `mismatches` in the test), so a field the server drops or renames fails the backend test instead of
silently passing against an invented mock.

### The live fixture needed two repairs (not slice logic)

`frontend/tests/fixtures/wiskey_fake_ha.py` was left behind by S4: (1) its `/limits` and `/reset` controls read `SCAN_PAGE` /
`MAX_SCAN_PAGES` from `intercom_sync`, where they no longer live (they moved to `intercom_adapter`), so `/reset` crashed; (2) its
overview did not list `api.commands`, so the S4 feature flags answered `commands_unknown` and every typed read said "unsupported". Both
are fixed minimally (`ADAPTER_LIMITS`, `FIXTURE_COMMANDS`). The fixture lists only `events/list`, `users/get` and `users/query`: the
drawer therefore shows the row alone and there is no picture and no export button live. Those paths are covered by the mocked specs
and by the backend tests against `fake_wiskey.py`.

### Known gaps (S8)

- No KPI tiles (the mock-up's totals): the integration sends no totals, and counting would mean scanning (load, rate limits).
- No place tree in the filter: the base has no station placement; the shared `sw-place-tree` belongs to S6.
- The mock-up's person chip is a search box (a debounced `person` filter: name or employee number).
- The drawer's footer deep links (to the person and to the station) are not built: their targets are S6 / S7.
- English strings cover the screen's main texts only; Hebrew is complete.
- Crystal: the base of this branch has four skins (classic, domus, tesla, bubble); the specs read `SKIN_IDS`, so Crystal is covered
  automatically once the branch is merged with a main that has it. NOT_RUN for Crystal here.
- The live fixture does not offer detail / picture / export (above).

## S10 - Settings: the access-control page ("בקרת כניסה", `#/system/access-control`)

### What it is

A new Settings tab, **בקרת כניסה**, between "חיבורים" and "קטלוג התקנים", with four segments. It is the technical truth of the
integration for administrators (a Settings page may name the integration and the command that feeds a card; an operator screen never
does). `shell/nav.ts`: `ACCESS_CONTROL_SETTINGS_HREF`, the tab entry, `TAB_PERMISSIONS` = `access.admin.read` at ANY scope (a
station-scoped administrator sees the status of their stations; the server narrows every read). `shell/sw-app.ts`: the import and one
route case. `system-diagnostics.ts` (the "בקרות כניסה" sub-tab of "כללי" with the per-screen switch and the diagnostics) is untouched.

| Segment | Route | Who | Reads |
|---|---|---|---|
| מצב מערכת | `#/system/access-control` | `access.admin.read` (any scope) | `status/stations`, `status/sync`, `status/alerts`, `status/conflicts` (installation-wide administrators only), per station `stations/{id}/health`, `.../health/history` |
| יומן האינטרקום | `.../audit` | installation-wide `access.admin.read` | `status/audit` (paged over `before` = `next_cursor`; filters: station, action) |
| קבוצות ושדות | `.../groups` | `access.people.read` or installation-wide admin | `groups`, `groups/versions` (installation-wide admin only, paged over `offset`) |
| מדיניות | `.../policy` | `system.configure` (installation) | `GET` / `PATCH /settings` (the four administrator settings) |

A typed address of a segment the caller may not have opens the status. A caller without `access.admin.read` gets the plain panel
"המסך הזה אינו זמין לך" and nothing is asked of the server.

| Piece | Where |
|---|---|
| Typed client (no write, no device poll) | `src/api/access-status.ts` |
| Pure logic: dots, sync words, ages / whens in the station's zone, tiles, sync rows, alert tones and paging, action-log targets, group rules, field flags, health tones, the seven-day strip, panel kinds, the four settings | `src/access-control/status-logic.ts` |
| The page's sentences (a code with no word stays the code) | `src/access-control/status-text.ts`, `src/i18n/access-status.ts` |
| The loader every card is built on | `src/access-control/status-feed.ts` |
| Shared look, state panel, skeletons | `src/access-control/status-css.ts`, `status-panel.ts` |
| Page, segments, station card | `src/screens/system-access-control.ts`, `system-access-status.ts`, `system-access-audit.ts`, `system-access-groups.ts`, `system-access-policy.ts`, `system-access-health.ts` |

### Behaviour that is decided here

- **Cards read on their own.** A failed or not-ready reload keeps the last good payload and marks it "not current" with when it was
  read; a payload the server served from its cache (`fresh: false`) is marked the same way. A 403 drops the payload and the card is
  ABSENT (never greyed): the conflicts, the log and the policy history are installation-wide in the integration, so a station-scoped
  administrator is never asked for them (the server would audit a refusal); if a restricted installation-wide administrator is refused
  anyway, the card disappears.
- **Counts only.** The sync read carries no person; the tiles and the table sum nothing from people. A read that is not there is "not
  known" (a dash), never zero; the conflicts tile exists only when the caller may see conflicts.
- **Reads repeat every minute while the page is visible** and whenever the page's refresh is pressed; the server caches them for 30-60 s,
  so asking more often would only repeat the answer. Nothing asks a device: the integration's `health/refresh` (a device poll),
  `fleet/alerts_action` (acknowledge / mute), `conflicts/resolve` and `audit/export` are not offered in this stage.
- **A station card** (a modal drawer; a bottom sheet on a phone) is mounted only while it is open, so closing it aborts what is in
  flight. Its seven days are one cell per LOCAL day of the station zone: how much of the day it was online, the mean poll time, one
  tone (ok / a gap or a sync problem / online less than half the day).
- **The action log** shows what was done in the intercom's own window; the actions Arx started are in Arx's own audit (the subtitle
  says so). A record carries the NAMES of the fields it changed, never their values. A code the page has no word for (an action, a
  field, an error) is shown as the code in a technical style.
- **Alerts**: a kind filter, the muted ones on request (why and until when), `complete: false` says the integration held more than it
  sent; paged over `next_offset`.
- **Groups**: each group's station rule as station names ("all stations" only when the group covers every station the page knows - never
  guessed from an empty station list); a group with no rule is "not stated"; the field definitions card is absent when the server sends
  `fields: null` (a caller without the sensitive permission and without the unrestricted status).
- **The policy segment** is the Settings -> access control controls the S3/S4 notes announced for the owner's answers of 2026-10-12:
  `access.event_portrait_audit` (default on), `access.event_portrait_sensitive`, `access.employee_no_sensitive`,
  `access.sync_errors_everyone` (default off). One switch per row, saved at once as a single-key `PATCH /settings`; a failed save puts
  the switch back and says so; a value the server cannot read is shown as the SAFE choice it acts on (fail closed, the same rule as
  `Authority.policy`). It is the only thing on the page that writes, and it writes Arx's own settings, not the integration.
- **Phone**: the shared table shows each row as a card (no sideways scroll); a station row is two lines (name and chevron, then the sync
  word and when it was last seen); the actions of the page are 44 px; the tab row of the segments is the second-level tab style the
  administrator configured.

### Tests (S10)

| What | File |
|---|---|
| Node unit: logic and words, the loader | `unit-access-status-logic.spec.ts`, `unit-access-status-feed.spec.ts` |
| Mocked-backend evidence at desktop / tablet / phone: behaviour (reads asked, paging, filters, stale, permissions per persona, policy saves), every state, the skins x light / dark | `evidence-access-status.spec.ts` (+ `docs/design/evidence/CR-036-S10/*.png`) |
| Layout guard across widths, light + dark, every skin | `layout-access-status.spec.ts` |
| Linux pixel baselines | `pixel-access-status.spec.ts` |
| The mock replies equal the real endpoints' shapes (status, health, history, sync, conflicts, alerts, audit, groups, versions) | `backend/tests/test_access_control_wire.py` (from S8) |

### Known gaps (S10)

- No member counts on the groups (the integration's groups read carries none; counting people would be a scan).
- No "edit in the intercom window" button on the groups (a write phase / a deep link to the integration's tool, S15+).
- The action log filters are station and action; the integration also filters by person and period (`status/audit` accepts `user_id`,
  `start`, `end`) - not offered in this stage, and it has no export.
- No place tree on the station list (the base has no station placement; CR-033).
- English strings cover the page chrome only; Hebrew is complete.
- Live: the committed fixture WisKey (`wiskey_fake_ha.py`) does not serve `health/get`, `sync/status`, `conflicts/list`, `fleet/alerts`,
  `audit/list` or `profiles/*`, so the page was NOT run in a browser against the real backend and the fake WisKey end to end; the shapes
  are proven by the wire test against `fake_wiskey.py` and the behaviour by the mocked evidence. NOT_RUN: Crystal skin (not in this base).
- The display switch of the access-control screens (CR-036 S12) is not here: it joins as a segment of this page (`AccessSegment` and
  `segments()` in `system-access-control.ts`); the old "בקרות כניסה" sub-tab of "כללי" keeps it until then.
