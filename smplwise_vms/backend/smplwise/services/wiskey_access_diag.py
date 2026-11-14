"""WISKEY-ACCESS-DIAG-2400 (WisKey full integration plan of 2026-11-03, task T10; capability matrix rows 28, 29, 36, 89): Arx's own
"אבחון הרשאות" views over WisKey's access diagnostics - "can X open door Y now", compare two people / two groups / two doors, the
periodic access reviews (and the review decision where WisKey allows the add-on's identity), data quality, a station's permission audit,
sync diagnostics and the identity lifecycle ("who loses access in the next N days").

The WisKey commands (rc.10 `websocket.py` COMMANDS and handlers, `access/access_scenario.py`, `access_comparison.py`,
`permission_reviews.py`, `data_quality.py`, `identity_lifecycle.py`, `permission_audit.py`, `manager.sync_diagnostics`; the request keys
are the pinned catalog's, every key required):

| view            | command                          | class  | what WisKey does                                                              |
|-----------------|----------------------------------|--------|-------------------------------------------------------------------------------|
| scenario        | `users/access_scenario`          | READ   | central policy prediction at an instant; `physical_result: not_verified`      |
| (its source)    | `users/access_compare`           | READ   | person vs the same person: where the grant comes from (group / personal)       |
| pickers         | `users/access_compare_options`   | READ   | people / groups by name, paged (id, name, archived)                           |
| compare         | `users/access_compare`           | READ   | two people or two groups, per station and door                                |
| compare doors   | `users/access_reviews` x2        | READ   | each door's people with their central grant; Arx compares the two lists       |
| reviews         | `users/access_reviews`           | READ   | one door's people with their review state (pending / due / stale / ...)       |
| review preview  | `users/access_review_preview`    | READ   | one person at one door: fingerprint, latest receipt, history                  |
| review decide   | `users/access_review_decide`     | write  | a durable receipt (keep / followup); changes no access, no device             |
| quality         | `users/data_quality`             | READ   | missing / invalid / duplicate profile data, paged with a snapshot             |
| lifecycle       | `users/lifecycle`                | READ   | expired / expiring validity, temporary access, duplicates, no credentials     |
| sync            | `sync/diagnostics`               | READ   | per-station worker state and the last 200 sync stages (pseudonymous refs)     |
| permission audit| `stations/permission_audit`      | non-READ (api_contract) | one station's inventory vs WisKey's desired users; 0 device writes |

Every answer is projected into a CLOSED shape here, field by field (the adapter's rule, services/intercom_adapter.py): unknown fields are
dropped, unknown enum values read "unknown", free codes are reduced to code-like strings. What NOBODY sees in these views, whatever WisKey
sends: a PIN, a card number or a card's last digits (`card_last4` duplicates keep their reason, never the digits), a phone number, the
responsible person and purpose, WisKey's actor ids (an HA user id), the user pseudonyms (`user_ref`), schedule bindings, and the review
fingerprints beyond the one the decision needs. People data is never cached.

Pure: no I/O but the `call` given to the send helpers; the HTTP side is routers/access_control_diag.py. Tests drive it with
tests/fake_wiskey.py (tests/test_wiskey_access_diag.py); nothing contacts a device.
"""
from __future__ import annotations

import re
import threading
import time
from typing import Any

from . import intercom_adapter as ad
from . import intercom_client
from .intercom_client import IntercomError

CHANNEL = "diagnostics"  # services/wiskey_channels.py DIAGNOSTICS
WRITE_CHANNEL = "access_review"  # services/wiskey_channels.py ACCESS_REVIEW
LANE = "access_review"  # intercom_sync: no lane of its own -> a read slot and the read buckets (as the station maintenance)

SCENARIO = "users/access_scenario"
COMPARE = "users/access_compare"
OPTIONS = "users/access_compare_options"
REVIEWS = "users/access_reviews"
PREVIEW = "users/access_review_preview"
DECIDE = "users/access_review_decide"
QUALITY = "users/data_quality"
LIFECYCLE = "users/lifecycle"
SYNC_DIAG = "sync/diagnostics"
AUDIT = "stations/permission_audit"
NON_READ = frozenset({AUDIT, DECIDE})  # `api_contract` on the frame (the catalog's non-READ commands)
READS = frozenset({SCENARIO, COMPARE, OPTIONS, REVIEWS, PREVIEW, QUALITY, LIFECYCLE, SYNC_DIAG, AUDIT})

# the views, each with the commands it needs listed in WisKey's `overview.api.commands`
FEATURES: dict[str, tuple[str, ...]] = {
    "pickers": (OPTIONS,),
    "scenario": (SCENARIO, OPTIONS),
    "compare": (COMPARE, OPTIONS),
    "compare_doors": (REVIEWS,),
    "reviews": (REVIEWS, PREVIEW),
    "review_decide": (DECIDE,),
    "quality": (QUALITY,),
    "lifecycle": (LIFECYCLE,),
    "sync": (SYNC_DIAG,),
    "permission_audit": (AUDIT,),
}

AUDIT_TIMEOUT_S = 50.0  # WisKey allows the audit 90 s (three device reads); ha_client gives up at 60 s (the technical reads' rule)
PAGE = 100  # WisKey's page cap for reviews / quality / options
DOOR_PAGES = 10  # a door comparison reads at most this many review pages per door (1 000 people)


# ---------------------------------------------------------------- feature state

def feature_state(api: dict[str, Any] | None, feature: str) -> tuple[bool | None, str | None]:
    """(available, reason) of one view, from the served copy's `api` facts (intercom_sync.api_facts): None while there is no copy."""
    if api is None:
        return None, None
    min_client = api.get("min_client")
    if isinstance(min_client, int) and min_client > ad.API_CONTRACT:
        return False, "api_incompatible"
    commands = api.get("commands")
    if commands is None:
        return False, "commands_unknown"
    if not all(c in commands for c in FEATURES[feature]):
        return False, "not_listed"
    return True, None


# ---------------------------------------------------------------- the frames

def _result(frame: Any, command: str) -> Any:
    if isinstance(frame, dict) and frame.get("success") is True:
        return frame.get("result")
    if isinstance(frame, dict) and frame.get("success") is False:
        error = frame.get("error") if isinstance(frame.get("error"), dict) else {}
        raise IntercomError(str(error.get("code") or "action_failed"), command)
    raise IntercomError("invalid_response", command)


async def ask(call: intercom_client.Call, command: str, **fields: Any) -> Any:
    """One frame with exactly the pinned catalog's keys (tests/test_wiskey_access_diag.py checks every literal against it)."""
    if command not in READS and command != DECIDE:
        raise IntercomError("not_allowed_on_channel", command)
    if command in NON_READ:
        fields["api_contract"] = intercom_client.API_CONTRACT
    return _result(await call(intercom_client.command_type(command), **fields), command)


async def scenario(call: intercom_client.Call, user_id: str, station_id: str, lock_id: int, at: str) -> Any:
    return await ask(call, SCENARIO, user_id=user_id, station_id=station_id, lock_id=lock_id, at=at)


async def compare(call: intercom_client.Call, left_kind: str, left_id: str, right_kind: str, right_id: str) -> Any:
    return await ask(call, COMPARE, left_kind=left_kind, left_id=left_id, right_kind=right_kind, right_id=right_id)


async def scenario_with_source(call: intercom_client.Call, user_id: str, station_id: str, lock_id: int, at: str) -> Any:
    """The scenario, then the person compared with themselves (where their grant at each door comes from: a group, a personal allow /
    deny, a direct assignment). Both are reads of the same session; the second is best effort (None when WisKey refuses it)."""
    first = await scenario(call, user_id, station_id, lock_id, at)
    try:
        source = await compare(call, "person", user_id, "person", user_id)
    except IntercomError:
        source = None
    return {"scenario": first, "source": source}


async def options(call: intercom_client.Call, kind: str, query: str, offset: int, limit: int) -> Any:
    return await ask(call, OPTIONS, kind=kind, query=query, offset=offset, limit=limit)


async def reviews(call: intercom_client.Call, station_id: str, lock_id: int, *, user_id: str = "", state: str = "all", offset: int = 0, limit: int = 50,
                  snapshot: str = "") -> Any:
    return await ask(call, REVIEWS, user_id=user_id, station_id=station_id, lock_id=lock_id, state=state, offset=offset, limit=limit, snapshot=snapshot)


async def door_people(call: intercom_client.Call, station_id: str, lock_id: int) -> dict[str, Any]:
    """Every person with an assignment at the station, as one door's review report reads them (all states, paged on WisKey's snapshot,
    at most DOOR_PAGES pages). `complete` is False when the list was cut or moved while it was read."""
    records: list[Any] = []
    snapshot, offset, complete = "", 0, True
    for _ in range(DOOR_PAGES):
        page = await reviews(call, station_id, lock_id, offset=offset, limit=PAGE, snapshot=snapshot)
        if not isinstance(page, dict):
            raise IntercomError("invalid_response", REVIEWS)
        if page.get("stale") is True:
            complete = False
            break
        records.extend(page.get("records") or [])
        snapshot = page.get("snapshot") if isinstance(page.get("snapshot"), str) else ""
        nxt = page.get("next_offset")
        if not isinstance(nxt, int) or nxt <= offset:
            break
        offset = nxt
    else:
        complete = False
    return {"records": records, "complete": complete}


async def compare_doors(call: intercom_client.Call, left: tuple[str, int], right: tuple[str, int]) -> dict[str, Any]:
    return {"left": await door_people(call, *left), "right": await door_people(call, *right)}


async def review_preview(call: intercom_client.Call, user_id: str, station_id: str, lock_id: int) -> Any:
    return await ask(call, PREVIEW, user_id=user_id, station_id=station_id, lock_id=lock_id)


async def review_decide(call: intercom_client.Call, body: dict[str, Any]) -> Any:
    keys = ("user_id", "station_id", "lock_id", "person_revision", "fingerprint", "latest_id", "decision", "reason", "cadence_days")
    return await ask(call, DECIDE, **{k: body[k] for k in keys}, confirmed=True)


async def quality(call: intercom_client.Call, kind: str, state: str, offset: int, limit: int, snapshot: str) -> Any:
    return await ask(call, QUALITY, kind=kind, state=state, offset=offset, limit=limit, snapshot=snapshot)


async def lifecycle(call: intercom_client.Call, warning_days: int) -> Any:
    return await ask(call, LIFECYCLE, warning_days=warning_days)


async def sync_diagnostics(call: intercom_client.Call) -> Any:
    return await ask(call, SYNC_DIAG)


async def permission_audit(call: intercom_client.Call, station_id: str) -> Any:
    return await ask(call, AUDIT, station_id=station_id)


# ---------------------------------------------------------------- value rules

HEX64 = re.compile(r"[a-f0-9]{64}")
HEX32 = re.compile(r"[a-f0-9]{32}")
REF = re.compile(r"[a-f0-9]{12}")
HHMM = re.compile(r"(?:[01][0-9]|2[0-3]):[0-5][0-9]|24:00")
DAY = re.compile(r"\d{4}-\d{2}-\d{2}")
WEEKDAYS = frozenset({"monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"})


def _enum(v: Any, allowed: frozenset[str]) -> str:
    return v if isinstance(v, str) and v in allowed else "unknown"


def _opt_enum(v: Any, allowed: frozenset[str]) -> str | None:
    return None if v is None else _enum(v, allowed)


def _bool(v: Any) -> bool:
    return v is True


def _name(v: Any) -> str:
    return ad._text(v, 128) or ""


def _id(v: Any) -> str | None:
    return ad._id(v)


def _lock(v: Any) -> int | None:
    return v if type(v) is int and v in (1, 2) else None


def _count(v: Any) -> int:
    n = ad._int(v)
    return n if n is not None and n >= 0 else 0


def _paging(raw: dict[str, Any]) -> dict[str, Any]:
    return {k: ad._int(raw.get(k)) for k in ("total", "offset", "limit", "next_offset", "previous_offset")}


def _schedule(v: Any) -> dict[str, Any] | None:
    """A person's timing schedule (WisKey's `access_timing_policy.schedule`): mode, zone, weekdays, dates, periods - nothing else."""
    if not isinstance(v, dict):
        return None
    zone = v.get("timezone")
    return {
        "mode": _enum(v.get("mode"), frozenset({"weekly", "dates"})),
        "timezone": zone if isinstance(zone, str) and re.fullmatch(r"[A-Za-z0-9_+\-/]{1,64}", zone) else None,
        "days": [d for d in v.get("days") or [] if isinstance(d, str) and d in WEEKDAYS][:7] if isinstance(v.get("days"), list) else [],
        "dates": [d for d in v.get("dates") or [] if isinstance(d, str) and DAY.fullmatch(d)][:366] if isinstance(v.get("dates"), list) else [],
        "periods": [
            {"start": p["start"], "end": p["end"]}
            for p in (v.get("periods") if isinstance(v.get("periods"), list) else [])[:8]
            if isinstance(p, dict) and isinstance(p.get("start"), str) and isinstance(p.get("end"), str) and HHMM.fullmatch(p["start"]) and HHMM.fullmatch(p["end"])
        ],
    }


TIMING_MODES = frozenset({"unrestricted", "ha", "native"})


# ---------------------------------------------------------------- pickers

def project_options(raw: Any) -> dict[str, Any]:
    if not isinstance(raw, dict):
        raise ValueError("unexpected users/access_compare_options answer")
    rows = raw.get("records") if isinstance(raw.get("records"), list) else []
    return {
        "records": [{"id": i, "name": _name(r.get("name")), "archived": _bool(r.get("archived"))} for r in rows if isinstance(r, dict) and (i := _id(r.get("id")))],
        **_paging(raw),
    }


# ---------------------------------------------------------------- the scenario

SCENARIO_REASONS = frozenset({"allowed", "archived", "inactive", "no_assignment", "lock_not_assigned", "outside_validity", "outside_schedule"})
ASSIGNMENT_SYNC = frozenset({"synced", "pending", "syncing", "offline", "conflict", "error", "delete_pending"})
TIMING_EVIDENCE = frozenset({"unavailable", "historical", "previous_policy"})
STATION_STATUS = frozenset({"online", "offline", "syncing", "synced", "pending", "error", "conflict", "unknown", "unavailable"})
SOURCES = frozenset({"personal_deny", "personal_allow", "inherited", "restricted", "assignment", "none", "group_policy"})


def _side(v: Any) -> dict[str, Any]:
    v = v if isinstance(v, dict) else {}
    groups = v.get("groups") if isinstance(v.get("groups"), list) else []
    return {
        "granted": _bool(v.get("granted")),
        "configured": _bool(v.get("configured")),
        "source": _enum(v.get("source"), SOURCES),
        "groups": [{"id": i, "name": _name(g.get("name"))} for g in groups[:20] if isinstance(g, dict) and (i := _id(g.get("id")))],
        "override": _opt_enum(v.get("override"), frozenset({"allow", "deny"})),
        "sources_known": v.get("sources_known") is not False,
    }


def _label(v: Any) -> dict[str, Any]:
    v = v if isinstance(v, dict) else {}
    kind = _enum(v.get("kind"), frozenset({"person", "group"}))
    out: dict[str, Any] = {"kind": kind, "id": _id(v.get("id")), "name": _name(v.get("name"))}
    if kind == "person":
        out.update(active=_bool(v.get("active")), archived=_bool(v.get("archived")), valid_from=ad._iso(v.get("valid_from")),
                   valid_until=ad._iso(v.get("valid_until")), timing_mode=_enum(v.get("timing_mode"), TIMING_MODES))
    else:
        out["enabled"] = _bool(v.get("enabled"))
    return out


def project_scenario(raw: Any) -> dict[str, Any]:
    """`users/access_scenario`: WisKey's prediction from its central policy (desired) and its cached sync metadata (observed). Never a
    claim about the physical door (`physical_result` is always `not_verified` in rc.10)."""
    if not isinstance(raw, dict) or not isinstance(raw.get("desired"), dict):
        raise ValueError("unexpected users/access_scenario answer")
    desired = raw["desired"]
    observed = raw.get("observed") if isinstance(raw.get("observed"), dict) else {}
    timing = observed.get("timing") if isinstance(observed.get("timing"), dict) else {}
    return {
        "person_revision": ad._int(raw.get("person_revision")),
        "station_id": _id(raw.get("station_id")),
        "lock_id": _lock(raw.get("lock_id")),
        "at": ad._iso(raw.get("at")),
        "desired": {
            "allowed": _bool(desired.get("allowed")),
            "reason": _enum(desired.get("reason"), SCENARIO_REASONS),
            "timing_mode": _enum(desired.get("timing_mode"), TIMING_MODES),
            "draft_ignored": _bool(desired.get("draft_ignored")),
        },
        "observed": {
            "sync_state": _enum(observed.get("sync_state"), ASSIGNMENT_SYNC),
            "last_sync_at": ad._iso(observed.get("last_sync_at")),
            "revision_matches": _bool(observed.get("revision_matches")),
            "timing": {
                "status": _enum(timing.get("status"), TIMING_EVIDENCE),
                "mode": _opt_enum(timing.get("mode"), frozenset({"ha", "native"})),
                "checked_at": ad._iso(timing.get("checked_at")),
                "valid_from": ad._iso(timing.get("valid_from")),
                "valid_until": ad._iso(timing.get("valid_until")),
                "interval_contains_target": timing.get("interval_contains_target") if isinstance(timing.get("interval_contains_target"), bool) else None,
            },
        },
        "station_status": ad._code(raw.get("station_status")) or "unknown",
        "physical_result": "not_verified",
    }


def project_compare(raw: Any) -> dict[str, Any]:
    if not isinstance(raw, dict) or not isinstance(raw.get("rows"), list):
        raise ValueError("unexpected users/access_compare answer")
    rows = []
    for r in raw["rows"][:400]:
        if not isinstance(r, dict) or not (sid := _id(r.get("station_id"))) or _lock(r.get("lock_id")) is None:
            continue
        rows.append({
            "station_id": sid, "station_name": _name(r.get("station_name")), "lock_id": r["lock_id"],
            "relation": _enum(r.get("relation"), frozenset({"shared", "left_only", "right_only", "neither"})),
            "left": _side(r.get("left")), "right": _side(r.get("right")),
        })
    summary = raw.get("summary") if isinstance(raw.get("summary"), dict) else {}
    return {
        "left": _label(raw.get("left")), "right": _label(raw.get("right")), "rows": rows,
        "summary": {k: _count(summary.get(k)) for k in ("shared", "left_only", "right_only", "neither")},
        "physical_result": "not_verified",
    }


def project_scenario_pair(raw: Any) -> dict[str, Any]:
    """`scenario_with_source`: the scenario and, when WisKey answered it, the person's own row for the asked door (where the grant comes
    from) and the person's label (name, active, validity, timing mode)."""
    if not isinstance(raw, dict):
        raise ValueError("unexpected scenario answer")
    out = project_scenario(raw.get("scenario"))
    source = None
    person = None
    if raw.get("source") is not None:
        try:
            cmp = project_compare(raw["source"])
        except ValueError:
            cmp = None
        if cmp is not None:
            person = cmp["left"]
            row = next((r for r in cmp["rows"] if r["station_id"] == out["station_id"] and r["lock_id"] == out["lock_id"]), None)
            source = row["left"] if row else {"granted": False, "configured": False, "source": "none", "groups": [], "override": None, "sources_known": True}
    out["source"] = source
    out["person"] = person
    return out


# ---------------------------------------------------------------- compare two doors (Arx's comparison of two review reports)

def _door_person(r: Any) -> dict[str, Any] | None:
    if not isinstance(r, dict) or not (uid := _id(r.get("user_id"))):
        return None
    central = r.get("central") if isinstance(r.get("central"), dict) else {}
    return {"user_id": uid, "display_name": _name(r.get("display_name")), "granted": _bool(central.get("granted")), "archived": _bool(central.get("archived")),
            "active": _bool(central.get("active"))}


def project_door_compare(raw: Any) -> dict[str, Any]:
    """Who of the people assigned to either door is granted at the left one, the right one, both or neither (WisKey's central policy,
    not the device). People are listed by name; `complete` False = a list was cut (over 1 000 people) or moved while it was read."""
    if not isinstance(raw, dict):
        raise ValueError("unexpected door comparison")
    sides: dict[str, dict[str, dict[str, Any]]] = {}
    complete = True
    for key in ("left", "right"):
        part = raw.get(key) if isinstance(raw.get(key), dict) else {}
        complete = complete and part.get("complete") is True
        sides[key] = {p["user_id"]: p for r in part.get("records") or [] if (p := _door_person(r)) is not None}
    rows = []
    summary = {"shared": 0, "left_only": 0, "right_only": 0, "neither": 0}
    for uid in sorted(set(sides["left"]) | set(sides["right"])):
        a, b = sides["left"].get(uid), sides["right"].get(uid)
        left, right = bool(a and a["granted"]), bool(b and b["granted"])
        relation = "shared" if left and right else "left_only" if left else "right_only" if right else "neither"
        summary[relation] += 1
        name = (a or b or {}).get("display_name") or ""
        rows.append({"user_id": uid, "display_name": name, "relation": relation, "left": left, "right": right,
                     "left_assigned": a is not None, "right_assigned": b is not None, "archived": bool((a or b or {}).get("archived"))})
    rows.sort(key=lambda r: (r["display_name"].casefold(), r["user_id"]))
    return {"rows": rows, "summary": summary, "complete": complete, "physical_result": "not_verified"}


# ---------------------------------------------------------------- reviews

REVIEW_STATES = frozenset({"pending", "due", "stale", "completed", "followup", "archived"})
DECISIONS = frozenset({"keep", "followup"})


def _central(v: Any) -> dict[str, Any]:
    v = v if isinstance(v, dict) else {}
    return {
        "active": _bool(v.get("active")), "archived": _bool(v.get("archived")),
        "valid_from": ad._iso(v.get("valid_from")), "valid_until": ad._iso(v.get("valid_until")),
        "assignment_enabled": _bool(v.get("assignment_enabled")), "granted": _bool(v.get("granted")),
        "timing_mode": _enum(v.get("timing_mode"), TIMING_MODES), "schedule": _schedule(v.get("schedule")),
    }


def _receipt(v: Any) -> dict[str, Any] | None:
    """A review receipt without WisKey's actor (the add-on's own HA user id, never the Arx operator) and without its fingerprint."""
    if not isinstance(v, dict) or not isinstance(v.get("id"), str) or not HEX32.fullmatch(v["id"]):
        return None
    return {
        "id": v["id"], "decision": _enum(v.get("decision"), DECISIONS), "reason": ad._text(v.get("reason"), 500) or "",
        "cadence_days": ad._int(v.get("cadence_days")), "at": ad._iso(v.get("at")), "due_at": ad._iso(v.get("due_at")),
        "person_revision": ad._int(v.get("person_revision")), "arx_actor": None,
    }


def project_reviews(raw: Any) -> dict[str, Any]:
    if not isinstance(raw, dict):
        raise ValueError("unexpected users/access_reviews answer")
    rows = raw.get("records") if isinstance(raw.get("records"), list) else []
    summary = raw.get("summary") if isinstance(raw.get("summary"), dict) else {}
    return {
        "snapshot": ad._text(raw.get("snapshot"), 64) or "",
        "stale": _bool(raw.get("stale")),
        **_paging(raw),
        "records": [
            {"user_id": uid, "display_name": _name(r.get("display_name")), "person_revision": ad._int(r.get("person_revision")),
             "status": _enum(r.get("status"), REVIEW_STATES), "central": _central(r.get("central")), "latest": _receipt(r.get("latest")),
             "sync_state": _enum(r.get("sync_state"), ASSIGNMENT_SYNC)}
            for r in rows if isinstance(r, dict) and (uid := _id(r.get("user_id")))
        ],
        "summary": {k: _count(summary.get(k)) for k in sorted(REVIEW_STATES)},
        "access_changed": False,
    }


def project_preview(raw: Any) -> dict[str, Any]:
    """One person at one door: what the decision must carry back (revision, fingerprint, latest receipt id) and the history."""
    if not isinstance(raw, dict) or not isinstance(raw.get("fingerprint"), str) or not HEX64.fullmatch(raw["fingerprint"]):
        raise ValueError("unexpected users/access_review_preview answer")
    latest = raw.get("latest_id")
    history = raw.get("history") if isinstance(raw.get("history"), list) else []
    return {
        "user_id": _id(raw.get("user_id")), "station_id": _id(raw.get("station_id")), "lock_id": _lock(raw.get("lock_id")),
        "person_revision": ad._int(raw.get("person_revision")), "fingerprint": raw["fingerprint"],
        "latest_id": latest if isinstance(latest, str) and (latest == "" or HEX32.fullmatch(latest)) else "",
        "central": _central(raw.get("central")),
        "history": [h for r in history[:20] if (h := _receipt(r)) is not None],
        "access_changed": False,
    }


def project_decide(raw: Any) -> dict[str, Any]:
    if not isinstance(raw, dict) or (receipt := _receipt(raw.get("receipt"))) is None:
        raise ValueError("unexpected users/access_review_decide answer")
    return {"receipt": receipt, "access_changed": False}


# ---------------------------------------------------------------- data quality

QUALITY_KINDS = frozenset({"missing", "invalid", "duplicate"})


def project_quality(raw: Any, *, employee_no: bool) -> dict[str, Any]:
    """`users/data_quality`. Issues name the field and the problem, never the value (WisKey's own rule); a duplicate names the other
    people (name, archived; the employee number only where the caller may see it), never the shared value."""
    if not isinstance(raw, dict):
        raise ValueError("unexpected users/data_quality answer")
    rows = raw.get("records") if isinstance(raw.get("records"), list) else []
    coverage = raw.get("coverage") if isinstance(raw.get("coverage"), dict) else {}
    summary = raw.get("summary") if isinstance(raw.get("summary"), dict) else {}

    def issue(i: Any) -> dict[str, Any] | None:
        if not isinstance(i, dict):
            return None
        related = i.get("related_people") if isinstance(i.get("related_people"), list) else None
        return {
            "kind": _enum(i.get("kind"), QUALITY_KINDS), "code": ad._code(i.get("code")) or "other",
            "field_id": _id(i.get("field_id")), "label": ad._text(i.get("label"), 64) or "",
            "related_count": _count(i.get("related_count")) if related is not None else 0,
            "related_people": [
                {"id": rid, "display_name": _name(p.get("display_name")), "archived": _bool(p.get("archived")),
                 "employee_no": (ad._text(p.get("employee_no"), 32) if employee_no else None)}
                for p in (related or [])[:10] if isinstance(p, dict) and (rid := _id(p.get("id")))
            ],
        }

    return {
        "snapshot": ad._text(raw.get("snapshot"), 64) or "",
        "stale": _bool(raw.get("stale")),
        "coverage": {"scanned": _count(coverage.get("scanned")), "archived": _count(coverage.get("archived")), "unknown_fields": _count(coverage.get("unknown_fields"))},
        "summary": {k: _count(summary.get(k)) for k in ("people", "missing", "invalid", "duplicate")},
        **_paging(raw),
        "records": [
            {"id": uid, "display_name": _name(r.get("display_name")), "employee_no": (ad._text(r.get("employee_no"), 32) if employee_no else None),
             "revision": ad._int(r.get("revision")), "archived": _bool(r.get("archived")),
             "issues": [x for i in (r.get("issues") if isinstance(r.get("issues"), list) else [])[:40] if (x := issue(i)) is not None]}
            for r in rows if isinstance(r, dict) and (uid := _id(r.get("id")))
        ],
    }


# ---------------------------------------------------------------- lifecycle

CATEGORIES = frozenset({"staff", "visitor", "contractor"})
TEMP_STATES = frozenset({"active", "upcoming", "expired", "inactive"})
DUP_REASONS = frozenset({"display_name", "phone", "card_last4"})


def _life_row(r: Any, employee_no: bool) -> dict[str, Any] | None:
    """A lifecycle person row: identity, category, active, validity, how many doors - never the phone, a PIN flag, card counts, the
    responsible person or the purpose."""
    if not isinstance(r, dict) or not (uid := _id(r.get("id"))):
        return None
    return {
        "id": uid, "display_name": _name(r.get("display_name")),
        "employee_no": (ad._text(r.get("employee_no"), 32) if employee_no else None),
        "access_category": _enum(r.get("access_category"), CATEGORIES), "active": _bool(r.get("active")),
        "valid_from": ad._iso(r.get("valid_from")), "valid_until": ad._iso(r.get("valid_until")),
        "assignment_count": _count(r.get("assignment_count")),
    }


def project_lifecycle(raw: Any, *, employee_no: bool, credentials: bool) -> dict[str, Any]:
    """`users/lifecycle`: who loses access within the window (`expirations`: expiring / expired, with the seconds left), the temporary
    people (visitors / contractors) with their state, the duplicate candidates (reason only - a `card_last4` duplicate never carries the
    digits) and, for a caller who may see credential kinds (`credentials`), the active people without any credential (else the count only)."""
    if not isinstance(raw, dict) or not isinstance(raw.get("summary"), dict):
        raise ValueError("unexpected users/lifecycle answer")
    summary = raw["summary"]
    truncated = raw.get("truncated") if isinstance(raw.get("truncated"), dict) else {}
    temporary = raw.get("temporary_access") if isinstance(raw.get("temporary_access"), dict) else {}
    temp_summary = temporary.get("summary") if isinstance(temporary.get("summary"), dict) else {}
    expirations = []
    for r in (raw.get("expirations") if isinstance(raw.get("expirations"), list) else [])[:200]:
        row = _life_row(r, employee_no)
        if row is not None:
            row.update(state=_enum(r.get("state"), frozenset({"expiring", "expired"})), seconds_remaining=ad._int(r.get("seconds_remaining")))
            expirations.append(row)
    temp_rows = []
    for r in (temporary.get("users") if isinstance(temporary.get("users"), list) else [])[:200]:
        row = _life_row(r, employee_no)
        if row is not None:
            row.update(state=_enum(r.get("state"), TEMP_STATES), expiring_soon=_bool(r.get("expiring_soon")),
                       timing_policy_configured=_bool(r.get("timing_policy_configured")))
            temp_rows.append(row)
    duplicates = []
    for d in (raw.get("duplicates") if isinstance(raw.get("duplicates"), list) else [])[:200]:
        if not isinstance(d, dict):
            continue
        users = [{"id": u["id"], "display_name": u["display_name"]} for x in (d.get("users") if isinstance(d.get("users"), list) else [])[:20]
                 if (u := _life_row(x, False)) is not None]
        if len(users) >= 2:
            duplicates.append({"reason": _enum(d.get("reason"), DUP_REASONS), "users": users})
    without = None
    if credentials:
        without = [row for r in (raw.get("without_credentials") if isinstance(raw.get("without_credentials"), list) else [])[:200]
                   if (row := _life_row(r, employee_no)) is not None]
    return {
        "generated_at": ad._iso(raw.get("generated_at")),
        "warning_days": ad._int(raw.get("warning_days")),
        "summary": {k: _count(summary.get(k)) for k in ("total", "active", "scheduled", "expired", "expiring", "without_credentials", "duplicate_groups", "duplicate_users")},
        "expirations": expirations,
        "temporary": {"summary": {k: _count(temp_summary.get(k)) for k in ("total", "active", "upcoming", "expired", "inactive", "expiring")}, "users": temp_rows},
        "duplicates": duplicates,
        "without_credentials": without,
        "truncated": {k: _bool(truncated.get(k)) for k in ("expirations", "duplicates", "without_credentials", "temporary_access")},
    }


# ---------------------------------------------------------------- sync diagnostics

STAGE_OUTCOMES = frozenset({"started", "succeeded", "failed", "skipped", "retry"})


def project_sync(raw: Any) -> dict[str, Any]:
    """`sync/diagnostics`: WisKey's support export. Stations are pseudonymous references (WisKey keys them with its own secret: Arx cannot
    name them - a WisKey gap, docs/changes/WISKEY-ACCESS-DIAG-2400.md); the person references (`user_ref`) are dropped."""
    if not isinstance(raw, dict):
        raise ValueError("unexpected sync/diagnostics answer")
    stations = []
    for s in (raw.get("stations") if isinstance(raw.get("stations"), list) else [])[:200]:
        if not isinstance(s, dict) or not isinstance(s.get("station_ref"), str) or not REF.fullmatch(s["station_ref"]):
            continue
        stations.append({
            "station_ref": s["station_ref"], "state": ad._code(s.get("state")) or "unknown", "last_error": ad._code(s.get("last_error")),
            "loaded": _bool(s.get("loaded")), "managed_lock": _bool(s.get("managed_lock")), "worker_active": _bool(s.get("worker_active")),
            "pending_request": _bool(s.get("pending_request")), "reconciliation_targets": _count(s.get("reconciliation_targets")),
        })
    recent = []
    for r in (raw.get("recent") if isinstance(raw.get("recent"), list) else [])[-200:]:
        if not isinstance(r, dict) or not isinstance(r.get("station_ref"), str) or not REF.fullmatch(r["station_ref"]):
            continue
        recent.append({
            "at": ad._iso(r.get("timestamp")), "station_ref": r["station_ref"], "step": ad._code(r.get("step")) or "other",
            "outcome": _enum(r.get("outcome"), STAGE_OUTCOMES), "error": ad._code(r.get("error")),
            "status_code": ad._int(r.get("status_code")), "sub_status": ad._code(r.get("sub_status")),
        })
    failures: dict[str, int] = {}
    for r in recent:
        if r["outcome"] == "failed":
            key = r["error"] or "other"
            failures[key] = failures.get(key, 0) + 1
    return {
        "integration_version": ad._text(raw.get("integration_version"), 40),
        "retention": ad._code(raw.get("retention")),
        "stations": stations,
        "recent": list(reversed(recent)),  # newest first
        "failures": dict(sorted(failures.items(), key=lambda kv: (-kv[1], kv[0]))),
    }


# ---------------------------------------------------------------- station permission audit

AUDIT_STATUSES = frozenset({"matched", "drift", "unmanaged", "unverified"})
DIFFERENCES = frozenset({"presence", "display_name", "user_type", "validity", "door_rights", "pin", "schedule", "privileged", "other_credentials", "cards"})


def project_audit(raw: Any, *, employee_no: bool) -> dict[str, Any]:
    """`stations/permission_audit`: per person WisKey wants on the station (and per device user it does not know), whether the device
    matches. The differences are field NAMES ("pin", "cards" mean "differs"), never values; WisKey's `plan` (what a sync would change,
    PIN included) is not kept. A device user unknown to WisKey shows as "unmanaged" with its employee number where the caller may see it."""
    if not isinstance(raw, dict) or not isinstance(raw.get("rows"), list):
        raise ValueError("unexpected stations/permission_audit answer")
    rows = []
    for r in raw["rows"][:1000]:
        if not isinstance(r, dict):
            continue
        diffs = r.get("differences") if isinstance(r.get("differences"), list) else []
        rows.append({
            "user_id": _id(r.get("user_id")), "display_name": ad._text(r.get("display_name"), 128),
            "employee_no": (ad._text(r.get("employee_no"), 32) if employee_no else None),
            "status": _enum(r.get("status"), AUDIT_STATUSES),
            "differences": sorted({d if d in DIFFERENCES else "other" for d in diffs if isinstance(d, str)}),
            "error": ad._code(r.get("error")),
        })
    counts = raw.get("counts") if isinstance(raw.get("counts"), dict) else {}
    return {
        "station_id": _id(raw.get("station_id")), "checked_at": ad._iso(raw.get("checked_at")),
        "device_writes": _count(raw.get("device_writes")), "complete": _bool(raw.get("complete")),
        "total_candidates": _count(raw.get("total_candidates")),
        "counts": {k: _count(counts.get(k)) for k in sorted(AUDIT_STATUSES)},
        "rows": rows,
    }


# ---------------------------------------------------------------- Arx's own limit on the permission audit

AUDIT_COOLDOWN_S = 20.0


class AuditGate:
    """One permission audit per station at a time, and not again within AUDIT_COOLDOWN_S (WisKey itself refuses a second audit of the
    same station, `device_busy`, and at most three at once; this keeps Arx from asking). In-process only."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._busy: set[str] = set()
        self._last: dict[str, float] = {}

    def admit(self, station_id: str) -> tuple[str, float] | None:
        now = time.monotonic()
        with self._lock:
            if station_id in self._busy or len(self._busy) >= 2:
                return "diag_audit_busy", 5.0
            left = AUDIT_COOLDOWN_S - (now - self._last.get(station_id, -1e9))
            if left > 0:
                return "diag_audit_cooldown", round(left, 1)
            self._busy.add(station_id)
        return None

    def done(self, station_id: str) -> None:
        with self._lock:
            self._busy.discard(station_id)
            self._last[station_id] = time.monotonic()

    def reset(self) -> None:
        with self._lock:
            self._busy.clear()
            self._last.clear()


AUDIT_GATE = AuditGate()


def reset() -> None:
    AUDIT_GATE.reset()
