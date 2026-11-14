"""USR2 phase 3: the SERVICE IDENTITY - the add-on side (design record docs/design/USR2_ARX_ONLY_IDENTITY_SPEC.md section 12.2).

An Arx-only (local) identity has no Home Assistant account, so a feature that acts in Home Assistant "as the user" cannot name it. Instead
the signed bridge message names ONE non-administrator Home Assistant user - the service identity, `identity.service_user_id` here and the
bridge's own options-flow copy there - and carries the person for ATTRIBUTION only:

    {"user_id": "<service HA user id>", "on_behalf_of": {"kind": "local", "user_id": "<the principal's l_ id>", "feature": "<key>"}, ...}

Rules (both sides enforce; the bridge has the same table in custom_components/smplwise_bridge/service_identity.py - drift-tested):
- Only for a local principal, only while `security.local_identity` is on, only for an active, not deleted local user. `on_behalf_of.user_id`
  is always the AUTHENTICATED principal's id (the session) - never a value from a request body or a header.
- The Arx permission checks of the route run first, exactly as for a Home Assistant user; this module only decides whether the bridge
  call may be made at all: feature -> bridge service -> item (FEATURES).
- The service id must be configured, 32 hex, a known, active Home Assistant user who is NOT a Home Assistant administrator and not an Arx
  system administrator; the bridge must be >= 0.9.0 (BRIDGE_SERVICE_IDENTITY_REQUIRED).
- Automation / script / scene writes and runs: refused (`automation_write_requires_ha_identity`); the area write, the camera stream source
  and door actions are not in any feature (refused). NEVER_LOCAL (zone-bypass arming, doors, `script.turn_on`, `scene.turn_on`) is refused
  by an explicit rule before the tables, and the alarm zone-bypass route refuses a local principal itself (security review F1 / F2).
  A Home Assistant principal is untouched: subject() returns `{"user_id": <its id>}`.
- The service user is never a person (security review F4): signing in to Arx as it is refused (`service_account`), it cannot be given an
  Arx role, and the self-check flags a sign-in recorded before it was configured.
- Entity reach: Home Assistant does not bound what the service user's in-process service call may touch (the bridge `execute` handler has
  no per-entity check), so Arx's scope (`ha_scope`) is the sole entity guard for an Arx-only person (security review F5).
- SVCIDENT2 (owner decisions 2026-10-17, CR-USR2 section 11): the switch `security.local_identity_extended` (off by default; with it off
  everything above holds exactly as in 2.6.4). With it on - AND `security.local_identity` on AND the bridge's own options-flow copy reported
  on (bridge >= 0.9.1) - NEVER_LOCAL shrinks to NEVER_LOCAL_EXTENDED (the area write only) and EXTENDED_FEATURES applies: doors and
  scripts / scenes under `devices.control`, `arm_custom_bypass` under `alarm`, a zone's bypass control under `alarm.bypass`, the camera
  stream source under `cameras.live`. Each still needs the route's own Arx permission first; allowed extended items are audited
  `identity.service_identity.extended` (ids only). A WisKey door is judged by door_authority for a local user in this mode (local_door_ok).
  A security review is required before the switch is ever turned on.
- SVCIDENT3 (the 2.7.0 security review S1 / S2, CR-USR2 section 12): in the extended mode a script / scene / automation runs for an Arx-only
  person only when its entity id is on the per-installation allowlist `security.local_identity_runnable` (EMPTY by default; a system
  administrator on the local channel, audited `identity.service_identity.runnable`) - checked here with the entity id the route passes in -
  AND on the bridge's own options-flow copy (reported with the directory push); the bridge (>= 0.9.2) checks its copy again, reads the item's
  steps (the impact check: no door, no disarm, no arming with the bypass set, nothing outside the closed step list, one nested level) and
  applies the service user's Home Assistant entity policy to every entity of a message sent on behalf of an Arx-only person (S2). Every
  extended item therefore needs a 0.9.2 bridge. EXTENDED_GO_LIVE_PERMITTED stays False: flipping it needs the owner's explicit permit, an
  approved amendment of docs/security/HA_IDENTITY_RBAC_HE.md sections 7-8 and a Fable re-review.
- EXTID-295 (Fable review 4, owner decisions 1 and 3 of 2026-10-21; CR-USR2 13.6 / 13.7): every extended item needs bridge 0.9.6 (the V-01
  fix of the impact check) AND the bridge's report that the service user is restricted (a group whose entity policy does not allow every
  entity - `bridge.service_policy_restricted`); while that report is not "true" every item only the extended mode admits is refused 503
  `service_identity_policy_default` (audited reason `policy_default`). The bridge refuses the same with its live check.
- ENTPOL-295 (owner decision 3 of 2026-10-21, fail closed): a "true" report counts only while it is current - the last accepted directory
  push (`bridge.directory_at`) at most POLICY_REPORT_MAX_AGE_S old; otherwise (Home Assistant unreachable, pushes stopped, an unreadable or
  future time) every extended item is refused 503 `service_identity_policy_default` - the binding text's "cannot be determined" (§3א ו) -
  audited with its own reason `policy_stale` and its own message. The bridge's live check also
  asks Home Assistant's own permission object whether the service user may control every entity, and refuses on any ambiguous policy value.
"""
from __future__ import annotations

import json
import logging
import re
import sqlite3
from datetime import datetime, timezone
from typing import Any

from ..audit import audit
from ..db import get_setting, set_setting
from ..errors import ApiError
from ..rbac import LOCAL_ID_PREFIX, Principal, is_system_admin

log = logging.getLogger("smplwise.service_identity")

SETTING = "identity.service_user_id"
BRIDGE_SETTING = "bridge.service_user_id"  # what the bridge reported in its last directory push (its options-flow copy)
BRIDGE_CAPABLE = "bridge.service_identity"  # "true" once a >= 0.9.0 bridge announced the capability
BRIDGE_SERVICE_IDENTITY_REQUIRED = "0.9.0"
HA_USER_ID_RE = re.compile(r"[0-9a-f]{32}")
LOCAL_ID_RE = re.compile(r"l_[0-9A-HJKMNP-TV-Z]{26}")

# Never for a local identity, whatever a feature table says - an explicit rule checked before the tables (security review F1 / F2,
# 2026-10-16; owner default: every open question stays refused until answered). Identical to the bridge's NEVER_LOCAL (drift-tested):
# zone-bypass arming (open question 2), doors (1), scripts and scenes - which may unlock a door or disarm under the service user (5).
# This is the list while `security.local_identity_extended` is OFF (the default): exactly the 2.6.4 behaviour.
NEVER_LOCAL = frozenset({
    ("alarm_control_panel", "alarm_arm_custom_bypass"), ("lock", "unlock"), ("lock", "open"), ("script", "turn_on"), ("scene", "turn_on"),
})
# SVCIDENT2 (owner decisions 2026-10-17, CR-USR2 section 11): with `security.local_identity_extended` ON (add-on) AND the bridge's own
# options-flow copy ON, only the area write (the spec's `devices.area`, owner decision 4) stays on the never-list. A non-execute bridge
# service is named as the Home Assistant service it is (`smplwise_bridge.<service>`), so one list of (domain, service) pairs covers both.
AREA_WRITE = ("smplwise_bridge", "set_entity_area")
NEVER_LOCAL_EXTENDED = frozenset({AREA_WRITE})
EXTENDED_SETTING = "security.local_identity_extended"
BRIDGE_EXTENDED = "bridge.local_identity_extended"  # what the bridge reported in its last directory push (its options-flow copy)
# SVCIDENT3: every extended item needs the bridge that carries the run fences (S1 b: the impact check, S2: the entity policy) - 0.9.2.
# EXTID-295 (Fable review 4, owner decisions 1 and 3 of 2026-10-21): 0.9.6 - the V-01 fix of the impact check (a step with more than one
# type key is refused) and the report of whether the service user is restricted (CR-USR2 13.6). An older bridge gets no extended item.
BRIDGE_EXTENDED_REQUIRED = "0.9.6"
# EXTID-295 (CR-USR2 13.6, owner decision 3 of 2026-10-21): the bridge's report (with every directory push, 0.9.6+) of whether the service
# user's Home Assistant entity policy is restricted - "true" / "false" / "" (unknown, or an older bridge). Every item only the extended mode
# admits is refused while it is not "true" (`service_identity_policy_default`); basic-mode items are not affected.
BRIDGE_POLICY = "bridge.service_policy_restricted"
# ENTPOL-295 (owner decision 3 of 2026-10-21, fail closed): the report above is trusted only while the bridge keeps pushing. The bridge pushes
# the directory every 60 s (`bridge.directory_at` is written on every accepted push); a report older than this - Home Assistant unreachable,
# the bridge stopped, the push refused - or a push time that cannot be read or lies in the future counts as no report, and every extended
# item is refused 503 with the same code as the default policy, `service_identity_policy_default` (HA_IDENTITY_RBAC_HE.md §3א ו: "or it cannot
# be determined"), audited reason `policy_stale`, message STALE_MESSAGE. Basic-mode items are not affected.
DIRECTORY_AT = "bridge.directory_at"
POLICY_REPORT_MAX_AGE_S = 300
POLICY_REPORT_SKEW_S = 60
STALE_MESSAGE = "רכיב החיבור לא אישר לאחרונה שזהות השירות מוגבלת (אין קשר עם תשתית המערכת), ולכן הפעולות המורחבות של משתמשי Arx נחסמות עד שהקשר יחזור."
# SVCIDENT3 (review S1 a): the scripts / scenes / automations (entity ids) Arx-only users may run in the extended mode - EMPTY by default
RUNNABLE_SETTING = "security.local_identity_runnable"
BRIDGE_RUNNABLE = "bridge.local_identity_runnable"  # the bridge's options-flow copy, as reported in its last directory push (JSON list)
RUNNABLE_RE = re.compile(r"^(script|scene|automation)\.[a-z0-9_]{1,100}$")
MAX_RUNNABLE = 100
# integ/270 (2.7.0 security review S7): the code-level go-live guard of the extended mode, the GO_LIVE_PERMITTED pattern of
# services/access_grants.py. While False the add-on switch cannot be turned on (PATCH /settings answers 409 `extended_not_permitted`) and
# extended_on() is False whatever the stored value says - everything behaves exactly as 2.6.4. It is flipped only in the commit that lands
# the review's S1 (a per-installation allowlist of runnable scripts / scenes / automations, default empty, + the bridge-side impact check)
# and S2 (the service user's HA entity-policy check in the bridge's execute handler), together with the owner-approved amendment of
# docs/security/HA_IDENTITY_RBAC_HE.md sections 7-8 (CR-USR2 section 11.8).
EXTENDED_GO_LIVE_PERMITTED = False
ALARM_PAIRS = frozenset({
    ("alarm_control_panel", "alarm_arm_home"), ("alarm_control_panel", "alarm_arm_away"), ("alarm_control_panel", "alarm_arm_night"),
    ("alarm_control_panel", "alarm_arm_vacation"), ("alarm_control_panel", "alarm_disarm"),
})
# The bridge's execute allow-list minus the alarm panel (its own feature, owner answer Q4) and minus NEVER_LOCAL (doors, scripts, scenes).
DEVICE_PAIRS = frozenset({
    ("light", "turn_on"), ("light", "turn_off"), ("switch", "turn_on"), ("switch", "turn_off"), ("fan", "turn_on"), ("fan", "turn_off"),
    ("cover", "open_cover"), ("cover", "close_cover"), ("cover", "stop_cover"), ("lock", "lock"),
    ("button", "press"),
    ("climate", "set_hvac_mode"), ("climate", "set_temperature"),
    ("media_player", "media_play"), ("media_player", "media_pause"), ("media_player", "media_stop"), ("media_player", "volume_set"),
    ("number", "set_value"), ("input_number", "set_value"), ("select", "select_option"), ("input_select", "select_option"),
    ("input_boolean", "turn_on"), ("input_boolean", "turn_off"), ("vacuum", "start"), ("vacuum", "return_to_base"),
    ("siren", "turn_on"), ("siren", "turn_off"),
    ("fan", "set_percentage"), ("cover", "set_cover_position"), ("climate", "set_fan_mode"), ("climate", "turn_off"),
    ("media_player", "turn_on"), ("media_player", "turn_off"), ("media_player", "volume_mute"),
    ("climate", "set_preset_mode"), ("climate", "set_swing_mode"), ("climate", "set_humidity"),
    ("humidifier", "set_humidity"), ("humidifier", "set_mode"),
    ("cover", "open_cover_tilt"), ("cover", "close_cover_tilt"), ("cover", "stop_cover_tilt"), ("cover", "set_cover_tilt_position"),
    ("media_player", "volume_up"), ("media_player", "volume_down"), ("media_player", "media_play_pause"), ("media_player", "media_next_track"),
    ("media_player", "media_previous_track"), ("media_player", "select_source"), ("media_player", "play_media"),
    ("remote", "send_command"), ("remote", "turn_on"), ("webostv", "button"), ("webostv", "select_sound_output"),
    ("media_player", "media_seek"), ("media_player", "shuffle_set"), ("media_player", "repeat_set"), ("media_player", "select_sound_mode"),
    ("media_player", "join"), ("media_player", "unjoin"), ("music_assistant", "play_media"), ("music_assistant", "transfer_queue"),
    ("vacuum", "pause"), ("valve", "open_valve"), ("valve", "close_valve"), ("water_heater", "turn_on"), ("water_heater", "turn_off"),
})
MEDIA_DOMAINS = frozenset({"media_player", "remote", "webostv", "music_assistant"})
MEDIA_PAIRS = frozenset(p for p in DEVICE_PAIRS if p[0] in MEDIA_DOMAINS)

FEATURES: dict[str, dict[str, frozenset[Any]]] = {
    "devices.control": {"execute": DEVICE_PAIRS},
    "alarm": {"execute": ALARM_PAIRS},
    "media": {"execute": MEDIA_PAIRS, "media_query": frozenset({"queue", "library"})},
    "cast": {"cast_stream": frozenset({"play", "stop", "off"})},
    "schedules": {"schedule": frozenset({"add", "edit", "remove", "copy", "run", "enable", "disable"})},
}

# SVCIDENT2: what the extended switch adds (owner decisions 1, 2, 3, 5 of 2026-10-17). Every item still needs the route's own Arx permission
# first (door.unlock / the door rule, alarm.bypass, sources.configure, ha.entity.control) - the tables only decide whether the bridge call
# may be made at all. Identical to the bridge's EXTENDED_FEATURES (drift-tested).
DOOR_PAIRS = frozenset({("lock", "unlock"), ("lock", "open")})  # `lock.open` is in neither execute allow-list today: listed for parity, still refused there
SCRIPT_SCENE_PAIRS = frozenset({("script", "turn_on"), ("scene", "turn_on")})
BYPASS_PAIRS = frozenset({("switch", "turn_on"), ("switch", "turn_off"), ("select", "select_option")})  # a zone's bypass control (the zone-bypass route only)
# SVCIDENT2 second round (owner 2026-10-17): RUNNING from the automations screen - an automation's "run now" (`trigger`), a script's run
# (`run_script`), a scene's apply (`apply_scene`). Never the writes (`upsert`, `delete`), never `enable` / `disable` / `stop_script`.
AUTOMATION_RUN_OPS = frozenset({"trigger", "run_script", "apply_scene"})
EXTENDED_FEATURES: dict[str, dict[str, frozenset[Any]]] = {
    **FEATURES,
    "devices.control": {"execute": DEVICE_PAIRS | DOOR_PAIRS | SCRIPT_SCENE_PAIRS},
    "alarm": {"execute": ALARM_PAIRS | {("alarm_control_panel", "alarm_arm_custom_bypass")}},
    "alarm.bypass": {"execute": BYPASS_PAIRS},
    "cameras.live": {"stream_source": frozenset({"read"})},
    "automations.run": {"config_item": AUTOMATION_RUN_OPS},
}
FEATURE_LABELS = {"devices.control": ("שליטה בהתקנים (בלי סקריפטים וסצנות)", "Device control (scripts and scenes excluded)"),
                  "alarm": ("אזעקה (דריכה / נטרול לפי כללי הקוד, בלי עקיפת אזורים)", "Alarm (arm / disarm under the PIN rules, no zone bypass)"),
                  "media": ("מדיה ומוזיקה", "Media and music"), "cast": ("שידור למסך", "Cast to a screen"), "schedules": ("תזמונים", "Schedules")}
REFUSED_LABELS = [("אוטומציות, סצנות וסקריפטים (כתיבה, הפעלה והרצה - גם מתוך שליטה בהתקנים)", "Automations, scenes and scripts (writing, running and activating - device control included)"),
                  ("עקיפת אזורי אזעקה ודריכה עם עקיפה", "Alarm zone bypass and arming with bypass"),
                  ("שיוך התקן לאזור", "Assigning a device to an area"), ("מצלמות בזרם חי דרך תשתית המערכת", "Live cameras through the infrastructure"),
                  ("פתיחת דלתות ומנעולים", "Opening doors and locks")]
# SVCIDENT2: the card's lists while the extended mode is on (both switches); each item still only under the person's own Arx permission
EXTENDED_FEATURE_LABELS = {
    "devices.control": ("שליטה בהתקנים, כולל סקריפטים וסצנות מרשימת ההרצה בלבד (לפי הרשאת שליטה)", "Device control, scripts and scenes from the runnable list only (under the control permission)"),
    # SVCIDENT3 (review S4): a WisKey door is opened by the door transport, not through the bridge - only the add-on's switch applies to it
    "doors": ("פתיחת דלתות ומנעולים (לפי הרשאת הדלתות של המשתמש). דלתות WisKey תלויות במתג של התוסף בלבד; מנעולים של תשתית המערכת - בשני המתגים",
              "Opening doors and locks (under the user's door permission). WisKey doors follow the add-on's switch alone; infrastructure locks need both switches"),
    "alarm": ("אזעקה (דריכה / נטרול לפי כללי הקוד; דריכה עם עקיפה דורשת הרשאת עקיפה)", "Alarm (arm / disarm under the PIN rules; arming with bypass needs the bypass permission)"),
    "alarm.bypass": ("עקיפת אזורי אזעקה (לפי הרשאת עקיפה)", "Alarm zone bypass (under the bypass permission)"),
    "cameras.live": ("מצלמות בזרם חי דרך תשתית המערכת (לפי הרשאת הגדרת מקורות)", "Live cameras through the infrastructure (under the sources permission)"),
    "automations.run": ("הרצת אוטומציות וסקריפטים והפעלת סצנות ממסך האוטומציות - מרשימת ההרצה בלבד (לפי הרשאות ההרצה)",
                        "Running automations and scripts and applying scenes on the automations screen - from the runnable list only (under the run permissions)"),
    "media": FEATURE_LABELS["media"], "cast": FEATURE_LABELS["cast"], "schedules": FEATURE_LABELS["schedules"],
}
EXTENDED_REFUSED_LABELS = [("שיוך התקן לאזור", "Assigning a device to an area"),
                           ("כתיבה של אוטומציות, סצנות וסקריפטים (יצירה, עריכה, מחיקה, שחזור), הפעלה / כיבוי של אוטומציה ועצירת סקריפט",
                            "Writing automations, scenes and scripts (create, edit, delete, restore), enabling / disabling an automation and stopping a script")]

MESSAGES = {
    "service_identity_refused": "הפעולה הזו אינה זמינה למשתמשי Arx.",
    "service_identity_unconfigured": "פעולות בתשתית המערכת למשתמשי Arx דורשות זהות שירות. מנהל המערכת מגדיר אותה בהגדרות › משתמשי Arx.",
    "service_identity_admin": "זהות השירות שהוגדרה היא משתמש עם הרשאות ניהול, ולכן הפעולה נחסמה. מנהל המערכת יבחר משתמש רגיל.",
    "service_identity_bridge_outdated": "נדרש עדכון של רכיב החיבור (0.9.0 ומעלה) כדי שמשתמשי Arx יוכלו לפעול בתשתית המערכת.",
    "service_identity_extended_bridge_off": f"הפעולה דורשת שהמצב המורחב של משתמשי Arx יופעל גם ברכיב החיבור ({BRIDGE_EXTENDED_REQUIRED} ומעלה) - מנהל בתשתית המערכת מפעיל אותו שם.",
    "service_identity_policy_default": "זהות השירות אינה מוגבלת בתשתית המערכת, ולכן הפעולות המורחבות של משתמשי Arx נחסמות. מנהל בתשתית המערכת משייך אותה לקבוצה שמתירה רק את ההתקנים ש-Arx רשאי להפעיל.",
    "service_identity_not_runnable":"הפריט הזה אינו ברשימת הסקריפטים, הסצנות והאוטומציות שמשתמשי Arx רשאים להריץ. מנהל המערכת מוסיף אותו בהגדרות › משתמשי Arx.",
    "service_identity_runnable_bridge_missing": "הפריט ברשימת ההרצה של Arx אך לא ברשימה של רכיב החיבור - מנהל בתשתית המערכת מוסיף אותו גם שם.",
    "automation_write_requires_ha_identity": "שמירה והפעלה של אוטומציות, סצנות וסקריפטים זמינות רק למשתמשי תשתית המערכת.",
    "local_identity_off": "משתמשי Arx כבויים בהגדרות המערכת.",
    "user_inactive": "המשתמש אינו פעיל.",
}


def is_local(principal_or_id: Any) -> bool:
    """A local (Arx-only) identity - by source or by the id form (either is enough: fail closed)."""
    if isinstance(principal_or_id, Principal):
        return principal_or_id.source == "local" or str(principal_or_id.user_id or "").startswith(LOCAL_ID_PREFIX)
    return isinstance(principal_or_id, str) and principal_or_id.startswith(LOCAL_ID_PREFIX)


def identity_ok(principal: Principal, settings: Any) -> bool:
    """The identity gate of the bridge routes: a Home Assistant user (Ingress / remote), a developer identity in developer mode, or - USR2
    P3 - a local identity, whose call then goes through subject() (which refuses everything outside the allow-list)."""
    return principal.source in ("ingress", "remote", "local") or bool(getattr(settings, "dev_user", None))


def _version_tuple(text: str | None) -> tuple[int, ...]:
    return tuple(int(x) for x in re.findall(r"\d+", text or ""))


def configured_id(conn: sqlite3.Connection) -> str | None:
    value = (get_setting(conn, SETTING) or "").strip()
    return value if HA_USER_ID_RE.fullmatch(value) else None


def _ha_user(conn: sqlite3.Connection, user_id: str) -> sqlite3.Row | None:
    try:
        return conn.execute("SELECT id, name, username, is_active, is_admin FROM ha_users WHERE id = ?", (user_id,)).fetchone()
    except sqlite3.OperationalError:
        return None


def candidate_refusal(conn: sqlite3.Connection, user_id: str) -> str | None:
    """Why this HA user id cannot be the service identity (None = acceptable): the id form, the directory, never an administrator."""
    if not HA_USER_ID_RE.fullmatch(user_id or ""):
        return "format"
    row = _ha_user(conn, user_id)
    if row is None:
        return "unknown_user"
    if not row["is_active"]:
        return "inactive"
    if row["is_admin"]:
        return "ha_admin"
    if is_system_admin(conn, user_id):
        return "arx_admin"
    return None


def extended_requested(conn: sqlite3.Connection) -> bool:
    """The add-on's switch `security.local_identity_extended` (off by default; a system administrator, audited; ON from the local channel
    only, OFF from either channel - SVCIDENT-AMEND273, owner decision 5 of 2026-10-18)."""
    try:
        return (get_setting(conn, EXTENDED_SETTING) or "off") == "on"
    except sqlite3.OperationalError:
        return False


def policy_restricted(conn: sqlite3.Connection) -> bool:
    """EXTID-295 (CR-USR2 13.6): the bridge reported (0.9.6+, last directory push) that the service user is restricted to a group whose entity
    policy does not allow every entity. Unknown, "false" or an older bridge = False (fail closed)."""
    try:
        return (get_setting(conn, BRIDGE_POLICY) or "") == "true"
    except sqlite3.OperationalError:
        return False


def policy_report_age_s(conn: sqlite3.Connection, now: datetime | None = None) -> float | None:
    """ENTPOL-295: seconds since the bridge's last accepted directory push (which carries the policy report), or None when there was none or
    the stored time cannot be read."""
    try:
        raw = get_setting(conn, DIRECTORY_AT) or ""
    except sqlite3.OperationalError:
        return None
    try:
        at = datetime.fromisoformat(raw.replace("Z", "+00:00"))
    except ValueError:
        return None
    if at.tzinfo is None:
        at = at.replace(tzinfo=timezone.utc)
    return ((now or datetime.now(timezone.utc)) - at).total_seconds()


def policy_report_fresh(conn: sqlite3.Connection, now: datetime | None = None) -> bool:
    """ENTPOL-295 (fail closed): the policy report is current - the last push is at most POLICY_REPORT_MAX_AGE_S old and not from the future
    (beyond a small clock skew). No push, an unreadable time or an old one = not fresh."""
    age = policy_report_age_s(conn, now)
    return age is not None and -POLICY_REPORT_SKEW_S <= age <= POLICY_REPORT_MAX_AGE_S


def _policy_report(conn: sqlite3.Connection) -> bool | None:
    try:
        value = get_setting(conn, BRIDGE_POLICY) or ""
    except sqlite3.OperationalError:
        value = ""
    return {"true": True, "false": False}.get(value)


def extended_go_live_permitted() -> bool:
    """integ/270 (review S7): whether this build may run the extended mode at all (EXTENDED_GO_LIVE_PERMITTED, False in 2.7.0)."""
    return EXTENDED_GO_LIVE_PERMITTED is True


def extended_on(conn: sqlite3.Connection) -> bool:
    """SVCIDENT2: the extended mode is in force only while BOTH Arx-only identities (`security.local_identity`) and the extended switch are
    on. The bridge decides again with its own options-flow copy (both must agree, else the bridge refuses: fail closed). integ/270 (S7):
    and only in a build whose go-live permit is set - never in 2.7.0."""
    from . import local_identity

    if not extended_go_live_permitted():
        return False
    return extended_requested(conn) and local_identity.enabled(conn)


def features(extended: bool) -> dict[str, dict[str, frozenset[Any]]]:
    return EXTENDED_FEATURES if extended else FEATURES


def never_list(extended: bool) -> frozenset[Any]:
    """NEVER_LOCAL with the extended switch off (the 2.6.4 list), NEVER_LOCAL_EXTENDED (the area write only) with it on."""
    return NEVER_LOCAL_EXTENDED if extended else NEVER_LOCAL


def feature_refusal(feature: str, bridge_service: str, item: Any, extended: bool = False) -> str | None:
    services = features(extended).get(feature)
    if not services or bridge_service not in services:
        return "service_identity_refused"
    try:
        return None if item in services[bridge_service] else "service_identity_refused"
    except TypeError:
        return "service_identity_refused"


def feature_for_pair(domain: str, service: str, *, media: bool = False) -> str:
    """The feature a generic execute belongs to: the alarm panel is `alarm`, a media route's call `media`, everything else `devices.control`."""
    if domain == "alarm_control_panel":
        return "alarm"
    return "media" if media and domain in MEDIA_DOMAINS else "devices.control"


def _refuse(conn: sqlite3.Connection, principal: Principal | None, user_id: str, code: str, status: int, *, feature: str, bridge_service: str, item: Any,
            request_id: str | None, reason: str | None = None, message: str | None = None) -> ApiError:
    try:
        audit(conn, actor=principal, action="identity.service_identity.refused", decision="denied", resource_type="user", resource_id=user_id,
              reason=reason or code, request_id=request_id,
              details={"feature": feature, "bridge_service": bridge_service, "item": _audit_item(item)})
    except Exception:  # noqa: BLE001 - the refusal itself must never fail because its audit row could not be written
        log.warning("service identity refusal not audited (%s)", code)
    return ApiError(status, code, message or MESSAGES.get(code, MESSAGES["service_identity_refused"]), details={"feature": feature})


def subject(conn: sqlite3.Connection, principal: Principal, feature: str, *, bridge_service: str, item: Any, request_id: str | None = None,
            entity_id: str | None = None) -> dict[str, Any]:
    """The identity fields of a signed bridge message. A Home Assistant (or developer) principal: `{"user_id": <its id>}` - unchanged. A local
    principal: the service identity + `on_behalf_of`, or ApiError (audited `identity.service_identity.refused`) - nothing is sent then.
    `entity_id` (SVCIDENT3): the script / scene / automation a run item targets - judged against the runnable allowlist (a run without it is
    refused)."""
    if not is_local(principal):
        return {"user_id": principal.user_id}
    # a principal that is local by source OR by id form is judged as local, whatever its id looks like (fail closed: a `source = local`
    # principal carrying a Home Assistant-shaped id is refused below, never passed on as that Home Assistant user)
    return _local_subject(conn, principal.user_id, feature, bridge_service=bridge_service, item=item, request_id=request_id, actor=principal, entity_id=entity_id)


def subject_for_user(conn: sqlite3.Connection, user_id: str, feature: str, *, bridge_service: str, item: Any, request_id: str | None = None,
                     actor: Principal | None = None, entity_id: str | None = None, quiet: bool = False) -> dict[str, Any]:
    """subject() for a stored principal id (a background follow-up of a local user's earlier request). `quiet` (SVCIDENT3, review S5): a
    background refresh writes no `identity.service_identity.extended` row each time (its own audit row records the refresh)."""
    if not is_local(user_id):
        return {"user_id": user_id}
    return _local_subject(conn, user_id, feature, bridge_service=bridge_service, item=item, request_id=request_id, actor=actor, entity_id=entity_id, quiet=quiet)


# A clean-up command that must still go out when the local person who started something can no longer act (security review F3): the
# session must not outlive its owner. Only these items; never a play, never anything that starts or changes a device.
CLEANUP_ITEMS = frozenset({("cast", "cast_stream", "stop"), ("cast", "cast_stream", "off")})


def subject_for_cleanup(conn: sqlite3.Connection, owner_id: str, feature: str, *, bridge_service: str, item: Any, actor: Principal | None,
                        request_id: str | None = None) -> dict[str, Any]:
    """subject_for_user() for a stop / power-off of a session whose owner is a local user who was disabled or deleted since.
    - the owner can still act (or is a Home Assistant user): exactly subject_for_user();
    - the owner is gone and the acting principal is a Home Assistant identity (an administrator ending the session): as that identity;
    - else (the janitor, a local administrator): the service identity, attributed to the acting local principal when there is one, else to the
      former owner - every other rule (switch on, configured non-administrator service user, bridge >= 0.9.0, the `cast` table) still holds.
    Audited `identity.service_identity.cleanup` with `sent_as`. Anything outside CLEANUP_ITEMS: the normal refusal."""
    try:
        return subject_for_user(conn, owner_id, feature, bridge_service=bridge_service, item=item, request_id=request_id, actor=actor)
    except ApiError as exc:
        if exc.code != "user_inactive":
            raise
    try:
        cleanup = (feature, bridge_service, item) in CLEANUP_ITEMS
    except TypeError:
        cleanup = False
    if not cleanup:
        raise _refuse(conn, actor, owner_id, "service_identity_refused", 403, reason="not_cleanup", feature=feature, bridge_service=bridge_service, item=item,
                      request_id=request_id)
    if actor is not None and not is_local(actor):
        subj, sent_as = {"user_id": actor.user_id}, "actor_ha"
    elif actor is not None:
        subj, sent_as = _local_subject(conn, actor.user_id, feature, bridge_service=bridge_service, item=item, request_id=request_id, actor=actor), "actor_local"
    else:
        subj = _local_subject(conn, owner_id, feature, bridge_service=bridge_service, item=item, request_id=request_id, actor=None, require_active=False)
        sent_as = "service_for_owner"
    audit(conn, actor=actor, action="identity.service_identity.cleanup", decision="allowed", resource_type="user", resource_id=owner_id,
          reason="owner_inactive", request_id=request_id, details={"feature": feature, "bridge_service": bridge_service, "item": item, "sent_as": sent_as})
    return subj


def never_local(bridge_service: str, item: Any, extended: bool = False) -> bool:
    """The explicit never-list - whatever the feature tables say. Switch off: NEVER_LOCAL (zone-bypass arming, doors, scripts, scenes);
    switch on: NEVER_LOCAL_EXTENDED (the area write). An `execute` item is its (domain, service) pair; any other bridge service is
    `("smplwise_bridge", <service>)`."""
    pair = item if bridge_service == "execute" else ("smplwise_bridge", bridge_service)
    try:
        return pair in never_list(extended)
    except TypeError:
        return True


def _local_subject(conn: sqlite3.Connection, user_id: str, feature: str, *, bridge_service: str, item: Any, request_id: str | None,
                   actor: Principal | None, require_active: bool = True, entity_id: str | None = None, quiet: bool = False) -> dict[str, Any]:
    args = {"feature": feature, "bridge_service": bridge_service, "item": item, "request_id": request_id}
    from . import local_identity

    if not LOCAL_ID_RE.fullmatch(user_id or ""):
        raise _refuse(conn, actor, str(user_id)[:40], "service_identity_refused", 403, reason="bad_local_id", **args)
    if not local_identity.enabled(conn):
        raise _refuse(conn, actor, user_id, "local_identity_off", 403, **args)
    row = conn.execute("SELECT active, deleted_at, source FROM users WHERE id = ?", (user_id,)).fetchone()
    if row is None or row["source"] != "local" or (require_active and (not row["active"] or row["deleted_at"])):
        raise _refuse(conn, actor, user_id, "user_inactive", 403, **args)
    extended = extended_on(conn)
    if never_local(bridge_service, item, extended):
        raise _refuse(conn, actor, user_id, "service_identity_refused", 403, reason="never_local", **args)
    why = feature_refusal(feature, bridge_service, item, extended)
    if why:
        raise _refuse(conn, actor, user_id, why, 403, **args)
    run = runnable_item(bridge_service, item)
    if run is not None and runnable_refusal(conn, run, entity_id) is not None:
        # SVCIDENT3 (review S1 a): a script / scene / automation runs only from the per-installation allowlist (empty by default)
        raise _refuse(conn, actor, user_id, "service_identity_not_runnable", 403, reason="not_runnable", **args)
    sid = configured_id(conn)
    if sid is None:
        raise _refuse(conn, actor, user_id, "service_identity_unconfigured", 503, **args)
    cand = candidate_refusal(conn, sid)
    if cand in ("ha_admin", "arx_admin"):
        raise _refuse(conn, actor, user_id, "service_identity_admin", 403, reason=cand, **args)
    if cand is not None:
        raise _refuse(conn, actor, user_id, "service_identity_unconfigured", 503, reason=cand, **args)
    if _version_tuple(get_setting(conn, "bridge.integration_version")) < _version_tuple(BRIDGE_SERVICE_IDENTITY_REQUIRED):
        raise _refuse(conn, actor, user_id, "service_identity_bridge_outdated", 503, **args)
    if extended and feature_refusal(feature, bridge_service, item, False) is not None:
        # SVCIDENT2: an item only the extended mode admits. The bridge judges it with its own options-flow copy of the switch, so it is not
        # sent unless the bridge (>= 0.9.1) reported that copy on - otherwise it would be refused there anyway (both sides must agree)
        if (_version_tuple(get_setting(conn, "bridge.integration_version")) < _version_tuple(BRIDGE_EXTENDED_REQUIRED)
                or (get_setting(conn, BRIDGE_EXTENDED) or "") != "true"):
            raise _refuse(conn, actor, user_id, "service_identity_extended_bridge_off", 503, **args)
        if not policy_restricted(conn):
            # EXTID-295 (CR-USR2 13.6, owner decision 3 of 2026-10-21): the service user's entity policy is the default (or unknown) - the
            # second fence would refuse nothing, so no extended item is sent. The bridge refuses the same with its live check.
            raise _refuse(conn, actor, user_id, "service_identity_policy_default", 503, reason="policy_default", **args)
        if not policy_report_fresh(conn):
            # ENTPOL-295 (fail closed): the "restricted" report is stale or its time unreadable - Home Assistant unreachable, the bridge
            # stopped pushing - so it is not trusted; nothing is sent until a current push confirms it again
            raise _refuse(conn, actor, user_id, "service_identity_policy_default", 503, reason="policy_stale", message=STALE_MESSAGE, **args)
        if run is not None and entity_id not in bridge_runnable_ids(conn):
            # the bridge (0.9.2) refuses an item missing from its own copy of the allowlist: not sent (both copies must list it)
            raise _refuse(conn, actor, user_id, "service_identity_runnable_bridge_missing", 503, **args)
        if not quiet:
            details = {"feature": feature, "bridge_service": bridge_service, "item": _audit_item(item)}
            if run is not None:
                details["entity_id"] = entity_id
            audit(conn, actor=actor, action="identity.service_identity.extended", decision="allowed", resource_type="user", resource_id=user_id, request_id=request_id,
                  details=details)
    return {"user_id": sid, "on_behalf_of": {"kind": "local", "user_id": user_id, "feature": feature}}


# ---------------------------------------------------------------- SVCIDENT3: the runnable allowlist (review S1 a)

RUN_KIND = {("execute", ("script", "turn_on")): "script", ("execute", ("scene", "turn_on")): "scene",
            ("config_item", "trigger"): "automation", ("config_item", "run_script"): "script", ("config_item", "apply_scene"): "scene"}


def runnable_item(bridge_service: str, item: Any) -> str | None:
    """The kind (script / scene / automation) a bridge item RUNS, or None for an item that runs nothing."""
    try:
        return RUN_KIND.get((bridge_service, item))
    except TypeError:
        return None


def parse_runnable(value: Any) -> list[str] | None:
    """A sorted, de-duplicated list of runnable entity ids, or None when any entry is malformed or there are too many."""
    if value is None:
        return []
    if not isinstance(value, list) or not all(isinstance(x, str) for x in value):
        return None
    ids = sorted({x.strip().lower() for x in value if x.strip()})
    if len(ids) > MAX_RUNNABLE or not all(RUNNABLE_RE.fullmatch(x) for x in ids):
        return None
    return ids


def _stored_ids(conn: sqlite3.Connection, key: str) -> frozenset[str]:
    try:
        raw = get_setting(conn, key)
        ids = parse_runnable(json.loads(raw)) if raw else []
    except (ValueError, TypeError, sqlite3.OperationalError):
        ids = None
    return frozenset(ids or ())  # malformed = empty: every run refused (fail closed)


def runnable_ids(conn: sqlite3.Connection) -> frozenset[str]:
    """The add-on's allowlist `security.local_identity_runnable` (empty by default)."""
    return _stored_ids(conn, RUNNABLE_SETTING)


def bridge_runnable_ids(conn: sqlite3.Connection) -> frozenset[str]:
    """The bridge's options-flow copy of the allowlist, as reported in its last directory push (an older bridge reports none)."""
    return _stored_ids(conn, BRIDGE_RUNNABLE)


def runnable_refusal(conn: sqlite3.Connection, kind: str, entity_id: Any) -> str | None:
    """None when `entity_id` is an entity of `kind` on the add-on's allowlist; else why not (no entity id = refused: fail closed)."""
    if not isinstance(entity_id, str) or not RUNNABLE_RE.fullmatch(entity_id):
        return "no_entity"
    if entity_id.split(".", 1)[0] != kind:
        return "wrong_kind"
    return None if entity_id in runnable_ids(conn) else "not_listed"


def configure_runnable(conn: sqlite3.Connection, principal: Principal, value: Any, request_id: str | None) -> dict[str, Any]:
    """Replace the allowlist (a system administrator, local channel - the route checks both). Audited `identity.service_identity.runnable`
    with the ids added and removed (entity ids only). Refused (422) when an entry is not a script / scene / automation entity id."""
    ids = parse_runnable(value)
    if ids is None:
        audit(conn, actor=principal, action="identity.service_identity.runnable", decision="denied", resource_type="installation", resource_id="service_identity",
              reason="validation", request_id=request_id, details={"count": len(value) if isinstance(value, list) else None})
        raise ApiError(422, "validation", f"רשימת ההרצה מקבלת עד {MAX_RUNNABLE} מזהי ישויות של סקריפטים, סצנות או אוטומציות (script.x, scene.x, automation.x).",
                       details={"fields": ["entity_ids"]})
    before = runnable_ids(conn)
    set_setting(conn, RUNNABLE_SETTING, json.dumps(ids))
    audit(conn, actor=principal, action="identity.service_identity.runnable", decision="allowed", resource_type="installation", resource_id="service_identity",
          request_id=request_id, details={"added": sorted(set(ids) - before), "removed": sorted(before - set(ids)), "count": len(ids)})
    return status(conn)


def kill_switch(conn: sqlite3.Connection, principal: Principal, *, turn_off: bool, clear_runnable: bool, channel: str,
                request_id: str | None) -> dict[str, Any]:
    """SVCIDENT-AMEND273 (owner decision 5 of 2026-10-18; go-live pack R7): the kill switch - turn the add-on's extended switch OFF and / or
    empty the add-on's runnable allowlist, from either channel (the route checks the system administrator). It can only REMOVE authority:
    there is no argument that turns anything on or adds an id. Each actual change writes the same audit row as the local path
    (`identity.service_identity.extended_switch`, `identity.service_identity.runnable`); one `identity.service_identity.kill_switch` row
    sums it up. The answer names counts and the switch state only - never the service identity's configuration."""
    turned_off = False
    if turn_off and extended_requested(conn):
        set_setting(conn, EXTENDED_SETTING, "off")
        audit(conn, actor=principal, action="identity.service_identity.extended_switch", decision="allowed", resource_type="installation",
              resource_id="service_identity", request_id=request_id, details={"from": "on", "to": "off", "channel": channel, "via": "kill_switch"})
        turned_off = True
    cleared = 0
    if clear_runnable:
        before = runnable_ids(conn)
        if before or get_setting(conn, RUNNABLE_SETTING) not in (None, "[]"):  # a malformed stored value is replaced by the empty list too
            configure_runnable(conn, principal, [], request_id)
        cleared = len(before)
    audit(conn, actor=principal, action="identity.service_identity.kill_switch", decision="allowed", resource_type="installation",
          resource_id="service_identity", request_id=request_id,
          details={"turn_off": turn_off, "clear_runnable": clear_runnable, "turned_off": turned_off, "cleared": cleared, "channel": channel})
    return {"extended": "on" if extended_requested(conn) else "off", "runnable_count": len(runnable_ids(conn)), "turned_off": turned_off, "cleared": cleared}


def _audit_item(item: Any) -> Any:
    """What an audit row may say about an item: a (domain, service) pair or an op / query name - ids only, never data."""
    return list(item) if isinstance(item, tuple) else (item if isinstance(item, str) else None)


def local_door_ok(conn: sqlite3.Connection, principal: Principal) -> bool:
    """SVCIDENT2 (owner decision 1): may the WisKey door rule (door_authority.identity_ok) judge a local principal at all - only in the
    extended mode, and only for an active, not deleted local user. The door rule itself (access.doors.open / door.unlock, deny wins,
    wall accounts) then decides exactly as for everyone; a WisKey door is opened by the door transport, never through the bridge."""
    if not is_local(principal) or not LOCAL_ID_RE.fullmatch(principal.user_id or "") or not extended_on(conn):
        return False
    row = conn.execute("SELECT active, deleted_at, source FROM users WHERE id = ?", (principal.user_id,)).fetchone()
    return row is not None and row["source"] == "local" and bool(row["active"]) and not row["deleted_at"]


def refuse_automation_write(conn: sqlite3.Connection, principal: Principal, request_id: str | None) -> None:
    """Automations / scenes / scripts: never for a local identity (design record section 12.2), before any op is recorded."""
    if not is_local(principal):
        return
    audit(conn, actor=principal, action="identity.service_identity.refused", decision="denied", resource_type="user", resource_id=principal.user_id,
          reason="automation_write_requires_ha_identity", request_id=request_id, details={"feature": "automations"})
    raise ApiError(403, "automation_write_requires_ha_identity", MESSAGES["automation_write_requires_ha_identity"])


def refuse_automation_run(conn: sqlite3.Connection, principal: Principal, request_id: str | None) -> None:
    """SVCIDENT2 second round: the automations screen's RUN routes (an automation's run, a script's run, a scene's apply). Switch off: exactly
    refuse_automation_write (2.6.4). Extended mode on: the route goes on - its own Arx run permission decides - and the bridge call is judged
    by the `automations.run` feature (AUTOMATION_RUN_OPS only) through the service identity."""
    if not is_local(principal) or extended_on(conn):
        return
    refuse_automation_write(conn, principal, request_id)


def refuse_zone_bypass(conn: sqlite3.Connection, principal: Principal, request_id: str | None, *, zone: str) -> None:
    """Alarm zone bypass (and its restore): never for a local identity - an explicit rule of the route (security review F1), independent of
    whether the bypass control's (domain, service) happens to be in the `alarm` table. Called after the route's own permission checks.
    SVCIDENT2 (owner decision 2, 2026-10-17): with the extended mode on the route goes on - it has already required alarm.bypass on every
    panel of the zone - and the call is judged by the `alarm.bypass` feature."""
    if not is_local(principal):
        return
    if extended_on(conn):
        return
    raise _refuse(conn, principal, principal.user_id, "service_identity_refused", 403, reason="zone_bypass", feature="alarm", bridge_service="execute",
                  item=zone, request_id=request_id)


# ---------------------------------------------------------------- the service user is never a person (security review F4)

SERVICE_ACCOUNT_HE = "המשתמש הזה הוא זהות השירות של Arx - משתמש טכני בלבד. אי אפשר להיכנס בשמו ואי אפשר לתת לו תפקיד."


def is_service_user(conn: sqlite3.Connection, user_id: Any) -> bool:
    """True when `user_id` is the configured service identity (a Home Assistant id)."""
    if not isinstance(user_id, str) or not HA_USER_ID_RE.fullmatch(user_id):
        return False
    try:
        return configured_id(conn) == user_id
    except sqlite3.OperationalError:
        return False


def refuse_service_principal(conn: sqlite3.Connection, principal: Principal, request_id: str | None) -> None:
    """A human signing in to Arx AS the service Home Assistant user (Ingress or the remote channel) is refused: 403 `service_account`, audited
    `identity.service_identity.signin_refused` (through a side transaction when the request is read-only). A local principal is never it."""
    if principal.source not in ("ingress", "remote") or not is_service_user(conn, principal.user_id):
        return
    from ..db import database_of, read_mode

    def write(w: sqlite3.Connection) -> None:
        audit(w, actor=principal, action="identity.service_identity.signin_refused", decision="denied", resource_type="user", resource_id=principal.user_id,
              reason="service_account", request_id=request_id, details={"source": principal.source})

    try:
        db = database_of(conn) if read_mode(conn) else None
        if db is not None:
            with db.write_aside() as w:
                write(w)
        else:
            write(conn)
    except Exception:  # noqa: BLE001 - the refusal stands even when its audit row cannot be written
        log.warning("service identity sign-in refusal not audited")
    raise ApiError(403, "service_account", SERVICE_ACCOUNT_HE)


# ---------------------------------------------------------------- the payload guard (the last line before anything leaves)

def guard_payload(payload: dict[str, Any]) -> None:
    """Called by every bridge transport: a local id never travels as `user_id` (it is never a Home Assistant user), and an `on_behalf_of`
    block always names a local id and never the same id as `user_id`. Raised before the request is sent."""
    uid = payload.get("user_id") if isinstance(payload, dict) else None
    if isinstance(uid, str) and uid.startswith(LOCAL_ID_PREFIX):
        raise ApiError(403, "service_identity_refused", MESSAGES["service_identity_refused"], details={"reason": "local_id_as_user"})
    obo = payload.get("on_behalf_of") if isinstance(payload, dict) else None
    if obo is not None:
        if not isinstance(obo, dict) or obo.get("kind") != "local" or not LOCAL_ID_RE.fullmatch(str(obo.get("user_id") or "")) or obo.get("user_id") == uid:
            raise ApiError(403, "service_identity_refused", MESSAGES["service_identity_refused"], details={"reason": "bad_on_behalf_of"})


# ---------------------------------------------------------------- configuration and health

def configure(conn: sqlite3.Connection, principal: Principal, user_id: str | None, request_id: str | None) -> dict[str, Any]:
    """Set (or clear, with None / "") the service identity. Refuses an administrator (HA or Arx), an unknown, inactive or malformed id."""
    value = (user_id or "").strip().lower()
    if value:
        why = candidate_refusal(conn, value)
        if why:
            audit(conn, actor=principal, action="identity.service_identity.configured", decision="denied", resource_type="installation", resource_id="service_identity",
                  reason=why, request_id=request_id, details={"user_id": value if HA_USER_ID_RE.fullmatch(value) else None})
            code = "service_identity_admin" if why in ("ha_admin", "arx_admin") else "validation"
            message = {"format": "מזהה משתמש של תשתית המערכת הוא 32 תווים: 0-9 ו־a-f.",
                       "unknown_user": "אין משתמש כזה בספריית המשתמשים של תשתית המערכת (היא מתעדכנת כל דקה מהגשר).",
                       "inactive": "המשתמש הזה אינו פעיל בתשתית המערכת.",
                       "ha_admin": "המשתמש הזה הוא מנהל בתשתית המערכת. זהות השירות לעולם לא מנהל - בחרו או צרו משתמש רגיל.",
                       "arx_admin": "המשתמש הזה הוא מנהל מערכת ב־Arx. זהות השירות לעולם לא מנהל - בחרו משתמש טכני נפרד."}[why]
            raise ApiError(422 if code == "validation" else 403, code, message, details={"reason": why})
    before = configured_id(conn)
    set_setting(conn, SETTING, value)
    audit(conn, actor=principal, action="identity.service_identity.configured", decision="allowed", resource_type="installation", resource_id="service_identity",
          request_id=request_id, details={"user_id": value or None, "before": before})
    return status(conn)


def status(conn: sqlite3.Connection) -> dict[str, Any]:
    """The self-check the settings card shows: what is configured on each side, whether they agree, and - in plain Hebrew - what the owner
    must still do. `ready` is true only when a local user's call would be accepted by both sides."""
    from . import local_identity

    raw = (get_setting(conn, SETTING) or "").strip()
    sid = configured_id(conn)
    bridge_version = get_setting(conn, "bridge.integration_version") or None
    bridge_ok = _version_tuple(bridge_version) >= _version_tuple(BRIDGE_SERVICE_IDENTITY_REQUIRED)
    bridge_reported = get_setting(conn, BRIDGE_SETTING) or None
    bridge_capable = (get_setting(conn, BRIDGE_CAPABLE) or "") == "true"
    paired = bool(get_setting(conn, "bridge.paired_at"))
    row = _ha_user(conn, sid) if sid else None
    cand = candidate_refusal(conn, sid) if sid else None
    steps: list[dict[str, str]] = []

    def step(code: str, he: str, en: str) -> None:
        steps.append({"code": code, "he": he, "en": en})

    if not local_identity.enabled(conn):
        step("feature_off", "משתמשי Arx כבויים. כל עוד המתג כבוי, זהות השירות אינה בשימוש.", "Arx users are off. While the switch is off the service identity is not used.")
    if not paired:
        step("bridge_not_paired", "רכיב החיבור (הגשר) אינו מצומד. התקינו וצמדו אותו בהגדרות › חיבורים.", "The bridge is not paired. Install and pair it in Settings > Connections.")
    elif not bridge_ok:
        step("bridge_outdated", f"רכיב החיבור בגרסה {bridge_version or '?'}; נדרשת {BRIDGE_SERVICE_IDENTITY_REQUIRED} ומעלה. עדכנו אותו והפעילו מחדש את תשתית המערכת.",
             f"The bridge runs {bridge_version or '?'}; {BRIDGE_SERVICE_IDENTITY_REQUIRED} or newer is needed. Update it and restart the infrastructure.")
    if not raw:
        step("not_configured", "צרו בתשתית המערכת משתמש רגיל אחד (לא מנהל) בשם למשל \"SmplWise Arx Service\", העתיקו את המזהה שלו והזינו אותו כאן.",
             "Create ONE regular (non-administrator) user in the infrastructure, e.g. \"SmplWise Arx Service\", copy its id and enter it here.")
    elif sid is None or cand == "format":
        step("format", "המזהה שהוזן אינו מזהה משתמש תקין (32 תווים: 0-9 ו־a-f).", "The id entered is not a valid user id (32 characters, 0-9 and a-f).")
    elif cand == "unknown_user":
        step("unknown_user", "המשתמש לא נמצא בספריית המשתמשים שהגשר שולח. בדקו את המזהה, או המתינו דקה לסנכרון.", "The user is not in the directory the bridge sends. Check the id or wait a minute for the sync.")
    elif cand == "inactive":
        step("inactive", "המשתמש מושבת בתשתית המערכת. הפעילו אותו או בחרו אחר.", "The user is disabled in the infrastructure. Enable it or choose another.")
    elif cand in ("ha_admin", "arx_admin"):
        step("admin", "המשתמש שהוגדר הוא מנהל - זה אסור. כל פעולה של משתמשי Arx נחסמת עד שתבחרו משתמש רגיל.", "The configured user is an administrator - not allowed. Every Arx user action is refused until a regular user is chosen.")
    if sid and cand is None:
        try:
            bound = conn.execute("SELECT 1 FROM bindings WHERE subject_kind = 'user' AND subject_id = ? AND revoked_at IS NULL LIMIT 1", (sid,)).fetchone()
        except sqlite3.OperationalError:
            bound = None
        if bound:
            step("has_arx_role", "לזהות השירות יש תפקיד ב־Arx. מומלץ שזה יהיה משתמש טכני בלבד, בלי תפקיד ובלי סיסמה - כדי שאף אדם לא ייכנס בשמו.",
                 "The service identity holds an Arx role. It should be a technical user only, with no role and no password, so nobody signs in as it.")
    if sid:
        try:
            seen = conn.execute("SELECT last_seen_at FROM users WHERE id = ? AND source IN ('ingress', 'remote')", (sid,)).fetchone()
        except sqlite3.OperationalError:
            seen = None
        if seen:
            # security review F4: somebody signed in to Arx as this user (before it was configured - since then such a sign-in is refused);
            # it has a password a person knows, so actions done in Home Assistant directly under it are possible
            step("service_signed_in", f"מישהו נכנס ל־Arx בשם זהות השירות ({seen['last_seen_at'] or '?'}). לזהות השירות אסור שתהיה סיסמה שאדם משתמש בה: בתשתית המערכת בטלו לה את הכניסה (או החליפו סיסמה), או בחרו משתמש טכני אחר.",
                 f"Somebody signed in to Arx as the service identity ({seen['last_seen_at'] or '?'}). No person may use its password: in the infrastructure disable its login (or change the password), or choose another technical user.")
    if raw and bridge_ok and paired:
        if not bridge_capable or not bridge_reported:
            step("bridge_not_set", "בתשתית המערכת: הגדרות › התקנים ושירותים › SMPLWISE Bridge › הגדרות - הזינו באותו שדה את אותו מזהה (שני הצדדים חייבים להסכים).",
                 "In the infrastructure: Settings > Devices & services > SMPLWISE Bridge > Configure - enter the same id there (both sides must agree).")
        elif sid and bridge_reported != sid:
            step("mismatch", "המזהה שהוגדר כאן שונה מזה שהוגדר ברכיב החיבור. עדכנו את אחד הצדדים כך ששניהם יהיו זהים.",
                 "The id here differs from the one set in the bridge. Make both sides the same.")
    ready = bool(sid) and cand is None and paired and bridge_ok and bridge_capable and bridge_reported == sid
    # SVCIDENT2: the extended mode (both copies must be on; it needs a security review before it is ever turned on - CR-USR2 section 11)
    ext_requested = extended_requested(conn)
    ext_on = extended_on(conn)
    bridge_ext = (get_setting(conn, BRIDGE_EXTENDED) or "") == "true"
    bridge_ext_ok = _version_tuple(bridge_version) >= _version_tuple(BRIDGE_EXTENDED_REQUIRED)
    policy_ok = policy_restricted(conn)
    policy_fresh = policy_report_fresh(conn)  # ENTPOL-295
    if ext_requested:
        step("extended_on", "המצב המורחב פעיל: משתמשי Arx יכולים לפתוח דלתות, לעקוף אזורי אזעקה, להפעיל סקריפטים וסצנות, להריץ אוטומציות ממסך האוטומציות ולהציג מצלמות בזרם חי - כל אחד רק לפי ההרשאה שלו. נדרשת סקירת אבטחה לפני הפעלה.",
             "Extended mode is on: Arx users may open doors, bypass alarm zones, run scripts and scenes, run automations from the automations screen and show live cameras - each only under their own permission. A security review is required before enabling it.")
        if paired and not bridge_ext_ok:
            step("extended_bridge_outdated", f"המצב המורחב דורש רכיב חיבור {BRIDGE_EXTENDED_REQUIRED} ומעלה (כעת {bridge_version or '?'}).",
                 f"Extended mode needs the bridge {BRIDGE_EXTENDED_REQUIRED} or newer (now {bridge_version or '?'}).")
        elif paired and not bridge_ext:
            step("extended_bridge_off", "בתשתית המערכת: הגדרות › התקנים ושירותים › SMPLWISE Bridge › הגדרות - הפעילו גם שם את המצב המורחב של משתמשי Arx. עד אז הפעולות המורחבות נחסמות.",
                 "In the infrastructure: Settings > Devices & services > SMPLWISE Bridge > Configure - turn the Arx users' extended mode on there too. Until then the extended actions are refused.")
        if paired and bridge_ext_ok and not policy_ok:
            # EXTID-295 (CR-USR2 13.6, owner decision 3 of 2026-10-21)
            step("service_policy_default", "הגבילו את זהות השירות בתשתית המערכת לקבוצה שמתירה רק את ההתקנים ש-Arx רשאי להפעיל (לא הקבוצה הרגילה של המשתמשים). עד אז הפעולות המורחבות נחסמות.",
                 "Restrict the service user in the infrastructure to a group that names only the devices Arx may reach (not the regular users group). Until then the extended actions are refused.")
        elif paired and bridge_ext_ok and not policy_fresh:
            # ENTPOL-295 (fail closed): a "restricted" report that is no longer current is not trusted
            step("service_policy_stale", "רכיב החיבור לא אישר לאחרונה שזהות השירות מוגבלת (אין קשר עם תשתית המערכת). עד שהקשר יחזור הפעולות המורחבות נחסמות.",
                 "The bridge has not confirmed recently that the service user is restricted (no contact with the infrastructure). Until it does, the extended actions are refused.")
    elif bridge_ext:
        step("extended_bridge_only", "המצב המורחב פעיל ברכיב החיבור בלבד. כל עוד הוא כבוי כאן, הפעולות המורחבות נחסמות.",
             "Extended mode is on in the bridge only. While it is off here, the extended actions are refused.")
    run_ids, bridge_run_ids = runnable_ids(conn), bridge_runnable_ids(conn)
    if ext_requested and run_ids != bridge_run_ids:
        step("runnable_mismatch", "רשימת הסקריפטים, הסצנות והאוטומציות להרצה שונה בין Arx לבין רכיב החיבור. פריט שאינו בשתי הרשימות לא ירוץ.",
             "The list of runnable scripts, scenes and automations differs between Arx and the bridge. An item missing from either list does not run.")
    if ext_on:
        allowed = [{"key": k, "he": v[0], "en": v[1]} for k, v in EXTENDED_FEATURE_LABELS.items()]
        refused = [{"he": he, "en": en} for he, en in EXTENDED_REFUSED_LABELS]
    else:
        allowed = [{"key": k, "he": v[0], "en": v[1]} for k, v in FEATURE_LABELS.items()]
        refused = [{"he": he, "en": en} for he, en in REFUSED_LABELS]
    return {
        "configured_user_id": raw or None,
        "user": {"id": row["id"], "name": row["name"] or row["username"], "is_active": bool(row["is_active"]), "is_admin": bool(row["is_admin"])} if row is not None else None,
        "bridge": {"paired": paired, "version": bridge_version, "required": BRIDGE_SERVICE_IDENTITY_REQUIRED, "version_ok": bridge_ok,
                   "capable": bridge_capable, "reported_user_id": bridge_reported, "agrees": bool(sid) and bridge_reported == sid},
        "feature_on": local_identity.enabled(conn),
        "extended": {"permitted": extended_go_live_permitted(), "requested": ext_requested, "on": ext_on, "bridge_on": bridge_ext, "bridge_version_ok": bridge_ext_ok,
                     "agrees": ext_requested == bridge_ext, "required": BRIDGE_EXTENDED_REQUIRED,
                     # SVCIDENT3 (review S4): the two-switch rule is the bridge's - a WisKey door follows the add-on's switch alone
                     "doors_addon_only": True,
                     # EXTID-295 (CR-USR2 13.6): the bridge's last report - True / False, None while no 0.9.6+ bridge reported it
                     "service_policy_restricted": _policy_report(conn),
                     # ENTPOL-295: whether that report is current (a push within POLICY_REPORT_MAX_AGE_S); a stale "true" is not trusted
                     "service_policy_fresh": policy_fresh},
        "runnable": {"ids": sorted(run_ids), "bridge_ids": sorted(bridge_run_ids), "agrees": run_ids == bridge_run_ids, "max": MAX_RUNNABLE},
        "ready": ready,
        "steps": steps,
        "allowed": allowed,
        "refused": refused,
    }


def note_directory_push(conn: sqlite3.Connection, message: dict[str, Any]) -> None:
    """The bridge's options-flow copy of the service identity travels with each directory push (bridge >= 0.9.0) - state only, never a request."""
    if "service_identity" not in message:
        return
    capable = "true" if message.get("service_identity") is True else "false"
    reported = message.get("service_user_id")
    reported = reported if isinstance(reported, str) and HA_USER_ID_RE.fullmatch(reported) else ""
    # SVCIDENT2 (bridge >= 0.9.1): the bridge's options-flow copy of the extended switch; an older bridge sends no key = off
    ext = "true" if message.get("local_identity_extended") is True else "false"
    # SVCIDENT3 (bridge >= 0.9.2): the bridge's copy of the runnable allowlist; an older bridge or a malformed list = none
    run = json.dumps(parse_runnable(message.get("local_identity_runnable")) or [])
    # EXTID-295 (bridge >= 0.9.6, CR-USR2 13.6): whether the service user is restricted - only a literal boolean counts; anything else
    # (null = the bridge could not tell, an older bridge sends no key) is unknown = refused
    raw_policy = message.get("service_policy_restricted")
    policy = "true" if raw_policy is True else ("false" if raw_policy is False else "")
    if (capable != (get_setting(conn, BRIDGE_CAPABLE) or "") or reported != (get_setting(conn, BRIDGE_SETTING) or "") or ext != (get_setting(conn, BRIDGE_EXTENDED) or "false")
            or run != (get_setting(conn, BRIDGE_RUNNABLE) or "[]") or policy != (get_setting(conn, BRIDGE_POLICY) or "")):
        set_setting(conn, BRIDGE_CAPABLE, capable)
        set_setting(conn, BRIDGE_SETTING, reported)
        set_setting(conn, BRIDGE_EXTENDED, ext)
        set_setting(conn, BRIDGE_RUNNABLE, run)
        set_setting(conn, BRIDGE_POLICY, policy)
        audit(conn, actor=None, action="bridge.service_identity_seen", decision="allowed", resource_type="installation", resource_id="service_identity",
              details={"capable": capable == "true", "user_id": reported or None, "extended": ext == "true", "runnable": json.loads(run),
                       "policy_restricted": {"true": True, "false": False}.get(policy)})
