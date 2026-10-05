# Door-open path transition table: Arx and Home Assistant, today vs. after the move to `smplwise_intercom`

Task WX2 (version 2.9.0). Written 2026-10-05 by the Arx lead (Claude, Sonnet 5.5). Due 2026-10-10 (promised to the WisKey team in `ARX_REPLY_TO_WINDOWS_MAC_D_REVIEW_2026-10-05_HE.md`, section "next dates").
Audience: the WisKey team (Codex), the product owner, and any Arx engineer who builds the move.

**Status: PROPOSAL FOR REVIEW. Documents only.** Nothing here starts runtime work, an install, a live run, a door action, a key action or a signing action. Every row below is a design for the owner and the WisKey team to approve. Tests named here are to be written with models and fakes. No lab, HA, NVR, WisKey runtime or secret was contacted to produce this document.

## 0. How to read this document

Evidence legend, used on every factual claim about code:

| Mark | Meaning |
|---|---|
| **V** | Verified by reading the code at Arx `main` (e7dfb451, 2.0.3) or the WisKey checkout (`C:\hik intercom`, read-only). File and symbol given. |
| **R** | Reported by a repository document (the Arx inventory of 2026-10-03 `ARX_LOCK_PATHS_INVENTORY.md`, the WisKey replies, the DTO draft). Not re-read in code in this pass. |
| **A** | Assumed: depends on Home Assistant core behaviour or on a WisKey change that is not built. Needs a fakes test, and for HA core behaviour possibly a live proof that nobody has approved. |
| **D** | Design proposal in this document (not a decision). |

Precedence when documents disagree (CLAUDE.md): approved change request, `MASTER_SPEC_HE.md` and `docs/security/`, then `AGENTS.md`, then this table. Contradictions are listed in section 9, not resolved silently.

Sources read in full: the six `private/wiskey-foldin` documents named in the task, the WisKey `ARX_TRUSTED_CALLER_SPEC_2026-10-03.md`, `ARX_TRUSTED_CALLER_DTO_DRAFT_v3_2026-10-04.md`, `ARX_LOCK_CALLERS_CHECKLIST_2026-10-03.md`, `ARX_CONSOLIDATED_GUIDANCE_FOR_WISKEY_2026-10-04.md`, `handoff/arx-exchange/README_HE.md`, `CONTINUE_HERE.md`; `docs/security/HA_IDENTITY_RBAC_HE.md` (sections 7, 8, 11) and the CR-017 amendment draft (section 2a); the Arx door-touching code listed per path; WisKey `lock.py`, `runtime.py` (service registration), `websocket.py` and `panel_permissions.py` for the door commands. The long WisKey `CODEX_MASTER_SPEC.md` and `docs/` tree were searched for door topics, not read end to end.

## 1. Decision references used in the table

These are the already-taken decisions this table must obey. Short ids are used in the per-path sections.

| Id | Decision | Source |
|---|---|---|
| **DR-1** | Arx RBAC is the single authority for an action started from Arx. WisKey applies no reauth, MFA, dual approval or its own policy on that path. | Owner; `WISKEY_TEAM_BRIEF.md` 1.5; `ARX_CONSOLIDATED_GUIDANCE` 1.2 |
| **DR-2** | Transport is the signed `smplwise_bridge.door_open` and read-only `door_open_status` (`return_response`, `signed_message_json`, protocol `wiskey-trusted-door-v1`, closed codes, no lock fallback, no long-poll, no retry). `execute` stays for every non-WisKey entity. | `ARX_CONSOLIDATED_GUIDANCE` 1.3, 1.7; DTO draft v3 |
| **DR-3** | Arx buttons that open a WisKey door (devices tiles, map/plan cards, WisKey screens) move to `door_open`. Real actor `{id, display_name}` of the Arx principal. No invented confirm. | Position update 2026-10-04, inventory section 3, item 1 |
| **DR-4** | `access.release` (`POST /intercom/stations/{id}/release`) and the notification deep link move to `door_open`; `acting_user` is the real actor inside the signed body; the WS command `stations/test_unlock` is not extended. | Position update item 2 |
| **DR-5** | Schedules and automations/scripts/scenes that Arx authored with a WisKey unlock move through this table with the real actor who approved or enabled the item, stored at confirmation time. An item with no such actor is disabled and listed to the owner. No actor and no confirmation is ever invented. | Position update item 3 |
| **DR-6** | Proven Home Assistant automations that Arx did not author are NOT blocked wholesale. This table must tell them apart from Arx-authored paths. | Position update item 3; `ARX_CONSOLIDATED_GUIDANCE` 1.7 |
| **DR-7** | The HA `lock` entity checks `context.user_id` against the WisKey policy; a call with no user is allowed only from an automation or script (proven by the server, `parent_id` alone is not proof). This is the HA-native path. It is not the Arx path. | `WISKEY_TEAM_BRIEF.md` 1.6; WisKey round 4 answer 3; checklist "classification" section |
| **DR-8** | No lock-breaking release before every path below is moved and tested with fakes (nested, parallel, no-user chains included) and the owner approves. | Position update item 4; `ARX_CONSOLIDATED_GUIDANCE` 1.7 |
| **DR-9** | Arx scope type for stations is named `access control station` (`scope_type: "access_control_station"`). | `WISKEY_TEAM_BRIEF.md` 1.10 |
| **DR-10** | The domain rename `hikvision_intercom` to `smplwise_intercom` is a separate release; old WS namespace and services stay as aliases for two releases. Arx must work with both names. | `WISKEY_TEAM_BRIEF.md` 1.3, section 4 |
| **DR-11** | Never queue or blindly retry a physical command; an unknown outcome stays unknown; a new open needs a new confirmation and a new request id. | `AGENTS.md`; DTO draft v3 sections 1, 7 |
| **DR-12** | Evidence status: the 82/82 vector result is a synthetic model report, not an implementation proof. Models and fakes only until separate owner approval for runtime. | `ARX_CONSOLIDATED_GUIDANCE` 1.8, section 4 |

## 2. Invariants of the target design

1. **One signer, one actor rule.** Only the Arx server signs a `door_open`. The `actor` is the Arx principal that made the request (`Principal.user_id`, which on Ingress and the remote channel is the Home Assistant user id: V `auth.py`, `HEADER_ID`) with `display_name`. A principal whose `source` is `dev` is never signed (V: `dev-<name>` ids exist only outside the add-on). A request with no identified principal is refused before signing.
2. **No actor is created to make a path work.** If a path has no real person behind it at fire time (an autonomous schedule, an HA automation), the signed message is not produced with a made-up actor. Allowed outcomes: the stored approving actor (DR-5, with the item's id and revision recorded next to it), the item is disabled, or the path stays a normal Home Assistant path under the WisKey policy (DR-7).
3. **No second authority in Arx.** For a WisKey door there is exactly one Arx permission check per request (section 4.2). Both the lock-tile route and the WisKey-screen route call the same server function.
4. **Same screens, same response shape.** The frontend keeps its tiles, dialogs and `ha_actions` polling (position update item 1). The server swaps the transport for a WisKey door only.
5. **No fallback.** A WisKey door whose station or relay cannot be resolved is refused. It is never sent through `execute`, through `lock.unlock`, or through the WS `stations/test_unlock` with the service token once the move is done (DTO: `lock fallback` is excluded).
6. **Acknowledged is not opened.** `acknowledged` means the command was stored and accepted. The UI note ("WisKey received the command; this is not confirmation that the door opened", V `access_control.py` `release()`) stays. WisKey's own lock entity is optimistic (V `lock.py`: `state_source: optimistic`, `display_pulse_seconds`), so Arx's `expect="unlocked"` confirmation of `lock.unlock` is unreliable by design; see failure mode F9.
7. **Both domain names.** Anything that recognises a WisKey lock must match platform `hikvision_intercom` and, after the rename release, `smplwise_intercom` (DR-10).

## 3. Master table (one row per path)

Columns: Id, path, today (real actor seen by HA/WisKey), target, decisions, risk (L/M/H), key test ids (section 8).

| Id | Path | Today | Target | DR | Risk | Tests |
|---|---|---|---|---|---|---|
| A1 | Devices screen, single lock tile, unlock | `POST /ha/entities/{id}/actions` `lock.unlock` -> bridge `execute` -> `lock.unlock` with `Context(user_id=<Arx user's HA id>)`. WisKey sees the real HA user; its lock entity checks nobody today. | Same route, same JSON. For a WisKey lock the server resolves (station, relay), checks the one permission, signs `door_open` with the principal as actor. Other locks unchanged. | DR-2, 3, 7 | H | T1, T2, T3, T6, T7 |
| A2 | Devices tiles panel, unlock dialog | Same as A1 (`devices-tiles-panel.ts` unlock dialog, `confirmed: true`). | Same as A1. | DR-3 | M | T1, T6 |
| A3 | "Lock all" and single `lock.lock` | `lock.lock` per lock, one at a time. WisKey rejects `lock.lock` (`forced_lock_unsupported`, V `lock.py`), Arx shows `failed` with the exception class only. | WisKey locks are not offered `lock.lock` and are skipped by lock-all with an explicit "not applicable", never "success". No `door_open` for lock. | DR-3 | M | T9 |
| A4 | Map, plan, home card actions on a lock | `anchors.py` returns `ha_bridge.actions_for(domain)` (includes `lock.unlock`) and execution goes through A1. | Follows A1 server-side; the action list for a WisKey lock drops `lock.lock`. No client change needed. | DR-3 | L | T1, T9 |
| A5 | Area-row lock icons, state tiles | Read-only state. | Unchanged. Test asserts they have no action. | n/a | L | T20 |
| B1 | WisKey screen: door release button | `POST /intercom/stations/{id}/release`, permission `access.release` at installation scope, `confirmed: true`, WS `stations/test_unlock` with the add-on's HA token. WisKey sees the infrastructure user, not the person. Arx audit holds the person. | Same route and body. Signed `door_open`, actor = principal. Relay guard, dedupe, envelope unchanged. | DR-1, 4 | H | T1, T2, T4, T5, T7, T8 |
| B2 | Notification deep link "open door" | Plain link `#/doors/<id>?confirm=<n>` -> in-app confirmation -> B1 with `origin: notification:<id>`. Notification tokens carry only `ack`/`snooze` (V `notify.py` `ACTIONS`). | Unchanged UI. Follows B1. `origin` stays in the audit row and is never trusted for authority. | DR-4 | M | T1, T10 |
| B3 | Kiosk and viewer principals | Refused (V tests `test_kiosk_role.py`, `test_rbac_matrix.py`). | Refused, plus fakes test that no `door_open` is signed for them. | DR-1 | L | T11 |
| B4 | Call answer / hang-up and TTS (also `access.release`) | WS `media/signal`, `tts/start` with the service token. Not a door movement. | Out of this table. They stay on the existing WS path until a later trusted-caller extension exists (DTO v1 has only `door_open` and `door_open_status`). Listed so nobody assumes the move covers them. | DR-2 | L | T21 |
| S1 | Schedule authored in Arx, step `lock.unlock` on a WisKey lock | Stored in the scheduler component; HA fires it with no user (A). Arx never executes it. Written with the author's context only at save time (V `schedule_service.py` `Context(user_id)`). | Converted (section 6) with the actor who confirmed it, or disabled and listed. The editor stops creating new ones against WisKey locks until the mechanism exists (D; question Q4). | DR-5, 8 | H | T12, T13, T14 |
| S2 | Schedule, step `lock.lock` | Stored, fired by HA. WisKey rejects it. | Shown as unsupported for WisKey locks; existing items listed to the owner; they are not "healthy". | DR-8 | L | T9, T15 |
| S3 | Schedule created in HA, not by Arx (`created_via = external`) | Fired by HA, no user. | Not touched by Arx. Falls under the HA-native rule DR-7. Listed in the pre-release inventory as "external". | DR-6 | M | T16 |
| S4 | "Run now" of a schedule from Arx | Run through the bridge with the caller's `Context(user_id)` (V `schedule_ops.run`, bridge `schedule_service`). | A door step runs as an interactive door open: same permission and confirmation as A1, actor = caller. No stored approver involved. | DR-3, 5 | M | T17 |
| C1 | Automation authored in Arx (`automation_meta.created_via = 'arx'`) with `lock.unlock`/`lock.open` | HA fires on its own triggers, no user (A). Typed builder emits `lock.unlock` (V `automation_policy.py`); code mode may contain `lock.open`. | As S1 (section 6). | DR-5, 8 | H | T12, T13, T14 |
| C2 | Script or scene authored in Arx with a WisKey lock step or member | Run by HA when called. Scene capture counts a locked/unlocked member as lock/unlock (V `automation_scope.py`). | As S1. A scene member for a WisKey lock is captured but flagged "cannot be applied by a scene" after the move. | DR-5 | M | T14, T18 |
| C3 | User starts an automation, script or scene from Arx (`trigger`, `run_script`, `apply_scene`) | Bridge call with `Context(user_id)`; inner `lock.unlock` inherits it in HA (A). | Same, plus a fakes test of nested and parallel chains. Under DR-7 the WisKey lock entity sees the real user; Arx RBAC `door.unlock` is already checked at run time for sensitive steps (V `automation_scope.py` `run_reasons`). | DR-3, 7 | H | T19 |
| C4 | Automation, script or scene created in HA by someone else (`created_via = 'external'`, YAML, integration) | HA fires; no user. | Never blocked by Arx (DR-6). Distinguished by `automation_meta.created_via`, `ha_config_items.source` and the config revision. Governed by DR-7 on the HA side. | DR-6, 7 | M | T16 |
| H1 | HA dashboard lock tile, more-info dialog (HA user) | Lock entity checks nobody (V `lock.py`): any HA user can open a WisKey door. | WisKey checks `context.user_id` against its policy; Arx is not involved; an Arx RBAC grant does not apply here (HA_IDENTITY_RBAC section 8 last paragraph). | DR-7 | M | WisKey fakes; Arx T22 |
| H2 | HA REST API, Companion app, Assist voice (HA user) | Same as H1 (user context). | Same as H1. Voice and API calls without a user are refused unless proven automation or script origin. | DR-7 | M | WisKey fakes |
| H3 | `hikvision_intercom.unlock_door` service (Developer Tools, YAML) | Registered with `async_register_admin_service` (V `runtime.py`): HA administrators and contexts with no user. | Not an Arx path. Alias rule per DR-10. An automation calling it is an HA-native path (H4). | DR-7, 10 | M | WisKey fakes |
| H4 | HA automation or script without a user that unlocks a WisKey door | Fires with `context.user_id = None`; allowed today (no check). | Allowed only with server-proven origin (DR-7); WisKey's design, not Arx's. Arx does not claim a mechanism. | DR-6, 7 | H | WisKey fakes: nested, parallel, manual run, restart |
| H5 | WisKey's own panel (embedded in Arx, or opened in HA directly) | Operator's own HA session; WisKey policy, locks and audit apply (V `wiskey-embed.ts` header; WS `stations/test_unlock` needs `overview:manage` or `stations:manage`, V `panel_permissions.py`). | Unchanged. The panel keeps WisKey policy until the owner retires it. Not an Arx RBAC path. | DR-1 (scope: Arx-started only) | M | n/a (WisKey) |
| H6 | WisKey autonomous door actions: hold-open programs, user timing, device schedules | Run inside WisKey (15 s tick, reconcile). | Unchanged and WisKey-owned: exactly one owner at any time. Recommended home for recurring "open from 08:00 to 17:00" schedules (section 6, option M3). | DR-8 | M | WisKey |
| H7 | Door device side: PIN, card, call answered by a resident | Device-local. | Out of scope. Not an Arx or HA path. | n/a | n/a | n/a |
| H8 | Non-WisKey relays and openers: `cover.open_cover` (gates, garage), `switch.turn_on` relays, `button.press`, `script.turn_on` wrappers | `ha_bridge.ACTIONS` rows with risk `attention`; `devices.control` reaches covers/switches, never locks (V `ha_scope.DEVICES_CONTROL_DOMAINS`). | Unchanged: the new rules apply only to entities whose platform is WisKey. A script or button that wraps a WisKey lock is path C2/C4. Listed so the inventory is complete. | n/a | L | T20 |
| X1 | Bridge-level guard | `execute` accepts `lock.lock` and `lock.unlock` for any entity (V `bridge/__init__.py` `ALLOWED_SERVICES`); Arx decides who may call it. | After the move `execute` stays for non-WisKey locks. The add-on refuses to send `execute` for a WisKey-platform lock. A bridge-side refusal is optional hardening (question Q8). | DR-2, 3 | M | T3 |

## 4. Cross-cutting rules

### 4.1 Detecting that an entity is a WisKey door

The server decides from the entity registry platform (`ha_entities.platform`, V: column exists) equal to `hikvision_intercom` or `smplwise_intercom`, then resolves the lock entity to (station id, `physical_index`). The station id is the opaque `ConfigEntry.entry_id` (DTO v3 section 2; WisKey's `stations/test_unlock` already takes the entry id, V `websocket.py`). The entity unique id is `{entry.unique_id}_door_{n}` (V `entity.py`), where `entry.unique_id` may be derived from hardware. Arx therefore must not parse it into a station id. D: resolve through the WisKey overview Arx already holds (`intercom_sync` stations with `locks[].physical_index`) joined to the entity registry device, and use the cache from `trusted_door_capabilities` only as a display hint (DTO: it is a hint, not authority). If the join is ambiguous or empty, the request is refused (`intercom_lock_unmapped`, new Arx code) and nothing is sent. Open item Q6: which join key WisKey will guarantee (config entry id on the entity registry row).

### 4.2 Permission and scope

Today (V `routers/access_control.py` `_releaser`, `roles.json`, `routers/ha.py`):

| Path | Permission today | Scope today |
|---|---|---|
| Lock tile unlock | `ha.entity.control` and `door.unlock` (+ `confirmation_grant: "confirmed"`) | the lock's own scope (floor/area/camera-style resolution, `ha_scope`) |
| WisKey screen release | `access.release` | installation only |

`door.unlock` is in `sensitive_permissions_not_implied` and no built-in role lists it; only a custom role created with it holds it (V `roles.json`, `test_ha.py` custom role "opener"). `access.release` is default only for `site_admin` and `system_admin` (V `roles.json`).

Target (D, needs owner approval, question Q1): a WisKey door is opened with `access.release` only, evaluated at the new scope type `access_control_station` (DR-9) with installation as fallback. `door.unlock` keeps governing non-WisKey locks. Consequence the owner must see: a custom-role holder of `door.unlock` who could open a WisKey door through the HA lock entity today would lose that unless they also hold `access.release`. Migration aid: a one-time read-only report from the Arx RBAC mirror, "principals with `door.unlock` over a WisKey lock but without `access.release`".

New scope type work (not built; V: bindings allow `installation|site|building|floor|camera`): a migration that rebuilds `bindings` (the same pattern as `0032_camera_scope.sql`), the three Pydantic patterns in `routers/access.py` and `routers/access_groups.py`, `rbac.py` scope resolution, and an ancestry rule (a station sits under a site or building; an `access_control_station` binding never grants anything above itself). The audit rows already carry `scope_type`/`scope_id`/`role_id`/`binding_id` (V migration 0032).

### 4.3 Real actor and audit, per class of caller

| Caller class | Who is the actor | What HA/WisKey sees | Arx audit row |
|---|---|---|---|
| Arx interactive (A1, A2, B1, B2, S4, C3 run) | the Arx principal (`user_id`, `display_name`) | after the move: WisKey audit entry with the same actor and the `request_id`; no HA user involved | `intercom.release` attempt row before send, outcome row after (existing behaviour, V). Added details: `transport`, `entry_point` (`devices_tile`, `map_card`, `wiskey_screen`, `notification`), `request_id` (UUID), `body_sha256`. Never the signature, secret or nonce. |
| Arx autonomous (S1, C1, C2 after conversion) | the stored approving actor, recorded as `authorising_actor`, together with `origin = schedule:<id>` or `automation:<id>`, item revision and the HA `context.user_id` (normally none) of the invoking call | WisKey audit: approving actor + request id | `intercom.release` with `phase`, `origin`, `authorising_actor`, `item_revision`; never presented as a person pressing a button |
| HA user, HA native (H1, H2, H3) | `context.user_id` | WisKey audit: that HA user (after DR-7) | none in Arx |
| HA automation or script without a user (H4, C4) | none; origin proof by WisKey (DR-7) | WisKey audit: `automation`/`script` origin | none in Arx (Arx may read it later; the Arx mirror records external items only as data) |
| WisKey panel (H5) | the operator's HA user | WisKey audit | none in Arx |

Rules: a request that arrives without an identified actor produces a `denied` audit row with `reason = identity_unmapped` (existing code, V `ha.py`) and nothing is signed. A conversion (section 6) writes one `door.path_converted` audit row per item with the approving actor, or `door.path_disabled` with the reason `no_approving_actor`.

### 4.4 How Home Assistant automations that Arx did not start are told apart

- **In Arx (mirror level, authoritative for Arx screens):** `automation_meta.created_via` (`arx` or `external`), `created_by`, `updated_by` (V migration 0048), the same for schedules in `schedule_meta` (V migration 0039), and `ha_config_items.source` (`ui`, `yaml`, `integration`, `dynamic`). Arx-authored means `created_via = 'arx'` AND the stored config revision equals the revision Arx last wrote (the bridge checks drift, V `test_bridge_config_drift.py`); an item edited later in HA's own editor is treated as external again and is listed, not converted.
- **In Home Assistant (runtime):** the lock entity cannot see Arx's mirror. WisKey decides by user id or by server-proven automation/script origin (DR-7). Arx cannot and does not provide the origin proof. Arx supplies only the pre-release inventory and, for converted items, the grant (section 6).
- **A user-started run from Arx** is the one case with a real person and a real HA context: `Context(user_id)` set by the bridge (V `config_service.py` `_run_op`, `schedule_service.py`).
- Honest limit (A): nested, parallel and no-user chains are not proven for every HA event chain. The pre-release fakes (T19) and the owner's one-door acceptance test are the only evidence planned.

## 5. Failure modes (Arx behaviour after the move)

The DTO closed code set (v3 section 9) maps to short operator messages that never echo input. Operator-facing text stays Hebrew; codes below are for engineers and audit.

| Id | Situation | Result | Arx behaviour |
|---|---|---|---|
| F1 | Permission or scope missing | refused before any signing | `denied` audit row; HTTP 403; nothing sent |
| F2 | No confirmation (`confirmed` not true, or `confirmation_grant` not `confirmed`) | refused | `confirmation_required`; nothing sent; no confirm is ever supplied by the server |
| F3 | Envelope expired, duplicate `client_request_id`, relay guard busy (`RELAYS`, 90 s safety, 10 s hold after unknown) | refused | existing codes `expired`, duplicate reply, `intercom_release_in_progress`; unchanged |
| F4 | Station or relay not resolvable, station offline in the overview | refused | `intercom_lock_unmapped` / `intercom_station_offline`; nothing sent; no `execute`/`lock.unlock` fallback |
| F5 | Pairing secret missing or bridge not paired | refused | `bridge_not_paired` (existing code in `run_action`); nothing sent |
| F6 | Clock invalid at the bridge (`time/clock_invalid`, `expired`, `not_yet_valid`) | `rejected` | message "the system clock is not trusted for door commands"; no retry; owner-facing health item |
| F7 | Capability or state reject (`capability_*`, `replay`, `request_id_conflict`, `relay_not_allowed`, `storage_unavailable`) | `rejected` | audit outcome `refused`; `relay_not_allowed` clears the Arx capability hint and refreshes it once, without resending |
| F8 | Timeout, transport error after the message may have reached the bridge | `unknown` | row outcome `unknown`; relay held (existing 10 s hold); Arx may call `door_open_status` for the same `request_id`, never signs the open again; a new open needs a new confirmation and a new UUID |
| F9 | `acknowledged` | command stored | UI note "not confirmation that the door moved". Arx does not run the `expect=unlocked` check for a WisKey door (the entity is optimistic with a pulse timer); the `ha_actions` record carries confirmation kind `none`, which the UI already renders as "sent" and never as "confirmed" (V `ha_actions.as_dict`, `ha_bridge.confirmation_kind`) |
| F10 | `stored_result` for an identical request | final | shown as the stored outcome; never re-executed |
| F11 | Add-on restart between send and answer | `unknown` | the attempt row stands; status read only; no automatic re-send after restart (DR-11) |
| F12 | Bridge or integration not loaded (HA restart, unload) | transport error | `unknown` if the message could have been delivered, else `not_sent` with the reason; no queue |
| F13 | Autonomous item whose approving actor was deactivated or lost the permission before fire time | not run | D: item disabled by the conversion rules, listed; a fire attempt never uses a stale actor (revoked access is re-checked at execution, HA_IDENTITY_RBAC section 11) |

## 6. Schedules, automations, scripts and scenes that Arx authored with a WisKey unlock (S1, C1, C2)

The owner's position (DR-5) fixes the principles; the mechanism is not decided. Three candidate mechanisms, each evaluated honestly:

| Option | What it is | Fits | Problems |
|---|---|---|---|
| **M1. Arx runs the door step** | The HA item loses its door step. An Arx "door job" bound to the item revision fires from an Arx timer or from an HA event and signs `door_open` with the stored approving actor. | event-driven automations | Arx process becomes an autonomous door owner (timer, restart behaviour, missed fire after an outage must not fire late: DR-11). New autonomous timer needing a place in the autonomous-timers list on both sides. Behaviour changes while Arx is down. |
| **M2. Standing grant in the bridge** | The HA item keeps its step but calls a new bridge service with a grant id. The bridge re-checks that the grant is active, bound to the item and its revision, and signs a fresh `door_open` with the approver as actor. | schedules and automations that must keep running when the add-on is down | New bridge service and a DTO addition (how the audit tells "authorised by X, invoked by an automation" from "X pressed a button"): a protocol change needing WisKey agreement and owner approval. HA administrators could invoke a grant id; the audit must record the invoker context so this is visible, not hidden. |
| **M3. Move recurring schedules to WisKey hold-open programs** | WisKey already owns door hold-open programs and timing (H6). The Arx schedule is replaced by a WisKey program; WisKey audits as itself. | "open from 08:00 to 17:00" style schedules | Needs a WisKey capability to create the program on behalf of an Arx operator, and owner agreement that WisKey, not Arx, owns this timer. |

D recommendation: decide by evidence. **First collect the inventory** (read-only, owner-approved, question Q3): if the owner's installation holds zero converted-eligible items, no mechanism is built; the release only adds a guard. If it holds items, use M3 for recurring time schedules and M1 for event-driven automations; keep M2 as the fallback only if the owner needs items to run while the add-on is down. In every case the default for an item that is not converted is the one the owner already chose: disabled and listed, never silently running, never silently dead.

Conversion procedure (applies to any option), D:

1. A read-only inventory query over `ha_config_items`, `automation_meta`, `schedule_cache`, `schedule_meta` (all Arx mirror tables) lists every item with a step `lock.unlock`, `lock.open` or a scene member captured as unlocked, whose target resolves to a WisKey lock (section 4.1), including items that reach it through a group, area, label or nested script. Reported by alias only, no entity ids, no addresses.
2. Classification per item: `arx_authored` (created_via `arx`, revision unchanged) / `arx_edited_externally` / `external` / `unknown`. Only `arx_authored` is a conversion candidate.
3. Approving actor: the audit rows of the creating or last confirming write (`schedule.create`, `schedule.update`, the schedule enable/disable rows, `automation.enable`, with `confirm_lowering` / confirmation recorded; V `schedule_ops.py`, `automation_ops.py`). Today there is no dedicated column; `created_by` and `updated_by` hold the latest editor, not necessarily the confirmer of the current revision. D: the conversion records `approved_by` and `approved_revision` explicitly, and only the confirmer of the revision that is live counts. If the live revision was written by A and enabled by B, the approver is B only if B's confirmation covered that revision; otherwise there is none.
4. No approving actor, an inactive actor, or an actor without `access.release` over that station: the item is disabled (HA side, through the existing write path) and listed. Nothing is run "as the system".
5. Every conversion and every disable is one audit row (section 4.3) and one line in the owner's list; the list is part of the release notes for the lock-breaking release.

`lock.lock` items (S2) are not converted: WisKey does not support them. They are listed as "will always fail" so Arx stops showing them as healthy.

## 7. Per-path detail

Format: current implementation (file, symbol on main e7dfb451) / target / decision / test / risk. Rows in section 3 give the actor and audit view.

### A1/A2 Devices tiles, unlock (and A4 map cards)
- Current (V): `routers/ha.py` `run_action` (validate, `ha_scope.control_allowed`, grant `door.unlock`, `confirmation_grant`, identity check, signed `execute` payload, `ha_client.call_bridge_execute`); allow-list `services/ha_bridge.py:137-138`; bridge `integration/smplwise_bridge/__init__.py` `execute` (`Context(user_id)`, `Unauthorized` -> `unauthorized`, other exceptions -> class name only); result mapping `services/ha_actions.py` `bridge_status`. UI: `frontend/src/screens/devices-controls.ts:544-558`, `devices-tiles-panel.ts` (single unlock dialog; "Never unlock-all" comment), anchors `routers/anchors.py:252`.
- Target (D): in `run_action`, after the common checks, when the entity resolves to a WisKey door (section 4.1) and the action is `lock.unlock`, call the shared server function used by B1 instead of `call_bridge_execute`. The `ha_actions` row is still created (`via` = `trusted_door`), the response keeps its shape, and the frontend is unchanged. `confirmation_grant == "confirmed"` is still required from the client, never added by the server.
- Decision: DR-2, DR-3, DR-1. Test: T1, T2, T3, T6, T7. Risk H: it is the most-used physical path and the permission change (Q1) is user-visible.

### A3 Lock all and `lock.lock`
- Current (V): `devices-tiles-panel.ts:748-770` sends `lock.lock` per lock; `services/device_bulk.py:149` keeps locks out of bulk actions; WisKey rejects the call.
- Target (D): the action list for WisKey locks omits `lock.lock` (`routers/devices.py`, `routers/anchors.py`, `ha_bridge.actions_for` with an entity filter); lock-all skips them and says so; no success is displayed. Decision: DR-3 and WisKey round 4 answer 1. Test: T9. Risk M.

### B1 WisKey screen release
- Current (V): `routers/access_control.py` `release()` (permission `access.release`, `confirmed is True`, `_RelayGuard`, `_perform`, attempt then outcome audit rows, `UNKNOWN_HOLD_S`), `services/intercom_client.py:275` `release_door` (WS `hikvision_intercom/stations/test_unlock {station_id, lock, api_contract}` over `ha_client.ws_session` with the add-on token), error classification `PRE_DEVICE` (`intercom_client.py:149`), frontend `api/intercom.ts:313`, `screens/wiskey-overview.ts:326`.
- Target (D): `_perform(...)` swaps `intercom_client.release_door` for a `trusted_door.open(actor, station, relay, request_id)` function that signs the DTO and calls `smplwise_bridge.door_open` with `return_response`. The attempt row is still committed before the call; the outcome row records the mapped DTO answer. `PRE_DEVICE` is replaced by the DTO stage/code table (section 5) so that `rejected` is "not sent" and `unknown` is "may have been sent".
- Decision: DR-4, DR-2, DR-11. Test: T1, T2, T4, T5, T7, T8. Risk H.
- Note (R, V for the WisKey side): while the WS command is not extended, a WisKey-side user check on the `lock` entity does not touch this path; after the move the path no longer uses the WS command at all.

### B2 Notification deep link
- Current (V): `services/notify.py` (`ACTIONS` = ack/snooze only), `notify_channels.py` deep link `#/doors/<id>?confirm=<n>`, `frontend/src/api/notifications.ts:1166` `openDoor` posts to the B1 route with `origin: notification:<id>`; `notify_visibility.py` shows the button by `access.release` (visibility only).
- Target: unchanged; follows B1. Test T10 asserts that no notification token, service worker or email path can sign or send an open. Risk M (a refactor of B1 must not create a tokenised open).

### S4 and C3 User-started runs
- Current (V): `schedule_service.py` and `config_service.py` `_run_op` use `Context(user_id=user.id)`; Arx pre-checks `run_reasons` (`automation_scope.py`) including `door.unlock` for sensitive steps.
- Target (D): for a step that resolves to a WisKey door, the run is judged as an interactive open (section 4.2) before the bridge call. HA then runs the item with the user context; WisKey's lock entity (DR-7) sees a real user. Both checks must agree; if WisKey refuses a user Arx allowed, Arx shows `denied`/`failed` with the mapped code and the fakes test records that the case exists (it is the "second authority" the owner wanted to avoid, accepted only for the HA-native lock entity, question Q5).
- Test: T17, T19. Risk H: this is where nested and parallel chains matter.

### X1 Bridge guard
- Current (V): `ALLOWED_SERVICES` in `bridge/__init__.py` lists `lock.lock` and `lock.unlock`; `lock.open` is never sent by Arx (absent from `ha_bridge.ACTIONS`, appears only in the sensitive regex of the builder policy).
- Target (D): the add-on never sends a WisKey door through `execute` (T3). Bridge-side hardening (refuse `execute` for a lock whose registry platform is WisKey) is optional and needs a bridge version bump.

## 8. Tests needed (models and fakes only; none run in this task)

Fakes: the existing HA fake and `fake_ha_config.py`, a new fake of `smplwise_bridge.door_open` / `door_open_status` that implements the DTO stages, the golden vectors v1-v3 as a contract oracle, a fake clock, a fake WisKey overview.

| Id | Test | Proves |
|---|---|---|
| T1 | Allowed open on every Arx entry point (tile, panel dialog, map card, WisKey screen, notification link) produces exactly one `door_open` with the principal as actor and exactly one attempt and one outcome audit row | one server function, no per-screen divergence |
| T2 | Every denial (no permission, wrong scope, no confirmation, expired envelope, duplicate id, relay busy, unmapped station) signs nothing and sends nothing; the fake bridge saw zero calls | DR-1, DR-11 |
| T3 | A WisKey-platform lock never goes through `execute` or `lock.unlock`; a non-WisKey lock still does | DR-2, no fallback |
| T4 | Unknown outcome: timeout leaves `unknown`, relay hold applies, only `door_open_status` is sent, a second open needs a new request id and confirmation | DR-11, F8 |
| T5 | Mapping of every DTO stage/code to Arx outcome (`rejected` vs `unknown`), no input echoed in messages | DTO section 9 |
| T6 | Permission matrix: built-in roles, a custom `door.unlock` role, a custom `access.release` role, kiosk, viewer, dev principal, group bindings, `deny` binding, expired binding, revoked HA user | Q1 outcome, section 4.2 |
| T7 | Audit content: no signature, secret, nonce or raw body anywhere (grep over audit rows and logs) | secrets rule |
| T8 | Add-on restart between attempt and outcome leaves the attempt row and no re-send | F11 |
| T9 | WisKey lock is not offered `lock.lock`; lock-all skips it with a visible "not applicable" | A3 |
| T10 | No notification token, service worker or email route can authorise or send an open | B2 |
| T11 | Kiosk, viewer and dev principals never reach signing | B3 |
| T12 | Inventory query on a synthetic mirror classifies items (arx_authored, edited externally, external, unknown, through group/area/nested script) and lists them by alias | section 6 |
| T13 | Conversion: approving actor present -> converted; absent, inactive, or lacking the permission -> disabled and listed; the confirmer of the live revision only | DR-5 |
| T14 | Round-trip: Arx writes an item, HA editor edits it, Arx no longer treats it as Arx-authored | section 4.4 |
| T15 | Schedules with `lock.lock` on a WisKey lock are listed as unsupported, never healthy | S2 |
| T16 | External items are never blocked or disabled by Arx | DR-6 |
| T17 | "Run now" of a schedule with a door step is judged as an interactive open | S4 |
| T18 | Scene capture and apply with a WisKey lock member | C2 |
| T19 | Nested script, two parallel runs, manual automation run, restart, permission change during a run, no-user run, against a fake HA that models `context.user_id` and `parent_id` | DR-8 gate |
| T20 | Read-only icons and non-WisKey relays (covers, switches, buttons) are unchanged | A5, H8 |
| T21 | Call answer, hang-up and TTS still use their existing path and permission | B4 |
| T22 | Arx RBAC does not grant or revoke anything in the HA-native lock path (documentation test: the table row text and a unit test of the permission names) | H1 |

Existing tests to keep green and extend: `test_ha.py`, `test_ha_authority.py`, `test_devices.py`, `test_intercom.py`, `test_notify_channels.py`, `test_notify_core.py`, `test_schedules_*.py`, `test_bridge_*`, `test_automations_*`, `test_rbac_matrix.py`, `test_kiosk_role.py` (names from the 2026-10-03 inventory section 4, R). Known gap (R, still true): no test makes the lock entity reject a user with a non-`Unauthorized` error; T19 and T6 close it.

## 9. Contradictions and items recorded, not resolved

1. **Brief 1.6 vs the position update.** The brief (owner, 2026-10-03) says the lock entity checks `context.user_id`. The position update (2026-10-04) says Arx buttons do not rely on that check but go through `door_open`. Both hold: the first for HA-native users (H1-H4), the second for Arx. Section 3 keeps them apart. Recording it so nobody reads the lock check as covering Arx.
2. **`access.release` scope.** Today installation only (V); the owner named a new scope type (DR-9) but nothing in code or in a task card builds it. Section 4.2 lists what that takes.
3. **WisKey's own lock check vs Arx RBAC as the only authority (DR-1).** Under C3/S4 a real user context reaches WisKey's lock entity and WisKey's policy applies there. Question Q5.
4. **Inventory document dates.** `ARX_LOCK_PATHS_INVENTORY.md` was measured on `g0/intake` at 0.1.156. This table re-read the current code on main 2.0.3 for every path it cites with a file and symbol; paths and behaviour found unchanged. Line numbers in the old inventory are stale and are not repeated here.
5. **`access.release` also covers call and TTS** (V `routers/access.py` labels). Changing the door transport does not change those; the permission name stays the same, so a reviewer must not read "release moved" as covering them (B4).
6. **Lab/owner facts unknown.** Which stored items, dashboards, Companion shortcuts, Assist sentences and external callers touch WisKey locks on the owner's installation is unknown (not collected; needs the read-only inventory in Q3). Nothing in this table claims it is covered.

## 10. Order of work implied by the table (no dates promised)

1. Owner answers Q1-Q8. 2. Read-only inventory query (Q3). 3. Fakes and tests T1-T22 on models only. 4. Arx implementation behind a disabled flag, only after the owner approves runtime work (DR-12). 5. Conversion list for the owner. 6. Gate (DR-8) then the lock-breaking WisKey release, each with separate owner approval; owner's one-door acceptance test at the end.

## 11. Open questions (numbered; recommendation first)

1. **Which Arx permission opens a WisKey door from a lock tile?** (a) recommended: `access.release` only, at scope `access_control_station` with installation fallback; report who loses access first. (b) both `access.release` and `door.unlock`. (c) either one. Why (a): one authority per door (DR-1), `access.release` is already the sensitive, default-narrow permission. Owner decides; Codex is not affected.
2. **Scope type build:** (a) recommended: build `access_control_station` before the lock-breaking release (migration like 0032, three patterns, `rbac.py`, ancestry). (b) ship with installation scope only and add the scope later. Owner decides; Arx builds.
3. **Inventory of stored items on the owner's installation:** (a) recommended: approve one read-only query of the Arx mirror tables (no HA write, no device contact) and report by alias. (b) owner lists them by hand. Needed before any conversion mechanism is chosen. Owner approves.
4. **Creating new `lock.unlock` steps against WisKey locks in the Arx editors after this release:** (a) recommended: refuse in the typed builder and the schedule editor with a message pointing to the buttons and to WisKey hold-open programs; existing items follow section 6. (b) allow, with the actor stored at confirmation time. Owner decides (it is the part of the superseded "block unlock" idea that is still sensible, limited to Arx-authored creation).
5. **Accept WisKey's user policy on HA-native lock calls, including Arx-started automation runs (C3, S4)?** (a) recommended: yes, and Arx shows a clear "refused by WisKey policy" message. (b) Arx-started runs of items with a WisKey door step are converted like autonomous items. Owner and Codex.
6. **Join key between an Arx lock entity and a WisKey station/relay (section 4.1).** (a) recommended: WisKey guarantees the config entry id on the entity registry row and keeps `door_<physical_index>` in the unique id stable across the rename. (b) Arx matches by name. Codex answers; (b) is not recommended (guessing).
7. **Mechanism for converted autonomous items (section 6):** (a) recommended: wait for the inventory (Q3); M3 for recurring schedules and M1 for event-driven automations; M2 only if needed. (b) decide M2 now. (c) disable everything and rebuild by hand. Owner decides; Codex confirms M3 feasibility (WisKey hold-open program created for an Arx operator, audit by WisKey).
8. **Bridge-side refusal of `execute` for WisKey locks (X1):** (a) recommended: yes, as a defence in depth in the next bridge version. (b) add-on only. Arx decides, owner informed.
9. **Audit field names and the DTO.** Arx wants `request_id` plus `body_sha256` correlated in both audits and, for converted items, an `authorising_actor` distinct from an invoker (only needed for M2). (a) recommended: use the existing DTO v1 for interactive paths unchanged; raise M2's DTO need only if M2 is chosen. Codex confirms the audit side.
10. **Confirmation display of `acknowledged`:** (a) recommended: Arx shows "sent" and never "opened"; no state check against the optimistic lock entity. (b) Arx also watches the WisKey door sensor if one exists. Owner decides; low priority.
