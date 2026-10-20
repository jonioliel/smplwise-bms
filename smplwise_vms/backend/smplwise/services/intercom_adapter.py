"""CR-036 S4: the ONE WisKey read adapter (`intercom_adapter`) - every stage-1 read the native access-control screens use.

Data path (CR-036 2.1). Browser -> a typed Arx endpoint (routers/access_control_reads.py; the legacy phase-1b reads of
routers/access_control.py too) -> this module -> the service feed's live Home Assistant session (services/intercom_sync.py)
-> `hikvision_intercom/<command>`. No generic proxy: the browser never names a command; every command this module can
send is a literal below, declared in CHANNEL_OF, and sent through that channel's guard (services/wiskey_channels.py):

- `read`: commands the pinned catalog classifies READ (no `api_contract`); the read channel's allow-list holds no write.
- `technical`: four reads the catalog does NOT classify READ (so they carry `api_contract` and pass WisKey's re-auth guard):
  `stations/technical_program_list`, `stations/technical_hold_get`, `stations/technical_codes_get`, `health/history`.
  Reviewed in the WisKey rc.37 source (S4 research, technical_api.py / public_codes.py / health_api.py / fleet_health.py):
  no storage write, no device write; only in-memory "busy" markers; `technical_codes_get` reads the device (three ISAPI
  GETs, up to 75 s) and returns PRESENCE booleans only - never a code value. Not carried at all: `stations/technical_relays`
  (it needs `stations: manage`, takes `expected` / `locks` arrays and is a configuration command; the relays come from the
  overview's `integrated_locks`).

Both channels ride the service socket (same identity, so the same WisKey limiter bucket - CR-036 2.5) in the feed's READ
lane (its in-flight slots and token buckets). Technical reads are additionally capped at one in flight (WisKey refuses a
second one on the same station, `device_busy`, and a slow device read must never hold more than one read slot).

What the adapter does with an answer, in this order (D-003, CR-036 2.2):
1. projects it into a CLOSED superset - built field by field; unknown fields dropped; unknown enum values -> "unknown";
   free-text codes reduced to code-like strings ("other" otherwise); things NOBODY may see never kept (`last_access`, people
   counts, host, the go2rtc address, card masks, PIN flags, the `user_ref` pseudonym, actors' HA ids, templates' default
   profile values); redacted placeholders (`redacted_fields`) read as unknown (null), never as absence;
2. caches it ONLY when it is principal-independent and person-free (stations come from the feed's own copy; groups,
   schedules, programs, hold, code presence, health, sync counts, alerts are cached with a short TTL, single-flight, cleared
   when the feed drops its copy and marked stale on WisKey's `refresh` push); people, events, photos, conflicts and WisKey's
   audit are never cached - each request reads them and forgets them;
3. hands it to services/intercom_authority.py, which builds the caller's view (rows omitted, fields removed, counts
   recomputed). No public method of this module returns a superset.

Feature flags: the overview's `api.commands` (WisKey lists the commands the add-on's user may call) decides whether a
feature exists: a command it does not list makes the endpoint answer `state: "unsupported"` (`last_error: "not_listed"`)
without calling WisKey; `api.min_client` above Arx's API_CONTRACT makes every feature `api_incompatible`; no list at all
means `commands_unknown` (fail closed). The legacy phase-1b reads keep their own behaviour (WisKey's `unknown_command`).

Nothing here contacts anything but the feed's session; tests drive it with tests/fake_wiskey.py.
"""
from __future__ import annotations

import base64
import binascii
import csv
import hashlib
import hmac
import io
import json
import logging
import os
import re
import secrets
import threading
import time
from collections import OrderedDict
from datetime import datetime, timedelta, timezone
from typing import Any, Awaitable, Callable

from ..config import Settings
from ..errors import ApiError, forbidden
from . import intercom_authority as ia
from . import intercom_client, intercom_sync
from .intercom_client import IntercomError

log = logging.getLogger("smplwise.intercom")

DOMAIN = intercom_client.DOMAIN
API_CONTRACT = intercom_client.API_CONTRACT

# ---------------------------------------------------------------- the commands and their channels

CHANNEL_OF: dict[str, str] = {
    "users/query": "read", "users/get": "read", "users/photo_get": "read",
    "events/list": "read", "events/detail": "read", "events/export": "read",
    "profiles/settings_get": "read", "profiles/versions": "read",
    "schedules/list": "read", "schedules/plan_list": "read", "schedules/operations_list": "read",
    "health/get": "read", "sync/status": "read", "conflicts/list": "read", "fleet/alerts": "read", "audit/list": "read",
    "stations/technical_program_list": "technical", "stations/technical_hold_get": "technical",
    "stations/technical_codes_get": "technical", "health/history": "technical",
}

READ_TIMEOUT_S = 25.0  # intercom_sync.COMMAND_TIMEOUT_S, re-read at call time (tests tune it there)
EXPORT_TIMEOUT_S = 45.0  # WisKey builds the report in an executor thread over the whole retained cache
TECHNICAL_TIMEOUT_S = 50.0  # technical_codes_get may take WisKey up to 75 s (three device reads); ha_client gives up at 60 s
SCAN_PAGE = 200  # WisKey's page cap for users/query and events/list
MAX_SCAN_PAGES = 10  # one request never loops over WisKey unbounded: at most this many pages per scan (2 000 rows)


async def _ask(call: intercom_client.Call, command: str, **fields: Any) -> Any:
    """Send one frame, exactly as the pinned catalog allows it (tests/test_intercom_adapter.py checks every literal)."""
    if CHANNEL_OF.get(command) == "technical":
        fields["api_contract"] = API_CONTRACT  # a non-READ command carries the client API (WisKey's api_incompatible check)
    frame = await call(f"{DOMAIN}/{command}", **fields)
    # WisKey round 3 (R3-08): the success marker must be the boolean - a truthy non-boolean is not a result
    if isinstance(frame, dict) and frame.get("success") is True:
        return frame.get("result")
    if isinstance(frame, dict) and frame.get("success") is False:
        error = frame.get("error") if isinstance(frame.get("error"), dict) else {}
        raise IntercomError(str(error.get("code") or "action_failed"), command)
    raise IntercomError("invalid_response", command)


# the filters each WisKey read is ever given (any other key a caller passes is dropped here, not only in the routers)
PEOPLE_FILTER_KEYS = ("group", "station", "rights", "state", "sort", "credential", "profile")
# `credential` and `profile` are FIELD filters (S7): WisKey would match them on values only a holder of `access.people.sensitive`
# may see, so they are handed on - and honoured - for such a caller only (D1, field oracles; see `has_field_filters`).
FIELD_FILTER_KEYS = ("credential", "profile")
MAX_PROFILE_FILTERS = 8
EVENT_FILTER_KEYS = ("station_id", "person", "result", "authentication", "event_type", "door", "start", "end", "limit", "before", "current_group")  # never `current_profile`
EXPORT_FILTER_KEYS = ("station_id", "person", "result", "authentication", "event_type", "door", "start", "end", "current_group")
AUDIT_FILTER_KEYS = ("user_id", "station_id", "action", "start", "end", "before", "limit")


async def users_query(call: intercom_client.Call, filters: dict[str, Any], offset: int, limit: int, snapshot: str | None, *, field_filters: bool = False) -> Any:
    """`users/query` - the text is ALWAYS empty (D1: WisKey's own search matches phone digits and card digits). The field
    filters (`credential`, `profile`) are dropped here unless `field_filters` is set, which only `IntercomAdapter.people` does,
    for a caller who holds `access.people.sensitive` (S7): a frame built by any other caller never carries an oracle."""
    keys = PEOPLE_FILTER_KEYS if field_filters else tuple(k for k in PEOPLE_FILTER_KEYS if k not in FIELD_FILTER_KEYS)
    body = {k: filters[k] for k in keys if filters.get(k) is not None}
    return await _ask(call, "users/query", query="", filters=body, offset=offset, limit=limit, snapshot=snapshot or "")


async def users_get(call: intercom_client.Call, user_id: str) -> Any:
    return await _ask(call, "users/get", user_id=user_id)


async def users_photo_get(call: intercom_client.Call, user_id: str) -> Any:
    return await _ask(call, "users/photo_get", user_id=user_id)


async def events_list(call: intercom_client.Call, filters: dict[str, Any]) -> Any:
    body = {k: filters[k] for k in EVENT_FILTER_KEYS if filters.get(k) is not None}
    return await _ask(call, "events/list", filters=body)


async def events_detail(call: intercom_client.Call, event_id: str) -> Any:
    return await _ask(call, "events/detail", event_id=event_id)


async def events_export(call: intercom_client.Call, filters: dict[str, Any]) -> Any:
    body = {k: filters[k] for k in EXPORT_FILTER_KEYS if filters.get(k) is not None}
    return await _ask(call, "events/export", filters=body)


async def profiles_settings(call: intercom_client.Call) -> Any:
    return await _ask(call, "profiles/settings_get")


async def profiles_versions(call: intercom_client.Call, offset: int, limit: int) -> Any:
    return await _ask(call, "profiles/versions", offset=offset, limit=limit)


async def schedules_list(call: intercom_client.Call) -> Any:
    return await _ask(call, "schedules/list")


async def schedules_plans(call: intercom_client.Call) -> Any:
    return await _ask(call, "schedules/plan_list")


async def schedules_operations(call: intercom_client.Call) -> Any:
    return await _ask(call, "schedules/operations_list")


async def health_get(call: intercom_client.Call, station_id: str) -> Any:
    return await _ask(call, "health/get", station_id=station_id)


async def health_history(call: intercom_client.Call, station_id: str) -> Any:
    return await _ask(call, "health/history", station_id=station_id)


async def sync_status(call: intercom_client.Call) -> Any:
    return await _ask(call, "sync/status")


async def conflicts_list(call: intercom_client.Call) -> Any:
    return await _ask(call, "conflicts/list")


async def fleet_alerts(call: intercom_client.Call, kind: str, include_suppressed: bool) -> Any:
    """All of them in one page (WisKey's own cap is 200; a fleet has a handful of stations x six kinds): paging, counts and
    the station filter are Arx's (count-leak guard)."""
    return await _ask(call, "fleet/alerts", offset=0, limit=SCAN_PAGE, station_id="", kind=kind, include_suppressed=include_suppressed)


async def audit_list(call: intercom_client.Call, filters: dict[str, Any]) -> Any:
    body = {k: filters[k] for k in AUDIT_FILTER_KEYS if filters.get(k) is not None}
    return await _ask(call, "audit/list", filters=body)


async def program_list(call: intercom_client.Call, station_id: str) -> Any:
    return await _ask(call, "stations/technical_program_list", station_id=station_id)


async def hold_get(call: intercom_client.Call, station_id: str, door: int) -> Any:
    return await _ask(call, "stations/technical_hold_get", station_id=station_id, door=door)


async def codes_get(call: intercom_client.Call, station_id: str) -> Any:
    return await _ask(call, "stations/technical_codes_get", station_id=station_id)


# ---------------------------------------------------------------- value rules (closed construction)

CODE = re.compile(r"[a-z0-9][a-z0-9_.:/-]{0,63}", re.IGNORECASE)
ID = re.compile(r"[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}")
HHMM = re.compile(r"(?:[01][0-9]|2[0-3]):[0-5][0-9]|24:00")
DAY = re.compile(r"\d{4}-\d{2}-\d{2}")
WEEKDAYS = ("Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday")
UNKNOWN = "unknown"


def _int(v: Any) -> int | None:
    return v if isinstance(v, int) and not isinstance(v, bool) else None


def _num(v: Any) -> int | float | None:
    return v if isinstance(v, (int, float)) and not isinstance(v, bool) else None


def _bool(v: Any) -> bool | None:
    return v if isinstance(v, bool) else None


def _text(v: Any, limit: int) -> str | None:
    """A string of at most `limit` characters without control characters, else None."""
    if not isinstance(v, str) or len(v) > limit or any(ord(c) < 32 for c in v):
        return None
    return v


def _iso(v: Any) -> str | None:
    return _text(v, 40)


def _id(v: Any) -> str | None:
    return v if isinstance(v, str) and ID.fullmatch(v) else None


def _code(v: Any) -> str | None:
    """A machine code (error, action, kind): kept when it looks like one, "other" when it is some other text (never echoed:
    free text from a device or an exception can carry a host or a name), None when absent."""
    if v is None:
        return None
    return v if isinstance(v, str) and CODE.fullmatch(v) else "other"


def _enum(v: Any, allowed: frozenset[str] | tuple[str, ...]) -> str | None:
    """A known enum value, UNKNOWN for any other value (a newer WisKey, schema drift), None when absent."""
    if v is None:
        return None
    return v if isinstance(v, str) and v in allowed else UNKNOWN


def _ids(v: Any, limit: int = 200) -> list[str]:
    return [x for x in (v if isinstance(v, list) else [])[:limit] if _id(x)]


def _periods(v: Any) -> list[dict[str, str]]:
    out = []
    for p in (v if isinstance(v, list) else [])[:16]:
        if isinstance(p, dict) and isinstance(p.get("start"), str) and isinstance(p.get("end"), str) and HHMM.fullmatch(p["start"]) and HHMM.fullmatch(p["end"]):
            out.append({"start": p["start"], "end": p["end"]})
    return out


def _weekly(v: Any) -> dict[str, list[dict[str, str]]]:
    raw = v if isinstance(v, dict) else {}
    return {day: _periods(raw.get(day)) for day in WEEKDAYS}


def _holidays(v: Any) -> list[dict[str, Any]]:
    out = []
    for h in (v if isinstance(v, list) else [])[:64]:
        if not isinstance(h, dict):
            continue
        start, end = h.get("start"), h.get("end")
        out.append({
            "name": _text(h.get("name"), 64),
            "start": start if isinstance(start, str) and DAY.fullmatch(start) else None,
            "end": end if isinstance(end, str) and DAY.fullmatch(end) else None,
            "periods": _periods(h.get("periods")),
        })
    return out


def _zone(v: Any) -> dict[str, Any] | None:
    if not isinstance(v, dict) or v.get("kind") not in ("iana", "device"):
        return None
    out = {"kind": v["kind"], "name": _text(v.get("name"), 64)}
    if v["kind"] == "device":
        out.update({k: _text(v.get(k), 64) if isinstance(v.get(k), str) else _num(v.get(k)) for k in ("standard", "delta", "start", "end")})
    return out


# ---------------------------------------------------------------- station supersets (from the feed's overview)

STATION_SYNC_STATES = intercom_sync.STATION_SYNC_STATES  # one list for the feed's copy and the adapter
CLOCK_SOURCES = frozenset({"manual", "device", "fallback"})
CLOCK_STATUSES = frozenset({"ready", "stale", "unavailable"})
TIME_MODES = frozenset({"NTP", "manual", "satellite", "platform", "NONE", "GB28181", "unknown"})
DRIFT_STATES = frozenset({"not_measured", "within_tolerance", "uncertain", "ahead", "behind", "repeated_ahead", "repeated_behind"})
STREAM_STATES = frozenset({"connecting", "connected", "disconnected", "authentication_failed", "unavailable", "stopped"})
HISTORY_STATES = frozenset({"pending", "offline", "unavailable", "recovered", "authentication_failed", "incomplete"})
PIN_MODES = frozenset({"local", "platform", "unknown"})
CAPABILITY_INTS = ("max_users", "max_cards", "cards_per_person", "pin_min", "pin_max", "card_min", "card_max", "name_max")


def project_station_technical(raw: dict[str, Any]) -> dict[str, Any]:
    """The technical part of one overview station (`access.stations.read`; the error texts under the sync-error rule). Never
    the host, the station's other entity ids, observations, people counts or `last_access`."""
    caps = raw.get("capabilities") if isinstance(raw.get("capabilities"), dict) else None
    clock = raw.get("clock") if isinstance(raw.get("clock"), dict) else None
    status = raw.get("event_status") if isinstance(raw.get("event_status"), dict) else None
    return {
        "loaded": _bool(raw.get("loaded")),
        "last_error": _code(raw.get("last_error")),
        "scan_error": _code(raw.get("scan_error")),
        "model": _text(raw.get("model"), 64),
        "firmware": _text(raw.get("firmware"), 96),
        "capabilities": None if caps is None else {
            **{k: _int(caps.get(k)) for k in CAPABILITY_INTS},
            "pin_mode": _enum(caps.get("pin_mode"), PIN_MODES),
            "pin_writable": _bool(caps.get("pin_writable")),
            "schedules": _bool(caps.get("schedules")),
        },
        "clock": None if clock is None else {
            "source": _enum(clock.get("source"), CLOCK_SOURCES),
            "status": _enum(clock.get("status"), CLOCK_STATUSES),
            "zone": _zone(clock.get("zone")),
            "device_zone": _zone(clock.get("device_zone")),
            "skew_seconds": _num(clock.get("skew_seconds")),
            "time_mode": _enum(clock.get("time_mode"), TIME_MODES),
            "drift_state": _enum(clock.get("drift_state"), DRIFT_STATES),
            "checked_at": _iso(clock.get("checked_at")),
            "error": _code(clock.get("error")),
        },
        "event_status": None if status is None else {
            "stream": _enum(status.get("stream"), STREAM_STATES),
            "history": _enum(status.get("history"), HISTORY_STATES),
            "reconnects": _int(status.get("reconnects")),
            "last_frame_at": _iso(status.get("last_frame_at")),
            "recovered_until": _iso(status.get("recovered_until")),
        },
        "scanned_at": _iso(raw.get("scanned_at")),
        "scanning": _bool(raw.get("scanning")),
        "reconciled_at": _iso(raw.get("reconciled_at")),
        "last_poll_ms": _num(raw.get("last_poll_ms")),
    }


def project_api(raw: Any) -> dict[str, Any] | None:
    """The overview's `api` block: what the feature flags need, nothing else."""
    if not isinstance(raw, dict):
        return None
    commands = raw.get("commands")
    return {
        "version": _int(raw.get("version")),
        "min_client": _int(raw.get("min_client")),
        "commands": frozenset(c for c in commands if isinstance(c, str)) if isinstance(commands, list) else None,
    }


# ---------------------------------------------------------------- people

ACCESS_CATEGORIES = frozenset({"staff", "visitor", "contractor"})
USER_TYPES = frozenset({"normal"})
ASSIGNMENT_SYNC_STATES = frozenset({"synced", "pending", "syncing", "offline", "conflict", "error", "delete_pending"})
TIMING_MODES = frozenset({"weekly", "dates"})
ENFORCEMENT_MODES = frozenset({"ha", "native"})
PEOPLE_STATES = ("active", "inactive", "expired", "upcoming", "archived")
PEOPLE_RIGHTS = ("assigned", "unassigned", "disabled")
PEOPLE_SORTS = ("name", "name_desc", "employee")


def _timing(raw: dict[str, Any]) -> dict[str, Any] | None:
    """The person's access timing as the person page shows it (validity / timing view; editing is the write phase's)."""
    policy = raw.get("access_timing_policy") if isinstance(raw.get("access_timing_policy"), dict) else None
    draft = raw.get("access_timing_draft") if isinstance(raw.get("access_timing_draft"), dict) else None
    schedule = policy.get("schedule") if policy and isinstance(policy.get("schedule"), dict) else draft
    if schedule is None:
        return None
    return {
        "mode": _enum(schedule.get("mode"), TIMING_MODES),
        "timezone": _text(schedule.get("timezone"), 64),
        "days": [d for d in (schedule.get("days") if isinstance(schedule.get("days"), list) else [])[:7] if isinstance(d, str) and len(d) <= 16],
        "dates": [d for d in (schedule.get("dates") if isinstance(schedule.get("dates"), list) else [])[:366] if isinstance(d, str) and DAY.fullmatch(d)],
        "periods": _periods(schedule.get("periods")),
        "enforcement": _enum(policy.get("mode"), ENFORCEMENT_MODES) if policy else None,
    }


def _credentials(raw: dict[str, Any], redacted: set[str]) -> dict[str, Any] | None:
    """The KINDS of credential a person has, never a value (CR-036 S7; owner answer 2 of 2026-10-12: credentials are a sensitive
    field level): whether a PIN is set and how many enabled cards there are. No card number, no mask, no label, no PIN. None =
    unknown (WisKey redacted the category, or sent neither fact) - never "has none"."""
    if "credentials" in redacted:
        return None
    cards = raw.get("cards")
    count = sum(1 for c in cards[:50] if isinstance(c, dict) and c.get("enabled") is True) if isinstance(cards, list) else None
    pin = _bool(raw.get("pin_configured"))
    return None if pin is None and count is None else {"pin": pin, "cards": count}


def project_person(raw: Any) -> dict[str, Any] | None:
    """One WisKey person (`users/query` record, `users/get`) as a closed superset, or None when it has no usable id. Not kept:
    card numbers / masks / labels, the PIN itself, the permission override values (only their stations, `override_stations`, for
    the write gate), timing read-backs, sync references, created / updated (the credential KINDS are kept as `credentials`, S7). A category WisKey redacted (`redacted_fields`) is unknown (null),
    never "empty"."""
    if not isinstance(raw, dict) or not _id(raw.get("id")):
        return None
    redacted = {f for f in (raw.get("redacted_fields") or []) if isinstance(f, str)} if isinstance(raw.get("redacted_fields"), list) else set()
    # R4-09: the SAME completeness reading as intercom_sync.person_scope (and the grant engine's person_from_raw): a record projected for a
    # restricted caller (`redacted_fields` or `operator_editable` present - even empty / true) may hold a station-filtered assignments
    # map, so `stations_known` is false and an empty list is "not shown", never "no stations". A malformed marker blocks everything.
    scope = intercom_sync.person_scope(raw)
    if scope["redacted_fields"] is None:
        redacted |= {"access", "credentials", "phone", "photo", "profile"}
    if not scope["access_readable"]:  # a field name (`assignments`, `group_ids` ...) withholds the access category too
        redacted.add("access")
    if redacted & intercom_sync.CREDENTIAL_REDACTION:
        redacted.add("credentials")
    assignments: list[dict[str, Any]] | None = None
    if "access" not in redacted and isinstance(raw.get("assignments"), dict):
        assignments = []
        for sid, a in sorted(raw["assignments"].items()):
            if not isinstance(a, dict) or not ia.valid_id(sid):
                continue
            assignments.append({
                "station_id": sid,
                "enabled": bool(a.get("enabled")),
                "doors": sorted({d for d in (a.get("allowed_locks") or []) if _int(d) in (1, 2)}),
                "sync_state": _enum(a.get("sync_state"), ASSIGNMENT_SYNC_STATES),
                "last_sync_at": _iso(a.get("last_sync_at")),
                "last_error": _code(a.get("last_error")),
            })
    profile = raw.get("profile") if isinstance(raw.get("profile"), dict) else None
    # PERMOVR-293 (WisKey Q2): the STATIONS of the person's own permission overrides (allow AND deny - never the values), for the write
    # gate (intercom_authority.person_gate_station_ids). None = unknown: withheld, missing, not a map, or any entry malformed (fail
    # closed - a malformed entry is never skipped, so it cannot shrink the set).
    raw_overrides = raw.get("permission_overrides")
    override_stations: list[str] | None = None
    if "access" not in redacted and isinstance(raw_overrides, dict) and all(ia.valid_id(k) and v in ("allow", "deny") for k, v in raw_overrides.items()):
        override_stations = sorted(raw_overrides)
    return {
        "id": raw["id"],
        "display_name": _text(raw.get("display_name"), 128) or "",
        "employee_no": _text(raw.get("employee_no"), 64),
        "active": bool(raw.get("active")),
        "archived": raw.get("archived_at") is not None,
        "valid_from": None if "access" in redacted else _iso(raw.get("valid_from")),
        "valid_until": None if "access" in redacted else _iso(raw.get("valid_until")),
        "revision": _int(raw.get("revision")),
        "access_category": None if "access" in redacted else _enum(raw.get("access_category"), ACCESS_CATEGORIES),
        "user_type": _enum(raw.get("user_type"), USER_TYPES),
        "identity_locked": bool(raw.get("identity_locked")),
        "group_ids": None if "access" in redacted else _ids(raw.get("group_ids"), 64),
        "assignments": assignments,
        "override_stations": override_stations,
        "access_known": scope["access_known"] and assignments is not None,
        "stations_known": scope["stations_known"] and assignments is not None,
        "redacted_fields": scope["redacted_fields"],
        "timing": None if "access" in redacted else _timing(raw),
        "operator_editable": _bool(raw.get("operator_editable")),
        "phone": None if "phone" in redacted else _text(raw.get("phone"), 32),
        "phone_set": None if "phone" in redacted else isinstance(raw.get("phone"), str) and bool(raw["phone"].strip()),
        "credentials": _credentials(raw, redacted),
        "photo_configured": None if "photo" in redacted else _bool(raw.get("photo_configured")),
        "profile": None if "profile" in redacted or profile is None else {k: v for k, v in list(profile.items())[:32] if _id(k) and isinstance(v, str) and len(v) <= 100},
        "responsible_person": None if "access" in redacted else _text(raw.get("responsible_person"), 64),
        "access_purpose": None if "access" in redacted else _text(raw.get("access_purpose"), 128),
    }


def project_one_person(raw: Any) -> dict[str, Any]:
    """`users/get`: one person, or ValueError - an answer that is not a person record is WisKey's error (invalid_response)."""
    person = project_person(raw)
    if person is None:
        raise ValueError("unexpected users/get answer")
    return person


def credential_matches(person: dict[str, Any], wanted: str) -> bool:
    """WisKey's `credential` filter (user_directory.py): `pin` = a PIN is set, `no_pin` = none is, `card` = at least one enabled
    card, `no_card` = none. A person whose credentials are unknown matches none of them (unknown is not "has none")."""
    credentials = person.get("credentials")
    if not isinstance(credentials, dict):
        return False
    pin, cards = credentials.get("pin"), credentials.get("cards")
    if wanted == "pin":
        return pin is True
    if wanted == "no_pin":
        return pin is False
    if wanted == "card":
        return isinstance(cards, int) and cards > 0
    if wanted == "no_card":
        return cards == 0
    return False


def profile_matches(person: dict[str, Any], wanted: dict[str, str]) -> bool:
    """WisKey's `profile` filter: every named profile field equals the given value (exact, as WisKey compares)."""
    profile = person.get("profile")
    return isinstance(profile, dict) and all(profile.get(k) == v for k, v in wanted.items())


def field_filters_match(person: dict[str, Any], filters: dict[str, Any]) -> bool:
    """The field filters of a request against one superset person (Arx's own check, used where Arx scans, and as the belt and
    braces over a page WisKey filtered)."""
    if filters.get("credential") is not None and not credential_matches(person, filters["credential"]):
        return False
    if filters.get("profile") and not profile_matches(person, filters["profile"]):
        return False
    return True


def has_field_filters(filters: dict[str, Any]) -> bool:
    """Whether a request carries a field filter (`credential` / `profile`). Such a request is only ever answered from people the
    caller sees AT THE SENSITIVE LEVEL - the filter must never separate people by a value the caller cannot read - and WisKey
    is asked to apply it for the page itself only when every person the caller can meet is at that level."""
    return filters.get("credential") is not None or bool(filters.get("profile"))


def person_matches(auth: ia.Authority, person: dict[str, Any], level: str, needle: str) -> bool:
    """Arx's own people search (D1): a case-insensitive substring of the name, and of the employee number when THIS
    principal sees it on this person (answer 2 of 2026-10-12, unless the administrator made it sensitive) - so a value the
    caller cannot see is never what matched."""
    hay = person.get("display_name") or ""
    if auth.employee_no_for(level) and person.get("employee_no"):
        hay = f"{hay} {person['employee_no']}"
    return needle in hay.casefold()


# ---------------------------------------------------------------- events

EVENT_TYPES = frozenset({"access_denied", "access_granted", "attempt_limit", "contact_closed", "contact_open", "door_locked", "door_not_closed",
                         "door_not_opened", "door_unlocked", "unknown", "unlock_exception", "unlock_record", "ring"})
FILTERABLE_EVENT_TYPES = tuple(sorted(EVENT_TYPES - {"ring"}))  # WisKey's KINDS; "ring" rows exist but cannot be filtered
TIME_SOURCES = frozenset({"device", "received"})
AUTHENTICATIONS = frozenset({"card", "pin", "unknown"})
RESULTS = frozenset({"granted", "denied", "unknown"})
IDENTITY_STATES = frozenset({"identified", "id_only", "identity_unavailable"})
ORIGINS = frozenset({"history_query", "call_poll", "device_time_missing", "device_time_ahead", "delayed_stream", "device_not_current", "live_stream"})
SOURCE_FIELD_STATES = frozenset({"missing", "empty", "provided", "invalid_type"})
TIME_INTERPRETATIONS = frozenset({"verified_device_zone", "source_timestamp"})


def project_event(raw: Any) -> dict[str, Any] | None:
    """One access event (an `events/list` row or `events/detail`'s `record`) as a closed superset, or None without a usable
    id. Not kept: the masked card, major / minor, the ISAPI door, `source`, `person_link`. `portrait_ref` (the person a
    picture belongs to) stays INSIDE the adapter: views expose only whether there is one."""
    if not isinstance(raw, dict) or not _id(raw.get("id")):
        return None
    portrait = raw.get("portrait") if isinstance(raw.get("portrait"), dict) else None
    door = _int(raw.get("door"))
    return {
        "id": raw["id"],
        "station_id": raw.get("station_id") if ia.valid_id(raw.get("station_id")) else None,
        "timestamp": _iso(raw.get("timestamp")),
        "received_at": _iso(raw.get("received_at")),
        "time_source": _enum(raw.get("time_source"), TIME_SOURCES),
        "person_name": _text(raw.get("person_name"), 128),
        "employee_no": _text(raw.get("employee_no"), 64),
        "authentication": _enum(raw.get("authentication"), AUTHENTICATIONS) or UNKNOWN,
        "result": _enum(raw.get("result"), RESULTS) or UNKNOWN,
        "event_type": _enum(raw.get("event_type"), EVENT_TYPES) or UNKNOWN,
        "recovered": bool(raw.get("recovered")),
        "door": door if door in (1, 2) else None,
        "portrait_ref": {"user_id": portrait["user_id"], "revision": _int(portrait.get("revision"))} if portrait and _id(portrait.get("user_id")) else None,
    }


def project_event_detail(raw: Any) -> dict[str, Any]:
    """`events/detail`: the record plus WisKey's evidence (how the identity and the time were established - flags, no
    person field). It has no portrait (rc.37): the picture is a reference on the list row."""
    if not isinstance(raw, dict):
        raise ValueError("unexpected events/detail answer")
    event = project_event(raw.get("record"))
    if event is None:
        raise ValueError("events/detail without a record")
    evidence = raw.get("evidence") if isinstance(raw.get("evidence"), dict) else None
    source = raw.get("source_identity") if isinstance(raw.get("source_identity"), dict) else None
    fields = source.get("source_fields") if source and isinstance(source.get("source_fields"), dict) else {}
    event["evidence"] = None if evidence is None else {
        "identity_state": _enum(evidence.get("identity_state"), IDENTITY_STATES),
        "origin": _enum(evidence.get("origin"), ORIGINS),
        "arrival_delay_seconds": _num(evidence.get("arrival_delay_seconds")),
        "time_source": _enum(evidence.get("time_source"), TIME_SOURCES),
        "live_automation": _bool(evidence.get("live_automation")),
    }
    event["source_identity"] = None if source is None else {
        "source_fields": {k: _enum(fields.get(k), SOURCE_FIELD_STATES) for k in ("employeeNoString", "employeeNo", "name")},
        "normalized": _bool(source.get("normalized")),
        "time_interpretation": _enum(source.get("time_interpretation"), TIME_INTERPRETATIONS),
        "central_name_resolved": _bool(source.get("central_name_resolved")),
    }
    return event


def _event_stations(raw: Any) -> dict[str, dict[str, Any]]:
    stations = raw if isinstance(raw, dict) else {}
    return {
        sid: {"stream": _enum(st.get("stream"), STREAM_STATES), "history": _enum(st.get("history"), HISTORY_STATES)}
        for sid, st in stations.items()
        if ia.valid_id(sid) and isinstance(st, dict)
    }


def project_event_page(raw: Any) -> dict[str, Any]:
    if not isinstance(raw, dict):
        raise ValueError("unexpected events/list answer")
    records = raw.get("records")
    if records is not None and not isinstance(records, list):
        raise ValueError("unexpected events/list records")
    return {
        "records": [e for r in records or [] if (e := project_event(r)) is not None],
        "next": raw.get("next") if _id(raw.get("next")) else None,
        "retention_days": _int(raw.get("retention_days")),
        "capacity": _int(raw.get("capacity")),
        "membership_basis": _code(raw.get("membership_basis")),
        "storage_failed": bool(raw.get("storage_failed")),
        "stations": _event_stations(raw.get("stations")),
    }


# ---------------------------------------------------------------- groups and profile fields

FIELD_TYPES = frozenset({"text", "select", "number", "date"})
VERSION_ACTIONS = frozenset({"baseline", "system", "profiles/settings_update", "bulk/group_policy", "platform/lifecycle_apply"})


def project_groups(raw: Any) -> dict[str, Any]:
    """`profiles/settings_get`: groups (with the stations each one grants) and the custom field definitions. Templates are
    dropped (they carry default profile VALUES)."""
    if not isinstance(raw, dict):
        raise ValueError("unexpected profiles/settings_get answer")
    groups = []
    for g in (raw.get("groups") if isinstance(raw.get("groups"), list) else [])[:64]:
        if isinstance(g, dict) and _id(g.get("id")):
            groups.append({
                "id": g["id"], "label": _text(g.get("label"), 64) or g["id"], "enabled": bool(g.get("enabled")),
                "station_ids": [s for s in g["station_ids"][:100] if ia.valid_id(s)] if isinstance(g.get("station_ids"), list) else None,
            })
    fields = []
    for f in (raw.get("fields") if isinstance(raw.get("fields"), list) else [])[:12]:
        if isinstance(f, dict) and _id(f.get("id")):
            dep = f.get("depends_on") if isinstance(f.get("depends_on"), dict) else None
            fields.append({
                "id": f["id"], "label": _text(f.get("label"), 64) or f["id"], "enabled": bool(f.get("enabled")),
                "type": _enum(f.get("type"), FIELD_TYPES), "required": bool(f.get("required")), "unique": bool(f.get("unique")),
                "options": [o for o in (f.get("options") if isinstance(f.get("options"), list) else [])[:100] if isinstance(o, str) and len(o) <= 100],
                "depends_on": {"field_id": dep.get("field_id"), "value": _text(dep.get("value"), 100)} if dep and _id(dep.get("field_id")) else None,
            })
    return {"revision": _int(raw.get("revision")), "photo_enabled": bool(raw.get("photo_enabled")), "groups": groups, "fields": fields}


def project_versions(raw: Any) -> dict[str, Any]:
    """`profiles/versions`: the policy history without the actor (an HA user id)."""
    if not isinstance(raw, dict):
        raise ValueError("unexpected profiles/versions answer")
    return {
        "records": [
            {"revision": _int(r.get("revision")), "saved_at": _iso(r.get("saved_at")), "action": _enum(r.get("action"), VERSION_ACTIONS),
             "origin": _enum(r.get("origin"), ("baseline", "saved")), "field_changes": _int(r.get("field_changes")), "group_changes": _int(r.get("group_changes"))}
            for r in (raw.get("records") if isinstance(raw.get("records"), list) else [])[:50] if isinstance(r, dict)
        ],
        **{k: _int(raw.get(k)) for k in ("total", "offset", "next_offset", "previous_offset", "current_revision", "retained_from_revision")},
    }


# ---------------------------------------------------------------- schedules, programs, hold, codes (shapes: W? until W2)

PLAN_SOURCE_STATES = frozenset({"current", "changed", "missing", "unavailable"})
RESOURCE_KINDS = frozenset({"template", "weekly", "holiday_group", "holiday"})
COVERAGES = frozenset({"complete", "partial", "failed", "unsupported", "not_checked"})
RESOURCE_STATES = frozenset({"matches", "different", "not_observed", "unreadable", "unsupported"})
JOB_STATUSES = frozenset({"pending", "queued", "checking", "blocked", "ready", "interrupted", "failed", "cancelled", "verified"})
OWNERSHIP = frozenset({"not_checked", "missing", "current", "changed"})
JOURNAL_STATUSES = frozenset({"ready", "recovery_required", "conflict", "verified"})
STEP_STATES = frozenset({"pending", "intent", "verified"})
EXECUTION_STATUSES = frozenset({"idle", "opening", "held_acknowledged", "restoring", "unknown"})
PUBLIC_PIN_STATES = frozenset({"configured", "absent", "unknown"})


def _schedule_policy(v: Any) -> dict[str, Any] | None:
    if not isinstance(v, dict):
        return None
    schedule = v.get("schedule") if isinstance(v.get("schedule"), dict) else {}
    return {"timezone": _text(v.get("timezone"), 64), "name": _text(schedule.get("name"), 64), "weekly": _weekly(schedule.get("weekly")), "holidays": _holidays(schedule.get("holidays"))}


def project_schedule_library(raw: Any) -> list[dict[str, Any]]:
    if not isinstance(raw, list):
        raise ValueError("unexpected schedules/list answer")
    return [
        {"id": s["id"], "revision": _int(s.get("revision")), "updated_at": _iso(s.get("updated_at")), "name": _text(s.get("name"), 64),
         "weekly": _weekly(s.get("weekly")), "holidays": _holidays(s.get("holidays"))}
        for s in raw[:100] if isinstance(s, dict) and _id(s.get("id"))
    ]


def project_schedule_plans(raw: Any) -> list[dict[str, Any]]:
    if not isinstance(raw, list):
        raise ValueError("unexpected schedules/plan_list answer")
    out = []
    for p in raw[:32]:
        if not isinstance(p, dict) or not _id(p.get("id")):
            continue
        report = p.get("report") if isinstance(p.get("report"), dict) else None
        users = report.get("users") if report and isinstance(report.get("users"), dict) else None
        out.append({
            "id": p["id"], "revision": _int(p.get("revision")), "station_id": p.get("station_id") if ia.valid_id(p.get("station_id")) else None,
            # CR-036 S9: the library schedule (draft) the proposal was prepared from and its revision then - ids only, so the schedules
            # screen can say which stations a library schedule was proposed for and whether the proposal still matches it
            "draft_id": _id(p.get("draft_id")), "draft_revision": _int(p.get("draft_revision")),
            "name": _text(p.get("name"), 64), "created_at": _iso(p.get("created_at")),
            "source_state": _enum(p.get("source_state"), PLAN_SOURCE_STATES), "can_apply": bool(p.get("can_apply")),
            "drifted_resources": [_code(r) for r in (p.get("drifted_resources") if isinstance(p.get("drifted_resources"), list) else [])[:64]],
            "report": None if report is None else {
                "checked_at": _iso(report.get("checked_at")),
                "blockers": [_code(b) for b in (report.get("blockers") if isinstance(report.get("blockers"), list) else [])[:32]],
                "resources": [
                    {"kind": _enum(r.get("kind"), RESOURCE_KINDS), "id": _int(r.get("id")), "coverage": _enum(r.get("coverage"), COVERAGES),
                     "state": _enum(r.get("state"), RESOURCE_STATES), "active": _bool(r.get("active"))}
                    for r in (report.get("resources") if isinstance(report.get("resources"), list) else [])[:128] if isinstance(r, dict)
                ],
                # the device-user counts of the report are people counts of a station: not kept (D-006 spirit)
                "users": None if users is None else {"state": _enum(users.get("state"), ("complete", "failed")), "error": _code(users.get("error"))},
            },
        })
    return out


def _job(j: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": j["id"], "revision": _int(j.get("revision")), "plan_id": _id(j.get("plan_id")), "station_id": j.get("station_id") if ia.valid_id(j.get("station_id")) else None,
        "name": _text(j.get("name"), 64), "status": _enum(j.get("status"), JOB_STATUSES), "error": _code(j.get("error")),
        "blockers": [_code(b) for b in (j.get("blockers") if isinstance(j.get("blockers"), list) else [])[:32]],
        "ownership": _enum(j.get("ownership"), OWNERSHIP), "created_at": _iso(j.get("created_at")), "updated_at": _iso(j.get("updated_at")),
    }


def project_schedule_operations(raw: Any) -> dict[str, Any]:
    if not isinstance(raw, dict):
        raise ValueError("unexpected schedules/operations_list answer")

    def jobs(key: str) -> list[dict[str, Any]]:
        return [_job(j) for j in (raw.get(key) if isinstance(raw.get(key), list) else [])[:200] if isinstance(j, dict) and _id(j.get("id"))]

    return {
        "jobs": jobs("jobs"),
        "archive": jobs("archive"),
        "journal": [
            {"id": e["id"], "status": _enum(e.get("status"), JOURNAL_STATUSES), "issue": _code(e.get("issue")), "created_at": _iso(e.get("created_at")),
             "updated_at": _iso(e.get("updated_at")),
             "steps": [{"key": _code(s.get("key")), "state": _enum(s.get("state"), STEP_STATES), "attempted": bool(s.get("attempted"))}
                       for s in (e.get("steps") if isinstance(e.get("steps"), list) else [])[:64] if isinstance(s, dict)]}
            for e in (raw.get("journal") if isinstance(raw.get("journal"), list) else [])[:200] if isinstance(e, dict) and _id(e.get("id"))
        ],
        "claims": [
            {"id": c["id"], "plan_id": _id(c.get("plan_id")), "station_id": c.get("station_id") if ia.valid_id(c.get("station_id")) else None, "created_at": _iso(c.get("created_at"))}
            for c in (raw.get("claims") if isinstance(raw.get("claims"), list) else [])[:200] if isinstance(c, dict) and _id(c.get("id"))
        ],
        "writes_enabled": bool(raw.get("writes_enabled")),
    }


def project_programs(raw: Any) -> dict[str, Any]:
    """`stations/technical_program_list`: the door programs (hold-open on the device) and the saved drafts. The api door id
    is dropped (the relay is `door`, the physical index)."""
    if not isinstance(raw, dict):
        raise ValueError("unexpected technical_program_list answer")

    def door(v: Any) -> int | None:
        return v if _int(v) in (1, 2) else None

    programs = []
    for p in (raw.get("programs") if isinstance(raw.get("programs"), list) else [])[:8]:
        if not isinstance(p, dict):
            continue
        execution = p.get("execution") if isinstance(p.get("execution"), dict) else {}
        attempted = execution.get("attempted")
        programs.append({
            "door": door(p.get("door")), "revision": _int(p.get("revision")), "enabled": bool(p.get("enabled")), "removing": bool(p.get("removing")),
            "policy": _schedule_policy(p.get("policy")),
            "execution": {"owned": bool(execution.get("owned")), "attempted": attempted if isinstance(attempted, str) and len(attempted) <= 32 else None,
                          "status": _enum(execution.get("status"), EXECUTION_STATUSES)},
            "error": _code(p.get("error")), "checked_at": _iso(p.get("checked_at")),
        })
    saved = [
        {"door": door(s.get("door")), "revision": _int(s.get("revision")), "policy": _schedule_policy(s.get("policy"))}
        for s in (raw.get("saved") if isinstance(raw.get("saved"), list) else [])[:8] if isinstance(s, dict)
    ]
    return {"programs": programs, "saved": saved, "timezone": _text(raw.get("timezone"), 64), "native_supported": bool(raw.get("native_supported"))}


def project_hold(raw: Any) -> dict[str, Any]:
    if not isinstance(raw, dict):
        raise ValueError("unexpected technical_hold_get answer")
    draft = raw.get("draft") if isinstance(raw.get("draft"), dict) else None
    return {
        "draft": None if draft is None else {"door": draft.get("door") if _int(draft.get("door")) in (1, 2) else None, "revision": _int(draft.get("revision")),
                                             "policy": _schedule_policy(draft.get("policy"))},
        "active": bool(raw.get("active")), "blocker": _code(raw.get("blocker")), "timezone": _text(raw.get("timezone"), 64),
    }


def project_codes(raw: Any) -> dict[str, Any]:
    """`stations/technical_codes_get` reduced to what the screen shows: whether a public door code is set, per public slot.
    The privileged passwords' presence (engineering, alarm setup, householder, anti-hijacking, card sending) is not kept,
    and no value is ever kept: WisKey sends presence booleans only (rc.37 client/technical.py), and a non-boolean is read as
    unknown, never passed on."""
    if not isinstance(raw, dict):
        raise ValueError("unexpected technical_codes_get answer")
    status = raw.get("status") if isinstance(raw.get("status"), dict) else {}
    states = status.get("states") if isinstance(status.get("states"), dict) else {}
    caps = raw.get("capabilities") if isinstance(raw.get("capabilities"), dict) else {}
    slots = sorted({s for s in (caps.get("slots") if isinstance(caps.get("slots"), list) else []) if _int(s) is not None and 1 <= s <= 16})
    return {
        "public_pin_state": _enum(status.get("public_pin_state"), PUBLIC_PIN_STATES),
        "slots": [{"slot": s, "configured": _bool(states.get(f"public{s}Configured"))} for s in slots],
        "capabilities": {"advertised": _bool(caps.get("advertised")), "min": _int(caps.get("min")), "max": _int(caps.get("max"))},
        "checked_at": _iso(status.get("checked_at")),
    }


# ---------------------------------------------------------------- health, sync, alerts, audit

HEALTH_SYNC = frozenset({"synced", "pending", "syncing", "offline", "conflict", "error", "delete_pending", "unknown"})
ALERT_KINDS = ("offline", "sync_stalled", "sync_conflict", "sync_error", "event_gap", "clock_drift")
SUPPRESSION_KINDS = frozenset({*ALERT_KINDS, "maintenance"})
SUPPRESSION_REASONS = frozenset({"planned_maintenance", "network_work", "investigating"})
OPERATION_STATES = ("pending", "failed", "verified", "settled")


def project_health(raw: Any) -> dict[str, Any]:
    """`health/get` reduced to the status page's station card. Not kept: the sync diagnostics (`user_ref` is a pseudonym
    WisKey's sync status can join back to a person), people / card counts, audio results, the hard-coded model."""
    if not isinstance(raw, dict):
        raise ValueError("unexpected health/get answer")
    requests = raw.get("requests") if isinstance(raw.get("requests"), dict) else {}
    access = raw.get("access") if isinstance(raw.get("access"), dict) else {}
    events = raw.get("events") if isinstance(raw.get("events"), dict) else None
    clock = raw.get("clock") if isinstance(raw.get("clock"), dict) else None
    states = access.get("assignment_states") if isinstance(access.get("assignment_states"), dict) else {}
    errors = access.get("errors") if isinstance(access.get("errors"), dict) else {}
    return {
        "loaded": _bool(raw.get("loaded")), "online": _bool(raw.get("online")), "firmware": _text(raw.get("firmware"), 96),
        "consecutive_poll_failures": _int(raw.get("consecutive_poll_failures")),
        "requests": {k: _num(requests.get(k)) for k in ("requests", "failures", "last_ms", "p95_ms")},
        "access": {
            "sync_state": _enum(access.get("sync_state"), HEALTH_SYNC), "last_error": _code(access.get("last_error")),
            "pending_request": _bool(access.get("pending_request")), "worker_active": _bool(access.get("worker_active")), "queue_depth": _int(access.get("queue_depth")),
            "assignment_states": {k: v for k, v in states.items() if k in ASSIGNMENT_SYNC_STATES and _int(v) is not None},
            "errors": {k: v for k, v in list(errors.items())[:32] if CODE.fullmatch(str(k)) and _int(v) is not None},
        },
        "events": None if events is None else {
            "stream": _enum(events.get("stream"), STREAM_STATES), "history": _enum(events.get("history"), HISTORY_STATES), "reconnects": _int(events.get("reconnects")),
            "last_frame_at": _iso(events.get("last_frame_at")), "storage_failed": _bool(events.get("storage_failed")),
        },
        "clock": None if clock is None else {
            "status": _enum(clock.get("status"), CLOCK_STATUSES), "skew_seconds": _num(clock.get("skew_seconds")), "drift_state": _enum(clock.get("drift_state"), DRIFT_STATES),
            "time_mode": _enum(clock.get("time_mode"), TIME_MODES), "checked_at": _iso(clock.get("checked_at")), "error": _code(clock.get("error")),
        },
        "generated_at": _iso(raw.get("generated_at")),
    }


def project_health_history(raw: Any) -> dict[str, Any]:
    if not isinstance(raw, dict):
        raise ValueError("unexpected health/history answer")
    return {
        "period_days": _int(raw.get("period_days")),
        "records": [
            {"at": _iso(r.get("at")), "online": _bool(r.get("online")), "poll_ms": _num(r.get("poll_ms")), "sync": _enum(r.get("sync"), HEALTH_SYNC), "events": _code(r.get("events"))}
            for r in (raw.get("records") if isinstance(raw.get("records"), list) else [])[:2100] if isinstance(r, dict)
        ],
        "storage_failed": bool(raw.get("storage_failed")),
    }


def _pending_at(items: Any, sid: str) -> int:
    """How many removal / tombstone entries still wait for station `sid` (in its targets, not confirmed)."""
    n = 0
    for item in items if isinstance(items, list) else []:
        if isinstance(item, dict) and sid in (item.get("targets") or []) and sid not in (item.get("confirmed") or []):
            n += 1
    return n


def project_sync_status(raw: Any) -> dict[str, Any]:
    """`sync/status` (WisKey's full overview: every person, every removal) reduced to PER-STATION counts, person-free. The
    arrays themselves (people, operations, revocations, card / PIN removals, tombstones) are read for counting and dropped."""
    if not isinstance(raw, dict):
        raise ValueError("unexpected sync/status answer")
    operations = raw.get("sync_operations") if isinstance(raw.get("sync_operations"), list) else []
    revocations = raw.get("revocations") if isinstance(raw.get("revocations"), list) else []
    stations = []
    for s in raw.get("stations") or []:
        if not isinstance(s, dict) or not ia.valid_id(s.get("id")):
            continue
        sid = s["id"]
        ops = {state: sum(1 for o in operations if isinstance(o, dict) and o.get("station_id") == sid and o.get("state") == state) for state in OPERATION_STATES}
        stations.append({
            "station_id": sid, "name": _text(s.get("name"), 128) or "", "sync_state": _enum(s.get("sync_state"), STATION_SYNC_STATES),
            "last_error": _code(s.get("last_error")), "reconciled_at": _iso(s.get("reconciled_at")),
            "pending_users": _int(s.get("pending_user_count")), "managed_users": _int(s.get("managed_user_count")),
            "operations": ops,
            "revocations_pending": sum(1 for r in revocations if isinstance(r, dict) and r.get("station_id") == sid and r.get("sync_state") != "synced"),
            "card_removals_pending": _pending_at(raw.get("card_removals"), sid),
            "pin_removals_pending": _pending_at(raw.get("pin_removals"), sid),
            "deletions_pending": _pending_at(raw.get("tombstones"), sid),
        })
    return {"stations": stations}


def project_conflicts(raw: Any) -> list[dict[str, Any]]:
    """`conflicts/list` as one row per (person or removal, station) in conflict / error. Person data: kept for the view
    (names under access.people.read on the station; never cached)."""
    if not isinstance(raw, dict):
        raise ValueError("unexpected conflicts/list answer")
    rows: list[dict[str, Any]] = []
    for u in raw.get("users") or []:
        person = project_person(u)
        if person is None:
            continue
        for a in person["assignments"] or []:
            if a["sync_state"] in ("conflict", "error"):
                rows.append({"kind": "person", "station_id": a["station_id"], "sync_state": a["sync_state"], "last_error": a["last_error"],
                             "person": {"id": person["id"], "display_name": person["display_name"], "employee_no": person["employee_no"]}})
    for t in raw.get("tombstones") or []:
        if not isinstance(t, dict) or not _id(t.get("user_id")):
            continue
        per = t.get("stations") if isinstance(t.get("stations"), dict) else {}
        for sid, st in per.items():
            if ia.valid_id(sid) and isinstance(st, dict) and st.get("sync_state") in ("conflict", "error"):
                rows.append({"kind": "removal", "station_id": sid, "sync_state": st["sync_state"], "last_error": _code(st.get("last_error")),
                             "person": {"id": t["user_id"], "display_name": None, "employee_no": _text(t.get("employee_no"), 64)}})
    for r in raw.get("revocations") or []:
        if isinstance(r, dict) and ia.valid_id(r.get("station_id")) and _id(r.get("user_id")):
            rows.append({"kind": "revocation", "station_id": r["station_id"], "sync_state": _enum(r.get("sync_state"), ASSIGNMENT_SYNC_STATES),
                         "last_error": _code(r.get("last_error")), "person": {"id": r["user_id"], "display_name": None, "employee_no": None}})
    return rows


def project_alerts(raw: Any) -> dict[str, Any]:
    """`fleet/alerts`: the items and thresholds. Not kept: WisKey's totals (recounted over what the caller sees) and the
    suppressing operator's HA id."""
    if not isinstance(raw, dict):
        raise ValueError("unexpected fleet/alerts answer")
    items = []
    for it in (raw.get("items") if isinstance(raw.get("items"), list) else [])[:SCAN_PAGE]:
        if not isinstance(it, dict) or not ia.valid_id(it.get("station_id")):
            continue
        sup = it.get("suppression") if isinstance(it.get("suppression"), dict) else None
        items.append({
            "id": _code(it.get("id")), "station_id": it["station_id"], "station_name": _text(it.get("station_name"), 128),
            "kind": _enum(it.get("kind"), ALERT_KINDS), "severity": _enum(it.get("severity"), ("warning", "error")),
            "observed_since": _iso(it.get("observed_since")), "observed_seconds": _int(it.get("observed_seconds")), "online": _bool(it.get("online")),
            "sync_state": _enum(it.get("sync_state"), STATION_SYNC_STATES), "suppressed": bool(it.get("suppressed")),
            "suppression": None if sup is None else {"kind": _enum(sup.get("kind"), SUPPRESSION_KINDS), "reason": _enum(sup.get("reason"), SUPPRESSION_REASONS),
                                                     "until": _iso(sup.get("until")), "created_at": _iso(sup.get("created_at"))},
        })
    thresholds = raw.get("thresholds_seconds") if isinstance(raw.get("thresholds_seconds"), dict) else {}
    per_station = raw.get("station_thresholds_seconds") if isinstance(raw.get("station_thresholds_seconds"), dict) else {}
    return {
        "items": items,
        "fetched_all": _int(raw.get("total")) is not None and _int(raw.get("total")) <= len(items),
        "thresholds_seconds": {k: _int(thresholds.get(k)) for k in ("offline", "sync_stalled", "event_gap")},
        "station_thresholds_seconds": {sid: {k: _int(v.get(k)) for k in ("offline", "sync_stalled", "event_gap")} for sid, v in per_station.items() if ia.valid_id(sid) and isinstance(v, dict)},
        "generated_at": _iso(raw.get("generated_at")),
    }


def project_audit_page(raw: Any) -> dict[str, Any]:
    """`audit/list` (WisKey's own action log): records with the person they concern (name, employee number - the view
    decides), the stations touched and the changed FIELD NAMES. Not kept: before / after summaries (validity, PIN flag, card
    counts), the actors' HA ids (their display names are kept: who did it in the intercom's panel)."""
    if not isinstance(raw, dict):
        raise ValueError("unexpected audit/list answer")
    actors = raw.get("actors") if isinstance(raw.get("actors"), dict) else {}
    records = []
    for r in (raw.get("records") if isinstance(raw.get("records"), list) else [])[:100]:
        if not isinstance(r, dict) or _int(r.get("sequence")) is None:
            continue
        summary = r.get("after") if isinstance(r.get("after"), dict) else r.get("before") if isinstance(r.get("before"), dict) else {}
        actor = r.get("actor")
        records.append({
            "sequence": r["sequence"], "time": _iso(r.get("time")), "action": _code(r.get("action")),
            "actor_name": _text(actors.get(actor), 128) if isinstance(actor, str) and actor else None,
            "person": {"id": r.get("user_id") if _id(r.get("user_id")) else None, "display_name": _text(summary.get("display_name"), 128),
                       "employee_no": _text(summary.get("employee_no"), 64)},
            "stations": [s for s in (r.get("stations") if isinstance(r.get("stations"), list) else [])[:100] if ia.valid_id(s)],
            "fields": [_code(f) for f in (r.get("fields") if isinstance(r.get("fields"), list) else [])[:64]],
            "revision_before": _int(r.get("revision_before")), "revision_after": _int(r.get("revision_after")),
            "reason_code": _code(r.get("reason_code")),
        })
    return {"records": records, "next_cursor": _int(raw.get("next_cursor")), "total": _int(raw.get("total")), "retention_days": _int(raw.get("retention_days"))}


# ---------------------------------------------------------------- photos and the export

PHOTO_PREFIX = "data:image/jpeg;base64,"
PHOTO_MAX_CHARS = 44_000  # WisKey's own bound on the data URL (profile_settings.py)
PHOTO_MAX_BYTES = 32_768


def decode_photo(raw: Any) -> bytes | None:
    """`users/photo_get`'s `{photo}`: the JPEG bytes, or None when there is no photo. Anything that is not WisKey's exact
    JPEG data URL within its own bounds raises (invalid_response): a data URL of another type is never served."""
    if not isinstance(raw, dict):
        raise ValueError("unexpected users/photo_get answer")
    photo = raw.get("photo")
    if photo is None:
        return None
    if not isinstance(photo, str) or not photo.startswith(PHOTO_PREFIX) or len(photo) > PHOTO_MAX_CHARS:
        raise ValueError("unexpected photo")
    try:
        data = base64.b64decode(photo[len(PHOTO_PREFIX):], validate=True)
    except (binascii.Error, ValueError):
        raise ValueError("unexpected photo encoding") from None
    if not 4 <= len(data) <= PHOTO_MAX_BYTES or data[:2] != b"\xff\xd8" or data[-2:] != b"\xff\xd9":
        raise ValueError("not a JPEG")
    return data


EXPORT_COLUMNS = ("timestamp", "station", "employee_no", "person_name", "event_type", "authentication", "result", "door", "masked_card", "recovered", "time_source",
                  "display_timestamp", "display_timezone")
FORMULA_START = ("=", "+", "-", "@", "\t", "\r", "\n")


def parse_export(raw: Any) -> list[dict[str, str]]:
    """`events/export`'s `csv` (UTF-8 BOM, CRLF, every cell quoted, WisKey's own formula guard) as rows keyed by WisKey's
    header names. A CSV without WisKey's columns raises (invalid_response)."""
    if not isinstance(raw, dict) or not isinstance(raw.get("csv"), str):
        raise ValueError("unexpected events/export answer")
    text = raw["csv"].lstrip("\ufeff")
    reader = csv.reader(io.StringIO(text, newline=""))
    try:
        header = next(reader)
    except StopIteration:
        return []
    if not set(EXPORT_COLUMNS) <= set(header):
        raise ValueError("unexpected events/export columns")
    index = {name: header.index(name) for name in EXPORT_COLUMNS}
    rows = []
    for cells in reader:
        if len(cells) != len(header):
            raise ValueError("a ragged events/export row")
        rows.append({name: cells[i] for name, i in index.items()})
    return rows


def csv_cell(value: str) -> str:
    """WisKey's own export rule, applied again on Arx's output: a cell that a spreadsheet would read as a formula starts with
    an apostrophe (a value WisKey already guarded starts with the apostrophe and is not touched again)."""
    return "'" + value if value.startswith(FORMULA_START) else value


def write_csv(columns: list[str], rows: list[dict[str, str]]) -> bytes:
    out = io.StringIO(newline="")
    writer = csv.writer(out, quoting=csv.QUOTE_ALL, lineterminator="\r\n")
    writer.writerow(columns)
    for row in rows:
        writer.writerow([csv_cell(row.get(c, "")) for c in columns])
    return ("\ufeff" + out.getvalue()).encode("utf-8")


# ---------------------------------------------------------------- the cache (principal-independent, person-free only)

class _Entry:
    __slots__ = ("value", "fetched_at", "mono", "generation")

    def __init__(self, value: Any, fetched_at: str | None, generation: int) -> None:
        self.value, self.fetched_at, self.mono, self.generation = value, fetched_at, time.monotonic(), generation


class Cache:
    """Closed, person-free projections by key (a command and its arguments; NEVER a principal). An entry is fresh for its
    TTL while no `refresh` push arrived after it; a stale one is still served (marked not fresh) when WisKey cannot be asked.
    Single-flight: one fetch per key at a time, the others wait for it."""

    MAX_ENTRIES = 512
    MAX_STALE_S = 600.0

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._entries: OrderedDict[tuple[Any, ...], _Entry] = OrderedDict()
        self._flights: dict[tuple[Any, ...], threading.Event] = {}
        self._generation = 0

    def clear(self) -> None:
        with self._lock:
            self._entries.clear()
            self._generation += 1

    def invalidate(self) -> None:
        """WisKey said something changed (`refresh`): every entry is stale from now on (kept for degraded serving)."""
        with self._lock:
            self._generation += 1

    def peek(self, key: tuple[Any, ...], ttl: float) -> tuple[_Entry | None, bool]:
        """(entry, fresh) - the entry may be None; `fresh` means within its TTL and no newer refresh."""
        with self._lock:
            entry = self._entries.get(key)
            if entry is None:
                return None, False
            age = time.monotonic() - entry.mono
            if age > self.MAX_STALE_S:
                del self._entries[key]
                return None, False
            return entry, age < ttl and entry.generation == self._generation

    def lead(self, key: tuple[Any, ...]) -> threading.Event | None:
        """None: the caller leads the fetch; else the event to wait on (another request is fetching the same key)."""
        with self._lock:
            flight = self._flights.get(key)
            if flight is not None:
                return flight
            self._flights[key] = threading.Event()
            return None

    def land(self, key: tuple[Any, ...], value: Any = None, fetched_at: str | None = None, store: bool = False, generation: int | None = None) -> None:
        with self._lock:
            if store and (generation is None or generation == self._generation):
                self._entries[key] = _Entry(value, fetched_at, self._generation)
                self._entries.move_to_end(key)
                while len(self._entries) > self.MAX_ENTRIES:
                    self._entries.popitem(last=False)
            flight = self._flights.pop(key, None)
        if flight is not None:
            flight.set()

    @property
    def generation(self) -> int:
        with self._lock:
            return self._generation

    def keys(self) -> list[tuple[Any, ...]]:
        with self._lock:
            return list(self._entries)


# ---------------------------------------------------------------- opaque cursors (restricted paging)

class Cursors:
    """Opaque `next` tokens for a principal's filtered event paging: the token stands for a WisKey position the caller must
    not learn (an event id on a station they do not see). Bound to the principal; random; short-lived; bounded."""

    MAX = 4096
    TTL_S = 1800.0
    PREFIX = "c."

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._items: OrderedDict[str, tuple[str, str, float]] = OrderedDict()

    def issue(self, user_id: str, position: str) -> str:
        token = self.PREFIX + secrets.token_urlsafe(18)
        with self._lock:
            self._items[token] = (user_id, position, time.monotonic() + self.TTL_S)
            while len(self._items) > self.MAX:
                self._items.popitem(last=False)
        return token

    def resolve(self, user_id: str, token: str) -> str | None:
        with self._lock:
            item = self._items.get(token)
            if item is None or item[0] != user_id or item[2] < time.monotonic():
                return None
            return item[1]

    def clear(self) -> None:
        with self._lock:
            self._items.clear()


_DIGEST_KEY = os.urandom(16)


def visible_digest(people: list[dict[str, Any]]) -> str:
    """A restricted principal's own paging snapshot: a keyed digest of the (id, revision) pairs it can see, so it moves only
    when a visible person changed (WisKey's snapshot also moves for people it cannot see)."""
    pairs = sorted((p["id"], p.get("revision")) for p in people)
    return hmac.new(_DIGEST_KEY, json.dumps(pairs, separators=(",", ":")).encode("utf-8"), hashlib.sha256).hexdigest()[:24]


# ---------------------------------------------------------------- features

FEATURES: dict[str, tuple[str, ...]] = {
    "people": ("users/query",),
    "person": ("users/get",),
    "person_photo": ("users/get", "users/photo_get"),
    "events": ("events/list",),
    "event_detail": ("events/detail",),
    "event_portrait": ("events/list", "users/photo_get"),
    "events_export": ("events/export",),
    "groups": ("profiles/settings_get",),
    "group_versions": ("profiles/versions",),
    "schedules": ("schedules/list",),
    "schedule_plans": ("schedules/plan_list",),
    "schedule_operations": ("schedules/operations_list",),
    "door_programs": ("stations/technical_program_list",),
    "hold_schedules": ("stations/technical_hold_get",),
    "public_codes": ("stations/technical_codes_get",),
    "health": ("health/get",),
    "health_history": ("health/history",),
    "sync_status": ("sync/status",),
    "conflicts": ("conflicts/list",),
    "alerts": ("fleet/alerts",),
    "wiskey_audit": ("audit/list",),
}


def feature_state(api: dict[str, Any] | None, feature: str) -> tuple[bool | None, str | None]:
    """(available, reason). None when the feed has no copy yet (the read then answers with the feed's own state)."""
    if api is None:
        return None, None
    min_client = api.get("min_client")
    if min_client is not None and min_client > API_CONTRACT:
        return False, "api_incompatible"
    commands = api.get("commands")
    if commands is None:
        return False, "commands_unknown"
    if not all(c in commands for c in FEATURES[feature]):
        return False, "not_listed"
    return True, None


def project_people_page(raw: Any) -> dict[str, Any]:
    """One `users/query` page: the people as supersets plus WisKey's paging bookkeeping. Never `profile_facets` (profile
    values across everyone the identity sees)."""
    if not isinstance(raw, dict):
        raise ValueError("unexpected users/query answer")
    records = raw.get("records")
    if records is not None and not isinstance(records, list):
        raise ValueError("unexpected users/query records")
    return {
        "records": [p for r in records or [] if (p := project_person(r)) is not None],
        **{k: _int(raw.get(k)) for k in ("total", "total_all", "offset", "limit", "next_offset", "previous_offset")},
        "snapshot": _text(raw.get("snapshot"), 64) or "",
        "stale": bool(raw.get("stale")),
        "complete": True,
        "incomplete_reason": None,
    }


# ---------------------------------------------------------------- the adapter

TRANSIENT = frozenset({"rate_limited", "busy", "timeout", "screen_locked", "reauth_required", "session_ended"})
TTL = {
    "groups": 60.0, "versions": 60.0, "schedules": 60.0, "schedule_plans": 60.0, "schedule_operations": 60.0,
    "programs": 30.0, "hold": 30.0, "codes": 300.0, "health": 30.0, "health_history": 60.0, "sync_status": 30.0, "alerts": 30.0,
}
STATION_NOT_FOUND = ("intercom_station_not_found", "העמדה לא נמצאה.")
PERSON_NOT_FOUND = ("intercom_person_not_found", "האדם לא נמצא.")
EVENT_NOT_FOUND = ("intercom_event_not_found", "האירוע לא נמצא.")
CURSOR_EXPIRED = "רשימת האירועים התעדכנה והסמן של 'טען עוד' פג - טענו מחדש מההתחלה."


def _feed(settings: Settings) -> dict[str, Any]:
    """The reply header the feed's own state gives (what a read answers when it cannot run)."""
    from . import ha_client

    configured = ha_client.configured(settings)
    state = intercom_sync.STATE.state if configured else "ha_not_configured"
    if configured and state == "idle":
        state = "connecting"
    return {"state": state, "configured": configured, "last_error": intercom_sync.STATE.last_error if configured else "ha_not_configured", "fetched_at": None}


def _not_found(code: str, message: str) -> ApiError:
    return ApiError(404, code, message)


# One answer per refusal kind, whoever produced it: WisKey saying "no such person / event / station" (the feed's
# REQUEST_ERRORS, which carry WisKey's code in `details`) and the projection filter saying "not yours" must be byte-
# identical, or comparing the two bodies tells a caller that an id they may not see exists (S4 self-review finding).
UNIFORM: dict[str, tuple[int, str]] = {
    PERSON_NOT_FOUND[0]: (404, PERSON_NOT_FOUND[1]),
    EVENT_NOT_FOUND[0]: (404, EVENT_NOT_FOUND[1]),
    STATION_NOT_FOUND[0]: (404, STATION_NOT_FOUND[1]),
    "intercom_invalid_request": (422, "בקרת הכניסה דחתה את פרמטרי הבקשה."),
}


def uniform(exc: ApiError) -> ApiError:
    """The adapter's one form of a not-found / invalid-request answer: same status, code and message, no details."""
    if exc.code in UNIFORM:
        status, message = UNIFORM[exc.code]
        return ApiError(status, exc.code, message)
    return exc


def _unsupported(reply: dict[str, Any]) -> ApiError:
    return ApiError(409, "intercom_unsupported", "התכונה אינה זמינה בבקרת הכניסה המותקנת.", details={"reason": reply.get("last_error")})


def _unavailable(reply: dict[str, Any]) -> ApiError:
    return ApiError(503, "intercom_unavailable", "בקרת הכניסה אינה זמינה כרגע.", retryable=True, details={"state": reply.get("state"), "last_error": reply.get("last_error")})


def _clone(value: Any) -> Any:
    """A detached copy of a cached JSON value (the cache's object is never handed out)."""
    return json.loads(json.dumps(value))


class IntercomAdapter:
    """The adapter's public reads. Every method takes the request's Authority (services/intercom_authority.py) and returns
    the caller's view only. It runs in the REQUEST thread: the authority's decisions use the request's database connection,
    so no filtering ever happens on the feed's event loop - a scan is one `intercom_sync.SYNC.command` per WisKey page (the
    read lane: its slots, its buckets, the feed's live session), filtered between pages."""

    def __init__(self) -> None:
        self.cache = Cache()
        self.cursors = Cursors()
        self._technical = threading.BoundedSemaphore(1)

    def forget(self) -> None:
        """The feed dropped its copy (WisKey gone, access revoked, a reset): nothing read from that WisKey is served again."""
        self.cache.clear()
        self.cursors.clear()

    # -- plumbing
    def _read(self, settings: Settings, who: str, key: str, send: Callable[[intercom_client.Call], Awaitable[Any]], project: Callable[[Any], Any],
              *, command: str, timeout: float | None = None, slot_wait: float = 0.0, target: str | None = None) -> dict[str, Any]:
        try:
            return self._read_raw(settings, who, key, send, project, command=command, timeout=timeout, slot_wait=slot_wait, target=target)
        except ApiError as exc:
            raise uniform(exc) from None

    def _read_raw(self, settings: Settings, who: str, key: str, send: Callable[[intercom_client.Call], Awaitable[Any]], project: Callable[[Any], Any],
                  *, command: str, timeout: float | None = None, slot_wait: float = 0.0, target: str | None = None) -> dict[str, Any]:
        """`target` (R4-07): a `users/get` of ONE person is a fresh readback of `person:<id>` - after an editor or grant write to that
        person had no clear outcome, this reload is the read that settles it (only when it started after that write's call was over)."""
        channel = CHANNEL_OF[command]
        if channel == "technical":
            if not self._technical.acquire(blocking=False):
                return {**_feed(settings), "state": "error", "last_error": "busy", key: None, "sync": intercom_sync.STATE.as_dict()}
            try:
                return intercom_sync.SYNC.command(settings, key, send, project, who=who, timeout=timeout or TECHNICAL_TIMEOUT_S, channel=channel, slot_wait=slot_wait)
            finally:
                self._technical.release()
        return intercom_sync.SYNC.command(settings, key, send, project, who=who, timeout=timeout if timeout is not None else intercom_sync.COMMAND_TIMEOUT_S,
                                          channel=channel, slot_wait=slot_wait, target=target)

    def _feature(self, settings: Settings, key: str, feature: str) -> dict[str, Any] | None:
        """None when the feature may be asked for; else the `unsupported` reply (nothing is sent to WisKey)."""
        available, reason = feature_state(intercom_sync.SYNC.api_facts(settings), feature)
        if available is False:
            return {**_feed(settings), "state": "unsupported", "last_error": reason, key: None, "sync": intercom_sync.STATE.as_dict()}
        return None

    def _fresh_reply(self, settings: Settings, key: str, entry: _Entry) -> dict[str, Any]:
        return {**_feed(settings), "state": "ready", "last_error": None, "fetched_at": entry.fetched_at, "fresh": True, key: _clone(entry.value),
                "sync": intercom_sync.STATE.as_dict()}

    def _cached(self, settings: Settings, who: str, ckey: tuple[Any, ...], key: str, send: Callable[[intercom_client.Call], Awaitable[Any]],
                project: Callable[[Any], Any], *, command: str, timeout: float | None = None) -> dict[str, Any]:
        """A principal-independent, person-free read through the cache: `fresh` says whether the value is current; a stale
        copy is served (not fresh) only while WisKey cannot be asked for a transient reason."""
        ttl = TTL[ckey[0]]
        ready = intercom_sync.STATE.state == "ready"
        entry, fresh = self.cache.peek(ckey, ttl)
        if entry is not None and fresh and ready:
            return self._fresh_reply(settings, key, entry)
        flight = self.cache.lead(ckey)
        if flight is not None:  # another request is fetching this very key: wait for it, then take its answer if it got one
            flight.wait(timeout=(timeout or intercom_sync.COMMAND_TIMEOUT_S) + 5.0)
            entry, fresh = self.cache.peek(ckey, ttl)
            if entry is not None and fresh:
                return self._fresh_reply(settings, key, entry)
            reply = self._read(settings, who, key, send, project, command=command, timeout=timeout)
        else:
            generation = self.cache.generation
            try:
                reply = self._read(settings, who, key, send, project, command=command, timeout=timeout)
            except BaseException:
                self.cache.land(ckey)
                raise
            ok = reply.get("state") == "ready" and reply.get(key) is not None
            self.cache.land(ckey, _clone(reply.get(key)) if ok else None, reply.get("fetched_at"), store=ok, generation=generation)
        if reply.get("state") == "ready" and reply.get(key) is not None:
            reply["fresh"] = True
            return reply
        transient = reply.get("state") in ("ha_unavailable", "connecting") or reply.get("last_error") in TRANSIENT
        if entry is not None and transient:
            return {**reply, key: _clone(entry.value), "fetched_at": entry.fetched_at, "fresh": False}
        reply["fresh"] = False
        return reply

    # -- features and stations (the feed's own copy: no WisKey call)
    def features(self, settings: Settings, auth: ia.Authority) -> dict[str, Any]:
        """Which native features this WisKey offers (`api.commands`) - WisKey facts only, no data."""
        api = intercom_sync.SYNC.api_facts(settings)
        out = {name: dict(zip(("available", "reason"), feature_state(api, name))) for name in FEATURES}
        return {**_feed(settings), "client_api": API_CONTRACT,
                "api": None if api is None else {"version": api.get("version"), "min_client": api.get("min_client")},
                "features": out, "sync": intercom_sync.STATE.as_dict()}

    def stations(self, settings: Settings, auth: ia.Authority) -> dict[str, Any]:
        sup = intercom_sync.SYNC.stations_superset(settings)
        return {**_feed(settings), "state": sup["state"], "fresh": sup["fresh"], "fetched_at": sup["fetched_at"],
                "stations": None if sup["stations"] is None else ia.view_stations(auth, sup["stations"]),
                "default_zone": sup["default_zone"], "sync": intercom_sync.STATE.as_dict()}

    def station(self, settings: Settings, auth: ia.Authority, station_id: str) -> dict[str, Any]:
        """One station; 404 when the copy has no such station OR the caller may not see it (the same answer)."""
        sup = intercom_sync.SYNC.stations_superset(settings)
        head = {**_feed(settings), "state": sup["state"], "fresh": sup["fresh"], "fetched_at": sup["fetched_at"], "sync": intercom_sync.STATE.as_dict()}
        if sup["stations"] is None:
            return {**head, "station": None, "default_zone": None}
        found = next((s for s in sup["stations"] if s.get("id") == station_id), None)
        view = ia.view_station(auth, found) if found is not None else None
        if view is None:
            raise _not_found(*STATION_NOT_FOUND)
        return {**head, "station": view, "default_zone": sup["default_zone"]}

    def _station_gate(self, settings: Settings, station_id: str, allowed: bool) -> dict[str, Any] | None:
        """404 unless the caller may see the station for this read (checked first: nothing else is looked at); the station's
        entry in the served copy, if there is a copy - a station it does not list is not found either."""
        if not allowed:
            raise _not_found(*STATION_NOT_FOUND)
        sup = intercom_sync.SYNC.stations_superset(settings)
        if sup["stations"] is None:
            return None
        found = next((s for s in sup["stations"] if s.get("id") == station_id), None)
        if found is None:
            raise _not_found(*STATION_NOT_FOUND)
        return found

    def status_stations(self, settings: Settings, auth: ia.Authority) -> dict[str, Any]:
        """The Settings status page's station list: the stations the caller sees there, as the stations view gives them."""
        reply = self.stations(settings, auth)
        if reply["stations"] is not None:
            reply["stations"] = [s for s in reply["stations"] if ia.status_station(auth, s["id"])]
        return reply

    # -- technical reads of one station (access.stations.read on it)
    def door_programs(self, settings: Settings, auth: ia.Authority, station_id: str) -> dict[str, Any]:
        self._station_gate(settings, station_id, auth.station_level(station_id) == ia.TECHNICAL)
        return self._feature(settings, "programs", "door_programs") or self._cached(
            settings, auth.principal.user_id, ("programs", station_id), "programs", lambda call: program_list(call, station_id), project_programs,
            command="stations/technical_program_list")

    def hold_schedule(self, settings: Settings, auth: ia.Authority, station_id: str, door: int) -> dict[str, Any]:
        station = self._station_gate(settings, station_id, auth.station_level(station_id) == ia.TECHNICAL)
        if station is not None and door not in [lock.get("physical_index") for lock in station.get("locks") or []]:
            raise ApiError(404, "intercom_lock_unknown", "לעמדה אין דלת במספר הזה.")
        return self._feature(settings, "hold", "hold_schedules") or self._cached(
            settings, auth.principal.user_id, ("hold", station_id, door), "hold", lambda call: hold_get(call, station_id, door), project_hold,
            command="stations/technical_hold_get")

    def codes_presence(self, settings: Settings, auth: ia.Authority, station_id: str) -> dict[str, Any]:
        self._station_gate(settings, station_id, auth.station_level(station_id) == ia.TECHNICAL)
        return self._feature(settings, "codes", "public_codes") or self._cached(
            settings, auth.principal.user_id, ("codes", station_id), "codes", lambda call: codes_get(call, station_id), project_codes,
            command="stations/technical_codes_get")

    # -- the Settings status page (access.admin.read)
    def health(self, settings: Settings, auth: ia.Authority, station_id: str) -> dict[str, Any]:
        self._station_gate(settings, station_id, ia.status_station(auth, station_id))
        return self._feature(settings, "health", "health") or self._cached(
            settings, auth.principal.user_id, ("health", station_id), "health", lambda call: health_get(call, station_id), project_health, command="health/get")

    def health_history(self, settings: Settings, auth: ia.Authority, station_id: str) -> dict[str, Any]:
        self._station_gate(settings, station_id, ia.status_station(auth, station_id))
        return self._feature(settings, "history", "health_history") or self._cached(
            settings, auth.principal.user_id, ("health_history", station_id), "history", lambda call: health_history(call, station_id), project_health_history,
            command="health/history")

    def sync_status(self, settings: Settings, auth: ia.Authority) -> dict[str, Any]:
        reply = self._feature(settings, "sync_status", "sync_status") or self._cached(
            settings, auth.principal.user_id, ("sync_status",), "sync_status", sync_status, project_sync_status, command="sync/status")
        if reply.get("sync_status") is not None:
            reply["sync_status"] = ia.view_sync_status(auth, reply["sync_status"])
        return reply

    def alerts(self, settings: Settings, auth: ia.Authority, *, kind: str, include_suppressed: bool, offset: int, limit: int) -> dict[str, Any]:
        reply = self._feature(settings, "alerts", "alerts") or self._cached(
            settings, auth.principal.user_id, ("alerts", kind, include_suppressed), "alerts", lambda call: fleet_alerts(call, kind, include_suppressed), project_alerts,
            command="fleet/alerts")
        if reply.get("alerts") is not None:
            reply["alerts"] = ia.view_alerts(auth, reply["alerts"], offset=offset, limit=limit)
        return reply

    def conflicts(self, settings: Settings, auth: ia.Authority, request_id: str | None = None) -> dict[str, Any]:
        ia.require_unrestricted(auth, ia.ADMIN_READ, request_id)
        reply = self._feature(settings, "conflicts", "conflicts") or self._read(settings, auth.principal.user_id, "conflicts", conflicts_list, project_conflicts,
                                                                                command="conflicts/list")
        if reply.get("conflicts") is not None:
            reply["conflicts"] = ia.view_conflicts(auth, reply["conflicts"])
        return reply

    def wiskey_audit(self, settings: Settings, auth: ia.Authority, filters: dict[str, Any], request_id: str | None = None) -> dict[str, Any]:
        ia.require_unrestricted(auth, ia.ADMIN_READ, request_id)
        reply = self._feature(settings, "audit", "wiskey_audit") or self._read(settings, auth.principal.user_id, "audit", lambda call: audit_list(call, filters),
                                                                               project_audit_page, command="audit/list")
        if reply.get("audit") is not None:
            reply["audit"] = ia.view_audit_page(auth, reply["audit"])
        return reply

    # -- groups, policy versions, schedules
    def groups(self, settings: Settings, auth: ia.Authority) -> dict[str, Any]:
        reply = self._feature(settings, "groups", "groups") or self._cached(
            settings, auth.principal.user_id, ("groups",), "groups", profiles_settings, project_groups, command="profiles/settings_get")
        if reply.get("groups") is not None:
            reply["groups"] = ia.view_groups(auth, reply["groups"])
        return reply

    def group_versions(self, settings: Settings, auth: ia.Authority, offset: int, limit: int, request_id: str | None = None) -> dict[str, Any]:
        ia.require_unrestricted(auth, ia.ADMIN_READ, request_id)
        return self._feature(settings, "versions", "group_versions") or self._cached(
            settings, auth.principal.user_id, ("versions", offset, limit), "versions", lambda call: profiles_versions(call, offset, limit), project_versions,
            command="profiles/versions")

    SCHEDULE_PARTS = {
        "library": ("schedules", "schedules", "schedules/list"),
        "plans": ("schedule_plans", "schedule_plans", "schedules/plan_list"),
        "operations": ("schedule_operations", "schedule_operations", "schedules/operations_list"),
    }

    def schedules(self, settings: Settings, auth: ia.Authority, part: str, request_id: str | None = None) -> dict[str, Any]:
        """WisKey's device schedule library (`library`), deployment plans (`plans`) or operations (`operations`): installation-
        wide in WisKey (a restricted operator cannot call them there either), so `access.stations.read` unrestricted."""
        ia.require_unrestricted(auth, ia.STATIONS_READ, request_id)
        feature, cache_name, command = self.SCHEDULE_PARTS[part]
        send, project = {
            "library": (schedules_list, project_schedule_library),
            "plans": (schedules_plans, project_schedule_plans),
            "operations": (schedules_operations, project_schedule_operations),
        }[part]
        return self._feature(settings, "schedules", feature) or self._cached(settings, auth.principal.user_id, (cache_name,), "schedules", send, project, command=command)

    # -- people (never cached)
    def people(self, settings: Settings, auth: ia.Authority, *, query: str, filters: dict[str, Any], offset: int, limit: int, snapshot: str | None,
               legacy: bool = False) -> dict[str, Any]:
        """One page of the directory as this principal may see it. Unrestricted and no text: WisKey's own page. Otherwise Arx
        scans WisKey's filtered directory page by page (empty text always: D1), keeps the people the caller may see that match
        the text on fields the caller sees, and pages over that list; `total` is exact unless the scan stopped early
        (`complete: false`), `total_all` is WisKey's directory size only for an unrestricted caller (count-leak guard), and a
        restricted caller's `snapshot` is a digest of what they can see. The employee-number sort only for a caller who sees
        every employee number (else `name`; the reply's `sort` says which order was applied)."""
        if not legacy and (unsupported := self._feature(settings, "people", "people")):
            return unsupported
        filters = {k: v for k, v in filters.items() if k in PEOPLE_FILTER_KEYS and v is not None and v != {}}
        if legacy:
            filters = {k: v for k, v in filters.items() if k not in FIELD_FILTER_KEYS}  # the phase-1b screens never offered them
        fields = has_field_filters(filters)
        if fields and not auth.anywhere(ia.PEOPLE_SENSITIVE):
            # the route refuses (and audits) this first; a field filter from any other caller is refused here too, silently
            raise forbidden(permission=ia.PEOPLE_SENSITIVE, target_type="installation", target_id="*", reason="field_level")
        everywhere = auth.employee_no_everywhere()
        if filters.get("sort") is None:
            filters["sort"] = "employee" if everywhere else "name"
        elif filters["sort"] == "employee" and not everywhere:
            filters["sort"] = "name"
        station = filters.get("station")
        needle = query.strip().casefold()
        restricted = not auth.unrestricted(ia.PEOPLE_READ)
        if station is not None and not auth.station(ia.PEOPLE_READ, station):
            reply = {**_feed(settings), "sync": intercom_sync.STATE.as_dict(), "people": None}
            if reply["state"] == "ready":  # a station the caller cannot see has nobody in it, exactly like a station that does not exist
                reply.update(last_error=None, people=self._page([], 0, None, offset, limit, "", False, True, None, restricted))
            return self._people_out(reply, filters, legacy, auth)
        if not needle and not restricted and (not fields or auth.unrestricted(ia.PEOPLE_SENSITIVE)):
            reply = self._read(settings, auth.principal.user_id, "people", lambda call: users_query(call, filters, offset, limit, snapshot, field_filters=fields), project_people_page,
                               command="users/query")
            if reply.get("people") is not None:
                page = reply["people"]
                views = [v for p in page["records"] if (v := ia.view_person(auth, p, legacy=legacy, detail=False)) is not None]
                # the caller should see every row at the level a field filter needs; one that does not (or that does not match
                # the filter although WisKey said it did) is a surprise, answered the filtered way: fail closed
                surprise = fields and any(ia.person_level_of(auth, p) != ia.SENSITIVE or not field_filters_match(p, filters) for p in page["records"])
                if len(views) != len(page["records"]) or surprise:
                    # an unrestricted caller should see every row; one was dropped anyway (fail closed): WisKey's totals would
                    # count it, so this request is answered the restricted way - scanned and counted over what is shown
                    return self._people_out(self._scan_people(settings, auth, needle, filters, offset, limit, snapshot, True, legacy), filters, legacy, auth)
                page["records"] = views
            return self._people_out(reply, filters, legacy, auth)
        return self._people_out(self._scan_people(settings, auth, needle, filters, offset, limit, snapshot, restricted, legacy), filters, legacy, auth)

    @staticmethod
    def _people_out(reply: dict[str, Any], filters: dict[str, Any], legacy: bool, auth: ia.Authority) -> dict[str, Any]:
        """The page's bookkeeping the screen needs: the order that was applied, and whether the caller sees every employee number
        (the search hint and the number column follow it)."""
        if not legacy and reply.get("people") is not None:
            reply["people"]["sort"] = filters["sort"]
            reply["people"]["employee_no_visible"] = auth.employee_no_everywhere()
        return reply

    @staticmethod
    def _page(records: list[dict[str, Any]], total: int, total_all: int | None, offset: int, limit: int, snap: str, stale: bool, complete: bool,
              reason: str | None, restricted: bool) -> dict[str, Any]:
        if offset >= total:
            offset = ((total - 1) // limit) * limit if total else 0
        end = offset + limit
        return {
            "records": records[offset:end], "total": total, "total_all": None if restricted else total_all, "offset": offset, "limit": limit,
            "next_offset": end if end < total else None, "previous_offset": max(0, offset - limit) if offset > 0 else None,
            "snapshot": snap, "stale": stale, "complete": complete, "incomplete_reason": reason,
        }

    def _scan_people(self, settings: Settings, auth: ia.Authority, needle: str, filters: dict[str, Any], offset: int, limit: int, snapshot: str | None,
                     restricted: bool, legacy: bool) -> dict[str, Any]:
        who = auth.principal.user_id
        fields = has_field_filters(filters)
        matches: list[tuple[dict[str, Any], dict[str, Any]]] = []  # (superset, view)
        seen: set[str] = set()
        wk_offset, pages, current, total_all, stale, reason = 0, 0, "", None, False, None
        first: dict[str, Any] | None = None
        while True:
            if pages >= MAX_SCAN_PAGES:
                reason = "scan_limit"
                break
            at = wk_offset
            reply = self._read(settings, who, "people", lambda call, at=at, snap=current: users_query(call, filters, at, SCAN_PAGE, snap, field_filters=fields), project_people_page,
                               command="users/query", slot_wait=2.0 if pages else 0.0)
            pages += 1
            if reply.get("people") is None:
                if first is None:
                    return reply  # the first page did not come: the request reports why
                reason = reply.get("last_error") or "error"
                break
            page = reply["people"]
            if first is None:
                first, current, total_all = reply, page["snapshot"], page["total_all"]
            elif page["stale"]:
                stale = True  # the directory changed while it was being scanned
            for person in page["records"]:
                if person["id"] in seen:
                    continue
                seen.add(person["id"])
                level = ia.person_level_of(auth, person)
                if level == ia.NONE or (needle and not person_matches(auth, person, level, needle)):
                    continue
                if fields and (level != ia.SENSITIVE or not field_filters_match(person, filters)):
                    continue  # a field filter separates people only by a value the caller may read: names level never matches
                view = ia.view_person(auth, person, legacy=legacy, detail=False)
                if view is not None:
                    matches.append((person, view))
            following = page["next_offset"]
            if following is None or following <= wk_offset:
                break
            wk_offset = following
        assert first is not None
        if restricted:
            snap = visible_digest([m[0] for m in matches])
            stale = bool(snapshot and snapshot != snap)
        else:
            snap, stale = current, stale or bool(snapshot and snapshot != current)
        first["people"] = self._page([m[1] for m in matches], len(matches), total_all, offset, limit, snap, stale, reason is None, reason, restricted)
        first["sync"] = intercom_sync.STATE.as_dict()
        return first

    def person(self, settings: Settings, auth: ia.Authority, user_id: str, *, legacy: bool = False) -> dict[str, Any]:
        """One person; 404 when WisKey has no such person OR the caller may not see them (the same answer)."""
        if not legacy and (unsupported := self._feature(settings, "person", "person")):
            return unsupported
        reply = self._read(settings, auth.principal.user_id, "person", lambda call: users_get(call, user_id), project_one_person, command="users/get",
                           target=intercom_sync.person_target(user_id))
        if reply.get("person") is not None:
            view = ia.view_person(auth, reply["person"], legacy=legacy, detail=True)
            if view is None:
                raise _not_found(*PERSON_NOT_FOUND)
            reply["person"] = view
        return reply

    def person_photo(self, settings: Settings, auth: ia.Authority, user_id: str, request_id: str | None = None) -> bytes:
        """The person's photo (JPEG bytes): the person visible at the sensitive level (the photo stays sensitive, answer 2 of
        2026-10-12). Two WisKey reads (the person, for the rule; then the photo). Every view is audited (person id only)."""
        if (unsupported := self._feature(settings, "photo", "person_photo")):
            raise _unsupported(unsupported)
        reply = self._read(settings, auth.principal.user_id, "person", lambda call: users_get(call, user_id), project_one_person, command="users/get",
                           target=intercom_sync.person_target(user_id))
        person = reply.get("person")
        if person is None:
            raise _unavailable(reply)
        level = ia.person_level_of(auth, person)
        if level == ia.NONE:
            raise _not_found(*PERSON_NOT_FOUND)
        from ..audit import audit

        if level != ia.SENSITIVE:
            audit(auth.conn, actor=auth.principal, action=ia.PEOPLE_SENSITIVE, decision="denied", resource_type="intercom_person", resource_id=user_id,
                  reason="field_level", request_id=request_id)
            raise forbidden(permission=ia.PEOPLE_SENSITIVE, target_type="intercom_person", target_id=user_id, reason="field_level")
        data = self._photo(settings, auth, user_id)
        audit(auth.conn, actor=auth.principal, action="intercom.person.photo_view", decision="allowed", resource_type="intercom_person", resource_id=user_id,
              request_id=request_id)
        return data

    def _photo(self, settings: Settings, auth: ia.Authority, user_id: str) -> bytes:
        reply = self._read(settings, auth.principal.user_id, "photo", lambda call: users_photo_get(call, user_id), decode_photo, command="users/photo_get")
        if reply.get("state") != "ready":
            raise _unavailable(reply)
        if reply.get("photo") is None:
            raise _not_found("intercom_photo_not_found", "אין תמונה.")
        return reply["photo"]

    # -- events (never cached)
    def _resolve_before(self, auth: ia.Authority, before: str | None) -> str | None:
        if before is None:
            return None
        if before.startswith(Cursors.PREFIX):
            position = self.cursors.resolve(auth.principal.user_id, before)
            if position is None:
                raise ApiError(422, "intercom_cursor_expired", CURSOR_EXPIRED)
            return position
        if not _id(before):
            raise ApiError(422, "intercom_cursor_expired", CURSOR_EXPIRED)
        return before

    def events(self, settings: Settings, auth: ia.Authority, filters: dict[str, Any], *, limit: int, before: str | None, legacy: bool = False) -> dict[str, Any]:
        """One page of the entry log as this principal may see it. Passed straight to WisKey when the caller sees every
        station (or asked for one station they see) and WisKey's `person` match - a name or an employee number - touches only
        fields they see; otherwise Arx scans WisKey's pages, keeps what the caller sees and anchors `next` on an opaque cursor
        of its own, so no position of an event they cannot see is ever handed out."""
        if not legacy and (unsupported := self._feature(settings, "events", "events")):
            return unsupported
        wf = {k: v for k, v in filters.items() if k in EVENT_FILTER_KEYS and k not in ("limit", "before") and v is not None}
        station = wf.get("station_id")
        if station is not None and not auth.station(ia.EVENTS_READ, station):
            reply = {**_feed(settings), "sync": intercom_sync.STATE.as_dict(), "events": None}
            if reply["state"] == "ready":
                reply.update(last_error=None, events={"records": [], "next": None, "retention_days": None, "capacity": None, "membership_basis": None,
                                                      "storage_failed": False, "stations": {}, **({} if legacy else {"complete": True, "incomplete_reason": None})})
            return reply
        position = self._resolve_before(auth, before)
        local_person = None
        if wf.get("person") is not None and not auth.employee_no_everywhere():
            local_person = str(wf.pop("person")).strip().casefold()  # matched on names only, here (the numbers are hidden)
        if (station is not None or auth.unrestricted(ia.EVENTS_READ)) and local_person is None:
            reply = self._read(settings, auth.principal.user_id, "events", lambda call: events_list(call, {**wf, "limit": limit, "before": position}),
                               project_event_page, command="events/list")
            if reply.get("events") is not None:
                page = reply["events"]
                views = [v for e in page["records"] if (v := self._event_view(auth, e, legacy)) is not None]
                if len(views) != len(page["records"]):
                    # a row was dropped although the caller should see every one (fail closed): WisKey's own cursor may name
                    # it, so this request is answered the filtered way - scanned, with an opaque cursor of Arx's own
                    return self._scan_events(settings, auth, wf, local_person, limit, position, legacy)
                page["records"] = views
                page["stations"] = {sid: st for sid, st in page["stations"].items() if auth.station(ia.EVENTS_READ, sid)}
                if not legacy:
                    page.update(complete=True, incomplete_reason=None)
            return reply
        return self._scan_events(settings, auth, wf, local_person, limit, position, legacy)

    @staticmethod
    def _event_view(auth: ia.Authority, event: dict[str, Any], legacy: bool) -> dict[str, Any] | None:
        view = ia.view_event(auth, event)
        if view is not None and legacy:
            view.pop("portrait", None)  # the phase-1b row shape
        return view

    def _scan_events(self, settings: Settings, auth: ia.Authority, wf: dict[str, Any], local_person: str | None, limit: int, position: str | None,
                     legacy: bool) -> dict[str, Any]:
        who = auth.principal.user_id
        rows: list[dict[str, Any]] = []
        first: dict[str, Any] | None = None
        pages, reason, full, done = 0, None, False, False
        anchor: str | None = None  # the last row handed out
        scanned: str | None = None  # the last row looked at
        cursor = position
        while True:
            if pages >= MAX_SCAN_PAGES:
                reason = "scan_limit"
                break
            at = cursor
            reply = self._read(settings, who, "events", lambda call, at=at: events_list(call, {**wf, "limit": SCAN_PAGE, "before": at}), project_event_page,
                               command="events/list", slot_wait=2.0 if pages else 0.0)
            pages += 1
            if reply.get("events") is None:
                if first is None:
                    return reply
                reason = reply.get("last_error") or "error"
                break
            page = reply["events"]
            if first is None:
                first = reply
            for event in page["records"]:
                scanned = event["id"]
                if local_person is not None and local_person not in (event.get("person_name") or "").casefold():
                    continue
                view = self._event_view(auth, event, legacy)
                if view is None:
                    continue
                rows.append(view)
                anchor = event["id"]
                if len(rows) >= limit:
                    full = True
                    break
            if full:
                break
            cursor = page["next"]
            if cursor is None:
                done = True
                break
        assert first is not None
        page = first["events"]
        if full:
            following = self.cursors.issue(who, anchor) if anchor else None
        elif done:
            following = None
        else:
            following = self.cursors.issue(who, scanned) if scanned else None
        page["records"] = rows
        page["next"] = following
        page["stations"] = {sid: st for sid, st in page["stations"].items() if auth.station(ia.EVENTS_READ, sid)}
        if not legacy:
            page.update(complete=reason is None, incomplete_reason=reason)
        first["sync"] = intercom_sync.STATE.as_dict()
        return first

    def event_detail(self, settings: Settings, auth: ia.Authority, event_id: str) -> dict[str, Any]:
        """One event with WisKey's evidence; 404 when WisKey has no such event OR the caller may not see it."""
        if (unsupported := self._feature(settings, "event", "event_detail")):
            return unsupported
        reply = self._read(settings, auth.principal.user_id, "event", lambda call: events_detail(call, event_id), project_event_detail, command="events/detail")
        if reply.get("event") is not None:
            view = ia.view_event(auth, reply["event"], detail=True)
            if view is None:
                raise _not_found(*EVENT_NOT_FOUND)
            view.pop("portrait", None)  # the detail read carries no picture reference (rc.37); the list row has it
            reply["event"] = view
        return reply

    def event_portrait(self, settings: Settings, auth: ia.Authority, event_id: str, station_id: str, at: datetime, request_id: str | None = None) -> bytes:
        """The picture of an event (answer 4 of 2026-10-12: the events view on its station is enough, unless the administrator
        made it sensitive). WisKey keeps the picture as a reference on the LIST row, so the row is found again within a second
        of `at` on `station_id` (both as the list served them; WisKey's own row decides the station) and its person's photo is
        read. Each view leaves an audit row unless the administrator switched that off (`access.event_portrait_audit`)."""
        if (unsupported := self._feature(settings, "portrait", "event_portrait")):
            raise _unsupported(unsupported)
        if not auth.event_portrait(station_id):
            raise _not_found(*EVENT_NOT_FOUND)
        window = {"station_id": station_id, "start": (at - timedelta(seconds=1)).isoformat(), "end": (at + timedelta(seconds=1)).isoformat(), "limit": SCAN_PAGE}
        reply = self._read(settings, auth.principal.user_id, "events", lambda call: events_list(call, window), project_event_page, command="events/list")
        if reply.get("events") is None:
            raise _unavailable(reply)
        row = next((e for e in reply["events"]["records"] if e["id"] == event_id), None)
        if row is None or not auth.event_portrait(row.get("station_id")):
            raise _not_found(*EVENT_NOT_FOUND)
        if row.get("portrait_ref") is None:
            raise _not_found("intercom_photo_not_found", "אין תמונה.")
        person_id = row["portrait_ref"]["user_id"]
        data = self._photo(settings, auth, person_id)
        if auth.policy(ia.PORTRAIT_AUDIT):
            from ..audit import audit

            audit(auth.conn, actor=auth.principal, action="intercom.event.portrait_view", decision="allowed", resource_type="intercom_event", resource_id=event_id,
                  request_id=request_id, details={"station_id": row.get("station_id"), "person_id": person_id})
        return data

    def events_export(self, settings: Settings, auth: ia.Authority, filters: dict[str, Any], request_id: str | None = None) -> tuple[bytes, int, list[str]]:
        """The entry log as CSV (Arx's own file: no card column, the employee number only where the caller sees it, the rows
        of stations the caller sees only). A caller who does not see every station exports one station at a time (WisKey's
        export names stations by title, so a mixed file could not be filtered reliably). Audited: filters, row count, the
        columns - never a row."""
        if (unsupported := self._feature(settings, "export", "events_export")):
            raise _unsupported(unsupported)
        wf = {k: v for k, v in filters.items() if k in EXPORT_FILTER_KEYS and v is not None}
        station = wf.get("station_id")
        everywhere = auth.unrestricted(ia.EVENTS_READ) and auth.unrestricted(ia.EVENTS_EXPORT)
        if station is None and not everywhere:
            raise ApiError(422, "intercom_export_station_required", "יש לבחור עמדה לייצוא.")
        if station is not None and not (auth.station(ia.EVENTS_READ, station) and auth.station(ia.EVENTS_EXPORT, station)):
            raise _not_found(*STATION_NOT_FOUND)
        sensitive = auth.unrestricted(ia.PEOPLE_SENSITIVE) if station is None else auth.station(ia.PEOPLE_SENSITIVE, station)
        with_number = auth.employee_no_for(ia.SENSITIVE if sensitive else ia.NAMES)
        local_person = None
        if wf.get("person") is not None and not with_number:
            local_person = str(wf.pop("person")).strip().casefold()  # WisKey would match it on employee numbers the caller cannot see
        reply = self._read(settings, auth.principal.user_id, "export", lambda call: events_export(call, wf), parse_export, command="events/export", timeout=EXPORT_TIMEOUT_S)
        rows = reply.get("export")
        if rows is None:
            raise _unavailable(reply)
        if local_person is not None:
            rows = [r for r in rows if local_person in r["person_name"].casefold()]
        columns = ["timestamp", "station", *(["employee_no"] if with_number else []), "person_name", "event_type", "authentication", "result", "door", "recovered",
                   "time_source", "display_timestamp", "display_timezone"]
        from ..audit import audit

        audit(auth.conn, actor=auth.principal, action="intercom.events.export", decision="allowed", resource_type="intercom", resource_id=station or "*",
              request_id=request_id, details={"filters": dict(wf), "person_filter": filters.get("person") is not None, "rows": len(rows), "columns": columns})
        return write_csv(columns, rows), len(rows), columns


ADAPTER = IntercomAdapter()
