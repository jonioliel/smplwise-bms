# CR-BE-SMALL-2440 - three small backend rows for 2.44.0

Branch `pilot/CR-BE-SMALL-2440`, based on `origin/pilot/CR-W3B-BE-COMBINED-2443` (95e72d09e) merged with
`origin/release/2438-train` (d40eaf5d7). Backend only; no frontend file is touched, no pixel changes.

## 1. T033 redacted log export (R066 / AT066)

Acceptance 2 of T033 ("export logs מצונזר עם correlation ID והמלצה לבדיקה בלי tokens, RTSP credentials או frames פרטיים"),
master spec chapter 30 Observability ("Diagnostic bundle מצונזר נוצר בהסכמה; אינו כולל וידאו או תוכניות כברירת מחדל").

- `services/log_export.py` (new): `LogRing`, an in-memory ring of the last 2,000 log lines of the process (each cut to 4,000
  characters), attached once to the root logger by `create_app` (`log_export.install()`, idempotent). Every line keeps the
  correlation id of the request it was written for. Process memory only: nothing on disk, a restart empties it.
- `correlation_id.CURRENT` (new context variable): `main.CorrelationId` sets it for the request and resets it afterwards; a sync
  route's worker thread sees it (Starlette copies the context into the threadpool).
- `redact()`: every string of the file goes through it - log lines, logger names, health labels and details. Rules, in order:
  embedded images (`data:image/...`), credentials inside URLs (`rtsp://user:pass@` -> `rtsp://<credentials>@`), Bearer / Basic /
  Digest values, JWTs (HA long-lived tokens), values of secret-looking keys (`password`, `token`, `access_token`, `api_key`,
  `cookie`, `session`, `signature`, `hmac`, ... and whole-word `pin`, `sid`, `sig`, `otp`), serial numbers (`serial*` / `sn` keys,
  ISAPI `<serialNumber>`, bare Hikvision-style serials of 16+ capitals and digits), MAC addresses, IPv4 (with port), IPv6, e-mail
  addresses, Israeli phone numbers, long opaque tokens (32+ characters, digit-heavy or mixed case: hex digests, urlsafe tokens).
  Ordinary text is kept: versions (`2.43.8`), times, dates, model names (`DS-7608NI-K2`), traceback paths, `session_count=3`.
- `POST /api/v1/health/logs/export` (routers/health.py): `system.configure` only; body `{consent: true, minutes 1-1440 (60),
  min_level (INFO), correlation_id (optional: one request's lines only), include_health (true)}`. Without `consent: true` ->
  422 `consent_required`; a malformed correlation id -> 422. Answers a JSON download (`Content-Disposition: attachment;
  filename="arx-logs-<UTC>.json"`, `Cache-Control: no-store`) with: format `arx.logs/1`, version, the export's own correlation id,
  the records (`at`, `level`, `logger`, `correlation_id`, `message`), the errors grouped by correlation id (top 20), the health
  checks (status, label, redacted detail), recommendations (one Hebrew sentence per check that is not ok - a table per check id
  with a generic fallback - plus one for the log's errors naming the busiest logger and the request id to quote), what was
  redacted (counts per rule, never values) and the list of what is never included. The health probes run outside the write lock
  (`unlocked`), as in `/health/report`.
- Audit `health.logs.export` (allowed) with counts only: records, minutes, level, one-request filter, health included, number of
  redactions. Never the content.

Not built here (frontend): a button in Settings -> Health ("ייצוא יומן מצונזר") that posts with consent and saves the file. See the
questions below.

## 2. correlation_id helper

`correlation_id.of(request)` is now the one place that reads `request.state.correlation_id`; `routers/_common.rid` delegates to it.
The hand-rolled `getattr(request.state, "correlation_id", None)` copies were replaced in 33 router modules (access_control_base,
_command, _credentials, _entry, _people, _schedule_writes, _station_ops, _triage, alarm, automation_ext, camera_suggest,
device_cameras, device_layouts, devices, events, exports, frigate, frigate_control, ha, intercom_calls, media, plan_area_links,
plan_view, playback, playback_groups, recorder_health, remote, second_factor, setup, storage, tickets, views, and the
`settings_patch` package: effects, identity, modules), plus `auth.shared_steps`, `services/rbac_admin._rid` and the six reads in
`main.py`'s exception handlers. `frigate_control._rq` (a private copy imported by frigate_config and frigate_f2b) was removed; the
three modules import `_common.rid`.

Behaviour unchanged: the same value reaches every audit row's `request_id`, error envelope and response header. In `main.py`
`getattr(state, "correlation_id", "")` became `of(request) or ""` - the same result, because the middleware always sets a non-empty
string. Guard: `tests/test_correlation_helper_2440.py` fails on any new `getattr(<x>.state, "correlation_id", ...)` outside
`correlation_id.py` (AST over `smplwise/`).

## 3. Tariff names in English

Time-of-use (TOU) definitions name their seasons, day types and bands in Hebrew only (`name_he`), so the English interface showed
"קיץ / פסגה" (CR-I18N-CAL-ELEC-2441 and CR-I18N-ELECTRICITY-2443 left them Hebrew as server data). Now:

- Every season / day type / band may carry an optional `name_en` (Latin text, up to 40 characters, no Hebrew letters; error code
  `name_en`). It enters the normalised definition only when given, so a definition without English names normalises and hashes
  (`definition_sha256`, sealed into bill snapshots) exactly as before.
- The Israeli template has English names - Summer / Winter / Transition, Weekdays / Fridays and holiday eves / Shabbat and
  holidays, Off-peak / Peak - and the template entry gets `name_en` "Household time of use (Israel)" and `source_en`. Words from the
  glossary (`docs/i18n/GLOSSARY_EN.md`: "time of use, band, season", "Shabbat and holidays"); the test checks them against the
  frontend msg tables wherever a table already translates the same Hebrew text.
- `energy_tou.names_en(definition)` -> `{seasons, day_types, bands}`: the saved `name_en`, else the template's English for an entry
  that still has the template's id AND Hebrew name (versions saved before this change get English names without a migration), else
  absent (the English interface shows the Hebrew name). Returned as `names_en` beside each tariff version's definition, by
  `POST /energy/tou/check`, and in a TOU bill snapshot (`tou.names_en`, only when any). A TOU bill line's `season` / `band` carry
  `name_en` when there is one. `name_he`, the Hebrew bill paper and the PDF are unchanged.
- Contract updated: `docs/architecture/ELECTRICITY_TOU.md` section 2.

The fixed-price tariff `name` (typed by the manager) and water tariff names are data and stay as typed.

## Fixes found while testing (second commit)

- The first ring kept the `LogRecord` itself; a record's `args` / `exc_info` keep the logging frames and their locals
  (connections, requests) alive while the line is held. A first runner run of the full suite on that head showed 8
  failures/errors in its first ~4 % (test_alarm, test_app_refresh_295 x2, test_access_grants, test_automations_preview,
  test_backpressure, test_bridge_key_rotation_295 x2 - setup errors and two failures); all 8 pass on the fixed head when their six
  files run together on the runner (219 passed, 0 failed). The ring now keeps the formatted text only.
- `RING` registers its per-test reset (`smplwise.test_reset`; tests/test_singletons_registered.py).
- `tests/gate_always_run.json` lists `test_correlation_helper_2440.py` (it walks the package; tests/test_gate_always_run.py).

## Tests actually run

Workstation (`.venv` Python 3.12, `-p no:xdist`):
- New files: `test_correlation_helper_2440.py` (4), `test_log_export_t033.py` (24), `test_tariff_names_en_2440.py` (6) -
  34 passed (first head); `test_log_export_t033.py` and `test_correlation_helper_2440.py` passed again on the fixed head (below).
- Existing, related: `test_energy_tou_engine.py`, `test_energy_tou_billing.py`, `test_health_report.py`,
  `test_correlation_id_sx17.py`, `test_router_common_helpers.py` - 100 passed, 2 skipped (declared).
- Touched routers: `test_frigate_config.py`, `test_frigate_control.py`, `test_frigate_f2b.py`, `test_local_auth_inventory.py`,
  `test_remote_access.py`, `test_saved_views.py`, `test_second_factor.py`, `test_settings_patch_audit_order.py`,
  `test_router_common_helpers.py` - 186 passed, 0 failed.
- Package scanners / meta (fixed head): `test_singletons_registered`, `test_active_user_rest_2438`,
  `test_async_routes_no_inline_db`, `test_db_gate`, `test_gate_always_run`, `test_setting_callers_2440`,
  `test_switch_protection_reach_guard`, `test_confirm_words_2442`, `test_adoptr6_295`, `test_bridge_common_2440`,
  `test_select_tests`, `test_gate2_select`, `test_get_routes_read_conn`, `test_log_export_t033`, `test_correlation_helper_2440` -
  965 passed, 1 failed (`test_gate_always_run` - the new scanner was not listed; fixed in the same commit, the file then
  19 passed).
- `ruff check --select F smplwise` (the backend lint rule): clean.

Runner (`~/work/besmall2440`, `nice -n 10`, 6 shards by file, `-m "not timing_lane"`):
- The six files of the first run's failures, fixed head: 219 passed, 0 failed.
- The full backend suite on the fixed head (af5b7fbdb) was started at 02:55 UTC and was still running when this note was
  written (load average ~100 from other jobs: ~2,600 tests done, 0 failed at 03:35 UTC). Result: `~/work/besmall2440-results/
  summary.txt` (per-shard last lines, every FAILED / ERROR, then `DONE`); logs `shard_0*.log` in the same folder.

## NOT_RUN

- The full backend suite to the end (running on the runner, see above).
- Frontend: nothing touched; no tsc / playwright / pixel run needed.
- No entry check (instructed: push only).
- No lab / device test: AT066 on a real installation (an export after a real NVR / go2rtc error) is NOT_RUN;
  `management/test_catalog.json` (AT066) and `management/tasks.json` (T033) were not edited - the lead records the evidence.

## Questions (owner rule: unanswered = recommendation)

1. Where does the log export start from in the interface?
   a. A button "ייצוא יומן מצונזר" in Settings -> Health, with a short consent sentence before the download. (recommended; a small
      frontend row for 2.44.x)
   b. Also from an error toast ("send this request's log"), using its correlation id.
   c. API only for now.
2. How far back does the export look by default?
   a. The last 60 minutes, INFO and above; the administrator may choose up to 24 hours. (recommended; as built)
   b. Everything the ring holds (up to 2,000 lines).
3. Should the English interface show the new English tariff names?
   a. Yes: the electricity screens show `name_en` (or `names_en[...]`) when the interface is English and fall back to `name_he`;
      the TOU editor gets an optional "English name" field. (recommended; a small frontend row)
   b. Keep Hebrew names everywhere.
