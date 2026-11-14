"""Dormant peer-bound native row receipts, saved beside the actual person.

This is an additive candidate storage field, not a migration or activation.
Historical loading validates data only; it cannot restore transport authority.
An ordinary native worker must never resume one of these bound jobs.
"""

from __future__ import annotations

import json
from datetime import timedelta
from typing import Any
from uuid import UUID

from ..trusted_actions.envelope import thaw
from ..trusted_actions.peer_boundary import PeerMessage, counter
from ..trusted_actions.validation import aware, reference
from .arx_feature_execution_contract import CONTRACT, FEATURE_FIELDS, FeatureRequest
from .arx_feature_intents import absolute_time
from .models import AccessError, ManagedUser

SCHEMA = "wiskey-arx-native-row-receipt.v1"


def original(message: PeerMessage) -> dict[str, Any]:
    if type(message) is not PeerMessage or type(message.request) is not FeatureRequest:
        raise AccessError("unauthorized")
    message.check()
    if message.request.get("feature") != "people_csv":
        raise AccessError("unauthorized")
    verification = message.verification
    return {
        "schema": SCHEMA,
        "repository_id": verification.repository_id,
        "verified_peer_ref": verification.verified_peer_ref,
        "peer_binding_ref": verification.peer_binding_ref,
        "peer_binding_revision": verification.peer_binding_revision,
        "query_owner_id": message.query_owner_id,
        "descriptor_epoch": verification.descriptor.epoch,
        "original": thaw(message.request.descriptor),
    }


def check(job: dict, expected: dict | None) -> None:
    stored = job.get("source_binding")
    if stored is None and expected is None:
        return
    if (
        not isinstance(stored, dict)
        or expected is None
        or {key: value for key, value in stored.items() if key != "rows"} != expected
    ):
        raise AccessError("unauthorized")


def append(
    state: dict,
    job: dict,
    index: int,
    origin: str,
    before: ManagedUser | None,
    after: ManagedUser | None,
) -> None:
    reference(origin)
    # Retain permanent origin fences even after completion/cancellation. Never
    # recover creates by employee number, name, PIN or card similarity.
    if before is None:
        for previous in state["checkpoint_jobs"].values():
            for saved in previous.get("source_binding", {}).get("rows", {}).values():
                if saved["origin_ref"] == origin:
                    raise AccessError("original_create_already_committed")
    person = after if after is not None else before
    if person is None:
        raise AccessError("invalid_fields")
    job["source_binding"]["rows"][str(index)] = {
        "user_id": person.id,
        "person_revision": person.revision,
        "source_line": job["rows"][index - 1]["source_line"],
        "origin_ref": origin,
        "state": "central_deleted" if after is None else "central_committed",
    }


def validate(job: dict) -> None:
    """Bounded structural load only. No peer or expired message is reissued."""
    binding = job.get("source_binding")
    if "source_binding" not in job:
        return
    if (
        type(binding) is not dict
        or set(binding)
        != {
            "schema",
            "repository_id",
            "verified_peer_ref",
            "peer_binding_ref",
            "peer_binding_revision",
            "query_owner_id",
            "descriptor_epoch",
            "original",
            "rows",
        }
        or binding["schema"] != SCHEMA
    ):
        raise ValueError
    for name in (
        "repository_id",
        "verified_peer_ref",
        "peer_binding_ref",
        "query_owner_id",
        "descriptor_epoch",
    ):
        reference(binding[name])
    counter(binding["peer_binding_revision"])
    descriptor = binding["original"]
    if (
        type(descriptor) is not dict
        or set(descriptor) != FEATURE_FIELDS
        or descriptor.get("contract_version") != CONTRACT
        or descriptor.get("feature") != "people_csv"
        or len(json.dumps(descriptor, allow_nan=False).encode()) > 16384
    ):
        raise ValueError
    for name in (
        "request_id",
        "operation_id",
        "operation_binding_ref",
        "authority_ref",
        "scope_ref",
        "parameter_reference",
    ):
        reference(descriptor.get(name))
    counter(descriptor.get("authority_revision"))
    if str(UUID(descriptor["request_id"])) != descriptor["request_id"]:
        raise ValueError
    actor, params = descriptor["actor"], descriptor["params"]
    if (
        type(actor) is not dict
        or set(actor) != {"kind", "user_id"}
        or actor["kind"] != "human"
        or type(params) is not dict
        or set(params) != {"preview_ref", "ownership_policy_ref", "revision_policy_ref"}
    ):
        raise ValueError
    reference(actor["user_id"])
    for value in params.values():
        reference(value)
    if (
        not timedelta()
        < aware(descriptor["request_expires_at"]) - aware(descriptor["issued_at"])
        <= timedelta(seconds=15)
    ):
        raise ValueError
    try:
        absolute_time(descriptor["execution_expires_at"])
    except AccessError:
        raise ValueError from None
    rows = binding["rows"]
    if type(rows) is not dict or len(rows) > len(job["rows"]):
        raise ValueError
    for key, receipt in rows.items():
        if type(key) is not str or not key.isdecimal() or str(int(key)) != key:
            raise ValueError
        index = int(key)
        if (
            not 1 <= index <= len(job["rows"])
            or type(receipt) is not dict
            or set(receipt)
            != {
                "user_id",
                "person_revision",
                "source_line",
                "origin_ref",
                "state",
            }
        ):
            raise ValueError
        row = job["rows"][index - 1]
        if (
            row["state"] != "saved"
            or type(receipt["source_line"]) is not int
            or receipt["source_line"] != row["source_line"]
            or receipt["state"] not in {"central_committed", "central_deleted"}
        ):
            raise ValueError
        reference(receipt["user_id"])
        reference(receipt["origin_ref"])
        counter(receipt["person_revision"])
    if {str(row["index"]) for row in job["rows"] if row["state"] == "saved"} != set(rows):
        raise ValueError
