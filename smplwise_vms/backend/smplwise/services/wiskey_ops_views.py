"""WISKEY-OPS-VIEWS-2400 (WisKey full integration plan of 2026-11-03, task T11, capability rows 79, 80, 82): the operations and fleet
views of Settings › תפעול האינטרקום - natively in Arx, instead of the embedded panel's `operations_center`, `investigations`, `health`
and `audit` tools. The HTTP side is routers/access_control_ops.py; this module is the WisKey side.

What it reads (WisKey 2.0.1-rc.10, `C:\\hik intercom` @ origin/codex/wiskey-mac-m12-policy-b-2026-11-02; the pinned extract
`docs/integrations/wiskey/catalog/rc10-extract/`), each one a READ in WisKey's catalog (no `api_contract` on the frame):

| view | command | WisKey source |
|---|---|---|
| KPI summary | `overview/summary` | websocket.py `overview(include_users=False)` |
| operations | `operations/query` | access/operations_report.py `query` (filters kind/state/user_id/station_id/query, offset, limit 1..200, snapshot) |
| investigations | `investigations/query` | access/investigations.py `query` (filters source/user_id/station_id/query/start/end) |
| jobs | `jobs/list`, `jobs/errors` | access/checkpoint_jobs.py `records` / `error_csv` - the ACTOR's own jobs only |
| capacity | `platform/capacity` | capacity_history.py `CapacityHistory.report` (no series: Arx keeps its own samples, migration 0200) |
| fleet inventory | `fleet/inventory_export` (`format: json`) | access/operational_readiness.py `fleet_inventory` - Arx writes the CSV itself |
| audit export | `audit/export` | access/admin_audit.py `export` (filters user_id/station_id/action/actor/start/end) - Arx writes the CSV itself |
| events report | `events/report` | event_manager.py `async_report` -> reporting.py `event_report` (aggregates only) |

and the ONE write, `jobs/action` with `action: "cancel"` (checkpoint_jobs.py `action`: the job's revision compare-and-set; a cancelled or
completed job answers `job_finished`; cancelling empties the rows' pending changes - saved rows stay saved).

Every answer is projected by closed construction (`project_*`): known keys only, codes kept as codes, a text bounded and stripped of
control characters, never a host, a credential, a card number or a raw device field. Every CSV Arx serves is written HERE (`csv_bytes`):
each text cell that a spreadsheet could read as a formula - also after leading spaces, also in the full-width forms - gets a leading
apostrophe (WisKey's own `_safe_cell` in operational_readiness.py misses tab / carriage-return / full-width starters).

Sends go over the add-on's own live WisKey session (intercom_sync), on the closed `operations` channel (services/wiskey_channels.py),
once, never queued, never retried. Nothing here contacts a device; tests drive it with tests/fake_wiskey_ops.py."""
from __future__ import annotations

import csv
import io
import re
import sqlite3
import unicodedata
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Any, Callable, Iterable

from ..config import Settings
from ..errors import ApiError
from . import intercom_client, intercom_sync
from .intercom_client import IntercomError, UnclearAnswer

CHANNEL = "operations"  # services/wiskey_channels.py OPERATIONS
READ_TIMEOUT_S = 25.0
EXPORT_TIMEOUT_S = 45.0
CANCEL_LANE = "config"  # a bulk job is a people change: the people-write lane (one slot, its own rate buckets)
CANCEL = "cancel"  # the only `jobs/action` value Arx sends

CODE = re.compile(r"[a-z0-9][a-z0-9_.:/-]{0,63}")
ID = re.compile(r"[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}")
DAY = re.compile(r"\d{4}-\d{2}-\d{2}")
ZONE = re.compile(r"[A-Za-z][A-Za-z0-9_+-]{0,30}(?:/[A-Za-z0-9_+-]{1,30}){0,2}")  # an IANA zone name (the display zone of the times)
UNKNOWN = "unknown"

# the codes a `jobs/action` cancel answers BEFORE it changed anything (checkpoint_jobs.py `action` / checkpoint_jobs_api.py): a definite
# refusal. Anything else after the frame was sent (storage, a shape Arx does not know) leaves the outcome unknown.
CANCEL_REFUSALS = frozenset({"operation_not_found", "revision_conflict", "job_finished", "invalid_fields", "unauthorized", "jobs_unavailable",
                             "invalid_format", "unknown_command"})

# rc.10 enumerations (anything else is shown as `unknown`, never passed through)
OPERATION_KINDS = ("sync", "bulk", "csv")
OPERATION_STATES = ("pending", "failed", "verified", "settled", "saved")
INVESTIGATION_SOURCES = ("access", "change", "sync")
JOB_STATES = ("paused", "running", "completed", "completed_with_errors", "cancelled")
SYNC_STATES = ("synced", "pending", "syncing", "offline", "conflict", "error", "delete_pending")
CAPACITY_ALERTS = ("unknown", "stale", "at_limit", "near_limit", "growth_to_limit", "observed")
REPORT_COUNTS = ("records", "authentication", "granted", "denied", "unknown", "other", "recovered")
ANOMALY_TYPES = ("access_denied", "attempt_limit", "unlock_exception", "door_not_closed")
METHODS = ("card", "pin", "unknown")


# ---------------------------------------------------------------- small closed readers

def _int(v: Any, lo: int = 0, hi: int = 10**9) -> int | None:
    return v if isinstance(v, int) and not isinstance(v, bool) and lo <= v <= hi else None


def _num(v: Any) -> float | None:
    if isinstance(v, bool) or not isinstance(v, (int, float)):
        return None
    return float(v) if abs(v) < 1e9 else None


def _code(v: Any) -> str | None:
    return v if isinstance(v, str) and CODE.fullmatch(v) else None


def _enum(v: Any, allowed: Iterable[str]) -> str:
    return v if isinstance(v, str) and v in allowed else UNKNOWN


def _id(v: Any) -> str | None:
    return v if isinstance(v, str) and ID.fullmatch(v) else None


def _text(v: Any, n: int = 120) -> str | None:
    """A display text: NFC, control and format characters removed, whitespace collapsed, at most `n` characters."""
    if not isinstance(v, str):
        return None
    cleaned = "".join(ch for ch in unicodedata.normalize("NFC", v) if unicodedata.category(ch)[0] != "C")
    cleaned = " ".join(cleaned.split())
    return cleaned[:n] or None


def _iso(v: Any) -> str | None:
    """An aware ISO instant as WisKey writes it, normalised to UTC `...Z` (None when it is not one)."""
    if not isinstance(v, str) or len(v) > 40:
        return None
    try:
        parsed = datetime.fromisoformat(v.replace("Z", "+00:00"))
    except ValueError:
        return None
    if parsed.tzinfo is None:
        return None
    return parsed.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _ids(v: Any, cap: int = 50) -> list[str]:
    return [x for x in (_id(i) for i in (v if isinstance(v, list) else [])[:cap]) if x]


def _dict(v: Any) -> dict[str, Any]:
    if not isinstance(v, dict):
        raise ValueError("unexpected answer")
    return v


def _page(raw: dict[str, Any]) -> dict[str, Any]:
    return {
        "total": _int(raw.get("total")) or 0,
        "offset": _int(raw.get("offset")) or 0,
        "limit": _int(raw.get("limit"), 1, 200),
        "next_offset": _int(raw.get("next_offset")),
        "previous_offset": _int(raw.get("previous_offset")),
        "snapshot": _text(raw.get("snapshot"), 128) or "",
        "stale": raw.get("stale") is True,
    }


# ---------------------------------------------------------------- projections

def project_summary(raw: Any) -> dict[str, Any]:
    """`overview/summary` -> the KPI row and a per-station list. Never `host`, `entities`, `clock`, `users`, the API list or the
    appearance / media settings."""
    raw = _dict(raw)
    stations = []
    for s in raw.get("stations") if isinstance(raw.get("stations"), list) else []:
        if not isinstance(s, dict) or not (sid := _id(s.get("id"))):
            continue
        caps = s.get("capabilities") if isinstance(s.get("capabilities"), dict) else {}
        users, cards = _int(s.get("user_count")), _int(s.get("card_count"))
        max_users, max_cards = _int(caps.get("max_users"), 1), _int(caps.get("max_cards"), 1)
        use = [round(100 * a / b, 1) for a, b in ((users, max_users), (cards, max_cards)) if a is not None and b]
        stations.append({
            "id": sid,
            "name": _text(s.get("name"), 80) or sid,
            "online": s.get("online") is True,
            "loaded": s.get("loaded") is True,
            "sync_state": _enum(s.get("sync_state"), SYNC_STATES),
            "last_error": _code(s.get("last_error")),
            "pending_users": _int(s.get("pending_user_count")),
            "managed_users": _int(s.get("managed_user_count")),
            "unmanaged_users": _int(s.get("unmanaged_count")),
            "users": users,
            "cards": cards,
            "max_users": max_users,
            "max_cards": max_cards,
            "peak_use_percent": max(use) if use else None,
            "last_seen": _iso(s.get("last_seen")),
            "reconciled_at": _iso(s.get("reconciled_at")),
        })
    stations.sort(key=lambda r: (r["name"].casefold(), r["id"]))
    kpis = {
        "stations": len(stations),
        "online": sum(s["online"] for s in stations),
        "offline": sum(not s["online"] for s in stations),
        "pending_users": sum(s["pending_users"] or 0 for s in stations),
        "sync_problems": sum(s["sync_state"] in ("conflict", "error") or s["last_error"] is not None for s in stations),
        "near_capacity": sum((s["peak_use_percent"] or 0) >= 80 for s in stations),
    }
    zone = raw.get("default_zone") if isinstance(raw.get("default_zone"), dict) else {}
    name = zone.get("name") if zone.get("kind") == "iana" else None
    return {"kpis": kpis, "stations": stations, "zone": {"kind": "iana", "name": name if isinstance(name, str) and ZONE.fullmatch(name) else "UTC"}}


def _child(item: Any) -> dict[str, Any] | None:
    if not isinstance(item, dict):
        return None
    return {
        "user_id": _id(item.get("user_id")),
        "station_id": _id(item.get("station_id")),
        "state": _enum(item.get("state"), ("pending", "failed", "verified", "settled")),
        "updated_at": _iso(item.get("updated_at")),
        "error": _code(item.get("last_error") or item.get("error")),
    }


def project_operations(raw: Any) -> dict[str, Any]:
    raw = _dict(raw)
    rows = []
    for r in raw.get("records") if isinstance(raw.get("records"), list) else []:
        if not isinstance(r, dict) or not (rid := _text(r.get("id"), 128)):
            continue
        progress = r.get("progress") if isinstance(r.get("progress"), dict) else {}
        children = [c for c in (_child(x) for x in (r.get("children") if isinstance(r.get("children"), list) else [])[:20]) if c]
        rows.append({
            "id": rid,
            "kind": _enum(r.get("kind"), OPERATION_KINDS),
            "action": _code(r.get("action")) or UNKNOWN,
            "state": _enum(r.get("state"), OPERATION_STATES),
            "created_at": _iso(r.get("created_at")),
            "updated_at": _iso(r.get("updated_at")),
            "changed": _int(r.get("changed")),
            "user_ids": _ids(r.get("user_ids")),
            "station_ids": _ids(r.get("station_ids")),
            "progress": {k: _int(progress.get(k)) or 0 for k in ("total", "pending", "failed", "verified", "settled")},
            "errors": sorted({c["error"] for c in children if c["error"]}),
        })
    summary = raw.get("summary") if isinstance(raw.get("summary"), dict) else {}
    return {"records": rows, **_page(raw), "summary": {k: _int(summary.get(k)) or 0 for k in OPERATION_STATES}}


def project_investigations(raw: Any) -> dict[str, Any]:
    """The timeline as WisKey built it - each row with its evidence kind - plus the raw person fields, which the router hands on
    only as far as the caller may see them (`person_name`, `employee_no`, `actor`)."""
    raw = _dict(raw)
    rows = []
    for r in raw.get("records") if isinstance(raw.get("records"), list) else []:
        if not isinstance(r, dict) or not (rid := _text(r.get("id"), 160)):
            continue
        details = r.get("details") if isinstance(r.get("details"), dict) else {}
        rows.append({
            "id": rid,
            "source": _enum(r.get("source"), INVESTIGATION_SOURCES),
            "time": _iso(r.get("time")),
            "time_source": _enum(r.get("time_source"), ("device", "received", "system")),
            "station_ids": _ids(r.get("station_ids")),
            "action": _code(r.get("action")) or UNKNOWN,
            "status": _code(r.get("status")) or UNKNOWN,
            "evidence": _code(r.get("evidence")) or UNKNOWN,
            "user_id": _id(r.get("user_id")),
            "person_name": _text(r.get("person_name"), 80),
            "employee_no": _text(r.get("employee_no"), 32),
            "actor": _id(r.get("actor")),
            "door": _int(details.get("door"), 1, 64),
            "identity_basis": _code(details.get("identity_basis")),
            "fields": [f for f in (_code(x) for x in (details.get("fields") if isinstance(details.get("fields"), list) else [])[:20]) if f],
        })
    actors = raw.get("actors") if isinstance(raw.get("actors"), dict) else {}
    summary = raw.get("summary") if isinstance(raw.get("summary"), dict) else {}
    sources = raw.get("sources") if isinstance(raw.get("sources"), dict) else {}
    return {
        "records": rows,
        **_page(raw),
        "summary": {k: _int(summary.get(k)) or 0 for k in INVESTIGATION_SOURCES},
        "actors": {k: _text(v, 80) for k, v in actors.items() if _id(k)},
        "access_available": sources.get("access_available") is not False,
        "access_storage_failed": sources.get("access_storage_failed") is True,
        "retention_days": 30,
        "correlation": "chronology_is_not_causation",
    }


def _job(j: Any) -> dict[str, Any] | None:
    if not isinstance(j, dict) or not (jid := _id(j.get("id"))):
        return None
    approval = j.get("approval") if isinstance(j.get("approval"), dict) else None
    state = _enum(j.get("state"), JOB_STATES)
    errors = [{"row": _int(e.get("row")), "code": _code(e.get("code")) or UNKNOWN}
              for e in (j.get("errors") if isinstance(j.get("errors"), list) else [])[:200] if isinstance(e, dict)]
    return {
        "id": jid,
        "kind": _enum(j.get("kind"), ("csv", "bulk")),
        "state": state,
        "revision": _int(j.get("revision")),
        "created_at": _iso(j.get("created_at")),
        "updated_at": _iso(j.get("updated_at")),
        "total": _int(j.get("total")) or 0,
        "saved": _int(j.get("saved")) or 0,
        "failed": _int(j.get("failed")) or 0,
        "pending": _int(j.get("pending")) or 0,
        "approval": None if approval is None else {"state": _code(approval.get("state")) or UNKNOWN, "action": _code(approval.get("action"))},
        "errors": errors,
        # WisKey refuses a cancel of a finished job (`job_finished`); Arx offers it only where WisKey would take it
        "cancellable": state in ("paused", "running", "completed_with_errors") and _int(j.get("revision")) is not None,
    }


def project_jobs(raw: Any) -> dict[str, Any]:
    raw = _dict(raw)
    jobs = [j for j in (_job(x) for x in (raw.get("records") if isinstance(raw.get("records"), list) else [])) if j]
    reviews = [j for j in (_job(x) for x in (raw.get("reviews") if isinstance(raw.get("reviews"), list) else [])) if j]
    return {"records": jobs, "pending_reviews": len(reviews), "dual_approval": raw.get("dual_approval") is True}


def project_job(raw: Any) -> dict[str, Any]:
    job = _job(raw)
    if job is None:
        raise ValueError("unexpected jobs/action answer")
    return job


def project_job_errors(raw: Any) -> list[dict[str, Any]]:
    """`jobs/errors` answers `{csv}` (WisKey's own unguarded CSV: `row,state,error`) - parsed back into rows; Arx writes its own file."""
    text = _dict(raw).get("csv")
    if not isinstance(text, str) or len(text) > 2_000_000:
        raise ValueError("unexpected jobs/errors answer")
    rows = list(csv.reader(io.StringIO(text.lstrip("\ufeff"))))
    if not rows or [c.strip() for c in rows[0]] != ["row", "state", "error"]:
        raise ValueError("unexpected jobs/errors header")
    out = []
    for r in rows[1:5001]:
        if len(r) != 3:
            continue
        out.append({"row": int(r[0]) if r[0].isdigit() else None, "state": _code(r[1]) or UNKNOWN, "error": _code(r[2]) or UNKNOWN})
    return out


def _cap_values(v: Any) -> dict[str, Any]:
    v = v if isinstance(v, dict) else {}
    return {
        "count": _int(v.get("count")),
        "limit": _int(v.get("advertised_limit"), 1),
        "used_percent": _num(v.get("used_percent")),
        "remaining": _int(v.get("remaining")),
        "growth_per_day": _num(v.get("observed_growth_per_day")),
        "days_to_limit": _num(v.get("estimated_days_to_limit")),
        "alert": _enum(v.get("alert"), CAPACITY_ALERTS),
    }


def project_capacity(raw: Any) -> dict[str, Any]:
    raw = _dict(raw)
    rows = []
    for r in raw.get("records") if isinstance(raw.get("records"), list) else []:
        if not isinstance(r, dict) or not (sid := _id(r.get("station_id"))):
            continue
        rows.append({
            "station_id": sid,
            "name": _text(r.get("name"), 80) or sid,
            "sampled_at": _iso(r.get("sampled_at")),
            "fresh": r.get("fresh") is True,
            "sample_count": _int(r.get("sample_count")) or 0,
            "span_days": _num(r.get("sample_span_days")) or 0.0,
            "users": _cap_values(r.get("users")),
            "cards": _cap_values(r.get("cards")),
        })
    rows.sort(key=lambda r: (r["name"].casefold(), r["station_id"]))
    return {"records": rows, "forecast_is_estimate": True}


INVENTORY_FIELDS = ("name", "model", "firmware", "loaded", "online", "sync_state", "last_error", "managed_locks", "managed_users", "pending_users",
                    "users", "max_users", "user_utilization_percent", "cards", "max_cards", "card_utilization_percent", "near_capacity", "pin_writable",
                    "native_schedules", "inventory_sampled_at", "last_reconciled_at")


def project_inventory(raw: Any) -> dict[str, Any]:
    """`fleet/inventory_export` with `format: json` -> `{filename, mime_type, content}` whose content is WisKey's report as JSON text.
    Arx re-reads the rows (never `station_ref`, WisKey's opaque diagnostics reference) and writes the CSV itself."""
    import json

    raw = _dict(raw)
    content = raw.get("content")
    if not isinstance(content, str) or len(content) > 5_000_000:
        raise ValueError("unexpected fleet/inventory_export answer")
    report = json.loads(content)
    if not isinstance(report, dict) or report.get("format") != "hikvision_intercom.fleet_inventory":
        raise ValueError("unexpected fleet inventory format")
    rows = []
    for s in report.get("stations") if isinstance(report.get("stations"), list) else []:
        if not isinstance(s, dict):
            continue
        rows.append({
            "name": _text(s.get("name"), 80) or "",
            "model": _text(s.get("model"), 64) or "",
            "firmware": _text(s.get("firmware"), 64) or "",
            "loaded": s.get("loaded") is True,
            "online": s.get("online") if isinstance(s.get("online"), bool) else None,
            "sync_state": _enum(s.get("sync_state"), SYNC_STATES),
            "last_error": _code(s.get("last_error")),
            **{k: _int(s.get(k)) for k in ("managed_locks", "managed_users", "pending_users", "users", "cards")},
            "max_users": _int(s.get("max_users"), 1),
            "max_cards": _int(s.get("max_cards"), 1),
            "user_utilization_percent": _int(s.get("user_utilization_percent"), 0, 100),
            "card_utilization_percent": _int(s.get("card_utilization_percent"), 0, 100),
            "near_capacity": s.get("near_capacity") is True,
            "pin_writable": s.get("pin_writable") if isinstance(s.get("pin_writable"), bool) else None,
            "native_schedules": s.get("native_schedules") if isinstance(s.get("native_schedules"), bool) else None,
            "inventory_sampled_at": _iso(s.get("inventory_sampled_at")),
            "last_reconciled_at": _iso(s.get("last_reconciled_at")),
        })
    return {"generated_at": _iso(report.get("generated_at")), "version": _text(report.get("integration_version"), 40), "stations": rows}


AUDIT_FIELDS = ("time_utc", "actor", "action", "user_id", "name", "employee_no", "stations", "changed_fields", "revision_before", "revision_after", "reason_code")


def project_audit_export(raw: Any) -> dict[str, Any]:
    """`audit/export` -> its records (WisKey's own `csv` is ignored: Arx writes the file from the records)."""
    raw = _dict(raw)
    rows = []
    for r in raw.get("records") if isinstance(raw.get("records"), list) else []:
        if not isinstance(r, dict):
            continue
        summary = r.get("after") if isinstance(r.get("after"), dict) else r.get("before") if isinstance(r.get("before"), dict) else {}
        rows.append({
            "time": _iso(r.get("time")),
            "actor": _id(r.get("actor")),
            "action": _code(r.get("action")) or UNKNOWN,
            "user_id": _id(r.get("user_id")),
            "name": _text(summary.get("display_name"), 80),
            "employee_no": _text(summary.get("employee_no"), 32),
            "stations": _ids(r.get("stations")),
            "fields": [f for f in (_code(x) for x in (r.get("fields") if isinstance(r.get("fields"), list) else [])[:40]) if f],
            "revision_before": _int(r.get("revision_before")),
            "revision_after": _int(r.get("revision_after")),
            "reason_code": _code(r.get("reason_code")),
        })
    actors = raw.get("actors") if isinstance(raw.get("actors"), dict) else {}
    return {"records": rows, "total": _int(raw.get("total")) or len(rows), "retention_days": _int(raw.get("retention_days")),
            "actors": {k: _text(v, 80) for k, v in actors.items() if _id(k)}}


def _counts(v: Any) -> dict[str, int]:
    v = v if isinstance(v, dict) else {}
    return {k: _int(v.get(k)) or 0 for k in REPORT_COUNTS}


def project_events_report(raw: Any) -> dict[str, Any]:
    """`events/report` -> aggregates only (no record, no person; `print_records` / `csv` are never asked for)."""
    raw = _dict(raw)
    by_day = [{"day": r["day"], **_counts(r)} for r in (raw.get("by_day") if isinstance(raw.get("by_day"), list) else [])
              if isinstance(r, dict) and isinstance(r.get("day"), str) and DAY.fullmatch(r["day"])]
    by_station = [{"station_id": sid, **_counts(r)} for r in (raw.get("by_station") if isinstance(raw.get("by_station"), list) else [])
                  if isinstance(r, dict) and (sid := _id(r.get("station_id")))]
    anomaly_by_station = []
    for r in raw.get("anomaly_by_station") if isinstance(raw.get("anomaly_by_station"), list) else []:
        if isinstance(r, dict) and (sid := _id(r.get("station_id"))):
            c = r.get("counts") if isinstance(r.get("counts"), dict) else {}
            anomaly_by_station.append({"station_id": sid, "total": _int(r.get("total")) or 0, "counts": {k: _int(c.get(k)) or 0 for k in ANOMALY_TYPES}})
    methods = raw.get("methods") if isinstance(raw.get("methods"), dict) else {}
    anomalies = raw.get("anomalies") if isinstance(raw.get("anomalies"), dict) else {}
    return {
        "generated_at": _iso(raw.get("generated_at")),
        "day_timezone": "station" if raw.get("day_timezone") == "station" else "UTC",
        "oldest": _iso(raw.get("oldest")),
        "newest": _iso(raw.get("newest")),
        "totals": _counts(raw.get("totals")),
        "methods": {k: _int(methods.get(k)) or 0 for k in METHODS},
        "anomalies": {k: _int(anomalies.get(k)) or 0 for k in ANOMALY_TYPES},
        "anomaly_by_station": anomaly_by_station,
        "by_station": by_station,
        "by_day": sorted(by_day, key=lambda r: r["day"])[-400:],
        "retention_days": _int(raw.get("retention_days")),
        "storage_failed": raw.get("storage_failed") is True,
    }


# ---------------------------------------------------------------- the operations

@dataclass(frozen=True)
class Op:
    """One WisKey command of these views. `fields`: the frame's keys besides `id` / `type` (WisKey's registration, rc.10 websocket.py
    COMMANDS). `kind` `write` adds `api_contract` (only `jobs/action`: a non-READ command)."""

    name: str
    command: str
    fields: tuple[str, ...] = ()
    kind: str = "read"
    timeout_s: float = READ_TIMEOUT_S
    project: Callable[[Any], Any] = field(default=lambda raw: raw)


OPS: dict[str, Op] = {o.name: o for o in (
    Op("summary", "overview/summary", project=project_summary),
    Op("operations", "operations/query", ("filters", "offset", "limit", "snapshot"), project=project_operations),
    Op("investigations", "investigations/query", ("filters", "offset", "limit", "snapshot"), project=project_investigations),
    Op("jobs", "jobs/list", project=project_jobs),
    Op("job_errors", "jobs/errors", ("job_id",), project=project_job_errors),
    Op("capacity", "platform/capacity", project=project_capacity),
    Op("inventory", "fleet/inventory_export", ("format",), timeout_s=EXPORT_TIMEOUT_S, project=project_inventory),
    Op("audit_export", "audit/export", ("filters",), timeout_s=EXPORT_TIMEOUT_S, project=project_audit_export),
    Op("events_report", "events/report", ("filters",), timeout_s=EXPORT_TIMEOUT_S, project=project_events_report),
    Op("cancel", "jobs/action", ("job_id", "revision", "action"), kind="write", project=project_job),
)}


def frame_fields(op: Op, values: dict[str, Any]) -> dict[str, Any]:
    missing = [k for k in op.fields if k not in values]
    if missing:
        raise ValueError(f"{op.command}: missing {missing}")
    body = {k: values[k] for k in op.fields}
    if op.kind == "write":
        if body.get("action") != CANCEL:  # the only action Arx sends (module note)
            raise ValueError("jobs/action: only cancel")
        body["api_contract"] = intercom_client.API_CONTRACT
    return body


async def send(call: intercom_client.Call, op: Op, values: dict[str, Any]) -> Any:
    frame = await call(intercom_client.command_type(op.command), **frame_fields(op, values))
    if isinstance(frame, dict) and frame.get("success") is True:
        return frame.get("result")
    if isinstance(frame, dict) and frame.get("success") is False:
        error = frame.get("error") if isinstance(frame.get("error"), dict) else {}
        code = str(error.get("code") or "")
        if op.kind == "write" and code not in CANCEL_REFUSALS:
            raise UnclearAnswer(op.command, code or "action_failed")
        raise IntercomError(code if CODE.fullmatch(code or "-") else "other", op.command)
    if op.kind == "write":
        raise UnclearAnswer(op.command, "invalid_response")
    raise IntercomError("invalid_response", op.command)


def listed(settings: Settings) -> dict[str, bool | None]:
    """Per view: does WisKey list its command in `overview.api.commands` for the add-on's user (capability discovery)? None while there
    is no served copy (unknown, never "missing")."""
    facts = intercom_sync.SYNC.api_facts(settings)
    names = (facts or {}).get("commands")
    if not isinstance(names, (list, set, frozenset, tuple)):
        return {name: None for name in OPS}
    have = {n for n in names if isinstance(n, str)}
    return {name: op.command in have for name, op in OPS.items()}


NOT_READY = frozenset({"ha_not_configured", "connecting", "ha_unavailable", "not_installed", "idle"})


def run_read(settings: Settings, name: str, values: dict[str, Any], who: str) -> dict[str, Any]:
    """One READ: `{data, fetched_at}`. Anything else is an ApiError naming the feed's `state` and WisKey's code - the screen says why,
    it never shows stale or invented data. A command this WisKey does not list is not sent (501 `ops_unsupported`)."""
    op = OPS[name]
    if listed(settings).get(name) is False:
        raise ApiError(501, "ops_unsupported", "גרסת מערכת האינטרקום המותקנת אינה מציעה את התצוגה הזו.", details={"state": "unsupported", "operation": name})
    reply = intercom_sync.SYNC.command(settings, name, lambda call: send(call, op, values), op.project, who=who, timeout=op.timeout_s, channel=CHANNEL)
    data = reply.get(name)
    if reply.get("state") == "ready" and data is not None:
        return {"data": data, "fetched_at": reply.get("fetched_at")}
    state, code = str(reply.get("state") or "error"), str(reply.get("last_error") or "")
    details = {"state": state, "wiskey_code": code or None, "operation": name}
    if state == "rate_limited" or code in ("rate_limited", "busy"):
        raise ApiError(429, "ops_busy", "מערכת האינטרקום עסוקה או שנשלחו יותר מדי בקשות. נסו שוב בעוד כמה שניות.", retryable=True, details=details)
    if state == "forbidden" or code == "unauthorized":
        raise ApiError(502, "ops_forbidden", "מערכת האינטרקום דחתה את הבקשה של Arx (אין הרשאה בצד שלה).", details=details)
    if state == "unsupported" or code in ("unknown_command", "not_listed"):
        raise ApiError(501, "ops_unsupported", "גרסת מערכת האינטרקום המותקנת אינה מציעה את התצוגה הזו.", details=details)
    if state in NOT_READY:
        raise ApiError(503, "ops_unavailable", "החיבור למערכת האינטרקום אינו זמין כרגע.", retryable=True, details=details)
    raise ApiError(502, "ops_read_failed", f"מערכת האינטרקום לא החזירה את הנתונים ({code or state}).", details=details)


def run_cancel(settings: Settings, job_id: str, revision: int, who: str, not_after: datetime) -> dict[str, Any]:
    """The cancel: sent once in the people-write lane. Anything short of success raises intercom_sync.action_error's ApiError
    (details: `outcome` not_sent / refused / unknown, `state`, `wiskey_code`)."""
    op = OPS["cancel"]
    values = {"job_id": job_id, "revision": revision, "action": CANCEL}
    return intercom_sync.SYNC.action(settings, "cancel", lambda call: send(call, op, values), op.project, who, not_after=not_after, lane=CANCEL_LANE,
                                     channel=CHANNEL)


# ---------------------------------------------------------------- CSV (formula-safe)

# spreadsheet formula starters, ASCII and full-width (U+FF1D U+FF0B U+FF0D U+FF20), and the line breaks some readers start a cell with
FORMULA_STARTERS = ("=", "+", "-", "@", "\t", "\r", "\n", "＝", "＋", "－", "＠")


def csv_cell(value: Any) -> Any:
    """One cell: None -> ""; booleans as true / false; numbers unchanged (a negative number stays a number); any other value as text
    with a leading apostrophe when it - or its text after leading whitespace - starts like a formula."""
    if value is None:
        return ""
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, (int, float)):
        return value
    text = str(value)
    if text.startswith(FORMULA_STARTERS) or text.lstrip().startswith(FORMULA_STARTERS):
        return "'" + text
    return text


def csv_bytes(header: Iterable[str], rows: Iterable[Iterable[Any]]) -> bytes:
    """UTF-8 with a BOM (Hebrew in Excel), every cell quoted, CRLF line ends."""
    out = io.StringIO(newline="")
    out.write("\ufeff")
    writer = csv.writer(out, quoting=csv.QUOTE_ALL, lineterminator="\r\n")
    writer.writerow(list(header))
    for row in rows:
        writer.writerow([csv_cell(v) for v in row])
    return out.getvalue().encode("utf-8")


# ---------------------------------------------------------------- capacity samples (Arx's own trend history, migration 0200)

SAMPLE_KEEP_DAYS = 400
SAMPLE_MAX_PER_STATION = 1000


def record_samples(conn: sqlite3.Connection, capacity: dict[str, Any], now: datetime | None = None) -> int:
    """Store each station's inventory sample once (by WisKey's `sampled_at`), prune old ones. Returns how many were new. Only a FRESH
    report row with a sample time is stored - a stale one would repeat the last observation as if it were new."""
    now = now or datetime.now(timezone.utc)
    stamp = now.strftime("%Y-%m-%dT%H:%M:%SZ")
    added = 0
    for r in capacity.get("records") or []:
        at = r.get("sampled_at")
        if not at or not r.get("fresh"):
            continue
        cur = conn.execute(
            "INSERT OR IGNORE INTO wiskey_capacity_samples(station_id, sampled_at, users, cards, max_users, max_cards, recorded_at) VALUES (?,?,?,?,?,?,?)",
            (r["station_id"], at, r["users"]["count"], r["cards"]["count"], r["users"]["limit"], r["cards"]["limit"], stamp),
        )
        added += cur.rowcount or 0
    cutoff = (now - timedelta(days=SAMPLE_KEEP_DAYS)).strftime("%Y-%m-%dT%H:%M:%SZ")
    conn.execute("DELETE FROM wiskey_capacity_samples WHERE sampled_at < ?", (cutoff,))
    conn.execute(
        "DELETE FROM wiskey_capacity_samples WHERE rowid IN (SELECT rowid FROM (SELECT rowid, ROW_NUMBER() OVER (PARTITION BY station_id ORDER BY sampled_at DESC) AS n "
        "FROM wiskey_capacity_samples) WHERE n > ?)",
        (SAMPLE_MAX_PER_STATION,),
    )
    return added


def series(conn: sqlite3.Connection, days: int, now: datetime | None = None) -> dict[str, list[dict[str, Any]]]:
    """The stored samples of the last `days` days per station, oldest first."""
    now = now or datetime.now(timezone.utc)
    since = (now - timedelta(days=days)).strftime("%Y-%m-%dT%H:%M:%SZ")
    out: dict[str, list[dict[str, Any]]] = {}
    for row in conn.execute("SELECT station_id, sampled_at, users, cards, max_users, max_cards FROM wiskey_capacity_samples WHERE sampled_at >= ? "
                            "ORDER BY station_id, sampled_at", (since,)):
        out.setdefault(row[0], []).append({"at": row[1], "users": row[2], "cards": row[3], "max_users": row[4], "max_cards": row[5]})
    return out
