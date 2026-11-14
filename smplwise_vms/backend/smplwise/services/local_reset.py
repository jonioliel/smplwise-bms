"""USR2 phase 2: self-service password reset by a WhatsApp code, WhatsApp delivery of manager-issued links, and the security
notifications of the Arx-only sign-in (docs/changes/CR-USR2-ARX-ONLY-IDENTITY.md section 8; owner answer Q5 2026-10-16).

Owner answer Q5 (final): BOTH reset modes, chosen PER USER (`auth_local_credentials.reset_mode`):
- `manager_only` (default): every reset is a link a manager issues (`POST identity/local-users/{id}/link`). A non-administrative
  target's link may be delivered by WhatsApp (`via: whatsapp`) to the user's VERIFIED number; an administrative target's link is
  NEVER sent by WhatsApp and is issued only on the local channel (phase 1 rule, unchanged).
- `self_service`: the user asks for a code (`POST auth/local/reset/request {username}`) that goes to their VERIFIED WhatsApp number,
  then sets a new password with it (`POST auth/local/reset/confirm {username, code, password}`). Refused - at the moment of use,
  whatever `reset_mode` says (security review F6) - for a user who holds an administrative permission (rbac.LOCAL_ADMIN_PERMISSIONS)
  NOW: whoever controls the phone number would otherwise take over an administrator.

The verified number: the user's own tickets directory row (`ticket_contacts.user_id`, active, not erased) with a WhatsApp-capable
number confirmed BY THE USER (TKSTAFF1 one-tap confirmation, `phone_confirmed_at`) - and, where the 2.6.3 number verification is
present (`phone_confirmed_via`), confirmed by the user or by a typed code, never by a manager's mark, and counting as confirmed under
that module's own rule. A number changed after the code was sent kills the code (the number is bound into the code's MAC).

Code rules (the tickets code engine's, TKNOTIFOTP): 6 digits from the OS random source; stored only as
HMAC-SHA256(reset key, 'lr' | code id | user id | credential fingerprint | number key | code) - bound to the credential row (a
password set in between kills it) and to the number; valid 10 minutes; single use; one live code per user (a new one ends the old);
5 wrong guesses end it; at most 1 send per 60 s and 5 per day per user, 5 per day per number and 50 per day per installation.
The request ALWAYS answers the same 202 (unknown name, wrong mode, administrator, no verified number, a cap - all alike, and the
send itself happens later on the sender thread, so no answer waits for WhatsApp); every refusal of the confirm is the same 422
`code_invalid`.

Persistence (USR2-P2B, owner decision 2026-10-16 option b; migration 0097, provisional 0102): the live code (its MAC, the number key,
created / expires, attempts used, the consumed flag) is a row of `auth_local_reset_codes`, and every send is a row of
`auth_local_reset_sends` (the cooldown and the three daily caps are counted from it). Both survive a restart; nothing is kept in
memory, so there is nothing to restore at start. The reset key is derived from the messaging key FILE (`k_messaging`,
<data>/secrets/messaging_key: never in the database, never in a backup), so the database alone cannot brute-force a code or a
number; when that file is unreadable a per-process key is used (codes then end with the process - the safe direction). Single use
is one `UPDATE ... WHERE consumed = 0` inside the confirm's write transaction (rowcount 1 wins). Dead rows are deleted by the
janitor (an hour after expiry; sends after 24 h); triggers of the migration delete a user's code on a password / reset-mode change,
a disable or a delete, and every code when the identity switch changes. Neither table is a backup table. The per-address limits
of the two routes are the shared sign-in limiter's (`ha_user_auth.LIMITER`), already written behind to `block_counters`.

Delivery: the WhatsApp infrastructure of the tickets module / NOTIFWA, reused through its public functions - the messaging account
use `identity.local` (Settings › ערוץ ההודעות; inherits the tickets messages account when not set), the adapter
(tickets.channel_whatsapp.WhatsAppChannel), the pacing gate over the shared send ledger (kind `code` for a code, `message` for a link)
and the transport (notify_whatsapp.transport, faked in tests). The message is a FIXED code-owned text (he / en / ar / ru by the
contact's language; ar and ru need a native review), never a template an administrator can edit, never held by send hours. The
digits, the link token and the number exist only in the sender's memory: no outbox row, ledger row, code row, audit row or log
line holds any of them (the ledger and the code rows keep keyed hashes of the number, the audit the user id and the outcome).

Nothing here is reachable while `security.local_identity` is off (the routes refuse first) - behaviour with the switch off is
unchanged.
"""
from __future__ import annotations

import datetime as dt
import hashlib
import hmac
import heapq
import itertools
import logging
import os
import secrets
import threading
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Callable

from ..errors import ApiError
from . import local_identity as li

log = logging.getLogger("smplwise.local_reset")

USE_KEY = "identity.local"
MODULE = "identity"
CODE_TTL_S = 600.0
CODE_ATTEMPTS = 5
COOLDOWN_S = 60.0
PER_USER_DAY = 5
PER_NUMBER_DAY = 5
PER_INSTALLATION_DAY = 50
DAY_S = 86400.0
CODE_RETAIN_S = 3600.0   # a dead code row (expired / consumed / five wrong guesses) is deleted within an hour of its expiry (<= 24 h)
REQUEST_LIMITS: list[tuple[float, int]] = [(60.0, 5), (3600.0, 20)]   # per client address (the request route)
CONFIRM_LIMITS: list[tuple[float, int]] = [(60.0, 10), (3600.0, 40)]  # per client address (the confirm route)
HOLD_CODE_S = 180.0      # a code that cannot leave within 3 minutes is dropped (it lives 10)
HOLD_LINK_S = 900.0
DOWN_RECHECK_S = 30.0
QUEUE_MAX = 200

CODE_INVALID_HE = "הקוד שגוי או שפג תוקפו. אפשר לבקש קוד חדש."
REQUEST_ACCEPTED_HE = "אם החשבון מאפשר איפוס עצמי, נשלח קוד לוואטסאפ המאומת שלו. הקוד בתוקף 10 דקות."
NO_NUMBER_HE = "למשתמש אין מספר וואטסאפ מאומת. הוא מאשר את המספר בעצמו ב״החשבון שלי״, או שתמסור לו את הקישור בעצמך."
CHANNEL_HE = "ערוץ הוואטסאפ אינו זמין: לא נבחר חשבון לשימוש ״איפוס סיסמה של משתמשי Arx״ או שהחשבון מנותק."
PUBLIC_URL_HE = "כתובת הגישה מרחוק אינה ידועה. הגדר אותה (security.local_public_url) או הפק את הקישור מכניסה מרחוק."
BUSY_HE = "השליחה עמוסה כרגע. נסה שוב בעוד דקה."

# The fixed texts (code-owned; never editable). No username, no name, no address. `{code}` six digits, `{url}` the link, `{hours}`.
# ar / ru: starter texts - they need a native speaker's review before they are relied on (recorded in the CR).
TEXTS: dict[str, dict[str, str]] = {
    "he": {
        "code": "SmplWise Arx: קוד לאיפוס הסיסמה שלך הוא {code}. הקוד בתוקף 10 דקות ולשימוש אחד. אם לא ביקשת איפוס - התעלם מההודעה ואל תמסור את הקוד לאיש.",
        "reset": "SmplWise Arx: מנהל המערכת הפיק עבורך קישור לאיפוס הסיסמה: {url} הקישור לשימוש אחד ובתוקף {hours} שעות. אל תעביר אותו לאיש.",
        "first_login": "SmplWise Arx: מנהל המערכת פתח עבורך חשבון. לבחירת סיסמה: {url} הקישור לשימוש אחד ובתוקף {hours} שעות. אל תעביר אותו לאיש.",
    },
    "en": {
        "code": "SmplWise Arx: your password reset code is {code}. It is valid for 10 minutes and can be used once. If you did not ask for a reset, ignore this message and never share the code.",
        "reset": "SmplWise Arx: your administrator issued a password reset link for you: {url} It can be used once and is valid for {hours} hours. Do not forward it.",
        "first_login": "SmplWise Arx: your administrator opened an account for you. Choose a password here: {url} The link can be used once and is valid for {hours} hours. Do not forward it.",
    },
    "ar": {
        "code": "SmplWise Arx: رمز إعادة تعيين كلمة المرور الخاص بك هو {code}. الرمز صالح لمدة 10 دقائق ولمرة واحدة. إذا لم تطلب إعادة التعيين فتجاهل هذه الرسالة ولا تشارك الرمز مع أحد.",
        "reset": "SmplWise Arx: أصدر مدير النظام رابطًا لإعادة تعيين كلمة المرور الخاصة بك: {url} الرابط لمرة واحدة وصالح لمدة {hours} ساعة. لا تُعِد توجيهه لأحد.",
        "first_login": "SmplWise Arx: فتح مدير النظام حسابًا لك. لاختيار كلمة المرور: {url} الرابط لمرة واحدة وصالح لمدة {hours} ساعة. لا تُعِد توجيهه لأحد.",
    },
    "ru": {
        "code": "SmplWise Arx: ваш код для сброса пароля: {code}. Код действует 10 минут и только один раз. Если вы не запрашивали сброс, проигнорируйте это сообщение и никому не сообщайте код.",
        "reset": "SmplWise Arx: администратор создал для вас ссылку для сброса пароля: {url} Ссылка одноразовая и действует {hours} ч. Не пересылайте её.",
        "first_login": "SmplWise Arx: администратор открыл для вас учётную запись. Выберите пароль: {url} Ссылка одноразовая и действует {hours} ч. Не пересылайте её.",
    },
}


def text_for(kind: str, lang: str, **values: Any) -> str:
    table = TEXTS.get(lang) or TEXTS["he"]
    return table[kind].format(**values)


# ---------------------------------------------------------------- the messaging account use (Settings › ערוץ ההודעות)

def _uses(conn: Any) -> tuple[Any, ...]:
    from . import messaging_accounts as ma

    return (ma.UseSpec(USE_KEY, MODULE, "איפוס סיסמה וקישורי כניסה של משתמשי Arx", inherits="tickets.messages", active=lambda: li.enabled(conn)),)


def _register() -> None:
    from . import messaging_runtime as mr

    mr.register_uses(_uses)
    mr.register_label_renderer(MODULE, lambda conn, text: text, lambda conn: "משתמשי Arx")


_register()


# ---------------------------------------------------------------- the verified number

@dataclass(frozen=True)
class Number:
    digits: str = field(repr=False)
    lang: str = "he"


def verified_number(conn: Any, user_id: str) -> Number | None:
    """The user's WhatsApp number when it counts as VERIFIED (see the module docstring); None otherwise. Never logged."""
    from .tickets.channel import LANGS, phone_digits

    try:
        row = conn.execute("SELECT * FROM ticket_contacts WHERE user_id = ? AND erased_at IS NULL AND active = 1 ORDER BY updated_at DESC LIMIT 1",
                           (user_id,)).fetchone()
    except Exception:  # noqa: BLE001 - an installation without the tickets tables: no number
        return None
    if row is None or not row["phone_confirmed_at"]:
        return None
    digits = phone_digits(row["phone_e164"] or "")
    if digits is None:
        return None
    keys = set(row.keys())
    if "phone_confirmed_via" in keys:  # 2.6.3 number verification present: never a manager's mark; its own rule applies
        if row["phone_confirmed_via"] not in ("user", "code"):
            return None
        try:
            from .tickets import phone_verify  # type: ignore[attr-defined]

            if not phone_verify.confirmed(conn, dict(row)):
                return None
        except ImportError:
            pass
    lang = row["lang"] if "lang" in keys and row["lang"] in LANGS else "he"
    return Number(digits, lang)


def channel_ready(db_or_conn: Any) -> bool:
    """A WhatsApp account is mapped for the use and can send now."""
    from . import messaging_runtime as mr

    try:
        svc = mr.accounts_service(db_or_conn) if hasattr(db_or_conn, "connection") else mr.service(db_or_conn)
        ref = svc.resolve(USE_KEY)
        return bool(ref is not None and ref.value and svc.status(ref.key).sendable)
    except Exception:  # noqa: BLE001 - fail closed
        return False


# ---------------------------------------------------------------- codes and caps (persistent: migration 0097)

_PROCESS_KEY = os.urandom(32)  # only when the messaging key file is unreadable: codes then end with the process (fail closed)
_KEY_LABEL = b"smplwise-arx/usr2/local-reset/v1"


def reset_key(db_or_path: Any) -> bytes:
    """The key of the code MACs and the number keys: HMAC(k_messaging, label) - a domain-separated sub-key of the messaging key
    FILE, so it survives a restart, never sits in the database and never travels in a backup. Never logged."""
    from . import messaging_runtime as mr

    data_dir = Path(db_or_path.path).parent if hasattr(db_or_path, "path") else Path(db_or_path)
    try:
        base = mr.messaging_key(data_dir)
    except Exception:  # noqa: BLE001 - a damaged key file: a per-process key (never a constant, never a number)
        log.error("messaging key unreadable; local reset codes use a process key")
        base = None
    return hmac.new(base or _PROCESS_KEY, _KEY_LABEL, hashlib.sha256).digest()


def _number_key(key: bytes, digits: str) -> str:
    return hmac.new(key, ("num:" + digits).encode("ascii", "replace"), hashlib.sha256).hexdigest()[:32]


def cred_fingerprint(password_hash: str | None, set_at: str | None) -> str:
    return hashlib.sha256(f"{password_hash or ''}|{set_at or ''}".encode("utf-8", "replace")).hexdigest()


def _mac(key: bytes, cid: str, user_id: str, cred_fp: str, number_key: str, code: str) -> str:
    return hmac.new(key, f"lr|{cid}|{user_id}|{cred_fp}|{number_key}|{code}".encode("utf-8", "replace"), hashlib.sha256).hexdigest()


def _cap_reason(conn: Any, user_id: str, number_key: str, now: float) -> str | None:
    """Inside the request's write transaction: why another code may not be sent now (None = it may). Counted from the send rows
    of the last 24 h, so the cooldown and the caps survive a restart."""
    since = now - DAY_S
    last, mine = conn.execute("SELECT MAX(sent_at), COUNT(*) FROM auth_local_reset_sends WHERE user_id = ? AND sent_at > ?", (user_id, since)).fetchone()
    if last is not None and now - float(last) < COOLDOWN_S:
        return "cooldown"
    if mine >= PER_USER_DAY:
        return "cap_user"
    if conn.execute("SELECT COUNT(*) FROM auth_local_reset_sends WHERE number_key = ? AND sent_at > ?", (number_key, since)).fetchone()[0] >= PER_NUMBER_DAY:
        return "cap_number"
    if conn.execute("SELECT COUNT(*) FROM auth_local_reset_sends WHERE sent_at > ?", (since,)).fetchone()[0] >= PER_INSTALLATION_DAY:
        return "cap_installation"
    return None


def kill_codes(conn: Any, user_id: str, code_id: str | None = None) -> int:
    """Delete the user's code row (only that code when `code_id` is given). Runs in the caller's transaction."""
    if code_id is None:
        return conn.execute("DELETE FROM auth_local_reset_codes WHERE user_id = ?", (user_id,)).rowcount
    return conn.execute("DELETE FROM auth_local_reset_codes WHERE user_id = ? AND code_id = ?", (user_id, code_id)).rowcount


_LIVE_SQL = "SELECT 1 FROM auth_local_reset_codes WHERE user_id = ? AND consumed = 0 AND attempts < ? AND expires_at > ?"


def live_code(db: Any, user_id: str, code_id: str | None = None) -> bool:
    """The user holds a usable code (that very code when `code_id` is given)."""
    sql, args = _LIVE_SQL, [user_id, CODE_ATTEMPTS, time.time()]
    if code_id is not None:
        sql, args = sql + " AND code_id = ?", args + [code_id]
    try:
        with db.connection(mode="read", label="local reset live code") as conn:
            return conn.execute(sql, args).fetchone() is not None
    except Exception:  # noqa: BLE001 - fail closed: a code we cannot see is never sent
        return False


def janitor(db: Any, now: float | None = None) -> int:
    """main.janitor_tick: code rows an hour past their expiry (dead ones included - a consumed or exhausted row expires like any
    other) and send rows past the 24-hour window. A read first, so a quiet installation takes no write lock. Never raises."""
    now = time.time() if now is None else now
    try:
        with db.connection(mode="read", label="local reset janitor read") as conn:
            if conn.execute("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'auth_local_reset_codes'").fetchone() is None:
                return 0
            due = conn.execute("SELECT 1 FROM auth_local_reset_codes WHERE expires_at <= ? LIMIT 1", (now - CODE_RETAIN_S,)).fetchone() \
                or conn.execute("SELECT 1 FROM auth_local_reset_sends WHERE sent_at <= ? LIMIT 1", (now - DAY_S,)).fetchone()
        if not due:
            return 0
        with db.connection(label="local reset janitor") as conn:
            n = conn.execute("DELETE FROM auth_local_reset_codes WHERE expires_at <= ?", (now - CODE_RETAIN_S,)).rowcount
            n += conn.execute("DELETE FROM auth_local_reset_sends WHERE sent_at <= ?", (now - DAY_S,)).rowcount
            return n
    except Exception:  # noqa: BLE001 - housekeeping never raises
        log.warning("local reset janitor failed")
        return 0


def parse_code(raw: Any) -> str | None:
    if not isinstance(raw, str):
        return None
    value = raw.strip().replace(" ", "").replace("-", "")
    return value if len(value) == 6 and value.isascii() and value.isdigit() else None


# ---------------------------------------------------------------- the eligibility rule (request AND confirm)

_USER_SQL = """SELECT u.id, u.username, u.display_name, u.active, u.deleted_at, c.password_hash, c.set_at, c.reset_mode
               FROM users u JOIN auth_local_credentials c ON c.user_id = u.id
               WHERE u.source = 'local' AND lower(u.username) = ? AND u.deleted_at IS NULL"""


def _refusal(conn: Any, user: Any) -> str | None:
    """Why self-service reset is not available to this user NOW (None = it is). Checked at the request and again at the confirm."""
    if user is None:
        return "unknown_user"
    if not user["active"]:
        return "inactive"
    if not user["password_hash"]:
        return "no_password"  # a first login is a manager's link, never a code
    if user["reset_mode"] != "self_service":
        return "manager_only"
    if li.holds_admin(conn, user["id"]):  # security review F6: the permission held now, whatever reset_mode says
        return "admin_target"
    return None


# ---------------------------------------------------------------- 1. the request (public; always the same answer)

def request_code(db: Any, conn_like: Any, username: str, request_id: str | None) -> None:
    """Blocking. Decides, and for an eligible user queues the code message; returns nothing either way (the route's answer is fixed)."""
    from .ha_user_auth import REFUSAL_AUDITS, mask_address, request_meta

    meta = request_meta(conn_like)
    masked = mask_address(meta.get("client_ip", ""))
    uname = li.username_key(username)
    now = time.time()
    with db.connection(label="local reset request") as conn:
        user = conn.execute(_USER_SQL, (uname,)).fetchone() if uname else None
        reason = _refusal(conn, user)
        number = verified_number(conn, user["id"]) if reason is None else None
        if reason is None and number is None:
            reason = "no_verified_number"
        if reason is None and not channel_ready(conn):
            reason = "channel_unavailable"
        code = cid = None
        if reason is None:
            assert number is not None and user is not None
            key = reset_key(db)
            nkey = _number_key(key, number.digits)
            reason = _cap_reason(conn, user["id"], nkey, now)  # BEGIN IMMEDIATE: two parallel requests are counted one after the other
            if reason is None:
                cid = secrets.token_hex(16)
                code = f"{secrets.randbelow(10 ** 6):06d}"
                mac = _mac(key, cid, user["id"], cred_fingerprint(user["password_hash"], user["set_at"]), nkey, code)
                # one live code per user: a new one replaces the old (attempts and the consumed flag start afresh with the new code)
                conn.execute("""INSERT INTO auth_local_reset_codes(user_id, code_id, code_mac, number_key, created_at, expires_at, attempts, consumed)
                                VALUES (?, ?, ?, ?, ?, ?, 0, 0)
                                ON CONFLICT(user_id) DO UPDATE SET code_id = excluded.code_id, code_mac = excluded.code_mac, number_key = excluded.number_key,
                                  created_at = excluded.created_at, expires_at = excluded.expires_at, attempts = 0, consumed = 0""",
                             (user["id"], cid, mac, nkey, now, now + CODE_TTL_S))
                conn.execute("INSERT INTO auth_local_reset_sends(sent_at, user_id, number_key) VALUES (?, ?, ?)", (now, user["id"], nkey))
        if user is None:
            write, suppressed = REFUSAL_AUDITS.admit(f"local_reset_unknown|{meta.get('client_ip', '')}")
            if write:
                li._audit(conn, actor=None, action="auth.local.reset.requested", decision="denied", reason="unknown_user", resource_id="unknown",
                          details={"ip": masked, **({"suppressed_since_last": suppressed} if suppressed else {})}, request_id=request_id)
            return
        if reason is not None:
            li._audit(conn, actor=None, action="auth.local.reset.requested", decision="denied", reason=reason, resource_id=user["id"],
                      details={"ip": masked}, request_id=request_id)
            return
        uid = user["id"]
    # the code row is committed before the job exists, so the sender (another connection) sees it when it checks the code is live
    assert number is not None and code is not None and cid is not None
    queued = sender_for(db).submit(Job(kind="code", user_id=uid, digits=number.digits, text=text_for("code", number.lang, code=code),
                                       ref=cid[:12], hold_s=HOLD_CODE_S, code_id=cid))
    del code
    with db.connection(label="local reset request audit") as conn:
        if not queued:
            kill_codes(conn, uid, cid)
        li._audit(conn, actor=None, action="auth.local.reset.requested", decision="allowed" if queued else "denied", reason=None if queued else "busy",
                  resource_id=uid, details={"ip": masked, **({"code_id": cid[:12]} if queued else {})}, request_id=request_id)


# ---------------------------------------------------------------- 2. the confirm (public; uniform refusals; hashing only on success)

def _invalid() -> ApiError:
    return ApiError(422, "code_invalid", CODE_INVALID_HE)


def confirm(db: Any, settings: Any, conn_like: Any, username: str, presented: Any, password: str, request_id: str | None) -> dict[str, Any]:
    """Blocking (runs in the hashing pool). A correct, live code of an eligible user + a password that passes the policy -> the new
    password; every session and open link of the user ends; NO session is created (the page signs in normally)."""
    from . import local_passwords as lp
    from .ha_user_auth import REFUSAL_AUDITS, mask_address, request_meta

    meta = request_meta(conn_like)
    masked = mask_address(meta.get("client_ip", ""))
    uname = li.username_key(username)
    code = parse_code(presented)
    now = time.time()
    with db.connection(label="local reset confirm") as conn:
        user = conn.execute(_USER_SQL, (uname,)).fetchone() if uname else None

        def deny(reason: str, *, kill: bool = False) -> ApiError:
            # an ApiError commits the transaction (db.connection): the attempt counted / the code deleted here is persistent
            if user is not None:
                if kill:
                    kill_codes(conn, user["id"])
                li._audit(conn, actor=None, action="auth.local.reset.refused", decision="denied", reason=reason, resource_id=user["id"],
                          details={"ip": masked}, request_id=request_id)
            else:
                write, suppressed = REFUSAL_AUDITS.admit(f"local_reset_confirm_unknown|{meta.get('client_ip', '')}")
                if write:
                    li._audit(conn, actor=None, action="auth.local.reset.refused", decision="denied", reason="unknown_user", resource_id="unknown",
                              details={"ip": masked, **({"suppressed_since_last": suppressed} if suppressed else {})}, request_id=request_id)
            return _invalid()

        if user is None:
            raise deny("unknown_user")
        rec = conn.execute("SELECT code_id, code_mac FROM auth_local_reset_codes WHERE user_id = ? AND consumed = 0 AND attempts < ? AND expires_at > ?",
                           (user["id"], CODE_ATTEMPTS, now)).fetchone()
        if rec is None:  # none, expired, consumed or five wrong guesses: all alike
            raise deny("no_code")
        cid = rec["code_id"]
        if code is None:
            raise deny("malformed")
        why = _refusal(conn, user)  # the rule again, at the moment of use (F6: an administrator NOW is refused, whatever reset_mode says)
        if why is not None:
            raise deny(why, kill=True)
        key = reset_key(db)
        number = verified_number(conn, user["id"])
        nkey = _number_key(key, number.digits) if number is not None else "none"
        expected = _mac(key, cid, user["id"], cred_fingerprint(user["password_hash"], user["set_at"]), nkey, code)
        if not hmac.compare_digest(expected, rec["code_mac"]):
            conn.execute("UPDATE auth_local_reset_codes SET attempts = attempts + 1 WHERE user_id = ? AND code_id = ? AND consumed = 0", (user["id"], cid))
            raise deny("invalid")
        reason = lp.check_policy(password, min_length=li.password_min(conn), context=li._context_words(conn, user), data_dir=settings.data_dir)
        if reason is not None:  # the code stays live (the person holds it); the policy answer never echoes the password
            raise ApiError(400, "password_policy", li.POLICY_HE.get(reason, li.POLICY_HE["too_short"]), details={"reason": reason, "min_length": li.password_min(conn)})
        # single use: exactly one confirm consumes the code - one conditional UPDATE in this write transaction (rowcount 1 wins; a
        # parallel confirm waits for the write lock and then finds the row consumed / gone). A failure below rolls the consumption back.
        if conn.execute("UPDATE auth_local_reset_codes SET consumed = 1 WHERE user_id = ? AND code_id = ? AND consumed = 0 AND attempts < ? AND expires_at > ?",
                        (user["id"], cid, CODE_ATTEMPTS, now)).rowcount != 1:
            raise deny("no_code")
        uid = user["id"]
        phc, version = lp.hash_password(password)
        conn.execute("""UPDATE auth_local_credentials SET password_hash = ?, params_version = ?, set_at = ?, set_by = 'self_service', must_change = 0,
                        failed_count = 0, last_failed_at = NULL, delay_until = NULL, updated_at = ? WHERE user_id = ?""",
                     (phc, version, li.iso(now), li.iso(now), uid))
        links = li.invalidate_links(conn, uid)
        ended = li.revoke_user_sessions(conn, uid, "password_changed")
        li.drop_pending_of(uid)
        li._end_phone_credentials(conn, uid, "password_changed", request_id=request_id)  # XSECFOLLOW-297: the phones' device token + push end too
        li.TIERS.acct_clear_name(user["username"])  # the person's own failed tries before they asked for the code end with the reset
        must_enrol = not li.has_factor(conn, uid) and (li.holds_admin(conn, uid) or li.factor_policy_required(conn, uid))  # USR2 phase 4: a passkey counts
        li._audit(conn, actor=None, action="auth.local.reset.completed", decision="allowed", resource_id=uid,
                  details={"code_id": cid[:12], "sessions_ended": ended, "links_invalidated": links, "ip": masked}, request_id=request_id)
        li._audit(conn, actor=None, action="auth.local.password.changed", decision="allowed", resource_id=uid,
                  details={"via": "self_service", "other_sessions_ended": ended}, request_id=request_id)
    if ended:
        li.close_sockets_from_thread()
    return {"must_enrol": must_enrol}


# ---------------------------------------------------------------- 3. a manager's link by WhatsApp (non-administrative targets only)

def public_origin(conn: Any, request: Any) -> str | None:
    """Where a link sent by WhatsApp points: the configured `security.local_public_url` (system administrators set it), else - on
    the remote channel - this request's own host; None when neither is known (an Ingress request knows no public host)."""
    from ..db import get_setting
    from ..remote_channel import is_remote

    configured = normalize_public_url(get_setting(conn, "security.local_public_url", "") or "")
    if configured:
        return configured
    if is_remote(request):
        host = (request.headers.get("host") or "").strip()
        return normalize_public_url(f"https://{host}") if host else None
    return None


def normalize_public_url(value: str) -> str | None:
    """`https://<dns name>[:443]` only - no IP literal, no path, no query, no user part (a link must never point anywhere else)."""
    import ipaddress
    import re
    from urllib.parse import urlsplit

    value = (value or "").strip().rstrip("/")
    if not value:
        return None
    try:
        u = urlsplit(value)
    except ValueError:
        return None
    if u.scheme != "https" or u.username or u.password or u.query or u.fragment or (u.path not in ("", "/")):
        return None
    host = (u.hostname or "").lower()
    try:
        port = u.port
    except ValueError:
        return None
    if port not in (None, 443) or not host or len(host) > 253:
        return None
    try:
        ipaddress.ip_address(host)
        return None
    except ValueError:
        pass
    if not re.fullmatch(r"(?=.{1,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z][a-z0-9-]{0,61}[a-z0-9]", host):
        return None
    return f"https://{host}"


def send_link(db: Any, *, user_id: str, number: Number, url: str, purpose: str, hours: int, ref: str) -> bool:
    """Queue the link message (the token exists only in this job's memory). False when the sender's queue is full."""
    return sender_for(db).submit(Job(kind=purpose, user_id=user_id, digits=number.digits, text=text_for(purpose, number.lang, url=url, hours=hours),
                                     ref=ref, hold_s=HOLD_LINK_S))


# ---------------------------------------------------------------- the sender thread

@dataclass
class Job:
    kind: str                       # code | reset | first_login
    user_id: str
    digits: str = field(repr=False)
    text: str = field(repr=False)
    ref: str = ""                   # the code id / link prefix in the audit (never the code or the token)
    hold_s: float = HOLD_CODE_S
    created: float = field(default_factory=time.monotonic)
    code_id: str = field(default="", repr=False)  # a code job: the code row it carries (a replaced code is never sent)

    @property
    def ledger_kind(self) -> str:
        return "code" if self.kind == "code" else "message"


class Sender:
    def __init__(self, db: Any) -> None:
        from . import messaging_accounts as ma
        from . import messaging_runtime as mr

        self.db = db
        self.gate = ma.PacingGate(mr.DbSendLedger(db))
        self.heap: list[tuple[float, int, Job]] = []
        self.seq = itertools.count()
        self.cv = threading.Condition()
        self.busy = 0
        self.stop_evt = threading.Event()
        self.thread = threading.Thread(target=self._loop, name="arx-local-reset", daemon=True)
        self.thread.start()

    def submit(self, job: Job) -> bool:
        with self.cv:
            if len(self.heap) >= QUEUE_MAX:
                return False
            heapq.heappush(self.heap, (time.monotonic(), next(self.seq), job))
            self.cv.notify_all()
        return True

    def schedule(self, delay: float, job: Job) -> None:
        with self.cv:
            heapq.heappush(self.heap, (time.monotonic() + delay, next(self.seq), job))
            self.cv.notify_all()

    def make_due(self) -> None:
        """Tests: every waiting job is due now."""
        with self.cv:
            self.heap = [(0.0, s, j) for _d, s, j in self.heap]
            heapq.heapify(self.heap)
            self.cv.notify_all()

    def drain(self, timeout: float = 10.0) -> bool:
        """Tests: wait until nothing due is waiting and nothing is running."""
        end = time.monotonic() + timeout
        with self.cv:
            while True:
                due = any(d <= time.monotonic() for d, _s, _j in self.heap)
                if not due and not self.busy:
                    return True
                left = end - time.monotonic()
                if left <= 0:
                    return False
                self.cv.wait(min(0.05, left))

    def pending(self) -> int:
        with self.cv:
            return len(self.heap)

    def _loop(self) -> None:
        while not self.stop_evt.is_set():
            with self.cv:
                while not self.stop_evt.is_set():
                    if self.heap and self.heap[0][0] <= time.monotonic():
                        _d, _s, job = heapq.heappop(self.heap)
                        self.busy += 1
                        break
                    wait = (self.heap[0][0] - time.monotonic()) if self.heap else 1.0
                    self.cv.wait(max(0.01, min(wait, 1.0)))
                else:
                    return
            try:
                self.run(job)
            except Exception:  # noqa: BLE001 - one job never stops the thread (nothing about the job is logged)
                log.warning("local reset delivery failed unexpectedly")
                self._outcome(job, "failed", "error")
            finally:
                with self.cv:
                    self.busy -= 1
                    self.cv.notify_all()

    def _outcome(self, job: Job, outcome: str, reason: str | None, account: str | None = None) -> None:
        li._audit(self.db, actor=None, action="auth.local.delivery", decision="allowed" if outcome == "sent" else "denied", reason=reason,
                  resource_id=job.user_id, details={"kind": job.kind, "ref": job.ref, "outcome": outcome, **({"account": account} if account else {})})

    def run(self, job: Job) -> None:
        from . import messaging_runtime as mr
        from . import notify_whatsapp as nwa
        from .tickets.channel import NOT_SENT, SENT, OutboundMessage, Recipient
        from .tickets.channel_whatsapp import WhatsAppChannel

        if job.kind == "code" and not live_code(self.db, job.user_id, job.code_id or None):
            self._outcome(job, "skipped", "code_ended")  # a newer code, the code used, or five wrong guesses: never send a dead code
            return
        waited = time.monotonic() - job.created
        svc = mr.accounts_service(self.db)
        account = svc.resolve(USE_KEY)
        if account is None or not account.value:
            self._outcome(job, "failed", "channel_unavailable")
            return
        if not svc.status(account.key).sendable:
            if waited + DOWN_RECHECK_S <= job.hold_s:
                self.schedule(DOWN_RECHECK_S, job)
            else:
                self._outcome(job, "failed", "channel_down", account.key)
            return
        rkey = mr.recipient_key(nwa._messaging_key(self.db), job.digits)
        now = dt.datetime.now(dt.timezone.utc)
        decision = self.gate.check(account_key=account.key, pacing=svc.pacing(account.key), recipient_key=rkey, kind=job.ledger_kind, now=now)
        if not decision.allowed:
            wait = max(0.5, (decision.not_before - now).total_seconds())
            if waited + wait <= job.hold_s:
                self.schedule(wait, job)
            else:
                self._outcome(job, "failed", "rate_limited", account.key)
            return
        msg = OutboundMessage(outbox_id=f"usr2-{job.ref}", channel="whatsapp", purpose="auth_" + job.kind, recipient=Recipient(None, phone=job.digits),
                              text=job.text, account=account)
        result = WhatsAppChannel(nwa.transport(), svc).send(msg)
        svc.note_result(account.key, result)
        if result.may_have_left:
            try:
                self.gate.record(account_key=account.key, use_key=USE_KEY, recipient_key=rkey, kind=job.ledger_kind, now=now)
            except Exception:  # noqa: BLE001
                log.warning("local reset ledger row failed")
        if result.outcome == SENT:
            self._outcome(job, "sent", None, account.key)
        elif result.outcome == NOT_SENT and waited + DOWN_RECHECK_S <= job.hold_s:
            self.schedule(DOWN_RECHECK_S, job)
        else:
            self._outcome(job, result.outcome, result.outcome_code or result.outcome, account.key)

    def stop(self) -> None:
        self.stop_evt.set()
        with self.cv:
            self.cv.notify_all()


_senders: dict[int, Sender] = {}
_senders_lock = threading.Lock()


def sender_for(db: Any) -> Sender:
    with _senders_lock:
        s = _senders.get(id(db))
        if s is None or not s.thread.is_alive() or s.db is not db:
            s = _senders[id(db)] = Sender(db)
        return s


# ---------------------------------------------------------------- 4. the security notifications (notification centre, to managers)

NOTIFY_SOURCES = ("security.local_storm", "security.local_account_delayed", "security.local_account_locked")


def notify_managers(db: Any, source: str, subject_id: str, *, dedupe: str | None = None, params: dict[str, Any] | None = None) -> None:
    """One notification-centre signal (services/notify.emit) of a USR2 security event to the managers (the catalogue's `managers`
    rule intersected with visibility of a `system` subject - system.configure). Content-free: no username, no address, no person.
    Never raises (a notice never changes a sign-in answer)."""
    from . import notify

    try:
        with db.connection(label=f"notify {source}") as conn:
            notify.emit(conn, notify.Signal(source=source, subject_kind="system", subject_id=subject_id, dedupe_key=dedupe or f"{source}:{subject_id}",
                                            params=dict(params or {}), link="#/system/access?tab=local"))
    except Exception:  # noqa: BLE001
        log.warning("local identity notification %s failed", source)


# ---------------------------------------------------------------- tests

def reset_for_tests(db: Any = None) -> None:
    """Stops the sender threads (a 'restart' of this module: nothing else lives in memory). With `db`, also empties the code and
    send rows (the caps start afresh)."""
    if db is not None:
        with db.connection(label="local reset tests") as conn:
            conn.execute("DELETE FROM auth_local_reset_codes")
            conn.execute("DELETE FROM auth_local_reset_sends")
    with _senders_lock:
        for s in _senders.values():
            s.stop()
        _senders.clear()


_ = Callable  # typing helper kept for readers
