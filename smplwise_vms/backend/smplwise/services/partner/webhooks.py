"""PARTNERAPI113-295: signed outgoing webhooks (CR section 6).

- Endpoints: a sealed target URL (only the host is kept in clear, for lists and audit), a sealed `whsec_` secret shown once, a subset of the
  closed EVENT_TYPES, one restriction, `skip_own` (owner answer 172: a partner does not hear about a request it opened itself - default on).
- Events come from ONE place: the notification engine (services/notify._emit) calls `on_notification` after it CREATED or RESOLVED a row, and
  the ticket creation path calls `on_ticket_created`; both inside the caller's transaction (a rollback removes the outbox rows). The webhook
  layer decides nothing a source did not already decide. The payload is built from a CLOSED schema per type and fails closed.
- Signing ("Standard Webhooks"): `webhook-id` (the event id, stable across retries), `webhook-timestamp` (this attempt), `webhook-signature`
  `v1,<base64 HMAC-SHA256(key, id.timestamp.body)>`; two signatures while a rotated secret overlaps.
- Delivery (`deliver_due`): no database connection is held during the network call; the target is checked again before EVERY attempt and the
  request goes to the checked address; no redirect is followed, no proxy variable is read; retries with backoff, dead-letter, circuit.
- The delivery log never keeps a header, a body, a signature, a secret or the URL.
Nothing is ever sent while `partner.webhooks` is off - and it cannot be switched on while core.GO_LIVE_PERMITTED is False."""
from __future__ import annotations

import base64
import contextvars
import datetime as dt
import hashlib
import hmac
import json
import logging
import random
import re
import secrets
import sqlite3
import threading
import time
from pathlib import Path
from typing import Any, Callable, Iterable

import httpx

from ...audit import audit
from ...db import Database, get_setting
from ...rbac import Principal
from ..connection_store import SecretError, open_partner_secret, seal_partner_secret
from ..tickets.ratelimit import ScopedRateLimiter
from . import core, ssrf
from .core import PartnerError, iso, parse_iso, utcnow

log = logging.getLogger("smplwise.partner.webhooks")

SECRET_KIND = "partner_webhook"
SECRET_PREFIX = "whsec_"
EVENT_TYPES: tuple[str, ...] = (
    "ticket.created", "ticket.status_changed", "ticket.done",
    "temperature.alarm", "temperature.warning", "temperature.offline", "temperature.escalation", "temperature.resolved",
    "elevator.fault", "elevator.out_of_service", "elevator.fire_service", "elevator.resolved",
    "endpoint.ping",
)
# owner answer 168 and CR 6.1: never a webhook in this slice (a test proves each one is refused)
EXCLUDED_PREFIXES = ("security.", "access.", "door.", "alarm.", "camera.", "privacy.", "notify.", "intercom.", "automation.", "schedule.",
                     "backup.", "update.", "sensor.")
# notification source -> event type (a resolve of the temperature / elevator sources becomes `<family>.resolved`)
SOURCE_EVENTS: dict[str, str] = {
    "ticket.status_update": "ticket.status_changed", "ticket.returned": "ticket.status_changed", "ticket.done": "ticket.done",
    "temperature.alarm": "temperature.alarm", "temperature.warning": "temperature.warning", "temperature.offline": "temperature.offline",
    "temperature.escalation": "temperature.escalation",
    "elevator.fault": "elevator.fault", "elevator.out_of_service": "elevator.out_of_service", "elevator.fire_service": "elevator.fire_service",
}
RESOLVE_FAMILIES = {"temperature.": "temperature.resolved", "elevator.": "elevator.resolved"}

BACKOFF_S = (30, 120, 600, 1800, 3600, 3 * 3600, 6 * 3600, 12 * 3600, 24 * 3600)  # 9 retries, about 47 h, then dead
RETRY_AFTER_CAP_S = 3600
MAX_AGE_S = 48 * 3600
QUEUE_MAX = 5000
CIRCUIT_FAILS = 50
CIRCUIT_SILENCE_S = 24 * 3600
KEEP_DEAD_DAYS = 14
KEEP_LOG_DAYS = 30
REDELIVER_PER_HOUR = 100
BODY_MAX = 16 * 1024
ANSWER_READ_MAX = 4 * 1024
CONNECT_S, TOTAL_S = 5.0, 10.0
RETRY_STATUSES = frozenset({408, 425, 429})
_TS_ID = re.compile(r"evt_[0-9a-f]{16}")

# seams for tests: an httpx transport (MockTransport) and the clock
TRANSPORT: httpx.BaseTransport | None = None
CLOCK: Callable[[], float] = time.time
_OUT = ScopedRateLimiter("partner_out", horizon_s=3600.0, clock=lambda: CLOCK())
OUT_PER_ENDPOINT = ((60.0, 60),)
OUT_GLOBAL = ((60.0, 300),)
REDELIVER = ((3600.0, REDELIVER_PER_HOUR),)
_WAKE = threading.Event()
# T10: the HTTP client logs every request URL at INFO ("HTTP Request: POST https://..."); while a partner delivery is in flight on this thread
# those records are dropped, so a target URL (its path and query can carry the partner's own secrets) never reaches a log line
_SENDING: contextvars.ContextVar[bool] = contextvars.ContextVar("partner_webhook_sending", default=False)


class _QuietWhileSending(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        return not _SENDING.get()


for _name in ("httpx", "httpcore"):
    logging.getLogger(_name).addFilter(_QuietWhileSending())


# ---------------------------------------------------------------- secrets and signing

def new_secret() -> str:
    return SECRET_PREFIX + base64.b64encode(secrets.token_bytes(32)).decode("ascii")


def _key(secret: str) -> bytes:
    if not secret.startswith(SECRET_PREFIX):
        raise ValueError("not a webhook secret")
    return base64.b64decode(secret[len(SECRET_PREFIX):], validate=True)


def sign(secret: str, msg_id: str, timestamp: int, body: bytes) -> str:
    mac = hmac.new(_key(secret), f"{msg_id}.{timestamp}.".encode("ascii") + body, hashlib.sha256).digest()
    return "v1," + base64.b64encode(mac).decode("ascii")


def signature_header(secrets_: Iterable[str], msg_id: str, timestamp: int, body: bytes) -> str:
    return " ".join(sign(s, msg_id, timestamp, body) for s in secrets_)


def verify(secret: str, msg_id: str, timestamp: int, body: bytes, header: str, *, now: int | None = None, tolerance_s: int = 300) -> bool:
    """The receiver's check (the partner guide; also the tests): timestamp within 5 minutes, any `v1,` signature matches in constant time."""
    now = int(time.time()) if now is None else now
    if abs(now - int(timestamp)) > tolerance_s:
        return False
    want = sign(secret, msg_id, timestamp, body)
    return any(hmac.compare_digest(want, part) for part in header.split(" ") if part)


def _seal(data_dir: Path, ident: str, field: str, value: str) -> str:
    return seal_partner_secret(Path(data_dir), ident, field, value)


def _open(data_dir: Path, ident: str, field: str, blob: str | None) -> str | None:
    if not blob:
        return None
    try:
        return open_partner_secret(Path(data_dir), ident, field, blob)
    except SecretError:
        return None


# ---------------------------------------------------------------- endpoints

def _endpoint(conn: sqlite3.Connection, endpoint_id: str) -> sqlite3.Row | None:
    if not isinstance(endpoint_id, str) or not core.ID_RE["pep"].fullmatch(endpoint_id):
        return None
    return conn.execute("SELECT * FROM partner_endpoints WHERE id = ?", (endpoint_id,)).fetchone()


def validate_events(value: Any) -> list[str]:
    if not isinstance(value, list) or not value or not all(isinstance(v, str) for v in value):
        raise PartnerError(422, "invalid", "events")
    out = list(dict.fromkeys(value))
    if any(v not in EVENT_TYPES or v.startswith(EXCLUDED_PREFIXES) for v in out):
        raise PartnerError(422, "unknown_event", "events")
    return out


def extra_names(settings: Any) -> list[str]:
    """The names a target may never be: the home system's host and this installation's remote-access host."""
    out = []
    for value in (getattr(settings, "ha_url", None), getattr(settings, "remote_public_url", None), getattr(settings, "public_url", None)):
        if isinstance(value, str) and "://" in value:
            host = value.split("://", 1)[1].split("/", 1)[0].rsplit("@", 1)[-1].split(":", 1)[0]
            if host:
                out.append(host.lower())
    return out


def _trusted(settings: Any) -> list[str]:
    return [str(p) for p in (getattr(settings, "trusted_proxies", None) or [])]


def check_url(conn: sqlite3.Connection, principal: Principal | None, url: Any, settings: Any, *, resolve: bool, rid: str | None = None,
              endpoint_id: str | None = None) -> ssrf.Target:
    try:
        target, _ip = ssrf.validate(url, extra_names=extra_names(settings), trusted=_trusted(settings), resolve=resolve)
    except ssrf.Refused as exc:
        host = ""
        try:
            host = ssrf.parse(url).host
        except ssrf.Refused:
            pass
        audit(conn, actor=principal, action="partner.endpoint.refused_address", decision="denied", resource_type="partner_endpoint",
              resource_id=endpoint_id or "*", reason=exc.code, request_id=rid, details={"host": host[:253]})
        raise PartnerError(422, "url_refused", "url") from None
    return target


def create_endpoint(conn: sqlite3.Connection, principal: Principal, client_id: str, body: dict[str, Any], settings: Any, rid: str | None = None) -> dict[str, Any]:
    client = core.client_row(conn, client_id)
    if client is None:
        raise PartnerError(404, "not_found")
    if client["state"] != "active":
        raise PartnerError(409, "partner_disabled")
    live = conn.execute("SELECT COUNT(*) FROM partner_endpoints WHERE state != 'disabled'").fetchone()[0]
    if live >= core.number(conn, "partner.max_endpoints"):
        raise PartnerError(409, "too_many_endpoints")
    label = core.clean_label(body.get("label"), required=False)
    events = validate_events(body.get("events"))
    kind, ids = core.validate_restriction(conn, body.get("restriction_kind", "installation"), body.get("restriction_ids"))
    departments = core.validate_departments(conn, body.get("departments"))
    personal = core.validate_personal(body.get("personal"))
    skip_own = body.get("skip_own", True)
    if not isinstance(skip_own, bool):
        raise PartnerError(422, "invalid", "skip_own")
    target = check_url(conn, principal, body.get("url"), settings, resolve=True, rid=rid)
    eid = core.new_ident("pep")
    secret = new_secret()
    data_dir = Path(settings.data_dir)
    now = iso(utcnow())
    conn.execute(
        """INSERT INTO partner_endpoints (id, client_id, label, url_enc, host, secret_enc, events_json, restriction_kind, restriction_ids_json,
                                          departments_json, personal_json, skip_own, state, created_by, created_at, updated_at)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,'pending',?,?,?)""",
        (eid, client_id, label, _seal(data_dir, eid, "url", body["url"]), target.host, _seal(data_dir, eid, "secret", secret), json.dumps(events),
         kind, json.dumps(ids), json.dumps(departments), json.dumps(personal, sort_keys=True), int(skip_own), principal.user_id, now, now))
    audit(conn, actor=principal, action="partner.endpoint.created", decision="allowed", resource_type="partner_endpoint", resource_id=eid, request_id=rid,
          details={"client_id": client_id, "host": target.host, "events": events, "restriction": kind, "restriction_count": len(ids)})
    return {**endpoint_view(conn, _endpoint(conn, eid)), "secret": secret}


def update_endpoint(conn: sqlite3.Connection, principal: Principal, endpoint_id: str, body: dict[str, Any], settings: Any, rid: str | None = None) -> dict[str, Any]:
    row = _endpoint(conn, endpoint_id)
    if row is None or row["state"] == "disabled":
        raise PartnerError(404, "not_found")
    sets: dict[str, Any] = {}
    changed: list[str] = []
    if "label" in body:
        sets["label"] = core.clean_label(body.get("label"), required=False)
    if "events" in body:
        sets["events_json"] = json.dumps(validate_events(body.get("events")))
    if "restriction_kind" in body or "restriction_ids" in body:
        kind, ids = core.validate_restriction(conn, body.get("restriction_kind", row["restriction_kind"]), body.get("restriction_ids"))
        sets["restriction_kind"], sets["restriction_ids_json"] = kind, json.dumps(ids)
    if "departments" in body:
        sets["departments_json"] = json.dumps(core.validate_departments(conn, body.get("departments")))
    if "personal" in body:
        sets["personal_json"] = json.dumps(core.validate_personal(body.get("personal")), sort_keys=True)
    if "skip_own" in body:
        if not isinstance(body["skip_own"], bool):
            raise PartnerError(422, "invalid", "skip_own")
        sets["skip_own"] = int(body["skip_own"])
    if "url" in body:
        target = check_url(conn, principal, body.get("url"), settings, resolve=True, rid=rid, endpoint_id=endpoint_id)
        sets["url_enc"], sets["host"] = _seal(Path(settings.data_dir), endpoint_id, "url", body["url"]), target.host
        sets["state"] = "pending"  # a new target needs a successful ping again
    if not sets:
        raise PartnerError(422, "invalid", "body")
    changed = sorted(k.replace("_json", "").replace("_enc", "") for k in sets)
    sets["updated_at"] = iso(utcnow())
    conn.execute(f"UPDATE partner_endpoints SET {', '.join(f'{k} = ?' for k in sets)} WHERE id = ?", (*sets.values(), endpoint_id))
    audit(conn, actor=principal, action="partner.endpoint.updated", decision="allowed", resource_type="partner_endpoint", resource_id=endpoint_id,
          request_id=rid, details={"changed": changed})
    return endpoint_view(conn, _endpoint(conn, endpoint_id))


def delete_endpoint(conn: sqlite3.Connection, principal: Principal, endpoint_id: str, rid: str | None = None) -> None:
    row = _endpoint(conn, endpoint_id)
    if row is None or row["state"] == "disabled":
        raise PartnerError(404, "not_found")
    now = iso(utcnow())
    conn.execute("UPDATE partner_endpoints SET state = 'disabled', state_reason = 'deleted', secret_enc = '', secret_prev_enc = NULL, url_enc = '', "
                 "updated_at = ? WHERE id = ?", (now, endpoint_id))
    conn.execute("UPDATE partner_outbox SET state = 'dead', dead_reason = 'disabled', ended_at = ? WHERE endpoint_id = ? AND state IN ('queued', 'delivering')",
                 (now, endpoint_id))
    audit(conn, actor=principal, action="partner.endpoint.deleted", decision="allowed", resource_type="partner_endpoint", resource_id=endpoint_id, request_id=rid)


def set_paused(conn: sqlite3.Connection, principal: Principal | None, endpoint_id: str, paused: bool, reason: str = "manual", rid: str | None = None) -> dict[str, Any]:
    row = _endpoint(conn, endpoint_id)
    if row is None or row["state"] == "disabled":
        raise PartnerError(404, "not_found")
    if paused and row["state"] != "paused":
        conn.execute("UPDATE partner_endpoints SET state = 'paused', state_reason = ?, updated_at = ? WHERE id = ?", (reason, iso(utcnow()), endpoint_id))
        audit(conn, actor=principal, action="partner.endpoint.paused", decision="allowed", resource_type="partner_endpoint", resource_id=endpoint_id,
              request_id=rid, details={"reason": reason})
    elif not paused and row["state"] == "paused":
        # resume needs a successful ping (CR 6.4): back to pending; the ping makes it active
        conn.execute("UPDATE partner_endpoints SET state = 'pending', state_reason = NULL, fail_streak = 0, first_fail_at = NULL, updated_at = ? WHERE id = ?",
                     (iso(utcnow()), endpoint_id))
        audit(conn, actor=principal, action="partner.endpoint.resumed", decision="allowed", resource_type="partner_endpoint", resource_id=endpoint_id, request_id=rid)
    return endpoint_view(conn, _endpoint(conn, endpoint_id))


def rotate_secret(conn: sqlite3.Connection, principal: Principal, endpoint_id: str, overlap_hours: Any, data_dir: Path, rid: str | None = None) -> dict[str, Any]:
    row = _endpoint(conn, endpoint_id)
    if row is None or row["state"] == "disabled":
        raise PartnerError(404, "not_found")
    if overlap_hours is None:
        overlap_hours = core.number(conn, "partner.rotation_overlap_hours")
    if isinstance(overlap_hours, bool) or not isinstance(overlap_hours, int) or not 0 <= overlap_hours <= 168:
        raise PartnerError(422, "out_of_range", "overlap_hours")
    secret = new_secret()
    now = utcnow()
    old = row["secret_enc"] if overlap_hours else None
    # the previous secret is re-sealed under its own field so a blob can never be swapped between the two columns
    old_plain = _open(Path(data_dir), endpoint_id, "secret", old) if old else None
    conn.execute("UPDATE partner_endpoints SET secret_enc = ?, secret_prev_enc = ?, secret_prev_until = ?, updated_at = ? WHERE id = ?",
                 (_seal(Path(data_dir), endpoint_id, "secret", secret), _seal(Path(data_dir), endpoint_id, "secret_prev", old_plain) if old_plain else None,
                  iso(now + dt.timedelta(hours=overlap_hours)) if old_plain else None, iso(now), endpoint_id))
    audit(conn, actor=principal, action="partner.endpoint.secret_rotated", decision="allowed", resource_type="partner_endpoint", resource_id=endpoint_id,
          request_id=rid, details={"overlap_hours": overlap_hours})
    return {**endpoint_view(conn, _endpoint(conn, endpoint_id)), "secret": secret}


def endpoint_view(conn: sqlite3.Connection, row: sqlite3.Row) -> dict[str, Any]:
    counts = {r["state"]: r["n"] for r in conn.execute("SELECT state, COUNT(*) AS n FROM partner_outbox WHERE endpoint_id = ? GROUP BY state", (row["id"],))}
    return {"id": row["id"], "client_id": row["client_id"], "label": row["label"], "host": row["host"], "events": json.loads(row["events_json"]),
            "restriction_kind": row["restriction_kind"], "restriction_ids": json.loads(row["restriction_ids_json"]),
            "departments": json.loads(row["departments_json"]), "personal": {**core.PERSONAL_DEFAULTS, **json.loads(row["personal_json"] or "{}")},
            "skip_own": bool(row["skip_own"]), "state": row["state"], "state_reason": row["state_reason"], "fail_streak": row["fail_streak"],
            "last_success_at": row["last_success_at"], "last_attempt_at": row["last_attempt_at"], "created_at": row["created_at"],
            "secret_overlap_until": row["secret_prev_until"], "queued": counts.get("queued", 0) + counts.get("delivering", 0), "dead": counts.get("dead", 0)}


def list_endpoints(conn: sqlite3.Connection, client_id: str | None = None) -> list[dict[str, Any]]:
    sql, args = "SELECT * FROM partner_endpoints WHERE state != 'disabled'", []
    if client_id:
        sql, args = sql + " AND client_id = ?", [client_id]
    return [endpoint_view(conn, r) for r in conn.execute(sql + " ORDER BY created_at", args).fetchall()]


def delivery_log(conn: sqlite3.Connection, endpoint_id: str | None = None, limit: int = 100) -> list[dict[str, Any]]:
    sql, args = "SELECT * FROM partner_deliveries", []
    if endpoint_id:
        sql, args = sql + " WHERE endpoint_id = ?", [endpoint_id]
    rows = conn.execute(sql + " ORDER BY id DESC LIMIT ?", (*args, max(1, min(500, limit)))).fetchall()
    return [{k: r[k] for k in ("event_id", "endpoint_id", "type", "attempt", "started_at", "duration_ms", "http_status", "error_class")} for r in rows]


def outbox_view(conn: sqlite3.Connection, endpoint_id: str | None = None, state: str | None = None, limit: int = 100) -> list[dict[str, Any]]:
    sql, args = "SELECT * FROM partner_outbox WHERE 1=1", []
    if endpoint_id:
        sql, args = sql + " AND endpoint_id = ?", [*args, endpoint_id]
    if state in ("queued", "delivering", "delivered", "dead"):
        sql, args = sql + " AND state = ?", [*args, state]
    rows = conn.execute(sql + " ORDER BY occurred_at DESC LIMIT ?", (*args, max(1, min(500, limit)))).fetchall()
    return [{"id": r["id"], "endpoint_id": r["endpoint_id"], "type": r["type"], "occurred_at": r["occurred_at"], "state": r["state"],
             "attempts": r["attempts"], "next_at": r["next_at"], "dead_reason": r["dead_reason"], "delivered_at": r["delivered_at"],
             "payload": json.loads(r["payload_json"])} for r in rows]


def redeliver(conn: sqlite3.Connection, principal: Principal, event_id: str, rid: str | None = None) -> dict[str, Any]:
    if not isinstance(event_id, str) or not core.ID_RE["evt"].fullmatch(event_id):
        raise PartnerError(404, "not_found")
    row = conn.execute("SELECT o.*, e.state AS ep_state FROM partner_outbox o JOIN partner_endpoints e ON e.id = o.endpoint_id WHERE o.id = ?", (event_id,)).fetchone()
    if row is None:
        raise PartnerError(404, "not_found")
    if row["state"] != "dead" or row["ep_state"] in ("disabled",):
        raise PartnerError(409, "not_dead")
    if not _OUT.hit("redeliver", REDELIVER):
        raise PartnerError(429, "rate_limited")
    conn.execute("UPDATE partner_outbox SET state = 'queued', attempts = 0, next_at = ?, dead_reason = NULL, ended_at = NULL, occurred_at = ?, "
                 "redeliveries = redeliveries + 1 WHERE id = ?", (iso(utcnow()), iso(utcnow()), event_id))
    audit(conn, actor=principal, action="partner.delivery.redeliver", decision="allowed", resource_type="partner_event", resource_id=event_id, request_id=rid)
    wake()
    return {"id": event_id, "state": "queued"}


# ---------------------------------------------------------------- payloads (closed schemas, fail closed)

_STR = str
_INT = int
_NUM = (int, float)
_OPT_STR = (str, type(None))
_OPT_NUM = (int, float, type(None))
_TICKET_BASE = {"ticket_id": _STR, "number": _INT, "department_key": _STR, "category": _OPT_STR, "priority_key": _STR, "place": _OPT_STR,
                "origin": _STR, "at": _STR}
SCHEMAS: dict[str, dict[str, Any]] = {
    "ticket.created": {**_TICKET_BASE},
    "ticket.status_changed": {"ticket_id": _STR, "number": _INT, "from_status": _OPT_STR, "to_status": _STR, "at": _STR},
    "ticket.done": {"ticket_id": _STR, "number": _INT, "at": _STR},
    "temperature.state": {"unit_id": _STR, "name": _STR, "place": _OPT_STR, "state": _STR, "reading": _OPT_NUM, "low": _OPT_NUM, "high": _OPT_NUM, "at": _STR},
    "temperature.resolved": {"unit_id": _STR, "source": _STR, "at": _STR},
    "elevator.state": {"elevator_id": _STR, "name": _STR, "place": _OPT_STR, "state": _STR, "at": _STR},
    "elevator.resolved": {"elevator_id": _STR, "source": _STR, "at": _STR},
    "endpoint.ping": {"endpoint_id": _STR, "at": _STR},
}
TEXT_FIELDS = {"title": _STR, "description": _STR}  # owner answer 167: on by default (`personal.ticket_text`)
PEOPLE_FIELDS = {"requester_name": _OPT_STR, "assignee_name": _OPT_STR}  # off by default (`personal.ticket_people`)
_TEXT_MAX = 4000


class PayloadInvalid(ValueError):
    pass


STATS = {"payload_invalid": 0, "hook_failures": 0, "enqueued": 0}


def schema_of(event_type: str) -> dict[str, Any]:
    if event_type.startswith("temperature.") and event_type != "temperature.resolved":
        return SCHEMAS["temperature.state"]
    if event_type.startswith("elevator.") and event_type != "elevator.resolved":
        return SCHEMAS["elevator.state"]
    return SCHEMAS[event_type]


def build(event_type: str, data: dict[str, Any], extra_schema: dict[str, Any] | None = None) -> dict[str, Any]:
    """Exactly the schema's key set, each value of its type (bool is never an int), strings bounded. Anything else raises PayloadInvalid."""
    schema = {**schema_of(event_type), **(extra_schema or {})}
    if set(data) != set(schema):
        raise PayloadInvalid(event_type)
    out: dict[str, Any] = {}
    for k, kind in schema.items():
        v = data[k]
        if isinstance(v, bool) or not isinstance(v, kind):
            raise PayloadInvalid(f"{event_type}.{k}")
        if isinstance(v, str):
            if len(v) > _TEXT_MAX:
                raise PayloadInvalid(f"{event_type}.{k}")
        out[k] = v
    return out


# ---------------------------------------------------------------- enqueue (inside the source's transaction)

def _active(conn: sqlite3.Connection) -> bool:
    return core.GO_LIVE_PERMITTED and (get_setting(conn, core.WEBHOOKS_KEY, "off") or "off") == "on"


def _subscribed(conn: sqlite3.Connection, event_type: str) -> list[sqlite3.Row]:
    return [r for r in conn.execute("""SELECT e.*, c.state AS client_state FROM partner_endpoints e JOIN partner_clients c ON c.id = e.client_id
                                       WHERE e.state IN ('active', 'paused') AND c.state = 'active' AND c.deleted_at IS NULL""").fetchall()
            if event_type in json.loads(r["events_json"] or "[]")]


def _enqueue_row(conn: sqlite3.Connection, ep: sqlite3.Row, event_type: str, data: dict[str, Any], now: dt.datetime) -> str | None:
    eid = core.new_ident("evt")
    if ep["state"] == "paused":
        state, dead = "dead", "paused"
    else:
        state, dead = "queued", None
    seq = int(ep["sequence"]) + 1
    conn.execute("UPDATE partner_endpoints SET sequence = ? WHERE id = ?", (seq, ep["id"]))
    client = conn.execute("SELECT opaque_installation_ref FROM partner_clients WHERE id = ?", (ep["client_id"],)).fetchone()
    payload = {"event_id": eid, "type": event_type, "occurred_at": iso(now), "installation": client["opaque_installation_ref"] if client else "",
               "sequence": seq, "data": data}
    body = json.dumps(payload, ensure_ascii=False, separators=(",", ":"), sort_keys=True)
    if len(body.encode("utf-8")) > BODY_MAX:
        raise PayloadInvalid("too_large")
    conn.execute("""INSERT INTO partner_outbox (id, endpoint_id, type, payload_json, occurred_at, next_at, state, dead_reason, ended_at)
                    VALUES (?,?,?,?,?,?,?,?,?)""", (eid, ep["id"], event_type, body, iso(now), iso(now), state, dead, iso(now) if dead else None))
    queued = conn.execute("SELECT COUNT(*) FROM partner_outbox WHERE endpoint_id = ? AND state = 'queued'", (ep["id"],)).fetchone()[0]
    if queued > QUEUE_MAX:
        over = queued - QUEUE_MAX
        conn.execute("""UPDATE partner_outbox SET state = 'dead', dead_reason = 'overflow', ended_at = ? WHERE id IN (
                            SELECT id FROM partner_outbox WHERE endpoint_id = ? AND state = 'queued' ORDER BY occurred_at LIMIT ?)""", (iso(now), ep["id"], over))
    STATS["enqueued"] += 1
    return eid


def _filter_personal(ep: sqlite3.Row, data: dict[str, Any], text: dict[str, Any], people: dict[str, Any]) -> tuple[dict[str, Any], dict[str, Any]]:
    personal = {**core.PERSONAL_DEFAULTS, **json.loads(ep["personal_json"] or "{}")}
    out, schema = dict(data), {}
    if personal.get("ticket_text") and text:
        out.update(text)
        schema.update(TEXT_FIELDS)
    if personal.get("ticket_people") and people:
        out.update(people)
        schema.update(PEOPLE_FIELDS)
    return out, schema


def enqueue(conn: sqlite3.Connection, event_type: str, data: dict[str, Any], *, place: tuple[str | None, str | None, str | None] | None = None,
            entity_ids: list[str] | None = None, department_id: str | None = None, partner_client: str | None = None,
            text: dict[str, Any] | None = None, people: dict[str, Any] | None = None, now: dt.datetime | None = None) -> int:
    """One outbox row per subscribed endpoint whose restriction covers the object. A constant-time no-op while the switch is off."""
    if event_type not in EVENT_TYPES:
        raise PayloadInvalid(event_type)
    if not _active(conn):
        return 0
    endpoints = _subscribed(conn, event_type)
    if not endpoints:
        return 0
    now = now or utcnow()
    placed = None
    n = 0
    for ep in endpoints:
        if partner_client and ep["skip_own"] and ep["client_id"] == partner_client:
            continue  # owner answer 172: the loop guard
        reach = core.reach_of(conn, ep["restriction_kind"], json.loads(ep["restriction_ids_json"] or "[]"))
        if entity_ids is not None:
            if not reach.wide:
                from .. import ha_scope

                placed = placed if placed is not None else ha_scope.placements(conn)
                if not entity_ids or not all(core.entity_covered(conn, reach, e, placed) for e in entity_ids):
                    continue
        elif place is not None and not reach.covers_place(*place):
            continue
        depts = json.loads(ep["departments_json"] or "[]")
        if department_id is not None and depts and department_id not in depts:
            continue
        if event_type in ("ticket.status_changed", "ticket.done") and _recent_twin(conn, ep["id"], event_type, data, now):
            continue  # one change raises one notification per person (PUSHSVC-295): the partner hears about it once
        merged, extra = _filter_personal(ep, data, text or {}, people or {})
        payload = build(event_type, merged, extra)
        if _enqueue_row(conn, ep, event_type, payload, now):
            n += 1
    if n:
        wake()
    return n


TWIN_WINDOW_S = 120


def _recent_twin(conn: sqlite3.Connection, endpoint_id: str, event_type: str, data: dict[str, Any], now: dt.datetime) -> bool:
    needle = [f'"ticket_id":{json.dumps(data.get("ticket_id"), ensure_ascii=False)}']
    if event_type == "ticket.status_changed":
        needle.append(f'"to_status":{json.dumps(data.get("to_status"), ensure_ascii=False)}')
    rows = conn.execute("SELECT payload_json FROM partner_outbox WHERE endpoint_id = ? AND type = ? AND occurred_at >= ?",
                        (endpoint_id, event_type, iso(now - dt.timedelta(seconds=TWIN_WINDOW_S)))).fetchall()
    return any(all(n in r[0] for n in needle) for r in rows)


def _guarded(fn: Callable[[], Any]) -> None:
    """A hook failure never breaks the source (logged and counted). The SAVEPOINT keeps a half-written outbox out of the source's commit."""
    try:
        fn()
    except PayloadInvalid as exc:
        STATS["payload_invalid"] += 1
        log.warning("partner webhook payload refused (%s)", type(exc).__name__)
    except Exception as exc:  # noqa: BLE001
        STATS["hook_failures"] += 1
        log.warning("partner webhook hook failed (%s)", type(exc).__name__)


def _savepoint(conn: sqlite3.Connection, fn: Callable[[], Any]) -> None:
    def run() -> None:
        conn.execute("SAVEPOINT partner_enqueue")
        try:
            fn()
        except BaseException:
            conn.execute("ROLLBACK TO partner_enqueue")
            conn.execute("RELEASE partner_enqueue")
            raise
        conn.execute("RELEASE partner_enqueue")

    _guarded(run)


def _ticket(conn: sqlite3.Connection, ticket_id: str) -> sqlite3.Row | None:
    return conn.execute("""SELECT t.*, d.key AS department_key, c.name AS category_name, p.key AS priority_key, f.name AS floor_name,
                                  a.assignee_name AS assignee_name
                           FROM tickets t JOIN ticket_departments d ON d.id = t.department_id
                           LEFT JOIN ticket_categories c ON c.id = t.category_id JOIN ticket_priorities p ON p.id = t.priority_id
                           LEFT JOIN floors f ON f.id = t.floor_id LEFT JOIN ticket_assignments a ON a.id = t.current_assignment_id
                           WHERE t.id = ?""", (ticket_id,)).fetchone()


def ticket_place(row: sqlite3.Row) -> str | None:
    if row["floor_name"]:
        return str(row["floor_name"])
    snap = row["location_snapshot"] if "location_snapshot" in row.keys() else None
    if snap:
        try:
            name = json.loads(snap).get("name")
            if isinstance(name, str) and name:
                return name
        except ValueError:
            pass
    return None


def ticket_people(row: sqlite3.Row) -> dict[str, Any]:
    by = str(row["created_by"] or "")
    requester = None if by.startswith(("partner:", "system")) else (row["created_by_name"] or None)
    return {"requester_name": requester, "assignee_name": row["assignee_name"] or None}


def _partner_of(conn: sqlite3.Connection, ticket_id: str) -> str | None:
    r = conn.execute("SELECT client_id FROM partner_ticket_links WHERE ticket_id = ?", (ticket_id,)).fetchone()
    return r[0] if r else None


def on_ticket_created(conn: sqlite3.Connection, ticket_id: str) -> None:
    def work() -> None:
        if not _active(conn):
            return
        t = _ticket(conn, ticket_id)
        if t is None:
            return
        origin = "partner" if _partner_of(conn, ticket_id) else str(t["origin"])
        data = {"ticket_id": t["id"], "number": int(t["number"]), "department_key": str(t["department_key"]), "category": t["category_name"],
                "priority_key": str(t["priority_key"]), "place": ticket_place(t), "origin": origin, "at": str(t["created_at"])}
        enqueue(conn, "ticket.created", data, place=(t["site_id"], t["building_id"], t["floor_id"]), department_id=t["department_id"],
                partner_client=_partner_of(conn, ticket_id), text={"title": t["title"] or "", "description": t["description"] or ""},
                people=ticket_people(t))

    _savepoint(conn, work)


def on_notification(conn: sqlite3.Connection, signal: Any, action: str) -> None:
    """Called by notify._emit after it CREATED (`created`) or RESOLVED (`resolved`) a row."""
    source = str(getattr(signal, "source", "") or "")
    if action not in ("created", "resolved") or source.startswith(EXCLUDED_PREFIXES):
        return
    if action == "resolved":
        event = next((ev for prefix, ev in RESOLVE_FAMILIES.items() if source.startswith(prefix) and source in SOURCE_EVENTS), None)
    else:
        event = SOURCE_EVENTS.get(source)
    if event is None:
        return

    def work() -> None:
        if not _active(conn):
            return
        sid = str(signal.subject_id or "")
        at = iso(utcnow())
        if event.startswith("ticket."):
            t = _ticket(conn, sid)
            if t is None:
                return
            place = (t["site_id"], t["building_id"], t["floor_id"])
            if event == "ticket.done":
                data = {"ticket_id": t["id"], "number": int(t["number"]), "at": at}
            else:
                frm = (signal.params or {}).get("from_status")
                data = {"ticket_id": t["id"], "number": int(t["number"]), "from_status": frm if isinstance(frm, str) else None, "to_status": str(t["status"]), "at": at}
            enqueue(conn, event, data, place=place, department_id=t["department_id"], partner_client=_partner_of(conn, sid))
        elif event.startswith("temperature."):
            u = conn.execute("SELECT * FROM infra_temp_units WHERE id = ?", (sid,)).fetchone()
            if u is None:
                return
            if event == "temperature.resolved":
                data = {"unit_id": sid, "source": source, "at": at}
            else:
                data = {"unit_id": sid, "name": str(u["name"]), "place": _str_or_none((signal.params or {}).get("place")), "state": event.split(".", 1)[1],
                        "reading": _reading(conn, u["temp_entity_id"]), "low": _num(u, "low"), "high": _num(u, "high"), "at": at}
            enqueue(conn, event, data, entity_ids=[u["temp_entity_id"]])
        else:
            e = conn.execute("SELECT * FROM infra_elevators WHERE id = ?", (sid,)).fetchone()
            if e is None:
                return
            role = source.split(".", 1)[1]
            sensors = [r[0] for r in conn.execute("SELECT entity_id FROM infra_elevator_sensors WHERE elevator_id = ? AND role = ?", (sid, role)).fetchall()]
            if event == "elevator.resolved":
                data = {"elevator_id": sid, "source": source, "at": at}
            else:
                data = {"elevator_id": sid, "name": str(e["name"]), "place": _str_or_none((signal.params or {}).get("place")), "state": role, "at": at}
            enqueue(conn, event, data, entity_ids=sensors)

    _savepoint(conn, work)


def _str_or_none(v: Any) -> str | None:
    return v if isinstance(v, str) and v else None


def _num(row: sqlite3.Row, key: str) -> float | None:
    if key not in row.keys():
        return None
    v = row[key]
    return float(v) if isinstance(v, (int, float)) and not isinstance(v, bool) else None


def _reading(conn: sqlite3.Connection, entity_id: str | None) -> float | None:
    if not entity_id:
        return None
    r = conn.execute("SELECT state FROM ha_entities WHERE entity_id = ?", (entity_id,)).fetchone()
    try:
        return round(float(r["state"]), 2) if r else None
    except (TypeError, ValueError):
        return None


# ---------------------------------------------------------------- delivery

def wake() -> None:
    _WAKE.set()


def backoff_s(attempt: int, retry_after: float | None = None) -> float:
    base = BACKOFF_S[min(attempt, len(BACKOFF_S)) - 1]
    delay = base * (0.5 + random.random() * 0.5)  # jitter within [base/2, base] - never an immediate retry
    if retry_after is not None:
        delay = max(delay, min(float(retry_after), RETRY_AFTER_CAP_S))
    return delay


def _retry_after(value: str | None) -> float | None:
    if not value:
        return None
    try:
        return max(0.0, min(float(value.strip()), RETRY_AFTER_CAP_S))
    except ValueError:
        return None


class _Attempt:
    def __init__(self) -> None:
        self.status: int | None = None
        self.error: str | None = None
        self.retry_after: float | None = None
        self.ms = 0


def send(target: ssrf.Target, ip: str, body: bytes, headers: dict[str, str]) -> _Attempt:
    """One POST to the checked address. Never follows a redirect, never reads proxy variables, reads at most 4 KiB of the answer."""
    res = _Attempt()
    host = f"[{ip}]" if ":" in ip else ip
    url = f"https://{host}:{target.port}{target.path}"
    t0 = time.monotonic()
    mark = _SENDING.set(True)
    try:
        with httpx.Client(transport=TRANSPORT, timeout=httpx.Timeout(TOTAL_S, connect=CONNECT_S), follow_redirects=False, trust_env=False) as client:
            with client.stream("POST", url, content=body, headers={**headers, "Host": target.host_header},
                               extensions={"sni_hostname": target.host}) as r:
                read = 0
                for chunk in r.iter_bytes():
                    read += len(chunk)
                    if read >= ANSWER_READ_MAX or time.monotonic() - t0 > TOTAL_S:
                        break
                res.status = r.status_code
                res.retry_after = _retry_after(r.headers.get("retry-after"))
    except httpx.TimeoutException:
        res.error = "timeout"
    except httpx.ConnectError as exc:
        res.error = "tls" if "SSL" in type(exc.__cause__ or exc).__name__ or "certificate" in str(exc).lower() else "connect"
    except httpx.HTTPError:
        res.error = "network"
    finally:
        _SENDING.reset(mark)
    res.ms = int((time.monotonic() - t0) * 1000)
    if res.status is not None and 300 <= res.status < 400:
        res.error = "redirect"
    elif res.status is not None and not 200 <= res.status < 300:
        res.error = "http_4xx" if res.status < 500 else "http_5xx"
    return res


def _secrets(data_dir: Path, ep: sqlite3.Row, now: dt.datetime) -> list[str]:
    cur = _open(data_dir, ep["id"], "secret", ep["secret_enc"])
    out = [cur] if cur else []
    until = parse_iso(ep["secret_prev_until"])
    if ep["secret_prev_enc"] and until and until > now:
        prev = _open(data_dir, ep["id"], "secret_prev", ep["secret_prev_enc"])
        if prev:
            out.append(prev)
    return out


def _notice_paused(conn: sqlite3.Connection, ep_id: str, label: str) -> None:
    from .. import notify

    try:
        notify.emit_full(conn, notify.Signal("partner.endpoint_paused", "system", ep_id, params={"name": label or ep_id}, link="#/system/connections"))
    except Exception:  # noqa: BLE001
        pass


def attempt_one(db: Database, data_dir: Path, settings: Any, event_id: str, *, ping: bool = False) -> dict[str, Any]:
    """Deliver one outbox row now: mark it delivering, LEAVE the database, check and connect, then record the outcome."""
    now = utcnow()
    with db.connection(label="partner.deliver.claim") as conn:
        row = conn.execute("SELECT * FROM partner_outbox WHERE id = ?", (event_id,)).fetchone()
        ep = _endpoint(conn, row["endpoint_id"]) if row else None
        if row is None or ep is None or row["state"] not in ("queued",):
            return {"state": row["state"] if row else "missing"}
        if ep["state"] == "disabled":
            conn.execute("UPDATE partner_outbox SET state = 'dead', dead_reason = 'disabled', ended_at = ? WHERE id = ?", (iso(now), event_id))
            return {"state": "dead"}
        if ep["state"] == "paused" and not ping:
            conn.execute("UPDATE partner_outbox SET state = 'dead', dead_reason = 'paused', ended_at = ? WHERE id = ?", (iso(now), event_id))
            return {"state": "dead"}
        occurred = parse_iso(row["occurred_at"]) or now
        if (now - occurred).total_seconds() > MAX_AGE_S:
            conn.execute("UPDATE partner_outbox SET state = 'dead', dead_reason = 'expired', ended_at = ? WHERE id = ?", (iso(now), event_id))
            return {"state": "dead"}
        conn.execute("UPDATE partner_outbox SET state = 'delivering', attempts = attempts + 1 WHERE id = ?", (event_id,))
        attempt_no = int(row["attempts"]) + 1
        url = _open(data_dir, ep["id"], "url", ep["url_enc"])
        keys = _secrets(data_dir, ep, now)
        body = row["payload_json"].encode("utf-8")
        ep_label, etype = ep["label"], row["type"]
    # ---- no database connection from here until the outcome is recorded
    started = iso(utcnow())
    res = _Attempt()
    if not url or not keys:
        res.error = "secret_unreadable"
    else:
        try:
            target = ssrf.parse(url)
            ip = ssrf.check(target, extra_names=extra_names(settings), trusted=_trusted(settings))
        except ssrf.Refused as exc:
            res.error = "refused_address" if exc.code in ("refused_address", "refused_name") else exc.code
            target = None
            ip = ""
        if target is not None:
            ts = int(CLOCK())
            headers = {"content-type": "application/json", "user-agent": "SmplWise-Arx-Webhooks/1", "webhook-id": event_id,
                       "webhook-timestamp": str(ts), "webhook-signature": signature_header(keys, event_id, ts, body), "accept-encoding": "identity"}
            res = send(target, ip, body, headers)
    ok = res.status is not None and 200 <= res.status < 300 and res.error is None
    with db.connection(label="partner.deliver.record") as conn:
        conn.execute("INSERT INTO partner_deliveries (event_id, endpoint_id, type, attempt, started_at, duration_ms, http_status, error_class) VALUES (?,?,?,?,?,?,?,?)",
                     (event_id, ep["id"], etype, attempt_no, started, res.ms, res.status, res.error))
        now2 = utcnow()
        if res.error == "refused_address":
            audit(conn, actor=None, action="partner.endpoint.refused_address", decision="denied", resource_type="partner_endpoint", resource_id=ep["id"],
                  reason="refused_address", details={"host": ep["host"]})
        if ok:
            conn.execute("UPDATE partner_outbox SET state = 'delivered', delivered_at = ?, ended_at = ? WHERE id = ?", (iso(now2), iso(now2), event_id))
            conn.execute("UPDATE partner_endpoints SET fail_streak = 0, first_fail_at = NULL, last_success_at = ?, last_attempt_at = ?, "
                         "state = CASE WHEN state IN ('pending', 'paused') AND ? THEN 'active' ELSE state END WHERE id = ?",
                         (iso(now2), iso(now2), 1 if ping else 0, ep["id"]))
            return {"state": "delivered", "http_status": res.status}
        conn.execute("UPDATE partner_endpoints SET fail_streak = fail_streak + 1, first_fail_at = COALESCE(first_fail_at, ?), last_attempt_at = ? WHERE id = ?",
                     (iso(now2), iso(now2), ep["id"]))
        dead_reason = None
        if res.status == 410:
            dead_reason = "gone"
            conn.execute("UPDATE partner_endpoints SET state = 'disabled', state_reason = 'gone', updated_at = ? WHERE id = ?", (iso(now2), ep["id"]))
        elif res.status is not None and 400 <= res.status < 500 and res.status not in RETRY_STATUSES:
            dead_reason = "client_error"
        elif ping or attempt_no > len(BACKOFF_S):
            dead_reason = "attempts" if not ping else "client_error" if res.status and 400 <= res.status < 500 else "attempts"
        if dead_reason:
            conn.execute("UPDATE partner_outbox SET state = 'dead', dead_reason = ?, ended_at = ? WHERE id = ?", (dead_reason, iso(now2), event_id))
        else:
            nxt = now2 + dt.timedelta(seconds=backoff_s(attempt_no, res.retry_after if res.status in (429, 503) else None))
            conn.execute("UPDATE partner_outbox SET state = 'queued', next_at = ? WHERE id = ?", (iso(nxt), event_id))
        e2 = _endpoint(conn, ep["id"])
        first = parse_iso(e2["first_fail_at"]) if e2 else None
        if e2 is not None and e2["state"] == "active" and (e2["fail_streak"] >= CIRCUIT_FAILS or (first and (now2 - first).total_seconds() >= CIRCUIT_SILENCE_S)):
            conn.execute("UPDATE partner_endpoints SET state = 'paused', state_reason = 'circuit', updated_at = ? WHERE id = ?", (iso(now2), ep["id"]))
            audit(conn, actor=None, action="partner.endpoint.paused", decision="allowed", resource_type="partner_endpoint", resource_id=ep["id"],
                  details={"reason": "circuit"})
            _notice_paused(conn, ep["id"], ep_label)
        return {"state": "dead" if dead_reason else "queued", "http_status": res.status, "error": res.error}


def ping(db: Database, settings: Any, principal: Principal, endpoint_id: str, rid: str | None = None) -> dict[str, Any]:
    """The test button / creation check: one `endpoint.ping`, delivered now (needs the webhooks switch on). A success activates the endpoint."""
    with db.connection(label="partner.ping") as conn:
        ep = _endpoint(conn, endpoint_id)
        if ep is None or ep["state"] == "disabled":
            raise PartnerError(404, "not_found")
        if not _active(conn):
            raise PartnerError(409, "webhooks_off")
        now = utcnow()
        data = build("endpoint.ping", {"endpoint_id": endpoint_id, "at": iso(now)})
        row = dict(ep)
        row["state"] = "active"  # a paused / pending endpoint still receives its ping
        eid = _enqueue_row(conn, row, "endpoint.ping", data, now)
        audit(conn, actor=principal, action="partner.endpoint.ping", decision="allowed", resource_type="partner_endpoint", resource_id=endpoint_id, request_id=rid)
    result = attempt_one(db, Path(settings.data_dir), settings, eid, ping=True)
    return {"event_id": eid, **result}


def deliver_due(db: Database, settings: Any, *, limit: int = 50) -> dict[str, int]:
    """One pass of the worker: due rows, at most one per endpoint per pass (per-endpoint concurrency 1), inside the outbound limits."""
    out = {"attempted": 0, "delivered": 0, "deferred": 0}
    with db.connection(mode="read", label="partner.deliver.due") as conn:
        if not _active(conn):
            return out
        rows = conn.execute("""SELECT o.id, o.endpoint_id FROM partner_outbox o JOIN partner_endpoints e ON e.id = o.endpoint_id
                               WHERE o.state = 'queued' AND o.next_at <= ? ORDER BY o.occurred_at LIMIT ?""", (iso(utcnow()), limit * 4)).fetchall()
    seen: set[str] = set()
    for r in rows:
        if r["endpoint_id"] in seen or out["attempted"] >= limit:
            continue
        if _OUT.check(f"ep:{r['endpoint_id']}", OUT_PER_ENDPOINT) > 0 or _OUT.check("all", OUT_GLOBAL) > 0:
            out["deferred"] += 1
            continue  # queued, not dropped
        _OUT.record(f"ep:{r['endpoint_id']}", OUT_PER_ENDPOINT)
        _OUT.record("all", OUT_GLOBAL)
        seen.add(r["endpoint_id"])
        res = attempt_one(db, Path(settings.data_dir), settings, r["id"])
        out["attempted"] += 1
        out["delivered"] += res.get("state") == "delivered"
    return out


def recover(db: Database) -> int:
    """At start: a row left `delivering` by a crash goes back to the queue (its attempt counted)."""
    with db.connection(label="partner.deliver.recover") as conn:
        return conn.execute("UPDATE partner_outbox SET state = 'queued' WHERE state = 'delivering'").rowcount


def janitor(conn: sqlite3.Connection, now: dt.datetime | None = None) -> dict[str, int]:
    now = now or utcnow()
    out = {"log": 0, "outbox": 0, "secrets": 0}
    out["log"] = conn.execute("DELETE FROM partner_deliveries WHERE started_at < ?", (iso(now - dt.timedelta(days=KEEP_LOG_DAYS)),)).rowcount
    out["outbox"] = conn.execute("DELETE FROM partner_outbox WHERE state IN ('delivered', 'dead') AND ended_at < ?",
                                 (iso(now - dt.timedelta(days=KEEP_DEAD_DAYS)),)).rowcount
    out["secrets"] = conn.execute("UPDATE partner_endpoints SET secret_prev_enc = NULL, secret_prev_until = NULL WHERE secret_prev_until IS NOT NULL AND secret_prev_until <= ?",
                                  (iso(now),)).rowcount
    for r in conn.execute("SELECT id, label, first_fail_at FROM partner_endpoints WHERE state = 'active' AND first_fail_at IS NOT NULL").fetchall():
        first = parse_iso(r["first_fail_at"])
        if first and (now - first).total_seconds() >= CIRCUIT_SILENCE_S:
            conn.execute("UPDATE partner_endpoints SET state = 'paused', state_reason = 'circuit', updated_at = ? WHERE id = ?", (iso(now), r["id"]))
            _notice_paused(conn, r["id"], r["label"])
    return out


async def worker_loop(db: Database, settings: Any, every_s: float = 5.0) -> None:
    """The delivery worker: wakes on an enqueue or every `every_s`; does nothing while the switch is off."""
    import asyncio

    from starlette.concurrency import run_in_threadpool

    try:
        await run_in_threadpool(recover, db)
    except Exception:  # noqa: BLE001
        log.warning("partner outbox recovery failed", exc_info=True)
    while True:
        try:
            await asyncio.wait_for(run_in_threadpool(_WAKE.wait, every_s), every_s + 1)
        except asyncio.TimeoutError:
            pass
        _WAKE.clear()
        try:
            await run_in_threadpool(deliver_due, db, settings)
        except Exception:  # noqa: BLE001 - the worker never dies
            log.warning("partner delivery pass failed", exc_info=True)
