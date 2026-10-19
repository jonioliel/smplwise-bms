"""CR-ARX-WISKEY-SHARED-IDENTITY: one person in Arx and in WisKey (a LINK, never a merge) and time-bounded door grants for
external people (vendors, technicians), with a personal code delivered by WhatsApp.

Owner answers of 2026-10-17 (binding, numbered as the CR's section 11):
 1 a new separate link table (`access_person_links`), manual, no permission merge;
 2 approver = whoever holds `access.external.grant` on every station of the grant (system_admin by default; the owner hands it out);
 3 the code goes only by WhatsApp to the person's verified number, in a separate message without a link; nobody in Arx sees it;
 4 the code is sent the evening before arrival (at once when the arrival is near);
 5 on a permission change the approver is re-checked and the grant revoked only when the approver is no longer authorised;
 6 when the job is marked done the access ends at once;
 7 the vendor picks one of his technicians or adds one; a new technician is accepted by a manager and confirms his own number;
 8 a temporary grant lasts at most 14 days;
 9 a short privacy notice on the arrival page (+ one line in the code message); the acknowledgement is stored;
10 WisKey keeps a person until a manual delete - "delete now" per person, no automatic deletion;
11 the code message names the doors, the dates and the hours;
12 one live grant per person; a widening needs a new approval, a narrowing (or the same scope) merges at once.

Everything is OFF: the switch `access.external_grants` (default `off`) cannot be turned on in this build - the owner's separate
go-live permit is the code constant GO_LIVE_PERMITTED (False), checked by the settings route, by the live WisKey engine
(services/access_grant_engine.py) and by the live WhatsApp transport. Tests drive the whole flow with fakes only.

How it is built:
- Every state change of a grant is a database transition written in ONE transaction; nothing here talks to WisKey or WhatsApp
  while the write lock is held. The worker (`WORKER.run_once`) does the engine writes after commit: provisioning (door map,
  validity, timing, active - no PIN), the code at its due time (users/pin_generate + users/update with the PIN, then the message),
  revocation (PIN removed, doors cleared, inactive - R1: users/temporary_cancel alone would keep the credential), re-decision,
  the backstop reconciliation of every trigger, the end of the window and retention.
- The PIN exists only inside one `deliver_code` call: generated, written to WisKey with a revision check, handed to the transport
  and dropped. Never stored, logged, audited (value, hash or length), put in an exception or an HTTP answer. A process restart
  while a code is `queued` leaves it `not_delivered` (rotation is the only way on, CR 4.4).
- Revocation is at-least-once: a grant whose WisKey write may have happened (`pushed`) goes through `revoking` until WisKey
  confirms the strip (fresh read + CAS each try); a grant that never reached WisKey ends at once.
- Triggers (CR 3.6): R1 window end, R2 manual, R3 contact inactive / erased / number changed, R4 vendor inactive, R5 ticket
  done / closed / cancelled / returned / reassigned (in-transaction from the ticket code + the backstop), R6 RFQ cancelled / award
  no longer approved, R7 approver lost authority (re-decision on every permission revision bump, fail closed), R8 unlink / WisKey
  person missing, R9 a station left the approver's chain (narrowed; revoked when none is left), R10 "revoke all" with the switch.
  R11 emergency stays a reserved reason with no effect (emergency and WisKey door windows are OFF; nothing here opens a door).
"""
from __future__ import annotations

import json
import logging
import re
import secrets
import sqlite3
import threading
import uuid
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta, timezone
from typing import Any, Callable, Iterable

from ..db import Database, get_setting, now_iso, permission_revision
from ..errors import ApiError, forbidden
from ..rbac import INSTALLATION, LOCAL_ID_PREFIX, STATION, Principal, authorize, is_system_admin, permissions_anywhere
from . import intercom_authority as ia
from .access_grant_engine import KEEP, Engine, EngineError, EnginePerson

log = logging.getLogger("smplwise.access_grants")

# ---------------------------------------------------------------- constants and settings

# The owner's SEPARATE go-live permit, enforced in code (the capture-lease pattern): while False the switch cannot be turned on,
# the live WisKey engine refuses every call and the live WhatsApp transport sends nothing. Flipped only by the commit that carries
# the owner's written go-live permit - never by a setting, an environment variable or a version.
GO_LIVE_PERMITTED = False

PERMISSION = "access.external.grant"
FLAG_KEY = "access.external_grants"
MAX_DAYS_KEY = "access.external.max_days"
MAX_DOORS_KEY = "access.external.max_doors"
FRESH_KEY = "access.external.phone_fresh_days"
CODE_HOUR_KEY = "access.external.code_hour"
LOCAL_KEY = "access.external.local_approvers"
KEYS = (FLAG_KEY, MAX_DAYS_KEY, MAX_DOORS_KEY, FRESH_KEY, CODE_HOUR_KEY, LOCAL_KEY)
MAX_DAYS_CAP = 14  # owner answer 8: a constant; the setting may only lower it
MAX_DOORS_CAP = 8
DEFAULTS = {FLAG_KEY: "off", MAX_DAYS_KEY: "14", MAX_DOORS_KEY: "4", FRESH_KEY: "180", CODE_HOUR_KEY: "18", LOCAL_KEY: "off"}
REVOKE_ALL_WORD = "בטל הכל"
DELETE_WORD = "מחק"

LIVE = ("requested", "approved", "provisioning", "active", "revoking", "unknown")
DECIDED = ("approved", "provisioning", "active", "unknown")  # an approval stands behind it
FINAL = ("ended", "revoked", "refused", "failed")
CODE_CAP_GRANT = 3          # initial + 2 rotations
CODE_CAP_NUMBER_DAY = 3
CODE_CAP_INSTALLATION_DAY = 50
CODE_GAP_S = 60
PIN_ATTEMPTS = 3
PROVISION_RETRY_S = 300     # E1: at most every 5 minutes ...
PROVISION_ATTEMPTS = 12     # ... for one hour, then `failed`
REVOKE_ALERT_S = 120        # a revoke WisKey did not acknowledge alerts the managers after 2 minutes
RETENTION_DAYS = 365        # CR 2.6: grant rows (ids only) 12 months after their end
NOTICE_VERSION = "n2"
HOURS_CHOICES = ("07:00-12:00", "07:00-16:00", "08:00-17:00", "12:00-20:00", "07:00-20:00", "00:00-24:00")

# CR 2.6 / owner answer 9: the fixed notice shown on the arrival page (code-owned). n2: third person (read by the vendor), four languages;
# wording from the technician-privacy legal pack, adopted by the lead under the owner's delegation on 2026-10-18 (owner sign-off still required before go-live).
NOTICE_TEXT = {
    "he": "לצורך כניסת הטכנאי למבנה נשמרים שמו ומספר הטלפון שלו, ובכל כניסה גם השעה והדלת (ובמקומות שהדבר הופעל - גם תמונה ברגע הכניסה). "
          "המידע משמש לאבטחת המבנה ולניהול הכניסות לעבודה זו בלבד. מספר הטלפון משמש רק לאימות המספר ולמשלוח קוד הכניסה האישי בוואטסאפ. "
          "המידע נשמר עד שהארגון מוחק אותו, בהתאם למדיניות השמירה שלו. אין חובה חוקית למסור את הפרטים, אך בלעדיהם לא ניתן להנפיק קוד כניסה. "
          "לבקשת עיון, תיקון או מחיקה, או בכל שאלה, יש לפנות למנהל המבנה.",
    "en": "For the technician to enter the building, the technician's name and phone number are kept, and for each entry the time and the door "
          "(and, where this is enabled, a picture taken at the moment of entry). This information is used only for building security and for "
          "managing entries for this job. The phone number is used only to confirm the number and to send the personal entry code by WhatsApp. "
          "The information is kept until the organisation deletes it, in line with its retention policy. There is no legal obligation to provide "
          "these details, but without them no entry code can be issued. To ask to see, correct or delete the information, or with any question, "
          "contact the building manager.",
    "ar": "لغرض دخول الفني إلى المبنى، يُحفظ اسم الفني ورقم هاتفه، ويُسجَّل عند كل دخول وقتُه والبابُ الذي تمّ الدخول منه (وحيثما فُعِّلت هذه "
          "الخاصية، تُلتقط صورة لحظة الدخول أيضًا). تُستخدم هذه المعلومات لأغراض أمن المبنى وإدارة الدخول الخاص بهذا العمل فقط. يُستخدم رقم "
          "الهاتف فقط للتحقق منه ولإرسال رمز الدخول الشخصي عبر واتساب. تُحفظ المعلومات إلى أن تحذفها المؤسسة، وفقًا لسياسة الاحتفاظ بالبيانات "
          "المعتمدة لديها. تقديم هذه البيانات ليس واجبًا بموجب القانون، غير أنه لا يمكن إصدار رمز دخول بدونها. لطلب الاطلاع على المعلومات أو "
          "تصحيحها أو حذفها، أو لأي استفسار، يُرجى التواصل مع مدير المبنى.",
    "ru": "Для допуска техника в здание сохраняются его имя и номер телефона, а при каждом входе — время и дверь (а там, где эта функция включена, "
          "— также снимок в момент входа). Эти данные используются только для обеспечения безопасности здания и учёта входов в рамках данной "
          "работы. Номер телефона используется только для его подтверждения и отправки личного кода входа через WhatsApp. Данные хранятся до "
          "их удаления организацией в соответствии с её политикой хранения данных. Предоставление этих данных не является обязательным по "
          "закону, однако без них код входа не может быть выдан. Чтобы запросить ознакомление с данными, их исправление или удаление, а также "
          "по любым вопросам, обращайтесь к управляющему зданием.",
}
# The vendor's attestation next to the mandatory tick (notice, not consent: the optional consent clause is not included).
NOTICE_ATTEST = {
    "he": "הודעתי לטכנאי על האמור לעיל.",
    "en": "I have told the technician the above.",
    "ar": "أبلغتُ الفني بما ورد أعلاه.",
    "ru": "Подтверждаю: техник уведомлён мною об изложенном выше.",
}
TEMPLATES = {  # owner answers 3 / 9 / 11: fixed, code-owned, never editable, no link, no username, no ticket text
    "he": "SmplWise Arx: קוד הכניסה האישי שלך הוא {code}. דלתות: {doors}. בתוקף {dates}, {hours}. הקוד אישי - אל תעביר אותו לאיש. "
          "הכניסות נרשמות (שם, שעה ודלת) לצורכי אבטחה בלבד; לשאלות: מנהל המבנה. אסמכתא {ref}.",
    "en": "SmplWise Arx: your personal entry code is {code}. Doors: {doors}. Valid {dates}, {hours}. The code is personal - do not pass it on. "
          "Entries are recorded (name, time and door) for security only; questions: the building manager. Reference {ref}.",
    "ar": "رمز الدخول الشخصي الخاص بك من SmplWise Arx هو: {code}. الأبواب: {doors}. مدة الصلاحية: {dates}، {hours}. الرمز شخصي - يُرجى عدم "
          "مشاركته مع أي شخص. تُسجَّل عمليات الدخول (الاسم والوقت والباب) لأغراض أمنية فقط؛ للاستفسار: مدير المبنى. الرقم المرجعي: {ref}.",
    "ru": "SmplWise Arx: ваш личный код входа — {code}. Двери: {doors}. Действует: {dates}, {hours}. Код личный — никому его не передавайте. "
          "Входы регистрируются (имя, время и дверь) только в целях безопасности; по вопросам обращайтесь к управляющему зданием. "
          "Справочный номер: {ref}.",
}
HOURS_PHRASE = {"he": "משעה {start} עד {end}", "en": "{start}-{end}", "ar": "من {start} حتى {end}", "ru": "с {start} до {end}"}
END_REASONS = ("ended", "manual", "contact_inactive", "contact_erased", "contact_changed", "vendor_inactive", "ticket_ended", "ticket_reassigned",
               "rfq_ended", "approver_lost_authority", "unlinked", "wiskey_missing", "station_changed", "feature_off", "emergency", "person_deleted",
               "refused", "failed")
_HHMM = re.compile(r"^(?:[01][0-9]|2[0-3]):[0-5][0-9]$")
_ISO = "%Y-%m-%dT%H:%M:%SZ"

# ---------------------------------------------------------------- injectable seams (tests: fakes only)

ENGINE_FACTORY: Callable[[Any], Engine] | None = None  # tests install tests/fake_wiskey.FakeAccessEngine
TRANSPORT: Callable[["CodeMessage"], str] | None = None  # tests install a fake WhatsApp transport
_SETTINGS: Any = None


def _real_now() -> datetime:
    return datetime.now(timezone.utc)


_now_fn: Callable[[], datetime] = _real_now


def now() -> datetime:
    return _now_fn().astimezone(timezone.utc).replace(microsecond=0)


def set_clock(fn: Callable[[], datetime] | None) -> None:
    global _now_fn
    _now_fn = fn or _real_now


def iso(at: datetime) -> str:
    return at.astimezone(timezone.utc).strftime(_ISO)


def parse_iso(text: str | None) -> datetime | None:
    if not isinstance(text, str):
        return None
    try:
        return datetime.strptime(text, _ISO).replace(tzinfo=timezone.utc)
    except ValueError:
        return None


def go_live_permitted() -> bool:
    return GO_LIVE_PERMITTED is True


def engine_for(db: Any) -> Engine:
    if ENGINE_FACTORY is not None:
        return ENGINE_FACTORY(db)
    from .access_grant_engine import WiskeyServiceEngine

    return WiskeyServiceEngine(_SETTINGS)


# ---------------------------------------------------------------- settings readers (fail closed)

def _int_setting(conn: sqlite3.Connection, key: str, lo: int, hi: int) -> int:
    try:
        raw = get_setting(conn, key) or DEFAULTS[key]
        value = int(raw)
    except (ValueError, TypeError, sqlite3.Error):
        value = int(DEFAULTS[key])
    return max(lo, min(hi, value))


def enabled(conn: sqlite3.Connection) -> bool:
    """`on` only when the setting says exactly `on` AND the go-live permit is in the build."""
    try:
        return (get_setting(conn, FLAG_KEY) or "off") == "on" and go_live_permitted()
    except sqlite3.Error:
        return False


def max_days(conn: sqlite3.Connection) -> int:
    return _int_setting(conn, MAX_DAYS_KEY, 1, MAX_DAYS_CAP)


def max_doors(conn: sqlite3.Connection) -> int:
    return _int_setting(conn, MAX_DOORS_KEY, 1, MAX_DOORS_CAP)


def fresh_days(conn: sqlite3.Connection) -> int:
    return _int_setting(conn, FRESH_KEY, 30, 365)


def code_hour(conn: sqlite3.Connection) -> int:
    return _int_setting(conn, CODE_HOUR_KEY, 0, 23)


def local_approvers(conn: sqlite3.Connection) -> bool:
    try:
        return (get_setting(conn, LOCAL_KEY) or "off") == "on"
    except sqlite3.Error:
        return False


def zone_of(conn: sqlite3.Connection):
    from ..routers.settings import read_settings
    from .timeutil import zone

    try:
        return zone(read_settings(conn)["time.zone"])
    except Exception:  # noqa: BLE001 - a broken zone setting falls back to the product's default zone
        return zone("Asia/Jerusalem")


def settings_view(conn: sqlite3.Connection) -> dict[str, Any]:
    return {"external_grants": "on" if enabled(conn) else "off", "go_live_permitted": go_live_permitted(), "max_days": max_days(conn),
            "max_days_cap": MAX_DAYS_CAP, "max_doors": max_doors(conn), "phone_fresh_days": fresh_days(conn), "code_hour": code_hour(conn),
            "local_approvers": "on" if local_approvers(conn) else "off"}


# ---------------------------------------------------------------- errors

def _invalid(field_name: str, code: str, text: str = "הבקשה אינה תקינה.") -> ApiError:
    return ApiError(422, "access_grant_invalid", text, details={"field": field_name, "code": code})


def _conflict(code: str, text: str, **details: Any) -> ApiError:
    return ApiError(409, code, text, details=details)


def _off() -> ApiError:
    return ApiError(409, "access_grants_off", "גישה זמנית לאנשים חיצוניים כבויה במערכת זו.")


def _not_found() -> ApiError:
    return ApiError(404, "access_grant_not_found", "הגישה לא נמצאה.")


# ---------------------------------------------------------------- validation

def parse_doors(value: Any, limit: int, *, allow_empty: bool = False) -> dict[str, list[int]]:
    """{station_id: [relay, ...]}: explicit stations and relays 1..8 - never "all", never a group; at most `limit` doors (relays) in
    total. An empty map only where `allow_empty` (a vendor-page request without a suggestion)."""
    if not isinstance(value, dict):
        raise _invalid("doors", "type")
    out: dict[str, list[int]] = {}
    for sid, relays in value.items():
        if not ia.valid_id(sid) or sid in ("*", "all") or not isinstance(relays, list) or not relays:
            raise _invalid("doors", "station")
        clean = sorted({r for r in relays if type(r) is int and 1 <= r <= 8})
        if len(clean) != len(relays):
            raise _invalid("doors", "relay")
        out[sid] = clean
    if not out and not allow_empty:
        raise _invalid("doors", "required", "יש לבחור לפחות דלת אחת.")
    if sum(len(v) for v in out.values()) > limit:
        raise _invalid("doors", "too_many", f"אפשר לאשר עד {limit} דלתות.")
    return dict(sorted(out.items()))


def parse_window(valid_from: Any, valid_until: Any, days: int, at: datetime) -> tuple[str, str]:
    """UTC instants `...Z`; the end after the start, the end in the future, the length at most `days` (owner answer 8)."""
    vf, vu = parse_iso(valid_from), parse_iso(valid_until)
    if vf is None or vu is None:
        raise _invalid("valid_from" if vf is None else "valid_until", "format")
    if vu <= vf:
        raise _invalid("valid_until", "before_start", "סוף החלון חייב להיות אחרי תחילתו.")
    if vu <= at:
        raise _invalid("valid_until", "past", "החלון כבר הסתיים.")
    if vu - vf > timedelta(days=days):
        raise _invalid("valid_until", "too_long", f"גישה זמנית אפשרית לכל היותר ל-{days} ימים.")
    return iso(vf), iso(vu)


def parse_timing(value: Any) -> dict[str, Any] | None:
    from .intercom_writes import timing_draft

    try:
        return timing_draft(value)
    except ValueError as exc:
        raise _invalid("timing", str(exc)) from None


def _minutes(text: str) -> int:
    return 1440 if text == "24:00" else int(text[:2]) * 60 + int(text[3:])


def _timing_covers(old: dict[str, Any] | None, new: dict[str, Any] | None) -> bool:
    """Does the old daily-hours schedule allow everything the new one does (None = no restriction)?"""
    if old is None:
        return True
    if new is None:
        return False
    if old.get("timezone") != new.get("timezone"):
        return False

    def windows(t: dict[str, Any]) -> list[tuple[int, int]]:
        return [(_minutes(p["start"]), _minutes(p["end"])) for p in t.get("periods") or []]

    if not all(any(os <= ns and ne <= oe for os, oe in windows(old)) for ns, ne in windows(new)):
        return False
    if old.get("mode") == "weekly" and new.get("mode") == "weekly":
        return set(new.get("days") or []) <= set(old.get("days") or [])
    if old.get("mode") == "dates" and new.get("mode") == "dates":
        return set(new.get("dates") or []) <= set(old.get("dates") or [])
    if old.get("mode") == "weekly" and new.get("mode") == "dates":
        names = ("Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday")
        return all(names[date.fromisoformat(d).weekday()] in (old.get("days") or []) for d in new.get("dates") or [])
    return False


@dataclass(frozen=True)
class Scope:
    doors: dict[str, list[int]]
    valid_from: str
    valid_until: str
    timing: dict[str, Any] | None
    credential: str

    def as_json(self) -> str:
        return json.dumps({"doors": self.doors, "valid_from": self.valid_from, "valid_until": self.valid_until, "timing": self.timing,
                           "credential": self.credential}, sort_keys=True, ensure_ascii=False)

    @staticmethod
    def of_row(g: dict[str, Any]) -> "Scope":
        return Scope(json.loads(g["doors_json"] or "{}"), g["valid_from"], g["valid_until"], json.loads(g["timing_json"]) if g["timing_json"] else None,
                     g["credential"])

    @staticmethod
    def of_json(text: str) -> "Scope":
        d = json.loads(text)
        return Scope(d["doors"], d["valid_from"], d["valid_until"], d.get("timing"), d["credential"])


def covers(old: Scope, new: Scope) -> bool:
    """`new` is the same as or narrower than `old` in every dimension (owner answer 12: such a change merges at once)."""
    for sid, relays in new.doors.items():
        if not set(relays) <= set(old.doors.get(sid, [])):
            return False
    if new.valid_from < old.valid_from or new.valid_until > old.valid_until:
        return False
    if old.credential == "none" and new.credential == "pin":
        return False
    return _timing_covers(old.timing, new.timing)


def stations_of(doors: dict[str, list[int]]) -> list[str]:
    return sorted(doors)


# ---------------------------------------------------------------- authority

def approve_permissions(credential: str) -> tuple[str, ...]:
    perms = (PERMISSION, ia.PEOPLE_MANAGE, ia.PEOPLE_SENSITIVE)
    return perms + ((ia.PIN_GENERATE,) if credential == "pin" else ())


def missing_on(conn: sqlite3.Connection, principal: Principal, perms: Iterable[str], stations: Iterable[str]) -> list[tuple[str, str]]:
    """[(permission, station)] the principal does NOT hold (rbac.authorize: deny-overrides over the station chain)."""
    out = []
    for sid in stations:
        for perm in perms:
            if not authorize(conn, principal, perm, (STATION, sid)).allowed:
                out.append((perm, sid))
    return out


def holds_somewhere(conn: sqlite3.Connection, principal: Principal, perm: str, stations: Iterable[str]) -> bool:
    ids = list(stations)
    if not ids:
        return authorize(conn, principal, perm, INSTALLATION).allowed
    return any(authorize(conn, principal, perm, (STATION, s)).allowed for s in ids)


def principal_of(user_id: str) -> Principal:
    """The approver as a principal for the re-decision (no session: `internal`; a USR2 local id keeps its source)."""
    return Principal(user_id=user_id, username="", display_name="", source="local" if str(user_id).startswith(LOCAL_ID_PREFIX) else "internal")


def _interactive(principal: Principal) -> bool:
    from .intercom_writes import interactive

    return interactive(principal)


# ---------------------------------------------------------------- audit (ids only - never a code, a phone, a message, a name)

def _audit(conn: sqlite3.Connection, actor: Any, action: str, resource_id: str, *, decision: str = "allowed", reason: str | None = None,
           request_id: str | None = None, resource_type: str = "access_grant", **details: Any) -> None:
    from ..audit import audit

    audit(conn, actor=actor, action=action, decision=decision, resource_type=resource_type, resource_id=resource_id, reason=reason, request_id=request_id,
          details={k: v for k, v in details.items() if v is not None})


@dataclass(frozen=True)
class ContactActor:
    """The audit actor of a vendor-page request (the tickets LinkActor shape: `contact:<id>`, holds no permission)."""
    user_id: str
    username: str = ""
    display_name: str = ""
    source: str = "ticket_link"


# ---------------------------------------------------------------- rows

def grant_row(conn: sqlite3.Connection, grant_id: str) -> dict[str, Any] | None:
    r = conn.execute("SELECT * FROM access_grants WHERE id = ?", (grant_id,)).fetchone()
    return dict(r) if r else None


def live_grant_of(conn: sqlite3.Connection, subject_kind: str, subject_id: str) -> dict[str, Any] | None:
    marks = ",".join("?" * len(LIVE))
    r = conn.execute(f"SELECT * FROM access_grants WHERE subject_kind = ? AND subject_id = ? AND state IN ({marks})", (subject_kind, subject_id, *LIVE)).fetchone()
    return dict(r) if r else None


def link_row(conn: sqlite3.Connection, link_id: str | None) -> dict[str, Any] | None:
    if not link_id:
        return None
    r = conn.execute("SELECT * FROM access_person_links WHERE id = ?", (link_id,)).fetchone()
    return dict(r) if r else None


def link_of_subject(conn: sqlite3.Connection, kind: str, sid: str) -> dict[str, Any] | None:
    r = conn.execute("SELECT * FROM access_person_links WHERE subject_kind = ? AND subject_id = ?", (kind, sid)).fetchone()
    return dict(r) if r else None


def contact_row(conn: sqlite3.Connection, contact_id: str | None) -> dict[str, Any] | None:
    if not contact_id:
        return None
    try:
        r = conn.execute("SELECT * FROM ticket_contacts WHERE id = ?", (contact_id,)).fetchone()
    except sqlite3.OperationalError:
        return None
    return dict(r) if r else None


def pending_contact(conn: sqlite3.Connection, contact_id: str) -> bool:
    r = conn.execute("SELECT 1 FROM access_pending_contacts WHERE contact_id = ? AND accepted_at IS NULL", (contact_id,)).fetchone()
    return r is not None


def subject_problem(conn: sqlite3.Connection, contact: dict[str, Any] | None) -> str | None:
    """Why a contact cannot hold an external grant (None = it can). A company row never holds a credential; the directory row
    of an internal user is linked on its user, not here (CR 2.1)."""
    if contact is None or contact.get("erased_at"):
        return "contact_erased"
    if contact.get("kind") != "person":
        return "contact_is_company"
    if contact.get("user_id"):
        return "contact_is_user"
    if pending_contact(conn, contact["id"]):
        return "contact_pending"
    if not contact.get("active"):
        return "contact_inactive"
    return None


def number_problem(conn: sqlite3.Connection, contact: dict[str, Any], at: datetime) -> str | None:
    """Owner answer 3 / CR 4.2: a code goes only to a number the person confirmed (`user` or `code`, never a manager's mark),
    confirmed within access.external.phone_fresh_days, and allowed by the tickets number-verification rule."""
    if not contact.get("phone_e164") or not contact.get("phone_confirmed_at"):
        return "phone_not_verified"
    if contact.get("phone_confirmed_via") not in ("user", "code"):
        return "phone_not_verified"
    confirmed = _parse_any(contact.get("phone_confirmed_at"))
    if confirmed is None or at - confirmed > timedelta(days=fresh_days(conn)):
        return "phone_not_fresh"
    try:
        from .tickets import phone_verify

        if not phone_verify.confirmed(conn, contact):
            return "phone_not_verified"
    except Exception:  # noqa: BLE001 - fail closed
        return "phone_not_verified"
    return None


def _parse_any(text: Any) -> datetime | None:
    if not isinstance(text, str):
        return None
    try:
        v = datetime.fromisoformat(text.replace("Z", "+00:00"))
    except ValueError:
        return None
    return v if v.tzinfo else v.replace(tzinfo=timezone.utc)


def mask_number(contact: dict[str, Any] | None) -> str | None:
    digits = (contact or {}).get("phone_e164") or ""
    return f"····{digits[-2:]}" if len(digits) >= 2 else None


def code_due(conn: sqlite3.Connection, valid_from: str, at: datetime) -> str:
    """Owner answer 4: at code_hour (default 18:00) local time on the evening before the first day; at once when that has passed."""
    tz = zone_of(conn)
    start_local = parse_iso(valid_from).astimezone(tz)
    eve = datetime.combine(start_local.date() - timedelta(days=1), datetime.min.time(), tzinfo=tz).replace(hour=code_hour(conn))
    due = eve.astimezone(timezone.utc)
    return iso(max(due, at))


# ---------------------------------------------------------------- the grant transitions (inside the caller's transaction)

def _touch(conn: sqlite3.Connection, grant_id: str, fields: dict[str, Any], *, expect_revision: int | None = None) -> bool:
    fields = {**fields, "updated_at": iso(now())}
    sets = ", ".join(f"{k} = ?" for k in fields)
    sql = f"UPDATE access_grants SET {sets}, revision = revision + 1 WHERE id = ?"
    args: list[Any] = [*fields.values(), grant_id]
    if expect_revision is not None:
        sql += " AND revision = ?"
        args.append(expect_revision)
    return conn.execute(sql, args).rowcount == 1


def final_state_for(reason: str) -> str:
    return "ended" if reason == "ended" else "failed" if reason == "failed" else "revoked"


def mark_revoking(conn: sqlite3.Connection, g: dict[str, Any], reason: str, *, actor: Any = None, request_id: str | None = None) -> str:
    """Withdraw a grant's authority NOW in Arx: a grant whose WisKey write may have happened goes to `revoking` (the worker strips
    the person, at least once); one that never reached WisKey ends at once. A pending or queued code is never sent afterwards (the
    worker sends only for `active`). Returns the new state."""
    if g["state"] not in LIVE or g["state"] == "revoking":
        return g["state"]
    reason = reason if reason in END_REASONS else "manual"
    at = iso(now())
    code = "not_delivered" if g.get("code_state") in ("pending", "queued") else g.get("code_state")
    if g["pushed"]:
        _touch(conn, g["id"], {"state": "revoking", "end_reason": reason, "revoking_since": at, "code_state": code, "pending_json": None})
        state = "revoking"
    else:
        state = final_state_for(reason)
        _touch(conn, g["id"], {"state": state, "end_reason": reason, "ended_at": at, "code_state": code, "pending_json": None})
    _audit(conn, actor, "access.grant.revoke", g["id"], reason=reason, request_id=request_id, state=state, link_id=g.get("link_id"),
           stations=stations_of(json.loads(g["doors_json"] or "{}")))
    WORKER.wake()
    return state


def on_ticket_ended(conn: sqlite3.Connection, ticket_id: str, reason: str) -> int:
    """R5 (owner answer 6: done ends the access at once), called inside the ticket's own transaction: every live grant of the
    ticket withdraws its authority in the same commit. Never raises (a ticket change never fails because of a grant)."""
    try:
        marks = ",".join("?" * len(LIVE))
        rows = conn.execute(f"SELECT * FROM access_grants WHERE source_ref = ? AND state IN ({marks})", (ticket_id, *LIVE)).fetchall()
        for r in rows:
            mark_revoking(conn, dict(r), reason if reason in ("ticket_ended", "ticket_reassigned", "rfq_ended") else "ticket_ended")
        return len(rows)
    except sqlite3.Error:
        log.warning("access grants: the ticket hook failed (the backstop reconciliation will catch it)")
        return 0


_REDECIDE = threading.Event()


def on_permission_change() -> None:
    """Called from db.bump_permission_revision (CR 3.5, owner answer 5): the worker re-decides every decided grant against its
    approver's CURRENT permissions. Never touches the database and never raises."""
    _REDECIDE.set()
    WORKER.wake()


# ---------------------------------------------------------------- request / amend (owner answer 12)

def request_grant(conn: sqlite3.Connection, *, actor: Any, requested_by: str, contact_id: str, source_kind: str, source_ref: str | None,
                  assignment_id: str | None, scope: Scope, outside_window: bool = False, request_id: str | None = None) -> tuple[dict[str, Any], str]:
    """Create a `requested` grant, or change the person's live one. Returns (grant, outcome): `created`; `replaced` (still
    requested); `merged` (a narrowing or the same scope of a decided grant: applied at once, pushed to WisKey by the worker when
    active); `widening` (held in `pending_json` for a new approval; the approved scope keeps working meanwhile)."""
    if not enabled(conn):
        raise _off()
    if not scope.doors:
        # HARDEN271 K1: an empty door map (a vendor-page arrival on a ticket with no station placement and no "entrance for external
        # people" station) could never be approved - the approver may only narrow. Refused here, so nothing unapprovable is stored.
        raise _conflict("no_doors_suggested", "לא ניתן להציע דלתות לכתובת הזו. בקשו ממנהל הקריאה לבקש את הגישה.")
    contact = contact_row(conn, contact_id)
    problem = subject_problem(conn, contact)
    if problem and not (problem == "contact_pending" and str(requested_by).startswith("contact:")):
        raise _conflict("access_grant_subject", "אי אפשר לבקש גישה עבור איש הקשר הזה.", reason=problem)
    at = iso(now())
    live = live_grant_of(conn, "contact", contact_id)
    if live is None:
        gid = uuid.uuid4().hex
        conn.execute(
            """INSERT INTO access_grants(id, subject_kind, subject_id, link_id, source_kind, source_ref, assignment_id, outside_window, doors_json,
               valid_from, valid_until, timing_json, credential, state, requested_by, code_state, created_at, updated_at)
               VALUES (?, 'contact', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'requested', ?, ?, ?, ?)""",
            (gid, contact_id, (link_of_subject(conn, "contact", contact_id) or {}).get("id"), source_kind, source_ref, assignment_id, 1 if outside_window else 0,
             json.dumps(scope.doors, sort_keys=True), scope.valid_from, scope.valid_until, json.dumps(scope.timing, sort_keys=True) if scope.timing else None,
             scope.credential, requested_by, "not_needed" if scope.credential == "none" else "pending", at, at))
        _audit(conn, actor, "access.grant.request", gid, request_id=request_id, source=source_kind, source_ref=source_ref, window=[scope.valid_from, scope.valid_until],
               stations=stations_of(scope.doors), outside_window=bool(outside_window))
        return grant_row(conn, gid), "created"
    if live["state"] == "revoking":
        raise _conflict("access_grant_revoking", "הגישה הקודמת עדיין מבוטלת. נסו שוב בעוד רגע.")
    if live["state"] == "requested":
        _touch(conn, live["id"], {"doors_json": json.dumps(scope.doors, sort_keys=True), "valid_from": scope.valid_from, "valid_until": scope.valid_until,
                                  "timing_json": json.dumps(scope.timing, sort_keys=True) if scope.timing else None, "credential": scope.credential,
                                  "outside_window": 1 if outside_window else 0, "code_state": "not_needed" if scope.credential == "none" else "pending"})
        _audit(conn, actor, "access.grant.amend", live["id"], request_id=request_id, kind="replaced", window=[scope.valid_from, scope.valid_until],
               stations=stations_of(scope.doors))
        return grant_row(conn, live["id"]), "replaced"
    current = Scope.of_row(live)
    if covers(current, scope):
        fields: dict[str, Any] = {"doors_json": json.dumps(scope.doors, sort_keys=True), "valid_from": scope.valid_from, "valid_until": scope.valid_until,
                                  "timing_json": json.dumps(scope.timing, sort_keys=True) if scope.timing else None, "credential": scope.credential,
                                  "pending_json": None}
        if live["state"] == "active" and scope != current:
            fields["needs_push"] = 1
        if live.get("code_state") in ("pending",) and live["state"] in DECIDED:
            fields["code_due_at"] = code_due(conn, scope.valid_from, now())
        _touch(conn, live["id"], fields)
        _audit(conn, actor, "access.grant.amend", live["id"], request_id=request_id, kind="narrowed", window=[scope.valid_from, scope.valid_until],
               stations=stations_of(scope.doors))
        WORKER.wake()
        return grant_row(conn, live["id"]), "merged"
    _touch(conn, live["id"], {"pending_json": scope.as_json(), "outside_window": 1 if outside_window else live["outside_window"]})
    _audit(conn, actor, "access.grant.amend", live["id"], request_id=request_id, kind="widening_requested", window=[scope.valid_from, scope.valid_until],
           stations=stations_of(scope.doors))
    return grant_row(conn, live["id"]), "widening"


# ---------------------------------------------------------------- approve / refuse / revoke / rotate (own transactions)

def _visible_or_404(conn: sqlite3.Connection, principal: Principal, grant_id: str, *, also: str | None = None) -> dict[str, Any]:
    """HARDEN271 K2 (HA_IDENTITY_RBAC_HE.md section 15): the mutating routes answer the same 404 for an unknown id and for a grant the
    caller cannot see, before any authority, state or revision answer - an id never discloses existence to a non-holder. `also`: a
    permission that makes the grant visible to this route too (revoke: people.manage on one of its stations, R2)."""
    g = grant_row(conn, grant_id)
    if g is None:
        raise _not_found()
    if visible(conn, principal, g):
        return g
    if also and holds_somewhere(conn, principal, also, stations_of(json.loads(g["doors_json"] or "{}"))):
        return g
    raise _not_found()


def _person_stations(db: Any, g: dict[str, Any]) -> list[str]:
    """The stations of the linked WisKey person besides the grant's own (CR 3.2: the approver needs people.manage + sensitive on
    every station of the person). No link yet: none. WisKey unreachable: the approval is refused (fail closed)."""
    with db.connection(mode="read", label="access_grants.person_stations") as conn:
        link = link_row(conn, g.get("link_id")) or link_of_subject(conn, g["subject_kind"], g["subject_id"])
    if link is None:
        return []
    try:
        person = engine_for(db).get_person(link["wiskey_person_id"])
    except EngineError as exc:
        if exc.kind == "not_found":
            return []
        raise ApiError(503, "access_grant_engine_unavailable", "לא ניתן לקרוא כעת את רשומת האדם במערכת הכניסה, ולכן האישור לא נשמר.",
                       details={"outcome": "not_sent"}) from None
    return list(person.stations)


def approve(db: Database, principal: Principal, grant_id: str, revision: int, *, doors: Any = None, valid_from: Any = None, valid_until: Any = None,
            told: bool = False, request_id: str | None = None) -> dict[str, Any]:
    """CR 3.2: an interactive human holding `access.external.grant` + people.manage + people.sensitive (+ pin.generate for a PIN)
    on EVERY station of the grant and of the linked person. The approver may only narrow what was requested. Sends nothing: the
    worker provisions the door map and validity; the code leaves at its due time (owner answer 4)."""
    def caller_checks(conn: sqlite3.Connection) -> dict[str, Any]:
        """The checks that need no WisKey read: the switch, the session kind, the local-approver rule (none of them discloses the
        id), then the uniform 404 for a grant the caller cannot see (HARDEN271 K2)."""
        def deny(reason: str, exc: ApiError) -> ApiError:
            _audit(conn, principal, "access.grant.approve", grant_id, decision="denied", reason=reason, request_id=request_id)
            return exc

        if not enabled(conn):
            raise deny("feature_off", _off())
        if not _interactive(principal):
            raise deny("not_interactive", ApiError(403, "access_grant_interactive_only", "אישור גישה אפשרי רק ממסך מחובר של אדם, לא מאפליקציה או סקריפט."))
        if str(principal.user_id).startswith(LOCAL_ID_PREFIX) and not local_approvers(conn):
            raise deny("local_not_allowed", ApiError(403, "access_grant_local_not_allowed", "משתמש Arx מקומי אינו יכול לאשר גישת דלתות."))
        return _visible_or_404(conn, principal, grant_id)

    with db.connection(label="access_grants.approve.check") as conn:
        g = caller_checks(conn)
        # HARDEN271 K3: the caller's authority on the grant's own stations is decided BEFORE WisKey is read - an unauthorised caller
        # can neither make Arx issue a WisKey read nor tell "engine unreachable" (503) from "reachable" (403)
        pre = Scope.of_json(g["pending_json"]) if g.get("pending_json") else Scope.of_row(g)
        try:
            pre_doors = parse_doors(doors, max_doors(conn)) if doors is not None else pre.doors
        except ApiError:
            pre_doors = pre.doors  # the write transaction answers the validation error
        missing = missing_on(conn, principal, approve_permissions(pre.credential), stations_of(pre_doors))
        if missing:
            perm, sid = missing[0]
            _audit(conn, principal, "access.grant.approve", grant_id, decision="denied", reason="no_binding", request_id=request_id, permission=perm, station=sid)
    if missing:
        raise forbidden(permission=perm, target_type=STATION, target_id=sid, reason="no_binding")
    person_stations = _person_stations(db, g)
    with db.connection(label="access_grants.approve") as conn:
        g = caller_checks(conn)

        def deny(reason: str, exc: ApiError) -> ApiError:
            _audit(conn, principal, "access.grant.approve", grant_id, decision="denied", reason=reason, request_id=request_id)
            return exc

        amendment = g["state"] in DECIDED and g.get("pending_json")
        if g["state"] != "requested" and not amendment:
            raise deny("state", _conflict("access_grant_state", "הגישה אינה ממתינה לאישור.", state=g["state"]))
        if g["revision"] != revision:
            raise deny("stale", _conflict("stale_revision", "הגישה השתנתה מאז שנטענה. טענו מחדש."))
        requested = Scope.of_json(g["pending_json"]) if amendment else Scope.of_row(g)
        at = now()
        chosen_doors = parse_doors(doors, max_doors(conn)) if doors is not None else parse_doors(requested.doors, max_doors(conn))
        vf, vu = parse_window(valid_from or requested.valid_from, valid_until or requested.valid_until, max_days(conn), at)
        chosen = Scope(chosen_doors, vf, vu, requested.timing, requested.credential)
        if not covers(requested, chosen):
            raise deny("widened", _invalid("doors", "wider_than_requested", "המאשר יכול רק לצמצם את מה שהתבקש."))
        if requested.credential == "card":
            raise deny("card", _conflict("access_grant_card_not_built", "גישה בכרטיס לאדם חיצוני עדיין אינה זמינה (שלב מאוחר יותר)."))
        stations = stations_of(chosen.doors)
        missing = missing_on(conn, principal, (PERMISSION,), stations) + missing_on(
            conn, principal, approve_permissions(chosen.credential)[1:], sorted(set(stations) | set(person_stations)))
        if missing:
            perm, sid = missing[0]
            _audit(conn, principal, "access.grant.approve", grant_id, decision="denied", reason="no_binding", request_id=request_id, permission=perm, station=sid)
            raise forbidden(permission=perm, target_type=STATION, target_id=sid, reason="no_binding")
        contact = contact_row(conn, g["subject_id"])
        problem = subject_problem(conn, contact)
        if problem:
            raise deny(problem, _conflict("access_grant_subject", "אי אפשר לאשר גישה לאיש קשר זה כעת.", reason=problem))
        if chosen.credential == "pin":
            nproblem = number_problem(conn, contact, at)
            if nproblem:
                raise deny(nproblem, _conflict("access_grant_phone", "לקוד גישה דרוש מספר וואטסאפ שהאדם אישר בעצמו (בקוד) לאחרונה.", reason=nproblem))
        noticed = conn.execute("SELECT 1 FROM access_grant_notices WHERE grant_id = ?", (grant_id,)).fetchone() is not None
        if not noticed and not told:
            raise deny("notice", _conflict("access_grant_notice", "יש לאשר שהאדם קיבל את הודעת הפרטיות לפני מתן הגישה."))
        if not noticed and told:
            conn.execute("INSERT OR IGNORE INTO access_grant_notices(grant_id, version, via, by_ref, at) VALUES (?, ?, 'approver', ?, ?)",
                         (grant_id, NOTICE_VERSION, principal.user_id, iso(at)))
            _audit(conn, principal, "access.grant.notice_ack", grant_id, request_id=request_id, via="approver", version=NOTICE_VERSION, acknowledged_for=g["subject_id"])
        fields: dict[str, Any] = {"doors_json": json.dumps(chosen.doors, sort_keys=True), "valid_from": vf, "valid_until": vu, "pending_json": None,
                                  "approved_by": principal.user_id, "approved_at": iso(at), "approval_revision": permission_revision(conn),
                                  "phone_confirmed_at": (contact or {}).get("phone_confirmed_at")}
        if amendment:
            if g["state"] in ("active", "provisioning"):  # HARDEN271 K4: a write in flight carries the old map - push the new one after it
                fields["needs_push"] = 1
            action = "access.grant.amend"
        else:
            fields.update({"state": "approved", "provision_after": None, "provision_attempts": 0,
                           "code_state": "pending" if chosen.credential == "pin" else "not_needed",
                           "code_due_at": code_due(conn, vf, at) if chosen.credential == "pin" else None})
            action = "access.grant.approve"
        if not _touch(conn, grant_id, fields, expect_revision=revision):
            raise deny("stale", _conflict("stale_revision", "הגישה השתנתה מאז שנטענה. טענו מחדש."))
        _audit(conn, principal, action, grant_id, request_id=request_id, stations=stations, window=[vf, vu], credential=chosen.credential,
               approval_revision=fields["approval_revision"], kind="widening_approved" if amendment else None)
        out = grant_row(conn, grant_id)
    WORKER.wake()
    return out


def refuse(db: Database, principal: Principal, grant_id: str, revision: int, request_id: str | None = None) -> dict[str, Any]:
    with db.connection(label="access_grants.refuse") as conn:
        g = _visible_or_404(conn, principal, grant_id)
        stations = stations_of(Scope.of_json(g["pending_json"]).doors if g.get("pending_json") else json.loads(g["doors_json"] or "{}"))
        if not holds_somewhere(conn, principal, PERMISSION, stations):
            _audit(conn, principal, "access.grant.refuse", grant_id, decision="denied", reason="no_binding", request_id=request_id)
            raise forbidden(permission=PERMISSION, target_type=STATION, target_id=(stations or ["*"])[0], reason="no_binding")
        if g["revision"] != revision:
            raise _conflict("stale_revision", "הגישה השתנתה מאז שנטענה. טענו מחדש.")
        if g["state"] == "requested":
            _touch(conn, grant_id, {"state": "refused", "end_reason": "refused", "ended_at": iso(now())})
        elif g["state"] in DECIDED and g.get("pending_json"):
            _touch(conn, grant_id, {"pending_json": None})  # the widening is refused; the approved scope stays
        else:
            raise _conflict("access_grant_state", "אין מה לדחות בגישה זו.", state=g["state"])
        _audit(conn, principal, "access.grant.refuse", grant_id, request_id=request_id)
        return grant_row(conn, grant_id)


def revoke(db: Database, principal: Principal, grant_id: str, request_id: str | None = None) -> dict[str, Any]:
    """R2: revoking must be easy - `access.external.grant` OR `access.people.manage` on ONE station of the grant suffices."""
    with db.connection(label="access_grants.revoke") as conn:
        g = _visible_or_404(conn, principal, grant_id, also=ia.PEOPLE_MANAGE)
        stations = stations_of(json.loads(g["doors_json"] or "{}"))
        if not (holds_somewhere(conn, principal, PERMISSION, stations) or holds_somewhere(conn, principal, ia.PEOPLE_MANAGE, stations)):
            _audit(conn, principal, "access.grant.revoke", grant_id, decision="denied", reason="no_binding", request_id=request_id)
            raise forbidden(permission=PERMISSION, target_type=STATION, target_id=(stations or ["*"])[0], reason="no_binding")
        if g["state"] not in LIVE:
            raise _conflict("access_grant_state", "הגישה כבר הסתיימה.", state=g["state"])
        mark_revoking(conn, g, "manual", actor=principal, request_id=request_id)
        out = grant_row(conn, grant_id)
    WORKER.run_grant(db, grant_id)
    with db.connection(mode="read", label="access_grants.revoke.read") as conn:
        return grant_row(conn, grant_id) or out


def rotate(db: Database, principal: Principal, grant_id: str, revision: int, request_id: str | None = None) -> dict[str, Any]:
    """CR 4.1.4: Arx cannot resend a code it does not have - a "resend" is a rotation (a new PIN replaces the old one in the same
    write), by an approver-level principal, within the per-grant cap (3 sends in total)."""
    with db.connection(label="access_grants.rotate") as conn:
        g = _visible_or_404(conn, principal, grant_id)
        if not _interactive(principal):
            raise ApiError(403, "access_grant_interactive_only", "החלפת קוד אפשרית רק ממסך מחובר של אדם.")
        stations = stations_of(json.loads(g["doors_json"] or "{}"))
        missing = missing_on(conn, principal, approve_permissions("pin"), stations)
        if missing:
            perm, sid = missing[0]
            _audit(conn, principal, "access.grant.code_rotated", grant_id, decision="denied", reason="no_binding", request_id=request_id, permission=perm)
            raise forbidden(permission=perm, target_type=STATION, target_id=sid, reason="no_binding")
        if g["revision"] != revision:
            raise _conflict("stale_revision", "הגישה השתנתה מאז שנטענה. טענו מחדש.")
        if g["state"] != "active" or g["credential"] != "pin" or g.get("code_state") not in ("sent", "not_delivered", "unknown"):
            raise _conflict("access_grant_state", "אי אפשר להחליף קוד במצב הנוכחי.", state=g["state"], code_state=g.get("code_state"))
        if int(g["code_sends"]) >= CODE_CAP_GRANT:
            raise _conflict("access_grant_code_cap", "הגעתם למספר הקודים המרבי לגישה זו. בטלו ואשרו גישה חדשה.")
        _touch(conn, grant_id, {"code_state": "pending", "code_due_at": iso(now())})
        _audit(conn, principal, "access.grant.code_rotated", grant_id, request_id=request_id, sends=int(g["code_sends"]))
        out = grant_row(conn, grant_id)
    WORKER.wake()
    return out


def revoke_all(db: Database, principal: Principal, confirm: str, request_id: str | None = None) -> int:
    """R10: "revoke all external access" - a system administrator, with the typed confirmation word."""
    with db.connection(label="access_grants.revoke_all") as conn:
        if not is_system_admin(conn, principal.user_id):
            _audit(conn, principal, "access.grant.revoke_all", "*", decision="denied", reason="not_system_admin", request_id=request_id, resource_type="installation")
            raise ApiError(403, "not_system_admin", "רק מנהל מערכת יכול לבטל את כל הגישות.")
        if (confirm or "").strip() != REVOKE_ALL_WORD:
            raise ApiError(422, "confirm_required", f"כדי לבטל את כל הגישות יש להקליד \"{REVOKE_ALL_WORD}\".", details={"field": "confirm"})
        marks = ",".join("?" * len(LIVE))
        rows = [dict(r) for r in conn.execute(f"SELECT * FROM access_grants WHERE state IN ({marks})", LIVE).fetchall()]
        for g in rows:
            mark_revoking(conn, g, "feature_off", actor=principal, request_id=request_id)
        _audit(conn, principal, "access.grant.revoke_all", "*", request_id=request_id, resource_type="installation", count=len(rows))
    WORKER.run_once(db)
    return len(rows)


def provision_now(db: Database, principal: Principal, grant_id: str, request_id: str | None = None) -> dict[str, Any]:
    """E1: "provision now" for an approved grant (a configuration write with a revision check - never a physical command)."""
    with db.connection(label="access_grants.provision_now") as conn:
        g = _visible_or_404(conn, principal, grant_id)
        stations = stations_of(json.loads(g["doors_json"] or "{}"))
        if not holds_somewhere(conn, principal, PERMISSION, stations):
            raise forbidden(permission=PERMISSION, target_type=STATION, target_id=(stations or ["*"])[0], reason="no_binding")
        if g["state"] != "approved":
            raise _conflict("access_grant_state", "הגישה אינה ממתינה להפעלה.", state=g["state"])
        _touch(conn, grant_id, {"provision_after": None})
        _audit(conn, principal, "access.grant.provision_now", grant_id, request_id=request_id)
    WORKER.run_grant(db, grant_id)
    with db.connection(mode="read", label="access_grants.provision_now.read") as conn:
        return grant_row(conn, grant_id)


# ---------------------------------------------------------------- links (owner answer 1: manual, no authority union)

def match_link(db: Database, principal: Principal, contact_id: str, wiskey_person_id: str, request_id: str | None = None) -> dict[str, Any]:
    """Link an existing WisKey person to a contact (manual only, never by name or phone): `access.people.manage` on every station
    of that person AND the right to edit the contact (`tickets.configure`)."""
    if not ia.valid_id(wiskey_person_id):
        raise _invalid("wiskey_person_id", "format")
    try:
        person = engine_for(db).get_person(wiskey_person_id)
    except EngineError as exc:
        if exc.kind == "not_found":
            raise ApiError(404, "access_person_not_found", "האדם לא נמצא במערכת הכניסה.") from None
        raise ApiError(503, "access_grant_engine_unavailable", "מערכת הכניסה אינה זמינה כעת.", details={"outcome": "not_sent"}) from None
    with db.connection(label="access_grants.match") as conn:
        if not authorize(conn, principal, "tickets.configure", INSTALLATION).allowed:
            _audit(conn, principal, "access.person_link.match", contact_id, decision="denied", reason="no_binding", resource_type="contact", request_id=request_id)
            raise forbidden(permission="tickets.configure", target_type="installation", target_id="*", reason="no_binding")
        stations = list(person.stations)
        lacks = missing_on(conn, principal, (ia.PEOPLE_MANAGE,), stations) if stations else (
            [] if authorize(conn, principal, ia.PEOPLE_MANAGE, INSTALLATION).allowed else [(ia.PEOPLE_MANAGE, "*")])
        if lacks:
            _audit(conn, principal, "access.person_link.match", contact_id, decision="denied", reason="no_binding", resource_type="contact", request_id=request_id)
            raise forbidden(permission=lacks[0][0], target_type=STATION, target_id=lacks[0][1], reason="no_binding")
        contact = contact_row(conn, contact_id)
        problem = subject_problem(conn, contact)
        if problem in ("contact_erased", "contact_is_company", "contact_is_user"):
            raise _conflict("access_grant_subject", "אי אפשר לקשר את איש הקשר הזה.", reason=problem)
        if link_of_subject(conn, "contact", contact_id) is not None:
            raise _conflict("access_link_exists", "איש הקשר כבר מקושר לאדם במערכת הכניסה.")
        if conn.execute("SELECT 1 FROM access_person_links WHERE wiskey_person_id = ?", (wiskey_person_id,)).fetchone():
            raise _conflict("access_link_exists", "האדם במערכת הכניסה כבר מקושר לאיש קשר אחר.")
        lid = uuid.uuid4().hex
        conn.execute("""INSERT INTO access_person_links(id, subject_kind, subject_id, wiskey_person_id, origin, employee_no, linked_by, linked_at, last_pushed_rev)
                        VALUES (?, 'contact', ?, ?, 'matched', NULL, ?, ?, ?)""", (lid, contact_id, wiskey_person_id, principal.user_id, iso(now()), person.revision))
        conn.execute("UPDATE access_grants SET link_id = ? WHERE subject_kind = 'contact' AND subject_id = ? AND link_id IS NULL", (lid, contact_id))
        _audit(conn, principal, "access.person_link.match", lid, resource_type="access_person_link", request_id=request_id, wiskey_person_id=wiskey_person_id,
               contact_id=contact_id)
        return link_row(conn, lid)


def unlink(db: Database, principal: Principal, link_id: str, request_id: str | None = None) -> dict[str, Any]:
    """Unlink: every live grant of the link is revoked FIRST (R8 `unlinked`); the WisKey person stays and loses nothing else."""
    with db.connection(label="access_grants.unlink") as conn:
        link = link_row(conn, link_id)
        if link is None:
            raise ApiError(404, "access_link_not_found", "הקישור לא נמצא.")
        if not authorize(conn, principal, "tickets.configure", INSTALLATION).allowed:
            raise forbidden(permission="tickets.configure", target_type="installation", target_id="*", reason="no_binding")
        marks = ",".join("?" * len(LIVE))
        for r in conn.execute(f"SELECT * FROM access_grants WHERE link_id = ? AND state IN ({marks})", (link_id, *LIVE)).fetchall():
            mark_revoking(conn, dict(r), "unlinked", actor=principal, request_id=request_id)
        conn.execute("UPDATE access_person_links SET state = 'unlinking', revision = revision + 1 WHERE id = ?", (link_id,))
        _audit(conn, principal, "access.person_link.unlink", link_id, resource_type="access_person_link", request_id=request_id)
    WORKER.run_once(db)
    with db.connection(mode="read", label="access_grants.unlink.read") as conn:
        left = link_row(conn, link_id)
    return {"link_id": link_id, "state": "unlinked" if left is None else left["state"]}


def delete_person_now(db: Database, principal: Principal, link_id: str, confirm: str, request_id: str | None = None) -> dict[str, Any]:
    """Owner answer 10: WisKey keeps a person until a manual delete; this is that delete, per person - only a person Arx created
    (`created_from_arx`). Every live grant is revoked first; then `users/delete` (its effect is WisKey's job: unknown until read)."""
    with db.connection(label="access_grants.delete_person") as conn:
        link = link_row(conn, link_id)
        if link is None:
            raise ApiError(404, "access_link_not_found", "הקישור לא נמצא.")
        # a person Arx created has no station once its grants are revoked: deleting it needs the grant permission somewhere AND
        # people.manage unrestricted (the S11 rule for a person with no station)
        if not (PERMISSION in permissions_anywhere(conn, principal) and authorize(conn, principal, ia.PEOPLE_MANAGE, INSTALLATION).allowed):
            _audit(conn, principal, "access.person_link.delete", link_id, decision="denied", reason="no_binding", resource_type="access_person_link", request_id=request_id)
            raise forbidden(permission=PERMISSION, target_type="installation", target_id="*", reason="no_binding")
        if link["origin"] != "created_from_arx":
            raise _conflict("access_person_not_ours", "האדם נוצר במערכת הכניסה ולא על ידי Arx; מחיקה רק ממסך האנשים.")
        if (confirm or "").strip() != DELETE_WORD:
            raise ApiError(422, "confirm_required", f"כדי למחוק יש להקליד \"{DELETE_WORD}\".", details={"field": "confirm"})
        marks = ",".join("?" * len(LIVE))
        for r in conn.execute(f"SELECT * FROM access_grants WHERE link_id = ? AND state IN ({marks})", (link_id, *LIVE)).fetchall():
            mark_revoking(conn, dict(r), "person_deleted", actor=principal, request_id=request_id)
    WORKER.run_once(db)
    with db.connection(mode="read", label="access_grants.delete_person.check") as conn:
        marks = ",".join("?" * len(LIVE))
        still = conn.execute(f"SELECT COUNT(*) FROM access_grants WHERE link_id = ? AND state IN ({marks})", (link_id, *LIVE)).fetchone()[0]
    if still:
        raise _conflict("access_grant_revoking", "ביטול הגישה עדיין ממתין לאישור מערכת הכניסה; המחיקה תתאפשר אחריו.")
    engine = engine_for(db)
    try:
        person = engine.get_person(link["wiskey_person_id"])
        engine.delete(person.id, person.revision)
        outcome = "accepted"
    except EngineError as exc:
        if exc.kind != "not_found":
            raise ApiError(503 if exc.kind in ("not_sent", "not_permitted") else 504, "access_person_delete_failed",
                           "המחיקה לא אושרה על ידי מערכת הכניסה. בדקו שוב בעוד רגע.", details={"outcome": exc.kind}) from None
        outcome = "already_missing"
    with db.connection(label="access_grants.delete_person.done") as conn:
        conn.execute("DELETE FROM access_person_links WHERE id = ?", (link_id,))
        _audit(conn, principal, "access.person_link.delete", link_id, resource_type="access_person_link", request_id=request_id,
               wiskey_person_id=link["wiskey_person_id"], outcome=outcome)
    return {"link_id": link_id, "outcome": outcome, "pending": outcome == "accepted"}


def accept_pending_contact(db: Database, principal: Principal, contact_id: str, request_id: str | None = None) -> dict[str, Any]:
    """Owner answer 7: a manager accepts a technician the vendor added (the contact becomes active); the technician still confirms
    his own number by code before any access code can go to it."""
    with db.connection(label="access_grants.accept_contact") as conn:
        if PERMISSION not in permissions_anywhere(conn, principal) and not authorize(conn, principal, "tickets.configure", INSTALLATION).allowed:
            _audit(conn, principal, "access.pending_contact.accept", contact_id, decision="denied", reason="no_binding", resource_type="contact", request_id=request_id)
            raise forbidden(permission=PERMISSION, target_type="installation", target_id="*", reason="no_binding")
        row = conn.execute("SELECT * FROM access_pending_contacts WHERE contact_id = ?", (contact_id,)).fetchone()
        if row is None or row["accepted_at"] or row["rejected_at"]:
            raise ApiError(404, "access_pending_not_found", "אין טכנאי ממתין לאישור.")
        at = iso(now())
        conn.execute("UPDATE access_pending_contacts SET accepted_by = ?, accepted_at = ? WHERE contact_id = ?", (principal.user_id, at, contact_id))
        conn.execute("UPDATE ticket_contacts SET active = 1, updated_at = ?, revision = revision + 1 WHERE id = ?", (at, contact_id))
        _audit(conn, principal, "access.pending_contact.accept", contact_id, resource_type="contact", request_id=request_id)
        return {"contact_id": contact_id, "accepted": True}


def reject_pending_contact(db: Database, principal: Principal, contact_id: str, request_id: str | None = None) -> dict[str, Any]:
    """Lead decision 6 ("reject and delete", 2026-10-18): a manager rejects a technician the vendor added and never accepted. Same
    authority as accepting. The vendor-typed data (name, phone) is erased with the directory's own erase (the row stays as a
    tombstone because the vendor's request references it); the open request for him ends at once (nothing was sent to WisKey for a
    pending person); `rejected_at` is written. A technician with a link to a WisKey person or any decided grant is refused (409)."""
    from .tickets import contacts as tcontacts
    from .tickets.access import Viewer

    with db.connection(label="access_grants.reject_contact") as conn:
        if PERMISSION not in permissions_anywhere(conn, principal) and not authorize(conn, principal, "tickets.configure", INSTALLATION).allowed:
            _audit(conn, principal, "access.pending_contact.reject", contact_id, decision="denied", reason="no_binding", resource_type="contact", request_id=request_id)
            raise forbidden(permission=PERMISSION, target_type="installation", target_id="*", reason="no_binding")
        row = conn.execute("SELECT * FROM access_pending_contacts WHERE contact_id = ?", (contact_id,)).fetchone()
        if row is None or row["accepted_at"] or row["rejected_at"]:
            raise ApiError(404, "access_pending_not_found", "אין טכנאי ממתין לאישור.")
        contact = contact_row(conn, contact_id)
        if contact is None or contact.get("erased_at"):
            raise ApiError(404, "access_pending_not_found", "אין טכנאי ממתין לאישור.")
        if conn.execute("SELECT 1 FROM access_person_links WHERE subject_kind = 'contact' AND subject_id = ?", (contact_id,)).fetchone() is not None:
            raise _conflict("access_pending_has_link", "לטכנאי יש קישור לאדם במערכת הכניסה, ולכן אי אפשר למחוק אותו כאן.")
        if conn.execute("SELECT 1 FROM access_grants WHERE subject_kind = 'contact' AND subject_id = ? AND state NOT IN ('requested', 'revoked', 'failed')",
                        (contact_id,)).fetchone() is not None:
            raise _conflict("access_pending_has_grant", "לטכנאי יש גישה שהוחלטה, ולכן אי אפשר למחוק אותו כאן.")
        ended = 0
        for g in conn.execute("SELECT * FROM access_grants WHERE subject_kind = 'contact' AND subject_id = ? AND state = 'requested'", (contact_id,)).fetchall():
            mark_revoking(conn, dict(g), "refused", actor=principal, request_id=request_id)
            ended += 1
        at = iso(now())
        conn.execute("UPDATE access_pending_contacts SET rejected_at = ? WHERE contact_id = ?", (at, contact_id))
        tcontacts.erase_checked(conn, Viewer(conn, principal), contact, history=True, rid=request_id)
        _audit(conn, principal, "access.pending_contact.reject", contact_id, resource_type="contact", request_id=request_id, requests_ended=ended)
        return {"contact_id": contact_id, "rejected": True, "deleted": True, "requests_ended": ended}


def set_entrance(db: Database, principal: Principal, station_id: str, entrance: bool, request_id: str | None = None) -> dict[str, Any]:
    if not ia.valid_id(station_id):
        raise _invalid("station_id", "format")
    with db.connection(label="access_grants.entrance") as conn:
        if not authorize(conn, principal, ia.STATIONS_MANAGE, (STATION, station_id)).allowed:
            raise forbidden(permission=ia.STATIONS_MANAGE, target_type=STATION, target_id=station_id, reason="no_binding")
        if entrance:
            conn.execute("INSERT OR IGNORE INTO access_station_entrance(station_id, set_by, set_at) VALUES (?, ?, ?)", (station_id, principal.user_id, iso(now())))
        else:
            conn.execute("DELETE FROM access_station_entrance WHERE station_id = ?", (station_id,))
        _audit(conn, principal, "access.station.entrance", station_id, resource_type=STATION, request_id=request_id, entrance=entrance)
        return {"station_id": station_id, "entrance": entrance}


# ---------------------------------------------------------------- views (names level; the delivery state at the sensitive level)

def visible(conn: sqlite3.Connection, principal: Principal, g: dict[str, Any]) -> bool:
    stations = stations_of(json.loads(g["doors_json"] or "{}"))
    if g.get("pending_json"):
        stations = sorted(set(stations) | set(stations_of(Scope.of_json(g["pending_json"]).doors)))
    if not stations:
        return authorize(conn, principal, PERMISSION, INSTALLATION).allowed or PERMISSION in permissions_anywhere(conn, principal)
    return any(authorize(conn, principal, p, (STATION, s)).allowed for s in stations for p in (ia.PEOPLE_READ, PERMISSION))


def present(conn: sqlite3.Connection, principal: Principal, g: dict[str, Any]) -> dict[str, Any]:
    doors = json.loads(g["doors_json"] or "{}")
    stations = stations_of(doors)
    sensitive = bool(stations) and all(authorize(conn, principal, ia.PEOPLE_SENSITIVE, (STATION, s)).allowed for s in stations)
    contact = contact_row(conn, g["subject_id"]) if g["subject_kind"] == "contact" else None
    noticed = conn.execute("SELECT via, version, at FROM access_grant_notices WHERE grant_id = ?", (g["id"],)).fetchall()
    attention = None
    if g["state"] == "revoking":
        attention = "revoke_pending"
    elif g.get("code_state") in ("not_delivered", "unknown"):
        attention = "code_" + g["code_state"]
    elif g["state"] in ("failed", "unknown"):
        attention = g["state"]
    return {
        "id": g["id"], "revision": g["revision"], "state": g["state"], "end_reason": g["end_reason"], "source": g["source_kind"], "source_ref": g["source_ref"],
        "person": {"contact_id": g["subject_id"], "name": (contact or {}).get("display_name"), "pending": bool(contact and pending_contact(conn, contact["id"])),
                   "number": mask_number(contact) if sensitive else None},
        "doors": [{"station_id": s, "name": _station_name(s), "relays": doors[s]} for s in stations],
        "valid_from": g["valid_from"], "valid_until": g["valid_until"], "timing": json.loads(g["timing_json"]) if g["timing_json"] else None,
        "credential": g["credential"], "outside_window": bool(g["outside_window"]),
        "pending_amendment": json.loads(g["pending_json"]) if g.get("pending_json") else None,
        "approved_by": g["approved_by"], "approved_at": g["approved_at"],
        "code_state": g["code_state"] if sensitive else None, "code_due_at": g["code_due_at"] if sensitive else None,
        "code_sends": g["code_sends"] if sensitive else None,
        "notice": [{"via": r["via"], "version": r["version"], "at": r["at"]} for r in noticed], "attention": attention,
        "linked": bool(g.get("link_id")),
    }


def _station_name(station_id: str) -> str:
    try:
        from .intercom_sync import SYNC

        s = SYNC.station(station_id)
        if s and s.get("name"):
            return str(s["name"])[:64]
    except Exception:  # noqa: BLE001
        pass
    return "עמדה"


def list_for(conn: sqlite3.Connection, principal: Principal, *, live_only: bool = True, limit: int = 200) -> list[dict[str, Any]]:
    if live_only:
        marks = ",".join("?" * len(LIVE))
        rows = conn.execute(f"SELECT * FROM access_grants WHERE state IN ({marks}) ORDER BY created_at DESC LIMIT ?", (*LIVE, limit)).fetchall()
    else:
        rows = conn.execute("SELECT * FROM access_grants ORDER BY created_at DESC LIMIT ?", (limit,)).fetchall()
    return [present(conn, principal, dict(r)) for r in rows if visible(conn, principal, dict(r))]


# ---------------------------------------------------------------- the code message (in memory only)

@dataclass
class CodeMessage:
    """One code message. `digits` and `text` never reach a log, an audit row, the database or an exception (repr hides them)."""
    grant_id: str
    lang: str
    digits: str = field(repr=False)
    text: str = field(repr=False)


def _door_names(doors: dict[str, list[int]]) -> str:
    names = [_station_name(s) for s in stations_of(doors)]
    return ", ".join(dict.fromkeys(names)) or "-"


def render_code_message(conn: sqlite3.Connection, g: dict[str, Any], contact: dict[str, Any], pin: str) -> CodeMessage:
    lang = contact.get("lang") if contact.get("lang") in TEMPLATES else "he"
    tz = zone_of(conn)
    vf, vu = parse_iso(g["valid_from"]).astimezone(tz), parse_iso(g["valid_until"]).astimezone(tz)
    last = vu - timedelta(seconds=1)
    dates = vf.strftime("%d.%m") if vf.date() == last.date() else f"{vf.strftime('%d.%m')}-{last.strftime('%d.%m')}"
    timing = json.loads(g["timing_json"]) if g["timing_json"] else None
    if timing and timing.get("periods"):
        hours = ", ".join(f"{p['start']}-{p['end']}" for p in timing["periods"])
    else:
        hours = HOURS_PHRASE[lang].format(start=vf.strftime("%H:%M"), end=vu.strftime("%H:%M"))
    text = TEMPLATES[lang].format(code=pin, doors=_door_names(json.loads(g["doors_json"])), dates=dates, hours=hours, ref=g["id"][:8])
    from .tickets.channel import phone_digits

    return CodeMessage(grant_id=g["id"], lang=lang, digits=phone_digits(contact.get("phone_e164") or "") or "", text=text)


USE_KEY = "access.codes"


def _register_use() -> None:
    try:
        from . import messaging_accounts as ma
        from . import messaging_runtime as mr

        def uses(conn: Any) -> tuple[Any, ...]:
            return (ma.UseSpec(USE_KEY, "access", "קודי כניסה לאנשים חיצוניים", inherits="tickets.codes", active=lambda: enabled(conn)),)

        mr.register_uses(uses)
        mr.register_label_renderer("access", lambda conn, text: text, lambda conn: "גישה זמנית")
    except Exception:  # noqa: BLE001 - an installation without the messaging runtime: no code channel (fail closed at send time)
        log.warning("access grants: the messaging use could not be registered")


_register_use()


def send_code(db: Any, msg: CodeMessage) -> str:
    """The transport: a fake in tests; the live WhatsApp account of the `access.codes` use otherwise - refused (`not_sent`) while
    the go-live permit is not in the build. Returns `sent` | `not_sent` | `unknown`."""
    if TRANSPORT is not None:
        return TRANSPORT(msg)
    if not go_live_permitted() or not msg.digits:
        return "not_sent"
    try:  # NOT_RUN: the live path (the local_reset sender pattern), never exercised against a real WhatsApp account
        from . import messaging_runtime as mr
        from . import notify_whatsapp as nwa
        from .tickets.channel import SENT, OutboundMessage, Recipient
        from .tickets.channel_whatsapp import WhatsAppChannel

        svc = mr.accounts_service(db)
        account = svc.resolve(USE_KEY)
        if account is None or not account.value or not svc.status(account.key).sendable:
            return "not_sent"
        out = OutboundMessage(outbox_id=f"acc-{msg.grant_id[:12]}", channel="whatsapp", purpose="access_code", recipient=Recipient(None, phone=msg.digits),
                              text=msg.text, account=account)
        result = WhatsAppChannel(nwa.transport(), svc).send(out)
        svc.note_result(account.key, result)
        if result.outcome == SENT:
            return "sent"
        return "unknown" if result.may_have_left else "not_sent"
    except Exception:  # noqa: BLE001 - nothing about the message is logged
        log.warning("access code delivery failed")
        return "unknown"


# ---------------------------------------------------------------- the worker

class Worker:
    """Runs the engine side of every grant transition: re-decision, reconciliation, window end, provisioning, unknown outcomes,
    revocation, code delivery, link clean-up, retention. `run_once` is deterministic (tests call it); the background thread calls
    it on every wake and at least every TICK_S."""

    TICK_S = 15.0

    def __init__(self) -> None:
        self._wake = threading.Event()
        self._stop = threading.Event()
        self._thread: threading.Thread | None = None
        self._db: Database | None = None
        self._lock = threading.Lock()

    def wake(self) -> None:
        self._wake.set()

    def start(self, db: Database, settings: Any) -> None:
        global _SETTINGS
        _SETTINGS = settings
        self._db = db
        self.on_startup(db)
        if self._thread is None or not self._thread.is_alive():
            self._stop.clear()
            self._thread = threading.Thread(target=self._loop, name="arx-access-grants", daemon=True)
            self._thread.start()

    def stop(self) -> None:
        self._stop.set()
        self._wake.set()

    def _loop(self) -> None:
        while not self._stop.is_set():
            self._wake.wait(self.TICK_S)
            self._wake.clear()
            if self._stop.is_set() or self._db is None:
                return
            try:
                self.run_once(self._db)
            except Exception:  # noqa: BLE001 - one bad pass never stops the worker
                log.exception("access grants worker pass failed")

    # ---- start-up (E8 / CR 4.4)

    def on_startup(self, db: Database) -> int:
        """A code `queued` before a restart is lost by design (Arx no longer has it): `not_delivered`. The janitor resumes ends and
        revokes on the next pass."""
        try:
            with db.connection(label="access_grants.startup") as conn:
                n = conn.execute("UPDATE access_grants SET code_state = 'not_delivered', updated_at = ? WHERE code_state = 'queued'", (iso(now()),)).rowcount
                if n:
                    _audit(conn, None, "access.grant.code_not_delivered", "*", reason="restart", resource_type="installation", count=n)
                # a provisioning write cut by the restart: its outcome is unknown - the next pass reads WisKey and decides (E2)
                m = conn.execute("UPDATE access_grants SET state = 'unknown', updated_at = ? WHERE state = 'provisioning'", (iso(now()),)).rowcount
                if m:
                    _audit(conn, None, "access.grant.unknown", "*", reason="restart", resource_type="installation", count=m)
                return n + m
        except sqlite3.Error:
            return 0

    # ---- one pass

    def run_once(self, db: Database, at: datetime | None = None) -> dict[str, int]:
        with self._lock:
            summary = {"redecided": 0, "reconciled": 0, "ended": 0, "provisioned": 0, "revoked": 0, "codes": 0}
            if _REDECIDE.is_set():
                _REDECIDE.clear()
                summary["redecided"] = self.redecide(db)
            summary["reconciled"] = self.reconcile(db)
            summary["ended"] = self.end_due(db)
            with db.connection(mode="read", label="access_grants.worker.scan") as conn:
                ids = [r[0] for r in conn.execute(
                    "SELECT id FROM access_grants WHERE state IN ('approved', 'unknown', 'revoking') OR (state = 'active' AND (needs_push = 1 OR code_state = 'pending')) "
                    "ORDER BY updated_at").fetchall()]
            for gid in ids:
                kind = self._process(db, gid)
                if kind:
                    summary[kind] = summary.get(kind, 0) + 1
            self.finish_unlinks(db)
            self.alert_and_prune(db)
            return summary

    def run_grant(self, db: Database, grant_id: str) -> None:
        with self._lock:
            self._process(db, grant_id)
            self.finish_unlinks(db)

    def _process(self, db: Database, grant_id: str) -> str | None:
        with db.connection(mode="read", label="access_grants.worker.read") as conn:
            g = grant_row(conn, grant_id)
            feature = enabled(conn)
        if g is None:
            return None
        try:
            if g["state"] == "revoking":
                return "revoked" if self.strip(db, g) else None
            if g["state"] == "unknown":
                return self.resolve_unknown(db, g)
            if g["state"] == "approved":
                if not feature:  # R10: no new provisioning while the switch is off; the approval waits
                    return None
                return "provisioned" if self.provision(db, g) else None
            if g["state"] == "active" and g["needs_push"]:
                self.push_narrowing(db, g)
                return None
            if g["state"] == "active" and g["code_state"] == "pending" and feature:
                due = parse_iso(g["code_due_at"])
                if due is not None and due <= now():
                    return "codes" if self.deliver_code(db, g) else None
        except Exception:  # noqa: BLE001 - fail closed per grant; never the PIN in a log
            log.warning("access grants: processing %s failed (%s)", grant_id[:8], "error")
        return None

    # ---- re-decision (CR 3.5, owner answer 5; fail closed)

    def redecide(self, db: Database) -> int:
        n = 0
        with db.connection(label="access_grants.redecide") as conn:
            marks = ",".join("?" * len(DECIDED))
            rows = [dict(r) for r in conn.execute(f"SELECT * FROM access_grants WHERE state IN ({marks})", DECIDED).fetchall()]
            rev = permission_revision(conn)
            for g in rows:
                n += 1
                try:
                    self._redecide_one(conn, g, rev)
                except Exception:  # noqa: BLE001 - an error while re-deciding is a revoke
                    mark_revoking(conn, g, "approver_lost_authority")
        return n

    def _redecide_one(self, conn: sqlite3.Connection, g: dict[str, Any], rev: int) -> None:
        approver = g.get("approved_by")
        user = conn.execute("SELECT active, deleted_at FROM users WHERE id = ?", (approver,)).fetchone() if approver else None
        if user is None or not user["active"] or (user["deleted_at"] if "deleted_at" in user.keys() else None):
            mark_revoking(conn, g, "approver_lost_authority")
            return
        if str(approver).startswith(LOCAL_ID_PREFIX) and not local_approvers(conn):
            mark_revoking(conn, g, "approver_lost_authority")
            return
        p = principal_of(approver)
        doors = json.loads(g["doors_json"] or "{}")
        perms = approve_permissions(g["credential"])
        kept = {s: r for s, r in doors.items() if not missing_on(conn, p, perms, [s])}
        if not kept:
            mark_revoking(conn, g, "approver_lost_authority")
            return
        if kept != doors:  # R9 within the re-decision: narrowed to the stations the approver still holds
            _touch(conn, g["id"], {"doors_json": json.dumps(kept, sort_keys=True), "needs_push": 1 if g["state"] == "active" else g["needs_push"],
                                   "approval_revision": rev})
            _audit(conn, None, "access.grant.amend", g["id"], reason="station_changed", kind="narrowed", stations=stations_of(kept))
            return
        _touch(conn, g["id"], {"approval_revision": rev})

    # ---- the backstop reconciliation of R3-R6, R8 and the approver's active flag

    def reconcile(self, db: Database) -> int:
        n = 0
        with db.connection(label="access_grants.reconcile") as conn:
            marks = ",".join("?" * len(LIVE))
            rows = [dict(r) for r in conn.execute(f"SELECT * FROM access_grants WHERE state IN ({marks}) AND state != 'revoking'", LIVE).fetchall()]
            for g in rows:
                reason = self._trigger(conn, g)
                if reason:
                    mark_revoking(conn, g, reason)
                    n += 1
        return n

    def _trigger(self, conn: sqlite3.Connection, g: dict[str, Any]) -> str | None:
        contact = contact_row(conn, g["subject_id"])
        if contact is None or contact.get("erased_at"):
            return "contact_erased"
        if not contact.get("active") and not pending_contact(conn, contact["id"]):
            return "contact_inactive"
        if g["state"] in DECIDED and g["credential"] == "pin" and (contact.get("phone_confirmed_at") or None) != (g.get("phone_confirmed_at") or None):
            return "contact_changed"
        if contact.get("vendor_id"):
            vendor = contact_row(conn, contact["vendor_id"])
            if vendor is None or vendor.get("erased_at") or not vendor.get("active"):
                return "vendor_inactive"
        if g.get("source_ref"):
            t = conn.execute("SELECT status FROM tickets WHERE id = ?", (g["source_ref"],)).fetchone()
            if t is None or t["status"] in ("done", "closed", "cancelled"):
                return "ticket_ended"
            if t["status"] == "returned":
                return "ticket_reassigned"
        if g.get("assignment_id"):
            a = conn.execute("SELECT ended_at FROM ticket_assignments WHERE id = ?", (g["assignment_id"],)).fetchone()
            if a is None or a["ended_at"]:
                return "ticket_reassigned"
        if g["source_kind"] == "rfq_order" and g.get("assignment_id") and self._rfq_ended(conn, g["assignment_id"]):
            return "rfq_ended"
        link = link_row(conn, g.get("link_id"))
        if link is not None and link["state"] == "wiskey_missing":
            return "wiskey_missing"
        if g["state"] in DECIDED and g.get("approved_by"):
            u = conn.execute("SELECT active FROM users WHERE id = ?", (g["approved_by"],)).fetchone()
            if u is None or not u["active"]:
                return "approver_lost_authority"
        return None

    @staticmethod
    def _rfq_ended(conn: sqlite3.Connection, assignment_id: str) -> bool:
        try:
            q = conn.execute("SELECT id, rfq_vendor_id FROM ticket_quotes WHERE assignment_id = ?", (assignment_id,)).fetchone()
            if q is None:
                return False
            aw = conn.execute("SELECT state, rfq_id FROM ticket_rfq_awards WHERE quote_id = ? ORDER BY rowid DESC LIMIT 1", (q["id"],)).fetchone()
            if aw is None:
                return False
            if aw["state"] != "approved":
                return True
            rfq = conn.execute("SELECT state FROM ticket_rfqs WHERE id = ?", (aw["rfq_id"],)).fetchone()
            return rfq is not None and rfq["state"] == "cancelled"
        except sqlite3.Error:
            return False

    def end_due(self, db: Database) -> int:
        """R1: the window ended - also in Arx (WisKey's validity is the backstop): the PIN is removed, the doors cleared."""
        n = 0
        with db.connection(label="access_grants.end_due") as conn:
            marks = ",".join("?" * len(LIVE))
            rows = [dict(r) for r in conn.execute(f"SELECT * FROM access_grants WHERE state IN ({marks}) AND state != 'revoking' AND valid_until <= ?",
                                                  (*LIVE, iso(now()))).fetchall()]
            for g in rows:
                mark_revoking(conn, g, "ended")
                n += 1
        return n

    # ---- provisioning (no PIN: the code is generated at its due time)

    def _ensure_link(self, db: Database, engine: Engine, g: dict[str, Any]) -> dict[str, Any]:
        with db.connection(mode="read", label="access_grants.link.read") as conn:
            link = link_row(conn, g.get("link_id")) or link_of_subject(conn, g["subject_kind"], g["subject_id"])
            contact = contact_row(conn, g["subject_id"])
            approver = conn.execute("SELECT display_name FROM users WHERE id = ?", (g.get("approved_by"),)).fetchone()
        if link is None:
            employee_no = "x" + secrets.token_hex(6)
            category = "contractor" if (contact or {}).get("vendor_id") else "visitor"
            ref = f"{g['source_kind']}:{(g.get('source_ref') or g['id'])[:12]}"
            person = engine.create_person(display_name=((contact or {}).get("display_name") or "אורח")[:32], employee_no=employee_no, category=category,
                                          responsible_person=((approver["display_name"] if approver else "") or "Arx")[:64],
                                          access_purpose=f"Arx external access {ref}")
            with db.connection(label="access_grants.link.create") as conn:
                lid = uuid.uuid4().hex
                conn.execute("""INSERT INTO access_person_links(id, subject_kind, subject_id, wiskey_person_id, origin, employee_no, linked_by, linked_at, last_pushed_rev)
                                VALUES (?, ?, ?, ?, 'created_from_arx', ?, ?, ?, ?)""",
                             (lid, g["subject_kind"], g["subject_id"], person.id, employee_no, g.get("approved_by") or "system", iso(now()), person.revision))
                _audit(conn, None, "access.person_link.create", lid, resource_type="access_person_link", wiskey_person_id=person.id, grant_id=g["id"])
                link = link_row(conn, lid)
        if g.get("link_id") != link["id"]:
            with db.connection(label="access_grants.link.attach") as conn:
                conn.execute("UPDATE access_grants SET link_id = ? WHERE id = ?", (link["id"], g["id"]))
        return link

    def provision(self, db: Database, g: dict[str, Any]) -> bool:
        if g.get("provision_after") and parse_iso(g["provision_after"]) and parse_iso(g["provision_after"]) > now():
            return False
        with db.connection(label="access_grants.provision.begin") as conn:
            if not _touch(conn, g["id"], {"state": "provisioning", "pushed": 1}, expect_revision=g["revision"]):
                return False
            _audit(conn, None, "access.grant.provision", g["id"], attempt=int(g["provision_attempts"]) + 1)
        engine = engine_for(db)
        scope = Scope.of_row(g)
        try:
            link = self._ensure_link(db, engine, g)
            person = engine.get_person(link["wiskey_person_id"])
            try:
                person = engine.apply(person.id, person.revision, doors=scope.doors, valid_from=scope.valid_from, valid_until=scope.valid_until,
                                      timing=scope.timing, active=True, pin=None)
            except EngineError as exc:
                if exc.kind != "revision_conflict":
                    raise
                person = engine.get_person(link["wiskey_person_id"])  # E3: re-read, apply once more
                person = engine.apply(person.id, person.revision, doors=scope.doors, valid_from=scope.valid_from, valid_until=scope.valid_until,
                                      timing=scope.timing, active=True, pin=None)
        except EngineError as exc:
            return self._provision_failed(db, g, exc)
        except Exception:  # noqa: BLE001 - anything else after the write may have left: an unknown outcome (E2), never a blind retry
            return self._provision_failed(db, g, EngineError("unknown", "error"))
        with db.connection(label="access_grants.provision.done") as conn:
            conn.execute("UPDATE access_person_links SET last_pushed_rev = ? WHERE wiskey_person_id = ?", (person.revision, person.id))
            cur = grant_row(conn, g["id"])
            if cur is None or cur["state"] != "provisioning":
                # a trigger fired while the write was out (the grant is `revoking` now): never re-activate - the revoke path strips it
                if cur is not None:
                    _touch(conn, g["id"], {"wiskey_revision": person.revision})
                return False
            # HARDEN271 K4: an amendment approved (or merged) while this write was out changed the row - WisKey holds the snapshot
            # applied above, so the row's own scope is pushed next (push_narrowing pushes whatever the row holds)
            moved = Scope.of_row(cur) != scope
            _touch(conn, g["id"], {"state": "active", "wiskey_revision": person.revision, "provision_after": None,
                                   "needs_push": 1 if moved else cur["needs_push"]})
            _audit(conn, None, "access.grant.activate", g["id"], wiskey_person_id=person.id, stations=stations_of(scope.doors))
        return True

    def _provision_failed(self, db: Database, g: dict[str, Any], exc: EngineError) -> bool:
        with db.connection(label="access_grants.provision.failed") as conn:
            current = grant_row(conn, g["id"]) or g
            if current["state"] != "provisioning":
                return False
            attempts = int(current["provision_attempts"]) + 1
            if exc.kind == "unknown":
                _touch(conn, g["id"], {"state": "unknown", "provision_attempts": attempts})
                _audit(conn, None, "access.grant.unknown", g["id"], code=exc.code)
            elif exc.kind == "not_found":
                if current.get("link_id"):
                    conn.execute("UPDATE access_person_links SET state = 'wiskey_missing', revision = revision + 1 WHERE id = ?", (current["link_id"],))
                    _audit(conn, None, "access.person_link.missing", current["link_id"], resource_type="access_person_link")
                _touch(conn, g["id"], {"state": "revoked", "end_reason": "wiskey_missing", "ended_at": iso(now()), "provision_attempts": attempts})
                _audit(conn, None, "access.grant.revoke", g["id"], reason="wiskey_missing", state="revoked")
            elif exc.kind in ("not_sent", "not_permitted") and attempts < PROVISION_ATTEMPTS:
                # E1: back to approved; the scheduler tries again after 5 minutes, for one hour. A configuration write with a revision
                # check - never a physical command. Nothing may have landed (not_sent): `pushed` stays as it was before.
                _touch(conn, g["id"], {"state": "approved", "provision_attempts": attempts, "provision_after": iso(now() + timedelta(seconds=PROVISION_RETRY_S)),
                                       "pushed": g["pushed"]})
                _audit(conn, None, "access.grant.fail", g["id"], reason=exc.kind, code=exc.code, attempt=attempts, retry=True)
            else:
                _touch(conn, g["id"], {"provision_attempts": attempts})
                fresh = grant_row(conn, g["id"])
                mark_revoking(conn, fresh, "failed")
                _audit(conn, None, "access.grant.fail", g["id"], reason=exc.kind, code=exc.code, attempt=attempts)
        return False

    def resolve_unknown(self, db: Database, g: dict[str, Any]) -> str | None:
        """E2: an unknown outcome is never retried blindly - a fresh read decides: the grant's door map and validity in WisKey ->
        `active`; otherwise `failed` (and the person stripped)."""
        with db.connection(mode="read", label="access_grants.unknown.read") as conn:
            link = link_row(conn, g.get("link_id")) or link_of_subject(conn, g["subject_kind"], g["subject_id"])
        scope = Scope.of_row(g)
        if link is None:
            with db.connection(label="access_grants.unknown.nolink") as conn:
                mark_revoking(conn, grant_row(conn, g["id"]), "failed")
            return None
        try:
            person = engine_for(db).get_person(link["wiskey_person_id"])
        except EngineError as exc:
            if exc.kind == "not_found":
                with db.connection(label="access_grants.unknown.missing") as conn:
                    mark_revoking(conn, grant_row(conn, g["id"]), "wiskey_missing")
            return None  # not reachable now: the next pass reads again
        matches = person.active and person.doors == scope.doors and person.valid_until == scope.valid_until and person.valid_from == scope.valid_from
        with db.connection(label="access_grants.unknown.decide") as conn:
            cur = grant_row(conn, g["id"])
            if cur is None or cur["state"] != "unknown":
                return None
            if matches:
                _touch(conn, g["id"], {"state": "active", "wiskey_revision": person.revision})
                _audit(conn, None, "access.grant.activate", g["id"], wiskey_person_id=person.id, after="unknown")
                return "provisioned"
            mark_revoking(conn, cur, "failed")
        return None

    def push_narrowing(self, db: Database, g: dict[str, Any]) -> None:
        with db.connection(mode="read", label="access_grants.narrow.read") as conn:
            link = link_row(conn, g.get("link_id"))
        if link is None:
            return
        scope = Scope.of_row(g)
        engine = engine_for(db)
        try:
            person = engine.get_person(link["wiskey_person_id"])
            person = engine.apply(person.id, person.revision, doors=scope.doors, valid_from=scope.valid_from, valid_until=scope.valid_until, timing=scope.timing,
                                  active=True, pin=KEEP)
        except EngineError as exc:
            if exc.kind in ("unknown", "not_found"):
                with db.connection(label="access_grants.narrow.unknown") as conn:  # cannot prove the narrowing landed: revoke (fail closed)
                    mark_revoking(conn, grant_row(conn, g["id"]), "failed" if exc.kind == "unknown" else "wiskey_missing")
            return
        with db.connection(label="access_grants.narrow.done") as conn:
            _touch(conn, g["id"], {"needs_push": 0, "wiskey_revision": person.revision})
            _audit(conn, None, "access.grant.amend", g["id"], kind="pushed", stations=stations_of(scope.doors))

    # ---- revocation (at least once)

    def strip(self, db: Database, g: dict[str, Any]) -> bool:
        with db.connection(mode="read", label="access_grants.strip.read") as conn:
            link = link_row(conn, g.get("link_id")) or link_of_subject(conn, g["subject_kind"], g["subject_id"])
        engine = engine_for(db)
        outcome = "stripped"
        if link is not None:
            try:
                person = engine.get_person(link["wiskey_person_id"])
                if person.doors or person.active or person.pin_configured:
                    try:
                        engine.strip(person.id, person.revision)
                    except EngineError as exc:
                        if exc.kind != "revision_conflict":
                            raise
                        person = engine.get_person(link["wiskey_person_id"])
                        engine.strip(person.id, person.revision)
            except EngineError as exc:
                if exc.kind == "not_found":
                    outcome = "wiskey_missing"
                else:
                    with db.connection(label="access_grants.strip.retry") as conn:
                        conn.execute("UPDATE access_grants SET revoke_attempts = revoke_attempts + 1, updated_at = ? WHERE id = ?", (iso(now()), g["id"]))
                        _audit(conn, None, "access.grant.revoke_retry", g["id"], code=exc.kind)
                    return False
        with db.connection(label="access_grants.strip.done") as conn:
            cur = grant_row(conn, g["id"])
            if cur is None or cur["state"] != "revoking":
                return False
            state = final_state_for(cur["end_reason"] or "manual")
            _touch(conn, g["id"], {"state": state, "ended_at": iso(now()), "needs_push": 0})
            if outcome == "wiskey_missing" and link is not None:
                conn.execute("UPDATE access_person_links SET state = 'wiskey_missing', revision = revision + 1 WHERE id = ?", (link["id"],))
            _audit(conn, None, "access.grant.end" if state == "ended" else "access.grant.revoked", g["id"], reason=cur["end_reason"], outcome=outcome)
        return True

    # ---- the code (owner answers 3, 4, 11)

    def _caps(self, conn: sqlite3.Connection, g: dict[str, Any], number_ref: str, at: datetime) -> str | None:
        if int(g["code_sends"]) >= CODE_CAP_GRANT:
            return "cap_grant"
        day = iso(at - timedelta(days=1))
        if conn.execute("SELECT COUNT(*) FROM access_code_sends WHERE number_ref = ? AND at > ?", (number_ref, day)).fetchone()[0] >= CODE_CAP_NUMBER_DAY:
            return "cap_number"
        if conn.execute("SELECT COUNT(*) FROM access_code_sends WHERE at > ?", (day,)).fetchone()[0] >= CODE_CAP_INSTALLATION_DAY:
            return "cap_installation"
        return None

    def _code_end(self, db: Database, g: dict[str, Any], state: str, reason: str | None, *, number_ref: str | None = None, sent_outcome: str | None = None,
                  revision: int | None = None) -> None:
        with db.connection(label="access_grants.code.end") as conn:
            fields: dict[str, Any] = {"code_state": state}
            if sent_outcome is not None:
                fields.update({"code_sends": int(g["code_sends"]) + 1, "last_code_at": iso(now())})
                conn.execute("INSERT INTO access_code_sends(grant_id, number_ref, at, outcome) VALUES (?, ?, ?, ?)", (g["id"], number_ref or "", iso(now()), sent_outcome))
            if revision is not None:
                fields["wiskey_revision"] = revision
            _touch(conn, g["id"], fields)
            action = {"sent": "access.grant.code_sent", "unknown": "access.grant.code_unknown"}.get(state, "access.grant.code_not_delivered")
            _audit(conn, None, action, g["id"], reason=reason, sends=fields.get("code_sends", g["code_sends"]))

    def deliver_code(self, db: Database, g: dict[str, Any]) -> bool:
        at = now()
        with db.connection(label="access_grants.code.begin") as conn:
            cur = grant_row(conn, g["id"])
            if cur is None or cur["state"] != "active" or cur["code_state"] != "pending":
                return False
            contact = contact_row(conn, cur["subject_id"])
            problem = subject_problem(conn, contact) or number_problem(conn, contact, at)
            if not problem and (contact.get("phone_confirmed_at") or None) != (cur.get("phone_confirmed_at") or None):
                problem = "phone_changed"
            number_ref = (contact or {}).get("phone_key") or f"contact:{cur['subject_id']}"
            if not problem:
                last = parse_iso(cur.get("last_code_at"))
                if last is not None and (at - last).total_seconds() < CODE_GAP_S:
                    return False  # 1 per 60 s per grant: try again on a later pass
                problem = self._caps(conn, cur, number_ref, at)
            if problem:
                _touch(conn, cur["id"], {"code_state": "not_delivered"})
                _audit(conn, None, "access.grant.code_not_delivered", cur["id"], reason=problem)
                return False
            _touch(conn, cur["id"], {"code_state": "queued"})  # CR 4.4: a restart from here on leaves it not_delivered
            _audit(conn, None, "access.grant.code_queued", cur["id"], job=secrets.token_hex(6))
            link = link_row(conn, cur.get("link_id"))
            g = grant_row(conn, cur["id"])
        if link is None:
            self._code_end(db, g, "not_delivered", "no_link")
            return False
        engine = engine_for(db)
        scope = Scope.of_row(g)
        pin: str | None = None
        person: EnginePerson | None = None
        try:
            person = engine.get_person(link["wiskey_person_id"])
            if person.doors != scope.doors:
                self._code_end(db, g, "not_delivered", "door_map_changed")
                return False
            for _attempt in range(PIN_ATTEMPTS):
                pin = engine.pin_generate(person.id)
                try:
                    person = engine.apply(person.id, person.revision, doors=scope.doors, valid_from=scope.valid_from, valid_until=scope.valid_until,
                                          timing=scope.timing, active=True, pin=pin)
                    break
                except EngineError as exc:
                    pin = None
                    if exc.kind == "pin_conflict":
                        continue  # F4: the generated PIN is not reserved - generate again (at most 3 times)
                    if exc.kind == "revision_conflict":
                        self._code_end(db, g, "not_delivered", "revision_conflict")
                        return False
                    if exc.kind == "unknown":  # E2: a PIN whose write is unknown is never sent; the job is dropped
                        self._code_end(db, g, "not_delivered", "write_unknown")
                        return False
                    raise
            if pin is None:
                self._code_end(db, g, "not_delivered", "pin_conflict")
                return False
        except EngineError as exc:
            pin = None
            self._code_end(db, g, "not_delivered", exc.kind)
            return False
        except Exception:  # noqa: BLE001 - never the PIN in a log or an exception text
            pin = None
            self._code_end(db, g, "not_delivered", "error")
            return False
        # the last check before the message leaves: still active, same number (a number change kills a queued code - R3)
        with db.connection(mode="read", label="access_grants.code.recheck") as conn:
            cur = grant_row(conn, g["id"])
            contact = contact_row(conn, g["subject_id"])
            ok = (cur is not None and cur["state"] == "active" and cur["code_state"] == "queued" and contact is not None
                  and (contact.get("phone_confirmed_at") or None) == (cur.get("phone_confirmed_at") or None) and not number_problem(conn, contact, now()))
            msg = render_code_message(conn, g, contact, pin) if ok else None
        pin = None
        if msg is None:
            self._code_end(db, g, "not_delivered", "changed_before_send", revision=person.revision if person else None)
            return False
        try:
            outcome = send_code(db, msg)
        finally:
            msg.digits = ""
            msg.text = ""
            del msg
        state = {"sent": "sent", "unknown": "unknown"}.get(outcome, "not_delivered")
        self._code_end(db, g, state, None if state == "sent" else outcome, number_ref=number_ref, sent_outcome=outcome if outcome in ("sent", "unknown", "not_sent") else "not_sent",
                       revision=person.revision if person else None)
        return state == "sent"

    # ---- links left behind and the managers' attention

    def finish_unlinks(self, db: Database) -> None:
        with db.connection(label="access_grants.unlink.finish") as conn:
            marks = ",".join("?" * len(LIVE))
            for link in conn.execute("SELECT id FROM access_person_links WHERE state = 'unlinking'").fetchall():
                live = conn.execute(f"SELECT COUNT(*) FROM access_grants WHERE link_id = ? AND state IN ({marks})", (link["id"], *LIVE)).fetchone()[0]
                if not live:
                    conn.execute("DELETE FROM access_person_links WHERE id = ?", (link["id"],))

    def alert_and_prune(self, db: Database) -> None:
        at = now()
        with db.connection(label="access_grants.attention") as conn:
            rows = conn.execute(
                "SELECT * FROM access_grants WHERE alerted_at IS NULL AND ((state = 'revoking' AND revoking_since <= ?) OR code_state IN ('not_delivered', 'unknown') "
                "OR state IN ('failed', 'unknown'))", (iso(at - timedelta(seconds=REVOKE_ALERT_S)),)).fetchall()
            for r in rows:
                kind = "revoke_pending" if r["state"] == "revoking" else ("code_" + r["code_state"]) if r["code_state"] in ("not_delivered", "unknown") else r["state"]
                _notify(conn, "access.grant_attention", r["id"], kind)
                conn.execute("UPDATE access_grants SET alerted_at = ? WHERE id = ?", (iso(at), r["id"]))
            cutoff = iso(at - timedelta(days=RETENTION_DAYS))
            conn.execute("DELETE FROM access_grants WHERE state IN ('ended', 'revoked', 'refused', 'failed') AND COALESCE(ended_at, updated_at) < ?", (cutoff,))
            conn.execute("DELETE FROM access_code_sends WHERE at < ?", (iso(at - timedelta(days=2)),))


WORKER = Worker()


def _notify(conn: sqlite3.Connection, source: str, subject_id: str, kind: str) -> None:
    """A content-free notification to the managers (no name, no number, no door). Never raises."""
    try:
        from . import notify

        notify.emit(conn, notify.Signal(source=source, subject_kind="system", subject_id=subject_id[:32], dedupe_key=f"{source}:{subject_id[:32]}",
                                        params={"kind": kind}, link="#/system/access?tab=external"))
    except Exception:  # noqa: BLE001
        log.warning("access grants notification failed")


def notify_request(conn: sqlite3.Connection, grant_id: str) -> None:
    _notify(conn, "access.grant_request", grant_id, "request")


def reset_for_tests() -> None:
    global ENGINE_FACTORY, TRANSPORT
    ENGINE_FACTORY = None
    TRANSPORT = None
    _REDECIDE.clear()
    set_clock(None)
