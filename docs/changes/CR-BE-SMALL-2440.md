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

## Tests actually run

TBD

## NOT_RUN

TBD

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
