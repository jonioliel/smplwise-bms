"""LEGACY-MIGRATION-2550 (T070): the import of what the legacy "Hikvision NVR Panel" add-on (v1.5.27) kept - a DRY RUN that says,
item by item, what would be created, changed, kept, skipped or left to a person, and an APPLY that does exactly that plan.

The reader (services/legacy_source.py) takes COPIES an administrator hands over; Arx never opens the legacy add-on's own files and
never writes to the NVR, to go2rtc or to Home Assistant here. The only Arx rows an apply can change are camera aliases that are
EMPTY today (a legacy display name by channel, on the first recorder); everything else in the legacy store has no Arx counterpart
that a copy could fill safely, so the report names the screen where a person does it (the NVR connection with its password, people
and roles) or why it is not carried over (manual recordings are running NVR commands, the event store is an archive).

Apply rules (docs/legacy/MIGRATION_GAP_ANALYSIS.md, section 4):

- bound to the plan: the caller sends the `plan_digest` of the dry run it looked at; a different plan (the file, or Arx, changed
  since) is refused (409) and nothing is written;
- backup first: a project backup of kind `auto-pre-legacy-import` is written before the first change (the newest 5 are kept); no
  backup, no change;
- idempotent: an alias is written only while the camera's alias is still empty (a guarded UPDATE), so a second apply of the same
  file changes nothing and writes no backup; every run is recorded (`migration.legacy.runs`, the newest 20);
- audited: one `camera.update` row per alias (`details.via = legacy_import`) and one `migration.legacy.apply` row with the counts,
  the backup's name and the source's SHA-256 - never a password, a PIN or a host (the source holds none)."""
from __future__ import annotations

import datetime as dt
import hashlib
import json
import sqlite3
from typing import Any

from .legacy_source import LegacySource, describe, host_digest

SCHEMA = "smplwise-legacy-import/1"
BACKUP_KIND = "auto-pre-legacy-import"
RUNS_KEY = "migration.legacy.runs"
RUNS_KEEP = 20
ALIAS_MAX = 120  # routers/cameras.py CameraPatch.alias
PRIMARY = "nvr-1"  # recorder_scope.PRIMARY: the legacy add-on had exactly one NVR
ACTIONS = ("create", "update", "same", "keep", "skip", "manual", "info")
WRITES = ("create", "update")

# code -> (Hebrew, English). {slots} are filled from the item's params; no value from the legacy files except a camera name and a channel.
NOTES: dict[str, tuple[str, str]] = {
    "alias_set": ("הכינוי מהמערכת הישנה יועתק למצלמה (היום אין לה כינוי ב־Arx).",
                  "The legacy name will be copied to this camera (it has no alias in Arx today)."),
    "alias_same": ("הכינוי כבר זהה ב־Arx.", "The alias is already the same in Arx."),
    "alias_keep": ("ל־Arx כבר יש כינוי אחר למצלמה הזו; הוא נשמר. אפשר לשנות ידנית במסך המצלמות.",
                   "Arx already has another alias for this camera; it is kept. Change it by hand on the cameras screen if needed."),
    "alias_too_long": ("השם ארוך מ־120 תווים ולא יועתק.", "The name is longer than 120 characters and is not copied."),
    "no_arx_camera": ("אין ב־Arx מצלמה בערוץ {channel}. להריץ קודם 'סנכרון מה־NVR' ואז לחזור על הבדיקה.",
                      "Arx has no camera on channel {channel}. Run 'Sync from the NVR' first, then run this check again."),
    "bad_channel": ("מפתח ערוץ לא מספרי בקובץ הישן; לא יועתק.", "A non-numeric channel key in the legacy file; not copied."),
    "arx_only_camera": ("מצלמה ש־Arx מכיר ואין לה שם במערכת הישנה.", "A camera Arx knows that has no legacy name."),
    "conn_host_same": ("Arx מחובר לאותו NVR כמו המערכת הישנה.", "Arx uses the same NVR as the legacy add-on."),
    "conn_host_other": ("Arx מחובר ל־NVR אחר מזה של המערכת הישנה. לבדוק בהגדרות › חיבורים › NVR.",
                        "Arx uses another NVR than the legacy add-on. Check Settings > Connections > NVR."),
    "conn_host_missing": ("ל־Arx עדיין אין חיבור NVR. להזין בהגדרות › חיבורים › NVR (נבדק לפני שמירה).",
                          "Arx has no NVR connection yet. Enter it in Settings > Connections > NVR (tested before it is saved)."),
    "conn_host_unknown": ("בקובץ הישן אין כתובת NVR.", "The legacy files hold no NVR host."),
    "conn_port_same": ("אותו פורט.", "The same port."),
    "conn_port_other": ("פורט שונה מזה של המערכת הישנה. לבדוק בהגדרות › חיבורים › NVR.",
                        "Another port than the legacy add-on's. Check Settings > Connections > NVR."),
    "conn_user_same": ("אותו משתמש NVR.", "The same NVR user."),
    "conn_user_other": ("משתמש NVR אחר. מומלץ משתמש ייעודי לקריאה בלבד; לבדוק בהגדרות › חיבורים › NVR.",
                        "Another NVR user. A dedicated read-only user is recommended; check Settings > Connections > NVR."),
    "conn_password": ("הסיסמה אף פעם לא מיובאת. אם ל־Arx אין סיסמה - להזין בהגדרות › חיבורים › NVR (נשמרת מוצפנת).",
                      "The password is never imported. If Arx has none, enter it in Settings > Connections > NVR (stored encrypted)."),
    "go2rtc_same": ("אותו go2rtc. Arx משתמש רק בזרמים בשם smplwise_.", "The same go2rtc. Arx uses only streams named smplwise_."),
    "go2rtc_other": ("Arx מוגדר ל־go2rtc אחר. לבדוק את אפשרות התוסף go2rtc_url.",
                     "Arx is set to another go2rtc. Check the add-on option go2rtc_url."),
    "go2rtc_missing": ("ל־Arx לא הוגדר go2rtc. להגדיר את אפשרות התוסף go2rtc_url.", "Arx has no go2rtc set. Set the add-on option go2rtc_url."),
    "go2rtc_ingress": ("לא נדרש: Arx מעביר וידאו דרך עצמו והדפדפן לא פונה ל־go2rtc.",
                       "Not needed: Arx relays the video itself; the browser never talks to go2rtc."),
    "people_pin": ("אין PIN משותף ב־Arx. לכל אדם משתמש בית משלו ותפקיד ב־Arx (הגדרות › משתמשים והרשאות): צופה למי שרק צפה.",
                   "Arx has no shared PIN. Every person gets an own home-system user and an Arx role (Settings > Users and permissions): viewer for those who only watched."),
    "people_technician": ("אין PIN טכנאי. מי שהחזיק אותו מקבל תפקיד מנהל מערכת (או תפקיד מותאם).",
                          "No technician PIN. Whoever held it gets the system administrator role (or a custom role)."),
    "pin_settings": ("לא רלוונטי: אין PIN וההפעלות הן של מערכת הבית.", "Not applicable: there is no PIN and sessions belong to the home system."),
    "snapshot_meaning": ("משמעות אחרת: בישן רענון תמונה כל {seconds} שניות; ב־Arx מטמון תמונה (הגדרות › מדיה). לא מועתק.",
                         "Another meaning: the legacy refreshed a picture every {seconds} s; Arx caches a picture (Settings > Media). Not copied."),
    "log_level": ("ל־Arx אפשרות log_level משלו; לא מועתק.", "Arx has its own log_level option; not copied."),
    "event_debug": ("לא נדרש: ל־Arx אבחון אירועים משלו.", "Not needed: Arx has its own event diagnostics."),
    "unknown_key": ("מפתח שאינו מוכר מגרסה 1.5.27; לא מועתק (נשמר בדוח).", "A key unknown to version 1.5.27; not copied (kept in this report)."),
    "offset_zero": ("היסט התצוגה האפקטיבי בישן הוא 0; Arx מציג את זמני ה־NVR כמו שהם ({zone}).",
                    "The legacy's effective display offset is 0; Arx shows the NVR times as they are ({zone})."),
    "offset_nonzero": ("הישן הזיז את זמני ההקלטות ב־{minutes} דקות; Arx לא מזיז ({zone}). לאשר זמן של אירוע ידוע בשתי המערכות לפני המעבר.",
                       "The legacy shifted recording times by {minutes} min; Arx does not shift them ({zone}). Confirm one known event's time in both before the switch."),
    "manual_recording": ("הקלטה ידנית רצה בערוץ {channel} - לא מועברת (פקודה פעילה ב־NVR). לעצור אותה בממשק הישן לפני כיבויו.",
                         "A running manual recording on channel {channel} - not carried over (a live NVR command). Stop it in the legacy UI before stopping the legacy add-on."),
    "manual_recording_ended": ("שורת הקלטה ידנית שזמנה עבר; לא מועברת.", "A manual-recording row whose end has passed; not carried over."),
    "events_archive": ("מאגר האירועים של הישן ({rows} שורות) לא מיובא: ל־Arx אירועים משלו. הקובץ נשאר אצל הישן כארכיון.",
                       "The legacy event store ({rows} rows) is not imported: Arx keeps its own events. The file stays with the legacy add-on as an archive."),
    "layouts": ("הישן לא שומר תצוגות: מספר המסכים ובחירת המצלמות נשכחים בכל טעינה, וערכת הנושא בדפדפן בלבד. ב־Arx: תצוגות שמורות.",
                "The legacy stores no layouts: the screen count and camera choice reset on every load, the theme lives in the browser. In Arx: saved views."),
    "schedules": ("לוחות הזמנים של ההקלטה נמצאים ב־NVR עצמו; Arx קורא אותם משם. אין מה להעביר.",
                  "The recording schedules live on the NVR itself; Arx reads them there. Nothing to carry over."),
    "notifications": ("לישן אין התראות (מסך האירועים היה כבוי). התראות ב־Arx מוגדרות בהגדרות › התראות.",
                      "The legacy sends no notifications (its events screen was off). Arx notifications are set in Settings > Notifications."),
}
WARNINGS: dict[str, tuple[str, str]] = {
    "legacy_version_other": ("הקובץ מגרסה אחרת של התוסף הישן ({version}); המיפוי נבדק מול 1.5.27.",
                             "The files come from another legacy version ({version}); the mapping was checked against 1.5.27."),
    "legacy_version_unknown": ("גרסת התוסף הישן לא ידועה מהקבצים; המיפוי נבדק מול 1.5.27.",
                               "The legacy version is not known from these files; the mapping was checked against 1.5.27."),
    "several_options": ("נמצאו כמה עותקים שונים של אפשרויות הישן; נלקח זה שהתוסף רץ איתו.",
                        "Several different copies of the legacy options were found; the one the add-on ran with is used."),
    "several_overrides": ("נמצאו כמה קובצי override; נלקח הראשון.", "Several override documents were found; the first is used."),
    "several_event_stores": ("נמצאו כמה מאגרי אירועים; נספר הגדול.", "Several event stores were found; the largest is counted."),
    "several_exports": ("נמצאו כמה קובצי ייצוא; נלקח הראשון.", "Several export documents were found; the first is used."),
    "member_too_large": ("קובץ גדול מדי בתוך הארכיון דולג.", "A member of the archive was too large and was skipped."),
    "backup_without_legacy_addon": ("בגיבוי אין את התוסף הישן; נקראו רק קובצי התצורה.",
                                    "The backup does not hold the legacy add-on; only the configuration files were read."),
    "options_not_recognised": ("קובץ האפשרויות לא זוהה.", "The options file was not recognised."),
    "override_not_recognised": ("קובץ ה־override לא זוהה.", "The override file was not recognised."),
    "events_not_recognised": ("מאגר האירועים לא זוהה.", "The event store was not recognised."),
    "no_options": ("לא נמצאו אפשרויות הישן: אי אפשר להשוות חיבור NVR, go2rtc ו־PIN.",
                   "No legacy options were found: the NVR connection, go2rtc and PINs cannot be compared."),
    "several_recorders": ("ל־Arx יש יותר ממקליט אחד; השמות מותאמים למקליט הראשון בלבד.",
                          "Arx has more than one recorder; the names are matched to the first recorder only."),
    "manual_recording_running": ("יש הקלטות ידניות רצות בישן: לעצור אותן בממשק הישן לפני כיבויו.",
                                 "Manual recordings are running in the legacy: stop them in the legacy UI before stopping it."),
    "display_offset": ("היסט תצוגה אפקטיבי {minutes} דקות בישן: לבדוק זמן של אירוע ידוע בשתי המערכות.",
                       "The legacy's effective display offset is {minutes} min: check one known event's time in both."),
}


def _text(table: dict[str, tuple[str, str]], code: str, lang: str, **params: Any) -> str:
    he, en = table.get(code, (code, code))
    out = en if lang == "en" else he
    try:
        return out.format(**params) if params else out
    except (KeyError, IndexError, ValueError):
        return out


def _item(area: str, ident: str, action: str, code: str, lang: str, *, target: dict[str, Any] | None = None, value: str | None = None,
          **params: Any) -> dict[str, Any]:
    assert action in ACTIONS, action
    it: dict[str, Any] = {"id": f"{area}.{ident}", "area": area, "action": action, "code": code, "note": _text(NOTES, code, lang, **params)}
    if target is not None:
        it["target"] = target
    if value is not None:
        it["value"] = value
    return it


def _now_iso() -> str:
    return dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


# ---------------------------------------------------------------- the sections of the plan

def _cameras(conn: sqlite3.Connection, src: LegacySource, lang: str, warnings: list[str]) -> list[dict[str, Any]]:
    try:
        removed = {r[0] for r in conn.execute("SELECT id FROM recorders WHERE removed_at IS NOT NULL").fetchall()}
    except sqlite3.OperationalError:  # a database before 0055
        removed = set()
    recorders = [r[0] for r in conn.execute("SELECT id FROM recorders").fetchall() if r[0] not in removed]
    if len(recorders) > 1:
        warnings.append("several_recorders")
    cams = conn.execute("SELECT id, channel, alias, name_source FROM cameras WHERE recorder_id = ? ORDER BY channel", (PRIMARY,)).fetchall() \
        if PRIMARY not in removed else []
    by_channel = {int(c["channel"]): c for c in cams}
    names = src.override.get("camera_names") if isinstance(src.override.get("camera_names"), dict) else {}
    out: list[dict[str, Any]] = []
    seen: set[int] = set()

    def order(kv: tuple[str, Any]) -> tuple[int, int, str]:
        k = str(kv[0]).strip()
        return (0, int(k), "") if k.isdigit() else (1, 0, k)

    for key, name in sorted(names.items(), key=order):
        k = str(key).strip()
        legacy = str(name).strip()
        if not k.isdigit() or int(k) < 1:
            out.append(_item("cameras", f"key.{len(out)}", "skip", "bad_channel", lang, value=legacy))
            continue
        ch = int(k)
        seen.add(ch)
        cam = by_channel.get(ch)
        if cam is None:
            out.append(_item("cameras", f"ch{ch}", "skip", "no_arx_camera", lang, target={"channel": ch}, value=legacy, channel=ch))
            continue
        target = {"camera_id": cam["id"], "channel": ch}
        current = (cam["alias"] or "").strip()
        if len(legacy) > ALIAS_MAX:
            out.append(_item("cameras", f"ch{ch}", "skip", "alias_too_long", lang, target=target, value=legacy[:ALIAS_MAX]))
        elif not current:
            out.append(_item("cameras", f"ch{ch}", "update", "alias_set", lang, target=target, value=legacy))
        elif current == legacy:
            out.append(_item("cameras", f"ch{ch}", "same", "alias_same", lang, target=target, value=legacy))
        else:
            out.append(_item("cameras", f"ch{ch}", "keep", "alias_keep", lang, target={**target, "arx_alias": current}, value=legacy))
    for ch, cam in sorted(by_channel.items()):
        if ch not in seen:
            out.append(_item("cameras", f"ch{ch}", "info", "arx_only_camera", lang, target={"camera_id": cam["id"], "channel": ch}))
    return out


def _connection(settings: Any, src: LegacySource, lang: str) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    if not src.option_keys and not src.override_keys:
        return out
    arx_host = host_digest(getattr(settings, "nvr_host", None))
    if src.nvr_host_digest is None:
        out.append(_item("connection", "host", "info", "conn_host_unknown", lang))
    elif arx_host is None:
        out.append(_item("connection", "host", "manual", "conn_host_missing", lang))
    else:
        same = arx_host == src.nvr_host_digest
        out.append(_item("connection", "host", "same" if same else "manual", "conn_host_same" if same else "conn_host_other", lang))
    eff = {**src.options, **{k: v for k, v in src.override.items() if k in ("nvr_port", "nvr_rtsp_port") and v not in (None, "")},
           **({"nvr_user": src.override["nvr_user"]} if str(src.override.get("nvr_user") or "").strip() else {})}
    for key, attr, ident in (("nvr_port", "nvr_http_port", "http_port"), ("nvr_rtsp_port", "nvr_rtsp_port", "rtsp_port")):
        if key not in eff:
            continue
        try:
            legacy = int(eff[key])
        except (TypeError, ValueError):
            out.append(_item("connection", ident, "skip", "unknown_key", lang))
            continue
        same = int(getattr(settings, attr, 0) or 0) == legacy
        out.append(_item("connection", ident, "same" if same else "manual", "conn_port_same" if same else "conn_port_other", lang,
                         target={"legacy": legacy}))
    if str(eff.get("nvr_user") or "").strip():
        same = str(getattr(settings, "nvr_user", "") or "").strip() == str(eff["nvr_user"]).strip()
        out.append(_item("connection", "user", "same" if same else "manual", "conn_user_same" if same else "conn_user_other", lang))
    if src.secrets_present.get("options.nvr_password") or src.secrets_present.get("override.nvr_password"):
        out.append(_item("connection", "password", "manual" if not getattr(settings, "nvr_password", None) else "skip", "conn_password", lang))
    return out


def _options(settings: Any, src: LegacySource, lang: str) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    keys = set(src.option_keys)
    if "go2rtc_url" in keys:
        arx = host_digest(getattr(settings, "go2rtc_url", None))
        if arx is None:
            out.append(_item("options", "go2rtc_url", "manual", "go2rtc_missing", lang))
        elif src.go2rtc_url_digest is None or arx == src.go2rtc_url_digest:
            out.append(_item("options", "go2rtc_url", "same", "go2rtc_same", lang))
        else:
            out.append(_item("options", "go2rtc_url", "manual", "go2rtc_other", lang))
    fixed = {"go2rtc_ingress_path": ("skip", "go2rtc_ingress"), "pin_length": ("skip", "pin_settings"), "session_minutes": ("skip", "pin_settings"),
             "log_level": ("skip", "log_level"), "event_search_debug": ("skip", "event_debug")}
    for key in sorted(keys):
        if key in fixed:
            action, code = fixed[key]
            out.append(_item("options", key, action, code, lang))
        elif key == "snapshot_seconds":
            out.append(_item("options", key, "skip", "snapshot_meaning", lang, value=str(src.options.get(key)), seconds=src.options.get(key)))
    if src.secrets_present.get("options.app_pin"):
        out.append(_item("people", "app_pin", "manual", "people_pin", lang))
    if src.secrets_present.get("options.technician_pin"):
        out.append(_item("people", "technician_pin", "manual", "people_technician", lang))
    known = {"nvr_ip", "nvr_port", "nvr_rtsp_port", "nvr_user", "nvr_password", "app_pin", "technician_pin", "go2rtc_url", "snapshot_seconds", *fixed}
    for key in sorted(keys - known):
        out.append(_item("options", f"unknown.{key}", "skip", "unknown_key", lang, value=key))
    return out


def standard_offset_minutes(zone: str) -> int:
    """The zone's standard UTC offset (what the legacy's 'auto' read from the NVR's localTime suffix - KNOWN_QUIRKS T1)."""
    try:
        from zoneinfo import ZoneInfo

        tz = ZoneInfo(zone)
    except Exception:  # noqa: BLE001 - an unknown zone reads as Israel's (the only site)
        return 120
    year = dt.datetime.now(dt.timezone.utc).year
    offs = []
    for month in (1, 7):
        off = dt.datetime(year, month, 15, 12, tzinfo=tz).utcoffset()
        offs.append(int(off.total_seconds() // 60) if off is not None else 0)
    return min(offs)


def effective_offset(override: dict[str, Any], auto_minutes: int) -> dict[str, Any]:
    """The legacy's recording display offset exactly as app/main.py computed it (auto = the NVR's standard offset)."""
    mode = str(override.get("recording_display_offset_mode", "auto_plus_manual") or "auto_plus_manual").strip()
    if mode not in ("auto", "manual", "auto_plus_manual"):
        mode = "auto_plus_manual"
    direction = str(override.get("recording_display_offset_direction", "add") or "add").strip()
    if direction not in ("add", "subtract"):
        direction = "add"
    try:
        minutes = abs(int(override.get("recording_display_offset_minutes", 0) or 0))
    except (TypeError, ValueError):
        minutes = 0
    manual = minutes if direction == "add" else -minutes
    auto = auto_minutes if mode in ("auto", "auto_plus_manual") else 0
    manual_part = manual if mode in ("manual", "auto_plus_manual") else 0
    return {"mode": mode, "direction": direction, "minutes": minutes, "auto_minutes": auto, "manual_minutes": manual_part,
            "effective_minutes": auto + manual_part}


def _time(conn: sqlite3.Connection, src: LegacySource, lang: str, warnings: list[str]) -> tuple[list[dict[str, Any]], dict[str, Any] | None]:
    if not any(k.startswith("recording_display_offset") for k in src.override_keys) and "override" not in src.found:
        return [], None
    from .settings_store import setting_value

    try:
        zone = str(setting_value(conn, "time.zone") or "Asia/Jerusalem")
    except KeyError:
        zone = "Asia/Jerusalem"
    info = effective_offset(src.override, standard_offset_minutes(zone))
    info["zone"] = zone
    if info["effective_minutes"] == 0:
        return [_item("time", "display_offset", "skip", "offset_zero", lang, zone=zone)], info
    warnings.append("display_offset")
    return [_item("time", "display_offset", "skip", "offset_nonzero", lang, minutes=f"{info['effective_minutes']:+d}", zone=zone)], info


def _manual(src: LegacySource, lang: str, warnings: list[str]) -> list[dict[str, Any]]:
    rows = src.override.get("manual_recording") if isinstance(src.override.get("manual_recording"), list) else []
    out: list[dict[str, Any]] = []
    now = _now_iso()
    running = False
    for i, r in enumerate(rows):
        ch = str(r.get("channelID") or r.get("trackID") or "?")
        until = r.get("untilIso")
        ended = isinstance(until, str) and until and until < now and int(r.get("durationSeconds") or 0) > 0
        if ended:
            out.append(_item("manual_recording", f"row{i}", "skip", "manual_recording_ended", lang, target={"channel": ch}))
        else:
            running = True
            out.append(_item("manual_recording", f"row{i}", "manual", "manual_recording", lang, target={"channel": ch}, channel=ch))
    if running:
        warnings.append("manual_recording_running")
    return out


def _fixed(src: LegacySource, lang: str) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    if src.events.get("present"):
        out.append(_item("events", "store", "skip", "events_archive", lang, target={"rows": int(src.events.get("rows") or 0)}, rows=src.events.get("rows")))
    out.append(_item("layouts", "live_grid", "info", "layouts", lang))
    out.append(_item("schedules", "recording", "info", "schedules", lang))
    out.append(_item("notifications", "all", "info", "notifications", lang))
    known = {*_OVERRIDE_HANDLED}
    for key in sorted(set(src.override_keys) - known):
        out.append(_item("override", f"unknown.{key}", "skip", "unknown_key", lang, value=key))
    return out


_OVERRIDE_HANDLED = ("camera_names", "manual_recording", "recording_display_offset_mode", "recording_display_offset_direction",
                     "recording_display_offset_minutes", "nvr_ip", "nvr_port", "nvr_rtsp_port", "nvr_user", "nvr_password")


def digest_of(src: LegacySource, items: list[dict[str, Any]]) -> str:
    """What an apply binds to: the source's SHA-256 and every write with its target and value."""
    writes = [[i["id"], i["action"], i.get("target"), i.get("value")] for i in items if i["action"] in WRITES]
    return hashlib.sha256(json.dumps({"schema": SCHEMA, "source": src.sha256, "writes": writes}, sort_keys=True, ensure_ascii=False).encode("utf-8")).hexdigest()


def runs(conn: sqlite3.Connection) -> list[dict[str, Any]]:
    from ..db import get_setting

    try:
        data = json.loads(get_setting(conn, RUNS_KEY) or "[]")
    except ValueError:
        return []
    return [r for r in data if isinstance(r, dict)][:RUNS_KEEP] if isinstance(data, list) else []


def plan(conn: sqlite3.Connection, settings: Any, src: LegacySource, lang: str = "he") -> dict[str, Any]:
    """The dry run: never writes."""
    warnings: list[str] = list(src.warnings)
    if "options" not in src.found and not src.option_keys:
        warnings.append("no_options")
    items: list[dict[str, Any]] = []
    items += _cameras(conn, src, lang, warnings)
    items += _connection(settings, src, lang)
    items += _options(settings, src, lang)
    time_items, time_info = _time(conn, src, lang, warnings)
    items += time_items
    items += _manual(src, lang, warnings)
    items += _fixed(src, lang)
    summary = {a: sum(1 for i in items if i["action"] == a) for a in ACTIONS}
    params = {"version": src.legacy_version or "?", "minutes": f"{(time_info or {}).get('effective_minutes', 0):+d}"}
    seen: list[str] = list(dict.fromkeys(warnings))
    prior = [r for r in runs(conn) if r.get("sha256") == src.sha256]
    return {
        "schema": SCHEMA,
        "source": describe(src),
        "summary": summary,
        "items": items,
        "warnings": [{"code": w, "note": _text(WARNINGS, w, lang, **params)} for w in seen],
        "time": time_info,
        "writes": {"arx": "camera aliases that are empty today, after a backup", "nvr": "none", "home_system": "none", "go2rtc": "none"},
        "plan_digest": digest_of(src, items),
        "applied_before": prior,
    }


class PlanChanged(Exception):
    pass


class BackupFailed(Exception):
    """The project backup before the first change could not be written: nothing was changed."""


def apply(conn: sqlite3.Connection, settings: Any, src: LegacySource, *, plan_digest: str, actor: Any, request_id: str | None,
          confirm_word: str | None, lang: str = "he", backup: Any = None) -> dict[str, Any]:
    """Do the plan the caller looked at. `backup(settings, conn, kind, note)` writes the project backup (services.backup.create;
    a seam for tests). Raises PlanChanged (nothing written) when the plan is no longer the one with `plan_digest`."""
    from ..audit import audit
    from ..db import now_iso, set_setting, unlocked

    fresh = plan(conn, settings, src, lang)
    if fresh["plan_digest"] != plan_digest:
        raise PlanChanged(fresh["plan_digest"])
    todo = [i for i in fresh["items"] if i["action"] in WRITES]
    prior = fresh["applied_before"]
    entry: dict[str, Any] | None = None
    applied: list[dict[str, Any]] = []
    unchanged = 0
    if todo:
        note = f"before legacy import {src.sha256[:12]}"
        try:
            if backup is not None:
                entry = backup(settings, conn, BACKUP_KIND, note)
            else:
                # CD-03 (CORE-05 on this path): the snapshot is read under the request's transaction, the archive is compressed with
                # the single write lock given up (HA state writes, recorder alerts and user actions go on meanwhile), then the lock is
                # taken back.
                from . import backup as backup_svc

                prepared = backup_svc.prepare(conn, BACKUP_KIND, note)
                with unlocked(conn):
                    entry = backup_svc.write_prepared(settings, prepared)
        except Exception as exc:  # noqa: BLE001 - no backup, no change (the caller answers 409)
            raise BackupFailed(type(exc).__name__) from None
        if backup is None:
            # the lock was open for a while: the plan must still be the one the administrator looked at before the first change
            # (the UPDATEs below are also guarded on an empty alias, so this only keeps the answer honest: nothing written, 409)
            again = plan(conn, settings, src, lang)
            if again["plan_digest"] != plan_digest:
                raise PlanChanged(again["plan_digest"])
        at = now_iso()
        for it in todo:
            if it["area"] != "cameras" or it["action"] != "update":
                continue
            cid = it["target"]["camera_id"]
            cur = conn.execute("UPDATE cameras SET alias = ?, updated_at = ? WHERE id = ? AND (alias IS NULL OR TRIM(alias) = '')",
                               (it["value"], at, cid))
            if cur.rowcount == 1:
                applied.append({"camera_id": cid, "channel": it["target"]["channel"]})
                audit(conn, actor=actor, action="camera.update", decision="allowed", resource_type="camera", resource_id=cid, request_id=request_id,
                      details={"alias": it["value"], "via": "legacy_import"})
            else:
                unchanged += 1
    run = {"at": _now_iso(), "by": getattr(actor, "user_id", None), "sha256": src.sha256, "container": src.container,
           "applied": len(applied), "unchanged": unchanged, "backup": entry["name"] if entry else None, "plan_digest": plan_digest}
    history = [run, *runs(conn)][:RUNS_KEEP]
    set_setting(conn, RUNS_KEY, json.dumps(history, ensure_ascii=False))
    audit(conn, actor=actor, action="migration.legacy.apply", decision="allowed", resource_type="installation", resource_id="legacy",
          request_id=request_id, reason=None if todo else "nothing_to_apply",
          details={"sha256": src.sha256, "container": src.container, "applied": len(applied), "unchanged": unchanged,
                   "backup": entry["name"] if entry else None, "summary": fresh["summary"], "confirm_word": confirm_word})
    return {"applied": len(applied), "unchanged": unchanged, "cameras": applied,
            "backup": {k: entry[k] for k in ("name", "bytes", "created_at")} if entry else None,
            "already_applied": bool(prior) and not todo, "run": run}
