"""T033 acceptance 2 (R066 / AT066): the redacted log export - a diagnostics file an administrator downloads on purpose (master spec
chapter 30, Observability: "Diagnostic bundle מצונזר נוצר בהסכמה; אינו כולל וידאו או תוכניות כברירת מחדל").

What it holds:
- the add-on's recent log lines from an in-memory ring (`RING`, the last `MAX_RECORDS` lines, each cut to `MAX_MESSAGE` characters),
  every line with the correlation id of the request it was written for (`correlation_id.CURRENT`, set by the middleware) - the same
  id an error envelope and an audit row carry, so one failed request can be followed through the file;
- the health report's checks (status, label, redacted detail) and a recommendation for every check that is not ok, plus one for the
  errors the log holds (which component, which request id to quote);
- what was redacted (counts per rule), never the redacted values.

What it never holds: video, frames, snapshots, floor plans, the database, tokens, passwords, credentials inside URLs (RTSP and
HTTP), cookies, IP addresses, MAC addresses, serial numbers, e-mail addresses and phone numbers. The ring keeps the raw line (it is
the process's own log, the same text the add-on log already shows); everything leaves through `redact()`, which runs on every
string of the file - log lines, logger names and the health details alike.

The ring is process memory only: nothing is written to disk, a restart empties it, and the export is the only reader."""
from __future__ import annotations

import collections
import datetime as dt
import logging
import re
import threading
import time
from collections.abc import Callable, Iterable
from typing import Any

from .. import __version__, correlation_id

FORMAT = "arx.logs/1"
MAX_RECORDS = 2000
MAX_MESSAGE = 4000
MAX_MINUTES = 24 * 60
DEFAULT_MINUTES = 60
MAX_ERROR_GROUPS = 20
LEVELS = {"DEBUG": logging.DEBUG, "INFO": logging.INFO, "WARNING": logging.WARNING, "ERROR": logging.ERROR, "CRITICAL": logging.CRITICAL}

# ---------------------------------------------------------------------------------------------------------------- redaction

_SECRET_KEYS = (r"pass(?:word|wd)?|pwd|secret|token|api[_-]?key|apikey|access[_-]?key|private[_-]?key|auth(?:orization)?|cookie|"
                r"session(?:[_-]?id)?|signature|hmac|credentials?|bearer")  # also with a prefix: access_token, x-api-key
_SECRET_WORDS = r"pin|sid|sig|otp|totp|code_verifier"  # whole words only (spin, considering and opt-in stay)
_SERIAL_KEYS = r"serial(?:[_ -]?(?:number|no|num))?|serialnumber|sn"
SERIAL_MIN = 16


def _serial_bare(m: re.Match[str]) -> str | None:
    """A device serial without its key (Hikvision style: model letters, date digits, serial): 16+ characters of capitals and digits."""
    return "<serial>" if len(m.group(0).replace("-", "")) >= SERIAL_MIN else None


def _long_token(m: re.Match[str]) -> str | None:
    """A long opaque value (a hex digest, an urlsafe token): 32+ characters, at least a quarter digits, or mixed case with digits.
    A snake_case module or function name in a traceback (few digits, one case) is kept."""
    v = m.group(0)
    digits = sum(ch.isdigit() for ch in v)
    mixed = any(ch.islower() for ch in v) and any(ch.isupper() for ch in v)
    return "<token>" if digits and (digits * 4 >= len(v) or mixed) else None

# (rule name, pattern, replacement) - applied in this order; a placeholder of an earlier rule ("<ip>", "<redacted>") never matches a
# later one. A callable replacement returns None to keep the match as it is (it is then not counted).
Replacement = str | Callable[[re.Match[str]], str | None]
RULES: tuple[tuple[str, re.Pattern[str], Replacement], ...] = (
    # an embedded image (a frame or a snapshot as a data URL): the whole payload
    ("image", re.compile(r"data:image/[a-z0-9.+-]+;base64,[A-Za-z0-9+/=]+", re.I), "<image>"),
    # credentials inside a URL: rtsp://user:pass@host, http://user@host
    ("url_credentials", re.compile(r"\b([a-z][a-z0-9+.-]*://)[^/\s:@'\"<>]+(?::[^/\s@'\"<>]*)?@", re.I), r"\1<credentials>@"),
    # Authorization: Bearer / Basic / Digest <value>
    ("auth_header", re.compile(r"\b(bearer|basic|digest)\s+[A-Za-z0-9._~+/=-]{8,}", re.I), r"\1 <token>"),
    # a JSON Web Token anywhere (Home Assistant long-lived tokens are JWTs)
    ("jwt", re.compile(r"\beyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]*"), "<token>"),
    # key=value, key: value, "key": "value", ?key=value& for a secret-looking key (the key stays, the value goes)
    ("secret_value", re.compile(r"(?i)([\"']?\b(?:[\w-]*(?:" + _SECRET_KEYS + r")|" + _SECRET_WORDS + r")\b[\"']?\s*[:=]\s*)(?:\"[^\"]*\"|'[^']*'|[^\s,;&'\"}\]]+)"),
     r"\1<redacted>"),
    ("serial_value", re.compile(r"(?i)([\"']?\b(?:" + _SERIAL_KEYS + r")\b[\"']?\s*[:=]\s*)(?:\"[^\"]*\"|'[^']*'|[^\s,;&'\"}\]<]+)"),
     r"\1<serial>"),
    # <serialNumber>...</serialNumber> (ISAPI XML)
    ("serial_xml", re.compile(r"(<serial[A-Za-z]*>)[^<]*(</serial[A-Za-z]*>)", re.I), r"\1<serial>\2"),
    # MAC addresses (before IPv6: aa:bb:cc:dd:ee:ff would otherwise read as one)
    ("mac", re.compile(r"\b[0-9A-Fa-f]{2}([:-])[0-9A-Fa-f]{2}(?:\1[0-9A-Fa-f]{2}){4}\b"), "<mac>"),
    # IPv4, with an optional :port that goes with it
    ("ipv4", re.compile(r"(?<![\d.])(?:25[0-5]|2[0-4]\d|1?\d?\d)(?:\.(?:25[0-5]|2[0-4]\d|1?\d?\d)){3}(?::\d{1,5})?(?![\d.])"), "<ip>"),
    # IPv6: eight groups, or a compressed form with "::"
    ("ipv6", re.compile(r"(?<![\w:])(?:(?:[0-9A-Fa-f]{1,4}:){7}[0-9A-Fa-f]{1,4}|(?:[0-9A-Fa-f]{1,4}:){1,6}:(?:[0-9A-Fa-f]{1,4}:?){1,6}"
                        r"|::(?:[0-9A-Fa-f]{1,4}:){1,6}[0-9A-Fa-f]{1,4})(?![\w:])"), "<ip>"),
    ("email", re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b"), "<email>"),
    # Israeli phone numbers (international and local, mobile and landline)
    ("phone", re.compile(r"(?<![\d.])(?:\+?972[-\s]?|0)(?:5\d|7\d|[2-489])[-\s]?\d{3}[-\s]?\d{4}(?![\d.])"), "<phone>"),
    ("serial_bare", re.compile(r"\b(?=[A-Z0-9-]*\d)(?=[A-Z0-9-]*[A-Z])[A-Z0-9]+(?:-[A-Z0-9]+)*\b"), _serial_bare),
    ("long_token", re.compile(r"(?<![\w+=-])[A-Za-z0-9_+=-]{32,}(?![\w+=-])"), _long_token),
)


def redact(text: Any, counts: dict[str, int] | None = None) -> str:
    """`text` with every secret, address, serial and personal number replaced by a placeholder. `counts` (optional) collects the
    number of replacements per rule. Pure; a non-string is redacted as its str()."""
    s = text if isinstance(text, str) else str(text)
    for name, pat, repl in RULES:
        n = 0

        def sub(m: re.Match[str], repl: Replacement = repl) -> str:
            nonlocal n
            out = repl(m) if callable(repl) else m.expand(repl)
            if out is None:
                return m.group(0)
            n += 1
            return out

        s = pat.sub(sub, s)
        if n and counts is not None:
            counts[name] = counts.get(name, 0) + n
    return s


def rule_names() -> list[str]:
    return [name for name, _p, _r in RULES]


# ---------------------------------------------------------------------------------------------------------------- the ring

class LogRing(logging.Handler):
    """The last MAX_RECORDS log lines of the process, in memory. Installed on the root logger by `install()`; it formats nothing
    until the export asks (a record costs one tuple), and never raises into the code that logged."""

    def __init__(self, capacity: int = MAX_RECORDS) -> None:
        super().__init__(level=logging.NOTSET)
        self._lines: collections.deque[tuple[float, int, str, str | None, logging.LogRecord]] = collections.deque(maxlen=capacity)
        self._mutex = threading.Lock()
        self.dropped = 0  # lines pushed out of the ring since start (it is a ring, not a file)

    def emit(self, record: logging.LogRecord) -> None:
        try:
            with self._mutex:
                if len(self._lines) == self._lines.maxlen:
                    self.dropped += 1
                self._lines.append((record.created, record.levelno, record.name, correlation_id.current(), record))
        except Exception:  # noqa: BLE001 - logging must never fail the caller
            self.handleError(record)

    @property
    def capacity(self) -> int:
        return self._lines.maxlen or 0

    def snapshot(self) -> list[tuple[float, int, str, str | None, logging.LogRecord]]:
        with self._mutex:
            return list(self._lines)

    def clear(self) -> None:
        with self._mutex:
            self._lines.clear()
            self.dropped = 0


RING = LogRing()


def install(logger: logging.Logger | None = None) -> LogRing:
    """Attach the ring to the root logger once per process (create_app runs many times in tests)."""
    target = logger or logging.getLogger()
    if RING not in target.handlers:
        target.addHandler(RING)
    return RING


def _message(record: logging.LogRecord) -> str:
    try:
        msg = record.getMessage()
    except Exception:  # noqa: BLE001 - a bad format string still yields a line
        msg = f"{record.msg!r} {record.args!r}"
    if record.exc_info:
        try:
            msg += "\n" + logging.Formatter().formatException(record.exc_info)
        except Exception:  # noqa: BLE001
            pass
    elif record.exc_text:
        msg += "\n" + record.exc_text
    if len(msg) > MAX_MESSAGE:
        msg = msg[:MAX_MESSAGE] + f" ... [{len(msg) - MAX_MESSAGE} more characters cut]"
    return msg


def _iso(ts: float) -> str:
    return dt.datetime.fromtimestamp(ts, dt.timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


# ---------------------------------------------------------------------------------------------------------------- recommendations

RECOMMEND_HE: dict[str, str] = {
    "db": "בדקו את שלמות מסד הנתונים ואת המקום הפנוי; אם הבדיקה נכשלת, שחזרו מהגיבוי האחרון.",
    "storage": "פנו מקום באחסון התוסף (ייצואים וגיבויים ישנים) או הגדילו את הדיסק של המארח.",
    "nvr": "בדקו שה־NVR דולק ונגיש מהמארח, ושכתובת ופרטי ההתחברות בהגדרות התוסף נכונים.",
    "go2rtc": "בדקו ששירות go2rtc פועל ושהכתובת שלו בהגדרות התוסף נכונה.",
    "ha_sync": "בדקו את החיבור לתשתית ואת אסימון הגישה של התוסף; אחרי תיקון הפעילו סנכרון מחדש.",
    "bridge": "בדקו שאינטגרציית Arx מותקנת ומצומדת ושגרסתה תואמת לגרסת התוסף.",
    "events_ingest": "בדקו את החיבור ל־NVR ושקליטת ההתראות (alertStream) מופעלת בו.",
    "events_derive": "בדקו שחיפוש ההקלטות ב־NVR עובד; האירועים הנגזרים תלויים בו.",
    "discovery": "הריצו גילוי מצלמות מחדש ובדקו את הרשאות המשתמש של התוסף ב־NVR.",
    "video_webrtc": "בדקו את בחירת הזרם הראשי / המשני ואת הגדרות הערוץ המרוחק.",
    "thumbnails": "בדקו ש־ffmpeg זמין ושיש מקום פנוי; תמונות שנכשלו ייווצרו שוב בסבב הבא.",
    "exports": "בדקו את עבודות הייצוא שנכשלו ואת המקום הפנוי באחסון.",
    "sessions": "אם מספר הזרמים הפעילים לא יורד, סגרו את המסכים הפתוחים או הפעילו את התוסף מחדש.",
    "backups": "צרו גיבוי עכשיו ובדקו שהגיבוי האוטומטי פועל.",
    "process_restarts": "עיינו בשגיאות שלפני ההפעלה מחדש (ביומן שבקובץ) ושלחו את הקובץ לתמיכה.",
    "secret_options": "העבירו את הסודות מהגדרות התוסף לאחסון הסודות של Arx ומחקו אותם מהגדרות התוסף.",
    "transit": "בדקו את החיבור למקור זמני התחבורה הציבורית ואת מפתח הגישה שלו.",
    "portal_start": "בדקו את קליטת בקשות הכניסה לפורטל הספקים ואת חיבור הדואר שלה.",
}
GENERIC_HE = "בדקו את הרכיב \"{label}\" ({status})."
LOG_ERRORS_HE = "ביומן {count} שגיאות; הרכיב עם הכי הרבה שגיאות: {logger} ({top}). בפנייה לתמיכה ציינו את מזהה הבקשה {cid}."


def recommendations(checks: Iterable[dict[str, Any]], error_groups: list[dict[str, Any]], error_count: int,
                    top_logger: tuple[str, int] | None, counts: dict[str, int]) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for c in checks:
        if c.get("status") in ("ok", "off"):
            continue
        label = redact(c.get("label") or c.get("id") or "", counts)
        text = RECOMMEND_HE.get(str(c.get("id")), GENERIC_HE.format(label=label, status=c.get("status")))
        out.append({"source": "health", "check": c.get("id"), "status": c.get("status"), "label": label, "text_he": text})
    if error_count and top_logger is not None:
        cid = error_groups[0]["correlation_id"] if error_groups else "-"
        out.append({"source": "log", "check": None, "status": "error", "label": redact(top_logger[0], counts),
                    "text_he": LOG_ERRORS_HE.format(count=error_count, logger=redact(top_logger[0], counts), top=top_logger[1], cid=cid or "-")})
    return out


# ---------------------------------------------------------------------------------------------------------------- the export

def build(health: dict[str, Any] | None, *, minutes: int = DEFAULT_MINUTES, min_level: str = "INFO", only_correlation_id: str | None = None,
          export_correlation_id: str | None = None, ring: LogRing | None = None, now: float | None = None) -> dict[str, Any]:
    """The export document. `health` is the health report (or None); `only_correlation_id` keeps one request's lines only."""
    ring = ring or RING
    now = time.time() if now is None else now
    since = now - minutes * 60
    floor = LEVELS[min_level]
    counts: dict[str, int] = {}
    records: list[dict[str, Any]] = []
    errors: dict[str, dict[str, Any]] = {}
    by_logger: collections.Counter[str] = collections.Counter()
    error_count = 0
    snap = ring.snapshot()
    for created, levelno, name, cid, record in snap:
        if created < since or levelno < floor:
            continue
        if only_correlation_id is not None and cid != only_correlation_id:
            continue
        at = _iso(created)
        records.append({"at": at, "level": logging.getLevelName(levelno), "logger": redact(name, counts), "correlation_id": cid,
                        "message": redact(_message(record), counts)})
        if levelno >= logging.ERROR:
            error_count += 1
            by_logger[name] += 1
            if cid:
                g = errors.setdefault(cid, {"correlation_id": cid, "count": 0, "first_at": at, "last_at": at, "loggers": []})
                g["count"] += 1
                g["last_at"] = at
                if name not in g["loggers"]:
                    g["loggers"].append(name)
    groups = sorted(errors.values(), key=lambda g: (-g["count"], g["last_at"]))[:MAX_ERROR_GROUPS]
    for g in groups:
        g["loggers"] = [redact(n, counts) for n in g["loggers"]]
    checks_out: list[dict[str, Any]] = []
    status = None
    if health is not None:
        status = health.get("status")
        for c in health.get("checks", []):
            checks_out.append({"id": c.get("id"), "label": redact(c.get("label") or "", counts), "status": c.get("status"),
                               "detail": redact(c.get("detail") or "", counts)})
    top = by_logger.most_common(1)[0] if by_logger else None
    recs = recommendations(health.get("checks", []) if health else [], groups, error_count, top, counts)
    return {
        "format": FORMAT,
        "generated_at": _iso(now),
        "version": __version__,
        "export_correlation_id": export_correlation_id,
        "filters": {"minutes": minutes, "min_level": min_level, "correlation_id": only_correlation_id},
        "ring": {"capacity": ring.capacity, "held": len(snap), "dropped_since_start": ring.dropped},
        "health": {"status": status, "checks": checks_out} if health is not None else None,
        "recommendations": recs,
        "errors": {"count": error_count, "by_correlation_id": groups},
        "records": records,
        "redaction": {"rules": rule_names(), "replaced": dict(sorted(counts.items())), "total": sum(counts.values())},
        "excluded": ["video", "frames and snapshots", "floor plans", "database", "tokens, passwords and cookies",
                     "credentials inside URLs (RTSP / HTTP)", "IP and MAC addresses", "serial numbers", "e-mail addresses and phone numbers"],
    }
