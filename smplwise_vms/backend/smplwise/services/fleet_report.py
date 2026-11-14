"""CR-FLEET215: the fleet health report - one small, signed, closed-schema document a day, sent by THIS installation to the SmplWise
fleet receiver only while two independent keys are both turned:

1. the add-on option `fleet_report_url` (the installer, at the add-on level; config.py puts it in SW_FLEET_REPORT_URL), and
2. the Arx switch `fleet.report_enabled` (the customer's system administrator, Settings; OFF by default, audited).

Either one off -> nothing is built, nothing is signed, no key is generated, no sequence number is used and no connection is opened.

What the report is (docs/changes/CR-FLEET215.md section 3 justifies every field): versions, per-subsystem states from a closed set,
counters, disk percentages, backup age in hours, the update check result and the readiness score's ids. What it can never be: a name, an
address, a host, a URL, an id of a person / camera / door / entity, any free text, a camera frame, an event, an alert title or anything a
door does. That is enforced, not hoped for: `validate()` checks the EXACT key set at every level and the type / range / enum of every
value, and refuses the whole report on any deviation (fail closed) - so a future change that adds a field without changing SCHEMA_KEYS
cannot leak it. The only strings that pass are the schema constant, the random installation id, the timestamp, version strings matching
VERSION_RE and enum members.

How it leaves: an HTTPS POST of the canonical JSON body to `<fleet_report_url>/v1/report`, signed with the installation's fleet key
(services/fleet_keys.py: Ed25519 over CONTEXT + body; the receiver knows the public key only through an explicit enrollment). Outbound
only, like the push relay (CR-027): no new listener, no new route on the remote channel, no inbound path. No redirects are followed.
The exact body of every attempt is kept in `fleet_report_log` (the last LOG_KEEP) so the customer sees what was sent.

`TRANSPORT` lets the tests install a fake receiver (httpx.MockTransport), like services/mobile_push.py."""
from __future__ import annotations

import asyncio
import datetime as dt
import json
import logging
import os
import re
import sqlite3
import time
from typing import Any
from urllib.parse import urlsplit

import httpx

from .. import __version__
from ..config import Settings
from ..db import Database, get_setting, now_iso, set_setting
from ..mode import installation_mode
from . import demo_mode, fleet_keys, readiness

log = logging.getLogger("smplwise.fleet_report")

SCHEMA = "smplwise-fleet-report/1"
SWITCH = "fleet.report_enabled"           # "true" | "false" (default false); Arx setting, system administrator only
URL_ENV = "SW_FLEET_REPORT_URL"            # from the add-on option `fleet_report_url` (config.py)
DEMO_MARK = "demo.example"                 # CR-READY96: set only inside a demo database (services/demo_mode._seed); the report says whether it read one
REPORT_PATH = "/v1/report"
SEND_TIMEOUT_S = 10.0
MAX_BODY_BYTES = 8 * 1024
LOG_KEEP = 30
PERIOD_OK_S = 24 * 3600
PERIOD_RETRY_S = 3 * 3600
FIRST_DELAY_S = 300
CHECK_EVERY_S = 3600
TRANSPORT: httpx.BaseTransport | None = None

# FLEET215 UI slice: the silence threshold (hours without a report before the receiver shows "not reporting") is an installation setting,
# editable by the system administrator; it travels as ONE header (never in the signed body: the 52-field schema is unchanged).
SILENT_KEY = "fleet.silent_after_h"
SILENT_DEFAULT_H = 36
SILENT_MIN_H = 26   # a daily report plus its 3-hour retry must never look silent
SILENT_MAX_H = 168
# The "reporting stopped" message: one last small signed message sent when the customer switches the report off, so the receiver shows
# "off" instead of "silent". Its own tiny closed schema (not the report schema), its own path.
STOP_SCHEMA = "smplwise-fleet-stop/1"
STOP_PATH = "/v1/stopped"
STOP_KEYS = ("schema", "installation_id", "seq", "generated_at")

STATES = ("ok", "warn", "error", "off", "absent", "unknown")
OVERALL = ("ok", "warn", "error")
COMPONENTS = ("db", "storage", "nvr", "go2rtc", "ha_sync", "bridge", "events_ingest", "events_derive", "discovery", "thumbnails",
              "exports", "backups", "frigate")
VENDORS = ("hikvision", "provision_isr", "frigate", "none")
UPDATE_CHECKS = ("current", "available", "refresh_failed_read_ok", "unreachable", "not_permitted", "error", "unknown")
MODES = ("full", "ha_only")
VERSION_RE = re.compile(r"^[0-9A-Za-z._+-]{1,40}$")
ID_RE = re.compile(r"^[0-9a-f]{32}$")
TIME_RE = re.compile(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00Z$")
INT_MAX = 10_000_000

# ---------------------------------------------------------------- the closed schema
# A spec is: a dict (exact key set, recursive), ("int", lo, hi, nullable), ("bool", nullable), ("enum", values, nullable),
# ("version", nullable), ("const", value), ("re", pattern), ("ids", allowed values) - a list of distinct members.


def _int(lo: int = 0, hi: int = INT_MAX, null: bool = False) -> tuple:
    return ("int", lo, hi, null)


SCHEMA_KEYS: dict[str, Any] = {
    "schema": ("const", SCHEMA),
    "installation_id": ("re", ID_RE),
    "seq": _int(1),
    "generated_at": ("re", TIME_RE),
    "mode": ("enum", MODES, False),
    "demo_mode": ("bool", False),
    "overall": ("enum", OVERALL, False),
    "uptime_h": _int(),
    "versions": {"addon": ("version", False), "bridge": ("version", True), "bridge_required": ("version", True), "ha": ("version", True),
                 "go2rtc": ("version", True), "db_schema": _int(null=True)},
    "components": {c: ("enum", STATES, False) for c in COMPONENTS},
    "counts": {"cameras": _int(), "recorders": _int(), "recorders_by_vendor": {v: _int() for v in VENDORS}, "ha_entities": _int(),
               "floors_published": _int(), "users_active": _int(), "system_admins": _int()},
    "alerts_open": {"info": _int(), "alert": _int(), "critical": _int()},
    "disk": {"free_pct": _int(0, 100, True), "free_gb": _int(null=True), "total_gb": _int(null=True)},
    "backup": {"count": _int(), "last_age_h": _int(null=True), "offbox_targets": _int()},
    "update": {"check": ("enum", UPDATE_CHECKS, False), "available": ("bool", True), "latest": ("version", True)},
    "readiness": {"score": _int(0, 100), "ready": ("bool", False), "missing": ("ids", readiness.CHECK_IDS)},
}


class FleetSchemaError(ValueError):
    """The built report does not match SCHEMA_KEYS exactly; nothing is signed or sent. `path` names the place (never a value)."""

    def __init__(self, path: str, why: str) -> None:
        super().__init__(f"{path}: {why}")
        self.path = path
        self.why = why


def _check(spec: Any, value: Any, path: str) -> None:
    if isinstance(spec, dict):
        if not isinstance(value, dict):
            raise FleetSchemaError(path, "not_an_object")
        extra, absent = set(value) - set(spec), set(spec) - set(value)
        if extra:
            raise FleetSchemaError(path, "unexpected_key")
        if absent:
            raise FleetSchemaError(path, "missing_key")
        for k, sub in spec.items():
            _check(sub, value[k], f"{path}.{k}" if path else k)
        return
    kind = spec[0]
    if kind == "const":
        if value != spec[1]:
            raise FleetSchemaError(path, "wrong_constant")
    elif kind == "re":
        if not isinstance(value, str) or not spec[1].match(value):
            raise FleetSchemaError(path, "bad_format")
    elif kind == "int":
        _, lo, hi, null = spec
        if value is None and null:
            return
        if isinstance(value, bool) or not isinstance(value, int) or not lo <= value <= hi:
            raise FleetSchemaError(path, "bad_integer")
    elif kind == "bool":
        if value is None and spec[1]:
            return
        if not isinstance(value, bool):
            raise FleetSchemaError(path, "bad_boolean")
    elif kind == "enum":
        if value is None and spec[2]:
            return
        if not isinstance(value, str) or value not in spec[1]:
            raise FleetSchemaError(path, "not_in_enum")
    elif kind == "version":
        if value is None and spec[1]:
            return
        if not isinstance(value, str) or not VERSION_RE.match(value):
            raise FleetSchemaError(path, "bad_version")
    elif kind == "ids":
        if not isinstance(value, list) or len(set(value)) != len(value) or any(not isinstance(v, str) or v not in spec[1] for v in value):
            raise FleetSchemaError(path, "bad_id_list")
    else:  # pragma: no cover - a spec typo
        raise FleetSchemaError(path, "unknown_spec")


def validate(payload: Any) -> None:
    _check(SCHEMA_KEYS, payload, "")


def schema_json(spec: Any = None) -> dict[str, Any]:
    """SCHEMA_KEYS as plain JSON - the receiver validates with the SAME description (services/fleet-receiver/src/schema.json; a test
    keeps the committed file equal to this)."""
    spec = SCHEMA_KEYS if spec is None else spec
    if isinstance(spec, dict):
        return {"type": "object", "keys": {k: schema_json(v) for k, v in spec.items()}}
    kind = spec[0]
    if kind == "const":
        return {"type": "const", "value": spec[1]}
    if kind == "re":
        return {"type": "re", "pattern": spec[1].pattern}
    if kind == "int":
        return {"type": "int", "min": spec[1], "max": spec[2], "null": spec[3]}
    if kind == "bool":
        return {"type": "bool", "null": spec[1]}
    if kind == "enum":
        return {"type": "enum", "values": list(spec[1]), "null": spec[2]}
    if kind == "version":
        return {"type": "version", "pattern": VERSION_RE.pattern, "null": spec[1]}
    if kind == "ids":
        return {"type": "ids", "values": list(spec[1])}
    raise ValueError(kind)  # pragma: no cover


def canonical(payload: dict[str, Any]) -> bytes:
    """The exact bytes that are signed and sent: sorted keys, no spaces, ASCII only."""
    return json.dumps(payload, sort_keys=True, separators=(",", ":"), ensure_ascii=True).encode("ascii")


# ---------------------------------------------------------------- collecting (counts and states only)

def _version(value: Any) -> str | None:
    return value if isinstance(value, str) and VERSION_RE.match(value) else None


def _bounded(value: Any, lo: int = 0, hi: int = INT_MAX) -> int:
    try:
        n = int(value)
    except (TypeError, ValueError):
        return lo
    return max(lo, min(hi, n))


def _table(conn: sqlite3.Connection, name: str) -> bool:
    return conn.execute("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?", (name,)).fetchone() is not None


def _scalar(conn: sqlite3.Connection, table: str, sql: str, args: tuple = ()) -> int:
    if not _table(conn, table):
        return 0
    try:
        return _bounded(conn.execute(sql, args).fetchone()[0] or 0)
    except sqlite3.Error:
        return 0


def _state(value: Any) -> str:
    return value if value in STATES else "unknown"


def collect(settings: Settings, conn: sqlite3.Connection, health: dict[str, Any], ready: dict[str, Any]) -> dict[str, Any]:
    """Everything but the identity block (installation_id, seq, generated_at). `health` is services/health_report.build(...)."""
    checks = {c.get("id"): c for c in health.get("checks", []) if isinstance(c, dict)}

    def meta(cid: str) -> dict[str, Any]:
        return (checks.get(cid) or {}).get("meta") or {}

    components = {c: _state((checks.get(c) or {}).get("status", "absent")) for c in COMPONENTS if c != "frigate"}
    vendors = {v: 0 for v in VENDORS}
    if _table(conn, "recorder_connections"):
        for vendor, n in conn.execute("SELECT vendor, COUNT(*) FROM recorder_connections WHERE enabled = 1 GROUP BY vendor").fetchall():
            key = vendor if vendor in VENDORS else "none"
            vendors[key] += _bounded(n)
    frigate_primary = (settings.nvr_vendor or "") == "frigate"
    components["frigate"] = components["nvr"] if frigate_primary else ("unknown" if vendors["frigate"] else "absent")

    storage = meta("storage")
    free, total = storage.get("free"), storage.get("total")
    disk = {"free_pct": None, "free_gb": None, "total_gb": None}
    if isinstance(free, int) and isinstance(total, int) and total > 0:
        disk = {"free_pct": _bounded(round(100 * free / total), 0, 100), "free_gb": _bounded(free // 1024**3), "total_gb": _bounded(total // 1024**3)}

    bk = meta("backups")
    age_s = bk.get("last_age_s")
    alerts = {"info": 0, "alert": 0, "critical": 0}
    if _table(conn, "notifications"):
        for sev, n in conn.execute("SELECT severity, COUNT(*) FROM notifications WHERE state = 'open' GROUP BY severity").fetchall():
            if sev in alerts:
                alerts[sev] = _bounded(n)
    check = get_setting(conn, "update.check_result") or "unknown"
    available = get_setting(conn, "update.available")
    from . import setup_wizard

    ha_meta, bridge_meta = meta("ha_sync"), meta("bridge")
    return {
        "schema": SCHEMA,
        "mode": installation_mode(settings) if installation_mode(settings) in MODES else "full",
        "demo_mode": (get_setting(conn, DEMO_MARK, "false") or "false") == "true",
        "overall": health.get("status") if health.get("status") in OVERALL else "error",
        "uptime_h": _bounded((health.get("uptime_s") or 0) // 3600),
        "versions": {"addon": _version(__version__) or "0", "bridge": _version(bridge_meta.get("integration_version")),
                     "bridge_required": _version(bridge_meta.get("bridge_required")), "ha": _version(ha_meta.get("ha_version")),
                     "go2rtc": _version(meta("go2rtc").get("version")),
                     "db_schema": _bounded(meta("db").get("schema")) if isinstance(meta("db").get("schema"), int) else None},
        "components": components,
        "counts": {"cameras": _scalar(conn, "cameras", "SELECT COUNT(*) FROM cameras"), "recorders": sum(vendors.values()),
                   "recorders_by_vendor": vendors, "ha_entities": _scalar(conn, "ha_entities", "SELECT COUNT(*) FROM ha_entities WHERE removed_at IS NULL"),
                   "floors_published": _scalar(conn, "plan_versions", "SELECT COUNT(DISTINCT floor_id) FROM plan_versions WHERE status = 'published'"),
                   "users_active": _scalar(conn, "users", "SELECT COUNT(*) FROM users WHERE active = 1"),
                   "system_admins": _bounded(setup_wizard._system_admins(conn))},
        "alerts_open": alerts,
        "disk": disk,
        "backup": {"count": _bounded(bk.get("count") or 0), "last_age_h": _bounded(age_s // 3600) if isinstance(age_s, (int, float)) else None,
                   "offbox_targets": _scalar(conn, "backup_offbox_targets", "SELECT COUNT(*) FROM backup_offbox_targets WHERE enabled = 1")},
        "update": {"check": check if check in UPDATE_CHECKS else "unknown", "available": True if available == "true" else False if available == "false" else None,
                   "latest": _version(get_setting(conn, "update.latest"))},
        "readiness": readiness_block(ready),
    }


def readiness_block(report: dict[str, Any]) -> dict[str, Any]:
    """READYFLEET-295: the report's readiness block is a projection of CR-READY96's `readiness.evaluate()` - the single source of truth
    (its checks, weights and thresholds are the `readiness.*` settings, edited in Settings). Ids only, never a summary, fact or link:
    - `score`: the evaluated score;
    - `ready`: the hand-over advice is met (score at or above `readiness.advice_score` and no critical check short);
    - `missing`: the applicable checks that are not complete (attention / blocked / pending), blockers first, then by the points they would add."""
    checks = [x for x in report.get("checks", []) if isinstance(x, dict) and x.get("id") in readiness.CHECK_IDS]
    short = [x for x in checks if x.get("applicable") and x.get("status") in readiness.NOT_DONE]
    short.sort(key=lambda x: (x.get("status") != readiness.BLOCKED, -int(x.get("gain") or 0), readiness.CHECK_IDS.index(x["id"])))
    return {"score": _bounded(report.get("score"), 0, 100), "ready": bool((report.get("handover") or {}).get("advice_met")),
            "missing": [x["id"] for x in short]}


def assemble(body: dict[str, Any], *, installation_id: str, seq: int, now: dt.datetime) -> dict[str, Any]:
    """The full report (validated). The timestamp is cut to the minute: the report says which day and hour, not a precise instant."""
    payload = {**body, "installation_id": installation_id, "seq": seq,
               "generated_at": now.astimezone(dt.timezone.utc).replace(second=0, microsecond=0).strftime("%Y-%m-%dT%H:%M:00Z")}
    validate(payload)
    if len(canonical(payload)) > MAX_BODY_BYTES:
        raise FleetSchemaError("", "too_large")
    return payload


def build_body(settings: Settings, conn: sqlite3.Connection, *, probe: bool = True) -> dict[str, Any]:
    """health report (cached probes) + readiness -> the report body. Read-only on the database."""
    from . import health_report

    health = health_report.build(settings, conn, probe=probe)
    ready = readiness.evaluate(conn, settings)  # READYFLEET-295: CR-READY96's evaluation, never a second readiness rule
    return collect(settings, conn, health, ready)


# ---------------------------------------------------------------- the two keys

def silent_after_h(conn: sqlite3.Connection) -> int:
    try:
        n = int(get_setting(conn, SILENT_KEY, str(SILENT_DEFAULT_H)) or SILENT_DEFAULT_H)
    except ValueError:
        n = SILENT_DEFAULT_H
    return max(SILENT_MIN_H, min(SILENT_MAX_H, n))


def switch_on(conn: sqlite3.Connection) -> bool:
    return (get_setting(conn, SWITCH, "false") or "false") == "true"


def receiver_url() -> tuple[str | None, str | None]:
    """(base URL, None) or (None, reason). Only `https://host[:port][/path]`: no user info, query or fragment."""
    raw = (os.environ.get(URL_ENV) or "").strip()
    if not raw:
        return None, "receiver_not_configured"
    try:
        u = urlsplit(raw)
        port_ok = u.port is None or 0 < u.port < 65536
    except ValueError:
        return None, "receiver_url_invalid"
    if u.scheme != "https" or not u.hostname or u.username or u.password or u.query or u.fragment or not port_ok:
        return None, "receiver_url_invalid"
    return raw.rstrip("/"), None


# ---------------------------------------------------------------- sending

def _record(conn: sqlite3.Connection, *, seq: int | None, kid: str | None, body: bytes | None, result: str, http_status: int | None, trigger: str,
            actor: str | None) -> None:
    conn.execute(
        """INSERT INTO fleet_report_log(seq, kid, created_at, trigger, actor_user_id, result, http_status, payload_json)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
        (seq, kid, now_iso(), trigger, actor, result, http_status, body.decode("ascii") if body is not None else None))
    conn.execute("DELETE FROM fleet_report_log WHERE id NOT IN (SELECT id FROM fleet_report_log ORDER BY id DESC LIMIT ?)", (LOG_KEEP,))
    if trigger == "stop":  # the stop message never moves the daily-report state (nothing is due while the switch is off)
        set_setting(conn, "fleet.stopped_at", now_iso())
        set_setting(conn, "fleet.stopped_result", result)
        return
    set_setting(conn, "fleet.last_attempt_at", now_iso())
    set_setting(conn, "fleet.last_result", result)
    if result == "ok":
        set_setting(conn, "fleet.last_ok_at", now_iso())


def post(url: str, body: bytes, kid: str, sig: str, *, path: str = REPORT_PATH, schema: str = SCHEMA,
         silent_after_h: int | None = None) -> tuple[str, int | None]:
    """(result, http status). Results: ok | rejected | unreachable. The response body is never read into a log."""
    headers = {"content-type": "application/json", "x-arx-fleet-schema": schema, "x-arx-fleet-kid": kid, "x-arx-fleet-sig": sig,
               "user-agent": "smplwise-arx-fleet/1"}
    if silent_after_h is not None:
        headers["x-arx-fleet-silent-after-h"] = str(silent_after_h)
    try:
        with httpx.Client(timeout=SEND_TIMEOUT_S, transport=TRANSPORT, follow_redirects=False) as client:
            r = client.post(url + path, content=body, headers=headers)
    except (httpx.HTTPError, OSError) as exc:
        log.info("fleet report not delivered: %s", type(exc).__name__)
        return "unreachable", None
    if 200 <= r.status_code < 300:
        return "ok", r.status_code
    log.info("fleet report refused by the receiver: HTTP %s", r.status_code)
    return "rejected", r.status_code


def send_once(db: Database, settings: Settings, *, trigger: str = "schedule", actor: str | None = None, now: dt.datetime | None = None) -> dict[str, Any]:
    """One attempt. The two keys are read FIRST: while either is off this returns at once - no health build, no key, no sequence
    number, no connection, no log row. READYFLEET-295: the same while a CR-READY96 demo runs (the handle points at the demo file: its
    example data is never reported as this installation's state)."""
    if demo_mode.active(db):
        return {"sent": False, "result": "demo_active"}
    with db.connection(mode="read") as conn:
        if not switch_on(conn):
            return {"sent": False, "result": "switch_off"}
    url, why = receiver_url()
    if url is None:
        return {"sent": False, "result": why}
    with db.connection(mode="read") as conn:
        body = build_body(settings, conn, probe=True)
        silent_h = silent_after_h(conn)
    seq = fleet_keys.next_seq(settings)
    facts = fleet_keys.ensure(settings)
    try:
        payload = assemble(body, installation_id=facts["installation_id"], seq=seq, now=now or dt.datetime.now(dt.timezone.utc))
    except FleetSchemaError as exc:
        log.warning("fleet report refused by its own schema check at %s (%s); nothing sent", exc.path or "<root>", exc.why)
        with db.connection(label="fleet.report") as conn:
            _record(conn, seq=seq, kid=None, body=None, result="schema_refused", http_status=None, trigger=trigger, actor=actor)
        return {"sent": False, "result": "schema_refused", "seq": seq}
    data = canonical(payload)
    kid, sig = fleet_keys.sign(settings, data)
    result, status = post(url, data, kid, sig, silent_after_h=silent_h)
    with db.connection(label="fleet.report") as conn:
        _record(conn, seq=seq, kid=kid, body=data, result=result, http_status=status, trigger=trigger, actor=actor)
    return {"sent": result == "ok", "result": result, "http_status": status, "seq": seq}


def stop_body(installation_id: str, seq: int, now: dt.datetime) -> dict[str, Any]:
    body = {"schema": STOP_SCHEMA, "installation_id": installation_id, "seq": seq,
            "generated_at": now.astimezone(dt.timezone.utc).replace(second=0, microsecond=0).strftime("%Y-%m-%dT%H:%M:00Z")}
    if set(body) != set(STOP_KEYS) or not ID_RE.match(installation_id) or not TIME_RE.match(body["generated_at"]):  # pragma: no cover - guard
        raise FleetSchemaError("", "bad_stop")
    return body


def send_stop(db: Database, settings: Settings, *, actor: str | None = None, now: dt.datetime | None = None) -> dict[str, Any]:
    """The customer switched the report OFF: send ONE last signed "reporting stopped" message (best effort, one attempt, 10 s) so the
    receiver shows "off" instead of "silent". Sends nothing when the switch is still on, when the receiver option is unusable or when this
    installation never had an id (nothing was ever reported, the receiver does not know it). Never raises."""
    with db.connection(mode="read") as conn:
        if switch_on(conn):
            return {"sent": False, "result": "switch_on"}
    url, why = receiver_url()
    if url is None:
        return {"sent": False, "result": why}
    facts = fleet_keys.peek(settings)
    if not facts["installation_id"]:
        return {"sent": False, "result": "never_enrolled"}
    try:
        seq = fleet_keys.next_seq(settings)
        data = canonical(stop_body(facts["installation_id"], seq, now or dt.datetime.now(dt.timezone.utc)))
        kid, sig = fleet_keys.sign(settings, data)
        result, status = post(url, data, kid, sig, path=STOP_PATH, schema=STOP_SCHEMA)
        with db.connection(label="fleet.report") as conn:
            _record(conn, seq=seq, kid=kid, body=data, result=result, http_status=status, trigger="stop", actor=actor)
    except Exception as exc:  # noqa: BLE001 - a failed goodbye must never block the customer's switch
        log.warning("fleet stop message failed: %s", type(exc).__name__)
        return {"sent": False, "result": "error"}
    return {"sent": result == "ok", "result": result, "http_status": status, "seq": seq}


def due(conn: sqlite3.Connection, now: float | None = None) -> bool:
    now = time.time() if now is None else now
    last = get_setting(conn, "fleet.last_attempt_at")
    if not last:
        return True
    try:
        at = dt.datetime.fromisoformat(last.replace("Z", "+00:00")).timestamp()
    except ValueError:
        return True
    period = PERIOD_OK_S if get_setting(conn, "fleet.last_result") == "ok" else PERIOD_RETRY_S
    return now - at >= period


def tick(db: Database, settings: Settings) -> dict[str, Any] | None:
    if demo_mode.active(db):  # READYFLEET-295: nothing is due while a demo runs; the next tick after it ends decides
        return None
    with db.connection(mode="read") as conn:
        if not switch_on(conn) or not due(conn):
            return None
    if receiver_url()[0] is None:
        return None
    return send_once(db, settings, trigger="schedule")


async def worker_loop(db: Database, settings: Settings, first_delay_s: int = FIRST_DELAY_S, interval_s: int = CHECK_EVERY_S) -> None:
    """Checks once an hour whether a report is due; sends nothing while the switch or the add-on option is off."""
    from starlette.concurrency import run_in_threadpool

    await asyncio.sleep(first_delay_s)
    while True:
        try:
            await run_in_threadpool(tick, db, settings)
        except Exception as exc:  # noqa: BLE001 - keep the loop alive
            log.warning("fleet report tick failed: %s", type(exc).__name__)
        await asyncio.sleep(interval_s)


def log_rows(conn: sqlite3.Connection, limit: int = LOG_KEEP) -> list[dict[str, Any]]:
    rows = conn.execute("SELECT id, seq, kid, created_at, trigger, result, http_status, payload_json FROM fleet_report_log ORDER BY id DESC LIMIT ?",
                        (max(1, min(LOG_KEEP, limit)),)).fetchall()
    out = []
    for r in rows:
        out.append({"id": r["id"], "seq": r["seq"], "kid": r["kid"], "at": r["created_at"], "trigger": r["trigger"], "result": r["result"],
                    "http_status": r["http_status"], "payload": json.loads(r["payload_json"]) if r["payload_json"] else None})
    return out


def status(settings: Settings, conn: sqlite3.Connection) -> dict[str, Any]:
    url, why = receiver_url()
    facts = fleet_keys.peek(settings)
    return {
        "enabled": switch_on(conn),
        # the add-on option's VALUE is never returned (it is the installer's); only whether it is usable
        "receiver_configured": url is not None, "receiver_problem": why,
        "sending": switch_on(conn) and url is not None,
        "installation_id": facts["installation_id"], "kid": facts["kid"], "alg": facts["alg"], "last_seq": facts["seq"],
        "last_attempt_at": get_setting(conn, "fleet.last_attempt_at"), "last_result": get_setting(conn, "fleet.last_result"),
        "last_ok_at": get_setting(conn, "fleet.last_ok_at"),
        "schema": SCHEMA, "period_h": PERIOD_OK_S // 3600, "retry_h": PERIOD_RETRY_S // 3600,
        "silent_after_h": silent_after_h(conn), "silent_range_h": [SILENT_MIN_H, SILENT_MAX_H], "silent_default_h": SILENT_DEFAULT_H,
        "stopped_at": get_setting(conn, "fleet.stopped_at"), "stopped_result": get_setting(conn, "fleet.stopped_result"),
    }
