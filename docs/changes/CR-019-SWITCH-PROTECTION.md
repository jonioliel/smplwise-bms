# CR-019 — Switch protection: invert the group-action model ("מתגים מוגנים")

> **תקציר לבעלים (עברית)**
> 1. מעכשיו כל מתג נכלל ב"כבה הכל" ובפעולות קבוצתיות כברירת מחדל; לא צריך לאשר מתגים אחד־אחד.
> 2. מתג שמסומן "מוגן" לא נכלל רק בפעולות קבוצתיות (קומה, אזור, מבנה, הכפתור הראשי); אפשר עדיין להפעיל אותו לבד, בתזמון ובאוטומציה.
> 3. בשדרוג: מתגים שאישרת בעבר נשארים לא מוגנים; מתגים שנראים רגישים (משאבה, דוד, שער, מקרר, שרת/ראוטר, אזעקה, בריכה, השקיה ועוד) מסומנים "מוגן" אוטומטית.
> 4. בהגדרות › חשמל והתקנים › "מתגים מוגנים" תראה את הרשימה פעם אחת ותאשר, תסיר הגנה או תגן על עוד מתגים (בחירה מרובה).
> 5. מה שלא משתנה: דלתות, מתגי עקיפה של האזעקה, מנעולים ושערים בשכבת הדלתות לעולם לא בפעולה קבוצתית; חלון האישור ורשימת התוצאה נשארים כמו היום.

**Status:** IMPLEMENTED on `pilot/cr019-complete` (S1 backend, S2 schedules + guard, S3 frontend, S4 docs; not released) — owner decisions adopted (2026-10-01, §1). Design text below is unchanged except where §15 records a deviation. **Release:** the first release after 0.1.150 (owner's call; no version or CHANGELOG edit
here). **Supersedes:** the opt-in "bulk-safe" rule of CR-007 §7.10 (review round 1, slice 3) and its reuse as the
schedule gate in CR-014 (`SCHEDULER_API.md` §5.1 `switch` row, error `switch_not_marked`). **Builds on:** CR-007 (bulk
engine `services/device_bulk.py`), CR-010 (alarm-managed controls), CR-014 (schedules), CR-015/016 (media-managed
endpoints). **Cross-branch:** CR-017 (automations, migration 0045) and CR-018 (notifications, migrations 0046–0048) are on
other branches and were checked (§10.3). No device, HA or lab system was contacted for this document.

## 1. Owner decisions (2026-10-01)

As relayed in the session brief (the owner's Hebrew answers, numbered by the question they answer):

| # | Answer | Meaning adopted here |
|---|---|---|
| 1 | **א** | "All switches are allowed by default; only switches the owner / administrator marks **protected** are excluded, and protected means excluded **only from group actions** (floor / area / building 'turn all off / on', bulk device actions). A protected switch stays controllable individually, from schedules, from automations / scripts / scenes, as long as the caller has the normal per-entity control permission." |
| 2 | **א** | "After the migration, switches previously marked safe stay unprotected; switches never marked become unprotected **except** those a conservative classifier recognises as sensitive (name / entity id / device class / area / integration); these are auto-marked protected with `source='auto'` and listed in a review list in Settings ('מתגים מוגנים': approve / remove protection / protect more, bulk select) so the owner confirms once." |
| — | standing | Hard exclusions that do not depend on the mark stay exactly as they are (§4.2). `system.configure` sets the mark, as today. The approval chore is the problem being solved: one review, not a per-switch approval. |

Reason for the change: approving every switch for "כבה הכל" is a chore that the owner rejected; the safety that the
opt-in gave is kept for the switches that need it by the classifier plus a one-time review.

## 2. Goal and the one-line answer

Replace the allow-list (`device_bulk_safe`: a switch enters a group action only when marked) with a deny-list
(`device_bulk_protected`: a switch enters unless protected), seed the deny-list conservatively at upgrade and for every
switch seen later, and stop using the mark for anything but group actions. Schedules lose their `switch_not_marked`
gate. The group engine, its confirmation dialog, its digest, its in-flight bound and its per-entity result list are not
touched.

## 3. Scope

In scope:
- `services/device_bulk.py` `SwitchPolicy` decision, reasons and labels; the marking routes of `routers/devices.py`.
- Migration `0049_switch_protection.sql`; a new pure classifier `services/switch_protection.py` (+ rules data
  `services/switch_protection_rules.py`) and its reconcile step on every registry refresh and at start-up.
- Schedules: `services/schedule_policy.py` `classify_entity`, `schedule_view.py`, `schedule_model.py`,
  `schedule_ops.py` drop the mark.
- Settings screen "מתגים מוגנים" (replaces "פעולה קבוצתית"), the master-control tooltip, the schedule picker types.
- Project backup handling of the new tables; audit rows; docs, user guide, evidence.

Out of scope (unchanged, verified in §10): the bridge (`smplwise_bridge`, both copies) — it never consulted the mark;
the single-entity route (`routers/ha.py run_action`); media bulk (`resolve_media`, `resolve_players_pause`); lights,
covers, climate, heating, screens kinds; CR-017 automations / scenes / scripts (they never consulted the mark).

## 4. The new rule

### 4.1 Decision order for a switch in a group action (`SwitchPolicy.switch_reason`)

Evaluated in this order; the first hit wins (the first four are today's hard exclusions, unchanged):

| Order | Condition | Included | Reason code | Unchanged? |
|---|---|---|---|---|
| 1 | Scheduler component switch (`bulk_scope.permitted`, `dsvc.is_scheduler_entity`) | never, silently | — | yes |
| 2 | Media-managed endpoint (CR-016 M4, `bulk_scope.permitted`) | never, silently | — | yes |
| 3 | Alarm-managed control (CR-010 B1) | never | `alarm_managed` | yes |
| 4 | On the map's door layer (`DOOR_LAYER`) | never | `doors_layer` | yes |
| 5 | Row in `device_bulk_protected` (and `gone_at IS NULL` is NOT required — a protection row always applies) | no | **`switch_protected`** (new) | new |
| 6 | No row in `device_switch_classified` (classifier has not seen it yet) | no (fail-safe) | **`switch_unclassified`** (new, transient) | new | *(superseded by section 16: removed, default is included)*
| 7 | otherwise | **yes** | `allowed` (replaces `marked`) | new |

Removed: `marked`, `switch_not_marked`, `circuit_not_marked`. A Plan Studio lighting circuit has **no effect** on
protection in either direction (drawing a circuit needs only map editing; it must not un-protect a pump, and it no
longer needs to suggest anything). `SwitchPolicy.circuits` is dropped.

Order 6 closes the window between the upgrade (or a switch's first appearance) and the classifier's first pass: an
unclassified switch is excluded, never included. In practice the window is the time between a registry refresh's
entity write and its reconcile step (§6.4), so the reason is rarely visible.

### 4.2 Hard exclusions that stay exactly as they are

`NEVER_BULK_DOMAINS` (lock, alarm_control_panel, siren, script, scene, button), `DOOR_COVER_CLASSES` covers
(door / garage / gate), the door layer for covers and switches, alarm-managed controls, media-managed endpoints,
scheduler switches, `input_boolean` never in a bulk kind, `_check_kinds()` import-time invariant, building scope only for
an installation-wide holder, `AREA_ONLY_KINDS`. None of them reads the protection table.

### 4.3 What "protected" does NOT do (decision 1א)

- Individual control: `routers/ha.py run_action` / `ha_scope.control_allowed` never read the mark (today or after).
- Schedules: a protected switch is scheduled like any switch (class `switch`, subject to `schedules.classes`,
  `schedule.manage` and `entity_not_controllable` per entity). §8.
- Automations / scripts / scenes (CR-017): never read the mark. §10.3.
- Media bulk and the other bulk kinds do not reach switches at all.

## 5. Security analysis

### 5.1 What changes for "כבה הכל" (blast radius)

Before: `all_off` / `switches_off` / `switches_on` reached only switches an administrator had positively marked; the
default was zero switches. After: they reach **every switch** that is not hard-excluded and not protected. Who can do it
is unchanged: `devices.control_bulk` (built-in roles `site_admin` and `system_admin`; listed in
`sensitive_permissions_not_implied`), floor-scoped as today, building scope only installation-wide. The home screen's
quick action "כבה הכל בבניין" (`home-config.ts` `all_off`) is the widest single click and now includes every
unprotected switch.

The risk is a switch that must not go off (or on) with the lights — a pump, a boiler, a gate motor, a fridge, a
server / router / UPS feed, a PoE switch powering cameras, an alarm siren, an aquarium — and that the classifier does not
recognise because HA calls it "Relay 2". `switches_on` adds the reverse risk: a heater, an oven, a hot plate or an
irrigation valve turned **on** unattended.

### 5.2 Mitigations

| # | Mitigation | Where |
|---|---|---|
| M1 | Conservative auto-classifier (§6.3) at upgrade **and for every switch first seen later**; matches are protected immediately (`source='auto'`, `reviewed=0`) | `services/switch_protection.py` |
| M2 | Fail-safe: a switch the classifier has not seen is excluded (`switch_unclassified`) | `SwitchPolicy` order 6 | *(superseded by section 16)*
| M3 | Protection is sticky: a later HA rename of the entity or its device never removes it; an entity id change is followed by `registry_id` (§6.4); an entity that leaves HA keeps its row (inverse of today's `clear_stale_marks`, because keeping protection is the safe direction); only `system.configure` removes it | §6.4 |
| M4 | One-time review list in Settings: every switch, protected or not, filter "ממתינים לבדיקה" (auto, not reviewed) and "לא מוגנים", bulk approve / remove / protect; removing protection asks a confirmation that names the consequence | §9.2 |
| M5 | Unchanged confirmation dialog: the server-resolved set, count per domain ("מתגים: N"), the excluded list with reasons (now `switch_protected`), the digest (`target_changed` 409 if a mark changed after the preview), focus on Cancel, `confirmed: true` only from its button | `devices-bulk.ts`, `bulk_run` |
| M6 | Unchanged per-entity honest result list and outcome audit row with every not-confirmed / unknown / refused id | `device_bulk.load` / `finish` |
| M7 | Unchanged rate / shape limits: ≤ 8 bridge calls in flight across all bulks, one bulk per scope, no two bulks sharing an entity, expiry ≤ 60 s, nothing sent later than 30 s, duplicate `client_request_id` refused, JSON only | `device_bulk`, `routers/devices.py` |
| M8 | Unchanged floor rules: building scope needs installation-wide `devices.control_bulk`; a floor holder reaches only entities placed on their floors; `covers_stop` / `covers_position` area-only | `bulk_scope`, `resolve` |
| M9 | Rollback is conservative: `device_bulk_safe` is kept frozen (§6.2); reinstalling 0.1.150 brings back the old opt-in marks | migration 0049 |
| M10 | Restore of an older project backup never empties the protection tables (§6.6) | `services/backup.py restore` |

Residual risk (accepted by decision 1א/2א, stated for the record): a sensitive switch with a meaningless name, no
telling icon, no telling integration and no sibling entity is unprotected until the owner protects it in the review.
The review screen lists **all** switches so the owner can scan the unprotected ones once.

### 5.3 Schedules: what widens (for the record)

Before: an unmarked switch could not be scheduled at all. After: every non-door-layer switch is class `switch`
(non-sensitive) — exactly what the caller can already do individually (`ha_scope.devices_control_reaches` refuses only
the door layer and door covers; a switch-relay maglock not on the door layer is individually controllable today). So
schedules reach parity with individual control; nothing beyond the caller's own per-entity right is granted. See
open question Q1 (§14) for an optional tightening of the classifier's `access` category.

### 5.4 Who can change protection

`system.configure` at the installation, checked before the body (as `_configure_holder_early_ro` today); every change
audited (§11). The classifier's own writes are audited with `actor=None` and `reason=<category>`. Nothing in the map,
Plan Studio, schedules, automations or the bulk routes can write the table.

## 6. Data model and migration

### 6.1 Migration number

`0049_switch_protection.sql`. `base/0.1.150` ends at 0044; CR-017 takes 0045 (`0045_automations.sql`,
`pilot/CR017-s1-backend`) and CR-018 takes 0046–0048 (`integ/notify`). 0049 is the next number no branch uses, so the
three lines merge in any order without a collision. `Database.migrate()` applies every file whose version is not recorded
(no "max version" check), so a database that applies 0049 before 0045–0048 still applies those later; no entry in
`GUARDED_MIGRATIONS` is needed.

### 6.2 Tables

```sql
-- CR-019: a switch takes part in group actions unless protected here (the inverse of device_bulk_safe).
CREATE TABLE device_bulk_protected (
  entity_id          TEXT PRIMARY KEY,
  registry_id        TEXT,                -- HA entity registry id: follows an entity id rename (§6.4)
  source             TEXT NOT NULL CHECK (source IN ('manual', 'auto')),
  category           TEXT,                -- auto: the classifier category (§6.3); manual: NULL
  rule               TEXT,                -- auto: the signal that matched, e.g. "name:משאבה", "platform:hassio"
  marked_by          TEXT,                -- user id; NULL for the classifier
  marked_by_username TEXT,
  marked_at          TEXT NOT NULL,
  reviewed           INTEGER NOT NULL DEFAULT 0,   -- 1 = confirmed by an administrator (manual rows are born 1)
  reviewed_by        TEXT,
  reviewed_at        TEXT,
  gone_at            TEXT                 -- the entity left HA at this instant (row kept, §6.4); NULL while present
);
CREATE INDEX idx_device_bulk_protected_registry ON device_bulk_protected (registry_id);

-- CR-019: every switch the classifier has judged, once, so its verdict is never repeated over an administrator's choice.
CREATE TABLE device_switch_classified (
  entity_id          TEXT PRIMARY KEY,
  registry_id        TEXT,
  verdict            TEXT NOT NULL CHECK (verdict IN ('protected', 'allowed', 'was_safe', 'admin_cleared')),
  category           TEXT,
  rule               TEXT,
  classifier_version INTEGER NOT NULL,
  classified_at      TEXT NOT NULL
);
CREATE INDEX idx_device_switch_classified_registry ON device_switch_classified (registry_id);

-- decision 2א: a switch an administrator had marked safe stays unprotected and is never auto-protected
INSERT OR IGNORE INTO device_switch_classified (entity_id, registry_id, verdict, rule, classifier_version, classified_at)
  SELECT b.entity_id, e.registry_id, 'was_safe', 'device_bulk_safe', 0, strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
  FROM device_bulk_safe b LEFT JOIN ha_entities e ON e.entity_id = b.entity_id;

-- device_bulk_safe is kept, frozen: no code writes or deletes it after this migration (rollback to 0.1.150 reads it).
```

The two extra columns beyond the brief (`registry_id`, `gone_at`, plus `category` / `rule` / reviewer fields) exist
for M3 and for the review list's "why"; `device_switch_classified` exists so that "remove protection" is permanent and a
returning or renamed entity is judged again only when it is genuinely new.

### 6.3 The classifier (pure, `services/switch_protection.py`, rules in `switch_protection_rules.py`)

`classify_switch(entity, device, siblings, area_name) -> (category, rule) | None`, no database access, versioned
`CLASSIFIER_VERSION = 1`. Inputs are HA-side facts only (never the map, circuits or anything an Arx map editor can
change): entity `name`, `original_name`, the object id of `entity_id`, `icon`, `platform`; the HA device's `name`,
`name_by_user`, `manufacturer`, `model` (`ha_devices`, migration 0041); the domains / device classes of the other
entities of the same device (`ha_entities.device_id`); the HA area name.

**Matching.** Text is NFKC-normalised and case-folded; geresh / quote variants unified. English terms match whole
tokens (split on non-alphanumerics; multi-word terms match consecutive tokens), so `ups` never matches "groups", `nas`
never "dinas", `gate` never "navigate". Hebrew terms match as substrings (prefix letters ה/ו/ב/ל/מ/ש/כ attach), e.g.
"המשאבה", "לדוד". Signals are tried in the order platform → sibling entities → icon → entity text → device text → area;
the first hit is the `rule`.

**Lighting suppression.** For the *weak* categories marked (w) below, a hit is ignored when the same text also holds a
lighting word: EN `light, lights, lamp, led, spot, spotlight, bulb, chandelier, sconce, strip, lighting`; HE `תאורה,
תאורת, מנורה, מנורת, נורה, נורת, ספוט, פנס, לד`. So "תאורת חניה", "Gate light", "Pool lights" stay unprotected, while
"משאבת בריכה" (pump, strong) is protected.

**Categories and terms (v1):**

| Category (label) | English terms (tokens / phrases) | Hebrew terms (substrings) | Icons (`mdi:` prefix) |
|---|---|---|---|
| `water_heating` (משאבות ודודים) | pump, boiler, water heater, hot water, geyser, dhw, immersion, circulation, recirculation, sump, booster, solar heater | משאבה, משאבת, משאבות, דוד, בוילר, מחמם מים, חימום מים, גוף חימום, סירקולציה, דוד שמש | water-pump, pump, water-boiler, water-heater, water-thermometer |
| `heat_appliance` (חימום ובישול) | heater, radiator, oven, stove, cooktop, hob, kettle, hot plate, hotplate, urn, iron | תנור, כיריים, קומקום, מיחם, פלטה, מפזר חום, רדיאטור, מגהץ | radiator, stove, kettle, toaster-oven, fire, heat-wave |
| `access` (w) (שערים, דלתות וחניה) | gate, garage, door, barrier, boom, maglock, mag lock, strike, latch, lock, intercom, doorbell, opener, buzzer, turnstile | שער, חניה, חנייה, דלת, מחסום, זרוע, מנעול, אלקטרומגנט, אינטרקום, פעמון, פותחן, קודן | gate, garage, door, lock, doorbell, boom-gate, intercom (all variants) |
| `cold` (מקררים ומקפיאים) | fridge, refrigerator, freezer, deep freeze, chiller, wine cooler | מקרר, מקפיא, קירור | fridge, fridge-outline, snowflake-thermometer |
| `network` (רשת, שרתים ואל־פסק) | server, nas, router, modem, ups, network, poe, access point, wifi, mesh, firewall, gateway, hub, bridge, coordinator, zigbee, zwave, z wave, rack, nvr, dvr, synology, qnap, unraid, proxmox, unifi, mikrotik, starlink, ont | שרת, ראוטר, נתב, מודם, אל פסק, אל-פסק, אלפסק, מתג רשת, תקשורת, רכזת, אינטרנט, וויפי, סיב | server, nas, router, router-wireless, lan, access-point, ethernet, network, ups, power-plug-battery |
| `security` (w) (אזעקה ומצלמות) | alarm, siren, security, panic, smoke, detector, camera, cctv, recording, record, detect, privacy | אזעקה, צופר, סירנה, אבטחה, פאניקה, גלאי, עשן, מצלמה, מצלמות, מקליט, הקלטה | alarm, alarm-light, bell-ring, shield (all), cctv, camera (all), smoke-detector |
| `pool` (w) (בריכה וג'קוזי) | pool, spa, jacuzzi, hot tub, chlorinator, salt cell | בריכה, ג'קוזי, ספא, כלור | pool, hot-tub |
| `water_valve` (השקיה וברזים) | irrigation, sprinkler, valve, drip, tap, faucet, water main, main water, shutoff, shut off, leak | השקיה, ממטרה, ממטרות, טפטוף, ברז, מגוף, שסתום, מים ראשי, נזילה | sprinkler (all), valve (all), water-pump-off, pipe-valve |
| `life_support` (ציוד רגיש) | aquarium, fish, terrarium, incubator, oxygen, medical, cpap | אקווריום, דגים, טרריום, חמצן, רפואי, מכשיר נשימה | fish, fishbowl, medical-bag, hospital-box |
| `energy` (אנרגיה וטעינה) | ev, charger, charging, wallbox, inverter, battery, generator, solar, pv, grid, main breaker, main power | מטען, טעינה, רכב חשמלי, ממיר, סוללה, גנרטור, סולארי, מפסק ראשי, חשמל ראשי | ev-station, car-electric, ev-plug (all), battery (all), solar-power, solar-panel, transmission-tower |
| `elevator` (מעלית) | elevator, lift | מעלית | elevator (all) |
| `infrastructure` (תשתית המערכת) | — (platform only) | — | — |

**Integrations (platform → category; every switch of the platform):** `hassio` (add-on start / stop switches — would stop
Arx itself) → infrastructure; `unifi`, `tplink_omada`, `mikrotik`, `fritz`, `netgear`, `asuswrt`, `openwrt`, `luci`,
`opnsense`, `pfsense`, `adguard`, `pi_hole`, `synology_dsm`, `qnap`, `proxmoxve`, `unraid`, `wake_on_lan` → network;
`frigate`, `unifiprotect`, `reolink`, `hikvision`, `hikvisioncam`, `onvif`, `amcrest`, `dahua`, `blueiris`, `motioneye`,
`alarmo`, `risco`, `visonic`, `pima`, `envisalink`, `satel_integra`, `paradox_alarm`, `elkm1`, `konnected`, `jablotron`,
`ajax` → security; `nuki`, `tedee`, `akuvox`, `doorbird`, `ring`, `unifi_access` → access; `switcher_kis` (Switcher
boilers, common in Israel) → water_heating; `rainbird`, `hydrawise`, `rachio`, `opensprinkler`, `bhyve`,
`irrigation_unlimited`, `gardena_bluetooth` → water_valve; `omnilogic`, `iaqualink`, `screenlogic`, `intellicenter` → pool;
`home_connect`, `miele` → heat_appliance; `wallbox`, `easee`, `zaptec`, `teslemetry`, `tesla_fleet`, `enphase_envoy` →
energy. Generic platforms (`shelly`, `tuya`, `mqtt`, `zha`, `zwave_js`, `esphome`, `template`, `sonoff`) are not a signal.

**Sibling entities of the same HA device (strong):** `lock` → access; `cover` with device class door / garage / gate →
access; `binary_sensor` with device class `door` or `garage_door` → access; `alarm_control_panel` or `siren` → security;
`camera` → security; `water_heater` → water_heating; `valve` → water_valve.

**Area (strong, technical rooms only):** HE חדר שרתים, ארון תקשורת, חדר תקשורת, חדר מכונות, חדר משאבות, חדר טכני,
חדר דוודים; EN server room, comms room, network closet, plant room, boiler room, machine room, pump room.

Deliberately **not** signals: `device_class` of the switch itself (`outlet` / `switch` say nothing), "utility" /
"מחסן" / "כניסה" / bare "אור" / bare "מפסק" (a lighting circuit is a מפסק), Plan Studio circuits, map placement.
Known accepted false positives: a lamp in "החדר של דוד" (David), "Garden pump light" style compounds without a
lighting word; the owner removes them in one bulk action.

**Golden fixture:** `tests/fixtures/switch_protection/classifier_golden.json` — at least 120 cases (positive per term and
per signal kind, the suppression negatives, the token-boundary negatives, mixed Hebrew / English names).

### 6.4 Reconcile (`switch_protection.reconcile(conn, present_registry)`)

One function, called (a) at start-up in `main.create_app` right after `sweep_unfinished` (on the current mirror; empty
mirror = no-op), (b) at the end of every registry refresh in `ha_sync.HaSync._refresh_registry` (inner `_tombstone`) in place of
`device_bulk.clear_stale_marks`, (c) in the dev seed `routers/ha.py dev_registry`. In the sync it runs in the
tombstone step right after the registry chunks are written (separate short transactions today); the gap between the two
is covered by the fail-safe of §4.1 order 6, so a new switch is excluded, never included, until it is classified. Steps:

1. **Rename follow.** For a protected / classified row whose `entity_id` is absent but whose `registry_id` now belongs to
   another present entity id, move both rows to the new id (audit `devices.bulk_protected.moved`).
2. **Gone.** A protected row whose entity is absent from the registry listing (or tombstoned) gets `gone_at` (once);
   a row whose entity is present again gets `gone_at = NULL`. **No deletion** (M3). A row gone for more than 90 days is
   purged with its classified row (audit `devices.bulk_protected.purged`), so an id reused much later is judged anew.
   Guard kept from today: an empty or failed listing changes nothing (`test_a_failed_entity_or_device_listing_writes_nothing`).
3. **Classify new.** Every present `switch` entity (catalogue rules of `dsvc.load_entities`: not removed, not disabled,
   not hidden, no entity category) with no `device_switch_classified` row is classified: a hit inserts a protected row
   (`source='auto'`, `reviewed=0`, `category`, `rule`) and a classified row `protected`; no hit inserts `allowed`.
   Scheduler switches are skipped (never devices). Hard-excluded switches (door layer, alarm-managed, media-managed) are
   classified like any other, so the verdict is ready if their hard exclusion ends.
4. **Version bump** (future): rows with verdict `allowed` and `classifier_version < CLASSIFIER_VERSION` are classified
   again; `was_safe` and `admin_cleared` never are.
5. **Audit:** one row per auto-protected entity (`devices.bulk_protected.auto`, actor None, reason = category,
   details `{rule, classifier_version}`) and one summary per pass that changed anything
   (`devices.bulk_protected.reconcile`, counts). The first pass after the upgrade also writes
   `devices.switch_model.migrated` with `{was_safe, auto_protected, allowed}` — the owner-facing record of the upgrade.

### 6.5 Upgrade walk-through

| Switch before | After migration + first reconcile |
|---|---|
| marked in `device_bulk_safe` | verdict `was_safe`; **unprotected**, included (2א) |
| unmarked, classifier hit | protected `auto`, `reviewed=0`; excluded; listed under "ממתינים לבדיקה" |
| unmarked, no hit | verdict `allowed`; **included** |
| hard-excluded (door layer / alarm / media / scheduler) | still never in a group action; classified for the record (scheduler skipped) |
| first seen after the upgrade | same as a new install: classified within the refresh that brings it |

The add-on already writes a pre-upgrade backup before migrating (`backup_svc.pre_upgrade`, `main.py`).

### 6.6 Backup and restore

Today `device_bulk_safe` is not in `PROJECT_TABLES` (`services/backup.py`). Protection is safety state, so
`device_bulk_protected` and `device_switch_classified` **are added to `PROJECT_TABLES`**. `restore(mode="replace")`
empties a listed table missing from the archive; that would unprotect everything when an older backup is restored, so
both tables get an exception: **when the archive has no member for them, the current rows are kept** (and the restore
report says so). A backup that has them restores them as usual. `device_bulk_safe` stays outside backups.

### 6.7 Rollback

Reinstalling 0.1.150 on a migrated database: the old code ignores the two new tables and reads `device_bulk_safe`,
frozen at its pre-upgrade content — the old opt-in model with the old marks (more restrictive than the new one).
Protection changes made under CR-019 are not carried back; nothing becomes less safe.

## 7. API contract changes (`contracts/API_INVENTORY.md` regenerated by `scripts/api_inventory.py`)

### 7.1 Routes

| Before | After | Notes |
|---|---|---|
| `GET /devices/bulk-safe` | `GET /devices/bulk-protected` | `system.configure`; every switch (§7.3) + `summary` |
| `POST /devices/bulk-safe` `{entity_ids, bulk_safe}` | `POST /devices/bulk-protected` `{entity_ids: [1..500], action: "protect" \| "unprotect" \| "approve"}` | `system.configure` before the body, JSON only, per-id results `{entity_id, ok, reason, changed}`, `{changed, refused}` |
| `PUT /devices/entities/{id}/bulk-safe` `{bulk_safe}` | `PUT /devices/entities/{id}/bulk-protected` `{protected: bool}` | returns `{entity_id, bulk_protected, bulk_reason, source, reviewed}` |

The old paths are removed (404). The UI ships in the same add-on; a stale tab's write to an old path fails harmlessly.
Per-id refusals (batch) / errors (single): `not_switch` (422), `not_markable` (scheduler switch, 422), `alarm_managed`
(409, unchanged wording), `use_media_screen` / `media_managed` (409, unchanged), `doors_layer` (409: "בשכבת הדלתות - לעולם
לא בפעולה קבוצתית; אין צורך בהגנה"). `approve` on a row that is not an unreviewed auto row is `ok: true, changed: false`.
`unprotect` writes the classified verdict `admin_cleared` (never re-protected); `protect` inserts `source='manual'`,
`reviewed=1`; `approve` sets `reviewed=1, reviewed_by, reviewed_at`.

### 7.2 Field renames in existing replies

| Reply | Before | After |
|---|---|---|
| `GET /devices/areas/{id}` switch rows | `bulk_safe: bool` (true = included), `bulk_reason: marked \| circuit_not_marked \| switch_not_marked \| doors_layer \| alarm_managed` | `bulk_protected: bool` (the mark), `bulk_reason: allowed \| protected \| unclassified \| doors_layer \| alarm_managed` | *(`unclassified` removed, see section 16)*
| `GET /devices/areas/{id}` | `can_mark_bulk_safe` | `can_mark_bulk_protected` (unused by the UI today; kept for parity) |
| `GET /devices/items` rows (switches) | `bulk_safe`, `bulk_reason` | `bulk_protected`, `bulk_reason` (values as above); `bulk_excluded` unchanged (now `switch_protected` / `switch_unclassified` for switches) | *(`switch_unclassified` removed, see section 16)*
| `GET /devices/items` | `can_mark_bulk_safe` | `can_mark_bulk_protected` |
| `GET /devices/actions/preview`, `POST /devices/actions`, `GET /devices/actions/{id}` | `excluded[].reason` `switch_not_marked` / `circuit_not_marked` | `switch_protected` / `switch_unclassified`; shape unchanged | *(`switch_unclassified` removed, see section 16)*

### 7.3 `GET /devices/bulk-protected` row

`{entity_id, name, area_id, area_name, floor_id, floor_name, state, available, platform, protected, source: "manual" |
"auto" | null, category, category_label, rule, reviewed, included, reason, reason_label, alarm_managed, doors_layer,
marked_by, marked_at, reviewed_by, reviewed_at}`; `summary: {switches, protected, auto_unreviewed, unprotected}`;
`categories: [{id, label}]`. Gone entities are not rows; `summary.gone_protected` counts them.

### 7.4 Reason codes and labels (`device_bulk.EXCLUDED_LABELS` / `EXCLUDED_LABELS_ON`)

| Code | Off kinds | On kinds |
|---|---|---|
| `switch_protected` | "מתג מוגן - לא נכלל בפעולה קבוצתית" | same |
| `switch_unclassified` | "מתג חדש שטרם נבדק - לא נכלל עד לבדיקה" | same | *(removed, see section 16)*
| removed | `switch_not_marked`, `circuit_not_marked` | — |

Schedules: `switch_not_marked` is removed from `schedule_ops.PROMOTED`, `schedule_model._check_action` messages,
`schedule_view.catalog_payload` and `SCHEDULER_API.md` §3.20 / §5.1; no replacement code (a switch is never refused for
its mark).

## 8. Code paths to change (complete impact list)

Grep of the whole tree (`bulk_safe|bulk-safe|switch_not_marked|circuit_not_marked|SwitchPolicy|switch_reason|
clear_stale_marks|device_bulk_safe|classify_entity`, built bundle `smplwise_vms/www/assets` excluded — it is rebuilt) on
`base/0.1.150`, `integ/notify` and `pilot/CR017-s1-backend` / `-s2-model-bridge` / `-s4-builder`.

### 8.1 Backend (S1 unless noted)

| File | Function / symbol | Change |
|---|---|---|
| `migrations/0049_switch_protection.sql` | new | §6.2 |
| `services/switch_protection.py` | new: `classify_switch`, `reconcile`, `set_protected`, `approve`, `CLASSIFIER_VERSION` | §6.3, §6.4 |
| `services/switch_protection_rules.py` | new: term / icon / platform / sibling / area tables | §6.3 |
| `services/device_bulk.py` | module docstring; `_SWITCHES`, `_SWITCHES_ON` comments; `SwitchPolicy.__init__` (read `device_bulk_protected` + classified ids, drop `circuits`, `marked`), `SwitchPolicy.switch_reason`, `SwitchPolicy.excluded_reason`; `EXCLUDED_LABELS`, `EXCLUDED_LABELS_ON`; `clear_stale_marks` and `set_bulk_safe` **removed** (replaced by `switch_protection.reconcile` / `set_protected`) | §4.1 |
| `routers/devices.py` | `area` (rows + `can_mark_bulk_protected`), `items` (rows + flag), `BulkSafeBody`, `BULK_SAFE_MAX`, `list_bulk_safe`, `BulkSafeManyBody`, `set_bulk_safe_many`, `set_bulk_safe` → `ProtectBody`, `PROTECT_MAX`, `list_bulk_protected`, `ProtectManyBody`, `set_bulk_protected_many`, `set_bulk_protected`; section comment above them; `assign_area` docstring ("same gate as bulk-safe") | §7 |
| `services/ha_sync.py` | `HaSync._refresh_registry` → inner `_tombstone` (call `switch_protection.reconcile`); docstrings of `state_removed` and the guard comment in `_refresh_registry` ("must not cost it its bulk-safe mark" → protection) | §6.4 |
| `routers/ha.py` | `dev_registry` (call `reconcile` instead of `clear_stale_marks`) | §6.4 |
| `main.py` | `create_app` start-up block after `sweep_unfinished`: `reconcile` on the current mirror, never blocking the start | §6.4 |
| `services/backup.py` | `PROJECT_TABLES` (+ 2 tables); `restore` replace-mode exception for the two tables | §6.6 |
| `services/devices.py` | comment at the scheduler exclusion (line ~56, "marked bulk-safe") | wording |
| `services/alarm.py` | `managed_controls` docstring ("the bulk-safe mark refuse them") | wording |
| `routers/access.py` | `PERMISSION_LABELS` comment for `devices.control_bulk` (L46–55) | add "never a protected switch" |
| `services/schedule_policy.py` (S2) | `classify_entity`: drop the `bulk_safe` parameter; `switch` → `("switch", None)` unless door layer; docstring codes | §8.2 |
| `services/schedule_view.py` (S2) | `Ctx.__init__` (`_bulk_safe` removed), `Ctx._sets` (no `device_bulk_safe` read), `Ctx._info` (call without `bulk_safe`), `catalog_payload` (drop the `switch_not_marked` branch at the filter and at `why`) | §8.2 |
| `services/schedule_model.py` (S2) | `_check_action` messages dict (drop `switch_not_marked`) | §8.2 |
| `services/schedule_ops.py` (S2) | `PROMOTED` (drop `switch_not_marked`) | §8.2 |

### 8.2 Schedules — behaviour

`classify_entity` no longer knows the mark: every catalogued, non-scheduler, non-alarm-managed, non-media-managed
switch is class `switch` (door-layer switch stays class `door`, sensitive). Consequences: the picker lists every switch
as selectable (subject to `schedules.classes`, `schedule.manage` and per-entity control); a schedule created directly
in HA that names a previously unmarked switch becomes "understood" in `schedule_model.classify` (no longer
`action_not_allowed`, so no longer read-only) — intended.

### 8.3 Bridge (`smplwise_bridge`) — no change

`smplwise_vms/integration/smplwise_bridge/schedule_policy.py` and `schedule_service.py` (and the mirror copy under
`custom_components/smplwise_bridge/`) never read a mark: they decide on the allow-list, argument specs and the
`sensitive` flag (lock / alarm / button / door-class covers), and explicitly leave the map's door layer to the add-on. No
bridge version bump. `media_policy.py`, `media_query_service.py`, `stream_source_service.py`, `signing.py`: no reference.

### 8.4 Automations / scenes / scripts (CR-017) — no change, one guard test

On `pilot/CR017-s1-backend` the files `services/automation_policy.py`, `automation_scope.py`, `automation_view.py`,
`automation_draft.py`, `automation_model.py`, `routers/automations.py` read the door layer and door-cover classes
(`automation_scope.door_layer`) but never `device_bulk_safe`. Decision 1א keeps it that way. S2 adds a static guard test
(the automation and schedule modules never name `device_bulk_protected` / `switch_protection`) so a later change cannot
silently make protection apply there. CR-018 (`integ/notify`) has no reference.

### 8.5 Frontend (S3)

| File | Symbol | Change |
|---|---|---|
| `frontend/src/api/devices.ts` | entity row type (`bulk_safe`, `bulk_reason` union, doc comment ~L110–118), `can_mark_bulk_safe` on area (~L194) and items (~L230) | §7.2 renames |
| `frontend/src/screens/devices-bulk-safe-admin.ts` | `DevicesBulkSafeAdmin` (whole component) | replaced by `devices-protected-switches-admin.ts` `<devices-protected-switches>` (§9.2) |
| `frontend/src/screens/system-diagnostics.ts` | import (~L34) and the devices tab section (~L1062, `data-section="bulk-safe"`) | new element, `section=protected-switches`; `section=bulk-safe` kept as an alias |
| `frontend/src/screens/devices-tiles-panel.ts` | `renderMaster` doc comment and the `none` tooltip strings (~L709–722) | §9.3 |
| `frontend/src/screens/schedule-entity-picker.ts` | header comment (~L11) | wording |
| `frontend/src/api/schedules.ts` | refusal code union (~L481) | drop `'switch_not_marked'` |
| `frontend/src/api/schedules-mock.ts` | demo catalogue entry (~L99) | the boiler becomes selectable |
| `frontend/src/screens/devices-area.ts` | `.bulk-safe` CSS class used for the alarm-managed note (~L766, ~L1341) | rename class to `.managed-note` (cosmetic) |
| `frontend/src/screens/devices-bulk.ts` | none (renders server `reason_label`) | — |
| `frontend/src/screens/home-widgets.ts`, `devices-building.ts`, `devices-area-design.ts`, `api/home-config.ts`, `api/device-bulk.ts`, `api/area-row.ts`, `map/skin-control.ts` | none (go through `/devices/actions`; `skin-control` `all_off` is a map skin state, unrelated) | — |

### 8.6 Tests and fixtures

See §12.

### 8.7 Docs and guide (S4)

`docs/changes/CR-007-DEVICE-CONTROL.md` (§7.10 / L135, L234, L257–258) and `_HE.md` (L251): "superseded by CR-019"
notes; `docs/changes/CR-010-SECURITY-ALARM.md` (L140) and `_HE.md`: "cannot be marked bulk-safe" → "never in a group
action; protection not applicable"; `docs/architecture/SCHEDULER_API.md` (L20, L382, L395, L556, L687, L696, L742,
L1088) and `SCHEDULER_API_HE_NOTE.md`; `docs/design/CR-014-scheduler.md` (L148, L204, L294, L305) — historical, add a
pointer; `contracts/API_INVENTORY.md` (regenerated); user guide `docs/user-guide/he/40-devices_HE.md` (L44, L65–69),
`41-schedules_HE.md` (L77–78), `80-settings_HE.md` (L166 + a new "מתגים מוגנים" subsection), then
`scripts/build_guide.py` for `screens.json` / `GUIDE_ALL_HE.html`, and a new guide screenshot of the settings section
(demo data). `docs/operations/*` round results are historical and stay.

## 9. UI

### 9.1 Operator screens

Nothing new (clean-operator-screens rule): no badge, no hint. The bulk dialog's excluded list shows the new label. The
master control (tiles panel) is enabled by default for switches; the disabled tooltip, when every shown switch is
protected, reads "כל המתגים כאן מוגנים מפעולה קבוצתית - הגדרות › חשמל והתקנים".

### 9.2 Settings › חשמל והתקנים › "מתגים מוגנים" (`system.configure`)

Replaces the "פעולה קבוצתית" card at the same place (`#/system/diagnostics?tab=devices&section=protected-switches`).

- **Heading / one line:** "מתגים מוגנים לא נכללים ב'כבה הכל' ובפעולות קבוצתיות. אפשר עדיין להפעיל אותם לבד, בתזמון
  ובאוטומציה."
- **Review strip** (only while `summary.auto_unreviewed > 0`): "N מתגים סומנו כמוגנים אוטומטית וממתינים לאישורך" with
  "הצג" (applies the filter) and "אשר את כולם" (confirmation, then `approve` on all of them).
- **Filters:** search (name / area / id), status (הכל · מוגנים · ממתינים לבדיקה · לא מוגנים), category, floor, area;
  sort by name or floor › area.
- **Rows (table ≥ 600 px, cards below):** checkbox (Shift+click range), name, floor › area, "מוגן" (כן / לא / נשלט ממסך
  האזעקה / בשכבת הדלתות), source ("אוטומטי · משאבות ודודים" with the rule on hover, or "ידני"), "נבדק" (✓ / ממתין),
  who / when. Alarm-managed and door-layer rows are read-only (not selectable), as today.
- **Actions on the selection:** "אשר" (approve auto rows), "הגן" (protect), "הסר הגנה" (unprotect). One confirmation
  each; "הסר הגנה" says: "N מתגים ייכללו ב'כבה הכל' ובפעולות קבוצתיות. להמשיך?" (danger variant, focus on Cancel).
  One call (`POST /devices/bulk-protected`), per-id result line, list reloads.
- **Counts line:** "M מתוך T מתגים · P מוגנים · U ממתינים לבדיקה".
- Wording follows the no-HA-branding rule ("תשתית המערכת" for the `hassio` category).
- Light and dark, 1440 / 820 / 390; sticky action bar under 600 px; 100 rows at a time ("הצג עוד").

### 9.3 Schedule editor

No message about marks any more; a switch is never shown as unselectable for its mark. Other reasons
(`alarm_managed_control`, `media_managed_control`, class disabled, no control right) unchanged.

### 9.4 Bulk dialog result text

Unchanged mechanism; `excluded[]` lines read "<name> - מתג מוגן - לא נכלל בפעולה קבוצתית". The empty case "אף התקן
… אינו נכלל בפעולה קבוצתית" stays.

## 10. Permissions

| Action | Permission | Change |
|---|---|---|
| Read / change protection, approve auto rows | `system.configure` (installation) | same gate as the old mark |
| See `bulk_protected` / `bulk_reason` in area / items | bulk holders (as today) | rename only |
| Run a group action | `devices.control_bulk` (floor or installation; building = installation) | unchanged |
| Individual / schedule / automation control of a protected switch | the normal per-entity permission (`devices.control` / `ha.entity.control`, `schedule.manage`, CR-017 rules) | unchanged; the mark is not consulted |

## 11. Audit

| Action | When | Actor | Details |
|---|---|---|---|
| `devices.bulk_protected` | single or batch protect / unprotect (per changed entity) | user | `{protected, source, batch}` |
| `devices.bulk_protected.reviewed` | approve (per entity) | user | `{category, rule}` |
| `devices.bulk_protected.batch` | batch summary | user | `{action, requested, changed, refused[≤100]}` |
| `devices.bulk_protected` `denied` | refused single route (alarm_managed / media_managed / doors_layer) | user | `{protected}`, `reason` = code |
| `devices.bulk_protected.auto` | classifier protects | None | `reason` = category, `{rule, classifier_version}` |
| `devices.bulk_protected.reconcile` | a reconcile pass changed anything | None | `{auto_protected, allowed, moved, gone, purged}` |
| `devices.bulk_protected.moved` / `.purged` | rename follow / 90-day purge | None | `{from, to}` / `{gone_at}` |
| `devices.switch_model.migrated` | first pass after 0049 | None | `{was_safe, auto_protected, allowed}` |
| `devices.bulk` attempt / outcome rows | unchanged; `excluded` ids now include protected switches | user | unchanged |

Existing `devices.bulk_safe*` rows stay in the log untouched.

## 12. Tests (matrix)

Targeted files only (`pytest -p no:cacheprovider -q <file>`), never the full suite.

| Area | File | Cases |
|---|---|---|
| Classifier (pure) | **new** `tests/test_switch_protection_classifier.py` + golden JSON | every category by entity text (HE + EN), icon, platform, sibling, area; lighting suppression for (w) categories only; token boundaries (`groups`, `navigate`, `dinas`); no signal from circuits / map; accepted false positive "דוד" documented |
| Migration + reconcile | **new** `tests/test_switch_protection_migration.py` | DB with `device_bulk_safe` rows → `was_safe` unprotected; pump → protected auto unreviewed; "Relay 2" → allowed; `device_bulk_safe` unchanged; unclassified switch excluded with `switch_unclassified` before the first pass; idempotent second pass; `admin_cleared` never re-protected; version bump re-judges `allowed` only; rename follows `registry_id`; gone keeps the row, returns clears `gone_at`, 90-day purge; failed listing writes nothing; audit rows |
| Bulk engine + routes | `tests/test_devices.py` (rewrite `test_bulk_switches_only_when_positively_safe`, `test_bulk_master_switches_on_off_follow_the_bulk_safe_mark`, `test_bulk_safe_management_list_and_batch`, `test_bulk_safe_mark_cleared_when_the_entity_leaves_home_assistant`, `test_items_carry_the_bulk_facts_and_the_alarm_managed_seam`, keep `test_bulk_entity_set_never_includes_locks_alarm_or_doors`) | unprotected switch included in `all_off` / `switches_off` / `switches_on`; protected excluded with both labels; circuit has no effect; door layer / door cover / alarm / media / scheduler excluded even unprotected; preview digest changes after a protection change → 409 `target_changed`; list / batch / single routes incl. refusals, `system.configure` 403 audited for an operator, 415 non-JSON, 500-id cap; renamed fields in area / items |
| Schedules | `tests/test_schedules_model.py` (`test_classification_of_entities`, `test_class_and_service_pairing_and_unknown_entities`), `tests/test_schedules_api.py` (`test_catalog_selectability_and_reasons`, `test_create_validation_errors_use_the_contract_codes`) | protected and unprotected switch both class `switch`, selectable, creatable; door-layer switch class `door`; no `switch_not_marked` anywhere; an HA-made schedule on a formerly unmarked switch is understood |
| Exclusions | `tests/test_scheduler_exclusions.py` (`test_bulk_never_reaches_a_schedule_even_when_it_was_marked_behind_the_routes`, `test_bulk_safe_list_and_marking_refuse_schedules`) | scheduler switch never in bulk even unprotected / unclassified; the protection routes refuse it (`not_markable`); reconcile skips it |
| Alarm | `tests/test_alarm.py` (`test_bulk_never_reaches_a_bypass_switch_even_marked_bulk_safe`, `test_bypass_switch_without_config_entry_is_still_owned_by_the_alarm`) | bypass never in bulk although unprotected; protect route 409 `alarm_managed` |
| Registry refresh | `tests/test_ha_structure_refresh.py` (`_marks`, `test_an_integration_reload_keeps_the_entity_and_its_bulk_safe_mark`, `test_a_failed_entity_or_device_listing_writes_nothing`) | reload keeps protection; failed listing writes nothing |
| Media | `tests/test_media_review_fixes.py` (`test_m4_…never_bulk_or_scheduled`) | siblings never in bulk although unprotected |
| Backup | `tests/test_backup*.py` (existing backup tests) | tables in archive; restore of an archive without them keeps current rows |
| Guard (S2) | **new** `tests/test_switch_protection_scope_guard.py` | schedule / automation modules never reference the protection table; bridge `schedule_policy` unchanged |
| Fixtures | `tests/fake_scheduler.py` (`seed_mirror`), `frontend/tests/fixtures/schedules_fake_ha.py` (drop the bulk-safe PUT) | adapt |
| Frontend unit | `frontend/tests/unit-schedules-editor-logic.spec.ts` (boiler case → selectable); **new** `unit-protected-switches.spec.ts` (filters, status, range select, counts) | |
| Frontend evidence | `frontend/tests/evidence-devices-tiles.spec.ts` (switch master enabled by default, disabled + tooltip when all protected; the admin flow: review strip, approve all, unprotect with warning, protect more, Shift range), `evidence-devices.spec.ts` L1182 unchanged | screenshots 1440 / 820 / 390, light + dark, `docs/evidence/CR-019/` |

## 13. Task breakdown

| Slice | Content | Owner files | Effort | Model |
|---|---|---|---|---|
| **S1 backend core** | migration 0049; `switch_protection.py` + rules + golden fixture; `SwitchPolicy` and labels; routes and audit; reconcile hooks (`ha_sync`, `routers/ha.py dev_registry`, `main.py`); backup; comment wording; tests: classifier, migration, `test_devices`, `test_scheduler_exclusions`, `test_alarm`, `test_ha_structure_refresh`, `test_media_review_fixes`, backup | `migrations/0049_switch_protection.sql`, `services/switch_protection*.py`, `services/device_bulk.py`, `routers/devices.py`, `services/ha_sync.py`, `routers/ha.py`, `main.py`, `services/backup.py`, `services/devices.py`, `services/alarm.py`, `routers/access.py`, the test files above | 7–9 h | Fable / Opus (safety core) |
| **S2 schedules + bridge check + automations guard** | `schedule_policy.classify_entity`, `schedule_view`, `schedule_model`, `schedule_ops`; `fake_scheduler.py`; schedule tests; guard test; confirm bridge unchanged (no version bump) | `services/schedule_*.py`, `tests/test_schedules_*.py`, `tests/fake_scheduler.py`, `tests/test_switch_protection_scope_guard.py` | 2–3 h | Sonnet |
| **S3 frontend + review list** | `devices-protected-switches-admin.ts`, `system-diagnostics.ts`, `api/devices.ts`, `devices-tiles-panel.ts`, `api/schedules*.ts`, `schedule-entity-picker.ts`, `devices-area.ts` class rename, `schedules_fake_ha.py`, unit + evidence specs, screenshots | `frontend/src/...` listed in §8.5, `frontend/tests/...` | 6–8 h | Sonnet (Opus for the review list layout if the first pass is rejected) |
| **S4 docs + guide + evidence** | CR-007 / CR-010 / CR-014 pointers, `SCHEDULER_API.md`, API inventory regeneration, user guide 40 / 41 / 80 + build, guide screenshot, evidence index | `docs/...` §8.7, `contracts/API_INVENTORY.md` | 2–3 h | Sonnet |

Order: S1 → (S2 ‖ S3) → S4. S2 and S3 need only S1's contract (§7), so S3 can start on a mock in parallel with S1.
Total 17–23 h. Release gating per the batched-release rule (one release round on the owner's word, or on all-green).

## 14. Risks and open questions

| # | Risk | Mitigation / status |
|---|---|---|
| R1 | Classifier miss → a sensitive switch goes off with "כבה הכל" | §5.2 M1–M6; the review screen lists every switch; residual, accepted by 1א/2א |
| R2 | False positives annoy (e.g. "דוד" as a name, "חניה" without a lighting word) | lighting suppression; one bulk "הסר הגנה"; `admin_cleared` is permanent |
| R3 | Window between upgrade / first appearance and classification | fail-safe `switch_unclassified` (§4.1 order 6); reconcile runs in the same refresh, right after the registry write | *(superseded by section 16)*
| R4 | Old backup restore empties protection | §6.6 exception |
| R5 | Rollback | §6.7 — conservative |
| R6 | Migration numbering vs CR-017 / CR-018 merges | 0049, gaps are applied by `migrate()` (§6.1) |
| R7 | Renamed entity id loses protection | `registry_id` follow (§6.4 step 1) |
| R8 | A new switch added later is included without anyone looking | it is classified on arrival (M1); a non-matching new switch is included — consistent with 1א |
| R9 | Platform rules over-protect (`switcher_kis` power plugs, every `unifi` client-block switch) | intended; one bulk action in the review |

**Q1 (not blocking, recommendation):** the classifier's `access` category (gate / door / garage / maglock / intercom)
could also make the switch a **sensitive `door` class in schedules** (as a door-layer switch already is), so scheduling a
gate relay needs the sensitive schedule permission. That goes beyond decision 1א ("protected stays schedulable with the
normal permission"), so this CR does **not** do it; the owner may ask for it later (א keep as decided · ב add it).

**Q2 (not blocking, design choice taken):** the classifier also runs on switches that appear **after** the upgrade (not
only once at upgrade). Taken because it is the conservative reading of 2א and costs nothing when there is no hit; the
owner may restrict it to the upgrade only.

## 15. Implementation notes (S2-S4)

- **Reach guard.** The static guard is `tests/test_switch_protection_reach_guard.py` (S1 name; the design called it `..._scope_guard`). S2 extended it: schedule, automation, notification and individual-control modules may not name `device_bulk_protected`, `device_switch_classified`, `switch_protection`, `SwitchPolicy`, `bulk_protected`, `device_bulk_safe` or `switch_not_marked`, and `classify_entity` takes exactly `(entity, on_door_layer, alarm_managed)`.
- **Schedules catalogue.** A switch is never listed as unselectable for a mark; entities that cannot be scheduled (alarm-managed, scheduler, media-managed) are not listed at all, as before.
- **Frontend.** `<devices-protected-switches>` (`devices-protected-switches-admin.ts`) replaces `devices-bulk-safe-admin.ts`; pure logic in `protected-switches-logic.ts`. `section=bulk-safe` still scrolls to it. Multimedia-managed switches are shown read-only (the server refuses them with `media_managed`). "אשר את כולם" and any selection go to the server in chunks of 500 ids (the route's cap).
- **Dark scheme.** The settings screens have no dark theme tokens today (design unification is a separate item), so the dark evidence image shows the light card on a dark page.
- **Migration number.** 0049 is unused by `integ/0152`, `integ/0153`, `integ/notify` and `pilot/wave1-0153` at the time of writing (checked 2026-10-02); 0045-0048 on this line are notifications / automations.

## 16. Owner decision 2026-10-02: the default is INCLUDED, the classifier only suggests

The owner answered the two open questions: Q1 - a gate / door / garage switch is NOT a sensitive class in schedules (as decided; no `access` -> `door` mapping). Q2 - "all will be classified as suitable for control unless we said otherwise about a specific switch": a switch is excluded from group actions ONLY when an administrator explicitly protects it, or a hard rule applies (alarm-managed, door layer, multimedia-managed, scheduler component). This **deliberately overturns the fail-safe** of sections 4.1 (order 6, `switch_unclassified`), 5.2 (M1, M2) and R3 and the auto-protection of sections 6.3-6.5. What changed:

- **Included by default.** A new switch, and a switch the classifier has not judged yet, is included in group actions. `switch_unclassified` no longer exists (reason, label and row value `unclassified` removed). `SwitchPolicy` reads only the administrator's protection: a row of `device_bulk_protected` with `source = 'manual'` or `reviewed = 1`.
- **The classifier only suggests.** A hit still creates a row (`source = 'auto'`, `reviewed = 0`, category and rule) - now a *suggestion*: listed in the review screen as "מוצע להגנה", never enforced. Approving it (`approve`, or `protect` on it) sets `reviewed = 1` and enforces it; dismissing it (`unprotect`) deletes the row and writes the verdict `admin_cleared`, so it is never suggested again. The list reply carries `protected` (enforced) and `suggested`; the summary has `suggested` instead of `auto_unreviewed`.
- **Migration 0049 unchanged.** It never wrote a protected row (it only copies `device_bulk_safe` into the verdict `was_safe`), and 0049 has not been released: it is on no tag, `main` or `g0/intake`; only integration branches (`pilot/wave1-0153`, `integ/0153`) carry it. No data migration is needed; a development database that already holds `auto` rows keeps them and reads them as suggestions, admin decisions (`manual` rows, reviewed rows) are untouched.
- **Security consequence (accepted by the owner).** Immediately after the upgrade, and for every newly appearing switch, "כבה הכל" and the master button reach every switch that is not hard-excluded and not explicitly protected, including a pump, boiler or router the classifier would have suggested protecting. The residual risk of section 5.1 is therefore larger than designed; the only mitigations left are the suggestions in the review list, the unchanged confirmation dialog with its excluded list, the digest check, `devices.control_bulk` being limited to site and system administrators, and the audit rows. The auto-suggestion audit action `devices.bulk_protected.auto` now records a suggestion.
- **Frontend.** The strip reads "N מתגים מוצעים להגנה ... נכללים ב'כבה הכל' עד שתאשרו" with "הצג" and "הגן על כולם"; selection actions are "הגן", "הסר הגנה", "דחה הצעה". The "טרם נבדק" status was dropped (a switch nobody judged is simply unprotected).
