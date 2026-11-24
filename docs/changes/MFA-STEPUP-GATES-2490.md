# MFA-STEPUP-GATES-2490 - step-up slice 3: the physical-safety gates, once-actions, the gaps of slice 1, the route-table ratchet

Branch `pilot/MFA-STEPUP-GATES-2490`, cut from `origin/pilot/MFA-STEPUP-2490` at `fb9a3ac1e` (slice 1, the central gate). Backend only:
no frontend file is touched (slice 2, the UI, is built separately on `pilot/MFA-STEPUP-UI-2490`), no wire / API inventory change, no
version bump, no lab / Home Assistant / NVR / go2rtc contact. Train plan and open questions of slice 1:
`docs/changes/MFA-STEPUP-TRAIN-2490.md` (sections 4-7). Precedence: `MASTER_SPEC_HE.md` and `docs/security/` first - both are silent on
step-up (checked: `MASTER_SPEC_HE.md`, `docs/security/HA_IDENTITY_RBAC_HE.md` and its two amendment drafts; the only second-factor
line, amendment draft "extended service identity" item 9, says door.unlock / alarm.bypass / alarm.disarm carry no sign-in factor
obligation today - a sign-in policy statement, not a step-up one), so the owner decisions of 2026-11-22 (Q45/Q46) and the design
`docs/design/full-2fa-t095/DESIGN.md` section 4.2 (`origin/pilot/FEATURE-DESIGNS-SEC-2490`) are the inputs.

## 1. Physical-safety actions (owner Q45 + the slice card)

`services/step_up.py`: `PHYSICAL_ACTIONS = {alarm.disarm, alarm.bypass, door.open}`; `guard_action(conn, request, principal, action)`
gates one at its choke point - after the action's own authorisation and confirmation, BEFORE any code is judged, any relay or slot is
reserved, any row is recorded or anything is sent. Outside an HTTP write request (a timer, an automation firing, a door window, the
engine) it is a no-op. Same switch (`security.step_up`), same window (`security.step_up_minutes`, default 5), same proofs, same
local-channel rule, same bearer / no-method exemptions as the settings gate. The 403 carries `details.action` and its own Hebrew text.
Nothing is queued or retried (MASTER_SPEC: unlock / disarm are never re-sent): the person verifies and taps again.

| Choke point | Action | Covers |
|---|---|---|
| `routers/alarm.py` `panel_action` | `alarm.disarm`; `alarm.bypass` for `arm_custom_bypass` | disarm, arming with the bypass set |
| `routers/alarm.py` `zone_bypass` | `alarm.bypass` when `bypassed = true` | zone bypass (restoring a zone is never gated) |
| `routers/ha.py` `_run_action` | by the bridge action's grant (`door.unlock` -> door.open, `alarm.disarm`) and `alarm_arm_custom_bypass` | a non-WisKey lock, an alarm panel not managed by the alarm screen |
| `routers/access_control_door.open_door` (the one door path) | `door.open` | the WisKey release route, the devices tile / map card (`open_from_tile`, its own connection), every converted run door |
| `services/automation_ops._door_plan` | `door.open`, once per run | an automation / script / scene run that opens converted doors (before the run starts) |
| `routers/door_windows.open_for` | `door.open` | "hold this door open for N hours" |
| `routers/wiskey_validation.pulse` | `door.open` | the acceptance pulse (local-only route: a no-op while `security.step_up_local` is off) |

Arming, restoring a bypassed zone, the door-automation emergency stop, emergency lock / open incidents and every everyday device action
are never gated (design 4.2 "never in the list"; see open question 2 for the emergency routes).

**Alarm-PIN fallback** (design 4.2 method `alarm_pin`, owner q24 a; train plan row 3): when an alarm action asks for the caller's
personal alarm code (`code_plan.prompt == "pin"`), that code - verified by the existing code gate in the same request, with its own
lockout - is the proof for that one action. No mark is kept; it never counts for anything else. The audit row of the action records
`step_up: alarm_pin`. With `alarm.remote_codeless = true` (default) a remote caller is not asked a PIN, so the authenticator code is used.

**Grace** (the slice card: "follow the security docs; if silent, use the same grace"): the security docs are silent, so the physical
actions use the same 5-minute window as settings. Recorded as open question 1.

## 2. Once-actions on the central proof (grace 0)

`ONCE_ROUTES` (= `EXEMPT_ROUTES` of the window gate):

| Route | Action id |
|---|---|
| `DELETE /auth/second-factor/users/{user_id}` (admin factor reset) | `auth.second_factor.reset` |
| `POST /system/bridge-key/revoke/reveal` (bridge-key reveal) | `bridge.key.code_revealed` |
| `DELETE /identity/local-users/{user_id}/passkeys/{pk_id}` (admin passkey removal - the third copy of the same ad-hoc check, found in this read) | `auth.local.passkey.removed` |

`step_up.once_proof()` replaces the two ad-hoc checks (`routers/second_factor.require_step_up`, shared by the reset and the passkey
removal, and the inline check in `routers/bridge_key.reveal_new_code`). A proof is needed on EVERY call, whatever the switch, window or
channel - exactly as before: the caller's own current code in the request (`X-Arx-Second-Factor` or the body's `code`, unchanged), or -
new - a once-proof from `POST auth/step-up/verify {method, code, action: <once action id>}`, bound to that action, the session and the
user, good for one call within 60 s (`ONE_SHOT_S`). A window proof or a sign-in proof never counts. Error codes and audit rows are
unchanged (`second_factor_step_up_required` / `step_up_required` / `step_up_unavailable`, `second_factor_invalid|locked`); the 403 now
also carries `details = {action, methods, minutes: 0, once: true, verify_path}` for the slice-2 sheet. The verify route accepts a
once action even when `security.step_up = off` or on the local channel (these routes always asked), and audits `auth.step_up.ok` with
`once: true`. Slice 1 window-gated the passkey removal on top of its own code (two asks); it is now on the once path only.

## 3. Gaps of slice 1 closed

1. **Authorisations without `require()`.** `step_up.on_grant()` is now also called by the authorities that grant a gated change
   themselves: `rbac_admin.assigns_anywhere` (the delegated-assigner path of `DELETE /access/bindings/{id}`, the group routes,
   `POST /access/door-grants/subjects`), `door_automation.set_settings` (system.configure) and `set_user_removed` (rbac.roles.manage),
   `access_visitors.set_visitor_entrance` (system.configure), the WisKey door technical writes when granted by system.configure
   (`routers/access_control_door_tech._begin`), the tickets department costs (`routers/tickets_costs._need_configure`) and the intake
   lexicon (`services/tickets/intake.lexicon_add|remove`). A GET, a read-only route or a caller outside a request is never gated.
2. **Handlers that open their own connection.** `main.CorrelationId` (innermost middleware) sets a request context
   (`step_up.enter_request`) that `step_up.request_of(conn)` falls back to when a connection was not linked by `auth._track` - so a
   `require()` on `db.connection()` / `write_aside` inside a handler is gated too. The context closes when the response starts
   (`close_request`), so a background task after the answer, or a streamed body, is never gated.
3. **Read-only POST routes.** `READ_ONLY_ROUTES` (the gate leaves them alone; each entry carries its reason):

| Route | Why not gated |
|---|---|
| `POST /access/preview` | the effect of a binding before it is saved - computed, nothing written |
| `POST /access/roles/preview` | the effect of a role edit before it is saved |
| `POST /access/groups/{group_id}/impact` | a group change applied in a savepoint and rolled back |
| `POST /ha-users/check` | a read-only probe of the user list; only the probe result is kept |
| `POST /nvr/encoding-batches/preview` | the plan of an encoding batch; nothing sent |
| `POST /access-control/installer/platform/import/preview` | import preview |
| `POST /access-control/installer/platform/retention/preview` | retention preview |
| `POST /access-control/installer/platform/config/read` | reads the station configuration |
| `POST /access-control/installer/platform/config/preview` | configuration preview |
| `POST /access-control/installer/platform/maintenance/preview` | maintenance preview |
| `POST /tickets/admin/message-templates/preview` | renders a template with sample values |
| `POST /tickets/rules/test` | a dry run on a read connection |

Connection tests (`.../connection/test`, `/system/secrets/{name}/test`, `/backups/offbox/targets/{id}/test`, `/announcements/test`,
`/multimedia/cast/test`, ...) and health "checks" stay gated: some reach out, play, or store their result (open question 5).

## 4. The route-table ratchet

`tests/step_up_route_scan.py` walks every write route of the real app (endpoint, FastAPI dependencies, and transitively every function
of the package they call - module functions, function-local imports, closures of dependency wrappers, constructors; a parameter that a
wrapper hands to `require()` counts as hooked) and lists the gated permissions (`GATED_PERMISSIONS | PHYSICAL_PERMISSIONS`) referenced
outside `require()`. `tests/test_mfa_stepup_gates_2490.py`:

* every write route passes only if it reaches an explicit gate (`guard` / `guard_action` / `on_grant`), is a once-action or a read-only
  route, or every such reference is listed with a reason: `ALLOWED_REFERENCES` (55 functions - views, ownership overrides, protective
  acts, permission names used as data, operational modules), `AFTER_REQUIRE` (11 refinements that are allowed only when the route also
  passes a gated `require()`), `ALLOWED_ROUTES` (5 routes that judge a door permission without opening anything);
* the 22 routes this slice gates must reach their gate (`MUST_GUARD`);
* no listed exception may be stale (every entry must still name a live route / reference).

The scan over-approximates on purpose (a reference is not always an authorisation); it runs in about 60 s on the runner.

## 5. Contradictions / findings (recorded, not resolved silently)

1. **Physical grace vs design.** Design 4.2 has `security.step_up_scope` (`alarm` / `alarm_doors` / `all_sensitive`) and
   `security.step_up_once_actions` (default: factor reset, role change to system admin, restore). This slice implements the owner's
   `all_sensitive` choice with no scope setting, and once-actions for exactly the three routes that already asked on every call.
   Role change to system admin and restore stay window-gated (open question 7).
2. **Door opening is not in Q45.** The owner's Q45 names alarm disarm and zone bypass; door opening comes from the lead's slice card and
   the design's `alarm_doors` scope (inside `all_sensitive`). Implemented as instructed; open question 1 covers its grace.
3. **`alarm_arm_custom_bypass` on the generic entity route** (`POST /ha/entities/{id}/actions`, an alarm panel not managed by the alarm
   screen) carries no `alarm.bypass` grant in `services/ha_bridge.py` (only `ha.entity.control`), while `HA_IDENTITY_RBAC_HE.md` says
   bypass arming needs `alarm.bypass`. Not changed here (an RBAC change, not step-up); the action is now step-up gated as a bypass.
   Recommend a separate fix.
4. **Runs of HA scripts / automations / schedules whose steps unlock or disarm** (not WisKey doors) are judged by
   `automation_scope.grant_reasons` / `schedule_view.action_reasons` but their "run now" is not step-up gated in this slice (only runs
   that open converted WisKey doors are). Open question 4.

## 6. Open questions (recommendation first; built to the recommendation)

1. **Grace for physical actions.** (a) the same 5-minute window as settings [built; the docs are silent; one setting is simpler for the
   owner]; (b) every disarm / bypass / door opening needs a fresh proof (window 0 for them only); (c) a separate
   `security.step_up_physical_minutes`.
2. **Door-adjacent configuration** (arming a door-automation block, door windows rules, map placement of a door lock, emergency open
   incidents, the emergency-open role grant): (a) not gated now - configuration / life-safety, each already behind its own permission
   and typed confirmation [built]; (b) gate the door-automation arming and window rules as "door" actions; emergency open stays ungated
   in any case (a fire must never wait for a code).
3. **The caller's own alarm code** (`PUT /alarm/me/pin`): (a) not gated - it already needs the current code [built]; (b) gate as an
   alarm action.
4. **"Run now" of an HA item whose steps unlock / disarm / bypass**: (a) gate it as the matching physical action in a follow-up (the
   step permissions are already computed by `grant_reasons`) [recommended]; (b) leave it to the item's own step permissions.
5. **Connection tests and health checks** (POST, `system.configure`): (a) keep them gated (they reach out or store a result) [built];
   (b) add them to `READ_ONLY_ROUTES`.
6. **Protective acts by an administrator** (ending another user's sessions / app sign-ins / devices): (a) never gated - stopping an
   intruder must not wait for a code [built]; (b) gate as "users" changes (design 4.2 lists "revoking others' sessions").
7. **Further once-actions** (design default: role change to system admin, restore): (a) add them with slice 10 (RESET-HARDENING) when
   the UI has the once-action sheet [recommended]; (b) add now.

## 7. Files

`smplwise/services/step_up.py` (physical actions, `guard_action`, once-actions, read-only routes, request context),
`smplwise/main.py` (request context in `CorrelationId`), `smplwise/routers/alarm.py`, `smplwise/routers/ha.py`,
`smplwise/routers/access_control_door.py`, `smplwise/services/automation_ops.py`, `smplwise/routers/door_windows.py`,
`smplwise/routers/wiskey_validation.py`, `smplwise/routers/second_factor.py`, `smplwise/routers/bridge_key.py`,
`smplwise/services/rbac_admin.py`, `smplwise/services/door_automation.py`, `smplwise/services/access_visitors.py`,
`smplwise/routers/access_control_door_tech.py`, `smplwise/routers/tickets_costs.py`, `smplwise/services/tickets/intake.py`,
`tests/step_up_route_scan.py` (new), `tests/test_mfa_stepup_gates_2490.py` (new).

## 8. Tests (real runs)

RESULTS_PLACEHOLDER
