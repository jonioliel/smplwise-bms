# Deep review 2.52 - FRONTEND-SCREENS

- Reviewed head: `eadaa25b8` (`origin/release/2520-train`), read-only. Branch of this file: `review/DEEP-2520-FRONTEND-SCREENS`.
- Area: the home interface (`frontend/src/home`, `wall`, home screens), the control screens (alarm, doors / door-tech, access control and
  WisKey screens, cameras / live / recordings, infrastructure, device control, tickets, calendars incl. the resident phone views,
  settings, users / MFA) and the shell gating around them.
- Method: six slices read by code path (handler -> api client -> where state is applied; the backend route where authorisation or the
  wire format decides). **Nothing was built or run**: no tsc, no unit test, no Playwright - every finding is from reading. The findings
  rated high and a sample of the medium ones were re-read by the lead reviewer against the code (marked "re-read" below).
- Status words: CONFIRMED = the code path was read end to end; PLAUSIBLE = one stated link is unproven.
- Paths are relative to the repository root, line numbers at the reviewed head.

Counts: critical 0, high 6, medium 34, low 17 (57 findings).

## 1. Summary table

| id | sev | title | file:line |
|---|---|---|---|
| SCR-01 | high | Emergency door sheet is dead after one failed prepare / start: a new hold shows nothing | `frontend/src/door-windows/logic.ts:212-218`, `door-windows/emergency.ts:186-229,300-306` |
| SCR-02 | high | Recorded playback keeps the old date after midnight: stamp, bookmark, export and seek are 24 h off | `frontend/src/screens/investigate-playback.ts:1134,1559,1546,1397,1284` |
| SCR-03 | high | Resident "cancel only this date" of a recurring booking always fails (422) | `frontend/src/calendars/resident.ts:660` |
| SCR-04 | high | Home "my bookings": deleting one date of a series cancels the whole series and names the wrong date | `frontend/src/home/home-calendar.ts:201-211`, `home/home-p2-api.ts:46-47` |
| SCR-05 | high | Public handler page posts an unfinished draft by itself when the phone comes back online | `frontend/src/public-ticket/main.ts:137-139` |
| SCR-06 | high | Home alarm: state goes stale on phones, and arm / disarm toasts success without reading the result | `frontend/src/home/sw-home.ts:242-245,343-349`, `home/home-alarm.ts:31-36` |
| SCR-07 | medium | Arx-only users: delete / disable have no self guard and no last-administrator guard (screen and server) | `frontend/src/screens/system-local-users.ts:474-496`, `smplwise_vms/backend/smplwise/routers/local_identity.py:709-795` |
| SCR-08 | medium | Editing favourites permanently drops every favourite hidden at that moment | `frontend/src/home/sw-home.ts:205,528-531,904-924` |
| SCR-09 | medium | Home security chip shows "armed" (green) for an unavailable / unknown panel | `frontend/src/home/sw-home.ts:1289-1291` |
| SCR-10 | medium | An offline lock is counted and announced as an open door | `frontend/src/home/home-logic.ts:40-45`, `home/sw-home.ts:1283`, `services/devices.py:543` |
| SCR-11 | medium | Incoming-call banner retargets to a newer call under the finger (answer / decline hit the wrong station) | `frontend/src/components/sw-incoming-call.ts:587,612-614` |
| SCR-12 | medium | Banner door open: an unknown outcome is reported as "the door was not opened", no hold | `frontend/src/components/sw-incoming-call.ts:496-508` |
| SCR-13 | medium | Station / banner commands stamp `expires_at` from an unsynchronised device clock | `frontend/src/api/intercom.ts:79-90,353-355` |
| SCR-14 | medium | NVR system card: a late answer for recorder A is shown while actions go to recorder B | `frontend/src/screens/system-setup.ts:189-201,228` |
| SCR-15 | medium | NVR alarm-output relay pulse has no confirmation | `frontend/src/screens/system-setup.ts:276` |
| SCR-16 | medium | Map: the sensitive-action (unlock) confirmation opens with focus on the danger button | `frontend/src/screens/explore-floor-map.ts:3137-3139,2518-2520`, `components/sw-dialog.ts:293-294` |
| SCR-17 | medium | Map: action arguments keyed by action id only; lights turned on from the map always get a brightness | `frontend/src/screens/explore-floor-map.ts:2958-2987,3013-3014` |
| SCR-18 | medium | Automation "device test": failed / denied step shown as done; a sensitive step fires on one tap | `frontend/src/screens/automation-ext-dialogs.ts:83-95` |
| SCR-19 | medium | Bulk dialog: an earlier run's result overwrites / reopens the dialog of a later request | `frontend/src/screens/devices-bulk.ts:640-641,665-690` |
| SCR-20 | medium | Electricity bill log and "end of period reading" time printed in UTC (wrong day possible on the bill) | `frontend/src/electricity/elec-format.ts:49-52`, `elec-bill-paper.ts:273` |
| SCR-21 | medium | Generator battery dial: 12 V / 24 V boundary (18 V) disagrees with the server's (16 V) | `frontend/src/generator/gen-logic.ts:152-158` |
| SCR-22 | medium | Generator alerts: "ack all" and "mute 24 h" are one click, reach alerts not on screen; failures invisible | `frontend/src/generator/gen-alerts-page.ts:113-124,131,141,196-198` |
| SCR-23 | medium | Step-up dialog never expires and does not name the action: a refused door-open replays whenever the code is typed | `frontend/src/api/client.ts:134-138`, `components/sw-step-up-dialog.ts:212,246-254` |
| SCR-24 | medium | Playback camera picker / date: an older selection wins after two quick changes | `frontend/src/screens/investigate-playback.ts:767-778,800` |
| SCR-25 | medium | Removing a case item deletes its stored file with no confirmation | `frontend/src/screens/investigate-cases.ts:1015` |
| SCR-26 | medium | Live wall and kiosk read the camera list once; kiosk "system" tile is hard-coded "active" | `frontend/src/screens/kiosk-wall.ts:565,597,696`, `screens/live-wall.ts:806,849,1044` |
| SCR-27 | medium | Motion-detection confirm shows the change reversed in Hebrew ("60 -> 40"); NVR dialogs reversed in English | `frontend/src/screens/live-camera.ts:829,428`, `screens/nvr-confirm.ts:153` |
| SCR-28 | medium | Home recordings: overlapping create / seek with no guard; a double tap leaks a playback session | `frontend/src/home/home-recordings.ts:91-120` |
| SCR-29 | medium | Camera OSD switches stay flipped after a refused NVR write, and write on one press | `frontend/src/screens/live-camera.ts:504-531` |
| SCR-30 | medium | Home push refresh: trailing debounce with no maximum wait, and no guard for commands in flight | `frontend/src/home/sw-home.ts:242-245,273-276,351-355` |
| SCR-31 | medium | Home temperature +/- on a zone that is off never turns it on | `frontend/src/home/sw-home.ts:953-961`, `home/home-actions.ts:59-66` |
| SCR-32 | medium | Home electricity bill: one account's amounts shown under another | `frontend/src/home/home-p3.ts:171-186` |
| SCR-33 | medium | Home scene edit: a late detail of scene A can be saved onto, or delete, scene B | `frontend/src/home/home-scene-2500.ts:119-150` |
| SCR-34 | medium | Home room bookings show a displaced booking as "approved" | `frontend/src/home/home-calendar.ts:229` |
| SCR-35 | medium | Resident room list: an older day's answer overwrites the selected day (taken slots read free) | `frontend/src/calendars/resident.ts:256-273,369` |
| SCR-36 | medium | Resident "my bookings": a failed load reads as "you have no bookings" | `frontend/src/calendars/resident.ts:282-285,480-491` |
| SCR-37 | medium | Booking times are one hour off on the two DST-change days | `frontend/src/calendars/grid-logic.ts:65`, `calendars/model.ts:175`, `calendars/booking-logic.ts:31` |
| SCR-38 | medium | Booking drawer: cancel on one date of a recurring entry cancels the whole series without saying so | `frontend/src/calendars/event-drawer.ts:426-440,519-521` |
| SCR-39 | medium | Home ticket "send note" can send the same note twice | `frontend/src/home/home-tickets.ts:157-163` |
| SCR-40 | medium | Public handler page: a draft of ticket A is applied to ticket B opened in the same tab | `frontend/src/public-ticket/main.ts:110,121-125` |
| SCR-41 | low | Emergency sheet: a scope chosen for one kind silently falls back to the first scope of the other kind | `frontend/src/door-windows/emergency.ts:182-184,259-272` |
| SCR-42 | low | Door screen: any failed read of the emergency state hides the red strip and the button | `frontend/src/screens/door-windows.ts:178-184` |
| SCR-43 | low | Shared confirm dialog accepts an auto-repeated Enter (PLAUSIBLE) | `frontend/src/components/confirm-dialog.ts:80-93,140-149` |
| SCR-44 | low | My account > passkeys: a removal waiting for step-up still runs after the row's cancel | `frontend/src/components/sw-passkeys.ts:175-196,326-328` |
| SCR-45 | low | Administrator factor reset: no in-flight guard on Enter; result painted on whichever user is selected | `frontend/src/components/sw-second-factor.ts:451-468`, `components/sw-user-factors.ts:100-116` |
| SCR-46 | low | Notice board items: full-list replace built from stale state, no in-flight guard | `frontend/src/screens/system-notices.ts:819-837` |
| SCR-47 | low | Backup tab: an installation with no backups shows "the backup list did not load" | `frontend/src/screens/system-diagnostics.ts:2206` |
| SCR-48 | low | Audit log: overlapping filter reads; times in the browser's zone | `frontend/src/screens/system-audit.ts:92,116-129` |
| SCR-49 | low | Users and permissions: revoking a user's role binding is one click (incl. one's own) | `frontend/src/screens/system-access.ts:641-663,772` |
| SCR-50 | low | "People on stations only": a transport failure reads "not performed"; late duplicate check lands on another person | `frontend/src/screens/wiskey-station-people.ts:171-217` |
| SCR-51 | low | Banner keeps a talk session with no UI after a 403; station-permissions `busy` is a single slot | `frontend/src/components/sw-incoming-call.ts:361-362`, `screens/wiskey-station-permissions.ts:93-113` |
| SCR-52 | low | Map room card "all off": partial failure not reported, no in-flight guard | `frontend/src/screens/explore-floor-map.ts:2507-2513,3009-3026` |
| SCR-53 | low | Deletes with no confirmation: water price version, temperature scheduled report (the latter fails silently) | `frontend/src/screens/water/page-settings.ts:147-152,195`, `temperature/whatsapp.ts:243` |
| SCR-54 | low | Schedules list: bulk enable / disable acts on selections hidden by the filter or page | `frontend/src/screens/devices-schedules.ts:574-578,606-616` |
| SCR-55 | low | Event centre: silent 500-row limit; multi-day ranges use UTC day edges | `frontend/src/screens/investigate-events.ts:1083-1099,1376` |
| SCR-56 | low | Tickets table: a poll in flight overwrites an inline status change; calendar drag not rolled back when the reload fails | `frontend/src/screens/tickets-table.ts:372-386,621-626`, `calendars/view-calendar.ts:943-960` |
| SCR-57 | low | Home dimmer and several home positions are physical (RTL-only): the English home is mirrored wrongly | `frontend/src/home/home-styles.ts:254-261,423-424,641-642,747,910` |

## 2. Findings in full

### SCR-01 (high, CONFIRMED, re-read) Emergency door sheet is dead after one failure

`nextStep` has no way out of `error` except cancel:

```ts
// door-windows/logic.ts:212-218
if (step === 'choose' && event === 'held') return 'confirm';
...
if ((step === 'sending' || step === 'confirm' || step === 'choose') && event === 'failed') return 'error';
return step;
```

`DoorEmergencySheet.render()` draws the choose view for `error` (the hold buttons stay live), `held()` calls the server's `prepare`
again and then sets `this.step = nextStep(this.step, 'held')` - which stays `error` - so the confirm view (`step === 'confirm' &&
prepared`) is never drawn. `armIdle()` closes only from `choose` / `confirm`, so the sheet does not close itself either.

Scenario: a real emergency, the operator holds "open all"; `prepare` fails once (network blip, `rate_limited`, `incident_active`), or
the single-use token expires / `start` fails. The error line appears. Every further 1.5 s hold now succeeds on the server (a fresh
confirm token is issued each time) but the screen does not move: no confirm button, no message. The only recovery is to close the
sheet and open it again, which nothing on screen says. The unit test covers `timeout` from every step, not `held` from `error`.

Fix: return to `choose` when an error is shown (`this.step = 'choose'` in both catch blocks, keeping `this.error`), or let
`nextStep('error', 'held')` be `confirm`; add the unit case and a Playwright case "prepare fails once, second hold reaches confirm".

### SCR-02 (high, CONFIRMED, re-read) Playback keeps the old date after crossing midnight

`this.date` is assigned only at `investigate-playback.ts:728` (init) and `:804` (`setDate`). The tick moves only the cursor:

```ts
this.position = now;
this.cursor = minuteInZone(now, this.tz);          // :1133-1134
<span class="stamp">${this.date} ${this.fmt(pos)}   // :1559
```

The session is not clipped to the local day (`routers/playback.py:59`, `window_end = start + MAX_SPAN`) and the `ended` handler
continues at `playback_end_at + 1 s` (`:1375`). Scenario: play from 23:58. After midnight the stamp shows yesterday's date with
today's time, the timeline still shows yesterday's segments, "add to case" bookmarks the instant 24 h earlier (`:1546`), export opens
on yesterday (`:1397`), and the next timeline click seeks 24 h back (`:1284`). The same happens when a late-evening seek is moved by
the server to a next-day segment. This is evidence handling: a clip or bookmark with the wrong day.

Fix: in `tick`, `tickGroup` and `startAt`, compare `dateInZone(position, tz)` with `this.date`; when different set the date and load
that day without ending the session. Derive the stamp date and the bookmark / export instant from `position`, not `date + cursor`.

### SCR-03 (high, CONFIRMED, re-read) Resident "cancel only this date" always fails

```ts
// calendars/resident.ts:660
await this.ctx.api.cancelEvent(o.event_id, ev.event.revision, o.recurring && this.cancelScope === 'occurrence' ? o.start : undefined);
```

`o.start` is the UTC instant; the server requires the local key (`services/calendar/events.py:449-453`,
`strptime(str(ostart), "%Y-%m-%dT%H:%M")` -> `Invalid("occurrence_start: local YYYY-MM-DDTHH:MM")`). The operator grid passes
`o.local_start` (`calendars/view-calendar.ts:1189-1190`). Scenario: a resident cancels one date of a series with the default choice
"only this date": 422 every time; the only cancel that works is "the whole series".

Fix: pass `o.local_start`; when it is absent fall back to the series question. Add a spec for the occurrence cancel in the resident flow.

### SCR-04 (high, CONFIRMED in code, re-read) Home: deleting one date of a series cancels the whole series

```ts
// home/home-calendar.ts:203-209
const m = st.mine.find((x) => x.event_id === id);
...
run: () => void cancelEvent(id, m ? m.state : 'pending', m?.revision)
// home/home-p2-api.ts:46-47
post(`calendar/events/${id}/${state === 'pending' ? 'withdraw' : 'cancel'}`, revision ? { revision } : {});
```

Every date of a series is a row with the same `event_id`. Tapping the trash on the third date finds the first row (the confirmation
shows the first date's time) and posts no scope; the server default is `scope = "series"` (`events.py:444`), so every future date is
cancelled, with the toast "the booking was cancelled". Precondition: the person organises a recurring series (created in the full
interface; the home sheet itself creates single bookings). Related (low): a `pending` row with no match in `mine` posts `{}` and always
gets 409 "stale", so that request cannot be withdrawn from home.

Fix: key rows by `occurrence_id`; for recurring rows send `scope: 'occurrence', occurrence_start: local_start`, or ask occurrence /
series as the resident flow does.

### SCR-05 (high, CONFIRMED, re-read) Public handler page sends an unfinished draft on `online`

```ts
// public-ticket/main.ts:137-139
window.addEventListener('online', () => {
  if (this.mode === 'ticket' && this.phase === 'ready' && this.hasDraft()) void this.send();
});
```

`hasDraft()` is true for a tapped status chip or any typed text. Scenario: a technician taps "done" (a draft only) and starts a note;
the phone loses and regains reception; the status move to done and the half-typed note are posted although "send" was never pressed.
A ticket closed by a network flap, on the unauthenticated link page. The claim step does it right (resumes only when
`submit?.pending`, `claim/claim-step.ts:1262`).

Fix: remember "send was pressed and failed offline" in `fail()` and resend only then.

### SCR-06 (high, CONFIRMED, re-read) Home alarm: stale state and a toast that claims success

`loadPanels()` runs at home load, on entering the alarm screen, once 1.5 s after an action, and on a wall panel (poll + push). The push
handler refreshes the overview only; `wall.haChanged` is a no-op without a wall machine.

```ts
// home/sw-home.ts:242-245
if (m.type === 'entity_state_changed' || m.type === 'structure_changed') this.scheduleRefresh();
if (m.type === 'entity_state_changed') this.wall.haChanged(m.entity.entity_id);
// home/home-alarm.ts:33-35
.then(() => { h.toast(action === 'disarm' ? tr('האזעקה מנוטרלת') : tr('האזעקה נדרכת')); window.setTimeout(() => void h.loadPanels(), 1500); })
// home/sw-home.ts:343-349
try { this.panels = (await alarmPanels()).panels; } catch { this.panels = []; }
```

- A phone on the alarm screen arms "away": the single reload at 1.5 s reads `arming`; the screen shows "arming" indefinitely and does not
  move if the panel refuses or someone disarms at the keypad.
- The "security" chip on the home page keeps the state from page load for the whole session; the scene suggestion decides "disarmed"
  from the same list.
- `send()` toasts "armed" / "disarmed" on any accepted request; the route returns the action record also when it is not `confirmed`
  (`routers/alarm.py:556-558` raises only for a code refusal). The full screen follows the record with `awaitAction`
  (`screens/security-alarm.ts:1170-1183`) and words it "sent, waiting for the panel".
- A failed read becomes "no alarm system connected" and removes the chip.

Fix: reload panels on any `alarm_control_panel.*` push in every home (not only the wall panel) and poll while the alarm screen is
visible; follow the returned record to confirmed / failed and word the toast "sent" until then; keep the last panels on a failed read
and show an error state.

### SCR-07 (medium, CONFIRMED frontend and backend, re-read) Arx-only users: no self / last-administrator guard on delete and disable

`routers/local_identity.py` `delete_local_user` (`:779-795`) and the `active` PATCH (`:709-777`) do only `_manage` + `_user_row`.
The HA-users equivalents refuse `self_target` and `last_admin` (`routers/ha_users.py:302-307,360-364`); role, link and password here
call `_admin_target_local_only`, these two do not. The screen (`system-local-users.ts:474-496`) does not mark the own row; "disable" has
no dialog at all.

Scenarios: (a) a local administrator removes or disables their own row - sessions end at once; (b) the only system administrator is an
Arx-only identity and is removed - none left (unproven: whether an HA owner always remains as fallback on every installation); (c) a
holder of `identity.local.manage` from the remote channel removes an administrative identity.

Fix: server refuses self, wraps both writes in `keep_an_admin`, applies `_admin_target_local_only`; the screen marks the own row, hides
remove / disable on it, and confirms "disable" (it ends every session). Cross-area: also relevant to the SECURITY review.

### SCR-08 (medium, CONFIRMED, re-read) Editing favourites drops every favourite hidden at that moment

Move, delete, resize, drag and "+ add" take the filtered list and save it back as the whole list:

```ts
const l = this.favs(this.room).filter((f) => favOk(f, this.world())).slice(); ... this.saveFavs(this.room, l);   // sw-home.ts:904-924
```

`world()` uses `visRooms()` (hidden rooms removed, the chosen building only), cameras (`[]` after a failed load) and scenes (`[]` until
loaded / on error); `hasSecurity` is always `false`, `hasEnergy` is false until energy loaded. Scenarios: a multi-building person
switches to building B and reorders one tile - building A's favourites are gone; one failed `loadScenes()` and any edit wipes the scene
favourites; hide a room, edit, unhide - its favourites are gone.

Fix: apply the edit to the full stored list (map the visible index back) and filter for display only; no edit before scenes and cameras
have loaded successfully.

### SCR-09 (medium, CONFIRMED, re-read) Security chip "armed" for an unavailable panel

`sw-home.ts:1289`: `const armed = this.panels.some((p) => p.state && p.state !== 'disarmed');` - `unavailable`, `unknown`, `pending`,
`disarming` all read "armed" with tone `ok`. Fix: `alarmWord(p.state, p.available)` as the hub tile and the rest screen do.

### SCR-10 (medium, CONFIRMED, re-read) An offline lock is announced as an open door

`services/devices.py:543` `row["locked"] = row["state"] == "locked"`; `home-logic.ts:41` `doors.filter((d) => !d.locked)`;
`sw-home.ts:1283` the same. A lock that is `unavailable` / `unknown` / `jammed` gives "<name> is open" (warn tone) in the strip, the
room chip, the "not locked" filter and the wall rest screen. `sceneSuggestions` already filters on `d.ok`. Fix: open = `d.ok &&
!d.locked`, own wording and neutral tone for an unavailable door.

### SCR-11 (medium, CONFIRMED) Incoming-call banner retargets under the finger

`incoming-call-logic.ts:23` sorts ringing calls newest first, `sw-incoming-call.ts:587` shows `shown[Math.min(this.front, ...)]`.
Station A is shown; station B rings; the next 3 s poll swaps the same sheet to B with no transition. A tap aimed at A's answer /
decline goes to B (single tap, no arm step; the stations screen uses two taps for the same signals). If A's door confirm was open
(`doorAsk = "A/1"`), it is hidden and all of B's door buttons are disabled (`:612-614`) with no explanation.
Fix: track the front call by `call_id` and keep it while it is in `shown`; scope the disable to the front call and clear `doorAsk` when
the front call changes.

### SCR-12 (medium, CONFIRMED) Banner door open: unknown outcome reported as "not opened"

`sw-incoming-call.ts:496-508`: any thrown error (timeout, proxy 502, dropped connection after the server forwarded the release) shows
red "the door was not opened" and re-enables the buttons at once. The stations screen classifies the same endpoint through
`actionOutcome` (amber "unknown", relay held for `retry_after_s`, `wiskey-stations-actions.ts:38-48`). `openDoor` also has no entry
guard and clears `busy[call_id]`, wiping an in-flight `answer` state. Fix: reuse `failure()` / `holdMs()` from the stations actions; early
return when busy is `door`.

### SCR-13 (medium, CONFIRMED) Commands stamped from an unsynchronised clock

`api/intercom.ts:79-90`: `serverOffsetMs` is learned only inside `getIntercomOverview()` (legacy entry centre and home `loadTalk`). The
native stations screen (`getAccessStations`) and the banner (`getActiveCalls`, whose `server_time_ms` is ignored) never set it, so
`expires_at = serverNow() + TTL` (`:353-355`) is the device clock. A wall tablet more than ~15 s slow gets 409 "expired" on every
release / answer / reject (backend `routers/access_control_command.py:291-295`), more than ~45 s fast gets 422. Fails safe, but the door
cannot be opened from Arx on that device, and the comment at `:76-78` is no longer true. Fix: a `noteServerTime()` called from
`getActiveCalls` and the access-stations read (or one response header read in `api/client.ts`).

### SCR-14 / SCR-15 (medium, CONFIRMED) NVR system card: stale recorder; relay pulse without confirmation

`system-setup.ts:189-201`: `this.sys = await this.sysApi.nvrSystem();` with no check that the recorder is still the selected one
(`:228` switches recorder and reloads). With two recorders and a slow first read, the card shows A's disks / outputs / clock while
`sysApi` targets B: "pulse output 1" pulses B's relay, the RESTART dialog (which names no recorder) reboots B.
`:276`: one click on "pulse" energises a physical relay (siren, light, gate); reboot on the same card needs a typed word.
Fix: capture the recorder id in `loadSystem` and drop a mismatched answer; name the recorder in the dialogs; `confirmDialog` naming the
output for the pulse.

### SCR-16 (medium, CONFIRMED, re-read) Map unlock confirmation focuses the danger button

`sw-dialog.ts:293-294` focuses the first `sw-button` that is not itself `slot="footer"`. The two map dialogs put the buttons inside
`<div slot="footer">`, danger first (`explore-floor-map.ts:3139`, `:2518-2520`), so the unlock button gets focus; a stray or held
Enter / Space sends `send(entityId, spec, true)`. The tiles panel (`devices-tiles-panel.ts:927`, cancel `autofocus`) and the bulk
dialog deliberately avoid this. Fix: cancel first with `autofocus` in both dialogs.

### SCR-17 (medium, CONFIRMED) Map action arguments

`explore-floor-map.ts:2964-2987`: `this.actionArgs[`${spec.id}:${a.name}`] ?? this.argDefault(e, a)`. (a) +/- on thermostat A stores
`climate.set_temperature:temperature`; opening thermostat B shows and sends A's value (the same for `number.set_value`, `brightness_pct`,
`option`). (b) A room-card light toggle sends every argument spec; for a light that is off `argDefault` gives 100 (or another light's
stale value), so each light turned on from the map goes to 100 % and loses its dim level, against rule SWITCH-LIGHT-DIMMER-2331.
Fix: key by `${entityId}:${spec.id}:${arg}`, clear on selection change, send optional arguments only when the user typed them.

### SCR-18 (medium, CONFIRMED) Automation "device test"

`automation-ext-dialogs.ts:83-84`: `for (const e of s.entity_ids) await runAction(e, s.action, s.data, s.sensitive);` then the step is
marked "done". `POST /ha/entities/{id}/actions` answers 202 with a record that can be `failed` / `denied` (`services/ha_actions.py:118`);
the record is ignored. `restore()` does the same and sets `restored = true`, so close no longer offers a restore for devices never put
back. `confirmed` is sent as `s.sensitive`: an unlock step carries the confirmation grant from a single tap (only `source ===
'schedule'` has the arm banner). Fix: read each record (and `awaitAction`), show the error; arm banner or per-step confirm for
sensitive steps.

### SCR-19 (medium, CONFIRMED) Bulk dialog: stale result

`devices-bulk.ts:665-690`: after `followBulk` the code sets `record` and `phase = 'result'` unconditionally. While `running` the dialog
says "you may close this window"; the user closes it, opens "close covers" (phase `confirm`); the first run ends and the dialog shows
the covers heading with the lights result and no confirm button - reads as if the covers were closed. With no second request the closed
dialog pops open again. A network error on one poll lands in `error` though the server run continues. Fix: capture the request / a
token and apply only when it is still the current run in `running`; set `follow.stopped` on close or on a new `show()`.

### SCR-20 (medium, CONFIRMED, re-read) Electricity bill times in UTC

`elec-format.ts:49-52` slices digits out of the ISO string; bill events and snapshot `meters[].end.at` are UTC `...Z`
(`db.py:93-94`). The bill log runs 2-3 hours behind; a closing reading taken 01:30 local on 01.12 prints on the bill paper as
"30.11 23:30" - the wrong day on a billing document. `electricity/format.ts` has a converting `fmtDateTime`; the water bills use it.
Fix: format zoned strings through `Date` in the site / account zone, keep the textual path for date-only values.

### SCR-21 (medium, CONFIRMED, re-read) Generator battery dial

`gen-logic.ts:154` `const v24 = batt > 18;` vs server `generator_alerts.py:198` `b <= 16` is 12 V. A 24 V bank sagging to 16.1-18 V
raises the server's low-battery alert while the dial treats it as a 12 V system: full scale, green, "min 11.6". Fix: use the server's
boundary, or have the server send the nominal voltage / tone.

### SCR-22 (medium, CONFIRMED) Generator alerts

`gen-alerts-page.ts:196-198` "ack all": the server acknowledges every open alert of the device (`services/generator_alerts.py:501-518`,
view permission only) while the list is a 15 s poll - a critical alert raised since the last poll is acknowledged unseen; no
confirmation. `:141` "mute 24 h": one click, any viewer, no unmute anywhere. `notice` is drawn only inside the drawer, so a failed ack
from the list only re-enables the button. Fix: confirm both; send the visible ids for ack-all; draw `notice` in the list; add unmute.

### SCR-23 (medium while `security.step_up` is on - default off, CONFIRMED) Step-up dialog

`api/client.ts:134-138` re-sends the refused request once the dialog resolves true. The dialog lives on `document.body`, survives
navigation, never times out, and its text is always "to change settings, users or permissions..." whatever `details.action` is
(`sw-step-up-dialog.ts:212`). Scenario: "open door" is refused; the user walks away; later anyone types a code to clear the box and
the door opens then. Fix: word the dialog from `details.action` (the server already has `PHYSICAL_HE`), answer false after 60-120 s
and on `hashchange`, and do not auto-replay physical actions. Related (low): concurrent refusals share one dialog built from the first
request (`shell/step-up.ts:16`).

### SCR-24 (medium, CONFIRMED) Playback picker race

`investigate-playback.ts:767-778`: `await this.endSession(); this.frames.dispose(); this.cameraId = id;`. Stepping the camera select A
-> B with the keyboard while a session plays: A's close returns last and sets `cameraId = A`; heading, recordings and playback are A
while the select shows B. `setDate` (`:800`) has the same shape. Fix: sequence token, or assign before the await.

### SCR-25 (medium, CONFIRMED) Case item removal

`investigate-cases.ts:1015`: one tap on the icon-only "X" calls `removeCaseItem`; the backend unlinks the stored file
(`routers/cases.py:514-529`). Deleting the whole case has a confirm (`:1078`). Fix: the same confirm, naming the item.

### SCR-26 (medium, CONFIRMED) Wall / kiosk camera list read once

`kiosk-wall.ts:565,597` and `live-wall.ts:806,849` are the only `load()` calls; `status` is never re-read. A camera offline (per last
sync) when the wall opens stays an offline tile with no player until the page reloads - the kiosk runs 24/7. The kiosk status tile is
hard-coded "active - go2rtc + NVR" (`:696`) beside a header pill that may say degraded (and names components the owner's no-vendor rule
would hide). Fix: re-read `listCameras()` every 60 s through `PollController` as `live-overview.ts:102` does, merging by id; drive the
tile from `health.status`.

### SCR-27 (medium, CONFIRMED by bidi rules, not rendered) Reversed arrows

`live-camera.ts:829` builds `${old} → ${new}` inside an RTL paragraph: the two numbers are separate LTR runs laid right to left and
"→" does not mirror, so 40 -> 60 reads "60 → 40"; "פעיל → כבוי" points at the old value. The NVR dialogs hard-code "←"
(`nvr-confirm.ts:153`, `nvr-encoding-batch.ts:461`, `nvr-camera-editor.ts:540`), which reads "to ← from" in English. A confirmation of a
device write that shows the change backwards. Fix: one helper - direction-isolated span, arrow picked from `dir`.

### SCR-28 (medium, CONFIRMED) Home recordings sessions

`home-recordings.ts:91-120`: `const got = st.session ? await seekPlayback(...) : await createPlayback(st.cam, at); if (g !== gen) ...`.
A double tap on play with no session runs `createPlayback` twice with the same `gen`; the first session is never closed and holds a
`playback.max_sessions` slot until its lease expires. Three quick "+10 s" send overlapping seeks; the last answer to land wins. Also
(`:108-112`) the clock is a wall-clock counter started at the seek answer - it runs ahead of the frame through stalls and after the
end. Fix: a sequence number per `playAt` (a superseded call closes what it created) or the investigate screen's `SeekCoalescer`; take
the time from the player.

### SCR-29 (medium, CONFIRMED) Camera OSD switches

`live-camera.ts:504-531`: `sw-toggle` flips itself (`components/sw-toggle.ts:151`); when the NVR refuses, `this.osd` is unchanged so Lit
does not reset `.checked` - the switch shows "off" while the recorder still burns the timestamp. Four OSD writes go to the recorder on
one press, unlike motion / schedule / reboot on the same screen. Fix: `live()` + `switchPress(...)` as the privacy-mask screen,
`loadOsd()` in the catch, confirm at least for switching the timestamp off (evidence value).

### SCR-30 (medium, code CONFIRMED / effect PLAUSIBLE) Home push refresh

`sw-home.ts:273-276` restarts a 600 ms timer on every `entity_state_changed` of any visible entity (sensors included). On a site with
more than ~2 events per second the refresh never fires (the post-command refresh is cancelled too) and the home keeps its optimistic
state only. Conversely an overview read that started before a toggle replaces `this.data` with the old state (tile flips back, dimmer
resets under the finger); `loadOverview` has no sequence guard. Fix: throttle with a 2 s maximum wait, ignore domains the home does not
draw, skip entities with a command in flight when applying, add a sequence guard.

### SCR-31 (medium, CONFIRMED, re-read) Temperature +/- on an off zone

`sw-home.ts:958` sets `z.mode` to cool / auto before `act.setTarget(z, ...)`, whose `if (z.mode === 'off')` (`home-actions.ts:60`) is
then never true: only `set_temperature` is sent. The tile shows the unit on and reverts to "off" on the next refresh. Fix: read
`wasOff` before the optimistic change and pass it.

### SCR-32 (medium, CONFIRMED) Home bill account race

`home-p3.ts:171-186`: no check that `this.bill.acc === acc` when the reads land, and `status` / `periods` are kept while loading. Tap
account A then B: A's amounts and "show bill" files can sit under B; during any switch A's money is shown under B until the read
returns. Fix: clear on switch, drop mismatched answers.

### SCR-33 (medium, CONFIRMED; needs out-of-order answers and equal revisions) Home scene edit race

`home-scene-2500.ts:119-123`: `httpAutomations.get('scene', ed.id).then((d) => { ed.d = d; ed.name = ...})` with no id check. Open edit
for A (slow), close, open B: A's detail lands last; "save" writes A's draft onto B, "to the bin" removes B. Fix: capture the id.

### SCR-34 (medium, CONFIRMED) Displaced booking shown as approved

`home-calendar.ts:229`: two labels only (`pending` / everything else = "approved"). `/me/calendar` still returns `displaced` entries
(`services/calendar/occ.py:18,70`). The resident reads "approved" and arrives at a room taken for maintenance. Fix: a warning line for
`displaced`, "ended" for `done`.

### SCR-35 / SCR-36 (medium, CONFIRMED) Resident flow reads

`resident.ts:256-273`: `loadDay()` has no sequence guard - tap day 3 then day 5; if day 3 lands last the slot grid for day 5 is computed
against day 3's entries (taken slots read "free"; the confirm sheet promises a direct booking the server may queue or refuse).
`:282-285`: a failed `mine()` sets `this.mine = []`; `mineView()` never reads `error`, so it says "you have no upcoming bookings".
Fix: sequence / requested-date guard; a separate `mineError` with retry.

### SCR-37 (medium - two days a year, CONFIRMED by arithmetic, not run) DST

`grid-logic.ts:65`: `instantAt = (day, min) => new Date(startOfDay(day).getTime() + min * 60000)` while entries are drawn by wall clock.
On the spring-forward day a 10:00-11:00 selection is stored as 11:00-12:00, on the autumn day as 09:00-10:00 (quick create, drag,
resize, duplicate; the resident slot grid shifts the room's hours). Related: `api/recordings.ts:85-105` cannot reach the first repeated
hour on the 25-hour day; `home-recordings.ts:39` `dateOf(back)` subtracts 24 h multiples. Fix: build by wall clock
(`new Date(y, m, d, 0, min)`) as `localInstant` in `booking-logic.ts:66` already does.

### SCR-38 (medium, CONFIRMED) Drawer cancel cancels the series

`event-drawer.ts:426-440,519-521`: `api.cancelEvent(ev.id, ev.revision)` with no scope from a drawer opened on one date of a weekly
entry; same button text and toast as a single booking; no undo for recurring entries. Fix: label "cancel the whole series" or offer
occurrence / series.

### SCR-39 (medium, CONFIRMED) Home ticket note sent twice

`home-tickets.ts:157-163`: `st.busy = true; void ticketNote(...)` - no early return, no `requestUpdate()` (the host does not re-render
after an action, `sw-home.ts:725-739`), and no request id (`home-p2-api.ts:79`). A double tap posts two notes. The sibling `p2TkSend`
has all three. Fix: `if (st.busy) return; h.requestUpdate();` and a `client_request_id`.

### SCR-40 (medium, CONFIRMED in code) Public page draft across tickets

`public-ticket/main.ts:110,121-125`: the draft is stored under one key, not per token. A second link opened in a tab that still holds
an unsent draft opens ticket B with A's note and status chip preselected; with SCR-05 one `online` event posts it to B. Fix: store the
token with the draft, drop it when the token differs.

### Low findings (short)

- **SCR-41** `emergency.ts:182-184`: `scope(kind)` falls back to `scopes(kind)[0]` when the selected scope does not exist for that kind.
  The select shows the union of both kinds; choose a scope that only "lock" has, hold "open": the first open scope (possibly the whole
  installation) is prepared. Mitigated: the button's door count and the confirm line name the real scope. Fix: disable the kind whose
  scopes do not contain the selection. (Precondition - differing scope lists per kind - not checked against a live binding.)
- **SCR-42** `door-windows.ts:178-184`: every error of `getEmergencyState()` sets `em = null` ("no permission"): one failed 5 s poll
  during a live incident removes the red strip and the release control until the next good poll. Fix: null only on 403.
- **SCR-43** (PLAUSIBLE) `confirm-dialog.ts:140-149`: Enter answers true without checking `e.repeat`; a held Enter on a keyboard-activated
  destructive button may confirm itself. Not run. Fix: ignore `repeat` and Enter until a keyup after opening.
- **SCR-44** `sw-passkeys.ts:175-196,326-328`: `need.retry` (remove passkey A) survives the row's "cancel" and later successes; typing a
  code then deletes A. Fix: clear `need` on cancel and at each new `run()`; name the action in the box.
- **SCR-45** `sw-second-factor.ts:451-468`: `reset()` checks only `ready()`; the typed-username form can submit twice (second DELETE
  re-uses a single-use code -> an error beside "reset done"). The result is written after the await onto whichever user is selected.
- **SCR-46** `system-notices.ts:819-837`: remove A then B quickly - the second PUT is built from the old list and re-adds A to the public
  board. `loadBoard()` has no out-of-order guard; `saveBoard` drops edits typed during the save.
- **SCR-47** (re-read) `system-diagnostics.ts:2206`: `this.loadFailed` is an object, always truthy - the "no backups yet" state is
  unreachable; a fresh installation shows an error panel. Fix: `this.loadFailed.backup ? ... : ...`.
- **SCR-48** `system-audit.ts:116-129`: no sequence guard on filter reads (CSV export exports the stale rows); time column without
  `timeZone`. CSV cells are not neutralised for a leading `= + - @`.
- **SCR-49** `system-access.ts:641-663,772`: user role bindings revoke on one click (group bindings get a preview).
- **SCR-50** `wiskey-station-people.ts:200-217`: a dropped connection during delete / adopt on several stations reads "not performed"
  though some stations may be written; `:171-183` a late duplicate check of person A is applied to B's adopt dialog (server effect
  unproven).
- **SCR-51** `sw-incoming-call.ts:361-362`: on 403 the banner disappears without `ended()` for live talk sessions (microphone open, no
  hang-up, until the server closes); other errors are swallowed so a stale "ringing" banner keeps live buttons.
  `wiskey-station-permissions.ts:93-113`: one `busy` slot for all rows; the result line can land under another person.
- **SCR-52** `explore-floor-map.ts:2507-2513`: "all off" overwrites one status slot per item; a partial failure is invisible.
- **SCR-53** `water/page-settings.ts:195` (price version) and `temperature/whatsapp.ts:243` (scheduled report, no try/catch) delete on
  one tap.
- **SCR-54** `devices-schedules.ts:606-616`: bulk enable / disable posts for every selected id, including rows hidden by filter / page.
- **SCR-55** `investigate-events.ts:1099,1376`: 500-row cap with no "more" mark ("mark all handled" covers the loaded rows only);
  ranges over one day use UTC day edges (documented in the code comment, still present) - the first 2-3 local hours are missing.
- **SCR-56** `tickets-table.ts:621-626`: `act()` does not bump `seq`, a poll already in flight restores the old status / revision
  (self-heals in ~20 s, a second attempt gets 409). `view-calendar.ts:943-960`: `before` is captured but never restored when the reload
  after a failed drag also fails.
- **SCR-57** (CONFIRMED in code, not rendered) `home-styles.ts`: the dimmer fill (`transform-origin: 100% 50%`, `translateX(-v%)`,
  `:254-261,641`) is RTL-only - in English the fill runs opposite to the finger; the user menu, camera star, theme tick and room
  temperature use physical `left` / `right` (`:423-424,747,910,642`). Fix: logical insets and a direction-aware fill.

## 3. Improvements (short)

1. One "latest wins" helper everywhere: the alarm screen's `reads.begin()` / `Latest` pattern is right and used in many screens; the
   findings SCR-14, 24, 32, 33, 35, 46, 48 are all the same missing guard. A lint rule ("`this.x = await` in a method reachable twice")
   or a shared `guarded()` wrapper would remove the class.
2. One unknown-outcome helper for physical commands: `wiskey-stations-actions.ts` (`failure()`, `holdMs()`, amber "unknown") is the
   model; the incoming-call banner, home alarm toast, automation device test and "people on stations" each re-implemented it worse.
3. Site time zone: `Asia/Jerusalem` is hard-coded across `home/` and `door-windows.ts:195`, `calendars/` uses the browser zone, the
   server uses the calendar's `tz`, the audit screen uses the browser. One `siteZone()` from settings, and wall-clock construction for
   day arithmetic (SCR-20, 37, 48, 55).
4. `home-actions.run()` never resolves when a command is superseded, so `Promise.all` in "lights off" hangs and its error toast is
   lost; "undo" after "room / house off" restores lights only while the toast says lights and climate (`sw-home.ts:650-694`).
5. Wall panel going to rest keeps an open door confirmation or a half-typed disarm code underneath (`home-wall-rest.ts:201-217`): set
   `h.ovl = null` on idle. `sw-dialog` focus rule: skip anything inside a footer slot, not only elements that are the slot (SCR-16
   class).
6. `system-diagnostics.ts:1038-1058` `save()` clears the whole draft after the await (edits made during the PATCH are dropped);
   `system-notifications.ts:1075-1087` "send test" tests the saved mail settings while the form shows unsaved ones.

## 4. Checked and fine (coverage)

Read end to end and found correct:

- **Alarm screen** (`screens/security-alarm.ts`): newest-read-wins guard, push + 15 s poll released on disconnect, code cleared on close
  and on leave, arm / disarm / bypass buttons disabled while busy and while the panel is unavailable, disarm and bypass always confirm,
  the action followed to confirmed / unknown / failed with honest wording, `code_required` re-prompt.
- **Emergency doors** (`door-windows/emergency.ts`): hold button (pointer capture, cancel on leave / key up, no key-repeat start),
  server `prepare` -> single-use token -> `start`, expiry countdown, drill forced while the real buttons are off, release only by hold +
  confirm, incident follow-up poll guarded by incident id. (Except SCR-01, SCR-41.)
- **Open for N hours** (`door-windows/open-for.ts`): two steps, door by key not index, busy guard, refusal reasons shown.
- **Door-window rules** (`screens/door-windows.ts`): enable / pause / retire / end-now all through the confirm object, settings
  "engine off" never silent, polls paused while hidden.
- **Home**: door open (confirmation holds the id, closes before sending; server re-checks door authority and refuses wall accounts),
  incoming call door confirm keyed by call / lock, arm / disarm prompts, shutters second-tap arming, `api/device-commands.ts`
  generation / supersede / per-key debounce, favourites save debounce and server merge, scope (`/home/overview` built from RBAC-visible
  entities; building filter is display-only with the server cutting bulk by building), kiosk exit checked server-side, rest / night
  mode (zone-aware window incl. midnight wrap, timers released), notices read state, recordings day load guards, guest invite.
- **WisKey / access**: stations door release (confirm captures station + lock, one send, hold on unknown, nothing offered on a stale
  feed), two-tap call controls, talk session / microphone / ring tone lifecycle, person editor (generation-guarded load, revision on
  update / delete, PIN reveal cleared), people list selection by id, person actions dialog, card capture (session bound server-side,
  epoch guards, cancel on close), bulk people (typed count, digest), profiles apply, external access (drawer race guarded, revision on
  approve / refuse / rotate, DST-aware window, code never kept), emergency grants, holidays, embed connector origin checks.
- **Video**: `sw-live-player.ts` (every callback generation-guarded, teardown closes peer connection / socket / media source / timers,
  3-30 s backoff, no retry storm on cap / denial), privacy masks (coordinates survive resize and RTL, drafts per camera, etag on apply,
  per-camera partial results), NVR single writes and batches (one confirmation, lost answer treated as unknown and re-read, undo-all
  gated), live-camera per-camera drafts, reboot flow, live wall budget / observers, playback stall / resume and seek coalescing,
  export / saved view / rule / case deletion confirms.
- **Infra / devices**: cover arm-then-confirm, unlock only through the tiles dialog (row captured, cancel focused), lock-all sequential
  with per-lock result, bulk confirm (server preview + digest, `target_changed`), protected switches (server-enforced exclusion from
  group actions), generator (monitoring only - no start / stop command exists; poll sequence guard), electricity and water bill
  lifecycle (busy guard, `client_request_id`, overlap, void reason, `row_version`), CSV exports (BOM, formula-safe), schedule editor
  (base revision, conflict banner, unsaved guard, lowering confirmation).
- **Tickets / calendars**: public pages (token from the fragment, memory + sessionStorage, headers only, uniform "unavailable"; DOM
  built through `dom.ts` text nodes, no `unsafeHTML` / `innerHTML` in the slice; per-part request ids), ticket create / status /
  assign / close / delete (busy guard, revisions, typed number for delete), bulk dialogs, quote decisions, list / table / board read
  guards, calendar approvals, backend authorisation of cancel / withdraw and masking of other residents' details.
- **Settings / users / shell**: `#/system/*` has no per-permission client gate by design - the screens and the server decide; spot-checked
  server routes all carry `require(...)` (backups, update, local identity, messaging accounts, service identity, wall, notices, NVR
  output pulse). Only Ctrl/Cmd+K and Escape are global shortcuts. Permission change re-keys the screens; sign-out reloads the page so
  step-up state and caches do not survive a user switch. Second-factor enrol / disable / recovery codes (secret only in state while
  open), factor-reset confirm, HA users (idempotent create, typed-username delete), system update (idempotency key, locked dialog),
  backup create / upload / delete / restore (typed RESTORE, passwords cleared), messaging accounts, overlay history.

No-scroll rule: `docs/changes/SCROLL-AUDIT-2480.md` section 3 remains the list of record; spot-checked at this head that its top rows
are still scrolling regions (WisKey people `.scroll` `wiskey-people.ts:1512`, exports `.list` `investigate-exports.ts:88-91`, meters
list `meters-page-base.ts:181-185`, WisKey stations rows / table `wiskey-stations-css.ts:807,819`). No new offender was found in the
alarm, door and generator screens. **A full no-scroll pass was not repeated.**

Not reached (so not claimed): `screens/home-widgets*.ts`, `home-edit-panel.ts`, `home-site-view.ts`, `system-home-screen.ts`,
`system-wall.ts`, `wall/sw-wall.ts` rendering; `wiskey-schedules.ts`, `wiskey-events.ts`, `wiskey-access-diag.ts`, `wiskey-relay-map.ts`,
`system-access-*.ts` sub-screens, `system-doors.ts`, `system-door-blocks.ts`; `investigate-history-map.ts`, `investigate-reviews.ts`,
`investigate-incidents.ts`, `live-overview.ts`, `live-views.ts`, `system-storage.ts`; `devices-building.ts` control paths,
`scene-editor.ts`, elevators, temperature detail, electricity price / VAT settings, water accounts / usage; `tickets-overview.ts`,
`tickets-rfqs.ts` and the RFQ award / send flow, `ticket-cost-card.ts`, `vendor-accounts.ts`, public `portal/` and `claim/` internals,
`system-tickets.ts`, `system-calendars.ts`; `system-wizard.ts`, `system-cast.ts`, `system-multimedia*.ts`, `system-quiet-windows.ts`,
`system-presence*.ts`, `installer-*.ts`, the plan editor / floor-map editors. Phone-width (360-430 px) and rendered RTL / English layout
were checked only where CSS was read for another reason; no screenshots were taken. Earlier audit documents (`AUDIT30-*`,
`REVIEW-2490-FIXES-2500`, `HOME-V3-AUDITFIX-2437`, `MFA-REVIEW-2520`) were searched for the terms of the findings above (no match);
they were not cross-read line by line.
