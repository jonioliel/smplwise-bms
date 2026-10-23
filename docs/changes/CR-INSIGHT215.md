# CR-INSIGHT215 - Insights and monthly building report (release line 2.15.0)

Status: owner approved the bundle; slice 1 (backend) built on `pilot/INSIGHT215-295`. UI, scheduling and the mockup are later slices.
Migrations: NONE used. All state is `settings` rows and existing tables (no provisional migration number is reserved by this slice).

## 1. Scope

Three read-only, switch-gated features. Each switch is a `settings` row, default OFF; while off every route of that part answers the uniform 404 and nothing is computed.

| Switch | Feature |
|---|---|
| `insights.doors.enabled` | Door opened without a matching entry event |
| `insights.waste.enabled` | Energy consumption (shown to the user as "צריכת אנרגיה"; the key keeps its name): empty room / after hours / night consumption anomaly |
| `reports.building.enabled` | Monthly building report (preview model + one PDF) |

Turning a switch on or off needs `insights.manage` and `system.configure`.

## 2. Data per insight

- Doors: `ha_state_history` and `ha_entities` (door contact, optional lock, up to 4 exit inputs), `ha_actions` (Arx unlock commands), `intercom_door_map` and `door_window_occurrences` (door windows).
- Energy consumption (`waste` key): `ha_state_history` (light/climate, presence sensors), `ha_areas`, energy store quarter hours (`energy.db`) for the night anomaly.
- Report: tickets (through `services/tickets/access.visible`), energy, elevators, generator alerts, temperature, doors, camera events, waste.

## 3. Algorithms and settings (`settings` row `insights.settings`, validated as a whole, 422 names the field)

- Doors: an opening is a closed-to-open transition lasting at least `min_open_s` (default 2). Evidence inside `before_s` (30) before to `after_s` (10) after: lock transition, lock held unlocked, Arx unlock command, exit input, door window. Verdict: explained, unexplained, or unverifiable (lock history unknown). Unknown is never reported as unexplained. Pairs are set explicitly in Settings.
- Energy consumption (`waste` key): empty room = device on while presence has been off for `empty_after_min` (20) for at least `min_waste_min` (30); areas without a presence sensor are checked only in the night window (`night_from`/`night_to`, default 22:00-06:00); night consumption anomaly = night total above the median of the same weekday over the history window. Protected switches are excluded; unknown is never waste.
- Range: 24h, 7d, 30d or custom up to 31 days (the local state history keeps 30 days).
- Report: month `YYYY-MM` (default previous month, site time zone), sections chosen from `summary, tickets, energy, elevators, generator, temperature, doors, cameras, waste`. A section the caller cannot have is omitted and listed with a reason (`not_permitted`, `module_off`, `switch_off`). PDF is rendered in the isolated child (WeasyPrint, fpdf2 fallback), Hebrew RTL first, English LTR.

## 4. Privacy

Door insight carries door and time only: no person, card or name. Energy consumption (the `waste` insight) is room level. The report PDF is generated on demand and not stored. Every read and every PDF is audited (`insights.doors.read`, `insights.waste.read`, `reports.building.pdf`, `insights.settings.update`) with counts, never entity payloads. Nothing is ever sent to a device or to Home Assistant.

## 5. Permissions

`insights.read` (insight screens, scoped per entity to the floor, the device-screens rule), `insights.manage` (settings), `reports.building` (installation). Granted to site_admin and system_admin in `roles.json` and the design role catalog; labelled in `PERMISSION_LABELS`. Report sections additionally require the section's own permission (`energy.view`, `devices.read`, `generator.view`, `events.read`, `insights.read`, ticket view).

## 6. API

`GET/PUT /insights/settings`, `GET /insights/doors`, `GET /insights/waste`, `GET /reports/building/preview`, `GET /reports/building.pdf`. `contracts/API_INVENTORY.md` regeneration is pending (see PROGRESS).

## 7. NOT built (this slice)

UI screens and the HTML mockup, scheduled monthly delivery, WhatsApp text, stored/retained PDFs, door-system entry log (names), suggested door pairs from map placement, generator run counts/hours.

## 8. Owner questions (recommendation first)

1. Default readers: a) site_admin + system_admin only (built), b) operators too. Recommend a.
2. Door evidence: a) lock / exit input / Arx commands / door windows only (built), b) also the door system's entry log in slice 2 behind its own switch and `access.events.read`. Recommend a now.
3. Door pairs: a) explicit in Settings (built), b) suggested from map placement. Recommend a, b later as a suggestion list.
4. Report delivery: a) download only (built), b) also scheduled on the 1st plus WhatsApp text like the temperature report. Recommend b in slice 2.
5. Retention: a) generate on demand (built), b) keep PDFs 7 years like bills. Recommend a.
6. Generator section: a) alerts only (built), b) also run counts and hours (needs a role mapping decision). Recommend a.

## Owner review 24.10 decisions

Source: the owner's review of the mockups, 2026-10-24 (`private/planning/OWNER_MOCKUP_REVIEW_2026-10-24_raw.txt`, item 5). Question numbers below are those of the review form; where they differ from this document's own question list the matching section is named. Recorded as the owner's decisions; the build follows them.

Mockup v2 approved with these answers:

- **Wording (form Q4):** the word "waste" / "בזבוז" is replaced by **"energy consumption" / "צריכת אנרגיה"** everywhere the user reads it: the tab, the section name in the building report, the report filter, the settings switch, the field labels, the empty state. Only the user-visible text changes; the machine names stay (`insights.waste.enabled`, `insights.waste.read`, the section id `waste`, the route `#/tickets/reports/waste`, the settings group `waste`), so no API, permission or stored-setting migration is needed. Applied on this branch in the UI strings (`frontend/src/i18n/insights.ts`, Hebrew and English), the report section label (`services/building_report.py`), the permission label (`routers/access.py`) and the mockup; `unit-insights.spec.ts` now asserts that no user-visible string contains "בזבוז" or "waste". The empty state "אין בזבוז" reads "אין צריכת אנרגיה חריגה" (the plain substitution would have said there is no energy consumption).
- **Monthly send (form Q6; this document's Q4 option b: automatic send on the 1st of the month, also by WhatsApp, in the next slice):** **yes**, but only **after setup, and only when the owner chooses to enable it**: it stays off until it is configured and switched on in settings (no default schedule, no send before that).

## Slice 3 (branch `pilot/INSIGHT215B-295`): monthly delivery and generator runs

Built on the review decisions above. Migration **0153** `insight215_runs_delivery.sql` (`generator_runs`, `insights_report_sends`; built as provisional 0146, renumbered at the 2.15.0 integration, release/2150).

- **Scheduled monthly delivery (Q4 option b, the owner's "only after setup and only when enabled").** The report of the previous month goes out as a TEXT summary (the summary lines of the model - the same numbers as the PDF; neither transport carries a document) on a chosen day 1-28 and time, by e-mail and / or WhatsApp. Routes `GET` / `PUT /reports/building/delivery` (`insights.manage`; uniform 404 while the report switch is off). Order enforced on the server: (1) setup (day, time, language, at least one working channel: e-mail needs the installation's outgoing mail; WhatsApp needs chosen users), (2) the report switch on, (3) the explicit enable, which needs `system.configure` as well and answers 422 `setup_incomplete` naming what is missing. Turning it off needs only `insights.manage`. Enabling records `enabled_at` / `enabled_by`; a month whose send time is before `enabled_at` is never sent retroactively. An edit that would leave an enabled delivery without a channel is refused. Each recipient gets the report built with HIS OWN permissions (WhatsApp: only a user who holds `reports.building`, on the number he opted in for himself; e-mail: the configured notification addresses, built with the enabler's permissions). One row per (month, channel, recipient) is unique: a month goes out once whatever the restarts; WhatsApp waits for the installation's send hours and the shared pacing (use `insights.reports`, inherits the notifications account); a failed row is retried 4 times. No address, number or text is stored or audited.
- **Generator run counts and hours (Q6, owner answer 262).** The generator tick records each engine run (`insights_generator`, from the state mirror; a silent mirror ends the run at the last time seen, never inventing hours). The report's generator section shows runs, hours (and the controller's own hour-meter difference when it reports one) per generator. Visible to whoever may read the building report (`report.generator_runs` = `report_readers`, the default); editable to `generator_viewers` (only `generator.view` holders) or `off`. A report reader without `generator.view` gets the runs and not the alerts. A run shorter than the editable `generator.min_run_s` (default 60 s, 0-3600) is not counted.
- **Wording:** "צריכת אנרגיה" kept everywhere (the English report label is now "Energy consumption").
- **Not built:** a document (PDF) attachment on e-mail / WhatsApp (the e-mail size cap is 64 KB and the WhatsApp transport sends text only - same decision as the temperature report); vendors / external contacts as recipients; daily or weekly cadence (the owner asked for monthly); a "send now" button.
