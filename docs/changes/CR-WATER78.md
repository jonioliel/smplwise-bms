# CR-WATER78 - Water meters under Infrastructure (board item r078; gas later on the same model)

Status update: owner decisions of 2026-10-23 applied; slice 1 built (pilot/WATER78-295), slice 2 built backend-only (pilot/WATER78B-295,
section 15). Original status: PROPOSED (change record + owner mockup only, 2026-10-23). Branch `pilot/WATER78-295` from `origin/main` (v2.12.3,
c37c75c917c79f694039c961174db37d57d43c4c). No product code, no migration file, no setting, no permission and no device was
touched. Mockup: `docs/design/mockups/water-78/index.html` (single file, RTL Hebrew, light + dark, desktop + phone, the states).

Precedence (CLAUDE.md): an approved change request, then `MASTER_SPEC_HE.md` and `docs/security/`, then `AGENTS.md`, then this
document. It becomes binding only when the owner approves it. Contradictions and deviations are listed in section 14.

## 1. Goal

The owner asked for water meters under "תשתיות" with the SAME model as the electricity meters (CR-023, built in 2.0.x: meter
definition, readings, sources, consumption, permissions, backup), and for gas to follow later on that model. A water meter is -
like an electricity meter - a cumulative counter read from an entity of the system infrastructure; the product records its
readings in its own store, derives consumption per interval / day / period, and adds what water needs and electricity did not:
**leak detection** (continuous flow at night, abnormal consumption, a burst) through the notification engine. Billing water to
tenants is optional and is an owner question (section 13, Q1); nothing of it is built in slice 1.

## 2. Scope and slices

| Slice | Content | Tier |
|---|---|---|
| **1** | Meters + readings + consumption: the module switch, migration 0152 (provisional), the meter registry with water validation, the sampler on the existing state mirror (read-only), counter rules and epochs reused from the energy counter, 15-minute / daily totals, manual readings, retention, permissions, audit, backup, API, the "מים" tab with the pages **מונים** and **צריכה**, settings section, evidence | L |
| **2** | Leak alerts: the evaluator (night flow, abnormal daily consumption, burst, not reporting), notification sources, the alert log page **התראות**, acknowledge / mute, routing settings, the home KPI (optional) | M (inside an L release) |
| **3** | Billing to tenants (ONLY if Q1 is approved): water accounts on the electricity billing engine (formula, customer card, tariff per m³, periods, drafts, issue, PDF) with a `medium` on the account; the pages **חשבונות / חיובים** inside "מים" | L |

Out of scope for every slice: writing to any device or to the infrastructure (valves, shut-off - never, not even on a detected
leak; owner question Q6 records the idea), gas meters (designed for: the model carries a `medium`, nothing gas-specific is built),
pressure sensors, water quality, the SATEC-like adapters.

## 3. Placement and navigation

- `INFRA_TABS` (frontend/src/shell/nav.ts) gains `{ id: 'water', label: 'מים', href: '#/infra/water/meters' }` directly after
  `electricity`; the tab is offered only while the module is on AND the viewer holds `water.view` (like `energy.view` gates the
  electricity tab; `applyInfraWater(hide)` mirrors `applyInfraTemperature`). Level 2 (`INFRA_WATER_PAGES`, section `infra.water`
  in the tabs editor, ordered and hidden by `ui.tabs` like `infra.electricity`): **מונים**, **צריכה**, **התראות** (slice 2),
  and, with slice 3 only, **חשבונות**, **חיובים** (money pages gated by `water.bills`, like `INFRA_MONEY_PAGES`).
- `NAV_PERMISSIONS`: `'#/infra/water/meters': ['water.view']`; the infrastructure settings tab adds `water.manage`.
- Settings › תשתיות › **מים**: the module switch, retention, stale minutes, the leak rules' installation defaults (slice 2), the
  alert routing (slice 2, `system.configure`), the backup choice. The permission rows live in "משתמשים והרשאות".
- Copy rules: operator screens never name the platform ("תשתית המערכת" only in the meter picker and the source explanation); no
  hint paragraphs on operator screens; short confirmations; management only in Settings and in the manager's affordances.
- Units on screen: **מ״ק** (m³) for totals and daily consumption, **ליטר** for small values (< 1 m³) and for flow, **ליטר/שעה**
  for the night-flow figure. The stored unit is the litre (integer), like the energy store's Wh.

## 4. Model (the electricity model, parameterised by the medium)

### 4.1 What is reused unchanged
`services/energy_counter.py` (reset, noise, spike, persisting jump, rebase, replacement epochs), `energy_store.py` (own SQLite
file, own write gate, `readings` / `intervals` / `daily` / `meter_map` / `cursor`), `energy_sampler.py` (once a minute over the
state mirror, read-only), `energy_periods.py`, `energy_calibration.py` and the manual-reading rules of 0058, the retention
janitor, the backup allow-list pattern of `energy_backup.py`. The design choice (section 14, D1): these modules take a
**medium profile** (`MediumProfile(medium='water', base_unit='L', source_units={...}, device_classes={...}, db_file='water.db',
table_prefix='water_')`) instead of being copied. The electricity profile is `medium='energy'`, base unit Wh, file `energy.db`,
prefix `energy_` - its behaviour and its tables do not change (a characterisation test proves the energy tables and the API
inventory are byte-identical before / after).

### 4.2 Main database (migration **0152 `infra_water.sql`**, PROVISIONAL - one file for slices 1 and 2; renumbered at integration)

| Table | Purpose | Key columns (text ids, UTC ISO, decimals as text) |
|---|---|---|
| `water_meters` | A recorded meter | `id`, `medium` ('water'; 'gas' reserved, CHECK), `source_kind` ('ha_entity'), `source_ref` (entity id; never shown to a viewer), `display_name`, `unit` ('L','m3','gal','ft3'), `unit_factor` (millilitres per source unit: 1000 / 1 000 000 / 3 785 412 / 28 316 847 - stored in **mL** so gallons and cubic feet stay exact integers; the API answers litres), `area_id`, `kind` ('main','sub','irrigation','cooling','pool','other' - a label for the screens, not a rule), `status` ('active','paused','retired'), `status_reason`, `max_flow_lph` (plausibility cap, litres per hour; default 20 000), `revision`, created / updated / retired |
| `water_meter_epochs` | One row per counter life | as `energy_meter_epochs` (`start_reading_ml`, `end_reading_ml`, `reason` first / replaced / source_changed) |
| `water_meter_manual_readings`, `water_meter_calibrations` | Typed readings of the physical meter and calibrations | as 0058 (`value_ml`, `typed_value`, `typed_unit`) |
| `water_alert_settings` | Slice 2: ONE row of installation defaults + per-meter overrides in `water_meters.rules_json` | `night_from` ('01:00'), `night_to` ('05:00'), `night_min_lph` (6), `night_min_intervals` (8 = two hours of 15-minute buckets), `abnormal_factor` ('2.0'), `abnormal_min_l` (500), `baseline_days` (28), `burst_lph` (= `max_flow_lph` of the meter), `offline_min` (120), `alerts_enabled` (1), `quiet_*` (as temperature), `mute_includes_*` (0) |
| `water_alert_events` | Slice 2: the alert log | `id`, `meter_id`, `kind` ('night_flow','abnormal','burst','offline','health'), `severity` ('warning','alarm'), `opened_at`, `closed_at`, `value_json` (the litres / rate / baseline that fired), `suppressed` (NULL / 'off' / 'quiet' / 'mute' / 'maintenance'), `ack_by`, `ack_at`, `notification_id` |
| `water_alert_recipients` | Slice 2: recipients per kind | the elevators' routing pattern (roles / users / groups), mirrored onto the CR-018 policy |

Settings keys (not a table): `water.enabled` (**false**), `water.raw_retention_days` (90), `water.interval_retention_months` (26),
`water.stale_after_minutes` (120 - water meters often report on change only; a still meter at night is silent for hours, so the
stale threshold is longer than electricity's 60), `water.include_history_in_backup` (false), `water.home_kpi` (true, slice 2).
Rollback of 0152: drop the tables, delete the `water.*` settings and the `water.*` policy rows; nothing else reads them.

### 4.3 Time-series database `/data/water.db`
The energy store's schema through the medium profile: `readings (meter_id, ts, value_ml, flags)`, `intervals (meter_id, bucket,
ml, quality)`, `daily`, `meter_map`, `cursor`. Own write gate (`db.gate_for(path)`), WAL, `synchronous=NORMAL`; the sampler
never takes the main write gate. Size at the defaults for 30 meters: tens of MB.

### 4.4 Sources (entities of the system infrastructure) and validation
Checked in the picker and again on the server on every save:

| Check | Accepted | Warning | Rejected |
|---|---|---|---|
| Domain | `sensor` | - | anything else |
| Unit | L, m³, gal, ft³ (and the platform's spellings "L", "m³", "gal", "ft³", "CCF" is refused) | - | L/min, L/h, m³/h, gal/min (a flow rate), bar, kPa, %, missing, other |
| device_class | `water` | missing with a volume unit | `gas` (until the gas slice), `energy`, `power`, `volume_flow_rate`, `pressure`, anything else |
| state_class | `total_increasing` | `total` | `measurement` |
| State | numeric >= 0 | unavailable now (saved, shown "לא מדווח") | non-numeric, negative |
| Duplicates | - | same device already used | same entity twice |

Hebrew messages: a flow-rate sensor: "החיישן מודד ספיקה רגעית (ליטר לדקה), לא צריכה מצטברת. למונה מים צריך מונה שמציג מ״ק או ליטר
מצטברים."; wrong unit: "יחידת המידה היא {unit}. אפשר לבחור רק מונה שמודד ליטר, מ״ק, גלון או רגל מעוקב."; a gas sensor:
"זהו מונה גז. מוני גז יתווספו בהמשך." A unit change on a live meter pauses it ("יחידת המדידה של המונה השתנתה. המונה הושהה.").

### 4.5 Readings, consumption, periods
Readings are cumulative; the consumption of an interval / day / period is the sum of positive deltas between accepted readings
(no estimates, measured only - CR-023 D7 applies). Plausibility cap: `max_flow_lph × hours × 1.5 + 20 L`. Resets, noise
(a drop under 10 % and under 20 L), spikes, replacement and the "not reporting" rule are the energy counter's. Manual readings
and calibration as 0058. Daily totals per local date of the installation zone; DST days need no special case.

## 5. Screens (the mockup, revision 3 - 2026-10-24)

Owner feedback on revision 2 (2026-10-24): "looks good, but it must be MUCH more in the style of the electricity meters screens".
Revision 3 (`docs/design/mockups/water-78/index.html`) is the real electricity meters screens reproduced 1:1 - the CSS of
`electricity/styles.ts`, `screens/electricity/page-meters.ts`, `electricity/meter-card.ts`, `components/sw-tabs.ts`,
`sw-state-panel.ts`, `sw-drawer.ts`, `sw-button.ts` and the shell of `shell/sw-app.ts` copied with the real class names - with
water content only. Evidence: `private/review/water-78-v3/` (the mockup beside a screenshot of the REAL electricity screen at
1366 / 1024 / 375, light and dark: `compare-*.png`). Implementer's rule: `screens/water/page-meters.ts` is `page-meters.ts` with
the water adapter; nothing water-specific is drawn with its own component.

Level-1 pill row **מוני חשמל | מים** (the "מים" tab carries the red count of open leaks, `TabItem.badge`); level-2 compact row
**מונים · צריכה · התראות (n)**.

1. **מונים** - exactly `page-meters.ts`: the head row (search field, כרטיסים / טבלה segmented control, "+ הוספת מונה" for
   `water.manage`; on the phone the area select beside the button), the four tiles (היום in m³, מתחילת החודש, מדווחים x מתוך y,
   **דליפה חשודה** in the danger colour - the electricity tiles with the stale tile replaced by the leak count; the tiles are
   figures, not filters, as on the electricity page), the areas tree (`כל האזורים`, floors with the chevron and per-floor collapse,
   areas with counts), the table (שם, אזור · קומה, קריאה נוכחית (מ״ק) with three decimals, היום, מתחילת החודש, **ספיקת לילה** in
   litres per hour - "כבוי" for an irrigation meter, "-" without a reading - and מצב), the cards view (`.mcard`: name + chip,
   area, the big "מ״ק היום", the reading, the night flow), the phone rows (`.li.pick`). The מצב chip is the electricity chip
   (מדווח / לא מדווח מ-HH:MM / מושהה) and, from slice 2, the open alert wins: **דליפה חשודה** (`c-err`), **צריכה חריגה**
   (`c-warn`). A row opens the meter card: the `sw-drawer` modal (480 px; a bottom sheet on the phone) with the chip, the facts
   (`dl.kv`: אזור, קריאה נוכחית, דיווח אחרון, יחידה, סוג, ספיקת לילה, כללי דליפה), "צריכה" with the 24 שעות / 30 ימים / 12 חודשים
   segmented control and `meter-card.ts`' bar chart (the 24-hour view marks the night window 01:00-05:00; a leak paints those
   bars in the danger colour), **התראות פתוחות** with אישור / השתקה 60 ד׳ (`water.ack`), תקופות מונה, קריאות ידניות וכיול, and
   the actions row (שינוי שם, החלפת מונה, השהיה / חידוש, הסרה).
2. **צריכה** - the same page shape: the head row (the range segmented control היום / 7 ימים / 30 ימים / חודש קודם, "ייצוא CSV"),
   four tiles (סה״כ בטווח, לעומת התקופה הקודמת, ממוצע יומי, ספיקת לילה ממוצעת), a card with the daily bar chart (the electricity
   chart; the night share drawn darker at the foot of each bar, leak days in the danger colour, legend in the card head), the
   per-meter table (שם, אזור, צריכה (מ״ק), חלק, לעומת הקודם, ספיקת לילה) and phone rows. CSV export as before (`?lang=he|en`,
   UTF-8 BOM, formula-safe).
3. **התראות** (slice 2) - the same page shape (no longer the temperature screen's list): the head row (פתוחות / הכול segmented
   control, "ייצוא CSV", "כללי דליפה" for managers), four tiles (פתוחות in the danger colour, נסגרו השבוע, מושתקות, the leak
   rule in force "01:00-05:00 · 6 ליטר לשעה · שעתיים"), the table (מונה, אזור, סוג, מאז, ערך, מצב chip, אישור / השתקה 60 ד׳
   actions for `water.ack`) and phone rows; an open row opens the meter card.
4. States on every page, exactly `page-meters.ts`: loading = a card of seven skeleton rows; empty = `sw-state-panel` with the
   drop icon, "אין מונים עדיין" and the manager's "+ הוספת מונה" (no paragraph - the operator-screen copy rule); error =
   `sw-state-panel state="error"` "לא ניתן לטעון את המונים" + "נסה שוב"; **module off** = the stale panel "המודול כבוי - מוני
   מים מופעלים בהגדרות המערכת" + "להגדרות" for managers, the "מים" tab and the page row not offered (the off panel is what a
   stale deep link shows); forbidden = the lock panel (view without `water.view`). "לא נמצאו מונים" is the compact panel under a
   search without hits.
5. Settings › תשתיות › מים: the module switch, retention, stale minutes, leak defaults, alert routing, backup choice (not drawn;
   the electricity settings section's shape).
6. Dropped from revision 2 (they were temperature-screen parts, not electricity ones): the page title + subtitle block, the KPI
   filter row, the solid state badges, the kind segmented control in the toolbar, the "קריאה ידנית" head button (it lives in the
   meter card, as on the electricity card), the hint paragraphs of the empty states.

## 6. API (`/api/v1/infra/water/...`)

| Route | Permission | Notes |
|---|---|---|
| `GET /status` | any signed-in user | `{enabled, can_view, can_manage, meters: n}` - drives the tab gate (never 403 for the gate) |
| `GET /candidates?q=&area_id=&include_rejected=` | `water.manage` | entities with the section 4.4 verdicts, grouped by area, live values |
| `GET /meters?include_retired=`, `GET /meters/{id}` | `water.view` | friendly names only; `source_ref` only for `water.manage` |
| `POST /meters`, `PATCH /meters/{id}`, `DELETE /meters/{id}?revision=`, `POST /meters/{id}/replace` | `water.manage` | audited, ids only |
| `GET /meters/{id}/series?from&to&bucket=15m|1h|1d`, `GET /meters/{id}/readings` | `water.view` | litres |
| `GET /consumption?meter_ids=&from=&to=&bucket=`, `GET /consumption.csv?lang=` | `water.view` | the consumption page; the CSV is audited |
| `GET|POST /meters/{id}/manual-readings`, `POST .../{rid}/undo`, `POST /meters/{id}/calibrations`, `POST .../{cid}/undo` | `water.manage` | as the energy routes |
| `GET /events`, `GET /events.csv`, `POST /events/{id}/ack`, `POST|DELETE /meters/{id}/mute` | `water.view` / `water.ack` | slice 2 |
| `GET|PUT /settings` | `water.view` read; write: `water.manage` for its keys, `system.configure` for retention and the switch, `backup.manage` for the backup choice | the energy settings' editor rule |
| `GET|PUT /alerts` | `water.manage` read; `system.configure` write | slice 2 routing |

Errors (`ApiError`, Hebrew `user_message` + `details.message_en`): `module_off` 404 on every route except `/status` and the
settings (the tab is not offered, a stale deep link lands on the off panel), `meter_unit_rejected` 422, `meter_flow_rate` 422,
`meter_gas_later` 422, `meter_duplicate` 409, `meter_in_use` 409 (slice 3), `revision_conflict` 409, `reading_implausible` 422,
`period_invalid` 422. Live updates: `water_meter_status` on `/me/ws`; values refresh by 60 s polling while shown.

## 7. Module switch (default OFF)

`water.enabled` (`false`), the schedules / tickets pattern: while off, no sampler thread, no janitor, no evaluator, no
notification source is registered, the tab is absent, the home KPI is absent, the settings section shows the switch only, and
every water route except `/status` and the settings answers `module_off`. Turning it on starts the sampler at the next minute; it
never backfills (no estimates). Turning it off stops sampling and resolves open water notifications with `alerts_disabled`
(the elevators' rule), keeps every table and file, and the switch is audited (`infra.water.enabled`). With the module off there
is no "open a service request" action anywhere on the water screens (owner 2026-10-20); with it on, the ticket action exists
only while the tickets module is on (slice 2, from an open leak alert, through `tickets.create` as the person).

## 8. Permissions

| Permission | Hebrew label (server catalogue) | Grants | Built-in holders |
|---|---|---|---|
| `water.view` (new) | צפייה במוני מים ובצריכה | the tab, meters, consumption, readings, the alert log; friendly names only | operator, site_admin, system_admin (viewer: owner question Q4) |
| `water.ack` (new, slice 2) | התראות מים: אישור והשתקה | acknowledge, mute warnings (never alarms unless the explicit setting) | operator, site_admin, system_admin |
| `water.manage` (new) | ניהול מוני מים: הגדרה, קישור, כללי דליפה | define / edit / replace / retire meters, manual readings, calibration, leak rule defaults, entity ids | site_admin, system_admin |
| `water.bills` (slice 3 only, sensitive, never implied) | חיובי מים: סכומים, לקוחות, הפקה וביטול | as `energy.bills` | site_admin, system_admin |
| `system.configure` (existing) | - | the module switch, retention, alert routing | system_admin |
| `backup.manage` (existing) | - | include the history in the backup | - |

Scope: installation in slice 1 (as energy). Floor-scoped viewers are an owner question (Q5): the electricity module ignores
`ha_scope`; the temperature / elevators modules apply it. Recommendation: apply it (a floor viewer sees only meters whose entity
he may see), because water meters of tenants are more personal than building meters.

## 9. Alerts (slice 2) - leak detection through the notification engine

Evaluator `services/water_runtime.py`, every 15 minutes after the bucket closes (the night rule needs closed buckets), from the
water store, never from the mirror directly; nothing is ever sent to a device.

| Rule | Condition (installation defaults; per meter override) | Severity | Source |
|---|---|---|---|
| **Night flow** (continuous flow at night) | inside `night_from..night_to` (local), `night_min_intervals` consecutive 15-minute buckets each with flow >= `night_min_lph` | warning; alarm after the whole night window | `water.leak` |
| **Abnormal consumption** | today's total (so far) > `abnormal_factor` × the median of the same weekday over `baseline_days`, and > `abnormal_min_l`; a meter younger than 7 days has no baseline and no rule | warning | `water.abnormal` |
| **Burst** | any bucket's rate > `burst_lph` (= the meter's `max_flow_lph`) | alarm at once | `water.leak` |
| **Not reporting** | no accepted reading for `offline_min` AND the meter's entity is unavailable / unknown (a silent but available meter at night is NOT offline - water is often still) | warning | `water.offline` |
| **Sensor health** | battery / signal of the device (the temperature module's helper) | warning | `water.health` |

- Night flow is the primary leak signal (a running toilet, a dripping pipe, an irrigation valve stuck open); the figure shown
  everywhere is "ספיקת לילה" in litres per hour = the minimum bucket flow inside the night window (the floor), because a leak is
  the flow that never stops. Irrigation meters (`kind = irrigation`) default to `night_rule = off` with a note (watering runs at
  night); the owner may turn it on per meter.
- Alerts ON by default once the module is on (`alerts_enabled`), the temperature module's holds: quiet hours hold warnings only,
  mute (15 / 30 / 60 / 120 min, `water.ack`) holds warnings only, alarms are never held unless the explicit settings; every held
  row is still logged with `suppressed`. One open row per meter and kind; closed when the condition ends (night flow: when a
  bucket below the threshold closes, or at `night_to`), resolved in the notification centre.
- Sources `water.leak` (critical, push + phone app), `water.abnormal` (alert, push), `water.offline` (alert, inbox),
  `water.health` (info, inbox), category `device_faults`, recipient rule `water` (defaults: leak to operators + site and system
  admins, the rest to the admins), subject kind `water` (visibility = `water.view` on the meter). E-mail / WhatsApp on request
  through the existing pipeline (the user's own opted-in number).
- Home: one KPI tile "מים · דליפה חשודה" in the building summary row only while an open leak exists (`water.home_kpi`), tap =
  `#/infra/water/alerts`. Not a configurable widget (owner question Q7).

## 10. Privacy and security

- Read-only infrastructure access through the existing mirror; no service call, no new token; the token never reaches screens,
  logs or CSVs. Entity ids only for `water.manage`; viewers see display names (owner decision 7 of the temperature module).
- Water consumption of a tenant's sub-meter is personal data: it is visible by `water.view` (+ scope, Q5), exported only through
  the audited CSV, never in notifications beyond the meter name and the figure that fired, and retained by the retention keys.
  With slice 3, customer contact fields and amounts are `water.bills` only, hidden server-side like `energy.bills`.
- No shut-off, no valve, no actuation ever (Q6 records the idea; it would need its own CR, a physical-action approval and the
  door-path style authorisation).
- Audit: `infra.water.meter.create/update/retire/replace`, `infra.water.reading.manual/undo`, `infra.water.calibration/undo`,
  `infra.water.settings.update`, `infra.water.enabled`, `infra.water.alerts.update`, `infra.water.event.ack/mute`,
  `infra.water.export` - ids and field names only.
- Backup: the 0152 main tables join `backup.PROJECT_TABLES` through the water backup module (the `energy_backup.py` allow-list
  pattern); `water.db` optional (`water.include_history_in_backup`, default off); `daily` always exported as JSON; restore keeps
  the live-meter uniqueness.
- Rate limits: CSV export 10 / minute / user; manual readings 60 / hour / user.

## 11. Tests plan

- Backend (fixtures and fake entities only, tier L for slice 1): the medium-profile characterisation (energy tables, routes and
  API inventory unchanged); the validation matrix of 4.4 (flow rate refused, gas refused with its own code, gallons / ft³ factors
  exact in mL); counter rules on litres (reset, noise 20 L, spike-and-return, persisting jump, replacement epochs, 10-minute and
  3-day gaps lose nothing); daily totals per local date across a DST night; manual readings and calibration (0058 rules);
  retention per class; backup with / without history; the module switch (off = `module_off` on every route but `/status` and the
  settings, no thread, no source; on = sampler starts, no backfill; off again = resolved `alerts_disabled`, tables kept, audited);
  permissions matrix (viewer / operator / site_admin / kiosk / custom role; `source_ref` hidden without manage); the tab gate
  through `/status`; load (200 fake meters, one reading per 10 s for a simulated day, flush < 50 ms per minute, the main write
  gate never taken by the sampler).
- Slice 2: the rule table (night flow needs N consecutive buckets, a single bucket does not fire; irrigation default off;
  abnormal needs a baseline; burst at once; a silent available meter is not offline), holds (quiet / mute / off still logged),
  one row per meter and kind, close conditions, recipients intersected with visibility, the catalogue defaults, the ticket
  action absent while the tickets module is off.
- Frontend node-only: the tab gate (`applyInfraWater`), `INFRA_WATER_PAGES` in `ui.tabs`, the unit formatter (L / m³ thresholds,
  Hebrew units, tabular numbers), the chart data (night share), the strings (he complete, en complete, ar / ru dev-marked, no
  platform branding).
- Playwright evidence (`tests/evidence-infra-water.spec.ts`): desktop / tablet / phone, light / dark, the four skins on the meters
  page; states loading / empty / error / off / forbidden; `docs/design/evidence/infra-water/`.

## 12. Build notes for the implementer (slice 1)

1. Extract the medium profile from `energy_store` / `energy_sampler` / `energy_counter` / `energy_settings` first, with the
   characterisation test green, before any water file exists.
2. `services/water_meters.py`, `routers/water.py`, `services/water_backup.py`, migration `0152_infra_water.sql` (PROVISIONAL;
   renumber at integration; one file).
3. Frontend: `screens/infra-water.ts` (the `infra-electricity.ts` shell: page row, pair chip, forbidden / empty panels),
   `screens/water/page-meters.ts`, `page-consumption.ts`, `water/access.ts` (`/status`), `api/water.ts` (+ demo mock), `i18n/water.ts`,
   the settings section `water/water-settings.ts`, the permission rows.
4. Hours (agent): slice 1 ~22-28, slice 2 ~10-14, slice 3 ~16-20 if approved.

## 13. Owner questions (recommendation first)

1. **Q1 Billing water to tenants (slice 3).** (a) **Recommended: not now** - slices 1 and 2 first; the billing engine is reused
   later with a `medium` on the account if wanted. (b) Yes, plan slice 3 in the same release train. (c) Never - drop `water.bills`.
2. **Q2 Gas on the same model.** (a) **Recommended: reserve only** (the `medium` column, the gas refusal message), no gas screens
   until a gas meter exists in the installation. (b) Build the gas tab now behind the same switch. (c) Separate CR later.
3. **Q3 Leak alerts on by default once the module is on.** (a) **Recommended: yes** (night flow + burst on, abnormal on; the
   temperature module's holds). (b) Off by default like the elevators (the owner turns each rule on). (c) Only night flow on.
4. **Q4 Viewers.** (a) **Recommended: viewers do NOT get `water.view` by default** (consumption is personal data; operators and
   up see it). (b) Viewers see it too, like `energy.view`.
5. **Q5 Floor scope.** (a) **Recommended: apply `ha_scope`** (a floor viewer sees only meters whose entity he may see; invisible =
   uniform 404, the temperature rule). (b) Installation scope only, like electricity.
6. **Q6 Automatic shut-off on a leak** (a valve entity). (a) **Recommended: not in this CR** - never actuate; the alert is the
   product. (b) Record a separate CR for a manual "סגירת ברז" action with the door-path style authorisation.
7. **Q7 Home screen.** (a) **Recommended: one KPI tile only while a leak is open** (zero noise otherwise). (b) A configurable
   water widget (consumption today, like the elevators' widget). (c) Nothing on the home screen.
8. **Q8 Night window and threshold defaults.** (a) **Recommended: 01:00-05:00, 6 L/h over 2 hours** (catches a running toilet
   ~10-20 L/h, ignores a dripping tap). (b) 00:00-06:00, 3 L/h. (c) Owner's own numbers.
9. **Q9 Irrigation meters.** (a) **Recommended: night rule off by default for `kind = irrigation`**, abnormal and burst on.
   (b) All rules on for every kind.
10. **Q10 Consumption units.** (a) **Recommended: m³ with 3 decimals, litres under 1 m³** (the water bill's unit). (b) Litres
    everywhere. (c) m³ everywhere.

## 14. Decisions, contradictions and deviations recorded

| # | Decision / deviation | Why |
|---|---|---|
| D1 | The energy modules are parameterised by a medium profile, not copied | "the SAME model" (owner); one counter rule set, one bug fixed once; gas joins free. Risk: a refactor of a released module - mitigated by the characterisation test (section 11). |
| D2 | Own tables (`water_*`) and own file (`water.db`), not rows with a `medium` column inside the energy tables | the energy backup allow-list, the electricity screens and the billing engine assume one medium; separate tables keep the released module untouched and let the module switch drop cleanly |
| D3 | Stored unit millilitres, API litres | gallons and cubic feet are not integer litres; the energy store stores integer Wh for the same reason |
| D4 | Stale threshold 120 min (energy 60) and "offline" only with an unavailable entity | water meters report on change; a still meter is normal for hours |
| D5 | Leak alerts on by default (Q3) deviates from the elevators (off) and follows the temperature module | a leak is the reason to add water meters; a silent module hides the value |
| D6 | No actuation at all | AGENTS.md physical-systems rule; a valve is a separate approved CR |
| D7 | Module switch default OFF (owner standing rule for new modules) | the electricity module has no switch (it hides without meters); water gets one and the off panel |
| C1 | CR-023 §3 said "water and generators later as siblings" of "חשמל" - this CR makes "מים" a sibling of "מוני חשמל" in `INFRA_TABS`, the label the released tab carries | recorded, not a conflict |
| D8 | Slice 2 has its OWN provisional migration file (0153 here) instead of appending to 0152 (section 4.2 said one file) | the lead's instruction for pilot/WATER78B-295: slice 1 is already integrated as 0150 on release/2140, so its file can no longer change; 0153 becomes 0152 there |
| D9 | Routing per alert kind is stored as `water_alert_settings.kinds_json` (the temperature module's shape) instead of a `water_alert_recipients` table | one row, one revision, the same validation and policy mirroring as the temperature module; no per-meter recipient list in this slice |
| D10 | One source `water.leak` carries both the night-flow warning (sent at severity `alert`) and the alarms (burst, a whole night - `critical`) through the signal's severity | the owner's rule "leak = alert, burst / continuous long = may be critical"; one notification per alert row, which re-notifies when it turns into an alarm |

## 15. Slice 2 as built (pilot/WATER78B-295, from pilot/WATER78-295 @ 95e44558; backend only)

Status: BUILT on the branch, backend only (no frontend, no device command of any kind). Owner decisions 2026-10-23 applied: alerts ON by
default once the module is on (Q3), viewers without `water.view` (Q4), floor scope (Q5), never an actuation (Q6), the home tile only while
a leak is open (Q7), 01:00-05:00 with 6 L/h over two hours (Q8), the irrigation night rule off (Q9), m³ / litres (Q10).

- **Migration `0153_infra_water_alerts.sql` (PROVISIONAL; 0152 on release/2140 - the lead renumbers)**: `water_alert_settings` (one row of
  installation defaults + `kinds_json` routing), `water_alert_events` (the alert log; a partial unique index keeps ONE open row per meter and
  kind), `water_alert_state` (the evaluator's per-meter cursor = the last 15-minute bucket judged), `water_meters.muted_until / muted_by`.
  Per-meter overrides use `water_meters.rules_json` (0152). The settings row joins the backup (water_backup.MAIN_TABLES); the log and the
  cursor are history and do not.
- **Evaluator `services/water_runtime.py`** on the janitor (main.janitor_tick), once per closed bucket (90 s grace), module-gated, clock
  injectable (`water_runtime.clock` / `now=`). Rules exactly as section 9: night flow (N consecutive buckets >= the threshold inside the
  window; a warning; an alarm when the whole window flowed - the alarm stays until a still bucket closes, a warning ends at a still bucket
  or at `night_to`; one row per night window), abnormal (today so far > factor x the same-weekday median over `baseline_days`, strictly, and
  > `abnormal_min_l`; no rule under 7 days of age or without a baseline day; ends with the day), burst (any bucket since the cursor above
  `burst_lph` = `max_flow_lph`; an alarm at once; ends when the latest bucket is back at or below), not reporting (silence >= `offline_min`
  AND the entity unavailable / unknown / gone). A paused or retired meter's rows end with a stated reason. Sensor health (battery /
  signal) is NOT built in this slice.
- **Notifications** through the existing pipeline as new sources `water.leak` (critical in the catalogue; push + app), `water.abnormal`
  (alert; push), `water.offline` (alert; inbox), category `device_faults`, recipients rule `water` (leak: operators + site / system admins;
  the rest: the admins), subject kind `water` (water.view on the meter, floor-scoped, only while the module is on). Deduplicated by the
  alert row (dedupe key `source:row id`): one notification per row that folds, re-notifies when it becomes an alarm, resolves when the row
  closes. The pipeline's quiet window, severity pass-through and delivery are untouched; the module's own holds (quiet hours - off by
  default, mute 15/30/60/120 min, alerts off) hold WARNINGS only and log `suppressed`; alarms only with `quiet_includes_alarms` /
  `mute_includes_alarms`. The water sources are listed in the policy matrix only while the module is on; switching the module off resolves
  every open row and its notification with `alerts_disabled`.
- **API** (all `module_off` while off): `GET /events?state=open|all&kind=&meter_id=` and `GET /events/summary` (water.view, floor-scoped;
  KPI row + `home_tile {show, leaks, link}` honouring `water.home_kpi`), `POST /events/{id}/ack` (water.ack on the meter; acknowledges the
  notification too; audited `infra.water.event.ack`), `POST|DELETE /meters/{id}/mute` (water.ack; audited), `GET /alerts` (water.manage) /
  `PUT /alerts` (system.configure; audited `infra.water.alerts.update`), `PATCH /meters/{id}` accepts `rules` (water.manage). New setting
  `water.home_kpi` (true, water.manage).
- **Not built in slice 2**: the frontend (the **התראות** page, the settings section, the home tile), `GET /events.csv`, sensor health, the
  ticket action from an open leak alert, per-meter recipients.
- **Tests**: `tests/test_water_alerts_s2.py` (each rule at its exact threshold, irrigation default and override, dedup, holds, ack,
  permissions and floor scope on the log and the recipients, module off, restart persistence, the catalogue); `test_water_meters_s1.py`
  (the provisional-number test now expects 0152 + 0153) and `test_notify_core.py` (the water sources are gated like the ticket sources).

## 16. Owner review 24.10 - mockup revision 4 (decisions recorded)

Source: owner's review of the 11 mockups, 2026-10-24 (`private/planning/OWNER_MOCKUP_REVIEW_2026-10-24_raw.txt`, item 1). Water v3 is
approved; **revision 4 was APPROVED by the owner on 24.10, with one correction: shared billing settings (VAT, business details,
retention) are reused from electricity, not repeated for water**. Revision 4 (`docs/design/mockups/water-78/index.html`) adds what the real electricity module already has.

- **Q1 (billing) is answered YES, and "tenant billing / chargeback" is needed.** Slice 3 of section 2 is now in scope: what was built
  for electricity must exist for water. This reverses the section 13 recommendation ("not now"); section 13 Q1 is closed by this
  decision (recorded, not silently resolved).
- **Pages added (level 2 of "מים"):** **חשבונות**, **חיובים**, **לקוחות**, **הגדרות** beside מונים / צריכה / התראות. They mirror
  `electricity/elec-account-list.ts`, `elec-account-page.ts`, `elec-bills-list.ts`, `elec-bill-page.ts`, `elec-customers.ts` and
  `elec-settings.ts` with water content. Implementer's rule is unchanged: the electricity components are reused through the
  medium adapter, nothing is redrawn with its own component.
  - **חשבונות (utility / billing accounts):** a customer + a signed meter formula (+ / minus, so a "general difference - losses and
    leaks" account = the main meter minus every sub-meter is possible) + a tariff + a period (month / two months) + the automatic
    bill mode (none / draft / issue). List (search, tiles, table, phone rows) and an account page with the tabs מצב / היסטוריה /
    חיובים: the meters in the formula with start and current reading, the customer card, the price card, the next bill.
    A stale meter is not counted until it reports again (the electricity rule) and says so on the account.
  - **חיובים (bills and tenant chargeback):** the electricity states טיוטה / הונפק / נשלח / שולם / בוטל, number sequence, issue,
    mark sent, mark paid, correct (a new draft that replaces), void with a reason, PDF. The bill separates water and sewage per
    m³, then VAT.
  - **לקוחות:** customer number, name, address / unit, phone, email, open balance, the customer card; a customer with accounts
    cannot be deleted.
  - **הגדרות (water-specific only):** tariff versions (water price and sewage price per m³, before VAT) and the alerts section below.
    VAT, the business details on the bill, bill numbering, payment terms, retention and the default price entry mode are **NOT
    duplicated**: water billing reuses the shared billing settings that the electricity module already has (system > infrastructure),
    and the water settings page shows a short "shared with electricity" note with a link to them. Implementation: the water
    account / bill code reads `billing_settings` and `vat_rates` as they are; no water copy of those tables or screens.
  - **Permissions (as electricity):** money columns, the bills / customers pages and the customer's phone need the bills permission
    (here `water.bills`, section 8); settings need manage. Operators see accounts and consumption without money.
- **New alert action: snooze ("נדנוד") for X time, X editable in settings.** In the alert log and in the meter card each open alert
  carries a split button: the main part snoozes for the default duration, the arrow opens the list of the configured durations
  (each shows the time it ends). The alert is not acknowledged: it returns when the time ends if the condition persists, and the
  row shows "מנודנדת עד HH:MM" (the tile "מושתקות" is renamed "מנודנדות"). It replaces the hard-coded "השתקה 60 ד׳" of revision 3.
  - Settings (הגדרות > התראות והשהיה): the list of offered durations (add / remove, minutes / hours / days; initial set 15 min, 1 hour,
    4 hours, 1 day), the default for the main button (initial: 1 hour) and the maximum snooze (initial: 7 days, a suggestion to be
    confirmed by the owner). The night-flow rules stay as approved and are not edited there.
  - Permission: `water.ack` (the acknowledge / mute permission of section 8); viewers do not see the action.
  - Backend note for the implementer: the slice-2 alert log's "mute" state becomes "snoozed until"; the duration list, the default
    and the maximum are rows of `water_alert_settings` (one revision with the rest of the routing settings).
- **Control-screen rule (owner, general):** no page scroll on control screens. Revision 4 was measured at 1440 x 900: every page
  fits one screen, including every new page (the chart height, row padding and side cards were tightened for that). Phone width
  lists scroll vertically as lists do; the meter card drawer keeps its internal scroll (unchanged from the electricity card).
- **Evidence:** `private/review/water-78-mockup-v4.html` and `private/review/water-78-v4/` (screenshots, light and dark, desktop and phone).
- **Not decided here (left as proposals in the mockup):** the tariff values, the 18% VAT rate, the bill header and the customer
  fixtures are invented example data; the "maximum snooze" default; whether the "loss" account is offered by default.
