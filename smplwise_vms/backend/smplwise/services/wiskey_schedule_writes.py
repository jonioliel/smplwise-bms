"""WISKEY-SCHED-WRITE-2390 (WisKey full integration plan of 2026-11-03, task T7; capability matrix row 49; owner decision 03.11 Q4 "a"):
full editing of WisKey's DEVICE SCHEDULE LIBRARY from Arx - the library (create / edit / delete / import / export), the deployment
proposals ("plans") per station, the responsibility claims, the comparison baselines and the deployment work ("deploy") - always with
WisKey's own preview / assess / readiness before anything is applied. The per-door technical hold-open schedules, public codes and
door programs are NOT here (task T6, `stations/technical_*`).

The commands (WisKey rc.10 `websocket.py` COMMANDS + handlers, `schedule_plan_api.py`, `schedule_operations_api.py`,
`access/schedules.py`, `access/schedule_plans.py`, `access/schedule_operations.py`, `access/schedule_baselines.py`; request keys and
permissions identical in the pinned catalog rc37-contract.4 and in the rc.10 static extract; `management: view` for the reads,
`management: manage` for everything else; no station scope in WisKey):

| Arx action       | WisKey command                         | what WisKey does                                                         | kind        |
|------------------|----------------------------------------|--------------------------------------------------------------------------|-------------|
| `check`          | `schedules/preview`                    | validates the draft (its own `normalize`) and evaluates it at a date/time | read        |
| `create`         | `schedules/create`                     | stores a new library draft (revision 1)                                   | write       |
| `update`         | `schedules/update`                     | compare-and-set on `revision`                                             | write       |
| `delete`         | `schedules/delete`                     | compare-and-set on `revision`                                             | write       |
| `export`         | `schedules/export`                     | the portable document (`hikvision_intercom.schedule_drafts` v1)           | read (READ) |
| `import_preview` | `schedules/import_preview`             | parses the document, issues a 300 s token bound to WisKey's actor        | read        |
| `import_apply`   | `schedules/import_apply`               | appends the previewed drafts (fails `revision_conflict` if the library moved) | write   |
| `readiness`      | `schedules/readiness`                  | reads the station's schedule inventory and capabilities (device, <= 70 s) | device read |
| `dependencies`   | `schedules/dependencies`               | counts the device users referencing schedules (anonymous, <= 130 s)      | device read |
| `assess`         | `schedules/assess`                     | draft vs the station's advertised limits + baseline comparison (<= 70 s) | device read |
| `baseline_save`  | `schedules/baseline_save`              | stores the assessed observation as the station's comparison baseline     | write       |
| `baseline_clear` | `schedules/baseline_clear`             | removes it (compare-and-set on its revision)                              | write       |
| `plan_preview`   | `schedules/plan_preview`               | compiles the draft into the chosen device slots and compares (<= 130 s)  | device read |
| `plan_save`      | `schedules/plan_save`                  | stores the previewed proposal (reserves its slots)                        | write       |
| `plan_recheck`   | `schedules/plan_recheck`               | reads the station again and stores the new report                         | device write|
| `plan_delete`    | `schedules/plan_delete`                | removes a proposal                                                        | write       |
| `plan_detail`    | `schedules/plan_export`                | the proposal with its compiled candidate resources                        | read (READ) |
| `claim_preview`  | `schedules/operations_claim_preview`   | reads the station, prepares a responsibility claim for the plan's slots  | device read |
| `claim_confirm`  | `schedules/operations_claim_confirm`   | records the claim                                                         | write       |
| `claim_release`  | `schedules/operations_claim_release`   | removes it (refused `schedule_claim_in_use` while a job uses it)         | write       |
| `deploy`         | `schedules/operations_create` + `schedules/operations_check` | creates the job, then queues WisKey's background preflight | write |
| `job_check`      | `schedules/operations_check`           | queues the preflight again                                                | write       |
| `job_cancel`     | `schedules/operations_cancel`          | cancels a job that is not running                                         | write       |
| `job_archive`    | `schedules/operations_archive`         | archives a cancelled / verified job                                       | write       |

Not here: `schedules/list`, `plan_list`, `operations_list` (the existing READ-channel reads of routers/access_control_reads.py, which
the deploy progress polls), `operations_export` (the same answer as `operations_list`), `schedules/normalize_user` (the readback
channel, ACR5-02).

WHAT WISKEY rc.10 ACTUALLY DOES ON "DEPLOY": nothing reaches the device. `ReadOnlySnapshot.write` raises `schedule_writes_unverified`,
`operations_list` says `writes_enabled: false`, every plan report and assessment carries the blockers `schedule_writes_unverified`
and `schedule_ownership_unknown`, and the job's preflight ends `blocked`. Arx says exactly that ("WisKey blocked the deployment:
writes to the station are not verified yet - nothing was written") and never calls a blocked job deployed.

The path: the add-on's own live WisKey session (intercom_sync), on its closed `schedules` channel (services/wiskey_channels.py -
exactly the commands above), each command sent ONCE, never queued, never retried. Writes carry `api_contract`; the two READ-class
reads (`export`, `plan_export`) do not (the catalog's rule). Long device reads wait up to DEVICE_TIMEOUT_S (just under ha_client's
own 60 s call limit); WisKey allows 70-130 s, so a slow station reads as "still reading - try again" (`unknown`), never as done.

WisKey binds every preview token to ITS actor - and every Arx operator reaches WisKey as the same service identity. So the tokens
never leave the server: a preview answer carries an Arx `preview_id`, bound here to the Arx user, the action it allows and what was
previewed (PREVIEWS); only that user can apply it, only for that, before it expires. The same rule makes WisKey's own "check before
save" a server-side requirement: `create` / `update` need the `check_id` of a successful `check` of exactly the same draft by the same
user (a client cannot skip the preview).

Arx's own limits (Limits): writes per operator per minute, one device read at a time installation-wide, a per-station cool-down
between device reads (counted only once a read was handed to WisKey). Everything here is pure; the HTTP side is
routers/access_control_schedule_writes.py. Tests: tests/test_wiskey_schedule_writes.py (a stateful fake of the rc.10 library, plans
and operations over tests/fake_wiskey.py); nothing contacts a device."""
from __future__ import annotations

import hashlib
import json
import re
import secrets
import threading
import time
from collections import deque
from dataclasses import dataclass
from datetime import date
from typing import Any, Callable

from . import intercom_adapter as ad
from . import intercom_client
from .intercom_client import IntercomError, UnclearAnswer

CHANNEL = "schedules"  # services/wiskey_channels.py SCHEDULES
LANE = "schedules"  # intercom_sync: no lane of its own -> a read slot and the read buckets; Limits below add the rest

DAYS = ad.WEEKDAYS  # WisKey's DAYS (Monday first) - the same tuple
MAX_PERIODS = 8  # per day / per holiday (access/schedules.py periods)
MAX_HOLIDAYS = 64
NAME_MAX = 32
MAX_TRANSFER_BYTES = 8 * 1024 * 1024  # WisKey's MAX_TRANSFER_BYTES; the request itself is capped lower (max_request_bytes 65536)
MAX_DOCUMENT_CHARS = 60_000  # fits WisKey's 65536-byte request limit with the frame around it (ASCII JSON)
TIME = re.compile(r"(?:[01][0-9]|2[0-3]):[0-5][0-9]")
END_TIME = re.compile(r"(?:[01][0-9]|2[0-3]):[0-5][0-9]|24:00")
DATE = re.compile(r"[0-9]{4}-[0-9]{2}-[0-9]{2}")
UUID = re.compile(r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}")

# The blockers WisKey rc.10 puts on every plan report / assessment / job (access/schedule_plans.py BLOCKERS)
BLOCKERS = frozenset({
    "schedule_writes_unverified", "schedule_ownership_unknown", "schedule_inventory_incomplete", "schedule_plan_users_unreadable",
    "schedule_plan_user_defaults", "schedule_plan_external_references", "schedule_plan_capabilities_changed",
    "schedule_plan_active_resources", "schedule_plan_observation_incomplete", "schedule_plan_holiday_membership_unknown",
    "schedule_ownership_changed",
})
KINDS = ("template", "weekly", "holiday_group", "holiday")
JOB_ACTIVE = frozenset({"pending", "queued", "checking"})
JOB_TERMINAL = frozenset({"blocked", "ready", "interrupted", "failed", "cancelled", "verified"})
# a `success: false` answer is a definite refusal with WisKey's code, except these, which say nothing about what happened
UNCLEAR_CODES = frozenset({"", "action_failed", "storage_or_internal_error", "invalid_response", "timeout", "unknown_error", "schedule_write_uncertain"})


# ---------------------------------------------------------------- the draft (Arx mirrors WisKey's normalize for an early, exact answer)

class DraftError(ValueError):
    """A draft Arx refuses before sending: `code` is WisKey's own code for the same fault, `where` the field path."""

    def __init__(self, code: str, where: str) -> None:
        super().__init__(code)
        self.code, self.where = code, where


def _minute(value: Any, where: str, *, end: bool = False) -> int:
    if isinstance(value, str) and (END_TIME if end else TIME).fullmatch(value):
        return 1440 if value == "24:00" else int(value[:2]) * 60 + int(value[3:])
    raise DraftError("schedule_invalid_time", where)


def _name(value: Any, where: str) -> str:
    if not isinstance(value, str) or len(value) > NAME_MAX or not value.strip() or any(ord(c) < 32 for c in value):
        raise DraftError("invalid_text", where)
    return value.strip()


def _periods(value: Any, where: str) -> list[dict[str, str]]:
    if not isinstance(value, list) or len(value) > MAX_PERIODS:
        raise DraftError("schedule_period_limit", where)
    out = []
    for i, p in enumerate(value):
        if not isinstance(p, dict) or set(p) != {"start", "end"}:
            raise DraftError("schedule_invalid_time", f"{where}.{i}")
        a, b = _minute(p["start"], f"{where}.{i}.start"), _minute(p["end"], f"{where}.{i}.end", end=True)
        if a >= b:
            raise DraftError("schedule_invalid_time", f"{where}.{i}")
        out.append({"start": p["start"], "end": p["end"]})
    out.sort(key=lambda p: p["start"])
    for x, y in zip(out, out[1:]):
        if _minute(x["end"], where, end=True) > _minute(y["start"], where):
            raise DraftError("schedule_overlap", where)
    return out


def _date(value: Any, where: str) -> str:
    if not isinstance(value, str) or not DATE.fullmatch(value):
        raise DraftError("schedule_invalid_date", where)
    try:
        parsed = date.fromisoformat(value)
    except ValueError:
        raise DraftError("schedule_invalid_date", where) from None
    if not 2000 <= parsed.year <= 2037:
        raise DraftError("schedule_invalid_date", where)
    return value


def normalize(data: Any) -> dict[str, Any]:
    """WisKey's `access/schedules.normalize` (rc.10), reproduced: exactly `{name, weekly, holidays}`, the seven English day names,
    at most 8 non-overlapping `[start, end)` periods per day (minutes; `24:00` only as an end), at most 64 non-overlapping holidays
    with dates 2000-2037. Periods and holidays come back sorted, as WisKey stores them. Raises DraftError with WisKey's code."""
    if not isinstance(data, dict) or set(data) != {"name", "weekly", "holidays"}:
        raise DraftError("invalid_fields", "data")
    name = _name(data["name"], "name")
    weekly = data["weekly"]
    if not isinstance(weekly, dict) or set(weekly) != set(DAYS):
        raise DraftError("schedule_invalid_week", "weekly")
    week = {day: _periods(weekly[day], f"weekly.{day}") for day in DAYS}
    holidays = data["holidays"]
    if not isinstance(holidays, list) or len(holidays) > MAX_HOLIDAYS:
        raise DraftError("schedule_holiday_limit", "holidays")
    out: list[dict[str, Any]] = []
    for i, h in enumerate(holidays):
        where = f"holidays.{i}"
        if not isinstance(h, dict) or set(h) != {"name", "start", "end", "periods"}:
            raise DraftError("invalid_fields", where)
        start, end = _date(h["start"], f"{where}.start"), _date(h["end"], f"{where}.end")
        if start > end:
            raise DraftError("schedule_invalid_date", where)
        out.append({"name": _name(h["name"], f"{where}.name"), "start": start, "end": end, "periods": _periods(h["periods"], f"{where}.periods")})
    out.sort(key=lambda h: h["start"])
    for x, y in zip(out, out[1:]):
        if x["end"] >= y["start"]:
            raise DraftError("schedule_holiday_overlap", "holidays")
    return {"name": name, "weekly": week, "holidays": out}


def digest(value: Any) -> str:
    """The identity of what was previewed (a draft, a document, bindings): sha256 of its canonical JSON."""
    return hashlib.sha256(json.dumps(value, sort_keys=True, ensure_ascii=False, separators=(",", ":")).encode()).hexdigest()


def bindings_ok(data: Any, holidays: int) -> dict[str, Any]:
    """WisKey's `schedule_compiler.bindings_for`: `{template, weekly, holiday_group, holidays}` device slot ids 1..65535; one holiday
    slot per holiday (distinct), a holiday group only when there are holidays. Raises DraftError(`schedule_binding_invalid`)."""
    if not isinstance(data, dict) or set(data) != {"template", "weekly", "holiday_group", "holidays"}:
        raise DraftError("schedule_binding_invalid", "bindings")
    slots = data["holidays"]
    if not isinstance(slots, list) or len(slots) != holidays:
        raise DraftError("schedule_binding_invalid", "bindings.holidays")
    ids = [data["template"], data["weekly"], *slots]
    if holidays:
        ids.append(data["holiday_group"])
    elif data["holiday_group"] is not None:
        raise DraftError("schedule_binding_invalid", "bindings.holiday_group")
    if any(type(i) is not int or not 1 <= i <= 65535 for i in ids) or len(set(slots)) != len(slots):
        raise DraftError("schedule_binding_invalid", "bindings")
    return {"template": data["template"], "weekly": data["weekly"], "holiday_group": data["holiday_group"], "holidays": list(slots)}


# ---------------------------------------------------------------- projections (closed construction, like the adapter's)

def _pair(v: Any) -> list[int] | None:
    return [v[0], v[1]] if isinstance(v, list) and len(v) == 2 and all(ad._int(x) is not None for x in v) else None


def project_capability(v: Any) -> dict[str, Any] | None:
    """One kind's advertised capability (schedule_inventory): id ranges, period ids, precision, weekdays, name length."""
    if not isinstance(v, dict):
        return None
    out: dict[str, Any] = {k: _pair(v.get(k)) for k in ("ids", "period_ids", "name_length", "holiday_ids", "week_ids", "group_ids") if k in v}
    if "max_periods" in v:
        out["max_periods"] = ad._int(v.get("max_periods"))
    if "precision" in v:
        out["precision"] = ad._enum(v.get("precision"), ("hour", "minute", "second"))
    if "weekdays" in v:
        out["weekdays"] = [d for d in (v.get("weekdays") if isinstance(v.get("weekdays"), list) else []) if d in DAYS]
    return out


def _blockers(v: Any) -> list[str | None]:
    return [ad._code(b) for b in (v if isinstance(v, list) else [])[:32]]


def _users(v: Any) -> dict[str, Any] | None:
    """The anonymous device-user counts WisKey reads on the station (`schedule_dependencies.user_references`): how many users were
    read, how many carry their own schedule references (`explicit`), how many use the device default (`implicit`), how many could not
    be parsed. Never a person: WisKey never exports users here. Served to the schedules administrator only (the impact of a write)."""
    if not isinstance(v, dict):
        return None
    return {"state": ad._enum(v.get("state"), ("complete", "failed")), "error": ad._code(v.get("error")),
            **{k: ad._int(v.get(k)) for k in ("read", "explicit", "implicit", "malformed")}}


def project_library_item(raw: Any) -> dict[str, Any]:
    rows = ad.project_schedule_library([raw]) if isinstance(raw, dict) else []
    if not rows:
        raise ValueError("unexpected schedule answer")
    return rows[0]


def project_library_list(raw: Any) -> list[dict[str, Any]]:
    return ad.project_schedule_library(raw)


def project_deleted(raw: Any) -> dict[str, Any]:
    if isinstance(raw, dict) and raw.get("deleted") is True:
        return {"deleted": True}
    raise ValueError("unexpected delete answer")


def project_check(raw: Any) -> dict[str, Any]:
    """`schedules/preview`: the draft evaluated at a local date and time (WisKey: `[start, end)`, dates inclusive, `applied: false`)."""
    if not isinstance(raw, dict):
        raise ValueError("unexpected schedules/preview answer")
    return {
        "date": raw.get("date") if isinstance(raw.get("date"), str) and DATE.fullmatch(raw["date"]) else None,
        "time": raw.get("time") if isinstance(raw.get("time"), str) and TIME.fullmatch(raw["time"]) else None,
        "weekday": ad._enum(raw.get("weekday"), DAYS),
        "source": ad._enum(raw.get("source"), ("weekly", "holiday")),
        "holiday": ad._text(raw.get("holiday"), 64),
        "periods": ad._periods(raw.get("periods")),
        "within_window": ad._bool(raw.get("within_window")),
        "applied": False,
    }


def project_export(raw: Any) -> dict[str, Any]:
    """`schedules/export`: the portable document, rebuilt from its known keys only (a valid WisKey import document)."""
    if not isinstance(raw, dict) or raw.get("format") != "hikvision_intercom.schedule_drafts" or raw.get("version") != 1:
        raise ValueError("unexpected schedules/export answer")
    schedules = []
    for s in (raw.get("schedules") if isinstance(raw.get("schedules"), list) else [])[:100]:
        if isinstance(s, dict):
            schedules.append({"name": ad._text(s.get("name"), 64) or "", "weekly": ad._weekly(s.get("weekly")), "holidays": ad._holidays(s.get("holidays"))})
    return {"format": "hikvision_intercom.schedule_drafts", "version": 1, "schedules": schedules}


def project_import_preview(raw: Any) -> dict[str, Any]:
    if not isinstance(raw, dict) or not isinstance(raw.get("token"), str):
        raise ValueError("unexpected schedules/import_preview answer")
    return {
        "token": raw["token"],  # kept server-side only (PREVIEWS); the router never serves it
        "count": ad._int(raw.get("count")), "name_collisions": ad._int(raw.get("name_collisions")), "expires_in": ad._int(raw.get("expires_in")),
        "mode": ad._enum(raw.get("mode"), ("append",)),
        "items": [{"name": ad._text(i.get("name"), 64), "weekly_periods": ad._int(i.get("weekly_periods")), "holidays": ad._int(i.get("holidays"))}
                  for i in (raw.get("items") if isinstance(raw.get("items"), list) else [])[:100] if isinstance(i, dict)],
    }


def project_readiness(raw: Any) -> dict[str, Any]:
    """`schedules/readiness` (client/schedule_readiness.py): per kind - advertised, capabilities, how it was read, coverage, counts."""
    if not isinstance(raw, dict):
        raise ValueError("unexpected schedules/readiness answer")
    return {
        "checked_at": ad._iso(raw.get("checked_at")), "can_apply": raw.get("can_apply") is True, "reason": ad._code(raw.get("reason")),
        "checks": [
            {"kind": ad._enum(c.get("kind"), KINDS), "advertised": ad._bool(c.get("advertised")), "capabilities": project_capability(c.get("capabilities")),
             "read_state": ad._enum(c.get("read_state"), ("readable", "unsupported", "not_checked", "failed")), "error": ad._code(c.get("error")),
             "coverage": ad._enum(c.get("coverage"), ad.COVERAGES), "read": ad._int(c.get("read")), "total": ad._int(c.get("total"))}
            for c in (raw.get("checks") if isinstance(raw.get("checks"), list) else [])[:8] if isinstance(c, dict)
        ],
    }


def project_dependencies(raw: Any) -> dict[str, Any]:
    if not isinstance(raw, dict):
        raise ValueError("unexpected schedules/dependencies answer")
    return {
        "checked_at": ad._iso(raw.get("checked_at")), "users_checked": raw.get("users_checked") is True, "mapping_complete": raw.get("mapping_complete") is True,
        "users": _users(raw.get("users")),
        "checks": [
            {"kind": ad._enum(c.get("kind"), KINDS), "coverage": ad._enum(c.get("coverage"), ad.COVERAGES),
             **{k: ad._int(c.get(k)) for k in ("referenced", "observed", "not_observed", "disabled")},
             "ids": [i for i in (c.get("ids") if isinstance(c.get("ids"), list) else [])[:20] if ad._int(i) is not None]}
            for c in (raw.get("checks") if isinstance(raw.get("checks"), list) else [])[:8] if isinstance(c, dict)
        ],
    }


def project_assess(raw: Any) -> dict[str, Any]:
    """`schedules/assess`: the station's inventory, the draft's assessment against its advertised limits, and the comparison with the
    saved baseline (its one-use `token` stays server-side)."""
    if not isinstance(raw, dict) or not isinstance(raw.get("assessment"), dict):
        raise ValueError("unexpected schedules/assess answer")
    a = raw["assessment"]
    req = a.get("requirements") if isinstance(a.get("requirements"), dict) else {}
    b = raw.get("baseline") if isinstance(raw.get("baseline"), dict) else {}
    return {
        "checked_at": ad._iso(raw.get("checked_at")), "complete": raw.get("complete") is True,
        "checks": [
            {"kind": ad._enum(c.get("kind"), KINDS), "state": ad._enum(c.get("state"), ad.COVERAGES), "error": ad._code(c.get("error")),
             "capabilities": project_capability(c.get("capabilities")), **{k: ad._int(c.get(k)) for k in ("read", "total", "enabled", "disabled", "referenced")}}
            for c in (raw.get("checks") if isinstance(raw.get("checks"), list) else [])[:8] if isinstance(c, dict)
        ],
        "assessment": {
            "state": ad._enum(a.get("state"), ("fits", "exceeds", "unknown")),
            "requirements": {k: ad._int(req.get(k)) for k in ("template", "weekly", "holiday_group", "holiday", "weekly_periods")},
            "limits": [{"key": ad._code(c.get("key")), "needed": ad._int(c.get("needed")), "available": ad._int(c.get("available")),
                        "state": ad._enum(c.get("state"), ("fits", "exceeds", "unknown"))}
                       for c in (a.get("limits") if isinstance(a.get("limits"), list) else [])[:32] if isinstance(c, dict)],
            "can_apply": a.get("can_apply") is True, "inventory_complete": a.get("inventory_complete") is True, "blockers": _blockers(a.get("blockers")),
        },
        "baseline": {
            "state": ad._enum(b.get("state"), ("missing", "unchanged", "changed", "incomplete", "identity_changed", "unavailable")),
            "revision": ad._int(b.get("revision")), "checked_at": ad._iso(b.get("checked_at")),
            "token": b.get("token") if isinstance(b.get("token"), str) else None,  # server-side only
            "checks": [{"kind": ad._enum(c.get("kind"), KINDS), "state": ad._enum(c.get("state"), ("changed", "unchanged", "incomplete")),
                        **{k: ad._int(c.get(k)) for k in ("modified", "added", "removed")}, "capability_changed": c.get("capability_changed") is True}
                       for c in (b.get("checks") if isinstance(b.get("checks"), list) else [])[:8] if isinstance(c, dict)],
        },
    }


def project_baseline(raw: Any) -> dict[str, Any]:
    if not isinstance(raw, dict):
        raise ValueError("unexpected baseline answer")
    return {"revision": ad._int(raw.get("revision")), "checked_at": ad._iso(raw.get("checked_at"))}


def _bindings(v: Any) -> dict[str, Any] | None:
    if not isinstance(v, dict):
        return None
    hol = v.get("holidays") if isinstance(v.get("holidays"), list) else []
    return {"template": ad._int(v.get("template")), "weekly": ad._int(v.get("weekly")), "holiday_group": ad._int(v.get("holiday_group")),
            "holidays": [h for h in hol[:64] if ad._int(h) is not None]}


def project_plan(raw: Any) -> dict[str, Any]:
    """A proposal as the schedules administrator sees it: the read screen's projection (intercom_adapter.project_schedule_plans) plus
    the device slots (`bindings`), each resource's differing fields and external references, the anonymous user counts, and (from
    `plan_export` / `plan_preview`) the compiled candidate resources. The preview's one-use `token` stays server-side."""
    rows = ad.project_schedule_plans([raw]) if isinstance(raw, dict) else []
    if not rows:
        raise ValueError("unexpected plan answer")
    out = rows[0]
    out["bindings"] = _bindings(raw.get("bindings"))
    report = raw.get("report") if isinstance(raw.get("report"), dict) else None
    if out.get("report") is not None and report is not None:
        resources = [r for r in (report.get("resources") if isinstance(report.get("resources"), list) else [])[:128] if isinstance(r, dict)]
        for row, r in zip(out["report"]["resources"], resources):
            row["fields"] = [f for f in (r.get("fields") if isinstance(r.get("fields"), list) else [])[:16] if isinstance(f, str) and ad.CODE.fullmatch(f)]
            row["externally_referenced"] = ad._bool(r.get("externally_referenced"))
        out["report"]["users"] = _users(report.get("users"))
    if isinstance(raw.get("candidates"), list):
        out["candidates"] = [
            {"key": ad._code(c.get("key")), "kind": ad._enum(c.get("kind"), KINDS), "id": ad._int(c.get("id")),
             "dependencies": [ad._code(d) for d in (c.get("dependencies") if isinstance(c.get("dependencies"), list) else [])[:66]]}
            for c in raw["candidates"][:70] if isinstance(c, dict)
        ]
    if isinstance(raw.get("token"), str):
        out["token"] = raw["token"]
    return out


def project_claim_preview(raw: Any) -> dict[str, Any]:
    if not isinstance(raw, dict) or not isinstance(raw.get("token"), str):
        raise ValueError("unexpected claim preview answer")
    report = project_plan({"id": "x", "report": raw.get("report")}).get("report") if isinstance(raw.get("report"), dict) else None
    return {"token": raw["token"], "plan_id": ad._id(raw.get("plan_id")), "plan_revision": ad._int(raw.get("plan_revision")),
            "resource_keys": [ad._code(k) for k in (raw.get("resource_keys") if isinstance(raw.get("resource_keys"), list) else [])[:70]],
            "report": report}


def project_claim(raw: Any) -> dict[str, Any]:
    if not isinstance(raw, dict) or not ad._id(raw.get("id")):
        raise ValueError("unexpected claim answer")
    return {"id": raw["id"], "revision": ad._int(raw.get("revision")), "plan_id": ad._id(raw.get("plan_id")),
            "station_id": ad._id(raw.get("station_id")), "created_at": ad._iso(raw.get("created_at")),
            "resource_keys": [ad._code(k) for k in (raw.get("resource_keys") if isinstance(raw.get("resource_keys"), list) else [])[:70]]}


def project_released(raw: Any) -> dict[str, Any]:
    if isinstance(raw, dict) and raw.get("released") is True:
        return {"released": True}
    raise ValueError("unexpected claim release answer")


def project_job(raw: Any) -> dict[str, Any]:
    """A deployment job (`access/schedule_operations.py`): the read screen's projection plus the plan revision and its resources."""
    if not isinstance(raw, dict) or not ad._id(raw.get("id")):
        raise ValueError("unexpected job answer")
    out = ad._job(raw)
    out["plan_revision"] = ad._int(raw.get("plan_revision"))
    out["resource_keys"] = [ad._code(k) for k in (raw.get("resource_keys") if isinstance(raw.get("resource_keys"), list) else [])[:70]]
    return out


def project_archived(raw: Any) -> dict[str, Any]:
    if isinstance(raw, dict) and raw.get("archived") is True:
        return {"archived": True}
    raise ValueError("unexpected job archive answer")


# ---------------------------------------------------------------- the operations table

@dataclass(frozen=True)
class Op:
    action: str  # the Arx action (the route's last path segment)
    command: str  # the WisKey command
    kind: str  # `read` (no state), `device` (a device read, no state), `write`, `device_write` (a device read, then a stored result)
    read_class: bool  # WisKey's READ class (no `api_contract` on the frame)
    project: Callable[[Any], Any]
    audit: str | None = None  # the audit action of a write

    @property
    def writes(self) -> bool:
        return self.kind in ("write", "device_write")

    @property
    def device(self) -> bool:
        return self.kind in ("device", "device_write")


def _op(action: str, command: str, kind: str, project: Callable[[Any], Any], read_class: bool = False) -> Op:
    audit = f"intercom.schedule_{action}" if kind in ("write", "device_write") else None
    return Op(action, command, kind, read_class, project, audit)


OPS: dict[str, Op] = {o.action: o for o in (
    _op("check", "schedules/preview", "read", project_check),
    _op("create", "schedules/create", "write", project_library_item),
    _op("update", "schedules/update", "write", project_library_item),
    _op("delete", "schedules/delete", "write", project_deleted),
    _op("export", "schedules/export", "read", project_export, read_class=True),
    _op("import_preview", "schedules/import_preview", "read", project_import_preview),
    _op("import_apply", "schedules/import_apply", "write", project_library_list),
    _op("readiness", "schedules/readiness", "device", project_readiness),
    _op("dependencies", "schedules/dependencies", "device", project_dependencies),
    _op("assess", "schedules/assess", "device", project_assess),
    _op("baseline_save", "schedules/baseline_save", "write", project_baseline),
    _op("baseline_clear", "schedules/baseline_clear", "write", project_baseline),
    _op("plan_preview", "schedules/plan_preview", "device", project_plan),
    _op("plan_save", "schedules/plan_save", "write", project_plan),
    _op("plan_recheck", "schedules/plan_recheck", "device_write", project_plan),
    _op("plan_delete", "schedules/plan_delete", "write", project_deleted),
    _op("plan_detail", "schedules/plan_export", "read", project_plan, read_class=True),
    _op("claim_preview", "schedules/operations_claim_preview", "device", project_claim_preview),
    _op("claim_confirm", "schedules/operations_claim_confirm", "write", project_claim),
    _op("claim_release", "schedules/operations_claim_release", "write", project_released),
    _op("job_create", "schedules/operations_create", "write", project_job),
    _op("job_check", "schedules/operations_check", "write", project_job),
    _op("job_cancel", "schedules/operations_cancel", "write", project_job),
    _op("job_archive", "schedules/operations_archive", "write", project_archived),
)}
COMMANDS = frozenset(o.command for o in OPS.values())
AUDIT_ACTIONS = tuple(sorted({o.audit for o in OPS.values() if o.audit} | {"intercom.schedule_deploy"}))
WRITE_TIMEOUT_S = 35.0  # WisKey storage only (intercom_sync CONFIG_TIMEOUT_S)
DEVICE_TIMEOUT_S = 58.0  # just under ha_client's own 60 s call limit; WisKey allows itself 70-130 s (module note)


def timeout_of(op: Op) -> float:
    return DEVICE_TIMEOUT_S if op.device else WRITE_TIMEOUT_S


# ---------------------------------------------------------------- the frame and its answer

def result_of(frame: dict[str, Any], command: str) -> Any:
    """`success: true` -> the result; `success: false` with a code -> a definite refusal (IntercomError: the outcome `refused`, shown
    as "WisKey refused: <reason>") - WisKey's schedule stores validate and compare-and-set BEFORE they persist, so its code is the
    outcome; an unclear code or a frame that is neither -> UnclearAnswer (outcome `unknown`: "sent, no clear answer")."""
    if frame.get("success") is True:
        return frame.get("result")
    if frame.get("success") is False:
        error = frame.get("error") if isinstance(frame.get("error"), dict) else {}
        code = str(error.get("code") or "")
        if code not in UNCLEAR_CODES and ad.CODE.fullmatch(code):
            raise IntercomError(code, command)
        raise UnclearAnswer(command, code or "action_failed")
    raise UnclearAnswer(command, "invalid_response")


async def send(call: intercom_client.Call, op: Op, fields: dict[str, Any]) -> Any:
    """`hikvision_intercom/<command> {**fields}` (+ `api_contract` on a non-READ command) - the catalog's exact key set."""
    extra = {} if op.read_class else {"api_contract": intercom_client.API_CONTRACT}
    frame = await call(intercom_client.command_type(op.command), **fields, **extra)
    return result_of(frame, op.command)


# ---------------------------------------------------------------- previews kept server-side (WisKey's tokens never reach a browser)

PREVIEW_TTL_S = 280.0  # WisKey's are 300 s from its own clock; Arx stops honouring them a little earlier
PREVIEW_MAX = 64


@dataclass
class Preview:
    kind: str  # `draft` (a successful check), `import`, `plan`, `claim`, `baseline`
    user: str
    token: str | None  # WisKey's token (None for `draft`: WisKey's check issues none)
    subject: str  # what was previewed: a draft digest, a station id, a plan id
    expires: float
    summary: dict[str, Any]


class Previews:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._by: dict[str, Preview] = {}

    def put(self, kind: str, user: str, token: str | None, subject: str, summary: dict[str, Any] | None = None) -> str:
        now = time.monotonic()
        with self._lock:
            self._by = {k: v for k, v in self._by.items() if v.expires > now}
            if kind != "draft":  # WisKey keeps one pending preview per actor and kind: a newer one replaces this user's older one here too
                self._by = {k: v for k, v in self._by.items() if not (v.kind == kind and v.user == user)}
            while len(self._by) >= PREVIEW_MAX:
                self._by.pop(next(iter(self._by)))
            pid = secrets.token_hex(16)
            self._by[pid] = Preview(kind, user, token, subject, now + PREVIEW_TTL_S, dict(summary or {}))
            return pid

    def take(self, pid: Any, kind: str, user: str, subject: str | None = None, *, keep: bool = False) -> Preview | None:
        """The preview `pid` if it is this user's, of this kind (and subject), and not expired; consumed unless `keep`."""
        if not isinstance(pid, str):
            return None
        with self._lock:
            p = self._by.get(pid)
            if p is None or p.kind != kind or p.user != user or p.expires <= time.monotonic() or (subject is not None and p.subject != subject):
                return None
            if not keep:
                del self._by[pid]
            return p

    def reset(self) -> None:
        with self._lock:
            self._by.clear()


PREVIEWS = Previews()


# ---------------------------------------------------------------- Arx's own limits

USER_WINDOW_S = 60.0
USER_MAX = 30  # schedule writes per operator per window
DEVICE_INFLIGHT = 1  # device reads at once, installation-wide (WisKey allows 3 schedule reads, its own `schedule_read_busy`)
DEVICE_COOLDOWN_S = 10.0  # between two device reads of one station (only once a read was sent)
COOLDOWN_SCALE = 1.0  # tests shrink it


class Limits:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._users: dict[str, deque[float]] = {}
        self._device = 0
        self._last: dict[str, float] = {}

    def admit_write(self, user: str) -> tuple[str, float] | None:
        now = time.monotonic()
        with self._lock:
            window = self._users.setdefault(user, deque())
            while window and now - window[0] >= USER_WINDOW_S:
                window.popleft()
            if len(window) >= USER_MAX:
                return "schedule_rate_limited", round(USER_WINDOW_S - (now - window[0]), 1)
            window.append(now)
        return None

    def admit_device(self, station_id: str) -> tuple[str, float] | None:
        now = time.monotonic()
        with self._lock:
            at = self._last.get(station_id)
            left = 0.0 if at is None else DEVICE_COOLDOWN_S * COOLDOWN_SCALE - (now - at)
            if left > 0:
                return "schedule_station_cooldown", round(left, 1)
            if self._device >= DEVICE_INFLIGHT:
                return "schedule_device_busy", 5.0
            self._device += 1
        return None

    def device_sent(self, station_id: str) -> None:
        with self._lock:
            self._last[station_id] = time.monotonic()

    def device_done(self) -> None:
        with self._lock:
            self._device = max(0, self._device - 1)

    def reset(self) -> None:
        with self._lock:
            self._users.clear()
            self._last.clear()
            self._device = 0


LIMITS = Limits()


# ---------------------------------------------------------------- reasons (WisKey's codes in the operator's words)

REASONS: dict[str, str] = {
    "unauthorized": "לחשבון השירות של Arx אין הרשאת ניהול לוחות זמנים ב־WisKey",
    "revision_conflict": "מישהו אחר שינה את הרשומה בינתיים - טענו מחדש ובדקו לפני שמנסים שוב",
    "schedule_not_found": "לוח הזמנים לא נמצא (אולי נמחק בינתיים)",
    "schedule_limit": "הספרייה מלאה (עד 100 לוחות זמנים)",
    "schedule_invalid_time": "שעה לא תקינה, או שעת סיום שאינה אחרי שעת ההתחלה",
    "schedule_overlap": "חלונות זמן חופפים באותו יום",
    "schedule_period_limit": "יותר מ־8 חלונות זמן ביום",
    "schedule_invalid_week": "השבוע חייב לכלול את שבעת הימים",
    "schedule_invalid_date": "תאריך לא תקין (2000-2037, ההתחלה לא אחרי הסוף)",
    "schedule_holiday_limit": "יותר מ־64 חגים",
    "schedule_holiday_overlap": "חגים חופפים בתאריכים",
    "invalid_text": "שם ריק, ארוך מ־32 תווים או עם תווים לא חוקיים",
    "invalid_fields": "מבנה הבקשה אינו תואם",
    "schedule_transfer_invalid": "הקובץ אינו קובץ ייצוא תקין של ספריית לוחות זמנים",
    "schedule_import_expired": "תצוגת הייבוא פגה או הוחלפה - יש לטעון את הקובץ מחדש",
    "schedule_plan_expired": "הבדיקה פגה או הוחלפה - יש לבדוק שוב",
    "schedule_claim_expired": "הבדיקה פגה או הוחלפה - יש לבדוק שוב",
    "schedule_baseline_expired": "הבדיקה פגה או הוחלפה - יש לבדוק שוב",
    "schedule_plan_not_found": "הצעת הפריסה לא נמצאה",
    "schedule_plan_limit": "יותר מדי הצעות פריסה (עד 32)",
    "schedule_plan_resource_reserved": "המשבצות בעמדה כבר שמורות להצעה אחרת",
    "schedule_plan_device_changed": "העמדה הוחלפה או עודכנה מאז ההצעה",
    "schedule_source_changed": "לוח הזמנים בספרייה השתנה מאז ההצעה - יש להכין הצעה חדשה",
    "schedule_binding_invalid": "מספרי המשבצות אינם תקינים",
    "schedule_binding_out_of_range": "מספר משבצת מחוץ לטווח שהעמדה מאפשרת",
    "schedule_compilation_unknown": "העמדה לא דיווחה על יכולות לוחות הזמנים שלה",
    "schedule_compilation_limit": "לוח הזמנים חורג מהיכולות של העמדה",
    "schedule_claim_conflict": "משבצות אלה כבר באחריות הצעה אחרת",
    "schedule_claim_in_use": "עבודת פריסה פעילה משתמשת באחריות הזאת",
    "schedule_claim_not_found": "האחריות לא נמצאה",
    "schedule_operation_exists": "כבר קיימת עבודת פריסה פעילה להצעה הזאת",
    "schedule_operation_limit": "יותר מדי עבודות פריסה",
    "schedule_operation_not_found": "עבודת הפריסה לא נמצאה",
    "schedule_operation_retained": "אי אפשר עכשיו - העבודה עדיין רצה או שאינה במצב סופי",
    "schedule_operation_failed": "הבדיקה המוקדמת נכשלה",
    "schedule_operations_unavailable": "מנגנון הפריסה אינו זמין",
    "schedule_plan_storage_unavailable": "אחסון הצעות הפריסה אינו זמין",
    "schedule_baseline_unavailable": "אחסון נקודות ההשוואה אינו זמין",
    "schedule_baseline_limit": "הגעתם למספר המרבי של נקודות השוואה",
    "schedule_read_busy": "העמדה כבר נקראת כרגע - נסו שוב בעוד דקה",
    "schedule_writes_unverified": "כתיבת לוחות זמנים לעמדה עדיין לא אומתה ב־WisKey - לא נכתב דבר לעמדה",
    "station_offline": "העמדה אינה מחוברת",
    "station_unloaded": "העמדה נטענה מחדש באמצע הקריאה",
    "station_not_found": "העמדה לא נמצאה",
    "connection_failed": "העמדה לא ענתה בזמן",
    "authentication_failed": "העמדה דחתה את פרטי ההתחברות",
    "invalid_storage": "האחסון של WisKey אינו תקין",
    "rate_limited": "WisKey הגביל את קצב הפקודות",
    "invalid_format": "WisKey דחה את מבנה הבקשה",
    "unknown_command": "גרסת WisKey המותקנת אינה מכירה את הפקודה",
    "reauth_required": "WisKey דורש אימות מחדש",
}


def reason(code: str | None) -> str:
    return REASONS.get(str(code or ""), "סיבה לא מוכרת")


def reset() -> None:
    PREVIEWS.reset()
    LIMITS.reset()
