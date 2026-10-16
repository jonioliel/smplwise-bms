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
  and door actions are not in any feature (refused). A Home Assistant principal is untouched: subject() returns `{"user_id": <its id>}`.
"""
from __future__ import annotations

import logging
import re
import sqlite3
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

ALARM_PAIRS = frozenset({
    ("alarm_control_panel", "alarm_arm_home"), ("alarm_control_panel", "alarm_arm_away"), ("alarm_control_panel", "alarm_arm_night"),
    ("alarm_control_panel", "alarm_arm_vacation"), ("alarm_control_panel", "alarm_arm_custom_bypass"), ("alarm_control_panel", "alarm_disarm"),
})
# The bridge's execute allow-list minus the alarm panel (its own feature, owner answer Q4) and minus `lock.unlock` (a door - kept refused).
DEVICE_PAIRS = frozenset({
    ("light", "turn_on"), ("light", "turn_off"), ("switch", "turn_on"), ("switch", "turn_off"), ("fan", "turn_on"), ("fan", "turn_off"),
    ("cover", "open_cover"), ("cover", "close_cover"), ("cover", "stop_cover"), ("lock", "lock"),
    ("button", "press"), ("script", "turn_on"), ("scene", "turn_on"),
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
FEATURE_LABELS = {"devices.control": ("שליטה בהתקנים", "Device control"), "alarm": ("אזעקה (דריכה / נטרול לפי כללי הקוד)", "Alarm (arm / disarm under the PIN rules)"),
                  "media": ("מדיה ומוזיקה", "Media and music"), "cast": ("שידור למסך", "Cast to a screen"), "schedules": ("תזמונים", "Schedules")}
REFUSED_LABELS = [("אוטומציות, סצנות וסקריפטים (כתיבה והפעלה)", "Automations, scenes and scripts (writing and running)"),
                  ("שיוך התקן לאזור", "Assigning a device to an area"), ("מצלמות בזרם חי דרך תשתית המערכת", "Live cameras through the infrastructure"),
                  ("פתיחת דלתות ומנעולים", "Opening doors and locks")]

MESSAGES = {
    "service_identity_refused": "הפעולה הזו אינה זמינה למשתמשי Arx.",
    "service_identity_unconfigured": "פעולות בתשתית המערכת למשתמשי Arx דורשות זהות שירות. מנהל המערכת מגדיר אותה בהגדרות › משתמשי Arx.",
    "service_identity_admin": "זהות השירות שהוגדרה היא משתמש עם הרשאות ניהול, ולכן הפעולה נחסמה. מנהל המערכת יבחר משתמש רגיל.",
    "service_identity_bridge_outdated": "נדרש עדכון של רכיב החיבור (0.9.0 ומעלה) כדי שמשתמשי Arx יוכלו לפעול בתשתית המערכת.",
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


def feature_refusal(feature: str, bridge_service: str, item: Any) -> str | None:
    services = FEATURES.get(feature)
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
            request_id: str | None, reason: str | None = None) -> ApiError:
    try:
        audit(conn, actor=principal, action="identity.service_identity.refused", decision="denied", resource_type="user", resource_id=user_id,
              reason=reason or code, request_id=request_id,
              details={"feature": feature, "bridge_service": bridge_service, "item": list(item) if isinstance(item, tuple) else (item if isinstance(item, str) else None)})
    except Exception:  # noqa: BLE001 - the refusal itself must never fail because its audit row could not be written
        log.warning("service identity refusal not audited (%s)", code)
    return ApiError(status, code, MESSAGES.get(code, MESSAGES["service_identity_refused"]), details={"feature": feature})


def subject(conn: sqlite3.Connection, principal: Principal, feature: str, *, bridge_service: str, item: Any, request_id: str | None = None) -> dict[str, Any]:
    """The identity fields of a signed bridge message. A Home Assistant (or developer) principal: `{"user_id": <its id>}` - unchanged. A local
    principal: the service identity + `on_behalf_of`, or ApiError (audited `identity.service_identity.refused`) - nothing is sent then."""
    if not is_local(principal):
        return {"user_id": principal.user_id}
    # a principal that is local by source OR by id form is judged as local, whatever its id looks like (fail closed: a `source = local`
    # principal carrying a Home Assistant-shaped id is refused below, never passed on as that Home Assistant user)
    return _local_subject(conn, principal.user_id, feature, bridge_service=bridge_service, item=item, request_id=request_id, actor=principal)


def subject_for_user(conn: sqlite3.Connection, user_id: str, feature: str, *, bridge_service: str, item: Any, request_id: str | None = None,
                     actor: Principal | None = None) -> dict[str, Any]:
    """subject() for a stored principal id (a background follow-up of a local user's earlier request)."""
    if not is_local(user_id):
        return {"user_id": user_id}
    return _local_subject(conn, user_id, feature, bridge_service=bridge_service, item=item, request_id=request_id, actor=actor)


def _local_subject(conn: sqlite3.Connection, user_id: str, feature: str, *, bridge_service: str, item: Any, request_id: str | None,
                   actor: Principal | None) -> dict[str, Any]:
    args = {"feature": feature, "bridge_service": bridge_service, "item": item, "request_id": request_id}
    from . import local_identity

    if not LOCAL_ID_RE.fullmatch(user_id or ""):
        raise _refuse(conn, actor, str(user_id)[:40], "service_identity_refused", 403, reason="bad_local_id", **args)
    if not local_identity.enabled(conn):
        raise _refuse(conn, actor, user_id, "local_identity_off", 403, **args)
    row = conn.execute("SELECT active, deleted_at, source FROM users WHERE id = ?", (user_id,)).fetchone()
    if row is None or row["source"] != "local" or not row["active"] or row["deleted_at"]:
        raise _refuse(conn, actor, user_id, "user_inactive", 403, **args)
    why = feature_refusal(feature, bridge_service, item)
    if why:
        raise _refuse(conn, actor, user_id, why, 403, **args)
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
    return {"user_id": sid, "on_behalf_of": {"kind": "local", "user_id": user_id, "feature": feature}}


def refuse_automation_write(conn: sqlite3.Connection, principal: Principal, request_id: str | None) -> None:
    """Automations / scenes / scripts: never for a local identity (design record section 12.2), before any op is recorded."""
    if not is_local(principal):
        return
    audit(conn, actor=principal, action="identity.service_identity.refused", decision="denied", resource_type="user", resource_id=principal.user_id,
          reason="automation_write_requires_ha_identity", request_id=request_id, details={"feature": "automations"})
    raise ApiError(403, "automation_write_requires_ha_identity", MESSAGES["automation_write_requires_ha_identity"])


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
    if raw and bridge_ok and paired:
        if not bridge_capable or not bridge_reported:
            step("bridge_not_set", "בתשתית המערכת: הגדרות › התקנים ושירותים › SMPLWISE Bridge › הגדרות - הזינו באותו שדה את אותו מזהה (שני הצדדים חייבים להסכים).",
                 "In the infrastructure: Settings > Devices & services > SMPLWISE Bridge > Configure - enter the same id there (both sides must agree).")
        elif sid and bridge_reported != sid:
            step("mismatch", "המזהה שהוגדר כאן שונה מזה שהוגדר ברכיב החיבור. עדכנו את אחד הצדדים כך ששניהם יהיו זהים.",
                 "The id here differs from the one set in the bridge. Make both sides the same.")
    ready = bool(sid) and cand is None and paired and bridge_ok and bridge_capable and bridge_reported == sid
    return {
        "configured_user_id": raw or None,
        "user": {"id": row["id"], "name": row["name"] or row["username"], "is_active": bool(row["is_active"]), "is_admin": bool(row["is_admin"])} if row is not None else None,
        "bridge": {"paired": paired, "version": bridge_version, "required": BRIDGE_SERVICE_IDENTITY_REQUIRED, "version_ok": bridge_ok,
                   "capable": bridge_capable, "reported_user_id": bridge_reported, "agrees": bool(sid) and bridge_reported == sid},
        "feature_on": local_identity.enabled(conn),
        "ready": ready,
        "steps": steps,
        "allowed": [{"key": k, "he": v[0], "en": v[1]} for k, v in FEATURE_LABELS.items()],
        "refused": [{"he": he, "en": en} for he, en in REFUSED_LABELS],
    }


def note_directory_push(conn: sqlite3.Connection, message: dict[str, Any]) -> None:
    """The bridge's options-flow copy of the service identity travels with each directory push (bridge >= 0.9.0) - state only, never a request."""
    if "service_identity" not in message:
        return
    capable = "true" if message.get("service_identity") is True else "false"
    reported = message.get("service_user_id")
    reported = reported if isinstance(reported, str) and HA_USER_ID_RE.fullmatch(reported) else ""
    if capable != (get_setting(conn, BRIDGE_CAPABLE) or "") or reported != (get_setting(conn, BRIDGE_SETTING) or ""):
        set_setting(conn, BRIDGE_CAPABLE, capable)
        set_setting(conn, BRIDGE_SETTING, reported)
        audit(conn, actor=None, action="bridge.service_identity_seen", decision="allowed", resource_type="installation", resource_id="service_identity",
              details={"capable": capable == "true", "user_id": reported or None})
