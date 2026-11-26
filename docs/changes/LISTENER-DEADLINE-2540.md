# LISTENER-DEADLINE-2540 - the notice-board and Provision push listeners get the whole-request deadline; the NVR change log offers "revert anyway"

Branch `pilot/LISTENER-DEADLINE-2540`, base `origin/pilot/CAST-RELAY-HARDEN-2540` (`1ac7534d3`), with `origin/pilot/PHYSICAL-CONFIRM-2540`
(`465360eb4`) merged in (merge `04b55a6c0`) for the confirmation dialog's `focusCancel`. Target 2.54. Follow-up of CAST-RELAY-HARDEN-2540
(deep review 2520 video V-02 and V-03): its open questions 4 and 3, built to their recommendations. No version bump, no changelog entry,
no lab / Home Assistant / NVR / go2rtc contact.

**Merge order:** this branch contains both CAST-RELAY-HARDEN-2540 and PHYSICAL-CONFIRM-2540; merge it after (or with) both.

## 1. What and why

### 1a. The whole-request deadline on the other LAN listeners (V-02 follow-up)

CAST-RELAY-HARDEN-2540 showed that `BaseHTTPRequestHandler.timeout` bounds ONE socket read: a client that drips a byte just inside it
keeps its thread for as long as it likes (slow-loris). It added `lan_listener.RequestDeadline` to the cast relay only. Confirmed still
present at the base for the two other threaded LAN listeners (the before-run of the new test, section 3).

- **Notice boards** (`services/notices/listener.py`, container port 18094): `_Handler` takes `RequestDeadline`; `REQUEST_DEADLINE_S = 10 s`
  for the request line and headers (the listener reads no body; HTTP/1.0, one request per connection); the per-read `SOCKET_TIMEOUT_S`
  stays 10 s. `_do` clears the deadline before answering (the answer is bounded by the socket timeout alone). It already used the
  shared `CappedServer`.
- **Provision-ISR alarm push** (`services/recorders/provision_push.py`, container port 18091 - the server that receives the recorder's
  alarm pushes): the handler takes `RequestDeadline` with `REQUEST_DEADLINE_S = 15 s`, which here covers the **body** too (request line,
  headers and up to `MAX_BODY` = 512 KB; a dripped body raises `TimeoutError`, the connection closes, nothing reaches the sink). The
  deadline is cleared before the answer; a refusal's small drain still runs inside it. `HANDLER_TIMEOUT_S` (10 s per read) is unchanged.
- **Shared limiter**: the push listener's own copy of the connection limiter (`BoundedServer` + a semaphore + a per-source map) is
  replaced by `lan_listener.CappedServer` with the same caps (`MAX_CONNECTIONS = 16`, `MAX_PER_SOURCE = 4`), read at every connection
  through `caps=`. The per-source request rate (`RATE_PER_SOURCE`) is unchanged. `PushListener.limited` stays the count of load refusals
  (now `rate_limited` + the server's `refused`); the unused `acquire` / `release` methods are gone.
- The Hikvision side has no listener (alert stream is a client), and the tickets public listener (uvicorn) has its own head timeout and
  connection budget - neither is touched.

### 1b. UI: "revert anyway" after `changed_since` (V-03 follow-up)

The one screen that calls the generic undo (`POST /nvr/changes/{id}/rollback`) is Settings > Connections, the NVR card's change log
(`screens/system-setup.ts`, button "החזר" / "Revert"). The encoding and privacy-mask undos have their own paths and are unchanged.

- 409 **`changed_since`**: the server's reason is shown in the card's result line, amber (`data-nvr-result="warn"`), with "nothing was
  written to the NVR"; then the shared confirmation (`confirmDialog`, used as is): heading "החזרת שינוי ב־NVR", the reason, what reverting
  anyway does (writes the state from before the change and overwrites what the device holds now), the audit line; confirm button
  "החזר בכל זאת" / "Revert anyway", **danger**, focus on **cancel** (`focusCancel` from PHYSICAL-CONFIRM-2540), so Enter cancels. Only the
  confirm resends, once, with `{"force": true}`; the success line then says "reverted anyway · recorded in the audit log".
- 409 **`already_rolled_back`**: a plain amber message ("already reverted earlier · nothing was written"), no confirmation, never
  forced from here (although the server allows it); the list is read again, so the row shows "reverted" without its button.
- `api/nvr.ts` `rollbackNvrChange(id, force = false)`: no body unless forced, exactly as before.
- The result line of the notify card gained the amber tone the system card got in PHYSICAL-CONFIRM-2540 (`data-nvr-result` now carries
  its tone: `ok` / `err` / `warn`; the attribute is still present, so existing selectors match).
- Texts Hebrew + English (`i18n/lang/en/i18n/msg/system-b.ts`, placed beside "החזר" to stay clear of the file's end).

### 1c. A forced undo records what it overwrote (coordinator addition, owner standing rule)

Before, the generic undo recorded the original change's `after` as its own `before`, whatever the device held. After a forced undo over
a `changed_since` document, the newer device state was therefore lost: undoing the undo would have written the original change's
`after` back, not what the operator had overwritten.

- `services/nvr_write.rollback` now reads the device document in every case (forced too) and records **that** document as the undo's
  `before`, as a write records its own (both `_record` calls: the verified one and the BACKEND-SAFETY-2435 unverified one). The undo of
  a forced undo then passes the normal `changed_since` check (the device holds what the undo left) and writes the overwritten state back.
- The allowed audit row of a forced undo over a changed document carries `overwrote_device_change: true` (next to `forced: true`); a
  forced undo over an unchanged document does not claim an overwrite.
- A forced undo now fails (as an unforced one always did) when the device document cannot be read first: without it there would be
  nothing honest to record.
- `routers/nvr_write.py` is untouched; the refusals and the force rule are unchanged.

No setting: the confirmation is a safety step on a refusal that did not exist in the UI before (the previous behaviour was the red
reason line only).

## 2. Files

- `smplwise_vms/backend/smplwise/services/notices/listener.py` - `RequestDeadline`, `REQUEST_DEADLINE_S`
- `smplwise_vms/backend/smplwise/services/recorders/provision_push.py` - `RequestDeadline`, `REQUEST_DEADLINE_S`, `CappedServer`, `limited`
- `smplwise_vms/backend/smplwise/services/lan_listener.py` - docstring only (who uses it)
- `smplwise_vms/backend/tests/test_listener_deadline_2540.py` (new); `tests/test_notice_caps_295.py` - its held connections also set
  `request_deadline_s = 60` (as they set `timeout = 60` against the gate race GATE2360-B)
- `smplwise_vms/backend/smplwise/services/nvr_write.py` - `rollback`: the overwritten document as `before`, `overwrote_device_change`
- `smplwise_vms/backend/tests/test_nvr_forced_undo_record_2540.py` (new)
- `frontend/src/screens/system-setup.ts`, `frontend/src/api/nvr.ts`, `frontend/src/i18n/lang/en/i18n/msg/system-b.ts`
- `frontend/tests/nvr-undo-mock.ts`, `evidence-nvr-undo-force-2540.spec.ts`, `pixel-nvr-undo-force-2540.spec.ts` (+ Linux baselines) (new)

Not touched: `cast_relay.py`, `cast_sessions.py`, `routers/nvr_write.py`, `confirm-dialog.ts`.

## 3. Tests

Fakes and mocks only: the listeners on 127.0.0.1, the fake NVR (httpx MockTransport), Playwright route mocks. Runner (Linux, slot B,
`python -m pytest -q -p no:cacheprovider -o addopts=""`, one process per group):

| run / group | what | exit | result |
|---|---|---|---|
| 1 ruff | the 5 touched backend / test files (listeners) | 0 | all checks passed |
| 1 new | test_listener_deadline_2540.py | 0 | 8 passed |
| 1 notices | test_notices_security_295, test_notice_caps_295, test_notices_106, test_bustimes_295, test_notice_slides_295, test_notice_rss_sources_295 | 0 | 210 passed |
| 1 push | test_provision_push_addon, test_provision_isr_p2, test_provision_push_probe | 0 | 43 passed |
| 1 cast | test_cast_relay_harden_2540, test_cast_relay, test_nvr_undo_changed_since_2540 | 0 | 52 passed |
| 1 guards | test_singletons_registered, test_shutdown_safely, test_i18n_errors_en_2520 | 0 | 16 passed |
| 3 ruff | nvr_write.py, test_nvr_forced_undo_record_2540.py (at `551eb404e`) | 0 | all checks passed |
| 3 undo | test_nvr_forced_undo_record_2540, test_nvr_undo_changed_since_2540 | 0 | 7 passed |
| 3 nvr | test_nvr_write, test_backend_safety_2435, test_video_secfix_2520, test_nvr_write_guard_2438, test_nvr_schedule, test_nvr_system, test_multi_nvr, test_nvr_privacy_mask, test_camera_reboot_2407 | 0 | 93 passed |
| 2 build | `npm run build` (tsc + vite) at `551eb404e` | 0 | clean |
| 2 typecheck | `npm run typecheck` (tests + scripts) | 0 | 0 errors |
| 2 eslint | system-setup.ts, api/nvr.ts, system-b.ts (en) + the 3 new test files | 0 | 0 errors (3 "file ignored" warnings for tests/) |
| 2 ratchet | `scripts/design_ratchet.py` | 0 | no count above the baseline |
| 2 unit | unit-no-native-dialogs, unit-physical-confirm-2540, unit-fe-safety-fix-2520, unit-i18n-lang-packs-2443 | 0 | 32 passed |
| 2 i18n | unit-i18n-en-ratchet-2490 | 0 | 6 passed |
| 2 evidence | evidence-nvr-undo-force-2540 (desktop + mobile) | 0 | 6 passed |
| 2 pixel | pixel-nvr-undo-force-2540 `--update-snapshots` (8 Linux baselines) | 0 | 4 passed |
| 2 pixel | pixel-nvr-undo-force-2540 + pixel-physical-confirm-2540, compare, `--repeat-each=2` | 0 | 16 passed |
| 2 regress | evidence-physical-confirm-2540, evidence-confirm-dialog-2438, evidence-multi-nvr | 0 | 24 passed, 2 skipped |

Run 1's UI half failed: the confirmation body held a literal line break inside a string (tsc 8 errors; the evidence / pixel specs then
ran against the old build and failed). Fixed in `5e556a3ce`; run 2 is the full UI half again, all green.

**Fails before, passes after** (PC, Windows, one file at a time, `.venv` python):
- `test_listener_deadline_2540.py` with the base `notices/listener.py` and `provision_push.py`: **6 failed, 2 passed** (the two
  "still answered" tests pass both ways); with the change: **8 passed**.
- `test_nvr_forced_undo_record_2540.py` with the base `nvr_write.py`: **1 failed, 1 passed** ("the undo recorded what it overwrote, not
  the change's after"); with the change: **2 passed**. Also on the PC: `test_provision_push_addon.py` 13 passed.
- The UI flow is new (no screen offered "revert anyway" before): the evidence spec's `changed_since` and `already_rolled_back` tests
  failed in run 1 against the build without the change (no amber line, no dialog) and pass in run 2.

Evidence screenshots: `docs/design/evidence/LISTENER-DEADLINE-2540/`. Before/after compare page (local, Hebrew):
`private/planning/listener-deadline-2540_compare_2026-11-26.html` (before = `04b55a6c0`, after = `551eb404e`; desktop + phone, light + dark).

NOT_RUN: the full backend suite, the full Playwright suite and the release gate (the train's gate covers them).

## 4. Open questions (recommendation first)

1. The deadlines as administrator settings (like the notice boards' connection caps)? a) no, fixed constants (10 s boards, 15 s push) -
   recommended; b) settings.
2. "Revert anyway" also for `already_rolled_back` (the server allows force there too)? a) no - a plain message, as asked; reverting a
   reverted change again is rarely meant - recommended; b) the same confirmation.
3. The new audit flag `overwrote_device_change` in the audit screen's wording: a) leave it as a detail field for now - recommended; b) a
   dedicated line in the audit viewer.
