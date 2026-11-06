# T035-OUTAGE-RUN-2405 — the recorded pilot outage / safety run (disconnect scenarios on fakes)

Branch `chore/T035-OUTAGE-RUN-2405`, cut from `origin/main` at `eab715e53` (v2.40.4). No merge, no version bump, no changelog entry,
no UI rebuild, no tag. No lab contact: no Home Assistant, NVR, go2rtc, WisKey, station, door or tunnel was touched. Everything below
ran against fakes, on the Ubuntu runner (`private/runner/run_smart.py`) unless a row says otherwise.

Board card T035 (P0, `requires_hardware: true`) asks for disconnect / restart / timeout / NVR-continuity runs with recorded results
and no PASS on a skipped test (AT069, AT070). This run covers the **disconnect and safety part on fakes**. The end-to-end run on the
real equipment (floor → camera → Live → previous hour → event, and an HA entity → approved safe action) still needs the lab and the
owner; AT069 / AT070 stay `NOT_RUN` (section 6).

## 1. The suite

`smplwise_vms/backend/tests/test_outage_run_t035.py` — 15 tests, 8 scenarios. Each test walks one outage through its whole cycle on
the real add-on code (healthy → the fault → during the fault → recovery) and only the far side is faked:

| Far side | Fake used |
|---|---|
| Home Assistant WebSocket + WisKey (`hikvision_intercom/*`) | `FakeHa` of `tests/test_intercom.py` (auth handshake, WisKey's overview / unlock shapes) wrapped in `GatedHa`: refuses connects (`ConnectionRefusedError` / `OSError`), answers `auth_invalid` (revoked token), drops the live socket, answers `unknown_command` (WisKey loading), never answers the unlock |
| The bridge's `execute` (device tiles, a non-WisKey lock) | `httpx.MockTransport` behind `ha_client._bridge_client`: `ConnectError` (never connected), `ReadTimeout` (the command left, no answer), `401` (token refused), `200` |
| NVR alert stream | `httpx.MockTransport` behind the real `AlertStreamListener`: `ConnectError` while down, then a live stream with a heartbeat |
| NVR discovery / go2rtc | `nvr.device_info` / `discover_channels` patched (as `tests/test_autosync.py`); `FakeGo2rtc` of `tests/test_recordings.py` (with a foreign `intercom_door_1` stream) and a go2rtc that answers every call `go2rtc_unavailable` |
| Full data disk | a `sqlite3.Connection` factory that fails every INSERT / UPDATE / DELETE / REPLACE with `SQLITE_FULL` ("database or disk is full"), reads working, and `shutil.disk_usage` reporting 100 MB free |
| Add-on restart | an exception at the crash line (after WisKey accepted the release / with the tile's pending row committed), then a **new app on the same database** with nothing kept in memory; the WisKey person-write journal with a second boot id |

Every scenario proves the four properties of the card: **(1)** Arx degrades safely and no door opens (no unlock frame / no `execute`
reaches the far side during the fault); **(2)** no write is replayed (nothing refused or cut off is sent again on reconnect; a
resubmitted command id is refused or answered from its record); **(3)** the operator sees a clear state (the answer's code and
`outcome`, the WisKey screen's feed state, the top-bar summary); **(4)** recovery without manual steps where it should — and where it
cannot (a revoked token, a full disk), the operator is told what is needed. Each test prints one `T035_SCENARIO {json}` line with what
it observed (section 5).

## 2. Scenario table

"Door" = a WisKey door release (`POST /intercom/stations/{id}/release`, the one door path). "Tile" = a device tile's `lock.unlock` of a
non-WisKey lock through the bridge's `execute` (`POST /ha/entities/{id}/actions`).

| # | Scenario / fault | Expected | Observed (runner, `384b5acb4`) | Evidence |
|---|---|---|---|---|
| S01 | **HA restart**: socket drops, connects refused, then HA `STARTING` with WisKey not loaded, then RUNNING | door refused, nothing sent; WisKey screen keeps the copy marked not fresh; feed back by itself; nothing refused is sent later | door 503 `intercom_unavailable`, `outcome: not_sent`, "הפקודה לא נשלחה: תשתית המערכת אינה זמינה כרגע."; feed `ha_unavailable` → `connecting / wiskey_loading` → `ready` with no action; unlock frames 2 = the two allowed releases only; audit `ok, not_sent, not_sent, ok`; restart back-off capped at 15 s | `test_s01_ha_restart_door_path` |
| S02 | **HA unreachable** (no route) | door refused; summary warns entity states may be stale; feed back by itself | door 503 `not_sent`; summary `ha` warn "הסנכרון עם תשתית המערכת מנותק; מצבי ישויות עלולים להיות מיושנים"; ready again, one frame for the one allowed release | `test_s02_ha_unreachable_door_path_and_summary` |
| S02 | **HA unreachable** under a tile unlock: never connected / connection cut after sending | never connected → `failed`, retryable (true: nothing left); cut after sending → **`unknown`, not retryable, "check the device first"**; the same click is not resent | `ConnectError` → 503 `ha_unavailable`, retryable, row `failed`, 0 delivered; `ReadTimeout` → **504 `action_outcome_unknown`**, retryable false, row `unknown`; same click id → same row, still 1 delivered; fresh click → `pending`, 2 delivered | `test_s02_bridge_execute_transport_failures_are_told_apart` — **defect D1 fixed** |
| S03 | **HA token revoked** (`auth_invalid` on every reconnect) | nothing sent; the operator is told the access was refused (not "reconnecting"); after a valid token the feed is back by itself, no replay | door 503 `not_sent`, feed `ha_unavailable / ha_forbidden`; summary `ha` **error** "תשתית המערכת דחתה את הרשאת הגישה של התוסף — מצבי התקנים אינם מתעדכנים ופקודות לא יישלחו עד לחידוש ההרשאה"; retries continue on the back-off; ready again with 0 frames | `test_s03_token_revoked` — **defect D3 fixed** |
| S03 | **HA token revoked** under a tile unlock (401) | `failed` (HA refused it, nothing happened); not resent | 503 `ha_forbidden`, row `failed / ha_forbidden`; same click → same row, 1 delivered | `test_s03_bridge_execute_refused_token` |
| S04 | **WisKey restarting** (HA RUNNING, WisKey's commands unknown): (a) back within the re-probe window, (b) away longer | refused while away; copy kept in (a), dropped in (b); back by itself in both; nothing replayed | (a) 503 `not_sent`, feed `connecting`, copy kept, not fresh; (b) after the re-probes 503 `not_sent`, state `not_installed`, copy dropped, re-probed on `RETRY_ABSENT_S` and `ready`; 0 frames until the next allowed release | `test_s04_wiskey_restarting` |
| S04 | **WisKey unavailable**: a station offline; WisKey stops answering mid-command | offline: refused before sending; no answer: outcome unknown, relay held, never retried | offline → 409 `intercom_station_offline` `not_sent`; no answer → 504 `intercom_outcome_unknown`, `retry_after_s` set; a second press → 409 `intercom_release_in_progress`; WisKey's side restarts → ready, still exactly 1 frame | `test_s04_wiskey_unavailable_station_offline_and_no_answer` |
| S05 | **NVR down** (alert stream) | summary error "NVR מנותק"; the listener retries alone; on return the outage is a coverage gap (NVR continuity); only reads to the NVR | summary `nvr` error "NVR מנותק — אין התראות חיות; וידאו חי והקלטות עשויים להיכשל"; reconnected with no action; one `coverage_gap` event `{reason: ConnectError}`; every device request `GET /ISAPI/Event/notification/alertStream` | `test_s05_nvr_down_alert_stream` |
| S05 | **NVR down** (discovery) and **go2rtc down** (stream sync) | NVR: keep the last camera list, warn; go2rtc: warn in the bar, error in the administrator's report; both healed by the next periodic run; foreign go2rtc streams untouched | NVR down → `discovery` warn, 1 camera kept; go2rtc down → `go2rtc` warn "סנכרון הזרמים ל־go2rtc נכשל", report "go2rtc אינו זמין (…)"; next run → both items gone; `intercom_door_1` unchanged, nothing foreign deleted | `test_s05_nvr_and_go2rtc_down_discovery_and_streams` |
| S06 | **Remote tunnel drops**: the release reached Arx, the answer was lost; the app resubmits; a command outlives the outage | the same envelope is refused as a duplicate; an expired command is refused, never queued; a fresh one works | resubmitted → 409 `intercom_duplicate_command` "הפקודה הזו כבר נשלחה (אותו מזהה פקודה), ולכן לא נשלחה שוב."; stale → 409 `expired`; fresh → 200; 2 frames for 2 distinct commands | `test_s06_tunnel_drop_door_path` |
| S06 | **Remote tunnel drops** under a tile | the resubmitted click is answered from its record | same row, 1 delivered | `test_s06_tunnel_drop_device_action` |
| S07 | **Disk full** | no record → no command (door and tile); a plain answer; the bar says the disk is full and can still be read; after space is freed everything works and nothing refused is sent later | door → **507 `storage_full`**; tile → **507 `storage_full`**, `sent: false`; 0 frames, 0 delivered; summary readable (200) with `storage` **error** "אחסון התוסף כמעט מלא — שמירות, תיעוד פעולות ופקודות עלולים להיכשל"; after freeing: item gone, door 200, the refused tile click may be pressed again (it left no record) | `test_s07_disk_full` — **defects D2, D4, D5 fixed** |
| S08 | **Add-on restart mid-write**: door — WisKey accepted, the process died before the outcome row | the restart sends nothing; the audit keeps the attempt (the honest "may have been sent"); the same envelope is refused | crash → 500; after the restart 0 frames; audit: attempt row, no outcome row; resubmitted → 409 `intercom_duplicate_command` | `test_s08_restart_mid_door_release` |
| S08 | **Add-on restart mid-write**: tile — pending row committed, the call out | nothing re-sends it; after the window the row reads `unknown`; the same click is answered from the record | row `pending` → after the restart and the window `unknown`; 0 calls after the restart | `test_s08_restart_mid_device_action` |
| S08 | **Add-on restart mid-write**: WisKey person write out on the wire | the next write to that person is held until a readback after the hold | new boot: `outcome_pending`, after `HOLD_S` `readback_required`, after a readback admitted | `test_s08_restart_mid_wiskey_person_write` |

## 3. Defects found and fixed (minimal product fixes, each with its test)

| # | Defect (what the operator / the door saw) | Fix | Test |
|---|---|---|---|
| D1 | A tile command whose bridge call was cut **after** it left (read timeout, dropped socket) was recorded `failed`, shown "נכשל · תשתית המערכת אינה זמינה" and answered `retryable: true` — while Home Assistant may already have unlocked. The next press (a new click id) could open it again. The bulk path (`device_bulk.UNKNOWN_ERRORS`) and the door path (`_NOT_SENT_ERRORS`) already told the two apart; the single-entity route did not. | `routers/ha.py`: a transport failure other than `ConnectError` / `ConnectTimeout` records `unknown` and answers 504 `action_outcome_unknown`, `retryable: false`, "לא ידוע אם הפקודה בוצעה … בדקו את מצב ההתקן לפני ניסיון נוסף." A connection never made stays `failed` / retryable. | `test_s02_bridge_execute_transport_failures_are_told_apart` |
| D2 | Disk full: a door release (its attempt row cannot be written) ended in a bare `500 Internal Server Error` (no envelope, no words); a tile press said "המערכת עסוקה… נסו שוב" (it will not help). Both were safe (nothing sent) but unclear. | `db.is_storage_full`; `main.py` answers `SQLITE_FULL` anywhere with an enveloped 507 `storage_full` (any other database error keeps its old path); `routers/ha.py` answers the refused pending row with 507 `storage_full`, `sent: false`. | `test_s07_disk_full` |
| D3 | A revoked / replaced add-on token: the bar said only "warn — the sync is disconnected", and the sync status line read "מנסה שוב…" (the `ha_forbidden` code had no text) — waiting never heals it. | `health_report.summary`: an `ha` **error** that says the access was refused; `frontend/src/api/ha-sync-status.ts`: `ha_forbidden` reads "תשתית המערכת דחתה את ההרשאה". | `test_s03_token_revoked`; `frontend/tests/unit-ha-sync-status.spec.ts` |
| D4 | Disk full was visible only in the administrator's health report; the operator's top bar showed nothing. | `health_report.summary`: a `storage` error under the report's own threshold (`STORAGE_ERROR_FREE`, 512 MB). | `test_s07_disk_full` |
| D5 | Disk full also broke the **reads**: once a minute per user, `auth.touch_user` writes the last-seen stamp, and its failure failed the whole request — the status pill and the live screens answered 507/500. | `auth.touch_user`: on the read path a full-disk failure of the stamp is logged and skipped (tried again on the next request). | `test_s07_disk_full` (the summary read while full) |

Before the fixes the same suite on the base code gave **3 failed, 12 passed** (run 0): D1 (503 instead of 504), D3 (`warn` instead of
`error`), D2 (500 instead of 507). D4 and D5 are later assertions of the same S07 test, reached only once D2 was fixed.

## 4. What was checked and left as it is

- The door path itself needed no change: the attempt row is committed before sending ("no record, no command"), the envelope's
  expiry and duplicate check refuse a replay across a restart, an unanswered release is `unknown` with the relay held, and a WisKey
  door never leaves through `execute`.
- HA sync and the WisKey feed reconnect on their own with a capped back-off (HA restart: 15 s for the first 5 minutes; the feed:
  5 s doubling to 60 s).
- The NVR listener records an outage of 45 s or more as a coverage gap; discovery keeps the previous camera list; the go2rtc stream
  sync never touches a stream outside the `smplwise_` namespace.

## 5. Run receipts

All runner jobs went through `private/runner/run_smart.py ... --machine runner`, one at a time, each after checking that no release
gate was running (`gate_status.json`: `pass`, release/2404-train); the job's `.tmp_*` folders were removed afterwards. Receipts:
`docs/changes/receipts/T035-OUTAGE-RUN-2405/`.

| Run | Where | Code | Command | Result | Receipt |
|---|---|---|---|---|---|
| 0 | workstation (Windows, Python 3.12), temporary detached worktree, removed after | base `eab715e53` + this suite only | `pytest -q tests/test_outage_run_t035.py -rfE` | **3 failed, 12 passed** - the defects D1, D3, D2 | `run0_prefix_workstation.txt` |
| 1 | runner (Ubuntu, Python 3.12) | `384b5acb4` | `run_smart.py backend chore/T035-OUTAGE-RUN-2405 tests/test_outage_run_t035.py -rA` | **15 passed** in 85 s | (superseded by run 4, same commit) |
| 2 | runner, two shards | `384b5acb4` | `run_smart.py backend chore/T035-OUTAGE-RUN-2405` (the whole backend suite) | shard 1: **9698 passed**, 12 skipped; shard 2: **11139 passed**, 14 skipped, 3 xfailed; **0 failed** (2 h 44 min) | `run2_full_backend_runner.txt` |
| 3 | runner | `384b5acb4` | `run_smart.py spec chore/T035-OUTAGE-RUN-2405 tests/unit-ha-sync-status.spec.ts --project=desktop` | **3 passed** (the new `ha_forbidden` case included) | `run3_unit_spec_runner.txt` |
| 4 | runner | `384b5acb4` | `run_smart.py backend chore/T035-OUTAGE-RUN-2405 tests/test_outage_run_t035.py -rA` | **15 passed** in 21.6 s; the 15 `T035_SCENARIO` records | `run4_outage_suite_runner.txt` |
| - | workstation | the branch | `python scripts/release_check.py` | `RESULT: ready for the owner's approval` (version 2.40.4 unchanged, migrations contiguous at 0206) | (console) |

The later commits of the branch change documentation and the board files only (no code). Skipped tests in run 2 are the suite's own
long-standing skips; none of the T035 tests is skipped. On the busy workstation one timing-bound test
(`test_lat1_toggle_latency::test_the_command_is_recorded_before_it_leaves_and_waits_for_a_short_write_lock`) missed its bound
once; it passed in the runner's full run (run 2) and its path (the pending row and the call) is not changed by this branch.

## 6. Known limits, NOT_RUN

- **No hardware.** AT069 (floor → camera → Live → previous hour → event; HA entity → approved safe action) and AT070 on the real
  equipment are `NOT_RUN`. The card stays open; this run is evidence for its disconnect / safety part only.
- **WisKey away longer than the re-probe window** (S04 b): concluded "not installed" and re-probed every `RETRY_ABSENT_S` = 300 s in
  production — automatic, but up to five minutes after WisKey is back. Unchanged (an owner-reviewed design, B1); listed for the owner.
- **Revoked token**: needs a person (an add-on restart for a fresh Supervisor token, or the owner's new token). The add-on retries
  `auth` every ≤ 60 s meanwhile; if Home Assistant's IP ban (`login_attempts_threshold`) is on, those failures could count toward it.
  Not changed here; listed for the owner.
- **Tile `unknown`** (D1): the record stays `unknown` even if Home Assistant later reports the lock unlocked (`ha_actions.refresh`
  advances only `pending` rows) — the conservative reading.
- **Simulations, not the real thing**: the remote tunnel is Cloudflare's; the run proves the Arx side (the same handler chain on both
  channels) through the local channel. The full disk is simulated at the SQLite statement level (`SQLITE_FULL`); file writes that hit
  `ENOSPC` (plans, exports, backups) are not covered. The restart is an exception at the crash line plus a new app on the same
  database, not a SIGKILL; durability of the committed rows is SQLite's (`synchronous=FULL`).
- **UI**: one frontend source line (D3) and its unit test; the add-on UI is not rebuilt here (the release train rebuilds it). No layout
  change, so no screenshots.

## 7. Rollback

Revert the branch's commits. The fixes are independent of each other and of the schema (no migration). Reverting D1 brings back the
`failed` / retryable answer for a cut bridge call.
