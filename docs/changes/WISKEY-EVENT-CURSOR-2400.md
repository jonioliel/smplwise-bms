# WISKEY-EVENT-CURSOR-2400 - gap-free WisKey door events across restarts (plan T15)

Branch `pilot/WISKEY-EVENT-CURSOR-2400`, cut from `origin/release/2382-train` @ `9d5b2963b` (it already holds WISKEY-PAIRING-2382 and
its "מצב WisKey" rows). Target release: 2.40.0. Not merged, no tag, no version bump. Fakes only: no lab, WisKey, station, Home
Assistant or go2rtc contact. No device write.

## 1. What was there

- WisKey (`origin/codex/wiskey-mac-m12-policy-b-2026-11-02`, `custom_components/hikvision_intercom/event_resume.py`) offers
  `events/resume_v1`, contract `wiskey-event-cursor.v1`: pages ordered by WisKey's acceptance sequence, at-least-once, a cursor
  `"<source>.<sequence>.<hmac>"`, and explicit `reset_required` answers (`source_replaced`, `cursor_ahead`, `retention_gap`). A cursor
  WisKey cannot verify is refused with `invalid_cursor`. The command is admitted only through WisKey's bridge command host
  (`host_for(hass).admit`): a signed `wiskey-bridge-command.v1` envelope `{id, type, bridge}` with parameters exactly `{cursor, limit}`.
  Every call makes WisKey save its resume bookkeeping (`manager.store.async_save`).
- Arx had one consumer: `services/wiskey_installed_features.EventCursor`, written for the installed direct client
  (`wiskey_auto_install.InstalledWiskeyClient.events`). **Nothing called it** (`EventCursor(` and `.pull(` have no runtime caller), it
  keeps one global cursor in a setting, and it stops at every reset until someone calls `acknowledge_reset()`.
- The service feed (`services/intercom_sync.py`) never read events at all: the entry log is read live from WisKey (`events/list`)
  through the adapter, and Arx kept no door-event store. `services/wiskey_native_feed.py` signs only `overview`, `subscribe` and
  `authorization/session`.

So a door event that happened while Arx (or its socket) was down was never in Arx, and nothing said so.

## 2. The design

### 2.1 Where it runs

`services/wiskey_event_resume.py` (new). The service feed starts one pump per ready session (`intercom_sync._session.on_ready`) and
wakes it on every WisKey `refresh` push (`_on_message`). The pump is one of the session's tasks: it ends with the session. Passes:
on connect, after a `refresh` push (debounced 2 s), and every 300 s as a safety poll. A backlog (more than 50 pages) continues
immediately. A failure backs off 30, 60, 120, then 300 s. WisKey without the command (`unknown_command`) stops the pump for that
session.

### 2.2 The signed sender

`signed_sender(call, settings)`: the identity is the session's user (`auth/current_user`, as the signed metadata reads), the key is
the pairing key (`ha_bridge.signing_key`; none = `bridge_not_paired`, nothing is sent), each request is signed afresh by the existing
`BridgeSigner.command_proof`, and the frame is `hikvision_intercom/events/resume_v1` with `bridge` only. The sender can send nothing
else. The channel allow-lists (`wiskey_channels`) are NOT widened: like the W10 commands, this command leaves only as a signed
envelope, so it is on no unsigned channel.

### 2.3 Storage (migration 0201)

| Table | Holds |
|---|---|
| `wiskey_event_cursors` | one row per WisKey event source (32-hex `source`; a reinstall or a storage reset is a new source): the cursor, the last sequence, `caught_up_at`, `last_event_at`, and which row is active (a partial unique index keeps exactly one active) |
| `wiskey_door_events` | the delivered door events, primary key = WisKey's event id. Closed projection: station id, type, result, authentication, door, timestamps, time source, recovered. Never the person's name, employee number, card, major/minor. Pruned after 400 days |
| `wiskey_event_gaps` | every discontinuity: reason, `from_at` (NULL = unknown), `to_at`, old and new source, and the event-centre row that shows it |

The events and the cursor move in ONE write transaction. A crash before the commit replays the page, and the primary key drops what is
already stored. None of the tables is a backup table.

### 2.4 The cases

| Case | WisKey says | Arx does |
|---|---|---|
| Restart (Arx, WisKey or the host) | a page after the stored cursor | resumes from the stored cursor; no gap |
| Duplicate replay | a page with events Arx already stored | stores the new ones; counts the rest as duplicates |
| Cursor expired / too old | `reset_required: retention_gap` | gap from the last moment Arx was complete (`max(caught_up_at, last_event_at)`) to now; adopts WisKey's `reset_cursor` |
| WisKey history went back (restore) | `reset_required: cursor_ahead` | the same, reason `cursor_ahead` |
| Cursor WisKey cannot verify | refusal `invalid_cursor` | gap `cursor_invalid`; re-reads the same source from its beginning (the retained history is de-duplicated) |
| WisKey reset / new install | `reset_required: source_replaced` (or a page from another source: `source_mismatch`) | a source Arx knew before: resumes its own cursor, no gap. An unknown one: gap from the old source's last complete moment, then reads the new source from its beginning |
| A fresh start that WisKey cannot serve from the beginning | `retention_gap` on the NULL cursor | the gap that already covers the fresh start is extended; no second gap |
| Arx never held a cursor (first start) | any | gap `first_start` with an unknown start, then the retained history |
| Two reconnects at once | - | one pass per process (`busy` for the second); across processes the cursor moves only if it is still the one the page was read with (compare-and-set): the stale page is dropped (`superseded`), never stored over a newer cursor |

The history is never called complete across a gap. Every gap is also a `coverage_gap` row in the event centre (`events`, source
`system`, raw type `wiskey_events_gap`, camera-less, severity `alert`, `occurred_at` = gap start or the observation time, `ended_at` =
gap end, details `{origin: "wiskey_events", reason, from, to, old_source, new_source, complete: false}`), so it shows in the events log.
An owner rule on `coverage_gap` events (services/rules.py) also matches these rows: that is the rule's meaning, and nothing else is sent.

### 2.5 The status line on "מצב WisKey"

`services/wiskey_pairing.status` has one more line, `events` ("אירועי דלת אחרי הפעלה מחדש"), before "שגיאה אחרונה":

| State | Reason | When |
|---|---|---|
| warn | `events_gap` | a gap was recorded in the last 7 days: its range and its reason in plain Hebrew |
| ok | `events_ok` | the last pass: new events, filtered duplicates, "Arx מעודכן עד ..." |
| unknown | `events_not_run` | no pass since Arx started, and none kept |
| warn | `events_unsupported` | WisKey does not offer the command |
| warn | `events_failed` | the last pass failed (its code); Arx retries |
| warn | `events_off` | the pump is switched off (`SW_WISKEY_EVENT_RESUME=0`) |

The last outcome is kept in memory and in the setting `wiskey.events.resume.last` (codes, counts and instants only), written only when
it changes, so the line survives a restart. The screen renders lines generically: the only UI change is the `'events'` member of
`PairingLineKey` (`frontend/src/api/wiskey-pairing.ts`).

## 3. Shared edits (kept minimal)

- `services/intercom_sync.py`: 8 lines - keep the session's raw `call`, start the pump after the poller, wake it on a `refresh` push.
- `services/wiskey_pairing.py`: the `events` label, texts and fixes, `_events_line`, and the line in `status()`.
- `tests/conftest.py`: `SW_WISKEY_EVENT_RESUME=0` (the pump stays off in the app tests, like the other workers).
- `tests/test_wiskey_pairing_2382.py`: the expected line list gains `events`.
- `frontend/src/api/wiskey-pairing.ts`: `'events'` in `PairingLineKey`.

Not touched: `wiskey_direct_join.py`, `main.py`, `wiskey_channels.py`, `wiskey_installed_features.py` (its reader `read_page` is reused).

## 4. Migration and rollback

- Migration **0201** `0201_wiskey_event_cursor.sql`, additive. 0198 (station people), 0199 (live validation) and 0200 (two open
  branches: conflict reviews, access review decisions) are taken on other branches, so this branch alone is not contiguous
  (0197 -> 0201): `test_migrations_263_upgrade.py::test_the_release_numbers_are_contiguous_and_final` fails here until the train
  renumbers. Expected, not a defect of the change.
- Rollback: `SW_WISKEY_EVENT_RESUME=0` stops the pump. Older code ignores the three tables. Dropping them loses only Arx's door-event
  copy and its gap list. WisKey keeps its own history.

## 5. Tests

`tests/test_wiskey_event_cursor_2400.py` (22 tests, fake WisKey with WisKey's resume semantics): first start, restart mid-stream,
duplicate replay, a failed commit, the closed projection (no name / employee number / card anywhere in the database), expired cursor
(gap range + event-centre row + adopted reset point), WisKey reinstalled, a reset store that cannot serve its beginning (one gap),
switching back to a known source, `cursor_ahead`, `invalid_cursor`, two pulls in one process (`busy`), a stale concurrent puller
(`superseded`, no double store, the cursor never goes back), WisKey without the command, a refusal, an invalid page, a `refresh` push
waking the pump, the signed sender (one command, `{cursor, limit}`, no key in the frame, no send without a key or a valid identity),
the switch, the status-line states, and the last outcome surviving a restart.

## 6. Receipts

| Where | Command | Result |
|---|---|---|
| runner, `run_smart.py backend` @ `d2cd4a89b` | 17 files: the new file, pairing, adopt-2272 features + review, s5 migration upgrade, migrations, migrations-263, db template, channels, intercom, fake WisKey, intercom adapter, WisKey background, WisKey diagnostics, events, event detail, events cache | 462 passed, 2 skipped, 5 failed (below) |
| workstation, Python 3.12 venv | `pytest -o addopts= tests/test_wiskey_event_cursor_2400.py` | 22 passed |
| workstation, after the fix | `pytest -o addopts= tests/test_wiskey_pairing_2382.py` | 31 passed |
| workstation, 0201 moved aside (= the base's migration set) | the two s5 upgrade tests below | 2 failed: `[...196, 197] == [...196]` - already red on the base |
| runner, after the fix | - | NOT_RUN: runner disk at 90% (24 GB free, under the 30 GB floor); this branch's `.tmp_*` (1.9 GB) was deleted after the first run |

The 5 runner failures:

- `test_wiskey_pairing_2382.py::test_paired_and_accepted_with_all_six_commands` - the test expects EVERY line ok; the new `events`
  line was `events_off` (the pump is off in the app tests). Fixed in the follow-up commit: the test switches the pump on and sets a
  clean last pass.
- `test_migrations_263_upgrade.py::test_the_release_numbers_are_contiguous_and_final` and
  `test_wiskey_s5_migration_upgrade.py::test_s5_the_sequence_is_contiguous_unique_and_the_wiskey_files_follow_the_train` - 0201 without
  0198-0200 on this branch (section 4). Clears when the train renumbers.
- `test_wiskey_s5_migration_upgrade.py::test_s5_a_2350_database_upgrades_0191_to_0196_in_one_start` and
  `::test_s5_a_2370_train_database_runs_exactly_the_three_wiskey_files` - they expect `migrate()` to stop at 0196. The base
  (`origin/release/2382-train`) already has 0197 (intercom calls), so they fail there too (checked: with 0201 moved aside they fail with
  `[..., 196, 197]`). This branch adds 0201 to the same list.

NOT_RUN: frontend `tsc` and the pixel/evidence specs (the UI change is one union member, and the screen renders lines generically). No
lab run.

## 7. Known limits / next

- The door-event copy has no screen yet. The entry log still reads WisKey live; a gap is visible in the event centre and on "מצב WisKey".
  Showing Arx's copy (and the gaps) inside the entry log is a follow-up.
- A gap's start is Arx's last complete moment, not WisKey's first lost event: WisKey's `reset_required` carries no time range.
- `cursor_invalid` is recorded as a gap even when the re-read from the beginning then delivers everything that was missing.
- Whether WisKey admits the SERVICE session's user as the bridge principal for `events/resume_v1` is unproven in the lab. A refusal
  shows as `events_failed` with WisKey's code. Lab check: open "מצב WisKey" after a restart and read the `events` line.
- The installed-client consumer (`EventCursor`) is left as it is (still uncalled). Retiring it or moving it onto this module is a
  follow-up.
