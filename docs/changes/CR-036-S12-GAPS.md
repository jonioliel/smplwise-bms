# CR-036 S12 - gap analysis of stage 1 (what the 49-row inventory asks vs what is built)

Branch `pilot/WISKEY-s12-gaps` from `origin/integ/248` @ `10620d30` (S0-S4, S6, S7, S8, S10 merged). The S9 branch
`pilot/WISKEY-native-s9-schedules` @ `e980f203` was READ (not merged). Nothing here contacted a WisKey, Home Assistant, station or
device. Evidence marks as in CR-036: **V** read in code on this tree (or on the S9 branch), **R** stated by a slice's notes,
not re-checked line by line.

## 0. The owner decision this analysis applies

**2026-10-12 (binding): stage 1 includes ALL WisKey capabilities, no splitting.** Read as: (a) every row marked `yes` /
`yes (view)` must be complete, not "mostly"; (b) the halves that CR-036 section 1 had pushed to "later" next to a stage-1 half
("yes (view) / later (edit)") and the rows marked `later` are now stage-1 work too - they are listed in section 3 with the slice
that owns each, because most of them are WRITES (S11 / the write phase, owner answer 2 of 2026-10-11) or need WisKey deliveries
(W1 / W2 / W10). This slice (S12) builds the missing READ-ONLY pieces and the Settings slice; it does not start writes.

Rows marked `no` (stay in WisKey: engineering tools, installer platform, panel security, appearance, integration options) and
`X` (not needed in Arx) are listed in section 4 with the reason they are still out; the owner decision names "capabilities",
and those rows are WisKey's own administration of itself, replaced in Arx by Arx's own RBAC / audit / settings. That reading is
an assumption, recorded as open question 1 of the final report.

## 1. Rows marked `yes` / `yes (view)` - status on integ/248 (+ S9)

Legend: **built** = native, behind its switch, with tests; **partial** = native, with the gap named; **pending merge** = built on a
pushed branch not yet in integ/248; **write** = belongs to S11 (not a read-only gap).

| # | Row | Stage 1 | Status | Where (V) | Gap left |
|---|---|---|---|---|---|
| 1 | Overview | yes (polish) | built | `wiskey-overview.ts`; S1 removed `last_access` / people counts (D-006) | none for stage 1 (KPI tiles dropped on purpose, D-006) |
| 2 | Door release from a station card | yes (via CR-033) | built on the interim transport | S6 `wiskey-stations-actions.ts`, `POST /intercom/stations/{id}/release` | per-door authority = CR-033 (not merged); gate move = S11 (write) |
| 3 | Call answer / reject / hang up | yes (as is) | built | S6, `POST /intercom/stations/{id}/call` | `access.call` gate = S11 (write) |
| 5 | TTS announcement | yes (as is) | built | S6 `wk-announce-dialog`, `announceToStations()` | `access.call` gate + server-side "inside the caller's scope" for all-stations = S11 |
| 8 | Events list, filters, load more | yes (polish) | built | S8 `wiskey-events.ts`, `events-feed.ts` | KPI tiles (no totals from WisKey without a scan) and a place tree (needs CR-033 station placement): R S8 notes; not read-only gaps this slice can close without a scan or CR-033 |
| 9 | Event detail with portrait | yes | built | S8 `wiskey-event-drawer.ts`; `GET events/{id}`, `events/{id}/portrait` (audited, `access.event_portrait_audit` default on) | drawer deep links to the person / station (S8 gap) - person page has no deep-link route yet |
| 10 | Event export (CSV) | yes (export only) | built | S8 `wiskey-events-export.ts`; `GET events/export.csv` (`access.events.export`, audited `intercom.events.export`: filters, row count, columns, never a row; no card column) | none |
| 13 | People directory, filters, sort, paging | yes | built | S7 `wiskey-people.ts`, `people-logic.ts`; server filters group / station / rights / state / credential / profile, snapshot paging | "expiring soon" filter (not a WisKey state; needs a WisKey filter or a longer scan); saved filter per user (`/me/prefs` is a closed key list) |
| 14 | Person details (read) | yes | built | S7 `wiskey-person-drawer.ts` (groups, validity / timing, per-station sync state) | none |
| 15 | Create / update / delete person | yes (re-gate) | write | person editor unchanged | S11 |
| 16 | PIN generate | yes (re-gate) | write | unchanged | S11 |
| 17 | Card capture | yes (re-gate) | write | unchanged | S11 |
| 19 | Person photo | yes (view) | built | S7 `people/{id}/photo` (sensitive, audited `intercom.person.photo_view`) | upload = later half (section 3) |
| 20 | Timing / validity | yes (view) | built | S7 drawer "validity and timing" | edit = later half (section 3) |
| 22 | Groups and profile fields | yes (view) | built | S10 `system-access-groups.ts` (Settings), S7 drawer groups tab | member counts per group (no count in WisKey's read; a scan); edit = section 3 |
| 29 | Stations list and details | yes | built | S6 `wiskey-stations*.ts` | place tree derived from the devices tree until CR-033 placement; "events of this station" link: **built by S12** (section 2, G5) |
| 30 | Station relays and door mapping | yes (view) | built (relays) | S6 drawer (relays from the overview's `integrated_locks`) | door map / placement = CR-033 D1 / D2 |
| 31 | Door programs | yes (view) | pending merge | S6 drawer (per station); S9 `wiskey-schedules.ts` (per door, week grid) | merge S9; S6 drawer weekly lines were printed reversed in RTL: **fixed by S12** (G6) |
| 32 | Hold-open schedules | yes (view) | partial | S6 / S9 show the program and the saved drafts from the programs read; `GET stations/{id}/doors/{door}/hold` (draft, active, blocker, zone) has no screen (S9 decision: not needed for the view) | the per-door hold draft / blocker view - owner of the S9 screen after its merge (not built here: it would edit S9's unmerged files) |
| 33 | Public codes | yes (presence only) | built | S6 drawer, S9 pill (`configured` true / false / null, never a value) | none (W7 still open: whether WisKey returns values to an admin caller) |
| 35 | Device schedules, plans, operations status | yes (view) | pending merge | S9 (library, proposals, last check job state) | merge S9; the operations journal / claims are not shown (S9 gap 6) |
| 39 | Health per station, history | yes (view) | built | S10 `system-access-status.ts`, `system-access-health.ts` | `health/refresh` is a device poll (section 3) |
| 40 | Sync status and conflicts | yes (view) | built | S10 (counts only; conflicts for installation-wide administrators) | resolve / sync now = section 3 (writes to stations) |
| 41 | Fleet alerts | yes (view) | built | S10 (kind filter, muted ones, paging) | acknowledge / mute = section 3 |
| 42 | WisKey admin audit | yes (view, admins) | partial -> **built by S12** | S10 `system-access-audit.ts` filtered by station and action only | period and person filters: **built by S12** (G1); export of WisKey's audit (`audit/export`) stays out (not in stage-1 text) |

Also asked by CR-036 for stage 1 and not a numbered row:

| Item | CR-036 | Status | Gap |
|---|---|---|---|
| Per-screen switch, Settings only | 3.8, S12; owner answer 1 of 2026-10-12 | built (`access.ui.overview / events / people / stations`, S9 adds `schedules`) in Settings -> General -> "מתגי מסכי כניסה"; no header button anywhere (checked: no screen writes `access.ui.*`) | a guard test that no screen header gets a switch: **built by S12** (G2) |
| Stations-screen display settings | S6 settings (`access.call_hint`, `access.talk_button`, `access.announce_scope`, `access.announce_phrases`) | PATCH `/settings` only (integration decision 3 of 2026-10-12: accepted until this slice) | real controls: **built by S12** (G3) |
| Parity report (side by side) | 6.2 | not built | **built by S12** (G4): `GET /access-control/parity` + the card "השוואה למסכי האינטרקום" next to the switch + `scripts/wiskey_parity_report.py` on the fake |
| Fake-based full suite | S13, section 5 | the screens' specs exist per slice; the committed live fixture `frontend/tests/fixtures/wiskey_fake_ha.py` lists only `events/list`, `users/get`, `users/query`, so the status page, the event detail / picture / export and the groups never ran end to end against the real backend | **S13 prep by S12** (G7): one suite manifest for every new screen + the parity three-identity matrix on the fake; the live fixture gap stays listed (section 5) |
| No platform names on operator screens | 2.6 | the area's rail label still reads "WisKey" (`shell/nav.ts` RAIL); other native screens' fallback panels still name WisKey in places (S6 gap 8) | not changed here: the rail label is in every pixel baseline that shows the rail - open question 2 of the final report |

## 2. What S12 builds (this branch)

| Id | Piece | Rows | Kind |
|---|---|---|---|
| G1 | Intercom action log: a period filter (24 h / 7 days / 30 days, sent as `start` / `end`) and a person filter (a person on a record narrows the log to them, `user_id`; a chip clears it) | 42 | read-only |
| G2 | Guard: no screen outside Settings writes an `access.ui.*` setting (node unit spec over the sources) | switch | test |
| G3 | Stations-screen display settings as real controls in Settings -> General -> "מתגי מסכי כניסה" (the card "תצוגת מסך התחנות"): call hint, talk button, announcement targets, quick phrases (one per line, 8 x 160 kept) | S6 settings | settings |
| G4 | Parity report (CR-036 6.2): counts and keyed digests per screen (stations, people, entry log of a window, groups, schedule library, fleet alerts) of the native view vs a direct unfiltered read of the same WisKey command, the outcome per screen and the rule that filtered; for the caller or (with `system.configure`) as another Arx user; plus the side-by-side checklist per screen with links to the native screen and the classic panel | 6.2 | read-only |
| G5 | Stations drawer: "the entry log of this station" link (`#/wiskey/events?station=<id>`), offered only while the entry log is the native screen and the caller holds `access.events.read` | 29, 8 | read-only navigation |
| G6 | Fix: the stations drawer's weekly hours are left-to-right isolates (they printed "17:00–08:00" in RTL - S9 gap 3) | 31 | bug fix |
| G7 | S13 prep: `frontend/tests/suites/wiskey-native-stage1.json` (every backend test and spec of the native screens, the commands to run them on the runner) + the AT317 procedure pointing at it; security review note of this branch | S13 | tests / docs |

### 2.1 Decisions taken while building (safest reading, recorded)

1. **Where the switch and the new cards live.** Owner answer 1 (2026-10-12) puts the switch "in Settings > access control > display";
   the same day the owner renamed the General sub-tab that holds it to "מתגי מסכי כניסה" (integration decision 2). Read together: the
   switch STAYS in Settings › כללי › מתגי מסכי כניסה (never in a screen header - a unit guard now fails otherwise), and the new display
   card and the parity card join it there. Not moved into the "בקרת כניסה" Settings tab: that would contradict the fresh rename, and every
   pixel baseline of that tab's segment strip (S10, 40 images) would change. CR-036 2.6's "בקרת כניסה -> תצוגה" is superseded by the rename
   (open question for the owner in the final report).
2. **The parity card is a button, not a poll** (15-30 WisKey reads per report on the shared read lane). One report at a time.
3. **Another user's view** (`as_user`) needs `system.configure`: it is the three-identity check of CR-036 6.2 step 2 without signing in
   as each identity. Counts only.
4. **The classic link** is offered only for the embedded panel's own tabs (overview, events, people, devices); the schedules screen
   (S9) has no counterpart tab there.
5. **The station's entry-log link** is offered only while the entry log is the native screen (the embedded panel ignores the filter).

### 2.2 Interface for the next slices

- `GET /api/v1/access-control/parity?as_user=&hours=` (1..168, default 24): `{state, configured, last_error, fetched_at, parity: {window_hours,
  window {start, end}, subject {user_id, display_name, self}, screens [{screen, feature, permission, route, source {count, complete,
  digest} | null, expected_count, native | null, outcome, rule, reason}], summary {<outcome>: n}}, sync}`. Screens: stations, people,
  events, groups, schedules, alerts (`services/intercom_parity.SCREENS`). A new native screen adds one method + one row there.
- `frontend/tests/access-parity-mocks.ts` + `fixtures/access_parity_wire.json` (shape pinned by `backend/tests/test_access_parity_wire.py`).
- S9, when merged: its `access.ui.schedules` row joins `ACCESS_SCREENS` (its own commit); the parity card's checklist and the
  schedules row's "Arx" link then appear by themselves (they follow `WISKEY_SCREENS`).
- Pixel baselines this branch changes (the runner regenerates them; NOT generated here): `pixel-access-status` `status-classic-audit`
  (the period filter and the person buttons), `pixel-wiskey-stations` images that show the drawer's weekly hours (the RTL fix) - and the
  new `pixel-access-s12` set (none exist yet).

## 3. "Later" halves and rows pulled into stage 1 by the owner decision (owners, not built here)

| # | Capability | Kind | Owner slice | Blocked by |
|---|---|---|---|---|
| 4 | Two-way audio (talk) natively | media | S18 | W10 (audio hook not tied to the panel's WS), D-001 |
| 6, 7 | Live station video, camera wall | media | S18 | D-002, W10, station-credentials single source |
| 12 | Unified search (`search/query`, READ in the catalog) | read | S17 | a typed read + the people / events filters over its kinds (it returns people and events) |
| 18 | Cards add by number / remove / USB reader | write | write phase (S15) | W2 shapes; fakes |
| 19 | Photo upload (`users/update` photo) | write | write phase | W2 |
| 20 | Timing / validity edit, temporary cancel | write | write phase | W2 |
| 21 | Activate / deactivate, archive / unarchive | write | write phase | W2 |
| 22 | Groups / profile fields apply (`profiles/settings_preview` -> `settings_apply`) | write | write phase | W2 (whether preview returns a token) |
| 24 | Access scenario / compare / reviews / data quality / duplicates (`users/access_scenario`, `access_compare(_options)`, `access_reviews`, `access_review_preview`, `data_quality`, `duplicate_check` - all READ in the catalog; `access_review_decide` is a write) | read (+1 write) | S17 | typed reads, projection rules per person (they carry people), fakes |
| 25 | Identity lifecycle (`users/lifecycle` READ; `workflows/renew_*` writes) | read + write | S17 / write phase | the WisKey dual-approval question (row 44) |
| 26 | Guest templates (`guest_templates/get` READ), visits (`visits/list`, `visits/operators` READ; `visits/create / request / decide` writes) | read + write | S17 / write phase | "second operator" approval under Arx authority needs its own design (CR-036 row 26) |
| 31, 32, 33 | Door programs / hold-open / public codes edit | door-affecting write | write phase (S16) | W2; owner approval per live write (device-write rule) |
| 35 | Schedule edit / deploy | door-affecting write | write phase (S16) | W2 |
| 39 | `health/refresh` (a device poll) | device poll | write phase | owner approval per live run |
| 40 | Conflict resolve, sync now (`conflicts/review` is non-READ in the catalog) | write to stations | write phase (S16) | W2 |
| 41 | Alert acknowledge / mute (`fleet/alerts_action`) | write | write phase | - |
| 43 | Operations centre (`operations/query` READ), jobs (`jobs/list` READ, administrator-only in WisKey), investigations (`investigations/query` READ, administrator-only) | read | S17 | typed reads; they may carry people (operations) |
| 23 | Bulk edit, CSV import / export of people | write + export | write phase | stays in WisKey per CR-036 until the owner says otherwise (listed as "no (stage 1)") - see section 4 |
| 27 | WhatsApp | write | WhatsApp slice (running in parallel) | W11 |

The stage-2 READ views of rows 12, 24, 25, 26, 43 are S17's (CR-036 4.1, about 16 agent-hours); none of them is in this slice's
build list (the lead's priority list for S12 is the six status / events / groups / audit pieces, all of which exist or are closed
here). Their commands are READ in the pinned catalog (checked above, `read_command_for_security_guard_and_api_contract`), so they
can ride the read channel once typed.

## 4. Rows still outside Arx and why (`no` / `X`)

| # | Row | Why it stays |
|---|---|---|
| 11 | Event trace / support / history inspect | engineering tools of WisKey (`events/trace_*` need `events: manage`) |
| 23 | Bulk edit, CSV import / export | CR-036: stays in WisKey in stage 1 - now pulled in by the owner decision only if the owner reads "capabilities" that widely (open question 1) |
| 28 | Personal renewal portal | owner 2026-10-03: stays in WisKey as is |
| 34, 36, 37, 38 | Station technical settings, platform, clock, media options | installer platform of WisKey; Arx has its own media settings |
| 44 | Workflow centre, dual approval, backups | owner: Arx RBAC is the authority (no WisKey dual approval for Arx actions); backups stay in WisKey |
| 45, 46, 47 | Panel permissions, panel security, appearance | replaced by Arx RBAC, Arx sessions / second factor, Arx skins |
| 48, 49 | Acceptance / upgrade / support bundle; integration options | engineering; the importer (CR-035) owns installation |

## 5. Gaps that stay open after S12 (for the lead)

1. **Merge S9** (`pilot/WISKEY-native-s9-schedules` @ `e980f203`): rows 31 / 35 are built there. Its own notes list the S6 deep link
   to schedules (`#/wiskey/schedules?door=<station>:<relay>`) as a hand-off; S12 adds only the events link (G5) because the schedules
   target is not on this tree.
2. **Live fixture coverage** (`frontend/tests/fixtures/wiskey_fake_ha.py`): it serves three reads of the 25. The status page, the
   event detail / picture / export and the groups never ran end to end against the real backend; the mocked specs plus the wire
   test (`test_access_control_wire.py`) are what stands in. Extending the fixture means re-deriving every rc.37 shape for its own
   stations (gate / lobby / office / store) - an S13 item, listed in the suite manifest as NOT_RUN.
3. **Row 32 hold draft view** and **row 22 member counts**: see the table above.
4. **S11** owns every `write` row and the gate moves (`access.call`, the station chain for people writes).
5. **CR-033** owns the door authority, the station placement (place trees in S6 / S8 / S10) and `door_opener` + `access.call`.
6. **S17 / S18** own the stage-2 reads and the media rows (section 3).
