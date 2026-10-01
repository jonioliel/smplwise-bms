"""Outgoing e-mail (CR-018 section 6.4, NOTIFICATIONS_API.md S4): the `email` channel of the notification pipeline.

An administrator (`notify.manage`) configures ONE SMTP server in the settings section "דואר יוצא" - host, port, security (`starttls` | `tls`
| `none`), an optional login, a from address and up to ten recipient addresses - and the SOURCE POLICIES (`channels.email`) decide which
notifications are mailed (system faults and backups by default). There are no per-user mail preferences, and a recipient address is not a
user: it is an installation-level address the administrator typed (users carry no address in this system).

WHAT A MAIL IS: one plain Hebrew message (text + RTL HTML) with the type, the place, the severity, the time, a fold count and a link into
Arx. No person's name, no snapshot, no camera image, no door action, no token (the link opens the sign-in; the notification itself is
re-checked against the viewer's own scope). The body line of the notification is added only for `system` subjects (components, never
people). Every header is single-line: a CR/LF in an address, a subject or a header value is refused (`MailError("invalid")`), and the
subject built from data is sanitised first.

WHO MAY BE MAILED ABOUT WHAT (scoping): an installation-level address receives a notification only if at least one of that notification's
recipients holds `notify.manage` and still passes visibility (services/notify_visibility, checked at planning and again before every retry),
and never for a PERSONAL subject (`session`, `bulk_job`: another user's sign-in or job). Otherwise the delivery log says `skipped / no_reach`.

THE SECRET: the SMTP password is written only to `<data>/secrets/notify_email` (directory 0700, file 0600, temp file + rename; the same
policy as `<data>/keys/`), is never part of the settings row, an Arx PROJECT backup (services/backup.py archives tables and plan files only), an API
answer, an audit row, a log line or an exception text. It is NOT excluded from a Home Assistant add-on backup of `/data` (`backup: hot` in
config.yaml) unless the add-on lists `secrets/` in `backup_exclude`; see the open question in the S4 report. The API only says `password_set`.
A login over `security: none` is refused (the password would cross the LAN in clear).

DELIVERY: planned on the notifier thread (`plan`: read-only); `send` only HANDS the dispatch over to the channel's OWN worker thread (`EmailWorker`,
its own queue and retry heap) so a slow or dead mail server can never hold Web Push, the outbox or the escalation timer. The worker sends outside every
lock: one message per recipient address, a delivery-log row each (masked address, never the address); all recipients of one notification share a
time budget (`MAX_NOTIFICATION_S`) and a dead server is contacted once, not once per recipient. Failures are CLASSIFIED - `dns`, `connect`, `tls`, `auth`, `refused`,
`timeout` (+ `invalid`, `too_large`, `unavailable`) - and only the class is stored or shown, never a server banner or reply text (which
can echo an address or a credential). A transient failure (network, 4xx) is retried three times over 30 minutes through the e-mail worker's
own heap, each retry re-checking configuration, recipient and visibility; a permanent one (auth, 5xx, TLS) is final.
RATE LIMIT: at most `MAX_MAILS_PER_MIN` mails per minute per installation; further new/re-notified conditions are HELD and folded into ONE
digest mail with a count per condition ("דליפת מים · מטבח ×3"), sent as soon as the window frees; escalations always pass.
CHANNEL DOWN: when no mail has gone out for 15 minutes while attempts fail, a `notify.channel` system notification is raised (resolved at
the next success) - in the inbox, since a mail about a broken mail channel cannot be sent.
"""
from __future__ import annotations

import collections
import datetime as dt
import functools
import heapq
import html
import ipaddress
import itertools
import json
import logging
import os
import queue
import re
import secrets as _secrets
import smtplib
import socket
import ssl
import threading
import time
from dataclasses import dataclass, field
from email.message import EmailMessage
from email.utils import formataddr, formatdate, make_msgid
from pathlib import Path
from typing import Any, Callable

from . import notify
from . import notify_settings as nsettings
from .notify_channels import Channel, Dispatch, Target, record_outcome, register
from .notify_policy import BY_KEY, SEVERITY_LABEL_HE
from .notify_visibility import Reach, is_manager, principal_of
from .timeutil import iso_utc, parse_utc, zone

log = logging.getLogger("smplwise.notify.email")

# ---------------------------------------------------------------- limits and tuning (tests patch these)

TIMEOUT_S = 10.0                                   # connect and every SMTP step
RETRY_DELAYS_S: tuple[float, ...] = (120.0, 600.0, 1080.0)   # three retries over 30 minutes (2 + 10 + 18 min)
MAX_MAILS_PER_MIN = 6                              # per installation; the rest is folded into a digest
RATE_WINDOW_S = 60.0
DIGEST_DELAY_S = 65.0                              # a digest goes out when the window has surely freed
DIGEST_RETRY_S = 20.0                              # a digest that finds the window still full tries again after this long
MAX_HOLD_S = 900.0                                 # a held condition older than this is dropped as `rate_limited`
MAX_DIGEST_LINES = 20
MAX_RECIPIENTS = 10
MAX_ADDRESS = 254
MAX_SUBJECT = 150
MAX_MESSAGE_BYTES = 64 * 1024
MAX_NOTIFICATION_S = 45.0                          # all recipients of one notification together: past this the rest wait for a retry
WORKER_QUEUE_MAX = 200                             # dispatches waiting for the e-mail worker thread
ALLOW_LOOPBACK_HOST = False                        # tests only: the validator refuses loopback / link-local hosts
CHANNEL_DOWN_AFTER_S = 15 * 60
TEST_BURST, TEST_PER_MIN = 3, 3.0                  # POST /notify/email/test: 3 a minute
HELO_NAME = "arx.local"
PERSONAL_KINDS = ("session", "bulk_job")           # another user's sign-in / job: never mailed to an installation address
SERVER_FAILURES = ("dns", "connect", "tls", "auth", "timeout")   # kinds that say "the mail server is unusable" (channel-down tracking)
FAILURE_CLASSES = ("dns", "connect", "tls", "auth", "refused", "timeout", "invalid", "too_large", "unavailable")
SEVERITY_COLOR = {"info": "#2563eb", "alert": "#d97706", "critical": "#dc2626"}

_mono: Callable[[], float] = time.monotonic        # the clock of the rate limiters (tests replace it)


def tls_context() -> ssl.SSLContext:
    """The TLS context of `starttls` and `tls`: certificate AND host name are verified. A seam only so a test can trust its own CA."""
    return ssl.create_default_context()


# ---------------------------------------------------------------- errors

class MailError(Exception):
    """A send failed. `kind` is one of FAILURE_CLASSES - never a server text (it could quote an address or a credential)."""

    def __init__(self, kind: str, transient: bool = False):
        super().__init__(kind)
        self.kind = kind
        self.transient = transient

    @property
    def retryable(self) -> bool:
        return self.transient


def _code_of(exc: BaseException) -> int | None:
    c = getattr(exc, "smtp_code", None)
    return c if isinstance(c, int) else None


def classify(exc: BaseException, stage: str = "send") -> tuple[str, bool]:
    """(failure class, transient) of an exception raised at `stage` (connect | ehlo | starttls | login | send). Only the class leaves."""
    code = _code_of(exc)
    transient_code = code is not None and 400 <= code < 500
    if isinstance(exc, smtplib.SMTPRecipientsRefused):
        codes = [v[0] for v in exc.recipients.values() if isinstance(v, tuple) and v and isinstance(v[0], int)]
        return "refused", bool(codes) and all(400 <= c < 500 for c in codes)
    if isinstance(exc, smtplib.SMTPNotSupportedError):
        return ("tls" if stage == "starttls" else "auth"), False
    if isinstance(exc, smtplib.SMTPAuthenticationError):
        return "auth", transient_code
    if isinstance(exc, smtplib.SMTPConnectError):
        return "connect", transient_code or code is None
    if isinstance(exc, smtplib.SMTPServerDisconnected):
        # smtplib turns a read timeout into "connection unexpectedly closed"; the cause says which it was
        return ("timeout" if isinstance(exc.__context__, TimeoutError) else "connect"), True
    if isinstance(exc, ssl.SSLError):
        return "tls", False
    if isinstance(exc, socket.gaierror):
        return "dns", True
    if isinstance(exc, TimeoutError):  # socket.timeout is TimeoutError since 3.10
        return "timeout", True
    if isinstance(exc, ConnectionError):
        return "connect", True
    if isinstance(exc, smtplib.SMTPException):
        if stage == "starttls":
            return "tls", False
        if stage == "login":
            return "auth", transient_code
        return "refused", transient_code
    if isinstance(exc, OSError):
        return "connect", True
    if isinstance(exc, (UnicodeError, ValueError)):
        return "invalid", False
    return "connect", True


# ---------------------------------------------------------------- addresses, headers

# one plain ASCII address: no display name, no quotes, no angle brackets, no whitespace
EMAIL_RE = re.compile(r"^[A-Za-z0-9._%+\-']{1,64}@[A-Za-z0-9](?:[A-Za-z0-9\-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9\-]{0,61}[A-Za-z0-9])?)+$")
HOST_RE = re.compile(r"^[A-Za-z0-9](?:[A-Za-z0-9\-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9\-]{0,61}[A-Za-z0-9])?)*$")
CTRL_RE = re.compile(r"[\x00-\x1f\x7f  ]")


_NUMERIC_HOST = re.compile(r"^(0[xX][0-9a-fA-F]+|[0-9]+)(\.(0[xX][0-9a-fA-F]+|[0-9]+))*$")


def refused_host(host: str) -> bool:
    """A host that points back at this machine or at a link-local address (127.0.0.0/8, 169.254.0.0/16, 0.0.0.0, `localhost`, and the numeric
    spellings a resolver also accepts: `127.1`, `2130706433`, `0x7f.1`). LAN addresses and names are allowed."""
    h = host.strip().lower().rstrip(".")
    if h == "localhost" or h.endswith(".localhost"):
        return True
    if _NUMERIC_HOST.match(h):
        try:
            ip = ipaddress.IPv4Address(h)
        except ValueError:
            return True  # a non-canonical numeric spelling: refused rather than guessed at
        return ip.is_loopback or ip.is_link_local or ip.is_unspecified or ip.is_multicast
    return False


def valid_address(a: Any) -> bool:
    return isinstance(a, str) and len(a) <= MAX_ADDRESS and bool(EMAIL_RE.match(a))


def mask_address(address: str) -> str:
    """`dana@example.com` -> `d***@example.com`: what the delivery log shows instead of an address."""
    local, _, domain = (address or "").partition("@")
    if not domain:
        return "***"
    return (local[:1] + "***" if local else "***") + "@" + domain


def oneline(text: Any, limit: int) -> str:
    """Text for a header: every control character and line separator becomes a space, whitespace is collapsed, the length is clipped."""
    t = " ".join(CTRL_RE.sub(" ", str(text or "")).split())
    return t if len(t) <= limit else t[: limit - 1] + "…"


def header_safe(value: str) -> str:
    """Refuse (do not repair) a header value that carries a CR, LF or NUL - the injection guard of last resort."""
    if any(c in value for c in "\r\n\x00"):
        raise MailError("invalid")
    return value


# ---------------------------------------------------------------- the stored configuration

@dataclass(frozen=True)
class MailConfig:
    host: str
    port: int
    security: str
    user: str
    sender: str
    recipients: tuple[str, ...]
    link_base: str = ""
    password: str | None = field(default=None, repr=False, compare=False)


def _data_dir_of(conn: Any) -> Path:
    row = conn.execute("PRAGMA database_list").fetchone()
    return Path(str(row[2])).parent


def _raw(conn: Any) -> dict[str, Any]:
    r = conn.execute("SELECT email_json FROM notify_settings WHERE id = 1").fetchone()
    try:
        v = json.loads((r["email_json"] if r else "") or "{}")
    except ValueError:
        return {}
    return v if isinstance(v, dict) else {}


def load_config(conn: Any, data_dir: Path | None = None) -> MailConfig | None:
    """The sending configuration with the password read from its file, or None when mail is not configured (no host / from / recipient,
    a login without a password, or a login over `none`). Needs only a read connection."""
    d = data_dir or _data_dir_of(conn)
    e = nsettings.email_internal(conn)
    if not e["configured"]:
        return None
    password = nsettings.read_password(d) if e["user"] else None
    if e["user"] and (password is None or e["security"] == "none"):
        return None
    base = _raw(conn).get("link_base")
    return MailConfig(e["host"], int(e["port"]), e["security"], e["user"], e["from"], tuple(e["recipients"]), base if isinstance(base, str) else "", password)


def email_view(conn: Any, data_dir: Path) -> dict[str, Any]:
    """GET /notify/email: the settings block (never the password: `password_set`) plus the optional `link_base`."""
    base = _raw(conn).get("link_base")
    return {**nsettings.load(conn, data_dir)["email"], "link_base": base if isinstance(base, str) else ""}


_READ_ONLY_KEYS = {"configured", "password_set", "last_test"}
_WRITABLE_KEYS = {"host", "port", "security", "user", "password", "from", "recipients", "link_base"}


def _invalid(message: str, field_: str) -> nsettings.SettingsInvalid:
    return nsettings.SettingsInvalid("email_invalid", message, details={"field": field_})


def _valid_link_base(v: Any) -> str:
    if v is None or v == "":
        return ""
    if not isinstance(v, str) or len(v) > 200 or CTRL_RE.search(v) or " " in v:
        raise _invalid("כתובת הקישור אינה תקינה.", "link_base")
    m = re.match(r"^(https?)://([A-Za-z0-9.\-]+)(:[0-9]{1,5})?(/[A-Za-z0-9._~\-/]*)?$", v)
    if not m:
        raise _invalid("כתובת הקישור אינה תקינה.", "link_base")
    return v.rstrip("/")


def write_password(data_dir: Path, password: str) -> None:
    """Write the password (file 0600 in a 0700 directory) through a temporary file renamed into place."""
    p = nsettings.secret_path(data_dir)
    p.parent.mkdir(parents=True, exist_ok=True)
    try:
        os.chmod(p.parent, 0o700)
    except OSError:
        pass
    tmp = p.with_name(f".{nsettings.SECRET_NAME}.{_secrets.token_hex(4)}.tmp")
    fd = os.open(str(tmp), os.O_WRONLY | os.O_CREAT | os.O_EXCL | getattr(os, "O_BINARY", 0), 0o600)
    try:
        os.write(fd, password.encode("utf-8"))
        os.fsync(fd)
    finally:
        os.close(fd)
    os.replace(tmp, p)


def clear_password(data_dir: Path) -> None:
    try:
        nsettings.secret_path(data_dir).unlink()
    except OSError:
        pass


def update_email(conn: Any, data_dir: Path, body: dict[str, Any], actor_user_id: str) -> tuple[dict[str, Any], list[str], bool]:
    """PUT /notify/email: validate and store host / port / security / user / from / recipients (the settings row) and, when sent, the
    password (the secret file; omitted or empty = unchanged; a cleared `user` clears it too). The settings REVISION is left alone - this
    route has no revision of its own, and bumping it would turn the settings tab's next save into a stale-revision conflict.
    Returns (the block as the API shows it, the changed field names, whether the password changed). Raises SettingsInvalid(email_invalid)."""
    if not isinstance(body, dict):
        raise _invalid("בקשה לא תקינה.", "body")
    unknown = sorted(set(body) - _WRITABLE_KEYS - _READ_ONLY_KEYS)
    if unknown:
        raise nsettings.SettingsInvalid("email_invalid", "שדה לא מוכר.", details={"fields": unknown})
    host = body.get("host")
    if not isinstance(host, str) or not host.strip() or len(host.strip()) > 253 or not HOST_RE.match(host.strip()):
        raise _invalid("שם שרת הדואר אינו תקין.", "host")
    host = host.strip().lower()
    if refused_host(host) and not ALLOW_LOOPBACK_HOST:
        raise _invalid("שרת הדואר אינו יכול להיות המכשיר עצמו או כתובת מקומית־לקישור.", "host")
    port = body.get("port")
    if isinstance(port, bool) or not isinstance(port, int) or not 1 <= port <= 65535:
        raise _invalid("מספר היציאה אינו תקין.", "port")
    security = body.get("security")
    if security not in ("starttls", "tls", "none"):
        raise _invalid("סוג ההצפנה אינו תקין.", "security")
    user = body.get("user", "")
    if user is None:
        user = ""
    if not isinstance(user, str) or len(user) > 254 or any(not 0x20 <= ord(c) < 0x7f for c in user):
        raise _invalid("שם המשתמש אינו תקין.", "user")
    sender = body.get("from")
    if not isinstance(sender, str) or not valid_address(sender.strip()):
        raise _invalid("כתובת השולח אינה תקינה.", "from")
    sender = sender.strip()
    recipients = body.get("recipients")
    if not isinstance(recipients, list) or not 1 <= len(recipients) <= MAX_RECIPIENTS:
        raise _invalid("יש להזין בין כתובת נמען אחת לעשר.", "recipients")
    clean: list[str] = []
    for a in recipients:
        if not isinstance(a, str) or not valid_address(a.strip()):
            raise _invalid("כתובת נמען אינה תקינה.", "recipients")
        if a.strip().lower() not in [c.lower() for c in clean]:
            clean.append(a.strip())
    password = body.get("password")
    if password is not None and (not isinstance(password, str) or len(password) > 256 or any(not 0x20 <= ord(c) < 0x7f for c in password)):
        raise _invalid("הסיסמה אינה תקינה (תווי ASCII בלבד).", "password")
    if user and security == "none":
        raise _invalid("אין להזדהות מול שרת ללא הצפנה: הסיסמה הייתה נשלחת בגלוי.", "security")
    if user and not password and not nsettings.password_set(data_dir):
        raise _invalid("נדרשת סיסמה לשם המשתמש.", "password")
    raw = _raw(conn)
    new = dict(raw)
    new.update({"host": host, "port": port, "security": security, "user": user, "from": sender, "recipients": clean})
    if "link_base" in body:
        new["link_base"] = _valid_link_base(body["link_base"])
    keys = ("host", "port", "security", "user", "from", "recipients", "link_base")
    changed = [k for k in keys if raw.get(k) != new.get(k) and not (k == "link_base" and not raw.get(k) and not new.get(k))]
    conn.execute("UPDATE notify_settings SET email_json = ? WHERE id = 1", (json.dumps(new, ensure_ascii=False),))
    pw_changed = False
    if not user:
        if nsettings.password_set(data_dir):
            clear_password(data_dir)  # no account any more: a stale password must not linger
            pw_changed = True
    elif password:  # omitted or empty = unchanged
        write_password(data_dir, password)
        pw_changed = True
    return email_view(conn, data_dir), changed, pw_changed


# ---------------------------------------------------------------- the message

@dataclass(frozen=True)
class Rendered:
    subject: str
    text: str
    html: str


def _rtl(line: str) -> str:
    """A right-to-left mark in front of a line, so punctuation and numbers of a Hebrew line sit right in clients that guess the direction."""
    return ("‏" + line) if line else line


def _when(at: dt.datetime, tz_name: str) -> str:
    return at.astimezone(zone(tz_name)).strftime("%d/%m/%Y %H:%M")


def _link(link_base: str, nid: str | None) -> str:
    return f"{link_base}/#/notifications/{nid}" if link_base and nid else ""


def _page(title: str, rows: list[tuple[str, str]], severity: str, link: str, footer: str, intro: str = "", cta: bool = True) -> str:
    e = html.escape
    color = SEVERITY_COLOR.get(severity, "#2563eb")
    cells = "".join(f'<tr><td style="padding:3px 0 3px 14px;color:#6b7280;white-space:nowrap;vertical-align:top;">{e(k)}</td><td style="padding:3px 0;color:#111827;">{e(v)}</td></tr>' for k, v in rows)
    if link:
        button = (f'<p style="margin:16px 0 4px;"><a href="{e(link, quote=True)}" style="display:inline-block;background:{color};color:#ffffff;text-decoration:none;'
                  f'padding:9px 18px;border-radius:8px;font-weight:600;">פתח ב־Arx</a></p>')
    else:
        button = '<p style="margin:16px 0 4px;color:#374151;">לפרטים ולטיפול - היכנסו ל־Arx.</p>' if cta else ""
    lead = f'<p style="margin:0 0 8px;color:#374151;">{e(intro)}</p>' if intro else ""
    return (
        '<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>'
        '<body dir="rtl" style="margin:0;padding:16px;background:#f3f4f6;direction:rtl;text-align:right;font-family:Heebo,Arial,\'Segoe UI\',sans-serif;">'
        f'<div dir="rtl" style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:10px;border-right:6px solid {color};padding:16px 18px;direction:rtl;text-align:right;">'
        f'<div style="font-size:12px;color:#6b7280;margin-bottom:4px;">Arx</div><div style="font-size:20px;font-weight:700;color:#111827;margin:0 0 10px;">{e(title)}</div>'
        f'{lead}<table role="presentation" dir="rtl" style="border-collapse:collapse;font-size:15px;">{cells}</table>{button}'
        f'<p style="margin:14px 0 0;font-size:12px;color:#9ca3af;">{e(footer)}</p></div></body></html>'
    )


FOOTER = "נשלח אוטומטית מ־Arx. אין להשיב להודעה זו."


def compose_notification(n: dict[str, Any], *, mode: str, tz_name: str, link_base: str = "", resolve_text: str | None = None) -> Rendered:
    """The mail of one notification: type, place, severity, time, fold count, link. Built from the server-side row only - nothing a person
    typed except a place name, which is sanitised for the header. The body line is added for `system` subjects only."""
    title = oneline(n.get("title"), 80) or "התראה"
    place = oneline(n.get("place"), 80)
    typed = f"{title} · {place}" if place else title
    prefix = {"escalate": "לא אושר: ", "resolved": "הסתיים: ", "renotify": "החמרה: "}.get(mode, "")
    subject = oneline(f"Arx · {prefix}{typed}", MAX_SUBJECT)
    try:
        at = parse_utc(n.get("last_at") or n.get("first_at") or iso_utc(notify.now_utc()))
    except ValueError:
        at = notify.now_utc()
    sev = SEVERITY_LABEL_HE.get(n.get("severity") or "", "")
    count = n.get("count") if isinstance(n.get("count"), int) else 1
    link = _link(link_base, n.get("id"))
    body = oneline(n.get("body"), 180) if n.get("subject_kind") == "system" else ""
    rows = [("חומרה", sev), ("זמן", _when(at, tz_name))]
    if place:
        rows.insert(0, ("מקום", place))
    if count and count > 1:
        rows.append(("מספר אירועים", str(count)))
    if mode == "resolved":
        rows.append(("מצב", oneline(resolve_text, 80) or "הסתיים"))
    elif mode == "escalate":
        rows.append(("מצב", "טרם אושר - הועבר לאחראים"))
    if body:
        rows.append(("פרטים", body))
    lines = [_rtl(prefix + typed), ""] + [_rtl(f"{k}: {v}") for k, v in rows] + [""]
    lines.append(link if link else _rtl("לפרטים ולטיפול - היכנסו ל־Arx."))
    lines += ["", _rtl(FOOTER)]
    return Rendered(subject, "\n".join(lines), _page(prefix + typed, rows, n.get("severity") or "info", link, FOOTER))


@dataclass
class HeldItem:
    """A condition held back by the rate limit: what the digest says about it."""
    delivery_id: str
    nid: str
    title: str
    place: str
    severity: str
    count: int
    held_at: float


def compose_digest(items: list[HeldItem], *, tz_name: str, link_base: str = "", now: dt.datetime | None = None) -> Rendered:
    """ONE mail for many held conditions: a line per distinct (type, place) with the number of occurrences."""
    rank = {"info": 0, "alert": 1, "critical": 2}
    counts: dict[tuple[str, str], int] = {}
    worst = "info"
    for it in items:
        counts[(it.title, it.place)] = counts.get((it.title, it.place), 0) + max(1, it.count)
        if rank.get(it.severity, 0) > rank[worst]:
            worst = it.severity
    total = sum(counts.values())
    subject = oneline(f"Arx · {total} התראות נוספות", MAX_SUBJECT)
    entries = [(f"{t} · {p}" if p else t, f"×{c}") for (t, p), c in counts.items()]
    shown, rest = entries[:MAX_DIGEST_LINES], max(0, len(entries) - MAX_DIGEST_LINES)
    rows = [(a, b) for a, b in shown]
    if rest:
        rows.append((f"ועוד {rest} סוגי התראות", ""))
    when = _when(now or notify.now_utc(), tz_name)
    intro = "בדקה האחרונה נוצרו התראות רבות; הן מקובצות כאן להודעה אחת."
    link = f"{link_base}/#/notifications" if link_base else ""
    lines = [_rtl(f"{total} התראות נוספות"), "", _rtl(intro), ""] + [_rtl(f"• {a} {b}".rstrip()) for a, b in rows] + ["", _rtl(f"זמן: {when}"), ""]
    lines.append(link if link else _rtl("לפרטים ולטיפול - היכנסו ל־Arx."))
    lines += ["", _rtl(FOOTER)]
    return Rendered(subject, "\n".join(lines), _page(f"{total} התראות נוספות", rows + [("זמן", when)], worst, link, FOOTER, intro))


def compose_test(tz_name: str) -> Rendered:
    when = _when(notify.now_utc(), tz_name)
    text = "\n".join([_rtl("הודעת בדיקה מ־Arx"), "", _rtl("אם קיבלתם הודעה זו - הדואר היוצא מוגדר נכון."), _rtl(f"זמן: {when}"), "", _rtl(FOOTER)])
    return Rendered("Arx · הודעת בדיקה", text, _page("הודעת בדיקה", [("זמן", when)], "info", "", FOOTER, "אם קיבלתם הודעה זו - הדואר היוצא מוגדר נכון.", cta=False))


def build_message(cfg: MailConfig, to: str, r: Rendered) -> EmailMessage:
    """The wire message for one recipient. Raises MailError(invalid) for any address or header with a CR/LF/NUL (or an address that is not
    a plain one) and MailError(too_large) over MAX_MESSAGE_BYTES."""
    if not valid_address(to) or not valid_address(cfg.sender):
        raise MailError("invalid")
    msg = EmailMessage()
    try:
        msg["From"] = formataddr(("Arx", header_safe(cfg.sender)))
        msg["To"] = header_safe(to)
        msg["Subject"] = header_safe(r.subject)
        msg["Date"] = formatdate(localtime=False)
        msg["Message-ID"] = make_msgid(domain=cfg.sender.rpartition("@")[2])
        msg["Auto-Submitted"] = "auto-generated"
        msg["X-Auto-Response-Suppress"] = "All"
        msg.set_content(r.text, charset="utf-8", cte="base64")
        msg.add_alternative(r.html, subtype="html", charset="utf-8", cte="base64")
        size = len(msg.as_bytes())
    except MailError:
        raise
    except (ValueError, UnicodeError):  # the stdlib's own refusal of a header with a line break
        raise MailError("invalid") from None
    if size > MAX_MESSAGE_BYTES:
        raise MailError("too_large")
    return msg


# ---------------------------------------------------------------- the SMTP session

def _arm(client: Any, deadline: float | None) -> None:
    """Before an SMTP step: the socket's timeout is the smaller of the per-step timeout and what is left of the budget; none left = a timeout."""
    if deadline is None:
        return
    left = deadline - time.monotonic()
    if left <= 0:
        raise MailError("timeout", True)
    sock = getattr(client, "sock", None)
    if sock is not None:
        sock.settimeout(min(TIMEOUT_S, left))


def smtp_send(cfg: MailConfig, to: str, r: Rendered, deadline: float | None = None) -> None:
    """ONE message to ONE address over its own SMTP session: STARTTLS / implicit TLS with the certificate and host name verified (a server
    that does not offer STARTTLS is NOT sent to in clear), the login when a user is set, then the message. Raises MailError(kind); nothing
    from an exception text or a server reply leaves this function. `deadline` (time.monotonic) bounds the whole session."""
    msg = build_message(cfg, to, r)
    first = TIMEOUT_S if deadline is None else min(TIMEOUT_S, deadline - time.monotonic())
    if first <= 0:
        raise MailError("timeout", True)
    if cfg.user and cfg.security == "none":
        raise MailError("unavailable")
    client: smtplib.SMTP | None = None
    stage = "connect"
    ok = False
    try:
        if cfg.security == "tls":
            client = smtplib.SMTP_SSL(cfg.host, cfg.port, local_hostname=HELO_NAME, timeout=first, context=tls_context())
        else:
            client = smtplib.SMTP(cfg.host, cfg.port, local_hostname=HELO_NAME, timeout=first)
        stage = "ehlo"
        _arm(client, deadline)
        client.ehlo()
        if cfg.security == "starttls":
            stage = "starttls"
            if not client.has_extn("starttls"):
                raise MailError("tls")
            _arm(client, deadline)
            client.starttls(context=tls_context())
            _arm(client, deadline)
            client.ehlo()
        if cfg.user:
            stage = "login"
            _arm(client, deadline)
            client.login(cfg.user, cfg.password or "")
        stage = "send"
        _arm(client, deadline)
        client.send_message(msg, from_addr=cfg.sender, to_addrs=[to])
        ok = True
    except MailError:
        raise
    except BaseException as exc:  # noqa: BLE001 - classified; nothing from the exception text leaves this function
        if isinstance(exc, (KeyboardInterrupt, SystemExit)):
            raise
        kind, transient = classify(exc, stage)
        raise MailError(kind, transient) from None
    finally:
        if client is not None:
            try:
                client.quit() if ok else client.close()
            except Exception:  # noqa: BLE001
                try:
                    client.close()
                except Exception:  # noqa: BLE001
                    pass


# ---------------------------------------------------------------- rate limits

class RateGate:
    """A sliding window: at most `limit` events per `window` seconds (monotonic clock)."""

    def __init__(self) -> None:
        self.stamps: collections.deque[float] = collections.deque()
        self.lock = threading.Lock()

    def _trim(self, now: float) -> None:
        while self.stamps and now - self.stamps[0] >= RATE_WINDOW_S:
            self.stamps.popleft()

    def allow(self) -> bool:
        """Take a slot if one is free."""
        with self.lock:
            now = _mono()
            self._trim(now)
            if len(self.stamps) >= MAX_MAILS_PER_MIN:
                return False
            self.stamps.append(now)
            return True

    def force(self) -> None:
        """Count a send that may not be held back (an escalation) against the window."""
        with self.lock:
            now = _mono()
            self._trim(now)
            self.stamps.append(now)


class _TestBucket:
    def __init__(self) -> None:
        self.tokens, self.at = float(TEST_BURST), _mono()

    def take(self) -> tuple[bool, float]:
        now = _mono()
        self.tokens = min(float(TEST_BURST), self.tokens + (now - self.at) * TEST_PER_MIN / 60.0)
        self.at = now
        if self.tokens >= 1.0:
            self.tokens -= 1.0
            return True, 0.0
        return False, (1.0 - self.tokens) * 60.0 / TEST_PER_MIN


GATE = RateGate()
_TEST_BUCKETS: dict[str, _TestBucket] = {}
_LOCK = threading.Lock()


def take_test_token(user_id: str) -> tuple[bool, float]:
    """`POST /notify/email/test`: 3 a minute per user. Returns (allowed, seconds until a slot frees)."""
    with _LOCK:
        return _TEST_BUCKETS.setdefault(user_id, _TestBucket()).take()


# ---------------------------------------------------------------- held conditions and the digest

_HELD: dict[str, list[HeldItem]] = {}
_DIGEST: dict[str, Any] = {"job": None, "notifier": None}


_LIVE: set[str] = set()   # delivery rows in `retry` whose job is alive in THIS process (the retry heap or the held digest)


def _record(db: Any, ids: list[str], status: str, reason: str | None, attempt: int, **kw: Any) -> None:
    """record_outcome, plus the bookkeeping of which `retry` rows still have a job behind them."""
    with _LOCK:
        for i in ids:
            (_LIVE.add if status == "retry" else _LIVE.discard)(i)
    record_outcome(db, ids, status, reason, attempt, **kw)


ORPHAN_GRACE_S = 60.0


def recover_orphans(db: Any) -> int:
    """Delivery rows left in `retry` by a process that no longer exists (a restart drops the retry heap and the held digest) have no job
    behind them: each is marked `failed` / `unavailable` - honest, and the failures panel shows it. Runs from the notifier's housekeeping (the first
    pass comes shortly after start-up); a row whose job is alive here, or that is younger than a minute, is left alone. Returns how many."""
    cutoff = iso_utc(notify.now_utc() - dt.timedelta(seconds=ORPHAN_GRACE_S))
    with db.connection(mode="read", label="notify.email.orphans") as conn:
        rows = conn.execute("SELECT id, notification_id, attempt FROM notification_deliveries WHERE channel = 'email' AND status = 'retry' AND created_at <= ?", (cutoff,)).fetchall()
    with _LOCK:
        dead = [r for r in rows if r["id"] not in _LIVE]
    for r in dead:
        _record(db, [r["id"]], "failed", "unavailable", int(r["attempt"] or 0), notification_id=r["notification_id"], channel="email")
    return len(dead)


def reset_state() -> None:
    """Forget every in-memory limiter, held condition and failure streak, and stop the worker (tests; a restart does it implicitly)."""
    global _WORKER
    with _LOCK:
        w, _WORKER = _WORKER, None
    if w is not None:
        w.stop()
    with _LOCK:
        _HELD.clear()
        _DIGEST.update(job=None, notifier=None)
        _TEST_BUCKETS.clear()
        _LIVE.clear()
        _DOWN.update(since=None, raised=False)
    GATE.stamps.clear()


class EmailWorker:
    """The e-mail channel's OWN thread: a queue of dispatches handed over by the notifier thread, and a heap of retry / digest jobs (the same
    `recheck(db)` / `run_retry(worker)` job protocol as services/push.PushNotifier). SMTP, with its timeouts, happens only here - a slow
    or dead mail server delays only e-mail."""

    def __init__(self, db: Any) -> None:
        self.db = db
        self.q: queue.Queue[Callable[["EmailWorker"], None]] = queue.Queue(maxsize=WORKER_QUEUE_MAX)
        self.retries: list[tuple[float, int, Any]] = []
        self.seq = itertools.count()
        self.lock = threading.Lock()
        self.inflight = 0
        self.stop_evt = threading.Event()
        self.thread = threading.Thread(target=self._loop, name="email-worker", daemon=True)
        self.thread.start()

    # -- handing work over (never blocks, never touches the database)
    def submit(self, fn: Callable[["EmailWorker"], None]) -> bool:
        try:
            self.q.put_nowait(fn)
            return True
        except queue.Full:
            return False

    def schedule(self, delay: float, job: Any) -> None:
        with self.lock:
            heapq.heappush(self.retries, (time.monotonic() + delay, next(self.seq), job))
        self._wake()

    def has(self, job: Any) -> bool:
        with self.lock:
            return any(j is job for _t, _s, j in self.retries)

    def make_due(self) -> None:
        """Every waiting job comes due now (tests)."""
        with self.lock:
            self.retries[:] = [(0.0, seq, job) for _t, seq, job in self.retries]
            heapq.heapify(self.retries)
        self._wake()

    def _wake(self) -> None:
        try:
            self.q.put_nowait(lambda _w: None)
        except queue.Full:
            pass

    # -- the thread
    def _next_wait(self) -> float:
        with self.lock:
            return max(0.0, min(1.0, self.retries[0][0] - time.monotonic())) if self.retries else 1.0

    def _loop(self) -> None:
        while not self.stop_evt.is_set():
            try:
                fn = self.q.get(timeout=self._next_wait())
            except queue.Empty:
                fn = None
            if self.stop_evt.is_set():
                return
            try:
                if fn is not None:
                    try:
                        fn(self)
                    finally:
                        self.q.task_done()
                self._run_due()
            except Exception:  # noqa: BLE001 - the worker never dies on one bad dispatch
                log.exception("e-mail worker step failed")

    def _run_due(self) -> None:
        while True:
            with self.lock:
                if not self.retries or self.retries[0][0] > time.monotonic():
                    return
                self.inflight += 1  # before the pop: drain() never sees an empty heap with a job still on its way
                _t, _s, job = heapq.heappop(self.retries)
            try:
                if job.recheck(self.db):
                    job.run_retry(self)
            except Exception:  # noqa: BLE001
                log.exception("e-mail retry failed")
            finally:
                with self.lock:
                    self.inflight -= 1

    def drain(self, timeout: float = 10.0) -> bool:
        """Wait until nothing is queued, in flight or due (jobs scheduled for later do not count)."""
        end = time.monotonic() + timeout
        while True:
            with self.lock:
                due = bool(self.retries) and self.retries[0][0] <= time.monotonic()
                idle = self.q.unfinished_tasks == 0 and self.inflight == 0 and not due
            if idle:
                return True
            if time.monotonic() >= end:
                return False
            time.sleep(0.02)

    def stop(self) -> None:
        self.stop_evt.set()
        self._wake()
        if self.thread is not threading.current_thread():
            self.thread.join(timeout=3.0)


_WORKER: EmailWorker | None = None


def worker_for(db: Any) -> EmailWorker:
    """The e-mail worker of this database (started on first use; one per process in production)."""
    global _WORKER
    with _LOCK:
        w = _WORKER
        if w is not None and w.db is db and w.thread.is_alive() and not w.stop_evt.is_set():
            return w
        _WORKER = EmailWorker(db)
        new = _WORKER
    if w is not None:
        w.stop()
    return new


def _hold(notifier: Any, address: str, item: HeldItem, delay: float | None = None) -> None:
    with _LOCK:
        _HELD.setdefault(address, []).append(item)
        job = _DIGEST["job"]
        queued = job is not None and _DIGEST["notifier"] is notifier and notifier.has(job)
        if not queued:
            job = DigestJob()
            _DIGEST.update(job=job, notifier=notifier)
    if not queued:
        notifier.schedule(DIGEST_DELAY_S if delay is None else delay, job)


class DigestJob:
    """The retry-heap job that folds the held conditions into one mail per address when the rate window has freed."""

    def recheck(self, db: Any) -> bool:
        return True  # the digest re-checks the configuration and every recipient itself

    def run_retry(self, notifier: Any) -> None:
        with _LOCK:
            held = {a: list(v) for a, v in _HELD.items()}
            _HELD.clear()
            _DIGEST.update(job=None, notifier=None)
        if not held:
            return
        db = notifier.db
        now = _mono()
        fresh: dict[str, list[HeldItem]] = {}
        for address, items in held.items():
            for it in items:
                if now - it.held_at > MAX_HOLD_S:
                    _record(db, [it.delivery_id], "skipped", "rate_limited", 1)
                else:
                    fresh.setdefault(address, []).append(it)
        if fresh:  # the condition may be over, the policy may have changed: re-check every held item before it is mailed
            try:
                with db.connection(mode="read", label="notify.email.digest.recheck") as conn:
                    verdict = {it.delivery_id: _wanted(conn, it.nid, "new", None) for items in fresh.values() for it in items}
            except Exception:  # noqa: BLE001 - a database hiccup: keep them, the next pass checks again
                log.exception("e-mail digest re-check failed")
                verdict = {}
            for address in list(fresh):
                keep = []
                for it in fresh[address]:
                    why = verdict.get(it.delivery_id)
                    if why:
                        _record(db, [it.delivery_id], "skipped", why, 1)
                    else:
                        keep.append(it)
                if keep:
                    fresh[address] = keep
                else:
                    del fresh[address]
        if not fresh:
            return
        if not GATE.allow():  # still saturated: wait for the next window (the items keep their original hold time)
            for address, items in fresh.items():
                for it in items:
                    _hold(notifier, address, it, DIGEST_RETRY_S)
            return
        try:
            with db.connection(mode="read", label="notify.email.digest") as conn:
                tz_name = _tz(conn)
                cfg = load_config(conn, Path(db.path).parent)
        except Exception:  # noqa: BLE001
            log.exception("e-mail digest could not read its configuration")
            cfg, tz_name = None, "Asia/Jerusalem"
        server_down: MailError | None = None
        for address, items in fresh.items():
            rendered = compose_digest(items, tz_name=tz_name, link_base=cfg.link_base if cfg else "")
            job = MailJob(address, [(it.delivery_id, it.nid) for it in items], rendered, "digest", "new", 0)
            err = run_job(notifier, job, cfg=cfg, known=server_down)
            if err is not None and err.kind in SERVER_FAILURES:
                server_down = err


def _tz(conn: Any) -> str:
    from ..routers.settings import read_settings

    return read_settings(conn)["time.zone"]


# ---------------------------------------------------------------- a mail job (the first attempt and every retry)

@dataclass
class MailJob:
    address: str
    items: list[tuple[str, str]]          # (delivery id, notification id) the outcome is recorded on
    rendered: Rendered
    kind: str = "single"                  # single | digest
    mode: str = "new"
    attempt: int = 0                      # attempts already made
    source: str | None = None             # the policy a retry re-checks (a single mail)

    def recheck(self, db: Any) -> bool:
        """Before a retry: is it still allowed to go out - configured, the address still a recipient, the notification still wanted, an
        administrator still entitled to see it. The reason of a refusal lands in the delivery log (the row would otherwise stay `retry`)."""
        reason = None
        try:
            with db.connection(mode="read", label="notify.email.recheck") as conn:
                cfg = load_config(conn, Path(db.path).parent)
                if cfg is None:
                    reason = "channel_unavailable"
                elif self.address.lower() not in [a.lower() for a in cfg.recipients]:
                    reason = "no_reach"
                elif self.kind == "single":
                    reason = _wanted(conn, self.items[0][1], self.mode, self.source)
        except Exception:  # noqa: BLE001 - a database hiccup: try again at the next slot rather than drop
            log.exception("e-mail retry re-check failed")
            return True
        if reason:
            for did, nid in self.items:
                _record(db, [did], "skipped", reason, self.attempt + 1)
            return False
        return True

    def run_retry(self, notifier: Any) -> None:
        run_job(notifier, self)


def _wanted(conn: Any, nid: str, mode: str, source: str | None) -> str | None:
    """None when the notification still deserves this mail, else the delivery-log reason."""
    row = conn.execute("SELECT * FROM notifications WHERE id = ?", (nid,)).fetchone()
    if row is None:
        return "no_reach"
    n = notify._row_note(row)
    if (n["state"] == "resolved" and mode != "resolved") or (mode == "escalate" and n["state"] != "open"):
        return "no_reach"
    pol = conn.execute("SELECT enabled, channels_json FROM notify_policies WHERE source = ?", (n["source"],)).fetchone()
    try:
        email_on = bool(json.loads(pol["channels_json"] or "{}").get("email")) if pol else False
    except ValueError:
        email_on = False
    if pol is None or not pol["enabled"] or not email_on:
        return "category_off"
    users = [r[0] for r in conn.execute("SELECT user_id FROM notification_recipients WHERE notification_id = ?", (nid,)).fetchall()]
    return None if audience_ok(conn, n, users) else "no_reach"


def audience_ok(conn: Any, n: dict[str, Any], user_ids: list[str], reach_of: Callable[[str], Reach | None] | None = None) -> bool:
    """The scoping rule: not a personal subject, and at least one recipient who still sees the notification holds notify.manage."""
    if n.get("subject_kind") in PERSONAL_KINDS:
        return False
    for uid in user_ids:
        reach = reach_of(uid) if reach_of else None
        if reach is None:
            p = principal_of(conn, uid)
            if p is None:
                continue
            reach = Reach(conn, p)
        if reach.can_see(n) and is_manager(conn, reach.principal):
            return True
    return False


# ---------------------------------------------------------------- channel-down tracking

_DOWN: dict[str, Any] = {"since": None, "raised": False}
DOWN_DEDUPE = "notify.channel:email"


def _signal(db: Any, resolve: bool) -> None:
    sig = notify.Signal("notify.channel", "system", "email", params={"name": "דואר יוצא"}, dedupe_key=DOWN_DEDUPE, resolve=resolve)
    try:
        with db.connection(label="notify.email.channel") as conn:
            notify.emit(conn, sig)
    except Exception:  # noqa: BLE001 - the notice is a courtesy; the delivery log has the failures
        log.exception("could not record the e-mail channel state")


def _note_failure(db: Any, err: MailError) -> None:
    if err.kind not in SERVER_FAILURES:
        return
    now = notify.now_utc()
    with _LOCK:
        if _DOWN["since"] is None:
            _DOWN["since"] = now
        raise_now = not _DOWN["raised"] and (now - _DOWN["since"]).total_seconds() >= CHANNEL_DOWN_AFTER_S
        if raise_now:
            _DOWN["raised"] = True
    if raise_now:
        _signal(db, resolve=False)


def _note_success(db: Any) -> None:
    with _LOCK:
        was = _DOWN["raised"]
        _DOWN.update(since=None, raised=False)
    if was:
        _signal(db, resolve=True)


# ---------------------------------------------------------------- running one job

_LOAD: Any = object()  # run_job reads the configuration itself (a retry); a caller that already has it passes it


def run_job(notifier: Any, job: MailJob, *, cfg: Any = _LOAD, known: MailError | None = None, deadline: float | None = None) -> MailError | None:
    """One attempt for one address: send, record the outcome on the delivery rows, and schedule the next retry for a transient failure.
    `known` is a server-level failure just seen for another address of the same dispatch (no second connection is made against a dead
    server). Returns the error or None."""
    db = notifier.db
    err = known
    if err is None:
        try:
            if cfg is _LOAD:
                with db.connection(mode="read", label="notify.email.config") as conn:
                    cfg = load_config(conn, Path(db.path).parent)
            if cfg is None or job.address.lower() not in [a.lower() for a in cfg.recipients]:
                err = MailError("unavailable")
            else:
                smtp_send(cfg, job.address, job.rendered, deadline)
        except MailError as e:
            err = e
        except Exception as exc:  # noqa: BLE001 - never let one address stop the others; the class is all that is kept
            log.warning("e-mail job failed unexpectedly: %s", type(exc).__name__)
            err = MailError("connect", True)
    attempt = job.attempt + 1
    if err is None:
        for did, nid in job.items:
            _record(db, [did], "sent", "folded" if job.kind == "digest" else None, attempt)
        _note_success(db)
        return None
    final = not err.retryable or job.attempt >= len(RETRY_DELAYS_S)
    log.warning("e-mail to %s failed (%s)%s", mask_address(job.address), err.kind, "" if final else ", will retry")
    if final:
        for did, nid in job.items:
            _record(db, [did], "failed", err.kind, attempt, notification_id=nid, channel="email")
    else:
        for did, nid in job.items:
            _record(db, [did], "retry", err.kind, attempt)
        delay = RETRY_DELAYS_S[job.attempt]
        job.attempt += 1
        notifier.schedule(delay, job)
    _note_failure(db, err)
    return err


# ---------------------------------------------------------------- the channel

class EmailChannel(Channel):
    name = "email"

    def plan(self, d: Dispatch, conn: Any) -> list[Target]:
        cfg = load_config(conn, _data_dir_of(conn))
        if cfg is None:
            return [] if d.mode == "resolved" else [Target(self.name, None, "", "skipped", "channel_unavailable")]
        n = d.n
        users = list(d.users) if d.mode == "escalate" else [r[0] for r in conn.execute("SELECT user_id FROM notification_recipients WHERE notification_id = ? ORDER BY added_at, user_id", (d.nid,)).fetchall()]
        if not audience_ok(conn, n, users, d.reach):
            return [Target(self.name, None, "", "skipped", "no_reach")]
        resolve_text = d.item.get("text") or (BY_KEY[n["source"]].resolve_text if n.get("source") in BY_KEY else None)
        d.scratch["email_rendered"] = compose_notification(n, mode=d.mode, tz_name=d.tz, link_base=cfg.link_base, resolve_text=resolve_text)
        d.scratch["email_item"] = HeldItem("", d.nid, oneline(n.get("title"), 80), oneline(n.get("place"), 80), n.get("severity") or "info", int(n.get("count") or 1), _mono())
        if d.held(self.name):
            return [Target(self.name, None, mask_address(a), "skipped", "quiet_hours") for a in cfg.recipients]
        fold = False
        if d.mode == "escalate":
            GATE.force()
        elif not GATE.allow():
            if d.mode == "resolved":
                return [Target(self.name, None, mask_address(a), "skipped", "rate_limited") for a in cfg.recipients]
            fold = True
        return [Target(self.name, None, mask_address(a), "queued", None, {"address": a, "fold": fold}) for a in cfg.recipients]

    def send(self, notifier: Any, d: Dispatch, targets: list[Target]) -> None:
        """Runs on the notifier thread: only hands the dispatch to the e-mail worker (no SMTP, no wait)."""
        batch = _Batch(d.nid, d.mode, d.n.get("source"), d.scratch["email_rendered"], d.scratch["email_item"], [(t.delivery_id, t.data["address"], bool(t.data["fold"])) for t in targets if t.status == "queued"])
        if not batch.targets:
            return
        if not worker_for(notifier.db).submit(functools.partial(_run_batch, batch=batch)):  # the worker's queue is full: say so, honestly
            for did, _a, _f in batch.targets:
                _record(notifier.db, [did], "failed", "unavailable", 1, notification_id=d.nid, channel="email")


@dataclass
class _Batch:
    nid: str
    mode: str
    source: str | None
    rendered: Rendered
    item: HeldItem
    targets: list[tuple[str, str, bool]]    # (delivery id, address, held for the digest)


def _run_batch(worker: EmailWorker, *, batch: _Batch) -> None:
    """On the worker thread: one dispatch - held ones to the digest, the rest one message per address within the notification's time budget."""
    with worker.db.connection(mode="read", label="notify.email.config") as conn:
        cfg = load_config(conn, Path(worker.db.path).parent)
    deadline = time.monotonic() + MAX_NOTIFICATION_S
    server_down: MailError | None = None
    it = batch.item
    for did, address, fold in batch.targets:
        if fold:  # over the rate limit: held for the digest, which names it with a count
            _record(worker.db, [did], "retry", "rate_limited", 0)
            _hold(worker, address, HeldItem(did, batch.nid, it.title, it.place, it.severity, it.count, _mono()))
            continue
        job = MailJob(address, [(did, batch.nid)], batch.rendered, "single", batch.mode, 0, batch.source)
        known = server_down or (MailError("timeout", True) if time.monotonic() >= deadline else None)
        err = run_job(worker, job, cfg=cfg, known=known, deadline=deadline)
        if err is not None and err.kind in SERVER_FAILURES:
            server_down = err


register(EmailChannel())


# ---------------------------------------------------------------- the test button

def send_test(cfg: MailConfig, tz_name: str, to: str | None = None) -> tuple[bool, str, int, int]:
    """`POST /notify/email/test` through the SAME code path as a real mail (message building, TLS, login, classification): one test mail
    to each configured recipient (or only to `to`, which must be one of them). Returns (ok, detail, delivered, total): `detail` is `ok` or
    the failure class of the first failure - never a server text."""
    targets = [a for a in cfg.recipients if to is None or a.lower() == to.lower()]
    if not targets:
        return False, "unavailable", 0, 0
    rendered = compose_test(tz_name)
    delivered, first = 0, None
    for a in targets:
        try:
            smtp_send(cfg, a, rendered)
            delivered += 1
        except MailError as e:
            first = first or e.kind
            if e.kind in SERVER_FAILURES:
                break  # the server is unusable: do not wait on it once per recipient
    return first is None and delivered == len(targets), first or "ok", delivered, len(targets)
