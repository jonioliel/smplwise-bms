# CR-DOORWIN-295 - the Arx side of door windows and emergency door controls (build notes on CR-039)

Status: BUILT ON FAKES, SHIPPED OFF (branch `pilot/DOORWIN-295` from `origin/integ/293`). Design authority: `CR-039-DOOR-WINDOWS-AND-EMERGENCY.md`
(W0-revised, owner decisions of 2026-10-13) and the W0 fakes (`CR-039-W0-NOTES.md`). This note records what this branch builds, how the
owner's 2026-10-20 brief maps onto CR-039, every deviation, and the threat-model additions. Nothing here touched a WisKey, a station, a
door, a bridge, Home Assistant or a person.

Owner directive 2026-10-20: all WisKey-related DEVELOPMENT is allowed; ACTIVATION on real doors / people / hardware stays the owner's
separate per-action act. Therefore: every switch ships OFF, the live engines are refused by code constants (`GO_LIVE_PERMITTED = False` in
`services/door_windows_engine.py`), and every test drives fakes.

## 1. The brief, mapped onto CR-039

| Brief | CR-039 | Built here |
|---|---|---|
| schedule model, windows per door / group | 5.1 rules, rule doors, periods, calendar | migration **0130 (provisional number)**, `services/door_windows.py` |
| UI to define windows | 10.1 | new screen `#/wiskey/door-windows` (rules list, editor drawer, week preview, occurrences, override, relock card) |
| "an Arx-side scheduler with durable intents" | 4.1 (tier C forbidden), 4.4 watchdog | **interpreted per CR-039 SR-1**: Arx keeps the durable PLAN (occurrences) and the durable CLOSE-direction intents (relock retries with `next_retry_at`) in the database; it never sends an open from a timer. The engine (WisKey program, tier B) holds and relocks. See 2 |
| fail-safe: end not confirmed -> alarm + keep retrying the lock | 4.4, SR-3, SR-4 | `services/door_windows_watch.py`: `relock_unconfirmed` + critical notification, bounded close-direction retries (30/60/120 s), re-raise every 15 min until a person or the engine resolves it |
| DST-safe | 4.5 (window token) | occurrences follow WisKey's window-token semantics (wall-clock string compare in the station zone); spring gap and fall-back tested |
| audit | 12 | every write, transition, retry, override, confirmation, incident and per-door result |
| emergency lock-all / unlock-all | 8 | `services/door_emergency.py`, routes, sheet + strip UI |
| OFF by default | 13 | `doors.windows.enabled`, `doors.emergency.enabled`, `doors.emergency.open_enabled`, `doors.emergency.automations` all off |
| two-step confirm | 8.1 (hold + confirm) | UI hold-to-confirm (1.5 s) **and** a server-side two-step: `prepare` mints a single-use, user-bound, 20-s confirmation token (hashed at rest); `start` / `release` require it plus `confirmed: true` |
| permission-gated | 7 | four sensitive permissions (`access.windows.manage`, `access.windows.cancel`, `access.emergency.lock`, `access.emergency.open`), scope by the binding, deny wins per station |
| rate-limited | (new) | per user 1 start / 10 s and 5 / hour; installation 12 / hour; `prepare` 10 / min per user; drills counted separately |
| visible state | 8.1 strip | `GET /doors/emergency/state` + red strip on the door screens |
| never callable by automations unless explicitly permitted | 9.4 spirit | the service refuses any actor that is not an identified interactive person unless `doors.emergency.automations = on` (default off); no automation path is wired at all in this build |
| typed WisKey seam, fakes only | 4.2, 16 | `WindowEngine` and `EmergencyEngine` Protocols; live `Wiskey*Engine` classes refuse (`not_permitted`) and, below the guard, answer `not_implemented` (the six WisKey execution coordinators are NOT_IMPLEMENTED on the WisKey side) |
| he/en/ar/ru | - | one i18n module with all four languages |

## 2. Why "the Arx-side scheduler" never opens a door (SR-1 kept)

CR-039 4.1 forbids an Arx timer that sends "open" at a window's start and "close" at its end: a restart, a crash, a network loss or a
clock problem at the end would leave the door open with nobody knowing. The brief's "scheduler with durable intents" is built as:

1. The **plan** is durable: every occurrence (`door_window_occurrences`) is a row with its UTC instants, its zone and its window token.
2. The **engine write** is a schedule (one WisKey hold-open program per door, compiled from the rules), written only by the compile step,
   only when the compiled document changed (sha), and only through the typed seam - never a door command.
3. The **close intent** is durable: when the end cannot be confirmed, the occurrence holds `retries`, `next_retry_at`, `last_raised_at`; the
   watchdog (one tick every 15 s, resumes from the database after a restart) sends only `pause` (the close direction) and re-reads the
   revision before each attempt (W0 finding 2).
4. The static SR-1 test (`tests/test_fake_doorwin_closed_rule_sr1.py`) pins every open primitive and every program-write site; the
   timer-shaped modules (`door_windows_watch.py`) may hold neither an open primitive nor a program save.

## 3. Deviations from CR-039 (recorded, not silently resolved)

1. **Migration number**: CR-039 planned 0085-0088; the tree is at 0127. One file, **`0130_door_windows_emergency.sql` - provisional**, the
   lead renumbers at integration.
2. **Single-permission roles** (`door_windows_manager` ...) of 7.2 are NOT added: the four permissions sit in the built-in roles of 7.2
   and are grantable per user through a custom role (the existing T082 mechanism). Adding four built-in roles touches every pinned role
   list and the tickets slice-1 shared files; left to the lead.
3. **Event-triggered windows (9)**, the `arx_automation` step and the `ha_event` subscription are NOT built (slice W4). The schema keeps
   `kind` open for `event`, the rule editor offers weekly and one-off windows only.
4. **Exterior doors**: CR-039 13 adds a column to `intercom_door_map`; this build keeps the flag in its own table
   (`door_window_door_flags`) so 0078's table is untouched. `doors.windows.exterior_allowed` is off: a door flagged exterior cannot be in a
   rule.
5. **Holidays**: the calendar overrides (`holiday`, `holiday_eve`, `closed`, `regular`) are built; the generated Israeli holiday list
   (`special_days.py` extraction from `energy_calendar.py`) is NOT - the shared-file extraction is left to the lead.
6. **Tier A (station schedules) and Lockdown (U4)** are not built: no WisKey answer. The emergency LOCK is "Secure" only.
7. **Emergency OPEN** is built end to end against fakes and in drills; live it is fail-closed three times: the engine reports
   `open_supported = False` (no W13 hold-until), `doors.emergency.open_enabled` cannot be switched on without that capability AND the
   life-safety attestation, and `GO_LIVE_PERMITTED` is False.
8. **Home widget, spoken announcement, status-page segment, parity rows** (8.1, 11 announce, 14) are not built.
9. **The emergency lane** (4 slots) is a 4-thread dispatcher inside Arx; the real WisKey lane split (`intercom_client`) is untouched.
10. CR-039 lets an emergency LOCK pause a FOREIGN program (19.3). This build does not: without a live engine there is nothing to pause,
    and the exception needs WisKey's answer on U2 first. Recorded for the Fable review.

## 4. Threat model additions (on top of CR-039 section 15)

| # | Threat | Control (this build) |
|---|---|---|
| T17 | A replayed or forged confirmation (a captured `start` body sent again, or a request without the confirmation step) | single-use confirmation token, bound to user + action + kind + scope (+ incident for release), 20-s expiry, stored as SHA-256 only, consumed in the same transaction as the incident row; `confirmed: true` also required |
| T18 | Emergency spam (a stuck client, a malicious holder) flooding WisKey or alarming everyone | durable rate limits counted from the incidents table (survive a restart) + an in-memory `prepare` limiter; refusals audited `door.emergency.rate_limited` |
| T19 | An automation, a bearer-token client, a wall / kiosk account or an Arx-only local identity triggering an emergency | the service refuses unless the principal is an identified interactive person (`door_authority.identity_ok`, not a wall account, not `via=bearer`); `actor_kind != person` refused unless `doors.emergency.automations = on` (off; not wired) |
| T20 | The UI showing "door locked" while the engine only acknowledged a command | result words are engine words ("אושר על ידי המערכת"), never a physical claim; no door-position sensor exists (CR-039 18.2) |
| T21 | A switch turned on in a build that cannot act (a false sense of safety) | `doors.emergency.enabled` cannot be on while the live engine is not permitted; windows without a permitted engine run as tier D ("prepared"), which the screen states |
| T22 | An occurrence left `relock_unconfirmed` silently cleared by an admin switching windows off | the watchdog keeps judging non-terminal occurrences whatever the master switch says; only the engine or a person resolves them |
| T23 | A rule editor widening reach by adding doors outside their scope | every door of a rule checked with `access.windows.manage` on its station chain, deny wins; the doors list the screen offers is filtered the same way |
| T24 | Time confusion (DST, fixed offsets) opening a door at the wrong hour | occurrences in the station zone via zoneinfo and the window token; no fixed offset anywhere; tests at the 2026 Israeli transitions |

## 5. Test map

Backend (pytest, fakes only): `test_doorwin_compile.py` (periods, union, caps, calendar, DST, tokens), `test_doorwin_watch.py` (confirmation,
grace, unconfirmed + critical, bounded retries, re-raise, feed loss, Arx restart, manual confirm, override), `test_doorwin_api.py` (RBAC,
scope, deny, switches, preview, audit, no secrets), `test_door_emergency.py` (two-step token, replay, expiry, rate limits, automation
refusal, scope by binding, partial results, E-1 bounded open retry, OPEN over LOCK, release, drill never reaching the engine, attestation
gate, live engine refused). Frontend: unit specs for the logic modules, evidence specs with screenshots (desktop / mobile / RTL).
Untestable on fakes (NOT_RUN by design, W9 owner lab session): everything of CR-039 16 last bullet.
