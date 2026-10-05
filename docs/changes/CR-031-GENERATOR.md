# CR-031 — Generator control screen ("תשתיות › גנרטור")

**Status:** DRAFT, phase A revision 2 (owner feedback round: hero power-flow diagram, capability-driven screen, rewritten questions; 2026-10-05). Nothing implemented. No product code, no
migration, no device contact. Branch `pilot/GEN1-generator-mockup` from `origin/main` (2.0.2).
**Numbering:** CR-031 as assigned by the coordinator (CR-028 cast-to-screens is the last one in `docs/changes/`; 029-030
are reserved elsewhere).
**Mockups:** `docs/design/mockups/generator/` (`index.html` = Hebrew review index with the owner questions; `gallery.html`
= the screens). A local copy for the review folder lives in `private/review/generator/` (gitignored).
**Test tier when built:** M for phases B-C (new screen family, read-only), L once control commands (phase D) ship.

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
  controllers (DSE 7x20 / ComAp InteliLite class). The real mapping is fixed by the owner's entity export (§10, Q1).

## 2. Goal
When a generator controller integration is present in the system infrastructure, Arx shows a "גנרטור" tab under
"תשתיות": a live screen (power flow, engine, fuel, battery, coolant, oil, phases, load, mode, last start / test, service
due), active alerts, alert history with filters and an alert detail with acknowledge, and a Settings section that routes
each alert type to roles / users and channels with severity, quiet-hours behaviour and escalation. Commands to the
controller (test run, stop, mode) are a separate, permission-gated phase.

## 3. Scope
**Phase A (done here):** this CR, the mockup gallery, the owner questions.
**MVP (phases B-C-E):** detection, the generic sensor mapping with a per-installation override, the live screen, the
alerts (active, history, detail, acknowledge), routing settings stored and applied through the CR-018 notification
center, states (not found, unavailable, loading), phone layout, tests.
**Phase D (after owner answer Q4):** controller commands with `generator.control`, confirmation, audit.
**Designed for, not built now:** several generators per installation (selector), value history charts, extra thresholds
computed in Arx, a second source (solar / UPS) on the diagram, WhatsApp delivery (follows CR-018 channel availability).
**Out of scope:** writing anything to the controller except the explicit commands of phase D; fuel ordering; maintenance
ticketing (data-store direction note: future module).

## 4. Placement and navigation
- Area "תשתיות" (`#/infra/*`): level-1 tabs become **"מוני חשמל"** and **"גנרטור"** (`INFRA_TABS` gains a second entry, so
  the existing "row of one is not drawn" rule in `infra-electricity.ts` flips naturally). Level-2 pages of the generator
  tab: **"מצב חי"** `#/infra/generator/live`, **"התראות פעילות"** `#/infra/generator/alerts` (with an open count badge),
  **"היסטוריה"** `#/infra/generator/history`. Alert detail: `#/infra/generator/history/<id>` (drawer; bottom sheet on
  the phone).
- Visibility: the tab exists only when a generator is detected (or `generator.manage` is held and detection is pending)
  and the user holds `generator.view`. Without detection the Settings section shows the "not found" card; the area tab is
  hidden entirely for non-managers (an installation without a generator shows nothing, as with meters).
- Settings: the existing tab **"תשתיות"** (`#/system/infra`) gets a second level-1 entry **"גנרטור"** with the strips
  **"ניתוב התראות"**, **"מיפוי חיישנים"**, **"מבחנים ותחזוקה"** (reserved), **"הרשאות"** (link to the permissions tab).
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

## 5. Detection method
Order (mockup "not found" screen explains the same three steps in Hebrew):
1. **By integration domain** (preferred, Q2): the existing infrastructure WebSocket session lists config entries
   (`config_entries/get`) and matches the domain name(s) from a setting `generator.integration_domains` (default: the
   owner's domain once known; a list so a second brand can be added without code). Entities of that config entry come
   from the entity registry (`config/entity_registry/list` filtered by `config_entry_id`), grouped by device.
2. **Generic fallback**: a device (device registry) whose entities include, by `unique_id` / `translation_key` /
   friendly-name patterns, an engine-state sensor, a run-hours sensor and a fuel-level sensor. Patterns live in
   `catalog/generator_patterns.json` (English and Hebrew), the same mechanism as the CR-019 keyword groups.
3. **Manual pick** ("בחירת התקן ידנית", `generator.manage`): any device of the system infrastructure; Arx then maps what it
   can and shows the unmapped roles in "מיפוי חיישנים".
Detection runs at start-up, on `config_entry` and registry events, and on "בדיקה חוזרת". Result (device id, entry id,
domain, mapped roles, last check, last seen) is stored in `generator_devices`; the UI never shows entity ids or device
ids, only display names.

## 6. Data model
Main database, migration **0058 `generator.sql`** (0057 is taken by CR-027; renumber at integration if needed).

| Table | Purpose | Key columns |
|---|---|---|
| `generator_devices` | One row per detected generator | `id`, `name`, `area_id`, `source_kind` ('integration','generic','manual'), `source_domain`, `source_entry_ref`, `source_device_ref`, `rated_kw`, `rated_kva`, `status` ('detected','unavailable','removed'), `detected_at`, `last_seen_at`, `revision` |
| `generator_roles` | The semantic mapping: role → entity | `device_id`, `role` (engine_state, controller_mode, ats_position, mains_available, on_load, rpm, run_hours, starts, coolant_temp, oil_pressure, battery_v, charger_v, fuel_pct, fuel_l, gen_v_l1..l3, gen_a_l1..l3, gen_kw, gen_kva, pf, gen_hz, load_pct, mains_v_l1..l3, mains_hz, last_start_at, last_start_reason, last_test_at, last_test_result, next_test_at, service_hours_left), `entity_ref`, `unit`, `mapped_by` ('auto','manual'), `confidence`, `core` (bool: engine_state, gen_v_*) |
| `generator_alert_types` | The alert catalogue per device (seeded from the built-in list, extended by controller alarms discovered as binary sensors) | `device_id`, `key`, `group` (engine, fuel, electrical, mains, maintenance, comm), `title_he`, `title_en`, `entity_ref` (binary sensor / event source), `builtin`, `needs_json` (roles required; `available` is derived at read time from `generator_roles`) |
| `generator_alert_policies` | Routing per alert type (§7) | `device_id`, `alert_key`, `enabled`, `severity` ('critical','alert','info'), `recipients_json` (`{roles:[...], users:[...]}`), `channels_json` (`['push','app','email','whatsapp']`; `inbox` implicit), `quiet_mode` ('pass','matrix','hold'), `escalate` (bool), `after_s`, `row_version`, updated by/at |
| `generator_alerts` | Alert instances | `id`, `device_id`, `alert_key`, `severity`, `raised_at`, `cleared_at`, `acked_by`, `acked_at`, `ack_note`, `snapshot_json` (the role values at raise time: fuel, battery, coolant, load, rpm, ats, mains), `notification_id` (CR-018 row), `count` (re-raise fold), `last_at` |
| `generator_commands` | Audit of phase D commands | `id`, `device_id`, `command` ('test_start','stop','mode_auto','mode_manual','mode_off','ack_controller'), `requested_by`, `requested_at`, `result`, `result_at`, `error` |

Live values are not stored: the screen reads the existing state mirror (the same read-only path the meters sampler uses).
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
- **Escalation:** per type on/off; minutes and steps are the CR-018 installation settings (shown read-only on the row,
  "5 דק׳ · 2 שלבים"); stops on acknowledge.
- **Acknowledge:** `POST /generator/alerts/{id}/ack` with an optional note; requires `generator.view` plus the row being
  visible to the user; audited `generator.alert.ack`; also acknowledges the CR-018 row (`notify.ack`). "השתקה ל-24 שעות"
  folds re-raises of the same key for 24 h (snooze on the center row).
- **Fold:** the same key raised again while open increments `count`/`last_at` (CR-018 dedupe) instead of a new row; a
  higher severity re-notifies.
- **Resolve:** the clearing of the controller alarm closes the row (`cleared_at`) and resolves the center row.
- Default policies (mockup, Q7): critical → system admins + site admins + the maintenance user, push + app + email, pass
  quiet hours, escalate; alert → site admins + maintenance, push + app, matrix, no escalation; info → site admins, inbox
  only (service due → email to maintenance; mains restored → push).

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
| `GET /generator/policies` / `PUT /generator/policies/{alert_key}` | notify.manage | routing per type; `POST /generator/policies/reset` |
| `POST /generator/policies/{alert_key}/test` | notify.manage | sends a test notification through the center (3/min) |
| `POST /generator/devices/{id}/commands` (phase D) | generator.control | `{ command }`; server checks preconditions (mains available for a test, mode auto) and audits |
| WS `/me/ws` | - | `generator_live` (value changes, 1 s coalesced), `generator_alert` (raise / ack / clear) |
Errors: `generator_not_found` 404, `role_unmapped` 422, `controller_unavailable` 503 (retryable), `command_refused` 409
with the precondition, `revision_conflict` 409.

## 9. Permissions
| Permission | Hebrew label | Meaning | Default roles |
|---|---|---|---|
| `generator.view` | צפייה בגנרטור והתראותיו | live screen, alerts, acknowledge, snooze | operator, site_admin, system_admin |
| `generator.manage` | ניהול הגנרטור (זיהוי, מיפוי) | detection, device pick, role mapping, rated values | site_admin, system_admin |
| `generator.control` | פקודות לגנרטור | phase D commands; **sensitive**, never implied; each command confirmed and audited | none by default (system_admin opts in) |
| `notify.manage` (existing) | - | the routing section | system_admin |
viewer and kiosk get nothing; the area tab is hidden without `generator.view`. Server-side: commands are refused without
`generator.control` regardless of client flags; the HA token is never the user's identity.

## 10. Open questions for the owner (Hebrew, with options and the recommended answer, in `index.html` §8)
Blocking: 1 (entity export: list + domain / read-only access / screenshot; recommended: list + domain), 2 (commands in
v1: yes with permission + confirm / view-only first; recommended: view-only first).
Safe default (build with the recommendation, change later): 3 generators per site (one), 4 who reports the ATS
(controller / separate device / none), 5 fuel type (diesel / gas / other), 6 scheduled test runs (controller schedules,
Arx shows / Arx schedules, needs 2a), 7 maintenance reminders (by run hours / also by date / none), 8 default recipients
(as mocked / admins only / other), 9 alert-history retention (1 year / 90 days / 7 years), 10 WhatsApp (automatic when
the center opens the channel / open the channel now), 11 value-history charts (no / 24 h chart), 12 menu placement
(sibling of "מוני חשמל" / other).
Dropped since revision 1 (answered by the capability-driven design): the sensor list, the thresholds source, the extra
source on the diagram (added when its role appears).

## 11. Test plan
Backend (fixtures and a fake controller only, no device): detection by domain, by generic match, by manual pick, and the
negative case; registry change re-detection; role mapping with units (percent vs litres, bar vs kPa, °C) and unmapped
roles; live payload with `stale` after `generator.stale_after_s`; alert raise / fold / clear from binary-sensor
transitions and from an event-style alarm source; snapshot content; ack / snooze / ack-all with audit; policy save
writing both tables in one transaction, reset to defaults, test send; recipient resolution by role AND scope; quiet-mode
pass / matrix / hold against the CR-018 window; escalation stop on ack; permissions matrix (view / manage / control /
notify.manage; viewer 403; client flags ignored); retention job; backup / restore of the generator tables; phase D
preconditions and refusal reasons.
Frontend (Playwright, 1440 / 820 / 390, RTL, light / dark, four skins on the live screen): live in the four scenarios
(on load, standby, test, unavailable), view-only user, confirm dialog, active alerts (list, empty), history with every
filter, detail drawer / bottom sheet with ack, routing table and edit drawer, not-found and settings-not-found, loading;
diagram not mirrored under RTL; targets ≥ 44 px at 390; no horizontal overflow.
Evidence: screenshots per screen and state under `docs/evidence/generator/`.

## 12. Effort estimate (agent hours)
| Phase | Content | Hours | Tier |
|---|---|---|---|
| **A** | This CR + mockup gallery + questions (done) | 6-8 | - |
| B | Backend detection + entities: migration 0058, detection (domain, generic, manual), role mapping with override, **capability set and core/optional roles, alert-type availability**, live payload over the mirror, stale handling, devices / roles API, permissions, audit, backup | 14-18 | M |
| C | Live screen: area tab, three pages shell, **capability-bound rendering**, the v2 power-flow component (horizontal, vertical, compact; animated with reduced-motion fallback), gauges, phase table, engine card, mode card (display only), states, phone layout, four skins | 16-20 | M |
| D | Alerts: raise / fold / clear engine from the mapped sources, snapshots, active list, history with filters, detail with timeline, ack / snooze / ack-all, WS events, retention | 10-14 | M |
| E | Routing settings: policies table + CR-018 policy bridge, **availability by needs**, settings screens (table, edit drawer, defaults, test send), detection card with counts, mapping screen (basic) | 10-13 | M |
| F | Tests + evidence + Hebrew guide + bilingual release notes | 6-8 | M |
| **MVP (B-F)** | | **56-73** | one M release (L if shipped with phase G) |
| G | Controller commands (`generator.control`): preconditions, confirm, audit, UI actions live | 6-9 | L |
| H | Several generators, value history charts, extra thresholds | 10-14 | M |
Dependencies: the owner's entity export (Q1) before B starts; CR-027 app channel merged for the `app` channel chip to be
live; CR-018 center as the delivery path.

## 13. Phase A record
- Built: `docs/design/mockups/generator/` (index, gallery, 20 screens x 3 widths x 2 themes x 4 skins, a before/after page for the diagram), this CR.
- Revision 2 (owner feedback): v2 power-flow diagram as a hero component (v1 kept only on the before/after page), capability-driven rendering with minimal / typical / full scenarios, alert types gated by `needs`, questions rewritten with recommendations and blocking / safe-default marks.
- Lab access: one read-only `GET /api/states` listing to look for a generator integration (none found); no write, no
  entity shown here; no IP, token or id left in any file.
- No product file, migration, setting or permission was changed.
