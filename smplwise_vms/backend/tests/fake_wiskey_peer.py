"""WKPEER-295: fakes for the WisKey peer / receipt seam and the ACR5-01..04 consumers. Nothing here reaches a WisKey, Home Assistant,
a station, a reader or a door. Every identifier is fictional (the fixture values of WisKey's own draft examples where they exist).

- `FakeRegistry`: the WisKey half of the peer-binding registry as Arx's PROPOSED read (`peer_bindings/get`) would see it - a table of
  binding revisions, each with its query owner, repository, state, historical-read permission and successor. Calls are counted.
- `access_state_frame(...)`, `normalize_frame(...)`, `plan(...)`: the frozen v1 ACR5 shapes (ARX_REPLY6_WIRE_SHAPES_V1) and the ACR5-04
  draft-plan result."""
from __future__ import annotations

import copy
from typing import Any

REPO = "11111111-1111-4111-8111-111111111111"
OTHER_REPO = "33333333-3333-4333-8333-333333333333"
OWNER = "22222222222242228222222222222222"  # the dedicated query principal (an HA user id: 32 lowercase hex)
OTHER_OWNER = "99999999999949998999999999999999"
PERSON = "44444444-4444-4444-8444-444444444444"
PEER = "vpr-arx-fixture-1"
BINDING = "peer-binding-fixture-8"


def binding_row(revision: int = 2, **over: Any) -> dict[str, Any]:
    row = {"schema_version": 1, "protocol": "wiskey-peer-binding-draft1", "verified_peer_ref": PEER, "peer_binding_ref": BINDING,
           "peer_binding_revision": revision, "query_owner_id": OWNER, "repository_id": REPO,
           "allowed_read_scope": "central_capture_person_commit", "state": "active", "active": True, "historical_read": False,
           "successor": None}
    row.update(over)
    return row


class FakeRegistry:
    """The registry as a dict {(peer_binding_ref, revision): result}. `fail` makes the next call answer that failure code;
    `raise_exc` makes it raise (a transport loss)."""

    def __init__(self, *rows: dict[str, Any]) -> None:
        self.rows: dict[tuple[str, int], dict[str, Any]] = {}
        for row in rows or (binding_row(),):
            self.put(row)
        self.calls: list[tuple[str, int]] = []
        self.fail: str | None = None
        self.raise_exc: Exception | None = None
        self.frame_override: Any = None

    def put(self, row: dict[str, Any]) -> None:
        self.rows[(row["peer_binding_ref"], row["peer_binding_revision"])] = copy.deepcopy(row)

    def peer_binding_get(self, peer_binding_ref: str, peer_binding_revision: int) -> Any:
        self.calls.append((peer_binding_ref, peer_binding_revision))
        if self.raise_exc is not None:
            raise self.raise_exc
        if self.frame_override is not None:
            return copy.deepcopy(self.frame_override)
        if self.fail:
            return {"id": 7, "type": "result", "success": False, "error": {"code": self.fail, "message": "unavailable"}}
        row = self.rows.get((peer_binding_ref, peer_binding_revision))
        if row is None:
            return {"id": 7, "type": "result", "success": False, "error": {"code": "binding_not_found", "message": "unavailable"}}
        return {"id": 7, "type": "result", "success": True, "result": copy.deepcopy(row)}


def failure(code: str, message: str = "unavailable") -> dict[str, Any]:
    return {"id": 41, "type": "result", "success": False, "error": {"code": code, "message": message}}


ROW = {"station_id": "st-a", "enabled": True, "allowed_locks": [1], "desired_revision": 5, "applied_revision": 5, "sync_state": "synced",
       "applied": True}
SCHEDULE = {"mode": "weekly", "timezone": "Asia/Jerusalem", "days": ["Monday", "Tuesday"], "dates": [],
            "periods": [{"start": "08:00", "end": "17:00"}]}
EMPTY_PENDING = {"bindings": [], "tombstones": [], "cards": [], "pins": [], "operations": [], "unverified": []}


def access_state_result(**over: Any) -> dict[str, Any]:
    base: dict[str, Any] = {
        "schema_version": 1, "observation": "durable_repository_snapshot", "scope": "all_managed_stations", "user_id": PERSON,
        "person_revision": 5, "presence": "present", "revocation_pending": False, "stations_synced": True,
        "assignments": [dict(ROW)], "timing_policy": {"mode": "ha", "schedule": copy.deepcopy(SCHEDULE), "bindings": {}},
        "pending": copy.deepcopy(EMPTY_PENDING)}
    base.update(over)
    return base


def access_state_frame(**over: Any) -> dict[str, Any]:
    return {"id": 12, "type": "result", "success": True, "result": access_state_result(**over)}


def normalize_frame(schedule: dict[str, Any] | None = None, **over: Any) -> dict[str, Any]:
    result = {"schema_version": 1, "normalization": "wiskey-user-schedule-v1", "schedule": copy.deepcopy(schedule or SCHEDULE)}
    result.update(over)
    return {"id": 13, "type": "result", "success": True, "result": result}


class FakeNormalizer:
    """ACR5-02 as a fake: canonicalises by sorting days Monday..Sunday, dates ascending and periods by start (the frozen TXT order);
    `fail` answers that failure code instead."""

    ORDER = ("Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday")

    def __init__(self) -> None:
        self.calls = 0
        self.fail: str | None = None

    def __call__(self, schedule: dict[str, Any]) -> dict[str, Any]:
        self.calls += 1
        if self.fail:
            return failure(self.fail)
        out = copy.deepcopy(schedule)
        out["days"] = sorted(out.get("days", []), key=lambda d: self.ORDER.index(d) if d in self.ORDER else 99)
        out["dates"] = sorted(out.get("dates", []))
        out["periods"] = sorted(out.get("periods", []), key=lambda p: p.get("start", ""))
        return normalize_frame(out)


def plan(feature: str = "door_windows", **over: Any) -> dict[str, Any]:
    base = {"schema_version": 1, "feature": feature, "draft": {"window": "fixture"}, "execution_available": False,
            "authority_verified": False, "status": "adapter_not_implemented"}
    base.update(over)
    return base
