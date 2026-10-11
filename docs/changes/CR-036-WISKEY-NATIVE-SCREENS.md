# CR-036 - WisKey native screens: the panel's screens run in Arx, the intercom integration is reached only through Arx

Status: PROPOSED (plan and documents only, 2026-10-11). No product code, no migration, no device, door, HA user, token or
secret was touched to write this. Branch `pilot/WISKEY-native-screens-plan` from `origin/main` 3e804087 (2.4.4).

Number note: CR-035 is already taken by the WisKey importer (`services/wiskey_import/__init__.py` in the uncommitted
`pilot/WISKEY-importer` worktree cites `docs/changes/CR-035-WISKEY-IMPORTER.md`). CR-033 (door path) and CR-034 (HMAC
rotation) are on `origin/pilot/WISKEY-CRs`. This CR is therefore CR-036.

## 0. Owner goal and how this CR reads it

Owner, 2026-10-10: "the first stage: absorb WisKey so that the screens run through Arx and the intercom integration goes
through Arx".

Read as four rules for stage 1:

1. **Screens:** every WisKey panel screen an Arx operator uses day to day is an Arx screen (Arx shell, Arx design tokens,
   Hebrew, RTL), not the embedded `/hikvision-intercom?embed=1` iframe.
2. **Integration through Arx:** the browser never talks to WisKey. Every call goes browser -> Arx add-on (typed endpoint,
   Arx RBAC, Arx audit) -> WisKey WebSocket command. No generic proxy.
3. **Authority:** Arx RBAC is the single authority for actions started from Arx (owner decision 2026-10-03, item 5 of
   `private/wiskey-foldin/WISKEY_TEAM_BRIEF.md`). WisKey keeps its own panel policy for its own panel only.
4. **WisKey stays the engine.** The integration keeps running inside HA; Arx installs it (importer, CR-035, separate
   branch). The domain rename to `smplwise_intercom` is a later, separate release. Stage 1 ports no backend logic
   (no access engine, no schedule compiler, no ISAPI client in Arx), so CR-005 section 3 ("WisKey is the writer") still holds.
5. **Rollback:** the iframe stays selectable per screen until each native screen is verified (section 6).

Precedence (CLAUDE.md): an approved change request, then `MASTER_SPEC_HE.md` and `docs/security/`, then `AGENTS.md`, then
this document. This CR is binding only once the owner approves it. Contradictions are recorded in section 8, not resolved.

### 0.1 Sources read for this CR

| Source | Where |
|---|---|
| Gate A, identity, media, revised plan, contract.2/.3 | `docs/integrations/wiskey/NATIVE_GATE_A_HE.md`; `ARX_DECISIONS_REPLY{,_2,_3}_HE.md` (on `main`; the branch `pilot/wiskey-native-gateA` no longer exists) |
| Shared decision log D-001..D-008 | `private-evidence/wiskey-arx-contract-rc37-4/.../DECISIONS_WISKEY_ARX.md` (contract.4, latest) |
| Scope, placeholder and data rules | `private-evidence/wiskey-arx-contract-rc37/SCOPES.md`, `DATA_MODEL.md`, `ADAPTER.md` |
| Static command catalog (238 commands) | `.../rc37-4/.../schemas/commands.static.json` (byte-identical across contract.1..4) |
| WisKey panel source (reference only, not copied) | `private-evidence/wiskey-native-rc37/frontend/src/` (`panel.ts`, `panel-location.ts`, ~60 components) |
| Owner decisions and team brief | `private/wiskey-foldin/WISKEY_TEAM_BRIEF.md`, `MAPPING.md`, `OPINION_HE.md`, `WX2_SUMMARY_HE.md`, `CODEX_HANDOFF_CONTINUOUS_2026-10-10_HE.md`, `CODEX_SEND_PACKAGE_2026-10-10_HE.txt` (OWNER01 answers), memory note of 2026-10-03 |
| Door path (native door opening) | `origin/pilot/WISKEY-CRs` CR-033; code on `origin/pilot/WXD-wave1` (11eecbcf) |
| B0 (diagnostics, last_access removal, channel split) | local branch `pilot/wiskey-b0` (6dc15030, based on 0.1.150, never merged) |
| Arx code facts | `origin/main` 3e804087: `routers/access_control.py`, `services/intercom_{sync,client,capture}.py`, `services/wiskey_camera.py`, `routers/access.py`, `roles.json`, `routers/settings.py`, `frontend/src/screens/wiskey-*.ts`, `frontend/src/shell/nav.ts`, tests |

Evidence marks: **V** = read in code (Arx at 3e804087, or WisKey rc.37 reference source); **R** = stated by a document,
not checked; **W?** = WisKey behaviour that is **not verified** (nobody ran it, or the field was not seen in code);
**D** = design proposal of this CR.

Nothing in this CR was run against a live WisKey, HA or station. Every live behaviour is NOT_RUN.

## 1. Inventory: every WisKey panel screen and function today

The WisKey panel (rc.37, V `panel-location.ts`) has 7 tabs (`overview, users, devices, events, sync, tools, camera_wall`)
and 24 management tools behind `tools`, plus dialogs (person details, camera, call/audio, TTS, card capture, reauth,
unified search). Its authorization model: 5 areas (`overview, users, events, stations, management`) x `none|view|manage`,
a station scope, field levels (`phone, photo, credentials, profile, access`), HA admin bypass (V `panel_permissions.py`).

Arx state at 3e804087 (V): native screens exist only for **overview, events, people (+ editor, card capture, release / call /
TTS dialogs)**. `access.ui.overview|events|people` chooses `wiskey` (iframe, the default) or `smplwise` (native)
(`routers/settings.py`, `shell/nav.ts` `WISKEY_SCREENS`). Every other tab is always the iframe.

Legend for "Arx today": **N** native in Arx; **N-** native but incomplete (gaps listed); **I** iframe only; **X** not
needed in Arx. "Stage 1": **yes** = this CR builds it; **later** = stage 2 (after stage 1 is verified); **no** = stays in
WisKey's own panel or is dropped.

### 1.1 Daily operation

| # | WisKey screen / function | WisKey commands (V catalog) | Arx today | Stage 1 | Notes |
|---|---|---|---|---|---|
| 1 | Overview ("מרכז הכניסה"): station cards, online, ringing, KPIs | `overview`, `overview/summary`, `subscribe` | N | yes (polish) | Arx shows stations, stats, stills, ringing. B0 (unmerged) removes `last_access` person data from the background cache (D-006) |
| 2 | Door release from a station card | `stations/test_unlock` | N | yes (via CR-033) | Today installation-level `access.release`. WXD wave 1 (unmerged) moves it to `door_authority` + station scope. "Sent", never "opened" (decision 22) |
| 3 | Call answer / reject / hang up | `media/signal` | N | yes (as is) | D-004 existing write. `media/call` (outgoing call) is **I** |
| 4 | Two-way audio (talk) | `audio/start`, `audio/send` (outside the static catalog, V `audio_api.py`) | I | later | Session is tied to the WisKey WS connection object (V). Not possible over the Arx service channel without a WisKey change (D-001). Stays iframe ("פתח בחלון האינטרקום") |
| 5 | TTS announcement | `tts/engines`, `tts/start` (outside the static catalog) | N | yes (as is) | D-004 existing write |
| 6 | Camera of a station (live) | HA camera proxy, `mse`/`rtc` views (signed path) | N- | later | Arx shows stills through its own go2rtc (`smplwise_wiskey_<station>`). Live video waits for D-002 (open) and the station-credentials single source (brief 5.5) |
| 7 | Camera wall | same | I (Arx has its own camera wall for NVR cameras) | later | Same as 6 |
| 8 | Events / activity ("פעילות"): list, filters, load more | `events/list` | N | yes (polish) | Filters exist; event detail with portrait is missing |
| 9 | Event detail (portrait, card) | `events/detail` | I | yes | Portrait under a field permission (section 2.3) |
| 10 | Event export / print / report / saved reports | `events/export`, `events/print`, `events/report` | I | yes (export only) | CSV export through Arx, audited. Print = browser print of the Arx list. Saved reports: later |
| 11 | Event trace / support / history inspect | `events/trace_*`, `events/support`, `events/history_inspect` | I | no | Engineering tools; stay in WisKey |
| 12 | Unified search (people, events, actions) | `search/query` | I | later | Arx people search covers names and employee numbers today |

### 1.2 People, credentials, groups

| # | WisKey screen / function | WisKey commands | Arx today | Stage 1 | Notes |
|---|---|---|---|---|---|
| 13 | People directory, paging, text search | `users/query`, `users/list` | N- | yes | Arx always sends an empty query and searches itself (max 10 x 200). Missing: server filters `group, profile, station, rights, state, credential`, sort, `snapshot`/`stale` paging |
| 14 | Person details (read) | `users/get` | N- | yes | Missing: groups, profile fields, validity/timing view, per-station `sync_state`, photo |
| 15 | Create / update / delete person | `users/create`, `users/update`, `users/delete` | N | yes (re-gate) | D-004 existing writes; move onto station scope + field permissions (slice S11) |
| 16 | PIN generate | `users/pin_generate` | N | yes (re-gate) | PIN shown once, never logged (V). `users/pin_check` (duplicate check) is **I** |
| 17 | Cards: reader capture | `cards/reader_capabilities`, `cards/capture_*` | N | yes (re-gate) | D-004 existing write |
| 18 | Cards: add by number / remove / USB reader input | `cards/add`, `cards/remove` | I | later | New write (section 4.2, question 2) |
| 19 | Person photo (view, upload) | `users/photo_get`; `photo` field of `users/update` | I | yes (view) / later (upload) | View under a field permission |
| 20 | Person timing and validity (user timing, temporary validity, temporary cancel) | `users/update` fields `access_timing_*`, `valid_*`; `users/temporary_cancel` | I | yes (view) / later (edit) | Edit is a new write |
| 21 | Activate / deactivate, archive / unarchive | `users/set_active`, `users/archive`, `users/unarchive` | I | later | New write |
| 22 | Groups (person groups) and profile fields | `profiles/settings_get`, `profiles/settings_preview`, `profiles/settings_apply`, `profiles/settings_update`, `profiles/versions*`, `users/group_suggestions` | I | yes (view) / question 2 (edit) | Groups live in WisKey's "profile options" tool. Arx shows them read-only first |
| 23 | Bulk edit, CSV import / export | `users/bulk_*`, `users/csv_*`, `jobs/bulk_create`, `jobs/csv_create` | I | no (stage 1) | Stays in WisKey. CSV export may come later through Arx with audit |
| 24 | Access scenario ("can X open door Y now?"), access compare, access reviews, data quality, duplicates | `users/access_scenario`, `users/access_compare*`, `users/access_review*`, `users/data_quality`, `users/duplicate_check` | I | later | Valuable, read-mostly; stage 2 |
| 25 | Identity lifecycle (expiring access, renewals) | `users/lifecycle`, `workflows/renew_*`, `users/bulk_renewal_preview` | I | later | |
| 26 | Guest templates, visit requests, visit approvals | `guest_templates/*`, `visits/*` | I | later | Visit approval ("second operator") is a WisKey policy flow; under Arx authority it needs its own design |
| 27 | WhatsApp (send, templates, history) | `whatsapp/*` | I | no | Owner: WhatsApp unchanged. The message builder embeds the PIN (R, MAPPING 4.4); must not be ported casually |
| 28 | Personal renewal portal (`wiskey-renewal`, ordinary HA users) | `renewal/*` | X | no | Owner 2026-10-03: stays in WisKey as is |

### 1.3 Stations, doors, schedules

| # | WisKey screen / function | WisKey commands | Arx today | Stage 1 | Notes |
|---|---|---|---|---|---|
| 29 | Stations list and details (devices tab): model, firmware, online, sync, last error, relays | `stations/list`, `stations/get`, `stations/inventory` | N- | yes | Arx shows cards on the overview only; no station detail page. Technical fields only with WisKey `stations` area (SCOPES) - the service channel sees them all, so Arx gates them (section 2.3) |
| 30 | Station relays and door mapping | `stations/technical_relays`, overview `integrated_locks[]` | I (WXD wave 1 adds a door map in Settings) | yes (view) | Door map and placement are CR-033 D1/D2 |
| 31 | Door programs (hold-open programs on the device) | `stations/technical_program_list`, `technical_program_save`, `technical_program_action` | I | yes (view) / later (edit) | Physical, autonomous: any write is "door-affecting" (section 4.2) |
| 32 | Hold-open schedules | `stations/technical_hold_get`, `technical_hold_save`, `technical_hold_delete` | I | yes (view) / later (edit) | Same |
| 33 | Public codes (station-wide codes) | `stations/technical_codes_get`, `technical_codes_write` | I | yes (presence only) / later | **W?** whether `technical_codes_get` returns code values. Arx shows only "code set / not set" and never caches a value |
| 34 | Station technical settings (update, clock refresh, rescan) | `stations/technical_get`, `technical_update`, `clock_refresh`, `rescan` | I | no (stage 1) | Installer tools; stay in WisKey |
| 35 | Device schedule library, deployment plans, schedule operations | `schedules/*` (28 commands) | I | yes (view: list, plans, operations status) / later (edit) | Arx already has its own schedules (CR-014) for HA entities; WisKey device schedules are a separate list ("לוחות זמנים של דלתות") |
| 36 | Station onboarding, lifecycle review, platform config, import / export, retention, webhooks, maintenance queue | `platform/*` (35 commands) | I | no | Installer / admin platform; stays in WisKey |
| 37 | Clock / NTP settings | `clock/*` | I | no | Stays in WisKey |
| 38 | Media options (go2rtc, transport) | `media/settings_*`, `media/provider_*` | I | no | Arx has its own media settings |

### 1.4 Health, sync, audit, management

| # | WisKey screen / function | WisKey commands | Arx today | Stage 1 | Notes |
|---|---|---|---|---|---|
| 39 | Health (per station, history, refresh) | `health/get`, `health/history`, `health/refresh` | I | yes (view) | "מצב בקרת כניסה" in Settings. `health/refresh` is a device poll: later |
| 40 | Sync status and conflicts | `sync/status`, `sync/diagnostics`, `conflicts/list`; writes `sync/*`, `conflicts/resolve*` | I | yes (view) / later (resolve, sync now) | Conflict resolution writes to stations |
| 41 | Fleet alerts | `fleet/alerts`, `fleet/alerts_action` | I | yes (view) / later (ack) | Could later feed the Arx notification centre (CR-018) |
| 42 | Admin audit (WisKey's own) | `audit/list`, `audit/export` | I | yes (view, admins) | Under the service identity WisKey's audit shows the service user for Arx actions; Arx's own audit is the record for Arx actions (D-004). The WisKey list is shown so panel-side actions stay visible |
| 43 | Operations centre, jobs, checkpoints, investigations | `operations/query`, `jobs/*`, `investigations/query` | I | later | |
| 44 | Workflow centre: dual approval, transfers, inventory, backups | `workflows/*`, `backups/*`, `jobs/approval_*` | I | no | Owner: Arx RBAC is the authority, no WisKey dual approval for Arx actions. Backups stay in WisKey (admin) |
| 45 | Panel permissions ("access control" tool), permission directory | `authorization/settings_*`, `authorization/preview`, `permissions/directory` | I | X / no | Replaced by Arx RBAC for Arx users. Kept in WisKey for its own panel. A one-time read-only "who has what in WisKey" report may help the owner map grants (later) |
| 46 | Panel security: idle lock, reauth, elevation | `security/*` | I | X | Not used for Arx actions (owner decision). Arx sessions and second factor (CR-011) cover Arx |
| 47 | Appearance (WisKey v4 theme) | `appearance/*` | I | X | Arx skins apply |
| 48 | Acceptance, upgrade readiness, support bundle, fleet inventory export | `acceptance/*`, `upgrade/readiness`, `support/bundle`, `fleet/inventory_export` | I | no | Engineering; stays in WisKey |
| 49 | Integration settings (HA options flow) | config entry options | I | no | Stays in WisKey/HA; the importer (CR-035) owns installation |

Counts: 49 rows. Native today (N or N-): 12 rows (1, 2, 3, 5, 6, 8, 13-17, 29). Stage 1 builds or completes 25 rows (most
as read-only views); 10 rows are later; 14 stay in WisKey or are not needed.

## 2. Design rules that apply to every stage-1 screen

### 2.1 Data path and identity (per-operator requirement)

- **Transport:** Arx add-on -> HA core WS -> `hikvision_intercom/*`, using the add-on's channel (today `SUPERVISOR_TOKEN`,
  V). With B0 merged, reads use a separate background channel (read-only allowlist: `overview`, `subscribe`,
  `authorization/session`) and the new screen reads use a **read channel** that has no write command in its allowlist (D);
  writes stay on the write channel (D-004).
- **What WisKey sees:** the service identity. Supervisor = WisKey admin is **R/W?** (derived from HA and WisKey code, never
  checked on the installation). Consequence: WisKey returns unfiltered data (all stations, all fields). **Arx must filter
  everything itself and fail closed** (section 2.3). This is the core security property of stage 1.
- **Per-operator identity:** every Arx endpoint resolves the real Arx principal (Ingress headers from the Supervisor proxy,
  or the `/arx` session), checks Arx RBAC, and writes Arx audit under that principal. WisKey's audit shows the service user
  for Arx-started actions until WisKey ships the trusted caller (ask W1, section 5.4), which carries
  `actor {id, display_name}` and `request_id` into WisKey's audit.
- **No per-operator HA tokens** (Gate A option (b)) and no delegated sessions (a+) are needed for stage 1, because the owner
  made Arx RBAC the authority. This supersedes the D-001 plan for Arx-started actions (contradiction C1, section 8).
- **No generic proxy:** one typed endpoint per projection or action; the browser never sends a WisKey `type`; the add-on
  keeps a per-channel command allowlist and a contract test that every command it sends exists in the pinned catalog with the
  right keys (B0 already wrote this test; slice S0 ports it).

### 2.2 One adapter

A single backend module (`services/intercom_adapter.py`, D) owns every WisKey read used by stage 1:
`session()`, `summary()`, `stations()`, `station(id)`, `query_people(filters, page)`, `person(id)`, `events(filters)`,
`event_detail(id)`, `groups()`, `schedules()`, `door_programs(station)`, `hold_schedules(station)`, `codes_presence(station)`,
`health()`, `sync_status()`, `alerts()`, `wiskey_audit(filters)`. Rules (D-003): unknown enum -> shown as "לא ידוע";
unknown fields dropped, never echoed into writes; redacted placeholders treated as unknown, not as absence (SCOPES);
`api.commands` from `overview` decides which screen features exist (a command missing in the installed WisKey hides the
feature, never errors). The importer-installed WisKey version is pinned; the contract diff runs on every new WisKey package.

### 2.3 Permissions mapping (Arx RBAC)

Existing permissions (V `routers/access.py` L192-221, `roles.json`): `access.read` (viewer, operator, editor, site_admin,
system_admin; not kiosk), `access.release`, `access.people.manage`, `access.cards.capture` (site_admin, system_admin;
sensitive). WXD wave 1 adds the scope type `access_control_station` and the role `door_opener` (CR-033 D2/D3, unmerged).

Proposed (D), all scoped by `access_control_station` (station -> building -> site -> installation, CR-033 4.3):

| WisKey area / field | Arx permission | Default roles (D) | Sensitive |
|---|---|---|---|
| overview: view | `access.read` (unchanged) | viewer..system_admin | no |
| stations: view (technical fields: model, firmware, host-free relays, clock, programs, hold schedules, code presence) | `access.stations.read` (new) | operator, site_admin, system_admin | no |
| events: view (rows with person names) | `access.events.read` (new) | operator, site_admin, system_admin | no |
| events: export | `access.events.export` (new) | site_admin, system_admin | yes |
| users: view (names, employee no, assignments, groups, validity) | `access.people.read` (new) | operator, site_admin, system_admin | no |
| field `phone`, `photo`, `profile` (and event portrait) | `access.people.sensitive` (new) | site_admin, system_admin | yes |
| field `credentials` (card last four, PIN set or not) | covered by `access.people.read`; values are never returned by WisKey on reads (R DATA_MODEL) | - | - |
| users: manage | `access.people.manage` (unchanged) | site_admin, system_admin | yes |
| card capture | `access.cards.capture` (unchanged) | site_admin, system_admin | yes |
| door release | `door_authority` rule of CR-033 (`access.release` on the station chain or `door.unlock` on the lock entity) | door_opener, site_admin, system_admin | yes |
| call, TTS | `access.release` today (V); proposed `access.call` (new) so answering a ring does not require door rights | operator?, site_admin, system_admin | yes |
| health, sync, alerts, WisKey audit (Settings) | `access.admin.read` (new) | site_admin, system_admin | no |
| schedules / programs / codes / groups manage (later writes) | `access.schedules.manage`, `access.stations.manage`, `access.groups.manage` (new, later) | system_admin | yes |

Rules: default deny; deny overrides; a station outside the operator's station chain is omitted (not greyed); a person is
visible only if at least one assignment is on a station the operator may see (same rule WisKey uses for restricted
operators, SCOPES "Projection placeholders"); a person shared with an out-of-scope station is read-only for that operator;
fields the operator may not see are removed server-side, never sent and hidden by CSS. Today every `access.read` holder sees
names in people and events; the new split changes that (question 3).

The HA-user intersection of `HA_IDENTITY_RBAC_HE.md` section 8 is not applicable to WisKey station data (not HA entities);
this CR records an explicit exception (contradiction C2) instead of silently skipping it.

### 2.4 Audit

- Reads: no audit row per read (existing rule), except exports (`intercom.events.export`, with filters and row count, no
  rows) and photo views (`intercom.person.photo_view`, person id only).
- Writes: unchanged envelope of `access_control.py` (V): attempt row before send, outcome row after (ok / not_sent / refused
  / unknown), `client_request_id`, expiry, duplicate refusal for 600 s, no retry. Add `request_id` and `body_sha256` (CR-033
  decision 21) to every write, not only doors. Audit never holds PIN, card number, phone or photo.
- WisKey audit view (row 42) is read-only and labelled "פעולות שנעשו בחלון האינטרקום".

### 2.5 Failure modes (all screens)

| Condition | Behaviour |
|---|---|
| Integration not installed / not loaded / domain missing | Screen shows "בקרת הכניסה אינה זמינה" and a Settings link for admins; no iframe fallback silently |
| HA WS disconnected | Last copy shown with "עודכן לפני X" and actions disabled; reconnect repeats session + overview + subscribe; no replay assumed (SCOPES) |
| `api_incompatible` / `min_client` above Arx | Feature hidden, admin notice in Settings; contract diff names the command |
| Command missing in `api.commands` | Feature hidden |
| Unknown enum / unknown field | "לא ידוע" / dropped |
| `rate_limited` | Retry reads with backoff (reads only); one shared WisKey limiter bucket for all Arx operators on the service identity (V `AdminLimiter` burst 30, 2/s, 8 parallel per user id) - the adapter coalesces and caches to stay under it |
| `screen_locked` / `reauth_required` (WisKey idle or reauth turned on) | Writes refused with "נדרש אימות בחלון האינטרקום"; reads degrade to the cached copy; admin notice. Owner reports idle 0, reauth off (R, not checked) |
| `permissions_changed` / `revision_conflict` | Refetch by id, show the new state, never auto-retry |
| Paging `stale=true` | Restart at page one |
| Station offline | Row marked offline; station-dependent actions disabled |
| Uncertain write | "לא ידוע אם בוצע"; refetch; no retry |

### 2.6 UI notes

Hebrew, RTL, Arx v2 tokens and skins, light and dark, 44 px targets. Operator screens are clean: no hints, badges or
explanatory paragraphs; short confirmations; management lives in Settings (owner feedback 2026-09-30). No platform naming:
never "Home Assistant", "HA", "Ingress", "WisKey" on operator screens; the area is "בקרת כניסה", the iframe fallback is
"חלון האינטרקום" (D; the current menu label must be checked against this rule). The floors/areas tree survives where a
screen lists stations by place. Every list has a list and a table view (owner feedback 2026-10-01). Internal codes never
appear in UI text.

Proposed operator navigation under "בקרת כניסה": מרכז כניסה · תחנות ודלתות · אנשים · פעילות · לוחות זמנים.
Settings -> בקרת כניסה: מצב מערכת (health, sync, alerts) · יומן פעולות האינטרקום · קבוצות ושדות · פתיחת דלתות (CR-033) ·
מיקום תחנות ושיוך דלתות (CR-033) · תצוגה (iframe / native per screen) · אבחון (B0).

## 3. Screen designs (the missing ones)

Each block: data source and class (per D-001..D-008), permission, identity, audit, failure modes beyond 2.5, UI, tests.
"Read" = read-only over the service channel (D-001 says read-only native screens are fine; under the owner's rule they are
filtered by Arx). "Write (D-004)" = an existing write. "New write" = gated by question 2 and the WisKey asks.

### 3.1 Stations and doors ("תחנות ודלתות") - rows 29, 30, 2

- Data: `overview/summary` (frequent), `stations/get` (detail), `stations/technical_relays` (**W?** response shape: not in
  the static catalog's response, which is "not statically generated"). Read.
- Permission: list `access.read`; technical detail `access.stations.read`; open door per CR-033 `door_authority`.
- Identity / audit: reads none; door open through CR-033 transport (`trusted_door`, interim `stations/test_unlock`).
- Failures: relay not mapped -> no open button, admin sees "דלת לא משויכת" in Settings only.
- UI: list (place tree) and table; detail drawer: state, doors with "פתח" (confirm, "נשלח"), call state, last sync, last
  error (technical words only for `access.stations.read`). Station camera still as today.
- Tests (fakes): `FakeHa` station fixtures with 1/2 relays, offline, unknown `call_state`; projection omits technical fields
  without the permission; out-of-scope station omitted; Playwright list/table/detail/RTL/dark.

### 3.2 People completion - rows 13, 14, 19, 20, 22 (view)

- Data: `users/query` with server filters and `snapshot` paging; `users/get`; `users/photo_get` (photo body,
  `access.people.sensitive`); `profiles/settings_get` for group and field names. Read.
- Server-side filter by station chain and fields as in 2.3. **Important:** because WisKey returns the full projection to the
  service identity, Arx must also drop people with no visible assignment from `total`/facets (count leak) - fake test.
- Failures: `stale` paging restart; photo missing -> initials.
- UI: filters as chips (group, station, state, credential), saved filter per user (Arx `/me/prefs`), table view with
  columns chooser; person page tabs: פרטים · גישה (stations, doors, validity, timing, sync state per station) · קבוצות.
- Tests: 3-identity fake matrix (system_admin, station-scoped operator, viewer): visible rows, totals, fields, photo refused.

### 3.3 Events completion - rows 9, 10

- Data: `events/detail` (portrait under `access.people.sensitive`), `events/export` (**W?** format and size limits; not in
  the static response schema). Read; export audited.
- UI: inspector shows portrait only with the permission; "ייצוא" button (CSV, current filters, max rows stated).
- Tests: export audit row without rows content; portrait stripped for operator.

### 3.4 Door schedules and programs ("לוחות זמנים") - rows 31, 32, 33, 35 (view)

- Data: `schedules/list`, `schedules/plan_list`, `schedules/operations_list`, `stations/technical_program_list`,
  `stations/technical_hold_get`, `stations/technical_codes_get` (presence only). Read. **W?** nested shapes: DATA_MODEL says
  these stores have separate revisioned shapes and "do not implement those screens from commands.static.json alone" -> ask W2.
- Permission: `access.stations.read` on the station chain.
- UI: per door: weekly view of hold-open windows and programs, list of device schedules with "פעיל / ממתין / שגיאה",
  public code "מוגדר / לא מוגדר" only. No edit in stage 1 (edits open "חלון האינטרקום" for admins, until slice S13).
- Failures: refresh coverage - `subscribe` may not fire for schedule stores (**W?**, SCOPES "other subsystems may call") ->
  poll every 60 s while the screen is open, or ask W6.
- Tests: fixture per shape once W2 arrives; until then, tests for "unknown shape -> lists the item with לא ידוע".

### 3.5 Groups and profile fields (Settings) - row 22

- Data: `profiles/settings_get`, `profiles/versions` (admin). Read in stage 1.
- Write (question 2): `profiles/settings_preview` then `profiles/settings_apply` with revision; preview shown to the admin
  ("ישפיע על N אנשים"), confirm, envelope audit `intercom.groups.apply`. WisKey `dual_approval` gate (V list in SCOPES)
  applies to `profiles/settings_apply` when the owner turns it on in WisKey -> Arx shows "נדרש אישור בחלון האינטרקום".
- Tests: preview/apply with revision conflict; no apply without preview token (**W?** whether preview returns a token).

### 3.6 Access-control status (Settings) - rows 39, 40, 41, 42

- Data: `health/get`, `health/history`, `sync/status` (**note:** `sync/status` returns users and removal arrays; the adapter
  keeps only counts and station rows), `conflicts/list` (people names -> `access.people.read` also required), `fleet/alerts`,
  `audit/list`. Read.
- Permission: `access.admin.read`.
- UI: one page, four cards; table views; no actions in stage 1.
- Tests: `sync/status` personal arrays never reach the API response or logs.

### 3.7 Existing writes moved onto the new gates - rows 15, 16, 17, 3, 5

- No new WisKey command. Endpoints keep the envelope; authorization changes from installation scope to the station chain:
  a person write is allowed only if every station the person is assigned to (before and after the change) is in the
  operator's `access.people.manage` chain (D; matches WisKey's own `person_scope_shared` rule).
- Call / TTS move to `access.call` on the station chain (question-free, but default grants keep today's behaviour).
- Tests: shared-person refusal; scope downgrade during an open editor (refetch, refuse).

### 3.8 Navigation switch

- Extend `access.ui.*` to the new screens (`stations`, `schedules`) and keep the existing three. Values `wiskey` | `smplwise`,
  installation-wide, admin-only, default `wiskey` until the screen's verification passes (section 6). Settings -> בקרת כניסה
  -> תצוגה shows each screen with its state.

## 4. Slice plan

### 4.1 Slices in dependency order

Hours are agent-hours (calibration of CR-032/CR-033). Opus for identity, RBAC, projection filtering and writes; Sonnet for
mechanical and UI work; Fable only for the visual design slice.

| Slice | Content | Depends on | Hours | Model | Can start now with fakes |
|---|---|---|---|---|---|
| S0 | Fakes and contract: extend `FakeHa` (test_intercom.py) into a reusable `tests/fake_wiskey.py` with fixtures for every stage-1 read; port the pinned catalog and `scripts/wiskey_contract_diff.py` from `pilot/wiskey-b0`; per-channel command allowlist test | - | 4 | Sonnet (Opus review) | yes |
| S1 | Port B0 onto main: `last_access` out of cache/API/UI (D-006), background projection, background/write channel split, diagnostics screen | S0 | 5 | Opus | yes |
| S2 | Station scope dependency: merge CR-033 D1-D4 (WXD wave 1) or rebase on it; nothing new here, listed so the order is explicit | CR-033 review | 0 (CR-033) | - | in progress elsewhere |
| S3 | New permissions and the projection filter (`intercom_authority`): station chain, field removal, count-leak guard, fail closed; roles.json defaults; Settings role labels | S0, S2 (can start on installation scope) | 8 | Opus | yes |
| S4 | Adapter (`intercom_adapter.py`) + read channel + typed endpoints for all stage-1 reads, caching under the shared limiter, `api.commands` feature flags, unknown-enum rules | S0, S3 | 7 | Opus | yes |
| S5 | Visual design: mockups for stations and doors, people completion, schedules, Settings status page; list and table views; phone and desktop; light/dark | - | 6 | Fable | yes |
| S6 | Stations and doors screen | S4, S5, S2 | 6 | Sonnet | yes (doors on the interim transport) |
| S7 | People completion (filters, paging, person tabs, photo view) | S4, S5 | 6 | Sonnet (Opus review of the filter calls) | yes |
| S8 | Events completion (detail, portrait, CSV export with audit) | S4, S5 | 4 | Sonnet | yes |
| S9 | Schedules and programs view | S4, S5, **W2** for real shapes | 7 | Sonnet | partly (unknown-shape handling) |
| S10 | Settings: access-control status page (health, sync, alerts, WisKey audit) + groups view | S4, S5 | 6 | Sonnet | yes |
| S11 | Existing writes on the new gates (people, PIN, capture, call, TTS) + `request_id`/`body_sha256` audit | S3, S4 | 6 | Opus | yes |
| S12 | Navigation switch per screen, Settings "תצוגה", parity report tool (section 6.2) | S6-S10 | 4 | Sonnet | yes |
| S13 | Gate on fakes, security review per section 2.3, release notes (Hebrew and English) | S1-S12 | 4 | Sonnet (run) + Opus (review) | - |
| S14 | Lab verification with the owner (read-only, then one write with approval) | S13 | 3 (owner session) | Opus | no (owner) |
| | **Stage 1 total** | | **76** | | |
| S15 | New non-door writes: groups/profile apply, person activate/archive, cards add/remove, timing edit (only if question 2 = ג or ב) | S11, **W1** if question 2 = א, **W2** | 12 | Opus | partly |
| S16 | Door-affecting writes: hold-open schedules, door programs, public codes, conflict resolve, sync now | S15, **W1**, **W2**, owner approval per write | 20 | Opus | no |
| S17 | Stage 2 views: access scenario, reviews, data quality, lifecycle, visits, guests, unified search | S4 | 16 | Sonnet + Opus review | yes |
| S18 | Live station video and two-way audio natively | D-002 closed, brief 5.5, a WisKey audio hook, site measurements | 24+ | Opus | no |

Without S15-S18: 76 hours of agent work plus the owner session. CR-033 (doors, about 73 hours) is separate and runs in
parallel; S6 only needs its D2-D4.

### 4.2 What depends on WisKey (Codex) deliveries - the exact asks

| Ask | What exactly | Needed by | Blocks |
|---|---|---|---|
| W1 | Trusted caller generalized beyond `door_open` (brief 5.2): one-page spec and implementation of the call list for people (`users/create/update/delete/set_active/archive`), credentials (`users/pin_generate`, `cards/add/remove/capture_*`), groups (`profiles/settings_apply`), timing, hold-open, door programs, public codes, schedules, conflict resolve. Each call takes `actor {id, display_name}`, `request_id`, `nonce`, `expires_at`, bridge HMAC; skips WisKey panel policy; writes WisKey audit with the real actor and request id; unreachable from a normal HA user | S15 (if question 2 = א), S16; real actor in WisKey audit for S11 | yes for door-affecting writes |
| W2 | Full request and response JSON Schemas (D-003 "new deliverable", P1) for every command in sections 3.1-3.6: `overview/summary`, `stations/get`, `stations/technical_relays`, `technical_program_list`, `technical_hold_get`, `technical_codes_get`, `schedules/list`, `plan_list`, `operations_list`, `users/query`, `users/get`, `users/photo_get`, `events/detail`, `events/export`, `profiles/settings_get/preview/apply`, `health/get/history`, `sync/status`, `conflicts/list`, `fleet/alerts`, `audit/list` | S9 real data, S10, S15, S16 parity claims | S9/S15/S16 |
| W3 | The D-006 background projection command (`id, name, online, last_seen`) - agreed, not implemented | S1 complete privacy (Arx-side removal works without it) | no |
| W4 | Explicit lock entity -> `physical_index` field (CR-033 item 18) | S6 door labels without manual mapping | no (manual map exists) |
| W5 | Error codes per command for the commands in W2 (the catalog has 301 codes without command mapping) | Correct Hebrew error texts | no |
| W6 | Statement (or a new `subscribe` topic) of which stores trigger `refresh`: schedules, programs, hold, health, alerts, profiles | S9, S10 live update (else polling) | no |
| W7 | Answer: does `stations/technical_codes_get` return code values to an admin caller? If yes, a presence-only variant | S9 | S9 code display |
| W8 | `contract_version` command (brief 5.1) | S4 pin check | no |
| W9 | Whether `panel_security` idle lock or reauth can affect the service channel after a WisKey settings change, and a signal Arx can read (`security` in `authorization/session` exists, V) | 2.5 behaviour | no |
| W10 | Station stream descriptor (D-002) and an audio hook not tied to the panel's WS connection | S18 | S18 |

Arx-side dependencies: CR-033 D1-D4 merged (station scope, door map, door authority); the importer (CR-035) installs the
pinned WisKey version so the adapter's catalog pin matches what runs; B0 port (S1).

## 5. Tests (fakes only; nothing here may contact a device)

- Backend: `tests/fake_wiskey.py` (S0) built from `FakeHa`; three identities (system_admin, station-scoped operator with one
  station, viewer) x every stage-1 endpoint: rows, totals, fields, refusals. Fail-closed cases: unknown station, person with
  mixed scope, missing permission, WisKey returns a field Arx does not know (dropped), placeholder values (unknown).
- Privacy: log capture asserts no person name, phone, PIN, card or photo bytes in logs for every endpoint; `sync/status`
  arrays dropped; background cache holds no `last_access` (B0 tests).
- Contract: every command sent exists in the pinned catalog with required keys and `api_contract` on non-READ commands; the
  read channel's allowlist has no write command; a contract diff on a changed catalog fails the gate.
- Writes: envelope tests extended with `request_id`/`body_sha256`; no retry on unknown; duplicate refusal.
- Frontend Playwright on the live dev backend with the fake feed: list/table, RTL, dark, phone width, no platform names in
  operator screens (string scan), feature hidden when the command is absent from `api.commands`, switch back to the iframe.
- Live checks: NOT_RUN until slice S14 with the owner.

## 6. Rollback and verification

### 6.1 Rollback

- The iframe and the embed API v1 connector stay in the product through stage 1 and stage 2. Per screen,
  `access.ui.<screen>` = `wiskey` returns the iframe at once; nothing is migrated, so rollback has no data step.
- Stage 1 changes no WisKey storage and no WisKey setting. The only behaviour change visible to WisKey is the read channel
  (more read traffic on the service identity) - measured in S14.
- Writes keep their current endpoints; S11 changes only who may call them. Reverting S11 restores installation-level gates.
- New permissions are additive; removing a binding never breaks the iframe (the iframe uses the operator's own WisKey policy).

### 6.2 Verification (side by side)

1. **Parity report (S12, admin, read-only):** the add-on calls the same WisKey command for the native view and for a direct
   unfiltered read and reports only counts and hashes per screen (stations, people, events in a window, groups, schedules) -
   never names. Differences are expected only where Arx RBAC filters; the report states which rule filtered.
2. **Three identities on the lab:** system_admin, an operator limited to one station, a viewer. For each native screen,
   the owner checks the visible stations, people and fields against the expected matrix (generated from the bindings).
3. **Two tabs:** the same screen in the iframe and native, same moment; checklist per screen (counts, a sample person, the
   last 20 events, the door list, a schedule).
4. **Writes:** one person edit and one card capture on a test person, one door "sent" on the owner's chosen door - each only
   with the owner's explicit approval for that run (CLAUDE.md, device access read-only by default).
5. A screen flips its default to native only after the owner signs off its checklist (question 4). The iframe remains
   selectable afterwards.

## 7. Risks

1. **Data leak through the service identity.** WisKey sees Arx as admin (W?), so a filter bug in Arx shows everything.
   Mitigation: one projection filter (S3), fail closed, the three-identity matrix in tests and on the lab, count-leak guard.
2. **Shared rate bucket.** All Arx operators and the background feed share one WisKey limiter bucket (V `AdminLimiter`
   per user id). Many open screens can get `rate_limited` and starve the write channel. Mitigation: adapter cache and
   coalescing, lanes (existing), measurement in S14.
3. **WisKey audit shows the service user** for Arx actions until W1. Arx audit is the record (D-004). Investigations that
   start in WisKey's panel will not see the Arx operator.
4. **Schema drift.** Nested shapes are not delivered (W2); screens built on observed shapes can break on a WisKey update.
   Mitigation: unknown-shape handling, pinned version via the importer, contract diff.
5. **Scope creep.** WisKey has about 60 components; stage 1 deliberately covers 25 rows. Everything else stays reachable
   through the iframe.
6. **Physical safety.** No new door-affecting write in stage 1; autonomous WisKey timers (hold-open tick, reconcile) keep a
   single owner (WisKey). Public code values are never displayed or cached.
7. **WisKey security settings changed by someone in WisKey's panel** (idle lock, reauth, dual approval) can refuse Arx
   writes; handled as a refusal with a message, never bypassed.
8. **Two code paths during transition** (native and iframe) double the test surface until the iframe is retired (stage 3).

## 8. Contradictions recorded (not resolved here)

- **C1 - D-001 / D-004 vs owner decision 2026-10-03 item 5.** D-001 (agreed with WisKey) keeps privileged flows on the
  iframe and plans delegation (a+); D-004 says "no new native writes". The owner later made Arx RBAC the single authority for
  Arx-started actions. This CR follows the owner for reads and existing writes, and gates new writes on question 2. WisKey
  should be told that D-001 is superseded for Arx-started actions (send with the next Arx reply, after owner approval).
- **C2 - `HA_IDENTITY_RBAC_HE.md` section 8** requires the HA user's own permission in the intersection. WisKey station data
  are not HA entities; this CR proposes a recorded exception for `hikvision_intercom` / `smplwise_intercom` WS reads and
  writes made by the add-on, with Arx RBAC as the gate. Needs owner approval as part of this CR. (ADR-018 is still "pending".)
- **C3 - WisKey `ADAPTER.md`:** "do not grant station viewers based solely on a privileged service account". Under the owner
  decision Arx does exactly that, with Arx RBAC as the grant. Recorded; the mitigation is section 2.3 and risk 1.
- **C4 - Owner "no parallel-run period"** (brief item 11) vs this CR's side-by-side verification. The side-by-side checks
  are a verification step per screen, not a parallel operation period; the iframe is a fallback, not a second live system.

## 9. Questions for the owner (plain, few)

1. **Which screens move into Arx in the first stage?**
   א. Daily screens: מרכז כניסה, תחנות ודלתות, אנשים, פעילות, לוחות זמנים (צפייה), ובהגדרות מצב מערכת וקבוצות. השאר
   נשאר בחלון האינטרקום. **(המלצה)**
   ב. כמו א, ועוד אישורי ביקור, תבניות אורחים ובדיקת "מי יכול לפתוח".
   ג. הכול.
2. **Changes that are new in Arx (groups, activate/archive a person, cards by number, door schedules), before the
   intercom team delivers the "trusted call":**
   א. Wait for it.
   ב. Allow all now, recorded in Arx's log only.
   ג. Allow now only changes that do not touch doors (groups, person details); door schedules and programs wait. **(המלצה)**
3. **Who sees personal details (names, phone, photo) in the access-control screens?**
   א. New separate permissions: a regular operator sees names only; phone and photo for site and system administrators.
   **(המלצה)**
   ב. As today: everyone with access-control view sees everything.
4. **When does each screen switch from the intercom window to Arx?**
   א. Each screen separately, after you approve its side-by-side check. **(המלצה)**
   ב. All together at the end.
5. **Talking to a station (two-way audio) and live station video:**
   א. Stay in the intercom window in the first stage. **(המלצה)**
   ב. Include them in the first stage (needs work from the intercom team and measurements on site).

---

## Owner answers (2026-10-11) - binding

1. **Stage 1 screens:** the daily screens (stations and doors, people, events) plus the status page and the groups view in Settings. Visits and guests and the rest stay for later. (Answer: A, the recommended option.)
2. **New writes before WisKey delivers the trusted caller (W1):** ALLOWED NOW for everything, including writes that touch doors (answer B, not the recommended C). Consequences recorded by the coordinator: (a) these writes run through Arx's service identity, so WisKey's own per-operator grants and audit do not apply; Arx RBAC plus Arx's audit (actor, request id, body hash) are the only controls, as decided on 2026-10-03; (b) each write class still needs its schemas (W2) and a fake-based test before it ships, and EVERY live test of a write on a real system needs the owner's separate, task-specific approval (device-write rule); (c) writes that open, close or program doors keep the confirmation and the Arx permission checks of CR-033 once that work is merged; (d) slices S15 and S16 are merged into one write phase that starts right after S4, instead of waiting for W1.
3. **Personal details:** operators see names only; sensitive details (employee number, portraits, contact data) only with the separate `access.people.sensitive` permission. (Answer: B.)
4. **Switching screens:** screen by screen, after the owner approves the side-by-side check; the iframe stays selectable per screen as rollback. (Answer: A.)
5. **Two-way audio and live station video:** stay in the iframe in stage 1 (answer A), BUT the owner requires that their native implementation (S18) is scheduled for the earliest possible time right after stage 1: ask WisKey for W10 (stream descriptor and audio hook) now, and start S18 as soon as W10 arrives.
