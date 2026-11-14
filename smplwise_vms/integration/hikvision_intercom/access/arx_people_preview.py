"""Native catalog producer over the original CSV planner and scoped source.

Called only by the original authenticated feature source. Fingerprints are
native input/origin equality seals; authority is the signed current policy.
Private CSV data remains in the authenticated response needed by features/start.
"""

from __future__ import annotations

import asyncio
from collections.abc import Callable
from typing import TYPE_CHECKING, Any

from ..trusted_actions.envelope import thaw
from ..trusted_actions.source_bindings import same_ports
from ..trusted_actions.validation import Refusal
from .arx_people_execution import change_digest, check_people_scope
from .models import AccessError

if TYPE_CHECKING:
    from .arx_feature_execution_contract import FeatureRequest
    from .arx_policy_snapshot import PolicySnapshot
    from .manager import AccessManager


async def prepare_people_csv(
    manager: AccessManager,
    request: FeatureRequest,
    snapshot: PolicySnapshot,
    guard: Callable[[], None],
) -> dict[str, Any]:
    guard()
    source = thaw(snapshot.payload["private_input"])
    if (
        request.get("feature") != "people_csv"
        or "people/write" not in snapshot.permissions
        or snapshot.rows
        or type(source) is not dict
        or set(source) != {"kind", "content", "mode", "column_map"}
        or source["kind"] != "csv"
        or type(source["content"]) is not str
        or type(source["mode"]) is not str
        or source["column_map"] is not None
        and type(source["column_map"]) is not dict
    ):
        raise Refusal("invalid_fields")
    repository, bulk = manager.repository, manager.bulk
    ports = (manager._bulk_preview, manager._csv_rules, bulk.rules_stamp)
    detached, rules = repository.preview_copy(), manager._csv_rules()
    rules_stamp = bulk.rules_stamp()

    def current() -> None:
        guard()
        if (
            manager._closed
            or manager.repository is not repository
            or manager.bulk is not bulk
            or not same_ports(ports, (manager._bulk_preview, manager._csv_rules, bulk.rules_stamp))
            or manager._csv_rules() != rules
            or bulk.rules_stamp() != rules_stamp
        ):
            raise AccessError("bulk_review_stale")

    preview, changes, stamp = await asyncio.to_thread(
        ports[0], source["content"], source["mode"], detached, rules, source["column_map"]
    )
    current()
    if preview["errors"] or not 1 <= len(changes) <= 2000:
        raise AccessError("csv_preview_invalid")
    if repository.bulk_stamp() != stamp:
        raise AccessError("bulk_review_stale")
    lines = [row["line"] for row in preview["rows"] if row["operation"] != "unchanged"]
    policy_rows, rows = [], []
    for change, line in zip(changes, lines, strict=True):
        before = detached.get(change["user_id"]) if change["user_id"] else None
        after = detached.preview_bulk([change])[0]
        targets = check_people_scope(repository, snapshot.stations, before, after)
        # The original repository HMAC protects the native row origin, bound
        # to this operation/actor/scope/revision and exact normalized change.
        # It is never used to grant a permission absent from the source policy.
        origin = repository.fingerprint(
            {
                "kind": "arx.people_csv.row_origin.v1",
                "repository_id": snapshot.payload["repository_id"],
                "bridge_owner": thaw(snapshot.payload["bridge_owner"]),
                "actor": thaw(snapshot.payload["actor"]),
                "scope_ref": snapshot.payload["scope_ref"],
                "authority_ref": snapshot.payload["authority_ref"],
                "authority_revision": snapshot.revision,
                "operation_id": request.get("operation_id"),
                "source_line": line,
                "change_digest": change_digest(change),
            }
        )
        row = {
            "grant_id": origin,
            "source_line": line,
            "user_id": change["user_id"],
            "revision": change["revision"],
            "origin_ref": origin,
            "change_digest": change_digest(change),
        }
        policy_rows.append(row)
        rows.append(
            {
                **row,
                "grants": {
                    "permission": "people/write",
                    "scope_ref": snapshot.payload["scope_ref"],
                    "station_grant_ids": [
                        item["grant_id"]
                        for item in snapshot.payload["stations"]
                        if item["station_id"] in targets
                    ],
                },
            }
        )
    current()
    if repository.bulk_stamp() != stamp:
        raise AccessError("bulk_review_stale")
    private = {
        **source,
        "review_token": preview["review_token"],
        "review_stamp": stamp,
        "rules_stamp": rules_stamp,
    }
    policy = {**thaw(snapshot.payload), "rows": policy_rows, "private_input": private}
    policy["grant_ids"] = [item["grant_id"] for item in policy["stations"] + policy_rows]
    return {
        "schema": "arx.people_csv.preview.v1",
        "review_token": preview["review_token"],
        "review_stamp": stamp,
        "rules_stamp": rules_stamp,
        "rows": rows,
        "expires_at": snapshot.payload["expires_at"],
        "start": {"request": thaw(request.descriptor), "policy_snapshot": policy},
    }
