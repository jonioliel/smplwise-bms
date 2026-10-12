# CR-036 slice S6 - the native stations and doors screen: notes for the slices built on top

Branch `pilot/WISKEY-native-s6-stations` (from `pilot/WISKEY-native-s3-s4`). Read with
`docs/changes/CR-036-S3-S4-INTERFACE-NOTES.md`. Nothing here contacted a WisKey, Home Assistant, station or device: the
Playwright specs mock the typed endpoints in the browser (`frontend/tests/wiskey-stations-mocks.ts`, six invented
stations), the backend test uses the existing settings test fixtures. Live behaviour is NOT_RUN until slice S14.
No migration. No new backend route.

## 1. What was built

The screen `תחנות ודלתות` (`<wiskey-stations>`), the first native replacement of an embedded WisKey screen.

- **Where it shows.** The "devices" tab of the access-control area (`#/wiskey/devices`, labelled `תחנות ודלתות` when native).
  Native only when the administrator setting `access.ui.stations` is `smplwise`; the default is `wiskey` (the iframe, the
  rollback). A visit can still reach the iframe with `#/wiskey/overview?classic=1` (the "talk" button, the drawer's
  "open in the classic panel" button): a per-visit override that changes no setting. No header button; the switch is the
  existing per-screen list in Settings -> access control -> display, which gained a row for this screen
  (`data-set-access-ui="stations"` in `screens/system-diagnostics.ts`).
- **Views.** Cards, list, table (the choice is remembered in the browser only), filter (all / online / needs attention /
  in a call), search, a place tree (phone: a sheet), a call strip when a call is active, the feed badge (live / last
  update / not connected).
- **The table keeps to its host.** `sw-table` scrolls a wide table inside itself, which hides the END of every row - and the
  mock-up put the door buttons last, so at 1440 px they were half cut off. The columns are therefore ordered by use (station,
  state, call, buttons, then place, last seen, door names, sync, model) and the table gives up columns by viewport width
  (`tableTierOf` in `wiskey-stations-logic.ts`): `full` from 1440 px, `medium` 1101-1439 px (no door names, no model), `compact`
  up to 1100 px (also no place; a call that is on and an offline station's last sighting move under its state). Measured: the
  table fits its host from 1024 px up in every tier; the buttons are in view down to 768 px (the sync column may be cut
  there). Door buttons stack two per line instead of widening the column. Deviation from the mock-up, on purpose.
- **States.** loading, empty, empty-after-filter, error (retry), forbidden (no `access.read`), not configured, connecting,
  unavailable, unsupported, stale (last-known copy: readable, every physical control withdrawn), per-station still states.
- **Drawer** per station: a still (live video stays in the classic panel), place, last seen, call row, doors, announce,
  technical part (sync, model, firmware, relays, clock, stream, last error where visible), and view-only door settings:
  hold-open programs (weekly windows, holidays, status) and "configured / not configured" public-code presence (never a
  value).
- **Door release** (interim transport): the existing `POST /intercom/stations/{id}/release`, a confirmation first, exactly
  ONE request per confirmation, never retried, the wording is always "sent" (with the clock time), never "opened". A
  dropped connection or a 502 is amber ("unknown, check on site before sending again") and the relay stays held for as
  long as the backend says (`intercom_release_in_progress` / the retry-after hint, 70 s fallback).
- **Calls.** An incoming-call hint on the card for everyone who sees the station (no caller name; the administrator can
  narrow it to who may act on calls); answer / decline / hang up through the existing `POST /intercom/stations/{id}/call`,
  two taps (the first arms for 4 s) so a stray tap never answers; a result line says what is known ("acknowledged by the
  station" / "no acknowledgement" / "state unread"). The talk button opens the classic panel (owner answer 8).
- **Announce.** The panel (`<wk-announce-dialog>`): targets (this station, a place, all stations inside the caller's
  scope), message (500 characters), quick phrases, a preview line, engine / language behind "more", one result line,
  a lock after an unknown outcome. The write goes through ONE client function: `announceToStations()` in
  `frontend/src/api/access-stations.ts` (sequential, one `POST /intercom/stations/{id}/tts` per station, once each, a
  failure at one never repeats or stops the rest).
- **Sync column** (technical part): an operator sees the state only (synced / pending / syncing / error / offline / unknown);
  the error text is shown only where the server sent it (`admin.read` or `access.sync_errors_everyone`).

## 2. Permissions (what the screen offers; the server still decides)

| Control | Shown when | Server gate today |
|---|---|---|
| list, cards, call hint, still | `access.read` (anywhere) | `access.read`, filtered by the S3 authority |
| door open, answer / decline / hang up, announce | `access.release` | `access.release` (installation scope) |
| talk button (classic panel) | `access.release` and `access.talk_button` = classic | - (a link) |
| technical part, door programs, code presence | the server sent `technical` (`access.stations.read` on the station) | `access.stations.read` |
| sync error text | the server sent `errors` | `access.admin.read` or the policy |

Absence-based: the screen never infers a right from a role name; a field the server did not send is simply not drawn.

## 3. Settings (new, administrator-changeable through `GET` / `PATCH /settings`, `system.configure`, audited)

| Key | Values | Default | Effect |
|---|---|---|---|
| `access.ui.stations` | `wiskey` / `smplwise` | `wiskey` | which screen the tab shows (the rollback is the iframe) |
| `access.call_hint` | `everyone` / `call` | `everyone` | who sees the incoming-call hint on a station they see |
| `access.talk_button` | `classic` / `hidden` | `classic` | the talk button (opens the classic panel) |
| `access.announce_scope` | `scope` / `station` | `scope` | `station` limits announcing to one station at a time |
| `access.announce_phrases` | text, one phrase per line (8 x 160 characters kept, 2000 stored) | empty = built-in phrases | the quick phrases of the announce panel |

An unreadable value takes the safe choice. `access.ui.stations` is switched from the existing per-screen list; the controls
for the other four are not in the Settings UI yet (S10 / S12): until then they are changed through `PATCH /settings`.

## 4. Typed endpoints and existing endpoints used

Reads: `GET /access-control/stations`, `.../features`, `.../stations/{id}/programs`, `.../stations/{id}/codes`;
`GET /devices/tree` and `GET /devices/entities` (the station camera's floor / area, the place tree);
`GET /intercom/tts/engines`; `GET /intercom/stations/{id}/camera-snapshot.jpg` (the still); the notice socket.
Writes (all existing, unchanged): `POST /intercom/stations/{id}/release`, `.../call`, `.../tts`.
The browser never talks to WisKey.

## 5. Gaps and hand-offs

1. **S11 (call and announcement gate).** `media/signal` (answer / decline / hang up) and the announcement still run on the
   existing endpoints gated by `access.release` at installation scope, because the station-chain gate and `access.call` do
   not exist as endpoint gates yet (interface notes, section 2). When S11 moves them: bind `announceToStations()` to the new
   endpoint (the all-stations / whole-place rule "inside the caller's scope" must then be enforced on the server; today the
   client only lists the stations it was sent, which the server already filtered), change `rightsOf()` in
   `screens/wiskey-stations-logic.ts` (`call` / `announce` -> `access.call`), and keep the owner answer that announcing IS the call
   permission.
2. **Door authority (CR-033).** Door release keeps `access.release` (installation scope); the per-door authority
   (`door_access` on the overview) replaces it when CR-033 is merged. The screen already offers a door button per relay.
3. **Places.** The place tree is derived from the devices tree (the floor / area of the station's camera entity), because no
   station placement read exists before CR-033 (`intercom_station_placement`). Replace `derivePlaces()` then.
4. **Deep links.** The drawer has no "events of this station" / "schedules" links yet (S8 / S9 screens do not exist).
5. **Hold state on cards.** No read exposes the live hold state of a door except the program execution status, so cards
   show none; the drawer's door row shows "open by hold" when the program says `held_acknowledged`.
6. **Call duration** is counted from the first observation of the state by this browser (the feed carries no start time).
7. **Crystal skin.** Not on this base (it exists on `origin/main`); the skin specs are driven by the skin list
   (`SKIN_IDS`), so Crystal is covered automatically once merged. It was looked at once in a throwaway local tree (this
   branch's screen files over `origin/main`'s `frontend/src/design`, never pushed): the skins spec, light and dark at the
   three widths, passed, and `stations-*-crystal-*` in the evidence folder come from that run. The layout sweep and the pixel
   baselines for Crystal run only after the merge.
8. **Other screens' fallback panels** (`FEED_PANELS` in the sibling native screens) still say WisKey in places; this screen's
   feed messages never name the platform. Not touched here.
9. **Fix outside the slice.** `system-wiskey-diagnostics.ts` chip radius was a literal (an S1 `unit-token-lint` failure);
   it is now `var(--sw-r-pill)`.

## 6. Conflict-prone files

`frontend/src/shell/nav.ts` (`WiskeyScreen`, `WISKEY_SCREENS`, `WISKEY_SCREEN_SEGMENT`, `WISKEY_UI`, `rebuildWiskeyTabs`,
`wiskeyRoute`), `frontend/src/shell/sw-app.ts` (one import, one render branch), `frontend/src/screens/wiskey-embed.ts`
(`wiskeyScreenOf`), `frontend/src/screens/system-diagnostics.ts` (`ACCESS_SCREENS`), `frontend/src/api/media.ts`
(`ProductSettings`), `smplwise_vms/backend/smplwise/routers/settings.py` (DEFAULTS + `SettingsPatch`),
`smplwise_vms/backend/tests/test_ui_settings.py`. Every other file of the slice is new (`wiskey-stations*`, `wk-*`,
`sw-place-tree`, `sw-view-switch`, `access-stations.ts`, the specs and the evidence images under
`docs/design/evidence/wiskey-stations/`).

## 7. Tests

- Node unit: `tests/unit-wiskey-stations.spec.ts` (logic, the action state machine, the announcement write, the catalogues),
  `tests/unit-wiskey-stations-nav.spec.ts` (tabs, segments, `?classic=1`).
- Browser evidence with a mocked backend: `tests/evidence-wiskey-stations.spec.ts` (desktop / tablet / mobile),
  `tests/evidence-wiskey-stations-skins.spec.ts` (every skin on the base, light + dark, writes the evidence images).
- Layout guard + own-target check: `tests/layout-wiskey-stations.spec.ts`.
- Pixel (Linux baselines, new states only): `tests/pixel-wiskey-stations.spec.ts`.
- Backend: `tests/test_ui_settings.py` (defaults, validation, audit, gate of the new keys).
