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

**Risco, the owner's system (owner answer 2026-09-29 21:45 - first-class, exact pairing).** Read from the core source
(homeassistant/components/risco: const.py, alarm_control_panel.py, entity.py, binary_sensor.py, switch.py): one
`alarm_control_panel` per partition (unique id `<site uuid>_<partition>` in cloud mode, `<system id>_<partition>_local`
in local mode; the device is the partition); the options `code_arm_required` / `code_disarm_required` (both off by
default) make `code_format` "number" when either is on and set `code_arm_required`; a wrong code is logged by the
integration and ignored (no error reaches the caller); `risco_states_to_ha` / `ha_states_to_risco` map Risco's arm /
partial_arm / groups A-D to armed_away / armed_home by default and may map to armed_night / armed_custom_bypass, and
`supported_features` follows that mapping. Each zone is its own device: `binary_sensor.<zone>` (device class motion
for every zone, attribute `zone_id`, unique id `<system>_zone_<n>[_local]`), in local mode also
`binary_sensor.<zone>_alarmed` / `_armed`, and `switch.<zone>_bypassed` (entity category config, unique id
`..._bypassed`). Arx pairs a Risco zone with its bypass switch only by the device, then by the system + zone number of
the unique id - never by a name; zones are shown as "open / closed" (the motion class says nothing for Risco).

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
- **Codes** follow §5a (the owner's code policy, 2026-09-29 21:45, which replaces the brief's "never stored"). A code
  the user types travels in the request body over the existing authenticated channel only; the code sent to the panel
  is added to the service call's data and nothing else: never in the `ha_actions` arguments, a log line, an audit
  row, a cache, a URL or an error (the bridge's error text is replaced by the error code; any text is scrubbed of the
  code before it is used).
- **Permissions** (new, in the catalogue, roles.json and the design role catalogue): `alarm.view` (viewer and above),
  `alarm.arm` (operator and above), `alarm.disarm` (existing, sensitive; now granted by default to site_admin and
  system_admin, like access.release), `alarm.bypass` (new, sensitive; site_admin and system_admin). Editor and kiosk
  hold none of the control permissions; kiosk does not see the alarm. Scope: a panel is an entity - installation-wide
  holders see every panel, a floor binding sees the panels placed on its floors (the entity reach rule of
  services/ha_scope.py), and every action is authorised at the panel's own scope.
- **Confirmation** (as CR-007's dangerous actions): disarm and bypass (on or off) need `confirmed: true`; arming does
  not.
- **Remote channel** (`/arx`): allowed for holders of the permission, audited with `channel: remote`. Settings in
  הגדרות › מערכת › אזעקה: `alarm.remote_control` (default on: off refuses every alarm action from outside),
  `alarm.remote_disarm` (default on: off refuses disarming and bypassing a zone from outside - both lower
  protection) and `alarm.remote_codeless` (§5a). The general `/ha/entities/{id}/actions` route honours the remote
  settings for alarm panels, and - since it carries no code - serves an alarm action only to a caller whose policy for
  it is `no_code` (409 `code_policy` otherwise: the alarm screen is the way).
- **Rate limits:** wrong codes verified by Arx (a PIN, or the panel code in `panel_code` mode): 5 in 5 minutes per user
  OR per panel lock that user / panel out of code entry for 10 minutes (429 `code_locked`), audited. A code passed
  through to the panel (no stored code) and every disarm: 5 attempts in 5 minutes (per user and panel for a typed
  code, per user for a disarm), 429 `rate_limited`. In memory, per process (the add-on runs one worker).
- **Answers:** the platform's refusal of a code (`invalid_code`, `invalid_code_format`, `code_arm_required` - the
  bridge 0.2.6 names them; an older bridge reports `ServiceValidationError`) becomes "הקוד שגוי או שהלוח דחה את
  הפקודה" and nothing else.
- **Audit:** `alarm.arm`, `alarm.disarm`, `alarm.bypass` rows with actor, panel (or zone and control), action,
  outcome and channel - never the code.

## 5a. The code policy and its threat model (owner decisions 2026-09-29 21:45 and 21:50)

**What is stored.** (1) The PANEL code, one per panel / partition, typed once by an administrator in הגדרות › מערכת ›
אזעקה (`system.configure`, audited without the value), stored in `alarm_panel_codes` encrypted with AES-256-GCM
(the `cryptography` package already in the image); the associated data is the panel's entity id, so a ciphertext
moved to another panel's row does not decrypt. The API is write-only: it reports "set", when and by whom, never the
code. (2) Per user: `arm_policy` and `disarm_policy` = `no_code` | `code_required` (default `code_required`;
bypass follows disarm), in `alarm_user_policy`, set in משתמשים והרשאות next to the remote-access flag
(`system.configure`). (3) A personal Arx PIN per user (4-8 digits), stored only as a salted scrypt hash (N=2^14,
r=8, p=1); set by the user (changing it needs the current one) or by an administrator; revocable per user.

**What the user types** (`alarm.code_mode`, default `personal_pin`): `no_code` - nothing; Arx sends the stored panel
code when the panel needs one. `code_required` - the user's PIN (`personal_pin`), verified by Arx, after which Arx
sends the stored panel code; or the panel's own code (`panel_code`), compared in constant time with the stored one.
Without a stored code, a panel that needs one gets the code the user types passed through (the panel verifies it;
nothing is stored); a panel that needs none cannot be verified in `panel_code` mode and the action is refused
("unverifiable"). Remote: `alarm.remote_codeless` (default ON - owner decision 2026-09-29 21:50: he relies on the
Android app's biometric lock and plans 2FA) lets `no_code` users act without a code from outside too; OFF makes
every remote arm / disarm / bypass ask for a code. Factually: the biometric lock exists only in the Android app and
only when switched on there - a browser or installed-PWA session from outside has no such lock, so with the default a
stolen unlocked phone or a signed-in browser can disarm without a code. Every remote action is audited with
`channel: remote`.

**The key** is 32 random bytes in `<data>/keys/alarm-codes.key`, created on first use with mode 0600 in a 0700
directory (the evidence signing keys' directory and policy, services/signing.py; written in binary mode). It is never
logged, returned, audited, exported, or put in a support bundle (there is none that reads `/data`).

**Backups.** An Arx project backup (services/backup.py) contains neither alarm table and never `keys/`: it carries
no ciphertext, no PIN hash and no key. A Home Assistant backup of the add-on (`backup: hot`, the whole `/data`)
contains the database AND the key file: whoever holds that backup file can decrypt the panel codes - the same
exposure the VAPID key and the signing keys already have (DOCS.md, notifications). Keep those backups private; after
a leak, change the panel's code at the panel and re-enter it in Arx (clearing a code: הגדרות › מערכת › אזעקה).

**Who can read what.** Anyone with a shell on the Home Assistant host (the Supervisor, SSH / terminal add-on users,
Home Assistant administrators who can reach the add-on's data) can read `/data` - database and key - and so the
panel codes: the encryption protects against a copied database or an Arx project backup, not against the host's
administrators. An Arx administrator (`system.configure`) can replace or clear a panel code, set any user's policy
and PIN, and switch the remote settings - all audited without values - but cannot read a code or a PIN back. Home
Assistant itself sees the panel code in the service call, exactly as it does for its own alarm card (its event bus
carries service data). A user with `no_code` never learns the panel code; a PIN user never learns it either.

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

The discovered panels with their integration and entity ids, the write-only panel code, the zone ↔ bypass pairing
table with the strategy that paired each row, manual overrides (pair, "no bypass", assign to a panel, exclude), the
unpaired controls, the remote switches and the code mode. Each user's arm / disarm policy and PIN are in the user
drawer of משתמשים והרשאות. Technical names are allowed here (docs/design/UI_COPY_RULES.md).

## 8. Scope impact

Migration 0036 (config entry id column, `alarm_zone_overrides`, `alarm_panel_codes`, `alarm_user_policy`), two new
services and a router, three new permissions (alarm.disarm existed), three
allow-list actions and the bridge 0.2.6 (the three services and the code-refusal answer), the shell navigation, one
screen, one settings card, docs and tests. No device is touched by the tests; nothing is armed or disarmed for real.

## 9. Build status

Built on `pilot/CR010-security-alarm` (2026-09-29), not merged, no version bump:

- Backend: services/alarm.py (discovery, pairing - Risco exact: device, then the system + zone number of the unique id,
  never a name guess), services/alarm_codes.py (encryption, PINs, policy, code plan, lockout), routers/alarm.py,
  migration 0036, permissions, allow-list, bridge 0.2.6, the general route's alarm gate, search. Tests:
  tests/test_alarm.py 26 (Risco 2 partitions / 8 zones and PAI fixtures in tests/fake_alarm.py; the code and the PIN
  are grepped in the captured log, every audit row, every ha_actions row, the replies and the raw database files);
  the affected existing suites (ha, ha_adapters, ha_authority, devices, lovelace_card, migrations, search, ui_settings,
  rbac, rbac_matrix, me_permissions, custom_roles, bridge_install) 86 passed.
- Frontend: the security area (nav.ts, sw-app.ts, router.ts), security-alarm.ts, system-alarm.ts (settings tab and
  the user drawer), Ctrl+K page targets. Playwright evidence-alarm.spec.ts: demo navigation 21/21, live against the
  fixture backend 12/12; screens spec 99/99; screenshots in docs/evidence/CR010.
- Known limits: two partitions of one Risco system show every zone on both (marked "משותף") until an administrator
  assigns zones - Home Assistant does not report a zone's partition. Risco ignores a wrong code silently: the action
  then ends "not confirmed" after 20 s rather than "wrong code". Only switch and select bypass controls are
  supported (no button). Lockout and rate limits are in memory (a restart clears them). The bridge must be 0.2.6
  (restart Home Assistant once) for arm_night / arm_vacation / arm_custom_bypass and the code-refusal answer. Nothing was
  run against a real panel.

## 10. Open questions for the owner

1. `alarm.disarm` and `alarm.bypass` for site_admin by default (as requested) - or system_admin only?
2. Two Risco partitions: show shared zones on both panels (now), or ask the installer to assign each zone once?
3. Operator arms by default - keep, or arm only for site_admin and above?
