# CR-SETTING-CALLERS-2440 - one-key readers use `setting_value`; the alert listener keeps the zone for 5 s

Branch `pilot/CR-SETTING-CALLERS-2440`, from `origin/pilot/CR-WAVE2-COMBINED-2439` at 97080bbc4. Code-review master plan
(`private/code-review-2026-11-13/MASTER_PLAN.md`) section 3.3, wave 2, theme T8, row `pilot/CR-SETTING-CALLERS-2436`
(finding 05:P1-03, the call sites). No version bump, no migration, no frontend change, no pixel change. No setting value and
no default changes.

## What and why

`read_settings()` reads 261 keys and parses about 45 JSON values (5.0 ms in the review's measurement) and was used as a getter
for one key. `settings_store.setting_value(conn, key)` (landed by CR-SETTINGS-STORE-2436) answers one plain key with one
`SELECT` and the same value and type (`tests/test_setting_value_parity.py`: every plain key, stored / missing / empty).

1. **42 call sites in 31 modules** of the shape `read_settings(conn)["key"]` or `read_settings(conn).get("key"[, fallback])`
   now call `setting_value(conn, "key")`. The edit was scripted over the syntax tree: only a call of the settings store's
   `read_settings` (resolved through the module's import, also under an alias), only a constant key that is in `DEFAULTS` and
   not in `NORMALISED_KEYS`. 24 of the sites read `time.zone`.
2. **Imports**: a module that no longer calls `read_settings` imports `setting_value` instead; a module that still reads
   several keys from one `read_settings()` keeps that import and gains the second one. Both come from
   `services/settings_store` directly, so the 11 converted service modules no longer import a router for a setting
   (`services/storage.py` did it at module level). The import stays where it was (module level or inside the function).
3. **The alert listener** (`services/events_ingest.py`): `AlertStreamListener._zone()` asks `tz_getter` at most once per
   `ZONE_CACHE_S` (5 s) instead of once per alert; the getter opens a database connection (`main._tz` / `_tz_of`). A replaced
   getter (a new `start()`, a test) is asked at once (the cache is tied to the getter object); a failing getter raises as
   before and nothing is kept.

## Behaviour

- Values: identical. `read_settings` answers every `DEFAULTS` key, so the fallback of the four `.get(key, fallback)` sites
  (`history.ha_secondary` twice, `playback.max_seeks_per_min`, `playback.cross_recorder_sync`) could never be used; the new
  test asserts it for every converted key with nothing stored and with an empty value stored.
- One difference by design (the row: "zone cached a few seconds for the alert listener"): a time zone saved in the settings
  reaches the NVR alert listener within 5 seconds instead of at the next alert. Nothing else reads through that cache.
- A side effect worth knowing: a corrupt stored value of another integer key (`int()` failing inside `read_settings`) no longer
  breaks a route that only wanted its own key.

## Resolved file list (the row asks for it; CR-ROUTER-COMMON-TAIL reads it)

Routers (20): `access_control`, `anchors`, `cameras`, `cases`, `device_cameras`, `events`, `frames`, `frigate`, `health`,
`home_family`, `media`, `notifications`, `nvr_write`, `playback`, `playback_groups`, `recordings`, `remote`, `rules`, `search`,
`water_billing`.

Services (12): `announcements`, `app_refresh`, `events_ingest` (the zone cache only), `home_family`, `intercom_calls`,
`notify_channels`, `notify_email`, `notify_whatsapp`, `push`, `rules`, `storage`, `thumbnails`.

New: `smplwise_vms/backend/tests/test_setting_callers_2440.py`, this note.

Keys read by the converted sites: `time.zone` (24), `snapshots.max_age_s` (3), `history.ha_secondary` (2), `playback.lease_s`
(2), `schedules.enabled` (2), `cases.import_max_mb`, `storage.min_free_mb`, `remote.max_live_streams`,
`media.max_live_sessions`, `playback.max_seeks_per_min`, `playback.cross_recorder_sync`, `remote.policy`,
`ui.global_search`, `ui.global_search_roles`.

## Left on purpose

- **Files other rows hold** (the row: "except `main.py` and any file listed by TIMEUTIL, PATH-CONFINE, ADMIN-GATE or TK-*"):
  `routers/energy_billing.py` (PATH-CONFINE; one `time.zone` read) and `services/access_grants.py` (ADMIN-GATE; one
  `time.zone` read). Both are pinned in the guard test's `WAITING` list, which may only shrink; the closing chain (3B)
  converts them. `main.py` was already converted by CR-JANITOR-REGISTRY-2438.
- **Several keys from one read** (`s = read_settings(conn)` and then `s["a"]`, `s["b"]`): about 40 places, for example
  `routers/playback.py`, `routers/media.py`, `routers/exports.py`, `routers/skins.py`. One full read is cheaper than several
  single reads only up to a point, and each place needs its own look; not in this row ("for one plain key").
- **Other modules' own `read_settings`** (`calendar.model`, `energy_billing`, `incidents`, `intercom_messaging`, ...): a
  different function over a different document; not this finding.
- **Normalised keys** keep `read_settings` (`setting_value` refuses them); no converted site read one.

## Outside my rows

None. Files of this row that later 3A rows also name (one line each here, no shared line expected): `routers/cameras.py`,
`routers/health.py` (CR-HEALTH-POLLERS), `routers/frigate.py` (CR-DEVICE-REUSE), `routers/media.py`, `routers/playback.py`
(CR-LIVE-SOCKET-CAPS), `routers/access_control.py` (CR-SPLIT-ACCESS-CONTROL), `services/app_refresh.py`
(CR-EXPORTS-HOUSEKEEPING), `services/notify_email.py`, `services/notify_whatsapp.py`, `services/push.py` (CR-SENDER-WORKER).

## Tests

New `tests/test_setting_callers_2440.py` (7 tests):
- no module outside `WAITING` reads every setting for one plain key (syntax tree over `smplwise/**/*.py`), and `WAITING`
  names exactly the sites that remain;
- the guard recognises the subscript, the `.get`, an alias, and leaves a normalised key and a several-keys read alone;
- every converted key is plain and `setting_value` equals `read_settings()[key]` and `.get(key, fallback)` (missing, empty);
- the zone: once per window, re-read after the window, a replaced getter at once, a failing getter raises and keeps nothing,
  and four alerts through the real store path are stored at the device's instant with one zone read.

Runs (local Windows, `C:\cloude\smplwisebms\.venv`, Python 3.12, `-p no:xdist`, from the worktree; the workstation had
0.4-1.1 GB of free memory and other agents running):

| Run | Result |
|---|---|
| `ruff check` (rule F) on the 32 changed files, before and after | the same 15 findings before and after (none new) |
| `tests/test_setting_callers_2440.py` | 7 passed |
| 15 files in one run: `test_setting_value_parity`, `test_events`, `test_backpressure`, `test_cases`, `test_frames`, `test_recordings`, `test_nvr_write`, `test_search`, `test_rules`, `test_storage`, `test_thumbnails`, `test_playback_sync`, `test_health_summary`, `test_router_common_helpers`, `test_ingest_lock_bound` | 72 passed, 1 failed |
| the one failure, `test_ingest_lock_bound.py::test_backlog_is_written_alert_by_alert_and_other_writers_get_the_lock_between`, rerun with its file | failed again (5 passed, 1 failed): "one alert's transaction took 1.491 s" against a 1.0 s bound (3.102 s in the first run) |
| the same test on the base (97080bbc4, a second worktree without this change), same hour | **failed the same way**: 1.722 s against 1.0 s |

The failing test is a timing bound on one alert's write transaction; on this workstation at that hour (CPU at 100 %, 0.35 GB
of free memory) every alert took 0.3-0.8 s, on the base as well. It is recorded as a load failure that the base shares, not
as a pass: the runner entry check must show it green.

NOT_RUN locally (left to the lead's combined entry check): the full backend suite; the suites of the other converted routers
and services (`test_media*`, `test_playback_*` other than `test_playback_sync`, `test_push*`, `test_announce*`,
`test_frigate_api`, `test_water_billing_s3`, `test_notify*`, `test_remote*`, `test_home_family*`, `test_anchors*`,
`test_intercom_calls*`, `test_app_refresh*`, `test_access_control*`). No runner, pixel, device or lab action was taken.
