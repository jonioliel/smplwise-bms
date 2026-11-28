# FIX-VIDEO-2570 - NVR settings writes honest on a lost answer, media bulk on the server clock, OSD and schedules bulk honest

Row of the 2.57 fix train. Findings of `DEEP-REVIEW-2560-VIDEO-DEVICES.md` (branch `origin/review/DEEP-2560-VIDEO-DEVICES`) left
OPEN / PARTIAL. Base: `origin/release/2570-train` = v2.56.0 (`6ea807b2e`). Every finding was re-checked at the base first.

## Already fixed at the base (not touched)

- **VD-04** (pulse: server-side confirmation + request id) - fixed in 2.56 by FIX-NVR-PULSE-2560 (`c42fd3eac`, merged into the
  2.56 train): `POST /nvr/outputs/{id}/pulse` requires `{confirm: true, client_request_id}` (422 without), a repeated id of the same
  user / recorder / output inside 120 s answers the first result and sends nothing; `api/nvr.ts` sends both. Tests:
  `tests/test_nvr_pulse_confirm_2560.py`.
- **VD-02, the pulse half** - fixed by the same row (`nvr_system.pulse_output`: unknown / allowed / 504 `action_outcome_unknown`).
- **VD-03, most of it** - fixed in 2.56 by FIX-SERVER-CLOCK-2560 (`api/media-players.ts` / `api/media-screens.ts` `expiry()` on
  `serverNow()`, `media-group-dialog`, `home-p3*`). One call was left on the device clock (below).

## What changed

### VD-02, the settings half (`services/nvr_write.py`)
`apply_change` (every generic NVR settings write: notify-center, motion, OSD, channel name, schedules, smart rules, clock, NTP) caught
every `ApiError` from the PUT and recorded `failed` / audited `denied`. Now a PUT that was sent but got no good answer - a transport
failure other than `ConnectError` / `ConnectTimeout` / `PoolTimeout`, or a 5xx from the recorder - is recorded `status="unknown"`,
audited `decision="allowed"` with `details.outcome="unknown"`, and answered 504 `action_outcome_unknown` with
`details = {..., cause, change_id, outcome: "unknown"}` ("לא ידוע אם השינוי נשמר ב־NVR ..." / English in `error_text_en.json`).
Nothing is re-sent. A refusal or "nothing sent" stays `failed` / `denied` (its audit row now also carries `outcome: "refused"`).
An `unknown` change is not offered for undo (the generic undo accepts only `applied` / `rolled_back`).
The rule (`NOT_SENT_TRANSPORT_ERRORS`, `put_outcome_unknown`) moved to `nvr_write.py`; `nvr_system.pulse_outcome_unknown` delegates to
it (one mapping for the pulse and the settings writes - review improvement 2).
`PUT /nvr/notify` (writes several documents, keeps going after a failure as before): an unknown document is reported
`status: "unknown"` with its `change_id`, and the answer gains an additive `unknown` count. `system-setup.ts` adds
"{n} לא ידוע אם נשמרו (הקשר עם ה־NVR נפסק) · לבדוק" to the result line when it is non-zero (the line is then not green).

### VD-02, the other NVR commands (second review `DEEP-REVIEW-2570-VIDEO-DEVICES.md`, lead request)
The same "lost answer = failed + denied" mapping was left on three more physical commands. Each now records a sent command with no
good answer as `unknown`, audits it `allowed` with `outcome: "unknown"`, answers 504 `action_outcome_unknown` with
`details.outcome = "unknown"` and the `change_id`, and sends nothing again; "nothing sent" (connect error) and refusals stay
`failed` / `denied` (`outcome: "refused"` in the audit):
- **NVR reboot** (`nvr_system.reboot`) - the case where the recorder almost always drops the link while it restarts. Text:
  "לא ידוע אם ה־NVR מופעל מחדש: הקשר נפסק אחרי שהפקודה נשלחה (בזמן הפעלה מחדש זה צפוי). חכו כמה דקות ובדקו שהוא חזר, לפני שליחה
  חוזרת." The system screen already shows a physical unknown in amber (`physicalOutcome`, PHYSICAL-CONFIRM-2540).
- **Disk check** (`nvr_system.start_smart_test`).
- Both through one helper, `nvr_system._command_failed`, on the shared `put_outcome_unknown` rule.
- **Camera reboot** (`services/camera_reboot.py`): `_send` told a dropped connection apart from "could not connect" (it collapsed
  every transport error into `source_unavailable`, answered "the camera was not restarted"); a 5xx from the NVR is unknown too.
  `finish` records `unknown` / `allowed`, raises 504 `action_outcome_unknown`; an unknown restart holds the camera's 5-minute
  cooldown and counts for the per-user limit (it may have restarted). The camera screen (`camera-reboot-logic.ts`
  `rebootErrorText`) says `errorUnknown` ("לא ידוע אם המצלמה הופעלה מחדש ... בדקו את התמונה לפני לחיצה חוזרת." / English) for
  `outcome: unknown` and for no answer at all, instead of "the camera was not restarted".

### VD-03, the rest (`screens/devices-media-card.ts`)
The area "all off" of the multimedia card (`media().bulkRun('area', ...)`) stamped `new Date(Date.now() + 15_000)`; it now uses the
shared `expiry()` of `api/media-screens.ts` (15 s on `serverNow()`). `api/server-clock.ts` not touched.

### Alarm route 422 code alignment (`routers/alarm.py`)
An arm / disarm / bypass whose `expires_at` is more than 5 minutes ahead was 422 `validation` ("expires_at רחוק מדי (עד 5 דקות).");
it is now 422 `expires_too_far` with the common text "תוקף הבקשה חייב להסתיים תוך 300 שניות." (as `routers/ha.py`, devices bulk and
the WisKey routes), `details.fields = ["expires_at"]` kept for older readers. The unused table entry was removed.

### SCR-29 (`screens/live-camera.ts`)
- After an OSD write that did not succeed the recorder is read again (`rereadOsd`; a failed re-read keeps the card and says so), and
  the date-format `<select>` is bound with `.value=${live(...)}` - a refused format no longer stays on screen.
- A write whose answer was lost (no answer at all, the server's `outcome: "unknown"`, or a proxy answer without the server's error
  model) says "לא ידוע אם השינוי נכתב למקליט" - never "failed", never re-sent. The message carries `data-osd-outcome`
  (`ok` / `refused` / `unknown`); no style changed.
- One press writes once: already true at the base (the `osdBusy` guard is set before the request; the controlled switch and the
  label send one `change`); now pinned by a test.
- Not changed: an OSD switch still writes on one press without a confirmation dialog (an overlay, not a physical action; recorded,
  undoable, gated by the recorder's writes switch) - see the open question in the report.

### SCR-54 (`screens/devices-schedules.ts`)
The bulk bar acted on the selected schedules of the current filter on every page of it. Now it acts on (and counts) only the selected
schedules on the page on screen: `pageView()` is the one computation of the page (sorted, fitted page size, clamped page) used by both
`renderList` and `pickedNow`. A pick on another page stays selected and counts again when the person returns to that page.

## Tests

New: `smplwise_vms/backend/tests/test_fix_video_2570.py`, `frontend/tests/unit-fix-video-2570.spec.ts`,
`frontend/tests/evidence-fix-video-2570.spec.ts` (fake NVR / mocked API / demo store; no device contacted).

### Results (runner, 28.11, slot B; jobs `p2570_fixvideo_run.sh`, `_run2.sh`, `_run3.sh`, `_run4.sh`)

"Before" = the base sources (`origin/release/2570-train`, v2.56.0) with this branch's new test files copied in.

| Check | Before | After |
|---|---|---|
| `tests/test_fix_video_2570.py` (16 cases at head `5f29a3755`) | 13 failed, 3 passed (the 3 passing are the "nothing sent / refused stays failed + denied" guards) | 16 passed |
| `tests/unit-fix-video-2570.spec.ts` (4) | 4 failed | 4 passed |
| `tests/evidence-fix-video-2570.spec.ts` (desktop, 4) | 3 failed (date format stayed on the refused value; no re-read after a lost answer; bulk bar counted the page-1 pick), 1 passed (one press = one write - already true at the base, pinned now) | 4 passed (with `evidence-honest-states-2540` and `evidence-schedules-list`, desktop: exit 0, no failure) |
| Backend, one process per file (after): `test_camera_reboot_2407` 9, `test_nvr_system` 8, `test_nvr_pulse_confirm_2560` 6, `test_nvr_write_guard_2438` 10, `test_i18n_errors_en_2520` 9; at `ff45889f9` also `test_nvr_write` 5, `test_backend_safety_2435` 10, `test_nvr_forced_undo_record_2540` 2, `test_nvr_undo_changed_since_2540` 5, `test_alarm` 38, `test_fix_server_clock_2560` 3 | - | all passed |
| Frontend unit (after): the new spec + `unit-camera-reboot-2407`, `unit-lows-frontend-2550-screens`, `unit-honest-states-2540`, `unit-fix-server-clock-2560`, `unit-physical-confirm-2540`, `unit-i18n-en-ratchet-2490`, `unit-i18n-api-2442` | - | 92 passed (run 2) + 28 passed (run 4) |
| `tsc --noEmit -p tsconfig.json` / `-p tsconfig.tests.json`, eslint on the changed sources | - | exit 0 |
| ruff (F) on the changed backend files | - | clean |

Run 1 found a parse error in the English catalogue (an apostrophe in a quoted string; fixed in `fa988d8b3`) - tsc and the build
were red there; runs 2 and 4 are the valid "after" results. The evidence run was at `9936199b1`; the later commit `5f29a3755`
(second-review addition) changes only backend services and the camera-reboot words, covered by the backend and unit runs above.

NOT_RUN: the full backend suite, the mobile / tablet Playwright projects, pixel baselines (no look changed: only text in existing
message lines and a data attribute; no compare page made), the release gate, any lab / device test (fake NVR only).

## Rollback
Revert the branch's commits; no schema or data migration (the `unknown` status is a value of the existing `nvr_changes.status`
text column, already written by the 2.56 pulse).
