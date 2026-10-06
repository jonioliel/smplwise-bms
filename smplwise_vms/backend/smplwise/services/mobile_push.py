"""CR-027 phase 2: push to the SmplWise Arx phone app through the SmplWise push relay - one more CR-018 delivery channel (`app`).

How it works (docs/api/mobile-presence-contract.md section 7, CR-027 section 6):
- the app registers its APNs / FCM token with the SmplWise RELAY and gets an opaque relay token; it registers THAT with this
  server (`POST notifications/devices`, device token). The server never sees the platform token; the relay never sees any text;
- a notification dispatch plans one target per registered device of each recipient (visibility re-checked, the user's per-device
  mutes, quiet hours by the matrix's PUSH column, the per-user push rate), writes one `mobile_push_messages` row per target with
  the real title / body at the administrator's lock-screen level, and calls the relay with `{relay_token, category,
  notification_id (= the message id), priority, server}` only;
- the app's notification extension fetches `GET notifications/app/{message_id}` with its device token (24 h expiry) and shows
  the text; if that fails the generic text stays. A 404 / 410 from the relay drops the device's push registration; 429 / 5xx /
  network errors retry on the notifier's heap with the same re-checks as every channel.

Configuration: `SW_PUSH_RELAY_URL` (e.g. https://push.smplwise.com) and `SW_PUSH_RELAY_KEY` (this server's key at the relay),
runtime only - never in git, never in a backup, never logged. Without them the channel plans `skipped / channel_unavailable`.
`TRANSPORT` lets the tests install a fake relay (httpx.MockTransport). The installation's opaque `server` id (the relay's
thread / grouping key) is generated once (`push.server_id` in settings) and carries no address."""
from __future__ import annotations

import datetime as dt
import logging
import os
import re
import secrets
import sqlite3
import time
from dataclasses import dataclass
from typing import Any

import httpx

from ..db import Database, get_setting, new_id, now_iso, set_setting
from ..errors import ApiError
from . import notify, notify_channels, push
from .notify_policy import CATEGORIES
from .notify_visibility import Reach, principal_of
from .presence import _json, get_device, iso, now_utc
from .timeutil import iso_utc

log = logging.getLogger("smplwise.mobile_push")

CHANNEL = "app"
MESSAGE_TTL_H = 24
RELAY_TOKEN_RE = re.compile(r"^[A-Za-z0-9_\-\.]{16,256}$")
SEND_TIMEOUT_S = 10.0
BACKOFF_S: tuple[float, ...] = (5.0, 30.0, 120.0)
MAX_RETRY_AFTER_S = 300.0
DROP_AFTER_FAILURES = 10
TEST_BURST, TEST_PER_MIN = 3, 3.0
TRANSPORT: httpx.BaseTransport | None = None
STATS: dict[str, Any] = {"sent": 0, "gone": 0, "failed": 0, "retried": 0, "skipped_unconfigured": 0, "last_error": None, "last_sent_at": None}

CATEGORY_NAMES_HE: dict[str, str] = {"safety": "בטיחות", "alerts": "התראות", "doors": "דלתות וחלונות", "device_faults": "תקלות בהתקנים", "automations": "אוטומציות", "system": "מערכת", "security": "אבטחה וכניסות"}
CRITICAL_CATEGORIES = ("safety",)


def relay_url() -> str | None:
    u = (os.environ.get("SW_PUSH_RELAY_URL") or "").strip().rstrip("/")
    return u if u.startswith("https://") or (u.startswith("http://") and TRANSPORT is not None) else None


def relay_key() -> str | None:
    return (os.environ.get("SW_PUSH_RELAY_KEY") or "").strip() or None


def configured() -> bool:
    return bool(relay_url() and relay_key())


def categories() -> list[dict[str, Any]]:
    return [{"id": c, "name": CATEGORY_NAMES_HE.get(c, c), "critical": c in CRITICAL_CATEGORIES} for c in CATEGORIES]


def server_id(conn: sqlite3.Connection) -> str:
    """The installation's opaque id at the relay (the app groups notifications by it). Created once; needs a write connection then."""
    sid = get_setting(conn, "push.server_id")
    if not sid:
        sid = "srv_" + secrets.token_hex(8)
        set_setting(conn, "push.server_id", sid)
    return sid


# ---------------------------------------------------------------- registration (device token routes)

def register(conn: sqlite3.Connection, device: dict[str, Any] | sqlite3.Row, platform: Any, relay_token: Any, app_version: Any) -> dict[str, Any]:
    if platform not in ("ios", "android"):
        raise ApiError(400, "invalid_platform", "הפלטפורמה אינה מוכרת (ios / android).", details={"field": "platform"})
    if not isinstance(relay_token, str) or not RELAY_TOKEN_RE.match(relay_token):
        raise ApiError(400, "invalid_relay_token", "אסימון הממסר אינו תקין.", details={"field": "relay_token"})
    now = now_iso()
    conn.execute(
        "UPDATE mobile_devices SET push_platform = ?, push_relay_token = ?, push_app_version = ?, push_registered_at = COALESCE(push_registered_at, ?), push_failures = 0, push_last_error = NULL, last_seen_at = ? WHERE id = ?",
        (platform, relay_token, (str(app_version or "")[:80] or None), now, now, device["id"]),
    )
    return push_view(get_device(conn, device["id"]), server_id(conn))


def set_muted(conn: sqlite3.Connection, device: dict[str, Any] | sqlite3.Row, muted: Any) -> dict[str, Any]:
    if not isinstance(muted, list) or any(m not in CATEGORIES for m in muted) or len(muted) > len(CATEGORIES):
        raise ApiError(422, "validation", "קטגוריה לא מוכרת ברשימת ההשתקה.", details={"field": "muted", "known": list(CATEGORIES)})
    import json

    conn.execute("UPDATE mobile_devices SET push_muted_json = ?, last_seen_at = ? WHERE id = ?", (json.dumps(sorted(set(muted))), now_iso(), device["id"]))
    return push_view(get_device(conn, device["id"]), server_id(conn))


def unregister(conn: sqlite3.Connection, device_id: str) -> None:
    conn.execute("UPDATE mobile_devices SET push_relay_token = NULL, push_platform = NULL, push_failures = 0, push_last_error = NULL WHERE id = ?", (device_id,))
    conn.execute("DELETE FROM mobile_push_messages WHERE device_id = ?", (device_id,))


def push_view(r: sqlite3.Row, sid: str) -> dict[str, Any]:
    """`server_id` is the opaque id the relay payload's `server` carries: the app stores it with the origin it registered at."""
    return {"device_id": r["id"], "server_id": sid, "relay_url": relay_url(), "push": {"registered": bool(r["push_relay_token"]), "platform": r["push_platform"], "muted": _json(r["push_muted_json"], []),
                                           "last_ok_at": r["push_last_ok_at"], "failures": r["push_failures"], "last_error": r["push_last_error"], "app_version": r["push_app_version"]}}


# ---------------------------------------------------------------- the message the extension fetches

def message_for(conn: sqlite3.Connection, device_id: str, message_id: str) -> dict[str, Any] | None:
    """One message of THIS device, not expired; the fetch is recorded (single use in spirit: a second fetch still answers, the
    extension may retry, but `fetched_at` tells)."""
    r = conn.execute("SELECT * FROM mobile_push_messages WHERE id = ? AND device_id = ?", (message_id, device_id)).fetchone()
    if r is None or r["expires_at"] < iso(now_utc()):
        return None
    if not r["fetched_at"]:
        conn.execute("UPDATE mobile_push_messages SET fetched_at = ? WHERE id = ?", (now_iso(), message_id))
    return {"message_id": r["id"], "notification_id": r["notification_id"], "title": r["title"], "body": r["body"], "category": r["category"], "severity": r["severity"],
            "deep_link": r["deep_link"], "at": r["at"], "mode": r["mode"]}


def _store_message(conn: sqlite3.Connection, device: sqlite3.Row | dict[str, Any], *, notification_id: str | None, delivery_id: str | None, mode: str, category: str, severity: str,
                   title: str, body: str, deep_link: str, at: dt.datetime) -> str:
    mid = new_id()
    conn.execute(
        "INSERT INTO mobile_push_messages(id, device_id, user_id, notification_id, delivery_id, mode, category, severity, title, body, deep_link, at, expires_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
        (mid, device["id"], device["user_id"], notification_id, delivery_id, mode, category, severity, push._clip(title, 120), push._clip(body, 400), deep_link[:300], iso_utc(at),
         iso(at + dt.timedelta(hours=MESSAGE_TTL_H))),
    )
    return mid


# ---------------------------------------------------------------- the relay call

@dataclass
class Outcome:
    status: int  # HTTP status from the relay; 0 = no answer
    retry_after: float | None = None
    error: str | None = None


def send_relay(relay_token: str, category: str, message_id: str, priority: str, server: str, collapse: str | None = None) -> Outcome:
    url, key = relay_url(), relay_key()
    if not url or not key:
        return Outcome(0, error="relay_unconfigured")
    body = {"relay_token": relay_token, "category": category, "notification_id": message_id, "priority": priority, "server": server}
    if collapse:
        body["collapse"] = collapse[:64]
    try:
        with httpx.Client(timeout=SEND_TIMEOUT_S, transport=TRANSPORT, follow_redirects=False) as client:
            r = client.post(f"{url}/v1/push", json=body, headers={"Authorization": f"Bearer {key}", "User-Agent": "SmplWiseArx-server"})
    except (httpx.HTTPError, OSError) as exc:
        return Outcome(0, error=type(exc).__name__)
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


def record(db: Database, device_id: str, outcome: Outcome, final: bool, *, delivery_id: str | None, notification_id: str | None, attempt: int) -> str:
    """Store the relay's answer on the device row and the delivery log: sent / gone (push dropped) / retry / failed (dropped after DROP_AFTER_FAILURES)."""
    st = outcome.status
    with db.connection(label="mobile_push.record") as conn:
        if 200 <= st < 300:
            conn.execute("UPDATE mobile_devices SET push_last_ok_at = ?, push_failures = 0, push_last_error = NULL WHERE id = ?", (now_iso(), device_id))
            STATS["sent"] += 1
            STATS["last_sent_at"] = now_iso()
            result = "sent"
        elif st in (404, 410):
            unregister(conn, device_id)
            conn.execute("UPDATE mobile_devices SET push_last_error = ? WHERE id = ?", (f"relay_{st}", device_id))
            STATS["gone"] += 1
            log.info("app push registration of device %s dropped: the relay answered %s", device_id, st)
            result = "gone"
        elif retryable(st) and not final:
            STATS["retried"] += 1
            result = "retry"
        else:
            err = outcome.error or f"http_{st}"
            conn.execute("UPDATE mobile_devices SET push_failures = push_failures + 1, push_last_error = ? WHERE id = ?", (err, device_id))
            row = conn.execute("SELECT push_failures FROM mobile_devices WHERE id = ?", (device_id,)).fetchone()
            STATS["failed"] += 1
            STATS["last_error"] = err
            log.warning("app push to device %s failed: %s", device_id, err)
            if row and row["push_failures"] >= DROP_AFTER_FAILURES:
                unregister(conn, device_id)
            result = "failed"
        if delivery_id:
            status = {"sent": "sent", "gone": "gone", "retry": "retry", "failed": "failed"}[result]
            notify_channels.set_delivery(conn, [delivery_id], status, None if status == "sent" else (outcome.error or f"http_{st}"), attempt)
            if status in ("failed", "gone") and notification_id:
                conn.execute("INSERT INTO notification_events(notification_id, at, kind, channel) VALUES (?,?,?,?)", (notification_id, now_iso(), "delivery_failed", CHANNEL))
    return result


# ---------------------------------------------------------------- the channel

@dataclass
class _Job:
    """One push attempt to one device; retried on the notifier's heap with the channel interface's recheck / run_retry."""

    device_id: str
    user_id: str
    relay_token: str
    message_id: str
    category: str
    priority: str
    server: str
    notification_id: str | None
    delivery_id: str | None
    mode: str
    attempt: int = 0

    def recheck(self, db: Database) -> bool:
        with db.connection(mode="read", label="mobile_push.recheck") as conn:
            d = get_device(conn, self.device_id)
            if d is None or d["revoked_at"] or not d["push_relay_token"]:
                return False
            self.relay_token = d["push_relay_token"]
            if self.notification_id:
                n = conn.execute("SELECT * FROM notifications WHERE id = ?", (self.notification_id,)).fetchone()
                p = principal_of(conn, self.user_id)
                if n is None or p is None or (n["state"] == "resolved" and self.mode != "resolved") or (self.mode == "escalate" and n["state"] != "open") or not Reach(conn, p).can_see(notify._row_note(n)):
                    push.STATS["refused"] += 1
                    return False
            return True

    def run_retry(self, notifier: "push.PushNotifier") -> None:
        assert notifier.db is not None
        attempt_job(notifier, notifier.db, self)


def attempt_job(notifier: "push.PushNotifier | None", db: Database, job: _Job) -> str:
    outcome = send_relay(job.relay_token, job.category, job.message_id, job.priority, job.server, collapse=job.notification_id)
    final = job.attempt + 1 >= len(BACKOFF_S) + 1
    result = record(db, job.device_id, outcome, final, delivery_id=job.delivery_id, notification_id=job.notification_id, attempt=job.attempt + 1)
    if result == "retry" and notifier is not None:
        delay = outcome.retry_after if outcome.retry_after is not None else BACKOFF_S[job.attempt]
        job.attempt += 1
        notifier.schedule(delay, job)
    return result


class AppPushChannel(notify_channels.Channel):
    name = CHANNEL

    def plan(self, d: notify_channels.Dispatch, conn: Any) -> list[notify_channels.Target]:
        out: list[notify_channels.Target] = []
        ready = configured()
        if not ready:
            STATS["skipped_unconfigured"] += 1
        for uid in d.users:
            devices = conn.execute("SELECT * FROM mobile_devices WHERE user_id = ? AND revoked_at IS NULL AND push_relay_token IS NOT NULL ORDER BY created_at", (uid,)).fetchall()
            reach = d.reach(uid)
            if reach is None or not devices:
                continue
            ref = f"app:{len(devices)}"
            if not reach.can_see(d.n):
                push.STATS["refused"] += 1
                out.append(notify_channels.Target(self.name, uid, ref, "skipped", "no_reach"))
                continue
            rec = conn.execute("SELECT snoozed_until FROM notification_recipients WHERE notification_id = ? AND user_id = ?", (d.nid, uid)).fetchone()
            if d.mode != "escalate" and rec is not None and rec["snoozed_until"] and rec["snoozed_until"] > iso_utc(d.now):
                out.append(notify_channels.Target(self.name, uid, ref, "skipped", "snoozed"))
                continue
            if d.held("webpush"):  # the app follows the matrix's push column (no column of its own)
                out.append(notify_channels.Target(self.name, uid, ref, "skipped", "quiet_hours"))
                continue
            if not ready:
                out.append(notify_channels.Target(self.name, uid, ref, "skipped", "channel_unavailable"))
                continue
            if d.severity != "critical" and d.mode != "escalate" and not push.take_token(uid, "app"):
                push.STATS["rate_limited"] += 1
                out.append(notify_channels.Target(self.name, uid, ref, "skipped", "rate_limited"))
                continue
            for dev in devices:
                if d.n["category"] in _json(dev["push_muted_json"], []) and d.severity != "critical" and d.mode != "escalate":
                    out.append(notify_channels.Target(self.name, uid, f"app:{dev['name'][:24]}", "skipped", "muted", {"device": dev}))
                    continue
                out.append(notify_channels.Target(self.name, uid, f"app:{dev['name'][:24]}", "queued", None, {"device": dev}))
        return out

    def prepare(self, d: notify_channels.Dispatch, targets: list[notify_channels.Target], conn: Any) -> None:
        text = notify_channels.payload_v2(d.n, d.settings["lockscreen"], tokens=None, door=None, tz_name=d.tz, mode=d.mode, now=d.now)
        d.scratch["app_server"] = server_id(conn)
        for t in targets:
            if t.status != "queued":
                continue
            t.data["message_id"] = _store_message(conn, t.data["device"], notification_id=d.nid, delivery_id=t.delivery_id or None, mode=d.mode, category=d.n["category"], severity=d.severity,
                                                  title=text["title"], body=text["body"], deep_link=text["url"], at=d.now)

    def send(self, notifier: "push.PushNotifier", d: notify_channels.Dispatch, targets: list[notify_channels.Target]) -> None:
        assert notifier.db is not None
        for t in targets:
            if t.status != "queued":
                continue
            dev = t.data["device"]
            job = _Job(dev["id"], t.user_id or dev["user_id"], dev["push_relay_token"], t.data["message_id"], d.n["category"], "high" if (d.severity == "critical" or d.mode == "escalate") else "normal",
                       d.scratch.get("app_server") or "srv", d.nid, t.delivery_id or None, d.mode)
            attempt_job(notifier, notifier.db, job)


notify_channels.register(AppPushChannel())


# ---------------------------------------------------------------- the test push

_TEST_BUCKETS: dict[str, Any] = {}


def take_test_token(device_id: str) -> bool:
    b = _TEST_BUCKETS.get(device_id)
    if b is None:
        b = _TEST_BUCKETS[device_id] = push._Bucket(TEST_BURST, TEST_PER_MIN)
    return b.take()


def reset_limits() -> None:
    _TEST_BUCKETS.clear()


def send_test(db: Database, device_id: str) -> dict[str, Any]:
    """`POST notifications/app/test`: one generic push to this device now, with a stored test message (24 h). Called outside any request lock."""
    with db.connection(label="mobile_push.test") as conn:
        dev = get_device(conn, device_id)
        if dev is None or not dev["push_relay_token"]:
            raise ApiError(409, "push_not_registered", "המכשיר הזה עדיין לא נרשם להתראות.")
        mid = _store_message(conn, dev, notification_id=None, delivery_id=None, mode="test", category="system", severity="info", title="Arx · התראת בדיקה", body="ההתראות פועלות במכשיר הזה.",
                             deep_link="#/system/notifications", at=now_utc())
        sid = server_id(conn)
        token = dev["push_relay_token"]
    if not configured():
        return {"message_id": mid, "sent": False, "reason": "relay_unconfigured"}
    outcome = send_relay(token, "system", mid, "normal", sid)
    result = record(db, device_id, outcome, final=True, delivery_id=None, notification_id=None, attempt=1)
    return {"message_id": mid, "sent": result == "sent", "reason": None if result == "sent" else (outcome.error or f"http_{outcome.status}")}


def janitor_stats() -> dict[str, Any]:
    return {**STATS, "configured": configured(), "checked_at": time.time()}
