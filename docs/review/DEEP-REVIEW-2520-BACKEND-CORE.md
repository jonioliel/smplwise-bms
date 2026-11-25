# DEEP-REVIEW-2520-BACKEND-CORE

Deep code review for 2.52, area BACKEND-CORE (owner request 25.11). Read-only review of `origin/release/2520-train` at
`eadaa25b81c0e65c86d8aa6ff5f108816bcc7c2d`. No product code was changed; this file is the only change of the branch
`review/DEEP-2520-BACKEND-CORE`.

Area: app start-up / lifespan, the database layer and the migrations, the settings store, the Home Assistant state feed and
the push sockets, background tasks and the housekeeping pass, the notification pipeline, the scenario engine, the error
envelope and request limits, i18n of errors, backup / restore.

Earlier rounds read first: the code review of 2026-11-13 (reports 04 and 05 and its master plan), `CR-AUDIT-INDEX-2436`,
`REVIEW-2490-FIXES-2500`, `MFA-REVIEW-2520`, ADR-015 / ADR-019, `DATA_STORE_HARDENING`. Nothing below repeats a finding of
those rounds; where an old finding was checked again it is listed under "checked and fine".

Counts: critical 0, high 1, medium 4, low 6.

## Summary

| Id | Severity | Title | File:line |
|---|---|---|---|
| CORE-01 | high | A `replace` restore fails (500, nothing restored) on any installation that holds a maintenance file | `services/backup.py:759-768`, `migrations/0155_maintenance.sql:102` |
| CORE-02 | medium | The daily backup never runs on an installation that restarts more often than once in 24 hours | `services/backup.py:1079-1084` |
| CORE-03 | medium | State changes between the connect snapshot and the `state_changed` subscription are lost; nothing re-reads the states afterwards | `services/ha_sync.py:974-979` |
| CORE-04 | medium | A restore takes settings from the archive by deny-list and without validation: it can loosen security policy, and one bad value breaks `GET /settings` and all housekeeping | `services/backup.py:156-331`, `586-599`, `762-766`; `services/settings_store.py:636` |
| CORE-05 | medium | The daily and the manual backup hold the single write lock while the whole archive is compressed | `services/backup.py:561-563`, `routers/backup.py:98-101` |
| CORE-06 | low | A full `/ha/ws` queue drops state frames silently; the client cannot notice | `services/ha_sync.py:224-231`, `routers/ha.py:879-927` |
| CORE-07 | low | Attributes over 4,000 characters are stored as cut (invalid) JSON, so the entity reads with no attributes at all | `services/ha_sync.py:282-285` |
| CORE-08 | low | Notification inbox paging skips rows that share the cursor's second | `services/notify.py:525-549` |
| CORE-09 | low | Restore and upload read archive members with no size limit after decompression | `services/backup.py:739`, `823-824`, `1025-1028`, `481-485` |
| CORE-10 | low | Blocking calls on the Home Assistant feed's own event loop (database write, rule notifications, announcements) | `services/ha_sync.py:883-906`, `586-657`; `services/rules.py:219-226` |
| CORE-11 | low | `remote_token_uses` is never pruned | `services/access_tokens.py:149-157`, `services/janitors.py` (no step) |

All paths are under `smplwise_vms/backend/smplwise/`.

---

## CORE-01 (high) - a `replace` restore fails on any installation that holds a maintenance file

**Where.** `services/backup.py:759-768` (the delete loop of a `replace` restore), `services/backup.py:66-67` and `128`
(`maint_tasks` is a project table, `maint_files` is never exported), `migrations/0155_maintenance.sql:102`:

```sql
task_id      TEXT NOT NULL REFERENCES maint_tasks(id),
```

**What happens.** A `replace` restore empties every project table that the archive has (`DELETE FROM maint_tasks` among
them) before it inserts the archive's rows. `maint_files` is not a project table, so its rows stay. Its foreign key to
`maint_tasks` has no `ON DELETE` action and connections run with `foreign_keys=ON`, so the delete is refused as soon as one
`maint_files` row exists (a soft-deleted one counts too: the row stays with `deleted_at`).

**Confirmed by running it** (scratch data directory, real `Database.migrate`, `backup.create`, `backup.restore`):
one `maint_tasks` row, archive written, one `maint_files` row added, then `restore(mode="replace", scope="project")` ->
`IntegrityError: FOREIGN KEY constraint failed`.

**Failure scenario.** An installation uses the maintenance module and has uploaded one certificate PDF. The administrator
restores yesterday's archive (default mode `replace`). `sqlite3.IntegrityError` is not a `ValueError`, so
`routers/backup.py:236-239` does not turn it into `restore_refused`; the request answers 500 `internal_error`, everything is
rolled back, and the safety archive is removed. Restore is unusable on that installation until the file rows are deleted by
hand. The same applies to a restore from an off-box copy and to an archive written before the module existed only if it
carries `maint_tasks` (an archive without the table keeps the current rows, so that case passes).

The monthly restore drill does not catch it: the drill restores into a fresh scratch database, where `maint_files` is empty,
and reports PASS.

**How I looked for others.** I built the schema from all 224 migrations and listed every foreign key from a table outside
the archive lists to a table inside them. `maint_files -> maint_tasks` is the only one without an `ON DELETE` action. The
cascading ones are in the improvements section.

**Suggested fix.** Treat `maint_files` like the door history: set the rows aside before the delete and put back those whose
task still exists after the insert (`_keep_door_history` / `_put_back_door_history` are the pattern), or run the delete and
insert phase with `PRAGMA defer_foreign_keys=ON` and delete the file rows whose task did not come back. Map
`sqlite3.IntegrityError` to 409 `restore_refused` in the router so a refused restore never reads as an unknown error. Add a
restore test that runs against a populated database with one row in every non-archive table that references an archive
table, and make the drill restore onto a copy of the live database instead of an empty one.

---

## CORE-02 (medium) - the daily backup never runs on an installation that restarts more often than every 24 hours

**Where.** `services/backup.py:1079-1084`:

```python
async def daily_loop(db: Database, settings: Settings, interval_s: int = DAILY_SECONDS) -> None:
    """One automatic copy a day (the first one a day after start-up, so restarts do not pile up copies)."""
    ...
    while True:
        await asyncio.sleep(interval_s)
```

**What happens.** The loop keeps no record of the last daily backup. Every start of the process starts a new 24-hour wait.

**Failure scenario.** The host reboots every night (a common Home Assistant automation), or the add-on is updated daily, or
the crash guard restarts the server once a day. No `auto-daily` archive is ever written, no off-box copy is ever sent
(`offbox_runtime.after_backup` runs only after a daily backup, line 1091), and `backup.failed` is never raised because nothing
failed. The only signal is `backup.stale` after two days, and its "no backup at all" branch needs two days of continuous
uptime (`services/notify_sources.py:384-388`), so an installation with no archive and daily restarts is never told.
A pre-upgrade archive also counts as a backup for the staleness check, which hides the gap further after an update.

**Suggested fix.** Decide by the clock, not by uptime: at start-up and then every hour, write the daily backup when the
newest `auto-daily-*.zip` is older than 24 hours (the files' own manifests give the time; no new setting is needed). Keep
the short start-up delay so a restart loop does not write a copy per start.

---

## CORE-03 (medium) - state changes between the snapshot and the subscription are lost

**Where.** `services/ha_sync.py:974-979`:

```python
states = await call("get_states")
seen = now_iso()
await loop.run_in_executor(None, _note_connect_gap, db)
await loop.run_in_executor(None, store_states, db, states.get("result") or [], seen)
STATE.last_snapshot_at = seen
sub = await call("subscribe_events", event_type="state_changed")
```

**What happens.** The registry events are subscribed before the first listing on purpose (comment at line 970). The states
are not: the snapshot is fetched, written in chunks of 150 rows (each chunk a write transaction, retried up to three times
on a busy database), and only then is `state_changed` subscribed. A state that changes in between is in neither. Nothing
corrects it later: `get_states` is called only here (the REST `snapshot()` has no product caller), and the ten-minute
refresher re-reads registries, schedules and automations, never states. The same holds for a state update dropped by a busy
database (`handle_state_event` runs one attempt; its docstring says "corrected by the next push of that entity or the next
snapshot" - the next snapshot is the next reconnect).

**Failure scenario.** Home Assistant restarts. Arx reconnects while integrations are still loading, which is when most
entities change state. A leak sensor (or a door contact, a lock, the alarm panel) changes during the one to several seconds
the snapshot takes to store, and then stays as it is. The mirror keeps the old state for hours: the screens show it, the
`notify_sensors` scan reads the mirror and raises nothing, scenarios evaluate the old value, and `fresh` is true because the
feed is connected.

**Suggested fix.** Subscribe to `state_changed` before `get_states`, buffer the events until the snapshot is stored, then
apply the buffered events whose `last_updated` is newer than the stored row. Independently, add a periodic state
reconciliation to the refresher (a `get_states` every 10 minutes that writes only rows whose `last_updated` differs); it also
closes the busy-database loss and costs one listing.

---

## CORE-04 (medium) - a restore takes settings from the archive by deny-list and without validation

**Where.** `services/backup.py:156-327` (`SETTINGS_KEEP`, `SETTINGS_KEEP_PREFIXES`), `330-331` (`_kept_setting`),
`586-599` (`_insert_rows` writes the archive's `settings` rows as they are), `762-766` (a `replace` deletes every setting that
is not kept); `services/settings_store.py:636`:

```python
out[key] = int(value) if key in INT_KEYS else value
```

**Two problems with one cause.** The archive is unsigned and its `settings` rows are inserted raw; only the keys named in
`SETTINGS_KEEP` are protected.

1. *Security policy that is not on the list comes from the archive.* The module's own rule, repeated in some thirty comments,
   is that a restore never loosens security policy. These live settings are not kept, so a project-scope restore sets them
   to whatever the archive holds: `remote.require_mfa_admin`, `security.second_factor_policy`,
   `security.second_factor_bearer`, `remote.policy`, `remote.session`, `remote.idle_lock_minutes`,
   `security.local_password_min`, `security.local_lock_mode`, `security.local_session`,
   `security.local_admin_session_days`, `access.station_listen`, `access.station_media`, `audit.retention_days`,
   `remote.csp_enforce`. The newer factor-policy keys of the same feature are kept (lines 284-299), which makes the gap easy
   to miss. The restore answer lists what it kept for three keys and says nothing about these.
2. *A value the PATCH route would refuse is stored.* An integer key with a non-numeric value makes `read_settings` raise.

**Confirmed by running it** (scratch data directory): the installation had `remote.require_mfa_admin = true`,
`security.second_factor_bearer = enforce`, `access.station_listen = off`; an archive carrying `false` / `off` / `on` and
`events.retention_days = "thirty"` was restored with scope `project`. Result: all four values taken from the archive;
`read_settings` -> `ValueError: invalid literal for int()`; `janitors.read_values` -> the same error.

**Failure scenarios.**
- An administrator turns on "administrators need MFA from outside" this week and restores last week's archive to undo a
  plan edit. The MFA requirement, the bearer second factor and the remote policy silently return to last week's values.
  Listening through door stations returns to `on` if it was on then.
- An archive edited by hand, or damaged, carries a non-numeric integer setting. After the restore every `GET /settings`
  answers 500 (the first call of every page), `PATCH /settings` answers 500 as well because it returns `read_settings`, and
  every housekeeping pass is skipped with "janitor could not read settings" (`services/janitors.py:312-317`): no retention,
  no WAL truncation, no session sweeps, until the row is fixed in the database by hand.

**Suggested fix.** Keep by prefix for the policy families (`security.`, `remote.`, and the `access.station_*` switches) with
a short explicit list of the keys that may travel, and add a test that fails when a new `security.*` / `remote.*` default is
neither kept nor listed as restorable. Pass the archive's remaining settings through the same checks as the PATCH route (or
drop a row that fails them and count it in the answer). Make `read_settings` and `setting_value` fall back to the default
for an integer key that does not parse, as they already do for several enum keys.

---

## CORE-05 (medium) - the daily and the manual backup hold the write lock while the archive is written

**Where.** `services/backup.py:561-563`:

```python
def create_standalone(settings: Settings, db: Database, kind: str, note: str = "") -> dict[str, Any]:
    with db.connection() as conn:
        return create(settings, conn, kind, note)
```

and `routers/backup.py:98-101` (`POST /backups` on `get_conn`), `restore_safety.write` on the same connection before a
restore.

**What happens.** `db.connection()` is a write transaction (`BEGIN IMMEDIATE`, the write gate). Inside it `create` reads
every project table, then `write_zip` (lines 443-476) deflates every plan image, bake, lightmap and background picture into
the archive, optionally a copy of `energy.db` and `water.db`, and with `include_events` / `include_audit` the two largest
tables as JSON. `create` writes nothing to the database.

**Failure scenario.** An installation with a few hundred megabytes of plan files on an SD card. The daily backup holds the
single write lock for the whole compression. Past 3 s the hold is logged as slow; past 10 s every waiting writer fails with
"database is locked": Home Assistant state updates are dropped (one attempt, see CORE-03 for why that matters), NVR alerts
queue, and user actions answer 500 `database_busy`. It repeats every day at the same uptime, and on every manual backup.

**Suggested fix.** `create_standalone` on `db.connection(mode="read")`: a WAL read transaction gives the same consistent
snapshot and blocks nobody. For the route, take the snapshot on the request's connection, then write the archive inside
`db.unlocked(conn)` (or after `commit_now`), and write the audit row afterwards. `pre_upgrade` already uses a plain
connection and is not affected.

---

## CORE-06 (low) - a full `/ha/ws` queue drops frames silently

**Where.** `services/ha_sync.py:224-231` (`publish`: `put_nowait`, `except queue.Full: pass`), `routers/ha.py:879-927`.

**What happens.** Each socket has a queue of 500 frames. When it is full the frame is dropped; nothing is counted and the
socket is not told. The `sequence` the client sees is counted per socket after the drop and after the visibility filter, so
it has no gaps to detect. `/me/ws` has a 60-second summary poll as its fallback (`services/user_events.py:5-6`); `/ha/ws`
has none.

**Failure scenario.** A phone on a weak link, or a wall tablet whose tab was suspended, stops reading for 15 seconds while a
building with a busy feed pushes about 40 frames a second. On resume the socket is still open, the queue has lost frames,
and the entities whose last change was among them show the old state until they change again or the page reloads.

**Suggested fix.** Mark the queue as overflowed in `publish` and have the handler send one `resync` frame (or close the
socket with a dedicated code) so the client refetches; count the drops in `STATE` for the health page.

---

## CORE-07 (low) - attributes over 4,000 characters are stored as invalid JSON

**Where.** `services/ha_sync.py:282-285`:

```python
text = json.dumps(kept, ensure_ascii=False, default=str)
if len(text) > 4000:
    kept = {k: kept[k] for k in list(kept)[:10]}
    text = json.dumps(kept, ensure_ascii=False, default=str)[:4000]
```

**What happens.** When the first ten allowed attributes are still over the budget, the JSON text is cut at 4,000 characters.
The stored value no longer parses; every reader guards with `except ValueError: attrs = {}`, so the entity reads with no
attributes at all. The forecast and the media lists were taken out of this path for exactly this reason
(`trim_forecast`'s docstring); every other long attribute still goes through it.

**Confirmed by running it:** `trim_attributes({"friendly_name": ..., "options": [400 strings], "icon": ...}, "select")`
returns 4,000 characters that `json.loads` refuses.

**Failure scenario.** A `select` / `input_select` with a long option list (a time-zone or channel picker), a climate entity
with many presets, a siren with a long `available_tones` map, an alarm panel with many `open_sensors`: its control shows no
options, no unit and no device class, and the schedule editor offers it no values.

**Suggested fix.** Never cut the text. Drop whole attributes, largest first, until the document fits, and truncate lists
by item (the rule `_media_list` already uses).

---

## CORE-08 (low) - notification inbox paging skips rows that share the cursor's second

**Where.** `services/notify.py:525-527` and `532-549`:

```python
if before:
    where.append("n.last_at < ?")
...
next_before = out[-1]["last_at"] if len(out) >= limit else None
```

**What happens.** The cursor is `last_at` alone, compared with `<`, while the order is `last_at DESC, id DESC` and the
stamps have one-second resolution. Rows with the same `last_at` as the last row of a page are never returned by the next
page. The inner loop has the same rule for its own pages (`n.last_at < last_at`).

**Failure scenario.** A monitor pass opens several notifications in the same second (health items after a restart, a batch
of camera faults, a bulk action's results). When that second falls on a page boundary (row 50 for the client, row 100 for the
inner loop) the remaining rows of that second are missing from the inbox list. They still count in the unread badge, so the
badge and the list disagree.

**Suggested fix.** A two-part cursor (`last_at`, `id`) with
`(n.last_at < ? OR (n.last_at = ? AND n.id < ?))`; keep accepting the old one-part cursor.

---

## CORE-09 (low) - archive members are read with no size limit after decompression

**Where.** `services/backup.py:739` (`json.loads(z.read(member))` per table), `823-824` (`dst.write(src.read())` per file),
`1025-1028` (the manifest at upload), `481-485` (`read_manifest`, called for every archive by `list_backups`).

**What happens.** The upload is limited to 200 MB compressed. No member's decompressed size is checked (the energy and water
members are the exception: `energy_backup.restore_from_zip` checks `file_size`). `list_backups` opens every archive and reads
its manifest on each `GET /backups`, and the notification monitor calls it every 30 seconds (`_backup_facts`).

**Failure scenario.** An uploaded archive with a highly compressible `manifest.json` or table file (needs `backup.manage`).
The upload itself, every list of the backups and every monitor pass try to hold gigabytes in memory; the add-on is killed
by the host and the monitor repeats it every 30 seconds after each restart until the file is removed by hand.

**Suggested fix.** Check `ZipInfo.file_size` before reading: a small cap for the manifest (1 MB), a per-table cap, and a
streamed copy with a running total for files. Refuse the upload when a cap is exceeded. Cache the list entries by
(name, size, mtime) so the monitor does not open every archive twice a minute.

---

## CORE-10 (low) - blocking calls on the Home Assistant feed's event loop

**Where.** `services/ha_sync.py:883-906` (`on_event`, called synchronously by the socket reader,
`services/ha_client.py:603-609`), `586-657` (`handle_state_event`), `services/rules.py:219-226` (`deliver_pending`).

**What happens.** Every state event is handled on the feed thread's asyncio loop: a write transaction that can wait up to
10 s for the lock (acknowledged in the docstring), and after the commit `deliver_pending`, which for a rule with a Home
Assistant notify action makes a synchronous HTTP call per service, and for an announce action runs
`announcements.run_for_rule` (its own write transaction plus the speaker calls). While the loop is blocked no frame is read
and no reply is delivered.

**Failure scenario.** A rule with an announce or notify action fires while Home Assistant is slow. The loop stalls for the
call's timeout. Request threads waiting in `HaSync.ws_call` (schedules, "refresh from Home Assistant", detect-by-pressing)
time out with 503, the state feed lags by the same time, and several such rules in a burst add up.

**Suggested fix.** Keep the reader free: hand `on_state_changed` to one dedicated worker thread through a bounded queue
(order is kept with a single consumer), and move `deliver_pending` to the notifier thread that it already wakes.

---

## CORE-11 (low) - `remote_token_uses` is never pruned

**Where.** `services/access_tokens.py:149-157` (insert / update), no delete anywhere, no step in `services/janitors.py`.

**What happens.** One row per Home Assistant sign-in seen on the bearer path. A normal sign-in's refresh token is replaced at
each new sign-in, so the table grows by a row per sign-in for ever; the user's list reads 200 rows (`LIMIT 200`), the rest is
never read again.

**Suggested fix.** A janitor step: delete rows whose `last_seen_at` is older than the audit retention (or 400 days), and the
rows of users that no longer exist.

---

## Improvements (short)

- **Pre-upgrade copy covers project tables only.** `pre_upgrade` writes the same allow-listed archive as a manual backup.
  Tickets, calendars, notices, notifications, maintenance files, the audit log and the events are not in it, so a migration
  that damages one of those tables cannot be undone from it. Before a version change, also keep one consistent copy of the
  database file (`VACUUM INTO` or the SQLite backup API) for the last one or two versions.
- **A crash loop during an upgrade fills the pre-upgrade slots.** `app.version` is recorded after the migrations
  (`record_version`), so every failed start writes another `auto-pre-upgrade` archive; after five the older versions' copies
  are pruned. Write at most one pre-upgrade archive per (from, to) version pair.
- **No guard for a database newer than the code.** After a downgrade `migrate()` runs silently on a schema with higher
  version numbers. The recent migrations are additive, so it works today; log a warning and show it on the health page.
- **A `replace` restore with access scope deletes rows the module says it leaves alone.** `DELETE FROM users` cascades to
  `auth_local_sessions`, `auth_local_links` and `auth_local_reset_codes` (the comment at `backup.py:97-99` says a restore
  leaves them alone). The effect is on the safe side (local users, the acting administrator included, are signed out); the
  comment and the restore answer should say so. `DELETE FROM water_meters` also cascades to `water_alert_events` /
  `water_alert_state`, which the archive does not bring back.
- **Restore is not atomic across files and the two side databases.** Plan files are overwritten in place and `energy.db` /
  `water.db` are changed before the main transaction commits; a failure after that rolls the rows back but not the files.
  Write files to a temporary name and rename after the commit.
- **Three housekeeping steps are still unguarded** (`storage warm`, `manual recordings stop`, `checkpoint`). An unexpected
  exception in the manual-recording stop ends the pass before the WAL checkpoint, every 30 seconds. Guard the first two; the
  checkpoint can stay last.
- **Write transactions that only read.** `nvr_write.stop_expired_manual` and the `/ha/ws` scope refresh (every 60 s per
  open socket, `routers/ha.py:862-870`) open write connections for reads. Same class as 05:P1-02 of the earlier review;
  these two were not in its list.
- **The scenario engine writes on every tick.** `scenarios.step` updates `last_eval_at` and the leaf states for every
  enabled rule every tick, one fully synced transaction per rule, also when nothing changed. Write only on change, or batch
  the unchanged rules into one transaction.
- **`run_coroutine_threadsafe` results are dropped** in `ha_sync.schedules_switched_on`, `automations_switched_on` and
  `tickets_inbound_switched`. The loop holds the task weakly (the 04:F07 class); keep the future until it is done.
- **`notify.list_for` compares the `before` cursor as text.** `parse_utc` accepts an offset form that does not compare
  correctly with the stored `Z` form; normalise with `iso_utc(parse_utc(before))`.

## Checked and fine

- **Write gate and connection pool** (`db.py`): FIFO hand-over, timeout and interrupt paths of `WriteGate.acquire`, the
  stray-holder detection, `release` / `commit_now` / `unlocked` / `_relock`, lease reset before pooling (transaction,
  `query_only`, `busy_timeout`, `foreign_keys`, `synchronous`, `secure_delete`, attached and TEMP objects), invalidation on a
  schema change and on a replaced file, the schema cache's handling of uncommitted DDL. No defect found.
- **Migrations**: 224 files, numbers unique and contiguous; each runs with its version row in one transaction and rolls back
  whole on an error. 0217-0224 (the 2.50-2.52 rows) are additive and safe to run under an older build. The table-rebuild
  migrations were not replayed against old data (they have all run on the lab already).
- **Start-up and shutdown** (`main.py`, `startup_steps.py`): every shutdown step is guarded, the tasks kept in `app.state`
  are cancelled and awaited, the pool closes last; 05:P2-01, P1-07, P3-01, P3-02 of the earlier review are fixed at this
  head. The start-up steps guard themselves.
- **Error envelope** (`errors.py`, the handlers in `main.py`): one envelope for `ApiError`, validation, HTTP errors, a busy
  database, a full disk and unexpected errors; the validation payload carries no input values; the language is read off the
  event loop and falls back to Hebrew.
- **Body limits** (`body_limit.py`): the declared length is checked before a byte is read, the streamed length while
  reading, the strictest of the routed and the canonical spelling applies, the remote anonymous tier reads memory only.
- **Notification core**: `emit_full` runs in a savepoint, dedupe is serialised by the write lock, action tokens are single
  use, hashed, bound to the user and the action, and re-check visibility; the outbox is at-least-once and a failing row is
  dropped, not retried for ever; retention covers notifications, deliveries, tokens and the outbox.
- **Senders**: Web Push endpoints are allow-listed at subscribe time and again before every send, redirects are not
  followed, every send has a timeout, the queues and retry heaps are bounded, the e-mail and WhatsApp workers settle rows a
  dead process left in `retry`. Delivery language is read per recipient.
- **Quiet hours**: the weekday index is Sunday-first, a window across midnight belongs to its start day, "until morning"
  is computed in the installation's zone.
- **Scenario engine**: per-rule transactions, daily counters by local day, cooldown, caps and the kill switch, one audit row
  per suppression, the degraded state on lost author rights. It performs no device command.
- **Alert stream** (`events_ingest.py`): bounded queue with folding, bounded drain at shutdown, the zone read cached.
- **Restore, earlier findings**: 05:P1-06, P2-13 and P3-06 (paths and folder ids from an archive) are fixed at this head
  (`safe_paths`, `FOLDER_ID_TABLES`, `_unsafe_rows`).
- **Crash guard**: restarts only after a signal death, with backoff and a safe mode; a stop from outside is forwarded and
  not restarted.

Not covered in depth (time): the schedule and automation operation modules (`schedule_ops.py`, `automation_ops.py`,
`automation_ext.py`), the off-box backup targets (`backup_offbox.py`, `offbox_gdrive.py`), `mobile_push.py`, the e-mail
digest path and the calendar jobs. They were sampled for time-zone handling, timeouts and queue bounds only.

## Checks run

On the workstation, project venv, scratch data directories (removed afterwards); no lab, no runner job, no test suite:

| Check | Result |
|---|---|
| Schema built from all migrations; foreign keys from non-archive tables to archive tables listed | one blocking key (`maint_files.task_id`), seven cascading |
| `backup.create` -> add a `maint_files` row -> `backup.restore(replace, project)` | `IntegrityError: FOREIGN KEY constraint failed` (CORE-01) |
| Restore of an archive carrying looser policy settings and a non-numeric integer setting | values taken; `read_settings` and `janitors.read_values` raise `ValueError` (CORE-04) |
| `ha_sync.trim_attributes` with a 400-item `options` list | 4,000 characters of invalid JSON (CORE-07) |

Not run: the backend test suite, any timing of the backup's lock hold (CORE-05 is from the code path; the hold time depends
on the installation's plan files), any check against the lab.
