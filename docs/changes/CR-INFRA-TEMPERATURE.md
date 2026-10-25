# CR-INFRA-TEMPERATURE - temperature control under Infrastructure (2.9.1)

Status: phases 1 and 2 built on `pilot/TEMPCTL-291` (from `integ/290`); phase 3 (section 11) on `pilot/TEMPCTL3-293`. Owner-approved mockup and binding decisions:
`private/planning/mockup_temperature_2026-10-19/` (index.html, OWNER_DECISIONS.md) plus the owner requirements relayed on 2026-10-19
(optional defrost window with automatic learning; climate entities as a temperature source).

## 1. Scope

A **unit** is a fridge, freezer, cold room, medicine fridge, server room or any watched space. It has:

* ONE temperature source - a numeric temperature sensor (`sensor.*`, °C / °F, device class temperature) **or** a climate entity
  (`climate.*`: air conditioner / HVAC controller / thermostat). For a climate unit the current temperature (`current_temperature`) is the
  main value; the setpoint (`temperature`, or the middle of `target_temp_low/high`), the HVAC mode (state) and action (`hvac_action`) are
  shown and the setpoint is stored in the history next to the reading;
* an optional door sensor (`binary_sensor.*`), optionally inverted;
* a target band low..high - for a climate unit optionally "follow the setpoint": setpoint -/+ `setpoint_tolerance` (a heat_cool range:
  low - tolerance .. high + tolerance; while the setpoint is unknown the fixed band);
* rule overrides over the installation defaults, an optional own recipient list, and a defrost mode.

Read-only against the infrastructure: nothing is ever sent to a device. Operator answers carry friendly names; entity ids only for holders of
`infra.temperature.manage` (owner decision 7).

## 2. Status evaluator (services/temperature_runtime.py, every 60 s, from the state mirror)

Every number below is a SETTING with an installation default (Settings > Infrastructure > Temperatures) and a per-unit override (the wizard).

| Condition | Log row | Notification |
|---|---|---|
| reading above high / below low | one row per excursion, severity warning | `temperature.warning` from the first moment (`warn_on_excursion`) |
| ... still outside after Z min (`high_alarm_min` / `low_alarm_min`, switches `high_alarm` / `low_alarm`) | same row, severity alarm | the warning is resolved, `temperature.alarm` (critical) |
| back inside by `hysteresis` | row closed | resolved |
| door open longer than X min (`door_alarm_min`, `door_alarm`) | door row, alarm | `temperature.alarm` until closed |
| no live reading for N min (`offline_min`, `offline_warn`) | offline row, warning | `temperature.offline` |
| above the band inside a defrost window, at or below the hard maximum (`defrost_hard_margin`), `defrost_suppress` on | defrost info row | none |
| climate unit switched off (`hvac_mode` off), `alert_when_off` off | open band rows end ("off") | resolved; status `off` (grey), not an alarm |

* Alerts are ON by default (`alerts_enabled`; off = every row is still logged with `suppressed = off`, nothing is sent).
* Quiet hours (`quiet_enabled`, `quiet_from`..`quiet_to`, local time of the installation zone) hold WARNING notifications only; the row is
  logged with `suppressed = quiet` and the warning is sent when the quiet hours end if the condition still holds. Alarms are never held
  (owner decision 2) - unless an administrator turns on `quiet_includes_alarms` (default OFF).
* Mute (operators, `infra.temperature.ack`): 15 / 30 / 60 / 120 minutes or until the end of the next defrost window; it holds WARNINGS only
  and is logged with who. Alarms are never muted - unless `mute_includes_alarms` is turned on (default OFF).
* Owner 2026-10-19 (answers on phase 1): keep alerts on by default and the warnings-only holds; all three are settings with an installation
  default and a per-unit override (Settings > Infrastructure > Temperatures; wizard step 3).
* A disconnected mirror changes nothing and records nothing (status `unknown`, the last values shown grey, a banner).

## 3. Defrost

Three modes per unit (owner requirement 2026-10-19): **learn** (default when no window is entered), **fixed** (start + length, up to six
windows), **none**. The learner (services/temperature_defrost.py, hourly per unit in mode learn) reads the five-minute history of `learn_days`
(7) and finds rises of at least max(1.5°, 35 % of the band) above the median of the preceding two hours that last 10..`defrost_max_min`
minutes and fall back, ignoring rises that start while the door is open (or within 15 minutes after it closed). Episodes are clustered by
local start time (20 minutes tolerance, across midnight); a cluster seen on `learn_min_repeats` (3) different days AND on 60 % of the days
covered becomes a window (median start - 5 min, longest + 10 min). Until the history covers `learn_min_repeats` days the state is `learning`
and nothing is suppressed. Learned windows are listed as learned with confirm / reject; a rejected window is never suggested again until
the learned set is cleared. Learned and confirmed windows are excluded from out-of-range statistics (`exclude_defrost_stats`, owner decision 3)
and hold alerts above the band (`defrost_suppress`) - never above the hard maximum.

DST: every local wall-clock time (defrost windows, quiet hours, report schedules) is turned into an instant per LOCAL day of the
installation zone (`temperature.local_instant`): an ambiguous time on the fall-back night is its first occurrence, a non-existent time on
the spring-forward night is moved forward by the gap. (Gate-hygiene finding fixed: the next defrost start used to add local minutes to a
UTC base and was an hour off on a transition night.)

## 4. Permissions

| Permission | Holders | Grants |
|---|---|---|
| `devices.read` (existing) | viewer and above | the tab, the units, history and log - scoped by the unit's temperature sensor (the door part by the door sensor); invisible = uniform 404 |
| `infra.temperature.ack` (new) | operator, site_admin, system_admin | acknowledge alerts, mute warnings |
| `infra.temperature.manage` (new) | site_admin, system_admin | define / edit / delete units, defaults, learned windows; page edit mode |
| `system.configure` (existing) | system_admin | the alert routing (recipients, channels) |

The tab is hidden until the viewer sees a unit, except for a manager (that is where units are added). Adding happens only in page edit
mode, entered from the user menu (shell/screen-edit.ts), like the elevators.

## 5. Notifications and routing

Sources `temperature.alarm` (critical, push + phone app), `temperature.warning` (alert, push), `temperature.offline` (alert, inbox) - all ON,
recipients rule `temperature`: alarms to operators + site and system administrators, warnings / offline to the administrators, until changed
in Settings (system.configure) - or per unit (`recipients_json`). Channels: inbox always; push, phone app, e-mail and WhatsApp (the user's
own opted-in number through the existing notification pipeline) on request. Subject kind `temperature`: devices.read on the unit's sensor.

## 6. Storage (migration 0124_infra_temperature - built as PROVISIONAL 0125, renumbered at the 2.9.2 integration)

`infra_temp_units`, `infra_temp_settings`, `infra_temp_samples` (one per minute while live, with the setpoint and flags 1 defrost / 2 door
open / 4 climate off; 35 days), `infra_temp_samples_5m` (rollup, `retention_days` default 400), `infra_temp_doors`, `infra_temp_events` (the
alert log; closed rows pruned after the retention), `infra_temp_defrost_learned`, `infra_temp_defrost_state`, `infra_temp_alert_settings`.
Rollback: drop the tables and the `temperature.*` policy rows; nothing else reads them.

## 7. API (`/api/v1/infra/temperature`)

`GET` list (spark=1 adds the 24 h line), `GET /{id}`, `GET /{id}/history?range=24h|7d|30d|custom&from&to&points`, `GET /events`,
`GET /events.csv?lang=he|en` (UTF-8 BOM, local time + UTC, formula-safe), `POST /{id}/ack`, `POST|DELETE /{id}/mute`;
manage: `GET /manage`, `GET /candidates?kind=temp|door` (sensors and climate entities, grouped, live values), `POST`, `PUT /{id}`,
`DELETE /{id}`, `PUT /order`, `GET|PUT /settings`, `POST /{id}/defrost/{start_min}/confirm|reject`, `DELETE /{id}/defrost/learned`;
routing: `GET|PUT /alerts`.

## 8. Phase 2: the PDF report and the WhatsApp text summary

* **PDF** (`GET /report.pdf?units=&range=&from=&to=&lang=he|en&chart=&events=&signature=`, devices.read, scoped like the units, audited):
  presets 24 h / this week / 7 days / this month / 30 days / previous week / previous month and a custom range (ISO instants with a zone,
  at most 400 days), one or several units (a page per unit), Hebrew (RTL) or English, the chart (reading, setpoint step line, band, door
  and defrost bands, out-of-range in red), the statistics, the event list and a signature LINE (owner decision 4; the model keeps
  `signature = {"mode": "line"}` so an electronic signature is a future mode, not a new report). Footer: local generation time and zone,
  the UTC instant and a SHA-256 digest of the report model (`X-Report-Digest`). Rendering: the bill PDF's isolated child process and limits
  (services/temperature_pdf.py, temperature_pdf_engine.py): WeasyPrint with the bundled fonts only, fpdf2 as a plain fallback; no network.
  `GET /report/preview` returns the same model (the dialog's paper preview and the WhatsApp text are made from it).
* **WhatsApp - TEXT SUMMARY ONLY** (owner option A, services/temperature_whatsapp.py): the range and per unit min / max / average /
  out-of-range time / alerts, "the full report (PDF) is available in the system", capped at 700 characters. Recipients: system users -
  a user receives only on the number he opted in for himself (notify_whatsapp.resolve_number; no number / no consent is warned in the
  dialog, may still be chosen, and the send row ends `skipped` with the reason); the recipient must also see the units himself (else
  `no_reach`). One-off (`POST /report/send`) or scheduled (`/report/schedules`: daily / weekly / monthly at a local time). Every send
  respects the installation's WhatsApp send hours (tickets.settings `send_hours`): outside the window the row is `held` until the next
  opening. Account: the use `infra.temperature.reports` (inherits the notifications account), the shared pacing ledger, the tickets
  module's adapter. A send row stores the request, never the text or a number. Managers only (`infra.temperature.manage`).

## 9. Open items the owner asked to keep (do not forget)

1. **Document sending on WhatsApp (TODO, owner 2026-10-19).** Today the summary is text only because the transport
   (`whatsapp.send_message`) cannot carry a document. To add the PDF itself, a temporary signed download link or an attached HTML report
   later: (a) give the transport the capability (a media service of the WhatsApp integration, or a signed short-lived link route),
   (b) add the mode to `temperature_whatsapp.ATTACHMENT_MODES` and `temperature.CHOICES["report_attachment"]`, (c) return the payload from
   `temperature_whatsapp.attachment_for()` - the send pass (`process` -> `_send`) already carries it. The setting `report_attachment` (installation) is the
   switch; only `none` is accepted until then. No change to the queue, the schedules or the dialog is needed.
2. **Sending to vendors (DEFERRED, owner 2026-10-19).** External contacts are reached through the tickets message queue
   (`ticket_outbox`), whose `purpose` CHECK needs a table-rebuild migration to add a temperature-report purpose. Not built. Until it is
   approved, vendors are listed in the WhatsApp dialog DISABLED ("בקרוב") and the API refuses them (`vendor_coming_later`). The send rows
   and schedules already carry `recipient_kind` / `contact_id`, so vendors - one-off AND scheduled, chosen per recipient (owner decision 6)
   - need no schema change on the temperature side.

## 10. Known limits

* Statistics judge every sample against the CURRENT fixed band (a band edited later re-colours the past); a setpoint band uses the stored
  setpoint of each sample. Climate "off" minutes are excluded from out-of-range only where raw minutes exist (35 days).
* "No live reading" is judged from the state (unavailable / unknown / not numeric); the mirror has no `last_reported`, so a frozen but
  "valid" value is not detected (sensor health is a phase 3 item).
* The PDF engines (WeasyPrint / fpdf2) are not installed on the development workstation: the PDF route is tested with a fake renderer
  and the HTML builder directly; a real render is verified only where the engines exist (the add-on image / runner).
* Phase 3 limits: see section 11.

## 11. Phase 3: the accepted improvement ideas (pilot/TEMPCTL3-293, owner 2026-10-20)

Owner decisions (private/planning/OWNER_DECISIONS_2026-10-20_NIGHT.md): all twelve ideas of the mockup panel accepted; alerts on by default;
a mute silences warnings only, alarms are never silenced; every capability exists AND is a setting (installation default + per unit
override, Settings > Infrastructure > Temperatures and wizard step 3 "יכולות נוספות"). Storage: migration
`0125_infra_temperature_phase3.sql` (built as PROVISIONAL 0126; renumbered at the 2.9.3 integration; ALTERs on the
0125 tables + `infra_temp_insights` + `infra_temp_tickets`). Rollback: drop the two tables; the added columns are ignored by older code.

| # | Idea | Built | Settings (default) |
|---|---|---|---|
| 1 | Defrost learning | phase 1 (learn / fixed / none) | `learn_days`, `learn_min_repeats`, `defrost_max_min`, ... |
| 2 | Door <-> temperature + recovery | `services/temperature_insights.py` (hourly): per opening the baseline, peak, rise and recovery time; median > `recovery_slow_min` with >= 3 openings = "suspected cooling fault"; detail panel + card chip; optional `temperature.health` warning | `recovery_slow_min` 30, `recovery_alert` off |
| 3 | Monthly HACCP report | `layout=haccp` on `/report.pdf` and `/report/preview`: a daily table per unit (min / max / avg / out of range / alerts / door openings / data coverage / verdict), manager name + signature + date lines, UTC stamp + digest; dialog "סוג הדוח" (defaults to the previous month) | - |
| 4 | Escalation chain | an unacknowledged alarm climbs a step after `after_min` (from the moment it became an alarm): source `temperature.escalation` (critical) to the step's tier, a log row `escalate` per step; ended by the acknowledge or the end of the alarm; never held by quiet hours (only when alarms are held by an explicit setting) | chain on, 15 min -> site + system admins, 45 min -> system admins, push + app; per unit `escalation_enabled` on |
| 5 | Time to threshold | least-squares slope of the last 30 min; shown inside the band when the crossing is within the horizon (never while the door is open / in a defrost window); optional EARLY warning row `predict` (source temperature.warning, held like a warning) | `predict_enabled` on, `predict_horizon_min` 60, `predict_warn` OFF (owner 2026-10-20: keep OFF), `predict_warn_min` 20 (5..240: the early warning fires when the crossing is this many minutes away; owner 2026-10-20) |
| 6 | Compressor duty cycle | optional power sensor per unit (smart plug / current meter, READ only): `pw` per minute sample, `pw_n` / `on_n` in the rollup; 24 h %, last 3 days vs the 4 before, daily bars; "rising" by `duty_rise_pts` | `compressor_on_w` 15 W, `duty_rise_pts` 15, `duty_alert` off |
| 7 | Grouping by area / floor | units carry floor id / name / level; collapsible area headers ordered by floor level (collapsed state per browser), floor quick filter | installation `grid_grouping` area |
| 8 | Sensor health | battery (sibling battery sensor / battery-low binary sensor of the same device), signal (signal_strength dBm or linkquality), age of the reading, frozen value (identical readings for `frozen_min`); KPI "בעיות חיישן"; `battery` / `frozen` warnings (temperature.health) | `health_warn` on, `battery_low_pct` 20, `frozen_min` 360, `signal_weak_dbm` -85 |
| 9 | Maintenance window | operators+ (`infra.temperature.ack`): minutes + REQUIRED reason, logged with the name (`maint` row) and shown in the report; holds WARNINGS (`suppressed = maintenance`); alarms still go out and say "בתחזוקה: reason" (owner 2026-10-20: as built) | `maintenance_includes_alarms` OFF, `maintenance_max_min` 240 |
| 10 | Unit comparison | detail: tick up to 2 other units -> their lines over the chart, scale shared (°C) or normalized to each band (0 = low, 1 = high) | - |
| 11 | Service ticket from an alarm | `POST /{id}/ticket` (and `GET /{id}/ticket/draft`): through `tickets.create.create_ticket` AS the person (device ticket of the temperature sensor: place + frozen 24 h history), prefilled description with the values and the deep link back, the 24 h chart as a picture through the module's one picture pipeline, two-way link (`infra_temp_tickets`, the row's `ticket_id`, a `ticket` log row), a repeat while open is absorbed | installation `ticket_department_id` "", `ticket_attach_chart` on |
| 12 | Home widget | `temperature` widget (elevators' shape: combined / cards / both, hidden units, alerts only); absent without units or with `home_widget` off; personal on / size / mode / hidden like the elevators | installation `home_widget` on |

Routing: Settings > Infrastructure > Temperatures > alerts gains the `health` kind (on; site + system admins; inbox) and the escalation
chain editor (system.configure). New routes: `POST|DELETE /{id}/maintenance`, `GET /{id}/ticket/draft`, `POST /{id}/ticket`,
`GET /candidates?kind=power`; `layout` on the report routes; log kinds `predict|battery|frozen|recovery|duty|maint|escalate|ticket|health`.

Not built / deferred in phase 3:
* vendor sending through the message queue and WhatsApp document sending stay deferred (section 9, owner);
* the HACCP report is produced on demand (download) - an automatic monthly archive stored in the system is not built (it needs file storage
  and retention decisions); the WhatsApp schedule can already send the monthly text summary;
* the ticket keeps its link back as text in its description (the ticket screens do not render a dedicated "temperature" block);
* signal strength is shown, never alerted; a climate unit's reading is never judged "frozen" (whole-degree steps);
* the chart picture uses Pillow's built-in font (numbers and times only; the words are in the ticket's description);
* personal choices of the temperatures widget are honoured, but the personal screen offers only on / size for it (not mode / hidden).

## 12. TEMPLINK-295: the report as a temporary download link (pilot/TEMPLINK-295)

Section 9 item 1 is answered for a USER-made link, not for WhatsApp: no document is sent anywhere (no file contract exists); the creator copies
the link and hands it on himself. Migrations: none (it uses `outbound_documents`, migration 0128, and `infra_temp_settings.rules_json`).

* **Reuse**: the PDF is the report dialog's own PDF (`_render_pdf`, shared with `GET /report.pdf`, scoped to the units the user may see). The link
  is `services/tickets/out_documents.py` (`mint(recipient_kind='user')`): a derived token, only `sha256(token)` stored, the public listener's
  `/t/api/doc` and `/t/api/doc/file` (no account; per-token, per-network and installation-wide rate limits; the uniform 404 for unknown, expired,
  revoked or used-up). `mint` gained optional `hours` / `max_opens` so this consumer has its own lifetime.
* **Settings** (installation, Settings > Infrastructure > Temperatures > "temporary report download link"): `report_link_enabled` (OFF),
  `report_link_hours` (24; 1-168), `report_link_max_opens` (10; 1-20), `report_link_per_hour` (10; per user). The tickets service module's
  `reports.documents` must ALSO be on (it is the public listener's switch); otherwise creation answers 409 `report_link_unavailable`.
* **Permission** `infra.temperature.report_link` (site_admin, system_admin by default; editable per role). A manager (`infra.temperature.manage`)
  sees and revokes every link; anyone else only his own.
* **API**: `GET /report/links` (availability, lifetime, the user's links - never a token or URL), `POST /report/links` (201, the URL once),
  `DELETE /report/links/{id}` (204, idempotent).
* **Audit**: `infra.temperature.report.link.create` / `.revoke` (actor, time, document id, unit COUNT) plus out_documents' `report.document.mint`
  and `report.document.open`. No readings, no PDF, no token.
* **Dialog**: a "temporary download link" button in the report dialog (visible only with the permission AND the feature available) and, after
  creation, one row: the link, copy, validity, revoke.
* **Limits**: the file is a snapshot taken at creation (a later alert or reading does not change it); a link is revoked at once when the module
  key is rotated (out_documents rule); the public page's separate review (VENDORQ-294) still applies before `reports.documents` is switched on.

## 13. Key export wording (external backup, same branch)

The external-backup key export dialog (Settings > Diagnostics > Backup and restore) now states, in he / en / ar / ru, what the key is, that
without it a backup cannot be restored, that losing it loses the backup, and that it must be stored outside the system, and the export
button works only after the user ticks the acknowledgement (and types EXPORT, as before). `keyExportReady()` is the gate. The crypto is unchanged.
