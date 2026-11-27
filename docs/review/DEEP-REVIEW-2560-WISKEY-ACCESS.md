# DEEP-REVIEW-2560 - area 3 `WISKEY-ACCESS` (id prefix `WA`)

Reviewed head: `origin/release/2560-train` at `57de3270c` (release 2.56.0 commit; contains released 2.55.0 plus the 2.56 rows, including
`WISKEY-VISIT-FILTERS-2560`). Plan: `docs/review/FINAL-REVIEW-PLAN-2560.md` section 3, area 3. Range read as new code: `v2.52.0..57de3270c`
on the area paths (36 files, +1,794 / -163, plus `routers/access_wiskey_visits.py` and the visit-filters row).

Method: read-only worktree; every new file and changed hunk in the area read end to end; old findings re-read at the head; one finding
confirmed with a small fake-port probe on the PC (no product host, no network). Bridge mirror byte identity checked file by file.
Nothing was run against WisKey, Home Assistant, a station or the lab.

## 1. Summary

| id | severity | title | file:line |
|---|---|---|---|
| WA-01 | medium | Emergency door sheet counts its 20 s confirmation down on the device clock: a device whose clock is >20 s ahead can never start an emergency | `frontend/src/door-windows/emergency.ts:221-230` |
| WA-02 | low | Schedule execution status: a failed review read after a successful one keeps the partial counts and shows a phase from half the reviews | `smplwise_vms/backend/smplwise/services/wiskey_schedule_execution.py:523-542` |
| WA-03 | low | Visit list: a status the WisKey filter contract leaves out is refused as `ended_filter_not_offered` | `smplwise_vms/backend/smplwise/routers/access_wiskey_visits.py:101-102` |

Counts: critical 0, high 0, medium 1, low 2. Old findings of the area (15): 13 FIXED, 1 PARTIAL (SCR-51), 1 STILL OPEN (WB-04).

## 2. Findings

### WA-01 (medium, CONFIRMED) Emergency sheet countdown on the device clock

`door-windows/emergency.ts:221-230` (`held()`):
`const until = Date.parse(this.prepared.expires_at); this.left = Math.max(0, Math.round((until - Date.now()) / 1000));` and every 500 ms,
when `left <= 0` while on the confirm step, the sheet drops the prepared token, goes back to `choose` and shows `emExpired`.
`expires_at` is on the SERVER's clock (`services/door_emergency.py:101,411`: `CONFIRM_TTL_S = 20`).

Failure scenario: a wall tablet or phone whose clock runs 25 s ahead of the add-on. The operator holds "open all doors" (or "lock"),
`prepareStart` succeeds, `until - Date.now()` is already negative, the first tick (500 ms) resets the sheet to `choose` with "expired".
Every retry does the same: from that device the emergency start can never be confirmed. A clock behind by N s shows N s more than the
server allows; the server then refuses the late confirm (safe, but the operator sees a countdown that lies).

This is the same root as SCR-13 (fixed for station / banner / access envelopes by `TIME-CORRECT-2540`, `api/server-clock.ts`
`serverNow()` learned from every answer's `Date` header), but the emergency sheet, which belongs to the same physical-action family,
was not moved to it. Same pattern, lower impact (longer TTLs, a write preview rather than an emergency):
`screens/wiskey-bulk-people.ts:275,474` (`canConfirm(..., Date.now())` gates the verified-CSV confirm button),
`screens/wiskey-profiles.ts:503` (`secondsLeft(p.expires_at, this.now)`).

Fix: compute the deadline on the server time line (`serverNow()` instead of `Date.now()` in the tick and in `canConfirm` / `secondsLeft`
callers), or have prepare return a relative `ttl_s` and count down from the receipt time (`performance.now()`). Add a unit test with a
skewed `serverOffset`.

### WA-02 (low, CONFIRMED by probe) Partial review counts after a failed review read

`wiskey_schedule_execution.py:523-542` `_read_reviews`: the loop increments `counts[state]` per review read and, on a `PortFailure` other
than `review_expired` or a `SchemaError`, returns `False` - but the counts already incremented stay, and `_check` (line 519) passes them to
`phase_of`. The docstring says "a failed read leaves the counts at zero and the phase falls back to `waiting_owner`".

Probe (fake port, PC, no network): pending lists two reviews of one job; the first reads `rejected`, the second read fails `unknown`.
Result: phase `rejected`, `reviews = {rejected: 1}`, `reviews_read: false`. The second review could be `pending` or `approved`
(phase priority approved > pending > rejected), so the screen shows "rejected in WisKey" for a job the owner is still approving.
Read-only and display-only (nothing is sent because of it), hence low.

Fix: count into a local dict and copy into `counts` only when the loop completes; or zero `counts` before `return False`. Add the
two-review case to `tests/test_wiskey_schedule_execution_2530.py` (today only a failure of the first read is covered, lines 247 / 313).

### WA-03 (low, CONFIRMED) Misleading refusal code for a status the filter contract omits

`WISKEY-VISIT-FILTERS-2560` lets `list_statuses` (`services/wiskey_visits.py:227-235`) return the contract's filters, which can be a
subset of the six default statuses (the contract only has to contain `all`). The route (`routers/access_wiskey_visits.py:101-102`)
still answers any status not in the list with `_unavailable("ended_filter", "ended_filter_not_offered")`. A WisKey that publishes
`["all","pending","approved"]` makes `?status=superseded` (a stale panel or deep link) fail with a reason about the ended filter.
Nothing is sent; the panel normally offers only the listed statuses. Fix: a generic `status_filter_not_offered` (or the ended code only
when `status == "ended"`).

## 3. Re-verification of old findings (area 3)

| old id | status at `57de3270c` | evidence |
|---|---|---|
| WB-01 | FIXED | People routes: `wiskey_direct_join.py:956` `people_send` -> `v2_refusal_of` (`:1052`, one helper); capture lease: `SelectingLeaseTransport._pick` `:565` raises `wiskey_direct_v2_refused` (in `access_control_door._NOT_SENT_CODES:126`); grant engine: `access_service_writer.select_path:298-319` -> `PATH_REFUSED`, `access_grant_engine.py` raises `EngineError("not_sent")`. Cards / delete keep the service channel by design (no direct contract). Media: `_V1OnlyFallback` (`intercom_media.py`) refuses a rotated key on the HA path. (WISKEY-NOFALLBACK-FIX-2520 + WISKEY-NOFALLBACK-2-2530) |
| WB-02 | FIXED | `native_keyset.py:152,182,194,230` `_same_pairing` read live before any check / save (BRIDGE-REPAIR-LEGACY-2520) |
| WB-03 | FIXED | discovery re-asked after a bounded back-off (`wiskey_direct_discovery.py`; module note in `wiskey_direct_join.py:48-51`) |
| WB-04 | STILL OPEN | `native_keyset.py:236-243`: a v2 message whose `ts` is above the saved mark still awaits `persist()` (a store write) - under steady traffic one write per second per kid. Plan: owner question 1 of LOWS-BRIDGE-GATE-2550, not built |
| WB-05 | FIXED | `routers/bridge_key.py` uses `v3.SOURCE.observe()`; `wiskey_service_grants_v3.py:265-284` answers a fresh `sent` observation of the current connection without a new read, double-checked under the lock (LOWS-BRIDGE-GATE-2550) |
| WB-06 | FIXED | `keyset.py:497-515` (bridge 0.10.10): the lock covers snapshot, op and save; rollback leaves the set dirty. Checked the interleaving with `native_keyset.verify`: a mark lowered by the rollback makes `saved_through` false and the message is refused `bridge_highwater_not_persisted` (the nonce cache survives `reload`), never admitted twice |
| WB-07 | FIXED | the bridge's own signed services share the `_same_pairing` fence (BRIDGE-REPAIR-LEGACY-2520) |
| SCR-01 | FIXED | `door-windows/emergency.ts:209-236`: each hold clears the old token; failure -> `nextStep(..., 'failed')` |
| SCR-11 | FIXED | `sw-incoming-call.ts` front call by id (`frontId`, `willUpdate`, `settled()` with `FRONT_SETTLE_MS` on `performance.now()`); door question bound to its call |
| SCR-12 | FIXED | `sw-incoming-call.ts` `openDoor` / `doorFailure` (`incoming-call-logic.ts:135-141`): unknown -> amber, per-door hold from `retry_after_s` (`access_control_door.py:111-112`), per-door sending set |
| SCR-13 | FIXED | envelopes on `serverNow()`: `api/intercom.ts:350`, `access-writes.ts:21`, `door-tech.ts:93`, `access-profiles.ts:221`; banner poll feeds the clock `intercom-calls.ts:98`. The emergency countdown was not covered: see WA-01 |
| SCR-41 | FIXED | `door-windows/logic.ts:250` `scopeForKind` exact match only; `emergency.ts:164,206`; the other kind's button disabled with `emScopeOtherKind` |
| SCR-42 | FIXED | `door-windows/logic.ts:258` `emergencyAfterFailure`; `screens/door-windows.ts:186` - only 403 / 404 hide the strip |
| SCR-50 | FIXED | `wiskey-station-people.ts:178-190` check bound to `acting`; `:222` transport failure -> `physicalOutcome` unknown (amber), `changed` dispatched |
| SCR-51 | PARTIAL | 403 ends every talk session (`sw-incoming-call.ts:378-382`); per-station busy set (`wiskey-station-permissions.ts:32,174-193`). A non-403 failed poll keeps the last answer and any live talk session - the open question of LOWS-FRONTEND-2550 stands (reasonable: the session keeps its own server-side expiry) |

## 4. Improvements (short)

- `wiskey_schedule_execution`: turning the switch off calls `reset()` (router line 91) while a status check may still be in flight; that
  check `_remember`s after the reset, so the next "on" shows one read from before the switch went off (with its own `read_at`, so
  honest). A generation counter checked in `_remember` would make "off forgets everything" exact.
- `access_station_permissions` (`wiskey-station-permissions.ts`): the busy set is keyed by station only, not by person: after switching
  person while A's change of station S is on its way, B's buttons of S are disabled too (harmless, just a short wait).
- Door technical changes (`access_control_door_tech.py:189-193`) ask step-up only when granted by `system.configure`; granted by the door
  administrator permission (a hold can keep a door open on a schedule) there is no step-up, unlike `open_door`. Owner's step-up list
  decides (step-up is opt-in); worth one line in MFA-REVIEW.
- Outside my paths, same SCR-13 root (device clock in a command envelope): `frontend/src/api/alarm.ts:54` (arm / disarm envelope),
  `api/notifications.ts:1216`, `api/media-players.ts:587,596`, `api/media-screens.ts:362`. The alarm one is a physical action; for the
  owning areas.

## 5. Checked and fine / not covered

Checked and fine:
- `services/wiskey_schedule_execution.py` end to end: only the three reads leave (`JoinPort.call` refuses anything else, and
  `wiskey_direct_catalog.direct_refusal` refuses decide / execute / preview / cancel `owner_action_in_wiskey`); closed readers (exact key
  sets, constants, job id match); timeouts 0 < t <= 58 s checked before sending; final phases not re-read; a failed read never
  downgrades a known view; per-job busy slot; memory bound 64. Router: GET / POST behind the unrestricted schedules administrator gate
  (audited 403), PUT system administrator + audit; switch off -> 409 `feature_disabled`, nothing sent; support read outside the DB
  connection. Frontend `wk-schedule-exec.ts` / `schedule-execution-logic.ts`: no approve / run / cancel control; `unknown` never shown as
  done; deploy warning softened only after an `executed` read.
- `services/wiskey_media_v2.py`, `wiskey_media_caps.py` (v2 diff), `intercom_media.py` (provider marker includes the v2 gate; switching
  closes the earlier provider; `_V1OnlyFallback`; `signing_problem` / readiness use the same rule); the gate reads the bridge version
  from the bridge's own hello (`routers/ha.py:742,787`), so an installed-but-not-restarted bridge does not open it; system-admin switch
  in `settings_patch/modules.py:97`; kept by backup.
- No-fallback after a v2 refusal across people routes, capture lease, grant engine (see WB-01); `access_service_writer.record` counts
  refusals without touching the last write path.
- Bridge 0.10.10: `keyset.Persister.control` / `_persist_held`, interleaving with `native_keyset.verify` (no double admission, no
  answer "ok" for a reverted step); `const.py` VERSION 0.10.10; mirror `smplwise_vms/integration/smplwise_bridge/` byte-identical to
  `custom_components/smplwise_bridge/` (every tracked file compared).
- `bridge_install._sweep_leftovers`: only the two exact suffixes, real directories, never a link, under the install `_lock`.
- `WISKEY-VISIT-FILTERS-2560`: contract parse fails closed to the 2.52 rule; discovery is cleared on reconnect, so a stale contract is
  not used.
- Door release path (`routers/access_control_door.py`): authority before confirmation, step-up before the relay is reserved, attempt row
  before sending, relay guard with unknown hold (`mark_unknown` after `settle` still holds), never retried; tile path idempotent by
  `client_request_id`.
- Call signalling / call log routers (`access_control_calls.py`, `intercom_calls.py`): per-station checks, live rows filtered by read +
  history permission, `answered_by` stripped; listen router: owner-only stop, socket re-checks `access.call` and the switch, audit on a
  read connection goes through `write_aside`.
- Station maintenance and door-tech routes: envelope, station visibility (404), permission, explicit confirmation, discovery, rate limits,
  each refusal audited.

Not covered (honest):
- Tests were NOT_RUN: the PC environment has no backend dependencies (`fastapi` missing), and the runner was left alone for the 2.56
  gate. Test assertions sampled only for schedule execution (gap noted in WA-02), visit filters and media v2.
- Still unread from the 2.52 index: `wiskey_native_write`, write lineage / journal, `wiskey_managed_install`, the installer routers,
  intercom sync / adapter / client internals, capture, messaging, `access_control_ws.py`, the media router websockets, the
  `wiskey_*` service files beyond those named above (most of the 81), `contracts/wiskey/`, `scripts/wiskey_*.py`, and the
  `hikvision_intercom` managed-copy drift check.
- Phone-width / RTL rendering of the new blocks, and anything executed against a real WisKey.
