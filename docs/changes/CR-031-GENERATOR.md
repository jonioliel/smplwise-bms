# CR-031 — Generator control screen ("תשתיות › גנרטור")

**Status:** DRAFT, phase A revision 3 (owner answers applied: device-based detection, view and alerts only, several generators, empty routing, history charts; 2026-10-05). Nothing implemented. No product code, no
migration, no device contact. Branch `pilot/GEN1-generator-mockup` from `origin/main` (2.0.2).
**Numbering:** CR-031 as assigned by the coordinator (CR-028 cast-to-screens is the last one in `docs/changes/`; 029-030
are reserved elsewhere).
**Mockups:** `docs/design/mockups/generator/` (`index.html` = Hebrew review index with the owner questions; `gallery.html`
= the screens). A local copy for the review folder lives in `private/review/generator/` (gitignored).
**Test tier when built:** M (the module is read-only in v1). Controller commands are not part of v1; if a later phase adds them the tier becomes L.

## 0. Owner brief (paraphrased)
One of the owner's sites has a generator. The owner wrote an integration for the generator's controller in the system
infrastructure (HA); it exposes many sensors (alerts, states) and a card that shows the information flow. Arx must
detect that the integration is installed and build a generator control screen automatically, under "תשתיות" next to the
electricity meters. The screen must be far better than the existing card. Alerts must be routable per type to users /
roles and channels.

## 1. What was found (phase A research)
- Repository: no generator code, fixture or entity list. The only mentions are the "water and generators join later as
  siblings" placeholders of CR-023 (`frontend/src/shell/nav.ts`, `docs/architecture/ELECTRICITY_UI_SHELL.md`) and the
  `energy` keyword group of CR-019.
- Lab system (read-only `GET /api/states` with the admin token, 418 entities): no generator, genset, ATS or transfer
  switch entity. A WhatsApp gateway integration exists there (a `notify.whatsapp_*` service and its status sensors), which
  is relevant to the routing model (§7) but not to detection.
- Therefore the sensor and alert catalogue in this CR and in the mockup is an **ASSUMPTION** modelled on generic genset
  controllers (DSE 7x20 / ComAp InteliLite class). The real mapping is verified read-only against the host site's device list (§10, open question a).

## 2. Goal
When a generator controller exists in the system infrastructure, Arx shows a "גנרטור" tab under "תשתיות": a live
screen (power flow, engine, fuel, battery, coolant, oil, phases, load, mode, last start / test, service due), value
history charts with a selectable range, active alerts, alert history with filters and an alert detail with acknowledge,
and a Settings section that routes each alert type to roles / users and channels. **v1 is view and alerts only: Arx sends
no command to the controller.** Several generators per installation are supported through a device picker.

## 3. Scope
**Phase A (done here):** this CR, the mockup gallery, the decisions list.
**v1 (phases B-F):** device-based detection, the capability-driven role mapping with a per-installation override, several
generators with a picker, the live screen, **history charts with a selectable range**, alerts (active, history with
one-year retention, detail, acknowledge), routing settings stored and applied through the CR-018 notification center
(**starting empty**, with per-type message templates), states (not found, unavailable, loading), phone layout, tests.
**Future phase (not in v1, not designed):** commands to the controller (test run, stop, mode) with `generator.control`,
confirmation and audit; the permission and the `generator_commands` table are therefore not created now.
**Designed for, not built now:** extra thresholds computed in Arx, a second source (solar / UPS) on the diagram, WhatsApp
delivery (follows CR-018 channel availability).
**Out of scope:** writing anything to the controller; fuel ordering; maintenance ticketing (data-store direction note:
future module); scheduling of test runs (the controller schedules, Arx displays the next test and the result).

## 4. Placement and navigation
- Area "תשתיות" (`#/infra/*`): level-1 tabs become **"מוני חשמל"** and **"גנרטור"** (`INFRA_TABS` gains a second entry, so
  the existing "row of one is not drawn" rule in `infra-electricity.ts` flips naturally). Level-2 pages of the generator
  tab: **"מצב חי"** `#/infra/generator/live`, **"התראות פעילות"** `#/infra/generator/alerts` (with an open count badge),
  **"גרפים"** `#/infra/generator/charts`, **"היסטוריה"** `#/infra/generator/history`. The generator tab is a sibling of the
  electricity meters tab (owner decision). With more than one detected generator a **picker by device name** sits at the top
  of every page of the tab and of the settings section (`?device=<id>` in the route); with one generator the picker is
  drawn once as a label only in the mockup, in the product it is hidden. Alert detail: `#/infra/generator/history/<id>` (drawer; bottom sheet on
  the phone).
- Visibility: the tab exists only when a generator is detected (or `generator.manage` is held and detection is pending)
  and the user holds `generator.view`. Without detection the Settings section shows the "not found" card; the area tab is
  hidden entirely for non-managers (an installation without a generator shows nothing, as with meters).
- Settings: the existing tab **"תשתיות"** (`#/system/infra`) gets a second level-1 entry **"גנרטור"** with the strips
  **"ניתוב התראות"** (with the same device picker), **"מיפוי חיישנים"**, **"מבחנים ותחזוקה"** (reserved), **"הרשאות"** (link to the permissions tab).
- Copy rules: no platform name on operator screens; the source is "תשתית המערטת" only in the detection card and the
  empty state. Clean operator screens, short confirmations. The power-flow geometry is never mirrored by RTL.

## 4a. Capability-driven screen (revision 2)
- Detection produces a **capability set**: the roles of §6 that the controller actually exposes. Only two roles are **core**
  (engine state and at least one generator voltage); every other role is **optional**. Without the core roles the device
  is listed in Settings as "זוהה חלקית" and no operator screen is built.
- Every piece of the live screen is bound to roles: gauges (fuel, battery, coolant, oil), the phase table columns
  (current, kW, load bar) and its row count (one voltage or L1/L2/L3), engine-card rows, the mode selector and commands
  (role `controller_mode`), the phone KPIs. A piece whose role is missing is not rendered; grids use `auto-fit` so the
  layout closes up with no holes.
- The power-flow diagram adapts: no `mains_available` → no grid card; no `ats_position` → no transfer switch and a
  running generator is drawn as feeding its load; no `gen_kw` → no kW label; the compact (two-card) layout is used when
  both are missing. Phone uses the vertical layout of the same component.
- Alert types carry a `needs` list of roles (§6 `generator_alert_types.needs_json`). The routing settings list only the
  types whose needs are met; the others appear greyed with "דורש חיישן: X" and are never emitted. Groups with no
  available type are hidden. The detection card shows "N of 22 values, M of 22 alert types".
- Gallery scenarios: minimal (state + voltage), typical (no fuel, oil, pf, next test), full.

## 5. Detection method (device-based, capability-driven)
Owner decision: **every generator is one device in the infrastructure device registry, with all of its entities under
it.** Detection therefore works on devices and their entities, never on a single entity:
1. **Read the registries.** The existing infrastructure WebSocket session reads the device registry
   (`config/device_registry/list`) and the entity registry (`config/entity_registry/list`); entities are grouped by
   `device_id`. The state mirror supplies current values and units.
2. **Match a device as a generator by capabilities.** A device is a generator when its entities cover the **core roles**
   (engine state and at least one generator voltage) by `device_class`, unit, `translation_key` / `unique_id` suffix and
   friendly-name patterns (English and Hebrew) from `catalog/generator_patterns.json` (same mechanism as the CR-019 keyword
   groups). The other roles of §6 are matched the same way and are optional. A device covering only part of the core is
   listed as "זוהה חלקית" in Settings and gets no operator screen.
3. **Learn the integration from the device.** The device's config entry gives the integration domain; it is stored
   (`source_domain`) for display in Settings and as a hint that speeds later matching (no hard-coded domain, so a second
   brand needs no code). The setting `generator.integration_domains` is optional and only narrows the scan.
4. **Several generators:** each matching device becomes one `generator_devices` row; the picker lists them by device name
   (renamable in Settings).
5. **Manual pick** ("בחירת התקן ידנית", `generator.manage`): any device of the infrastructure; Arx maps what it can and shows
   the unmapped roles in "מיפוי חיישנים".
The **transfer switch (ATS)** is expected to be reported by the generator controller (owner decision): `ats_position` /
`on_load` come from the same device; without them the diagram assumes a running generator feeds its load. Fuel is diesel
(percent, litres when exposed).
Detection runs at start-up, on registry events (device / entity added, removed, renamed) and on "בדיקה חוזרת". Result
(device ref, entry ref, domain, mapped roles, last check, last seen) is stored in `generator_devices`; the UI never shows
entity ids or device ids, only display names. **Verification:** before building, the detection is checked read-only against
the real device list of the host site (open question a).

## 6. Data model
Main database, migration **0058 `generator.sql`** (0057 is taken by CR-027; renumber at integration if needed). Several
generators: every table below carries `device_id`.

| Table | Purpose | Key columns |
|---|---|---|
| `generator_devices` | One row per detected generator | `id`, `name`, `area_id`, `source_kind` ('integration','generic','manual'), `source_domain`, `source_entry_ref`, `source_device_ref`, `rated_kw`, `rated_kva`, `status` ('detected','unavailable','removed'), `detected_at`, `last_seen_at`, `revision` |
| `generator_roles` | The semantic mapping: role → entity | `device_id`, `role` (engine_state, controller_mode, ats_position, mains_available, on_load, rpm, run_hours, starts, coolant_temp, oil_pressure, battery_v, charger_v, fuel_pct, fuel_l, gen_v_l1..l3, gen_a_l1..l3, gen_kw, gen_kva, pf, gen_hz, load_pct, mains_v_l1..l3, mains_hz, last_start_at, last_start_reason, last_test_at, last_test_result, next_test_at, service_hours_left), `entity_ref`, `unit`, `mapped_by` ('auto','manual'), `confidence`, `core` (bool: engine_state, gen_v_*) |
| `generator_alert_types` | The alert catalogue per device (seeded from the built-in list, extended by controller alarms discovered as binary sensors) | `device_id`, `key`, `group` (engine, fuel, electrical, mains, maintenance, comm), `title_he`, `title_en`, `entity_ref` (binary sensor / event source), `builtin`, `needs_json` (roles required; `available` is derived at read time from `generator_roles`) |
| `generator_alert_policies` | Routing per alert type (§7); **created empty** | `device_id`, `alert_key`, `enabled`, `severity` ('critical','alert','info'), `recipients_json` (`{roles:[...], users:[...]}`, default `{roles:[],users:[]}`), `channels_json` (`['push','app','email','whatsapp']`; `inbox` implicit), `quiet_mode` ('pass','matrix','hold'), `escalate` (bool, default false), `after_s`, `template_he` / `template_en` (text with variables, NULL = built-in text), `row_version`, updated by/at |
| `generator_alerts` | Alert instances | `id`, `device_id`, `alert_key`, `severity`, `raised_at`, `cleared_at`, `acked_by`, `acked_at`, `ack_note`, `snapshot_json` (the role values at raise time: fuel, battery, coolant, load, rpm, ats, mains), `notification_id` (CR-018 row), `count` (re-raise fold), `last_at` |
| `generator_samples` | **History of key metrics** (raw, 5 min buckets) | `device_id`, `metric` (load_pct, gen_v, fuel_pct, battery_v, coolant_c), `ts` (bucket start, UTC seconds), `v_min`, `v_avg`, `v_max`, `n`; PK `(device_id, metric, ts)`; `WITHOUT ROWID` |
| `generator_samples_hourly` | Downsampled older history | same columns, `ts` = hour start; PK `(device_id, metric, ts)` |

Live values are not stored; they are read from the existing state mirror (the same read-only path the meters sampler
uses). **History of the key metrics** is stored by a sampler task (one worker, reuses the meters sampler loop):
- Metrics and capability: only metrics whose role is mapped are sampled (load %, generator voltage, fuel %, battery V,
  coolant temperature). Per device a metric is stored only while the controller is available; gaps stay gaps (no
  interpolation, the chart draws a break).
- **Sampling:** the mirror value is read every 30 s while the engine runs and every 60 s while stopped; each 5-minute
  bucket stores min / avg / max / count. A bucket is written once (upsert at bucket close, flushed on shutdown).
- **Downsampling:** a nightly job folds `generator_samples` older than 30 days into `generator_samples_hourly` (min of
  mins, max of maxes, count-weighted average) and deletes the folded raw buckets; hourly rows older than
  `generator.history_retention_days` (default 365, 30-1825) are deleted. Alert history uses `generator.alert_retention_days`
  (default 365).
- **Size:** 5 metrics x 288 buckets/day x 30 days is about 43 k rows per generator for the raw window plus 5 x 24 x 335 =
  about 40 k hourly rows for the rest of the year: roughly 10-15 MB per generator per year in SQLite, written in batches
  (the SQLite write-storm lesson of round 10: one transaction per flush, never per sample).
- **Reads:** the chart range picks the table and bucket: 1 h -> raw samples of the mirror ring buffer plus 5 min buckets;
  24 h -> 5 min buckets (288 points); 7 d -> 5 min buckets averaged to 30 min (336 points); 30 d -> hourly (720 points);
  custom -> whichever table covers it, capped at about 1000 points by merging buckets. `GET .../history` returns at most
  1000 points per metric.
- Backup and restore include the generator tables (the history can be excluded from the backup size accounting by a flag,
  same as the meters).
Alert history retention: `generator.alert_retention_days` (default 365, 30-1825). Indexes: `generator_alerts (device_id,
raised_at)`, `(device_id, cleared_at)` partial where null; unique `generator_alert_policies (device_id, alert_key)`.

## 7. Notification routing model
Builds on CR-018 (one center, administrator-only routing, no per-user preferences):
- Each generator alert type is a **CR-018 source policy** with the key `generator.<alert_key>`; the table
  `generator_alert_policies` is its generator-specific view (recipients, channels, quiet mode, escalation) and the
  settings screen edits it in place. Saving writes both the generator row and the matching CR-018 policy inside one
  transaction, so the center, the push worker, the email sender and the delivery log need no new code paths.
- **Recipients:** roles (system admins, site admins, operators; viewers refused) and named users; resolved at emit time
  against current bindings (role AND scope, per the identity amendment).
- **Channels:** `inbox` always; `webpush`, `app` (CR-027 phone app), `email` as the center offers them today; `whatsapp`
  and `ha_mobile` (Companion) are shown as "בקרוב" exactly like the center and become selectable automatically when the
  center opens them (no generator-side change). The mockup shows a clear note on the settings screen: routing is stored
  now, delivery goes through the center; nothing is promised for channels the center does not deliver yet.
- **Severity** per type (default from the catalogue; critical for engine shutdown causes, alert for mains / fuel /
  battery / comm, info for mains restored / test done / service due).
- **Quiet hours:** per type "עובר תמיד" / "לפי מטריצת החומרה" (the CR-018 installation matrix) / "מוחזק"; the installation
  quiet window itself stays in the notifications tab.
- **Escalation:** per type on/off (off by default; meaningless without recipients); minutes and steps are the CR-018
  installation settings; stops on acknowledge.
- **Acknowledge:** `POST /generator/alerts/{id}/ack` with an optional note; requires `generator.view` plus the row being
  visible to the user; audited `generator.alert.ack`; also acknowledges the CR-018 row (`notify.ack`). "השתקה ל-24 שעות"
  folds re-raises of the same key for 24 h (snooze on the center row).
- **Fold:** the same key raised again while open increments `count`/`last_at` (CR-018 dedupe) instead of a new row; a
  higher severity re-notifies.
- **Resolve:** the clearing of the controller alarm closes the row (`cleared_at`) and resolves the center row.
- **No default recipients (owner decision):** routing starts **empty**. No role and no user is selected for any alert
  type, no channel besides the center inbox, escalation off. With no recipients an alert is raised and kept in the
  notification center only. Severity and quiet-hours behaviour have catalogue defaults (critical for engine shutdown
  causes, alert for mains / fuel / battery / comm, info for mains restored / test done / service due). The screen shows an
  empty state ("לא נבחרו נמענים - ההתראות יישמרו במרכז ההתראות בלבד") at the top of the routing list and on each row.
- **Message templates:** the one thing that is prepared per type: a Hebrew (and English) text with variables (`{device}`,
  `{time}`, `{battery}`, `{fuel}`, `{load}`, `{site}`); a variable whose role is missing is dropped from the sentence. The
  edit drawer has a template editor, the variable list, a live preview with sample values and "restore built-in text". The
  same text is used by every channel (the center renders it per channel).

## 8. API sketch (`/api/v1/generator/...`)
| Route | Permission | Notes |
|---|---|---|
| `GET /generator/devices` | generator.view | detected generators, status, last seen |
| `POST /generator/devices/detect` | generator.manage | run detection now; returns the result (3/min) |
| `PUT /generator/devices/{id}` | generator.manage | name, area, rated values, manual device pick |
| `GET /generator/devices/{id}/live` | generator.view | all role values with units and `updated_at`; `stale: true` when the controller is unavailable |
| `GET /generator/devices/{id}/roles` / `PUT` | generator.manage | the mapping, candidates per role (display names only) |
| `GET /generator/alerts?state=open\|closed&severity=&type=&ack=&from=&to=` | generator.view | active + history, paging |
| `GET /generator/alerts/{id}` | generator.view | detail: snapshot, timeline (raised, deliveries from the CR-018 delivery log, escalations, ack, cleared) |
| `POST /generator/alerts/{id}/ack` | generator.view | `{ note? }`; `POST .../snooze` `{ hours }` |
| `POST /generator/alerts/ack-all` | generator.view | all open rows of a device |
| `GET /generator/policies?device=` / `PUT /generator/policies/{alert_key}` | notify.manage | routing per type incl. template; `POST /generator/policies/reset` (back to empty) |
| `POST /generator/policies/{alert_key}/test` | notify.manage | sends a test notification through the center (3/min) |
| `GET /generator/devices/{id}/history?metric=&range=1h\|24h\|7d\|30d\|custom&from=&to=` | generator.view | capability-driven: only mapped metrics; <= 1000 points per metric, gaps as nulls, `bucket_s` and `source` (raw / hourly) in the reply |
| `GET /generator/policies/{alert_key}/preview?device=` | notify.manage | rendered template with sample values |
| WS `/me/ws` | - | `generator_live` (value changes, 1 s coalesced), `generator_alert` (raise / ack / clear) |
Errors: `generator_not_found` 404, `role_unmapped` 422, `controller_unavailable` 503 (retryable), `revision_conflict` 409.
No write route towards the controller exists in v1.

## 9. Permissions
| Permission | Hebrew label | Meaning | Default roles |
|---|---|---|---|
| `generator.view` | צפייה בגנרטור והתראותיו | live screen, alerts, acknowledge, snooze | operator, site_admin, system_admin |
| `generator.manage` | ניהול הגנרטור (זיהוי, מיפוי) | detection, device pick, role mapping, rated values | site_admin, system_admin |
| `notify.manage` (existing) | - | the routing section | system_admin |
viewer and kiosk get nothing; the area tab is hidden without `generator.view`. `generator.control` is reserved for the future
commands phase and is not created in v1. The HA token is never the user's identity.

## 10. Decisions taken and open questions
**Decisions (owner, 2026-10-05):**
1. Detection by the device registry: one generator = one device with its entities; integration learned from the device.
2. v1 is view and alerts only; commands are a future phase (mentioned only here).
3. Several generators: picker by device name in live, charts, alerts and routing settings.
4. The transfer switch is reported by the generator controller.
5. Fuel type: diesel.
6. Scheduled tests: the controller schedules, Arx displays; WhatsApp: shown "בקרוב", available through the notification centre.
7. Maintenance reminders by controller run hours.
8. No default recipients: routing starts empty, only message templates are prepared.
9. Alert history retention: one year.
10. (see 6)
11. History charts are in v1: key metrics, selectable range (1 h / 24 h / 7 d / 30 d / custom), capability-driven, light / dark, phone.
12. Menu: sibling tab of the electricity meters.
**Open (2):** (a) which site / HA system hosts the generator, so detection can be verified read-only against its device list
before B starts; (b) approval of the mockup.

## 11. Test plan
Backend (fixtures and a fake controller only, no device): detection from a device-registry fixture (one device, two devices,
partial device, no device), the manual pick; registry change re-detection; role mapping with units (percent vs litres, bar vs kPa, °C) and unmapped
roles; live payload with `stale` after `generator.stale_after_s`; alert raise / fold / clear from binary-sensor
transitions and from an event-style alarm source; snapshot content; ack / snooze / ack-all with audit; policy save
writing both tables in one transaction, reset to defaults, test send; recipient resolution by role AND scope; quiet-mode
pass / matrix / hold against the CR-018 window; escalation stop on ack; permissions matrix (view / manage / control /
notify.manage; viewer 403; client flags ignored); retention job; backup / restore of the generator tables; history sampler (bucketing, gaps, flush), nightly downsampling (min / max / weighted average), retention, range-to-table
selection and the 1000-point cap, capability-gated metrics; routing starts empty, template rendering with a missing
variable; assertion that no code path writes to the controller.
Frontend (Playwright, 1440 / 820 / 390, RTL, light / dark, four skins on the live screen): live in the four scenarios
(on load, standby, test, unavailable), device picker with two generators, charts (every range, minimal controller), active alerts (list, empty), history with every
filter, detail drawer / bottom sheet with ack, routing table (empty state) and edit drawer with template preview, not-found and settings-not-found, loading;
diagram not mirrored under RTL; targets ≥ 44 px at 390; no horizontal overflow.
Evidence: screenshots per screen and state under `docs/evidence/generator/`.

## 12. Effort estimate (agent hours)
| Phase | Content | Hours | Tier |
|---|---|---|---|
| **A** | This CR + mockup gallery (revisions 1-3) | 8-10 | - |
| B | Backend detection + entities: migration 0058, **device-registry detection with capability matching**, several generators, role mapping with override, capability set and core/optional roles, alert-type availability, live payload over the mirror, stale handling, devices / roles API, permissions, audit, backup | 16-20 | M |
| C | Live screen: area tab, four-page shell, capability-bound rendering, device picker, the v2 power-flow component (horizontal, vertical, compact; animated with reduced-motion fallback), gauges, phase table, engine card, mode card (display only), states, phone layout, four skins | 16-20 | M |
| D | Alerts: raise / fold / clear engine, snapshots, active list, history with filters (one-year retention), detail with timeline, ack / snooze / ack-all, WS events | 10-14 | M |
| E | Routing settings: policies (empty by default) + CR-018 bridge, availability by needs, **message templates with preview**, edit drawer, detection card with counts, mapping screen (basic) | 11-14 | M |
| **H** | **History charts:** `generator_samples*` tables, sampler task, nightly downsampling and retention, history API, chart component (small cards + full view, 5 ranges, custom range, gaps, light / dark, phone), CSV export | 14-18 | M |
| F | Tests (incl. sampler / downsampling) + evidence + Hebrew guide + bilingual release notes | 8-10 | M |
| **v1 total (B-F + H)** | | **75-96** | one M release (could ship as two: B-F, then H) |
| Future | Controller commands (`generator.control`, preconditions, confirm, audit), extra thresholds | 8-12 | L |
Versus revision 2 (56-73 h): +14-18 h for charts, +2-3 h for several generators / device-based detection, +1 h for templates,
-6-9 h because commands left v1 (kept as the future row).
Dependencies: verification of the detection against the host site's device list (open question a) before B starts; CR-027
app channel merged for the `app` channel chip to be live; CR-018 center as the delivery path.

## 13. Phase A record
- Built: `docs/design/mockups/generator/` (index, gallery, 20 screens x 3 widths x 2 themes x 4 skins, a before/after page for the diagram), this CR.
- Revision 2 (owner feedback): v2 power-flow diagram as a hero component (v1 kept only on the before/after page), capability-driven rendering with minimal / typical / full scenarios, alert types gated by `needs`, questions rewritten with recommendations and blocking / safe-default marks.
- Lab access: one read-only `GET /api/states` listing to look for a generator integration (none found); no write, no
  entity shown here; no IP, token or id left in any file.
- No product file, migration, setting or permission was changed.
- Revision 3 (owner answers): detection rewritten as device-based and capability-driven; control buttons and the confirm dialog removed from the mockups (commands only mentioned as a future phase); device picker (two generators in the mockup); routing starts empty with an empty state and per-type templates with preview; history charts added to the live screen and as a full-size view (5 ranges, light / dark / phone) with the storage, downsampling and retention model; the owner questions page now lists decisions taken and two open questions.
