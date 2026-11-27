# DEEP-REVIEW-2560-VIDEO-DEVICES - final deep review, area 4 (id prefix `VD`)

Reviewed head: `origin/release/2560-train` at `3739e3ded` (2.56.0 train, includes OPEN-FINDINGS-2560, CORE10-EVENTLOOP-2560,
A11Y-FOLLOWUPS-2560). Plan: `docs/review/FINAL-REVIEW-PLAN-2560.md` section 3, area 4 (on `origin/chore/FINAL-REVIEW-PREP-2560`).
Method: read-only (git diff / grep / reading). No test was run (NOT_RUN): every finding below was confirmed by reading the code path
end to end; none needed a device. The weekly usage budget was near its ceiling, so the pass was focused (see "not covered").

## 1. Summary

| Id | Severity | Title | file:line |
|---|---|---|---|
| VD-01 | medium | Alarm arm / disarm / zone bypass stamp `expires_at` from the device clock (handed over from the WisKey review: confirmed) | `frontend/src/api/alarm.ts:54`; `smplwise_vms/backend/smplwise/routers/alarm.py:197-206` |
| VD-02 | medium | A physical NVR command whose answer is lost after the PUT left is recorded `failed` and audited `denied` (alarm-output pulse, every NVR write) | `smplwise_vms/backend/smplwise/services/nvr_system.py:281-286`; `services/device_http.py:128-131` |
| VD-03 | low | Multimedia commands and queue edits stamp a 15 s `expires_at` from the device clock: a device 15 s behind (or 45 s ahead) is refused every command | `frontend/src/api/media-players.ts:587,596`; `services/media_commands.py:703-710`; `services/media_queue.py:161-169` |
| VD-04 | low | The NVR alarm-output pulse has no server-side confirmation flag and no request id (the only physical command without either) | `smplwise_vms/backend/smplwise/routers/nvr_write.py:319-324` |

Counts: critical 0, high 0, medium 2, low 2. Outside area: 2 notes (section 2.5).

## 2. Findings

### VD-01 (medium) - alarm commands stamp `expires_at` from the device clock

- Code: `frontend/src/api/alarm.ts:53-55` `envelope()` returns `expires_at: isoZ(Date.now() + 60_000)`; it is used by `panelAction`
  (arm / disarm, line 63) and `zoneBypass` (line 69). The server (`routers/alarm.py:197-206`, called at 547 and 649) refuses
  `expires < now` with 409 `expired` and `expires > now + 5 min` with 422 `validation`, both on the server's clock.
- SCR-13 (TIME-CORRECT-2540) moved the WisKey station / banner commands to `serverNow()` (`api/server-clock.ts`, kept from every
  answer's `Date` header; `api/access-writes.ts:21`, `door-tech.ts:93`, `device-bulk.ts:185`), but the alarm client was left on
  `Date.now()`.
- Failure scenario: a wall tablet or phone whose clock is 61 s or more behind the add-on (no NTP, a tablet that slept for weeks, a
  manually set clock). Every arm, disarm and bypass is answered 409 "the request expired, try again"; the retry builds the same stale
  stamp and fails again, so that device can neither arm nor disarm the panel until its clock is fixed. A clock more than 4 min ahead
  gets 422 for every press. A clock 30-240 s ahead silently widens the 60 s validity window that the envelope exists to bound.
- It fails closed (no wrong arm / disarm happens), hence medium and not high; but it is a physical action that a person may need
  right now (disarm on entry), with a misleading "try again".
- Fix: `expires_at: isoZ(serverNow() + 60_000)` (import from `./server-clock`), exactly as `access-writes.ts`. Add the alarm client to
  the SCR-13 unit spec that pins `serverNow` users.

### VD-02 (medium) - a lost answer after an NVR PUT is recorded as "failed" / audited "denied"

- Code: `services/nvr_system.py:281-286` (`pulse_output`) catches every `ApiError` from `_put` and records `status="failed"` plus an
  audit row `decision="denied"`. `_put` (`services/nvr_write.py:79-88`) goes through `device_http.request`
  (`services/device_http.py:128-131`), which turns any `httpx.HTTPError` - including a read time-out after the request body was sent -
  into the same `ApiError` (`unavailable`). The same shape is in `nvr_write.apply_change` (`services/nvr_write.py:226-231`) for every
  settings write.
- Failure scenario: an operator confirms an alarm-output pulse (a siren / gate relay); the recorder triggers the output but the answer
  is lost (Wi-Fi bridge drop, the recorder busy past the client time-out). The screen honestly shows amber "unknown, check on site"
  (`api/physical-outcome.ts`, a 5xx is `unknown`), but the NVR change log shows the pulse as `failed` and the audit says `denied`. An
  investigation of "who opened the gate at 02:14" finds a denied attempt and no fired relay.
- Fix: in `_put` (or in its callers) distinguish "nothing was sent" (connect error, 4xx, the ISAPI refusal) from "sent, no answer"
  (`httpx.ReadTimeout`, `RemoteProtocolError` after the body, 5xx from the device). Record the second as `status="unknown"`, audit
  `decision="allowed"` with `details.outcome="unknown"`, and raise with `details.outcome="unknown"` so `physicalOutcome` reads it from
  the structured field. The pulse is the one that matters most (not rollbackable, physical); settings writes can follow.

### VD-03 (low) - multimedia commands use the device clock with a 15 s window

- Code: `frontend/src/api/media-players.ts:587` (`sendQueueEdit`) and `596` (`expiry()`, used by every player command, group join /
  leave / volume, preset) stamp `new Date(Date.now() + 15_000)`. The server (`services/media_commands.py:703-710`,
  `services/media_queue.py:161-169`) refuses `expires <= now` (409 `expired`) and `expires > now + 60 s` (422).
- Failure scenario: a kiosk tablet 16 s behind gets 409 on every play / pause / volume / queue edit; 46 s ahead, 422 "invalid request".
  The window is much tighter than the alarm's (15 s), so ordinary drift on an offline tablet is enough. Not a physical-safety issue
  (players), hence low.
- Fix: `serverNow()` instead of `Date.now()` in both helpers.

### VD-04 (low) - the alarm-output pulse has no server-side confirmation and no request id

- Code: `routers/nvr_write.py:319-324` takes no body: permission `nvr.alarm_output`, then `nvr_system.pulse_output`. It is an
  `OPERATIONAL` kind (`services/nvr_write_guard.py`), so the recorder's writes switch does not gate it (by design, owner O2 = b).
  Every other physical command of the product (alarm arm / disarm, HA entity actions, WisKey door commands, NVR reboot) requires a
  `confirmed` / `confirm` field and most carry a `client_request_id` for idempotency.
- Failure scenario: the confirmation (SCR-15) lives only in the screen. Two open tabs, a script holding a session, or a client that
  replays a POST after a proxy reset fire the relay again; nothing on the server tells a duplicate from a second deliberate pulse.
- Fix: body `{confirmed: true, client_request_id}` required (422 without), and a duplicate `client_request_id` of the same user
  answers the first record instead of pulsing again (as `routers/ha.py` does with `store.action_for_request`).

### 2.5 Outside area (not chased)

- FRONTEND-CORE / CORE-DATA-RELEASE: `frontend/src/api/ha.ts:207` `runAction` (every HA entity action: locks, covers, sirens; also
  the automation device test of this area) stamps `isoZ(Date.now() + 60_000)`, and the server (`routers/ha.py:284-288`) checks only
  `expires < now` - there is no upper bound, so a device clock hours ahead makes the "short expiry" meaningless and a clock 61 s behind
  refuses every action. Same fix as VD-01 plus a 5 min upper bound on the server.
- COMMS-UTILITIES: `frontend/src/api/notifications.ts:1216` command envelope uses `Date.now() + 15_000` (same pattern as VD-03).

## 3. Re-verification of old findings (area 4)

| Old id | Status at `3739e3ded` | Evidence |
|---|---|---|
| V-01 | FIXED | `routers/media.py:580`, `routers/playback.py:228`: no route forwards go2rtc's error text (VIDEO-SECFIX-2520). Spot check only. |
| V-02 | FIXED | `services/cast_relay.py`: `CappedServer` (32 / 8 per address), `SOCKET_TIMEOUT_S` 15, `RequestDeadline` 15 s, `HLS_IDS_MAX` 8 under `_HLS_LOCK` (CAST-RELAY-HARDEN-2540). |
| V-03 | FIXED | `services/nvr_write.py:261-325`: device read and compare with `after_xml` before the PUT, 409 `changed_since` / `already_rolled_back`, `force` only on literal `true` (`routers/nvr_write.py:775-776`), the overwritten document kept as the undo's `before`. Small read-then-PUT window remains (inherent). |
| V-04 | FIXED | VIDEO-SECFIX-2520 (in 2.52); not re-read in depth. |
| V-05 | FIXED | `services/cast_sessions.py:976-1050` `access_lost` in the janitor: camera exists / enabled, `video.live` for `camera_by` or the starter, `media.cast` / `media.public` at the anchor; ONE stop. Checked that the synthetic `internal` principal gets no bypass in `rbac.Evaluator.authorize` (bindings only). |
| V-06 | FIXED | `services/autosync.py:267-278` removes disabled cameras' streams by exact name; `services/leases.py:43-47` ends open relays of a disabled camera. |
| V-07 | FIXED | `services/nvr_write.py:334-360`: cache keyed `(recorder, channel)`, only a 200 answer kept. |
| V-08 | FIXED | `services/playback.py:102-113` `TERMINAL_STATES` includes `revoked`; `mark_first_media` only from `PLAY_FROM_STATES`; `first_frame_at` reset on seek (line 359). |
| V-09 | FIXED | `routers/cameras.py:159-257`: per-camera lock, waiter re-raises the refusal it waited for, `_write_atomic` (tmp + `os.replace`). |
| V-10 | FIXED | `services/go2rtc.py:685-702`: every "/"-ending prefix and the whole path compared. |
| SCR-02 | FIXED | SCREENS-FIX-B-2520 marker in `screens/playback-day.ts` / `investigate-playback.ts`; not re-read in depth. |
| SCR-14 | FIXED | `screens/system-setup.ts:213-224`: the answer is dropped when the recorder changed. |
| SCR-15 | FIXED (UI) | `screens/system-setup.ts:232-253`: confirmation names output, recorder and pulse length, focus on cancel, recorder re-checked after the dialog. Server side has no confirmation: VD-04. |
| SCR-18 | FIXED | `screens/automation-ext-dialogs.ts` + `automation-device-test-logic.ts`: each record followed to its end, unknown is amber, sensitive step and sensitive restore confirmed, a refusal stops the step. Its `runAction` envelope: outside-area note in 2.5. |
| SCR-19 | FIXED | `api/device-bulk.ts:196-227` (missed poll keeps polling), `screens/devices-bulk.ts` `runs = new Latest()`. |
| SCR-24 | FIXED | STALE-ANSWERS-2540 markers in `screens/investigate-playback.ts`; not re-read in depth. |
| SCR-25 | FIXED (plan said OPEN) | `8ea7168f5` (OPEN-FINDINGS-2560): `screens/investigate-cases.ts:887-892` `removeItem` asks the shared confirmation (danger, focus on cancel, names the item) before `removeCaseItem`. |
| SCR-26 | FIXED | `screens/live-wall.ts`, `screens/kiosk-wall.ts`, `screens/wall-refresh.ts` (MEDIUM-REST-2540); not re-read in depth. |
| SCR-27 | FIXED | MEDIUM-REST-2540 (`i18n/bidi.ts`, `live-camera.ts`); not re-read in depth. |
| SCR-29 | STILL PARTIAL | `screens/live-camera.ts:533-535`: the two OSD switches are `controlled` (a refusal leaves them on the saved state), but one press still writes to the NVR (no confirmation; mitigated by the recorder's writes switch and the undo). Also: the date-style `<select>` (line 535) keeps the refused value after a failed write - `osdAction` (505-520) reloads only on success. |
| SCR-54 | STILL PARTIAL | `screens/devices-schedules.ts:606-617` + `schedules-logic.ts` `pickedShown`: bulk acts on the selection the filter shows on any page of it; other pages of the same filter are still included (LOWS-FRONTEND-2550 question 3). |
| SCR-55 | FIXED | `screens/investigate-events-logic.ts` / `investigate-events.ts` (LOWS-FRONTEND-2550); not re-read in depth. |

Area totals: 22 old findings - FIXED 20 (SCR-25 newly fixed on the 2.56 train), PARTIAL 2 (SCR-29, SCR-54), OPEN 0.

## 4. Improvements (short)

- One `commandEnvelope(ttlMs)` helper in `api/` built on `serverNow()`, and a lint / unit ratchet that fails on
  `expires_at` next to `Date.now()` in `frontend/src/api` (VD-01, VD-03 and the two outside-area notes are the same mistake).
- `nvr_system.pulse_output` and `nvr_write.apply_change` should share one "sent / not sent / unknown" mapping (VD-02) rather than each
  catching `ApiError` wholesale.

## 5. Checked and fine / not covered

Checked and fine:
- New backend code since `v2.52.0` in the area (19 files, +343 / -116): cast relay caps and deadlines, the janitor's `access_lost`
  (including the synthetic principal), generic NVR undo guard and `force`, playback terminal states and first-media rule, snapshot
  single flight and atomic write, motion capability cache, disabled-camera stream removal and lease end, foreign-stream prefix guard,
  `media_reach` clock-back probe, the AREA-HONEST-COUNT alarm / lock merge rules in `services/devices.py`, the SEC-6 home-interface
  gate on the media WebSocket.
- New frontend code in the area: `api/physical-outcome.ts`, the automation device test (step and restore), the NVR system card pulse
  and stale-answer guard, the bulk dialog stale-run guard and missed-poll rule, the schedules bulk selection, the case-item removal
  confirmation, the 2.56 announcer change on the NVR system card.
- Never-read ground, sampled: `services/recorded_days.py` (month bounds, DST months, the device day list is bounded 1-31 and filtered by
  `through.day` before `dt.date` is built - no crash on a 30-day month), `services/nvr_batch.py` / `nvr_encoding_batch.py` /
  `nvr_settings.py` (first failure stops, no retry, `batch_guard` re-checked under the write lock), the Frigate event retain /
  sub-label writers (`frigate_control_svc.py:240-283`: scope first, verified read-back, `unverified` recorded honestly).

Not covered (honest list):
- Not re-read in depth: V-04, SCR-02, SCR-24, SCR-26, SCR-27, SCR-55 (status taken from markers and change notes).
- Never-read ground not reached in this pass: media groups / queue internals beyond the envelope, camera discovery, the recording
  search time-zone conversion (`recordings.py`, `search_store.py`), `nvr_schedule.py`, `nvr_system.py` beyond the pulse, scenes / scene
  editor, `investigate-history-map.ts`, `investigate-reviews`, `investigate-incidents`, `live-overview`, `live-views`,
  `api/automations.ts` (172 KB), the 19 `automation_*` services.
- Tests of the area were not sampled for assertion strength. Nothing was executed.
- Lab items still open (not touched): what go2rtc sends for an `ffmpeg:` source (V-01 follow-up, password rotation decision).
