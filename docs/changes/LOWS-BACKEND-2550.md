# LOWS-BACKEND-2550 - the open LOW backend findings of the 2.52 deep review (security, video, backend core, domain modules)

Target 2.55. Branch `pilot/LOWS-BACKEND-2550`, base `origin/release/2540-train` at `f9217db8a`.
Finding ids: `docs/review/DEEP-REVIEW-2520-INDEX.md` (rows `| <ID> | low |` with ids `SEC-`, `V-`, `CORE-`, `D-`: 21 findings) and the
per-area reviews `docs/review/DEEP-REVIEW-2520-{SECURITY,VIDEO,BACKEND-CORE,DOMAIN-MODULES}.md` (branches `origin/review/DEEP-2520-*`).
Every finding was re-read in the code at the base before the fix: all 21 were still present (no commit since 25.11 names any of them).

**No migration.** Frontend: one small change in three device-screen files (CORE-06 follow-up, owner Q4a; see below). API changes are additive (ADR-015): the notification inbox cursor became an opaque
two-part string (the old one-part cursor is still accepted), and `/ha/ws` may now send a `structure_changed` frame with reason `resync`.
Permissions only get stricter (SEC-6, SEC-8, D-12), never wider.

## Summary

| ID | Severity | Outcome | Commit area |
|---|---|---|---|
| SEC-6 | low | fixed | security |
| SEC-7 | low | fixed | security |
| SEC-8 | low | fixed (owner Q1a, after the first report) | security |
| V-06 | low | fixed (see limits) | video |
| V-07 | low | fixed | video |
| V-08 | low | fixed | video |
| V-09 | low | fixed | video |
| V-10 | low (PLAUSIBLE) | fixed (guard widened; go2rtc's own matching not re-verified) | video |
| CORE-06 | low | fixed (server side + the follow-up Q4a in the device screens) | core |
| CORE-07 | low | fixed | core |
| CORE-08 | low | fixed | core |
| CORE-09 | low | fixed (caps; the list cache of the review's suggestion not done) | core |
| CORE-10 | low | **open**: owner Q2a - deferred to a 2.56 row | - |
| CORE-11 | low | fixed | core |
| D-06 | low | fixed | domain |
| D-07 | low | fixed | domain |
| D-08 | low | fixed (back-off + audit once; no new status - question 5) | domain |
| D-09 | low | fixed | domain |
| D-10 | low | fixed | domain |
| D-11 | low (design) | **open**: owner Q3a - the warning goes to a later frontend row; the binding later | - |
| D-12 | low (PLAUSIBLE) | fixed (owner Q6a, after the first report) | security |

19 fixed, 2 deferred by the owner (CORE-10 -> a 2.56 row, D-11 -> a later frontend row). The owner answered every question with the
recommendation (owner rule: unanswered = the recommendation): Q1a and Q6a and Q4a were built in this row after the first report, Q5a keeps
D-08 as built.

## Security

### SEC-6 - WebSockets now pass the home-interface gate

`routers/media._principal_for_ws._touch` (every socket of the product resolves its caller there) now runs `home_interface.enforce` with the
socket's path and `GET`, exactly as `auth.shared_steps` does for every HTTP request. A refusal goes through `_refuse_socket` (one error frame,
close 4403), like `presence_required`. Effect: a home-only person whose "log" category is off is refused `/events/ws` (`home_module_off`), and
a socket outside the home interface (`/wall/ws`) is refused `home_interface_only`. Everybody who is not home-only is not judged (one primary-key
read, as on HTTP).

The home interface's own sockets stay allowed. All but two were already covered by the HTTP allow-list (`/me/`, `/ha/ws`, `/intercom/ws`,
`/media/`, `/playback/sessions/`, `/access-control/stations/`, `/events/` read-only). The door call's talk and listen sockets
(`/access-control/talk/{id}/ws`, `/access-control/listen/{id}/ws` - `sw-home-call` answers a ringing door from the home interface) were not,
so they are added as two whole-route patterns (only the `/ws` leaf, never the sessions' other routes).

### SEC-7 - the Arx-only sign-in's account ceiling counts concurrent failures

`services/local_identity.sign_in`: the failure count is incremented in the database - one `UPDATE ... SET failed_count = CASE <same window>
THEN failed_count + 1 ELSE 1 END ... RETURNING failed_count` inside the write transaction - and the lock (`delay_until`) is decided on the
returned count. Before: the count read before the password hash (on a read connection) + 1 was written back, so failures that overlapped
inside the hashing time were booked as one.

### SEC-8 - off-box administration is local-only (owner Q1a)

`routers/backup_offbox.py`: target create (`POST /backups/offbox/targets`), update (`PUT .../targets/{id}`), the connection test
(`POST .../targets/{id}/test`) and the one-time key export (`POST /backups/offbox/key/export`) call `_local_only` right after the
permission check: on the remote channel (`remote_channel.is_remote`, the check the factor reset's "local only" setting uses) they answer
403 `offbox_local_only` (Hebrew text + its English entry in `error_text_en.json`) and write a denied audit row with reason `local_only`.
Listing, enable / disable, delete, a push to an existing target, the key rotation / import and the restore stay as they were. A route
refused here never reaches the store, the network or the key file.

### D-12 - mapping an unmapped area into a building (owner Q6a)

`services/building_scope.RemapGuard.check`: besides the round-14 rule (an area leaving its building needs that building's edit), an area that
resolved to NO building before the write and resolves to one after it needs the route's permission at installation scope; otherwise the
writes are rolled back and `require` raises its audited 403 (`resource_type = installation`). Only while the mapping counts for reach (the
guard does nothing otherwise, as before).

## Video

### V-06 - a disabled camera

- `services/autosync.ensure_streams`: the streams of a camera row with `enabled = 0` (`smplwise_<recorder>_ch<n>_{sub,main}` and their
  `_h264` variants) join the exact-name delete list, unless an enabled camera row names the same stream. Only our namespace is ever deleted
  (the existing `startswith(STREAM_PREFIX)` check), foreign streams are untouched. Enabling the camera again re-creates them at the next sync.
- `services/leases.CameraLease.allowed_now`: a camera row with `enabled = 0` fails the lease, so an open live / playback relay of that camera
  ends at its next re-check (`access_lost`). An id that is not a camera row (a Home Assistant camera entity) is judged by the permission alone.
- Limits: the streams leave at the next stream sync (every 10 minutes, or the manual "sync"), not at the moment of the PATCH; the lease is
  re-checked at most every 20 s (`RECHECK_S`). A cast of the camera is not stopped directly - it loses its source when the stream is removed.

### V-07 - motion capability cache

`services/nvr_write.motion_capabilities`: the cache key is `(settings.nvr_recorder_id, channel)`; only a 200 answer is stored - a failed read
answers the defaults for that call only and the next call asks the device again.

### V-08 - playback terminal states

`services/playback.TERMINAL_STATES = {closed, expired, failed, revoked}` is used everywhere the triplet was written out (`active()`,
`_settle_after_stream`, seek, `expire_idle`, `to_dict`, the socket route, the seek route, playback groups, the recorder stop). A revoked
session no longer holds a `playback.max_sessions` slot or shows a media handle. The socket's first-byte handler is now
`playback.mark_first_media`: it stamps the first media time once and sets `playing` only from `creating / buffering / seeking`, so a late
byte after a close never revives the session.

### V-09 - snapshot cache

`routers/cameras.snapshot`: the stale -> fetch step runs under a per-camera lock (`_snapshot_lock`); a request that waited finds the fresh
file and serves it, or - when the fetch it waited for was refused - takes that refusal (and the stale copy, as before) instead of asking the
recorder again. The new picture is written to a temporary name and `os.replace`d over the old file (`_write_atomic`). The fetch itself moved
unchanged into `_fetch_snapshot`. The two new module tables are registered with `test_reset`.

### V-10 - foreign-stream alias guard (PLAUSIBLE)

`services/go2rtc.names_foreign_stream` compares the whole path and every prefix of it that ends at a `/` (raw, decoded twice, normalised),
not only the first segment. A source like `rtsp://<go2rtc>:8554/door/front` is now refused when a foreign stream is named `door/front`.
The review's premise (go2rtc matches the whole path) was not re-verified against the deployed go2rtc version (no lab in this row); the
change only refuses more, so it is safe either way.

## Backend core

### CORE-06 - a full `/ha/ws` queue

`services/ha_sync.publish` marks a full subscriber queue (`overflowed`) and counts the dropped frame (`STATE.dropped_frames`, not part of
the heartbeat document). The `/ha/ws` handler checks the mark before each read (`ha_sync.take_overflow`): it discards the queued frames
(they are older than the refetch the client is about to make) and sends one `structure_changed` frame with `reason: "resync"`. Every
screen that keeps state from this socket already refetches on `structure_changed` (home, the device screens, the entity explorer, the alarm,
the tiles panel, the alarm presence watch). Follow-up (owner Q4a): the device-building and device-area screens skip their "מבנה עודכן"
hint for `reason === "resync"` (still refetching) - `frontend/src/screens/devices-shared.ts` passes the push's reason to the `structure`
handler, `devices-building.ts` and `devices-area.ts` check it (one line each).

### CORE-07 - attributes over the budget

`services/ha_sync.trim_attributes` no longer cuts the JSON text. `_fit_attributes` shortens the largest attribute first - a list loses its
tail (halved, whole items only), anything else is dropped whole - until the document fits `ATTR_BUDGET` (4,000). The small attributes (name,
unit, device class, icon) stay; the stored value always parses.

### CORE-08 - inbox paging

`services/notify.list_for`: the cursor is `(last_at, id)` - the order's own two keys - written `"<last_at>|<id>"`, compared as
`(n.last_at < ? OR (n.last_at = ? AND n.id < ?))`; the inner pages use the same rule. A one-part cursor (a client from before) keeps its old
meaning. `GET /notifications?before=` accepts up to 120 characters and validates the time part.

### CORE-09 - archive members

`services/backup`: `read_member_capped` refuses a member whose declared or real decompressed size is over its cap - the manifest (1 MB,
`read_manifest`, `save_upload`) and every table member (256 MB, `restore`); `check_member_sizes` checks every member (manifest, `data/`,
`files/` at 512 MB) at upload and before a restore deletes anything. File members are copied streamed (`shutil.copyfileobj`), never read
whole. Not done: caching the list entries by (name, size, mtime) - the capped manifest read makes it a performance question only.

### CORE-10 - deferred (owner Q2a: its own row in 2.56)

### CORE-11 - `remote_token_uses` pruned

`services/access_tokens.prune_uses` deletes rows not seen for 400 days (`TOKEN_USES_KEEP_DAYS`) and the rows of deleted users; a database
before 0219 has nothing to prune. New janitor step `remote token uses prune` right after `audit prune` (the golden step list in
`tests/test_janitor.py` updated).

## Domain modules

### D-06 / D-07 - water bills in the shared VAT table and customer card

`services/energy_billing`: `delete_vat` also refuses (409 `tariff_in_use`) a rate named by a numbered water bill's lines
(`_water_vat_used`), and `update_customer` keeps the customer number when the customer has a numbered water bill
(`_has_numbered_water_bills`, 409 `customer_number_locked`). Both read `water_bills` guarded for a database without the table.

### D-08 - failing automatic periods

`services/bill_ledger`: after the n-th failure in a row an (account, period) waits `failure_retry(retry, n)` - the configured 6 h, doubled
per failure, at most a day (`AUTO_RETRY_CAP`; a longer configured wait is never shortened) - and `bill.auto_failed` is audited only when the
failure is new or its error code changed. Before: every 6 h for ever, one audit row each. The review's `failed_final` status was not added:
the status column has a CHECK constraint (a migration) and the bills screen would need it (question 5). The golden SQL trace of the
automatic pass (`tests/fixtures/bill_ledger_b_sql_golden.json`) was regenerated on purpose: the run-row read now also selects
`attempts, error_code` (the only difference).

### D-09 - orphaned generator alerts

`services/generator_alerts.evaluate`: an open state alert whose type is no longer available (its sensor role was unmapped) is cleared, and
the open alerts of a removed generator are closed (`_clear_any`; the notification is resolved when the alert type is known). Event alerts
are untouched.

### D-10 - a feed that never succeeded

`services/notices/sources.NewsCache._refresh`: a failure without cached titles stores `(now, [])`, so the TTL applies to it like to any
failing feed (one fetch per TTL instead of one per board poll). The health line is unchanged.

## Files

- `smplwise_vms/backend/smplwise/routers/media.py`, `services/home_interface.py` (SEC-6)
- `smplwise_vms/backend/smplwise/services/local_identity.py` (SEC-7)
- `smplwise_vms/backend/smplwise/routers/backup_offbox.py`, `smplwise/error_text_en.json` (SEC-8); `services/building_scope.py` (D-12)
- `frontend/src/screens/devices-shared.ts`, `devices-building.ts`, `devices-area.ts` (CORE-06 follow-up Q4a)
- `smplwise_vms/backend/smplwise/services/autosync.py`, `services/leases.py` (V-06); `services/nvr_write.py` (V-07);
  `services/playback.py`, `services/playback_groups.py`, `services/recorder_live.py`, `routers/playback.py`, `routers/playback_groups.py`
  (V-08); `routers/cameras.py` (V-09); `services/go2rtc.py` (V-10)
- `smplwise_vms/backend/smplwise/services/ha_sync.py`, `routers/ha.py` (CORE-06, CORE-07); `services/notify.py`, `routers/notifications.py`,
  `wire/notifications.py` (docstring only) (CORE-08); `services/backup.py` (CORE-09); `services/access_tokens.py`, `services/janitors.py`
  (CORE-11)
- `smplwise_vms/backend/smplwise/services/energy_billing.py` (D-06, D-07); `services/bill_ledger.py` (D-08);
  `services/generator_alerts.py` (D-09); `services/notices/sources.py` (D-10)
- Tests: `tests/test_lows_backend_2550_{security,video,core,domain}.py` (new); `tests/test_janitor.py` (golden step list);
  `tests/fixtures/bill_ledger_b_sql_golden.json` (regenerated, see D-08)

Overlap with other open rows: `services/ha_sync.py` is also changed by `pilot/HA-STATE-RECONCILE-2550` (other hunks: lines 12, 794+, 839+,
931+, 1097+, 1142+ of the base; this row changes `SyncState.__init__`, `publish` and `trim_attributes`, lines 113-300) - expected to merge
cleanly. `services/backup.py` is also changed by `pilot/LEGACY-MIGRATION-2550` (one line, `KEEP`) - no overlap.

## Tests

All runs on the PC, one pytest process per file (`C:\cloude\smplwisebms\.venv\Scripts\python.exe -m pytest -p no:cacheprovider -rf tests/<file>`,
from `smplwise_vms/backend`), fakes only.

**Before (fails on the base).** The four new files were run with this row's source changes reversed (`git apply -R` of the source diff
against `f9217db8a`, the tests kept, then re-applied):

| File | Result on the base | Notes |
|---|---|---|
| `test_lows_backend_2550_security.py` | 3 failed, 2 passed | the 2 passing are guards (a person who is not home-only; a new window) |
| `test_lows_backend_2550_video.py` | 6 failed | every test |
| `test_lows_backend_2550_core.py` | 8 failed, 1 passed | the passing one is a guard (a document inside the budget is unchanged) |
| `test_lows_backend_2550_domain.py` | 7 failed, 1 passed | the passing one is a guard (an unused VAT rate is still deleted) |

**After (the branch), exit 0 for every file:**

| File | Passed |
|---|---|
| `test_lows_backend_2550_security.py` | 5 |
| `test_lows_backend_2550_video.py` | 6 |
| `test_lows_backend_2550_core.py` | 9 |
| `test_lows_backend_2550_domain.py` | 8 |
| `test_janitor.py` | 12 |
| `test_singletons_registered.py` | 4 |
| `test_xsecfollow_297.py` | 24 |
| `test_home_v3_followup_a.py` | 8 |
| `test_go2rtc_owned_streams.py` | 21 |
| `test_nvr_write.py` | 5 |
| `test_bill_ledger_lifecycle_b.py` (against the regenerated golden file) | 25 |
| `test_notices_106.py` | 43 |
| `test_notice_news_feeds_2500.py` | 24 |
| `test_data_rules_generator_2540.py` | 9 |
| `test_playback_cap.py` | 3 |
| `test_media_sync.py` | 14 |
| `test_notify_core.py` | 27 |
| `test_backup.py` | 8 |
| `test_local_identity.py` | 41 |

19 files, 296 passed, 0 failed. `ruff check` on every changed Python file: clean (ruff 0.17.5).

**After the owner's answers (SEC-8, D-12, CORE-06 follow-up).** Before: `-k "sec8 or d12"` on the two source files reversed - 2 failed.
Re-run on the PC of 24 files (the 19 above, plus `test_i18n_errors_en_2520.py` 9, `test_building_reach_round14.py` 8,
`test_offbox_api.py` 9, `test_backup_offbox.py` 25, `test_mfa_reset_hardening_2510.py` 22; the security file now has 7): 371 passed,
0 failed, exit 0 for every file.

**Runner (Linux, `~/work/p2520_lowsb_run.sh` through `~/work/slotb.sh`, branch head `d65bbfd93`, one pytest process per file).**
74 backend test files of the touched areas (every file named above plus the cameras, playback, multi-recorder, camera sources, devices,
building scope / reach, home interface, notify, backup / off-box, billing, water, generator, notices, i18n and MFA files): exit 0 for
all 74, 1,252 passed, 0 failed. Frontend: `tsc --noEmit -p tsconfig.json` exit 0, `tsc --noEmit -p tsconfig.tests.json` exit 0, and
`playwright test -c playwright.unit.config.ts` of `unit-g1-home-area-2440`, `unit-home-reload-2436`, `unit-fe-nits-2442`: 49 passed.
Not run anywhere: the full backend suite, the full frontend unit / Playwright suites and pixel baselines (the screen change hides a
badge in one rare case only - no layout change), the lab.

## Owner decisions (answers to the first report's questions, all = the recommendation)

1. SEC-8 -> a: built (above).
2. CORE-10 -> a: its own row in 2.56 (a worker thread with a bounded queue, order kept, a soak run before merge). Not built here.
3. D-11 -> a: the warning in the home-interface policy page belongs to a later frontend row; the person -> customer binding when tenants
   are a target. Not built here.
4. CORE-06 follow-up -> a: built (the hint skipped for `resync`).
5. D-08 follow-up -> a: kept as built (back-off, one audit row; no new status).
6. D-12 -> a: built (above).
