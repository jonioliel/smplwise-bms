"""Credential-free projection of one complete published repository snapshot.

No writes, awaits, provider calls or physical probes. Candidate contract is in
docs/ARX_REPLY5_READBACK_AND_FEATURE_CONTRACT.proposed1.txt; not a deletion receipt.
"""

from __future__ import annotations

import json
from copy import deepcopy
from datetime import datetime
from typing import Any

from .models import AccessError, SYNC_STATES
from .timing_policy import policy as normalize_policy
from .user_timing import timing_draft

NORMALIZATION = "wiskey-user-schedule-v1"
V2_MAX_REVISION = (1 << 53) - 1
V2_MAX_ROWS = 1024
V2_MAX_ENVELOPE_BYTES = 1024 * 1024


def v2_revision(value: Any) -> bool:
    """The negotiated JSON-number range, without bool/coercion or precision loss."""
    return type(value) is int and 1 <= value <= V2_MAX_REVISION


def v2_identifier(value: Any) -> bool:
    """V2 agrees with the closed consumer and admits actual UTF-8 wire text."""
    if not _identifier(value) or not value.strip():
        return False
    try:
        value.encode("utf-8")
    except UnicodeError:
        return False
    return True


def validate_v2_request(user_id: Any, revision: Any) -> None:
    if not v2_identifier(user_id) or not v2_revision(revision):
        raise AccessError("invalid_fields")


def validate_v2_envelope(frame: Any) -> None:
    """Bound the entire actual wire frame, including outer metadata and IDs.

    ASCII escapes and ordinary JSON spaces conservatively exceed compact UTF-8
    encoders. Stop counting before allocating an oversized completed byte string.
    This is an additional admission check, never truncation or a partial reply.
    """
    total = 0
    try:
        for chunk in json.JSONEncoder(ensure_ascii=True, allow_nan=False).iterencode(frame):
            if len(chunk) > V2_MAX_ENVELOPE_BYTES:
                raise AccessError("readback_unavailable")
            total += len(chunk.encode("ascii"))
            if total > V2_MAX_ENVELOPE_BYTES:
                raise AccessError("readback_unavailable")
    except (TypeError, ValueError, UnicodeError, OverflowError, RecursionError):
        raise AccessError("readback_unavailable") from None


def normalize_schedule(value: dict[str, Any]) -> dict[str, Any]:
    """Expose the existing storage normalizer without changing its semantics."""
    if not isinstance(value, dict):
        raise AccessError("invalid_user_timing")
    return {"schema_version": 1, "normalization": NORMALIZATION, "schedule": deepcopy(timing_draft(value))}


def _identifier(value: Any) -> bool:
    return type(value) is str and 1 <= len(value) <= 128 and not any(
        ord(char) < 32 or ord(char) == 127 for char in value
    )


def _ids(value: Any) -> set[str]:
    if not isinstance(value, list) or any(
        not _identifier(item) for item in value
    ):
        raise AccessError("readback_unavailable")
    if len(set(value)) != len(value):
        raise AccessError("readback_unavailable")
    return set(value)


def _positive(value: Any) -> bool:
    return type(value) is int and value > 0


def _observed(value: Any) -> bool:
    if type(value) is not str or len(value) > 64:
        return False
    try:
        parsed = datetime.fromisoformat(value)
        return parsed.tzinfo is not None and parsed.utcoffset() is not None
    except ValueError:
        return False


def validate_request(user_id: Any, revision: Any) -> None:
    if not _identifier(user_id) or not _positive(revision):
        raise AccessError("invalid_fields")


def project(state: dict[str, Any], user_id: str, revision: int, *, ready: bool) -> dict[str, Any]:
    """No pending=False from missing collections, an unready store or central absence.

    `revision` binds a present-person answer to the central read Arx is evaluating.
    Absence discloses no earlier identity, deleted record or credential material.
    """
    validate_request(user_id, revision)
    collections = ("users", "bindings", "tombstones", "retired_cards", "retired_pins", "sync_operations")
    if ready is not True or not isinstance(state, dict) or any(
        not isinstance(state.get(name), dict) for name in collections
    ):
        raise AccessError("readback_unavailable")
    person = state["users"].get(user_id)
    tombstone = state["tombstones"].get(user_id)
    if user_id in state["users"]:
        if not isinstance(person, dict) or person.get("id") != user_id or not _positive(person.get("revision")):
            raise AccessError("readback_unavailable")
        if person["revision"] != revision:
            raise AccessError("revision_conflict")
        if user_id in state["tombstones"]:
            raise AccessError("readback_unavailable")

    pending: dict[str, set[str]] = {key: set() for key in ("bindings", "tombstones", "cards", "pins", "operations", "unverified")}
    assignments = []
    enabled_stations: set[str] = set()
    station_checks: list[bool | None] = []
    timing_policy = None
    if person is not None:
        rows = person.get("assignments")
        if not isinstance(rows, dict):
            raise AccessError("readback_unavailable")
        if "access_timing_policy" not in person:
            raise AccessError("readback_unavailable")
        try:
            # Storage normalizers may retain an unused empty day/date list.
            # Return detached metadata, never a mutable view of published state.
            timing_policy = deepcopy(normalize_policy(person["access_timing_policy"]))
        except AccessError:
            raise AccessError("readback_unavailable") from None
        if any(not isinstance(sid, str) for sid in rows):
            raise AccessError("readback_unavailable")
        for sid, row in sorted(rows.items()):
            if not _identifier(sid) or not isinstance(row, dict) or type(row.get("enabled")) is not bool:
                raise AccessError("readback_unavailable")
            locks = row.get("allowed_locks")
            if not isinstance(locks, list) or any(type(lock) is not int or lock not in (1, 2) for lock in locks) or len(locks) != len(set(locks)) or row["enabled"] and not locks:
                raise AccessError("readback_unavailable")
            desired, applied, status = row.get("desired_revision"), row.get("applied_revision"), row.get("sync_state")
            valid_status = isinstance(status, str) and status in SYNC_STATES
            valid_bookkeeping = (
                _positive(desired) and desired == person["revision"] and
                "applied_revision" in row and (applied is None or _positive(applied) and applied <= desired) and valid_status
            )
            row_synced = bool(applied == desired and status == "synced") if valid_bookkeeping else None
            if valid_bookkeeping and (applied != desired or status != "synced"):
                pending["operations"].add(sid)
            if applied is None or not _observed(row.get("last_sync_at")):
                # Missing observed revision/time is UNKNOWN, not an observed
                # negative result. Pending work is an independent source fact.
                row_synced = None
            # A journal can be missing/inconsistent after a legacy load. Check
            # every persisted assignment too, including disabled removal rows.
            if row_synced is None:
                pending["unverified"].add(sid)
            if row["enabled"]:
                enabled_stations.add(sid)
                station_checks.append(row_synced)
            assignments.append({"station_id": sid, "enabled": row["enabled"], "allowed_locks": sorted(set(locks)),
                "desired_revision": desired if _positive(desired) else None,
                "applied_revision": applied if _positive(applied) else None,
                "sync_state": status if valid_status else None, "applied": row_synced})

    for sid, people in state["bindings"].items():
        if not _identifier(sid) or not isinstance(people, dict):
            raise AccessError("readback_unavailable")
        if user_id in people:
            binding = people[user_id]
            if not isinstance(binding, dict):
                raise AccessError("readback_unavailable")
            if sid not in enabled_stations:
                pending["bindings"].add(sid)
            status, intent = binding.get("sync_state"), binding.get("intent")
            if not isinstance(status, str) or status not in SYNC_STATES:
                pending["unverified"].add(sid)
            elif status != "synced":
                pending["operations"].add(sid)
            if intent is not None:
                if not isinstance(intent, dict) or intent.get("operation") not in ("create", "update", "delete") or not _positive(intent.get("revision")):
                    raise AccessError("readback_unavailable")
                pending["operations"].add(sid)

    for collection, key in (("retired_cards", "cards"), ("retired_pins", "pins"), ("tombstones", "tombstones")):
        for item_key, item in state[collection].items():
            if not isinstance(item, dict) or not _identifier(item.get("user_id")):
                raise AccessError("readback_unavailable")
            if collection == "tombstones" and item_key != item["user_id"]:
                raise AccessError("readback_unavailable")
            targets, confirmed = _ids(item.get("targets")), _ids(item.get("confirmed"))
            if not confirmed <= targets:
                raise AccessError("readback_unavailable")
            if item["user_id"] == user_id:
                pending[key].update(targets - confirmed)

    for operation_key, item in state["sync_operations"].items():
        if not isinstance(item, dict) or not _identifier(item.get("user_id")):
            raise AccessError("readback_unavailable")
        if item["user_id"] != user_id:
            continue
        sid, status = item.get("station_id"), item.get("state")
        if not _identifier(sid) or operation_key != f"{user_id}/{sid}" or status not in ("pending", "failed", "settled", "verified"):
            raise AccessError("readback_unavailable")
        if status in ("pending", "failed"):
            pending["operations"].add(sid)
        elif status == "settled":
            # The existing journal explicitly distinguishes disappearing work from
            # positive device readback. A settled-only row cannot certify cleanup.
            pending["unverified"].add(sid)
        elif not _observed(item.get("verified_at")):
            pending["unverified"].add(sid)
    has_pending = any(value for key, value in pending.items() if key != "unverified")
    presence = "present" if person is not None else "delete_pending" if tombstone is not None else "absent"
    revocation_pending = True if has_pending or tombstone is not None else None
    if person is not None and not has_pending and not pending["unverified"]:
        revocation_pending = False
    stations_synced = None
    if station_checks:
        stations_synced = False if False in station_checks else None if None in station_checks else True
    return {"schema_version": 1, "observation": "durable_repository_snapshot", "scope": "all_managed_stations",
        "user_id": user_id, "person_revision": person["revision"] if person is not None else None,
        "presence": presence, "revocation_pending": revocation_pending, "stations_synced": stations_synced,
        "assignments": assignments, "timing_policy": timing_policy,
        "pending": {key: sorted(value) for key, value in pending.items()}}
