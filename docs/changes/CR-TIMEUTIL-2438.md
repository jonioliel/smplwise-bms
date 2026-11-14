# CR-TIMEUTIL-2438 - one home for the UTC ISO text and the installation's time zone

Code review 2026-11-13, MASTER_PLAN section 3.3 row `CR-TIMEUTIL-2436` (findings 04:F14, 04:F15; D6 and D7 outside
tickets). Branch `pilot/CR-TIMEUTIL-2438`, based on `origin/pilot/CR-WAVE1B-COMBINED-2436` (`ffb4af2d5`), because the
row follows `CR-SETTINGS-STORE` (contained there). Backend only; no UI, no pixels, no API, no schema.

## What changed

`services/timeutil.py` gains:

| Name | Rule |
|---|---|
| `DEFAULT_ZONE`, `ZONE_KEY` | `"Asia/Jerusalem"`, `"time.zone"` (= `settings_store.DEFAULTS["time.zone"]`, pinned by a test) |
| `site_zone_name(conn)` | the stored `time.zone`, the default when there is no row or it is empty / NULL (the twelve readers' rule) |
| `site_zone(conn)` | `zone(site_zone_name(conn))`: an unknown name is the default |
| `iso_or_none`, `iso_utc_ms`, `iso_from_epoch`, `iso_from_epoch_or_none` | the shapes the local copies had |

Local helpers replaced by the shared one **under the same module name** (callers and the tests that patch them do not move):

- `iso_utc` (seconds, `Z`): `access_grant_engine._iso_z`, `access_grants.iso`, `building_presence._iso`, `bulk_people._iso`,
  `calendar/model.iso`, `calendar_sync/google._iso`, `capture_lease.iso`, `door_automation.iso`, `door_windows.iso`,
  `intercom_messaging.iso`, `local_privacy._iso`, `notices/model.iso`, `partner/core.iso`, `presence.iso`,
  `scenario_model.iso`, `semantic._iso`, `transit/catalogue._iso`, `trusted_caller.iso`, `zone_counts._iso`;
  `wiskey_live_validation._iso` keeps its default instant around it.
- `iso_or_none`: `cast_sessions._iso`, `transit/poller._iso`.
- `iso_utc_ms` (milliseconds, truncated): `messaging_accounts._iso`, `wa_pacing._iso`, `intercom_calls._iso`.
- `iso_from_epoch`: `insights_common.iso`, `insights_generator._iso`, `intercom_write_journal._iso`, `shift_summary._iso`,
  `temperature_runtime._iso`; with their own `int()` / `float()` / falsy check kept: `generator_log._iso`,
  `temperature_explain._iso`, `water_runtime._iso`, `camera_sources._iso`.
- `iso_from_epoch_or_none`: `camera_image_health._iso`, `recorder_health._iso`, `energy_calibration._iso`.

Zone readers now call `site_zone` / `site_zone_name`: `energy_sampler` (3), `insights_common.site_zone` (re-exported),
`shift_summary.build`, `temperature.site_zone` (keeps its catch-all), `water_meters.tz_of` (alias),
`notices/sources.installation_tz` (keeps its catch-all), `energy_provider`, `home_screen`, `calendar/calendars`,
`setup_wizard._tz_name` (no longer reads every setting for one key), `door_automation.zone_name`,
`door_windows.installation_zone` (keeps its validity check), `intercom_messaging._zone`, `recorder_health._zone_of`;
`site_location.DEFAULT_ZONE` is imported from `timeutil`.

## Left as they are (on purpose)

- Formats that really differ: microseconds (`bridge_keys`, `wiskey_write_lineage`), no `astimezone`
  (`backup_drill`, `offbox_restore`, `wiskey_triage`), `+00:00` suffix (`wiskey_managed_install`, `wiskey_media_bridge`),
  `time.gmtime` truncation (`app_refresh.iso`: `fromtimestamp` rounds to the microsecond first, so x.9999997 s differs),
  the parsers (`automation_trace`, `media_model`, `intercom_media`, `wiskey_ops_views`, `wiskey_visits`), dates
  (`maintenance/model`), and the delegating ones already on `iso_utc` (`automations`, `schedules`, `update_runs`).
- Files held by open branches, to avoid colliding lines: `local_identity` (AUTH-REVOKE-GATE-2435, SESSION-CACHE-2438),
  `media_reach` (many 2438 branches), `nvr_write` and `recorders/frigate_events` (BACKEND-SAFETY-2435, NVR-GUARD,
  JANITOR-REGISTRY, PATH-CONFINE), `messaging_runtime` (SECRET-FILES-2438), `energy_billing` (BILL-LEDGER-B-2438), and the
  JANITOR-REGISTRY throttle modules and `main.py`. In files that CR-ADMIN-GATE-2438 also edits (`access_grant_engine`,
  `access_grants`, `bulk_people`, `door_automation`, `setup_wizard`) the import sits next to the replaced helper, not in
  the import block that branch changes.
- Routers and the remaining zone literals outside this row (`health_report`, `media_store`, routers, frontend) belong to
  `CR-SETTING-CALLERS` / `CR-I18N-*`.

## Behaviour

No text, zone or fallback changes: every replaced body is copied verbatim into `tests/test_timeutil_formats.py` and compared
with the shared helper over aware, local-zone, naive, sub-second and DST-edge inputs (spring gap 27.03.2026, autumn fold
25.10.2026 both passes) and epoch inputs including sub-microsecond rounding; the same test asserts each module now exposes
the shared function under its old name. Zone readers are compared with the old body for a stored zone, empty, NULL,
no row and an unknown name, plus an unreadable settings table for the two guarded readers. DST edges of the default zone are
pinned for `local_day_bounds` (23 h / 25 h days), `nvr_wall_to_utc` / `utc_to_nvr_wall` (gap and fold) and `compact_wall`.

## Tests actually run (workstation, Windows, Python 3.12 venv, `-p no:xdist`)

| Command | Result |
|---|---|
| `pytest -p no:xdist tests/test_timeutil_formats.py tests/test_site_location.py` | 83 passed |
| import of all 47 changed modules | ok |
| `ruff check --select F` on every changed file, compared per file with the base | no new finding (the 6 left are pre-existing) |

NOT_RUN locally (workstation saturated, per the common brief): the per-module suites of the 47 touched modules and the
full backend suite - they run in the runner entry check.

## Follow-ups

- `timeutil.zone(name)` catches only `ZoneInfoNotFoundError` / `ValueError`: a stored name that is a tzdata directory
  (`"Asia"`) raises `PermissionError` (Windows) / `IsADirectoryError` (Linux) instead of answering `DEFAULT_ZONE`, and so do
  `site_zone` and the callers without their own catch-all. Unchanged in this branch. **Lead decision (14.11): fix it in a
  small follow-up branch after `CR-TIMEUTIL-2438` and `CR-TK-TIMEUTIL-2438` merge** (also catch `OSError` -> default zone,
  plus a test with a directory-like name). Found by `tests/test_tickets_timeutil.py` on `CR-TK-TIMEUTIL-2438`.
- The tickets "zone-less = local" -> "zone-less = UTC" switch (`CR-TK-TIMEUTIL-2438`) stays BLOCKED until the read-only
  check on a lab database copy; no copy is available now.

## Rollback

Revert the branch commit; no data, schema or setting is touched.
