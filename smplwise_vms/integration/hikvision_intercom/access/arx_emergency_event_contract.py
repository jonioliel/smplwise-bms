"""Numbered persistent emergency event data, separate from capture and finite hold.

This validates stored/request data only. It creates no source, grant, fence or
effect permission. Actual current FeatureLease/target/transport remain required.
"""

from __future__ import annotations

import hashlib
from datetime import timedelta
from typing import Any

from ..trusted_actions.peer_boundary import peer_revision
from ..trusted_actions.validation import Refusal, aware, reference
from .arx_feature_execution_contract import CONTRACT, FEATURE_FIELDS

KIND = "wiskey-emergency-event.v1"
KIND_V2 = "wiskey-emergency-event.v2"
KINDS = frozenset({KIND, KIND_V2})
V2_INPUT_FIELDS = {"kind", "event_ref", "command", "trigger", "retry_of"}
INPUT_FIELDS = {"kind", "event_ref", "command"}
BODY_FIELDS = {"kind", "event_ref", "command", "registered_at", "targets"}
TARGET_FIELDS = {"station_id", "api_relay", "physical_relay", "mapping_revision", "identity"}
ROW_FIELDS = {"target", "phase", "duplicate", "claim", "release_claim", "prior_operation"}
ORIGINAL_FIELDS = {
    "repository_id",
    "verified_peer_ref",
    "peer_binding_ref",
    "peer_binding_revision",
    "query_owner_id",
    "descriptor_epoch",
    "request",
}
APPLY_PHASES = {
    "prepared",
    "attempted",
    "acknowledged",
    "unknown",
    "denied",
    "duplicate",
    "superseded",
}
RELEASE_PHASES = {
    "release_registered",
    "attempted",
    "acknowledged",
    "unknown",
    "denied",
    "duplicate",
    "tombstone_only",
}
CLAIM_PHASES = {"attempted", "acknowledged", "unknown"}
AUTOMATIC_FIRE_ENABLED = False


def request(value: Any) -> tuple[str, str]:
    if (
        type(value) is not dict
        or value.get("kind") not in KINDS
        or set(value) != (V2_INPUT_FIELDS if value["kind"] == KIND_V2 else INPUT_FIELDS)
        or value["command"] not in {"hold_open", "release"}
    ):
        raise Refusal("invalid_emergency_event")
    reference(value["event_ref"])
    if value["kind"] == KIND_V2:
        if value["trigger"] not in {"manual", "fire"}:
            raise Refusal("invalid_emergency_event")
        if value["retry_of"] is not None:
            reference(value["retry_of"])
            if value["command"] != "hold_open":
                raise Refusal("invalid_emergency_event")
    return value["event_ref"], value["command"]


def signature(target: Any) -> tuple[Any, ...]:
    if type(target) is not dict or set(target) != TARGET_FIELDS:
        raise Refusal("invalid_storage")
    reference(target["station_id"])
    peer_revision(target["mapping_revision"])
    if (
        any(
            type(target[key]) is not int or target[key] not in {1, 2}
            for key in ("api_relay", "physical_relay")
        )
        or type(target["identity"]) is not str
        or not 1 <= len(target["identity"]) <= 256
    ):
        raise Refusal("invalid_storage")
    return tuple(
        target[key]
        for key in (
            "station_id",
            "api_relay",
            "physical_relay",
            "mapping_revision",
            "identity",
        )
    )


def target_key(target: Any) -> str:
    # The existing NativeDoorTarget's internal target index, not an intent hash
    # or a new hash exchanged with Arx. It contains public target IDs only.
    return hashlib.sha256(repr(signature(target)[:4]).encode()).hexdigest()


def claim(value: Any) -> tuple[str, ...] | None:
    if value is None:
        return None
    if type(value) is not list or len(value) != 4:
        raise Refusal("invalid_storage")
    return tuple(reference(item) for item in value)


def original_claim(original: dict[str, Any]) -> tuple[Any, ...]:
    descriptor = original["request"]
    return tuple(
        original["verified_peer_ref"] if key == "peer" else descriptor[key]
        for key in ("peer", "operation_id", "operation_binding_ref", "request_id")
    )


def scope(original: dict[str, Any], event_ref: str, target: dict[str, Any]) -> tuple[Any, ...]:
    return tuple(
        original[key]
        for key in (
            "repository_id",
            "verified_peer_ref",
            "query_owner_id",
        )
    ) + (event_ref, target["station_id"], target["physical_relay"])


def validate(original: Any, body: Any) -> dict[str, Any]:
    """Closed canonical persisted row; original full descriptor stays intact."""
    try:
        if (
            type(original) is not dict
            or set(original) != ORIGINAL_FIELDS
            or type(original["request"]) is not dict
            or set(original["request"]) != FEATURE_FIELDS
            or original["request"]["contract_version"] != CONTRACT
            or original["request"]["feature"] != "emergency_buttons"
            or type(body) is not dict
            or body.get("kind") not in KINDS
            or set(body)
            != (BODY_FIELDS | {"trigger", "retry_of"} if body["kind"] == KIND_V2 else BODY_FIELDS)
        ):
            raise ValueError
        for key in ORIGINAL_FIELDS - {"request", "peer_binding_revision"}:
            reference(original[key])
        peer_revision(original["peer_binding_revision"])
        request(
            {
                key: body[key]
                for key in (V2_INPUT_FIELDS if body["kind"] == KIND_V2 else INPUT_FIELDS)
            }
        )
        registered = aware(body["registered_at"])
        if not (
            aware(original["request"]["issued_at"]) - timedelta(seconds=2)
            <= registered
            < aware(original["request"]["execution_expires_at"])
        ):
            raise ValueError
        if type(body["targets"]) is not dict or not 1 <= len(body["targets"]) <= 200:
            raise ValueError
        for key, row in body["targets"].items():
            if (
                type(row) is not dict
                or set(row) != ROW_FIELDS
                or type(row["duplicate"]) is not bool
            ):
                raise ValueError
            if key != target_key(row["target"]):
                raise ValueError
            if row["prior_operation"] is not None:
                reference(row["prior_operation"])
            own, released = claim(row["claim"]), claim(row["release_claim"])
            if body["command"] == "hold_open":
                if row["phase"] not in APPLY_PHASES or released is not None:
                    raise ValueError
                if row["duplicate"]:
                    if own is not None or row["phase"] not in {"duplicate", "superseded"}:
                        raise ValueError
                elif body["kind"] == KIND_V2 and body["retry_of"] is not None:
                    if own is None or row["prior_operation"] != body["retry_of"]:
                        raise ValueError
                elif own != original_claim(original) or row["prior_operation"] is not None:
                    raise ValueError
            elif row["phase"] not in RELEASE_PHASES or own is not None:
                raise ValueError
            if row["duplicate"] != (row["phase"] in {"duplicate", "superseded"}):
                raise ValueError
            if row["duplicate"] and row["prior_operation"] is None:
                raise ValueError
            if row["prior_operation"] == original["request"]["operation_id"]:
                raise ValueError
            if body["command"] == "release" and not row["duplicate"]:
                if (released is None) != (row["prior_operation"] is None):
                    raise ValueError
        return body
    except (KeyError, TypeError, ValueError, RecursionError, Refusal):
        raise Refusal("invalid_storage") from None


def _transition(before: Any, after: Any, *, completion_only: bool) -> bool:
    if (
        type(before) is not dict
        or type(after) is not dict
        or before.get("kind") not in KINDS
        or set(before)
        != (BODY_FIELDS | {"trigger", "retry_of"} if before["kind"] == KIND_V2 else BODY_FIELDS)
        or set(after) != set(before)
        or any(before[key] != after[key] for key in set(before) - {"targets"})
        or set(before["targets"]) != set(after["targets"])
    ):
        return False
    changed = False
    for key, old in before["targets"].items():
        new = after["targets"][key]
        if old == new:
            continue
        changed = True
        if (
            set(old) != ROW_FIELDS
            or set(new) != ROW_FIELDS
            or any(old[field] != new[field] for field in ROW_FIELDS - {"phase"})
            or not (
                old["phase"] == "attempted"
                and new["phase"] in {"acknowledged", "unknown"}
                or old["phase"] in {"prepared", "release_registered"}
                and new["phase"] == "denied"
                or old["phase"] == "release_registered"
                and new["phase"] == "tombstone_only"
                or not completion_only
                and old["phase"] in {"prepared", "release_registered"}
                and new["phase"] == "attempted"
            )
        ):
            return False
    return changed


def transition(before: Any, after: Any, *, completion_only: bool = False) -> bool:
    """A recorded unknown/ACK is terminal; no reset can authorize a resend."""
    try:
        return _transition(before, after, completion_only=completion_only)
    except (KeyError, TypeError, ValueError, RecursionError):
        return False


def completion(before: Any, after: Any) -> bool:
    """Only finish an existing attempt; no new opening/release admission."""
    return transition(before, after, completion_only=True)
