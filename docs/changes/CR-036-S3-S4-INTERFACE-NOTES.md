# CR-036 slices S3 + S4 - interface notes for the slices built on top (S6-S11, the write phase)

Branch `pilot/WISKEY-native-s3-s4` (from `pilot/WISKEY-native-s0-s1`, with `pilot/WISKEY-native-screens-plan` merged for the
CR document). Nothing here contacted a WisKey, Home Assistant, station or device; every test runs against
`tests/fake_wiskey.py`. Live behaviour is NOT_RUN until slice S14.

Read with: `docs/changes/CR-036-WISKEY-NATIVE-SCREENS.md` (sections 2-4 and both owner-answer sections, 2026-10-11 and
2026-10-12).

## 1. What exists now

| Piece | Where | One line |
|---|---|---|
| Permissions | `roles.json`, `contracts/examples/role-catalog.design.json`, `routers/access.py` PERMISSION_LABELS, `frontend/src/access-control/access.ts` | 10 new `access.*` permissions (section 2) |
| Owner-answer settings | `services/intercom_authority.POLICY_DEFAULTS`, spread into `routers/settings.py` DEFAULTS | 4 administrator settings (section 2.3) |
| The projection filter | `services/intercom_authority.py` | `Authority` (per request) + the views; the ONE place that decides who sees what |
| The read adapter | `services/intercom_adapter.py` | typed WisKey reads, closed projections, cache, feature flags, `ADAPTER` |
| Typed endpoints | `routers/access_control_reads.py` | 25 GET routes under `/api/v1/access-control/...` (section 4) |
| Channels | `services/wiskey_channels.py` | `read` + `technical` allow-lists on the service socket (section 5) |
| Legacy reads | `routers/access_control.py` | `/intercom/events`, `/intercom/people`, `/intercom/people/{id}` now go through the adapter + filter; overview, background view and camera still omit stations off the caller's chain |
| Fakes | `tests/fake_wiskey.py`, `tests/fixtures/wiskey_rc37/*.json`, `tests/intercom_station_scope.py` | section 7 |

## 2. Permissions

| Permission | Default roles | Sensitive | Gates |
|---|---|---|---|
| `access.read` (unchanged) | viewer, operator, editor, site_admin, system_admin | no | the entry center's stations: online, call state (no caller name), doors, camera id |
| `access.stations.read` | operator, site_admin, system_admin | no | a station's `technical` part; door programs, hold-open drafts, public-code presence |
| `access.events.read` | operator, site_admin, system_admin | no | the entry log with names, employee numbers and (answer 4) the event picture |
| `access.events.export` | site_admin, system_admin | yes | CSV export (and `access.events.read` on the exported stations) |
| `access.people.read` | operator, site_admin, system_admin | no | people: names, employee number (answer 2), assignments, groups, validity, timing |
| `access.people.sensitive` | site_admin, system_admin | yes | phone, the person's photo (people screen), profile values, responsible person, purpose |
| `access.call` | site_admin, system_admin | yes | catalogue only: S11 moves call / announcement onto it (answer 6: announcing IS the call permission) |
| `access.admin.read` | site_admin, system_admin | no | the Settings status page (health, sync, alerts, conflicts, WisKey's own audit, policy versions) and every sync error text (answer 5) |
| `access.schedules.manage`, `access.stations.manage`, `access.groups.manage` | system_admin | yes | catalogue only until the write phase gates its writes on them |

Every one is scoped by the access-control station chain (CR-033). `access.people.manage`, `access.cards.capture`,
`access.release` are unchanged (S11 moves them onto the station chain).

### 2.1 Station scope: a thin dependency on CR-033 (NOT copied)

The only call S3 makes is `rbac.authorize(conn, principal, permission, (STATION_SCOPE, station_id))`, `STATION_SCOPE =
getattr(rbac, "STATION", "access_control_station")`. On this branch rbac does not know the scope type: the chain is the
installation alone (only installation bindings decide - the safe reading). After CR-033 D2 (`origin/pilot/WXD-wave1`,
migrations 0077 / 0078, `rbac.station_chain`, `intercom_station_placement`) is merged, the same call walks station ->
building -> site -> installation with deny-overrides; nothing in S3/S4 changes. No migration in S3/S4 (none needed; the next
free number after CR-033's 0078 stays 0079 for whoever needs it).

At the CR-033 merge:
- `tests/intercom_station_scope.py` switches itself to real rows (it tries a real station binding first; on this branch the
  CHECK constraint refuses it and it injects a labelled double into `rbac._active_bindings` / `rbac.scope_chain`). Delete
  the double's branch once CR-033 is in `main`.
- add `access.call` to CR-033's `door_opener` role (answer 6 of 2026-10-12: the call / announcement stays with the door
  opener), in both role catalogs, before S11 moves the endpoints.
- `routers/access_control.py` `overview()`: CR-033 adds `body["door_access"] = ...` next to S3's station filter - keep both
  (filter first, then the door map over the filtered stations).
- `Authority.unrestricted()` treats ANY site / building / station deny of a role carrying the permission as "restricted"
  (conservative: a deny where nothing is placed yet still counts). Revisit only if it hides too much in practice.

### 2.2 The rules (what `intercom_authority` enforces)

- Default deny, deny overrides (rbac.authorize over the station chain); an evaluation error is a refusal.
- Off-chain stations are omitted, never greyed; single reads of an off-chain station / person / event answer exactly like
  an absent one (`intercom_adapter.uniform`: same status, code, message, no details).
- A person is visible through an assignment on a station where the caller holds `access.people.read`; a person with no
  assignment (or with assignments WisKey redacted) only to a caller UNRESTRICTED for it; off-chain assignments are omitted.
- A person's level is the LOWEST over their visible stations (names / sensitive). `editable` = `access.people.manage` on
  EVERY station of the person (and WisKey's own `operator_editable` when sent) - S11 must enforce the same server-side.
- Counts reach only callers unrestricted for the permission; otherwise recounted over visible rows or null
  (`total_all: null`); restricted paging uses Arx's own snapshot digest and opaque, per-principal event cursors (`c.`...).
- Filters / searches / sorts that WisKey would match on a field the caller cannot see are never handed to WisKey:
  `users/query` text is always empty (D1); the `person` event filter and the employee-number sort are forwarded only when
  every employee number is visible to the caller (`Authority.employee_no_everywhere`), otherwise matched / ordered by Arx
  on names; `current_group` needs `access.people.read`; `credential`, `profile`, `current_profile` are never offered.

### 2.3 Owner answers of 2026-10-12 as settings (`GET` / `PATCH /settings`, `system.configure`)

| Key | Default | Effect |
|---|---|---|
| `access.employee_no_sensitive` | `false` | `true`: employee number (rows, search, sort, event `person` filter, export column) needs `access.people.sensitive` |
| `access.event_portrait_sensitive` | `false` | `true`: the event picture needs `access.people.sensitive` on the station |
| `access.event_portrait_audit` | `true` | `false`: no `intercom.event.portrait_view` audit row per picture view |
| `access.sync_errors_everyone` | `false` | `true`: sync error texts (a person's per-station error, a station's last / scan error) shown to everyone on the row |

An unreadable value takes the safe choice. S10 / S12 add the Settings -> בקרת כניסה controls (no UI here).

## 3. Using the filter from new code (S6-S11)

```python
from ..services import intercom_authority as ia
auth = ia.require_anywhere(conn, principal, ia.PEOPLE_READ, request_id)   # the gate: audited 403, before parameters
auth.station(ia.STATIONS_READ, station_id)       # bool, deny-overrides on the station chain
auth.unrestricted(ia.ADMIN_READ)                 # covers every station, present and future
ia.require_unrestricted(auth, ia.ADMIN_READ, request_id)  # WisKey's installation-wide views (audited 403 "station_scoped")
auth.person_level([...station ids...])           # "none" | "names" | "sensitive"
auth.person_editable([...])                      # S11's write rule (before AND after the change)
auth.employee_no_for(level), auth.event_portrait(sid), auth.sync_errors(sid), auth.policy(ia.PORTRAIT_AUDIT)
ia.view_station / view_person / view_event / view_groups / view_sync_status / view_alerts / view_conflicts / view_audit_page
```

Rules for new endpoints: gate with `require_anywhere` as a dependency on the READ connection (`current_principal_ro` +
`get_read_conn`); never return a superset; build every response field by field; never cache a view; never key a cache by
a principal; never put person data in a cache or a log line.

## 4. The typed endpoints (all `GET /api/v1/access-control/...`)

Reply of the JSON reads: `{state, configured, last_error, fetched_at, <key>, sync}` (+ `fresh` for cached / station reads).
`<key>` is null unless `state == "ready"`. `state: "unsupported"` + `last_error` `not_listed` / `api_incompatible` /
`commands_unknown` = this WisKey does not offer it; nothing was sent.

| Path | Gate (anywhere) | Reply key | Adapter method | WisKey command | Cache |
|---|---|---|---|---|---|
| `features` | access.read | `features` | `features` | (overview copy) | - |
| `stations` | access.read | `stations`, `default_zone` | `stations` | (overview copy) | feed copy |
| `stations/{id}` | access.read | `station` | `station` | (overview copy) | feed copy |
| `stations/{id}/programs` | access.stations.read | `programs` | `door_programs` | technical_program_list | 30 s |
| `stations/{id}/doors/{door}/hold` | access.stations.read | `hold` | `hold_schedule` | technical_hold_get | 30 s |
| `stations/{id}/codes` | access.stations.read | `codes` | `codes_presence` | technical_codes_get (presence only) | 300 s |
| `stations/{id}/health` | access.admin.read | `health` | `health` | health/get | 30 s |
| `stations/{id}/health/history` | access.admin.read | `history` | `health_history` | health/history | 60 s |
| `status/stations` | access.admin.read | `stations` | `status_stations` | (overview copy) | feed copy |
| `status/sync` | access.admin.read | `sync_status` | `sync_status` | sync/status (counts only) | 30 s |
| `status/conflicts` | access.admin.read, unrestricted | `conflicts` | `conflicts` | conflicts/list | never |
| `status/alerts` | access.admin.read | `alerts` | `alerts` | fleet/alerts | 30 s |
| `status/audit` | access.admin.read, unrestricted | `audit` | `wiskey_audit` | audit/list | never |
| `people` | access.people.read | `people` (+`sort`) | `people` | users/query | never |
| `people/{id}` | access.people.read | `person` | `person` | users/get | never |
| `people/{id}/photo` | access.people.read (+ sensitive level) | image/jpeg | `person_photo` | users/get + users/photo_get | never; audited |
| `events` | access.events.read | `events` | `events` | events/list | never |
| `events/export.csv` | access.events.export (+ events.read) | text/csv | `events_export` | events/export | never; audited |
| `events/{id}` | access.events.read | `event` | `event_detail` | events/detail | never |
| `events/{id}/portrait?station_id=&at=` | access.events.read | image/jpeg | `event_portrait` | events/list + users/photo_get | never; audited (setting) |
| `groups` | access.people.read | `groups` | `groups` | profiles/settings_get | 60 s |
| `groups/versions` | access.admin.read, unrestricted | `versions` | `group_versions` | profiles/versions | 60 s |
| `schedules` | access.stations.read, unrestricted | `schedules` | `schedules("library")` | schedules/list | 60 s |
| `schedules/plans` | access.stations.read, unrestricted | `schedules` | `schedules("plans")` | schedules/plan_list | 60 s |
| `schedules/operations` | access.stations.read, unrestricted | `schedules` | `schedules("operations")` | schedules/operations_list | 60 s |

Notes per screen slice:
- **S6 stations and doors:** `stations` / `stations/{id}`; `technical` null without stations.read; `errors` null without
  admin.read (answer 5); relays = `locks[]` (no `technical_relays` read exists - it is a configuration command). Door
  opening stays CR-033's (`door_access` on the overview, the door authority). Answer 3: the call hint = `call_state`.
  Answer 8: the talk button opens the classic panel (iframe); no audio endpoint here.
- **S7 people:** `people` with `query` (Arx-side: name + employee number where visible), `station`, `group`, `rights`,
  `state` (incl. `archived`), `sort`, `offset`/`limit`/`snapshot`; `people.complete`/`incomplete_reason` when a scan stopped
  early (`scan_limit`, `rate_limited`, `busy`); `total_all` null for restricted callers - do not show "N of M" then.
  Person page: `level`, `editable`, `stations[]` (sync state; `last_error` only for admin.read), `timing`, `group_ids`;
  sensitive fields null below the sensitive level; photo via `people/{id}/photo` only when `level == "sensitive"` and
  `photo_configured`. Group names from `groups`.
- **S8 events:** `events` rows carry `portrait` (true / false / null); detail adds `evidence`, `source_identity` (no
  picture - rc.37's detail has none); the picture is `events/{id}/portrait?station_id=<row.station_id>&at=<row.timestamp>`.
  `next` may be an opaque `c.` cursor - pass it back as `before` unchanged; `intercom_cursor_expired` = reload page one.
  Export: a restricted caller must pick a station (`intercom_export_station_required`); columns per caller.
- **S9 schedules:** `schedules`, `schedules/plans`, `schedules/operations` (installation-wide: hide the area for a
  station-scoped caller - they get 403), per door `stations/{id}/programs` and `.../doors/{door}/hold`, code presence
  `stations/{id}/codes` (never a value; `configured` may be null = unknown). Shapes are W? until WisKey's W2.
- **S10 status page:** `status/stations`, `stations/{id}/health(/history)`, `status/sync` (per-station counts + totals over
  what the caller sees), `status/alerts` (paged, counted over visible stations; `complete` false when WisKey had more than
  200), `status/conflicts` and `status/audit` (unrestricted only), `groups` + `groups/versions` for the groups view.
- **S11 writes:** reuse `ia.require_anywhere` + `auth.person_editable(before | after stations)` for people writes, the
  CR-033 door authority for doors, `access.call` for call / announcement (answer 7: "all stations" / a whole place only
  inside the caller's scope). Add `request_id` / `body_sha256` to the audit envelope (CR-033 decision 21).

## 5. Channels and commands

| Channel | Commands | Rule |
|---|---|---|
| `service` (unchanged identity) | overview, subscribe, authorization/session, users/get (the editor), tts/engines, cards/capture_status + the writes | `events/list` and `users/query` left it in S4 |
| `read` | users/query, users/get, users/photo_get, events/list, events/detail, events/export, profiles/settings_get, profiles/versions, schedules/list, schedules/plan_list, schedules/operations_list, health/get, sync/status, conflicts/list, fleet/alerts, audit/list | every one READ in the pinned catalog; exactly `intercom_adapter.CHANNEL_OF` |
| `technical` | stations/technical_program_list, technical_hold_get, technical_codes_get, health/history | non-READ in the catalog, view-level grants, reviewed side-effect free; `api_contract: 1`; one in flight |

Not carried by any channel: `stations/technical_relays` (stations: manage, takes `expected` / `locks`), `overview/summary`,
`stations/list`, `stations/get` (the feed's overview copy already has the stations). A new read = a typed function in the
adapter + `CHANNEL_OF` + the channel list + `ADAPTER_CALLS` in tests/test_wiskey_contract.py + a fake fixture.

Source review of the response shapes (WisKey rc.37 reference copy in `private-evidence/wiskey-native-rc37`, read only,
never run), the handlers: websocket.py `_dispatch_inner` (791-1686) with technical_api.py 20-119 (programs, hold, codes;
codes via client/technical.py 153-165 - presence booleans only), health_api.py 20-153 + fleet_health.py 129-136,
fleet_alerts_api.py 14-66, admin_operations_api.py 60-72 + access/admin_audit.py 388-436, event_manager.py 177-300 +
reporting.py 134-211 (export), profile_settings.py 185-278, access/policy_versions.py 129-149, schedule_plan_api.py /
schedule_operations_api.py / access/schedules.py 196-200, access/user_directory.py 84-214. Side effects of reads on
WisKey's side: an event-cache prune can schedule a storage flush; a refused request writes WisKey's operations journal.

## 6. Feature flags and unknown values

`intercom_adapter.FEATURES` maps 21 features to their commands (`people`, `person`, `person_photo`, `events`,
`event_detail`, `event_portrait`, `events_export`, `groups`, `group_versions`, `schedules`, `schedule_plans`,
`schedule_operations`, `door_programs`, `hold_schedules`, `public_codes`, `health`, `health_history`, `sync_status`,
`conflicts`, `alerts`, `wiskey_audit`). `GET features` gives `{available, reason}` per feature - hide what is not available.
Unknown enum values arrive as `"unknown"` (Hebrew "לא ידוע" in the UI); unknown fields never arrive; free-text codes from
WisKey arrive as a code or `"other"`; a value WisKey redacted arrives as null (unknown), never as an empty value.

## 7. Fakes for the next slices

- `FakeWiskey("admin").use_directory()`: five people (u1 Dana: entry-a + entry-b with an error; u2 Avi: entry-b; u3 Noa:
  no station; u4 Lior: entry-c; u5 Dan Avraham: entry-a + entry-c), seven events across the stations (ev-7 has a picture),
  the S4 fixtures for every read. Switches: `unlist(*commands)`, `drift`, `set_offline`, `set_forbidden`, `errors_once`,
  `slow`, `stale_revision`, `overview["api"]["min_client"]`. Pushes: `fake.push("refresh")`.
- The identity-matrix fixture pattern: `tests/test_intercom_adapter.py::ac` (root / otto / vera / sara on entry-a / sam
  with a deny on entry-b) with `tests/intercom_station_scope.py` (`station_scope.bind(user_id, role, station, effect)`,
  `station_scope.place(station, site, building)`).
- Frontend: no fake WisKey yet for Playwright on the new endpoints (S6-S10 decide; `frontend/tests/fixtures/wiskey_fake_ha.py`
  is the phase-1 one).

## 8. Hand-off

- Conflict-prone files: `roles.json`, `contracts/examples/role-catalog.design.json`, `routers/access.py` (labels),
  `routers/settings.py` (DEFAULTS + SettingsPatch), `routers/access_control.py` (overview, legacy reads - CR-033 edits the
  same file), `services/intercom_sync.py` (`_store`, `_drop`, `_on_message`, `command`), `main.py` (one include line),
  `tests/test_intercom.py`, `tests/fake_wiskey.py`.
- Merge order: CR-033 D1-D4 (`WXD-wave1` and siblings) and this branch merge independently; whichever lands second resolves
  `access_control.py` / `roles.json` / `rbac` imports by keeping both. Then S6-S10 (screens), S11 (writes), S12 (switch).
- Behaviour change shipped here (owner answers 2026-10-11 / 2026-10-12): a viewer (`access.read` only) no longer reads the
  people directory or the entry log - the existing screens show their "no permission" panel for them (their nav still
  offers the tabs on `access.read`: S7 / S8 / S12 must gate the tabs on the new permissions).
- Known limits: response shapes are W? until WisKey's W2; the event picture is found again by a one-second window on the
  row's station; the export of a restricted caller is one station at a time; WisKey's own audit and conflicts are for
  unrestricted administrators only; `unrestricted()` is conservative about site / building denies.
