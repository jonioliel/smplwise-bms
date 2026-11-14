"""Actual native bulk/CSV coordinator, dormant until explicit Arx composition.

The source resolves private input and row origins from its authenticated preview.
WisKey reparses through its existing native planners and saves each person and
original row receipt through CheckpointJobs. CSV2 stays a separate read contract.
"""

from __future__ import annotations

import asyncio
import json
from hashlib import sha256
from typing import TYPE_CHECKING, Any

from ..trusted_actions.envelope import thaw
from ..trusted_actions.source_bindings import same_ports
from ..trusted_actions.validation import Refusal
from .arx_execution_authority import FeatureLease, StationGrant
from .arx_feature_execution_contract import FeatureBoundary
from .checkpoint_jobs import CheckpointJobs
from .models import AccessError, ManagedUser
from .repository import AccessRepository

if TYPE_CHECKING:
    from .manager import AccessManager


def change_digest(change: dict[str, Any]) -> str:
    """Input equality only. A digest never grants authority or identifies a person."""
    return sha256(
        json.dumps(change, sort_keys=True, separators=(",", ":"), allow_nan=False).encode()
    ).hexdigest()


def check_people_scope(
    repository: AccessRepository,
    stations: tuple[StationGrant, ...],
    before: ManagedUser | None,
    after: ManagedUser | None,
) -> set[str]:
    """The native full before/after and queued-retirement target scope check."""
    allowed: dict[str, set[int]] = {}
    for station in stations:
        allowed.setdefault(station.station_id, set()).add(station.physical_relay)
    targets: set[str] = set()
    for person in (before, after):
        if person is None:
            continue
        targets.update(person.assignments)
        for sid, assignment in person.assignments.items():
            if set(assignment.allowed_locks) - allowed.get(sid, set()):
                raise AccessError("unauthorized")
    if before is not None:
        state = repository._state
        targets.update(sid for sid, rows in state["bindings"].items() if before.id in rows)
        for name in ("retired_cards", "retired_pins"):
            targets.update(
                sid
                for row in state[name].values()
                if row["user_id"] == before.id
                for sid in row["targets"]
            )
    if targets - set(allowed):
        raise AccessError("unauthorized")
    return targets


class PeopleCsvCoordinator:
    def __init__(self, manager: AccessManager, lease: FeatureLease) -> None:
        if type(lease) is not FeatureLease:
            raise Refusal("Unauthorized")
        lease.require("people/write")
        if lease.message.request.get("feature") != "people_csv":
            raise Refusal("Unauthorized")
        self.manager, self.lease = manager, lease
        self._manager, self._lease, self._repository = manager, lease, manager.repository
        self._ports = (
            manager._bulk_preview,
            manager._csv_rules,
            manager.bulk,
            manager.bulk.preview,
            manager.bulk.rules_stamp,
            manager.request,
            manager.repository._commit,
        )
        self._grants = {row.change_digest: row for row in lease.policy.rows}
        self._lock = asyncio.Lock()
        self._job: str | None = None
        self._closed = False

        async def authorize(actor: str) -> bool:
            self._current()
            return actor == lease.message.query_owner_id

        self._jobs = CheckpointJobs(
            manager,
            authorize,
            scope_guard=self._current,
            row_guard=self._row,
            peer_message=lease.message,
            owner_lease=(
                lease
                if FeatureBoundary.native_owner(lease.message._boundary, lease.message)
                else None
            ),
        )
        self._owned_jobs = self._jobs

    def _current(self) -> None:
        m = self._manager
        if (
            self._closed
            or self.manager is not m
            or self.lease is not self._lease
            or m.repository is not self._repository
            or m._closed
            or self._jobs is not self._owned_jobs
            or self._grants != {row.change_digest: row for row in self._lease.policy.rows}
            or not same_ports(
                self._ports,
                (
                    m._bulk_preview,
                    m._csv_rules,
                    m.bulk,
                    m.bulk.preview,
                    m.bulk.rules_stamp,
                    m.request,
                    m.repository._commit,
                ),
            )
        ):
            raise Refusal("Unauthorized")
        self._lease.require("people/write")

    def _row(
        self, change: dict[str, Any], before: ManagedUser | None, after: ManagedUser | None
    ) -> str:
        self._current()
        grant = self._grants.get(change_digest(change))
        if (
            grant is None
            or change["user_id"] != grant.user_id
            or change["revision"] != grant.revision
            or (
                before is not None
                and (before.id != grant.user_id or before.revision != grant.revision)
            )
            or (before is None and grant.user_id is not None)
        ):
            raise AccessError("unauthorized")
        check_people_scope(self._repository, self._lease.policy.stations, before, after)
        self._current()
        return grant.origin_ref

    async def _prepare(self) -> tuple[dict[str, Any], list[dict[str, Any]], list[int], str]:
        self._current()
        source = thaw(self._lease.private_input)
        if type(source) is not dict or source.get("kind") not in {"csv", "bulk"}:
            raise Refusal("invalid_fields")
        manager = self._manager
        if source["kind"] == "csv":
            if set(source) != {
                "kind",
                "content",
                "mode",
                "column_map",
                "review_token",
                "review_stamp",
                "rules_stamp",
            }:
                raise Refusal("invalid_fields")
            detached, rules = self._repository.preview_copy(), manager._csv_rules()
            preview, changes, stamp = await asyncio.to_thread(
                manager._bulk_preview,
                source["content"],
                source["mode"],
                detached,
                rules,
                source["column_map"],
            )
            self._current()
            if preview["errors"] or preview["review_token"] != source["review_token"]:
                raise AccessError("bulk_review_stale")
            lines = [row["line"] for row in preview["rows"] if row["operation"] != "unchanged"]
        else:
            if set(source) != {"kind", "request", "review_stamp", "rules_stamp"}:
                raise Refusal("invalid_fields")
            if source["request"].get("action") == "sync":
                # This adapter is for person mutations. Native sync remains its
                # separate operation and never fabricates a person row receipt.
                raise AccessError("operation_unsupported")
            preview = await manager.bulk.preview(
                self._lease.message.query_owner_id, source["request"]
            )
            self._current()
            review = manager.bulk.reviews[preview["operation_id"]]
            changes, stamp = review["changes"], review["stamp"]
            lines = list(range(1, len(changes) + 1))
        if (
            stamp != source["review_stamp"]
            or manager.bulk.rules_stamp() != source["rules_stamp"]
            or len(changes) != len(self._grants)
            or not changes
            or {change_digest(c) for c in changes} != set(self._grants)
            or any(
                self._grants[change_digest(c)].source_line != line
                for c, line in zip(changes, lines, strict=True)
            )
        ):
            raise AccessError("bulk_review_stale")
        # Full actual before/after scope is checked before admitting any row,
        # then again in every native row transaction after CPU/lock waits.
        detached = self._repository.preview_copy()
        for change in changes:
            before = detached.get(change["user_id"]) if change["user_id"] else None
            after = None if change.get("delete") else detached.preview_bulk([change])[0]
            self._row(change, before, after)
        self._current()
        return source, changes, lines, stamp

    async def execute(self) -> dict[str, Any]:
        self._current()
        async with self._lock:
            self._current()
            if self._job is not None:
                return self.receipt()
            source, changes, lines, stamp = await self._prepare()
            self._current()
            job = await self._jobs.create(
                self._lease.message.query_owner_id,
                source["kind"],
                changes,
                stamp=stamp,
                rules=source["rules_stamp"],
                source_lines=lines,
            )
            self._job = job["id"]
            self._current()
            if job["state"] == "paused":
                await self._jobs.action(
                    self._lease.message.query_owner_id, job["id"], job["revision"], "resume"
                )
            task = self._jobs.tasks.get(job["id"])
            if task is not None:
                try:
                    await asyncio.shield(task)
                except asyncio.CancelledError:
                    await self.close()
                    raise
            self._current()
            return self.receipt()

    def receipt(self) -> dict[str, Any]:
        self._current()
        if self._job is None:
            raise AccessError("operation_not_found")
        job = self._repository._state["checkpoint_jobs"][self._job]
        self._jobs._bound_job(job)
        return {
            **self._jobs.public(job),
            "source_binding": {key: thaw(value) for key, value in job["source_binding"].items()},
            "device_application": "unknown",
        }

    async def close(self) -> None:
        self._closed = True
        await self._jobs.close()
