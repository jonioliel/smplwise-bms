"""Closed resource-policy data contract, never a credential by itself.

Native bridge composition must authenticate the enclosing command before using
this parser, durably reject revision rollback and retain current original
transport/entry/registry ownership. Parsing JSON cannot install authority.
Private input is kept in memory; this module never logs or hashes its values.
"""

from __future__ import annotations

import json
from collections.abc import Mapping
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Any, cast

from ..trusted_actions.envelope import freeze
from ..trusted_actions.validation import Refusal, aware, reference
from .arx_execution_authority import RowGrant, StationGrant
from .arx_feature_execution_contract import FeatureRequest

SCHEMA_VERSION = 1
MAX_REVISION = 2**53 - 1
MAX_BYTES = 1_048_576
MAX_STATIONS = 200
MAX_ROWS = 2000
FIELDS = frozenset(
    {
        "schema_version",
        "repository_id",
        "bridge_owner",
        "source_epoch",
        "authority_ref",
        "authority_revision",
        "scope_ref",
        "actor",
        "actor_session_active",
        "issued_at",
        "expires_at",
        "active",
        "complete",
        "permissions",
        "grant_ids",
        "stations",
        "rows",
        "private_input",
    }
)
PERMISSIONS = frozenset(
    {
        "people/write",
        "door/pulse",
        "door/hold_open",
        "door/restore",
        "door/emergency_secure",
        "door/emergency_open",
        "door/emergency_release",
        "media/video_receive",
        "media/audio_receive",
        "media/microphone_send",
        "validation/run",
        "validation/identity",
        "validation/door_capabilities",
        "validation/door_read",
        "validation/media",
    }
)


def revision(value: Any) -> int:
    if type(value) is not int or not 1 <= value <= MAX_REVISION:
        raise Refusal("invalid_policy_snapshot")
    return value


def _json_only(value: Any) -> None:
    if value is None or type(value) in {str, bool, int}:
        return
    if type(value) is list:
        for item in value:
            _json_only(item)
        return
    if type(value) is dict and all(type(key) is str for key in value):
        for item in value.values():
            _json_only(item)
        return
    raise Refusal("invalid_policy_snapshot")


def _refs(value: Any, limit: int) -> tuple[str, ...]:
    if type(value) is not list or len(value) > limit:
        raise Refusal("invalid_policy_snapshot")
    values = tuple(reference(v) for v in value)
    if len(set(values)) != len(values):
        raise Refusal("invalid_policy_snapshot")
    return values


@dataclass(frozen=True, repr=False)
class PolicySnapshot:
    """Validated immutable data; only its original bridge source can admit it."""

    payload: Mapping[str, Any]
    issued_at: datetime
    expires_at: datetime
    permissions: frozenset[str]
    stations: tuple[StationGrant, ...]
    rows: tuple[RowGrant, ...]

    @property
    def revision(self) -> int:
        return cast(int, self.payload["authority_revision"])

    @property
    def key(self) -> tuple[str, str, str, str]:
        owner = self.payload["bridge_owner"]
        return (
            owner["entry_id"],
            owner["query_owner_id"],
            self.payload["source_epoch"],
            self.payload["authority_ref"],
        )


def parse_snapshot(
    value: Any,
    *,
    request: FeatureRequest,
    repository_id: str,
    entry_id: str,
    query_owner_id: str,
    now: datetime,
) -> PolicySnapshot:
    """Validate data against the exact already parsed feature intent/origin IDs.

    IDs are supplied by native authenticated composition, never copied from the
    snapshot as expected authority. This function still grants no permission.
    """
    if type(request) is not FeatureRequest:
        raise Refusal("invalid_policy_snapshot")
    sealed = request._original()
    if (
        type(value) is not dict
        or set(value) != FIELDS
        or type(value["schema_version"]) is not int
        or value["schema_version"] != SCHEMA_VERSION
    ):
        raise Refusal("invalid_policy_snapshot")
    try:
        _json_only(value)
        if len(json.dumps(value, ensure_ascii=False, allow_nan=False).encode()) > MAX_BYTES:
            raise Refusal("request_too_large")
    except (ValueError, UnicodeError, RecursionError):
        raise Refusal("invalid_policy_snapshot") from None
    if (
        value["repository_id"] != repository_id
        or type(value["bridge_owner"]) is not dict
        or value["bridge_owner"] != {"entry_id": entry_id, "query_owner_id": query_owner_id}
        or type(value["active"]) is not bool
        or value["complete"] is not True
        or type(value["actor_session_active"]) is not bool
        or freeze(value["actor"]) != request.get("actor")
        or value["actor"].get("kind") == "human"
        and value["actor_session_active"] is not True
    ):
        raise Refusal("policy_binding_denied")
    for name in ("source_epoch", "authority_ref", "scope_ref"):
        reference(value[name])
    revision(value["authority_revision"])
    if any(
        value[k] != request.get(k) for k in ("authority_ref", "authority_revision", "scope_ref")
    ):
        raise Refusal("policy_binding_denied")
    issued, expires = aware(value["issued_at"]), aware(value["expires_at"])
    if (
        now.utcoffset() is None
        or issued > now + timedelta(seconds=2)
        or now >= expires
        or not timedelta() < expires - issued <= timedelta(hours=24)
        or sealed.execution_end > expires
    ):
        raise Refusal("policy_expired")
    permissions = frozenset(_refs(value["permissions"], len(PERMISSIONS)))
    if not permissions <= PERMISSIONS:
        raise Refusal("invalid_policy_snapshot")
    grants = _refs(value["grant_ids"], MAX_STATIONS * 2 + MAX_ROWS)
    stations: list[StationGrant] = []
    rows: list[RowGrant] = []
    used: list[str] = []
    if (
        type(value["stations"]) is not list
        or len(value["stations"]) > MAX_STATIONS * 2
        or type(value["rows"]) is not list
        or len(value["rows"]) > MAX_ROWS
    ):
        raise Refusal("invalid_policy_snapshot")
    for item in value["stations"]:
        if type(item) is not dict or set(item) != {
            "grant_id",
            "station_id",
            "api_relay",
            "physical_relay",
            "mapping_revision",
        }:
            raise Refusal("invalid_policy_snapshot")
        used.append(reference(item["grant_id"]))
        revision(item["mapping_revision"])
        stations.append(StationGrant(**{k: v for k, v in item.items() if k != "grant_id"}))
    for item in value["rows"]:
        if type(item) is not dict or set(item) != {
            "grant_id",
            "source_line",
            "user_id",
            "revision",
            "origin_ref",
            "change_digest",
        }:
            raise Refusal("invalid_policy_snapshot")
        used.append(reference(item["grant_id"]))
        if item["revision"] is not None:
            revision(item["revision"])
        rows.append(RowGrant(**{k: v for k, v in item.items() if k != "grant_id"}))
    if (
        len(set(used)) != len(used)
        or set(used) != set(grants)
        or len({(s.station_id, s.api_relay) for s in stations}) != len(stations)
        or len({(s.station_id, s.physical_relay) for s in stations}) != len(stations)
        or len({r.source_line for r in rows}) != len(rows)
        or len({r.change_digest for r in rows}) != len(rows)
        or value["active"]
        and not permissions
        or not value["active"]
        and (permissions or used or value["private_input"] is not None)
    ):
        raise Refusal("invalid_policy_snapshot")
    return PolicySnapshot(freeze(value), issued, expires, permissions, tuple(stations), tuple(rows))
