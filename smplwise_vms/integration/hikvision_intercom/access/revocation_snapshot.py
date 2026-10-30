"""Additive readback v2: central revocation and tracked cleanup stay separate."""

from typing import Any

from .models import AccessError
from .person_readback import (
    V2_MAX_REVISION,
    V2_MAX_ROWS,
    _ids,
    project,
    v2_identifier,
    v2_revision,
    validate_v2_envelope,
    validate_v2_request,
)

CENTRAL_REVOCATION_PREDICATE = "inactive-no-enabled-assignments-no-groups-no-overrides-no-pin-v1"
V2_FIELDS = frozenset(
    {
        "schema_version",
        "observation",
        "scope",
        "user_id",
        "person_revision",
        "presence",
        "revocation_pending",
        "stations_synced",
        "assignments",
        "timing_policy",
        "pending",
        "central_revocation_predicate",
        "central_revoked",
    }
)
V2_ASSIGNMENT_FIELDS = frozenset(
    {
        "station_id",
        "enabled",
        "allowed_locks",
        "desired_revision",
        "applied_revision",
        "sync_state",
        "applied",
    }
)
V2_PENDING_FIELDS = frozenset(
    {"bindings", "tombstones", "cards", "pins", "operations", "unverified"}
)


def _nullable_bool(value: Any) -> bool:
    return value is None or type(value) is bool


def _validate_result(result: dict[str, Any]) -> None:
    """Fail closed on a future projector extension instead of silently widening v2."""
    if (
        type(result) is not dict
        or set(result) != V2_FIELDS
        or type(result["schema_version"]) is not int
        or result["schema_version"] != 2
        or result["observation"] != "durable_repository_snapshot"
        or result["scope"] != "all_managed_stations"
        or not v2_identifier(result["user_id"])
        or result["presence"] not in {"present", "absent", "delete_pending"}
        or result["central_revocation_predicate"] != CENTRAL_REVOCATION_PREDICATE
        or any(
            not _nullable_bool(result[key])
            for key in (
                "revocation_pending",
                "stations_synced",
                "central_revoked",
            )
        )
        or result["person_revision"] is not None
        and not v2_revision(result["person_revision"])
        or type(result["assignments"]) is not list
        or len(result["assignments"]) > V2_MAX_ROWS
        or type(result["pending"]) is not dict
        or set(result["pending"]) != V2_PENDING_FIELDS
    ):
        raise AccessError("readback_unavailable")
    for row in result["assignments"]:
        if (
            type(row) is not dict
            or set(row) != V2_ASSIGNMENT_FIELDS
            or not v2_identifier(row["station_id"])
            or type(row["enabled"]) is not bool
            or not _nullable_bool(row["applied"])
            or any(
                row[key] is not None and not v2_revision(row[key])
                for key in (
                    "desired_revision",
                    "applied_revision",
                )
            )
        ):
            raise AccessError("readback_unavailable")
    for values in result["pending"].values():
        if type(values) is not list or len(values) > V2_MAX_ROWS:
            raise AccessError("readback_unavailable")
        _ids(values)
        if any(not v2_identifier(value) for value in values):
            raise AccessError("readback_unavailable")


def project_v2(
    state: dict[str, Any], user_id: str, revision: int, *, ready: bool
) -> dict[str, Any]:
    """Project both facts from the same ready, revision-bound repository snapshot.

    ``central_revoked`` describes the central person only. It is not a station
    removal receipt, a remote-write fence, or proof that an absent person was
    removed. No credential value is copied, hashed, measured or returned.
    """
    validate_v2_request(user_id, revision)
    # Validate stored counters before v1's conservative nullable projection can
    # erase an invalid/unsafe original value. V1 behavior itself stays frozen.
    if type(state) is not dict or type(state.get("users")) is not dict:
        raise AccessError("readback_unavailable")
    person = state["users"].get(user_id)
    if person is not None:
        if type(person) is not dict or not v2_revision(person.get("revision")):
            raise AccessError("readback_unavailable")
        rows = person.get("assignments")
        if type(rows) is not dict or len(rows) > V2_MAX_ROWS:
            raise AccessError("readback_unavailable")
        for row in rows.values():
            if (
                type(row) is not dict
                or not v2_revision(row.get("desired_revision"))
                or (
                    row.get("applied_revision") is not None
                    and not v2_revision(row["applied_revision"])
                )
            ):
                raise AccessError("readback_unavailable")
    result = project(state, user_id, revision, ready=ready)
    revoked = None
    if result["presence"] == "present":
        person = state["users"][user_id]
        if any(key not in person for key in ("active", "pin", "group_ids", "permission_overrides")):
            raise AccessError("readback_unavailable")
        if type(person["active"]) is not bool:
            raise AccessError("readback_unavailable")
        # A private persisted PIN is either a string or null. Inspect only its
        # presence; its contents must not enter public output or diagnostics.
        if person["pin"] is not None and type(person["pin"]) is not str:
            raise AccessError("readback_unavailable")
        groups = _ids(person["group_ids"])
        if any(not v2_identifier(group) for group in groups):
            raise AccessError("readback_unavailable")
        overrides = person["permission_overrides"]
        if type(overrides) is not dict or any(
            not v2_identifier(sid) or type(value) is not str or value not in ("allow", "deny")
            for sid, value in overrides.items()
        ):
            raise AccessError("readback_unavailable")
        revoked = (
            person["active"] is False
            and person["pin"] is None
            and not groups
            and not overrides
            and not any(row["enabled"] for row in result["assignments"])
        )
    result = {
        **result,
        "schema_version": 2,
        "central_revocation_predicate": CENTRAL_REVOCATION_PREDICATE,
        "central_revoked": revoked,
    }
    _validate_result(result)
    # Admission includes the real HA success wrapper and worst allowed ID.
    # A bridge adding metadata must call validate_v2_envelope on that final frame.
    validate_v2_envelope(
        {"id": V2_MAX_REVISION, "type": "result", "success": True, "result": result}
    )
    return result
