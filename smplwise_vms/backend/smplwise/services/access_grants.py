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
- WISKEYFINAL-280 (the composed worker: the round-3 worker plus the GRANTS-FIX280 intent and WisKey round 4): a narrowing is `pushed`
  only after a fresh read proves the COMPLETE scope (doors, validity, timing, active; an unknown door map proves nothing) and
  `needs_push` is cleared by a compare-and-set on the row revision the pass read (F2, R4-04); an unknown outcome is settled only
  against the row's CURRENT scope, by a revision compare-and-set (R4-03); no write ever goes to a WisKey person Arx did not create -
  approval, provisioning, narrowing, revocation and code delivery all check the link's origin (F3, R4-05); ONE process runs the
  worker - precondition "workers=1", enforced by an exclusive OS lock beside the database that every pass must hold and that is
  never given up while a pass may still be writing (F4, R4-06).
- WISKEYFINAL2-281 (WisKey round 5): every users/create is journaled before dispatch and a grant with no link is decided by that journal -
  an unresolved create keeps it `revoking` (never `failed` / `revoked`, hourly alerts, no second create) (R5-A1); the scope proof needs
  the whole timing policy (R5-A2); views say whether the scope is proven (R5-A3); an incomplete person record never decides an
  approval or a match per station (R5-A4).
"""
from __future__ import annotations

import json
import logging
import os
import re
import secrets
import sqlite3
import threading
import uuid
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta, timezone
from typing import Any, Callable, Iterable

from ..db import Database, get_setting, now_iso, permission_revision, set_setting
from ..errors import ApiError, forbidden
from ..rbac import INSTALLATION, LOCAL_ID_PREFIX, STATION, Principal, authorize, is_system_admin, permissions_anywhere
from . import intercom_authority as ia
from . import intercom_write_journal as wj
from .access_grant_engine import KEEP, Engine, EngineError, EnginePerson, central_revoked, plan_overrides, requested_policy, revocation_proven
from .wiskey_access_state import EVIDENCE_UNVERIFIED

log = logging.getLogger("smplwise.access_grants")

# ---------------------------------------------------------------- constants and settings

# The owner's SEPARATE go-live permit, enforced in code (the capture-lease pattern): while False the switch cannot be turned on,
# the live WisKey engine refuses every call and the live WhatsApp transport sends nothing. Flipped only by the commit that carries
# the owner's written go-live permit - never by a setting, an environment variable or a version.
GO_LIVE_PERMITTED = True  # ECCACT-295: owner decision 2026-10-21 (option A) removed the historical block; the switch access.external_grants stays OFF until an administrator turns it on

PERMISSION = "access.external.grant"
FLAG_KEY = "access.external_grants"
MAX_DAYS_KEY = "access.external.max_days"
MAX_DOORS_KEY = "access.external.max_doors"
FRESH_KEY = "access.external.phone_fresh_days"
CODE_HOUR_KEY = "access.external.code_hour"
LOCAL_KEY = "access.external.local_approvers"
CARDS_KEY = "access.external.cards"  # GRANTS3-295 (X5): card grants for a vendor's technicians; off by default, on only with the go-live permit
# SECFIX2-295 / PUB-03 (docs/security/PROPOSAL_PUB03_PENDING_TECHNICIAN_RETENTION.md, option A; owner decision pending): a technician a
# vendor typed on the arrival page and nobody decided is erased after N days (services/pending_retention.py), and a vendor holds at most
# M undecided technicians. Owner decision 2026-10-21: the recommendation is the default - 90 days, 10 per vendor (a value an administrator
# saved, including "0" = off, wins; an installation that never saved one gets these at upgrade). Never in a project backup.
PENDING_RETENTION_KEY = "access.external.pending_retention_days"
PENDING_CAP_KEY = "access.external.pending_max_per_vendor"
PENDING_RETENTION_MIN, PENDING_RETENTION_MAX = 7, 365
PENDING_CAP_MAX = 100
KEYS = (FLAG_KEY, MAX_DAYS_KEY, MAX_DOORS_KEY, FRESH_KEY, CODE_HOUR_KEY, LOCAL_KEY, CARDS_KEY, PENDING_RETENTION_KEY, PENDING_CAP_KEY)
MAX_DAYS_CAP = 14  # owner answer 8: a constant; the setting may only lower it
MAX_DOORS_CAP = 8
DEFAULTS = {FLAG_KEY: "off", MAX_DAYS_KEY: "14", MAX_DOORS_KEY: "4", FRESH_KEY: "180", CODE_HOUR_KEY: "18", LOCAL_KEY: "off", CARDS_KEY: "off",
            PENDING_RETENTION_KEY: "90", PENDING_CAP_KEY: "10"}
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
REVOKE_BACKOFF_BASE_S = 15  # F1: a revoke that is not yet verified is retried with exponential backoff (15 s, 30 s, ... capped) ...
REVOKE_BACKOFF_CAP_S = 300  # ... at most every 5 minutes
# WKV2B-295: how a finished revoke was proven. `verified` = a v2 answer (NULL = finished before WKV2B, or not through a strip: no claim);
# `unverified` = "revoked, not verified by the other side": Arx's own readback showed the revoked state and a v1 answer looked clean, but
# v1 never proves a revoke. The two are different results on every screen.
REVOKE_VERIFIED = "verified"
REVOKE_UNVERIFIED = "unverified"
REVOKE_REALERT_S = 3600     # F1: the managers are told again each hour a grant stays `revoking`
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
# Decision 2 (2026-10-18): the short notice addressed to the technician himself (version B of the legal pack), for the number-confirmation
# message to a technician. Code-owned wording, kept here beside the notice so the four languages stay in step; the same sentence is in the
# phone_verify variants verify_technician* (tickets/message_templates.py), chosen by is_technician below; a test compares them.
NOTICE_SHORT = {
    "he": "שמך, מספר הטלפון שלך ורישומי הכניסה שלך (שעה ודלת) נשמרים לצורך אבטחת המבנה בלבד, עד שהארגון מוחק אותם. לעיון, לתיקון או למחיקה: מנהל המבנה.",
    "en": "Your name, phone number and entry records (time and door) are kept for building security only, until the organisation deletes them. "
          "To see, correct or delete them: the building manager.",
    "ar": "يُحفظ اسمك ورقم هاتفك وسجلّ عمليات دخولك (الوقت والباب) لأغراض أمن المبنى فقط، إلى أن تحذفها المؤسسة. "
          "للاطلاع عليها أو تصحيحها أو حذفها: مدير المبنى.",
    "ru": "Ваше имя, номер телефона и данные о ваших входах (время и дверь) хранятся только для обеспечения безопасности здания "
          "до их удаления организацией. Ознакомление, исправление или удаление — через управляющего зданием.",
}
# PRIVTEXT-293: who is a "technician" - ONE definition for the phone-verification message (tickets/phone_verify) and the needs-review report
# (needs_review.idle_rows): a directory person (not an internal user, not an employee, not erased) that Arx knows for door access - accepted
# from the arrival page, linked to a door-system person, or with any grant row - and not a vendor-added person still waiting for a decision.
# A plain vendor contact, a ticket contact or a signed-in user is never one. Alias `c` is ticket_contacts.
TECHNICIAN_SQL = ("c.kind = 'person' AND c.user_id IS NULL AND c.erased_at IS NULL AND COALESCE(c.employee, 0) = 0 "
                  "AND NOT EXISTS (SELECT 1 FROM access_pending_contacts p WHERE p.contact_id = c.id AND p.accepted_at IS NULL AND p.rejected_at IS NULL) "
                  # EXTERNALBUILD-297 (CR-VISITOR105 T11): a visitor invited by a host is never a technician
                  "AND NOT EXISTS (SELECT 1 FROM access_visitor_invites vi WHERE vi.visitor_contact_id = c.id) "
                  "AND (EXISTS (SELECT 1 FROM access_pending_contacts p WHERE p.contact_id = c.id AND p.accepted_at IS NOT NULL) "
                  "  OR EXISTS (SELECT 1 FROM access_person_links l WHERE l.subject_kind = 'contact' AND l.subject_id = c.id) "
                  "  OR EXISTS (SELECT 1 FROM access_grants g WHERE g.subject_kind = 'contact' AND g.subject_id = c.id))")


def is_technician(conn: sqlite3.Connection, contact_id: str) -> bool:
    return conn.execute("SELECT 1 FROM ticket_contacts c WHERE c.id = ? AND " + TECHNICIAN_SQL, (contact_id,)).fetchone() is not None


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
# PRIVORG-291: the last sentence of the notice names who to contact. Unset (no organisation name, no contact point): exactly the text above.
# Set: the organisation name replaces "the building manager" and the contact point / link follow in brackets. (lead, default target,
# target with the organisation name). The wording is a mechanical substitution - no new legal text; counsel reviews it with the notice.
NOTICE_CONTACT = {
    "he": ("יש לפנות", " למנהל המבנה", " אל {org}"),
    "en": ("contact", " the building manager", " {org}"),
    "ar": ("يُرجى التواصل مع", " مدير المبنى", " {org}"),
    "ru": ("обращайтесь", " к управляющему зданием", ": {org}"),
}
CODE_MESSAGE_SENDER = "SmplWise Arx"  # the name the code message starts with when no organisation name is set
# EXTERNALBUILD-297: the one-time code adds one fixed sentence before "the code is personal" (code-owned, four languages)
TEMPLATE_PERSONAL = {"he": "הקוד אישי", "en": "The code is personal", "ar": "الرمز شخصي", "ru": "Код личный"}
SINGLE_ENTRY_SENTENCE = {"he": "הקוד לכניסה אחת בלבד.", "en": "The code is for one entry only.", "ar": "الرمز صالح لدخول واحد فقط.",
                         "ru": "Код действует только на один вход."}


def notice_text(conn: sqlite3.Connection, lang: str) -> str:
    """The n2 notice in `lang` with the organisation name / contact point from the installation's privacy settings (services/privacy_org)."""
    from .privacy_org import identity

    base = NOTICE_TEXT[lang]
    who = identity(conn)
    if not who.any:
        return base
    lead, default_target, org_target = NOTICE_CONTACT[lang]
    tail = lead + default_target + "."
    if not base.endswith(tail):  # the fixed text and its tail drifted apart: keep the fixed text rather than guess
        return base
    target = org_target.format(org=who.organization) if who.organization else default_target
    extras = ", ".join(p for p in (who.contact, who.link) if p)
    return base[:-len(tail)] + lead + target + (f" ({extras})" if extras else "") + "."


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
    from .wiskey_access_state import last_known_stations

    def known(person_id: str) -> frozenset[str] | None:
        """WKV2-295 (F-02): Arx's own last-known doors record for the v2 cross-check; any failure is UNKNOWN (None)."""
        try:
            with db.connection(mode="read", label="access_grants.last_known_stations") as conn:
                return last_known_stations(conn, person_id)
        except Exception:  # noqa: BLE001
            return None

    from . import wiskey_acr5
    from .wiskey_readback import LiveReadback

    def acr5_gate(key: str) -> bool:
        """Review 3 G-01 (owner decision 2026-10-21): the readback runs only while the matching `wiskey.acr5_*` switch is on (default OFF)
        AND the wiskey_acr5 permit holds - read fresh on every read; any failure is OFF."""
        try:
            with db.connection(mode="read", label="access_grants.acr5_gate") as conn:
                return wiskey_acr5.consumer_on(conn, key)
        except Exception:  # noqa: BLE001
            return False

    # ECCACT-295: the live, capability-negotiated readback (v2 proves a revocation; v1 never does; nothing listed = UNKNOWN). It sends
    # only while its acr5 switch is on (G-01) AND WisKey lists the command AND advertises its capability; otherwise UNKNOWN (a revoke stays `revoking`).
    return WiskeyServiceEngine(_SETTINGS, access_state_reader=LiveReadback(_SETTINGS, gate=acr5_gate), last_known_stations=known)


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


def pending_retention_days(conn: sqlite3.Connection) -> int:
    """PUB-03: default 90 (owner 2026-10-21); a saved 0 = off (an undecided vendor-typed technician is kept until a manager decides); otherwise 7-365 days (a stored
    value below the floor reads as the floor, so a slip never erases a request the same week). Unreadable -> 0 (nothing is erased)."""
    try:
        value = int(get_setting(conn, PENDING_RETENTION_KEY) or DEFAULTS[PENDING_RETENTION_KEY])
    except (ValueError, TypeError, sqlite3.Error):
        return 0
    if value <= 0:
        return 0
    return max(PENDING_RETENTION_MIN, min(PENDING_RETENTION_MAX, value))


def pending_cap(conn: sqlite3.Connection) -> int:
    """PUB-03: at most this many undecided vendor-typed technicians per vendor (default 10, owner 2026-10-21; a saved 0 = no cap). Unreadable -> no cap (the arrival
    page's own per-link budgets still hold)."""
    try:
        value = int(get_setting(conn, PENDING_CAP_KEY) or DEFAULTS[PENDING_CAP_KEY])
    except (ValueError, TypeError, sqlite3.Error):
        return 0
    return max(0, min(PENDING_CAP_MAX, value))


def pending_count(conn: sqlite3.Connection, vendor_id: str) -> int:
    return int(conn.execute("SELECT COUNT(*) FROM access_pending_contacts WHERE vendor_id = ? AND accepted_at IS NULL AND rejected_at IS NULL",
                            (vendor_id,)).fetchone()[0])


def zone_of(conn: sqlite3.Connection):
    from ..routers.settings import read_settings
    from .timeutil import zone

    try:
        return zone(read_settings(conn)["time.zone"])
    except Exception:  # noqa: BLE001 - a broken zone setting falls back to the product's default zone
        return zone("Asia/Jerusalem")


def cards_enabled(conn: sqlite3.Connection) -> bool:
    """GRANTS3-295 (X5): card grants - `on` only when the setting says exactly `on`, the feature is on AND the go-live permit is in the
    build (services/access_cards.py holds the card rules; capture stays off on its own constant)."""
    try:
        return (get_setting(conn, CARDS_KEY) or "off") == "on" and enabled(conn)
    except sqlite3.Error:
        return False


def settings_view(conn: sqlite3.Connection) -> dict[str, Any]:
    from .access_cards import CAPTURE_PERMITTED

    return {"external_grants": "on" if enabled(conn) else "off", "go_live_permitted": go_live_permitted(), "max_days": max_days(conn),
            "max_days_cap": MAX_DAYS_CAP, "max_doors": max_doors(conn), "phone_fresh_days": fresh_days(conn), "code_hour": code_hour(conn),
            "local_approvers": "on" if local_approvers(conn) else "off",
            # GRANTS3-295 (X5): cards, and card capture - which stays off until the owner releases the lease route
            "cards": "on" if cards_enabled(conn) else "off", "card_capture": "on" if CAPTURE_PERMITTED else "off",
            "pending_retention_days": pending_retention_days(conn), "pending_max_per_vendor": pending_cap(conn),
            # DENYALERT133-295: the denied-attempt alert's own switch (default off; it also needs the feature)
            "denied_alert": "on" if (get_setting(conn, "access.external.denied_alert") or "off") == "on" else "off"}


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


CODE_MODES = ("window", "single_entry")  # EXTERNALBUILD-297: the window code (as built) or a one-time code (ends after the first entry)


def parse_code_mode(value: Any) -> str | None:
    """None = not given (keep / default `window`); otherwise one of CODE_MODES."""
    if value is None:
        return None
    if value not in CODE_MODES:
        raise _invalid("code_mode", "format")
    return str(value)


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


def scope_digest(scope: Scope) -> str:
    """SHAREDID-293 (owner decision 2): the digest a read-back proof is stored under. Any change of the doors, the window, the timing
    or the credential gives another digest, so a stored proof never covers a scope it did not prove."""
    import hashlib

    return hashlib.sha256(scope.as_json().encode("utf-8")).hexdigest()[:32]


def proof_fields(scope: Scope) -> dict[str, Any]:
    """The columns a FRESH read that proved `scope` (scope_proven) writes, in the same transaction as the verdict it backs."""
    at = iso(now())
    return {"scope_proof": scope_digest(scope), "scope_proof_at": at, "scope_checked_at": at}


def scope_is_proven(g: dict[str, Any]) -> bool:
    """Owner decision 2: "Active - verified" only when the server holds read-back proof of the row's CURRENT scope: an active grant,
    no narrowing still to push, and a stored proof digest equal to the digest of its scope now."""
    proof = g.get("scope_proof")
    if not proof or g.get("state") != "active" or g.get("needs_push"):
        return False
    try:
        return proof == scope_digest(Scope.of_row(g))
    except (KeyError, TypeError, ValueError):
        return False


def covers(old: Scope, new: Scope) -> bool:
    """`new` is the same as or narrower than `old` in every dimension (owner answer 12: such a change merges at once)."""
    for sid, relays in new.doors.items():
        if not set(relays) <= set(old.doors.get(sid, [])):
            return False
    if new.valid_from < old.valid_from or new.valid_until > old.valid_until:
        return False
    if old.credential == "none" and new.credential in ("pin", "card"):
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


def link_of_grant(conn: sqlite3.Connection, g: dict[str, Any]) -> dict[str, Any] | None:
    """The link a grant acts on: its own `link_id`, else the subject's link (a link made after the request)."""
    return link_row(conn, g.get("link_id")) or link_of_subject(conn, g["subject_kind"], g["subject_id"])


def person_is_ours(link: dict[str, Any] | None) -> bool:
    """F3 (grants-worker review H4): Arx approves, provisions and WRITES a grant only onto a WisKey person Arx created itself. A manually
    matched person (`origin = 'matched'`) may hold WisKey-native access (a PIN, staff doors, a validity) that a provisioning write would
    overwrite and a revoke would strip - refused until a merge design exists. No link yet: Arx will create the person."""
    return link is None or link.get("origin") == "created_from_arx"


def _person_not_ours() -> ApiError:
    return _conflict("access_person_not_ours", "האדם נוצר במערכת הכניסה ולא על ידי Arx; אי אפשר לתת לו גישה זמנית. בטלו את הקישור כדי שתיווצר רשומה נפרדת.")


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
           stations=_stations_or_none(g))
    WORKER.wake()
    return state


def _stations_or_none(g: dict[str, Any]) -> list[str] | None:
    """The stations for the revoke audit row. K7: an unreadable `doors_json` (a restored archive, a hand edit) must never make
    the revoke itself fail - before, it raised inside the re-decision's fail-closed handler and rolled the whole pass back."""
    try:
        doors = json.loads(g["doors_json"] or "{}")
        return stations_of(doors) if isinstance(doors, dict) else None
    except (ValueError, TypeError):
        return None


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


def _cursor_after(raw: str | None) -> str | None:
    """The last grant id an interrupted re-decision applied (K7), or None (no cursor, or one that cannot be read: start over)."""
    try:
        after = json.loads(raw)["after"] if raw else None
    except (ValueError, TypeError, KeyError):
        return None
    return after if isinstance(after, str) and after else None


def _approver_print(conn: sqlite3.Connection, g: dict[str, Any]) -> tuple[Any, ...]:
    """What a re-decision reads that the permission revision does not guard (K7): the approver's own row and, for a local
    identity, the local-approver switch. Equal before and after = a decision made on the snapshot still holds."""
    approver = g.get("approved_by")
    if not approver:
        return (None,)
    user = conn.execute("SELECT * FROM users WHERE id = ?", (approver,)).fetchone()
    row = None if user is None else (user["active"], user["deleted_at"] if "deleted_at" in user.keys() else None)
    return (row, local_approvers(conn) if str(approver).startswith(LOCAL_ID_PREFIX) else None)


def _between_decide_and_apply(rows: list[dict[str, Any]]) -> None:
    """A seam for the K7 tests (a concurrent change, a crash between the two phases); does nothing."""


def on_permission_change() -> None:
    """Called from db.bump_permission_revision (CR 3.5, owner answer 5): the worker re-decides every decided grant against its
    approver's CURRENT permissions. Never touches the database and never raises."""
    _REDECIDE.set()
    WORKER.wake()


# ---------------------------------------------------------------- request / amend (owner answer 12)

def request_grant(conn: sqlite3.Connection, *, actor: Any, requested_by: str, contact_id: str, source_kind: str, source_ref: str | None,
                  assignment_id: str | None, scope: Scope, outside_window: bool = False, request_id: str | None = None,
                  purpose: str | None = None, notes: str | None = None, code_mode: str | None = None) -> tuple[dict[str, Any], str]:
    """Create a `requested` grant, or change the person's live one. Returns (grant, outcome): `created`; `replaced` (still
    requested); `merged` (a narrowing or the same scope of a decided grant: applied at once, pushed to WisKey by the worker when
    active); `widening` (held in `pending_json` for a new approval; the approved scope keeps working meanwhile).

    ACCESSREQ-293: `scope_requested_by` names who asked for the scope that now waits for a decision (created, replaced, widening) -
    owner decision (a): that person may not approve it. `purpose` / `notes` (already cleaned by services/access_request.clean_text)
    are written when given."""
    texts = {k: v for k, v in (("purpose", purpose), ("notes", notes)) if v is not None}
    # EXTERNALBUILD-297: the code type. `single_entry` ends the grant after the first granted entry; on a decided grant it is a
    # narrowing (merged at once), while asking for `window` on a single-entry grant keeps it single-entry (never widened here).
    mode = parse_code_mode(code_mode)
    if mode == "single_entry" and scope.credential != "pin":
        raise _invalid("code_mode", "pin_only", "קוד חד-פעמי אפשרי רק עם קוד כניסה.")
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
    if scope.credential == "card":  # GRANTS3-295 (X5): the switch and "a vendor's technician only"
        from .access_cards import check_request

        check_request(conn, contact)
    at = iso(now())
    live = live_grant_of(conn, "contact", contact_id)
    if live is not None and live["state"] in DECIDED and "card" in (live["credential"], scope.credential) and live["credential"] != scope.credential:
        # GRANTS3-295: a decided grant never changes between a card and another credential (a PIN on a carded person, or a card left on a
        # PIN person, would outlive what was approved) - the access is ended and a new one requested
        raise _conflict("access_grant_credential_change", "אי אפשר להחליף כרטיס בקוד (או להפך) בגישה שאושרה. בטלו אותה ובקשו גישה חדשה.")
    if live is None:
        gid = uuid.uuid4().hex
        conn.execute(
            """INSERT INTO access_grants(id, subject_kind, subject_id, link_id, source_kind, source_ref, assignment_id, outside_window, doors_json,
               valid_from, valid_until, timing_json, credential, state, requested_by, code_state, created_at, updated_at)
               VALUES (?, 'contact', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'requested', ?, ?, ?, ?)""",
            (gid, contact_id, (link_of_subject(conn, "contact", contact_id) or {}).get("id"), source_kind, source_ref, assignment_id, 1 if outside_window else 0,
             json.dumps(scope.doors, sort_keys=True), scope.valid_from, scope.valid_until, json.dumps(scope.timing, sort_keys=True) if scope.timing else None,
             scope.credential, requested_by, "not_needed" if scope.credential == "none" else "pending", at, at))
        conn.execute("UPDATE access_grants SET scope_requested_by = ?, purpose = ?, notes = ?, code_mode = ? WHERE id = ?",
                     (requested_by, purpose, notes, mode or "window", gid))
        _audit(conn, actor, "access.grant.request", gid, request_id=request_id, source=source_kind, source_ref=source_ref, window=[scope.valid_from, scope.valid_until],
               stations=stations_of(scope.doors), outside_window=bool(outside_window), technician_id=contact_id, code_mode=mode or "window")
        return grant_row(conn, gid), "created"
    if live["state"] == "revoking":
        raise _conflict("access_grant_revoking", "הגישה הקודמת עדיין מבוטלת. נסו שוב בעוד רגע.")
    if live["state"] == "requested":
        _touch(conn, live["id"], {"doors_json": json.dumps(scope.doors, sort_keys=True), "valid_from": scope.valid_from, "valid_until": scope.valid_until,
                                  "timing_json": json.dumps(scope.timing, sort_keys=True) if scope.timing else None, "credential": scope.credential,
                                  "outside_window": 1 if outside_window else 0, "code_state": "not_needed" if scope.credential == "none" else "pending",
                                  "scope_requested_by": requested_by, **texts, **({"code_mode": mode} if mode else {})})
        _audit(conn, actor, "access.grant.amend", live["id"], request_id=request_id, kind="replaced", window=[scope.valid_from, scope.valid_until],
               stations=stations_of(scope.doors))
        return grant_row(conn, live["id"]), "replaced"
    current = Scope.of_row(live)
    if covers(current, scope):
        fields: dict[str, Any] = {"doors_json": json.dumps(scope.doors, sort_keys=True), "valid_from": scope.valid_from, "valid_until": scope.valid_until,
                                  "timing_json": json.dumps(scope.timing, sort_keys=True) if scope.timing else None, "credential": scope.credential,
                                  "pending_json": None, **texts}
        if mode == "single_entry":
            fields["code_mode"] = "single_entry"  # a narrowing: one entry instead of the window
        if live["state"] in ("active", "unknown") and scope != current:
            # R4-03: also while an unknown outcome is being settled - the settlement CASes on the row revision (this write moves it), and a
            # readback that still shows the broader scope activates the grant only with this flag set, so the narrowing is pushed next
            fields["needs_push"] = 1
        if live.get("code_state") in ("pending",) and live["state"] in DECIDED:
            fields["code_due_at"] = code_due(conn, scope.valid_from, now())
        _touch(conn, live["id"], fields)
        _audit(conn, actor, "access.grant.amend", live["id"], request_id=request_id, kind="narrowed", window=[scope.valid_from, scope.valid_until],
               stations=stations_of(scope.doors))
        WORKER.wake()
        return grant_row(conn, live["id"]), "merged"
    _touch(conn, live["id"], {"pending_json": scope.as_json(), "outside_window": 1 if outside_window else live["outside_window"], "scope_requested_by": requested_by,
                              **texts})
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


def _complete_stations(person: EnginePerson) -> list[str] | None:
    """R5-A4: the person's stations when the record is COMPLETE, else None (unknown). A restricted projection (`doors_known` /
    `overrides_known` False: redacted access fields, or a record projected for a restricted caller that may hold only the stations
    that caller sees) is never evaluated as the complete station set."""
    if not (person.doors_known and person.overrides_known):
        return None
    return list(person.stations)


def _unrestricted_lacks(conn: sqlite3.Connection, principal: Principal, perms: Iterable[str]) -> list[tuple[str, str]]:
    """R5-A4: with the person's station set unknown, every involved permission must be held unrestricted (installation-wide)."""
    return [(p, "*") for p in perms if not authorize(conn, principal, p, INSTALLATION).allowed]


def _person_stations(db: Any, g: dict[str, Any]) -> list[str] | None:
    """The stations of the linked WisKey person besides the grant's own (CR 3.2: the approver needs people.manage + sensitive on
    every station of the person). No link yet: none. WisKey unreachable: the approval is refused (fail closed). R5-A4: None = the
    record is incomplete (the station set is unknown) - the approver must then hold the permissions unrestricted."""
    with db.connection(mode="read", label="access_grants.person_stations") as conn:
        link = link_of_grant(conn, g)
    if link is None:
        return []
    try:
        person = engine_for(db).get_person(link["wiskey_person_id"])
    except EngineError as exc:
        if exc.kind == "not_found":
            # WisKey round 3: `user_not_found` may mean "outside the service user's scope" - not "a person with no stations". The
            # approver's check over the person's stations cannot be made, so the approval is refused (fail closed).
            raise ApiError(409, "access_person_missing", "רשומת האדם לא נמצאה במערכת הכניסה, ולכן האישור לא נשמר.", details={"outcome": "not_sent"}) from None
        raise ApiError(503, "access_grant_engine_unavailable", "לא ניתן לקרוא כעת את רשומת האדם במערכת הכניסה, ולכן האישור לא נשמר.",
                       details={"outcome": "not_sent"}) from None
    return _complete_stations(person)


def requesters_of(g: dict[str, Any]) -> set[str]:
    """ACCESSREQ-293, owner decision (a): who asked for the scope that waits for a decision. A widening of a decided grant: whoever
    asked for the widening (`scope_requested_by`). A still-requested grant: its creator AND whoever last replaced its scope (a
    replacement must not let either of them approve). Rows written before the column existed name `requested_by`."""
    by = g.get("scope_requested_by")
    if g.get("state") in DECIDED and g.get("pending_json"):
        return {by or g.get("requested_by") or ""}
    return {x for x in (g.get("requested_by"), by) if x}


def self_approval_refused(conn: sqlite3.Connection, principal: Principal, g: dict[str, Any]) -> bool:
    """True when the caller asked for the scope awaiting a decision and is not a system administrator (owner decision (a): a system
    administrator may approve his own request). Fail closed: an unreadable answer refuses."""
    if str(principal.user_id) not in requesters_of(g):
        return False
    try:
        return not is_system_admin(conn, principal.user_id)
    except sqlite3.Error:
        return True


def self_approval_error() -> ApiError:
    return ApiError(403, "access_grant_self_approval", "מי שביקש את הגישה אינו יכול לאשר אותה בעצמו. אדם נוסף צריך לאשר (מנהל מערכת יכול לאשר בקשה שלו).")


def approve(db: Database, principal: Principal, grant_id: str, revision: int, *, doors: Any = None, valid_from: Any = None, valid_until: Any = None,
            told: bool = False, request_id: str | None = None, code_mode: Any = None) -> dict[str, Any]:
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
        g = _visible_or_404(conn, principal, grant_id)
        if self_approval_refused(conn, principal, g):
            # ACCESSREQ-293, owner decision (a): a second person approves; decided after the uniform 404, before any WisKey read
            raise deny("self_approval", self_approval_error())
        return g

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
        # EXTERNALBUILD-297: the approver may turn a window code into a one-time code (a narrowing), never the other way round
        chosen_mode = parse_code_mode(code_mode) or g.get("code_mode") or "window"
        if chosen_mode == "window" and g.get("code_mode") == "single_entry":
            raise deny("widened", _invalid("code_mode", "wider_than_requested", "המאשר יכול רק לצמצם את מה שהתבקש."))
        if chosen_mode == "single_entry" and chosen.credential != "pin":
            raise deny("code_mode", _invalid("code_mode", "pin_only", "קוד חד-פעמי אפשרי רק עם קוד כניסה."))
        if requested.credential == "card" and not cards_enabled(conn):
            # GRANTS3-295 (X5): built; still refused while the cards switch is off (it cannot be on without the go-live permit)
            raise deny("cards_off", _conflict("access_grant_cards_off", "גישה בכרטיס לאדם חיצוני כבויה."))
        stations = stations_of(chosen.doors)
        missing = missing_on(conn, principal, (PERMISSION,), stations) + missing_on(
            conn, principal, approve_permissions(chosen.credential)[1:], sorted(set(stations) | set(person_stations or [])))
        if person_stations is None:  # R5-A4: the person's station set is unknown - the permissions over the person must be unrestricted
            missing += _unrestricted_lacks(conn, principal, approve_permissions(chosen.credential)[1:])
        if missing:
            perm, sid = missing[0]
            _audit(conn, principal, "access.grant.approve", grant_id, decision="denied", reason="no_binding", request_id=request_id, permission=perm, station=sid)
            raise forbidden(permission=perm, target_type=STATION, target_id=sid, reason="no_binding")
        if not person_is_ours(link_of_grant(conn, g)):
            # F3 (grants-worker review H4): decided only after the caller's authority, so the answer tells nothing to a non-holder
            raise deny("person_not_ours", _person_not_ours())
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
            _audit(conn, principal, "access.grant.notice_ack", grant_id, request_id=request_id, via="approver", version=NOTICE_VERSION, acknowledged_for=g["subject_id"], technician_id=g["subject_id"])
        fields: dict[str, Any] = {"doors_json": json.dumps(chosen.doors, sort_keys=True), "valid_from": vf, "valid_until": vu, "pending_json": None,
                                  "approved_by": principal.user_id, "approved_at": iso(at), "approval_revision": permission_revision(conn),
                                  "phone_confirmed_at": (contact or {}).get("phone_confirmed_at"), "code_mode": chosen_mode}
        if amendment:
            # GRANTDENY-295 (GRANTS3 finding): the approved amendment is the WHOLE scope - doors and window AND the timing and the credential
            # that were requested. Writing only doors + window left the old schedule / credential on the row (and the next push) while the
            # approver had approved the new ones. A credential that widens (none -> pin / card) starts the code / card flow like a first approval.
            fields["timing_json"] = json.dumps(chosen.timing, sort_keys=True) if chosen.timing else None
            if chosen.credential != g["credential"]:
                fields["credential"] = chosen.credential
                fields["code_state"] = "pending" if chosen.credential == "pin" else "not_needed"
                fields["code_due_at"] = code_due(conn, vf, at) if chosen.credential == "pin" else None
                fields["card_state"] = "awaiting" if chosen.credential == "card" else None
            elif chosen.credential == "pin" and g.get("code_state") == "pending":
                fields["code_due_at"] = code_due(conn, vf, at)  # the window moved: the code is still due at the new start
            if g["state"] in ("active", "provisioning"):  # HARDEN271 K4: a write in flight carries the old map - push the new one after it
                fields["needs_push"] = 1
            action = "access.grant.amend"
        else:
            fields.update({"state": "approved", "provision_after": None, "provision_attempts": 0,
                           "code_state": "pending" if chosen.credential == "pin" else "not_needed",
                           "code_due_at": code_due(conn, vf, at) if chosen.credential == "pin" else None,
                           # GRANTS3-295 (X5): a card grant waits for its card (typed by number by an approver once the grant is active)
                           "card_state": "awaiting" if chosen.credential == "card" else None})
            action = "access.grant.approve"
        if not _touch(conn, grant_id, fields, expect_revision=revision):
            raise deny("stale", _conflict("stale_revision", "הגישה השתנתה מאז שנטענה. טענו מחדש."))
        _audit(conn, principal, action, grant_id, request_id=request_id, stations=stations, window=[vf, vu], credential=chosen.credential,
               approval_revision=fields["approval_revision"], kind="widening_approved" if amendment else None, technician_id=g["subject_id"],
               code_mode=chosen_mode)
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


def may_edit_contacts(conn: sqlite3.Connection, principal: Principal) -> bool:
    """The right to edit a directory contact (integ/2100 SMALL-294): `tickets.configure` or the narrower `tickets.directory`, both at the
    installation. Same rule as services/tickets/contacts.may_edit_directory, from a connection and a principal."""
    return any(authorize(conn, principal, perm, INSTALLATION).allowed for perm in ("tickets.configure", "tickets.directory"))


# ---------------------------------------------------------------- links (owner answer 1: manual, no authority union)

def match_link(db: Database, principal: Principal, contact_id: str, wiskey_person_id: str, request_id: str | None = None) -> dict[str, Any]:
    """Link an existing WisKey person to a contact (manual only, never by name or phone): `access.people.manage` on every station
    of that person AND the right to edit the contact (`tickets.configure` or `tickets.directory`)."""
    if not ia.valid_id(wiskey_person_id):
        raise _invalid("wiskey_person_id", "format")
    try:
        person = engine_for(db).get_person(wiskey_person_id)
    except EngineError as exc:
        if exc.kind == "not_found":
            raise ApiError(404, "access_person_not_found", "האדם לא נמצא במערכת הכניסה.") from None
        raise ApiError(503, "access_grant_engine_unavailable", "מערכת הכניסה אינה זמינה כעת.", details={"outcome": "not_sent"}) from None
    with db.connection(label="access_grants.match") as conn:
        if not may_edit_contacts(conn, principal):
            _audit(conn, principal, "access.person_link.match", contact_id, decision="denied", reason="no_binding", resource_type="contact", request_id=request_id)
            raise forbidden(permission="tickets.configure", target_type="installation", target_id="*", reason="no_binding")
        stations = _complete_stations(person)  # R5-A4: None = an incomplete record - people.manage must be unrestricted
        lacks = missing_on(conn, principal, (ia.PEOPLE_MANAGE,), stations) if stations else _unrestricted_lacks(conn, principal, (ia.PEOPLE_MANAGE,))
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
        if not may_edit_contacts(conn, principal):
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


def may_decide_pending(conn: sqlite3.Connection, principal: Principal) -> bool:
    """The authority of accept_pending_contact / reject_pending_contact (one rule for the list and both decisions)."""
    return PERMISSION in permissions_anywhere(conn, principal) or authorize(conn, principal, "tickets.configure", INSTALLATION).allowed


def pending_list(conn: sqlite3.Connection, principal: Principal, at: datetime | None = None) -> dict[str, Any]:
    """SECFIX2-295 (owner 2026-10-21): every technician a vendor typed on the arrival page that no manager accepted or rejected - the
    name, the vendor, the ticket number (only while the tickets module is on), since when, and the days left before the retention
    janitor erases him (None while retention is off). Never a phone number. Oldest first. Refused (403) to anyone who may not decide."""
    if not may_decide_pending(conn, principal):
        raise forbidden(permission=PERMISSION, target_type="installation", target_id="*", reason="no_binding")
    from .tickets.access import module_on

    now_at = at or now()
    days_keep = pending_retention_days(conn)
    try:
        tickets_on = module_on(conn)
    except Exception:  # noqa: BLE001 - an unreadable module switch hides the ticket reference (fail closed)
        tickets_on = False
    rows = conn.execute(
        "SELECT p.contact_id, p.vendor_id, p.assignment_id, p.created_at, c.display_name, v.display_name AS vendor_name "
        "FROM access_pending_contacts p JOIN ticket_contacts c ON c.id = p.contact_id LEFT JOIN ticket_contacts v ON v.id = p.vendor_id "
        "WHERE p.accepted_at IS NULL AND p.rejected_at IS NULL AND c.erased_at IS NULL ORDER BY p.created_at, p.contact_id").fetchall()
    out: list[dict[str, Any]] = []
    for r in rows:
        since = _parse_any(r["created_at"])
        days = max(0, (now_at - since).days) if since else 0
        number = None
        if tickets_on and r["assignment_id"]:
            try:
                t = conn.execute("SELECT t.number FROM ticket_assignments a JOIN tickets t ON t.id = a.ticket_id WHERE a.id = ?", (r["assignment_id"],)).fetchone()
                number = t[0] if t else None
            except sqlite3.Error:
                number = None
        out.append({"contact_id": r["contact_id"], "name": r["display_name"] or "", "vendor": r["vendor_name"] or "", "ticket_number": number,
                    "since": r["created_at"], "days": days, "days_left": max(0, days_keep - days) if days_keep else None})
    return {"pending": out, "retention_days": days_keep, "max_per_vendor": pending_cap(conn), "tickets_on": tickets_on}


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
    elif g["state"] == "active" and g.get("needs_push"):
        attention = "sync_pending"
    sync = sync_status(g)
    return {
        # R5-A3 / R6-A3: the grant's own state and how far WisKey's central record carries the doors / window below. `doors_state`
        # "desired" = what Arx asked for and WisKey has not accepted yet (a narrowing still to push, an unknown outcome, a provisioning
        # in flight); "accepted" = the central write was accepted (not re-read: never "verified", never a station-sync claim).
        "grant_state": g["state"], **sync,
        "id": g["id"], "revision": g["revision"], "state": g["state"], "end_reason": g["end_reason"], "source": g["source_kind"], "source_ref": g["source_ref"],
        "person": {"contact_id": g["subject_id"], "name": (contact or {}).get("display_name"), "pending": bool(contact and pending_contact(conn, contact["id"])),
                   "number": mask_number(contact) if sensitive else None},
        "doors": [{"station_id": s, "name": _station_name(s), "relays": doors[s]} for s in stations],
        "valid_from": g["valid_from"], "valid_until": g["valid_until"], "timing": json.loads(g["timing_json"]) if g["timing_json"] else None,
        "credential": g["credential"], "outside_window": bool(g["outside_window"]),
        # EXTERNALBUILD-297: window code or one-time code, and when the one entry was seen
        "code_mode": g.get("code_mode") or "window", "first_entry_at": g.get("first_entry_at"),
        "pending_amendment": json.loads(g["pending_json"]) if g.get("pending_json") else None,
        "approved_by": g["approved_by"], "approved_at": g["approved_at"],
        "code_state": g["code_state"] if sensitive else None, "code_due_at": g["code_due_at"] if sensitive else None,
        "code_sends": g["code_sends"] if sensitive else None,
        "card_state": g.get("card_state") if sensitive else None,  # GRANTS3-295 (X5): never a number, not even masked
        "notice": [{"via": r["via"], "version": r["version"], "at": r["at"]} for r in noticed], "attention": attention,
        "linked": bool(g.get("link_id")),
        **_screen_fields(conn, g),
        # ACCESSREQ-293: the request form's purpose and internal notes (never in a message to the person), and whether the caller
        # asked for the scope awaiting a decision (owner decision (a): the screen then offers no approval; the server refuses it anyway)
        "purpose": g.get("purpose"), "notes": g.get("notes"),
        "self_requested": str(principal.user_id) in requesters_of(g) if g["state"] == "requested" or g.get("pending_json") else False,
    }


def _screen_fields(conn: sqlite3.Connection, g: dict[str, Any]) -> dict[str, Any]:
    """SHAREDID-293: what the external-access screen needs beside the grant itself - the instants of its life, the approver's display
    name, the link's origin and state, whether a lost users/create is unresolved, and a manual closure (owner decision 3). Ids, states
    and instants; the only name is the approver's (an Arx user)."""
    link = link_of_grant(conn, g)
    approver = conn.execute("SELECT display_name FROM users WHERE id = ?", (g["approved_by"],)).fetchone() if g.get("approved_by") else None
    try:
        closure = conn.execute("SELECT kind, closed_by, closed_at, reappeared_at FROM access_grant_closures WHERE grant_id = ?", (g["id"],)).fetchone()
    except sqlite3.OperationalError:  # a database before 0126
        closure = None
    unresolved = False
    if link is None and g.get("pushed"):
        try:
            unresolved = wj.create_verdict(wj.create_ops(conn, grant_id=g["id"]))[0] == "unresolved"
        except sqlite3.Error:
            unresolved = False
    closer = conn.execute("SELECT display_name FROM users WHERE id = ?", (closure["closed_by"],)).fetchone() if closure else None
    contact = contact_row(conn, g["subject_id"]) if g["subject_kind"] == "contact" else None
    vendor = contact_row(conn, contact.get("vendor_id")) if contact and contact.get("vendor_id") else None
    return {
        # the person's company (the vendor's directory name) and kind: a vendor's technician is a contractor, anyone else a visitor
        "company": (vendor or {}).get("display_name"), "category": "contractor" if contact and contact.get("vendor_id") else "visitor",
        "created_at": g.get("created_at"), "updated_at": g.get("updated_at"), "ended_at": g.get("ended_at"), "revoking_since": g.get("revoking_since"),
        "approved_by_name": (approver["display_name"] if approver else None) or None,
        "link": {"id": link["id"], "origin": link["origin"], "state": link["state"]} if link else None,
        "create_unresolved": unresolved,
        "closure": {"kind": closure["kind"], "closed_at": closure["closed_at"], "closed_by_name": (closer["display_name"] if closer else None) or None,
                    "reappeared_at": closure["reappeared_at"]} if closure else None,
    }


def sync_status(g: dict[str, Any]) -> dict[str, Any]:
    """R5-A3: approval is not a verified central scope. `pending_sync` for a decided grant whose scope is not accepted yet (approved,
    provisioning, unknown, or active with a narrowing still to push). Neither is a claim about the stations (WisKey applies later).

    R6-A3 / ACR6-03 + SHAREDID-293 (owner decision 2, 2026-10-20): `scope_verified` is True ONLY when the server stores read-back proof
    of the row's current scope (`scope_is_proven`: a complete FRESH read after the write matched the doors, the validity, the timing and
    the active flag - `scope_proven` - and the stored digest equals the scope now; any scope change invalidates it, legacy rows carry
    none). Then `doors_state` is `verified_central`: WisKey's CENTRAL record, never a claim that a station applied it. An active grant
    with no push outstanding and no current proof is `accepted` (WisKey's central record accepted the write; not re-read)."""
    state = g["state"]
    needs_push = bool(g.get("needs_push"))
    accepted = state == "active" and not needs_push
    verified = accepted and scope_is_proven(g)
    pending = state in ("approved", "provisioning", "unknown") or (state == "active" and needs_push)
    return {"needs_push": needs_push, "pending_sync": pending, "scope_verified": verified,
            # WKV2B-295: only on a grant that finished through a strip; None otherwise
            "revoke_proof": g.get("revoke_proof") if state in FINAL else None,
            "scope_verified_at": g.get("scope_proof_at") if verified else None,
            "doors_state": "verified_central" if verified else "accepted" if accepted else "desired" if state in LIVE else None}


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
    if g.get("code_mode") == "single_entry":  # EXTERNALBUILD-297: a one-time code says so (fixed, code-owned sentence)
        text = text.replace(TEMPLATE_PERSONAL[lang], SINGLE_ENTRY_SENTENCE[lang] + " " + TEMPLATE_PERSONAL[lang], 1)
    from .privacy_org import identity

    org = identity(conn).organization
    if org:  # PRIVORG-291: the organisation, not the product, is the sender; unset = today's text
        text = text.replace(CODE_MESSAGE_SENDER, org, 1)
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

def _purpose_ref(g: dict[str, Any]) -> str:
    """The reference a users/create carries in `access_purpose` (`Arx external access <ref>`) and the journal keeps, so a person whose
    create answer was lost can be recognised later (ids only)."""
    return f"{g['source_kind']}:{(g.get('source_ref') or g['id'])[:12]}"


_EVIDENCE_REF = re.compile(r"[A-Za-z0-9][A-Za-z0-9:._/-]{7,127}")


def _attach_recovered_person(db: Database, grant_id: str, op_id: str, wiskey_person_id: str, *, actor: Principal, evidence_ref: str,
                             request_id: str | None = None) -> dict[str, Any]:
    """R5-A1 hook, R6-A5 / ACR6-04 hardened. PRIVATE service helper: no HTTP route, no caller in the product - a reviewed recovery
    workflow must exist before anything calls it. The WisKey person that ONE lost users/create (`op_id`) of THIS grant produced has been
    identified from separately obtained evidence; the helper records that claim, it does not establish it.

    R8-A2 (ARX-N04): the helper itself now also refuses an actor whose Arx user row is missing or inactive (`actor_inactive`) and audits
    the exact original create beside the proof decision. Still the FUTURE CALLER's duty before any route exists: an authenticated,
    interactive, ACTIVE session of that administrator; VALIDATION of the evidence contents for this one operation (a well-formed
    reference is not proof); an audited refusal path. No caller exists (tests/test_wiskey_final3_281.py pins that per exact path).

    Required: `actor` an authenticated Arx system administrator (`is_system_admin`; never a system / contact actor), `evidence_ref` a
    per-operation reference to the audited evidence (ticket, signed export, readback capture id - 8..128 safe characters), `op_id` the
    create record being reconciled. Refused: the grant's create is not unresolved, the subject already has a link, the person is
    already linked, `op_id` is not an unresolved create of this grant, or MORE THAN ONE create of this grant is unresolved (several lost
    creates are never collapsed onto one person without individual proof - each needs its own evidence, which this helper cannot tell
    apart). Never inferred from presence: nothing here reads WisKey, and `users/access_state` (ACR5-01) carries no purpose /
    correlation / ownership evidence, so it can never feed this helper. Only `op_id` is reconciled; the person becomes the grant's
    Arx-created link and the worker's normal revoke (read, strip, readback, sync status) runs on it. Nothing is written to WisKey here."""
    if not ia.valid_id(wiskey_person_id):
        raise _invalid("wiskey_person_id", "format")
    if not isinstance(evidence_ref, str) or not _EVIDENCE_REF.fullmatch(evidence_ref):
        raise _invalid("evidence_ref", "format")
    if not isinstance(op_id, str) or not op_id:
        raise _invalid("op_id", "format")
    if not isinstance(actor, Principal) or not actor.user_id:
        raise ApiError(403, "not_system_admin", "רק מנהל מערכת יכול לשייך אדם ששוחזר.")
    with db.connection(label="access_grants.recover_create") as conn:
        if not is_system_admin(conn, actor.user_id):
            raise ApiError(403, "not_system_admin", "רק מנהל מערכת יכול לשייך אדם ששוחזר.")
        # R6-A5 / R8-A2 (ARX-N04): `is_system_admin` leaves the user's active flag to its caller - checked HERE too, so no future caller
        # can forget it: a disabled (or unknown) Arx user is refused even with a live system_admin binding. This does not authenticate a
        # session (the future route's job) and does not validate the evidence contents (still the caller's duty, see the docstring).
        user = conn.execute("SELECT active FROM users WHERE id = ?", (actor.user_id,)).fetchone()
        if user is None or not user["active"]:
            raise ApiError(403, "actor_inactive", "רק מנהל מערכת פעיל יכול לשייך אדם ששוחזר.")
        g = grant_row(conn, grant_id)
        if g is None:
            raise _not_found()
        ops = wj.create_ops(conn, grant_id=grant_id)
        verdict, _ = wj.create_verdict(ops)
        if verdict != "unresolved" or link_of_grant(conn, g) is not None:
            raise _conflict("access_create_not_unresolved", "אין לגישה זו יצירת אדם שתוצאתה לא ידועה.")
        open_ops = [op for op in ops if op["state"] in wj.OPEN]
        if len(open_ops) != 1:
            raise _conflict("access_create_ambiguous", "לגישה זו כמה יצירות שתוצאתן לא ידועה; כל אחת דורשת ראיה נפרדת.")
        if open_ops[0]["id"] != op_id:
            raise _conflict("access_create_not_unresolved", "רשומת היצירה אינה של גישה זו או שאינה פתוחה.")
        if conn.execute("SELECT 1 FROM access_person_links WHERE wiskey_person_id = ?", (wiskey_person_id,)).fetchone():
            raise _conflict("access_link_exists", "האדם במערכת הכניסה כבר מקושר לאיש קשר אחר.")
        at = now().timestamp()
        n = conn.execute("UPDATE intercom_write_ops SET state = 'reconciled', result_ref = ?, reconciled_ts = ? WHERE id = ? AND state IN ('dispatched', 'unknown')",
                         (wiskey_person_id, at, op_id)).rowcount
        if n != 1:
            raise _conflict("access_create_not_unresolved", "רשומת היצירה אינה פתוחה.")
        link = Worker._link_recovered(conn, g, wiskey_person_id)
        # R8-A2 (ARX-N04): the audit row carries the proof decision AND the exact original create it settles (ids, references and
        # timestamps of that journal row as it was before the reconcile - never a person field)
        original = open_ops[0]
        _audit(conn, actor, "access.grant.create_recovered", grant_id, request_id=request_id, wiskey_person_id=wiskey_person_id, link_id=link["id"],
               op_id=op_id, evidence_ref=evidence_ref, proof_decision="attached_on_recorded_evidence",
               original_create={"state": original["state"], "code": original.get("code"), "purpose_ref": original.get("purpose_ref"),
                                "subject_kind": original.get("subject_kind"), "subject_id": original.get("subject_id"),
                                "boot_id": original.get("boot_id"), "started_ts": original.get("started_ts"), "finished_ts": original.get("finished_ts")})
    WORKER.wake()
    return link


def push_scope(engine: Engine, person: EnginePerson, scope: "Scope", *, pin: Any = KEEP) -> EnginePerson:
    """One revision-checked users/update that makes the person's stations the grant's. Dropping a station from the door map would NOT revoke it
    (WisKey-stated, source-derived, NOT_RUN), so the COMPLETE permission_overrides replacement (drop = "deny", add = "allow", other personal
    entries kept) travels with it. A restricted projection refuses (`not_sent`) rather than send a replacement built on a partial view."""
    overrides = plan_overrides(person, scope.doors)
    return engine.apply(person.id, person.revision, doors=scope.doors, valid_from=scope.valid_from, valid_until=scope.valid_until, timing=scope.timing,
                        active=True, pin=pin, overrides=overrides)


def _relays(doors: dict[str, list[int]] | None) -> dict[str, list[int]]:
    return {sid: sorted(set(relays)) for sid, relays in (doors or {}).items() if relays}


def scope_proven(readback: EnginePerson, scope: Scope) -> bool:
    """F2 / R4-04: does a FRESH read prove that WisKey's central record carries exactly the grant's scope? Only when the door map is KNOWN
    (fail closed: a record without a readable, complete door map - `doors_known` False or absent - proves nothing), the person is active,
    the enabled stations and relays equal the grant's door map (no station, no relay beyond it), no group adds doors, and the validity
    window AND the timing schedule are the grant's own. It proves the central DESIRED state only, never that a station applied it
    (`EnginePerson.stations_synced` is recorded beside it, not required). The person is one Arx created (F3, R4-05), so any door beyond
    the scope is a door a write failed to remove."""
    if getattr(readback, "doors_known", False) is not True:
        return False
    return (readback.active is True and _relays(readback.doors) == _relays(scope.doors) and not readback.group_ids
            and readback.valid_from == scope.valid_from and readback.valid_until == scope.valid_until
            and _policy_is(readback, scope.timing))


_NO_POLICY = object()


def _policy_is(readback: EnginePerson, timing: dict[str, Any] | None) -> bool:
    """R5-A2: the readback carries EXACTLY the timing policy a grant push writes - `{mode: "ha", schedule, bindings: {}}`, or no policy at
    all when the grant has no timing. A native-mode policy or bindings with the same schedule is not the requested policy. The schedule
    is compared exactly (no Arx-side normalisation: WisKey's `normalize_user` (ACR5-02) is accepted for integration review as a frozen
    v1 read contract but is NOT built or called by Arx), so an equivalent but
    reordered schedule fails closed. A record without the policy field (`timing_policy` absent) proves nothing."""
    held = getattr(readback, "timing_policy", _NO_POLICY)
    return held is not _NO_POLICY and held == requested_policy(timing or None)


narrowing_proven = scope_proven  # the GRANTS-FIX280 name


def readback_covers(readback: EnginePerson, scope: Scope) -> bool:
    """R4-03: the read shows a KNOWN, active record whose scope is the same as or BROADER than `scope` (every door, the whole window, the
    timing) - the earlier scope of a grant narrowed while its outcome was unknown. It never proves `scope`; the caller only uses it to
    activate a grant that still has `needs_push` set, so the narrowing is written and proven next."""
    if getattr(readback, "doors_known", False) is not True or readback.active is not True or readback.group_ids:
        return False
    if not readback.valid_from or not readback.valid_until:
        return False
    if not _policy_is(readback, readback.timing):  # R5-A2: only a policy of the form Arx writes (mode "ha", no bindings) can be compared
        return False
    held = Scope(_relays(readback.doors), readback.valid_from, readback.valid_until, readback.timing, scope.credential)
    return covers(held, scope)


class Worker:
    """Runs the engine side of every grant transition: re-decision, reconciliation, window end, provisioning, unknown outcomes,
    revocation, code delivery, link clean-up, retention. `run_once` is deterministic (tests call it); the background thread calls
    it on every wake and at least every TICK_S."""

    TICK_S = 15.0
    STOP_WAIT_S = 5.0  # stop(): how long the thread and the running pass are waited for (the lease is kept past it, R4-06)

    def __init__(self) -> None:
        self._wake = threading.Event()
        self._stop = threading.Event()
        self._thread: threading.Thread | None = None
        self._db: Database | None = None
        self._lock = threading.Lock()  # mutual exclusion INSIDE one process; across processes: the lease below
        self._lease: Any = None  # the open lock file while this process owns the worker
        self._lease_path: str | None = None
        self._drop_when_idle = False  # stop() could not wait the running pass out: that pass gives the lease up when it ends
        self.standby = False  # another process owns the worker (start() could not take the lease)

    def wake(self) -> None:
        self._wake.set()

    # ---- F4 (review M6) / R4-06: one process only, and never two writers

    @staticmethod
    def lock_path(db: Database) -> str:
        """The ONE canonical lock path: beside the database file (by its resolved path), `.<db name>.access-grants.lock` - a hidden name
        that no `<db name>*` sweep (backups, the leak scans) picks up while it is locked."""
        real = os.path.realpath(str(db.path))
        return os.path.join(os.path.dirname(real), f".{os.path.basename(real)}.access-grants.lock")

    def _take_lease(self, db: Database) -> bool:
        """The worker's in-process mutex does not reach another process, so the add-on runs ONE API process (the written precondition
        "workers=1": `python -m smplwise` hands uvicorn an app object, which cannot fork workers). This makes it a checked fact: an
        exclusive, non-blocking OS lock on `<db>.access-grants.lock`, held while this process owns the worker. Every pass needs it
        (`_require_lease`); a process that cannot take it runs no pass at all (no provisioning, no strip, no code). Called under
        `self._lock` (or before the thread exists)."""
        path = self.lock_path(db)
        if self._lease is not None:
            if self._lease_path == path:
                return True
            self._drop_lease()  # another database in the same process (tests only; the add-on has one): never two leases at once
        try:
            fh = open(path, "a+b")  # noqa: SIM115 - held open while this process owns the worker
        except OSError:
            log.error("access grants: the single-process lock file cannot be opened; the worker stays off")
            return False
        try:
            if os.name == "nt":
                import msvcrt

                fh.seek(0)
                msvcrt.locking(fh.fileno(), msvcrt.LK_NBLCK, 1)
            else:
                import fcntl

                fcntl.flock(fh.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
        except OSError:
            fh.close()
            log.error("access grants: another process holds the worker lock (more than one API process?) - this process runs no grant pass")
            return False
        self._lease, self._lease_path = fh, path
        return True

    def _drop_lease(self) -> None:
        fh, self._lease, self._lease_path = self._lease, None, None
        if fh is None:
            return
        try:
            if os.name == "nt":
                import msvcrt

                fh.seek(0)
                msvcrt.locking(fh.fileno(), msvcrt.LK_UNLCK, 1)
            else:
                import fcntl

                fcntl.flock(fh.fileno(), fcntl.LOCK_UN)
        except OSError:
            pass
        finally:
            fh.close()

    def holds_lease(self) -> bool:
        return self._lease is not None

    def _require_lease(self, db: Database) -> bool:
        """R4-06: EVERY entry point (`run_once`, `run_grant`) runs only while this process holds the lease - taken here when it is free
        (a standby process takes over once the owner is gone; the start-up rewrite runs then, by the new owner only)."""
        if not self._take_lease(db):
            return False
        if self.standby:
            self.standby = False
            self.on_startup(db)
        return True

    def _after_pass(self) -> None:
        if self._drop_when_idle:  # R4-06: the pass stop() could not wait for has ended - only now may another process take over
            self._drop_when_idle = False
            self._drop_lease()

    def start(self, db: Database, settings: Any) -> None:
        global _SETTINGS
        _SETTINGS = settings
        self._db = db
        self._drop_when_idle = False
        with self._lock:
            owner = self._take_lease(db)
            self.standby = not owner
            if owner:
                self.on_startup(db)  # fail closed: the start-up rewrite is the owning process's alone
        if self._thread is None or not self._thread.is_alive():
            self._stop.clear()
            self._thread = threading.Thread(target=self._loop, name="arx-access-grants", daemon=True)
            self._thread.start()

    def stop(self) -> None:
        """R4-06: the lease is given up only when no pass of this process can still be writing. A pass that outlives the bounded wait
        (a WisKey call can take up to the transport limit) keeps the lease and drops it itself when it ends - a bounded shutdown never
        hands the worker to another process while this one may still write."""
        self._stop.set()
        self._wake.set()
        thread = self._thread
        if thread is not None and thread.is_alive() and thread is not threading.current_thread():
            thread.join(timeout=self.STOP_WAIT_S)
        if self._lock.acquire(timeout=self.STOP_WAIT_S):
            try:
                self._drop_lease()
            finally:
                self._lock.release()
            return
        self._drop_when_idle = True
        if self._lock.acquire(blocking=False):  # the pass ended between the wait and the flag
            try:
                self._after_pass()
            finally:
                self._lock.release()
        else:
            log.warning("access grants: a worker pass is still running at shutdown - the worker lock is kept until it ends")

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
            try:
                if not self._require_lease(db):  # F4 / R4-06: another process owns the worker
                    return summary
                if _REDECIDE.is_set():
                    _REDECIDE.clear()
                    summary["redecided"] = self.redecide(db)
                elif self.redecide_pending(db):  # K7: an interrupted re-decision resumes after its cursor
                    summary["redecided"] = self.redecide(db, resume=True)
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
                self._screen_passes(db)
                return summary
            finally:
                self._after_pass()

    @staticmethod
    def _screen_passes(db: Database) -> None:
        """SHAREDID-293: the external-access screen's own passes, after the grant work of the pass (services/access_external.py) - the
        read-back verification of active grants (owner decision 2), the watch for a person confirmed gone that reappears (3), the name
        sync (5) and the weekly digest (4). Each fails closed on its own: a failure never stops the grant work."""
        from . import access_denied, access_entries
        from . import access_external as ax

        # EXTERNALBUILD-297: the entry watch (one-time codes end after the first entry; visitor entries are recorded) and the visitor bookkeeping
        for step in (ax.verify_pass, ax.watch_gone, ax.name_pass, ax.digest_due, access_denied.denied_pass, access_entries.entry_pass,
                     access_entries.visitor_pass):
            try:
                step(db)
            except Exception:  # noqa: BLE001
                log.warning("access grants: the %s pass failed", getattr(step, "__name__", "screen"))

    def run_grant(self, db: Database, grant_id: str) -> None:
        with self._lock:
            try:
                if not self._require_lease(db):  # F4 / R4-06: the owning process picks the grant up on its next pass
                    return
                self._process(db, grant_id)
                self.finish_unlinks(db)
            finally:
                self._after_pass()

    def _process(self, db: Database, grant_id: str) -> str | None:
        with db.connection(mode="read", label="access_grants.worker.read") as conn:
            g = grant_row(conn, grant_id)
            feature = enabled(conn)
        if g is None:
            return None
        from .access_service_writer import attributed

        # EXTERNALBUILD-297 (X5): a direct service write made for this grant carries the grant and its approver's decision
        with attributed(g, "revoke" if g["state"] == "revoking" else None):
            return self._process_row(db, g, grant_id, feature)

    def _process_row(self, db: Database, g: dict[str, Any], grant_id: str, feature: bool) -> str | None:
        try:
            if g["state"] == "revoking":
                # R5-A1: only a verified strip counts as `revoked`; a grant closed because provably nothing was created is not one
                return "revoked" if self.strip(db, g) == "revoked" else None
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
                from . import access_visitors

                if access_visitors.awaiting_confirmation(db, g["id"]):
                    return None  # CR-VISITOR105 D8: no code before the visitor confirmed his own number
                if due is not None and due <= now():
                    return "codes" if self.deliver_code(db, g) else None
        except Exception:  # noqa: BLE001 - fail closed per grant; never the PIN in a log
            log.warning("access grants: processing %s failed (%s)", grant_id[:8], "error")
        return None

    # ---- re-decision (CR 3.5, owner answer 5; fail closed)

    # K7 (TRIAGE 2026-10-18): the re-decision of EVERY decided grant used to run inside ONE write transaction - every grant x
    # station x permission authorisation held SQLite's single write lock (seconds on a large installation, every other writer
    # queued behind it). It now runs in bounded chunks, ordered by grant id: each chunk is DECIDED in a read transaction (WAL
    # readers never block the writer) and APPLIED in a short write transaction of its own, which also records the resume cursor.
    # Results are those of the single transaction (tests/test_k7_redecide_chunked.py proves it against a verbatim copy of the old
    # code); docs/changes/K7-REDECIDE-CHUNKED.md has the full argument.
    REDECIDE_CHUNK = 200
    REDECIDE_CURSOR_KEY = "access.external.redecide_cursor"  # {"rev": n, "after": "<last grant id applied>"} - runtime state

    def redecide_pending(self, db: Database) -> bool:
        """An interrupted re-decision (a crash or an error between two chunks) left its cursor: the next pass resumes it."""
        try:
            with db.connection(mode="read", label="access_grants.redecide.cursor") as conn:
                return get_setting(conn, self.REDECIDE_CURSOR_KEY) is not None
        except sqlite3.Error:
            return False

    def redecide(self, db: Database, *, resume: bool = False) -> int:
        """Re-decide every decided grant against its approver's CURRENT permissions (CR 3.5, owner answer 5; fail closed).
        `resume`: continue after the cursor an interrupted pass left - a grant at or before the cursor that is not yet stamped
        with the current permission revision (a bump since the interruption, a restored row) is re-decided all the same."""
        skip_upto: str | None = None
        if resume:
            with db.connection(mode="read", label="access_grants.redecide.cursor") as conn:
                skip_upto = _cursor_after(get_setting(conn, self.REDECIDE_CURSOR_KEY))
        n = 0
        after = ""  # keyset: the last grant id of the previous chunk
        committed = False  # a chunk of THIS pass committed (and with it a cursor)
        marks = ",".join("?" * len(DECIDED))
        try:
            while True:
                # 1. decide: a read transaction (one consistent snapshot per chunk), no write lock
                with db.connection(mode="read", label="access_grants.redecide.decide") as conn:
                    rev = permission_revision(conn)
                    # `+state`: walk the primary key (id > ? ORDER BY id) - the state index would sort every decided row per chunk
                    sql = f"SELECT * FROM access_grants WHERE +state IN ({marks}) AND id > ?"
                    args: list[Any] = [*DECIDED, after]
                    if skip_upto is not None:
                        sql += " AND (id > ? OR COALESCE(approval_revision, 0) < ?)"
                        args += [skip_upto, rev]
                    rows = [dict(r) for r in conn.execute(sql + " ORDER BY id LIMIT ?", (*args, self.REDECIDE_CHUNK)).fetchall()]
                    plan = [(g, self._decide_safe(conn, g), _approver_print(conn, g)) for g in rows]
                if not rows:  # nothing (more) to re-decide: a cursor still standing (an exactly full last chunk, a resume) is spent
                    self._drop_cursor(db)
                    break
                last = len(rows) < self.REDECIDE_CHUNK
                after = rows[-1]["id"]
                _between_decide_and_apply(rows)
                # 2. apply: a short write transaction, verified against the snapshot the decisions were made on
                with db.connection(label="access_grants.redecide.apply") as conn:
                    self._apply_chunk(conn, plan, rev)
                    if last:
                        conn.execute("DELETE FROM settings WHERE key = ?", (self.REDECIDE_CURSOR_KEY,))
                    else:
                        set_setting(conn, self.REDECIDE_CURSOR_KEY, json.dumps({"rev": rev, "after": after}))
                committed = True
                n += len(rows)
                if last:
                    break
        except BaseException:
            # fail closed: with no cursor standing (nothing committed and nothing to resume) another pass is asked for at once;
            # with one standing, the next pass resumes after it (`redecide_pending`)
            if not committed and not resume:
                _REDECIDE.set()
            raise
        return n

    def _drop_cursor(self, db: Database) -> None:
        with db.connection(mode="read", label="access_grants.redecide.cursor") as conn:
            if get_setting(conn, self.REDECIDE_CURSOR_KEY) is None:
                return
        with db.connection(label="access_grants.redecide.cursor") as conn:
            conn.execute("DELETE FROM settings WHERE key = ?", (self.REDECIDE_CURSOR_KEY,))

    def _apply_chunk(self, conn: sqlite3.Connection, plan: list[tuple[dict[str, Any], tuple[str, Any], tuple[Any, ...]]], rev: int) -> None:
        """Apply one chunk's decisions. A decision is applied as made only when nothing it rests on moved since the snapshot:
        the permission revision (every binding / role / group change bumps it - the rbac cache relies on the same rule), the
        grant row (its revision) and the approver's own row and the local-approver switch (not revision-guarded). Anything else
        is re-decided HERE, inside this write transaction, exactly as the single transaction did - bounded by the chunk size."""
        fresh_rev = permission_revision(conn)
        for g, decision, printed in plan:
            cur = grant_row(conn, g["id"])
            if cur is None or cur["state"] not in DECIDED:
                continue  # the grant left the decided states meanwhile (revoked, ended): nothing to re-decide
            try:
                if fresh_rev != rev or cur["revision"] != g["revision"] or _approver_print(conn, cur) != printed:
                    self._redecide_one(conn, cur, fresh_rev)
                else:
                    self._apply_decision(conn, cur, decision, rev)
            except Exception:  # noqa: BLE001 - an error while re-deciding is a revoke
                mark_revoking(conn, cur, "approver_lost_authority")

    def _decide_safe(self, conn: sqlite3.Connection, g: dict[str, Any]) -> tuple[str, Any]:
        try:
            return self._decide(conn, g)
        except Exception:  # noqa: BLE001 - an error while re-deciding is a revoke
            return ("revoke", None)

    @staticmethod
    def _decide(conn: sqlite3.Connection, g: dict[str, Any]) -> tuple[str, Any]:
        """The re-decision of one grant, reads only: ("revoke", None) | ("narrow", kept doors) | ("keep", None)."""
        approver = g.get("approved_by")
        user = conn.execute("SELECT active, deleted_at FROM users WHERE id = ?", (approver,)).fetchone() if approver else None
        if user is None or not user["active"] or (user["deleted_at"] if "deleted_at" in user.keys() else None):
            return ("revoke", None)
        if str(approver).startswith(LOCAL_ID_PREFIX) and not local_approvers(conn):
            return ("revoke", None)
        p = principal_of(approver)
        doors = json.loads(g["doors_json"] or "{}")
        perms = approve_permissions(g["credential"])
        from . import access_visitors

        envelope = access_visitors.envelope_rule(conn, g)
        if envelope is not None:
            # EXTERNALBUILD-297 (CR-VISITOR105 5.3): a visitor grant the host approved inside the envelope is re-decided against the HOST's
            # invite permission and the visitor-entrance flag of each station (fail closed, like every re-decision)
            perms, allowed = envelope
            kept = {s: r for s, r in doors.items() if s in allowed and not missing_on(conn, p, perms, [s])}
        else:
            kept = {s: r for s, r in doors.items() if not missing_on(conn, p, perms, [s])}
        if not kept:
            return ("revoke", None)
        if kept != doors:  # R9 within the re-decision: narrowed to the stations the approver still holds
            return ("narrow", kept)
        return ("keep", None)

    @staticmethod
    def _apply_decision(conn: sqlite3.Connection, g: dict[str, Any], decision: tuple[str, Any], rev: int) -> None:
        kind, kept = decision
        if kind == "revoke":
            mark_revoking(conn, g, "approver_lost_authority")
            return
        if kind == "narrow":
            _touch(conn, g["id"], {"doors_json": json.dumps(kept, sort_keys=True), "needs_push": 1 if g["state"] in ("active", "unknown") else g["needs_push"],
                                   "approval_revision": rev})
            _audit(conn, None, "access.grant.amend", g["id"], reason="station_changed", kind="narrowed", stations=stations_of(kept))
            return
        _touch(conn, g["id"], {"approval_revision": rev})

    def _redecide_one(self, conn: sqlite3.Connection, g: dict[str, Any], rev: int) -> None:
        """Decide and apply in the caller's write transaction (the fallback of `_apply_chunk`)."""
        self._apply_decision(conn, g, self._decide(conn, g), rev)

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

    def _ensure_link(self, db: Database, engine: Engine, g: dict[str, Any], op_id: str | None = None) -> dict[str, Any]:
        """The grant's link; with none yet, ONE users/create. R5-A1: the create is journaled - its intent (`op_id`, recorded with the
        `pushed` mark) is moved to `dispatched` and committed BEFORE the call, its outcome after; the link and the `ok` outcome (with the
        returned person id) are one transaction. A create whose answer is lost stays `unknown` in the journal: never re-sent blindly."""
        with db.connection(mode="read", label="access_grants.link.read") as conn:
            link = link_of_grant(conn, g)
            contact = contact_row(conn, g["subject_id"])
            approver = conn.execute("SELECT display_name FROM users WHERE id = ?", (g.get("approved_by"),)).fetchone()
        if link is None:
            category = "contractor" if (contact or {}).get("vendor_id") else "visitor"
            ref = _purpose_ref(g)
            with db.connection(label="access_grants.link.dispatch") as conn:
                if op_id is None:
                    op_id = wj.create_intent(conn, g["id"], g["subject_kind"], g["subject_id"], ref)
                wj.create_dispatched(conn, op_id)
            sent_name = ((contact or {}).get("display_name") or "אורח")[:32]
            try:
                # employee_no is omitted: WisKey generates one (nine digits) and returns it - stored as returned, never sent on update
                person = engine.create_person(display_name=sent_name, category=category,
                                              responsible_person=((approver["display_name"] if approver else "") or "Arx")[:64],
                                              access_purpose=f"Arx external access {ref}")
            except EngineError as exc:
                outcome = {"not_sent": "not_sent", "not_permitted": "not_sent", "unknown": "unknown"}.get(exc.kind, "refused")
                with db.connection(label="access_grants.link.create_failed") as conn:
                    wj.create_finished(conn, op_id, outcome, code=exc.code or exc.kind)
                raise
            except Exception:
                with db.connection(label="access_grants.link.create_failed") as conn:
                    wj.create_finished(conn, op_id, "unknown", code="error")
                raise
            with db.connection(label="access_grants.link.create") as conn:
                lid = uuid.uuid4().hex
                conn.execute("""INSERT INTO access_person_links(id, subject_kind, subject_id, wiskey_person_id, origin, employee_no, linked_by, linked_at, last_pushed_rev)
                                VALUES (?, ?, ?, ?, 'created_from_arx', ?, ?, ?, ?)""",
                             (lid, g["subject_kind"], g["subject_id"], person.id, person.employee_no, g.get("approved_by") or "system", iso(now()), person.revision))
                # SHAREDID-293 (owner decision 5): the digests of the name Arx wrote and WisKey answered with (never the name)
                from .access_external import name_digest

                conn.execute("UPDATE access_person_links SET name_pushed = ?, name_seen = ?, name_checked_at = ? WHERE id = ?",
                             (name_digest(sent_name), name_digest(person.display_name), iso(now()), lid))
                wj.create_finished(conn, op_id, "ok", person_id=person.id)
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
            # F3 (review H4): never provision onto a WisKey person Arx did not create (a link matched after the approval, say)
            if not person_is_ours(link_of_grant(conn, g)):
                cur = grant_row(conn, g["id"])
                if cur is not None and cur["revision"] == g["revision"] and cur["state"] == "approved":
                    self._refuse_not_ours(conn, cur, int(g["pushed"]))
                return False
            op_id = None
            if link_of_grant(conn, g) is None:
                # R5-A1: a users/create for this person may have landed earlier without a link (its answer lost). Never a second create
                # for the subject: a recovered target is linked; an unresolved one holds the provisioning (the managers are alerted
                # through the grant that owns it).
                verdict, recovered = wj.create_verdict(wj.create_ops(conn, subject=(g["subject_kind"], g["subject_id"])))
                if verdict == "unresolved":
                    _touch(conn, g["id"], {"provision_after": iso(now() + timedelta(seconds=PROVISION_RETRY_S))}, expect_revision=g["revision"])
                    _audit(conn, None, "access.grant.provision_held", g["id"], reason="create_unresolved")
                    return False
                if verdict == "created" and recovered:
                    self._link_recovered(conn, g, recovered)
            if not _touch(conn, g["id"], {"state": "provisioning", "pushed": 1}, expect_revision=g["revision"]):
                return False
            if link_of_grant(conn, g) is None:
                op_id = wj.create_intent(conn, g["id"], g["subject_kind"], g["subject_id"], _purpose_ref(g))  # R5-A1: durable, before dispatch
            _audit(conn, None, "access.grant.provision", g["id"], attempt=int(g["provision_attempts"]) + 1)
        engine = engine_for(db)
        scope = Scope.of_row(g)
        try:
            link = self._ensure_link(db, engine, g, op_id)
            if not person_is_ours(link):  # a match that landed between the check above and here: nothing was written yet
                with db.connection(label="access_grants.provision.not_ours") as conn:
                    cur = grant_row(conn, g["id"])
                    if cur is not None and cur["state"] == "provisioning":
                        self._refuse_not_ours(conn, cur, int(g["pushed"]))
                return False
            person = engine.get_person(link["wiskey_person_id"])
            try:
                person = push_scope(engine, person, scope, pin=None)
            except EngineError as exc:
                if exc.kind != "revision_conflict":
                    raise
                person = engine.get_person(link["wiskey_person_id"])  # E3: re-read, apply once more
                person = push_scope(engine, person, scope, pin=None)
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

    @staticmethod
    def _link_recovered(conn: sqlite3.Connection, g: dict[str, Any], person_id: str) -> dict[str, Any]:
        """R5-A1: a users/create whose answer (or whose link) was lost, and whose person id is now known (the create's own recorded
        answer, or - R6-A5 - a target an administrator attached with per-operation evidence through the private
        `_attach_recovered_person`; never one inferred from presence): the link Arx should have written. Inside the caller's
        transaction; an existing link of the subject is returned unchanged."""
        link = link_of_subject(conn, g["subject_kind"], g["subject_id"])
        if link is None:
            lid = uuid.uuid4().hex
            conn.execute("""INSERT INTO access_person_links(id, subject_kind, subject_id, wiskey_person_id, origin, employee_no, linked_by, linked_at, last_pushed_rev)
                            VALUES (?, ?, ?, ?, 'created_from_arx', NULL, ?, ?, NULL)""",
                         (lid, g["subject_kind"], g["subject_id"], person_id, g.get("approved_by") or "system", iso(now())))
            _audit(conn, None, "access.person_link.create", lid, resource_type="access_person_link", wiskey_person_id=person_id, grant_id=g["id"], recovered=True)
            link = link_row(conn, lid)
        conn.execute("UPDATE access_grants SET link_id = ? WHERE id = ?", (link["id"], g["id"]))
        return link

    @staticmethod
    def _refuse_not_ours(conn: sqlite3.Connection, cur: dict[str, Any], pushed_before: int) -> None:
        """F3: the grant fails (the managers are alerted) without any write to the matched person. `pushed` goes back to its value
        before this attempt, so a grant that never reached WisKey ends at once and the person is never stripped."""
        _touch(conn, cur["id"], {"pushed": pushed_before})
        mark_revoking(conn, grant_row(conn, cur["id"]), "failed")
        _audit(conn, None, "access.grant.fail", cur["id"], reason="person_not_ours", link_id=cur.get("link_id"))

    @staticmethod
    def _owned_link(db: Database, g: dict[str, Any], phase: str) -> tuple[dict[str, Any] | None, bool]:
        """R4-05: the link a worker write acts on, read once and bound to that write: (link, ours). A link that is not Arx-created is never
        written through - the grant's authority is withdrawn in Arx (`failed`; a grant that may have reached WisKey stays `revoking`, its
        strip refused below, so the managers are alerted each hour to reconcile it by hand) and nothing goes to the matched person."""
        with db.connection(mode="read", label=f"access_grants.{phase}.link") as conn:
            link = link_of_grant(conn, g)
        if person_is_ours(link):
            return link, True
        with db.connection(label=f"access_grants.{phase}.not_ours") as conn:
            cur = grant_row(conn, g["id"])
            if cur is not None and cur["state"] in LIVE and cur["state"] != "revoking":
                mark_revoking(conn, cur, "failed")
                _audit(conn, None, "access.grant.fail", g["id"], reason="person_not_ours", link_id=(link or {}).get("id"), phase=phase)
        return link, False

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
                # WisKey round 3: `user_not_found` is not proof of absence (a person outside the service user's scope may answer the
                # same, and an earlier write may have landed) - never `revoked` on it: the revoke path keeps reading (fail closed)
                if current.get("link_id"):
                    conn.execute("UPDATE access_person_links SET state = 'wiskey_missing', revision = revision + 1 WHERE id = ?", (current["link_id"],))
                    _audit(conn, None, "access.person_link.missing", current["link_id"], resource_type="access_person_link")
                _touch(conn, g["id"], {"provision_attempts": attempts})
                mark_revoking(conn, grant_row(conn, g["id"]), "wiskey_missing")
            elif exc.kind in ("not_sent", "not_permitted") and attempts < PROVISION_ATTEMPTS:
                # E1: back to approved; the scheduler tries again after 5 minutes, for one hour. A configuration write with a revision
                # check - never a physical command. Nothing may have landed (not_sent): `pushed` stays as it was before.
                _touch(conn, g["id"], {"state": "approved", "provision_attempts": attempts, "provision_after": iso(now() + timedelta(seconds=PROVISION_RETRY_S)),
                                       "pushed": g["pushed"]})
                _audit(conn, None, "access.grant.fail", g["id"], reason=exc.kind, code=exc.code, attempt=attempts, retry=True)
            else:
                fields: dict[str, Any] = {"provision_attempts": attempts}
                if link_of_grant(conn, current) is None and wj.create_verdict(wj.create_ops(conn, grant_id=g["id"]))[0] == "none":
                    # R5-A1: the journal proves no users/create of this grant landed (refused / not sent): nothing reached WisKey
                    fields["pushed"] = g["pushed"]
                _touch(conn, g["id"], fields)
                fresh = grant_row(conn, g["id"])
                mark_revoking(conn, fresh, "failed")
                _audit(conn, None, "access.grant.fail", g["id"], reason=exc.kind, code=exc.code, attempt=attempts)
        return False

    def resolve_unknown(self, db: Database, g: dict[str, Any]) -> str | None:
        """E2: an unknown outcome is never retried blindly - a fresh read decides: the grant's door map and validity in WisKey ->
        `active`; otherwise `failed` (and the person stripped).

        R4-03: the read is compared with the scope the row held when the pass read it, and the verdict is written only by a
        compare-and-set on that row revision. A request that narrowed the still-unknown row while the read was out moved the revision:
        nothing is decided, the grant stays `unknown` and the next pass reads again against the row's CURRENT scope. A read that shows
        the earlier, broader scope of a row narrowed since (`needs_push` set) activates the grant with `needs_push` kept, so the
        narrowing is written and proven next (`push_narrowing`); anything else fails the grant (fail closed). The verdict needs the
        COMPLETE scope (R4-04: door map known, timing included) and a person Arx created (R4-05)."""
        link, ours = self._owned_link(db, g, "unknown")
        if not ours:
            return None
        scope = Scope.of_row(g)
        if link is None:
            # R5-A1: no link - the create's journal decides. A create that answered (or a target recovered for it) is linked and read like
            # any other person; otherwise the authority is withdrawn in Arx (`revoking`), and the strip keeps the grant UNRESOLVED (never
            # `failed` / `revoked`, hourly alerts) while the create may have landed somewhere nobody can name.
            with db.connection(label="access_grants.unknown.nolink") as conn:
                cur = grant_row(conn, g["id"])
                if cur is None or cur["revision"] != g["revision"] or cur["state"] != "unknown":
                    return None
                verdict, recovered = wj.create_verdict(wj.create_ops(conn, grant_id=g["id"]))
                if verdict == "created" and recovered:
                    link = self._link_recovered(conn, cur, recovered)
                else:
                    if verdict in ("unresolved", "no_record"):
                        _audit(conn, None, "access.grant.unknown", g["id"], reason="create_unresolved")
                    mark_revoking(conn, cur, "failed")
                    return None
        try:
            person = engine_for(db).get_person(link["wiskey_person_id"])
        except EngineError as exc:
            if exc.kind == "not_found":
                with db.connection(label="access_grants.unknown.missing") as conn:
                    mark_revoking(conn, grant_row(conn, g["id"]), "wiskey_missing")
            return None  # not reachable now (or an earlier write is still out): the next pass reads again
        if not person.doors_known:
            return None  # a restricted projection decides nothing (never read as "no doors"): the next pass reads again
        with db.connection(label="access_grants.unknown.decide") as conn:
            cur = grant_row(conn, g["id"])
            if cur is None or cur["state"] != "unknown":
                return None
            if cur["revision"] != g["revision"]:  # R4-03: the row moved while the read was out - decide on a fresh read next pass
                _audit(conn, None, "access.grant.unknown", g["id"], reason="scope_moved")
                return None
            if scope_proven(person, scope):
                # SHAREDID-293 (owner decision 2): this fresh read proved the complete scope - stored as the read-back proof
                _touch(conn, g["id"], {"state": "active", "wiskey_revision": person.revision, "needs_push": 0, **proof_fields(scope)}, expect_revision=g["revision"])
                _audit(conn, None, "access.grant.activate", g["id"], wiskey_person_id=person.id, after="unknown", stations_synced=person.stations_synced)
                return "provisioned"
            if cur["needs_push"] and readback_covers(person, scope):
                _touch(conn, g["id"], {"state": "active", "wiskey_revision": person.revision, "needs_push": 1}, expect_revision=g["revision"])
                _audit(conn, None, "access.grant.activate", g["id"], wiskey_person_id=person.id, after="unknown", narrowing_pending=True)
                WORKER.wake()
                return "provisioned"
            mark_revoking(conn, cur, "failed")
        return None

    def push_narrowing(self, db: Database, g: dict[str, Any]) -> None:
        """Push the row's scope after a narrowing (or an approved amendment). F2 / R4-04: `pushed` only on a FRESH read that proves the
        complete scope; `needs_push` cleared only by a compare-and-set on the row revision this pass read (a narrowing that landed while
        the push was out keeps it set: the next pass pushes the row's CURRENT scope). A readback that failed on an earlier pass is
        reconciled first: when the read before the write already proves the scope, nothing is written again. R4-05: never through a
        link Arx did not create."""
        link, ours = self._owned_link(db, g, "narrow")
        if not ours or link is None:
            return
        scope = Scope.of_row(g)
        engine = engine_for(db)
        try:
            person = engine.get_person(link["wiskey_person_id"])
        except EngineError as exc:
            if exc.kind == "not_found":
                with db.connection(label="access_grants.narrow.missing") as conn:
                    mark_revoking(conn, grant_row(conn, g["id"]), "wiskey_missing")
            return  # not readable now (or an earlier write is still out): `needs_push` stays set
        if scope_proven(person, scope):
            readback, written = person, False  # R4-04: the scope is already there (a write whose readback failed landed): no second write
        else:
            try:
                push_scope(engine, person, scope)
            except EngineError as exc:
                if exc.kind in ("unknown", "not_found"):
                    with db.connection(label="access_grants.narrow.unknown") as conn:  # cannot prove the narrowing landed: revoke (fail closed)
                        mark_revoking(conn, grant_row(conn, g["id"]), "failed" if exc.kind == "unknown" else "wiskey_missing")
                return  # not_sent / refused / revision_conflict: nothing landed - `needs_push` stays, the next pass reads and pushes again
            # F2 (review H3 ii/iii): WisKey's answer to the write is not a readback; a per-station merge would keep a dropped station
            try:
                readback = engine.get_person(link["wiskey_person_id"])
            except EngineError as exc:
                if exc.kind == "not_found":
                    with db.connection(label="access_grants.narrow.missing") as conn:
                        mark_revoking(conn, grant_row(conn, g["id"]), "wiskey_missing")
                return  # not readable now: `needs_push` stays set - the next pass reads FIRST and writes only if the scope is not there
            written = True
            if not scope_proven(readback, scope):
                with db.connection(label="access_grants.narrow.unproven") as conn:
                    cur = grant_row(conn, g["id"])
                    if cur is not None:
                        _audit(conn, None, "access.grant.amend", g["id"], kind="push_unproven", stations=stations_of(scope.doors),
                               doors_known=bool(getattr(readback, "doors_known", False)))
                        mark_revoking(conn, cur, "station_changed")
                return
        with db.connection(label="access_grants.narrow.done") as conn:
            # F2 (review H3 i): compare-and-set on the revision the scan read
            # SHAREDID-293 (owner decision 2): the fresh readback proved the complete scope - stored as the read-back proof
            if _touch(conn, g["id"], {"needs_push": 0, "wiskey_revision": readback.revision, **proof_fields(scope)}, expect_revision=g["revision"]):
                _audit(conn, None, "access.grant.amend", g["id"], kind="pushed", stations=stations_of(scope.doors), readback=True, written=written,
                       central_only=True, stations_synced=readback.stations_synced)
            else:
                _audit(conn, None, "access.grant.amend", g["id"], kind="push_superseded", stations=stations_of(scope.doors))

    # ---- revocation (at least once)

    @staticmethod
    def _revoked(person: EnginePerson) -> bool:
        """The readback shows the revoked state: door map KNOWN and empty, no group, no personal override (overrides KNOWN), inactive, PIN
        known cleared. A restricted projection (doors_known / overrides_known / pin_known False) is UNKNOWN and never counts. R11-I1-03:
        the one central predicate `access_grant_engine.central_revoked`."""
        return central_revoked(person)

    @staticmethod
    def revoke_backoff_s(attempts: int) -> int:
        return min(REVOKE_BACKOFF_BASE_S * (2 ** max(int(attempts) - 1, 0)), REVOKE_BACKOFF_CAP_S)

    @staticmethod
    def _needs_revoke_write(person: EnginePerson, attempts: int) -> bool:
        """Only a readback that still shows something to remove justifies another users/update (each one bumps the revision). When the
        projection is restricted (door map unknown) and the person is already inactive, a write that was sent before is not repeated: the
        retries are reads only."""
        if person.active or (person.pin_known and person.pin_configured):
            return True
        if person.doors_known:
            return bool(person.doors or person.group_ids or person.overrides)
        return int(attempts) == 0

    def strip(self, db: Database, g: dict[str, Any]) -> str | None:
        """`revoked` (a verified strip - the only outcome counted and audited as a revocation), `closed` (R5-A1: the create journal proves
        no WisKey person was ever created for this grant), or None (not done yet: retried with backoff, the managers alerted hourly)."""
        attempts = int(g.get("revoke_attempts") or 0)
        if attempts > 0:  # F1: no hammering - wait out the backoff (no WisKey call at all)
            last = parse_iso(g.get("updated_at"))
            if last is not None and (now() - last).total_seconds() < self.revoke_backoff_s(attempts):
                return None
        with db.connection(mode="read", label="access_grants.strip.read") as conn:  # (R5-A1: the no-link case is decided below)
            link = link_of_grant(conn, g)
        if link is None:
            # R5-A1: a grant that may have reached WisKey (`pushed`) but has no link: a users/create may have landed with its answer lost.
            # `link is None` is NOT "ours and empty": the journal decides - a create that answered (or a recovered target) is linked and
            # stripped like any other; one that provably never landed closes the grant WITHOUT a revocation claim; anything else
            # (unresolved, or no record at all) stays `revoking` with no WisKey call - never a blind recreate, never `revoked`.
            with db.connection(label="access_grants.strip.nolink") as conn:
                cur = grant_row(conn, g["id"])
                if cur is None or cur["state"] != "revoking":
                    return None
                verdict, recovered = wj.create_verdict(wj.create_ops(conn, grant_id=g["id"]))
                if verdict == "created" and recovered:
                    link = self._link_recovered(conn, cur, recovered)
                elif verdict == "none":
                    state = final_state_for(cur["end_reason"] or "manual")
                    _touch(conn, g["id"], {"state": state, "ended_at": iso(now()), "needs_push": 0})
                    _audit(conn, None, "access.grant.closed", g["id"], reason=cur["end_reason"], outcome="no_person_created", state=state)
                    return "closed"
                else:
                    conn.execute("UPDATE access_grants SET revoke_attempts = revoke_attempts + 1, updated_at = ? WHERE id = ?", (iso(now()), g["id"]))
                    _audit(conn, None, "access.grant.revoke_retry", g["id"], code="create_unresolved", verdict=verdict)
                    return None
        if not person_is_ours(link):
            # R4-05: a revoke-all would wipe the matched person's WisKey-native access (its PIN, staff doors). Arx's authority is already
            # withdrawn; the WisKey side is NOT written: the grant stays `revoking` (no WisKey call at all, backoff) and the managers are
            # alerted each hour to reconcile that person by hand. No automatic "done" - an acknowledgement path is an open design item.
            with db.connection(label="access_grants.strip.not_ours") as conn:
                conn.execute("UPDATE access_grants SET revoke_attempts = revoke_attempts + 1, updated_at = ? WHERE id = ?", (iso(now()), g["id"]))
                _audit(conn, None, "access.grant.revoke_retry", g["id"], code="person_not_ours", link_id=(link or {}).get("id"))
            return None
        engine = engine_for(db)
        outcome = "stripped"
        proof = REVOKE_VERIFIED
        if link is not None:  # always, since R5-A1 (a missing link is decided above): never a "done" without the readback
            try:
                person = engine.get_person(link["wiskey_person_id"])
                if self._needs_revoke_write(person, attempts):
                    # ONE revision-checked users/update (group_ids [], permission_overrides {}, active false, pin null, sync_now). Its answer
                    # is the public person object - central DESIRED state, not proof that a station dropped the person.
                    try:
                        engine.strip(person.id, person.revision)
                    except EngineError as exc:
                        if exc.kind != "revision_conflict":
                            raise
                        person = engine.get_person(link["wiskey_person_id"])
                        engine.strip(person.id, person.revision)
                # never "revoked" from the update result alone: a fresh central readback must show the expected state (door map KNOWN and
                # empty, inactive, PIN known cleared) AND the central sync status must show no pending revocation. After a revoke there is no
                # revision row, so an empty `assignments` map by itself proves nothing about the stations. R11-I1-03: the status is asked
                # for the revision of THIS readback (a mismatch is UNKNOWN), and its False counts only beside the central predicate.
                person = engine.get_person(link["wiskey_person_id"])
                # GRANTS3-295 (X5, CR 4.5 "card removal at grant end is part of R1"): WisKey's revoke-all keeps the cards, so every card
                # of the person Arx created is removed by its id (cards/remove), then read again
                person = self._remove_cards(engine, person)
                if not self._revoked(person):
                    raise EngineError("unknown", "revoke_unverified")
                if not revocation_proven(person, engine.revocation_pending(person.id, person.revision)):
                    # WKV2B-295 (owner decision 2026-10-21): only a v2 answer proves a revoke. A v1 answer in the clean-looking shape, beside
                    # Arx's own central predicate on the same readback, ends the grant as "revoked, not verified by the other side"
                    # (`revoke_proof` = unverified); anything else stays `revoking`.
                    evidence = getattr(engine, "revocation_evidence", None)
                    if evidence is None or evidence(person.id, person.revision) != EVIDENCE_UNVERIFIED:
                        raise EngineError("unknown", "revoke_unverified")
                    proof = REVOKE_UNVERIFIED
                    outcome = "stripped_unverified"
                if g["credential"] == "card" and not (person.cards_known and not person.card_ids):
                    raise EngineError("unknown", "card_unverified")  # a card grant ends only on a readback that shows no card
            except EngineError as exc:
                # WisKey round 3: `user_not_found` (users/get or the write) is NOT proof that the person and their station grants are
                # gone - it may mean "outside the service user's scope", and a delete leaves a tombstone whose station removals are
                # still pending. So it never ends the grant: it stays `revoking` (retried with backoff, the managers alerted) like
                # any other unverified revoke; the link is marked so that the other grants on it are withdrawn as well.
                with db.connection(label="access_grants.strip.retry") as conn:
                    conn.execute("UPDATE access_grants SET revoke_attempts = revoke_attempts + 1, updated_at = ? WHERE id = ?", (iso(now()), g["id"]))
                    if exc.kind == "not_found" and link["state"] != "wiskey_missing":
                        conn.execute("UPDATE access_person_links SET state = 'wiskey_missing', revision = revision + 1 WHERE id = ?", (link["id"],))
                        _audit(conn, None, "access.person_link.missing", link["id"], resource_type="access_person_link")
                    _audit(conn, None, "access.grant.revoke_retry", g["id"], code=exc.kind)
                return None
        with db.connection(label="access_grants.strip.done") as conn:
            cur = grant_row(conn, g["id"])
            if cur is None or cur["state"] != "revoking":
                return None
            state = final_state_for(cur["end_reason"] or "manual")
            done: dict[str, Any] = {"state": state, "ended_at": iso(now()), "needs_push": 0, "revoke_proof": proof}
            if cur["credential"] == "card":
                done["card_state"] = "removed"
            _touch(conn, g["id"], done)
            _audit(conn, None, "access.grant.end" if state == "ended" else "access.grant.revoked", g["id"], reason=cur["end_reason"], outcome=outcome, proof=proof)
        return "revoked"

    @staticmethod
    def _remove_cards(engine: Engine, person: EnginePerson) -> EnginePerson:
        """GRANTS3-295 (X5): remove every card of a person Arx created (the caller checked the origin), one revision-checked cards/remove
        per card id (a conflict re-reads once), and answer a FRESH readback. An unreadable card list is left to the caller's verdict."""
        if not person.cards_known or not person.card_ids:
            return person
        for card_id in person.card_ids:
            try:
                person = engine.card_remove(person.id, person.revision, card_id)
            except EngineError as exc:
                if exc.kind != "revision_conflict":
                    raise
                person = engine.get_person(person.id)
                if card_id in person.card_ids:
                    person = engine.card_remove(person.id, person.revision, card_id)
        return engine.get_person(person.id)

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
            link = link_row(conn, cur.get("link_id"))
            if not person_is_ours(link):
                # R4-05: no PIN is ever written to a WisKey person Arx did not create; the grant's authority is withdrawn in Arx
                mark_revoking(conn, cur, "failed")
                _audit(conn, None, "access.grant.code_not_delivered", cur["id"], reason="person_not_ours")
                _audit(conn, None, "access.grant.fail", cur["id"], reason="person_not_ours", link_id=link.get("id"), phase="code")
                return False
            _touch(conn, cur["id"], {"code_state": "queued"})  # CR 4.4: a restart from here on leaves it not_delivered
            _audit(conn, None, "access.grant.code_queued", cur["id"], job=secrets.token_hex(6))
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
            if not person.doors_known:
                self._code_end(db, g, "not_delivered", "door_map_unknown")
                return False
            if not scope_proven(person, scope):  # R4-04: the complete scope (doors, validity, timing, active), not only the door map
                self._code_end(db, g, "not_delivered", "door_map_changed")
                return False
            for _attempt in range(PIN_ATTEMPTS):
                pin = engine.pin_generate(person.id)
                try:
                    person = push_scope(engine, person, scope, pin=pin)
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
                "SELECT * FROM access_grants WHERE (alerted_at IS NULL AND ((state = 'revoking' AND revoking_since <= ?) OR code_state IN ('not_delivered', 'unknown') "
                "OR state IN ('failed', 'unknown'))) OR (state = 'revoking' AND alerted_at <= ?)",
                (iso(at - timedelta(seconds=REVOKE_ALERT_S)), iso(at - timedelta(seconds=REVOKE_REALERT_S)))).fetchall()
            for r in rows:
                kind = "revoke_pending" if r["state"] == "revoking" else ("code_" + r["code_state"]) if r["code_state"] in ("not_delivered", "unknown") else r["state"]
                again = 0
                if r["state"] == "revoking" and r["alerted_at"]:  # F1: a new hourly alert, not a dedupe of the first one
                    since = parse_iso(r["revoking_since"]) or at
                    again = max(int((at - since).total_seconds() // REVOKE_REALERT_S), 1)
                _notify(conn, "access.grant_attention", r["id"], kind, repeat=again)
                conn.execute("UPDATE access_grants SET alerted_at = ? WHERE id = ?", (iso(at), r["id"]))
            cutoff = iso(at - timedelta(days=RETENTION_DAYS))
            conn.execute("DELETE FROM access_grants WHERE state IN ('ended', 'revoked', 'refused', 'failed') AND COALESCE(ended_at, updated_at) < ?", (cutoff,))
            conn.execute("DELETE FROM access_code_sends WHERE at < ?", (iso(at - timedelta(days=2)),))


WORKER = Worker()


def _notify(conn: sqlite3.Connection, source: str, subject_id: str, kind: str, repeat: int = 0) -> None:
    """A content-free notification to the managers (no name, no number, no door). Never raises."""
    try:
        from . import notify
        from .access_external import screen_href

        # SHAREDID-293: the link opens the external-access screen where the owner placed it (owner decision 6)
        notify.emit(conn, notify.Signal(source=source, subject_kind="system", subject_id=subject_id[:32], dedupe_key=f"{source}:{subject_id[:32]}" + (f":r{repeat}" if repeat else ""),
                                        params={"kind": kind}, link=screen_href(conn, subject_id if len(subject_id) == 32 else None)))
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
    from . import access_entries, access_service_writer  # EXTERNALBUILD-297: the entry watch's fake feed and the service writer

    access_entries.EVENT_SOURCE = None
    access_service_writer.reset_for_tests()
    with WORKER._lock:
        WORKER._drop_lease()
        WORKER._drop_when_idle = False
        WORKER.standby = False
