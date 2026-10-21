# CR-039 - Door windows (timed hold-open schedules, event-triggered windows) and emergency door controls

Status: PROPOSED (design only, 2026-10-13). No product code, no migration file, no test and no device, door, key, station,
Home Assistant instance or WisKey was touched to write this. Branch `pilot/DOORWIN-spec` from `origin/main` 63311336
(release 2.4.9). The CR becomes binding only when the owner approves it; contradictions are recorded in section 19, not
resolved.

Companions this CR builds on (read them first): `CR-033-WISKEY-DOOR-PATH.md` (the one door authority, the signed trusted
path, the automation refusal, the inventory), `CR-033-INTEGRATION-NOTES.md`, `docs/release/2.4.9-INTEGRATION-NOTES.md`
(owner decisions of 2026-10-13, follow-ups), `CR-036-WISKEY-NATIVE-SCREENS.md` section 3.4 and `CR-036-S9-NOTES.md`
(the read-only schedules screen), `CR-038-TICKETS-MODULE.md` section 8.2 (single-permission roles bound per user, D25).

Precedence (CLAUDE.md): an approved change request, then `MASTER_SPEC_HE.md` and `docs/security/`, then `AGENTS.md`,
then this document.

Evidence marks: **V** read in Arx code at 63311336 (paths below); **R** read in Arx's static extraction of WisKey's rc.37
source (`docs/integrations/wiskey/WISKEY_SOURCE_EXTRACTION.md`) - WisKey's own behaviour as Arx understands it, not
confirmed by WisKey; **W?** unknown to Arx, asked of WisKey (section 3); **O** owner requirement of 2026-10-13.

## 0. Owner requirements (2026-10-13, binding) and where each is met

| # | Requirement (O) | Where |
|---|---|---|
| O1 | Door automations are mainly TIMED HOLD-OPEN WINDOWS: keep a door open for e.g. three hours between certain hours on certain days; both WEEKLY FIXED schedules and EVENT-TRIGGERED windows ("when X happens, hold open for N hours") | 2, 5, 6, 9 |
| O2 | Created in an Arx schedules screen that WRITES to WisKey (the 2.4.9 screen is read-only); event-triggered windows also from Home Assistant automations | 10, 9 |
| O3 | Holidays / special days, and a manual guard override that cancels a window mid-way, are probably wanted | 5.4, 5.6, 7.3 |
| O4 | An EMERGENCY button that LOCKS all doors and an EMERGENCY button that OPENS all doors (evacuation) | 8 |
| O5 (standing rules) | Arx RBAC is the only authority; WisKey is the engine; door actions go through the signed trusted-caller path, which is disabled until bridge 0.8.1 / the generalized W1 appendix; automations opening WisKey doors are refused today with no bypass; no physical action is exercised live without per-action owner approval; sub-agents use fakes only | 4, 7, 9, 13, 16 |

### 0.1 Owner decisions on this CR's questions (2026-10-13, after the first draft)
| Q (section 20) | Decision | Status |
|---|---|---|
| 1 exterior doors on software-relocked windows | **interior (and courtyard) doors first**; exterior only after U1 or a hardware review | **DECIDED** |
| 2 who holds `access.emergency.open` by default | **system administrators only** (grantable per user by the owner) | **DECIDED** |
| 6 spoken announcement at emergency start | **OFF** until the owner has heard the phrase in a drill | **DECIDED** |
| 3 Secure vs Lockdown | build **Secure** now; Lockdown when WisKey offers a command (U4) | recommended default, not yet explicitly confirmed |
| 4 guard override for operators by default | **yes** (`access.windows.cancel` in the operator role) | recommended default, not yet explicitly confirmed |
| 5 build order vs the tickets module | **in parallel, on fakes** - but see the shared-file rule in section 17 | recommended default, not yet explicitly confirmed |

The decided items are applied in 7.2, 13, 17 and the Hebrew summary; the three defaults stand until the owner says otherwise.

### 0.2 Revision from slice W0 (2026-10-14, owner-approved)
The fakes of slice W0 (`origin/pilot/DOORWIN-w0` @ 41a812fe, `CR-039-W0-NOTES.md` section 4) found ten points where the
first draft was contradictory or untestable; each is applied in place and marked "W0 finding n": 4.3 (any enabled program
needs pause + save-and-activate, also outside a window; the envelope never reaches WisKey), 4.4 (engine status only;
revision re-read before each close retry; interaction with WisKey's own 15-s close retry), 4.5 (DST by WisKey's window
token), 8.7 (the 30-doors-in-5-s target is conditional), 9.3 (the date-exception append is the two-step too), 16 (the
fakes are the `fake_doorwin_*` files, `fake_wiskey.py` / `fake_trusted_bridge.py` untouched; `device_unavailable` is not
in the pinned error catalog; what only the W9 lab can test), 3.3 (two W13 items added).

### 0.3 Revision from DOORWIN2-295 (2026-10-21)
The second build (`CR-DOORWIN2-295-BUILD-NOTES.md`, branch `pilot/DOORWIN2-295`, migration PROVISIONAL 0138) adds, on fakes and shipped off: event-triggered
windows (section 9, simulate-by-default; `armed` waits for the W1 automation actor), the generated holiday list (5.4, a wrapper over the energy calendar), the
four single-permission roles (7.2), the emergency pause of a FOREIGN program with its list (8.2 / 19.3; Arx never re-activates it), the spoken phrase (11, empty
until the owner types it), the doors home widget (8.1), and the Fable review 2 fixes W-01 (a cancel of a future window leaves the program), E-01 (a release never
depends on the master switch), E-02 (OPEN over LOCK releases the LOCK at the engine first), E-03 (a deadline at the seam), E-04 (owner 2026-10-21, "in an emergency we
always open": the bounded E-1 retry stays, the same request_id on every attempt, WisKey must confirm idempotency by request_id). Owner 2026-10-21: operators may end a
window AND confirm a relock (7.2 default stands); no second approver (W-02 accepted). Still blocked: WisKey's hold-until answer (U3) and the owner's life-safety attestation (8.9).

## 1. Goals and non-goals

**Goals**
1. A manager defines, in Arx, when a WisKey door is held open: weekly fixed windows, one-off windows, windows that an event
   starts, with holidays / special days and a per-door scope - and Arx writes the result to WisKey as the engine.
2. Every window is executed so that a failed "close" can never leave a door open unnoticed: the relock is guaranteed by
   the engine where the engine can guarantee it, and where it cannot, Arx confirms the relock, alerts a manager and shows the
   door as "relock unconfirmed" until a person resolves it (section 4).
3. A guard can end a running window early (override), and a manager can cancel a day (holiday) without editing the rule.
4. Two emergency controls - LOCK all doors, OPEN all doors - that are fast, hard to press by accident, scoped (all / a site /
   a building), reported per door with partial failure, audited, notified, drillable with fakes, and shipped OFF (section 8).
5. All of it under Arx RBAC with separate sensitive permissions, never tied to role names, grantable per user (section 7).

**Non-goals**
- Arx never becomes a door-timer of its own ("send open at the start, send close at the end" from the add-on is forbidden,
  section 4.1). Arx is the authority, the planner and the watchdog; WisKey (or the station) is the executor.
- No change to the signed DTO `wiskey-trusted-door-v1` (CR-033 decision 21) and no second door authority in Arx.
- No credential policy (who may badge in when) - that is WisKey's access schedule library (`schedules/*`), untouched.
- No lock command on a WisKey lock: WisKey rejects `lock.lock` (`forced_lock_unsupported`, R) and CR-033 D6 never sends it.
  "Emergency lock" is defined accordingly (section 8.2).
- No fire-panel integration, no life-safety certification claim (section 8.9).
- No live exercise by this CR or its implementation slices: every physical step is the owner's, per action.

## 2. Vocabulary

| Term | Meaning |
|---|---|
| **door** | one WisKey relay: (`station config_entry_id`, `physical_index`), as the door map knows it (V `services/intercom_doors.py`, migration 0078) |
| **window rule** | a saved definition: scope (doors), kind (`weekly` / `once` / `event`), recurrence, duration or end time, calendar policy, limits, owner, version |
| **occurrence** | one concrete planned hold-open of one door: `[start, end)` in the station's zone, derived from a rule (or from an event) - the thing that is executed, overridden, audited |
| **engine** | the component that physically holds and relocks: the station itself (tier A) or WisKey's hold-open program executor (tier B) - section 4.2 |
| **relock** | the engine returning the door to normal control at the end of an occurrence (`close` in WisKey's terms, R) |
| **override** | a guard ending a running occurrence now, or cancelling the rest of today's occurrences of a door |
| **emergency incident** | one LOCK-ALL or OPEN-ALL request, its per-door results and its explicit release |

## 3. What Arx knows about WisKey, and what it does not (the dependency map)

Everything below is **R** (rc.37 source extraction, Part E "Door programs", Part on `lock` entities) unless marked V or W?.
WisKey's answers to `private/wiskey-foldin/ARX_OPEN_REQUIREMENTS_TO_WISKEY_2026-10-13_HE.md` (W1 generalized trusted
caller incl. the automation actor, W2 schemas, W4 lock mapping, W5 error codes) and to the W2 selection table
(`ARX_W2_SELECTION_TABLE_2026-10-14_FOR_WISKEY_HE.md`) are pending. This CR adds one new request, **W13** (section 3.3).

### 3.1 Known (R)
- WisKey has per-door **hold-open programs**: one program per door, a weekly timetable plus date exceptions (`holidays`)
  in an IANA zone; `enabled`, `revision` (compare-and-set), `removing`, `execution {owned, attempted, status}` with status
  `idle / opening / held_acknowledged / restoring / unknown`; commands `stations/technical_program_list` (Arx reads it today,
  V `routers/access_control_reads.py`), `stations/technical_program_save {station_id, door, revision, policy, enabled}`,
  `stations/technical_program_action {.., action: pause | remove}`. There is no "resume"; reactivation is save-and-activate.
  Editing an enabled or owned program requires a prior pause (`hold_pause_before_edit`), which closes the door.
- The programs are **executed by WisKey inside Home Assistant** (a 15-second tick), not on the station:
  `native_supported: false`. Entering a window sends ISAPI `alwaysOpen`; leaving it, pause, remove, mapping problems or an HA
  restart while owned send `close`. WisKey's own hint text: "HA and network connectivity are required throughout the opening
  window. During an outage the door may remain unlocked until communication returns; this does not replace a local station
  schedule." After an unknown open outcome or an HA restart, WisKey does not re-open in the same window.
- The station advertises the remote-control commands `open, close, alwaysOpen, resume`; WisKey uses only `alwaysOpen` and
  `close` and assumes nothing about `resume`.
- `stations/test_unlock` is a **pulse** whose length is the device's `openDuration` (DoorParam, 1..255 s); it is the only
  door command Arx sends today (V `routers/access_control.py open_door`, interim transport) and it never holds a door.
- A WisKey `lock` entity's state is optimistic (a timer, not a sensor): `is_locked` = relay not in `released_relays`. There
  is **no door-position sensor** in WisKey's model. `lock.lock` is rejected.
- The hold-open **drafts** (`technical_hold_get / _save / _delete`) are storage only, `active:false`,
  `blocker: schedule_writes_unverified`; their editor is not mounted in WisKey's panel. Not used by this CR.
- WisKey rate limit per HA user: burst 30, 2/s, 8 concurrent handlers. Arx's lanes stay under it (V `intercom_client.py`).

### 3.2 Unknown (W?) - every design branch below is keyed to these
| Key | Question to WisKey | If YES | If NO |
|---|---|---|---|
| **U1** | Can a hold-open window be executed **on the station** (a device-side schedule with device-side relock), and can WisKey create / list / delete it? | tier A becomes the default engine (4.2) | tier B is the engine; the Arx watchdog (4.4) is mandatory |
| **U2** | Will the W1 generalized appendix cover `stations/technical_program_save / _action` with an Arx actor (human and `automation`), with `request_id` and WisKey-side audit? | Arx writes programs on behalf of the operator (10.3) | windows stay "prepared in Arx, applied in the WisKey panel" (tier D, 4.2) - the screen still works, the write button does not |
| **U3** | Is there (or will there be) a **hold-until** command: hold one door open until an absolute time with WisKey-side or device-side auto-relock, idempotent on `request_id`, and a matching release? | event windows and emergency-open use it (9.3, 8.4) | event windows use program date-exceptions with the pause constraint (9.4); emergency-open **cannot be enabled** (8.4) |
| **U4** | Is there a device-side **lockdown** (credentials refused) and its release? | "Lockdown" level of emergency lock (8.2) | emergency lock = "Secure" only (end every hold, `close` everywhere) |
| **U5** | What does the station do on **power loss / HA loss** while `alwaysOpen` is in effect (fail-secure vs fail-safe relay; does `alwaysOpen` survive a station reboot)? | recorded per station model in the door's technical view | assumed WORST CASE (door may stay open): the watchdog alerts, the owner's hardware review decides (8.9) |
| **U6** | Does WisKey emit a `subscribe` refresh when a program's execution status changes (W6)? | status is near-live | Arx polls `technical_program_list` on the watchdog cadence (4.4) |
| **U7** | Which program-save / action error codes are **before effect** (safe to call "refused") - W5 for these three commands | precise refusal mapping | everything but a proven pre-effect code is `unknown` (the CR-036 rule) |

### 3.3 New request to WisKey - W13 (written: `private/wiskey-foldin/ARX_W13_DOOR_WINDOWS_AND_EMERGENCY_REQUEST_2026-10-13_HE.md`; the owner forwards it)
"Door windows and emergency": (a) U1 - station-side schedules; (b) U3 - `doors/hold_until {station_id, door, until, request_id}`
+ `doors/hold_release {station_id, door, request_id}` + `doors/hold_status`; (c) U4 - lockdown; (d) U5 per supported model;
(e) an **emergency** command family that acts on a list of doors in one call with per-door results
(`doors/emergency_open {doors[], request_id, reason}`, `doors/emergency_release`, and `doors/emergency_secure`), or a
statement that Arx must loop per door; (f) U7 error codes; (g) whether a program can be saved with `enabled:true` while
inside a window without the pause step when the saved window equals the running one (needed by 9.4).
Added 2026-10-14 from the W0 findings: (h) the real error code WisKey returns for a program save / action while the
station is unreachable - `device_unavailable` is not in the pinned error catalog (U7); (i) whether a program hold is
reflected in the WisKey `lock` entity (`unlocked` during the hold) or only in the program's execution status (4.4 step 2).

## 4. The core safety principle and the execution tiers

### 4.1 The principle
**A window is executed by whoever can guarantee the relock.** Arx never sends "open now" at the start of a window and
"close" at its end from its own timer: an add-on restart, a crashed thread, a network loss or a clock problem at the end
would leave the door open with nobody knowing. The engine holds the relock responsibility; Arx holds the *plan*, the
*authority*, the *confirmation* and the *alarm*.

Corollaries (closed rules, each with a test in 16):
- **SR-1** No Arx code path sends `alwaysOpen`, `open`, a hold or a pulse from a timer or a scheduler. The only Arx-started
  opening remains `routers/access_control.open_door` (a person's confirmed click, or a converted item's run under CR-033 R-17).
- **SR-2** A window without an end does not exist: every rule has a duration or an end time; every occurrence has `end`.
  "Until released" exists only for an emergency incident (8), which is a different object with its own permission.
- **SR-3** Repeating an **open** after an unknown outcome is forbidden (DR-11 of CR-033). Repeating a **close** is allowed:
  closing is the safe direction, a second close on a closed door is harmless - but each repeat is a recorded attempt with a
  bound and a backoff (4.4), never a silent loop.
- **SR-4** When the relock is not confirmed by the end of the grace period, the door is shown as "relock unconfirmed"
  everywhere the door is shown, a critical notification reaches the managers, and the state stays until a person confirms it
  (looked at the camera / the door) or the engine reports the door closed. Arx never clears it by assumption.
- **SR-5** A window may not start while the door's previous occurrence is `relock_unconfirmed` (a new open on a possibly
  open door hides the problem). It starts only after the state is resolved.
- **SR-6** The engine's own safety behaviour (what the station does on power or network loss) is **U5**: until WisKey answers
  it is assumed to be the worst case, and the Settings page says so in one line next to the master switch.

### 4.2 The tiers (chosen per door, highest available; shown on the door's row as a word, never as a code)
| Tier | Engine | Relock guarantee | When it applies |
|---|---|---|---|
| **A - station** | the station's own schedule; WisKey creates / removes it (U1 yes) | device-side; survives HA / add-on loss | preferred; off until U1 is a yes and the station model supports it |
| **B - WisKey program** | WisKey's hold-open program executor in HA (R) created by Arx on behalf of the operator through the generalized trusted caller (U2 yes) | WisKey-side 15-s tick; **lost during an HA / network outage** (R); after HA restart WisKey sends `close` | the default engine on day one |
| **C - Arx timer** | - | - | **forbidden** (4.1) |
| **D - prepared** | nobody: Arx stores and shows the rule and its occurrences as "prepared", and the manager applies the program in the WisKey panel (`#/wiskey/tools`, the existing "עריכה בחלון האינטרקום" link, V `wiskey-schedules.ts`) | whatever the panel does | until U2 is a yes; also the mode when the master switch is off |

Tier D is what ships if WisKey answers "no" to U2: the screen, the rules, the calendar, the occurrences and the watchdog
(which only *reads*) all work; only the write button is replaced by "apply in the intercom window" with a copyable summary.
The spec therefore survives either answer.

### 4.3 How a rule becomes engine state (tier B, the day-one engine)
- Arx compiles a door's rules into **one** WisKey program per door (WisKey allows one program per door, R): the weekly
  union of the door's weekly rules, plus date exceptions for `once` rules, plus the calendar's effect (5.4). The compiled
  policy carries the window token Arx uses to recognise its own program (`schedule.name = "Arx <door> v<n>"`, the only
  free-text WisKey offers; max 32 chars, R).
- Save = `technical_program_save` with the program's current `revision` (compare-and-set); `enabled:true`. Before the save
  Arx reads `technical_program_list` and refuses the compile if WisKey's program for that door is **not Arx-named** (a
  program a person made in the WisKey panel is never overwritten; the screen says "the door has a program made in the
  intercom window" and offers "adopt" = read it into Arx as a rule, or "leave").
- **Every change to a live (enabled) Arx program is two writes: `pause`, then save-and-activate** - WisKey refuses an edit
  of any *enabled* program (`hold_pause_before_edit`), owned or not (R; W0 finding 1, pinned by
  `test_editing_an_enabled_program_needs_a_pause_even_outside_a_window`). Outside a window there is no physical effect
  (two writes, two revisions); inside a window the door **closes and re-opens within ~15 s**. The preview sentence says which
  of the two applies and the user confirms. The same two-step applies to the date-exception append of 9.3.
- The CR-036 envelope (`client_request_id`, `expires_at`, `confirmed:true`) lives **only in Arx's own route**: the pinned
  catalog (`docs/integrations/wiskey/catalog/rc37-contract.4/commands.static.json`) accepts no extra keys on the three
  program commands (`additionalProperties: false`; rc.37 answers `invalid_format`), so nothing of it is sent to WisKey, and a
  `request_id` reaches WisKey only once U2 is a yes (W0 finding 3). Every save and action is sent once; after an unknown
  outcome it is resolved only by re-reading `technical_program_list` (never by a repeated save). Compare-and-set failures
  (`revision_conflict`, in the pinned error catalog) are shown as "the program changed meanwhile - reload".

### 4.4 The relock watchdog (tier B; tier A as a cross-check)
A background family in `services/notify_sources.py` style (its own module `services/door_windows_watch.py`), cadence 30 s
while any occurrence is `active`, `ending` or `relock_unconfirmed`, otherwise idle:
1. At `occurrence.end`: state `ending`. Read `technical_program_list` for the door (one read per station, cached 15 s).
2. Confirmation rule: **only the engine status counts** - the program's `execution.status` is `idle` and `owned` is false
   -> `closed_confirmed`. The lock entity's mirrored state is used only as a *veto* (a state in `door_path.OPEN_STATES`
   blocks the confirmation) and never as a confirmation: whether a program hold is reflected in WisKey's optimistic lock
   entity at all is W? (the W0 default assumes it is not, so the entity reads `locked` throughout a hold; trap test
   `test_a_watchdog_that_trusts_the_entity_alone_would_be_caught`). The confirmation words on screen: "חזרה למצב רגיל
   אושרה על ידי המערכת" (never "the door is closed": nobody measured it).
3. Not confirmed within `doors.windows.relock_grace_s` (default 120 s; the tick is 15 s and WisKey's `restoring` state may
   take one or two ticks) -> state `relock_unconfirmed`: critical notification `door.relock_unconfirmed` (11), the door's row
   and chip turn to the warning state, and the **close-direction retry** starts: `technical_program_action pause` on the
   program, at most `doors.windows.relock_retries` (default 3) attempts with backoff 30 s / 60 s / 120 s, each attempt an
   audit row. Two facts shape the retry (W0 findings 2 and 6):
   - **WisKey retries on its own**: while it owns a door whose `close` failed, its executor re-sends `close` every 15 s (R).
     Arx's `pause` is therefore *on top* of WisKey's loop, not the only retry; it changes the program's desired state so the
     door is not re-opened and so WisKey's loop keeps the close direction after an HA restart. The backoff (30/60/120 s,
     bounded to 3) is deliberately coarser than WisKey's 15 s so the two never form a storm: at most 3 Arx writes + WisKey's
     own ticks per door, and never a write while the previous answer is outstanding.
   - **`pause` is idempotent for the door, not for the record**: every `technical_program_action` bumps `revision` (R), so
     each retry **re-reads the revision first** (from the same `technical_program_list` read the confirmation uses) and sends
     that revision; a stale revision is `revision_conflict`, which counts as a *refused* attempt (nothing happened), not as
     a success (pinned by `test_pause_is_idempotent_in_effect_but_bumps_the_revision`).
   A program that Arx paused for a retry is re-activated at the next occurrence's compile (4.3), never immediately.
4. After the retries: the state stays; the notification is re-raised every `doors.windows.reraise_min` (default 15 min)
   until resolved. Resolution: the engine reports idle (auto), or a person with `access.windows.cancel` or `.manage` presses
   "אימות ידני: הדלת סגורה" after looking (audited with the person; the UI asks "did you check the door or the camera?").
5. Feed loss: while the WisKey feed is not `ready` (V `intercom_sync.STATE`), the watchdog cannot read; an occurrence whose
   end passed during feed loss becomes `relock_unconfirmed` at `end + grace` regardless (fail loud), and the notification
   body says the system cannot see the intercom. This is exactly the case WisKey's hint warns about.
6. Start confirmation (informational): at `start + 60 s`, if the status is not `held_acknowledged` / `opening`, the occurrence
   is `not_started` (safe direction - the door is closed): an `alert` notification, no retry, no open from Arx (SR-1).

### 4.5 Clock and zone rules
Occurrences are computed in the **station's** display zone (`clock.zone` from `overview`, V `intercom_sync`), stored as UTC
instants plus the zone (AGENTS.md: no fixed offsets). A rule whose doors sit in different zones compiles per door. DST
transitions follow **WisKey's window token, not Arx's own idea of the day** (W0 finding 8): WisKey's executor compares
wall-clock strings in the program's zone, so a window that only partly overlaps the spring-forward gap (e.g. 01:30-02:30 on
the change day) is executed for the part that exists, not dropped; Arx computes its occurrences with the same token
function (the fake's `window_token` is the reference) so the plan and the engine never disagree. A window that would
occur twice (fall back) occurs once - one token, one hold - as WisKey does. A station whose clock drifts more than 5 min from Arx's
(`clock` in the health read, V) gets a warning on its doors' rows and the compile still proceeds (WisKey evaluates by HA's
clock, not the station's, R).

## 5. Data model (migrations 0085-0088)

**Migration range:** highest on `origin/main` is `0078_intercom_door_map.sql`; no `origin/pilot/*` or `origin/integ/*` ref
carries a file above 0078 today (checked 2026-10-13 by listing every remote ref's `migrations/` tree). CR-038 (tickets)
**reserves 0079-0084** in text; CR-034 noted 0079 for `bridge_rotations` before the tickets reservation (a contradiction
recorded in 19). This CR therefore takes the next free range **0085-0088** (0088 spare) and follows the repo rule
(`db.py` comments at 0061, CR-038 7): if another branch lands one of these numbers first, renumber at integration. All
tables prefixed `door_window_` / `door_emergency_`; every instant is ISO-8601 UTC text (`db.now_iso`).

### 5.1 `0085_door_windows.sql` - rules, calendar, versions
```sql
CREATE TABLE door_window_rules (
  id              TEXT PRIMARY KEY,            -- uuid4
  name            TEXT NOT NULL,               -- <= 60 chars, Hebrew allowed; shown on screens
  kind            TEXT NOT NULL CHECK (kind IN ('weekly','once','event')),
  state           TEXT NOT NULL CHECK (state IN ('draft','enabled','paused','retired')),
  zone_policy     TEXT NOT NULL DEFAULT 'station' CHECK (zone_policy IN ('station')),  -- reserved; always the station's zone today
  duration_s      INTEGER,                     -- event / once rules: the hold length; NULL for weekly (periods carry the end)
  end_policy      TEXT NOT NULL CHECK (end_policy IN ('period_end','duration')),
  calendar_policy TEXT NOT NULL DEFAULT 'skip_holidays' CHECK (calendar_policy IN ('skip_holidays','holidays_like_friday','ignore_calendar')),
  tier_pref       TEXT NOT NULL DEFAULT 'auto' CHECK (tier_pref IN ('auto','station','program','prepared')),
  max_per_day     INTEGER NOT NULL DEFAULT 1,  -- event rules: occurrences per door per day (<= doors.windows.max_per_day_per_door)
  cooldown_s      INTEGER NOT NULL DEFAULT 900,-- event rules: minimum gap between two triggers of the same door
  notes           TEXT,
  created_by      TEXT NOT NULL,               -- Arx user id (the principal), never an HA token identity
  created_at      TEXT NOT NULL,
  updated_by      TEXT, updated_at TEXT,
  approved_by     TEXT, approved_at TEXT,      -- the person whose confirming write covers the live revision (CR-033 6.4 rule)
  revision        INTEGER NOT NULL DEFAULT 1,
  retired_at      TEXT
);
CREATE TABLE door_window_rule_doors (            -- the rule's scope: explicit doors only (no "all doors" wildcard, 7.4)
  rule_id         TEXT NOT NULL REFERENCES door_window_rules(id),
  config_entry_id TEXT NOT NULL,               -- WisKey station id (opaque)
  physical_index  INTEGER NOT NULL,
  PRIMARY KEY (rule_id, config_entry_id, physical_index)
);
CREATE TABLE door_window_periods (               -- weekly: up to 8 periods per weekday (WisKey's own cap, R); once: one row with a date
  rule_id         TEXT NOT NULL REFERENCES door_window_rules(id),
  weekday         INTEGER,                     -- 0 = Sunday .. 6, NULL for 'once'
  on_date         TEXT,                        -- 'YYYY-MM-DD' for 'once', NULL for weekly
  start_hm        TEXT NOT NULL,               -- 'HH:MM'
  end_hm          TEXT NOT NULL,               -- 'HH:MM' or '24:00'; end > start; no overnight period (two periods instead)
  CHECK ((weekday IS NULL) <> (on_date IS NULL))
);
CREATE TABLE door_window_calendar (              -- special days (5.4): generated Israeli holidays are not stored, overrides are
  on_date         TEXT NOT NULL,
  scope_key       TEXT NOT NULL DEFAULT '*',   -- '*' = installation-wide; else the station's config_entry_id
  day_type        TEXT NOT NULL CHECK (day_type IN ('holiday','holiday_eve','regular','closed')),
  label           TEXT,
  set_by          TEXT NOT NULL, set_at TEXT NOT NULL,
  PRIMARY KEY (on_date, scope_key)
);
CREATE TABLE door_window_rule_versions (         -- every saved revision, for the audit drawer and "restore"
  rule_id TEXT NOT NULL, revision INTEGER NOT NULL, document TEXT NOT NULL, saved_by TEXT NOT NULL, saved_at TEXT NOT NULL,
  PRIMARY KEY (rule_id, revision)
);
```
### 5.2 `0086_door_window_runs.sql` - triggers, occurrences, engine state
```sql
CREATE TABLE door_window_triggers (              -- event rules only: what starts them (section 9)
  rule_id         TEXT PRIMARY KEY REFERENCES door_window_rules(id),
  source          TEXT NOT NULL CHECK (source IN ('arx_automation','ha_event','arx_button')),
  automation_id   TEXT,                        -- arx_automation: the converted item (CR-033 D10a) and its live revision
  item_revision   TEXT,
  event_type      TEXT,                        -- ha_event: the HA event type Arx subscribes to (allow-listed pattern, 9.2)
  event_match     TEXT,                        -- JSON: flat key = value filters on event.data (no templates)
  allowed_from_hm TEXT, allowed_to_hm TEXT,    -- the daily window inside which a trigger may start an occurrence (else refused + audited)
  authorising_actor TEXT NOT NULL,             -- the person whose approval covers the rule (CR-033 6.4); re-checked at fire time
  arm_state       TEXT NOT NULL DEFAULT 'simulate' CHECK (arm_state IN ('simulate','armed'))  -- 'armed' only after U2 + W1 automation actor (9.5)
);
CREATE TABLE door_window_occurrences (
  id              TEXT PRIMARY KEY,
  rule_id         TEXT REFERENCES door_window_rules(id),   -- NULL for an emergency-created hold (8) - those live in 0087
  config_entry_id TEXT NOT NULL, physical_index INTEGER NOT NULL,
  start_at        TEXT NOT NULL, end_at TEXT NOT NULL, zone TEXT NOT NULL,
  origin          TEXT NOT NULL CHECK (origin IN ('weekly','once','event','manual_extend')),
  trigger_ref     TEXT,                        -- event: the HA event's context id / the automation run id (for the audit pair)
  state           TEXT NOT NULL,               -- section 6
  tier            TEXT NOT NULL CHECK (tier IN ('station','program','prepared')),
  engine_ref      TEXT,                        -- program revision / station schedule id Arx wrote
  started_confirmed_at TEXT, ended_confirmed_at TEXT,
  resolved_by     TEXT, resolved_at TEXT, resolution TEXT,   -- 'engine_idle' | 'manual_checked' | 'override' | 'emergency'
  retries         INTEGER NOT NULL DEFAULT 0,
  created_at      TEXT NOT NULL
);
CREATE INDEX idx_dwo_door_time ON door_window_occurrences (config_entry_id, physical_index, start_at);
CREATE INDEX idx_dwo_state ON door_window_occurrences (state);
CREATE TABLE door_window_engine (                -- what Arx last wrote / read per door (the compile cache + CAS revision)
  config_entry_id TEXT NOT NULL, physical_index INTEGER NOT NULL,
  tier            TEXT NOT NULL,
  program_revision INTEGER, program_name TEXT, compiled_sha256 TEXT, written_at TEXT, written_by TEXT,
  last_status     TEXT, last_status_at TEXT, foreign_program INTEGER NOT NULL DEFAULT 0,  -- 1: a program not made by Arx exists
  PRIMARY KEY (config_entry_id, physical_index)
);
```

### 5.3 `0087_door_emergency.sql` - incidents, per-door results, drills
```sql
CREATE TABLE door_emergency_incidents (
  id              TEXT PRIMARY KEY,
  kind            TEXT NOT NULL CHECK (kind IN ('lock_secure','lock_lockdown','open')),
  scope_type      TEXT NOT NULL CHECK (scope_type IN ('installation','site','building')),
  scope_id        TEXT NOT NULL,
  drill           INTEGER NOT NULL DEFAULT 0,  -- 1 = drill / test mode (8.8): fakes only, never a real send
  state           TEXT NOT NULL,               -- section 8.5
  reason          TEXT,                        -- <= 200 chars, free text typed by the presser (shown to managers)
  requested_by    TEXT NOT NULL, requested_at TEXT NOT NULL, request_id TEXT NOT NULL,   -- uuid4, the W13 request_id
  released_by     TEXT, released_at TEXT, release_request_id TEXT,
  doors_total     INTEGER NOT NULL, doors_ok INTEGER NOT NULL DEFAULT 0, doors_failed INTEGER NOT NULL DEFAULT 0, doors_unknown INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE door_emergency_doors (
  incident_id     TEXT NOT NULL REFERENCES door_emergency_incidents(id),
  config_entry_id TEXT NOT NULL, physical_index INTEGER NOT NULL,
  phase           TEXT NOT NULL CHECK (phase IN ('apply','release')),
  state           TEXT NOT NULL CHECK (state IN ('pending','sent','acknowledged','refused','unknown','skipped')),
  code            TEXT, attempts INTEGER NOT NULL DEFAULT 0, last_at TEXT, settled_at TEXT,
  PRIMARY KEY (incident_id, config_entry_id, physical_index, phase)
);
CREATE TABLE door_emergency_attestation (        -- the owner's recorded acknowledgement before emergency-open can be switched on (8.9)
  id INTEGER PRIMARY KEY CHECK (id = 1), accepted_by TEXT NOT NULL, accepted_at TEXT NOT NULL, text_sha256 TEXT NOT NULL, version INTEGER NOT NULL
);
```
`0088` is the spare (renumbering slack / a column the implementation finds missing).

### 5.4 Holidays and special days
- Generated days reuse `services/energy_calendar.py` (V: Israeli holidays computed locally, with eves; manual overrides in
  a JSON setting) - its arithmetic is extracted into a shared `services/special_days.py` used by both energy and doors, with
  the generator choice `israel | none` kept per consumer (`doors.windows.calendar_generator`). No new dependency.
- A rule's `calendar_policy`: `skip_holidays` (default: a holiday has no window; a holiday eve is a Friday), `holidays_like_friday`,
  `ignore_calendar`. `closed` days (a manager's "the building is closed on this date") drop every window of every rule.
- The calendar compiles into the program's `holidays[]` date exceptions (R: `{name, start, end, periods[]}`) - a skipped
  day is an exception with no periods, a Friday-like day an exception with Friday's periods. WisKey's programs carry the
  exception, so a holiday is honoured **by the engine** even if Arx is down that day. Horizon: 400 days ahead, recompiled
  monthly and on every calendar change (the program document stays under WisKey's 64 KiB message cap, R: at most 8 periods
  x 7 days + ~60 exceptions - checked by a size test).

### 5.5 Ownership, versions, audit
- A rule belongs to the installation; `created_by` / `approved_by` are Arx user ids. The approver is the person whose
  confirming write covers the live revision (the CR-033 6.4 rule); a rule whose approver is inactive or lost
  `access.windows.manage` on any of its doors is **paused by the next compile** and listed (never executed on a stale
  approval; the same rule CR-033 applies to door jobs).
- Every save stores a version (5.1); the audit action set is in 12.

## 6. State machine of an occurrence

```
planned ──(engine write ok / tier D: shown)──> armed ──(start reached)──> starting ──(engine: held_acknowledged)──> active
   │                                              │                           │ (60 s, no ack)
   │ cancel / holiday / rule paused               │ compile failed            └──> not_started (safe; alert) ──> closed_confirmed
   └──> cancelled                                 └──> refused (safe; alert)
active ──(end reached)──> ending ──(engine idle within grace)──> closed_confirmed
   │                        └──(grace passed)──> relock_unconfirmed ──(engine idle | manual check)──> closed_confirmed
   ├──(guard override)──> overriding ──> (same ending branch; resolution = override)
   └──(emergency incident)──> superseded ──> (the incident owns the door until released; then ending branch)
```
- `relock_unconfirmed` blocks the door's next occurrence (SR-5) and the watchdog's retry loop runs (4.4).
- `superseded`: an emergency LOCK ends every active occurrence (the engine is told to pause each program; the incident's
  per-door result says whether the close was acknowledged); an emergency OPEN marks them superseded too (the incident's
  hold owns the door; when released, the occurrence does **not** resume - the next planned one starts normally).
- Tier D occurrences never leave `planned` / `armed`: they are a plan the screen shows; the watchdog still reads the
  program state and reports `active` / `closed_confirmed` for information, and raises `relock_unconfirmed` the same way.

## 7. RBAC - permissions, defaults, grants, scope

### 7.1 Permissions (new, all in `access.*` so a station-scoped role may carry them, V `rbac.STATION_PERMISSIONS`)
| Permission | Hebrew label (`routers/access.py PERMISSION_LABELS`) | Sensitive | What it allows |
|---|---|---|---|
| `access.windows.manage` | ניהול חלונות פתיחה | **yes** | create / edit / enable / pause / retire rules; adopt a foreign program; manual relock check; calendar edits for the doors in scope |
| `access.windows.cancel` | הפסקת חלון פתיחה | **yes** | the guard override: end the running occurrence of a door now; cancel the rest of today's occurrences of a door; manual relock check. No create / edit |
| `access.emergency.lock` | נעילת חירום | **yes** | start and release a LOCK incident (secure; lockdown when U4) in the binding's scope |
| `access.emergency.open` | פתיחת חירום | **yes**, **never delegable by default** | start and release an OPEN incident in the binding's scope |

Reads: the rules, occurrences and incidents are visible to `access.stations.read` (the permission that already gates the
schedules screen, V `shell/nav.ts NATIVE_WISKEY_TABS`), filtered to the stations the reader may see (`Authority.station`,
V `services/intercom_authority.py`). No new read permission: the screen's audience does not change.

Not reused on purpose: `access.schedules.manage` (catalogue-only today, V `intercom_authority.SENSITIVE_PERMISSIONS`) is
WisKey's *credential schedule library*; `access.release` is "open this door now, once". Holding a door open for hours and
locking a building are different decisions and get their own names (owner rule: permissions per task, never by role name).

### 7.2 Defaults (`roles.json`, `contracts/examples/role-catalog.design.json`)
| Role | gets |
|---|---|
| `system_admin` | all four (**owner decision 2026-10-13:** `access.emergency.open` is held by system administrators only; anyone else gets it by a per-user grant from the owner) |
| `site_admin` | `access.windows.manage`, `access.windows.cancel`, `access.emergency.lock` |
| `operator` | `access.windows.cancel` (the guard override; operators already hold `access.call`, 2.4.9 decision 2) - recommended default, not yet explicitly confirmed |
| `door_opener`, `viewer`, `kiosk`, wall accounts | none; a kiosk / wall account is refused at the authority step like a door open (V `door_authority` step 1) |
| **new single-permission roles** (the D25 pattern, CR-038 8.2) | `door_windows_manager` (ניהול חלונות פתיחה), `door_windows_guard` (הפסקת חלון פתיחה), `emergency_lock` (נעילת חירום), `emergency_open` (פתיחת חירום) - each holds exactly its permission plus `access.read`, `access.stations.read` so the holder can see what they act on |

Delegation (`routers/access.py DEFAULT_DELEGABLE`): `door_windows_guard` delegable by default; the other three are **not**
(a delegated administrator cannot hand out building-wide hold-open or emergency rights unless the owner adds them to
`rbac.delegable_roles`). All four permissions are listed in `sensitive_permissions_not_implied` and in
`intercom_authority.SENSITIVE_PERMISSIONS` so a custom role carries them only explicitly.

### 7.3 Per-user grants
As CR-038 8.2: a user binding of a single-permission role at installation / site / building / `access_control_station`
scope, optionally with `expires_at`, through the existing `POST /access/bindings` (V `routers/access.py validate_binding`,
audited `rbac.bind`). Settings › access control gains a sub-tab "הרשאות חלונות וחירום" listing who holds any of the four
and through what (role / group / direct grant), with "הוספת הרשאה למשתמש". One mechanism, one audit.

### 7.4 Scope rules
- A rule may include only doors on stations where the editor holds `access.windows.manage` on the station's chain
  (installation -> site -> building -> station, V `rbac.scope_chain` + placement 0077). Deny wins (the door-authority rule
  of CR-033 4.1 is reused verbatim for these permissions: `services/door_authority.check_permission(principal, station,
  permission)` is factored out of `check` so there is still one chain walk).
- An emergency incident's scope is the **binding's** scope: `access.emergency.*` at installation = all doors; at a site or a
  building = that place's placed stations only; a station-scoped binding = that station's doors only (the UI then says
  "all the doors you may act on: N"). A presser never chooses a scope wider than their binding; the dialog offers the
  narrower ones.
- No "all doors" wildcard in a rule: the scope is explicit doors, so a station added later is never held open by an old
  rule nobody re-read.

## 8. Emergency controls

### 8.1 Where and how they look (operator screens stay clean)
- One **"חירום"** entry, visible only to holders of `access.emergency.lock` or `.open` (anywhere on their chain) **and** only
  while the master `doors.emergency.enabled` is on: in the WisKey area's header (next to the refresh, V `wiskey-stations.ts`
  header area) and as an optional home-screen widget (`home-widgets.ts` family, off by default). It opens one sheet
  (`sw-sheet` on a phone, `sw-dialog` on desktop, V `components/`) with two large buttons: **נעילת כל הדלתות** (red outline)
  and **פתיחת כל הדלתות - פינוי** (red fill), each with the door count of the presser's scope and the scope picker
  (all / a site / a building, only those the binding allows). No paragraphs, no hints, no platform names.
- **Accident prevention that stays fast:** (1) the sheet is never one tap away from a list row - it opens from the header
  entry only; (2) the chosen button must be **held for 1.5 s** (a filling ring, `pointerdown`/`pointerup`, cancelled on move -
  the `wiskey-stations-actions.ts` arm/send state-machine precedent, V); (3) after the hold, a one-line confirmation with the
  count and the scope and a single "אישור" button, **no typed word** (a drill showed typing a word on a phone during an
  evacuation is not fast); (4) the sheet closes itself after 20 s without a decision; (5) `prefers-reduced-motion` keeps the
  ring static but the hold time stays. Latency budget from the final tap to the first door command leaving Arx: **< 1 s**
  (no reads before the send except the cached door list; the authority check is in memory).
- **While an incident is in effect** every screen that shows doors (stations, schedules, home widgets, map cards) carries a
  red strip "מצב חירום: <kind> · <scope> · <since>" with the **release** control for the holders of the same permission.
  The strip is the only place that releases; releasing is a hold-to-confirm too.
- Release: per door, `release` phase results; a door whose release is `unknown` stays flagged until a status read or a
  manual check (the same resolution rule as 4.4).

### 8.2 What "LOCK all doors" means (two levels)
| Level | Available | Effect per door | Ends |
|---|---|---|---|
| **Secure** (`lock_secure`) | day one (tier B): a program `pause` for every Arx-owned program + a `close` for every door that has a hold-until (U3) or is held by a foreign program (through `pause` of that program, which Arx never *edits* but may pause in an emergency - section 19 records this as a deliberate exception, audited) | every hold ends; the door returns to normal control: **credentials still open it** (WisKey has no lock command, R) | explicit release: Arx re-compiles the programs it paused (4.3); the windows that were superseded do not resume |
| **Lockdown** (`lock_lockdown`) | only if U4 is a yes | credentials refused at the station (W13) | explicit release |

The sheet names the level in plain words: "נעילת כל הדלתות - מסיימת כל חלון פתיחה; כרטיסים וקודים ממשיכים לפעול" vs
"נעילה מלאה - גם כרטיסים וקודים לא יפתחו". Until U4, only the first exists and the second button is absent (not disabled:
absent).

### 8.3 Interaction with manual door actions
- During **Secure**: a person with `access.release` may still open one door with the door button (someone must be let in);
  the attempt is audited with `under_incident = <id>` and the incident's strip says "נפתחה דלת ידנית: <door>". A window
  cannot start (6).
- During **Lockdown** (U4): the door button is refused with "נעילה מלאה פעילה" (409 `door_lockdown`), audited; only release
  clears it.
- During **OPEN**: the door button is a no-op shown as "הדלת כבר פתוחה במצב פינוי"; windows cannot start; the override
  cannot end an emergency hold (only release can).
- **Precedence:** emergency > override > window > manual pulse. Two incidents cannot be in effect at once: starting one while
  another is in effect requires releasing the first inside the same sheet (the sheet shows "מצב חירום פעיל - שחרור תחילה"),
  except OPEN over a LOCK (evacuation beats lockdown: allowed in one step, the LOCK is released as part of the OPEN's apply
  phase, both audited).

### 8.4 What "OPEN all doors" needs (and why it cannot ship without W13)
- Holding every door open "until released" needs a hold with an engine-side guarantee of *staying* open **and** an explicit
  release: `alwaysOpen` per door with a release of `close`. Arx has no command for that today: `test_unlock` is a pulse of
  `openDuration` seconds (R), and a WisKey program is a *schedule*, not a command. Looping pulses every few seconds is
  rejected as a transport (rate limits, 8 handlers, and a missed pulse re-locks a fire exit).
- Therefore **emergency OPEN enables only when WisKey offers a hold-until / emergency command (U3 / W13-e)** and Arx can call it
  through the generalized trusted caller (U2) with the real presser as actor. Until then the OPEN button does not exist in
  the sheet, and the Settings row says "ממתין לממשק מצד מערכת האינטרקום". The drill mode (8.8) exists anyway, against fakes,
  so the UX, the reporting and the training are built and tested before the command exists.
- Apply phase: one request per door (or one W13 batch call if offered), each with its own `request_id`, sent once; a door
  whose answer is `unknown` is **retried in the open direction only inside an emergency OPEN** - the one exception to SR-3,
  justified because the harm of a closed exit during an evacuation exceeds the harm of a double open, bounded to 3 attempts
  10 s apart, each an audit row, and the per-door state says "unknown after 3 attempts" with the camera link. This exception
  is a closed rule (E-1) with its own test and is named in the threat table.
- If hardware fails safe/secure differently per door (U5), the per-door result also shows the station's known behaviour
  so the person at the sheet knows which exits may need a key.

### 8.5 Incident state machine
`requested` -> `applying` (per-door `pending` -> `sent` -> `acknowledged | refused | unknown`) -> `in_effect`
(all acknowledged) | `in_effect_partial` (some refused / unknown; the strip lists them by name with a camera link) ->
`releasing` (per-door release phase) -> `released` | `released_partial`. A `drill` incident takes the same path against
the fakes and is labelled "תרגיל" everywhere, including in the audit and the notification (a drill never notifies by
critical push; it notifies by inbox only, 8.8).

### 8.6 Per-door result reporting and partial failure
The sheet turns into a live list after the confirmation: door name, station, result word (נשלח / אושר / נדחה / לא ידוע),
the camera thumbnail link where the station has one (V `entities.camera` in the stations feed), and for refused / unknown
the next step ("בדיקה במצלמה", "פתיחה ידנית"). Nothing is hidden behind "success": a partial result is the headline
("7 מתוך 9 אושרו"). The list stays available from the strip for the incident's lifetime and in the audit afterwards.

### 8.7 Latency, feed and fail-safe
- Target: first command out < 1 s after the final tap. The emergency incident gets its **own lane** of 4 slots that only
  incidents use (the action lane holds 2, V `intercom_client` lanes), so an announcement or a card capture cannot delay it;
  the lane is sized under WisKey's 8 handlers with the other lanes. "All 30 doors sent within 5 s" is **conditional** (W0
  finding 7): with per-door commands it holds only while WisKey answers each in under about 0.7 s (8 rounds of 4); with the
  W13-e batch command it is one call. Real latency is unknown until W9; the status page shows the measured per-incident
  "last door sent after N s" so the owner sees the real number.
- Without a WisKey copy / feed not ready: an incident is still **started** (the door list comes from the last known copy,
  V `intercom_sync.SYNC.has_copy()`), and each door's result is `unknown` with the reason "אין חיבור למערכת האינטרקום";
  this is the one place Arx sends on a stale copy, because a stale list of exits is better than no evacuation command
  (named in the threat table; the SEC-WXD L5 rule for single opens stays).
- Power / network loss at the station: **U5**. Arx shows what it knows and never claims a physical state.

### 8.8 Drill / test mode
- `POST /doors/emergency/drill` with the same body as a real incident; the service binds a `FakeEmergencyEngine` (the
  `tests/fake_wiskey.py` family, extended) for that incident only: it answers per door from a scripted table (ok / refused /
  unknown / slow), so the trainer can rehearse partial failure. Nothing reaches WisKey, the bridge or HA. The drill is audited
  as `door.emergency.drill` and notifies the managers by inbox only. Drills are available even while the master switch is
  off (that is their purpose) but need the same permission as the real control.
- The Playwright and backend tests of 16 are built on this same engine.

### 8.9 Life-safety statement (shown in Settings, recorded as an attestation)
Emergency OPEN and LOCK act on door hardware whose behaviour under fire, power loss and local regulation (fire exits,
panic hardware, the fire panel's own release, the Israeli standard requirements for escape routes) is **outside Arx's
knowledge and outside WisKey's documented model** (U5). Before `doors.emergency.open_enabled` can be switched on, the system
administrator must read and accept a fixed text (stored by hash and version in `door_emergency_attestation`, audited with
the person and the time) that says: a review of the door hardware and the escape routes by the owner and a qualified
fire / life-safety professional under local regulation is the owner's responsibility; Arx does not replace a fire alarm
panel's release; the feature **ships OFF by default**; any live exercise of either control needs the owner's per-action
approval and happens in a coordinated session with the owner present. The attestation is per installation and is void
(the switch returns to off) when the text version changes.

## 9. Event-triggered windows and the Home Assistant automation action

### 9.1 Three trigger sources (`door_window_triggers.source`)
| Source | Who defines the event | How it reaches Arx | Authority at fire time |
|---|---|---|---|
| `arx_button` | a person presses "פתיחה ל-N שעות" on the door's row (10.2) | a confirmed click | the person's own `access.windows.manage` (or `.cancel` is **not** enough) - audited as the person |
| `arx_automation` | an automation built in Arx's automation builder (CR-017) with the new typed step **"חלון פתיחה לדלת"** (door + duration); stored as an **Arx door step**, never as `lock.unlock` in HA - exactly the CR-033 D10a shape | `ha_sync` already mirrors `automation_triggered {entity_id}` (V `services/ha_sync.py AUTOMATION_EVENTS`, `automations.on_ha_event`): the run is matched to the item id + live revision, the door job creates the occurrence | the stored `authorising_actor` (the approver of the live revision), re-checked for `access.windows.manage` on every door at fire time; none / inactive / lost -> refused + listed (CR-033 6.4 rule) |
| `ha_event` | any HA automation (also one written outside Arx) fires a custom event `smplwise_arx_door_window` with `{rule_id, token}` | a new `subscribe_events` of that one event type in `ha_sync` (the `REGISTRY_EVENTS` pattern, V) | the rule's `authorising_actor` as above; plus the rule's `token` (a per-rule random secret shown once at creation, stored hashed) so a stray event with a guessed id does nothing; plus the rule's allowed hours, `max_per_day`, `cooldown_s` |

### 9.2 Anti-loop and rate rules (all three sources)
Per door: at most `max_per_day` occurrences per day from events, `cooldown_s` between two, never while an occurrence is
`active` (a second trigger **extends** the running occurrence to the later end instead, once, audited as `manual_extend`
origin), never while `relock_unconfirmed` (SR-5), never outside `allowed_from_hm..allowed_to_hm`, never for more than
`doors.windows.max_hours`. Installation-wide: at most 20 event starts per hour; beyond it the trigger is refused, audited
and a `door.windows.storm` alert is raised (the automations storm rule precedent, V `automations.storm_auto_disable`).

### 9.3 Execution of an event occurrence (engine)
- With U3 (hold-until): `doors/hold_until {station, door, until, request_id}` through the trusted caller, one send, outcome
  `sent / refused / unknown`; the engine relocks at `until`; the watchdog confirms as in 4.4. Clean and preferred.
- Without U3 (tier B only, 9.4): the occurrence becomes a **date exception** `{name:"Arx event", start: today, end: today,
  periods:[{now, until}]}` appended to the door's Arx program by `technical_program_save`. Because the program is enabled,
  the append is **always** the two-step `pause` + save-and-activate of 4.3 (W0 finding 1) - outside a window that is two
  writes and no physical effect; the door then opens on the next 15-s tick. If the program is currently **owned** (the door
  is held by a weekly window right now) the event occurrence is a no-op *inside* that window and an extension only if its
  end is later - and the pause step then **closes the door for ~15 s** (R). Arx refuses that extension by default
  (`doors.windows.event_extend_owned = false`) and audits "would have extended"; the manager may allow it knowing the blink.
  W13-g (E3 in the request document) asks WisKey to allow a save without the pause when the running window is unchanged.
- After an unknown save outcome: re-read `technical_program_list`; if the exception is present -> `armed`; if not ->
  `refused` (safe) and alert. Never a second save (the compile sha prevents it).

### 9.4 Lifting the automation refusal - only through the signed automation actor
Today `services/door_run_guard.py` refuses every Arx-started run of an item with a WisKey door step and says the feature
is not supported yet (V, 2.4.9 decision 5); `door_path_guard.py` refuses *new* door steps in the editors while
`doors.editor_block = blocked` (V, `ALLOWED_SELECTABLE = False`). This CR keeps both as they are and adds the lift in the
one place CR-033 designed for it:
1. **Conversion source (D10a):** `services/door_windows_conversion.py` implements `door_run_guard.ConversionSource`
   (V the Protocol) for items whose door steps are **Arx window steps** (typed step "חלון פתיחה לדלת" stored in
   `automation_meta` as `{kind: "door_window", station, relay, duration_s}`); `set_conversion_source` is called at start-up
   **only when** `doors.automation_actor = on` (new setting, 13) **and** the installed WisKey contract reports the W1
   automation actor (`overview.api.capabilities` lists it - the field name is W?; until then the setting cannot be switched
   on, the `MIN_BRIDGE_FOR_TRUSTED_PATH` precedent, V `trusted_door.py`).
2. **Editor:** `door_path_guard.ALLOWED_SELECTABLE` becomes true for the window step only (never for `lock.unlock`): the typed
   builder offers "חלון פתיחה לדלת" and refuses `lock.unlock / lock.open / unlock_door` on a WisKey lock exactly as today.
3. **Actor toward WisKey:** the W1 `automation` actor `{type: automation, automation_id, item_revision, approving_user}`
   (the shape Arx proposed in the open-requirements document 2.3); Arx's three conditions hold: creation permission at the
   editor, automation id in every request, the per-door "gate" = `access.windows.manage` of the approver on that door.
4. **Until the appendix exists:** an `arx_automation` / `ha_event` rule can be saved and run in **`simulate`** arm state: the
   trigger is received, the occurrence is computed, the audit row and an inbox notification "היה נפתח חלון: <door>, <until>"
   are written, **nothing is sent**. Switching a rule to `armed` requires `doors.automation_actor = on`. This is how the
   feature is built and demonstrated now and switched on later without a code change. There is **no bypass**: a simulated
   rule cannot be armed by any setting while the capability is absent (fail closed).

### 9.5 HA-side action text for the owner's automations
An HA automation that should start a window does **not** call `lock.unlock`; it fires
`event: smplwise_arx_door_window, event_data: {rule_id: "<id from the rule's row>", token: "<the rule's token>"}`. The
rule's drawer shows a copyable YAML snippet. Anything else (a `lock.unlock` on a WisKey lock from HA's own automations) is
outside Arx's path (CR-033 DR-7) and is listed by the inventory as before.

## 10. Screens and integration points (file paths are the ones to touch)

### 10.1 The schedules screen becomes read-write (`#/wiskey/schedules`)
- Files: `frontend/src/screens/wiskey-schedules.ts`, `wiskey-schedules-css.ts`, `frontend/src/access-control/schedules-logic.ts`,
  `frontend/src/i18n/access-schedules.ts` (its own module; English column optional, Hebrew complete), `frontend/src/api/access-schedules.ts`
  (+ new `api/door-windows.ts`), `frontend/src/components/sw-week-grid.ts` (**already has `editable`** and `modes`, V - the
  edit mode draws windows by dragging, 15-minute snap, max 8 periods a day as WisKey allows).
- Gate: the tab stays behind `access.ui.schedules = smplwise` (V `routers/settings.py` DEFAULTS, `shell/nav.ts`); the
  **write** controls appear only with `access.windows.manage` on a visible station and the master switch on. With the master
  off, the screen is byte-for-byte the 2.4.9 read-only screen (its evidence and pixel baselines stay valid).
- Per-door view gains: a "חלונות" block (the rules that cover this door, each a row: name, kind, hours, state word, engine
  word "תחנה / מערכת האינטרקום / מוכן להחלה"), the next three occurrences with their state words, the override buttons for
  `access.windows.cancel` ("סיום החלון עכשיו", "ביטול להיום"), and the relock-unconfirmed card when present (one line + the
  camera link + "אימות ידני").
- The "עריכה בחלון האינטרקום" button (V, `CLASSIC_EDIT_HREF`) stays for `system.configure` and becomes the tier D
  "להחיל בחלון האינטרקום" action for prepared rules.
- New drawer "חלון פתיחה" (`sw-drawer`, V): name, kind (weekly / once / by event), doors (multi-pick, grouped by station -
  only doors the editor may manage), the week grid or the date + hours, the duration (event), calendar policy, limits, and
  for event rules the trigger source and its snippet. Save = preview first: the compiled occurrences for the next 7 days and
  the sentence that describes what will be written to the engine (and the pause-blink sentence when it applies), then
  "שמירה והפעלה" / "שמירה כטיוטה".
- Table view (desktop / tablet, V `TABLE_MIN`) gains the rules table with the same columns; phones keep the door chip sheet.
- Five skins within their 50-rule budgets (V `design/skins/index.ts SKIN_RULE_BUDGET`): the edit mode uses existing tokens
  only (`--sw-*`, unit-token-lint); a layout-guard spec and pixel baselines are regenerated for the screen in edit mode.

### 10.2 Stations and doors screen (`#/wiskey/devices`)
- `frontend/src/screens/wiskey-stations.ts`, `wiskey-stations-views.ts`, `wiskey-stations-actions.ts` (the state machine),
  `wiskey-stations-logic.ts`: the door chip shows the window state word when an occurrence is active ("פתוח קבוע עד 17:00")
  and the warning word on `relock_unconfirmed`; the station drawer gets the S9 deep link `#/wiskey/schedules?door=<station>:<relay>`
  (the hand-off CR-036-S9-NOTES 5.2 asked for) and, for `access.windows.manage`, the one-off button "פתיחה ל-N שעות"
  (`arx_button` source, 9.1) with the same confirmation step the door release has (V `release` flow: never one click away).
- The header hosts the "חירום" entry (8.1).

### 10.3 Backend
- New router `routers/door_windows.py` (mounted in `main.py` like `routers/doors.py`, V) and services
  `services/door_windows.py` (rules, compile, occurrences), `door_windows_engine.py` (tier adapters: `StationEngine` (U1),
  `ProgramEngine` (tier B), `PreparedEngine` (tier D), `FakeEngine` (tests, drills)), `door_windows_watch.py` (4.4),
  `door_windows_conversion.py` (9.4), `door_emergency.py` (8), `special_days.py` (5.4).
- Writes toward WisKey go through the existing write-lane client (V `services/intercom_writes.py`, `intercom_client.py`)
  with three commands **added to the selection table** (`stations/technical_program_save`, `technical_program_action`, and
  later the W13 commands) - an update of `ARX_W2_SELECTION_TABLE` section 3.2 (it says explicitly that no schedule / station
  write is selected today; this CR is that "separate update").
- Transport mode follows `doors.trusted_path` (V `trusted_door.FLAG_KEY`): **the program writes require the signed mode**
  (U2); in the interim `off` mode the engine is tier D. Reason: a program save on the add-on's token would make WisKey audit
  the infrastructure user for an hours-long hold - the CR-033 decision that every door-affecting write carries the real
  person applies (CR-036 4.2 "door-affecting").
- Door authority reuse: `door_authority.check_permission` (7.4); emergency and windows never call `open_door` (they are not
  single opens) but share its audit shape (12).

### 10.4 Routes (all under RBAC, confirmation on every write, `client_request_id` envelope on every engine write)
| Route | Permission | Notes |
|---|---|---|
| `GET /doors/windows/rules`, `GET .../rules/{id}`, `GET .../occurrences?door=&from=&to=` | `access.stations.read` (filtered) | occurrences include state words and the engine word |
| `POST /doors/windows/rules`, `PUT .../{id}`, `POST .../{id}/enable|pause|retire`, `POST .../{id}/preview` | `access.windows.manage` on every door of the rule | preview returns the compiled occurrences and the engine sentence; enable requires `confirmed:true` |
| `POST /doors/windows/rules/{id}/adopt-foreign` | same | reads a non-Arx program into a draft rule (never overwrites the program) |
| `POST /doors/windows/doors/{station}/{relay}/open-for` | `access.windows.manage` on the door | the `arx_button` source; body `{duration_s, confirmed, client_request_id, expires_at}` |
| `POST /doors/windows/occurrences/{id}/end-now`, `POST .../doors/{station}/{relay}/cancel-today` | `access.windows.cancel` or `.manage` | the override; `end-now` on an emergency hold -> 409 `under_incident` |
| `POST /doors/windows/occurrences/{id}/confirm-closed` | `.cancel` or `.manage` | the manual relock check; body `{checked: "camera" | "door", confirmed}` |
| `GET/PUT /doors/windows/calendar` | read: `.stations.read`; write: `.windows.manage` at installation | overrides only; the generated list is read-only |
| `GET/PUT /doors/windows/settings`, `GET/PUT /doors/emergency/settings` | `system.configure` | 13; the attestation lives behind the emergency settings |
| `POST /doors/emergency/incidents`, `POST .../{id}/release`, `GET .../{id}`, `GET /doors/emergency/active` | `access.emergency.lock` / `.open` at a scope covering the request | `kind`, `scope`, `reason`, `confirmed`, `client_request_id` |
| `POST /doors/emergency/drill` | same as the kind | fakes only, 8.8 |
| `GET /doors/windows/permissions` | `system.configure` | the "הרשאות חלונות וחירום" sub-tab (7.3) |

## 11. Notifications (`services/notify_policy.py SOURCES`, category `doors`, V shape)
| Key | Severity | Who | Text (title / body) | Resolves |
|---|---|---|---|---|
| `door.relock_unconfirmed` | critical | managers (+ scope) | "דלת אולי פתוחה" / "{name}: החלון הסתיים ולא אושרה חזרה למצב רגיל." re-raised every `reraise_min` | when confirmed |
| `door.window_not_started` | alert | managers | "חלון פתיחה לא התחיל" / "{name}: המערכת לא אישרה את הפתיחה." | at window end |
| `door.window_overridden` | info | managers | "חלון הופסק" / "{name} הופסק על ידי {actor}." | acknowledge |
| `door.windows.storm` | alert | managers | "יותר מדי הפעלות" / "הפעלות לפי אירוע נעצרו לשעה." | after the hour |
| `door.windows.simulated` | info (inbox only) | initiator | "היה נפתח חלון" / "{name} עד {until} (מצב הדגמה)." | acknowledge |
| `door.emergency.started` | critical | managers, everyone with `access.read` in scope | "מצב חירום: {kind}" / "{actor} הפעיל/ה {kind} ל-{count} דלתות ({scope})." | on release |
| `door.emergency.partial` | critical | managers | "חירום: לא כל הדלתות אישרו" / "{failed} דלתות: {names}." | on release |
| `door.emergency.released` | alert | managers | "מצב החירום הסתיים" / "{actor} שחרר/ה." | acknowledge |
| `door.emergency.drill` | info (inbox only) | managers | "תרגיל חירום" / "{actor} הריץ/ה תרגיל ({scope})." | acknowledge |

Channels follow the existing per-source routing (inbox / webpush / email / app / announce, V `CHANNELS_V1`); the two
critical emergency sources default to inbox + webpush + app, and **announce** (the spoken channel) is offered for
`door.emergency.started` with the owner's choice of phrase. Nothing in a notification names Home Assistant or WisKey.

## 12. Audit (`audit.audit`, V signature) - action names and `details_json`
`door.window.rule_saved / enabled / paused / retired / adopted`, `door.window.compiled` (door, tier, program revision,
compiled sha), `door.window.engine_write` (attempt / outcome pair like `intercom.release`: `client_request_id`,
`transport`, `mode`, `outcome`, `code`, never a body), `door.window.occurrence` (state transitions with the engine
status read), `door.window.override`, `door.window.confirm_closed` (`checked`), `door.window.relock_retry` (attempt n),
`door.window.trigger` (source, decision, `trigger_ref`, `authorising_actor`, `arm_state`), `door.emergency.started /
door_result / released / drill` (kind, scope, counts, per-door code, `request_id`, `under_incident`), `settings.changed`
(existing) for every setting of 13, `door.emergency.attested` (text version, sha). Rows carry the Arx principal, never an
HA token identity (AGENTS.md v1.1). Audit never holds a token (9.1 `ha_event`), a program document or an entity address.

## 13. Settings (`routers/settings.py` DEFAULTS + `SettingsPatch`, `system.configure`, audited; `backup.SETTINGS_KEEP` rule as CR-033 9: a restore never loosens)
| Key | Values | Default | Effect |
|---|---|---|---|
| `doors.windows.enabled` | `off / on` | **off** | the master switch of windows (off = tier D everywhere, no engine write, no trigger) |
| `doors.windows.max_hours` | 1..12 | 4 | the longest occurrence; a rule above it cannot be saved |
| `doors.windows.max_per_day_per_door` | 1..6 | 3 | all origins together |
| `doors.windows.quiet_from` / `quiet_to` | HH:MM | 22:00 / 06:00 | an occurrence may not touch the quiet hours unless the rule says `allow_night` (a flag only `system.configure` holders may set) |
| `doors.windows.relock_grace_s` | 60..600 | 120 | 4.4 |
| `doors.windows.relock_retries` | 0..5 | 3 | 4.4 (0 = alert only) |
| `doors.windows.reraise_min` | 5..60 | 15 | 4.4 |
| `doors.windows.calendar_generator` | `israel / none` | israel | 5.4 |
| `doors.windows.event_extend_owned` | `false / true` | false | 9.3 |
| `doors.automation_actor` | `off / on` | **off**, cannot be on until the W1 automation actor is reported by the contract | 9.4 |
| `doors.emergency.enabled` | `off / on` | **off** | the "חירום" entry and LOCK (secure) |
| `doors.emergency.open_enabled` | `off / on` | **off**, cannot be on until W13 and the attestation | OPEN |
| `doors.emergency.lockdown_enabled` | `off / on` | **off**, cannot be on until U4 | the Lockdown level |
| `doors.emergency.hold_ms` | 1000..3000 | 1500 | the hold-to-confirm |
| `doors.emergency.home_widget` | `off / on` | off | the home-screen entry |
| `doors.emergency.announce_phrase` | text <= 120 | "" (**owner decision:** OFF until heard in a drill) | the spoken announcement on start (empty = none) |
| `doors.windows.exterior_allowed` | `false / true` | **false** (**owner decision:** interior doors first) | a door the administrator marked exterior in the door map (new column `intercom_door_map.exterior`, in 0085) cannot be in a rule while false; the rule editor hides such doors and says why in Settings only |

Settings screen: Settings › access control gains two cards "חלונות פתיחה" and "חירום" (the `system-access-*.ts` family, V);
the emergency card shows the life-safety text (8.9) with the acceptance checkbox and the recorded attestation; the state of
each dependency is shown in plain words ("ממתין לממשק מצד מערכת האינטרקום") - the only place platform-ish words appear.

## 14. Observability
- Status page (Settings › access control › מצב, V `system-access-status.ts`): a "חלונות" segment - rules by state, next 24 h
  occurrences, doors with a foreign program, doors `relock_unconfirmed`, watchdog last tick, engine write failures (24 h),
  simulated triggers (24 h), and the incident history (last 20) with per-door counts.
- The parity table (V `system-access-parity.ts`) gains rows for the three program commands when they are selected.
- Logs (`smplwise.doors` logger, V): one line per engine write and per watchdog transition, ids only.
- Health: a door in `relock_unconfirmed` for more than one hour counts as a health finding on the dashboard's door count.

## 15. Threat table
| # | Threat | Control |
|---|---|---|
| T1 | A door left open after a window because the engine lost HA / network at the end (the documented WisKey behaviour) | 4.1 tiers, 4.4 watchdog, SR-4 alert + retries in the close direction, U5 question, 8.9 hardware review |
| T2 | Arx's own restart / crash at a window's end | Arx holds no timer that opens or closes (SR-1); the engine relocks; the watchdog resumes from the DB on start and judges every `ending` occurrence immediately |
| T3 | A double open after an unknown outcome | SR-3 (never for windows and single opens); the one bounded exception E-1 inside an emergency OPEN (8.4) with its own test |
| T4 | A stray / forged HA event starts a window | per-rule hashed token, allowed hours, `max_per_day`, cooldown, storm cap, authorising actor re-checked, `simulate` until the automation actor exists (9) |
| T5 | A loop (automation -> window -> event -> automation) | cooldown + per-door daily cap + installation storm cap; an active occurrence is extended once, never restarted |
| T6 | Privilege escalation: a station-scoped holder creating an installation-wide rule, or an emergency on doors outside the binding | explicit door scope checked per door with deny-wins (7.4); incident scope = binding scope; no wildcard |
| T7 | Accidental emergency press | header-only entry, 1.5 s hold, confirmation with count, 20 s auto-close, separate permissions, OFF by default (8.1) |
| T8 | Emergency used to defeat security (open all doors at night) | `access.emergency.open` never delegable by default, grantable per user with expiry, critical notification to every manager with the presser's name, audit, camera links; the owner's policy on who holds it |
| T9 | A stale WisKey copy during an emergency | sent anyway on the last known list with `unknown` results and a clear reason (8.7) - a named deviation from SEC-WXD L5, limited to incidents |
| T10 | Arx overwrites a program a person made in the WisKey panel | never: foreign programs are adopted or left (4.3), except an emergency **pause** (8.2, audited, recorded in 19) |
| T11 | A rule approved by a person who later lost the permission keeps running | paused by the next compile, listed (5.5); triggers re-check at fire time |
| T12 | WisKey rate limit hit by the watchdog or an emergency | one read per station per 15 s; the incident lane; lanes sized under 8 handlers |
| T13 | Sensitive data in rules / audit | rules hold door ids and times only; tokens hashed; no PIN / card / phone anywhere near this module |
| T14 | A compiled program exceeds WisKey's 64 KiB message cap | size test; horizon and exception count bounded (5.4) |
| T15 | Clock skew between the station, HA and Arx | 4.5: compile in the station's zone, warn on drift > 5 min; no fixed offsets |
| T16 | The automation refusal lifted by a setting without the WisKey capability | fail closed: `doors.automation_actor` cannot be on without the reported capability (9.4), the `MIN_BRIDGE` precedent |

## 16. Test plan (fakes and models only; nothing live)
- **Fakes (built in W0, `origin/pilot/DOORWIN-w0` @ 41a812fe, notes `docs/changes/CR-039-W0-NOTES.md`; 103 self-tests
  passed locally on 2026-10-13 per the notes - NOT re-run for this revision):** new files only, `tests/fake_doorwin_*.py` -
  `FakeDoorwinClock` / `DoorwinScheduler` (owner-tagged jobs; `cancel_owner("arx")` = an add-on restart), `FakeDoorBank`
  (no position sensor, optimistic lock entity, per-door `power_behaviour` / `hold_survives_reboot` defaulting to the worst
  case, `lock_entity_reflects_hold` default False), `FakeProgramEngine` (tier B: revision CAS, the execution status machine
  idle -> opening -> held_acknowledged -> restoring -> idle, WisKey's own 15-s close retry, `hold_pause_before_edit` on any
  enabled program, `invalid_format` for envelope keys, `window_token`, switches for U2 / U6 / U7, `ha_stop/start`, link
  loss), `FakeStationScheduleEngine` (tier A, U1), `FakeHoldUntilEngine` (U3), `FakeEmergencyEngine` (per-door scripts,
  latency, the 4-slot lane, `batch_command`, `for_drill`), `FakeHaEventSource` (forgeries, storms, duplicate delivery),
  the assertion helpers (`assert_no_silent_open`, `assert_unknown_open_not_retried` for E-1, `assert_close_retries_bounded`,
  `assert_no_secrets`) and `DoorwinWorld` (the U1-U7 / W13-e switches with worst-case defaults). **`fake_wiskey.py` and
  `fake_trusted_bridge.py` are untouched**: the program commands are served through `FakeProgramEngine.attach(FakeWiskey)`
  and the W1 automation-actor shape is validated inside `FakeProgramEngine` under U2; a later slice (W3) may move them into
  the shared fakes - until then W3 / W4 / W5 extend the `fake_doorwin_*` files and the SR-1 pin lists (`PINNED`,
  `ENGINE_WRITES` in `test_fake_doorwin_closed_rule_sr1.py`) in the commit that adds a site.
- **Error codes:** every code the fakes use is in the pinned `errors.static.json` except `device_unavailable` (the extraction's
  name for WisKey's mapping of Hikvision errors; the fake uses it for an enabled save while the station is away) - **U7 /
  W5 must confirm the real code** before the refusal tables are written (W0 finding 4).
- **Closed rules, one test each:** SR-1 (no Arx code path sends an open from a timer: a static test greps the services for
  `release_door` / `alwaysOpen` callers and pins the allowed set), SR-2, SR-3, SR-4, SR-5, SR-6 text, E-1 bounded to 3,
  T4 token, T5 loop, T6 scope, T16 fail-closed.
- **Compile:** weekly union, 8-period cap, once, calendar policies (holiday, eve, closed, override wins), DST drop / once,
  per-station zones, foreign program refused, size cap, idempotent sha (no second save).
- **Watchdog:** confirmation within grace, grace passed -> unconfirmed + critical + retry schedule (30/60/120) + bound,
  re-raise, manual confirm with `checked`, feed loss -> unconfirmed at end + grace, restart recovery from DB, start
  confirmation / not_started.
- **Triggers:** each source, simulate vs armed, authorising actor lost, allowed hours, caps, extension once, event under an
  active window, under `relock_unconfirmed`, storm cap.
- **Emergency:** both kinds, scope by binding (installation / site / building / station), partial results, unknown + E-1,
  release partial, OPEN over LOCK, two incidents refused, drill never reaches the fake WisKey (asserted on the fake's call
  log), attestation gate, open_enabled fail-closed without W13, manual door open under secure (audited) / lockdown (refused).
- **RBAC matrix** (`test_rbac_matrix.py` precedent): the four permissions x built-in roles x custom role x single-permission
  roles x deny binding x kiosk / wall; delegation defaults; the permissions sub-tab.
- **Migrations:** 0085-0087 on an empty DB and on a 2.4.9 DB copy; the pinned migration-list tests (`test_migrations`,
  `test_media_api`, `test_media_players_api`, `test_notify_core`, V 2.4.9 notes) updated.
- **Frontend:** node unit tests for the compile preview and the state words; Playwright evidence specs for the screen in
  read-only (unchanged), edit mode, override, unconfirmed card, the emergency sheet (hold, auto-close, partial list, strip,
  release), drill, five skins x light / dark, desktop / tablet / mobile; layout-guard and Linux pixel baselines; the
  `evidence-access-s12` checklist count.
- **Untestable on fakes - NOT_RUN by design, owned by the W9 owner lab session, per action** (W0 finding 9): U5 - what a real
  relay does on power loss and whether a station reboot keeps `alwaysOpen`; real WisKey latency per command and its
  deduplication of a repeated request; the real W13 request / response shapes (the fakes' method names are renamed to
  match when WisKey answers; the switches stay); the lock entity's real behaviour during a program hold (does it read
  `unlocked`?); and anything against a real WisKey, station, door, bridge or HA.

## 17. Slices, effort, order (agent-hours; model per the owner's routing rules)
| # | Slice | Depends on | Effort | Can start now (fakes)? |
|---|---|---|---|---|
| W0 | Fakes + fixtures (16 first bullet), the closed-rule static test, the W13 request text for the lead | - | 6-8 | yes |
| W1 | Data model 0085-0087, `door_windows.py` (rules, versions, calendar incl. `special_days.py` extraction, compile, occurrences, preview), the four permissions + roles + labels + delegation + RBAC matrix | W0 | 14-18 | yes |
| W2 | Schedules screen edit mode (drawer, grid edit, preview, override, unconfirmed card, table), stations deep link + "open for N hours", i18n, skins, layout / pixel specs | W1 | 16-20 | yes |
| W3 | Engine adapters (tier B `ProgramEngine`, tier D, `FakeEngine`; tier A stub keyed to U1), the selection-table update, the signed-mode gate, the watchdog + its notifications + status rows | W1 | 14-16 | yes against the fake; **live write waits for U2 + the signed path** |
| W4 | Triggers: `arx_button`, `arx_automation` typed step + conversion source (`simulate`), `ha_event` subscription + token, caps, storm; the `doors.automation_actor` fail-closed gate | W1, W3 | 12-14 | yes in `simulate`; **`armed` waits for the W1 automation actor** |
| W5 | Emergency core: incidents, per-door results, scope by binding, precedence, `FakeEmergencyEngine`, drill route, attestation, the settings cards, notifications incl. announce | W1 | 12-14 | yes (LOCK-secure on tier B; OPEN against the fake only) |
| W6 | Emergency UX: the sheet (hold-to-confirm, scope picker, live list), the strip, home widget, phone sheet, five skins, evidence | W5 | 10-12 | yes |
| W7 | Settings › permissions sub-tab, observability (status segment, parity rows, logs, health count), release notes draft (bilingual) | W1-W6 | 6-8 | yes |
| W8 | Security review (a second Opus pass on W1, W3, W4, W5), gate on fakes, docs | all | 6 | - |
| W9 | Lab verification with the owner, per action: one weekly window on one door, one override, one relock-unconfirmed drill (feed cut deliberately), LOCK-secure on one door; OPEN only after W13 and the attestation. Also the measurements only a lab can give (16, last bullet): U5 power loss / reboot on one door the owner chooses, per-command latency and duplicate handling, the lock entity's state during a hold, the real W13 shapes | W8, U2 | owner session | **no** |

Total **96-116 agent-hours** before the owner session. Recommended order: W0 -> W1 -> (W2 ‖ W3) -> W5 -> W6 -> W4 -> W7 -> W8.
**Shared-file rule (build order vs tickets):** the tickets module's slice 1 (CR-038) owns the shared files `roles.json`,
`rbac.py` / `routers/access.py` (permission labels, delegation defaults), `shell/nav.ts` and the migration numbers; the
door-windows build (W1 onward) **starts only after tickets slice 1 is merged** to its integration branch, and W1 then
rebases its permissions, roles and migration numbers on that tree. W0 (fakes, the static closed-rule test) touches none of
those files and may start at once.
Everything up to W8 proceeds on fakes without a WisKey answer; what waits: tier B live writes (U2 + signed transport),
`armed` triggers (W1 automation actor), emergency OPEN and Lockdown (W13 / U3 / U4), tier A (U1).

## 18. Risks
1. **The engine's relock is software in HA** (tier B): the watchdog narrows the window of ignorance to `grace`; it cannot
   close a door while HA is down. The owner must know this before relying on windows for exterior doors (Hebrew summary Q1).
2. **No door-position sensor**: every "closed" word Arx shows is an engine acknowledgement, never a measurement. Wording is
   fixed accordingly and tested.
3. **The pause blink** on editing an owned program (R) surprises users; the preview sentence and the default refusal of
   event extensions reduce it; W13-g may remove it.
4. **WisKey answers may reshape sections 4.2, 8.4, 9.3** - they are written as branches; only the engine adapters change.
5. **Emergency OPEN on hardware nobody reviewed** - the attestation and OFF default are the control; the risk is
   organisational, not technical, and is stated as such.
6. **Scope creep into credential schedules** (`schedules/*`): out of scope, stated in 1.
7. **Budget**: ~100 agent-hours on top of the tickets module; the owner's priority call (Hebrew summary Q5).

## 19. Contradictions and deliberate exceptions recorded (not resolved here)
1. CR-034 reserved 0079 for `bridge_rotations`; CR-038 reserved 0079-0084. This CR starts at 0085; the lead assigns final
   numbers at integration (repo rule).
2. CR-033 D10b said recurring fixed schedules move to WisKey hold-open programs "created on behalf of the operator" (W?);
   this CR is that design and keeps its dependency (U2) - it does not assume the answer.
3. An emergency LOCK may **pause a foreign program** (one a person made in the WisKey panel); CR-033 / this CR otherwise
   never touch foreign programs. Justified by the emergency, audited, and the program is **not** re-activated by Arx (the
   person who made it re-activates it in the panel; the strip lists such doors after release).
4. SEC-WXD L5 (no send without a WisKey copy) is relaxed for emergency incidents only (T9).
5. SR-3 (no open repeat after unknown) has the single bounded exception E-1 inside an emergency OPEN.
6. The W2 selection table says no schedule / station write is selected; this CR selects two program commands (and W13's)
   - the table gets its "separate update" when W3 lands.
7. `access.schedules.manage` exists in the catalogue without a use (W2 table 8.10); this CR does **not** reuse it (7.1) -
   the lead may retire it or keep it for the credential library.

## 20. Open questions
**For WisKey (W13, section 3.3):** U1-U7 and the emergency command family.

**For the owner** (plain-language versions in `CR-039-..._HE.md`; status per 0.1):
1. ~~Exterior / perimeter doors on software-relocked windows~~ - **DECIDED 2026-10-13:** interior and courtyard doors first;
   exterior only after U1 or a hardware review (setting `doors.windows.exterior_allowed`, 13).
2. ~~Who holds `access.emergency.open` by default~~ - **DECIDED 2026-10-13:** system administrators only.
3. Emergency LOCK level: "Secure" now, "Lockdown" when U4 allows - recommended default, not yet explicitly confirmed.
4. The guard override for operators by default - recommended default (yes), not yet explicitly confirmed.
5. Build order: in parallel with tickets on fakes, after tickets slice 1 is merged (17) - recommended default, not yet
   explicitly confirmed.
6. ~~The spoken announcement on emergency start~~ - **DECIDED 2026-10-13:** OFF until heard in a drill.
