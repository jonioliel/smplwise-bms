# CR-EMERG104 - Emergency readiness view ("מוכנות לחירום"), an appendix of the certificates and inspections ledger

Status: OWNER ANSWERED 2026-10-24 (all 9 questions; section 14) - BUILD STARTED on `pilot/EMERGREADY104-295` from `origin/release/2150`. Original: PROPOSED, change record only. Board row r104. Branch `pilot/EMERG104-295` from `origin/main` @ `320e55551` (v2.12.4).
Module switch `emergency_readiness.enabled`, **OFF by default**. Migrations: **none expected** (section 9).
Builds on, and must not duplicate: `CR-MAINT215` (ledger, `pilot/MAINT215-295`, not yet on main), `CR-READY96` (readiness-score design, `pilot/READY96-295`,
not yet on main), `CR-031-GENERATOR`, `CR-INFRA-ELEVATORS`, `CR-039-DOOR-WINDOWS-AND-EMERGENCY`, `CR-026-NVR-HEALTH`, `CR-018-NOTIFICATIONS`,
`services/health_report.py`, `services/backup_drill.py`, `services/backup_offbox.py`.

## 1. Goal and non-goals

One read-only page, "are we ready for an emergency right now?", that a building manager, a safety officer or an inspector can open and read in ten seconds:
a single verdict (ready / ready with gaps / not ready) and a short checklist, every line stating what was checked, the measured fact, how old that fact is,
and where to go to fix it.

It is a **lens, not a data source.** Every line is computed from a signal the product already stores or reads. This CR adds no sensor mapping, no
polling, no device read, no table, no notification pipeline, and no new attestation. Where the product does not know something, the line says so
("לא ידוע"), it never shows green.

Non-goals (explicit):
* **No action from this page.** No button here operates a door, a generator, an elevator, a fire panel or a relay. The emergency lock / open controls of CR-039
  stay on their own screen with their own sensitive permissions; this page only reads their state and links to them.
* No fire-panel / sprinkler-controller integration, no life-safety certification claim (the CR-039 section 8.9 statement applies here too, and the print says so).
* No new data collection: no emergency-contact table, no checklist of the manager's own, no GPS, no photos.
* No new notification source in v1 (each underlying item already alerts through its own source; section 7.2).
* Not a replacement for the READY96 installation score. READY96 asks "is the installation finished and handed over"; this page asks "is the building
  safe to rely on tonight". They share the idea (checks, status, facts, next step, weights-in-code) and none of the aggregation: this verdict is
  worst-item-wins, not a weighted percentage (a 92 % that hides a dead generator is the wrong answer to this question).

## 2. The verdict

Each item has a status: `green`, `amber`, `red`, `unknown` (no data / not configured / source off or stale) or `not_applicable` (the building has no such
equipment: an explicit, audited choice, section 4.3). Each item is **critical** or **supporting** (column in section 3).

    NOT READY            any critical item red
    READY WITH GAPS      no critical red, but any critical item amber/unknown, or any supporting item red/amber
    READY                every applicable critical item green, no supporting item red

`unknown` on a critical item is never "ready": the verdict is at best "with gaps" and the line reads "לא ניתן לאמת". An item the caller may not see
(section 5) counts in the verdict but its row is replaced by "פריט שאין לך הרשאה לראות - משפיע על התוצאה"; the verdict therefore never looks better to a
narrow role than to an administrator. Every row and the verdict carry `checked_at`; a signal older than its own freshness limit (column "stale after")
downgrades to `unknown`. The page recomputes on open and every 60 s while shown; nothing is stored.

## 3. The checklist: items, sources, rules

Thresholds below are the **defaults**, kept in one table in `services/emergency_readiness.py` (versioned with the code) and overridable per installation
through one settings value `emergency.thresholds` (JSON, `maintenance.manage`), so a local fire-code interval can be entered without a release (question 4).
"Ledger" = a `maint_tasks` row (CR-MAINT215) bound to the slot (section 4.2); its state is the ledger's own maths (valid THROUGH the date; `due_soon` = inside the
task's lead days). `validity` below means: the ledger task's derived state.

| # | Item | Crit. | Source (existing signal) | Green | Amber | Red | Stale after |
|---|---|---|---|---|---|---|---|
| **A. Power** | | | | | | | |
| E01 | Generator tested recently | yes | `generator_roles` `last_test_at` / `last_test_result` of each detected generator (CR-031), else the completion date of the ledger task linked by `generator_id` (category `generator`) | last test <= 35 d and result ok | 35-60 d, or result unmapped but the ledger completion is within 60 d | > 60 d, last result failed, or no test ever recorded | roles: 36 h (controller silent); ledger: n/a |
| E02 | Generator fuel and state | yes | live roles `fuel_pct` / `fuel_l`, `engine_state`, `controller_mode`, `battery_v`; open rows of `generator_alerts` | fuel >= 50 %, mode auto/standby, battery in range, no open alert | fuel 25-50 %, mode manual, battery low, any open non-critical alert | fuel < 25 %, mode off, engine fault / shutdown, any open critical alert | `generator.stale_after_s` (existing); stale = `unknown` |
| E02b | Mains / ATS position (information) | no | roles `mains_available`, `ats_position` | mains on or ATS normal | - | generator carrying the load (shown as "פעיל עכשיו", amber, not a fault) | same |
| **B. Fire safety and mandatory inspections** | | | | | | | |
| E03 | Fire-safety certificate(s) valid | yes | ledger, kind `certificate`, category `fire`, slot `fire_certificate` | `ok` | `due_soon` | `overdue` (expired) or no task bound | n/a |
| E04 | Fire extinguishers checked | yes | ledger slot `extinguishers` (kind `certificate` or `preventive`) | `ok` | `due_soon` | `overdue` / unbound | n/a |
| E05 | Hydrants / sprinklers checked | yes | ledger slot `hydrants_sprinklers` | `ok` | `due_soon` | `overdue` / unbound | n/a |
| E06 | Emergency lighting and exit signs checked | yes | ledger slot `emergency_lighting` | `ok` | `due_soon` | `overdue` / unbound | n/a |
| E07 | Evacuation round done | no | ledger kind `round` slot `evacuation_round`: last finished run (`maint_records`) | last run done within its interval, result ok | run with `issues`, or `due_soon` | `overdue` | n/a |
| E08 | Open fire-safety requests | no | tickets module (only when on): open requests whose department/category is the one bound to the fire slots (reuses the ledger's request ids on the task) | none | open, not past SLA | open past SLA | live |
| **C. Elevators** | | | | | | | |
| E09 | Elevators: fire-service inspection valid | yes | ledger slot `elevator_inspection` per elevator (`maint_tasks.elevator_id`) | all `ok` | any `due_soon` | any `overdue` / an elevator with no task | n/a |
| E10 | Elevators: monitoring live and healthy | no | `services/elevators.py` derived state per elevator (CR-INFRA-ELEVATORS); `stale` flag | all `waiting` / `active`, sensors live | any `door_open`, or one `out_of_service` | any `fault`; the mirror disconnected is `unknown`. `fire_service` **on right now** is shown as a banner "פיקוד כבאים פעיל - אירוע בעיצומו", not as a defect | 15 s tick (existing) |
| **D. Doors (read only)** | | | | | | | |
| E11 | Door emergency controls ready | yes (only when the CR-039 module is on) | `doors.emergency.*` settings, `door_emergency_attestation`, WisKey feed state (`intercom_sync.STATE == ready`), `door_emergency_incidents` (drill rows) | module on, attestation recorded, feed `ready`, last drill (incident with `drill = 1`) <= 180 d | feed `ready` but last drill 180-365 d or none | feed not ready (`ha_unavailable`, `error`, `connecting` > 10 min), or attestation missing while a control is enabled | feed: 30 s |
| E12 | No unresolved door fault or open emergency incident | yes | `door_window_occurrences` in `relock_unconfirmed`, `door_emergency_incidents` not `released` and `drill = 0` | none | - | any (an unreleased real incident shows as "אירוע חירום פתוח" with its start time; the page links to the doors screen, nothing else) | live |
| **E. People** | | | | | | | |
| E13 | Emergency contacts reachable | yes | derived, not stored: the recipients of the critical-severity notification policies of the sources E02/E10/E11/E12 and `recorder.*` (`notify_policy`), each resolved to a user and a channel; reachability from `notify_known_devices` (push), the WhatsApp consent/link state, the e-mail address, plus the last successful per-user test (`notification_deliveries`, status `sent`) | every critical source has >= 2 recipients and each has a channel with a successful delivery/test <= 30 d | a source with exactly 1 recipient, or a recipient with a channel never tested | a critical source with no recipient, or no reachable channel at all (the generator routing starts empty by owner decision: this item is what makes that visible) | 30 d |
| E14 | Service suppliers reachable | no | ledger tasks of the fire/elevator/generator slots carry `vendor_id` -> `ticket_contacts` (kind `vendor`, active, phone or e-mail present) and `maintenance.vendor_status` (documents: insurance not expired) | each linked supplier active, with a contact route and valid documents | a supplier with an expired non-critical document | a linked supplier inactive / erased / no contact route | n/a |
| **F. Delivery and records** | | | | | | | |
| E15 | Notifications are being delivered | yes | `notification_deliveries` over 7 d for sources of severity `critical`/`alert`: failed+gone / (sent+failed+gone); `notify_outbox` backlog age; READY96 `notifications` check when it exists | failure rate < 5 % and no backlog older than 10 min | 5-20 % or a channel with no success in 7 d | > 20 %, or backlog older than 1 h | live |
| E16 | Backup healthy | yes | `health_report` `backups` (age), `services/backup_drill.py` (restore drill passed), `backup_offbox` (a tested off-box target) | local backup <= 2 d, drill passed <= 180 d, an off-box target tested <= 30 d | backup <= 7 d, or drill/off-box missing | no backup, or backup > 7 d | backup list: live |
| **G. Cameras and recording** | | | | | | | |
| E17 | Recorder(s) up and recording | yes | `health_report` `nvr`, `go2rtc`; `recorder_health` (reachable, disk state, recording exception) per recorder | all reachable, disks ok, no recording exception | disk read-only/locked, one recorder slow | any recorder unreachable, disk error/missing, recording exception, or `go2rtc` down | recorder health: 2 min |
| E18 | Cameras online | no (critical for cameras flagged "emergency" if question 6 is accepted) | `cameras.status` online / enabled; the existing offline notification state | >= 95 % | 80-95 % | < 80 %, or any camera on the emergency list offline | live |
| E19 | Time and clock | no | `health_report` clock checks (`recorder_clock`), `time.zone` | drift within limits | drift above the existing amber limit | above the existing red limit (video evidence timestamps unreliable) | per source |

Notes:
* E01/E02 read the same generator state as the generator screen; for a building with several generators each is a sub-line and the item takes the worst.
* A building without a generator, without elevators or without the doors module marks the item `not_applicable` (section 4.3) or it is hidden automatically
  when the source module is off **and** the manager has recorded the choice; an item is never silently dropped.
* E13 deliberately avoids a new "emergency contact list": it asks whether the people who *would be told* can in fact be reached (question 3).

## 4. Configuration (no new data store)

### 4.1 Module and dependencies
`emergency_readiness.enabled` (setting, off by default, audited `emergency_readiness.module.enable|disable`, `system.configure`). With the switch off every
route is a uniform 404 `feature_disabled` and no worker runs (there is none; the view computes on request). It works with `maintenance.enabled` off, but then
E03-E07, E09 and the supplier line E14 are `unknown` with the line "יומן התעודות כבוי" and the verdict cannot be READY.

### 4.2 Binding ledger tasks to slots
Slots are a closed list in code: `fire_certificate`, `extinguishers`, `hydrants_sprinklers`, `emergency_lighting`, `evacuation_round`, `elevator_inspection`
(per elevator). The binding is one settings value `emergency.slots` = `{slot: [task_id, ...]}`; an item is the worst state of its bound tasks. The page
**suggests** bindings (a task of kind `certificate` in category `fire` is offered for `fire_certificate`, `electrical` / `safety` for lighting, the task whose
`elevator_id` is set for `elevator_inspection`) and a `maintenance.manage` holder confirms them once. No column is added to `maint_tasks` (a closed `subtype`
column would be cleaner but means a migration on a table that MAINT215 owns; question 5).

### 4.3 "Not applicable"
`emergency.not_applicable` = `{item_id: {by, at, note}}`, set by `maintenance.manage`, audited `emergency_readiness.na.set|clear`, shown on the page with
the person and date ("אין גנרטור במבנה - אושר ע״י ... ב-...") so an inspector sees the claim, not a missing row.

## 5. Permissions (per item) and isolation

No new permission key (question 2). The page is an **installation-level** view, as the ledger's placeless tasks are.

| What | Needs |
|---|---|
| Open the page, read the verdict and the rows | `maintenance.view` at the installation (the ledger's own read permission; the page is its appendix) |
| A row's *detail* (facts, values, names) | the source's own read permission, otherwise the row is redacted as in section 2 |
| E01, E02, E02b | `generator.view` |
| E03-E07, E09 (ledger side), E14 | `maintenance.view` (the ledger visibility rule: a placeless/installation task needs installation scope) |
| E08 | `tickets.view` scope-filtered; redacted otherwise (counts only) |
| E10 | `devices.read`, scoped by `ha_scope` exactly as the elevators screen (an elevator with no visible sensor is not described; the page says "N מעליות לא מוצגות" without naming) |
| E11, E12 | `access.stations.read` (the CR-039 read audience); no door name, person or card appears, only counts and the worst state |
| E13 | `notify.manage` for the per-recipient detail; others see only the source-level status ("ל-3 מקורות קריטיים יש נמענים בני-הגעה") - never a phone number or e-mail |
| E15 | `notify.manage` for the detail; counts for others |
| E16 | `backup.manage` for detail; others see "גיבוי: תקין / לא תקין" |
| E17, E18, E19 | `system.configure` or `devices.read` for the rows; recorder addresses/serials are never shown (the lab-private rule) |
| Set slots, thresholds, not-applicable | `maintenance.manage` (installation scope) |
| Module switch | `system.configure` |
| Print/PDF export (later slice) | `maintenance.view` + the rows' own permissions: the PDF contains only what the exporter may see, and says "פריטים שהוגבלו: N" |

Order of every route: signed-in -> module switch (404 `feature_disabled`) -> permission (audited 403) -> row redaction. Arx RBAC is the only authority;
no client flag, HA flag or WisKey claim widens anything. Viewer, kiosk and editor roles: default deny. An explicit deny on the chain wins, as in the ledger.
Not sensitive in the CR-039 sense (read-only, no physical action); recorded so the owner can say otherwise.

## 6. API (all under `/api/v1`, read-only except the three configuration writes)

```
GET  /emergency-readiness                 -> { verdict, counts{green,amber,red,unknown,na,hidden}, items[], banners[], checked_at, thresholds_version }
GET  /emergency-readiness/items/{id}      -> one item with its facts and source links (redacted per section 5)
GET  /emergency-readiness/config          -> slots, suggestions, not_applicable, thresholds       (maintenance.manage)
PUT  /emergency-readiness/config          -> partial update, revision-guarded, audited              (maintenance.manage)
GET  /emergency-readiness/report.pdf      -> LATER SLICE (section 8)
```
Item shape: `{id, group, critical, status, summary, facts[], source{label, href}, age_s, fresh, next{label, href}, redacted}`. `banners[]` carries live states that
are events, not defects (fire service active, a real emergency incident open, generator carrying the load). `next.href` is a deep link to the screen that fixes
the item (the READY96 idea); the page never performs the fix.

Audit: `emergency_readiness.module.enable|disable`, `emergency_readiness.config.update`, `emergency_readiness.na.set|clear`, `emergency_readiness.report.export`,
and every refusal. Reading the page is not audited per request (it would flood); the PDF export is.

## 7. Behaviour details

7.1 **Single read path.** One service function calls the existing readers in-process (generator live payload, elevators derived state, health report cached
copy, recorder_health view, backup list/drill, notification delivery aggregates, ledger task states). It never starts a device probe: `health_report` is called with
`probe=False` / its cached value, and the page shows that value's age. A "בדוק עכשיו" button, if wanted, would call the existing rate-limited recompute endpoints
and is out of v1.

7.2 **No new alerts.** Every red/amber here already has its own notification source (generator, elevator, door, recorder, backup, maintenance due/overdue).
A "readiness changed to NOT READY" notification would be a second alert on the same cause; it is proposed only as a daily digest in slice 3 and only if the owner
asks (question 7).

7.3 **Dates** follow the ledger rule: local calendar dates in `time.zone`, instants in UTC, an injectable clock for tests.

7.4 **Cost.** All inputs are in-memory or indexed reads already served to other screens; the delivery aggregate is one indexed query over 7 days
(`idx_notification_deliveries_time`). Target < 150 ms server time; the page caches the computed payload for 15 s per principal-visibility class.

7.5 **UI** (slice 2, mockup first, owner approval before build): page head with the verdict as a solid badge (colour plus a word and an icon, never colour alone),
the banner strip for live events, a six-group checklist with one row per item (status disc, title, "קריטי" chip, measured sentence, age, source link),
the KPI row as filters (all / red / amber / unknown / not applicable), phone layout, he/en first. Operator-clean: no paragraphs, short sentences. Placement:
a tab of the maintenance screen ("מוכנות לחירום") and, if the owner wants, an optional home tile showing only the verdict word.

## 8. Print / PDF for inspectors (later slice)

One A4 page generated locally (Noto fonts, same engine as the electricity bill and READY96 handover report): building name, date/time and zone, the verdict, the table
of items with status, measured fact and "valid until" for ledger items, the signature line "נבדק ע״י ____", the footer "הופק ב-SmplWise Arx x.y.z" and the
life-safety statement ("הדף משקף נתונים שנאספו במערכת, אינו אישור ציות רגולטורי"). Content = what the exporter may see (section 5). Items the manager marked
`not_applicable` print with the name and date of the confirmation. No names of residents, no phone numbers, no recorder/camera addresses, no serials. Optional
(question 8): attach copies of the certificates once the ledger's file slice exists; v1 prints references only.

## 9. Data model and migration

None expected. Reads: existing tables/services only. Writes: three `settings` keys (`emergency_readiness.enabled`, `emergency.slots`,
`emergency.not_applicable`, plus `emergency.thresholds`) - four values, no schema. Backup: settings are already in project backups; nothing to add.
Rollback = switch off (data kept, routes 404). Two dependencies that could force a migration are named so nobody is surprised: (a) a closed `subtype` column on
`maint_tasks` (question 5, not recommended); (b) a persisted verdict history (question 7b, not recommended).

Dependency risk: MAINT215 and READY96 are not on main (`pilot/*-295` branches). This CR assumes MAINT215 slice 1 is integrated first; if it is not, items E03-E07, E09,
E14 stay `unknown` and slice 1 ships the other items. No import of READY96 code is required (its notifications check, when present, is read through the same
delivery table).

## 10. Tests plan

File `smplwise_vms/backend/tests/test_emergency_readiness_295.py` (negative first):
* Module off by default; every route 404 `feature_disabled`; switch audited and `system.configure` only.
* Permission matrix per row (section 5): viewer/kiosk/editor denied; operator sees ledger rows but not backup/notification detail; redaction text present and the
  verdict identical for an administrator and a narrow caller; a denied item still counts.
* Item rules by table: for each of E01-E19 a boundary test at every green/amber/red edge with an explicit clock (35 d / 60 d, fuel 25/50, backup 2 d/7 d, failure rate
  5/20 %, camera 80/95 %); stale source -> `unknown`; missing source module -> `unknown`; `not_applicable` shown with person and date.
* Verdict: worst-critical-wins, supporting items never turn NOT READY into READY, unknown critical never READY.
* Live events are banners, not defects: fire service on, a real incident open, generator carrying the load.
* Read-only guarantee: the service imports no device-write path (static check), no route other than the three config writes mutates, a call under a fake recorder/WisKey/HA
  records zero outbound writes; the audit log has no row after a page read.
* Elevators floor scope: an elevator with no visible sensor is not described and not counted by name.
* E13 never returns a phone number, e-mail or token (response scanned); a source with no recipients is red.
* E15 aggregation from seeded `notification_deliveries`; backlog age from `notify_outbox`.
* Config: revision conflict, slot suggestions, binding a foreign/deleted/invisible task refused (uniform 404), thresholds validation.
* Frontend node specs: strings (he/en complete, no HA/infrastructure branding outside `screens/system-*`), badge has word+icon, KPI filters, redacted row, empty states.
* Evidence: the page in READY / WITH GAPS / NOT READY / module-off / forbidden / loading at 1366 and 375, light and dark (slice 2).
* Live (owner's lab, read-only, task-specific approval): compare the page against the generator, elevators, backup and recorder screens by hand; confirm zero writes.
  Not run in this CR.

## 11. Slices and estimates

| Slice | Content | Estimate |
|---|---|---|
| S1 | `services/emergency_readiness.py` + routes + settings + permission redaction; items E01-E02b, E09-E12, E15-E19 (live signals only, independent of MAINT215); tests | 2 days |
| S1b | Ledger-backed items E03-E08, E14 and the slot binding/suggestions (needs MAINT215 integrated) | 1 day |
| S2 | E13 (reachability) and the UI: mockup, approval, screen, banners, KPI filters, not-applicable dialog, he/en strings, evidence | 2 days |
| S3 | Print/PDF for inspectors; optional daily digest if approved; user-guide page and API inventory | 1.5 days |

Tier M (read-only). Target: S1/S1b with the maintenance bundle follow-up, S2/S3 the release after the owner approves the mockup.

## 12. Risks

* **A false green is the worst outcome.** Mitigations: unknown never green, stale downgrades, hidden rows still count, every row prints its source and age.
* **Ledger slots are manual.** A manager can bind the wrong task or forget one; the page shows the bound task titles and valid-until dates so a reader can see
  it, and unbound critical slots are red, not omitted.
* **Thresholds are local law/practice.** Defaults are conservative guesses, not regulation; the print says so and the owner can override them (question 4).
* **Legal reading.** An inspector may take the print as a compliance statement; the printed disclaimer and the absence of any "approved" wording are part of the scope.
* **Dependency on unmerged branches** (section 9) and on the owner's mapping of generator roles (`last_test_at` may be unmapped on a given controller: E01 then
  falls back to the ledger, else `unknown`).

## 13. Open owner questions (recommendation first)

1. **Placement and default visibility.** (א) A tab of the maintenance screen, off by default, no home tile - **recommended**. (ב) Also a home tile with only the verdict word.
   (ג) A standalone infrastructure page.
2. **Permissions.** (א) No new key: page = `maintenance.view`, rows redacted by each source's permission, config = `maintenance.manage` - **recommended**
   (the verdict never looks better to a narrow role). (ב) A new `emergency.view` key so a safety officer can see it without the ledger.
3. **Emergency contact list (E13).** (א) Derive it from the recipients of the critical notification policies and test their reachability - **recommended**
   (no new data to maintain). (ב) Add a dedicated emergency-contact list (new table, new screen, privacy review) - larger scope, later.
4. **Thresholds.** (א) The defaults of section 3 (generator test 35 d, fuel 50/25 %, backup 2 d, drill 180 d), editable by `maintenance.manage` - **recommended**.
   (ב) Fixed in code, no override. (ג) The owner gives the local fire-code intervals now.
5. **Binding ledger tasks to slots.** (א) Settings-value binding with suggestions, no migration - **recommended**. (ב) A closed `subtype` column on `maint_tasks`
   (cleaner, needs a migration owned by MAINT215).
6. **Cameras.** (א) Overall online percentage only, supporting item - **recommended**. (ב) Let the manager flag "emergency cameras" (entrances, exits, generator room)
   that make E18 critical (needs a settings list, no migration).
7. **History and alerts.** (א) No stored history, no new notification - **recommended** (each cause already alerts). (ב) A daily digest when the verdict worsens.
   (ג) Persist the verdict for a trend (needs a migration).
8. **Inspector print.** (א) Verdict, item table and disclaimer, references to certificates only - **recommended**. (ב) Also attach certificate files once the ledger has files.
9. **Door state wording.** The page shows door controls as "ready/not ready" and incidents as banners, never a per-door lock state. (א) As written - **recommended**.
   (ב) Add a per-door list for managers.

## 14. Owner decisions (2026-10-24; source: private/planning/OWNER_ANSWERS_2026-10-24_batch4 q201-q209 and batch5 q284) and how the build applies them

Standing rule of the owner: every threshold / default / window / recipient is editable in Settings; permissions are grantable to any role.

| Q | Owner answer | Effect on this CR / build |
|---|---|---|
| 1 | (a) A tab of the maintenance screen, off by default, no home tile; a home tile can be added in Settings | Tab `#/tickets/maintenance/emergency`; switch `emergency_readiness.enabled` default `false`. The optional home tile is NOT built in this slice (listed as open). |
| 2 | (a) No new key for the page: maintenance view, rows filtered by source permissions; PLUS a grantable permission to view and edit | Page opens with `maintenance.view` OR the new `emergency.view`; configuration needs `maintenance.manage` OR the new `emergency.manage`; both new keys default to site_admin and system_admin and are grantable to any role. Interpretation recorded here: the new keys are an alternative route, never a widening of any row's source permission. |
| 3 | (b) A dedicated emergency contact list (table, screen, privacy review); both (a) and (b) allowed | Table `emergency_contacts` (migration 0194, provisional); manager-only detail; a deleted contact keeps no personal data; E13 reads this list. The derived part (a: recipients of critical notification policies) is NOT built in this slice. |
| 4 | (a) Defaults editable, and the default itself changeable | `emergency.thresholds` overrides (PUT /config), validated ranges and ordering, per-key reset. |
| 5 | (b) A closed type column on maintenance tasks (migration) | `maint_tasks.emergency_slot` (migration 0194, provisional). |
| 6 | (b)+(a) The manager marks emergency cameras that make the item critical; show the overall percentage too | `emergency.cameras`; E18 shows both and is critical once any camera is marked. |
| 7 | (c) Keep history for a trend (migration); retention question #284 | Table `emergency_readiness_history` (migration 0194); a row when the verdict or any item changes, and at least once a day; **q284 (a): kept one year, editable** (`history_keep_days`, default 365). No notification (7b not chosen). |
| 8 | (b) The print attaches the approval files | The printable view lists the bound tasks' approval files by reference; merging the file bytes into one PDF is NOT built in this slice (the print page links them). |
| 9 | (a) "ready" / "not ready" and banners, no per-door lock state | As written in section 3 (E11, E12) and section 6 (banners). |

Provisional migration number: **0194** (assigned by the lead for this build; renumber at integration). One file, additive: one column, two tables.
