"""CR-027 phase 2: push to the SmplWise Arx phone app through the SmplWise push relay - one more CR-018 delivery channel (`app`).

How it works (docs/api/mobile-presence-contract.md section 7, CR-027 section 6):
- the app registers its APNs / FCM token with the SmplWise RELAY and gets an opaque relay token; it registers THAT with this
  server (`POST notifications/devices`, device token). The server never sees the platform token; the relay never sees any text;
- a notification dispatch plans one target per registered device of each recipient (visibility re-checked, the user's per-device
  mutes, quiet hours by the matrix's PUSH column, the per-user push rate), writes one `mobile_push_messages` row per target with
  the real title / body at the administrator's lock-screen level, and calls the relay with `{relay_token, category,
  notification_id (= the message id), priority, server}` only;
- the app's notification extension fetches `GET notifications/app/{message_id}` with its device token (24 h expiry) and shows
  the text; if that fails the generic text stays. A 404 / 410 from the relay drops the device's push registration ONLY when the answer
  carries the relay contract's token error body (`relay_token_unknown` / `push_token_gone`, section 8); a plain 404 / 410 (a wrong
  base URL with an extra path, an HTML page, a proxy) is a relay CONFIGURATION error: the registration stays, the health state says
  "כתובת הממסר שגויה" and the relay is not called again until a growing backoff has passed (RELAY-SAFE-2380). 429 / 5xx /
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
from ..relay_url import check_relay_url
from . import notify, notify_channels, notify_settings, push
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
STATS: dict[str, Any] = {"sent": 0, "gone": 0, "failed": 0, "retried": 0, "skipped_unconfigured": 0, "config_errors": 0, "last_error": None, "last_sent_at": None}
# the relay answers that prove a 404 / 410 is about the phone's TOKEN (docs/api/mobile-presence-contract.md section 8)
TOKEN_GONE_CODES: dict[int, str] = {404: "relay_token_unknown", 410: "push_token_gone"}
RELAY_URL_WRONG = "relay_url_wrong"  # device `push_last_error` / delivery reason of a configuration error
RELAY_URL_WRONG_HE = "כתובת הממסר שגויה"
RELAY_AUTH_FAILED = "relay_auth_failed"  # 401: this server's key was refused by the relay
RELAY_AUTH_FAILED_HE = "מפתח השרת לממסר נדחה"
RELAY_SERVER_ID_TAKEN = "relay_server_id_taken"  # 403 server_id_claimed: the installation's id belongs to another server key at the relay
RELAY_SERVER_ID_TAKEN_HE = "מזהה השרת תפוס"
CONFIG_ERRORS_HE: dict[str, str] = {RELAY_URL_WRONG: RELAY_URL_WRONG_HE, RELAY_AUTH_FAILED: RELAY_AUTH_FAILED_HE, RELAY_SERVER_ID_TAKEN: RELAY_SERVER_ID_TAKEN_HE}
CONFIG_STATES: dict[str, str] = {RELAY_URL_WRONG: "config_error", RELAY_AUTH_FAILED: "auth_failed", RELAY_SERVER_ID_TAKEN: "server_id_taken"}  # the health `state` of each
CONFIG_BACKOFF_S: tuple[float, ...] = (60.0, 300.0, 900.0, 3600.0)  # after the n-th consecutive configuration error the relay is left alone this long
CLOCK = time.time  # a seam for the tests
HEALTH: dict[str, Any] = {"config_errors_in_a_row": 0, "config_code": None, "last_config_error_at": None, "last_config_error_status": None, "backoff_until": 0.0, "last_ok_at": None}
_URL_LOGGED: set[str] = set()

CATEGORY_NAMES_HE: dict[str, str] = {"safety": "בטיחות", "alerts": "התראות", "doors": "דלתות וחלונות", "device_faults": "תקלות בהתקנים", "automations": "אוטומציות", "system": "מערכת", "security": "אבטחה וכניסות", "maintenance": "תחזוקה ובקרה", "building": "הודעות לבניין"}  # building: NOTICEPUSH-295 (the notice board)
CRITICAL_CATEGORIES = ("safety",)


def _checked_relay_url() -> tuple[str | None, str | None]:
    raw = os.environ.get("SW_PUSH_RELAY_URL") or ""
    ok, err = check_relay_url(raw, allow_http=TRANSPORT is not None)
    if err and raw not in _URL_LOGGED:
        _URL_LOGGED.add(raw)
        log.warning("the push relay URL is refused: %s", err)  # the value itself is not logged
    return ok, err


def relay_url() -> str | None:
    """The validated base URL (https, no path / query / fragment), else None: a malformed value never reaches a request."""
    return _checked_relay_url()[0]


def relay_url_error() -> str | None:
    """The Hebrew reason the configured URL is refused, None when it is fine or not set."""
    return _checked_relay_url()[1]


def relay_key() -> str | None:
    return (os.environ.get("SW_PUSH_RELAY_KEY") or "").strip() or None


def configured() -> bool:
    return bool(relay_url() and relay_key())


def categories() -> list[dict[str, Any]]:
    from .tickets.naming import DEFAULTS as _ticket_names  # CR-038: the tickets category carries the module's (default) plural, D33

    return [{"id": c, "name": CATEGORY_NAMES_HE.get(c) or (_ticket_names["he"]["many"] if c == "tickets" else c), "critical": c in CRITICAL_CATEGORIES} for c in CATEGORIES]


def critical_sound(conn: sqlite3.Connection) -> dict[str, Any]:
    """CRITSERVER217-295: whether the owner enabled the critical-sound capability, for the app's one-time explanation screen and its own
    settings switch (`GET notifications/categories`, member `critical_sound`). Booleans and event-type names only; never other settings."""
    return notify_settings.critical_sound_capability(notify_settings.load(conn))


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
    # One relay token is one phone. When the same phone registers it for another device row of this server (another user signed in on
    # it, or a re-registered device), the older rows stop receiving: a push would otherwise reach a phone that fetches text with another
    # device's token. Repeating the call for the same device changes nothing but the heartbeat (idempotent), and a rotated token
    # simply replaces the stored one.
    conn.execute("UPDATE mobile_devices SET push_relay_token = NULL, push_platform = NULL, push_failures = 0, push_last_error = NULL WHERE push_relay_token = ? AND id != ?",
                 (relay_token, device["id"]))
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
    kind: str | None = None  # "token_gone" (the contract body says the phone's token is unknown) | "relay_config" (a 404 / 410 without it, a 401, a 403, or skipped by the backoff; `error` says which) | None


def send_relay(relay_token: str, category: str, message_id: str, priority: str, server: str, collapse: str | None = None, critical_alert: bool = False, resolved_tone: bool = False) -> Outcome:
    url, key = relay_url(), relay_key()
    if not url or not key:
        return Outcome(0, error="relay_unconfigured")
    body = {"relay_token": relay_token, "category": category, "notification_id": message_id, "priority": priority, "server": server}
    if collapse:
        body["collapse"] = collapse[:64]
    if critical_alert:  # CRITSOUND124-295: the relay maps it to the FCM data key `critical_alert` (the app's DND-bypass channel); iOS ignores it in phase 1; absent otherwise
        body["critical_alert"] = True
    elif resolved_tone:  # CRITSERVER217-295: the calming tone of a resolved update (FCM data key `resolved_tone`; iOS ignores it); never together with critical_alert, absent otherwise
        body["resolved_tone"] = True
    if CLOCK() < HEALTH["backoff_until"]:  # a configuration error was seen a moment ago: do not hammer a wrong address
        return Outcome(0, error=HEALTH["config_code"] or RELAY_URL_WRONG, kind="relay_config")
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
    kind, code = None, None
    answer = _answer_code(r) if r.status_code in (401, 403, *TOKEN_GONE_CODES) else None
    if r.status_code in TOKEN_GONE_CODES:
        if answer in TOKEN_GONE_CODES.values():
            kind = "token_gone"
        else:
            kind, code = "relay_config", RELAY_URL_WRONG
    elif r.status_code == 401:
        kind, code = "relay_config", RELAY_AUTH_FAILED
    elif r.status_code == 403:
        kind, code = "relay_config", (RELAY_SERVER_ID_TAKEN if answer == "server_id_claimed" else RELAY_URL_WRONG)
    if code:
        _note_config_error(r.status_code, code)
    elif r.status_code < 500 and r.status_code != 429 and not 300 <= r.status_code < 400:  # a real relay accepted our key and answered (2xx, its own 4xx): clear the state
        _note_relay_reached(success=r.is_success)
    return Outcome(r.status_code, retry_after, None if r.is_success else (code or f"http_{r.status_code}"), kind)


def _answer_code(r: httpx.Response) -> str | None:
    """The relay's JSON error `code`, only from a JSON answer; HTML, an empty body or anything else is None."""
    if "json" not in (r.headers.get("content-type") or "").lower():
        return None
    try:
        body = r.json()
    except ValueError:
        return None
    code = body.get("code") if isinstance(body, dict) else None
    return code if isinstance(code, str) else None


def _note_config_error(status: int, code: str) -> None:
    n = HEALTH["config_errors_in_a_row"] + 1
    wait = CONFIG_BACKOFF_S[min(n, len(CONFIG_BACKOFF_S)) - 1]
    HEALTH.update(config_errors_in_a_row=n, config_code=code, last_config_error_at=now_iso(), last_config_error_status=status, backoff_until=CLOCK() + wait)
    log.warning("the push relay answered %s (%s): a relay configuration error, not a gone token; registrations are kept (backoff %ss)", status, code, wait)


def _note_relay_reached(*, success: bool) -> None:
    HEALTH.update(config_errors_in_a_row=0, config_code=None, backoff_until=0.0)
    if success:
        HEALTH["last_ok_at"] = now_iso()


def reset_health() -> None:
    HEALTH.update(config_errors_in_a_row=0, config_code=None, last_config_error_at=None, last_config_error_status=None, backoff_until=0.0, last_ok_at=None)
    _URL_LOGGED.clear()


def relay_health() -> dict[str, Any]:
    """The push health state for the administrator (`GET notify/stats`, member `app_relay`): `state` is ok | unconfigured | url_invalid | config_error (a plain 404 / 410 / 403:
    wrong address) | auth_failed (401: the server key was refused) | server_id_taken (403 server_id_claimed), with the machine `code`
    (relay_url_wrong / relay_auth_failed / relay_server_id_taken) and the Hebrew message; never the URL itself or the key."""
    url_err = relay_url_error()
    code = HEALTH["config_code"] if HEALTH["config_errors_in_a_row"] else None
    if url_err:
        state, message, code = "url_invalid", url_err, None
    elif code:
        state, message = CONFIG_STATES.get(code, "config_error"), CONFIG_ERRORS_HE.get(code, RELAY_URL_WRONG_HE)
    elif not configured():
        state, message = "unconfigured", None
    else:
        state, message = "ok", None
    left = max(0.0, HEALTH["backoff_until"] - CLOCK())
    return {"configured": configured(), "state": state, "code": code, "message": message, "config_errors_in_a_row": HEALTH["config_errors_in_a_row"], "last_config_error_at": HEALTH["last_config_error_at"],
            "last_config_error_status": HEALTH["last_config_error_status"], "backoff_seconds_left": int(left), "last_ok_at": HEALTH["last_ok_at"]}


def retryable(status: int) -> bool:
    return status == 0 or status == 429 or status >= 500


def record(db: Database, device_id: str, outcome: Outcome, final: bool, *, delivery_id: str | None, notification_id: str | None, attempt: int) -> str:
    """Store the relay's answer on the device row and the delivery log: sent / gone (push dropped; only on the contract's token error body) / retry /
    failed (dropped after DROP_AFTER_FAILURES) / config_error (the relay address is wrong, the server key refused, or the server id taken: registration kept,
    no failure counted)."""
    st = outcome.status
    with db.connection(label="mobile_push.record") as conn:
        if 200 <= st < 300:
            conn.execute("UPDATE mobile_devices SET push_last_ok_at = ?, push_failures = 0, push_last_error = NULL WHERE id = ?", (now_iso(), device_id))
            STATS["sent"] += 1
            STATS["last_sent_at"] = now_iso()
            result = "sent"
        elif outcome.kind == "relay_config" or (st in (404, 410) and outcome.kind != "token_gone"):
            # a 404 / 410 that is not the contract's token error, a 401 (key refused), a 403 (server id taken) or a call skipped by the backoff: the
            # relay SETUP is wrong, not the phone's token. Keep the registration, count no device failure (ten of them would drop it), do not
            # retry this message.
            cfg = outcome.error if outcome.error in CONFIG_ERRORS_HE else RELAY_URL_WRONG
            conn.execute("UPDATE mobile_devices SET push_last_error = ? WHERE id = ?", (cfg, device_id))
            STATS["config_errors"] += 1
            STATS["last_error"] = cfg
            result = "config_error"
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
            status = {"sent": "sent", "gone": "gone", "retry": "retry", "failed": "failed", "config_error": "failed"}[result]
            notify_channels.set_delivery(conn, [delivery_id], status, None if status == "sent" else (cfg if result == "config_error" else (outcome.error or f"http_{st}")), attempt)
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
    critical_alert: bool = False
    resolved_tone: bool = False

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
    outcome = send_relay(job.relay_token, job.category, job.message_id, job.priority, job.server, collapse=job.notification_id, critical_alert=job.critical_alert, resolved_tone=job.resolved_tone)
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
            if d.held("webpush"):  # the app follows the matrix's push column (no column of its own) and, with the browser push, is what a quiet window holds
                out.append(notify_channels.Target(self.name, uid, ref, "skipped", d.held_reason("webpush")))
                continue
            if not ready:
                out.append(notify_channels.Target(self.name, uid, ref, "skipped", "channel_unavailable"))
                continue
            if d.severity != "critical" and d.mode != "escalate" and not push.take_token(uid, "app"):
                push.STATS["rate_limited"] += 1
                out.append(notify_channels.Target(self.name, uid, ref, "skipped", "rate_limited"))
                continue
            for dev in devices:
                if d.n["category"] in _json(dev["push_muted_json"], []) and d.n["category"] not in CRITICAL_CATEGORIES and d.severity != "critical" and d.mode != "escalate":
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
                       d.scratch.get("app_server") or "srv", d.nid, t.delivery_id or None, d.mode,
                       critical_alert=d.mode != "resolved" and notify_settings.critical_sound_for(d.settings, d.n.get("source"), d.n.get("category"), d.severity),
                       resolved_tone=d.mode == "resolved" and notify_settings.resolved_tone_for(d.settings, d.n.get("source"), d.n.get("category"), d.severity))
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
    return {**STATS, "configured": configured(), "relay": relay_health(), "checked_at": time.time()}
