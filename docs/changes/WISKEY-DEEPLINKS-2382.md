# WISKEY-DEEPLINKS-2382 — deep links into the embedded intercom panel ("no dead end")

Branch `pilot/WISKEY-DEEPLINKS-2382`, from `origin/main` (v2.38.0 @ `efc12d0e3`). Task T18 of
`private/planning/WISKEY_FULL_INTEGRATION_PLAN_2026-11-03.md` (group G4). Frontend only: no backend, API, setting, migration or
version change; nothing is sent to a station or to the panel - a link only changes Arx's own address.

## What changes

Every access-control capability that Arx has no native screen for (the plan's matrix rows marked E, the M rows the panel already
has, and the installer tools kept in the panel) now has a precise link from the Arx place where an operator looks for it, straight to
the panel's tab / management tool. Before, the same capabilities were reachable only by opening the embedded panel and searching.

- **One table** - `frontend/src/wiskey/deep-links.ts` (pure, node-tested): capability id -> panel `tab` / `tool`, the Hebrew label,
  the plan rows served, and the places that offer it. An id the table does not know falls back to the panel root
  (`#/wiskey/overview?classic=1`), never to a guessed address.
- **One component** - `frontend/src/components/wk-deep-links.ts`: `place=` names the place; `mode="inline"` is a closed disclosure
  line ("פתיחה בחלון האינטרקום (n)") inside a section, `mode="menu"` an icon button in a page's actions that opens a short list. Links
  only (44 px rows), Escape closes, the list never leaves the viewport on a phone.
- **Addresses** are Arx's own route of the embedded panel (shell/nav.ts `wiskeyRoute`): a tool -> `#/wiskey/tools/<tool>`; a tab
  that can also be a native Arx screen (overview, events, people, devices) -> `#/wiskey/<segment>?classic=1` (the per-visit way to
  the panel that changes no setting); `users` is Arx's `people` segment. The embed then opens
  `/hikvision-intercom?embed=1&chrome=none&tab=..&tool=..` from the origin, as before.
- **Wording**: no platform name on any operator screen (the panel is "חלון האינטרקום", as the drawer's existing link).

## Permissions

A link is drawn only for a caller who may open the panel - the WisKey area's own rule: a backend, `access.read` at installation
scope, and the area not hidden for everyone (`ui.hide_wiskey`). The panel's administrator-only tools (`platform_center`,
`workflow_center`, `investigations`, `access_control` - panel.js `tabAvailable` requires the panel admin) are offered only with
`access.admin.read` at installation scope. Once the panel's handshake catalog (`wiskey:ready`) is known in the session, a link
whose tab / tool it does not list for this operator is not offered. The panel keeps its own permissions inside; a link never grants
anything (WisKey falls back to its default screen for an id the operator may not open).

## The link map

| Capability id | Panel target | Arx route | Plan rows | Offered in |
|---|---|---|---|---|
| `station_settings` | `devices` (the station settings dialog: technical, door programs, hold-open, public codes, rescan, clock refresh) | `#/wiskey/devices?classic=1` | 34, 36, 45, 46, 47 | station drawer, stations, schedules |
| `sync` | `sync` (sync now per person / station / all, conflict review + resolve, diagnostics file) | `#/wiskey/sync` | 3, 36, 38 | station drawer, stations, Settings status |
| `health` | `tools/health` (health, fleet inventory export, acceptance) | `#/wiskey/tools/health` | 34, 82, 98 | station drawer, stations, Settings status |
| `fleet_alerts` | `tools/fleet_alerts` | `#/wiskey/tools/fleet_alerts` | 77 | stations, Settings status |
| `clock_settings` | `tools/clock_options` | `#/wiskey/tools/clock_options` | 51 | station drawer, Settings status |
| `people_panel` | `users` (unmanaged users import / adopt / ignore / delete, a person's "can open" scenario) | `#/wiskey/people?classic=1` | 25, 29 | people |
| `profile_fields` | `tools/profile_options` | `#/wiskey/tools/profile_options` | 27 | people, Settings groups |
| `identity_lifecycle` | `tools/identity_lifecycle` | `#/wiskey/tools/identity_lifecycle` | 28 | people |
| `access_reviews` | `tools/access_reviews` | `#/wiskey/tools/access_reviews` | 29 | people |
| `access_comparison` | `tools/access_comparison` | `#/wiskey/tools/access_comparison` | 29 | people |
| `data_quality` | `tools/data_quality` | `#/wiskey/tools/data_quality` | 29 | people |
| `device_schedules` | `tools/schedules` | `#/wiskey/tools/schedules` | 49 | schedules (also its "edit" button) |
| `panel_audit` | `tools/audit` (change log, export, station permission audit) | `#/wiskey/tools/audit` | 79, 89 | Settings audit |
| `events_report` | `events` (report, print) | `#/wiskey/events?classic=1` | 79 | Settings audit |
| `operations_center` | `tools/operations_center` | `#/wiskey/tools/operations_center` | 80 | Settings status |
| `investigations` (panel admin) | `tools/investigations` | `#/wiskey/tools/investigations` | 80 | Settings status |
| `platform_center` (panel admin) | `tools/platform_center` | `#/wiskey/tools/platform_center` | 50, 82 | Settings status |
| `workflow_center` (panel admin) | `tools/workflow_center` | `#/wiskey/tools/workflow_center` | 84 | Settings policy |
| `panel_permissions` (panel admin) | `tools/access_control` | `#/wiskey/tools/access_control` | 87 | Settings policy |
| `permission_directory` | `tools/permission_directory` | `#/wiskey/tools/permission_directory` | 87 | Settings policy |
| `media_options` | `tools/media_options` | `#/wiskey/tools/media_options` | 52 | Settings policy |
| `whatsapp_templates` | `tools/whatsapp_templates` | `#/wiskey/tools/whatsapp_templates` | 75 | Settings messaging |
| `visit_requests`, `guest_templates` | `tools/visit_requests`, `tools/guest_templates` | `#/wiskey/tools/...` | 30 | in the table, mounted nowhere (owner question Q6 of the plan) |
| (unknown id) | panel root | `#/wiskey/overview?classic=1` | - | - |

Places: the station drawer's "טכני" section (`place="station"`, inline); the stations and doors screen, the people screen and the
schedules screen (page actions, menu); Settings › בקרת כניסה, one line under each segment (`settings-status | -audit | -groups |
-policy | -messaging`, inline). The schedules screen's "edit in the classic panel" button now opens the schedules tool itself
(`CLASSIC_EDIT_HREF`, from the table) instead of the tools hub.

Source of the ids: WisKey 2.0.1-rc.10 (`C:\hik intercom`, `origin/codex/wiskey-mac-m12-policy-b-2026-11-02`), the router of
`custom_components/hikvision_intercom/frontend/panel.js` (read-only extract): tabs `overview users devices events sync tools
camera_wall`; tools `clock_options media_options whatsapp_templates profile_options permission_directory workflow_center
platform_center operations_center investigations camera_wall identity_lifecycle data_quality access_reviews access_comparison
guest_templates visit_requests fleet_alerts users devices sync audit health schedules access_control`. rc.10 adds `data_quality`,
`access_reviews`, `access_comparison` to the rc.37-era list of `WISKEY_EMBED_API_V1.md`. Where each capability lives was located by
the command each panel element calls (e.g. `conflicts/review|resolve` in `syncView`, `users/adopt` in the users tab's import
dialog, `stations/technical_*` / `technical_codes_*` / `technical_program_*` in the devices tab's `stationSettings`).

## Gaps - for the WisKey-team prompt (plan Q-WK-8)

1. **No stability promise** for any tab / tool id: the contract says "use the installed instance's ready catalog". Ask WisKey to
   freeze the ids above (rc.10 router) and announce renames.
2. **No address finer than a tab** for: a station's settings dialog and its sections (technical, door programs, hold-open, public
   codes, relays, rescan, clock refresh) - all reached through `devices`, then a click; the conflict review of one person / station
   (`sync`); the unmanaged-users import dialog (`users`, `_dialog = import`); a person's details and access scenario (`users`). Ask
   for optional `station=<id>`, `section=<id>`, `user=<id>` and `dialog=import|conflict` parameters (ignored when unknown, never
   granting access).
3. **No id at all** (opened from the hub or the toolbar only): unified search (`search/query`, row 83), appearance (row 86, a hub
   dialog), panel security / idle lock (row 88), event trace and support bundle (row 85), the personal renewal portal
   (`wiskey-renewal`, a separate panel, row 10), and the integration's own options flow (where a service-write grant would be set,
   Q-WK-4). These rows stay without a link.
4. **Capability gating is not in the catalog**: some tools exist only with a WisKey capability (`users/data_quality`,
   `visits/list`, `platform/get` ...). Arx sees that only after the handshake; before it, a link can open the panel's default screen.
   Ask that `wiskey:ready` stay the authority and that a refused deep link post a `wiskey:location` with the screen it fell back to
   (it does today) plus, optionally, a reason.

## Edits in files other agents own (one mount each)

- `frontend/src/screens/wiskey-stations-views.ts` (talk / call row agent): `import '../components/wk-deep-links';` and one line
  `<wk-deep-links place="station"></wk-deep-links>` at the end of the technical section. Nothing in the call row.
- `frontend/src/screens/wiskey-stations.ts` (station ops may touch it): one line in the ready page's actions,
  `<wk-deep-links slot="actions" place="stations" mode="menu">`.
- Not touched: `wk-station-live.ts`, `system-wiskey-diagnostics.ts`, `wiskey_auto_install.py`, `bridge_install.py`, the security
  tab's WisKey section, `services/wiskey_direct_catalog.py`, contracts, any inbound-call component.

Other edits: `wiskey-people.ts` (import + one actions line), `wiskey-schedules.ts` (import + one actions line),
`system-access-control.ts` (import, one line under the segment body, a margin rule), `access-control/schedules-logic.ts`
(`CLASSIC_EDIT_HREF` from the table), `shell/nav.ts` (`applyWiskeyHidden` tells the WisKey-area listeners when `ui.hide_wiskey`
changes, so links drawn before the settings answered disappear at once), `tests/evidence-access-schedules.spec.ts` (pins
`#/wiskey/tools/schedules`).

## Tests

- `frontend/tests/unit-wiskey-deeplinks.spec.ts` (node): every target is an rc.10 router id; every E row and M rows 3 / 34 / 36 are
  covered; labels Hebrew without a platform name; unknown ids -> root; every link, through the shell's own `wiskeyRoute`, opens the
  embed on exactly its tab / tool with the Arx screens set either way; the permission rule; administrator-only tools; the catalog
  filter; what each place offers.
- `frontend/tests/evidence-wiskey-deeplinks.spec.ts` (browser, mocked backends + the fake v1 panel): the stations menu, the drawer's
  technical links, the station settings link reaching the panel although the stations screen is Arx, a caller without the technical
  part, the catalog filter after a handshake, the people menu, the schedules menu and edit button, a station-scoped operator, the
  Settings segments, a station-scoped administrator and the hidden area, the phone (inside the viewport, 44 px rows).
  Each landing test asserts the frame address the fake panel was asked for (`tab` / `tool`).
- `frontend/tests/pixel-wiskey-deeplinks.spec.ts` (two "pixel-stable" shots, classic light, 1440 and 390): the open stations menu,
  the drawer with the technical links open.
- Existing pixel baselines that show the new icon / line (stations, people, schedules, the drawer, the Settings page) are refreshed
  on the runner in this branch.

Results and receipts: see the commit message / the closing report of the branch.

## Rollback

Revert the branch's commits. No data, setting or server state is involved.
