# Runbook - the first real door-window program write (one internal door, lab) - DOORWRITE-297

Status: **PREPARED, NOT RUN.** Nothing in this document has been executed. It is run once, by the lead, in a session with the owner
present, after the owner confirms the items in section 2 in chat. No lab addresses, serials or tokens appear here; they stay in
`secrets/lab.env` and are never echoed.

## 1. What this write is, and what it is not

- **Is:** Arx writes ONE hold-open program (`stations/technical_program_save`) for ONE internal door of the lab WisKey, reads it back,
  proves it, and then pauses it again (`stations/technical_program_action pause`). The program's only window is placed at a time that
  does **not** occur during the session, so WisKey never sends `alwaysOpen` and the door does not move.
- **Is not:** an emergency action (emergency buttons stay blocked: `EMERGENCY_ENGINE_BUILT` False, untouched), a door open, a window that
  runs, a change to any other door, station, user, schedule, go2rtc stream or HA setting. Watching a real window run (the door actually
  held open) is a separate, later step that needs its own per-action approval (section 7).

## 2. What the owner confirms in the session (in chat, before step 4)

1. The door: which station and which relay (the owner names it on screen; the lead repeats the door label back). It is an **internal**
   door, not an exterior door, not a fire exit, not on an escape route.
2. The door has **no** program made in the WisKey panel today (the read in step 3 must show none or an Arx program; a foreign program
   stops the runbook).
3. The window: one weekly period on a day and time that will not occur during the session (proposal: the day after tomorrow,
   03:00-03:05 local). The owner may pick another.
4. Go for the write (one save, one pause, at most one pause-before-save if an Arx program already exists).
5. The rollback choice for the end: (a) leave the paused "Arx windows r<relay>" record in WisKey (recommended: it is inert), or
   (b) the owner removes it in the WisKey panel himself.
6. Someone can look at the door or its camera during the session (a safety observer, even though no window should run).

## 3. Preconditions (checked read-only before anything is written)

| # | Check | How | Stop if |
| --- | --- | --- | --- |
| P1 | The lab add-on runs a **lab-only build** of `pilot/DOORWRITE-297` with `PROGRAM_ENGINE_BUILT = True` on a lab branch (never main, never tagged, never a customer build). `EMERGENCY_ENGINE_BUILT` stays False | `scripts/eccact_activation_status.py` on the lab add-on: program on, emergency off, legacy combined off | emergency shows on, or the build is not the lab branch |
| P2 | The WisKey direct connection is selected and its discovery lists the three program commands | Arx Settings > WisKey connection status (read) | not selected / a command missing (the write would answer `not_sent transport_not_selected`) |
| P3 | Door windows switch `doors.windows.enabled` is OFF and no rule exists | Door windows screen | any rule exists (other doors would be written) |
| P4 | Exactly one read of the station's programs | `GET /doors/windows/doors/{station}/{relay}/program/preview` after step 4a (one `technical_program_list`) | the door has a program not named "Arx ..." (foreign), or the read fails |
| P5 | Station and HA healthy, intercom feed `ready` | Arx WisKey status page (read) | anything not ready |
| P6 | Backup of the Arx database taken | Settings > Backup (local file) | backup fails |

## 4. Steps (the lead runs them; each step's result is pasted into the session log with ids only)

a. Create the rule **disabled**: Door windows > new weekly rule, name "Lab write test", the one door only, the one period from 2.3.
   Do not enable yet. Nothing is written (switch off, rule disabled).
b. Turn the switch on: `doors.windows.enabled = on` (Settings, confirmed). Still nothing is written: no enabled rule.
c. Dry run: `GET .../program/preview`. Expect `action = write`, `two_writes = false`, `in_window = false`, `invalid = null`,
   `current.exists = false` (or an Arx program), `program.weekly` showing exactly the one period. Record `sha`.
   **Stop** on any other action. Owner says "go" (2.4).
d. Enable the rule (confirmed). The worker's sync writes within seconds; or `POST .../program/apply {confirmed: true, expect_sha: <sha>}`
   to write this door only. Expect the answer `outcome = written`, `write.state = verified`, `write.version = 1`.
e. Read-back, independently: `GET .../program/preview` again -> `action = unchanged`, `current.matches = true`, `current.enabled = true`,
   `current.status = idle`. In the WisKey panel (owner's screen): the door shows a program "Arx windows r<relay>" with the one period.
f. Idempotency: wait one sync cycle (5 min) - the audit shows no second `door.window.engine_write` for the door, and WisKey's revision
   is unchanged.
g. (Optional, owner decides in the session) drift check: the owner pauses the program in the WisKey panel; after the next drift check
   (<= 15 min) the door row says the program was paused in the intercom, state `drift`; Arx does **not** re-enable it.
   Then `.../program/apply {confirmed: true}` restores it -> `verified`, version 2.

## 5. Rollback (always run, also after a failure at any step)

1. Disable the rule (or retire it). The next sync pauses the Arx program (`technical_program_action pause`) - the close direction.
2. Turn `doors.windows.enabled` off. Expect the door's `write.state = idle`; the preview shows `current.enabled = false`.
3. Per 2.5: leave the paused record (a) or the owner removes it in the WisKey panel (b). Arx has no "remove" call.
4. Re-install the regular build (program engine off) on the lab add-on; `eccact_activation_status.py` shows the program engine off.
5. If anything is unclear at any point: step 1 and 2 first (pause), then stop and report. Never repeat a save after an `unknown`
   answer: read (preview) first.

Failure handling during the write: `retry_wait` / `failed` with a Hebrew sentence on the door row; the lead does not press "write again"
more than once without the owner; an `unknown` save is settled by the next read only.

## 6. Evidence to keep (ids and codes only)

- Audit rows `door.window.engine_write`, `door.window.program_apply`, `door.window.program_drift` (ids, codes, revision, sha prefix).
- Preview answers before/after (program summary is fine; no station id or relay in a committed file - redact to `<station>:<relay>`).
- One note answering the open questions: does WisKey list the policy back exactly as saved; the revision after save / pause.
- Raw captures, if any, go to `private-evidence/` only.

## 7. Not in this runbook (needs its own approval)

- Letting a window actually run (WisKey sends `alwaysOpen`, the door is held, then `close`) and watching the watchdog confirm the relock.
- Any second door, any exterior door, any emergency button, turning `PROGRAM_ENGINE_BUILT` on in a release build.
