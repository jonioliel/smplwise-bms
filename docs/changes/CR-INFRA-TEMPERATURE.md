# CR-INFRA-TEMPERATURE - temperature control under Infrastructure (2.9.1)

Status: phases 1 and 2 built on `pilot/TEMPCTL-291` (from `integ/290`). Owner-approved mockup and binding decisions:
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
* The phase 3 ideas are not built yet.
