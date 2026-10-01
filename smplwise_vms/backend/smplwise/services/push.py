"""Web Push (CR-008 P3): the installation's VAPID key pair, browser push subscriptions per HA user, per-user
notification preferences, and the notify path from the rules engine.

Protocol, implemented here with `cryptography` (already a dependency) and `httpx` rather than pywebpush, which would
add requests, aiohttp, http-ece, py-vapid and six to the add-on image for the same ~150 lines:
- RFC 8292 VAPID: an ES256 JWT (`aud` = the push service's origin, `exp` <= 24 h, `sub` = a contact URL) sent as
  `Authorization: vapid t=<jwt>, k=<public key>`.
- RFC 8291 message encryption with the RFC 8188 `aes128gcm` content coding: an ephemeral P-256 ECDH key per message,
  HKDF (SHA-256) over the subscription's `auth` secret, one record, AES-128-GCM.

Rules of the road (CR-008 §3d):
- The VAPID private key is generated once per installation, lives in the `push_vapid` table (never in `settings`, so a
  project backup never carries it), is never logged and never leaves the add-on; only the public key is served.
- A notification reaches only a user who may open what it points at: the same rule as GET /rules/alerts (a camera
  alert follows the user's camera scope for events.read, a camera-less alert needs installation-wide events.read,
  services/access.row_scope), evaluated when the alert fires - never a camera event to a user without reach.
- The payload is minimal and carries no secret: title, body, a deep link inside the app, the event and alert ids, a
  category and a severity. No tokens, no endpoint, no image; the client fetches details after it signs in.
- Endpoints are capability URLs: only push services on the allow-list are ever called (no SSRF through a crafted
  "subscription"), only the host is logged or returned, and a 404/410 from the push service removes the
  subscription. 429 and 5xx are retried with backoff (Retry-After honoured, capped); other 4xx count as failures.
- Sending never happens under the SQLite write lock: the rules engine only enqueues (after its commit), a worker
  thread computes the recipients on a read connection, sends, and records each outcome in a short transaction.

CR-018: the same worker thread also drains the notification outbox (services/notify_channels.py): notifications of EVERY source
are planned there against the ADMINISTRATOR's policy and settings (no per-user preferences), pushed with payload v2 and sent
by e-mail; each attempt is a row of the delivery log. The functions below that take a legacy "notice" dict (plan, notice_from_fired,
payload_for, get_prefs ...) stay readable for one release, as the migration plan says; nothing in the product calls them but the tests.
"""
from __future__ import annotations

import base64
import datetime as dt
import hashlib
import heapq
import hmac
import itertools
import json
import logging
import os
import queue
import re
import sqlite3
import threading
import time
from dataclasses import dataclass
from typing import Any
from urllib.parse import urlsplit

import httpx
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives.asymmetric.utils import decode_dss_signature
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

from ..db import Database, new_id, now_iso
from ..rbac import Principal

log = logging.getLogger("smplwise.push")

CATEGORIES = ("alerts", "doors", "device_faults", "system")  # the legacy per-user preference keys (push_prefs), read for one more release
ALL_CATEGORIES = ("safety", "alerts", "doors", "device_faults", "automations", "system", "security")  # CR-018 (services/notify_policy.CATEGORIES)
DEFAULT_CATEGORIES: dict[str, bool] = {c: True for c in CATEGORIES}
DEFAULT_QUIET: dict[str, Any] = {"enabled": False, "from": "22:00", "to": "07:00", "allow_critical": True}

# The push services browsers use (Chrome/Edge-on-Android FCM, Firefox autopush, Safari/iOS APNs web push, Edge on
# Windows WNS). A subscription whose endpoint is anywhere else is refused: the server POSTs to that URL.
PUSH_HOST_SUFFIXES: tuple[str, ...] = ("fcm.googleapis.com", "android.googleapis.com", "push.services.mozilla.com", "push.apple.com", "notify.windows.com")
MAX_ENDPOINT_LEN = 2048
MAX_SUBSCRIPTIONS_PER_USER = 10
SUBJECT = os.environ.get("SW_PUSH_SUBJECT", "https://smplwise.com/arx")  # VAPID `sub`: a contact URL (Apple requires one)
TTL_S = 3600  # an alert older than an hour is not worth waking a phone for; the events screen still has it
RECORD_SIZE = 4096
MAX_PAYLOAD = 3000  # bytes of JSON before encryption (push services accept 4 KB bodies)
SEND_TIMEOUT_S = 10.0
BACKOFF_S: tuple[float, ...] = (5.0, 30.0, 120.0)  # retry delays after 429 / 5xx / network errors
MAX_RETRY_AFTER_S = 300.0
DROP_AFTER_FAILURES = 10  # consecutive non-retryable failures before a subscription is dropped
STALE_DAYS = 120  # a subscription whose browser has not synced for this long is pruned by the janitor
RATE_BURST, RATE_PER_MIN = 10, 10.0  # alert notifications per user
TEST_BURST, TEST_PER_MIN = 3, 3.0  # test notifications per user
QUEUE_MAX = 500

TRANSPORT: httpx.BaseTransport | None = None  # tests install an httpx.MockTransport (a fake push service)
# Worker counters since the add-on started (GET /health, system.configure holders): alerts queued, messages sent,
# retried, subscriptions gone (404/410), failed; `refused` = recipients left out for lack of reach (at planning or at a
# retry), `retry_skipped` = retries abandoned because the subscription was removed, moved or its user lost reach.
STATS: dict[str, Any] = {"queued": 0, "sent": 0, "retried": 0, "gone": 0, "failed": 0, "refused": 0, "retry_skipped": 0, "rate_limited": 0,
                         "dropped_queue": 0, "dropped_shutdown": 0, "last_error": None, "last_sent_at": None}


# ---------------------------------------------------------------- encoding helpers

def b64u(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def b64u_dec(text: str) -> bytes:
    text = text.strip().replace("+", "-").replace("/", "_").rstrip("=")
    return base64.urlsafe_b64decode(text + "=" * (-len(text) % 4))


def endpoint_host(endpoint: str) -> str:
    return (urlsplit(endpoint).hostname or "").lower()


def endpoint_hash(endpoint: str) -> str:
    """What the API returns instead of the endpoint (a capability URL): the client matches its own subscription by it."""
    return hashlib.sha256(endpoint.encode("utf-8")).hexdigest()[:32]


# ---------------------------------------------------------------- VAPID keys

_KEYS: dict[str, tuple[ec.EllipticCurvePrivateKey, str]] = {}
_KEYS_LOCK = threading.Lock()


def _db_key(conn: sqlite3.Connection) -> str:
    row = conn.execute("PRAGMA database_list").fetchone()
    return str(row[2]) if row else ""


def ensure_vapid(conn: sqlite3.Connection) -> str:
    """The installation's VAPID public key (base64url, uncompressed point); the pair is generated on first use. Needs a
    write connection the first time (a read-mode connection only reads an existing pair)."""
    row = conn.execute("SELECT public_key FROM push_vapid WHERE id = 1").fetchone()
    if row:
        return str(row[0])
    key = ec.generate_private_key(ec.SECP256R1())
    pem = key.private_bytes(serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8, serialization.NoEncryption()).decode("ascii")
    pub = b64u(key.public_key().public_bytes(serialization.Encoding.X962, serialization.PublicFormat.UncompressedPoint))
    conn.execute("INSERT OR IGNORE INTO push_vapid(id, private_pem, public_key, created_at) VALUES (1, ?, ?, ?)", (pem, pub, now_iso()))
    log.info("generated the installation's Web Push (VAPID) key pair")  # never the key itself
    return str(conn.execute("SELECT public_key FROM push_vapid WHERE id = 1").fetchone()[0])


def vapid_public_key(conn: sqlite3.Connection) -> str | None:
    row = conn.execute("SELECT public_key FROM push_vapid WHERE id = 1").fetchone()
    return str(row[0]) if row else None


def rotate_key(conn: sqlite3.Connection) -> tuple[str, int]:
    """Replace the installation's VAPID pair. Every subscription was made for the old public key, so all of them are
    removed; each browser that still has notification permission re-subscribes with the new key the next time Arx
    opens there (push.ts syncSubscription). Returns (new public key, subscriptions removed)."""
    removed = conn.execute("DELETE FROM push_subscriptions").rowcount
    conn.execute("DELETE FROM push_vapid")
    with _KEYS_LOCK:
        _KEYS.pop(_db_key(conn), None)
    return ensure_vapid(conn), removed


def signing_key(conn: sqlite3.Connection) -> tuple[ec.EllipticCurvePrivateKey, str] | None:
    """The private key object and public key for sending, cached per database file; None before the pair exists."""
    k = _db_key(conn)
    with _KEYS_LOCK:
        cached = _KEYS.get(k)
    row = conn.execute("SELECT private_pem, public_key FROM push_vapid WHERE id = 1").fetchone()
    if not row:
        return None
    if cached and cached[1] == row[1]:
        return cached
    key = serialization.load_pem_private_key(row[0].encode("ascii"), password=None)
    assert isinstance(key, ec.EllipticCurvePrivateKey)
    pair = (key, str(row[1]))
    with _KEYS_LOCK:
        _KEYS[k] = pair
    return pair


def vapid_authorization(key: ec.EllipticCurvePrivateKey, public_key: str, endpoint: str, subject: str = SUBJECT, now: float | None = None) -> str:
    u = urlsplit(endpoint)
    claims = {"aud": f"{u.scheme}://{u.netloc}", "exp": int(now if now is not None else time.time()) + 12 * 3600, "sub": subject}
    head = b64u(json.dumps({"typ": "JWT", "alg": "ES256"}, separators=(",", ":")).encode())
    body = b64u(json.dumps(claims, separators=(",", ":")).encode())
    r, s = decode_dss_signature(key.sign(f"{head}.{body}".encode("ascii"), ec.ECDSA(hashes.SHA256())))
    return f"vapid t={head}.{body}.{b64u(r.to_bytes(32, 'big') + s.to_bytes(32, 'big'))}, k={public_key}"


# ---------------------------------------------------------------- RFC 8291 / RFC 8188 encryption

def _hmac(key: bytes, data: bytes) -> bytes:
    return hmac.new(key, data, hashlib.sha256).digest()


def encrypt(payload: bytes, p256dh: str, auth: str, *, salt: bytes | None = None, server_key: ec.EllipticCurvePrivateKey | None = None) -> bytes:
    """One `aes128gcm` record for the subscription's keys (salt and server key are fixed only by the known-answer test)."""
    ua_public = b64u_dec(p256dh)
    auth_secret = b64u_dec(auth)
    ua_key = ec.EllipticCurvePublicKey.from_encoded_point(ec.SECP256R1(), ua_public)
    as_key = server_key or ec.generate_private_key(ec.SECP256R1())
    as_public = as_key.public_key().public_bytes(serialization.Encoding.X962, serialization.PublicFormat.UncompressedPoint)
    ecdh_secret = as_key.exchange(ec.ECDH(), ua_key)
    # RFC 8291 §3.3: IKM = HKDF(auth_secret, ecdh_secret, "WebPush: info" || 0x00 || ua_public || as_public, 32)
    prk_key = _hmac(auth_secret, ecdh_secret)
    ikm = _hmac(prk_key, b"WebPush: info\x00" + ua_public + as_public + b"\x01")
    salt = salt or os.urandom(16)
    prk = _hmac(salt, ikm)
    cek = _hmac(prk, b"Content-Encoding: aes128gcm\x00\x01")[:16]
    nonce = _hmac(prk, b"Content-Encoding: nonce\x00\x01")[:12]
    record = AESGCM(cek).encrypt(nonce, payload + b"\x02", None)  # 0x02: the last (and only) record, no padding
    return salt + RECORD_SIZE.to_bytes(4, "big") + bytes([len(as_public)]) + as_public + record


# ---------------------------------------------------------------- subscriptions

class InvalidSubscription(ValueError):
    def __init__(self, code: str, message: str):
        super().__init__(code)
        self.code = code
        self.message = message


HOST_RE = re.compile(r"^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$")


def allowed_endpoint(endpoint: str) -> bool:
    """https, no credentials, no explicit port (so the VAPID `aud` is exactly scheme://host), a plain DNS host name, and
    a host on the push-service allow-list."""
    try:
        u = urlsplit(endpoint)
        port = u.port
    except ValueError:
        return False
    host = (u.hostname or "").lower()
    if u.scheme != "https" or not host or u.username or u.password or port is not None or u.netloc.lower() != host or not HOST_RE.match(host):
        return False
    return any(host == s or host.endswith("." + s) for s in PUSH_HOST_SUFFIXES)


def validate(endpoint: str, p256dh: str, auth: str) -> None:
    if len(endpoint) > MAX_ENDPOINT_LEN or not allowed_endpoint(endpoint):
        raise InvalidSubscription("push_endpoint_refused", "כתובת ההרשמה אינה של שירות Push מוכר (Google, Mozilla, Apple, Microsoft).")
    try:
        raw = b64u_dec(p256dh)
        if len(raw) != 65 or raw[0] != 4:
            raise ValueError("shape")
        ec.EllipticCurvePublicKey.from_encoded_point(ec.SECP256R1(), raw)
        if len(b64u_dec(auth)) != 16:
            raise ValueError("auth")
    except (ValueError, TypeError):
        raise InvalidSubscription("push_keys_invalid", "מפתחות ההרשמה של הדפדפן אינם תקינים.") from None


def row_out(r: sqlite3.Row) -> dict[str, Any]:
    """A subscription as the API returns it: never the endpoint itself or the keys."""
    return {
        "id": r["id"], "endpoint_host": endpoint_host(r["endpoint"]), "endpoint_hash": endpoint_hash(r["endpoint"]), "user_agent": r["user_agent"], "channel": r["channel"],
        "created_at": r["created_at"], "last_seen_at": r["last_seen_at"], "last_ok_at": r["last_ok_at"], "failures": r["failures"], "last_error": r["last_error"],
    }


def list_own(conn: sqlite3.Connection, user_id: str) -> list[dict[str, Any]]:
    return [row_out(r) for r in conn.execute("SELECT * FROM push_subscriptions WHERE user_id = ? ORDER BY created_at", (user_id,)).fetchall()]


def upsert(conn: sqlite3.Connection, principal: Principal, endpoint: str, p256dh: str, auth: str, user_agent: str | None, old_endpoint: str | None = None) -> tuple[dict[str, Any], str | None, bool]:
    """Create or refresh the caller's subscription for this browser. Returns (row, previous owner, created) - an endpoint belongs
    to one browser profile, so when another HA user signs in there and subscribes, the subscription moves to them
    (the previous user's alerts must not keep arriving on a browser someone else now uses)."""
    validate(endpoint, p256dh, auth)
    now = now_iso()
    ua = (user_agent or "")[:300] or None
    if old_endpoint and old_endpoint != endpoint:  # pushsubscriptionchange: the browser replaced it; only our own is removed
        conn.execute("DELETE FROM push_subscriptions WHERE endpoint = ? AND user_id = ?", (old_endpoint, principal.user_id))
    existing = conn.execute("SELECT * FROM push_subscriptions WHERE endpoint = ?", (endpoint,)).fetchone()
    previous = None
    if existing:
        previous = existing["user_id"] if existing["user_id"] != principal.user_id else None
        conn.execute(
            "UPDATE push_subscriptions SET user_id = ?, p256dh = ?, auth = ?, user_agent = COALESCE(?, user_agent), channel = ?, last_seen_at = ?, failures = 0, last_error = NULL"
            + (", created_at = ?" if previous else "") + " WHERE id = ?",
            (principal.user_id, p256dh, auth, ua, principal.source, now, *((now,) if previous else ()), existing["id"]),
        )
        sid = existing["id"]
    else:
        sid = new_id()
        conn.execute(
            "INSERT INTO push_subscriptions(id, user_id, endpoint, p256dh, auth, user_agent, channel, created_at, last_seen_at) VALUES (?,?,?,?,?,?,?,?,?)",
            (sid, principal.user_id, endpoint, p256dh, auth, ua, principal.source, now, now),
        )
    # a user keeps at most MAX_SUBSCRIPTIONS_PER_USER browsers: the ones not seen for the longest go first
    extra = conn.execute("SELECT id FROM push_subscriptions WHERE user_id = ? ORDER BY last_seen_at DESC, created_at DESC LIMIT -1 OFFSET ?", (principal.user_id, MAX_SUBSCRIPTIONS_PER_USER)).fetchall()
    for r in extra:
        conn.execute("DELETE FROM push_subscriptions WHERE id = ?", (r["id"],))
    return row_out(conn.execute("SELECT * FROM push_subscriptions WHERE id = ?", (sid,)).fetchone()), previous, existing is None


def prune(db: Database, days: int = STALE_DAYS) -> int:
    """Janitor: subscriptions whose browser has not synced for `days` (the app re-syncs on every start)."""
    cutoff = (dt.datetime.now(dt.timezone.utc) - dt.timedelta(days=days)).replace(microsecond=0).isoformat().replace("+00:00", "Z")
    with db.connection() as conn:
        return conn.execute("DELETE FROM push_subscriptions WHERE last_seen_at < ?", (cutoff,)).rowcount


# ---------------------------------------------------------------- preferences

def get_prefs(conn: sqlite3.Connection, user_id: str) -> dict[str, Any]:
    r = conn.execute("SELECT categories_json, quiet_json, updated_at FROM push_prefs WHERE user_id = ?", (user_id,)).fetchone()
    cats = dict(DEFAULT_CATEGORIES)
    quiet = dict(DEFAULT_QUIET)
    if r:
        try:
            cats.update({k: bool(v) for k, v in json.loads(r["categories_json"]).items() if k in CATEGORIES})
            quiet.update({k: v for k, v in json.loads(r["quiet_json"]).items() if k in DEFAULT_QUIET})
        except (ValueError, AttributeError):
            pass
    return {"categories": cats, "quiet": quiet, "updated_at": r["updated_at"] if r else None}


def set_prefs(conn: sqlite3.Connection, user_id: str, categories: dict[str, bool], quiet: dict[str, Any]) -> dict[str, Any]:
    cats = {**DEFAULT_CATEGORIES, **{k: bool(v) for k, v in categories.items() if k in CATEGORIES}}
    q = {**DEFAULT_QUIET, **{k: v for k, v in quiet.items() if k in DEFAULT_QUIET}}
    conn.execute(
        "INSERT INTO push_prefs(user_id, categories_json, quiet_json, updated_at) VALUES (?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET categories_json = excluded.categories_json, quiet_json = excluded.quiet_json, updated_at = excluded.updated_at",
        (user_id, json.dumps(cats), json.dumps(q), now_iso()),
    )
    return get_prefs(conn, user_id)


def in_quiet_hours(quiet: dict[str, Any], at: dt.datetime, tz_name: str) -> bool:
    if not quiet.get("enabled"):
        return False
    from .rules import in_window  # the same overnight-aware window logic the rules use

    return in_window({"from": quiet.get("from") or "22:00", "to": quiet.get("to") or "07:00"}, at, tz_name)[0]


# ---------------------------------------------------------------- notices (what the rules engine hands over)

FAULT_TYPES = {"offline", "tamper", "storage"}


def category_of(event_type: str | None, source: str | None, availability: str | None = None) -> str:
    if event_type == "door":
        return "doors"
    if event_type in FAULT_TYPES or availability == "lost":
        return "device_faults"
    if event_type == "system" or source == "system":
        return "system"
    return "alerts"


def notice_from_fired(item: dict[str, Any]) -> dict[str, Any]:
    """The part of a fired rule alert (services/rules.evaluate_event) the push path needs; nothing else crosses over."""
    p = item.get("_push") or {}
    return {
        "alert_id": item.get("id"), "event_id": item.get("event_id"), "rule_name": item.get("rule_name") or "", "message": item.get("message") or "",
        "camera_id": p.get("camera_id"), "entity_id": p.get("entity_id"), "event_type": p.get("event_type"), "source": p.get("source"),
        "severity": p.get("severity") or "info", "availability": p.get("availability"), "occurred_at": p.get("occurred_at"), "place": p.get("place"),
    }


def _clip(text: str, n: int) -> str:
    text = " ".join(str(text or "").split())
    return text if len(text) <= n else text[: n - 1] + "…"


def payload_for(notice: dict[str, Any], camera_name: str | None) -> dict[str, Any]:
    """The whole message a push service carries (encrypted): no token, no endpoint, no image, no source URL."""
    body = notice.get("message") or notice.get("rule_name") or "התראה חדשה"
    where = camera_name or notice.get("place")
    if where and where not in body:
        body = f"{body} · {where}"
    event_id = str(notice.get("event_id") or "")
    return {
        "v": 1,
        "title": _clip(f"Arx · {notice.get('rule_name') or 'התראה'}", 80),
        "body": _clip(body, 180),
        "url": f"#/investigate/events/{event_id}" if event_id else "#/investigate/events",
        "event_id": event_id or None,
        "alert_id": notice.get("alert_id"),
        "tag": f"arx-alert-{notice.get('alert_id') or event_id}",
        "category": category_of(notice.get("event_type"), notice.get("source"), notice.get("availability")),
        "severity": notice.get("severity") or "info",
        "ts": notice.get("occurred_at"),
    }


def encode_payload(payload: dict[str, Any]) -> bytes:
    data = json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    if len(data) > MAX_PAYLOAD:
        payload = {**payload, "body": _clip(payload.get("body") or "", 60)}
        data = json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    return data


# ---------------------------------------------------------------- per-user rate limits

class _Bucket:
    def __init__(self, burst: int, per_min: float) -> None:
        self.burst, self.rate = float(burst), per_min / 60.0
        self.tokens, self.at = float(burst), time.monotonic()

    def take(self) -> bool:
        now = time.monotonic()
        self.tokens = min(self.burst, self.tokens + (now - self.at) * self.rate)
        self.at = now
        if self.tokens >= 1.0:
            self.tokens -= 1.0
            return True
        return False


_BUCKETS: dict[tuple[str, str], _Bucket] = {}
_BUCKETS_LOCK = threading.Lock()


def take_token(user_id: str, lane: str = "alert") -> bool:
    burst, per_min = (TEST_BURST, TEST_PER_MIN) if lane == "test" else (RATE_BURST, RATE_PER_MIN)
    with _BUCKETS_LOCK:
        b = _BUCKETS.get((lane, user_id))
        if b is None:
            b = _BUCKETS[(lane, user_id)] = _Bucket(burst, per_min)
        return b.take()


def reset_limits() -> None:
    with _BUCKETS_LOCK:
        _BUCKETS.clear()


# ---------------------------------------------------------------- recipients

@dataclass
class Job:
    sub_id: str
    user_id: str
    endpoint: str
    p256dh: str
    auth: str
    payload: bytes
    urgency: str = "normal"
    attempt: int = 0
    camera_id: str | None = None  # the alert's camera (None = camera-less): what reach is re-checked against on a retry
    notification_id: str | None = None  # CR-018: set for a notification delivery - reach is then re-checked through services/notify_visibility
    delivery_id: str | None = None  # the delivery-log row this attempt updates
    mode: str = "new"  # new | renotify | escalate | resolved


def plan(conn: sqlite3.Connection, notice: dict[str, Any], now: dt.datetime | None = None, tz_name: str | None = None) -> tuple[list[Job], dict[str, str]]:
    """Who gets this alert: every user with a subscription who may see it (row_scope events.read - the alert list's own
    rule), whose preferences take its category, outside their quiet hours (a critical alert may pass when allowed), and
    within their rate limit. Returns the jobs and a decision per user (for tests and the log)."""
    from .access import row_scope

    now = now or dt.datetime.now(dt.timezone.utc)
    if tz_name is None:
        from ..routers.settings import read_settings

        tz_name = read_settings(conn)["time.zone"]
    camera_id = notice.get("camera_id")
    cam = conn.execute("SELECT alias, name_source, channel FROM cameras WHERE id = ?", (camera_id,)).fetchone() if camera_id else None
    camera_name = (cam["alias"] or cam["name_source"] or f"ערוץ {cam['channel']}") if cam else None
    payload = encode_payload(payload_for(notice, camera_name))
    category = category_of(notice.get("event_type"), notice.get("source"), notice.get("availability"))
    critical = notice.get("severity") == "critical"
    jobs: list[Job] = []
    decisions: dict[str, str] = {}
    by_user: dict[str, list[sqlite3.Row]] = {}
    for s in conn.execute("SELECT * FROM push_subscriptions ORDER BY user_id, created_at").fetchall():
        by_user.setdefault(s["user_id"], []).append(s)
    for user_id, subs in by_user.items():
        u = conn.execute("SELECT id, username, display_name, source, active FROM users WHERE id = ?", (user_id,)).fetchone()
        if u is None or not u["active"]:
            decisions[user_id] = "inactive"
            continue
        principal = Principal(user_id=u["id"], username=u["username"] or "", display_name=u["display_name"] or "", source="push")
        if not row_scope(conn, principal, "events.read").allows_row(camera_id):
            decisions[user_id] = "no_reach"
            STATS["refused"] += 1
            continue
        prefs = get_prefs(conn, user_id)
        if not prefs["categories"].get(category, True):
            decisions[user_id] = "category_off"
            continue
        if in_quiet_hours(prefs["quiet"], now, tz_name) and not (critical and prefs["quiet"].get("allow_critical")):
            decisions[user_id] = "quiet_hours"
            continue
        if not take_token(user_id):
            decisions[user_id] = "rate_limited"
            STATS["rate_limited"] += 1
            continue
        decisions[user_id] = "send"
        for s in subs:
            jobs.append(Job(s["id"], user_id, s["endpoint"], s["p256dh"], s["auth"], payload, "high" if critical else "normal", camera_id=camera_id))
    return jobs, decisions


def still_allowed(conn: sqlite3.Connection, job: Job) -> Job | None:
    """Before a retry (up to minutes later): the subscription must still exist and still belong to the user the alert
    was planned for (an endpoint moves to whoever subscribes that browser next), that user must be active and must still
    reach the alert (row_scope events.read - a revoked binding or a new deny counts at once). Returns the job with the
    subscription's current keys, or None."""
    from .access import row_scope

    s = conn.execute("SELECT * FROM push_subscriptions WHERE id = ?", (job.sub_id,)).fetchone()
    if s is None or s["user_id"] != job.user_id:
        return None
    u = conn.execute("SELECT id, username, display_name, active FROM users WHERE id = ?", (job.user_id,)).fetchone()
    if u is None or not u["active"]:
        return None
    principal = Principal(user_id=u["id"], username=u["username"] or "", display_name=u["display_name"] or "", source="push")
    if job.notification_id:  # CR-018: the notification's own visibility rules (every subject kind), not only events.read
        from .notify import _row_note
        from .notify_visibility import Reach

        n = conn.execute("SELECT * FROM notifications WHERE id = ?", (job.notification_id,)).fetchone()
        if n is None or (n["state"] == "resolved" and job.mode != "resolved") or (job.mode == "escalate" and n["state"] != "open") or not Reach(conn, principal).can_see(_row_note(n)):
            STATS["refused"] += 1
            return None
    elif not row_scope(conn, principal, "events.read").allows_row(job.camera_id):
        STATS["refused"] += 1
        return None
    job.endpoint, job.p256dh, job.auth = s["endpoint"], s["p256dh"], s["auth"]
    return job


# ---------------------------------------------------------------- sending

@dataclass
class Outcome:
    status: int  # HTTP status from the push service; 0 = no answer (network error, timeout)
    retry_after: float | None = None
    error: str | None = None


def send(job: Job, key: tuple[ec.EllipticCurvePrivateKey, str]) -> Outcome:
    private, public = key
    if not allowed_endpoint(job.endpoint):  # checked at subscribe time too; a row edited by hand is never called
        return Outcome(400, error="endpoint_refused")
    headers = {
        "Authorization": vapid_authorization(private, public, job.endpoint),
        "Content-Encoding": "aes128gcm",
        "Content-Type": "application/octet-stream",
        "TTL": str(TTL_S),
        "Urgency": job.urgency,
    }
    try:
        body = encrypt(job.payload, job.p256dh, job.auth)
        with httpx.Client(timeout=SEND_TIMEOUT_S, transport=TRANSPORT, follow_redirects=False) as client:
            r = client.post(job.endpoint, content=body, headers=headers)
    except (httpx.HTTPError, OSError) as exc:
        return Outcome(0, error=type(exc).__name__)
    except ValueError as exc:  # broken keys stored before validation existed
        return Outcome(400, error=type(exc).__name__)
    retry_after = None
    ra = r.headers.get("retry-after")
    if ra:
        try:
            retry_after = min(MAX_RETRY_AFTER_S, max(0.0, float(ra)))
        except ValueError:
            retry_after = None
    return Outcome(r.status_code, retry_after, None if r.is_success else f"http_{r.status_code}")


def retryable(status: int) -> bool:
    return status == 0 or status == 429 or status >= 500


def record(db: Database, job: Job, outcome: Outcome, final: bool) -> str:
    """Store what the push service said. 2xx → sent; 404/410 → the subscription is gone and removed; retryable while
    attempts remain → retry (nothing stored yet); anything else counts a failure (dropped after DROP_AFTER_FAILURES).
    A notification delivery (CR-018) also updates its delivery-log row in the same short transaction."""
    st = outcome.status
    with db.connection(label="push.record") as conn:
        result = _record(conn, job, outcome, final)
        if job.delivery_id:
            _log_delivery(conn, job, result, outcome, job.attempt + 1)
        return result


def _record(conn: sqlite3.Connection, job: Job, outcome: Outcome, final: bool) -> str:
    st = outcome.status
    if 200 <= st < 300:
        conn.execute("UPDATE push_subscriptions SET last_ok_at = ?, failures = 0, last_error = NULL WHERE id = ?", (now_iso(), job.sub_id))
        STATS["sent"] += 1
        STATS["last_sent_at"] = now_iso()
        return "sent"
    if st in (404, 410):
        conn.execute("DELETE FROM push_subscriptions WHERE id = ?", (job.sub_id,))
        STATS["gone"] += 1
        log.info("push subscription %s removed: the push service at %s answered %s", job.sub_id, endpoint_host(job.endpoint), st)
        return "gone"
    if retryable(st) and not final:
        STATS["retried"] += 1
        return "retry"
    conn.execute("UPDATE push_subscriptions SET failures = failures + 1, last_error = ? WHERE id = ?", (outcome.error or f"http_{st}", job.sub_id))
    row = conn.execute("SELECT failures FROM push_subscriptions WHERE id = ?", (job.sub_id,)).fetchone()
    STATS["failed"] += 1
    STATS["last_error"] = outcome.error or f"http_{st}"
    log.warning("push to %s failed: %s", endpoint_host(job.endpoint), outcome.error or st)
    if row and row["failures"] >= DROP_AFTER_FAILURES:
        conn.execute("DELETE FROM push_subscriptions WHERE id = ?", (job.sub_id,))
        return "dropped"
    return "failed"


def _log_delivery(conn: sqlite3.Connection, job: Job, result: str, outcome: Outcome, attempt: int) -> None:
    """Update the delivery-log row of a notification push: status and reason (http_<n> / a network error class), the attempt
    number, and - when it failed for good - a `delivery_failed` entry on the notification's timeline."""
    status = {"sent": "sent", "gone": "gone", "retry": "retry", "failed": "failed", "dropped": "failed"}.get(result, "failed")
    reason = None if status == "sent" else (outcome.error or f"http_{outcome.status}")
    conn.execute("UPDATE notification_deliveries SET status = ?, reason = ?, attempt = ?, sent_at = CASE WHEN ? = 'sent' THEN ? ELSE sent_at END WHERE id = ?", (status, reason, attempt, status, now_iso(), job.delivery_id))
    if status in ("failed", "gone") and job.notification_id:
        conn.execute("INSERT INTO notification_events(notification_id, at, kind, channel) VALUES (?,?,?,?)", (job.notification_id, now_iso(), "delivery_failed", "webpush"))


def send_test(db: Database, user_id: str) -> list[dict[str, Any]]:
    """The settings tab's test button: one notification to each of the caller's own subscriptions, once, now (the caller
    has already been rate limited). Runs outside any request transaction."""
    with db.connection(mode="read") as conn:
        key = signing_key(conn)
        subs = conn.execute("SELECT * FROM push_subscriptions WHERE user_id = ? ORDER BY created_at", (user_id,)).fetchall()
    if key is None:
        return []
    payload = encode_payload({"v": 1, "title": "Arx · התראת בדיקה", "body": "ההתראות פועלות במכשיר הזה.", "url": "#/system/notifications", "event_id": None,
                              "alert_id": None, "tag": "arx-test", "category": "test", "severity": "info", "ts": now_iso()})
    out = []
    for s in subs:
        job = Job(s["id"], user_id, s["endpoint"], s["p256dh"], s["auth"], payload)
        o = send(job, key)
        out.append({"id": s["id"], "endpoint_host": endpoint_host(s["endpoint"]), "status": o.status, "outcome": record(db, job, o, final=True)})
    return out


# ---------------------------------------------------------------- the worker

class PushNotifier:
    """Fans notifications out to the channels (Web Push here; others plug in through services/notify_channels) on a thread of its own. `enqueue` / `wake` never block and never
    touch the database (the writers call them right after their commit); retries wait in a heap, not in a sleep. The same
    thread drains the notification outbox (CR-018) and runs the escalation timer."""

    OUTBOX_POLL_S = 2.0  # the outbox is also polled: rows written by a writer that never calls wake() (a monitor) wait at most this long
    ESCALATION_POLL_S = 10.0
    HOUSEKEEPING_S = 300.0

    def __init__(self) -> None:
        self.q: queue.Queue[dict[str, Any] | None] = queue.Queue(maxsize=QUEUE_MAX)
        self.retries: list[tuple[float, int, Any]] = []  # a push Job, or any channel job with run_retry() / recheck() (services/notify_channels)
        self.seq = itertools.count()
        self.db: Database | None = None
        self.thread: threading.Thread | None = None
        self.stop_evt = threading.Event()
        self.inflight = 0  # retry jobs taken off the heap and not yet finished (drain() waits for them too)
        self.dirty = False  # a wake() not yet answered by an outbox pass (drain() waits for it)
        self._next_outbox = 0.0
        self._next_escalation = 0.0
        self._next_housekeeping = 0.0

    @property
    def running(self) -> bool:
        return bool(self.thread and self.thread.is_alive()) and not self.stop_evt.is_set()

    def start(self, db: Database) -> None:
        if self.running:
            return
        if self.thread and self.thread.is_alive():  # a shutdown still winding down: let it finish first
            self.thread.join(timeout=5.0)
        self.db = db
        self.stop_evt.clear()
        self.q = queue.Queue(maxsize=QUEUE_MAX)
        self.retries = []
        self.inflight = 0
        self.dirty = True  # rows a previous process left in the outbox go out now
        self._next_outbox = self._next_escalation = 0.0
        self._next_housekeeping = time.monotonic() + 30.0
        self.thread = threading.Thread(target=self._loop, name="push-notifier", daemon=True)
        self.thread.start()
        self.q.put_nowait({"_wake": True})  # the first outbox pass without waiting for the poll

    def shutdown(self, timeout: float = 5.0) -> None:
        """Stop the worker: alerts already queued get up to `timeout` seconds to go out; pending retries are given up
        (counted as dropped_shutdown)."""
        if self.running:
            self.drain(timeout, retries=False)
        self.stop_evt.set()
        try:
            self.q.put_nowait(None)
        except queue.Full:
            pass
        if self.thread and self.thread is not threading.current_thread():
            self.thread.join(timeout=2.0)
        if self.retries:
            STATS["dropped_shutdown"] += len(self.retries)
            self.retries = []

    def enqueue(self, notices: list[dict[str, Any]]) -> int:
        if not self.running:
            return 0
        n = 0
        for notice in notices:
            try:
                self.q.put_nowait(notice)
                n += 1
                STATS["queued"] += 1
            except queue.Full:
                STATS["dropped_queue"] += 1
        return n

    def wake(self) -> None:
        """There is outbox work: the notifier looks at it within a moment (and polls it every OUTBOX_POLL_S regardless)."""
        if not self.running:
            return
        self.dirty = True
        try:
            self.q.put_nowait({"_wake": True})
        except queue.Full:
            pass  # a full queue is already busy; the poll picks the outbox up

    def process(self, notice: dict[str, Any]) -> None:
        assert self.db is not None
        if notice.get("_wake"):
            return  # a wake-up call: the loop runs the outbox right after
        with self.db.connection(mode="read", label="push.plan") as conn:
            key = signing_key(conn)
            if key is None:
                return  # nobody ever subscribed: no key pair yet, nothing to send
            jobs, _ = plan(conn, notice)
        for job in jobs:
            self.attempt(job, key)

    # -- a push job
    def attempt(self, job: Job, key: tuple[ec.EllipticCurvePrivateKey, str]) -> str:
        assert self.db is not None
        outcome = send(job, key)
        final = job.attempt + 1 >= len(BACKOFF_S) + 1
        result = record(self.db, job, outcome, final)
        if result == "retry":
            delay = outcome.retry_after if outcome.retry_after is not None else BACKOFF_S[job.attempt]
            job.attempt += 1
            heapq.heappush(self.retries, (time.monotonic() + delay, next(self.seq), job))
        return result

    # -- any other channel's job (services/notify_channels.Channel): scheduled for a retry, re-checked and re-run by the same thread
    def schedule(self, delay: float, job: Any) -> None:
        """Queue a retry of a channel job. The job must offer `recheck(db) -> bool` (is it still allowed to go out - visibility, the policy,
        the configuration) and `run_retry(notifier) -> None` (one more attempt, which may `schedule` again)."""
        heapq.heappush(self.retries, (time.monotonic() + delay, next(self.seq), job))

    def _due(self) -> float | None:
        return self.retries[0][0] - time.monotonic() if self.retries else None

    def _loop(self) -> None:
        while not self.stop_evt.is_set():
            wait = self._due()
            try:
                item = self.q.get(timeout=max(0.0, min(wait, 1.0)) if wait is not None else 1.0)
            except queue.Empty:
                item = None
            if self.stop_evt.is_set():
                return
            try:
                woke = False
                if item is not None:
                    try:
                        woke = bool(item.get("_wake"))
                        if woke:
                            time.sleep(0.12)  # the writer that woke us is committing: its outbox rows are visible a moment later
                        else:
                            self.process(item)
                    finally:
                        self.q.task_done()
                self.run_due()
                self.tick(force=woke)
            except Exception:  # noqa: BLE001 - the worker never dies on one bad alert
                log.exception("push delivery failed")

    def tick(self, force: bool = False) -> None:
        """The periodic work: the notification outbox (at once after a wake-up, else every OUTBOX_POLL_S), the escalation timer
        and, rarely, retention housekeeping and the channel-down check."""
        assert self.db is not None
        from . import notify_channels

        now = time.monotonic()
        if force or self.dirty or now >= self._next_outbox:
            self.dirty = False
            self._next_outbox = now + self.OUTBOX_POLL_S
            notify_channels.process_outbox(self)
        if now >= self._next_escalation:
            self._next_escalation = now + self.ESCALATION_POLL_S
            notify_channels.escalate(self.db)
        if now >= self._next_housekeeping:
            self._next_housekeeping = now + self.HOUSEKEEPING_S
            notify_channels.housekeeping(self.db)

    def run_due(self) -> int:
        """Send every retry whose time has come - each one re-checked first (still_allowed, or the channel job's own recheck). Returns how
        many ran."""
        assert self.db is not None
        n = 0
        while self.retries and self.retries[0][0] <= time.monotonic():
            self.inflight += 1  # before the pop: drain() never sees an empty heap with a retry still on its way
            try:
                _, _, job = heapq.heappop(self.retries)
                if hasattr(job, "run_retry"):  # another channel's job (e-mail, later Companion): it re-checks itself
                    if job.recheck(self.db):
                        job.run_retry(self)
                    else:
                        STATS["retry_skipped"] += 1
                else:
                    with self.db.connection(mode="read", label="push.retry") as conn:
                        key = signing_key(conn)
                        fresh = still_allowed(conn, job) if key else None
                    if key and fresh:
                        self.attempt(fresh, key)
                    else:
                        STATS["retry_skipped"] += 1
                n += 1
            finally:
                self.inflight -= 1
        return n

    def outbox_pending(self) -> bool:
        if self.db is None:
            return False
        try:
            with self.db.connection(mode="read", label="notify.pending") as conn:
                return conn.execute("SELECT 1 FROM notify_outbox LIMIT 1").fetchone() is not None
        except Exception:  # noqa: BLE001
            return False

    def drain(self, timeout: float = 5.0, retries: bool = True) -> bool:
        """Wait until nothing is queued or in flight (and, with `retries`, nothing waits in the retry heap); returns
        whether that happened within `timeout`. The notification outbox counts as queued work while the worker runs."""
        deadline = time.monotonic() + timeout
        while self.q.unfinished_tasks or self.inflight or self.dirty or (retries and self.retries) or (self.running and self.outbox_pending()):
            if time.monotonic() >= deadline:
                return False
            time.sleep(0.02)
        return True


NOTIFIER = PushNotifier()


def enqueue_fired(fired: list[dict[str, Any]]) -> int:
    """Called by services/rules.deliver_pending after the caller's commit: one notice per fired alert."""
    if not fired or not NOTIFIER.running:
        for item in fired:
            item.pop("_push", None)
        return 0
    notices = [notice_from_fired(item) for item in fired]
    for item in fired:
        item.pop("_push", None)
    return NOTIFIER.enqueue(notices)

