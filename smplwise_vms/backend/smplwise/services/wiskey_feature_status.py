"""WISKEY-PAIRING-2382 (scope addition, plan WISKEY_FULL_INTEGRATION_PLAN_2026-11-03 task T3 "מצב WisKey"): for every WisKey feature Arx has
BUILT but that is OFF or BLOCKED right now (the plan's capability matrix rows marked O), the exact reasons in plain Hebrew and how to turn it on.

Read only: settings, build constants, the process's own state (the direct join, the media provider, the feed's discovery) and the last pairing
probe (services/wiskey_pairing.py). Nothing is sent, nothing is written, no switch is changed here. Features another team owns (talk / dial,
managed install, door map, relay map) are shown as status with a link to their screen only.

Each row: {row (matrix #), key, label, group, state: on | off | blocked | unknown, reasons: [{code, kind, text, fix}], link: {href, label} | None}.
`kind` is the plan's legend: SET (an Arx setting / switch), POL (policy B or a build constant), PAIR (pairing / signing), WK (WisKey side),
OWN (an owner action in the lab), RUN (Arx must be restarted to pick a setting up)."""
from __future__ import annotations

from typing import Any, Callable

from ..db import get_setting
from . import wiskey_media_contract as w10

ON, OFF, BLOCKED, UNKNOWN = "on", "off", "blocked", "unknown"
ACCESS_TAB = {"href": "#/system/diagnostics?tab=access-control", "label": "הגדרות › מתגי מסכי כניסה"}
SETUP = {"href": "#/system/setup", "label": "הגדרות › הקמה"}
SECURITY_WISKEY = {"href": "#/system/security/wiskey", "label": "הגדרות › אבטחה › WisKey"}
DOOR_WINDOWS = {"href": "#/wiskey/door-windows", "label": "חלונות דלת"}
BRIDGE_TAB = {"href": "#/system/diagnostics?tab=ha", "label": "הגדרות › גשר Arx"}

R: dict[str, tuple[str, str, str]] = {  # code -> (kind, text, how to turn it on)
    "provider_local": ("SET", "מקור הווידאו והדיבור מוגדר \"Arx (וידאו בלבד)\", ולכן החיבור הישיר ל־WisKey לא מופעל.",
                       "בהגדרות › מתגי מסכי כניסה › מקור הווידאו והדיבור: \"WisKey (וידאו ודיבור)\", ואז הפעלה מחדש של Arx."),
    "key_missing": ("PAIR", "אין מפתח צימוד, ולכן Arx לא חותם על פקודות אל WisKey.", "צימוד מחדש בבלוק \"חיבור Arx ל-WisKey\" למעלה."),
    "key_unreadable": ("PAIR", "לא ניתן לפענח את מפתח הגשר במכונה הזו.", "צימוד מחדש בבלוק \"חיבור Arx ל-WisKey\" למעלה."),
    "key_rotated": ("PAIR", "מפתח הגשר הוחלף; החיבור הישיר של WisKey (גרסה 1) לא מקבל מפתח עם מזהה מפתח.",
                    "צימוד מחדש בבלוק \"חיבור Arx ל-WisKey\" למעלה, עם כיבוי החלפת מפתח הגשר."),
    "join_not_started": ("RUN", "החיבור הישיר לא פעיל כרגע.",
                         "Arx מפעיל אותו לבד, בלי הפעלה מחדש, כש\"מקור הווידאו והדיבור\" הוא WisKey ומפתח הצימוד תקין; אם זה לא קורה - \"בדוק חיבור חתום\" בבלוק \"חיבור Arx ל-WisKey\" למעלה."),
    "join_starting": ("RUN", "החיבור הישיר {what} כעת.", "אין צורך בהפעלה מחדש: רעננו את הדף בעוד רגע."),
    "join_error": ("RUN", "החיבור הישיר נכשל ({error}); Arx ינסה שוב לבד.", "\"בדוק חיבור חתום\" בבלוק \"חיבור Arx ל-WisKey\" למעלה."),
    "not_proven": ("PAIR", "עוד לא הוכח ש־WisKey מקבל את החתימה של Arx.", "\"בדוק חיבור חתום\" בבלוק \"חיבור Arx ל-WisKey\" למעלה."),
    "refused": ("PAIR", "WisKey דחה את החתימה של Arx בבדיקה האחרונה.", "ראו את ההנחיות בבלוק \"חיבור Arx ל-WisKey\" למעלה."),
    "feed_not_listed": ("WK", "Arx בוחר ב־WisKey לפי רשימת הפקודות שבערוץ השירות, ושם פקודות המדיה לא מופיעות ({why}).",
                        "פריט פתוח בפיתוח: WisKey יפרסם את פקודות המדיה ברשימה, או ש־Arx יבחר לפי הגילוי החתום. לא פעולה של בעל המערכת."),
    "feed_no_talk": ("WK", "ברשימת הפקודות של ערוץ השירות אין את פקודות הדיבור.", "פריט פתוח בפיתוח (כמו בשורה של הווידאו)."),
    "direct_no_media": ("WK", "בגילוי החתום (direct/capabilities) חסרות פקודות מדיה: {missing}.", "עדכון WisKey לגרסה שמפרסמת אותן (בהתקנה ידנית - בעל המערכת)."),
    "no_talk_audio": ("WK", "WisKey לא מציע את צליל העמדה בתוך שיחה (station_talk_audio) בגילוי החתום.", "עדכון WisKey (בהתקנה ידנית - בעל המערכת)."),
    "media_off": ("SET", "המתג \"מדיה של העמדות\" כבוי.", "בהגדרות › מתגי מסכי כניסה: מדיה של העמדות - וידאו (או וידאו ודיבור)."),
    "media_no_talk": ("SET", "המתג \"מדיה של העמדות\" מוגדר לווידאו בלבד.", "בהגדרות › מתגי מסכי כניסה: מדיה של העמדות - וידאו ודיבור."),
    "listen_off": ("SET", "המתג \"האזנה לעמדה\" כבוי.", "בהגדרות › מתגי מסכי כניסה: האזנה לעמדה."),
    "listen_no_downlink": ("WK", "WisKey לא מפרסם פקודת האזנה בלי שיחה (אין ערוץ שמע מהעמדה מחוץ לשיחה).", "ממתין ל־WisKey. בינתיים צליל העמדה זמין בתוך שיחה."),
    "policy_b": ("POL", "מדיניות B: Arx לא מתקין ולא מנהל את WisKey, והתכונה זמינה רק בהתקנה מנוהלת.",
                 "ממתין להתקנה מנוהלת (בעבודה, צוות ההתקנה המנוהלת). לא מפעילים את wiskey.auto_install ידנית."),
    "owner_on_not_permitted": ("POL", "הפעלת ההתקנה המנוהלת חסומה בגרסה הזו (OWNER_ON_PERMITTED).", "ממתין לגרסה עם ההתקנה המנוהלת ואישור בעל המערכת."),
    "service_grant_manual": ("WK", "בהתקנה ידנית אין ב־WisKey כותב להרשאת השירות (native_service_grants_v1), ולכן WisKey עונה service_grant_required.",
                             "תיפתר עם ההתקנה המנוהלת, או כשבעל המערכת יגדיר הרשאת שירות ב־WisKey (לפי הנחיות WisKey)."),
    "not_built": ("POL", "הזרימה לא בנויה עדיין ב־Arx (קבוע בנייה כבוי).", "פריט פיתוח פתוח; אין מה להפעיל כרגע."),
    "peer_receipt_off": ("SET", "מתג אישור הקבלה של WisKey (wiskey.peer_receipt) כבוי, וקריאת רישום העמיתים לא בנויה.", "פריט פיתוח פתוח; אין מה להפעיל כרגע."),
    "acr5_off": ("SET", "מתגי הקריאה החוזרת של WisKey כבויים ({on} מתוך 4 פעילים).", "הגדרות › אבטחה › WisKey."),
    "doors_unmapped": ("OWN", "{count} דלתות של WisKey לא משויכות לממסר בעמדה, ופתיחה שלהן נדחית.", "הגדרות › הקמה › שיוך דלתות: אשרו את ההצעות או שייכו ידנית."),
    "windows_off": ("SET", "חלונות הדלת כבויים (doors.windows.enabled).", "חלונות דלת › הגדרות."),
    "emergency_off": ("SET", "פתיחת חירום כבויה (doors.emergency.enabled / open_enabled).", "חלונות דלת › חירום (מנהל מערכת, עם אישור)."),
    "automation_off": ("SET", "פתיחת דלת מאוטומציה כבויה (doors.automation_open).", "הגדרות › הקמה › פתיחת דלתות מאוטומציה."),
    "lock_unsupported": ("WK", "WisKey מסמן נעילת חירום כלא נתמכת (emergency_secure_unsupported_v1).", "ממתין ל־WisKey."),
    "template_off": ("SET", "שליחת תבניות וואטסאפ דרך WisKey כבויה (messaging.template_send).", "הגדרות ההודעות › תבניות וואטסאפ."),
    "owner_excluded": ("POL", "פקודות אישור כפול של WisKey מוחרגות בהחלטת בעל המערכת (ההרשאות של Arx הן הסמכות).", "אין צורך להפעיל."),
    "probe_unknown": ("PAIR", "לא ידוע אם WisKey מקבל את החתימה (הבדיקה לא הסתיימה או לא הגיעה ל־WisKey).", "\"בדוק חיבור חתום\" שוב."),
}


def _reason(code: str, **fmt: Any) -> dict[str, Any]:
    kind, text, fix = R[code]
    return {"code": code, "kind": kind, "text": text.format(**fmt) if fmt else text, "fix": fix}


def _join_live() -> dict[str, Any]:
    """WISKEY-JOIN-LIVE-2382: the runtime join's state (`wiskey_join_live.join_state`, no I/O, never raises); {} when unreadable."""
    try:
        from . import wiskey_join_live

        return wiskey_join_live.join_state()
    except Exception:  # noqa: BLE001 - the page falls back to "installed or not"
        return {}


class Facts:
    """The shared facts of one status read, computed once."""

    def __init__(self, conn: Any, settings: Any) -> None:
        from . import intercom_media, wiskey_auto_install as wai, wiskey_direct_join, wiskey_pairing as wp

        self.conn = conn
        self.provider = intercom_media.provider_choice(conn)
        self.key = wp.key_facts(conn, getattr(settings, "data_dir", None))["state"]
        self.join = wiskey_direct_join.installed() is not None
        self.live = _join_live()
        self.managed = bool(wai.switch_on(conn))
        self.owner_on = bool(wai.owner_on_permitted())
        self.feed_video, self.feed_talk, self.feed_reason = wp.feed_listing(settings)
        p = wp.PROBE["last"]
        self.accepted = None if p is None else p.get("accepted")
        self.probed = p is not None
        self.caps = (p or {}).get("capabilities")

    def setting(self, key: str, default: str = "off") -> str:
        try:
            return get_setting(self.conn, key, default) or default
        except Exception:  # noqa: BLE001 - an older database: the default
            return default

    def direct(self) -> list[dict[str, Any]]:
        """Why the direct join (the transport of every signed native feature) is not usable now; [] when it is."""
        out: list[dict[str, Any]] = []
        if self.provider != "auto":
            out.append(_reason("provider_local"))
        if self.key != "ok":
            out.append(_reason("key_" + self.key))
        if not out:  # WISKEY-JOIN-LIVE-2382: the join starts / stops at runtime - say where it is now
            live = self.live.get("state")
            if live in ("starting", "connecting", "stopping"):
                out.append(_reason("join_starting", what={"starting": "מופעל", "connecting": "מתחבר", "stopping": "נעצר"}[live]))
            elif live == "error":
                out.append(_reason("join_error", error=self.live.get("last_error") or "unknown"))
            elif not self.join:
                out.append(_reason("join_not_started"))
        if self.key == "ok":
            if self.accepted is False:
                out.append(_reason("refused"))
            elif not self.probed:
                out.append(_reason("not_proven"))
            elif self.accepted is None:
                out.append(_reason("probe_unknown"))
        return out

    def managed_reasons(self) -> list[dict[str, Any]]:
        if self.managed:
            return []
        return [_reason("policy_b")] + ([] if self.owner_on else [_reason("owner_on_not_permitted")])


def _media(f: Facts, *, talk: bool, sound: bool = False) -> list[dict[str, Any]]:
    out = f.direct()
    media = f.setting("access.station_media")
    if media == "off":
        out.append(_reason("media_off"))
    elif talk and media != "video_talk":
        out.append(_reason("media_no_talk"))
    if not f.feed_video:
        out.append(_reason("feed_not_listed", why=f.feed_reason or "not_listed"))
    elif talk and not f.feed_talk:
        out.append(_reason("feed_no_talk"))
    if f.caps:
        need = w10.COMMANDS if talk else w10.VIDEO_COMMANDS
        missing = [c for c in need if c not in f.caps.get("commands", [])]
        if missing:
            out.append(_reason("direct_no_media", missing=", ".join(missing)))
        if sound and not f.caps.get("talk_audio"):
            out.append(_reason("no_talk_audio"))
    return out


def _switch(f: Facts, key: str, code: str) -> list[dict[str, Any]]:
    return [] if f.setting(key) == "on" else [_reason(code)]


def _acr5(f: Facts) -> list[dict[str, Any]]:
    from . import wiskey_acr5

    keys = list(dict.fromkeys(getattr(wiskey_acr5, "FLAGS", {}).values())) or ["wiskey.acr5_access_state", "wiskey.acr5_normalize_user",
                                                                                     "wiskey.acr5_presence", "wiskey.acr5_feature_plans"]
    on = sum(1 for k in keys if f.setting(k) == "on")
    return [] if on == len(keys) else [_reason("acr5_off", on=on)]


def _doors(f: Facts) -> list[dict[str, Any]]:
    from . import intercom_doors

    n = intercom_doors.unmapped_summary(f.conn)["count"]
    return [_reason("doors_unmapped", count=n)] if n else []


def _service_writer(f: Facts) -> list[dict[str, Any]]:
    return f.direct() + ([] if f.managed else [_reason("service_grant_manual")]) + f.managed_reasons()


def _capture(_f: Facts) -> list[dict[str, Any]]:
    from . import access_cards, wiskey_capture_map

    return [] if (wiskey_capture_map.MAPPING_ENABLED and access_cards.CAPTURE_PERMITTED) else [_reason("not_built")]


def _peer_writes(f: Facts) -> list[dict[str, Any]]:
    from . import wiskey_peer

    return f.direct() + ([] if wiskey_peer.enabled(f.conn) else [_reason("peer_receipt_off")])


def _emergency(f: Facts) -> list[dict[str, Any]]:
    on = f.setting("doors.emergency.enabled") == "on" and f.setting("doors.emergency.open_enabled") == "on"
    return f.direct() + ([] if on else [_reason("emergency_off")])


def _lock(_f: Facts) -> list[dict[str, Any]]:
    from . import door_engine_live

    eng = getattr(door_engine_live, "LiveEmergencyEngine", None)
    supported = bool(getattr(eng, "lock_supported", False)) if eng is not None else False
    return [] if supported else [_reason("lock_unsupported")]


def _listen(f: Facts) -> list[dict[str, Any]]:
    return ([] if f.setting("access.station_listen") in ("on", "probe") else [_reason("listen_off")]) + [_reason("listen_no_downlink")]


def _template(f: Facts) -> list[dict[str, Any]]:
    from . import wa_template_send

    return f.direct() + ([] if wa_template_send.switch_on(f.conn) else [_reason("template_off")])


# (matrix #, key, group, label, check, link)
ROWS: list[tuple[int, str, str, str, Callable[[Facts], list[dict[str, Any]]], dict[str, str] | None]] = [
    (92, "direct_api", "חיבור", "החיבור הישיר ל־WisKey (גילוי, זהות שירות)", lambda f: f.direct(), None),
    (54, "w10_video", "מדיה ודיבור", "וידאו של עמדה דרך WisKey", lambda f: _media(f, talk=False), ACCESS_TAB),
    (55, "w10_talk", "מדיה ודיבור", "דיבור דו־כיווני עם עמדה", lambda f: _media(f, talk=True), ACCESS_TAB),
    (56, "w10_sound", "מדיה ודיבור", "צליל העמדה בתוך שיחה", lambda f: _media(f, talk=True, sound=True), ACCESS_TAB),
    (57, "listen", "מדיה ודיבור", "האזנה לעמדה בלי שיחה", _listen, ACCESS_TAB),
    (20, "native_people_writes", "אנשים", "כתיבת אנשים חתומה (Native, שרשרת אישור)", _peer_writes, None),
    (21, "service_writer", "אנשים", "כותב השירות של WisKey (יצירה, עדכון, קוד, ביטול זמני)", _service_writer, None),
    (22, "readback", "אנשים", "קריאה חוזרת של הרשאות אדם מ־WisKey", _acr5, SECURITY_WISKEY),
    (23, "csv_preview", "אנשים", "תצוגה מקדימה מאומתת ב־WisKey לייבוא CSV", lambda f: f.direct(), None),
    (19, "capture_lease", "אנשים", "קליטת כרטיס בחתימה (capture lease)", _capture, None),
    (39, "door_release", "דלתות", "פתיחת דלת מ־Arx", _doors, SETUP),
    (43, "programs_save", "דלתות", "שמירת תוכניות החזקה פתוחה בעמדה", lambda f: f.direct() + _switch(f, "doors.windows.enabled", "windows_off"), DOOR_WINDOWS),
    (66, "door_windows", "דלתות", "חלונות דלת", lambda f: f.direct() + _switch(f, "doors.windows.enabled", "windows_off"), DOOR_WINDOWS),
    (67, "emergency_open", "דלתות", "פתיחת חירום", _emergency, DOOR_WINDOWS),
    (68, "emergency_lock", "דלתות", "נעילת חירום", _lock, None),
    (69, "door_automations", "דלתות", "פתיחת דלת מאוטומציה", lambda f: f.direct() + _switch(f, "doors.automation_open", "automation_off"), SETUP),
    (65, "feature_host", "דלתות", "מארח התכונות של WisKey", lambda f: f.direct(), None),
    (71, "live_media_feature", "מדיה ודיבור", "מדיה חיה לתכונות (media ingress)", lambda f: f.direct(), None),
    (74, "template_send", "הודעות", "שליחת תבניות וואטסאפ דרך WisKey (גרסה 2)", _template, None),
    (74, "template_queue", "הודעות", "תור תבניות וגרסה 3", lambda f: f.direct() + f.managed_reasons(), None),
    (12, "event_cursor", "אירועים", "סמן אירועים עמיד (חידוש אחרי ניתוק)", lambda f: f.managed_reasons(), None),
    (41, "relay_map_stage", "התקנה", "העברת מפת הממסרים ל־WisKey", lambda f: f.managed_reasons(), SETUP),
    (81, "job_approvals", "התקנה", "אישור כפול של WisKey", lambda f: [] if f.managed else [_reason("owner_excluded")], None),
    (94, "managed_install", "התקנה", "התקנה ועדכון מנוהלים של WisKey", lambda f: f.managed_reasons(), BRIDGE_TAB),
    (97, "generation_journal", "התקנה", "יומן דורות ותחזוקה של ההתקנה", lambda f: f.managed_reasons(), None),
]


def rows(conn: Any, settings: Any) -> list[dict[str, Any]]:
    """Every checklist row with its state. A row whose own check fails is `unknown` (never `on`)."""
    f = Facts(conn, settings)
    out: list[dict[str, Any]] = []
    for num, key, group, label, check, link in ROWS:
        try:
            reasons = check(f)
            state = ON if not reasons else (BLOCKED if any(r["kind"] in ("PAIR", "WK", "POL") for r in reasons) else OFF)
        except Exception as exc:  # noqa: BLE001 - one broken check never hides the others
            reasons = [{"code": "check_failed", "kind": "RUN", "text": f"לא ניתן לבדוק כרגע ({type(exc).__name__}).", "fix": None}]
            state = UNKNOWN
        out.append({"row": num, "key": key, "group": group, "label": label, "state": state, "reasons": reasons, "link": link})
    return out
