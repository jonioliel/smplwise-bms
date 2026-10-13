# WX small tasks of 2026-10-13 (WXMEDSET, WXSCH, WXUNBLK) - notes

Branch `pilot/WX-small-2410`, cut from `origin/integ/249` @ `7b9b63e7` (the 2.4.9 WisKey stage-1 integration that was being gated).
Three owner decisions of 2026-10-13, one commit group each. Nothing here contacted a WisKey, a station, a door, Home Assistant or an NVR:
fakes and mocks only. No migration, no new add-on option, no new dependency, no version / CHANGELOG edit. Read with
`docs/release/2.4.9-INTEGRATION-NOTES.md` (decision 4 left the first one as a follow-up), `docs/changes/CR-036-S18-MEDIA.md` (the setting),
`docs/changes/CR-036-S9-NOTES.md` (the deep link) and `docs/changes/CR-033-WISKEY-DOOR-PATH.md` (R-17, D8, D9).

## A. WXMEDSET - the Settings row for live video and talk

Settings > כללי > "מתגי מסכי כניסה", in the existing display card "תצוגת מסך התחנות", a fifth control row **"וידאו ודיבור במסך התחנות"**:
כבוי / וידאו / וידאו ודיבור = `access.station_media` = `off` / `video` / `video_talk` (default `off`, S18). It is saved with the card's own
button through `PATCH /settings` like the other four rows (the server already validates it, audits it and limits it to `system.configure`;
`test_intercom_media.py`). A bare row: the label and the choice - no hint line, no paragraph, nothing about how the picture travels. It
travels through the product's own go2rtc only, WebRTC or MSE (`services/intercom_media.py` `VIDEO_TRANSPORTS`, the player's `Transport` type);
that is not a choice, so nothing names it.

| File | Change |
|---|---|
| `frontend/src/api/station-media.ts` | `STATION_MEDIA_KEY`, `STATION_MEDIA_MODES` (the one place the key and the three values are written) |
| `frontend/src/access-control/parity-logic.ts` | `mediaOptions()` |
| `frontend/src/screens/system-access-display.ts` | the row (`data-access-display-media`), the draft / saved / default handling for the key |
| `frontend/src/i18n/access-parity.ts` | `dispMedia*` (Hebrew, English) |

Tests: `unit-wxmedset.spec.ts` (choices and words in both languages, the three values equal the server's pattern and default, a bare-row source
guard, an unreadable value reads as off), `evidence-wxmedset.spec.ts` (browser, mocked backend: default off, three choices, the exact PATCH
body, a failed save keeps the choice, read only without `system.configure`, the server's value shown).

## B. WXSCH - "לוחות זמנים" from the station drawer

The station drawer (the station card's detail on the stations screen; the entry-log link of S12 lives there too) gets a quiet second link,
"לוחות זמנים", to the native schedules screen (S9) on the station's first door: `#/wiskey/schedules?door=<station>:<relay>` (the hand-off
S9 left open, section 5.2). A link and nothing else: no badge, no paragraph, no row when nothing is offered.

Offered only when all hold: the schedules screen **is** the native one (`access.ui.schedules` = `smplwise`; otherwise the address shows the
embedded panel, which has no schedules tab); the caller holds the schedules view permission - `access.stations.read` at any scope, the one that
opens the schedules tab (`NATIVE_WISKEY_TABS`); the server sent this station with its technical part and it has a relay - the very rule
(`doorsOf`) that puts a station's doors into the schedules screen's list, so the link cannot land on a door that screen does not show.

| File | Change |
|---|---|
| `frontend/src/screens/wiskey-stations-logic.ts` | `stationSchedulesHref()` |
| `frontend/src/screens/wiskey-stations-views.ts`, `wiskey-stations-css.ts` | `drawerLinks()` replaces `eventsLink()` (the entry-log link is unchanged; both share one wrapping row) |
| `frontend/src/i18n/wiskey-stations.ts` | `drawer.schedules` (Hebrew, English) |

Tests: `unit-wxsch.spec.ts`, `evidence-wxsch.spec.ts` (browser: the link and its address, beside the entry-log link, off by default, a station
without doors, the reader role sees it and the door opener does not, a click opens the address), `layout-wxsch.spec.ts` (the layout guard over the
drawer with both links: 5 skins x light / dark x 10 widths).

## C. WXUNBLK - release a blocked template / universal entity by hand

**Background.** Where a WisKey door exists, the door path blocks every entity of a script-backed platform (template, universal): its action
sequence is not in Arx's mirror, so an action on it may be a door opening that never passed the door authority (SEC-WXD M3). Arx-started tile and
map-card actions, bulk actions, and the run / enable of any saved item that touches one are refused; the editors refuse a NEW step that does
(`door_path.Resolver`, `door_run_guard`, `door_path_guard`, `device_bulk`). An item with a real WisKey door step is refused separately
(`door_step_not_converted`, "פתיחת דלתות מאוטומציה עדיין לא נתמכת") until WisKey's automation-actor appendix (W1 / D10a) exists.

**What was built.** The system administrator sees what is blocked and releases ONE entity by hand - "even if it goes through WisKey" - and blocks
it again. Explicit (a confirmation and a note saying why), audited (who, when, why), per entity, reversible.

- `services/door_overrides.py` - the list of releases. One settings key, `doors.entity_unblocked`, JSON `{"entities": {"<entity_id>": {note, by,
  by_name, at}}}` (no migration; not a product setting, so `GET /settings` never serves it). Reads fail closed: an absent, unreadable or
  hand-edited value releases nothing; an entry without a valid entity id or without a note (3-300 characters) is ignored. At most 500.
- `services/door_path.py` - `Resolver.blocked_platform()` is the single place that says "still blocked": a script-backed entity that is not on the list.
  Every spot that used to ask "is the platform script-backed" asks it (template lock, template button, a service call on a template entity, a scene
  member, a scene state). Honoured for that ENTITY only, and not for one the administrator mapped to an intercom door (`released()` drops those, so a
  release that predates a mapping does not count). `Unresolved.entities` names the script-backed entities behind a step (internal; the report
  `GET /intercom/door-path-inventory` stays names-only - `inventory()` drops the key unless asked).
- `services/door_blocks.py` - the Settings model: the entities (blocked / released / mapped to a door, with the saved items that use each), the items
  the guards refuse (name, kind, still blocked or freed, the real-door-step flag with the guard's own sentence, the devices behind it), and the
  eligibility rule.
- `routers/doors.py` - `GET /doors/blocks` (read only) and `PUT /doors/blocks/entities/{entity_id}` (`{unblocked, note?, confirmed: true}`),
  both `system.configure` at installation scope. Audit rows `intercom.door.entity_unblocked` / `intercom.door.entity_reblocked` (allowed: the note,
  domain, platform, the previous release when replaced / the release that was taken back; denied: the reason code).
  Refusals: 404 `entity_not_found`; 409 `not_overridable` with `details.reason` `wiskey_door` (a WisKey lock), `door_mapped`, `not_blocked` (not
  script-backed, or no WisKey door in the installation); 422 `validation` (no note, a note under 3 or over 300 characters, a malformed id);
  409 `confirmation_required`; 409 `too_many_overrides`. Blocking again is idempotent and writes nothing when there is nothing to take back.
- Frontend: `<sw-door-blocks>` on Settings > חיבורים under the "פריטים שפותחים דלתות" card (`system.configure`), with search, the filter
  הכול / חסומים / משוחררים, "show more" (50 at a time), a switch per device that opens a short question asking WHY (a note is required before
  anything is sent), and the blocked items beside it: an item that opens a door shows the guard's sentence and why it stays, and has no switch.
  `api/door-blocks.ts`, `access-control/door-blocks-logic.ts`, `i18n/door-blocks.ts`, `screens/system-door-blocks.ts`; the Settings index finds it
  (`system-index.ts`).

**What a release is not** (each pinned in `tests/test_wiskey_door_overrides.py`):
- It never touches a step that opens a WisKey door: an item with one keeps `door_step_not_converted` and its exact message (run and enable), also
  when every blocked entity is released, and the inventory still lists it.
- A WisKey lock, an entity mapped to an intercom door, and any entity that is not script-backed cannot be released; a stale release of a
  mapped one is not honoured.
- `door_execute_guard` (the add-on's own block of `execute` for a WisKey door) and the door authority are untouched.
- No other unresolved reason is released (a computed service or target, a label, an unknown item, a lock group) - they carry no entity to release.
- A damaged or hand-edited store releases nothing.

**Choices recorded.** (1) The list shows the entities the guards can name but spares the passive ones (sensor, binary sensor, weather, image, event,
device tracker: nothing to act on) unless one holds a release; the route accepts any script-backed entity. (2) Lock groups (`group_lock`) are not
covered: the owner named template / universal entities. (3) The refusal texts of the guards are unchanged (pinned by the 2.4.9 tests), so a tile
refusal on a template switch still uses the automation wording; the card is where an administrator finds the way out. (4) No migration: the
list is a settings key; rolling back to 2.4.9 leaves a harmless unused key and every entity blocked again.

## Not run here (runner / later)

- Linux pixel baselines. Changed by this branch: `pixel-access-s12.spec.ts` `s12-<skin>-display-1440` and `-390` (5 skins x 2 sizes = 10
  images: the display card has a fifth row); the Connections page has a new card (no pixel spec shows it). The stations drawer's schedules link
  shows only with `access.ui.schedules` = `smplwise`, which no stations pixel spec sets, so no stations baseline changes. Regenerate on the
  runner with `--update-snapshots`, look at every image, run again without it.
- The gate's visual comparison (`scripts/settings-shots.mjs`: `settings-setup`, the access-control switches page) will show the new card and the new row as intended changes (the comparison is warn-only).
- The full gate and the backend suites on the runner (locally only the door-path files and the new test file ran, see the report).
- `contracts/API_INVENTORY.md` is generated and not regenerated here (+2 routes); the integrator regenerates it.
