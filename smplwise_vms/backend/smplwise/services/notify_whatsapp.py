"""NOTIFWA: the `whatsapp` notification channel - a notification the administrator's source policy routes to WhatsApp reaches the
recipient user's own phone number through the WhatsApp infrastructure of the tickets module (docs/changes/NOTIFWA-WHATSAPP-CHANNEL.md).

It plugs into the unchanged channel interface of services/notify_channels.py (plan in the READ phase, no I/O; send outside every lock)
and REUSES, by their public functions, what the tickets module already built - nothing of theirs is edited:
- the account: the use `notifications.whatsapp` joins the installation's account mapping (services/messaging_runtime.register_uses;
  Settings › ערוץ ההודעות picks the number) and is resolved at SEND time (a moved use applies to the next send);
- the adapter: services/tickets/channel_whatsapp.WhatsAppChannel (only `whatsapp.send_message`, `account` always sent, the outcome
  classification sent / refused / not_sent / unknown, no number or text in a log line);
- the pacing: messaging_accounts.PacingGate over the shared send ledger (`messaging_send_ledger`): ONE budget per number, shared with
  the ticket messages, the recipient keyed by HMAC under `k_messaging` (never the number);
- the text hygiene: channel.one_line (Cc / Cf stripped, one line, capped) and phone_digits.

The channel's OWN parts: the master switch (settings key `notify.whatsapp`, OFF by default, never exported or restored by a project
backup), the number resolver (an interface; today the tickets contact directory row of an Arx user), consent and the user's own
opt-out, code-owned message texts in he / ar / ru / en, de-duplication, a per-user hourly cap, the worker thread with its hold /
retry heap, and content-free audit rows.

Nothing here logs, audits or stores a phone number or a message text. The delivery log shows `····NN` (last two digits).
"""
from __future__ import annotations

import datetime as dt
import heapq
import itertools
import json
import logging
import os
import queue
import re
import sqlite3
import threading
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Callable, Protocol

from ..audit import audit
from ..db import now_iso
from . import messaging_accounts as ma
from . import messaging_runtime as mr
from . import notify
from .notify_channels import Channel, Dispatch, Target, record_outcome, register
from .notify_visibility import Reach, principal_of
from .tickets.channel import LANGS, NOT_SENT, REFUSED, SENT, UNKNOWN, AccountRef, OutboundMessage, Recipient, SendResult, one_line, phone_digits
from .tickets.channel_whatsapp import TransportReply, WhatsAppChannel
from .timeutil import iso_utc, zone

log = logging.getLogger("smplwise.notify.whatsapp")

CHANNEL = "whatsapp"
USE_KEY = "notifications.whatsapp"
MODULE = "notifications"
SETTING_KEY = "notify.whatsapp"
OPT_OUT_PREF = "notify.whatsapp.opt_out"      # user_prefs row of the user's own opt-out (not a VALIDATORS key: only this module reads it)

DEFAULT_CONFIG = {"enabled": False, "per_user_hour": 4, "dedupe_min": 30}
RANGES = {"per_user_hour": (1, 30), "dedupe_min": (0, 1440)}

RETRY_DELAYS_S = (60.0, 300.0, 900.0)         # a `not_sent` is tried again three times, then it fails
DOWN_RECHECK_S = 60.0                         # a disconnected account is looked at again after this long
MAX_HOLD_S = 600.0                            # pacing may hold a message this long ...
MAX_HOLD_URGENT_S = 1800.0                    # ... a critical one or an escalation this long; then `rate_limited`
QUEUE_MAX = 200
ORPHAN_GRACE_S = 120.0
TEST_PER_HOUR = 3                             # POST /notify/whatsapp/test per user (plus the account's own 5 / hour)
TEXT_MAX = 700
URGENT = ("critical",)


# ---------------------------------------------------------------- configuration (the master switch)

def load_config(conn: sqlite3.Connection) -> dict[str, Any]:
    """The channel settings; a missing or corrupt value reads as the defaults (switched OFF - fail closed)."""
    row = conn.execute("SELECT value FROM settings WHERE key = ?", (SETTING_KEY,)).fetchone()
    try:
        raw = json.loads(row[0]) if row else {}
    except (ValueError, TypeError):
        raw = {}
    raw = raw if isinstance(raw, dict) else {}
    out: dict[str, Any] = {"enabled": raw.get("enabled") is True}
    for k, (lo, hi) in RANGES.items():
        v = raw.get(k)
        out[k] = v if isinstance(v, int) and not isinstance(v, bool) and lo <= v <= hi else DEFAULT_CONFIG[k]
    out["revision"] = raw.get("revision") if isinstance(raw.get("revision"), int) and not isinstance(raw.get("revision"), bool) else 0
    return out


class ConfigInvalid(ValueError):
    def __init__(self, code: str, message: str, status: int = 422, details: dict[str, Any] | None = None) -> None:
        super().__init__(code)
        self.code, self.message, self.status, self.details = code, message, status, details or {}


def update_config(conn: sqlite3.Connection, body: Any, expected_revision: int | None) -> tuple[dict[str, Any], list[str]]:
    """Validate and store a PUT body; returns (stored config, changed field names). Raises ConfigInvalid."""
    if not isinstance(body, dict):
        raise ConfigInvalid("validation", "גוף הבקשה לא תקין.")
    cur = load_config(conn)
    if expected_revision is not None and expected_revision != cur["revision"]:
        raise ConfigInvalid("settings_conflict", "ההגדרות השתנו בינתיים; טען מחדש.", 412, {"current_revision": cur["revision"], "sent_revision": expected_revision})
    unknown = sorted(set(body) - {"enabled", "per_user_hour", "dedupe_min", "revision", "base_revision"})
    if unknown:
        raise ConfigInvalid("validation", "שדה לא מוכר.", details={"fields": unknown})
    new = {k: cur[k] for k in DEFAULT_CONFIG}
    if "enabled" in body:
        if not isinstance(body["enabled"], bool):
            raise ConfigInvalid("validation", "הערך חייב להיות כן/לא.", details={"field": "enabled"})
        new["enabled"] = body["enabled"]
    for k, (lo, hi) in RANGES.items():
        if k in body:
            v = body[k]
            if isinstance(v, bool) or not isinstance(v, int) or not lo <= v <= hi:
                raise ConfigInvalid("validation", "ערך מספרי מחוץ לטווח.", details={"field": k, "min": lo, "max": hi})
            new[k] = v
    changed = sorted(k for k in new if new[k] != cur[k])
    stored = {**new, "revision": cur["revision"] + 1}
    conn.execute("INSERT INTO settings(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", (SETTING_KEY, json.dumps(stored)))
    return load_config(conn), changed


# ---------------------------------------------------------------- the number resolver (the interface TKSTAFF1 plugs into)

@dataclass(frozen=True)
class ResolvedNumber:
    """A user's WhatsApp number as one resolver found it. `digits` is the `ha-whatsapp` target form (country code + number); it is
    never logged, audited or shown (repr hides it)."""

    digits: str = field(repr=False)
    lang: str = "he"
    source: str = ""                 # which resolver found it: "directory" today, "profile" with TKSTAFF1
    consent: str = "granted"         # granted | declined (the resolver's own consent record)


class NumberResolver(Protocol):
    """Find the WhatsApp number of an Arx user. Called on the planning connection (read only) and again before every send; must be
    cheap, must not write, must not call out. Return None when this resolver knows no number for the user."""

    name: str

    def resolve(self, conn: sqlite3.Connection, user_id: str) -> ResolvedNumber | None: ...


class DirectoryResolver:
    """The tickets contact directory: the active, not erased row whose `user_id` is the Arx user, with a valid number. Consent follows
    the tickets module's rule: the contact is messaged on WhatsApp only when WhatsApp is its preferred channel."""

    name = "directory"

    def resolve(self, conn: sqlite3.Connection, user_id: str) -> ResolvedNumber | None:
        try:
            r = conn.execute("SELECT phone_e164, lang, preferred_channel FROM ticket_contacts WHERE user_id = ? AND erased_at IS NULL AND active = 1 "
                             "ORDER BY updated_at DESC LIMIT 1", (user_id,)).fetchone()
        except sqlite3.Error:  # an installation without the tickets tables
            return None
        if r is None:
            return None
        digits = phone_digits(r["phone_e164"] or "")
        if digits is None:
            return None
        return ResolvedNumber(digits, r["lang"] if r["lang"] in LANGS else "he", self.name, "granted" if r["preferred_channel"] == "whatsapp" else "declined")


RESOLVERS: list[NumberResolver] = [DirectoryResolver()]


def register_resolver(resolver: NumberResolver, *, first: bool = False) -> None:
    """Add a resolver (once). `first=True` puts it before the existing ones (a staff profile number beats the directory)."""
    if any(r.name == resolver.name for r in RESOLVERS):
        return
    RESOLVERS.insert(0, resolver) if first else RESOLVERS.append(resolver)


def opted_out(conn: sqlite3.Connection, user_id: str) -> bool:
    try:
        r = conn.execute("SELECT value_json FROM user_prefs WHERE user_id = ? AND key = ?", (user_id, OPT_OUT_PREF)).fetchone()
    except sqlite3.Error:
        return False
    try:
        return bool(r) and json.loads(r[0]) is True
    except ValueError:
        return False


def set_opt_out(conn: sqlite3.Connection, user_id: str, value: bool) -> None:
    if value:
        conn.execute("INSERT INTO user_prefs(user_id, key, value_json, updated_at) VALUES (?,?,?,?) ON CONFLICT(user_id, key) DO UPDATE SET value_json = excluded.value_json, "
                     "updated_at = excluded.updated_at", (user_id, OPT_OUT_PREF, "true", now_iso()))
    else:
        conn.execute("DELETE FROM user_prefs WHERE user_id = ? AND key = ?", (user_id, OPT_OUT_PREF))


def resolve_number(conn: sqlite3.Connection, user_id: str) -> ResolvedNumber | None:
    """The first resolver's answer; the user's own opt-out turns any answer into `declined`."""
    for r in RESOLVERS:
        try:
            found = r.resolve(conn, user_id)
        except Exception:  # noqa: BLE001 - one broken resolver never stops the others (nothing about the user is logged)
            log.warning("whatsapp number resolver %s failed", getattr(r, "name", "?"))
            continue
        if found is not None:
            if found.consent == "granted" and opted_out(conn, user_id):
                return ResolvedNumber(found.digits, found.lang, found.source, "declined")
            return found
    return None


def mask(digits: str) -> str:
    return f"····{digits[-2:]}" if digits else ""


# ---------------------------------------------------------------- the texts (code-owned; values cleaned, rendered once)

SEVERITY = {
    "he": {"info": "מידע", "alert": "התראה", "critical": "קריטי"},
    "ar": {"info": "معلومة", "alert": "تنبيه", "critical": "حرج"},
    "ru": {"info": "Информация", "alert": "Предупреждение", "critical": "Критично"},
    "en": {"info": "Info", "alert": "Alert", "critical": "Critical"},
}
# ar / ru: initial translations, need a native review
TEXTS = {
    "he": {"generic": "Arx: התראה חדשה. הפרטים בתוך Arx.", "generic_resolved": "Arx: התראה הסתיימה. הפרטים בתוך Arx.",
           "new": "Arx · {severity}", "renotify": "Arx · {severity} · עדכון", "escalate": "Arx · {severity} · עדיין לא אושר", "resolved": "Arx · הסתיים",
           "time": "בשעה {time}", "footer": "הודעה אוטומטית - אין להשיב.", "test": "Arx: הודעת בדיקה. התראות בוואטסאפ יגיעו למספר הזה."},
    "ar": {"generic": "Arx: إشعار جديد. التفاصيل داخل Arx.", "generic_resolved": "Arx: انتهى إشعار. التفاصيل داخل Arx.",
           "new": "Arx · {severity}", "renotify": "Arx · {severity} · تحديث", "escalate": "Arx · {severity} · لم يتم التأكيد بعد", "resolved": "Arx · انتهى",
           "time": "الساعة {time}", "footer": "رسالة تلقائية - لا ترد عليها.", "test": "Arx: رسالة اختبار. ستصل إشعارات واتساب إلى هذا الرقم."},
    "ru": {"generic": "Arx: новое уведомление. Подробности в Arx.", "generic_resolved": "Arx: уведомление завершено. Подробности в Arx.",
           "new": "Arx · {severity}", "renotify": "Arx · {severity} · обновление", "escalate": "Arx · {severity} · ещё не подтверждено", "resolved": "Arx · завершено",
           "time": "в {time}", "footer": "Автоматическое сообщение - не отвечайте на него.", "test": "Arx: тестовое сообщение. Уведомления WhatsApp будут приходить на этот номер."},
    "en": {"generic": "Arx: new notification. Details in Arx.", "generic_resolved": "Arx: a notification ended. Details in Arx.",
           "new": "Arx · {severity}", "renotify": "Arx · {severity} · update", "escalate": "Arx · {severity} · not acknowledged yet", "resolved": "Arx · ended",
           "time": "at {time}", "footer": "Automatic message - do not reply.", "test": "Arx: test message. WhatsApp notifications will reach this number."},
}
_URL = re.compile(r"(?i)\b(?:[a-z][a-z0-9+.\-]{1,15}://|www\.)\S*|\b[a-z0-9\-]{1,63}(?:\.[a-z0-9\-]{1,63})*\.(?:com|net|org|io|co|me|ly|link|app|info|xyz|ru|il|online|site|top|club|biz)(?:/\S*)?\b")
_MARKUP = re.compile(r"[*~`]")


def clean(value: Any, limit: int) -> str:
    """A value placed into a message: one line, controls stripped, WhatsApp markup characters removed, every link-looking token
    replaced by `[…]`, capped. Never scanned again for placeholders (the texts are joined, not formatted, after this)."""
    text = one_line(value, limit * 2)
    text = _URL.sub("[…]", text)
    text = _MARKUP.sub("", text)
    return " ".join(text.split())[:limit]


def lang_of(lang: str | None) -> str:
    return lang if lang in TEXTS else "he"


def render(n: dict[str, Any], *, mode: str, level: str, lang: str, tz_name: str, now: dt.datetime) -> str:
    """The message of one notification for one recipient. `level` is the administrator's lock-screen level: `generic` carries no
    title, no place, no body; `type_place` the title, the place, the severity and the time; `full` also the body."""
    t = TEXTS[lang_of(lang)]
    if level == "generic":
        return t["generic_resolved"] if mode == "resolved" else t["generic"]
    sev = SEVERITY[lang_of(lang)].get(n.get("severity") or "info", "")
    head = t.get(mode if mode in ("new", "renotify", "escalate", "resolved") else "new", t["new"]).replace("{severity}", sev)
    lines = [head, clean(n.get("title"), 80)]
    place = clean(n.get("place"), 80)
    if place:
        lines.append(place)
    if level == "full":
        body = clean(n.get("body"), 180)
        if body and body not in lines:
            lines.append(body)
    lines.append(t["time"].replace("{time}", now.astimezone(zone(tz_name)).strftime("%H:%M")))
    lines.append(t["footer"])
    return "\n".join(x for x in lines if x)[:TEXT_MAX]


# ---------------------------------------------------------------- the account use (Settings › ערוץ ההודעות)

def _uses(conn: sqlite3.Connection) -> tuple[ma.UseSpec, ...]:
    """The use is shown in Settings › ערוץ ההודעות while the channel's master switch is on (like a module's uses follow its switch);
    a mapping stored while it was off is kept and applies when it is switched on."""
    return (ma.UseSpec(USE_KEY, MODULE, "התראות המערכת", active=lambda: load_config(conn)["enabled"]),)


mr.register_uses(_uses)
mr.register_label_renderer(MODULE, lambda conn, text: text, lambda conn: "התראות")


# ---------------------------------------------------------------- transport (tests replace TRANSPORT)

TRANSPORT: Any = None


class _NotConfigured:
    def call(self, domain: str, service: str, data: dict[str, Any], *, return_response: bool, timeout: float) -> TransportReply:
        return TransportReply("not_configured")


def transport() -> Any:
    """The fake in tests; else the tickets module's HA service transport, built from the add-on settings it was configured with."""
    if TRANSPORT is not None:
        return TRANSPORT
    from .tickets.channel_whatsapp import HaServiceTransport
    from .tickets.messaging import RUNTIME

    if RUNTIME.transport is not None:  # a test that faked ha-whatsapp for the tickets module fakes it for this channel too
        return RUNTIME.transport
    return HaServiceTransport(RUNTIME.settings) if RUNTIME.settings is not None else _NotConfigured()


def _data_dir(db: Any) -> Path:
    return Path(db.path).parent


def _messaging_key(db: Any) -> bytes:
    try:
        return mr.messaging_key(_data_dir(db)) or b"\0" * 32
    except Exception:  # noqa: BLE001 - a damaged key file: the ledger key is still never a number
        log.error("messaging key unreadable; whatsapp notifications use a process key")
        return _PROCESS_KEY


_PROCESS_KEY = os.urandom(32)


# ---------------------------------------------------------------- the worker (its own thread: HA calls and pacing waits never block push)

@dataclass
class Job:
    delivery_id: str
    nid: str
    user_id: str
    digits: str = field(repr=False)
    text: str = field(repr=False)
    mode: str = "new"
    severity: str = "info"
    attempt: int = 0                       # attempts already made
    created: float = field(default_factory=time.monotonic)
    down_since: float | None = None

    @property
    def urgent(self) -> bool:
        return self.severity in URGENT or self.mode == "escalate"


_LIVE: set[str] = set()                    # delivery ids with a job alive in THIS process
_LOCK = threading.Lock()
_TEST_SENDS: dict[str, list[float]] = {}


class Worker:
    def __init__(self, db: Any) -> None:
        self.db = db
        self.q: queue.Queue[Callable[["Worker"], None]] = queue.Queue(maxsize=QUEUE_MAX)
        self.heap: list[tuple[float, int, int, Job]] = []
        self.seq = itertools.count()
        self.lock = threading.Lock()
        self.inflight = 0
        self.stop_evt = threading.Event()
        self.gate = ma.PacingGate(mr.DbSendLedger(db))
        self.thread = threading.Thread(target=self._loop, name="whatsapp-notify", daemon=True)
        self.thread.start()

    def submit(self, jobs: list[Job]) -> bool:
        try:
            self.q.put_nowait(lambda w: [w.schedule(0.0, j) for j in jobs])
            return True
        except queue.Full:
            return False

    def schedule(self, delay: float, job: Job) -> None:
        with _LOCK:
            _LIVE.add(job.delivery_id)
        with self.lock:
            heapq.heappush(self.heap, (time.monotonic() + delay, 0 if job.urgent else 1, next(self.seq), job))
        self._wake()

    def make_due(self) -> None:
        with self.lock:
            self.heap[:] = [(0.0, p, s, j) for _t, p, s, j in self.heap]
            heapq.heapify(self.heap)
        self._wake()

    def pending(self) -> int:
        with self.lock:
            return len(self.heap)

    def _wake(self) -> None:
        try:
            self.q.put_nowait(lambda _w: None)
        except queue.Full:
            pass

    def _loop(self) -> None:
        while not self.stop_evt.is_set():
            with self.lock:
                wait = max(0.0, min(1.0, self.heap[0][0] - time.monotonic())) if self.heap else 1.0
            try:
                fn = self.q.get(timeout=wait)
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
            except Exception:  # noqa: BLE001 - the worker never dies on one bad job
                log.exception("whatsapp notification worker step failed")

    def _run_due(self) -> None:
        while True:
            with self.lock:
                if not self.heap or self.heap[0][0] > time.monotonic():
                    return
                self.inflight += 1
                job = heapq.heappop(self.heap)[3]
            try:
                run_job(self, job)
            except Exception:  # noqa: BLE001
                log.exception("whatsapp notification job failed")
                _finish(self.db, job, "failed", "channel_error", job.attempt + 1)
            finally:
                with self.lock:
                    self.inflight -= 1

    def drain(self, timeout: float = 10.0) -> bool:
        """Wait until nothing is queued, in flight or due (jobs scheduled for later do not count)."""
        end = time.monotonic() + timeout
        while True:
            with self.lock:
                due = bool(self.heap) and self.heap[0][0] <= time.monotonic()
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


_WORKER: Worker | None = None


def worker_for(db: Any) -> Worker:
    global _WORKER
    with _LOCK:
        w = _WORKER
        if w is not None and w.db is db and w.thread.is_alive() and not w.stop_evt.is_set():
            return w
        _WORKER = Worker(db)
        new = _WORKER
    if w is not None:
        w.stop()
    return new


def reset_state() -> None:
    """Tests (a restart does it implicitly): stop the worker, forget the live set and the test-send counters."""
    global _WORKER
    with _LOCK:
        w, _WORKER = _WORKER, None
        _LIVE.clear()
        _TEST_SENDS.clear()
    if w is not None:
        w.stop()


def _finish(db: Any, job: Job, status: str, reason: str | None, attempt: int, *, account_key: str | None = None, outcome: str | None = None) -> None:
    """Record a FINAL outcome: the delivery row (a failure also lands on the notification's timeline) and one content-free audit row."""
    with _LOCK:
        _LIVE.discard(job.delivery_id)
    record_outcome(db, [job.delivery_id], status, reason, attempt, notification_id=job.nid, channel=CHANNEL)
    if status == "skipped":
        return
    try:
        with db.connection(label="notify.whatsapp.audit") as conn:
            audit(conn, actor=None, action="notify.whatsapp.send", decision="allowed" if status == "sent" else "failed", resource_type="notification", resource_id=job.nid,
                  details={"delivery_id": job.delivery_id, "outcome": outcome or status, "code": reason, "account": account_key, "attempt": attempt, "mode": job.mode})
    except Exception:  # noqa: BLE001 - the delivery row has the outcome
        log.warning("whatsapp notification audit row failed")


def _set(db: Any, job: Job, status: str, reason: str | None, attempt: int) -> None:
    record_outcome(db, [job.delivery_id], status, reason, attempt)


def still_wanted(conn: sqlite3.Connection, job: Job) -> str | None:
    """None when the job may still go out, else the delivery-log reason: the switch, the policy, the notification's state, the
    recipient's visibility, the number (unchanged) and consent - all re-read now."""
    if not load_config(conn)["enabled"]:
        return "channel_unavailable"
    row = conn.execute("SELECT * FROM notifications WHERE id = ?", (job.nid,)).fetchone()
    if row is None:
        return "no_reach"
    n = notify._row_note(row)
    if (n["state"] == "resolved" and job.mode != "resolved") or (job.mode == "escalate" and n["state"] != "open"):
        return "no_reach"
    pol = conn.execute("SELECT enabled, channels_json FROM notify_policies WHERE source = ?", (n["source"],)).fetchone()
    try:
        on = bool(pol) and bool(pol["enabled"]) and bool(json.loads(pol["channels_json"] or "{}").get(CHANNEL))
    except ValueError:
        on = False
    if not on:
        return "category_off"
    p = principal_of(conn, job.user_id)
    if p is None or not Reach(conn, p).can_see(n):
        return "no_reach"
    found = resolve_number(conn, job.user_id)
    if found is None or found.digits != job.digits:
        return "no_address"
    if found.consent != "granted":
        return "no_consent"
    return None


def run_job(worker: Worker, job: Job) -> None:
    """One attempt for one recipient (the first and every later one)."""
    db = worker.db
    try:
        with db.connection(mode="read", label="notify.whatsapp.recheck") as conn:
            why = still_wanted(conn, job)
    except Exception:  # noqa: BLE001 - a database hiccup: look again shortly
        log.warning("whatsapp notification re-check failed")
        worker.schedule(DOWN_RECHECK_S, job)
        return
    if why:
        _finish(db, job, "skipped", why, job.attempt)
        return
    svc = mr.accounts_service(db)
    account = svc.resolve(USE_KEY)
    if account is None or not account.value:
        _finish(db, job, "failed", "channel_unavailable", job.attempt + 1)
        return
    now_m = time.monotonic()
    if not svc.status(account.key).sendable:
        job.down_since = job.down_since or now_m
        if now_m - job.down_since < svc.pacing(account.key).hold_when_down_min * 60:
            _set(db, job, "retry", "channel_down", job.attempt)
            worker.schedule(DOWN_RECHECK_S, job)
        else:
            _finish(db, job, "failed", "channel_down", job.attempt + 1, account_key=account.key)
        return
    job.down_since = None
    rkey = mr.recipient_key(_messaging_key(db), job.digits)
    now = dt.datetime.now(dt.timezone.utc)
    decision = worker.gate.check(account_key=account.key, pacing=svc.pacing(account.key), recipient_key=rkey, kind="message", now=now)
    if not decision.allowed:
        wait = max(0.5, (decision.not_before - now).total_seconds())
        if now_m + wait - job.created > (MAX_HOLD_URGENT_S if job.urgent else MAX_HOLD_S):
            _finish(db, job, "skipped", "rate_limited", job.attempt, account_key=account.key)
        else:
            _set(db, job, "retry", "rate_limited", job.attempt)
            worker.schedule(wait, job)
        return
    adapter = WhatsAppChannel(transport(), svc)
    msg = OutboundMessage(outbox_id=job.delivery_id, channel=CHANNEL, purpose="notify", recipient=Recipient(None, phone=job.digits), text=job.text, account=account)
    result: SendResult = adapter.send(msg)
    svc.note_result(account.key, result)
    attempt = job.attempt + 1
    if result.may_have_left:
        try:
            worker.gate.record(account_key=account.key, use_key=USE_KEY, recipient_key=rkey, kind="message", now=now)
        except Exception:  # noqa: BLE001 - the outcome is still recorded
            log.warning("whatsapp send ledger row failed")
    if result.outcome == SENT:
        _finish(db, job, "sent", None, attempt, account_key=account.key, outcome=SENT)
    elif result.outcome == REFUSED:
        _finish(db, job, "failed", "provider_refused", attempt, account_key=account.key, outcome=REFUSED)
    elif result.outcome == UNKNOWN:  # it may have left: never retried, never re-routed
        _finish(db, job, "failed", "unknown_outcome", attempt, account_key=account.key, outcome=UNKNOWN)
    elif result.outcome == NOT_SENT and job.attempt < len(RETRY_DELAYS_S):
        _set(db, job, "retry", result.outcome_code or "not_sent", attempt)
        delay = RETRY_DELAYS_S[job.attempt]
        job.attempt = attempt
        worker.schedule(delay, job)
    else:
        _finish(db, job, "failed", result.outcome_code or "not_sent", attempt, account_key=account.key, outcome=NOT_SENT)


def recover_orphans(db: Any) -> int:
    """Rows left `queued` / `retry` by a process that is gone have no job behind them: `failed / interrupted` (never re-sent: a send
    may have been under way). A row younger than the grace, or with a live job here, is left alone."""
    cutoff = iso_utc(notify.now_utc() - dt.timedelta(seconds=ORPHAN_GRACE_S))
    with db.connection(mode="read", label="notify.whatsapp.orphans") as conn:
        rows = conn.execute("SELECT id, notification_id, attempt FROM notification_deliveries WHERE channel = ? AND status IN ('queued', 'retry') AND created_at <= ?",
                            (CHANNEL, cutoff)).fetchall()
    with _LOCK:
        dead = [r for r in rows if r["id"] not in _LIVE]
    for r in dead:
        record_outcome(db, [r["id"]], "failed", "interrupted", int(r["attempt"] or 0), notification_id=r["notification_id"], channel=CHANNEL)
    return len(dead)


# ---------------------------------------------------------------- the channel

def _recent_sent(conn: sqlite3.Connection, nid: str, uid: str, since: str) -> bool:
    return conn.execute("SELECT 1 FROM notification_deliveries WHERE notification_id = ? AND user_id = ? AND channel = ? AND status = 'sent' AND COALESCE(sent_at, created_at) >= ? LIMIT 1",
                        (nid, uid, CHANNEL, since)).fetchone() is not None


def _hour_count(conn: sqlite3.Connection, uid: str, since: str) -> int:
    return int(conn.execute("SELECT COUNT(*) FROM notification_deliveries WHERE user_id = ? AND channel = ? AND status IN ('queued', 'retry', 'sent') AND created_at >= ?",
                            (uid, CHANNEL, since)).fetchone()[0])


class WhatsAppNotifyChannel(Channel):
    name = CHANNEL

    def plan(self, d: Dispatch, conn: Any) -> list[Target]:
        cfg = load_config(conn)
        if not cfg["enabled"]:
            return [] if d.mode == "resolved" else [Target(self.name, None, "", "skipped", "channel_unavailable")]
        doc = mr.load_doc(conn)
        if not doc.uses.get(USE_KEY):  # no account picked for the use (Settings › ערוץ ההודעות)
            return [] if d.mode == "resolved" else [Target(self.name, None, "", "skipped", "channel_unavailable")]
        users = d.users
        if d.mode == "resolved":  # a resolve notice only to whom this channel actually reached
            users = [u for u in users if conn.execute("SELECT 1 FROM notification_deliveries WHERE notification_id = ? AND user_id = ? AND channel = ? AND status = 'sent' LIMIT 1",
                                                      (d.nid, u, CHANNEL)).fetchone()]
        now_iso_ = iso_utc(d.now)
        wall = dt.datetime.now(dt.timezone.utc)  # the delivery rows are stamped with the wall clock: their windows are measured on it
        dedupe_since = iso_utc(wall - dt.timedelta(minutes=cfg["dedupe_min"]))
        hour_since = iso_utc(wall - dt.timedelta(hours=1))
        out: list[Target] = []
        for uid in users:
            reach = d.reach(uid)
            if reach is None:
                continue
            found = resolve_number(conn, uid)
            if found is None:
                continue  # no number: nothing to say per notification (Settings shows how many users can be reached)
            ref = mask(found.digits)
            if not reach.can_see(d.n):
                out.append(Target(self.name, uid, ref, "skipped", "no_reach"))
                continue
            if found.consent != "granted":
                out.append(Target(self.name, uid, ref, "skipped", "no_consent"))
                continue
            rec = conn.execute("SELECT snoozed_until FROM notification_recipients WHERE notification_id = ? AND user_id = ?", (d.nid, uid)).fetchone()
            if d.mode != "escalate" and rec is not None and rec["snoozed_until"] and rec["snoozed_until"] > now_iso_:
                out.append(Target(self.name, uid, ref, "skipped", "snoozed"))
                continue
            if d.held(self.name):
                out.append(Target(self.name, uid, ref, "skipped", "quiet_hours"))
                continue
            if d.mode in ("new", "renotify") and cfg["dedupe_min"] and _recent_sent(conn, d.nid, uid, dedupe_since):
                out.append(Target(self.name, uid, ref, "skipped", "deduped"))
                continue
            if d.severity not in URGENT and d.mode != "escalate" and _hour_count(conn, uid, hour_since) >= cfg["per_user_hour"]:
                out.append(Target(self.name, uid, ref, "skipped", "rate_limited"))
                continue
            text = render(d.n, mode=d.mode, level=d.settings.get("lockscreen") or "type_place", lang=found.lang, tz_name=d.tz, now=d.now)
            out.append(Target(self.name, uid, ref, "queued", None, {"digits": found.digits, "text": text}))
        return out

    def send(self, notifier: Any, d: Dispatch, targets: list[Target]) -> None:
        """On the notifier thread: only hands the targets to the channel's worker (no HA call, no wait)."""
        jobs = [Job(t.delivery_id, d.nid, t.user_id or "", t.data["digits"], t.data["text"], d.mode, d.severity) for t in targets if t.status == "queued"]
        if not jobs:
            return
        with _LOCK:
            _LIVE.update(j.delivery_id for j in jobs)
        if not worker_for(notifier.db).submit(jobs):
            for j in jobs:
                _finish(notifier.db, j, "failed", "unavailable", 1)


register(WhatsAppNotifyChannel())


# ---------------------------------------------------------------- views for the routes

def take_test_slot(user_id: str) -> tuple[bool, int]:
    """POST /notify/whatsapp/test: TEST_PER_HOUR per user. (allowed, seconds until a slot frees)."""
    now = time.monotonic()
    with _LOCK:
        stamps = [t for t in _TEST_SENDS.get(user_id, []) if now - t < 3600]
        if len(stamps) >= TEST_PER_HOUR:
            _TEST_SENDS[user_id] = stamps
            return False, int(3600 - (now - stamps[0])) + 1
        stamps.append(now)
        _TEST_SENDS[user_id] = stamps
        return True, 0


def account_view(conn: sqlite3.Connection) -> dict[str, Any]:
    """The account the use resolves to (label with the last four digits only, state) - or `mapped: false`."""
    svc = mr.service(conn)
    ref = svc.resolve(USE_KEY)
    if ref is None:
        return {"mapped": False, "label": None, "state": None}
    return {"mapped": True, "label": ref.label, "state": svc.status(ref.key).state}


def reachable_count(conn: sqlite3.Connection) -> int:
    n = 0
    for r in conn.execute("SELECT id FROM users WHERE active = 1").fetchall():
        found = resolve_number(conn, r["id"])
        if found is not None and found.consent == "granted":
            n += 1
    return n


def admin_view(conn: sqlite3.Connection, caller_id: str) -> dict[str, Any]:
    cfg = load_config(conn)
    own = resolve_number(conn, caller_id)
    return {**cfg, "ranges": {k: list(v) for k, v in RANGES.items()}, "account": account_view(conn), "reachable_users": reachable_count(conn),
            "accounts_href": "#/system/messaging-accounts", "test": {"own_number": own is not None and own.consent == "granted", "masked": mask(own.digits) if own else None}}


def my_view(conn: sqlite3.Connection, user_id: str) -> dict[str, Any]:
    found = None
    for r in RESOLVERS:  # the resolver's own answer, before the user's opt-out is applied
        try:
            found = r.resolve(conn, user_id)
        except Exception:  # noqa: BLE001
            found = None
        if found is not None:
            break
    return {"channel_enabled": load_config(conn)["enabled"], "has_number": found is not None, "masked": mask(found.digits) if found else None,
            "source": found.source if found else None, "consent": found.consent if found else None, "opted_out": opted_out(conn, user_id)}


def test_text(lang: str) -> str:
    return TEXTS[lang_of(lang)]["test"]


def send_test(conn: sqlite3.Connection, db: Any, user_id: str) -> dict[str, Any]:
    """One fixed test text to the CALLER's own resolved number, through the same adapter and pacing (kind `test`). The caller's
    request connection holds the write gate: the ledger check and record use it (a second write connection would wait for itself),
    and the HA call runs with the gate released (`unlocked`). Returns `{ok, code}`; raises ConfigInvalid for the refusals."""
    from ..db import unlocked

    found = resolve_number(conn, user_id)
    if found is None:
        raise ConfigInvalid("no_address", "לא נמצא מספר וואטסאפ עבורך.", 409)
    if found.consent != "granted":
        raise ConfigInvalid("no_consent", "המספר שלך לא מסומן לקבלת הודעות בוואטסאפ.", 409)
    svc = mr.service(conn)
    account = svc.resolve(USE_KEY)
    if account is None or not account.value:
        raise ConfigInvalid("channel_unavailable", "לא נבחר חשבון וואטסאפ להתראות.", 409)
    gate = ma.PacingGate(ma.SqliteSendLedger(conn))
    rkey = mr.recipient_key(_messaging_key(db), found.digits)
    now = dt.datetime.now(dt.timezone.utc)
    decision = gate.check(account_key=account.key, pacing=svc.pacing(account.key), recipient_key=rkey, kind="test", now=now)
    if not decision.allowed:
        raise ConfigInvalid("rate_limited", "יותר מדי שליחות בחשבון הזה. נסו שוב מאוחר יותר.", 429,
                            {"retry_after_s": max(1, int((decision.not_before - now).total_seconds()) + 1)})
    msg = OutboundMessage(outbox_id=f"test-{user_id[:16]}", channel=CHANNEL, purpose="test", recipient=Recipient(None, phone=found.digits), text=test_text(found.lang), account=account)
    with unlocked(conn):
        result = WhatsAppChannel(transport(), svc).send(msg)
    svc.note_result(account.key, result)
    if result.may_have_left:
        gate.record(account_key=account.key, use_key=USE_KEY, recipient_key=rkey, kind="test", now=now)
    return {"ok": result.outcome == SENT, "outcome": result.outcome, "code": result.outcome_code, "account": account.key}


__all__ = ["CHANNEL", "USE_KEY", "ResolvedNumber", "NumberResolver", "register_resolver", "resolve_number", "render", "clean", "load_config", "update_config",
           "AccountRef"]
