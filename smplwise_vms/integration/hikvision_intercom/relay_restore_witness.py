"""Closed consumer of a PROPOSED original-Arx external lineage assertion.

Arx must consult/advance its original witness OUTSIDE the restored storage set
before authenticating this assertion. A fixed UUID/epoch or a restored JSON file
cannot satisfy that producer contract. No such producer is shipped by Native.
Transport authentication identifies Arx; it does not prove witness survival.
"""

from .relay_export_contract import fields
from .trusted_actions.validation import Refusal

CONTRACT = "arx.wiskey.relay-restore-witness.v1"
FIELDS = {
    "contract",
    "schema_version",
    "producer",
    "scope",
    "incarnation_id",
    "checkpoint",
    "anchor",
    "head",
    "status",
    "repository_id",
    "bridge_entry_id",
    "query_owner_id",
    "generation_id",
    "token",
    "seq",
    "content_digest",
    "boot_id",
    "connection_ref",
    "position",
    "anchor_position",
    "head_position",
}
HORIZON = ".storage/hikvision_intercom.relay_export/witness.v1.json"


def validate(value, *, binding, intent):
    if value is None:
        raise Refusal("relay_witness_unavailable")
    fields(value, FIELDS)
    if (
        value["contract"] != CONTRACT
        or type(value["schema_version"]) is not int
        or value["schema_version"] != 1
        or value["producer"] != "arx-original-lineage:relay/v1"
        or value["scope"] != "outside_core_and_arx_restore"
    ):
        raise Refusal("relay_witness_invalid")
    if value["status"] != "current":
        raise Refusal(
            "relay_witness_unavailable"
            if value["status"] == "unavailable"
            else "relay_witness_stale"
        )
    if (
        type(value["incarnation_id"]) is not str
        or not 1 <= len(value["incarnation_id"]) <= 128
        or any(
            type(value[k]) is not str
            or len(value[k]) != 64
            or any(c not in "0123456789abcdef" for c in value[k])
            for k in ("checkpoint", "anchor", "head")
        )
    ):
        raise Refusal("relay_witness_invalid")
    if (
        type(value["seq"]) is not int
        or not 1 <= value["seq"] <= 9007199254740991
        or type(value["content_digest"]) is not str
        or len(value["content_digest"]) != 71
        or not value["content_digest"].startswith("sha256:")
        or any(c not in "0123456789abcdef" for c in value["content_digest"][7:])
    ):
        raise Refusal("relay_witness_invalid")
    if not value["checkpoint"] == value["anchor"] == value["head"]:
        raise Refusal("relay_witness_stale")
    if any(
        type(value[k]) is not int or not 1 <= value[k] <= 9007199254740991
        for k in ("position", "anchor_position", "head_position")
    ):
        raise Refusal("relay_witness_invalid")
    if not value["position"] == value["anchor_position"] == value["head_position"]:
        raise Refusal("relay_witness_stale")
    if any(
        type(value[k]) is not type(binding[k]) or value[k] != binding[k]
        for k in ("repository_id", "bridge_entry_id", "query_owner_id", "boot_id", "connection_ref")
    ) or any(
        type(value[k]) is not type(intent[k]) or value[k] != intent[k]
        for k in ("generation_id", "token", "seq", "content_digest")
    ):
        raise Refusal("relay_witness_foreign")
    return value


def check_horizon(root, witness):
    """Only observed original-Arx facts; never increments a Native counter."""
    from pathlib import Path

    from .access.native_sqlite_backup import read_private
    from .trusted_actions.validation import strict_json

    try:
        before = strict_json(read_private(Path(root) / HORIZON, limit=32768))
    except FileNotFoundError:
        return
    fields(before, FIELDS)
    validate(
        before,
        binding={
            k: before[k]
            for k in (
                "repository_id",
                "bridge_entry_id",
                "query_owner_id",
                "boot_id",
                "connection_ref",
            )
        },
        intent={k: before[k] for k in ("generation_id", "token", "seq", "content_digest")},
    )
    stable = (
        "producer",
        "scope",
        "incarnation_id",
        "repository_id",
        "bridge_entry_id",
        "query_owner_id",
    )
    if any(before[k] != witness[k] for k in stable):
        raise Refusal("relay_witness_foreign")
    if (
        type(before["position"]) is not int
        or witness["position"] < before["position"]
        or witness["position"] == before["position"]
        and any(
            witness[k] != before[k]
            for k in ("checkpoint", "generation_id", "token", "seq", "content_digest")
        )
    ):
        raise Refusal("relay_witness_stale")


def record_observed(root, witness):
    """Called under the existing commit fence, before startup replacement.

    A crash after recording is conservative: it cannot admit an older intent.
    This evidence cannot prove freshness if it AND Arx's witness are restored.
    """
    from pathlib import Path

    from homeassistant.util.file import write_utf8_file_atomic

    from .relay_export_contract import canonical_json

    check_horizon(root, witness)
    path = Path(root) / HORIZON
    # The existing authenticated stage owns/validates this private directory.
    if not path.parent.is_dir() or path.parent.is_symlink():
        raise Refusal("relay_witness_unavailable")
    write_utf8_file_atomic(str(path), canonical_json(witness).decode(), private=True)
