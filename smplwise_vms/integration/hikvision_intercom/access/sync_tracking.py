"""Durable latest operation per person/station. No credentials in its public projection."""

from __future__ import annotations

import hashlib
import hmac
import json
from datetime import UTC, datetime
from typing import Any
from uuid import uuid4

from .models import AccessError, ManagedUser, utc_now, uuid_text

MAX_COMPLETED = 1000
PERSON_PAYLOAD_MAX_ENTRIES = 8
PERSON_PAYLOAD_MAX_BYTES = 256 * 1024


def pending_users(state: dict[str, Any], station: str) -> set[str]:
    pending = {
        uid
        for uid, user in state["users"].items()
        if (a := user["assignments"].get(station))
        and (a["sync_state"] != "synced" or a["applied_revision"] != a["desired_revision"])
    }
    pending.update(
        uid
        for uid, b in state["bindings"].get(station, {}).items()
        if b.get("intent") is not None
        or b.get("sync_state") != "synced"
        or station not in state["users"].get(uid, {}).get("assignments", {})
    )
    for collection in ("tombstones", "retired_cards", "retired_pins"):
        pending.update(
            item["user_id"]
            for item in state[collection].values()
            if station in item["targets"] and station not in item["confirmed"]
        )
    return pending


def _assignment_key(value):
    """Exact current native assignment values only; unsupported shapes fall back."""
    if value is None:
        return ("none",)
    if (
        type(value) is not dict
        or len(value) != 3
        or any(type(key) is not str for key in value)
        or set(value) != {"enabled", "allowed_locks", "schedule_template"}
        or type(value["enabled"]) is not bool
        or type(value["allowed_locks"]) is not list
        or any(type(lock) is not int or lock not in (1, 2) for lock in value["allowed_locks"])
        or value["schedule_template"] is not None
    ):
        return None
    return ("station", value["enabled"], tuple(value["allowed_locks"]))


class _PersonPayloads:
    """One update's CURRENT grouped person only, never signatures or authority."""

    def __init__(self):
        self.uid, self.entries, self.bytes_used = None, {}, 0

    def encode(self, uid, desired):
        if self.uid != uid:
            self.uid, self.entries, self.bytes_used = uid, {}, 0
        key = _assignment_key(desired.get("assignments"))
        if key is not None and key in self.entries:
            return self.entries[key]
        payload = json.dumps(desired, sort_keys=True).encode()
        if (
            key is not None
            and len(self.entries) < PERSON_PAYLOAD_MAX_ENTRIES
            and self.bytes_used + len(payload) <= PERSON_PAYLOAD_MAX_BYTES
        ):
            self.entries[key] = payload
            self.bytes_used += len(payload)
        return payload


def _intent(
    state: dict[str, Any], uid: str, station: str, projections: dict | None = None,
    payloads: _PersonPayloads | None = None,
) -> str:
    from .csv_transfer import desired_fields

    raw = state["users"].get(uid)
    if raw:
        # The caller's memo exists only within this one synchronous update of
        # one candidate image. It contains structural desired fields, never a
        # signature, live authority, permission or cross-update decision.
        if projections is None:
            projections = {}
        if uid not in projections:
            projections[uid] = desired_fields(ManagedUser.from_private(raw))
        desired = dict(projections[uid])
        # Do not replace the memo's full assignments with one station's view.
        desired["assignments"] = desired["assignments"].get(station)
    else:
        desired = {"deleted": True}
    return hmac.new(
        bytes.fromhex(state["fingerprint_key"]),
        json.dumps(desired, sort_keys=True).encode()
        if payloads is None else payloads.encode(uid, desired),
        hashlib.sha256,
    ).hexdigest()


def update(state: dict[str, Any], *, migrated: bool = False) -> None:
    """Called inside the same atomic commit as the desired state and readback."""
    journal = state["sync_operations"]
    stations = set(state["bindings"])
    for user in state["users"].values():
        stations.update(user["assignments"])
    for collection in ("tombstones", "retired_cards", "retired_pins"):
        for item in state[collection].values():
            stations.update(item["targets"])
    pending = {(uid, sid) for sid in stations for uid in pending_users(state, sid)}
    now = utc_now()
    projections = {}
    payloads = _PersonPayloads()
    for uid, sid in sorted(pending):
        key = f"{uid}/{sid}"
        signature = _intent(state, uid, sid, projections, payloads)
        previous = journal.get(key)
        if (
            previous is None
            or previous["intent"] != signature
            or previous["state"] in {"verified", "settled"}
        ):
            journal[key] = {
                "id": str(uuid4()),
                "user_id": uid,
                "station_id": sid,
                "intent": signature,
                "queued_at": None if migrated else now,
                "updated_at": now,
                "state": "pending",
                "verified_at": None,
            }
        item = journal[key]
        user = state["users"].get(uid, {})
        assignment = user.get("assignments", {}).get(sid, {})
        binding = state["bindings"].get(sid, {}).get(uid, {})
        tombstone = state["tombstones"].get(uid, {}).get("stations", {}).get(sid, {})
        status = (
            tombstone.get("sync_state") or binding.get("sync_state") or assignment.get("sync_state")
        )
        value = "failed" if status in {"error", "conflict"} else "pending"
        if item["state"] != value:
            item.update(state=value, updated_at=now)
    for item in journal.values():
        if (item["user_id"], item["station_id"]) not in pending and item["state"] in {
            "pending",
            "failed",
        }:
            # Pending work disappearing alone is not proof of device readback.
            item.update(state="settled", updated_at=now)
    completed = sorted(
        (key for key, item in journal.items() if item["state"] in {"verified", "settled"}),
        key=lambda key: (journal[key]["updated_at"], key),
        reverse=True,
    )
    for key in completed[MAX_COMPLETED:]:
        del journal[key]


def verified(state: dict[str, Any], uid: str, station: str) -> None:
    """Only repository device-readback paths call this, after all revocations settle."""
    item = state["sync_operations"].get(f"{uid}/{station}")
    if item and item["state"] != "verified" and uid not in pending_users(state, station):
        now = utc_now()
        item.update(state="verified", updated_at=now, verified_at=now)


def public(state: dict[str, Any]) -> list[dict[str, Any]]:
    return [
        {key: value for key, value in item.items() if key != "intent"}
        for item in sorted(
            state["sync_operations"].values(), key=lambda item: item["updated_at"], reverse=True
        )
    ]


def pending_age(state: dict[str, Any], station: str) -> int | None:
    users = pending_users(state, station)
    if not users:
        return 0
    times = [state["sync_operations"].get(f"{uid}/{station}", {}).get("queued_at") for uid in users]
    if any(value is None for value in times):
        return None
    return max(
        0,
        int(
            (
                datetime.now(UTC) - min(datetime.fromisoformat(value) for value in times)
            ).total_seconds()
        ),
    )


def validate(value: Any) -> None:
    if not isinstance(value, dict):
        raise AccessError("invalid_storage")
    for key, item in value.items():
        if not isinstance(item, dict) or set(item) != {
            "id",
            "user_id",
            "station_id",
            "intent",
            "queued_at",
            "updated_at",
            "state",
            "verified_at",
        }:
            raise AccessError("invalid_storage")
        uuid_text(item["id"])
        uuid_text(item["user_id"])
        if key != f"{item['user_id']}/{item['station_id']}" or not isinstance(
            item["station_id"], str
        ):
            raise AccessError("invalid_storage")
        if (
            item["state"] not in {"pending", "failed", "verified", "settled"}
            or len(bytes.fromhex(item["intent"])) != 32
        ):
            raise AccessError("invalid_storage")
        for field in ("queued_at", "updated_at", "verified_at"):
            if item[field] is not None and datetime.fromisoformat(item[field]).tzinfo is None:
                raise AccessError("invalid_storage")
        if item["updated_at"] is None or (item["state"] == "verified") != (
            item["verified_at"] is not None
        ):
            raise AccessError("invalid_storage")
