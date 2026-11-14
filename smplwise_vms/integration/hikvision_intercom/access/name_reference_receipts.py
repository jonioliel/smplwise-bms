"""Value-free name-reference receipts, saved in the native person transaction."""

from __future__ import annotations

from typing import Any

from .models import AccessError, text_field

SCHEMA = "wiskey-name-ref-receipt.v1"
FIELDS = frozenset({
    "schema", "operation_id", "request_id", "name_ref", "person_ref", "actor",
    "source_epoch", "expected_person_revision", "person_revision", "saved_at",
    "action", "user_ids", "changed", "stations",
})


def validate(key: str, receipt: Any) -> None:
    from .admin_audit import _instant

    if (
        type(receipt) is not dict or set(receipt) != FIELDS or receipt["schema"] != SCHEMA
        or receipt["operation_id"] != key or receipt["action"] != "users/name_ref_apply_v1"
        or type(receipt["changed"]) is not int or receipt["changed"] != 1
        or receipt["user_ids"] != [receipt["person_ref"]]
        or type(receipt["stations"]) is not list
    ):
        raise AccessError("invalid_storage")
    for name in (
        "operation_id", "request_id", "name_ref", "person_ref", "actor", "source_epoch",
    ):
        text_field(receipt[name], 128)
    for name in ("expected_person_revision", "person_revision"):
        if type(receipt[name]) is not int or not 1 <= receipt[name] <= 2**53 - 1:
            raise AccessError("invalid_storage")
    if receipt["person_revision"] != receipt["expected_person_revision"] + 1:
        raise AccessError("invalid_storage")
    for station in receipt["stations"]:
        text_field(station, 128)
    _instant(receipt["saved_at"])
