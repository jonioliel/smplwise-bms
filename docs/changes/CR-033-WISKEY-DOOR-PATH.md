# CR-033 - WisKey door path: every Arx-started opening of a WisKey door through the signed `door_open`

Status: PROPOSED (design and documents only, 2026-10-10). No product code, no migration file, no device, door, key or secret
was touched to write this. Branch `pilot/WISKEY-CRs` from `origin/main` e7201c92 (2.4.3).
Companion: `CR-034-WISKEY-HMAC-ROTATION.md` (key rotation and gate tool) and
`WISKEY-CR033-CR034-IMPLEMENTATION-PLAN.md` (combined order, item map, effort).

Sources (read in full for this CR):

| Source | Where | Version |
|---|---|---|
| Door-path transition table (rows A1..X1, DR-1..DR-12, F1..F13, T1..T22, Q1..Q10) | `docs/integrations/wiskey/DOOR_PATH_TRANSITION_TABLE.md` on `origin/pilot/WX2-transition-table` | 75844343 |
| HMAC rotation procedure, gate tool spec, gate tool | `origin/pilot/WX3-hmac-rotation` | ef18041c |
| Arx replies of 2026-10-10 (final closure review; intake ack: closed rules for items 17 and 25; the item-18 answer) | `private/wiskey-foldin/ARX_REPLY_TO_*_2026-10-10_HE.md` | 2026-10-10 |
| Continuous handoff (OWNER01 list, A7/A8 entry conditions) | `private/wiskey-foldin/CODEX_HANDOFF_CONTINUOUS_2026-10-10_HE.md` | 2026-10-10 |
| **Owner decisions (authoritative)** | `private/wiskey-foldin/CODEX_SEND_PACKAGE_2026-10-10_HE.txt`, block "אישורי הבעלים" | 2026-10-10 |
| Code facts | Arx `main` e7201c92: `roles.json`, `rbac.py`, migrations 0001/0011/0032/0036, `routers/access_control.py`, `routers/ha.py`, `services/intercom_sync.py`, bridge `__init__.py` (0.8.0) | e7201c92 |

Precedence (CLAUDE.md): an approved change request, then `MASTER_SPEC_HE.md` and `docs/security/`, then `AGENTS.md`, then this
document. This CR becomes binding only when the owner approves it. Contradictions are recorded in section 13, not resolved.

Evidence marks used below: **V** read in Arx code at e7201c92; **R** reported by a source document; **W?** WisKey behaviour that
is **not verified** (no WisKey code or runtime was read or run for this CR); **D** design proposal of this CR.

## 1. Owner decisions encoded (2026-10-10, OWNER01 numbering)

| # | Decision | Where in this CR |
|---|---|---|
| 13 | **ג**: either `access.release` or the existing `door.unlock` permission is enough to open a WisKey door from Arx, and it must be easy to grant to any user ("not too complicated") | 4.1, 4.2, slice D3 |
| 14 | **א**: build the scope type "access control station" before the lock-breaking release | 4.3, slice D2 |
| 15 | **א**: a read-only query lists saved items (schedules, automations, scripts, scenes) that contain a door step | 6.1, slice D7 |
| 16 | **א**: block creating NEW WisKey door steps in the Arx editors; built as an administrator setting, default blocked, changeable later | 6.3, slice D8 |
| 17 | closed by rule (see "closed rules" below) | 6.2, slice D9 |
| 18 | **א**: the link between a lock entity and a WisKey station and relay is `config_entry_id` + `physical_index`, explicit mapping only | 4.4, slice D1 |
| 19 | **א**: wait for the query; recurring fixed schedules move to WisKey hold-open programs, event-driven items become Arx event automations | 6.4, slice D10 |
| 20 | **א**: block `execute` for WisKey doors in the bridge, in the next bridge version (0.8.1); built as an administrator setting, default blocked, changeable later | 5.3, slice D5a |
| 21 | **א**: audit fields request id and body hash, without changing the signed format | 7, slice D4 |
| 22 | **א**: after success show "sent", never "opened" | 8, slice D4 |

Closed rules (not owner choices; derived from DR-1, DR-2, DR-3, DR-5 and confirmed in the 2026-10-10 replies):

- **R-17.** Every Arx-started opening of a WisKey door, including a run started from Arx of an automation, script, scene or
  schedule that contains a door step, is judged by Arx RBAC only and is sent only as a signed `smplwise_bridge.door_open`
  with the real Arx principal as actor. No inner `lock.unlock` reaches a WisKey lock on an Arx-started path. An item whose door
  step was not converted is refused; an item whose door steps cannot all be resolved statically is refused (fail closed).
  Paths that are not Arx paths (H1..H5, C4, H4) stay under WisKey policy (DR-7); Arx RBAC has no effect there.
- **R-25.** (Belongs to CR-034.) Anchor reduction after an emergency re-pair without proof that the old key is rejected is
  unavailable; the system stays blocked until UTC reaches the high-water.

## 2. Scope

In scope (Arx add-on, Arx UI, `smplwise_bridge`):

1. One server function `door_authority` that decides, for a WisKey door, whether a principal may open it (13, 14).
2. A built-in role and a Settings card that make door opening a one-switch grant for a user, a group or a role (13).
3. The scope type `access_control_station` (14) and the placement of stations under a site or building.
4. The explicit door map entity -> (config entry, physical index) (18).
5. The add-on transport `trusted_door.open/status` that signs `door_open` / `door_open_status` (DR-2) and is used by every Arx
   entry point (A1, A2, A4, B1, B2, S4, C3), with audit fields (21) and "sent" display (22).
6. Bridge 0.8.1: refuse `execute` for WisKey-platform locks, governed by an administrator setting, default blocked (20).
7. Bridge `door_open` / `door_open_status` services (DTO `wiskey-trusted-door-v1`): a later bridge version (0.9.x), because it
   depends on the WisKey consumer side (W?).
8. WisKey locks lose `lock.lock` and lock-all (A3, A4).
9. The read-only inventory (15), the editor block (16), the run-time guard for Arx-started runs (R-17), and the conversion of
   autonomous items (19).

Out of scope: call answer / hang-up / TTS (B4: unchanged path and permission); the HA-native lock path and WisKey's own policy
(H1..H7); the domain rename release (DR-10; this CR only requires both platform names to be recognised); any live run, door
test or lab access (each needs its own owner approval); key rotation (CR-034).

## 3. Preconditions and dependencies outside Arx

| Dependency | Needed by | Status |
|---|---|---|
| WisKey consumer of the bridge-verified DTO: the internal capability (`trusted_door_capabilities`), stage and code set of DTO v3 section 9, `door_open_status` | D5b, end-to-end enablement | **W?** Not verified in WisKey code by Arx. The 82/82 vector result is a synthetic model report (DR-12) |
| WisKey lock entity checks `context.user_id` (DR-7) and the lock-breaking WisKey release | final release step | **W?** WisKey work, separate owner approval (DR-8) |
| Explicit relay mapping source: WisKey exposes, per lock entity, its `physical_index` next to the `config_entry_id` (answer to Q6/item 18, "explicit mapping") | D1 automatic mapping | **W?** The answer was received in text; the field that carries it in the overview or capability was not seen. D1 has a manual fallback |
| WisKey hold-open programs creatable on behalf of an Arx operator, audited by WisKey (M3) | D10b | **W?** Not offered by WisKey yet; question to WisKey |
| `config_entry_id` on the entity registry row of a WisKey lock | D1 | V on the Arx side (`ha_entities.config_entry_id`, migration 0036); HA core behaviour, **W?** for the renamed domain |

## 4. Authority, scope and mapping

### 4.1 One permission rule for a WisKey door (decision 13 = ג)

`door_authority.check(principal, door) -> Decision{allowed, granted_by, scope_type, scope_id, binding_id, reason}`:

1. Refuse before anything else: no identified principal (`identity_unmapped`), a `dev` principal, a kiosk or viewer principal,
   a door that does not resolve through the door map (`intercom_lock_unmapped`).
2. **Deny wins across both permissions.** If any active `deny` binding removes `access.release` on the station's scope chain,
   or removes `door.unlock` on the lock entity's scope chain, the request is refused (fail closed: a deny the administrator
   wrote for either permission is honoured, so "either permission" can never be used to slip past a deny).
3. Allowed if `access.release` is held on the station scope chain (`access_control_station:<config_entry_id>` -> its building
   -> its site -> installation), **or** `door.unlock` is held on the lock entity's own scope chain (the existing `ha_scope`
   resolution, area/floor/building/site/installation).
4. `ha.entity.control` is **not** additionally required for a WisKey door (D, simplicity of decision 13). It stays required for
   every non-WisKey lock, unchanged.
5. The confirmation stays mandatory and comes from the client only (`confirmed: true` on B1, `confirmation_grant:
   "confirmed"` on A1); the server never supplies it.
6. The decision row records which permission granted (`granted_by: access.release | door.unlock`) and the binding id.

Both the lock-tile route (`routers/ha.py` `run_action`) and the WisKey-screen route (`routers/access_control.py` `release`)
call this one function (invariant "no second authority in Arx"). Consequence (V): a custom-role holder of `door.unlock` keeps
opening WisKey doors from tiles and also gains the WisKey-screen release button for doors in scope; `access.release` keeps
covering call and TTS (B4), `door.unlock` does not.

### 4.2 Simple grant UX (decision 13: "anyone I choose, not too complicated")

Today a grant needs a custom role or a built-in role that already holds `access.release` (site_admin, system_admin; V
`roles.json`). D:

- **New built-in role `door_opener` ("פותח דלתות")** in `roles.json`: `access.read`, `access.release`. Assignable at
  installation, site, building or `access_control_station` scope. Not delegable by default (site administrators cannot hand it
  out unless the system administrator marks it delegable, existing mechanism).
- **Settings -> הרשאות -> card "פתיחת דלתות"** (new card; Settings may name the infrastructure):
  - Section "משתמשים וקבוצות": a list of HA-mirrored users and Arx groups, each with one switch "רשאי לפתוח דלתות".
    Switching on creates one binding `door_opener` at scope "כל הדלתות" (installation); an optional "רק דלתות מסוימות" link
    opens the existing binding wizard prefilled with the role and the station scope. Switching off revokes exactly the
    `door_opener` bindings this card created for that subject (bindings created elsewhere are listed, read-only, with
    "שיוך אחר" and a link to them).
  - Section "תפקידים": one switch per custom role ("כולל פתיחת דלתות"), which adds or removes `access.release` in the role's
    `sensitive_json` (existing revision bump). Built-in roles are shown read-only with their effective answer
    (site_admin / system_admin: "כן"; operator / editor: "לא - אפשר לתת למשתמשים בנפרד"; viewer / kiosk: never). No
    built-in role is changed by a setting (see open question 1).
  - Each switch asks one short confirmation ("לתת ל<שם> הרשאה לפתוח דלתות?") because it is a sensitive grant; every change
    writes an audit row and bumps `permission_revision` (existing behaviour of bindings and custom roles).
- Who may use the card: the existing role-management permission (`rbac.roles.manage`, system administrator); the user and
  group switches also for a delegated administrator when `door_opener` is marked delegable and the subject is inside the
  delegated scope (existing delegation rules, unchanged).
- The operator screens show nothing new: a person without the grant simply does not get the open button (existing visibility
  rule by permission).

### 4.3 Scope type `access_control_station` (decision 14)

- Migration **0077** (see 11.1): rebuild `bindings` with the CHECK list
  `('installation','site','building','floor','camera','access_control_station')` (same pattern as 0032); new table
  `intercom_station_placement(config_entry_id TEXT PRIMARY KEY, site_id TEXT, building_id TEXT, assigned_by TEXT,
  assigned_at TEXT NOT NULL, revision INTEGER NOT NULL DEFAULT 1)`.
- `scope_id` of a station binding is the station's `config_entry_id` (opaque, DTO v3 section 2; never derived from hardware).
- Ancestry (`rbac.py`): installation contains every station; a site or building contains a station only when the station is
  placed under it; an unplaced station is covered by installation bindings only. A station binding grants nothing above or
  beside itself. A station never contains a floor, camera or entity.
- Pydantic patterns in `routers/access.py` and `routers/access_groups.py` accept the new scope type; the binding wizard gets a
  station picker (names from the WisKey overview, never ids).
- Placement is set in Settings -> אינטרקום -> "מיקום תחנות" by the system administrator; audited as
  `intercom.station.placed`.
- Built before the lock-breaking release and before the lock tile switches to `door_open` (decision 14).

### 4.4 Door map (decision 18)

- Migration **0078**: `intercom_door_map(entity_id TEXT PRIMARY KEY, config_entry_id TEXT NOT NULL, physical_index INTEGER NOT
  NULL, source TEXT NOT NULL CHECK (source IN ('wiskey_explicit','single_relay','manual')), mapped_by TEXT, mapped_at TEXT NOT
  NULL, revision INTEGER NOT NULL DEFAULT 1, UNIQUE (config_entry_id, physical_index))`.
- A lock entity is a WisKey door when `ha_entities.platform` is `hikvision_intercom` or `smplwise_intercom` (both names, DR-10).
- Fill order, never by name and never by parsing `unique_id`:
  1. `wiskey_explicit`: the explicit entity -> `physical_index` field that WisKey provides (**W?**: field and location not seen).
  2. `single_relay`: the station (`config_entry_id` from the registry row) exposes exactly one lock in the overview and exactly
     one WisKey lock entity carries that `config_entry_id`: unambiguous.
  3. `manual`: Settings -> אינטרקום -> "שיוך דלתות": the system administrator picks the relay for each unmapped lock entity
     (relay names from the overview); audited `intercom.door.mapped`.
- Anything else is unmapped and refused with `intercom_lock_unmapped`; nothing is sent. A change of the overview that removes
  a mapped relay invalidates the row (refused until re-mapped). The capability cache from `trusted_door_capabilities` is a
  display hint only (DTO), never authority.

## 5. Transport

### 5.1 Add-on `trusted_door` service (DR-2)

`trusted_door.open(principal, door, request_id, entry_point, origin)`:

1. `door_authority.check` (4.1); confirmation check; envelope/expiry, duplicate `client_request_id`, relay guard (existing
   `_RelayGuard`, 90 s safety, 10 s hold after unknown; V `access_control.py`).
2. Commit the attempt audit row (before any send).
3. Build the DTO body (protocol `wiskey-trusted-door-v1`, actor `{id, display_name}` of the principal, station
   `config_entry_id`, relay `physical_index`, `request_id` UUIDv4), sign with the pairing key, call
   `smplwise_bridge.door_open` with `return_response`.
4. Map the answer to the closed outcome set (F1..F13 of the transition table): `acknowledged` -> outcome `sent`;
   `rejected` -> `refused` (nothing happened); timeout / transport error after a possible delivery -> `unknown` (relay hold);
   `stored_result` -> the stored outcome.
5. Commit the outcome audit row. Never retry; never queue; an unknown outcome is resolved only by
   `trusted_door.status(request_id)` (`door_open_status`), never by signing the open again (DR-11).

No fallback exists anywhere: a WisKey door is never sent through `execute` or `lock.unlock`, and never through the WS
`stations/test_unlock` once the feature flag is on (5.4, 5.5). Steps 3 to 4 describe the flag-on transport.

### 5.2 Entry points moved

| Row | Route (unchanged for the client) | Change |
|---|---|---|
| A1, A2 | `POST /ha/entities/{id}/actions` `lock.unlock` | WisKey door -> `trusted_door.open`; `ha_actions` row `via = trusted_door`, confirmation kind `none` (rendered "sent") |
| A4 | anchors / map cards | follow A1; action list drops `lock.lock` for WisKey locks |
| A3 | lock-all, `lock.lock` | WisKey locks skipped, shown "לא רלוונטי"; never "success" |
| B1 | `POST /intercom/stations/{id}/release` | `_perform` -> `trusted_door.open` (attempt row, outcome row unchanged in shape) |
| B2 | notification deep link -> in-app confirm -> B1 | unchanged UI; `origin = notification:<id>` stays audit-only, never authority |
| S4, C3 | "run now", `trigger`, `run_script`, `apply_scene` | R-17 guard (6.2) |

### 5.3 Bridge 0.8.1: `execute` blocked for WisKey doors (decision 20)

- In `smplwise_bridge` `execute`: for `lock.*` services, look up the target in the HA entity registry; if its platform is
  `hikvision_intercom` or `smplwise_intercom` and the policy is `blocked`, answer `refused` with code
  `wiskey_door_execute_blocked` and call nothing. Unknown registry entry for a `lock` target: refused (fail closed).
- Policy storage: the bridge config entry options key `wiskey_execute_policy` (`blocked` | `allowed`). Default when absent:
  `blocked`. Changed only through a signed `bridge_policy.set` message from Arx (new message type on the existing signed
  channel; the bridge persists without reloading the entry, because a reload revokes the WisKey capability). The bridge
  answers its current policy in the existing ping.
- Arx side: Settings -> תשתית המערכת -> "פתיחה ישירה של דלתות אינטרקום דרך הגשר": "חסום (ברירת מחדל)" / "מותר"; system
  administrator only, confirmation, audit `bridge.policy.changed`. The add-on guard (T3: the add-on never sends `execute` for
  a WisKey door) is independent of this setting and is not weakened by it (see 13.2).
- Bridge version bump 0.8.0 -> 0.8.1, both copies (`custom_components/smplwise_bridge`, `smplwise_vms/integration/...`) via
  `scripts/sync_integration.py`; release notes say "requires add-on >= the version that carries D4" because older add-ons
  still send WisKey tile unlocks through `execute` and would see them refused (5.5).

### 5.4 Bridge `door_open` / `door_open_status` (later bridge version)

New services verifying `signed_message_json` (closed schema), clock and replay stages per DTO v3, then handing the verified
DTO to the WisKey capability and returning WisKey's closed answer. Built only when the WisKey consumer side is confirmed (**W?**).
Until then the add-on keeps the feature flag `doors.trusted_path` = `off` (setting, system administrator, default off).
Turning the flag on is an owner-approved step after the gate (11.3).

### 5.5 Interim transport while the flag is off (why bridge 0.8.1 does not break the tiles)

Today a tile unlock of a WisKey lock goes through `execute` -> `lock.unlock` (V). Bridge 0.8.1 refuses exactly that by default
(decision 20). So D4 makes `trusted_door` choose its transport from the flag:

| `doors.trusted_path` | Transport for every Arx entry point (A1, A2, A4, B1, B2, runs) |
|---|---|
| `off` (until D5b, WisKey's consumer and the gate) | today's B1 transport, WS `stations/test_unlock` with the add-on token (V `intercom_client.release_door`), after `door_authority.check`. WisKey sees the infrastructure user, as B1 does today; Arx audit holds the person. Never `execute` |
| `on` | signed `door_open` only; no other transport exists |

Release order this forces: the add-on version carrying D4 is released **before** bridge 0.8.1, and the 0.8.1 notes state the
minimum add-on version. An older add-on with bridge 0.8.1 would see its WisKey tile unlocks refused (fail closed, not unsafe).
Consequence to record: from D4 on, tile opens of a WisKey door no longer carry the HA user context to WisKey's lock entity; this
loses nothing today because that entity checks nobody (V, transition table H1), and with the flag on the real actor travels
inside the signed body.

## 6. Saved items (schedules, automations, scripts, scenes)

### 6.1 Read-only inventory (decision 15)

- Service `door_path_inventory` over Arx mirror tables only (`ha_config_items`, `automation_meta`, `schedule_cache`,
  `schedule_meta`, `ha_entities`, `intercom_door_map`): every item with `lock.unlock`, `lock.open`, a scene member captured as
  unlocked, or a call of the WisKey `unlock_door` service, whose target resolves to a WisKey door, including through group,
  area, label, device or nested script. A target that uses a template or cannot be expanded is reported `unresolvable`.
- Classification: `arx_authored` (created via Arx, live revision equals the revision Arx wrote) / `arx_edited_externally` /
  `external` / `unknown`; plus `door_steps: n`, `resolvable: bool`, `approved_by` / `approved_revision` when an audit row of a
  confirming write covers the live revision.
- Route `GET /api/v1/intercom/door-path-inventory` (system administrator, `system.configure`), and a Settings -> אינטרקום
  report "פריטים שפותחים דלתות" listing by alias only (no entity ids, no addresses). No HA call, no write.
- Running it on the owner's installation is itself a separate, owner-approved read (it reads only Arx's own database).

### 6.2 Arx-started runs (R-17)

Before `trigger`, `run_script`, `apply_scene` or schedule "run now" reaches the bridge, the server resolves the item with the
same resolver as 6.1:

| Item state | Result |
|---|---|
| no WisKey door step | unchanged (existing `run_reasons` checks) |
| door steps all resolvable and the item is converted (6.4, its door steps are Arx door steps) | the item runs without door steps in HA; for each door step Arx calls `trusted_door.open` with the operator as actor, after `door_authority.check` per door; one confirmation covers the run, and every door gets its own request id and audit pair |
| door step not converted | refused: "לא ניתן להריץ: הפריט פותח דלת של בקרת הכניסה. פתיחת דלתות מאוטומציה עדיין לא נתמכת." (wording of 2.4.9); listed in the inventory |
| any door step unresolvable | refused: "לא ניתן להריץ: ייתכן שהפריט פותח דלת של בקרת הכניסה. פתיחת דלתות מאוטומציה עדיין לא נתמכת." (wording of 2.4.9) |

No inner `lock.unlock` reaches a WisKey lock on any of these paths.

### 6.3 Editor block (decision 16)

- Setting `doors.editor_wiskey_steps`: `blocked` (default) | `allowed`. System administrator, confirmation, audit.
- While `blocked`: the typed automation builder, the schedule editor, scene capture and code mode refuse, **server side on
  save**, any new step whose target resolves to a WisKey door (and any unresolvable lock target), with
  "לא ניתן להוסיף כאן פתיחת דלת אינטרקום. פתיחה נעשית מכפתור הדלת או מתוכנית החזקה פתוחה." The client hides WisKey locks
  from the target pickers (UX only; the server check is the guard). Editing an existing item never adds a door step; an
  existing door step may be removed.
- `allowed` becomes selectable only after slice D10a exists (new door steps are then stored as Arx door steps, never as
  `lock.unlock` in HA). Before that the option is shown disabled with "יתאפשר לאחר השלמת הסבת הפריטים".

### 6.4 Autonomous items (decision 19)

Order: inventory first (6.1). If it finds no `arx_authored` items with door steps, nothing is converted and only the guards ship.
Otherwise:

- **Recurring fixed schedules -> WisKey hold-open programs (M3, D10b).** Arx shows the owner each schedule and its proposed
  program; the program is created in WisKey on behalf of the confirming operator and audited by WisKey as itself; the Arx
  schedule's door step is then removed. **W?** WisKey must offer the creation call and its audit; until it does, these schedules
  are disabled and listed.
- **Event-driven automations -> Arx event automations (M1, D10a).** The HA automation loses its door step; an Arx "door job"
  bound to the automation id and revision listens to the trigger event mirror and calls `trusted_door.open` with the stored
  approving actor (`authorising_actor`, `origin = automation:<id>`, `item_revision`). The approver is the person whose
  confirmation covered the live revision; none, inactive, or without permission at fire time -> the job does not fire and the
  item is listed. A fire missed while Arx was down is never fired late (DR-11).
- Default for anything not converted: disabled through the existing write path (owner-approved run) and listed; one audit row
  per item (`door.path_converted` / `door.path_disabled`). External items (C4) are never touched.

## 7. Audit (decision 21)

Every attempt and outcome row of a WisKey door open (`action = intercom.release`, existing) carries in `details_json`:
`transport: trusted_door`, `entry_point` (`devices_tile`, `map_card`, `wiskey_screen`, `notification`, `run`, `door_job`),
`door_request_id` (the DTO `request_id`, UUIDv4), `body_sha256` (lower-case hex SHA-256 of the exact `signed_message_json`
bytes sent; computed after signing, recorded only in the audit), `granted_by`, `scope_type`, `scope_id`, `binding_id`,
`station` (`config_entry_id`), `relay`, `outcome`, `code`. For door jobs also `authorising_actor`, `origin`, `item_revision`.
Never the signature, key, nonce or the body itself. No change to the signed format (decision 21).
No migration is needed (`details_json` exists, V migration 0001). **W?**: WisKey records the same `request_id` (R, DTO); whether
WisKey can also record or recompute `body_sha256` for correlation is not verified and is not required for Arx's side.

## 8. UI (Hebrew; operator screens clean, no internal codes, no platform naming outside Settings)

| Situation | Operator text |
|---|---|
| success (`acknowledged`) | toast "נשלח"; tile badge "נשלח" for 5 s. Never "נפתח" (decision 22) |
| unknown | "לא ידוע אם נשלח" + button "בדיקת מצב" (status read only); the open button stays disabled for the relay hold |
| refused, no permission | "אין הרשאה לפתוח דלת זו" |
| refused, unmapped | "הדלת לא מוגדרת לפתיחה" |
| station offline | "התחנה לא זמינה" |
| clock invalid | "שעון המערכת לא אמין. פתיחה מרחוק מושבתת" |
| not paired / bridge down | "אין חיבור לתשתית המערכת" |
| relay busy | "פקודה קודמת עדיין בטיפול" |
| lock-all on a WisKey lock | "לא רלוונטי" |
| run refused (6.2) | as in 6.2 |

Settings (may name the infrastructure): cards "פתיחת דלתות" (4.2), "מיקום תחנות" (4.3), "שיוך דלתות" (4.4), "פריטים
שפותחים דלתות" (6.1), the two administrator settings (5.3, 6.3) and the feature flag "נתיב פתיחה מאובטח" (5.4). Every UI
slice ships desktop / mobile / RTL screenshots for loading / empty / error / ready (AGENTS.md).

## 9. Settings added

| Key | Values (default first) | Who | Audit |
|---|---|---|---|
| `doors.trusted_path` | `off` / `on` | system administrator, owner-approved step | `settings.changed` |
| `doors.editor_wiskey_steps` | `blocked` / `allowed` (selectable after D10a) | system administrator | `settings.changed` |
| `bridge.wiskey_execute_policy` (mirrored to the bridge) | `blocked` / `allowed` | system administrator | `bridge.policy.changed` |

None holds secret material. A restore from a backup never loosens them: the restored value is applied only when it is the
stricter one (`off`, `blocked`); a looser value in a backup is dropped and listed in the restore report (D, implemented with
`services/backup.py`).

## 10. Security review checklist (per slice, before merge)

- [ ] One authority: both routes call `door_authority.check`; grep test proves no other caller signs `door_open`.
- [ ] Deny across both permissions wins; kiosk, viewer, dev and unidentified principals never reach signing (T6, T11).
- [ ] Confirmation is never supplied by the server; notification tokens, service worker and email cannot open (T10).
- [ ] No fallback: a WisKey door never reaches `execute`, `lock.unlock` or `stations/test_unlock` with the flag on (T3).
- [ ] No retry, no queue, unknown stays unknown, restart leaves the attempt row and sends nothing (T4, T8).
- [ ] Mapping never by name or `unique_id` parsing; ambiguous -> refused (D1 tests).
- [ ] Station scope never grants above itself; unplaced station covered by installation only (D2 tests).
- [ ] Audit carries no signature, key, nonce or body; `body_sha256` only (T7, scan over every row of a fake run).
- [ ] Settings changes are system-administrator only, confirmed, audited; defaults fail closed; bridge default `blocked`.
- [ ] Editor block enforced on the server, including code mode (D8 tests).
- [ ] Arx-started runs: converted -> one `door_open` per door step; not converted or unresolvable -> refused (T19 revised).
- [ ] No HA naming on operator screens; Hebrew copy reviewed; no internal codes shown.
- [ ] Security-sensitive slices (D0..D5, D7, D9, D10) reviewed by a second Opus pass before merge.

## 11. Migrations, rollout and tests

### 11.1 Migration numbers

| Number | Content | Slice |
|---|---|---|
| 0077 | `bindings` rebuild with `access_control_station`; `intercom_station_placement` | D2 |
| 0078 | `intercom_door_map` | D1 |
| (0079) | reserved for CR-034 (`bridge_rotations`) | H2 |

Number note: the task said 0073 is DEVTYPE and 0076+ is free, but `origin/pilot/DEVTYPE-settings` carries
`0076_device_type.sql` today. This CR therefore starts at 0077. Final numbers are assigned at merge, as before.

### 11.2 Rollout order

1. D0 fakes -> D1 map and D2 scope (parallel) -> D3 authority and grant UX.
2. D4 transport (interim mode with the flag off, 5.5); D6 lock actions; add-on release.
3. D5a bridge 0.8.1, released only after the add-on of step 2 (5.5).
4. D7 inventory -> owner-approved read on the installation -> D8 editor block, D9 run guard.
5. D10 conversions only for what the inventory found.
6. D5b bridge `door_open` when WisKey's consumer is confirmed.
7. D11 gate (DR-8): T1..T22 on fakes, owner review of the conversion list; then, each with its own owner approval: the flag on,
   the owner's one-door acceptance test, and WisKey's lock-breaking release.

### 11.3 Test plan (models and fakes only)

Fakes: existing HA fake and `fake_ha_config.py`; new `FakeTrustedBridge` (DTO stages, closed codes, `door_open_status`,
injectable timeout after possible delivery); golden vectors v1..v3 as contract oracle; fake clock; fake WisKey overview with
configurable stations, locks and relays. Tests T1..T22 of the transition table, with these revisions:

- T6 extended: `access.release` only, `door.unlock` only, both, deny on either, station binding, placed/unplaced station,
  `door_opener` via user switch, via group, custom role switch on/off, revoked HA user.
- T19 revised (R-17): an Arx-started run of a converted item sends exactly one `door_open` per door step and no `lock.unlock`;
  a non-converted item is refused; an unresolvable item is refused; nested and parallel runs keep per-door request ids.
- New T23: door map fill order and refusal of ambiguous / name-only / unique-id-only cases.
- New T24: bridge 0.8.1 refuses `execute` on WisKey-platform locks under `blocked`, allows under `allowed`, refuses an unknown
  registry entry, and persists the policy without an entry reload.
- New T25: editor block on save for typed, schedule, scene capture and code mode; existing items editable; removal allowed.
- New T26: grant card: switch on/off creates and revokes only its own bindings; audit and revision bump.
- Existing suites kept green: `test_ha.py`, `test_ha_authority.py`, `test_devices.py`, `test_intercom.py`,
  `test_notify_*.py`, `test_schedules_*.py`, `test_bridge_*`, `test_automations_*`, `test_rbac_matrix.py`, `test_kiosk_role.py`,
  `test_wiskey_golden_vectors.py`, `test_wiskey_v3_addendum.py`.

## 12. Slices, effort and model

Agent-hours (calibration of CR-032: a typical Sonnet UI feature under 1 h). Opus for every security-sensitive slice.

| Slice | Content | Items | Hours | Model |
|---|---|---|---|---|
| D0 | `FakeTrustedBridge`, fake overview, fake clock, vector oracle | - | 3 | Opus |
| D1 | door map (0078), resolver, Settings "שיוך דלתות", T23 | 18 | 4 | Opus |
| D2 | station scope (0077), placement, `rbac.py` ancestry, patterns, wizard picker | 14 | 6 | Opus |
| D3 | `door_authority.check`, `door_opener` role, grant card, T6, T26 | 13 | 6 | Opus (backend) + Sonnet (card UI, 2 of the 6 h) |
| D4 | `trusted_door` open/status, A1/B1 swap behind the flag, audit fields, "sent" UI, T1..T5, T7, T8, T10, T11 | 21, 22 | 8 | Opus |
| D5a | bridge 0.8.1 execute block + signed policy message + Arx setting, T24 | 20 | 4 | Opus |
| D5b | bridge `door_open` / `door_open_status` (after WisKey confirms its consumer) | - | 8 | Opus |
| D6 | WisKey locks without `lock.lock`, lock-all skip, T9, T20 | - | 2 | Sonnet |
| D7 | inventory resolver and report, T12, T14, T16 | 15 | 6 | Opus (resolver is reused by D8/D9 for refusal) |
| D8 | editor block setting and server checks, T25 | 16 | 3 | Sonnet |
| D9 | R-17 run guard, T17, T18, T19 revised | 17 (rule) | 6 | Opus |
| D10a | Arx event door jobs (M1), conversion, disable-and-list, T13, T15 | 19 | 10 | Opus |
| D10b | hold-open program hand-over (M3), Arx side only | 19 | 4 (+ WisKey) | Opus |
| D11 | gate run of T1..T26 on fakes, review, release notes (bilingual) | - | 3 | Sonnet (run) + Opus (review) |
| | **Total** | | **73** (D10a/D10b only if the inventory finds items: 59 without them) | |

## 13. Contradictions and risks recorded (not resolved)

1. **Decision 13 vs. the transition table's recommendation (Q1 = `access.release` only).** The owner chose "either". The design
   keeps one authority function and adds "deny wins across both" so the wider grant cannot bypass an explicit deny.
2. **Decision 20's "allowed" value has no effect on Arx paths while R-17 holds.** The add-on never sends `execute` for a WisKey
   door (T3, closed rule). Setting the bridge policy to `allowed` only re-opens the bridge's `execute` to a caller holding the
   pairing key, which is only the add-on. The setting is built as decided, but turning it on changes nothing until a future
   change request alters R-17. Recorded so nobody reads "allowed" as "Arx opens through execute again".
3. **Decision 16's "allowed" depends on D10a.** It is built as decided, but selectable only once new door steps can be stored as
   Arx door steps; otherwise "allowed" would create items that R-17 refuses to run.
4. **Migration number 0076** is used by `origin/pilot/DEVTYPE-settings` (see 11.1).
5. **Bridge version.** 0.8.1 carries only the execute block (decision 20). `door_open` needs a later version (0.9.x), which must
   also carry CR-034's multi-key verifier if both are ready together; the order is in the implementation plan.
6. **W? items** in section 3 are blockers for enablement, not for building on fakes.
