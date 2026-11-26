# LOWS-BACKEND-2550 - the open LOW backend findings of the 2.52 deep review (security, video, backend core, domain modules)

Target 2.55. Branch `pilot/LOWS-BACKEND-2550`, base `origin/release/2540-train` at `f9217db8a`.
Finding ids: `docs/review/DEEP-REVIEW-2520-INDEX.md` (rows `| <ID> | low |` with ids `SEC-`, `V-`, `CORE-`, `D-`: 21 findings) and the
per-area reviews `docs/review/DEEP-REVIEW-2520-{SECURITY,VIDEO,BACKEND-CORE,DOMAIN-MODULES}.md` (branches `origin/review/DEEP-2520-*`).
Every finding was re-read in the code at the base before the fix: all 21 were still present (no commit since 25.11 names any of them).

**No migration.** **No frontend file changed.** API changes are additive (ADR-015): the notification inbox cursor became an opaque
two-part string (the old one-part cursor is still accepted), and `/ha/ws` may now send a `structure_changed` frame with reason `resync`.
Permissions only get stricter (SEC-6), never wider.

## Summary

| ID | Severity | Outcome | Commit area |
|---|---|---|---|
| SEC-6 | low | fixed | security |
| SEC-7 | low | fixed | security |
| SEC-8 | low | **question** (owner decision named by the review) | - |
| V-06 | low | fixed (see limits) | video |
| V-07 | low | fixed | video |
| V-08 | low | fixed | video |
| V-09 | low | fixed | video |
| V-10 | low (PLAUSIBLE) | fixed (guard widened; go2rtc's own matching not re-verified) | video |
| CORE-06 | low | fixed (server side; see question 4) | core |
| CORE-07 | low | fixed | core |
| CORE-08 | low | fixed | core |
| CORE-09 | low | fixed (caps; the list cache of the review's suggestion not done) | core |
| CORE-10 | low | **question** (threading change of the HA feed - risky for a low) | - |
| CORE-11 | low | fixed | core |
| D-06 | low | fixed | domain |
| D-07 | low | fixed | domain |
| D-08 | low | fixed (back-off + audit once; no new status - question 5) | domain |
| D-09 | low | fixed | domain |
| D-10 | low | fixed | domain |
| D-11 | low (design) | **question** (product design: per-person billing scope) | - |
| D-12 | low (PLAUSIBLE) | **question** (rule change of building reach) | - |

17 fixed, 4 left as open questions (SEC-8, CORE-10, D-11, D-12), plus 2 follow-up questions on fixed items (CORE-06, D-08).

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

### SEC-8 - question 1 (not fixed)

The review names this as an owner decision; see Open questions.

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
the tiles panel, the alarm presence watch). No client change; see question 4 for the "structure updated" hint some device screens show.

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

### CORE-10 - question 2 (not fixed)

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

**Runner: NOT_RUN at the time of writing.** The touched-area job (65 test files, one process each, on the branch head) is queued as
`~/work/p2520_lowsb_run.sh` through `~/work/slotb.sh`, waiting for slot B while the 2.54 release gate runs; results will be in
`~/work/p2520_lowsb_results/summary.txt`. Not run anywhere: the full backend suite, Playwright (no frontend file changed), the lab.

## Open questions

1. **SEC-8 - off-box backup administration from the remote channel.** With step-up off (the default) a stolen remote administrator session
   can add an off-box target pointing at its own server, push the archive there, rotate the key and read it from the one-time export.
   a. Make the key export (`/backups/offbox/key`) and target create / update / test local-only, like the bridge key and the other connection
      tests; listing, push to an existing target and restore stay remote **(recommended)**.
   b. Only the key export local-only.
   c. Keep as is (rely on step-up when the owner turns it on).
2. **CORE-10 - blocking calls on the Home Assistant feed's own loop** (a database write that may wait 10 s, rule notifications and
   announcements on the reader). The fix moves state handling to a worker thread and the rule delivery to the notifier thread - a threading
   change of the most central feed, too risky for a low inside this row.
   a. Its own row in 2.56 (worker thread with a bounded queue, order kept, a soak run on the runner before merge) **(recommended)**.
   b. Only move `deliver_pending` (the HTTP calls) to the notifier thread now, the database write stays.
   c. Leave it.
3. **D-11 - billing has no per-person / per-building scope** (a home-only person with `energy.bills` sees every customer). Design limit, the
   owner approved installation-wide billing for one family.
   a. Now: a warning in the home-interface policy page when "bills" is on for a home-only person on a site with more than one customer
      (frontend row); later, when tenants are a target, an optional person -> customer binding **(recommended)**.
   b. Build the person -> customer binding now.
   c. Leave it documented only.
4. **CORE-06 follow-up - the "structure updated" hint.** After a resync the device-building and device-area screens show their "מבנה עודכן"
   hint for a few seconds (they show it on every `structure_changed`). One-line client change in the frontend lows row.
   a. The two screens skip the hint when `reason === "resync"` (frontend row) **(recommended)**.
   b. Keep the hint (a resync is rare: a client that stopped reading for a long time).
5. **D-08 follow-up - a final status for a permanently failing period.**
   a. Keep the back-off (at most daily) and the one audit row; no new status **(recommended)**.
   b. Add `failed_final` after N attempts (a migration for the CHECK constraint, the bills screen shows it, reset on account change).
6. **D-12 - mapping an unmapped area INTO a building** (`RemapGuard` checks moves out only; PLAUSIBLE).
   a. Require the route's permission at installation scope (or `system.configure`) for an area that had no building - no silent widening of
      a building-scoped editor's reach **(recommended)**.
   b. Record it as an accepted limit in `docs/changes/BUILDING-SCOPE-CONTROL-2351.md`.
