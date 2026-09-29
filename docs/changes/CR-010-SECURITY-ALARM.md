# CR-010 — Security area: live, investigation and the intrusion alarm in one place

**Numbering:** CR-010 as assigned by the coordinator on 2026-09-29 (renumbered at merge if needed). Task card T093
(the next free id on this branch).

**Status:** requested by the owner on 2026-09-29 ("important task", wanted by the next morning). Built on branch
`pilot/CR010-security-alarm`; build status in §9.

## 1. The request (owner, 2026-09-29, translated)

1. Today the app has two top-level areas, "לייב" (live) and "חקירה" (investigation). Make them sub-sections of one
   top-level section "אבטחה" (security) and add a third sub-section "אזעקה" (alarm), so every security component
   lives in one place: אבטחה › לייב | חקירה | אזעקה.
2. The alarm sub-section pulls the alarm from the platform (the `alarm_control_panel` entities), shows its state and
   lets the user control it (arm / disarm), and pulls the alarm's sensors and each sensor's bypass switch - from the
   same integration the alarm came from.

## 2. Facts that shape the design

- The entity mirror already holds everything the alarm needs: `ha_entities` rows with state, allow-listed
  attributes, `platform`, `device_id`, `unique_id`, area and floor (services/ha_sync.py). The entity registry also
  reports `config_entry_id`; the mirror did not keep it. It is added (migration 0036) so two systems of one
  integration (two Risco sites, two PAI panels) never mix their zones.
- Actions already travel one way only: the add-on signs `{user_id, domain, service, data, request_id}` and the
  `smplwise_bridge` integration re-issues the service call with the user's own Context (services/ha_bridge.py,
  ADR-012). `alarm_control_panel.alarm_arm_home / arm_away / disarm` were already allow-listed (T040), with
  `alarm.disarm` as a sensitive grant on top of `ha.entity.control`.
- Home Assistant's alarm entity exposes `supported_features` (ARM_HOME 1, ARM_AWAY 2, ARM_NIGHT 4, TRIGGER 8,
  ARM_CUSTOM_BYPASS 16, ARM_VACATION 32), `code_format` (null / number / text), `code_arm_required` and
  `changed_by` in its state attributes. A code is passed as the `code` field of the service call.
- Zones and bypass are integration-specific. What each integration really creates (read from the integration's code
  or documentation on 2026-09-29):

| Integration (platform) | Zones | Bypass control | Source |
|---|---|---|---|
| Risco (`risco`, core) | one device per zone; `binary_sensor.<zone>` (+ `_alarmed`, `_armed` in local mode); attribute `zone_id`; unique id `<site>_zone_<n>` | `switch.<zone>_bypassed` on the zone's device, unique id `<site>_zone_<n>_bypassed`, entity category config | core `risco/switch.py`, `binary_sensor.py`, `entity.py` - verified |
| Visonic PowerMax / PowerMaster (`visonic`, HACS) | `binary_sensor.visonic_zNN_zone`, attributes zone / tamper / armed | `select.visonic_zNN_arm_mode`, options `bypass` / `armed`, same device as the zone | davesmeghead/visonic `select.py`, `binary_sensor.py` - verified |
| Paradox via PAI (`mqtt`) | `binary_sensor.<zone>_open`, `_tamper`; zones on the panel device (per-zone devices since PAI PR 619) | `switch.<zone>_bypassed` when `bypassed` is in HOMEASSISTANT_PUBLISH_ZONE_PROPERTIES | PAI wiki + PR 619 - naming shape verified, exact object ids depend on the PAI prefix |
| Ajax via "Aegis for Ajax" (HACS) | `binary_sensor.<device>_<kind>`, one device per Ajax device | `switch.<device>_bypass` (on = deactivated), option `bypass_switches` | bvis/aegis-hass README - verified; platform id guessed as `aegis_ajax` |
| PIMA Force (`pima_force`, HACS, amithalp) | one binary sensor per zone, Hebrew panel names, zone attributes | `switch.zone_<n>_bypass`, disabled by default | project README - naming verified from its troubleshooting text; platform id guessed |
| DSC / Honeywell via Envisalink (`envisalink`, core) | one binary sensor per zone, attribute `zone` (number) | none | core docs - verified (no bypass) |
| Satel Integra (`satel_integra`, core) | binary sensors for zones and outputs | none | core docs - verified (no bypass) |
| Alarmo (`alarmo`, HACS) | none of its own: Alarmo watches existing sensors chosen in its own settings; the panel reports `open_sensors`, `bypassed_sensors`, `arm_mode` | none (force-arm bypasses open sensors) | nielsfaber/alarmo README - verified |
| Crow (Runner / Shepherd) | no maintained integration found | - | not found |

## 3. Navigation

- Design A's rail (and the phone bottom bar) becomes **אבטחה · מפה · חשמל · WisKey · מערכת**. "אבטחה" holds three
  sections, **לייב | חקירה | אזעקה**, shown as a segmented control in the top bar (on every width, the phone
  included, so the hierarchy stays readable: area in the rail / bottom bar, section in the top bar, the section's
  own pages - e.g. תמונת מצב / כל המצלמות / תצוגות שמורות / בריאות מצלמות - in the existing tab row under it).
- Routes do not move: `#/live/...`, `#/investigate/...`, `#/system/devices` (camera health, a live page) keep
  working as they are - deep links, the Lovelace card views (`embed=1`), the kiosk, the guide's screens.json and the
  saved start screen. New routes: `#/security/alarm` (the alarm section) and `#/security` (opens the section the user
  used last in this browser, default לייב, falling back to the first section they may see).
- Section gating follows the existing tab gating (nav.ts TAB_PERMISSIONS): לייב and חקירה as before, אזעקה only with
  `alarm.view`. The security area stays in the rail while any of its sections is visible, so the NVR-less mode shows
  it with the alarm section only.
- Breadcrumbs: אבטחה › <section> › <page>. Ctrl+K: the search offers the three sections as page targets, and an alarm
  panel found by name opens `#/security/alarm?panel=<id>`.
- Design B (flat entries) gets one more flat entry, "אזעקה", next to its existing security groups; it lands in the
  phone's "עוד" menu.

## 4. Alarm discovery (backend, services/alarm.py)

A **panel** is one `alarm_control_panel` entity: state (disarmed, armed_home, armed_away, armed_night,
armed_vacation, armed_custom_bypass, pending, arming, triggered, unavailable), the arm modes its `supported_features`
offer, whether a code is needed to arm / to disarm (`code_format`, `code_arm_required`), `changed_by`, and for Alarmo
the `open_sensors` / `bypassed_sensors` it reports.

Its **zones** are the `binary_sensor` entities of the same integration (platform) and the same config entry. Within
them, auxiliary sensors (`_alarmed`, `_armed`, `_tamper`, `_battery`, `_trouble`, device class tamper / battery)
attach to the zone of the same device or the same stem instead of becoming zones of their own; one that finds no zone
stays a zone. When one config entry holds several panels (partitions) the zones are listed on each of them, marked
as shared, until an administrator assigns a zone to one panel.

A zone's **bypass control** is a `switch` (or a `select` with a bypass option - Visonic) of the same integration
carrying a bypass marker (`bypass`, `bypassed`, "עקיפה"), paired by these strategies, in order:

1. the administrator's manual pairing (settings);
2. the same device as the zone (a device holding exactly one zone);
3. the same stem after removing the property markers (`switch.<zone>_bypassed` ↔ `binary_sensor.<zone>`,
   `switch.bypass_<zone>`, `<zone>_open` ↔ `<zone>_bypassed`), on the entity id, then on the unique id;
4. the same name once the bypass words are removed;
5. the zone number: the zone's `zone_id` / `zone` / `zone_number` attribute against the number in the switch's id
   (`switch.zone_3_bypass`).

The per-integration shapes are one small table (`INTEGRATIONS` in services/alarm.py: label, how a select says
"bypassed" / "armed", extra markers, notes) - adding an integration is one entry plus a test. A zone without a pair is
shown without a bypass control; a bypass control that pairs with nothing is listed under "ללא שיוך" (unpaired), so
nothing is hidden. Only the administrator's overrides are stored (migration 0036, `alarm_zone_overrides`: zone →
panel, zone → bypass control or "none", zone excluded); state is never copied - it is the existing mirror.

## 5. Control (backend, routers/alarm.py)

- `GET /alarm/panels` - the panels the caller may see with their zones, bypass controls, unpaired controls, what the
  caller may do on each, and the remote-control settings. `POST /alarm/panels/{id}/actions` with
  `{action: arm_home|arm_away|arm_night|arm_vacation|arm_custom_bypass|disarm, code?, confirmed, client_request_id,
  expires_at}`; `POST /alarm/zones/{zone}/bypass` with `{bypassed, confirmed, client_request_id, expires_at}`.
  Trigger is never exposed.
- Both run through the existing device-action path: the allow-list (`ha_bridge.ACTIONS`, now with arm_night,
  arm_vacation and arm_custom_bypass, all "attention"), an `ha_actions` record, the signed bridge call, the
  confirmation poll (`GET /ha/actions/{id}`; arming counts as accepted when the panel reports `arming`). The bypass
  call targets the control the server itself paired with that zone - the client never names a switch, so
  `alarm.bypass` cannot toggle an arbitrary switch.
- **The code** is asked for each time the panel needs one, travels in the request body over the existing
  authenticated channel, is added to the service call's data and nothing else: never stored (the `ha_actions`
  arguments exclude it), never logged, never audited, never cached, never put in a URL, never echoed in an error
  (the bridge's error text is replaced by the error code; any text is scrubbed of the code before it is used).
- **Permissions** (new, in the catalogue, roles.json and the design role catalogue): `alarm.view` (viewer and above),
  `alarm.arm` (operator and above), `alarm.disarm` (existing, sensitive; now granted by default to site_admin and
  system_admin, like access.release), `alarm.bypass` (new, sensitive; site_admin and system_admin). Editor and kiosk
  hold none of the control permissions; kiosk does not see the alarm. Scope: a panel is an entity - installation-wide
  holders see every panel, a floor binding sees the panels placed on its floors (the entity reach rule of
  services/ha_scope.py), and every action is authorised at the panel's own scope.
- **Confirmation** (as CR-007's dangerous actions): disarm and bypass (on or off) need `confirmed: true`; arming does
  not.
- **Remote channel** (`/arx`): allowed for holders of the permission, audited with `channel: remote`. Two settings in
  הגדרות › מערכת › אזעקה: `alarm.remote_control` (default on: off refuses every alarm action from outside) and
  `alarm.remote_disarm` (default on: off refuses disarming and bypassing a zone from outside - both lower
  protection). The general `/ha/entities/{id}/actions` route honours the same two settings for alarm panels.
- **Rate limit:** at most 5 code-bearing or disarm attempts per user in 5 minutes (429 with the wait); an arm attempt
  with a code counts too, otherwise arming would be an oracle for guessing the code. In memory, per process.
- **Answers:** the platform's refusal of a code (`invalid_code`, `invalid_code_format`, `code_arm_required` - the
  bridge 0.2.6 names them; an older bridge reports `ServiceValidationError`) becomes "הקוד שגוי או שהלוח דחה את
  הפקודה" and nothing else.
- **Audit:** `alarm.arm`, `alarm.disarm`, `alarm.bypass` rows with actor, panel (or zone and control), action,
  outcome and channel - never the code.

## 6. The alarm section (frontend/src/screens/security-alarm.ts)

Per panel: a header card with the state, big and colour-coded ("מנוטרלת", "מופעלת חלקית" / "מופעלת מלאה" /
"מופעלת - לילה" / "חופשה" / "עקיפה מותאמת", "בהשהיית יציאה", "בהשהיית כניסה", "אזעקה!", "לא זמינה"), who changed it
last, the arm buttons the panel supports and disarm. When a code is needed a keypad dialog opens (numeric keypad on
the phone, masked input, no autocomplete, cleared on close and after sending). "מוכנה לדריכה?" lists the open and
faulty zones before arming. The zones list, grouped by area, with live state (פתוח / סגור / תנועה / תקלה / עקוף),
last change, battery and tamper where reported, and the bypass switch (confirmation, permission). Filters: פתוחים
בלבד, עקופים, תקלות. Several panels: a panel switcher. Live updates from the existing state stream (`/ha/ws`) with a
periodic refetch as a fallback. Empty state without any panel: a short explanation pointing the installer to Settings.
Design: the app's own visual language (v2 tokens, the device tiles), RTL, phone first; no platform name in the copy.

## 7. Settings (הגדרות › מערכת › אזעקה)

The discovered panels with their integration and entity ids, the zone ↔ bypass pairing table with the strategy that
paired each row, manual overrides (pair, "no bypass", assign to a panel, exclude), the unpaired controls, and the two
remote switches. Technical names are allowed here (docs/design/UI_COPY_RULES.md).

## 8. Scope impact

Migration 0036 (config entry id column, `alarm_zone_overrides`), a new service and router, two permissions, three
allow-list actions and the bridge 0.2.6 (the three services and the code-refusal answer), the shell navigation, one
screen, one settings card, docs and tests. No device is touched by the tests; nothing is armed or disarmed for real.

## 9. Build status

(filled in as the build progresses)

## 10. Open questions for the owner

1. Which integration does the owner's alarm use (Risco / Visonic / PIMA / Paradox / other)? The pairing was verified
   against documentation and code, not against a real panel.
2. Remote disarm: keep the default "allowed for holders of alarm.disarm", or off by default?
3. `alarm.disarm` for site_admin by default (as requested) - or system_admin only?
